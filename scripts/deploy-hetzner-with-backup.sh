#!/usr/bin/env sh
set -eu

export OLY_SAVE_BACKUP_REASON="${OLY_SAVE_BACKUP_REASON:-pre-deploy}"

npm run backup:save
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env up -d --build

