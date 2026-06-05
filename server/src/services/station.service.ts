// Station service — CRUD + receptionist assignment (1:1) + station service association

import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { stations, services, stationServices } from '../db/schema.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export async function createStation(name: string, areaId: number, receptionUserId?: number, description?: string) {
  if (receptionUserId) {
    const assigned = await db.query.stations.findFirst({
      where: eq(stations.receptionUserId, receptionUserId),
    });
    if (assigned) {
      throw new ConflictError(`Receptionist already assigned to station ${assigned.id}`);
    }
  }

  await db.insert(stations).values({ name, description, areaId, receptionUserId: receptionUserId || undefined });

  const created = await db.query.stations.findFirst({
    where: eq(stations.name, name),
  });

  if (!created) {
    throw new Error('Failed to create station');
  }

  // Inherit all services of the area by default
  const areaServices = await db.query.services.findMany({
    where: eq(services.areaId, areaId),
  });

  if (areaServices.length > 0) {
    await db.insert(stationServices).values(
      areaServices.map((s) => ({
        stationId: created.id,
        serviceId: s.id,
      }))
    );
  }

  logger.info('Station created with default services', { module: 'station', stationId: created.id });
  return getStationById(created.id);
}

export async function listStations(areaId?: number) {
  const conditions = areaId ? eq(stations.areaId, areaId) : undefined;
  const stationsList = await db.query.stations.findMany({
    where: conditions,
    orderBy: (stations, { asc }) => [asc(stations.name)],
  });

  const result = [];
  for (const station of stationsList) {
    const associated = await db.query.stationServices.findMany({
      where: eq(stationServices.stationId, station.id),
    });
    result.push({
      ...station,
      serviceIds: associated.map((s) => s.serviceId),
    });
  }
  return result;
}

export async function getStationById(id: number) {
  const station = await db.query.stations.findFirst({
    where: eq(stations.id, id),
  });

  if (!station) {
    throw new NotFoundError(`Station with id ${id} not found`);
  }

  const associated = await db.query.stationServices.findMany({
    where: eq(stationServices.stationId, id),
  });

  return {
    ...station,
    serviceIds: associated.map((s) => s.serviceId),
  };
}

export async function updateStation(
  id: number,
  updates: { name?: string; description?: string | null; receptionUserId?: number | null; serviceIds?: number[] },
) {
  await getStationById(id);

  if (updates.receptionUserId !== undefined && updates.receptionUserId !== null) {
    const assigned = await db.query.stations.findFirst({
      where: eq(stations.receptionUserId, updates.receptionUserId),
    });
    if (assigned && assigned.id !== id) {
      throw new ConflictError(`Receptionist already assigned to station ${assigned.id}`);
    }
  }

  const { serviceIds, ...directUpdates } = updates;

  if (Object.keys(directUpdates).length > 0) {
    await db.update(stations).set(directUpdates).where(eq(stations.id, id));
  }

  if (serviceIds !== undefined) {
    await db.delete(stationServices).where(eq(stationServices.stationId, id));
    if (serviceIds.length > 0) {
      await db.insert(stationServices).values(
        serviceIds.map((srvId) => ({
          stationId: id,
          serviceId: srvId,
        }))
      );
    }
  }

  logger.info('Station updated', { module: 'station', stationId: id });
  return getStationById(id);
}

export async function deleteStation(id: number) {
  await getStationById(id);
  await db.delete(stationServices).where(eq(stationServices.stationId, id));
  await db.delete(stations).where(eq(stations.id, id));
  logger.info('Station deleted', { module: 'station', stationId: id });
}