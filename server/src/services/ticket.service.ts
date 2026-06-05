// Ticket service — emit, call-next, transitions with MySQL transaction locking + station services & priority interleaving

import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tickets, dailySequences, services, stations, stationServices } from '../db/schema.js';
import { formatTicketNumber } from '../utils/ticket-format.js';
import { getToday } from '../utils/date.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { TicketStatus } from '../types/index.js';

type TicketWithServiceName = typeof tickets.$inferSelect & { serviceName: string; stationName?: string };

// Emit a new ticket — uses transaction with row-level lock on DailySequence + priority interleaving
export async function emitTicket(serviceId: number, areaId: number) {
  const today = getToday();

  return await db.transaction(async (tx) => {
    // Check if daily sequence exists first to avoid gap locks
    let sequence = await tx.query.dailySequences.findFirst({
      where: and(eq(dailySequences.serviceId, serviceId), sql`${dailySequences.date} = ${today}`),
    });

    if (!sequence) {
      try {
        await tx.insert(dailySequences).values({ serviceId, date: new Date(today), lastNumber: 0 });
      } catch {
        // Ignore duplicate key error if inserted concurrently by another dispenser
      }
    }

    // Acquire exclusive pessimistic row-level lock (FOR UPDATE) to prevent race conditions
    const lockedRows = await tx
      .select()
      .from(dailySequences)
      .where(and(eq(dailySequences.serviceId, serviceId), sql`${dailySequences.date} = ${today}`))
      .for('update');

    const lockedSeq = lockedRows[0];
    if (!lockedSeq) {
      throw new Error('Failed to find or lock daily sequence row');
    }

    // Increment sequence safely
    const newNumber = (lockedSeq.lastNumber || 0) + 1;
    await tx.update(dailySequences)
      .set({ lastNumber: newNumber })
      .where(eq(dailySequences.id, lockedSeq.id));

    // Get service config for formatting
    const service = await tx.query.services.findFirst({
      where: eq(services.id, serviceId),
    });

    if (!service) {
      throw new ValidationError('Service not found');
    }

    // Format ticket number
    const formattedNumber = formatTicketNumber(
      newNumber,
      service.ticketFormat,
      service.ticketPrefix,
      service.ticketDigitCount,
    );

    let createdAtValue = new Date();

    if (service.isPriority) {
      // Find all waiting tickets in this area for today
      const waitingTickets = await tx.query.tickets.findMany({
        where: and(
          eq(tickets.areaId, areaId),
          eq(tickets.status, 'waiting'),
          sql`${tickets.date} = ${today}`,
        ),
        orderBy: (tickets, { asc }) => [asc(tickets.createdAt)],
      });

      if (waitingTickets.length >= 2) {
        // Fetch all services in the area to check which are priority
        const areaServices = await tx.query.services.findMany({
          where: eq(services.areaId, areaId),
        });
        const priorityServiceIds = new Set(
          areaServices.filter((s) => s.isPriority).map((s) => s.id)
        );

        const priorityWaitingTickets = waitingTickets.filter((t) => priorityServiceIds.has(t.serviceId));
        const P = priorityWaitingTickets.length;

        const idx = 2 * P;
        if (idx < waitingTickets.length - 1) {
          const t1 = new Date(waitingTickets[idx].createdAt).getTime();
          const t2 = new Date(waitingTickets[idx + 1].createdAt).getTime();
          createdAtValue = new Date(Math.floor((t1 + t2) / 2));
        }
      }
    }

    // Create ticket
    await tx.insert(tickets).values({
      number: formattedNumber,
      sequenceNumber: newNumber,
      serviceId,
      areaId,
      status: 'waiting',
      date: new Date(today),
      createdAt: createdAtValue,
    });

    const ticket = await tx.query.tickets.findFirst({
      where: and(eq(tickets.number, formattedNumber), sql`${tickets.date} = ${today}`),
      orderBy: (tickets, { desc }) => [desc(tickets.id)],
    });

    logger.info('Ticket emitted', { module: 'ticket', ticketId: ticket!.id, number: formattedNumber, isPriority: service.isPriority });
    return ticket!;
  });
}

// Call next ticket for an area — oldest waiting ticket (filtered by station services)
export async function callNext(areaId: number, stationId: number) {
  const today = getToday();

  return await db.transaction(async (tx) => {
    // Validate station has no active ticket (called or in_service)
    const activeCalled = await tx.query.tickets.findFirst({
      where: and(
        eq(tickets.areaId, areaId),
        eq(tickets.stationId, stationId),
        sql`${tickets.date} = ${today}`,
        sql`${tickets.status} IN ('called', 'in_service')`,
      ),
    });

    if (activeCalled) {
      throw new ValidationError('Estação já possui uma senha activa. Conclua ou descarte a actual antes de chamar a próxima.');
    }

    // Get assigned services for this station
    const assignedServices = await tx.query.stationServices.findMany({
      where: eq(stationServices.stationId, stationId),
    });
    const serviceIds = assignedServices.map((s) => s.serviceId);

    if (serviceIds.length === 0) {
      throw new ValidationError('Esta estação não possui nenhum serviço atribuído.');
    }

    // Find oldest waiting ticket
    const nextTicket = await tx.query.tickets.findFirst({
      where: and(
        eq(tickets.areaId, areaId),
        eq(tickets.status, 'waiting'),
        sql`${tickets.date} = ${today}`,
        inArray(tickets.serviceId, serviceIds),
      ),
      orderBy: (tickets, { asc }) => [asc(tickets.createdAt)],
    });

    if (!nextTicket) {
      throw new NotFoundError('Não há senhas em espera para esta estação.');
    }

    // Update to called and increment callCount
    await tx.update(tickets)
      .set({
        status: 'called',
        stationId,
        calledAt: new Date(),
        callCount: sql`${tickets.callCount} + 1`,
      })
      .where(eq(tickets.id, nextTicket.id));

    // Get station name
    const station = await tx.query.stations.findFirst({
      where: eq(stations.id, stationId),
    });

    const updated = await tx.query.tickets.findFirst({
      where: eq(tickets.id, nextTicket.id),
    });

    logger.info('Ticket called', { module: 'ticket', ticketId: updated!.id, stationId });

    return {
      ticket: updated!,
      stationName: station?.description || station?.name || `Station ${stationId}`,
    };
  });
}

// Start service — called → in_service
export async function startService(ticketId: number) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  if (!ticket) {
    throw new NotFoundError(`Ticket ${ticketId} not found`);
  }

  if (ticket.status !== 'called') {
    throw new ValidationError(`Ticket status is ${ticket.status}, expected 'called'`);
  }

  await db.update(tickets)
    .set({ status: 'in_service', startedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  logger.info('Ticket started', { module: 'ticket', ticketId });

  return db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
}

// Complete service — in_service → completed
export async function completeService(ticketId: number) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  if (!ticket) {
    throw new NotFoundError(`Ticket ${ticketId} not found`);
  }

  if (ticket.status !== 'in_service') {
    throw new ValidationError(`Ticket status is ${ticket.status}, expected 'in_service'`);
  }

  await db.update(tickets)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  logger.info('Ticket completed', { module: 'ticket', ticketId });

  return db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
}

// Cancel ticket — waiting → cancelled
export async function cancelTicket(ticketId: number) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  if (!ticket) {
    throw new NotFoundError(`Ticket ${ticketId} not found`);
  }

  if (ticket.status !== 'waiting') {
    throw new ValidationError(`Ticket status is ${ticket.status}, expected 'waiting'`);
  }

  await db.update(tickets)
    .set({ status: 'cancelled' })
    .where(eq(tickets.id, ticketId));

  logger.info('Ticket cancelled', { module: 'ticket', ticketId });

  return ticket;
}

// Mark no-show — called/no_show → no_show (called not answered)
export async function markNoShow(ticketId: number) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  if (!ticket) {
    throw new NotFoundError(`Ticket ${ticketId} not found`);
  }

  if (!['called', 'no_show'].includes(ticket.status)) {
    throw new ValidationError(`Ticket status is ${ticket.status}, expected 'called' or 'no_show'`);
  }

  if (ticket.callCount >= 2 && ticket.status === 'no_show') {
    throw new ValidationError('Esta senha já foi descartada');
  }

  await db.update(tickets)
    .set({ status: 'no_show' })
    .where(eq(tickets.id, ticketId));

  logger.info('Ticket marked no-show', { module: 'ticket', ticketId });

  return ticket;
}

// Recall ticket — called → called (increment callCount, max 2)
export async function recallTicket(ticketId: number) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  if (!ticket) {
    throw new NotFoundError(`Ticket ${ticketId} not found`);
  }

  if (ticket.status !== 'called') {
    throw new ValidationError(`Ticket status is ${ticket.status}, expected 'called'`);
  }

  if (ticket.callCount >= 2) {
    throw new ValidationError('Limite de chamadas atingido (2). Descartar ou iniciar atendimento.');
  }

  await db.update(tickets)
    .set({ callCount: sql`${tickets.callCount} + 1` })
    .where(eq(tickets.id, ticketId));

  const updated = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  logger.info('Ticket recalled', { module: 'ticket', ticketId, callCount: updated!.callCount });

  return updated!;
}

// List tickets by area, status, date (optionally filtered by station's assigned services)
export async function listTickets(
  areaId?: number,
  status?: TicketStatus,
  date?: string,
  stationId?: number,
): Promise<TicketWithServiceName[]> {
  const conditions = [];
  if (areaId) conditions.push(eq(tickets.areaId, areaId));
  if (status) conditions.push(eq(tickets.status, status));
  if (date) conditions.push(sql`${tickets.date} = ${date}`);

  if (stationId) {
    const assignedServices = await db.query.stationServices.findMany({
      where: eq(stationServices.stationId, stationId),
    });
    const serviceIds = assignedServices.map((s) => s.serviceId);
    if (serviceIds.length > 0) {
      conditions.push(inArray(tickets.serviceId, serviceIds));
    } else {
      conditions.push(sql`1 = 0`); // Return nothing if no services assigned
    }
  }

  const rows = await db.query.tickets.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: (tickets, { asc }) => [asc(tickets.createdAt)],
  });

  if (!rows.length) return rows as TicketWithServiceName[];

  const serviceIds = Array.from(new Set(rows.map((r) => r.serviceId)));
  const related = await db.query.services.findMany({
    where: inArray(services.id, serviceIds),
  });
  const serviceMap = new Map(related.map((s) => [s.id, s.name]));

  const stationIds = Array.from(new Set(rows.map((r) => r.stationId).filter((id): id is number => id !== null)));
  let stationMap = new Map<number, string>();
  if (stationIds.length > 0) {
    const relatedStations = await db.query.stations.findMany({
      where: inArray(stations.id, stationIds),
    });
    stationMap = new Map(relatedStations.map((s) => [s.id, s.description || s.name]));
  }

  return rows.map((t) => ({
    ...t,
    serviceName: serviceMap.get(t.serviceId) || '',
    stationName: t.stationId ? stationMap.get(t.stationId) || '' : '',
  })) as TicketWithServiceName[];
}

// Get current in-service ticket for an area
export async function getCurrentInService(areaId: number, date?: string) {
  const targetDate = date || getToday();
  const conditions = [
    eq(tickets.status, 'in_service'),
    sql`${tickets.date} = ${targetDate}`,
  ];
  if (areaId && areaId !== 0) conditions.push(eq(tickets.areaId, areaId));

  return db.query.tickets.findFirst({
    where: and(...conditions),
  });
}

// Get recent called tickets for an area (last 5)
export async function getRecentCalled(areaId: number, date?: string, limit = 5) {
  const targetDate = date || getToday();
  const conditions = [
    eq(tickets.status, 'called'),
    sql`${tickets.date} = ${targetDate}`,
  ];
  if (areaId && areaId !== 0) conditions.push(eq(tickets.areaId, areaId));

  return db.query.tickets.findMany({
    where: and(...conditions),
    orderBy: (tickets, { desc }) => [desc(tickets.calledAt)],
    limit,
  });
}

// Get waiting count for an area (optionally filtered by station services)
export async function getWaitingCount(areaId: number, date?: string, stationId?: number) {
  const targetDate = date || getToday();
  const conditions = [
    eq(tickets.status, 'waiting'),
    sql`${tickets.date} = ${targetDate}`,
  ];
  if (areaId && areaId !== 0) conditions.push(eq(tickets.areaId, areaId));

  if (stationId) {
    const assignedServices = await db.query.stationServices.findMany({
      where: eq(stationServices.stationId, stationId),
    });
    const serviceIds = assignedServices.map((s) => s.serviceId);
    if (serviceIds.length > 0) {
      conditions.push(inArray(tickets.serviceId, serviceIds));
    } else {
      conditions.push(sql`1 = 0`);
    }
  }

  const result = await db.query.tickets.findMany({
    where: and(...conditions),
  });
  return result.length;
}

// Get active ticket for a station (called or in_service)
export async function getActiveTicketForStation(areaId: number, stationId: number) {
  const today = getToday();
  return db.query.tickets.findFirst({
    where: and(
      eq(tickets.areaId, areaId),
      eq(tickets.stationId, stationId),
      sql`${tickets.status} IN ('called', 'in_service')`,
      sql`${tickets.date} = ${today}`,
    ),
    orderBy: (tickets, { desc }) => [desc(tickets.calledAt)],
  });
}
