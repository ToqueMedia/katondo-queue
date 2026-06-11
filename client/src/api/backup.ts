// Backup API calls

import apiClient from './client';

export interface BackupStatusResponse {
  lastBackupDate: string;
  daysSinceLastBackup: number;
  isOverdue: boolean;
}

export async function getBackupStatus(): Promise<BackupStatusResponse> {
  const { data } = await apiClient.get<BackupStatusResponse>('/backup/status');
  return data;
}

export async function triggerBackupDownload(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/backup/download', {
    responseType: 'blob', // Extremely important to read as binary stream blob!
  });
  return data;
}
