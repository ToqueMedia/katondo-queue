// Display service — CRUD + create display user

import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { displayConfigs, users } from '../db/schema.js';
import { hashPassword } from './auth.service.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export async function createDisplay(name: string, areaId: number, username: string, password: string) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (existingUser) {
    throw new ConflictError('O nome de utilizador já está em uso.');
  }

  const passwordHash = await hashPassword(password);

  // Create display user
  await db.insert(users).values({
    username,
    passwordHash,
    role: 'display',
    areaId,
    createdBy: 0,
  });

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  await db.insert(displayConfigs).values({
    name,
    areaId,
    userId: user!.id,
  });

  const created = await db.query.displayConfigs.findFirst({
    where: eq(displayConfigs.name, name),
  });

  logger.info('Display created', { module: 'display', displayId: created!.id, userId: user!.id });

  return created!;
}

export async function listDisplays() {
  return db.query.displayConfigs.findMany({
    orderBy: (displayConfigs, { asc }) => [asc(displayConfigs.name)],
  });
}

export async function getDisplayById(id: number) {
  const display = await db.query.displayConfigs.findFirst({
    where: eq(displayConfigs.id, id),
  });

  if (!display) {
    throw new NotFoundError(`Display with id ${id} not found`);
  }

  return display;
}

export async function updateDisplay(
  id: number,
  updates: { name?: string; areaId?: number; active?: boolean; password?: string },
) {
  const display = await getDisplayById(id);
  const { password, ...directUpdates } = updates;

  if (Object.keys(directUpdates).length > 0) {
    await db.update(displayConfigs).set(directUpdates).where(eq(displayConfigs.id, id));
  }

  // Update associated user
  const userUpdates: any = {};
  if (updates.areaId !== undefined) {
    userUpdates.areaId = updates.areaId;
  }
  if (password) {
    userUpdates.passwordHash = await hashPassword(password);
  }
  if (Object.keys(userUpdates).length > 0) {
    await db.update(users).set(userUpdates).where(eq(users.id, display.userId));
  }

  logger.info('Display updated', { module: 'display', displayId: id });
  return getDisplayById(id);
}

export async function deleteDisplay(id: number) {
  const display = await getDisplayById(id);
  await db.delete(displayConfigs).where(eq(displayConfigs.id, id));
  await db.delete(users).where(eq(users.id, display.userId));
  logger.info('Display deleted', { module: 'display', displayId: id });
}