import { logger } from './logger.js';
import { disconnectDb } from './db.js';

const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000;

export function attachGracefulShutdown(server) {
  let isShuttingDown = false;
  const connections = new Set();

  server.on('connection', (connection) => {
    connections.add(connection);
    connection.on('close', () => connections.delete(connection));
  });

  function shutdown(signal) {
    if (isShuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress');
      return;
    }
    isShuttingDown = true;

    logger.info(
      { signal, activeConnections: connections.size, timeoutMs: SHUTDOWN_TIMEOUT_MS },
      'Graceful shutdown started'
    );

    const forceTimer = setTimeout(() => {
      logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Forced shutdown after timeout');
      for (const connection of connections) {
        connection.destroy();
      }
      disconnectDb()
        .catch((err) => logger.error({ err }, 'Error disconnecting database during forced shutdown'))
        .finally(() => process.exit(1));
    }, SHUTDOWN_TIMEOUT_MS);

    server.close(async (err) => {
      clearTimeout(forceTimer);

      if (err) {
        logger.error({ err }, 'Error closing HTTP server');
        process.exit(1);
        return;
      }

      logger.info('HTTP server closed — all connections drained');

      try {
        await disconnectDb();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (dbErr) {
        logger.error({ err: dbErr }, 'Error disconnecting database');
        process.exit(1);
      }
    });

    for (const connection of connections) {
      connection.end();
    }
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return {
    isShuttingDown: () => isShuttingDown,
    shutdown,
  };
}

export function shuttingDownMiddleware(getIsShuttingDown) {
  return (req, res, next) => {
    if (!getIsShuttingDown()) {
      return next();
    }
    res.setHeader('Connection', 'close');
    return res.status(503).json({ error: 'Server is shutting down' });
  };
}
