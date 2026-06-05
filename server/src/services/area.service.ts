// Area service — CRUD operations

import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { areas } from '../db/schema.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export async function createArea(name: string, description?: string) {
  const existing = await db.query.areas.findFirst({
    where: eq(areas.name, name),
  });

  if (existing) {
    throw new ConflictError(`Area '${name}' already exists`);
  }

  await db.insert(areas).values({ name, description: description || undefined });

  const created = await db.query.areas.findFirst({
    where: eq(areas.name, name),
  });

  logger.info('Area created', { module: 'area', areaId: created!.id });
  return created!;
}

export async function listAreas(includeInactive = false) {
  const conditions = includeInactive ? undefined : eq(areas.active, true);
  return db.query.areas.findMany({
    where: conditions,
    orderBy: (areas, { asc }) => [asc(areas.name)],
  });
}

export async function getAreaById(id: number) {
  const area = await db.query.areas.findFirst({
    where: eq(areas.id, id),
  });

  if (!area) {
    throw new NotFoundError(`Area with id ${id} not found`);
  }

  return area;
}

export async function updateArea(
  id: number,
  updates: { name?: string; description?: string; active?: boolean },
) {
  await getAreaById(id);

  if (updates.name) {
    const duplicate = await db.query.areas.findFirst({
      where: eq(areas.name, updates.name),
    });
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError(`Area '${updates.name}' already exists`);
    }
  }

  await db.update(areas).set(updates).where(eq(areas.id, id));

  logger.info('Area updated', { module: 'area', areaId: id });
  return getAreaById(id);
}

export async function deleteArea(id: number) {
  await getAreaById(id);
  await db.delete(areas).where(eq(areas.id, id));
  logger.info('Area deleted', { module: 'area', areaId: id });
}