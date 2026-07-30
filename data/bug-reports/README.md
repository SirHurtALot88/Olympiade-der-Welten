# Bug-Meldungen aus dem Spiel

Hier landet jede Meldung, die über die rote Flagge oben rechts abgeschickt wird — eine JSON-Datei je
Meldung, benannt nach ihrem Zeitstempel (`bug-<ISO>-<random>.json`), also chronologisch sortiert.

Der Ordner wird **ins Repo committet** (wie `data/online-saves/`), damit die Meldungen überall lesbar
sind, nicht nur auf dem Rechner, auf dem gespielt wurde.

**Wer sich um die Meldungen kümmert, steht in [`docs/BUGFIXING_AGENT.md`](../../docs/BUGFIXING_AGENT.md).**

## Was in einer Meldung steht

| Feld | Woher |
|---|---|
| `note` | Freitext des Melders — optional |
| `reporter` | wer gemeldet hat: `displayName`, `username`, `ownerId` — vom Server aus dem Session-Cookie |
| `reporter.source` | `session` \| `auth_disabled` (Login aus) \| `not_logged_in` |
| `page.path`, `page.view`, `page.tab` | die Seite, auf der geklickt wurde |
| `page.label` | ihr Name aus der Navigation, z. B. „Spieltag · Arena" |
| `view`, `url`, `viewport`, `clientTime` | vom Browser beim Klick |
| `userAgent` | aus dem Request-Header |
| `game.saveId`, `game.saveName` | aktiver Spielstand |
| `game.seasonId`, `game.seasonYear`, `game.currentMatchday` | Saison und Spieltag |
| `game.matchdayId`, `game.matchdayStatus` | Zustand des Spieltags |
| `game.activeTeamIds` | die vom Menschen geführten Teams (`teamControlSettings.controlMode === "manual"`) |

`game` ist `null`, wenn beim Melden kein Spielstand aktiv war (Login-Seite, frische Installation).
Eine Meldung ohne Spielkontext ist weniger wert, aber besser als keine — deshalb wird sie trotzdem
geschrieben.

`reporter` ist **immer** gesetzt, notfalls mit leeren Namen und einer Begründung in `source`. Ein
fehlendes Feld wäre nicht deutbar: „niemand angemeldet" und „Meldung stammt aus der Zeit vor diesem
Feld" sähen identisch aus.

## Nachschauen

- `npm run bugs:review` — die Entscheidungsvorlage: was offen ist, mit Zustand, Seite, Melder,
  Befund und Lösungsvorschlag (`-- --alle` zeigt auch Erledigtes, `-- --json` ist maschinenlesbar)
- `GET /api/bug-report` — die letzten 50 Meldungen als JSON
- Dateien direkt lesen

## `triage/`

Die Vorprüfung zu einer Meldung liegt als `triage/<reportId>.md` **daneben**, nicht darin: die
Rohmeldung ist ein Protokoll und wird nie wieder verändert. Was der Melder gesehen hat, ist
nachträglich nicht mehr feststellbar — stünde die Bewertung in derselben Datei, wäre das Protokoll
beim ersten Schreibfehler mit weg.
