import { z } from 'zod';
import { email, name, phone } from './common.validator';

export const createCustomerSchema = z
  .object({
    fname: name,
    lname: name.optional(),
    cust_cont: phone,
    cust_mail: email.optional(),
  })
  .strict();