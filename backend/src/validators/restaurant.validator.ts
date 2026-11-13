import { z } from 'zod';
import { nonEmpty, NON_EMPTY_MSG, phone } from './common.validator';

export const createRestaurantSchema = z
  .object({
    rest_name: z.string().trim().min(1).max(100),
    rest_cont: phone,
    rest_address: z.string().trim().min(1).max(500),
  })
  .strict();

export const updateRestaurantSchema = createRestaurantSchema.partial().refine(nonEmpty, NON_EMPTY_MSG);
