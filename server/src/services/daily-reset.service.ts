// Daily reset service — resets ticket sequences at midnight
// Also provides on-demand reset if server was down at 00:00
// Marks unattended tickets (waiting/called) from previous day as expired (no_show)

import cron from 'node-cron';
import { db } from '../db/connection.js';
import { dailySequences, tickets } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { getToday, getYesterday } from '../utils/date.js';
import { logger } from '../utils/logger.js';

let cronJob: cron.ScheduledTask | null = null;

export function startDailyResetCron() {
  if (cronJob) return; // Already running

  // Run at 00:00 every day
  cronJob = cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily reset cron', { module: 'daily-reset' });
    await expirePreviousDayTickets();
    await resetAllSequences();
  }, {
    timezone: 'Africa/Luanda', // Angola timezone
  });

  logger.info('Daily reset cron started', { module: 'daily-reset' });
}

export function stopDailyResetCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info('Daily reset cron stopped', { module: 'daily-reset' });
  }
}

// Mark unattended tickets from yesterday as no_show with expiredAt timestamp
export async function expirePreviousDayTickets() {
  const yesterday = getYesterday();

  const result = await db.update(tickets)
    .set({
      status: 'no_show',
      expiredAt: new Date(),
    })
    .where(
      and(
        sql`${tickets.date} = ${yesterday}`,
        sql`${tickets.status} IN ('waiting', 'called')`,
      ),
    );

  logger.info('Expired previous day tickets', {
    module: 'daily-reset',
    date: yesterday,
    affectedRows: (result as any).affectedRows ?? 0,
  });
}

export async function resetAllSequences() {
  const today = getToday();

  const allServices = await db.query.services.findMany();

  for (const service of allServices) {
    const existing = await db.query.dailySequences.findFirst({
      where: eq(dailySequences.serviceId, service.id),
    });

    if (existing) {
      // Create new sequence for today if doesn't exist
      const todaySeq = await db.query.dailySequences.findFirst({
        where: eq(dailySequences.serviceId, service.id),
      });

      if (!todaySeq || todaySeq.date.toISOString().split('T')[0] !== today) {
        await db.insert(dailySequences).values({
          serviceId: service.id,
          date: new Date(today),
          lastNumber: 0,
        });
      }
    }
  }

  logger.info('Daily reset completed', { module: 'daily-reset', date: today });
}

// On-demand: ensure sequence exists for today (called on first ticket emission)
export async function ensureSequenceForToday(serviceId: number) {
  const today = getToday();

  const existing = await db.query.dailySequences.findFirst({
    where: eq(dailySequences.serviceId, serviceId),
  });

  if (!existing || existing.date.toISOString().split('T')[0] !== today) {
    await db.insert(dailySequences).values({
      serviceId,
      date: new Date(today),
      lastNumber: 0,
    }).catch(() => {
      // Ignore duplicate key errors
    });
  }
}

// Check if server was down at midnight and run reset if needed
export async function checkAndRunMissedReset() {
  const yesterday = getYesterday();

  // Check if there are any unattended tickets from yesterday
  const unattendedCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(tickets)
    .where(
      and(
        sql`${tickets.date} = ${yesterday}`,
        sql`${tickets.status} IN ('waiting', 'called')`,
      ),
    );

  if (unattendedCount[0]?.count > 0) {
    logger.info('Server was down at midnight — running missed reset', {
      module: 'daily-reset',
      unattendedTickets: unattendedCount[0].count,
    });
    await expirePreviousDayTickets();
    await resetAllSequences();
  }
}
