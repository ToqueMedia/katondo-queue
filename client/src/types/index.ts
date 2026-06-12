// Client-side TypeScript types

export type UserRole = 'root' | 'admin' | 'reception' | 'management' | 'display' | 'dispenser';
export type TicketStatus = 'waiting' | 'called' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
export type TicketFormat = 'numeric' | 'alphanumeric' | 'custom';
export type AdContentType = 'image' | 'video' | 'text' | 'html';

export interface UserRow {
  id: number;
  username: string;
  name: string | null;
  role: UserRole;
  areaId: number | null;
  stationId: number | null;
  active: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: UserRow;
}

export interface AreaRow {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRow {
  id: number;
  name: string;
  areaId: number;
  ticketFormat: TicketFormat;
  ticketPrefix: string | null;
  ticketDigitCount: number;
  isPriority: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StationRow {
  id: number;
  name: string;
  description: string | null;
  areaId: number;
  receptionUserId: number | null;
  serviceIds: number[];
  active: boolean;
  createdAt: string;
}

export interface DisplayConfigRow {
  id: number;
  name: string;
  username: string;
  areaId: number;
  userId: number;
  active: boolean;
  createdAt: string;
}

export interface DispenserConfigRow {
  id: number;
  name: string;
  username: string;
  areaId: number;
  userId: number;
  active: boolean;
  createdAt: string;
}

export interface TicketRow {
  id: number;
  number: string;
  sequenceNumber: number;
  serviceId: number;
  areaId: number;
  status: TicketStatus;
  stationId: number | null;
  stationName?: string;
  serviceName?: string;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  callCount: number;
  createdAt: string;
  date: string;
}

export interface IndicatorData {
  issued: number;
  served: number;
  avgWaitMin: number;
  avgServiceMin: number;
  byService: Array<{
    serviceId: number;
    serviceName: string;
    issued: number;
    served: number;
    avgWaitMin: number;
    avgServiceMin: number;
  }>;
}

export interface AdvertisementRow {
  id: number;
  title: string;
  contentType: AdContentType;
  contentUrl: string | null;
  contentText: string | null;
  areaId: number | null;
  active: boolean;
  durationSeconds: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceConfigRow {
  id: number;
  areaId: number;
  language: string;
  voiceName: string | null;
  speed: number;
  voiceTextTemplate: string;
  callSoundMode: string;
  createdAt: string;
}