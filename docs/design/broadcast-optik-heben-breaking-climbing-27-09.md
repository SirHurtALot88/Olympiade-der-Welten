# Broadcast-Optik für Gewichtheben, Breaking und Climbing — Recherche und Vorschläge (27.09.)

**Nur Recherche und Konzept.** Es gibt keinen Code und keinen PR. `engine.js` meint
`public/mockups/battle-mode.engine.js`, Stand `origin/main` `ebb3b99a` (27.09., nach Climbing PR 2
`431ee584`). Zeilenangaben beziehen sich auf diesen Stand.

Das Papier baut auf drei Vorgängern auf und wiederholt sie nicht:

* `broadcast-praesentation-runde-2-22-09.md`, kurz **Runde 2**: acht Regeln guter Sportgrafik,
  Highlight-Audit, Score-Bug, Timing-Tower, Führung im Bild.
* `ui-bewegungs-audit-26-09.md`: Gewichtheben und Climbing sind bei den Bewegungen die stärksten
  Disziplinen im Feld. Hier geht es deshalb nicht um Posen, sondern um das, was eine
  Fernsehregie **um** die Bewegung herum zeigt.
* Die Konzeptreviews vom 26.09. zu Gewichtheben (`gewichtheben-konzeptreview-26-09`, P1–P7) und
  Breaking (`breaking-konzeptreview-26-09`, P1–P6) sowie der Climbing-Gegencheck vom 24.09.
  Wo ein Vorschlag erst mit einer dort geplanten Mechanik Sinn ergibt, steht das dabei.

> **Breaking ist Folter, nicht Breakdance** (`CLAUDE.md`). Für Breaking sind in diesem Papier nur
> Folter-, Survival- und K.-o.-Kettenformate recherchiert: Slap-Fighting, Hot Ones, die
> Dschungelprüfung, Survivor-Ausdauerprüfungen und Kendo-Kachinuki. Battles, Musikalität und
> Publikums-Cypher kommen nicht vor.

---

## 0. Fazit vorweg

Die Kategorien stehen in Abschnitt 1. **A** heißt nur Anzeige, **B** heißt neues Motorfeld ohne
Wirkung aufs Ergebnis, **C** ändert den Ablauf-Takt, **D** berührt die Wertungslogik.

| Disziplin | # | Vorschlag | Kat. | Aufwand | Prio |
|---|---|---|---|---|---|
| Gewichtheben | H1 | **Versuchstafel je Heber:** 3 + 3 Kästchen mit kg, grün/rot/offen (die IWF-Anzeigetafel) | A | klein | **1** |
| | H2 | **„Braucht X kg"-Zeile** im Stoßen plus **nächste Ansage** erst nach dem Kampfrichterurteil | A | klein | **1** |
| | H3 | **Publikum:** Klatschrhythmus beim Antritt, Stille beim Zug, Ausbruch bzw. Raunen nach dem Urteil | A | klein | 2 |
| | H4 | **2:1-Lampen** bei knappen Versuchen, dazu das Signal „Ab!" | B | klein | 2 |
| | H5 | **Zeitlupe** des entscheidenden Versuchs als Bild-im-Bild | A (Einblendung) / C (Pause) | mittel | 3 |
| | H6 | Aufruf-Uhr 1:00 / 2:00 | A | klein | 4 |
| Breaking | B1 | **Kettenleiste im Kachinuki-Stil:** je Team sechs Plätze, Gebrochene gestrichen, Siegesserie des Stehenden | A | klein | **1** |
| | B2 | **HP-Balken im Kampfspiel-Stil** oben statt der ASCII-Blöcke, mit nachlaufendem Schadensstück | A | klein | **1** |
| | B3 | **Herzschlag statt Beat:** Takt und Bildpuls steigen, je tiefer die HP des Ertragenden fallen, ab 30 % „Bruchgefahr" | A | klein | **1** |
| | B4 | **Folterbank je Kampf statt je eigenem Zug**, mit Qual-Skala im Stil von Hot Ones | A (nur Anzeige) / D (mit P4) | klein | 2 |
| | B5 | **„GEBROCHEN"-Moment:** Standbild, Zeitlupe des letzten Anschlags, Eintrag in die Wand der Gebrochenen | A / C | mittel | 2 |
| | B6 | Standzeit-Uhr und Anschlagzähler je Kampf (Survivor, Power Slap) | A | klein | 3 |
| Climbing | C1 | **Veraltete Beschriftung „ZEITLIMIT — aktiviert in PR 2" ersetzen** durch einen echten Countdown (`zeitlimit` 16,3 s existiert seit PR 2) | A | trivial | **1** |
| | C2 | **Seil und Exen nach `u.hoch` statt `u.pos`**, dazu die V-Form nach dem Sturz und eine Höchstmarke je Route | A | klein | **1** |
| | C3 | **Griffart als Form** (Leiste, Sloper, Henkel, Zange, Dyno) aus `HUERDEN_TYP(i)`; heute sind alle Griffe gleich | A | klein | **1** |
| | C4 | **Duell-Band und Top-Lampe:** je Paar Vorsprung in Griffen, die Top-Lampe leuchtet wie das Speed-Pad | A | klein–mittel | 2 |
| | C5 | **Exe-Splits:** Klinkzeit je Exe mit Delta zum Duellpartner, in der viz-Schicht erfasst | A | klein | 2 |
| | C6 | **Sturz sichtbar:** Fall-Interpolation statt Teleport, Balance-Ring, dazu die Zeitlupe als Einblendung | A | mittel | 2 |
| | C7 | Duell-Fokus: Nahansicht des engsten Paars, beide Kletterer nebeneinander im Speed-Stil | A | mittel | 3 |

**Die günstigste Runde mit der größten Wirkung** besteht aus H1+H2, B1+B2+B3 und C1+C2+C3. Alle
neun Punkte sind reine Anzeige, jeder ist ein Nachmittag Arbeit, und keiner braucht eine der
offenen Mechanik-Entscheidungen.

---

## 1. Kategorien und Abnahme

| Kat. | Bedeutung | Abnahme |
|---|---|---|
| **A: nur Anzeige** | Liest bereits enthüllten Zustand und schreibt nur `viz*`-Felder, Canvas oder DOM. Kein `rr()`, kein Schreiben in `u.summe`, `u.runden`, `u.pos`, `u.hp` usw. Das ist derselbe Vertrag wie bei `stepHeben`, `stepClimbing` und `stepCypher`. | `node scripts/miss-alle-disziplinen.mjs 24 <disziplin>` vorher und nachher, bit-identisch. Dazu eine Sichtprüfung per `scripts/screenshot-disziplin.mjs`. |
| **B: Motorfeld ohne Ergebniswirkung** | Speichert beim Bau einen Wert, der ohnehin berechnet wird, zum Beispiel den Abstand eines Wurfs zur Schwelle. Es gibt keinen neuen `rr()`, `gueltig`, `kg` und `punkte` bleiben unverändert. Vorbild ist `r.knapp` beim Eiskunstlauf E0 (`KUER_KNAPP_ANTEIL`, `engine.js:16298`, Wurf-Abstand bei `:14236`). | wie A, zusätzlich eine Stichprobe von `spiele(d, saat).protokoll`, die identisch bleiben muss |
| **C: Ablauf-Takt** | Hält die Enthüllung kurz an, etwa für eine Wiederholung. Ergebnisse stehen vorab fest (`baueGauntlet`, `baueHebenDuelle`), der Takt ändert also nur die Spieldauer, nicht die Wertung. | wie A, zusätzlich die Spieldauer prüfen (Spieltag-Uhr, Headless-Runner) |
| **D: Wertungslogik** | Ändert, wer gewinnt. Kommt hier nur als Hinweis vor, wo eine Anzeige erst mit einer Review-Mechanik ehrlich wird. | rho kaderfest ≥ 0,80, Pp ≤ 25, wie immer |

**Spoiler-Regel**, wie bei `zeichneEisStand` und `zeichneHeben`: Gezeigt wird nur, was die
Enthüllung schon freigegeben hat. Bei Gewichtheben und Breaking liegen alle Ergebnisse vorab in
`u.runden`, deshalb braucht jede neue Anzeige eine Obergrenze `≤ u.aktuell`. Das ist der häufigste
Fehler, den ein Bau hier machen kann (siehe H2).

---

## 2. Recherche: Was echte Übertragungen zeigen

Belegt heißt: mit Quelle unten. Allgemeinwissen heißt: bekannte Fernsehkonvention, für die sich keine
Primärquelle zur Grafik fand. Die Weltfeeds von IWF und IFSC haben keine öffentliche
Grafikspezifikation. So ist es in der Tabelle auch markiert.

### 2.1 Olympisches Gewichtheben

| Element | Was es zeigt | Status |
|---|---|---|
| **Drei Kampfrichterlampen** weiß/rot, Mehrheit 2 von 3 entscheidet. Sobald zwei gleich drücken, kommt das **„Down"-Signal** (Summer plus Lichtzeichen: Hantel ablegen) | 2:1-Entscheidungen sind sichtbar und gehören zur Dramatik | belegt (JudgeMate, IWF TCRR 2025) |
| **Jury mit Videoprüfung**, die das Urteil der Kampfrichter umdrehen kann (Paris 2024: Pizzolato, letztes Stoßen, Jury gibt den Versuch, Bronze) | „Jury prüft …" als Spannungsmoment | belegt (NBC, Olympics.com) |
| **Aufruf-Uhr** 1:00, 2:00 bei zwei Versuchen in Folge, Warnsignal bei 0:30 | Druck vor dem Versuch | belegt (Suche, IWF TCRR); die Uhr-*Taktik* hat die Review als Mechanik verworfen |
| **Anzeigetafel mit Versuchskästchen**: drei für Reißen, drei für Stoßen, grün für gültig, rot für ungültig | *das* Bild der Übertragung: die ganze Geschichte eines Hebers in sechs Kästchen | belegt (Suche zu IWF-Anzeigetafeln) |
| **Nächste Ansage und Reihenfolge** („Nächster Versuch: 257 kg, geändert auf 258") | Taktik am Meldetisch | belegt (Review P7, IWF TCRR) |
| **„Braucht X kg für Gold/Führung"**, Bauchbinde vor dem letzten Stoßen | die eine Zahl, die aus einem Versuch ein Finale macht | Allgemeinwissen (Olympia-Übertragungen) |
| **Zeitlupe** des Umsetzens bzw. Ausstoßens, vor allem bei knappen und bei Jury-Entscheidungen | Beweis- und Dramabild | Allgemeinwissen, Jury-Video belegt |
| **Publikum:** rhythmisches Klatschen beim Antritt (bei Heimhebern am stärksten), Stille am Zug, Ausbruch beim weißen Licht | die Tonspur macht aus drei Sekunden ein Ereignis | Allgemeinwissen, keine Quelle gefunden |

### 2.2 Folter- und Survival-Formate für Breaking, ausdrücklich kein Breakdance

| Format | Element | Übertrag auf den Gauntlet | Status |
|---|---|---|---|
| **Power Slap** | Striker und Defender wechseln sich ab. Der Getroffene hat **60 s zur Erholung**. Es gibt drei Punktrichter, dazu einen Replay-Official. **Zeitlupe jedes Schlags aus drei Winkeln** ist fester Bestandteil der Übertragung. Die Runden werden angezeigt (3–5, ein Schlag je Runde). | Anschlagzähler, Zeitlupe des schwersten Treffers, Erholungs-Countdown (B5, B6) | belegt (powerslap.com/rules, TIME, Wikipedia) |
| **Hot Ones** | **Zehn Stufen, sichtbar aufgereiht, jede schärfer** (Scoville-Zahl je Soße, von etwa 2.000 bis über 2.000.000 SHU). Wer abbricht, landet in der **„Hall of Shame"**. | Die Folterbank hat bereits zehn Geräte. Es fehlen die Zahl je Stufe und die Wand der Gebrochenen (B4, B5). | belegt (Wikipedia, Hot-Ones-Wiki) |
| **Dschungelprüfung** („Ich bin ein Star – Holt mich hier raus!") | Wer nicht mehr kann, bricht mit dem festen Satz ab. Gezählt werden die bis dahin erspielten **Sterne**. | Aufgabe als eigener Moment mit eigenem Wort (B5); die Punkte des Ertragenden als „Sterne" dieser Prüfung | belegt (Stuttgarter Nachrichten, IBES-Wiki) |
| **Survivor, Ausdauerprüfung** | Letzter Stehender gewinnt, die **Ausfallreihenfolge** wird geführt, die **Standzeit** eingeblendet (Palau: 11:55 h) | Standzeit-Uhr je Kampf, Reihenfolge der Gebrochenen (B6) | belegt (Survivor-Wiki) |
| **Kendo-Kachinuki** | **Sieger bleibt** und kämpft gegen den Nächsten. Die Tafel zeigt beide Aufstellungen, Besiegte werden abgehakt. | genau die Kette seit dem 22.09.; es fehlt nur die Tafel (B1) | belegt (Norwalk-Tutorial, FIK-Regeln) |
| **Kampfspiel-Teammodus** (King of Fighters) | HP-Balken oben gespiegelt, der **zuletzt verlorene Teil läuft verzögert ab**, Porträts der Teamkollegen unter dem Balken, Rest-HP wird mitgenommen | B2; hier geht es nur um Bildsprache, kein Kalibriervorbild | Allgemeinwissen (so schon im Breaking-Review) |

Allen Formaten gemeinsam ist die Frage **„Wann gibt er auf?"**, und sie wird überall über drei
Zeichen erzählt: **eine Eskalationsleiter, die man vorher sieht** (Hot Ones, Folterbank), **ein
schwindender Vorrat** (HP, Sterne, Standzeit) und **ein Körpersignal** (Zucken, Atem, Herzschlag).
Der Gauntlet hat heute die Leiter und den Vorrat als Text. Das Körpersignal fehlt ganz, und aus dem
Vorrat wird keine Anspannung gebaut.

### 2.3 Wettkampfklettern (IFSC)

| Element | Was es zeigt | Status |
|---|---|---|
| **Lead:** Höhe als Griffnummer mit „+", Top mit Kletterzeit, 6-min-Limit mit sichtbarem Countdown | Wertung = höchster kontrollierter Griff (§9.1) | belegt (IFSC Rules 2025, siehe Gegencheck 1.1) |
| **Lead:** Live-Rang während des Versuchs („würde jetzt Platz 3 bedeuten") und die Marke des Führenden als Vergleich | der Zuschauer weiß bei jedem Griff, was er wert ist | Allgemeinwissen (IFSC-Weltfeed), keine Grafikquelle gefunden |
| **Lead-Sturz:** Fall ins Seil unterhalb der letzten Exe, Zeitlupe des Abgangs | das Bild des Lead: Seil in V-Form durch die höchste Exe | Seilphysik belegt (Wikipedia „Lead climbing", Gegencheck 1.3) |
| **Speed:** zwei genormte Bahnen nebeneinander, K.-o.-Duelle, **je Bahn eine Zeit**, die am Top-Pad stoppt, Lampe am Pad, Differenz zum Gegner, Fehlstart | Zweikampf auf identischen Parallelrouten | Format belegt (Olympics.com, Wikipedia Paris 2024); Grafikdetails Allgemeinwissen |
| **Duell-Formate** (Rock-Master-Lead-Duell, Psicobloc): identische Parallelrouten, entschieden im steilsten Teil | Vorsprung am Gegner, nicht an der Uhr | belegt (Gegencheck 1.2) |
| Zwischenzeiten an Referenzmarken, Balken für die Höhe | bei Speed Allgemeinwissen, keine belegte IFSC-Norm | **nicht belegt**, wird hier trotzdem vorgeschlagen, weil es Regel 3 aus Runde 2 („Delta statt Rohwert") auf unsere Exen überträgt |

Der Maßstab für Climbing ist der Gegencheck, also **Lead-Wand im Duellaufbau**. Aus dem Speed-Format
wird nur die **Bildsprache des Zweikampfs** übernommen (zwei Bahnen, zwei Zeiten, Pad-Lampe,
Delta), nicht die Wertung.

---

## 3. Ist-Stand im Motor: Was man heute sieht

### 3.1 Gewichtheben (`bodenHeben` `:17969`, `zeichneHeben` `:20336`, `stepHeben` `:16961`)

Das Bild ist gut, besser als bei den meisten Bühnen:

* Plattform mit **drei Kampfrichterlampen** (alle drei immer gleich, siehe H4) und Publikum als 26
  dunkle Silhouetten, die sich nicht bewegen.
* **Anzeigetafel** oben rechts mit Übung, Versuch n/3 und kg des aktuellen Versuchs.
* **Zweikampfstand** „2 : 1" groß in der Mitte, darunter „Duell n von m · Rolle".
* Zwei Heber Kopf an Kopf, die **Hantel an der Hand** mit IWF-Scheibenfarben (`zeichneHantel`
  `:499`), fünf Hebephasen (Antritt, Zug, Hoch, Ablage, Boden).
* Textkarte mit kg-Zahl grün/rot, „✓ gültig"/„✗ ungültig", Versuchszeile, Badge für den kühnen
  Versuch.
* Wartende Paare mit Ergebnis am unteren Rand.
* Ton (`TON_KATALOG.gewichtheben` `:25565`): Ansage, Stange, gültig, ungültig, Scheibenfall, dazu
  **Publikum als Rauschen-Schleife** ohne jeden Rhythmus.

Es fehlt die **Vergangenheit** (was hat der Heber schon geschafft?), die **Zukunft** (was muss er
noch schaffen, was sagt er an?) und jede **Tonspur, die auf den Versuch reagiert**.

### 3.2 Breaking (`zeichneBreaking` `:20941`, Kette `baueGauntlet` `:15769`)

* Ring mit vier Zonen (GEBROCHEN … MIND FORTRESS), die Figuren rücken nach `u.summe` Richtung
  Kern, der Führende trägt eine Krone.
* **Folterbank** mit zehn Geräten und „GERÄT · STUFE n/10". Die Stufe hängt an
  `folterStufe(u.aktuell, rundenN=8)` und klebt deshalb ab dem 8. eigenen Zug dauerhaft am
  Vorschlaghammer (Review 1.6).
* Zwei Duellanten mit Pose je Phase und dem Gerät in der Hand des Peinigers, dazu die Aufschrift
  ERTRÄGT/PEINIGT.
* **Zwei Seitentafeln** mit Name, `HP 212/400 █████░░░░░` als Textzeichen, Punkten und Kampfnummer.
* Ticker je Anschlag mit HP-Balken als Text. `big` gilt beim Ausscheiden
  (`feed(..., versuchBig||r.hpNach<=0)`, `:16065 ff.`).
* Ton: **`beat` als Schleife bei `BREAKING_BPM=100`** (`:13171`), dazu die Einzeltöne freeze, hieb
  und abbruch. Der Bildpuls (Kern-Glow, Takt der Anschlagspfeile) läuft auf denselben 100 BPM.
  Das ist ein Überbleibsel aus der Breakdance-Zeit: ein fester Tanz-Beat, der von nichts im Kampf
  abhängt.

Was fehlt: die **Kette als Ganzes** (wer ist noch übrig, wer ist gebrochen, wie lang ist die Serie
des Stehenden), ein HP-Balken, der als Balken lesbar ist, und jede Form von **Anspannung, die aus
dem Zustand kommt**.

### 3.3 Climbing (`bodenWand` `:26750`, `stepClimbing` `:30686`, Mechanik `stepSpurt` `:29481`)

* Wand mit Überhangschattierung, zwölf Routen, **zehn Griffe je Route, alle in gleicher Form und
  Farbe**. `BA().hindernisTypen` (`:27461`) und `HUERDEN_TYP()` (`:28135`, Layout je Spiel) kennen
  seit PR 2 fünf Griffarten, die Wand zeigt sie nicht.
* Sicherer am Wandfuß und **Seil durch die geklinkten Exen**. „Geklinkt" richtet sich nach
  `hoehe = u.pos` (`:26806 ff.`). Nach einem Sturz sinkt `u.pos` auf die Exe darunter. Die Exen
  darüber werden damit **wieder grau**, das Seil wird kürzer, und die Höchstmarke `u.hoch`, nach
  der tatsächlich gewertet wird, ist nirgends zu sehen.
* **Der Sturz ist ein Teleport:** `u.pos = zoneUnter` in einem einzigen Frame (`:29992`), dazu die
  Schwebezeile „rutscht ab" und eine Tickerzeile ohne `big`.
* **`"ZEITLIMIT — aktiviert in PR 2"`** steht unten rechts noch als Text (`:26844 ff.`), obwohl
  PR 2 `zeitlimit:16.3` gesetzt hat (`:27530`) und das Rennen daran endet (`:30399`). Das ist ein
  echter, sichtbarer Fehler: Der Zuschauer liest „kein Zeitlimit", dabei läuft eines.
* **Balance** (`u.balance`) und **Duelldruck** (`druckQuelle:"duell"`, Paare `floor(bahnZ/2)`,
  `:29694 ff.`) wirken, sind aber nicht zu sehen. Das Konzept hatte in 5.3 einen Balance-Ring
  vorgesehen. Gebaut wurde er nicht.
* Tickerzeilen „klinkt die erste/zweite/dritte Exe" (`stepClimbing`) und „rutscht ab und fällt ins
  Seil"; Zwischenzeiten gibt es nur beim Zeitfahren (`:27278`).

---

## 4. Gewichtheben — Vorschläge

### H1 — Versuchstafel je Heber (A, klein, Prio 1)

Unter Name und Zweikampf jedes der beiden Heber eine Reihe mit **3 + 3 Kästchen**, Reißen und Stoßen
durch eine kleine Lücke getrennt. In jedem Kästchen steht die kg-Zahl (`sinclairAnzeige`, dieselbe
Einheit wie die Textkarte).

* grün für gültig, rot für ungültig, grau mit Rahmen für den laufenden Versuch, leer für
  „kommt noch"
* das beste gültige Kästchen je Übung fett gerahmt, denn nur das zählt zum Zweikampf

**Daten:** `u.runden[0..u.aktuell]` (Spoiler-Regel). Das Kästchen des laufenden Versuchs wird erst
nach dem Übergang `zug→hoch|ablage` eingefärbt (`u.vizPhase`), also im selben Moment wie die
Lampen. **Platz:** Die Namenszeile sitzt bei `y+70`, der Zweikampf bei `y+84` und die Warteschlange
bei `H·0,90`. Dazwischen liegen rund 100 px, das reicht für eine 12-px-Kästchenreihe bei `y+98`.

**Warum zuerst:** Das ist das Bild, das jeder aus dem Fernsehen kennt, und es erzählt die
Aufholjagd im Stoßen, die das Review als dramaturgischen Kern bezeichnet (A.4), ohne ein Wort.
Heute sieht man immer nur den einen gerade laufenden Versuch.

### H2 — „Braucht X kg" und die nächste Ansage (A, klein, Prio 1)

1. **Bedarfszeile** im Stoßen, sobald der Gegner seinen letzten Versuch gemacht hat oder der
   Heber in seinen dritten geht: „**braucht 131 kg für den Duellsieg**" bzw. „führt, Gegner braucht
   127". Rechnung: Gegner-Zweikampf bisher minus eigenes bestes Reißen plus die kleinste
   Steigerung. **Beim Bau prüfen:** in genau der Einheit, in der `duellGewonnen` entschieden wird
   (Sinclair-normiert oder roh), sonst widerspricht die Zeile dem Ergebnis. Am Ende jedes Duells
   dagegenlaufen lassen.
2. **Nächste Ansage auf der Anzeigetafel** (`bodenHeben`, heute nur der laufende Versuch): „Nächster
   Versuch: Draco, 127 kg". **Spoiler-Falle:** Nach einem Fehlversuch senkt der Motor die Last um
   6 % (`HEBEN_FEHL_REDUKTION`, Review B.3). Die nächste Ansage verrät deshalb, ob der *laufende*
   Versuch misslingt. Sie darf erst erscheinen, wenn der laufende Versuch aufgelöst ist
   (`u.vizPhase` ist `hoch` oder `ablage`). Das ist zugleich die echte Reihenfolge: Die neue Ansage
   kommt nach dem Urteil.
3. Das Nachziehen des Zweiten im dritten Versuch (Review A.1, „zieht nach") als kurzes gelbes
   „↑ +1 kg" an der Tafel. Das ist die einzige Ansage-Änderung, die der Motor heute kennt.

Ehrlicher Hinweis aus Review P7: Solange die Last kein Risiko kostet (P1 offen), bleibt die Ansage
Information ohne Entscheidung. Die Bedarfszeile hängt davon **nicht** ab, sie liest nur den Stand.

### H3 — Publikum als Tonspur des Versuchs (A, klein, Prio 2)

`stepHeben` kennt die Phasen bereits: `boden → antritt → zug → hoch | ablage`.

| Phase | Ton (neu, in `TON_KATALOG.gewichtheben`) | Bild |
|---|---|---|
| `antritt` | **Klatschrhythmus**, der schneller wird (`tonKlick` in steigender Folge), lauter für die Heimseite | Silhouetten in `bodenHeben` wippen im Takt (y-Versatz aus `buehneT`) |
| `zug` | Schleife auf 20 % absenken, **Stille** | Silhouetten stehen still |
| `hoch` (gültig) | Ausbruch: `tonRauschen`-Anschwellen plus der vorhandene Doppelton | Silhouetten springen einmal |
| `ablage` ohne `hoch` (ungültig) | Raunen: tiefes, kurzes Rauschen | — |

Die Tonauslösung hängt an denselben Übergängen, die `zeichneHeben` schon für
`gueltig`/`ungueltig` nutzt (`_tonPhase`, `:20410 ff.`). `sfx()` ist ohne AudioContext ein No-Op,
die Messung bleibt also unberührt.

### H4 — 2:1-Lampen und „Ab!"-Signal (B, klein, Prio 2)

Heute leuchten alle drei Lampen immer gleich. Vorschlag nach dem Eiskunstlauf-Muster E0: In
`hebeUebung` (`:14802`) den ohnehin gezogenen Wurf gegen `p` vergleichen und
`r.knapp = |wurf − p| < ε` speichern, **ohne weiteren `rr()`**. Bei `knapp` zeigen die Lampen 2:1
(weiß-weiß-rot bzw. rot-rot-weiß, welche Lampe abweicht, entscheidet `u.id % 3`, nicht der
Zufall). Dazu gibt es **„AB!"** als Summer und Lichtblitz genau beim Übergang `zug→hoch`, dem Moment,
in dem die zweite Lampe fällt.

**Nicht vorgeschlagen:** Eine Jury, die ein Urteil **umdreht**. Das änderte `gueltig`, gehört also in
Kategorie D und würde den kühnen Versuch und den Zweikampf verschieben. Erlaubt wäre höchstens ein
„Jury bestätigt" als kurze Einblendung bei einem knappen, ungültigen Versuch, der das Duell
entscheidet. Das ist reines Theater und sollte nur mit Chris' Zustimmung kommen (Frage 1).

### H5 — Zeitlupe des entscheidenden Versuchs (A oder C, mittel, Prio 3)

Das Bild des Versuchs ist vollständig durch `(u, r, vizPhase, vizPhaseT)` bestimmt. Eine
Wiederholung braucht deshalb **keine Bildaufzeichnung** (die hat Runde 1 zu Recht als zu teuer
verworfen, Kommentar bei `renderHighlights`). Es reicht, dieselbe Phasenmaschine auf einer
**Kopie** des Hebers mit `dt·0,35` noch einmal laufen zu lassen.

* **Variante A, Bild-im-Bild** (empfohlen): ein Kasten 220×150 unten links mit „WIEDERHOLUNG" und
  demselben `zeichneSprite` samt Hantel in Zeitlupe, während vorne das nächste Paar beginnt. Der
  Takt bleibt gleich.
* **Variante C, Vollbild mit Pause:** Die Enthüllung hält etwa 3 s an. Das wirkt stärker, ändert
  aber die Spieldauer, deshalb nur mit Abnahme C.
* **Auslöser**, selten nach Runde-2-Regel 8: der Versuch, der ein Duell entscheidet
  (`duellGewonnen` wechselt), ein kühner Versuch, ein gültiger dritter Versuch nach zwei
  Fehlversuchen (die Rettung vor der Nullwertung). Höchstens zwei oder drei je Spiel.

### H6 — Aufruf-Uhr (A, klein, Prio 4)

Eine Uhr 1:00 an der Anzeigetafel, **2:00, wenn derselbe Heber zweimal hintereinander dran ist**.
Das liest die echte Reihenfolge im dritten Versuch. Sie tickt in Zuschauerzeit während `boden` und
`antritt` und bleibt beim Zug stehen. Mehr als Kulisse ist das nicht (die Uhr-Taktik hat das
Review verworfen, B.4). Deshalb steht sie zuletzt und fliegt als Erstes raus, wenn die Tafel zu voll
wird.

---

## 5. Breaking (Folter-Gauntlet) — Vorschläge

### B1 — Kettenleiste im Kachinuki-Stil (A, klein, Prio 1)

Am oberen Rand steht links die Heimaufstellung, rechts die der Gäste, je sechs Plätze in
Kampfreihenfolge:

* **Gebrochene:** grau und diagonal gestrichen, mit kleiner Kampfnummer („✗ K3")
* **Der Stehende:** Rahmen in Teamfarbe, darunter eine Mini-HP-Linie, daneben die **Siegesserie**
  („3 in Folge")
* **Wartende:** in voller Farbe, aber gedimmt

Mittig zwischen den beiden Leisten stehen „**Kampf 5**" und „noch 4 : 2 im Rennen", die Zahl, die
beim Kachinuki die Tafel trägt.

**Daten:** `u.raus` und `u.bout` aus der Enthüllung, nicht aus `baueGauntlet` direkt, denn dort
steht schon das Ende (Spoiler-Regel). Als Rang gilt, wer bis zum aktuellen Queue-Zeiger gebrochen
ist.

**Warum zuerst:** Die Kette ist Chris' Kernidee vom 22.09. („Sieger kämpft dann gegen Spieler 2
[…], HP nimmt er mit"), und heute sieht man sie nicht. Die Seitentafeln zeigen nur das laufende
Paar. **Hinweis:** Die Leiste macht auch den Befund P3.1 des Reviews sichtbar, denn die
Kampfreihenfolge folgt der TDM-Eignung und nicht der Slot-Reihenfolge. Das ist gut so: Wer die
Leiste sieht, fragt sofort, warum Slot 6 als Erster kämpft.

### B2 — HP-Balken im Kampfspiel-Stil (A, klein, Prio 1)

Die ASCII-Blöcke `█████░░░░░` (`gauntletBalken`, `:15822`) werden durch zwei **gespiegelte Balken**
oben ersetzt (Heim links nach innen, Gast rechts nach innen):

* Füllung in Teamfarbe, unter 30 % pulsierend rot
* **Nachlaufendes Schadensstück**: Der gerade verlorene Teil bleibt 0,4 s hell und läuft dann ab
  (ein `vizHpAnzeige`-Feld nähert sich `hpNach`, wie `vizUhrAnzeige` beim Schach)
* der Unterschied zwischen 10 HP (standgehalten) und 24 HP (eingebrochen) wird damit **sichtbar**,
  ohne dass jemand eine Zahl liest

Die Textzeile in den Seitentafeln kann bleiben (Barrierefreiheit), dann aber ohne Blockzeichen.

### B3 — Herzschlag statt Beat, Bruchgefahr (A, klein, Prio 1)

Der feste 100-BPM-Beat (`breaking.beat`, `BREAKING_BPM`) wird durch einen **Herzschlag des
Ertragenden** ersetzt:

* Tempo aus HP: 70 BPM bei vollen HP bis 150 BPM kurz vor 0; Ton `tonSchlag` doppelt (lub-dub),
  leise
* derselbe Takt treibt den Kern-Glow und den Pfeiltakt, die heute an `BREAKING_BPM` hängen
* **„BRUCHGEFAHR"** unter 30 % HP: Vignette zieht sich zusammen, das Publikum im Ton wird leiser
  (Stille vor dem Bruch), die Schrift auf der Tafel des Ertragenden wird rot. Das ist die Übersetzung
  von „wird er aufgeben?" in ein Körpersignal.

**Daten:** nur die zuletzt enthüllte `hpNach` des Ertragenden. **Wichtig:** Den Takt nicht in
Motorzeit aus `rr()` ableiten und keine Glättung über künftige Züge bilden, sonst spoilert die
Beschleunigung den Ausgang.

**Abgrenzung zum Review:** P2 (Bruchschwelle) würde „aufgeben, bevor die HP leer sind" zur Regel
machen. B3 erzählt bis dahin dieselbe Anspannung, ohne die Wertung zu berühren. Kommt P2, liest die
Bruchgefahr-Anzeige die Schwelle statt der festen 30 %.

### B4 — Folterbank mit Eskalation je Kampf und Qual-Skala (A bzw. D, klein, Prio 2)

1. **Anzeige-Fix:** `folterStufe` bekommt den **Zug im laufenden Kampf** statt `u.aktuell` (die
   Zugzahl des Kämpfers über alle Kämpfe). Jeder Kampf beginnt damit beim Strick und steigt sichtbar
   an. Heute klebt ein Veteran ab Zug 8 am Hammer (Review 1.6).
2. **Qual-Skala im Stil von Hot Ones:** Unter jedem Gerät steht eine fiktive, steigende Zahl (etwa
   „Qual 1.200 … 2.000.000"), unter dem aktiven groß. Die Leiter wird damit zur Zahl, die man
   vorher sieht.
3. **Ehrlich bleiben:** Solange der Schaden für alle zehn Geräte gleich ist (10/24), ist die
   Eskalation reine Kulisse. Kommt Review P4 (Grundschaden +8 % je Stufe), wird dieselbe Anzeige
   wahr. Dann gehört sie in Kategorie D und in die Messung von P4. Bis dahin sollte die Qual-Zahl
   **keine Schadenszahl** behaupten, also kein „+8 %" auf der Tafel.

### B5 — Der Moment „GEBROCHEN" (A oder C, mittel, Prio 2)

Wenn `r.hpNach<=0` enthüllt wird, gibt es heute eine fette Tickerzeile und den Callout. Vorschlag in
drei Schritten:

1. **Standbild 0,5 s:** Das Bild friert ein, dazu Entsättigung und der Stempel „GEBROCHEN" über dem
   Ertragenden (das Wort der äußersten Ring-Zone).
2. **Zeitlupe des letzten Anschlags** (nach Power Slap): Die `rueckzug`-Phase läuft auf einer Kopie
   noch einmal mit `dt·0,3`, Gerät und Peiniger inklusive. Das gleiche Prinzip wie H5, also keine
   Bildaufzeichnung. Als Bild-im-Bild (A) oder mit kurzer Pause der Enthüllung (C, die stärkere
   Wirkung).
3. **Wand der Gebrochenen** (nach der „Hall of Shame" von Hot Ones): Der Gebrochene rückt als kleines
   graues Porträt an den Rand der Folterbank. Das ist dieselbe Information wie in B1, nur als Bild.

Die Seltenheit ergibt sich von selbst: höchstens elf Brüche je Spiel, nach Runde-2-Regel 8 genau
richtig dosiert.

### B6 — Standzeit und Anschlagzähler (A, klein, Prio 3)

Auf der Tafel des Ertragenden: „**Anschlag 14 · Standzeit 0:42**", Standzeit in Zuschauerzeit seit
Beginn des Kampfes (Survivor). Dazu kurz vor dem nächsten Anschlag ein Erholungs-Countdown „3…2…1",
wie die 60 s bei Power Slap. Dieser Countdown ist **reine Pausenbeschriftung** der vorhandenen
`rundenDauer` und keine neue Pause.

**Nicht vorgeschlagen:** Punktrichter-Karten. Im Gauntlet entscheidet der HP-Stand und keine Jury,
Karten würden eine Wertung behaupten, die es nicht gibt. Peiniger-Punkte (Review P1, offene Frage 4)
wären etwas anderes, das ist Kategorie D.

---

## 6. Climbing — Vorschläge

### C1 — Echter Countdown statt des PR-2-Platzhalters (A, trivial, Prio 1)

`bodenWand` schreibt unten rechts weiter „ZEITLIMIT — aktiviert in PR 2", obwohl PR 2 gemergt ist
und `zeitlimit:16.3` das Rennen beendet. Ersatz:

* **Lead-Countdown** „1:11 … 0:00" in Zuschauerzeit (`(zeitlimit − rennT) · ZEIT_DEHNUNG.climbing`,
  16,3 × 4,38 ≈ 71 s) an derselben Stelle; die letzten 10 s rot und pulsierend
* bei 0: Callout „**ZEIT!**", die Tickerzeile als `big` (dieser Satz stand schon im Gegencheck unter
  PR 4)
* Wer die Konvention „6:00" aus dem echten Lead will, kann die Zahl auf 6:00 skalieren. Empfehlung:
  **Zuschauerzeit**, weil sonst die Uhr schneller läuft als eine echte Sekunde und das beim Hinsehen
  auffällt.

Das ist kein Schönheitsfehler, sondern eine **Falschinformation im Bild**. Deshalb steht C1 vor
allem anderen, und es reicht eine Zeile.

### C2 — Seil und Exen nach Höchstmarke, Sturz in V-Form (A, klein, Prio 1)

* **Geklinkt** heißt `u.hoch ≥ Exe`, nicht `u.pos ≥ Exe`. Eine einmal geklinkte Exe bleibt grün.
* **Seilverlauf:** Sicherer → alle geklinkten Exen bis zur höchsten → **zurück nach unten zum
  Kletterer**, wenn `u.pos < höchste geklinkte Exe`. Das ist das V-Bild jedes Lead-Sturzes, und es
  zeigt ohne Text, dass jemand „im Seil hängt".
* **Höchstmarke je Route:** eine kleine Kerbe bzw. ein Wimpel in Teamfarbe bei `camY(u.hoch)`, mit
  „Griff 7+" daneben (Lead-Notation, Gegencheck 3.4). Es zählt die Kerbe, nicht die Figur. Das ist die
  Wertungsregel, sichtbar gemacht.
* **Linie des Führenden** über die ganze Wand in Höhe der besten Höchstmarke aller Kletterer (die
  Weltrekordlinie im Schwimmen, Runde-2-Regel 5). Dünn gestrichelt, in der Farbe des führenden
  Teams.

Daten: `u.hoch`, `u.pos`, `u.fertig`. Alles wird schon von `bahnRangliste()` und `wert()` gelesen.

### C3 — Griffarten als Form (A, klein, Prio 1)

`bodenWand` zeichnet zehn gleiche Ellipsen. PR 2 hat aber fünf Arten mit eigenem Sub-Skill
eingeführt, und das Layout wechselt je Spiel (`HUERDEN_TYP(i)` liest `bahnFallenTypen`). Vorschlag
nach Gegencheck 3.7:

| Art | Form (Primitive) |
|---|---|
| Leiste (TECHNIK) | flaches Rechteck, 14×3 px |
| Sloper (WENDIGKEIT) | halbe Kugel mit Glanz |
| Henkel mit Exe (STEHEN) | Bügel plus die vorhandene Exe |
| Zange (WUCHT) | hoher, schmaler Block |
| Dyno (ANTRITT) | zwei Griffe weit auseinander, gestrichelte Sprunglinie dazwischen |

**Farbe:** **eine Farbe je Route bzw. Layout** wie in echten Wettkampfhallen, nicht je Art. Die Art
steckt in der Form. Eine kleine Legende erscheint nur beim ersten Erreichen der jeweiligen Art. Die
Tickerwörter aus dem Konzept („hält die Leiste", „zieht die Zange durch") passen dann zum Bild. Das
ist Chris' „man soll einen Unterschied sehen, ob jemand eine meistert", diesmal an der Wand.

**Wichtig:** `HUERDEN_TYP(i)` verwenden und nicht `BA().hindernisTypen` direkt, sonst zeigt die Wand
das Grundlayout statt des gewählten.

### C4 — Duell-Band und Top-Lampe (A, klein–mittel, Prio 2)

Die sechs Paare (`floor(bahnZ/2)`) klettern nebeneinander auf gespiegelten Routen. Das ist
Rock-Master- bzw. Speed-Bildsprache, sie wird nur nicht gezeigt.

* **Duell-Band am Wandfuß** zwischen den beiden Routen eines Paars: Kästchen mit dem Vorsprung in
  Griffen der Höchstmarke („+2", Teamfarbe des Führenden, grau bei Gleichstand). Ein
  Führungswechsel im Paar blitzt auf und ist zugleich die Tickerzeile „**zieht vorbei**" (Gegencheck
  PR 4) samt `big`, aber nur beim **ersten** Wechsel je Paar oder in der letzten Exe-Strecke.
  Sonst wird es wieder ein Protokoll.
* **Top-Lampe** über jeder Route, wie das Zeit-Pad beim Speed: Beim Top leuchtet sie in Teamfarbe,
  daneben steht die Zeit „TOP 0:48", und gewinnt jemand das Paar mit einem Top, blinkt die Lampe
  kurz grün.
* Der Duelldruck (`u.balance` sinkt, wenn der Partner vorn ist) wird damit **erklärbar**: Man sieht,
  wer vorn ist, und C6 zeigt, wer wackelt.

### C5 — Exe-Splits gegen den Duellpartner (A, klein, Prio 2)

`stepClimbing` merkt das erste Klinken jeder Exe schon (`u.vizExeN`, mit Tickerzeile). Dort wird
zusätzlich **`u.vizExeT[i] = rennT`** gespeichert. Bei der zweiten Klinkung im Paar erscheint am Seil
neben der Exe eine Split-Einblendung „**Exe 2 · +1,4 s**" in Teamfarbe des Schnelleren, 2 s lang.

* Nur das **erste** Klinken zählt. Wer nach einem Sturz ein zweites Mal klinkt, bekommt keinen neuen
  Split, genau wie die Höchstmarke.
* **Warum in der viz-Schicht und nicht über `BA().zwischenzeiten`:** Das Konfigurationsfeld schaltet
  in `stepSpurt` einen Aufzeichnungszweig des Motors ein (Runde 2, 7.2, „verifizieren"). Die
  viz-Schicht ist per Vertrag bit-identisch, die Messung ist dann bloß die Bestätigung.
* Optional kommen dieselben Splits als Spalten „Exe 1/2/3" in die Wertungstabelle, mit Delta zur
  besten Zeit (das Zeitfahrmuster aus `WERTUNG_RENNEN`).

### C6 — Sturz sichtbar machen (A, mittel, Prio 2)

1. **Fall-Interpolation statt Teleport:** Beim Anstieg von `u.abgerutscht` merkt sich `stepClimbing`
   `vizFallVon = u.hoch` (bzw. die letzte gezeichnete Höhe), und die **gezeichnete** Figur fällt über
   0,5 s Zuschauerzeit mit leichtem Nachfedern ins Seil (Seil-V aus C2). Das Motor-`u.pos` ist längst
   unten, gezeichnet wird ein Versatz. Dasselbe Prinzip wie der Sturz-Teleport-Fix beim Eiskunstlauf
   (13.09., Kommentar bei `KUER_KNAPP_ANTEIL`).
2. **Balance-Ring** um jeden Kletterer (Konzept 5.3, nicht gebaut): ein Kreisbogen aus `u.balance`,
   ab 0,6 gelb, unter 0,4 rot und zitternd. Das ist die Antwort auf „man sieht nicht, dass jemand
   wackelt", und er macht den Duelldruck sichtbar, der heute nur im Motor existiert.
3. **Zeitlupe des Sturzes** als Bild-im-Bild (wie H5, Variante A): die Route in der Nahansicht, die
   Figur fällt mit `dt·0,3` von `vizFallVon` zur Exe. Auslöser ist nur der Sturz des **Paar-Führenden**
   oder einer in der oberen Crux (über 0,53). Dazu das `big` für die Tickerzeile, denn heute ist der
   Bahn-Ticker ohne jedes Highlight (Runde 2, 4.2).

### C7 — Duell-Fokus: Nahansicht des engsten Paars (A, mittel, Prio 3)

Das Muster ist die Brett-Nahansicht bei Speed-Schach und die Nahansicht bei Tennis und Fechten
(`6ec60db5`). Alle 6–8 s rückt die Regie das **engste** Paar (kleinste Differenz der Höchstmarken,
beide noch in der Wand) in einen Kasten am rechten Rand:

* zwei Routen nebeneinander, größer gezeichnet, darunter **zwei Zeiten** bzw. „Griff 6+ / Griff 7" wie
  die zwei Bahnuhren beim Speed
* **Höhenbalken** senkrecht zwischen beiden, die Füllung zeigt `u.hoch` beider, die Differenz ist
  schraffiert
* Der Rest der Wand bleibt die Übersicht. Die Kamera (`camY`) wird **nicht** angefasst, sonst leidet
  der Blick auf alle zwölf.

Prio 3, weil C2, C4 und C5 den Vergleich schon in der Übersicht leisten. C7 lohnt sich, wenn Chris
beim Zuschauen sagt, die Figuren seien zu klein. Dieser Befund ist beim Bewegungs-Audit für Climbing
**nicht** gefallen.

---

## 7. Übergreifend: Reihenfolge und Abhängigkeiten

| Reihe | Paket | Warum hier |
|---|---|---|
| 1 | **C1** allein, sofort | Falschinformation im Bild, eine Zeile |
| 2 | **H1 + H2**, **B1 + B2 + B3**, **C2 + C3** | reine Anzeige, je Disziplin ein kleiner PR, größter sichtbarer Gewinn |
| 3 | **H3, H4, B4.1, C4, C5** | Tonspur, 2:1-Lampen (ein Motorfeld der Kategorie B), Folterbank-Fix, Duell-Band, Splits |
| 4 | **H5, B5, C6** | die drei Wiederholungen. Sie teilen **ein** Bauteil: „Bild-im-Bild-Kasten, der eine Figur auf einer Kopie mit gestreckter `dt` noch einmal durch ihre Phasenmaschine schickt". Einmal bauen, dreimal nutzen. |
| 5 | H6, B6, C7 | Kulisse bzw. nur bei Bedarf |

Abhängigkeiten von der Mechanik:

* **B4.2/B4.3** wird erst mit Review P4 (Breaking) wahr. **H2.2** (Ansage) gewinnt erst mit P1/P2
  (Gewichtheben) an Bedeutung. Beides kann trotzdem vorher kommen, wenn die Beschriftung nichts
  behauptet, was der Motor nicht tut.
* **B1** sollte vor Breaking P3.1 (Slot-Reihenfolge) kommen. Sie macht den Befund sichtbar und ist
  danach sofort richtig.
* **Score-Bug-Kontextzeile** (Runde 2, Vorschlag 3) passt zu allen dreien: „Stoßen · V3 · Duell
  4/6", „Kampf 5 · 4 : 2 im Rennen", „Zeit 0:23 · 4 Tops". Das ist eine Zeile je Disziplin in
  `aktualisiereBbug` (`:12368`), falls der Bug-Ausbau inzwischen gebaut ist.

**Abnahme je PR:** `miss-alle-disziplinen.mjs 24 gewichtheben|breaking|climbing` vorher und nachher,
auf drei Stellen identisch. Für H4 zusätzlich den Protokollvergleich, für H5/B5 in Variante C die
Spieldauer. Sichtprüfung mit den bekannten Saaten (`sicht-1337`, `sicht-7`) im Standalone-Mockup.
`/dev-arena` rendert die React-Bühne, nicht den Motor (Runde 2, 1.3).

---

## 8. Offene Fragen an Chris, mit Voreinstellung

1. **Jury beim Gewichtheben:** Darf eine „Jury bestätigt"-Einblendung kommen, ohne je ein Urteil
   umzudrehen? Voreinstellung: nein, 2:1-Lampen reichen.
2. **Wiederholung mit Pause oder als Bild-im-Bild?** Voreinstellung: Bild-im-Bild (der Takt bleibt
   gleich). Die Pause wirkt stärker und verlängert den Spieltag um etwa 10–20 s je Disziplin.
3. **Breaking-Ton:** Herzschlag statt Beat (B3)? Voreinstellung: ja, der Beat ist ein
   Breakdance-Überbleibsel.
4. **Climbing-Uhr:** Zuschauerzeit (1:11) oder Lead-Konvention (6:00 skaliert)? Voreinstellung:
   Zuschauerzeit.
5. **Qual-Skala (B4):** fiktive Zahl im Hot-Ones-Stil, oder nur Stufe n/10 wie heute?
   Voreinstellung: Zahl, sobald P4 den Schaden eskalieren lässt, vorher Stufe.

---

## Quellen

**Gewichtheben**

* IWF, *Technical and Competition Rules & Regulations 2025* (Uhr, Kampfrichter, Jury):
  [iwf.sport TCRR 2025](https://iwf.sport/wp-content/plugins/download-monitor/download.php?id=598)
* [JudgeMate — How Is Weightlifting Judged? The 3-Referee System](https://www.judgemate.com/en/guides/how-weightlifting-is-judged)
  (weiß/rot, 2 von 3, „Down"-Signal, Jury mit Video)
* [NBC Olympics — Weightlifting 101](https://www.nbcolympics.com/news/weightlifting-101-olympic-rules-violations-and-competition-format),
  [Olympics.com — Weightlifting rules](https://www.olympics.com/en/news/weightlifting-olympics-rules-history-snatch-clean-and-jerk)
  (Jury dreht Pizzolatos letztes Stoßen in Paris 2024, Magnesia)
* [Kazo Vision — Weightlifting Scoring System](https://www.kazovision.com/sports/weightlifting/?lang=eng)
  (Wettkampfuhr mit Kampfrichterlicht, Video-Schiedsgericht auf der Hallenleinwand)
* [British Weightlifting — Scoreboard Guide (PDF)](https://britishweightlifting.org/resources/scoreboard-guide-230620141046.pdf)
  (abgerufen, der Text ließ sich aus dem PDF nicht extrahieren; die Kästchen-Konvention stammt aus
  der Suche zu IWF-Anzeigetafeln)
* Repo: `gewichtheben-opus-konzeptreview-26-09.md` (Branch `gewichtheben-konzeptreview-26-09`), P1, P7, B.3, B.4

**Breaking (Folter- und Survival-Formate)**

* [Power Slap — Rules](https://www.powerslap.com/rules/), [Wikipedia — Power Slap](https://en.wikipedia.org/wiki/Power_Slap),
  [TIME — Power Slap has competitors slap each other](https://time.com/6249626/power-slap-tbs-dana-white-ufc/)
  (60 s Erholung, drei Punktrichter, Replay-Official, Zeitlupe aus drei Winkeln)
* [Wikipedia — Hot Ones](https://en.wikipedia.org/wiki/Hot_Ones),
  [Hot Ones Wiki — Format](https://hot-ones.fandom.com/wiki/Format),
  [Hot Ones Wiki — Hall of shame](https://hot-ones.fandom.com/wiki/Hall_of_shame)
  (zehn Stufen mit steigender Scoville-Zahl, Hall of Shame bei Abbruch)
* [Stuttgarter Nachrichten — Dschungelcamp](https://www.stuttgarter-nachrichten.de/inhalt.ich-bin-ein-star-holt-mich-hier-raus-quotenpruefung-fuer-das-dschungelcamp.0f265c1a-4ef5-4ae8-be8b-1c5b4adbde7f.html),
  [IBES-Wiki — Dschungelprüfung](https://ibes.fandom.com/de/wiki/Kategorie:Dschungelpr%C3%BCfung)
  (Abbruchsatz, Sterne)
* [Survivor Wiki — Final Immunity Challenge](https://survivor.fandom.com/wiki/Final_Immunity_Challenge)
  (Ausdauerprüfung, Ausfallreihenfolge, Standzeiten)
* [Norwalk Kendo Dojo — Kachinuki Tutorial (PDF)](https://www.eanet.com/norwalk/archives/2015/50th/kachinuki.pdf),
  [FIK — Regulations of Kendo Shiai and Shinpan](https://www.kendo-fik.org/wp-content/uploads/2025/04/Regulations-of-Kendo-Shiai-and-Shinpan-EN_Jul2023.pdf)
  (Sieger bleibt, Tafel mit beiden Aufstellungen)
* Repo: `breaking-opus-konzeptreview-26-09.md` (Branch `breaking-konzeptreview-26-09`), P1–P6, 1.3, 1.6;
  `breaking-folter-zweikampf-praesentation-13-09.md`

**Climbing**

* IFSC Competition Rules 1.0, Januar 2025 (§6.3, §9.1, §9.3), im Volltext zitiert in
  `climbing-opus-gegencheck-24-09.md` 1.1:
  [PDF](https://images.ifsc-climbing.org/ifsc/image/private/t_q_good/prd/w2ggglzziip6zpnpkir4.pdf)
* [Wikipedia — Sport climbing at the 2024 Summer Olympics, Men's speed](https://en.wikipedia.org/wiki/Sport_climbing_at_the_2024_Summer_Olympics_%E2%80%93_Men%27s_speed),
  [Olympics.com — Paris 2024 sport climbing preview](https://www.olympics.com/en/news/paris-2024-sport-climbing-preview-full-schedule-how-to-watch)
  (zwei genormte Bahnen nebeneinander, K.-o.-Duelle, Weltrekorde 4,75 s / 6,06 s)
* [Rock Climbing Realms — How to watch climbing competitions](https://rockclimbingrealms.com/how-to-watch-climbing-competitions/)
  (IFSC-Weltfeed mit IRIS Sport Media, Wiederholungen)
* [Wikipedia — Lead climbing](https://en.wikipedia.org/wiki/Lead_climbing) (Sturz ins Seil unterhalb der letzten Sicherung)
* Repo: `climbing-neukonzept-22-09.md` (5.3 Balance-Ring, 5.4 Ticker), `climbing-opus-gegencheck-24-09.md`
  (Lead-Duell, Exe statt Zone, Höchstmarke, Countdown)

**Grafik-Einschränkung:** Für die Weltfeed-Grafiken von IWF und IFSC (Lead-Live-Rang, Speed-Splits,
„braucht X kg") fand sich keine öffentliche Spezifikation. Wo die Tabellen „Allgemeinwissen" sagen,
beruht der Vorschlag auf der gängigen Übertragungspraxis und nicht auf einer Quelle.
