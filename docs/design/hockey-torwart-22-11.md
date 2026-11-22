# Hockey: Torwart-Balance, Puste unter Dauerfeuer, PP-Referenz (22.11.)

Arbeitsliste 21.11., Welle 4: „Hockey: Torwart-Balance (Puste unter Dauerfeuer oder Gegentor-Abzug), PP-Skala.“
Vorgeschichte: `hockey-opus-review-nhl.md`, `hockey-torwart-konstanten-nachgezogen.md`, `hockey-h4-h5-messung-02-10.md` (GSAx-Versuch), `pp-analyse-21-11.md`.

## 1. Analyse (Messung vor der Änderung, `OLY_FORM_MODUS=echt`, Kader-Familie, jeSeite 6)

| Größe | Befund |
|---|---|
| Parade-Güte und Eignung | **Korrelation PARADE gegen Hockey-Eignung −0,05** (Kader-Familie, 17 Torwarte). PARADE = awareness/will/determination/health/dexterity; die Matrix gewichtet power 18, speed 12, spirit 12, stamina 10 … Ein Torwart mit hoher Matrix-Eignung hielt Durchschnitt. |
| Wirkung der Güte | `paradeFaktor` 1,00 (PARADE 20) bis 0,55 (95), Steigung 0,006 je Punkt. Eine Streuung von 9 PARADE-Punkten verschiebt die Fangquote um ±0,7 Prozentpunkte, das Spielrauschen (39 Schüsse, 5 Gegentore) liegt bei ±2 Toren. Rang-Korrelation Eignung gegen Wert je Torwart-Zeile: **0,32–0,37**. |
| Dauerfeuer | Der Torwart hat einen Puste-Vorrat (aus AUSDAUER), der nie angetastet wurde: tiefster Stand im Mittel 119 von 121. Schüsse in Serie kosteten nichts. |
| Gegentore | Der Torwart-Wert `BASIS + 2·(Schüsse·(1−REF) − Gegentore)` bucht jedes Gegentor voll; ein Spiel mit 5 Gegentoren ist ein Würfelwurf (sd des Wertes 6,0). |
| Rangtreue | alle 12 Teilnehmer 0,656, nur Feldspieler 0,707 (Lücke 0,05); der Torwart zog das Einzelspiel-rho runter. |
| PP | Torwart-PP im Mittel 1,35–1,40 gegen Feld 1,39 (passt); bester Torwart je Tag 3,9–4,2; Torwart-Referenz (p50 10,22 / p99,5 19,09) aus September. |

## 2. Was gebaut ist (`HK_TW_REGEL` in `public/mockups/battle-mode.engine.js`)

1. **Güte aus der Eignung (Nebenweg)**: Parade-Güte = 0,4·PARADE + 0,6·(auf die PARADE-Skala gelegte Eignung `eig`). Primärweg PARADE bleibt, die Matrix kommt über `eig` durch. Steilere Kurve (0,022 statt 0,006 je Punkt, gleiche Mitte), damit der Unterschied gegen das Schussrauschen sichtbar wird.
2. **Puste unter Dauerfeuer**: jeder Schuss, der den Torwart erreicht, kostet 4 Puste (vorhandener Vorrat, vorhandene Regeneration, vorhandene Leiste unter den Füßen); bei leerer Puste −12 Güte-Punkte. Schwacher AUSDAUER-Wert = kleiner Vorrat = tieferer Einbruch. Ticker „… steht unter Dauerfeuer — die Puste geht aus.“ (einmal unter 30 %).
3. **Gegentore halb als erwartete Gegentore** im Torwart-Wert (Prinzip K3 der Feldspieler): im Erwartungswert gleich, das Münzwurf-Rauschen halbiert. Ein Gegentor bleibt der teuerste Posten.
4. Nachziehung: `skalaMul` 0,92 (Torzahl: 5,20 Gegentore je Spiel gegen 5,14–5,20 vorher), Neu-Referenz `ref` 0,866 und `basis` 9,23 für den Torwart-Wert.
5. **Keine neue Figur, keine Animation, Matrix unangetastet.** Alles liest `eig`, PARADE, AUSDAUER und den Puste-Vorrat.

Nicht gebaut: eine eigene PP-Skala (die Skala C2 bleibt, siehe 4).

## 3. Abnahme

Befehle: `OLY_FORM_MODUS=echt node scripts/miss-alle-disziplinen.mjs 24 hockey --node`; paarweise n=48 über `disziplinProbe` (Node-Motor, fünf Kader, Saat 1337 und 777).

| rho je Spiel (Median/Mittel über 5 Kader) | alt | neu |
|---|---:|---:|
| offizielle Messung, n=24 (Saat 1337): alle 12 | 0,656 | **0,681** |
| … nur Feldspieler | 0,707 | 0,710 |
| … Saison alle 12 | 0,755 | 0,797 |
| n=48, Saat 1337: alle 12 / nur Feld | 0,698 / 0,733 | **0,715** / 0,723 |
| n=48, Saat 777: alle 12 / nur Feld (Zwischenstand der Konstanten) | 0,699 / 0,750 | 0,727 / 0,756 |
| Lücke alle − Feld | −0,035 … −0,051 | −0,008 … −0,029 |
| Torwart: Rang-Korrelation Eignung gegen Wert | 0,32–0,37 | 0,59–0,63 |
| Torwart: tiefster Puste-Stand (von 121) | 119 | 68 |

**Ehrlich gelesen:** Der Torwart-Abschlag auf das Einzelspiel-rho schrumpft um rund 0,02–0,03, die Feldspieler bewegen sich im Kaderrauschen (Spannweite 0,12–0,20, Differenzen ±0,01–0,02). **Hockey bleibt mit 0,68–0,72 unter der Mindestschranke 0,75** (der Feldspieler-Anteil allein liegt bei 0,71–0,73, die Ausnahme steht unverändert in `ARENA_ABNAHME_AUSNAHMEN`); die Lücke ist Feldspiel-Validität, nicht Torwart. Der Dauerfeuer-Anteil allein bewegte rho im Rauschen, hob aber die Saison-Validität (0,741 → 0,853 in einer Probe) und gibt AUSDAUER einen Kanal.

Rangtreue nach Rolle, Einzelkader (`miss-rangtreue-nach-rolle.mjs hockey 48`, jetzt mit `OLY_FORM_MODUS=echt`; Vorwert ohne echte Formkarten 0,930 / 0,973 / Lücke 0,043): alle 0,965, nur Feldspieler 0,982, Lücke 0,017.

**Pp-Abweichung (gemessen 22.11., nach der Regel):** auf `claude/sammel-22-11-c` (GESAMT `0310ec4a4e3d`), `OLY_FORM_MODUS=echt node scripts/messe-arena-einfluss.mjs hockey 48`, zwei Ströme (Saatversatz 0 und 1e7): Einzelstrom 24,2 bzw. 39,0 Pp (einzelne Hockey-Ströme sind bekanntlich stark verrauscht), **gepoolt (`poole-arena-einfluss.mjs`) 16,2 Pp** — besser als der alte gepoolte Wert 19,9/20,3 und unter der Pflichtschranke 25. Über Matrixgewicht: dexterity +5,2 (2,1 SE), will +2,7 (5,6 SE), determination +0,2; unter: stamina −5,1. Einschränkung: nur ein Pool aus zwei Strömen (das Handbuch sieht drei Ströme je Pool vor). Eingetragen in `data/generated/disziplin-abnahme.json` (`pp` = [16,2, 20,3]: der erste Wert ist diese Messung, der zweite der alte Pool 2 der alten Regel, nicht neu gemessen und nur für den Wächter (≥ 2 Werte) stehen gelassen; alter Stand unter `ppVorTorwartRegel`).

## 4. PP

Die Torwart-Zeilen der Referenz (`hockey-pps-referenz.json`, `feldgroessenTorwart` n=3..6) sind **neu gezogen** (`ziehe-hockey-pps-referenz.ts --feldgroesse=n`, Save `new-game-1795114260527-nzr0z9`); die Feldspieler-Zeilen bleiben (die Regel berührt sie nicht). n=6: Median 10,22 → 11,43, p99,5 19,09 → 16,78. Ohne Neuziehung hätte die gedämpfte Obergrenze des Torwart-Wertes (Gegentor-Rauschen halbiert) den besten Torwart eines Tages von 4,2 auf 3,6 PP gedrückt.

Synthetische Spieltage (16 Spiele × 5 Kader, 15 Tage, `ppAusKurveSkaliert`, C2, jeSeite 6):

| | alt (alte Referenz) | neu (neue Referenz) |
|---|---:|---:|
| Torwart-PP Mittel / Feld-PP Mittel | 1,40 / 1,39 | 1,45 / 1,39 |
| bester Torwart je Tag (Mittel) | 4,24 | **4,53** |
| Torwarte in der Tages-Top-10 (von 10) | 2,9 | 2,9 |
| Torwart-Einsätze ≥ 4 PP | 3,7 % | 6,7 % |
| Tagesbester überhaupt (Mittel) | 4,76 | 4,76 |

Hinweis: Der Tagesbeste liegt wie in `pp-analyse-21-11.md` bei 4,7–4,8 (fester Anker der Feldspieler); das ist das Thema „Tagesanker“ (Stufe 1 dort) und hier nicht angefasst.

## 5. Regel-Stempel und Rückweg (gezeigt = gebucht)

`lib/resolve/hockey-torwart.ts` (Muster `climbing-format.ts`): `seasonState.hockeyTorwart` als Wechselliste, gesetzt beim Laden; Umstellung ab dem nächsten gewerteten Spieltag, gebuchte Spieltage behalten „alt“. Der Wert reist im Kader-Umschlag (`formatByDisciplineId.hockey`, Host/Chromium-Runner/Node-Motor) und steht im Eingabe-Hash des Hockey-Vorlaufs. Schalter `OLY_HOCKEY_TORWART=alt` (compose/Dockerfile/.env.example). Messhebel `window.__arena.hockeyTorwart("alt"|obj|null)`.

**Fingerabdruck:** `GESAMT 5b9acba4fe42` → **`0310ec4a4e3d`**; verglichen mit dem Basis-Branch bewegen sich **nur** `spiele hockey 1|7|42` (c3d67a7dbb14/0af1d2c8ec69/d06c32d9bf5e → 1e83d67c8161/86de5c3617bf/d7bf5303d471). Die alte Regel ist außerhalb von GESAMT geschützt: `HOCKEY-TORWART-ALT cdc62aeea8e4` (drei Zeilen, die alten Werte, bit-identisch). Neue Zähler stehen in einer WeakMap, nicht am Spielerobjekt (sonst wanderte der Fingerabdruck auch im Rückweg).

## 6. Aufnahmen und Offenes

Aufnahmen aus der **Motor-Seite** (`scripts/screenshot-hockey-torwart.mjs`, `docs/design/hockey-torwart-22-11/`): `neu-1920x1080.png`, `neu-2560x1440.png`, `neu-canvas-dauerfeuer.png`, `alt-canvas-dauerfeuer.png`. Angesehen: Torwart-Karte, Puste-Leiste unter den Füßen des Torwarts und Ticker laufen; keine Überlappung, kein Seitenfehler. Nicht aus der eingeloggten App-Hostseite (kein Login im Container). Die Leiste ist klein; ein eigenes Torwart-HUD wurde nicht gebaut.

Offen: (a) Pp-Pool nur aus zwei Strömen (Abschnitt 3); (b) Torwart-Referenz ist dünn (128 Werte je Größe); (c) Hockey-rho bleibt unter 0,75, Hebel liegt bei den Feldspielern.

## 7. Review-Nachtrag (Opus, 22.11.) und Behebung

| # | Befund | Behebung |
|---|---|---|
| 1 | Torwart-PP-Referenz war eine einzige statische Zeile (`feldgroessenTorwart`), neu gezogen. Mit "alt" aufgelöste Spieltage (Schalter `OLY_HOCKEY_TORWART=alt`, `forceReplace` eines vor dem Deploy gebuchten Spieltags) bekamen damit die NEUE Referenz. | Die alten Torwart-Zeilen stehen unverändert (aus `origin/main`) als `feldgroessenTorwartAlt` in `data/generated/hockey-pps-referenz.json`. `resolveArenaPpsReferenz(..., rolle, torwartRegel)` und `computeIndividualBoxscorePpsFromFixtureResults(..., ppSkala, torwartRegel)` wählen nach `hockeyTorwartFuer(gameState, matchdayId)` (Aufrufer: `runBattleModeArenaMatchday`). `ziehe-hockey-pps-referenz.ts` lässt `feldgroessenTorwartAlt` beim Neuziehen stehen. Test: `tests/battle-mode-arena-team-points.test.ts` ("Torwart-Referenz je Regel": alt bit-genau 8,42/16,99 (n=3) und 11,19/18,16 (n=4), neu 11,21/17,13; Feld unberührt). |
| 2 | E1-/C2-Anker für Hockey unter der alten Regel gemessen (Review-Sonde: Tore je Spiel 10,52 → 9,35, mittlerer Tor-Abstand 2,62 → 2,35, −11 %). | Siehe Abschnitt 8. |
| 3 | `bestimmeTorwaerter` (Motor) wählt ohne gesetzten Slot nach höchstem PARADE, die Güte ist aber zu 60 % Eignung. | Motor bewusst nicht angefasst (Fingerabdruck). Geprüft: Auf der TS-Seite wählt nichts nach PARADE (`grep` über `lib/`, `app/`, `components/`: PARADE kommt nur im Motor vor). Die Aufstellung (KI wie Mensch) setzt den Torwart über den Slot `goaltender` (Slot-Rollenprofil `matchday-slot-roles.ts`: health/awareness/dexterity plus die Matrix über die Eignung) und der Adapter reicht ihn als `place[name].slot` an den Motor (`arena-aufstellung-adapter.ts`, `slotGesetzt`). Der PARADE-Rückfall greift damit nur, wenn kein Slot gesetzt ist (Messläufe ohne Aufstellung, Mockup-Seite). Die KI-Torwartwahl ist also schon eignungsbasiert und passt zur neuen Güte; eine geteilte Funktion bräuchte hier nur eine Änderung am Motor-Rückfall und wäre eine Wertungsfrage (Fingerabdruck), deshalb nur dokumentiert. |
| 4 | Doku-Nachträge | Siehe unten. |

**Slot-Aufschlag zählt doppelt in die Güte (klein).** `engP` fließt in `eig` (`eig: basisWert + engP + breitP`, Motor ~12345) und über `mitAufschlag(...)` zugleich in die Attribute und damit in PARADE (~12315). Die Torwart-Güte (0,4 PARADE + 0,6 Eignung) trägt den Slot-Aufschlag deshalb auf beiden Wegen. Der Effekt ist klein (der Aufschlag ist wenige Punkte, der Torwart steht immer im selben Slot, also gilt er für alle Torwarte gleich) und wurde bewusst nicht entfernt, weil das den Fingerabdruck (alt und neu) bewegen würde.

**`rhoJeSpielNurFeldspieler` 0,784 → 0,71 in `data/generated/disziplin-abnahme.json`.** Der alte Wert 0,784 stammt aus der Ersatzkarten-Messung (`OLY_FORM_MODUS` nicht echt, Stand 15.11.); mit gespielten Formkarten (`OLY_FORM_MODUS=echt`, seit 18.11.) lag derselbe Wert schon bei 0,707 ("alt, nur Feld" in Abschnitt 3 dieses Dokuments). Der Sprung auf 0,71 ist also kein Effekt der Torwart-Regel, sondern der Wechsel des Formmodus; die neue Messung (22.11.) bestätigt 0,71 für die Feldspieler.

## 8. C2- und E1-Anker je Regel (Nachmessung 22.11.)

Die Anker (`pp-skala-kalibrierung.json`, `ergebnis-skala-kalibrierung.json`) waren unter der alten Regel gemessen. Nachgemessen auf **sechs frischen Battle-Saves** (`miss-pp-skala.ts 20`, `OLY_PP_SKALA=roh`, `OLY_PP_SKALA_ARENA_MODUS=quick-sim`, Node-Motor, neue Regel, GESAMT `0310ec4a4e3d`), danach `werte-pp-skala-aus.mjs --nur-hockey` und `werte-ergebnisskala-aus.ts --nur-hockey` (neue Schalter, wie `--nur-battlefield`; alle übrigen Disziplinen bleiben byte-gleich).

| | alt (87 Duelle, 20 Zellen) | neu (178 Duelle, 24 Zellen) |
|---|---:|---:|
| C2 `rTop` (Median Tagesbester, Disziplin-weit) | 6,84 | **5,51** (−19 %) |
| C2 `rMed` (Median aller Einsätze) | 1,34 | 1,36 (+1,5 %) |
| E1 Duell, Median der Siegmarge (Lage 0,5) | 4 | 6 |
| E1 Duell, Lage 0,975 | 24,7 | 21,6 |
| E1 Leistungs-Anker lP5 / lP50 / lP95 | 0,472 / 1,416 / 3,187 | 0,405 / 1,439 / 3,367 |

`rTop` weicht um mehr als 5 % ab (die Spitze unter der neuen Regel ist niedriger: der gedämpfte Torwart-Wert erreicht seltener die Obergrenze), ebenso die Margen-Knoten. **Folge: Anker je Regel.** `hockeyAlt` (PP, Schlüssel `torwartAlt`) und `duellTorwartAlt` (E1) tragen die alten Werte unverändert; `hockey` bzw. `duell` die neu gemessenen. Gewählt wird nach `hockeyTorwartFuer(gameState, matchdayId)`: PP in `computeIndividualBoxscorePpsFromFixtureResults` (Variante `torwartAlt`), E1 in der Resolve-Engine (`podVariante: "torwartAlt"` für Hockey-Duelle). Test: `tests/hockey-anker-je-regel.test.ts`.

Einschränkung: Hockey kommt nur zweimal je Saison vor, 24 PP-Zellen sind wenige (die Einzelzellen je Feldgröße schwanken stark, deshalb gilt Disziplin-weit der Median; Feldgrößen mit nur zwei Zellen tragen entsprechendes Rauschen). Bei Gelegenheit mit mehr Saves nachziehen (`--nur-hockey`).

