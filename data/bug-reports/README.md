# Bug-Meldungen aus dem Spiel

Hier landet jede Meldung, die über die rote Flagge oben rechts abgeschickt wird — eine JSON-Datei je
Meldung, benannt nach ihrem Zeitstempel (`bug-<ISO>-<random>.json`), also chronologisch sortiert.

Der Ordner wird **ins Repo committet** (wie `data/online-saves/`), damit die Meldungen überall lesbar
sind, nicht nur auf dem Rechner, auf dem gespielt wurde.

## Was in einer Meldung steht

| Feld | Woher |
|---|---|
| `note` | Freitext des Melders — optional |
| `view`, `url`, `viewport`, `clientTime` | vom Browser beim Klick |
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
