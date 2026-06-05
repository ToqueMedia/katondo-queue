// Indicator routes — KPIs and reports

import { Router } from 'express';
import * as indicatorService from '../services/indicator.service.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(authMiddleware);

// GET /api/indicators/today — today's summary
router.get('/today', requireRole('admin', 'management'), async (req, res) => {
  try {
    const areaId = req.query.areaId ? parseInt(String(req.query.areaId), 10) : undefined;
    const result = await indicatorService.getTodayIndicators(areaId);
    res.json(result);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Get today indicators error', { module: 'indicators', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/indicators/today/by-service — today's breakdown by service
router.get('/today/by-service', requireRole('admin', 'management'), async (req, res) => {
  try {
    const areaId = req.query.areaId ? parseInt(String(req.query.areaId), 10) : undefined;
    const result = await indicatorService.getTodayIndicatorsByService(areaId);
    res.json(result);
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Get today by-service error', { module: 'indicators', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/indicators/range — indicators for date range
router.get('/range', requireRole('admin', 'management'), async (req, res) => {
  try {
    const startDate = String(req.query.startDate || '');
    const endDate = String(req.query.endDate || '');
    const areaId = req.query.areaId ? parseInt(String(req.query.areaId), 10) : undefined;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const [summary, daily] = await Promise.all([
      indicatorService.getIndicatorsForDateRange(startDate, endDate, areaId),
      indicatorService.getDailyBreakdown(startDate, endDate, areaId),
    ]);

    res.json({ summary, daily });
  } catch (error) {
    if (isAppError(error)) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Get range indicators error', { module: 'indicators', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
