# H-C — Der Torwart als erster Passgeber: gebaut, gemessen, NICHT gemergt (07.10.)

**Auftrag:** `docs/design/fable-ideen-feldspiel-30-09.md` §5 H-C, mit Chris' Zustimmung als
kleines Klasse-B-Paket zusammen mit Basketball B2a. Abbruchregel aus dem Auftrag: bleibt die
Torwart-Rangtreue unveraendert oder wird sie schlechter, wird H-C **nicht** gemergt und hier
dokumentiert. **Genau das ist eingetreten:** alle Rangtreue-Zahlen sind bit-identisch zu `main`.

## 1. Was das Dokument annahm, und was der Code tatsaechlich tut

Das Dokument (30.09.) hatte zwei Dinge ausdruecklich **nicht** am Code geprueft: ob der Torwartpass
heute einen Festwert liest, und ob seine Zielwahl ueber die Passqualitaets-Kette laeuft. Beides
vor dem Bau nachgelesen:

- **Zielwahl.** `entscheideBallaktion()` hat oben einen Torwart-Zweig (`stehtImTor(u)` oder der
  Fuehrungs-Riegel `hockeyRiegelKlaert(u)`): Ziel ist `offensterMitspieler(mitspieler,u)`, danach
  `passeAb(u,ziel)`. `offensterMitspieler` lost ueber ABSCHLUSS des Ziels, `qualitaet(ziel)`
  (TECHNIK/TEAMGEIST des Ziels), `offenheitFuerPass(von,ziel)` (nur die POSITION des Passgebers)
  und die ABWEHR des Ziel-Deckers. Kein einziger Wert des Passgebers. Die Zielwahl ist also
  dieselbe wie bei jedem Feldspielerpass und von H-C unberuehrt — H-C ist eine
  **Schwellen-, keine Kaskadenaenderung**, wie das Dokument es fuer diesen Fall vorhergesagt hatte.
- **Kein Festwert.** Die Qualitaet des Passes las schon bisher einen Attributwert, und zwar den
  **AUFBAU des Torwarts** (Hockey-Rezept stamina 57 / speed 23 / awareness 13 / power 7) an drei
  Stellen: eigener Fehlpass in `passeAb()`, Assist-Fenster in `loeseFlugAuf()` und
  `hockeyPassQualBonus()` beim Empfaenger. Inhaltlich falsch fuer einen Torwart, aber kein Festwert.
- **A1/A2** bucht die Beruehrungskette (`merkeBeruehrung`) fuer den Torwart schon heute wie fuer
  jeden anderen; `feldspielWert()` rechnet sie fuer ihn mit (`+u.assists1*2+u.assists2*1.5`).

## 2. Was gebaut ist (Branch `feldspiel-hc-torwartpass-paket-07-10`)

`passQualitaetVon(von)`: fuer den Torwart IM Tor (Hockey) seine TECHNIK (awareness 46 /
determination 31 / dexterity 23 — die Mischung, die das Dokument nennt, kein neuer Sub-Skill),
fuer jeden anderen zeichengleich AUFBAU. An den drei Ketten-Stellen statt `von.AUFBAU` gelesen.
Dazu ein reiner Buchfuehrungs-Zaehler `fsLive.torwartPaesse` und zwei read-only Hooks fuer die
Sonde `scripts/verify-hockey-torwartpass-paket-07-10.mjs`.

## 3. Gemessen — vorher (main 2470c502) gegen nachher

| Messung | vorher | nachher |
|---|---:|---:|
| Hockey rho je Spiel, alle 12 (Median, Kader-Familie, n=24) | 0,640 (Sp. 0,222) | 0,640 (Sp. 0,222) |
| Hockey rho Saison, alle 12 | 0,797 | 0,797 |
| Hockey nur Feldspieler, rho je Spiel / Saison | 0,676 / 0,782 | 0,676 / 0,782 |
| **Torwart, gepoolte Saison-Rangtreue** (`miss-hockey-rangtreue-je-rolle.mjs 24`, n=28) | **0,242** | **0,242** |
| Verteidiger, gepoolte Saison-Rangtreue | 0,248 | 0,248 |
| Stuermer, rho je Spiel / Saison | 0,742 / 0,900 | 0,742 / 0,900 |
| `miss-rangtreue-nach-rolle.mjs hockey 48` (Testkader): alle / Feld | 0,937 / 0,945 | 0,937 / 0,945 |

Die gesamte Ausgabe von `miss-hockey-rangtreue-je-rolle.mjs 24` ist vorher und nachher
zeichengleich. Im Testkader (`miss-rangtreue-nach-rolle.mjs`) verschieben sich einzelne
Spielerwerte in der ersten Nachkommastelle (Draco Verluste 3,9 → 4,0, Seraph-11 Wert 6,0 → 6,1),
die Rangfolge nicht.

Die Pp-Sonde (`messe-arena-einfluss.mjs hockey 48`, zwei Saatstroeme) wurde fuer H-C nach rund
50 Minuten abgebrochen: die Maschine lief mit Last 20-36 (mehrere parallele Sitzungen), Hockey-Pp
bei n=48 haette Stunden gebraucht, und das Ergebnis haette die Entscheidung nicht mehr aendern
koennen — die Abbruchregel greift schon an der Rangtreue.

## 4. Warum sich nichts bewegt: der Torwart spielt den Puck fast nie

Die Sonde zaehlt es direkt (Kader-Familie, 5 Paarungen x 24 Spiele = 120 Spiele):

- **4 Torwartpaesse in 120 Spielen — 0,033 je Spiel**, also einer in rund 30 Spielen.
- Von 1199 Toren hatte der Torwart (im Tor) **eine** Erstvorlage (A1) und **keine** A2.
- Im selben Zweig spielen Feldspieler ueber den Fuehrungs-Riegel 298-mal (der Riegel ist nicht H-C).

Der Grund steht im Motor: nach einer Parade geht der Puck entweder als Abpraller **frei** ins
Feld (`ausgang==="abpraller"`, dann kaempfen die Feldspieler darum) oder der Torwart **haelt fest
und es gibt Bully** (`ausgang==="fest"`). Der Torwart bekommt den Puck nur, wenn ein loser Puck
ohnehin in seiner Greifreichweite liegt — er "laeuft dem Puck nicht nach" (Wettlauf um den losen
Puck, `PUCK_LAUF_FENSTER`). Eine Eingabe, die in einem von dreissig Spielen einmal gelesen wird,
kann die Rangtreue nicht bewegen — egal, welches Attribut sie liest.

Nebenbefund: im Mittel der tatsaechlich gespielten Torwartpaesse lag TECHNIK bei 35,5 und AUFBAU
bei 55,3 — der Umbau haette die wenigen Paesse im Schnitt sogar **schlechter** gemacht (inhaltlich
richtiger, weil ein Torwart kein Laeufer ist, aber das gehoert zur Ehrlichkeit der Zahl).

## 5. Was H-C braeuchte, um zu wirken — Chris' Entscheidung, nicht Teil dieses Auftrags

Der zweite Kanal fuer den Torwart entsteht erst, wenn er den Puck **regelmaessig** spielt. Die
naheliegende Stelle ist der Ausgang `fest`: statt immer Bully koennte der Torwart in einem Teil
der Faelle den Puck behalten und herausspielen ("Erstpass nach der Parade", wie im Dokument
beschrieben). Das ist aber genau die **Kaskade**, vor der das Dokument selbst warnt: ein neuer
Ballbesitz statt eines Bullys verschiebt, wer den Puck traegt, und damit Positionen und
Folgeereignisse — Klasse B mit Kaskadenrisiko, eigene Messrunde, und eine Frage an Chris
(wie oft haelt ein Torwart fest und wirft ab, wie oft gibt es Bully?). Erst danach lohnt es sich,
H-C (TECHNIK statt AUFBAU im Torwartpass) wieder aufzugreifen; der Code dafuer liegt auf diesem
Branch bereit.
