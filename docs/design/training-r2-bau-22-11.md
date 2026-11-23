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
- **Wirkung:** Ziel = Lieblingsdisziplin: Trainingsbudget x1,15 (`SIGNATURE_ORGANIC_GROWTH_MULTIPLIER`), Moral +3; ungeliebte: x0,80 (`WEAK_ORGANIC_GROWTH_MULTIPLIER`), Moral -6. Der Faktor liegt auf dem Budget je Spieltag in `berechneSpieltagsZuwachs`, also in Buchung, Vorschau und Heatmap zugleich. Der Moral-Grund gilt, solange die Disziplin das Ziel ist (gesetztes Ziel, sonst das Ziel des letzten gebuchten Trainingstags).
- **KI:** `bewerteTrainingsZiele` multipliziert die Punkte einer Disziplin mit 1,15 bzw. 0,80; entschieden wird weiter nach Kaderlücke. Delegierte Teams (Ramona) nutzen dieselbe Funktion.
- **Stempel:** `seasonState.trainingsVorlieben = { seasonId, regel: "v1" | "aus" }`. Neues Spiel: `v1` ab Saison 1 (`stempleTrainingsVorliebenBeimAnlegen`). Bestehender Spielstand: Lade-Migration schreibt für die laufende Saison `aus`, der Saisonwechsel (`preseason-workflow-service.ts`) setzt nach Schalter. Jeder Rechenweg fragt `trainingsVorliebenAktivFuer(gameState)`. Manager-Spielstände bekommen keinen Stempel.
- **Schalter** `OLY_TRAINING_VORLIEBEN` (nur Server): nicht gesetzt = an; `aus` = neue Saisons ohne Vorlieben; `aus-sofort` = Notbremse, schaltet die Wirkung auch mitten in der Saison ab. **Compose und `.env.example` sind nicht angefasst.** Vorschlag für `deploy/hetzner/docker-compose.yml`, Abschnitt `environment` des Dienstes `oly-app`: `OLY_TRAINING_VORLIEBEN: ${OLY_TRAINING_VORLIEBEN:-}`, und in `deploy/hetzner/.env.example` die auskommentierte Zeile `OLY_TRAINING_VORLIEBEN=` mit dem Hinweis „aus | aus-sofort“.
- **Mehrspieler:** die Vorliebe gehört dem Spieler, nicht dem Manager; die Seite liest das Team aus `selectedTeam` (aktives Manager-Team), der Schreibweg der Ziele ist unverändert (`onSetTrainingsZiele`, `authorizeServerRoomWrite`); Delegation „Training“ unverändert.

### 1.3 Nebel (fremdes Team)

Stufen wie in Konzept 3.4: eigenes Team alle drei, unbekannt nichts, beobachtet eine Lieblingsdisziplin, gescoutet alle drei; Stufe aus `getEffectiveRevealConfidence` (ab 40 beobachtet, 100 gescoutet, wie `nebelBreite`), „Fog of War aus“ zeigt alles. Sortiert wird nach Stufe, dann Name. „Beste Disziplin“ erscheint nur bei gescoutet.

## 2. Messung (Ausgleich und Soll aus #1696)

Werkzeug `scripts/miss-entwicklung.ts` (32 KI-Teams von Anfang an, zwei getrennt angelegte Spiele = zwei Saaten, zwei Saisons, echte Arena-Spieltage), neu: `--vorlieben an|aus` setzt den Stempel je Saison, die Kennzahlen enthalten `vorlieben` (Anteil Trainingstage mit Ziel = Liebling / ungeliebt, Moral-Mittel der Kaderspieler vor dem Abschluss).

MESSUNG_PLATZHALTER

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
- Menschen wählen ihr Ziel gezielter als die KI; ist der Lieblings-Anteil bei ihnen deutlich höher als bei der KI (hier gemessen), liegt ihr Trainingsertrag leicht über dem Ligamittel. Beobachten, ggf. `TRAININGS_VORLIEBEN_AUSGLEICH` nachziehen.
- Zwei Saaten und zwei Saisons ergeben ein Messrauschen von rund 1 bis 2 % im Trainingsertrag zwischen zwei Läufen (Verletzungen und Aufstellungen laufen auseinander); der Ausgleich ist deshalb zusätzlich aus dem Anteil der Lieblings- und Ungeliebt-Tage hergeleitet (Abschnitt 2).
