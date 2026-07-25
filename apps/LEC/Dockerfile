FROM node:22-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# openssl fuer Prisma-Engines; python3/make/g++ fuer eventuelle native Module.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder

COPY . .
ENV NODE_ENV=production
RUN npm run db:generate
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV LEC_SQLITE_PATH=/app/data/lec.sqlite

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl curl \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 lec

COPY --from=builder --chown=lec:nodejs /app ./

RUN mkdir -p /app/data \
  && chmod +x /app/scripts/start-hosted.sh \
  && chown -R lec:nodejs /app/data

USER lec

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["./scripts/start-hosted.sh"]
