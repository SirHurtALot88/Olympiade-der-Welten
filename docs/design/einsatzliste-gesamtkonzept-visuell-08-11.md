# Einsatzliste: visuelles Gesamtkonzept (Fable, 08.11.)

Reine Konzeptarbeit, kein Code. Dieses Dokument ist die zweite Runde zu
`docs/design/aufstellung-screen-rework-08-11.md` (im Folgenden „Rework-Konzept"): dort steht die
**Struktur** (drei Ebenen Formation / Rollenkarte / Feinjustierung, das ±-Schema, die Feldform je
Chassis), hier steht das **Bild** — wie das Ganze aussieht, sich anfühlt und sich bewegt, und wie
sich die Einsatzliste (`app/foundation/legacy-lineup-lab/LineupNewLook.tsx`) und die Battle Arena
(`public/mockups/battle-mode.engine.js`) dabei als zwei Maßstäbe desselben Bildes zeigen.

Chris' Auftrag wörtlich: „Ich hätte das gerne als Gesamtkonzept von dir umgearbeitet, dass es auch
optisch sehr ansprechend aussieht." Seine fünf Antworten aus Rework-Konzept Abschnitt 13 sind
hier eingearbeitet, nicht wiederholt; wo eine davon eine Gestaltungsfolge hat, steht sie am Anfang
des jeweiligen Abschnitts.

Verbindlich bleibt alles, was auch im Rework-Konzept verbindlich war: die Eignungsmatrix ist
gesperrt (alles hier ist **Anzeige**), der Screen behauptet nur, was der Motor nachweislich liest
(`docs/design/verhalten-drei-stufen-board-text-03-11.md`, „Verhalten-Befund"), und der Vertrag
zwischen Einsatzliste und Arena (`ArenaAufstellungEintrag {d, slot}` in
`lib/foundation/battle-arena/arena-aufstellung-adapter.ts`) bleibt unangetastet. Die technische
Frage, ob `LineupNewLook.tsx` die Formationsgeometrie schon hat oder sie erst aus dem Motor
gezogen werden muss, klärt parallel die Opus-Architektur-Recherche; dieses Dokument nimmt an, dass
die Geometrie **beschaffbar** ist, und sagt in Abschnitt 8, welche Tabelle sie braucht.

Ein Satz vorweg, der alles Weitere ordnet: **Die Einsatzliste ist die Arena im Kleinen.** Nicht ein
Diagramm der Arena, nicht ein Formular, aus dem die Arena später etwas macht — dasselbe Bild in
klein, mit denselben Farben, auf demselben Boden, nur ohne Bewegung und mit Zahlen statt Treffern.
Wer in der Einsatzliste Ragnarok auf den Vanguard-Platz zieht, sieht ihn dort auf Lava stehen, mit
einem weinroten Ring, und wenn der Kampf beginnt, steht genau diese Figur mit genau diesem Ring an
genau dieser Stelle, nur größer.

## 0. Die fünf Antworten und ihre Gestaltungsfolge

| Chris' Antwort (08.11.) | Was daraus im Bild wird | Abschnitt |
|---|---|---|
| Slotfarben nach Position 1–6, „aber passend zu der jeweiligen Disziplin" | Sechs feste Farbtöne, je Kulissen-Variante durch eine von fünf **Stimmungen** gefiltert (Sättigung, Wärme, Helligkeit). Der Farbton ist überall derselbe, der Charakter nicht. | 4 |
| Goldrahmen nach dem **Slot-Wert** | Gold heißt **Bestbesetzung**: dieser Spieler hat in diesem Slot den höchsten Wert des ganzen Kaders. Gold wandert sichtbar mit, wenn man umstellt. | 5 |
| Gegner auf dem Feld **und** Counter-Einschätzung | Geister-Marken auf der Gegnerhälfte, **Duell-Fäden** zu den eigenen Marken, eine **Erwartungs-Waage** über dem Feld und ein **Live-Delta**, das schon beim Darüberhalten rechnet. | 6 |
| Rollenkarte rechts oder darunter — „hängt davon ab, wie es aussieht" | Entschieden: **rechts**, mit einem Faden von der gewählten Marke zur Karte. Begründung aus dem Bild. | 7 |
| Einsatzliste und Arena „sprechen miteinander" | Eine Geometrietabelle, eine Kulissenquelle, dieselben Ringe und Kürzel auf den Arena-Figuren, ein **Aufmarsch-Übergang** beim Wechsel. | 8 |

## 1. Leitbild: „Rahmen statt Material" auf die Einsatzliste übertragen

Das Kulissen-Audit (`docs/design/kulissen-qualitaets-audit-08-11.md`, Abschnitt 4) hat für die
Arena den Grundsatz formuliert: Die Kulisse liefert nicht den Belag *unter* der Motor-Geometrie,
sondern den **Ort um sie herum** in drei Tiefenebenen — fern (Himmel, Horizont, Hallendach),
mitte (Tribüne, Geräte, Bauten), vorn (Spielfläche). Genau derselbe Fehler, den das Audit bei
Spurt und Climbing beschreibt („alte Komposition, neue Textur"), würde dem Mini-Feld passieren,
wenn man die heutige Dreier-Grid-Tafel (`#pitch`, `grid-template-columns:1fr 1fr 1fr`) einfach mit
einem Lava-Bild hinterlegt: ein graues Raster mit Hintergrundbild.

Das Mini-Feld ist deshalb eine **Vignette**, keine Tafel. Drei Regeln machen den Unterschied:

1. **Die Szene ist dieselbe wie in der Arena.** Quelle ist die PixelLab-Szene der aktiven
   Kulissen-Variante (`public/szenen/<disziplin>/<variante>.jpg`), als vorgerenderte Miniatur
   (Arbeitsname `vignette-<disziplin>-<variante>.webp`, 640 × 400 px, zwei Helligkeitsfassungen
   für hell/dunkel, ≤ 60 KB). Nicht die Arena-Leinwand live rendern — das wäre Spielerei und teuer
   — sondern ein Standbild, das die Arena-Pipeline (`scripts/screenshot-kulisse.mjs`) ohnehin
   erzeugen kann. Bei den sieben Disziplinen, die laut Audit noch keine Komposition haben (Takeshi,
   Climbing, Spurt, Eiskunstlauf, Showcase, Breaking, Fechten), wird die Miniatur **aus der
   Rohszene** gebaut, nicht aus dem heutigen Motor-Bild; die Einsatzliste zeigt also schon das
   Ziel-Bild, bevor die Arena dort angekommen ist, und beide treffen sich, sobald der
   Kulissen-Rework greift.
2. **Drei Ebenen auch in 640 × 400.** Oben ein Horizontband (Himmel, Hallendach, Nachtskyline),
   darunter das Kulissenband (Tribüne, Zelte, Pfeiler), unten die Spielfläche — und auf ihr, und
   nur auf ihr, die Geometrie des Motors. Die Proportionen stehen in Abschnitt 2.1.
3. **Lesbarkeitsschicht statt Abdunklung.** Das Audit hat bei Breaking und Showcase gezeigt, was
   flächiges Abdunkeln anrichtet (Abschnitt 4.6 dort). Das Mini-Feld dunkelt die Szene deshalb
   **nicht** pauschal ab. Stattdessen wird die Miniatur in der Spielflächenzone auf ein
   Helligkeitsband komprimiert (dunkles Theme: Luminanz 0,18–0,48; helles Theme: 0,52–0,84), die
   Horizont- und Kulissenbänder bleiben voll. Jede Marke trägt zusätzlich einen 1-px-Halo in
   `--surface`-Farbe außerhalb ihres farbigen Rings (Abschnitt 2.2), damit sie auf jeder Szene
   steht, egal wie hell sie ist.

Was das Mini-Feld **nicht** ist: keine zweite Arena-Leinwand (keine Figurenanimation, kein
Kampf), kein HUD (keine Prozentkacheln, keine Dropdowns — das ist Ebene C des Rework-Konzepts),
und keine Landkarte, auf der man frei platziert. Es zeigt die Plätze, die der Motor kennt
(`FELD_JE_DISC`, Rework-Konzept 3.1), und nur die.

**Typografie.** Es gibt genau eine Schrift, RaniraSeason in 700 kursiv (Chris 30.09.: „nutz nur
den Font, den ich für alles vorgegeben hatte"; `app/globals.css` Z. 49–55, `battle-mode.css`
Z. 10). Das Mini-Feld braucht deshalb keine zweite Schrift für Zahlen, sondern die bestehende
Tabellenziffern-Klasse (`nl-tnum`, LineupNewLook Z. 2100) überall dort, wo Werte nebeneinander
stehen. Kürzel (VA, HL, BR …) in Versalien, 11 px, mit 0,04 em Laufweite, damit das Kursive nicht
klebt.

## 2. Anatomie des Mini-Felds

### 2.1 Fläche und Zonen

```
┌───────────────────────────────────────────────────┐  Seitenverhältnis 8:5 (640 × 400 Referenz)
│  HORIZONT                                 22 %    │  Himmel / Hallendach / Skyline. Trägt die
│                                                   │  Tageszeit der Variante. Keine UI hier.
├───────────────────────────────────────────────────┤
│  KULISSENBAND                             16 %    │  Tribüne, Pfeiler, Zelte, Geräte als
│                                                   │  Silhouetten. Hier sitzt die Erwartungs-Waage
├───────────────────────────────────────────────────┤  (Abschnitt 6.3) als schmale Leiste.
│  SPIELFLÄCHE                              62 %    │  Motor-Geometrie: Reihen, Bahn, Court,
│   eigene Hälfte      ┊      Gegnerhälfte          │  Reihenfolge-Leiste. Marken, Geister, Fäden.
│                      ┊                            │  Helligkeit komprimiert (Abschnitt 1, Regel 3).
└───────────────────────────────────────────────────┘
  Vignettierung: 12 % Rand, Richtung aus der Lichtquelle der Stimmung (Abschnitt 3)
```

Bei den **Bühnen-Disziplinen** (Reihenfolge-Leiste statt Feld) kippt die Spielfläche zu einer
breiten, flachen Zone (8:3), Horizont und Kulissenband bleiben; die Leiste sitzt dort, wo in der
Szene die Bühne, die Plattform, die Planche oder der Tisch steht. Bei **Climbing** ist das Feld
hochkant (5:8) mit dem Boden unten und dem Top-out oben — genau die Höhenachse, die dem
Arena-Bild laut Audit heute fehlt.

### 2.2 Die Marke

```
        ╭────────────────╮        Außen: 1 px Halo in --surface (hell) / --ground (dunkel)
       ╭┤ VA  Vanguard   ├╮       Ring: 2 px Positionsfarbe (Abschnitt 4), bei slotFokus 3 px
       ││ ┌────┐         ││       Kürzel-Chip: Positionsfarbe als Fläche, Text in Tinte/Weiß
       ││ │fig.│ Ragnarok ││       Figur: figurKlein 28 px, derselbe Sprite wie in der Arena
       ││ └────┘  78 ++  ◆││       Wert (abs) + Passungsglyphe (Rework 6.2); ◆ = Gold (Abschnitt 5)
       ╰┤        ↑       ├╯       Befehlspfeil nur Arena-Chassis (Rework 3.2)
        ╰────────────────╯
        Fläche: --surface mit 86 % Deckung — die Szene scheint leicht durch,
        die Marke bleibt eine Karte, kein Loch im Bild.
```

Breite 104 px auf dem Desktop-Feld, 84 px im kompakten Modus (Kader aufgeklappt auf Mobil). Die
Marke wirft einen weichen Schatten in Richtung weg von der Lichtquelle der Stimmung (Abschnitt 3):
in einer Lava-Arena nach oben-links, in einer Halle mit Deckenlicht gerade nach unten. Das ist der
eine Handgriff, der eine Karte auf einem Bild von einer Karte *in* einer Szene unterscheidet.

**Leere Marke:** gestrichelter Ring in Positionsfarbe, Fläche 55 % Deckung, Kürzel-Chip voll, in
der Mitte der 1. Vorschlag aus `bestenFuer()` (Rework 3.2) mit 60 % Deckung — ein Geist der
eigenen Seite, der auf Klick fest wird.

**Gegner-Geist:** dieselbe Form, aber Ring gestrichelt in der **abgeschwächten Positionsfarbe des
vermuteten Slots** (Chroma × 0,5), kein Halo, kein Schatten (Geister stehen nicht auf dem Boden),
ein kleiner Punkt in `--away` oben rechts als Teamkennung, Name und Spanne („71–81") statt
Wert. Unschärfe: ein zweiter, weiterer Ring mit 20 % Deckung, dessen Radius mit sinkender
Späh-Gewissheit wächst (Abschnitt 6.1).

### 2.3 Fäden, Waage, Kopfzeile

Zwischen eigener Marke und dem Geist, den der Motor ihr zuordnet, läuft ein **Duell-Faden**: eine
1,5-px-Linie, leicht gebogen (quadratische Kurve mit 12 % Durchhang, damit sie wie ein Faden und
nicht wie ein Diagrammpfeil wirkt), in `--ok` / `--faint` / `--crit` je nach Vorteil, mit einer
kleinen Wert-Pille in der Mitte beim Hover („78 vs 71–81"). Breite und Deckung folgen der
Gewissheit (Abschnitt 6.2).

Über der Spielfläche, im Kulissenband, liegt die **Erwartungs-Waage** (Abschnitt 6.3): eine
schmale Leiste, links `--home`-Bernstein, rechts `--away`-Cyan, mit einem Zeiger und einem
Unschärfeband. Sie ist das einzige UI-Element außerhalb der Spielfläche.

Die **Kopfzeile** über dem ganzen Feld bleibt wie im Rework-Konzept 3.4: Disziplin-Tabs
(`dchip`), rechts der Intensitäts-Segment-Chip. Neu: der aktive Tab trägt links einen 10-px-
Ausschnitt der Vignette als Miniatur-Fliese, sodass die Tab-Zeile selbst schon erzählt, in welche
Welt man wechselt.

## 3. Fünf Stimmungen, sieben Beispielszenen

Eine Stimmung („Preset") ist ein Satz aus Lichtquelle, Himmelston, Bodenbehandlung,
Vignettenrichtung und — wichtig für Abschnitt 4 — einem Filter auf die Positionsfarben. Die
Stimmung hängt an der **Kulissen-Variante**, nicht an der Disziplin: TDM Lava ist GLUT, TDM Frost
ist FROST. So wird die Forderung „passend zu der jeweiligen Disziplin" sogar feiner erfüllt, als
sie gestellt war, ohne dass irgendwo eine zweite Farbtabelle entsteht.

| Stimmung | Licht | Himmel / Horizont | Boden-Behandlung | Vignette | Varianten (Beispiele) |
|---|---|---|---|---|---|
| **GLUT** | von unten/aus den Fugen, warm, punktuell | dunkel, rußig, Glutschein am Horizont | Platten mit warmem Streulicht in den Fugen | nach außen rot-schwarz | TDM Lava, Breaking brutal, Mini-DM Sägewerk |
| **FROST** | diffus, kühl, von oben | hell, blass, Bergkette oder Tannen | Eis mit schwacher Spiegelung, Kufenspuren | nach außen blau-weiß | Eiskunstlauf Waldsee/Kür, TDM Frost, Hockey Bergsee, Climbing Eis |
| **HALLE** | Scheinwerferkegel von oben, hart | Hallendach mit Trägern und Lichtbändern | Belag matt, Kegel als helle Inseln | nach außen neutral-dunkel | Spurt HYROX, Basketball Parkett, Fechten Piste, Gewichtheben Sandsack |
| **NACHT** | warme Lichtpunkte in kühler Dunkelheit | Nachthimmel, Skyline, Mond, Lichterketten | dunkler Boden mit Lichtpfützen | nach außen tiefblau | Gewichtheben Hafen, Wettessen Nachtmarkt, Speed-Schach Zug, Showcase Bühne, Fechten Schlosshof |
| **FREILUFT** | Nachmittagssonne, lange weiche Schatten | Himmel mit Wolken, Bäume, Berge | Wiese, Sand, Tartan mit Sonnenflecken | nach außen warm-grün | Takeshi, Battlefield, Staffel Arena, Spurt Kurs, Football Strand, Speed-Schach Park |

Sieben Szenen im Einzelnen — jeweils so beschrieben, dass ein Gestalter sie malen und ein
Entwickler sie bauen kann. Hex-Werte sind Zielwerte für die Miniatur-Nachbearbeitung, nicht für
UI-Tokens (die stehen in Abschnitt 4).

### 3.1 TDM Lava — Arena 6v6 (GLUT)

Das Bild, das laut Audit eines der besten im Spiel ist, in klein: Basaltplatten in `#2A2024` bis
`#3B2C2E`, in den Fugen Glut `#FF6A2B` → `#FFB347` als dünne, unregelmäßige Linien, die zur
Feldmitte dichter werden. Horizont: rußiger Himmel `#1A1216` mit einem Glutsaum `#7A2E1C` direkt
über der Kulissenkante. Kulissenband: schwarze Felszinnen als Silhouette, zwei Fackelpunkte links
und rechts. Die Spielfläche zeigt **drei Reihen je Hälfte** als kaum sichtbare, breitere Fugen
(Backrow / Mitte / Front, aus `SLOT_ZUSATZ.reihe`, x ≙ `MID∓140/300/460`), die eigene Hälfte
links, die Gegnerhälfte rechts, dazwischen eine Lavaader als Mittellinie. Die Marken werfen
Schatten nach oben, weil das Licht von unten kommt — das ist der Moment, in dem die Karten
aufhören, auf einem Bild zu liegen, und anfangen, in der Arena zu stehen. Positionsfarben im
GLUT-Filter: wärmer, gesättigter, dunkler (Tabelle 4.3).

### 3.2 Spurt HYROX — Bahn-Reihe (HALLE)

Die Halle aus `public/szenen/spurt/hyrox.jpg`, die laut Audit zu 0 % im Motor ankommt: Horizont
= Hallendach mit Stahlträgern `#2B2F36` und vier Lichtbändern `#F2EFE6`; Kulissenband = Tribüne
in Schrägsicht mit Anzeigetafel, davor die Gerätezeile (Schlitten, Rudergeräte) als dunkle
Silhouetten. Spielfläche: **ein** Streckenband von links nach rechts (nicht zwölf Bahnen — Bahnen
sind kein Slot-Merkmal, Rework 3.1), Belag `#3F4C66` mit dem gelb-schwarzen IN-Bogen ganz links und
dem roten FINISH-Bogen ganz rechts. Auf dem Band liegen drei Scheinwerferkegel, und **die Kegel
sind die Plätze**: „Von vorn" (Block Start, Acceleration, Drive Phase) im ersten Kegel, „Windschatten"
(Lane Control) im zweiten, „Schlusssprint" (Top Speed, Photo Finish) im dritten — die Zuordnung
aus `planJeSlot` (Z. 44869). Mehrere Slots im selben Kegel stehen gestaffelt untereinander, die
Gegnerläufer als Geister in derselben Kegelordnung eine Spur tiefer. Statt Duell-Fäden gibt es hier
eine **Rennlinie**: ein dünner Verlauf vom IN- zum FINISH-Bogen, auf dem ein Zeiger die erwartete
Position der eigenen Spitze gegen die gegnerische markiert (Abschnitt 6.2, Bahn).

### 3.3 Fechten Schlosshof — Bühnen-Reihenfolge (NACHT)

Burgmauer mit zwei Türmen vor einem tiefblauen Abendhimmel `#14213D` → `#2B3F6B`, Fackeln in den
Mauerhaltern, unten die Planche als helles Band `#D9D3C4` auf dunklem Pflaster — und zwar genau
dort, wo der Motor sie rechnet; darunter, wo laut Audit heute 45 % Leere sind, die Hofmauer mit
Tor als Vordergrund-Silhouette, die zugleich den Rahmen des Feldes schließt. Die Spielfläche ist
eine **Reihenfolge-Leiste**: sechs Plätze nebeneinander auf der Planche, nummeriert 1–6 in
Positionsfarbe, darunter die sechs Gegner als Geister, Platz n direkt unter Platz n, verbunden mit
kurzen, senkrechten Duell-Fäden — weil der Motor hier n gegen n paart (Rework 3.1, Bühne). Die
Kopfzeile der Leiste sagt es: „Hier zählt die Reihenfolge, kein Platz." Fackellicht als zwei weiche
warme Kegel auf Platz 1 und Platz 6, dazwischen kühler — die Leiste hat damit eine Mitte und zwei
Enden, keine Gleichförmigkeit.

### 3.4 Breaking — der Folter-Ring (GLUT)

Breaking ist Folter, nicht Breakdance (CLAUDE.md). Die Rohszene — Fackeln, Steinpfeiler,
Publikum, runde Holzbühne, Lichtkegel von oben — wird hier so gezeigt, wie das Audit sie für die
Arena fordert (Abschnitt 4.6 dort): ohne den violetten Schleier. Horizont: schwarzes Gewölbe,
Kulissenband: Pfeiler mit Fackeln `#FF8C42`, Publikum als dunkle Schemen. Spielfläche: die runde
Holzbühne `#5A3A24` in einem Lichtkegel `#F0D9A8`, umgeben von Dunkel. Die Reihenfolge-Leiste
folgt hier **der Gauntlet-Kette** (BB().gauntlet, Z. 37887): Platz 1 steht **im Ring**, groß; die
Plätze 2–6 stehen als Kette am Ringrand, kleiner werdend nach hinten, die Gegnerkette spiegelbildlich
auf der anderen Seite. Der einzige Duell-Faden läuft von Platz 1 zu Gegner-Platz 1 quer durch den
Ring; die Fäden 2–6 sind angedeutet und werden erst voll, wenn man den Mauszeiger auf einen Platz
hält („wenn deiner durchkommt, trifft er als Nächstes auf …"). Positionsfarben im GLUT-Filter,
aber mit einem Unterschied zu TDM Lava: das Licht kommt von oben (Kegel), die Schatten fallen also
nach unten — dieselbe Stimmung, andere Lichtquelle, und die Marken verraten es.

### 3.5 Eiskunstlauf Waldsee — Bühnen-Reihenfolge (FROST)

Die flachste Szene des Spiels laut Audit bekommt hier ihr Drittel Landschaft zurück: Horizont =
Abendhimmel `#DCE6F2` → `#F3D9C8` über einer Bergkette, Kulissenband = Tannenreihe `#1F3A2E` mit
Laternen `#FFE2A8` und Schneewehen. Spielfläche: die Eisfläche `#CFE0EC` mit schwacher Spiegelung
der Tannen (8 % Deckung, vertikal gespiegelt) und feinen Kufenspuren. Die Startreihenfolge-Leiste
liegt als sanfter Bogen auf dem Eis, nicht als gerade Zeile — der Bogen ist der `eisRundweg`, den
der Motor fährt, in Miniatur. Kein Gegner-Geist auf dem Eis (Eiskunstlauf paart nicht n gegen n;
Rework 3.3: „sonst entfällt er"), stattdessen zeigt die Waage über dem Feld die Erwartung gegen
den Gegner als Ganzes. Positionsfarben im FROST-Filter: entsättigt, kühler, heller — Weinrot wird
zu einem Rosé, Umbra zu einem Graubraun. Das ist der Fall, an dem Chris' Satz „andere Sättigung
bei Breaking vs. Eiskunstlauf" am deutlichsten zu sehen ist: beide zeigen auf Position 1 denselben
Farbton, aber Breaking in Glut, Eiskunstlauf in Reif.

### 3.6 Basketball Parkett — Halbfeld (HALLE)

Parkett `#C9A06B` mit dunkleren Dielen, Paint in `#8A3A2E`, Dreierlinie weiß, oben die Tribüne
als Kulissenband mit zwei Scheinwerferkegeln auf den Korb. Plätze aus `BASKETBALL_ROLLE_SLOT`
(Z. 10855): Rim Pressure im Paint, Floor General oben am Kreis, Fast Break und Help Defense auf
den Flügeln, Perimeter und Clutch Shot in den Ecken. Gegner-Geister stehen **auf denselben Plätzen
der gespiegelten Hälfte**, aber die Vignette zeigt nur die eigene Hälfte — die Geister rücken
deshalb als Verteidiger-Schatten einen halben Schritt vor jede eigene Marke, auf der Verbindungs-
linie zum Korb. Das ist bildlich richtig (so verteidigt man) und mechanisch ehrlich (der Motor
kennt für Basketball keine Paarung, nur die Formationsplätze; Rework 3.1). Besonderheit: solange
weniger als sechs gesetzt sind, sind alle Marken gestrichelt und die Kopfzeile sagt „Formation
greift ab 6 Spielern" — `zuordneSlots` nimmt die Rollenplätze nur dann.

### 3.7 Tauziehen, die Grube — Formatidee (NACHT)

Noch keine produktive Disziplin, aber Chris' eigenes Beispiel für „hintereinander", und die
Machbarkeitsanalyse (`docs/design/format-varianten-machbarkeit-08-11.md`, Branch) hat die Form
bereits entschieden: zwölf Zieher rund um die Grube, je zwei Gegner auf gegenüberliegenden
Speichen, sechs Seile kreuzen sich über dem Schacht, mechanisch sechs Eins-gegen-eins-Taue in
Schweizer Runden. Das Mini-Feld dazu: Draufsicht auf die Hafenkante bei Nacht (Kräne, Mond,
Laternen aus der Gewichtheben-Hafenszene), in der Mitte der runde Schacht `#0B0F14` mit nassem
Rand `#3A4652`. Die sechs eigenen Plätze liegen auf einem Halbkreis links, die sechs Gegner-Geister
auf dem Halbkreis rechts, und **die Duell-Fäden sind hier wörtlich die Seile**: Platz n gegen
Gegner n, über den Schacht. Damit ist die Formatidee ohne eine Zeile Sonderlogik im Konzept
untergebracht — Reihenfolge-Leiste, nur rund gebogen, mit n-gegen-n-Fäden. Genau deshalb muss
`FELD_JE_DISC` eine **Kurvenform** (Polyline oder Bogen) als Platzanordnung zulassen, nicht nur
Zeile und Raster (Rework 0b, „erweiterbar für künftige Format-Varianten").

## 4. Positionsfarben: sechs Farbtöne, fünf Filter

### 4.1 Die Regel

**Der Farbton (Hue) hängt an der Position 1–6 und ist in allen zwanzig Disziplinen derselbe. Die
Stimmung der Kulissen-Variante verschiebt Sättigung, Helligkeit und Wärme — nie den Farbton um
mehr als ±6°.** Position 1 ist in TDM der Vanguard, im Spurt der Block Start, in Breaking der
Bruchpunkt, in Fechten der Duelist — immer der Platz, den `slotsVon(d)` als ersten liefert
(Rework 5). Der Spieler lernt in einem Abend: „Weinrot ist immer der Erste."

Technisch heißt das: die Farben sind **OKLCH-Tokens**, bei denen die Disziplin nur den Filter
setzt —

```
:root { --pos1-h: 8;  --pos2-h: 305; --pos3-h: 272; --pos4-h: 192; --pos5-h: 128; --pos6-h: 62; }
.stimmung-glut  { --pos-l: 0.42; --pos-cm: 1.15; --pos-hs:  6; }   /* hell */
.stimmung-frost { --pos-l: 0.50; --pos-cm: 0.72; --pos-hs: -6; }
.stimmung-halle { --pos-l: 0.46; --pos-cm: 1.00; --pos-hs:  0; }
.stimmung-nacht { --pos-l: 0.44; --pos-cm: 1.20; --pos-hs:  0; }
.stimmung-freiluft { --pos-l: 0.44; --pos-cm: 0.85; --pos-hs: 3; }
--pos1: oklch(var(--pos-l) calc(0.14 * var(--pos-cm)) calc(var(--pos1-h) + var(--pos-hs)));
```

— im dunklen Theme dieselben Zeilen mit `--pos-l` 0,72–0,80. Ein Satz Hues, fünf Filter, zwei
Themes: zwölf Zahlen, keine Farbtabelle mit 120 Einträgen. Der Chroma-Grundwert ist je Position
verschieden (Weinrot/Violett 0,14, Indigo 0,13, Moos 0,11, Petrol 0,09, Umbra 0,07), weil Umbra
sonst zu `--home`-Orange und Petrol zu `--away`-Cyan kippt.

### 4.2 Die sechs Farbtöne

| Pos. | Name | OKLCH-Hue | Warum dieser und kein anderer |
|---:|---|---:|---|
| 1 | Weinrot | 8 | Der Erste, der Schwerste. Deutlich dunkler und blauer als `--crit` (Hue ≈ 28), nie als Fläche. |
| 2 | Violett | 305 | Kein reservierter Ton in der Nähe. |
| 3 | Indigo | 272 | Weiter ins Violette als `--fortschritt` (≈ 255), dunkler. |
| 4 | Petrol | 192 | Zwischen `--ok` (≈ 160) und `--away` (≈ 205). Der engste Fall, s. 4.4. |
| 5 | Moos | 128 | Oliv, nicht Smaragd — `--ok` liegt bei 160. |
| 6 | Umbra | 62 | Braun durch niedriges Chroma; `--home`-Orange (≈ 65) hat das doppelte Chroma. |

### 4.3 Fünf Disziplinen, zwei Themes — gerechnete Werte

Rechnung mit OKLCH → sRGB und WCAG-Kontrast (Skript in der Sitzung, Werte gerundet). „Rand" ist
der Kontrast des 2-px-Rings gegen `--surface` (hell `#FFFFFF`, dunkel `#141C28`); „Chip" der
Kontrast des Kürzel-Textes auf dem gefüllten Chip (hell: weißer Text, dunkel: Tinte `#111823`).

| Pos. | Breaking brutal · GLUT | Eiskunstlauf Waldsee · FROST | Spurt HYROX · HALLE | Gewichtheben Hafen / Tauziehen · NACHT | Takeshi Burg · FREILUFT |
|---:|---|---|---|---|---|
| | hell / dunkel | hell / dunkel | hell / dunkel | hell / dunkel | hell / dunkel |
| 1 | `#900B31` / `#FD7D8D` | `#91485F` / `#F5A2B9` | `#942C49` / `#FB89A0` | `#970E41` / `#FF92A7` | `#873042` / `#E48492` |
| 2 | `#69288C` / `#CB8BF5` | `#6B5594` / `#C6B0F6` | `#6B3E95` / `#C699F8` | `#692F9B` / `#CCA0FE` | `#653D84` / `#B990DE` |
| 3 | `#3E3D9C` / `#97A1FE` | `#4A6199` / `#A1BDFB` | `#4050A0` / `#96ACFE` | `#3746A7` / `#9EB3FF` | `#424B8F` / `#909FEA` |
| 4 | `#09585B` / `#4ABFC2` | `#316F69` / `#8DCCC4` | `#0F6563` / `#65C3C0` | `#095F5D` / `#53CDC9` | `#0C5F5F` / `#67B4B3` |
| 5 | `#305A06` / `#89BC67` | `#5C6A35` / `#B5C68D` | `#466312` / `#9DBF71` | `#405D05` / `#9FC768` | `#405D21` / `#90B172` |
| 6 | `#6A4414` / `#CDA273` | `#7A5C47` / `#D8B69F` | `#744F2D` / `#D2A883` | `#73471B` / `#DFAC7F` | `#694C2E` / `#BF9D7E` |

TDM Lava und TDM Frost nehmen die GLUT- bzw. FROST-Spalte — dieselbe Disziplin, zwei Charaktere.

Kontrast-Check, schlechtester Wert je Stimmung über alle sechs Positionen:

| Stimmung | Rand hell | Rand dunkel | Chip hell | Chip dunkel | Urteil |
|---|---:|---:|---:|---:|---|
| GLUT | 8,1 | 6,9 | 8,1 | 7,2 | weit über 3:1 (Rand) und 4,5:1 (Text) |
| FROST | 5,8 | 8,8 | 5,8 | 9,1 | die hellen FROST-Ringe sind die blassesten, halten aber |
| HALLE | 6,9 | 7,5 | 6,9 | 7,8 | — |
| NACHT | 7,5 | 8,1 | 7,5 | 8,4 | — |
| FREILUFT | 7,5 | 6,5 | 7,5 | 6,8 | — |

Gegen `--surface-2` / `--ground` liegen die Werte je um 1,0 niedriger bzw. höher, kein Wert fällt
unter 5,0. Die Palette ist damit für Ränder und Chips in beiden Themes **ohne Ausnahme** tauglich.
Vor dem Bau einmal mit der `dataviz`-Palettenprüfung gegenrechnen, das Skript ist bewusst
Wegwerf-Code.

### 4.4 Der eine enge Fall und zwei Regeln dazu

Petrol (Position 4) liegt im hellen Theme beim Kontrastverhältnis 1,19 zu `--away` `#15707F` und
im dunklen Theme ist `#65C3C0` einem `#45B0C9` sichtbar ähnlich. Zwei Regeln fangen das:

1. **Auf dem Mini-Feld erscheint `--away`-Cyan nie als Ring**, nur als kleiner Teampunkt am Geist
   und als rechte Hälfte der Waage. Der Ring des Geistes ist die abgeschwächte Positionsfarbe
   seines vermuteten Slots. Damit konkurriert Petrol nie direkt mit Cyan um dieselbe Form.
2. **Das Kürzel steht immer neben der Farbe** (Rework 5, letzter Satz) — für Farbfehlsichtige
   ohnehin Pflicht, und für Petrol/Cyan die zweite Absicherung.

Moos gegen `--ok`-Grün ist der zweite Nachbar (Hue 128 gegen 160), aber `--ok` erscheint auf dem
Feld nur als Faden- und Glyphenfarbe, nie als Ring; die Formen trennen, was die Töne nicht ganz
trennen.

### 4.5 Wo die Farbe überall steht

Dieselbe Liste wie Rework 5, um die Arena ergänzt:

- Ring und Kürzel-Chip der Marke; Balken links im Rollenkarten-Kopf; Kürzel in der Kader-Liste
  (`egposis`); Geister-Ringe abgeschwächt.
- **Neu: das Namensschild der Figur in der Arena.** Die Arena zeichnet über jeder Figur Name und
  Werte; das Schild bekommt links einen 6-px-Punkt in Positionsfarbe und das Kürzel. Wer in der
  Einsatzliste Weinrot gesetzt hat, findet Weinrot auf dem Platz wieder. Das ist der sichtbarste
  Teil der Kopplung (Abschnitt 8.3) und kostet die Arena nichts außer `place[p.n].slot`, das sie
  ohnehin liest.
- Die Tab-Fliese in der Kopfzeile trägt **keine** Positionsfarbe — sie zeigt die Stimmung.

## 5. Goldener Rahmen nach dem Slot-Wert

Chris: „den Rahmen machen wir nach dem Slotwert." Die Lesart, die diesem Satz und der Regel
„N = Slotzahl" (Rework 7) zugleich gerecht wird:

**Gold heißt Bestbesetzung.** Eine Marke trägt den Goldrahmen, wenn der dort stehende Spieler in
**diesem** Slot den höchsten `abs`-Wert aller Kaderspieler hat — er ist `bestenFuer(slot)[0]`.
Damit gibt es höchstens so viele Goldrahmen wie Slots, bei perfekter Aufstellung genau N, und jeder
Goldrahmen sagt etwas Prüfbares: „Niemand im Kader wäre hier besser."

Drei Erscheinungsformen, ein Token `--gold` (`#D4AF37` hell / `#E8C65A` dunkel, Rework 7, bewusst
nicht `--warn`):

| Zustand | Darstellung | Bedeutung |
|---|---|---|
| Spieler ist Kader-Bester in seinem Slot | Goldrahmen 2 px **außerhalb** des Positionsrings, mit feinem Glanzpunkt oben links (ein 3-px-Highlight, kein Verlauf), Raute ◆ neben dem Wert | Bestbesetzung |
| Spieler steht in Top 3 für seinen Slot, aber nicht erster | kein Gold; Glyphe und Wert wie gehabt | gut, aber nicht bestmöglich |
| Der Kader-Beste für diesen Slot steht **woanders** oder auf der Bank | Goldrahmen **gestrichelt** an der Marke, Tooltip „Buttercup wäre hier 81 — steht auf Hold Line" | Gold verschenkt |
| Kader-Liste | Goldrahmen um den `abs`-Wert hinter dem Kürzel in **jedem** Slot, in dem dieser Spieler Kader-Bester ist (`VA 78◆ · BR 78 · SK 72`) | wo gehört er hin |

**Gold wandert.** Stellt man um, wechselt der Goldrahmen in 400 ms sichtbar von einer Marke zur
anderen (Rahmen blendet aus, neuer blendet ein, dazwischen ein kurzer Goldschimmer über den
Duell-Faden, der beide verbindet). Das ist kein Schmuck: Es zeigt, dass eine Verbesserung an
einer Stelle woanders Gold gekostet haben kann, und das ist exakt der Konflikt, den Aufstellen
ausmacht.

Was Gold **nicht** mehr heißt: „gehört in diese Disziplin" nach roher Eignung. Diese Aussage ist
nicht verloren, sie steht als Zahl in der Kader-Liste (`69`) und in der Rollenkarte; nur der Rahmen
hängt jetzt am Slot, so wie Chris es entschieden hat. Sollte Chris mit „Slotwert" stattdessen
meinen „die N höchsten Slot-Werte auf dem Feld, egal ob Kader-Bester", ist das eine Zeile in
derselben Funktion — die Darstellung bleibt identisch.

## 6. Gegner auf dem Feld und die Counter-Einschätzung

Chris' Zusatz zur Geister-Frage: Die Darstellung soll „eine Einschätzung erlauben, was dabei
rauskommt, damit man so ein bisschen countern kann." Das ist mehr als „wo steht der Gegner" — es
ist „was passiert, wenn ich *das hier* ändere". Der Vorschlag besteht aus vier Teilen, die
aufeinander aufbauen; der vierte ist der eigentliche Mechanismus.

### 6.1 Geister: wo und wie unscharf

Quelle ist in allen Chassis die bestehende Späh-Logik des Boards: `spaehStufe()` mit den Stufen
25/50/75 (Z. 37808, dieselben Schwellen wie `getScoutingIntelMilestone` im Spiel), `BANDBREITE
[16,10,5,2]` für die Wertspanne (Z. 37811), und `absicht()` (Z. 37821), die aus den gespähten
Werten die wahrscheinlichste Rolle schließt — „zu diesen beiden Rollen passt er am besten".

| Späh-Stufe | Geist steht … | Ring | Unschärfe-Ring | Text am Geist |
|---|---|---|---|---|
| 0 (< 25) | als **eine** graue Gruppe in der Mitte der Gegnerhälfte, ohne Einzelplätze | keiner, nur Silhouetten | — | „Zu wenig gespäht" |
| 1 (25–49) | zwischen den zwei wahrscheinlichsten Plätzen (Mittelpunkt der beiden Reihen) | gestrichelt, Farbe des ersten Kandidaten, Chroma × 0,5 | Radius = Abstand zum zweiten Platz | Name · „71–87" |
| 2 (50–74) | auf dem wahrscheinlichsten Platz | gestrichelt, Farbe des Slots | Radius 16 px | Name · Rolle „(wahrsch.)" · „76–81" |
| 3 (≥ 75) | auf dem Platz, mit vermutetem Befehlspfeil (Arena) | gestrichelt, Farbe des Slots, Chroma × 0,7 | keiner | Name · Rolle · „78,4" |

Der Späh-Gewissheit-Regler des Mockups bleibt (im Spiel kommt die Zahl aus `scoutIntelByTeamId`),
wandert aber als kleines Zahnrad-Chip in die Kopfzeile. Die heutige Gegnerliste (`#opp`) wird zum
Tooltip jedes Geistes — Rework 3.3.

### 6.2 Duell-Fäden: wer trifft auf wen

Ein Faden darf nur dort gezogen werden, wo der Motor tatsächlich paart oder begegnet. Je Chassis:

| Chassis | Faden von eigener Marke zu … | Quelle | Was der Faden zeigt |
|---|---|---|---|
| Arena (TDM, Mini-DM, Battlefield-Duell) | dem Geist, den der KI-Plan ihr zuordnet (`PLAN.zuteilung`, `schlachtplan()`), ab Späh-Stufe 2; darunter kein Faden, nur die Waage | Z. 37844, 37959 | Vorteil = eigener `abs` gegen gespähte Spanne des Gegners im zugewiesenen Slot; `--ok` wenn die eigene Zahl über dem oberen Spannenrand liegt, `--crit` unter dem unteren, sonst `--faint` |
| Bühne mit n-gegen-n (Gewichtheben, Tennis, Fechten, Speed-Schach, Breaking-Gauntlet) | Gegner-Platz n | `HEBEN_ROLLEN`, Gauntlet Z. 37887, Rework 3.1 | wie oben; bei Breaking nur Platz 1 voll, Kette gedämpft (3.4) |
| Bühne ohne Paarung (Showcase, Eiskunstlauf, Wettessen, I-Spy) | — | — | keine Fäden; nur die Waage |
| Bahn (Spurt, Staffel, Time-Trial, Takeshi, Climbing) | — | `planJeSlot` | keine Fäden, stattdessen die **Rennlinie** (3.2): Zeiger für die erwartete eigene Spitze und die gegnerische auf dem Band, aus den `abs`-Summen je Plan-Gruppe |
| Feldspiel Basketball | dem Verteidiger-Schatten vor der Marke | `BASKETBALL_ROLLE_SLOT` | nur als Schatten, kein Vorteilsfaden — der Motor paart hier nicht |
| Feldspiel Hockey, Football | — | — | keine Geister außer Torwart/QB/Kicker (die einzigen mechanisch gelesenen Plätze, Rework 3.1); nur die Waage |

Fadenstärke 1,5 px bei Späh-Stufe 3, 1 px und 60 % Deckung bei Stufe 2. Beim Hover auf Marke oder
Geist leuchtet der zugehörige Faden auf und zeigt die Wert-Pille („78 vs 71–81").

### 6.3 Die Erwartungs-Waage

Eine 6-px-Leiste im Kulissenband, links Bernstein (`--home`), rechts Cyan (`--away`), in der Mitte
ein Zeiger. Zeigerstellung = Verhältnis der eigenen Summe der `abs`-Werte aller gesetzten Spieler
zur gespähten Summe des Gegners; um den Zeiger ein **Unschärfeband**, dessen Breite aus
`BANDBREITE[spaehStufe]` × Spielerzahl folgt. Bei Späh-Stufe 0 ist das Band so breit wie die
Leiste — die Waage sagt dann ehrlich nichts. Darunter ein Wort, kein Satz: „leichter Vorteil",
„offen", „klarer Nachteil" (Schwellen ±4 / ±10 Summenpunkte, bewusst grob).

In der Foundation-Einsatzliste speist sich die eigene Seite aus `totalProjected`
(`calculateMatchdayProjectedPreview`, `matchday-slot-roles.ts`) statt aus `abs`; die Gegnerseite
aus dem Späh-Stand des Spielstands. Die Waage behauptet **nie** ein Ergebnis — Tooltip wörtlich:
„Erwartung aus Kaderwerten und Späh-Stand. Kein Ergebnis. Form, Würfel und der Plan der KI kommen
erst im Kampf dazu."

### 6.4 Das Live-Delta: Darüberhalten rechnet, Loslassen setzt

Das ist der Mechanismus, der „countern" möglich macht, ohne einen Sandkasten-Modus, eine
„Simulieren"-Taste oder ein weiteres Panel einzuführen — Chris' Punkt 1 („immer noch sehr viele
Einstellungen") verbietet genau das.

**Regel: Hover ist Probe, Klick oder Drop ist Entscheidung.**

1. Der Nutzer greift einen Kader-Spieler (Drag) oder wählt ihn (Klick, `sel`) und hält den Zeiger
   über eine Marke. Ab 120 ms Verweildauer:
   - die Marke zeigt den **Vorschauwert** („→ 81 ++") in 70 % Deckung über dem heutigen Wert,
   - der Duell-Faden dieser Marke färbt sich **probeweise** um (ok/faint/crit) und pulsiert
     einmal,
   - die Waage bekommt einen **zweiten, hohlen Zeiger** an der neuen Stellung, verbunden mit dem
     festen Zeiger durch eine dünne Linie — und darüber die Zahl: „+2,4" in `--ok` oder „−1,1" in
     `--crit`,
   - ist der Griff ein **Tausch** (Marke besetzt), zeigt auch die Marke, von der der Getauschte
     kommt, ihren Vorschauwert und ihren Faden — man sieht, was es *dort* kostet.
2. Der Nutzer lässt los oder klickt: alles Probeweise wird fest, in 400 ms; der hohle Zeiger wird
   der feste; ein **Delta-Chip** bleibt 4 Sekunden an der Waage stehen: „Ragnarok → Vanguard
   +2,4 · Front hält jetzt gegen ihren Breaker". Danach blendet er aus; die Information ist in
   Fäden und Waage weiterhin da.
3. Der Nutzer zieht den Zeiger weg, ohne zu setzen: alles springt in 150 ms zurück. Nichts wurde
   geändert, nichts gespeichert.

Die Delta-Zahl ist **die Differenz der Waagenstellung**, also der eigenen `abs`-Summe (Foundation:
`totalProjected`-Summe) vor und nach der Probe — eine Zahl, die jeder nachrechnen kann, keine
Simulation. Der Satz im Delta-Chip kommt aus dem **größten Fadenwechsel**: welcher Faden hat die
Farbe gewechselt, und gegen welchen Geist. Hat keiner gewechselt, steht nur die Zahl.

**Die Gegenseite reagiert sichtbar.** In der Arena rechnet `schlachtplan()` den Plan der KI aus
genau der Vorschau, die der Spieler sieht (Tooltip Z. 37951: „Änderst du deine Aufstellung, ändert
sich der Plan"). Nach dem Setzen laufen die Geister deshalb auf ihre neuen Plan-Plätze — in
500 ms, mit einem kurzen Nachziehen der Fäden. Das ist der eigentliche Counter-Moment: Man stellt
um, der Gegner stellt sich um, und man sieht, ob die eigene Änderung den Angriffspunkt verschoben
hat. Bei Späh-Stufe < 2 bleibt die Reaktion verborgen (der Plan ist nicht „durchschaut",
Z. 37944) — die Geister bewegen sich nicht, nur die Waage ändert sich. Auch das ist ehrlich:
Spähen kauft Sicht auf den Counter.

### 6.5 Grenzen, die das Bild einhält

- Kein Faden, keine Reaktion, kein Delta behauptet etwas, das der Verhalten-Befund nicht als
  „wirkt" ausweist. In Hockey/Football gibt es nur die Waage; in den vier Bühnen ohne Paarung nur
  die Waage; auf der Bahn die Rennlinie statt Fäden.
- Das Delta ist eine Summe von Anzeigewerten, keine Vorhersage. Wort und Tooltip sagen das.
- Die Unschärfe ist immer sichtbar (Band, Ringe, Spannen). Es gibt keine Stufe, auf der die Waage
  eine glatte Zahl ohne Band zeigt — selbst bei Stufe 3 bleibt das Band 2 Punkte breit.
- Nichts davon fasst `build()`, `spiele()` oder `place` anders an als heute. Die Probe lebt
  ausschließlich in einem Vorschauzustand der Ansicht.

## 7. Die Rollenkarte steht rechts

Chris hat die Entscheidung an das fertige Bild geknüpft. Mit dem Bild aus Abschnitt 2–6 vor Augen
fällt sie klar: **rechts neben dem Feld auf Desktop, als Sheet unter dem Feld erst unter
1100 px Breite.** Vier Gründe, alle aus dem Bild selbst:

1. **Die Leserichtung ist die Handlung.** Kader links („wen"), Feld in der Mitte („wohin"),
   Rollenkarte rechts („warum"). Das ist die Reihenfolge, in der man aufstellt, und das Auge geht
   ohnehin von links nach rechts. Eine Karte unter dem Feld bricht die Zeile und zwingt zum
   Scrollen, sobald sie ihre volle Höhe hat (Attributtafel, Beitrags-Zerlegung, drei Alternativen,
   Rolle-Zeile, Persönlichkeit: rund 420 px, Rework 4).
2. **Die Vignette ist breit, die Karte ist hoch.** Ein 8:5-Feld neben einer schmalen, hohen Karte
   füllt einen Desktop-Schirm ohne Leerraum; ein 8:5-Feld über einer breiten, flachen Karte lässt
   die Karte entweder zerfließen (Attribute in sechs Spalten) oder zu einem zweiten Feld werden.
3. **Der Faden funktioniert nur seitlich.** Die gewählte Marke (`slotFokus`, 3-px-Ring) ist mit
   dem Kopf der Rollenkarte durch einen 1-px-Faden in Positionsfarbe verbunden, der am rechten
   Feldrand austritt und in den farbigen Balken der Karte mündet (Rework 4: der Balken ersetzt den
   `--home`-Balken der `.unit`). Dieser Faden ist das Element, das Marke und Erklärung zu *einem*
   Ding macht statt zu zwei Panels. Unter dem Feld müsste er quer durch die Gegnerhälfte laufen.
4. **Der Platz ist frei.** In der Foundation-Einsatzliste existiert die rechte Spalte schon
   (`nl-lineup-layout`, `minmax(300px, 360px)`, `globals.css` Z. 60783–60788). Im Arena-Board ist
   die rechte Spalte heute die Gegnerliste — und die zieht aufs Feld (Abschnitt 6.1).

Der Sonderfall **Bühnen-Disziplinen**: Die Reihenfolge-Leiste ist flach, das Feld also niedriger
als die Karte. Die Karte bekommt deshalb eine Maximalhöhe = Höhe des Feldes plus Kopfzeile plus
Waage und scrollt innen (nur Alternativen und Persönlichkeit fallen unter die Falz). Bei Climbing
(hochkant) ist es umgekehrt bequem.

Mobil (< 1100 px): Kopfzeile, Feld, darunter die Kader-Liste einklappbar, und beim Tippen auf eine
Marke schiebt sich die Rollenkarte als Sheet von unten über die Kader-Liste, mit dem Positions-
balken oben als Griff. Der Faden entfällt; stattdessen übernimmt der Sheet-Griff die Positionsfarbe
der getippten Marke — dieselbe Information, andere Form.

## 8. Einsatzliste und Arena: ein Bild, zwei Maßstäbe

Chris: „Die Einsatzliste und die Battle Arena sollen ja miteinander sprechen … da setzt du ja die
Leute ein, die dann später auf dem Feld stehen." Der Datenvertrag dafür steht
(`buildArenaAufstellung` → `place[name] = {d, slot}`, der Motor liest `slotFuer(p,i)`). Was fehlt,
ist, dass man es **sieht**. Fünf Maßnahmen, aufsteigend nach Aufwand:

### 8.1 Eine Geometrietabelle für beide

`FELD_JE_DISC` (Rework 3.1) wird **nicht** als UI-Tabelle in `LineupNewLook.tsx` geschrieben,
sondern als gemeinsame Tabelle, die aus den Motor-Daten abgeleitet ist und von beiden Seiten
gelesen wird: Platz (x, y in Feldkoordinaten 0–1), Reihe/Phase/Platzname, Markenform (voll /
hohl für nicht-mechanische Plätze, gestrichelt bis Vollbesetzung) und Anordnungsform (Raster,
Zeile, Bogen, Polyline — Abschnitt 3.7). Die Arena-Startpositionen (`homeFor()`, Z. 38186,
`MID∓140/300/460`) und die Basketball-Plätze (`BASKETBALL_ROLLE_SLOT`) sind heute schon im Motor;
die Tabelle normiert sie nur. Ob das eine neue Datei in `lib/` oder ein Export aus dem Motor ist,
entscheidet die Opus-Recherche — für das Bild ist nur wichtig: **eine Quelle, kein Nachbau.**

### 8.2 Eine Kulissenquelle

Die Vignette (Abschnitt 1) ist eine Miniatur derselben Szene, die die Arena zeichnet, in
derselben Variante (die Variante steht im Spielstand bzw. wird für die Begegnung gelost — Audit
Abschnitt 4.3 „wie Zeitfahren je Begegnung wechselt"). Zeigt die Einsatzliste Lava, kämpft man auf
Lava. Zeigt sie den Hafen bei Nacht, hebt man im Hafen bei Nacht.

### 8.3 Dieselben Ringe auf den Figuren

Abschnitt 4.5: Das Namensschild jeder Figur in der Arena trägt Punkt und Kürzel in Positionsfarbe.
Dazu die Passungsglyphe (`++ / + / · / − / −−`) in Klammern hinter dem Wert im Boxscore-Tooltip —
dieselbe Tabelle (Rework 6.2), derselbe Ort wie in der Einsatzliste. Wer in der Einsatzliste
gelernt hat, dass Weinrot der Erste ist, findet den Ersten in der Arena ohne Lesen.

### 8.4 Der Aufmarsch-Übergang

Beim Wechsel von der Einsatzliste in die Arena (Spieltag starten, „Zum Kampf") passiert heute ein
Schnitt. Vorgeschlagen ist ein **Aufmarsch** von etwa 900 ms:

1. Das Mini-Feld wächst aus seiner Position auf die Größe der Arena-Leinwand (Shared-Element-
   Übergang, Ease-out, 400 ms); Kader-Liste und Rollenkarte blenden aus.
2. Während es wächst, werden die Marken zu Figuren: Ring und Chip bleiben als Namensschild, die
   Figur (`figurKlein`) tauscht gegen den Arena-Sprite derselben Figur, der Wert blendet aus, der
   Name bleibt. Die Figur steht danach exakt auf dem `homeFor()`-Platz, den auch die Marke hatte,
   weil beide dieselbe Tabelle lesen (8.1).
3. **Späh-Auflösung:** Die Geister werden zu echten Gegnerfiguren. Standen sie auf dem richtigen
   Platz, wird der gestrichelte Ring fest. Standen sie falsch (die KI hat anders aufgestellt), laufen
   die echten Figuren in 300 ms von der Geister-Position auf ihren wahren Platz — man sieht, worin
   man sich geirrt hat, bevor der erste Treffer fällt. Bei Späh-Stufe 0 tauchen die Gegner aus der
   grauen Gruppe auf.
4. Die Waage wandert nach oben und wird zum Score-Bug der Arena (der Score-Bug existiert, Broadcast-
   Optik-Nachaudit 28.09.); ihr letztes Unschärfeband bleibt zwei Sekunden als dünner Strich unter
   dem Score sichtbar und verschwindet — die Erwartung tritt ab, das Ergebnis tritt an.

Der Übergang ist rein Darstellung (`build()`/`spiele()` sind längst fertig gerechnet, wenn er
läuft) und bei `prefers-reduced-motion` ein weicher Schnitt mit 150 ms Überblendung.

### 8.5 Der Rückkanal (später)

Nach dem Kampf kennt die Arena je Figur den Boxscore. Die Einsatzliste des **nächsten** Spieltags
könnte auf jeder Marke eine Hairline „zuletzt: 78 → 3 Picks, Rang 2 im Team" zeigen. Das ist kein
Teil dieses Reworks (es braucht einen Rückweg, den der Adapter heute nicht hat), aber die Marke
hat unten rechts bewusst einen leeren 12-px-Bereich dafür reserviert, damit es später kein Umbau
wird.

### 8.6 Der Spiegel-Test

Die Kopplung ist nur dann „sichtbar korrekt", wenn sie geprüft wird. Vorgeschlagen: für jede
Disziplin eine automatische Doppelaufnahme — Mini-Feld mit gesetzter Aufstellung (DOM-Screenshot)
und Arena-Startbild derselben Aufstellung (`scripts/screenshot-kulisse.mjs` mit `place`) — und ein
Vergleich der normierten Figurpositionen und der Ringfarben je Name. Abweichung > 4 % der
Feldbreite oder eine falsche Farbe ist ein Fehler. Dazu, wie bei jedem Paket, die Identitäts-
prüfung `spiele(d, saat)` byte-gleich vor und nach (Rework 12).

## 9. Drei Beispiel-Layouts

Alle drei auf Desktop ≥ 1180 px, drei Spalten wie heute `.lay` bzw. `nl-lineup-layout`. `g` =
Goldrahmen, `◌` = Geist, `╌` = gestrichelt, `~` = Duell-Faden, Buchstaben in `[ ]` = Kürzel-Chip in
Positionsfarbe (P1 Weinrot … P6 Umbra).

### 9.1 TDM Lava — Arena 6v6 (GLUT)

```
┌ KADER ──────────────────┬ TDM · 6v6   [Mini-DM] [Battlefield] …        Intensität ○ Normal  ⚙ Späh 62 % ┬ ROLLE ───────────────────┐
│ ▸ Spieltag: TDM · Spurt │ ░░░░░░░░░░░░░ rußiger Himmel, Glutsaum ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ▌VANGUARD        Front   │
│                         │ ▲▲ Felszinnen 🔥  ━━━━━━━━━━━━●━━━━╌╌╌╌━━━━━━━━━━━━━━━━  🔥 Felszinnen ▲▲     │ ▌Öffnet Teamfights mit   │
│ [F] Ragnarok    69 ◆    │                  leichter Vorteil  +4 · Band ±6                                │ ▌Power und Health.       │
│     Vanguard  VA78◆·BR78│ ┌ Backrow ┐ ┌ Mitte ┐ ┌ Front ┐  ┊  Front    Mitte   Backrow                 │ ▌                        │
│ [F] Buttercup   57      │ ╭[RP]────╮ ╭[SK]────╮ ╭[VA]════╮ ┊                                            │ ATTRIBUTE IN DIESER ROLLE│
│     Hold Line HL58·VA61 │ │ ·  1.  │ │ ·  1.  │ │ ▣ Ragn.│~~~~~~~◌ Warlord     ◌ Scav.                  │ Power ++   Health ++     │
│ [F] Molten Boar 44      │ │ Grumpp │ │ Genta  │ │ 78 ++ ◆│ ┊  „VA (wahrsch.)"  „BR oder SK"             │ Stamina −  Spirit −      │
│     —         BR49·VA44 │ ╰╌╌╌╌╌╌╌╌╯ ╰╌╌╌╌╌╌╌╌╯ ╰════════╯ ┊    71–81            60–70                   │ Charisma − Determ. ·     │
│ [F] Grumpp      41      │ ╭[SC]────╮ ╭[BR]────╮ ╭[HL]────╮ ┊                                            │                          │
│     —         RP44·SC43 │ │ ·  1.  │ │ ▣ Butt.│ │ ·  1.  │~~~~~~~~~~~~~~~◌ Hargorin                     │ BESETZT  Ragnarok 78 ++ ◆│
│ …                       │ │ Grumpp │ │ 58  +  │ │ Molten │ ┊   ◌ Zeek          „HL (wahrsch.)" 74–84    │ +6,1 Power  +1,9 Health  │
│                         │ ╰╌╌╌╌╌╌╌╌╯ ╰────────╯ ╰╌╌╌╌╌╌╌╌╯ ┊  „RP oder SC"                              │ −0,4 Stamina −0,3 Spirit │
│                         │  Lavaader ════════════════════════╪════════════════════════════════════════   │ = +11,2 → gedeckelt +8,5 │
│                         │ ░░░░░ Basalt, Glut in den Fugen, Schatten der Marken nach oben ░░░░░░░░░░░░░ │                          │
│                         │ 2 von 6 aufgestellt · Formation aus drei Reihen · [ Vorschlag übernehmen ]    │ ALTERNATIVEN             │
│                         │                                                                               │ 1. Ragnarok 78 ++ ◆      │
│                         │                                                                               │ 2. Buttercup 61 +        │
│                         │                                                                               │ 3. Molten Boar 49 ·      │
│                         │                                                                               │ ROLLE Reihe 1, mit der   │
│                         │                                                                               │ Linie. Hält die vordere …│
│                         │                                                                               │ PERSÖNLICHKEIT Bollwerk  │
│                         │                                                                               │ [ Feinjustierung ▾ ]     │
└─────────────────────────┴───────────────────────────────────────────────────────────────────────────────┴──────────────────────────┘
   Faden von der VA-Marke (3-px-Ring, slotFokus) tritt am rechten Feldrand aus und mündet in den ▌-Balken der Rollenkarte.
```

Was man hier auf einen Blick liest, ohne eine Zahl zu lesen: Zwei von sechs stehen; Ragnarok vorn
ist Gold und sein Faden zum Warlord ist grün; Buttercup in der Mitte ist nur „+" und ihr Faden zu
Hargorin grau; die Waage steht leicht links. Hält man Molten Boar über die leere HL-Marke, zeigt
die Marke „→ 49 ·", der Faden zu Zeek wird rot, der hohle Zeiger rutscht nach rechts: „−1,8". Man
lässt es und probiert Grumpp — so geht countern.

### 9.2 Spurt HYROX — Bahn-Reihe (HALLE), darunter die Tauziehen-Grube

```
┌ KADER ──────────────┬ SPURT · 6   [Time-Trial] [Staffel] …          Intensität ○ Normal  ⚙ Späh 48 % ┬ ROLLE ─────────────────┐
│ [F] Genta     71 ◆  │ ▒▒▒ Hallendach, Träger, vier Lichtbänder ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │ ▌BLOCK START   Von vorn │
│     Block S. BS74◆  │ ▓ Tribüne · ANZEIGETAFEL ▓  ━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━  ▓ Schlitten Ruder ▓│ ▌Explodiert aus dem     │
│ [F] Zeek      66    │                             offen · Band ±10 (grobe Bereiche)                     │ ▌Start über Speed und   │
│     Top Speed TS70  │ ╔IN╗                                                                      ╔FINISH╗│ ▌Determination.         │
│ [F] Ragnarok  58    │ ║▓▓║  ╲ Kegel „Von vorn" ╱   ╲ Kegel „Windschatten" ╱  ╲ Kegel „Schlusssprint" ╱║▓▓║  │                         │
│     Drive Ph. DP61  │ ║▓▓║ ╭[BS]════╮╭[AC]╌╌╌╮╭[DP]────╮ ╭[LC]╌╌╌╌╮          ╭[TS]────╮╭[PF]╌╌╌╌╮  ║▓▓║  │ ATTRIBUTE               │
│ …                   │ ║▓▓║ │▣ Genta ││· 1.   ││▣ Ragn. │ │ · 1.   │          │▣ Zeek  ││ · 1.   │  ║▓▓║  │ Speed ++  Determ. +     │
│                     │ ║▓▓║ │ 74 ++ ◆││ Molten││ 61  +  │ │ Grumpp │          │ 70 ++  ││ Butter.│  ║▓▓║  │ Stamina − Dexterity ·   │
│                     │ ║▓▓║ ╰════════╯╰╌╌╌╌╌╌╌╯╰────────╯ ╰╌╌╌╌╌╌╌╌╯          ╰────────╯╰╌╌╌╌╌╌╌╌╯  ║▓▓║  │                         │
│                     │ ║▓▓║  ◌ ◌ ◌ Gegner „Von vorn"      ◌ „Windschatten"     ◌ ◌ „Schlusssprint"  ║▓▓║  │ BESETZT Genta 74 ++ ◆   │
│                     │ ╚══╝ ──────────────────────────────────────────────────────────────────────╚══════╝│ +5,2 Speed +1,4 Determ. │
│                     │      Rennlinie:  eigene Spitze ▲ ········ ▽ gegnerische Spitze (Band)              │ −0,6 Stamina = +6,0     │
│                     │ ░░░ Bande mit Sponsoren, zwei Betreuer ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ALTERNATIVEN …          │
│                     │ 3 von 6 aufgestellt · Hier zählt der Rennplan des Slots, keine Bahn                │ ROLLE Von vorn: zieht   │
│                     │                                                                                   │ ab dem Start …          │
│                     │                                                                                   │ PERSÖNLICHKEIT Sprinter │
└─────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴─────────────────────────┘
```

Keine Duell-Fäden: Die Bahn paart nicht. Die **Rennlinie** unter dem Band zeigt die erwartete
eigene Spitze gegen die gegnerische als zwei Zeiger mit Band; beim Hover über eine leere Marke
rutscht der eigene Zeiger probeweise. Dass die Plätze Scheinwerferkegel sind und nicht Kästchen,
ist der ganze Unterschied zwischen Halle und Tabelle.

Dieselbe Bahn-Logik, in die Grube gebogen (Tauziehen-Formatidee, 3.7):

```
│ ▒▒▒ Nachthimmel, Kräne, Mond ▒▒▒  ━━━━━━━━━━━━●━━━━━━━━━━━━━━━  ▒▒▒ Laternen, Kaimauer ▒▒▒ │
│            ╭[P1]╮                                          ╭◌ 1╮                        │
│       ╭[P2]╮     ╲                SCHACHT                  ╱     ╭◌ 2╮                   │
│   ╭[P3]╮          ╲~~~~~~~~~~~~~ ╭───────────╮ ~~~~~~~~~~~╱          ╭◌ 3╮              │
│   ╰────╯ ~~~~~~~~~~~~~~~~~~~~~~~ │  ▓▓▓▓▓▓▓  │ ~~~~~~~~~~~~~~~~~~~~~~~ ╰────╯             │
│   ╭[P4]╮ ~~~~~~~~~~~~~~~~~~~~~~~ │  ▓▓▓▓▓▓▓  │ ~~~~~~~~~~~~~~~~~~~~~~~ ╭◌ 4╮              │
│   ╰────╯          ╱~~~~~~~~~~~~~ ╰───────────╯ ~~~~~~~~~~~╲          ╰────╯              │
│       ╰[P5]╯     ╱                                          ╲     ╰◌ 5╯                   │
│            ╰[P6]╯                                          ╰◌ 6╯                        │
│   Sechs Seile, sechs Duelle: Platz n gegen Gegner n. Die Fäden SIND die Seile.             │
```

### 9.3 Fechten Schlosshof — Bühnen-Reihenfolge (NACHT)

```
┌ KADER ──────────────┬ FECHTEN · 6   [Tennis] [Speed-Schach] …       Intensität ○ Normal  ⚙ Späh 80 % ┬ ROLLE ─────────────────┐
│ [F] Hargorin  73 ◆  │ ▒▒▒▒ Abendhimmel, zwei Türme, Fackeln in den Mauerhaltern ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │ ▌AGGRESSOR     Platz 2 │
│     Aggressor AG77◆ │ ▓▓ Burgmauer ▓▓   ━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ▓▓ Burgmauer ▓▓│ ▌Bringt Druck über     │
│ [F] Genta     64    │                     klarer Vorteil  +12 · Band ±2 (genau)                         │ ▌Torment und Power.    │
│     Duelist   DU68  │  🔥                                                                          🔥   │                        │
│ [F] Buttercup 55    │  ═╤═══════╤═══════╤═══════╤═══════╤═══════╤═══ Planche ═══════════════════════   │ ATTRIBUTE              │
│     Defender  DE57  │ ╭[DU]────╮╭[AG]════╮╭[DE]────╮╭[TE]╌╌╌╌╮╭[CT]╌╌╌╌╮╭[FT]╌╌╌╌╮                     │ Torment ++  Power ++   │
│ …                   │ │▣ Genta ││▣ Harg. ││▣ Butt. ││ · 1.   ││ · 1.   ││ · 1.   │                     │ Awareness − Dexter. ·  │
│                     │ │ 68  +  ││ 77 ++ ◆││ 57  ·  ││ Molten ││ Zeek   ││ Grumpp │                     │                        │
│                     │ ╰────────╯╰════════╯╰────────╯╰╌╌╌╌╌╌╌╌╯╰╌╌╌╌╌╌╌╌╯╰╌╌╌╌╌╌╌╌╯                     │ BESETZT Hargorin 77 ++ ◆│
│                     │     ~         ~         ~         ~         ~         ~    (senkrechte Fäden)    │ +7,0 Torment +2,8 Power│
│                     │   ◌ Warl.   ◌ Scav.   ◌ Zeek    ◌ Mord.   ◌ Kett.   ◌ Orm                        │ −0,9 Awareness = +8,9  │
│                     │    71,2      80,4      63,0      58,8      66,1      70,5                        │ → gedeckelt +8,5       │
│                     │  Hier zählt die Reihenfolge, kein Platz. Duell Platz n gegen Platz n.             │ ALTERNATIVEN …         │
│                     │ ░░░ Hofmauer mit Tor als Vordergrund-Silhouette ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ROLLE Platz 2 im Duell │
│                     │ 3 von 6 aufgestellt                                                              │ gegen Platz 2 der      │
│                     │                                                                                  │ Gegner. Kein Ort.      │
└─────────────────────┴──────────────────────────────────────────────────────────────────────────────────┴────────────────────────┘
```

Hier ist das Countern am greifbarsten: Hargorin (77) steht auf Platz 2 gegen Scavenger (80,4) —
Faden rot. Hält man Hargorin über Platz 1 (gegen Warlord 71,2), wird der Faden grün, der Faden
von Platz 1 zeigt Genta probeweise auf Platz 2 gegen Scavenger (rot), und die Waage sagt „+0,4":
ein Tausch, der ein Duell gewinnt und eins verliert. Bei Späh-Stufe 3 stehen die Gegnerwerte als
Zahl; bei Stufe 1 stünde dort „60–76" und der Faden wäre grau — man sähe, dass man zu wenig weiß.

### 9.4 Mobil (< 1100 px), alle Chassis

```
┌───────────────────────────────┐
│ TDM · 6v6  [Mini-DM] [Battlef.]│  Tabs scrollen horizontal, aktive Fliese mit Vignette
│ ○ Normal                ⚙ 62 % │
├───────────────────────────────┤
│ ░ Horizont ░  ━━━━●━━━╌╌━━━  ░ │  Waage im Kulissenband
│ ╭RP╮ ╭SK╮ ╭VA╮ ┊ ◌    ◌       │  Feld 8:5 in voller Breite, Marken 84 px
│ ╰╌╌╯ ╰╌╌╯ ╰══╯~┊~◌            │
│ ╭SC╮ ╭BR╮ ╭HL╮ ┊    ◌   ◌     │
│ ╰╌╌╯ ╰──╯ ╰╌╌╯ ┊              │
├───────────────────────────────┤
│ ▾ KADER (10)                   │  einklappbar; Tippen auf Spieler = sel,
│ [F] Ragnarok 69◆  VA78◆·BR78   │  dann Tippen auf Marke = setzen
│ [F] Buttercup 57  HL58·VA61    │
├═══════════════════════════════┤
│ ▌ VANGUARD · Ragnarok 78 ++ ◆  │  Sheet, Griff in Positionsfarbe, von unten
│   Power ++ Health ++ Stamina − │
│   …                            │
└───────────────────────────────┘
```

## 10. Zustände, Bewegung, Mikro-Interaktionen

| Ereignis | Was sich bewegt | Dauer | Warum |
|---|---|---|---|
| Disziplin-Tab wechseln | Vignette überblendet (Cross-Fade), Marken fahren von ihren alten auf die neuen Plätze, Stimmung wechselt (Positionsfarben gleiten über OKLCH) | 350 ms | Man sieht, dass die **Positionen** bleiben und nur der Ort wechselt — die Kernaussage der Positionsfarben |
| Spieler wählen (`sel`) | alle Marken färben ihren Ring nach Passung (Rework 3.2), nicht die Fläche; unpassende Marken dimmen auf 70 % | 150 ms | heutiges `pass-*`-Verhalten, nur klein |
| Hover über Marke mit gewähltem Spieler | Vorschauwert, Faden-Probe, hohler Waagenzeiger, Delta-Zahl (6.4) | ab 120 ms Verweildauer | Probe ohne Entscheidung |
| Setzen / Drop | Marke „setzt auf": Fläche von 55 % auf 86 %, Figur erscheint mit 4-px-Hüpfer, Faden zieht nach, Gold wandert, Geister laufen auf Plan-Plätze, Delta-Chip 4 s | 400 ms (+500 ms Geister) | das ist der Moment der Entscheidung, er darf etwas wiegen |
| Tausch per Drag auf besetzte Marke | beide Figuren kreuzen auf einer Kurve, beide Vorschauwerte | 400 ms | sichtbar, dass es ein Tausch war, kein Ersatz |
| Marke klicken (`slotFokus`) | Ring 3 px, Faden zur Rollenkarte wächst von der Marke zur Karte, Karte blendet Inhalt | 250 ms | Marke und Erklärung werden eins |
| Späh-Regler ändern | Unschärfe-Ringe schrumpfen/wachsen, Spannen-Text ändert sich, Fäden erscheinen ab Stufe 2 | 300 ms | Spähen kauft Sicht — sichtbar gemacht |
| „Vorschlag übernehmen" | Marken füllen sich nacheinander in `slotsVon`-Reihenfolge, 80 ms versetzt | 6 × 80 ms + 400 ms | Reihum sichtbar, dann einzeln änderbar |
| Basketball unter 6 gesetzt | alle Marken gestrichelt, Kopfzeile „Formation greift ab 6" | — | `zuordneSlots`-Ehrlichkeit |
| `prefers-reduced-motion` | alle Bewegungen → 150-ms-Überblendung, keine Wege | — | Pflicht |

Keine Bewegung, die nichts bedeutet: kein Pulsieren im Ruhezustand, kein Glut-Flackern in der
Vignette (Standbild), keine Figurenanimation auf dem Mini-Feld. Die Arena bewegt sich; die
Einsatzliste steht still und antwortet nur auf die Hand.

## 11. Was sich an den Paketen des Rework-Konzepts ändert

Die sechs Pakete aus Rework 12 bleiben in Reihenfolge und Zuschnitt. Dieses Dokument legt je Paket
die Bild-Anteile dazu und ein Paket davor:

| Paket | Bild-Anteil aus diesem Dokument | Abnahme (zusätzlich zu `spiele()`-Identität) |
|---|---|---|
| **0 Vignetten-Pipeline** (neu, vor 1) | Miniaturen 640 × 400 aus `public/szenen` je Variante, zwei Helligkeitsfassungen, Luminanzkompression der Spielflächenzone, ≤ 60 KB (Abschnitt 1, 2.1) | Sichtprobe aller 20 × Varianten; Dateigröße; die sieben Audit-Disziplinen aus der Rohszene |
| 1 Farben, Gold, Zahlen | OKLCH-Tokens mit fünf Stimmungsklassen (4.1), `--gold`, Gold = Bestbesetzung (5), Kader-Kürzel in Positionsfarbe | Kontrastprobe (4.3) als Skript, Gold-Zählung ≤ N je Disziplin |
| 2 ±-Schema, Rollenkarte | Rollenkarte rechts mit Positionsbalken (7); Faden Marke → Karte | Summen-Invariante der Beitrags-Zerlegung (Rework 6.3) |
| 3 Mini-Feld Arena + Ebenen | Vignette, Marken mit Halo und Schatten nach Lichtquelle, Zonen 22/16/62, Kopfzeile mit Tab-Fliese | Marken auf `homeFor()`-Plätzen ±4 %; `board-check.mjs`: null `select` außerhalb der Arena |
| 4 Feldformen der übrigen Chassis | Kegel-Bahn (3.2), Reihenfolge-Leiste mit Planche/Ring/Eisbogen (3.3–3.5), Halbfeld (3.6), Bogen-/Polyline-Form in `FELD_JE_DISC` für die Grube (3.7) | jede der 20 hat eine Vignette **und** eine Feldform; Climbing hochkant |
| 5 Gegnerhälfte | Geister mit Unschärfe (6.1), Fäden je Chassis (6.2), Waage (6.3), Live-Delta und Plan-Reaktion (6.4) | Delta = Differenz der Summen, geprüft; keine Fäden in Hockey/Football/Bahn/vier Bühnen; Band nie 0 |
| **5b Aufmarsch** (neu, nach 5) | Shared-Element-Übergang, Späh-Auflösung, Waage → Score-Bug (8.4); Namensschild-Ring in der Arena (8.3) | Spiegel-Test (8.6) grün für alle 20 |
| 6 (Engine) Stufe 3 buchen | unverändert, außerhalb | rho/Pp nach CLAUDE.md |

Pakete 0–2 sind auch für die Foundation-Einsatzliste sofort nutzbar (Tokens, Gold, Rollenkarte in
der bestehenden rechten Spalte), bevor das Mini-Feld dort steht — sie heben `LineupNewLook.tsx`
von „nur das Rollenlabel" (Z. 2077) auf dieselbe Sprache wie das Board, ohne auf die Geometrie-
Recherche zu warten.

## 12. Bewusst offen gelassen

- **Gold-Lesart** (Abschnitt 5): „Bestbesetzung je Slot" ist die Lesart, die zu „nach dem Slotwert"
  und „N = Slotzahl" zugleich passt. Falls Chris „die N höchsten Slot-Werte auf dem Feld" meint:
  eine Zeile, gleiche Darstellung.
- **Tauziehen** (3.7, 9.2) ist ein Bild für eine Formatidee, die erst produktiv wird, wenn die
  Format-Entscheidung fällt. Das Konzept verlangt nur, dass `FELD_JE_DISC` Bögen kann.
- **Vignetten-Erzeugung**: ob die Miniaturen aus der Arena-Pipeline gerendert oder je Variante
  einmal von Hand beschnitten werden, ist eine Werkzeugfrage. Für die sieben Audit-Disziplinen
  ist „aus der Rohszene" ohnehin Handarbeit, bis die Arena dort nachgezogen hat.
- **Wo `FELD_JE_DISC` lebt** (8.1) entscheidet die Opus-Architektur-Recherche. Dieses Dokument
  verlangt nur: eine Quelle für beide Maßstäbe.

## Anhang: Fundstellen

Zeilennummern Stand 08.11., vor Merge per `grep` prüfen.

| Was | Datei : Zeile |
|---|---|
| Struktur-Vorgänger (drei Ebenen, Feldformen, ±-Schema, Pakete) | `docs/design/aufstellung-screen-rework-08-11.md` (Branch `claude/aufstellung-screen-rework-0811`) |
| „Rahmen statt Material", Stimmungen der Spitzenbilder, sieben Rework-Disziplinen | `docs/design/kulissen-qualitaets-audit-08-11.md` Abschnitte 1, 3, 4 (Branch `claude/kulissen-qualitaets-audit-0811`) |
| Tauziehen-Grube, Schweizer Runden, sechs kreuzende Seile | `docs/design/format-varianten-machbarkeit-08-11.md` Abschnitte 1, 4 (Branch) |
| Was der Motor liest | `docs/design/verhalten-drei-stufen-board-text-03-11.md` |
| Rohszenen für die Vignetten | `public/szenen/<disziplin>/<variante>.jpg` (20 Ordner) |
| Arena-Tokens beide Themes | `public/mockups/battle-mode.css` : 11–32 (`--home/--away/--ok/--crit/--warn/--fortschritt`, `--nl-*`-Rückfälle) |
| Foundation-Tokens, Bereichs-Tönung der Einsatzliste | `app/globals.css` : 44509–44582 (`--nl-bg/panel/ink/gold/warn`), 44556–44559 (`--nl-pow/spe/men/soc`), 60783–60823 (`nl-lineup-layout`, `is-axis-*`) |
| Schrift, einzige | `app/globals.css` : 49–55; `battle-mode.css` : 10 |
| Foundation-Einsatzliste, Slot-Karte heute | `app/foundation/legacy-lineup-lab/LineupNewLook.tsx` : 1996 `nl-lineup-slot-grid`, 2077 Rollenlabel, 2100 `nl-tnum`, 1556–1569 Rivalen-Fenster |
| Übergabe Einsatzliste → Arena | `lib/foundation/battle-arena/arena-aufstellung-adapter.ts` : 53 `ArenaAufstellungEintrag`, 73 `buildArenaAufstellung` |
| Rollenthemen aller 20 Disziplinen (Namen auf den Marken) | `lib/lineups/matchday-slot-roles.ts` : 96 `DISCIPLINE_ROLE_THEMES`, 343 `ROLE_THEME_IDS_BY_SLOT_COUNT` |
| Späh-Stufen, Spannen, Rollenvermutung, Gegnerliste | `public/mockups/battle-mode.engine.js` : 37807 `SPAEHGRAD`, 37808 `spaehStufe`, 37811 `BANDBREITE`, 37821 `absicht`, 37842 `renderOpp`, 37951 „Änderst du deine Aufstellung, ändert sich der Plan" |
| Gauntlet-Kette Breaking | ebd. : 37887 |
| Reihen, Startplätze, Plätze | ebd. : 8201 `SLOT_ZUSATZ`, 38186 `homeFor`, 10855 `BASKETBALL_ROLLE_SLOT`, 44869 `planJeSlot` |
| Passung, Top-3, Kürzel | ebd. : 8286 `slotAufschlag`, 8296 `passung`, 8313 `bestenFuer`, 8329 `slotKuerzel` |
| Screenshot-Pipeline für Vignetten und Spiegel-Test | `scripts/screenshot-kulisse.mjs` |
