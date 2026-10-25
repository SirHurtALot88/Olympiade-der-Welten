# Gewichtheben Sandsack Weg C — Stufe 2: die Format-Mechanik (05.10.)

**Status: gebaut, gemessen, hinter einem Schalter, standardmäßig AUS.** Mit
`BUEHNE_FLAGS.gewichthebenSandsack = 1` ersetzen drei Sandsack-Läufe die sechs Hantel-Duelle
vollständig. Bei 0 (Standard, jeder echte Spielstand) läuft Gewichtheben bit-identisch wie
vorher (Abschnitt 5). Stufe 3 ist **nicht** Teil dieser Runde und wurde nicht angefasst:
Boxscore, HUD, Kaderbildschirm, Bühnenbild der Läufe, die Sonden-Skripte,
`ARENA_RESOLVED_DISCIPLINE_IDS`.

Grundlage ist Chris' Freigabe von **Weg C — „Rennen ist das neue Gewichtheben"**
(`gewichtheben-sandsack-rennen-fable-praesentation-03-10.md` Abschnitt 8). Festgelegt sind
damit drei Läufe statt sechs Duelle und eine Zielgesamtdauer von 2:30 bis 4:00. Dazu kommen
die halbe Bahnbreite, drei Stationen mit Steg und ein vorzeitiger Schluss bei uneinholbarem
Vorsprung. Wiederverwendet wurde die Mechanik aus Paket 1/1b
(`…-paket1-umsetzung-03-10.md`, `…-paket1b-kalibrierung-04-10.md`).

---

## 0. Ergebnis vorab

| Größe | Heute (sechs Duelle) | Weg C (drei Läufe) | Schranke |
|---|---:|---:|---|
| rho je Spiel, Median (n=24) | 0,865 | **0,882** | > 0,80 ✓ |
| Spannweite über die 5 Paarungen (n=24) | 0,143 | 0,253 | — (doppelt so breit, s. 7.2) |
| rho Saison (n=24) | 0,944 | 0,916 | — |
| rho je Spiel, Median (n=48) | — | **0,864** (Spannweite 0,235) | > 0,80 ✓ |
| rho je Spiel, 4 je Seite (n=24) | 0,788 | **0,860** | |
| rho je Spiel, 2 je Seite (n=24) | 0,650 | 0,758 | (bei Hantel und Weg C knapp/durchgefallen) |
| Pp-Abweichung n=24, Strom 1 / 2 | 9,7 / 11,6 | **15,0 / 17,0** | ≤ 25 ✓ |
| Pp-Abweichung n=48, Strom 1 / 2 | 8,5 / 10,0 | **16,0 / 19,6** | ≤ 25 ✓ |
| Sendezeit je Spiel, Median (90 %-Wert, Maximum) | 7:11 | **3:04** (3:46, 4:09) | 2:30–4:00, 96,7 % im Fenster |
| Laufsieg: Paar mit höherer Eignung gewinnt | — | 88,0 % | |
| Spielsieg: Team mit höherer Eignung gewinnt | 80,0 % | 75,8 % | — (dieselben 120 Spiele, s. 7.4) |
| Flag aus: alle 20 Disziplinen gegen Basis `bf1403e4` | — | Ausgabe identisch (20/20) | bit-identisch ✓ |

**Kurz:** Beide Pflichtabnahmen sind bestanden, rho mit Vorrang und klar über der Schranke. Die
Gesamtdauer liegt im Zielfenster. Ehrlich dazu: Weg C ist validitätsseitig nicht sauberer als
die Hantel. Pp ist schlechter (15–20 statt 9–12), die Paarungsspannweite fast doppelt so breit.
Eine Paarung (Mortal Sin – Natures Wrath) liegt mit 0,68 klar unter der Schranke (7.2). Auf
Mannschaftsebene gewinnt das eignungsstärkere Team etwas seltener als heute (75,8 statt 80,0 %
auf denselben Spielen, 7.4). Und der vorzeitige Schluss ist nur in einer **eingeschränkten**
Form mit der Einzelspiel-Rangtreue vereinbar (Abschnitt 3.5, 6.2). Das ist die zweite Stelle, an der Chris widersprechen könnte.

---

## 1. Was vorher da war (gelesen, nicht neu erfunden)

* **Sechs Hantel-Duelle** (`baueHebenDuelle()`): Slot i gegen Slot i, `HEBEN_ROLLEN` in der
  Reihenfolge Power Opener, Safe Lift, Pressure Lift, Technical Lift, Grip Anchor, Final
  Attempt. Spielerwert `u.summe` = eigene Zweikampf-kg, Mannschaftsergebnis `seiten` =
  gewonnene Duelle, bei 3:3 der Gesamt-kg-Tiebreak.
* **Paket 1/1b** (additiv, nie verdrahtet): EIN Mannschaftsrennen mit allen sechs, 15 Säcke,
  drei Stationen, volle Strecke. Der Lastenplan Anker/Stationen/Staffel kommt aus der
  Persönlichkeit (PERSZIEL/PERSDEF, Teamwert ≥ 0,60 Staffel, ≤ 0,40 Anker). Gemessen wurde auf
  **Teamebene**: Rennzeit gegen Eignungssumme, Pp 19,3/22,7, Team-Validität 0,794.
  `sandsackSeiteLauf()` ist für genau diese 15 Säcke gebaut.
* Die Pflichtabnahme der Disziplin liest dagegen **den Spielerwert je Spieler** (`wert()`).
  Paket 1 hatte keinen Spielerwert, und sein Teampunkt war für `einflussVon` blind. Für Weg C
  gilt das nicht mehr: Das Rennen ist jetzt die ganze Disziplin, also muss aus ihm ein
  Spielerwert entstehen, der die Rangtreue trägt.

---

## 2. Die Kernfrage: wie aus sechs Duellen drei Läufe werden

### 2.1 Die Optionen

| | Aufteilung | Wer trägt | Spielerwert | Taktik |
|---|---|---|---|---|
| **A (gebaut)** | **Zwei gegen zwei je Lauf, Paare über den Slot**: Lauf 1 = Slots 1+2 (Power Opener, Safe Lift), Lauf 2 = 3+4 (Pressure, Technical), Lauf 3 = 5+6 (Grip Anchor, Final Attempt) | jeder der sechs in genau einem Lauf, an **jeder** Station | aus den eigenen Gängen | Paar-Plan aus der Persönlichkeit (Staffel / Stationen / Anker) |
| B | dreimal ein Mannschaftslauf mit allen sechs (Paket-1-Rennen ×3) | Anker: **einer**; Stationen: **drei**; Staffel: sechs | für Nicht-Träger leer | die volle Paket-1-Taktik |
| C | je Lauf zwei Einzelrennen parallel (vier Bahnen), 1 gegen 1 wie heute | jeder allein über alle Säcke | am saubersten | **keine** — Chris' Lastenplan entfällt |
| D | je Lauf eine Sechser-Staffel, je Station ein Paar | jeder nur an **einer** Station | stationsabhängig | Staffel fest |

### 2.2 Warum B und D ausscheiden — gemessen, nicht vermutet

**B** scheitert an der Einzelspiel-Rangtreue, und zwar schon strukturell. Im bestehenden
Paket-1-Rennen (unverändert, dieselbe Kader-Familie, 24 Spiele je Paarung, gemessen mit
`miss-sandsack-wegc.mjs` Abschnitt 5 am additiven Finale hinter den Hantel-Duellen) tragen
**45,6 % aller Spieler-Spiele keinen einzigen Sack**. Beim Anker-Plan tragen fünf
von sechs nichts, bei Stationen drei von sechs. Wer nichts trägt, hat keinen Spielerwert, und
rho misst Nullen gegen Eignung. Dreimal dasselbe Rennen hilft nicht, denn der Plan hängt an
der Persönlichkeit und bleibt in allen drei Läufen derselbe.

**D** war die erste gebaute Fassung, in einer Form mit Stationsaufteilung innerhalb des
Paares (zwei Säcke je Station). Sie bestätigte den Einwand direkt: **rho 0,782**, und der
Spielerwert hing am Stationsmix. Wer nur den Hof trug, lag im Mittel bei Note 81,7, wer nur
die Rampe trug, bei 46,7 (Abschnitt 6.1). Leichte Säcke trennen Starke und Schwache kaum. Ein
Spieler, der nur dort gemessen wird, wird nach etwas anderem bewertet als nach seiner Eignung.

### 2.3 Warum A, und warum nicht C

A hält die drei Dinge zusammen, die das Format braucht:

1. **Jeder trägt an jeder Station.** Damit wird jeder Spieler an leichten, mittleren und
   schweren Lasten gemessen. Das ist die Voraussetzung für eine Rangtreue in EINEM Spiel.
2. **Die Slot-Paarung bleibt die von heute.** Was heute Duell i gegen Duell i ist, wird
   Lauf ⌈i/2⌉. Ein bewusst schwach besetzter Slot bleibt ein Zug und kein Unfall, und der Manager
   steuert über die Aufstellung, wer mit wem läuft.
3. **Chris' Lastenplan nach Persönlichkeit bleibt**, im Maßstab zwei statt sechs (3.2).

C wäre messtechnisch am saubersten: jeder trägt alles allein, ohne Partner-Effekte. Es
streicht aber genau das, was Chris an der Idee wollte („spieler könnten hier sogar als team
antreten … manchmal teilen sich die spieler auf"). Es braucht vier Bahnen auf 470 px Höhe. Und
es macht aus „drei Läufen" sechs Einzelduelle, die nur gleichzeitig laufen. Zur Einordnung:
Die Solo-Note (jeder Spieler allein über alle neun Säcke, deterministisch) erreicht hier im
Mittel aller Spiele rho 0,794. Das ist **nicht** besser als der gebaute Spielerwert (0,829,
gleiche Spiele), weil die Partner-Rast in A die Erschöpfung dämpft. C wäre also kein
Rangtreue-Gewinn.

> **Stelle, an der Chris widersprechen könnte (1):** A macht aus dem großen Mannschaftsbild
> von Paket 1 (Anker trägt alles, fünf feuern an) ein Paarbild. Den „Alleingang" gibt es nur
> noch als Ego, der zwei von drei Säcken je Station beansprucht. Wer das Sechser-Bild will,
> muss den Spielerwert anders definieren als über eigene Gänge, und dafür gibt es keinen
> Kandidaten, der die Einzelspiel-Rangtreue trägt (2.2).

---

## 3. Die Mechanik

Alles in `public/mockups/battle-mode.engine.js`, im Block „SANDSACK WEG C — STUFE 2" direkt
nach `baueSandsackFinale()`. Der Einstieg `baueSandsackWegC()` wird in `bauBuehne()` nur bei
gesetztem Flag statt `baueHebenDuelle()` + `baueSandsackFinale()` aufgerufen.

### 3.1 Strecke

| Station | Säcke (kg) | Strecke | Besonderheit |
|---|---|---|---|
| Hof („Depot") | 20 · 30 · 40 | 12 m | Doppeln erlaubt |
| Rampe („Steg") | 40 · 55 · 70 | 8 m, Steigung 1,3 | Doppeln erlaubt |
| Ladekante („Rampe & Silo") | 65 · 85 · 105 | 4 m, dann wuchten | kein Doppeln |

* **Halbe Bahnbreite** heißt hier: alle Paket-1-Strecken ×0,5 (24/16/8 m → 12/8/4 m).
* **Neun statt fünfzehn Säcke**, drei je Station: leicht, mittel, schwer aus der
  Paket-1-Leiter. Drei je Station sind nötig, damit in jedem Paar-Plan beide an jeder Station
  tragen (3.2). Mit zwei je Station und Stationsaufteilung entstand die Fassung D aus 2.2.
* **Zeitlimit 65 Simulationssekunden je Lauf**, Medley-Regel wie Paket 1: Sind beide fertig,
  gewinnt die kürzere Zeit, ist einer fertig, gewinnt er, sonst entscheidet das abgelieferte
  Gewicht, dann die Zahl der Säcke, dann die Zeit.

### 3.2 Paar-Taktik (Chris' Lastenplan nach Persönlichkeit, auf zwei Träger übertragen)

Der **Plan** kommt unverändert aus `sandsackPersoenlichkeit()`: Mittel der zwei Teamwerte,
Schwellen 0,60/0,40 wie Paket 1. Jeder Plan lässt beide an jeder Station tragen. Der Plan
entscheidet, **wer wie viel** trägt, nicht wer welche Station bekommt:

| Plan | Persönlichkeit | Wer trägt |
|---|---|---|
| Staffel | Mannschaftsspieler | Gang um Gang im Wechsel über alle drei Stationen; wer anfängt, entscheidet die schnellere Reihenfolge |
| Stationen | ausgewogen | an jeder Station trägt, wer dort schneller ist, zwei von drei Säcken („Spezialist") |
| Anker | Ego | der Egoistischere (niedrigerer Teamwert) beansprucht an **jeder** Station zwei von drei Säcken, auch dort, wo er langsamer ist |

Welcher der drei Säcke an den Partner geht, rechnet die echte Lauf-Formel (deterministisch,
ohne Rutscher, 27 Kombinationen). Das ist dieselbe Regel wie in Paket 1 nach dessen
Rollen-Fix: keine Gewichte raten, die Formel fragen. Der Anker-Plan ist mit Absicht
**nicht** optimal: Er ist der Preis des Egos, den Chris beschrieben hat („denken sie wären
besser als ihre Kollegen").

Gemessene Planverteilung über die Kader-Familie (720 Paar-Entscheidungen): Anker 43 %,
Staffel 40 %, Stationen 17 %.

### 3.3 Der Lauf-Kern

`sandsackWegCSimuliere()` nutzt dieselben Formeln in derselben Reihenfolge wie
`sandsackSeiteLauf()` (Pause → Doppeln → Wechsel → Gang → Erschöpfung → Rast), mit
`sandsackGang()` selbst und den Paket-1b-Konstanten. Neu ist nur, was das Format verlangt:

1. Zuteilung je Sack-Index (oder Wechsel je Gang). Doppeln geht nur, wenn beide Säcke
   demselben Träger zugeteilt sind.
2. Der Wartende erholt sich über Pause + Wechsel + Gang (Paket 1: nur über den Gang).
3. Jeder Gang wird mit Start und Ende protokolliert. Nach jedem Gang wird der Zustand
   gesichert, damit der Rest mit erzwungenem Wurf weitergerechnet werden kann (3.5).
4. **Einzige Formeländerung gegenüber Paket 1b: Erschöpfung je Gang ×1,5.** Die
   Paket-1-Formel skaliert mit der Strecke (`d·steig/20`), die halbe Bahn halbiert also die
   Müdigkeit. Mit Faktor 1 gibt es praktisch keine Pausen (0,01 je Lauf). Mit 1,5 sind es 0,23
   je Lauf. Ab 2,0 kostet es Rangtreue (0,851), deshalb nicht mehr.

**Falle 17:** `sandsackWuerfe()` liefert je Lauf und Seite eine feste Folge nach Sack-Index aus
eigenem Saatstrom, mit der Laufnummer in die Saat gemischt. Kein `rr()`, keine Ziehung je Gang.
Doppeln verschiebt nichts.

`sandsackGang()` bekam einen optionalen sechsten Parameter (Weg-C-Konstantensatz
`SANDSACK_WEGC_KONF`). Ohne ihn, also in jedem Paket-1-Aufruf, rechnet die Funktion Zeichen für
Zeichen wie vorher. Die Werte im Weg-C-Satz sind heute die Paket-1b-Werte. Die Kopie existiert
nur, damit eine künftige Weg-C-Kalibrierung Paket 1 nicht mitzieht.

### 3.4 Wertung

* **Lauf:** Medley-Regel (3.1). Bei exakt gleicher Zeit entscheidet ein Los aus `cypherHash`,
  ohne `rr()`.
* **Mannschaft:** `seiten` = gewonnene Läufe, 0 bis 3. Eine ungerade Zahl ohne Remis, der
  kg-Tiebreak bei 3:3 kann nicht mehr eintreten. `spieleBuehneHeben()` liefert bei Flag 1
  `seiten` aus den Läufen und als `gesamtKg` das abgelieferte Sandsack-Gewicht.
* **Spieler** (`u.summe`, das, was `wert()` liest): die **Tragenote ×10**.
  * Für jeden eigenen Gang g wird die Stufe v_g ∈ [0;100] gesucht, bei der ein
    Referenzträger (alle fünf Sub-Skills = v, frisch, ohne Rutscher) für **genau diese Last**
    so lange bräuchte wie der Spieler selbst (Gang + eigene Pause; ein Rutscher zählt mit).
  * Gewicht w_g = ln(T_ref40 / T_ref60): Wie scharf trennt diese Last überhaupt? Am 20-kg-Sack
    kaum, am 105er stark.
  * Note = Σ w_g·v_g / Σ w_g, auf der Sub-Skill-Skala („trägt wie ein 62er").
  * Ein Doppel-Gang wird gegen zwei Einzelgänge der Referenz gemessen; der gesparte Weg ist
    der Lohn des Mutes, ANSAGE. Die Wechselzeit ist Teamzeit und zählt nicht.

  Warum so und nicht einfacher: Ein Paar teilt sich eine Laufzeit, also braucht es einen
  Wert je Spieler. Die erste Fassung (gepoolte Log-Zeit gegen die Referenz) ließ einen
  einzigen Gang an der Tempo-Untergrenze die ganze Note bestimmen. Ein Träger mit LAST 24
  am 105er ist dort hoffnungslos, und je nach Plan bekam er den 105er oder eben nicht. Die
  Inversion ist pro Gang auf [0;100] begrenzt und unabhängig davon, welche Säcke einer bekam
  (6.3).

### 3.5 Vorzeitiger Schluss: „uneinholbar", streng definiert

Geprüft wird nach jedem abgelieferten Gang einer der beiden Seiten, und **nur aus dem
sichtbaren Zwischenstand**: wer trägt, wie viele Säcke noch, wie erschöpft. Künftige Würfel
gehen nicht ein:

* **obere Schranke der Führenden:** der Restlauf, in dem **jeder** verbleibende Sack rutscht;
* **untere Schranke der Verfolger:** der Restlauf ganz **ohne** Rutscher. Pausen bleiben, sie
  sind deterministisch.

**Uneinholbar** heißt: obere Schranke der Führenden < untere Schranke der Verfolger, und die
Führenden schaffen es auch im schlechtesten Fall im Zeitlimit. Selbst wenn den Führenden ab
jetzt alles misslingt und den Verfolgern alles gelingt, kommen die Verfolger nicht mehr vorher
an. Zusätzlich wird defensiv gegen den tatsächlich gerechneten Ausgang geprüft, denn Pausen
könnten die Monotonie in Randfällen brechen. Gemessen in 1080 Läufen: **0 Widersprüche**.

**Die Einschränkung, die die Rangtreue verlangt:** Der Schluss greift erst, wenn alle vier
Träger am Steg (oder später) mindestens einen Sack abgeliefert haben. Endet der Lauf regulär
(Sieger fertig), bevor das erfüllt ist, trägt die Verfolgerseite weiter, bis es erfüllt ist
(6,1 % der Läufe). Mit Schluss schon nach dem Hof fiel rho auf 0,740 und Pp auf 29/24, siehe
6.2.

> **Stelle, an der Chris widersprechen könnte (2):** „Vorzeitiger Schluss" greift in
> 54 % der Läufe und spart im Mittel 5,4 s je Lauf. Er kommt aber nie vor dem Steg, auch wenn
> das Ergebnis nach dem Hof schon feststünde (das wäre in rund 75 % der Läufe der Fall). Wer
> den Schluss früher will, kauft das mit der Einzelspiel-Rangtreue: Leichte Säcke trennen
> nicht.

### 3.6 Attribute und Matrix

Keine neuen Sub-Skills, kein Override, die Matrix ist unangetastet. Gelesen werden die fünf
bestehenden Sub-Skills aus `BUEHNE_ART.gewichtheben.rezept`, genau wie in Paket 1:

* **LAST**: Traglast, Ermüdung über die relative Last.
* **TECHNIK**: Leertempo, seltener rutschen.
* **NERVEN**: Biss an der Grenzlast, Pausenschwelle, schneller nachgreifen.
* **ANSAGE**: Wagnis-Flex, Doppeln.
* **ERHOLUNG**: Pausenlänge, Rast.

Damit gilt auch für Weg C die Attributbegründung des Opus-Papiers (Abschnitt 4).

---

## 4. Der Schalter

```js
const BUEHNE_FLAGS={gewichthebenSandsack:0};   // 1 = Weg C
```

Name und Schnittstelle sind dieselben wie auf den Speed-Schach- und Wettessen-Zweigen der
Nacht: `window.__arena.buehneFlags({...})`, `window.__olyBuehneFlags` vor dem Laden für den
Headless-Runner und `--flags=gewichthebenSandsack:1` in `miss-alle-disziplinen.mjs`,
`messe-arena-einfluss.mjs` und `miss-arena-buehne-spiegel.mjs` (gemeinsame Helfer in
`scripts/lib/rangtreue-messung.mjs`). Beim Zusammenführen ist die eine Objektzeile zu vereinen.

Bei Flag 1 bleibt `buehneQueue` leer. Das Bild der Läufe ist Stufe 3, die Hantel-Enthüllung
gibt es in diesem Format nicht. **Ein echtes Spiel mit Flag 1 zeigt deshalb heute keine
Bühne.** Der Schalter ist nur für Messungen gedacht, bis Stufe 3 steht.

---

## 5. Isolationsnachweis (Flag aus)

| Prüfung | Basis `bf1403e4` | Dieser Stand | Ergebnis |
|---|---|---|---|
| `miss-alle-disziplinen.mjs 24`, alle 20 Disziplinen | 20 Zeilen (+ Hockey nur Feldspieler), z. B. gewichtheben 0,865 / 0,143 / 0,944 | dieselben 21 Zeilen | identisch (`diff` leer) |
| `messe-arena-einfluss.mjs gewichtheben 24`, Strom 1 / 2 | 9,7 / 11,6 | 9,7 / 11,6 | identisch (Ausgabe zeichengleich bis auf die Laufzeitangabe) |
| `spieleBuehneHeben` / `spieleSandsackFinale` / `spiele` („gewichtheben"), 7 Saaten (1337, 4242, 99991, 2026, 555555, 7919, 104729), SHA-256 über alle Rückgaben | `6eb486f4…4123aeae` | `6eb486f4…4123aeae` | identisch |

Strukturell: Bei Flag 0 betritt `bauBuehne()` den neuen Zweig nicht, und `SANDSACK_WEGC` bleibt
`null`. `sandsackGang()` ohne sechsten Parameter rechnet mit den Paket-1-Konstanten. Neu auf
der Gewichtheben-Bühne sind nur das zusätzliche Feld `SANDSACK_WEGC` in
`MOTOREN[bd].sichern()/zurueck()` und ein `if(SANDSACK_WEGC)` in `spieleBuehneHeben()`.

---

## 6. Kalibrierverlauf (alle gemessenen Fassungen)

Gemessen mit derselben Kader-Familie (`kaderfamilie-live-save.json`, 5 Paarungen),
24 Spiele je Paarung. Pp jeweils n=24, Strom 1 / Strom 2 (`--saat-versatz=10000000`).
„vorz." = vorzeitiger Schluss, „ab" = ab welcher Station er greifen darf, „EF" = Faktor auf die
Erschöpfung je Gang.

### 6.1 Struktur und Spielerwert

| # | Fassung | rho Spiel | Spannw. | Pp | Befund |
|---|---|---:|---:|---|---|
| 1 | 2 Säcke je Station, Stationsaufteilung im Paar, Note je Gang normiert, vorz. ab Hof | 0,782 | 0,188 | — | Note hängt am Stationsmix (nur Hof: 81,7, nur Rampe: 46,7); 0,01 Pausen je Lauf |
| 2 | 3 Säcke je Station, jeder trägt überall, Note gepoolt, vorz. ab Hof | 0,702 | 0,416 | 47,9 (Strom 1) | 79 % der Läufe nach dem Hof entschieden → 49 % der Spieler nur am Hof gemessen, charisma 46,9 % |
| 3 | wie 2, ohne vorzeitigen Schluss | 0,778 | 0,263 | 15,6 / 17,5 | Pp in Ordnung; Grenze ist jetzt die Validität (Spiel ≈ Saison) |
| 4 | wie 3, Plan erzwungen: Staffel / Stationen / Anker | 0,799 / 0,823 / 0,828 | | 13,1 / 24,6 / 12,2 (S1) | jeder einheitliche Plan ist besser als die Mischung |
| 5 | wie 3, EF 1,5 / 2 / 2,25 / 2,5 / 3 | 0,784 / 0,843 / 0,852 / 0,842 / 0,780 | | | mehr Erschöpfung verstärkt LAST kumulativ (wie Paket 1b, Hebel D) |
| 6 | EF 2,25, vorz. ab Ladekante | 0,841 | 0,316 | 14,5 / 19,2 | Sendezeit Median 3:44, nur 63 % im Fenster |
| 7 | wie 6, Hof 2 Säcke [25,40], Limit 65 s | 0,840 | 0,365 | 14,3 / 10,4 | Mortal Sin – Natures Wrath 0,519 (s. 6.3) |

### 6.2 Der vorzeitige Schluss gegen die Rangtreue

| Fassung (Note per Inversion, EF 1, Limit 65) | Hof-Säcke | rho Spiel | Pp | Sendezeit Median (im Fenster) | vorzeitig |
|---|---:|---:|---|---:|---:|
| vorz. ab Hof | 2 | 0,740 | 29,2 / 24,4 | 2:18 (30 %) | 77 % |
| vorz. ab Steg | 2 | 0,834 | 16,6 / 16,2 | 2:46 (69 %) | 75 % |
| vorz. ab Ladekante | 2 | 0,862 | 11,7 / 11,9 | nicht gemessen | nicht gemessen |
| **vorz. ab Steg** | **3** | **0,884** | 18,8 / 23,0 | 3:03 (97 %) | 56 % |

„Ab Hof" ist die naheliegende Lesart von Chris' Festlegung. Sie fällt bei rho **und** Pp
durch: Wer nur Hof-Säcke getragen hat, wird an Lasten gemessen, an denen LAST kaum zählt und
Doppeln (ANSAGE) fast alles. „Ab Steg" ist der früheste Punkt, der beide Abnahmen hält.

### 6.3 Der Spielerwert: Inversion statt Pooling

Den Ausschlag gab die Diagnose an Mortal Sin – Natures Wrath (Fassung 7, rho 0,519). Velza
(LAST 24) trug im Anker-Paar den 105er und bekam 162. Matcha (LAST 32, sehr ähnliches Profil)
trug leichtere Säcke und bekam 454. Ein Gang an der Tempo-Untergrenze bestimmte die gepoolte
Note fast allein. Mit der Inversion (3.4):

| Fassung (vorz. ab Ladekante, Hof 2, Limit 65) | rho Spiel | Spannw. | Pp |
|---|---:|---:|---|
| Note gepoolt, EF 2,25 | 0,840 | 0,365 | 14,3 / 10,4 |
| Inversion, EF 2,25 | 0,848 | 0,484 | 11,5 / 10,6 |
| Inversion, EF 1 / 1,25 / 1,5 / 1,75 / 2 | 0,862 / 0,861 / 0,860 / 0,846 / 0,842 | 0,168 … 0,466 | 9 … 12 |

Mit der Inversion braucht es keinen hohen Erschöpfungsfaktor mehr. Daraus entstand die
gebaute Fassung (vorz. ab Steg, Hof 3 Säcke, Limit 65):

| EF | rho Spiel | Spannw. | Pp | Pausen je Lauf |
|---:|---:|---:|---|---:|
| 1 | 0,884 | 0,175 | 18,8 / 23,0 | 0,01 |
| **1,5 (gebaut)** | **0,882** | **0,253** | **15,0 / 17,0** | **0,23** |
| 2 | 0,851 | 0,355 | 17,3 / 20,7 | 0,62 |

1,5 statt 1: gleiche Rangtreue, deutlich mehr Abstand zur Pp-Schranke im zweiten Strom, und
die Pause, Chris' „müssen evtl kurz pause machen", kommt überhaupt vor. Weitere geprüfte
Hebel ohne Gewinn: Wagnis-Flex 0,010/0,011 (charisma sinkt, rho auch: 0,851/0,872),
Doppeln-ANSAGE-Faktor 0,003 (Pp-Strom 2 schlechter: 24,0), Pausenschwelle 30/35 statt 50
(kaum mehr Pausen: 0,12/0,07), Referenz bei eigener Erschöpfung (rho unverändert, verworfen).

---

## 7. Messergebnisse der gebauten Fassung

### 7.1 Pflichtabnahmen

```
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --flags=gewichthebenSandsack:1 --bootstrap-unsicherheit
node scripts/miss-alle-disziplinen.mjs 48 gewichtheben --flags=gewichthebenSandsack:1 --bootstrap-unsicherheit
node scripts/messe-arena-einfluss.mjs gewichtheben 24|48 --flags=gewichthebenSandsack:1 [--saat-versatz=10000000]
```

| | n=24 | n=48 |
|---|---|---|
| rho je Spiel (Median / Spannweite) | 0,882 / 0,253 | 0,864 / 0,235 |
| rho Saison | 0,916 | 0,909 |
| 90 %-Bootstrap-Intervall des Medians | [0,679; 0,931] | [0,694; 0,929] |
| Pp Strom 1 / Strom 2 | 15,0 / 17,0 | 16,0 / 19,6 |

| Attribut (n=48) | Strom 1 | Strom 2 | Matrix | Heute (Hantel, Strom 1) |
|---|---:|---:|---:|---:|
| charisma | 28,3 % | 31,1 % | 23 | 22,6 % |
| power | 26,2 % | 27,7 % | 28 | 29,7 % |
| health | 15,6 % | 15,1 % | 16 | 17,4 % |
| determination | 8,3 % | 7,3 % | 12 | 10,2 % |
| speed | 7,4 % | 7,4 % | 6 | 5,5 % |
| dexterity | 7,3 % | 6,3 % | 6 | 5,0 % |
| will | 6,6 % | 5,0 % | 7 | 8,2 % |
| stamina | 0,3 % | 0,1 % | 2 | 1,5 % |

Charisma ist überzeichnet (+5 bis +8), determination untergewichtet (−4 bis −5). Das ist
dasselbe Muster wie in Paket 1 vor seiner Kalibrierung: ANSAGE wirkt über Wagnis-Flex **und**
Doppeln.

**Kleinere Kader** (`--je-seite`): Bei 4 je Seite (zwei Läufe) 0,860 gegen 0,788 der Hantel.
Bei 2 je Seite (ein Lauf) 0,758 gegen 0,650. Weg C ist dort besser als heute, bei 2 je Seite
aber wie die Hantel unter der Schranke. Die Spannweiten sind mit 0,53 / 1,02 sehr breit.

### 7.2 Die schwache Paarung

| Paarung | rho je Spiel | rho Saison |
|---|---:|---:|
| vigilante – armageddon | 0,931 | 0,986 |
| coldsteel – direlegion | 0,769 | 0,741 |
| goldengladiators – silversoldiers | 0,882 | 0,972 |
| **mortalsin – natureswrath** | **0,679** | 0,671 |
| piratecrew – raginglunatics | 0,882 | 0,916 |

Mortal Sin – Natures Wrath ist dieselbe Paarung, die schon in Paket 1/1b und im Opus-Modell
herausfiel. Die Eignungsspanne ist eng (die meisten Spieler zwischen 41 und 51). Grimflora
(Eignung 41, LAST 81) trägt im Sandsack deutlich besser, als seine Eignung sagt. Die Matrix
gewichtet power mit 28, das Tragen belohnt LAST an schweren Säcken stärker. Das ist kein
Rauschen (Saison ≈ Spiel), sondern Validität: In diesem Kader belohnt die Mechanik etwas
anderes als die Eignung. Der Median über die fünf Paarungen trägt die Abnahme. Das Mittel über
**alle** 120 Spiele liegt bei 0,829 (Hantel: Median 0,865), und das untere Ende des
Bootstrap-Intervalls (0,68–0,69) liegt unter der Schranke.

### 7.3 Sendezeit

`scripts/miss-sandsack-wegc.mjs 24` (bzw. 48), Wiedergabe 1:1 wie das Paket-2-Pacing. Dazu je
Lauf 8,7 s Überleitung: Aufstellung 1,5 + Zieleinlauf 1,2 + Lastenplan-Tafel ~4 + Szenenwechsel
~2. Je Spiel kommen 8 s Rahmen dazu. Diese Zuschläge sind eine **Schätzung**; Stufe 3 legt sie
fest.

| | n=24 | n=48 |
|---|---:|---:|
| Laufende (Sim-s), Median / 10 % / 90 % / max | 49,1 / 36,0 / 72,2 / 84,4 | 49,2 / 36,0 / 72,6 / 84,4 |
| ohne vorzeitigen Schluss, Median | 57,7 | 57,8 |
| **Spiel gesamt, Median** (10 % / 90 %) | **3:04** (2:39 / 3:46) | 3:07 (2:39 / 3:47) |
| min / max | 2:27 / 4:09 | 2:26 / 4:09 |
| im Zielfenster 2:30–4:00 | 96,7 % | 96,3 % |

Heute dauern die sechs Duelle 7:11. Die Läufe sind länger als das Zeitlimit von 65 s (max
84,4), weil ein Gang, der vor dem Limit beginnt, noch zu Ende getragen wird (Paket-1-Semantik)
und weil die Verfolger ggf. bis zum Steg weitertragen (3.5).

### 7.4 Ablauf und Mannschaftsebene

| Größe | Wert | Einordnung |
|---|---:|---|
| vorzeitig entschieden | 54,4 % der Läufe (n=24), 53,3 % (n=48) | spart 5,4 s je Lauf |
| verlängert bis „jeder hat am Steg getragen" | 6,1 % | |
| Schranken-Widersprüche | 0 von 1080 | muss 0 sein |
| Rutscher je Lauf (beide Seiten) | 0,52 | Paket 1: 1,08 je 15-Sack-Rennen |
| Pausen je Lauf | 0,23 | unter dem Opus-Korridor 0,5–2 je Rennen (s. 8) |
| Doppel-Gänge je Lauf | 0,96 | |
| Läufe ohne Fertige (Zeitlimit, kg entscheidet) | 25 von 360 (6,9 %) | |
| Paar mit höherer Eignung gewinnt den Lauf | 88,0 % (n=24), 87,8 % (n=48) | |
| Team mit höherer Eignung gewinnt das Spiel | 75,8 % (n=24), 77,5 % (n=48) | Hantel auf denselben Spielen: 80,0 % (n=24), 80,4 % (n=48), 3:3 per Gesamt-kg (17 % der Spiele) |
| Endstände (n=24) | 3:0 26 % · 2:1 18 % · 1:2 33 % · 0:3 23 % | |
| Spiegeltest (gleicher Kader gegen sich selbst, `miss-arena-buehne-spiegel.mjs`, 1000 Spiele) | Heim 514 · Gast 486 · Remis 0; Läufe 1,53 : 1,47 (+4,3 %) | Hantel: Heim 332 · Gast 335 · 3:3 333 (vor dem kg-Tiebreak); Duelle 2,99 : 3,01 (−0,9 %). Beide im Rauschen (Weg C ≈ 1 Standardfehler), keine Seite bevorzugt |

Die Hantel-Spalte stammt aus denselben 120 (240) Spielen. `miss-sandsack-wegc.mjs` baut jedes
Spiel über `spieleSandsackWegC(…, {hantelVergleich: true})` ein zweites Mal mit Flag 0, mit
gleicher Saat, Formkarte, Mutator-Wurf und Aufstellung. Als Gegenprobe liefert die Sonde dort
rho je Spiel 0,864 (n=24) gegen 0,865 aus `miss-alle-disziplinen.mjs`; der Rest ist die
Rundung auf zwei Stellen in `disziplinProbe`. Der Spiegeltest:

```
node scripts/miss-arena-buehne-spiegel.mjs 1000 gewichtheben
node scripts/miss-arena-buehne-spiegel.mjs 1000 gewichtheben --flags=gewichthebenSandsack:1
```

---

## 8. Offen und unsicher

1. **Zwei Design-Stellen für Chris**, beide oben markiert: die Paarstruktur statt des
   Sechserbildes (2.3) und der vorzeitige Schluss erst ab dem Steg (3.5).
2. **Pp ist bestanden, aber schlechter als heute** (15–20 gegen 9–12): charisma +5 bis +8,
   determination −4 bis −5. Ein naheliegender nächster Hebel ist das Doppeln (ANSAGE wirkt
   zweimal). Allein gemessen half der Doppeln-Faktor nicht (6.3).
3. **Die Paarungsspannweite ist fast doppelt so breit wie heute**, eine Paarung liegt bei
   0,68 (7.2). Mit nur fünf Paarungen ist nicht zu trennen, ob das ein Kader-Sonderfall ist
   oder ein systematisches LAST-Übergewicht bei engen Kadern. Eine größere Kader-Familie würde
   das klären.
4. **Pausen sind selten** (0,23 je Lauf). Die halbe Strecke und neun statt fünfzehn Säcke
   lassen wenig Ermüdung entstehen, und jede Verstärkung kostete Rangtreue (6.3). Die
   Erschöpfung ist im Bild (Puste-Ring) trotzdem da. Die Pause als Ereignis bleibt aber die
   Ausnahme.
5. **Die Sendezeit ist eine Simulationszeit bei 1:1-Pacing.** Die Überleitungen (8,7 s je Lauf,
   8 s je Spiel) sind geschätzt. Will Stufe 3 einen Zeitraffer (Opus nannte 0,37 für das große
   Finale), wird es kürzer, und das Zielfenster müsste neu geprüft werden.
6. **Stufe 3 fehlt vollständig:** Bühnenbild der drei Läufe (die Paket-2-Szene kennt nur das
   15-Sack-Mannschaftsrennen), HUD „Läufe x:y von 3", Boxscore (die Felder
   `lastKg/lastSaecke/lastRutscher/lastPausen/lastDoppelt/tragenote/laufNr` liegen bereit),
   Kaderbildschirm, `arenaTeamPointsForFixtureMitTiebreak()` (3:3 entfällt), die 32
   Sonden-Skripte. Mit Flag 1 zeigt die Bühne heute nichts (4).
7. **Der Kalibrierhebel `window.__arena.sandsackWegCKalib()`** (`SANDSACK_WEGC_KONF`) bleibt im
   Code, damit der Verlauf in Abschnitt 6 nachmessbar ist
   (`node scripts/miss-sandsack-wegc.mjs 24 --kalib=schluessel:wert,...`). Er ist nur für
   Messläufe gedacht, nie für das Spiel.

---

## 9. Geänderte und neue Dateien

* `public/mockups/battle-mode.engine.js`:
  * `BUEHNE_FLAGS` und `SANDSACK_WEGC` (Zustand);
  * der Block „SANDSACK WEG C — STUFE 2" (`sandsackWegCSimuliere`, `sandsackWegCPaarPlan`,
    `sandsackWegCNote`/`…Invers`, `sandsackWegCSchranke`, `sandsackWegCLauf`,
    `baueSandsackWegC`);
  * der Flag-Zweig in `bauBuehne()`;
  * der optionale Parameter von `sandsackGang()`;
  * `SANDSACK_WEGC` in `MOTOREN[bd].sichern()/zurueck()`;
  * der Weg-C-Zweig in `spieleBuehneHeben()`;
  * `__arena.buehneFlags`, `spieleSandsackWegC`, `sandsackWegCKalib`.
* `scripts/lib/rangtreue-messung.mjs`: Schalter-Helfer (`buehneSchalterAusArgs` u. a.).
* `scripts/miss-alle-disziplinen.mjs`, `scripts/messe-arena-einfluss.mjs`,
  `scripts/miss-arena-buehne-spiegel.mjs`: `--flags=` (additiv, ohne Schalter unverändert).
* `scripts/miss-sandsack-wegc.mjs`: neue Sonde (Rangtreue wie die Pflichtabnahme, Sendezeit,
  vorzeitiger Schluss, Pläne, Mannschaftsebene, Diagnose). Abschnitt 5 legt dieselben Spiele
  im heutigen Format daneben (Spielsieger-Quote, rho-Gegenprobe, Nullanteil des Paket-1-Rennens),
  über die additive Messoption `hantelVergleich` von `__arena.spieleSandsackWegC`.
* Dieses Dokument.
