// Stations API calls

import apiClient from './client';
import type { StationRow } from '../types/index';

export async function getStations(areaId?: number): Promise<StationRow[]> {
  const { data } = await apiClient.get<StationRow[]>('/stations', {
    params: { includeInactive: true, areaId },
  });
  return data;
}

export const listStations = getStations;

export async function createStation(name: string, areaId: number, receptionUserId?: number, description?: string): Promise<StationRow> {
  const { data } = await apiClient.post<StationRow>('/stations', { name, areaId, receptionUserId, description });
  return data;
}

export async function updateStation(id: number, updates: Partial<StationRow>): Promise<StationRow> {
  const { data } = await apiClient.patch<StationRow>(`/stations/${id}`, updates);
  return data;
}

export async function deleteStation(id: number): Promise<void> {
  await apiClient.delete(`/stations/${id}`);
}
