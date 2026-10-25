# Gewichtheben Sandsack Weg C — 6 gegen 6 PARALLEL an drei Stationen (05.10.)

**Status: reine Messvariante, kein Spielpfad, kein Bild.** Hinter
`BUEHNE_FLAGS.gewichthebenSandsack` 6 und 7, nur über die Messskripte erreichbar. Flag 0 (heute)
und 1 (Stufe 2, 2 gegen 2) sowie die sequentiellen Sechser-Varianten 2…5 sind bit-identisch
(Abschnitt 8).

Das vorige Sechser-Bild (`gewichtheben-sandsack-wegc-6v6-vergleich-05-10.md`) ließ die sechs
**nacheinander** tragen: ein Läufer trug nacheinander immer schwerere Säcke, die anderen standen
(45,5 % der Spieler ohne Sack). Chris hat das korrigiert:

> „6v6 muss funktionieren, ALLE sollen gleichzeitig aktiv sein! nicht nacheinander. Sie sollen
> sich dann nur aufteilen auf die Stationen. Zb sind die schwersten Säcke in Station 3 und da
> gehen zb die starken Spieler hin. Die leichten Säcke müssen vom Start also Station 1 bis zur
> Endstation getragen werden, die schweren von Station 3 nur bis zur Endstation."

Diese Runde baut genau das und misst es mit denselben Werkzeugen, Kadern, Saaten, Formkarten und
Mutatoren wie Stufe 2 und das sequentielle Sechser-Bild.

---

## 0. Ergebnis vorab

Kader-Familie `kaderfamilie-live-save.json` (5 Paarungen), n = 24 Spiele je Paarung, in Klammern
n = 48. Die Spalten links stammen aus den beiden Vorgänger-Dokumenten (gleiche Spiele), die
Hantel- und Stufe-2-Werte sind in dieser Runde nachgemessen und stimmen überein.

| Größe | Heute (sechs Duelle) | 2v2 (Stufe 2) | 6v6 sequentiell ×3 (verworfen) | **6v6 parallel** (Flag 6) | 6v6 parallel, Formel-Zuteilung (Flag 7) |
|---|---:|---:|---:|---:|---:|
| rho je Spiel, Median | 0,865 | 0,882 (0,864) | 0,596 (0,603) | **0,930 (0,922)** | 0,856 (0,866) |
| rho, schwächste Paarung | 0,805 | 0,679 | 0,472 | **0,810 (0,829)** | 0,782 (0,781) |
| rho Mortal Sin – Natures Wrath | 0,813 | 0,679 | 0,544 | **0,810 (0,829)** | 0,824 (0,827) |
| rho Saison, Median | 0,944 | 0,916 | 0,626 | **0,951 (0,944)** | 0,909 |
| 90-%-Bootstrap des Medians | — | [0,679; 0,931] | [0,472; 0,876] | **[0,810; 0,952]** ([0,829; 0,946]) | [0,782; 0,960] |
| Pp Strom 1 / 2, n = 24 (≤ 25) | 9,7 / 11,6 | 15,0 / 17,0 | 31,2 / 26,0 ✗ | **14,5 / 13,6** ✓ | 13,7 / 12,4 ✓ |
| Pp Strom 1 / 2, n = 48 | — | 16,0 / 19,6 | 29,7 / 24,6 | **14,4 / 14,2** ✓ | 14,4 / 11,7 ✓ |
| Spiel: eignungsstärkeres Team gewinnt | 80,0 % (80,4 %) | 75,8 % (77,5 %) | 60,0 % | **71,7 % (70,4 %)** | 75,8 % (76,7 %) |
| Sendezeit je Spiel (Fenster 2:30–4:00) | 7:11 | 3:04 (96,7 % im Fenster) | 8:22 (0 %) | **2:47 fest (100 %)** | 2:47 |
| Spieler-Spiele ohne einen Sack | — (jeder hebt) | 0 % | 45,5 % | **0 %** | 0 % |
| Säcke je Spieler und Spiel (Stationsmittel) | — | höchstens 4–5 (neun je Lauf und Paar) | 0–15 | **8–12** | 9–13 |
| Synthetische Kader-Familie (außerhalb der Kalibrierung), rho Median | 0,943 | 0,939 | 0,748 | **0,950** | 0,960 |

**Kurz:**

* **Die Grundidee trägt.** Parallel, Stationsaufteilung, Strecke nach Station: Das ist die erste
  Sechser-Fassung, die beide Pflichtabnahmen besteht. Sie liegt sogar über Stufe 2 und über der
  Hantel. rho 0,930 (n = 48: 0,922), Pp 14 auf beiden Strömen, niemand steht, die Sendezeit liegt
  fest im Fenster.
* **Die Problem-Paarung Mortal Sin – Natures Wrath steigt von 0,679 auf 0,810 (n = 48: 0,829)**
  und liegt damit auf Hantel-Niveau (0,813). Sie ist weiter die schwächste Paarung, aber über der
  Schranke.
* **Aber nicht aus dem vermuteten Grund.** Die Stationsaufteilung gibt power **keinen**
  abgegrenzten Kanal: Pp power liegt bei +4 (Stufe 2: −1). Gewirkt haben drei andere Dinge, alle
  gemessen (Abschnitt 5):
  1. Jeder trägt die ganze Zeit (8–12 Säcke statt 4–5).
  2. Niemand muss Lasten weit über seiner Kapazität tragen; das behebt Velza, nicht Grimflora.
  3. Eine **neue Spielerwertung** (Schicht-Inversion) macht die Stationen untereinander
     vergleichbar. Ohne sie lag die parallele Fassung bei 0,729 bis 0,775.
* **Die Schwachstelle ist die Mannschaftsebene:** Das eignungsstärkere Team gewinnt nur 70–72 %
  (Hantel 80 %). Station 3 liefert 58 % des Silos. Wer zwei echte Kraftpakete hat, gewinnt fast
  sicher; Natures Wrath (Buttercup LAST 99) schlägt Mortal Sin 24 von 24. Andere Wertungen
  bringen 75–77 % (Abschnitt 6).
* **Die Zuteilung ist eine echte taktische Wahl:** Im direkten Duell gewinnt die Seite mit
  Formel-Zuteilung deutlich häufiger (Abschnitt 3). Als Standardregel reicht „nach LAST
  sortiert“. Eine Manager-Wahl lohnt sich, kostet aber Rangtreue, wenn sie benutzt wird.

---

## 1. Chris' Bild und die Annahmen

Chris' Satz legt fünf Dinge fest: alle gleichzeitig, Aufteilung auf Stationen, Station 3 hat die
schwersten Säcke, starke Spieler gehen dorthin, und die Strecke hängt an der Station (Station 1 bis
zum Ende, Station 3 nur das letzte Stück). Alles Weitere ist **Annahme dieser Runde**. Jede ist
begründet, keine war vorgegeben.

| # | Annahme | Begründung | Alternative, nicht gebaut |
|---|---|---|---|
| A1 | **Eine gerade Bahn**: Start = Station 1 — Station 2 — Station 3 — Silo, je 8 m Abstand. Tragestrecke 24 / 16 / 8 m. | Das sind exakt die Paket-1-Strecken (24/16/8). Sie bekommen damit zum ersten Mal eine zusammenhängende Geometrie, die Chris' Satz wörtlich abbildet. | ungleiche Abstände |
| A2 | **Eine feste Sackklasse je Station**: 35 / 80 / 115 kg. Nichts steigt mit der Zeit. | Chris: „die schwersten Säcke in Station 3“. Die Zahlen sind **kalibriert**, nicht vorgegeben (Abschnitt 4). 115 kg liegt über dem schwersten Paket-1-Sack (105). | gemischte Säcke je Station |
| A3 | **Zwei Spieler je Station**, beide gleichzeitig, **jeder auf eigener Spur vom eigenen Stapel**. Kein Warten, kein Wechsel, keine Staffel. | „ALLE sollen gleichzeitig aktiv sein“. Ist einer der beiden deutlich stärker, trägt er einfach mehr in derselben Zeit. Beide Spuren sind voneinander unabhängig. | gemeinsamer Stapel je Station (dann wartet einer) |
| A4 | **Eine Schicht mit festem Zeitfenster, 150 s.** Jeder trägt in Zyklen: Sack holen → zum Silo → zurück → nächster Sack. Ein Sack zählt, wenn er vor der Schlusshupe im Silo liegt. | „bis Zeitlimit“ statt „bis alle Säcke verladen“: Mit festen Stapeln stünde, wer seinen Stapel leer hat (Widerspruch zu „alle aktiv“), und die langsamste Station allein entschiede. Das Zeitfenster gibt jedem dieselbe Zeit und macht die Sendezeit fest. | feste Stapel, „wer zuerst alles verladen hat“ |
| A5 | **Mannschaft: mehr kg im Silo gewinnt** (dann mehr Säcke, dann Los). Eine Schicht = ein Spiel. | Das Silo ist Chris'/Fables Bild, kg ist die Paket-1-Medley-Größe. Folge: Station 3 macht 58 % des Silos (Abschnitt 6). | Säcke zählen, kg·m, Arbeitswert (gemessen, Abschnitt 6) |
| A6 | **Am Silo wird jeder Sack gewuchtet** (Kantenzuschlag für alle, es ist derselbe Silo). Doppeln (zwei Säcke auf einmal) wie Paket 1 nur an Station 1/2. | Der Silo ist für alle gleich. Doppeln ist der ANSAGE-Kanal an den leichten Stationen. Ohne Doppeln fällt rho von 0,930 auf 0,868. | |
| A7 | **Stationszuteilung nach LAST** (Flag 6): die zwei mit dem höchsten LAST an Station 3, die nächsten zwei an Station 2, der Rest an Station 1. | Chris: „da gehen zb die starken Spieler hin“. LAST ist das Sub-Skill, das heute die Traglast K = 30 + 1,3·LAST bestimmt (power 60, health 25, determination 15). | Formel-Zuteilung (Flag 7), Persönlichkeit |
| A8 | **Der Lastenplan nach Persönlichkeit** (Staffel/Stationen/Anker, Paket 1, Chris' Antwort 4) **entfällt** in diesem Format. | Die drei Pläne regeln, wer wann trägt, wenn nicht alle gleichzeitig tragen. Das gibt es hier nicht mehr. Siehe offene Frage 7.3. | „Ego beansprucht Station 3“ |

---

## 2. Die Mechanik

Alles in `public/mockups/battle-mode.engine.js`, Block „WEG C PARALLEL“ direkt nach
`baueSandsack6v6()`. Einstieg ist `baueSandsackParallel()`. `bauBuehne()` ruft ihn bei Flag ≥ 6
statt der Hantel auf.

**Wiederverwendet, unverändert:** `sandsackGang()` (Gangzeit und Rutscher, mit eigenem
Konstantensatz `k` wie Stufe 2), die Paket-1b-Formeln für Pause, Erschöpfung und Doppeln, die
Paket-1b-Werte für K_LAST, Wagnis-Flex, Leertempo, Biss und Rutscher, und
`sandsackWegCRefProfil()` (Referenzträger mit allen fünf Sub-Skills = v).

**Neu:**

* `sandsackParSchicht(u, station, wurfVon, zeitfenster)`: eine Schicht für **einen** Träger auf
  seiner Spur. Die Reihenfolge ist dieselbe wie in `sandsackSeiteLauf()`: Pause vor dem Gang →
  Doppeln → Gang → Erschöpfung danach. Neu ist der Zeitpunkt `ablieferung` (Gang ohne Rückweg).
  Nur Säcke mit `ablieferung ≤ zeitfenster` zählen. Erholung kommt nur aus dem Rückweg und aus
  Pausen; es gibt keinen ruhenden Partner mehr.
* `sandsackParWuerfe(saat, seite, platz)`: **Falle 17** wie Paket 1, je Seite und
  Aufstellungsplatz eine feste Folge nach Sack-Index aus eigenem Saatstrom. Kein `rr()`. Doppeln
  verbraucht zwei Indizes und verschiebt nichts.
* `sandsackParZuteilung(u6, modus)`: LAST-Regel oder Formel (Abschnitt 3).
* `sandsackParNote()`: der Spielerwert, siehe unten.
* `SANDSACK_PAR_KONF`: die Hebel. Erreichbar nur über `window.__arena.sandsackParKalib()` oder
  `window.__olySandsackParKalib` vor dem Laden (Messläufe), nie im Spiel.

### 2.1 Der Spielerwert: Schicht-Inversion statt Gang-Inversion

`u.summe` (das, was `wert()` liest) = Tragenote × 10, wie in Stufe 2. Die **Tragenote** ist
aber anders gerechnet. Stufe 2 invertiert **je Gang**: Bei welcher Stufe v bräuchte ein
Referenzträger für genau diese Last so lange? Danach wird über die Gänge gemittelt. Das setzt
voraus, dass jeder Spieler leichte und schwere Lasten sieht. Das stimmt in 2v2, wo jeder an allen
drei Stationen trägt, aber nicht mehr, wenn jeder nur an **einer** Station trägt.

Gemessen mit den Startwerten (Abschnitt 4): Innerhalb jeder Station ordnete die Gang-Note richtig
(rho innerhalb 0,87–0,91), über die Stationen hinweg nicht (0,729). Eine Regression der Note auf
die fünf Sub-Skills zeigte den Grund:

* An Station 1 zählte ANSAGE fast doppelt so viel wie in der Eignung. Der Spieler doppelte, die
  Referenz in der Gang-Inversion doppelt nie.
* An Station 2 war die Note zusammengedrückt (LAST 0,43, ANSAGE 0,31).

Jede Station hatte also einen anderen Maßstab.

**Schicht-Inversion** (`noteModus 1`, Standard für Flag 6/7): n = die abgelieferten Säcke des
Spielers, t_n = der Moment, in dem sein n-ter Sack im Silo lag. Die Note ist die Stufe v, bei der
ein Referenzträger an **derselben Station** unter **denselben Regeln** seinen n-ten Sack ebenfalls
zum Zeitpunkt t_n im Silo hätte. Die Referenz doppelt selbst, pausiert selbst und ermüdet selbst.
Bisektion über v ∈ [0; 100], 20 Schritte, deterministisch (ohne Rutscher).

Mit der Endkalibrierung messen danach alle drei Stationen fast mit demselben Maßstab
(Probe-Abschnitt 5, OLS über 1440 Spieler-Spiele):

| | LAST | TECHNIK | NERVEN | ANSAGE | ERHOLUNG | R² |
|---|---:|---:|---:|---:|---:|---:|
| Eignung | 0,535 | 0,104 | 0,143 | 0,462 | 0,038 | 0,952 |
| Note Station 1 | 0,483 | 0,125 | 0,044 | 0,341 | −0,006 | 0,918 |
| Note Station 2 | 0,514 | 0,063 | 0,100 | 0,320 | 0,049 | 0,973 |
| Note Station 3 | 0,499 | 0,078 | 0,218 | 0,222 | 0,066 | 0,936 |

Dieselbe Kalibrierung mit Gang-Inversion ergibt 0,775 statt 0,930. Die Schicht-Inversion ist
damit der größte Einzelhebel dieser Runde.

---

## 3. Team-Taktik: Standardregel oder Manager-Wahl?

**Flag 6, Standardregel:** nach LAST sortiert, die Stärksten an Station 3. Das ist Chris' Satz
fast wörtlich. Einfach, für den Zuschauer lesbar („die Kraftpakete hinten am Silo“), und die
Fassung mit der besten Rangtreue.

**Flag 7, „Manager rechnet“:** Von allen 90 Aufteilungen 2/2/2 wird die mit der höchsten
erwarteten Silo-Menge gewählt (dieselbe Formel, ohne Rutscher). Das ist die Obergrenze dessen, was
eine Taktikwahl herausholen kann. Sie bringt +6 % Silo-kg (5084 statt 4796 je Seite, n = 48).

**Bringt die Wahl im direkten Duell etwas?** Gemessen mit n = 48, nur eine Seite wechselt auf
Formel (`--kalib=zuteilungHeim:2` bzw. `zuteilungGast:2`):

| Heimsiege (von 48) | beide LAST-Regel | Heim Formel | Gast Formel |
|---|---:|---:|---:|
| vigilante – armageddon | 48 | 48 | 48 |
| coldsteel – direlegion | 40 | **48** | **27** |
| goldengladiators – silversoldiers | 1 | **14** | 1 |
| mortalsin – natureswrath | 0 | 0 | 0 |
| piratecrew – raginglunatics | 0 | 0 | 0 |
| **gesamt** | 89 | **110** | 76 |

In engen Paarungen entscheidet die Zuteilung das Spiel. Bei klaren Kräfteverhältnissen ändert sie
nichts.

**Einschätzung:** Für jetzt reicht die Standardregel (Flag 6). Eine Manager-Wahl wäre
spielerisch sinnvoll, weil sie im direkten Duell 13 bis 21 von 240 Spielen dreht. Aber:

* Wird die Formel-Zuteilung benutzt, sinkt rho von 0,930 auf 0,856. Die Stationen bekommen dann
  Träger mit sehr unterschiedlicher relativer Last, und der gemeinsame Maßstab aus 2.1 hält
  weniger gut (Diagnose „eigene Station“ 0,862 statt 0,917).
* Eine Manager-Wahl müsste deshalb mit gemischten Wahlen beider Seiten neu abgenommen werden.

Ich würde sie erst bauen, wenn Chris das Format grundsätzlich will.

---

## 4. Kalibrierverlauf

Gemessen mit `miss-sandsack-wegc-parallel.mjs 24 --kalib=…` und einer Diagnosesonde, Median über
die fünf Paarungen, Flag 6.

| Schritt | rho Median |
|---|---:|
| Startwerte: 35/55/85 kg, Gang-Inversion, Erschöpfung ×0,5 | 0,729 |
| Sackklassen allein variiert (12 Kombinationen, Gang-Inversion) | 0,695–0,762 |
| + Schicht-Inversion | 0,794 |
| + Erschöpfung ×0,25, 35/70/100 kg | 0,880 |
| **+ Erschöpfung ×0,15, 35/80/115 kg (Stand)** | **0,930** |
| dasselbe ohne Erschöpfung (×0) | 0,893 |
| dasselbe ohne Doppeln | 0,868 |

Gewählt wurde nach rho; Pp war bei allen Kandidaten unkritisch (12–15).

* **Erschöpfung ×0,15:** Die Paket-1b-Formel ist für einen Gang je 15 Säcke gebaut. Hier trägt
  jeder 150 s ununterbrochen. Mit ×0,5 gab es 2,4 Pausen je Spieler und Schicht, und ERHOLUNG
  drückte die Note (Startwerte; Sunny, ERHOLUNG 32: 7 Pausen). Mit ×0,15 sind es 0,4 Pausen je Spieler (4,8 je
  Schicht), also ein seltenes, sichtbares Ereignis. Ganz ohne Erschöpfung (×0) fällt rho auf
  0,893.
* **Schwere Stationen 2 und 3 (80/115):** Die Note trennt am besten, wenn die Last für die dort
  eingeteilten Träger nahe an deren Kapazität liegt. Relative Last r = kg/K beim mittleren LAST
  der Station (45 / 61 / 82): Station 1 0,40, Station 2 0,73, Station 3 0,84.
* **Überanpassung ausgeschlossen, soweit messbar:**
  * Gewählt wurde auf denselben 120 Spielen, die n = 24 misst. Die 120 zusätzlichen Spiele von
    n = 48 halten den Wert (0,922, schwächste 0,829).
  * Die synthetische Kader-Familie mit anderen Spielern, die nie in die Wahl einging, liefert
    0,950 (Hantel 0,943, Stufe 2 0,939).
  * Pp auf beiden Strömen 14.

Pp-Profil (Flag 6, n = 48, Strom 1 / Strom 2):

| Attribut | Strom 1 | Strom 2 | Matrix | Stufe 2 (Strom 1, n = 48) |
|---|---:|---:|---:|---:|
| power | 32,3 % | 31,8 % | 28 | 26,2 % |
| charisma | 21,6 % | 21,1 % | 23 | 28,3 % |
| health | 18,3 % | 18,6 % | 16 | 15,6 % |
| determination | 8,4 % | 8,7 % | 12 | 8,3 % |
| will | 7,2 % | 7,3 % | 7 | 6,6 % |
| speed | 4,9 % | 5,1 % | 6 | 7,4 % |
| dexterity | 4,8 % | 5,0 % | 6 | 7,3 % |
| stamina | 2,3 % | 2,4 % | 2 | 0,3 % |

Die Charisma-Überzeichnung aus Stufe 2 (+5 bis +8) ist weg. Dafür ist power leicht überzeichnet
(+4). determination bleibt untergewichtet (−3,5), weil LAST den Wert über power 60 / health 25 /
determination 15 liest.

---

## 5. Die Hypothese „power bekommt einen eigenen Kanal“ — gemessen

Die Vermutung im Auftrag: Die Stationsaufteilung gibt POWER einen abgegrenzten Kanal (schwere
Station, kurze Strecke), statt es über das ganze Rennen dominieren zu lassen, und schließt so die
Validitätslücke (LAST zählt mehr, als die Matrix power gewichtet).

**Das stimmt so nicht.** Drei Messungen:

1. **power ist nicht eingegrenzt:** Pp power +4 (Stufe 2: −1,8 / −0,3). Die Stationsnoten laden
   alle mit rund 0,5 auf LAST (Tabelle 2.1), auch Station 1.
2. **Die Aufteilung selbst bringt keine Rangtreue, sie kostet aber auch keine.** Dieselbe
   Schicht-Note, deterministisch, einmal an der eigenen Station, einmal für alle an derselben:

   | | rho Median |
   |---|---:|
   | eigene Station (LAST-Regel) | 0,917 |
   | alle an Station 1 | 0,847 |
   | alle an Station 2 | 0,878 |
   | alle an Station 3 | 0,923 |

3. **Der Rang steht nicht schon vor der Schicht fest.** rho zwischen Eignung und Stationsrang
   allein liegt bei 0,413. Beim sequentiellen „alle tragen“ waren es 0,718 (Vorgänger-Dokument,
   Abschnitt 3). Die Rangtreue kommt hier aus dem Tragen, nicht aus der Sortierung.

**Was stattdessen wirkt** (Mortal Sin – Natures Wrath, Mittel über 24 Spiele, Wert = Note × 10):

| Spieler | Eig | LAST | Wert 2v2 | Wert parallel | Station |
|---|---:|---:|---:|---:|---:|
| Buttercup | 59,7 | 99 | 695 | 668 | 3 |
| Faith | 51,5 | 39 | 511 | 549 | 2 |
| Marin Solis | 48,0 | 47 | 525 | 522 | 2 |
| Velza | 43,2 | 22 | **287** | **403** | 1 |
| Grimflora | 40,7 | 79 | 512 | 495 | 3 |
| Falcon | 26,1 | 20 | 217 | 326 | 1 |

* **Velza ist behoben.** In 2v2 trägt jeder auch an der Ladekante (65–105 kg, für Velza mit
  LAST 22 bis r ≈ 1,8, hoffnungslos). Hier trägt
  sie 35 kg an Station 1, eine Last nahe ihrer Kapazität, an der ihre übrigen Stärken (NERVEN 83,
  ANSAGE 76) sichtbar werden.
* **Grimflora ist nicht behoben.** LAST 79 bei Eignung 40,7, und seine Note liegt weiter rund
  9 Punkte über der Eignung. Er steht richtig hinter Faith und Marin Solis; die einzige
  Vertauschung im Team ist die mit Velza (Eignung 43,2 gegen 40,7).
* Die Paarung hebt sich vor allem, weil die Schwachen nicht mehr an unmöglichen Lasten gemessen
  werden, und weil jeder 8–12 Säcke statt 4–5 trägt (Rauschen kostet fast nichts mehr:
  deterministisch 0,917, mit Rutschern 0,930).

**Fazit:** Die Grundidee verbessert rho und Pp messbar, aber über „jeder an einer Last, die er
tragen kann, die ganze Zeit lang“, nicht über einen abgegrenzten power-Kanal. Die eigentliche
LAST-Lücke (hohes LAST, wenig Charisma wird überschätzt) bleibt. Sie wird in diesem Kader nur
nicht mehr ranggebend.

---

## 6. Mannschaftsebene und Ablauf

| Größe (Flag 6, n = 24) | Wert |
|---|---:|
| Säcke je Schicht (beide Seiten) | 120,8, je Spieler 8–12 |
| Silo je Seite | 4814 kg, davon Station 1 15 %, Station 2 27 %, Station 3 58 % |
| Rutscher je Schicht | 9,1 (je Spieler 0,2 an Station 1 bis 1,5 an Station 3) |
| Pausen je Schicht | 4,8 (Station 1 praktisch keine, Station 2/3 je 0,6 je Spieler) |
| Doppel-Gänge je Schicht | 3,6 (nur Station 1) |
| Spiegeltest (`miss-arena-buehne-spiegel.mjs 1000`) | Heim 505 · Gast 495 · Remis 0, Abweichung 2,0 % |

**Mannschaft:** Das eignungsstärkere Team gewinnt 71,7 % (n = 48: 70,4 %). Hantel auf denselben
Spielen 80,0 %, Stufe 2 75,8 %. Station 3 macht 58 % des Silos, und das Ergebnis je Paarung ist
fast fest: Vigilante 24/24, Natures Wrath gegen Mortal Sin 24/24 (Mortal Sin hat keinen Spieler
über LAST 49 und muss zwei davon an die 115-kg-Säcke stellen). Das ist dieselbe Umkehr wie in
Paket 1/1b.

Andere Wertungen, auf denselben Spielen nachgerechnet (nur Diagnose, nicht gebaut):

| Mannschaftswertung | eignungsstärkeres Team gewinnt (n = 48) |
|---|---:|
| Silo-kg (Stand) | 70,4 % |
| Säcke | 75,4 % |
| kg·m (Gewicht × Strecke) | 77,1 % |
| Arbeitswert (Sack = Sekunden, die ein 50er an dieser Station je Sack braucht) | 75,0 % |
| Hantel, sechs Duelle | 80,4 % |

Keine Wertung erreicht die Hantel. Eine einzige Schicht ist eben nur **ein** Vergleich zweier
Teamsummen. Sechs Duelle sind sechs. Die Frage, wie das Silo zählt, ist eine Design-Entscheidung
für Chris (7.2).

**Sendezeit:** fest 150 s Schicht + 8,7 s Überleitung + 8 s Rahmen = **2:47**, jedes Spiel im
Fenster. Die Überleitungen sind dieselbe Schätzung wie in Stufe 2.

---

## 7. Offen und unsicher

1. **Die Sackklassen 35/80/115 und die Erschöpfung ×0,15 sind kalibriert, nicht vorgegeben.**
   115 kg liegt über dem bisher schwersten Sack (105). Das Optimum ist ziemlich scharf: 35/70/100
   mit ×0,25 ergibt 0,880, 35/55/85 mit ×0,5 nur 0,794. Gegen eine andere Kader-Familie hält es
   (synthetisch 0,950), aber fünf echte Paarungen bleiben wenig.
2. **Mannschaftsebene 70–72 %, unter Hantel und Stufe 2.** Ob das Silo nach kg, Säcken oder
   Arbeitswert zählt, ist Chris' Entscheidung; gemessen sind alle drei (Abschnitt 6).
3. **Persönlichkeit / Lastenplan (Chris' Antwort 4 aus Paket 1) kommt in diesem Format nicht mehr
   vor.** Naheliegende Übertragung, nicht gebaut: Ein Ego-Spieler beansprucht Station 3, auch wenn
   er dort nicht hingehört (der „Preis des Egos“). Das wäre eine eigene Messrunde (rho würde
   sinken, wie bei Flag 7).
4. **Manager-Wahl der Zuteilung:** sinnvoll, aber mit rho-Kosten (Abschnitt 3). Sie müsste mit
   gemischten Wahlen neu abgenommen werden.
5. **„Bis alle Säcke verladen“** (feste Stapel je Station) ist nicht gebaut. Begründung in A4: Es
   ließe Spieler stehen und die langsamste Station allein entscheiden. Wenn Chris genau das meinte,
   wäre es die nächste Variante.
6. **Kein Bild.** Die Paket-2-Szene kennt nur das sequentielle 15-Sack-Rennen. Zwölf gleichzeitig
   laufende Träger auf drei Spuren je Seite sind eine eigene Präsentationsaufgabe (Stufe 3). Die
   Boxscore-Felder `lastKg/lastSaecke/lastRutscher/lastPausen/lastDoppelt/tragenote/parStation`
   liegen bereit.
7. **Die Grimflora-Lücke** (hohes LAST, wenig Charisma wird überschätzt) ist nicht geschlossen,
   nur in diesem Kader nicht mehr ranggebend (Abschnitt 5).

---

## 8. Isolation, Befehle, Dateien

**Isolation:** SHA-256 über `spieleBuehneHeben`, `spieleSandsackFinale` und
`spieleSandsackWegC` (Flag ≥ 1), 5 Paarungen × 4 Saaten, je Flag 0–5. Gemessen vor und nach allen
Änderungen: identisch. `miss-alle-disziplinen.mjs 24 gewichtheben` liefert unverändert 0,865
(Flag 0), 0,882 (Flag 1) und 0,596 (Flag 2).

**Befehle:**

```
node scripts/miss-sandsack-wegc-parallel.mjs 24 [--varianten=6,7] [--kalib=schluessel:wert,...]
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --flags=gewichthebenSandsack:6 --bootstrap-unsicherheit
node scripts/messe-arena-einfluss.mjs gewichtheben 24 --flags=gewichthebenSandsack:6 [--saat-versatz=10000000]
OLY_KADER_FAMILIE=/nicht-vorhanden node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --flags=gewichthebenSandsack:6
node scripts/miss-arena-buehne-spiegel.mjs 1000 gewichtheben --flags=gewichthebenSandsack:6
```

Der Messkopf `--kalib=zuteilungHeim:2` (bzw. `zuteilungGast:2`) misst das direkte Duell
Formel gegen LAST-Regel. Für eine Pp-Messung mit anderer Kalibrierung braucht es eine Kopie von
`battle-mode.html`, die vor der Engine `window.__olySandsackParKalib={…}` setzt; der Pfad zur Kopie
ist der dritte Positionsparameter von `messe-arena-einfluss.mjs`.

**Dateien:**

* `public/mockups/battle-mode.engine.js`:
  * Block „WEG C PARALLEL“ nach `baueSandsack6v6()`: `SANDSACK_PAR_KONF`,
    `sandsackParStationen`, `sandsackParWuerfe`, `sandsackParSchicht`, `sandsackParNote` und
    `…NoteSchicht`, `sandsackParZuteilung`, `baueSandsackParallel`;
  * der Zweig für Flag ≥ 6 in `bauBuehne()`;
  * `window.__arena.sandsackParKalib()`;
  * die Boxscore-Felder `parStation`/`parSoloNoten` in `spieleSandsackWegC()`;
  * die Flag-Liste im Kommentar zu `BUEHNE_FLAGS`.
* `scripts/miss-sandsack-wegc-parallel.mjs`: die Vergleichssonde (rho je Paarung, Diagnosen
  Wert = kg / Stationsrang / alle an einer Station, Stationsprofile, OLS je Station,
  Mannschaftswertungen, Mortal Sin je Spieler).
* Dieses Dokument.

---

## 9. Fortsetzung: Entscheidungen je Träger (Flag 8)

Chris hat das Format am selben Tag ergänzt: Ablegen an der Station mit kurzer Rast,
Durchpowern oder Direktübergabe an den Verbündeten. Gebaut und gemessen als Flag 8 in
`gewichtheben-sandsack-wegc-parallel-entscheidungen-05-10.md`. Die Zweier an Station 1/2 bilden
dort eine Kette mit Ablage an der nächsten Station, Station 3 bleibt wie hier.

Ergebnis (n = 24, in Klammern n = 48):

* rho 0,883 (0,886), schwächste Paarung 0,802 (0,813).
* Pp 14,0 / 13,5 (9,8 / 13,3).
* Sendezeit fest 2:47, Pausen 4,55 statt 4,83 je Schicht.
* KI-Vorgabe normal / durch / direkt 39 / 41 / 20 %.

Flag 6 bleibt bit-identisch.

**Flag 9 (alle sechs entscheiden):** Station 3 bekommt eine eigene Zweier-Kette mit Übergabe am
Rampenfuß, 6 m nach dem Stapel und 2 m vor dem Silo. Die 115-kg-Säcke wechseln nur zwischen den
beiden an Station 3. Das ergibt rho 0,869 (0,874), schwächste Paarung 0,805 (0,802) und Pp
10,8 / 12,0. Keine einzige Sackklasse wird vermischt (0 von 2880 Spieler-Spielen). Die Mitte (4 m)
scheitert. Details im Dokument zu den Entscheidungen, Abschnitt 10. Flag 6 und 8 bleiben
bit-identisch.

**Flag 10 (freie Stationswahl):** Jeder der sechs kann nach jedem Zyklus an jede Station wechseln,
KI nach awareness („Auffassungsgabe"), Fußweg zwischen den Stapeln. Ohne Gegengewicht läuft die
Mannschaft bei Silo-kg zu Station 3; Flag 10 wertet nach Arbeitswert (Abschnitt 6 hier). rho 0,849
(0,842), schwächste Paarung 0,825 (0,828). Details in
`gewichtheben-sandsack-wegc-freie-stationswahl-05-10.md`. Flag 6…9 bleiben bit-identisch.
