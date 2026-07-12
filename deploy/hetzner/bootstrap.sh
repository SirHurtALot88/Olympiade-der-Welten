#!/usr/bin/env bash
# Oly Hetzner Bootstrap
# Installiert Docker, legt Swap an (fuer den Build auf kleinem RAM),
# leitet eine kostenlose HTTPS-Adresse (sslip.io) aus der Server-IP ab
# und startet Oly per docker compose. Auf dem frischen Ubuntu-Server als
# root ausfuehren:  bash deploy/hetzner/bootstrap.sh
set -euo pipefail

echo "== Oly Bootstrap =="

# 1) Swap fuer den Build (hilft bei nur 4 GB RAM)
if ! swapon --show 2>/dev/null | grep -q '/swapfile'; then
  echo "-- lege 4G Swap an --"
  fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2) Docker installieren (falls noch nicht vorhanden)
if ! command -v docker >/dev/null 2>&1; then
  echo "-- installiere Docker --"
  curl -fsSL https://get.docker.com | sh
fi

# 3) Kostenlose Adresse + HTTPS aus der oeffentlichen IPv4 ableiten (sslip.io)
IP="$(curl -4 -fsSL https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
DOMAIN="$(echo "$IP" | tr '.' '-').sslip.io"

# 4) .env fuer docker compose schreiben
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "OLY_DOMAIN=${DOMAIN}" > "${SCRIPT_DIR}/.env"

echo "-- Adresse wird: https://${DOMAIN}/foundation --"
echo "-- baue & starte Oly (erster Build dauert ~10-20 Min, bitte einfach warten) --"

# 5) bauen & starten
docker compose -f "${SCRIPT_DIR}/docker-compose.yml" --env-file "${SCRIPT_DIR}/.env" up -d --build

echo ""
echo "============================================================"
echo " FERTIG! Deine Oly-Adresse:"
echo "   https://${DOMAIN}/foundation"
echo " (Das HTTPS-Zertifikat kann beim allerersten Aufruf 1-2 Min brauchen.)"
echo ""
echo " Logs ansehen:  docker compose -f ${SCRIPT_DIR}/docker-compose.yml logs -f oly-app"
echo "============================================================"
