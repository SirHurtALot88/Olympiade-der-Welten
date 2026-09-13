# Eiskunstlauf — Startreihenfolge, Spotlight und Zwischenstand (Recherche + Umsetzung, 13.09.)

**Reine Präsentationsebene.** Es wird keine einzige Zahl anders gerechnet: `rezept`, `MATRIX`,
`erfolg`, `failAbzug`, die 80/20-Duett-Fusion und `u.summe` bleiben unangetastet. Geändert wird
ausschließlich, **wann wer im Bild ist** und **was daneben steht**. Nachgemessen in Abschnitt 6.

## 0. Auslöser — Chris, 13.09., wörtlich

> „das sieht weird aus und das embedded ist genau über den charakteren die dürften sich nicht
> darüber bewegen. wenn caraktere fallen teleportieren sie sich dann weiter obwohl sie ja am
> selben punkt bleiben müssten eigentlich. und aktuell bewegen sie sich zwar viel, aber ich weiß
> nicht ob alle gleichzeitig sinnvoll ist UND man hat gar keine indikation welche leute sich
> gerade besser schlagen als andere - vllt kannst du das konzeptionell auch überarbeiten ich hab
> da keine idee was man machen kann bei dieser disziplin 😞"

Drei Befunde, einer davon ein echter Fehler, zwei davon Konzeptfragen.

---

## 1. Der Sturz-Teleport — Ursache nachgestellt

`stepKuer()` berechnete den Zielpunkt jedes Läufers **jedes Bild neu als reine Funktion der
globalen Bühnenuhr `buehneT`**:

```js
const grundX = F.cx + F.ax*Math.sin(w1*buehneT + phi);
```

Diese Uhr läuft weiter, während ein gestürzter Läufer absichtlich liegen bleibt (`haeltStelle`).
Das Liegenbleiben ist **nicht** der Fehler — es ist genau das, was Chris erwartet. Der Fehler
stand in der Zeile danach:

```js
} else if(!haeltStelle){ nx=zielX; ny=zielY; }
```

Ein **unbedingter Sprung** auf den Punkt, an den die Kurve inzwischen weitergelaufen ist, ohne
jede Zwischenstufe — genau in dem Bild, in dem der Läufer wieder aufsteht (nach
`KUER_STURZ_DAUER` = 1,0 s). Bei bis zu ~78 px/s Bahngeschwindigkeit ist das ein Satz von bis zu
78 px in einem einzigen Bild. Zwei Zeilen darüber stand für die Schlusspose bereits die richtige
Technik (gedeckelter Schritt `Math.min(dist, tempo*dt)`) — sie galt nur für diesen einen
Sonderfall.

### 1.1 Ein Tempo-Deckel allein reicht NICHT — nachgemessen

Der erste Anlauf war genau das: derselbe gedeckelte Schritt für jeden Zielpunkt, 190 px/s. Ein
Playwright-Zustandsabzug (`window.__arena`-Diagnosehaken, nur während der Arbeit eingebaut und
vor dem Commit wieder entfernt) zeigte bei t = 40 s:

```
Krolach   grp2 kuer (531,317)   Johanna  grp2 kuer (780,212)
```

**249 px auseinander** — zwei Partner eines Duetts, die nebeneinander laufen sollen. Grund: die
Sturzhäufigkeit. `erfolg = min(0.94, 0.15 + TECHNIK*0.0055 + NERVEN*0.0035)` liegt bei realen
Kadern zwischen ~0,51 und ~0,87; dazu hält jeder dritte Durchgang als Pirouette an. Ein Partner
steht damit rund die Hälfte der Zeit, und in dieser Zeit läuft ihm die Kurve schneller davon, als
ein gedeckelter Schritt sie wieder einholt. Der Rückstand **akkumuliert**.

*Unabhängig bestätigt:* `docs/design/eiskunstlauf-kalibrierung-10-09.md` Abschnitt 2, Punkt 3
(Opus-Overseer-Review zu PR #903) hat mit `scripts/probe-eiskunstlauf-ton.mjs` Teil C
nachgezählt: **58 Stürze zu 66 sauberen Landungen bei 125 Elementen, Fehlschlagquote 47 %.** Das
ist dieselbe Zahl, aus einer anderen Richtung gemessen, und der Grund, warum ein Haltefenster in
voller Elementlänge hier lückenlos überlappt. (Dass 47 % gegenüber der realen Sportart zu hoch
sind, ist ein Rezept-Thema und steht in jenem Dokument — diese PR fasst das Rezept nicht an.)

### 1.2 Die tragfähige Behebung: eine Bahnuhr je Paar

Die Lissajous-Kurve läuft nicht mehr auf `buehneT`, sondern auf **`u.vizBahnT` — einer eigenen
Uhr je Startgruppe, die stehen bleibt, während das Paar hält.** Damit gibt es die Lücke gar
nicht mehr, die der Sprung überbrücken musste: beim Aufstehen läuft die Kurve genau dort weiter,
wo sie beim Sturz stehengeblieben ist. Das ist buchstäblich Chris' „müssten ja am selben punkt
bleiben".

Zwei Feinheiten, beide nachgemessen statt geraten:

* **Die Uhr gehört dem PAAR, nicht der Person.** Beide Partner tragen denselben Wert. Zwei
  getrennte Uhren driften auseinander und das Duett zerfällt genauso wie vorher.
* **Sie steht nur bei einem GEMEINSAMEN Halt.** Der erste Versuch („steht, sobald einer hält")
  ergab im Abzug `bt=0,02` nach zwölf Sekunden — das Paar bewegte sich praktisch gar nicht, weil
  sich die Haltefenster beider Partner bei dieser Sturzhäufigkeit lückenlos überlappen. Hält nur
  einer, bleibt er stehen und fährt danach mit dem gedeckelten Schritt wieder auf; der Rückstand
  ist dabei durch Haltefenster × Bahntempo begrenzt (0,5 s × ≤78 px/s ≈ 39 px) und in ~0,2 s
  aufgeholt — eine weiche Korrektur, kein Sprung.
* **Die Haltefenster sind kürzer als die Elemente** (0,5 s statt 1,0/1,4 s). Ein Durchgang wird
  alle 2 × `rundenDauer` = 0,85 s je Partner enthüllt; hält die Figur die volle Elementdauer,
  gibt es zwischen zwei Elementen nie eine Fahrtlücke. Gezeichnet wird weiter über die volle
  Dauer — Halt und Optik sind zwei verschiedene Dinge.

Der gedeckelte Schritt (jetzt 260 px/s, ein einziges Tempo für alles) bleibt als Sicherheitsnetz
und ist zugleich der Weg, auf dem die Spotlight-Rotation ein- und ausfährt. Auf der Bahn greift
er im Normalfall gar nicht: bei 60 fps wandert das Ziel ≤ 1,3 px je Bild, erlaubt sind 4,3 px.

---

## 2. „Das embedded ist genau über den Charakteren" — gemessen, nicht vermutet

Über der Leinwand liegt ein HTML-Overlay: der **Broadcast-Bug** (`.bbug` in
`public/mockups/battle-mode.html` / `battle-mode.css`, `top:8px`, rund 47 Anzeige-Pixel hoch) und
auf derselben Höhe der zentrierte `.bbugcallout`. Die Leinwand ist intern 1240 × 470 und
skaliert responsiv (`canvas{width:100%}`) — **feste CSS-Pixel belegen dadurch immer mehr
Leinwandhöhe, je schmaler die Darstellung ist.** Gemessen (Playwright, `.bbug`-Unterkante in
Leinwand-Anteilen):

| Fenster | Leinwand-Anzeige | `.bbug` reicht bis |
|---:|---:|---:|
| 1300 px | 1242 px | 10,0 % H |
| 1024 px | 966 px | 12,9 % H |
| 820 px | 762 px | 16,4 % H |
| 600 px | 542 px | 23,0 % H |
| 420 px | 362 px | 44,3 % H |

Das deckt sich mit dem, was der CSS-Kommentar bei `.bahnhud` (Staffel-HUD) längst festhält
(„15% Leinwandhöhe räumt dem Bug in jeder getesteten Größe Platz") — und zeigt zugleich, dass es
darunter noch enger wird.

**Die alte Bahn `kuerFlaeche()` (`cy H*0.5`, `ay H*0.28`) reichte bis `H*0.22` hinauf**, und
Sprite-Köpfe stehen ~35 px, Schwebetexte bis 50 px **über** dem Fußpunkt. Im Vorher-Beleg
(`eiskunstlauf-vorher-13-09-hud-ueberlappung.png`) landet das „DUETT"-Etikett bei y ≈ 46 und ein
„+111"-Schweber bei y ≈ 47 — **exakt auf der Unterkante des Bugs (gemessen 47,2)**. Genau die
Überlappung, die Chris beschreibt.

**Behebung — die Eisfläche bleibt, die Bahn schrumpft.** `kuerFlaeche()` zeichnet weiterhin
dasselbe Oval (das Eis soll nicht kleiner werden); die **Bewegung** läuft auf einer neuen,
engeren `kuerBahn()` (`cy H*0.50`, `ay H*0.145`, also ab `H*0.355`). Sprite-Köpfe beginnen damit
bei `H*0.281`, der oberste Warteplatz bei `H*0.335` (Kopf `H*0.261`). Beides bleibt bis hinunter
zu einem 600-px-Fenster über dem Bug. Die Schwebetexte — die einzige Beschriftung, die nach oben
wandert — bekommen zusätzlich eine harte Obergrenze bei `H*0.27`.

Bei 420 px Fensterbreite frisst der Bug 44 % der Leinwandhöhe; dort hilft keine Geometrie mehr.
Das ist ein CSS-Thema des Overlays selbst (eigenes Ticket) und nicht Sache der Kür.

---

## 3. Wie ein echter Eiskunstlauf-Wettkampf abläuft

Quellen dieser Runde, selbst gelesen:

* **ISU-Wettkampfformat, Paarlauf** (nbcolympics.com, „Figure Skating 101: Competition format";
  Wikipedia „Pair skating"): Paare starten in **Gruppen** (sechs Gruppen, die stärksten zuletzt,
  Startreihenfolge nach ISU-Weltrangliste ausgelost). Zwei Segmente, Kurzprogramm und Kür.
* **Sechs-Minuten-Aufwärmen** (opensourcesports.io, ISU-Regeln): Die Gruppe (bis zu sechs)
  ist **gemeinsam** auf dem Eis — das ist der **einzige** Moment, in dem alle gleichzeitig
  laufen. Danach verlässt die Gruppe das Eis und **jedes Paar läuft sein Programm allein.**
* **Kiss and Cry** (Wikipedia, mentalfloss.com): Der Bereich „in the corner or end of the rink",
  Bank plus Monitor, in dem das Paar nach seinem Auftritt auf die Wertung wartet.
* **Die Wertungsgrafik der Übertragung** (Sports Illustrated, „How to Understand the Top-Left
  Scoring Graphic in Figure Skating Broadcasts", 21.02.2018): oben links, sie „always lists the
  event leader at the top", darunter die laufende Punktzahl des gerade Laufenden, darunter „a
  series of colored boxes representing each planned movement" — **grün** sauber ausgeführt,
  **rot** Sturz/Abwertung, gelb unter Prüfung.

**Der Befund ist eindeutig: „alle gleichzeitig" gibt es im echten Eiskunstlauf genau im
Aufwärmen und sonst nie.** Chris' Zweifel („ich weiß nicht ob alle gleichzeitig sinnvoll ist")
trifft den Sport exakt.

---

## 4. Umsetzung: Spotlight-Rotation nach dem Breaking-Vorbild

Dieses Projekt hat **dasselbe strukturelle Problem schon einmal gelöst** — bei Breaking.
`stepCypher()`, Funktionskopf wörtlich: „in einem echten Cypher tanzt IMMER GENAU EINER in der
Mitte, der Rest steht im Ring". Dort reichte die vorhandene Warteschlange, weil sie ohnehin nur
einen Teilnehmer je Enthüllung markiert.

Für Eiskunstlauf reicht das **nicht**, und das ist der einzige Punkt, an dem hier mehr getan
wird als bei Breaking: die Warteschlange war **rundenweise** gebaut („Durchgang 1 für alle, dann
Durchgang 2"), zwölf Läufer wechselten sich also im Sekundentakt ab. Ein Paar, das sein Programm
**am Stück** zeigt, braucht eine **gruppenweise** Reihenfolge.

### 4.1 Startreihenfolge (`bauBuehne()`, nur hinter `art.duett`)

```
Gruppe 1 (schwächstes Paar Heim) → Gruppe 1 (schwächstes Paar Gast) → Gruppe 2 Heim → …
```

Je Gruppe: Durchgang für Durchgang, innerhalb eines Durchgangs beide Partner. Bei `rundenN` 12
und zwei Partnern sind das 24 Enthüllungen × 0,425 s ≈ **10 s zusammenhängender Auftritt je
Paar** — die Größenordnung eines echten Kürprogramms. Schwächste Gruppe zuerst (der Wettkampf
baut sich auf, wie im Sport), Seiten abwechselnd (kein Team geschlossen zuerst).

### 4.2 Drei Zonen auf demselben Eis

| Zone | Wer | Darstellung |
|---|---|---|
| **Kürbahn** (`kuerBahn()`, Mitte) | genau ein Paar | volle Größe, Kufenspur, Elemente/Stürze |
| **Startbereich** (rechte Bande, `kuerWarte()`) | wer noch nicht dran war | klein (0,58), gedimmt, Startnummer |
| **Kiss and Cry** (rechts unten, `kuerKiss()`) | das eben fertige Paar | Bank + Monitor mit der Endpunktzahl |

Wer länger fertig ist, blendet über 0,8 s aus und verlässt das Bild — wie im Sport. Seine Zahlen
bleiben im Zwischenstand stehen. Ein- und Auslaufen nutzt **denselben** gedeckelten Schritt wie
die Kür (Abschnitt 1.2), es gibt dafür keinen eigenen Codepfad und keinen zweiten Sprung.

### 4.3 Zwischenstand-Tafel (`zeichneEisStand()`)

Nach dem Vorbild aus Abschnitt 3: **Führender zuoberst**, laufendes Paar hervorgehoben, darunter
die noch nicht gelaufenen Paare in Startreihenfolge mit ihrer Startnummer statt einer Zahl —
Ergebnisliste und Startliste in einem, wie die Anzeigetafel in der Halle. Darunter die
**Elementkästen**, eine Reihe je Läufer, grün sauber / rot gestürzt / grau noch nicht gezeigt.

*Warum eine Reihe je Läufer und nicht eine gemeinsame fürs Paar:* im Vorbild gehört die
Kastenreihe zu der Person, die gerade läuft. Eine zusammengefasste Reihe müsste „einer von beiden
gestürzt" in eine dritte Farbe pressen und färbte bei der realen Sturzhäufigkeit (Abschnitt 1.1)
fast jeden Kasten bernstein — sie sähe schlechter aus, als das Paar gelaufen ist.

**Jede Zahl der Tafel ist eine bereits vorhandene:** `u.summe`, `u.aktuell`,
`u.runden[r].ereignis` gegen `art.erfolgWort`/`art.failWort` — dieselben Felder, die
`WERTUNG_AUFTRITT` und `zeichneBreaking()` schon lesen. **Spoilerregel wie dort:** gelesen wird
nur `runden[0..aktuell]`.

---

## 5. Warum die Reihenfolge die Rangtreue nicht anfassen kann — beweisbar

Die Warteschlange bestimmt **ausschließlich**, in welcher Reihenfolge bereits vollständig
vorberechnete `runden[]`-Einträge aufgedeckt werden:

1. `bauBuehne()` rechnet **alle** `runden[r].punkte` fertig, **bevor** die Warteschlange gebaut
   wird (die 80/20-Duett-Fusion ebenfalls — sie steht vor der Reihenfolge und bleibt unberührt).
2. `stepBuehne()` addiert je Enthüllung `u.summe += r.punkte` — eine **Summe über dieselbe
   Menge**, also reihenfolgeunabhängig.
3. `stepBuehne()` zieht auf diesem Pfad **kein** `rr()`. Die Reihenfolge kann deshalb keine
   spätere Ziehung verschieben (der Fehler, vor dem der `buehnenBewegung`-Vertrag warnt).
4. Länge und damit Spieldauer bleiben identisch: 12 Teilnehmer × `rundenN` Einträge, vorher wie
   nachher 144.

`stepKuer()` und `zeichneDuett()` halten den Vertrag aus PR 0 wörtlich: geschrieben wird
ausschließlich auf neue `viz*`-Felder (`vizBahnT`, `vizRolle`, `vizGrp`, `vizGrpN`, `vizHalt`,
`vizVersatz`, `vizAus`, `vizNeu` kommen hinzu), **nie** auf `u.summe`/`u.runden`/`u.aktuell`/
`u.lunge`/`buehneAkt`/`buehneZeiger`/`done`, und **nie** `rr()`.

---

## 6. Abnahme

`node scripts/miss-alle-disziplinen.mjs 24`, Baseline gegen Nachher, alle zwanzig Disziplinen:
**bit-identisch**, Eiskunstlauf bei rho je Spiel **0,885** / rho Saison **0,979** (Median über
die Kader-Familie aus dem live-save-Abbild). Das ist die erwartete und geforderte Aussage — eine
reine Präsentationsänderung darf die Zahl nicht bewegen.

Gemessen wurde zweimal: einmal gegen den `main`-Stand vor PR #903/#908/#910 und, nachdem diese
drei währenddessen gelandet sind, ein zweites Mal gegen den frischen `main` nach dem Merge — bei
letzterem wurde `public/mockups/` vorübergehend auf `origin/main` zurückgesetzt, gemessen,
wiederhergestellt und erneut gemessen, damit Baseline und Nachher sich nur um diese PR
unterscheiden. Die Einzelzahlen stehen in der PR-Beschreibung.

Weiter geprüft: `node --check`, `npx tsc --noEmit` (Diff gegen `main` leer),
`npx tsx scripts/pruefe-slot-invariante.ts`.

**Ton:** PR #903 ist während dieser Arbeit auf `main` gelandet und hat die
`sfx("eiskunstlauf", …)`-Aufrufstellen in `stepKuer()` gebracht. Sie sind beim Merge unverändert
in den neuen Durchgang 1 übernommen worden; die Spotlight-Rotation ändert an ihrer Zahl und
Reihenfolge nichts, weil `u.aktuell` weiterhin nur für den gerade enthüllten Teilnehmer hochzählt
— das ist jetzt eben immer einer aus dem Paar im Spotlight. Nachgewiesen mit der Sonde aus
derselben PR: `node scripts/probe-eiskunstlauf-ton.mjs` → **GESAMT: BESTANDEN** (Teil B
Loop-Reset 1/2/3/4 über vier Kämpfe, Teil C kufe/sprung/landung/sturz feuern im echten Lauf,
Teil D Ton-Leck in allen acht Geschwister-Bühnen exakt 0).

**Geschwister-Disziplinen:** jede Änderung an `bauBuehne()`/`zeichneBuehne()` liegt hinter
`art.duett`, das ausschließlich `BUEHNE_ART.eiskunstlauf` trägt. Die acht anderen Bühnen
(gewichtheben/showcase/breaking/wettessen/speed-schach/i-spy/tennis/fechten) laufen unverändert —
in der Messung oben zeilenweise bestätigt.

---

## 7. Belege

* `docs/design/eiskunstlauf-vorher-13-09-alle-gleichzeitig.png` — sechs Paare gleichzeitig,
  Etiketten ineinander, kein Zwischenstand.
* `docs/design/eiskunstlauf-vorher-13-09-hud-ueberlappung.png` — „DUETT" und „+111" auf der
  Unterkante des Broadcast-Bugs.
* `docs/design/eiskunstlauf-nachher-13-09-spotlight.png` — ein Paar auf dem Eis, Startbereich an
  der Bande, Kiss and Cry mit der Endpunktzahl.
* `docs/design/eiskunstlauf-nachher-13-09-zwischenstand.png` — die Tafel mit Führendem,
  laufendem Paar, Startliste und Elementkästen.

## 8. Bewusst offen gelassen

* **Der Broadcast-Bug bei sehr schmaler Darstellung** (420 px: 44 % Leinwandhöhe) ist ein
  CSS-Problem des Overlays und betrifft **alle** Disziplinen gleichermaßen — eigenes Ticket,
  nicht in einer Eiskunstlauf-PR zu lösen.
* **Kurzprogramm und Kür als zwei Segmente** (ISU-Realität, Abschnitt 3) sind hier bewusst nicht
  abgebildet: das wäre eine Struktur-, keine Darstellungsfrage und würde `rundenN` berühren.
* **Eine echte Hebefigur-Pose** (eine Figur sichtbar über der anderen) bleibt wie in der
  Duett-Recherche vom 08.09. eine spätere Asset-Aufgabe.
