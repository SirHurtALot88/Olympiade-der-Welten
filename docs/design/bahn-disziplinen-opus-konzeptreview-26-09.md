# Bahn-Disziplinen — Konzeptreview: Gameplay und Taktik (Opus, 26.09.)

Time-Trial, Spurt, Staffel, Takeshi's Castle. Chris will „das volle Programm" für alle Disziplinen,
und zwar zuerst am **Konzept**, nicht an den Zahlen. Dieses Dokument prüft deshalb für die vier
Disziplinen auf dem gemeinsamen Bahn-Chassis, ob die Mechanik die **Taktik** des echten Sports
abbildet. Bestanden haben alle vier: rho je Spiel Time-Trial 0,929, Spurt 0,903, Staffel 0,899,
Takeshi's Castle 0,874. Diese Zahlen sind hier nicht das Thema.

Es ist reines Konzept. Am Motor wurde nichts geändert. Die Messungen in Abschnitt 0.3 liefen
headless über `window.__arena.bahnLauf(d, saat, ansagen)` gegen den unveränderten Stand. Das ist
derselbe Einstieg, den `scripts/miss-bahn-puste.mjs` benutzt. Die Sonde steht in Anhang A.
`engine.js` meint `public/mockups/battle-mode.engine.js`, Stand `main` `254a56c5` (26.09.). Form und
Tiefe folgen `docs/design/climbing-neukonzept-22-09.md`. Neue Zahlen sind als **Vorschlag**
markiert; was gemessen ist, steht mit Befehl daneben.

Vorgänger, gelesen: `bahn-disziplinen-recherche-fable.md` (Sport- und Code-Recherche aller fünf
Bahnen), `zeitfahren-recherche-06-09.md`, `spurt-modellierung-recherche-05-09.md`,
`spurt-offene-fragen-plus-optik-plan-05-09.md`, `staffel-modellierung-recherche-05-09.md`,
`staffel-offene-fragen-plus-takeshis-castle-05-09.md`, `takeshi-hindernis-vs-strecke-recherche-13-09.md`,
`takeshi-chaos-tackle-plan-06-09.md`, `climbing-neukonzept-22-09.md`,
`i-spy-opus-konzeptreview-26-09.md`, dazu die Kommentarblöcke an `BAHN_ART` (`engine.js:26790–27592`).

## Kurzfassung

- **Das Chassis ist gut, die Entscheidungen darin sind es nicht.** Alle vier Disziplinen haben
  einen sportlich stimmigen **Streckenkern**: Geländezonen im Zeitfahren, typisierte Stationen im
  Spurt, eine stufenlose Übergabe mit Streuung und Patzer in der Staffel, Fallentypen mit eigenem
  Können, Nerven und Publikum in Takeshi. Die **taktische Ebene** darüber ist aber in drei von
  vier Disziplinen hohl. Gemeint sind die drei Rennpläne je Bahn, die über `planJeSlot` am Slot
  hängen und die Chris über die Aufstellung (und live über die Rennplan-Ansage) steuert.
- **Gemessen (Abschnitt 0.3): In zwei Disziplinen gibt es einen dominanten Plan, in einer sind die
  Pläne wirkungslos.**

  | Bahn | Plan A | Plan B | Plan C | Befund |
  |---|---:|---:|---:|---|
  | Time-Trial | Gleichmaß **0 %** | Negativ-Split **0 %** | Attacke **100 %** | Attacke ist für jeden Fahrer in jedem Rennen der beste Plan |
  | Spurt | Von vorn **84 %** | Windschatten **4 %** | Schlusssprint **12 %** | Windschatten ist fast nie richtig |
  | Staffel | Halten | Angehen | Schlussmann | in 61 % der Fälle zeichengleich, sonst 0,012 s Unterschied |
  | Takeshi | Vorsichtig **35 %** | Beherzt **35 %** | Kopf voran **30 %** | echte Abwägung: Kopf voran holt mehr Punkte und scheidet öfter aus |

  (Anteil der Läufer-Rennen, in denen der Plan für diesen Läufer der beste ist; 24 Rennen je
  Bahn.) Die Folge ist nicht nur Leere, sondern **Irreführung**: Im Zeitfahren kosten die Slots
  Pacer, Line Reader, Split Control und Finish Kick ihren Fahrer im Schnitt rund einen Rang
  (Platz 8,90 statt 7,93), im Spurt kosten Top Speed, Lane Control und Photo Finish rund einen
  Rang (6,4–6,5 statt 5,4). Chris stellt nach Rolle auf und wird dafür bestraft, ohne es sehen
  zu können.
- **Die gemeinsame Ursache in Time-Trial und Spurt ist derselbe Haushalt.** Die Kraftreserve
  (Puste) bindet nicht. Im Ziel bleiben im Spurt 41 % übrig, auch bei „Von vorn", im Zeitfahren
  14–17 %. Ein Plan, der Kraft spart, spart dann etwas, das niemand braucht. Der echte Sport
  sagt das Gegenteil: Im Zeitfahren ist gleichmäßige Leistung fast optimal, und zu schnelles
  Angehen kostet Zeit (Atkinson, Swain 1997). Bei uns gewinnt Attacke immer.
- **Die Staffel ist ein Zeitfahren mit Stabwechsel.** Alle sechs Beine sind gleich lang, haben
  dieselbe Kurve und starten aus dem Stand. Die Reihenfolge wirkt nur über die Übergabepaare, und
  auch dort nur so, dass die zwei schwächsten Wechsler auf Bein 1 und Bein 6 gehören. Das ist das
  Gegenteil der Praxis, in der der Anker zu den Besten gehört. Die „fliegende Übergabe" ist bisher
  nur Bild (`stepStaffel`, `engine.js:29805`). Mechanisch startet jedes Bein bei null. Die
  Staffel-Pläne setzen alle `tempo:1.00` und unterscheiden sich damit nicht.
- **Takeshi's Castle ist die taktisch reichste der vier und braucht keinen Umbau.** Fünf
  Fallentypen haben je ein eigenes Können (`fallenKoennen`). Daneben gibt es einen Durchbruch als
  Nebenweg, im Gedränge das Bessere aus Wucht und Falle lesen, Nerven und Publikum. Gewertet wird
  auf zwei Wegen: Burgpunkte (Fallen) und Zielbonus (Tempo). Die drei Pläne sind ausgeglichen und
  tauschen echt Risiko gegen Ertrag. Was fehlt, ist Politur (Abschnitt 4).
- **Mehrere Wege zum Erfolg** (CLAUDE.md, 21.09.): Takeshi erfüllt die Leitlinie, Time-Trial
  teilweise (Geländezonen belohnen Kletterer, Abfahrer und Techniker; WUCHT ist Nebenweg am Berg).
  Spurt erfüllt sie nur am einzelnen Hindernis (Technik, sonst Wucht). In der Staffel gibt es
  einen einzigen Weg: Tempo, dazu die Wechselqualität.
- **Priorität.** Erstens **Time-Trial**: am dringendsten, weil dort die einzige taktische
  Entscheidung eine Scheinentscheidung ist, und das in der Sportart, deren Kern das Pacing ist.
  Zweitens die **Staffel**: der größte Umbau, weil ihr die sporttypischen Entscheidungen
  (Beinprofile, Wechselmarke) ganz fehlen, heute aber ohne Schaden. Drittens **Spurt**: dieselbe
  Haushalt-Reparatur wie Time-Trial, danach eine Strafrunde als Nebenweg; sie lässt sich mit P1 im
  Zeitfahren in einer Runde erledigen. Viertens **Takeshi**: gut, nur Politur.

---

## 0. Ist-Zustand, nachgelesen

### 0.1 Was alle vier teilen

Ein Tick in `stepSpurt()` (`engine.js:29002`) läuft je Läufer so ab:

1. **Tempo** aus `tempoVon()` (`:28865`). Es mischt ANTRITT (erste 3,2 s ab eigener Startzeit) und
   ENDTEMPO. Dazu kommen die Faktoren Plan (`tempo` bis zum Angriffspunkt `ab`, danach 1,0),
   Ermüdung ab 45 % der eigenen Strecke (STEHEN), Stolperer (×0,35), Sog (×1,045), Einbruch
   (`leer` ≈ ×0,80), Nerven (nur Takeshi), Staffelkurve und Gelände (nur Time-Trial).
2. **Verbrauch** `zehr = 0,55 + ueber²·1,9`, im Sog ×0,66 (`:29098`). Er ist quadratisch im
   Plantempo; die Physik (Luftwiderstand) ist kubisch. Erholung gibt es am Hindernis, unter
   Plantempo und im Einbruch (`:29149`). Die Obergrenze ist `KRAFT_VON = kraftBasis +
   (0,7·STEHEN + 0,3·ROBUST)·kraftSpanne` (`:27610`).
3. **Hindernisse**, wo es sie gibt (`:29191`): ein Zeitpreis je Station nach Typ und Sub-Skill,
   dann der Wurf TECHNIK (sauber), sonst WUCHT (Durchbruch), sonst Sturz.
4. **Tackle**, wo erlaubt: WUCHT gegen ROBUST, in Takeshi mit Ausweichen (TECHNIK).

Die drei Pläne sind reine Zahlen (`tempo`, `sucht`, `ab`), gewählt je Slot (`planJeSlot`, in
`bauSpurt()` `:28526`). Live lassen sie sich über die Rennplan-Ansage (`planWechsel()`, `:28960`)
umstellen.

### 0.2 Die vier im Profil

| | Time-Trial | Spurt | Staffel | Takeshi's Castle |
|---|---|---|---|---|
| Matrix (Top) | dex 25, speed 22, int 18, stam 15, aw 12 | speed 18, det 15, will 14, torm 14, dex 12, pow 10 | speed 24, stam 16, spirit 16, aw 12, cha 10 | will 22, det 18, cha 14, int 11, aw 8 |
| Start | Einzelstart, 0,8 s Abstand (`startAbstand`) | Massenstart | Bein 1 Massenstart, dann Wechsel | Massenstart |
| Strecke | 7 Geländezonen: 3 Kurven, 2 Steigungen, 2 Abfahrten | 7 Stationen, typisiert | 6 gleiche Beine, je eine Kurve | 14 Fallen, 5 Typen, 3 Kurse |
| Gegnerkontakt | keiner | Sog, Bahnwechsel, Rempler | keiner (eigene Bahnen, Sog aus) | Rempler, Ausweichen, Gedränge |
| Ausscheiden | nein | nein | nein | ja, über Nerven |
| Wertung | Teamzeit-Summe (`"zeit"`), Rangpunkte je Fahrer | Rangpunkte (`"rang"`) | Mannschaft zuerst im Ziel; je Läufer Etappenrang (`"etappe"`) | Burgpunkte + Zielbonus (`"burg"`) |
| Pläne | Gleichmaß / Negativ-Split / Attacke | Von vorn / Windschatten / Schlusssprint | Halten / Angehen / Schlussmann | Vorsichtig / Beherzt / Kopf voran |

### 0.3 Messstand heute (selbst gemessen, 26.09.)

**Plan-Sonde (Anhang A).** Je Rennen läuft zuerst der Basislauf. Dann wird **jeder Heimläufer
einzeln** auf jeden der drei Pläne gesetzt (Ansage bei Strecke 0), alle anderen bleiben, wie
sie sind. Gemessen wird das, was die Disziplin wertet: eigene Zeit (Time-Trial, Spurt),
Etappenzeit (Staffel), Burgpunkte mit Zielbonus (Takeshi). 24 Rennen, Saaten `1337 + i·7919`.

| Bahn | Plan | bester Plan | Mittel | Ø Platz | ausgesch. | im Ziel leer | Rest-Puste |
|---|---|---:|---:|---:|---:|---:|---:|
| Time-Trial | Gleichmaß | 0 % | 14,28 s | 8,90 | — | 0 % | 17 % |
| | Negativ-Split | 0 % | 14,38 s | 9,04 | — | 0 % | 17 % |
| | **Attacke** | **100 %** | **13,59 s** | **7,93** | — | 17 % | 14 % |
| Spurt | **Von vorn** | **84 %** | **14,96 s** | **5,42** | — | 5 % | 41 % |
| | Windschatten | 4 % | 15,38 s | 6,43 | — | 1 % | 44 % |
| | Schlusssprint | 12 % | 15,38 s | 6,51 | — | 0 % | 48 % |
| Staffel | Halten | 0 % | 1,880 | 8,08 | — | 0 % | 88 % |
| | Angehen | 39 % | 1,868 | 7,88 | — | 0 % | 88 % |
| | Schlussmann | 0 % | 1,880 | 8,08 | — | 0 % | 88 % |
| Takeshi | Vorsichtig | 35 % | 12,32 P | 6,05 | 11,1 % | 8 % | 31 % |
| | Beherzt | 35 % | 12,60 P | 5,61 | 11,1 % | 20 % | 27 % |
| | Kopf voran | 30 % | 12,60 P | 5,35 | 13,9 % | 17 % | 24 % |

Aufgeteilt nach Stärke (Basisplatz obere/untere Hälfte) gilt:

- **Time-Trial:** Attacke ist in **beiden** Hälften zu 100 % richtig. Weil im Zeitfahren
  während des Rennens kein `rr()` fällt, ist das keine Stichprobe, sondern Arithmetik.
- **Spurt:** Von vorn liegt oben bei 92 %, unten bei 77 %. Schlusssprint ist nur für Schwache
  gelegentlich richtig.
- **Takeshi:** Oben ist Beherzt leicht vorn (39 %), unten Vorsichtig (40 %). Das ist die
  richtige Richtung (wer schwächer ist, sollte sicherer spielen), aber schwach ausgeprägt.

Nebenbefunde derselben Sonde:

- Im Spurt verbringt ein Läufer 21 % seiner Zeit im Sog. Er rempelt 0,30-mal je Rennen,
  stolpert 1,73-mal, und die Zielzeiten liegen zwischen 10,7 und 16,8 s.
- In der Staffel liegt der Zielabstand zwischen den Mannschaften im Median bei 0,45 Sim-s auf
  rund 11,5 s.

Aus `scripts/miss-bahn-puste.mjs 12`: Rest-Puste im Ziel Spurt 53 %, Time-Trial 28 %, Staffel
88 %, Takeshi 31 %. Leer kommen ins Ziel: Spurt 2,5 %, Time-Trial 0 %, Staffel 0 %, Takeshi 9 %.

**Warum Attacke im Zeitfahren immer gewinnt.** Die Rechnung dahinter:

- Attacke fährt 1,00, Gleichmaß 0,93 bis 75 % der Strecke.
- Der Verbrauch steigt dafür nur quadratisch, `0,55 + 1,9·t²`, also 2,45 gegen 2,19, rund +12 %.
  Real kostet 7 % mehr Tempo am Luftwiderstand rund 22 % mehr Leistung.
- Die Reserve (`kraftBasis:290`) reicht für diesen Mehrverbrauch fast immer.
- Und wo sie nicht reicht, kostet der Einbruch nur ×0,80 bis zum Fangen bei 12 % (`:28893`,
  `:29169`).

Die sieben Prozent Tempo sind damit fast umsonst.

**Warum Windschatten im Spurt nie gewinnt.** Der Plan fährt `tempo:0.94`, der Sog gibt ×1,045,
zusammen 0,98. Das ist immer langsamer als 1,00. Der Vorteil wäre die gesparte Kraft, und die
braucht bei 41 % Rest niemand.

**Warum die Staffel-Pläne nichts tun.** K2 (`staffel-modellierung-recherche-05-09.md` 3.2) hat
alle drei auf `tempo:1.00` gesetzt, weil sie einen reinen Bein-Bias erzeugten. Damit
unterscheiden sie sich nur noch in `sucht`/`ab`. `ab` wirkt bei Tempo 1,0 nicht.

Und `sucht > 0,3` (Halten, Schlussmann) lässt den Läufer trotz `schatten:false` nach einer
Sog-Bahn suchen und die Bahn wechseln (`:29064`). Das kostet über `quer` ×0,94 die gemessenen
0,012 s. Es ist ein kleiner Fehler, kein Taktikelement: Staffelläufer wechseln in die Bahn des
Gegners, um einem Sog nachzulaufen, den es nicht gibt.

### 0.4 Der Maßstab: was Climbing vorgemacht hat

Das Climbing-Neukonzept (22.09.) hat ein Rennen mit umbenannten Hürden in echtes Lead-Klettern
umgebaut. Es hat die **eine Ressource** gefunden, die den Sport entscheidet (Gleichgewicht und
Pump), eine Wertung nach Zonen statt Zieleinlauf eingeführt und einen Gegnerdruck geschaffen,
der aus dem Sport kommt. Die Prüffrage je Disziplin lautet deshalb:

1. Enthält die Kernschleife die Größe, **um die der echte Sport ringt**?
2. Gibt es eine **Entscheidung**, deren richtige Antwort vom Profil des Läufers abhängt?

Die erste Frage beantworten alle vier einigermaßen, die zweite nur Takeshi.

---

## 1. Time-Trial (Einzelzeitfahren)

### 1a. Bestandsaufnahme — was heute trägt

- **Einzelstart gegen die Uhr, ohne Sog und ohne Kontakt.** Das ist sportlich exakt richtig
  (`startAbstand:0.8`, `schatten:false`, `tackle:false`). Seit dem 22.09. zählt die Teamwertung
  die Zeitsumme, „wie bei Tour de France", wie Chris es verlangt hat.
- **Das Streckenprofil ist der stärkste Teil** (`gelaende`, `:26991`, `gelaendeFaktor()`
  `:28817`). Kurvenzonen lesen TECHNIK („Linie"), Steigungen ENDTEMPO mit WUCHT als Nebenweg,
  Abfahrten WENDIGKEIT („Umsetzen"). Das Profil ist stetig, ohne Wurf und ohne Sturz. Damit gibt
  es sportlich stimmige **Spezialisten**: den Kletterer, den Abfahrer und den Techniker. Das ist
  die Mehrwege-Leitlinie in ihrer besten Form auf der Bahn.
- **Zwischenzeiten** an den Enden der Abfahrten (`zwischenzeiten:[0.40,0.76]`), mit Differenz
  zur bisherigen Bestzeit. Das ist die Frage, die jeder Zuschauer stellt: „Hält er den
  Vorsprung vom Berg?"
- **GESPÜR** trägt Dexterity/Awareness über die ganze Fahrt. Das ist ein Pp-Kanal ohne eigene
  Taktik, aber ehrlich benannt.

### 1b. Was an echter Sport-Taktik fehlt

**1. Pacing ist eine Scheinentscheidung.** Die Leistungseinteilung ist *die* taktische Größe des
Zeitfahrens, und in unserem Motor verliert sie. Gemessen gilt dreierlei:

- Attacke ist in 100 % der Fälle besser.
- Die Pläne mit sportlich richtiger Einteilung (Gleichmaß, Negativ-Split) sind nie besser.
- Vier der sechs Slots (Pacer, Line Reader, Split Control, Finish Kick) bekommen genau diese
  Pläne. Ein Fahrer auf „Split Control" (Text: „Kontrolliert Zwischenzeiten über Intelligence")
  verliert strukturell rund 0,8 s und einen Rang.

Real gilt fast das Gegenteil. Gleichmäßige Leistung ist auf flachem Kurs nahezu optimal (Foster
1993, Swain 1997, Atkinson & Brunskill 2000). Zu schnelles Angehen („über der Schwelle") leert
das anaerobe Konto (W′) und kostet hinten mehr, als vorn gewonnen wurde.

**2. Kein geländebezogenes Pacing.** Auf welligem Kurs fährt man am schnellsten, wenn man **am
Berg mehr und bergab weniger** Leistung gibt. Swain (1997) rechnet bei ±10 % um 289 W auf einem
hügeligen Kurs 126 s Gewinn. Bei uns hängen die Pläne an der **Position** (`ab`), nicht am
Gelände. Das Verbrauchsmodell kennt keinen Grund, warum Tempo am Berg billiger wäre: der
Verbrauch hängt nur am Plantempo, nicht an der Geschwindigkeit. Die sportlich interessanteste
Frage („wo investiere ich?") ist damit nicht stellbar.

**3. Die Strecke ist immer dieselbe.** Sieben Zonen an festen Stellen, in jedem Rennen.
Kletterer, Abfahrer und Techniker haben Profile, aber keine Strecke, die einmal den einen und
einmal den anderen bevorzugt. Real entscheidet das Streckenprofil, wer Favorit ist: flaches
Zeitfahren für Rouleure, Bergzeitfahren für Kletterer. Für Chris wäre genau das eine
Aufstellungsfrage.

**4. Das Alleinsein gegen die Uhr hat keine Mechanik.** Real fährt man nach Zwischenzeiten, die
über Funk kommen, und spätere Starter kennen die Referenz. Bei uns sind Zwischenzeiten reine
Anzeige. Der Slot „Split Control" beschreibt etwas, das es nicht gibt.

**Ehrlich dazu:** Das Feld spreizt sich von 8,6 s bis 16,7 s. Das ist ein Faktor 2, real wären
es wenige Prozent. Das ist gewollt, denn Chris will deutlich weniger Varianz als der echte Sport
(`battle-mode-gameplay-grundmodell.md` A). Pacing entscheidet deshalb nie zwischen dem Besten
und dem Schwächsten, sondern zwischen **Nachbarn**. Genau dort soll Taktik wirken. Heute wirkt
sie dort auch, nur in die falsche Richtung.

### 1c. Vorschläge, nach Priorität

**TT-P1 — „Der Haushalt bindet": Attacke muss ein Risiko sein. (Muss.)**

Das Ziel ist eine Taktik-Kennzahl, keine Zahl im Motor: **Kein Plan ist in mehr als 60 % der
Läufer-Rennen der beste, und welcher Plan der beste ist, hängt messbar am Profil des Fahrers.**
Wer mehr Reserve hat (STEHEN, ROBUST), darf mehr riskieren. Drei Stellschrauben, alle Vorschlag:

- **Verbrauch näher an die Physik.** Statt `0,55 + 1,9·t²` im Zeitfahren eine steilere Kurve
  (z. B. kubisch, als `zehrExponent` nur in `BAHN_ART["time-trial"]`). Sieben Prozent mehr Tempo
  kosten dann rund ein Fünftel mehr Reserve statt ein Achtel.
- **Einbruch als Einbruch.** Real ist „überzogen" teuer: Die Leistung fällt auf das aerobe Niveau
  und kommt erst nach Minuten zurück. Heute ×0,80 und Fangen bei 12 % Reserve. Vorschlag: im
  Zeitfahren ×0,70 und Fangen erst bei 30 %.
- **Reserve knapper.** `kraftBasis` so weit senken, dass ein Gleichmaß-Fahrer mit
  durchschnittlichem STEHEN mit 5–10 % Rest ins Ziel kommt, nicht mit 17 %.

Damit wird die Frage „Attacke oder Gleichmaß?" zur Frage „wie groß ist die Reserve dieses
Fahrers?". Das ist genau die echte Frage (Critical Power / W′). Negativ-Split wird zum sicheren
Plan für Fahrer mit kleiner Reserve.

Nebenwirkung auf rho, als Hypothese: Heute verteilt `planJeSlot` rund einen Rang **nach Slot**,
nicht nach Können. Das ist Rauschen gegenüber der Eignung. Wird die Dominanz aufgehoben, kann
die Validität steigen. Zu messen, nicht zu behaupten.

**TT-P2 — „Am Berg drücken": geländebezogenes Pacing als eigener Plan. (Soll.)**

- **Neuer Plan „Wellenfahrer" statt Negativ-Split.** Er fährt am Berg 1,05 und bergab 0,90,
  sonst 0,95 (Vorschlag). Er greift in `gelaendeAn()`, das es schon gibt: ein planeigener
  Faktor je Zonenart.
- **Damit das Gelände-Pacing etwas kostet oder bringt, muss der Verbrauch am Gelände hängen.** Am
  Berg ist Tempo billig, weil der Luftwiderstand bei niedriger Geschwindigkeit klein ist. Auf der
  Abfahrt ist es teuer. `gelaendeZehrFaktor()` (`:28857`) existiert, heute nur als
  Mehrverbrauch am Berg. Vorschlag: der Faktor wirkt auf den **Tempoaufschlag**, nicht auf den
  Grundverbrauch.
- **Wer profitiert:** der Fahrer mit starkem ENDTEMPO/WUCHT am Berg und genug Reserve. Das ist
  ein Profil, kein Rang. Der Slot „Risk Segment" (dex/torment, „Nimmt Risiko") bekäme den
  Wellenfahrer.
- **Echte Sportquelle:** Swain 1997; Atkinson et al. 2007 (*J Sports Sci* 25(9)) bestätigen mit
  einem aktualisierten Modell Zeitgewinne durch ±5–10 % Leistungsvariation auf welligem Kurs.

**TT-P3 — „Streckenprofil je Spieltag": flach, wellig, bergig. (Soll, geringes Risiko.)**

- **Drei benannte Profile** statt eines festen, gewählt je Saat. Das ist das Muster von
  Takeshis `kurse` (`:27473`), das dort gemessen innerhalb der Kader-Spannweite blieb.
- **Das Profil wird mit dem Spieltag angekündigt.** Chris sieht vor der Aufstellung „Bergzeitfahren"
  und stellt anders auf. Die Zonenarten bleiben dieselben, nur ihre Anteile verschieben sich.
- **Das ist die Mehrwege-Leitlinie auf Mannschaftsebene:** Der Techniker glänzt auf dem
  kurvigen Kurs, der Kletterer am Berg.
- **Achtung Pp:** Jedes Profil verschiebt die Attributanteile. Die Pp-Abnahme muss über alle
  drei Profile gemittelt bestehen (Kurswahl je Saat ist gleichverteilt), nicht je Profil.

**TT-P4 — „Funk": Zwischenzeiten werden Information. (Kann.)**

- **An jeder Zwischenzeit** vergleicht der Fahrer mit der Bestzeit und seiner Reserve und stellt
  selbst um: vorn und knapp heißt zurücknehmen, hinten mit Reserve heißt drücken.
- **Die Güte dieser Korrektur hängt an Intelligence** (Matrix 18, bisher nur Linie/Durchhalten).
  Der Slot „Split Control" bekommt damit seinen Inhalt.
- **Umsetzung:** über `planWechsel()`, also denselben Weg wie die Ansage. Es entsteht keine
  zweite Logik.
- **Voraussetzung ist P1.** Solange Attacke immer gewinnt, ist „richtig umstellen" gleich
  „immer Attacke".
- **Bewusst nicht:** ein Informationsvorteil für späte Starter. Er hinge an der Startnummer,
  nicht am Können. Real ist er klein und hier ein reiner Positionsbonus.

**Bewusst nicht vorgeschlagen:** eine Aero-Haltung als eigene Größe. Die Zielkonflikte Aero
gegen Kontrolle und Aero gegen Leistung sind real, liegen aber in denselben Zonen, die TECHNIK
und WENDIGKEIT schon tragen. Sie wären ein zweiter Name für denselben Kanal.

---

## 2. Spurt

### 2a. Bestandsaufnahme — was heute trägt

Zuerst eine Klärung, weil die Aufgabe „Sprint, 100/200 m" nennt. **Spurt ist seit dem 05.09. ein
Hindernissprint.** Chris' ursprüngliches Vorbild war „Ninja Warrior, Spartan Race, Hindernislauf",
die Matrix sagt dasselbe (torment 14, dex 12, power 10, speed nur 18;
`spurt-offene-fragen-plus-optik-plan-05-09.md` Frage 1). Die Frage ist also, ob das ein guter
**Hindernissprint** ist: ein Spartan-Sprint auf kurzer Strecke, Kopf an Kopf. Eine
Leichtathletik-Sprintmechanik ist nicht der Maßstab.

- **Stationen mit Typ und Zeitpreis** (`hindernisTypen`, `huerdePreis`, `wuchtPreisFaktor`,
  `:26858`): Hürde und Stroh über TECHNIK, Balken und Graben über WENDIGKEIT, Palisade, Seil und
  Mauer über WUCHT. Jede Station kostet jeden etwas, wer es kann, weniger. Das ist realistisch:
  Auch der Weltmeister verliert an der Hürde rund 0,2 s.
- **Zwei Wege durch ein Hindernis:** sauber (TECHNIK), sonst mit Gewalt (WUCHT, kostet Kraft),
  sonst Sturz. Chris' Lulu/Gram-Satz (`:29178`) ist damit eingelöst.
- **Kopf-an-Kopf mit Kontakt:** Bahnwechsel, Ausweichen vor Gestürzten, Rempler (WUCHT gegen
  ROBUST). Der Rempler ist absichtlich gedämpft (0,30 je Läufer und Rennen).

### 2b. Was an echter Sport-Taktik fehlt

**1. Die Pläne sind ein Mittelstreckenrennen, und das Mittelstreckenrennen kippt.** Von vorn,
Windschatten und Schlusssprint sind die klassische 800/1500-m-Taktik: vorn führen und Kraft
zahlen, sich anhängen und sparen, am Ende kicken. Das trägt nur, wenn die Kraft **knapp** ist.
Gemessen bleiben im Spurt 41–48 % Reserve im Ziel, egal mit welchem Plan. Also gewinnt, wer
einfach von Anfang an Vollgas läuft (84 %).

Dazu kommt: Sog ist in einem 15-Sekunden-Hindernissprint sportlich kaum vorhanden. Beim Laufen
bringt Windschatten erst bei Mittelstreckentempo und über Minuten etwas. An einem Hindernis
bringt der Vordermann eher Stau als Sog.

**2. Das Hindernis kennt keine Wahl.** Im echten Hindernislauf ist der Umgang mit einem
Hindernis eine Entscheidung. Spartan Race: Wer ein Hindernis nicht schafft, macht 30 Burpees
oder läuft eine Strafrunde (seit 2023 teils 200 m Strafschleife statt Burpees). Die starke
Läuferin mit schwacher Griffkraft wägt ab, ob sie das Seil versucht oder gleich in die Schleife
geht. Bei uns wird **jedes** Hindernis versucht, und das Scheitern ist ein Sturz, kein Umweg. Ein
schneller Läufer (Speed 18, die höchste Einzelzahl der Matrix) hat an den Stationen keinen Weg,
seinen Vorteil einzusetzen.

**3. Drei Sportarten in einem Namen.** Die Slots sprechen 100 m (Block Start, Acceleration, Top
Speed, Drive Phase, Photo Finish). Die Pläne sprechen Mittelstrecke, die Stationen Spartan.
Mechanisch greifen die 100-m-Rollen nur über ANTRITT (erste 3,2 s) und den Plan, den der Slot
zuweist. „Block Start" hat keine Reaktionszeit, „Photo Finish" keinen Zielmoment. Das ist kein
Fehler, aber für Chris schwer lesbar. Die Identität gehört einmal entschieden (Frage an Chris,
Abschnitt 6).

### 2c. Vorschläge, nach Priorität

**SP-P1 — Haushalt und Pläne gemeinsam mit TT-P1 richten. (Muss.)**

- **Dieselbe Reparatur:** Die Reserve muss binden. Das ist ein Satz Zahlen in `BAHN_ART.spurt`
  (`kraftBasis`, Einbruchsfaktor), kein neuer Mechanismus.
- **Neue Pläne, die ohne Sog funktionieren** (Vorschlag):

  | Plan | Verhalten | Preis |
  |---|---|---|
  | „Von vorn" | schnell an die erste Station, sucht dort die freie Bahn | zahlt hinten |
  | „Gleichmaß" | hält den Rhythmus | nichts Besonderes |
  | „Schlusssprint" | spart bis zur letzten Station | verliert vorn an Boden |

- **Sog auf ein Nebengeräusch senken** (`SCHATTEN_TEMPO`/`SCHATTEN_SPAREN` je Bahn überschreibbar
  machen) oder im Spurt ganz aus.
- **Ziel:** dieselbe Kennzahl wie im Zeitfahren. Kein Plan liegt über 60 %, und der beste Plan
  hängt am Profil: Antrittsstarke gewinnen von vorn, Stehvermögen gewinnt hinten.

**SP-P2 — „Strafschleife": der Laufweg als Nebenweg am Hindernis. (Soll. Die Mehrwege-Leitlinie
für Spurt.)**

- **Am Ende der Kette steht die Schleife statt des Sturzes:** TECHNIK (sauber), sonst WUCHT (mit
  Gewalt), sonst **Strafschleife** statt Sturz. Die Schleife ist ein Laufstück mit festem
  Streckenanteil. Ihre Dauer hängt an ENDTEMPO (Speed/Will), nicht an Technik.
- **Plan-abhängig gibt es zusätzlich das bewusste Auslassen:** Ein Läufer geht an einer Station
  seines schwächsten Typs direkt in die Schleife, ohne den Versuch.
- **Primärweg bleibt das Hindernis:** Wer es kann, ist klar schneller. Die Schleife ist die
  schlechtere, aber planbare Alternative, genau wie im I-Spy-Muster.
- **rho-Überlegung:** Die Schleife ersetzt einen teuren, zufälligen Sturz (0,45–1,4 s) durch eine
  **deterministische**, könnensabhängige Zeit. Das sollte die Verlässlichkeit eher heben (weniger
  großer Einzelwurf) und Speed einen zweiten Kanal geben. Pp-Risiko: Speed liest heute schon
  seinen Matrixwert; die Schleife verschiebt Gewicht von Torment/Dex zu Speed. Deshalb gehört
  ein Schleifenpreis dazu, der klar über dem Durchbruch liegt.
- **Bild:** eine Schleife neben der Station, sichtbar als Umweg. Ticker: „X lässt das Seil aus
  und nimmt die Schleife."

**SP-P3 — „Start" für die Block-Start-Rolle. (Kann.)**

- **Eine Reaktionszeit** je Läufer aus Awareness (real 0,10–0,16 s, Fehlstart unter 0,100 s).
  Sie verschiebt den Start um Zehntel und gibt dem Slot „Block Start" einen sichtbaren Moment
  („bester Start: X, 0,12 s").
- **Bewusst ohne Fehlstart-Disqualifikation.** Ein Ausschluss durch einen Einzelwurf wäre genau
  der Totalausfall, den die Projektgeschichte mehrfach gemessen verworfen hat.

**Bewusst nicht:** Sprintphasen im Detail (Beschleunigung bis 50–70 m, Abbau auf den letzten
10 m). Bei sieben Stationen auf der Strecke gibt es keine lange Gerade, auf der sie sich zeigen
könnten. ANTRITT/ENDTEMPO bilden das grob, aber ausreichend ab.

---

## 3. Staffel

### 3a. Bestandsaufnahme — was heute trägt

- **Die Übergabe ist eine Zeit, kein Münzwurf** (`:29612–29689`). Grundverlust aus dem Schnitt
  beider TECHNIK-Werte (Awareness/Dex/Charisma, „Wechsel"). Dazu eine dreiecksförmige Streuung,
  die mit dem Können enger wird, und ein echter Patzer (Boden 4,5 % je Wechsel, gemildert durch
  ROBUST = „Verlässlichkeit"). Die Kosten verteilen sich je zur Hälfte auf Geber und Nehmer.
  Das ist sportlich die richtige Größenordnung (`WECHSEL_*`, `:28696–28764`), mit der richtigen
  Form: Gute Paare liefern verlässlich, schwache schwanken.
- **Die Kurve je Bein** (`kurvenFaktor()`, `:28788`, WENDIGKEIT = „Bahnarbeit") ist Chris'
  „Kurvengeschwindigkeit".
- **Eigene Bahnen, kein Sog, kein Kontakt.** Das ist für eine 4×100 richtig; der
  Validitätsverlust durch situativen Sog ist gemessen (0,762 → 0,601).
- **Die Einzelwertung ist fair.** Die Etappenzeit ist um den Wechselverlust bereinigt, das
  Wechselkonto teilt ihn. Das Maß stimmt.

### 3b. Was an echter Sport-Taktik fehlt

**1. Alle Beine sind gleich, deshalb ist die Reihenfolge fast bedeutungslos.** In
`bauSpurt()` (`:28579`) gilt `beinVon = idx/n`, `beinBis = (idx+1)/n`, jedes Bein hat eine
Kurve in der Mitte, und jedes Bein startet über `startT = rennT` aus dem Stand (ANTRITT-Phase
von vorn, `tempoVon()` `:28871`).

In der Wirklichkeit sind die Beine verschieden:

| Bein (4×100) | Aufgabe | Wer gehört dorthin |
|---|---|---|
| 1 | aus dem Block, in der Kurve | der beste Starter |
| 2 | die längste Gerade, fliegend | der schnellste Flachläufer |
| 3 | Kurve, nimmt an und gibt ab | der beste Kurvenläufer, oft der langsamste |
| 4 | Anker | schnell, wettkampfstark, unter Druck belastbar |

Bei uns ist ein Weltklasse-Starter auf Bein 1 genauso viel wert wie auf Bein 4.

**Was die Reihenfolge heute tatsächlich bewirkt, lässt sich ausrechnen.** Jeder der fünf
Wechsel nutzt den Schnitt der beiden TECHNIK-Werte. Über das Rennen summiert zählt TECHNIK von
Bein 2 bis 5 voll, von Bein 1 und 6 nur halb:

`0,5·T₁ + T₂ + T₃ + T₄ + T₅ + 0,5·T₆`

Die einzige Aufstellungsregel, die der Motor belohnt, heißt also: **Die zwei schlechtesten
Wechsler an die Enden.** Das ist klein, unsichtbar und läuft dem Sport entgegen: Real ist der
Anker ein Star, und Bein 3 muss zwei Wechsel können.

**2. Es gibt keinen fliegenden Start.** Er ist der Grund, warum eine Staffel real schneller ist
als die Summe der Einzelzeiten: Der Nehmer läuft in der 30-m-Zone auf Tempo, bevor der Stab kommt
(World Athletics, 30-m-Zone seit 2018). Das Bild zeigt ihn seit dem Staffel-Oval
(`vizAnlauf`, `:29817`), die Mechanik nicht. K4 (`staffel-modellierung-recherche-05-09.md` 3.4)
hat ihn ausgearbeitet, gebaut wurde er nie. Damit fehlt auch der Kanal für die Idee „bester
ANTRITT vorn, bestes ENDTEMPO hinten" (Frage 3 in `staffel-offene-fragen…` 1.2 hat ihn
ausdrücklich an K4 gebunden).

**3. Die Wechselmarke, die eigentliche Staffeltaktik, gibt es nicht.** Real ist die Übergabe
ein Risikoregler: Der Nehmer läuft los, wenn der Geber seine Marke erreicht. Eine weite Marke
bringt Tempo, aber das Risiko, dass der Geber ihn nicht einholt oder der Wechsel aus der Zone
fällt. Eine kurze Marke ist sicher, aber langsam. Die Marke stellen Trainer je Paar ein, nach
Können und Vertrauen. Genau das wäre die Entscheidung, die Chris' Pläne tragen könnten. Heute
sind die Pläne wirkungslos (0.3).

**4. Spirit und Charisma haben keinen Formkanal.** WUCHT („Zug an der Spitze", Spirit 45 /
Charisma 33) verbilligt den Kraftverbrauch vorn (`:29111`). Bei 88 % Rest-Puste im Ziel bricht
aber niemand je ein, und die Reserve wirkt sonst nirgends. Der Kanal ist also mechanisch tot.
Spirit und Charisma (26 % der Matrix) kommen nur über die Mengenkopplung (`mengeAusEignung`-
Muster, `:28505`) in den Lauf. Der Slot „Anchor" (Spirit/Charisma) und „Chase Runner" („Jagt
Rückstände mit Spirit") beschreiben Rollen, die kein Mechanismus kennt.

### 3c. Vorschläge, nach Priorität

**ST-P1 — „Wechselmarke": der fliegende Wechsel als Risikoregler, die Pläne werden echt.
(Muss. Größter Taktikgewinn.)**

- **Der fliegende Gewinn (K4).** Jeder Wechsel bringt einen Gewinn `G = G_max · Q`, wobei
  `Q` aus TECHNIK beider, ENDTEMPO des Gebers und ANTRITT des Nehmers stammt (K4-Formel, dort
  ausgearbeitet). Der Nehmer „hat schon Tempo". Der Gewinn geht ins Wechselkonto, nicht in die
  Etappe, damit kein Bein-Bias entsteht.
- **Die drei Pläne werden zur Marke des Nehmers** (Vorschlag):

  | Plan | Gewinn | Streuung | Patzer | Bild |
  |---|---|---|---|---|
  | „Sicher" | ×0,6 | ×0,7 | ×0,5 | kurze Marke, er wartet auf den Stab |
  | „Normal" | ×1,0 | ×1,0 | ×1,0 | wie heute |
  | „Scharf" | ×1,4 | ×1,3 | ×2,0 | weite Marke, und der Stab kommt vielleicht nicht an |

  Alle Werte sind Vorschlag. Sie greifen nur in die Wechselformel, die es schon gibt.
  `tempo`/`sucht`/`ab` fallen weg, und damit auch der Sog-Suche-Fehler aus 0.3.
- **Die richtige Wahl hängt am Paar.** Zwei gute Wechsler (hohe TECHNIK/ROBUST) gewinnen mit
  „Scharf", zwei schwache verlieren damit. Das ist das I-Spy-Prinzip der monotonen Politik: Wer
  besser ist, hat die bessere Politik zur Verfügung. Chris' Frage bei der Aufstellung wird: „Traue
  ich diesen beiden den scharfen Wechsel zu?"
- **KI-Aufstellung:** Marke nach Paar-TECHNIK (Schwelle, Vorschlag 55).
- **Patzer als Drama:** Der „Scharf"-Patzer kostet mehr, bleibt aber unter dem Totalausfall.
  Kein DNF, das bleibt entschieden (`staffel-offene-fragen…` 1.1).

**ST-P2 — „Beine mit Charakter": Reihenfolge wird eine Entscheidung. (Soll. Braucht ein neues
Maß.)**

- **Bein 1 aus dem Block.** Kein fliegender Gewinn, dafür eine Reaktionszeit (Awareness, wie
  SP-P3) und volles ANTRITT-Gewicht. Hierhin gehört der Starter.
- **Kurvenbeine und Geradenbeine im Wechsel** auf dem Oval, sechs Beine gleich 3 + 3. Kurvenbeine
  lesen WENDIGKEIT, Geradenbeine nur ENDTEMPO. Die heutige Kurve in *jedem* Bein wird auf die
  Kurvenbeine konzentriert.
- **Das Anker-Bein** (Bein 6) bekommt den Druck: siehe ST-P3.
- **Vorbedingung, sonst kippt die Rangtreue:** Sind die Beine verschieden, ist die Etappenzeit
  über Beine hinweg nicht mehr vergleichbar. Heute rangiert `staffelEtappenRaenge()` (`:24524`)
  alle zwölf Läufer gemeinsam. Neu muss die Einzelwertung **gegen den Gegner auf demselben Bein**
  oder gegen die Beinerwartung normiert rangieren (Fable-Recherche 1.3 schlägt genau dieses Maß
  vor: „Abschnittszeit relativ zum Gegner auf demselben Bein"). Ohne dieses Maß wird aus der
  Reihenfolge wieder ein Bein-Bias, der alte Fehler in `laufAnteil` (`:28776`).
- **Gewinn für Chris:** Die Slots bekommen Orte. Start Runner → Bein 1, Curve Runner → ein
  Kurvenbein, Anchor → Bein 6. Die Aufstellung ist dann nicht mehr „wer läuft", sondern „wer
  läuft wo".

**ST-P3 — „Anker unter Druck": ein Kanal für Spirit und Charisma. (Kann. Messrisiko hoch.)**

- **Wenn die Mannschaften auf dem letzten Bein nah beieinander sind** (Abstand unter einer
  Schwelle), wirkt auf **beide** Anker ein Druckfaktor. Er hängt an ihrer eigenen WUCHT
  gegenüber einem festen Bezugswert, nicht am Gegner. Wer Zug hat, legt unter Druck zu; wer
  keinen hat, verkrampft leicht.
- **Warum „Kann":** Der Auslöser ist situativ, nämlich ein enges Rennen. Situative Vorteile haben
  die Staffel schon einmal Validität gekostet (Sog: 0,762 → 0,601). Der Unterschied hier: Der
  Faktor ist symmetrisch und hängt am **eigenen** Wert, nicht an der Lage. Die Lage entscheidet
  nur, *ob* er wirkt. Trotzdem: nur mit Vorher/Nachher-Messung und Rückfall.
- **Einfachere Alternative:** WUCHT fließt als Anteil in `Q` der Wechselmarke ein. Die K5-Idee
  „WUCHT → ZONE", Bry 2009: Kooperation bringt +30 cm/s Stabgeschwindigkeit. Damit hätten
  Spirit und Charisma einen Kanal ohne jede Situationsabhängigkeit. **Das ist die sichere
  Wahl.** ST-P3 nur, wenn Chris das Anker-Duell sehen will.

**Nebenbefund ohne Taktikwert:** Halten und Schlussmann (`sucht` > 0,3) wechseln die Bahn auf der
Suche nach einem Sog, den es in der Staffel nicht gibt (`:29064`, 0,012 s je Läufer). Das
erledigt ST-P1 von selbst. Ohne ST-P1 reicht `sucht:0` in allen drei Staffel-Plänen.

---

## 4. Takeshi's Castle

### 4a. Bestandsaufnahme — was heute trägt

Takeshi ist die Bahn, an der das Projekt am meisten ausprobiert und gemessen hat, und das sieht
man:

- **Fallentypen mit eigenem Können.** Fünf Typen (Falle lesen, Aufstehen, Durchbrettern, Wille,
  Nehmerqualität), je mit Bild, Sternstufe und Art (körperlich/technisch/gemischt).
  `fallenKoennen:0.75` lässt den Wurf zu drei Vierteln am Können **zu dieser Falle** hängen. Die
  Geschichte „der 80er, der stark an Hindernissen ist und dazwischen nur Durchschnitt" (Chris,
  13.09.) ist mechanisch da: 13,8 Prozentpunkte Sauberquote zwischen stärkster und schwächster
  Falle desselben Läufers.
- **Mehrere Wege, konsequent:**
  - an der Falle sauber (Typ-Können), sonst Durchbruch (WUCHT), sonst Sturz;
  - im Gedränge zählt das Bessere aus WUCHT und TECHNIK („der Bulle schiebt, der Kluge sieht die
    Lücke");
  - beim Rempler Ausweichen (TECHNIK) oder Standhalten (ROBUST);
  - Nerven aus Wille, Nachladen über das Publikum (Charisma).
- **Zwei Wertungswege.** Burgpunkte je Falle (Sterne × Sauberkeit, Sturz −½ Stern) plus
  Zielbonus nach Einlauf (`burgpunkte()`/`zielbonus()`, `:25774`). Der Fallenspezialist und der
  Durchkommer punkten auf verschiedenen Konten.
- **Ausscheiden über Nerven, geordnet nach erreichter Strecke.** Das entspricht Sasuke und der
  Sendung.
- **Drei Kurse je Saat** mit derselben Fallenmenge in anderer Reihenfolge.
- **Die Pläne sind eine echte Abwägung** (0.3). Kopf voran holt im Mittel so viel wie Beherzt,
  scheidet aber öfter aus (13,9 % gegen 11,1 %). Vorsichtig ist sicherer und etwas ärmer.
  Schwächere Läufer fahren mit Vorsicht öfter richtig (40 % gegen 30 %). Keine andere Bahn hat
  das.

### 4b. Was an echter Sport- bzw. Show-Taktik fehlt

**1. Die Wahl unter Unsicherheit, das Herz der Sendung, ist ein Geschicklichkeitswurf.** Knock
Knock: vier Türen, nur eine (in frühen Folgen zwei) ist aus Papier, die anderen sind massiv oder
mit Netz dahinter. Skipping Stones: Alle Steine sehen gleich aus, nur manche tragen. In der
Sendung sind das **Rateaufgaben mit Beobachtung**. Wer später dran ist, hat gesehen, wo der
Vordermann abgeprallt ist. Bei uns sind „Tür" und „Steine" Fallenbilder eines Wurfs gegen
WUCHT bzw. WENDIGKEIT. Das „Outsmarten", das Chris am 06.09. wollte, gibt es im Gedränge und
beim Rempler, aber nicht an der Falle selbst.

**2. Kein Zeitlimit.** Sasuke hat eins, und es ist der Grund, warum „Vorsichtig" dort nicht
automatisch sicher ist (Fable-Recherche 5.2). Bei uns endet ein Rennen mit dem Notaus bei 60 s.
Das stört wenig, weil die Pläne auch ohne Limit ausgeglichen sind, aber Vorsicht kostet nie Zeit
gegen eine Uhr.

**3. Kein Finale.** Die Sendung endet im Show Down: Die Überlebenden stürmen die Burg. Bei uns
endet es mit dem Zieleinlauf. Das ist ein Bild- und Dramaturgie-Thema, kein Taktikthema.

### 4c. Vorschläge, nach Priorität — Politur, kein Umbau

**TC-P1 — „Wahl-Fallen": zwei der vierzehn Fallen werden Tür- bzw. Steinwahl. (Soll.)**

- **Zwei Fallen werden zur Wahl:** An einer Knock-Knock-Station (Typ WUCHT) und einer
  Skipping-Stones-Station (Typ WENDIGKEIT) wählt der Läufer eine von vier Türen bzw. einen Weg.
- **Die Trefferchance hängt an Falle lesen (TECHNIK: Int/Aw)** und an **Beobachtung.** Wer die
  Station erreicht, nachdem ein anderer dort abgeprallt ist, schließt diese Tür aus, sofern er es
  bemerkt (Awareness-Wurf).
- **Eine falsche Wahl ist ein Sturz mit normalen Nervenkosten**, kein Ausscheiden.
- **Taktisch entsteht damit der Gegenpol zu „Kopf voran":** Wer vorn ist, rät; wer folgt,
  lernt. Das macht „Vorsichtig" an genau diesen zwei Stationen stärker, ohne dass die Uhr es
  erzwingen muss.
- **rho-Risiko: mittel.** Der Beobachtungsvorteil hängt an der Lage (wer ist hinten). Deshalb nur
  zwei Stationen, der Vorteil nur über Awareness, und der Messvergleich gegen den heutigen Kurs.
  Rückfall: `wahlFallen` ungesetzt ist bit-identisch (Bahn-Konvention).

**TC-P2 — Zeitlimit statt Notaus. (Kann.)**

- **Limit etwa 1,6 × Siegerzeit** (Fable-Vorschlag). Wer zu Limitende nicht im Ziel ist, wird
  nach Strecke gewertet, genau wie ein Ausgeschiedener.
- **Wirkung:** Vorsichtig bekommt eine echte Kehrseite, der Ticker einen Countdown.
- **Messpunkt:** Die Planbalance (0.3) darf nicht kippen, sonst wird Kopf voran dominant.

**TC-P3 — Show-Down-Bild. (Kann, reine Präsentation.)**

- **Das Ziel wird als Burgsturm inszeniert:** Die Ankommenden laufen durchs Tor, das Tor zählt
  die Finisher je Seite.
- **Keine Mechanik:** Die Wertung bleibt Burgpunkte plus Zielbonus.

**Bewusst nicht:** die Garde als Gegner (Chris hat am 06.09. „nur gegen die gegnerische Seite"
entschieden), eine Nervenstrafe durch Rempler (gemessen schädlich, Saison 0,937 → 0,902) und eine
Stoppzeit nach Schwierigkeit (`stufePreis`, gemessen unter `fallenKoennen`).

---

## 5. „Mehrere Wege zum Erfolg" — die Leitlinie je Disziplin

| Disziplin | Primärweg | Nebenwege heute | Fehlender Nebenweg | Urteil |
|---|---|---|---|---|
| Time-Trial | Grundtempo (ANTRITT/ENDTEMPO) | Kurve (TECHNIK), Berg (ENDTEMPO + WUCHT-Nebenweg), Abfahrt (WENDIGKEIT), GESPÜR | Pacing nach Profil (TT-P1/P2), Strecke nach Profil (TT-P3) | **teilweise**: Spezialisten ja, aber immer dieselbe Strecke und eine Einheitstaktik |
| Spurt | Laufen + Stationszeitpreis | am Hindernis: Technik → Wucht | Laufweg statt Hindernis (SP-P2) | **nur am Hindernis**; Speed hat an Stationen keinen Weg |
| Staffel | Tempo auf dem Bein | Wechsel (TECHNIK/ROBUST), Kurve (WENDIGKEIT) | Starter/Kurve/Anker als Orte (ST-P2), Spirit/Charisma (ST-P3 oder `Q`) | **ein Weg** plus Wechselqualität |
| Takeshi | Typ-Können je Falle | Durchbruch, Gedränge (max), Ausweichen, Nerven/Publikum, Burgpunkte gegen Zielbonus | Beobachtung (TC-P1) | **erfüllt** |

---

## 6. Priorisierung über alle vier

| Rang | Disziplin | Dringlichkeit | Umfang | Warum |
|---:|---|---|---|---|
| 1 | **Time-Trial** | hoch | mittel (Haushalt + ein Plan + Profile) | Die einzige Taktik ist eine Scheinentscheidung (100 % Attacke), und das in der Sportart, deren Kern das Pacing ist. Vier Slots bestrafen ihren Fahrer. |
| 2 | **Staffel** | mittel | groß (fliegender Wechsel, Wechselmarke, Beinprofile, neues Einzelmaß) | Die sporttypischen Entscheidungen fehlen ganz, aber heute ohne Schaden: Die Pläne sind wirkungslos, nicht irreführend. |
| 3 | **Spurt** | hoch bei den Plänen, sonst niedrig | klein bis mittel | Dieselbe Haushaltsreparatur wie TT-P1 (gemeinsame Runde), danach die Strafschleife als Mehrwege-Baustein. Der Stationskern ist gut. |
| 4 | **Takeshi's Castle** | niedrig | klein | Die taktisch reichste Bahn, Pläne ausgeglichen, Mehrwege erfüllt. Nur Politur. |

**Reihenfolge der Arbeit:**

1. **TT-P1 und SP-P1 zusammen** („Haushalt-Runde"): pro Bahn nur Konfiguration, eine Messung
   aller zwanzig, die Plan-Sonde als neue Korridor-Kennzahl.
2. **ST-P1** (Wechselmarke mit fliegendem Gewinn).
3. **TT-P2/TT-P3** (Wellenfahrer, Profile).
4. **ST-P2** (Beine mit neuem Einzelmaß).
5. **SP-P2** (Strafschleife).
6. **TC-P1** (Wahl-Fallen).

Der Rest ist „Kann".

### 6.1 Leitplanken für jede Runde

- **Matrix unangetastet** (CLAUDE.md, endgültig). Alles hier greift an Rezeptkanälen und
  Mechanik, nicht an Gewichten.
- **Zwei Abnahmen, beide Pflicht:** rho je Spiel über 0,80, aber real mit der Latte „nicht
  schlechter als heute". Alle vier sind live, mit PPS-Referenz und CI-Schranke, das
  Climbing-Muster. Dazu Pp ≤ 25 in zwei Saatstämmen.
- **Neue Korridor-Kennzahl, Vorschlag: Plan-Dominanz.** Kein Plan ist in mehr als 60 % der
  Läufer-Rennen der beste, gemessen mit der Sonde aus Anhang A. Dazu die Profilprobe: Der beste
  Plan unterscheidet sich zwischen den Terzilen von STEHEN. Das ist die Zahl, die sagt, ob eine
  Entscheidung existiert. rho sagt das nicht.
- **Bit-Identität per Konvention.** Jedes neue Feld in `BAHN_ART` ist ungesetzt wirkungslos, die
  anderen Bahnen bleiben zeichengleich. So stehen alle bisherigen Bahn-Änderungen im Motor.
- **Kein Totalausfall durch Einzelwurf.** Also kein Fehlstart-DQ, kein Staffel-DNF, kein
  Ausscheiden durch fremde Hand.

### 6.2 Offene Fragen an Chris

1. **Spurt: welche Sportart?** Hindernissprint (heute, Spartan-Vorbild) mit Pläne ohne Sog und
   Strafschleife, oder zurück Richtung Leichtathletik-Sprint? Dieses Review empfiehlt den
   Hindernissprint und nur neue Slot-Texte, weil die Matrix einen Parcours beschreibt.
2. **Time-Trial: ein vierter Plan oder Tausch?** „Wellenfahrer" statt Negativ-Split (die
   Empfehlung) oder als vierter Knopf?
3. **Time-Trial-Profile vorab sichtbar?** Soll das Streckenprofil (flach/wellig/bergig) vor der
   Aufstellung angekündigt werden? Nur dann ist es eine Aufstellungsfrage.
4. **Staffel: Anker-Duell (ST-P3) sehen wollen, oder die sichere Variante** (Spirit/Charisma in
   der Wechselqualität)?
5. **Takeshi: Wahl-Fallen gewollt?** Das „Raten mit Beobachten" ist das Sendungs-typischste
   Element, das noch fehlt, bringt aber einen lageabhängigen Vorteil.

---

## 7. Was dieser Review bewusst nicht tut

- **Keine Zahlen kalibriert.** Alle Faktoren sind Vorschläge für eine Prototyp-Runde, gemessen
  nach Handbuch (`docs/design/neue-disziplin-handbuch.md`).
- **Keine rho-Messung der Vorschläge.** Die Plan-Sonde misst den heutigen Stand.
- **Climbing nicht bewertet.** Dafür gibt es `climbing-neukonzept-22-09.md` und den Gegencheck
  vom 24.09.
- **Die Live-Ansage nicht bewertet.** Die Rennplan-Ansage in der Arena-Ansicht erbt die Befunde
  aus 0.3: Solange Attacke dominiert, ist „umstellen" im Zeitfahren immer „auf Attacke".

---

## Anhang A — die Plan-Sonde

Nicht im Repo abgelegt (Konzeptauftrag, kein Code). Sie lief als temporäres Skript neben
`scripts/miss-bahn-puste.mjs`, mit derselben Playwright-Einbindung, und ist im Kern:

```js
// je Disziplin d, je Rennen i: Basislauf, dann jeden Heimläufer einzeln auf jeden Plan setzen
const PL = { spurt:["vorn","schatten","kick"], "time-trial":["gleich","negativ","attacke"],
             staffel:["halten","angehen","schluss"], "takeshis-castle":["vorsicht","stetig","wild"] };
const mass = (u) => d==="staffel" ? u.etappe                            // kleiner ist besser
                  : d==="takeshis-castle" ? (u.burg ? u.burg.stern+u.burg.bonus : 0)  // größer
                  : (u.zeit ?? 99);                                     // kleiner ist besser
for (let i = 0; i < 24; i++) {
  const s = 1337 + i*7919, b = __arena.bahnLauf(d, s);
  for (const h of b.laeufer.filter(u => u.seite === 0))
    for (const p of PL[d]) {
      const x = __arena.bahnLauf(d, s, [{ n: h.n, plan: p, bei: 0 }]);
      // Messgröße, Platz, raus, leer, Rest-Puste des Läufers h unter Plan p festhalten
    }
}
// Ausgabe: Anteil "bester Plan", Mittel, Ø Platz, Ausscheiden, leer, Rest — gesamt und nach
// Basisplatz obere/untere Hälfte.
```

Einschränkung: Ein Planwechsel verschiebt in Spurt, Staffel und Takeshi die Zufallsfolge. Der
„beste Plan" je einzelnem Rennen enthält dort also Würfelrauschen, die Mittelwerte nicht. Im
Zeitfahren fällt während des Rennens kein `rr()`: Dort sind die 100 % exakt.

## Quellen

- Swain, D. P. (1997): A model for optimizing cycling performance by varying power on hills and
  in wind. *Med Sci Sports Exerc* 29(8). Zusammengefasst in
  [PMC7481374](https://pmc.ncbi.nlm.nih.gov/articles/PMC7481374/).
- Atkinson, G., Peacock, O., Passfield, L. (2007): Variable versus constant power strategies
  during cycling time-trials. *J Sports Sci* 25(9),
  [PubMed 17497402](https://pubmed.ncbi.nlm.nih.gov/17497402/).
- Atkinson & Brunskill (2000): [Pacing strategies during a cycling time trial with simulated
  headwinds and tailwinds](https://www.researchgate.net/publication/12244916_Pacing_strategies_during_a_cycling_time_trial_with_simulated_headwinds_and_tailwinds).
- Livingston AC: [An Introductory Guide to 4 x 100m Relay Racing, Part I – Team
  Selection](https://www.livingstonac.com/fs/1/info/coaching/4x100_Relay_Strategies.pdf).
- [Relay race (Wikipedia)](https://en.wikipedia.org/wiki/Relay_race), 30-m-Wechselzone.
- [SimpliFaster: Keys to Winning in the 4x100 Relay](https://simplifaster.com/articles/bang-step-4x100-relay/).
- [Profiling elite male 100-m sprint performance (PMC8847979)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8847979/),
  Sprintphasen.
- [100 metres (Wikipedia)](https://en.wikipedia.org/wiki/100_metres), Reaktionszeit und
  Fehlstart unter 0,100 s.
- Spartan Race: [Can I skip an obstacle? Is there a penalty?](https://spartanrace.zendesk.com/hc/en-us/articles/202334438-Can-I-skip-an-obstacle-Is-there-a-penalty);
  [2023 Rulebook changes](https://shop.spartan.com/blogs/unbreakable-race-stories/2023-spartan-race-rulebook),
  Strafschleife.
- Keshi Heads: [Knock Knock](https://www.keshiheads.co.uk/games/knockknock),
  [Skipping Stones](https://www.keshiheads.co.uk/games/skippingstones),
  [Ultimate Showdown](https://www.keshiheads.co.uk/games/ultimateshowdown).
- Projektintern: `bahn-disziplinen-recherche-fable.md` (Ward-Smith & Radford 2002, Zignoli 2021,
  Sasuke-Quoten), `staffel-modellierung-recherche-05-09.md` (K4, Bry 2009).
