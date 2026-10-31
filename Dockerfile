# ----------------------------------------------------
# Stage 1: Build the React client
# ----------------------------------------------------
FROM node:20-bookworm-slim AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ----------------------------------------------------
# Stage 2: Install and build server dependencies
# ----------------------------------------------------
FROM node:20-bookworm-slim AS server-builder
WORKDIR /app/server

# Build tools for compiling native C++ bindings (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm ci --omit=dev

# ----------------------------------------------------
# Stage 3: Production Runner
# ----------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy built server node_modules & server code
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY server/ ./server/

# Copy built frontend assets
COPY --from=client-builder /app/client/dist ./client/dist

# Expose single full-stack port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start KaamConnect unified server
CMD ["node", "server/index.js"]
