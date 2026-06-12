# Repository Guidelines

## Project Structure & Module Organization

This is a workspace-based queue management system for Clinica Katondo.

- `client/`: React 19 + Vite frontend. Source lives in `client/src/`: pages in `pages/`, API wrappers in `api/`, Zustand stores in `store/`, shared UI in `components/`, and assets in `public/`.
- `server/`: Express + Socket.IO backend in `server/src/`, organized by `routes/`, `services/`, `db/`, `socket/`, `middleware/`, `config/`, and `utils/`.
- `server/migrations/`: Drizzle SQL migrations. Keep schema and migrations in sync.
- `android/display/`: Native Android display app using Kotlin, Jetpack Compose, Retrofit, Socket.IO, and TTS.
- `docs/`: Deployment notes. `docker-compose.yml`, `nginx.conf`, and `deploy.sh` support rollout.

## Build, Test, and Development Commands

- `npm run dev`: starts server and client together via workspaces.
- `npm run dev:server`: runs the backend with `tsx watch`.
- `npm run dev:client`: runs the Vite frontend on all interfaces.
- `npm run build`: builds backend TypeScript and frontend Vite bundle.
- `npm run start`: starts the built backend from `server/dist`.
- `npm run seed`: runs the server database seed script.
- `npm run db:migrate` / `npm run db:push`: apply migrations or push schema changes.
- `cd android/display && ./gradlew assembleDebug`: builds the Android debug APK.

## Coding Style & Naming Conventions

Use TypeScript strict mode conventions already configured in both workspaces. Prefer domain filenames such as `ticket.service.ts`, `voice-config.ts`, `queue-store.ts`, and kebab-case React page files. Use PascalCase for React components and camelCase for variables/functions. Existing source uses two-space indentation, single quotes, and semicolons. Run `npm run build` before handoff; client lint is `npm run lint --workspace=client`.

## Testing Guidelines

No formal test runner is configured in `package.json`. Validate changes with manual checks plus `npm run build`. When adding tests, colocate them near the feature or use a clear `tests/` folder, and name files `*.test.ts` or `*.test.tsx`. Backend changes that touch tickets, auth, or database schema should include seed or migration verification.

## Commit & Pull Request Guidelines

Recent history uses short, imperative messages with prefixes such as `feat:` and `Ref:`. Prefer lower-case prefixes, for example `feat: add ticket backup route` or `fix: handle expired display token`. PRs should describe the change, list verification commands, call out migrations or deployment impacts, and include screenshots for visible UI changes.

## Security & Configuration Tips

Keep secrets in environment files, not source. Review `server/src/config/env.ts` before adding required variables. Do not commit generated Android build outputs, uploaded media, database dumps, or production credentials.
