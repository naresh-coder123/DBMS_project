import { z } from 'zod';
import { email, name, nonEmpty, NON_EMPTY_MSG, phone, queryBool } from './common.validator';

export const createDeliveryPersonSchema = z
  .object({
    fname: name,
    lname: name.optional(),
    dp_cont: phone,
    dp_mail: email.optional(),
    is_available: z.boolean().optional(),
  })
  .strict();

export const updateDeliveryPersonSchema = createDeliveryPersonSchema.partial().refine(nonEmpty, NON_EMPTY_MSG);

export const deliveryPersonFilterSchema = z.object({
  is_available: queryBool.optional(),
});
