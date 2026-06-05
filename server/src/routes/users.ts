// User routes — CRUD + password change with role-based access

import { Router } from 'express';
import { z } from 'zod';
import * as userService from '../services/user.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError, ForbiddenError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { UserRole } from '../types/index.js';

const router = Router();

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['root', 'admin', 'reception', 'management', 'display', 'dispenser']),
  areaId: z.number().int().nullable().optional(),
  stationId: z.number().int().nullable().optional(),
});

const updateUserSchema = z.object({
  username: z.string().min(3).optional(),
  role: z.enum(['root', 'admin', 'reception', 'management', 'display', 'dispenser']).optional(),
  areaId: z.number().int().nullable().optional(),
  stationId: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// All user routes require authentication
router.use(authMiddleware);

// GET /api/users — list users (root, admin only)
router.get('/', requireRole('root', 'admin'), async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const result = await userService.listUsers(includeInactive);
    res.json(result);
  } catch (error) {
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    logger.error('List users error', { module: 'users', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users — create user (root, admin only)
router.post('/', requireRole('root', 'admin'), async (req, res) => {
  try {
    const data = createUserSchema.parse(req.body);
    const creatorRole = req.auth!.role as UserRole;
    const targetRole = data.role as UserRole;

    // Validate that creator can create this role
    if (!userService.canCreateRole(creatorRole, targetRole)) {
      throw new ForbiddenError(`Your role '${creatorRole}' cannot create users with role '${targetRole}'`);
    }

    const result = await userService.createUser(
      data.username,
      data.password,
      targetRole,
      data.areaId ?? null,
      data.stationId ?? null,
      req.auth!.userId,
    );

    // Return user without password hash
    res.status(201).json({
      id: result.id,
      username: result.username,
      role: result.role,
      areaId: result.areaId,
      stationId: result.stationId,
      active: result.active,
      createdBy: result.createdBy,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    logger.error('Create user error', { module: 'users', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id — update user
router.patch('/:id', requireRole('root', 'admin'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const data = updateUserSchema.parse(req.body);

    const result = await userService.updateUser(id, {
      username: data.username,
      role: data.role,
      areaId: data.areaId,
      stationId: data.stationId,
      active: data.active,
    });

    res.json({
      id: result.id,
      username: result.username,
      role: result.role,
      areaId: result.areaId,
      stationId: result.stationId,
      active: result.active,
      createdBy: result.createdBy,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    logger.error('Update user error', { module: 'users', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id — delete user
router.delete('/:id', requireRole('root', 'admin'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await userService.deleteUser(id);
    res.json({ message: `User ${id} deleted successfully` });
  } catch (error) {
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    logger.error('Delete user error', { module: 'users', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id/password — change password (self or root/admin)
router.patch('/:id/password', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { newPassword } = changePasswordSchema.parse(req.body);
    const authUserId = req.auth!.userId;
    const authRole = req.auth!.role as UserRole;

    // Only the user themselves, root, or admin can change password
    if (authUserId !== id && !['root', 'admin'].includes(authRole)) {
      throw new ForbiddenError('You can only change your own password');
    }

    await userService.changePassword(id, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    logger.error('Change password error', { module: 'users', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;