import { z } from 'zod';
import { id } from './common.validator';

const quantity = z.number().int().min(1).max(50);

export const orderItemSchema = z.object({ menu_item_id: id, quantity }).strict();

export const createOrderSchema = z
  .object({
    cust_id: id,
    rest_id: id,
    o_addr: z.string().trim().min(1).max(500),
    items: z.array(orderItemSchema).min(1, 'Order must contain at least one item').max(30),
  })
  .strict();

export const updateOrderSchema = z.object({ o_addr: z.string().trim().min(1).max(500) }).strict();

export const updateOrderItemSchema = z.object({ quantity }).strict();

export const orderItemParamsSchema = z.object({ id, lineNo: id });

export const payOrderSchema = z
  .object({ amount_paid: z.number().positive().max(99999999.99).multipleOf(0.01) })
  .strict();

export const orderFilterSchema = z.object({
  status: z.enum(['PLACED', 'PAID', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']).optional(),
  cust_id: id.optional(),
  rest_id: id.optional(),
  dp_id: id.optional(),
});
