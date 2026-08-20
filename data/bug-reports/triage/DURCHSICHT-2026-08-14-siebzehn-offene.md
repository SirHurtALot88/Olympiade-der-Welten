# Durchsicht: die 17 Meldungen vom 14.08. ohne Triage-Notiz

Chris: *„ja geh die 17 durch und sag mir was noch offen ist"*

Alle 17 stammen aus **einem** Spielstand (`new-game-1786626914058-hwz8fk`, Saison 2) und hatten
bis hierher keine Triage-Datei — anders als die 13 Tickets #32–#44, die eine haben. Sie sind
also nie quittiert worden, nicht einmal mit „offen".

**Wie diese Durchsicht gemacht wurde, und was sie wert ist.** Gemessen wurde am Live-Abbild und
im Quelltext, nicht aus der Erinnerung. Wo ein Befund am Spielstand nachweisbar war, steht er mit
Zahl da. Wo der Spielstand inzwischen weitergelaufen ist (er steht heute auf Saison 2, Spieltag
10 — Chris meldete an Spieltag 1), lässt sich der damalige Zustand **nicht** rekonstruieren; das
ist dann ehrlich als „am Bildschirm nachsehen" markiert statt als Vermutung verkauft.

## Stand

| Meldung | Thema | Stand |
|---|---|---|
| `17xs83` | Team-Steuerung an zwei Stellen umstellbar | **halb behoben** — zweite Hälfte in #592 |
| `c6ick6` | MD10 D2 läuft nicht durch | **behoben** (#556) |
| `diwdvh` | Startwert in der Attributentwicklung fehlt | **behoben** |
| `l4835p` | Top-Disziplinen ohne All-Time | **behoben** |
| `vjirth` | Arena 9,1 ≠ Saisonstand 9,9 | **behoben** (Mutatorpunkte) |
| `8sbs35` | Depth-Chart: 80/90er gelb statt hellblau | **offen — Entscheidung** |
| `ne85u5` | 34 Verletzungen an MD8 | **offen — Entscheidung** (vertagt) |
| `lcmgxx` | Ewige Tabelle: Verlauf je Saison + Grafik | **offen — Vorhaben** |
| `kn3o08` | Historie: Fenster je Team mit Käufen/Verkäufen | **offen — Vorhaben** |
| `sgj1hq` | Lineup speichern bei mehreren Teams | **offen — Frage, kein Fehler** |
| `wg919y` | Eigene Verkäufe hängen in S1 fest | **am Bildschirm nachsehen** |
| `cubix1` | Saisonwechsel blockiert Käufe | **am Bildschirm nachsehen** |
| `6fv43h` | Apron zieht nicht | **am Bildschirm nachsehen** (zieht heute) |
| `cankgm` | M-M geht all-out mit Kredit | **am Bildschirm nachsehen** (PR #563) |
| `ru28ai` | >10 Einsätze an MD1 von S2 | **am Bildschirm nachsehen** |
| `st1trd` | Ab S2 müssten legendäre Spieler da sein | **am Bildschirm nachsehen** |
| `qwbnic` | S-C +18,4 Form trotz negativer Karten | **am Bildschirm nachsehen** |

## Die Belege

### behoben

**`17xs83` — Team-Steuerung an zwei Stellen. KORREKTUR (20.08.): meine Quittung war zu grob.**

Die Meldung hat ZWEI Hälften, und ich hatte nur die eine geprüft. Chris schrieb:

> „Beim Switch in Season 2 ist C-C plötzlich auch ein von mir gesteuertes Team! aber nur im KI
> Verhalten Reiter - und ich bekomme das nicht weg... deswegen sollte es nur noch einen Weg geben"

Der EINE WEG ist da — das ist die Hälfte, die ich unten beschreibe und die stimmt. Dass ein FREMDES
Team sich als seines ausgibt, ist die andere, und die war beim Abhaken noch offen. Sie wird in
**#592** („Fremdes Team gibt sich nicht mehr als meines aus, `17xs83`, Teil 1") behoben —
`lib/foundation/team-control-settings.ts` plus eine Heilung für bestehende Spielstände.

„Behoben" war damit die falsche Vokabel für einen Befund, den ich nur zur Hälfte nachgemessen
hatte. Der Rest dieses Abschnitts beschreibt weiterhin korrekt, was auf `main` liegt.

**Die geprüfte Hälfte.** Chris' Folgesatz steht wörtlich im Quelltext:
„ich will keine spielstände mehr reparieren, hau es raus mach mir nur einen sauber verknüpften
weg für die zukunft". Das zweite 32-Klub-Raster im Reiter „KI-Verhalten" ist ersatzlos entfallen
(`FoundationTeamSettingsNewLook.tsx`, Abschnitt `game-mode-ownership-readonly`). Wem ein Team
gehört, wird jetzt genau einmal entschieden — beim Anlegen unter „Spielstände & Start". Die Zeile
darunter zeigt es weiterhin an: sehen ja, ändern nein.

**`c6ick6` — MD10 D2 läuft nicht durch.** Commit `02b60d21`, „HOTFIX: Verletzung in D1 haengt den
Spieltag in Disziplin 2 auf" (#556). Symptom und Fix decken sich.

**`diwdvh` — Startwert fehlt.** Am Abbild nachgemessen: `playerBaselines` liegt für **2984 von
2984** Spielern vor, und die Attribut-Historie liefert für jeden Stichprobenspieler die Reihe
`Start → Season 1 → Season 2`. Die Start-Zeile wird also gebaut. Für die **PP**-Entwicklung gibt
es keine — dort ist der Startwert per Konstruktion 0, eine eigene Zeile dafür wäre eine leere
Aussage.

**`l4835p` — Top-Disziplinen ohne All-Time.** `allTimePoints` und `allTimePointsRank` stehen in
der Tabelle (`PlayerDetailDrawer.tsx`). Falls Chris die Spalte nicht sieht: sie ist über die
Spaltenwahl ausblendbar — das wäre dann eine Voreinstellung, kein fehlendes Feature.

**`vjirth` — Arena 9,1 ≠ Saisonstand 9,9.** Das ist der Mutatorpunkte-Befund, den Chris am 19.08.
noch einmal gemeldet hat (`w4eloo`, `re954b`) und der inzwischen behoben ist: die Bonuspunkte des
Mutators wurden je Spieler geführt, aber nie auf Teamebene in die Saisontabelle gezogen. Ligaweit
fehlten 101,40 Punkte, acht Plätze standen falsch. Seine Differenz von 0,8 passt in die
Größenordnung eines Mutator-Bonus.

### offen — und der Grund steht dabei

**`8sbs35` — Depth-Chart-Farbe.** Chris will für 80/90er Werte Hellblau, im Code steht ab 80
**Gold**. Das ist kein Versehen: die Umstellung kam am 08.08. (#457, „UI-Fundament") mit der
Begründung, eine Skala, die `risk` enthält, trägt nie die Teamfarbe — die Spitzenstufe ist das
theme-feste Gold, wie in der Rang-Skala. Sein „gelb" ist dieses Gold. **Entscheidung: Gold
behalten oder für die Depth-Chart auf Hellblau zurück.**

**`ne85u5` — 34 Verletzungen an MD8.** Der Anker bei Ermüdung 100 ist auf Chris' Wunsch von 40 %
auf 33 % gesenkt (#539, erwartete Verletzungen 185,0 → 175,3). Den größten Brocken trägt aber das
Band 65–80 (11,4 % der Würfe, 47 Verletzungen), und den Endspurt-Stau hat Chris ausdrücklich
stehen lassen: „ne ich würde das so lassen und gucken wie man mit der fatigue zurecht kommt".
Sein zweiter Vorschlag — KI kauft mehr Spieler Richtung OPT — ist unangetastet.

**`lcmgxx` (ewige Tabelle) und `kn3o08` (Team-Fenster in der Historie)** sind keine Fehler,
sondern gewünschte neue Ansichten. Beide brauchen eigenen Zuschnitt.

**`sgj1hq` — Lineup speichern bei mehreren Teams.** Eine Frage, kein Fehlerbericht: ob die Arena
erst beim letzten manuell geführten Team bereit werden soll. Braucht eine Antwort, keinen Fix.

### am Bildschirm nachsehen

Für diese sieben ist der damalige Zustand nicht mehr rekonstruierbar — der Spielstand steht heute
auf Saison 2, Spieltag 10, Chris meldete an Spieltag 1. Was sich sagen lässt:

- **`6fv43h` (Apron):** er zieht heute. Am Abbild gemessen zahlt M-M **27,98** bei 98,7 Gehalt,
  Z-H 15,96 bei 88,8. Chris' „müssten fast 60 Mio zahlen" passt nicht dazu — dazwischen liegt der
  Konjunkturhebel (aktuell 0,759) und der Deckel. PR #559 macht genau diese Drosselung sichtbar;
  danach lässt sich die Zahl gegen die Erwartung halten statt gegen ein Gefühl.
- **`cankgm` (M-M all-out mit Kredit):** PR #563 deckelt die KI-Reserven auf 60 % des
  Kontostands. Ob das den Fall trifft, zeigt erst ein Lauf.
- **`ru28ai` (>10 Einsätze an MD1 von S2):** an Spieltag 1 der zweiten Saison hat ein Spieler,
  der S1 durchgespielt hat, **zu Recht** 10 All-Time-Einsätze. Der Verdacht wäre nur dann ein
  Fehler, wenn die Spalte die laufende Saison meint. Das entscheidet die Spaltenbeschriftung am
  Bildschirm.
- **`st1trd` (legendäre Spieler ab S2):** der Reiter „🏆 Legendäre Spieler" existiert seit dem
  09.08. Wenn er bei Chris leer war, liegen die Kriterien in `buildLeagueLegends` zu hoch — das
  ist eine Schwellenfrage, kein fehlendes Feature.
- **`qwbnic` (S-C +18,4 Form trotz negativer Karten)**, **`wg919y` (eigene Verkäufe hängen in
  S1)** und **`cubix1` (Saisonwechsel blockiert Käufe)**: hier fehlt der Bildschirm von damals.

## Was daraus folgt

Fünf der siebzehn sind behoben, fünf sind offen mit benanntem Grund, sieben brauchen einen Blick
ins Spiel. **Der schnellste Weg für die letzten sieben ist nicht Archäologie, sondern eine neue
Meldung**, wenn sie noch auftreten — die trägt dann den Spielstand, die Ansicht und den Spieltag
mit sich, und der Spiegel liefert sie ohne Chris' Zutun.
