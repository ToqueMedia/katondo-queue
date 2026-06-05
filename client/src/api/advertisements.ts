// Advertisements API calls

import apiClient from './client';
import type { AdvertisementRow, AdContentType } from '../types/index';

export async function getAdvertisements(areaId?: number): Promise<AdvertisementRow[]> {
  const { data } = await apiClient.get<AdvertisementRow[]>('/advertisements', {
    params: areaId ? { areaId } : undefined,
  });
  return data;
}

export const listAds = getAdvertisements;

// Signature used by ad-management page
export async function createAd(
  title: string,
  contentType: AdContentType,
  areaId: number | null,
  contentUrl?: string,
  contentText?: string,
  durationSeconds?: number,
): Promise<AdvertisementRow> {
  const { data } = await apiClient.post<AdvertisementRow>('/advertisements', {
    title,
    contentType,
    contentUrl: contentUrl || null,
    contentText: contentText || null,
    areaId,
    durationSeconds: durationSeconds ?? 10,
  });
  return data;
}

export async function updateAd(id: number, updates: Partial<AdvertisementRow>): Promise<AdvertisementRow> {
  const { data } = await apiClient.patch<AdvertisementRow>(`/advertisements/${id}`, updates);
  return data;
}

export async function deleteAd(id: number): Promise<void> {
  await apiClient.delete(`/advertisements/${id}`);
}
