# P5 — Per-Team-Identitäts-Treue (Theme + Ökonomie, alle 32 Teams)

Status: geplant · Voraussetzung: P4 (In-Season Buy/Sell) zuerst · Teil des organischen Squad-Builder-Masterplans
(`docs/design/draft-composition-organic-masterplan.md`).

## 0. Ziel

Jede der 32 Team-Identitäten muss im organischen Kaderbau **treu** sichtbar werden — auf zwei Ebenen:
**wen** ein Team pickt (Theme/Komposition) und **wie** es handelt (Ökonomie-Strategie). Auslöser: der
generische v1-Theme-Fit verwechselte **Quote/Restriktion** mit **Flavor** (V-D wurde fälschlich reines
Elfen-Team; R-C-Rassen-Restriktion nicht honoriert). P5 macht das sauber, config-getrieben, für alle Teams.

## 1. Eingelockte Entscheidungen (Q1–Q7)

- **Q1 — Quoten-Härte:** Quoten stark; die Config-Ausnahme (`exceptionPolicy`/`qualityOverrideThreshold`)
  greift **nur bei echten, klaren Upgrades** — Ausnahmen bleiben selten.
- **Q2 — Flavor:** Flavor-Tags klar sichtbar/dominant, aber **keine Rassen-Sperre** — mind. 2 Rassen
  vertreten, außer es liegt eine *echte* Rassen-Quote vor (R-C/H-R).
- **Q3 — Quellen-Wahrheit:** Der organische Fit setzt auf die bestehende
  `team-theme-composition-service` (deren Geschlechts-/Rassen-Quoten- + Roster-Share-Logik) auf — **eine
  Wahrheit**, keine parallele Tag-Heuristik.
- **Q4 — Ökonomie-Quelle:** GM-Bias moduliert die **Identitäts-Basis** (beide zählen). C-C's `finance 10`
  zieht immer Richtung Value — selbst ein Star-Chaser-GM bringt das nicht auf 0. (Deckt sich mit der
  bestehenden Gewichts-Ableitung: Identität = Basis, GM = Handschrift obendrauf.)
- **Q5 — Verträge:** `contractLength` (existiert im Datenmodell) wird in **Käufen UND Verkäufen**
  honoriert. Plus Insight: hohe **Harmony/BoardConfidence** → längere Verträge (Stabilität), hält Spieler,
  **spart Gehalt**, tradet weniger; hohe `shortContractPreference`/`sellForProfitAggression` → kurze
  Verträge, aktives Flippen.
- **Q6 — Reihenfolge:** **P4 zuerst** (In-Season/Sell-Engine), dann P5 legt die Ökonomie-Treue drauf.
- **Q7 — Verifikation:** automatische Per-Team-Checks + Report zum Spot-Check.

## 2. Teil A — Theme/Komposition treu (auf der Theme-Engine)

Statt paralleler Tag-Overlap-Heuristik nutzt der organische Fit die **Klassifikation der Theme-Engine**
als Wahrheit und unterscheidet sauber:

1. **Quote/Restriktion (hart-ish):**
   - `genderQuotaHumanoidScoped` (V-D, D-P …): Nicht-Tiere müssen dem Geschlecht entsprechen → starker
     Malus für Verstöße, zählt nur humanoide.
   - `raceQuotaScoped` (H-R Demon, Aqua-Team) / Rassen in `primaryThemeTags` (R-C Human/Elf/Dwarf):
     Rassen-Quote/-Restriktion → starke Präferenz für erlaubte Rassen, Malus außerhalb.
2. **Flavor (sanft, nicht strictness-verstärkt):** sekundäre/soft Tags — v.a. **Rassen als Flavor**
   (Elf bei V-D) — nur leichte Lehnung, **keine** Rassen-Konzentration (Q2: ≥2 Rassen, außer echte Quote).
3. **avoid (hart):** `avoidTags` mit Strictness skaliert → aktiv raus.
4. **Ausnahmen selten (Q1):** ein Spieler über `qualityOverrideThreshold` darf die Quote brechen — aber
   nur bei echtem großen Upgrade, nicht als Regelfall.
5. **Umsetzung:** `computeThemeFit` liest die Engine-Klassifikation/Quoten-Signale (statt eigener
   Tag-Gewichte); Strictness (`hard/strong/medium/soft`) skaliert nur die **Quote/avoid**-Härte, nicht
   den Flavor. `allowedOutsiderTags` (V-D-Pets) bleibt als „erlaubt, nicht bevorzugt".

## 3. Teil B — Ökonomie-Strategie treu (GM-Bias × Identitäts-Basis)

Alle Ökonomie-Achsen kommen aus dem zugewiesenen GM-Bias, moduliert auf die Identitäts-Basis (Q4). Neue
Terme in der Utility:

- **MW/Gehalt-Ratio (Value-Effizienz):** hoher `valuePriority`/`finance` → Buy-Term bevorzugt Spieler mit
  gutem Marktwert-pro-Gehalt (effizient), nicht nur billig. (C-C's Kauf-Seite.)
- **Verkauf-mit-Gewinn (In-Season, P4-verdrahtet):** `sellForProfitAggression` erhöht die `sellUtility`
  für Spieler, deren Verkaufswert deutlich über Einstand/Grenznutzen liegt → aktives Flippen.
- **Vertragslänge (Q5):**
  - `shortContractPreference` / hoher `sellForProfitAggression` → Kauf bevorzugt **kurze** `contractLength`
    (flexibel zum Weiterverkauf); tradet aktiv.
  - `longContractPreference` / **hohe Harmony/BoardConfidence** → bevorzugt **lange** Verträge: Stabilität,
    **Gehaltsersparnis** (langer Vertrag = günstigeres Gehalt/Saison — *im Impl. gegen das Contract/Salary-
    Modell verifizieren*), hält Spieler, weniger Verkäufe.
- **wageSensitivity:** speist bereits `wSustain` (Gehaltslast) — bleibt.

## 4. Teil C — Verifikation (alle 32 Teams, automatisiert)

Ein Report-Skript prüft pro Team Config vs. tatsächlichen Draft/In-Season-Kader:
- **Quote erfüllt?** (Geschlecht/Rasse-Anteil ≥ `minimumShare`, Ausnahmen gezählt)
- **avoid draußen?** (0 avoid-Tag-Spieler, außer erlaubte Ausnahme)
- **Flavor sichtbar, aber nicht gesperrt?** (Flavor-Anteil hoch, aber ≥2 Rassen wenn keine Rassen-Quote)
- **Ökonomie passt zum GM?** (Value-Team kauft effizient; Trader hat kürzere Verträge + mehr Verkäufe;
  stabiles Team längere Verträge + weniger Trades + mehr Cash-Ersparnis)
- Ausgabe: Per-Team Pass/Fail + Kennzahlen; Liga-Summary zum Spot-Check.

## 5. Reihenfolge & Abhängigkeiten

1. **P4 zuerst** — In-Season Buy/Sell auf dieselbe Utility (die `sellUtility` existiert bereits; wird
   verdrahtet + um Profit-/Vertrags-Terme ergänzt). Ohne P4 gibt es keine Verkauf-mit-Gewinn-Bühne.
2. **P5 danach** — Teil A (Theme-Treue auf der Engine) + Teil B (Ökonomie-Terme) + Teil C (Verifikation),
   messgetrieben am Dry-Run + In-Season-Lauf, hinter demselben Flag (`OLY_ORGANIC_SQUAD_BUILDER`).
3. **Cutover** erst, wenn die Per-Team-Checks grün sind (Teil des DoD im Masterplan).

## 6. Offene Impl-Notiz

- **Contract/Salary-Beziehung verifizieren:** ob lange `contractLength` tatsächlich ein günstigeres
  Gehalt/Saison bedeutet (der „lange Verträge sparen Gehalt"-Effekt) — falls nicht direkt im Modell, über
  Verhandlung/Retention abbilden.
- **Theme-Engine-API:** prüfen, welche Quoten-/Klassifikations-Funktion (`calculateThemeCompositionScore`
  / `rosterShare` / `playerCountsForPrimaryThemeShare`) der Fit am saubersten konsumiert, ohne die
  Roster-Share-Berechnung pro Kandidat zu wiederholen (Runtime-Context einmal pro Team).
