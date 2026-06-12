# Clínica Katondo — Gestão de Filas (TMS)

> Sistema de gestão de filas para a Clínica General Katondo (Luanda, Angola). 
> Multi-perfil: root, admin, recepção, gestão, display, dispensador.

## Project Context

### What this is
Aplicação fullstack para gestão de filas de espera numa clínica médica. Utentes retiram senhas via dispensador (tablet Android), recepcionistas chamam da fila, displays públicos mostram a senha actual com chamada por voz (TTS), e gestores consultam indicadores.

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Chakra UI v3 + Zustand + Socket.IO Client |
| Backend | Express + Drizzle ORM + MySQL 9 + Socket.IO + node-cron |
| Auth | JWT (access + refresh tokens) + bcryptjs |
| Android Display | Kotlin + WebView + TTS Bridge (nativo) |

### Brand Identity
- **Name**: Clínica General Katondo
- **Location**: Talatona, Luanda, Angola
- **Sector**: Saúde / Clínica médica
- **Hours**: 24h/dia, 7 dias/semana
- **Contact**: +244 923 168 644
- **Brand colors**: Azul médico (#1565C0) + verde saúde (#2E7D32) — derived from healthcare trust/care associations
- **Font**: Geist Sans (body), DM Serif Display (headings)

### Environment
```
# Server
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=katondo_queue
JWT_SECRET=<change-in-production>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=development

# Client
VITE_SOCKET_URL=http://localhost:3001
```

## Architecture

### Backend Routes (`/api/*`)
| Route | Auth | Description |
|-------|------|-------------|
| `POST /auth/login` | — | Login com username/password |
| `POST /auth/refresh` | — | Refresh token |
| `POST /auth/logout` | JWT | Logout |
| `POST /auth/change-password` | JWT | Alterar senha própria |
| `GET /settings/server-url` | — | URL do servidor (para Android wrapper) |
| `GET /settings` | root | Todas as configurações do sistema |
| `PUT /settings` | root | Atualizar configuração |
| `GET/POST/PATCH/DELETE /users` | root, admin | CRUD utilizadores |
| `PATCH /users/:id/password` | self/root/admin | Reset password |
| `GET/POST/PATCH/DELETE /areas` | admin, mgmt | CRUD áreas |
| `GET/POST/PATCH/DELETE /services` | admin, mgmt | CRUD serviços + formato senha |
| `GET/POST/PATCH/DELETE /stations` | admin | CRUD estações de recepção |
| `GET/POST/PATCH/DELETE /displays` | admin | CRUD displays (auto-cria credenciais) |
| `GET/POST/PATCH/DELETE /dispensers` | admin | CRUD dispensadores (auto-cria credenciais) |
| `GET/PATCH /voice-config/:areaId` | mgmt, display | Config TTS por área |
| `GET/POST/PATCH/DELETE /advertisements` | mgmt | CRUD anúncios para displays |
| `GET /indicators/today` | admin, mgmt | KPIs do dia |
| `GET /indicators/today/by-service` | admin, mgmt | KPIs por serviço |
| `GET /indicators/range` | admin, mgmt | Relatório por intervalo |
| `POST /tickets` | reception, dispenser | Emitir senha |
| `POST /tickets/call-next` | reception | Chamar próxima senha |
| `PATCH /tickets/:id/start` | reception | Iniciar atendimento |
| `PATCH /tickets/:id/complete` | reception | Concluir atendimento |
| `PATCH /tickets/:id/cancel` | reception | Cancelar senha |
| `GET /tickets` | reception, mgmt | Listar senhas |
| `POST /dispenser/tickets` | dispenser | Emitir senha (endpoint público) |

### Frontend Routes
| Route | Role | Description |
|-------|------|-------------|
| `/login` | — | Página de login |
| `/root/admins` | root | Gestão de administradores + configuração do servidor |
| `/root/account` | root | Minha conta |
| `/admin/dashboard` | admin | Dashboard com KPIs |
| `/admin/users` | admin | Gestão de utilizadores |
| `/admin/areas` | admin | Gestão de áreas |
| `/admin/services` | admin | Gestão de serviços |
| `/admin/stations` | admin | Gestão de estações |
| `/admin/displays` | admin | Gestão de displays |
| `/admin/dispensers` | admin | Gestão de dispensadores |
| `/admin/indicators` | admin | Relatórios e indicadores |
| `/admin/account` | admin | Minha conta |
| `/reception/queue` | reception | Painel de fila (call-next) |
| `/management/dashboard` | mgmt | Dashboard gestão |
| `/management/ads` | mgmt | Gestão de anúncios |
| `/management/ticket-format` | mgmt | Config formato senhas |
| `/management/voice` | mgmt | Config voz TTS |
| `/management/account` | mgmt | Minha conta |
| `/display` | display | Vista fullscreen pública |
| `/dispenser` | dispenser | (TODO) UI touch para emitir senhas |

### Socket.IO Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `join:area` | C→S | `areaId` |
| `leave:area` | C→S | `areaId` |
| `subscribe:queue` | C→S | `areaId` |
| `ticket:created` | S→C | `{ ticket }` |
| `ticket:called` | S→C | `{ ticket, voiceText }` |
| `ticket:started` | S→C | `{ ticketId, stationId }` |
| `ticket:completed` | S→C | `{ ticketId }` |
| `ticket:cancelled` | S→C | `{ ticketId }` |
| `queue:updated` | S→C | `{ waitingCount, nextTickets }` |

### Database Schema (Drizzle ORM, MySQL)
- `users` — id, username, passwordHash, role, areaId, stationId, active, createdBy
- `areas` — id, name, description, active
- `services` — id, name, areaId, ticketFormat, ticketPrefix, ticketDigitCount, active
- `stations` — id, name, areaId, receptionUserId, active
- `display_configs` — id, name, areaId, userId, active
- `dispenser_configs` — id, name, areaId, userId, active
- `daily_sequences` — id, serviceId, date, lastNumber
- `tickets` — id, number, sequenceNumber, serviceId, areaId, status, stationId, calledAt, startedAt, completedAt, date
- `advertisements` — id, title, contentType, contentUrl, contentText, areaId, active, durationSeconds, sortOrder
- `voice_configs` — id, areaId, language, voiceName, speed
- `system_settings` — id, key, value, description (configurações globais: server_host, server_port)

### Key Business Rules
1. Senhas são sequenciais por serviço, reiniciam diariamente às 00:00 (cron)
2. Recepcionista só pode operar na sua `areaId` + `stationId`
3. Display e Dispensador são criados com credenciais auto-geradas (username/password)
4. Root cria admins; admin cria todos os outros perfis
5. Primeiro login obriga alteração de senha (`firstLogin` flag)

## Android Display Wrapper

App Android nativo mínimo (`android/display/`) que carrega o display web num WebView e expõe o TTS nativo via bridge JavaScript.

**Porquê**: O `speechSynthesis` do Chrome no Android TV é instável (crashes, race conditions). O wrapper usa `android.speech.tts.TextToSpeech` que é estável e tem português nativo.

**Como funciona**:
- `MainActivity.kt` — WebView fullscreen + wake lock (24h)
- `TtsBridge.kt` — expõe `window.AndroidTTS.speak(text, lang, rate)` via `@JavascriptInterface`
- `display-view.tsx` detecta `window.AndroidTTS` automaticamente e usa-o em vez do Web Speech API

**Build**: Abrir `android/display/` no Android Studio → configurar URL em `strings.xml` → Build APK → instalar na TV.

## Known Issues / TODOs

| # | Issue | Priority |
|---|-------|----------|
| 1 | **Toast UI missing** — `useNotificationStore` guarda notificações mas nenhum componente as renderiza no ecrã | 🟢 RESOLVED |
| 2 | **Dispenser page missing** — `/dispenser` route existe no redirect mas não há componente | 🟢 OUTDATED |
| 3 | **Station association** — Criar utilizador `reception` não associa `stationId`; painel de fila precisa dele | 🟢 OUTDATED |
| 4 | **Ads on DisplayView** — Anúncios existem no backend mas display não os mostra | 🟢 RESOLVED |
| 5 | **No-show flow** — `markNoShow` existe no service mas sem route nem UI | 🟢 RESOLVED |
| 6 | **Logo** — Não foi possível obter do site (em manutenção); SVG próprio criado | 🟢 RESOLVED |

## Histórico de Decisões Arquiteturais

### Gestão Automática de Senhas Não Atendidas (Junho 2026)
- **Problema**: Senhas emitidas num dia que não foram atendidas (status `waiting` ou `called`) permaneciam ativas indefinidamente, causando confusão no dia seguinte quando o dispensador reiniciava a contagem.
- **Causa Raiz**: O sistema não tinha mecanismo para expirar senhas antigas. Quando o cron de meia-noite reiniciava as sequências diárias, as senhas do dia anterior continuavam na fila, mas não podiam ser chamadas porque o sistema já estava a operar com senhas do novo dia.
- **Solução**:
  1. Adicionada coluna `expired_at` à tabela `tickets` para registar quando uma senha foi marcada como expirada.
  2. Implementada função `expirePreviousDayTickets()` que corre à meia-noite (via cron) e no arranque do servidor (via `checkAndRunMissedReset()`). Esta função marca todas as senhas do dia anterior com status `waiting` ou `called` como `no_show` e preenche `expired_at`.
  3. Os KPIs já contabilizavam `no_show`, pelo que as senhas expiradas aparecem automaticamente nos indicadores como "não atendidas".
  4. O dispensador continua a emitir senhas normalmente porque as sequências diárias são reiniciadas após a expiração das senhas antigas.
- **Impacto**: Senhas não atendidas são agora descartadas automaticamente à meia-noite, contabilizadas nos KPIs do dia em que foram emitidas, e não interferem com o funcionamento do dia seguinte.

### Compatibilidade com Android TV (Junho 2026)
- **Problema**: O projeto não renderizava em navegadores de Android TV (como JioPages, Puffin, ou WebViews integradas antigas).
- **Causa Raiz**: Navegadores de Smart TVs e Android TVs frequentemente utilizam versões antigas do motor Chromium (versões entre 50 e 80). O build padrão do Vite gera código ES2020+ moderno (usando operadores como `?.` e `??`), o que causa erros de sintaxe fatais nesses navegadores antigos, impedindo a inicialização do React.
- **Solução**:
  1. Instalado o `@vitejs/plugin-legacy` e o `terser` para gerar bundles legados compatíveis com navegadores antigos (Chrome >= 50).
  2. Configurado o `vite.config.ts` para incluir o plugin de legado com suporte a `chrome >= 50` e polyfills adicionais.
  3. Ajustado o `target` no `tsconfig.json` de `ES2020` para `ES2018` para garantir que o compilador TypeScript não emita sintaxe excessivamente moderna antes do processamento do Vite.
  4. O build agora gera arquivos `-legacy.js` com polyfills automáticos que são carregados condicionalmente apenas em navegadores que não suportam ES Modules nativos.

### Restrição de Acesso a Estações de Recepção (Junho 2026)
- **Problema**: Operadores de recepção que terminavam a sessão direta (Logout) sem clicar em "Trocar Estação" mantinham a estação ocupada na base de dados. No próximo acesso, podiam tentar fazer login a partir de um dispositivo físico diferente e selecionar um novo posto, gerando conflitos e deixando a estação anterior bloqueada.
- **Solução**:
  1. No frontend, ao selecionar e confirmar a estação ativa, salvamos o ID da estação no `localStorage` sob a chave `katondo_browser_station_id`.
  2. Ao clicar em "Trocar Estação", limpamos este ID do `localStorage` e liberamos o posto na base de dados.
  3. No fluxo de Login, enviamos o `browserStationId` (se existir) para o backend.
  4. O backend valida: se o utilizador for de recepção e possuir uma estação ativa gravada na base de dados, o `browserStationId` enviado no login deve coincidir com o ID gravado na BD. Caso contrário, o login é recusado com uma mensagem clara obrigando o utilizador a liberar o posto anterior.
- **Impacto**: Garante que o operador não consiga fazer login noutra estação sem antes liberar formalmente o posto anterior (na máquina onde o posto foi ocupado), prevenindo conflitos de sessões e inconsistência física de postos.

### Forçar Libertação de Postos por Administradores (Junho 2026)
- **Problema**: Em casos onde o navegador era limpo, o dispositivo danificava, ou ocorriam falhas de rede antes do logout do operador de recepção, o posto ficava bloqueado na base de dados. O operador não conseguia fazer login em nenhum outro dispositivo e dependia de intervenção manual direta na base de dados para resolver.
- **Solução**:
  1. Implementado um novo endpoint de backend: `POST /api/users/:id/release-station`, restrito aos perfis `root` e `admin`.
  2. Este endpoint limpa a associação do utilizador alvo em qualquer estação na base de dados (coluna `receptionUserId` em `stations`) e define as propriedades `stationId` e `areaId` do utilizador na tabela `users` como `null`.
  3. No frontend, adicionado um botão de acção "Libertar" na lista de utilizadores da área de administração (`/admin/users`) para cada utilizador de recepção que tenha uma estação ativa vinculada.
  4. Adicionado um diálogo de confirmação seguro que avisa o administrador antes de proceder com o término forçado da sessão e libertação do posto.
- **Impacto**: Permite que os administradores da clínica resolvam instantaneamente bloqueios de sessão de forma visual e segura sem requerer suporte técnico especializado ou intervenção directa na base de dados, reduzindo o tempo de inatividade da recepção em caso de imprevistos físicos ou de rede.

## File Locations

```
client/src/
  api/          — Axios API clients (auth, users, areas, services, stations, displays, dispensers, tickets, ads, voice-config, indicators)
  auth/         — Login, first-login modal, role-guard
  components/   — AppShell (sidebar + header), layout primitives
  hooks/        — useQueue, useSocket
  pages/        — admin/, management/, reception/, display/, root/
  store/        — auth-store, notification-store, queue-store
  theme/        — system.ts (Chakra UI v3 system)
  types/        — index.ts (shared types)
  App.tsx       — Router com RoleGuard

server/src/
  config/env.ts — Environment variables
  db/           — schema.ts, connection.ts
  middleware/   — auth.ts (JWT validation, role guard)
  routes/       — *.ts (Express routers)
  services/     — *.service.ts (business logic)
  socket/       — handler.ts (Socket.IO events)
  utils/        — errors.ts, logger.ts, date.ts, ticket-format.ts
  index.ts      — Entry point with cron
```

## How to run

```bash
# 1. MySQL must be running with database 'katondo_queue'
# 2. Backend
cd server
npm install
DB_PASSWORD=root JWT_SECRET=dev-secret npm run dev

# 3. Frontend (new terminal)
cd client
npm install
npm run dev

# 4. Access
# Frontend: http://localhost:5173
# API:      http://localhost:3001/api/health
# Login:    root / root@123 (change on first login)
```

## Design Direction

**Aesthetic**: Clinical confidence — clean, spacious, authoritative. Reject generic "healthcare blue gradients." 
- **Palette**: Deep navy `#0A192F` as primary (trust), emerald `#059669` as accent (health), warm off-white `#FAFAF9` background.
- **Typography**: DM Serif Display (headings, editorial authority) + Geist Sans (body, clean legibility).
- **Layout**: Generous whitespace, card-based with subtle shadows, left sidebar for nav.
- **Motion**: Subtle entrance stagger (60ms) on page loads, hover lift on cards.
- **States**: Skeleton loading, empty states with CTA, inline errors, toast notifications.
