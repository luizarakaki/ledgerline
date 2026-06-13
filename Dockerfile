# syntax=docker/dockerfile:1
# Multi-stage build: build the web SPA and compile the API, then run a slim image.
# Deployed on Railway via Docker. The Fastify server serves both /api and the SPA.

# ---------- base ----------
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ---------- dependencies (all workspaces, incl. dev for building) ----------
FROM base AS deps
ENV NODE_ENV=development
# argon2 needs build tooling for its native bindings.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY api/package.json ./api/
COPY web/package.json ./web/
RUN npm install --include=dev

# ---------- build ----------
FROM deps AS build
COPY . .
RUN npm run build --workspace=web
RUN npm run build --workspace=api

# ---------- production dependencies only ----------
FROM base AS prod-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY api/package.json ./api/
COPY web/package.json ./web/
# npm workspaces hoist deps to the root node_modules, so api/node_modules may
# not exist. Create it so the COPY in the runner stage never fails; Node still
# resolves the hoisted packages from /app/node_modules at runtime.
RUN npm install --omit=dev --workspace=api && mkdir -p api/node_modules

# ---------- runner ----------
FROM base AS runner
ENV NODE_ENV=production
ENV WEB_DIST=/app/web/dist
# App listens on $PORT (Railway injects it); default 8080.
ENV PORT=8080

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/api/node_modules ./api/node_modules
COPY --from=build /app/api/dist ./api/dist
COPY --from=build /app/api/drizzle ./api/drizzle
COPY --from=build /app/api/package.json ./api/package.json
COPY --from=build /app/web/dist ./web/dist
COPY package.json ./

EXPOSE 8080
WORKDIR /app/api
CMD ["node", "dist/index.js"]
