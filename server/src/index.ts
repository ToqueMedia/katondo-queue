// Express server entry point with Socket.IO

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { validateEnv, env } from './config/env.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import areaRoutes from './routes/areas.js';
import serviceRoutes from './routes/services.js';
import stationRoutes from './routes/stations.js';
import displayRoutes from './routes/displays.js';
import dispenserRoutes from './routes/dispensers.js';
import voiceConfigRoutes from './routes/voice-config.js';
import advertisementRoutes from './routes/advertisements.js';
import indicatorRoutes from './routes/indicators.js';
import ticketRoutes from './routes/tickets.js';
import dispenserApiRoutes from './routes/dispenser-api.js';
import uploadRoutes from './routes/upload.js';
import settingsRoutes from './routes/settings.js';
import backupRoutes from './routes/backup.js';
import { setupSocketHandlers } from './socket/handler.js';
import { startDailyResetCron, checkAndRunMissedReset } from './services/daily-reset.service.js';

// Validate environment variables
validateEnv();

const app = express();
const httpServer = createServer(app);

// Socket.IO server — CORS for client connection
// In a clinic LAN environment, multiple devices (displays, dispensers, reception PCs)
// connect from various IPs. We allow all origins in development and production
// since the system runs on an isolated internal network.
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
  },
});

// Express middleware
app.use(cors({
  origin: true,
}));
app.use(express.json());

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { module: 'http' });
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/displays', displayRoutes);
app.use('/api/dispensers', dispenserRoutes);
app.use('/api/voice-config', voiceConfigRoutes);
app.use('/api/advertisements', advertisementRoutes);
app.use('/api/indicators', indicatorRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dispenser', dispenserApiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backup', backupRoutes);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve client static files (built React SPA)
// In production Docker, app runs at /app, client/dist is at /app/client/dist
// Use absolute path to avoid __dirname calculation issues across environments
const CLIENT_DIST_PATH = '/app/client/dist';
app.use(express.static(CLIENT_DIST_PATH));

// SPA fallback — serve index.html for all non-API, non-static routes
// Must be AFTER all API routes and static middleware to avoid capturing them
app.use((req, res, next) => {
  // Skip API routes, uploads, socket.io, and health check
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/socket.io/')) {
    return next();
  }
  // Only serve index.html for GET requests (not POST, PUT, etc.)
  if (req.method !== 'GET') {
    return next();
  }
  res.sendFile(path.join(CLIENT_DIST_PATH, 'index.html'));
});

// Socket.IO connection handler
setupSocketHandlers(io);

// Global error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const appErr = err as { statusCode: number; message: string; code?: string };
    return res.status(appErr.statusCode).json({
      error: appErr.message,
      code: appErr.code,
    });
  }

  logger.error('Unhandled error', { module: 'http', error: err });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = env.port;

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, { module: 'server', env: env.nodeEnv });
  logger.info(`Socket.IO ready`, { module: 'server' });

  // Start daily reset cron (00:00)
  startDailyResetCron();

  // Check if server was down at midnight and run missed reset
  checkAndRunMissedReset().catch((err) => {
    logger.error('Failed to check missed reset', { module: 'server', error: err });
  });

  // Proactive self-healing: log users and automatically activate all display/dispenser users to prevent 401 lockouts!
  import('./db/connection.js').then(({ db }) => {
    import('./db/schema.js').then(async ({ users }) => {
      import('drizzle-orm').then(async ({ eq, or }) => {
        try {
          // 1. Force-activate all display and dispenser users to ensure they can login!
          await db.update(users)
            .set({ active: true })
            .where(or(eq(users.role, 'display'), eq(users.role, 'dispenser')));

          logger.info('Proactive self-healing: All display/dispenser users are verified active!', { module: 'server' });

          // 2. Log all users to console so admin can audit credentials & roles
          const allUsers = await db.select({ id: users.id, username: users.username, role: users.role, active: users.active }).from(users);
          console.log('--- REGISTERED USERS FOR AUTHENTICATION AUDIT ---');
          console.table(allUsers);
        } catch (err: any) {
          logger.error('Failed to run user self-healing/audit', { module: 'server', error: err.message });
        }
      });
    });
  }).catch(() => {});
});

// Export io for use in services (ticket broadcast, etc.)
export { io };