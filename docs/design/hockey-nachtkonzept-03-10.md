# Hockey: Nachtkonzept „Die Strafe muss wehtun" (03.10., Konsultation, kein Code)

Chris, 02.10., wörtlich: „wie viele disziplinen haben wir die recht langwilig aussehen oder wo
nicht so viel passiert wenn man zuschaut? […] beim gewichtheben könnte man als manager den leuten
ja zb auch vorgeben wer versucht zu pushen und risiko zu gehen und wer hält sich lieber etwas
zurück etc. so müssen wir denken wie man mit einfachen methoden das spiel etwas interaktiver
gestalten kann und das auch nen gewissen impact haben kann - mehr risiko führt dazu dass jemand
sich evtl übertrifft oder unter dem druck oder gewicht einbricht."

Und am 03.10. abends: „bei den anderen event poors bitte heute über die nacht auch konzepte
ausarbeiten damit wir für gewichtheben und die anderen 8 auf jeden fall die konzepte haben, denk
gern um die ecke, hol infos aus dem internet und probier dich aus."

**Was dieses Papier ist:** eine Konsultation. `public/mockups/battle-mode.engine.js`, die
Eignungsmatrix und alle Rezepte sind unverändert. Alle Messungen unten liefen auf einer
**Kopie** des Motors in einem Scratch-Verzeichnis außerhalb des Repos (Stand `main` `68563962`).
Die Kopie ist nach der Messung verworfen, nichts davon ist committet.

Ausgangspunkt ist der Hockey-Eintrag in `docs/design/manager-risiko-interaktivitaet-konzept-02-10.md`
(Zeile 3 und Zeile 9 der Tabelle): „7:50 Dauer, bis 88 s ohne Banner. Überzahl bringt fast keinen
Vorteil (0,194 gegen 0,196 Versuche/Sekunde) — eine Strafe kostet nichts". Dort steht als Hebel nur
„Härte je Verteidiger (Fable H-B) … erst sinnvoll, wenn Überzahl wirklich kostet". Dieses Papier
beantwortet die Vorfrage: **wie bekommt Überzahl einen echten, messbaren Vorteil?**

---

## Kurzfassung

1. **Die Schussuhr ist NICHT der Grund, warum Überzahl nichts bringt.** Das war die naheliegende
   Vermutung (8-s-Schussuhr zwingt beide Seiten gleich oft zum Abschluss). Gemessen: eine auf das
   Doppelte verlängerte Schussuhr in Überzahl ändert **kein einziges Ereignis**, die Läufe sind
   ziffernidentisch. Kein Hockey-Angriff erreicht 8 s; der Puck wechselt im Median nach 1,15 s den
   Besitzer. Der echte Grund ist die **Unterzahl, die einfach weiter angreift**: sie schießt
   heute mit 66 % der Gleichzahl-Rate und stellt damit 34 % aller Versuche während einer Strafe
   (NHL: 19 %), und sie trifft in 7,5–7,7 % aller Strafen ins Tor (real rund 2–3 %).
2. **Kernidee „Befreiungsschlag" (K1):** die Unterzahl darf, wie im echten Eishockey nach Regel
   81.1, den Puck straffrei über das ganze Eis schießen — und tut das, statt einen Angriff
   aufzubauen. Im Motor ist das **eine Bedingung an einer Stelle, die es schon gibt** (der
   Klär-Zweig des Führungs-Riegels aus T1). Gemessen im Motor-Prototyp (n=48, zwei Saatstämme):
   **allein und tief** halbiert er die Unterzahl-Rate, kostet aber die Überzahl ebenso viel Zeit —
   netto kostet eine Strafe kaum mehr. **Flach** (Puck knapp hinter die Mittellinie) und zusammen
   mit K3/K4 (Variante V5) entsteht ein NHL-nahes Profil: Überzahl schießt 1,5-mal so oft wie
   Gleichzahl, Unterzahl-Anteil 17–18 % (NHL 19 %), Überzahl-Tore je Strafe 19–22 % (NHL 21,6 %),
   Unterzahl-Tore je Strafe 4,0–4,6 % statt 7,5–7,7 %. **Eine Strafe kostet damit rund
   anderthalbmal so viel wie heute**, und es gibt sieben sichtbare Befreiungsschläge je Spiel.
   Tor- und Fangquoten wurden dafür nicht angefasst.
3. **Was Überzahl zur Spannungsspitze macht, ist eine Überzahl-Einheit mit festen Plätzen (K2):**
   Direktschütze am Bullypunkt, Netfront, Quarterback an der Bande — der Manager setzt sie, die
   KI-Vorgabe kommt aus den Sub-Skills, nie aus der Eignung. Im Modell (echte Kaderdaten) ist sie
   **rho-neutral** (in einem von zwei Stämmen +0,02 Saison-Validität), und eine falsch besetzte
   Einheit kostet sichtbar rho und Tore. Das ist der „Impact" aus Chris' Satz.
4. **Chris' Risiko-Idee passt hier als „Härte" je Spieler (K3):** Sauber / Normal / Hart. Hart heißt
   mehr Checks und mehr Puckgewinne, aber auch mehr Strafen — und eine Strafe kostet nach K1
   endlich etwas. Grundlage ist eine Strafneigung über TECHNIK statt über die reine Check-Wucht.
5. **Eine verlockende Idee ist gemessen schädlich: Strafen in der Spielerwertung buchen**
   („wer eine Strafe nimmt, verliert Wertpunkte", wie die Take/Draw-Komponente in Evolving-Hockeys
   GAR). Im Paarvergleich bei identischen Ereignissen sinkt rho je Spiel in allen drei Messungen
   (−0,002 / −0,009 / −0,033). Klein, aber nie positiv. Nicht bauen.
6. **rho:** keiner dieser Vorschläge löst Hockeys Rangtreue-Lücke (heute 0,614 / 0,649 alle
   zwölf, 0,692 / 0,705 nur Feldspieler, kaderfest, n=48, Mutatoren je Spiel). Sie sind so
   gebaut, dass sie sie **nicht verschlechtern**, und gemessen tun sie das auch nicht: V5 liegt
   bei 0,701 / 0,691 (Feldspieler), alle Bewegungen weit unter der Kader-Spannweite (0,13–0,22). Der einzige große strukturelle rho-Hebel bleibt die Eiszeit (eine zweite
   Reihe), und das ist eine Kaderfrage für das ganze Spiel — hier nur benannt (Abschnitt 6).
7. **Klasse:** K1, K3, K4 sind B (echte Mechanik, Chris' Ja und volle Abnahme). K2 und K5 sind B
   plus ein neues Feld im Spieltag (M). **K6 Penaltyschuss und K7 Verlängerung sind T**
   (Sendezeit), K7 zusätzlich C (Wertung, kein Remis mehr) — beide nur dokumentiert, nicht zum Bau
   empfohlen ohne Chris' ausdrückliche Zustimmung.

| # | Konzept | Was der Zuschauer sieht | Klasse | rho-Risiko | Stand der Prüfung |
|---|---|---|---|---|---|
| K1 | **Befreiungsschlag** (Unterzahl klärt, Icing-Ausnahme), **flach** | die Unterzahl schießt den Puck aus der Zone, die Überzahl baut neu auf, Welle um Welle | B | gering | im Motor-Prototyp gemessen (Abschnitt 4), rho im Rauschen |
| K2 | **Überzahl-Einheit 1-3-1** | fünf feste Plätze, Pass quer, Direktschuss | B + M | gering | im Modell gemessen (Abschnitt 5) |
| K3 | **Härte je Spieler** (Strafneigung über TECHNIK) | „Anweisung greift: X geht hart rein", Strafbank | B + M | gering | Schwelle im Motor-Prototyp gemessen |
| K4 | **Überzahltor beendet die Strafe** | Sünder kommt nach dem Tor sofort zurück | B | sehr gering | im Motor-Prototyp gemessen |
| K5 | **Torwart ziehen als Manager-Voreinstellung** (nie/spät/früh) | Mechanik existiert (T1), nur der Zeitpunkt wird Entscheidung | B + M | sehr gering | nicht gemessen, Mechanik live |
| K6 | **Penaltyschuss** bei Foul am Durchbrechenden | Standbild, Duell Schütze gegen Torwart | B + **T** | sehr gering | nur Konzept |
| K7 | **Verlängerung 3-gegen-3 + Penaltyschießen** | leeres Eis, Sudden Death | **T + C** | gering | nur Konzept (Fable H-A) |
| — | Schussuhr in Überzahl verlängern | — | — | — | **gemessen wirkungslos, verworfen** |
| — | Strafen in der Wertformel buchen (Take/Draw) | — | — | — | **gemessen rho-schädlich, verworfen** |

---

## 1. Problemrahmen

### 1.1 Was heute gemessen ist (Basislinie dieser Runde)

Eigene Sonde auf der Motor-Kopie: Zähler je Feldstärke-Zustand (Gleichzahl, Überzahl 5-gegen-4,
5-gegen-3), eingebaut **ohne einen einzigen zusätzlichen `rr()`-Aufruf** — die Basislinie
reproduziert die dokumentierten Zahlen ziffernexakt (n=48, Stamm 1337: alle zwölf 0,614,
Feldspieler 0,692, Saison 0,804 — genau die H4-Basis in `hockey-h4-h5-messung-02-10.md`; n=24:
0,640 wie im Dreizehnten Nachtrag von `stand-aller-disziplinen.md`). Kaderfest, fünf echte Paarungen aus
`data/generated/kaderfamilie-live-save.json`, Mutatoren „je Spiel" wie im Spiel, zwei
Saatstämme (`saat0` 1337 und 4242).

| Größe (Basislinie, n=48, Stamm 1337 / 4242) | Motor heute | NHL-Größenordnung |
|---|---|---|
| Schussversuche/s je Team, Gleichzahl | 0,194 / 0,191 | — |
| Schussversuche/s, Überzahl-Seite | 0,247 / 0,248 | rund 1,9× Gleichzahl (2.1) |
| Schussversuche/s, Unterzahl-Seite | 0,126 / 0,126 | rund ¼ der Überzahl (19 % Anteil, 2.1) |
| Unterzahl-Anteil an den Versuchen in Überzahl | 34 % / 34 % | 19 % |
| Überzahl-Tore je Strafe | 17,1 % / 19,7 % | 21,6 % |
| Unterzahl-Tore je Strafe | 7,7 % / 7,5 % | rund 2–3 % (eigene Überschlagsrechnung, 26.09.-Review) |
| Strafen je Spiel (beide Teams) | 7,6 / 7,8 | 2 × 3,5 |
| Anteil Spielzeit in Über-/Unterzahl | 20 % / 21 % | rund 14 % |
| Tore je Spiel | 10,4 / 10,5 | 6,1 |
| Versuche führende / zurückliegende Mannschaft (Gleichzahl, Summe) | 8450/6077 / 8012/5956 | s. Lesart |

**Lesart, und eine Korrektur an einem älteren Befund:**

- Die Überzahl schießt heute etwas mehr als die Gleichzahl (rund 1,3-fach), nicht gleich viel wie
  in der 26.09.-Sonde auf dem Einzelkader (0,194 gegen 0,196). Real ist es rund das Doppelte
  (Abschnitt 2.1). Der eigentliche Fehler sitzt auf der **anderen** Seite: die Unterzahl schießt
  mit rund zwei Dritteln der Gleichzahl-Rate weiter.
- **Die Überzahl trifft je Versuch nicht besser als die Gleichzahl** (0,107 / 0,123 gegen
  0,115 / 0,116). Real trifft sie rund 1,5-mal so gut (2,8-fache Torrate bei 1,9-facher
  Schussrate, 2.1) — weil sie Querpässe und Direktschüsse aus festen Plätzen spielt. Diese Lücke
  schließt kein Raten-Hebel, sondern nur eine Formation (K2).
- **Führend/zurückliegend:** die führende Mannschaft schießt rund 40 % öfter als die
  zurückliegende. Das Konzeptreview vom 26.09. las das als „Vorzeichen verkehrt" gegenüber den
  Score Effects der NHL. **Das ist so nicht belegt**: es vergleicht zwei verschiedene
  Mannschaften, und meistens führt die bessere — die schießt ohnehin mehr. Die echte Analytik
  vergleicht **dieselbe** Mannschaft in verschiedenen Spielständen. Wer Score Effects nachbauen
  will, braucht diese Messung zuerst (offene Frage 8.7).

### 1.2 Warum die Schussuhr unschuldig ist

Die naheliegende Erklärung war: die 8-s-Schussuhr (`live.schussuhr`) zwingt jede Mannschaft alle
acht Sekunden zum Abschluss, egal wie viele Spieler auf dem Eis stehen. Im Prototyp habe ich sie
für die Überzahl-Seite auf 16 s verdoppelt (Schalter `ppUhr`). **Ergebnis: alle Zähler, alle
rho-Werte, jedes Tor ziffernidentisch zum Lauf ohne den Schalter** (n=24, Stamm 4242, 120
Spiele). Die Bedingung `fsLive.angriffSeit > schussuhr` ist in Überzahl in diesen 120 Spielen also
kein einziges Mal anders ausgefallen — sonst hätte sich die Zufallsbahn verschoben; der Puck wechselt vorher den
Besitzer (Median 1,15 s, 112 Besitzwechsel je Spiel laut 13.09.-Konzept 3.4). T2 aus dem
26.09.-Review schlägt „Schussuhr für die Überzahl aussetzen oder verlängern" vor — dieser
Baustein kann ersatzlos entfallen.

Was stattdessen fehlt, ist das Verhalten der Unterzahl. Der Motor kennt für sie nur eine
Formationstabelle mit weniger Plätzen (`UNTERZAHL_PLAETZE`); im Angriff spielt sie normal weiter.
Im echten Eishockey hat sie eine einzige Aufgabe — den Puck loswerden — und dafür eine eigene
Regel (2.2).

### 1.3 Was an rho hängt

Hockey steht kaderfest bei **0,614 / 0,649 (alle zwölf) und 0,692 / 0,705 (Feldspieler)** je
Spiel, Saison 0,804 / 0,882 (Feldspieler; Basislinie dieser Runde, n=48, Stamm 1337 / 4242). Das ist die schwächste Zahl unter den
neun ereignisarmen Disziplinen. CLAUDE.md zerlegt sie in Validität × √Verlässlichkeit; die
Hockey-Runden der letzten Wochen (`hockey-opus-review-nhl.md`, `hockey-h4-h5-messung-02-10.md`)
zeigen übereinstimmend: Stürmer ordnen gut (0,735 je Spiel), Verteidiger und Torwart schlecht,
und die heutigen Wertposten haben eine Orakel-Decke um 0,73.

Für ein Überzahl-Konzept heißt das: es darf rho nicht kosten, und es kann rho nur dann stützen,
wenn es Ereignisse auf Spieler lenkt, deren Fähigkeit mit der Eignung zusammenhängt. Welche das
sind, lässt sich an den echten Kaderdaten direkt ablesen (110 verschiedene Spieler der
Kader-Familie, Sub-Skills aus dem echten Hockey-Rezept in `battle-mode.rezepte.js`):

| Sub-Skill | rho zur Hockey-Eignung | Rolle in der Überzahl / Unterzahl |
|---|---:|---|
| SCHUSS_NAH | **+0,87** | Netfront, Abstauber |
| ZWEITCHANCE | **+0,86** | Netfront, lose Pucks |
| ABSCHLUSS | **+0,83** | Direktschütze, Bumper |
| ABWEHR | **+0,83** | Unterzahl: Blocks, Checks |
| SCHUSS_FERN | +0,73 | Direktschütze am Bullypunkt, Point |
| PARADE | +0,70 | Torwart |
| AUSDAUER | +0,68 | — |
| AUFBAU | +0,54 | Quarterback |
| LAUFTEMPO | +0,50 | Unterzahl-Konter (Nebenweg) |
| TEAMGEIST | +0,33 | — |
| **TECHNIK** | **−0,08** | Strafneigung (K3) |

Zwei Folgerungen, die das ganze Papier tragen:

- Eine Überzahl-Einheit, die Netfront und Direktschuss über SCHUSS_NAH/ZWEITCHANCE/ABSCHLUSS
  besetzt und der Unterzahl Blocks über ABWEHR gibt, lenkt Ereignisse auf **eignungsnahe**
  Fähigkeiten. Sie kann rho nicht gefährden und stützt die Validität.
- Die Strafneigung hängt heute am sitzenden Check, also an **ABWEHR (+0,83)**: die guten
  Verteidiger nehmen die meisten Strafen. Solange eine Strafe nichts kostet, ist das egal. Sobald
  sie etwas kostet, bestraft es die Eignung. Über TECHNIK (−0,08) wäre sie eignungsneutral — und
  gibt nebenbei den kleinen Matrix-Attributen awareness/determination/dexterity (zusammen
  16 Matrixpunkte, im Rezept TECHNIK 46/31/23) einen Kanal, der keine Position verschiebt.

---

## 2. Recherche: was echtes Eishockey beim Zuschauen spannend macht

### 2.1 Die Überzahl ist eine Belagerung, keine Gleichzahl mit einem Mann mehr

| Befund | Zahl | Quelle |
|---|---|---|
| Schüsse aufs Tor in 5-gegen-4 | **1,81 je 2 Minuten** Überzahl (Ligamittel, Spanne 1,36–2,21), also rund **54 je 60 Minuten** | SCORE Network, NHL Power Play 2022-23 (Datensatz `NHL_PowerPlay2022.csv`, 32 Teams, eigene Mittelung) |
| Tore in 5-gegen-4 | **0,244 je 2 Minuten** (Spanne 0,16–0,43), rund **7,3 je 60 Minuten** | ebd. |
| Zum Vergleich 5-gegen-5 | rund 29 Schüsse und 2,6 Tore je 60 Minuten | **eigene Überschlagsrechnung** aus ~28 Schüssen und ~3,05 Toren je Team und Spiel abzüglich Überzahl/Leertor; keine abgerufene Ligastatistik |
| Daraus | Überzahl schießt rund **1,9-mal**, trifft rund **2,8-mal** so oft wie Gleichzahl | eigene Rechnung aus beiden Zeilen |
| Anteil der Unterzahl an den Schüssen in 5-gegen-4 | „The share of shots on goal taken by the penalty killing team on 5v4 penalties has increased from 14 percent in the 2015-16 season to nearly 19 percent in the 2018-19 season." | Meghan Hall, *Tracking Increasing Offense on the Penalty Kill* (RITSAC) |
| Überzahl-Quote | „The average conversion rate for power plays in the 2024-25 season was 21.6% … according to ESPN Research. That's the best rate since the 1985-86 season" | ESPN Research, laut Suchindex wiedergegeben auf newsio.com (Seite selbst lieferte 403, **nicht direkt geprüft**) |
| Überzahl-Gelegenheiten | „The 2.71 power-play chances per team per game in 2024-25 is the lowest average of any season since the stat was first tracked" | ebd. |
| Was eine Überzahl gefährlich macht | „High Quality Chances" (Home Plate, Royal-Road-Direktschüsse, Schirm, Ablenkung, Abpraller) treffen zu **7,22 %**, alle übrigen Versuche zu **0,76 %**; die 1-3-1 ist die häufigste Aufstellung | Hockey Graphs, *How Can We Quantify Power Play Performance In Formation?* (2016) |
| Wer in Überzahl scort | Überzahl-Spezialisten holen „40 or more percent of their point production" in Überzahl und spielen „60 percent or more of their team's total power play time" | Daily Faceoff, *Why Oilers' Ryan Nugent-Hopkins is NHL's No. 1 Power Play Specialist* |

**Lesart für uns:** In echtem Eishockey schießt die Unterzahl rund ein Viertel so oft wie die
Überzahl (19 % Anteil). Bei uns halb so oft (0,126 gegen 0,247, also 34 % Anteil). Und die Überzahl ist der Ort,
an dem die **Stars** ihre Punkte holen — sie konzentriert Ereignisse auf wenige, festgelegte
Spieler. Genau dieses Merkmal ist für unsere Rangtreue interessant (Abschnitt 5).

### 2.2 Die Regel, die Unterzahl überhaupt spielbar macht

- **Icing-Ausnahme:** „Icing is allowed when the puck is iced by a shorthanded team … icing during
  this time is an effective way for the shorthanded team to clear the puck from their zone."
  NHL-Regel 81.1 pfeift Icing nur, wenn eine Mannschaft „equal or superior in numerical strength"
  ist. (Wikipedia, *Icing (ice hockey)*; hockeyresponse.com, *NHL Icing Rule*)
- **Überzahltor beendet die kleine Strafe:** „A power play resulting from a minor penalty ends if
  the team with more players on the ice scores." (Wikipedia, *Short-handed*)

### 2.3 Torwart ziehen

- Bei einem Tor Rückstand ziehen NHL-Teams im Mittel bei **rund 1:35** Restzeit; „Among games
  with a one-goal deficit, the success rate has been around 15 percent for the past few seasons",
  bei zwei Toren Rückstand rund 1 %. Ins leere Tor fallen rund **19 Tore je 60 Minuten**, im
  6-gegen-5 umgekehrt rund 6,5. Modelle (MoneyPucks ThePullBot) empfehlen deutlich früheres
  Ziehen als die Praxis. (Hockey Graphs, *The State of Goalie Pulling in the NHL*, 2020)
- **Für uns:** T1 ist gebaut und zieht bei 10 % Restzeit (24 von 240 s ≈ 6 von 60 Minuten), also
  nach der Modell-Empfehlung, nicht nach der Praxis. Genau dieser Zielkonflikt (Analytik gegen
  Bauchgefühl) ist eine gute Manager-Entscheidung (K5).

### 2.4 Penaltyschuss, Verlängerung

- Penaltyschuss: „one out of every three shots — 32.12% of penalty shots — result in a goal",
  688 Versuche in vierzehn Saisons; vergeben z. B. für „a player on a breakaway who is fouled
  from behind". (Hockey Answered, *What is a penalty shot in hockey?*) Real also rund 50 je
  Saison bei 1312 Spielen — selten, aber jedes Mal ein Standbild.
- Verlängerung 3-gegen-3: seit 2015; „8.2% of games this season have been decided by a shootout,
  up slightly from 7.9% in the first four seasons with 3-on-3 overtime"; Trainer beschreiben den
  Wandel hin zu Puckbesitz: „going back, they're going back, they're going back, tire out the
  other team, try to score off the rush." (NBC Sports, *3-on-3 overtime in NHL has evolved over
  past 5 seasons*)

### 2.5 Schichten und Ermüdung

- „The break-even point on the percentage of shots for and against is around 40 seconds", ab rund
  70 s sind nur noch 40 % der Schüsse eigene (Japers' Rink, *Shifting focus to a focus on
  shifts*, 2019; dieselbe Richtung bei PensBurgh, *The Importance of Shift Length*, im
  26.09.-Review zitiert).
- **Für uns nicht übertragbar ohne Bank** — der Spieltag stellt sechs Spieler inklusive Torwart
  (`DISCS.hockey.size:6`). Die Puste als Schichtersatz ist gemessen rho-schädlich
  (`hockey-puste-kalibrierung-13-09.md` 4.2). Bleibt in Abschnitt 6 als Kaderfrage.

### 2.6 Strafen als Spielerwert

- Evolving-Hockeys GAR führt „Penalties Taken Goals Above Average/Replacement (inverted, per
  position)" und „Penalties Drawn" als eigene Komponenten. (Evolving-Hockey, *Goals Above
  Replacement*, Glossar) — der reale Grund für die Idee „Strafe in der Wertung buchen". Bei uns
  ist sie gemessen schädlich (4.3), weil ein einzelnes Spiel zu wenige Strafen enthält und
  die Strafneigung heute an der falschen Größe hängt.

---

## 3. Die Konzepte

Leitplanken für alles unten: Matrix unangetastet; kein neuer Sub-Skill; KI-Vorgaben
deterministisch aus dem Kader (Muster `berechneFokusAuto`), nie aus `eig` (sonst misst die Sonde
sich selbst); „Normal" bzw. ungesetzt verhält sich wie heute, wo immer möglich; jede Mechanik
hinter einem Feld in `FELDSPIEL_ART.hockey`, damit Basketball und Football bit-identisch bleiben.

### K1 — Befreiungsschlag: die Unterzahl klärt (Klasse B)

**Bild.** Strafe gegen Gast. Gewinnt die Unterzahl den Puck in der eigenen Hälfte, schießt sie ihn
über das ganze Eis in die Ecke der Überzahl-Mannschaft — Ticker „Gast befreit sich", ein dumpfer
Schlag im Ton. Die Überzahl holt ihn hinter dem eigenen Tor, fährt neu an, baut auf. Das ist das
Bild, das jeder Eishockeyzuschauer aus einer Überzahl kennt: Welle, Befreiung, Welle.

**Mechanik.** `entscheideBallaktion` hat seit T1 einen Klär-Zweig für den Führungs-Riegel
(`hockeyRiegelKlaert`). K1 ist eine zweite Auslösebedingung an derselben Stelle: Puckführer gehört
zur Unterzahl-Seite (`hockeyPPInfo().seite === 1 − u.side`) und steht in der eigenen Hälfte.
Anders als beim Riegel kein Pass zum offensten Mitspieler, sondern direkt der weite Schuss
(freier Puck tief in der gegnerischen Zone, über `haltePuckImFeld`). Kein neuer `rr()`. In der
gegnerischen Hälfte gilt die Sperre nicht — ein Unterzahl-Spieler, der den Puck dort erobert,
darf aufs Tor ziehen. Das ist der **Nebenweg**: der Unterzahl-Konter bleibt möglich, aber nur
für den, der vorne steht und schnell ist (LAUFTEMPO).

**Variante „flach"** (gemessen als Teil von V5): der Befreiungsschlag landet nur knapp hinter der
Mittellinie, die Überzahl muss kürzer neu aufbauen. Gemessen ist das die entscheidende
Stellschraube: V3 (tief) und V5 (flach) unterscheiden sich nur in „flach" und K4, und die
Überzahl-Rate springt von 0,221–0,223 auf 0,287–0,294 Versuche/s. K4 kann diesen Sprung nicht
erklären (es verkürzt Überzahl-Zeit nach Toren, es erzeugt keine Versuche). **Empfehlung: flach.**

**Gemessen:** Abschnitt 4.

**Frage an Chris:** reicht der Befreiungsschlag als Unterzahl-Verhalten, oder soll die Unterzahl
auch sichtbar eine Box (2-2) vor dem Tor bilden (T2 des 26.09.-Reviews)? Die Box verschiebt
Positionen ab der ersten Strafe und damit die Zufallsbahn — der Befreiungsschlag allein ist
der billigere, wirkungsgleiche erste Schritt.

### K2 — Die Überzahl-Einheit 1-3-1 (Klasse B + M)

**Bild.** Sobald die Überzahl in der Zone ist, stehen fünf Spieler auf fünf festen Plätzen: der
**Quarterback** an der Half-Wall verteilt, der **Direktschütze** am gegenüberliegenden
Bullypunkt wartet auf den Querpass (Royal Road), der **Bumper** im hohen Slot, die **Netfront**
vor dem Torwart, der **Point** an der blauen Linie. Ein Querpass, ein Direktschuss, ein
Abpraller — die Formation, die in der NHL heute Standard ist.

**Mechanik (Konzept).** Eine dritte Weiche in `zuordneSlots` neben voller Besetzung und
`UNTERZAHL_PLAETZE`: „Überzahl". Der sechste Platz der Hockey-Formation (hoher Slot, Index 5)
existiert schon und ist der Bumper. Die Belegung kommt **nicht** aus dem SCHUSS_NAH-Rang wie heute,
sondern aus einer Einheit:

| Platz | Primärweg (volle Wirkung) | Nebenweg | KI-Vorgabe (aus Sub-Skills) |
|---|---|---|---|
| Direktschütze | Querpass-Direktschuss (ABSCHLUSS, SCHUSS_FERN) | Abpraller | max(ABSCHLUSS + SCHUSS_FERN) |
| Netfront | Abstauber, Schirm (SCHUSS_NAH, ZWEITCHANCE) | Nachschuss | max(SCHUSS_NAH + ZWEITCHANCE) |
| Quarterback | erste Vorlage (AUFBAU) | Schuss von der Bande | max(AUFBAU) |
| Bumper | Schuss aus dem hohen Slot (ABSCHLUSS) | Weiterleitung | max(ABSCHLUSS) der übrigen |
| Point | Schlagschuss, Absicherung | — | der verbleibende |

Der Manager kann die Einheit im Spieltag setzen (M: ein neues Feld, fünf Plätze). Ungesetzt gilt
die KI-Vorgabe. Real ist die Überzahl-Einheit eine eigene Aufstellung (2.1, Daily Faceoff:
Spezialisten mit 60 % der Überzahl-Zeit). Kein neuer Würfel; der Schuss läuft über dieselbe
`hockeySchussAusgang`-Formel, nur der Standplatz (und damit die Distanzstufe) kommt aus der Rolle.

**Warum es zur Mehrwege-Leitlinie passt.** Ein Spieler ohne großen Schuss kann trotzdem auf den
wichtigsten Überzahl-Platz: als Quarterback (AUFBAU) oder an der Netfront (Körper, ZWEITCHANCE).
Jede Rolle hat einen Primär- und einen Nebenweg.

**Gemessen:** im Modell, Abschnitt 5. Im Motor nicht, weil eine Formation keine Ein-Zeilen-Änderung
ist.

### K3 — Härte je Spieler: Chris' Risiko-Knopf für Hockey (Klasse B + M)

**Bild.** In der Einsatzliste je Feldspieler: **Sauber / Normal / Hart.** Im Spiel: „Anweisung
greift: Draco geht hart rein" — Check, Puck erobert. Zwei Minuten später derselbe Spieler auf der
Strafbank, die Überzahl läuft, der Befreiungsschlag fliegt.

**Mechanik (Konzept).** Zwei Stellschrauben am bestehenden Bodycheck in `versucheSteal`, beide
ohne neuen Wurf, beide nur Schwellen:

1. **Grund-Strafneigung über TECHNIK** (Fable H-B): die Schwelle des vorhandenen Wurfs
   `rr() < HK_FOUL_ANTEIL` wird zu `HK_FOUL_ANTEIL × f(TECHNIK)`, im Prototyp
   `f = 1 + (53,5 − TECHNIK) × 0,02`, begrenzt auf 0,35–1,9. Die Mitte 53,5 ist so gewählt, dass
   die mittlere Strafzahl gleich bleibt (die Checkenden haben im Mittel TECHNIK ≈ 53). Hoher
   Wert: sauberer Check, selten gepfiffen. Niedriger Wert: Bandencheck.
2. **Härte als Haltung:** Hart verschiebt `wucht` nach oben **und** die Strafschwelle nach oben,
   Sauber beides nach unten. Normal ist exakt die Formel von heute plus Punkt 1.

**Designregeln aus dem Manager-Doc gelten:** kein Knopf ist immer besser (Hart lohnt nur mit
hoher TECHNIK, weil die Strafkosten sonst die Puckgewinne auffressen); KI-Vorgabe deterministisch
aus dem Kader (z. B. Hart, wenn TECHNIK ≥ 60 und ABWEHR über Teammittel).

**Warum erst mit K1:** ohne K1 kostet eine Strafe fast nichts, Hart wäre schlicht besser.

**Gemessen:** die Schwelle (Punkt 1) im Motor-Prototyp, Abschnitt 4. Die Haltung selbst nicht.

### K4 — Überzahltor beendet die Strafe (Klasse B, klein)

Echte Regel (2.2). Fällt das Überzahltor, kommt der früheste Sünder sofort zurück. Wirkung:
die Überzahl-Zeit nach einem Tor entfällt, die Überzahl-Tore je Strafe sinken minimal, und es gibt
einen zweiten sichtbaren Moment (der Sünder fährt aufs Eis). Im Motor: eine Zeile im Tor-Zweig
von `loeseHockeySchuss`, kein Wurf. Gemessen als Teil von V5 (Abschnitt 4).

### K5 — Torwart ziehen als Voreinstellung (Klasse B + M)

Die Mechanik läuft seit T1. Neu wäre nur, dass der Manager den Zeitpunkt wählt: **nie / spät
(≈ Praxis, 1:35 von 60 → rund 6 s bei uns) / früh (≈ Modell, heute 24 s)**. Genau die Frage,
die das 26.09.-Review an Chris gestellt hat und die bis heute offen ist. Kein neuer Würfel, nur
`endphase.tEndAnteil` je Seite. Das ist die billigste Manager-Entscheidung in Hockey überhaupt,
und sie trifft genau Chris' Satz: mehr Risiko (früh ziehen) kann ein Spiel drehen — oder mit
einem Leertor endgültig verlieren.

### K6 — Penaltyschuss (Klasse B + T)

Wird ein Spieler im Durchbruch (Fastbreak-Fenster, kein Verteidiger mehr vor ihm) gefoult, gibt es
statt der kleinen Strafe einen Penaltyschuss: Standbild, alle an die Bande, Schütze gegen Torwart.
Auflösung über einen einzigen Wurf (ABSCHLUSS/TECHNIK gegen PARADE, Zielquote ~32 %). Er wäre der
**einzige Moment, in dem der Torwart sichtbar allein entscheidet** — und der Torwart ist Hockeys
schwächste Rolle in der Rangtreue.

**Warum T:** die Uhr steht (wie real), die Sendung wird je Penaltyschuss um einige Sekunden
länger. Nach der Selbsteinstufungs-Lehre aus dem Gewichtheben-Papier (Fechten #1111, D7 #1117)
stufe ich nach oben ein: **T, Chris entscheidet.** Häufigkeit ungemessen — es braucht zuerst eine
Zählung, wie oft heute ein Foul einen Spieler im Fastbreak trifft (offene Frage 8.6).

### K7 — Verlängerung 3-gegen-3 und Penaltyschießen (Klasse T + C)

Fable H-A (`fable-ideen-feldspiel-30-09.md` Abschnitt 5) unverändert übernommen, hier nur mit den
NHL-Zahlen aus 2.4 ergänzt. Verlängert die Sendung (T) und schafft das Remis ab (C, Tabelle).
**Nicht zum Bau empfohlen ohne Chris' ausdrückliche Zustimmung.** Die Motor-Ausgabe kennt heute
„Schlusssirene — Unentschieden" (`engine.js` Feed nach `done`).

---

## 4. Experiment 1: Motor-Prototyp (Scratch-Kopie, nicht im Repo)

**Aufbau.** Kopie von `public/mockups/` (Stand `68563962`), dazu `scripts/lib/rangtreue-messung.mjs`
und die Kader-Familie. Eingebaut: (a) Zähler je Zustand ohne `rr()`, (b) Schalter, die nur
greifen, wenn `window.__HKP` sie vor dem Laden setzt — `pkKlaert` (K1), `pkFlach` (K1 flach),
`ppUhr` (Schussuhr ×2), `strafTechnik` (K3 Punkt 1), `ppTorEndet` (K4), `takeDraw` (Strafe in der
Wertformel). Gemessen über `window.__arena.disziplinProbe("hockey", {kaderFamilie, saat0})`,
Spearman wie `auswerten()`. Feldspieler-Zeile über `ohneTorwart()`. Paartreue = Anteil richtig
geordneter Paare mit mindestens 15 Eignungspunkten Abstand.

Je Zelle: Stamm 1337 / Stamm 4242, n=48 je Paarung (240 Spiele je Lauf).

| Variante | rho je Spiel alle 12 | rho je Spiel Feldspieler | Saison Feldspieler | Star Rang 1 | Paartreue ≥15 | Versuche/s Überzahl | Versuche/s Unterzahl | Überzahl-Tore je Strafe | Unterzahl-Tore je Strafe | Strafen/Spiel | Befreiungsschläge/Spiel |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **B** Basislinie (heute) | 0,614 / 0,649 | 0,692 / 0,705 | 0,804 / 0,882 | 57 % / 55 % | 90 % / 92 % | 0,247 / 0,248 | 0,126 / 0,126 | 17,1 % / 19,7 % | 7,7 % / 7,5 % | 7,6 / 7,8 | 0,0 / 0,0 |
| **V1** K1 tief | 0,647 / 0,625 | 0,686 / 0,684 | 0,845 / 0,783 | 51 % / 55 % | 90 % / 91 % | 0,217 / 0,223 | 0,074 / 0,067 | 16,4 % / 18,1 % | 6,9 % / 5,4 % | 7,0 / 7,3 | 5,7 / 5,8 |
| **V3** K1 tief + K3 (Strafneigung TECHNIK) | 0,662 / 0,631 | 0,723 / 0,705 | 0,881 / 0,864 | 52 % / 59 % | 91 % / 91 % | 0,221 / 0,223 | 0,069 / 0,067 | 17,3 % / 18,3 % | 6,1 % / 6,1 % | 7,5 / 7,2 | 5,9 / 5,8 |
| **V4** V3 + Strafe in der Wertformel (0,6) | 0,654 / 0,632 | 0,721 / 0,696 | 0,881 / 0,867 | 51 % / 58 % | 90 % / 90 % | 0,221 / 0,223 | 0,069 / 0,067 | 17,3 % / 18,3 % | 6,1 % / 6,1 % | 7,5 / 7,2 | 5,9 / 5,8 |
| **V5** K1 flach + K3 + K4 | 0,679 / 0,641 | 0,701 / 0,691 | 0,839 / 0,839 | 56 % / 58 % | 92 % / 91 % | 0,287 / 0,294 | 0,063 / 0,059 | 19,2 % / 22,1 % | 4,6 % / 4,0 % | 7,9 / 7,4 | 7,0 / 6,8 |

Kaderrauschen (Spannweite der Feldspieler-Zeile über die fünf Paarungen) in diesen Läufen:
0,13 bis 0,22. Eine Bewegung kleiner als das ist nach `messgrundlage-kaderfest.md` von Null nicht
unterscheidbar.

Dazu der n=24-Vorlauf (Stamm 4242, gleiche Bauart): **Schussuhr ×2 in Überzahl (`ppUhr`) ist
gegenüber V1 in jeder Ziffer identisch** — rho, Versuche, Tore, Strafen. Deshalb taucht sie oben
nicht mehr auf (1.2).

**Lesart.**

1. **Der tiefe Befreiungsschlag allein (V1) tut, was er soll, bringt netto aber wenig.** Die
   Unterzahl-Rate fällt um 41–47 % (0,126 → 0,067–0,074), aber die Überzahl verliert mit jedem
   Befreiungsschlag Zeit (0,247 → 0,217–0,223). Netto-Torwert einer Strafe (Überzahl- minus
   Unterzahl-Tore je Strafe): Basislinie 9,4 / 12,2 Prozentpunkte, V1 9,5 / 12,7 — praktisch
   unverändert. Eine Strafe kostet mit V1 also kaum mehr als heute.
2. **Erst V5 macht die Strafe teuer — und zwar NHL-nah.** Flacher Befreiungsschlag, Strafneigung
   über TECHNIK, Überzahltor beendet die Strafe:

   | Größe | Basislinie | **V5** | NHL |
   |---|---|---|---|
   | Überzahl gegen Gleichzahl (Versuche/s) | 1,3× | **1,5×** (0,287–0,294 gegen 0,19) | ~1,9× |
   | Unterzahl-Anteil an den Versuchen in Überzahl | 34 % | **17–18 %** | 19 % |
   | Überzahl-Tore je Strafe | 17,1 / 19,7 % | **19,2 / 22,1 %** | 21,6 % |
   | Unterzahl-Tore je Strafe | 7,7 / 7,5 % | **4,6 / 4,0 %** | ~2–3 % |
   | Netto-Torwert je Strafe | 9,4 / 12,2 Pp. | **14,6 / 18,1 Pp.** (+55 % / +48 %) | ~19 Pp. |
   | Befreiungsschläge je Spiel | 0 | **6,8–7,0** | — |

   Die Strafe kostet jetzt rund anderthalbmal so viel wie heute, die Unterzahl spielt wie eine
   Unterzahl, und die Überzahl-Quote landet von selbst beim realen Wert, ohne dass eine Tor- oder
   Fangquote angefasst wurde. **Das ist die Antwort auf die Vorfrage des Manager-Docs**: mit V5
   „kostet Überzahl wirklich", und K3/H-B hat einen Sinn.
3. **rho bleibt im Rauschen, mit keinem Hinweis auf Schaden.** Feldspieler je Spiel: Basislinie
   0,692 / 0,705, V5 0,701 / 0,691, V3 0,723 / 0,705. Alle Bewegungen (−0,021 bis +0,031) liegen
   weit unter der Kader-Spannweite, und die Vorzeichen sind zwischen den Stämmen nicht einheitlich
   — genau das Bild eines rho-neutralen Eingriffs. Die Zwölferzahl schwankt stärker (0,614–0,679),
   weil die zwei Torwart-Zeilen darin das meiste Rauschen tragen (`stand-aller-disziplinen.md` 1a).
   Star auf Rang 1 51–59 %, Paartreue bei ≥15 Punkten Abstand 90–92 % in jeder Variante.
4. **K3 (Strafneigung über TECHNIK) verschiebt die Strafen wie gewollt:** der mittlere TECHNIK-Wert
   der Bestraften fällt von 53,3–53,5 auf 46,7–47,3, die Strafzahl bleibt mit der Mitte 53,5 im
   Korridor (7,2–7,9 gegen 7,6–7,8 je Spiel).
5. **Die Unterzahl trifft mit K1 je Versuch besser** (0,092–0,095 → 0,114–0,138): ihr bleiben fast
   nur noch Konter aus der gegnerischen Hälfte, also gute Chancen. Das ist realistisch — echte
   Unterzahl-Tore fallen fast immer aus dem Durchbruch — und es ist der Nebenweg aus K1.
6. **Strafen in der Wertformel (V4) sind ein sauberer Paarvergleich gegen V3** — dieselben
   Ereignisse, nur die Wertung anders — und rho sinkt in allen drei Vergleichen dieser Runde
   (n=48: −0,002 / −0,009; n=24-Vorlauf: −0,033). Klein, aber nie positiv. Begründung: in einem
   Spiel nimmt ein Spieler 0 oder 1 Strafe, das ist ein Münzwurf mit ±0,6 Wertpunkten, der mit
   der Eignung nichts zu tun hat. **Nicht bauen**, auch wenn die echte GAR-Rechnung es tut — die
   rechnet über eine Saison.

**Technischer Nebenbefund.** Im n=24-Vorlauf starben 3 von 10 Läufen mit „Target page, context or
browser has been closed" — dieselbe Meldung wie beim bekannten Hockey-Chromium-Leck aus
`stand-aller-disziplinen.md` (Hockey/TDM, „ihr Leck sitzt an anderer Stelle"). Alle drei waren
Prototyp-Läufe, und sie fielen in eine Phase, in der ein zweiter Browser parallel lief; ein
einzelner Wiederholungslauf derselben Variante lief sauber, der n=48-Durchgang (10 Läufe, mit
automatischer Wiederholung) brauchte keine einzige Wiederholung. Ich halte das für Speicherdruck,
nicht für einen Prototyp-Fehler, ausschließen kann ich es nicht. Für die Pp-Pflicht (Abschnitt 7)
bleibt das Leck ein echtes Hindernis: die Pp-Sonde läuft deutlich länger als diese rho-Sonde.

---

## 5. Experiment 2: Ereignismodell für die Überzahl-Einheit (K2)

**Warum ein Modell:** eine Formation lässt sich in der Motor-Kopie nicht mit einer Zeile
nachbauen. Das Modell beantwortet nur die Richtungsfrage: **schadet es der Rangtreue, wenn
Überzahl-Schüsse auf feste Rollenplätze konzentriert werden — oder hilft es?**

**Aufbau.** Echte Kader (fünf Paarungen, je Spiel sechs zufällig, Torwart = bester PARADE),
Sub-Skills aus dem echten Rezept plus Form-Rauschen je Spiel. Schüsse als Poisson-Strom mit den
Motor-Raten; Schütze in Gleichzahl softmax-gewichtet nach ABSCHLUSS+SCHUSS_NAH, Standplatz nach
SCHUSS_NAH-Rang (wie `zuordneSlots`); Block über ABWEHR, `HK_VORBEI` 0,11, Torquote nach
Distanzstufe × ABSCHLUSS × Torwart; A1/A2 nach AUFBAU; Wertformel wie `feldspielWert` (1,5 Tor +
1,5 xG + 2 A1 + 1,5 A2 + 0,2 Puckgewinn + 0,3 Schuss + 0,5 Block). Kalibriert: rho je Spiel der
Basislinie 0,68 (Motor-Feldspieler 0,69–0,71 bei n=48), 10–11 Tore je Spiel. Überzahl-Einheit: Schussanteile
Direktschütze 34 %, Netfront 24 %, Bumper 17 %, Quarterback 12 %, Point 13 %; der Quarterback
bekommt die Hälfte der A1; die Box blockt +4 Punkte häufiger. 300 Spiele je Paarung, zwei
Saatstämme, mit den im Motor gemessenen K1-Raten (Überzahl 0,225, Unterzahl 0,065 Versuche/s).

| Variante | rho je Spiel (Stamm 1 / 2) | Saison (1 / 2) | Tore/Spiel |
|---|---|---|---|
| T0 heute (Überzahl 0,244 / Unterzahl 0,128, Schütze wie 5-gegen-5) | 0,682 / 0,684 | 0,914 / 0,918 | 10,6 / 10,8 |
| T1 nur K1-Raten | 0,670 / 0,678 | 0,913 / 0,918 | 10,1 |
| **T2 K1-Raten + Überzahl-Einheit (KI-Vorgabe)** | **0,676 / 0,680** | **0,933 / 0,916** | 9,9 |
| T2z dieselbe Einheit, **zufällig besetzt** | 0,666 / 0,654 | 0,919 / 0,897 | 9,8 |
| T4 T2 + Strafe kostet 0,6 (heutige Strafneigung über ABWEHR) | 0,667 / 0,674 | 0,929 / 0,918 | 9,9 |
| T5 T2 + Strafneigung TECHNIK + Strafe kostet 0,6 | 0,670 / 0,675 | 0,936 / 0,920 | 9,9 |

Mit der Überzahl-Rate 0,36 statt 0,225 (also einer Überzahl, die real doppelt so oft schießt)
sieht das Bild gleich aus: T2 0,689 / 0,680 gegen T0 0,682 / 0,684, T2z 0,663 / 0,661.

**Lesart.**

- **Die Überzahl-Einheit ist rho-neutral** (±0,01 um die Basislinie, im Rauschen). Sie ist kein
  rho-Hebel, sie ist ein Spannungs- und Entscheidungshebel, der nichts kostet.
- **Die Besetzung zählt:** dieselbe Einheit zufällig besetzt liegt 0,010–0,026 rho und ein
  Zehntel Tor je Spiel unter der rollenrichtigen. Ein Manager, der den falschen Mann auf den
  Direktschuss stellt, sieht das am Ergebnis. Das ist der „gewisse Impact" aus Chris' Satz.
- **„Strafe kostet Wertpunkte" ist im Modell leicht negativ** (−0,006 bis −0,009), mit
  TECHNIK-Strafneigung etwas weniger. Deckt sich mit dem Motor-Paarvergleich (4).
- **Grenzen:** keine Bewegung, keine Zufallskaskade, keine Slot-/Trait-Zuschläge. Die Saison-
  Validität des Modells (0,91) liegt über der des Motors (0,78–0,86) — das Modell ist zu sauber.
  Richtungen, keine Abnahmezahlen.

---

## 6. rho: was dieses Konzept löst und was nicht

**Ehrlich:** nichts in K1–K7 hebt Hockey über 0,80. Das ist auch nicht ihr Zweck. Die
Überzahl-Konzepte sind so gebaut, dass sie die Rangtreue **nicht kosten** (gemessen: K1/K3/K4 im
Motor im Kaderrauschen, K2 im Modell neutral), und sie verschieben die Ereignisse eher zu
eignungsnahen Fähigkeiten (Tabelle 1.3).

Die Hockey-Rangtreue hängt an drei Dingen, die frühere Runden sauber benannt haben: der Torwart
(Signal je Spiel ~1 %), die Orakel-Decke der heutigen Wertposten (~0,73) und das Fehlen
individueller Eiszeit — alle fünf Feldspieler stehen 100 % auf dem Eis, jede On-Ice-Größe ist eine
Mannschaftskonstante (`hockey-opus-review-nhl.md` H3). **Der einzige große strukturelle Hebel ist
eine zweite Reihe** (Spieltag mit acht statt sechs Spielern, Schichtwechsel nach festem Plan aus
der Aufstellungsreihenfolge, kein Würfel). Das 26.09.-Review hat ihn zu Recht als „nicht baubar
ohne Kaderentscheidung" markiert: er ändert Spieltagsgröße, Fatigue-Verbrauch und
Kaderökonomie für das ganze Spiel. Klasse **M + C**, möglicherweise T. Hier nur benannt, als
offene Frage 8.1.

**Ein Gedanke um die Ecke dazu:** die Überzahl-Einheit (K2) ist die einzige Stelle, an der
Hockey **ohne Bank** schon heute eine Art individuelle Eiszeit bekommt — wer in der Einheit steht,
bekommt in ~20 % der Spielzeit die guten Schüsse. Wenn Chris die Bank nicht will, ist K2 der
nächstbeste Ersatz für „der Star spielt mehr". Das Modell zeigt dafür nur eine leichte
Saison-Wirkung (+0,02 in einem Stamm), aber keine Verschlechterung.

---

## 7. Pp-Pflicht und Risiko

- **Pp heute:** 39,4 (n=6), VERLETZT — und bei n≥12 wegen des Chromium-Lecks nicht messbar
  (`stand-aller-disziplinen.md`, `hockey-h4-h5-messung-02-10.md`). **Vor dem Bau irgendeiner
  B-Klasse-Mechanik in Hockey muss das Leck behoben sein**, sonst ist die Pflichtprüfung
  (zwei Saatstämme, ≤ 25) nicht zu erbringen. Das ist die größte Bauvoraussetzung dieses Papiers.
- **Erwartete Pp-Richtung:** K3 gibt TECHNIK (awareness 46 / determination 31 / dexterity 23)
  einen Kanal, der keine Position verschiebt — die drei Attribute mit zusammen 16 Matrixpunkten,
  die in einem power-/health-getriebenen Spiel untergehen. K2 gibt SCHUSS_FERN (power/awareness/
  speed) und AUFBAU (stamina/speed) einen gezielten Überzahl-Kanal. K1 belohnt indirekt ABWEHR
  (Puckgewinn in der eigenen Hälfte vor dem Befreiungsschlag) und LAUFTEMPO (Unterzahl-Konter
  als Nebenweg). Alle drei eher Pp-senkend; gemessen ist das nicht.
- **rho-Risiko je Konzept:** K1/K4 gering (seltener Zustand, ~20 % der Spielzeit, wenige
  Ereignisse), K3 gering (Schwelle statt Wurf), K2 gering bis mittel (Positionen ab der ersten
  Strafe, Zufallsbahn; Abnahme mit n=24 **und** n=48, Vorzeichen gleich, im Zweifel n=96 —
  Zoneneintritt-Lehre), K5 sehr gering (Mechanik live), K6 sehr gering (selten), K7 gering, aber T.
- **Abnahme für jeden B-Schritt:** `miss-alle-disziplinen.mjs 24 hockey` und n=48; Feldspieler-
  Zeile und Star-Kennzahlen; Pp ≤ 25 in zwei Saatstämmen; Special-Teams-Korridor (die Zähler
  dieser Sonde als `scripts/miss-hockey-special-teams.mjs` ins Repo, sobald ein Bau-PR sie
  braucht); `HK_TW_BASIS`/`HK_TW_REF` nachziehen, falls Tor- oder Fangquote wandern; Basketball
  und Football bit-identisch.

---

## 8. Offene Fragen und Entscheidungen für Chris

1. **Bank / zweite Reihe:** soll ein Hockey-Spieltag irgendwann mehr als sechs Spieler stellen?
   Das ist der einzige große rho-Hebel und eine Kaderfrage fürs ganze Spiel (Abschnitt 6).
2. **K1 Befreiungsschlag:** als erster Hockey-Schritt freigeben, zusammen mit K3-Strafneigung und
   K4 (= V5)? Empfehlung: **flach** — tief ist zwar die wörtliche Regel 81.1, kostet aber die
   Überzahl so viel Zeit, dass die Strafe netto kaum teurer wird (4, Lesart 1). Im Bild bleibt es
   ein Befreiungsschlag aus der Zone.
3. **K2 Überzahl-Einheit:** eigene Aufstellung im Spieltag (fünf Plätze, realistischer, ein
   UI-Schritt mehr) oder aus den Rollen abgeleitet (kein UI)?
4. **K3 Härte:** willst du den Risiko-Knopf für Hockey als „Sauber / Normal / Hart" je Spieler?
   Dann zuerst klären, ob er dieselbe Achse ist wie „Haltung" im Manager-Doc (Absichern / Normal /
   Angreifen) — Empfehlung: ja, dieselbe Achse, Hockey beschriftet sie nur anders.
5. **K5 Torwart ziehen:** nie / spät / früh als Manager-Voreinstellung? (Seit 26.09. offen.)
6. **K6 Penaltyschuss und K7 Verlängerung:** beide verlängern die Sendung (T), K7 schafft das
   Remis ab (C). Willst du eins davon überhaupt? Wenn ja: zuerst zählen, wie oft heute ein Foul
   einen durchbrechenden Spieler trifft, und wie oft Spiele remis enden.
7. **Score Effects:** die „führende Mannschaft schießt mehr"-Zahl ist durch die Teamstärke verzerrt
   (1.1). Soll eine Sonde das sauber messen (dieselbe Mannschaft, verschiedene Spielstände),
   bevor jemand ein Spielstand-Verhalten baut?

---

## 9. Was ich NICHT geprüft habe

- **K2, K5, K6, K7 nicht im Motor.** K2 nur im Modell, die anderen gar nicht gemessen.
- **Keine Pp-Messung** irgendeiner Variante (Leck, Abschnitt 7).
- **Keine Sichtprüfung:** wie der Befreiungsschlag im Bild aussieht (Puckflug über die ganze
  Eisfläche), habe ich nicht angesehen. Die Prototyp-Zeile setzt nur einen freien Puck; ein
  echter Bau braucht die Flugbahn wie beim Pass.
- **Die 5-gegen-5-NHL-Vergleichswerte** (29 Schüsse, 2,6 Tore je 60) sind eigene Überschläge,
  keine abgerufene Ligastatistik; die 5-gegen-4-Zahlen sind aus dem SCORE-Datensatz selbst
  gemittelt (2022-23).
- **Das ESPN-Zitat** (21,6 %, 2,71) konnte ich nur über den Suchindex lesen, die Fundstelle
  lieferte 403.
- **Die Härte-Haltung selbst** (K3 Punkt 2) ist nicht gemessen, nur die Strafschwelle (Punkt 1).

---

## Quellen

- [SCORE Network — NHL Team Power Play Performance in 2022-2023](https://data.scorenetwork.org/hockey/nhl_powerplay.html) (Datensatz `NHL_PowerPlay2022.csv`, eigene Mittelung über 32 Teams)
- [Meghan Hall — Tracking Increasing Offense on the Penalty Kill (RITSAC)](https://meghan.rbind.io/talk/ritsac/)
- [Hockey Graphs — How Can We Quantify Power Play Performance In Formation?](https://hockey-graphs.com/2016/04/25/how-can-we-quantify-power-play-performance-in-formation/)
- [Hockey Graphs — ZEFR Rate: A New and Better Way to Evaluate Power Plays](https://hockey-graphs.com/2016/04/18/zefr-rate-a-new-and-better-way-to-evaluate-power-plays/)
- [Daily Faceoff — Why Oilers' Ryan Nugent-Hopkins is NHL's No. 1 Power Play Specialist](https://www.dailyfaceoff.com/news/why-oilers-ryan-nugent-hopkins-is-nhls-no-1-power-play-specialist)
- ESPN Research zu Überzahl-Quote 2024-25, laut Suchindex wiedergegeben auf [newsio.com](https://newsio.com/?p=172319) (403, nicht direkt geprüft)
- [Wikipedia — Icing (ice hockey)](https://en.wikipedia.org/wiki/Icing_(ice_hockey))
- [hockeyresponse.com — NHL Icing Rule](https://hockeyresponse.com/nhl-icing-rule/)
- [Wikipedia — Short-handed](https://en.wikipedia.org/wiki/Short-handed)
- [Hockey Graphs — The State of Goalie Pulling in the NHL (2020)](https://hockey-graphs.com/2020/05/18/the-state-of-goalie-pulling-in-the-nhl/)
- [Hockey Answered — What is a penalty shot in hockey?](https://hockeyanswered.com/what-is-a-penalty-shot-in-hockey/)
- [NBC Sports — 3-on-3 overtime in NHL has evolved over past 5 seasons](https://www.nbcsports.com/nhl/news/3-on-3-overtime-in-nhl-has-evolved-over-past-5-seasons)
- [Japers' Rink — Shifting focus to a focus on shifts (2019)](https://www.japersrink.com/shifting-focus-to-a-focus-on-shifts-02-16-2019/)
- [Evolving-Hockey — Goals Above Replacement (Glossar)](https://evolving-hockey.com/glossary/goals-above-replacement/)
- Projektintern: `CLAUDE.md`; `docs/design/manager-risiko-interaktivitaet-konzept-02-10.md`;
  `hockey-opus-review-nhl.md`; `hockey-h4-h5-messung-02-10.md`; `fable-ideen-feldspiel-30-09.md`
  (H-A, H-B, H-C); `hockey-puste-kalibrierung-13-09.md`; `stand-aller-disziplinen.md`;
  `gewichtheben-sandsack-rennen-opus-konzept-03-10.md` (Selbsteinstufung Klasse T); das
  Hockey-Konzeptreview vom 26.09. (Commit `014d0bd6`, Datei liegt nicht mehr auf `main`).

**Klassen in diesem Papier** (die Buchstaben werden im Repo uneinheitlich benutzt, deshalb
ausdrücklich): **A** reine Anzeige; **A\*** Anzeige mit kleiner Buchhaltung; **B** echte Mechanik
innerhalb der Sendung, braucht Chris' Ja und die volle rho-/Pp-Abnahme (Sprachgebrauch
Manager-Doc 02.10.); **C** berührt Wertung/Tabelle; **M** neues Eingabefeld im Manager-Modus
(Spieltag, Übergabe an den Motor) oder Kaderstruktur; **T** Sendezeit/Spielablauf — **nur Chris
persönlich entscheidet**. Wenn Chris eine Einstufung anders sieht, gilt seine.
