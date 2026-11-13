import express from 'express';
import { pool } from './db/pool';
import { errorHandler, notFound } from './middleware/errorHandler';
import routes from './routes';

export const app = express();

app.use(express.json({ limit: '100kb' }));

app.get('/', (_req, res) => {
  res.json({
    name: 'Food Delivery API',
    health: '/health',
    endpoints: [
      '/api/customers',
      '/api/restaurants',
      '/api/delivery-persons',
      '/api/menu-items',
      '/api/orders',
      '/api/payments',
    ],
  });
});

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', db: 'connected' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);
