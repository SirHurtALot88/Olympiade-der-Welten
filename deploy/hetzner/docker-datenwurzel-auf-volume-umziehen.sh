#!/usr/bin/env bash
# docker-datenwurzel-auf-volume-umziehen.sh — auf dem Hetzner-Server ausfuehren.
#
# ANLASS (14.11.): Die Root-Platte (`sda1`, 38 GB) lief wiederholt voll und liess Docker-Builds
# mit "no space left on device" abbrechen (zuletzt beim Entpacken der Playwright-Chromium-Schicht).
# Dabei haengt am Server ein 20-GB-Hetzner-Volume, das NICHT genutzt wird: `docker info` zeigt
# `Docker Root Dir: /mnt/volume-hel1-1/docker`, aber dieser Pfad liegt in Wahrheit auf der vollen
# Root-Platte — das echte Volume ist unter einem ANDEREN Pfad eingebunden (siehe `lsblk`). Vermutlich
# ist das Volume nach einem Server-Neustart unter neuem Namen gelandet, Docker arbeitet seitdem
# unbemerkt auf `sda1` weiter.
#
# DIESES SKRIPT ZIEHT DIE GESAMTE DOCKER-DATENWURZEL (Images, Build-Cache, UND die Volumes
# `oly-data`/`lec-data` mit den Spielstaenden) AUF DAS VOLUME UM. Das ist ein Eingriff in die
# laufende Produktion: Docker wird kurz komplett angehalten, nicht nur der Compose-Stack.
#
# Nutzung (im Repo-Ordner auf dem Server, also /root/Olympiade-der-Welten):
#   bash deploy/hetzner/docker-datenwurzel-auf-volume-umziehen.sh              nur Bericht, nichts wird angefasst
#   bash deploy/hetzner/docker-datenwurzel-auf-volume-umziehen.sh --apply      zieht wirklich um (App kurz offline)
#   bash deploy/hetzner/docker-datenwurzel-auf-volume-umziehen.sh --zurueck    zurueck auf die alte Datenwurzel
#   bash deploy/hetzner/docker-datenwurzel-auf-volume-umziehen.sh --loesche-altes
#       loescht die alte Datenwurzel ERST, wenn der Umzug bestaetigt lief (gibt die ~alten GB frei)
#
# OHNE --apply WIRD NICHTS GESCHRIEBEN. Pfade sind per Umgebungsvariable ueberschreibbar, falls sich
# Geraetename oder Mountpunkt je aendern:
#   OLY_DOCKER_ALT         Standard: /mnt/volume-hel1-1/docker   (die bisherige, falsche Datenwurzel)
#   OLY_DOCKER_NEU_MOUNT   Standard: /mnt/HC_Volume_106761772    (das echte, leere Volume)
set -uo pipefail

ALT="${OLY_DOCKER_ALT:-/mnt/volume-hel1-1/docker}"
NEU_MOUNT="${OLY_DOCKER_NEU_MOUNT:-/mnt/HC_Volume_106761772}"
NEU="$NEU_MOUNT/docker"
DAEMON_JSON="/etc/docker/daemon.json"
STEMPEL="$(date '+%Y%m%d-%H%M%S')"

MODUS="bericht"
case "${1:-}" in
  --apply) MODUS="apply" ;;
  --zurueck) MODUS="zurueck" ;;
  --loesche-altes) MODUS="loeschen" ;;
  "") ;;
  *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
esac

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
COMPOSE="deploy/hetzner/docker-compose.yml"
ENV_FILE="deploy/hetzner/.env"
DB_IM_CONTAINER="/app/data/persistence/oly-app.sqlite"
compose() { docker compose -f "$COMPOSE" --env-file "$ENV_FILE" "$@"; }

aktuelle_datenwurzel() { docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo "?"; }

warte_auf_dockerd() {
  for _v in $(seq 1 30); do
    docker info >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
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

# ---------------------------------------------------------------- --zurueck
if [ "$MODUS" = "zurueck" ]; then
  LETZTE_SICHERUNG="$(ls -1t "$DAEMON_JSON".vor-umzug-*.bak 2>/dev/null | head -1 || true)"
  if [ -z "$LETZTE_SICHERUNG" ]; then
    echo "FEHLER: Keine Sicherung von '$DAEMON_JSON' gefunden — nichts zum Zurueckdrehen." >&2
    exit 1
  fi
  if [ ! -d "$ALT" ]; then
    echo "FEHLER: '$ALT' existiert nicht mehr — vermutlich schon mit --loesche-altes entfernt." >&2
    echo "        Dann ist ein Zurueckdrehen nicht mehr moeglich." >&2
    exit 1
  fi
  echo "[1/4] Compose-Stack anhalten ..."
  compose down || true
  echo "[2/4] Docker-Daemon anhalten ..."
  systemctl stop docker.socket 2>/dev/null || true
  systemctl stop docker.service
  echo "[3/4] '$DAEMON_JSON' auf die Sicherung zuruecksetzen: $LETZTE_SICHERUNG"
  cp "$LETZTE_SICHERUNG" "$DAEMON_JSON"
  echo "[4/4] Docker-Daemon und Compose-Stack starten ..."
  systemctl start docker.service
  systemctl start docker.socket 2>/dev/null || true
  if ! warte_auf_dockerd; then
    echo "FEHLER: Docker-Daemon antwortet nach 30s nicht." >&2
    exit 1
  fi
  compose up -d
  if warte_auf_app; then
    echo ""
    echo "FERTIG — zurueck auf die alte Datenwurzel: $(aktuelle_datenwurzel)"
    exit 0
  fi
  echo "WARNUNG: Die App meldet sich nach 2 Minuten nicht mit lesbaren Spielstaenden." >&2
  exit 1
fi

# ---------------------------------------------------------- --loesche-altes
if [ "$MODUS" = "loeschen" ]; then
  AKTUELL="$(aktuelle_datenwurzel)"
  if [ "$AKTUELL" != "$NEU" ]; then
    echo "FEHLER: Docker laeuft gerade NICHT auf '$NEU' (sondern auf '$AKTUELL')." >&2
    echo "        Erst erfolgreich mit --apply umziehen, dann hier loeschen." >&2
    exit 1
  fi
  if [ ! -d "$ALT" ]; then
    echo "Nichts zu tun — '$ALT' existiert schon nicht mehr." >&2
    exit 0
  fi
  GROESSE="$(du -sh "$ALT" 2>/dev/null | cut -f1)"
  echo "Loesche die alte Datenwurzel: $ALT  (Groesse: $GROESSE)"
  echo "Das gibt diesen Platz auf der Root-Platte (sda1) frei. Letzte Warnung — 5 Sekunden Zeit zum Abbrechen (Strg+C)."
  sleep 5
  rm -rf "$ALT"
  echo "FERTIG."
  df -h /
  exit 0
fi

# -------------------------------------------------------------------- Bericht (auch Vorpruefung fuer --apply)
AKTUELL="$(aktuelle_datenwurzel)"
VOLUME_OK=0
FSTAB_OK=0
BUILD_LAEUFT=0
FREI_NEU_BYTES=0
ALT_GROESSE_BYTES=0

if findmnt -no SOURCE "$NEU_MOUNT" >/dev/null 2>&1; then
  VOLUME_OK=1
  FREI_NEU_BYTES="$(df -B1 --output=avail "$NEU_MOUNT" | tail -1 | tr -d ' ')"
fi
grep -q "$NEU_MOUNT" /etc/fstab 2>/dev/null && FSTAB_OK=1
pgrep -f "buildctl|buildkit" >/dev/null 2>&1 && BUILD_LAEUFT=1
[ -d "$ALT" ] && ALT_GROESSE_BYTES="$(du -sb "$ALT" 2>/dev/null | cut -f1)"

if [ "$MODUS" = "bericht" ]; then
  echo "=============================================="
  echo " Docker-Datenwurzel-Umzug — Diagnose  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "=============================================="
  echo
  echo "[1] Aktuelle Datenwurzel laut Docker: $AKTUELL"
  [ "$AKTUELL" = "$NEU" ] && echo "    -> Laeuft schon auf dem Volume. Nichts zu tun (ausser ggf. --loesche-altes)."
  echo
  echo "[2] Ist '$NEU_MOUNT' ein echtes, separates Volume?"
  if [ "$VOLUME_OK" = "1" ]; then
    echo "    OK      $NEU_MOUNT liegt auf $(findmnt -no SOURCE "$NEU_MOUNT")"
    df -h "$NEU_MOUNT" | sed 's/^/            /'
  else
    echo "    FEHLT   '$NEU_MOUNT' ist nicht eingebunden — Umzug nicht moeglich. lsblk pruefen."
  fi
  echo
  echo "[3] Steht '$NEU_MOUNT' dauerhaft in /etc/fstab (ueberlebt einen Neustart)?"
  if [ "$FSTAB_OK" = "1" ]; then
    echo "    OK      Eintrag vorhanden."
  else
    echo "    FEHLT   Kein Eintrag — nach einem Neustart waere das Volume nicht da, und Docker"
    echo "            wuerde mit einer leeren/alten Datenwurzel starten. Mit 'blkid' die UUID"
    echo "            holen und mit 'nofail' in /etc/fstab eintragen, BEVOR --apply laeuft."
  fi
  echo
  echo "[4] Platzbedarf"
  if [ -d "$ALT" ]; then
    echo "    Alte Datenwurzel ($ALT): $(du -sh "$ALT" 2>/dev/null | cut -f1)"
  else
    echo "    '$ALT' existiert nicht (schon umgezogen oder anderer Pfad?)."
  fi
  df -h / "$NEU_MOUNT" 2>/dev/null | sed 's/^/    /'
  echo
  echo "[5] Laeuft gerade ein Build/Deploy? (bitte abwarten, nicht parallel umziehen)"
  if [ "$BUILD_LAEUFT" = "1" ]; then
    echo "    WARNUNG Es sieht nach einem laufenden Build aus — jetzt NICHT --apply starten."
  else
    echo "    OK      Kein laufender Build gefunden (bestes Schaetzen, kein Beweis — auch"
    echo "            /var/log/oly-deploy.log pruefen, ob gerade etwas laeuft)."
  fi
  echo
  echo "[6] Vorhandene Container"
  docker ps --format '    {{.Names}}  {{.Status}}' 2>/dev/null
  echo
  echo "=============================================="
  echo " NUR BERICHT — nichts wurde angefasst."
  echo " Wenn [2] und [3] OK zeigen und [5] kein WARNUNG: bash $0 --apply"
  echo "=============================================="
  exit 0
fi

# ------------------------------------------------------------------------------------------ --apply
echo "[0/8] Vorpruefung ..."
if [ "$AKTUELL" = "$NEU" ]; then
  echo "FEHLER: Docker laeuft schon auf '$NEU' — nichts umzuziehen." >&2
  exit 1
fi
if [ "$AKTUELL" != "$ALT" ]; then
  echo "FEHLER: Aktuelle Datenwurzel ist '$AKTUELL', nicht die erwartete '$ALT'." >&2
  echo "        Mit OLY_DOCKER_ALT=<richtiger-pfad> erneut starten." >&2
  exit 1
fi
if [ "$VOLUME_OK" != "1" ]; then
  echo "FEHLER: '$NEU_MOUNT' ist nicht eingebunden. Siehe Bericht (ohne Option) fuer Details." >&2
  exit 1
fi
if [ "$FSTAB_OK" != "1" ]; then
  echo "FEHLER: '$NEU_MOUNT' steht nicht in /etc/fstab. Erst eintragen (mit 'nofail'), sonst" >&2
  echo "        fehlt die Datenwurzel nach dem naechsten Neustart komplett." >&2
  exit 1
fi
if [ "$BUILD_LAEUFT" = "1" ]; then
  echo "FEHLER: Es sieht nach einem laufenden Build aus. Erst abwarten, dann erneut starten." >&2
  exit 1
fi
if [ -d "$NEU" ] && [ -n "$(ls -A "$NEU" 2>/dev/null)" ]; then
  echo "FEHLER: '$NEU' existiert schon und ist nicht leer. Von Hand pruefen, bevor hier" >&2
  echo "        weitergemacht wird — das sieht nach einem halb fertigen frueheren Versuch aus." >&2
  exit 1
fi
PUFFER_BYTES=$((ALT_GROESSE_BYTES + ALT_GROESSE_BYTES / 10))
if [ "$ALT_GROESSE_BYTES" -gt 0 ] && [ "$FREI_NEU_BYTES" -lt "$PUFFER_BYTES" ]; then
  echo "FEHLER: Zu wenig Platz auf '$NEU_MOUNT' (frei: $FREI_NEU_BYTES Bytes, gebraucht mit" >&2
  echo "        10% Puffer: $PUFFER_BYTES Bytes)." >&2
  exit 1
fi
echo "       Alt: $ALT ($(du -sh "$ALT" 2>/dev/null | cut -f1))  ->  Neu: $NEU"

echo "[1/8] Spielstand zusaetzlich sichern (Gueter-Sicherung, unabhaengig vom Umzug) ..."
mkdir -p /root/oly-save-sicherungen
compose exec -T oly-app node -e "
  const Database = require('better-sqlite3');
  const db = new Database('$DB_IM_CONTAINER');
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
" >/dev/null 2>&1 || echo "       (Checkpoint fehlgeschlagen — App laeuft evtl. schon nicht mehr; weiter.)"
compose cp "oly-app:$DB_IM_CONTAINER" "/root/oly-save-sicherungen/oly-app-vor-datenwurzel-umzug-$STEMPEL.sqlite" 2>/dev/null \
  && gzip -f "/root/oly-save-sicherungen/oly-app-vor-datenwurzel-umzug-$STEMPEL.sqlite" \
  && echo "       gesichert: /root/oly-save-sicherungen/oly-app-vor-datenwurzel-umzug-$STEMPEL.sqlite.gz" \
  || echo "       WARNUNG: Zusatz-Sicherung fehlgeschlagen (weiter — der eigentliche Schutz ist unten: nichts wird geloescht)."

echo "[2/8] Compose-Stack anhalten ..."
compose down

echo "[3/8] Docker-Daemon anhalten ..."
systemctl stop docker.socket 2>/dev/null || true
systemctl stop docker.service

echo "[4/8] Daten nach '$NEU' kopieren (rsync, das kann einige Minuten dauern) ..."
mkdir -p "$NEU"
rsync -aHAX --info=progress2 "$ALT/" "$NEU/"

echo "[5/8] '$DAEMON_JSON' auf die neue Datenwurzel umstellen ..."
SICHERUNG_DAEMON_JSON="$DAEMON_JSON.vor-umzug-$STEMPEL.bak"
if [ -f "$DAEMON_JSON" ]; then
  cp "$DAEMON_JSON" "$SICHERUNG_DAEMON_JSON"
else
  echo "{}" > "$SICHERUNG_DAEMON_JSON"
fi
python3 - "$DAEMON_JSON" "$NEU" <<'PYEOF'
import json
import sys

pfad, neue_wurzel = sys.argv[1], sys.argv[2]
try:
    with open(pfad) as f:
        inhalt = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    inhalt = {}
inhalt["data-root"] = neue_wurzel
with open(pfad, "w") as f:
    json.dump(inhalt, f, indent=2)
    f.write("\n")
PYEOF
echo "       Sicherung der alten Datei: $SICHERUNG_DAEMON_JSON"
cat "$DAEMON_JSON"

echo "[6/8] Docker-Daemon starten ..."
systemctl start docker.service
systemctl start docker.socket 2>/dev/null || true
if ! warte_auf_dockerd; then
  echo "FEHLER: Docker-Daemon antwortet nach 30s nicht an der neuen Datenwurzel." >&2
  echo "        Zurueckdrehen mit:  $0 --zurueck" >&2
  exit 1
fi
NEUE_WURZEL_LAUT_DOCKER="$(aktuelle_datenwurzel)"
echo "       Docker laeuft jetzt auf: $NEUE_WURZEL_LAUT_DOCKER"
if [ "$NEUE_WURZEL_LAUT_DOCKER" != "$NEU" ]; then
  echo "FEHLER: Docker meldet eine andere Datenwurzel als erwartet." >&2
  echo "        Zurueckdrehen mit:  $0 --zurueck" >&2
  exit 1
fi

echo "[7/8] Compose-Stack starten ..."
compose up -d

echo "[8/8] Startpruefung ..."
if warte_auf_app; then
  echo ""
  echo "FERTIG — Docker laeuft jetzt auf '$NEU', die alte Datenwurzel liegt noch unter '$ALT'."
  echo "Pruef kurz im Browser, ob alles normal aussieht. Danach, FRUEHESTENS NACH DER PRUEFUNG,"
  echo "den Platz auf der Root-Platte zurueckholen mit:"
  echo "    bash $0 --loesche-altes"
  echo "Falls doch etwas nicht stimmt, zuerst zurueckdrehen (die alte Datenwurzel ist noch da):"
  echo "    bash $0 --zurueck"
  df -h /
  exit 0
fi

echo "" >&2
echo "WARNUNG: Die App meldet sich nach 2 Minuten nicht mit lesbaren Spielstaenden." >&2
echo "Zurueckdrehen mit:  $0 --zurueck" >&2
echo "(Die alte Datenwurzel liegt unverandert unter $ALT.)" >&2
exit 1
