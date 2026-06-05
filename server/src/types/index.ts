// Shared TypeScript types for the Katondo Queue system

export type UserRole = 'root' | 'admin' | 'reception' | 'management' | 'display' | 'dispenser';

export type TicketStatus = 'waiting' | 'called' | 'in_service' | 'completed' | 'cancelled' | 'no_show';

export type TicketFormat = 'numeric' | 'alphanumeric' | 'custom';

export type AdContentType = 'image' | 'video' | 'text' | 'html';

export interface JwtPayload {
  userId: number;
  role: UserRole;
  areaId: number | null;
  stationId: number | null;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    role: UserRole;
    areaId: number | null;
    stationId: number | null;
  };
}

export interface TicketCreatedPayload {
  ticket: {
    id: number;
    number: string;
    serviceId: number;
    areaId: number;
    status: TicketStatus;
    createdAt: string;
  };
}

export interface TicketCalledPayload {
  ticket: {
    id: number;
    number: string;
    stationId: number;
    stationName: string;
  };
  voiceText: string;
}

export interface QueueUpdatedPayload {
  waitingCount: number;
  nextTickets: Array<{
    id: number;
    number: string;
    serviceName: string;
    createdAt: string;
  }>;
}

export interface DisplaySnapshot {
  currentInService: TicketCalledPayload['ticket'] | null;
  recentCalled: TicketCalledPayload['ticket'][];
  waitingCount: number;
  ads: AdvertisementRow[];
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
}

export interface VoiceConfigRow {
  id: number;
  areaId: number;
  language: string;
  voiceName: string | null;
  speed: number;
}