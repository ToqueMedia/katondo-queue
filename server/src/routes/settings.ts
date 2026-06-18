// Settings routes — global system configuration

import { Router } from 'express';
import { z } from 'zod';
import * as settingsService from '../services/settings.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Public endpoint for Android wrapper to fetch server URL
router.get('/server-url', async (_req, res) => {
  try {
    const url = await settingsService.getServerUrl();
    res.json({ serverUrl: url });
  } catch (error) {
    logger.error('Get server URL error', { module: 'settings', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected endpoints — root and admin
router.use(authMiddleware);

router.get('/', requireRole('root', 'admin', 'admin_manager'), async (_req, res) => {
  try {
    const settings = await settingsService.getAllSettings();
    res.json(settings);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Get settings error', { module: 'settings', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updateSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  description: z.string().optional(),
});

router.put('/', requireRole('root', 'admin', 'admin_manager'), async (req, res) => {
  try {
    const data = updateSchema.parse(req.body);
    await settingsService.setSetting(data.key, data.value, data.description);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Update setting error', { module: 'settings', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
