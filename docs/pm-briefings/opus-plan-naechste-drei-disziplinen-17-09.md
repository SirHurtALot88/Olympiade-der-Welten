# Opus-Plan: die nächsten drei Disziplinen (17.09.)

**Auftrag von Chris (17.09.):** „mach mit dem overseer dann die nächsten 3 diszis". Gesucht ist ein
frischer, priorisierter Plan für die drei Disziplinen, an denen als Nächstes gearbeitet wird.
Dieses Dokument ist dieser Plan. Es ändert **keine Zeile Produktionscode**.

**Stand beim Schreiben:** `main` = `91b17c3a` („Scorecard: Time-Trial und Spurt auf 97%/98%
nachgezogen (PR #952, 16.09.)"). Die Welle 1 des Vorgängerplans
(`docs/pm-briefings/opus-plan-top-zehn-ueber-90-16-09.md`, Aufträge B1+B2+B3) ist **vollständig
gemergt**: #951 (absoluter Stufenwächter), #952 (Time-Trial + Spurt Requisite/Ton), #953
(Scorecard-Nachzug). Der Vorgängerplan ist damit abgearbeitet und braucht keine Fortschreibung,
sondern eine Ablösung.

**Ausdrücklich ausgeschlossen, auf Chris' Ansage:**
- **I-Spy** — bewusst bis ganz zum Schluss zurückgestellt, taucht in keinem Auftrag dieses Plans auf.
- **Gewichtheben und Fechten** — laufen gerade in zwei getrennten Fable-Recherche-Aufträgen. Dieser
  Plan fasst beide nicht an, auch nicht am Rand.

**Grundlage der Rubrik:** `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`
Abschnitt 0 — Konzept K1–K4 je 25 · Assets A1 30 / A2 25 / A3 25 / A4 20 · Gameplay G1 40 / G2 30 /
G3 15 / G4 15 (Bahn/Arena 12) · Movement M1 35 / M2 25 / M3 25 / M4 15. **Gesamt = ungewichteter
Durchschnitt der vier Achsen.** Jede rho-Zahl unten ist **heute frisch gemessen**, jede
Code-Aussage am heutigen `main` mit Datei:Zeile belegt.

---

## 0. Die Kurzfassung

### 0.1 Die drei

> **Climbing, Wettessen, Showcase.** Alle drei sind reine **Präsentations**-Runden — kein Rezept,
> kein `wert()`, keine Rennlogik, damit **kein rho-Risiko**. Alle drei haben ihr Zielbild **schon
> fertig entworfen**, nämlich in ihrer produktiven React-Bühne; der Mockup-Motor spiegelt es bloß
> nicht. Und alle drei stehen seit dem 10.09. unverändert auf der Prioritätenliste der Scorecard
> selbst (Punkte 4 und 7, Abschnitt 5 dort), ohne dass eine einzige PR sie auf der Assets- oder
> Movement-Achse angefasst hätte.

| | Disziplin | heute | nach der Runde | Gewinn | Aufwand |
|---|---|--:|--:|--:|---|
| **D1** | **Climbing** | 65,50 | **85,50** | **+20,00** | klein — eine Runde, Vorbild `bodenZeitfahren()` |
| **D2** | **Wettessen** | 46,25 | **72,50** | **+26,25** | mittel — eine Runde, Vorbild `zeichneFechten()`/`stepFechten()` |
| **D3** | **Showcase** | 45,00 | **71,25** | **+26,25** | mittel — derselbe Handgriff wie D2, zweites Mal |

**Projektdurchschnitt 77,7 % → 81,3 %** (+3,6 Punkte). Mit den optionalen Zusatzstücken je Runde
(A3-Requisite, M4-Pose) sind es **82,2 %** und die drei Zeilen stehen bei 89,25 / 80,00 / 78,75.

### 0.2 Warum nicht die naheliegenderen

| Kandidat | Gesamt | warum NICHT in diesem Plan |
|---|--:|---|
| **Football** | 75,50 | Bleibt zurückgestellt — PR #944 bringt rho nur auf **0,796**, unter die Schranke. Der eigene Plan verlangt vor einem Merge erst ein größeres Messbudget. S. Abschnitt 4. |
| **Tennis** | 71,25 | An sich attraktiv (höchste Zeile unter 90 ohne rho-Wand), aber der Ertrag ist mit **+11,25** nur gut ein Drittel von D2/D3 bei ähnlichem Aufwand. Erster Kandidat für Welle 2. S. 5.1. |
| **Mini-DM / Battlefield / TDM** | 54,25 / 53,00 / 51,75 | Größtes Defizit im Feld, aber bei allen dreien ist das Kaderrauschen **größer als der Messwert selbst**. Vor jeder Rezeptarbeit steht ein Messbudget-Schritt, keine Bauzeile. S. 5.2. |
| **Basketball / Hockey** | 95,50 / 93,00 | Die von Chris abgenommene rho-Wand. Unverändert nicht wirtschaftlich. S. 5.3. |

---

## 1. Der frische Audit — alle zwanzig, heute gemessen

### 1.1 Die Messung

```
node scripts/miss-alle-disziplinen.mjs 24
```

auf `main` @ `91b17c3a`, kaderfest, Median über fünf echte Team-Paarungen der
live-save-Kaderfamilie:

```
Disziplin           Chassis     Teiln.  rho je Spiel  Spannweite  rho Saison   Abnahme
speed-schach        buehne         12         0.908       0.066       0.972   bestanden
staffel             bahn           12         0.899       0.100       0.951   bestanden
spurt               bahn           12         0.894       0.138       0.916   bestanden
showcase            buehne         12         0.892       0.158       0.937   bestanden
eiskunstlauf        buehne         12         0.885       0.083       0.979   bestanden
takeshis-castle     bahn           12         0.879       0.101       0.958   bestanden
breaking            buehne         12         0.869       0.114       0.951   bestanden
wettessen           buehne         12         0.845       0.139       0.930   bestanden
gewichtheben        buehne         12         0.843       0.208       0.930   bestanden
climbing            bahn           12         0.834       0.209       0.860   bestanden
fechten             buehne         12         0.826       0.203       0.888   bestanden
time-trial          bahn           12         0.825       0.082       0.825   bestanden
tennis              buehne         12         0.825       0.210       0.839   bestanden
basketball          feldspiel      12         0.769       0.105       0.923   knapp
football            feldspiel      12         0.722       0.164       0.832   knapp
i-spy               buehne         12         0.684       0.353       0.804   durchgefallen
hockey              feldspiel      12         0.669       0.181       0.832   durchgefallen
  davon nur Feldspieler            12         0.719       0.182       0.818   knapp
mini-dm             arena           8         0.256       0.661       0.643   durchgefallen
battlefield         arena           8         0.251       0.778       0.429   durchgefallen
tdm                 arena          12         0.165       0.272       0.322   durchgefallen
Seitenfehler: keine
```

> **Alle zwanzig Zeilen sind ziffernidentisch zur Scorecard UND zur eingecheckten Basislinie**
> (`data/generated/rangtreue-basislinie.json`, gezogen 16.09. 15:06). Keine Regression, keine stale
> Zeile, kein Basislinien-Nachzug nötig.

Unabhängig davon gegengeprüft, mit dem CI-Gate selbst (`npm run ci:rangtreue-schranke`, s.
Abschnitt 7 zum Aufruf):

```
Rho-Schranke — Basislinie vom 2026-09-16T15:06:33.031Z, 24 Spiele je Kader-Variante
Alle zwanzig Zeilen: Aenderung ±0.000, Status ok.
Absolute 0,80-Schranke: ok — keine arena-resolved Disziplin, die die 0,80-Schranke in der
Basislinie erfuellte, ist jetzt darunter gefallen.
Bestanden.
```

Das ist zugleich der erste Lauf, in dem der **absolute** Stufenwächter aus Auftrag B3 (PR #951)
mitläuft — er meldet sich ordnungsgemäß und findet nichts. Beide Wächter, der relative und der
absolute, stehen grün.

Das ist zugleich die nachträgliche Abnahme der Welle 1: PR #952 hat Time-Trial und Spurt auf der
Assets-/Movement-Achse um 45 bzw. 60 Punkte gehoben und **rho auf die dritte Nachkommastelle nicht
bewegt** (0,825 / 0,894). Das Muster „reine Präsentation kostet keine Rangtreue" ist damit zum
dritten Mal in Folge belegt (PR #929 Tennis, #946 Fechten, #952 Time-Trial/Spurt) — und es ist die
Grundlage, auf der dieser Plan drei weitere solche Runden vorschlägt.

### 1.2 Die Rangliste nach Gesamt

Vier Achsen aus Abschnitt 1 der Scorecard (Stand nach dem vierzehnten Nachtrag), Gesamt hier
**exakt** ausgerechnet statt gerundet.

| Rang | Disziplin | Chassis | Konzept | Assets | Gameplay | Movement | **Gesamt** | rho | Arena |
|--:|---|---|--:|--:|--:|--:|--:|--:|:--:|
| 1 | Spurt | Bahn | 95 | 100 | 97 | 100 | **98,00** | 0,894 | ja |
| 2 | Gewichtheben | Bühne | 100 | 100 | 90 | 100 | **97,50** | 0,843 | ja |
| 3 | Takeshi's Castle | Bahn | 100 | 95 | 97 | 95 | **96,75** | 0,879 | ja |
| 3 | Time-Trial | Bahn | 95 | 100 | 92 | 100 | **96,75** | 0,825 | ja |
| 5 | Breaking | Bühne | 95 | 100 | 95 | 96 | **96,50** | 0,869 | ja |
| 6 | Speed-Schach | Bühne | 95 | 95 | 100 | 95 | **96,25** | 0,908 | ja |
| 7 | Eiskunstlauf | Bühne | 95 | 100 | 95 | 94 | **96,00** | 0,885 | ja |
| 8 | Staffel | Bahn | 95 | 95 | 97 | 95 | **95,50** | 0,899 | ja |
| 8 | Basketball | Feldspiel | 100 | 100 | 82 | 100 | **95,50** | 0,769 | ja |
| 10 | Hockey | Feldspiel | 100 | 100 | 72 | 100 | **93,00** | 0,669 / 0,719 | ja |
| 11 | Fechten | Bühne | 75 | 100 | 90 | 100 | **91,25** | 0,826 | ja |
| — | — | | | | | | *— 90 %-Linie —* | | |
| 12 | Football | Feldspiel | 90 | 75 | **52** | 85 | **75,50** | 0,722 | **nein** |
| 13 | Tennis | Bühne | 75 | 70 | 90 | **50** | **71,25** | 0,825 | ja |
| **14** | **Climbing** | **Bahn** | 65 | **40** | 92 | 65 | **65,50** | 0,834 | ja |
| 15 | Mini-DM | Arena | 75 | 60 | **22** | 60 | **54,25** | 0,256 | nein |
| 16 | Battlefield | Arena | 70 | 60 | **22** | 60 | **53,00** | 0,251 | nein |
| 17 | TDM | Arena | 55 | 65 | **22** | 65 | **51,75** | 0,165 | nein |
| **18** | **Wettessen** | **Bühne** | 35 | **40** | 95 | **15** | **46,25** | 0,845 | ja |
| **19** | **Showcase** | **Bühne** | 25 | **40** | 95 | **20** | **45,00** | 0,892 | ja |
| 20 | I-Spy | Bühne | 55 | 40 | 37 | 20 | **38,00** | 0,684 | nein |

**Durchschnitt: 77,675 %.** (Deckt sich mit der Scorecard-Angabe „77,7 %" — die Tabelle ist
rechnerisch konsistent, das war nicht immer so.)

### 1.3 Die Zahl, die die Auswahl entscheidet

> **Showcase hat die viertbeste Rangtreue aller zwanzig Disziplinen (0,892) und den
> zweitschlechtesten Gesamtwert. Wettessen steht auf Platz 8 der Rangtreue (0,845) und auf Platz 18
> der Gesamtliste.**

Beide sind **produktiv angeschlossen und werden live gespielt** (Arena: ja, Gameplay 95). Ihre
Mechanik funktioniert nachweislich besser als die von Fechten, Time-Trial oder Tennis. Was fehlt,
ist ausschließlich, dass man ihnen das ansieht: im Motor laufen beide durch das generische
Bühnen-Reihenbild, ohne eigene Szene, ohne eigene Bewegung, ohne Requisite, ohne Ton.

Climbing ist derselbe Fall eine Etage höher: seit PR #943 (16.09.) rangtreu (0,834) **und**
produktiv angeschlossen (15. arena-resolved Disziplin), aber mit **Assets 40** die schlechteste
Darstellung aller angeschlossenen Nicht-Bühnen-Disziplinen.

Das ist genau der Zustand, den die Scorecard ihre Kernbotschaft nennt: *„das Projekt hat mehr
DESIGN als DARSTELLUNG"* — und bei diesen drei Zeilen ist der Abstand am größten.

---

## 2. Warum genau diese drei — die Herleitung

### 2.1 Der Ertrag, ausgerechnet statt behauptet

Alle drei bekommen denselben Auftragstyp: **eigene Szene + eigene Bewegung + Ton**. Was das je Achse
wert ist, steht in der Rubrik (Abschnitt 0 der Scorecard) und ist hier konservativ gerechnet — also
ohne die optionalen Zusatzstücke:

| | Achse | heute | Auftrag | nachher |
|---|---|--:|---|--:|
| **Climbing** | Assets 40 | A2 (eigene Szene, 25) + A4 (Ton, 20) | **85** |
| | Movement 65 | M1 (eigene Zeichenfunktion, 35) | **100** |
| | | | **Gesamt 65,50 → 85,50** |
| **Wettessen** | Assets 40 | A2 (25) + A4 (20) | **85** |
| | Movement 15 | M1 (35) + M2 (eigene Schrittlogik, 25) | **75** |
| | | | **Gesamt 46,25 → 72,50** |
| **Showcase** | Assets 40 | A2 (25) + A4 (20) | **85** |
| | Movement 20 | M1 (35) + M2 (25) | **80** |
| | | | **Gesamt 45,00 → 71,25** |

Konzept und Gameplay bleiben bei allen dreien **unangetastet** — das ist Absicht, siehe 2.3.

### 2.2 Das Zielbild ist schon entworfen — nur nicht im Motor

Das ist der Grund, warum diese drei Runden billiger sind als die Welle 1 es war. Der Vorgängerplan
musste bei Time-Trial noch raten, ob ein Aero-Helm bei 32 px lesbar ist (Abschnitt 8.2 dort) — und
der Helm-Entwurf wurde innerhalb der PR verworfen. Hier gibt es nichts zu erfinden: **die
produktive React-Bühne jeder der drei Disziplinen beschreibt ihr Bild bereits vollständig**, in
ihrem eigenen Kopfkommentar.

- **`app/foundation/discipline-stage/arena/disciplines/mountain.tsx`** (337 Z.):
  *„Climbing (Sportklettern) — Kletterwand-Archetyp mit Höhe = Punkte, geschwungene Griff-Linien pro
  Route, Überhang-Crux, Gipfel-Sims mit Top-Out-Glocke."*
- **`.../platter.tsx`** (441 Z.): *„Banquet-Tafel frontal: Esser-Tokens (Team-Wappen mit
  Latz-Serviette) sitzen in Reihen und futtern sich von links nach rechts. … Tellerstapel wächst
  unter jedem Esser. Magen-Meter unten mit Gabel-Marker des Führenden. 🍴 Schlinger-Pop + 😵
  Food-Koma-Animation bei schwachen Zügen."*
- **`.../showcase.tsx`** (623 Z.): *„Theatrical stage with depth, performers ascending the
  fame-staircase to the podium. … Violet spotlit stage with red velvet curtains, marquee, hype wall
  (applause meter), jury buzzers, footlights."*

Der Mockup-Motor zeigt statt dessen: bei Climbing eine graue gerade Bahn
(`BAHN_ART.climbing.boden:"#5d5a54"`, `baeume:false`, `:21983`), bei Wettessen und Showcase das
violette Podest mit drei Scheinwerferkegeln, das sich alle übrigen Bühnen teilen (`bodenBuehne()`,
`:14667`). **Der Auftrag lautet in allen drei Fällen: spiegle, was die React-Bühne schon sagt.**
Kein Designspielraum, keine offene Frage, ein Playwright-Screenshot als Abnahme.

### 2.3 Was diese Runden ausdrücklich NICHT tun

**Sie bewegen Konzept nicht.** Die Scorecard hat bei Tennis vorgemacht, dass ein Präsentations-Flag
K2 nicht verdient: Tennis trägt seit PR #929 `tennis:true` (`:12581`) und einen eigenen
Zeichenzweig — Konzept steht trotzdem unverändert bei 75, weil *„die Mechanik selbst … Speed-Schachs
`duell:true`"* bleibt. Dasselbe gilt hier: ein `wettessen:true`-Flag samt `stepWettessen()` ist
Movement, nicht Konzept.

Wer Wettessens 35 und Showcases 25 heben will, braucht **ein eigenes Fable-Dokument, das die
Disziplin von Grund auf modelliert** (K3) — das ist die Scorecard-Priorität Nr. 4 in ihrer vollen
Lesart, und es ist eine **Recherche**-Runde, keine Bau-Runde. Zwei solche Runden laufen gerade
(Gewichtheben, Fechten); eine dritte würde hinter derselben Kapazität anstehen. **Empfehlung:
erst bauen, was ohne Chris' Zeit geht — die Konzeptfrage bleibt danach genauso offen wie heute,
aber die Disziplinen sehen aus wie Disziplinen.**

**Sie fassen kein Rezept an.** Nicht `rezept`, nicht `wert()`, nicht `tempoVon()`, nicht die
Durchgangslogik. Der Vertrag aus PR 0 gilt wörtlich: geschrieben werden ausschließlich neue,
präsentationale `viz*`-Felder, und es fällt **kein** `rr()`-Aufruf. Das ist keine Vorsicht, sondern
der Grund, warum die Runden überhaupt billig sind.

---

## 3. Die drei Aufträge

### 3.1 D1 — Climbing: eine Wand statt einer grauen Bahn (65,50 → 85,50)

**Aufwand: klein, eine fokussierte Runde. Risiko: keins — reine Präsentation.**

Climbing hat als einzige angeschlossene Bahn-Disziplin **keinen Zweig in der Bahn-Weiche** — die
Scorecard führt M1 für Climbing deshalb ausdrücklich mit 0, und bei Time-Trial ist genau dieses
Kriterium am 16.09. von 0 auf 35 gesprungen, als es einen Zweig bekam. Belegt an `bodenSpurt()`
(`public/mockups/battle-mode.engine.js:21191-21215`):

```js
    if(istRoute())return bodenTakeshiRoute();      // Takeshi
    if(istOval())return bodenSpurtOval();          // Staffel
    if(BA().zeitfahren)return bodenZeitfahren();   // Time-Trial, seit PR #948
    return bodenSpurtGerade();                     // Spurt UND Climbing
```

Der Kommentar bei `bodenSpurtGerade()` (`:21217-21223`) nennt Climbing selbst beim Namen als einen
der Mitnutzer — und derselbe Kommentar erklärt bereits, warum eine Kletterwand dort falsch aussieht
(*„sonst stünde an einer Steinwand plötzlich Wiese"*, `:21227-21230`). Die Disziplin hat also seit
PR #948 einen dokumentierten Sonderfall im gemeinsamen Code, aber keine eigene Funktion.

#### D1.a — A2 + M1: `bodenClimbing()` (Assets +25, Movement +35)

**Ein Handgriff, zwei Achsen** — genau die Zwei-Achsen-Wirkung, die der dreizehnte Nachtrag für
`bodenZeitfahren()` und der zwölfte für `zeichneFechten()` schon protokolliert hat: Assets fragt
nach der eigenen Szene, Movement nach der eigenen Zeichenfunktion selbst.

- **Weiche:** eine Zeile in `bodenSpurt()`, `if(BA().climbing)return bodenClimbing();`, direkt neben
  der Zeitfahren-Zeile. Das Flag `climbing:true` steht seit dem 14.09. fest
  (`BAHN_ART.climbing`, `:21981`) und ist rein deskriptiv, ohne Wirkung auf Rezept/Matrix/`wert()` —
  der Kommentar dort sagt das ausdrücklich. **Es muss also kein neues Flag erfunden werden.**
- **Aufbau 1:1 nach `bodenZeitfahren()` (`:21458-21544`, 87 Zeilen):** `bodenSpurtGerade()`
  aufrufen und das Eigene **aufsetzen**, statt Hintergrund/Bahn/Zaun/Ziellinie ein zweites Mal zu
  zeichnen. Das hält die Funktion klein und die anderen vier Bahnen bit-identisch.
- **Was aufgesetzt wird, steht schon als Daten da:** `hindernisse:[0.08, 0.17, 0.26, … 0.89]`
  (`:21982`) sind die **zehn Griffe** an ihren festen Bahnpositionen, `hindernisWort:"Griff"` ihr
  Name, `steigung:0.85` (`:21984`) die Regel *„die Wand wird nach oben steiler"*. Eine Wandtextur
  mit zehn Griffmarken an exakt diesen Positionen plus eine mit der Strecke zunehmende
  Überhang-Schattierung ist damit **abgelesen, nicht erfunden** — dieselbe Konstruktion, mit der
  `bodenZeitfahren()` die sieben `gelaende`-Zonen sichtbar gemacht hat.

#### D1.b — A4: `sfx("climbing", …)` in `stepClimbing()` (Assets +20)

`TON_KATALOG` (`:20591`) führt heute **elf** Einträge — climbing ist keiner davon (nachgezählt:
gewichtheben, eiskunstlauf, breaking, takeshis-castle, speed-schach, staffel, football, time-trial,
spurt, fechten, hockey). Anders als bei Time-Trial und Spurt, deren Kataloge seit PR 0.1 fertig
herumlagen, muss hier **der Katalogeintrag mitgebaut werden** — fünf Zeilen Daten aus den
vorhandenen Ton-Primitiven (`tonSchlag`, `tonKlick`, `tonMetall`, `tonDoppelton`, `tonRauschen`).
Vorschlag: `griff` (Kante `u.hindernis`), `fehlgriff` (Kante `u.leer`/Stolper-Zweig), `zug`,
`topout` (Kante `u.fertig != null`).

Aufrufstellen in `stepClimbing()` (`:24669`) — die Funktion existiert seit PR #925 und schreibt
heute genau ein Feld (`u.vizSchritt`), ist also der ideale, bereits vertragskonforme Ort. Die
Ton-Merker sind weitere `viz*`-Einmalflaggen.

#### D1.c — optional: A3 (Kreidebeutel), +15 auf Assets

Ein `DISZIPLIN_PROP`-Eintrag (Kreidebeutel an der Hüfte oder Kletterschuhe am Fuß nach dem
`fuss:SPURT_FUSS`-Muster) brächte Climbing auf Assets 100 und Gesamt **89,25**. **Bewusst als
optional geführt**, weil `DISZIPLIN_PROP` (`:2858`) die Tabelle ist, an der D2 ebenfalls arbeiten
will — s. Kollisionsmatrix 6.1. Wenn D1 und D2 sequenziell laufen, gehört es dazu; wenn sie
parallel laufen, bleibt es draußen.

#### D1.d — Abnahme

```sh
node scripts/miss-alle-disziplinen.mjs 24 climbing
npm run ci:rangtreue-schranke
node scripts/screenshot-disziplin.mjs climbing 4000
```

Die erste Zeile **muss 0,834 bit-identisch** liefern. Zur zweiten Zeile s. Abschnitt 7 — sie lautet
bewusst nicht so, wie der Vorgängerplan sie geschrieben hat.

Playwright-Gegenprobe wie bei PR #952: Wand bei Climbing sichtbar, und **die anderen vier Bahnen
bit-identisch ohne Wand** (`setDisc('spurt'|'staffel'|'takeshis-castle'|'time-trial')`).

---

### 3.2 D2 — Wettessen: die Tafel, die es in der React-Bühne längst gibt (46,25 → 72,50)

**Aufwand: mittel, eine Runde. Risiko: keins — reine Präsentation.**

Wettessen ist die **am besten vorbereitete** der beiden konzeptleeren Bühnen, und zwar aus einem
konkreten Grund: seine Mechanik hat bereits ein Vokabular, aus dem sich ein Bild bauen lässt.
`BUEHNE_ART.wettessen` (`:12480-12501`) führt `rundenN:8` Durchgänge (`:12484`),
`failWort:"muss kurz pausieren"` (Chris' eigenes Wort „Pause" steht als `failKopf` in der eigenen
`wertungTabelle`) und `erfolgWort:"schlingt durch"`. Das ist eine vollständige Ereignisliste für
eine Szene.

#### D2.a — A2 + M1: `zeichneWettessen()` + `bodenWettessen()` (Assets +25, Movement +35)

Der Dispatcher in `zeichneBuehne()` (`:14854 ff.`) benennt die Lücke dreimal in eigenen
Kommentaren, wörtlich: *„die drei verbleibenden Nicht-Heben/Nicht-Schach/Nicht-Breaking/
Nicht-Tennis/Nicht-Fechten-Bühnen (I-Spy/Showcase/Wettessen) durchlaufen den generischen Zweig
darunter weiterhin unverändert."*

Die Aufnahme ist deshalb strukturell trivial und vom Code selbst eingeladen:

- **eine `else-if`-Zeile** im Boden-Dispatch (`:14862`:
  `if(art.heben)bodenHeben(); else if(art.duett)bodenEis(); else bodenBuehne();`) — der Kommentar
  darüber sagt ausdrücklich: *„Fällt ein späterer Agent eine weitere eigene Bodenfunktion dazu, ist
  das eine weitere else-if-Zeile hier, keine Umstrukturierung."*
- **eine `if(art.wettessen){ zeichneWettessen(art); return; }`-Zeile** neben den fünf bestehenden
  Zweigen (heben/schach/cypher/tennis/fechten), plus ein neues `wettessen:true` in
  `BUEHNE_ART.wettessen`.
- **Inhalt aus `platter.tsx`:** Banketttafel frontal statt Zwei-Reihen-Podest, Latz-Serviette am
  Sprite, wachsender **Tellerstapel** je Esser (die Durchgangszahl liegt vor), Magen-Meter mit
  Gabel-Marker des Führenden. Vorbild für Umfang und Bauart: `zeichneFechten()` (`:15098`) bzw.
  `zeichneTennis()` (`:14994`, 104 Zeilen).

#### D2.b — M2: `stepWettessen()` (Movement +25)

Neuer Zweig in `buehnenBewegung()` (`:13664-13676`), nach dem Muster der fünf vorhandenen
(`art.duett`/`art.cypher`/`art.heben`/`art.schach`/`art.fechten`), jeweils mit
`typeof … === "function"`-Wächter. Eine kleine Zustandsmaschine je Esser —
`greifen → schlingen → kauen → Pause` — die den `failWort`/`erfolgWort`-Ausgang des Durchgangs
liest und ausschließlich `u.vizEssPhase` schreibt. Der Vertrag steht wörtlich im Kopfkommentar über
`stepKuer()` (`:13677 ff.`, *„schreibt AUSSCHLIESSLICH neue, präsentationale viz*-Felder … und ruft
NIEMALS rr() auf"*) und ist von `stepFechten()` (`:14541`, 126 Zeilen) zuletzt am 16.09.
vorexerziert worden.

#### D2.c — A4: `TON_KATALOG.wettessen` + `sfx()` (Assets, im obigen A2+A4 schon gezählt)

Vier Ereignisse an den Kanten, die `stepWettessen()` ohnehin sieht: `biss`, `schlingen`, `pause`
(der „muss kurz pausieren"-Ausgang), `gong` (Durchgangsende). Kein Publikums-Loop — dieselbe
Begründung wie bei Time-Trial/Spurt: Risiko ohne Punkte, A4 ist binär.

#### D2.d — optional: A3 (Gabel/Teller, +15) und M4 (Schling-/Pause-Pose, +15)

Bringt Wettessen auf Assets 100 / Movement 90 und **Gesamt 80,00**. Die A3-Requisite berührt
`DISZIPLIN_PROP` — s. 6.1.

#### D2.e — Abnahme

`node scripts/miss-alle-disziplinen.mjs 24 wettessen` **muss 0,845 bit-identisch** liefern.
Gegenprobe: I-Spy und Showcase zeigen nachweislich weiterhin das generische Reihenbild (bei
sequenzieller Reihenfolge D2 vor D3).

---

### 3.3 D3 — Showcase: derselbe Handgriff, zweites Mal (45,00 → 71,25)

**Aufwand: mittel, eine Runde — aber die zweite Hälfte einer bereits gelernten Bewegung.
Risiko: keins.**

Showcase ist **die dünnste Disziplin unter den produktiven**: `BUEHNE_ART.showcase`
(`:12361-12375`) ist fünfzehn Zeilen lang und enthält nichts außer dem Sieben-Rollen-Standardrezept
mit Charisma-Gewichten — kein Flag, keine `wertungTabelle`, kein Kommentar über die Disziplin
selbst. Nachgesehen, nicht vermutet. Und zugleich steht sie mit **rho 0,892 auf Platz 4 aller
zwanzig**.

Der Auftrag ist strukturell identisch zu D2 (`showcase:true`, `bodenShowcase()`,
`zeichneShowcase()`, `stepShowcase()`, `TON_KATALOG.showcase`), und das ist der Grund, ihn direkt
hinter D2 zu hängen statt woanders hin: derselbe Agent, dieselbe Dateiregion, dieselben fünf
Berührungspunkte, ein zweites Mal — genau die Begründung, mit der der Vorgängerplan B1 und B2
(Time-Trial + Spurt) zu **einem** Auftrag zusammengezogen hat.

**Der Inhalt aus `showcase.tsx`:** Theaterbühne mit Tiefe statt flachem Podest, roter Samtvorhang,
Marquee-Schriftzug, Rampenlicht von unten, **Hype-Wall als Applausmeter**, Jury-Buzzer. `rundenN:5`,
`failWort:"verpatzt"`, `erfolgWort:"reisst das Publikum mit"` (`:12365`) liefern die Ereignisse für
`stepShowcase()` (Anlauf → Nummer → Applaus/Buzzer) und die vier Töne (`ansage`, `applaus`,
`buzzer`, `fanfare`).

**Abnahme:** `node scripts/miss-alle-disziplinen.mjs 24 showcase` **muss 0,892 bit-identisch**
liefern.

**Ehrlich dazugesagt:** Showcase steht danach bei **Konzept 25** — unverändert der schlechteste
Konzeptwert des Projekts. Diese Runde macht Showcase sichtbar, nicht durchdacht. Wer das ändern
will, braucht die Fable-Runde aus 2.3, und die gehört nicht in denselben PR.

---

## 4. Football — geprüft, und es bleibt zurückgestellt

Der Auftrag verlangt ausdrücklich eine Prüfung, ob Football in diesen Plan gehört. **Nein — und das
ist keine Übernahme aus dem Vorgängerplan, sondern heute selbst nachgesehen.**

**Der PR-Stand, per API abgefragt:** `mcp__github__list_pull_requests` auf
`SirHurtALot88/Olympiade-der-Welten` liefert für **#944** („Football-Balance-Runde: breit + Skala
0,35 (rho 0,722 → 0,796, knapp — bleibt außerhalb Arena)") unverändert `state: open`,
`draft: true`, zuletzt bewegt am 16.09. 11:39. Ebenso offen und ungemergt: **#894** (E3-Vorläufer,
„NICHT MERGEN ohne Chris' Bestätigung", seit 12.09.). Auf `main` steht Football damit weiter bei
**rho 0,722**, heute frisch bestätigt.

**Drei Gründe, warum eine vierte Football-Runde jetzt der falsche Einsatz wäre:**

1. **Der eigene Titel der Runde sagt, dass sie nicht reicht.** 0,796 liegt **unter** der
   0,80-Schranke aus CLAUDE.md. Eine Disziplin, die nach einer vollen Balance-Runde immer noch
   durchfällt, ist keine „billige Zeile".
2. **Der eigene Plan nennt eine Vorbedingung, die noch offen ist.**
   `docs/design/football-balance-runde-nach-e3-15-09.md`, Abschnitt 0 Punkt 6, wörtlich: *„Vor dem
   Merge: Kaderfamilie auf mindestens acht Paarungen erweitern …, weil die aktuelle
   Fünf-Paarungen-Messung bei dieser Größenordnung von Bewegung zu ungenau ist, um den genauen
   Skalenwert zu fixieren. Bis dahin bleibt Football außerhalb von `ARENA_RESOLVED_DISCIPLINE_IDS`."*
   Das ist ein **Messbudget-Schritt**, kein Bauauftrag — und er ist nicht erledigt.
3. **Die Messunsicherheit ist größer als der Gewinn.** Footballs Kaderrauschen beträgt heute
   **0,164**; der Abstand zwischen 0,722 und der 0,796-Behauptung ist 0,074, also weniger als die
   Hälfte davon. Derselbe Plan sagt das über seine eigene Zahl: *„die genaue Bewegung bleibt
   gegenüber der Kaderfest-Spannweite grenzwertig."*

**Was mit Football stattdessen passieren sollte** (keine Bauzeit, gehört auf Chris' Tisch): die
Kaderfamilie auf acht Paarungen erweitern und #944 **auf dieser Grundlage** neu messen. Fällt die
Zahl dann reproduzierbar über 0,80, ist Football mit einem Schlag eine der billigsten Zeilen im
Feld — PR #933 hat die PPS-Referenz bereits gezogen, es fehlte nur der Eintrag in
`ARENA_RESOLVED_DISCIPLINE_IDS`. Fällt sie nicht, ist eine weitere Rezeptrunde fällig, und die ist
nach drei Anläufen nachweislich kein umrissener Handgriff.

---

## 5. Ehrlich abgelehnt

### 5.1 Tennis — attraktiv, aber nur ein Drittel des Ertrags

Tennis (71,25) ist die höchste Zeile unter 90, die **nicht** an einer rho-Wand hängt, und es wäre
die naheliegende Wahl. Gegen eine Aufnahme in diese Runde sprechen zwei Zahlen:

- **Der Ertrag ist klein.** Offen sind A4 (Ton, 20) und M2 (eigene Schrittlogik, 25). `zeichneTennis()`
  (`:14994`) und `DISZIPLIN_PROP.tennis` (`:2868`) existieren seit PR #929 — die teuren Stücke sind
  bereits gebaut. Ergebnis einer vollen Runde: Assets 70→90, Movement 50→75,
  **Gesamt 71,25 → 82,50, also +11,25** gegen +26,25 bei Wettessen bei ähnlichem Aufwand.
- **Konzept 75 ist eine Entscheidung, kein Rückstand.** K2 fehlt, weil Tennis' Duell bewusst über
  Speed-Schachs `duell:true` läuft; `BUEHNE_ART.tennis` (`:12557-12563`) verweist dafür auf
  `docs/design/tennis-fechten-rollout-plan.md` Abschnitt A.5: *„kein interaktiver
  Ballwechsel-Rechner"*. Eine Runde, die das umdreht, ist eine Mechanik-Runde mit rho-Risiko — genau
  das, was dieser Plan nicht will.

**Offene Prüffrage, die vor einer Tennis-Runde geklärt gehört** (und die hier bewusst nicht
behauptet, sondern als Frage stehen bleibt): `tennis.tsx` ist eine bespoke Bühne mit eigenem
Ballwechsel, Ass-Funke und Führungs-Puls — die Scorecard führt M3 („sichtbare Animation in der
produktiven React-Bühne") für Tennis trotzdem als nicht erfüllt. Bei Fechten (`lamps.tsx`) und
Spurt (`bump.tsx`) hat dieselbe Rubrik M3 auf vergleichbarer Grundlage vergeben. Wenn das eine
Fehlbewertung ist, stünde Tennis heute schon bei 77,5 und nach einer Runde bei 88,75 — dann wäre die
Reihenfolge neu zu prüfen. **Das ist ein Scorecard-Audit von einer halben Stunde, keine Bauarbeit.**

### 5.2 Mini-DM, Battlefield, TDM — hier fehlt Messbudget, nicht Bauzeit

| | rho je Spiel | Kaderrauschen | Verhältnis |
|---|--:|--:|--:|
| Mini-DM | 0,256 | **0,661** | Rauschen 2,6-fach über dem Messwert |
| Battlefield | 0,251 | **0,778** | 3,1-fach |
| TDM | 0,165 | **0,272** | 1,6-fach |

Zusammen sind das die drei größten Einzelrückstände des Projekts (Gameplay je 22). Und trotzdem ist
**jede** Rezeptrunde an ihnen heute unbelegbar: eine Verbesserung, die kleiner ausfällt als die
eigene Spannweite, ist von null nicht zu unterscheiden (`docs/design/messgrundlage-kaderfest.md`).
Die Scorecard führt das seit dem 10.09. als eigene Priorität — *„Arena-Messbudget statt
Arena-Commit"*, n ≥ 96–150 —, und der PM-Gesamtstand vom 15.09. hat es wörtlich wiederholt: *„hier
zuerst zu bauen hieße, einen Erfolg zu riskieren, der sich nicht nachweisen lässt."*

> **Klar gesagt: die drei Arena-Disziplinen sind nicht deshalb draußen, weil sie unwichtig wären,
> sondern weil der erste Schritt an ihnen ein Messlauf ist und kein PR.** Dieser Schritt ist
> planbar (rund 3,5 Minuten je Disziplin und Variante bei n=150) und gehört in einen eigenen,
> kleinen Auftrag — nicht in diese Runde.

### 5.3 Basketball und Hockey — die abgenommene rho-Wand

Unverändert gegenüber dem Vorgängerplan (Abschnitt 3.3 dort), heute nur bestätigt: Basketball 0,769
(Validität 0,923), Hockey 0,669 / 0,719 (Validität 0,832). Beide haben Konzept/Assets/Movement bei
100 und fallen ausschließlich an G1 durch. Mehr Ereignisse helfen bei Hockey nachweislich nicht
(CLAUDE.md: verdoppelte Spielzeit, rho blieb bei 0,719/0,721/0,723), und beide Zahlen sind von
Chris für den Live-Betrieb abgenommen. **Nicht wirtschaftlich, und das ist ein Ergebnis, kein
Versäumnis.**

---

## 6. Kollisionen, Reihenfolge, Wellen

### 6.1 Die Berührungspunkte — `battle-mode.engine.js` ist weiterhin EINE Datei

Das bekannte Muster aus dem 10.09.- und dem 16.09.-Plan. Hier die Matrix für die drei Aufträge:

| Stelle | Zeile | D1 Climbing | D2 Wettessen | D3 Showcase | Kollision |
|---|--:|:--:|:--:|:--:|:--:|
| `TON_KATALOG` | `:20591` | neuer Eintrag | neuer Eintrag | neuer Eintrag | **JA — dreifach** |
| `buehnenBewegung()` Dispatcher | `:13664` | — | neuer Zweig | neuer Zweig | **JA** |
| `zeichneBuehne()` Zweige | `:14862-14890` | — | neuer Zweig + Boden-else-if | neuer Zweig + Boden-else-if | **JA** |
| `DISZIPLIN_PROP` | `:2858` | nur bei D1.c (optional) | nur bei D2.d (optional) | optional | **JA, falls die Optionen gezogen werden** |
| `bodenSpurt()` Weiche | `:21191` | neue Zeile | — | — | nein |
| eigene `step*`/`zeichne*`-Funktionen | je neu | eigene | eigene | eigene | nein |

### 6.2 Der Vorlauf, der die halbe Matrix auflöst

Das Projekt hat für genau dieses Problem bereits ein Rezept, und es steht als Kommentar im Code
(`buehnenBewegung()`, `:13667-13670`): *„VORAB ANGELEGT IN PR 0.3 …: drei spätere Ziel-PRs
(Gewichtheben, Speed-Schach, Fechten) hätten sonst alle dieselbe Dispatcher-Zeile angefasst. Mit den
drei Zweigen hier liefert jede dieser PRs nur noch ihre eigene Funktion, keine Änderung mehr an
dieser Stelle."*

> **Empfehlung V (Vorlauf-PR, halbe Runde, kein Risiko, kein Produktionsverhalten):**
> 1. `TON_KATALOG.climbing`, `.wettessen`, `.showcase` als **reine Daten** anlegen. Ein
>    Katalogeintrag ohne Aufrufstelle ist ein bewiesener No-op — PR 0.1 hat exakt das für sechs
>    Disziplinen gemacht, und der Katalogkommentar (`:20585-20590`) hält fest, dass `sfx()` auf ein
>    unbekanntes Ereignis ohnehin still zurückkehrt.
> 2. Die zwei Dispatcher-Zweige `art.wettessen` / `art.showcase` in `buehnenBewegung()` anlegen,
>    mit `typeof stepWettessen==="function"`-Wächter — no-op, bis die Funktionen existieren.
> 3. `wettessen:true` / `showcase:true` in `BUEHNE_ART` setzen (deskriptiv, ohne Leser).
>
> Danach berühren D1, D2 und D3 **keine gemeinsame Tabelle mehr**, außer den beiden
> `zeichneBuehne()`-Zweigen, die D2 und D3 sich teilen — und die laufen ohnehin beim selben Agenten.

Abnahme von V: `npm run ci:rangtreue-schranke` grün über alle zwanzig, und ein Screenshot je Bühne,
der zeigt, dass sich **nichts** verändert hat.

### 6.3 Die Wellen

**Welle 1 — sofort, zwei Agenten parallel**

| | Auftrag | Agent | läuft |
|---|---|---|---|
| 0 | **V** Vorlauf (Kataloge + Dispatcher) | Bauagent 1 | zuerst, halbe Runde |
| 1 | **D1** Climbing: `bodenClimbing()` + Ton | Bauagent 1 | nach V |
| 1 | **D2** Wettessen: Szene + Schrittlogik + Ton | Bauagent 2 | **parallel**, nach V, eigener Worktree |
| 2 | **D3** Showcase: derselbe Handgriff | Bauagent 2 (derselbe) | nach Merge von D2 |
| 3 | Scorecard-Nachzug (Zeilen 14, 18, 19) | Bauagent 3 | nach Merge von D1/D2/D3 |

**D1 und D2 dürfen parallel laufen, D2 und D3 nicht.** D1 arbeitet ausschließlich in der
Bahn-Region (`:21191 ff.`, `:24669 ff.`), D2/D3 ausschließlich in der Bühnen-Region (`:13664 ff.`,
`:14854 ff.`) — nach V gibt es zwischen beiden Regionen keinen gemeinsamen Berührungspunkt mehr.
D2 und D3 dagegen teilen sich `zeichneBuehne()` und den Boden-Dispatch Zeile für Zeile; zwei
parallele Agenten würden dort sicher kollidieren, und ein Merge-Konflikt in einem
Zeichen-Dispatcher ist die unangenehme Sorte — er sieht harmlos aus und lässt eine Disziplin auf
dem falschen Zweig landen.

**Die optionalen A3-Requisiten (D1.c, D2.d) kommen erst danach**, gebündelt in einer eigenen kleinen
Runde, weil sie alle drei dieselbe `DISZIPLIN_PROP`-Tabelle anfassen. Ertrag dieser Nachlese:
+3,75 / +7,50 / +7,50 Punkte, also **Projektdurchschnitt 81,3 % → 82,2 %**.

**Der Scorecard-Nachzug ist sequenziell und gehört in einen eigenen PR** — so wie #947, #949 und
#953 es zuletzt gemacht haben. Er muss rho für die drei betroffenen Zeilen **frisch messen**, statt
sie aus den PR-Texten zu übernehmen.

### 6.4 Der gemeinsame Abnahme-Pflichtteil für D1, D2 und D3

Wortgleich zum Vorgängerplan (5.5 dort), weil er sich bewährt hat:

1. **rho bit-identisch**, vorher und nachher gemessen, im PR-Dokument abgedruckt (n=24, kaderfest,
   Median über fünf echte Team-Paarungen) — Zielwerte: Climbing **0,834**, Wettessen **0,845**,
   Showcase **0,892**.
2. **Die übrigen neunzehn Zeilen bit-identisch** — `npm run ci:rangtreue-schranke` durchgängig grün.
3. **Der viz-Vertrag explizit im Kommentar**: welche Felder geschrieben werden, welche nur gelesen,
   und dass kein `rr()` fällt.
4. **Playwright-Beleg mit Gegenprobe**: die Ziel-Disziplin zeigt das Neue, die Nachbarn desselben
   Chassis zeigen nachweislich keine Spur davon.
5. **Ein eigenes `docs/design/<disziplin>-<thema>-17-09.md`** mit einem ehrlichen Abschnitt „Nicht
   Teil dieser PR".

---

## 7. Ein Fund nebenbei: die Abnahmezeile des letzten Plans läuft nicht

Beim Nachfahren der Abnahme aus dem Vorgängerplan aufgefallen. Der Plan vom 16.09. schreibt an zwei
Stellen (Abschnitt 5.1 B1.c und 5.5 Punkt 2) als Pflicht-Abnahme:

```sh
node scripts/pruefe-rangtreue-schranke.mjs
```

**Dieser Aufruf stürzt sofort ab**, selbst nachgefahren auf `main` @ `91b17c3a`:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '/home/user/Olympiade-der-Welten/lib/resolve/battle-mode-arena-team-points'
  imported from .../scripts/pruefe-rangtreue-schranke.mjs
```

Das Skript weiß das über sich selbst — sein eigener Kopfkommentar (`:36-40`) hält fest, dass es
*„über die tsx-Loader-Registrierung läuft statt über puren `node`"* und dass *„ein reiner `node
scripts/pruefe-rangtreue-schranke.mjs`-Aufruf"* scheitert, weil es eine `.ts`-Datei ohne Endung
importiert. **Der richtige Aufruf steht in `package.json:60`:**

```sh
npm run ci:rangtreue-schranke
```

Dieselbe falsche Zeile steht auch in `docs/design/fechten-rezeptkalibrierung-16-09.md:217`
(dort als `npx node …`). **Folge:** ein Bauagent, der die Abnahme wörtlich befolgt, sieht einen
Absturz, wo er ein Ergebnis erwartet — und kann daraus im schlimmsten Fall schließen, sein eigener
Eingriff habe etwas kaputtgemacht. Dieser Plan schreibt deshalb überall `npm run
ci:rangtreue-schranke`, und die Korrektur der beiden alten Stellen gehört in den nächsten
Pflege-PR. Kostet zwei Zeilen.

---

## 8. Ehrliche Einschätzung — was wirklich kommt

**Sicher: Climbing.** Es ist der billigste der drei Aufträge und der mit dem klarsten Vorbild —
`bodenZeitfahren()` hat vor einem Tag exakt dieselbe Bewegung gemacht (Weiche in `bodenSpurt()`,
Basisfunktion aufrufen, Eigenes aufsetzen), das Flag `climbing:true` liegt seit dem 14.09. bereit,
und die zu zeichnenden Daten (zehn Griffe, Steigung) stehen als Zahlen im `BAHN_ART`-Eintrag. Das
Risiko liegt nicht bei rho, sondern bei der Handwerksqualität — die zwei bekannten Fallen dieser
Art Arbeit (der 12.09.-Fund „ohne Z-Skalierung driftet die Requisite 5–10 px" und der
PR-#952-Fund „der Kopf-Anker liefert bei jeder zweiten Figur 0 sichtbare Pixel") betreffen
Requisiten, nicht Bodenzeichnungen — D1.a ist davon nicht berührt, D1.c wäre es.

**Sehr wahrscheinlich: Wettessen.** Derselbe Handgriff wie Fechten am 16.09. (das damals in einer
Runde von 64 % auf 91 % sprang), mit einem fertigen Vorbild in `platter.tsx` und einer
Ereignisliste, die schon im `BUEHNE_ART`-Eintrag steht. Der einzige Grund, warum es nicht so sicher
ist wie D1: eine Banketttafel ist ein **Layoutbruch** mit dem Zwei-Reihen-Bild, kein Aufsatz darauf
— das ist mehr neuer Code als bei D1, und Layoutbrüche haben in diesem Projekt schon zweimal eine
Nachbesserungsrunde innerhalb derselben PR gebraucht (Breaking PR #913, Eiskunstlauf PR #917).

**Wahrscheinlich, aber als drittes und nicht als erstes: Showcase.** Technisch identisch zu D2, und
genau deshalb geht es hinterher — was D2 an Layout-Überraschungen findet, spart D3 ein.

**Was dieser Plan ausdrücklich NICHT verspricht:** dass danach eine der drei Zeilen über 90 % steht.
Climbing landet bei 85,50 (mit der Requisiten-Nachlese 89,25), Wettessen bei 72,50, Showcase bei
71,25. Der Deckel sind bei allen dreien **Konzept** (65 / 35 / 25) und bei Wettessen/Showcase
zusätzlich Gameplay (das schon bei 95 steht und nicht weiter kann). Wer diese drei Zeilen über 90
sehen will, braucht **Fable-Konzeptrunden**, und die sind teurer als alles in diesem Plan
zusammen.

**Die Antwort auf Chris' Frage, in einem Satz:** Die nächsten drei sind **Climbing, Wettessen und
Showcase** — drei Disziplinen, die ihre Mechanik bereits bestehen (rho 0,834 / 0,845 / 0,892) und
live gespielt werden, denen man das aber nicht ansieht; drei Präsentationsrunden ohne rho-Risiko,
deren Zielbild in der produktiven React-Bühne schon gezeichnet ist, heben den Projektdurchschnitt
von 78 % auf **81 %**.

---

## 9. Grenzen dieses Plans

1. **Nur rho ist gemessen.** Die vier Achsenzahlen sind laut Abschnitt 0 der Scorecard ausdrücklich
   „kein Messwert, sondern eine begründete Einstufung". Die Gewinn-Rechnungen in Abschnitt 2.1
   setzen voraus, dass die Rubrik bei diesen drei Disziplinen genauso angewendet wird wie zuletzt
   bei Fechten und Time-Trial. Sie sind deshalb **konservativ** gerechnet (ohne die optionalen
   Stücke, ohne M3-Neubewertung).
2. **Die Assets-Ausgangswerte sind nicht sauber additiv.** Alle drei stehen bei Assets 40, was sich
   nicht restlos aus A1 30 erklärt — irgendwo steckt ein 10-Punkte-Teilkredit, den die Scorecard
   nicht aufschlüsselt. Die Rechnungen oben unterstellen, dass er **erhalten bleibt**; sollte die
   Scorecard ihn beim Nachzug anders verbuchen, verschieben sich die Assets-Zielwerte um bis zu
   10 Punkte und die Gesamtwerte um bis zu 2,5.
3. **Der M3-Befund bei Tennis (5.1) ist eine Frage, keine Feststellung.** Er stützt sich auf einen
   Vergleich von Kopfkommentaren und Dateiumfängen, nicht auf die Zählmethode, mit der die
   Scorecard „Animationsstellen" ermittelt. Vor einer Tennis-Runde gehört er verifiziert.
4. **Keine Sicht-QA.** Es wurde für diesen Plan kein Spieltag im Browser durchgeklickt. Dass
   Climbing im Motor wie eine graue Bahn aussieht, ist aus `boden:"#5d5a54"`/`baeume:false` und dem
   Weichen-Code geschlossen, nicht am Bild überprüft. Der Playwright-Beleg im Abnahmeteil (6.4,
   Punkt 4) ist genau dagegen da.
5. **Kein Blick auf Chris' In-Game-Meldungen.** Dieser Plan ist eine Fertigstellungsgrad-Review,
   kein Bug-Triage. Vor der nächsten Runde gehört `git fetch origin bug-reports` trotzdem gelesen
   (CLAUDE.md, „Vor jeder Runde einmal lesen") — was dort steht, kann die Reihenfolge dieses Plans
   jederzeit schlagen.
6. **Football kann diesen Plan überholen.** Wenn die Kaderfamilie-Erweiterung (Abschnitt 4) ergibt,
   dass #944 reproduzierbar über 0,80 liegt, ist Footballs Produktivschaltung mit +13 Gameplay-
   Punkten und einem einzigen Tabelleneintrag billiger als jeder Auftrag hier. Dieser Plan setzt
   nur voraus, dass diese Messung **heute nicht vorliegt**.
