# Board-Objectives Redesign — Design-Dokument

**Status:** Entwurf zum Review (noch keine Implementierung)
**Ziel:** Ein sinnvolles, dynamisches Board-Ziel-System, das (1) Trivialziele ersetzt,
(2) Schwierigkeit an die Teamstärke koppelt, (3) eine echte Wahrnehmungs-/Druck-Ebene
getrennt von den harten Zielen einführt, und (4) den Team-Captain als Druck-Regler einbindet.

**Leitprinzipien**
- **Keine Hard-Limits / Quoten.** Alle Kalibrierung organisch aus Stärke, Identität, Disposition.
- **Wahrnehmung ≠ harte Ziele.** Ziele bleiben fix; der *gefühlte* Druck hat eigene Dynamik.
- **Verhaltens-ändernd → messgetrieben.** Jede Scheibe hinter Flag, im Long-Run vorher/nachher gemessen.
- **Wiederverwenden statt neu bauen.** Bestehende `boardConfidenceDelta`-Pipeline, `leadershipScore`,
  Strategie-/Identity-Profile bleiben das Fundament.

---

## 1. Ist-Zustand (Kurzreferenz)

Drei lose gekoppelte Subsysteme:

### A) Ziel-Generierung — `lib/board/team-season-objectives-service.ts`
- ~20 Ziel-Kandidaten/Team → getrimmt auf feste **Vierer-Slate** (Rang / dringendste Finanz / Roster / Flex)
  via `selectBoardObjectiveDrafts()` + Sponsor-Ziele separat.
- Skaliert bereits nach `identity.ambition`, Strategie-Bias, Season-Nummer, Komposit-Stärke-Rang —
  aber durchsetzt mit **hartkodierten Konstanten** und **Team-Sonderfällen per shortCode**.
- **Trivialziele (Kern der Kritik):**
  - `finance-cash-positive` → Ziel `> 0`, `boardConfidenceDelta +0.4 / −1.0` (größter Swing im File). Sinnlos.
  - `roster-optimum` → `playerOpt ± 1`. Trivial.

### B) Vertrauen & Druck — dynamischer Zustand `seasonState.boardConfidence {value, pressure}`
```
value    = clamp(base + Σ(alle Ziel-Deltas), 1, 10)
pressure = clamp(11 − value + 0.8×failed + 0.35×atRisk, 1, 10)
base     = prev*0.8 + identitySeed*0.2   (bzw. Honeymoon +0.5 bei GM-Wechsel; Season 1 neutral 5/5)
```
- Neuberechnung bei **jedem** State-Refresh (kein Momentum, keine Glättung, kein Narrativ).
- Konsequenzen: Cash-Belohnung/Strafe, AI-Transfer-Bias, GM-Rauswurf (nur AI), Human-Budget-Kürzung.

### C) Team-Captain — `lib/morale/team-captain-service.ts`
- `leadershipScore` = Charisma 0.32 + Will 0.20 + Determination 0.18 + Awareness 0.16 + OVR 0.08 + Traits.
- 4 Effekte, davon **2 tot**: `rivalryPressureReductionPct` (nur UI), `conflictSoftenChancePct` (nirgends gelesen).
- **Null Verbindung zum Board.** Sauberer Startpunkt.

### Bestätigte Bugs (mit ins Redesign)
1. `gm-pressure-behavior.ts` liest den **statischen** Identity-Seed statt des **dynamischen** Saison-Zustands
   → AI-GM-Psychologie ignoriert, wie die Saison tatsächlich läuft.
2. Skalen-Inkonsistenz 1–10 vs. 0–100 zwischen den zwei `buildGmStoryView()`-Aufrufern.
3. Season-End-Settlement-Delta wird direkt danach vom Recompute überschrieben (Settlement-Math wirkungslos).

---

## 2. Kernkonzepte des neuen Systems

### 2.1 Team-Stärke-Index → erwartete Liga-Position
Ein normierter `strengthIndex ∈ [0,1]` pro Team, aus vorhandenen Signalen (Kader-Marktwert-Summe,
Kern-Achsen-Schnitt, Top-Spieler-OVR). Daraus die **erwartete Liga-Position** `expectedRank`
(1 = stärkstes Team, N = schwächstes). Das ist der Anker: ein Ziel ist "fair", wenn es relativ zu
`expectedRank` gesetzt wird — **nicht** absolut.

> Bereits vorhanden: `getSportTarget()` berechnet intern einen Komposit-Stärke-Rang (Zeile ~421–426).
> Den ziehen wir raus in eine wiederverwendbare `resolveTeamStrengthIndex()` / `resolveExpectedLeagueRank()`.

### 2.2 Board-Disposition (Ambition + Geduld) — dynamisch
Zwei Werte pro Team/Season, die sich innerhalb der **Persönlichkeits-Bandbreite** des Boards bewegen:
- `ambition ∈ [0,1]` — wie sehr das Board *über* die Erwartung hinaus will. Startwert aus `identity.ambition`;
  bewegt sich saisonal: **Überperformance hebt die Latte**, wiederholte Enttäuschung senkt sie leicht
  (oder macht ungeduldig — s. offene Frage F1).
- `patience ∈ [0,1]` — wie schnell aus Unterperformance *Druck* wird. Startwert aus `identity.boardConfidence`
  + `identity.harmony`. Ein geduldiges Board eskaliert langsamer.

Das ist dein *"mal ambitionierter, mal weniger ambitioniert, je nachdem wie das Board drauf ist"*.

### 2.3 Ziel-Difficulty-Kalibrierung
Jedes Ziel bekommt ein **Difficulty-Band** relativ zu `expectedRank`, moduliert durch `ambition`:
```
targetRank = round( expectedRank − stretch )
stretch    = lerp(minStretch, maxStretch, ambition)   // ambitioniertes Board → größerer Stretch nach oben
```
- Schwaches Team (expectedRank 26): `stretch` klein → Ziel ~"Rang 24 halten / nicht Bottom-3". **Erfüllbar.**
- Starkes Team (expectedRank 3): `stretch` groß bei hoher Ambition → Ziel "Titel/Top-2". **Fordernd.**
- Analog für Nicht-Rang-Ziele (Achsen-Rang, Kaderwert-Entwicklung, Transferbilanz): Zielwert = f(Stärke-Perzentil).

Ergebnis: **nicht zu leicht, nicht zu schwer** — die Schwierigkeit atmet mit Stärke × Board-Ambition.

### 2.4 Wahrnehmungs-/Druck-Ebene (`perceivedPressure`) — der neue Kern
Getrennt von `value` (harte Ziel-Bilanz). `perceivedPressure` bekommt **eigene Dynamik**:
```
rawGap            = f(objective-status: failed/atRisk gewichtet, relativ zu Difficulty)
momentum(t)       = decay*momentum(t−1) + (1−decay)*rawGap(t)   // Recency: jüngste Resultate zählen mehr
narrativeBoost    = f(Serie)   // 3 Pleiten in Folge > 3 verstreute Pleiten
patienceDamping   = f(disposition.patience)
captainDamping    = f(captain.leadershipScore)   // s. 2.5
perceivedPressure = clamp( basePressure(momentum, narrativeBoost) − patienceDamping − captainDamping, 1, 10)
```
- **Harte Ziele sinken nie.** Was sinkt, ist der *gefühlte* Druck — genau deine Formulierung.
- `momentum` gibt Glättung + Trägheit (kein Springen bei jedem Refresh mehr).
- `perceivedPressure` (nicht die rohe Inverse) wird zur **einzigen Druck-Quelle** für alle Konsequenzen
  (AI-Bias, GM-Rauswurf, Story-Text) → behebt Bug #1 als Nebeneffekt.

### 2.5 Captain → Board-Kanal
`captainDamping = clamp(leadershipScore / K, 0, maxDamp)` — hoher Leadership-Captain **nimmt Druck raus**:
- **primär (empfohlen):** senkt `perceivedPressure` direkt (Kabinen-Rückhalt) und **verbreitert das
  Toleranzband** (at_risk-Schwelle wächst; GM-Rauswurf-Wahrscheinlichkeit sinkt). Ziele bleiben unverändert.
- **optional (offene Frage F2):** verhandelt zusätzlich die `difficulty` minimal runter (kleinerer `stretch`).
- Die zwei toten Captain-Felder werden umgewidmet:
  `rivalryPressureReductionPct` → `boardPressureReductionPct` (jetzt echt konsumiert),
  `conflictSoftenChancePct` → `objectiveToleranceBonusPct` (verbreitert at_risk-Band).
  **Kein neues Schema nötig.**

---

## 3. Neues Ziel-Set (ersetzt Trivialziele)

| Alt (raus/entwertet) | Neu | Zielformel (relativ zu Stärke/Disposition) |
|---|---|---|
| `finance-cash-positive` (`>0`) | **`finance-net-transfer-balance`** | Netto-Transferbilanz ≥ Schwelle, skaliert nach `cashPriority`/Season. Cash-positiv nur noch implizit. |
| `roster-optimum` (`playerOpt±1`) | **`roster-quality-composition`** | Rollen-Verteilung trifft Identitäts-Soll (core/depth/star-Anteil), organisch — nutzt bestehende `classifyMarketBracket`. |
| — | **`squad-value-trajectory`** | Kaderwert halten/steigern relativ zur Liga-Δ (nicht absolut). |
| `sport-rank-N` (teils shortCode-hart) | **`sport-rank-calibrated`** | `targetRank = expectedRank − stretch(ambition)` statt hartkodierter Tiers/Kürzel. |
| Achsen/Medaillen/Player-Ziele | bleiben, aber **difficulty-kalibriert** | Schwellen aus Stärke-Perzentil statt fixer Konstanten (28 PP, Top-N …). |

Trivialziele werden **nicht ersatzlos gestrichen**, sondern durch bedeutungsvolle ersetzt, damit die
Vierer-Slate voll bleibt. shortCode-Sonderfälle werden durch identitäts-/stärke-getriebene Logik abgelöst
(Team-"Charakter" kommt aus `ambition`/Bias, nicht aus String-Checks).

---

## 4. Konkrete Formeln (Startwerte, alle tunebar)

```
// 4.1 Stärke
strengthIndex   = 0.55*norm(squadMarketValueSum) + 0.30*norm(coreAxisAvg) + 0.15*norm(topPlayerOvr)
expectedRank    = 1 + round((1 − strengthIndex) * (leagueSize − 1))

// 4.2 Disposition (pro Season fortgeschrieben)
ambition(0)     = identity.ambition/10
ambition(s)     = clamp( ambition(s−1) + α*(overPerformance(s−1)) , ambBandLo, ambBandHi )
patience        = clamp( 0.5*identity.boardConfidence/10 + 0.5*identity.harmony/10 , 0.1, 0.95 )

// 4.3 Difficulty
stretch         = lerp(0, maxStretch(expectedRank), ambition)   // maxStretch kleiner am Tabellenende
targetRank      = clamp(expectedRank − stretch, 1, leagueSize)

// 4.4 Perceived Pressure (pro Refresh)
rawGap          = Σ weight(status_i, difficulty_i)             // failed schwerer je leichter das Ziel war
momentum        = 0.6*momentum_prev + 0.4*rawGap
narrative       = streakBonus(recent failures)
captainDamp     = clamp(leadershipScore/40, 0, 2.0)
patienceDamp    = 2.5*patience
perceivedPressure = clamp( 5 + momentum + narrative − patienceDamp − captainDamp , 1, 10)

// 4.5 Confidence (harte Bilanz — bleibt, aber entkoppelt von pressure)
value           = clamp(base + Σ objectiveDelta, 1, 10)
```
Konstanten (`α`, `maxStretch`, `momentum-decay`, `K=40`, Damping-Caps) landen in **einer** Config-Datei
`lib/board/board-objectives-config.ts` (analog `in-season-engine-config.ts`) — zentral tunebar für Balancing.

---

## 5. Konsequenzen-Anpassung
- **GM-Rauswurf** (`team-general-managers.ts`): Wahrscheinlichkeit liest künftig `perceivedPressure`
  (+ `value` als Floor) statt roher Inverse; Captain-Damping senkt sie organisch. Human-Ausschluss bleibt.
- **AI-Transfer-Bias** (`buildAiBias`): `pressureFactor = perceivedPressure/10`.
- **gm-pressure-behavior**: liest den **dynamischen** Zustand (Bug #1 Fix), inkl. Captain-Damping.
- **Human-Budget-Kürzung**: bleibt, aber Schwelle an `perceivedPressure` statt an rohem `value` — konsistent.

---

## 6. Datenmodell-Änderungen (minimal)
```ts
// TeamBoardConfidenceRecord  (olyDataTypes.ts)
+ perceivedPressure: number;      // 1–10, neue Wahrnehmungs-Ebene
+ pressureMomentum: number;       // internes Glättungs-Feld (carry-over)
// TeamSeasonObjectiveRecord
+ difficulty: number;             // 0–1, für gewichtete rawGap + UI
// TeamCaptainRecord.effects  — zwei tote Felder umgewidmet, kein neues Feld
  rivalryPressureReductionPct → boardPressureReductionPct   (jetzt konsumiert)
  conflictSoftenChancePct     → objectiveToleranceBonusPct  (jetzt konsumiert)
// Board-Disposition
+ seasonState.boardDisposition?: Record<teamId, { ambition:number; patience:number }>;
```

---

## 7. Implementierungs-Scheiben (phased, flag-gated, messbar)
Flag `OLY_BOARD_OBJECTIVES_V2` (default AUS bis Parität/Balancing grün).

- **Slice 1 — Stärke & Kalibrierung:** `resolveTeamStrengthIndex`/`expectedRank`; `sport-rank` kalibriert;
  Trivialziele → neue Ziele (`net-transfer-balance`, `roster-quality-composition`, `squad-value-trajectory`).
  *Messung:* Ziel-Erfüllungsrate pro Stärke-Tertil im Long-Run (schwach/mittel/stark sollen alle ~erfüllbar).
- **Slice 2 — Perceived-Pressure-Ebene:** neues Feld + Formel; alle Konsequenzen auf `perceivedPressure`
  umstellen; Bug #1/#3 fixen. *Messung:* GM-Rauswurf-Rate, Pressure-Verlauf-Glätte.
- **Slice 3 — Board-Disposition:** `ambition/patience`-Fortschreibung. *Messung:* Ziel-Ambition-Varianz über Seasons.
- **Slice 4 — Captain-Kanal:** Damping + Toleranzband; tote Felder umwidmen; Duplikat-Captain-Formel
  in eine Quelle konsolidieren. *Messung:* Effekt guter Captain auf Rauswurf-Rate/Pressure.
- **Slice 5 — Skalen-Bug #2 + UI/Tooltips** an die neue Semantik anpassen.

---

## 8. Verifikation / Metriken
- Neue Long-Run-Report-Spalten: `expectedRank`, `targetRank`, `objective-fill-rate`, `perceivedPressure`,
  `boardDisposition.ambition`, `captainDamping`.
- Gates: Ziel-Erfüllungsrate pro Stärke-Tertil in gesundem Korridor (schwach ≥ X%, stark nicht trivial ≥ Y%);
  GM-Rauswurf-Rate plausibel; kein Pressure-Springen; keine Regression bei Cash/MW/Fatigue.
- Bestehende Tests (`team-season-objectives-service.test.ts`, `team-general-managers-board-replacement.test.ts`,
  `gm-pressure-behavior.test.ts`, `gm-hot-seat-probability.test.ts`) werden sich **bewusst** ändern → anpassen.

---

## 9. Offene Design-Entscheidungen (brauche dein Urteil)
- **F1 — Board bei Enttäuschung:** Ambition *senken* (realistischer, weniger Druck) **oder** *ungeduldiger*
  werden (mehr Druck, mehr GM-Wechsel)? Oder stärke-abhängig beides?
- **F2 — Captain-Reichweite:** Nur `perceivedPressure` dämpfen + Toleranzband (Ziele bleiben hart) —
  **oder** darf ein Top-Captain die `difficulty` minimal runter-verhandeln?
- **F3 — Human vs. AI:** Gilt das neue Pressure/Captain-System symmetrisch für Menschen-Teams (nur Budget-Folge)
  und AI-Teams (Rauswurf-Folge), oder unterschiedlich kalibriert?
- **F4 — Slate-Größe:** Vierer-Slate beibehalten oder stärke-/disposition-abhängig 3–5 Ziele?
