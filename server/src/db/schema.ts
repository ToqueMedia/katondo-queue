// Drizzle ORM schema definitions — Katondo Queue system (MySQL)

import { mysqlTable, varchar, int, real, timestamp, boolean, date, mysqlEnum, text } from 'drizzle-orm/mysql-core';

// ──────────────────────────────────────────────
// User — all user types (root, admin, reception, management, display, dispenser)
// ──────────────────────────────────────────────
export const userRoleEnum = mysqlEnum('role', ['root', 'admin', 'reception', 'management', 'display', 'dispenser']);

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum.notNull(),
  areaId: int('area_id'),                    // nullable — root/admin/management don't need area
  stationId: int('station_id'),              // nullable — only reception
  active: boolean('active').notNull().default(true),
  createdBy: int('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ──────────────────────────────────────────────
// Area — organizational unit (e.g., "Consultas", "Exames")
// ──────────────────────────────────────────────
export const areas = mysqlTable('areas', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;

// ──────────────────────────────────────────────
// Service — services within an area (e.g., "Consulta Geral")
// ──────────────────────────────────────────────
export const ticketFormatEnum = mysqlEnum('ticket_format', ['numeric', 'alphanumeric', 'custom']);

export const services = mysqlTable('services', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  areaId: int('area_id').notNull(),
  ticketFormat: ticketFormatEnum.notNull(),
  ticketPrefix: varchar('ticket_prefix', { length: 10 }),
  ticketDigitCount: int('ticket_digit_count').notNull().default(3),
  isPriority: boolean('is_priority').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

// ──────────────────────────────────────────────
// Station — reception workstation within an area
// ──────────────────────────────────────────────
export const stations = mysqlTable('stations', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  areaId: int('area_id').notNull(),
  receptionUserId: int('reception_user_id'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Station = typeof stations.$inferSelect;
export type NewStation = typeof stations.$inferInsert;

// ──────────────────────────────────────────────
// DisplayConfig — display configuration linked to area and user
// ──────────────────────────────────────────────
export const displayConfigs = mysqlTable('display_configs', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  areaId: int('area_id').notNull(),
  userId: int('user_id').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type DisplayConfig = typeof displayConfigs.$inferSelect;
export type NewDisplayConfig = typeof displayConfigs.$inferInsert;

// ──────────────────────────────────────────────
// DispenserConfig — dispenser configuration linked to area and user
// ──────────────────────────────────────────────
export const dispenserConfigs = mysqlTable('dispenser_configs', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  areaId: int('area_id').notNull(),
  userId: int('user_id').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type DispenserConfig = typeof dispenserConfigs.$inferSelect;
export type NewDispenserConfig = typeof dispenserConfigs.$inferInsert;

// ──────────────────────────────────────────────
// DailySequence — per-service per-day sequence counter
// ──────────────────────────────────────────────
export const dailySequences = mysqlTable('daily_sequences', {
  id: int('id').primaryKey().autoincrement(),
  serviceId: int('service_id').notNull(),
  date: date('date').notNull(),
  lastNumber: int('last_number').notNull().default(0),
});

export type DailySequence = typeof dailySequences.$inferSelect;
export type NewDailySequence = typeof dailySequences.$inferInsert;

// ──────────────────────────────────────────────
// Ticket — individual queue ticket
// ──────────────────────────────────────────────
export const ticketStatusEnum = mysqlEnum('status', ['waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show']);

export const tickets = mysqlTable('tickets', {
  id: int('id').primaryKey().autoincrement(),
  number: varchar('number', { length: 20 }).notNull(),
  sequenceNumber: int('sequence_number').notNull(),
  serviceId: int('service_id').notNull(),
  areaId: int('area_id').notNull(),
  status: ticketStatusEnum.notNull(),
  stationId: int('station_id'),
  calledAt: timestamp('called_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  expiredAt: timestamp('expired_at'),
  callCount: int('call_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  date: date('date').notNull(),
});

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;

// ──────────────────────────────────────────────
// Advertisement — display media content
// ──────────────────────────────────────────────
export const adContentTypeEnum = mysqlEnum('content_type', ['image', 'video', 'text', 'html']);

export const advertisements = mysqlTable('advertisements', {
  id: int('id').primaryKey().autoincrement(),
  title: varchar('title', { length: 100 }).notNull(),
  contentType: adContentTypeEnum.notNull(),
  contentUrl: varchar('content_url', { length: 500 }),
  contentText: text('content_text'),
  areaId: int('area_id'),                    // null = all areas
  active: boolean('active').notNull().default(true),
  durationSeconds: int('duration_seconds').notNull().default(10),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type Advertisement = typeof advertisements.$inferSelect;
export type NewAdvertisement = typeof advertisements.$inferInsert;

// ──────────────────────────────────────────────
// VoiceConfig — TTS configuration per area
// ──────────────────────────────────────────────
export const voiceConfigs = mysqlTable('voice_configs', {
  id: int('id').primaryKey().autoincrement(),
  areaId: int('area_id').notNull(),
  language: varchar('language', { length: 10 }).notNull().default('pt'),
  voiceName: varchar('voice_name', { length: 50 }),
  speed: real('speed').notNull().default(1),
  voiceTextTemplate: text('voice_text_template').notNull().default('Senha {ticketNumber}, dirija-se à {stationName}'),
  callSoundMode: varchar('call_sound_mode', { length: 500 }).notNull().default('chime'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type VoiceConfig = typeof voiceConfigs.$inferSelect;
export type NewVoiceConfig = typeof voiceConfigs.$inferInsert;

// ──────────────────────────────────────────────
// SystemSettings — global system configuration
// ──────────────────────────────────────────────
export const systemSettings = mysqlTable('system_settings', {
  id: int('id').primaryKey().autoincrement(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  description: varchar('description', { length: 500 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;

// ──────────────────────────────────────────────
// StationServices — link table between stations and services
// ──────────────────────────────────────────────
export const stationServices = mysqlTable('station_services', {
  id: int('id').primaryKey().autoincrement(),
  stationId: int('station_id').notNull(),
  serviceId: int('service_id').notNull(),
});

export type StationService = typeof stationServices.$inferSelect;
export type NewStationService = typeof stationServices.$inferInsert;