// Voice config routes — per-area TTS configuration

import { Router } from 'express';
import { z } from 'zod';
import * as voiceConfigService from '../services/voice-config.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const router = Router();

const updateSchema = z.object({
  language: z.string().optional(),
  voiceName: z.string().nullable().optional(),
  speed: z.number().min(0.1).max(2).optional(),
  voiceTextTemplate: z.string().nullable().optional(),
  callSoundMode: z.string().optional(),
});

router.use(authMiddleware);

router.get('/:areaId', requireRole('management', 'display'), async (req, res) => {
  try {
    const areaId = parseInt(String(req.params.areaId), 10);
    const result = await voiceConfigService.getVoiceConfig(areaId);
    res.json(result);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Get voice config error', { module: 'voice', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:areaId', requireRole('management'), async (req, res) => {
  try {
    const areaId = parseInt(String(req.params.areaId), 10);
    const data = updateSchema.parse(req.body);
    const result = await voiceConfigService.upsertVoiceConfig(areaId, data);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Update voice config error', { module: 'voice', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;