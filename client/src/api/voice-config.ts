// Voice configuration API calls

import apiClient from './client';
import type { VoiceConfigRow } from '../types/index';

export async function getVoiceConfig(areaId: number): Promise<VoiceConfigRow> {
  const { data } = await apiClient.get<VoiceConfigRow>(`/voice-config/${areaId}`);
  return data;
}

export async function updateVoiceConfig(areaId: number, updates: Partial<VoiceConfigRow>): Promise<VoiceConfigRow> {
  const { data } = await apiClient.patch<VoiceConfigRow>(`/voice-config/${areaId}`, updates);
  return data;
}
