# Financial & Value Discipline — Design-Dokument

**Status:** Entwurf zum Review. Ein erster Hebel (valueScore in star/superstar) ist bereits umgesetzt.
**Problem (vom Owner im echten Run beobachtet):** Top-Spieler sind doppelt kaputt — die KI **überzahlt**
sie beim Kauf (Marktwert/OVR) **und** sie **regredieren** danach brutal (Training/Fatigue), und die
**Gehälter** sind relativ zu den Einnahmen unbezahlbar. Ergebnis: ein, zwei Mega-Stars fressen das Budget,
der Rest des Teams verkommt, das Team macht strukturell Verlust.

**Verbindender Kern:** **Marktwert ist die gemeinsame Wurzel.** Die Kauf-Engine jagt hohen (überzeichneten)
Marktwert/OVR → überzahlt; die Regression **bestraft nach Marktwert** → der teure Star zerfällt am
schnellsten; die Gehälter skalieren mit Marktwert und werden nie verhandelt. Drei Baustellen, eine Wurzel.

**Leitprinzip:** organische Hebel, **keine Hard-Caps/Quoten**. Behavior-ändernd → messgetrieben (Long-Run
vorher/nachher). Evtl. Sammel-Flag `OLY_FINANCIAL_DISCIPLINE` (s. G4).

---

## A — Buy-Value-Disziplin  (`lib/ai/ai-needs-picks-compare-service.ts`, `market-brackets.ts`)

**Befund:** Der dominante Score-Term `playerQualityScore` (0–32) enthält **keinen Preis**. Der einzige
kostenbewusste Term `valueScore` ist auf 12 gedeckelt, lässt die Fähigkeit im Zähler weg — und wurde für
**star/superstar gar nicht benutzt** (stattdessen +4 fürs Kaufen nahe Preis-Cap, −3 für den günstigeren).
Superstar-Bracket hat **keine Preis-Obergrenze**; die Funktion, die den Einzelkauf-Budgetanteil deckeln
würde (`enforceSeason1SinglePickSpendCap`), ist **totes Code**. OVR ist **überzeichnet** (sqrt-normalisiert,
nur 20% MVS-gekoppelt, 20% zirkulär mit dem eigenen Marktwert) → OVR 100 = real CA 74 / MVS 57.

**Hebel:**
1. ✅ **valueScore in star/superstar** + Teuer-Reward raus (Gewicht 0,4). *Bereits committet.*
2. **Qualität-pro-Kosten**: `playerQualityScore` in `valueScore`-Zähler falten (7111-7125) + Clamp von 12
   anheben, damit „Qualität pro MW/Gehalt" gegen den ungedeckelten 0–32-Quality-Term ankommt. (Betrifft
   alle Lanes → messen.)
3. **Einzelkauf-Budgetanteil deckeln (organisch)**: `enforceSeason1SinglePickSpendCap` reaktivieren **oder**
   einen weichen Per-Pick-Spend-Malus einführen (kein Hard-Cap): ein Pick, der > X% des spendable Cash
   frisst, bekommt einen mit dem Anteil wachsenden Score-Malus → „3×40 statt 1×120".
4. **OVR entzerren im Buy-Score**: MVS in `getPlayerSportsQuality`/`playerQualityScore` (3543-3558, 6881)
   mit reinziehen, damit die KI gegen tatsächlichen Match-Value bewertet, nicht nur gegen aufgeblähtes OVR.

## B — Regressions-Disziplin  (`lib/training/organic-season-progression.ts`)

**Befund:** Netto = Regression + Training + Performance. **Regression = −(0,344 + Marktwert×0,007) pro
Attribut**, ×12 → für 113-Mio-Star ≈ **−13,7/Season**, das harte Trainings-Budget (5,18) kann das nie
ausgleichen. **Marktwert-Term ist linear & ungedeckelt.** **Doppelte Asymmetrie**: nahe am Attribut-Ceiling
wird Trainings-*Wachstum* auf 5–45% gedrosselt, die **Regression feuert aber ceiling-blind mit voller
Stärke** → der teure, fast ausgereizte Star ist der Worst Case. Das Audit `organic_peak_net_corridor` *will*
Top-Spieler bei **+4,5…+8 Netto** — die Realität verletzt das, versteckt sich aber im Liga-Durchschnitt.

**Hebel:**
1. **Regression ceiling-aware** (`:697`): bei `capped`/`closing`-Attributen die Regression **mildern**
   (z. B. ×0,85 / ×0,7 — Spiegelbild der Wachstums-Drossel, aber sanft), damit ein ausgereiftes Attribut
   **plateaut statt ewig zu erodieren**. Höchster Hebel — trifft genau die strukturelle Decline-Garantie.
2. **Marktwert-Regressions-Term soft-cappen** (`:659-664`): `marktwertBase` mit Soft-Knee/Deckel statt
   linear-unbegrenzt, damit Extremwert-Stars nicht proportional-grenzenlos bestraft werden.
3. **Per-Spieler-Audit-Signal**: `computeSeasonOrganicProgressionMetrics` um einen Flag erweitern, der
   einzelne High-Value-Spieler mit Netto weit unter dem Korridor meldet (nicht nur Liga-P90/-Schnitt).

## C — Gehalts-Disziplin & Forecast-als-Warnsignal  (`lib/ai/*`, `contract-negotiation-preview.ts`)

**Befund:** Gehalt = starre Formel aus Marktwert+Attributen+Traits; die KI bietet **immer 100% Nominal**,
obwohl die Verhandlungs-Infrastruktur (offerRatio, accept/counter/reject, demandMultiplier 0,5–1,45×)
**existiert**. Der Kauf-Gate prüft nur **Einzelsaison-Cash**, nie Gehalts-Nachhaltigkeit. Der
**5-Season-Forecast ist reines Display** — **keine** KI-Entscheidung liest ihn (nur ein Season-1-Trend-Nudge).
Der Forecast hält das Gehalt korrekt flach fort (bestätigt) → strukturelle Verluste sind echt.

**Hebel:**
1. **KI verhandelt Gehalt**: Default-Angebot `offeredSalary = expectedSalary × teamOfferRatio(...)` statt
   100% (`ai-transfermarkt-preview-service.ts:1280`, lokaler Buy-Pfad). `teamOfferRatio` aus
   `wageSensitivity`/`cashPriority`/GuV — disziplinierte/klamme Teams lowballen; das bestehende
   accept/counter/reject macht daraus echte Verhandlung (mal verliert man den Deal — wie ein echter GM).
2. **Forecast-als-Warnsignal**: die 5-Season-GuV-Summe in `ai-cash-salary-target-service` (Soft/Hard-Ratio),
   `planner-cash-buffer-policy` (Liquiditätspuffer), `contract-renewal-service` (Renewal-Gate) und
   `transfer-market-policy.passesStrategicBuyGate` (Score-Schwelle statt Block) einspeisen → bei tief
   negativer P&L **zieht die KI Gehalts-/Kauf-Bremse an** (weich, kein Hard-Cap).

---

## Design-Entscheidungen (brauche dein Urteil)

- **G1 — Value-Aggressivität:** Wie stark soll Value ziehen? *Milder Tilt* (ab und zu ein 60/70er, Stars
  weiterhin möglich) **oder** *stark* (Stars werden selten, Fokus Effizienz)? Risiko bei zu stark: die KI
  kauft nie mehr echte Stars.
- **G2 — Regressions-Ziel für Top-Stars:** Sollen gut gemanagte Top-Stars **leicht positiv** bleiben
  (+ kleiner Netto) oder nur **plateauen** (~0), aber nicht mehr crashen? (Steuert, wie stark A/B greifen.)
- **G3 — Gehalt: Lowball vs. nur Bremse:** Soll die KI aktiv **unter Nominal bieten** (Verhandlung, Deal
  kann platzen) **oder** reicht es, den Ausgaben-/Gehalts-Appetit über den Forecast zu **drosseln** (kein
  aktives Lowball)?
- **G4 — Rollout:** Alles hinter **einem Flag** `OLY_FINANCIAL_DISCIPLINE` (messbar, A/B) **oder**
  inkrementell live wie der valueScore-Fix (schneller sichtbar, aber sofort in allen Läufen)?

## Reihenfolge (Vorschlag)
A2/A3 (Value-Kern) → B1/B2 (Regression, der akuteste „Stars crashen"-Punkt) → C1/C2 (Gehalt) →
Messlauf. Verzahnt sich mit dem Preseason-Rebuild-Blocker und dem `organic_peak_net_corridor`-RED.
