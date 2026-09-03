import { Router } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const startedAt = Date.now();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    let dbConnected = mongoose.connection.readyState === 1;
    const dbName = mongoose.connection.name || null;

    if (dbConnected) {
      try {
        await mongoose.connection.db.admin().ping();
      } catch {
        dbConnected = false;
      }
    }

    const body = {
      ok: dbConnected,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      database: {
        connected: dbConnected,
        name: dbName,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(dbConnected ? 200 : 503).json(body);
  })
);

export default router;
