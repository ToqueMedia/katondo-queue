// User routes — CRUD + password change with role-based access

import { Router } from 'express';
import { z } from 'zod';
import { io } from '../index.js';
import * as userService from '../services/user.service.js';
import * as authService from '../services/auth.service.js';
import * as stationService from '../services/station.service.js';
import * as ticketService from '../services/ticket.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError, ConflictError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { UserRole } from '../types/index.js';

const router = Router();

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['root', 'admin', 'admin_manager', 'reception', 'management', 'display', 'dispenser']),
  areaId: z.number().int().nullable().optional(),
  stationId: z.number().int().nullable().optional(),
  name: z.string().nullable().optional(),
});

const updateUserSchema = z.object({
  username: z.string().min(3).optional(),
  role: z.enum(['root', 'admin', 'admin_manager', 'reception', 'management', 'display', 'dispenser']).optional(),
  areaId: z.number().int().nullable().optional(),
  stationId: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
  name: z.string().nullable().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// All user routes require authentication
router.use(authMiddleware);

// GET /api/users — list users (root, admin, admin_manager)
router.get('/', requireRole('root', 'admin', 'admin_manager'), async (req, res) => {
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

// POST /api/users — create user (root, admin, admin_manager)
router.post('/', requireRole('root', 'admin', 'admin_manager'), async (req, res) => {
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
      data.name?.trim() || undefined,
    );

    // Return user without password hash
    res.status(201).json({
      id: result.id,
      username: result.username,
      name: result.name,
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
// PATCH /api/users/active-station — let receptionist set their active area & station for the day
router.patch('/active-station', requireRole('reception'), async (req, res) => {
  try {
    const activeStationSchema = z.object({
      areaId: z.number().int().nullable(),
      stationId: z.number().int().nullable(),
    });
    const data = activeStationSchema.parse(req.body);

    const areaId = data.areaId && data.areaId > 0 ? data.areaId : null;
    const stationId = data.stationId && data.stationId > 0 ? data.stationId : null;

    const activeUserTicket = await ticketService.getActiveTicketForUser(req.auth!.userId);
    if (activeUserTicket) {
      throw new ConflictError('Conclua ou descarte a senha activa antes de trocar de posto.');
    }

    if ((areaId === null) !== (stationId === null)) {
      throw new ValidationError('Área e estação devem ser informadas em conjunto.');
    }

    if (areaId !== null && stationId !== null) {
      const station = await stationService.getStationById(stationId);
      if (!station.active) {
        throw new ValidationError('A estação seleccionada está inactiva.');
      }
      if (station.areaId !== areaId) {
        throw new ValidationError('A estação seleccionada não pertence à área informada.');
      }
      if (station.receptionUserId && station.receptionUserId !== req.auth!.userId) {
        throw new ConflictError('Esta estação já está ocupada por outro operador.');
      }

      const activeStationTicket = await ticketService.getActiveTicketForStationAnyUser(stationId);
      if (activeStationTicket && activeStationTicket.userId !== req.auth!.userId) {
        throw new ConflictError('Esta estação possui uma senha activa de outro operador.');
      }
    }

    const result = await userService.setActiveStation(req.auth!.userId, areaId, stationId);

    // Generate new JWT tokens with updated areaId and stationId claims!
    const { token, refreshToken } = await authService.generateTokens(result);

    res.json({
      user: {
        id: result.id,
        username: result.username,
        name: result.name,
        role: result.role,
        areaId: result.areaId,
        stationId: result.stationId,
        active: result.active,
      },
      token,
      refreshToken
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    logger.error('Update active station error', { module: 'users', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id — update user
router.patch('/:id', requireRole('root', 'admin', 'admin_manager'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const data = updateUserSchema.parse(req.body);
    const actorRole = req.auth!.role as UserRole;
    const existing = await userService.getUserById(id);
    const targetRole = (data.role || existing.role) as UserRole;

    if (existing.role === 'root') {
      throw new ForbiddenError('Root user cannot be edited');
    }

    if (targetRole === 'root') {
      throw new ForbiddenError('Users cannot be promoted to root');
    }

    if (actorRole === 'admin' && !userService.canAdminManageRole(existing.role as UserRole)) {
      throw new ForbiddenError(`Your role '${actorRole}' cannot edit users with role '${existing.role}'`);
    }

    if (actorRole === 'admin' && !userService.canAdminManageRole(targetRole)) {
      throw new ForbiddenError(`Your role '${actorRole}' cannot assign role '${targetRole}'`);
    }

    if (actorRole === 'admin_manager' && (existing.role === 'admin' || targetRole === 'admin')) {
      throw new ForbiddenError(`Your role '${actorRole}' cannot manage administrators`);
    }

    const result = await userService.updateUser(id, {
      username: data.username,
      role: data.role,
      areaId: data.areaId,
      stationId: data.stationId,
      active: data.active,
      name: data.name,
    });

    res.json({
      id: result.id,
      username: result.username,
      name: result.name,
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

// POST /api/users/:id/release-station — force logout and release station
router.post('/:id/release-station', requireRole('root', 'admin', 'admin_manager'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const actorRole = req.auth!.role as UserRole;
    const target = await userService.getUserById(id);

    if (target.role === 'root') {
      throw new ForbiddenError('Root user station cannot be edited');
    }

    if (actorRole === 'admin' && !userService.canAdminManageRole(target.role as UserRole)) {
      throw new ForbiddenError(`Your role '${actorRole}' cannot manage users with role '${target.role}'`);
    }

    if (target.role !== 'reception') {
      throw new ValidationError('Apenas utilizadores de recepção possuem estação de atendimento para libertar.');
    }

    const result = await userService.setActiveStation(id, null, null);

    // Emitir evento Socket.IO global para informar o frontend da liberação em tempo real
    io.emit('user:released', { userId: id });

    res.json({
      message: 'Estação libertada com sucesso e sessão encerrada.',
      user: {
        id: result.id,
        username: result.username,
        name: result.name,
        role: result.role,
        areaId: result.areaId,
        stationId: result.stationId,
        active: result.active,
      }
    });
  } catch (error) {
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    logger.error('Release station error', { module: 'users', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id — delete user
router.delete('/:id', requireRole('root', 'admin', 'admin_manager'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const actorRole = req.auth!.role as UserRole;
    const target = await userService.getUserById(id);

    if (actorRole === 'admin' && !userService.canAdminManageRole(target.role as UserRole)) {
      throw new ForbiddenError(`Your role '${actorRole}' cannot delete users with role '${target.role}'`);
    }

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
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const authUserId = req.auth!.userId;
    const authRole = req.auth!.role as UserRole;
    const target = await userService.getUserById(id);

    // Only the user themselves, root, or admin can change password
    if (authUserId !== id && !['root', 'admin'].includes(authRole)) {
      throw new ForbiddenError('You can only change your own password');
    }
    if (authRole === 'admin' && authUserId !== id && !userService.canAdminManageRole(target.role as UserRole)) {
      throw new ForbiddenError(`Your role '${authRole}' cannot change password for role '${target.role}'`);
    }
    if (authUserId === id) {
      if (!currentPassword) {
        throw new ValidationError('Senha actual é obrigatória');
      }
      const valid = await authService.verifyUserPassword(id, currentPassword);
      if (!valid) {
        throw new ForbiddenError('Senha actual incorrecta');
      }
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
