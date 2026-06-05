// Dispenser service — CRUD + create dispenser user

import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { dispenserConfigs, users } from '../db/schema.js';
import { hashPassword } from './auth.service.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export async function createDispenser(name: string, areaId: number, username: string, password: string) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (existingUser) {
    throw new ConflictError('O nome de utilizador já está em uso.');
  }

  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    username,
    passwordHash,
    role: 'dispenser',
    areaId,
    createdBy: 0,
  });

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  await db.insert(dispenserConfigs).values({
    name,
    areaId,
    userId: user!.id,
  });

  const created = await db.query.dispenserConfigs.findFirst({
    where: eq(dispenserConfigs.name, name),
  });

  logger.info('Dispenser created', { module: 'dispenser', dispenserId: created!.id, userId: user!.id });

  return created!;
}

export async function listDispensers() {
  return db.query.dispenserConfigs.findMany({
    orderBy: (dispenserConfigs, { asc }) => [asc(dispenserConfigs.name)],
  });
}

export async function getDispenserById(id: number) {
  const dispenser = await db.query.dispenserConfigs.findFirst({
    where: eq(dispenserConfigs.id, id),
  });

  if (!dispenser) {
    throw new NotFoundError(`Dispenser with id ${id} not found`);
  }

  return dispenser;
}

export async function updateDispenser(
  id: number,
  updates: { name?: string; areaId?: number; active?: boolean; password?: string },
) {
  const dispenser = await getDispenserById(id);
  const { password, ...directUpdates } = updates;

  if (Object.keys(directUpdates).length > 0) {
    await db.update(dispenserConfigs).set(directUpdates).where(eq(dispenserConfigs.id, id));
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
    await db.update(users).set(userUpdates).where(eq(users.id, dispenser.userId));
  }

  logger.info('Dispenser updated', { module: 'dispenser', dispenserId: id });
  return getDispenserById(id);
}

export async function deleteDispenser(id: number) {
  const dispenser = await getDispenserById(id);
  await db.delete(dispenserConfigs).where(eq(dispenserConfigs.id, id));
  await db.delete(users).where(eq(users.id, dispenser.userId));
  logger.info('Dispenser deleted', { module: 'dispenser', dispenserId: id });
}