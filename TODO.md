# TODO — Gestão de Filas Clínica Katondo

> Derived from PLAN.md §13 — Implementation Phases
> Updated: 2025-07-10

## Phase 1 — Autenticação e Gestão de Utilizadores

- [ ] T1.01: Setup monorepo (package.json root, server, client, tsconfigs, .gitignore, .env.example, docker-compose.yml)
- [ ] T1.02: Setup Express server (index.ts, config/env.ts, middleware, Winston logger)
- [ ] T1.03: Setup Drizzle (db/connection.ts, db/schema.ts — User table, drizzle.config.ts, migration)
- [ ] T1.04: Seed script (db/seed.ts — root user: root / root@123 hashed)
- [ ] T1.05: Auth service + routes + middleware (bcrypt, JWT, login/refresh/logout, requireRole)
- [ ] T1.06: User service + routes (CRUD + password change, Zod validation)
- [ ] T1.07: Setup Vite client (vite.config.ts, main.tsx, Chakra Provider, theme/system.ts)
- [ ] T1.08: Auth store + API client (Axios + interceptors, Zustand auth-store, auth context)
- [ ] T1.09: Login page (centered card, username/password, error handling)
- [ ] T1.10: First-login modal (forces root password change on default credentials)
- [ ] T1.11: RoleGuard component (allowedRoles, fallback redirect)
- [ ] T1.12: AppShell layout (sidebar per role, header with user info)
- [ ] T1.13: Root pages (admin-management, my-account)
- [ ] T1.14: Admin user management (CRUD table, confirm-dialog, crud-table component)
- [ ] T1.15: App router (role-based redirects, protected routes)

## Phase 2 — Configuração Organizacional

- [ ] T2.01: Drizzle schema — Area, Service, Station, DisplayConfig, DispenserConfig, VoiceConfig
- [ ] T2.02: Run migration (add new tables)
- [ ] T2.03: Area service + routes (CRUD)
- [ ] T2.04: Service service + routes (CRUD + ticket format config)
- [ ] T2.05: Station service + routes (CRUD + receptionist assignment, 1:1 validation)
- [ ] T2.06: Display service + routes (CRUD + auto-create display user with generated credentials)
- [ ] T2.07: Dispenser service + routes (CRUD + auto-create dispenser user with generated credentials)
- [ ] T2.08: Ticket format utility (format number: numeric, alphanumeric, custom)
- [ ] T2.09: Area API + pages (area-management, area-select)
- [ ] T2.10: Service API + pages (service-management, ticket-format-config)
- [ ] T2.11: Station API + pages (station-management)
- [ ] T2.12: Display API + pages (display-management)
- [ ] T2.13: Dispenser API + pages (dispenser-management)
- [ ] T2.14: Voice config API + routes + pages (voice-config for management)

## Phase 3 — Emissão e Gestão de Filas

- [ ] T3.01: Drizzle schema — DailySequence, Ticket
- [ ] T3.02: Run migration (add ticket tables)
- [ ] T3.03: Ticket service (emit with transaction + sequence lock, call-next, start, complete, cancel, no-show)
- [ ] T3.04: Ticket routes (all endpoints from PLAN §6)
- [ ] T3.05: Dispenser API route (POST /api/tickets for Android app)
- [ ] T3.06: Daily reset service (node-cron 00:00 + on-demand fallback)
- [ ] T3.07: Socket.IO setup (handler, rooms, events — integrate in index.ts)
- [ ] T3.08: Date utility (today, isSameDay, format helpers)
- [ ] T3.09: Queue store (Zustand — Socket.IO subscription, currentTicket, waitingCount)
- [ ] T3.10: Socket hook (useSocket — connect, join room, listen events)
- [ ] T3.11: Queue hook (useQueue — call-next, start, complete actions)
- [ ] T3.12: Queue components (current-ticket-card, next-ticket-card, waiting-list, queue-actions)
- [ ] T3.13: Reception page (queue-panel — full layout with queue + actions)
- [ ] T3.14: Notification store + toast (Zustand, Chakra Toaster)
- [ ] T3.15: Ticket API client (all ticket API calls)
- [ ] T3.16: Error classes (AppError, NotFoundError, ConflictError)

## Phase 4 — Displays e Anúncios

- [ ] T4.01: Drizzle schema — Advertisement table
- [ ] T4.02: Run migration (add advertisement table)
- [ ] T4.03: Ad service + routes (CRUD + scheduling)
- [ ] T4.04: Display snapshot endpoint (GET /api/displays/:id/snapshot)
- [ ] T4.05: TTS service (voice text generation, Browser Speech API integration)
- [ ] T4.06: Socket.IO — broadcast display:ad-update when ads change
- [ ] T4.07: Display components (called-ticket-display, recent-calls-row, ad-carousel, voice-announcement, display-footer)
- [ ] T4.08: Display page (display-view — fullscreen kiosk, zero chrome, auto-reconnect, voice)
- [ ] T4.09: Ad API + management page (ad-management with upload)
- [ ] T4.10: Snapshot API client (displays.ts — snapshot endpoint)
- [ ] T4.11: File upload handling (static /uploads directory, local storage)

## Phase 5 — Indicadores e Relatórios

- [ ] T5.01: Indicator service (aggregate queries: issued, served, avgWait, avgService per area/service/day)
- [ ] T5.02: Indicator routes (GET with date range + area filter)
- [ ] T5.03: Indicator API client (api/indicators.ts)
- [ ] T5.04: KPI dashboard pages (admin indicators, management dashboard — stat cards + breakdown)
- [ ] T5.05: Stat card component (icon + value + label + trend)
- [ ] T5.06: Date range picker component
- [ ] T5.07: Admin dashboard overview (4 stat cards for today)
- [ ] T5.08: Verify historical data preservation after daily reset