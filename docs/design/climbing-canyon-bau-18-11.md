# Climbing-Format „Canyon“: Bau im Arena-Motor (18.11.)

Bau nach dem freigegebenen Mockup `public/mockups/climbing-neu-18-11.html` und dem Konzept
`docs/design/climbing-neu-18-11.md` (PR #1615). Chris' Freigabe vom 18.11. mit den Antworten auf die zehn Fragen
gilt verbindlich (Abschnitt 1). **Der Schalter ist im Spiel aus** — Chris entscheidet nach dieser Messung.

- Motor: `public/mockups/battle-mode.engine.js` (`baueCanyon()`, `stepClimbingCanyon()`, `zeichneCanyon()`,
  Kalibrierwerte `CANYON_P_STANDARD`)
- Schalter: `BAHN_FLAGS.climbingFormat` = `"standard"` (Vorgabe) | `"canyon"`; gesetzt nur über
  `window.__arena.bahnFlags({climbingFormat:"canyon"})` oder `window.__olyBahnFlags` vor dem Laden
- Messung: `node scripts/miss-climbing-canyon.mjs 48 [--pp] [--hilfe=aus|gedeckelt|voll] [--rangeln=aus] [--standard]`
  (Node-Motor, derselbe Messcode wie die Abnahme: `disziplinMessen()`, `einflussVon()`)
- Tests: `tests/climbing-canyon.test.ts` (Node-Motor, ohne Chromium)
- Bilder: `docs/design/climbing-canyon-bau-18-11/`, Aufnahme `scripts/screenshot-climbing-canyon.mjs`
- Assets: die Bestellung aus PR #1632 (`claude/climbing-assets-18-11`, in diesen Zweig gemergt):
  `public/sprites/kulissen/climbing-canyon/` (Wand 792 × 600, Reihe E3, Panorama, Vordergrund, Wandfuß) und
  `public/sprites/arena/climbing/canyon_*` (Glocke, Seilbrücke, Strickleiter, Rastpodest, Wegweiser, Startbogen,
  Kiefer, Griffblätter je Weg) plus VFX lite `fx-climbing-kreide/-steinschlag/-glocke-lite`

## 0. Kurzfassung

1. **Gebaut:** das Format „Canyon“ im Arena-Motor, hinter dem Schalter `climbingFormat:"canyon"`, Vorgabe aus. Wand
   als Ort mit Einstiegswand/Kamin, Band, Engstelle („obenrum“), drei Wegen, Grat und Glocke; Rangeln (mehrfach,
   jedes Mal teurer); Seilschaften aus den Slots der Einsatzliste mit gedeckelter Hilfe; Wegwahl aus dem Profil,
   Wegwechsel im Rennen; Tempo-Stellen getrennt von Kletter-Stellen; kurze Wartezeiten.
2. **Abnahme bestanden** (Node-Motor, n = 48, fünf Kader): rho je Spiel **0,860** (Standard heute 0,816), rho Saison
   0,888, Pp **12,3 / 16,1** (Pflicht ≤ 25; der zweite Stamm knapp über dem Optimum 15). Wartezeit 2,0 % der
   Kletterzeit, die drei Wege bei gleicher Eignung innerhalb ±2 %.
3. **Standard bit-identisch:** Fingerabdruck GESAMT `d3a39030a3ef` (75) wie auf main; Canyon mit eigener Summe
   `CANYON a3ffa010b879` außerhalb von GESAMT.
4. **Frage 8:** Einzelwertung bleibt die Basis, Teampunkte aus der bestehenden Rang-Logik, Seilschaftshilfe
   **gedeckelt** — sie hält rho über 0,80 und hebt es sogar leicht (Abschnitt 3).
5. **Zeichnung** auf der bestellten Canyon-Wand aus #1632 (792 × 600, 1-fach). Der Motor rechnet weiter auf dem
   gemessenen Routengraphen des Mockups; die Zeichnung bildet jeden Knoten über eine Ankertabelle aufs Wandbild ab.
   Die Messung bleibt damit gültig, Eisfall und Halle brauchen später nur eigene Anker.
6. **Sendedauer** bei 1×: Median 64 s, max 93 s; mit dem Rest-Zeitraffer aus #1617 (wirkt auch hier) 41 / 54 s.

## 1. Freigabe und Umsetzung je Punkt

| # | Chris, 18.11. | Umsetzung |
|---|---|---|
| 1 | Richtung ja | Wand als Ort, S-Route, Engstelle, drei Wege — wie im Mockup |
| 2 | neues Format NEBEN dem Standard hinter Schalter, Standard bit-identisch | `climbingFormat:"canyon"`; Fingerabdruck GESAMT `ce8fcef66028` (75 Einträge) unverändert, Canyon-Zeilen eigene Summe außerhalb von GESAMT (Abschnitt 5) |
| 3 | Wegwahl aus dem Profil, aber „spieler können ingame adjusten und eine andere route wählen“ — mit Kosten | Start: Seilschaften je Seite auf die drei Wege verteilt, Summe der Profilwerte maximal (Sub-Skills, nicht Rohattribute). Im Rennen zwei Wechselpunkte: **Gabel** (Schlüsselstelle des eigenen Wegs belegt und dort steht jemand → ganze Seilschaft auf den Ausdauerweg, einmal je Seilschaft) und **Rastnische** am Kraftweg (Puste unter 22 % → der Kletterer nimmt statt des Dachs das Band weiter zur Flanke). Kosten: 0,6 Welt-s Pause, dazu der fremde Weg |
| 4 | KEINE neuen Animationen | nur `north`, `south`, `east` (gespiegelt), `walk-north`, `walk-east`, `treffer-north`; Klettern aus Ruck, Neigung, Versatz, Pendeln, Seil, Schlagschatten (Abschnitt 4 des Konzepts) |
| 5 | Rangeln deutlich sichtbar | Marke „RANGELT“, beide Figuren stoßen im Takt, Staub, Kamerawackler 0,45 s, Einblender „RANGELEI!“/„ABGEBLOCKT!“ über `callout()`, Zeile im Verlauf |
| 6 | Assets: alle drei Wände dürfen gebaut werden, Mechanik zuerst auf der Canyon-Wand | Mechanik und Zeichnung auf der Canyon-Wand mit den Stilprobe-Assets; Eisfall/Halle und die Bestellung macht der Fable-Agent parallel |
| 7 | Abseilen/Flut später | nicht gebaut |
| 8 | Teampunkte: „überlege was am sinnvollsten ist“ — PM-Entscheidung: Einzelwertung als Basis, Teampunkte aus der bestehenden Logik, Hilfe nur gedeckelt, rho mit/ohne Hilfe messen | siehe Abschnitt 3 |
| 9 | Seilschaften = „die slots in der einsatzliste“ | benachbarte Slots eines Teams: 6 → 2+2+2, 5 → 3+2, 4 → 2+2 (3 → 3, 2 → 2); ohne saubere Slots die Aufstellungsreihenfolge. Keine Oberfläche |
| 10 | Rangeln „geht mehrfach aber kostet ausdauer“ | beliebig oft, nur gegen Gegner, am Band außerhalb der Buchten; der Angreifer zahlt 5 % Puste × (1 + 0,6 × bisherige Rangeleien), der Verteidiger 5 %, der Verlierer zusätzlich 3 % und steht 1,2 Welt-s; je Paar 6 Welt-s Pause bis zur nächsten |

## 2. Mechanik (was gebucht wird)

Chassis bleibt die Bahn (`BAHN_ART.climbing`, `MOTOREN.climbing`, `bahnLauf()`); nur `stepSpurt()` verzweigt bei
aktivem Format in `stepClimbingCanyon()` (Muster Hatz/HYROX). Jeder Kletterer hat einen eigenen Pfad aus Kanten
in Weltkoordinaten (1584 × 600, die des Mockups); `u.pos` ist der Anteil am eigenen Weg, `u.fertig` die
Glockenzeit. Der Format-Zustand liegt in `CANYON` (gesichert/zurückgesetzt mit den übrigen Bahn-Anzeigewerten);
an den Läufern werden nur die vorhandenen Felder `pos`, `hoch`, `fertig`, `reserve`, `leer` geschrieben.

| Baustein | Regel im Bau | Sub-Skills (vorhanden) |
|---|---|---|
| Tempo je Kante | `basis[art] × (0,25 + 1,30 × Kanal/100) × Tagesform(±3 %) × Wegfaktor × Rennplan`, unter 30 % Puste bis auf 50 % langsamer | Kanal = Mischung je Kantenart |
| Tempo-Stellen | Anlauf, Band, Felsblöcke, Grat | Zug, Ausdauertempo, Umsetzen (Band zusätzlich 15 % Griff, Blöcke 20 % Griff/15 % Kraftzug) |
| Kletter-Stellen | Einstiegswand, Kamin, Dach, Lippe, Brücke, Leiter — **ohne Tempo-Kanäle** | Wand: Griff/Kraftausdauer/Kraftzug/Zähigkeit/Kopf; Kamin: Griff; Dach/Lippe: Kraftzug; Brücke: Kopf/Griff; Leiter: Zähigkeit/Kraftausdauer |
| Puste | Zehrung je Kantenart × (1,5 − Ausdauer/100); Ausdauer = 40 % Zähigkeit, 35 % Kraftausdauer, 25 % Ausdauertempo | |
| Rast | zwei Rastpunkte am Band (unter 52 % / 50 %; Kraftweg vor dem Dach unter 86 %, lädt auf 97 %) | |
| Engstelle | Felsblöcke exklusiv; ist sie besetzt und wartet schon jemand oder stünde man 0,3 Welt-s → **obenrum** (längere Linie, Kletter-Puste) | |
| Band | hintereinander (Folgeabstand 18, Halt 14 Welt-px); in den drei **Buchten** außen vorbei (Puste ×2,4); **Wartedeckel**: nach 0,4 Welt-s außen vorbei, auch außerhalb der Bucht | |
| Rangeln | Abschnitt 1, Punkt 10; Entscheidung 60 % Kraftzug + 40 % Kopf + Würfel 0–16, der Vordere +4 | Kraftzug, Kopf |
| Seilschaft | Hochziehen, Anschieben, Vorstieg übernehmen; **gedeckelt** (Abschnitt 3) | Kraftzug/Kraftausdauer des Helfers über Puste und Zeit |
| Proben | Fehlgriff an der Schlüsselstelle der Einstiegswand (Griff), Lippe (Kraftzug + Puste, zweiter Versuch leichter), Seilbrücke (Kopf), Sturz ins Seil am Dach nur bei leerer Puste, höchstens einmal | Griff, Kraftzug, Kopf |
| Ende | erst wenn alle oben sind; Sicherheitsdeckel 80 Sim-s mit hochgerechneter Zeit (gemessen nie erreicht) | |
| Wertung | unverändert: `MOTOREN.climbing.wert()` ordnet nach Glockenzeit, `bahnTeamstand()` vergibt Rangpunkte | |

**Zeit.** Das Format rechnet in Welt-Sekunden des Mockups: `dtw = dt × 3,0`. Die Anzeige dehnt mit
`CANYON_ZEIT_DEHNUNG = 1,6` (statt 4,38 im Standard) — reine Anzeige.

**Gezeigt = gebucht.** Die Wiedergabe ruft dieselbe `stepSpurt()`-Schleife; die Zeichnung setzt jede Figur auf
den gebuchten Ort `(K.x, K.y)` und legt nur Ruck/Pendeln/Hängen als Anzeige darüber. Jede Szene (Rangeln,
Hilfe, Obenrum, Wegwechsel, Rast, Proben, Glocke) ist ein Motor-Ereignis mit Folge für Zeit oder Puste
(`CANYON.ereignisse`). Test: `tests/climbing-canyon.test.ts`, „gezeigt = gebucht“ (bitgleich je Tick).

## 3. Frage 8: Teampunkte und Seilschaftshilfe (Entscheidung)

**Entscheidung (PM-Vorgabe umgesetzt):**

- **Spielerwertung und Teamwertung wie heute.** Jeder Kletterer hat seine eigene Glockenzeit; `MOTOREN.climbing.wert()`
  (Rangtreue, Pp, PP-Gutschrift) und `bahnTeamstand()` (Rangpunkte N..1 je Kletterer, Summe je Team) bleiben
  unverändert. „Seilschaften oben“ ist Anzeige (Kopf im Bild, Einblender „SEILSCHAFT OBEN!“), keine zweite Wertung.
- **Warum nicht die Seilschaftszeit (zweite Glocke) als Teampunkte**, wie das Konzept empfahl: das wäre ein
  zweiter Wertungsweg neben der Einzelwertung, den keine andere Bahn hat; die Teampunkte hingen am Langsamsten
  jeder Seilschaft, und PP-Gutschrift (Einzelwertung) und Teamergebnis könnten auseinanderlaufen. Helfen lohnt sich
  trotzdem fürs Team: der gezogene Partner holt Rangpunkte auf.
- **Hilfe gedeckelt** (`hilfeGedeckelt`): Hochziehen kostet den Helfer 1,0 Welt-s und 5 % Puste, der Partner klettert
  1,0 Welt-s mit ×1,5; höchstens zweimal je Kletterer, 12 Welt-s Abklingzeit. Anschieben: Schub 0,8 Welt-s. Die
  Mockup-Werte („voll“: 1,4 s / ×1,9 / 1,8 s / dreimal) bleiben als Messvariante.

**Gemessen (rho je Spiel, Median über fünf Kader; in Klammern der schwächste Kader):**

| Hilfe | n = 48 | n = 96 | rho Saison (n = 48) |
|---|---:|---:|---:|
| aus | 0,833 (0,736) | 0,820 (0,736) | 0,874 |
| **gedeckelt (gewählt)** | **0,860 (0,732)** | **0,863 (0,761)** | 0,888 |
| voll (Mockup-Werte) | 0,846 (0,746) | 0,841 (0,773)¹ | 0,944 |

¹ vor der Wegkalibrierung gemessen. Die n = 96-Läufe stammen vom Stand vor der letzten Wartedeckel-Feinjustage.

Gedeckelte Hilfe hat in beiden Messungen den höchsten Median und hält das Ziel 0,80 klar. Hilfe drückt rho hier
nicht, weil sie eng an die Lage gebunden ist: der Vorsteiger zieht nur, wenn er weit voraus ist, und verliert dabei
eine Welt-Sekunde; der Gezogene wird nur an Kletter-Stellen und nur kurz schneller. Die Reihenfolge der Partner
bleibt meist erhalten, Staus und Einbrüche werden leiser. Der schwächste Kader (Eignung 37 bis 54, eng beieinander)
liegt in allen Varianten bei 0,73 bis 0,78, der Standard dort bei 0,738. Das ist die Grenze aus CLAUDE.md: Paare
unter zwei Punkten Abstand ordnet kein Motor.

## 4. Messung

Alle Werte über den Node-Motor (`scripts/lib/node-arena-seite.mjs`, derselbe Messcode wie die Abnahme:
`disziplinMessen()`, `einflussVon()`), Kaderfamilie `data/generated/kaderfamilie-live-save.json` (5 Paarungen, je
6 gegen 6), n = 48 je Kader. Kontrolle: der Standard trifft auf diesem Weg die eingetragenen Werte (vor #1617
0,801 / 0,881 und Pp 12,0 / 9,5 exakt; mit #1617 0,816). Befehl: `node scripts/miss-climbing-canyon.mjs 48 --pp`.

| Größe | Standard (Schalter aus, main mit #1617) | **Canyon (gewählt)** | Canyon ohne Rangeln |
|---|---:|---:|---:|
| rho je Spiel (Median) | 0,816 | **0,860** | 0,849 |
| Spannweite über die Kader | 0,174 | 0,172 | 0,124 |
| je Kader | 0,816 / 0,912 / 0,814 / 0,738 / 0,884 | 0,794 / 0,866 / 0,904 / 0,732 / 0,860 | 0,785 / 0,849 / 0,908 / 0,784 / 0,873 |
| rho Saison | 0,881 | 0,888 | 0,895 |
| Pp, Saatstamm 0 / 10 000 000 | 12,7 / 9,6 (laut #1617) | **12,3 / 16,1** | 7,2 / 12,8 |
| Sendedauer bei 1×, Median / max | 50 / 85 s (laut #1617) | 64 / 93 s | 64 / 92 s |
| mit Rest-Zeitraffer (#1617) | | 41 / 54 s | |
| Rechenzeit je Rennen (gleiche Last) | 42 ms | 80 ms | |
| Kletterer ohne echte Zielzeit | 0 | 0 (Deckel 80 Sim-s nie erreicht, längstes Rennen 58 Sim-s) | 0 |

**Pp je Attribut (Canyon, Stamm 0 / Stamm 2; Matrix in Klammern):** stamina 26,1 / 26,3 (26) · determination
13,0 / 13,4 (16) · speed 14,2 / 16,3 (12) · dexterity 14,2 / 15,4 (12) · health 11,7 / 9,3 (10) · power 7,2 / 7,4 (8) ·
will 7,0 / 5,7 (8) · awareness 6,7 / 6,1 (8). Tempo (speed, dexterity) liegt leicht über, Kopf (determination) leicht
unter der Matrix.

**R10 (Rangeln hebt power und will über ihr Gewicht):** nein. power und will liegen mit und ohne Rangeln unter
ihrem Matrixgewicht; Rangeln kostet 3 bis 5 Pp, vor allem über speed und dexterity (der Schnellere fängt die
Rangelei an).

**Formatspezifisch** (24 Rennen je Kader, je 12 Kletterer):

| Größe | Wert | Ziel (Konzept) |
|---|---:|---|
| Wartezeit-Anteil | 2,0 % der Kletterzeit | unter 5 % |
| meiste gleichzeitig Wartende | 6, in 2 von 60 Diagnose-Rennen; in 90 % höchstens 4 | nie lange 4 oder mehr |
| Zeit mit 4 oder mehr Wartenden je Rennen | Median 0,0, max 1,07 Sim-s (1,7 s Sendung) | kurz |
| längste Wartezeit am Stück | 5,0 Welt-s (2,7 s Sendung) | |
| wo gewartet wird (Welt-s je Rennen, alle 12 zusammen) | Band vor der Engstelle 3,3 · Kamin-Einstieg 4,2 · Band vor der Flanke 1,8 · Ausgang obenrum 1,7 | |
| Zeit je Weg bei gleicher Eignung (R2) | Kraft +0,4 % · Technik +1,3 % · Ausdauer −1,7 % | ±2 % |
| Anteil der Wege beim Start | je 33 % | keiner über 50 % |
| Nebenweg (Seilschaft geht nicht den eigenen Profilweg, R11) | 48 % der Kletterer | gewollt |
| je Rennen: Rangeleien / abgeblockt | 1,8 / 2,0 | |
| je Rennen: hochgezogen / angeschoben / Vorstieg | 6,2 / 2,8 / 0,1 | |
| je Rennen: außen vorbei / obenrum / Wegwechsel | 4,4 / 5,4 / 1,1 | |
| je Rennen: an der Lippe abgerutscht / Sturz am Dach / auf der Brücke gewankt / Fehlgriff | 1,0 / 0,6 / 1,5 / 1,4 | |

**Kalibrierung** (Werte in `CANYON_P_STANDARD`): Tempo-Spanne `sockel 0,25 / spanne 1,30` (vorher 0,40 / 0,85; der
größte Hebel, rho 0,79 auf 0,85); Wegfaktoren Kraft 0,96 / Technik 1,10 / Ausdauer 0,92 (R2); Band-Mischung mit
15 % Griff (Pp); Wartedeckel 0,4 Welt-s am Band, Engstelle 0,3 Welt-s oder sobald jemand wartet (W1/W2); Rangel-
Verlierer 1,2 Welt-s, Gewinner 0,6. Schnelle Kalibrierhilfe ohne einflussVon: `scripts/lib/canyon-empfindlichkeit.mjs`
(misst den Zeitanteil je Sub-Skill und schätzt daraus die Pp-Abweichung).

**Vor und nach #1617:** #1617 kam während des Baus auf main; die Canyon-Zahlen sind mit und ohne #1617 identisch
(das Format hat sein eigenes Ende). Die Pp-Läufe stammen vom Stand vor dem Rebase, die rho-Läufe von beiden.

## 5. Fingerabdruck

`node scripts/pruefe-wertung-fingerabdruck.mjs --node` (neu: Node-Motor statt Chromium, s. Skriptkopf):

| | Wert |
|---|---|
| GESAMT (75 Einträge, Schalter aus) | `d3a39030a3ef`, derselbe Wert wie main mit #1617 (vor dem Rebase `ce8fcef66028` wie main davor) |
| `spiele climbing/canyon 1 / 7 / 42` | `310b216c1cc8` / `727f3c3d16ef` / `8f7923e36b5e` |
| CANYON (3 Einträge, nicht in GESAMT) | `a3ffa010b879` |

Die Canyon-Zeilen stehen bewusst außerhalb von GESAMT. So bleibt GESAMT der Standard-Abgleich, und ein späterer
Umbau des Formats verschiebt nicht den Wert, an dem alle anderen Disziplinen geprüft werden.

## 6. Mockup gegen Bau

__BILDER__

## 7. Offene Punkte

1. **Live schalten:** Chris' Entscheidung. Der Schalter ist nur über `bahnFlags`/`__olyBahnFlags` erreichbar; für das
   echte Spiel fehlt die Stelle, die ihn setzt (etwa je Spieltag oder als Liga-Einstellung, wie die Spurt-Formatwahl).
2. **HUD-Profil** (Bauplan Schritt 5): das Dock mit Seilschaft-Kästen, die Spielerkarte mit Weg und Nebenweg und die
   Phase in der Kopfleiste fehlen noch. Im Bild stehen „Seilschaften oben“, Wartezähler, Weg-Legende und
   Routen-Inset; Kopfleiste, Uhr, Verlauf und Einblender kommen aus dem vorhandenen Arena-HUD.
3. **Kamera-Modi** Totale und Folgen (Bauplan Schritt 6); gebaut ist die Regie-Kamera.
4. **Wegwahl von Hand** („spieler können ingame adjusten“): im Motor wechseln die Kletterer selbst (an der Gabel
   bei belegter Schlüsselstelle, an der Rastnische bei leerer Puste). Ein Knopf, mit dem der Spieler einen Wechsel
   ansagt, ginge über die vorhandene Rennplan-Ansage (`planWechsel`) und ist nicht gebaut.
5. **Pp zweiter Stamm 16,1:** innerhalb der Pflicht (≤ 25), knapp über dem Optimum 15. Hebel wäre weniger Tempo-
   Gewicht auf dem Band (speed und dexterity liegen 2 bis 4 über der Matrix), ohne rho zu verlieren.
6. **Ankertabelle** nach Augenmaß am Wandbild gesetzt (±5 px). Die Einstiegswand ist im Bild enger als im Mockup
   (Linien x 192 bis 290); bei 12 Kletterern stehen die Wandlinien dicht.
7. **Rechenzeit** knapp doppelt so hoch wie im Standard (80 statt 42 ms je Rennen); für einen Spieltag unkritisch,
   aber glättbar (die Nachbarsuche je Tick ist quadratisch).
8. **Rangtreue auf Seilschaftsebene** (R9) nicht gesondert gemessen.
9. **Chromium-Fingerabdruck** (das Skript ohne `--node`, unter der Aufnahme-Sperre) nicht gelaufen; der Node-Lauf
   trifft GESAMT von main.
10. Eisfall und Kletterhalle (Assets aus #1632 liegen bereit), Abseilen und Flut: später.
