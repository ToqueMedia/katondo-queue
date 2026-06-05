// Advertisement service — CRUD + scheduling

import { eq, or, and, isNull } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { advertisements } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export async function createAd(
  title: string,
  contentType: 'image' | 'video' | 'text' | 'html',
  areaId: number | null,
  contentUrl?: string,
  contentText?: string,
  durationSeconds = 10,
  sortOrder = 0,
) {
  await db.insert(advertisements).values({
    title,
    contentType,
    contentUrl: contentUrl || undefined,
    contentText: contentText || undefined,
    areaId: areaId || undefined,
    durationSeconds,
    sortOrder,
  });

  const created = await db.query.advertisements.findFirst({
    where: eq(advertisements.title, title),
    orderBy: (advertisements, { desc }) => [desc(advertisements.id)],
  });

  logger.info('Ad created', { module: 'ad', adId: created!.id });
  return created!;
}

export async function listAds(areaId?: number) {
  if (areaId) {
    return db.query.advertisements.findMany({
      where: or(
        eq(advertisements.areaId, areaId),
        isNull(advertisements.areaId),
      ),
      orderBy: (advertisements, { asc }) => [asc(advertisements.sortOrder)],
    });
  }
  return db.query.advertisements.findMany({
    orderBy: (advertisements, { asc }) => [asc(advertisements.sortOrder)],
  });
}

export async function getAdsForArea(areaId: number) {
  const conditions = [eq(advertisements.active, true)];
  if (areaId && areaId !== 0) {
    const orCond = or(eq(advertisements.areaId, areaId), isNull(advertisements.areaId));
    if (orCond) conditions.push(orCond);
  }
  return db.query.advertisements.findMany({
    where: and(...conditions),
    orderBy: (advertisements, { asc }) => [asc(advertisements.sortOrder)],
  });
}

export async function getAdById(id: number) {
  const ad = await db.query.advertisements.findFirst({
    where: eq(advertisements.id, id),
  });

  if (!ad) {
    throw new NotFoundError(`Ad with id ${id} not found`);
  }

  return ad;
}

export async function updateAd(
  id: number,
  updates: {
    title?: string;
    contentType?: 'image' | 'video' | 'text' | 'html';
    contentUrl?: string | null;
    contentText?: string | null;
    areaId?: number | null;
    active?: boolean;
    durationSeconds?: number;
    sortOrder?: number;
  },
) {
  await getAdById(id);
  await db.update(advertisements).set(updates).where(eq(advertisements.id, id));
  logger.info('Ad updated', { module: 'ad', adId: id });
  return getAdById(id);
}

export async function deleteAd(id: number) {
  await getAdById(id);
  await db.delete(advertisements).where(eq(advertisements.id, id));
  logger.info('Ad deleted', { module: 'ad', adId: id });
}
