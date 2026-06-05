// Settings API client

import { apiClient } from './client';

export async function getSettings(): Promise<Record<string, string>> {
  const { data } = await apiClient.get<Record<string, string>>('/settings');
  return data;
}

export async function updateSetting(key: string, value: string, description?: string): Promise<void> {
  await apiClient.put('/settings', { key, value, description });
}

export async function getServerUrl(): Promise<string> {
  const { data } = await apiClient.get<{ serverUrl: string }>('/settings/server-url');
  return data.serverUrl;
}
