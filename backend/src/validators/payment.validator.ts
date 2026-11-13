import { z } from 'zod';
import { id } from './common.validator';

export const paymentFilterSchema = z.object({
  cust_id: id.optional(),
  o_id: id.optional(),
  status: z.enum(['PAID', 'REFUNDED']).optional(),
});
