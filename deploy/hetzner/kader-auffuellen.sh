#!/usr/bin/env bash
# kader-auffuellen.sh — auf dem Hetzner-Server ausfuehren.
#
# Holt den KAUFLAUF NACH, den ein Fehler beim Saisonstart abgebrochen hat.
#
# ANLASS (Chris): "einige teams haben dann nur minimum an playern!". Die Sperre
# `skipIfExistingMarketTransfers` fragte "existiert IRGENDEIN Transfer dieser Saison?" und stieg
# dann fuer die GANZE LIGA aus — ein Lauf, der auf halber Strecke stehenblieb, galt damit als
# erledigt, auch fuer die Teams, die noch nichts hatten. Der Code ist repariert; ein BESTEHENDER
# Spielstand holt das aber nicht von selbst nach, weil das Kauffenster der Saison durch ist.
#
# Nutzung (im Repo-Ordner auf dem Server, also /root/Olympiade-der-Welten):
#   bash deploy/hetzner/kader-auffuellen.sh             nur Bericht, App laeuft weiter
#   bash deploy/hetzner/kader-auffuellen.sh --apply     KAUFT WIRKLICH (sichert vorher)
#   bash deploy/hetzner/kader-auffuellen.sh --zurueck   letzte Sicherung wieder einsetzen
#
# OHNE --apply WIRD NICHTS GESCHRIEBEN und die App nicht angefasst. Der Bericht laeuft lesend
# gegen den laufenden Container.
set -euo pipefail

APPLY=0
ZURUECK=0

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --zurueck) ZURUECK=1; shift ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

# Repo finden, auch wenn dieses Skript woanders liegt — gleiche Ableitung wie in
# pull-repaired-save.sh, aus demselben Grund (man holt sich die Datei auch mal mit `git show`
# heraus und startet sie aus /root).
REPO_DIR="${OLY_REPO_DIR:-}"
if [ -z "$REPO_DIR" ]; then
  KANDIDAT="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd || echo "")"
  if [ -n "$KANDIDAT" ] && [ -f "$KANDIDAT/deploy/hetzner/docker-compose.yml" ]; then
    REPO_DIR="$KANDIDAT"
  elif [ -f "/root/Olympiade-der-Welten/deploy/hetzner/docker-compose.yml" ]; then
    REPO_DIR="/root/Olympiade-der-Welten"
  fi
fi
if [ -z "$REPO_DIR" ] || [ ! -f "$REPO_DIR/deploy/hetzner/docker-compose.yml" ]; then
  echo "FEHLER: Repo-Ordner nicht gefunden. Mit OLY_REPO_DIR=/pfad/zum/repo starten." >&2
  exit 2
fi
cd "$REPO_DIR"
echo "Repo: $REPO_DIR"

COMPOSE="deploy/hetzner/docker-compose.yml"
ENV_FILE="deploy/hetzner/.env"
DB_IM_CONTAINER="/app/data/persistence/oly-app.sqlite"
SICHERUNG_DIR="/root/oly-save-sicherungen"
STEMPEL="$(date '+%Y%m%d-%H%M%S')"
SICHERUNG="$SICHERUNG_DIR/oly-app-vor-kader-auffuellen-$STEMPEL.sqlite.gz"

compose() { docker compose -f "$COMPOSE" --env-file "$ENV_FILE" "$@"; }

# Dieselbe Einsetz-Mechanik wie in pull-repaired-save.sh — WAL wegraeumen und Besitzrechte
# zuruecksetzen. Beides ist dort teuer gelernt worden:
#   - `-wal`/`-shm` gehoeren zur ALTEN Datei; bleiben sie liegen, mischt SQLite beide Staende.
#   - `docker compose cp` schreibt als root; die App laeuft als `oly` und kann sonst nicht mehr
#     schreiben ("attempt to write a readonly database").
einsetzen() {
  local quelle="$1"
  echo "      App anhalten ..."
  compose stop oly-app
  echo "      Datei einsetzen ..."
  compose cp "$quelle" "oly-app:$DB_IM_CONTAINER"
  compose run --rm --no-deps --entrypoint sh oly-app \
    -c "rm -f ${DB_IM_CONTAINER}-wal ${DB_IM_CONTAINER}-shm" >/dev/null 2>&1 || true
  echo "      Besitzrechte auf den Dienst-Benutzer zuruecksetzen ..."
  compose run --rm --no-deps --user 0 --entrypoint sh oly-app \
    -c "chown -R oly:nodejs /app/data" >/dev/null 2>&1 || true
  echo "      App starten ..."
  compose up -d oly-app
}

warte_auf_app() {
  sleep 5
  for _versuch in $(seq 1 24); do
    if compose exec -T oly-app node -e "
        const Database = require('better-sqlite3');
        const db = new Database('$DB_IM_CONTAINER', { readonly: true });
        const n = db.prepare('SELECT COUNT(*) AS n FROM saves').get().n;
        db.close();
        if (!n) process.exit(1);
      " >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  return 1
}

if [ "$ZURUECK" = "1" ]; then
  LETZTE="$(ls -1t "$SICHERUNG_DIR"/oly-app-vor-kader-auffuellen-*.sqlite.gz 2>/dev/null | head -1 || true)"
  if [ -z "$LETZTE" ]; then
    echo "FEHLER: Keine Sicherung in $SICHERUNG_DIR gefunden." >&2
    exit 1
  fi
  echo "Zurueckdrehen auf: $LETZTE"
  gunzip -cf "$LETZTE" > /tmp/oly-kader-zurueck.sqlite
  einsetzen /tmp/oly-kader-zurueck.sqlite
  rm -f /tmp/oly-kader-zurueck.sqlite
  if warte_auf_app; then
    echo ""
    echo "FERTIG — der Stand von vor dem Auffuellen ist wieder eingesetzt."
    exit 0
  fi
  echo "WARNUNG: Die App meldet sich nach 2 Minuten nicht mit lesbaren Spielstaenden." >&2
  exit 1
fi

if [ "$APPLY" = "0" ]; then
  echo ""
  echo "BERICHT (es wird nichts geschrieben, die App laeuft weiter)"
  echo ""
  compose exec -T oly-app npx tsx scripts/repair-kader-auffuellen.ts
  echo ""
  echo "Wenn das so passt:  bash deploy/hetzner/kader-auffuellen.sh --apply"
  exit 0
fi

echo ""
echo "[1/5] WAL einarbeiten und sichern ..."
mkdir -p "$SICHERUNG_DIR"
# Checkpoint zuerst, sonst fehlt in der Sicherung alles seit dem letzten Schreibpunkt.
compose exec -T oly-app node -e "
    const Database = require('better-sqlite3');
    const db = new Database('$DB_IM_CONTAINER');
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
  " >/dev/null
compose cp "oly-app:$DB_IM_CONTAINER" /tmp/oly-vor-auffuellen.sqlite
gzip -c /tmp/oly-vor-auffuellen.sqlite > "$SICHERUNG"
rm -f /tmp/oly-vor-auffuellen.sqlite
echo "      Sicherung: $SICHERUNG"

echo "[2/5] App anhalten (niemand sonst darf waehrenddessen schreiben) ..."
# Der Kauflauf schreibt ueber die Persistenzschicht in DIESELBE Datei, die die laufende App offen
# haelt. Zwei Schreiber auf einer SQLite mit WAL sind kein Zustand, den man riskieren muss.
compose stop oly-app

echo "[3/5] Kader auffuellen ..."
set +e
compose run --rm --no-deps --entrypoint npx oly-app tsx scripts/repair-kader-auffuellen.ts --apply
LAUF_STATUS=$?
set -e

# Das Reparaturskript legt zusaetzlich eine JSON-Sicherung NEBEN die Datenbank (also ins Volume),
# damit sie einen Wegwerf-Container ueberlebt. Sie ist rund 50 MB gross und hier doppelt: die
# komprimierte Sicherung aus Schritt 1 liegt bereits auf dem Host. Der Server lief zuletzt bei 77 %
# Plattenbelegung — also nach erfolgreichem Lauf wieder wegraeumen, aber NUR dann.
if [ "$LAUF_STATUS" -eq 0 ]; then
  compose run --rm --no-deps --entrypoint sh oly-app \
    -c "rm -rf /app/data/persistence/save-backups" >/dev/null 2>&1 || true
fi

echo "[4/5] Besitzrechte zuruecksetzen ..."
compose run --rm --no-deps --user 0 --entrypoint sh oly-app \
  -c "chown -R oly:nodejs /app/data" >/dev/null 2>&1 || true

echo "[5/5] App starten ..."
compose up -d oly-app

if [ "$LAUF_STATUS" -ne 0 ]; then
  echo "" >&2
  echo "FEHLER: Der Kauflauf ist mit Status $LAUF_STATUS abgebrochen." >&2
  echo "Der Spielstand kann teilweise geaendert sein. Zurueckdrehen mit:" >&2
  echo "  bash deploy/hetzner/kader-auffuellen.sh --zurueck" >&2
  exit "$LAUF_STATUS"
fi

if warte_auf_app; then
  echo ""
  echo "FERTIG — die Kader sind aufgefuellt."
  echo "Sicherung liegt unter: $SICHERUNG"
  echo "Zurueckdrehen mit:      bash deploy/hetzner/kader-auffuellen.sh --zurueck"
  exit 0
fi

echo "WARNUNG: Die App meldet sich nach 2 Minuten nicht mit lesbaren Spielstaenden." >&2
echo "Zurueckdrehen mit: bash deploy/hetzner/kader-auffuellen.sh --zurueck" >&2
exit 1
