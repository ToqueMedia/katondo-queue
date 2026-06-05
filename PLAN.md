# Architecture: Gestão de Filas — Clínica Katondo

> Author: TM Code Architect
> Date: 2025-07-10
> Status: COMPLETE
> Complexity: FULLSTACK

## 1. Context

**Current state:** O projecto katondo-queue é um directório vazio — não existe sistema de gestão de filas. A Clínica Katondo actualmente gere o atendimento de utentes de forma manual ou sem sistema, sem controlo de senhas, sem displays públicos, sem indicadores de desempenho.

**Problem:** Falha de organização no fluxo de atendimento: utentes não sabem quando serão chamados, recepcionistas não têm visibilidade sobre a fila, gestão não dispõe de indicadores para optimizar recursos, e não existe exibição pública do estado das chamadas.

**System boundary:** O sistema cobre o ciclo completo da senha — emissão (via API para app Android nativa), chamada, atendimento, e conclusão — incluindo displays em tempo real, painel de gestão, e indicadores históricos. A app Android nativa (dispensador) **não está no âmbito de implementação** deste plano; apenas a API REST que ela consume será construída. Não inclui: registos médicos, pagamentos, integração externa, ou sistema de impressão no Android.

## 2. Goals & Non-Goals

### Goals
- Permitir ao utente retirar uma senha num dispensador Android e receber o número da senha impresso.
- Permitir ao recepcionista chamar a próxima senha, iniciar e concluir o atendimento, com actualização em tempo real nos displays da sua área.
- Exibir em displays públicos as senhas chamadas, em atendimento, e anúncios multimédia configurados pela gestão.
- Garantir que as sequências de senhas reiniciam diariamente, preservando os dados do dia anterior para relatórios.
- Disponibilizar à gestão dashboards com KPIs: senhas emitidas, atendidas, tempo médio de espera, tempo médio de atendimento.
- Implementar RBAC com 6 perfis (Root, Administrador, Recepção, Gestão, Display, Dispensador) — cada perfil só acede às suas funcionalidades.

### Non-Goals
- Construir a app Android nativa (dispensador) — fica como projecto separado; este plano fornece apenas a API REST.
- Integração com sistemas de pagamento ou facturação.
- Gestão de dados médicos ou prontuários de utentes.
- Suporte multi-clínica ou multi-tenant — o sistema serve apenas a Clínica Katondo.
- Impressão directa a partir do browser — a impressão de senhas é responsabilidade do dispensador Android.

## 3. Architecture

### Design

O sistema segue uma arquitectura monolítica em duas camadas (frontend React + backend Express) comunicando via REST API e WebSocket (Socket.IO). O MySQL persiste todos os dados operacionais e históricos. A app Android nativa comunica exclusivamente via REST API; os displays web recebem actualizações em tempo real via Socket.IO rooms por área.

O backend Express serve simultaneamente:
1. REST API (CRUD + emissão de senhas + indicadores)
2. Socket.IO (eventos de chamada de senha, estado de fila, anúncios)
3. Ficheiros static do frontend compilado (em produção)

```
┌─────────────────────────────────────────────────────────┐
│                    Clínica Katondo                       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Dispensador│  │Recepção  │  │Gestão    │              │
│  │(Android) │  │(Web)     │  │(Web)     │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │REST         │REST+WS      │REST                  │
│       │             │             │                      │
│  ┌────┴─────────────┴─────────────┴──────────┐          │
│  │           Express + Socket.IO             │          │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ │          │
│  │  │Auth+RBAC │ │TicketSvc │ │IndicatorSvc│ │          │
│  │  └──────────┘ └──────────┘ └────────────┘ │          │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ │          │
│  │  │AreaSvc   │ │DisplaySvc│ │DailyReset  │ │          │
│  │  └──────────┘ └──────────┘ └────────────┘ │          │
│  └─────────────────────┬─────────────────────┘          │
│                        │                                │
│  ┌─────────────────────┴─────────────────────┐          │
│  │              MySQL (Drizzle ORM)          │          │
│  │  users · areas · services · tickets       │          │
│  │  stations · displays · sequences · ads    │          │
│  └───────────────────────────────────────────┘          │
│                                                         │
│  ┌───────────────────────────────────────────┐          │
│  │        Display (Web — fullscreen)         │          │
│  │  ← Socket.IO room/{areaId}               │          │
│  │  Senhas · Anúncios · Voz (TTS)           │          │
│  └───────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

### Components

- **AuthService** — Autenticação JWT, hashing bcrypt, verificação de roles. Recebe: username + password. Produz: JWT com claims {userId, role, areaId}.
- **TicketService** — Emissão de senhas (incremento de DailySequence), chamada de próxima senha, transição de estados (waiting→called→in_service→completed). Recebe: serviceId, stationId, ticketId. Produz: Ticket com número formatado + broadcasts Socket.IO.
- **AreaService** — CRUD de áreas, associar serviços, estações, displays. Recebe: dados de área. Produz: Area com relações.
- **ServiceService** — CRUD de serviços dentro de áreas, configuração de formato de senha. Recebe: dados de serviço + areaId. Produz: Service com ticket format config.
- **DisplayService** — CRUD de displays, associação a áreas e users. Recebe: dados de display + areaId. Produz: DisplayConfig.
- **IndicatorService** — Cálculo de KPIs diários e históricos (senhas emitidas, atendidas, tempos médios). Recebe: areaId, date range. Produz: indicadores agregados.
- **DailyResetService** — Reinício de sequências ao início de cada dia, arquivamento automático. Recebe: trigger cron (00:00). Produz: novo registo DailySequence para cada serviço.
- **SocketHandler** — Gestão de ligações Socket.IO, rooms por área, broadcast de eventos de chamada e fila. Recebe: eventos do TicketService. Produz: emissões para rooms específicas.
- **TTSService** — Geração de voz para chamada de senhas (eSpeak NG local ou Web Speech API no display). Recebe: número da senha + nome do serviço. Produz: áudio ou comando de síntese.
- **AdService** — CRUD de conteúdos publicitários para displays, associação a áreas ou global. Recebe: dados de anúncio. Produz: Advertisement programado.

### Key Interactions

**Ciclo principal — Emissão → Chamada → Atendimento:**

1. Utente chega ao dispensador → selecciona serviço → app Android faz `POST /api/tickets` com {serviceId, areaId}.
2. TicketService consulta DailySequence (serviceId + date) → incrementa last_number → gera número formatado (ex: "CONS001") → cria Ticket (status: waiting).
3. Socket.IO broadcast `ticket:created` para room da área → displays e recepção actualizam contagem de fila.
4. Recepcionista clica "Chamar Próxima" → `POST /api/tickets/call-next` com {areaId, stationId}.
5. TicketService selecciona primeiro Ticket waiting na área → actualiza status=called, called_at, station_id → broadcast `ticket:called` para room da área.
6. Display (room da área) mostra: "CONS001 → Consulta 3" + TTSService sintetiza voz.
7. Recepcionista clica "Iniciar Atendimento" → `PATCH /api/tickets/:id/start` → status=in_service, started_at.
8. Recepcionista clica "Concluir" → `PATCH /api/tickets/:id/complete` → status=completed, completed_at → broadcast `ticket:completed`.

**Cenário de falha — WebSocket disconectado no Display:**

1. Display perde ligação Socket.IO.
2. Socket.IO tenta auto-reconnect (intervalo 5s, até 10 tentativas).
3. Após reconnect, Display faz `GET /api/displays/:id/snapshot` → recebe estado actual (senha em atendimento, últimas chamadas, fila).
4. Display restaura UI a partir do snapshot → updates em tempo real retomam.
5. Se reconnect falha após 10 tentativas → Display mostra mensagem "Sem ligação — a reiniciar…" e continua tentando.

## 4. Domain Schema

**User** (catalog)
- id: int [PK, AUTO_INCREMENT] — identificador único
- username: varchar(50) [UNIQUE, NOT NULL] — login do utilizador
- password_hash: varchar(255) [NOT NULL] — hash bcrypt (12 rounds)
- role: enum('root','admin','reception','management','display','dispenser') [NOT NULL] — perfil RBAC
- area_id: int [FK → Area.id, NULLABLE] — área associada (reception, display, dispenser obrigam; root/admin/management sem área)
- station_id: int [FK → Station.id, NULLABLE] — estação do recepcionista (apenas role=reception)
- active: boolean [DEFAULT true] — conta activa/inactiva
- created_by: int [FK → User.id, NOT NULL] — quem criou este utilizador
- created_at: timestamp [DEFAULT CURRENT_TIMESTAMP]
- updated_at: timestamp [DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP]
- Relations: area_id → Area.id, station_id → Station.id, created_by → User.id

**Area** (catalog)
- id: int [PK, AUTO_INCREMENT]
- name: varchar(100) [NOT NULL] — nome da área (ex: "Consultas", "Exames")
- description: varchar(500) [NULLABLE]
- active: boolean [DEFAULT true]
- created_at: timestamp [DEFAULT CURRENT_TIMESTAMP]
- updated_at: timestamp [DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP]
- Relations: — (parent entity; services, users, displays, stations referenciam Area)

**Service** (catalog)
- id: int [PK, AUTO_INCREMENT]
- name: varchar(100) [NOT NULL] — nome do serviço (ex: "Consulta Geral", "Laboratório")
- area_id: int [FK → Area.id, NOT NULL] — área a que pertence
- ticket_format: enum('numeric','alphanumeric','custom') [NOT NULL] — tipo de formato
- ticket_prefix: varchar(10) [NULLABLE] — prefixo para alfanumérico/custom (ex: "CONS", "A")
- ticket_digit_count: int [DEFAULT 3] — número de dígitos na sequência (ex: 3 → 001, 002)
- active: boolean [DEFAULT true]
- created_at: timestamp [DEFAULT CURRENT_TIMESTAMP]
- updated_at: timestamp [DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP]
- Relations: area_id → Area.id

**Station** (catalog)
- id: int [PK, AUTO_INCREMENT]
- name: varchar(100) [NOT NULL] — identificação da estação (ex: "Consulta 1", "Guiché 3")
- area_id: int [FK → Area.id, NOT NULL] — área da estação
- reception_user_id: int [FK → User.id, NULLABLE] — recepcionista atribuído (1:1)
- active: boolean [DEFAULT true]
- created_at: timestamp [DEFAULT CURRENT_TIMESTAMP]
- Relations: area_id → Area.id, reception_user_id → User.id

**DisplayConfig** (catalog)
- id: int [PK, AUTO_INCREMENT]
- name: varchar(100) [NOT NULL] — identificação do display (ex: "Display Sala de Espera")
- area_id: int [FK → Area.id, NOT NULL] — área exibida no display
- user_id: int [FK → User.id, NOT NULL] — utilizador display (para autenticação)
- active: boolean [DEFAULT true]
- created_at: timestamp [DEFAULT CURRENT_TIMESTAMP]
- Relations: area_id → Area.id, user_id → User.id

**DispenserConfig** (catalog)
- id: int [PK, AUTO_INCREMENT]
- name: varchar(100) [NOT NULL] — identificação do dispensador (ex: "Dispensador Entrada")
- area_id: int [FK → Area.id, NOT NULL] — área dos serviços disponíveis
- user_id: int [FK → User.id, NOT NULL] — utilizador dispenser (para autenticação)
- active: boolean [DEFAULT true]
- created_at: timestamp [DEFAULT CURRENT_TIMESTAMP]
- Relations: area_id → Area.id, user_id → User.id

**DailySequence** (user)
- id: int [PK, AUTO_INCREMENT]
- service_id: int [FK → Service.id, NOT NULL]
- date: date [NOT NULL] — dia da sequência
- last_number: int [DEFAULT 0] — último número emitido (incrementa a cada senha)
- UNIQUE(service_id, date) — uma sequência por serviço por dia
- Relations: service_id → Service.id

**Ticket** (user)
- id: int [PK, AUTO_INCREMENT]
- number: varchar(20) [NOT NULL] — número formatado completo (ex: "CONS001", "A003", "001")
- sequence_number: int [NOT NULL] — número sequencial raw (para ordenação)
- service_id: int [FK → Service.id, NOT NULL] — serviço solicitado
- area_id: int [FK → Area.id, NOT NULL] — área (derivado do serviço, mas explícito para queries)
- status: enum('waiting','called','in_service','completed','cancelled','no_show') [NOT NULL]
- station_id: int [FK → Station.id, NULLABLE] — estação que chamou (definido quando called)
- called_at: timestamp [NULLABLE]
- started_at: timestamp [NULLABLE]
- completed_at: timestamp [NULLABLE]
- created_at: timestamp [DEFAULT CURRENT_TIMESTAMP]
- date: date [NOT NULL] — dia da senha (para filtragem diária)
- Relations: service_id → Service.id, area_id → Area.id, station_id → Station.id

**Advertisement** (catalog)
- id: int [PK, AUTO_INCREMENT]
- title: varchar(100) [NOT NULL]
- content_type: enum('image','video','text','html') [NOT NULL]
- content_url: varchar(500) [NULLABLE] — URL do ficheiro multimédia (imagem/video)
- content_text: varchar(2000) [NULLABLE] — texto do anúncio (para tipo text/html)
- area_id: int [FK → Area.id, NULLABLE] — NULL = todas as áreas; valor específico = área única
- active: boolean [DEFAULT true]
- duration_seconds: int [DEFAULT 10] — duração de exibição no display
- sort_order: int [DEFAULT 0] — ordem de exibição
- created_at: timestamp [DEFAULT CURRENT_TIMESTAMP]
- updated_at: timestamp [DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP]
- Relations: area_id → Area.id

**VoiceConfig** (catalog)
- id: int [PK, AUTO_INCREMENT]
- area_id: int [FK → Area.id, NOT NULL] — configuração de voz por área
- language: varchar(10) [DEFAULT 'pt'] — código da língua (ex: 'pt', 'en')
- voice_name: varchar(50) [NULLABLE] — nome da voz TTS
- speed: int [DEFAULT 1] — velocidade da voz
- created_at: timestamp [DEFAULT CURRENT_TIMESTAMP]
- Relations: area_id → Area.id

**Storage:** MySQL 8.x on-premise — escolhido pela familiaridade da equipa, robustez para dados operacionais, e suporte a transacções necessárias para incrementar sequências concorrentes. Drizzle ORM gere migrations e queries tipadas.

**Migration strategy:** Sem dados existentes — primeira migration cria todas as tabelas. Seed script insere o utilizador Root (username: 'root', password: 'root@123' hashed). Migrations subsequentes executadas via `drizzle-kit push` em desenvolvimento e `drizzle-kit migrate` em produção.

## 5. State Management

### Global Store
- **useAuthStore**: Actions: login(username, password), logout(), refreshToken(), setArea(areaId). Estado: user, token, role, areaId, isAuthenticated. Persistido em localStorage (JWT + role).
- **useQueueStore**: Actions: subscribeToArea(areaId), unsubscribe(), callNext(areaId, stationId), startService(ticketId), completeService(ticketId). Estado: currentTicket, nextTickets[], waitingCount, areaId. Actualizado via Socket.IO events.
- **useNotificationStore**: Actions: addNotification(msg), removeNotification(id). Estado: notifications[]. Usado para feedback de operações (senha chamada, atendimento concluído, erros).

### Per-Screen State (INTERACTIVE/FULLSTACK)

| Screen | Local State (useState) | Global State (store selectors) |
|--------|----------------------|-------------------------------|
| Login | username, password, loading | useAuthStore.isAuthenticated |
| Root — Gestão Admin | adminList, selectedAdmin, formOpen | useAuthStore.user.role |
| Admin — Gestão Utilizadores | userList, filters, selectedUser | useAuthStore.user |
| Admin — Configuração Áreas | areaList, selectedArea, servicesOfArea | — |
| Admin — Configuração Serviços | serviceList, selectedService, formatConfig | — |
| Admin — Gestão Displays | displayList, selectedDisplay | — |
| Admin — Gestão Dispensadores | dispenserList, selectedDispenser | — |
| Recepção — Painel Fila | loading, callingTicketId | useQueueStore.currentTicket, nextTickets, waitingCount |
| Gestão — Dashboard KPIs | dateRange, loadingIndicators, kpiData | useAuthStore.user.areaId |
| Gestão — Anúncios | adList, selectedAd, formOpen | — |
| Gestão — Config. Senha | servicesList, formatEditOpen | — |
| Gestão — Config. Voz | voiceConfig, loading | — |
| Display — Vista Pública | fullscreen, currentCalled, recentCalled[], adsRotation | useQueueStore.currentTicket, Socket.IO events |

## 6. Interface Contracts

### API Endpoints (FULLSTACK)

| Method | Path | Auth | Request Body | Response | Status Codes |
|--------|------|------|-------------|----------|-------------|
| POST | /api/auth/login | No | {username, password} | {token, refreshToken, user: {id, role, areaId}} | 200, 401 |
| POST | /api/auth/refresh | JWT | {refreshToken} | {token, refreshToken} | 200, 401 |
| POST | /api/auth/logout | JWT | — | {message} | 200 |
| GET | /api/users | JWT (root, admin) | — | [{id, username, role, areaId, active, createdBy}] | 200 |
| POST | /api/users | JWT (root, admin) | {username, password, role, areaId?, stationId?} | {id, username, role, ...} | 201, 400, 409 |
| PATCH | /api/users/:id | JWT (root, admin) | {username?, password?, role?, active?} | {user} | 200, 404 |
| DELETE | /api/users/:id | JWT (root, admin) | — | {message} | 200, 404 |
| PATCH | /api/users/:id/password | JWT (root, self) | {newPassword} | {message} | 200, 401 |
| GET | /api/areas | JWT (admin, management) | — | [{id, name, description, active}] | 200 |
| POST | /api/areas | JWT (admin, management) | {name, description} | {id, name, ...} | 201, 400 |
| PATCH | /api/areas/:id | JWT (admin, management) | {name?, description?, active?} | {area} | 200, 404 |
| DELETE | /api/areas/:id | JWT (admin, management) | — | {message} | 200, 404 |
| GET | /api/services?areaId=X | JWT (admin, management, dispenser) | — | [{id, name, areaId, ticketFormat, ticketPrefix, ticketDigitCount}] | 200 |
| POST | /api/services | JWT (admin, management) | {name, areaId, ticketFormat, ticketPrefix?, ticketDigitCount?} | {service} | 201, 400 |
| PATCH | /api/services/:id | JWT (admin, management) | {name?, ticketFormat?, ticketPrefix?, ticketDigitCount?} | {service} | 200, 404 |
| DELETE | /api/services/:id | JWT (admin, management) | — | {message} | 200, 404 |
| GET | /api/stations?areaId=X | JWT (admin) | — | [{id, name, areaId, receptionUserId}] | 200 |
| POST | /api/stations | JWT (admin) | {name, areaId, receptionUserId?} | {station} | 201, 400 |
| PATCH | /api/stations/:id | JWT (admin) | {name?, receptionUserId?} | {station} | 200, 404 |
| GET | /api/displays | JWT (admin) | — | [{id, name, areaId, userId, active}] | 200 |
| POST | /api/displays | JWT (admin) | {name, areaId} | {displayConfig} + auto-cria user display | 201 |
| PATCH | /api/displays/:id | JWT (admin) | {name?, areaId?, active?} | {displayConfig} | 200, 404 |
| GET | /api/dispensers | JWT (admin) | — | [{id, name, areaId, userId}] | 200 |
| POST | /api/dispensers | JWT (admin) | {name, areaId} | {dispenserConfig} + auto-cria user dispenser | 201 |
| POST | /api/tickets | JWT (dispenser, reception) | {serviceId, areaId} | {id, number, status: 'waiting', createdAt} | 201, 400 |
| POST | /api/tickets/call-next | JWT (reception) | {areaId, stationId} | {ticket: {id, number, status: 'called', calledAt}} | 200, 404 (no tickets waiting) |
| PATCH | /api/tickets/:id/start | JWT (reception) | — | {ticket: {status: 'in_service', startedAt}} | 200, 404, 409 (wrong status) |
| PATCH | /api/tickets/:id/complete | JWT (reception) | — | {ticket: {status: 'completed', completedAt}} | 200, 404, 409 |
| PATCH | /api/tickets/:id/cancel | JWT (reception) | — | {ticket: {status: 'cancelled'}} | 200, 404 |
| GET | /api/tickets?areaId=X&status=waiting&date=Y | JWT (reception, management) | — | [{id, number, status, serviceId, createdAt}] | 200 |
| GET | /api/displays/:id/snapshot | JWT (display) | — | {currentInService, recentCalled: [last5], waitingCount, ads: []} | 200 |
| GET | /api/indicators?areaId=X&from=Y&to=Z | JWT (admin, management) | — | {issued, served, avgWaitMin, avgServiceMin, byService: [...]} | 200 |
| GET | /api/advertisements?areaId=X | JWT (management, display) | — | [{id, title, contentType, areaId, active, duration}] | 200 |
| POST | /api/advertisements | JWT (management) | {title, contentType, contentUrl?, contentText?, areaId?, durationSeconds?} | {ad} | 201 |
| PATCH | /api/advertisements/:id | JWT (management) | {...fields} | {ad} | 200, 404 |
| DELETE | /api/advertisements/:id | JWT (management) | — | {message} | 200, 404 |
| GET | /api/voice-config/:areaId | JWT (management, display) | — | {language, voiceName, speed} | 200 |
| PATCH | /api/voice-config/:areaId | JWT (management) | {language?, voiceName?, speed?} | {voiceConfig} | 200 |

### Socket.IO Events

| Event | Direction | Payload | Room |
|-------|-----------|---------|------|
| ticket:created | Server → Client | {ticket: {id, number, serviceId, areaId}} | area:{areaId} |
| ticket:called | Server → Client | {ticket: {id, number, stationId, stationName}, voiceText} | area:{areaId} |
| ticket:started | Server → Client | {ticketId, stationId} | area:{areaId} |
| ticket:completed | Server → Client | {ticketId} | area:{areaId} |
| ticket:cancelled | Server → Client | {ticketId} | area:{areaId} |
| queue:updated | Server → Client | {waitingCount, nextTickets: [next3]} | area:{areaId} |
| display:ad-update | Server → Client | {ads: [...]} | area:{areaId} |

### Component Props (key components)

**RoleGuard**: {allowedRoles: UserRole[], children: ReactNode, fallback?: ReactNode}
**QueuePanel** (recepção): {areaId: number, stationId: number, onCallNext: () => void, onStartService: (ticketId) => void, onCompleteService: (ticketId) => void}
**DisplayView** (display): {areaId: number, voiceConfig: VoiceConfig | null}
**TicketFormatForm**: {service: Service, onSave: (format) => void, onCancel: () => void}
**KPIDashboard** (gestão): {areaId: number | null, dateRange: {from, to}}
**AdManager** (gestão): {areaId: number | null}

## 7. Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ORM | Drizzle ORM | TypeScript-first, lightweight, zero runtime overhead. MySQL support nativo. Gera migrations tipadas. Prisma seria mais pesado e o codegen cria uma layer opaca; Sequelize é mais antigo e menos TS-friendly. **Trade-off:** Drizzle não tem migrations automáticas por diferença de schema (como Prisma), exige `drizzle-kit push` manual. |
| Real-time | Socket.IO | Rooms por área, auto-reconnect com backoff, fallback polling, namespace suporte. `ws` seria mais leve mas não tem rooms/reconnect nativos — essencial para on-premise onde a rede pode ser instável. **Trade-off:** Socket.IO adiciona ~30KB ao bundle client vs ws puro. |
| Auth | JWT + bcrypt | JWT para auth stateless (sem sessões no server); bcrypt (12 rounds) para hashing. Argon2 seria mais seguro mas requer native bindings — difícil em on-premise Windows/Linux sem compilador. **Trade-off:** JWT não revoga facilmente; mitigado com short expiry (15min) + refresh token (7d). |
| State Client | Zustand | API minimal (1 função para criar store), sem boilerplate, excelente TypeScript. Redux Toolkit seria mais estruturado mas 5x mais código para o mesmo resultado. React Context não escala para actualizações frequentes de fila. **Trade-off:** Zustand é menos "padronizado" que Redux — convenções de organização ficam ao projecto. |
| Framework UI | Chakra UI v3 | System-based, tokens CSS, composição, acessibilidade built-in. Ant Design seria mais "enterprise" mas menos customizável; MUI é popular mas gera bundles grandes. **Trade-off:** Chakra v3 é recente — alguns componentes ainda em beta; documentação menos extensa que MUI. |
| Daily Reset | node-cron (00:00) | Cron job dentro do processo Node — sem dependência externa. MySQL Event Scheduler seria alternativa mas requiere permissões DB e é menos transparente. **Trade-off:** Se o server reinicia após 00:00, o reset não corre até ao próximo dia — mitigado com verificação on-demand (se `DailySequence.date !== today`, cria novo registo na primeira emissão). |
| TTS | Browser Speech API + fallback eSpeak NG | Displays usam `window.speechSynthesis` (zero dependência, funciona em Chrome/Edge). Para browsers sem Speech API ou Linux kiosk, eSpeak NG instalado no server gera WAV via `child_process`. **Trade-off:** Browser Speech API qualidade varia por browser/OS; eSpeak NG soa robótico mas é 100% local e sem latência de cloud. |
| API Client | Axios | Interceptors para JWT refresh automático, retry, cancelação. fetch nativo seria mais leve mas não tem interceptors/retry built-in — teríamos de reimplementar. **Trade-off:** Axios adiciona ~13KB ao bundle. |
| Monorepo | server/ + client/ separados | Simplicidade — dois package.json, dois tsconfig, build separado. Turborepo/npm workspaces adicionaria complexidade de tooling sem beneficio para 2 packages. **Trade-off:** Sem shared types package — tipos duplicados manualmente entre server e client (ou importados via path relativo se necessário). |
| DB Dev | MySQL local (Docker ou instalado) | MySQL 8.x via Docker Compose em dev; instalado directamente em produção. SQLite não serve — a spec exige MySQL e transacções concorrentes em on-premise multi-user justificam MySQL. **Trade-off:** Docker em dev adiciona um step de setup; mitigado com docker-compose.yml pronto. |

## 8. Business Rules & Validation

| # | Rule | Validation | Error Handling |
|---|------|-----------|----------------|
| BR-01 | Root é criado automaticamente pelo seed — não pode ser eliminado, só pode alterar as suas próprias credenciais. | DELETE /api/users/:id → se role=root → 403 Forbidden. PATCH password → se userId !== req.user.id && role=root → 403. | 403 com mensagem "Root user cannot be deleted/modified by other users". |
| BR-02 | Administrador pode criar utilizadores de tipo: reception, management, display, dispenser. Não pode criar root ou admin. | POST /api/users → se role em ['root','admin'] → 403. | 403 com "Only root can create admin users". |
| BR-03 | Root pode criar administradores. | Permitido se req.user.role === 'root'. | — |
| BR-04 | Utilizadores de tipo reception, display, dispenser obrigam a areaId. Management e admin não requerem área. | POST/PATCH /api/users → se role em ['reception','display','dispenser'] e areaId null → 400. | 400 com "Area is required for reception/display/dispenser users". |
| BR-05 | Cada estação (Station) tem apenas 1 recepcionista associado. Um recepcionista pode estar em apenas 1 estação. | POST/PATCH stations → se receptionUserId já associado a outra station → 409. PATCH users → se stationId já ocupado por outro user → 409. | 409 com "Receptionist already assigned to station X". |
| BR-06 | Ticket format generation: numeric → `{sequence_number}` com zeros à esquerda (ex: 001, 002); alphanumeric → `{prefix}{sequence_number}` (ex: A001); custom → `{prefix}{sequence_number}` (ex: CONS001). | Service.ticketFormat + ticketPrefix + ticketDigitCount determinam o formato. sequence_number com zeros à esquerda conforme ticketDigitCount. | Se ticketPrefix missing para alphanumeric/custom → 400 "Prefix required for alphanumeric/custom format". |
| BR-07 | Sequence reset diário: DailySequence.last_number reinicia a 0 no início de cada novo dia (00:00). Senhas do dia anterior ficam com date=YYYY-MM-DD preservado para históricos. | node-cron corre às 00:00 → para cada Service, cria novo DailySequence com date=today, last_number=0. | Se o cron falha (server down), a emissão on-demand verifica: se não existe DailySequence para (serviceId, today) → cria automaticamente. |
| BR-08 | Chamar próxima senha: selecciona o Ticket mais antigo com status=waiting na área, ordenado por created_at ASC. Se nenhum ticket waiting → retorna 404. | POST /api/tickets/call-next → query: `SELECT * FROM tickets WHERE areaId=X AND status='waiting' AND date=today ORDER BY created_at ASC LIMIT 1`. | 404 com "No tickets waiting in this area". |
| BR-09 | Ticket state transitions são restrictas: waiting → called → in_service → completed. waiting → cancelled. called → no_show (timeout). Não permitido retroceder (called → waiting). | PATCH /api/tickets/:id/start → se ticket.status !== 'called' → 409. PATCH /api/tickets/:id/complete → se status !== 'in_service' → 409. | 409 com "Ticket status is {current}, expected {required}". |
| BR-10 | Apenas o recepcionista da estação pode chamar/concluir tickets da sua área. | JWT areaId + stationId verificados contra areaId e stationId do ticket. | 403 com "You are not authorized for this area/station". |
| BR-11 | Display recebe actualizações apenas da sua área associada. Socket.IO room = `area:{areaId}`. | Display joina room correspondente ao areaId do DisplayConfig. | Se display tenta joinar room diferente → server ignora join. |
| BR-12 | Anúncios com areaId=NULL são exibidos em todas as áreas. Anúncios com areaId específico apenas naquela área. | GET /api/displays/:id/snapshot → inclui ads WHERE (areaId=displayAreaId OR areaId IS NULL) AND active=true. | — |
| BR-13 | Senha number é imutável após emissão — não pode ser alterada. | PATCH /api/tickets/:id → campo number não está nos campos permitidos. | Se enviado → ignorado (não incluído no update). |
| BR-14 | Impressão de senhas é responsabilidade do dispensador Android — a API REST apenas retorna os dados da senha emitida. | POST /api/tickets retorna {number, serviceId, areaId, createdAt} — sem PDF ou print logic. | — |
| BR-15 | Um utilizador display/dispenser é auto-criado quando se cria o DisplayConfig/DispenserConfig. Username e password gerados automaticamente. | POST /api/displays → cria User com role='display', username=`display_{areaName}_{timestamp}`, password=random(8chars). Retorna credenciais na response. | — |
| BR-16 | No_show: se um ticket called não transiciona para in_service em 15 minutos, o recepcionista pode marcar como no_show. | PATCH /api/tickets/:id/no-show → se status !== 'called' → 409; se called_at + 15min > now → permitido (mas também permitido antes como opção manual). | 409 se status inválido. |

## 9. Quality Attributes

| Attribute | Target | Implementation |
|-----------|--------|----------------|
| Performance — API response | < 200ms para 95% dos endpoints CRUD | Drizzle queries optimizadas (select com índices em area_id, status, date). Connection pooling MySQL (max 10). |
| Performance — Ticket emission | < 100ms para gerar e persistir uma senha | Transaction MySQL: SELECT last_number → UPDATE increment → INSERT ticket — tudo numa transaction isolation READ_COMMITTED. |
| Performance — WebSocket latency | < 500ms entre chamada e exibição no display | Socket.IO broadcast directo para room; sem intermediate queue. Payload < 1KB por evento. |
| Reliability — Auto-reconnect | Display reconecta em < 30s após perda de ligação | Socket.IO client: reconnect attempts=10, delay=5s. Snapshot API como fallback para restaurar estado após reconnect. |
| Reliability — Daily Reset | Sequências reiniciadas sem falha às 00:00 | node-cron + fallback on-demand (BR-07). Logs de reset para auditoria. |
| Reliability — Concurrent tickets | 2+ dispensadores emitindo senhas do mesmo serviço sem duplicar números | MySQL transaction com row-level lock em DailySequence: `SELECT last_number FOR UPDATE` → increment → `UPDATE`. |
| Security — Password storage | bcrypt 12 rounds, nunca plaintext | Hash no AuthService, nunca exposto em API responses. |
| Security — JWT expiry | Access token 15min, Refresh token 7d | Axios interceptor renova access token automaticamente via /api/auth/refresh. |
| Security — RBAC enforcement | Nenhum utilizador acede a funcionalidades fora do seu perfil | Middleware `requireRole(roles[])` em cada route. RoleGuard component no frontend. |
| Security — SQL injection | Zero vulnerabilidades | Drizzle ORM queries parametrizadas — nunca SQL string concatenation. |
| Usability — Display fullscreen | Display opera sem necessidade de interacção após login inicial | Login → auto-redirect → fullscreen mode → Socket.IO updates continuos. Refresh token renova automaticamente. |
| Usability — Reception call-next | 1 click para chamar próxima senha | Botão "Chamar Próxima" sempre visível. Confirmação visual (toast) após chamada. Sem modals de confirmação para operações frequentes. |
| Accessibility — WCAG 2.1 AA | Contraste mínimo 4.5:1, focus visible, screen reader labels | Chakra UI v3 built-in ARIA support. Labels em todos os inputs. Dialog focus trap. |
| Observability — Server logs | Estrutura: timestamp, level, module, message, metadata | Winston logger: console em dev, file rotation em prod (7d retention). Logs de ticket lifecycle (emit, call, start, complete). |

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| R-01: Rede local instável (Wi-Fi na clínica) — displays perdem ligação WebSocket frequentemente | Medium | High — utentes não vêem chamadas | Socket.IO auto-reconnect com backoff + Snapshot API para restaurar estado. Displays com cache local das últimas 5 chamadas (localStorage). |
| R-02: Server downtime durante horário de atendimento — senhas não podem ser emitidas | Low | Critical — atendimento parado | Healthcheck endpoint. Monitor processo com PM2 (restart automático on crash). Recomenda UPS para server + router. |
| R-03: Concurrent ticket emission — 2 dispensadores emitem senhas do mesmo serviço ao mesmo tempo | Medium | High — números duplicados ou saltados | MySQL row-level lock (FOR UPDATE) em DailySequence. Transaction isolation READ_COMMITTED. Teste de concorrência com 5+ requests simultâneos. |
| R-04: TTS qualidade/compatibilidade — Browser Speech API não funciona em kiosk Linux ou browsers antigos | Medium | Medium — chamadas sem voz | Dual approach: Browser Speech API (primary) + eSpeak NG server-side (fallback). Config VoiceConfig por área para ajustar language/speed. |
| R-05: Chakra UI v3 instabilidade — componentes beta ou breaking changes entre minor versions | Low | Medium — UI bugs em produção | Pin Chakra UI version em package.json. Teste visual manual antes de upgrade. Usar componentes stable apenas (Dialog, Tabs, Table, Button, Field). |
| R-06: MySQL não instalado/configurado correctamente on-premise | Medium | High — app não arranca | Docker Compose com MySQL pre-configurado para dev/prod. Script de setup automático. Documentação de instalação step-by-step. |
| R-07: Root seed credentials expostas — username/password padrão 'root/root@123' | High | High — acesso não autorizado | Seed script força alteração de password no primeiro login (UX: modal "Alterar senha antes de continuar"). Documentação alerta sobre segurança inicial. |
| R-08: Impressão no dispensador Android — API não controla impressão, app nativa pode falhar | Medium | Medium — utente sem senha impressa | API retorna dados completos da senha (number, service, area, time). App Android deve confirmar impressão antes de fechar fluxo. Se impressão falha, utente pode re-solicitar via `GET /api/tickets/:id/print-data`. |

## 11. UI/UX Design

### Layout Overview

O sistema apresenta interfaces distintas por perfil de utilizador. Após autenticação, o router redireciona para a view correspondente ao role. Não existe vista "genérica" — cada role tem layout e funcionalidades próprias.

### Design Tokens (Chakra UI v3)

- **Primary accent:** teal.600 (#0D9488) — usado para CTAs (Chamar Próxima, Emitir Senha), links, progress indicators
- **Neutral palette:** gray scale (50–900) — backgrounds, text, borders
- **Success:** green.500 — status completed, indicators positivos
- **Warning:** orange.500 — status waiting, tempos acima do limite
- **Error:** red.500 — status cancelled/no_show, alertas
- **Font:** system-ui (Chakra default) — Inter ou similar se disponível via CDN
- **Heading sizes:** h1=2xl (24px), h2=xl (20px), h3=lg (18px) — escala reduzida para densidade operacional
- **Spacing base:** 4px (Chakra spacing unit) — gap=3 (12px) entre cards, gap=2 (8px) entre items inline

### Screens by Role

**Root — Painel de Administração**
- Layout: AppShell simples (sidebar minimal com: Administradores, Minha Conta). Header: "Clínica Katondo — Root".
- Vista: Lista de administradores (Table com columns: Username, Role, Active, Created). Criar admin via Dialog modal com fields: username, password. Alterar própria senha via Dialog separado.
- Empty state: "Nenhum administrador criado — clique + para adicionar o primeiro administrador."
- Primary action: Botão "+ Administrador" no header.

**Administrador — Dashboard Operacional**
- Layout: AppShell com sidebar (Utilizadores, Áreas, Serviços, Estações, Displays, Dispensadores, Indicadores, Minha Conta). Header: username + role badge.
- Vista principal: Overview com 4 stat cards (Senhas Emitidas Hoje, Senhas Atendidas, Tempo Médio Espera, Senhas em Fila).
- Cada secção: CRUD Table + Dialog create/edit + confirmação Dialog para delete. Filtros por área quando aplicável.

**Recepção — Painel de Fila**
- Layout: Full-width sem sidebar. Header minimal com: nome estação + área badge. Área principal: fila à esquerda, painel actual à direita.
- Painel actual (lado direito, 60% width): Senha em atendimento (card large com número + estação), próxima senha (card medium), botões: "Chamar Próxima" (CTA teal, sempre visível), "Iniciar Atendimento", "Concluir Atendimento" (ordenados por estado do ticket actual).
- Fila (lado esquerdo, 40% width): Lista de senhas waiting (scrollable, max 10 visíveis, load more se >10). Cada item: número + serviço + tempo de espera.
- Empty state fila: "Nenhuma senha em fila — aguardando novos utentes."
- Toast confirmação: "Senha CONS001 chamada → Consulta 3" após call-next.

**Gestão — Dashboard KPIs**
- Layout: AppShell com sidebar (Dashboard, Anúncios, Config. Senha, Config. Voz, Minha Conta).
- Dashboard: DateRangePicker + área selector (seleciona área ou "Todas"). Cards de KPIs (4 stat + 1 trend chart). Table com breakdown por serviço.
- Anúncios: CRUD Table + Dialog. Content type tabs (Imagem | Vídeo | Texto). Upload de media (file upload → server storage local).
- Config. Senha: Lista de serviços com formato actual. Edit formato via Dialog (3 tabs: Numeric | Alphanumeric | Custom com preview live).
- Config. Voz: Card com dropdowns (language, voice) + slider (speed) + botão "Testar Voz" que sintetiza sample.

**Display — Vista Pública (fullscreen)**
- Layout: Zero chrome. Fullscreen kiosk mode. No sidebar, no header, no navigation.
- Secções:
  - Top (40% height): Senha actualmente em atendimento (card large, número + estação, animação pulse quando nova chamada).
  - Middle (30% height): Últimas 3–5 senhas chamadas (cards medium,排列 horizontal ou vertical dependendo do espaço).
  - Bottom (30% height): Anúncios (carousel com duration_seconds por ad). Se sem anúncios → mensagem "Bem-vindo à Clínica Katondo".
  - Footer bar: Data + hora + nome da área (small text).
- Voice announcement: `window.speechSynthesis.speak()` com texto "Senha {number}, dirija-se à {stationName}". Repete 1x após 3s.
- Empty state: "Nenhuma senha em atendimento — aguardando chamadas."

**Login — Página Comum**
- Layout: Centered card (max-width 400px) em página com background neutro. Logo clínica no topo.
- Fields: Username (Field input), Password (PasswordInput). Botão "Entrar" (full-width, teal accent).
- Error: "Credenciais inválidas" em red text abaixo do formulário.
- Root first-login: após autenticação root, se password ainda é default → modal obrigatório "Altere a sua senha antes de continuar".

### Mobile Responsiveness

- Recepção: Em mobile (<768px), layout muda para stack vertical — fila em cima (collapsible), painel actual em baixo com botões full-width.
- Gestão/Admin: Sidebar collapses para drawer em mobile. Tables adaptam para SimpleGrid cards.
- Display: Não necessita mobile — sempre fullscreen em monitor/kiosk. Se viewport <1280px, reduz card sizes mas mantém layout.

## 12. File Structure

```
katondo-queue/
├── docker-compose.yml              # MySQL + app containers (dev/prod)
├── .env.example                    # Environment variable template
├── .gitignore                      # Node, dist, .env, uploads
├── package.json                    # Root — scripts: dev, build, start, seed
├── PLAN.md                         # This document
│
├── server/
│   ├── package.json                # Express + Drizzle + Socket.IO + deps
│   ├── tsconfig.json               # Server TypeScript config
│   ├── drizzle.config.ts           # Drizzle Kit config (MySQL)
│   ├── src/
│   │   ├── index.ts                # Express + Socket.IO server entry
│   │   ├── config/
│   │   │   └── env.ts              # Environment variables parser
│   │   ├── db/
│   │   │   ├── connection.ts       # MySQL connection (Drizzle)
│   │   │   ├── schema.ts           # All Drizzle table definitions
│   │   │   └── seed.ts             # Root user + initial data seeding
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT verification middleware
│   │   │   ├── roles.ts            # Role-based access guard (requireRole)
│   │   │   └── validation.ts       # Request validation (Zod schemas)
│   │   ├── routes/
│   │   │   ├── auth.ts             # POST login, refresh, logout
│   │   │   ├── users.ts            # CRUD users + password change
│   │   │   ├── areas.ts            # CRUD areas
│   │   │   ├── services.ts         # CRUD services + ticket format
│   │   │   ├── stations.ts         # CRUD stations
│   │   │   ├── displays.ts         # CRUD displays + snapshot endpoint
│   │   │   ├── dispensers.ts       # CRUD dispensers
│   │   │   ├── tickets.ts          # Emit, call-next, start, complete, cancel
│   │   │   ├── indicators.ts       # KPI endpoints
│   │   │   ├── advertisements.ts   # CRUD ads
│   │   │   ├── voice-config.ts     # Voice config per area
│   │   │   └── dispenser-api.ts    # Public API for Android dispenser app
│   │   ├── services/
│   │   │   ├── auth.service.ts     # Login, JWT generation, bcrypt
│   │   │   ├── ticket.service.ts   # Emit, call, transition logic + sequence
│   │   │   ├── area.service.ts     # Area CRUD
│   │   │   ├── service.service.ts  # Service CRUD + format validation
│   │   │   ├── user.service.ts     # User CRUD + role validation
│   │   │   ├── station.service.ts  # Station CRUD + assignment logic
│   │   │   ├── display.service.ts  # Display CRUD + snapshot generation
│   │   │   ├── dispenser.service.ts # Dispenser CRUD + auto-user creation
│   │   │   ├── indicator.service.ts # KPI calculation (aggregation queries)
│   │   │   ├── daily-reset.service.ts # Cron job + on-demand reset
│   │   │   ├── ad.service.ts       # Ad CRUD + scheduling
│   │   │   ├── tts.service.ts      # Voice synthesis logic
│   │   │   └── logger.service.ts   # Winston logger setup
│   │   ├── socket/
│   │   │   ├── handler.ts          # Socket.IO connection/disconnection events
│   │   │   ├── rooms.ts            # Room join/leave logic per area
│   │   │   └── events.ts           # Event types and payload definitions
│   │   ├── utils/
│   │   │   ├── ticket-format.ts    # Number formatting (numeric, alpha, custom)
│   │   │   ├── date.ts             # Date helpers (today, isSameDay, etc.)
│   │   │   └── errors.ts           # Custom error classes (AppError, NotFoundError, etc.)
│   │   └── types/
│   │       └── index.ts            # Shared TypeScript types (UserRole, TicketStatus, etc.)
│   └── migrations/                 # Drizzle-generated SQL migrations
│       └── 0001_initial.sql        # First migration — all tables
│
├── client/
│   ├── package.json                # React + Vite + Chakra UI + deps
│   ├── tsconfig.json               # Client TypeScript config
│   ├── vite.config.ts              # Vite config (proxy /api → server)
│   ├── index.html                  # Vite entry HTML
│   ├── src/
│   │   ├── main.tsx                # React entry + Chakra Provider + Router
│   │   ├── App.tsx                 # Route definitions + RoleGuard
│   │   ├── theme/
│   │   │   └── system.ts           # Chakra UI v3 system config (custom tokens)
│   │   ├── auth/
│   │   │   ├── context.tsx         # Auth context + provider (JWT, role, areaId)
│   │   │   ├── login.tsx           # Login page (centered card)
│   │   │   ├── role-guard.tsx      # RoleGuard component (allowedRoles, fallback)
│   │   │   └── first-login-modal.tsx # Force password change modal for root
│   │   ├── hooks/
│   │   │   ├── useSocket.ts        # Socket.IO connection + room subscription
│   │   │   ├── useAuth.ts          # Auth state hook (user, role, login, logout)
│   │   │   └── useQueue.ts         # Queue state hook (currentTicket, next, call)
│   │   ├── api/
│   │   │   ├── client.ts           # Axios instance + interceptors (JWT refresh)
│   │   │   ├── auth.ts             # Auth API calls
│   │   │   ├── users.ts            # Users API calls
│   │   │   ├── areas.ts            # Areas API calls
│   │   │   ├── services.ts         # Services API calls
│   │   │   ├── stations.ts         # Stations API calls
│   │   │   ├── displays.ts         # Displays API calls
│   │   │   ├── dispensers.ts       # Dispensers API calls
│   │   │   ├── tickets.ts          # Tickets API calls
│   │   │   ├── indicators.ts       # Indicators API calls
│   │   │   ├── advertisements.ts   # Ads API calls
│   │   │   └── voice-config.ts     # Voice config API calls
│   │   ├── store/
│   │   │   ├── auth-store.ts       # Zustand: user, token, role, areaId
│   │   │   ├── queue-store.ts      # Zustand: currentTicket, nextTickets, waiting
│   │   │   └ notification-store.ts # Zustand: toast notifications
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── app-shell.tsx   # Sidebar + header shell (admin, management)
│   │   │   │   ├── sidebar.tsx     # Navigation sidebar per role
│   │   │   │   ├── header.tsx      # Top header with user info + logout
│   │   │   ├── common/
│   │   │   │   ├── stat-card.tsx   # KPI stat display card
│   │   │   │   ├── crud-table.tsx  # Generic CRUD table component
│   │   │   │   ├── confirm-dialog.tsx # Delete confirmation Dialog
│   │   │   │   ├── empty-state.tsx # Empty state with icon + CTA
│   │   │   │   ├── role-badge.tsx  # User role badge component
│   │   │   │   ├── area-select.tsx # Area dropdown selector
│   │   │   ├── queue/
│   │   │   │   ├── current-ticket-card.tsx # Large card for ticket in service
│   │   │   │   ├── next-ticket-card.tsx # Next ticket preview card
│   │   │   │   ├── waiting-list.tsx # Scrollable waiting tickets list
│   │   │   │   ├── queue-actions.tsx # Call next / start / complete buttons
│   │   │   ├── display/
│   │   │   │   ├── called-ticket-display.tsx # Fullscreen called ticket view
│   │   │   │   ├── recent-calls-row.tsx # Row of recent called tickets
│   │   │   │   ├── ad-carousel.tsx # Advertisement carousel
│   │   │   │   ├── voice-announcement.tsx # TTS voice playback logic
│   │   │   │   ├── display-footer.tsx # Date/time/area footer
│   │   ├── pages/
│   │   │   ├── root/
│   │   │   │   ├── admin-management.tsx # Root: manage administrators
│   │   │   │   ├── my-account.tsx # Root: change own password
│   │   │   ├── admin/
│   │   │   │   ├── dashboard.tsx # Admin overview with stat cards
│   │   │   │   ├── user-management.tsx # Admin: CRUD all user types
│   │   │   │   ├── area-management.tsx # Admin: CRUD areas + services tree
│   │   │   │   ├── service-management.tsx # Admin: CRUD services + format config
│   │   │   │   ├── station-management.tsx # Admin: CRUD stations
│   │   │   │   ├── display-management.tsx # Admin: CRUD displays
│   │   │   │   ├── dispenser-management.tsx # Admin: CRUD dispensers
│   │   │   │   ├── indicators.tsx # Admin: KPI dashboard
│   │   │   ├── reception/
│   │   │   │   ├── queue-panel.tsx # Reception: full queue management view
│   │   │   ├── management/
│   │   │   │   ├── dashboard.tsx # Management: KPI dashboard with charts
│   │   │   │   ├── ad-management.tsx # Management: CRUD advertisements
│   │   │   │   ├── ticket-format-config.tsx # Management: ticket format per service
│   │   │   │   ├── voice-config.tsx # Management: voice/TTS configuration
│   │   │   ├── display/
│   │   │   │   ├── display-view.tsx # Display: fullscreen kiosk view
│   │   ├── types/
│   │   │   ├── index.ts            # Client-side TypeScript types
│   │   │   └ socket-events.ts     # Socket.IO event type definitions
│   └ assets/
│   │   └ logo.svg                 # Clínica Katondo logo
│   │   └ favicon.ico              # Browser favicon
│   └ public/
│       └ uploads/                  # Local file uploads (ads media, dev only)
│
└── README.md                        # Setup instructions + project overview
```

## 13. Implementation Phases

### Phase 1 — Autenticação e Gestão de Utilizadores
**Deliverable:** Root e Administradores podem autenticar-se e gerir utilizadores de todos os tipos. RBAC implementado no backend e frontend.

| Task | Description | Files |
|------|-------------|-------|
| T1.01 | Setup monorepo: package.json root, server/package.json, client/package.json, tsconfigs, .gitignore, .env.example, docker-compose.yml (MySQL) | Root config files |
| T1.02 | Setup Express server: index.ts, config/env.ts, middleware structure, Winston logger | server/src/index.ts, config/env.ts |
| T1.03 | Setup Drizzle: db/connection.ts, db/schema.ts (User table only initially), drizzle.config.ts, run first migration | server/src/db/*, drizzle.config.ts |
| T1.04 | Seed script: db/seed.ts — creates root user (username: root, password: root@123 hashed) | server/src/db/seed.ts |
| T1.05 | Auth service + routes: auth.service.ts (bcrypt, JWT), routes/auth.ts (login, refresh, logout), middleware/auth.ts, middleware/roles.ts | server/src/services/auth.service.ts, routes/auth.ts, middleware/* |
| T1.06 | User service + routes: user.service.ts, routes/users.ts (CRUD + password change), validation schemas | server/src/services/user.service.ts, routes/users.ts |
| T1.07 | Setup Vite client: vite.config.ts (proxy /api), main.tsx (Chakra Provider), theme/system.ts | client/src/main.tsx, theme/system.ts, vite.config.ts |
| T1.08 | Auth store + API client: api/client.ts (Axios + interceptors), store/auth-store.ts, auth/context.tsx | client/src/api/client.ts, store/*, auth/context.tsx |
| T1.09 | Login page: auth/login.tsx (centered card, username/password, error handling) | client/src/auth/login.tsx |
| T1.10 | First-login modal: auth/first-login-modal.tsx (forces root password change) | client/src/auth/first-login-modal.tsx |
| T1.11 | RoleGuard component: auth/role-guard.tsx (allowedRoles, fallback redirect) | client/src/auth/role-guard.tsx |
| T1.12 | AppShell layout: components/layout/app-shell.tsx, sidebar.tsx, header.tsx | client/src/components/layout/* |
| T1.13 | Root pages: pages/root/admin-management.tsx, pages/root/my-account.tsx | client/src/pages/root/* |
| T1.14 | Admin user management: pages/admin/user-management.tsx, crud-table.tsx, confirm-dialog.tsx | client/src/pages/admin/user-management.tsx, components/common/* |
| T1.15 | App router: App.tsx (role-based redirects, protected routes) | client/src/App.tsx |

**Verification:** Login com root → redirect to admin panel → criar administrador → login como administrador → criar utilizadores de cada tipo (reception, management, display, dispenser) → cada tipo autentica-se e é redirecionado para a sua view (placeholder pages).

---

### Phase 2 — Configuração Organizacional (Áreas, Serviços, Senhas, Estações)
**Deliverable:** Administradores e Gestão podem criar áreas, serviços com formato de senha, estações, displays e dispensadores.

| Task | Description | Files |
|------|-------------|-------|
| T2.01 | Drizzle schema: Area, Service, Station, DisplayConfig, DispenserConfig, VoiceConfig tables | server/src/db/schema.ts |
| T2.02 | Run migration: Add new tables to database | server/migrations/ |
| T2.03 | Area service + routes: area.service.ts, routes/areas.ts (CRUD) | server/src/services/area.service.ts, routes/areas.ts |
| T2.04 | Service service + routes: service.service.ts, routes/services.ts (CRUD + ticket format config) | server/src/services/service.service.ts, routes/services.ts |
| T2.05 | Station service + routes: station.service.ts, routes/stations.ts (CRUD + receptionist assignment) | server/src/services/station.service.ts, routes/stations.ts |
| T2.06 | Display service + routes: display.service.ts, routes/displays.ts (CRUD + auto-create display user) | server/src/services/display.service.ts, routes/displays.ts |
| T2.07 | Dispenser service + routes: dispenser.service.ts, routes/dispensers.ts (CRUD + auto-create dispenser user) | server/src/services/dispenser.service.ts, routes/dispensers.ts |
| T2.08 | Ticket format utility: utils/ticket-format.ts (format number generation logic) | server/src/utils/ticket-format.ts |
| T2.09 | Area API + pages: api/areas.ts, pages/admin/area-management.tsx, area-select.tsx | client/src/api/areas.ts, pages/admin/area-management.tsx |
| T2.10 | Service API + pages: api/services.ts, pages/admin/service-management.tsx, pages/management/ticket-format-config.tsx | client/src/api/services.ts, pages/admin/*, pages/management/ticket-format-config.tsx |
| T2.11 | Station API + pages: api/stations.ts, pages/admin/station-management.tsx | client/src/api/stations.ts, pages/admin/station-management.tsx |
| T2.12 | Display API + pages: api/displays.ts, pages/admin/display-management.tsx | client/src/api/displays.ts, pages/admin/display-management.tsx |
| T2.13 | Dispenser API + pages: api/dispensers.ts, pages/admin/dispenser-management.tsx | client/src/api/dispensers.ts, pages/admin/dispenser-management.tsx |
| T2.14 | Voice config API + pages: api/voice-config.ts, routes/voice-config.ts, pages/management/voice-config.tsx | server/src/routes/voice-config.ts, client/src/* |

**Verification:** Admin cria área "Consultas" → cria serviços "Consulta Geral", "Pediatria", "Ginecologia" com formatos numeric/alphanumeric/custom → cria estações → cria displays e dispensadores → verifica que users display/dispenser foram auto-criados com credenciais geradas.

---

### Phase 3 — Emissão e Gestão de Filas
**Deliverable:** Dispensadores emitem senhas via API. Recepção chama, inicia e conclui atendimentos. Socket.IO broadcasta actualizações em tempo real. Sequências reiniciam diariamente.

| Task | Description | Files |
|------|-------------|-------|
| T3.01 | Drizzle schema: DailySequence, Ticket tables | server/src/db/schema.ts |
| T3.02 | Run migration: Add ticket-related tables | server/migrations/ |
| T3.03 | Ticket service: ticket.service.ts (emit with sequence increment in transaction, call-next, start, complete, cancel, no-show) | server/src/services/ticket.service.ts |
| T3.04 | Ticket routes: routes/tickets.ts (all endpoints from §6) | server/src/routes/tickets.ts |
| T3.05 | Dispenser API route: routes/dispenser-api.ts (POST /api/tickets for Android app) | server/src/routes/dispenser-api.ts |
| T3.06 | Daily reset service: daily-reset.service.ts (node-cron 00:00 + on-demand fallback) | server/src/services/daily-reset.service.ts |
| T3.07 | Socket.IO setup: socket/handler.ts, socket/rooms.ts, socket/events.ts — integrate in index.ts | server/src/socket/*, server/src/index.ts |
| T3.08 | Date utility: utils/date.ts (today helpers, isSameDay, format for DB) | server/src/utils/date.ts |
| T3.09 | Queue store: store/queue-store.ts (Socket.IO subscription, currentTicket, waitingCount) | client/src/store/queue-store.ts |
| T3.10 | Socket hook: hooks/useSocket.ts (connect, join area room, listen events) | client/src/hooks/useSocket.ts |
| T3.11 | Queue hook: hooks/useQueue.ts (call-next, start, complete actions + state) | client/src/hooks/useQueue.ts |
| T3.12 | Queue components: components/queue/current-ticket-card.tsx, next-ticket-card.tsx, waiting-list.tsx, queue-actions.tsx | client/src/components/queue/* |
| T3.13 | Reception page: pages/reception/queue-panel.tsx (full layout with queue + actions) | client/src/pages/reception/queue-panel.tsx |
| T3.14 | Notification store + toast: store/notification-store.ts, Chakra Toaster setup | client/src/store/notification-store.ts |
| T3.15 | Ticket API client: api/tickets.ts (all ticket API calls) | client/src/api/tickets.ts |
| T3.16 | Error classes: utils/errors.ts (AppError, NotFoundError, ConflictError) | server/src/utils/errors.ts |

**Verification:** Dispensador (simulado via curl) emite senhas → recepção vê fila → chama próxima → status transitions (waiting→called→in_service→completed) → Socket.IO events broadcast → 00:00 cron reset verifica-se (ou manual trigger). Teste concorrência: 5 POST /api/tickets simultâneos sem duplicar números.

---

### Phase 4 — Displays e Anúncios
**Deliverable:** Displays mostram senhas chamadas, anúncios multimédia, e reproduzem voz. Gestão configura anúncios por área ou global.

| Task | Description | Files |
|------|-------------|-------|
| T4.01 | Drizzle schema: Advertisement table | server/src/db/schema.ts |
| T4.02 | Run migration: Add advertisement table | server/migrations/ |
| T4.03 | Ad service + routes: ad.service.ts, routes/advertisements.ts (CRUD + scheduling) | server/src/services/ad.service.ts, routes/advertisements.ts |
| T4.04 | Display snapshot endpoint: routes/displays.ts — GET /api/displays/:id/snapshot (currentInService, recentCalled, waitingCount, ads) | server/src/routes/displays.ts |
| T4.05 | TTS service: tts.service.ts (voice text generation per area config, Browser Speech API integration) | server/src/services/tts.service.ts |
| T4.06 | Socket.IO: broadcast display:ad-update when ads change in area | server/src/socket/handler.ts |
| T4.07 | Display components: components/display/called-ticket-display.tsx, recent-calls-row.tsx, ad-carousel.tsx, voice-announcement.tsx, display-footer.tsx | client/src/components/display/* |
| T4.08 | Display page: pages/display/display-view.tsx (fullscreen, zero chrome, auto-reconnect, voice playback) | client/src/pages/display/display-view.tsx |
| T4.09 | Ad API + management page: api/advertisements.ts, pages/management/ad-management.tsx | client/src/api/advertisements.ts, pages/management/ad-management.tsx |
| T4.10 | Snapshot API client: api/displays.ts (snapshot endpoint) | client/src/api/displays.ts |
| T4.11 | File upload handling: server-side local file storage for ad media (static /uploads directory) | server/src/index.ts (static middleware) |

**Verification:** Display autentica-se → entra em fullscreen → mostra senhas chamadas em tempo real → anúncios carousel alternam → voz sintetiza chamada → perde ligação → reconecta → restaura via snapshot → gestão cria anúncio (imagem e texto) → aparece no display da área associada.

---

### Phase 5 — Indicadores e Relatórios
**Deliverable:** Gestão e Admin visualizam KPIs diários e históricos. Dados anteriores ao reinício diário permanecem acessíveis.

| Task | Description | Files |
|------|-------------|-------|
| T5.01 | Indicator service: indicator.service.ts (aggregate queries: issued, served, avgWait, avgService per area/service/day) | server/src/services/indicator.service.ts |
| T5.02 | Indicator routes: routes/indicators.ts (GET with date range + area filter) | server/src/routes/indicators.ts |
| T5.03 | Indicator API client: api/indicators.ts | client/src/api/indicators.ts |
| T5.04 | KPI dashboard page: pages/admin/indicators.tsx, pages/management/dashboard.tsx (stat cards + service breakdown table) | client/src/pages/admin/indicators.tsx, pages/management/dashboard.tsx |
| T5.05 | Stat card component: components/common/stat-card.tsx (icon + value + label + trend) | client/src/components/common/stat-card.tsx |
| T5.06 | Date range picker: component for filtering indicators by date range | client/src/components/common/date-range-picker.tsx |
| T5.07 | Admin dashboard overview: pages/admin/dashboard.tsx (4 stat cards overview for today) | client/src/pages/admin/dashboard.tsx |
| T5.08 | Historical data preservation: verify daily reset keeps old tickets with correct date field for queries | — (test validation) |

**Verification:** Após 1+ dias de operação simulada → gestão visualiza KPIs (senhas emitidas, atendidas, tempo médio) por dia e área → filtro por intervalo de datas → dados do dia anterior permanecem acessíveis após reinício.

## 14. Open Questions

| # | Question | Impact | Suggested Resolution |
|---|----------|--------|---------------------|
| OQ-01 | A app Android nativa (dispensador) precisa de qual protocolo de impressão? Bluetooth, USB, ou network printer? Isto afecta o design da API response (incluir dados formatados para impressão vs dados raw). | Medium — API response shape | Documentar formato de response genérico (number, service, area, time) e deixar a app Android decidir o formato de impressão. Se necessário, adicionar endpoint `/api/tickets/:id/print-data` com formato customizado por dispensador config. |
| OQ-02 | Quantos displays simultâneos por área? Se >1 display na mesma área, todos mostram o mesmo conteúdo ou cada display pode ter configuração diferente? | Low — Socket.IO room logic | Assumir que todos os displays da mesma área mostram o mesmo conteúdo (room por área). Se necessidade de displays diferenciados surge, adicionar `display_config.content_mode` field. |
| OQ-03 | Voz TTS — qual language/locale padrão? Português (pt-PT) ou português angolano? A disponibilidade de voices no browser depende do locale. | Medium — TTS quality | Default: 'pt-PT' (mais voices disponíveis em browsers). VoiceConfig permite alterar para qualquer locale. Se 'pt-AO' não disponível no browser, fallback para 'pt-PT'. |
| OQ-04 | Necessidade de prioridade nas senhas? (ex: utentes prioritários — idosos, urgências). Isto afecta a lógica de call-next (queue ordering). | High — queue logic | Não incluído no spec atual. Se necessário futuro, adicionar `Ticket.priority` field (enum: normal, priority) e modificar call-next para ordenar por priority DESC, created_at ASC. |
| OQ-05 | O que acontece se o recepcionista chama uma senha e o utente não aparece? Timeout automático ou marcação manual de no_show? | Medium — UX flow | BR-16 define no_show manual após 15 minutos. Timeout automático não incluído (risk de marcar utentes que demoram a chegar). Se necessário, adicionar cron job que verifica tickets called > X minutos e sugere no_show. |
| OQ-06 | Backup da base de dados on-premise — responsabilidade do sistema ou do administrador IT da clínica? | Low — operational | Assumir que backup MySQL é responsabilidade IT externa. Documentar `mysqldump` cron recomendado em README. Sistema não gere backups automáticos. |
| OQ-07 | O display deve suportar múltiplos monitores (ex: TV principal + TV secundária na mesma sala)? | Low — hardware | Cada display config = 1 browser tab/window. Para múltiplos monitores, criar múltiplos DisplayConfig na mesma área. Cada browser instance corre independentemente. |