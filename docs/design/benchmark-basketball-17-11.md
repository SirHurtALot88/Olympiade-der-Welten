# Benchmark-Disziplin Basketball: Prüfbogen „Was eine fertige Disziplin hat“ (17.11.)

**Auftrag, Chris am 17.11.:** „wir müssen uns eine diszi wie basketball raus picken die du erstmal
perfektionierst und zumindest 90% vom layout/movement finisht damit wir die als benchmark haben“.

Dieser Bogen ist die **Vorlage für die anderen 19 Disziplinen**. Je Zeile steht, woran man die Sache
erkennt (prüfbar, nicht Geschmack), der Ist-Stand Basketball nach dieser Runde und was bis 90 % fehlt.
Für eine andere Disziplin kopiert man die Tabelle und füllt Spalte 3 und 4 neu.

Begleitdokumente: `docs/design/spacing-modul-17-11.md` (Bewegung/Spacing), `docs/design/basketball-assets-17-11.md`
(Assets von Fable). Screenshots: `docs/design/benchmark-basketball-17-11/` (vorher/nachher, fünf Situationen,
reproduzierbar mit `node scripts/screenshot-basketball-benchmark.mjs <ordner> [praefix] [engine.js]`; Runde 2: `runde2-*`, 15 Spielzüge/Effekte + Kamera-Bildfolge, Abschnitt 7.7).

## 1. Der Bogen

Gewicht = Anteil am Gesamtwert. Die Prozente sind eine Einschätzung gegen die Prüfkriterien, keine Messung.
Wo es eine Messung gibt, steht sie dabei.

**Stand Runde 2 (17.11. abends).** Spalte „R1“ = nach der ersten Benchmark-Runde, „R2“ = nach dieser.
Belege und Messungen zu R2 stehen in Abschnitt 7.

| # | Bereich | Gewicht | Prüfkriterium („fertig“ heißt …) | R1 | **R2** | Beleg R2 / was noch fehlt |
|---|---|---:|---|---:|---:|---|
| 1 | **Layout / Spielfeld** | 15 | Echte Maße des Vorbilds. Jede Wertungslinie ist sichtbar und liegt dort, wo die Logik misst. Auf jeder Kulisse vorhanden. | 90 % | **92 %** | Feld-Grenze: 0 von 3,3 Mio. Spielerproben außerhalb der Linien (vorher 7 596, max. 224 px quer bei 175 px Seitenlinie). Offen: Ring–Grundlinie 0,5 statt 1,575 m (3.2). |
| 2 | **Spielgerät & Ziel** (Korb, Tor, Ball) | 10 | Eigenes Objekt mit Höhe, in Ebenen gezeichnet. Größe passt zur Figur. Ein Treffer ist sichtbar *im* Ziel. | 85 % | **92 %** | Ringwackeln bei Ringtreffer und Dunk, Netz-Swish, Ball fliegt je Pass-Art anders (Brust flach, Boden mit Aufsetzer, Lob im Bogen). Offen: Korb mit Ausleger. |
| 3 | **Bewegung / Spacing** | 20 | Rollen halten Zonen. Höchstens 1–2 Spieler am Ball. Freie Anspielstationen. Kein Dauerklumpen. Laufwege mit Absicht. | 75 % | **91 %** | LAUFWEG-MODUL, je Spiel gezählt (7.1): 33 Backdoor-Cuts, 166 Give-and-Go-Cuts, 28 Screens → 6 Roll + 6 Pop, 58 Post-ups, 47 Fast-Breaks mit Außenbahnen, 116 Help-Rotationen, Ausboxen bei 97,5 % der Würfe. Center am Block, Guards außen. Kosten: Klumpen ≥3 Mitspieler 9,4 → 12,1 %, freie Anspielstation 50 → 43 % (Deny + Feld-Grenze). |
| 4 | **Regeln & Wertung sichtbar** | 15 | Jede Regel, die zählt, sieht man (2/3, Uhr, Fouls, Freiwürfe). Gezeigt = gebucht: 0 Abweichungen. | 90 % | **92 %** | Teamfouls je Viertel am Korb (fünf Punkte, rot + BONUS ab dem 5.), Sonde `__arena.teamFouls()`. 0 von 846 Würfen falsch gebucht. Offen: Foul ohne Wurf (gebaut, gemessen, aus, 7.2). |
| 5 | **Kamera** | 10 | Bildausschnitt folgt dem Spiel, wichtige Momente sind nah genug. | 40 % | **85 %** | Halbfeld-Folgekamera (Zoom 1,32, gedämpfter Schwenk), Nahzoom 1,75 auf Dunk/Dreier/Alley-Oop (Bildfolge `runde2-k*.png`). Offen: Kamera-Timing bei Freiwürfen, Wackeln beim Dunk. |
| 6 | **HUD / Live-Stand** | 10 | Stand, Zeit/Periode, Uhr, wer führt, Lauf, Top-Spieler, ohne das Feld zu verdecken. | 80 % | 80 % | Nicht angefasst (HUD-Agent, Block „HUD-SYSTEM“). `teamFouls()` steht für den Scorebug bereit. |
| 7 | **Kulisse** | 5 | Mindestens zwei Schauplätze, Linien als Asset, Mittelkreis-Wappen. | 85 % | 85 % | Unverändert. Zuschauer reagieren nicht. |
| 8 | **Effekte** | 5 | Treffer-, Block- und Steal-Momente haben ein eigenes Bild. | 60 % | **88 %** | Dunk-Funken + Landestaub, Dreier-Leuchtspur, Block-Stern, Staub beim Abstoppen, Schweiß beim Drive, Ringwackeln (`runde2-r2-12…15`). Offen: Steal-Moment. |
| 9 | **Ton / Feedback** | 5 | Jedes Ereignis klingt. Treffer ≠ Ringtreffer ≠ Brett. | 70 % | **85 %** | WebAudio-Synthese: Swish ≠ Ring ≠ Brett ≠ Dunk ≠ Block, Turnschuh-Quietschen, Publikum steigt bei knappem Stand im 4. Viertel. Erst nach Nutzergeste, Schalter `__arena.bkSynthTon(false)`. |
| 10 | **Figuren-Animation** | 5 | Wurf-, Dunk-, Block-, Pass-Pose. | 45 % | **60 %** | Aus dem Bestand: Squash/Stretch + Sprunghöhe je Wurf-Absicht, Post-up mit dem Rücken zum Korb, Ausboxen geduckt. Echte Posen fehlen (Kostenschätzung 7.5). |
| | **Gesamt (gewichtet)** | 100 | | ≈ 76 % | **≈ 87 %** | **Layout + Bewegung (Chris' 90 %): R1 ≈ 81 % → R2 ≈ 91 %.** |

**Abnahme-Zeile** (Pflicht, kein Prozentwert, sondern bestanden/nicht bestanden):

| Abnahme | Schranke | main | R1 | **R2** |
|---|---|---:|---:|---:|
| rho je Spiel (`miss-alle-disziplinen.mjs 24 basketball`) | ≥ 0,75, Ziel > 0,80 | 0,822 | 0,859 (Spannweite 0,111, Saison 0,909) | **0,862** (Spannweite 0,136, Saison 0,881) |
| Pp-Abweichung (`messe-arena-einfluss.mjs basketball 48`, zwei Saatstämme) | ≤ 25, Ziel < 15 | 15,6 / 16,7 | 13,6 / 16,0 | **7,5 / 13,4** |
| Gezeigt = gebucht (`__arena.diagGezeigtGebucht`) | 0 Abweichungen | — | 0 von 828 Würfen | **0 von 846 Würfen**, Anzeige = Buchung in 8/8 Spielen |
| Seitenlinie (`__arena.diagSpielzuege(12).seitenlinie`) | 0 Proben außerhalb | — | 7 596 von 3,3 Mio. | **0 von 3,32 Mio.** |
| Wertungs-Fingerabdruck | nur die eigene Disziplin bewegt sich | — | 97c267e8b7c7 | **004f26374565**, nur `spiele basketball 1/7/42` |

## 2. Was diese Runde gebaut hat

1. **FIBA-Feld auf jeder Kulisse.** Gerade Eckenlinien 6,6 m, Bogen 6,75 m (Ellipse 263 × 157,5 px),
   Zone bis 4,225 m vor dem Ring × 4,9 m, Freiwurfkreis (Feldhälfte durchgezogen, Zonenhälfte gestrichelt),
   No-Charge-Halbkreis, Mittelkreis. Vorher lag der Dreierbogen *innerhalb* der Zone (Bogen bis x≈207,
   Freiwurflinie x≈294): ein Wurf von der Freiwurflinie zählte als Dreier. Mit Kulisse kommt das Linien-PNG
   (Fable), das Skript baut es aus denselben Maßen neu (`scripts/baue-basketball-assets.py --ecke-y …
   --kreis-rx …`, Aufruf in Abschnitt 6). Ohne Kulisse zeichnet der Motor dieselben Linien als Vektoren.
2. **Feld-Metrik (gezeigt = gebucht).** Die Logik rechnet weiter in ihren Logik-px. `feldLogikDist` legt
   sie auf das echte Feld (1 Logik-px = 1/16,7 m in beide Richtungen). Dazu gilt die Ecken-Dreier-Regel
   (`querL ≥ 110,3` → Dreier). Die Sonde prüft rein geometrisch in Metern gegen die gezeichnete Linie.
3. **Korb als Objekt in der Tiefe.** PNG-Anlage von Fable (`korb_*_hinten/vorne.png`, Maßstab 1,0: Ring
   59 px ≈ 3,05 m über dem Boden, Öffnung 16 px, Ball 12 px). Die hintere Ebene wird nach y zwischen die
   Figuren sortiert (wer hinter dem Korb steht, wird vom Brett verdeckt). Die vordere Ebene (Ring, Netz)
   liegt über dem Ball. Primitiv-Rückfall, falls die PNGs fehlen.
4. **Ballflug in der Höhe.** Jeder Wurf endet im Ring (`bkBogenZ`). Danach fällt der Ball durchs Netz
   (Treffer) oder prallt zum Rebound-Punkt ab (`bkNachlauf`). Freiwürfe genauso. Alles reine Anzeige
   (`fsBall.z`), die Wertung liest nichts davon.
5. **Spacing-Modul** (eigene Doku). Klumpen ≥3 Mitspieler 49 % → 9 %, freie Anspielstation 27 % → 50 %.
6. **Wurfwahl nach Entfernung/Eignung/Freistand.** Das bestehende Wurfprofil (`SCHUSS_FERN − SCHUSS_NAH`
   bestimmt die Wunschdistanz, Bedrängnis die Wahl) bleibt. Neu: ungezwungener Wurf höchstens 8,4 m
   (`FERN_RADIUS_MAX` 170 → 140), Slots im echten Spacing (Top/Flügel 7,5 m, Ecken als echte Corner-Threes).
7. **Shot-Clock an der Korbanlage** mit Rahmen-PNG, rote Ziffer unter 5 s.

## 3. Entscheidungen, die diese Runde allein getroffen hat (mit Empfehlung)

1. **Wertung bewusst verändert.** Klumpen lässt sich nicht als reine Anzeige reparieren: die Positionen sind
   Spiellogik (Deckerabstand, Passlinien, Rebound). Bewegt sich nur `basketball` im Fingerabdruck, und rho
   steigt (0,822 → 0,859). Empfehlung: so übernehmen.
2. **Ring 0,5 m statt 1,575 m vor der Grundlinie.** Die PNG-Anlage trägt das Brett direkt am Mast (35 px vor
   dem Sockel). Bei FIBA-Lage stünde der Sockel 40 px im Feld. Alle Linien sind relativ zum *Ring* FIBA-genau,
   nur dieser eine Abstand ist verkürzt. Empfehlung: bei der nächsten Korb-Bestellung einen Ausleger von
   ~1,1 m (≈45 px) mitbestellen, dann `BK_KORB_X_ANTEIL` auf `0.06+1.575/28*0.88` stellen.
3. **Korb-Maßstab 1,0 statt Fables 1,25.** 1,0 trifft die echte Proportion zur Figur (Ring 3,05 m bei einer
   1,95-m-Figur von ~38 px), und genau die Proportion hatte Chris bemängelt. Bei 1,25 hinge der Ring auf
   ~3,8 m. Eine Zeile (`BK_KORB_SKALA`), falls Chris es größer lesbarer will.
4. **Lauftempo unverändert (`feld.tempo 1.0`).** Das echte Feld ist in Logik-Einheiten kürzer, die Würfe je
   Spiel steigen deshalb (76 → 103). Bei 1,55 wären es 150 gewesen (hektisch), bei 0,8 98, aber träge.
5. **Kontakt-Konzept (Block/Steal).** `kontakt-persoenlichkeit-16-11.md` setzt Basketball auf Rang 6
   („kleine Dosis, erst wenn 1–5 das Muster bestätigt haben“). Diese Runde baut deshalb keinen neuen
   Kontaktkanal. Block, Steal, Doppeln, Screens und Fouls bleiben, wie sie sind. Der rho-Puffer ist mit
   0,859 größer geworden (vorher ~0,02 laut Konzept), Platz für den späteren Piloten ist also da.

## 4. Messwerte vorher/nachher

| Größe | main | neu | Werkzeug |
|---|---:|---:|---|
| rho je Spiel (Median, 5 Kader) | 0,822 | **0,859** | `miss-alle-disziplinen.mjs 24 basketball` |
| rho Saison | 0,930 | 0,909 | dto. |
| Pp-Abweichung (zwei Saatstämme) | 15,6 / 16,7 (Chromium, 15,6 heute bestätigt) | **13,6 / 16,0** | `einflussVon("basketball",48,…,0 bzw. 10000000)` im Node-Motor (rechnet wie `messe-arena-einfluss.mjs`) |
| ≥3 Mitspieler im 45-px-Kreis | 49,1 % | **9,4 %** | `miss-spacing.mjs basketball 6 120 45` |
| ≥3 Spieler beliebig im 45-px-Kreis | 92,9 % | **61 %** | dto. |
| mittlerer Mitspielerabstand | 112 px | **185 px** | dto. |
| Spieler um den Ballführer (80 px) | 4,7 | **2,4** | dto. |
| Ballführer hat freie Anspielstation | 27 % | **50 %** | dto. |
| Feldwürfe je Spiel (beide Teams) | 75,8 | 103,2 | Node-Motor, 12 Saaten |
| Dreieranteil / Quote | 44,6 % / 34 % | 47,3 % / 33 % | dto. |
| Mitteldistanz-Anteil / Quote | 11,9 % / 30 % | 19,4 % / 32 % | dto. |
| Dunk-Anteil / Quote | 16,4 % / 95 % | 10,7 % / 83 % | dto. |
| Gezeigt = gebucht | — | 0 / 828 | `__arena.diagGezeigtGebucht(8)` |

**Fingerabdruck** (`node scripts/pruefe-wertung-fingerabdruck.mjs`, Chromium): main `GESAMT e80babacb68c (75 Einträge)`,
neu **`GESAMT 8e431ffe5d93 (75 Einträge)`**. Der diff betrifft genau drei Zeilen:
`spiele basketball 1` b37fd82fb384 → 1915afd1ea82, `spiele basketball 7` e04f9806dc23 → 401674e1d307,
`spiele basketball 42` c52a59d8d024 → 3786e4716c29. Alle 72 übrigen Zeilen sind gleich. Der Node-Vorabgleich
(20 Disziplinen × Saaten 1/7/42) zeigt dasselbe: 3 von 60 anders, alle Basketball.

**PPS-Referenz neu gezogen.** Mehr Würfe heißen mehr Roh-Impact je Spieler. Der Drift-Wächter
(`tests/basketball-pps-referenz-drift.test.ts`) schlug deshalb mit +46 % an. `data/generated/basketball-pps-referenz.json`
ist nach Vorschrift neu gezogen (`OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-basketball-pps-referenz.ts
--feldgroesse=2..6`, danach `--merge`; Abbild live-save vom 15.11.). iMittel bei 6 je Seite 15,42 → 20,23,
iKrass 51,52 → 56,0. Wächter und `battle-mode-arena-team-points.test.ts` sind grün.

## 5. Was für die 90 % noch fehlt (Reihenfolge = Empfehlung)

1. **Halbfeld-Kamera** (Bereich 5, größter Hebel fürs Gefühl): Bildausschnitt auf die Angriffshälfte,
   weicher Schwenk beim Ballbesitzwechsel. Reine Anzeige, Fingerabdruck bleibt.
2. **Laufwege mit Absicht** (Bereich 3): Backdoor-Cut, wenn der Verteidiger die Passlinie zumacht. Post-up
   für den Slot-0-Spieler. Pick-and-Roll als sichtbare Formation statt Zufallsruf. Jeder Schritt mit rho/Pp-Messung.
3. **Effekte + Ton** (Bereiche 8/9): Ringwackeln und eigener Ton beim Ringtreffer, Swish-Ton, Dunk-Effekt.
4. **Figuren-Posen** (Bereich 10): Wurf-, Dunk- und Block-Pose fehlen im Bestand. Neue PixelLab-Animationen
   sind gesperrt (CLAUDE.md). Vorschlag an Chris statt Bestellung: drei Posen („Wurf“, „Sprung/Dunk“,
   „Block-Arme hoch“). Kosten skalieren mit dem Figurenbestand, deshalb erst als Kostenschätzung vorlegen.
5. **Korb mit Ausleger** (Bereich 2): ermöglicht die FIBA-Lage 1,575 m (Abschnitt 3.2).
6. **Foul-/Bonus-Zähler im HUD** und Live-Stand-Linie (Bereiche 4/6).

## 6. Werkzeuge dieser Runde

```sh
node scripts/miss-spacing.mjs basketball 6 120 45
node scripts/screenshot-basketball-benchmark.mjs docs/design/benchmark-basketball-17-11 nachher
node scripts/miss-alle-disziplinen.mjs 24 basketball
node scripts/messe-arena-einfluss.mjs basketball 48
python3 -I scripts/baue-basketball-assets.py --korb-x 0.076 --zone-tiefe 184.49 --zone-breite 114.33 --dreier-rx 263.06 --dreier-ry 157.50 --ecke-y 154.00 --kreis-rx 70.15 --kreis-ry 42.00 --no-charge-rx 48.71 --no-charge-ry 29.17 --korb-skala 1.0
```

Neue read-only Sonden in `window.__arena`: `diagSpacing`, `diagGezeigtGebucht`, `szeneFeldspiel`.

## 7. Runde 2 (17.11. abends): Bewegung und Gameplay auf über 90 %

Auftrag: die Lücken aus Abschnitt 5 schließen, Reihenfolge nach Hebel. Fünf getrennte Commits auf
`bb-runde2` (jeder einzeln verwerfbar): Laufwege, Foul/Bonus, Kamera, Effekte/Ton, Feld-Grenze.
Alles Verallgemeinerbare sitzt in eigenen Modulen mit Parameterblock in `FELDSPIEL_ART[d]`; ohne Block
verhält sich jede Disziplin wie vorher (Hockey, Football und alle anderen bleiben im Fingerabdruck
byte-gleich).

### 7.1 Laufwege mit Absicht (LAUFWEG-MODUL, `FELDSPIEL_ART.basketball.laufwege`)

| Baustein | Was man sieht | Wie es entsteht |
|---|---|---|
| Center am Block | Slot 0 steht tief am Block der Ballseite, nicht an der Freiwurflinie | `postBlock` (1,7 m vor dem Ring, 1,8 m quer) |
| Post-up | Innenspieler mit Ball drückt mit dem Rücken zum Korb langsam rein, Pfeil „POST-UP“ | Slot 0 oder Profil NAH−FERN ≥ 6, 1,8–4,8 m vor dem Ring, Tempo 0,5 |
| Deny + Backdoor-Cut | Decker überspielt die Passlinie, der Angreifer schneidet hinter ihm zum Korb, Pfeil „BACKDOOR“ | Deny jeden zweiten Ballbesitz, eine Passstation vom Ball; Cut-Chance nach TECHNIK (0,35 ± 0,01/Punkt); der überspielte Decker zögert 0,6 s |
| Pick-and-Roll / -Pop | Balken „PICK“ am Screener, Ballführer läuft um den Block, danach „ROLL“ (Innen) oder „POP“ (Werfer an die Dreierlinie) | bestehender Screen-Ruf; neu: Nutzung des Blocks im Halbfeld, Pop für Profil FERN−NAH ≥ 4 |
| Ausboxen | Verteidiger stellen sich beim Wurf zwischen Mann und Korb, geduckt, Blick zum Mann | Wurf in der Luft oder Abpraller, alle Nicht-Jäger |
| Crash | der korbnächste Angreifer geht zum Offensiv-Rebound | `crash.anzahl` 1 (2 gemessen: rho 0,852) |
| Fast-Break-Lanes | die zwei Sprinter füllen die Außenbahnen, Pfeile | bestehender Fast-Break; neu: Bahnziel statt Halbfeld-Slot |
| Help-Rotation | hilft einer am Ball, rückt der nächste auf dessen Mann | an die bestehende Hilfe gekoppelt |
| Tempowechsel | Ballführer zögert, tritt an, reist; ohne Ball wird am Spot getrabt statt gesprintet | Periode 1,6 s, Mittel ≈ 1,0 (kein Netto-Tempogewinn) |
| Pass-Art | Brustpass flach, Bodenpass mit Aufsetzer, Lob zum Cutter | nur Anzeige, aus der Geometrie beim Abspiel |
| Wurf-Absicht | „SPOT-UP“/„PULL-UP“/„DRIVE“/„POST-UP“ am Schützen, Sprung je Absicht verschieden | nur Anzeige: Fangzeit, Tempo, Post-Zustand |

Zustand in einer WeakMap (keine neuen Spielerfelder). **Gezählt** mit der neuen read-only Sonde
`window.__arena.diagSpielzuege(12)` (Mittel je Spiel, 12 volle Spiele, ≈ 88 Ballbesitze, 106 Würfe):

| Aktion je Spiel | R2 | | Aktion je Spiel | R2 |
|---|---:|---|---|---:|
| Backdoor-Cuts | 32,6 | | Pässe Brust / Boden / Lob | 48,9 / 102,8 / 23,5 |
| Give-and-Go-Cuts | 165,8 | | Würfe Spot-up / Pull-up / Drive | 40,3 / 22,8 / 25,4 |
| Screens gerufen | 28,0 | | Würfe Post-up / Alley-Oop | 14,9 / 2,3 |
| Block genutzt (Halbfeld) | 3,2 | | Würfe mit Ausboxen | 97,5 % (5,8 Boxer je Wurf) |
| Pick-and-Roll / Pick-and-Pop | 5,8 / 5,8 | | Deny-Stellungen | 147 |
| Post-ups | 58,3 | | Help-Rotationen | 116 |
| Fast-Breaks | 46,9 | | Wurf-Fouls | 4,0 |

Ehrliche Grenzen: Give-and-Go war schon da (nach jedem Pass schneidet der Passgeber) und bleibt so
häufig; der Block wird nur 3-mal je Spiel wirklich genutzt, weil der Screen-Ruf oft schon im
Übergang fällt. Fürs Auge ist es trotzdem eine Formation (Balken + Roll/Pop-Pfeil). Spacing nach R2
(`miss-spacing.mjs basketball 6 120 45`): Mitspielerabstand 185 → 181 px, Klumpen ≥ 3 Mitspieler
9,4 → 12,1 %, Spieler um den Ballführer 2,44 → 2,61, freie Anspielstation 50 → 43 %. Das ist der Preis
von Deny (überspielte Passlinien sind gewollt nicht frei) und Feld-Grenze (Eckspieler stehen an der
Linie statt dahinter).

### 7.2 Foul/Bonus (TEAMFOUL-/BONUS-MODUL, `FELDSPIEL_ART.basketball.fouls`)

Jedes Spielerfoul zählt als Teamfoul im laufenden Viertel. Ab dem 5. gibt jedes Foul ohne Wurf zwei
Freiwürfe, davor Einwurf (Ballbesitz bleibt, Schussuhr auf die Hälfte gedeckelt). Angezeigt am Korb
der verteidigenden Seite (fünf Punkte, rot + „BONUS“), Sonde `__arena.teamFouls()` für den Scorebug.

Bisher gab es nur Wurf-Fouls (Freiwürfe ohnehin), der Bonus hat also nur mit einem Foul **ohne** Wurf
eine Wirkung. Gebaut: Reach-in beim missglückten Steal, gute Verteidiger (ABWEHR) foulen seltener.
Gemessen (Node-Motor, rechnet wie `miss-alle-disziplinen.mjs 24 basketball`, 5 Kader):

| Fassung | Fouls ohne Wurf / Spiel | Bonus-Freiwürfe / Spiel | rho je Spiel | Saison |
|---|---:|---:|---:|---:|
| ohne Reach-in (Stand nach Laufwegen) | 0 | 0 | 0,865 | 0,923 |
| Reach-in, Basis 0,10 | 12,5 | 0,3 | **0,841** | 0,888 |
| Reach-in, Basis 0,18 | 18,1 | 1,3 | 0,853 | 0,902 |

Beide Fassungen liegen unter dem Stand ohne (0,865), die erste unter 0,85. **Entscheidung: Reach-in
steht auf `null`** (Zählung und Anzeige der Teamfouls laufen, die Wertung ist unberührt, Fingerabdruck
gleich). Empfehlung an Chris: den Bonus erst mit einem Foul ohne Wurf einschalten, das über eine
Fähigkeit läuft (z. B. Ausboxen-Foul nach ABWEHR gegen ZWEITCHANCE) und dann neu messen.

### 7.3 Kamera (KAMERA-MODUL, `FELDSPIEL_ART.basketball.kamera`)

Halbfeld-Folgekamera: Zoom 1,32, Mitte zwischen Ball und angegriffenem Korb (Zug 0,38), quer zur
Feldmitte gezogen, kritisch gedämpfter Schwenk (3,2/s) in Wandzeit. Nahzoom 1,75 auf den Ring bei
Dunk, Dreier und Alley-Oop, 1,1 s lang; der Ausschnitt bleibt immer in der Leinwand. Klicks auf Figuren
werden zurückgerechnet. Reine Anzeige, `__arena.feldKamera(false)` schaltet auf die Totale zurück.
Bildfolge: `runde2-k0-totale.png` (vorher), `runde2-k1-halbfeld.png`, `runde2-k2…k5` (Dreier: Zoom
fährt rein und nach 1,1 s zurück).

### 7.4 Effekte und Ton (EFFEKT-/TON-MODUL)

Ringwackeln (Ringtreffer gedämpft, Dunk stärker mit Neigung), Dunk-Funkenkranz + Landestaub,
Dreier-Leuchtspur aus der echten Flugbahn, Block-Stern, Staub beim Abstoppen (Pull-up) und Absprung
(Drive), Schweiß beim Drive. Ton per WebAudio aus den vorhandenen Bausteinen (`tonKlick/Schlag/Metall/
Rauschen`): Swish, Ringklang, Brett, Dunk-Wumms, Block, Turnschuh-Quietschen, Publikum bei knappem
Stand im 4. Viertel. Erst nach einer Nutzergeste, Schalter `__arena.bkSynthTon(false)` (gemerkt).
**PixelLab: 0 Generationen.** Alle Effekte sind prozedural und lesbar genug; VFX-Sprites über `/v2/vfx`
waren nicht nötig, Kontostand deshalb nicht angefasst.

### 7.5 Posen: was mit dem Bestand geht, und was echte Posen kosten würden

Aus dem Bestand (Grundposen, Angriff, Fall, Nord) ohne neue Animation: Squash vor dem Absprung,
Stretch im Sprung, Sprunghöhe je Wurf-Absicht (Spot-up 12, Pull-up 16, Drive 20 px mit Vorlage zum
Ring, Post-up 11 px mit Fadeaway), Post-up mit gedrehter Blickrichtung (Rücken zum Korb), Ausboxen
geduckt mit Blick zum Mann, Schatten bleibt am Boden. Das trägt den Bogen von 45 auf 60 %. Was fehlt,
sind Arme: Wurf (beide Arme hoch), Dunk (ein Arm über dem Ring) und Block (Arme hoch, frontal).

**Kostenschätzung (Vorschlag, nichts bestellt).** Preise laut `docs/design/pixellab-hud-effekte-schiri-plan-17-11.md`:
Animation 80×80 mit 8 Bildern = 1 Gen. je Richtung, 16 Bilder = 2 Gen. Der Motor zeichnet vier
Richtungen (hinten, links, vorn, rechts).

| Umfang je Spieler | Posen | Richtungen | Gen. je Spieler |
|---|---|---:|---:|
| Minimal | „Wurf“ (deckt auch Block) + „Dunk“, nur Profil links/rechts, 8 Bilder | 2 | **4** |
| Standard | Wurf, Dunk, Block, 8 Bilder | 4 | **12** |
| Voll | Wurf, Dunk, Block, 16 Bilder | 4 | **24** |

| Szenario | Minimal | Standard | Voll |
|---|---:|---:|---:|
| ganzer Figurenbestand (≈ 360) | 1 440 | 4 320 | 8 640 |
| **nur gepickte Spieler, ein Team** (6 auf dem Feld + 2–4 Bank = 8–10) | 32–40 | 96–120 | 192–240 |
| ein Spiel, beide Teams neu | 64–80 | 192–240 | 384–480 |
| ein Spiel, ein Team schon erzeugt (Wiederverwendung) | 32–40 | 96–120 | 192–240 |
| Saison mit *T* Teams × 10 Spielern, danach nur Neuzugänge | 40·*T* | 120·*T* | 240·*T* |

Chris' Gedanke (Posen nur für die wirklich gepickten Spieler erzeugen, wenn gespielt wird) verteilt die
Kosten und deckelt sie bei der Zahl der eingesetzten Figuren: bei 8 Teams kostet „Standard“ einmalig
960 statt 4 320 Gen., jede weitere Saison nur noch die Neuzugänge (ein Transfer = 12 Gen.). Jede
erzeugte Pose wird gespeichert und in allen späteren Spielen wiederverwendet; die Wurf-Pose taugt auch
für Football (Pass) und Handball-artige Disziplinen. Empfehlung: erst „Minimal“ für ein Pilot-Team
(≈ 40 Gen.) als Stilprobe, dann entscheiden.

### 7.6 Messwerte vorher/nachher (R1 = Stand PR #1562, R2 = dieser Branch)

| Größe | R1 | R2 | Werkzeug |
|---|---:|---:|---|
| rho je Spiel (Median, 5 Kader) | 0,859 | **0,862** | Node-Motor wie `miss-alle-disziplinen.mjs 24 basketball` (R1 dort Chromium 0,859 = Node 0,859) |
| Spannweite / rho Saison | 0,111 / 0,909 | 0,136 / 0,881 | dto. |
| Zwischenstände | | Laufwege 0,865 (Saison 0,923), + Feld-Grenze 0,862 | dto. |
| Pp-Abweichung (Saat 0 / 10 000 000) | 13,6 / 16,0 | **7,5 / 13,4** | `einflussVon("basketball",48)` im Node-Motor |
| Gezeigt = gebucht | 0 / 828 | **0 / 846** | `__arena.diagGezeigtGebucht(8)` |
| Proben außerhalb des Feldes | 7 596 / 3,30 Mio. | **0 / 3,32 Mio.** | `__arena.diagSpielzuege(12).seitenlinie` |
| Würfe je Spiel | 103 | 106 | dto. |
| Fingerabdruck GESAMT | 97c267e8b7c7 | **004f26374565** | `pruefe-wertung-fingerabdruck.mjs`, nur `spiele basketball 1/7/42` anders |

Verworfene Fassungen (je rho je Spiel): Laufwege mit 2 Crashern 0,852 (bzw. 0,863 ohne Halbfeld-Grenze
für die Blocknutzung), Deny-Reichweite 130 0,856, Joggen 0,85 0,866 (Saison 0,902), Feld-Grenze mit
4 px Rand 0,841, Eckslots seitlich 1,18 0,841, Reach-in 0,841/0,853 (7.2). Die Unterschiede zwischen
den Fassungen liegen in der Kader-Spannweite (≈ 0,1); gewählt wurde je Schritt die Fassung über 0,859.

### 7.7 Werkzeuge dieser Runde

```sh
OLY_BB_SZENEN=runde2 node scripts/screenshot-basketball-benchmark.mjs docs/design/benchmark-basketball-17-11 runde2
OLY_BB_SZENEN=kamera node scripts/screenshot-basketball-benchmark.mjs docs/design/benchmark-basketball-17-11 runde2
node scripts/miss-spacing.mjs basketball 6 120 45
```

Neue read-only Sonden in `window.__arena`: `diagSpielzuege(n)` (Aktionen je Spiel, Seitenlinien-Probe),
`teamFouls()`, Schalter `feldKamera(an)` und `bkSynthTon(an)`. `szeneFeldspiel` kennt die Situationen
`backdoor`, `pick`, `roll`, `postup`, `ausboxen`, `fastbreak`, `lob`, `bodenpass`, `spotup`, `pullup`,
`drive`, `fx-dunk`, `fx-ring`, `fx-block`.

### 7.8 Was bis 100 % offen bleibt

1. Echte Wurf-/Dunk-/Block-Posen (Kostenschätzung 7.5, Freigabe Chris).
2. Foul ohne Wurf, das über eine Fähigkeit läuft, damit der Bonus wirkt (7.2).
3. Block-Nutzung häufiger im Halbfeld: den Screen-Ruf selbst erst im Halbfeld zulassen (Wertungsänderung, messen).
4. Steal-Effekt, Zuschauer-Reaktion, Kamera-Wackeln beim Dunk.
5. HUD: Teamfouls/Bonus in den Scorebug (`teamFouls()` liefert sie).
