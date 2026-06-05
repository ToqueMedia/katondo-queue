// Zustand queue store — Socket.IO subscription, current ticket, waiting count

import { create } from 'zustand';
import type { TicketRow } from '../types';

interface QueueState {
  currentTicket: TicketRow | null;
  nextTickets: TicketRow[];
  waitingCount: number;
  currentVoiceText: string;
  areaId: number | null;
  socketConnected: boolean;
  setArea: (areaId: number) => void;
  setCurrentTicket: (ticket: TicketRow | null, voiceText?: string) => void;
  setNextTickets: (tickets: TicketRow[]) => void;
  setWaitingCount: (count: number) => void;
  addTicket: (ticket: TicketRow) => void;
  removeTicket: (ticketId: number) => void;
  updateTicket: (ticket: TicketRow) => void;
  setSocketConnected: (connected: boolean) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  currentTicket: null,
  currentVoiceText: '',
  nextTickets: [],
  waitingCount: 0,
  areaId: null,
  socketConnected: false,

  setArea: (areaId) => set({ areaId }),

  setCurrentTicket: (ticket, voiceText = '') => set({ currentTicket: ticket, currentVoiceText: voiceText }),

  setNextTickets: (tickets) => set({ nextTickets: tickets }),

  setWaitingCount: (count) => set({ waitingCount: count }),

  addTicket: (ticket) => set((state) => ({
    nextTickets: [...state.nextTickets, ticket],
    waitingCount: state.waitingCount + 1,
  })),

  removeTicket: (ticketId) => set((state) => ({
    nextTickets: state.nextTickets.filter((t) => t.id !== ticketId),
    waitingCount: Math.max(0, state.waitingCount - 1),
  })),

  updateTicket: (ticket) => set((state) => ({
    currentTicket: state.currentTicket?.id === ticket.id ? ticket : state.currentTicket,
    nextTickets: state.nextTickets.map((t) => (t.id === ticket.id ? ticket : t)),
  })),

  setSocketConnected: (connected) => set({ socketConnected: connected }),
}));
