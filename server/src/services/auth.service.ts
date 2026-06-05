// Auth service — login, JWT generation, bcrypt hashing

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { env } from '../config/env.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { AuthResponse, UserRole, JwtPayload } from '../types/index.js';
import type { StringValue } from 'ms';

const SALT_ROUNDS = 12;

export async function login(username: string, password: string): Promise<AuthResponse> {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user || !user.active) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const payload: JwtPayload = {
    userId: user.id,
    role: user.role as UserRole,
    areaId: user.areaId ?? null,
    stationId: user.stationId ?? null,
  };

  // Display and dispenser devices stay open 24h — JWT must not expire quickly (set to 10 years).
  // Other roles (reception, admin, root) get short-lived tokens with refresh.
  const tokenExpiry = (user.role === 'display' || user.role === 'dispenser')
    ? '3650d' as StringValue                    // 10 years — long-lived/never-expire for always-on devices
    : env.jwtExpiresIn as StringValue;          // 15m — short-lived for interactive users

  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: tokenExpiry });
  const refreshToken = jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtRefreshExpiresIn as StringValue });

  logger.info('User logged in', { module: 'auth', userId: user.id, role: user.role });

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role as UserRole,
      areaId: user.areaId ?? null,
      stationId: user.stationId ?? null,
    },
  };
}

export async function refreshToken(oldRefreshToken: string): Promise<{ token: string; refreshToken: string }> {
  try {
    const decoded = jwt.verify(oldRefreshToken, env.jwtSecret) as JwtPayload;

    // Verify user still exists and is active
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId),
    });

    if (!user || !user.active) {
      throw new UnauthorizedError('User no longer active');
    }

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role as UserRole,
      areaId: user.areaId ?? null,
      stationId: user.stationId ?? null,
    };

    // Display and dispenser devices stay open 24h — JWT must not expire quickly (set to 10 years).
    const tokenExpiry = (user.role === 'display' || user.role === 'dispenser')
      ? '3650d' as StringValue                  // 10 years — long-lived/never-expire for always-on devices
      : env.jwtExpiresIn as StringValue;          // 15m — short-lived for interactive users

    const token = jwt.sign(payload, env.jwtSecret, { expiresIn: tokenExpiry });
    const refreshToken = jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtRefreshExpiresIn as StringValue });

    return { token, refreshToken };
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function isDefaultRootPassword(passwordHash: string): Promise<boolean> {
  return bcrypt.compare('root@123', passwordHash);
}