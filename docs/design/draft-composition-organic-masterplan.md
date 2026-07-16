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

## 0.1 Leitbild (North Star) — an diesem misst sich JEDE Entscheidung

> **Team-Identität ist der Grundcharakter, der alles rahmt. Sie muss sich sichtbar in „Sparen vs.
> Ausgeben" UND in den Picks spiegeln.** GM = aktuelle Handschrift obendrauf. Alles andere
> (Kadergröße, Star-Anzahl, Sparen) *emergiert* aus Zielen unter wenigen harten Constraints.

Die **Definition of Done** in einem Bild: sichtbare, mit Identität/GM **korrelierte** Streuung —
einige Teams horten Cash & bleiben klein (~8–10), andere geben voll aus & haben Stars, der Rest solide
Mitte; Superstars nur bei wenigen Teams — **und** finanziell **und** sportlich plausibel, ohne
Constraint-Verletzung.

## 0.2 Eingelockte Entscheidungen (Stand der Abstimmung)

**Vision / Ziele**
- Ausgeben lohnt **kurzfristig**, mit **echtem Nachhaltigkeitspreis** (Cash-Bleed → später Verkaufsdruck).
  Kein Pay-to-win ohne Folgen.
- **Realismus mit Reibung**: reiche/ambitionierte Teams haben Vorteil, aber Missmanagement/Nachhaltigkeit
  hält die Liga offen.
- **Superstars sind knapp & besonders** — nur wenige Teams leisten sich einen; die meisten bauen auf
  Stars/Core.
- **Mehrjahres-Zyklen** erwünscht: aufbauen → Erfolgsfenster → verjüngen → neu aufbauen (ermöglicht den
  „Sparer, der auf ein Fenster spart").
- **Scheitern in Maßen erlaubt** — ein Team darf sich kaputtwirtschaften; die harte Cash-Untergrenze
  verhindert die Todesspirale.
- **Ziel-Priorität bei Konflikt:** Identität rahmt alles; *innerhalb* der Identität führt das
  Sport-/Board-Ziel, mit **Finanzen als Leitplanke**.
- **GM-Archetyp-Wechsel bei Misserfolg:** scheitert ein Typ (z.B. Star-Chaser), probiert das Board mit
  **hoher Wahrscheinlichkeit einen *anderen* Archetyp** aus dem Pool (nicht denselben Typ nachbesetzen).
- KI-Teams sind **echte Rivalen mit eigenen, sichtbaren Zielen** (kein Rubberbanding).

**Modell / Mechanik**
- **Stärke/Qualität rein aus Stats:** POW/SPE/MEN/SOC + Anzahl Disziplinen über Skill-Schwelle
  (>60 solide, >80 specialist). **`mvs`/`ovr` sind am Transfermarkt = 0/null** (kein Scouting/keine
  Historie bei S1) → dürfen NICHT als Qualität verwendet werden. Der bereits committete Value-Tilt
  (execute) läuft daher im Draft ins Leere und wird in Phase 1 durch das Stats-Maß ersetzt.
- **Marktwert (MW) = ausschließlich Preis/Kosten**, nie Qualitätssignal.
- **Stat-Gewichtung team-/disziplin-abhängig** (Bedarf-Disziplinen höher; nutzt `bestNeedDisciplineId`).
- **Rollen-Achse Hybrid:** Disziplin-Bedarf bestimmt *wo* gekauft wird, Qualität *wie gut*.
- **Cash-Optionswert (Sparen) = Puffer/Risiko, season-by-season** (Board-Risiko + Gehalts-Runway).
- **Kein Wage-Budget.** Nachhaltigkeit = rollierender **Cash-Flow-Forecast**: Sponsor + erwartetes Prize
  (nur zur Planung, NICHT doppelt gutgeschrieben) + Netto-Transfererlöse + Gebäude-Einkommen − zukünftige
  Gehälter. Board-vermittelt über die Gehaltsquote `Gehalt/(Cash+Gehalt)`, weich.
- **Roster-Range fix: MIN = 8, MAX = 14** (harte Constraints). **OPT ist weich**, aus Identität
  abgeleitet und **GM-moduliert**: Elite-GMs drücken OPT runter (kleiner Kader), Depth-GMs rauf (breit) —
  innerhalb [8, 14]. *(Heute setzt nur `identity.playerOpt` das OPT; die GM-Modulation muss ergänzt werden.)*
- **Cash: harte Untergrenze (Puffer)** — einer der wenigen legitimen Hard-Blocker.
- **GM- & Identitäts-Achsen wiederverwenden:** Identität (`ambition`/`finances`/`harmony`/`boardConfidence`)
  = Grund-Aggressivität + Basis-OPT; GM-Bias (`starPriority`/`valuePriority`/`rosterDepthPreference`/
  `riskTolerance`/`cashPriority`/`eliteSmallRosterPreference`/`loyaltyBias`) moduliert die Nutzen-Gewichte
  (w_win/w_thrift/w_patience/w_asset) + den OPT-Shift.

**Die einzigen harten Blocker:** Roster ∈ [8, 14] · Cash ≥ Puffer. Alles andere emergiert.

**Spielmechanik (geklärt, M1–M10):**
- **Ergebnis = begrenzte Aufstellung:** pro Spieltag werden **≤ 12 Spieler** eingesetzt, **2–6 pro Disziplin**.
  Mit Roster [8, 14] ist der Rotationspuffer dünn (14 = nur 2 Reserve) → Tiefe ist knapp & wertvoll.
- **Fatigue spürbar** (+ Verletzungen/Sperren) → Rotation nötig → Tiefe hat echten Wert.
- **20 Disziplinen** über den 4 Kern-Attributen POW/SPE/MEN/SOC; Spieler haben Skill je Disziplin;
  **vielseitige Spieler decken mehrere Disziplinen** ab.
- **Qualität eines Spielers** = POW/SPE/MEN/SOC (team-/bedarfs-gewichtet) + Anzahl Disziplinen
  **>60 (solide) / >80 (specialist)**. `mvs`/`ovr` am Transfermarkt = 0 → verboten als Qualität. MW = nur Preis.
- **Deckungs-*Kurve* pro (gesuchter) Disziplin** (ersetzt eine feste Schwelle): Grenznutzen steigt bis
  **Sweetspot 3–4** Spieler über Schwelle, bleibt **stark bei 5–6**, **fällt ab 7 rapide** (und ab der
  ≤12-Einsatzgrenze der Disziplin ohnehin).
- **Potenzial ja, Alter nein:** „Build-for-future" = Potenzial-Term (GM-gewichtet), es gibt **keine
  Alters-Achse**.
- **Verkauf** aus demselben Kalkül, mehrere organische Auslöser (Cash für besseren Kauf · überzählig in
  gedeckter Disziplin · Kader über OPT · Verkaufswert > Grenznutzen im Kader).
- **Gewichte aus bestehenden Daten:** GM-Bias-Achsen → Utility-Gewichte + OPT-Shift; Identität → Basis-
  Aggressivität + Basis-OPT (kein neues Datenmodell).

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

Ersetze den top-down Slot-Quoten-Allocator durch einen **team-eigenen, schrittweisen Nutzen-Optimierer**.
Jeder Schritt bewertet Kandidaten-Aktionen in *einer* Währung und nimmt die beste, bis STOP gewinnt oder
ein harter Constraint bindet.

```
Zustand: Kader, Cash, Bedarf je Disziplin (Deckungs-Count), Gehaltssumme, Forecast
Wiederhole bis STOP gewinnt oder roster = MAX(14) oder cash < Puffer:
  Kandidaten:
    - je gesuchter Disziplin: bester bezahlbarer Free Agent
    - (in-season) Verkauf je überzähligem Kader-Spieler
    - STOP / Geld behalten
  Nutzen:
    U_buy(p)  =  w_win     · ΔStärke(p | Kader, Deckungskurve, ≤12-Einsatz)
               − w_thrift  · Preis(p) / Budget-Skala
               − w_sustain · Gehaltslast(p | Forecast)
               + w_asset   · Potenzial(p)
    U_sell(q) =  w_thrift  · Verkaufswert(q)
               − w_win     · ΔStärke_Verlust(q)            # klein, wenn q in gedeckter Disziplin
               + w_patience· Cash-Optionswert-Gewinn
    U_stop    =  w_patience· Cash-Optionswert(cash, Forecast, Board-Risiko, OPT-Nähe)
  wähle argmax; STOP darf erst gewinnen, wenn roster ≥ MIN(8)
Harte Blocker (die EINZIGEN): roster ∈ [8, 14] · cash ≥ Puffer
```

### Die Terme im Detail

- **ΔStärke(p)** — der marginale Stärkegewinn:
  `Qualität(p)` = gewichtete POW/SPE/MEN/SOC der **Bedarf-Disziplinen** + Bonus je Disziplin **>60/>80**,
  durch die **Deckungskurve** gedämpft: für jede Disziplin, die `p` abdeckt, hängt der Grenzwert vom
  aktuellen Count in dieser Disziplin ab — steigend bis **3–4**, stark bis **5–6**, Absturz ab **7** (und ab
  der ≤12-Einsatzgrenze der Disziplin → ~0). Vielseitige Spieler summieren über mehrere Disziplinen. So
  stoppt „alles Stars" **ohne Cap**: ist eine Achse gedeckt, fällt der Grenznutzen unter den einer offenen.
- **Preis/Budget-Skala** — `w_thrift`-gewichtete Kosten; die Skala ist das Team-Budget, damit der Term
  budget-relativ wirkt. Das ist der **systemische Value-Tilt**: günstig-solide schlägt teuer, wenn ΔStärke/€
  besser ist (→ „hier und da ein 60er/70er").
- **Gehaltslast(p | Forecast)** — nicht ein Wage-Cap, sondern der Beitrag zur **rollierenden Cash-Flow-
  Prognose**: Sponsor + erwartetes Prize (nur Planung) + Netto-Transfer + Gebäude − zukünftige Gehälter.
  Bläht das Gehalt den Forecast ins Minus, steigt `w_sustain`-Strafe (board-vermittelt über die
  Gehaltsquote).
- **Potenzial(p)** — Build-for-future-Term (kein Alter), `w_asset`-gewichtet; Entwickler-GMs werten hoch.
- **Cash-Optionswert** — der sensible Knopf: hoch, wenn Cash knapp am Puffer / Board-Risiko groß / Kader
  schon **≥ OPT**; niedrig bei Cash-Überfluss weit über Puffer. So entsteht **Sparen** rational und die
  **weiche OPT-Bremse** (Kader nähert sich OPT → STOP wird attraktiver).

### OPT weich, GM-moduliert (kein Slot-Zwang)

MIN(8)/MAX(14) sind hart. **OPT** kommt aus `identity.playerOpt` und wird vom GM verschoben
(`eliteSmallRosterPreference` runter, `rosterDepthPreference` rauf, innerhalb [8, 14]). OPT ist **kein
Slot-Zwang**, sondern nur die Schwelle, ab der der Cash-Optionswert den Kauf-Nutzen zu überholen beginnt —
Elite-Teams stoppen früher (kleiner Kader), Depth-Teams später (breit).

### Gewichts-Ableitung aus Identität + GM (recycelt, kein neues Datenmodell)

- **Identität (Basis):** `ambition`↑→`w_win`↑ · `finances`↓→`w_thrift`↑ · Board-Druck↑→`w_win`↑ +
  `w_patience`↓ (win-now) · Basis-OPT aus `identity.playerOpt`.
- **GM (Modulation obendrauf):** `starPriority`↑→`w_win`↑ · `valuePriority`↑→`w_thrift`↑ ·
  `cashPriority`↑→`w_patience`↑ · `riskTolerance`↑→`w_win`↑ + toleriert Gehaltslast ·
  `rosterDepthPreference`↑→OPT↑ + Deckungs-Sweetspot höher · `eliteSmallRosterPreference`↑→OPT↓ +
  `w_win`/Slot↑ · `loyaltyBias`↑→Verkaufs-Hemmung.

### Warum das die gewünschte Vielfalt liefert (am North Star)

- **Sparer** (hoch `w_thrift`+`w_patience`): STOP gewinnt früh → **Cash auf der Bank**, kleiner Kader.
- **Ausgeber** (hoch `w_win`, niedrig `w_thrift`): kauft Qualität bis die Deckungskurve flacht → Stars + Core.
- **Kleiner Elite-Kader** (`eliteSmallRoster`-GM): niedriges OPT + hoher `w_win`/Slot → wenige teure, tief in
  den Schlüssel-Disziplinen.
- **Breiter Kader** (`rosterDepth`-GM): hohes OPT + Sweetspot 3–4 über mehr Disziplinen → viele solide Spieler.
- **Superstar-Knappheit** emergiert: der Grenznutzen eines Superstars muss `w_thrift`·(riesiger Preis) **und**
  die Opportunität, mehr Disziplinen zu decken, schlagen — das schaffen nur wenige high-`w_win`/high-Budget-Teams.
- **Identität sichtbar in Sparen/Ausgeben & Picks** (die Kern-DoD) = direkter Ausdruck der Gewichte.

### Warum das den Messer-Schneiden-Effekt beseitigt

Es ist **eine** Funktion mit interpretierbaren, vorzeichen-klaren Gewichten. `w_thrift` +10% → weniger
Ausgaben, **monoton**, ohne Kaskade. Kein „ein Knopf kippt die Liga" mehr — der eigentliche architektonische Fix.

## 4. Harte Blocker: was bleibt, was fällt

**Bleibt (echte Constraints):** Roster **∈ [8, 14]**, Cash ≥ Puffer. Solvenz-/Regelgrenzen, kein Geschmack.
(Kein Wage-Cap — Gehalt wirkt weich über den Forecast.)

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

1. **Identität sichtbar (Kern-DoD):** man erkennt am Save, ob ein Klub **spart oder klotzt** — an Cash,
   Kadergröße **und an den Picks**. Die Handschrift des Teams ist ablesbar, kein Einheitsbrei.
2. **Korrelierte Streuung**: Kadergröße (8–14), Ausgaben, Star-Anzahl, gehaltener Cash streuen *sichtbar*
   und folgen **Identität/GM** (ambitioniert↔Ausgaben, sparsam↔Cash, Elite↔klein, Depth↔breit) — nicht Zufall.
3. **Superstar-Knappheit**: echte Superstars nur bei **wenigen** Teams, nicht flächendeckend.
4. **Finanzielle Plausibilität**: die meisten Teams über Seasons tragfähig (kein struktureller Dauerverlust);
   Scheitern einzelner Teams erlaubt, aber Cash-Untergrenze hält.
5. **Sportliche Plausibilität**: Tabelle spiegelt Kaderstärke; Ausgeben zahlt sich **kurzfristig** sichtbar
   aus, kostet aber nachhaltig.
6. **Keine Constraint-Verletzung**: 0 Teams unter MIN(8), kein Kader über MAX(14), kein negativer Cash.
7. **Monotones Tuning**: ein Gewicht ±10% bewegt genau seine Achse, ohne die Liga zu kippen (Anti-Knife-Edge).

## 7. Verhältnis zu laufender Arbeit

- Der **Value-Tilt** (execute pick) ist bereits ein Vorgriff auf „Grenznutzen/€" und bleibt — er wird in
  Phase 1 Teil der Utility statt Einzel-Patch.
- **Financial-Value-Discipline** (Regression-Softening, Budgetanteil-Deckel, Gehalt verhandeln) speist
  `w_sustain`/`w_asset` und den Cash-Optionswert.
- **Board-Objectives V2** (Disposition, perceivedPressure) speist `w_win`/`w_patience` (Druck → win-now).
- Die GMs, die du schon hast, werden vom **Lane-Bias-Kipper** zum **Utility-Gewichts-Setzer** aufgewertet —
  dieselben Daten, ehrlichere Wirkung.

## 8. Risiken / offene Punkte

- **Disziplin-Bedarfsmodell**: die Deckungskurve braucht je Team einen sauberen **Count „Spieler > Schwelle
  je Disziplin"** (mit Mehrfach-Zählung vielseitiger Spieler) und eine **Bedarfsgewichtung** der 20
  Disziplinen aus Identität/Theme. Prüfen, ob `bestNeedDisciplineId`/Theme-Context das genug hergibt oder
  ein schlankes Bedarfsmodell nötig ist (Phase 1).
- **Cash-Optionswert kalibrieren**: der eine sensible Knopf — zu hoch → alle horten, zu niedrig → keiner
  spart. Messgetrieben über die Dispersions-Metriken einstellen.
- **Deckungskurve kalibrieren**: Sweetspot 3–4 / stark 5–6 / Absturz ab 7 gegen die ≤12-Einsatz- und
  [8,14]-Kadergrenzen abgleichen, damit breite Teams nicht künstlich verhungern.
- **Perf**: der greedy Optimierer bewertet je Schritt mehrere Kandidaten; muss den Draft-Perf-Hoist
  (in-memory Free-Agent-Pool) respektieren, damit die Läufe schnell bleiben.
- **GM-OPT-Modulation fehlt heute**: `deriveRosterTargets` nimmt nur `identity.playerOpt`; die GM-Verschiebung
  (Elite runter / Depth rauf) muss ergänzt werden.
- **Umfang**: größter Umbau seit dem In-Season-Engine-Cutover → Flag + Phasen + A/B, kein Big-Bang.
