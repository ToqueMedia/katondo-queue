// User service — CRUD operations, role validation, password management

import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { hashPassword } from './auth.service.js';
import { ConflictError, ForbiddenError, ValidationError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { UserRole } from '../types/index.js';

// Roles that admin can create
const ADMIN_CREATABLE_ROLES: UserRole[] = ['reception', 'management', 'display', 'dispenser'];

// Roles that require areaId
const AREA_REQUIRED_ROLES: UserRole[] = ['reception', 'display', 'dispenser'];

export async function createUser(
  username: string,
  password: string,
  role: UserRole,
  areaId: number | null,
  stationId: number | null,
  createdBy: number,
) {
  // Check if username already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (existing) {
    throw new ConflictError(`Username '${username}' already exists`);
  }

  // Validate role permissions — only root can create admin
  if (role === 'root') {
    throw new ForbiddenError('Cannot create root users');
  }

  if (role === 'admin') {
    // Only root can create admin users — caller must verify this before calling
    // This validation is done in the route level
  }

  // Validate areaId requirement
  if (AREA_REQUIRED_ROLES.includes(role) && areaId === null) {
    throw new ValidationError(`Area is required for '${role}' users`);
  }

  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    username,
    passwordHash,
    role,
    areaId: areaId ?? undefined,
    stationId: stationId ?? undefined,
    createdBy,
  });

  // MySQL doesn't support RETURNING — query after insert
  const created = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: {
      id: true, username: true, role: true, areaId: true, stationId: true,
      active: true, createdBy: true, createdAt: true, updatedAt: true,
      passwordHash: true,
    },
  });

  logger.info('User created', { module: 'user', userId: created!.id, role, createdBy });

  return created!;
}

export async function listUsers(includeInactive = false) {
  const conditions = includeInactive ? undefined : eq(users.active, true);
  return db.query.users.findMany({
    where: conditions,
    columns: {
      id: true,
      username: true,
      role: true,
      areaId: true,
      stationId: true,
      active: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: (users, { asc }) => [asc(users.id)],
  });
}

export async function getUserById(id: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      id: true,
      username: true,
      role: true,
      areaId: true,
      stationId: true,
      active: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError(`User with id ${id} not found`);
  }

  return user;
}

export async function updateUser(
  id: number,
  updates: {
    username?: string;
    role?: UserRole;
    areaId?: number | null;
    stationId?: number | null;
    active?: boolean;
  },
) {
  // Check user exists
  const existing = await getUserById(id);

  // Root user cannot be deactivated
  if (existing.role === 'root' && updates.active === false) {
    throw new ForbiddenError('Root user cannot be deactivated');
  }

  // Validate areaId if role changes
  if (updates.role && AREA_REQUIRED_ROLES.includes(updates.role) && updates.areaId === null && existing.areaId === null) {
    throw new ValidationError(`Area is required for '${updates.role}' users`);
  }

  // Check username uniqueness if changing
  if (updates.username && updates.username !== existing.username) {
    const duplicate = await db.query.users.findFirst({
      where: eq(users.username, updates.username),
    });
    if (duplicate) {
      throw new ConflictError(`Username '${updates.username}' already exists`);
    }
  }

  await db
    .update(users)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));

  // MySQL doesn't support RETURNING — query after update
  const updated = await getUserById(id);

  logger.info('User updated', { module: 'user', userId: id });

  return updated;
}

export async function deleteUser(id: number) {
  const existing = await getUserById(id);

  if (existing.role === 'root') {
    throw new ForbiddenError('Root user cannot be deleted');
  }

  await db.delete(users).where(eq(users.id, id));

  logger.info('User deleted', { module: 'user', userId: id });
}

export async function changePassword(userId: number, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  logger.info('Password changed', { module: 'user', userId });
}

export function canCreateRole(creatorRole: UserRole, targetRole: UserRole): boolean {
  if (creatorRole === 'root') return targetRole === 'admin';
  if (creatorRole === 'admin') return ADMIN_CREATABLE_ROLES.includes(targetRole);
  return false;
}

export { ADMIN_CREATABLE_ROLES, AREA_REQUIRED_ROLES };