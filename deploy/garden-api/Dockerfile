# --- Build Stage ---
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# Copy workspace configuration and dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
COPY apps/garden-api/package.json ./apps/garden-api/

RUN pnpm --filter @garden-lab/api install --frozen-lockfile=false

COPY apps/garden-api/src ./apps/garden-api/src
COPY apps/garden-api/tsconfig.json ./apps/garden-api/tsconfig.json

# --- Runtime Stage ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV GARDEN_API_HOST=0.0.0.0
ENV GARDEN_API_PORT=8787
ENV GARDEN_DATA_DIR=/data

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

COPY --from=builder /app /app

VOLUME ["/data"]

EXPOSE 8787

CMD ["pnpm", "--filter", "@garden-lab/api", "start"]
