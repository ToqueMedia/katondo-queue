// Users API calls

import apiClient from './client';
import type { UserRow } from '../types/index';

export interface CreateUserPayload {
  username: string;
  password: string;
  role: string;
  areaId?: number | null;
  stationId?: number | null;
}

export interface UpdateUserPayload {
  username?: string;
  role?: string;
  areaId?: number | null;
  stationId?: number | null;
  active?: boolean;
}

export async function getUsers(role?: string): Promise<UserRow[]> {
  const { data } = await apiClient.get<UserRow[]>('/users', {
    params: role ? { role } : undefined,
  });
  return data;
}

// Alias used by pages
export async function listUsers(roleOrAll?: string | boolean): Promise<UserRow[]> {
  // Pages pass `true` to get all; we ignore booleans and fetch all
  const role = typeof roleOrAll === 'string' ? roleOrAll : undefined;
  return getUsers(role);
}

export async function getUserById(id: number): Promise<UserRow> {
  const { data } = await apiClient.get<UserRow>(`/users/${id}`);
  return data;
}

export async function createUser(
  username: string,
  password: string,
  role: string,
  areaId?: number | null,
  stationId?: number | null,
): Promise<UserRow> {
  const { data } = await apiClient.post<UserRow>('/users', {
    username,
    password,
    role,
    areaId: areaId ?? null,
    stationId: stationId ?? null,
    firstLogin: true,
  });
  return data;
}

export async function updateUser(id: number, updates: UpdateUserPayload): Promise<UserRow> {
  const { data } = await apiClient.patch<UserRow>(`/users/${id}`, updates);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}

export async function resetUserPassword(id: number, newPassword: string): Promise<void> {
  await apiClient.patch(`/users/${id}/password`, { newPassword });
}

// Pages call changePassword(userId, newPassword)
export async function changePassword(id: number, newPassword: string): Promise<void> {
  await apiClient.patch(`/users/${id}/password`, { newPassword });
}
