# Training-Forecast Breakdown (Setpoints, PPS/MVS, Netto-Kette)

Grundlage fuer die Transparenz-Ueberarbeitung des Trainings-Panels (Spieler-Detail /
`PlayerTrainingControls`, Kader-Karten in `TrainingPlayerLane`). Beantwortet: Was
bedeutet "Setpoints" wirklich, wie haengen PPS/MVS mit dem Trainingsforecast
zusammen, und wie kommt der Netto-Wert pro Spieler zustande.

## 1. Zwei unabhaengige "Setpoints"-Systeme (das war die Verwirrung)

Der Code hat **zwei komplett getrennte Zahlensysteme**, die beide vorher "Setpoints"
genannt wurden. Das war der Kern der vom User beschriebenen Verwirrung — es ist
**keine Skalierung** zwischen 40/70/110 und 3,39/4,29/6,1, sondern zwei
unterschiedliche Mechaniken:

| | Organisches Trainingsbudget (laufend) | Saison-End Bonus-XP (manuell) |
|---|---|---|
| Konstante | `TRAINING_SETPOINTS_BY_MODE` in `lib/training/training-mode-presentation.ts` (`leicht: 3.39, mittel: 4.29, hart: 6.1`) | `PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode` in `lib/training/player-progression-forecast.ts` (`leicht: 40, mittel: 70, hart: 110`) |
| Wofuer | Treibt `buildOrganicSeasonProgression()` — verteilt sich automatisch, matchday-getaktet, auf die 12 Attribute eines Spielers (Klassenprofil, Affinitaet, Decke). Das ist der Wert, der im "Training +X"-Kachel steht. | Ein grosser XP-Pool, den man am Saisonende manuell fuer konkrete Attribut-Upgrades oder Rating-Tier-Upgrades ausgibt (`buildPlayerProgressionForecast()`, Season-End-XP-Feature). |
| Skala | ~3-10 pro Saison-Tick | ~40-400+ nach Bonus (Appearances, MVS, PPs-Bonus, Top10/Rang1, Highlights) |
| Sichtbar in UI (vorher) | "Training +X" Kachel (`organicForecast.trainingSetpoints`) | Die Intensitaets-Kacheln "Leicht/Mittel/Hart" zeigten faelschlich **diese** Zahl unter dem Label "Setpoints" — obwohl direkt daneben "Training +X" die andere Zahl zeigte. |

**Root Cause des Bugs:** `TrainingModeOption` fuehrt beide Werte (`baseXp` = Saison-End-Pool,
`trainingSetpoints` = organisches Budget), aber `buildTrainingModeSegments()`
(`components/foundation/velo-ui/VeloIntensityRail.tsx`) hat bisher `option.baseXp`
gerendert. Dadurch zeigte die Intensitaets-Auswahl eine Zahl, die nichts mit dem
tatsaechlichen "Training +X" der Spielerkarte zu tun hatte.

**Fix:** Die Intensitaets-Kacheln zeigen jetzt `option.trainingSetpoints` unter dem
Label "Trainingsbudget" (matcht 1:1 mit der Spieler-Kachel). Der Saison-End-Pool
(`baseXp`) taucht nur noch als sekundaerer Hinweis im Tooltip auf ("Separat: +40
Saison-Bonus-XP zum manuellen Ausgeben am Saisonende."), damit die Info nicht
verloren geht, aber nicht mehr mit dem laufenden Trainingsbudget verwechselt wird.

## 2. Was ist PPS und was ist MVS?

Beide sind offiziell im Spiel-Glossar definiert (`lib/ui/game-encyclopedia.ts`):

- **PPs** ("echter Punktebeitrag aus gespielten Wettbewerben"): Summe der
  tatsaechlichen Matchday-Punkte (Rank-to-Points je Disziplin, D1/D2, inkl. Slots,
  Rollen, Form, Push, Captain, Powers, Mutatoren). Zentral in
  `lib/foundation/player-rating-contract.ts` (`resolvePlayerDisplayPps`,
  `ppsSeason`).
- **MVS** ("Matchday Value Score"): Bewertet **verwertbaren Impact** statt reiner
  Staerke — Disziplin-Rangpunkte + Clutch-Bonus (Showcase/Eiskunstlauf/
  Football/Basketball/Battlefield) + Vielseitigkeits-Bonus + Einsatz-Bonus. Formel:
  `mvs = disziplin + clutch + versatility + einsatz` (siehe
  `docs/RETOOL_AI2_PICK_ENGINE_PORT.md`, Abschnitt "Retool MVS Formula").

Beide Werte werden auf dem Spieler ueberall in der App verwendet (Marktwert,
Season Review, Transfermarkt, Spielerkarten) und sind auf `row.playerPps` /
`row.playerMvs` bereits im `TrainingPlayerRowView` vorhanden.

**Wichtige Klarstellung:** Der "Performance"-Anteil im Trainingsforecast
(`organicForecast.performanceSetpoints`, aus `buildOrganicSeasonProgression()` in
`lib/training/organic-season-progression.ts`) ist **keine direkte Umrechnung** von
PPS/MVS. Er wird separat aus den rohen Matchday-Records berechnet
(`getPerformanceSetpoints()`: `finalPlayerScore`, `rankInDiscipline`,
`scoreContribution`, saison-weit mit sanfter Kappung
`PERFORMANCE_SEASON_SOFT_KNEE`). Beide Werte (Performance-Anteil und PPS/MVS)
spiegeln **dieselbe zugrunde liegende Spielpraxis**, sind aber unterschiedliche
Ableitungen auf unterschiedlichen Skalen — deshalb zeigen wir sie jetzt
nebeneinander (Trainingspanel: "Saison-PPs X · MVS Y" direkt unter der
Training/Performance-Kachelreihe), damit der Nutzer den Trainings-Fleiss neben der
tatsaechlichen Matchday-Leistung einordnen kann, ohne die beiden Zahlen fuer
identisch zu halten.

*(Der season-end `player-progression-forecast.ts` nutzt PPS/MVS dagegen direkt und
linear: `mvsXP = mvs × 4`, `ppsBonusXP = min(pps × 4, Deckel)`. Das ist Teil des
komplett getrennten Saison-End-XP-Systems aus Abschnitt 1, nicht des laufenden
organischen Trainingsforecasts.)*

## 3. Volle Kette: Basis → Modifikatoren → Performance → Regression → Netto

Quelle: `buildOrganicSeasonProgression()` in `lib/training/organic-season-progression.ts`.

1. **Basis-Training** (`baseTrainingBudget = TRAINING_SETPOINTS_BY_MODE[mode]`):
   Fixwert je Intensitaet — Leicht 3,39 / Mittel 4,29 / Hart 6,1.
2. **× Trait-Multiplikator** (`traitSignal.trainingTraitMultiplier`): positive
   Traits wie Diligent boosten, negative wie Lazy bremsen
   (`lib/training/trait-training-signal.ts`).
3. **× Potential-Multiplikator** (`potentialTrainingMultiplier × potentialGapFactor`):
   wie viel Luft zum gescouteten Potential noch offen ist
   (`getPotentialTrainingMultiplierFromRecord`, `getPotentialGapXpFactor`).
4. **× Route-Bonus** (`getDevelopmentRouteBonusMultiplier`): Trainingsklasse
   passend zum Team-Fokus (POW/SPE/MEN/SOC) gibt einen kleinen Zusatzbonus.
5. **× (1 + Facility-Bonus%)** (`getFacilityTrainingModifierPct`):
   Trainingscenter-Level × Effizienz + Team-Entwicklungstendenz-Bonus.
   → Ergebnis: `trainingSetpoints` (das "Trainingsbudget", z. B. 6,3 im Screenshot).
6. **Verteilung auf 12 Attribute**: Klassenprofil (`distributeByClassProfile`,
   70/30-Split bei Zweitklasse ab Trainingscenter Level 4) + Affinitaets-Multiplikator
   (Signature ×1,15 / Weak ×0,8) + Attribut-Decke (Headroom) →
   `appliedTrainingSetpoints` (Summe der `training`-Anteile je Attribut; kann durch
   Decken-Effekte leicht vom rohen Budget abweichen).
7. **+ Performance-Anteil**: aus echten Matchday-Records
   (`buildPerformanceDeltas`, s. Abschnitt 2), auf Disziplin-Gewichte verteilt, mit
   saisonweiter Kappung (`PERFORMANCE_SEASON_SOFT_KNEE`) und Affinitaets-/
   Headroom-Multiplikator → `appliedPerformanceSetpoints`.
8. **− Regression** (pro Attribut identisch): `ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE`
   (fix, aktuell 0,344) **plus** Marktwert-Druck
   (`marktwert × ORGANIC_MARKET_VALUE_PRESSURE_RATE`, aktuell 1,04 % vom Marktwert
   in Mio.). Teurere Spieler regressieren dadurch staerker — das bildet den
   Erwartungsdruck ab, den teure Kader haben.
9. **= Netto-Delta pro Attribut** = Training + Performance − Regression, geklemmt
   auf 1-99. Summe ueber alle 12 Attribute = `netSetpoints` (die "Stat Forecast"-Zahl).

Diese Kette ist jetzt 1:1 als aufklappbare Liste ("Wie kommt das zustande?") im UI
sichtbar (siehe Abschnitt 4) — sie berechnet nichts neu, sondern liest nur bereits
vorhandene Felder aus `TrainingPlayerRowView` (`attributeForecast[].training/
performance/regression`, `modifiers.*`, `organicForecast.trainingSetpoints`) plus
den Basiswert aus `getTrainingModePresentation(mode).trainingSetpoints`.

Ein kleiner Rest-Faktor ("Weitere Boni (Rolle/Fokus)") wird als Residuum aus
`trainingSetpoints / (Basis × Trait × Potential × Facility) − 1` gezeigt, weil der
Route-Bonus (Schritt 4) aktuell nicht als eigenes Feld nach aussen exportiert wird
und wir keine neue Berechnung einfuehren wollten, nur die vorhandene sichtbar
machen. Der Wert stimmt exakt mit dem tatsaechlichen Endergebnis ueberein.

## 4. UI-Aenderungen (Transparenz, kein Layout-Umbau)

Geaenderte Dateien:

- `components/foundation/velo-ui/VeloIntensityRail.tsx` — Intensitaets-Kacheln
  zeigen jetzt `trainingSetpoints` ("Trainingsbudget") statt `baseXp`
  ("Setpoints"); Saison-End-Pool bleibt als Tooltip-Zusatzinfo erhalten.
- `components/foundation/velo-ui/VeloImpactStrip.tsx` — Labels umbenannt:
  "Setpoints" → "Netto-Statwachstum", "Saison-Forecast" → "Saison-Risiko" (identischer
  Wert wie Netto-Statwachstum, aber jetzt klar als "gleicher Wert + Risikoeinordnung"
  beschriftet statt als scheinbar zweite Kennzahl), "keine Performance-Setpoints" →
  "kein Performance-Anteil aus Matchdays".
- `app/foundation/training-facilities-v2/training-view-shared.tsx` —
  - `TrainingModeGuide` nutzt jetzt ebenfalls `trainingSetpoints` statt `baseXp`.
  - Neue Funktion `buildTrainingBudgetBreakdown()` + Komponente
    `TrainingBudgetBreakdownDisclosure` (aufklappbare Schritt-fuer-Schritt-Liste,
    Basis → Trait → Potential → Facility → (Rest) → Trainingsbudget → Angewendet →
    Performance (mit PPS/MVS-Vergleich) → Regression → Netto).
  - Kader-Karten (`TrainingPlayerLane`) zeigen jetzt ebenfalls die
    PPS/MVS-Vergleichszeile und die Breakdown-Disclosure, fuer Konsistenz mit dem
    Spieler-Detail-Panel.
- `app/foundation/player-profile/PlayerTrainingControls.tsx` (das Panel aus dem
  Screenshot) — neue Zeile "Trainingsfleiss vs. echte Spielpraxis: Saison-PPs X ·
  MVS Y" direkt unter den Summary-Kacheln, plus die aufklappbare Breakdown-Liste,
  plus praezisere Tooltips auf "Training"/"Performance"-Kacheln.
- `app/foundation/training-facilities-v2/TrainingFacilitiesV2Client.tsx` — Team-
  Summary- und Story-Kacheln umbenannt ("Performance-Anteil", "Netto-
  Trainingswachstum", "Trainingsbudget (Team)") fuer dieselbe Konsistenz.
- `app/globals.css` — neue Klassen `.training-budget-breakdown*` und
  `.training-v2-reality-note` / `.player-training-controls-reality-note`, im
  bestehenden Dark-Theme-Stil (gleiche rgba-Tokens wie
  `.training-v2-attribute-forecast-card`).

Keine Aenderung an Balancing-Konstanten oder Berechnungslogik in
`lib/training/*` — reine Anzeige-/Beschriftungs-Schicht.
