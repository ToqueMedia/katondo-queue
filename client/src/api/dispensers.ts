// Dispensers API calls

import apiClient from './client';
import type { DispenserConfigRow } from '../types/index';

export async function getDispensers(): Promise<DispenserConfigRow[]> {
  const { data } = await apiClient.get<DispenserConfigRow[]>('/dispensers');
  return data;
}

export const listDispensers = getDispensers;

export async function createDispenser(data: { name: string; areaId: number; username: string; password: string }): Promise<DispenserConfigRow> {
  const response = await apiClient.post<DispenserConfigRow>('/dispensers', data);
  return response.data;
}

export async function updateDispenser(id: number, updates: Partial<DispenserConfigRow>): Promise<DispenserConfigRow> {
  const { data } = await apiClient.patch<DispenserConfigRow>(`/dispensers/${id}`, updates);
  return data;
}

export async function deleteDispenser(id: number): Promise<void> {
  await apiClient.delete(`/dispensers/${id}`);
}
