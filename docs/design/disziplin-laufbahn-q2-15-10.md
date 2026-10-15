# Disziplin-Laufbahn (Q2) — was gebaut wurde, was fehlt, und warum

Auftrag: `docs/design/fable-konzept-chris-feedback-13-10.md` Abschnitt 3.2 ("Q2 — Disziplin-Laufbahn").
Querschnitts-Baustein (Abschnitt 3 des Dokuments), kein E-Punkt — läuft ohne Chris' Freigabe, per
Abschnitt 9 des Dokuments. Chris' Zitat, das den Baustein motiviert:

> „sowas hätt ich gern im drawer für JEDE disziplin wenn das geht müsste natürlich über mehrere
> seasons dann getrackt werden, überlege mal bitte wie das speicherplatz spart aber wir trotzdem
> auf die Daten zugreifen können, dann auch im normalen season flow in seinem Spielerprofil wenn
> man die Diszis anklickt zb dass dann so ein Stat Panel einklappbar ausfährt"

Vorbild für Form und Ton: das Kampf-Profil-Mockup `public/mockups/battle-mode.html:466ff` (Reiter
„Spielerprofil", `#p3`), KAMPFWERTE + LAUFBAHN, ehrlich als Beispielzahlen beschriftet. Diese Arbeit
ersetzt die Beispielzahlen durch echte, gebuchte Daten — für **alle zwanzig Disziplinen**, nicht nur
Kampf.

## 0. Kurzfassung: was steht, was fehlt

Gebaut (Klasse S + A, vollständig und getestet):

1. **Schema** — ein optionales, additives Feld `laufbahn?: Record<string, number>` an
   `SeasonSnapshotPlayerDisciplineBreakdownRecord` (`lib/data/olyDataTypes.ts`).
2. **Schreiben/Falten** — eine Rechenstelle (`lib/season/player-discipline-laufbahn.ts`), die beim
   Saisonabschluss aus den ohnehin schon vorhandenen `playerDisciplinePerformances` faltet
   (`lib/season/season-snapshot-service.ts`). **Idempotent durch Bauart**, s. Abschnitt 3 — die
   O7-Lehre aus dem Achtzehnten Nachtrag ist hier nicht nur beachtet, sondern strukturell
   ausgeschlossen.
3. **Lesen** — dieselbe Rechenstelle liefert auch die laufende Saison live, nach dem Muster
   `buildPlayerSeasonAwards`: laufende Saison aus den Spieltagen, frühere aus den Schnappschüssen.
4. **Anzeige, Ort 1 (Chris' Hauptwunsch)** — ein einklappbares Laufbahn-Panel je Disziplin im
   Spielerprofil (`app/foundation/PlayerDetailDrawer.tsx`), Klick auf die Disziplin-Zeile öffnet
   Karriere-Zähler + Saison-für-Saison-Liste.
5. **Anzeige, Ort 2** — eine kompakte Zeile in `DisciplineStageDrawer.tsx` (existiert bereits, lädt
   lazy), direkt unter „Aktuelle Disziplin".

Bewusst **nicht** gebaut, mit Begründung (Abschnitt 2 unten):

- **Der chassis-eigene Zählerkatalog aus 3.2.3** (Ausschaltungen, Schaden, Assists, Rebounds,
  Duelle gewonnen, …). Nachgemessen trägt **keiner** dieser Werte heute über einen Boxscore bis in
  den Spielstand — nur ein skalarer `finalPlayerScore` plus ein ligaweiter `rankInDiscipline`.
  „Zähler, nie Ereignisse, wo nicht, fällt er weg" (3.2.3) — hier fällt fast der ganze Katalog weg,
  nicht aus Zeitmangel, sondern weil die Quelle fehlt.
- **Anzeige, Ort 3 (Matchup-Karte, Q1)** — geprüft, nicht vorhanden: `grep` nach „Laufbahn-Zeile",
  „matchup career", „MatchupCard" findet nichts im Baum. Q1 ist noch nicht gelandet; sobald es
  landet, ist das Nachrüsten dieser Zeile eine kleine Folgearbeit (dieselbe Rechenstelle, nur ein
  weiterer Aufrufer).
- **Verletzungen** (`verletzungen`-Zähler) ist im Code vorbereitet und getestet
  (`buildSeasonInjuryDisciplineCounts`), fließt aber in die heutige Session nicht in die
  UI-Anzeige — nur in `laufbahn.career`/`.seasons[].counters` als Datenfeld. Ein künftiger
  UI-Durchgang kann ihn einfach mit anzeigen, die Zahl steht schon bereit.

## 1. Was schon vorher da war (3.2.1, nachgeprüft, nicht neu gebaut)

| Ebene | Wo | Inhalt |
|---|---|---|
| Laufende Saison | gebuchte Spieltagsergebnisse | je Spieler × Spieltag × Disziplin: Punkte, Rang, `pointsAwarded` |
| Vergangene Saisons | `SeasonSnapshotPlayerPerformanceRecord.disciplineBreakdown` (`olyDataTypes.ts:2843–2850`, `:2897`, jetzt `:2884` nach dieser Änderung) | appearances, totalContribution, averageContribution, averageFinalScore |
| Muster „über alle Saisons lesen" | `buildPlayerSeasonAwards` (`lib/foundation/player-season-awards.ts`) | laufende Saison + Schnappschüsse, eine Funktion |

Einsätze, Ø PP, Ø Rang, beste Leistung und Saison-Verlauf waren also **schon vorher** ohne ein
einziges neues Feld anzeigbar. Diese Arbeit fügt dem NICHTS hinzu — sie liefert ausschließlich die
Zähler, die 3.2.2/3.2.3 als fehlend benennen.

## 2. Der Audit: was vom Zählerkatalog (3.2.3) tatsächlich eine Quelle hat

3.2.3 schlägt je Chassis einen eigenen Katalog vor (Arena: Einsätze/Ausschaltungen/Schaden/Assists;
Feldspiel: Punkte/Assists/Steals/Rebounds; Bahn: Starts/Siege/Podien/Rang-Summe/Bestwert;
Bühne-Duell: Duelle/Duelle gewonnen/Treffer für-gegen; Bühne-Auftritt: Auftritte/Wertung;
Heben/Gauntlet: Duelle/Siege/Bestlast). Vor dem Bau wurde geprüft, was davon tatsächlich eine
Quelle im Spielstand hat:

- **`ArenaFixtureBoxscoreEintrag`** (`lib/battle/arena-headless-runner.ts:239–270`) trägt pro
  Spieler nur `name`, `wert` (ein skalarer Rohwert für die PP-Kurve), `playerId`, `side`,
  `torwart?`. Kein `kills`/`dmg`/`assists`.
- **`PlayerDisciplinePerformanceRecord`** (`olyDataTypes.ts:2594ff`) trägt `baseValue`,
  `finalPlayerScore`, `scoreContribution`, `rankInTeam`, `rankInDiscipline`, `isTop10`,
  `isMvpCandidate`, `storyWeight`. Auch hier: ein Wert, ein Rang — keine Teilstatistik.
- **Der Motor FÜHRT die reicheren Zahlen durchaus**: `battle-mode.engine.js` pflegt pro Kampf-Einheit
  einen Stand `u.st.{dmg, heal, schild, verh, ko, koAnteil, tode, assists, punkte, tank}`
  (s. z. B. Zeilen 32327, 32670, 34450, 34528ff — dort auch die Scoreboard-Spalten „Schd"/„Ast").
  Diese Zahlen füttern nur die LIVE-Anzeige (Ticker, Scoreboard) während des Kampfes. Sie werden
  nie über `window.__arena.spieleFeldspiel()`/`spieleBuehneHeben()` hinausgereicht — der Rückgabewert
  dieser Funktionen ist exakt der schlanke `RoherBrowserBoxscoreEintrag` (`name`, `wert`, optional
  `torwart`), den `arena-headless-runner.ts` dann zu `ArenaFixtureBoxscoreEintrag` mappt.

**Konsequenz:** den vollen Katalog zu bauen hieße, die GEMEINSAME Engine-Ausgabe für alle sechs
Chassis zu erweitern (`battle-mode.engine.js`, eine einzige ~50k-Zeilen-Datei, über die jede der
zwanzig Disziplinen läuft) — das ist eine Änderung an der Boxscore-Schnittstelle selbst, nicht an
diesem Datenmodell-Baustein, und genau das Risiko, das der Auftrag ausdrücklich ausschließt
(„du darfst keine Disziplin-Simulationslogik anfassen"; diese Datei läuft außerdem parallel bei
einem anderen Agenten für Time-Trial-Scoring). Der Katalog bleibt deshalb **chassis-übergreifend
EIN Satz Zähler**, gebaut ausschließlich aus Feldern, die jede Disziplin schon heute über denselben
Weg (`legacy-matchday-resolve-engine.ts`) füllt — „wo nicht, fällt er weg" wörtlich genommen.

### Der tatsächliche Zählerkatalog (`lib/season/player-discipline-laufbahn.ts`)

Je Spieler × Disziplin × Saison, als Saison-SUMME (nie als Einzelereignis):

| Schlüssel | Quelle | Bedeutung |
|---|---|---|
| `starts` | Anzahl `PlayerDisciplinePerformanceRecord` | Einsätze |
| `siege` | `rankInDiscipline === 1` gezählt | Spieltage auf ligaweitem Rang 1 |
| `podien` | `rankInDiscipline <= 3` gezählt | Spieltage in den Top 3 |
| `rangSumme` | Summe `rankInDiscipline` | Grundlage für den Ø-Rang beim Lesen |
| `bestRang` | Minimum `rankInDiscipline` | beste je erreichte Platzierung |
| `bestWertung` | Maximum `finalPlayerScore` | beste je erzielte Wertung |
| `spielerDesSpieltags` | `isMvpCandidate === true` gezählt | nur geschrieben, wenn > 0 |
| `verletzungen` | s. unten | nur geschrieben, wenn > 0 |

`spielerDesSpieltags` deckt sich heute zahlenmäßig mit `siege` (derselbe Rang-1-Wurf setzt beide),
bleibt aber ein eigener Schlüssel: `isMvpCandidate` ist im Motor unabhängig vom Rang gesetzt (die
Test-Fixture in `tests/season-snapshot-service.test.ts` hat genau diesen Fall — Rang 4,
`isMvpCandidate: true` — absichtlich, um das zu belegen), ein künftiges Chassis könnte beides
trennen.

**`verletzungen`** nutzt eine bereits vorhandene, bereits getestete Funktion
(`resolveInjuryMatchdayDisciplines`, `lib/foundation/player-injury-history.ts`), die genau dasselbe
Problem schon für die Verletzungshistorie im Spielerprofil löst: `InjuryEventRecord` trägt keine
`disciplineId` (der Wurf hängt am Spieltag/der Fatigue, nicht an einer Disziplin), also wird über die
Einsatzliste (`lineupDrafts`) des betroffenen Spieltags aufgelöst, in welcher Disziplin der Spieler
stand. Stand er in beiden Disziplinen eines Spieltags, zählt die Verletzung bei beiden — es wird
nichts geraten, nur nicht an eine von zwei möglichen verschenkt (`buildSeasonInjuryDisciplineCounts`
in `lib/season/player-discipline-laufbahn.ts`).

## 3. Schreiben: idempotent durch Bauart, nicht nur durch Disziplin

Der Auftrag nennt als kritische Lehre den O7-Befund (Achtzehnter Nachtrag, Befund 2): ein neu
gebuchter ÄLTERER Spieltag konnte Zähler eines bereits gebuchten NEUEREN zurücksetzen, weil O7
ursprünglich inkrementell fortschrieb. Die vorgeschlagene Lösung war: „je Spieltag ablegen und beim
Neu-Buchen ersetzen, erst beim Saisonabschluss in die Saisonzeile falten".

**Befund dieser Arbeit:** dieser Speicherplatz existiert bereits, und zwar schon idempotent. Jede
Buchung (egal ob `D1`-Commit, `D2`-Commit, Auto-Run oder Re-Apply) ersetzt in
`legacy-matchday-result-apply-service.ts` die Zeilen von `playerDisciplinePerformances`
**ausschließlich für ihren eigenen `matchdayResultId`**:

```ts
playerDisciplinePerformances: [
  ...(seasonState.playerDisciplinePerformances ?? []).filter(
    (result) => result.matchdayResultId !== matchdayResultId,
  ),
  ...nextPlayerPerformances,
],
```

Ein neu gebuchter Spieltag 1 ersetzt nur seine eigenen Zeilen — die Zeilen von Spieltag 2 bleiben
unberührt, unabhängig von der Buchungsreihenfolge. Dieser Baustein muss also **keinen eigenen**
per-Spieltag-Zwischenspeicher einführen (keine zweite Struktur neben `playerDisciplinePerformances`,
die man selbst wieder idempotent halten müsste) — er faltet beim Saisonabschluss einmalig über den
kompletten, zu diesem Zeitpunkt bereits korrekten Endzustand (`season-snapshot-service.ts`, in der
bestehenden Reduce-Schleife, die `disciplineBreakdown` ohnehin schon aufbaut). Es gibt dabei **keinen
Zwischenzähler**, den eine falsche Buchungsreihenfolge verfälschen könnte — die Faltung liest jedes
Mal den kompletten, zu diesem Zeitpunkt gültigen Datensatz neu.

**Regressionstest** (`tests/season-snapshot-service.test.ts`, „bleibt idempotent, wenn ein ÄLTERER
Spieltag NACH einem bereits gebuchten neueren erneut gebucht wird") baut exakt den O7-Fall nach:
Variante A bucht Spieltag 1 dann 2, Variante B baut dieselben Endzeilen auf, als wäre Spieltag 1
NACH Spieltag 2 (erneut) gebucht worden — beide Varianten liefern denselben `laufbahn`-Eintrag.
Ergänzend: `tests/player-discipline-laufbahn.test.ts` testet dasselbe Muster noch einmal auf der
reinen Funktionsebene (`computeLaufbahnCountersForPerformances`), inklusive „erneutes, identisches
Buchen verändert nichts".

## 4. Lesen: eine Rechenstelle, zwei Anzeigeorte

`buildPlayerDisciplineLaufbahn(gameState, playerId)` (`lib/season/player-discipline-laufbahn.ts`)
folgt exakt dem Muster von `buildPlayerSeasonAwards`:

- **laufende Saison**: live aus `gameState.seasonState.playerDisciplinePerformances`, gefiltert auf
  `preview_applied`-Spieltage der aktuellen Saison, gefaltet mit derselben Funktion wie beim
  Saisonabschluss (`computeLaufbahnCountersForPerformances`) plus `verletzungen` aus
  `buildSeasonInjuryDisciplineCounts`.
- **frühere Saisons**: ausschließlich aus `disciplineBreakdown[].laufbahn` der Schnappschüsse — nie
  aus Spieltagsdaten neu gerechnet, die nach dem Saisonwechsel ohnehin nicht mehr vollständig
  vorliegen.
- **Zusammenführung**: `mergeLaufbahnCounters` summiert die meisten Zähler, nimmt `bestRang` als
  Minimum und `bestWertung` als Maximum über alle Saisons — eine Karriere-Bestmarke bleibt die
  Bestmarke, auch wenn eine spätere Saison schlechter lief.

Rückgabe: `Map<disciplineId, PlayerDisciplineLaufbahn>` mit `career` (Summe), `careerAppearances`
und `seasons` (neueste zuerst, `isActiveSeason` markiert die laufende). Ein Schnappschuss von vor
dieser Änderung hat `disciplineBreakdown[].laufbahn` nicht — seine Saison-Zeile fehlt dann einfach,
nie mit erfundenen Nullen aufgefüllt (getestet: „überspringt Schnappschuss-Disziplinen ohne
`laufbahn`").

### Anzeigeort 1: Spielerprofil (Chris' Hauptwunsch)

`app/foundation/PlayerDetailDrawer.tsx`, in der bestehenden Achsen-Karte (Disziplinen-Mini-Liste je
Achse POW/SPE/MEN/SOC). Jede Disziplin-Zeile, die Laufbahn-Daten hat, wird zum Button; Klick klappt
ein Panel darunter aus (eigener `useState`, `expandedLaufbahnDisciplineId`, eine Disziplin zur Zeit):

- Karriere-Zähler als kleine Stat-Kacheln (Einsätze, Siege, Top-3, bester Rang, Rang-Summe, beste
  Wertung, Spieler des Spieltags — in dieser festen Reihenfolge, unbekannte künftige Schlüssel
  hängen sich hinten an, verschwinden nicht stillschweigend).
- Saison-für-Saison-Liste darunter (neueste/laufende zuerst, laufende Saison optisch markiert).

**Bewusst kein Balkendiagramm** wie im Mockup-Vorbild: das Mockup zeigte Beispielzahlen, diese
Anzeige zeigt echte — und „ein kürzeres Panel ist besser als eines mit erfundenen Werten" (3.2.4)
gilt genauso fürs WIE der Anzeige: eine kompakte Liste ist ehrlicher als eine Grafik, die bei wenigen
Saisons leer/verzerrt aussähe. Nur im NICHT gescouteten Pfad gesetzt
(`buildDisciplineValuesFromPlayer`, nicht `buildScoutedDisciplineValuesFromPlayer`) — Fog-of-War
zeigt die Laufbahn eines fremden, nicht vollständig aufgedeckten Spielers nicht.

### Anzeigeort 2: Spieltags-Bühnen-Drawer

`app/foundation/discipline-stage/DisciplineStageDrawer.tsx`, Sektion „Aktuelle Disziplin" — dieselbe
Komponente liest bereits `data.disciplineValues` (identische Quelle wie Ort 1), eine kompakte Zeile
(Einsätze Laufbahn · Siege · Top 3 · bester Rang) wurde direkt unter der aktuellen Diszi-Wertung
ergänzt. Kein Saison-für-Saison-Verlauf hier — kein Platz im kompakten Drawer, und Chris' Hauptwunsch
(„im normalen season flow in seinem Spielerprofil") ist Ort 1.

### Anzeigeort 3: Matchup-Karte (Q1) — nicht gebaut

Geprüft (`grep` über `app/`, `components/` nach „Laufbahn-Zeile", „matchup career",
„MatchupCard"): nichts gefunden. Q1 ist zum Zeitpunkt dieser Arbeit noch nicht gelandet. Die
Rechenstelle (`buildPlayerDisciplineLaufbahn`) ist bereit für einen dritten Aufrufer, sobald Q1 die
Matchup-Karte liefert — kein Grund, hier vorzugreifen und eine Karte zu bauen, die Q1 dann
überschreibt.

## 5. Manager Mode vs. Battle Mode

Alle Zähler hängen an `PlayerDisciplinePerformanceRecord` — die existiert für JEDE Buchung, Manager
Mode wie Battle Mode, da beide über denselben `legacy-matchday-result-apply-service.ts` laufen. Der
Unterschied liegt nicht im Modus, sondern im Chassis: der chassis-eigene Katalog aus 3.2.3 wäre im
Manager Mode ohnehin nicht reicher als im Battle Mode gewesen (die Quelle fehlt in beiden). Das
Panel zeigt deshalb in beiden Modi dieselben, generischen Rang-/Wertungs-Zähler — nichts wird
modusabhängig weggelassen, nichts modusabhängig erfunden.

## 6. Speicherplatz

Obergrenze (grob, wie im Auftrag vorgerechnet): 400 Spieler × 20 Disziplinen × 8 Zähler = 64 000
Zahlen je Saison, real deutlich weniger (kein Spieler läuft alle zwanzig Disziplinen). Selbst als
JSON niedriger Hunderter-KB-Bereich je Saison — Einzelereignisse wären um Größenordnungen mehr und
werden hier (wie überall im Projekt) nicht gespeichert.

## 7. Verifikation

- `npx tsc --noEmit` — 0 neue Fehler in den geänderten Dateien (Baseline vor dieser Änderung:
  564 vorbestehende Fehler, ausschließlich in `scripts/`; nach dieser Änderung: 565, weiterhin
  ausschließlich in `scripts/` — die Differenz von 1 ist unabhängig von diesem Baustein,
  s. Hinweis unten).
- `npx eslint` auf allen geänderten Dateien — 0 neue Fehler, nur vorbestehende Warnungen (nicht an
  den hier geänderten Zeilen).
- Neue Tests: `tests/player-discipline-laufbahn.test.ts` (13 Tests: Fold/Finalize/Merge,
  Verletzungs-Zuordnung, laufende+frühere Saison kombiniert, Idempotenz-Regression) und eine
  Erweiterung von `tests/season-snapshot-service.test.ts` (2 Tests: echte Faltung im
  Saison-Schnappschuss, Idempotenz-Regression auf Builder-Ebene).
- Bestehende Tests weiterhin grün: `season-snapshot-service`, `player-detail-drawer*`,
  `player-injury-history`, `player-injury-matchday-disciplines`, `staffel-wechsel-paar-bonus-service`,
  `legacy-matchday-result-apply-service` — insgesamt 112 Tests über diese sechs Dateien, alle grün.
- UI-Sichtprüfung im Dev-Server: **nicht möglich in dieser Runde** — bekannte, von anderen Agenten
  bereits angetroffene Einschränkung (Turbopack über ein per `git worktree` gemountetes
  `node_modules`, hier als Symlink auf den Haupt-Checkout eingerichtet, um `tsc`/`eslint`/`vitest`
  lauffähig zu machen). Die Panel-Logik ist stattdessen über die Builder-Tests abgedeckt
  (`buildPlayerDisciplineLaufbahn`, `computeLaufbahnCountersForPerformances`), nicht über einen
  Screenshot.
- Kein neues simuliertes Ereignis: jeder Zähler ist auf ein bereits heute emittiertes,
  persistiertes Feld zurückgeführt (Abschnitt 2 oben). `rho`/Pp-Messwerkzeuge wurden absichtlich
  NICHT ausgeführt — dieser Baustein ist Datenmodell/Plumbing, keine Disziplin-Rezeptänderung, und
  die Eignungsmatrix wurde nicht angefasst.

## 8. Hinweis für den nächsten Agenten: geteiltes `.git` über `git worktree` hinweg

Während dieser Arbeit stellte sich heraus, dass `refs/stash` (und vermutlich weitere Git-interne
Zustände) **über alle `git worktree`-Arbeitsverzeichnisse eines Checkouts hinweg geteilt** sind, weil
sie alle dasselbe `.git`-Objektverzeichnis teilen. Ein `git stash` in diesem Worktree landete beim
`git stash pop` **nicht** wieder bei den eigenen Änderungen, sondern bei einer fremden,
gleichzeitig von einem anderen Agenten (Time-Trial-Worktree) gepushten Stash-Instanz — die eigenen
Änderungen an `lib/data/olyDataTypes.ts`, `lib/season/season-snapshot-service.ts`,
`lib/foundation/player-detail-drawer.ts`, `app/foundation/PlayerDetailDrawer.tsx` und
`app/globals.css` waren im Arbeitsverzeichnis kurzzeitig komplett verschwunden (zurück auf
`HEAD`-Stand). Wiederhergestellt über `git fsck --no-reflog` (der ursprüngliche Stash-Commit blieb
als „dangling commit" erhalten, da `git stash` einen echten, nur unreferenzierten Commit anlegt) und
`git stash apply <sha>`. **Lehre: in einem geteilten Checkout mit mehreren `git worktree`-Agenten
`git stash` möglichst vermeiden** — ein `git diff > patch`/`git add -N`-Workflow oder schlicht
kein Stash (Arbeiten direkt committen oder liegen lassen) ist hier sicherer, weil `refs/stash` kein
Worktree-lokaler Zustand ist. Zusätzlich fand sich im selben Zuge in diesem Worktree eine fremde,
unzusammenhängende Änderung an `public/mockups/battle-mode.engine.js` (Time-Trial-PP-Prototyp,
offensichtlich nicht aus dieser Arbeit) — bewusst **nicht** committet, da sie nicht zu diesem
Baustein gehört und nicht diesem Agenten gehört.
