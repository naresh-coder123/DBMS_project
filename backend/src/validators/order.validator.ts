import { z } from 'zod';
import { id } from './common.validator';

const orderItemSchema = z.object({ menu_item_id: id, quantity: z.number().int().min(1).max(50) }).strict();

export const createOrderSchema = z
  .object({
    cust_id: id,
    rest_id: id,
    o_addr: z.string().trim().min(1).max(500),
    items: z.array(orderItemSchema).min(1, 'Order must contain at least one item').max(30),
  })
  .strict();

export const payOrderSchema = z
  .object({ amount_paid: z.number().positive().max(99999999.99).multipleOf(0.01) })
  .strict();
