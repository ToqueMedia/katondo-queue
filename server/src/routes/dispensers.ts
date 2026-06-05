// Dispenser routes — CRUD

import { Router } from 'express';
import { z } from 'zod';
import * as dispenserService from '../services/dispenser.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  areaId: z.number().int(),
  username: z.string().min(3),
  password: z.string().min(6),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  areaId: z.number().int().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.use(authMiddleware);

router.get('/', requireRole('admin'), async (_req, res) => {
  try {
    const result = await dispenserService.listDispensers();
    res.json(result);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('List dispensers error', { module: 'dispensers', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const data = createSchema.parse(req.body);
    const result = await dispenserService.createDispenser(data.name, data.areaId, data.username, data.password);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Create dispenser error', { module: 'dispensers', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const data = updateSchema.parse(req.body);
    const result = await dispenserService.updateDispenser(id, data);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Update dispenser error', { module: 'dispensers', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await dispenserService.deleteDispenser(id);
    res.json({ message: `Dispenser ${id} deleted` });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Delete dispenser error', { module: 'dispensers', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;