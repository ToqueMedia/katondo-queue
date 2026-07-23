// Service routes — CRUD + ticket format config

import { Router } from 'express';
import { z } from 'zod';
import * as serviceService from '../services/service.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  areaId: z.number().int(),
  ticketFormat: z.enum(['numeric', 'alphanumeric', 'custom']),
  ticketPrefix: z.string().nullish().transform((val) => val ?? undefined),
  ticketDigitCount: z.number().int().default(3),
  isPriority: z.boolean().default(false),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  ticketFormat: z.enum(['numeric', 'alphanumeric', 'custom']).optional(),
  ticketPrefix: z.string().nullish().transform((val) => val ?? undefined),
  ticketDigitCount: z.number().int().optional(),
  active: z.boolean().optional(),
  isPriority: z.boolean().optional(),
});

router.use(authMiddleware);

router.get('/', requireRole('root', 'admin', 'admin_manager', 'management', 'dispenser'), async (req, res) => {
  try {
    const areaId = req.query.areaId ? parseInt(String(req.query.areaId), 10) : undefined;
    const result = await serviceService.listServices(areaId);
    res.json(result);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('List services error', { module: 'services', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('admin', 'admin_manager', 'management'), async (req, res) => {
  try {
    const data = createSchema.parse(req.body);
    const result = await serviceService.createService(
      data.name, data.areaId, data.ticketFormat, data.ticketPrefix, data.ticketDigitCount, data.isPriority,
    );
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Create service error', { module: 'services', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireRole('admin', 'admin_manager', 'management'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const data = updateSchema.parse(req.body);
    const result = await serviceService.updateService(id, data);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Update service error', { module: 'services', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin', 'admin_manager', 'management'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await serviceService.deleteService(id);
    res.json({ message: `Service ${id} deleted` });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Delete service error', { module: 'services', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;