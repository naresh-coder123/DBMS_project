import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { pool } from '../db/pool';
import { Customer } from '../types/models';
import { AppError } from '../utils/AppError';
import { customerProfileColumns } from './customer.service';

const deriveKey = promisify(scrypt);

const tokenLifetimeSeconds = 24 * 60 * 60;

export async function signup(input: {
  fname: string;
  lname?: string;
  cust_cont: string;
  cust_mail: string;
  password: string;
}) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await deriveKey(input.password, salt, 64)) as Buffer;

  const { rows: [customer] } = await pool.query<Customer>(
    `INSERT INTO customer (fname, lname, cust_cont, cust_mail, password_hash)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${customerProfileColumns}`,
    [input.fname, input.lname, input.cust_cont, input.cust_mail.toLowerCase(), `${salt}:${hash.toString('hex')}`],
  );
  return customer;
}

export async function login(email: string, password: string) {
  const { rows: [credential] } = await pool.query<{
    cust_id: number;
    password_hash: string | null;
  }>(
    'SELECT cust_id, password_hash FROM customer WHERE lower(cust_mail) = $1',
    [email.toLowerCase()],
  );
  const [salt, storedHash] = credential?.password_hash?.split(':') ?? [];
  const hash = (await deriveKey(password, salt ?? 'missing-customer', 64)) as Buffer;
  const expectedHash = Buffer.from(storedHash ?? '', 'hex');
  if (!credential || expectedHash.length !== hash.length || !timingSafeEqual(hash, expectedHash)) {
    throw new AppError(401, 'Invalid email or password');
  }

  const expiresAt = Math.floor(Date.now() / 1000) + tokenLifetimeSeconds;
  const token = jwt.sign({ exp: expiresAt }, env.jwtSecret, {
    algorithm: 'HS256',
    subject: String(credential.cust_id),
  });
  return { token, expires_at: new Date(expiresAt * 1000) };
}

export function tokenCustomer(token: string) {
  try {
    const claims = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    if (typeof claims !== 'string' && typeof claims.exp === 'number' && /^\d+$/.test(claims.sub ?? '')) {
      const customerId = Number(claims.sub);
      if (Number.isSafeInteger(customerId) && customerId > 0) return customerId;
    }
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) throw error;
  }
  throw new AppError(401, 'Invalid or expired token');
}
