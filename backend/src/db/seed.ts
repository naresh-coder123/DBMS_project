import { pool } from './pool';
import { withTransaction } from './transaction';
import { assignDelivery, cancelOrder, createOrder, markDelivered, payOrder } from '../services/order.service';

const customers = [
  ['Aarav', 'Shah', '9000000001', 'aarav@example.com'],
  ['Diya', 'Patil', '9000000002', 'diya@example.com'],
  ['Kabir', 'Deshmukh', '9000000003', 'kabir@example.com'],
];

const restaurants = [
  ['Spice Hub', '8000000001', 'FC Road, Pune'],
  ['Pizza Point', '8000000002', 'MG Road, Pune'],
  ['Dragon Wok', '8000000003', 'Baner, Pune'],
];

// [fname, lname, contact, mail] (independent partners, not tied to a restaurant)
const deliveryPersons = [
  ['Rohan', 'More', '7000000001', 'rohan@example.com'],
  ['Sneha', 'Joshi', '7000000002', 'sneha@example.com'],
  ['Amit', 'Kale', '7000000003', 'amit@example.com'],
  ['Priya', 'Nair', '7000000004', 'priya@example.com'],
];

// [rest_id, name, category, price]
const menuItems = [
  [1, 'Paneer Tikka', 'Starter', 220],
  [1, 'Veg Biryani', 'Main Course', 180],
  [1, 'Gulab Jamun', 'Dessert', 60],
  [2, 'Margherita', 'Pizza', 250],
  [2, 'Farmhouse', 'Pizza', 320],
  [2, 'Garlic Bread', 'Sides', 120],
  [3, 'Hakka Noodles', 'Main Course', 160],
  [3, 'Veg Manchurian', 'Starter', 150],
];

async function seedBaseData() {
  // One transaction: if any insert fails, the database is left untouched.
  await withTransaction(async (client) => {
    // TRUNCATE does not fire row-level triggers; RESTART IDENTITY resets SERIAL ids to 1.
    await client.query(`
      TRUNCATE order_status_log, payment, order_item, orders,
               menu_item, delivery_person, restaurant, customer
      RESTART IDENTITY CASCADE`);

    for (const c of customers) {
      await client.query('INSERT INTO customer (fname, lname, cust_cont, cust_mail) VALUES ($1, $2, $3, $4)', c);
    }
    for (const r of restaurants) {
      await client.query('INSERT INTO restaurant (rest_name, rest_cont, rest_address) VALUES ($1, $2, $3)', r);
    }
    for (const d of deliveryPersons) {
      await client.query(
        'INSERT INTO delivery_person (fname, lname, dp_cont, dp_mail) VALUES ($1, $2, $3, $4)',
        d,
      );
    }
    for (const m of menuItems) {
      await client.query(
        'INSERT INTO menu_item (rest_id, item_name, item_category, price) VALUES ($1, $2, $3, $4)',
        m,
      );
    }
  });
  console.log(
    `Seeded ${customers.length} customers, ${restaurants.length} restaurants, ` +
      `${deliveryPersons.length} delivery persons, ${menuItems.length} menu items`,
  );
}

/** Sample orders go through the real service transactions, so triggers run too. */
async function seedOrders() {
  // #1 delivered
  const o1 = await createOrder({
    cust_id: 1, rest_id: 1, o_addr: 'Flat 12, Shivaji Nagar, Pune',
    items: [{ menu_item_id: 1, quantity: 2 }, { menu_item_id: 2, quantity: 1 }],
  });
  await payOrder(o1.o_id, 1000);
  await assignDelivery(o1.o_id);
  await markDelivered(o1.o_id);

  // #2 out for delivery
  const o2 = await createOrder({
    cust_id: 2, rest_id: 2, o_addr: 'Kothrud, Pune',
    items: [{ menu_item_id: 4, quantity: 1 }, { menu_item_id: 6, quantity: 2 }],
  });
  await payOrder(o2.o_id, 490);
  await assignDelivery(o2.o_id);

  // #3 paid, waiting for delivery person
  const o3 = await createOrder({
    cust_id: 3, rest_id: 3, o_addr: 'Aundh, Pune',
    items: [{ menu_item_id: 7, quantity: 2 }],
  });
  await payOrder(o3.o_id, 500);

  // #4 just placed
  await createOrder({
    cust_id: 1, rest_id: 2, o_addr: 'Flat 12, Shivaji Nagar, Pune',
    items: [{ menu_item_id: 5, quantity: 1 }],
  });

  // #5 cancelled after payment (refunded)
  const o5 = await createOrder({
    cust_id: 2, rest_id: 1, o_addr: 'Kothrud, Pune',
    items: [{ menu_item_id: 3, quantity: 4 }],
  });
  await payOrder(o5.o_id, 240);
  await cancelOrder(o5.o_id);

  console.log('Seeded 5 sample orders (delivered, out for delivery, paid, placed, cancelled)');
}

async function main() {
  await seedBaseData();
  if (!process.argv.includes('--no-orders')) await seedOrders();
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await pool.end();
    process.exit(1);
  });
