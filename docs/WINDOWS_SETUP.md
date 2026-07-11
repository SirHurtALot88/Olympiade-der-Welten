# Oly auf einem Windows-PC hosten

Anleitung, um Olympiade der Welten lokal auf einem Windows-PC laufen zu lassen —
inklusive Übertragung eines vorhandenen Spielstands (z. B. eines Long-Run-Saves).

Die App läuft **lokal** im Browser unter `http://localhost:3000/foundation`.
Spielstände liegen in einer lokalen SQLite-Datei (`data/persistence/oly-app.sqlite`),
also **maschinen-lokal** — ein Save muss aktiv übertragen werden (siehe Schritt 5).

---

## Schritt 1 — Node.js installieren

1. https://nodejs.org öffnen → **LTS-Version (20.x)** herunterladen und installieren.
   - Empfehlung: **Node 20**, damit die vorkompilierten Pakete (`better-sqlite3`, `sharp`)
     ohne Extra-Build-Tools passen.
2. Danach neu einloggen oder PC neu starten, damit `node` im Terminal verfügbar ist.
   Prüfen (in der Eingabeaufforderung `cmd`): `node -v` → sollte `v20.x.x` zeigen.

## Schritt 2 — Git installieren

- https://git-scm.com/download/win → installieren (Standardoptionen sind ok).
- Prüfen: `git --version`.

## Schritt 3 — Projekt holen

Das Repository ist privat — du brauchst deinen GitHub-Zugang.

```cmd
cd %USERPROFILE%\Documents
git clone https://github.com/SirHurtALot88/Olympiade-der-Welten.git
cd Olympiade-der-Welten
```

(Beim ersten `git clone` fragt Windows nach deinem GitHub-Login.)

## Schritt 4 — Umgebungsdatei (optional, aber empfohlen)

Für den reinen Solo-/Foundation-Betrieb reicht SQLite; eine `.env.local` ist **nicht**
zwingend. Für alle Funktionen (Prisma/Supabase-gestützte Teile) kopiere deine bestehende
`.env.local` vom Mac in den Projekt-Ordner auf dem PC (gleiches Verzeichnis wie diese Datei
liegt im Repo-Root). Werte siehe `ENV_SETUP.md`. **Keine Passwörter in dieses Dokument.**

## Schritt 5 — Spielstand (Long-Run) übertragen

Der Save wird als portables Backup-Paket übertragen.

**Auf der Quell-Maschine** (dort, wo der Long-Run aktuell liegt):

```cmd
npm run backup:save
```

Das legt ein Paket unter `backups\saves\<zeitstempel>\` an (enthält `oly-app.sqlite` +
`manifest.json`). Diesen **Ordner** komplett auf den Windows-PC kopieren
(USB-Stick, Dropbox, Netzwerk).

**Auf dem Windows-PC** (im Projekt-Ordner):

```cmd
npm run restore:save -- "C:\Pfad\zum\backup\saves\<zeitstempel>"
```

Ausgabe bestätigt den aktiven Save und die Anzahl. Ein Sicherheits-Backup des vorherigen
Standes wird automatisch angelegt.

> Hinweis: Läuft der Long-Run in einer Cloud-/Claude-Session, dort zuerst `npm run backup:save`
> ausführen und das Paket herunterladen/in Dropbox sichern, **bevor** die Session abläuft —
> sonst geht der Spielstand verloren.

## Schritt 6 — Starten

Im Projekt-Ordner die Datei **`Oly starten.bat`** doppelklicken.

- Beim ersten Start installiert sie automatisch die Abhängigkeiten (`npm install`, dauert
  ein paar Minuten).
- Danach startet der Server und der Browser öffnet automatisch
  `http://localhost:3000/foundation?view=home`.
- Zum Beenden das schwarze Fenster schließen.

Alternativ manuell:

```cmd
npm run dev
```

…und dann im Browser `http://localhost:3000/foundation?view=home` öffnen.

---

## Falls `npm install` hängt oder mit Build-Fehlern abbricht

`better-sqlite3` und `sharp` sind native Pakete. Mit **Node 20** gibt es normalerweise
fertige Binaries. Falls doch kompiliert werden muss:

- Sicherstellen, dass **Node 20 LTS** verwendet wird (nicht die neueste ungerade Version).
- Notfalls Windows-Build-Tools nachinstallieren:
  `npm install --global windows-build-tools` (in einer Admin-`cmd`), dann `npm install` erneut.

## Vom Handy / anderen Geräten im gleichen WLAN zugreifen

Der Server bindet auf `0.0.0.0`, ist also im lokalen Netz erreichbar:

1. Windows-IP herausfinden: `ipconfig` → „IPv4-Adresse" (z. B. `192.168.1.50`).
2. Windows-Firewall: eingehende Verbindungen auf Port `3000` erlauben.
3. Vom anderen Gerät im selben WLAN: `http://192.168.1.50:3000/foundation` öffnen.

Für echten Zugriff „von überall" (außerhalb des WLANs) wäre ein Hosting-Deploy nötig
(siehe `docs/deployment-hetzner-v1.md`) — das ist bewusst noch nicht eingerichtet.
