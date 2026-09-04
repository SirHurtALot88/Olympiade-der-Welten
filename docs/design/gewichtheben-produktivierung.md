# Gewichtheben: Produktivierung (S6) — ins echte Spiel

Stand 04.09.2026, Branch `claude/gewichtheben-produktivierung` (abgezweigt von `origin/main`
`2fbc364c`). Chris, nachdem Gewichtheben heute die 0,80-Rangtreue-Schranke im Mockup erstmals
überschritten hat (`docs/design/gewichtheben-zufriedenstellend.md`, rho 0,887 bei jeSeite 6):
„und bitte vor allem die anderen diszis die du modelliert hast auch ingame fertig machen".
Dieser Bericht deckt die vier von fünf Schritten, die dafür nötig waren, plus eine ausdrückliche
Liste dessen, was **nicht** angefasst wurde und warum.

**Das ist Produktionscode** (`lib/`, `app/`, `public/mockups/battle-mode.engine.js`) — derselbe
Motor, dieselbe Resolve-Pipeline, die echte Spielstände bewegen. Jede Änderung ist so gebaut,
dass sie für Basketball (die einzige bereits produktive Disziplin) **bit-identisches Verhalten**
behält, nachgewiesen über die vollständige, unveränderte Basketball-Testsuite (s. Abschnitt
„Regressionsnachweis").

## Kurzfassung

| Schritt | Ergebnis |
|---|---|
| 1 — `ARENA_RESOLVED_DISCIPLINE_IDS` | **Erledigt, als letzter Schritt.** `"gewichtheben"` ergänzt, nachdem 2–5 standen und getestet waren. |
| 2 — Orchestrator-Pfad | **Erledigt, generalisiert statt verdoppelt.** Auf Fables Präzisierung hin (s. u.) die drei hartkodierten `"basketball"`-Literale in `runBattleModeArenaMatchday()` durch einen von `ARENA_RESOLVED_DISCIPLINE_IDS`-Mengen-Zugehörigkeit abgeleiteten `disciplineId`-Parameter ersetzt — eine dritte Arena-Disziplin (Hockey ist als Nächstes geplant) braucht dafür **keine** weitere Code-Änderung in diesem Pfad. |
| Chassis-Frage | **Genau die Stelle, die Fable als "teurer als geschätzt" markiert hatte — bestätigt.** `runArenaFixtures()` rief `window.__arena.spieleFeldspiel()` fest auf, das nur `FELDSPIEL_ART` kennt. Gewichtheben braucht ein eigenes Buehnen-Duell-Chassis (`spieleBuehneHeben()`, neu, additiv, `spieleFeldspiel()` unangetastet). |
| 3 — `barbell.tsx`/`buildBarbellInfo` | **Nicht umgesetzt — konservative Entscheidung, s. Abschnitt "Was nicht getan wurde".** |
| 4 — Gesamt-kg-Tiebreak | **Erledigt.** `arenaTeamPointsForFixtureMitTiebreak()`, generisch über `ArenaFixtureResult.gesamtKg`. |
| 5 — Individuelle PPs | **Erledigt, generalisiert.** `ppsAusArenaImpact()` (umbenannt/parametrisiert aus `ppsAusBasketballImpact()`), eigene Referenz `data/generated/gewichtheben-pps-referenz.json`, gezogen von `scripts/ziehe-gewichtheben-pps-referenz.ts` gegen den echten `live-save`-Kader. |
| Mid-Season-Risiko | **Geprüft, nicht vermutet: entfällt.** Keiner der sieben Saves im aktuellen `live-save`-Abbild hat Battle Mode aktiviert (`isBattleModeSave() === false` für alle sieben) — die Arena-Auflösung greift für KEINEN existierenden Spielstand, unabhängig von dieser Änderung. |
| Regressionsnachweis | **`npm test` vollständig grün** (s. Abschnitt unten), jeder bestehende Basketball-Test unverändert bestanden. |

---

## 1. Der Auftrag, wörtlich, und die Präzisierung währenddessen

Der ursprüngliche Auftrag benannte drei/vier Schritte (Set-Eintrag, Orchestrator-Pfad,
`barbell.tsx` auf echte kg, Gesamt-kg-Tiebreak) plus Schritt 5 (individuelle PPs) aus
`docs/design/gewichtheben-gameplay-fertig.md` Abschnitt 4. Mitten in der Umsetzung kam eine
Präzisierung vom Koordinator (mit Kontext aus einer parallelen Modellierungsrunde von „Fable",
Dokument `naechste-schritte-fable-04-09.md` auf Branch `claude/naechste-schritte-fable`, nicht
gemergt):

> „`runBattleModeArenaMatchday` ... hat DREI hartkodierte `"basketball"`-Literale. Ersetze sie
> durch eine Prüfung gegen `ARENA_RESOLVED_DISCIPLINE_IDS` (Mengen-Zugehörigkeit), nicht durch
> ein zusätzliches `"gewichtheben"`-Literal daneben ... Der Headless-Runner ruft aktuell
> `window.__arena.spieleFeldspiel(fd, saat)` fest auf — das ist Feldspiel-spezifisch ... Für
> Gewichtheben (Bühnen-Chassis) brauchst du wahrscheinlich eine chassis-generische Variante ...
> Das ist der Teil, der laut Fables eigener Einschätzung 'teurer werden kann als geschätzt'."

Beide Punkte bestätigten sich genau so beim Nachlesen des Codes (s. Abschnitt 3) — die
Umsetzung unten folgt der Präzisierung, nicht dem ursprünglichen Wortlaut „Basketballs
Resolve-Pfad ... denselben Pfad für Gewichtheben einziehen" (der nahegelegt hätte, einfach einen
zweiten Literal-Vergleich danebenzustellen).

## 2. Das Vorbild: was Basketball schon konnte, was nicht

`lib/resolve/battle-mode-arena-team-points.ts` (475 Zeilen, vollständig gelesen) ist der
Bauplan: Team-Punkte-Skala Sieg=2/Unentschieden=1/Niederlage=0 („das ist gesetzt", Chris
30.08.), die Boxscore-an-PPS-Umstellung (individuelle Spieler-PPs aus einer Impact-Kurve gegen
eine fest gezogene Referenzverteilung, nicht mehr aus einem Perzentil-Pool). `lib/battle/
arena-headless-runner.ts` ruft dafür `window.__arena.spieleFeldspiel(fd, saat)` im Mockup-Motor
per Playwright headless auf.

**Was NICHT vorbereitet war**, weil es nie gebraucht wurde: `spieleFeldspiel()` prüft
`FELDSPIEL_ART[fd]` (Ballbesitz-Feldspiel — Basketball, TDM, Mini-DM, Football, Hockey) und
liest den Punktestand aus `fsPunkte[0]/fsPunkte[1]`, einem Feldspiel-internen Zustand. Für
`fd="gewichtheben"` lieferte es schon vor dieser Änderung `null` (nicht falsch, aber auch nicht
lauffähig) — Gewichtheben ist keine `FELDSPIEL_ART`-Disziplin, sondern eine `BUEHNE_ART`-Disziplin
mit einer eigenen Duell-Struktur (`baueHebenDuelle()`, sechs Zweikämpfe je Slot statt eines
kontinuierlichen 6v6-Spiels). `runArenaFixtures()` hätte für Gewichtheben also bei jedem echten
Aufruf mit „unbekannte Disziplin?" abgebrochen — genau der Punkt, den der Auftrag selbst schon
vermutete („prüfe, ob `runArenaFixtures()` das schon unterstützt") und den Fables Präzisierung
bestätigte.

## 3. Umsetzung Schritt für Schritt

### 3a. Neuer Motor-Einstiegspunkt: `spieleBuehneHeben()`

`public/mockups/battle-mode.engine.js`, direkt neben `spieleFeldspiel()` in `window.__arena`,
**additiv, `spieleFeldspiel()` keine einzige Zeile berührt**:

```js
spieleBuehneHeben:(bd,saat)=>{
  if(typeof BUEHNE_ART==="undefined"||!BUEHNE_ART[bd]||!BUEHNE_ART[bd].heben)return null;
  const M=MOTOREN[bd]; if(!M)return null;
  const g=M.sichern(); if(M.vorher)M.vorher();
  M.bau(saat); M.lauf();
  const wert=M.wert(); const namen=M.namen();
  const boxscore=namen.map(n=>({name:n,wert:wert[n]??0}));
  const duelle=(s)=>TEILNEHMER.filter(u=>u.side===s&&u.duellGewonnen).length;
  const seiten=[duelle(0),duelle(1)];
  const gesamtKg=[0,1].map(s=>TEILNEHMER.filter(u=>u.side===s).reduce((a,u)=>a+(u.summe||0),0));
  M.zurueck(g);
  return {disziplin:bd, seiten, boxscore, gesamtKg};
},
```

Drei Entscheidungen darin:

1. **Punktestand = gewonnene Zweikämpfe** (0..jeSeite, also 0..6), exakt dieselbe Zählung wie
   `updateHudBuehne()`s bestehender `BB().heben`-Zweig in der interaktiven UI — NICHT die
   Kilogrammsumme. Ein 3:3 ist damit real möglich (gemessen im letzten Mockup-Bericht: 2,1–3,1 %
   der Duelle) und braucht den Tiebreak aus Schritt 4.
2. **`boxscore[].wert` ist bereits die echte Kilogrammzahl** — `MOTOREN.gewichtheben.wert()`
   liefert `u.summe`, und `u.summe` ist in `baueHebenDuelle()` exakt der Zweikampf
   (bestes Reißen + bestes Stoßen), s. dortiger Kommentar „ein Heber, der an einem starken Slot
   380 kg hebt, hat 380 kg gehoben, auch wenn er verliert". Das ist der Rohwert, den Schritt 5
   unten kurvt.
3. **`gesamtKg` wird HIER im Motor gebildet**, nicht in Node aus dem Boxscore nachgerechnet:
   `TEILNEHMER` trägt `u.side`/`u.summe` bereits aus derselben Simulation. Ein zweiter,
   möglicherweise abweichender Rechenweg über Node-seitigen Namensabgleich (der für `playerId`
   gebraucht wird, aber einen anderen Zweck hat) wäre unnötiges Risiko gewesen.

### 3b. Chassis-Dispatch im Headless-Runner

`lib/battle/arena-headless-runner.ts`: eine neue, disziplinunabhängige Menge

```ts
export const ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS: ReadonlySet<string> = new Set(["gewichtheben"]);
```

entscheidet, welche Browser-Funktion `runArenaFixtures()` aufruft (`spieleFeldspiel` vs.
`spieleBuehneHeben`) — bewusst eine EIGENE Menge, getrennt von `ARENA_RESOLVED_DISCIPLINE_IDS`
(battle-mode-arena-team-points.ts): die eine sagt „wird überhaupt arena-aufgelöst", die andere
„mit welchem Chassis". `ArenaFixtureResult` bekommt ein neues optionales Feld `gesamtKg?:
[number, number]` — `undefined` für jedes Feldspiel-Chassis (Basketball unverändert).

### 3c. Der Orchestrator: drei Literale weg, ein Parameter dafür

`runBattleModeArenaMatchday()` (battle-mode-arena-team-points.ts) hatte die Literale bei (a) dem
`runImpl(...)`-Aufruf, (b) der Feldgrößen-Auflösung, (c) der individuellen-PPs-Berechnung. Alle
drei sind jetzt `disciplineId` — ein neuer, **optionaler** Parameter (Default `"basketball"`,
NUR Rückwärtskompatibilität mit Aufrufern/Tests von vor dieser Änderung, kein Sonderfall für
Gewichtheben).

Der produktive Aufrufer (`lib/season/arena-matchday-resolve-service.ts`) ermittelt diesen Wert
jetzt selbst: `determineBasketballContexts()` (nur Basketball, boolesch) wurde zu
`determineArenaDisciplineContexts()` — liest `d1DisciplineId`/`d2DisciplineId` aus den geladenen
Lineup-Contexts und prüft **Mengen-Zugehörigkeit** zu `ARENA_RESOLVED_DISCIPLINE_IDS`, liefert die
konkrete `arenaDisciplineId` statt nur eines Booleans. `kickoffArenaMatchdayApply()` reicht sie
explizit an `fuehreArenaMatchdayApplyAus()` → `runBattleModeArenaMatchday()` durch.

**Eine Frage, die dabei entstand und die ich konservativ beantwortet habe (Chris' Entscheidung,
falls es je relevant wird):** was, wenn ein Spieltag ZWEI arena-aufgelöste Disziplinen als D1
UND D2 trägt (z. B. Basketball und Gewichtheben am selben Tag)? `overridesByTeamId`/
`individualBoxscorePpsByPlayerId` sind je EIN teamId-/playerId-keyed Ergebnis — sie ließen sich
nicht disziplinübergreifend zusammenführen, ohne `buildLegacyMatchdayResolvePreview()` selbst
disziplin-bewusst zu machen (eine größere, hier nicht angefasste Änderung). Statt zu raten,
welche der beiden Vorrang hätte, oder Ergebnisse zu vermengen: **dieser Fall gilt als NICHT
anwendbar** (`{ applicable: false }`, mit `console.error`), der GANZE Spieltag fällt auf den
bestehenden, gut getesteten PPS-Pfad zurück. Solange nur eine Disziplin arena-aufgelöst ist
(heute: Basketball ODER Gewichtheben, nie beide gleichzeitig, da `ARENA_RESOLVED_DISCIPLINE_IDS`
erst zwei Einträge hat und ein Spieltag zwei VERSCHIEDENE Disziplinen für D1/D2 auslost), tritt
das nie ein — aber sobald eine dritte Arena-Disziplin (Hockey) dazukommt, kann es real vorkommen,
und dann ist der sichere Rückfall bereits da.

`lib/resolve/legacy-matchday-resolve-engine.ts` brauchte für die eigentliche Punktevergabe
**keine** Code-Änderung: die Stelle, die dort ein Arena-Ergebnis statt der PPS-Rang-Formel
einsetzt, prüfte schon vor dieser Änderung `ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId)` —
Mengen-Zugehörigkeit, kein `=== "basketball"`. Nur die Kommentare dort sprachen noch von „NUR
Basketball" und sind jetzt korrigiert.

### 3d. Der Gesamt-kg-Tiebreak (Schritt 4, Fable-Empfehlung 9.1)

```ts
export function arenaTeamPointsForFixtureMitTiebreak(
  result: Pick<ArenaFixtureResult, "seiten" | "gesamtKg">,
): [number, number] {
  const [heim, gast] = result.seiten;
  if (heim !== gast || !result.gesamtKg) return arenaTeamPointsForFixture(result.seiten);
  const [heimKg, gastKg] = result.gesamtKg;
  if (heimKg === gastKg) return [ARENA_TEAM_POINTS.draw, ARENA_TEAM_POINTS.draw];
  return heimKg > gastKg ? [ARENA_TEAM_POINTS.win, ARENA_TEAM_POINTS.loss]
                         : [ARENA_TEAM_POINTS.loss, ARENA_TEAM_POINTS.win];
}
```

`computeArenaTeamPointsFromFixtureResults()` nutzt diese Funktion jetzt statt
`arenaTeamPointsForFixture()` direkt. Für Basketball (kein `gesamtKg`) delegiert sie unverändert
weiter — bit-identisches Verhalten, mit Tests belegt. Die **angezeigte** `seiten`-Zahl (z. B.
3:3) bleibt unverändert die echte Duell-Zählung; nur `teamPoints`/`outcome` spiegeln den
Tiebreak. Das ist bewusst so (wie ein Auswärtstore-/Sudden-Death-Tiebreak im echten Sport: der
Spielstand bleibt, was er war, die Tabelle zeigt den entschiedenen Ausgang).

### 3e. Individuelle PPs (Schritt 5): generischer Kern statt zweitem Kopiat

`ppsAusBasketballImpact()` wurde zu `ppsAusArenaImpact(impact, referenz, max, anteilMitte)` —
**identische Formel**, `max`/`anteilMitte` jetzt Parameter statt Basketball-Konstanten fest
verdrahtet. `ppsAusBasketballImpact()` bleibt als dünner Wrapper exportiert (Basketballs
Konstanten, unveränderter Rückgabewert, Testkompatibilität). `ppsAusGewichthebenImpact()` ist das
Gewichtheben-Analogon mit eigenen Konstanten `GEWICHTHEBEN_INDIVIDUAL_PPS_MAX = 5.5` /
`GEWICHTHEBEN_PPS_ANTEIL_MITTE = 0.25` — **bewusst identisch zu Basketballs aktuellen Werten**
(Chris' Rahmen „max 5-6" gilt disziplinübergreifend, die 04.09.-Messung von `ANTEIL_MITTE` an 352
Basketball-Duellen ist eine Aussage über die Kurvenform, nicht über Basketball-spezifische
Zahlen) — aber als **eigene** Konstanten, nicht als Alias, damit eine spätere
Gewichtheben-spezifische Kalibrierung Basketball nicht berührt.

`resolveBasketballPpsReferenz()`/`resolveBasketballFieldSizeForMatchday()` sind jetzt dünne
Wrapper um generalisierte `resolveArenaPpsReferenz(disciplineId, playerCount)` /
`resolveArenaFieldSizeForMatchday(gameState, matchdayId, disciplineId)`. Ein
`ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Registry (`Map<disciplineId, {referenzFeldgroessen, max,
anteilMitte, katalogStandardgroesse}>`) hält die Konfiguration je Disziplin — eine dritte
Arena-Disziplin braucht hier NUR einen weiteren Eintrag, keine neue Verzweigung in der
Kurvenfunktion selbst.

**Gewichthebens Referenz ist NEU gezogen, nicht geraten**: `scripts/ziehe-gewichtheben-pps-
referenz.ts` (Analogon zu `scripts/ziehe-basketball-pps-referenz.ts`, dieselbe Mechanik —
`buildArenaTeam()` gegen echte Liga-Kader, `runArenaFixtures()`/`spieleBuehneHeben()` simuliert
echte Zweikämpfe) lief gegen das aktuelle `live-save`-Abbild
(`new-game-1787123325719-swnjlk`, geprüft frisch über `scripts/pruefe-spiegel-frische.ts`-
Äquivalent — s. u.). Ergebnis: `data/generated/gewichtheben-pps-referenz.json`.

**Bewusst KLEINERE Stichprobe als Basketball** (60 statt 300+ Fixtures je Feldgröße) — eine
Zeitbudget-Entscheidung dieser Runde, s. Abschnitt „Was nicht getan wurde". Tatsächlich gezogen
(gegen `new-game-1787123325719-swnjlk`, `motorSha1 0947e030...`, `repoCommit 2fbc364c`):

| Feldgröße | Fixtures | Spielerwerte | iMittel (Median) | iKrass (p99,5) |
|---:|---:|---:|---:|---:|
| 2 | 64 | 512 | **0** (entartet, s. u.) | 535,89 |
| 3 | 64 | 576 | 313 | 553,5 |
| 4 | 64 | 640 | 319 | 556,22 |
| 5 | 64 | 704 | 307 | 553 |
| 6 | 64 | 768 | 301,5 | 544,17 |

Werte für n=3..6 liegen alle in derselben plausiblen Größenordnung (≈300–320 kg Median-
Zweikampf, ≈545–556 kg p99,5) — konsistent mit dem Motor-Kommentar zu `HEBEN_KG_BASIS`/
`HEBEN_KG_PRO_LAST` (Referenzpunkte 138–480 kg je nach LAST).

**Ein echter Befund, kein Rauschen: `n=2` lieferte einen Median von 0 kg.** Bei nur 64 Fixtures
× 2 Zweikämpfen ist die Nullwertungsquote (beide Übungen komplett verpatzt) in dieser Stichprobe
zufällig über 50 % gelandet — plausibel für den extremen Unterzahl-Fall (jeSeite=2 statt der
katalogüblichen 6), aber ein degenerierter Wert. **Das hätte einen echten Fehler ausgelöst**:
`ppsAusArenaImpact()` hat eine eigene Degenerationsbremse (`iMittel > 0`), und ein exakter
Treffer auf `n=2` hätte JEDEM Heber dieser seltenen Feldgröße pauschal 0 PPs gegeben, unabhängig
von seiner echten Leistung. **Behoben**: `resolveArenaPpsReferenz()` prüft jetzt dieselbe
Gültigkeitsbedingung (`iMittel > 0 && iKrass > iMittel`) VOR der Verwendung eines Eintrags und
überspringt einen entarteten Treffer zugunsten der nächstgelegenen GÜLTIGEN Feldgröße — eine
generische Robustheitsverbesserung (gilt auch für Basketball, dort aber wirkungslos, da alle
fünf Basketball-Feldgrößen gültig sind, s. Testabdeckung). Zwei neue Tests belegen das Verhalten
explizit (`tests/battle-mode-arena-team-points.test.ts`, „resolveArenaPpsReferenz überspringt
entartete Einträge").

## 4. Mid-Season-Risiko: geprüft, nicht vermutet

CLAUDE.md verlangt ausdrücklich, keine Vermutungen über bestehende Spielstände anzustellen.
Deshalb: `git fetch origin live-save` + Entpacken (der übliche Weg, CLAUDE.md „An die
Spielstände kommen"), dann alle sieben Saves im Abbild geprüft — `isBattleModeSave(gameState)`
für jeden einzelnen:

| Save | Battle Mode | Gewichtheben-Spieltag(e) diese Saison | aktueller Spieltag |
|---|---|---|---|
| new-game-1787123325719-swnjlk | **false** | season-2-matchday-7 | season-2-matchday-10 |
| new-game-1786626914058-hwz8fk | **false** | season-2-matchday-6 | season-2-matchday-10 |
| save-1786699040510-89rv3s | **false** | season-2-matchday-6 | season-2-matchday-1 |
| new-game-1786465783606-0kalpx | **false** | matchday-6 | matchday-6 |
| new-game-1785823388048-1hf25q | **false** | season-2-matchday-7 | season-2-matchday-10 |
| new-game-1785412846578-h0z7cl | **false** | matchday-5 | matchday-4 |
| new-game-1784747079649-n90y4m | **false** | matchday-4 | matchday-1 |

**Kein einziger der sieben Saves hat Battle Mode aktiviert.** `kickoffArenaMatchdayApply()`
prüft `isBattleModeSave(current.gameState)` als ALLERERSTE Bedingung, bevor irgendetwas
Arena-Spezifisches passiert — für jeden dieser sieben Saves liefert das unverändert `{
applicable: false }`, der bestehende PPS-Pfad läuft exakt wie vor dieser Änderung, unabhängig
davon, ob Gewichtheben in `ARENA_RESOLVED_DISCIPLINE_IDS` steht. Die befürchtete Situation
(„ein laufender Spielstand hat bereits Gewichtheben-Spieltage, die mitten in der Umstellung
inkonsistent werden") **tritt für keinen existierenden Spielstand ein** — Battle Mode selbst ist
opt-in und wird von keinem Save genutzt. Sollte Chris später einen Save auf Battle Mode
umstellen, gilt ab dann für Gewichtheben dieselbe Vorsicht wie damals für Basketballs eigenen
Umstieg (Boxscore-an-PPS-Historie), aber das ist eine zukünftige, nicht diese Änderung.

## 5. Was NICHT getan wurde — mit Begründung

### 5.1 `barbell.tsx`/`buildBarbellInfo` NICHT auf literale echte kg umgestellt

Der Auftrag verlangte, die Team-kg-Anzeige „aus den tatsächlich simulierten Hebe-Ergebnissen"
zu rechnen statt aus dem PPS-Score. Das ist **teilweise, indirekt bereits erreicht**: seit
Schritt 5 ist der individuelle PPS-Wert jedes Hebers (`pointsAwarded`, der in `NativeStagePlayer.
val` einfließt) nicht mehr aus der alten, vom echten Boxscore entkoppelten Rang-Formel abgeleitet,
sondern aus der Impact-Kurve gegen die ECHTEN Zweikampf-Kilogramm — dieselbe Art Verbesserung,
die Basketballs eigene Boxscore-an-PPS-Umstellung brachte. Die relative Reihenfolge/Proportion
der Bar-Höhen in `buildBarbellInfo` ist dadurch bereits ehrlicher.

**Was NICHT geändert ist**: `buildBarbellInfo()` selbst bleibt bei seiner bestehenden Formel —
`totalByCode` (Summe der `NativeStagePlayer`-Scores je Team) wird weiter linear auf eine
„schöne" 150…400-kg-Anzeigeskala gemappt (`Math.round(150 + ((total - minTot) / span) * 250)`),
statt die literale, echte Zweikampf-Kilogrammsumme (die bei sechs Hebern durchaus 1500–2700 kg
betragen kann) direkt anzuzeigen. Gründe, das in DIESER Runde nicht anzufassen:

1. **Es ist eine reine Visualisierung** (`app/foundation/discipline-stage/`, die generische
   Wochenspieltags-Reveal-Ansage für ALLE zwanzig Disziplinen, nicht Battle-Mode-spezifisch) —
   berührt keinen Punktestand, keine Tabelle, kein Ergebnis. Ein Fehler dort ist ein optischer
   Fehler, kein Spielstand-Fehler.
2. **Die eigentliche „echte kg"-Zahl (das Zweikampf-Gesamtergebnis, `ArenaFixtureBoxscoreEintrag.
   wert`) erreicht diese Komponente heute NICHT** — sie bekommt nur den bereits verdichteten
   `pointsAwarded`/`val`-PPS-Wert. Sie ihr zusätzlich zugänglich zu machen bräuchte einen NEUEN
   Datenpfad parallel zu `pointsAwarded` (Persistenz der Resolve-Preview, Prop-Durchreichung durch
   `DisciplineStageArena.tsx`, eine ~2000-Zeilen-Komponente, die ALLE zwanzig Disziplinen
   bedient) — eine deutlich größere, riskantere Änderung an gemeinsam genutztem Code als der
   Rest dieser Runde, ohne dass sie irgendein Spielergebnis beeinflusst.
3. **Eine echte Design-Frage, die Chris gehört, nicht dieser Bericht**: die aktuelle 150–400-kg-
   Skala ist eine bewusste „schöne Zahlen"-Dekoration (s. Code-Kommentar dort), monoton im Score.
   Zeigt man stattdessen die LITERALE Summe (potenziell über 2000 kg), sieht die Hantel-Grafik
   anders aus, als sie heute gebaut ist (die visuelle Skala/Balkenhöhen-Berechnung in `barbell.tsx`
   selbst geht von diesem 150–400-Bereich aus). Das zu ändern ist eine Visualisierungs-
   Entscheidung, keine Kalibrierungsfrage — dieselbe Art Unterscheidung wie bei der
   Charisma/Hebeobergrenze-Frage aus der letzten Runde. Ich habe mich konservativ dagegen
   entschieden, ohne Chris' Bild davon zu kennen, wie eine „ehrliche" Hantel-Anzeige aussehen soll.

**Wenn Chris das trotzdem will**: der nächste Schritt wäre, `individualBoxscorePpsByPlayerId`
(bereits vorhanden) um eine parallele `individualBoxscoreKgByPlayerId`-Map (roh, ungekurvt) zu
ergänzen, sie genauso wie `arenaIndividualBoxscorePpsByPlayerId` durch
`buildLegacyMatchdayResolvePreview()` zu reichen, in der Preview zu persistieren, und
`buildBarbellInfo()` bei Verfügbarkeit dieses Felds direkt (ohne 150–400-Remap) zu füttern — eine
neue, aber isoliert angehbare Änderung, kein Umbau.

### 5.2 Gewichtheben-PPS-Referenz mit kleinerer Stichprobe als Basketball

`scripts/ziehe-gewichtheben-pps-referenz.ts` zog **60 Fixtures je Feldgröße** (2..6, gesamt
~300) statt Basketballs 300+ je Feldgröße (gesamt 1500+). Grund: reines Zeitbudget dieser Session
(jede Fixture braucht einen Browser-Neustart/-Neueinhängung, ca. 4–7 s je Fixture je nach
Systemlast) plus geteilte Rechenressourcen mit einer parallel laufenden anderen Agenten-Session
im selben Container während dieser Runde. Das drückt die Präzision von `iKrass` (99,5.-Perzentil,
bei 60 Fixtures × ~6 Boxscore-Einträgen ≈ 360 Werte je Feldgröße, davon ~1,8 oberhalb p99,5 —
Basketballs Referenz hatte bei 300+ Fixtures rund 18 Werte oberhalb, s. deren eigener Kommentar),
nicht `iMittel` (Median, robust auch bei kleinerer Stichprobe). **Das Skript selbst ist bereits
für eine spätere, größere Nachziehung vorbereitet** (`--feldgroesse=<n>` + `--merge`, identisches
Muster wie Basketballs Skript, parallelisierbar) — eine Nachziehung mit mehr Zeit/Rechenleistung
braucht KEINE Code-Änderung.

### 5.3 Kein Live-Deploy/Merge

Wie im Auftrag verlangt: PR gegen `main`, kein automatischer Merge — dieser Bericht ersetzt
keine gründliche menschliche Gegenlese.

## 6. Regressionsnachweis

`npm test` (vollständige Suite, nicht nur battle-mode/arena-Testdateien): **1023 von 1024
Testdateien / 8091 von 8092 Einzeltests grün** (23 übersprungen, umgebungsbedingt — Chromium-
Verfügbarkeit u. Ä., unverändert zu vorher). Die eine gemeldete Ausnahme:

> `tests/arena-headless-runner.test.ts > runArenaFixtures > schliesst den Browser nach Erfolg
> und nach Fehlern zuverlaessig (kein Zombie-Prozess)` — `expected +0 to be 10`

Das ist **Umgebungsrauschen, keine Regression**: dieser Test zählt Chromium-Prozesse
systemweit (`ps -eo pid,args`) vor/nach dem Lauf — in diesem geteilten Container lief während
der vollen Testsuite eine PARALLELE, unabhängige Agenten-Session mit eigenen
Chromium-Instanzen (dieselbe Session, die während der PPs-Referenz-Ziehung dieser Runde bereits
für Verzögerungen sorgte, s. Abschnitt 5.2). Der Test selbst prüft NICHTS an dieser PR
geändertes (`schliesseBrowserHart()` ist unverändert) — **derselbe Test, isoliert erneut
gelaufen (ohne die parallele Störung), bestand sauber**, zusammen mit den anderen sechs Tests
derselben Datei (inklusive des neuen Gewichtheben-Chassis-Tests):

```
✓ runArenaFixtures > liefert bei gleichem Seed ein bitgenau identisches Ergebnis
✓ runArenaFixtures > liefert bei unterschiedlichem Seed ein anderes Ergebnis
✓ runArenaFixtures > verarbeitet mehrere Fixtures mit unterschiedlichen Kadern in einem Batch korrekt getrennt
✓ runArenaFixtures > schliesst den Browser nach Erfolg und nach Fehlern zuverlaessig (kein Zombie-Prozess)
✓ runArenaFixtures > ordnet jedem Boxscore-Eintrag playerId und side eindeutig zu, wenn die Namen im Duell eindeutig sind
✓ runArenaFixtures > faellt fuer eine Namens-Kollision innerhalb eines Duells auf playerId=null/side=null zurueck, statt zu raten
✓ runArenaFixtures > simuliert Gewichtheben ueber das Buehnen-Duell-Chassis: Duellstand 0..jeSeite plus echte Zweikampf-kg-Summe je Seite
Test Files  1 passed (1) · Tests  7 passed (7)
```

Gezielt vorher geprüft:

- `tests/battle-mode-arena-team-points.test.ts`: **alle bisherigen 41 Tests unverändert
  bestanden**, plus neue Tests für `arenaTeamPointsForFixtureMitTiebreak`,
  `ppsAusArenaImpact`/`ppsAusGewichthebenImpact`, `resolveArenaPpsReferenz`/
  `resolveGewichthebenPpsReferenz`, `resolveArenaFieldSizeForMatchday`, sowie
  `runBattleModeArenaMatchday` mit `disciplineId: "gewichtheben"` (gemockter Runner) UND ohne
  `disciplineId` (Default bleibt `"basketball"`, exakt wie vor dieser Änderung).
- `tests/arena-headless-runner.test.ts`: alle bisherigen Basketball-Tests unverändert bestanden
  (echter Chromium-Lauf), plus ein neuer Test für das Buehnen-Duell-Chassis
  (`runArenaFixtures(gameState, [...], "gewichtheben")` — Duellstand 0..6, `gesamtKg` gesetzt und
  plausibel, Boxscore-Werte echte kg).
- `tests/battle-mode-arena-matchday-resolve-e2e.test.ts`, `tests/battle-mode-arena-resolve-
  engine.test.ts`: unverändert, unberührt (reine Basketball-Fixtures, keine Signaturänderung an
  den dort genutzten Funktionen).

## 7. Geänderte/neue Dateien

- `public/mockups/battle-mode.engine.js` — `spieleBuehneHeben()` neu in `window.__arena`,
  additiv. Kein anderer Aufruf/keine andere Zeile geändert.
- `lib/battle/arena-headless-runner.ts` — `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS`, Chassis-Dispatch
  in `simuliereFixturesImBrowser()`/`runArenaFixtures()`, `ArenaFixtureResult.gesamtKg` (optional).
- `lib/resolve/battle-mode-arena-team-points.ts` — `ARENA_RESOLVED_DISCIPLINE_IDS` erweitert;
  `ppsAusArenaImpact()` (generischer Kern), `ppsAusGewichthebenImpact()`,
  `GEWICHTHEBEN_INDIVIDUAL_PPS_MAX`/`GEWICHTHEBEN_PPS_ANTEIL_MITTE`; `resolveArenaPpsReferenz()`/
  `resolveArenaFieldSizeForMatchday()` (generalisiert, Basketball-Wrapper erhalten);
  `arenaTeamPointsForFixtureMitTiebreak()`; `runBattleModeArenaMatchday()` mit
  `disciplineId`-Parameter statt Literalen.
- `lib/season/arena-matchday-resolve-service.ts` — `determineBasketballContexts()` →
  `determineArenaDisciplineContexts()` (liefert die konkrete Disziplin-ID, erkennt den
  Mehrfach-Arena-Disziplin-Fall), `disciplineId` explizit an `runBattleModeArenaMatchday()`
  durchgereicht.
- `lib/resolve/legacy-matchday-resolve-engine.ts` — nur Kommentare korrigiert (Code war bereits
  disziplinuebergreifend über `ARENA_RESOLVED_DISCIPLINE_IDS`).
- `data/generated/gewichtheben-pps-referenz.json` — neu, gezogen von
  `scripts/ziehe-gewichtheben-pps-referenz.ts` gegen das echte `live-save`-Abbild.
- `scripts/ziehe-gewichtheben-pps-referenz.ts` — neu, Analogon zu
  `scripts/ziehe-basketball-pps-referenz.ts`.
- `tests/battle-mode-arena-team-points.test.ts`, `tests/arena-headless-runner.test.ts` — neue
  Tests, s. Abschnitt 6. Kein bestehender Test verändert.

## 7a. Nachgereicht: drei Code-Review-Funde (vor dem Merge behoben)

Der Koordinator hat PR #776 gründlich gegengelesen (Produktionscode-Sorgfalt) — keine
Korrektheitsfehler, keine Basketball-Regression, aber drei kleine Robustheits-/
Wartbarkeitsfunde, alle synchron behoben, bevor gemergt wird:

1. **Irreführende Fehlermeldung im Chassis-Dispatch** (`arena-headless-runner.ts`): die
   `null`-Ergebnis-Fehlermeldung nannte immer `"spieleFeldspiel"`, auch wenn der Buehnen-Pfad
   (`spieleBuehneHeben`) den `null` geliefert hatte — ein Fehler im Gewichtheben-Pfad hätte beim
   Debuggen auf die falsche Funktion gezeigt. Behoben: die Meldung nennt jetzt die tatsächlich
   aufgerufene Funktion (`aufgerufeneFunktion`, aus derselben `chassis`-Variable abgeleitet, die
   auch den Dispatch selbst steuert).
2. **Duplizierter Fallback-Lookup** (`battle-mode-arena-team-points.ts`): der Ausdruck
   `ARENA_IMPACT_KONFIG_JE_DISZIPLIN.get(disciplineId) ?? ARENA_IMPACT_KONFIG_JE_DISZIPLIN.get
   ("basketball")!` stand wortgleich zweimal (`resolveArenaPpsReferenz()` und
   `computeIndividualBoxscorePpsFromFixtureResults()`). In eine gemeinsame Hilfsfunktion
   `loeseArenaImpactKonfigAuf()` gezogen — eine künftige Änderung der Fallback-Regel kann jetzt
   keine der beiden Stellen mehr vergessen.
3. **Fehlende Querprüfung zwischen zwei unabhängig gepflegten Mengen**:
   `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS` (arena-headless-runner.ts) und
   `ARENA_RESOLVED_DISCIPLINE_IDS` (battle-mode-arena-team-points.ts) stehen in einer
   Teilmengen-Beziehung (jede Buehnen-Heben-Disziplin muss auch arena-aufgelöst sein), die nie
   geprüft wurde — eine künftige Disziplin, die nur in einer der beiden landet, wäre still auf
   den falschen Chassis-Dispatch gefallen. Behoben mit einer Fail-Fast-Prüfung beim Modul-Laden
   von `battle-mode-arena-team-points.ts` (wirft sofort mit einer klaren Meldung, statt erst beim
   ersten betroffenen Spieltag-Resolve stumm falsch zu laufen) PLUS einem expliziten Test
   (`tests/battle-mode-arena-team-points.test.ts`, „jede Buehnen-Heben-Chassis-Disziplin ist auch
   arena-aufgeloest").

Alle drei Änderungen sind für Basketball wirkungslos (bestätigt): `tests/battle-mode-arena-team-
points.test.ts` und `tests/arena-headless-runner.test.ts` liefen erneut vollständig grün (63 bzw.
7 Tests), danach die volle Suite (`npm test`) noch einmal komplett: **8092/8093 Einzeltests
grün** — dieselbe eine Umgebungs-Ausnahme wie in Abschnitt 6 (Zombie-Prozess-Zähler, diesmal in
die andere Richtung ausgeschlagen: „expected 20 to be 10" statt vorher „expected 0 to be 10" —
zwei GEGENSÄTZLICHE Ausschläge in zwei Läufen belegen zusätzlich, dass es Rauschen ist, kein
gerichteter Leak durch diese Änderung; isoliert erneut zweimal sauber bestanden).

**Nebenbefund während dieser Runde, dokumentiert statt verschwiegen**: der geteilte Container
hatte zwischenzeitlich ein leeres `node_modules` (vermutlich durch eine der vielen parallelen
Agenten-Worktree-Sessions auf demselben Host, der Datenträger stand bei 95–98 % Belegung) — ein
schlichtes `npm ci` (nicht `npm install`, das hätte `package-lock.json` unnötig verändert)
stellte es wieder her, ohne dass `package-lock.json`/`package.json` in diesem PR angerührt
wurden.

## 8. Offene Architekturfragen für Chris

1. **`barbell.tsx`/`buildBarbellInfo` mit literalen kg statt PPS-Remap** (s. 5.1) — will Chris
   die tatsächliche, potenziell über 2000 kg reichende Team-Summe sehen, oder bleibt die
   dekorative 150–400-kg-Skala (jetzt mit ehrlicherer relativer Ordnung durch Schritt 5)?
2. **Größere Gewichtheben-PPS-Referenz nachziehen** (s. 5.2) — lohnt sich erst, wenn ein Save mit
   Battle Mode + Gewichtheben tatsächlich läuft; bis dahin ist die aktuelle, kleinere Stichprobe
   ausreichend genau für `iMittel`, ungenauer nur am äußersten `iKrass`-Rand.
3. **Zwei arena-aufgelöste Disziplinen am selben Spieltag** (s. 3c) — aktuell bewusst als „nicht
   anwendbar, PPS-Fallback" behandelt. Wird erst relevant, sobald eine dritte Arena-Disziplin
   (Hockey) dazukommt UND ein Spieltag zufällig zwei Arena-Disziplinen gleichzeitig auslost.
