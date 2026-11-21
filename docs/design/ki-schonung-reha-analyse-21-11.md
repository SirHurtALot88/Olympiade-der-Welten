# KI-Schonung, Rotation, Reha — Analyse (21.11.)

Auftrag (Chris, 21.11., wörtlich): „die anzahl verletzungen passt erstmal, du musst auch bedenken dass wir die season länge
verdoppelt haben! und man könnte verletzungen reduzieren wenn spieler etwas mehr geschont werden, KI kann ja auch mehr spieler
picken oder schonen statt aggressiv oder normal im einsatz zu nutzen, das könntest du auch mal tracken was da genutzt wird und
was im training, es gibt ja methoden das zu senken + gebäude! dann muss die KI vllt doch mal in reha investieren zb“

**Reine Analyse, keine Spiellogik geändert.** Messwerkzeug: `scripts/miss-ki-belastungsverhalten.ts` (liest eine KOPIE des
Live-Abbilds, schreibt nichts). Stand: Spielstand `new-game-1795114260527-nzr0z9`, Saison 1, 11 gebuchte von 20 Spieltagen
(aktuell Spieltag 12), 31 KI-Teams plus D-P (Mensch), 2766 Einsätze, Live-Abbild vom 21.11.

## 1. Kernaussagen

1. **Die Verletzungen sind kein Streuphänomen, sie sitzen in wenigen Teams.** 90 KI-Verletzungen bei 2681 Einsätzen (3,36 %),
   Hochrechnung auf 20 Spieltage 164 für die 31 KI-Teams (5,3 je Team) — im Korridor 150–200, Chris' „passt“ stimmt. Aber:
   **5 von 31 KI-Teams (P-S, B-P, R-L, Z-H, H-R: Kader 9–10, Push-Anteil 41–71 %) tragen 43 von 90 Verletzungen (48 %).**
   Teams mit 11 und mehr Spielern liegen bei 0–5. Korrelation mit der Verletzungsrate je Einsatz: Kadergröße −0,70, Push-Anteil +0,76,
   Anteil Einsätze mit Fatigue ≥ 65 +0,92.
2. **Die KI schont über die Intensität praktisch nie.** „Schonen“ gibt es nur an Spieltag 1–2 (63–71 % der Seiten, Regel
   `isWeakDisciplineWindow`), wo alle frisch sind (Risiko 0 unter Fatigue 25, also ohne Wirkung auf Verletzungen). **Ab Spieltag 3 ist der
   Schonen-Anteil 0,0 %.** Der einzige fatigue-getriebene Zweig (`avgSideFatigue >= Deckel + 15`) hängt hinter `wantsPush` und feuert nie.
   Zum Vergleich schont der Mensch D-P 47 % seiner Einsätze.
3. **Push ist der größte einzelne Hebel.** 22 % der KI-Einsätze sind Push, Verletzungsrate 5,7 % gegen 3,2 % bei Normal und 0 % bei
   Schonen; Push stellt 39 % der erwarteten Verletzungen. **67 % aller Push-Seiten haben einen Kapitän** (`wantsPush` enthält `hasCaptain`):
   Kapitän-Seiten pushen zu 75 %, Seiten ohne zu 7,6 % (ab Spieltag 3). Der Push-Deckel (`OLY_AI_PUSH_FATIGUE_CEILING`, 65, gemessen am
   Seiten-Durchschnitt VOR dem Spieltag) greift zu spät: Push-Einsätze laufen im Mittel mit Fatigue 42,9 am Wurf, 16 % davon bei ≥ 65.
4. **Rotation ist nicht das Problem der großen Kader, sondern der dünnen.** KI-Kader Ø 11,8 bei Ø 8,0 Plätzen je Spieltag (4–12):
   die Einsatzquote 67,8 % liegt auf dem rechnerischen Gleichgewicht (q* = 67,1 %). Nur 5,2 % der Einsätze starten über Fatigue 50 — und bei
   71 % davon gab es keinen ≥ 15 Punkte frischeren, gesunden Ersatz, weil der Kader zu klein ist (4 Teams mit 9 Spielern, 3 mit 10; Mindestkader 8,
   Spitzenspieltage verlangen 12).
5. **Training reagiert bereits auf Erschöpfung, bringt aber wenig.** KI: 74 % leicht, 9 % mittel, 16 % hart; bei Fatigue > 50 sind 85–100 % leicht
   (bei < 25: 30 % hart). „Alle leicht“ senkt die erwarteten Verletzungen nur um 10 %, „leicht ab 50“ um 4 %: die Wirkung hängt an der Bank-Erholung
   (× 1,2), und gespielt wird zu viel.
6. **Reha: kein einziges Gebäude steht, bei keinem der 32 Teams.** `facilityEvents` 0, keine Leihgaben. Die KI baut nur in der Preseason
   (`preseason_facilities`; `midseason_check` ist read-only), und der Recovery-Center-Score speist sich aus Vorsaison-Verletzungen und -Fatigue
   (`prevSeasonInjuryCount`, `prevSeasonAvgMatchdayFatigue`) — in Saison 1 sind beide 0. **Reha wirkt aber am stärksten: Stufe 1 −33 %, Stufe 2 −55 %,
   Stufe 3 −70 %** erwartete Verletzungen (gleiche Einsätze). Kosten kumulativ 7 / 20 / 42 C (plus Unterhalt 0,7 / 1,2 / 2,1 je Saison). KI-Cash heute:
   Median 17,4; 29 von 31 Teams könnten L1 zahlen, 12 L2, keines L3 (mit 10 C Puffer: 16 bzw. 3).
7. **Schonen ist billig.** Mittlere Intensitäts-Scorekosten: Schonen −2,5, Push +4 je Spieler und Einsatz (`INTENSITY_SCORE_RANGE`). „Seite schonen ab
   Seiten-Ø Fatigue 30“ kostet −0,38 Score je Einsatz im Schnitt (bei Spielerwerten um 100–150 unter 0,4 %) und senkt die erwarteten Verletzungen um 38 %.

## 2. Wie viel würde es senken (Formelrechnung, gleiche Einsatzmengen)

Nachrechnung der Fatigue-Konten aus den aufgezeichneten Einsätzen (Last 16 × Trait × Intensität, aktive Erholung 4,5, Bank 28 × Trainingsmodus plus Reha);
Baseline 75,4 erwartete Verletzungen gegen 85,1 laut Würfen (−11 %, wegen der Trainingsschicht, die als Offset je Spieltag mitläuft). Prozentwerte sind
relativ zur Baseline. Folgetage verletzter Spieler und Gegner-Anpassungen sind nicht modelliert (das unterschätzt die Wirkung eher). Nur KI-Teams, 11 Spieltage:

| Maßnahme | Verletzungen | gegen Baseline | Score-Kosten je Einsatz |
|---|---:|---:|---:|
| Baseline | 75,4 | 0 % | — |
| Seite schonen, wenn Seiten-Ø Fatigue > 30 | 46,7 | −38 % | −0,38 |
| Seite schonen, wenn Seiten-Ø Fatigue > 40 | 63,7 | −16 % | −0,15 |
| Seite schonen, wenn Seiten-Ø Fatigue > 50 | 72,3 | −4 % | −0,04 |
| Spieler schonen ab Fatigue > 40 (je Spieler, nur Vergleich) | 49,0 | −35 % | −0,33 |
| Push-Deckel je Seite: nur bei Seiten-Ø ≤ 30 (heute 65) | 60,2 | −20 % | −0,19 |
| Push-Deckel ≤ 30 plus Schonen ab Seiten-Ø > 40 | 55,4 | −26 % | −0,25 |
| Kein Push mehr (Obergrenze) | 31,6 | −58 % | −0,88 |
| Rotation: Starter > 40 gegen ≥ 10 Punkte frischeren Ersatz (96 Tausche) | 57,3 | −24 % | Eignung, nicht bepreist |
| Rotation: Starter > 50 gegen ≥ 15 Punkte frischeren Ersatz (39 Tausche) | 67,6 | −10 % | Eignung, nicht bepreist |
| Reha Stufe 1 für alle | 50,2 | −33 % | — |
| Reha Stufe 2 für alle | 34,2 | −55 % | — |
| Reha Stufe 3 für alle | 22,7 | −70 % | — |
| Training leicht für alle / leicht ab Fatigue 50 | 68,0 / 72,6 | −10 % / −4 % | — |
| Schonen > 60 plus Rotation > 50/15 plus Reha 2 | 32,3 | −57 % | −0,02 |

Auf die fünf Hot-Teams (dünn plus Push, Abschnitt 7b im Anhang) bezogen: Kein Push −73 %, Reha 1 −32 %, Reha 2 −53 %, Schonen ab 40 −44 %. Die übrigen 26 Teams:
Reha 2 −56 %, Kein Push −47 %.

**Einordnung gegen Chris' Korridor.** 164 KI-Verletzungen je 20 Spieltage liegen mitten im Korridor 150–200 (Plan: gleiche absolute Zielzahl, auch bei 20 Spieltagen).
Schonen plus Push-Deckel (−26 %) landet bei etwa 120 und fällt unter die Untergrenze, Reha dazu drückt weiter. Die Maßnahmen sind deshalb eine **gewählte Dosis**:
entweder nur die Teilmenge, die die Konzentration in den Hot-Teams abbaut (Push-Deckel, Reha für dünne Kader), oder alles mit gleichzeitigem Anheben der Last
(`OLY_FATIGUE_MATCHDAY_LOAD`) — Entscheidung für Chris, nicht für diese Analyse. Die Belastungsregel v2 (PR #1671: Last 12,5–17,5 je Platz-Stufe plus Resistenz,
aktive Erholung 4,0, Pause nach Spieltag 10) ist auf `main` noch nicht drin und gilt nur für neue Saisons; sie ist darauf kalibriert, den Korridor mit der HEUTIGEN KI
zu halten. Ändert man gleichzeitig das KI-Verhalten, rutscht diese Kalibrierung nach unten — beides gemeinsam neu vermessen.

## 3. Vorschlag für KI-Regeln

| # | Regel | Erwartete Wirkung | Wo einbauen |
|---|---|---|---|
| R1 | **Push-Deckel auf Seiten-Ø Fatigue 30 statt 65, Kapitäns-Push nicht mehr bedingungslos.** `hasCaptain` aus dem `wantsPush`-Oder nehmen oder an dieselbe Fatigue-Grenze binden; zusätzlich kein Push, wenn Kader − Spieltagsbedarf ≤ 1 (dünner Kader). | −20 % (alle), bei den fünf Hot-Teams bis −41 %; Score −0,19 je Einsatz | `lib/ai/ai-legacy-lineup-batch-apply-service.ts`, `getAiIntensityForSide` (`pushFatigueCeiling`, `wantsPush`); Wert hängt an `OLY_AI_PUSH_FATIGUE_CEILING` |
| R2 | **Fatigue-Schonen je Seite ab Seiten-Ø 40** (conserve), unabhängig von `wantsPush`. Das MD1–2-Schonen für frische Seiten streichen (wirkt nicht auf Verletzungen, kostet 2,5 Score je Spieler): `isWeakDisciplineWindow` nur noch bei Seiten-Ø > 25. | −16 % (Ø 40) bis −38 % (Ø 30); Score −0,15 bis −0,38 je Einsatz | selbe Funktion: neuer Zweig vor `wantsPush` |
| R3 | **Rotationsregel: Starter über Schwelle 40 gegen ≥ 10 Punkte frischeren, gesunden Ersatz tauschen.** Heute: Wahrscheinlichkeitsrampe `resolveFatigueRestFloor` (32–45) plus Abzüge 3/9/12 (Fatigue 55/70/85) und −28 bei `needsLineupRest` im Auswahlscore. Zu ergänzen ist eine harte Tauschprüfung im selben Rollenprofil, nicht ein Ersatz. | −10 % (50/15) bis −24 % (40/10) | `lib/ai/ai-legacy-lineup-engine.ts` (`getHealthLineupPenalty`, `getSelectionScore`), `lib/fatigue/fatigue-rest-propensity.ts` |
| R4 | **Reha-Investitionsregel nach Verletzungslast und Finanzwert** (Schwellen sind Vorschlag): Recovery Center Stufe 1 im Preseason-Plan, sobald Vorsaison-Verletzungen ≥ 4 ODER Vorsaison-Ø-Fatigue ≥ 40 ODER Kader ≤ Spitzenbedarf − 2 (Ersatzsignal für Saison 1, wo es keine Vorsaison gibt); Stufe 2, wenn Verletzungen ≥ 7 oder (freier Cash nach Rücklage ≥ 30 und Finanzwert ≥ 6). Stufe 1 kostet 7 C, Stufe 2 weitere 13 C. | L1 −33 %, L2 −55 % (alle Teams); Hot-Teams L1 −32 %, L2 −53 % | `lib/ai/ai-team-management-preview-service.ts` (Recovery-Zweig, `baseBuildScoreThreshold`, `buildingBudget`), `lib/ai/ai-manager-apply-service.ts` (Reihenfolge, `recovery_center` bei Stufe 0 zuerst) |
| R5 | **Kadertiefe für Rotation:** Teams unter Spitzenbedarf − 2 (also unter 10) werden in der Kaderplanung bevorzugt aufgefüllt. Die Fatigue-Rampe (`FATIGUE_REST_FLOOR_THIN` 32) kann ohne Bank nichts tauschen. | Voraussetzung, damit R3 greift (71 % der Müde-Einsätze haben keinen frischeren Ersatz) | `lib/ai/auto-roster-fill-service.ts`, `lib/ai/ai-injury-depth-topup-service.ts` |
| R6 | **Training unter Erschöpfung:** der vorhandene Weg (leicht bei Fatigue > 45–50, kritisch ab 85) reicht, **keine Änderung nötig**. Optional: „hart“ nur, wenn der Spieler zuletzt nicht gespielt hat; Wirkung gering. | −4 bis −10 % (nur Bank-Erholung) | `lib/ai/ai-player-training-load-service.ts`, `resolveModeForPlayer` |

**Delegierte Menschen-Teams (Mehrspieler-Regel):** R1/R2/R3/R6 laufen über denselben Batch wie die KI-Teams. Die Intensität des Menschen zählt als gesetzt, sobald sie von
„normal“ abweicht (`mergeDelegatedLineupModifiers`), die Frischeprüfung ersetzt bei delegierten Teams nur Verletzte (`filterStaleFindingsForTeam`) — beides unverändert lassen,
R1/R2 greifen dann nur, wo der Mensch nichts gesetzt hat. Reha (R4) bleibt je Team im Bereich „Gebäude“, delegierbar wie bisher; delegierte Teams nutzen dieselbe Regel, die
Vorstands-Freigabe (`pruefeGebaeudeGegenVorstandFreigabe`) bleibt hart.

**Reihenfolge, falls umgesetzt wird:** R1 (kleinster Eingriff, größte Wirkung je Score-Punkt), dann R2, R4, zuletzt R3/R5. Nach jeder Änderung `scripts/miss-ki-belastungsverhalten.ts`
am frischen Abbild laufen lassen und das 20-Spieltage-Ziel (150–200) gegen die Liga prüfen. R1/R2 ändern die Spieler-Intensität und damit Scores: der Wertungs-Fingerabdruck
(`scripts/pruefe-wertung-fingerabdruck.mjs`) wird dort absichtlich neu gesetzt, bei R3–R6 (Auswahl, Training, Gebäude) nicht.

## 4. Grenzen der Messung

- Die Szenarien bilden Folgetage und Gegner nicht ab; ein verletzter Spieler fällt in der Simulation nicht zusätzlich aus (Ausfall im Spiel: 1 Spieltag plus 1 Erholung).
- `trainingMode` ist nur der JETZIGE Stand, ein Verlauf wird im Spielstand nicht geführt. „Training reagiert auf Erschöpfung“ ist eine Momentaufnahme.
- Schonen ist im Spiel eine Seiten-Intensität (eine Stufe für alle Spieler der Seite); die Zeile „je Spieler“ dient nur als Vergleich.
- Rotation kostet Eignung (Stärke der Aufstellung), das ist nicht bepreist; die Zahl ist die Obergrenze bei freier Wahl des Ersatzes.
- Eine Saison, 11 Spieltage, 31 Teams. Der Vergleich Reha ≥ 2 gegen < 2 ist leer, weil niemand gebaut hat — die Reha-Wirkung steht nur auf der Formel, nicht auf Beobachtung.

## Anhang: voller Messlauf

Erzeugt mit `OLY_APP_SQLITE_PATH=<kopie> npx tsx scripts/miss-ki-belastungsverhalten.ts`.

#### Messlauf
Saison season-1, 11 gebuchte Spieltage von 20, aktuell 12. 31 KI-Teams, menschlich: D-P. Last 16, Bank-Erholung 28, aktive Erholung 4.5 (Schalter AN), 2766 Einsätze.

#### 1. Einsatz-Intensität (Disziplin-Seiten und Spieler-Einsätze)

| Gruppe | Seiten | Schonen | Normal | Pushen | Einsätze | Schonen | Normal | Pushen |
|---|---|---|---|---|---|---|---|---|
| KI (alle) | 682 | 12.2 % | 66.9 % | 21.0 % | 2681 | 15.4 % | 62.7 % | 21.9 % |
| Mensch | 22 | 50.0 % | 27.3 % | 22.7 % | 85 | 47.1 % | 24.7 % | 28.2 % |

Push-Anteil ab MD3 (KI, Seiten): mit Kapitän 75.0 % (96 Seiten), ohne Kapitän 7.6 % (462 Seiten); Kapitän-Seiten stellen 67.3 % aller Push-Seiten.

Intensität nach Spieltag (KI, Anteil der Seiten):

| MD | Seiten | Schonen | Normal | Pushen |
|---|---|---|---|---|
| 1 | 62 | 62.9 % | 3.2 % | 33.9 % |
| 2 | 62 | 71.0 % | 4.8 % | 24.2 % |
| 3 | 62 | 0.0 % | 75.8 % | 24.2 % |
| 4 | 62 | 0.0 % | 79.0 % | 21.0 % |
| 5 | 62 | 0.0 % | 79.0 % | 21.0 % |
| 6 | 62 | 0.0 % | 88.7 % | 11.3 % |
| 7 | 62 | 0.0 % | 80.6 % | 19.4 % |
| 8 | 62 | 0.0 % | 88.7 % | 11.3 % |
| 9 | 62 | 0.0 % | 77.4 % | 22.6 % |
| 10 | 62 | 0.0 % | 80.6 % | 19.4 % |
| 11 | 62 | 0.0 % | 77.4 % | 22.6 % |

Hängt die Intensität an der Erschöpfung? (KI-Einsätze, Fatigue AM WURF, also nach Last)

| Intensität | Einsätze | Ø Fatigue am Wurf | <25 | 25-50 | 50-65 | 65-80 | >=80 | verletzt | Ø Risiko % |
|---|---|---|---|---|---|---|---|---|---|
| conserve | 412 | 12.6 | 90.5 % | 9.5 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.02 |
| normal | 1681 | 35.3 | 35.2 % | 44.9 % | 13.0 % | 5.2 % | 1.7 % | 3.2 % | 3.06 |
| push | 588 | 42.9 | 27.0 % | 35.9 % | 20.7 % | 11.9 % | 4.4 % | 6.3 % | 5.70 |

#### 2. Wer spielt — Rotation und erschöpfte Einsätze

Nachrechnung der Fatigue-Konten aus den aufgezeichneten Einsätzen: Differenz zur aufgezeichneten Fatigue am Wurf Median 3.3, Ø 5.0 (Trainings-Schicht; als Offset je Spieltag mitgeführt: 1.5/1.8/2.1/2.8/3.9/4.6/4.8/4.8/6.0/5.7/6.4).

| Gruppe | Ø Kader | Ø versch. Spieler eingesetzt | Ø Spieler je MD | Einsätze | Einsatz bei Fatigue >50 | bei >65 | >50 und >=15 frischerer Ersatz frei | >65 und frischerer Ersatz frei |
|---|---|---|---|---|---|---|---|---|
| KI (alle) | 11.8 | 11.8 | 7.9 | 2681 | 5.2 % | 1.2 % | 28.8 % | 15.6 % |
| Mensch | 10.0 | 10.0 | 7.7 | 85 | 4.7 % | 1.2 % | 75.0 % | 100.0 % |

#### 3. Kadergröße und Rotationsspielraum

Plätze je Spieltag laut Spielplan (Summe beider Disziplinen): min 4, Median 8, max 12, Ø 8.0; Mindestkader 8, Obergrenze 14.

| Kadergröße | KI-Teams | Mensch |
|---|---|---|
| 9 | 4 | 0 |
| 10 | 3 | 1 |
| 11 | 8 | 0 |
| 12 | 5 | 0 |
| 13 | 2 | 0 |
| 14 | 9 | 0 |

KI Ø Kader 11.8; Einsatzquote bei Ø-Plätzen 67.8 %, bei Spitzen-Plätzen (12) 101.6 %. Rechnerisches Gleichgewicht (Last gleich Erholung) bei q* = 67.1 % (Netto-Last 11.5, Bank -28).

Verteilung der Plätze je Spieltag (Plätze:Anzahl Spieltage): 4:1  5:1  6:1  7:4  8:8  9:1  10:1  11:2  12:1

#### 4. Training (jetziger Stand `player.trainingMode`, kein Verlauf gespeichert)

| Gruppe | Spieler | leicht | mittel | hart |
|---|---|---|---|---|
| KI (alle) | 366 | 74.3 % | 9.3 % | 16.4 % |
| Mensch | 10 | 40.0 % | 20.0 % | 40.0 % |

Trainingsmodus nach aktueller Konto-Fatigue (nur KI; ob die KI unter Erschöpfung auf leicht geht):

| Fatigue (Konto) | Spieler | leicht | mittel | hart |
|---|---|---|---|---|
| <25 | 143 | 60.1 % | 9.8 % | 30.1 % |
| 25-50 | 138 | 80.4 % | 7.2 % | 12.3 % |
| 50-65 | 51 | 88.2 % | 11.8 % | 0.0 % |
| 65-80 | 27 | 85.2 % | 14.8 % | 0.0 % |
| >=80 | 7 | 100.0 % | 0.0 % | 0.0 % |

Team-Trainingsintensität bestätigt (trainingIntensityConfirmations): 32 Teams, Beispiel {"teamId":"A-A","seasonId":"season-1","confirmedAt":"2026-11-20T17:43:51.578Z","sourcePlanId":"ai_matchday_training_reeval"}

#### 5. Gebäude (Recovery Center und übrige)

| Gruppe | Teams | training_center>0 | recovery_center>0 | scouting_office>0 | analytics_room>0 | fan_shop>0 | arena_upgrade>0 | academy>0 | specialist_wing>0 |
|---|---|---|---|---|---|---|---|---|---|
| KI (alle) | 31 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Mensch | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Recovery-Center-Stufen KI: 0:31 1:0 2:0 3:0 4:0 5:0; facilityEvents 0; Leihgaben-Teams 0.
Reha kumulativ: L1 7 C, L2 20 C, L3 42 C. KI-Teams mit Cash >= Kosten: L1 29, L2 12, L3 0; Cash >= Kosten + 10 Puffer: L1 16, L2 3.
KI-Cash: Median 17.4, min 5.3, max 36.5. Reha-Kosten: L1 +4, L2 +8, L3 +13, L4 +18, L5 +24.

#### 6. Verletzungen je Team

| Team | Mensch | Kader | versch. eingesetzt | Einsätze | Schonen | Pushen | Fat.>=50 | Fat.>=65 | Ø Fat. | verletzt | erwartet | Ausfall-MD | Train leicht | Train hart | Reha |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P-S |  | 9 | 9 | 80 | 0.0 % | 60.0 % | 70.0 % | 45.0 % | 57.9 | 13 | 9.6 | 13 | 88.9 % | 0.0 % | 0 |
| B-P |  | 9 | 9 | 80 | 3.8 % | 60.0 % | 68.8 % | 45.0 % | 58.2 | 12 | 9.9 | 12 | 100.0 % | 0.0 % | 0 |
| R-L |  | 9 | 9 | 82 | 7.3 % | 43.9 % | 53.7 % | 26.8 % | 51.3 | 8 | 7.5 | 8 | 88.9 % | 0.0 % | 0 |
| Z-H |  | 10 | 10 | 83 | 0.0 % | 71.1 % | 44.6 % | 18.1 % | 46.8 | 6 | 5.6 | 6 | 100.0 % | 0.0 % | 0 |
| V-D |  | 11 | 11 | 87 | 16.1 % | 27.6 % | 20.7 % | 5.7 % | 33.3 | 5 | 2.5 | 5 | 100.0 % | 0.0 % | 0 |
| D-L |  | 14 | 14 | 88 | 22.7 % | 0.0 % | 5.7 % | 1.1 % | 25.5 | 4 | 0.8 | 4 | 64.3 % | 28.6 % | 0 |
| H-R |  | 10 | 10 | 85 | 0.0 % | 41.2 % | 40.0 % | 17.6 % | 44.3 | 4 | 4.9 | 4 | 90.0 % | 0.0 % | 0 |
| N-N |  | 11 | 11 | 86 | 16.3 % | 37.2 % | 27.9 % | 9.3 % | 37.5 | 4 | 3.3 | 4 | 63.6 % | 9.1 % | 0 |
| C-S |  | 11 | 11 | 87 | 16.1 % | 24.1 % | 19.5 % | 4.6 % | 34.3 | 3 | 2.5 | 3 | 72.7 % | 18.2 % | 0 |
| L-R |  | 13 | 13 | 88 | 19.3 % | 20.5 % | 13.6 % | 2.3 % | 29.7 | 3 | 1.6 | 3 | 69.2 % | 23.1 % | 0 |
| M-M |  | 11 | 11 | 87 | 6.9 % | 42.5 % | 27.6 % | 10.3 % | 37.6 | 3 | 3.3 | 3 | 72.7 % | 9.1 % | 0 |
| S-C |  | 10 | 10 | 85 | 11.8 % | 37.6 % | 35.3 % | 15.3 % | 41.1 | 3 | 4.5 | 3 | 80.0 % | 0.0 % | 0 |
| V-V |  | 9 | 9 | 83 | 14.5 % | 34.9 % | 51.8 % | 24.1 % | 48.0 | 3 | 6.6 | 3 | 88.9 % | 0.0 % | 0 |
| A-A |  | 11 | 11 | 87 | 23.0 % | 0.0 % | 4.6 % | 0.0 % | 26.8 | 2 | 0.9 | 2 | 90.9 % | 9.1 % | 0 |
| D-P | ja | 10 | 10 | 85 | 47.1 % | 28.2 % | 28.2 % | 8.2 % | 41.3 | 2 | 3.3 | 2 | 40.0 % | 40.0 % | 0 |
| G-G |  | 14 | 14 | 88 | 12.5 % | 34.1 % | 8.0 % | 1.1 % | 28.0 | 2 | 1.2 | 2 | 78.6 % | 21.4 % | 0 |
| N-W |  | 14 | 14 | 88 | 22.7 % | 14.8 % | 6.8 % | 1.1 % | 24.7 | 2 | 1.0 | 2 | 57.1 % | 14.3 % | 0 |
| P-C |  | 12 | 12 | 88 | 22.7 % | 4.5 % | 6.8 % | 0.0 % | 26.6 | 2 | 0.9 | 2 | 66.7 % | 0.0 % | 0 |
| R-R |  | 11 | 11 | 87 | 23.0 % | 3.4 % | 11.5 % | 1.1 % | 28.4 | 2 | 1.3 | 2 | 72.7 % | 18.2 % | 0 |
| S-S |  | 12 | 12 | 88 | 5.7 % | 45.5 % | 28.4 % | 5.7 % | 37.0 | 2 | 3.0 | 2 | 75.0 % | 16.7 % | 0 |
| T-G |  | 11 | 11 | 87 | 12.6 % | 18.4 % | 20.7 % | 4.6 % | 34.4 | 2 | 2.4 | 2 | 90.9 % | 9.1 % | 0 |
| W-L |  | 11 | 11 | 87 | 6.9 % | 17.2 % | 28.7 % | 6.9 % | 38.0 | 2 | 2.9 | 2 | 54.5 % | 27.3 % | 0 |
| M-S |  | 14 | 14 | 88 | 17.0 % | 8.0 % | 9.1 % | 2.3 % | 27.7 | 1 | 1.2 | 1 | 64.3 % | 21.4 % | 0 |
| R-C |  | 13 | 13 | 88 | 22.7 % | 2.3 % | 8.0 % | 1.1 % | 25.7 | 1 | 0.9 | 1 | 69.2 % | 30.8 % | 0 |
| W-W |  | 12 | 12 | 88 | 19.3 % | 25.0 % | 15.9 % | 4.5 % | 33.2 | 1 | 2.2 | 1 | 66.7 % | 33.3 % | 0 |
| B-B |  | 12 | 12 | 88 | 22.7 % | 5.7 % | 2.3 % | 0.0 % | 25.0 | 0 | 0.6 | 0 | 66.7 % | 25.0 % | 0 |
| C-C |  | 14 | 14 | 88 | 22.7 % | 4.5 % | 1.1 % | 0.0 % | 21.5 | 0 | 0.3 | 0 | 64.3 % | 14.3 % | 0 |
| L-K |  | 14 | 14 | 88 | 15.9 % | 0.0 % | 3.4 % | 0.0 % | 24.3 | 0 | 0.6 | 0 | 50.0 % | 35.7 % | 0 |
| T-C |  | 14 | 14 | 88 | 22.7 % | 0.0 % | 0.0 % | 0.0 % | 22.6 | 0 | 0.4 | 0 | 78.6 % | 21.4 % | 0 |
| T-T |  | 14 | 14 | 88 | 19.3 % | 0.0 % | 8.0 % | 1.1 % | 23.7 | 0 | 0.9 | 0 | 71.4 % | 28.6 % | 0 |
| U-A |  | 14 | 13 | 88 | 22.7 % | 3.4 % | 3.4 % | 0.0 % | 24.4 | 0 | 0.6 | 0 | 57.1 % | 42.9 % | 0 |
| V-W |  | 12 | 12 | 88 | 22.7 % | 5.7 % | 10.2 % | 1.1 % | 27.6 | 0 | 1.1 | 0 | 91.7 % | 8.3 % | 0 |

KI gesamt: 90 Verletzungen bei 2681 Einsätzen (3.36 %), erwartet 85.1; Ø 2.9 je Team in 11 Spieltagen; Hochrechnung auf 20 Spieltage: Ø 5.3 je Team, 163.6 Liga (nur KI).
Mensch D-P: 2 Verletzungen bei 85 Einsätzen, Kader 10.

Korrelation (Pearson, 31 KI-Teams) mit der Verletzungsrate je Einsatz:

| Größe | r |
|---|---|
| Kadergröße | -0.70 |
| Anteil Schonen | -0.68 |
| Anteil Pushen | 0.76 |
| Ø Fatigue am Wurf | 0.86 |
| Anteil Fatigue>=65 | 0.92 |
| Anteil Training leicht | 0.56 |
| Reha-Stufe | 0.00 |
| versch. eingesetzte Spieler | -0.69 |

Gegenüberstellung: kleinere Kader: 15 Teams, 72 Verletzungen, 5.66 % je Einsatz  |  größere Kader: 16 Teams, 18 Verletzungen, 1.28 % je Einsatz
Gegenüberstellung: wenig Schonen: 15 Teams, 68 Verletzungen, 5.32 % je Einsatz  |  viel Schonen: 16 Teams, 22 Verletzungen, 1.57 % je Einsatz
Gegenüberstellung: Reha >= 2: 0 Teams, 0 Verletzungen, 0.00 % je Einsatz  |  Reha < 2: 31 Teams, 90 Verletzungen, 3.36 % je Einsatz

#### 7. Szenarien auf den aufgezeichneten Einsatzmengen (nur KI-Teams)

Baseline-Nachrechnung: erwartet 75.4 Verletzungen (aufgezeichnet: 90 tatsächlich, 85.1 erwartet laut Würfen) bei 2681 Einsätzen; Einsätze mit Fatigue >=50: 17.6 %, >=65: 7.0 %.

| Szenario | erwartete Verletzungen (11 MD) | gegen Baseline | Einsätze Fat.>=65 | Tausche | auf Schonen gesetzt | Intensitäts-Score-Punkte gesamt |
|---|---|---|---|---|---|---|
| Baseline | 75.4 | 0 % | 7.0 % | - | - | - |
| (a) Schonen ab Fatigue >40 | 49.0 | -35 % | 1.6 % | - | 240 | -896 (-0.33 je Einsatz) |
| (a) Schonen ab Fatigue >50 | 62.0 | -18 % | 4.4 % | - | 113 | -431 (-0.16 je Einsatz) |
| (a) Schonen ab Fatigue >60 | 70.6 | -6 % | 6.4 % | - | 45 | -173 (-0.06 je Einsatz) |
| (a) Schonen ab Fatigue >70 | 74.5 | -1 % | 7.0 % | - | 14 | -51 (-0.02 je Einsatz) |
| (a*) Seite schonen, wenn Ø Fatigue der Seite >30 (je Seite wie im Spiel) | 46.7 | -38 % | 2.4 % | - | 257 | -1011 (-0.38 je Einsatz) |
| (a*) Seite schonen, wenn Ø Fatigue der Seite >40 | 63.7 | -16 % | 4.7 % | - | 108 | -402 (-0.15 je Einsatz) |
| (a*) Seite schonen, wenn Ø Fatigue der Seite >50 | 72.3 | -4 % | 6.5 % | - | 36 | -98 (-0.04 je Einsatz) |
| (a*) Push-Deckel je Seite: Ø Fatigue der Seite <=30 (heute 65) | 60.2 | -20 % | 4.4 % | - | - | -520 (-0.19 je Einsatz) |
| (a*) Push-Deckel je Seite <=30 und Schonen ab Seiten-Ø >40 | 55.4 | -26 % | 3.5 % | - | 81 | -683 (-0.25 je Einsatz) |
| (a') Kein Pushen mehr | 31.6 | -58 % | 1.2 % | - | - | -2352 (-0.88 je Einsatz) |
| (a'') Push nur bei Fatigue vor MD <= 25 | 52.6 | -30 % | 3.2 % | - | - | -792 (-0.30 je Einsatz) |
| (a'') Push nur bei Fatigue vor MD <= 40 | 65.0 | -14 % | 4.4 % | - | - | -344 (-0.13 je Einsatz) |
| (b) Rotation: Starter >50 gegen >=15 Punkte frischeren Ersatz | 67.6 | -10 % | 5.6 % | 39 | - | - |
| (b) Rotation: Starter >40 gegen >=10 Punkte frischeren Ersatz | 57.3 | -24 % | 4.6 % | 96 | - | - |
| (b) Rotation: Starter >65 gegen >=15 Punkte frischeren Ersatz | 75.5 | 0 % | 7.0 % | 5 | - | - |
| (c) Reha Stufe 1 für alle | 50.2 | -33 % | 3.6 % | - | - | - |
| (c) Reha Stufe 2 für alle | 34.2 | -55 % | 1.6 % | - | - | - |
| (c) Reha Stufe 3 für alle | 22.7 | -70 % | 0.8 % | - | - | - |
| (c) Reha Stufe 5 für alle | 9.6 | -87 % | 0.2 % | - | - | - |
| (d) Training leicht, sobald Fatigue >50 | 72.6 | -4 % | 6.5 % | - | - | - |
| (d) Training leicht für alle | 68.0 | -10 % | 6.2 % | - | - | - |
| (a+b) Schonen >60 und Rotation >50/15 | 63.6 | -16 % | 5.1 % | 40 | 41 | -151 (-0.06 je Einsatz) |
| (a+b+c) Schonen >60, Rotation >50/15, Reha 2 | 32.3 | -57 % | 1.4 % | 11 | 16 | -64 (-0.02 je Einsatz) |
| (a+c+d) Schonen >60, Reha 2, Training leicht >50 | 32.3 | -57 % | 1.5 % | - | 15 | -58 (-0.02 je Einsatz) |

Hinweis: gleiche Einsatzmengen, keine Folgetage verletzter Spieler, kein Verhalten der Gegner. Intensitäts-Score = Mittel der Spanne je Stufe (Schonen -2,5 / Normal 0 / Push +4 je Spieler, `INTENSITY_SCORE_RANGE`); Rotation kostet Eignung (nicht bepreist).

#### 7b. Konzentration — dünne Kader (<=10 Spieler) mit Push-Anteil >= 40 %

Teams: P-S, B-P, R-L, Z-H, H-R (5 von 31) tragen 43 von 90 KI-Verletzungen (47.8 %).

| Szenario | dünn+Push (5 Teams) | gegen Baseline | übrige (26 Teams) | gegen Baseline |
|---|---|---|---|---|
| Baseline | 33.2 | 0 % | 42.2 | 0 % |
| Kein Pushen | 9.1 | -73 % | 22.5 | -47 % |
| Push nur bei Fatigue vor MD <= 25 | 19.6 | -41 % | 33.0 | -22 % |
| Schonen ab >50 | 23.7 | -29 % | 38.3 | -9 % |
| Schonen ab >40 | 18.6 | -44 % | 30.4 | -28 % |
| Reha 1 | 22.7 | -32 % | 27.5 | -35 % |
| Reha 2 | 15.6 | -53 % | 18.5 | -56 % |
| Kein Pushen + Schonen >50 | 8.3 | -75 % | 22.1 | -48 % |


## Messung nach dem Bau (21.11.)

Skript `scripts/miss-ki-schonung-lauf.ts`: Kopie des Live-Abbilds, alle 32 Teams KI, 8 Spieltage ab ST12 komplett gespielt (Node-Motor). Rohausgaben: `docs/design/ki-schonung-reha-mess-21-11/base.out` (vorher, main) und `neu.out` (nachher, Branch).

| Kennzahl (8 Spieltage) | Vorher | Nachher |
|---|---:|---:|
| Push-Anteil der Einsätze | 17,2 % | 4,4 % |
| Schon-Anteil der Einsätze | 0,1 % | 25,0 % |
| Einsätze bei Fatigue >= 65 am Wurf | 22,1 % | 12,2 % |
| Einsätze bei Fatigue >= 40 | 58,6 % | 53,6 % |
| Verletzungen | 130 | 95 |
| erwartete Verletzungen (Summe Risiko) | 143,8 | 99,5 (-31 %) |
| Hochrechnung je 20 Spieltage (gewürfelt / erwartet) | 325 / 359 | 238 / 249 |
| Reha-Bauten | 0 | 1 (7 C) |

Das Abbild steht spät in der Saison (viele müde Spieler); die Zahlen gelten ab ST12 und liegen über dem Saisonschnitt der Analyse.

### Reha-Befund: warum nur 1 Bau

Diagnose an `neu.sqlite` (Skript `scripts/diag-ki-reha.ts`): Die Vorstands-Freigabe war nicht der Grund (Saison 1, nicht gedeckelt; `previewFacilityUpgrade` ok bei 30 von 32 Teams). Bedarf war da (C-S, D-L, W-L: Stufe 2 gewünscht). Es scheiterte am freien Geld nach Rücklage: Die Rücklage rechnete in Saison 1 mit Budget = Kasse + Marktwert des Kaders, mitten in der Saison also fast die ganze Kasse (C-S: Kasse 35,7, frei 1,2 C; W-L: 41,5 / 3,5; N-N: 19,1 / 6,1). Das war ein Fehler im Gate: In Saison 1 ist das Budget der Rücklage das Startbudget.

Behoben in `lib/ai/ai-reha-bau-service.ts` (Saison 1: Kaderwert 0 in der Rücklage; Test in `tests/ki-schonung-reha.test.ts`). Nachrechnung am selben Stand: frei C-S 22,3, W-L 27,9, B-P 8,0, D-L 7,6; 12 von 32 Teams würden bauen. Nicht bauen können Teams knapp über der Rücklage 0,35 x Zielgehalt (R-L, H-R, Z-H, D-P): gewollte Rücklage nach Finanzwert. Ein Nachher-Lauf mit der Korrektur (4 Spieltage) war beim Schreiben noch nicht fertig.
