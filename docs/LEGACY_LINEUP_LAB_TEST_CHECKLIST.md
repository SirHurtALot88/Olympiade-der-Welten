# Legacy Lineup Lab Test Checklist

## URL

- `http://localhost:3000/foundation/legacy-lineup-lab`

## Erwartete Defaults

- Save: `save-initial`
- Season: `season-1`
- Matchday: `matchday-1`
- Team bevorzugt: `B-B / Blazing Beasts`
- Fallback:
  - wenn `B-B` nicht genug `ActivePlayers` fuer D1 + D2 hat, wird automatisch ein anderes valides Team gewaehlt

## Was beim Laden sichtbar sein sollte

- Titel `Legacy Lineup Lab`
- Hinweis `Prisma/Supabase`
- Hinweis `Write scope: Lineup and LineupSlot only`
- D1-Disziplin mit erwarteter Spieleranzahl
- D2-Disziplin mit erwarteter Spieleranzahl
- Team-Kontext mit `ActivePlayers`
- pro Slot genau ein Player-Select

## Load Draft

1. Seite aufrufen
2. `Kontext laden`
3. `Load Draft`

Erwartung:
- bestehender Draft wird geladen, falls vorhanden
- wenn kein Draft existiert:
  - klare Meldung
  - kein Fehlerzustand der ganzen Seite

## Save Draft

1. pro D1-/D2-Slot Spieler waehlen
2. `Save Draft`

Erwartung:
- nur Team-`ActivePlayers` sind auswaehlbar
- Doppelnutzung ueber D1/D2 wird moeglichst schon in der Auswahl verhindert
- serverseitige Validierung bleibt entscheidend
- Erfolgsmeldung nach Save

## Preview Score

1. nach einer gueltigen Slot-Auswahl `Preview Score`

Erwartung:
- D1 Score sichtbar
- D2 Score sichtbar
- Total Score sichtbar
- Validation Warnings sichtbar, falls vorhanden
- Missing Scores sichtbar, falls vorhanden

## Zweites Speichern ohne Duplikate

1. denselben Draft direkt noch einmal speichern
2. optional danach erneut `Load Draft`

Erwartung:
- Slotanzahl bleibt stabil
- keine duplizierten `LineupSlot`-Eintraege
- gespeicherter Draft bleibt konsistent

## Verbotene Writes

Dieses Lab darf nur schreiben:
- `Lineup`
- `LineupSlot`

Es darf **nicht** schreiben:
- SQLite Save-State
- Transferdaten
- AI-Daten
- Slot-v2-Daten
- Formkarten
- Captain
- Taktiken
- Season-/Standings-/History-Daten

## Fehler, die lokal manuell geprueft werden sollten

- unvollstaendige Slot-Belegung
- doppelte Spielerwahl
- Spieler ausserhalb des Team-Kaders
- API-Fehler werden als lesbare Meldung angezeigt

## Wenn etwas nicht stimmt

- zuerst `npm test`
- dann `npm run build`
- danach lokal Seite neu laden und denselben Save/Season/Matchday/Team-Kontext noch einmal pruefen

Wenn Browser-/Localhost-Checks in Codex selbst instabil sind, ist der manuelle lokale Browser-Test die verlaessliche Quelle fuer das letzte UI-Feintuning.
