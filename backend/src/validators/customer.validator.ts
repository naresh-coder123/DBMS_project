import { z } from 'zod';
import { email, name, nonEmpty, NON_EMPTY_MSG, phone } from './common.validator';

export const createCustomerSchema = z
  .object({
    fname: name,
    lname: name.optional(),
    cust_cont: phone,
    cust_mail: email.optional(),
  })
  .strict();

export const updateCustomerSchema = createCustomerSchema.partial().refine(nonEmpty, NON_EMPTY_MSG);
