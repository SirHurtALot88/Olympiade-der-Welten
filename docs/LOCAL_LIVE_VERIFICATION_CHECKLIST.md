# Local Live Verification Checklist

Diese Checkliste ist fuer die manuelle lokale Pruefung der Foundation-Reads gedacht.

## Automatischer Schnellcheck

- Script:
  - `npm run app:check-live`
- prueft bei laufendem Dev-Server:
  - `/foundation`
  - `/api/transfermarkt/free-agents?saveId=save-initial&seasonId=season-1&limit=5`
  - `/api/transfermarkt/history?saveId=save-initial&seasonId=season-1&limit=5`
  - `/api/standings/preview?saveId=save-initial&seasonId=season-1&matchdayId=matchday-1`
  - `/api/season/prize-preview?saveId=save-initial&seasonId=season-1`
- wenn kein lokaler Server laeuft:
  - Ausgabe: `dev server not running`
  - das ist kein Codefehler

## Start

1. Im Projektordner den Dev-Server starten:
   - `npm run dev`
2. Warten, bis der lokale Server auf `http://localhost:3000` laeuft.

## Seiten pruefen

1. Standardmodus:
   - `http://localhost:3000/foundation`
   - `http://localhost:3000/foundation/transfermarkt-lab`
2. Expliziter SQLite-Modus:
   - `http://localhost:3000/foundation?source=sqlite`
3. Expliziter Prisma-/Supabase-Modus:
   - `http://localhost:3000/foundation?source=prisma`

## Erwartetes Verhalten

### SQLite / Default

- Die Foundation soll wie bisher laden.
- Sichtbarer Status:
  - `Read source: SQLite/local`
- Save-Interaktionen bleiben nutzbar:
  - `Neuer Save`
  - `Save duplizieren`
  - Save-Auswahl / Save-Wechsel
- Lokale Bearbeitungen sollen weiter wie bisher moeglich sein.

### Prisma / Supabase

- Die Foundation soll mit dem Prisma-/Supabase-Read laden.
- Sichtbarer Status:
  - `Read source: Prisma/Supabase · Read-only`
- Der Modus ist read-only.

### Transfermarkt Lab

- `http://localhost:3000/foundation/transfermarkt-lab`
- API-Direktcheck:
  - `http://localhost:3000/api/transfermarkt/free-agents?saveId=save-initial&seasonId=season-1&limit=5`
- erwarteter Scope:
  - `save-initial / season-1`
- erwartetes Verhalten:
  - `total` sichtbar
  - erwarteter `total`-Wert aktuell: `2723`
  - Free Agents sichtbar
  - API-Status sichtbar
  - Source sichtbar
  - Scope sichtbar
  - ohne Team in der Fit-Spalte: `Team wählen`
  - mit Team: `Golden-Master-Fit noch nicht portiert`
  - bei kaputten Portraitpfaden Placeholder statt Crash
  - sichtbare Spielerbeispiele:
    - `Citrine Miri`
    - `Robin Hood`

### Foundation Transfermarkt

- `http://localhost:3000/foundation`
- Tab `Transfermarkt`
- erwartetes Verhalten:
  - sichtbarer Hinweis `Sortierung: Marktwert ↓`
  - Free Agents sichtbar
  - ohne Teamauswahl steht in der Fit-Spalte `Team waehlen`
  - mit Teamauswahl erscheinen nur Team-Kontextinfos, keine echte Golden-Master-Fit-Zahl

## Transfermarkt Buy Smoke

- Dry-run:
  - `npm run transfermarkt:smoke-buy`
- echter Write nur bewusst:
  - `npm run transfermarkt:smoke-buy -- --write`

Erwartung:

- Dry-run liefert Preview-Daten
- ohne `--write` keine DB-Writes
- mit `--write` nur:
  - neuer `ActivePlayer`
  - neuer `Transfer`
  - reduzierter `TeamSeasonState.cash`
- keine Standings-/Result-/SQLite-Aenderungen

## Im Prisma-Modus gesperrte Aktionen

Diese Aktionen sollen im Prisma-Modus deaktiviert oder klar blockiert sein:

- `Neuer Save`
- `Save duplizieren`
- Save-Auswahl / Save-Wechsel
- `AI Turn simulieren`

Wenn eine blockierte Aktion doch ausloesbar ist, ist das ein Fehler.

## Was bei Ladeproblemen pruefen

1. Server-Konsole pruefen:
   - Gibt es Prisma-/Supabase-Fehler?
   - Gibt es `P1017`, Verbindungsabbrueche oder Timeouts?
2. Browser-Konsole pruefen:
   - Gibt es sichtbare Fehler oder wiederholte Request-Fehler?
3. API direkt im Browser pruefen:
   - `http://localhost:3000/api/singleplayer-state`
   - `http://localhost:3000/api/singleplayer-state?source=sqlite`
   - `http://localhost:3000/api/singleplayer-state?source=prisma`
4. Wenn `source=prisma` langsam ist:
   - besonders auf folgende Datenbereiche achten:
     - Players
     - PlayerAttributes
     - PlayerDisciplineScores
     - ActivePlayers
5. Wenn SQLite laeuft, aber Prisma nicht:
   - SQLite ist weiter Fallback / Default
   - Prisma-Read ist dann separat zu untersuchen, ohne Write-Pfade anzufassen

## Zielbild

- `/foundation` funktioniert weiter ueber SQLite wie bisher.
- `/foundation?source=sqlite` entspricht dem Standardmodus.
- `/foundation?source=prisma` laedt read-only mit sichtbarem Prisma-/Supabase-Badge.
