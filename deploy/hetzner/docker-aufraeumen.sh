#!/usr/bin/env bash
# docker-aufraeumen.sh — auf dem Hetzner-Server ausfuehren, woechentlich per Cron.
#
# ANLASS (14.11.): Root-Platte lief wiederholt voll, u.a. weil Containerd (der separate
# System-Dienst, ueber den Docker hier laeuft — `/run/containerd/containerd.sock`, EIGENE
# Datenwurzel `/var/lib/containerd`, unabhaengig von `/etc/docker/daemon.json`) Reste aus
# gescheiterten Build-Versuchen ansammelte: 23 GB, davon 13 GB mit `docker system prune -af`
# in Sekunden weg. Das war bis dahin nirgends automatisiert — nur `git-repo-aufraeumen.sh`
# raeumte woechentlich auf, das aber ausschliesslich das Git-Repo.
#
# NUR SICHERE, ETABLIERTE SCHRITTE — nichts, was laufende Container oder Spielstaende anfasst:
#   - `docker system prune -af`   entfernt nur, was Docker selbst als ungenutzt kennt (gestoppte
#                                 Container, verwaiste Images, nicht mehr referenzierter Build-
#                                 Cache). OHNE `--volumes`: Volumes (oly-data, lec-data, ...)
#                                 bleiben in jedem Fall unberuehrt, auch ungenutzte waeren safe,
#                                 aber das ist hier bewusst ausgespart, um jedes Risiko zu meiden.
#   - `apt-get clean`            leert nur den Paket-Download-Cache, keine installierten Pakete.
#   - `journalctl --vacuum-time=14d`   kappt nur System-Logs aelter als 2 Wochen.
# Kein `docker stop`, kein `rm -rf`, keine Downtime — anders als
# docker-datenwurzel-auf-volume-umziehen.sh ist dieses Skript bewusst ohne --apply-Schranke,
# weil es genau deshalb unbeaufsichtigt per Cron laufen darf.
#
# Nutzung (im Repo-Ordner auf dem Server, also /root/Olympiade-der-Welten):
#   bash deploy/hetzner/docker-aufraeumen.sh
# Von install-live-save-cron.sh automatisch woechentlich eingerichtet (sonntags 04:20, versetzt
# zur Git-Bereinigung um 04:10 — beide sind in Sekunden bis wenigen Minuten fertig, Ueberlappung
# waere trotzdem unnoetig).
set -uo pipefail

echo "=============================================="
echo " Docker-Aufraeumen  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=============================================="

echo
echo "[1/4] Vorher:"
df -h / | sed 's/^/    /'
VORHER_FREI="$(df -B1 --output=avail / 2>/dev/null | tail -1 | tr -d ' ')"

echo
echo "[2/4] docker system prune -af (nur Ungenutztes, KEINE Volumes) ..."
docker system prune -af 2>&1 | sed 's/^/    /' || echo "    WARNUNG: docker system prune fehlgeschlagen (Docker nicht erreichbar?)."

echo
echo "[3/4] apt-get clean + journalctl --vacuum-time=14d ..."
apt-get clean 2>&1 | sed 's/^/    /' || true
journalctl --vacuum-time=14d 2>&1 | sed 's/^/    /' || true

echo
echo "[4/4] Nachher:"
df -h / | sed 's/^/    /'
NACHHER_FREI="$(df -B1 --output=avail / 2>/dev/null | tail -1 | tr -d ' ')"
if [ -n "$VORHER_FREI" ] && [ -n "$NACHHER_FREI" ]; then
  GEWONNEN=$(( (NACHHER_FREI - VORHER_FREI) / 1024 / 1024 ))
  echo "    Gewonnen: ${GEWONNEN} MB frei"
fi

# Nur eine lesbare Warnung ins Log, keine Aktion — ein Cron soll nichts Unbeaufsichtigtes
# tun, was ueber die drei Schritte oben hinausgeht. Wer das Log liest (oder Claude bei der
# naechsten Sitzung), sieht sofort, ob mehr als die Routine noetig ist.
BELEGT_PROZENT="$(df --output=pcent / 2>/dev/null | tail -1 | tr -d ' %')"
if [ -n "$BELEGT_PROZENT" ] && [ "$BELEGT_PROZENT" -ge 85 ]; then
  echo
  echo "WARNUNG: Root-Platte trotz Aufraeumen bei ${BELEGT_PROZENT}% — das reicht nicht mehr aus."
  echo "         Naechster Schritt: deploy/hetzner/docker-datenwurzel-auf-volume-umziehen.sh"
  echo "         pruefen bzw. containerd selbst (/var/lib/containerd) in den Blick nehmen."
fi

echo
echo "Fertig."
