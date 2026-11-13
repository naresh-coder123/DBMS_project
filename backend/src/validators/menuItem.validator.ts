import { z } from 'zod';
import { id, nonEmpty, NON_EMPTY_MSG, queryBool } from './common.validator';

export const createMenuItemSchema = z
  .object({
    rest_id: id,
    item_name: z.string().trim().min(1).max(100),
    item_category: z.string().trim().min(1).max(50).optional(),
    price: z.number().positive().max(99999999.99).multipleOf(0.01),
    is_available: z.boolean().optional(),
  })
  .strict();

export const updateMenuItemSchema = createMenuItemSchema.partial().refine(nonEmpty, NON_EMPTY_MSG);

export const menuItemFilterSchema = z.object({
  rest_id: id.optional(),
  item_category: z.string().trim().optional(),
  is_available: queryBool.optional(),
});
