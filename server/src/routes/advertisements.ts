// Advertisement routes — CRUD

import { Router } from 'express';
import { z } from 'zod';
import * as adService from '../services/ad.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { io } from '../index.js';
import { broadcastToArea } from '../socket/handler.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1),
  contentType: z.enum(['image', 'video', 'text', 'html']),
  contentUrl: z.string().nullable().optional(),
  contentText: z.string().nullable().optional(),
  areaId: z.number().int().nullable().optional(),
  durationSeconds: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  contentType: z.enum(['image', 'video', 'text', 'html']).optional(),
  contentUrl: z.string().nullable().optional(),
  contentText: z.string().nullable().optional(),
  areaId: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
  durationSeconds: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
});

router.use(authMiddleware);

router.get('/', requireRole('management', 'display'), async (req, res) => {
  try {
    const areaId = req.query.areaId ? parseInt(String(req.query.areaId), 10) : undefined;
    const result = await adService.listAds(areaId);
    res.json(result);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('List ads error', { module: 'ads', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('management'), async (req, res) => {
  try {
    const data = createSchema.parse(req.body);
    const result = await adService.createAd(
      data.title,
      data.contentType,
      data.areaId ?? null,
      data.contentUrl ?? undefined,
      data.contentText ?? undefined,
      data.durationSeconds,
      data.sortOrder,
    );
    
    // Broadcast to area if areaId is set, otherwise to everyone (global ad)
    if (result.areaId) {
      broadcastToArea(io, result.areaId, 'ads:updated', { action: 'created', ad: result });
    } else {
      io.emit('ads:updated', { action: 'created', ad: result });
    }
    
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Create ad error', { module: 'ads', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireRole('management'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const data = updateSchema.parse(req.body);
    const result = await adService.updateAd(id, data);
    
    // Broadcast to area if areaId is set, otherwise to everyone (global ad)
    if (result.areaId) {
      broadcastToArea(io, result.areaId, 'ads:updated', { action: 'updated', ad: result });
    } else {
      io.emit('ads:updated', { action: 'updated', ad: result });
    }
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Update ad error', { module: 'ads', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('management'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    
    // Get ad before deletion to know areaId
    const ad = await adService.getAdById(id);
    await adService.deleteAd(id);
    
    // Broadcast to area if areaId is set, otherwise to everyone (global ad)
    if (ad.areaId) {
      broadcastToArea(io, ad.areaId, 'ads:updated', { action: 'deleted', adId: id });
    } else {
      io.emit('ads:updated', { action: 'deleted', adId: id });
    }
    
    res.json({ message: `Ad ${id} deleted` });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Delete ad error', { module: 'ads', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
