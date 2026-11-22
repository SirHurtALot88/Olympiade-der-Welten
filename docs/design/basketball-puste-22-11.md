# Basketball: Puste und Beteiligungsboden, Maru-Fall (22.11.)

Arbeitsliste 21.11., Welle 4: „Basketball: Puste; Maru-Fall ST7 (fast null Beteiligung) prüfen.“
Vorgeschichte: `benchmark-basketball-17-11.md` (Stand bis Runde 2), Muster der Regel-Verdrahtung: `hockey-torwart-22-11.md`.

## 1. Diagnose Maru-Fall (Teil A, ohne Code)

Quelle: Abbild `live-save` (Spielstand `new-game-1795114260527-nzr0z9`, Death Peaches `D-P`), nur gelesen, Kopie im Scratch.

| Befund | Wert |
|---|---|
| Begegnung | Spieltag 7, Basketball, `D-P` gegen `R-C`, gebucht 68:73, E1 4:6, Platz 3 |
| Aufstellung (4 je Seite) | Queen Loriana (Floor General), Lilithara (Rim Pressure), Maru (Perimeter), Brightpaw (Help Defense); Maru heißt im Kader Maru, Sprinter, Basketball-Eignung 37, Slot gültig, Spieler nur einmal, Verletzung/Form unauffällig (Form −0,2) |
| Eignung im Spiel | Queen 72,3 / Brightpaw 59,3 / Lilithara 55,8 / **Maru 36,8**; bei den Gegnern liegt keiner unter 50: Maru ist der schwächste der acht Spieler |
| gebuchte PP | Maru 0,04 (Rang 4 im Team, Rang 101 der Disziplin), die drei anderen 1,4 bis 2,0 |

**Nachspielen** (`scripts/diagnose-maru-fixture.ts` zieht die Eingabe über `bereiteFixturesVor`, `scripts/diagnose-maru-replay.mjs` spielt sie im Node-Motor; gleiche Aufstellung, gleiche Saat; Form und Attribute sind seit Spieltag 7 weitergelaufen, deshalb 67:74 statt 68:73): 175 Ereignisse, davon **4 für Maru** (2 Würfe, 0 Treffer, 1 Rebound, 1 Steal, keine Vorlage), seine Mitspieler 23 bis 30.

**Ursache: Mechanik, kein Fehler.** Gezeigt = gebucht stimmt, die Übergabe ist sauber (richtiger Slot, keine Doppelung, Figur da). Die Pass-Lotterie (`offensterMitspieler`) gewichtet jeden Anspielpartner mit `(ABSCHLUSS−20)² x qualitaet²` (`USAGE_KAPPA` 2, bewusst steil: das ist der Kanal, über den die Eignung die Rangtreue trägt, Validität). Maru hat ABSCHLUSS 48, TECHNIK 41, TEAMGEIST 34 und damit Gewicht 254 gegen 804 bis 2375 bei den Mitspielern: rund **5 %** aller Anspiele einer Seite. Wer im Spiel der schwächste ist, wird zum Zuschauer.

**Häufigkeit (vorher)**, `scripts/miss-basketball-beteiligung.mjs`, `OLY_FORM_MODUS=echt`, Kader-Familie (5 Paarungen x 24 Spiele), Ballaktionen = Würfe + Assists + Rebounds + Steals + Blocks + Ballverluste (Mittel je Spieler 27 bei 4 je Seite):

| Feldgröße | Geist (höchstens 3 Aktionen) | schwächster der Paarung ist Geist | Schweiger (höchstens 1 Wurf) |
|---|---:|---:|---:|
| 2 je Seite | 0,0 % | 0,0 % | 0,0 % |
| **4 je Seite** (Marus Fall) | **3,9 %** | **29,2 %** | 5,0 % |
| 6 je Seite | 9,0 % | 69,2 % | 10,8 % |

Bei vier je Seite hat also in rund jedem vierten Spiel jemand fast null Beteiligung; bei sechs je Seite fast immer der Schwächste. Das ist die Folge der steilen Pass-Lotterie, kein Zufall.

## 2. Was gebaut ist

Das Feldspiel-Chassis führt Puste seit dem Hockey-Bau (`FELDSPIEL_ART.hockey.puste`: Vorrat aus AUSDAUER, Netto-Modell, Leiste unter den Füßen, Anzeige in der Spielerkarte). Basketball hatte kein Rezept; sein Sub-Skill AUSDAUER (stamina 48, spirit 22, torment 18, speed 12) war „mechanisch tot“. `BB_PUSTE_KONSTANTE` in `public/mockups/battle-mode.engine.js` gibt ihm den Kanal, als Getter `FELDSPIEL_ART.basketball.puste` (ohne Rezept ist jede Puste-Zeile des Motors still, die alte Regel bleibt Zeichen für Zeichen).

| Baustein | Wert | Wirkung |
|---|---|---|
| Vorrat | 20 + 1,42 x AUSDAUER (im Mittel 96) | stamina/spirit/torment/speed der Matrix bremsen den Verlust |
| Verbrauch Laufen | 0,0028 je Pixel (alle laufen fast dauernd, rund 78 000 px je Spiel, Stern wie Rollenspieler) | gleich für alle, Streuung kommt aus dem Vorrat |
| Verbrauch Ball | 1,0 je Sekunde mit dem Ball | wer viel den Ball führt, ermüdet (Korrelation tiefster Stand gegen Aktionen −0,47) |
| Erholung | 0,34 je Sekunde, 28 % des Vorrats zwischen den Vierteln | |
| Wirkung bei leerer Puste | Tempo x0,90, Rebound-Gerangel x0,82, Wurfchance x0,94, Anspielgewicht x0,70 | moderat; erschöpfte Spieler werden schwächer und seltener angespielt |
| **Beteiligungsboden** `passBoden` 0,5 | jeder Anspielpartner bekommt zusätzlich 50 % des mittleren Passgewichts | mildert den Maru-Fall; ist der eigentliche Hebel gegen Geister, die Puste allein reicht nicht (siehe 4) |
| Ticker | „X ist außer Puste.“ einmal unter 25 % | Anzeige |

Matrix und Rezept-Gewichte unangetastet; keine neue Figur, keine Animation.

## 3. Messwerte

`OLY_FORM_MODUS=echt`, Kader-Familie live-save, Node-Motor.

**Puste-Verteilung** (tiefster Stand im Spiel, Anteil am Vorrat), 4 je Seite: Stern 46 %, Rang 2 bis 3 35 %, untere Eignungshälfte 61 %, Schwächster 73 %; ein Fünftel der Spieler fällt unter 30 %; Korrelation tiefster Stand gegen Vorrat +0,72. Bei 6 je Seite: 55 / 44 / 65 / 68 %, 11 % unter 30 %. Bei 2 je Seite ermüden alle stärker (34 % im Mittel, 43 % unter 30 %: wenige Spieler, viel Ball).

**Beteiligung** (Geist = höchstens 3 Aktionen):

| Feldgröße | Geist alt → neu | schwächster Geist alt → neu | Korrelation Eignung zu Aktionen alt → neu |
|---|---:|---:|---:|
| 4 je Seite | 3,9 → **1,3 %** | 29,2 → **10,0 %** | 0,757 → 0,753 |
| 6 je Seite | 9,0 → **5,6 %** | 69,2 → **45,0 %** | 0,753 → 0,739 |

Der Stern bleibt der Stern (Aktionen 38,3 → 36,5 bei 4, 29,5 → 27,2 bei 6); die Eignungs-Rangfolge der Ballaktionen bleibt (rho 0,75).

**rho je Spiel** (`miss-alle-disziplinen.mjs --node 24 basketball`, Median über 5 Kader, 12 Teilnehmer):

| | alt | neu |
|---|---:|---:|
| rho je Spiel | 0,864 | **0,862** |
| Spannweite | 0,131 | 0,125 |
| rho Saison | 0,888 | 0,888 |

(`--basketball-puste=alt` am neuen Motor reproduziert 0,864 / 0,131 / 0,888 Ziffer für Ziffer.) Probeläufe mit stärkeren Wirkungen (Wurf x0,92, Anspielgewicht x0,60): 0,868; mit Boden 0,8: je Spiel 0,850, Saison 0,916; Boden 0,3: 0,862. Die Bewegung liegt überall im Kaderrauschen (Spannweite 0,13): die Mindestschranke 0,75 und das Ziel 0,85 sind nicht in Gefahr.

## 4. Pp-Abweichung und was die Puste allein nicht kann

`OLY_FORM_MODUS=echt node scripts/messe-arena-einfluss.mjs basketball 48 --saat-versatz=0|10000000 --rohdaten=...` (Chromium, je Strom rund 70 Minuten, nacheinander), danach `poole-arena-einfluss.mjs`:

| | Strom 0 | Strom 1 (Versatz 1e7) | gepoolt |
|---|---:|---:|---:|
| Pp-Abweichung neu | 13,4 | 19,6 | **15,9** |
| Pp-Abweichung alt (Bestand) | 12,6 | 12,7 | – |

Pflichtschranke 25 gehalten, angestrebte 15 knapp verfehlt (gepoolt 15,9; Einzelstrom 1 liegt höher, Basketballs Einzelströme sind verrauscht). Über Matrixgewicht: stamina +2,7 (AUSDAUER hat jetzt einen Kanal und überzeichnet leicht, Matrix 6, gemessen 8,7), torment +2,7, power +1,7, speed +0,9; unter: charisma −3,0, intelligence −2,8, awareness −1,4. Der Anstieg gegenüber 12,6 kommt fast vollständig aus stamina und torment (beide über AUSDAUER): ein Hinweis, `ausdauer` im Vorrat (`jeAusdauer` 1,42) bei Gelegenheit etwas zu senken. Eingetragen in `data/generated/disziplin-abnahme.json` (`pp` [13,4, 19,6], `ppMessung.gepoolt` 15,9; alter Stand unter `ppVorPuste`).

**Die Puste allein hilft dem Maru-Fall kaum.** Mit Vorrat, Verbrauch und allen Wirkungen (auch einem Anspielgewicht von 0,6 bei leerer Puste) sank der Geist-Anteil bei vier je Seite nur von 3,9 auf 3,2 bis 3,6 %: Maru ist nicht müde, er wird nicht angespielt, weil sein Passgewicht niedrig ist, und ein müder Stern verliert nur gut ein Viertel seines Gewichts. Erst der **Beteiligungsboden** (jeder Anspielpartner bekommt 50 % des mittleren Passgewichts dazu) bewegt ihn: 3,9 → 1,3 %. Diagnose und Hebel gehören so zusammen: Puste macht Basketball ehrlicher (Ausdauer zählt, der Ballführer ermüdet), der Boden holt die Zuschauer ins Spiel.


## 5. Anker je Regel (C2 und E1)

Die Regel verschiebt die rohe Wertverteilung: Wert-Median je Spieler −2 bis −5 %, 99,5-Perzentil −3,5 bis −11 %, Punkte je Spiel −5 bis −8 % (`miss-basketball-wertverteilung.mjs`, `miss-basketball-marge.mjs`). Nachgerechnet am Motor (`miss-basketball-anker-proxy.mjs`: Spieltage aus 16 Duellen der Kader-Familie, rohe PP mit der gespeicherten Referenz, Tagesbester, Median über 400 Tage) bewegen sich die Anker so:

| Feldgröße | rTop alt → neu | rMed alt → neu |
|---|---:|---:|
| 2 | −8,3 % | −5,4 % |
| 3 | −5,2 % | −10,2 % |
| 4 | −11,0 % | −8,9 % |
| 5 | −10,7 % | −8,5 % |
| 6 | −9,5 % | −6,6 % |

Das liegt über der 5-Prozent-Schwelle, die für Hockey galt. **Folge: Anker je Regel.** `basketballPusteAlt` (PP) und `duellPusteAlt` (E1) tragen die alten Werte unverändert; `basketball` bzw. `duell` sind die abgeleiteten neuen (rTop/rMed je Feldgröße mit den Verhältnissen der Tabelle, Disziplin-weit 0,911 bzw. 0,921; E1-Margen-Knoten mit 0,95, Feldgröße 6 mit 1,0 nach der Siegmargen-Messung; Leistungs-Anker lP5/lP50/lP95 unverändert, weil sie auf C2-skalierten PP stehen). Gewählt wird nach `basketballPusteFuer(gameState, matchdayId)`: PP in `computeIndividualBoxscorePpsFromFixtureResults` (Variante `pusteAlt`), E1 in der Resolve-Engine (`podVariante: "pusteAlt"`). Test: `tests/basketball-anker-je-regel.test.ts`.

**Einschränkung, offen:** die neuen Anker sind aus dem Motor abgeleitet, nicht aus sechs frischen Battle-Saves (Stunden Rechenzeit). Der Bestand selbst ist sehr dünn (20 Zellen, rTop je Feldgröße 5,1 bis 8,1), die Verschiebung von rund 9 % liegt aber über seinem Rauschen nicht. Bei Gelegenheit mit `miss-pp-skala.ts` und `werte-pp-skala-aus.mjs`/`werte-ergebnisskala-aus.ts` neu ziehen. Die PP-Referenz (`basketball-pps-referenz.json`, iMittel/iKrass) bleibt unverändert; der Drift-Wächter (±25 %) ist grün.

## 6. Regel-Stempel und Rückweg (gezeigt = gebucht)

`lib/resolve/basketball-puste.ts` (Muster `hockey-torwart.ts`): `seasonState.basketballPuste` als Wechselliste, gesetzt beim Laden und beim Buchen (`stempleBasketballPuste(stempleHockeyTorwart(...))` in `legacy-matchday-result-apply-service.ts` und `save-repository.ts`); Umstellung ab dem nächsten gewerteten Spieltag, gebuchte Spieltage behalten ihre Regel. Der Wert reist im Kader-Umschlag (`formatByDisciplineId.basketball`, `arenaFormatByDisciplineId` für „basketball“ und „alle“; Host, Chromium-Runner und Node-Motor) und steht im Eingabe-Hash des Basketball-Vorlaufs. Schalter `OLY_BASKETBALL_PUSTE=alt` (Dockerfile, compose, `.env.example`; neu BAUEN). Messhebel `window.__arena.basketballPuste("alt"|obj|null)`, `--basketball-puste=alt|<json>` an `miss-alle-disziplinen.mjs`.

**Fingerabdruck** (`node scripts/pruefe-wertung-fingerabdruck.mjs --node`): GESAMT `0310ec4a4e3d` → **`ea36f666cc71`**; verglichen mit main bewegen sich **nur** `spiele basketball 1|7|42` (91a13edbaa37/9cae043e306d/8a75782eceaa → 1dcbd995722b/4aa24b3936d0/0478707f7e77). Es gibt keine Basketball-Pod- oder Proben-Zeile. Die alte Regel ist außerhalb von GESAMT geschützt: `BASKETBALL-PUSTE-ALT 77aa7158ff0d` (drei Zeilen `spiele basketball/puste-alt`, bit-identisch zu den früheren `spiele basketball`-Zeilen). Unverändert: CLIMBING-STANDARD `164b3d846334`, BATTLEFIELD-ORTE3 `6413fbdc4641`, HOCKEY-TORWART-ALT `cdc62aeea8e4`, TDM-GEFECHT `4f5a6af94a46`.

## 7. Tests und Aufnahmen

Neu: `tests/basketball-puste-format.test.ts` (Stempel, Schalter, Umschlag, Buchungsdienst), `tests/basketball-puste-regel.test.ts` (alte Regel bit-genau gegen die festgehaltenen Fingerabdruck-Werte, Umschlag = Hebel, Puste-Wirkung, weniger Geister), `tests/basketball-anker-je-regel.test.ts`. Grün: Basketball-, Hockey-, Battlefield-, Climbing-Format-, PP-Skala-, Ergebnisskala-, Arena-Teampunkte-, Abnahme-Wächter- und Standings-Tests (53 Dateien, 443 Tests); `npx tsc --noEmit` ohne Befund in `app`, `lib`, `components`.

Aufnahmen aus der **Motor-Seite** (`scripts/screenshot-basketball-puste.mjs`, `docs/design/basketball-puste-22-11/`): `neu-1920x1080.png` (Spielerkarten mit Puste-Anzeige der müden Stars, Ticker), `neu-canvas.png` (Puste-Leisten unter den Füßen), `alt-canvas.png` (alte Regel, keine Leisten). Angesehen: keine Überlappung, kein Seitenfehler. Nicht aus der eingeloggten App-Hostseite (kein Login im Container).

## 8. Offen

(a) Anker nicht aus frischen Saves (Abschnitt 5); (b) Pp gepoolt 15,9 aus zwei Strömen (angestrebt unter 15; stamina/torment leicht über Matrix, `jeAusdauer` ist der Hebel); (c) bei 2 je Seite ermüden alle stärker als gewollt, bei Bedarf `jePx` nach Feldgröße staffeln; (d) der Beteiligungsboden hebt die Beteiligung des Schwächsten, macht ihn aber nicht zu einem Mitspieler auf Augenhöhe (bei 6 je Seite bleibt ein Geist-Anteil von 5,6 %): das ist die Validität (rho 0,86) im Gegenzug.
