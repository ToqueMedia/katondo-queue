// Display routes — CRUD + snapshot

import { Router } from 'express';
import { z } from 'zod';
import * as displayService from '../services/display.service.js';
import * as ticketService from '../services/ticket.service.js';
import * as adService from '../services/ad.service.js';
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
    const result = await displayService.listDisplays();
    res.json(result);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('List displays error', { module: 'displays', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const data = createSchema.parse(req.body);
    const result = await displayService.createDisplay(data.name, data.areaId, data.username, data.password);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Create display error', { module: 'displays', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const data = updateSchema.parse(req.body);
    const result = await displayService.updateDisplay(id, data);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Update display error', { module: 'displays', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await displayService.deleteDisplay(id);
    res.json({ message: `Display ${id} deleted` });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Delete display error', { module: 'displays', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/displays/my-snapshot — display's own snapshot (finds config by authenticated user)
router.get('/my-snapshot', requireRole('display'), async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    // Find display config by userId
    const displays = await displayService.listDisplays();
    const display = displays.find((d: any) => d.userId === userId);
    if (!display) return res.status(404).json({ error: 'Display config not found for this user' });

    const [currentInService, recentCalled, waitingCount, ads] = await Promise.all([
      ticketService.getCurrentInService(display.areaId),
      ticketService.getRecentCalled(display.areaId),
      ticketService.getWaitingCount(display.areaId),
      adService.getAdsForArea(display.areaId),
    ]);

    res.json({
      displayId: display.id,
      areaId: display.areaId,
      currentInService: currentInService ? {
        id: currentInService.id,
        number: currentInService.number,
        stationId: currentInService.stationId,
        stationName: '',
      } : null,
      recentCalled: recentCalled.map((t: any) => ({
        id: t.id,
        number: t.number,
        stationId: t.stationId,
        stationName: '',
      })),
      waitingCount,
      ads,
    });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Display my-snapshot error', { module: 'displays', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/displays/:id/snapshot — display state snapshot (display role)
router.get('/:id/snapshot', requireRole('display'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const display = await displayService.getDisplayById(id);

    const [currentInService, recentCalled, waitingCount, ads] = await Promise.all([
      ticketService.getCurrentInService(display.areaId),
      ticketService.getRecentCalled(display.areaId),
      ticketService.getWaitingCount(display.areaId),
      adService.getAdsForArea(display.areaId),
    ]);

    res.json({
      currentInService: currentInService ? {
        id: currentInService.id,
        number: currentInService.number,
        stationId: currentInService.stationId,
        stationName: '',
      } : null,
      recentCalled: recentCalled.map(t => ({
        id: t.id,
        number: t.number,
        stationId: t.stationId,
        stationName: '',
      })),
      waitingCount,
      ads,
    });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Display snapshot error', { module: 'displays', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;