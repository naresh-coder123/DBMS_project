import { app } from './app';
import { env } from './config/env';
import { pool } from './db/pool';
import { completeDueDeliveries } from './services/order.service';

const server = app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

let deliveryJob: Promise<void> | undefined;
const deliveryTimer = setInterval(() => {
  if (deliveryJob) return;
  deliveryJob = completeDueDeliveries()
    .catch((error) => console.error('Could not complete due deliveries', error))
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
