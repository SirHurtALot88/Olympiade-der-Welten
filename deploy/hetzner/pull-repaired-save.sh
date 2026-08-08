#!/usr/bin/env bash
# pull-repaired-save.sh — auf dem Hetzner-Server ausfuehren.
#
# Gegenstueck zu `push-live-save.sh`: holt einen REPARIERTEN Spielstand von einem GitHub-Branch
# und setzt ihn im laufenden Container ein. Der Weg dorthin war bisher eine Handvoll Befehle, die
# man in der falschen Reihenfolge oder im falschen Ordner ausfuehren kann — und beim Austausch
# einer SQLite-Datei ist genau das gefaehrlich (siehe WAL-Hinweis unten).
#
# Nutzung (im Repo-Ordner auf dem Server, also /root/Olympiade-der-Welten):
#   deploy/hetzner/pull-repaired-save.sh                      # Branch save-repariert
#   deploy/hetzner/pull-repaired-save.sh --branch <branch>    # anderer Branch
#   deploy/hetzner/pull-repaired-save.sh --datei <pfad-im-branch>
#   deploy/hetzner/pull-repaired-save.sh --pruefen            # nur pruefen, nichts einsetzen
#   deploy/hetzner/pull-repaired-save.sh --zurueck            # letzte Sicherung wieder einsetzen
#
# ES WIRD ERST GESICHERT, DANN GETAUSCHT. Die Sicherung des bisherigen Spielstands landet unter
# /root/oly-save-sicherungen/ und wird am Ende genannt.
set -euo pipefail

BRANCH="save-repariert"
DATEI_IM_BRANCH="data/online-saves/hetzner-live-repariert.sqlite.gz"
NUR_PRUEFEN=0
ZURUECK=0

while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2 ;;
    --datei) DATEI_IM_BRANCH="$2"; shift 2 ;;
    --pruefen) NUR_PRUEFEN=1; shift ;;
    --zurueck) ZURUECK=1; shift ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

# Das Repo finden, auch wenn dieses Skript NICHT im Repo liegt.
#
# Realistischer Fall: die Datei ist noch nicht auf `main`, also holt man sie sich mit
# `git show <branch>:deploy/hetzner/pull-repaired-save.sh > /root/pull-repaired-save.sh` heraus und
# startet sie von dort. Die uebliche Ableitung ueber `dirname $0/../..` ergaebe dann `/` — und das
# Skript wuerde im falschen Verzeichnis arbeiten. Deshalb: Env schlaegt Skriptort schlaegt Standard.
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
TMP_GZ="/tmp/oly-repariert.sqlite.gz"
TMP_DB="/tmp/oly-repariert.sqlite"
STEMPEL="$(date '+%Y%m%d-%H%M%S')"

compose() { docker compose -f "$COMPOSE" --env-file "$ENV_FILE" "$@"; }

# Spielstand-Datei einsetzen — der eine Ablauf, den BEIDE Richtungen brauchen (einsetzen und
# zurueckdrehen). Einmal geschrieben statt zweimal: sonst haette der Rueckweg genau die WAL-Falle
# wieder, gegen die der Hinweg abgesichert ist.
einsetzen() {
  local quelle="$1"
  echo "      App anhalten ..."
  # Die Datei darf NICHT unter einer laufenden App getauscht werden: offene Verbindungen halten die
  # alte Datei weiter, und der naechste Schreibvorgang mischt beide Staende.
  compose stop oly-app
  echo "      Datei einsetzen ..."
  compose cp "$quelle" "oly-app:$DB_IM_CONTAINER"
  # DIESE ZEILE IST DER GANZE GRUND, WARUM ES DIESES SKRIPT GIBT.
  #
  # Die App laeuft mit `journal_mode = WAL`. Neben `oly-app.sqlite` liegen `-wal` und `-shm` und
  # gehoeren zur ALTEN Datei. Tauscht man nur die Hauptdatei aus, arbeitet SQLite beim naechsten
  # Start die alte WAL auf den neuen Spielstand an — bestenfalls ist der alte Stand zurueck,
  # schlimmstenfalls ist die Datenbank kaputt.
  compose run --rm --no-deps --entrypoint sh oly-app \
    -c "rm -f ${DB_IM_CONTAINER}-wal ${DB_IM_CONTAINER}-shm" >/dev/null 2>&1 || true
  # BESITZRECHTE ZURUECKSETZEN — sonst ist der Spielstand nur noch lesbar.
  #
  # GEMELDET, nach dem ersten echten Einsatz dieses Skripts: "Neue Saison starten" brach mit
  # „attempt to write a readonly database" ab. Die Datei war da, der Inhalt stimmte, gelesen wurde
  # sie auch — nur schreiben ging nicht mehr.
  #
  # Ursache: `docker compose cp` schreibt als ROOT in den Container. Der Dienst laeuft aber als
  # `oly` (Dockerfile:67 `adduser --system --uid 1001 oly`, Dockerfile:82 `USER oly`), und
  # Dockerfile:80 setzt beim Bauen eigens `chown -R oly:nodejs /app/data`. Nach dem Einsetzen
  # gehoerte die Datei root — die App konnte sie oeffnen und lesen, aber keine Zeile mehr
  # schreiben. Der Spielstand sah damit voellig gesund aus und war doch eingefroren.
  #
  # `--user 0`, weil nur root fremde Dateien uebereignen darf. Das `|| true` faengt den Fall ab,
  # dass ein Image ohne `oly` gebaut wurde; dann bleibt es beim alten Verhalten statt abzubrechen.
  #
  # ERNEUT GEMELDET, nach genau diesem Fix: „attempt to write a readonly database" stand wieder auf
  # dem Bildschirm. Die Zeile eignete nur die HAUPTDATEI ueber. SQLite braucht zum Schreiben aber
  # auch das VERZEICHNIS: es legt `-wal` und `-shm` daneben an, und dafuer muss `oly` im Ordner
  # anlegen duerfen. Bleibt `/app/data/persistence` root, scheitert das Anlegen — und SQLite meldet
  # das als „readonly database", obwohl die Datei selbst laengst passt. Deshalb jetzt `-R` auf das
  # ganze Datenverzeichnis: dieselbe Zeile, die auch das Image beim Bauen faehrt (Dockerfile:80).
  echo "      Besitzrechte auf den Dienst-Benutzer zuruecksetzen ..."
  compose run --rm --no-deps --user 0 --entrypoint sh oly-app \
    -c "chown -R oly:nodejs /app/data" >/dev/null 2>&1 || true
  echo "      App starten ..."
  compose up -d oly-app
}

# Liest die App den Spielstand wieder? Wartet bis zu zwei Minuten.
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
  LETZTE="$(ls -1t "$SICHERUNG_DIR"/oly-app-vor-reparatur-*.sqlite.gz 2>/dev/null | head -1 || true)"
  if [ -z "$LETZTE" ]; then
    echo "FEHLER: Keine Sicherung in $SICHERUNG_DIR gefunden." >&2
    exit 1
  fi
  echo "Zurueckdrehen auf: $LETZTE"
  gunzip -cf "$LETZTE" > "$TMP_DB"
  einsetzen "$TMP_DB"
  rm -f "$TMP_DB"
  if warte_auf_app; then
    echo ""
    echo "FERTIG — der Stand von vor der Reparatur ist wieder eingesetzt."
    exit 0
  fi
  echo "WARNUNG: Die App meldet sich nach 2 Minuten nicht mit lesbaren Spielstaenden." >&2
  exit 1
fi

echo "[1/5] Reparierten Spielstand von GitHub holen (Branch $BRANCH) ..."
# Nur fetch, kein pull/merge: der Arbeitsbaum des Servers wird NICHT angefasst. Das ist wichtig,
# solange dort noch ein liegengebliebener lokaler Commit den Auto-Deploy blockiert — dieses Skript
# soll davon unabhaengig funktionieren.
git fetch origin "$BRANCH" --quiet
if ! git cat-file -e "origin/$BRANCH:$DATEI_IM_BRANCH" 2>/dev/null; then
  echo "FEHLER: '$DATEI_IM_BRANCH' liegt nicht auf Branch '$BRANCH'." >&2
  exit 1
fi
git show "origin/$BRANCH:$DATEI_IM_BRANCH" > "$TMP_GZ"
echo "      geholt: $(du -h "$TMP_GZ" | cut -f1)"

echo "[2/5] Entpacken und pruefen ..."
# `gunzip -t` faengt genau den Fall ab, der beim ersten Versuch von Hand passiert ist: eine leere
# oder halbe Datei, weil der vorherige Befehl fehlgeschlagen war. Lieber hier abbrechen als eine
# kaputte Datei in den Spielstand schieben.
if ! gunzip -t "$TMP_GZ" 2>/dev/null; then
  echo "FEHLER: Die geholte Datei ist kein vollstaendiges gzip — Abbruch." >&2
  rm -f "$TMP_GZ"
  exit 1
fi
gunzip -cf "$TMP_GZ" > "$TMP_DB"
rm -f "$TMP_GZ"

# Plausibilitaet: ist es ueberhaupt eine SQLite mit Spielstaenden drin? Geprueft wird IM Container,
# weil dort `better-sqlite3` garantiert vorhanden ist (ein `sqlite3`-CLI waere es nicht) — dieselbe
# Ueberlegung wie in push-live-save.sh.
#
# Die Pruefdatei MUSS in einem Ordner liegen, den der Container-Benutzer beschreiben darf, und
# `/tmp/` ist genau das. Vorher stand hier `/tmp-pruefen.sqlite` — ein fehlender Schraegstrich, der
# die Datei nicht IN /tmp legte, sondern als `tmp-pruefen.sqlite` direkt ins Wurzelverzeichnis.
# Das gehoert root, der Dienst laeuft aber als `oly`. Und weil der Spielstand im WAL-Modus liegt,
# genuegt Leserecht nicht: SQLite legt beim Oeffnen einer WAL-Datenbank IMMER `-shm` und `-wal`
# daneben an, auch bei `readonly: true`. In `/` scheiterte das mit SQLITE_READONLY_DIRECTORY —
# und zwar erst beim `--pruefen`, also genau in dem Schritt, der Sicherheit geben sollte.
compose cp "$TMP_DB" "oly-app:/tmp/oly-pruefen.sqlite"
ANZAHL="$(compose exec -T oly-app node -e "
  const Database = require('better-sqlite3');
  const db = new Database('/tmp/oly-pruefen.sqlite', { readonly: true });
  const n = db.prepare('SELECT COUNT(*) AS n FROM saves').get().n;
  const namen = db.prepare('SELECT name FROM saves ORDER BY updated_at DESC LIMIT 3').all().map(r => r.name);
  db.close();
  process.stdout.write(n + '|' + namen.join(' / '));
")"
# `-shm`/`-wal` mit wegraeumen, sonst bleiben nach jedem Lauf zwei Seitendateien im Container liegen.
compose exec -T oly-app sh -c "rm -f /tmp/oly-pruefen.sqlite /tmp/oly-pruefen.sqlite-shm /tmp/oly-pruefen.sqlite-wal" >/dev/null 2>&1 || true
echo "      Spielstaende in der Datei: ${ANZAHL%%|*}"
echo "      neueste: ${ANZAHL#*|}"
if [ "${ANZAHL%%|*}" = "0" ]; then
  echo "FEHLER: Die Datei enthaelt keine Spielstaende — Abbruch." >&2
  exit 1
fi

if [ "$NUR_PRUEFEN" = "1" ]; then
  echo ""
  echo "NUR GEPRUEFT — es wurde nichts eingesetzt. Die Datei liegt unter $TMP_DB."
  exit 0
fi

echo "[3/5] Bisherigen Spielstand sichern ..."
mkdir -p "$SICHERUNG_DIR"
# WAL zuerst einarbeiten, sonst sichert man einen veralteten Stand — derselbe Fehler, den
# push-live-save.sh hatte (siehe dort).
compose exec -T oly-app node -e "
  const Database = require('better-sqlite3');
  const db = new Database('$DB_IM_CONTAINER');
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
" >/dev/null
compose cp "oly-app:$DB_IM_CONTAINER" "$SICHERUNG_DIR/oly-app-vor-reparatur-$STEMPEL.sqlite"
gzip -f "$SICHERUNG_DIR/oly-app-vor-reparatur-$STEMPEL.sqlite"
echo "      gesichert: $SICHERUNG_DIR/oly-app-vor-reparatur-$STEMPEL.sqlite.gz"

echo "[4/5] Spielstand einsetzen ..."
einsetzen "$TMP_DB"
rm -f "$TMP_DB"

echo "[5/5] Startpruefung ..."
if warte_auf_app; then
  echo ""
  echo "FERTIG — der reparierte Spielstand ist eingesetzt."
  echo "Falls doch etwas nicht stimmt, EIN Befehl zurueck:"
  echo "    $0 --zurueck"
  exit 0
fi

echo "" >&2
echo "WARNUNG: Die App meldet sich nach 2 Minuten nicht mit lesbaren Spielstaenden." >&2
echo "Zurueckdrehen mit:  $0 --zurueck" >&2
echo "(Sicherung: $SICHERUNG_DIR/oly-app-vor-reparatur-$STEMPEL.sqlite.gz)" >&2
exit 1
