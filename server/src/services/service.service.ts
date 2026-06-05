// Service service — CRUD + ticket format config + priority support

import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { services } from '../db/schema.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { TicketFormat } from '../types/index.js';

export async function createService(
  name: string,
  areaId: number,
  ticketFormat: TicketFormat,
  ticketPrefix?: string,
  ticketDigitCount = 3,
  isPriority = false,
) {
  const existing = await db.query.services.findFirst({
    where: eq(services.name, name),
  });

  if (existing) {
    throw new ConflictError(`Service '${name}' already exists`);
  }

  if ((ticketFormat === 'alphanumeric' || ticketFormat === 'custom') && !ticketPrefix) {
    throw new ValidationError('Prefix required for alphanumeric/custom format');
  }

  await db.insert(services).values({
    name,
    areaId,
    ticketFormat,
    ticketPrefix: ticketPrefix || undefined,
    ticketDigitCount,
    isPriority,
  });

  const created = await db.query.services.findFirst({
    where: eq(services.name, name),
  });

  logger.info('Service created', { module: 'service', serviceId: created!.id });
  return created!;
}

export async function listServices(areaId?: number) {
  const conditions = areaId ? eq(services.areaId, areaId) : undefined;
  return db.query.services.findMany({
    where: conditions,
    orderBy: (services, { asc }) => [asc(services.name)],
  });
}

export async function getServiceById(id: number) {
  const service = await db.query.services.findFirst({
    where: eq(services.id, id),
  });

  if (!service) {
    throw new NotFoundError(`Service with id ${id} not found`);
  }

  return service;
}

export async function updateService(
  id: number,
  updates: {
    name?: string;
    ticketFormat?: TicketFormat;
    ticketPrefix?: string;
    ticketDigitCount?: number;
    active?: boolean;
    isPriority?: boolean;
  },
) {
  await getServiceById(id);

  if (updates.name) {
    const duplicate = await db.query.services.findFirst({
      where: eq(services.name, updates.name),
    });
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError(`Service '${updates.name}' already exists`);
    }
  }

  if ((updates.ticketFormat === 'alphanumeric' || updates.ticketFormat === 'custom') && !updates.ticketPrefix) {
    throw new ValidationError('Prefix required for alphanumeric/custom format');
  }

  await db.update(services).set(updates).where(eq(services.id, id));

  logger.info('Service updated', { module: 'service', serviceId: id });
  return getServiceById(id);
}

export async function deleteService(id: number) {
  await getServiceById(id);
  await db.delete(services).where(eq(services.id, id));
  logger.info('Service deleted', { module: 'service', serviceId: id });
}