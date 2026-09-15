# Standings-Bypass-Fund: Diagnose + Fix-Plan (15.09.)

Reine Recherche- und Planungsrunde, ausgeloest durch zwei unabhaengige Code-Reviews auf PR #935.
**Kein Produktionscode wird in dieser Runde angefasst** — dieses Dokument ist die Grundlage fuer
eine separate Umsetzungsrunde danach.

## 0. Der Fund in einem Satz

Arena-Team-Punkte (Sieg 2 / Unentschieden 1 / Niederlage 0, Chris' Vorgabe vom 30.08., „das ist
gesetzt") werden in der Live-Vorschau korrekt gerechnet, aber **nirgends dauerhaft gebucht**:
zwei unabhaengige, beide von der gebuchten Saisontabelle gelesene Pfade
(`standings-preview-engine.ts` UND `season-points-ledger.ts`) leiten die Punkte stattdessen aus
dem PPS-Rang her — fuer alle 13 arena-aufgeloesten Disziplinen gleichermassen, seit die erste
davon (Basketball, PR7) produktiv ging.

## 1. Diagnose — der vollstaendige Datenfluss, selbst nachvollzogen

### 1.1 Die Live-Preview rechnet den Override korrekt

`lib/resolve/legacy-matchday-resolve-engine.ts`, `buildLegacyMatchdayResolvePreview()`:

- Der Rang (`rank`) wird bei jedem Aufruf **allein aus dem PPS-Score** ermittelt
  (`rankWithinLeagueScope(teamResultsAfterPowers, (result) => result.score, ...)`, Zeile 757ff).
- Der Arena-Override (`arenaOverridesForThisDiscipline?.get(item.teamId)`) wird **danach**
  angewendet und ersetzt ausschliesslich `teamPoints`, `pointSource`, `resolutionSource`,
  `arenaMatchSeed` (Zeile 762-782). **`rank` wird vom Override nie beruehrt.**
- Der Kommentar an der Stelle selbst sagt es explizit: „fuer ein Arena-Ergebnis bleibt
  `teamPoints`/`pointSource` beim 2/1/0-Wert von oben ... nur der TEAM-Wert darf nicht
  ueberschrieben werden" (Zeile 812-819) — bezogen auf `distributeRankPointsToPlayers()`, das
  sonst `teamPoints` aus dem Rang neu setzen wuerde.
- Am Ende aggregiert `rankedTeamsWithPoints` (Zeile 1017-1041) `d1Points`/`d2Points` aus genau
  diesem (korrekten) `teamPoints`-Feld zu `totalPoints`.

**Nachgewiesen** (`tests/standings-bypass-arena-repro.test.ts`, Schritt 1, unten): ein
Arena-Sieg (`teamPoints: 2`) kommt in `DisciplineTeamResolvePreview.teamPoints` und
`TeamResolvePreview.d1Points` unveraendert an, mit `resolutionSource: "arena"`. Der PPS-Rang
bleibt daneben stehen (im Testfall: der Arena-Sieger hat den niedrigeren Rohscore und damit
Rang 2) — **beide Zahlen existieren parallel, aber nur der Rang wird weitergereicht.**

### 1.2 Der Persistenz-Mapper wirft `teamPoints` weg

`lib/resolve/legacy-matchday-result-mapper.ts`, `mapLegacyMatchdayResolvePreviewToResultPayload()`:

```ts
export type DisciplineResultWritePayload = {
  id: string;
  matchdayResultId: string;
  teamId: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  rank: number;
  baseScore: number;
  totalScore: number;
  formModifier: number | null;
  readinessStatus: ResultReadinessStatus;
  warnings: string[];
};
```

Kein `teamPoints`, kein `pointSource`, kein `resolutionSource`, kein `arenaMatchSeed`. Der
Mapper baut die Zeile ausschliesslich aus `teamResult.rank`/`teamResult.baseScore`/
`teamResult.finalPreviewScore` (Zeilen 187-205). **Das ist die Stelle, an der die korrekte
Arena-Zahl aus 1.1 verloren geht — nicht durch einen Bug in der Ableitung, sondern weil das
Feld im Zieltyp schlicht fehlt.**

**Nachgewiesen** (Repro-Test Schritt 2): `(disziplinResultRow as any).teamPoints` ist
`undefined`; die Zeile traegt nur `rank: 2` fuer den Arena-Sieger.

### 1.3 Beide Lesepfade der gebuchten Saisontabelle leiten aus `rank` neu her

**Pfad A — `lib/standings/standings-preview-engine.ts`, `resolveDisciplinePoints()`:**

```ts
function resolveDisciplinePoints(input: {
  pointsMap: Map<number, Map<number, number>> | null | undefined;
  playerCount: number | null;
  rank: number | null;
  ...
}): DisciplinePointsLookup {
  ...
  const points = input.pointsMap?.get(input.playerCount)?.get(input.rank) ?? null;
  ...
}
```

Nimmt ausschliesslich `row.rank` (aus der oben verstuemmelten `DisciplineResultRecord`) und die
Disziplin-Feldgroesse, schlaegt in der normalen `rank-to-points`-Tabelle nach. Kein Wissen von
`ARENA_RESOLVED_DISCIPLINE_IDS`, keine Sonderbehandlung fuer `pointSource`/`resolutionSource` —
die beiden Felder existieren an dieser Stelle ja auch gar nicht mehr (s. 1.2).
`buildStandingsPreview()` speist daraus `item.pointsDelta`, und **das ist exakt der Wert, den
`standings-apply-service.ts::writeLocalStandingsApply()` in `SeasonState.standings[teamId].points`
schreibt** (`executeStandingsApply()`, aufgerufen aus `matchday-auto-run-service.ts` und
`matchday-mvp-scoring-service.ts` — der reale Anwendungspfad fuer jeden gespielten Spieltag).

**Pfad B — `lib/foundation/season-points-ledger.ts`, `deriveRankPointsFromPerformances()`:**

```ts
const distributed = distributeRankPointsToPlayers({
  playerCount,
  rank: teamResult.rank,
  entries: performances,
});
```

Auch hier: `teamResult.rank` aus derselben verstuemmelten Zeile, dieselbe generische
Rang-zu-Punkte-Tabelle (hier ueber die REALE `rank-to-points.json`, nicht die im
Standings-Preview gemockte/gelesene Sheet-Quelle — zwei technisch unabhaengige, aber
inhaltlich gleich blinde Implementierungen desselben Fehlers).

**Das ist der Teil, den die urspruengliche PR-935-Zusammenfassung noch nicht in voller Tragweite
benannt hatte, und der fuer den Fix-Plan entscheidend ist:** `lib/standings/
saisonstand-punkte-nachbuchung.ts` (`zieheSaisonstandPunkteNach()`) laeuft **automatisch als
letzter Schritt von `writeLocalStandingsApply()`** (`standings-apply-service.ts` Zeile 386,
direkt nach dem eigentlichen Standings-Schreiben) und **ersetzt `standings[team].points`
bedingungslos durch `buildSeasonPointsLedger(...).teamSummariesByTeamId.get(teamId).totalPoints`**,
sobald der Ledger jeden gewerteten Spieltag der Saison abdeckt (was im Normalbetrieb praktisch
immer der Fall ist). **Ein Fix, der NUR Pfad A (die Preview-Engine) korrigiert, wird von Pfad B
(der Nachbuchung) im selben Funktionsaufruf sofort wieder ueberschrieben** — das ist keine
theoretische Randbedingung, sondern im Repro-Test unten empirisch beobachtet.

### 1.4 End-zu-Ende reproduziert (eigener Test, echter Produktionscode)

`tests/standings-bypass-arena-repro.test.ts` (im Rahmen dieser Recherche geschrieben, lokal
gruen — **nicht** Teil dieses Commits, s. Abschnitt 6). Nur die externen CSV-/Sheet-Quellen sind
gemockt (identisches Muster zu `tests/standings-preview-engine.test.ts`); Resolve-Engine,
Mapper, `buildStandingsPreview()`, `executeStandingsApply()` und die Nachbuchung laufen
unveraendert.

Aufbau: zwei Teams, Basketball als arena-aufgeloeste D1 (A-A gewinnt das Arena-Duell 2:0 gegen
B-B trotz niedrigerem Rohscore), „football" als arena-fremde PPS-Kontroll-D2.

- **Schritt 1 (Live-Preview):** `alpha.teamPoints === 2`, `beta.teamPoints === 0`,
  `resolutionSource === "arena"` — korrekt.
- **Schritt 2 (Mapper):** die persistierte Basketball-Zeile fuer A-A hat kein `teamPoints`-Feld
  mehr, nur `rank: 2` (A-A hat den niedrigeren Rohscore, der Arena-Sieg aendert daran nichts).
- **Schritt 3 (E2E, `buildStandingsPreview` + `executeStandingsApply`):**
  - Vor der Nachbuchung: `pointsDelta` ist fuer **beide** Teams identisch **12,8** (6,6/6,2 aus
    Basketball-PPS-Rang + 6,2/6,6 aus Football-PPS-Rang addieren sich im Testfall zufaellig zur
    gleichen Summe) — der Arena-Sieger bekommt nicht einmal mehr Punkte als der Verlierer,
    geschweige denn 2 statt 0.
  - Nach der Nachbuchung (`zieheSaisonstandPunkteNach`, laeuft automatisch mit): die tatsaechlich
    in `SeasonState.standings` gebuchten Werte sind **47,1 (A-A) vs. 42,1 (B-B)** — eine
    Differenz von **5,0**, nicht **2,0**. Der 2:0-Arena-Sieg schlaegt sich in einer voellig
    anderen Zahl nieder als in der vorgesehenen Regel, hergeleitet aus der PPS-Score-Differenz
    beider Disziplinen statt aus dem Arena-Ergebnis.

Damit ist der Fund fuer alle drei Ebenen (Live-Rechnung korrekt / Persistenz verstuemmelt /
beide Lesepfade der gebuchten Tabelle blind) mit lauffaehigem, produktionsnahem Code belegt —
nicht nur durch Code-Lesen.

## 2. Umfang

### 2.1 Alle 13 arena-aufgeloesten Disziplinen sind gleichermassen betroffen

Der Override-Mechanismus in `legacy-matchday-resolve-engine.ts` (Abschnitt 1.1) ist
**chassis-agnostisch**: er entscheidet ausschliesslich ueber Mitgliedschaft in
`ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts`), nie ueber
einen Disziplins-Literal oder ein Chassis-Merkmal. Dieselbe eine Codestelle (Zeile 748-782)
laeuft fuer Basketball (Feldspiel-Chassis), Gewichtheben/Hockey (dasselbe Feldspiel-Chassis),
Speed-Schach/Showcase/Eiskunstlauf/Breaking/Wettessen/Tennis/Fechten (Buehnen-Chassis) und
Staffel/Takeshi's Castle/Time-Trial/Spurt (Bahn-Chassis) identisch durch. Ebenso
chassis-agnostisch sind die beiden Lesepfade (Abschnitt 1.3): beide kennen nur `rank` +
`playerCount`, nie eine Chassis- oder Disziplins-Unterscheidung. **Es gibt keinen Hinweis auf
einen Unterschied zwischen den Chassis — der Bug betrifft strukturell alle 13 gleich, seit dem
jeweiligen Produktivierungsdatum der einzelnen Disziplin** (Basketball ab PR7/30.08.,
Gewichtheben ab 04.09., Hockey ab 04.09., Speed-Schach/Showcase ab 06.09., die fuenf der
Produktivierungswelle 2 ab 09.09., die vier Bahn-Disziplinen ab 10.09./14.09.).

### 2.2 Mini-DM (4-Team-FFA, 2-1-0-0): NICHT betroffen — weil noch gar nicht angeschlossen

Nachgesehen, nicht angenommen: Mini-DM ist **nicht** in `ARENA_RESOLVED_DISCIPLINE_IDS`
(`battle-mode-arena-team-points.ts` nennt es explizit als Achse-1-Ausfall, rho 0,094). Der
Override-Codepfad in `legacy-matchday-resolve-engine.ts` (Zeile 748-751) prueft
`ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId)`, bevor er ueberhaupt in die
`arenaTeamPointsByDisciplineId`-Map schaut — fuer `"mini-dm"` ist das immer `false`.

Der FFA-Kampfmotor mit der 2-1-0-0-Ligapunkte-Sonderregel (`spieleMiniDmFfaEvent()`,
`MINI_DM_FFA_LIGAPUNKTE = [2,1,0,0]`, `public/mockups/battle-mode.engine.js`) **existiert**
bereits und ist ueber `runMiniDmFfaPodFixtures()` (`lib/battle/arena-headless-runner.ts`, PR
14.09.) auch headless aufrufbar — aber `lib/season/arena-matchday-resolve-service.ts` (der
Produktions-Aufrufer, der `runBattleModeArenaMatchday()`/`runArenaFixtures()` fuer die 13
angeschlossenen Disziplinen orchestriert) enthaelt **keine einzige Referenz auf Mini-DM**.
`runMiniDmFfaPodFixtures()` wird ausserhalb seiner eigenen Definition nur aus einem Test
(`tests/mini-dm-ffa-pod-headless-runner.test.ts`) und einem Design-Dokument aufgerufen — nicht
aus dem Resolve-Pfad.

**Konsequenz fuer den Umfang:** Mini-DM hat aktuell **keinen** Weg, ueberhaupt einen
`teamPoints`-Override zu erzeugen, kann also den hier beschriebenen Bypass gar nicht erst
ausloesen. Es steht damit in derselben Lage wie jede der sieben noch nicht arena-aufgeloesten
Disziplinen (Climbing, I-Spy, Battlefield, TDM, plus Football/Football wartet auf
`ARENA_IMPACT_KONFIG_JE_DISZIPLIN`): Saisonpunkte kommen ausschliesslich aus dem normalen
PPS-Rang-Pfad, korrekt fuer das, was dieser Pfad tut. Das ist eine **andere, eigene Luecke**
(Motor fertig, Produktionsverdrahtung fehlt) — kein Fall des hier beschriebenen Fund, und sollte
in einer eigenen Runde behandelt werden, sobald Mini-DM produktiv angeschlossen wird. Wird das
zukuenftige Wiring wie bei den 13 bestehenden Disziplinen ueber `arenaTeamPointsByDisciplineId`
gefuehrt, erbt Mini-DM **automatisch** denselben Bug — der Fix aus Abschnitt 4 sollte deshalb so
gebaut sein, dass er fuer Mini-DMs 2-1-0-0-Werte genauso greift wie fuer 2-1-0.

### 2.3 Tragweite auf einem echten Spielstand

**Versucht, aber nicht durchfuehrbar in dieser Umgebung:** `npx tsx
scripts/pruefe-spiegel-frische.ts` haengt an `https://olympiade.duckdns.org/...`, und laut
CLAUDE.md ist dieser Host in der Netzwerk-Policy dieser Umgebung nicht freigeschaltet (nur
GitHub/npm sind erreichbar). Der Versuch, den `live-save`-Branch direkt per `git fetch
origin live-save` zu lesen, ist git-basiert und sollte funktionieren — wurde in dieser Runde
aus Zeitgruenden nicht mehr ausgefuehrt.

**Empfehlung fuer die naechste Runde (vor der Umsetzung):** `git fetch origin live-save`,
Abbild importieren, dann fuer jeden Spieltag mit mindestens einer arena-aufgeloesten Disziplin
in `disciplineResults` pruefen: Team-mit-Arena-Sieg (waere `teamPoints: 2`) gegen
Team-mit-Arena-Niederlage (`teamPoints: 0`) — steigt `standings[team].points` danach wirklich um
`2 - 0 = 2` mehr als beim Verlierer, oder (wie im Repro-Test) um eine beliebige andere,
score-abhaengige Differenz? Das waere der reale, nicht nur synthetische Beleg. Ein Skript dafuer
existiert noch nicht; es liesse sich mit wenigen Zeilen aus `saveId`/`seasonId` +
`disciplineResults.filter(r => ARENA_RESOLVED_DISCIPLINE_IDS.has(r.disciplineId))` +
`standingsApplyLogs`/`standings`-Vergleich vor/nach jedem betroffenen Spieltag bauen.

## 3. Warum das bisher nicht auffiel

- In der Arena-Buehne selbst (`discipline-stage-from-preview.ts`) wird die **Live-Preview**
  gezeigt — dort steht der korrekte 2/1/0-Wert, weil dieser Anzeige-Pfad nie durch den
  Mapper/die Persistenz muss.
- Wo die gebuchte Saisontabelle einen falschen, aber PLAUSIBEL WIRKENDEN Wert zeigt (eine Zahl
  zwischen 0 und ~20, nicht offensichtlich „falsch" wie ein Absturz oder eine NaN), faellt der
  Fehler nicht durch ein Fehlerbild auf, sondern nur durch einen Vergleich mit der erwarteten
  2/1/0-Regel — genau die Art Fund, die PR-935-Reviews explizit dafuer gebaut sind aufzudecken.
- Die Nachbuchung (`saisonstand-punkte-nachbuchung.ts`) wurde urspruenglich gebaut, um einen
  ANDEREN, bereits behobenen Fehler zu heilen (fehlender Mutator-Aufschlag) — sie verstaerkt den
  hier beschriebenen Fund unabsichtlich, indem sie denselben blinden Rang-Pfad ein zweites Mal
  anwendet, direkt nach dem ersten.

## 4. Fix-Ansaetze

### Ansatz (a): `teamPoints`/`pointSource` durch die Persistenz tragen, beide Lesepfade patchen

**Idee:** `DisciplineResultWritePayload` (Mapper) um `teamPoints: number | null`,
`pointSource: string`, `resolutionSource?: "pps" | "arena"`, `arenaMatchSeed?: string | null`
erweitern (Felder existieren an der Preview-Quelle bereits 1:1, s. `DisciplineTeamResolvePreview`
in `legacy-matchday-resolve-types.ts` — reines Durchreichen, keine neue Berechnung). Dann:

- `standings-preview-engine.ts::resolveDisciplinePoints()` (oder ihr Aufrufer) liest bei
  `row.resolutionSource === "arena"` `row.teamPoints` direkt, statt `pointsMap.get(playerCount)
  .get(rank)` — nur fuer arena-aufgeloeste Zeilen, jede andere Zeile bleibt exakt beim
  bisherigen Pfad (kein Verhalten aendert sich fuer die sieben verbleibenden PPS-Disziplinen).
- `season-points-ledger.ts::deriveRankPointsFromPerformances()` (oder die Stelle, die
  `teamResult.rank` liest) braucht denselben Fruehausstieg fuer `resolutionSource === "arena"` —
  **sonst ueberschreibt die Nachbuchung den frisch reparierten Wert aus dem ersten Punkt wieder**
  (Abschnitt 1.3/1.4, empirisch bestaetigt). Das ist der Teil, den ein Fix leicht uebersieht, weil
  er in einer anderen Datei/einem anderen Aufrufer (`matchday-auto-run-service.ts` statt
  `standings-apply-service.ts`) unsichtbar bleibt, bis man testet statt nur liest.
- Betroffene Dateien (Schaetzung): `legacy-matchday-result-mapper.ts` (Typ + Mapping, ~10
  Zeilen), `legacy-matchday-resolve-types.ts` ggf. keine Aenderung (Quelle hat die Felder schon),
  `standings-preview-engine.ts` (`resolveDisciplinePoints()`-Aufrufer + Typ `DisciplineByTeam`
  um `resolutionSource`/`teamPoints` erweitern, ~15-20 Zeilen), `season-points-ledger.ts`
  (`deriveRankPointsFromPerformances()` + `DisciplineResultRecord`-Typ, ~15-20 Zeilen),
  `lib/data/olyDataTypes.ts` (`DisciplineResultRecord` um dieselben vier Felder erweitern, da
  sie ja gespeichert werden muessen).
- **Risiko fuer die 12 anderen/7 verbleibenden Disziplinen:** gering, wenn der neue Zweig
  wirklich nur bei `resolutionSource === "arena"` greift (per-Zeile, nicht per-Disziplin-Liste —
  vermeidet eine zweite Kopie von `ARENA_RESOLVED_DISCIPLINE_IDS` an einer dritten Stelle). Ein
  Save mit **aelteren** (vor diesem Fix gebuchten) `disciplineResults`-Zeilen hat kein
  `resolutionSource`-Feld — muss als `"pps"` behandelt werden (genau das Default-Verhalten, das
  `DisciplineTeamResolvePreview.resolutionSource?: "pps" | "arena"` schon fuer die Preview
  dokumentiert, hier 1:1 uebernommen). **Wichtig:** bereits gebuchte Spieltage vor dem Fix
  bleiben falsch gebucht, bis sie erneut resolved werden (kein automatisches Ruecknachbuchen ist
  hier vorgesehen — das waere eine eigene, separate Migrationsentscheidung).
- **Verifikation:** `tests/battle-mode-arena-matchday-resolve-e2e.test.ts` (Chromium-gestuetzt,
  prueft die Live-Preview — sollte unveraendert gruen bleiben, da diese Ebene nicht angefasst
  wird), `tests/standings-apply-service.test.ts`/`tests/standings-preview-engine.test.ts`
  (bestehende Mocks muessten um `resolutionSource`/`teamPoints`-Spalten erweitert werden, sonst
  testen sie weiter nur den PPS-Fall), und der in dieser Runde gebaute
  `tests/standings-bypass-arena-repro.test.ts` als direkter Regressionstest — Schritt 3 muesste
  nach dem Fix `pointsDelta` bzw. die gebuchte Differenz auf exakt 2,0 statt 5,0/0,0 zeigen.
  Kaderfest-Rangtreue-Messungen (`scripts/miss-alle-disziplinen.mjs`) sind hier **nicht** die
  richtige Regressionsprobe — sie messen die Eignungs-zu-Wert-Kette der Motoren, nicht die
  Team-Punkte-Buchung; ein eigenes kleines Skript (Vergleich Arena-Ergebnis vs. gebuchte
  Punktedifferenz ueber N simulierte Spieltage) waere der passendere Regressionsschutz.

### Ansatz (b): Rang selbst an der Wurzel aus dem Arena-Ergebnis ableiten

**Idee:** Statt `teamPoints` zusaetzlich durchzureichen, den `rank` in der Live-Preview
(Abschnitt 1.1) fuer arena-aufgeloeste Zeilen so setzen, dass die BESTEHENDE
Rang-zu-Punkte-Tabelle ohnehin 2/1/0 liefert — dann muessten Mapper/Persistenz/beide Lesepfade
gar nicht angefasst werden.

**Das trägt nicht, nachgerechnet statt angenommen:**

1. **2 Teams je Disziplinseite (Basketball, Gewichtheben, Hockey, Speed-Schach, Showcase,
   Eiskunstlauf, Breaking, Wettessen, Tennis, Fechten, Staffel, Takeshi's Castle, Time-Trial,
   Spurt — JEDE der 13 arena-aufgeloesten Disziplinen ist ein reines 1-gegen-1-Team-Duell,
   nachgesehen in `arena-matchday-resolve-service.ts`/`battle-mode-arena-team-points.ts`: es
   gibt keine N-Team-Arena-Disziplin unter den 13):** Bei genau zwei Teams je Seite gibt die
   normale `rank-to-points`-Tabelle fuer Rang 1/2 in JEDER Feldgroesse **zwei nahe beieinander
   liegende, aber niemals 2/0 oder 1/1 lautende Werte** (im Repro-Test: 6,6/6,2 bei
   `playerCount:2` — das reale `rank-to-points.json` duerfte aehnlich eng liegen, da die Tabelle
   durchgehend auf „Score-Anteil", nicht auf „Sieg/Niederlage" ausgelegt ist). **Eine reine
   Rang-Neuzuordnung kann also nicht auf 2/1/0 gebracht werden, ohne die Tabelle selbst fuer
   genau diese Zeilen zu ignorieren** — was in der Sache Ansatz (a) mit Umwegen waere (man muesste
   an der Lookup-Stelle trotzdem wissen „das ist Arena, nimm nicht die Tabelle").
2. **Unentschieden hat in der Rang-Welt keine Entsprechung.** Rang 1/Rang 1 (geteilter Platz)
   existiert als Konzept in `rankWithinLeagueScope()`, aber die zugehoerige Punktzahl waere der
   Mittelwert der Score-Tabelle fuer die geteilten Plaetze — nicht zwangslaeufig `ARENA_TEAM_
   POINTS.draw = 1`, ausser die Tabelle selbst haette bei Rang-1-Gleichstand zufaellig genau
   1 Punkt Differenz zu den Nachbarraengen, was nicht der Fall ist.
3. **Ein synthetischer Rang wuerde die INDIVIDUELLEN PPs verzerren, die von `teamPoints`
   ausdruecklich entkoppelt sein sollen** (Kopfkommentar `battle-mode-arena-team-points.ts`:
   „INDIVIDUELLE PPs SIND WEITERHIN ECHT ENTKOPPELT VON DEN TEAM-PUNKTEN ... das ist gewollt").
   `distributeRankPointsToPlayers()` haengt an `rank` UND `playerCount`, um Spieler-PPs aus dem
   Team-Rang zu verteilen (Zeile 800-809 in `legacy-matchday-resolve-engine.ts`) — ein
   veraenderter `rank` wuerde diese Verteilung mitreissen, obwohl sie laut derselben Code-Stelle
   fuer Arena-Zeilen unveraendert PPS-basiert bleiben soll (`rankedTeam.entries` bekommt
   `arenaPps ?? pointsByPlayerId...`, Zeile 836-840 — die Team-Punkte-Frage und die
   Spieler-PPs-Frage sind im bestehenden Code bewusst getrennt gehalten).

**Fazit zu (b): technisch nicht sauber durchfuehrbar**, ohne entweder die
Rang-zu-Punkte-Tabelle fuer Arena-Zeilen zu unterlaufen (= Ansatz (a) durch die Hintertuer) oder
die davon abhaengige Spieler-PPs-Verteilung mit zu verbiegen. Wird hier **nicht empfohlen**,
aber der Vollstaendigkeit halber mit Belegen statt Vermutung dokumentiert, wie im Auftrag
verlangt.

## 5. Empfehlung

**Ansatz (a), mit dem in Abschnitt 1.3/1.4 explizit benannten zweiten Patch-Ort
(`season-points-ledger.ts`) als Teil DESSELBEN Fixes, nicht als Nachtrag.** Ansatz (b) scheitert
strukturell an der 2-Team-Natur der Arena-Duelle und an der bewussten Entkopplung von
Team-Punkten und Spieler-PPs. Ein Fix, der nur `standings-preview-engine.ts` aendert und die
Nachbuchung uebersieht, waere ein Fix, der lokal getestet gruen aussieht (Preview-Stufe korrekt)
und live trotzdem falsch bucht (Nachbuchungs-Stufe ueberschreibt) — genau der Fehlerfall, den der
in dieser Runde gebaute Repro-Test als Schritt 3 sichtbar macht.

**Reihenfolge fuer die Umsetzungsrunde:**
1. `olyDataTypes.ts`/`legacy-matchday-result-mapper.ts`: Felder ergaenzen, Migration alter Saves
   pruefen (fehlende Felder muessen defensiv `"pps"`/`null` ergeben, nie werfen).
2. `standings-preview-engine.ts` UND `season-points-ledger.ts` in **derselben** PR patchen —
   nicht nacheinander in zwei Runden, sonst existiert zwischenzeitlich genau die inkonsistente
   Zwischenstufe, die der Repro-Test aufdeckt.
3. `tests/standings-bypass-arena-repro.test.ts` (oder eine bereinigte Fassung davon) als
   staendigen Regressionstest in die Suite aufnehmen.
4. Vor Abschluss: Tragweiten-Check gegen den echten `live-save`-Spiegel (Abschnitt 2.3), um zu
   pruefen, ob bereits gebuchte Spieltage nachtraeglich korrigiert werden muessen (separate
   Migrationsentscheidung, nicht Teil dieses Fixes).

## 6. Was in dieser Runde entstanden, aber NICHT committet ist

`tests/standings-bypass-arena-repro.test.ts` wurde fuer diese Recherche geschrieben und lokal
verifiziert (`npx vitest run tests/standings-bypass-arena-repro.test.ts` — 3/3 gruen), aber
gemaess Auftrag **nicht** Teil dieses Commits (nur dieses Dokument wird committet). Die
Umsetzungsrunde sollte ihn (oder eine bereinigte Fassung) als Regressionstest mit aufnehmen —
s. Empfehlung Punkt 3.

## 7. Offene Fragen

- **Migration bereits gebuchter Spieltage:** wie viele Spieltage auf dem Live-Save sind bereits
  mit falsch gebuchten Arena-Punkten gewertet, und will Chris eine Ruecknachbuchung (analog zur
  bestehenden Mutator-Nachbuchung, Abschnitt 3) oder soll der Fix nur ab dem Deploy-Zeitpunkt
  gelten? Ohne den echten Save-Zugriff (Abschnitt 2.3) laesst sich das in dieser Runde nicht
  beziffern.
- **Mini-DM-Anschluss:** wenn Mini-DM kuenftig ueber denselben `arenaTeamPointsByDisciplineId`-
  Mechanismus angeschlossen wird, muss der Fix aus Abschnitt 4 seine 2-1-0-0-Werte genauso
  durchreichen wie 2-1-0 fuer die bestehenden 13 — das sollte beim Anschluss explizit
  nachgeprueft werden, nicht stillschweigend vorausgesetzt.
- **Football:** derzeit weder arena- noch von diesem Fund betroffen (Achse 2 fehlt weiterhin,
  `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Eintrag/PPS-Referenz nicht gezogen) — sobald es
  angeschlossen wird, erbt es automatisch den hier beschriebenen (dann hoffentlich schon
  behobenen) Mechanismus.
- **Dritter/vierter Konsument von `disciplineResults.rank`:** diese Recherche hat
  `standings-preview-engine.ts` und `season-points-ledger.ts` als die beiden fuer die gebuchte
  Saisontabelle relevanten Konsumenten identifiziert (`lineup-discipline-contract.ts` und
  `ai-legacy-lineup-engine.ts` nutzen `getRankToPointsValue()`/`distributeRankPointsToPlayers()`
  ebenfalls, aber fuer KI-Aufstellungsentscheidungen, nicht fuer die Buchung) — sollte die
  Umsetzungsrunde einen weiteren, hier uebersehenen Konsumenten von `DisciplineResultRecord.rank`
  finden, gilt fuer ihn dieselbe Pruefung wie fuer die zwei hier behandelten.
