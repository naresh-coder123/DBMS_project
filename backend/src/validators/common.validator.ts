import { z } from 'zod';

export const id = z.coerce.number().int().positive();

export const idParamSchema = z.object({ id });

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const phone = z.string().trim().regex(/^\+?[0-9]{10,14}$/, 'Must be 10-14 digits, optional leading +');
export const email = z.string().trim().toLowerCase().email().max(100);
export const name = z.string().trim().min(1).max(50);