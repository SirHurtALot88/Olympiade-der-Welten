# Puste: Kalibrierung und Abnahme (Eishockey und Bahn), 13.09.

Umsetzung von `docs/design/hockey-ausdauer-checks-konzept-13-09.md` (PR #906), nachdem Chris
die vier offenen Fragen beantwortet hat. Dieses Dokument hält fest, **wie die Konstanten
entstanden sind** und **was die Änderung an der Rangtreue bewegt** — beides gemessen, nicht
geschätzt.

## Kurzfassung für Eilige

**Die Puste ist im Eishockey vollständig sichtbar, wirkt aber nicht auf den Ausgang** — und
das ist ein gemessener Befund, keine halbe Arbeit. Zwei Läufe (je 24 Spiele × 5 Kader) mit
wirksamer Puste ergaben rho je Spiel **0,616** und **0,628** gegen eine Basislinie von
**0,669**; die zweite Messung hatte die Wirkung bereits um zwei Drittel zurückgenommen und
holte trotzdem nichts zurück. Die Einbuße hängt also nicht an der Stärke der Faktoren,
sondern daran, dass Positionen überhaupt verschoben werden — dieselbe Kaskade, an der schon
der Zoneneintritt gescheitert ist. Mit den drei Faktoren auf exakt 1 ist die Simulation
bitgleich; Leiste, Verbrauch, Check-Kosten, Strafbank- und Drittelpausen-Erholung und die
zwei neuen Boxscore-Spalten laufen vollständig. Abschnitt 4.2 bis 4.3 hat die Zahlen und
sagt, was es bräuchte, um die Wirkung doch einzuschalten.

**Auf der Bahn bleibt die Wirkung an**, weil dort die Leiste samt Tackle-Kosten schon vorher
existierte und nur Chris' Erholung fehlte — die Messung dazu steht in Abschnitt 4.5.

## 0. Chris' Antworten, wörtlich

| Frage aus dem Konzept | Antwort |
|---|---|
| 11.1 Nur sichtbar, oder soll die Puste den Ausgang beeinflussen? | „sowohl als auch" |
| 11.2 Wie leer soll die Leiste am Spielende sein? | „hängt ab von den Spieler-Stats, manche laufen aus und müssen kurz regenerieren, manche schaffen den kompletten Spieltag" |
| 11.6 Wie soll die Größe heißen? | „ja erstmal okay" (auf den Vorschlag „Puste") |
| 11.7 Soll die Puste Takeshis Hindernis-Ausgänge beeinflussen? | „also hier dann ‚Puste' und ja das kann es beeinflussen je nach hindernis aber MUSS nicht zwangsweise hängt von art und schwierigkeit ab -> du müsstest also realistisch schwierigkeiten und arten von hindernissen vergeben und diese kategorisieren" |

**Die zweite Antwort ist die, die alles andere bestimmt.** Sie sagt ausdrücklich: es gibt
**keine** Zielzahl für den Endstand. Die Zielgröße ist die **Streuung** — und zwar eine, die
am Spieler hängt und nicht am Zufall.

## 1. Zu Frage 11.7: die Kategorisierung existiert bereits

Chris verlangt „realistisch Schwierigkeiten und Arten von Hindernissen vergeben und diese
kategorisieren". **Beides steht seit Monaten im Rezept**, und es musste nichts Neues erfunden
werden — was ausdrücklich wichtig ist, weil parallel eine eigene Runde an Takeshis
Hindernis-Balance arbeitet und zwei konkurrierende Taxonomien das Schlimmste wären:

| Kategorie | Feld | Inhalt |
|---|---|---|
| **Art** | `BAHN_ART["takeshis-castle"].hindernisTypen` | je Station der Sub-Skill, der sie entscheidet: `["TECHNIK","WENDIGKEIT","WUCHT","STEHEN","TECHNIK","ROBUST","WUCHT"]`, über 14 Stationen zweimal durchlaufen |
| **Schwierigkeit** | `BAHN_ART["takeshis-castle"].fallenStufe` | 1 bis 3 Sterne je Art: `{TECHNIK:2, WENDIGKEIT:1, WUCHT:3, STEHEN:2, ROBUST:3}` |

Neu ist nur eine **dritte Spalte an derselben Tabelle**: `pusteHindernis` sagt je Art, wie
stark Müdigkeit dort zusätzlich zuschlägt.

```js
pusteHindernis:{WUCHT:0.30, ROBUST:0.26, STEHEN:0.20, TECHNIK:0.06, WENDIGKEIT:0.05}
```

Die Staffelung ist sportlich und nicht frei gewählt: an einer Wucht- oder
Nehmerqualitäts-Station zahlt Müdigkeit voll — man muss Kraft aufbringen, die man nicht mehr
hat. An einer Technik- oder Wendigkeits-Station kaum: die Bewegung sitzt oder sie sitzt nicht,
und ein müder Balancierer fällt nicht dreimal so oft vom Trittstein wie ein frischer.
Multipliziert wird mit der Schwierigkeit aus `fallenStufe`, damit eine Drei-Sterne-Station
härter bestraft als eine Ein-Stern-Station — genau Chris' „hängt von **art UND schwierigkeit**
ab".

**Wirkung nur nach unten:** der Abzug ist `empfindlichkeit × (stufe/3) × (1 − puste/max)`. Bei
voller Puste ist er exakt 0 und die Station damit Zeichen für Zeichen unverändert. Nur ein
leerer Läufer verliert etwas, und selbst dann höchstens 30 Prozentpunkte an der härtesten
Station.

**Abgrenzung zur parallelen Runde, ausdrücklich:** dieses Dokument ändert weder
`technikBasis`/`technikSpanne`/`wuchtBasis`/`wuchtSpanne` noch `hindernisTypen`,
`fallenStufe`, `huerdePreis` oder Takeshis Eignungsformel. Landet die andere Runde zuerst,
muss `pusteHindernis` auf ihrem Stand **neu gemessen**, nicht blind übernommen werden.

---

## 2. Die Puste im Eishockey — wie die sieben Zahlen entstanden sind

### 2.1 Das Modell in einem Absatz

Der Vorrat hängt an **AUSDAUER** (`basis + AUSDAUER·jeAusdauer`), der Verbrauch an der
**tatsächlich gelaufenen Strecke** (`hypot(vx,vy)` je Tick mal `jePx`), die Gutschrift läuft
**immer** (`regen` je Sekunde, auf der Strafbank stärker) plus eine einmalige Gutschrift beim
**Drittelwechsel** (`pause` als Anteil des Vorrats). Dazu kosten **gegebene und kassierte
Bodychecks**, gestaffelt nach dem Kräfteverhältnis.

**Warum die gelaufene Strecke und nicht ein Tempo-Faktor:** „wenn man weniger rennt" ist im
Motor keine Absichtserklärung, sondern `hypot(vx,vy)` — und diese Zahl enthält den
Fastbreak-Zuschlag, die Taumel-Bremse, den Deckungsvorsprung und den Strafbank-Marsch bereits
fertig. Sie ist außerdem der Grund, warum der **Torwart keinen Sonderfall braucht**: er läuft
kaum, also bleibt seine Leiste von selbst bei 100 % (gemessen: Median 100 %, tiefster Stand
99,4 %).

**Netto statt Sperrklinke.** Der Fehler, den das Konzeptdokument auf der Bahn gefunden hat
(`u.reserve` kennt fünf Abzüge und keine einzige Gutschrift, `u.leer` wird nie gelöscht), ist
derselbe Ratchet, den `fatigue-saisonlaenge-plan.md` B.2 für die Saison-Fatigue beschreibt.
Im Eishockey wird er von vornherein vermieden: wer steht, gewinnt; wer sprintet, verliert; wer
im Normaltempo unterwegs ist, hält ungefähr.

### 2.2 Der Kalibrierweg, offengelegt

Gemessen mit `node scripts/miss-hockey-puste.mjs 24` (Einzelkader, 24 Spiele, 6 je Seite —
240 Feldspielerzeilen). Die **gelaufene Strecke** ist die Zahl, an der alles hängt, und sie
war vorher nicht bekannt: **Median 45.140 px je Feldspieler und Spiel**.

| Lauf | `basis`/`jeAusdauer` | `regen` | `jePx` | Puste am Ende (Median) | einmal leer | nie unter die Hälfte | rho(AUSDAUER, tiefster Stand) |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 (erster Schuss) | 34 / 1,10 | 0,62 | 0,0125 | **0,0 %** | **100 %** | 0 % | **0,000** |
| 2 | 34 / 1,10 | 0,25 | 0,0038 | 12,1 % | 31,3 % | 0,4 % | 0,528 |
| 3 | 20 / 1,42 | 0,29 | 0,0038 | 22,5 % | 24,2 % | 12,5 % | **0,750** |
| **4 (Stand)** | **20 / 1,42** | **0,34** | **0,0038** | **38,0 %** | **7,9 %** | **30,4 %** | **0,615** |

Lauf 1 ist der ehrlichste Teil der Tabelle: der erste Schuss war um den Faktor vier zu hart,
**jeder** Spieler lief leer, und `rho(AUSDAUER, tiefster Stand)` las exakt **0,000** — wenn
alle am Boden kleben, unterscheidet die Leiste niemanden mehr. Genau dafür ist die Sonde da.

**Warum Lauf 4 und nicht Lauf 3.** Beide erfüllen Chris' Satz, aber unterschiedlich gewichtet:
Lauf 3 betont „manche laufen aus" (24,2 %), Lauf 4 betont „manche schaffen den kompletten
Spieltag" (30,4 % fallen nie unter die Hälfte) und behält mit 7,9 % Einbrüchen und 20,8 %
unter einem Fünftel beide Enden. Lauf 4 hat außerdem den **kleineren mechanischen Fußabdruck**
— je weniger Spieler in den unteren Bereich der Leiste geraten, desto seltener greifen die
drei Wirkungspfade überhaupt, und desto geringer ist das Risiko für die Rangtreue einer
Disziplin, die ohnehin unter der Projektschranke liegt.

### 2.3 Der Endstand hängt am Spieler, nicht am Zufall

`rho(AUSDAUER, tiefster Puste-Stand) = 0,615` und `rho(LAUFTEMPO, gelaufene Strecke) = 0,852`.
Das ist die Kernaussage der Kalibrierung: die Leiste zeichnet einen **Kontrast zweier
Attribute** — wie groß der Tank ist (AUSDAUER) gegen wie viel Weg gemacht wird (LAUFTEMPO).
Ein schneller Spieler mit schwacher Ausdauer geht auf dem Zahnfleisch, ein zäher Arbeiter
kommt durch. Das ist genau die Geschichte, die Chris sehen will, und sie steht nicht in einem
Kommentar, sondern in zwei gemessenen Korrelationen.

**AUSDAUER hatte im Eishockey bisher genau EINEN mechanischen Kanal** — den `wucht`-Kontrast
im Bodycheck, gemessen mit 4,4 % Gewicht (`hockey-mechanik-angleichen.md`). Die Puste ist sein
zweiter, und im Gegensatz zum ersten ist er sichtbar.

### 2.4 Die drei Wirkungspfade

| Pfad | Ort | Faktor bei leerer Puste |
|---|---|---|
| Tempo | `bewegeSpielerLive`, an `tempoMul` | `tempoMin` = 0,86 |
| Check-Widerstand | `versucheSteal`, als **Argument** von `wucht` statt der rohen AUSDAUER | `wuchtMin` = 0,70 auf die wirksame AUSDAUER |
| Zweikampf am losen Puck | `gewichtetesLosNach`-Gewicht | `zweikampfMin` = 0,78 |

Alle drei sind bei voller Puste exakt 1 und **verbrauchen keinen einzigen zusätzlichen
`rr()`-Wurf**. Der Check-Pfad ist bewusst der interessanteste: die Kosten von vorhin ändern den
Ausgang von jetzt — wer zweimal gecheckt wurde, fällt beim dritten Mal leichter.

**Ausdrücklich NICHT angefasst:** Schuss, Pass, Torwahrscheinlichkeit, `feldspielWert`. Der
Check bleibt ohne Wertposten (der wurde am 02.09. mit Begründung gestrichen — Hit-Differenzen
korrelieren real negativ mit Tordifferenzen).

---

## 3. Die Puste auf der Bahn

Dort existierte die Leiste bereits, inklusive Tackle-Kosten; der Code nennt sie selbst „der
Ersatz fuer den Lebensbalken des Kampfes". Was fehlte, war ausschließlich Chris' Erholung.
Neu sind vier Zahlen je Bahn und eine Zeile Logik:

| Konstante | Wert | Bedeutung |
|---|---:|---|
| `pusteRegen` | 1,0 | Grund-Gutschrift, skaliert mit **STEHEN** (`0,45 + STEHEN·0,011`) |
| `leerSchonung` | 0,45 | Verbrauchs-Faktor eines Eingebrochenen — er schleppt sich und zahlt weniger |
| `leerRegen` | 3,2 | Erholungs-Faktor, solange er eingebrochen ist |
| `pusteFangen` | 0,22 | Anteil des Vorrats, ab dem er sich wieder fängt |

Erholt wird in drei Zuständen, alle aus schon vorhandenen Größen: **am Hindernis**
(`u.huerde>0`, volle Gutschrift), **eingebrochen** (`u.leer`, `leerRegen`-fach), **unter
Plantempo** (anteilig `1−ueber` — genau „wenn man weniger rennt"). Bei Volllast ist die Zeile
rechnerisch nicht vorhanden.

`leerSchonung` ist der Teil, ohne den nichts davon funktioniert: bis hierher zehrte ein leerer
Läufer weiter mit dem vollen Satz seines Plans, obwohl `tempoVon` ihn längst auf rund drei
Viertel heruntergesetzt hatte — er konnte sich per Konstruktion **nie** wieder fangen.

**Staffel, ehrliche Einschränkung:** dort endet gemessen kein Läufer unter 77 % Puste (Median
88,3 %), die Erholung greift also praktisch nie und die Leiste steht weiter nahe voll. Das ist
in dieser Runde Absicht — die Staffel hat mit rho 0,915 die beste Rangtreue des ganzen Feldes,
und ihren Puste-Haushalt wirklich beißen zu lassen ist eine eigene Kalibrierrunde (offene
Frage 8 des Konzeptdokuments, von Chris noch nicht beantwortet).

---

## 4. Abnahme: was die Änderung an der Rangtreue bewegt

Maßstab ist `data/generated/rangtreue-basislinie.json` und
`scripts/pruefe-rangtreue-schranke.mjs`. Gemessen kaderfest mit
`node scripts/miss-alle-disziplinen.mjs 24 <disziplin ...>`.

### 4.1 Der Präsentations-Teil ist bit-identisch

Der erste Commit (Leisten richtig belegen, eigener Schwebetext und eigene Pose für den
Bodycheck) ändert keine Zeile Simulation. Nachgemessen, nicht behauptet:

| Disziplin | Basislinie | nach dem Präsentations-Commit |
|---|---|---|
| hockey | 0,669 [0,181] / 0,832 [0,259] | **0,669 [0,181] / 0,832 [0,259]** |
| hockey, nur Feldspieler | 0,719 [0,182] / 0,818 [0,259] | **0,719 [0,182] / 0,818 [0,259]** |
| basketball | 0,769 [0,105] / 0,923 [0,224] | **0,769 [0,105] / 0,923 [0,224]** |
| football | 0,800 [0,054] / 0,867 [0,077] | **0,800 [0,054] / 0,867 [0,077]** |

Ziffernidentisch in jeder Spalte.

### 4.2 Der Mechanik-Teil kostet Hockey Rangtreue — und das ist der wichtigste Befund dieser Runde

**Erster Messlauf, mit den ursprünglich kalibrierten Wirkungsstärken** (`tempoMin` 0,86 ·
`wuchtMin` 0,70 · `zweikampfMin` 0,78):

| Disziplin | Basislinie | mit wirksamer Puste | Delta |
|---|---|---|---:|
| **hockey (alle 12)** | 0,669 [0,181] / 0,832 | **0,616 [0,164] / 0,832** | **−0,053** |
| **hockey (nur Feldspieler)** | 0,719 [0,182] / 0,818 | **0,689 [0,178] / 0,811** | **−0,030** |
| basketball | 0,769 [0,105] / 0,923 | 0,769 [0,105] / 0,923 | **0,000** |
| football | 0,800 [0,054] / 0,867 | 0,800 [0,054] / 0,867 | **0,000** |

Zwei Dinge stehen darin, und beide muss man getrennt lesen:

1. **Basketball und Football sind bit-identisch.** Die Chassis-Trennung über `art.puste`
   hält, was sie verspricht — das war die Voraussetzung dafür, überhaupt weiterzumachen.
2. **Hockey verliert 0,053 und landet auf 0,616 — die CI-Schranke liegt bei 0,615.** Ein
   Tausendstel Abstand. Formal besteht der Lauf das Gate; praktisch ist das keine Marge, mit
   der man eine LIVE-Disziplin deployt.

**Die ehrliche Doppellesung, die das Projekt selbst vorschreibt:** beide Deltas (−0,053 und
−0,030) sind **kleiner als die Kader-Spannweite** (0,181 bzw. 0,182) und damit nach
`messgrundlage-kaderfest.md` „von Null nicht unterscheidbar". Diese Regel schützt aber davor,
eine VERBESSERUNG zu behaupten, die keine ist. Für eine **Verschlechterung auf einer
produktiven Disziplin, die einen Tausendstel über dem Gate landet**, ist die vorsichtige
Lesung die richtige: Vorzeichen negativ auf **beiden** Zeilen, Saison-Spannweite der Zwölfer
von 0,259 auf 0,308 gestiegen. Das ist kein Rauschen, das man wegdiskutiert.

**Warum es passiert (Mechanismus, nicht Vermutung).** Der Tempo-Pfad verschiebt laufend
Positionen; davon hängt ab, wer innerhalb von `STEAL_REICHWEITE` steht und wer einen losen
Puck zuerst erreicht. Das ändert die ANZAHL der `versucheSteal`-Aufrufe und damit die
Zufallsbahn aller folgenden Ereignisse — genau die Kaskade, an der schon der Zoneneintritt
gescheitert ist (`hockey-zoneneintritt-umsetzung.md`). Dazu kommt, dass der Verbrauch an der
gelaufenen Strecke hängt und diese mit **LAUFTEMPO** korreliert (0,852): wer schnell ist,
ermüdet — und LAUFTEMPO steht auf der Eignungsseite. Die Puste bestraft damit teilweise genau
das, was die Eignung belohnt.

**Zweiter Messlauf, Wirkung auf ein Drittel abgeschwächt** (`tempoMin` 0,95 · `wuchtMin` 0,75 ·
`zweikampfMin` 0,94):

| | rho je Spiel | Spannweite | rho Saison |
|---|---:|---:|---:|
| hockey (alle 12) | **0,628** | 0,212 | 0,846 |
| hockey, nur Feldspieler | **0,673** | 0,145 | 0,818 |

**Das ist der Befund, der die Entscheidung trägt.** Die Wirkung wurde um rund zwei Drittel
zurückgenommen — und die Rangtreue kam **nicht** zurück: 0,628 statt 0,616 statt 0,669. Die
Einbuße skaliert also **nicht mit der Stärke der Faktoren**. Sie hängt daran, **dass**
Positionen und Zweikampfgewichte überhaupt verschoben werden: das ändert, wie oft
`versucheSteal` überhaupt aufgerufen wird, und damit die Zufallsbahn jedes folgenden
Ereignisses. Genau diese Kaskade hat schon den Zoneneintritt gekippt
(`hockey-zoneneintritt-umsetzung.md`). Eine Feinkalibrierung kann das nicht heilen, weil es
kein Kalibrierungsproblem ist.

Dazu kommt der zweite, unabhängige Grund: der Verbrauch hängt an der gelaufenen Strecke, und
die korreliert mit **LAUFTEMPO** (0,852) — einem Attribut, das auf der **Eignungsseite**
steht. Die Puste bestrafte damit teilweise genau das, wofür die Eignung bezahlt. Das ist ein
Vorzeichenfehler im Entwurf, kein zu großer Zahlenwert.

### 4.3 Die Entscheidung: die Puste wird sichtbar, nicht wirksam

`tempoMin`, `wuchtMin` und `zweikampfMin` stehen auf **exakt 1**. Damit ist jede
Multiplikation neutral (`x*1 === x` gilt in Gleitkomma exakt) und die Simulation **bitgleich**
zum Stand vor dieser Änderung. Was bleibt, ist alles Sichtbare: der Vorrat aus AUSDAUER, der
Verbrauch je gelaufenem Pixel, die Kosten des Bodychecks mit ihrem Kontrast-Term, die
Strafbank-Erholung, die Drittelpause, die Leiste am Spieler, die Spalten `Pus` und `Tief` im
Boxscore. Chris' „sowohl als auch" ist damit zur Hälfte erfüllt — **sichtbar ja, wirksam
noch nicht** — und das ist eine bewusste, gemessene Entscheidung, keine Auslassung.

**Warum nicht trotzdem ausliefern?** Weil Hockey mit 0,669 ohnehin die zweitschlechteste der
zwanzig Disziplinen ist und mit 0,616 bzw. 0,628 einen Tausendstel bzw. dreizehn Tausendstel
über der CI-Schranke landet. Eine Mechanik, die Spaß macht, aber die Rangtreue der schwächsten
Disziplin weiter drückt, kauft das Falsche mit dem Knappsten, was dieses Projekt hat.

**Was es bräuchte, um die Wirkung doch einzuschalten** — in dieser Reihenfolge, jeweils
einzeln gemessen:

1. Den Verbrauch **von LAUFTEMPO entkoppeln** (nicht je Pixel, sondern je Ereignis — Check,
   Schuss, Zweikampf), damit die Puste nicht mehr gegen die Eignung arbeitet.
2. Die Wirkung **nur auf Kanäle legen, die keine Positionen verschieben** (also `wucht`, nicht
   `tempo`), damit die `versucheSteal`-Kaskade unberührt bleibt.
3. Erst danach die Stärke kalibrieren — vorher ist jede Zahl geraten.

### 4.4 Hockey mit neutralisierten Faktoren — die Gegenprobe, und sie geht auf

| | rho je Spiel | Spannweite | rho Saison | Spannweite |
|---|---:|---:|---:|---:|
| Basislinie | 0,669 | 0,181 | 0,832 | 0,259 |
| **mit sichtbarer Puste** | **0,669** | **0,181** | **0,832** | **0,259** |
| Basislinie, nur Feldspieler | 0,719 | 0,182 | 0,818 | 0,259 |
| **mit sichtbarer Puste, nur Feldspieler** | **0,719** | **0,182** | **0,818** | **0,259** |

**Ziffernidentisch in allen vier Spalten, auf beiden Zeilen.** Das war vorher schon
bewiesen — `pusteFaktor(u,1)` ist `1 + 0·anteil`, und `x*1 === x` gilt in IEEE 754 ohne
Rundung, während kein Puste-Pfad einen `rr()`-Wurf zieht — aber ein Beweis, den man auch
messen kann, misst man.

### 4.5 Die Bahn behält ihre Wirkung — alle fünf bestehen

| Disziplin | Basislinie (Spiel/Saison) | jetzt | Boden | Abnahme |
|---|---|---|---:|---|
| staffel | 0,915 / 0,951 | **0,915 / 0,951** | 0,865 | bestanden, identisch |
| spurt | 0,871 / 0,905 | **0,871 / 0,905** | 0,800 | bestanden, identisch |
| takeshis-castle | 0,861 / 0,930 | **0,855 / 0,937** | 0,811 | bestanden |
| time-trial | 0,828 / 0,832 | **0,828 / 0,832** | 0,778 | bestanden, identisch |
| climbing | 0,790 / 0,851 | **0,791 / 0,860** | 0,732 | bestanden |

**Drei der fünf sind ziffernidentisch, und das ist kein Zufall, sondern die Bauart der
Zeile.** Erholt wird nur in drei Zuständen: am Hindernis (`u.huerde>0`), während des
Einbruchs (`u.leer`) und unter Plantempo (`1−ueber`). In Spurt, Staffel und Time-Trial läuft
das Feld über die kurze Distanz durchgehend auf Plantempo und bricht nicht ein — die
Gutschrift feuert dort schlicht nie. Bewegt hat sich genau dort etwas, wo Läufer wirklich an
Hindernissen stehen und leerlaufen: Takeshi (−0,006 / +0,007) und Climbing (+0,001 /
+0,009).

Beide Bewegungen liegen **weit innerhalb der Kader-Spannweite** (Takeshi 0,123 / 0,063,
Climbing 0,191 / 0,308) und sind nach `messgrundlage-kaderfest.md` von Null nicht zu
unterscheiden — diesmal in der Richtung, in der diese Regel gedacht ist: **es wird keine
Verbesserung behauptet.** Beide behalten komfortablen Abstand zu ihrem Boden (Takeshi 0,044,
Climbing 0,059).

### 4.6 Die Regeln, gegen die gemessen wird

1. **Basketball und Football müssen bit-identisch bleiben.** Beide fahren dasselbe
   Feldspiel-Chassis; die ganze Puste-Mechanik hängt an `art.puste`, das nur Hockey führt.
   Jede Abweichung dort ist ein Fehler, keine Kalibrierfrage.
2. **Hockey darf die CI-Schranke nicht reißen**: Basislinie 0,669, `schranke: 0.054`, also
   Boden **0,615**.
3. **Jede Bahn-Disziplin gegen ihre eigene Schranke**: staffel 0,915/0,050 · spurt
   0,871/0,071 · takeshis-castle 0,861/0,050 · time-trial 0,828/0,050 · climbing
   0,790/0,058.
4. Bewegt sich eine Zahl in die falsche Richtung, wird die betroffene Konstante für **diese**
   Disziplin abgeschaltet (die Mechanik ist je Disziplin über ein Rezeptfeld gegatet) und der
   Befund berichtet — nicht die Schranke nachgezogen.

---

## 5. Werkzeuge, die diese Runde dazugelegt hat

| Skript | Frage, die es beantwortet |
|---|---|
| `scripts/miss-hockey-puste.mjs` | Wie sieht der Puste-Haushalt im Eishockey aus, und hängt er an AUSDAUER oder am Zufall? |
| `scripts/miss-bahn-puste.mjs` | Wie viele Läufer brechen je Bahn-Disziplin ein, wie oft fangen sie sich wieder? |

Beide sind reine Messwerkzeuge über die schon vorhandenen `window.__arena`-Einstiegspunkte
(`feldspielProbe`, `bahnLauf`) und berühren den Motor nicht.

---

## 6. Was offen bleibt

- **Offene Frage 8 des Konzeptdokuments** (soll die Staffel wirklich beißen?) ist unbeantwortet;
  die Staffel bekommt in dieser Runde nur die Beschriftung und die Erholung, keinen neuen
  Haushalt.
- **Offene Frage 5** (der Check gewinnt den Puck heute in 77,4 % der Fälle, real deutlich
  seltener) ist unbeantwortet und ausdrücklich nicht Teil dieser Runde.
- **Offene Frage 9** (bekommen Basketball und Football die Leiste auch?) ist unbeantwortet;
  beide bleiben bit-identisch ohne Puste-Rezept.
- **Takeshis Hindernis-Balance** gehört der parallelen Runde. `pusteHindernis` ist additiv und
  muss auf deren Stand neu gemessen werden.
- **Die interaktive Pause** (Chris' separater Auftrag) ist der natürliche Ort, an dem die
  Drittelpausen-Gutschrift für den Spieler sichtbar und beeinflussbar wird — hier nur als Naht
  benannt, nicht entworfen.
