# Bug-Meldungen aus dem Spiel

Hier landet jede Meldung, die über die rote Flagge oben rechts abgeschickt wird — eine JSON-Datei je
Meldung, benannt nach ihrem Zeitstempel (`bug-<ISO>-<random>.json`), also chronologisch sortiert.

Jede Meldung wird **automatisch auf den Branch `bug-reports` gepusht**, sofort beim Absetzen — lokal
vom Server selbst, auf dem Live-Server per Cron. Erst dadurch ist sie überall lesbar und nicht nur auf
dem Rechner, auf dem gespielt wurde. Lesen mit `git fetch origin bug-reports`.

Beide Quellen schreiben denselben Branch als *Vereinigung*, damit keine die andere überschreibt; das
Warum steht in `docs/BUGFIXING_AGENT.md`.

**Wer sich um die Meldungen kümmert, steht in [`docs/BUGFIXING_AGENT.md`](../../docs/BUGFIXING_AGENT.md).**

## Wie eine Meldung ins Repo kommt

Geschrieben wird sie immer nur lokal — auf der Platte des Rechners, auf dem der Server lief. Dass sie
von dort weiterkommt, ist ein eigener Schritt, und der sieht je nach Betrieb anders aus:

| Betrieb | Weg | Ziel |
|---|---|---|
| **Lokal gestartet** (`Oly starten.bat`, `npm run dev`) | der Save-Auto-Export nimmt sie mit (`lib/persistence/online-save-auto-export.ts`, alle 3 min) | `main` |
| **Hetzner-Server** | Cron ruft `deploy/hetzner/push-bug-reports.sh` (alle 15 min) | Branch `bug-reports` |

Zwei Ziele statt einem, mit Absicht: das Server-Skript spiegelt seinen kompletten Volume-Inhalt mit
einem elternlosen **Force-Push**. Würde der lokale Rechner auf denselben Branch pushen,
überschrieben sich beide Seiten gegenseitig — Meldungen gingen verloren, und zwar still.

Zwei Stellen, an denen das früher schon still gescheitert ist und die deshalb nicht wieder wegdürfen:

- **Das Docker-Volume `oly-bug-reports`.** Ohne das Mount schreibt die Flagge nach
  `/app/data/bug-reports` *im Container* — und der Auto-Deploy baut bei jedem Push auf `main` einen
  neuen. Jede auf dem Live-Server gemeldete Sache war beim nächsten Deploy weg.
- **`mkdir -p /app/data/bug-reports` im `Dockerfile`.** Docker legt ein neues Volume aus dem
  Image-Pfad an und übernimmt dessen Eigentümer. Fehlt der Pfad im Image, gehört das Volume `root`,
  die App läuft als `oly` — Schreiben scheitert mit EACCES, die Flagge meldet nur „Senden
  fehlgeschlagen". Ohne die Zeile hinge die Existenz des Ordners an dieser README-Datei.

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
| `game.saveId`, `game.saveName` | der Spielstand aus der URL des Melders (`?saveId=`) |
| `game.saveSource` | `url` (belegt) \| `active` (Notnagel: URL trug keinen bekannten `saveId`) |
| `game.seasonId`, `game.seasonYear`, `game.currentMatchday` | Saison und Spieltag |
| `game.matchdayId`, `game.matchdayStatus` | Zustand des Spieltags |
| `game.activeTeamIds` | die vom Menschen geführten Teams (`teamControlSettings.controlMode === "manual"`) |

Der Spielstand kommt aus der **URL des Melders**, nicht aus dem global aktiven. Bei zwei Spielern auf
einer Instanz ist der aktive regelmäßig ein anderer als der gemeldete — in zwei der ersten drei
echten Meldungen wäre der Bericht so einer fremden Partie zugeordnet worden, mit falscher Saison,
falschem Spieltag und falschem geführten Team. Das ist schlimmer als gar kein Kontext, weil es
glaubwürdig aussieht. `saveSource` hält fest, welcher Weg gegriffen hat.

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
