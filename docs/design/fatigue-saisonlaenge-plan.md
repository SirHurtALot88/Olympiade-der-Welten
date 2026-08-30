# Designplan: Saisonlänge 20 Spieltage + Fatigue-/Verletzungs-Neuentwurf

Recherche-Stand: 2026-08-26, Repo `/home/user/Olympiade-der-Welten`, `main` lokal (HEAD `f05d1316`). Alle Datei-/Zeilenangaben sind gegen den echten Code geprüft. Stil/Struktur an `docs/design/liga-split-plan.md` angelehnt.

---

## 0. Wichtige Funde vorab

1. **Der Liga-Split ist bereits gebaut und aktiv** (`f51e6fb8`, `a84c0c33`): `LEAGUE_SIZE = 16` (`lib/season/league-split.ts:20`), zwei Ligen à 16 Teams, Fixture-Generator per Circle-Methode (`lib/season/season-fixture-schedule.ts`). Das ist zentral für Teil A: **eine Single-Round-Robin-Liga mit 16 Teams hat nur 15 eindeutige Runden** (`buildCircleRounds`, Zeile 71-96). Der Code kennt das Problem schon und warnt (`fixture_schedule_matchday_count_exceeds_rounds`, Zeile 136-140) und wickelt per Modulo um (Zeile 146: `roundIndex = (offset + index) % totalRounds`) — bei 20 Spieltagen träfe ein Team also mindestens 5 Runden **exakt doppelt** (gleiches Heim/Auswärts) auf denselben Gegner. Muss vor Aktivierung von 20 Spieltagen behoben werden (siehe A.3.1).
2. **Fatigue ist heute kein „langsam steigender" Wert, sondern ein Ratchet, der die Kappungsgrenze weit vor Saisonende erreicht und dort einfriert.** Wer nie rotiert wird, bekommt an KEINEM Spieltag Erholung (`applyFatigueAndInjuryAfterMatchday`, `lib/fatigue/fatigue-injury-service.ts:1175`: `if (usedPlayerKeys.has(usedKey) && !view.isUnavailable) continue;` — Einsatz-Spieler werden in der Recovery-Schleife komplett übersprungen). Mit `MATCHDAY_FATIGUE_LOAD = 16` (Zeile 147) erreicht ein Dauerspieler bei normaler Intensität die 100er-Kappung nach `⌈100/16⌉ = 7` Spieltagen — bei der heutigen 10-Spieltage-Saison sind das bereits **die letzten 3 Spieltage (30 %) komplett im Maximalrisiko-Band** (33 % Verletzungswahrscheinlichkeit pro Einsatz, `FATIGUE_INJURY_RISK_ANCHORS`, `lib/fatigue/fatigue-calibration.ts:82-88`). Das ist die exakte, im Code nachweisbare Ursache von Chris' „2. Saisonhälfte = Verletzungswelle unvermeidbar" — kein Bug, sondern eine mathematische Konsequenz aus „Last ohne jede Teil-Erholung fürs Spielen selbst".
3. **Würde man Teil A (20 statt 10 Spieltage) isoliert umsetzen, ohne Teil B anzufassen, würde sich das Problem NICHT halbieren, sondern verdoppeln**: Die Kappungsgrenze wird weiterhin absolut am 7. Spieltag erreicht (unabhängig von der Saisonlänge) — ein Dauerspieler verbrächte dann **13 von 20 Spieltagen (65 %) im Maximalrisiko-Band** statt 3 von 10. Teil A und Teil B müssen deshalb als EIN zusammenhängender Umbau geplant werden, Teil B idealerweise VOR oder GLEICHZEITIG mit der Aktivierung von Teil A.
4. **Rotation „funktioniert" heute schon — aber nur binär.** Eine volle Bankwoche gibt `BASE_MATCHDAY_RECOVERY = 28` (Zeile 180, modifiziert durch Reha-Ausbau `RECOVERY_FLAT_BONUS_BY_LEVEL = [0,4,8,13,18,24]`, `lib/facilities/facility-effects.ts:224`, und Trainingsmodus `TRAINING_RECOVERY_IMPACT`, `lib/training/training-recovery-impact.ts:12-34`) — das ist bereits MEHR als der Load eines Einsatzes (16). Wer sich Rotation leisten kann (Kadertiefe), hat also schon heute eine wirksame Stellschraube. Das Problem betrifft ausschließlich Teams/Spieler, die **nicht** rotieren (können) — für die gibt es aktuell buchstäblich keinen Mechanismus, der Fatigue jemals senkt, solange sie weiterspielen.
5. **Ein separater, additiver „Trainings-Fatigue"-Layer existiert bereits und skaliert automatisch korrekt mit der Saisonlänge**: `accumulateMatchdayTrainingProgress` (`lib/training/matchday-training-accumulator.ts:74-168`) addiert JEDEM Kaderspieler (egal ob eingesetzt, Bank oder verletzt) pro Spieltag `FATIGUE_LOAD_BY_MODE[mode] / totalMatchdays` (Zeile 138), mit `FATIGUE_LOAD_BY_MODE = {leicht:6, mittel:12, hart:22}` (`lib/training/training-mode-presentation.ts:24-28`). Da `totalMatchdays` aus `season.matchdayIds.length` gelesen wird (`resolveSeasonTotalMatchdays`, Zeile 67-72), halbiert sich der Pro-Spieltag-Anteil bei 20 statt 10 Spieltagen automatisch — der Saisonendwert bleibt gleich (z. B. 12 bei „mittel"). **Kein Codeeingriff nötig**, nur ein Regressionstest zur Absicherung.
6. **Finanzen/Sponsoring sind pro Saison, nicht pro Spieltag getaktet** — geprüft an `SPONSOR_WERTUNGSTOPF` (`lib/sponsor/sponsor-liga-leiter.ts:64`, Saison-Pauschale) und `applyFacilitySeasonEndFinance`/Unterhaltskosten (`lib/facilities/facility-season-end-service.ts`, ebenfalls Saison-Settlement). Eine Verdopplung der Spieltagszahl verdoppelt NICHT automatisch Einnahmen/Ausgaben — kein Handlungsbedarf hier, anders als in Chris' Sorge vermutet.
7. **Keine Formkurve im Code setzt „Disziplin kommt nur einmal pro Saison vor" strukturell voraus.** `playerDisciplinePerformances`/`buildPlayerSeasonPerformance` (`lib/foundation/player-season-performance.ts:233-380`) ist additiv (`appearances += 1` je gebuchtem Ergebnis) — ein zweites Vorkommen derselben Disziplin wird einfach mitgezählt und in die Durchschnittswerte eingerechnet, ohne Codeänderung. Die einzige echte „einmal pro Saison"-Bindung ist die **Spieleranzahl je Disziplin** (siehe A.2).

---

## Teil A — Saisonlänge: 20 Spieltage, jede Disziplin 2×

### A.1 Wie generiert `season-discipline-schedule.ts` heute den Spieltag→Disziplin-Plan?

`getRequiredSeasonDisciplineMatchdayCount()` (Zeile 165-167):
```ts
export function getRequiredSeasonDisciplineMatchdayCount(disciplines: Discipline[]) {
  return Math.max(1, Math.ceil(sortDisciplinesForSeasonSchedule(disciplines).length / 2));
}
```
Mit 20 Disziplinen (4 Kategorien à 5, verifiziert in `tests/season-discipline-schedule-v2.test.ts:11-18`) ergibt das `ceil(20/2) = 10`.

`buildSeededDisciplinePairs()` (Zeile 105-144) shuffelt die 20 Disziplinen EINMAL seeded (`shuffleSeeded`, seed `${saveId}:${seasonId}:season-setup-v3-balanced-slot-buckets`) und **poppt** sie paarweise vom Anfang der Liste (`available.shift()`) — jede Disziplin landet dadurch automatisch genau einmal in genau einem der 10 Spieltags-Slots; „keine Disziplin zweimal am selben Spieltag" ist dabei trivial erfüllt, weil der Pool erschöpft wird, nicht weil es eine explizite Prüfung gäbe.

`buildSeasonPlayerCountByDiscipline()` (Zeile 77-103) würfelt die Spieleranzahl **einmal pro Disziplin für die ganze Saison** (Map keyed nur nach `disciplineId`), mit einem Sonderfall für Kategorien mit genau 5 Disziplinen: dann wird `[2,3,4,5,6]` geshuffelt und 1:1 zugeteilt (Zeile 89-95) — das erklärt, warum heute in jeder der 4 Kategorien genau eine 2er-, eine 3er-, eine 4er-, eine 5er- und eine 6er-Disziplin existiert.

### A.2 Was muss sich ändern, damit jede Disziplin exakt 2× vorkommt?

1. **Neue Konstante** `SEASON_DISCIPLINE_REPEAT_COUNT = 2`, `getRequiredSeasonDisciplineMatchdayCount` wird zu `Math.ceil((disciplines.length * SEASON_DISCIPLINE_REPEAT_COUNT) / 2)` = `ceil(40/2) = 20`.
2. **Pairing-Algorithmus**: Statt eines 40-Elemente-Constraint-Solvers (self-pairing verhindern, Mindestabstand zwischen den zwei Vorkommen einhalten, weiterhin Spieler-Summen-Balance) empfiehlt sich, die BESTEHENDE, bereits getestete `buildSeededDisciplinePairs`-Logik **zweimal mit unterschiedlichen Sub-Seeds** aufzurufen — einmal für Spieltage 1-10 (Halbserie A), einmal für Spieltage 11-20 (Halbserie B, unabhängig neu geshuffelt). Jede Halbserie garantiert für sich schon „jede Disziplin genau einmal, keine Selbstpaarung". Übrig bleibt nur eine kleine Nahtstellen-Prüfung/-Reparatur an Spieltag 10/11 (falls eine Disziplin zufällig dort UND an Spieltag 1 landet o. ä., je nach gewünschtem Mindestabstand — Vorschlag ≥3 Spieltage zwischen den zwei Terminen derselben Disziplin, siehe offene Frage E.4). Das minimiert das Risiko gegenüber einem komplett neuen Solver und nutzt die vorhandene, spielerzahl-balancierte Logik zweimal.
3. **Spieleranzahl je Disziplin bei zwei Vorkommen**: `buildSeasonPlayerCountByDiscipline` liefert heute EINEN Wert pro `disciplineId` für die ganze Saison. Empfehlung: diesen Wert für BEIDE Vorkommen unverändert übernehmen (kleinstmögliche Änderung, konsistente Kaderplanung — ein Team weiß für die ganze Saison „Disziplin X braucht 4 Spieler", nicht zweimal unterschiedlich). Eine Variante mit zwei unabhängig gewürfelten Werten ist möglich, aber eine bewusste Zusatzentscheidung (siehe E.3).

### A.3 Abhängige Systeme, die mitgezogen werden müssen

1. **Liga-Split-Fixture-Generator (`lib/season/season-fixture-schedule.ts`)**: 16 Teams → nur 15 eindeutige Single-Round-Robin-Runden (Zeile 4-9 dokumentiert das selbst: „bei 10 von 15 möglichen Runden bleiben pro Saison 5 Gegner ungespielt"). Bei 20 Spieltagen reicht ein Single-Round-Robin nicht mehr aus — Modulo-Wrap (Zeile 146) würde Wiederholungen erzeugen, genau das, was der Generator laut eigenem Zweck vermeiden soll. **Empfehlung**: `buildCircleRounds` auf einen echten Doppel-Rundenplan erweitern (Hin-/Rückrunde, 2×(n-1) = 30 Runden für n=16, zweite Hälfte = gleiche Paare mit vertauschtem Heim/Auswärts). 20 von 30 Runden sind dann ohne echte Wiederholung erfüllbar. Da die Paarung laut `liga-split-plan.md` Abschnitt 5 ohnehin **keine Punkte** vergibt („Formel bleibt identisch"), ist das eine reine Anzeige-Korrektur, aber notwendig, bevor 20 Spieltage aktiviert werden — sonst zeigt der Spielplan-Tab ab Spieltag 16 sichtbar dieselbe Begegnung wie an Spieltag 1.
2. **`resolveSeasonTotalMatchdays`-Fallback = 10** (`lib/training/matchday-training-accumulator.ts:71`) und **`gameState.season.totalMatchdays ?? 10`** (`lib/foundation/game-flow-controller.ts:981`) — reine Fallbacks für unvollständige `matchdayIds`; skalieren korrekt, sobald `season.matchdayIds.length` tatsächlich 20 liefert, sollten aber per Test abgesichert werden, dass kein Pfad in Produktion den Fallback zieht.
3. **KI-„Endspurt"-Schwellen sind bereits relativ zu `totalMatchdays`** (z. B. `lib/ai/ai-legacy-lineup-batch-apply-service.ts:623,869,1310-1311`: `matchdayIndex >= Math.ceil(totalMatchdays * 0.7)`) — skalieren automatisch auf „ab Spieltag 14 von 20". Kein Zwang zum Codeeingriff, aber ein bewusster Review-Punkt: ein 6-Spieltage-Endspurt-Fenster bei 10 Spieltagen wird bei 20 zu einem 6-Spieltage-Fenster bei doppelter Basis — relativ identisch, absolut doppelt so lang. Ob das gewünscht ist, ist eine Produktentscheidung (siehe E.6).
4. **Hartkodierte Test-/Debug-Fixtures** mit `currentMatchday: 10` / `matchdayId: "matchday-10"` als „Saisonende" (`lib/season/season-points-prize-regression.ts:202-215`) müssen für ein 20-Spieltage-Modell aktualisiert werden, sonst simulieren sie ein Saisonende auf halber Strecke.
5. **`whole-season-dryrun-service.ts` / `lib/admin/season-simulation-runner.ts`**: iterieren generisch über `matchdayIds.length`, sollten aber nach der Umstellung einmal real gegen 20 Spieltage durchlaufen werden (Laufzeit verdoppelt sich, ggf. Timeout-Anpassung in Skripten/CI nötig).
6. **UI-Spielplan-Tab** (`app/foundation/ranks-v2/FoundationDiszisNewLook.tsx`) — nicht im Detail auf Layout-Kapazität für 20 statt 10 Zeilen geprüft in dieser Recherche (siehe offene Frage E.8).

### A.4 Scoring-/Balance-Implikation

Keine Formel im Rank-/Punktsystem (`lib/resolve/legacy-matchday-resolve-engine.ts`, `lib/resolve/rank-to-points.ts`) unterscheidet nach „erstes oder zweites Vorkommen" einer Disziplin — die Wertung eines Spieltags ist unabhängig davon, ob die Disziplin schon einmal vorkam. Sponsor-/Board-Objectives, die eine bestimmte Disziplin nennen (`lib/sponsor/sponsor-special-objectives.ts`, `lib/board/team-season-objectives-service.ts`), werden durch zwei Gelegenheiten pro Saison spürbar leichter erreichbar — eine Aufwertung, kein Bug, aber im Playtesting zu beobachten.

---

## Teil B — Fatigue-/Verletzungs-Neuentwurf

### B.1 Aktuelle Formel (mit Belegen)

- **Last je Einsatz**: `MATCHDAY_FATIGUE_LOAD = 16` (`lib/fatigue/fatigue-injury-service.ts:147`), skaliert je Intensität über `INTENSITY_FATIGUE_MULT = {conserve: 0.75, normal: 1.0, push: 1.4}` (Zeile 202-206) → effektive Last 12 / 16 / 22,4. Gilt **einmal pro Spieltag** pro Spieler, unabhängig davon, ob er in einer oder beiden Disziplinen antritt (Dedup in `collectMatchdayUses`, Zeile 694-720, nimmt bei Doppel-Einsatz die höhere Intensität, keine doppelte Last).
- **Erholung**: `BASE_MATCHDAY_RECOVERY = 28` (Zeile 180), modifiziert durch Reha-Ausbau (`RECOVERY_FLAT_BONUS_BY_LEVEL = [0,4,8,13,18,24]`, `lib/facilities/facility-effects.ts:224`) und Trainingsmodus (`TRAINING_RECOVERY_IMPACT`: leicht ×1,2, mittel ×1,0, hart ×0,75, `lib/training/training-recovery-impact.ts:12-34`). **Gilt ausschließlich für Spieler, die an diesem Spieltag NICHT eingesetzt wurden** (Bank oder verletzt/unavailable) — die Recovery-Schleife überspringt Einsatz-Spieler komplett (`fatigue-injury-service.ts:1175`).
- **Verletzte erholen sich wie Bankspieler**: `INJURY_RECOVERY_FACTOR = 1.0` (Zeile 500) — explizite Chris-Entscheidung gegen eine frühere Verletzungsspirale (0,5-Faktor führte zu 20 % Wiederholungstreffern bei praktisch gleicher Fatigue).
- **Trainings-Fatigue-Layer** (additiv, unabhängig vom Spieleinsatz): `FATIGUE_LOAD_BY_MODE = {leicht:6, mittel:12, hart:22}` (`lib/training/training-mode-presentation.ts:24-28`), verteilt über `totalMatchdays` (`matchday-training-accumulator.ts:138`), gilt für JEDEN Kaderspieler jeden Spieltag, egal ob eingesetzt, Bank oder verletzt, und wird NIE zurückgenommen (nur Modus-Wechsel verschiebt den Anteil, Zeile 144-148).
- **Verletzungsrisiko-Kurve**: `FATIGUE_INJURY_RISK_ANCHORS = [{0,0%},{25,0%},{50,3%},{80,25%},{100,33%}]` (`lib/fatigue/fatigue-calibration.ts:82-88`), linear interpoliert zwischen den Ankern. Schutzzone bis 25 (0 % Risiko) ist eine explizite, historisch begründete Chris-Entscheidung gegen „unberechenbare" Frühverletzungen.
- **Verletzungs-Zielkorridor**: „150–200 Verletzungen je Saison im Basisfall" (ohne Gebäude/Trainingsmodus-Hebel), festgehalten in `tests/injury-basisfall-korridor.test.ts` — **explizit für eine 10-Spieltage-Saison kalibriert** (Kommentar: „mit GENAU den Slot-Anforderungen … der echten 10 Spieltage").

### B.2 Diagnose: Warum „2. Saisonhälfte = unvermeidliche Verletzungswelle" wirklich passiert

Für einen Spieler, der **nie** rotiert wird (Dauerstarter), ist Fatigue ohne Bank-Erholung ein reiner Aufwärts-Ratchet: `fatigue(n) = min(100, 16·n)` bei normaler Intensität. Die Kappungsgrenze 100 wird bei `n = ⌈100/16⌉ = 7` erreicht — bei der heutigen 10-Spieltage-Saison sind das **die letzten 3 Spieltage (30 %)**, die er durchgehend im höchsten Risikoband (70-100, 25-33 % Verletzungswahrscheinlichkeit PRO EINSATZ) verbringt, ohne dass sich daran je etwas ändert, solange er weiterspielt. Das ist keine gefühlte, sondern eine deterministisch im Code angelegte Eigenschaft: **Spielen gibt niemals Erholung, nur Bankzeit tut das.** Bei einer unveränderten Übernahme dieser Formel auf 20 Spieltage würde sich dieses Fenster auf **13 von 20 Spieltagen (65 %)** verdoppeln — die Beschwerde würde sich verschlimmern statt lösen, wäre Teil A ohne Teil B umgesetzt.

### B.3 Rotation/Bank heute

Ein Bank-Spieltag erholt bereits heute mehr (28, vor Modifikatoren) als ein Einsatz kostet (16) — das Verhältnis begünstigt Rotation strukturell BEREITS. Das Problem ist nicht, dass Rotation zu schwach wirkt, sondern dass sie **binär** ist: Es gibt nur „ganz spielen" (niemals Erholung) oder „ganz Bank" (volle Erholung) — keine Zwischenstufe, in der ein Spieler, der WEITERSPIELT, trotzdem einen Teil natürlicher Erholung mitbekommt. Genau das erzeugt die von Chris beschriebene Erfahrung: Wer nicht rotieren kann (dünner Kader, kein Vertrauen in die Ersatzspieler, KI, die immer die Top-11 startet), hat **überhaupt keinen** Hebel — Fatigue kann für diese Spieler nur steigen, nie sinken, bis sie unweigerlich an der Kappungsgrenze festfrieren.

### B.4 Gegenentwurf: universelle Teil-Erholung

**Kernidee**: eine neue, für ALLE Spieler geltende Basis-Erholung einführen (auch für die, die an diesem Spieltag spielen), zusätzlich zur bestehenden Bank-Erholung. Aus dem heutigen Bank-Wert wird die Summe zweier Bestandteile:

```
BASE_MATCHDAY_RECOVERY (28, unverändert)
  = MATCHDAY_ACTIVE_RECOVERY (neu, Vorschlag: 11)
  + MATCHDAY_BENCH_BONUS_RECOVERY (neu, Vorschlag: 17)
```

Rein rechnerisch für Bankspieler bit-identisch zu heute (11+17=28) — reine Refaktorierung an dieser Stelle. NEU ist, dass `MATCHDAY_ACTIVE_RECOVERY` (11) künftig **auch** Einsatz-Spielern vor Anrechnung ihrer Last gutgeschrieben wird:

| Zustand | Rechnung | Netto/Spieltag |
|---|---|---|
| Einsatz normal | +16 (Load) − 11 (aktive Erholung) | **+5** |
| Einsatz schonen (conserve, Load 12) | +12 − 11 | **+1** |
| Einsatz pushen (Load 22,4) | +22,4 − 11 | **+11,4** |
| Bank/verletzt | −11 − 17 | **−28** (unverändert) |

**Konsequenzen, konkret durchgerechnet für eine 20-Spieltage-Saison:**
- Ein Dauerstarter bei normaler Intensität erreicht die Kappungsgrenze erst nach `100/5 = 20` Spieltagen — **genau am Saisonende**, nicht am 7. von 20. Die Fatigue-Bänder werden über die volle Saison durchlaufen (kein Risiko bis ca. Spieltag 5, minimal bis ca. 10, mittel bis ca. 14, stark bis ca. 16, sehr stark erst ab ca. 18) statt in den ersten 35 % komplett verbraucht zu sein.
- Ein Dauer-Pusher erreicht die Kappung nach `100/11,4 ≈ 9` Spieltagen — Pushen bleibt spürbar riskanter, aber als bewusste Wahl, nicht als Standardtempo.
- Ein alle zwei Spieltage rotierter Spieler hat einen mittleren Nettotrend von `(+5 − 28)/2 = −11,5`/Spieltag — seine Fatigue **sinkt** strukturell über die Saison, statt nur langsamer zu steigen. Rotation wird zu einer aktiven, planbaren Gegenstrategie statt einer bloßen Verzögerung.
- Schonen (conserve) wird bei +1/Spieltag fast eine Dauerlösung — ein echtes drittes Werkzeug zwischen „voll spielen" und „ganz aussetzen".

**Erfüllt Chris' drei Anforderungen direkt:**
1. *„Von Anfang an spürbar"* — schon Spieltag 1 kostet netto +5 (bzw. +11,4 bei Push); es gibt keine „ersten Spieltage sind gratis"-Zone.
2. *„Nicht so früh Verletzungen erzwingen"* — die Kappungsgrenze wird über die volle Saisonlänge gestreckt statt in den ersten gut 30 % erreicht.
3. *„Rotation lohnt sich spürbar"* — Bank bleibt bei −28 (5,6× stärker als der Normal-Load von +5 netto), Rotation kann Fatigue aktiv senken, nicht nur das Tempo drosseln.

**Facility-Interaktion (Empfehlung)**: `applyRecoveryFacilityModifiers` auf BEIDE Bestandteile anwenden (aktive Erholung UND Bank-Bonus), nicht nur auf den bisherigen Bank-Anteil. Das macht Reha-Investment für JEDEN Spieler wertvoller, nicht nur für Bankspieler — konsequente Fortführung von Chris' eigener Linie („man kann ja die Gebäude zur Erholung noch pimpen", zitiert in `fatigue-injury-service.ts:89`). Der Effekt bleibt dabei bewusst auf Teams beschränkt, die tatsächlich gebaut haben (`facility-effects.ts:214-217` dokumentiert genau dieses Korridor-Schutzprinzip) — reißt also den bestehenden Gebäudelos-Korridor nicht.

### B.5 Was bei 20 statt 10 Spieltagen zusätzlich zu beachten ist

- Der Trainings-Fatigue-Layer (B.1) skaliert bereits automatisch korrekt über `resolveSeasonTotalMatchdays` — nur mit Regressionstest absichern, keine Codeänderung nötig.
- `tests/injury-basisfall-korridor.test.ts` ist wörtlich für 10 Spieltage gebaut (Kader-/Slotdaten „der echten 10 Spieltage") und wird mit 20 Spieltagen ungültig — muss als eigene 20-Spieltage-Simulation neu aufgesetzt werden, NACH Einführung von `MATCHDAY_ACTIVE_RECOVERY`.
- `tests/fatigue-last-drei-stufen.test.ts` hält nur das **Verhältnis** der drei Intensitätsstufen fest (nicht absolute Werte) — bleibt gültig, sollte aber um eine Prüfung des neuen „Netto pro Spieltag je Stufe" ergänzt werden.

### B.6 Verletzungs-Korridor-Rekalibrierung

Weil das neue Modell die Kappungsgrenze über die GESAMTE Saison streckt statt in den ersten ~35 % zu erreichen, ist die zu erwartende Gesamtzahl an Verletzungen je Saison **nicht einfach proportional zur Spieltagszahl** — sie könnte trotz doppelter Spieltagszahl ähnlich bleiben oder sogar sinken, weil deutlich weniger Spieltage im Extremrisiko-Band (80-100) verbracht werden als heute. Der bestehende Korridor „150-200/Saison" (10 Spieltage, ohne Gebäude/Trainingsmodus-Hebel) kann nicht einfach verdoppelt werden — er braucht eine neue, mit Chris abgestimmte Zielgröße, gestützt durch einen erweiterten `scripts/export-injury-balance-audit.ts`-Lauf für 20-Spieltage-Saisons nach Einführung von `MATCHDAY_ACTIVE_RECOVERY` (siehe offene Frage E.1).

---

## Teil C — Kreuzabhängigkeiten zwischen Teil A und Teil B

- Teil B (Fatigue-Rekalibrierung) sollte **unabhängig von Teil A sofort umsetzbar und wertvoll sein** (behebt das Ratchet-Problem schon in der heutigen 10-Spieltage-Saison) — das entkoppelt das Risiko und liefert frühes Feedback vom Live-Save.
- Teil A (20 Spieltage) darf **nicht ohne** die Fatigue-Rekalibrierung aktiviert werden — sonst verdoppelt sich exakt das Problem, das Chris lösen will (B.2).
- Die maximale Kadergröße (aktuell 14, `FATIGUE_REST_FULL_DEPTH_SUBS = 2` in `lib/fatigue/fatigue-rest-propensity.ts:69`, gedacht als „zwei Verletzungen abfedern können") wurde für eine 10-Spieltage-Saison bemessen. Ob sie für eine doppelt so lange Saison mit potenziell mehr kumulierten Verletzungen mitwachsen muss, ist eine offene Frage (E.7).

---

## Teil D — Empfohlene PR-Reihenfolge (`main` bleibt jederzeit deploybar)

1. **PR1 — Fatigue-Fundament**: `MATCHDAY_ACTIVE_RECOVERY`/`MATCHDAY_BENCH_BONUS_RECOVERY` einführen, Bank-Pfad bit-identisch halten, Einsatz-Pfad neu (hinter ENV-Flag `OLY_FATIGUE_ACTIVE_RECOVERY`, Default aus = heutiges Verhalten). Nur Unit-Tests, kein Verhaltenswechsel im Default.
2. **PR2 — Korridor neu vermessen**: `scripts/export-injury-balance-audit.ts` um Season-Length-Parameter erweitern, Sweep für 10 UND 20 Spieltage mit/ohne aktiver Erholung, Ergebnis mit Chris abstimmen (E.1).
3. **PR3 — Aktivierung für die bestehende 10-Spieltage-Saison**: Flag-Default umstellen. Eigenständig wertvoll, liefert Live-Feedback unabhängig von Teil A.
4. **PR4 — Disziplin-Verdopplung**: `SEASON_DISCIPLINE_REPEAT_COUNT`, Zwei-Halbserien-Pairing, Mindestabstands-Reparatur — hinter Flag, nur unit-getestet, keine Spielwirkung.
5. **PR5 — Fixture-Generator auf Doppel-Rundenplan (30 Runden)**: notwendige Voraussetzung für 20 Spieltage ohne Wiederholungen, unabhängig testbar.
6. **PR6 — Aktivierung 20-Spieltage-Saison für NEUE Spiele**: Schalter analog zum Liga-Split-Vorbild (`isLeagueSplitActive`-Muster), Migration bestehender/laufender Saves explizit ausgeschlossen.
7. **PR7 — Aufräumen**: hartkodierte `matchday-10`/`currentMatchday: 10`-Testfixtures aktualisieren, `?? 10`-Fallbacks per Test absichern, KI-„Endspurt"-Fenster-Review (E.6).
8. **PR8 — UI/Spielplan-Kapazität + Migration Bestandssaves + Live-Abbild-E2E** (analog `scripts/e2e-liga-split-am-save-abbild.ts`-Vorbild).

---

## Teil E — Offene Fragen für Chris (echte Produktentscheidungen)

1. **Neuer Verletzungs-Zielkorridor — ENTSCHIEDEN (30.08.).** Chris: **(A) gleiche absolute
   Zielzahl (150-200/Saison) beibehalten**, auch bei 20 Spieltagen — Kurve wird flacher pro
   Spieltag nachjustiert. Präzisierung dazu: Fatigue soll insgesamt **schneller relevant werden**
   (früher spürbar) UND **schneller abgebaut werden können**, wenn rotiert wird/ein Spieler pausiert
   — beides gleichzeitig, nicht nur eine Richtung. Die KI muss diese schnellere Auf-/Abbau-Dynamik
   verstehen (Rotationsentscheidungen entsprechend anpassen), nicht nur der menschliche Spieler.
   Für B.6/PR2: die Zielmessung muss also nicht nur die Gesamtzahl treffen, sondern auch prüfen, ob
   sich Fatigue bei aktiver Erholung tatsächlich sichtbar schneller abbaut als heute.
2. Soll die Schutzzone der Risikokurve (0 % bis Fatigue 25) angetastet werden, oder reicht die neue Akkumulationskurve, um „von Anfang an spürbar" zu erfüllen? (Empfehlung: Kurve unverändert lassen — Chris hat die 25er-Schutzzone selbst explizit gegen frühe „unberechenbare" Verletzungen durchgesetzt; die Akkumulationskurve allein reicht, um das gewünschte Gefühl zu erzeugen.)
3. Gleiche Spieleranzahl bei beiden Vorkommen derselben Disziplin pro Saison, oder zwei unabhängig gewürfelte Werte? (Empfehlung: gleich, siehe A.2.)
4. **Mindestabstand zwischen den zwei Terminen derselben Disziplin — ENTSCHIEDEN (30.08.), anders
   als vorgeschlagen.** Kein fixer Mindestabstand in Spieltagen. Stattdessen harte Regel: **jede
   Disziplin muss einmal PRO SAISONHÄLFTE dran gewesen sein.** Beispiel: kam eine Disziplin an
   Spieltag 1 (erste Hälfte), ist ihr frühestmöglicher zweiter Termin Spieltag 11 (erste Spieltag
   der zweiten Hälfte). Kam sie erst an Spieltag 10 (letzter Spieltag der ersten Hälfte), darf sie
   trotzdem schon an Spieltag 11 wiederkommen — das ist explizit erlaubt, kein Sonderfall. Als
   optionale Ergänzung angedacht (noch nicht entschieden): zur Saisonhälfte eine Art „Pause"
   einbauen, die z. B. Verletzungen zurücksetzt — ausdrücklich OHNE Transfers in diesem Fenster.
   Damit wird der Fixture-Generator (PR5) nach der „einmal pro Hälfte"-Regel gebaut, nicht nach
   einem Abstands-Parameter.
5. Fixture-Generator auf echten 30-Runden-Doppelplan erweitern — bestätigen? (Empfehlung: ja, siehe A.3.1.)
6. **KI-„Endspurt"-Fenster — ENTSCHIEDEN (30.08.).** Chris: **(A) unverändert lassen**, wandert
   automatisch mit den 20 Spieltagen mit.
7. **Maximale Kadergröße — ENTSCHIEDEN (30.08.), Richtung geändert.** Chris: **(A) Kadergröße bleibt
   bei 14** — NICHT über die Kadergrenze skalieren. Stattdessen werden die Fatigue-Werte selbst
   angepasst: etwas höherer Verbrauch, besonders bei Verausgabung (sofern die Simulation das
   granular genug abbilden kann), dafür spürbar bessere Regeneration bei Pause/Rotation (konsistent
   mit Punkt 1 oben). Zusätzlich als Option geprüft werden soll: **Reservespieler für eine gezielte
   Auswechslung nominieren können** (z. B. um einen Star gezielt zu schonen), statt nur passiv über
   die Startaufstellung zu rotieren. Das ist die Fortführung von `MATCHDAY_ACTIVE_RECOVERY`
   (B.1-B.4), keine neue Kadermechanik nebenher.
8. UI-Kapazität des Spielplan-Tabs für 20 statt 10 Zeilen — in dieser Recherche nicht geprüft, separater Layout-Review vor PR8 nötig.

---

### Kern-Dateien für den Einstieg

- `lib/fatigue/fatigue-injury-service.ts` — Last/Erholung/Verletzungswurf, Kernstelle für `MATCHDAY_ACTIVE_RECOVERY`
- `lib/fatigue/fatigue-calibration.ts` — Risikokurve, Anker, Bänder
- `lib/training/matchday-training-accumulator.ts` — additiver Trainings-Fatigue-Layer
- `lib/training/training-recovery-impact.ts`, `lib/training/training-mode-presentation.ts` — Trainingsmodus-Modifikatoren
- `lib/facilities/facility-effects.ts` — Reha-Ausbau, Recovery-Modifikatoren
- `lib/season/season-discipline-schedule.ts` — Disziplin-Spieltag-Zuordnung, Kern für Teil A
- `lib/season/season-fixture-schedule.ts` — Liga-Split-Fixture-Generator, 15/30-Runden-Problem
- `lib/season/league-split.ts` — `LEAGUE_SIZE`, Schalter-Muster als Vorbild für einen neuen `SEASON_LENGTH`-Schalter
- `tests/injury-basisfall-korridor.test.ts`, `tests/fatigue-last-drei-stufen.test.ts` — bestehende Kalibrierungs-Guards, müssen mitgezogen werden
- `scripts/export-injury-balance-audit.ts` — Mess-Werkzeug für den neuen Korridor-Sweep
