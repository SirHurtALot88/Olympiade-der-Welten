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

**Pp-Abweichung: NICHT neu gemessen.** Ein Strom n=48 kostet im Node-Motor rund 45 CPU-Minuten (Hockey-Messung `messe-arena-einfluss.mjs`, Pool = 3 Ströme, zwei Pools verlangt); der Rechner war durch andere Sitzungen ausgelastet, der gestartete Pool wurde abgebrochen. Gepoolter Altwert 19,9 / 20,3 (nicht frisch). Erwartung: Torwart-Wert hängt jetzt zu 60 % an der matrixgewichteten Eignung, die Abweichung sollte nicht steigen; das ist eine Erwartung, keine Messung. Beleg-Befehl: `OLY_FORM_MODUS=echt node scripts/messe-arena-einfluss.mjs hockey 48 --saat-versatz=0|1e7|2e7 --rohdaten=...` plus `poole-arena-einfluss.mjs`.

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

Offen: (a) Pp-Abweichung nach der Regel nicht neu gemessen (Abschnitt 3); (b) Torwart-Referenz ist dünn (128 Werte je Größe); (c) Hockey-rho bleibt unter 0,75, Hebel liegt bei den Feldspielern.
