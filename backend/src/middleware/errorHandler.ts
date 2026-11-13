import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

interface PgError {
  code: string;
  message: string;
  detail?: string;
  constraint?: string;
}

const isPgError = (err: unknown): err is PgError =>
  typeof err === 'object' && err !== null && typeof (err as PgError).code === 'string' && 'severity' in err;

// PostgreSQL SQLSTATE codes -> HTTP status + message
const PG_ERRORS: Record<string, [number, string]> = {
  '23505': [409, 'Duplicate value violates a unique constraint'],
  '23503': [409, 'Foreign key violation: referenced record is missing, or this record is still in use'],
  '23514': [400, 'Value violates a check constraint'],
  '23502': [400, 'A required field is missing'],
  '22P02': [400, 'Invalid input syntax'],
  '22003': [400, 'Numeric value out of range'],
};

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    return;
  }

  if (isPgError(err)) {
    // RAISE EXCEPTION from our triggers -> business-rule violation
    if (err.code === 'P0001') {
      res.status(400).json({ error: err.message });
      return;
    }
    const mapped = PG_ERRORS[err.code];
    if (mapped) {
      res.status(mapped[0]).json({ error: mapped[1], detail: err.detail ?? err.constraint });
      return;
    }
  }

  // Malformed JSON body from express.json()
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
