# Benchmark-Disziplin Basketball: Prüfbogen „Was eine fertige Disziplin hat“ (17.11.)

**Auftrag, Chris am 17.11.:** „wir müssen uns eine diszi wie basketball raus picken die du erstmal
perfektionierst und zumindest 90% vom layout/movement finisht damit wir die als benchmark haben“.

Dieser Bogen ist die **Vorlage für die anderen 19 Disziplinen**. Je Zeile steht, woran man die Sache
erkennt (prüfbar, nicht Geschmack), der Ist-Stand Basketball nach dieser Runde und was bis 90 % fehlt.
Für eine andere Disziplin kopiert man die Tabelle und füllt Spalte 3 und 4 neu.

Begleitdokumente: `docs/design/spacing-modul-17-11.md` (Bewegung/Spacing), `docs/design/basketball-assets-17-11.md`
(Assets von Fable). Screenshots: `docs/design/benchmark-basketball-17-11/` (vorher/nachher, fünf Situationen,
reproduzierbar mit `node scripts/screenshot-basketball-benchmark.mjs <ordner> [praefix] [engine.js]`).

## 1. Der Bogen

Gewicht = Anteil am Gesamtwert. Die Prozente sind eine Einschätzung gegen die Prüfkriterien, keine Messung.
Wo es eine Messung gibt, steht sie dabei.

| # | Bereich | Gewicht | Prüfkriterium („fertig“ heißt …) | Ist Basketball | Fehlt bis 90 % |
|---|---|---:|---|---:|---|
| 1 | **Layout / Spielfeld** | 15 | Echte Maße des Vorbilds. Jede Wertungslinie ist sichtbar und liegt dort, wo die Logik misst. Auf jeder Kulisse vorhanden. | **90 %** | Nichts Wesentliches. Ring–Grundlinie ist 0,5 m statt FIBA 1,575 m, wegen der Korb-PNG (Abschnitt 3.2). |
| 2 | **Spielgerät & Ziel** (Korb, Tor, Ball) | 10 | Eigenes Objekt mit Höhe, in Ebenen gezeichnet. Größe passt zur Figur. Ein Treffer ist sichtbar *im* Ziel. | **85 %** | Netz-„Swish“ auf der PNG nur als Primitiv-Überlage. Ringwackeln bei Fehlwurf fehlt. |
| 3 | **Bewegung / Spacing** | 20 | Rollen halten Zonen. Höchstens 1–2 Spieler am Ball. Freie Anspielstationen. Kein Dauerklumpen (Messung `miss-spacing.mjs`). | **75 %** | Laufwege mit Absicht: Backdoor-Cut gegen überspielte Verteidiger, Post-up, sichtbare Spielzüge (Horns, Pick-and-Roll als Formation). Ausboxen sichtbar machen. |
| 4 | **Regeln & Wertung sichtbar** | 15 | Jede Regel, die zählt, sieht man (2/3, Uhr, Fouls, Freiwürfe). Gezeigt = gebucht: 0 Abweichungen in der Sonde. | **90 %** | Foul-Zähler je Spieler/Team im HUD, Bonus-Situation. |
| 5 | **Kamera** | 10 | Bildausschnitt folgt dem Spiel, wichtige Momente sind nah genug. | **40 %** | Halbfeld-Kamera mit weichem Schwenk beim Seitenwechsel. Kurzer Zoom auf Dunk/Dreier. Heute steht eine feste Vollfeld-Totale. |
| 6 | **HUD / Live-Stand** | 10 | Stand, Zeit/Periode, Uhr, wer führt, Lauf, Top-Spieler, ohne das Feld zu verdecken. | **80 %** | Shot-Clock sitzt jetzt am Korb (Rahmen-PNG). Es fehlt die Live-Stand-Overlay-Linie (Konzept Fable 17.11.) und ein Foul-/Bonus-Zähler. |
| 7 | **Kulisse** | 5 | Mindestens zwei Schauplätze, Linien als Asset, Mittelkreis-Wappen. | **85 %** | Zuschauer reagieren nicht auf Ereignisse. |
| 8 | **Effekte** | 5 | Treffer-, Block- und Steal-Momente haben ein eigenes Bild. | **60 %** | Dunk-Effekt (Ring wackelt, Funken), Dreier-Leuchtspur, Block-Abpraller. |
| 9 | **Ton / Feedback** | 5 | Jedes Ereignis klingt. Treffer ≠ Ringtreffer ≠ Brett. | **70 %** | Swish und Ringtreffer klingen unterschiedlich. Publikum steigt bei knappem Stand an. |
| 10 | **Figuren-Animation** | 5 | Wurf-, Dunk-, Block-, Pass-Pose. | **45 %** | Nur Grundposen + `lunge`/`hop`. Neue PixelLab-Animationen nur mit Chris' Freigabe (Abschnitt 5). |
| | **Gesamt (gewichtet)** | 100 | | **≈ 76 %** | Layout + Bewegung (die von Chris genannten 90 %): Layout 90, Bewegung 75 → ≈ 81 % |

**Abnahme-Zeile** (Pflicht, kein Prozentwert, sondern bestanden/nicht bestanden):

| Abnahme | Schranke | main | neu |
|---|---|---:|---:|
| rho je Spiel (`miss-alle-disziplinen.mjs 24 basketball`) | ≥ 0,75, Ziel > 0,80 | 0,822 | **0,859** (Spannweite 0,111, Saison 0,909) |
| Pp-Abweichung (`messe-arena-einfluss.mjs basketball 48`, zwei Saatstämme) | ≤ 25, Ziel < 15 | 15,6 / 16,7 | **13,6 / 16,0** |
| Gezeigt = gebucht (`__arena.diagGezeigtGebucht`) | 0 Abweichungen | — | **0 von 828 Würfen**, Anzeigetafel = Spielerpunkte in 8/8 Spielen |
| Wertungs-Fingerabdruck | nur die eigene Disziplin bewegt sich | — | nur `spiele basketball 1/7/42` (Abschnitt 4) |

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
