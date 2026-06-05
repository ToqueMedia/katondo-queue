// Ticket API calls

import apiClient from './client';
import type { TicketRow } from '../types/index';

export async function issueTicket(serviceId: number, areaId: number): Promise<TicketRow> {
  const { data } = await apiClient.post<TicketRow>('/tickets', { serviceId, areaId });
  return data;
}

export async function listTickets(areaId?: number, status?: string, date?: string, stationId?: number): Promise<TicketRow[]> {
  const { data } = await apiClient.get<TicketRow[]>('/tickets', {
    params: { areaId, status, date, stationId },
  });
  return data;
}

export async function callNext(areaId: number, stationId: number): Promise<{ ticket: TicketRow; stationName: string }> {
  const { data } = await apiClient.post('/tickets/call-next', { areaId, stationId });
  return data;
}

export async function startService(ticketId: number): Promise<{ ticket: TicketRow }> {
  const { data } = await apiClient.patch(`/tickets/${ticketId}/start`);
  return data;
}

export async function completeService(ticketId: number): Promise<void> {
  await apiClient.patch(`/tickets/${ticketId}/complete`);
}

export async function cancelTicket(ticketId: number): Promise<void> {
  await apiClient.patch(`/tickets/${ticketId}/cancel`);
}

export async function markNoShow(ticketId: number): Promise<void> {
  await apiClient.patch(`/tickets/${ticketId}/no-show`);
}

export async function recallTicket(ticketId: number): Promise<{ ticket: TicketRow }> {
  const { data } = await apiClient.patch(`/tickets/${ticketId}/recall`);
  return data;
}

export async function getActiveTicket(stationId: number): Promise<{ ticket: TicketRow | null }> {
  const { data } = await apiClient.get(`/tickets/active/${stationId}`);
  return data;
}
