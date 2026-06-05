// Settings service — global system configuration

import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { systemSettings } from '../db/schema.js';
import { logger } from '../utils/logger.js';

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string, description?: string): Promise<void> {
  const existing = await getSetting(key);
  if (existing !== null) {
    await db.update(systemSettings).set({ value }).where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({ key, value, description });
  }
  logger.info(`Setting updated: ${key}`, { module: 'settings' });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(systemSettings);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

// Server URL helper
export async function getServerUrl(): Promise<string> {
  const host = await getSetting('server_host') || 'localhost';
  const port = await getSetting('server_port') || '3001';
  return `http://${host}:${port}`;
}
