# PPs-Skalierung: ein absoluter Massstab statt eines Spieltags-Perzentils

Branch `claude/pps-skalierung-opus`, abgezweigt von `origin/main` (HEAD `48a0a707`, nach dem
heutigen Merge von `computeIndividualBoxscorePpsFromFixtureResults()`). **Entwurfsaufgabe, kein
Code, kein Commit am Motor** — dieses Dokument aendert keine Zeile ausser sich selbst.

Auftrag: Chris hat das Modell praezisiert, und die Praezisierung bricht das gerade gebaute Modell.
Woertlich:

> ich wollte nur dass die besten spieler max 5-6 pro diszi bekommen damit das nicht inflationär
> wird. Aber das soll dann entsprechend skalieren, also ein 95er player der n star ist und krass in
> der diszi spielt kann die erreichen, ein 75er player der zwar der beste in der partie war aber
> „unterdurchschnittlich" für sein können performt hat muss in relation zu dem anderen spieler
> verglichen werden, bzw müsste man dann wissen was ein krasser impact ist und was mittelmäßig,
> weil es soll nicht in jedem team duell immer ein spieler volle punktzahl bekommen

---

## 0. Kurzfassung

1. **Der Befund ist bestaetigt und beziffert.** Das aktuelle Modell (Perzentil im Pool desselben
   Spieltags × 6,6) vergibt an **jedem** Spieltag exakt 6,57 PPs an irgendjemanden — auch an einem
   absichtlich schwachen Spieltag, an dem der beste Spieler nur halb so viel Impact produziert wie
   an einem starken. Gemessen an 160 simulierten Spielen: **6,53 PPs am schwachen, 6,57 PPs am
   starken Spieltag.** Ein Impact von 33,5 und einer von 67,4 — das Doppelte — bekommen dieselbe
   Note.
2. **Es ist zusaetzlich ein Inflationsproblem, genau das Wort, das Chris benutzt.** Weil ein
   Perzentil im Mittel 50 ist, bekommt **jedes Team an jedem Spieltag im Mittel 19,7 PPs** — das ist
   auf die Nachkommastelle die Ausschuettung, die der bestehende PPS-Pfad dem **Tabellenersten**
   zahlt (`rank-to-points.json`, `playerCount` 6: Rang 1 = 19,9). Der Letzte bekaeme dort 5,6.
3. **Vorschlag: die Impact-Kurve.** Ein Rohwert wird nicht mehr gegen den Spieltag verglichen,
   sondern gegen eine **fest hinterlegte Referenzverteilung**, und zwar ueber eine
   Potenzkurve mit Deckel:

       PPs = MAX · min(1, (max(0, Impact) / I_krass)^γ)     mit   γ = ln(a_mitte) / ln(I_mittel / I_krass)

   `I_mittel` und `I_krass` sind zwei Zahlen aus der Referenzdatei (Median und 99,5-Perzentil,
   **je Feldgroesse**). `MAX` und `a_mitte` sind die einzigen zwei freien Regler.
4. **Empfehlung: `MAX = 5,5`** (Mitte von Chris' „5-6"; 6,6 liegt ausserhalb seines Rahmens und
   zahlt jedem Team dauerhaft eine Meister-Ausschuettung) **und `a_mitte = 0,25`** („ein
   mittelmaessiger Auftritt ist ein Viertel des Maximums wert").
5. **Das erfuellt die Anforderung nachweislich**: derselbe schwache Spieltag, an dem das alte Modell
   6,53 vergibt, gibt unter dem neuen Modell **niemandem mehr als 3,51**, und in **0 von 16** Duellen
   faellt die volle Punktzahl. Am starken Spieltag sind es 11 von 16. Ueber alle 400 gemessenen
   Spiele bekommt in **7,1 %** der Duelle der Beste die volle Punktzahl — nicht in jedem.
6. **Gegen einen Eignungs-/Erwartungsbezug** („overperformance relativ zum eigenen Rating"):
   ausdruecklich **nein**, mit Begruendung aus Chris' eigenem Satz (Abschnitt 5). Der absolute
   Massstab erzeugt Chris' 95er-gegen-75er-Reihenfolge von selbst; ein Erwartungsbezug wuerde sie
   **umdrehen**.
7. **Praktikabilitaet**: eine JSON-Datei mit vorberechneten Quantilen je Feldgroesse, einmal gezogen,
   nach jeder Balance-Aenderung neu. Laufzeitkosten im Resolve: zwei Tabellen-Lookups und ein
   `Math.pow` je Spieler.

---

## 1. Was gemessen wurde, und womit

Alles unten Genannte ist an **diesem** Stand gemessen, nicht aus dem alten Plan uebernommen:

| | |
|---|---|
| Repo-Stand | `48a0a707` (`origin/main` nach dem heutigen Merge) |
| Motor | `public/mockups/battle-mode.engine.js`, SHA-1 `2b001c14fed0247b0581167e6d6a2d1c78b7ce1a` |
| Sonde | `window.__arena.feldspielProbe("basketball", {n, jeSeite, saat0})` ueber Playwright/Chromium |
| Referenzstichprobe | 240 Spiele 6v6 (Saaten 1337 / 500003 / 900007) = **2.880 Spieler-Rohwerte** |
| Teststichprobe (ausgehalten) | 160 Spiele 6v6 (Saaten 1300021 / 2100011) = 1.920 Werte, **nicht** in der Referenz |
| Feldgroessen-Vergleich | je 60 Spiele bei 2v2 und 4v4 |
| Unterzahl-Probe | 2 × 40 Spiele, 6v6 und 3v6, auf einer **gepatchten Kopie** des Motors (Scratchpad, nicht im Repo) |

**Die eine Einschraenkung, die ueberall mitgelesen werden muss:** `feldspielProbe` faehrt den
**Demokader des Mockups** (dieselben zwoelf Namen in jedem Spiel, nur Saat und Formkarten
wechseln), nicht echte Liga-Kader ueber `arena-kader-adapter.ts`. Die **Form** der Verteilung
(Schiefe, Streuung, das Verhaeltnis Median zu Spitzenwert, die Abhaengigkeit von der Feldgroesse)
ist ein Merkmal der Wertformel und der Mechanik und damit uebertragbar. Die **absoluten Zahlen**
sind es nicht: der Demokader spannt Eignungen von rund 20 bis 70, ein echtes Liga-Feld spannt
mehr. **Die produktive Referenzverteilung muss deshalb aus echten Kadern gezogen werden**
(Abschnitt 8) — die Zahlen in diesem Dokument sind der Beweis fuer die Modellform, nicht die
Konstanten, die in den Code gehoeren.

### 1.1 Der Rohwert

Fuer Basketball ist der Impact eine einzige Zeile (`feldspielWert`, `battle-mode.engine.js:5501`):

```js
u.punkte + u.assists*1.0 + u.rebounds*1.2 + (u.steals+u.bloecke)*1.5 - u.verluste*0.8
```

Kein Deckel, kein Boden, keine Normierung auf die Partie — anders als bei den Kampf-Disziplinen,
deren `MOTOREN[ad].wert()` bewusst auf „Anteil am Gesamtbeitrag, 0-100" normiert. Das ist die
Groesse, die `ArenaFixtureBoxscoreEintrag.wert` durchreicht und die
`computeIndividualBoxscorePpsFromFixtureResults()` heute perzentiliert.

### 1.2 Die Verteilung (6v6, 240 Spiele, 2.880 Werte)

| Kennzahl | Wert |
|---|---:|
| Minimum | −4,8 |
| 5. Perzentil | 0,0 |
| 10. Perzentil | 1,4 |
| 25. Perzentil | 4,2 |
| **Median** | **11,1** |
| Mittelwert | 15,1 |
| 75. Perzentil | 23,6 |
| 90. Perzentil | 35,4 |
| 95. Perzentil | 41,0 |
| 99. Perzentil | 51,0 |
| **99,5. Perzentil** | **56,9** |
| 99,9. Perzentil | 62,4 |
| Maximum | 64,2 |

Rechtsschief (Schiefe +0,96), Mittelwert deutlich ueber dem Median, langer oberer Schwanz, ein
kleiner negativer Rand. **Keine Normalverteilung** — ein z-Score-Modell waere hier das falsche
Werkzeug, ein Quantil-Modell das richtige (dieselbe Begruendung, die
`battle-mode-pps-modell-plan.md` Abschnitt 4.1 schon fuer den Perzentilrang gab).

Daneben die zweite, fuer diese Frage entscheidende Verteilung — **der Beste eines einzelnen
Duells** (240 Werte, einer je Spiel):

| Kennzahl | Wert |
|---|---:|
| Minimum | 25,7 |
| 10. Perzentil | 34,5 |
| 25. Perzentil | 37,9 |
| Median | 41,4 |
| Mittelwert | 42,6 |
| 75. Perzentil | 46,1 |
| 90. Perzentil | 52,8 |
| Maximum | 64,2 |

**Das ist der Kern des Problems.** Der Beste eines Duells liegt praktisch immer im obersten Zehntel
der Gesamtverteilung — der Median der Duellbesten (41,4) ist ungefaehr das 95. Perzentil aller
Spieler. Ein Perzentilrang, gebildet gegen ein Feld, das ueberwiegend aus **Nicht**-Duellbesten
besteht, liefert dem Duellbesten deshalb strukturell einen Wert nahe 100 — **unabhaengig davon, ob
sein 41,4 fuer diese Disziplin gut oder mittelmaessig ist**. Genau das beschreibt Chris.

### 1.3 Die alten Zahlen im Plan sind veraltet — und das ist selbst ein Befund

`battle-mode-pps-modell-plan.md` Abschnitt 3 misst (31.08.) Median 4,4, Maximum 23,9, mittlere
Spanne je Spiel ≈ 15,5. Heute, drei Tage spaeter: Median 11,1, Maximum 64,2, mittlere Spanne 42,8.
**Faktor 2,5 bis 2,7 auf allen Kennzahlen.** Ursache ist unter anderem die inzwischen aus
`VIERTEL_ANZAHL_BASKETBALL × VIERTEL_DAUER_BASKETBALL` abgeleitete Spieldauer von 360 s
(`battle-mode.engine.js:4175`) gegenueber den frueheren 120 s.

Das ist die praktische Warnung fuer alles, was unten folgt: **eine eingefrorene Referenzverteilung
ist nach einer Mechanik- oder Wertformel-Aenderung sofort falsch, und sie sagt es nicht von selbst.**
Der Motor kennt dieses Problem schon einmal, an genau derselben Stelle — der Kommentar zu
`HK_TW_BASIS` (`battle-mode.engine.js:5378`) haelt fest, dass diese Konstante „nach JEDER Aenderung
der Wertformel nachgezogen werden" muss, „sonst faellt der Torwart aus der Rangfolge, ohne dass sich
an ihm etwas geaendert haette". Abschnitt 8.3 schlaegt den Waechter dafuer vor.

---

## 2. Das aktuelle Modell, an Daten nachgerechnet

`computeIndividualBoxscorePpsFromFixtureResults()` bildet den Pool aus **allen** eindeutig
zugeordneten Boxscore-Werten beider Liga-Stufen eines Spieltags (bei `playerCount` 6: 16 Duelle ×
12 Spieler = 192 Werte) und rechnet `PPs = Perzentil/100 × 6,6`.

Nachgerechnet an zehn aus den ausgehaltenen 160 Spielen gebauten Spieltagen (je 16 Duelle), plus
zwei absichtlich gebauten Extremfaellen (die 16 schwaechsten und die 16 staerksten Spiele):

| Spieltag | bester Impact des Tages | **hoechste PPs des Tages** | Duellbester im Mittel | Duelle mit ≥ 6,0 PPs | Median-Spieler |
|---|---:|---:|---:|---:|---:|
| 1 | 54,1 | 6,57 | 6,20 | 13 / 16 | 3,30 |
| 2 | 53,9 | 6,57 | 6,16 | 12 / 16 | 3,30 |
| 3 | 67,4 | 6,57 | 6,25 | 13 / 16 | 3,30 |
| 4 | 51,3 | 6,57 | 6,20 | 13 / 16 | 3,30 |
| 5 | 57,9 | 6,57 | 6,23 | 13 / 16 | 3,30 |
| 6 | 56,6 | 6,57 | 6,25 | 13 / 16 | 3,30 |
| 7 | 55,0 | 6,57 | 6,21 | 12 / 16 | 3,30 |
| 8 | 56,1 | 6,57 | 6,29 | 15 / 16 | 3,23 |
| 9 | 65,4 | 6,57 | 6,20 | 11 / 16 | 3,30 |
| 10 | 50,5 | 6,57 | 6,21 | 12 / 16 | 3,27 |
| **SCHWACH** (16 schwaechste Spiele) | **33,5** | **6,53** | 6,19 | 12 / 16 | 3,27 |
| **STARK** (16 staerkste Spiele) | **67,4** | **6,57** | 6,31 | 16 / 16 | 3,27 |

Drei Dinge stehen darin, und alle drei sind Chris' Beschwerde:

1. **Die Spalte „hoechste PPs des Tages" ist eine Konstante.** 6,53 bis 6,57, ueber alle zwoelf
   Zeilen, waehrend die Spalte davor von 33,5 bis 67,4 laeuft. Der Tagesbeste bekommt die
   Hoechstnote, weil er der Tagesbeste ist, nicht weil er gut war.
2. **In 11 bis 16 von 16 Duellen bekommt jemand ≥ 6,0 von 6,6.** Das ist woertlich „in jedem team
   duell immer ein spieler volle punktzahl".
3. **Der Median-Spieler bekommt strukturell 3,3.** Das ist kein Messwert, das ist die Definition:
   Median = 50. Perzentil = die Haelfte von 6,6. Die Verteilung der PPs haengt gar nicht an der
   Leistung, sie haengt nur an der Rangfolge.

### 2.1 Das Inflationsargument, in einer Zahl

Weil ein Perzentilrang im Mittel 50 ist, ist die mittlere PPs-Ausschuettung je Spieler exakt
`6,6/2 = 3,3` — **an jedem Spieltag, in jedem Team, unabhaengig von jeder Leistung.** Mal sechs
Feldspieler:

| Pfad | Ausschuettung je Team |
|---|---:|
| aktuelles Perzentil-Modell (`playerCount` 6) | **19,7** |
| PPS-Pfad, Rang 1 von 16 (`rank-to-points.json`) | 19,9 |
| PPS-Pfad, Rang 8 | 11,8 |
| PPS-Pfad, Rang 16 | 5,6 |

**Jedes Team bekommt die Meister-Ausschuettung.** Und das gilt bei jeder Feldgroesse, weil
`rank-to-points.json` am Rang-1-Ende praktisch exakt proportional zur Feldgroesse ist (3,30 je
Spieler bei `playerCount` 2, 4 und 6 — nachgemessen, s. `battle-mode-pps-modell-plan.md`
Abschnitt 1.2) und `6,6/2` genau 3,3 ergibt. Das ist keine Absicht des Modells, es ist ein
Nebeneffekt der Wahl `MAX = 6,6`. Chris' Wort dafuer ist „inflationär".

### 2.2 Warum eine groessere Poolgroesse das nicht heilt

Naheliegender Reflex: der Pool sei zu klein (192 Spieler), man muesse ihn vergroessern. Das hilft
nicht, und der Grund steht in Abschnitt 1.2: der Duellbeste liegt im obersten Zehntel **jeder**
Verteilung, die ueberwiegend aus Nicht-Duellbesten besteht — auch bei 10.000 Spielern. Ein
Perzentil gegen einen Pool derselben Sorte kann prinzipiell nicht sagen, ob 41,4 viel oder wenig
ist; es sagt nur, wie viele im Pool darunter lagen. Was fehlt, ist kein groesserer Pool, sondern
ein **anderer Massstab**.

---

## 3. Drei Ansaetze, bewertet

### Ansatz A — Perzentil gegen eine grosse, feste Referenzverteilung

Statt gegen die 192 Werte des Tages gegen 100.000 vorberechnete Werte. Das loest Punkt 1 aus
Abschnitt 2 sofort: ein schwacher Spieltag zeigt dann eben schwache Perzentile.

**Es loest aber Punkt 2 nicht.** Der Duellbeste liegt gegen die feste Referenz beim ~95.
Perzentil; linear auf 6,6 abgebildet macht das 6,27 PPs. Und der Duellbeste eines **schwachen**
Duells (Impact 33,5) liegt beim 88. Perzentil → 5,8. Der Abstand zwischen einer mittelmaessigen und
einer herausragenden Duell-Vorstellung bleibt winzig, weil das obere Zehntel der Rohwerte in zehn
Perzentilpunkte gequetscht wird. **Perzentil ist die richtige Referenz, aber die falsche
Endskala.** Es wirft die Information weg, die hier gebraucht wird — *wie weit* oben.

Auch jede Kurve **auf dem Perzentil** (Gamma, S-Kurve, Baender) erbt diesen Defekt: sie kann den
Median absenken, aber die Spitze nicht mehr auffaechern, weil die Eingangsgroesse dort schon
plattgedrueckt ist.

### Ansatz B — Bewertung relativ zur Eignung/Erwartung des Spielers

Chris' Satzteil „ein 75er player der … **unterdurchschnittlich für sein können** performt hat"
klingt zunaechst danach. Er ist es nicht — der Rest desselben Satzes sagt das Gegenteil: „muss in
relation zu **dem anderen spieler** verglichen werden". Die Bezugsgroesse ist der 95er-Star, nicht
das eigene Potenzial.

Und inhaltlich waere ein Erwartungsbezug hier **aktiv schaedlich**: „Leistung relativ zum eigenen
Rating" belohnt gerade den Spieler, der eine niedrige Messlatte uebertrifft. Chris' 75er, der fuer
sein Koennen unterdurchschnittlich war, bekaeme dafuer korrekterweise wenig — aber ein 75er, der
fuer sein Koennen **ueberdurchschnittlich** war, bekaeme mehr als der 95er-Star mit einem soliden
Normalspiel. Das ist die Umkehrung der Reihenfolge, die Chris beschreibt, und es entwertet
nebenbei den ganzen Sinn eines Starspielers.

**Der absolute Massstab erzeugt Chris' Reihenfolge ohne jeden Erwartungsterm**, weil Eignung und
Impact ohnehin stark zusammenhaengen (gemessen: Pearson **0,742** ueber 2.880 Werte). Nach
Eignungsbaendern, 6v6:

| Eignungsband | n | Median-Impact | 90. Perzentil |
|---|---:|---:|---:|
| 30–40 | 438 | 2,7 | 8,3 |
| 40–50 | 592 | 10,3 | 21,5 |
| 50–60 | 454 | 23,7 | 43,3 |
| 60+ | 276 | 29,9 | 41,4 |

Ein starker Spieler mit einem starken Spiel landet oben, ein mittlerer mit einem starken Spiel in
der Mitte. Genau die gewuenschte Ordnung, ohne eine zweite Kennzahl einzufuehren.

**Empfehlung: kein Eignungsterm.** Falls Chris spaeter doch „Aufsteiger-Storys" will (ein
Rollenspieler, der ueber sich hinauswaechst), ist der saubere Ort dafuer eine **eigene, getrennt
angezeigte** Kennzahl („Spiel des Lebens"-Marker), nicht ein Term in den PPs — PPs sollen nach
Chris' Satz eine Rangliste der tatsaechlichen Leistung sein.

### Ansatz C — feste Referenz **plus** Formkurve auf dem ROHWERT (Empfehlung)

Die Referenz aus Ansatz A liefert die zwei Zahlen, die Chris ausdruecklich verlangt („müsste man
dann wissen was ein krasser impact ist und was mittelmäßig"):

- **`I_mittel`** = der Median der Referenzverteilung. Das *ist* die Definition von „mittelmaessig".
- **`I_krass`** = ein hohes Quantil der Referenzverteilung (Vorschlag: 99,5). Das *ist* die
  Definition von „krass".

Die Kurve arbeitet dann auf dem **Rohwert**, nicht auf dem Perzentil — dort ist die Spitze noch
aufgefaechert (51,0 / 56,9 / 62,4 / 64,2 zwischen p99 und Maximum), und dort kann man eine echte
Abstufung zwischen „gutes Spiel" und „Jahrhundertspiel" erzeugen.

---

## 4. Der Vorschlag: die Impact-Kurve

### 4.1 Formel

```
Eingang:   I       roher Boxscore-Impact des Spielers (ArenaFixtureBoxscoreEintrag.wert)
           n       Feldgroesse dieses Spieltags (Spieler je Seite, 2..6)

Referenz:  I_mittel(n)   Median der Referenzverteilung fuer Feldgroesse n
           I_krass(n)    99,5-Perzentil der Referenzverteilung fuer Feldgroesse n

Regler:    MAX      = 5,5      Hoechstpunktzahl je Disziplin
           a_mitte  = 0,25     Anteil des Maximums fuer einen mittelmaessigen Auftritt

Ableitung: γ(n) = ln(a_mitte) / ln( I_mittel(n) / I_krass(n) )

Ergebnis:  PPs = MAX · min(1, ( max(0, I) / I_krass(n) )^γ(n) )
```

Fuer 6v6 mit den gemessenen Werten: `I_mittel = 11,1`, `I_krass = 56,9`, **`γ = 0,848`**.

### 4.2 Warum diese Form

- **Zwei benannte Anker statt freier Zahlen.** Die Kurve geht per Konstruktion durch
  (`I_mittel` → 25 % von MAX) und (`I_krass` → MAX). Beide Anker sind gemessene Eigenschaften der
  Disziplin, keine Erfindungen — dasselbe Prinzip, mit dem `battle-mode-pps-modell-plan.md` sein
  lineares Perzentil begruendet („mathematische Konsequenz statt drei separat gesetzter Zahlen"),
  nur mit einem Massstab, der nicht vom Tagesfeld abhaengt.
- **γ ist abgeleitet, nicht getunt.** Es gibt genau **zwei** Regler im ganzen Modell: `MAX` (wie
  hoch ist die Hoechstnote) und `a_mitte` (wie grosszuegig ist die Mitte). Das ist eine Frage
  weniger als heute, wo `MAX` frei ist und die Verteilungsform ungeprueft mitlaeuft.
- **Deckel statt Asymptote.** `min(1, …)` heisst: wer `I_krass` erreicht, bekommt die volle
  Punktzahl, und wer darueber liegt, auch. Das ist Chris' „max 5-6" woertlich genommen — eine
  Hoechstnote, die erreichbar ist, nicht eine, der man sich nur naehert.
- **Boden bei 0.** `max(0, I)` — ein negativer Impact (gemessen bis −4,8) gibt 0 PPs, nie negative.
  Das spiegelt die bestehende Bodenregel aus `distributeByValues`
  (`lib/resolve/rank-to-points.ts`), es ist keine neue Regel.
- **Saettigung ist im Motor bereits das Hausmuster.** `impactVon()` (`battle-mode.engine.js`, Kampf)
  rechnet `Beitrag = Gewicht·(1−e^(−Menge/Referenz))`. Die Potenzkurve mit γ<1 ist dieselbe Idee
  (abnehmender Grenzertrag), aber mit einem harten, benennbaren Endpunkt statt einer Asymptote —
  und genau der harte Endpunkt ist hier gebraucht, weil eine Asymptote die Spitze wieder
  zusammendrueckt (nachgerechnet: eine e-Funktion, auf denselben Median geeicht, gibt dem typischen
  Duellbesten 96 % der Hoechstnote — sie ersetzt Chris' Problem durch dasselbe Problem).

### 4.3 Die Kurve in Zahlen (6v6, MAX 5,5, a_mitte 0,25, γ 0,848)

| Referenz-Perzentil | Impact | **PPs neu** | PPs heute (Perzentil × 6,6) |
|---|---:|---:|---:|
| 5 | 0,0 | **0,00** | 0,33 |
| 10 | 1,4 | **0,24** | 0,66 |
| 25 | 4,2 | **0,60** | 1,65 |
| 50 (mittelmaessig) | 11,1 | **1,38** | 3,30 |
| 75 | 23,6 | **2,61** | 4,95 |
| 90 | 35,4 | **3,68** | 5,94 |
| 95 | 41,0 | **4,16** | 6,27 |
| 99 | 51,0 | **5,01** | 6,53 |
| 99,5 (krass) | 56,9 | **5,50** | 6,57 |

Und dieselbe Kurve auf die Verteilung der **Duellbesten** angewandt:

| Duellbester … | Impact | **PPs neu** |
|---|---:|---:|
| schwaechster gemessener | 25,7 | **2,80** |
| 10. Perzentil (schwaches Duell) | 34,5 | **3,60** |
| Median (typisches Duell) | 41,4 | **4,20** |
| 90. Perzentil (starkes Duell) | 52,8 | **5,16** |
| bester gemessener | 64,2 | **5,50** |

**Ein typischer Duellbester bekommt 4,2 von 5,5 — sichtbar unter der Hoechstnote.** Ein schwacher
Duellbester 3,6. Ein herausragender 5,5. Das ist die Auffaecherung, die heute fehlt (dort: 6,19 /
6,20 / 6,31).

---

## 5. Die Beispielrechnung, die der Auftrag verlangt

Zwei echte, gemessene Duelle aus der ausgehaltenen Teststichprobe: das staerkste Duell des starken
Spieltags und das staerkste Duell des schwachen Spieltags. „Perz. Tag" ist der Perzentilrang im
192er-Pool des jeweiligen Spieltags, also genau das, was der heutige Code rechnet.

**Schwacher Spieltag, Duell 28:34 (Saat 1450482)**

| Spieler | Eignung | Impact | Perz. Tag | **PPs heute** | **PPs neu** |
|---|---:|---:|---:|---:|---:|
| King Arlen Morgolor | 68,1 | 33,5 | 99,0 % | **6,53** | **3,51** |
| Tidesprinter | 50,7 | 29,2 | 88,5 % | 5,84 | 3,12 |
| Seraph-11 | 58,6 | 29,0 | 87,5 % | 5,77 | 3,11 |
| Cassandra | 55,1 | 17,0 | 60,4 % | 3,99 | 1,97 |
| Johanna | 45,6 | 15,8 | 58,3 % | 3,85 | 1,86 |
| Ralazar the Balanced | 51,0 | 11,0 | 45,3 % | 2,99 | 1,36 |
| Krolach | 38,9 | 8,2 | 37,0 % | 2,44 | 1,06 |
| Draco | 42,9 | 5,8 | 25,5 % | 1,68 | 0,79 |
| Lava Golem | 19,6 | 5,2 | 20,8 % | 1,38 | 0,72 |
| Gram | 40,1 | 1,8 | 7,8 % | 0,52 | 0,29 |
| Greenkraut | 36,6 | 1,4 | 7,3 % | 0,48 | 0,24 |
| Krag'Zul | 30,9 | 0,0 | 2,1 % | 0,14 | 0,00 |

**Starker Spieltag, Duell 33:65 (Saat 1561348)**

| Spieler | Eignung | Impact | Perz. Tag | **PPs heute** | **PPs neu** |
|---|---:|---:|---:|---:|---:|
| Cassandra | 61,1 | 67,4 | 99,5 % | **6,57** | **5,50** |
| Tidesprinter | 50,7 | 33,5 | 88,5 % | 5,84 | 3,51 |
| King Arlen Morgolor | 70,1 | 27,5 | 81,8 % | 5,40 | 2,97 |
| Ralazar the Balanced | 51,0 | 16,5 | 64,6 % | 4,26 | 1,92 |
| Krolach | 40,9 | 11,9 | 53,6 % | 3,54 | 1,46 |
| Johanna | 45,6 | 10,7 | 49,5 % | 3,27 | 1,33 |
| Seraph-11 | 56,6 | 8,5 | 45,3 % | 2,99 | 1,10 |
| Draco | 48,9 | 7,3 | 40,6 % | 2,68 | 0,96 |
| Gram | 40,1 | 4,6 | 29,2 % | 1,93 | 0,65 |
| Lava Golem | 19,6 | 2,5 | 21,4 % | 1,41 | 0,39 |
| Krag'Zul | 30,9 | 0,7 | 10,4 % | 0,69 | 0,13 |
| Greenkraut | 36,6 | −1,6 | 0,0 % | 0,00 | 0,00 |

**Die eine Zeile, um die es geht.** King Arlen Morgolor mit Impact **33,5** und Cassandra mit
Impact **67,4** — genau doppelt so viel — bekommen heute **6,53 gegen 6,57**. Unter der Impact-Kurve
bekommen sie **3,51 gegen 5,50**. Und der Zwischenfall ist auch abgedeckt: Tidesprinter produziert
im starken Duell dieselben 33,5 wie Arlen im schwachen und bekommt exakt dieselben 3,51 — der
Massstab haengt nicht mehr davon ab, in welchem Spiel man steht.

Das ist zugleich Chris' 95er/75er-Fall: Arlen (Eignung 68, der Beste seiner Partie, aber
mittelmaessiger Impact) landet bei 3,51 — deutlich unter Cassandras 5,50. Kein Eignungsterm noetig,
es faellt aus dem absoluten Massstab heraus.

### 5.1 Und der ganze schwache Spieltag

| | schwacher Spieltag | starker Spieltag |
|---|---:|---:|
| bester Impact des Tages | 33,5 | 67,4 |
| **hoechste PPs heute** | **6,53** | **6,57** |
| **hoechste PPs neu** | **3,51** | **5,50** |
| Duellbester im Mittel, heute | 6,19 | 6,31 |
| Duellbester im Mittel, neu | 3,31 | 5,35 |
| Duelle mit voller Punktzahl, heute (≥ 6,0) | 12 / 16 | 16 / 16 |
| **Duelle mit voller Punktzahl, neu (≥ 95 % von MAX)** | **0 / 16** | **11 / 16** |

**Damit ist Auftragspunkt 4 belegt: an einem schwachen Spieltag mit lauter mittelmaessigen Werten
bekommt niemand mehr als 3,51 von 5,5, und in keinem einzigen Duell faellt die volle Punktzahl.**

### 5.2 Ueber alle 400 gemessenen Duelle

| | Anteil der Duelle, in denen der Beste ≥ 99 % von MAX bekommt |
|---|---:|
| heutiges Modell | ~100 % (Tagesbester immer; ≥ 6,0 in 11–16 von 16) |
| Impact-Kurve, `I_krass` = Referenz-p99 | 12,9 % |
| **Impact-Kurve, `I_krass` = Referenz-p99,5 (Vorschlag)** | **7,1 %** |
| Impact-Kurve, `I_krass` = Referenz-p99,9 | 1,3 % |

`I_krass` ist also der Regler fuer „wie oft ist ein Jahrhundertspiel ein Jahrhundertspiel".
**Vorschlag p99,5**: rund einmal bis zweimal je Spieltag (16 Duelle) — selten genug, dass es etwas
bedeutet, haeufig genug, dass es vorkommt. Alle drei Zeilen sind eine Ein-Zahl-Aenderung in der
Referenzdatei, kein Codeeingriff.

### 5.3 Bekommt der Star seine Hoechstnote auch wirklich?

Chris' Bedingung ist zweiseitig: nicht nur „nicht jeder", sondern auch „ein 95er … **kann die
erreichen**". Gemessen ueber alle 400 Spiele, Spieler nach ihrem Eignungsrang **innerhalb ihres
Duells** sortiert:

| Rolle im Duell | mittlere PPs | Median | p10 | p90 | Anteil mit voller Punktzahl |
|---|---:|---:|---:|---:|---:|
| bester Eignungsspieler | 3,31 | 3,27 | 2,28 | 4,27 | 1,5 % |
| Nr. 2 | 2,81 | 2,71 | 1,62 | 4,11 | 0,5 % |
| Nr. 6 (Mitte) | 1,83 | 1,81 | 0,94 | 2,80 | 0,0 % |
| Nr. 12 (schwaechster) | 0,64 | 0,58 | 0,13 | 1,25 | 0,0 % |

Sauber monoton, mit echter Streuung innerhalb jeder Rolle (der beste Eignungsspieler schwankt
zwischen 2,28 und 4,27) — Eignung entscheidet die Tendenz, das Spiel den Ausschlag. **Achtung bei
den 1,5 %:** der Demokader hat keinen 95er, seine Spitze liegt bei Eignung ~70. In einem echten
Liga-Feld mit echten Sternen liegt der Anteil hoeher; die Zahl ist eine **Untergrenze**, kein
Zielwert. Das ist der wichtigste Grund, die Referenz aus echten Kadern zu ziehen (Abschnitt 8).

---

## 6. `MAX` neu bestimmt: 5,5

Auftragspunkt 3. Vier Kandidaten, dieselbe Kurve, dieselbe Referenz:

| MAX | Median-Spieler | 90.-Perzentil-Spieler | typischer Duellbester | **Ausschuettung je Team** |
|---|---:|---:|---:|---:|
| 5,0 | 1,25 | 3,34 | 3,82 | 9,25 |
| **5,5** | **1,38** | **3,68** | **4,20** | **10,18** |
| 6,0 | 1,50 | 4,01 | 4,58 | 11,10 |
| 6,6 (heute) | 1,65 | 4,41 | 5,04 | 12,21 |

Zum Vergleich derselbe Massstab im bestehenden System (`rank-to-points.json`, `playerCount` 6):
Rang 1 = 19,9 je Team, Rang 8 = 11,8, Rang 16 = 5,6.

**Begruendung fuer 5,5:**

1. **Es ist die Mitte von Chris' ausdruecklichem Rahmen „max 5-6".** 6,6 liegt ausserhalb. Die
   bisherige Wahl von 6,6 stuetzte sich auf `battle-mode-pps-modell-plan.md` Abschnitt 6, wo sie als
   „trifft Chris' eigenes Beispiel [5/2,5/0,5] am naechsten" begruendet wurde — dieses Beispiel war
   dort schon ausdruecklich „ein Beispiel, keine Vorgabe", und die neue Aussage ist praeziser und
   juenger. Sie hat Vorrang.
2. **Keine Inflation.** Mit 5,5 liegt die mittlere Team-Ausschuettung bei 10,2 — zwischen dem
   PPS-Rang 8 (11,8) und Rang 10, also im **unteren Mittelfeld** statt wie heute auf Meisterniveau
   (19,7). Ein Team, das schlecht spielt, bekommt spuerbar weniger als eines, das gut spielt: die
   Korrelation zwischen dem mittleren Impact eines Duells und den dort ausgeschuetteten PPs ist
   **0,97** (gemessene Team-Summen streuen von 7,7 bis 12,6). Heute ist sie strukturell null.
3. **Das Verhaeltnis Spitze zu Mitte bleibt gross genug**, um im Saison-Leaderboard sichtbar zu
   sein: 5,5 gegen 1,38 ist Faktor 4,0. Heute (6,6 gegen 3,3) ist es Faktor 2,0.
4. **6,6 hat einen versteckten Nebeneffekt**, der bei 5,5 verschwindet: `6,6/2 = 3,3` ist exakt der
   PPs-Wert je Spieler eines Rang-1-Teams bei **jeder** Feldgroesse (Abschnitt 2.1). Solange `MAX`
   6,6 ist, zahlt das Modell also im Mittel exakt Meisterniveau, und das sieht aus wie Absicht,
   obwohl es keine ist.

**Und `a_mitte`?** Chris' altes Beispiel („mittlerer Spieler ca. 2,5") entspricht `a_mitte ≈ 0,45`.
Das ist mit „nicht in jedem Duell volle Punktzahl" vereinbar (die Deckelquote haengt fast nur an
`I_krass`, nicht an γ), staucht aber den unteren Bereich:

| a_mitte | γ | Median-Spieler | typischer Duellbester | schwacher Duellbester | Spreizung schwach ↔ voll |
|---|---:|---:|---:|---:|---:|
| 0,45 („altes Beispiel") | 0,489 | 2,47 | 4,71 | 4,31 | 1,19 |
| 0,35 | 0,642 | 1,92 | 4,48 | 3,99 | 1,51 |
| **0,25 (Vorschlag)** | **0,848** | **1,38** | **4,20** | **3,60** | **1,90** |
| 0,20 | 0,985 | 1,10 | 4,02 | 3,36 | 2,14 |

**Empfehlung 0,25**, weil Chris' *neue* Aussage die Trennschaerfe an der Spitze betont („was ein
krasser impact ist und was mittelmäßig") und `a_mitte = 0,45` genau die zusammendrueckt: dort liegen
ein schwacher und ein voller Duellbester nur 1,19 PPs auseinander, bei 0,25 sind es 1,90. **Das ist
aber eine echte Geschmacksfrage und der eine Punkt, an dem eine Rueckfrage an Chris sich lohnt**,
weil sie in einem Satz beantwortbar ist: *„Ein voellig durchschnittlicher Auftritt — soll der ein
Viertel der Hoechstnote wert sein (1,4 von 5,5) oder knapp die Haelfte (2,4 von 5,5)?"*

---

## 7. Die Referenz MUSS nach Feldgroesse getrennt sein

Der wichtigste einzelne Fund fuer die Umsetzung, und er ist im alten Plan nicht enthalten.

`resolveDisciplinePlayerCount()` (`lib/resolve/rank-to-points.ts`) liest die tatsaechlich fuer
diesen Spieltag gewuerfelte Feldgroesse; Basketball lief in einer echten Saison nachweislich mit
`playerCount = 2` statt 6 (`battle-mode-pps-modell-plan.md` Abschnitt 1.2). Im Motor bestimmt die
Aufstellung, wer antritt (`bauFeldspiel`: `const mine=(gesetzt.length?gesetzt:ersatz).slice(0,n)`),
die Feldgroesse ist also real variabel.

**Der Rohwert skaliert massiv mit ihr** — dieselbe Spielzeit auf weniger Spieler verteilt:

| Feldgroesse | Median-Impact | 90. Perz. | 99. Perz. | 99,5. Perz. | typischer Duellbester |
|---|---:|---:|---:|---:|---:|
| 2v2 | 33,5 | 87,5 | 118,3 | 121,5 | 80,3 |
| 4v4 | 15,0 | 50,5 | 74,9 | 75,5 | 57,4 |
| 6v6 | 11,1 | 35,4 | 51,0 | 56,9 | 41,4 |

**Was passiert, wenn man die 6v6-Kurve auf ein 2v2-Spiel loslaesst:** der Median-Spieler bekommt
3,51 statt 1,38, und der typische Duellbeste bekommt **die volle Punktzahl 5,50** — in **jedem**
Duell. Man haette Chris' Problem exakt reproduziert, nur mit einem anderen Mechanismus. (Auch das
4v4-Feld kippt so: typischer Duellbester 5,50.)

**Konsequenz:** `I_mittel` und `I_krass` werden je Feldgroesse 2, 3, 4, 5, 6 hinterlegt. Das sind
zehn Zahlen. Abgeleitete γ aus der Messung: 2v2 → 1,08, 4v4 → 0,86, 6v6 → 0,85.

### 7.1 Unterzahl — ein Nebenrisiko, gemessen statt vermutet

Chris erlaubt ausdruecklich, mit weniger Spielern anzutreten („pruefe dass man auch mit 3v6
antreten kann"). Gemessen (40 Spiele je Fall, auf einer gepatchten Motor-Kopie, Demokader):

| | Median-Impact | Team-Summe PPs (neues Modell) | Anteil Spieler mit voller Punktzahl |
|---|---:|---:|---:|
| 6v6, Heim | 9,8 | 8,67 | 0,8 % |
| 6v6, Gast | 15,5 | 11,58 | 1,7 % |
| **3v6, Heim (Unterzahl)** | **5,5** | **2,91** | **0,0 %** |
| **3v6, Gast (gegen Unterzahl)** | **25,6** | **16,42** | **15,0 %** |

Die Unterzahl-Seite wird *nicht* belohnt (5,5 statt 9,8 — Unterzahl ist teuer, wie beabsichtigt).
**Aber die Ueberzahl-Seite kassiert ab**: Team-Summe +42 %, und 15 % ihrer Spieler bekommen die
volle Punktzahl statt 1,7 %. Der Endstand war 14,2 : 73,9 im Schnitt.

Unter dem heutigen Perzentil-Modell existiert dieselbe Verzerrung, sie faellt nur nicht auf, weil
dort ohnehin fast jeder Duellbeste die Hoechstnote bekommt. Unter einem absoluten Massstab wird sie
sichtbar. **Drei Optionen, in dieser Reihenfolge zu bewerten:**

1. **Nichts tun.** Verteidigbar: wer gegen ein halbes Team spielt, hat wirklich mehr geleistet als
   sonst, und der Fall ist selten. **Empfehlung fuer die erste Umsetzung.**
2. **Gegner-Unterzahl-Daempfer**: `I' = I · (gefelderte Gegner / n)`. Fuer 3v6 halbiert das den
   Rohwert der Ueberzahl-Seite auf 12,8 gegen den 6v6-Normalwert 15,5 — korrigiert also etwas ueber
   das Ziel hinaus, aber in der richtigen Groessenordnung. Eine Zeile.
3. **Referenz auf `min(eigene, gegnerische)` Feldgroesse schluesseln.** Konzeptionell sauber, aber
   die Referenz muesste dann fuer gemischte Paarungen gezogen werden — deutlich mehr Aufwand fuer
   einen seltenen Fall.

Der Punkt gehoert **benannt** in die Umsetzung, nicht stillschweigend ignoriert — genau wie beim
Namenskollisions-Risiko im heutigen Code.

---

## 8. Praktikabilitaet: wie die Referenz entsteht und wann sie erneuert wird

Auftragspunkt 5. **Nicht** bei jedem Spieltag 500 Spiele simulieren — das kostet bei ~3-4 s je
Fixture Stunden und macht das Resolve nicht-deterministisch.

### 8.1 Die Datei

`references/arena/basketball-impact-referenz.json`, Skizze:

```jsonc
{
  "disziplin": "basketball",
  "gezogenAm": "2026-09-03",
  "motorSha1": "2b001c14fed0247b0581167e6d6a2d1c78b7ce1a",  // battle-mode.engine.js
  "repoCommit": "48a0a707",
  "quelle": "runArenaFixtures gegen echte Liga-Kader aus dem live-save-Abbild",
  "fixturesJeFeldgroesse": 300,
  "feldgroessen": {
    "6": {
      "n": 3600,
      "quantile": { "p1": -0.4, "p5": 0.0, /* … p10 … p95 … */ "p99": 51.0, "p995": 56.9, "p999": 62.4 },
      "iMittel": 11.1,
      "iKrass": 56.9
    }
    // 2, 3, 4, 5 analog
  }
}
```

- **Die Formel liest nur `iMittel` und `iKrass`.** Das vollstaendige Quantilgitter steht daneben
  fuer Diagnose, fuer Rueckfragen („wo lag dieser Auftritt eigentlich?") und dafuer, `iKrass` ohne
  Neuziehen von p99,5 auf p99,9 umzustellen.
- **Provenienz ist Pflicht**, nicht Deko: `motorSha1` ist die eine Angabe, an der man sieht, ob die
  Referenz noch zum Motor passt.
- Laufzeitkosten im Resolve: zwei Objekt-Lookups und ein `Math.pow` je Spieler. Deterministisch,
  keine Simulation, kein Browser. **Guenstiger als heute** — der heutige Pfad sortiert je Spieltag
  einen 192er-Pool und macht 192 Binaersuchen.

### 8.2 Wie sie gezogen wird

Ein eigenes, **manuell** aufgerufenes Skript (Vorschlag `scripts/ziehe-impact-referenz.mjs`), das
`runArenaFixtures()` gegen **echte Liga-Kader** aus dem `live-save`-Abbild faehrt (`CLAUDE.md`,
Abschnitt „An die Spielstaende kommen") — **nicht** `feldspielProbe` mit dem Demokader, aus dem in
Abschnitt 1 genannten Grund: der Demokader ist eine andere Grundgesamtheit als die, auf die die
Kurve angewendet wird, und ein Massstab aus der falschen Grundgesamtheit ist genau der Fehler, den
dieses Dokument beheben soll.

Umfang: **≥ 300 Fixtures je Feldgroesse** (2 bis 6), ueber moeglichst viele verschiedene
Team-Paarungen beider Liga-Stufen, damit starke *und* schwache Teams im Massstab vorkommen. Bei
`playerCount` 6 sind das 3.600 Spielerwerte je Feldgroesse — genug, um p99,5 stabil zu schaetzen
(rund 18 Werte oberhalb). Kosten: ~3-4 s je Fixture, also ~20 min je Feldgroesse, ~1,5 h fuer alle
fuenf einzeln, deutlich weniger mit parallelen Browsern. **Einmalig, offline, nicht im Spielpfad.**

### 8.3 Wann sie erneuert wird — und der Waechter dafuer

**Bei jeder Aenderung, die den Rohwert verschiebt.** Konkret:

- `feldspielWert()` (Gewichte, neue Posten) — jede Aenderung dort,
- `SPIELDAUER_BASKETBALL` / `VIERTEL_*` — die Ursache der 2,5-fachen Drift seit dem 31.08.,
- das Basketball-Rezept, die Sub-Skill-Zuordnung, `BASKETBALL_POS_MOD`, die Slot-Aufschlaege,
- groessere Aenderungen an der Kadergenerierung oder am Attributniveau der Liga.

Da diese Liste in der Praxis nicht zuverlaessig abgearbeitet wird (die Drift zwischen dem 31.08.
und heute ist der Beleg), **braucht es einen Waechter statt einer Merkregel**:

> Ein Test zieht ~24 Spiele mit `feldspielProbe`, bildet den Median-Impact und vergleicht ihn mit
> `iMittel` der hinterlegten Referenz. Weicht er um mehr als ±25 % ab, schlaegt der Test fehl mit
> der Meldung, dass die Referenz neu gezogen werden muss.

Er misst absichtlich den **Median**, nicht die Spitze — der Median ist bei n=288 Werten stabil,
p99,5 waere es nicht. Das ist derselbe Gedanke wie der `HK_TW_BASIS`-Kommentar im Motor, nur
maschinell durchgesetzt statt als Kommentar gehofft. Auf dem Demokader gemessen ist das zulaessig,
weil der Test nur **Drift** feststellt, nicht das Niveau eicht.

### 8.4 Was **nicht** vorgeschlagen wird

- **Keine rollende Historie** ueber vergangene Spieltage/Saisons. Braucht
  `seasonState.arenaMatchResultLogs` (existiert nicht) und wuerde den Massstab wieder vom
  Spielstand abhaengig machen — zwei Spieler mit identischer Leistung bekaemen in verschiedenen
  Saves verschiedene PPs. Eine feste Referenz ist reproduzierbar und erklaerbar.
- **Keine Referenz aus dem laufenden Spielstand.** Dasselbe Argument, plus: sie waere in Saison 1
  leer.
- **Kein Zuschnitt je Liga-Stufe.** Chris hat den gemeinsamen Pool ueber beide Ligen am 31.08.
  entschieden; ein absoluter Massstab macht die Frage ohnehin gegenstandslos (es gibt keinen Pool
  mehr). Sein Zusatz „wir könnten später noch die PPs in Liga 2 zur Not runter skalieren mit einem
  Faktor" bleibt als spaeterer, unabhaengiger Multiplikator moeglich und wird hier nicht
  vorweggenommen.

---

## 9. Was sich im Code aendern muesste (Skizze, nicht gebaut)

| Datei | Aenderung |
|---|---|
| `references/arena/basketball-impact-referenz.json` | **neu** — Referenzquantile je Feldgroesse, s. 8.1 |
| `scripts/ziehe-impact-referenz.mjs` | **neu** — zieht die Datei, manuell, offline, s. 8.2 |
| `lib/resolve/battle-mode-arena-team-points.ts` | `computeIndividualBoxscorePpsFromFixtureResults()` verliert den Pool und den lokalen `percentileOf()`; bekommt stattdessen die Referenz und die Feldgroesse. `BASKETBALL_INDIVIDUAL_PPS_MAX` 6,6 → 5,5, dazu `BASKETBALL_PPS_ANTEIL_MITTE = 0.25` |
| — Signatur | braucht zusaetzlich die Feldgroesse des Spieltags (`resolveDisciplinePlayerCount()`, `lib/resolve/rank-to-points.ts`) — heute kennt die Funktion sie nicht |
| `lib/resolve/legacy-matchday-resolve-engine.ts` | unveraendert — die Map `playerId -> PPs` und ihre Anwendung bleiben gleich |
| `tests/battle-mode-arena-team-points.test.ts` | Perzentil-Randfaelle raus, Kurven-Randfaelle rein: `I ≤ 0` → 0, `I = iMittel` → `MAX·0,25`, `I = iKrass` → `MAX`, `I > iKrass` → `MAX` (Deckel), Feldgroessen-Weiche, fehlende Referenz |
| `tests/…-referenz-drift.test.ts` | **neu** — der Waechter aus 8.3 |

Die Funktion wird dabei **einfacher**: kein Sortieren, keine Binaersuche, keine Kopplung an den
uebrigen Spieltag. Ein Spieler-Ergebnis haengt nur noch von seinem eigenen Boxscore, der
Feldgroesse und einer Konstantendatei ab — reproduzierbar, einzeln nachrechenbar, und im Zweifel
gegenueber Chris in einem Satz erklaerbar: *„Dein Spieler hatte Impact 41; ein mittelmaessiger
Basketball-Auftritt liegt bei 11, ein herausragender bei 57 — also 4,2 von 5,5."*

---

## 10. Offene Fragen (bewusst nicht entschieden)

1. **`a_mitte` = 0,25 oder 0,45?** Der eine Regler, bei dem Chris' alte und neue Aussage
   auseinandergehen. Beantwortbar in einem Satz, s. Abschnitt 6.
2. **`I_krass` = p99,5 (7,1 % der Duelle mit voller Punktzahl) oder p99,9 (1,3 %)?** „Nicht in jedem
   Duell" ist mit beiden erfuellt; die Frage ist, wie selten ein perfektes Spiel sein soll.
3. **Unterzahl-Daempfer ja/nein** (Abschnitt 7.1). Empfehlung: erste Umsetzung ohne, mit einer
   benannten Fundstelle im Kommentar.
4. **Gleiche Kurve fuer alle zwanzig Disziplinen?** Die Form (Rohwert, Referenz je Feldgroesse,
   zwei Anker) sollte uebertragbar sein; die **Zahlen** sind je Disziplin und je Chassis eigene
   Messungen — Hockeys `feldspielWert` ist eine voellig andere Formel mit einem GSAA-Torwartzweig,
   und Buehne/Bahn/Arena haben eigene `wert()`-Funktionen. Der Ausbau gehoert je Disziplin gemessen,
   nicht generalisiert.
5. **Fliessen diese PPs in dieselben Saison-Ledger wie PPS-PPs?** Unveraendert offen aus
   `docs/design/boxscore-an-pps.md` — und mit dem neuen Modell **dringender**, weil die
   Ausschuettung jetzt echt schwankt (7,7 bis 12,6 je Team) statt konstant bei 19,7 zu liegen. Was
   heute wie eine reine Skalenfrage aussieht, aendert mit dieser Umstellung reale Saison-Ranglisten.

---

## 11. Belege

Alle Zahlen dieses Dokuments stammen aus Messungen dieser Runde, gegen `48a0a707`:

- 400 Spiele Basketball 6v6 (240 Referenz + 160 ausgehaltene Testspiele), je 60 Spiele 4v4 und 2v2,
  2 × 40 Spiele fuer die Unterzahl-Probe — alle ueber `window.__arena.feldspielProbe()` per
  Playwright/Chromium, Demokader des Mockups (Einschraenkung s. Abschnitt 1).
- Die Spieltage in Abschnitt 2 und 5 sind aus der **ausgehaltenen** Stichprobe gebaut; die
  Referenzquantile stammen ausschliesslich aus den 240 Referenzspielen. Kein Spiel steht in beiden.
- Die Skripte lagen im Scratchpad und sind bewusst **nicht** ins Repo uebernommen — der produktive
  Zieher gehoert nach Abschnitt 8.2 gegen echte Kader gebaut, nicht gegen den Demokader.
