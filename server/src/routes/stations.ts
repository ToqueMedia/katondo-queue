// Station routes — CRUD + receptionist assignment

import { Router } from 'express';
import { z } from 'zod';
import * as stationService from '../services/station.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { io } from '../index.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  areaId: z.number().int(),
  receptionUserId: z.number().int().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  receptionUserId: z.number().int().nullable().optional(),
  serviceIds: z.array(z.number().int()).optional(),
});

router.use(authMiddleware);

router.get('/', requireRole('admin', 'management'), async (req, res) => {
  try {
    const areaId = req.query.areaId ? parseInt(String(req.query.areaId), 10) : undefined;
    const result = await stationService.listStations(areaId);
    res.json(result);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('List stations error', { module: 'stations', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const data = createSchema.parse(req.body);
    const result = await stationService.createStation(data.name, data.areaId, data.receptionUserId, data.description);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Create station error', { module: 'stations', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const data = updateSchema.parse(req.body);
    const result = await stationService.updateStation(id, data);

    // Broadcast station update in real-time
    io.to(`area:${result.areaId}`).emit('station:updated', { station: result });
    io.to(`area:${result.areaId}`).emit('queue:updated', {});

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Update station error', { module: 'stations', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await stationService.deleteStation(id);
    res.json({ message: `Station ${id} deleted` });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Delete station error', { module: 'stations', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;