# Training je Spieltag — Spielmechanik (18.11.)

Auftrag: Chris' Entscheidungen zum Bereich „Entwicklung" (`docs/design/training-modern-18-11.md` Abschnitt 7a, Mockup
`public/mockups/training-modern-18-11.html`, beide auf `claude/training-gebaeude-mockup-18-11`) als **Spielregeln** bauen. Die
Oberfläche baut ein anderer Agent; hier stehen Regeln, Datenschnittstelle, Balancing und Messlauf. Der Motor (Arena-Engine) ist
nicht angefasst, der Wertungs-Fingerabdruck bleibt `ce8fcef66028`.

## 1. Was jetzt gilt

| # | Regel | Umsetzung |
|---:|---|---|
| 1 | **Training wirkt je Spieltag**, gebucht und getrackt je Spieltag | `accumulateMatchdayTrainingProgress` (`lib/training/matchday-training-accumulator.ts`) bucht beim Spieltags-Commit den Zuwachs auf `attributeSheetStats`, leitet die Disziplinwerte ligaweit neu ab (wie am Saisonende) und schreibt je Spieler einen Verlaufseintrag (`seasonTrainingAccumulator.verlauf`). Idempotent je Spieltag; Neu-Buchen mit anderem Modus baut den alten Zuwachs zurück. |
| 2 | **Neu gebalanct** | Satz je Spieltag `TRAINING_SETPOINTS_JE_SPIELTAG` = 0,137 / 0,174 / 0,246 (leicht / mittel / hart), Herleitung Abschnitt 3. Regler `OLY_TRAINING_JE_SPIELTAG_FAKTOR` (Standard 1,0). |
| 3 | **Regel A: Ziel-Disziplin + Weg** | Profil aus den drei schwersten Matrix-Attributen der Disziplin (nur gelesen). Gewählter Weg-Platz 60 %, die anderen 25 % und 15 %. Weg 0 = Primärweg (Hauptattribut), 1/2 = Nebenweg. Jederzeit wechselbar, wirkt ab dem nächsten Spieltag (ein gebuchter Spieltag behält sein Ziel). Ersetzt Trainingsklasse und Zweitklasse; Trait, Potenzial-Beschleuniger, Fokusachse (Achse des 60-%-Attributs), Trainingszentrum, Akademie, Decke und Spillover wirken unverändert über `buildOrganicSeasonProgression` (`nurTraining`). |
| 4 | **Regel B: Verletzte trainieren nicht** | An Ausfall-Spieltagen kein Zuwachs, keine Trainingslast, Modus nicht gezählt; Verlaufseintrag `verletzt`. Bestimmt auf dem Stand vor der Verletzungsbuchung (`bestimmeAusfallSpielerFuerSpieltag`). Am Verletzungs-Spieltag selbst hat der Spieler noch gespielt und trainiert. |
| 5 | **Regel E: Überlastung drückt die Form gering** | Nach dem Spieltag, wer trainiert hat und Gesamtbelastung ≥ 50 trägt: mittel −1 (ab 80: −2), hart −2 (ab 80: −3), leicht 0. Über die Form-Fortschreibung (`advancePlayerFormState`, Feld `u` im Form-Verlauf, lesbar als `ueberlastung`). Formkarten unberührt. |
| 6 | Kein Alter | — |
| — | **Mensch = KI** | Ohne gesetztes Ziel trainiert jeder Spieler (KI-Team oder Mensch) auf `kiTrainingsZielVorschlag`: Wichtigkeit (offene Auftritte der Saison), Kaderlücke (Team unter Liga-Median der Startplätze), Schwelle (knapp drin/draußen), Hebel und Decke, im Kader abgestimmt (jeder weitere auf derselben Disziplin zählt `1/(1+n/Plätze)`), Haltekraft 1,25 auf das bisherige Ziel. |
| — | **Saisonende ohne Doppel** | `resolveSeasonEndTrainingAccumulatorOverrides`: Trainingsbudget am Saisonende nur noch für gezählte, nicht je Spieltag gebuchte Spieltage (Alt-Spieltage eines laufenden Spielstands), sonst 0. Leistung und Abbau bleiben am Saisonende. Saison-Delta der Disziplinwerte gegen den Stand vor dem ersten Trainings-Spieltag (`startDisziplinwerte`). |
| — | **Rückweg** | `OLY_TRAINING_JE_SPIELTAG=0`: alles wie vorher (Saisonend-Buchung nach Klasse, Verletzte trainieren, kein Formabzug). Standard AN. |

**Bestehende Spielstände:** Spieltage vor dem Umstieg stehen im Akkumulator ohne Verlaufseintrag und werden am Saisonende wie
bisher gebucht (anteilig). Ab dem nächsten Spieltag bucht jeder Spieltag selbst. Ein Neu-Buchen eines Alt-Spieltags mit gleichem
Modus bleibt Alt-Spieltag. Was am Saisonende schon gebucht ist (Vorsaison), ist abgeschlossen; der Akkumulator ist je Saison.

## 2. Datenschnittstelle für die Oberfläche

Alles in `lib/training/spieltag-training.ts`, rein über den Spielstand:

| Funktion | Liefert |
|---|---|
| `entpackeTrainingsVerlauf(gameState, playerId)` | `TrainingsVerlaufZeile[]` je Spieltag: `matchdayId`, `spieltag`, `status` (trainiert/verletzt), `disziplinId`, `weg`, `quelle` (manager/ki), `modus`, `zuwachs` je Attribut (**genau das Gebuchte**), `summe`, `last`, `formAbzug`, `formAbzugText` („−3 Überlastung"). Quelle der Verlaufskurve. |
| `trainingsSaisonSumme(gameState, playerId)` | Saisonsumme: Spieltage trainiert/verletzt, Zuwachs je Attribut, `summe`, `schwerpunkt`, `formAbzugGesamt`, `lastGesamt`. |
| `prognostiziereSpieltagsTraining({ gameState, playerId, ziel?, modus? })` | Vorschau des nächsten Spieltags mit **derselben Rechnung wie die Buchung** (Plan-Editor „bisher → mit dieser Änderung"): `profil`, `budget`, `zuwachs`, `nebeneffekt`, `deckeBremst`, oder `{ verletzt: true }`. |
| `prognostiziereDisziplinTraining({ gameState, playerId, ziel?, modus?, spieltage? })` (`lib/training/disziplin-trainings-prognose.ts`) | **Trainings-Forecast je Disziplin** für Spielerprofil und „Wirkung in 20 Disziplinen": Spieltag für Spieltag mit derselben Rechnung wie die Buchung (Ausfall-Spieltage zählen nicht), dann Disziplinwert heute → Prognose, `delta`, Kaderrang heute/Prognose, `istZiel`; Fenster Standard = Rest der Saison. Annahme „andere Spieler unverändert" (`annahme`). |
| `trainingsProfilFuerZiel({ disziplinId, weg })`, `wegeFuerDisziplin(d)`, `schwersteMatrixAttribute(d)` | Profil 60/25/15 mit Matrixgewichten; die drei Wege (Primär/Neben) einer Disziplin. |
| `bewerteTrainingsZiele(kontext, player)`, `kiTrainingsZielVorschlag(kontext, player)`, `baueTrainingsZielKontext(gameState, matchdayId)` | Vorschlag und Begründung (`kaderRang`, `slots`, `offeneAuftritte`, `luecke`, `begruendung`) für Vorlagen und den Reiter Liga. |
| `setzeTrainingsZiel(gameState, playerId, { disziplinId, weg } \| null)` | Setzen/Löschen (wirft bei ungültigem Ziel). Route: `POST /api/training` mit `trainingsZiel`. |
| `ueberlastungsAbzug(modus, belastung)`, `UEBERLASTUNG_SCHWELLE` / `_LIMIT` / `_ABZUG` | Für die Warnung „Überlastete schonen". |
| Felder | `player.trainingsZiel`, `player.seasonTrainingAccumulator.verlauf / startAttribute / startDisziplinwerte`, `playerFormState[].verlauf[].u`; Schalter `isTrainingJeSpieltagAktiv()` (`training-je-spieltag-schalter.ts`, browser-tauglich). |

Die alte Anzeige (Trainings-Reiter, Spielerprofil) bleibt rechnerisch ehrlich: `buildProjectedSeasonTrainingAccumulatorOverrides`
und `buildPlayerSeasonTrainingForecast` zählen gebuchte Spieltage nicht noch einmal (Zuwachs aus dem Verlauf).

## 3. Balancing

**Satz je Spieltag** (`TRAINING_SETPOINTS_JE_SPIELTAG`): leicht **0,178**, mittel **0,226**, hart **0,320** Grundbudget-Punkte je
Spieltag. Das ist der alte Saisonsatz (2,74 / 3,47 / 4,92) geteilt durch 20 Spieltage, mal **1,3**. Darauf wirken wie bisher Trait,
Potenzial-Beschleuniger (Lücke), Fokusachse, Trainingszentrum, Akademie, die Decke je Attribut und der Spillover.

Warum mal 1,3: Ein erster voller Lauf mit Faktor 1,0 (dieselbe Basis) ergab im Schwerpunkt-Attribut Median **1,69**, P90 3,29,
Rohdiamanten Median 2,81 / Maximum 5,61 — unter dem Konzeptziel (Aufbau 2–3, Rohdiamant bis ~7). Zwei Gründe: Die KI schont
müde Spieler stark (66 % aller Trainingstage „leicht"), und Verletzte trainieren nicht mehr (268 Spieler-Spieltage). Mit 1,3 und
ruhigerer Zielwahl (Haltekraft 1,5, Wurzel auf die offenen Auftritte; Zielwechsel 5,1 → 3,5 je Spieler und Saison) liegt der
Median bei **2,39**, Rohdiamanten bei **3,9** im Median und **7,65** im Maximum. Der Regler `OLY_TRAINING_JE_SPIELTAG_FAKTOR`
skaliert alles linear (Vorschlag für Chris' Spanne nach dem Sichtbarmachen: **1,0–1,6** — 1,0 ≈ Median 1,8, 1,6 ≈ Median 2,9).

**Messlauf** (`scripts/miss-training-je-spieltag.ts`, Auswertung `scripts/auswerte-training-je-spieltag.ts`): Neues Spiel Battle,
**32 KI-Teams von Anfang an**, Liga-Draft der Pick-Engine (367 Kaderspieler), **eine volle Saison** (20 Spieltage, Auto-Run +
Spieltagswechsel) und Saisonende-Kette bis zur Saisonend-Progression. Paarweise auf derselben Anlage-SQLite: vorher
`OLY_TRAINING_JE_SPIELTAG=0`, nachher Standard. Der Nachher-Lauf wurde nach Spieltag 12 unterbrochen und auf derselben SQLite
fortgesetzt (`--fortsetzen`); die Laufzeiten sind wegen paralleler Last auf der Maschine nur grob vergleichbar.

Basis new-game-1795009679233-cg3n7p, Spieltage 20/20 vorher, 20/20 nachher; Schalter vorher {"jeSpieltag":false,"faktor":1}, nachher {"jeSpieltag":true,"faktor":1}.
Verletzungen vorher 300, nachher 297. Laufzeit je Spieltag (Median) vorher 148 s, nachher 145 s.

#### Zuwachs je Saison

| Größe | vorher (Saisonende, Klasse) | nachher (je Spieltag, Regel A) |
|---|---:|---:|
| Spieler (Kader) | 367 | 367 |
| Training im Schwerpunkt-Attribut, Median | 1,22 | 2,39 |
| Training im Schwerpunkt-Attribut, P90 | 2,37 | 4,56 |
| Training im Schwerpunkt-Attribut, Maximum | 4,32 | 9,43 |
| Rohdiamanten (Top 10 % Potenzial-Lücke, n=37), Median | 2,08 | 3,93 |
| Rohdiamanten, Maximum | 4,32 | 7,65 |
| Training Summe aller Attribute, Median | 3,71 | 5,76 |
| Training Summe aller Attribute, P90 | 6,79 | 9,55 |
| Netto (Training + Leistung + Abbau) Schwerpunkt, Median | 1,50 | 2,40 |
| Netto Summe aller Attribute, Median | 4,50 | 6,30 |
| Netto Summe aller Attribute, Liga-Mittel | 4,81 | 6,78 |

#### Ziel-Disziplinen der KI (nachher)

| Ziel-Disziplin (letzter Spieltag) | Spieler | Anteil |
|---|---:|---:|
| wettessen | 70 | 19,1 % |
| hockey | 41 | 11,2 % |
| time-trial | 31 | 8,4 % |
| breaking | 29 | 7,9 % |
| fechten | 27 | 7,4 % |
| eiskunstlauf | 24 | 6,5 % |
| mini-dm | 19 | 5,2 % |
| gewichtheben | 16 | 4,4 % |
| basketball | 15 | 4,1 % |
| speed-schach | 13 | 3,5 % |
| showcase | 13 | 3,5 % |
| tennis | 12 | 3,3 % |
| football | 11 | 3,0 % |
| climbing | 9 | 2,5 % |
| staffel | 8 | 2,2 % |
| takeshis-castle | 8 | 2,2 % |
| i-spy | 6 | 1,6 % |
| tdm | 5 | 1,4 % |
| battlefield | 5 | 1,4 % |
| spurt | 5 | 1,4 % |

Spieler mit Ziel: 367, davon vom Manager gesetzt: 0. Weg: Primärweg 319, Nebenweg 48 (Platz 2: 41, Platz 3: 7). Zielwechsel über die Saison: 1273 (3,47 je Spieler).

#### Überlastung und Verletzte (nachher)

| Größe | Wert |
|---|---:|
| Spieler-Spieltage trainiert | 7072 |
| Spieler-Spieltage verletzt (kein Training) | 268 |
| Formabzüge durch Überlastung (Einträge) | 395 (5,6 % der Trainingstage) |
| Summe Formpunkte | 559 |
| betroffene Spieler | 124 |
| Verteilung | −1: 231, −2: 164 |
| Intensität (Spieler-Spieltage) | mittel 1160, leicht 4677, hart 1235 |

#### Marktwert-Drift

| Marktwert (Kaderspieler, Saisonstart → nach Saisonend-Progression) | vorher | nachher |
|---|---:|---:|
| Σ Marktwert Start | 5984 | 6039 |
| Σ Marktwert Ende | 6186 | 6283 |
| Veränderung je Spieler, Median | 3,1 % | 3,8 % |
| P10 / P90 | 0,4 / 6,3 % | 0,9 / 7,4 % |

#### Kaderstärke (Ø Top-6-Eignung je Disziplin, 32 Teams)

| Zeitpunkt | vorher Ø (min–max) | nachher Ø (min–max) |
|---|---:|---:|
| Start | 47,26 (39,8–56,1) | 47,26 (39,8–56,1) |
| nach Spieltag 1 | 47,26 (39,8–56,1) | 47,24 (39,8–56,1) |
| nach Spieltag 5 | 47,26 (39,8–56,1) | 47,42 (40,0–56,2) |
| nach Spieltag 10 | 47,26 (39,8–56,1) | 47,62 (40,2–56,4) |
| nach Spieltag 15 | 47,26 (39,8–56,1) | 47,79 (40,4–56,5) |
| nach Spieltag 20 | 47,26 (39,8–56,1) | 47,96 (40,5–56,6) |
| nach Saisonende | 43,87 (35,4–53,3) | 44,21 (35,6–56,0) |


Lesart:
- **Zuwachs**: „Training" = je Spieltag gebuchter Zuwachs (nachher) bzw. Trainings- und Spillover-Anteil der Saisonend-Buchung
  (vorher). „Schwerpunkt" = größter Zuwachs in einem Attribut. Rohdiamanten = 10 % mit der größten Lücke Potenzial − Rating.
- **Kaderstärke** wächst nachher während der Saison (+0,7 Punkte Ø bis Spieltag 20), vorher erst am Saisonende. Der Sprung „nach
  Saisonende" ist in beiden Läufen die ligaweite Neuableitung der Disziplinwerte; nachher bleibt +0,3 Ø mehr.
- **Marktwerte** bleiben während der Saison stehen und werden am Saisonende wie bisher neu bewertet; die Drift steigt mit dem
  größeren Zuwachs leicht (Median 3,1 % → 3,8 %). Der Startwert unterscheidet sich zwischen den Läufen um 0,9 % (Bewertung beim
  Laden), verglichen wird deshalb relativ.
- **Überlastung**: 5,6 % der Trainingstage mit Formabzug, nur −1 und −2 (−3 nur bei „hart" ab Belastung 80, kam nicht vor).
- **Verletzungen** unverändert (300 / 297): die Trainingslast je Spieltag ist dieselbe, Verletzte tragen keine mehr.


## 4. Rangtreue, Pp, Fingerabdruck

- **Wertungs-Fingerabdruck** `node scripts/pruefe-wertung-fingerabdruck.mjs`: **GESAMT ce8fcef66028 (75 Einträge)**, unverändert.
  Kein Motor-, Rezept- oder Arena-Adapter-Code ist angefasst.
- **Rangtreue-Schranke** (`node --import tsx scripts/pruefe-rangtreue-schranke.mjs`): in dieser Sitzung **nicht zu Ende
  gelaufen** — der erste Lauf wurde wegen Speicherdruck neben den Messläufen abgebrochen, der zweite bekam keinen Browser (Platte
  zu 98 % voll), der dritte stand über 30 Minuten in der Warteschlange von `/tmp/oly-aufnahme.lock`. Inhaltlich ändert diese PR
  daran nichts: die Schranke misst den Motor mit generierten Kadern ohne Training, und der Motor ist unverändert (Fingerabdruck).
  Nachholen: CI-Job „rangtreue-schranke" bzw. derselbe Befehl.
- **Pp-Abweichung** (`scripts/messe-arena-einfluss.mjs`): misst ebenfalls den Motor auf generierten Kadern; unverändert aus
  demselben Grund. Training verschiebt nur die Eingangsattribute, Eignung und Attribute bewegen sich dabei gemeinsam (dieselbe
  ligaweite Ableitung wie am Saisonende), es entsteht also kein Kanal, der an der Matrix vorbei wirkt. Im Gegenteil: Regel A
  trainiert genau die Matrix-Attribute der Ziel-Disziplin.
- **Rangtreue während der Saison**: Disziplinwerte ändern sich jetzt je Spieltag statt einmal je Saison, im Messlauf um Ø +0,7
  Punkte Top-6-Eignung über 20 Spieltage. Die Abnahme „rho je Spiel" vergleicht Ergebnis gegen die Eignung desselben Spiels; beide
  kommen aus demselben Stand, die Messung bleibt also gültig.


## 5. Offene Fragen an Chris

1. **Rate**: Standard Faktor 1,3 gegenüber dem alten Saisonsatz (Median Schwerpunkt 2,4, Rohdiamant bis 7,7). Spanne zum
   Ausprobieren: `OLY_TRAINING_JE_SPIELTAG_FAKTOR` 1,0–1,6. Empfehlung: so lassen, nach echten Spielständen entscheiden.
2. **Die KI schont stark**: 66 % aller KI-Trainingstage laufen „leicht" (`ai-player-training-load-service`, Neubewertung je
   Spieltag nach Belastung). Dadurch trainiert die KI im Schnitt weniger als ein Mensch, der „mittel" stehen lässt. Nicht
   angefasst (eigene Mechanik), aber der größte Hebel auf den Liga-Zuwachs.
3. **Leistung und Abbau bleiben am Saisonende** (nur das Training wandert in den Spieltag, wie entschieden). Sollen auch sie je
   Spieltag gebucht werden? Dann sinken die Werte nicht mehr in einem Schritt am Saisonende.
4. **Marktwerte** werden erst am Saisonende neu bewertet (laufende Saison, Transfers, eingefrorene Bewertung bleiben ruhig).
   Soll der Marktwert je Spieltag mitziehen?
5. **Alte Oberfläche**: Die Trainingsklasse im alten Trainings-Reiter hat mit Schalter AN keine Wirkung mehr (Regel A ersetzt
   sie). Bis der Bereich „Entwicklung" steht, trainieren Mensch-Spieler ohne Ziel auf den KI-Vorschlag (im Verlauf als Quelle
   „ki" sichtbar). Das Ziel lässt sich schon über `POST /api/training` (`trainingsZiel`) setzen.
6. **Zweitklasse** (Trainingszentrum ab Stufe 4, 70/30) entfällt mit Regel A. Ersatzvorschlag: zweite Ziel-Disziplin mit 30 %
   ab Stufe 4.
7. **Ligaweite Neuableitung je Spieltag**: Disziplinwerte sind Rang-Werte; wenn einer trainiert, verschieben sich die Werte der
   anderen minimal mit (wie bisher am Saisonende, jetzt je Spieltag).

