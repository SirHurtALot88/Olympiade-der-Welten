#!/usr/bin/env sh
set -eu

: "${OLY_APP_SQLITE_PATH:=/app/data/persistence/oly-app.sqlite}"
export OLY_APP_SQLITE_PATH

database_dir="$(dirname "$OLY_APP_SQLITE_PATH")"
mkdir -p "$database_dir"

seed_path="${OLY_APP_SQLITE_SEED_PATH:-/app/deploy/seed/oly-app.sqlite}"
if [ ! -f "$OLY_APP_SQLITE_PATH" ] && [ -f "$seed_path" ]; then
  cp "$seed_path" "$OLY_APP_SQLITE_PATH"
fi

exec npm run start
