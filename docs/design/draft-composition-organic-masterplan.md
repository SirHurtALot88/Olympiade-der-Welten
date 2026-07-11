# Masterplan: Organische Kader-Komposition & Transfer-Verhalten

Status: Entwurf zur Abstimmung · Ziel: robuste, emergente Team-Vielfalt statt getunter Quoten

## 0. Was wir eigentlich wollen (Zielbild)

Eine Liga, in der sich **von selbst** unterschiedliche Team-Profile herausbilden:

- Teams die **sparen** vs. Teams die **viel ausgeben**
- Teams mit **kleinem Elite-Kader** vs. Teams mit **breitem Kader**
- Stars die sich lohnen, aber nicht „nur die teuersten" — hier und da ein 60er/70er
- **möglichst wenige harte Blocker** — die Verteilung soll sich aus Identität + GM + Budget ergeben,
  nicht aus Quoten

Kurz: die Komposition soll ein **emergentes Ergebnis** von Team-Zielen sein, kein vorab verteiltes
Slot-Raster.

## 1. Warum wir das aktuell NICHT erreichen (Diagnose)

### 1.1 Messbeleg: das System ist ein Messer-Schneiden-Gebilde

Zwei self-seeded S1-Draft-Läufe (gleiches Tooling, nur zwei kleine „organische" Hebel dazwischen):

| Lauf | Ø Kader | Superstars (Liga) | Stars | Mitte (Core/Depth/Backup) | Reserve | Ø Kern% | Ø Top-10 MW | Teams < Min |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| **A** (Ist-Stand) | ~12 | ~40 | ~0 | 77 | **264** | 29% | **98.4** | 0/32 |
| **B** (+2 Budget-Hebel) | ~7 | **0** | 88 | 45 | 92 | 61% | 64.2 | **20/32** |

Zwischen A und B lagen zwei *milde* Änderungen (Tail-Reserve budget-skaliert + Min-Fill budget-paced).
Ergebnis: **die ganze Liga kippte** — Superstars komplett weg, Kader von 12 auf 7 geschrumpft, 20 Teams
unter Roster-Minimum. Das ist kein Kalibrierungsfehler, das ist ein **Struktur**problem: die Komposition
ist der Ausgang von ~8 sich gegenseitig überschreibenden Heuristiken, und keine davon repräsentiert den
tatsächlichen „Plan" eines Teams.

### 1.2 Die ~8 gekoppelten Heuristiken (jede patcht ein Symptom der anderen)

1. `deriveLaneCapsFromAppetite` — Premium/Superstar-Caps aus Appetit-Score
2. `resolvePremiumCounts` — wie viele Premium-Slots vorne
3. `planSlotsFromBudget` mit **Tail-Reserve** (Restplätze auf Depth-Floor sichern)
4. …plus **Pyramid-Reserve** (drückt einen Premium runter wenn Mitte nicht finanzierbar)
5. `reconcileBudget` — Downgrade-Kaskade backup→depth→core→star→superstar
6. `enforceMidTierPyramid` — erzwingt Mindest-Mitte, degradiert überschüssige Core
7. `allocateSeason1FillLanes` — **garantiert** Core-Slots (`minCoreSlots`)
8. Execute: `underMin → cheap_fill` **Zwang** (jeder Slot unter Min wird auf Reserve gedrückt)

Jede Regel wurde eingebaut, um ein Symptom zu heilen, das eine andere Regel erzeugt hat. Sie **kämpfen
gegeneinander**. Es gibt kein einziges Objekt „So sieht der Plan von Team X aus", über das man reasoning
betreiben kann — der Plan ist über eine Pipeline von Overrides verschmiert. Deshalb ist Tuning nicht
monoton: an einem Knopf drehen kaskadiert unvorhersehbar durch die anderen sieben.

### 1.3 Das ist die Antwort auf „übersehe ich was?"

Ja — **eine gemeinsame Entscheidungswährung.** Aktuell gibt es keine Stelle, an der ein Team sagt:
„Ist mir ein zweiter Superstar mehr wert als drei Core-Spieler oder als Geld auf der Bank?" Diese
Abwägung wird durch Slot-Quoten *ersetzt* statt *berechnet*. Ohne diese Abwägung kann organische Vielfalt
nicht entstehen — sie kann nur aufgezwungen werden.

## 2. Was Systeme haben, die das schaffen (FM / OOTP / CM) — und uns fehlt

| # | Baustein | Was es bewirkt | Haben wir? |
|---|---|---|---|
| A | **Team-Nutzenfunktion (Utility)** — jede Aktion (Kauf X, Verkauf Y, Geld halten) wird in *einer* Währung bewertet | Komposition **emergiert** aus Nutzen-Maximierung unter Constraints, keine Quoten | ❌ (Slot-Quoten stattdessen) |
| B | **Getrennte Gehalts- vs. Transferbudgets**, beide als laufende Constraints | Nachhaltigkeit; Überkauf hat Folgen | ⚠️ teilweise (Gehalt existiert, bremst aber Käufe kaum) |
| C | **Abnehmender Grenznutzen pro Rolle** (2. Superstar auf gleicher Achse ≈ wenig wert; 5. Stürmer ≈ wertlos) | stoppt „alles Stars" **ohne Cap** — der Grenznutzen fällt unter den einer Lücke | ❌ (Needs existieren, speisen aber keine Grenznutzenkurve) |
| D | **Optionswert von Cash / Geduld** (Sparen lohnt, wenn Bank > bester verfügbarer Spieler jetzt) | **Sparer-Verhalten** wird rational → kann emergieren statt aufgezwungen | ❌ (Cash hat keinen Nutzenwert → kein Team spart je freiwillig) |
| E | **Persönlichkeits-Gewichte + Rauschen** (Risiko, win-now vs. build, Streuung) | echte Team-Vielfalt, keine Konvergenz zum selben Optimum | ⚠️ (GMs kippen Lane-Bias, aber keine Utility-Gewichte) |
| F | **Spieler-Heterogenität** (Alter/Potenzial, Gehaltsforderung, Wiederverkauf, Vielseitigkeit) | belohnt *verschiedene* Strategien; nicht nur teuer-vs-billig | ⚠️ (Potenzial/Scouting da, fließt aber kaum in Kaufwert) |

Wir haben also die **Zutaten** (GMs, Identität, Gehälter, Potenzial), aber keinen **gemeinsamen Rechner**,
der sie gegeneinander abwägt. Das ist die Lücke.

## 3. Der Reframe: Greedy Marginal-Utility Squad Builder

Ersetze den top-down Slot-Quoten-Allocator durch einen **team-eigenen, schrittweisen Nutzen-Optimierer**:

```
Zustand: aktueller Kader, Cash, Gehaltsspielraum, Bedarf je Rolle
Wiederhole:
  Kandidaten-Aktionen:
    - bester verfügbarer Spieler je Rolle/Preisklasse (Kauf)
    - (in-season) Verkauf eines Kader-Spielers
    - STOP / Geld behalten
  bewerte jede Aktion mit Grenznutzen:
    U(kauf) =  ΔTeamstärke(RollenFit, abnehmend) · w_win
             − Preis                              · w_thrift
             − GehaltsWirkung                     · w_sustain
             + Wiederverkauf/Potenzial            · w_asset
    U(stop) =  Optionswert(Cash | offene Fenster, Board-Risiko, Ziel)  · w_patience
  wähle max-Nutzen-Aktion
  bis STOP gewinnt ODER ein HARTER Constraint bindet
Harte Constraints (die einzigen Blocker):
  roster ∈ [min, max] · cash ≥ Puffer · Gehalt ≤ Cap
```

Alles andere — Anzahl Stars, Kadergröße, Sparen — **emergiert** aus den Gewichten `w_*`, die aus Identität
+ GM kommen.

### Warum das die gewünschte Vielfalt liefert

- **Ambitioniert + reich** (hoch `w_win`, niedrig `w_thrift`): kauft Qualität bis der Grenznutzen fällt →
  Stars + solider Core, gibt viel aus.
- **Sparsam / klamm** (hoch `w_thrift` + `w_patience`): STOP gewinnt früh → **Geld auf der Bank**, kleiner
  oder schlank gefüllter Kader → der **Sparer**.
- **Depth-GM** (Grenznutzen belohnt jede gefüllte Rolle): viele Depth-Spieler → **breiter Kader**.
- **Star-Picker-GM** (konkave Stärkekurve favorisiert *ein* Elite-Asset): wenige teure → **kleiner Elite-Kader**.
- **60er/70er tauchen auf**, weil ein günstiger Spieler mit gutem RollenFit einen besseren Grenznutzen/€ hat
  als der teuerste im Band (das ist der schon gebaute Value-Tilt, aber jetzt *systemisch* statt als Patch).

### Warum das den Messer-Schneiden-Effekt beseitigt

Es ist **eine** Funktion mit interpretierbaren Gewichten. `w_thrift` hoch → weniger Ausgaben, **monoton
und vorhersehbar**. Keine Kaskade, kein „ein Knopf kippt die Liga". Jedes Gewicht hat eine klare Bedeutung
und ein klares Vorzeichen. Das ist der eigentliche architektonische Fix.

## 4. Harte Blocker: was bleibt, was fällt

**Bleibt (echte Constraints):** Roster-Min/Max, Cash ≥ Puffer, Gehalt ≤ Cap. Das sind Solvenz-/Regelgrenzen,
keine Geschmacksregeln.

**Fällt (wird emergent):** Premium-Caps, Tail-Reserve-Gating, Pyramid-Enforcement, Min-Core-Garantie,
`underMin → cheap_fill`-Zwang, reconcile-Downgrade-Kaskade. Alle acht Heuristiken aus §1.2 verschwinden
und werden durch die Nutzenkurve ersetzt.

## 5. Rollout — messgetrieben, hinter Flag, nichts kippt live

- **Phase 0 — Messbarkeit.** Dispersions-Metriken über die Liga: Streuung (stdev) von Kadergröße, Gesamt-
  ausgaben, Star-Anzahl, gehaltenem Cash. Plus: korreliert die Streuung mit Identität/GM? (ambitioniert→gibt
  aus, sparsam→spart). Plus per-Team Entscheidungs-Log (welche Aktion, welcher Nutzen). *Das* ist die
  Vorher/Nachher-Messgröße.
- **Phase 1 — Utility-Scorer als reine Funktion** (`lib/ai/organic-squad/…`) + Unit-Tests, noch **nicht**
  verdrahtet. Gewichte auf dem Papier kalibrieren. `tsc`/Tests grün.
- **Phase 2 — Draft hinter `OLY_ORGANIC_SQUAD_BUILDER`.** Nur der Draft, alter Pfad bleibt Default.
  A/B via `run-draft-eval.sh`: Dispersion + Kern% + Top-10 + „0 Teams < Min".
- **Phase 3 — Identität/GM → Gewichte mappen** (bestehenden GM-Bias + Identität wiederverwenden, kein
  neues Datenmodell). Streuung tunen bis Profile sichtbar auseinanderlaufen.
- **Phase 4 — In-Season Buy/Sell auf dieselbe Utility** (Grenz-Add/Drop). Ein Modell für Draft *und* Fenster.
- **Phase 5 — Multi-Season-Validierung** (Fatigue/Training/Star-Entwicklung/Cash über S1–S6), dann Cutover
  wie beim In-Season-Umbau (verhaltensbewahrender Flag-Flip, sobald die Metriken stehen).

## 6. Metriken für „organisch" (Definition of Done)

1. **Streuung**: Kadergröße, Ausgaben, Star-Anzahl, Cash haben *sichtbare* Liga-Streuung (nicht alle gleich).
2. **Korrelation**: die Streuung folgt Identität/GM (ambitioniert↔Ausgaben, sparsam↔Cash), nicht Zufall.
3. **Keine Constraint-Verletzung**: 0 Teams unter Min, kein negativer Cash, Gehalt im Rahmen.
4. **Monotones Tuning**: ein Gewicht ±10% bewegt genau seine Achse, ohne die Liga zu kippen.
5. **Ökonomische Plausibilität**: die meisten Teams sind über mehrere Seasons finanziell tragfähig
   (kein struktureller Dauerverlust) — greift in die Financial-Discipline-Arbeit.

## 7. Verhältnis zu laufender Arbeit

- Der **Value-Tilt** (execute pick) ist bereits ein Vorgriff auf „Grenznutzen/€" und bleibt — er wird in
  Phase 1 Teil der Utility statt Einzel-Patch.
- **Financial-Value-Discipline** (Regression-Softening, Budgetanteil-Deckel, Gehalt verhandeln) speist
  `w_sustain`/`w_asset` und den Cash-Optionswert.
- **Board-Objectives V2** (Disposition, perceivedPressure) speist `w_win`/`w_patience` (Druck → win-now).
- Die GMs, die du schon hast, werden vom **Lane-Bias-Kipper** zum **Utility-Gewichts-Setzer** aufgewertet —
  dieselben Daten, ehrlichere Wirkung.

## 8. Risiken / offene Fragen

- **Rollen-/Bedarfsmodell**: die Grenznutzenkurve braucht ein sauberes „Rolle gefüllt ja/nein" je Achse.
  Prüfen, ob `computeIdentityLaneAppetite`/Theme-Context das schon genug hergibt oder ob ein schlankes
  Rollen-Bedarfsmodell nötig ist.
- **Cash-Optionswert kalibrieren**: zu hoch → alle horten; zu niedrig → keiner spart. Das ist der eine
  sensible Knopf — muss messgetrieben eingestellt werden.
- **Perf**: der greedy Optimierer bewertet je Schritt mehrere Kandidaten; muss den Draft-Perf-Hoist
  (in-memory Free-Agent-Pool) respektieren, damit die Läufe schnell bleiben.
- **Umfang**: das ist der größte Umbau seit dem In-Season-Engine-Cutover. Deshalb Flag + Phasen + A/B, kein
  Big-Bang.
