# Hetzner-Setup fuer die Olympiade-App

Entscheidung: Hetzner Cloud ist der Online-/Entlastungsmodus fuer die App. Lokal entwickeln bleibt kostenlos moeglich. Wenn die App von PC, Mac oder Franky erreichbar sein soll, laeuft sie auf dem Hetzner-Server.

## Empfohlenes Paket

- Hetzner Cloud CX23
- Standort: Deutschland, am besten Nuernberg oder Falkenstein
- Betriebssystem: Ubuntu 24.04
- Backups: aktivieren
- Domain: guenstige `.de` Domain
- App-Ziel: `https://deine-domain.de/foundation`
- Healthcheck: `https://deine-domain.de/api/health`

## Erwartete Kosten

- Server CX23: ca. 6,53 EUR brutto pro Monat
- Hetzner-Backup: ca. 20 Prozent vom Serverpreis, also grob 1,30 EUR brutto pro Monat
- `.de` Domain: ca. 3,90 EUR pro Jahr
- HTTPS: 0 EUR, macht Caddy automatisch

Realistisch: ca. 8 bis 9 EUR pro Monat inklusive Backup und einfacher Domain.

## Was vorbereitet ist

- Docker-Build fuer die Next.js-App
- dauerhafter SQLite-Speicher unter `/app/data/persistence`
- Caddy als HTTPS-Proxy
- automatische Weiterleitung von Domain auf die App
- Start mit Docker Compose
- Crash-/Reboot-Restart ueber Docker `restart: unless-stopped`

## Was der Server spaeter braucht

Auf dem Server wird aus dem Repo gestartet:

```sh
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env up -d --build
```

Die Datei `deploy/hetzner/.env` wird aus `.env.example` erstellt und bekommt die echte Domain:

```sh
OLY_DOMAIN=deine-domain.de
```

## Auto-Deploy (Aenderungen automatisch auf den Server)

Damit neue Commits nicht von Hand gezogen werden muessen, pollt der Server per
Cron den `main`-Branch und baut nur bei echten Aenderungen neu. Das Skript nutzt
den bereits gespeicherten Git-Zugang — es liegen **keine** Token bei GitHub oder
in Dateien.

Einmalig auf dem Server einrichten (als root, im Repo-Ordner):

```sh
# Git-Zugang einmalig speichern (Token als Passwort bei der Abfrage eingeben)
git config --global credential.helper store
git pull

# Cron anlegen: alle 5 Minuten nach neuen Commits schauen
( crontab -l 2>/dev/null; \
  echo "*/5 * * * * /root/Olympiade-der-Welten/deploy/hetzner/auto-deploy.sh >> /var/log/oly-deploy.log 2>&1" ) \
  | crontab -
```

Ablauf danach: Pull Request nach `main` mergen -> innerhalb von ~5 Minuten baut
der Server automatisch neu. Logs: `tail -f /var/log/oly-deploy.log`.

Anderen Branch deployen (optional): `OLY_DEPLOY_BRANCH=<branch>` als Env setzen.
Sofort testen ohne Warten: `deploy/hetzner/auto-deploy.sh` einmal von Hand starten.

## Backup-Regel

Die Server-Backups sichern die ganze Maschine. Zusaetzlich muss die Spielstand-Datenbank bewusst geschuetzt werden:

- manuelle Saves duerfen nie automatisch geloescht werden
- Autosaves duerfen pro Kategorie rotieren
- vor groesseren Updates wird ein Server-Backup oder Snapshot erstellt
- vor jedem Deploy laeuft `npm run backup:save`
- die SQLite-Datei liegt in einem Docker-Volume und ueberlebt normale App-Neustarts

## Was Chris einmalig machen muss

1. Hetzner-Account erstellen.
2. Zahlungsmittel hinterlegen.
3. Cloud-Projekt anlegen.
4. SSH-Key oder API-Token bereitstellen.
5. Eine guenstige `.de` Domain kaufen oder auswaehlen.
6. Danach kann Codex beim Server-Setup, Deployment und Verlinken helfen.

## Local Docker Smoke

Lokal vor dem ersten Hetzner-Deploy:

```sh
cp deploy/hetzner/.env.example deploy/hetzner/.env
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env build
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env up -d
curl -fsS http://localhost:3000/api/health
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env down
```

Erwartung: `/api/health` antwortet mit HTTP 200. Die SQLite-Datei liegt im Compose-Volume und bleibt ueber `down`/`up` erhalten, solange das Volume nicht geloescht wird.
