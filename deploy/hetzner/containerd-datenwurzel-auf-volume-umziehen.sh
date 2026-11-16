#!/usr/bin/env bash
# containerd-datenwurzel-auf-volume-umziehen.sh — auf dem Hetzner-Server ausfuehren.
#
# ANLASS (16.11., Folgeschritt zu docker-datenwurzel-auf-volume-umziehen.sh vom 14.11.): Jener
# Umzug zieht NUR Dockers eigene Datenwurzel (`/etc/docker/daemon.json`, Images/Volumes/Build-
# Cache) auf das Hetzner-Volume um. Docker laeuft hier aber ueber den SEPARATEN System-Containerd-
# Dienst (`/run/containerd/containerd.sock`, eigener systemd-Dienst `containerd.service`) mit
# einer EIGENEN Datenwurzel (`/var/lib/containerd`), unabhaengig von Dockers `data-root`. Alle
# Schreibvorgaenge beim Layer-Entpacken laufen tatsaechlich unter
# `/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/...` — der eigentliche Platzfresser
# bei "no space left on device", gemessen am 14.11. mit 23 GB (13 GB davon per
# `docker system prune -af` wegraeumbar, der Rest ist echter Verbrauch). Der Docker-Umzug alleine
# reicht deshalb nicht, s. CLAUDE.md-Abschnitt "Dritter Blockierer".
#
# DIESES SKRIPT ZIEHT DIE CONTAINERD-DATENWURZEL (`root` in `/etc/containerd/config.toml`) AUF
# DASSELBE VOLUME UM, NEBEN Dockers eigene (falls bereits dort). Die `state`-Datenwurzel von
# containerd (Laufzeit-Sockets/PIDs/Fifos, keine Layer-Daten, typischerweise winzig und unter
# `/run` ohnehin fluechtig) wird BEWUSST NICHT umgezogen — sie ist nicht die Ursache des
# Platzproblems, und Laufzeit-Sockets gehoeren eher auf schnellen lokalen Speicher als auf ein
# Netzwerk-Volume.
#
# Eingriff in die laufende Produktion: containerd UND Docker werden kurz komplett angehalten
# (Docker haengt am Containerd-Socket), nicht nur der Compose-Stack.
#
# Nutzung (im Repo-Ordner auf dem Server, also /root/Olympiade-der-Welten):
#   bash deploy/hetzner/containerd-datenwurzel-auf-volume-umziehen.sh              nur Bericht
#   bash deploy/hetzner/containerd-datenwurzel-auf-volume-umziehen.sh --apply      zieht wirklich um
#   bash deploy/hetzner/containerd-datenwurzel-auf-volume-umziehen.sh --zurueck    zurueck auf die alte Datenwurzel
#   bash deploy/hetzner/containerd-datenwurzel-auf-volume-umziehen.sh --loesche-altes
#       loescht die alte Datenwurzel ERST, wenn der Umzug bestaetigt lief (gibt die ~alten GB frei)
#
# OHNE --apply WIRD NICHTS GESCHRIEBEN. Pfade per Umgebungsvariable ueberschreibbar:
#   OLY_CONTAINERD_ALT         Standard: /var/lib/containerd            (die bisherige Datenwurzel)
#   OLY_CONTAINERD_NEU_MOUNT   Standard: /mnt/HC_Volume_106761772       (dasselbe Volume wie beim Docker-Umzug)
#   OLY_CONTAINERD_CONFIG      Standard: /etc/containerd/config.toml
set -uo pipefail

ALT="${OLY_CONTAINERD_ALT:-/var/lib/containerd}"
NEU_MOUNT="${OLY_CONTAINERD_NEU_MOUNT:-/mnt/HC_Volume_106761772}"
NEU="$NEU_MOUNT/containerd"
CONFIG="${OLY_CONTAINERD_CONFIG:-/etc/containerd/config.toml}"
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

# Liest den aktuellen `root`-Wert aus der TOML-Datei — nur die oberste Ebene (vor der ersten
# `[...]`-Tabellenzeile), damit ein gleichnamiger Schluessel in einer Plugin-Sektion nicht
# versehentlich gelesen wird. Fehlt die Zeile (Stock-Konfiguration ohne expliziten `root`),
# gilt containerds eingebauter Default `/var/lib/containerd`.
aktuelle_datenwurzel() {
  if [ ! -f "$CONFIG" ]; then
    echo "/var/lib/containerd"
    return
  fi
  awk -F'=' '
    /^\[/ { exit }
    /^[[:space:]]*root[[:space:]]*=/ {
      wert=$2
      gsub(/^[[:space:]"]+|[[:space:]"]+$/, "", wert)
      print wert
      found=1
      exit
    }
    END { if (!found) print "/var/lib/containerd" }
  ' "$CONFIG"
}

warte_auf_containerd() {
  for _v in $(seq 1 30); do
    [ -S /run/containerd/containerd.sock ] && systemctl is-active --quiet containerd.service && return 0
    sleep 1
  done
  return 1
}

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
  LETZTE_SICHERUNG="$(ls -1t "$CONFIG".vor-umzug-*.bak 2>/dev/null | head -1 || true)"
  if [ -z "$LETZTE_SICHERUNG" ]; then
    echo "FEHLER: Keine Sicherung von '$CONFIG' gefunden — nichts zum Zurueckdrehen." >&2
    exit 1
  fi
  if [ ! -d "$ALT" ]; then
    echo "FEHLER: '$ALT' existiert nicht mehr — vermutlich schon mit --loesche-altes entfernt." >&2
    echo "        Dann ist ein Zurueckdrehen nicht mehr moeglich." >&2
    exit 1
  fi
  echo "[1/5] Compose-Stack anhalten ..."
  compose down || true
  echo "[2/5] Docker-Daemon anhalten ..."
  systemctl stop docker.socket 2>/dev/null || true
  systemctl stop docker.service
  echo "[3/5] Containerd anhalten ..."
  systemctl stop containerd.service
  echo "[4/5] '$CONFIG' auf die Sicherung zuruecksetzen: $LETZTE_SICHERUNG"
  cp "$LETZTE_SICHERUNG" "$CONFIG"
  echo "[5/5] Containerd und Docker wieder starten ..."
  systemctl start containerd.service
  if ! warte_auf_containerd; then
    echo "FEHLER: Containerd antwortet nach 30s nicht." >&2
    exit 1
  fi
  systemctl start docker.service
  systemctl start docker.socket 2>/dev/null || true
  if ! warte_auf_dockerd; then
    echo "FEHLER: Docker-Daemon antwortet nach 30s nicht." >&2
    exit 1
  fi
  compose up -d
  if warte_auf_app; then
    echo ""
    echo "FERTIG — zurueck auf die alte Containerd-Datenwurzel: $(aktuelle_datenwurzel)"
    exit 0
  fi
  echo "WARNUNG: Die App meldet sich nach 2 Minuten nicht mit lesbaren Spielstaenden." >&2
  exit 1
fi

# ---------------------------------------------------------- --loesche-altes
if [ "$MODUS" = "loeschen" ]; then
  AKTUELL="$(aktuelle_datenwurzel)"
  if [ "$AKTUELL" != "$NEU" ]; then
    echo "FEHLER: Containerd laeuft gerade NICHT auf '$NEU' (sondern auf '$AKTUELL')." >&2
    echo "        Erst erfolgreich mit --apply umziehen, dann hier loeschen." >&2
    exit 1
  fi
  if [ ! -d "$ALT" ]; then
    echo "Nichts zu tun — '$ALT' existiert schon nicht mehr." >&2
    exit 0
  fi
  GROESSE="$(du -sh "$ALT" 2>/dev/null | cut -f1)"
  echo "Loesche die alte Containerd-Datenwurzel: $ALT  (Groesse: $GROESSE)"
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
  echo " Containerd-Datenwurzel-Umzug — Diagnose  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "=============================================="
  echo
  echo "[1] Aktuelle Containerd-Datenwurzel (aus '$CONFIG', sonst Default): $AKTUELL"
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
    echo "    FEHLT   Kein Eintrag — nach einem Neustart waere das Volume nicht da, und Containerd"
    echo "            wuerde mit einer leeren/alten Datenwurzel starten. Mit 'blkid' die UUID"
    echo "            holen und mit 'nofail' in /etc/fstab eintragen, BEVOR --apply laeuft."
    echo "            (War der Docker-Umzug schon erfolgreich, steht der Eintrag vermutlich schon da.)"
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
echo "[0/9] Vorpruefung ..."
if [ "$AKTUELL" = "$NEU" ]; then
  echo "FEHLER: Containerd laeuft schon auf '$NEU' — nichts umzuziehen." >&2
  exit 1
fi
if [ "$AKTUELL" != "$ALT" ]; then
  echo "FEHLER: Aktuelle Datenwurzel ist '$AKTUELL', nicht die erwartete '$ALT'." >&2
  echo "        Mit OLY_CONTAINERD_ALT=<richtiger-pfad> erneut starten." >&2
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

echo "[1/9] Compose-Stack anhalten ..."
compose down || true

echo "[2/9] Docker-Daemon anhalten (haengt am Containerd-Socket) ..."
systemctl stop docker.socket 2>/dev/null || true
systemctl stop docker.service

echo "[3/9] Containerd anhalten ..."
systemctl stop containerd.service

echo "[4/9] Daten nach '$NEU' kopieren (rsync, das kann einige Minuten dauern) ..."
mkdir -p "$NEU"
rsync -aHAX --info=progress2 "$ALT/" "$NEU/"

echo "[5/9] '$CONFIG' auf die neue Datenwurzel umstellen ..."
SICHERUNG_CONFIG="$CONFIG.vor-umzug-$STEMPEL.bak"
mkdir -p "$(dirname "$CONFIG")"
if [ -f "$CONFIG" ]; then
  cp "$CONFIG" "$SICHERUNG_CONFIG"
else
  # Stock-Installation ohne eigene config.toml (containerd laeuft rein auf eingebauten Defaults) —
  # erst eine vollstaendige Default-Konfiguration erzeugen, damit der folgende Patch nicht aus
  # Versehen eine unvollstaendige Minimaldatei anlegt, der andere (CRI-/Plugin-)Einstellungen fehlen.
  containerd config default > "$CONFIG"
  echo "{}" > "$SICHERUNG_CONFIG" # Markiert bei --zurueck: "vorher gab es keine eigene Datei"
fi
python3 - "$CONFIG" "$NEU" <<'PYEOF'
import re
import sys

pfad, neue_wurzel = sys.argv[1], sys.argv[2]
with open(pfad) as f:
    zeilen = f.readlines()

muster = re.compile(r'^\s*root\s*=')
ende_oberste_ebene = len(zeilen)
for i, zeile in enumerate(zeilen):
    if zeile.lstrip().startswith("["):
        ende_oberste_ebene = i
        break

ersetzt = False
for i in range(ende_oberste_ebene):
    if muster.match(zeilen[i]):
        zeilen[i] = f'root = "{neue_wurzel}"\n'
        ersetzt = True
        break
if not ersetzt:
    zeilen.insert(0, f'root = "{neue_wurzel}"\n')

with open(pfad, "w") as f:
    f.writelines(zeilen)
PYEOF
echo "       Sicherung der alten Datei: $SICHERUNG_CONFIG"
grep -n '^root' "$CONFIG" | head -1 | sed 's/^/       /'

echo "[6/9] Containerd starten ..."
systemctl start containerd.service
if ! warte_auf_containerd; then
  echo "FEHLER: Containerd antwortet nach 30s nicht an der neuen Datenwurzel." >&2
  echo "        Zurueckdrehen mit:  $0 --zurueck" >&2
  exit 1
fi
NEUE_WURZEL_LAUT_CONFIG="$(aktuelle_datenwurzel)"
echo "       Containerd laeuft jetzt mit root: $NEUE_WURZEL_LAUT_CONFIG"
if [ "$NEUE_WURZEL_LAUT_CONFIG" != "$NEU" ]; then
  echo "FEHLER: Config meldet eine andere Datenwurzel als erwartet." >&2
  echo "        Zurueckdrehen mit:  $0 --zurueck" >&2
  exit 1
fi

echo "[7/9] Docker-Daemon starten ..."
systemctl start docker.service
systemctl start docker.socket 2>/dev/null || true
if ! warte_auf_dockerd; then
  echo "FEHLER: Docker-Daemon antwortet nach 30s nicht (Containerd ok, aber Docker nicht)." >&2
  echo "        Zurueckdrehen mit:  $0 --zurueck" >&2
  exit 1
fi

echo "[8/9] Compose-Stack starten ..."
compose up -d

echo "[9/9] Startpruefung ..."
if warte_auf_app; then
  echo ""
  echo "FERTIG — Containerd laeuft jetzt auf '$NEU', die alte Datenwurzel liegt noch unter '$ALT'."
  echo "Pruef kurz im Browser, ob alles normal aussieht, und ob ein Docker-Build weiterhin klappt"
  echo "(z.B. 'deploy/hetzner/auto-deploy.sh' einmal von Hand). Danach, FRUEHESTENS NACH DER PRUEFUNG,"
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
echo "(Die alte Datenwurzel liegt unveraendert unter $ALT.)" >&2
exit 1
