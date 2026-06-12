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
  const ad = await getAdById(id);

  // If we are replacing an existing local file with a new one or clearing it
  if (
    updates.contentUrl !== undefined &&
    updates.contentUrl !== ad.contentUrl &&
    ad.contentUrl &&
    ad.contentUrl.startsWith('/uploads/')
  ) {
    import('fs').then(({ unlink }) => {
      import('path').then(({ join, dirname }) => {
        import('url').then(({ fileURLToPath }) => {
          try {
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const filename = ad.contentUrl!.replace('/uploads/', '');
            const filePath = join(__dirname, '..', '..', 'uploads', filename);
            unlink(filePath, (err) => {
              if (err && err.code !== 'ENOENT') {
                logger.error('Failed to delete old ad file', { error: err.message, file: filePath });
              } else if (!err) {
                logger.info('Deleted old ad file', { file: filePath });
              }
            });
          } catch (err) {
            logger.error('Error in old ad file deletion process', { error: err });
          }
        });
      });
    });
  }

  await db.update(advertisements).set(updates).where(eq(advertisements.id, id));
  logger.info('Ad updated', { module: 'ad', adId: id });
  return getAdById(id);
}

export async function deleteAd(id: number) {
  const ad = await getAdById(id);
  
  // If the ad has a local upload, delete the file
  if (ad.contentUrl && ad.contentUrl.startsWith('/uploads/')) {
    import('fs').then(({ unlink }) => {
      import('path').then(({ join, dirname }) => {
        import('url').then(({ fileURLToPath }) => {
          try {
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const filename = ad.contentUrl!.replace('/uploads/', '');
            const filePath = join(__dirname, '..', '..', 'uploads', filename);
            unlink(filePath, (err) => {
              if (err && err.code !== 'ENOENT') {
                logger.error('Failed to delete ad file', { error: err.message, file: filePath });
              } else if (!err) {
                logger.info('Deleted ad file', { file: filePath });
              }
            });
          } catch (err) {
            logger.error('Error in ad file deletion process', { error: err });
          }
        });
      });
    });
  }

  await db.delete(advertisements).where(eq(advertisements.id, id));
  logger.info('Ad deleted', { module: 'ad', adId: id });
}
