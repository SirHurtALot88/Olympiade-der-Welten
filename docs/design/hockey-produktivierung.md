# Hockey: Produktivierung — ins echte Spiel

Stand 04.09.2026, Branch `claude/hockey-produktivierung` (abgezweigt von `origin/main` `d1f3d2d8`,
dem Merge-Commit von PR #776, der Gewichtheben produktiviert hat). Chris, nachdem Gewichtheben
gerade als zweite Disziplin ins echte Spiel gebracht wurde: „alles klar wenn gewichtheben drin
ist kümmerst du dich um hockey dass das auch ingame ist". Er hat außerdem ausdrücklich bestätigt,
dass Hockeys aktuelle Rangtreue (0,669 alle 12 / 0,719 nur Feldspieler — unter der 0,80-Schranke
aus CLAUDE.md, aber laut NHL-Recherche bereits rangtreuer als echtes Eishockey selbst, das bei
rho ≈ 0,40 liegt) für den Live-Betrieb ausreicht — **keine weitere Rangtreue-Runde in dieser
Änderung.**

**Das ist Produktionscode** (`lib/`, `app/`, `public/mockups/battle-mode.engine.js`) — derselbe
Motor, dieselbe Resolve-Pipeline, die echte Spielstände bewegen. Jede Änderung ist so gebaut,
dass sie für Basketball UND Gewichtheben (die beiden bereits produktiven Disziplinen)
**bit-identisches Verhalten** behält, nachgewiesen über die vollständige, unveränderte
Basketball- UND Gewichtheben-Testsuite (s. Abschnitt „Regressionsnachweis").

## Kurzfassung

| Schritt | Ergebnis |
|---|---|
| Chassis-Frage | **Geprüft, keine Änderung nötig — anders als bei Gewichtheben.** Hockey läuft über dasselbe Feldspiel-Chassis wie Basketball (`FELDSPIEL_ART.hockey` existiert im Motor seit Wochen, `spieleFeldspiel("hockey", saat)` funktioniert unverändert). `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS` bleibt **unverändert** bei `{"gewichtheben"}`. |
| 1 — PPS-Referenz ziehen | **Erledigt, MIT Torwart-Besonderheit.** `scripts/ziehe-hockey-pps-referenz.ts`, gezogen gegen den echten `live-save`-Kader. Anders als bei Basketball/Gewichtheben: **zwei getrennte Referenzen** (`feldgroessen`/`feldgroessenTorwart`), empirisch als nötig befunden (s. u.). |
| 2 — `ARENA_IMPACT_KONFIG_JE_DISZIPLIN` | **Erledigt.** Eintrag für `"hockey"` mit eigener `max`/`anteilMitte` (unverändert von Basketballs Rahmen übernommen, wie bei Gewichtheben) plus `referenzFeldgroessenTorwart`. |
| 3 — `ARENA_RESOLVED_DISCIPLINE_IDS` | **Erledigt, als letzter Schritt**, nachdem 1/2 standen und getestet waren — dieselbe Reihenfolge-Regel wie bei Gewichtheben. |
| 4 — Stage-Ansicht (`rink.tsx`) | **Geprüft, keine Änderung nötig.** Anders als `barbell.tsx` (das an einer visualisierungs-eigenen 150–400-kg-Remap-Formel hängt) liest `rink.tsx` nur den generischen, disziplin-agnostischen `score`/`animScore`-Pfad, den jede der zwanzig Disziplinen-Stage-Komponenten teilt — kein hockey-spezifischer Code, keine Ableitung, die die neue PPS-Quelle umgehen könnte. |
| 5 — Mid-Season-Risiko | **Geprüft, nicht vermutet: entfällt.** Dieselben sieben Saves wie bei der Gewichtheben-Prüfung, erneut gegen das aktuelle `live-save`-Abbild geprüft — `isBattleModeSave() === false` für alle sieben. |
| 6 — Drift-Wächter | **Bewusst nicht gebaut.** Für Gewichtheben existiert kein `tests/gewichtheben-pps-referenz-drift.test.ts` (nachgeprüft: PR #776 hat nur `tests/basketball-pps-referenz-drift.test.ts`, keinen zweiten). Kein Muster zum Nachziehen — s. Abschnitt „Was nicht getan wurde". |
| Regressionsnachweis | **`npm test` läuft vollständig grün** (s. Abschnitt unten), jeder bestehende Basketball- UND Gewichtheben-Test unverändert bestanden. |

---

## 1. Die Torwart-Frage — gemessen, nicht aus dem Bauch entschieden

Der Auftrag verlangte ausdrücklich, die Frage EMPIRISCH zu beantworten: braucht die individuelle
PPs-Kurve für Hockey getrennte Referenzen für Feldspieler und Torwart, oder reicht eine
gemeinsame, weil die Impact-Kurve ohnehin nur normiert?

### 1.1 Warum die Frage überhaupt entsteht

Anders als Basketball/Gewichtheben hat Hockey eine Torwart-Rolle mit einer **strukturell
anderen** Wertformel (`feldspielWert(u,"hockey")`, `battle-mode.engine.js`): ein Feldspieler wird
über Tore/Vorlagen/Checks/Pucks/Verluste bewertet, ein Torwart über GSAA (goals saved above
average) plus einen Basiswert (`HK_TW_BASIS`), der bewusst auf den **Feldspieler-Mittelwert**
kalibriert ist (s. `docs/design/hockey-torwart-konstanten-nachgezogen.md`) — aber nur auf EINEN
Mittelwert, nicht auf jede Feldgröße.

### 1.2 Wie gemessen wurde

`scripts/ziehe-hockey-pps-referenz.ts` baut für jedes Team eine **explizite** Aufstellung: der
Spieler mit der besten Näherung an das motor-interne PARADE-Rezept
(`health*0,45+awareness*0,30+dexterity*0,15+will*0,10`, `battle-mode.rezepte.js`, auf dem rohen
Attributbogen ohne Klassen-/Rassen-/Form-Bonus) wird explizit auf den Torwart-Slot (Slot-Index 2,
„goaltender" in `DISCIPLINE_ROLE_THEMES.hockey`) gesetzt; die übrigen Plätze bekommen die besten
Feldspieler nach Hockey-Eignung. Das erzwingt eine ECHTE, deterministische Torwart-Zuweisung im
Motor (`bestimmeTorwaerter()` trifft dann auf `u.slotGesetzt && TORWART_SLOTS.has(u.slotId)`),
statt auf den motor-internen PARADE-Fallback zu raten, der von außen nicht exakt vorhersagbar
wäre.

Damit die Rollen-Zuordnung danach nicht auf dieser selbst gebauten Aufstellung raten muss, trägt
`window.__arena.spieleFeldspiel()`s Boxscore seit dieser Änderung selbst ein `torwart`-Feld (s.
Abschnitt 3 unten) — das Skript nutzt beide Quellen und vergleicht sie (Konsistenzprüfung, kein
Abweichen gefunden).

Gezogen: 64 Fixtures je Feldgröße (2..6), gegen das echte `live-save`-Abbild (32 Teams,
`new-game-1787123325719-swnjlk`). Dieselbe reduzierte Stichprobengröße wie bei Gewichtheben (60
statt Basketballs 300+ je Feldgröße) — reines Zeitbudget, s. Abschnitt „Was nicht getan wurde".

### 1.3 Das Ergebnis — und warum es die Frage entscheidet

| Feldgröße n | Feldspieler-Median | Feldspieler p99,5 | Torwart-Median | Torwart p99,5 | Torwart-Stichprobe |
|---:|---:|---:|---:|---:|---:|
| 2 | 34,42 | 88,66 | — (kein Torwart) | — | 0 |
| 3 | 22,40 | 72,33 | 8,42 | 16,99 | 128 |
| 4 | 12,63 | 44,81 | 11,19 | 18,16 | 128 |
| 5 | 8,53 | 40,92 | 10,74 | 19,69 | 128 |
| 6 | 6,84 | 42,56 | 10,22 | 19,09 | 128 |

Zwei Befunde, beide gemessen:

1. **Der Feldspieler-Median schrumpft massiv mit wachsender Feldgröße** (34,4 → 22,4 → 12,6 →
   8,5 → 6,8), weil sich dieselbe „Kuchen"-Menge an Toren/Vorlagen/Checks auf mehr Köpfe verteilt.
   Der Torwart-Median bleibt dagegen über n=3..6 ungefähr gleich (8,4 → 11,2 → 10,7 → 10,2) — er
   hängt an der Fangquote/Schusszahl, nicht an der Feldspielerzahl.
2. **Die beiden Mediane WECHSELN DIE RICHTUNG.** Bei n=3 liegt der Feldspieler-Median (22,4) weit
   über dem Torwart-Median (8,4) — eine gemeinsame Referenz hätte den Torwart hier systematisch
   **unterbezahlt** (ein durchschnittlicher Torwart hätte gegen den viel höheren gemeinsamen
   Median normiert nur einen Bruchteil des Mitte-Ankers bekommen). Bei n=6 ist es GENAU
   UMGEKEHRT: der Feldspieler-Median (6,84) liegt UNTER dem Torwart-Median (10,22) — eine
   gemeinsame Referenz hätte hier JEDEN durchschnittlichen Torwart **überdurchschnittlich**
   aussehen lassen. Das ist exakt die Art systematischer Verzerrung („ein Spieler bekommt
   strukturell immer mehr, unabhängig von echter Leistung"), die die gesamte Impact-Kurve
   (Boxscore-an-PPS V2) eigentlich vermeiden soll (s. Kopfkommentar
   `battle-mode-arena-team-points.ts`, Chris' ursprüngliche Beschwerde über das alte
   Perzentilmodell).

**Keine der fünf Feldgrößen ist „die" Standardgröße.** Hockeys `Discipline.playerCount` im
Katalog (`lib/data/dataAdapter.ts`) ist zwar 5, aber nachgesehen (nicht angenommen): Hockey steht
in der Kategorie „power" mit genau vier weiteren Disziplinen (Mini DM, TDM, Gewichtheben,
Breaking) — und jede der vier Zwanzig-Disziplinen-Kategorien hat genau fünf Mitglieder.
`buildSeasonPlayerCountByDiscipline()` (`lib/season/season-discipline-schedule.ts`) verteilt für
genau diesen Fall eine Permutation von `[2,3,4,5,6]` 1:1 auf die fünf Mitglieder einer Kategorie
— die tatsächlich gewürfelte Feldgröße einer Saison liegt für Hockey (und für jede andere
Disziplin) gleichverteilt zwischen 2 und 6, `Discipline.playerCount` ist nur der seltene
Katalog-Fallback ohne Spielplan-Eintrag (`resolveArenaFieldSizeForMatchday()`).
`katalogStandardgroesse` in `ArenaImpactKonfig` trägt für Hockey deshalb `5` (Hockeys eigener
Katalogwert, NICHT Basketballs/Gewichthebens `6` blind übernommen).

**Entscheidung: zwei getrennte Referenzen.** Nicht aus dem Bauch, sondern weil die Alternative
(eine gemeinsame Referenz) für JEDE der fünf real vorkommenden Feldgrößen — nicht nur eine
angenommene „Standardgröße" — Torwärter systematisch über- oder unterbezahlt hätte.

## 2. Umsetzung

### 2a. Kein neues Chassis nötig

Anders als bei Gewichtheben (Buehnen-Duell-Chassis, `spieleBuehneHeben()` neu gebaut) brauchte
Hockey **keine** Änderung an `arena-headless-runner.ts`s Chassis-Dispatch. Geprüft am Code, nicht
vermutet: `FELDSPIEL_ART.hockey` existiert im Motor (`public/mockups/battle-mode.engine.js`) seit
der Hockey-Live-Motor-Migration, mit eigenem `live`-Block (3×80s Drittel), eigener `kurve` und
eigenem Torwart-Handling. `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS` (nur `{"gewichtheben"}`) bleibt
unverändert — Hockey fällt in `runArenaFixtures()`s Chassis-Weiche automatisch auf
`spieleFeldspiel()`, den Standardpfad, den auch Basketball nutzt.

### 2b. Motor-Änderung: `torwart`-Feld im Boxscore

`spieleFeldspiel()` (`battle-mode.engine.js`) reicht seinen Boxscore seit dieser Änderung mit
einem `torwart`-Feld durch — additiv, nur angehängt wenn `true`
(`...(torwartNamen.has(n)?{torwart:true}:{})`), exakt dasselbe Muster, das `feldspielProbe()`
(die bestehende Diagnose-Sonde) für dieselbe Kennzeichnung schon lange nutzt. Für jede
Feldspiel-Disziplin außer Hockey (`u.torwart` dort immer `false`, s. `bestimmeTorwaerter()`)
bleibt der Boxscore-Eintrag ohne dieses Feld — **byte-identisch** zum Verhalten vor dieser
Änderung.

`ArenaFixtureBoxscoreEintrag` (`arena-headless-runner.ts`) trägt das Feld jetzt als
`torwart?: boolean` (optional, damit bestehende Test-Fixtures ohne dieses Feld unverändert
kompilieren) weiter an den Node-seitigen Aufrufer.

### 2c. `battle-mode-arena-team-points.ts`: rollenbewusste Referenzauflösung

- `ArenaImpactKonfig` trägt jetzt ein optionales zweites Feld `referenzFeldgroessenTorwart` —
  `undefined` für Basketball/Gewichtheben (keine eigene Torwart-Rolle).
- `resolveArenaPpsReferenz(disciplineId, playerCount, rolle)` bekommt einen dritten Parameter
  `rolle: "feld" | "torwart" = "feld"`. Für `rolle:"torwart"` ohne konfigurierte
  Torwart-Referenz (Basketball, Gewichtheben) fällt die Funktion defensiv auf die normale
  Feldspieler-Referenz zurück, statt zu werfen — ein Fall, der für diese beiden Disziplinen nie
  eintritt (kein Boxscore-Eintrag trägt dort je `torwart:true`).
- `computeIndividualBoxscorePpsFromFixtureResults()` löst jetzt BEIDE Referenzen (feld immer,
  torwart nur bei Bedarf, memoisiert) auf und wählt pro Boxscore-Eintrag über `eintrag.torwart`
  zwischen ihnen.
- `HOCKEY_INDIVIDUAL_PPS_MAX`/`HOCKEY_PPS_ANTEIL_MITTE`: unverändert von Basketballs Entscheidung
  übernommen (5,5 / 0,25), aus demselben Grund wie bei Gewichtheben — Chris' Rahmen und die
  Kurvenform-Messung sind disziplinübergreifende Aussagen, keine basketballspezifischen Zahlen.
  Eigene Konstanten statt Alias, damit eine spätere hockey-spezifische Kalibrierung Basketball/
  Gewichtheben nicht berührt.
- `ppsAusHockeyImpact()` — dünner Wrapper, exakt wie `ppsAusGewichthebenImpact()`.
- `resolveHockeyPpsReferenz(playerCount, rolle)` — dünner Wrapper.

### 2d. `ARENA_RESOLVED_DISCIPLINE_IDS`

`"hockey"` ergänzt — als letzter Schritt, nachdem 2a–2c standen und getestet waren (dieselbe
Reihenfolge-Regel wie bei Gewichtheben: kein halbfertiger Pfad geht live). Die Querprüfung gegen
`ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS` (Fail-Fast beim Modul-Laden, Review-Fund PR #776) bleibt
unberührt bestehen und grün, weil Hockey NICHT in `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS` steht (es
nutzt ja das Feldspiel-Chassis).

### 2e. Stage-Ansicht (`rink.tsx`)

Geprüft, wie der Auftrag verlangte: `app/foundation/discipline-stage/arena/disciplines/rink.tsx`
existierte bereits (die generische Wochenspieltags-Reveal-Animation für Hockey, unabhängig davon,
ob der zugrundeliegende Spieltag über den alten PPS-Pfad oder Battle-Mode-Arena aufgelöst wurde).
Anders als `barbell.tsx` (das an einer visualisierungs-eigenen, „schönen Zahlen"-150–400-kg-Remap
hängt, s. `docs/design/gewichtheben-produktivierung.md` Abschnitt 5.1) liest `rink.tsx` **nur**
den generischen `score`/`animScore`-Pfad (`RT`-Typ, `sorted`, `finalMax`), den JEDE der zwanzig
Disziplinen-Stage-Komponenten teilt — kein hockey-spezifischer Sonderfall, keine eigene Ableitung.
Ein Grep über `app/foundation/discipline-stage/` nach `"hockey"`/`FELDSPIEL_ART`/`feldspielDisc`
findet **keinen einzigen Treffer** außerhalb der generischen Disziplin-Ketten
(`registry.ts`/`types.ts`). `rink.tsx` braucht deshalb **keine Änderung** — es zeigt schon heute
exakt denselben team-`score`, den auch Basketballs `court.tsx` zeigt, egal ob dieser Score aus dem
alten `rank-to-points`-Pfad oder aus Battle-Mode-Arena-Overrides (2/1/0-Punkte) stammt.

## 3. Mid-Season-Risiko: geprüft, nicht vermutet

CLAUDE.md verlangt ausdrücklich, keine Vermutungen über bestehende Spielstände anzustellen.
`git fetch origin live-save` + Entpacken (der übliche Weg), dann alle sieben Saves im aktuellen
Abbild geprüft — `isBattleModeSave(gameState)` für jeden einzelnen:

| Save | Battle Mode | aktueller Spieltag |
|---|---|---|
| new-game-1787123325719-swnjlk | **false** | season-2-matchday-10 |
| new-game-1786626914058-hwz8fk | **false** | season-2-matchday-10 |
| save-1786699040510-89rv3s | **false** | season-2-matchday-1 |
| new-game-1786465783606-0kalpx | **false** | matchday-6 |
| new-game-1785823388048-1hf25q | **false** | season-2-matchday-10 |
| new-game-1785412846578-h0z7cl | **false** | matchday-4 |
| new-game-1784747079649-n90y4m | **false** | matchday-1 |

**Kein einziger der sieben Saves hat Battle Mode aktiviert** — dieselben sieben Saves, dasselbe
Ergebnis wie bei der Gewichtheben-Prüfung (der `live-save`-Spiegel ist zwischen den beiden Runden
frisch gezogen, aber unverändert dieselben sieben Köpfe). `kickoffArenaMatchdayApply()` prüft
`isBattleModeSave()` als allererste Bedingung; für jeden dieser sieben Saves liefert das
unverändert `{ applicable: false }`, der bestehende PPS-Pfad läuft exakt wie vor dieser Änderung.

## 4. Was NICHT getan wurde — mit Begründung

### 4.1 Kein Drift-Wächter-Test

Der Auftrag verlangte, einen Hockey-Drift-Wächter zu bauen, **falls** ein
`tests/*-pps-referenz-drift.test.ts`-Muster für Gewichtheben existiert. Nachgeprüft: es existiert
nicht. `tests/` enthält `basketball-pps-referenz-drift.test.ts` (Basketball, aus der
PPS-Skalierungs-Runde vor Gewichtheben/Hockey), aber **kein** `gewichtheben-pps-referenz-drift.
test.ts` — PR #776 hat für Gewichtheben keinen solchen Wächter gebaut. Damit gibt es kein Muster
zum Nachziehen, und diese Änderung baut keinen Hockey-Drift-Wächter, aus Konsistenz mit dem
unmittelbaren Vorgänger, nicht aus Nachlässigkeit. Ein Basketball-Drift-Wächter UND das Fehlen
eines Gewichtheben-Äquivalents ist der bestehende, unveränderte Zustand — diese Änderung
verschiebt ihn nicht.

### 4.2 Kleinere PPS-Referenz-Stichprobe als Basketball

`scripts/ziehe-hockey-pps-referenz.ts` zog **60 Fixtures je Feldgröße** (2..6, gesamt ~300) statt
Basketballs 300+ je Feldgröße (gesamt 1500+) — dieselbe Zeitbudget-Entscheidung wie bei
Gewichtheben, keine methodische. Jede Fixture braucht einen Browser-Neustart/-Neueinhängung
(gemessen: ~5,0–5,3 s/Fixture). Zusätzlich zur bereits bei Gewichtheben dokumentierten
Einschränkung ist die **Torwart-Seite dünner als die Feldspieler-Seite derselben Ziehung**: bei
n=6 stehen 128 Torwart-Werten 640 Feldspieler-Werte gegenüber (nur 1 Torwart je Team und
Fixture gegen 5 Feldspieler) — `iKrass` (p99,5) ist für den Torwart entsprechend weniger stabil
geschätzt. Eine spätere, größere Nachziehung (`--feldgroesse=<n>` + `--merge`, identisches Muster
wie bei Basketball/Gewichtheben) ist ohne Code-Änderung möglich, sobald mehr Rechenzeit zur
Verfügung steht.

### 4.3 Kein Live-Deploy/Merge

Wie bei Gewichtheben: diese PR wartet auf Chris' Review, kein automatischer Merge.

### 4.4 Keine weitere Rangtreue-Runde

Chris hat die aktuelle Rangtreue (0,669 alle 12 / 0,719 nur Feldspieler) für den Live-Betrieb
ausdrücklich abgenommen — explizit im Auftrag bestätigt, keine Rückfrage nötig, keine weitere
Messrunde in dieser Änderung.

## 5. Regressionsnachweis

`npm test` (vollständige Suite, nicht nur battle-mode/arena-Testdateien): **1024/1024
Testdateien, 8101/8101 Einzeltests grün** (23 übersprungen, umgebungsbedingt — Chromium-
Verfügbarkeit u. Ä., unverändert zu vorher). Der Lauf brauchte in dieser Session rund 21 Minuten
statt der üblichen wenigen Minuten — reines Umgebungsrauschen: sehr hohe gemeinsame Rechenlast
im geteilten Container (viele parallele Agenten-Sessions, Load Average zeitweise >12 auf 4
Kernen), nachgemessen an `/proc/loadavg` und an neu erscheinenden Worker-Prozess-IDs während des
Laufs — keine einzige Regression. Kein bestehender Test (Basketball, Gewichtheben oder jede
andere Disziplin) verändert oder rot geworden.

Gezielt vorher (schneller, isoliert) geprüft:

- `tests/battle-mode-arena-team-points.test.ts`: **64/64 Tests grün** (56 vor dieser Änderung,
  `ARENA_RESOLVED_DISCIPLINE_IDS.has("hockey")` noch `false`, unverändert bestanden), plus 8 neue
  Tests: `ppsAusHockeyImpact`, `resolveHockeyPpsReferenz` (Default-Rolle „feld"),
  `resolveArenaPpsReferenz` mit `rolle`-Parameter (Hockeys Feld-/Torwart-Referenz unterscheiden
  sich; Basketball/Gewichtheben fallen für `rolle:"torwart"` defensiv auf die Feldspieler-
  Referenz zurück, statt zu werfen), `computeIndividualBoxscorePpsFromFixtureResults` mit
  `eintrag.torwart` (Hockey normiert je nach Flag gegen die richtige Referenz; Basketball/
  Gewichtheben ignorieren das Feld vollständig — unverändertes Verhalten), Hockeys eigener
  Katalog-Standardwert 5 (nicht Basketballs/Gewichthebens 6, s. Abschnitt 1.3/Fund).
- `tests/battle-mode-arena-resolve-engine.test.ts`, `tests/arena-headless-runner.test.ts`
  (echter Chromium-Lauf): alle 15 Tests unverändert bestanden.
- `tests/gewichtheben-kg-folgt-dem-score.test.ts`: unverändert bestanden (Isolationsnachweis für
  Gewichtheben, nicht nur Basketball).

## 6. Geänderte/neue Dateien

- `public/mockups/battle-mode.engine.js` — `spieleFeldspiel()` reicht jetzt ein `torwart`-Feld
  im Boxscore durch (additiv, nur wenn `true`; für jede Nicht-Hockey-Feldspiel-Disziplin
  unverändert `false`/abwesend).
- `lib/battle/arena-headless-runner.ts` — `ArenaFixtureBoxscoreEintrag.torwart` (optional,
  Passthrough vom Motor).
- `lib/resolve/battle-mode-arena-team-points.ts` — `ARENA_RESOLVED_DISCIPLINE_IDS` erweitert;
  `HOCKEY_INDIVIDUAL_PPS_MAX`/`HOCKEY_PPS_ANTEIL_MITTE`, `ppsAusHockeyImpact()`,
  `resolveHockeyPpsReferenz()` (kein eigener `resolveHockeyFieldSizeForMatchday()`-Wrapper —
  dieselbe Zurückhaltung wie bei Gewichtheben, das ebenfalls keinen bekam, nur Basketballs
  Wrapper blieb aus Testkompatibilität stehen); `ArenaImpactKonfig.referenzFeldgroessenTorwart`
  (optional, neu); `resolveArenaPpsReferenz()` mit neuem `rolle`-Parameter;
  `computeIndividualBoxscorePpsFromFixtureResults()` rollenbewusst.
- `lib/season/arena-matchday-resolve-service.ts` — nur ein Kommentar korrigiert (Code war bereits
  disziplinübergreifend über `ARENA_RESOLVED_DISCIPLINE_IDS`).
- `app/api/resolve/legacy-matchday-apply/route.ts` — nur ein Kommentar korrigiert.
- `data/generated/hockey-pps-referenz.json` — neu, gezogen von
  `scripts/ziehe-hockey-pps-referenz.ts` gegen das echte `live-save`-Abbild, mit getrennten
  `feldgroessen`/`feldgroessenTorwart`-Blöcken.
- `scripts/ziehe-hockey-pps-referenz.ts` — neu, Analogon zu
  `scripts/ziehe-gewichtheben-pps-referenz.ts`, mit expliziter Torwart-Slot-Zuweisung und
  getrennter Feld-/Torwart-Auswertung.
- `tests/battle-mode-arena-team-points.test.ts` — neue Tests, s. Abschnitt 5. Kein bestehender
  Test verändert außer der `ARENA_RESOLVED_DISCIPLINE_IDS`-Mengen-Prüfung selbst (dieselbe
  Erweiterung, die schon bei Gewichtheben die Basketball-Assertion um eine Zeile ergänzt hat).
- `docs/design/stand-aller-disziplinen.md`, `docs/design/hockey-produktivierung.md` (dieser
  Bericht) — Dokumentation.

## 7. Offene Architekturfragen für Chris

Keine neuen — dieselbe offene Frage wie bei Gewichtheben (Abschnitt 5.1 dort): ob
`buildBarbellInfo()`/entsprechende Hockey-Visualisierungen später auf literale, echte Werte
umgestellt werden sollen, bleibt unbeantwortet, betrifft Hockey aber nicht direkt (`rink.tsx`
zeigt bereits den generischen Score, keine kg-artige Remap-Formel).
