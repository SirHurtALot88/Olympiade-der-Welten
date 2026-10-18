# PPS-Duell-Brücke: individuelle PPs von Team-Rang entkoppelt (18.10.)

Fix von Task #176 (Opus-Befund, höchste Priorität). Basis: `main` = `308ccaa9`, PR #1277
(`pps-duell-abnahme-messung`, noch offen) als Vorarbeit gemergt.

---

## 0. Der Befund (verifiziert, nicht blind übernommen)

Die PPS-Duell-Brücke (`lib/resolve/battle-mode-pps-duell.ts`, PR #1266, 16.10.) ersetzt in einem
Battle-Save die TEAM-Punkte jeder nicht-arena-aufgelösten Disziplin durch 2/1/0 (Sieg/Remis/
Niederlage je Fixture) — das war schon richtig. Was die Brücke laut ihrem eigenen Konzeptdokument
(`pps-duell-bruecke-punkteverhaeltnis-16-10.md` Abschnitt 1, wörtlich) bewusst NICHT änderte:
„Individuelle Spieler-PPs bleiben wie im Konzept 5.2 beim bisherigen PPS-Anteil
(`distributeRankPointsToPlayers()`) — nur der TEAM-Wert wechselt."

Nachgelesen in `lib/resolve/legacy-matchday-resolve-engine.ts`: für jede Battle-Mode-Disziplin/
-Seite ruft die Engine `distributeRankPointsToPlayers({ rank: rankedTeam.rank, playerCount, ... })`
auf — `rankedTeam.rank` ist der TEAM-Rang innerhalb der Liga aus `rankWithinLeagueScope()` (Zeile
~840), nicht die individuelle Spieler-Eignung. Dieser Rang bestimmt über
`getRankToPointsValue(playerCount, rank)` (`rank-to-points.ts`, bis 19,9 für Rang 1 bei
Feldgröße 6, bis 0,2 für Rang 32) den TOPF, der dann proportional zum `finalPlayerScore` der
Spieler INNERHALB des Teams verteilt wird.

Für arena-aufgelöste Disziplinen ist das längst anders gelöst: `arenaIndividualPpsForThisDiscipline`
(aus `computeIndividualBoxscorePpsFromFixtureResults()`/`ppsAusArenaImpact()`,
`battle-mode-arena-team-points.ts`) überschreibt `pointsAwarded` pro Spieler mit einem Wert aus
einer Impact-Kurve gegen eine FESTE, ligaweit gezogene Referenz (`iMittel`/`iKrass`) — kein
Team-Bezug. Für die PPS-Duell-Brücke gab es dieses Analogon bisher nicht — die Brücke selbst hat
daran laut Code auch gar nichts geändert, es war eine zum Zeitpunkt der 16.10.-PR bewusste, aber
jetzt als Bug eingestufte Vereinfachung.

**Folge:** ein Star-Spieler in einem Team, dessen übrige Spieler schwach sind (= niedriger
Team-Rang), bekam einen winzigen Anteil eines winzigen Topfs — ein mittelmäßiger Spieler in einem
insgesamt starken Team (= hoher Team-Rang) einen großen Anteil eines großen Topfs. Nicht weil er
schlechter spielte, sondern weil sein Team insgesamt schlechter abschnitt.

**Reichweite:** betrifft praktisch jede Disziplin in jedem heutigen Battle-Save, weil der
Arena-Vorlauf (PR 3, parallel in Arbeit) noch nicht an den Auto-Run angebunden ist — bis dahin
läuft JEDE Disziplin über die Brücke, auch die 13, deren Arena-Ergebnis später zählen würde.

---

## 1. Der Fix: eine Impact-Kurve für die Brücke, analog zur Arena

`ppsAusDuellWert()` (neu, `lib/resolve/battle-mode-pps-duell.ts`) — bewusst eine EIGENSTÄNDIGE,
dünne Kopie von `ppsAusArenaImpact()` (`battle-mode-arena-team-points.ts`), kein Import von dort:
jene Datei zieht über `arena-headless-runner.ts` Playwright/`node:fs` mit, die
`battle-mode-pps-duell.ts` laut ihrem eigenen Dateikopf-Kommentar NICHT mitziehen darf (sie muss
rein/synchron bleiben, damit `legacy-matchday-resolve-engine.ts` sie importieren kann).

```
PPs = MAX * min(1, (max(0, I) / I_krass)^gamma)
gamma = ln(a_mitte) / ln(I_mittel / I_krass)
```

`MAX = 5,5`, `a_mitte = 0,25` — dieselben zwei Regler wie bei der Arena (Chris' Rahmen „max 5-6",
an 352 echten Duellen entschiedene Kurvenform, 04.09.). `I` ist hier `finalPlayerScore` (derselbe
Kanal, den `distributeRankPointsToPlayers()` bisher team-rang-gebunden verteilt hat), nicht ein
Arena-Boxscore-Wert.

**Einhängung** (`legacy-matchday-resolve-engine.ts`): für eine Seite mit
`resolutionSource === "pps_duell"` wird `berechneDuellIndividualPpsFuerSeite()` aufgerufen; ihr
Ergebnis ersetzt `pointsAwarded` — exakt an derselben Stelle und mit derselben Priorität wie
`arenaIndividualPpsForThisDiscipline` (`?? duellIndividualPps ?? pointsByPlayerId ...`). Liefert sie
`null` (keine Referenz gezogen), bleibt der alte, team-rang-gebundene Pfad unverändert aktiv — mit
Warnung `pps_duell_individual_referenz_fehlt:<disziplin>` statt still falsch.

## 2. Die Referenz — echte Ziehung, Provenienz, beide Ligen

`scripts/ziehe-pps-duell-individuell-referenz.ts` (neu) — Bruecken-Analogon zu
`scripts/ziehe-basketball-pps-referenz.ts`, aber OHNE Playwright: der PPS-Pfad ist reiner
Node-Code, derselbe Mechanismus wie das bereits bestehende `scripts/ziehe-verhaeltnis-referenz.ts`
(echte Kader aus dem Live-Save-Abbild, echte KI-Aufstellung über
`buildAiLegacyLineupPreviewWithModifiers()`, echte Formkarten/Mutatoren/Team-Powers/Fatigue/
Verletzung über `buildLegacyMatchdayResolvePreview()`).

- **Bezugsbasis: BEIDE Ligen gemeinsam**, kein Split — Chris' Entscheidung vom 31.08.
  (`docs/design/battle-mode-pps-modell-plan.md` Abschnitt 7 Punkt 2: „Referenz-Pool — ENTSCHIEDEN
  (31.08.): gemeinsam über beide Ligen").
- **Nur Feldgröße 5 und 6** — die CLAUDE.md-Abnahmegrößen. Feldgröße 2..4 ist Task #175, ein
  separat offener Punkt; `resolveDuellIndividualPpsReferenz()` liefert dafür BEWUSST `null` statt
  per Nearest-Match (wie `resolveArenaPpsReferenz()`) in ungemessenes Gebiet zu extrapolieren — der
  Aufrufer fällt dann unverändert auf den alten Pfad zurück. Das verschlimmert Task #175 nicht,
  löst es aber auch nicht.
- **Zwei unabhängige Saatströme** (disjunkte Spieltags-Hälften) — die Datei hält beide, die Laufzeit
  mittelt `iMittel`/`iKrass` über sie.
- **Provenienz in der Datei selbst**: `repoCommit`, `gezogenAm`, `quelle` (saveId/saveName/seasonId),
  `vorschauenGesamt`, je Disziplin/Feldgröße die Stichprobengröße (`werte`).

`data/generated/pps-duell-bruecke-individuell-referenz.json` — gezogen: **alle 20 Disziplinen x
{5,6}**, 120 Vorschauen gesamt (3897 s), 400–580 Spielerwerte je (Disziplin, Feldgröße, Strom) außer
Mini-DM (96 — Pod-Format, ein „Spieler" je Team und Spieltag, s. Abschnitt 6). Die beiden Ströme
liegen für jede Disziplin plausibel nah beieinander (z. B. Basketball n=6: iMittel 34,15/36,95,
iKrass 113,7/108,44 — Streuung im erwarteten Bereich einer realen Stichprobe, keine strukturelle
Verzerrung zwischen den Strömen).

## 3. Scope-Grenze: nur Battle Mode

Jede Code-Änderung ist gated hinter `rankedTeam?.resolutionSource === "pps_duell"`, was nur
innerhalb von Battle-Mode-Saves (`isBattleModeArenaEligible`) je gesetzt wird — Manager Mode ruft
diesen Zweig nie auf. Das neue, additive Debug-Feld `duellIndividualPpsApplied` wird über einen
BEDINGTEN Spread gesetzt (nie als `unconditional false`), damit es in Manager-Mode-Zeilen GAR NICHT
auftaucht — sonst wäre die Preview-JSON nicht mehr byte-identisch zum Stand vor dieser Änderung.

**Nachgewiesen mit beiden projektüblichen Sonden**, je einmal auf `main` (`308ccaa9`, dem
Merge-Base dieses Branches) und einmal auf diesem Branch, gegen dieselbe Kopie des Live-Save-
Abbilds (acht Saves, alle `gameMode: manager`, je zehn Spieltage):

```
OLY_APP_SQLITE_PATH=<kopie> npx tsx scripts/pruefe-resolve-bit-identitaet.ts <ausgabe.json>
OLY_APP_SQLITE_PATH=<kopie> npx tsx scripts/pruefe-mapper-bit-identitaet.ts <ausgabe.json>
diff vorher.json nachher.json   ->  IDENTISCH (beide Sonden)
```

## 4. Abnahme-Messung

`scripts/miss-pps-duell-bruecke-abnahme.ts` (PR #1277) erweitert um die eigentliche
CLAUDE.md-Einzelspiel-Kennzahl für ein Zwei-Team-Duell: **`fixtureRho`** — Spearman-rho zwischen
Eignung und vergebener PP, über BEIDE Seiten eines Fixtures zusammen (vorher maß das Skript nur
innerhalb EINER Team-Seite, `spielerRhoMedian` — das verdeckte das Team-Rang-Problem komplett, weil
die Verteilung innerhalb eines Teams schon immer linear war, s. Abschnitt 4.1). Dazu
**`crossTeamPaartreue`** — dieselbe <2/2..15/>=15-Bucket-Logik wie die bestehende
`paartreueNachEignungsabstand`, aber auf Spieler-Paare VERSCHIEDENER Teams.

### 4.1 Nebenfund beim Nachmessen: das Abnahme-Skript selbst lief nie über die Brücke

Beim ersten Vorher/Nachher-Vergleich waren die Zahlen VOR und NACH diesem Fix **byte-identisch** —
ein Alarmsignal, keine gute Nachricht. Ursache: `miss-pps-duell-bruecke-abnahme.ts` biegt den
Spielplan (`disciplineSchedule`) korrekt auf die Zieldisziplin um, setzt aber nirgends
`scenarioMeta.gameMode = "battle"` am verwendeten Save (einem der acht Manager-Mode-Saves des
Live-Abbilds). `isBattleModeSave()`/`isBattleModeArenaEligible`
(`legacy-matchday-resolve-engine.ts`) blieben dadurch `false`, jede Zeile lief als `resolutionSource:
"pps"` statt `"pps_duell"` — die Messung testete die ganze Zeit den normalen Manager-Mode-Rangpfad,
nie die Brücke selbst. Behoben mit einem `scenarioMeta`-Override an der Stelle, an der das Skript
den `gs` für jeden Probe-Spieltag baut (s. Diff) — eine einzeilige Korrektur, dokumentiert im Code.
Ohne diese Korrektur hätte JEDER künftige Vorher/Nachher-Vergleich an dieser Datei denselben
Fehlalarm (bzw. Fehl-Entwarnung) geliefert.

### 4.2 Zahlen (Feldgröße 6, nach der Korrektur aus 4.1 — vier Spieltage, zwei Pp-Trials je Seite
statt der Standardwerte 6/8, wegen geteilter Rechenzeit in dieser Umgebung; acht Standard-
Disziplinen, zwei Saatströme)

| Disziplin | fixtureRho vorher (Strom 0 / Strom 1) | fixtureRho nachher (Strom 0 / Strom 1) |
|---|---:|---:|
| football | 0,761 / 0,752 | 0,766 / 0,759 |
| i-spy | 0,745 / 0,763 | 0,756 / 0,763 |
| battlefield | 0,777 / 0,804 | 0,777 / 0,797 |
| tdm | 0,783 / 0,770 | 0,786 / 0,777 |
| basketball | 0,719 / 0,751 | 0,748 / 0,762 |
| hockey | 0,779 / 0,793 | 0,779 / 0,807 |
| fechten | 0,710 / 0,724 | 0,715 / 0,733 |
| mini-dm | n=0 (kein Fixture-Format) | n=0 (unverändert, s. Abschnitt 6) |

Feldgröße 5 (dieselben Bedingungen): football 0,733/0,764 → 0,752/0,764; i-spy 0,777/0,747 →
0,782/0,758; battlefield 0,760/0,770 → 0,747/0,770; tdm 0,795/0,794 → 0,785/0,794; basketball
0,693/0,721 → 0,701/0,725; hockey 0,784/0,758 → 0,795/0,767; fechten 0,748/0,770 → 0,770/0,782.

**Ehrliche Einordnung, keine Schönfärberei:** die Richtung stimmt (in 12 von 14
Disziplin/Strom-Kombinationen bei Feldgröße 6, 10 von 14 bei Feldgröße 5 steigt fixtureRho), der
crossTeamPaartreue-Bucket >=15 bewegt sich ebenfalls leicht nach oben oder bleibt gleich (z. B.
Hockey n=6: Strom 0 von 81 % auf 82 % (n=1590), Strom 1 unverändert bei 80 % (n=1570)) — durchweg im
78–90 %-Band, konsistent mit der CLAUDE.md-Beobachtung, dass Paare ab 15 Punkten Abstand ohnehin
fast immer richtig geordnet werden.
**Die 0,80-Schranke wird damit aber NICHT durchgängig erreicht** — der Effekt ist real und
richtungssicher, aber klein (typisch +0,01 bis +0,03 auf die Mediane dieser reduzierten Stichprobe),
nicht die dramatische Verbesserung, die der Team-Rang-Bug bei einem künstlichen Extremfall zeigt
(s. Regressionstest, `tests/battle-mode-pps-duell.test.ts`: Star in schwachem Team schlägt
Mittelmaß in starkem Team jetzt zuverlässig, vorher zuverlässig umgekehrt). Zwei plausible Gründe,
beide nicht ausgeschlossen: (a) echte Rosters zeigen die im Unit-Test konstruierte Extremlücke
(Team-Summe 120 vs. 300) seltener, der praktische Effekt ist dadurch kleiner als das Worst-Case-
Beispiel; (b) die reduzierte Stichprobe (4 statt 6 Spieltage, 2 statt 8 Pp-Trials) trägt zusätzliches
Rauschen, das einen größeren wahren Effekt teilweise verdeckt — ein voller Lauf mit den
Standardwerten des Skripts (nicht in dieser Session gefahren, s. Abschnitt 6) wäre nötig, um das zu
trennen. **Ergebnis für den PR**: der Team-Rang-Bug ist nachweislich behoben (Mechanismus +
Regressionstest + reale, wenn auch kleine, richtungssichere Verbesserung) — dass die 0,80-Schranke
für die Brücken-Disziplinen damit allein erreicht wird, ist NICHT belegt und sollte nicht als
"done" gemeldet werden; das ist ein ehrlicher offener Punkt, kein verstecktes Problem.

Teil B (Pp-Abweichung) ist zwischen vorher/nachher **identisch** (z. B. Football 33,6/96,5 in
beiden Fällen) — erwartet und richtig: dieser Fix ändert nur, WIE ein bereits berechneter Score in
PP übersetzt wird, nicht den Score-Kanal selbst (`calculateRawDisciplineScore()`), den Teil B prüft.

Aufruf (zwei Läufe, einmal je Feldgröße; `--spieltage`/`--pp-trials-je-seite` für die vollen
Standardwerte weglassen, wenn die Rechenzeit verfügbar ist):

```
OLY_APP_SQLITE_PATH=<kopie> npx tsx scripts/miss-pps-duell-bruecke-abnahme.ts --feldgroesse=6
OLY_APP_SQLITE_PATH=<kopie> npx tsx scripts/miss-pps-duell-bruecke-abnahme.ts --feldgroesse=5
```

## 5. Gesamtsumme der PPs — vorher/nachher (Opus-Auflage 18.10.)

`scripts/e2e-battle-pps-duell.ts` (erweitert) summiert `seasonState.playerDisciplinePerformances[].
scoreContribution` (trägt den tatsächlich vergebenen `pointsAwarded`-Wert) je Spieltag und Saison,
für einen frischen Battle-Smoke-Save (3 Spieltage, Auto-Run, alle Teams KI).

**Wichtige Einschränkung der Messmethode:** `applyNewGameSetup()` erzeugt bei jedem Lauf einen NEUEN
Save mit eigenem Kader-Zufallsziehung und eigenem gewürfeltem Spielplan (welche Disziplinen an
welchen Spieltagen, welche Feldgröße) — zwei separate Läufe sind deshalb NICHT exakt derselbe
Versuchsaufbau (unterschiedliche Disziplinen, unterschiedliche Kadergrößen: 639 vs. 958
Spieler-Zeilen). Die Zahlen sind ein Trend-Indikator, kein kontrolliertes A/B-Paar:

| | Vorher (main) | Nachher (Branch, volle Referenz) | 
|---|---:|---:|
| PP-Summe gesamt (3 Spieltage) | 1515,9 | 1906,0 |
| Spieler-Zeilen | 639 | 958 |
| **PP je Zeile (normiert)** | **2,37** | **1,99** |
| davon über Duell-Zeilen (pps_duell/arena) | 1515,9 (100 %) | 1906,0 (100 %) |

**Δ auf der normierten Kennzahl (PP je Zeile): −16 %.** Dieselbe Größenordnung zeigte sich
reproduzierbar in einem dritten, unabhängigen Branch-Lauf (noch ohne vollständige Referenz, nur
Basketball/Hockey gezogen): 1,98 PP/Zeile — die Richtung und Größenordnung ist also stabil über
mehrere unabhängige Zufallsziehungen, nicht nur ein einzelner Ausreißer.

**Einordnung:** eine Abweichung in dieser Größenordnung ist ERWARTET und beabsichtigt, kein
Normierungsfall — aus demselben Grund, aus dem die Arena-Impact-Kurve
(`battle-mode-arena-team-points.ts`, PR7) ihre eigene `MAX` bewusst von 6,6 auf 5,5 gesenkt hat:
„das Modell sonst jedem Team Meisterniveau zahlt". Der alte Team-Rang-Topf zahlte bis zu 19,9 PP für
Rang 1 — ein Vielfaches der Kurven-Obergrenze 5,5; ein Rückgang der Durchschnitts-PP war beim Wechsel
von diesem Topf auf eine bei 5,5 gedeckelte Kurve überhaupt zu erwarten, nicht ein Messfehler. Die
individuellen PPs waren laut `battle-mode-arena-team-points.ts` (Kommentar „INDIVIDUELLE PPs SIND
WEITERHIN ECHT ENTKOPPELT VON DEN TEAM-PUNKTEN ... das ist gewollt, nicht vergessen") schon für die
13 arena-aufgelösten Disziplinen bewusst NICHT an die alte Rangtabellen-Skala gebunden — dieser Fix
zieht die restlichen Disziplinen auf genau dasselbe, bereits etablierte Niveau nach, statt eine
zweite, inkompatible Ökonomie zu erfinden. **Eine zusätzliche Normierung auf die alte Gesamtmenge
würde genau diese bereits getroffene, dokumentierte Design-Entscheidung der Arena wieder
rückgängig machen** und ist deshalb hier NICHT gebaut — wer das anders haben möchte, müsste dieselbe
Frage auch für die 13 Arena-Disziplinen neu aufwerfen. Downstream-Wirkung (Progression, MVP,
Rekorde, KI-Verkaufswert) ist dieselbe wie bei der Arena-Einführung selbst, also kein neues Risiko,
sondern eine bereits einmal (für die Arena) bewusst getroffene und seitdem gelebte Entscheidung.

## 6. Was offen bleibt

- **Die 0,80-rho-Schranke ist mit diesem Fix ALLEIN noch nicht durchgängig erreicht** (s. 4.2) —
  der Team-Rang-Bug ist nachweislich behoben, aber nicht die einzige Rauschquelle der Brücke. Ein
  sinnvoller nächster Schritt (nicht Teil dieses PRs): ein voller Lauf von
  `miss-pps-duell-bruecke-abnahme.ts` mit den Standardwerten (`--spieltage=6`, 8 Pp-Trials je Seite
  statt der hier aus Zeitgründen reduzierten 4/2) für ein rauschärmeres Bild, plus eine Prüfung, ob
  die verbleibende Lücke strukturell (knappe Paare, s. CLAUDE.md) oder durch die Kurvenregler
  (`PPS_DUELL_PPS_ANTEIL_MITTE`/`-MAX`) noch beeinflussbar ist.
- **Feldgröße 2..4** (Task #175): unverändert auf dem alten, team-rang-gebundenen Pfad — bewusst
  nicht angefasst, nicht verschlimmert.
- **Merge-Reihenfolge**: dieser PR überschneidet sich an `legacy-matchday-resolve-types.ts` mit PR3
  (Arena-Vorlauf-Anbindung, Branch `pr3-arena-vorlauf-k1-16-10`, nachgesehen per
  `git diff origin/main...origin/pr3-arena-vorlauf-k1-16-10`) — PR3 fügt dort `"eingabe_instabil"`
  zu `ArenaAusfallGrund` hinzu (um Zeile ~110), dieser PR fügt `duellIndividualPpsApplied` zu
  `PlayerPerformancePreview` hinzu (um Zeile ~64) — zwei unabhängige Stellen in derselben Datei,
  ein trivialer Textkonflikt beim Mergen, kein inhaltlicher. `legacy-matchday-resolve-engine.ts`
  selbst und `battle-mode-pps-duell.ts` sind in PR3 unberührt. Soll laut Anweisung trotzdem ERST
  NACH PR3 gemergt werden.
- **Mini-DM**: bleibt auf der Brücke (eigener Pod-Resolve ist ein separater, offener Task, s.
  `pps-duell-bruecke-punkteverhaeltnis-16-10.md` Abschnitt 5.3) — ob Mini-DM in der neuen Referenz
  sinnvolle Werte bekommt, ist ungeprüft (Pod-Struktur, kein klassisches Zwei-Team-Fixture,
  `fixtureRho` liefert dafür `n=0`).
- **`data/generated/pps-duell-bruecke-abnahme.json`** (PR #1277) bleibt in diesem PR UNVERÄNDERT
  (bewusst nicht überschrieben mit den reduzierten Testläufen dieser Session) — Teil B darin ist von
  diesem Fix ohnehin nicht betroffen (s. 4.2), Teil A müsste für einen saubereren Vergleich mit den
  Standardwerten neu gezogen werden, s. erster Punkt oben.
  `data/generated/pps-duell-bruecke-abnahme-n5.json` (neu, Feldgröße 5) ist ebenfalls aus dieser
  reduzierten Messung und entsprechend nur als Zusatzbeleg zu lesen, nicht als finale Abnahme.
