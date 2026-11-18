# KI-Kaufverhalten und Finanzen — Analyse als Grundlage fürs Finanzkonzept (18.11.2026)

Auftrag: Code-Landkarte der KI-Kaufentscheidung, IST je Finanzklasse, Gehalt gegen Sponsor, Budget-Zufluss in Folgesaisons,
M-M-Anomalie, Optionen in Zahlen. **Reine Analyse, keine Spiellogik geändert.** Basis ist die Messung
`docs/design/finanzen-ist-messung-18-11.md` (32 KI-Teams, Läufe A/B/C, Battle). Neue Läufe gab es keine; nur eine Stammdaten-Sonde
(Neues Spiel ohne Draft, Wegwerf-SQLite, gelöscht).

Eigene Dateien: `scripts/lies-ki-kaufverhalten-stammdaten-18-11.ts` (Stammdaten, Identität, Sponsor-Anker je Team),
`scripts/auswerte-ki-kaufverhalten-18-11.mjs` (alle Tabellen unten), `scripts/rechne-ruecklagenkurve-18-11.mjs` (Abschnitt 6.1),
`scripts/pruefe-sponsor-mm-18-11.ts` (M-M-Beleg), Daten `data/generated/ki-kaufverhalten-{stammdaten,auswertung}-18-11.json`.

**Klassen** in dieser Doku: je Liga nach Startbudget, die obersten 5 von 16 = reich, die nächsten 6 = mittel, die untersten 5 = arm
(Liga 1: Budget 305–325 / 275–300 / 250–270; Liga 2: 225–245 / 195–220 / 170–190). Budgets und Ligazuordnung sind in allen drei
Läufen identisch (geprüft).

---

## 0. Kurzfassung

1. **Der S1-Draft läuft über den „organischen Kaderbauer", nicht über die Regelwerke mit Ausgabekorridor.** Die Spend-Corridors
   (`season1-draft-spend-policy.ts`, `getSeason1SpendCorridor` mit 0,93–1,0 Ausgabe) gehören zum Legacy-Pfad (`OLY_ORGANIC_SQUAD_BUILDER=0`).
   Im Spiel entscheidet `lib/ai/organic-squad/draft-builder.ts` und seine Rücklage ist **5 C flach** (`draft-adapter.ts:61`). Das erklärt
   die Messung (Cash nach Draft 5–13 C, Median 6,6, bei **jeder** Klasse 2–4 % des Budgets).
2. **Die Gehalts-Rücklage (0,35 × Gehalt, `draft-adapter.ts:125`) wirkt in S1 nie**, weil sie gegen das Gehalt des *Start*-Kaders gerechnet wird
   (`draft-adapter.ts:436-439`) — und der ist in S1 leer. In Folgesaisons greift sie, aber gegen den ausgedünnten Kader (7–8 statt 11–12 Spieler).
   Das ist die Stellschraube Nr. 1 für Chris' Rücklagen-Vorgabe.
3. **Der Sponsor ist in S1 schon VOR dem Draft unterschrieben** (`new-game-setup-service.ts:648`) und sein Erwartungswert (`terms.anchor`)
   steht fest — der Draft liest ihn aber nirgends. Der Forecast der organischen Planung bekommt `sponsorIncome = 0` (alle drei Aufrufer lassen
   `forecast` weg). Damit lässt sich Chris' „Gehalt am Sponsor orientieren" mit vorhandenen Daten bauen.
4. **Sponsor gegen Gehalt: Liga 1 unterdeckt, Liga 2 überdeckt.** Median Sponsor/Gehalt Liga 1 **0,87**, Liga 2 **1,11**. In Liga 1 liegt die
   Klasse „arm" bei **0,70** (14 von 15 Team-Läufen unter 1,0), „mittel" 0,93, „reich" 1,09. Ursache: das Gehalt folgt dem Budget (Gehalt ≈ 0,27 ×
   Budget), der Sponsor folgt dem Startrang. Die Wiederholungs-Überzieher: N-N, V-D, H-R, W-W (je 3 von 3 Läufen unter 0,9).
5. **Das Kaufbudget der Folgesaison ist die Ablöse der auslaufenden Verträge** (`contract-renewal-service.ts:1666`, zum Verkaufspreis des
   Marktwerts) plus KI-Verkäufe — zusammen +2000…+2800 C je Saison, also das 8- bis 12-fache der Startkasse. GuV und Sponsor sind keine Quelle
   (Σ GuV −72…+98). Es ist ein **geschlossener Kreislauf aus Spielerkapital**, kein Wachstum. Er ist ungerecht verteilt (Cash zu S2-Beginn 45–172 C).
6. **Das Geld, das nach der S2-Kaufphase liegen bleibt (1599–1952 C), ist sehr wahrscheinlich das Budget des noch ausstehenden Kader-Auffüllens**
   (fehlende 81–117 Spieler × Ø 20,8 = 1684–2436 C). Hochrechnung, nicht gemessen — die Messung endet vor dem Auffüllen.
7. **M-M-Ursache gefunden: Messartefakt, kein Fehler für KI-Teams.** M-M ist im Preset `solo_1` das *menschliche* Team; der Setup überspringt
   manuell gesteuerte Teams beim Sponsor-Signieren (`sponsor-offer-service.ts:1336`). Das Messskript stellt danach auf „alle KI" um, ohne einen
   Sponsor nachzuholen. Das Gehalt wird trotzdem abgebucht (`sponsor-settlement-service.ts:179`). Latent echt ist nur der Randfall „Team wechselt
   Mensch → KI nach Spielstart" (Abschnitt 5, Patch-Vorschlag).
8. **Vorstand heute: zu schwach als Strafe.** Ziele zahlen/kosten 2–10 C je Ziel, im Mittel Σ +88…+99 C über 32 Teams. Das S1-Finanzziel verlangt
   15–30 C Cash-Reserve (`board-objectives-config.ts:55-57`), der Draft lässt 5–13 — das Ziel ist gegen das eigene Draftverhalten gebaut.
9. **Rücklage allein löst das Gehaltsproblem nicht.** Rechenbeispiel (6.1): reich 20 %, mittel 12 %, arm 7 % Cash-Anteil senkt das Gehalt um
   3–18 %, hebt Liga-1-„arm" aber nur von 0,70 auf 0,78. Dafür braucht es zusätzlich einen Sponsor-Deckel (6.2).

---

## 1. Code-Landkarte der KI-Kaufentscheidung

Pfeile: **→ Schraube** = Konstante/Formel, an der Chris' Vorgabe (18.11.) ansetzen würde. Risiko in der letzten Spalte.

### 1.1 Welche Engine läuft überhaupt

| Stelle | Tut heute | Hinweis |
|---|---|---|
| `lib/ai/ai-picks-run-service.ts:3787` | `useOrganicSquadBuilder = OLY_ORGANIC_SQUAD_BUILDER !== "0"` — Standard AN. Der S1-Draft (`fuehreLigaSetupDraftAus`, `lib/game/league-setup-draft-service.ts:179`) und der Setup-Draft der Preseason laufen darüber (`runOrganicTeamDraftExecute`, Z. 2951; Aufruf Z. 3040 ohne `forecast`). | Die Legacy-Dateien (`season1-draft-spend-policy.ts`, `season1-draft-cash-planner.ts`, `getSeason1SpendCorridor` in `ai-needs-picks-compare-service.ts:2297`, `ai-cash-salary-target-service.ts`) sind im Normalbetrieb **nicht** der Draft-Entscheider. Wer dort dreht, ändert nichts. |
| `lib/ai/ai-transfer-window-session-service.ts:452` (`runOrganicBuyCycle`), `:340` (`runOrganicSellCycle`), `:477` (Aufruf Plan, ebenfalls ohne `forecast`) | Kauf- und Verkaufsrunde der Folgesaison, derselbe Planer `planOrganicDraftForTeam`. Verkauf nur am Saisonende, Kauf nur in der Preseason. | `ai-cash-salary-target-service.ts` (Soft-Target 0,25–0,75 × Gehalt, Hard-Cap 1,0 ×) wird vom organischen Pfad **nicht gelesen** (kein Import in `lib/ai/organic-squad/`). Gemessen: Cash/Gehalt nach der S2-Kaufphase Median 1,0–1,7, also über dem „Hard-Cap" ohne Wirkung. |

### 1.2 Draft S1 und Kaufphase Folgesaison (organischer Kaderbauer)

| Stelle (Datei:Zeile) | Tut heute | Schraube | Risiko |
|---|---|---|---|
| `organic-squad/draft-adapter.ts:61` `ORGANIC_CASH_BUFFER = 5` | Flache Mindest-Rücklage, zugleich Untergrenze zwischen Kader-Minimum und -Opt (`:591` `solvencyFloor`). | **→ Schraube A:** `solvencyFloor` nach Budget-Klasse (arm ≈ 5–10 % des Startbudgets, reich 15–25 %) statt 5 flach. | Kader-Schrumpfung: der Floor gilt zwischen Min (8) und Opt; ein zu hoher Floor stoppt Reiche bei 8–9 Spielern. Beim Gehalts-Deckel (`OLY_SALARY_CEILING_V2`) hat genau das die Kader schrumpfen lassen (unter Opt: 23 statt 18 von 32 Teams, A-A 12→8 Spieler) und Verletzungen um 8 % erhöht (Kommentar `:104-117`). Nur mit A/B-Lauf. |
| `draft-adapter.ts:125` `RESERVE_SALARY_FACTOR = 0.35`, `:436-439` `cashBuffer = max(5, 0.35 × Gehalt des STARTKADERS)` | Rücklage wächst mit der Gehaltssumme — aber der Startkader ist in S1 leer (→ 5) und in S2 ausgedünnt (Ø 7–8 Spieler, Gehaltssumme Σ 1258/1292 statt ~2130). | **→ Schraube B:** `projectSalaryAtPlannerTarget` (`lib/ai/salary-projection.ts:27`, wird schon für Apron genutzt) statt `resolveRosterSalaryTotal`. Das macht die Rücklage in S1 und S2 zu „0,35 × Gehalt des Ziel-Kaders". Bei Gehalt 78 → 27 C statt 5 C. | Mittel. Reiner Parameter, aber er wirkt auf Verkaufsdruck mit (`cashHealth = cash / cashBuffer`, `utility.ts` ~Z. 570) — mehr Rücklage heißt mehr Verkaufsdruck für überbezahlte Teams. Beabsichtigt, aber messen. |
| `organic-squad/draft-builder.ts:149` `optFillFloor`, `:214` `reserveForMin`, `:225` `affordFloor = belowMin ? 0 : belowOpt ? optFillFloor : cashBuffer` | Dreistufige Untergrenze: unter Min (8 Spieler) **0** — wer Min erreichen muss, gibt alles aus; zwischen Min und Opt der flache Floor; ab Opt die volle Rücklage. Kommentar `:212-222` nennt das Absicht („die Reserve muss auch mal ausgegeben werden, kann später aufgefüllt werden"). | Das *ist* die Quelle der 5–13 C. Soll ein Reicher 15–25 % behalten, muss auch die Stufe „unter Min" den Klassen-Floor kennen (abzüglich `reserveForMin`) — sonst gibt er vor Min 4 Stars aus und der Floor greift zu spät. | Hoch an dieser Stelle: harte Regel „Min 8 muss erreichbar bleiben" (`stoppedBelowMin`). Änderung nur, solange `reserveForMin` den billigsten Min-Auffüller weiter reserviert. |
| `draft-builder.ts:278` `stopUtility(state) >= bestUtility` mit `stopUtility = wPatience × cashOptionValue` (`utility.ts:616`, `cash-option-value.ts:19-26`) | Weich: das Team hört auf zu kaufen, wenn „Cash halten" mehr Nutzen hat als der beste Kauf. Eingänge: Abstand zur Rücklage, `forecast.sustainabilityMargin`, `boardRisk`, Kader-Fülle. | `wPatience` hängt an `identity.finances` und Vorstandsdruck (`weights.ts:125`: `0,35 + financesN × 0,5 + (1 − boardPressureN) × 0,25`). **Das ist der „Finanz-Vorsicht-Trait" im Spiel** — er wirkt nur als Gewicht, nicht als Ausgabekorridor. Gemessen: Korrelation Cash-nach-Draft ↔ Finanzen nur +0,27, ↔ Budget 0,00. | Gering bis mittel; Gewichte sind Jitter-gestreut (`weights.ts` ~Z. 209). |
| `draft-adapter.ts:581-584` `forecast.{expectedPrize, sponsorIncome, facilityNet, netTransfer} ?? 0`; Aufrufer `ai-picks-run-service.ts:3040`, `ai-transfer-window-session-service.ts:477, 858` übergeben keinen | Die Cash-Prognose (`cash-flow-forecast.ts:34`) rechnet `Cash − Gehalt + 0`, kennt den Sponsor nicht. Je mehr Gehalt der Kader trägt, desto negativer der „Bleed" — ein eingebauter, aber sponsor-blinder Bremsweg. | **→ Schraube C (Kern für Chris' Sponsor-Vorgabe):** `forecast.sponsorIncome = 0,92 × terms.anchor` des signierten Vertrags (S1: vor dem Draft bekannt) bzw. letzte Saison-Auszahlung (S2+: `estimateTeamAnnualRevenue`, `loan-service.ts:204`). Dann bremst das Team von selbst, wenn Gehalt > Sponsor. | Gering technisch (3 Aufrufstellen). Das Gewicht des Bleed-Terms (`W_BLEED = 0.35`) bestimmt, wie hart; vermutlich zu schwach allein — siehe 6.2. |
| `draft-adapter.ts:117` `SALARY_CEILING_V2_ENABLED` (Standard **AUS**), `salary-ceiling.ts` `computeTeamSalaryCeiling` | Weiche Obergrenze der Gesamtgehaltssumme = tragbares Gehalt (Sponsor − Fixkosten) + Risiko-Spielraum nach Teamwert × Ambition. Fertig gebaut, abgeschaltet nach A/B (Kader schrumpft). | **→ Schraube D:** der Grund der Abschaltung ist erkennbar: in S1 liefert `estimateTeamAnnualRevenue` nur die **Basis-Komponente** des Vertrags (`loan-service.ts:236-237`), also ca. 47–51 % der erwarteten Auszahlung (G-G: Basis 60,6 von 119,4; Z-H: 47,2 von 100,7 am Startrang). Der Deckel war in S1 damit rund halb so hoch wie nötig. Mit `terms.anchor × 0,92` statt Basis wäre das Modell neu zu messen, bevor man es verwirft. | Mittel. Muss wieder mit dem Long-Run (`scripts/long-run-sandbox-s1-s6.ts`) A/B-gemessen werden (Kader, Verletzungen, rho der Wertung nicht betroffen). |
| `draft-adapter.ts:446` `planOrganicDraftForTeam`, Vorab-Plan der Rollen (`COMPOSE_ENABLED` Z. 101, Standard AN) | Soll-Pyramide (Star/Core/Depth) als weicher Nutzen-Zuschlag; Superstar-Lizenzen über `spendableNet = cash − 5` (Z. 541, 551). | `spendableNet` mit der neuen Klassen-Rücklage statt `− 5`, sonst plant die Pyramide mit Geld, das das Team gar nicht ausgeben soll. | Gering. |
| `ai-preseason-background-service.ts:190` (Setup-Draft-Modus) / `:294` (Season-Market-Modus) | S1: erst Manageraktionen, dann Draft je Team, dann Training. Folgesaison: alle Manageraktionen in einer Runde (Gebäude, Strategie), danach Markt; zwei Kreditdurchgänge (Z. 296ff, `ai-transfer-window-session-service.ts:885`). | Reihenfolge ist relevant: **Gebäude und Kredite kommen vor bzw. neben dem Kauf**, das Budget teilen sich Gebäude, Kauf und Rücklage in einem Topf (1.5). | — |

### 1.3 Reserve-/Cash-Regelwerke, die im organischen Pfad **nicht** entscheiden (Legacy, trotzdem lesen)

| Datei:Zeile | Inhalt | Wo es dennoch wirkt |
|---|---|---|
| `ai-cash-salary-target-service.ts:49-63` | Soft-Target `0,25 + finances/10 × 0,5` (0,25–0,75 × Gehalt), Hard-Cap 1,0 (S2–S3) bzw. 0,75/1,0 (+0,05/0,10 ab S4) | Reserve-Rechnung des Managers (`ai-team-cash-reserve-service.ts:109`) und Legacy-Draft. |
| `season1-draft-spend-policy.ts:130-207`, `season1-draft-cash-planner.ts:11,117` | Ausgabekorridor 0,85–1,0 des Budgets je Archetyp; Cash-Cap 1,25 × Gehalt; Ziel-Restcash = min(Korridor-Rest, Gehalt × Puffer, Cap). Beachte: `ai-needs-picks-compare-service.ts:2547` ruft `buildSeason1DraftSpendPlan` mit `finances: undefined`, der Finanz-Trait fällt dort also aus der Rechnung. | Nur bei `OLY_ORGANIC_SQUAD_BUILDER=0`. Eine Rücklagenkurve in diesen Dateien wäre wirkungslos. |
| `ai-team-cash-reserve-service.ts:109-235` (`resolveTeamCashRunwayReserve`, `resolveCombinedLiquidityReserve`) | Gehalts-Runway + Wartungs-Polster, unter Opt auf 45 % gekürzt. | **Manager-Eimer** (1.5): Gebäude-/Transferbudget. |

### 1.4 Sponsorwahl der KI

| Stelle | Tut heute | Schraube | Risiko |
|---|---|---|---|
| `lib/game/new-game-setup-service.ts:648` → `chooseSponsorOfferForAiTeams` (`sponsor-offer-service.ts:1314`) | S1: alle KI-/passiven Teams signieren das beste ihrer **3 Angebote** *vor* dem Draft. Manuell gesteuerte Teams werden übersprungen (`:1336`). Folgesaisons: `preseason-workflow-service.ts:838`, ebenfalls vor der Kaufphase. | Reihenfolge ist richtig für Chris' Vorgabe (Sponsor zuerst, dann Kader). | — |
| `sponsor-offer-service.ts:1031` `scoreOfferForAi` (Anker `terms.anchor`, Achsen-Fit, Kurven-Fit mit `SPONSOR_AI_CURVE_FIT_WEIGHT = 3` Z. 856, Laufzeit, Gebäude-Leihe); `:732` `resolveAiSponsorArchetypePreference` (security / performance / identity nach `cashPressure`, `cashPriority`, `starPriority`) | Wählt nach Wert und Passung. **Kein Term kennt das spätere Gehalt** (Kader in S1 leer, `rosterSize = 0`); `cashPressure` ist in S1 für alle gleich (3), weil jedes Team 170–325 Cash hat. | Ein Term „Passung zum erwarteten Gehalt" ≈ `0,27 × Budget` (gemessen, Korrelation 0,25 / mit Ambition 0,56). Wer viel Gehalt erwartet (hohe Ambition, hohes Budget), nimmt die höhere Karte. | Gering; Wahl bleibt deterministisch je (Saison, Team). |
| `lib/sponsor/sponsor-liga-leiter.ts:57` `SPONSOR_AUSSCHUETTUNG = 1,1`; `season-economy-factors.ts:63,107` Faktor-Wurf 0,82–1,24 | Höhe der Auszahlung = Sockel(Startrang) + Wertungstopf × Saison-Faktor × Ligafaktor (0,6 / 0,4) × Gewicht(Endrang) (Details Messdoku 5.1). Der Faktor wirkt nur auf den Wertungstopf. | Chris will „Sponsor bleibt an Gehälter gekoppelt, Saison-Faktor wirkt darauf": ist so gebaut; die Kalibrierung `1,1` zielt auf Σ Sponsor ≈ Σ Gehalt der Liga (Messlauf damals 84 % bei 1,0). | Der Mittelwert des Wurfs ist 1,03, nicht 1,1: strukturell ca. 92–96 % Deckung (Abschnitt 4.3). |

### 1.5 Kredit und Gebäude

| Stelle | Tut heute | Schraube | Risiko |
|---|---|---|---|
| `ai-loan-decision-service.ts:298` `season_one_no_loans` | S1 hart ohne Kredite. | — (gewollt: S1-Reichtum kommt aus dem Budget). | — |
| `ai-loan-decision-service.ts:53, 60, 22, 28` (`LOAN_NEED_FILL_FRACTION 0,3`, `LOAN_AMOUNT_FILL_FRACTION 0,7`, Laufzeit 2–10, Standard 4); Liquiditäts-Kredit bei Cash < 0 (`:333ff`) | Folgesaison: Kredit nur bedarfsgetrieben (Kader < Opt + Cash-Lücke) und nur gegen einen **geprobten Kaufplan** (`ai-transfer-window-session-service.ts:819-885`, Aufschlag 1,3), zwei Durchgänge. Gemessen: 6 bzw. 9 Teams, Σ Restschuld 211/249 C. | Kreditdeckel relativ zum Sponsor (Schuldendienst ≤ x % des Sponsors) — Konstanten `DEBT_SERVICE_FLOOR_*` Z. 106-108, `TERM_PRUDENCE_FRACTION` Z. 136 stehen schon. | Kredite sind heute der Puffer der Armen (Ausgleich in S2); wer sie kappt, muss die Rücklage (A/B) liefern. |
| `ai-team-management-preview-service.ts:660-780` (Eimer), `:245` `AI_RESERVE_SHARE_OF_CASH_CAP = 0.6`, `:253-258` `REBUILD_BUILDING_*` (arme 8 Teams 0–5 C, Reiche bis 25 C, +4 % je Saison) | Manager teilt Cash in Reserve / Gehalt-Runway / Wartung / Notfall und teilt den Rest nach `buildingBias` 0,31+ gegen `transferBias` 0,28+; unter Opt zählt nur der Rebuild-Deckel. Die Reserven dürfen höchstens 60 % des Kontos binden. | Gebäude-Eimer vom Sponsor-Überschuss abhängig machen: `resolveTeamSeasonSponsorSurplus` (Z. ~748) ist schon die richtige Größe, gilt aber nur über Opt. | Gebäude sind klein (Stufe 1: 5–13 C, Unterhalt 0,4–0,8) — gemessen Σ 276–293 C Investition bei 22–23 Teams, Unterhalt Σ 26–48 C = 1–2 % der Gehälter. Kein Hebel für das Gehaltsproblem. |
| `lib/facilities/facility-upgrade-service.ts:156` `season_upkeep_unpaid_risk` | Warnung, kein Block. | — | — |

### 1.6 Vorstand / Board

| Stelle | Tut heute | Schraube | Risiko |
|---|---|---|---|
| `lib/board/board-objectives-config.ts:55-57`, `team-season-objectives-service.ts:975-1020` | S1-Finanzziel: „Cash-Reserve halten", Ziel = `clamp(10 % Budget, 15, 30)` (Liga 1: 25–30 C, Liga 2: 17–24 C); Belohnung +3 C, Strafe −2 C, Vertrauen +0,25/−0,35. Der Draft lässt 5–13 C, das Ziel ist also gegen das Draft-Verhalten gebaut. | Ziel-Höhe = Rücklagenkurve (6.1) aus *einer* Quelle ziehen. | Gering. |
| `team-season-objectives-service.ts` (Belohnungen Z. 355, 601-602, 684, 734, 775, 1059-1060, 1180, 1226, 1412, 1451, 1510); `objective-settlement-cash-source.ts` | Je Ziel +2…+12 C / −1…−10 C und `boardConfidenceDelta` ±0,15…0,6. Gemessen Σ über 32 Teams +99 / +93 / +88, je Team −4…+8 (≈ ±5 % des Gehalts). | Vorstands-Strafe skalieren (6.3). | Heute kein Geldhebel. |
| `foundation/gm-pressure-behavior.ts`, `organic-squad/weights.ts:117-125`, `draft-adapter.ts:~440` (`boardRisk = 1 − normId(boardConfidence)`) | Der Vorstand wirkt über **Vertrauen → GM-Druck → Kaufgewichte** (`wWin`, `wPatience`, `W_BOARD 0,2` im Cash-Nutzen). Es gibt Hot-Seat-Verhalten, aber keinen Geld-Eingriff. | Die Kopplung Vertrauen → Budget ist die fehlende Strafe (6.3). | Mittel (Wirkungskette lang). |

### 1.7 Geldquellen und -senken (für Abschnitt 4)

| Stelle | Rolle |
|---|---|
| `contract-renewal-service.ts:1666`, `:938` `buildContractExitValue` | Vertragsablauf KI: Spieler geht in den Pool, Team bekommt den Verkaufspreis (Marktwert × Verkaufsabschlag, „ein Vertragsende ist ein Verkauf", Chris). **Geldschöpfung.** |
| `ai-transfer-window-session-service.ts:340` `runOrganicSellCycle`, Quelle `ai_organic_squad_sell` | KI-Verkäufe am Saisonende; Netto = 82–87 % der Gebühr (1190→993, 939→814, 831→683): **Geldvernichtung durch Abschlag** ≈ 160–200 C/Saison. |
| `ai-transfer-window-session-service.ts:452`, Quelle `ai_preseason_market_buy`, `ai_roster_fill`, `ai_injury_depth_topup` | Käufe aus dem Pool: **Geldvernichtung** (Preis geht an niemanden). |
| `sponsor-settlement-service.ts:149-263` | Sponsor am Saisonende + Gehaltsabzug (`:179`, immer, auch ohne Vertrag). |
| `cash-flow-forecast.ts:1-12` | Preisgeld ist „BENCHMARK-ONLY": fließt nie ins Cash. Keine Quelle. |

---

## 2. IST je Finanzklasse (aus den Messdaten)

Cash nach Draft, gepoolt A/B/C (je Zeile n = 15–18 Team-Läufe); S2 nur B und C (A unsauber, siehe Messdoku 4.5; n = 10–12).

| Liga / Klasse | Budget (Ø) | **Cash nach Draft** Median (Min–Max) | in % Budget | Gehalt (Median) | Cash/Gehalt | Cash zu S2-Beginn | **Cash nach S2-Kaufphase** (Min–Max) | Kader S2 vor → nach | Teams mit Kredit |
|---|---:|---|---:|---:|---:|---:|---|---|---|
| L1 reich | 315 | 6,9 (5,0–12,3) | 2,2 | 88,6 | 0,08 | 90,1 | 66,1 (14,4–101,6) | 8,1 → 9,1 | 2 / 10 |
| L1 mittel | 288 | 6,3 (5,1–13,5) | 2,2 | 79,7 | 0,08 | 82,6 | 54,6 (4,4–80,7) | 7,6 → 9,1 | 3 / 12 |
| L1 arm | 260 | 6,1 (5,2–13,5) | 2,4 | 67,6 | 0,09 | 77,0 | 57,4 (3,6–91,6) | 7,2 → 8,2 | 3 / 10 |
| L2 reich | 235 | 6,3 (5,1–11,1) | 2,8 | 63,6 | 0,10 | 90,7 | 72,3 (41,0–87,9) | 6,9 → 7,6 | 3 / 10 |
| L2 mittel | 208 | 7,3 (5,0–12,4) | 3,5 | 54,7 | 0,14 | 80,9 | 59,8 (3,4–84,9) | 6,9 → 8,5 | 3 / 12 |
| L2 arm | 180 | 6,9 (5,2–11,1) | 3,8 | 47,5 | 0,15 | 69,8 | 50,5 (26,9–63,9) | 6,9 → 8,0 | 1 / 10 |

Verteilung aller 96 Team-Läufe nach dem Draft: ≤ 5,5 C 18 Teams, 5,5–8 C 45, 8–10 C 21, > 10 C 12; Maximum 13,5. Kader 8–14, Median 12. Cash über alle Kader
größen praktisch konstant (7,0–7,9 C, nur der 14er-Kader 8,8).

**Lesart.**
* **Es gibt heute keine Klassen-Differenzierung.** Reiche und Arme halten 6–7 C; in Prozent sieht es nur bei Armen größer aus, weil ihr Budget klein ist.
  Der Boden 5 C wirkt als Fixpunkt (18 Teams liegen auf 5,0–5,5). Chris' Zielbild „reich 15–25 %, arm 5–10 %" ist damit **nirgends** im Code abgebildet.
* **Der Finanz-Trait wirkt kaum**: Korrelation Cash-nach-Draft ↔ `identity.finances` +0,27, ↔ `ambition` −0,20, ↔ Budget 0,00. Das Gehalt dagegen folgt Ambition
  (Korrelation Gehalt/Budget ↔ Ambition **+0,56**, ↔ Finanzen −0,30; Median Gehalt/Budget 0,269, GM-Archetyp `risk_gambler` 0,293, `facility_architect` 0,243).
* **Cash nach der S2-Kaufphase** liegt mit Median 50–72 C (Min 3,4) weit über dem S1-Niveau — das ist das Ablöse-Geld (Abschnitt 4), nicht Rücklage. Niemand steht im
  Minus, aber auch niemand hat einen vollen Kader.
* Die reichen Teams haben nach der Kaufphase die **höchste** Kasse, die armen mit Kredit die niedrigste (Mindest 3,4–4,7 C).

---

## 3. Gehalt gegen gewählten Sponsor (Saison 1, je Team)

Sponsor = GuV-Zeile „Sponsor" der Saison-1-Abrechnung, Gehalt = `getTeamActualSalaryTotal` nach dem Draft. n = 93 Team-Läufe (M-M ohne Sponsor ausgenommen).

**Verteilung Sponsor/Gehalt:** P10 0,70 · P25 0,84 · **Median 1,02** · P75 1,18 · P90 1,36. Unter 1,0: 41 von 93; unter 0,8: 21; über 1,2: 20.
Histogramm: < 0,7 → 10 · 0,7–0,85 → 16 · 0,85–1,0 → 15 · 1,0–1,15 → 26 · 1,15–1,3 → 14 · > 1,3 → 12.

| Liga / Klasse | n | Median Sponsor/Gehalt | Σ Sponsor / Σ Gehalt | Gehalt Median | Sponsor Median | unter 1,0 |
|---|---:|---:|---:|---:|---:|---:|
| Liga 1 reich | 12 | 1,09 | 1,14 | 81,1 | 93,7 | 4 |
| Liga 1 mittel | 18 | 0,93 | 0,93 | 79,7 | 73,1 | 10 |
| **Liga 1 arm** | 15 | **0,70** | **0,72** | 67,6 | 50,5 | **14** |
| Liga 2 reich | 15 | 1,15 | 1,09 | 63,6 | 72,4 | 5 |
| Liga 2 mittel | 18 | 1,10 | 1,16 | 54,7 | 55,5 | 3 |
| Liga 2 arm | 15 | 1,10 | 1,08 | 47,5 | 50,9 | 5 |
| Liga 1 gesamt | 45 | **0,87** (Σ je Lauf 0,89–0,97) | | | | 28 |
| Liga 2 gesamt | 48 | **1,11** (Σ je Lauf 1,07–1,16) | | | | 13 |

Abweichung zur Messdoku: dort stehen „1,05 (Liga 1) / 1,01 (Liga 2)" (Abschnitt 5.3). Mit denselben Rohdaten kommt hier 0,87 / 1,11 heraus; die Aussage
„41 von 93 decken ihr Gehalt nicht" stimmt überein, die Ligaaufteilung nicht. Bitte diese Doku für die Liga-Zahlen zitieren.

**Wer überzieht und warum.**
* *Gehalt folgt dem Budget und der Ambition, Sponsor folgt dem Startrang.* Gehalt ↔ Sponsor-Anker nur 0,59, Sponsor ↔ Anker 0,77. In Liga 1 haben die
  budgetschwächsten Teams (250–270) ein Gehalt von Ø 67,6 — ein Liga-2-Spitzenwert — (V-D: Startrang 16, Anker nur 46,6).
* Dauer-Überzieher (unter 0,9 in 2–3 von 3 Läufen): **N-N** (Gehalt ~80, Sponsor 44–50, Quote 0,56–0,63, Finanz 2,9), **V-D** (Quote 0,58–0,67, Finanz 2,9),
  **H-R** (Ambition 8,8, Finanz 2,1), **W-W**, N-W, P-S, S-C, T-T, V-V, Z-H (Gehalt 100, Sponsor 70, Ambition 10, Finanz 2,0), B-B, R-L, T-G. Das Muster:
  *niedriger Finanz-Wert (≈ 2–3) oder hohe Ambition*; Korrelation Quote ↔ Finanzen **+0,37**, ↔ Ambition −0,17, ↔ Gehalt −0,30, ↔ Budget −0,16.
* *Der Sponsor ist schlechter als sein Anker verspricht:* gezahlt wird im Median das **0,92-fache** des Ankers (`terms.anchor`, Erwartungswert des gewählten Sponsors am Startrang).
* *Hätte ein Deckel „Gehalt ≤ k × 0,92 × Anker" gegriffen?* (n = 93; „Kappung" = Gehalt über Deckel, in C):

| k | Team-Läufe über Deckel | davon Liga 1 | Kappung Median | Kappung Σ (93 Team-Läufe) |
|---:|---:|---:|---:|---:|
| 0,9 | 69 | 39 | 8,7 | 874 |
| **1,0** | **41** | 30 | 12,1 | 539 |
| 1,1 | 28 | 26 | 11,4 | 352 |
| 1,2 | 22 | 21 | 8,9 | 217 |
| 1,3 | 15 | 15 | 8,7 | 124 |

  Heißt: bei k = 1 wären es genau die 41 Unter-1,0-Fälle. Die Liga 2 braucht praktisch keinen Deckel (13 von 41 Fällen), Liga 1 schon.

---

## 4. Budget-Zufluss in der Folgesaison

### 4.1 Gemessen (Läufe B und C sauber; A nur bis zum Vertragsablauf)

| Σ 32 Teams | A | B | C |
|---|---:|---:|---:|
| Startbudget Σ (konstant) | 7920 | 7920 | 7920 |
| Σ Marktwert der Kader nach Draft | 7676 | 7682 | 7692 |
| Σ Kasse nach Draft | 244 | 238 | 228 |
| GuV Σ Saison 1 (Sponsor + Ziele − Gehälter) | +98 | −72 | +10 |
| **Vertragsablauf (Ablöse)** Spieler / C | 59 / +1244 | 79 / +1574 | 70 / +1796 |
| **KI-Verkäufe** netto (Gebühr brutto) | +993 (1190) | +814 (939) | +683 (831) |
| Σ Kasse zu S2-Beginn | 2579 | 2554 | 2717 |
| S2-Kaufphase (Marktkäufe + Not-Käufe) | (unsauber) | −378 *(12+13 Käufe)* | −919 *(34+16 Käufe)* |
| Σ Kasse nach Kaufphase | — | 1952 | 1599 |
| Σ Marktwert + Σ Kasse nach Kaufphase („Vermögen") | — | 7575 | 7536 |

Zu den Quellen siehe 1.7. **Fazit der Messung:** praktisch das gesamte Kaufbudget stammt aus dem Spielerkapital (Ablöse 16–21 % der Kader laufen aus, im Schnitt 20–26 C je Spieler;
Verkäufe 61–74 Spieler). GuV und Sponsor liefern ±0. Die Preise der Käufer im Pool bezahlen niemanden — **dieselbe Geldmenge wird ausgegeben, wie vorher aus dem Spielerbestand freigesetzt wurde.**

### 4.2 Ist das gewollt und stabil?

* **Ja als Prinzip** („ein Vertragsende ist ein Verkauf", Chris, Kommentar `contract-renewal-service.ts:910`): wer Spieler verliert, bekommt ihren Wert und kauft neu. Das Kaufbudget
  der Folgesaison ist also das **Kapital der Spieler, die ausliefen oder verkauft wurden**.
* **Stabilität:** ja bei der Geldmenge (Σ geschlossen), **nein bei der Verteilung.** Cash zu S2-Beginn Min 45–48, Median 81–82, Max 150–172 C; Cash/Gehalt (S1) Min 0,48–0,54, Max 2,3–2,7.
  Wer viele auslaufende Verträge hat, bekommt viel Geld — unabhängig von Leistung, Sponsor oder Gehalt. Ein Team mit lauter langen Verträgen hat in dem Jahr kein Kaufbudget.
* **Verluste im Kreislauf:** Das „Vermögen" (Marktwert + Cash) sinkt von 7920 auf 7536–7575 (−4,4 bis −4,9 %). Davon sind rund 160–200 C der Verkaufsabschlag (1.7);
  der Rest ist Marktwert-Neubewertung und Kreditkosten (nicht einzeln gelesen).
* **Das liegenbleibende Geld ist Kaufbudget für den noch ausstehenden Roster-Fill (Hochrechnung):** nach der Kaufphase fehlen bis zum Median-Kader 11,5 noch
  117 (B) bzw. 81 (C) Spieler; zu Ø-Marktwert 20,8 sind das 2436 bzw. 1684 C — fast genau die verbleibenden Σ-Kassen 1952 / 1599. Das Auffüllen wurde nicht mitgemessen (Messdoku 4.5).

### 4.3 Hochrechnung über mehrere Saisons (Hochrechnung, nicht gemessen; aus Code-Formeln und den Messwerten)

* **Sponsor-Saison-Faktor** wirkt linear: `Auszahlung = Sockel(Startrang) + Topf × Faktor × …` (Messdoku 5.1). Aus den drei S1-Läufen (Faktor 1,02 / 1,08 / 1,18 → Deckung 92 / 96 / 100 %) folgt
  grob **+1000 bis +1150 C Σ-Sponsor je +1,0 Faktor**. Bei dem im Code gleichverteilten Wurf 0,82–1,24 (`season-economy-factors.ts:63`, Mittel 1,03) heißt das **Deckung ≈ 81–103 %,
  im Mittel ≈ 92–94 %, also strukturell −130 bis −170 C GuV je Saison für die Liga** (bei Σ Gehalt ≈ 2130). `SPONSOR_AUSSCHUETTUNG = 1,1` (`sponsor-liga-leiter.ts:57`) gleicht das nur zum Teil aus.
* **Gehalt der Folgesaison:** nach der Kaufphase 1346 / 1536 C bei Kader 7,8 / 9,0; hochgerechnet auf 11,5 Spieler **≈ 1960–1990 C** (Messdoku 4.5). Gegen einen Σ-Sponsor von 1950–2140 liegt die Deckung wieder bei ≈ 100 %, solange der Faktor ≥ 1,0 ist.
* **Vermögen über 5 Saisons:** bei gleichbleibendem Abschlag (≈ 2–2,5 % des Σ-Vermögens je Saison) und GuV ≈ −1 % wären es −10 bis −17 % Σ-Vermögen nach fünf Saisons, *wenn* Spieler-Entwicklung (Marktwert-Zuwachs) das nicht ausgleicht. Das ist die offene Variable; sie ist der Grund,
  eine **explizite Zuflussquelle** (6.4) zu definieren statt den Kreislauf stillschweigend schrumpfen zu lassen.
* **„Folgesaisons laufen von selbst besser" — geprüft:** *Cash:* ja (kein Team im Minus nach der S2-Kaufphase, Cash/Gehalt Median 1,0–1,7; in S1 standen 9–11 von 32 Teams nach der GuV im Minus).
  *GuV:* nur, wenn der Faktor hoch ausfällt (Lauf B mit S2-Faktor 0,92 liefe auf ~85 % Deckung). Heißt: die Entspannung ist ein **Ablöse-Effekt**, keine Selbstbalance der Wirtschaft.

---

## 5. M-M-Anomalie (kein Sponsor in S1)

**Beleg** (`scripts/pruefe-sponsor-mm-18-11.ts`, Neues Spiel Battle/solo_1, **kein Draft**, Wegwerf-SQLite): nach dem Setup haben 31 von 32 Teams einen S1-Sponsorvertrag, **M-M hat 3 Angebote, aber keinen Vertrag** und keine
Settlement-Zeilen; G-G und Z-H zum Vergleich haben Basis + Rang-Zeilen. Es liegt also nicht an Angebotsgenerierung, Rang oder Draft.

**Ursache, mit Zeile:**
1. `lib/game/new-game-setup-service.ts:142` — Preset `solo_1` = `chrisTeamIds: ["M-M"]`: M-M ist im Setup das **menschliche, manuell gesteuerte** Team.
2. `lib/game/new-game-setup-service.ts:648` ruft `chooseSponsorOfferForAiTeams`; die Funktion überspringt `controlMode === "manual"` (`lib/sponsor/sponsor-offer-service.ts:1336`, „nur das menschliche Team wählt selbst").
3. Das Messskript (`scripts/miss-teamfinanzen-saison.ts`, Battle-Zweig nach dem Draft) stellt per `applyGameModeOwnership(gs, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] })` auf „alle KI" um — ohne die ausgefallene Sponsorwahl nachzuholen. Ab dann ist M-M KI, aber vertragslos.
4. Das Gehalt wird trotzdem abgebucht: `lib/sponsor/sponsor-settlement-service.ts:179` („Gehalt wird IMMER abgezogen, auch ohne Vertrag", Audit R2/V2). Deshalb zahlt M-M das höchste Gehalt (budgetstärkstes Team, ~100 C) ohne Sponsor und endet bei ≈ −100.
5. In S2 hat M-M wieder einen Sponsor (die Messdaten listen ihn unter den S2-Verträgen mit Faktor 1,18): `preseason-workflow-service.ts:838` ruft `chooseSponsorOfferForAiTeams` für alle nun-KI-Teams.

**Ist es ein Bug?** Für das Spiel nicht im Normalfall: ein echtes menschliches Team muss vor dem Saisonabschluss einen Sponsor wählen (Gate `season-completion-service.ts:233` blockiert mit `manual_sponsor_choice_pending`).
Es ist ein **Messartefakt**, das alle M-M-Zahlen der Messdoku betrifft (Sponsor 0, GuV, Kasse, Apron-Rang 11). Real vorhanden ist nur der Randfall: ein Team, das *nach* dem Setup von Mensch auf KI wechselt
(Raum-Umverteilung `lib/room/room-store.ts:1220, 1396, 1435` über `applyGameModeOwnership`), bleibt in der laufenden Saison vertragslos, zahlt Gehalt und das Gate `season-completion-service.ts:233` prüft nur noch manuelle Teams — es wird also
nichts erzwungen und nichts nachgeholt.

**Minimaler Fix (Patch-Text, nicht eingespielt).**

(a) Messskript (der Auslöser dieser Messung) — Besitz VOR dem Draft setzen und Sponsor nachziehen:

```diff
--- a/scripts/miss-teamfinanzen-saison.ts
+++ b/scripts/miss-teamfinanzen-saison.ts
+import { chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
@@ if (!RESUME) { ... nach applyNewGameSetup, VOR fuehreLigaSetupDraftAus
+    if (MODE === "battle") {
+      const alleKi = applyGameModeOwnership(get().gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] });
+      persistence.saveSingleplayerState(saveId, chooseSponsorOfferForAiTeams(alleKi));
+    }
     const dr = await fuehreLigaSetupDraftAus({ ... });
@@ nach dem Draft den bisherigen MODE === "battle"-Block ersatzlos streichen
```

(b) Härtung im Spiel (Randfall Mensch → KI): im Aufrufer, nicht in `applyGameModeOwnership` selbst (Importzyklus Sponsor ↔ Team-Control wurde nicht geprüft):

```diff
--- a/lib/room/room-store.ts   (Z. 1220-1226, ebenso 1396 / 1435)
-  const updatedGameState = applyGameModeOwnership(save.gameState, { saveMode, chrisTeamIds, frankyTeamIds });
+  const updatedGameState = chooseSponsorOfferForAiTeams(
+    applyGameModeOwnership(save.gameState, { saveMode, chrisTeamIds, frankyTeamIds }),
+  );
```

`chooseSponsorOfferForAiTeams` ist idempotent (Teams mit Vertrag werden übersprungen, `sponsor-offer-service.ts:1328`); das menschliche Team bleibt unberührt.

**Test-Vorschlag** (`tests/sponsor-ki-uebernahme.test.ts`, Muster `tests/new-game-setup-service.test.ts`):
1. `previewNewGameSetup`/`applyNewGameSetup` mit `solo_1`, Battle → Erwartung: `getTeamSponsorContract(gs, "M-M") === null`, alle anderen 31 haben einen (dokumentiert das heutige Setup-Verhalten).
2. `applyGameModeOwnership(gs, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] })` dann `chooseSponsorOfferForAiTeams` → Erwartung: 32 von 32 Verträgen und `previewSponsorSettlement(gs).warnings` ohne `M-M:sponsor_contract_missing`.
3. Regression: ein Team, das manuell bleibt, bekommt auch nach dem Aufruf keinen Vertrag (Wahl bleibt beim Menschen).

---

## 6. Optionen in Zahlen (nur Vorschläge, Entscheidung beim Konzept-Schreiber / Chris)

### 6.1 Rücklagenkurve nach Budget-Klasse (S1-Cash nach dem Draft)

Chris' Vorgabe: reich 15–25 % Cash, arm 5–10 %. Rechenbeispiel mit **Annahme Gehalt ∝ Draft-Ausgabe** (gemessen: Gehalt ≈ 0,277 × Marktwert ≈ 0,27 × Budget; Sponsor bleibt, weil er am Startrang hängt — optimistisch, denn schwächere
Kader enden schlechter und verlieren Wertungsanteil). Skript `scripts/rechne-ruecklagenkurve-18-11.mjs`:

| Liga / Klasse | Budget | Cash IST (Anteil) | **Ziel-Anteil** → Cash | Gehalt IST → neu | Sponsor/Gehalt IST → neu | Cash/Gehalt neu |
|---|---:|---|---|---|---|---:|
| L1 reich | 315 | 6,9 (2,2 %) | **20 %** → 63 | 81,1 → 66,3 | 1,09 → 1,41 | 0,95 |
| L1 mittel | 288 | 6,3 (2,2 %) | **12 %** → 34,5 | 79,7 → 71,7 | 0,93 → 1,02 | 0,48 |
| L1 arm | 260 | 6,1 (2,3 %) | **7 %** → 18,2 | 67,6 → 64,4 | 0,70 → **0,78** | 0,28 |
| L2 reich | 235 | 6,3 (2,7 %) | **20 %** → 47 | 63,6 → 52,3 | 1,15 → 1,38 | 0,90 |
| L2 mittel | 208 | 7,3 (3,5 %) | **12 %** → 24,9 | 54,7 → 49,9 | 1,10 → 1,11 | 0,50 |
| L2 arm | 180 | 6,9 (3,8 %) | **7 %** → 12,6 | 47,5 → 45,9 | 1,10 → 1,11 | 0,27 |

Lesart: Die Kurve **15–25 / 5–10 trifft die Falschen**. Die Reichen werden zu vorsichtig (Quote 1,4, Cash fast ein ganzes Jahresgehalt), die Armen bleiben mit 0,78 unterdeckt. Für „Puffer nötig, weil Gehälter gestiegen" reicht eher eine
**Gehalts-Kopplung**: Rücklage ≈ 0,25–0,5 × Zielgehalt (0,35 ist im Code schon die Konstante, Schraube B). Das ergibt bei Gehalt 68–90 etwa 17–32 C — nahe an „mittel/arm 7–12 %" und bei Reichen 31 C (≈ 10 %) statt 63.
Vorschlag als Option: **Rücklage = max(Klassen-Anteil, 0,35 × Zielgehalt)** mit Klassen-Anteil reich 10 % / mittel 8 % / arm 6 %; Chris' obere Werte (15–25 %) nur für „sparsame" Reiche (Finanz-Trait ≥ 7).

Umsetzung (nur Parameter, Reihenfolge nach Risiko): B (Zielgehalt statt Startkader-Gehalt, `draft-adapter.ts:436`) → A (`solvencyFloor`, `:591`, Klassen-Floor) → Stufe „unter Min" im Builder (`draft-builder.ts:225`) nur wenn A nicht reicht. Messung danach: `scripts/miss-teamfinanzen-saison.ts` (Lauf C komplett) plus Long-Run für Kadergröße/Verletzungen; die Arena-Wertung selbst ist nicht berührt
(trotzdem `pruefe-wertung-fingerabdruck.mjs` vor dem Merge laufen lassen).

### 6.2 Gehaltsdeckel relativ zum Sponsor (mit „aggressiv"-Ausnahme)

Bezugsgröße: `terms.anchor` des gewählten S1-Sponsors × **0,92** (gemessener Realisationsgrad). In S2+ stattdessen die letzte Saison-Auszahlung × Faktor-Ausblick (Vorbild: `lib/sponsor/sponsor-salary-factor-outlook.ts`).

| Archetyp | Deckel k (Gehalt ≤ k × 0,92 × Anker) | Wer | Wirkung (aus der Tabelle in 3) |
|---|---:|---|---|
| vorsichtig | 1,00 | `finances ≥ 6` oder GM `bargain_hunter`/`culture_keeper`/`depth_spammer` (Gehalt/Budget 0,25–0,27) | trifft alle 41 Fälle, Median-Kappung 12 C |
| normal | 1,10 | Rest | 28 Fälle, Median 11 C |
| **aggressiv** | **1,25 bis 1,30** | `ambition ≥ 8` oder GM `star_chaser`/`risk_gambler` oder Budget-Klasse reich + Ambition ≥ 7 | 15 Fälle, Median 9 C; Rest wird vom Vorstand verfolgt (6.3) |

Umsetzung: bevorzugt **weiche Obergrenze im organischen Kaderbauer** (wie `SALARY_CEILING_V2`, `draft-builder.ts:232`), gespeist mit `terms.anchor × 0,92 × k` statt der Basis-Komponente (Schraube D) — und ein zusätzlicher Bleed-Term über `forecast.sponsorIncome` (Schraube C), damit das Team *vor* der Grenze
schon zurückhaltender kauft. **Wichtig:** der Deckel greift erst über Kader-Min (`salaryCeilingActive = !belowMin`, `draft-builder.ts:232`), Min 8 bleibt immer erreichbar. Die abgeschaltete Version hat die Kader schrumpfen lassen (23 statt 18 von 32 Teams unter Opt);
Gegenmaßnahme: Deckel an den Zielkader hochrechnen, nicht an den aktuellen, und ihn **nicht** unter ~1,0 × Sponsor ansetzen.

### 6.3 Vorstands-Strafe

Heute: ±2…10 C je Ziel, Vertrauen ±0,15…0,6 (1.6). Optionen:
* **Gehaltsgebundene Strafe:** je verfehltem *Rang-/Finanz*-Ziel 3–4 % des Gehalts (≈ 2,5–4 C bei Gehalt 70–90 statt 2) — verdoppelt die heutige Wirkung, immer noch klein; nur sinnvoll **zusammen** mit einem Hebel auf das Budget:
* **Budget-Hebel (empfohlen):** der Kaufspielraum der Folgesaison skaliert mit dem Vorstandsvertrauen: Rücklagen-Mindestquote ± (5 − Vertrauen) × 1,5 % des Gehalts-Ziels bzw. aggressive Teams dürfen den Deckel 6.2 nur bei Vertrauen ≥ 5 ausreizen; fällt es unter 3 → Deckel k = 1,0.
  Anschluss ist vorhanden (`boardRisk` im Cash-Nutzen `W_BOARD 0,2`, `resolveGmPressureBehavior`).
* Das S1-Finanzziel an die Rücklagenkurve koppeln (heute 15–30 C fix, `board-objectives-config.ts:55-57`) und die Belohnung für Rang-Übererfüllung (Z. 601: max 12 C) als *Gehalts-Bonus* auszahlen, damit „Erfolg rechtfertigt Gehalt" gilt.

### 6.4 Quelle des Budget-Zuflusses

Heute: Ablöse + KI-Verkäufe (geschlossen, ungleich verteilt). Optionen:
1. **Belassen** und die Ungleichheit mildern: Ablöse-Faktor an Leistung/Startrang koppeln (Rubberband wie beim Sponsor-Sockel: schwaches Team 1,0 × Marktwert, starkes 0,92 ×) — Σ −2…−4 %, Verteilung gerechter.
2. **Explizites Kaufbudget als Vorstandszuschuss:** `Zuschuss = Gehalt-Ziel × 0,05–0,15 × f(Vertrauen)` zu Saisonbeginn, aus Σ-Quelle „Liga-Topf" gespeist durch den Verkaufsabschlag (heute ≈ 160–200 C/Saison vernichtet, Σ-Topf-Größe passt).
3. **Sponsor-Sockel für Kaufbudget öffnen** (Sockel 19,8–52,8 C ist nur am Saisonende fällig): Teilauszahlung zu Saisonbeginn würde Kredit-Bedarf senken (Messdoku 6.3: Startkasse ≈ 7 C reicht nicht für Spieltagsraten) — verschiebt Geld, schafft keines.
4. Preisgeld ins Cash (derzeit „BENCHMARK-ONLY", `cash-flow-forecast.ts:3`): größter Eingriff, ändert die Geldmenge; nicht ohne Gesamtmessung.

Entscheidungsfrage an Chris: *soll die Geldmenge über die Saisons konstant bleiben (Option 1/3), oder darf sie mit Erfolg wachsen (Option 2/4)?*

---

## 7. Offene Punkte und Grenzen

* **Kein Mehrsaison-Lauf.** Abschnitt 4.3 ist Hochrechnung; Saison 2 wurde nicht gespielt, das Auffüllen der Kader (und damit die Gehaltssumme S2) nicht gemessen.
* **Lauf A** ist ab der Kaufphase unsauber (OOM-Neustart): Klassen-Zahlen zu S2 nur aus B und C (n = 10–12 je Zeile).
* **Sponsor-Anker nur S1.** Stammdaten stammen aus einem frischen Spiel (Sponsor-Angebote sind je (Saison, Team) deterministisch, die Ankerwerte stimmen also mit den Läufen überein; die Realisationsquote 0,92 ist über alle 93 Team-Läufe gemessen).
* **Vorstandsziel-Status je Team** (wie viele S1-Finanzziele wirklich scheiterten) wurde nicht einzeln aus dem Beleg gelesen; „Ziel ist gegen das Draft-Verhalten gebaut" ist aus Konstanten (Ziel 15–30 vs. Cash 5–13) abgeleitet.
* **„Bug B"** (S1-Kader-Rücklage, laut Auftrag früher gefixt) ist im Repo unter diesem Namen nicht auffindbar; die einschlägigen Kommentare sind `draft-builder.ts:212-222` („Reserve muss auch mal ausgegeben werden") und `draft-adapter.ts:104-117`.
* **Hoch-/Tiefwirkung auf die Wertung:** die Rücklagen-/Deckel-Optionen verändern die Kaderstärke (Rang → Sponsor-Wertungsanteil) und damit die Ligabilanz. Vor einem Bau braucht es A/B mit Kaderstärke je Klasse und Rang-Verteilung;
  die Arena-Wertung selbst ist nicht berührt (Fingerabdruck unverändert).
