// Areas API calls

import apiClient from './client';
import type { AreaRow } from '../types/index';

export async function getAreas(): Promise<AreaRow[]> {
  const { data } = await apiClient.get<AreaRow[]>('/areas', {
    params: { includeInactive: true },
  });
  return data;
}

export const listAreas = getAreas;

export async function createArea(name: string, description?: string): Promise<AreaRow> {
  const { data } = await apiClient.post<AreaRow>('/areas', { name, description });
  return data;
}

export async function updateArea(id: number, updates: Partial<AreaRow>): Promise<AreaRow> {
  const { data } = await apiClient.patch<AreaRow>(`/areas/${id}`, updates);
  return data;
}

export async function deleteArea(id: number): Promise<void> {
  await apiClient.delete(`/areas/${id}`);
}
