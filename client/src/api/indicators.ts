// Indicators API calls

import apiClient from './client';

export interface TodayIndicators {
  date: string;
  issued: number;
  served: number;
  cancelled: number;
  noShow: number;
  avgWaitMin: number;
  avgServiceMin: number;
}

export interface ServiceIndicators {
  serviceId: number;
  serviceName: string;
  issued: number;
  served: number;
  avgWaitMin: number;
  avgServiceMin: number;
}

export interface RangeIndicators {
  summary: {
    startDate: string;
    endDate: string;
    issued: number;
    served: number;
    avgWaitMin: number;
    avgServiceMin: number;
  };
  daily: Array<{
    date: string;
    issued: number;
    served: number;
    cancelled: number;
    noShow: number;
    avgWaitMin: number;
    avgServiceMin: number;
  }>;
}

export async function getTodayIndicators(areaId?: number): Promise<TodayIndicators> {
  const { data } = await apiClient.get<TodayIndicators>('/indicators/today', {
    params: areaId ? { areaId } : undefined,
  });
  return data;
}

export async function getTodayIndicatorsByService(areaId?: number): Promise<ServiceIndicators[]> {
  const { data } = await apiClient.get<ServiceIndicators[]>('/indicators/today/by-service', {
    params: areaId ? { areaId } : undefined,
  });
  return data;
}

export async function getIndicatorsForRange(startDate: string, endDate: string, areaId?: number): Promise<RangeIndicators> {
  const { data } = await apiClient.get<RangeIndicators>('/indicators/range', {
    params: { startDate, endDate, areaId },
  });
  return data;
}
