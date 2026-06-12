// Users API calls

import apiClient from './client';
import type { UserRole, UserRow } from '../types/index';

export interface CreateUserPayload {
  username: string;
  password: string;
  role: string;
  areaId?: number | null;
  stationId?: number | null;
  name?: string | null;
}

export interface UpdateUserPayload {
  username?: string;
  role?: UserRole;
  areaId?: number | null;
  stationId?: number | null;
  active?: boolean;
  name?: string | null;
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

export interface ActiveStationResponse {
  user: UserRow;
  token: string;
  refreshToken: string;
}

export async function updateActiveStation(areaId: number | null, stationId: number | null): Promise<ActiveStationResponse> {
  const { data } = await apiClient.patch<ActiveStationResponse>('/users/active-station', { areaId, stationId });
  return data;
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
  name?: string | null,
): Promise<UserRow> {
  const { data } = await apiClient.post<UserRow>('/users', {
    username,
    password,
    role,
    areaId: areaId ?? null,
    stationId: stationId ?? null,
    name: name ?? null,
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

// Pages call changePassword(userId, newPassword, currentPassword?)
export async function changePassword(id: number, newPassword: string, currentPassword?: string): Promise<void> {
  await apiClient.patch(`/users/${id}/password`, { newPassword, currentPassword });
}

export async function forceReleaseStation(id: number): Promise<{ message: string; user: UserRow }> {
  const { data } = await apiClient.post<{ message: string; user: UserRow }>(`/users/${id}/release-station`);
  return data;
}
