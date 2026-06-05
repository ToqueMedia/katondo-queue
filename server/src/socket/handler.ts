// Socket.IO event handler — room management and ticket broadcasts

import type { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    logger.info('Socket connected', { module: 'socket', socketId: socket.id });

    // Join area room — used by displays and reception
    socket.on('join:area', (areaId: number) => {
      const room = areaId ? `area:${areaId}` : 'area:all';
      socket.join(room);
      logger.info('Socket joined room', { module: 'socket', socketId: socket.id, room });
    });

    // Leave area room
    socket.on('leave:area', (areaId: number) => {
      const room = areaId ? `area:${areaId}` : 'area:all';
      socket.leave(room);
      logger.info('Socket left room', { module: 'socket', socketId: socket.id, room });
    });

    // Subscribe to queue updates for an area
    socket.on('subscribe:queue', (areaId: number) => {
      const room = areaId ? `area:${areaId}` : 'area:all';
      socket.join(room);
      logger.info('Socket subscribed to queue', { module: 'socket', socketId: socket.id, room });
    });

    // Unsubscribe from queue
    socket.on('unsubscribe:queue', (areaId: number) => {
      const room = areaId ? `area:${areaId}` : 'area:all';
      socket.leave(room);
      logger.info('Socket unsubscribed from queue', { module: 'socket', socketId: socket.id, room });
    });

    socket.on('disconnect', (reason: string) => {
      logger.info('Socket disconnected', { module: 'socket', socketId: socket.id, reason });
    });
  });
}

// Helper: broadcast to all sockets in an area room (displays, reception, etc.)
export function broadcastToArea(io: Server, areaId: number, event: string, data: unknown) {
  io.to(`area:${areaId}`).emit(event, data);
  io.to('area:all').emit(event, data);
}
