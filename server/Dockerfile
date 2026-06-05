# ──────────────────────────────────────────────────────────────
# Stage 1 — Build client (Vite)
# ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS client-builder

WORKDIR /app/client

COPY client/package.json ./
COPY client/vite.config.ts ./
COPY client/tsconfig.json ./
COPY client/index.html ./
COPY client/src ./src
COPY client/public ./public

RUN npm install && npm run build


# ──────────────────────────────────────────────────────────────
# Stage 2 — Build server (TypeScript → dist)
# ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS server-builder

WORKDIR /app/server

COPY server/package.json ./
COPY server/tsconfig.json ./
COPY server/drizzle.config.json ./
COPY server/src ./src

RUN npm install && npm run build && npm prune --production


# ──────────────────────────────────────────────────────────────
# Stage 3 — Production runtime
# ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS production

# Non-root security
RUN addgroup -g 1001 -S appgroup && \
    adduser  -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy server dist + node_modules
COPY --from=server-builder --chown=appuser:appgroup /app/server/dist ./dist
COPY --from=server-builder --chown=appuser:appgroup /app/server/node_modules ./node_modules
COPY --from=server-builder --chown=appuser:appgroup /app/server/package.json ./package.json

# Copy built client (served as static by Express)
COPY --from=client-builder --chown=appuser:appgroup /app/client/dist ./client/dist

# Copy server source (for drizzle-kit migrations in production)
COPY --from=server-builder --chown=appuser:appgroup /app/server/src ./src
COPY --from=server-builder --chown=appuser:appgroup /app/server/drizzle.config.json ./

# Create writable directories for non-root user
RUN mkdir -p logs uploads && chown -R appuser:appgroup logs uploads

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/index.js"]