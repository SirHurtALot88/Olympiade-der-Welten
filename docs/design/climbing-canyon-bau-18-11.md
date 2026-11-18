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
- Assets (Stilprobe aus dem Mockup, unverändert): `public/sprites/kulissen/climbing-canyon/`

## 0. Kurzfassung

__KURZ__

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

__ENTSCHEIDUNG__

## 4. Messung

__MESSUNG__

## 5. Fingerabdruck

__FINGERABDRUCK__

## 6. Mockup gegen Bau

__BILDER__

## 7. Offene Punkte

__OFFEN__
