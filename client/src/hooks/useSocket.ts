// Socket.IO hook — connect, join room, listen events
// NO HTTP calls on connect/reconnect — all data comes via socket events
// This prevents 401 → auth:expired → logout → redirect crash on Android TV

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueueStore } from '../store/queue-store';
import { useNotificationStore } from '../store/notification-store';
import { listTickets } from '../api/tickets';

// Socket URL: in production, always use window.location.origin (same host that served the page)
// In development, use VITE_SOCKET_URL if defined, otherwise window.location.origin
const SOCKET_URL = import.meta.env.PROD
  ? window.location.origin
  : (import.meta.env.VITE_SOCKET_URL || window.location.origin);

export function useSocket(areaId: number | null) {
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(false);
  const queueStore = useQueueStore();
  const notify = useNotificationStore();
  const [socket, setSocket] = useState<Socket | null>(null);

  const getToken = () => localStorage.getItem('token');
  const isAuthenticated = () => !!localStorage.getItem('token') && !!localStorage.getItem('user');

  useEffect(() => {
    if (!areaId || !isAuthenticated()) return;

    if (!mountedRef.current) {
      mountedRef.current = true;
      if (import.meta.env.DEV) {
        return;
      }
    }

    const token = getToken();
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 5000,
      auth: { token },
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      console.log('[Socket] Connected:', s.id);
      queueStore.setSocketConnected(true);
      s.emit('join:area', areaId);
      s.emit('subscribe:queue', areaId);
    });

    s.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      queueStore.setSocketConnected(false);
    });

    s.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    s.on('ticket:created', async (payload) => {
      const userJson = localStorage.getItem('user');
      const user = userJson ? JSON.parse(userJson) : null;
      if (user && user.role === 'reception' && user.stationId) {
        try {
          const tickets = await listTickets(areaId, 'waiting', undefined, user.stationId);
          queueStore.setWaitingCount(tickets.length);
          queueStore.setNextTickets(tickets);
          const isOurService = tickets.some(t => t.id === payload.ticket.id);
          if (isOurService) {
            notify.addNotification({ type: 'info', title: `Nova senha: ${payload.ticket.number}` });
          }
        } catch (err) {
          console.error('[Socket] Failed to fetch updated tickets for receptionist', err);
        }
      } else {
        queueStore.addTicket(payload.ticket);
        notify.addNotification({ type: 'info', title: `Nova senha: ${payload.ticket.number}` });
      }
    });

    s.on('ticket:called', async (payload) => {
      const userJson = localStorage.getItem('user');
      const user = userJson ? JSON.parse(userJson) : null;
      if (user && user.role === 'reception' && user.stationId) {
        if (payload.ticket.stationId === user.stationId) {
          queueStore.setCurrentTicket(payload.ticket, payload.voiceText);
        }
        try {
          const tickets = await listTickets(areaId, 'waiting', undefined, user.stationId);
          queueStore.setWaitingCount(tickets.length);
          queueStore.setNextTickets(tickets);
        } catch (err) {
          console.error('[Socket] Failed to fetch updated tickets for receptionist', err);
        }
      } else {
        queueStore.setCurrentTicket(payload.ticket, payload.voiceText);
        queueStore.removeTicket(payload.ticket.id);
      }
    });

    s.on('ticket:started', () => {
      // Current ticket already updated via socket
    });

    s.on('ticket:completed', (payload) => {
      if (queueStore.currentTicket?.id === payload.ticketId) {
        queueStore.setCurrentTicket(null);
      }
    });

    s.on('ticket:cancelled', async (payload) => {
      const userJson = localStorage.getItem('user');
      const user = userJson ? JSON.parse(userJson) : null;
      if (user && user.role === 'reception' && user.stationId) {
        try {
          const tickets = await listTickets(areaId, 'waiting', undefined, user.stationId);
          queueStore.setWaitingCount(tickets.length);
          queueStore.setNextTickets(tickets);
        } catch (err) {
          console.error('[Socket] Failed to fetch updated tickets for receptionist', err);
        }
      } else {
        queueStore.removeTicket(payload.ticketId);
      }
    });

    s.on('queue:updated', async (payload) => {
      const userJson = localStorage.getItem('user');
      const user = userJson ? JSON.parse(userJson) : null;
      if (user && user.role === 'reception' && user.stationId) {
        try {
          const tickets = await listTickets(areaId, 'waiting', undefined, user.stationId);
          queueStore.setWaitingCount(tickets.length);
          queueStore.setNextTickets(tickets);
        } catch (err) {
          console.error('[Socket] Failed to fetch updated tickets for receptionist', err);
        }
      } else {
        queueStore.setWaitingCount(payload.waitingCount);
        if (payload.nextTickets) {
          queueStore.setNextTickets(payload.nextTickets);
        }
      }
    });

    s.on('ads:updated', (_payload) => {
      console.log('[Socket] Ads updated', _payload);
    });

    return () => {
      mountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.emit('leave:area', areaId);
        socketRef.current.emit('unsubscribe:queue', areaId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
    };
  }, [areaId]);

  return socket;
}
