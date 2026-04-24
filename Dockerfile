# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install only production-relevant packages (keep tsx for running server.ts)
COPY package*.json ./
RUN npm ci

# Copy built frontend assets and server source
COPY --from=builder /app/dist ./dist
COPY server.ts ./

# Persistent data directory — mount a Docker volume here
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=5747
ENV DATA_DIR=/data

EXPOSE 5747

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO /dev/null http://localhost:5747/api/state || exit 1

CMD ["npx", "tsx", "server.ts"]
