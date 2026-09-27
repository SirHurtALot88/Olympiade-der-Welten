# Broadcast-Optik der Bahn: Time-Trial, Spurt, Staffel, Takeshi's Castle (27.09.)

**Recherche und Konzept, kein Code.** Stand: `origin/main` `ebb3b99a`. `engine.js` meint
`public/mockups/battle-mode.engine.js`, die Zeilennummern gelten für diesen Stand. Climbing ist
nicht Teil des Auftrags. Es wird nur dort erwähnt, wo ein Bauteil für alle fünf Bahnen gilt.

Das Papier baut auf drei Vorgängern auf und wiederholt sie nicht:

- `broadcast-praesentation-uebergreifend-recherche-06-09.md` (Runde 1): Score-Bug, Callout,
  `HIGHLIGHTS[]`, Captions.
- `broadcast-praesentation-runde-2-22-09.md` (Runde 2): Highlight-Audit, Führung im Bild,
  Timing-Tower, Zwischenzeiten für alle Bahnen.
- `bahn-disziplinen-opus-konzeptreview-26-09.md`: die Gameplay-Lücken. Sie sind hier nur
  Kontext. Wo ein Broadcast-Vorschlag an eine dieser Lücken stößt, steht das dabei.

Diese Runde fragt enger: **Wie sieht eine echte TV-Übertragung der jeweils ähnlichsten Sportart
aus, und was davon lässt sich im 2D-Motor als Verlängerung dessen bauen, was heute schon auf dem
Bildschirm steht?**

---

## 0. Fazit vorweg

### 0.1 Zwei Befunde am Bestand (nur Anzeige, aber falsch)

Den Führungswechsel hat Runde 2 am 26.09. gebaut (`updateHudBahn`, `engine.js:25144–25153`). Er
liest `bahnRangliste().reihe[0]`, und diese Rangliste bedeutet nicht in jeder Bahn „führt“:

1. **Takeshi's Castle: ein Ausgeschiedener kann „die Führung übernehmen“.** Wer an den Nerven
   scheitert, bekommt `u.fertig=90+(1-u.pos)*10` (`:30078`). `bahnRangliste()` sortiert jeden
   mit `fertig` vor jeden ohne (`:24915`). Scheidet also jemand aus, bevor der Erste im Ziel ist,
   steht er auf `reihe[0]`. Einen Frame später meldet der Ticker **fett und mit Callout**
   „X übernimmt die Führung.“, direkt nach „X scheidet aus“. Das ist per Code-Lesart
   festgestellt. Im Bild ist es nicht nachgeprüft, weil die Platte der Umgebung in dieser Runde
   voll war (s. 7). Ausscheiden vor dem ersten Zieleinlauf ist kein Randfall: die Plan-Sonde des
   Konzeptreviews misst 11–14 % Ausscheider je Läufer und Rennen.
2. **Staffel: „Führung“ heißt dort „schnellste Etappe“, nicht „Team vorn“.** Die
   Staffel-Rangliste sortiert nach `bahnLeistung` (Etappenzeit, `:24741`). Der Ticker meldet
   deshalb „X übernimmt die Führung“, sobald X die schnellste *Etappe* hat. Zur selben Zeit kann
   das Delta-Feld darüber (`#bhDelta`, aus `staffelZeitDelta()`) das *andere* Team vorn zeigen.
   Das sind zwei Wahrheiten auf einem Bildschirm, genau das, was die Kommentare in `bahnTeamstand`
   vermeiden wollen.

Dazu kommt ein schwächerer dritter Fall. **Im Zeitfahren** kommt die Meldung aus der
*Hochrechnung*. Ein Fahrer „übernimmt die Führung“ also nach 5 % der Strecke. So spricht keine
Zeitfahr-Übertragung. Dort gibt es „Schnellster an der Zwischenzeit“ und den „Hot Seat“ (TT-1,
TT-2).

Die Reparatur ist in allen drei Fällen reine Anzeige: je Bahn eine eigene Quelle für „wer führt“
(Takeshi: Burgpunkte oder nur Laufende; Staffel: `staffelZeitDelta().seite`; Zeitfahren: nur echte
Zielzeiten und Zwischenzeiten). **Priorität 1, vor allem Neuen.**

### 0.2 Die neuen Elemente, nach Priorität

„A“ heißt **nur Anzeige**: liest bestehende Felder, ruft kein `rr()`, schreibt nichts, was
`stepSpurt`/`tempoVon`/`wert()` liest. Das ist rho- und Pp-neutral per Konstruktion. „A\*“ heißt
**Anzeige, aber im Sim-Schritt verdrahtet**: ein Zähler oder ein Merker muss in `stepSpurt` an
einem bestehenden Ereignis mitgeschrieben werden. Das ist ebenfalls ohne Wertungswirkung, aber
**vorher/nachher messen** (`miss-alle-disziplinen.mjs 24 <diszi>`, Zahl auf drei Stellen gleich).
„W“ heißt **berührt Wertungslogik** und braucht die volle Abnahme (rho je Spiel > 0,80 **und**
Pp-Abweichung ≤ 25, CLAUDE.md).

| Prio | Nr. | Element | Disziplin | Art | Aufwand |
|---|---|---|---|---|---|
| 1 | G-1 | Führungswechsel je Bahn richtig belegen (0.1) | TT, Staffel, Takeshi | A | klein |
| 1 | TT-1 | **Zwischenzeit-Einblendung am Fahrer** (Rang + Delta, Farbe) | Time-Trial | A | klein |
| 1 | TT-2 | **Hot Seat**: Bestzeithalter sichtbar im Zielbereich, „verdrängt“-Moment | Time-Trial | A | klein |
| 1 | SP-1 | **Stationsnamen** auf der Bahn und im Ticker (Plan 05.09. §4.4, nie gebaut) | Spurt | A | klein |
| 1 | ST-2 | **Stand nach jedem Wechsel** („nach Bein 3: A +0,6 s“) an der Wechselzone | Staffel | A | klein |
| 1 | TK-1 | **Fallen-Namensschild** mit Stufe und Primärweg | Takeshi | A | klein |
| 1 | TK-2 | **„Noch im Rennen“-Zähler** je Team (die Kernzahl der Sendung) | Takeshi | A | klein |
| 1 | TK-3 | **Nerven sichtbar** am Läufer (entscheidet das Ausscheiden, heute unsichtbar) | Takeshi | A | klein |
| 2 | G-2 | **Streckenband** (Course Strip) mit allen Läufern, ein Bauteil für vier Bahnen | alle 4 | A | mittel |
| 2 | TT-3 | **Geisterfahrer**: Position des Hot-Seat-Halters bei gleicher Fahrzeit | Time-Trial | A | mittel |
| 2 | TT-4 | **„Zeit für den Teamsieg“**-Rechner (SMT-Vorbild „Zeit für Gelb“) | Time-Trial | A | klein |
| 2 | SP-2 | **Stationsstatistik** (sauber/durch/gestürzt je Station) | Spurt | A\* | klein |
| 2 | ST-3 | Bein-/Rundenzeile im Score-Bug („Bein 4/6 · Runde 2/3“) | Staffel | A | trivial |
| 2 | ST-4 | **Führungsverlauf** als Linie im Innenfeld | Staffel | A | mittel |
| 2 | ST-5 | **Anker-Einblendung** vor dem Schlussbein | Staffel | A | klein |
| 2 | TK-4 | **Kommentar-Captions im MXC-Stil** für Ausscheiden, Sturz, Gedränge | Takeshi (+Spurt) | A | klein |
| 3 | SP-3 | Startvorstellung + ruhiger Zoom-Einstieg (Bewegungsaudit Punkt 4) | Spurt, Staffel | A | klein |
| 3 | TT-5 | Regie-Automat: Schnitt auf den Fahrer vor der nächsten Zwischenzeit | Time-Trial | A | klein |
| 3 | ST-6 | Glocke + „LETZTES BEIN“ beim Schlusswechsel | Staffel | A | trivial |
| 3 | G-3 | „Sturz des Rennens“ im Endstand, später Zeitlupen-Wiederholung | Spurt, Takeshi | A / A\* | klein / groß |
| — | W-… | Strafaufgabe (Spartan), Zeitlimit/Buzzer (Ninja Warrior), fliegende Übergabe, Final Showdown | s. Abschnitt 6 | **W** | — |

**Kein Vorschlag der Prioritäten 1–3 ändert `wert()`, ein Rezept, die Matrix, `tempoVon()` oder
einen `rr()`-Aufruf.** Nur SP-2 und die Zeitlupen-Variante von G-3 schreiben in `stepSpurt` mit.
Alles, was die Wertung berührt, steht gesammelt in Abschnitt 6 und ist dort ausdrücklich nicht
empfohlen, solange die Gameplay-Runden des Konzeptreviews nicht gelaufen sind.

---

## 1. Was Übertragungen dieser Sportarten gemeinsam haben

Die Recherche lief über das Netz (Quellen am Ende). Einige Grafik-Konventionen lassen sich über
Quellen nicht einzeln belegen, weil Senderhandbücher nicht öffentlich sind. Wo ein Vorschlag auf
**Sehgewohnheit** statt auf einer Quelle steht, ist das markiert.

Drei Sätze tragen den Rest des Papiers:

- **„The graphics are there to support the story. What you see on screen should provide the
  answer to the question you're about to ask yourself.“** So sagte es Joris Wauman, Executive
  Producer von HBS, zur Hallen-WM 2026 (SVG Europe). Das ist die Messlatte für jedes Element
  unten. Welche Frage stellt der Zuschauer in dieser Sekunde, und steht die Antwort im Bild?
- **Zeitfahren ist ohne Vergleich langweilig.** Die Inner Ring (2013) schreibt, 95 % des Bildes
  seien „a rider tucked into an aero position“. Spannung gebe es nur, „when a rider approaches a
  time check or the finish line because this is when we see who is up and who is down“. Die
  einzige Produktionsidee der letzten zehn Jahre sei der **Hot Seat** gewesen. Split-Screen
  („two smaller images of men pedalling“) sei ohne Tempo-Kontext bedeutungslos.
- **Hindernis-Shows leben vom Scheitern, nicht vom Gelingen.** Takeshi's Castle (TBS 1986–90),
  die UK-Fassung mit Craig Charles (Challenge, ab 2002, Segment „Ridiculous Replay“), MXC
  (Spike TV 2003–07, „Impact Replay“) und Wipeout (ABC 2008, Zeitlupen-Stürze, Strichfiguren zur
  Kurserklärung) setzen denselben Schwerpunkt. Der Sturz wird angekündigt, gezeigt, wiederholt
  und kommentiert. Ninja Warrior (Sasuke/ANW) zählt dagegen, **wie weit** einer kommt: „the
  farthest in the least time“, Buzzer am Ende, Zeitlimit je Stufe.

Daraus folgen für die Bahn vier Muster. Jedes davon hat im Motor schon einen Ansatzpunkt:

| Muster | Echtes Vorbild | Ansatzpunkt im Motor |
|---|---|---|
| **Vergleich am Messpunkt** | Zeitfahr-Zwischenzeit, Staffel-Wechsel, F1-Sektor | `u.zz`, `bahnBesteZeit`, `staffelZeitDelta`, Wechsel-Zweig in `stepSpurt` |
| **Referenz im Bild** | Hot Seat, Weltrekordlinie (Schwimmen), „virtueller Führender“ | Zielbereich der geraden Bahn, `laeuferXY`, `camX` |
| **Kurs als Vokabular** | Ninja-Warrior-Hindernisnamen, Takeshi-Spielnamen | `hindernisBilder`, `fallenBild`, `HUERDEN_TYP`, `fallenStufe` |
| **Scheitern als Ereignis** | Wipeout/MXC-Replays, Takeshi-Ausscheiden | `schwebe(... "ausgeschieden")`, `feed(...,true)`, `CAPTION_*`, `callout()` |

---

## 2. Time-Trial

### 2.1 Bestand (was heute auf dem Bildschirm steht)

Das Zeitfahren ist die Bahn mit der meisten Broadcast-Politur:

- **Gestaffelter Einzelstart**, 0,8 Sim-s Abstand. Wartende tragen „Start in 3,5 s“ über dem Kopf
  (`zeichneSpurt`, `:31247`).
- **Höhenprofil auf der Bahn**: Zonentönung, gerichtete Schraffur, ▲/▼/S-Glyphe und eine
  Hügelsilhouette über der Baumreihe (`bodenZeitfahren`, `:26627`).
- **Fokus-Panel `#ttfokus`** neben der Leinwand (`renderZeitfahrenPanel`, `:32643`). Es hat eine
  Roster-Leiste mit Startnummer und ein Profilband mit ZZ-Markern und Positionsmarker. Dazu kommen
  Rang und Rückstand (hochgerechnet), Puste in %, die Splits ZZ1/ZZ2/Ziel mit Diff zur Feldbestzeit
  und eine Auto-Schaltung.
- **Breiter Puste-Balken** mit 20-%-Marke, **Zeitfahr-Weste**, **Vorlage am Berg**.
- **Teamstand als Zeitsumme**, während des Rennens hochgerechnet („Zeitsumme (Hochrechnung)“).
- **Ticker**: Zieleinlauf mit vorläufigem Rang, Top 3 fett. Dazu der Führungswechsel aus der
  Hochrechnung (s. 0.1).

**Was fehlt:** Der eine Moment, von dem das Zeitfahren im Fernsehen lebt, findet **nicht im Bild
statt**. Das Überfahren der Zwischenzeit schreibt eine Zahl ins Panel neben der Leinwand, und das
nur für den fokussierten Fahrer. Auf der Strecke passiert beim ZZ-Marker nichts. Einen Hot Seat
gibt es nicht. Die fertigen Fahrer stehen als „Platz n · Zeit“-Zeilen rechts der Ziellinie, der
Bestzeithalter ist optisch einer von ihnen.

### 2.2 Vorbilder

- **Tour de France, Einzelzeitfahren.** Zwei Zwischenzeiten sind Standard, 2025 in Peyragudes etwa
  bei km 4 und 7,6 auf 10,9 km. Bei Ankunft an der Zwischenzeit erscheinen Zeit, vorläufiger Rang
  an diesem Punkt und Rückstand auf den bisher Schnellsten dort. Der **Hot Seat** ist der
  Bestzeithalter, der im Ziel sitzt und zusieht (Inner Ring 2013; Rouleur).
- **NBC/SMT (Tour-Übertragung, zehn Jahre Partnerschaft):** vorausgesagte Zielzeit, „the time each
  rider must finish to take the yellow jersey“, Abschnittsvergleich zweier Fahrer, Streckenprofil
  mit Fahrerfortschritt, Live-Karte.
- **Farbcode „besser als bisher“:** lila, grün, rot ist aus der F1 bekannt (Runde 2, Tabelle 2). In
  Radsport-Grafiken ist grün/rot für vor/hinter üblich (Sehgewohnheit).

### 2.3 Vorschläge

**TT-1: Zwischenzeit-Einblendung am Fahrer (Prio 1, A).**
Überfährt ein Fahrer eine Zwischenzeit, erscheint für etwa 3 s eine kleine Tafel über seinem Kopf
(Bildschirmraum, dieselbe Ankerung wie der „Start in“-Countdown). Sie zeigt **„ZZ1 · 3. · +1,4 s“**
oder **„ZZ1 · BESTZEIT −0,6 s“**. Bei Bestzeit ist die Tafel gold oder lila, sonst rot mit Plus.
Die Farbe entscheidet sich am Vergleich mit `bahnBesteZeit(ci)` *vor* dem Überfahren. Der
Ticker bekommt dazu eine Zeile, **fett nur bei neuer Bestzeit an diesem Punkt**. Damit bleibt die
Highlight-Dosis im Hockey-Rahmen von 4–10 je Rennen: zwei Punkte mal wenige Bestzeitwechsel.

- Daten: `u.zz[ci]` wird in `stepSpurt` ohnehin geschrieben (`if(BA().zwischenzeiten)`). Die
  Anzeige merkt sich in einem eigenen `Set` („id|ci gemeldet“), wer schon eingeblendet wurde,
  und prüft das in `updateHudBahn`. Der Sim-Schritt bleibt unberührt.
- Nebenbei beantwortet das die Frage, die der Konzeptreview (1a) als Kern des Zeitfahrens nennt:
  „Hält er den Vorsprung vom Berg auf der Abfahrt?“ Die ZZ liegen genau an den Hügelenden.

**TT-2: Hot Seat (Prio 1, A).**
Rechts der Ziellinie, wo die Fertigen heute ohnehin stehen, bekommt der **Bestzeithalter** eine
eigene Stelle. Gezeichnet wird ein Stuhl oder Podest aus zwei Rechtecken, die Figur in Idle-Pose,
ein Schild „HOT SEAT“ und seine Zeit. Verbessert ihn ein Nachfolger, wechselt die Figur den Platz.
Ticker und Callout melden dann **„Y verdrängt X vom Hot Seat — −0,6 s“** (fett). Das ersetzt im
Zeitfahren den heutigen hochgerechneten Führungswechsel (0.1). Der Hot Seat wechselt nur bei
**echten** Zielzeiten, also genau wie in der Übertragung.

- Daten: `bahnBesteZeit(-1)` und der Fahrer dazu, gemerkt je Frame wie `bahnFuehrenderId`.
- Wichtig für die Lesbarkeit: Der Hot Seat ist eine **Referenz im Bild** (Runde 2, Regel 5). In
  einer Disziplin mit Einzelstart gibt es keinen Gegner im Bild, gegen den man optisch führt. Der
  Hot Seat ist dieser Gegner.

**TT-3: Geisterfahrer (Prio 2, A).**
Auf der Bahn des fokussierten Fahrers erscheint ein halbtransparenter Umriss oder eine senkrechte
Linie in Gold. Er steht dort, wo der **Hot-Seat-Halter nach derselben Fahrzeit** war. Liegt der
Geist vorn, fährt der Fokussierte hinterher. Der Abstand ist in Metern auf dem Bild zu sehen, ohne
eine Zahl zu lesen. Das ist die Schwimm-Weltrekordlinie aus Runde 2 (Tabelle 2), übersetzt ins
Zeitfahren, und das Pendant zum SMT-Abschnittsvergleich zweier Fahrer.

- Daten, ohne neuen Puffer: Die Position des Bestzeithalters über der Zeit lässt sich
  **stückweise linear aus drei Stützpunkten** rekonstruieren. Die Punkte sind `(u.zz[0], 0,40)`,
  `(u.zz[1], 0,76)` und `(bahnZeit(u), 1)`, dazu `(0, 0)`. Das ist ungenau innerhalb der Zonen,
  aber an den ZZ exakt, und genau dort wird hingesehen. Vor dem Bau ist zu prüfen, ob `u.zz`
  relativ zu `startT` gezählt ist. `bahnBesteZeit` vergleicht die Werte direkt, das spricht dafür.
- Ohne einen ersten Finisher gibt es keinen Geist. Das ist ehrlich, denn die Übertragung hat vor
  dem ersten Zieleinlauf auch keine Referenz.

**TT-4: „Zeit für den Teamsieg“ (Prio 2, A).**
Das ist das SMT-Element „time to take the yellow jersey“, übertragen auf die Teamwertung nach
Zeitsumme (`wertung:"zeit"`, Chris 22.09.: „wie bei tour de france … die zeiten aller im team
addiert“). Sobald eine Seite komplett im Ziel ist, steht im Score-Bug oder im Panel **„Gast braucht
für die letzten 2 im Schnitt unter 1:02,4“**. Der Wert ist reine Arithmetik aus `bahnTeamstand()`:
Zeitsumme der fertigen Seite minus die Zeiten der fertigen Gegner, geteilt durch die Zahl der noch
Fahrenden. Vorher bleibt das Feld leer, damit keine Hochrechnung als Ansage erscheint (dieselbe
Regel wie `gewertet` in `bahnTeamstand`).

**TT-5: Regie-Automat für die Zwischenzeit (Prio 3, A).**
Die Auto-Schaltung des Fokus (`bahnFokusAuto`) springt heute weiter, sobald der Fokussierte im
Ziel ist. Vorschlag: **Etwa 0,03 Strecke vor jeder ZZ schneidet die Regie auf den Fahrer, der als
Nächster dort ankommt.** Nach der Einblendung (TT-1) geht sie zurück. Das ist die einzige
„Kamerafahrt“, die der 2D-Motor sinnvoll kann: nicht schwenken, sondern schneiden. Vorbild ist die
Inner-Ring-Beobachtung, dass nur die Messpunkte Spannung tragen.

**Nicht empfohlen:** Split-Screen zweier Fahrer. Die Inner Ring nennt ihn ohne Tempo-Kontext
„meaningless“, und im Motor stünden zwei halb so große Leinwände nebeneinander. Der Geisterfahrer
(TT-3) leistet denselben Vergleich in einem Bild.

**Achtung, Gameplay-Kontext:** Der Konzeptreview misst, dass „Attacke“ für jeden Fahrer in jedem
Rennen der beste Plan ist (0 %/0 %/100 %). Eine Anzeige, die Pacing *erklärt* (etwa „Attacke
kostet Puste am Berg“), würde eine Scheinentscheidung bewerben. Solche Pacing-Grafiken erst nach
der Haushalt-Reparatur TT-P1 des Reviews bauen. TT-1 bis TT-5 zeigen dagegen nur Ergebnisse und
sind davon unabhängig.

---

## 3. Spurt

### 3.1 Bestand

- **Massenstart von 12 Läufern**, gerade Bahn, sieben Stationen als Kacheln (Hürde, Balken,
  Palisade, Seil, Wassergraben, Mauer, Stroh; `hindernisBilder`, `:27053`), Lagerfeuer hinter dem
  Ziel.
- **Sichtbarer Windschatten** (blauer Keil, `:31200`). Über dem Kopf stehen Plan-Label mit
  „· Sog“/„· leer“ und die Rennplan-Ansage mit Nachleuchten. Darunter der Puste-Balken.
- **Schwebetexte am Läufer**: stolpert, bricht durch, getackelt/gerammt, weicht aus, eingebrochen,
  fängt sich. Dazu Spikes und eine Hürdenflug-Pose.
- **Kamera** zoomt bis 3,4× auf den Pulk. Unten links steht „Kamera 2,1×“.
- **Stand in Rangpunkten** „· vorläufig (von 78)“. Führungswechsel und Top-3-Zieleinlauf sind fett.

**Was fehlt:**

- **Der Kurs hat keine Namen.** Der Ticker kennt ein Wort („reißt die Hürde“, auch am
  Wassergraben). Die Texte je Station aus dem Plan vom 05.09. (`spurt-offene-fragen-plus-optik-
  plan-05-09.md` §4.4: `hindernisWorte`, Verb-Paare, Kurzwort beim Stopp) wurden nie gebaut.
- **Beim Zoom geht der Überblick verloren.** Bei 3,4× sieht man drei Stationen. Wo das Feld als
  Ganzes steht, sagt nur die Tabelle unter der Leinwand.
- **Start-Klumpen und Zoom-Sprung** 1,4× → 3,3× in den ersten Sekunden (Bewegungsaudit 26.09.,
  Punkt 4).

### 3.2 Vorbilder

- **Sasuke / American Ninja Warrior** (TBS ab 1997, NBC ab 2009): Hindernisse haben Eigennamen
  (Warped Wall, Salmon Ladder, Rolling Log). Sie sind das Vokabular der Sendung, und eine
  Außenreporterin stellt sie vor (Zuri Hall ab Staffel 11). Gewertet wird „farthest in the least
  time“, mit Buzzer am Ende und festem Zeitlimit je Stufe (Stufe 1: 2:45). Das Kommentatorenpaar
  teilt sich die Rollen in **Play-by-Play (Matt Iseman) und Color (Akbar Gbaja-Biamila)**. Die
  Kurs-Übersichtsgrafik mit der Hindernisfolge und der Zähler „wie viele haben dieses Hindernis
  geschafft“ sind **Sehgewohnheit**, in den gefundenen Quellen nicht einzeln belegt.
- **Spartan Race**: Ein gescheitertes Hindernis kostet **30 Burpees** (Wettkampfregeln).
  NBC zeigte 2016–17 „Spartan: Ultimate Team Challenge“ als Teamformat.
- **Wipeout (ABC 2008)**: Zeitlupen-Wiederholung der Stürze, Strichfiguren zur Erklärung des
  Kurses, Kommentatoren im Muster „einer ernst, einer albern“.

### 3.3 Vorschläge

**SP-1: Stationsnamen (Prio 1, A).**
Zwei Stellen:

- **Auf der Bahn**: über jeder Station ein kleines Schild im Bildschirmraum, „③ PALISADE“,
  gezeichnet in `bodenSpurtGerade` am selben `camX(h)`. Es erscheint nur, wenn die Station im Bild
  ist, und wird ab Zoom 2× kleiner, damit es im Pulk nicht die Namen verdeckt.
- **Im Ticker und als Kurzwort beim Stopp**: das Paket aus Plan 05.09. §4.4, unverändert
  übernommen (`hindernisWorte` im Akkusativ, optional Verb-Paare, Kurzwort-Schwebetext). Das ist
  eine Datenzeile in `BAHN_ART.spurt` plus zwei Ersetzungen in bestehenden `feed`-Zeilen. Der
  Schwebetext beim Stopp sitzt allerdings in `stepSpurt` am Setzen von `u.huerde`. Er ruft nur
  `schwebe()` und ist damit A\*: messen, Erwartung identisch.
- Optional ein **Stations-Callout, wenn der Führende eine Station erreicht**: „Station 4/7 · Seil“.
  Das ist die Ninja-Warrior-Vorstellung des Hindernisses. Es gehört nicht fett in den Ticker,
  sonst sind es sieben Highlights je Rennen.

**SP-2: Stationsstatistik (Prio 2, A\*).**
Unter jedem Stationsschild steht klein **„8 ✓ · 3 ⚡ · 1 ✗“**: sauber genommen, durchgebrochen,
gestürzt. Der Zuschauer sieht so, welche Station das Feld zerlegt. Das ist die Ninja-Warrior-
Statistik, und es ist der **Primär-/Nebenweg der CLAUDE.md-Leitlinie im Bild**. „✓“ ist der
TECHNIK-Weg, „⚡“ der WUCHT-Nebenweg. Man sieht, dass beide Wege durchkommen.

- Daten: Die drei Ausgänge werden in `stepSpurt` bereits unterschieden, dort sitzen die
  `schwebe`-Aufrufe „bricht durch“ und „stolpert“. Es fehlt nur ein Zähler je Station. Der Zähler
  ist ein Anzeige-Array, das `reset()` leert und nichts liest, ohne `rr()`. Weil er im Sim-Schritt
  hochgezählt wird, gilt A\*: vorher/nachher messen.

**SP-3: Startvorstellung und ruhiger Zoom (Prio 3, A).**
Die ersten 1,5 s (Zuschauzeit) vor dem Start zeigt die Leinwand in der Totalen einen
**Bahnen-Bug**: je Bahn Name, Team, Plan. Das ist die Leichtathletik-Startvorstellung. Danach
zoomt die Kamera **weich** statt im Sprung. Das beantwortet den Punkt aus dem Bewegungsaudit mit
einem Broadcast-Mittel statt mit einer Koordinatenänderung. Vor dem Bau ist zu prüfen, dass `cam`
nirgends in `stepSpurt` gelesen wird. Der Kommentar an `laeuferXY` sagt, die `schwebe`-Aufrufe
seien seit PR 1 davon gelöst.

**Nicht empfohlen im Spurt:** eine Rennuhr mit Zeitlimit oder Buzzer (W, s. 6) und
Fail-Zähler je Läufer als große Zahl. Im Spurt scheidet niemand aus. Eine Zahl, die nur zählt,
ohne dass etwas passiert, ist Protokoll.

---

## 4. Staffel

### 4.1 Bestand

- **Oval** mit drei Runden, sechs Beinen und zwei Wechselzonen. Die Zonen sind als gelbe Dreiecke
  je Spur markiert (World-Athletics-Muster), die Ziellinie ist kariert und beschriftet
  (`bodenSpurtOval`, `:26868`).
- **Wartende** stehen gedimmt in der Zone. Der Nächste läuft sichtbar an, der Stab wandert in
  einer Übergabe-Animation von Hand zu Hand.
- **`#bahnHud`**: aktueller und nächster Läufer je Seite mit Eignung. Das Führungsfeld zeigt
  „X führt +1,2 s“ mit Balken, am Ende den Zielabstand.
- **Stand „1 : 0 in Führung · vorläufig“** aus `staffelZeitDelta()`.
- **Etappenränge** „Rang 2/7“ in Tabelle und Kaderkacheln (Runde 2, Teil A) und eine eigene
  Wechsel-Spalte.
- **Ticker**: „verpatzt die Übergabe“ fett, „bringt die Staffel ins Ziel“ fett, dazu der
  Führungswechsel (falsch belegt, s. 0.1).

**Was fehlt:**

- **Der Wechsel ist ein Moment ohne Grafik.** Er steht nur im Ticker als „übergibt an Y — 0,4 s
  im Wechsel“. Die Staffelübertragung macht den Wechsel zum Messpunkt: Stand nach Bein n.
- **Wo im Rennen man ist**, steht nirgends. Welches Bein, welche Runde, wann der Schlussläufer
  kommt, zeigt keine Anzeige.
- **Das Innenfeld ist leer.** Es ist die größte freie Fläche aller Bahn-Bilder, grün mit ein paar
  Wartenden.

### 4.2 Vorbilder

- **Leichtathletik-Staffel, 4×100 m / 4×400 m.** Die Wechselzone ist 30 m lang, 20 m Übergabe
  plus 10 m Beschleunigung (seit 2018). „A relay is won or lost as much on the exchanges as on
  raw speed.“ **Offizielle Beinzeiten gibt es nicht**, nur die Endzeit zählt. Omega richtete in
  Los Angeles eine Fotofinish-Kamera auf die Mitte der letzten Wechselzone aus, um sie trotzdem zu
  messen (speedendurance.com). In der Übertragung ist der **Zwischenstand bei jedem Wechsel**
  deshalb die Grafik, mit Reihenfolge und Abstand zum Führenden. Dazu kommt die Glocke vor der
  letzten Runde. Beides ist Sehgewohnheit bei WM und Olympia, nicht einzeln per Quelle belegt.
- **Schlussläufer-Drama**: Beim Anker wird eingeblendet, wer gegen wen läuft und mit welchem
  Rückstand er den Stab bekommt (Sehgewohnheit).
- **Führungsverlauf als Linie**: Die „Game Flow“-Grafik aus NBA-Übertragungen und die
  Abstandsdiagramme der F1 zeigen den Verlauf eines Vorsprungs über die Zeit. Ein Führungswechsel
  ist dort das Kreuzen der Nulllinie (Sehgewohnheit).

### 4.3 Vorschläge

**ST-1 = G-1: Führungswechsel auf Teamebene (Prio 1, A).**
Siehe 0.1. In der Staffel kommt der Führende aus `staffelZeitDelta()` (`seite`, `unklar`, `delta`).
Die Meldung lautet **„Heim übernimmt die Führung — +0,3 s nach Bein 4“**. Das ist dieselbe
Quelle wie `#bhDelta` und der 1 : 0-Stand, eine Wahrheit.

**ST-2: Stand nach jedem Wechsel (Prio 1, A).**
Sobald ein Bein endet, erscheint an der Wechselzone, an der es passiert ist (gelbe Dreiecke), für
etwa 3 s eine Tafel **„NACH BEIN 3 · Heim +0,6 s“** in der Farbe des Führenden. Darunter steht die
Wechselqualität: „Wechsel 0,4 s“ grau oder „VERPATZT +1,1 s“ rot. Der Ticker bekommt die Zeile
nicht fett, außer die Führung hat dabei gewechselt. Das ist der Messpunkt der Staffel, das
Gegenstück zu TT-1.

- Daten: Den Beinwechsel erkennt die Anzeige, wenn sich der aktive Läufer einer Seite ändert.
  Das Muster ist dasselbe wie in `#bahnHud`, das `aktivU` je Frame liest. Delta aus
  `staffelZeitDelta()`, Wechselzeit aus `u.wechselKonto`. Kein Eingriff in `stepSpurt`.

**ST-3: Bein- und Rundenzeile (Prio 2, A, trivial).**
Im Score-Bug oder als dritte Zeile im Delta-Feld von `#bahnHud` steht „Bein 4/6 · Runde 2/3“. Das
ist Runde 2, Vorschlag 3 (Kontextzeile), für die Staffel konkret. Runde 2 §1.2 warnt, eine dritte
HUD-Zeile *je Seite* läge auf der äußersten Bahn. Deshalb gehört die Zeile in den Bug oder ins
mittlere Delta-Feld, nicht in die Seitenblöcke.

**ST-4: Führungsverlauf im Innenfeld (Prio 2, A).**
Eine flache Linie über die Breite des Innenfelds. Die x-Achse ist die Rennzeit, die y-Achse das
Delta aus `staffelZeitDelta()` (oben Heim, unten Gast, Füllung in Teamfarbe). Senkrechte feine
Striche markieren die Beingrenzen. Ein Führungswechsel ist sichtbar das Kreuzen der Mittellinie,
ein verpatzter Wechsel ein Knick. Das ist Chris' „ohne Stats sehen, wer wen besiegt“ (22.09.) für
die Staffel, im Spielraum (Runde 2, Regel 5), und es nutzt die größte leere Fläche des Bildes.

- Daten: ein Anzeige-Puffer `[rennT, delta, seite]`, je Frame in `updateHudBahn` gefüllt, von
  `reset()` geleert. Die Wartenden stehen an den zwei Zonen am Rand des Innenfelds. Die Linie liegt
  in der Mitte, mit mindestens 40 px Abstand zu den Warteschlangen (vor dem Bau am Screenshot
  prüfen).

**ST-5: Anker-Einblendung (Prio 2, A).**
Wenn Bein 6 beginnt, zeigt ein Lower Third für 3 s **„SCHLUSSLÄUFER · Draco (Eig 72) gegen Tidesprinter
(Eig 65) · Rückstand 0,8 s“**. Alle Werte stehen schon in `#bahnHud`, hier kommen sie einmal groß
zum richtigen Zeitpunkt. Über `callout()` mit Caption, nicht fett im Ticker.

**ST-6: Glocke und „LETZTES BEIN“ (Prio 3, A, trivial).**
Beim Wechsel auf das Schlussbein: ein Glockenton (`tonMetall` mit hoher Frequenz, der Ton-Katalog
hat die Bausteine) und für 2 s ein Schild „LETZTES BEIN“ an der Ziellinie. Das ist die
Leichtathletik-Konvention der letzten Runde. Das Schlussbein ist hier eine halbe Runde, deshalb
„Bein“ statt „Runde“.

**Gameplay-Kontext:** Laut Konzeptreview ist die Staffel „ein Zeitfahren mit Stabwechsel“, die
Pläne sind in 61 % der Fälle zeichengleich. ST-2 und ST-4 machen den Wechsel und den Verlauf
**sichtbar**. Sie machen aber auch sichtbar, wie wenig dort heute passiert (Median-Zielabstand
0,45 Sim-s). Das ist gewollt: Die Grafik stellt die Frage, die der Staffel-Umbau (Review 3c:
Beinprofile, Wechselmarke) beantworten soll. Sie ist kein Ersatz dafür.

---

## 5. Takeshi's Castle

### 5.1 Bestand

- **Eine echte Karte** statt einer Bahn. Midoriyama ist in fünf Zonen gezeichnet: Wiese, Wälle mit
  Palisaden, See mit Steg, Hang mit Felsen, Burghof mit Pflaster (`bodenTakeshiRoute`, `:26180`).
  Am Ende steht die Burg mit Toren, Türmen, Bannern und Deko der Emperor's Guards.
- **14 Fallen** mit zehn Bildern. Jede hat einen Wegpfahl mit 1–3 Sternen für ihre
  Schwierigkeit. Dazu kommen drei benannte Kurse (Nordhof, Sumpfpfad, Die Mauern).
- **Burgpunkte-Band** unten: „Burgpunkte 18,5 : 16,0“, dazu Kursname und eine Legende der Formel.
- **Am Läufer**: live „★ 3,5“, Startnummernband, Posen (Sprung, Ducken im Schlamm, Taumeln nach
  dem Sturz).
- **Schwebetexte**: seine Falle, zieht durch, setzt um, stolpert, ausgeschieden, gerammt, weicht
  aus, im Gedränge.
- **Ticker**: Stark- und Schwach-Meldungen je Station (`fallenMelden`), Gedränge, Ausscheiden fett.
- **Ton**: Publikums-Loop, „platsch“ beim Ausscheiden, Tor-Klang im Ziel.

**Was fehlt:**

- **Die Fallen haben Bilder und Sterne, aber keinen Namen.** Die Namen (Honeycomb Maze, Skipping
  Stones, Knock Knock, Bridge Ball, Final Fall) stehen nur in Code-Kommentaren (`:27950`).
- **Die Zahl, um die sich die Sendung dreht, fehlt:** Wie viele sind noch im Rennen?
- **Die Nerven**, die über das Ausscheiden entscheiden, sind am Läufer unsichtbar. Sie stehen nur
  als %-Spalte in der Wertungstabelle. Das Ausscheiden kommt deshalb aus dem Nichts.
- **Kommentar** gibt es nur als Tickertext. Die Caption-Sätze (`CAPTION_*`, `:31642`) kennen
  Tor, Touchdown, K.o. und Zieleinlauf, aber nichts von Takeshi.

### 5.2 Vorbilder

- **Takeshi's Castle, TBS 1986–1990.** 86 bis 142 Kandidaten je Folge treten gegen fest benannte
  Spiele an, etwa Slippery Wall, Skipping Stones, Honeycomb Maze und Bridge Ball. Scheitern endet
  meist in Wasser oder Schlamm. Das Feld schrumpft von Spiel zu Spiel, am Ende steht der **Final
  Showdown** gegen Graf Takeshi. Die Reboot-Fassung von 2023 (Prime Video) hat als Finale
  „Yabusame“.
- **UK-Fassung, Challenge ab 9.11.2002, Kommentar Craig Charles.** Der Kommentar ist komplett
  nachsynchronisiert. Charles setzt feste Sprüche für wiederkehrende Momente („Russian judge gives
  9.9“ für Überschläge), dazu kommen die „Ridiculous Replay“-Segmente. Die Pointe folgt **nach**
  dem Platscher, nicht davor.
- **MXC, Spike TV 2003–2007.** Das Material ist das von Takeshi, **neu erzählt als Wettkampf
  zweier oder dreier Teams mit Punktestand**. Das ist exakt unser Format: zwei Teams, Burgpunkte.
  Die Kommentarrollen sind geteilt, Vic Romano sachlich, Kenny Blankenship albern. Dazu kommt
  das Segment **„Impact Replay“**, eine Zeitlupe der Stürze.
- **Wipeout, ABC 2008.** Das Muster Play-by-Play plus Color ist dasselbe. Stürze kommen in
  Zeitlupe, der Kurs wird mit Strichfiguren erklärt.

### 5.3 Vorschläge

**TK-1: Fallen-Namensschild (Prio 1, A).**
Der Wegpfahl mit den Sternen (`:26321 ff.`) bekommt ein **Namensschild**, das ab Zoom 1,5× lesbar
ist. Erreicht der erste Läufer eine Falle, zeigt ein Lower Third für 2,5 s
**„FALLE 5/14 · KLOPF-KLOPF-TÜREN · ★★★ · Wucht“**. Die letzte Angabe ist der Sub-Skill, der die
Falle entscheidet. Sie zeigt dem Zuschauer den **Primärweg**, also die Verbindung von der
Matrix-Eignung zum Bild (CLAUDE.md: „wenn ich einen Spieler mit einer Stat von 80 reinschicke,
erwarte ich auch, dass da einer der Top-Leute ist“). Wer den Namen sieht, weiß vorher, wessen Falle
das ist. Das passt zu den Stark-/Schwach-Meldungen, die es schon gibt.

Deutsche Namen je Bild (`fallenBild`), als Vorschlag:

| Bild | Sub-Skill | Vorbild der Show | Name im Spiel (Vorschlag) |
|---|---|---|---|
| `labyrinth` | TECHNIK | Honeycomb Maze | Wabenlabyrinth |
| `eis` | TECHNIK | Slippery Wall / Slip Way | Rutschhang |
| `steine` | WENDIGKEIT | Skipping Stones | Springende Steine |
| `walzen` | WENDIGKEIT | Rolling Log / Rollers | Walzenlauf |
| `tuer` | WUCHT | Knock Knock | Klopf-Klopf-Türen |
| `seilwand` | WUCHT | Wall-Klettern | Seilwand |
| `brueckenball` | STEHEN | Bridge Ball | Brückenball |
| `schlamm` | STEHEN | Mud-Spiele | Schlammgrube |
| `raeder` | ROBUST | (Final Fall / Karts) | Riesenräder |
| `spitzen` | ROBUST | — | Stachelgasse |

Eine Datenzeile `fallenName:{…}` in `BAHN_ART["takeshis-castle"]`. Die Namen sind eigene,
angelehnt an die Show, und übernehmen keine Markennamen wörtlich.

**TK-2: „Noch im Rennen“-Zähler (Prio 1, A).**
Ins Burgpunkte-Band unten kommt je Team eine Reihe aus sechs kleinen Figuren-Piktogrammen. Weiß
heißt im Rennen, gold im Ziel, grau durchgestrichen ausgeschieden. Daneben steht groß **„noch 9
im Rennen“**. Beim Ausscheiden wird ein Piktogramm grau und kippt, synchron zum „platsch“. Das ist
die Kernzahl der Sendung (das Feld schrumpft) in unserer Zwei-Team-Form (MXC).

- Daten: `u.raus`, `u.fertig`, `u.seite`. Im Band ist Platz: 460 px breit, 44 px hoch, die
  zweite Zeile ist heute die Legende. Die Legende kann in einen Tooltip oder die Fußzeile der
  Wertungstabelle wandern, denn nach dem ersten Rennen liest sie niemand mehr.

**TK-3: Nerven sichtbar (Prio 1, A).**
Unter dem Puste-Balken liegt eine zweite, schmale Leiste in Lila für die Nerven
(`u.nerven/u.nervenMax`, `:29047`). Kostet ein Sturz Nerven, blinkt die Leiste kurz. Unter 25 %
pulsiert sie, damit ein bevorstehendes Ausscheiden **angekündigt** wird. Die Show lebt davon, dass
man sieht, wie einer wackelt, bevor er fällt. Heute kommt „ausgeschieden“ ohne Vorwarnung.
Alternative mit weniger Pixeln sind drei Herzen über dem Kopf. Dort ist die Spalte aber voll
(Name, Plan, ★). Die Leiste unten ist deshalb besser.

**TK-4: Kommentar-Captions im MXC-Stil (Prio 2, A).**
Das Caption-System (`waehleCaption`, deterministischer Rundlauf, **kein `rr()`**, `:31640`) bekommt
drei Listen:

- `CAPTION_AUSSCHEIDEN`, etwa „Und ab ins Wasser — {n} ist raus!“, „Das war's mit den Nerven,
  {n}.“, „Zurück zum Sammelplatz mit dir, {n}!“ (angelehnt an Charles' „Back to the funny farm“).
- `CAPTION_STURZ_SCHWER`, nur für einen Sturz an einer Drei-Sterne-Falle, damit es selten bleibt.
- `CAPTION_GEDRAENGE`: „Fünf Mann an einer Tür — das wird eng!“

Die Rollen sind so verteilt wie bei MXC und ANW: Der **Ticker ist Play-by-Play** (bleibt, wie er
ist), die **Caption im Callout ist Color**. Zum Timing: Die Caption kommt mit dem Callout, und der
Callout sollte **0,4 s nach** dem Schwebetext „ausgeschieden“ erscheinen, nicht gleichzeitig. Die
Pointe folgt dem Platscher, wie bei Charles. Dafür braucht `callout()` einen optionalen
Verzögerungs-Parameter (DOM-Timer, keine Sim-Zeit).

Dieselbe Mechanik trägt im Spurt `CAPTION_STURZ` für das Wasser. Den Ton setzt Chris. Die
Vorlagen sind Beispiele, nicht die Endfassung. Sie verspotten niemanden real und bleiben im
Weltenbild der Olympiade.

**TK-5: Burgpunkte-Stand mit Führungsfarbe (Prio 2, A).**
Die Burgpunkte im Band stehen in der **Teamfarbe des Führenden**. Bekommt ein Team Punkte, blinkt
kurz „+2,5 ★“ am Band. Das ist das MXC-Scoreboard und Runde 2, Regeln 2 und 7. Der Führungswechsel
(G-1) meldet in Takeshi **den Wechsel beim Burgpunkte-Stand der Teams**, nicht den Läufer vorn auf
der Strecke. Die Strecke ist hier nicht die Wertung.

---

## 6. Was die Wertung berühren würde: nicht in diese Runde

Diese Elemente sind in echten Übertragungen typisch. Bei uns wären sie aber **Mechanik**, nicht
Grafik. Jedes braucht die volle Abnahme mit rho je Spiel (Ziel über 0,80) und Pp-Abweichung (≤ 25,
zwei Saatstämme). Einige kollidieren außerdem mit den Befunden des Konzeptreviews.

| Element | Vorbild | Warum W | Einschätzung |
|---|---|---|---|
| **Strafaufgabe bei Sturz** (Burpees, Strafschleife) | Spartan Race, 30 Burpees | ändert Zeiten, also Ränge, also `wert()` | der Konzeptreview schlägt die Strafrunde im Spurt schon als Nebenweg vor (2c). **Dort** entscheiden, die Grafik (Schleife neben der Station) kommt dann mit |
| **Zeitlimit und Buzzer**, Ausscheiden bei Überschreitung | Sasuke/ANW, Stufe 1 in 2:45 | schneidet Läufer ab, verschiebt die Rangtreue | für Spurt nicht empfohlen (Massenstart, niemand soll ausscheiden). Für Takeshi nennt der Review einen Countdown als Kehrseite von „Vorsichtig“ (4c): eigene Runde |
| **Ein Fehlversuch beendet den Lauf** | ANW (Wasserkontakt), Takeshi-Original | macht aus der Rangliste „wie weit“ statt „wie schnell“ | nicht empfohlen, der Nervenhaushalt von Takeshi ist die bessere Form |
| **Final Showdown** gegen die Burg | TBS-Original, Reboot 2023 | neue Wertungsphase | reizvoll, aber eine eigene Mechanik-Runde |
| **Fliegende Übergabe / Wechselmarke** | Leichtathletik | ändert Etappenzeiten | Review 3c, Kern des Staffel-Umbaus |
| **Streckenprofil vor dem Start zeigen** | Tour-Vorschau | Chris wählt Pläne danach, eine Frage des Gameplays | Review 6.2, offene Frage 3 an Chris |
| **Pacing-Grafik** (Watt/Puste-Kurve als Empfehlung) | SMT/NBC | nicht Wertung, aber sie bewirbt eine Scheinentscheidung | erst nach Review TT-P1 (Haushalt), s. 2.3 |

---

## 7. Bauteile über alle vier Bahnen

**G-1: Führungswechsel je Bahn richtig belegen (Prio 1, A).**
In `updateHudBahn` (`:25144`) wählt eine Weiche die Quelle für „wer führt“:

| Bahn | Quelle | Meldung |
|---|---|---|
| Time-Trial | nur echte Zeiten: Hot Seat (TT-2), Bestzeit an ZZ (TT-1) | „verdrängt vom Hot Seat“, „Bestzeit an ZZ1“ |
| Spurt | wie heute, `bahnRangliste().reihe[0]` (Massenstart, Strecke = Rang) | „übernimmt die Führung“ |
| Staffel | `staffelZeitDelta().seite` (Team) | „Heim übernimmt die Führung — +0,3 s nach Bein 4“ |
| Takeshi | Burgpunkte-Stand der Teams (`bahnTeamstand().seiten`); Ausgeschiedene nie als „Führender“ | „Gast übernimmt die Führung bei den Burgpunkten“ |

Das ist rho-neutral: `bahnRangliste()` selbst bleibt, wie sie ist. Endstand, Rangtreue-Messung
und Kaderkacheln lesen sie, nur die *Meldung* bekommt eine andere Quelle.

**G-2: Streckenband / Course Strip (Prio 2, A).**
Ein schmales HTML-Overlay am oberen oder unteren Rand der Leinwand. Es ist nach dem Muster des
Profilbands im Zeitfahr-Panel gebaut (`#ttprofil`: absolut positionierte Zonen, ZZ-Marker, ein
Positionsmarker) und bleibt **immer sichtbar**, mit Punkten für **alle** Läufer in Teamfarbe. Der
Führende trägt einen Ring (Runde 2, Regel 6: Marker am Akteur). Je Bahn liefert eine Funktion die
Markierungen:

- Time-Trial: Geländezonen und ZZ, wie heute im Panel.
- Spurt: sieben Stations-Piktogramme mit Kurzwort (SP-1).
- Staffel: sechs Beinsegmente mit Wechselmarken. Die Punkte zeigen den Teamfortschritt
  (`gesamtfortschritt(seite)`), nicht den einzelnen Läufer.
- Takeshi: 14 Fallen als Sterne, eingefärbt nach Zone. Ausgeschiedene bleiben als graues ✗ an
  ihrer Stelle stehen, so sieht man auch im Band, **wo** das Feld zerlegt wurde.

Vorbilder: das Streckenprofil mit Fahrerfortschritt bei SMT/NBC (belegt), die Kurs-Grafik von
Ninja Warrior und die Streckenkarte der F1 (Sehgewohnheit). Das Band löst das Überblick-Problem
des Zooms (Spurt bis 3,4×, Takeshi-Karte) ohne Eingriff in die Kamera. Zum Timing-Tower aus
Runde 2 (§7.1) ist es keine Konkurrenz. Der Tower ist die Liste, das Band ist die Karte. In der
F1 stehen beide nebeneinander.

**G-3: „Sturz des Rennens“ (Prio 3).**
Die kleine Variante ist A. In der Höhepunkte-Liste des Endstands (`renderHighlights`) steht eine
Zeile „Sturz des Rennens: X an der Palisade“. Gewählt wird der Sturz des am Ende
bestplatzierten Gestürzten (die Fallhöhe, dramaturgisch), aus Ticker-Daten, die es schon gibt.
Die große Variante ist A\* und aufwendig: eine **Impact-Replay-Zeitlupe** (MXC, Wipeout) von 2 s
vor dem Endstand-Overlay. Dafür braucht es einen Ringpuffer der Läuferpositionen und viz-Felder
der letzten Sekunden rund um jeden Sturz. Das ist ein eigener Zeichenmodus, der aus dem Puffer
statt aus `LAEUFER` liest. Nutzen hoch, Aufwand hoch. Erst nach G-2.

---

## 8. Reihenfolge, Abnahme, Aufwand

| Schritt | Inhalt | Warum hier |
|---|---|---|
| 1 | **G-1** | repariert zwei Fehlmeldungen, die heute fett mit Callout erscheinen, und liefert die Quellen für TT-2, ST-2, TK-5 |
| 2 | **TT-1 + TT-2** | der Kernmoment des Zeitfahrens, beide an vorhandenen Zahlen, zusammen etwa 80 Zeilen |
| 3 | **TK-1 + TK-2 + TK-3** | drei kleine Zeichenstellen im Takeshi-Bild, zusammen die „Show“-Ebene |
| 4 | **SP-1 + ST-2** | Namen und Wechselstand, je eine Datenzeile oder ein Anzeige-Merker |
| 5 | **G-2 Streckenband** | größter Einzelnutzen über vier Bahnen, mittlerer Aufwand |
| 6 | TT-3, TT-4, ST-3–ST-5, TK-4, TK-5, SP-2 | Politur auf dem Fundament |
| 7 | SP-3, TT-5, ST-6, G-3 | Kür |

**Abnahme je Schritt:**

- **A-Elemente:** `node scripts/miss-alle-disziplinen.mjs 24 time-trial spurt staffel takeshis-castle`
  vorher und nachher. Die Zahl muss auf drei Stellen gleich sein. Das ist ein Leerlauf-Beleg,
  aber billig, und er fängt den Fall ab, dass eine Anzeige doch einmal `rr()` streift.
- **A\*-Elemente (SP-2, Kurzwort-Schwebetext aus SP-1, G-3 groß):** dieselbe Messung ist hier
  **Pflicht**, nicht Beleg, weil der Schritt in `stepSpurt` verdrahtet wird.
- **Pp-Abweichung:** Ist die Simulation bit-identisch (gleiche rho auf drei Stellen, gleiche
  Zufallskette), ist `einflussVon()` es auch, denn es misst dieselben Läufe. Eine eigene
  Pp-Messung braucht es nur, wenn rho sich auch nur in der dritten Stelle bewegt. Dann ist ein
  A\*-Element in Wahrheit ein W-Element und gehört zurück in Abschnitt 6.
- **Sichtprüfung:** Standalone-Mockup `/mockups/battle-mode.html` über die Screenshot-Skripte
  (`scripts/screenshot-disziplin.mjs <diszi>`), Saaten `sicht-1337`, `sicht-7`, `sicht-4242`
  wie in Runde 2. `/dev-arena` zeigt die React-Bühne, nicht den Motor (Runde 2, §1.3).
- **Highlight-Dosis:** Nach Schritt 2–4 die fetten Zeilen je Rennen zählen, mit dem
  MutationObserver aus Runde 2 (`tmp/zaehle-highlights.mjs`). Ziel 4–10 je Rennen. Neue
  Einblendungen (ZZ, Wechsel, Fallen-Lower-Third) laufen deshalb bewusst über eigene Tafeln im
  Bild, **nicht** über das big-Flag.

**Einschränkung dieser Runde:** Die Platte der Umgebung war voll, zeitweise 0 MB frei. Deshalb
lief in dieser Runde weder ein Browser noch eine Messung. Alle Aussagen über den Bestand stammen
aus dem Code (`origin/main` `ebb3b99a`, Zeilennummern oben), nicht aus einem Screenshot. Das gilt
besonders für die zwei Befunde in 0.1. Sie sind aus dem Sortiercode von `bahnRangliste()`
abgeleitet und vor der Reparatur einmal im Bild zu bestätigen (Takeshi, Saat mit frühem
Ausscheiden; Staffel, erste Übergabe).

---

## 9. Offene Fragen an Chris, mit Voreinstellung

1. **Hot Seat als Figur auf einem Stuhl oder nur als hervorgehobene Zeile im Zielbereich?**
   Voreinstellung: Figur auf einem Podest. Die Referenz im Bild ist der Punkt.
2. **Fallennamen deutsch (Wabenlabyrinth, Klopf-Klopf-Türen …) oder die englischen Namen der
   Show?** Voreinstellung: deutsch, angelehnt, nicht wörtlich.
3. **Wie frech darf der Kommentar sein (TK-4)?** Craig Charles und MXC leben vom Spott über die
   Kandidaten. Voreinstellung: frech über das Missgeschick, nie über Herkunft oder Aussehen
   der Figur, weil es Chris' eigene Spieler sind.
4. **Streckenband oben oder unten?** Voreinstellung: unten im Zeitfahren (dort steht oben das
   Höhenprofil) und oben in den anderen drei. Bei Takeshi ist unten ohnehin das Burgpunkte-Band.
5. **Sollen die Zwischenzeit- und Wechseltafeln (TT-1, ST-2) auch im Tempo 4× stehen bleiben?**
   Voreinstellung: Anzeigedauer in echten Sekunden (3 s), unabhängig vom Tempo, wie der Callout.

---

## Quellen

**Netz (Recherche 27.09.2026):**

- The Inner Ring, „A Trial To Watch“ (Juli 2013), zur Zeitfahr-Produktion, zum Hot Seat und zum
  Split-Screen: https://inrng.com/2013/07/time-trial-tv-production/
- Rouleur, „What it's like being in the time-trial hot seat“:
  https://www.rouleur.cc/blogs/the-rouleur-journal/what-it-s-like-being-in-the-time-trial-hot-seat
- SMT, Echtzeit-Tempo- und Steigungsgrafiken für NBCs Tour-Übertragung, mit vorausgesagter
  Zielzeit, „time to take the yellow jersey“, Fahrervergleich und Profil mit Fortschritt:
  https://smt.com/smt-supplies-real-time-speed-gradient-graphics-for-nbcs-tour-de-france-coverage/
- 2025 Tour de France, Zwischenzeiten im Zeitfahren Peyragudes:
  https://en.wikipedia.org/wiki/2025_Tour_de_France
- Individual time trial: https://en.wikipedia.org/wiki/Individual_time_trial
- SVG Europe, Grafik und Daten bei der Hallen-WM 2026 (Zitat Joris Wauman, HBS):
  https://www.svgeurope.org/blog/headlines/championship-level-how-graphics-and-data-enhance-the-viewer-experience-at-the-world-indoor-athletics/
- World Athletics, 4×100 m: https://worldathletics.org/disciplines/relays/4x100-metres-relay
- Speed Endurance, Ankerbein-Splits und die Omega-Fotofinish-Kamera an der letzten Wechselzone:
  https://speedendurance.com/2014/05/27/complete-stats-of-4x100m-fastest-anchor-leg-splits/
- Sportsmonkie, Wechselzone 30 m und „won or lost on the exchanges“:
  https://sportsmonkie.com/relay-race-explained/
- American Ninja Warrior mit Zeitlimits, Buzzer, „farthest in the least time“ und den
  Kommentatorenrollen: https://en.wikipedia.org/wiki/American_Ninja_Warrior
- Sasuke mit Stufen, Zeitlimits und Wasserkontakt: https://en.wikipedia.org/wiki/Sasuke_(TV_series)
- Spartan Race, 30-Burpee-Strafe:
  https://spartanrace.zendesk.com/hc/en-us/articles/203602743-Official-Rules-Guidelines-and-Penalties-for-Spartan-Race-Obstacles
- Spartan: Ultimate Team Challenge (NBC 2016–17):
  https://en.wikipedia.org/wiki/Spartan:_Ultimate_Team_Challenge
- Takeshi's Castle mit TBS-Format, Spielnamen, UK-Fassung Craig Charles, „Ridiculous Replay“ und
  Reboot 2023: https://en.wikipedia.org/wiki/Takeshi's_Castle
- TV Tropes, Takeshi's Castle, Sprüche von Craig Charles:
  https://tvtropes.org/pmwiki/pmwiki.php/Series/TakeshisCastle
- Most Extreme Elimination Challenge (Spike TV 2003–07) mit Teamformat, Punktestand, „Impact
  Replay“ und Kommentarrollen: https://en.wikipedia.org/wiki/Most_Extreme_Elimination_Challenge
- Wipeout (ABC 2008) mit Format, Zeitlupen und Kommentatoren:
  https://en.wikipedia.org/wiki/Wipeout_(2008_game_show)

**Im Repo:**

- `public/mockups/battle-mode.engine.js` (`ebb3b99a`): `bahnRangliste` `:24901`,
  `bahnTeamstand` `:24956`, `updateHudBahn` `:25112`, `bodenTakeshiRoute` `:26180`,
  `bodenSpurtGerade` `:26393`, `bodenZeitfahren` `:26627`, `bodenSpurtOval` `:26868`,
  `BAHN_ART` `:27019`, `staffelZeitDelta` `:29469`, `stepSpurt` `:29481` (Ausscheiden `:30078`),
  `zeichneSpurt` `:30973`, `callout`/`CAPTION_*` `:31606–31660`, `renderZeitfahrenPanel` `:32643`.
- `docs/design/broadcast-praesentation-runde-2-22-09.md`, `broadcast-praesentation-uebergreifend-recherche-06-09.md`,
  `staffel-oval-broadcast-hud-recherche-06-09.md`, `spurt-offene-fragen-plus-optik-plan-05-09.md` (§4.4),
  `bahn-disziplinen-opus-konzeptreview-26-09.md`, `ui-bewegungs-audit-26-09.md` (Branch `ui-bewegungs-audit-26-09`).
