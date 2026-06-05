// Displays API calls

import apiClient from './client';
import type { DisplayConfigRow } from '../types/index';

export async function getDisplays(): Promise<DisplayConfigRow[]> {
  const { data } = await apiClient.get<DisplayConfigRow[]>('/displays');
  return data;
}

export const listDisplays = getDisplays;

export async function createDisplay(data: { name: string; areaId: number; username: string; password: string }): Promise<DisplayConfigRow> {
  const response = await apiClient.post<DisplayConfigRow>('/displays', data);
  return response.data;
}

export async function updateDisplay(id: number, updates: Partial<DisplayConfigRow>): Promise<DisplayConfigRow> {
  const { data } = await apiClient.patch<DisplayConfigRow>(`/displays/${id}`, updates);
  return data;
}

export async function deleteDisplay(id: number): Promise<void> {
  await apiClient.delete(`/displays/${id}`);
}

export interface DisplaySnapshot {
  currentInService: { id: number; number: string; stationId: number | null; stationName: string } | null;
  recentCalled: Array<{ id: number; number: string; stationId: number | null; stationName: string }>;
  waitingCount: number;
  ads: import('../types').AdvertisementRow[];
}

export async function getDisplaySnapshot(displayId: number): Promise<DisplaySnapshot> {
  const { data } = await apiClient.get<DisplaySnapshot>(`/displays/${displayId}/snapshot`);
  return data;
}

export async function getMySnapshot(): Promise<DisplaySnapshot & { displayId: number; areaId: number }> {
  const { data } = await apiClient.get<DisplaySnapshot & { displayId: number; areaId: number }>('/displays/my-snapshot');
  return data;
}
