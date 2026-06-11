// Auth routes — login, refresh, logout

import { Router } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  browserStationId: z.number().int().nullable().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, browserStationId } = loginSchema.parse(req.body);
    const result = await authService.login(username, password, browserStationId);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    logger.error('Login error', { module: 'auth', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    logger.error('Refresh error', { module: 'auth', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (_req, res) => {
  // JWT is stateless — logout is handled client-side (delete tokens)
  res.json({ message: 'Logged out successfully' });
});

export default router;