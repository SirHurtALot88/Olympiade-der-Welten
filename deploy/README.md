# Dauerhaftes Hosting

Diese App ist fuer einen dauerhaften Server besser als fuer reine Static-Hoster geeignet, weil sie einen eigenen Node-Server, Socket.io und eine beschreibbare SQLite-Datei nutzt.

## Empfohlener Weg

Nutze einen Hosting-Anbieter oder VPS, der Docker-Container und einen dauerhaften Speicherbereich anbietet. Geeignet sind zum Beispiel Render, Fly.io, Railway oder ein eigener kleiner VPS.

Fuer dieses Projekt ist aktuell Hetzner Cloud CX23 die empfohlene Preis-Leistungs-Variante. Die Hetzner-spezifische Vorlage liegt in `deploy/hetzner`.

Wichtig ist:

- Der Container muss Port `3000` nach aussen freigeben.
- Der Server startet mit `npm run start`.
- `OLY_APP_SQLITE_PATH` sollte auf einen dauerhaften Speicher zeigen, zum Beispiel `/app/data/persistence/oly-app.sqlite`.
- Der Ordner `/app/data/persistence` muss als Volume/Persistent Disk gemountet werden.

## Warum ein Volume noetig ist

Die Spielstaende liegen in SQLite. Ohne dauerhaftes Volume waeren Aenderungen nach einem Neustart oder Redeploy weg.

Beim ersten Start kopiert `scripts/start-hosted.sh` automatisch die mitgelieferte Datenbank aus `deploy/seed/oly-app.sqlite`, falls im Volume noch keine Datenbank liegt.

## Lokaler Test mit Docker

```sh
docker build -t oly-room .
docker run --rm -p 3000:3000 -v oly-room-data:/app/data/persistence oly-room
```

Danach ist die Seite lokal unter `http://localhost:3000/foundation` erreichbar.

## Checkliste fuer den echten Server

1. Code in ein GitHub-Repository legen.
2. Hosting-Anbieter mit Docker verbinden.
3. Persistent Volume auf `/app/data/persistence` einrichten.
4. Environment setzen: `OLY_APP_SQLITE_PATH=/app/data/persistence/oly-app.sqlite`.
5. Deploy starten und danach `/foundation` oeffnen.

## Build-Status

Der Produktions-Build ist vorbereitet und lokal verifiziert:

```sh
npm run build
npm run start
```

Danach sollte `/foundation` im Produktionsmodus antworten.
