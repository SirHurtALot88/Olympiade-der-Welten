# Bug-Meldungen aus dem Spiel

Hier landet jede Meldung, die über die rote Flagge oben rechts abgeschickt wird — eine JSON-Datei je
Meldung, benannt nach ihrem Zeitstempel (`bug-<ISO>-<random>.json`), also chronologisch sortiert.

Der Ordner wird **ins Repo committet** (wie `data/online-saves/`), damit die Meldungen überall lesbar
sind, nicht nur auf dem Rechner, auf dem gespielt wurde.

## Was in einer Meldung steht

| Feld | Woher |
|---|---|
| `note` | Freitext des Melders — optional |
| `view` | `?view=`-Parameter — nur innerhalb der Foundation-Shell vorhanden |
| `path`, `pageTitle` | Browser — benennen die Seite auch dort, wo `view` fehlt (Login, Cockpit, Startseite) |
| `url`, `viewport`, `clientTime` | vom Browser beim Klick |
| `reporter.ownerId`, `reporter.label` | Session-Benutzer; ohne Login der lokale Benutzer |
| `reporter.fromSession` | `false` = die Identität ist erschlossen, nicht belegt |
| `userAgent` | aus dem Request-Header |
| `game.saveId`, `game.saveName` | aktiver Spielstand |
| `game.seasonId`, `game.seasonYear`, `game.currentMatchday` | Saison und Spieltag |
| `game.matchdayId`, `game.matchdayStatus` | Zustand des Spieltags |
| `game.activeTeamIds` | die vom Menschen geführten Teams (`teamControlSettings.controlMode === "manual"`) |

`game` ist `null`, wenn beim Melden kein Spielstand aktiv war (Login-Seite, frische Installation).
Eine Meldung ohne Spielkontext ist weniger wert, aber besser als keine — deshalb wird sie trotzdem
geschrieben.

## Nachschauen

- Dateien direkt lesen, oder
- `GET /api/bug-report` — liefert die letzten 50 Meldungen als JSON.

## Wer sich darum kümmert

Aktuell: **niemand automatisch**. Die Datei liegt auf dem Rechner, auf dem der Server lief, und
erreicht das Repo erst, wenn sie committet und gepusht wird. Solange das nicht passiert, sieht sie
ausser dem Melder niemand.

Der Weg von hier zu einer Vorlage mit Vorpruefung steht in `docs/bug-triage-konzept.md`.
