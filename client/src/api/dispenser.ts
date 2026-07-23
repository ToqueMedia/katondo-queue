// Dispenser (touch) API calls — emit tickets and battery alerts

import apiClient from './client';
import type { TicketRow } from '../types/index';

export interface EmitTicketResponse extends TicketRow {
  waitingCount: number;
}

// POST /api/dispenser/tickets — emit a ticket for the given service/area (dispenser auth)
export async function emitDispenserTicket(serviceId: number, areaId: number): Promise<EmitTicketResponse> {
  const { data } = await apiClient.post<EmitTicketResponse>('/dispenser/tickets', {
    serviceId,
    areaId,
  });
  return data;
}

// POST /api/dispenser/battery-alert — notify reception of low battery
export async function sendBatteryAlert(level: number): Promise<void> {
  await apiClient.post('/dispenser/battery-alert', { level });
}
