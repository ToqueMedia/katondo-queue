// Dispenser API — public endpoint for Android dispenser app
// No auth required — validated via dispenser user credentials in header

import { Router } from 'express';
import { z } from 'zod';
import * as ticketService from '../services/ticket.service.js';
import * as serviceService from '../services/service.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { io } from '../index.js';
import { broadcastToArea } from '../socket/handler.js';

const router = Router();

const emitSchema = z.object({
  serviceId: z.number().int(),
  areaId: z.number().int(),
});

const batterySchema = z.object({
  level: z.number().int().min(0).max(100),
});

// POST /api/dispenser/battery-alert — emit battery low alert
router.post('/battery-alert', authMiddleware, async (req, res) => {
  try {
    if (req.auth!.role !== 'dispenser') {
      return res.status(403).json({ error: 'Only dispenser users can emit battery alerts' });
    }

    const data = batterySchema.parse(req.body);
    const areaId = req.auth!.areaId;
    
    if (!areaId) {
      return res.status(400).json({ error: 'Área não associada ao dispensador' });
    }

    const dispenserName = req.auth!.username;

    broadcastToArea(io, areaId, 'dispenser:battery_low', {
      dispenserName,
      level: data.level
    });

    logger.info('Battery alert broadcasted', { module: 'dispenser-api', dispenserName, level: data.level, areaId });
    res.json({ message: 'Alert sent' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error('Battery alert error', { module: 'dispenser-api', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dispenser/tickets — emit ticket (dispenser user auth)
router.post('/tickets', authMiddleware, async (req, res) => {
  try {
    // Only dispenser users can use this endpoint
    if (req.auth!.role !== 'dispenser') {
      return res.status(403).json({ error: 'Only dispenser users can emit tickets' });
    }

    const data = emitSchema.parse(req.body);

    // Validate dispenser area matches
    if (req.auth!.areaId !== data.areaId) {
      return res.status(403).json({ error: 'Dispenser not authorized for this area' });
    }

    const ticket = await ticketService.emitTicket(data.serviceId, data.areaId);

    // Get service name for the ticket
    const service = await serviceService.getServiceById(data.serviceId);

    // Broadcast to area room
    broadcastToArea(io, data.areaId, 'ticket:created', {
      ticket: {
        id: ticket.id,
        number: ticket.number,
        serviceId: ticket.serviceId,
        serviceName: service?.name || '',
        areaId: ticket.areaId,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });

    const waitingCount = await ticketService.getWaitingCount(data.areaId);
    const nextTickets = await ticketService.listTickets(data.areaId, 'waiting', 'today');
    broadcastToArea(io, data.areaId, 'queue:updated', {
      waitingCount,
      nextTickets: nextTickets.slice(0, 8).map(t => ({
        id: t.id,
        number: t.number,
        serviceName: t.serviceName || '',
        createdAt: t.createdAt,
      })),
    });

    res.status(201).json({
      ...ticket,
      waitingCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Dispenser emit error', { module: 'dispenser-api', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
