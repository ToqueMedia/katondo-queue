// Area routes — CRUD

import { Router } from 'express';
import { z } from 'zod';
import * as areaService from '../services/area.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

router.use(authMiddleware);

router.get('/', requireRole('admin', 'management', 'reception'), async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const result = await areaService.listAreas(includeInactive);
    res.json(result);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('List areas error', { module: 'areas', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('admin', 'management'), async (req, res) => {
  try {
    const data = createSchema.parse(req.body);
    const result = await areaService.createArea(data.name, data.description);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Create area error', { module: 'areas', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireRole('admin', 'management'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const data = updateSchema.parse(req.body);
    const result = await areaService.updateArea(id, data);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Update area error', { module: 'areas', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin', 'management'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await areaService.deleteArea(id);
    res.json({ message: `Area ${id} deleted` });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Delete area error', { module: 'areas', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;