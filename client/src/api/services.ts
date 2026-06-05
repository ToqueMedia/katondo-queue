// Services API calls

import apiClient from './client';
import type { ServiceRow, TicketFormat } from '../types/index';

export async function getServices(areaId?: number): Promise<ServiceRow[]> {
  const { data } = await apiClient.get<ServiceRow[]>('/services', {
    params: areaId ? { areaId } : undefined,
  });
  return data;
}

export const listServices = getServices;

// Signature used by service-management page
export async function createService(
  name: string,
  areaId: number,
  ticketFormat: TicketFormat,
  ticketPrefix?: string,
  ticketDigitCount?: number,
  isPriority?: boolean,
): Promise<ServiceRow> {
  const { data } = await apiClient.post<ServiceRow>('/services', {
    name,
    areaId,
    ticketFormat,
    ticketPrefix: ticketPrefix || null,
    ticketDigitCount: ticketDigitCount ?? 3,
    isPriority: isPriority ?? false,
  });
  return data;
}

export async function updateService(id: number, updates: Partial<ServiceRow>): Promise<ServiceRow> {
  const { data } = await apiClient.patch<ServiceRow>(`/services/${id}`, updates);
  return data;
}

export async function deleteService(id: number): Promise<void> {
  await apiClient.delete(`/services/${id}`);
}
