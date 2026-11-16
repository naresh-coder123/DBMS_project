import { app } from './app';
import { env } from './config/env';
import { pool } from './db/pool';
import { assignWaitingOrder, completeDueDeliveries } from './services/order.service';

const server = app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

let deliveryJob: Promise<void> | undefined;
const deliveryTimer = setInterval(() => {
  if (deliveryJob) return;
  // Finish due deliveries first (trigger T5 frees those riders), then hand a free rider to a waiting order.
  deliveryJob = completeDueDeliveries()
    .then(assignWaitingOrder)
    .catch((error) => console.error('Delivery job failed', error))
    .finally(() => { deliveryJob = undefined; });
}, 1000);

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  clearInterval(deliveryTimer);
  server.close(async () => {
    await deliveryJob;
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
