import { PoolClient } from 'pg';
import { env } from '../config/env';
import { pool } from '../db/pool';
import { withTransaction } from '../db/transaction';
import { DeliveryPerson, Order, OrderItem, OrderStatusLog, Payment } from '../types/models';
import { AppError } from '../utils/AppError';
import { createCrudService } from './crud.service';

export interface NewOrder {
  cust_id: number;
  rest_id: number;
  o_addr: string;
  items: { menu_item_id: number; quantity: number }[];
}

export interface OrderDetails extends Order {
  items: (OrderItem & { item_name: string; line_total: string })[];
  payment: Payment | null;
  delivery_person: Pick<DeliveryPerson, 'dp_id' | 'fname' | 'lname'> | null;
}

/**
 * SELECT ... FOR UPDATE: locks the order row until COMMIT/ROLLBACK, so two
 * concurrent requests (e.g. two "pay" clicks) on the same order run one after another.
 */
async function lockOrder(client: PoolClient, orderId: number): Promise<Order> {
  const { rows } = await client.query<Order>('SELECT * FROM orders WHERE o_id = $1 FOR UPDATE', [orderId]);
  if (!rows[0]) throw AppError.notFound('Order', orderId);
  return rows[0];
}

function requireStatus(order: Order, allowed: Order['status'][], action: string) {
  if (!allowed.includes(order.status)) {
    throw AppError.conflict(`Cannot ${action} order ${order.o_id}: order is ${order.status}`);
  }
}

// ----------------------------------------------------------------- reads

// Plain list query reuses the generic CRUD builder; writes go through the transactions below.
const orderCrud = createCrudService<Order>({
  table: 'orders',
  idColumn: 'o_id',
  entityName: 'Order',
  filterable: ['status', 'cust_id', 'rest_id', 'dp_id'],
  orderBy: 'o_id DESC',
});

export const listOrders = orderCrud.list;

export async function getOrder(
  orderId: number,
  db: Pick<PoolClient, 'query'> = pool,
  customerId?: number,
): Promise<OrderDetails> {
  const { rows: [order] } = await db.query<Order>('SELECT * FROM orders WHERE o_id = $1', [orderId]);
  if (!order || (customerId !== undefined && order.cust_id !== customerId)) {
    throw AppError.notFound('Order', orderId);
  }

  const { rows: items } = await db.query<OrderDetails['items'][number]>(
    `SELECT oi.*, mi.item_name, (oi.quantity * oi.item_price)::NUMERIC(10,2) AS line_total
     FROM order_item oi
     JOIN menu_item mi ON mi.menu_item_id = oi.menu_item_id
     WHERE oi.o_id = $1
     ORDER BY oi.line_no`,
    [orderId],
  );
  const { rows: [payment] } = await db.query<Payment>('SELECT * FROM payment WHERE o_id = $1', [orderId]);

  const deliveryPerson = order.dp_id === null ? null : (await db.query<NonNullable<OrderDetails['delivery_person']>>(
    'SELECT dp_id, fname, lname FROM delivery_person WHERE dp_id = $1',
    [order.dp_id],
  )).rows[0] ?? null;

  return { ...order, items, payment: payment ?? null, delivery_person: deliveryPerson };
}

export async function getStatusHistory(orderId: number): Promise<OrderStatusLog[]> {
  const { rows } = await pool.query<OrderStatusLog>(
    'SELECT * FROM order_status_log WHERE o_id = $1 ORDER BY changed_at, log_id',
    [orderId],
  );
  if (rows.length === 0) throw AppError.notFound('Order', orderId);
  return rows;
}

// ----------------------------------------------------------- transactions

/**
 * TX: place order = INSERT orders + INSERT every order_item, all or nothing.
 * Triggers fill line_no + item_price, check the menu item belongs to the
 * restaurant, and recompute orders.total_amount.
 */
export async function createOrder(input: NewOrder): Promise<OrderDetails> {
  return withTransaction(async (client) => {
    const { rows: [order] } = await client.query<Order>(
      'INSERT INTO orders (cust_id, rest_id, o_addr) VALUES ($1, $2, $3) RETURNING *',
      [input.cust_id, input.rest_id, input.o_addr],
    );

    for (const item of input.items) {
      await client.query('INSERT INTO order_item (o_id, menu_item_id, quantity) VALUES ($1, $2, $3)', [
        order.o_id,
        item.menu_item_id,
        item.quantity,
      ]);
    }

    return getOrder(order.o_id, client);
  }, 'createOrder', (created) => [created.o_id]);
}

/**
 * TX: pay = lock order -> INSERT payment -> UPDATE status to PAID.
 * Trigger fn_payment_fill computes total/change; trigger fn_order_validate_status
 * refuses PAID unless the payment row exists in this same transaction.
 */
export async function payOrder(orderId: number, amountPaid: number, customerId?: number): Promise<OrderDetails> {
  return withTransaction(async (client) => {
    const order = await lockOrder(client, orderId);
    if (customerId !== undefined && order.cust_id !== customerId) {
      throw AppError.notFound('Order', orderId);
    }
    requireStatus(order, ['PLACED'], 'pay for');

    await client.query('INSERT INTO payment (o_id, amount_paid) VALUES ($1, $2)', [orderId, amountPaid]);
    await client.query("UPDATE orders SET status = 'PAID' WHERE o_id = $1", [orderId]);
    return getOrder(orderId, client);
  }, 'payOrder', [orderId]);
}

/**
 * TX: assign = lock order -> pick a random free delivery person
 * (FOR UPDATE SKIP LOCKED so parallel assignments never pick the
 * same person) -> mark them busy -> set order OUT_FOR_DELIVERY.
 * No free delivery person -> throw -> ROLLBACK; the order stays PAID and waits.
 */
export async function assignDelivery(
  orderId: number,
  customerId?: number,
  name = 'assignDelivery',
): Promise<OrderDetails> {
  return withTransaction(async (client) => {
    const order = await lockOrder(client, orderId);
    if (customerId !== undefined && order.cust_id !== customerId) {
      throw AppError.notFound('Order', orderId);
    }
    if (order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED') {
      return getOrder(orderId, client);
    }
    requireStatus(order, ['PAID'], 'assign delivery for');

    const { rows: [dp] } = await client.query<{ dp_id: number }>(
      `SELECT dp_id FROM delivery_person
       WHERE is_available
       ORDER BY random()
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
    );
    if (!dp) {
      throw AppError.conflict('No delivery person is available right now; the order stays PAID and waits');
    }

    await client.query('UPDATE delivery_person SET is_available = FALSE WHERE dp_id = $1', [dp.dp_id]);
    await client.query("UPDATE orders SET dp_id = $1, status = 'OUT_FOR_DELIVERY' WHERE o_id = $2", [
      dp.dp_id,
      orderId,
    ]);
    return getOrder(orderId, client);
  }, name, [orderId]);
}

/** TX: deliver. Trigger fn_order_after_status frees the delivery person + logs. */
export async function markDelivered(orderId: number): Promise<OrderDetails> {
  return withTransaction(async (client) => {
    const order = await lockOrder(client, orderId);
    requireStatus(order, ['OUT_FOR_DELIVERY'], 'deliver');
    await client.query("UPDATE orders SET status = 'DELIVERED' WHERE o_id = $1", [orderId]);
    return getOrder(orderId, client);
  }, 'markDelivered', [orderId]);
}

/**
 * TX: complete demo deliveries after DELIVERY_SECONDS. The status trigger releases each rider.
 * Recorded only when it actually delivered something.
 */
export async function completeDueDeliveries(): Promise<void> {
  await withTransaction(async (client) => {
    const { rows } = await client.query<{ o_id: number }>(`
    WITH due AS (
      SELECT o_id
      FROM orders
      WHERE status = 'OUT_FOR_DELIVERY'
        AND updated_at <= now() - make_interval(secs => $1)
      ORDER BY o_id
      FOR UPDATE SKIP LOCKED
    )
    UPDATE orders
    SET status = 'DELIVERED'
    FROM due
    WHERE orders.o_id = due.o_id
    RETURNING orders.o_id
  `, [env.deliverySeconds]);
    return rows.map((row) => row.o_id);
  }, 'completeDueDeliveries (automatic)', (delivered) => delivered);
}

/**
 * Background job: when a delivery person is free, assign the order that has
 * waited longest in PAID. Each attempt is its own assignDelivery transaction.
 */
export async function assignWaitingOrder(): Promise<void> {
  const { rows: [waiting] } = await pool.query<{ o_id: number }>(
    `SELECT o_id FROM orders
     WHERE status = 'PAID' AND EXISTS (SELECT 1 FROM delivery_person WHERE is_available)
     ORDER BY updated_at, o_id
     LIMIT 1`,
  );
  if (waiting) await assignDelivery(waiting.o_id, undefined, 'assignDelivery (automatic)');
}

/** TX: cancel = refund payment (if any) + set CANCELLED, together. */
export async function cancelOrder(orderId: number, customerId?: number): Promise<OrderDetails> {
  return withTransaction(async (client) => {
    const order = await lockOrder(client, orderId);
    if (customerId !== undefined && order.cust_id !== customerId) {
      throw AppError.notFound('Order', orderId);
    }
    requireStatus(order, ['PLACED', 'PAID'], 'cancel');

    await client.query("UPDATE payment SET status = 'REFUNDED' WHERE o_id = $1 AND status = 'PAID'", [orderId]);
    await client.query("UPDATE orders SET status = 'CANCELLED' WHERE o_id = $1", [orderId]);
    return getOrder(orderId, client);
  }, 'cancelOrder', [orderId]);
}
