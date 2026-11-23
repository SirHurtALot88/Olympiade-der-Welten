# Training Runde 2: Bau, Messung und Abgleich (22.11.)

Konzept und Mockup: `docs/design/training-r2-22-11.md`, `public/mockups/training-r2-22-11.html` (von Chris freigegeben: „die mockups sehen gut aus hast die freigabe die umzusetzen“).
Gebaut: Ziel-Heatmap Disziplin x Weg im Plan, Trainingsvorlieben (zwei Lieblings-Disziplinen, eine ungeliebte), Fortschritt dieser Saison, Vorschau, Fremdes Team unter Scouting-Nebel.

## 1. Was gebaut ist

| Teil | Ort |
|---|---|
| Plan-Ansicht neu (Kaderliste, Heatmap, Vorschau, Fremdes Team); die alte Plan-Ansicht samt `te-dk`/`te-weg`/`te-modus`-Styles ist entfernt | `app/foundation/training-modern/PlanR2.tsx`, `training-r2.css` |
| Heatmap-Rechnung (SP, Eignung, Luft je Zelle; beste Zelle; Fortschritt der Saison; Liga-Rang) | `lib/training/training-heatmap.ts` |
| Vorlieben ableiten, Faktoren, Moral, Ausgleich | `lib/training/trainings-vorlieben.ts` |
| Stempel im Spielstand | `lib/resolve/trainings-vorlieben.ts`, Typ `seasonState.trainingsVorlieben` |
| Sichtbarkeit unter Nebel | `lib/training/trainings-vorlieben-sicht.ts` |
| Faktor im Trainingsbudget, KI-Gewicht | `lib/training/spieltag-training.ts` (`berechneSpieltagsZuwachs`, `bewerteTrainingsZiele`) |
| Moral-Grund | `lib/morale/player-morale-service.ts` (`training_favorite_discipline`, `training_disliked_discipline`) |
| Verlaufsfeld `v` (1 / -1) je Trainingstag | `TrainingsSpieltagEintrag.v`, geschrieben in `matchday-training-accumulator.ts` |
| Tests | `tests/training-vorlieben.test.ts`, `training-vorlieben-sicht.test.ts`, `training-plan-r2-vertrag.test.ts` |
| Aufnahmen | `scripts/screenshot-training-r2.ts` |

### 1.1 Gezeigt = gebucht, keine zweite Formel

Jede Zelle der Heatmap ist die Summe von Aufrufen der Buchungsfunktion `berechneSpieltagsZuwachs` über alle Trainingsspieltage bis Saisonende (Attribute wachsen von Tag zu Tag mit, die Decke bremst, Ausfalltage einer Verletzung zählen nicht, wie `prognostiziereDisziplinTraining`). Die Vorschau („Gewählt“), die Spalte SP der Kaderliste und die Kopf-Kennzahl „SP Kader“ nehmen dieselbe Funktion (`spBisSaisonende`); der Test `training-vorlieben.test.ts` prüft, dass eine Zelle mit einem Trainingstag exakt dem Ergebnis der Buchungsfunktion entspricht. „Eignung“ ist SP x Matrixgewicht / 100 (Matrix nur gelesen), „Luft bis Decke“ der Abstand des 60-%-Attributs zur Decke. Die Leistungs-Hälfte (PP) und der Abbau sind bewusst nicht in der Heatmap: sie zeigt, wohin Training wirkt.

### 1.2 Vorlieben

- **Ableitung** nur aus `player.id` (FNV-Hash je Disziplin) plus Klassenfarbe: Lieblinge mit +0,15 für die Klassenfarbe, die ungeliebte mit +0,15 für die Gegenfarbe (POW<->MEN, SPE<->SOC). Die im Konzept vorgesehene Tendenz „unter den besten / schwächsten fünf“ ist **weggelassen**: Stärke und Eignung ändern sich mit dem Training, die Vorlieben müssen über Saisons stabil bleiben und brauchen keinen Spielstandseintrag. Gleiches Spiel, gleiche Vorlieben, für Mensch und KI.
- **Wirkung (Chris, 23.11.: Boost +30 %, Malus -50 %):** Ziel = Lieblingsdisziplin: Trainingsbudget x1,30, Moral +3; ungeliebte: x0,50, Moral -6. (Bau-Stand war x1,15/x0,80 wie die Attribut-Affinität; die Messung unten gilt für diesen Stand.) Der Faktor liegt auf dem Budget je Spieltag in `berechneSpieltagsZuwachs`, also in Buchung, Vorschau und Heatmap zugleich. Der Moral-Grund gilt, solange die Disziplin das Ziel ist (gesetztes Ziel, sonst das Ziel des letzten gebuchten Trainingstags).
- **KI:** `bewerteTrainingsZiele` multipliziert die Punkte einer Disziplin mit 1,30 bzw. 0,50; entschieden wird weiter nach Kaderlücke. Delegierte Teams (Ramona) nutzen dieselbe Funktion.
- **Stempel:** `seasonState.trainingsVorlieben = { seasonId, regel: "v1" | "aus" }`. Neues Spiel: `v1` ab Saison 1 (`stempleTrainingsVorliebenBeimAnlegen`). Bestehender Spielstand: Lade-Migration schreibt für die laufende Saison `aus`, der Saisonwechsel (`preseason-workflow-service.ts`) setzt nach Schalter. Jeder Rechenweg fragt `trainingsVorliebenAktivFuer(gameState)`. Manager-Spielstände bekommen keinen Stempel.
- **Schalter** `OLY_TRAINING_VORLIEBEN` (nur Server): nicht gesetzt = an; `aus` = neue Saisons ohne Vorlieben; `aus-sofort` = Notbremse, schaltet die Wirkung auch mitten in der Saison ab. **Compose und `.env.example` sind nicht angefasst.** Vorschlag für `deploy/hetzner/docker-compose.yml`, Abschnitt `environment` des Dienstes `oly-app`: `OLY_TRAINING_VORLIEBEN: ${OLY_TRAINING_VORLIEBEN:-}`, und in `deploy/hetzner/.env.example` die auskommentierte Zeile `OLY_TRAINING_VORLIEBEN=` mit dem Hinweis „aus | aus-sofort“.
- **Mehrspieler:** die Vorliebe gehört dem Spieler, nicht dem Manager; die Seite liest das Team aus `selectedTeam` (aktives Manager-Team), der Schreibweg der Ziele ist unverändert (`onSetTrainingsZiele`, `authorizeServerRoomWrite`); Delegation „Training“ unverändert.

### 1.3 Nebel (fremdes Team)

Stufen wie in Konzept 3.4: eigenes Team alle drei, unbekannt nichts, beobachtet eine Lieblingsdisziplin, gescoutet alle drei; Stufe aus `getEffectiveRevealConfidence` (ab 40 beobachtet, 100 gescoutet, wie `nebelBreite`), „Fog of War aus“ zeigt alles. Sortiert wird nach Stufe, dann Name. „Beste Disziplin“ erscheint nur bei gescoutet.

## 2. Messung (Ausgleich und Soll aus #1696)

Werkzeug `scripts/miss-entwicklung.ts` (32 KI-Teams von Anfang an, zwei getrennt angelegte Spiele = zwei Saaten, zwei Saisons, echte Arena-Spieltage), neu: `--vorlieben an|aus` setzt den Stempel je Saison, die Kennzahlen enthalten `vorlieben` (Anteil Trainingstage mit Ziel = Liebling / ungeliebt, Moral-Mittel der Kaderspieler vor dem Abschluss).

**Ausgleich.** Der Erstlauf mit Faktor 1,0 (nur Saison 1, zwei Saaten) ergab: KI-Teams trainieren an 15,4 % / 17,8 % der Trainingstage ihre Lieblingsdisziplin (zufällig wären 10 %), an 2,1 % / 1,3 % die ungeliebte. Daraus folgt ein Mehr an Trainingsbudget von 1 + 0,15 x 0,154 - 0,20 x 0,021 = +1,9 % und 1 + 0,15 x 0,178 - 0,20 x 0,013 = +2,4 %; der direkte Vergleich der Trainingserträge mit gegen ohne Regel lag bei +0,8 % und +3,4 % (Rauschen der Läufe). Das ist weniger als die im Konzept angenommenen 4,4 %, weil die KI nach Kaderlücke wählt und die Vorlieben nur gewichtet. **`TRAININGS_VORLIEBEN_AUSGLEICH = 0,979`** (1 / 1,021): Faktor auf das Trainingsbudget je Spieltag, nur solange der Stempel `v1` ist (der Rückweg `aus` liefert exakt den Stand vor Runde 2). Der Konzeptsatz „Grundrate -4,4 %“ gilt nur für 35 % Lieblings-Ziele; gemessen sind es 17 %.

**Endlauf** mit Ausgleich 0,979, je Saat und Saison gegen den Lauf ohne Regel (`OLY_TRAINING_VORLIEBEN=aus`, derselbe Ausgangsstand; Trainingsertrag = mittlere Summe der gebuchten Trainingszuwächse je Spieler):

| Saat | Saison | Training ohne | Training mit | Unterschied | Liebling % | Ungeliebt % | Liga-Mittel Netto ohne / mit | Moral ohne / mit |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 3,68 | 3,63 | -1,4 % | 15,4 | 2,1 | -0,49 / -0,52 | 51,5 / 51,7 |
| 1 | 2 | 3,64 | 3,68 | +1,1 % | 17,8 | 0,9 | -0,40 / -0,35 | 54,7 / 55,2 |
| 2 | 1 | 3,86 | 3,86 | 0,0 % | 17,8 | 1,3 | -0,49 / -0,51 | 50,8 / 51,3 |
| 2 | 2 | 3,53 | 3,55 | +0,6 % | 16,5 | 1,6 | -0,43 / -0,22 | 52,2 / 52,8 |
| **Mittel** | | **3,68** | **3,68** | **+0,1 %** | **16,9** | **1,5** | **-0,45 / -0,40** | **52,3 / 52,8** |

Ergebnis: das Liga-Mittel des Trainingsertrags bleibt innerhalb ±1 % (gepoolt +0,1 %, Einzelwerte -1,4 bis +1,1 %, das ist Laufrauschen). Moral im Mittel +0,5 Punkte (Lieblings-Ziele +3 wiegen mehr als die seltene ungeliebte).

**Soll aus #1696 (Verteilung, Liga-Mittel der Netto-Summe aller zwölf Attribute), ohne / mit Regel, Mittel über die vier Läufe:** Liga-Mittel -0,45 / -0,40 (Soll -1 bis +1); deutlich besser (Summe >= +8) 4,4 % / 4,9 % (Soll 5-8, je Lauf 2,9-5,6 bzw. 4,4-5,6); deutlich schlechter (<= -8) 7,0 % / 6,1 %; kaum verändert (|Summe| <= 2) 50,7 % / 49,8 % (Soll 50-60); Trainingsanteil 63,8 % / 63,6 % (Soll 60). Die Verteilung verschiebt sich durch die Vorlieben nicht über das Rauschen hinaus; die Abweichungen vom Soll (Saison 2 mit wenigen Stark-Besseren) bestehen auch ohne die Regel und sind nicht Gegenstand dieser Runde.


## 3. Abgleich mit dem Mockup

Aufnahmen aus der echten App (Dev-Server, Kopie des Live-Abbilds vom 23.11., Death Peaches, Saison 1, Spieltag 12; für die Aufnahme sind Vorlieben und neue Entwicklungsregel auf der Kopie gestempelt) neben dem Mockup, 1920x1080 und 2560x1440, eine Ansicht bei 1710x1112: `docs/design/training-r2-22-11/vergleich-*.png` (links Mockup, rechts App). Kein Seitenscroll in allen 15 Aufnahmen, 0 JS-Fehler. Die Zahlen unterscheiden sich vom Mockup, weil das Mockup ein vereinfachtes Modell war und die App die Engine zeigt (z. B. Maru: beste Zelle Mini DM +2,27 statt Gewichtheben +2,88).

| Mockup-Merkmal | Stand | Anmerkung |
|---|---|---|
| Heatmap 20 Disziplinen x 3 Wege, vier Tafeln POW/SPE/MEN/SOC in Bereichsfarben mit Icon | drin | je Tafel nach bester Zelle sortiert, „am meisten“ im Kopf |
| Klassenfarbe / Gegenfarbe an der Tafel | drin | Klassenfarbe aus `klassenKartenfarbe` |
| Standardmaß Skillpunkte, Umschalter Eignung / Luft | drin | gleiche Rechnung wie die Buchung |
| Zelle: Wert, 60-%-Attribut, DECKE-Marke, Tooltip mit allen drei Attributen | drin | Tooltip als eigene feste Box (nicht abgeschnitten) |
| Beste Zelle gold mit „★ Beste“ | drin | bei Gleichstand SP entscheidet der Eignungszuwachs |
| Gewählte Zelle weißer Doppelrahmen, Marke „Gewählt“ | drin | beide zugleich: außen weiß, innen gold |
| Vorlieben mit Herz / Daumen vor dem Namen, Faktor, hinterlegte Zeile | drin | SVG, keine Emojis |
| Eignung und Rang in der Liga je Disziplin | angepasst | Rang unter den Kaderspielern der eigenen Liga, aus den Eignungen im Spielstand |
| Kaderliste: Ziel · Weg, Vorlieben, SP und „bisher“, sortierbar | drin | Sortierung nach Spieler, Vorlieben, SP |
| Wünsche erfüllen | angepasst | im Kopf der Kaderliste (im Mockup nicht vorhanden, Funktion bleibt) |
| Kopf: SP Kader, trainieren Liebling / Ungeliebtes, Verletzte | angepasst | bestehendes Band mit Kennzahlen; Liebling und Ungeliebt in einer Kachel „Vorlieben 3 · 0“; Wappen-Hero des Mockups nicht übernommen |
| Vorschau: Spielerkarte mit Moral, Moral-Delta (+3 / -6), Form | drin | Moral und Form aus dem Spielstand |
| Intensität Leicht / Mittel / Hart oben in der Vorschau, Wunschpunkt | drin | Wunsch-Moral als Chip im Kasten „Gewählt“ |
| Kasten Trainingsvorlieben (drei Karten + Folge-Satz) | drin | |
| Fortschritt dieser Saison (12 Attribute, größter gold, Tooltip Start -> heute) | drin | aus dem Trainingsverlauf; Balken netto (Training + Leistung - Abbau), Kopfzahl nur Training |
| Gewählt: Weg-Profil 60/25/15 mit Decke, Chips (Satz, Vorliebe, Decke bremst, Potenzial) | drin | Potenzial-Chip und Decken-Hinweis aus derselben Funktion |
| Wo das ankommt, Top 6 | drin | Engine-Eignung über `baueWirkungVergleich` |
| Belastung der nächsten sechs Spieltage | drin | `berechneBelastungsForecast` |
| Verletzte: „Training ruht“, gekürzte Zahl der Trainings | drin | |
| Fremdes Team unter Scouting-Nebel, drei Stufen, Regel in Zahlen | drin | Teamwahl per Auswahlfeld; Spalte „Beste Disziplin“ nur bei gescoutet |
| Demo-Leiste, URL-Parameter (`?vorlieben=aus`, `?mass=`) | fehlt (nur Mockup) | im Spiel: Stempel und Umschalter |
| Phone | fehlt | war nicht Teil des Entwurfs |

Korrekturschleife (Funde beim Ansehen der Aufnahmen): SVG-Grundregeln fehlten (riesige Herzen), Vorschau lief bei Verletzten über (Abstände gestrafft, Knöpfe fest am Fuß, Rest scrollt im Kasten), Kennzahlen überlappten im Kopf bei 1710 und 2560 (Kacheln gekürzt, Platzhalter-Reiter „Liga“ bei schmalen Fenstern ausgeblendet), Klick-Treffer auf Kaderzeilen, 4 px Seitenscroll bei 2560 (Höhe der Seite), „Eignung –“ in „Gewählt“, wenn die Disziplin nicht unter den Top 6 liegt.

## 4. Offen

- Compose- und `.env.example`-Zeile (siehe 1.2) fehlen absichtlich; ohne sie gilt auf dem Server der Standard (an).
- Der Kader-Reiter zeigt die Vorlieben noch nicht als Spalte (nur der Plan).
- Menschen wählen ihr Ziel gezielter als die KI; ist der Lieblings-Anteil bei ihnen deutlich höher als bei der KI (KI gemessen: 17 %), liegt ihr Trainingsertrag leicht über dem Ligamittel. Beobachten, ggf. `TRAININGS_VORLIEBEN_AUSGLEICH` nachziehen.
- Zwei Saaten und zwei Saisons ergeben ein Messrauschen von rund 1 bis 2 % im Trainingsertrag zwischen zwei Läufen (Verletzungen und Aufstellungen laufen auseinander); der Ausgleich ist deshalb zusätzlich aus dem Anteil der Lieblings- und Ungeliebt-Tage hergeleitet (Abschnitt 2).


## Nachtrag 23.11.: +30 % / -50 % ohne Neumessung

Chris: „Mach mal den Boost, wenn Leute was mögen, zu +30 % und Malus -50 %. Beim Training musst du nicht messen, nur kurz umstellen.“
`VORLIEBE_FAKTOR_LIEBLING = 1,3`, `VORLIEBE_FAKTOR_UNGELIEBT = 0,5`. Der Ausgleich ist aus den gemessenen Zielanteilen der KI gerechnet, nicht
neu gemessen: 0,169 × 0,30 − 0,015 × 0,50 = +4,3 % Budget, also **`TRAININGS_VORLIEBEN_AUSGLEICH = 0,959`**. Menschen, die gezielter auf
Lieblinge trainieren, liegen damit leicht über dem Ligamittel; das ist gewollt (die Vorliebe soll sich lohnen).

Die Vorlieben hängen nicht an der Eignung: gewürfelt aus der Spieler-ID (FNV-Hash), nur mit leichter Tendenz +0,15 zur Klassenfarbe bzw. für
die ungeliebte zur Gegenfarbe. Ein Spieler kann also eine Disziplin mögen, in der er schwach ist, und eine nicht mögen, in der er stark ist.
