#!/usr/bin/env sh
set -eu

export OLY_SAVE_BACKUP_REASON="${OLY_SAVE_BACKUP_REASON:-pre-deploy}"

# Build-Stempel fuer die Sidebar-Version-Badge (lib/app-version.ts), an
# docker-compose.yml als build-arg durchgereicht -> Dockerfile builder-Stage
# setzt sie vor `npm run build` als NEXT_PUBLIC_*-ENV, damit Next.js sie ins
# Client-Bundle inlined.
export NEXT_PUBLIC_OLY_BUILD_SHA="$(git rev-parse HEAD)"
export NEXT_PUBLIC_OLY_BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

npm run backup:save
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env up -d --build

