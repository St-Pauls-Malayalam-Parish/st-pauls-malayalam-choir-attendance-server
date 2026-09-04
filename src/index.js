import dotenv from 'dotenv';
import { validateEnv } from './config/env.js';
import { connectDb } from './db.js';
import { attachGracefulShutdown } from './graceful-shutdown.js';
import { logger } from './logger.js';
import { createApp } from './app.js';

dotenv.config();

try {
  validateEnv();
} catch (err) {
  logger.fatal({ err }, err.message);
  process.exit(1);
}

const app = createApp();
const port = Number(process.env.PORT) || 4000;

connectDb()
  .then(() => {
    const server = app.listen(port, '0.0.0.0', () => {
      logger.info({ port }, 'Choir API listening');
    });
    attachGracefulShutdown(server);
  })
  .catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
