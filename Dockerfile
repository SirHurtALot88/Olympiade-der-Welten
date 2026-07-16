FROM node:22-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder

COPY . .
RUN npm run db:generate
RUN npm run build
RUN mkdir -p /app/deploy/seed \
  && if [ -f /app/data/persistence/oly-app.sqlite ]; then cp /app/data/persistence/oly-app.sqlite /app/deploy/seed/oly-app.sqlite; fi

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV OLY_APP_SQLITE_PATH=/app/data/persistence/oly-app.sqlite

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 oly

COPY --from=builder --chown=oly:nodejs /app ./

RUN mkdir -p /app/data/persistence \
  && chmod +x /app/scripts/start-hosted.sh \
  && chown -R oly:nodejs /app/data /app/.next /app/deploy

USER oly

EXPOSE 3000

CMD ["./scripts/start-hosted.sh"]
