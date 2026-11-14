import 'dotenv/config';
import { randomBytes } from 'node:crypto';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET || randomBytes(32).toString('hex'),
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/food_delivery',
};
