# Opus-Plan: Football-Gameplay — Wurzel gefunden, Prototyp gemessen (10.09.2026)

Auftrag von Chris, woertlich (10.09.): „und bitte football gameplay fixen dass es sinn ergibt und
smooth läuft wie in der NFL bzw den NFL spielen".

Ausgangslage aus dem Fertigstellungs-Audit
(`docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`, Abschnitt „Football"):
Konzept 90 % / Assets 75 % / Movement 85 % — **Gameplay 35 %**, rho **0,516**. Die groesste
Einzel-Schere im Projekt. Drei Kalibrierrunden haben zusammen ca. +0,17 gebracht.

**Dieses Dokument ist ein Plan, kein Umbau.** Der Motor im Repo ist unveraendert
(`git checkout` nach jedem Messlauf, Endstand geprueft). Alle Zahlen unten sind an einem
**Wegwerf-Prototypen** gemessen, der nach der Messung verworfen wurde — sie sind Beleg fuer den
Vorschlag, nicht sein Ergebnis.

---

## 0. Ergebnis vorab — die Wurzel ist gefunden und der Ausweg ist gemessen

**Die Wurzel ist NICHT das Rezept, an dem drei Runden gearbeitet haben.** Football hat als
einzige Disziplin im Feld eine hohe SAISON-Validitaet und eine niedrige EINZELSPIEL-Zahl:

| | rho je Spiel | rho Saison | Verlaesslichkeit (abgeleitet) |
|---|---:|---:|---:|
| Basketball | 0,769 | 0,923 | 0,69 |
| Hockey | 0,669 | 0,832 | 0,65 |
| **Football (Ist)** | **0,516** | **0,811** | **0,41** |

Die Verlaesslichkeit ist aus CLAUDE.mds eigener Formel zurueckgerechnet
(`rho(Spiel) = rho(Saison) x Wurzel(Verlaesslichkeit)`). Und CLAUDE.md sagt selbst, wie diese
zwei Spalten zu lesen sind: *„Ist die Saisonzahl hoch und die Einzelspielzahl niedrig, belohnt
die Mechanik das Richtige, aber zu laut — dann fehlen EREIGNISSE, nicht Rezepte."*

Football ist der Lehrbuchfall dieses Satzes, und keine der drei Runden hat ihn so gelesen — die
letzte (`football-rezept-kalibrierung.md` Abschnitt 6) mass die Saisonzahl noch bei 0,692 und
schloss auf „vermutlich BEIDES". Inzwischen steht sie bei 0,811 (frisch gemessen, s. u.); die
Diagnose hat sich unter der Hand veraendert und wurde nie neu gestellt.

**Der Prototyp, kaderfest gemessen** (`node scripts/miss-alle-disziplinen.mjs 24 football`,
fuenf echte Kader-Paarungen aus dem live-save-Abbild):

| Variante | rho je Spiel | Spannweite | rho Saison | Spannweite |
|---|---:|---:|---:|---:|
| **Ist-Stand** (`main`, c56fffd7) | **0,516** | 0,172 | 0,811 | 0,168 |
| nur Lotterie κ=2 | 0,687 | 0,069 | 0,804 | 0,182 |
| **nur Lotterie κ=3** | **0,714** | 0,169 | 0,804 | 0,308 |
| nur Lotterie κ=4 | 0,688 | 0,214 | 0,783 | 0,343 |
| κ=3 + Rezept-Variante B (verworfen, s. 5.3) | 0,629 | 0,188 | 0,692 | 0,189 |
| **κ=3 + Rezept C** | **0,775** | 0,091 | 0,902 | 0,112 |
| κ=3 + C + Tackle-Zeile 0,35 | 0,772 | 0,084 | 0,839 | 0,147 |
| κ=3 + C + Tackle-Zeile 0,20 | 0,792 | 0,062 | 0,860 | 0,077 |
| **κ=3 + C + Tackle-Zeile 0,15** | **0,800** | **0,054** | 0,867 | 0,077 |
| κ=3 + C + Tackle-Zeile 0,12 | 0,794 | 0,055 | 0,881 | 0,105 |
| **dieselbe Fassung, n=48** | **0,800** | 0,082 | 0,902 | 0,098 |

**+0,284 gegenueber dem Ist-Stand, und die Kader-Spannweite faellt von 0,172 auf 0,054** — das
ist mehr als das Dreifache der Bewegung aller drei bisherigen Runden zusammen, und zum ersten Mal
in Footballs Geschichte liegt der Zuwachs um ein Vielfaches ueber dem Kaderrauschen (die Regel aus
`docs/design/messgrundlage-kaderfest.md`, an der die letzte Runde ausdruecklich gescheitert ist).
Die drei Punkte um das Optimum (0,12 / 0,15 / 0,20 -> 0,794 / 0,800 / 0,792) bilden ein flaches
Plateau, kein Nadeloehr — und n=48 bestaetigt 0,800 ziffernidentisch.

**Basketball und Hockey blieben in derselben Messung bit-identisch** (0,769 / 0,105 / 0,923 /
0,224 bzw. 0,669 / 0,181 / 0,832 / 0,259) — s. Abschnitt 7.

**Aber: die Zahl allein ist nicht der Auftrag.** Chris hat „ergibt Sinn und laeuft smooth" vor
die Rangtreue gestellt, und der Prototyp verschiebt den NFL-Korridor spuerbar (Completion-Quote
76,5 % gegen Ziel 65,3 %, Punts 1,9 statt ~4 je Team). Abschnitt 6 sagt, warum das so ist, dass
es kein Zufall ist und wie es in derselben Runde mitgeraeumt wird. Abschnitt 9 sagt ehrlich, was
in einer ersten Runde geht und was nicht.

---

## 1. Was der Football-Motor heute tatsaechlich tut

Alles in `public/mockups/battle-mode.engine.js`; Zeilennummern gegen c56fffd7.

**Serie und Uhr.** `beginneFootballSerie()` (:7128) setzt `{side,down:1,toGo,spot,max:4}`.
`spot` = Yards bis zur gegnerischen Torlinie, Startwert 75 (eigene 25). `starteSnap()` (:7061)
waehlt Spielzug + Offense-/Defense-Formation, stellt beide Sechser **sofort** an die Line of
Scrimmage (kein Hinlaufen, bewusst, s. Kommentar dort) und laeuft dann durch `stepSnapPhase()`
(:7101) in drei Stufen: `formation` 0,9 s -> `zug` 0,8-1,6 s -> `nach` 0,6 s. Vier Viertel a
70 s ergeben so **gemessen ~50 Snaps je Team** (NFL: 63).

**Spielzugwahl.** `waehlePlayCall(down,toGo)` (:6607) waehlt Lauf/screen/kurz/mittel/tief; der
Laufanteil haengt an Down und Distanz (echte NFL-Quoten zitiert). `waehleVierterVersuch(spot,toGo)`
(:6631) entscheidet Field Goal (`spot<=38`), Go-For-It (`toGo<=1 && spot<85`) oder Punt.

**Aufloesung.** `resolveLauf()` (:6650): Fumble-Wurf, dann
`meanYds = clamp(3,6 + (LAUFKRAFT − ABWEHR_LAUF)·0,055, −3..11)` plus **gleichverteiltes
Rauschen ±4,5 Yards**. `resolvePass()` (:6703): erst Sack (`pSack` aus ABWEHR_PASS − PASSSCHUTZ),
dann Tiefe (`waehleFootballTier`), dann Interception, dann Completion ueber Footballs eigene
`kurve` (`steilerMake(lageBasisFuer, skillTeilFuer)`), Yards aus `FK_TIER_YARDS` (:6697) plus ein
winziger YAC-Term `(receiver.LAUFKRAFT−50)·0,06`. `resolveFieldgoal()` (:6763) ist reine Distanz,
kein Spielerattribut. `resolvePunt()` (:6772) ist eine **Konstante** (40 Yards netto, immer).

**Wer den Ball anfasst.** Fuenf Lotterien je Snap, alle ueber `gewichtetesLos()` (:4668):
Rusher (LAUFKRAFT), Run-Stopper (ABWEHR_LAUF), Passer (PASSGENAUIGKEIT), Pass-Rusher
(ABWEHR_PASS), Receiver (TEAMGEIST).

**Buchung.** `vollziehFootballErgebnis()` (:6961) schreibt Yards/Punkte/Turnover an die Einheit,
`footballDownWeiter()` (:6935) rechnet Down/Distance/Spot fort und wechselt bei Touchdown oder
4. Down den Ballbesitz. `feldspielWert()` (:6255) fasst das im Fantasy-Football-Schema zum
Impact zusammen — das ist zugleich die Zahl, gegen die die Rangtreue misst.

---

## 2. Die Wurzel, Teil 1: die Lotterie ist flach — Football spielt mit dem falschen Wuerfel

`gewichtetesLos()` (:4668) waehlt **linear proportional zum Sub-Skill**:

```js
const summe=spieler.reduce((s,x)=>s+Math.max(1,x[rolle]),0);   // 70 gegen 40 = 64 : 36
```

Basketball benutzt seit dem NBA2K-Eingriff etwas ganz anderes — `losGewicht()` (:4701) mit
Nullpunkt 20 und Exponent **κ=3** (:4699-4700):

```js
const losGewicht=(wert,kappa)=>Math.pow(Math.max(1,wert-LOS_NULLPUNKT), kappa);
// 70 gegen 40 -> 50^3 : 20^3 = 94 : 6   statt   64 : 36
```

Und der Kommentar direkt darueber (:4695-4698) sagt woertlich, warum Football sie nie bekommen
hat: *„gewichtetesLos() SELBST bleibt bewusst unangetastet ... sie zu aendern wuerde
ausschliesslich Football/Hockey/Tennis verschieben, die in dieser Runde nicht angefasst werden."*
Das war fuer die Basketball-Runde richtig — und ist seither nie nachgeholt worden.

**Warum das bei Football besonders weh tut.** Ein Feldspieler hat in einem Football-Spiel rund
**12 Ballberuehrungen** (25 Passversuche mit je zwei Beteiligten plus 25 Laufversuche, verteilt
auf sechs Offensivspieler) — Basketball hat ~100 Ballwechsel. Bei so wenigen Ereignissen ist die
**Volumendifferenz** zwischen dem Besten und dem Schlechtesten der einzige Kanal, ueber den sich
eine Rangfolge in einem einzelnen Spiel ueberhaupt herausbilden kann. Eine flache Lotterie
verschenkt genau diesen Kanal: gemessen korrelierte die groesste Box-Score-Position (Fangyards,
32,9 % des Impacts) nur mit **rho 0,323** zur Eignung, obwohl das Los, das sie vergibt
(TEAMGEIST), mit **rho 0,807** zur Eignung korreliert. Die Auswahl WEISS, wer besser ist — sie
handelt nur nicht danach.

**Gemessen** (nur diese eine Zeile geaendert, Rezept unberuehrt): rho je Spiel **0,516 -> 0,714**,
Saison unveraendert 0,811 -> 0,804. Genau das Profil, das die Diagnose vorhersagt: die Validitaet
steht still, die Verlaesslichkeit springt (0,41 -> 0,79). κ=3 schlaegt κ=2 und κ=4 (0,687 / 0,714
/ 0,688) — dasselbe Optimum, das Basketball gemessen hat.

---

## 3. Die Wurzel, Teil 2: zwei der neun Sub-Skills sind Kopien, und der QB-Kanal misst nichts

Das Rezept im Motor (:4472) ist **nicht** das, was `football-rezept-kalibrierung.md` beschreibt —
das Dokument ist seit PR #796/#803 veraltet. Der tatsaechliche Stand:

```js
PASSGENAUIGKEIT: {determination:71,dexterity:29},
LAUFKRAFT:       {power:41,health:33,speed:26},
PASSSCHUTZ:      {power:40,health:40,awareness:20},
ABWEHR_PASS:     {speed:40,awareness:30,torment:30},
ABWEHR_LAUF:     {torment:100},
BALLSICHERHEIT:  {determination:71,dexterity:29},   // ← Zeichen fuer Zeichen = PASSGENAUIGKEIT
TEAMGEIST:       {power:41,health:33,speed:26},     // ← Zeichen fuer Zeichen = LAUFKRAFT
AUSDAUER:        {stamina:67,will:33},
LAUFTEMPO:       {speed:52,stamina:32,dexterity:16}
```

**TEAMGEIST ist eine exakte Kopie von LAUFKRAFT.** Damit ist der ganze Fund aus
`football-rezept-kalibrierung.md` Abschnitt 4.4 wieder aufgehoben: TEAMGEIST wurde damals zum
Receiver-Los gemacht, um eine **dritte, von Passer und Laeufer unabhaengige Kreditvergabe-Achse**
zu schaffen — heute zieht diese Achse aus derselben Verteilung wie das Laeufer-Los. Derselbe
Spieler ist Running Back UND Nummer-eins-Receiver, in jedem Spiel, mit hoher Wahrscheinlichkeit.
Das ist exakt der Zustand, den 4.4 als Fehler beschrieb („vereinnahmten dieselben ein bis zwei
laufstarken Spieler fast den GESAMTEN Offensiv-Ertrag") — nur diesmal per Rezept statt per
Lotterie. BALLSICHERHEIT/PASSGENAUIGKEIT sind dieselbe Dopplung ein zweites Mal.

**Und der Quarterback-Kanal misst praktisch nichts.** Innerhalb der zwoelf, die tatsaechlich
antreten (kaderfest, 120 Spiele, Mittel ueber die Kader-Familie):

| Sub-Skill | rho zur Eignung (im Spiel) | mechanisches Gewicht |
|---|---:|---|
| PASSSCHUTZ | 0,836 | ~0 % (kein eigener Kanal, s. u.) |
| LAUFKRAFT / TEAMGEIST | 0,807 | schwer |
| ABWEHR_LAUF | 0,618 | ~0 % |
| ABWEHR_PASS | 0,363 | leicht |
| LAUFTEMPO | 0,242 | 0 % |
| AUSDAUER | 0,206 | 0 % |
| **PASSGENAUIGKEIT / BALLSICHERHEIT** | **0,135** | **schwer** |

`determination:71, dexterity:29` traegt in der Football-Eignung (`spielEignung.gewichte`,
:4316: `power 22, health 18, speed 14, torment 12, determination 10, awareness 8, stamina 6,
dexterity 4, spirit 3, will 3`) zusammen 14 von 100 Gewichtspunkten. Der Quarterback — Passversuche,
Passyards (12,6 % des Impacts), Completions (8,6 %), Interception-Risiko — wird also von einem
Wert gezogen, der mit der gemessenen Eignung fast nichts zu tun hat. **Ueber ein Fuenftel des
Box Scores ist strukturell Rauschen.**

**Ein Rand-Fund, der eine offene Frage von Chris beantwortet.** Der Gesamtstand-Bericht nennt es
als „offene Entscheidung": Anzeige/Teamstaerke/KI-Kauf ordnen Football nach der ALTEN MATRIX
(`BASIS_JE_DISC.football`, :3500 — spirit 25, torment 16, health 14 ...), das Minispiel nach
`spielEignung` (power 22, health 18, speed 14 ...). Gemessen (Prototyp, `spielEignung` einmal
abgeschaltet, sonst identisch): rho je Spiel **0,053**, rho Saison **−0,028**. Die beiden
Ordnungen sind auf dem echten Kader nicht „leicht verschieden", sondern **praktisch
unabhaengig**. Wer heute nach der Anzeige einkauft, kauft fuer das Football-Minispiel im Mittel
zufaellig ein. Das ist ein eigener Ticket-Wert und gehoert Chris vorgelegt, nicht nebenbei
entschieden.

---

## 4. Warum die drei bisherigen Runden nicht durchkamen

Nicht aus Nachlaessigkeit — sie haben alle drei am **Rezept** gearbeitet, und das Rezept war
nicht der Deckel.

1. **Runde 1 (Live-Migration).** Ersetzte den Vorab-Pfad durch die Down/Snap-Zustandsmaschine.
   rho 0,345 -> 0,305 je Spiel. Alle Konstanten ausdruecklich Platzhalter.
2. **Runde 2 (`football-rezept-kalibrierung.md`, 04.09.).** Fand einen echten Absturzfehler, fittete
   den NFL-Korridor sauber und hob rho auf 0,460 — und schrieb selbst, ehrlich, dass +0,155
   **unter** der Kader-Spannweite von 0,258 liegt und damit „kein sauber bewiesener rho-Sprung"
   ist. Der grosse Einzelhebel dieser Runde (TEAMGEIST als Receiver-Los) war eine
   **Rollen**-Aenderung, keine Gewichts-Aenderung — der einzige Schritt, der wirklich trug, war
   also schon damals struktureller Natur.
3. **Runde 3 (PR #796/#803).** Zog das Rezept auf die Matrix-Attribute nach und fuehrte den
   `spielEignung`-Block ein. rho auf 0,516. Dabei entstand die TEAMGEIST=LAUFKRAFT-Dopplung, die
   den Hebel aus Runde 2 wieder zunichte machte.

**Der strukturelle Deckel — analog zu TDMs Zielwahl-Problem — ist die flache Lotterie.** Solange
`gewichtetesLos()` linear zieht, kann kein Rezept der Welt die Volumendifferenz erzeugen, aus der
sich in einem einzelnen Spiel eine Rangfolge bildet. Runde 2 schrieb das sogar fast hin
(Abschnitt 4.6: pooled-Korrelation sagt nichts ueber „zwoelf konkrete Spieler EINES Spiels der
Groesse nach ordnen") — aber die Konsequenz („dann liegt es an der Ereignisverteilung, nicht am
Rezept") wurde nicht gezogen.

Ein zweiter, echter Motorbefund steht seit Runde 2 unbearbeitet in Abschnitt 5 desselben
Dokuments: **PASSSCHUTZ und ABWEHR_LAUF haben keinen Kanal zum eigenen Box Score.** Der Passer
wird ueber PASSGENAUIGKEIT gezogen, nicht ueber PASSSCHUTZ; ein Spieler mit gutem PASSSCHUTZ wird
dadurch nicht wahrscheinlicher der, gegen den ein Sack gewuerfelt wird. Und PASSSCHUTZ ist
ausgerechnet der Sub-Skill, der mit **rho 0,836** am besten zur Eignung passt — der beste Kanal
des ganzen Rezepts ist tot geschaltet.

---

## 5. Der Vorschlag, Teil A: die drei strukturellen Aenderungen (gemessen)

### 5.1 Eine football-eigene Lotterie mit κ=3 — `fkLos()`

Neu, unmittelbar vor `resolveLauf()` (:6650), **ohne `gewichtetesLos()` anzufassen**:

```js
// FOOTBALL-EIGENE ROLLENLOTTERIE. Dieselbe Form, die Basketball seit dem NBA2K-Eingriff
// benutzt (losGewicht/LOS_NULLPUNKT/LOS_KAPPA, s. dort) — Football lief bis hierher auf der
// flachen, linearen gewichtetesLos(). Bei ~12 Ballberuehrungen je Spieler und Spiel ist die
// Volumendifferenz der einzige Kanal, ueber den sich in EINEM Spiel eine Rangfolge bilden
// kann; linear verschenkt ihn. Eigene Konstante statt einer Aenderung an gewichtetesLos(),
// damit Hockey und Tennis bit-identisch bleiben.
const FK_LOS_KAPPA=3;   // GEMESSEN gegen 2 und 4 (0,687 / 0,714 / 0,688 je Spiel)
const fkLos=(sp,rolle)=>gewichtetesLosNach(sp,u=>Math.pow(Math.max(1,u[rolle]-LOS_NULLPUNKT),FK_LOS_KAPPA));
```

Sieben Aufrufstellen ersetzen `gewichtetesLos` durch `fkLos`, **alle innerhalb des
Football-Blocks**: :6651, :6652 (`resolveLauf`), :6704, :6705, :6729 (`resolvePass`), :6972
(Field-Goal-Namenstraeger), :7005 (Fumble-Recovery, zwei Zweige).

`gewichtetesLosNach` (:7488) und `LOS_NULLPUNKT` (:4699) sind Funktions- bzw.
Modul-Deklarationen und zur Aufrufzeit sichtbar — keine Reihenfolge-Falle.

### 5.2 Rezept C — jeder Kanal traegt die Eignung, keiner ist die Kopie eines anderen

Die Auswahl ist **nicht** per Sinkhorn entstanden (den Blindfleck beschreibt Runde 2 selbst),
sondern gegen die **innerhalb der zwoelf Antretenden** gemessene Korrelation zur Eignung, mit
einer harten Nebenbedingung: keine zwei Sub-Skills duerfen dieselbe Mischung tragen.

```js
PASSGENAUIGKEIT: {power:40,determination:35,dexterity:25},  // rho 0,801 (vorher 0,143)
LAUFKRAFT:       {power:41,health:33,speed:26},             // rho 0,909  UNVERAENDERT
PASSSCHUTZ:      {power:40,health:40,awareness:20},         // rho 0,853  UNVERAENDERT
ABWEHR_PASS:     {torment:40,power:35,speed:25},            // rho 0,848 (vorher 0,362)
ABWEHR_LAUF:     {torment:55,power:30,health:15},           // rho 0,873 (vorher 0,576)
BALLSICHERHEIT:  {power:35,health:35,determination:30},     // Dopplung mit PASSGENAUIGKEIT geloest
TEAMGEIST:       {health:45,torment:30,speed:25},           // rho 0,905, Rangkorr. zu LAUFKRAFT 0,87
AUSDAUER:        {stamina:67,will:33},                      // UNVERAENDERT (kein Kanal, s. 6.4)
LAUFTEMPO:       {speed:52,stamina:32,dexterity:16}         // UNVERAENDERT, disziplinuebergreifend
```

Football-fachlich lesbar, und genau so gemeint: der Quarterback ist Arm (power) + Kaltbluetigkeit
(determination) + Griff (dexterity); der Running Back ist Wucht + Robustheit + Antritt; der
Receiver ist der **grosse, zaehe** Zielspieler (health/torment/speed) statt eines zweiten Running
Backs; die Passverteidigung ist Aggression + Wucht + Antritt.

Gemessen zusammen mit 5.1: rho je Spiel **0,775**, Saison **0,902** (Basketball: 0,923),
Spannweite 0,091.

### 5.3 Was hier NICHT hilft — ein gemessener Irrweg, damit ihn niemand nochmal geht

Der naheliegende „lehrbuchmaessige" Receiver (`speed:40, power:30, dexterity:30`) und ein
QB aus `determination/torment/health` wurden zuerst probiert (Variante B): rho je Spiel
**0,629**, Saison **0,692** — deutlich SCHLECHTER als κ=3 allein. Grund: Footballs
`spielEignung` ist power-dominant (power allein korreliert mit rho 0,853 zur Eignung), speed
traegt nur 0,144. Ein Receiver-Los ohne power/health/torment loest zwar die Dopplung, verliert
aber genau den Kanal, den es tragen soll. **Die Loesung ist nicht „andere Attribute", sondern
„derselbe Anker, anderes Profil"** — jeder fachliche Sub-Skill braucht einen Anteil an
power/health/torment PLUS ein eigenes Unterscheidungsmerkmal.

### 5.4 Die Tackle-Zeile — der fehlende Verteidiger-Kanal

Heute bucht der Motor **jeden Snap einen Verteidiger** (`erg.verteidiger`, seit der
Bewegungs-Runde 06.09. an `lauf`/`komplett`/`incomplete`/`sack`/`interception` vorhanden) — und
schreibt ihn nirgends gut. Ein Verteidiger sammelt in einem ganzen Spiel im Mittel **0,5**
Box-Score-Ereignisse (Sacks 1,7 + INTs 0,7 + Fumble-Recoveries 0,5 je Team, auf sechs Leute).
Er ist die halbe Spielzeit auf dem Feld und praktisch unsichtbar.

Der Motor sagt das sogar selbst — Kommentar ueber `WERTUNG_FOOTBALL()` (:17546):
*„KEIN eigener Tackle-Zaehler: anders als der ausformulierte Wunsch nach ‚Tkl' hat der Motor
keine einzige Play-Auswertung, die einem Verteidiger einen Tackle fuer sich gutschreibt."*

Vorschlag — zwei Zeilen im Motor, eine in der Wertformel, eine Spalte in der Tabelle:

```js
// vollziehFootballErgebnis(), Zweig "lauf" und Zweig "komplett":
if(erg.verteidiger)erg.verteidiger.checks++;     // `checks` existiert an jeder Einheit (Hockey-Bodycheck)

// feldspielWert(), Football-Zweig (:6264):
+ (u.checks||0)*0.15                             // Solo-Tackle — GEMESSEN gegen 0,12/0,20/0,35
```

Das ist **keine Metrik-Kosmetik**, sondern die Vervollstaendigung des Box Scores: der Solo-Tackle
ist die defensive Standardzeile jedes NFL-Boxscores, und das Projekt hat denselben Schritt bei
Hockey schon einmal gemacht (Steals nachgetragen, weil „Puck erobern im Eishockey eine
Hauptaufgabe ist", Kommentar bei `feldspielWert`). Zusaetzlich bekommt `WERTUNG_FOOTBALL()` die
Spalte `{id:"tkl", kopf:"Tkl", titel:"Tackles"}`, und der Fusstext („Tackles werden nicht
gezaehlt") faellt weg.

Gemessen: **0,775 -> 0,800** je Spiel, Kader-Spannweite 0,091 -> **0,054**. Das Gewicht 0,15 ist
ein flaches Optimum (0,12 -> 0,794; 0,20 -> 0,792; 0,35 -> 0,772), also robust und nicht
uebergefittet.

### 5.5 Der Effekt auf jeden einzelnen Kanal — vorher/nachher

Innerhalb eines Spiels, 120 Spiele ueber die Kader-Familie:

| | rho(Sub-Skill, Eignung) | | rho(Box-Score-Zeile, Eignung) | |
|---|---:|---:|---:|---:|
| | **vorher** | **nachher** | **vorher** | **nachher** |
| PASSGENAUIGKEIT | 0,135 | **0,691** | Passyards 0,311 | **0,641** |
| TEAMGEIST | 0,807 | **0,856** | Fangyards 0,323 | **0,582** |
| LAUFKRAFT | 0,807 | 0,807 | Laufyards 0,591 | **0,678** |
| ABWEHR_PASS | 0,363 | **0,790** | Completions 0,281 | **0,655** |
| ABWEHR_LAUF | 0,618 | **0,808** | Touchdowns 0,272 | **0,450** |
| BALLSICHERHEIT | 0,135 | **0,756** | Turnover 0,038 | **0,223** |

Jede einzelne Zeile geht in dieselbe Richtung — sechs unabhaengige Belege, kein Einzeltreffer.

---

## 6. Der Vorschlag, Teil B: „ergibt Sinn und laeuft smooth" — was Chris wirklich gefragt hat

Chris' Satz ist zweiteilig, und der zweite Teil ist ihm ausdruecklich wichtiger. Das Folgende
haengt NICHT an der Rangtreue und ist zum Teil sogar ihr Preis.

### 6.1 Der Korridor muss nachgezogen werden — und zwar zwingend, nicht optional

`node scripts/miss-football-korridor.mjs 120`, Prototyp gegen Ziel:

| Kennzahl | Ziel (NFL 2024) | Ist-Stand | Prototyp | |
|---|---:|---:|---:|---|
| Punkte je Team | 22,9 | 17,3 | 21,0 | besser |
| Touchdowns je Team | ~2,4 | 2,0 | 2,60 | gut |
| Completion-Quote | 65,3 % | 67,0 % | **76,5 %** | zu hoch |
| Yards je Passversuch | 7,1 | 6,95 | **8,70** | zu hoch |
| Yards je Laufversuch | ~4,3 | — | **3,52** | zu niedrig |
| Passversuche je Team | 29,9 | 25,3 | 25,4 | zu wenig |
| Sack-Quote | ~7,0 % | 6,7 % | 7,5 % | gut |
| Interception-Quote | 2,1-2,4 % | 2,9 % | 2,9 % | leicht hoch |
| Field-Goal-Quote | ~85 % | 82,4 % | 84,9 % | gut |
| Punts je Team | ~4 | 3,0 | **1,90** | zu wenig |

**Der Grund ist mechanisch und war vorhersehbar:** κ=3 aendert, WER typischerweise handelt. Alle
Wahrscheinlichkeitskonstanten (`kurve.base`, `kurve.skillMittel`, `pSack`, `pInt`, `meanYds`)
wurden in Runde 2 gegen einen **durchschnittlichen** Akteur gefittet; jetzt ist der typische
Passer fast immer der beste Passer des Teams, also weit ueber dem Mittel — der Logit-Bonus
schlaegt voll durch. Die Offense konvertiert zu leicht, also gibt es zu wenige Punts, also zu
wenige Ballwechsel, also zu wenige Snaps.

Das ist **kein Argument gegen κ=3**, sondern die Arbeit, die dazugehoert, und sie ist mechanisch:

- `kurve.skillMittel` neu **rechnen**, nicht raten: heute 0,446, mit Rezept C liegt der Mittelwert
  bei `50,5·0,0060 + 46,1·0,0020 = 0,395`. Aber `skillMittel` ist mit κ=3 die falsche Referenz
  geworden — die Referenz muss der **erwartete** Akteur der Lotterie sein, nicht der Kadermittelwert.
  Sauberste Fassung: `skillMittel` einmal aus einem 120-Spiele-Lauf als **tatsaechlicher
  Mittelwert der gezogenen Passer** messen (`window.__arena` bzw. `miss-football-korridor.mjs`
  um diese Spalte erweitern) und eintragen — dieselbe Ehrlichkeit, die Runde 2 fuer die alte
  Fassung schon aufgebracht hat.
- Danach `kurve.base` gegen 65,3 % Completion nachziehen (in dieser Reihenfolge, wie ueberall).
- `FK_TIER_YARDS` gegen 7,1 Yards/Attempt.
- `resolveLauf`s Mittelwert 3,6 -> ~4,4 gegen 4,3 Yards/Carry.
- `pInt`-Basis leicht senken.

Erst wenn der Korridor wieder sitzt, sitzt auch die Punt-/Drive-Zahl — Punts sind eine **Folge**
der Konvertierungsquote, keine eigene Stellschraube.

### 6.2 Was am Bild fehlt, damit man Football sieht

Nachgesehen, nicht vermutet:

- **`bodenFeldspiel()`s Football-Zweig (:10089) zeichnet keine Line of Scrimmage und keine
  First-Down-Marke.** Nur Endzonen, Zehn-Yard-Linien und Yardzahlen. (Der Gesamtstand-Bericht
  fuehrt „Line of Scrimmage im Feldspielbild" unter Assets — das trifft nicht zu; die Line ist
  nur durch die Formation der zwoelf Figuren erkennbar.)
- **`football.tsx` (348 Z., produktive Buehne) enthaelt kein einziges Vorkommen von
  `down`/`toGo`/`spot`.** Es gibt Endzonen-Flash und Touchdown-Surge — aber Down und Distanz,
  also die gesamte Erzaehlung des American Football, stehen nirgends.
- Auch der Mockup hat keine Down-Anzeige; Down/Distance erscheinen nur als Feed-Text
  („Erster Versuch!").

Das ist der **billigste** Anteil an „smooth", und er ist unabhaengig von jeder Formel:

1. Zwei Linien im Football-Zweig von `bodenFeldspiel()`: die Line of Scrimmage (blau, `fkLosX(side,spot)`)
   und die First-Down-Marke (gelb, `fkLosX(side, spot - toGo)`) — genau das Bild, das jeder
   NFL-Zuschauer aus der TV-Uebertragung kennt und ohne das ein Football-Bild nicht lesbar ist.
2. Eine HUD-Zeile im Mockup und ein Chip in `football.tsx`: **„2. Versuch & 7 · eigene 34"** plus
   Viertel und Uhr. Die Daten liegen schon vollstaendig an `fsLive.football` und sind ueber
   `window.__arena` (:22486) bereits nach aussen gereicht — es fehlt nur die Anzeige.
3. Ein **Drive-Zaehler**: Snapzahl und Yards der laufenden Serie, im Feed beim Ballwechsel
   zusammengefasst („Neun Spielzuege, 62 Yards, Touchdown"). Das ist die Einheit, in der Football
   erzaehlt wird, und der Motor kennt sie heute nicht einmal als Variable.

### 6.3 Was den Ablauf football-typisch macht — vier kleine Mechaniken

Alle vier sind im Football-Block gekapselt und beruehren keine andere Disziplin:

1. **3rd Down als Wendepunkt sichtbar machen.** Der Motor spielt ihn bereits richtig (eigene
   Playcall- und Tiefen-Schwelle, `waehlePlayCall`/`waehleFootballTier`), sagt es aber nicht: der
   Feed unterscheidet einen konvertierten 3rd & 8 nicht von einem 1st-Down-Lauf. Ein eigener
   Feed-/Schwebe-Text („3. Versuch konvertiert!") und ein kurzer Kamera-/Zoom-Moment auf die
   Standphase — das ist genau der Moment, den Chris meint.
2. **Vierter Versuch mit Blick auf Spielstand und Uhr.** `waehleVierterVersuch(spot,toGo)` (:6631)
   kennt weder `fsPunkte` noch `fsT`. Ein Team, das im letzten Viertel zwei Scores hinten liegt,
   puntet trotzdem — das ist die eine Stelle, an der der heutige Motor sichtbar *unfootball*
   handelt. Zwei zusaetzliche Parameter und drei Zeilen: bei Rueckstand > 8 im letzten Viertel
   die Go-Schwelle von `toGo<=1` auf `toGo<=4` heben, bei Fuehrung in der Schlussphase umgekehrt
   senken. Kostet nichts und macht jedes Spielende erzaehlbar.
3. **Der Punt darf nicht konstant sein.** `resolvePunt()` gibt heute **immer** 40 Yards zurueck.
   Damit ist das Feldpositionsspiel — nach Meinung jedes Football-Handbuchs das halbe Spiel —
   deterministisch. Vorschlag: `netto = 40 + (AUSDAUER_des_Punters − 50)·0,25 + Rauschen`, Punter
   ueber `fkLos(off,"AUSDAUER")`. Das gibt zugleich AUSDAUER seinen ersten mechanischen Kanal
   ueberhaupt (heute 0 %) und ist football-fachlich sauber (Bein = Kondition/Technik, kein
   eigener Kicker-Slot noetig).
4. **Interception und Fumble ohne Return.** Beide setzen `fkNaechsterSpot = 100 − fb.spot`, also
   Ballbesitz exakt am Ort des Wurfs. Ein kurzer, verteidigergewichteter Return
   (`0..15 Yards nach ABWEHR_PASS`) macht den Turnover zu dem Grossereignis, das er im echten
   Spiel ist — und gibt der Defense eine zweite Yards-Zeile.

### 6.4 Was bewusst NICHT vorgeschlagen wird

- **Kein laengeres Spiel.** CLAUDE.md warnt zu Recht („mehr Ereignisse helfen fast nie"), und der
  Prototyp zeigt, dass die 0,80 ohne jede Uhr-Aenderung erreichbar sind. Die Ereigniszahl bleibt
  bei ~50 Snaps je Team.
- **Kein neunter Sub-Skill / keine MATRIX-Diskussion.** Runde 2 nannte das als moeglichen naechsten
  Schritt; Rezept C erreicht dasselbe Ziel (drei unabhaengige Kreditvergabe-Achsen), ohne die
  gesperrte Matrix anzufassen.
- **PASSSCHUTZ an die Passer-Auswahl koppeln** (der offene Befund aus Runde 2 Abschnitt 5) —
  reizvoll, weil PASSSCHUTZ mit rho 0,836 der best-korrelierende Sub-Skill ist. Aber es aendert
  die Sack-Quote und damit den Korridor ein zweites Mal, waehrend 6.1 ihn ohnehin gerade neu
  fittet. **Runde 2, nicht Runde 1** — zwei unabhaengige Korridor-Verschiebungen gleichzeitig
  sind nicht mehr auseinanderzuhalten.
- **Kickoff-Returns, Strafen, Two-Minute-Drill, Two-Point-Conversion.** Alle vier waeren echte
  NFL-Wuerze, aber jede ist eine eigene Zustandsmaschine. Nach Runde 1, in Reihenfolge des
  Sichtbarkeitsgewinns.

---

## 7. Kollisionsrisiko: Basketball und Hockey bleiben bit-identisch — wie das garantiert ist

`bauFeldspiel()` (:5436) ist geteilt, und Basketball wie Hockey sind LIVE. Die Garantie ist
**strukturell**, nicht nur gemessen:

| Aenderung | beruehrt Basketball/Hockey? | warum nicht |
|---|---|---|
| `FK_LOS_KAPPA`/`fkLos()` neu | nein | neue Konstante + neue Funktion; `gewichtetesLos()` (:4668) bleibt **Zeichen fuer Zeichen unveraendert**. Hockey/Tennis rufen weiter sie auf. |
| sieben Aufrufstellen auf `fkLos` | nein | alle sieben liegen in `resolveLauf`/`resolvePass`/`vollziehFootballErgebnis` — Funktionen, die ausschliesslich aus `loeseFootballZug()`/`stepSnapPhase()` gerufen werden, und die nur laufen, wenn `fsLive.football` gesetzt ist (`istFootball()`). |
| Rezept C | nein | `FELDSPIEL_ART.football.rezept` (:4472). Basketball (:4089-Bereich) und Hockey haben eigene Bloecke; `bauFeldspiel` liest `R=FB().rezept`, also je Disziplin. |
| Tackle-Zaehler | nein | zwei Zeilen in `vollziehFootballErgebnis()` — die Funktion existiert nur fuer Football. `u.checks` ist an jeder Einheit vorhanden (Hockey-Bodycheck), wird ausserhalb der jeweiligen Disziplin aber nie inkrementiert. |
| `feldspielWert()`-Term | nein | steht **innerhalb** des `if((dId\|\|feldspielDisc)==="football")`-Zweigs (:6256-6265). Hockey/Basketball nehmen ihre eigenen Zweige darunter. |
| `WERTUNG_FOOTBALL()`-Spalte | nein | eigene Bau-Funktion, aufgerufen ueber `FELDSPIEL_ART.football.wertungTabelle` (:4321). |
| LOS/First-Down-Linie, HUD | nein | `bodenFeldspiel()`s Football-Zweig endet mit `return` (:10126), bevor Hockey/Basketball drankommen. |

**Zusaetzlich gemessen** (Prototyp im Baum, `node scripts/miss-alle-disziplinen.mjs 24 basketball
hockey`): Basketball 0,769 / 0,105 / 0,923 / 0,224 und Hockey 0,669 / 0,181 / 0,832 / 0,259 —
ziffernidentisch mit dem Lauf am unveraenderten `main` derselben Sitzung.

Eine **Regel fuer die Umsetzung**, damit das so bleibt: kein Commit dieser Runde darf
`gewichtetesLos`, `gewichtetesLosNach`, `losGewicht`, `LOS_NULLPUNKT`, `LOS_KAPPA`,
`bauFeldspiel`s gemeinsamen Teil oder einen Nicht-Football-Zweig von `feldspielWert` beruehren.
Das ist mit `git diff` in einem Blick pruefbar.

---

## 8. Verifikationsmethode

**Pflicht, in dieser Reihenfolge:**

1. `node --check public/mockups/battle-mode.engine.js` und `npm test`.
2. **`node scripts/miss-alle-disziplinen.mjs 24 football basketball hockey`** — die Abnahmezahl.
   Erwartung: Football >= 0,79; Basketball/Hockey **ziffernidentisch** zu
   `data/generated/rangtreue-basislinie.json`.
3. **`node scripts/miss-alle-disziplinen.mjs 48 football`** — die Aenderung hat viele
   Freiheitsgrade (Lotterieform, sechs Rezeptzeilen, ein Wertformel-Term), deshalb ist n=48
   hier nicht optional. Am Prototyp: n=24 und n=48 lieferten beide 0,800. **Zusaetzlich:
   n=48 mit `--je-seite=4` und `--je-seite=2`** — Football tritt real mit 2 bis 6 je Seite an,
   und κ=3 wirkt bei kleinem Kader staerker (bei 2v2 vergibt es fast alles an einen Spieler).
   Das ist die einzige Stelle, an der der Prototyp noch **ungeprueft** ist.
4. **`node scripts/miss-football-korridor.mjs 120`** — Abnahme erst, wenn Completion-Quote,
   Yards/Attempt, Yards/Carry und Punts je Team wieder in derselben Nachbarschaft liegen wie
   heute (Abschnitt 6.1). **Diese Pruefung ist gleichrangig mit der rho-Zahl**, weil Chris'
   Auftrag „ergibt Sinn" genau sie meint.
5. `node scripts/pruefe-rangtreue-schranke.mjs` (CI-Schranke) fuer die uebrigen 17 Disziplinen —
   sie laufen durch andere Chassis, sind also nur formal betroffen, aber der Lauf ist billig.
6. `node scripts/sondiere-feldspiel-subskills.mjs football 24` nach dem Umbau: Soll ist, dass
   PASSSCHUTZ/ABWEHR_LAUF/AUSDAUER **weiterhin** nahe 0 % mechanisches Gewicht lesen (sie
   bekommen ihre Kanaele erst in Runde 2 bzw. ueber den Punter) — falls nicht, hat sich etwas
   Unbeabsichtigtes verschoben.

**Sicht-QA: ja, und sie ist hier ausnahmsweise wichtiger als sonst.** Der Gesamtstand-Bericht
raeumt selbst ein, dass fuer Football nie ein Spieltag durchgeklickt wurde (Abschnitt 7.1).
Chris' Auftrag ist zur Haelfte optisch. Konkret per Playwright gegen
`public/mockups/battle-mode.html`:

- Je ein Screenshot in der `formation`-Stufe bei 1st & 10, bei 3rd & 2 (Formation „eng") und bei
  3rd & 12 (Formation „weit" + Nickel) — sind die drei Bilder **unterscheidbar**?
- Ein Screenshot mit gezeichneter Line of Scrimmage und First-Down-Marke — liegt die gelbe Linie
  wirklich `toGo` Yards vor der blauen?
- Der Boxscore (`WERTUNG_FOOTBALL`) am Spielende: hat jeder der zwoelf eine plausible Zeile, oder
  stehen mehrere auf komplett leer? **Gemessen am Prototyp: 8,9 % der Spieler beenden ein Spiel
  mit Impact exakt 0** (Ist-Stand: 0,1 %). Das ist der Preis von κ=3, ist in einem echten
  NFL-Boxscore normal (ein Lineman hat auch keine Zeile) — aber Chris muss es einmal sehen und
  abnicken, bevor es live geht. Die Tackle-Zeile (5.4) senkt diesen Anteil bereits deutlich.
- Der Feed ueber eine volle Serie: liest sich das als Drive, oder als Liste?

---

## 9. Was in einer ersten Runde realistisch ist — ehrlich

**Was ich fuer belegt halte:** die Wurzel (flache Lotterie + zwei Sub-Skill-Kopien + toter
QB-Kanal) ist gefunden und mit vier unabhaengigen Messungen belegt, und **0,80 ist erreichbar** —
n=24 und n=48 sagen beide exakt 0,800, bei einer Kader-Spannweite von nur 0,054. Das ist die
sauberste Beweislage, die Football je hatte.

**Was ich NICHT verspreche:**

1. **0,80 UND ein sitzender NFL-Korridor in einem Zug.** Der Prototyp erreicht die Zahl mit einem
   verschobenen Korridor (Completion 76,5 %). Das Nachziehen (6.1) ist Handwerk, aber es
   verschiebt rho wieder — in welche Richtung, ist unbekannt. Realistisch fuer Runde 1:
   **rho zwischen 0,75 und 0,82 bei sitzendem Korridor.** Wer 0,80 garantiert hoert, hoert mehr,
   als hier steht.
2. **Die Kadergroessen 2 und 4 sind ungemessen.** κ=3 bei zwei Spielern je Seite koennte alles an
   einen Einzelnen geben. Das ist das groesste offene Risiko dieses Plans und gehoert **vor** den
   ersten Commit gemessen, nicht danach.
3. **Der „smooth"-Teil ist mehr Arbeit als der rho-Teil.** LOS-/First-Down-Linie, Down-Anzeige in
   Mockup **und** `football.tsx`, Drive-Zaehler, Turnover-Return, score-/uhr-abhaengiger vierter
   Versuch, variabler Punt — das sind sechs unabhaengige Baustellen an drei Dateien plus
   Sicht-QA. In einer Runde mit der Rezept-Arbeit zusammen ist das zu viel.

**Vorschlag fuer den Schnitt in zwei Runden:**

| | Inhalt | Abnahme |
|---|---|---|
| **Runde 1** | `fkLos`/κ=3, Rezept C, Tackle-Zeile + Tkl-Spalte, Korridor-Refit (6.1), Kadergroessen 2/4/6 gemessen | rho >= 0,75 kaderfest n=48, Korridor in der Nachbarschaft, Basketball/Hockey bit-identisch |
| **Runde 1b** (klein, rein optisch, kann parallel laufen) | LOS-/First-Down-Linie, Down-&-Distance-HUD im Mockup und in `football.tsx`, Drive-Zaehler im Feed | Sicht-QA mit Screenshots, keine rho-Aenderung erlaubt |
| **Runde 2** | PASSSCHUTZ an die Passer-Auswahl, variabler Punt, Turnover-Return, vierter Versuch mit Spielstand/Uhr, 3rd-Down-Moment | rho >= 0,80, Korridor unveraendert gut |

Runde 1b ist bewusst abgetrennt: sie ist der Teil, den Chris **sofort sieht**, sie kann keine
Messung kaputt machen, und sie braucht keinen einzigen Messlauf.

---

## Anhang: was fuer diesen Plan gemessen wurde

- `node scripts/miss-alle-disziplinen.mjs 24 football basketball hockey` am unveraenderten `main`
  (c56fffd7) — die Ist-Zahlen in Abschnitt 0.
- Neun Prototyp-Varianten, je `node scripts/miss-alle-disziplinen.mjs 24 football` (κ 2/3/4;
  Rezept B und C; Tackle-Gewicht 0,12/0,15/0,20/0,35), plus n=48 fuer die gewaehlte Fassung.
- `node scripts/miss-alle-disziplinen.mjs 24 basketball hockey` mit dem Prototypen im Baum —
  Regressionsnachweis.
- `node scripts/miss-football-korridor.mjs 120` vorher und nachher.
- Eine eigene Wegwerf-Sonde ueber `window.__arena.kaderSetzen()` + `feldspielProbe("football")`,
  120 Spiele ueber die Kader-Familie: rho jedes Sub-Skills und jeder Box-Score-Zeile zur Eignung
  **innerhalb eines Spiels** (Abschnitt 3 und 5.5), Anteil jeder Zeile am Impact, und der Anteil
  der Spieler mit Impact 0.
- Eine Offline-Rechnung gegen `data/generated/kaderfamilie-live-save.json` (110 Spieler, davon
  je Paarung die zwoelf, die tatsaechlich antreten): Attribut- und Mischungs-Korrelationen zur
  Football-Eignung, Rangkorrelation jeder Kandidaten-Mischung zu LAUFKRAFT (Unabhaengigkeit),
  und die neuen Sub-Skill-Mittelwerte fuer den `skillMittel`-Refit.

**Der Arbeitsbaum ist nach diesen Messungen wieder auf `main`-Stand** — `battle-mode.engine.js`
ist per `git checkout` zurueckgesetzt, die Wegwerf-Sonde geloescht. Dieses Dokument ist die
einzige Aenderung.
