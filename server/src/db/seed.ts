// Seed script — creates root user with default credentials

import 'dotenv/config';
import { db } from './connection.js';
import { users } from './schema.js';
import { hashPassword } from '../services/auth.service.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

async function seed() {
  logger.info('Running seed script...', { module: 'seed' });

  // Check if root user already exists
  const existingRoot = await db.query.users.findFirst({
    where: eq(users.username, 'root'),
  });

  if (existingRoot) {
    logger.info('Root user already exists — skipping seed', { module: 'seed' });
    return;
  }

  // Create root user: username=root, password=root@123
  const passwordHash = await hashPassword('root@123');

  await db.insert(users).values({
    username: 'root',
    passwordHash,
    role: 'root',
    createdBy: 0, // System-created — no creator
  });

  // MySQL doesn't support RETURNING — query the user after insert
  const newRoot = await db.query.users.findFirst({
    where: eq(users.username, 'root'),
  });

  logger.info('Root user created successfully', { module: 'seed', userId: newRoot!.id });
  logger.warn('⚠️  Default root credentials: username=root, password=root@123 — CHANGE IMMEDIATELY after first login!', { module: 'seed' });
}

seed()
  .then(() => {
    logger.info('Seed completed', { module: 'seed' });
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Seed failed', { module: 'seed', error: error?.message || String(error), stack: error?.stack });
    process.exit(1);
  });