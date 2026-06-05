# Katondo Queue — Deploy para VPS

## Arquitectura correcta

```
Build local (macOS/Windows)
    ├── npm run build:client  → client/dist/ (HTML/JS/CSS)
    └── npm run build:server → server/dist/  (JS compilado)
                + server/node_modules (production deps)
                + server/src/         (TypeScript source para drizzle-kit)

    ↓ rsync (apenas artefactos, SEM recompilar)

VPS (10.245.80.114)
    └── docker build --no-cache  (imagem nova a partir de ficheiros limpos)
            └── docker compose up --no-deps -d app  (recreate só o app)
```

## Ficheiros a sincronizar para o VPS

```bash
# 1. Build local
npm run build

# 2. Sincronizar apenas o necessário (exclui node_modules/.git/dist)
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='client/node_modules' \
  --exclude='server/node_modules' \
  --exclude='dist' \
  --exclude='client/dist' \
  --exclude='.env' \
  --exclude='.DS_Store' \
  ./ \
  katondo@10.245.80.114:/home/katondo/katondo-queue/

# 3. NO VPS: build Docker image (não recompila TypeScript)
docker compose build --no-cache app

# 4. Recreate apenas o container app (não afecta mysql/nginx)
docker compose up -d --force-recreate app
```

## Ficheiros essenciais para o deploy

| Ficheiro | Conteúdo | Origem |
|----------|----------|--------|
| `server/Dockerfile` | Multi-stage build | Local |
| `docker-compose.yml` | Stack completa | Local |
| `nginx.conf` | Reverse proxy | Local |
| `server/dist/` | JS compilado (TypeScript→JS) | Build local |
| `client/dist/` | HTML/JS/CSS (React SPA) | Build local |
| `server/node_modules/` | Deps production (com drizzle-kit) | `npm install` local |
| `server/src/` | Source para drizzle-kit ler schema | Local |
| `.env` | Variáveis (NÃO sincronizar, criar no VPS) | Criar no VPS |

## Erros comuns e como evitar

### Erro: `src/services.ts` conflict
- **Causa:** existe um ficheiro `src/services.ts` E `src/routes/services.ts`
- **Solução:** apagar `src/services.ts` (só deve existir em `routes/`)

### Erro: `CLIENT_DIST_PATH` wrong
- **Causa:** `path.join(__dirname, '..', '..', 'client', 'dist')` resolve para `/client/dist` (não existe)
- **Solução:** usar caminho absoluto `CLIENT_DIST_PATH = '/app/client/dist'`

### Erro: `requireRole` sem `root`
- **Causa:** routes que deviam permitir `root` não o incluem
- **Solução:** `requireRole('root', 'admin', ...)` explicitamente

### Erro: Cache Docker
- **Causa:** camadas anteriores em cache não refletem mudanças no source
- **Solução:** `docker compose build --no-cache app` (força rebuild completo)

### Erro: rsync sem permissão
- **Causa:** directórios criados pelo root (sudo)
- **Solução:** `sudo chown -R katondo:katondo /home/katondo`

## Ficheiros do deploy (Docker)

### `server/Dockerfile`
```dockerfile
# Stage 1 — Build client
FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package.json client/vite.config.ts client/tsconfig.json client/index.html ./
COPY client/src ./src
COPY client/public ./public
RUN npm install && npm run build

# Stage 2 — Build server (TypeScript → dist)
FROM node:22-alpine AS server-builder
WORKDIR /app/server
COPY server/package.json server/tsconfig.json server/drizzle.config.json ./
COPY server/src ./src
RUN npm install && npm run build && npm prune --production

# Stage 3 — Runtime
FROM node:22-alpine AS production
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
WORKDIR /app
COPY --from=server-builder --chown=appuser:appgroup /app/server/dist ./dist
COPY --from=server-builder --chown=appuser:appgroup /app/server/node_modules ./node_modules
COPY --from=server-builder --chown=appuser:appgroup /app/server/package.json ./package.json
COPY --from=client-builder --chown=appuser:appgroup /app/client/dist ./client/dist
COPY --from=server-builder --chown=appuser:appgroup /app/server/src ./src
COPY --from=server-builder --chown=appuser:appgroup /app/server/drizzle.config.json ./
RUN mkdir -p logs uploads && chown -R appuser:appgroup logs uploads
USER appuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/api/health || exit 1
CMD ["node", "dist/index.js"]
```

### `docker-compose.yml`
```yaml
services:
  mysql:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-katondo_queue}
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "127.0.0.1:3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s; timeout: 5s; retries: 10
    networks: [katondo-net]
    security_opt: [no-new-privileges:true]

  app:
    build:
      context: .
      dockerfile: server/Dockerfile
    restart: unless-stopped
    depends_on:
      mysql: { condition: service_healthy }
    environment:
      NODE_ENV: production; PORT: 3001
      DB_HOST: mysql; DB_PORT: 3306
      DB_USER: root; DB_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      DB_NAME: ${MYSQL_DATABASE:-katondo_queue}
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - app_uploads:/app/uploads
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/health"]
      interval: 30s; timeout: 10s; retries: 5; start_period: 60s
    networks: [katondo-net]
    security_opt: [no-new-privileges:true]

  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on:
      app: { condition: service_healthy }
    ports:
      - "${APP_PORT:-80}:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1/health || exit 1"]
      interval: 30s; timeout: 5s; retries: 3
    networks: [katondo-net]
    security_opt: [no-new-privileges:true]

volumes:
  mysql_data:; app_uploads:

networks:
  katondo-net: { driver: bridge }
```

### `nginx.conf`
```nginx
upstream backend { server app:3001; keepalive 32; }

server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location = /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
        proxy_connect_timeout 15s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location /uploads/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 50m;
    }

    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
        proxy_buffering off;
    }
}
```

## Fluxo completo de deploy

```bash
# LOCAL — Build tudo
npm run build

# LOCAL — Corrigir ownership no VPS
ssh katondo@10.245.80.114 'sudo chown -R katondo:katondo /home/katondo'

# LOCAL — Sincronizar ficheiros
rsync -avz \
  --exclude='node_modules' --exclude='.git' \
  --exclude='client/node_modules' --exclude='server/node_modules' \
  --exclude='dist' --exclude='.env' --exclude='.DS_Store' \
  --exclude='client/dist' \
  ./ \
  katondo@10.245.80.114:/home/katondo/katondo-queue/

# VPS — Build imagem Docker (sem cache)
ssh katondo@10.245.80.114 \
  'cd /home/katondo/katondo-queue && docker compose build --no-cache app'

# VPS — Recreate container app
ssh katondo@10.245.80.114 \
  'cd /home/katondo/katondo-queue && docker compose up -d --force-recreate app'

# VERIFICAR
ssh katondo@10.245.80.114 \
  'curl -s http://localhost/api/health && echo "" && docker compose ps'
```

## .env no VPS (criar manualmente)

```bash
MYSQL_ROOT_PASSWORD=<gerar-com-openssl-rand-hex-64>
MYSQL_DATABASE=katondo_queue
JWT_SECRET=<gerar-com-openssl-rand-hex-64>
APP_PORT=80
```