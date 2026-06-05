// Indicator service — aggregate queries for KPIs

import { eq, and, sql, count, gte, lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';

export interface DailyIndicators {
  date: string;
  issued: number;
  served: number;
  cancelled: number;
  noShow: number;
  avgWaitMin: number;
  avgServiceMin: number;
}

export interface ServiceIndicators {
  serviceId: number;
  serviceName: string;
  issued: number;
  served: number;
  avgWaitMin: number;
  avgServiceMin: number;
}

// Get today's indicators for an area (or all areas)
export async function getTodayIndicators(areaId?: number) {
  const today = new Date().toISOString().split('T')[0];

  const conditions = [sql`${tickets.date} = ${today}`];
  if (areaId) conditions.push(eq(tickets.areaId, areaId));

  const [issuedResult, servedResult, cancelledResult, noShowResult] = await Promise.all([
    db.select({ count: count() }).from(tickets).where(and(...conditions)),
    db.select({ count: count() }).from(tickets).where(and(...conditions, eq(tickets.status, 'completed'))),
    db.select({ count: count() }).from(tickets).where(and(...conditions, eq(tickets.status, 'cancelled'))),
    db.select({ count: count() }).from(tickets).where(and(...conditions, eq(tickets.status, 'no_show'))),
  ]);

  // Average wait time (createdAt → calledAt)
  const waitResult = await db.select({
    avgWait: sql<number>`AVG(TIMESTAMPDIFF(MINUTE, ${tickets.createdAt}, ${tickets.calledAt}))`,
  })
    .from(tickets)
    .where(and(...conditions, sql`${tickets.calledAt} IS NOT NULL`));

  // Average service time (startedAt → completedAt)
  const serviceResult = await db.select({
    avgService: sql<number>`AVG(TIMESTAMPDIFF(MINUTE, ${tickets.startedAt}, ${tickets.completedAt}))`,
  })
    .from(tickets)
    .where(and(...conditions, eq(tickets.status, 'completed'), sql`${tickets.startedAt} IS NOT NULL`, sql`${tickets.completedAt} IS NOT NULL`));

  return {
    date: today,
    issued: issuedResult[0]?.count || 0,
    served: servedResult[0]?.count || 0,
    cancelled: cancelledResult[0]?.count || 0,
    noShow: noShowResult[0]?.count || 0,
    avgWaitMin: Math.round((waitResult[0]?.avgWait || 0) * 10) / 10,
    avgServiceMin: Math.round((serviceResult[0]?.avgService || 0) * 10) / 10,
  };
}

// Get indicators by service for today
export async function getTodayIndicatorsByService(areaId?: number) {
  const today = new Date().toISOString().split('T')[0];

  const conditions = [sql`${tickets.date} = ${today}`];
  if (areaId) conditions.push(eq(tickets.areaId, areaId));

  const allServices = await db.query.services.findMany();

  const results: ServiceIndicators[] = [];

  for (const service of allServices) {
    const serviceConditions = [...conditions, eq(tickets.serviceId, service.id)];

    const [issuedResult, servedResult] = await Promise.all([
      db.select({ count: count() }).from(tickets).where(and(...serviceConditions)),
      db.select({ count: count() }).from(tickets).where(and(...serviceConditions, eq(tickets.status, 'completed'))),
    ]);

    const waitResult = await db.select({
      avgWait: sql<number>`AVG(TIMESTAMPDIFF(MINUTE, ${tickets.createdAt}, ${tickets.calledAt}))`,
    })
      .from(tickets)
      .where(and(...serviceConditions, sql`${tickets.calledAt} IS NOT NULL`));

    const serviceTimeResult = await db.select({
      avgService: sql<number>`AVG(TIMESTAMPDIFF(MINUTE, ${tickets.startedAt}, ${tickets.completedAt}))`,
    })
      .from(tickets)
      .where(and(...serviceConditions, eq(tickets.status, 'completed'), sql`${tickets.startedAt} IS NOT NULL`, sql`${tickets.completedAt} IS NOT NULL`));

    results.push({
      serviceId: service.id,
      serviceName: service.name,
      issued: issuedResult[0]?.count || 0,
      served: servedResult[0]?.count || 0,
      avgWaitMin: Math.round((waitResult[0]?.avgWait || 0) * 10) / 10,
      avgServiceMin: Math.round((serviceTimeResult[0]?.avgService || 0) * 10) / 10,
    });
  }

  return results.filter(r => r.issued > 0);
}

// Get indicators for a date range
export async function getIndicatorsForDateRange(
  startDate: string,
  endDate: string,
  areaId?: number,
) {
  const conditions = [
    gte(tickets.date, new Date(startDate)),
    lte(tickets.date, new Date(endDate)),
  ];
  if (areaId) conditions.push(eq(tickets.areaId, areaId));

  const [issuedResult, servedResult] = await Promise.all([
    db.select({ count: count() }).from(tickets).where(and(...conditions)),
    db.select({ count: count() }).from(tickets).where(and(...conditions, eq(tickets.status, 'completed'))),
  ]);

  const waitResult = await db.select({
    avgWait: sql<number>`AVG(TIMESTAMPDIFF(MINUTE, ${tickets.createdAt}, ${tickets.calledAt}))`,
  })
    .from(tickets)
    .where(and(...conditions, sql`${tickets.calledAt} IS NOT NULL`));

  const serviceResult = await db.select({
    avgService: sql<number>`AVG(TIMESTAMPDIFF(MINUTE, ${tickets.startedAt}, ${tickets.completedAt}))`,
  })
    .from(tickets)
    .where(and(...conditions, eq(tickets.status, 'completed'), sql`${tickets.startedAt} IS NOT NULL`, sql`${tickets.completedAt} IS NOT NULL`));

  return {
    startDate,
    endDate,
    issued: issuedResult[0]?.count || 0,
    served: servedResult[0]?.count || 0,
    avgWaitMin: Math.round((waitResult[0]?.avgWait || 0) * 10) / 10,
    avgServiceMin: Math.round((serviceResult[0]?.avgService || 0) * 10) / 10,
  };
}

// Get daily breakdown for a date range
export async function getDailyBreakdown(
  startDate: string,
  endDate: string,
  areaId?: number,
) {
  const conditions = [
    gte(tickets.date, new Date(startDate)),
    lte(tickets.date, new Date(endDate)),
  ];
  if (areaId) conditions.push(eq(tickets.areaId, areaId));

  const result = await db.select({
    date: sql<string>`DATE(${tickets.date})`,
    issued: count(),
    served: sql<number>`SUM(CASE WHEN ${tickets.status} = 'completed' THEN 1 ELSE 0 END)`,
    cancelled: sql<number>`SUM(CASE WHEN ${tickets.status} = 'cancelled' THEN 1 ELSE 0 END)`,
    noShow: sql<number>`SUM(CASE WHEN ${tickets.status} = 'no_show' THEN 1 ELSE 0 END)`,
    avgWaitMin: sql<number>`AVG(CASE WHEN ${tickets.calledAt} IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, ${tickets.createdAt}, ${tickets.calledAt}) END)`,
    avgServiceMin: sql<number>`AVG(CASE WHEN ${tickets.status} = 'completed' AND ${tickets.startedAt} IS NOT NULL AND ${tickets.completedAt} IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, ${tickets.startedAt}, ${tickets.completedAt}) END)`,
  })
    .from(tickets)
    .where(and(...conditions))
    .groupBy(sql`DATE(${tickets.date})`)
    .orderBy(sql`DATE(${tickets.date})`);

  return result.map(row => ({
    date: row.date,
    issued: row.issued || 0,
    served: row.served || 0,
    cancelled: row.cancelled || 0,
    noShow: row.noShow || 0,
    avgWaitMin: Math.round((row.avgWaitMin || 0) * 10) / 10,
    avgServiceMin: Math.round((row.avgServiceMin || 0) * 10) / 10,
  }));
}
