# Hetzner Deployment V1

Ziel: eine kleine, guenstige Test-/Entwicklungsumgebung, nicht der endgueltige Live-Launch.

## Empfehlung

- Server: Hetzner Cloud CX23
- Region: Nuernberg oder Falkenstein
- System: Ubuntu 24.04
- Backup: Hetzner-Server-Backup aktivieren
- Domain: einfache `.de` Domain reicht
- Zielseite: `https://deine-domain.de/foundation`
- Healthcheck: `https://deine-domain.de/api/health`

## Empfohlener Betrieb

V1 nutzt Docker Compose und Caddy:

- Docker startet die App und haelt sie am Leben.
- `restart: unless-stopped` startet nach Crash und Reboot wieder.
- Caddy macht HTTPS automatisch.
- SQLite liegt in einem Docker-Volume unter `/app/data/persistence`.

Server-Voraussetzungen:

- git
- Docker + Docker Compose Plugin
- Firewall offen fuer 80 und 443
- Domain zeigt per A-Record auf die Server-IP

Alternative ohne Docker:

- Node LTS
- npm
- git
- pm2 oder systemd service
- nginx reverse proxy
- certbot / Let's Encrypt

Docker+Caddy ist fuer dieses Projekt einfacher und weniger fehleranfaellig.

## Start auf dem Server

1. Repo auf den Server holen.
2. `deploy/hetzner/.env` aus `deploy/hetzner/.env.example` erstellen.
3. Echte Domain eintragen:

```sh
OLY_DOMAIN=deine-domain.de
```

4. App starten:

```sh
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env up -d --build
```

5. Healthcheck pruefen:

```sh
curl https://deine-domain.de/api/health
```

## Deploy-Regel

Vor jedem Deploy laeuft ein Save-Backup. Der einfache Weg:

```sh
npm run deploy:hetzner
```

Das Skript bricht automatisch ab, wenn das Backup fehlschlaegt.

Manuell entspricht das:

```sh
npm run backup:save
git pull
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env up -d --build
```

## Logs

App-Logs:

```sh
docker compose -f deploy/hetzner/docker-compose.yml logs -f oly-app
```

HTTPS-/Proxy-Logs:

```sh
docker compose -f deploy/hetzner/docker-compose.yml logs -f caddy
```

## Ports

- 80: HTTP, nur fuer Zertifikat/Weiterleitung
- 443: HTTPS fuer Browser
- 3000: intern im Docker-Netz, nicht direkt oeffentlich noetig

## Secrets

Keine Secrets ins Repo:

- kein Hetzner API-Token
- keine echten `.env` Dateien
- keine privaten SSH-Keys
- keine Zahlungsdaten
