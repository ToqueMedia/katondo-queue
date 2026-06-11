// Authentication API calls

import apiClient from './client';
import type { AuthResponse } from '../types/index';

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export async function login(username: string, password: string, browserStationId?: number | null): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', {
    username,
    password,
    browserStationId,
  });
  return data;
}

export async function refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
  const { data } = await apiClient.post('/auth/refresh', { refreshToken });
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await apiClient.post('/auth/change-password', payload);
}
