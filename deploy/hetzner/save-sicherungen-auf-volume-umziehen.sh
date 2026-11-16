#!/usr/bin/env bash
# save-sicherungen-auf-volume-umziehen.sh — auf dem Hetzner-Server ausfuehren.
#
# ANLASS (16.11., Chris: "lass uns das groesste auf jeden fall umziehen weil das externe volume
# kann ich beliebig vergroessern"): drei Skripte legen bei jedem Lauf eine gezippte KOMPLETTE
# Kopie des Spielstands unter `/root/oly-save-sicherungen/` auf der Root-Platte ab —
# `docker-datenwurzel-auf-volume-umziehen.sh`, `kader-auffuellen.sh` und `pull-repaired-save.sh`.
# Keines der drei raeumt dort auf, und keiner der bestehenden Aufraeum-Crons
# (`docker-aufraeumen.sh`, `git-repo-aufraeumen.sh`) kennt diesen Ordner. Er waechst also
# unbegrenzt auf der Root-Platte, waehrend das Hetzner-Volume (beliebig vergroesserbar) genau
# dafuer gedacht ist.
#
# DIESES SKRIPT ZIEHT NUR DIESEN EINEN ORDNER UM — kein Dienst haengt an seinem exakten Pfad
# ausser den drei Skripten oben, und die lesen/schreiben ausschliesslich ueber den literalen Pfad
# `/root/oly-save-sicherungen`. Deshalb reicht ein Symlink: der Ordner wandert aufs Volume, und an
# seiner alten Stelle liegt danach nur ein Verweis dorthin — alle drei Skripte funktionieren
# unveraendert weiter, ohne eine Zeile Code-Aenderung. Anders als beim Docker-/Containerd-Umzug
# muss dafuer KEIN Dienst angehalten werden (reine Dateiverwaltung, keine laufende Software haengt
# am Pfad), das Skript ist deshalb deutlich kuerzer und risikoaermer als seine beiden Geschwister.
#
# Nutzung (im Repo-Ordner auf dem Server, also /root/Olympiade-der-Welten):
#   bash deploy/hetzner/save-sicherungen-auf-volume-umziehen.sh              nur Bericht
#   bash deploy/hetzner/save-sicherungen-auf-volume-umziehen.sh --apply      zieht wirklich um
#   bash deploy/hetzner/save-sicherungen-auf-volume-umziehen.sh --zurueck    macht den Symlink wieder zu einem echten Ordner
#   bash deploy/hetzner/save-sicherungen-auf-volume-umziehen.sh --loesche-altes
#       loescht die umbenannte alte Kopie ERST, wenn der Umzug bestaetigt lief
#
# OHNE --apply WIRD NICHTS GESCHRIEBEN. Pfade per Umgebungsvariable ueberschreibbar:
#   OLY_SICHERUNG_ALT         Standard: /root/oly-save-sicherungen   (der bisherige, feste Pfad)
#   OLY_SICHERUNG_NEU_MOUNT   Standard: /mnt/HC_Volume_106761772     (dasselbe Volume wie Docker/Containerd)
set -uo pipefail

ALT="${OLY_SICHERUNG_ALT:-/root/oly-save-sicherungen}"
NEU_MOUNT="${OLY_SICHERUNG_NEU_MOUNT:-/mnt/HC_Volume_106761772}"
NEU="$NEU_MOUNT/oly-save-sicherungen"
STEMPEL="$(date '+%Y%m%d-%H%M%S')"

MODUS="bericht"
case "${1:-}" in
  --apply) MODUS="apply" ;;
  --zurueck) MODUS="zurueck" ;;
  --loesche-altes) MODUS="loeschen" ;;
  "") ;;
  *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
esac

ist_symlink_auf_neu() {
  [ -L "$ALT" ] && [ "$(readlink -f "$ALT")" = "$(readlink -f "$NEU")" ]
}

# ---------------------------------------------------------------- --zurueck
if [ "$MODUS" = "zurueck" ]; then
  if ! ist_symlink_auf_neu; then
    echo "FEHLER: '$ALT' ist gerade kein Symlink auf '$NEU' — nichts zum Zurueckdrehen." >&2
    exit 1
  fi
  LETZTE_UMBENANNTE="$(ls -1dt "$ALT".vor-umzug-* 2>/dev/null | head -1 || true)"
  if [ -z "$LETZTE_UMBENANNTE" ]; then
    echo "FEHLER: Keine umbenannte alte Kopie ('$ALT.vor-umzug-*') gefunden — vermutlich schon" >&2
    echo "        mit --loesche-altes entfernt. Dann ist ein Zurueckdrehen nicht mehr moeglich." >&2
    exit 1
  fi
  echo "[1/2] Symlink entfernen ..."
  rm "$ALT"
  echo "[2/2] Alte Kopie zurueckbenennen: $LETZTE_UMBENANNTE -> $ALT"
  mv "$LETZTE_UMBENANNTE" "$ALT"
  echo ""
  echo "FERTIG — '$ALT' ist wieder ein echter Ordner auf der Root-Platte."
  echo "Die Kopie auf dem Volume ('$NEU') liegt unveraendert dort, falls doch noch gebraucht."
  exit 0
fi

# ---------------------------------------------------------- --loesche-altes
if [ "$MODUS" = "loeschen" ]; then
  if ! ist_symlink_auf_neu; then
    echo "FEHLER: '$ALT' ist gerade kein Symlink auf '$NEU' — erst mit --apply umziehen." >&2
    exit 1
  fi
  GEFUNDEN=0
  for ORDNER in "$ALT".vor-umzug-*; do
    [ -d "$ORDNER" ] || continue
    GEFUNDEN=1
    GROESSE="$(du -sh "$ORDNER" 2>/dev/null | cut -f1)"
    echo "Loesche die alte Kopie: $ORDNER  (Groesse: $GROESSE)"
  done
  if [ "$GEFUNDEN" = "0" ]; then
    echo "Nichts zu tun — keine umbenannte alte Kopie mehr gefunden." >&2
    exit 0
  fi
  echo "Letzte Warnung — 5 Sekunden Zeit zum Abbrechen (Strg+C)."
  sleep 5
  rm -rf "$ALT".vor-umzug-*
  echo "FERTIG."
  df -h /
  exit 0
fi

# -------------------------------------------------------------------- Bericht (auch Vorpruefung fuer --apply)
VOLUME_OK=0
FSTAB_OK=0
FREI_NEU_BYTES=0
ALT_GROESSE_BYTES=0
SCHON_UMGEZOGEN=0

if findmnt -no SOURCE "$NEU_MOUNT" >/dev/null 2>&1; then
  VOLUME_OK=1
  FREI_NEU_BYTES="$(df -B1 --output=avail "$NEU_MOUNT" | tail -1 | tr -d ' ')"
fi
grep -q "$NEU_MOUNT" /etc/fstab 2>/dev/null && FSTAB_OK=1
ist_symlink_auf_neu && SCHON_UMGEZOGEN=1
if [ -d "$ALT" ] && [ ! -L "$ALT" ]; then
  ALT_GROESSE_BYTES="$(du -sb "$ALT" 2>/dev/null | cut -f1)"
fi

if [ "$MODUS" = "bericht" ]; then
  echo "=============================================="
  echo " Save-Sicherungen-Umzug — Diagnose  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "=============================================="
  echo
  echo "[1] Aktueller Stand von '$ALT'"
  if [ "$SCHON_UMGEZOGEN" = "1" ]; then
    echo "    -> Ist schon ein Symlink auf '$NEU'. Nichts zu tun (ausser ggf. --loesche-altes)."
  elif [ -L "$ALT" ]; then
    echo "    WARNUNG Ist ein Symlink, aber NICHT auf '$NEU' (sondern auf $(readlink -f "$ALT"))."
    echo "            Von Hand pruefen, bevor hier weitergemacht wird."
  elif [ -d "$ALT" ]; then
    echo "    Echter Ordner, Groesse: $(du -sh "$ALT" 2>/dev/null | cut -f1) ($(find "$ALT" -maxdepth 1 -type f 2>/dev/null | wc -l) Dateien)"
  else
    echo "    Existiert noch nicht (noch keines der drei Skripte gelaufen) — Umzug legt ihn gleich auf dem Volume an."
  fi
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
    echo "    FEHLT   Kein Eintrag — nach einem Neustart waere das Volume nicht da, und der"
    echo "            Symlink wuerde ins Leere zeigen. Mit 'blkid' die UUID holen und mit"
    echo "            'nofail' in /etc/fstab eintragen, BEVOR --apply laeuft. (War der Docker-"
    echo "            oder Containerd-Umzug schon erfolgreich, steht der Eintrag vermutlich schon da.)"
  fi
  echo
  echo "[4] Platzbedarf"
  df -h / "$NEU_MOUNT" 2>/dev/null | sed 's/^/    /'
  echo
  echo "=============================================="
  echo " NUR BERICHT — nichts wurde angefasst."
  echo " Wenn [2] und [3] OK zeigen: bash $0 --apply"
  echo "=============================================="
  exit 0
fi

# ------------------------------------------------------------------------------------------ --apply
echo "[0/5] Vorpruefung ..."
if [ "$SCHON_UMGEZOGEN" = "1" ]; then
  echo "FEHLER: '$ALT' ist schon ein Symlink auf '$NEU' — nichts umzuziehen." >&2
  exit 1
fi
if [ -L "$ALT" ]; then
  echo "FEHLER: '$ALT' ist ein Symlink, aber nicht auf '$NEU'. Von Hand pruefen." >&2
  exit 1
fi
if [ "$VOLUME_OK" != "1" ]; then
  echo "FEHLER: '$NEU_MOUNT' ist nicht eingebunden. Siehe Bericht (ohne Option) fuer Details." >&2
  exit 1
fi
if [ "$FSTAB_OK" != "1" ]; then
  echo "FEHLER: '$NEU_MOUNT' steht nicht in /etc/fstab. Erst eintragen (mit 'nofail'), sonst" >&2
  echo "        zeigt der Symlink nach einem Neustart ins Leere." >&2
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

echo "[1/5] Zielordner anlegen ..."
mkdir -p "$NEU"

if [ -d "$ALT" ]; then
  echo "[2/5] Vorhandene Sicherungen kopieren (rsync): $ALT -> $NEU ..."
  rsync -aHAX --info=progress2 "$ALT/" "$NEU/"
  echo "[3/5] Alten Ordner umbenennen (nicht loeschen) ..."
  mv "$ALT" "$ALT.vor-umzug-$STEMPEL"
else
  echo "[2/5] '$ALT' existiert noch nicht — nichts zu kopieren."
  echo "[3/5] (kein alter Ordner zum Umbenennen)"
fi

echo "[4/5] Symlink anlegen: $ALT -> $NEU ..."
ln -s "$NEU" "$ALT"

echo "[5/5] Pruefung ..."
if [ "$(readlink -f "$ALT")" != "$(readlink -f "$NEU")" ]; then
  echo "FEHLER: Symlink zeigt nicht auf das erwartete Ziel." >&2
  exit 1
fi
echo ""
echo "FERTIG — '$ALT' ist jetzt ein Symlink auf '$NEU'."
echo "Alle drei Skripte (docker-datenwurzel-auf-volume-umziehen.sh, kader-auffuellen.sh,"
echo "pull-repaired-save.sh) schreiben unveraendert weiter dorthin, nur jetzt auf dem Volume."
if [ -d "$ALT.vor-umzug-$STEMPEL" ]; then
  echo "Die alte Kopie liegt noch unter '$ALT.vor-umzug-$STEMPEL'. Nach kurzer Pruefung (reicht ein"
  echo "'ls $ALT', um zu sehen, dass die Dateien da sind) den Platz zurueckholen mit:"
  echo "    bash $0 --loesche-altes"
fi
df -h /
exit 0
