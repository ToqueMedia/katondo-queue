// Ticket routes — emit, call-next, start, complete, cancel

import { Router } from 'express';
import { z } from 'zod';
import * as ticketService from '../services/ticket.service.js';
import * as voiceConfigService from '../services/voice-config.service.js';
import * as stationService from '../services/station.service.js';
import * as serviceService from '../services/service.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { io } from '../index.js';
import { broadcastToArea } from '../socket/handler.js';

function buildVoiceText(template: string, ticketNumber: string, stationName: string): string {
  const fallback = `Senha ${ticketNumber}, dirija-se à ${stationName}`;
  if (!template) return fallback;
  return template
    .replace(/\{ticketNumber\}/g, ticketNumber)
    .replace(/\{stationName\}/g, stationName);
}

const router = Router();

const emitSchema = z.object({
  serviceId: z.number().int(),
  areaId: z.number().int(),
});

const callNextSchema = z.object({
  areaId: z.number().int(),
  stationId: z.number().int(),
});

// All ticket routes require authentication
router.use(authMiddleware);

// GET /api/tickets — list tickets with optional filters
router.get('/', requireRole('reception', 'dispenser', 'admin', 'management', 'display'), async (req, res) => {
  try {
    const areaId = req.query.areaId ? parseInt(String(req.query.areaId), 10) : undefined;
    const stationId = req.query.stationId ? parseInt(String(req.query.stationId), 10) : undefined;
    const status = req.query.status as string | undefined;
    const date = req.query.date as string | undefined;

    const tickets = await ticketService.listTickets(areaId, status as any, date, stationId);
    res.json(tickets);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('List tickets error', { module: 'tickets', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tickets/active/:stationId — get active ticket for a station
router.get('/active/:stationId', requireRole('reception'), async (req, res) => {
  try {
    const stationId = parseInt(String(req.params.stationId), 10);
    const areaId = req.auth!.areaId;
    if (!areaId) return res.status(403).json({ error: 'No area assigned' });

    const ticket = await ticketService.getActiveTicketForStation(areaId, stationId);
    res.json({ ticket: ticket || null });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Get active ticket error', { module: 'tickets', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tickets — emit new ticket (reception or dispenser)
router.post('/', requireRole('reception', 'dispenser'), async (req, res) => {
  try {
    const data = emitSchema.parse(req.body);

    // Validate user area matches ticket area for non-dispenser
    if (req.auth!.role !== 'dispenser' && req.auth!.areaId !== data.areaId) {
      return res.status(403).json({ error: 'You are not authorized for this area' });
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

    // Update queue count
    const waitingCount = await ticketService.getWaitingCount(data.areaId);
    const nextTickets = await ticketService.listTickets(data.areaId, 'waiting');
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
    logger.error('Emit ticket error', { module: 'tickets', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tickets/call-next — call next waiting ticket
router.post('/call-next', requireRole('reception'), async (req, res) => {
  try {
    const data = callNextSchema.parse(req.body);

    // Validate user area and station
    if (req.auth!.areaId !== data.areaId) {
      return res.status(403).json({ error: 'You are not authorized for this area' });
    }
    if (req.auth!.stationId !== data.stationId) {
      return res.status(403).json({ error: 'You are not authorized for this station' });
    }

    const result = await ticketService.callNext(data.areaId, data.stationId);

    const voiceConfig = await voiceConfigService.getVoiceConfig(data.areaId);
    const voiceText = buildVoiceText(voiceConfig.voiceTextTemplate || '', result.ticket.number, result.stationName);

    // Broadcast to area room
    broadcastToArea(io, data.areaId, 'ticket:called', {
      ticket: {
        id: result.ticket.id,
        number: result.ticket.number,
        stationId: data.stationId,
        stationName: result.stationName,
      },
      voiceText,
    });

    // Update queue
    const waitingCount = await ticketService.getWaitingCount(data.areaId);
    const nextTickets = await ticketService.listTickets(data.areaId, 'waiting');
    broadcastToArea(io, data.areaId, 'queue:updated', {
      waitingCount,
      nextTickets: nextTickets.slice(0, 8).map(t => ({
        id: t.id,
        number: t.number,
        serviceName: t.serviceName || '',
        createdAt: t.createdAt,
      })),
    });

    res.json({
      ticket: {
        id: result.ticket.id,
        number: result.ticket.number,
        status: result.ticket.status,
        calledAt: result.ticket.calledAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Call next error', { module: 'tickets', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tickets/:id/start — start service
router.patch('/:id/start', requireRole('reception'), async (req, res) => {
  try {
    const ticketId = parseInt(String(req.params.id), 10);
    const ticket = await ticketService.startService(ticketId);

    if (ticket) {
      broadcastToArea(io, ticket.areaId, 'ticket:started', {
        ticketId: ticket.id,
        stationId: ticket.stationId,
      });
    }

    res.json({ ticket });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Start service error', { module: 'tickets', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tickets/:id/complete — complete service
router.patch('/:id/complete', requireRole('reception'), async (req, res) => {
  try {
    const ticketId = parseInt(String(req.params.id), 10);
    const ticket = await ticketService.completeService(ticketId);

    if (ticket) {
      broadcastToArea(io, ticket.areaId, 'ticket:completed', {
        ticketId: ticket.id,
      });
    }

    res.json({ ticket });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Complete service error', { module: 'tickets', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tickets/:id/cancel — cancel waiting ticket
router.patch('/:id/cancel', requireRole('reception'), async (req, res) => {
  try {
    const ticketId = parseInt(String(req.params.id), 10);
    const ticket = await ticketService.cancelTicket(ticketId);

    if (ticket) {
      broadcastToArea(io, ticket.areaId, 'ticket:cancelled', {
        ticketId: ticket.id,
      });

      const waitingCount = await ticketService.getWaitingCount(ticket.areaId);
      const nextTickets = await ticketService.listTickets(ticket.areaId, 'waiting');
      broadcastToArea(io, ticket.areaId, 'queue:updated', {
        waitingCount,
        nextTickets: nextTickets.slice(0, 8).map(t => ({
          id: t.id,
          number: t.number,
          serviceName: t.serviceName || '',
          createdAt: t.createdAt,
        })),
      });
    }

    res.json({ ticket });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Cancel ticket error', { module: 'tickets', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tickets/:id/no-show — mark as no-show (called not answered)
router.patch('/:id/no-show', requireRole('reception'), async (req, res) => {
  try {
    const ticketId = parseInt(String(req.params.id), 10);
    const ticket = await ticketService.markNoShow(ticketId);

    if (ticket) {
      broadcastToArea(io, ticket.areaId, 'ticket:cancelled', {
        ticketId: ticket.id,
      });

      const waitingCount = await ticketService.getWaitingCount(ticket.areaId);
      const nextTickets = await ticketService.listTickets(ticket.areaId, 'waiting');
      broadcastToArea(io, ticket.areaId, 'queue:updated', {
        waitingCount,
        nextTickets: nextTickets.slice(0, 8).map(t => ({
          id: t.id,
          number: t.number,
          serviceName: t.serviceName || '',
          createdAt: t.createdAt,
        })),
      });
    }

    res.json({ ticket });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Mark no-show error', { module: 'tickets', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tickets/:id/recall — recall called ticket (max 2x)
router.patch('/:id/recall', requireRole('reception'), async (req, res) => {
  try {
    const ticketId = parseInt(String(req.params.id), 10);
    const ticket = await ticketService.recallTicket(ticketId);

    if (ticket) {
      const voiceConfig = await voiceConfigService.getVoiceConfig(ticket.areaId);
      const station = ticket.stationId ? await stationService.getStationById(ticket.stationId) : null;
      const stationName = station?.description || station?.name || `Estação ${ticket.stationId}`;
      const voiceText = buildVoiceText(voiceConfig.voiceTextTemplate || '', ticket.number, stationName);

      broadcastToArea(io, ticket.areaId, 'ticket:called', {
        ticket: {
          id: ticket.id,
          number: ticket.number,
          stationId: ticket.stationId,
          stationName: stationName,
        },
        voiceText,
      });

      const waitingCount = await ticketService.getWaitingCount(ticket.areaId);
      const nextTickets = await ticketService.listTickets(ticket.areaId, 'waiting');
      broadcastToArea(io, ticket.areaId, 'queue:updated', {
        waitingCount,
        nextTickets: nextTickets.slice(0, 8).map(t => ({
          id: t.id,
          number: t.number,
          serviceName: t.serviceName || '',
          createdAt: t.createdAt,
        })),
      });
    }

    res.json({ ticket });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Recall ticket error', { module: 'tickets', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
