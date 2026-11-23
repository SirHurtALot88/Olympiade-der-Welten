# Training Runde 2: Ziel-Heatmap und Trainingsvorlieben (Konzept, 22.11.)

Mockup: `public/mockups/training-r2-22-11.html` (klickbar, Stil und Tokens aus `training-modern-18-11.html`).
Ergänzt `docs/design/training-modern-18-11.md` (Abschnitt 7a bleibt gültig). Kein App-Code, keine PixelLab-Bestellung.

Chris am 22.11., wörtlich:

1. „Plan ändern könnte man gut als Heatmap darstellen, wo am meisten Steigerung möglich ist, und die einzelnen Bereiche
   POW SPE MEN SOC besser hervorheben!“
2. „wir hatten ja vorher 2 Klassen, die Spieler gut und schnell trainieren, und 1, die schlecht ist — kannst du das für die
   Diszis auch so übernehmen? Der Spieler hat 2 positive Diszis, auf die er Bock hat zu trainieren, wo er effizienter wird,
   und 1, wo er schlechter trainiert.“

**Runde 2b, Chris am 22.11. zum Mockup, wörtlich:** „Mach in der Heatmap den Gesamtwert an Skillpunkten, den der Spieler
sammeln würde bis Ende der Saison, das soll der Standardwert sein, mit dem gerechnet wird. Und man muss auch schon irgendwo den
aktuellen Fortschritt erkennen, welche Stats der Spieler sich verbessert hat. Das Beste kannst du noch hervorheben und wie
gesagt die 2 Diszis, die er gut kann, und 1, die er schlecht kann, markieren mit nem Icon oder so. Aktuell ausgewählt umrahmen,
aber farblich erkennbar, nicht in der gleichen Farbe.“ Dazu seine Entscheidung zur Stärke: **Lieblingsdisziplin ×1,15,
ungeliebte ×0,80**, genau wie die Attribut-Affinität im Code (`SIGNATURE_ORGANIC_GROWTH_MULTIPLIER = 1.15`,
`WEAK_ORGANIC_GROWTH_MULTIPLIER = 0.8` in `lib/training/organic-season-progression.ts`). Moral +3 / −6 und „fest je Spieler“
bleiben. Umgesetzt in den Abschnitten 2, 3.2, 3.3 und 3.6.

## 1. Aufnahmen

Alle unter `docs/design/training-r2-22-11/`, je 1920×1080 und 2560×1440, ohne Seitenscroll, ohne JS-Fehler.

| Ansicht | Datei | URL |
|---|---|---|
| Heatmap „Skillpunkte“ (Standard), Maru trainiert seinen Liebling Staffel | `heatmap-maru-*.png` | `?spieler=maru` |
| Heatmap „Eignung“ (Zyra) | `heatmap-eignung-zyra-*.png` | `?spieler=zyra&mass=zuwachs` |
| Verletzte Spielerin (Zynara), Training ruht; beste Zelle ist zugleich gewählt | `heatmap-zynara-verletzt-*.png` | `?spieler=zynara` |
| Heatmap „Luft bis Decke“ (Conan) | `heatmap-luft-conan-*.png` | `?spieler=conan&mass=luft` |
| Fremdes Team unter Scouting-Nebel, Regel in Zahlen | `nebel-fremdes-team-*.png` | `?nebel=1` |

Echt sind Kader, Attribute, Decken, Eignungen, Ränge, Belastung, Ziele, Moral, Form und Verletzungen der Death Peaches
(Live-Abbild 22.11., Saison 1, Spieltag 12, Liga 2 mit 195 Spielern), die Matrix und die Disziplinfarben. Die Zuwachs-Zahlen
sind ein vereinfachtes Modell (Abschnitt 5), die Vorlieben sind nach der Regel aus Abschnitt 3 gewürfelt.

## 2. Die Ziel-Heatmap

**Heute:** Kachelraster aus 20 Disziplinen mit Eignung und Rang, darunter Weg und Intensität. Wo sich Training lohnt, sieht
man erst nach dem Klick.

**Neu:** Die Ziel-Wahl ist eine Heatmap **Disziplin × Weg**, also 20 Zeilen mal drei Zellen (Primärweg, zwei Nebenwege).
Ein Klick auf eine Zelle setzt Ziel und Weg in einem Schritt; der getrennte Schritt „Weg wählen“ entfällt.

- **Vier Bereiche als eigene Tafeln** (2×2): POW, SPE, MEN, SOC, je fünf Disziplinen. Die Zuordnung ist die
  Disziplinfarbe aus dem Code (`category` in `lib/data/dataAdapter.ts`), die Farben sind die Klassenfarben des
  Designsystems (`--pow`, `--spe`, `--men`, `--soc`). Jede Tafel hat einen farbigen Kopf mit Icon und nennt ihre beste
  Zelle („am meisten: +0,72 Gewichtheben“). Die Tafel in der Klassenfarbe des Spielers trägt die Marke „Klassenfarbe“,
  die gegenüberliegende „Gegenfarbe“ (POW↔MEN, SPE↔SOC, wie bei den Formkarten).
- **Farbe = Größe des Werts.** Jede Zelle ist im Farbton ihres Bereichs gefüllt, die Sättigung zeigt den Wert, gespreizt
  zwischen kleinstem und größtem Wert des Spielers. Die Zahl steht immer in der Zelle. In jeder Tafel stehen die Disziplinen
  absteigend nach ihrer besten Zelle.
- **Drei Maße, ein Umschalter** (`&mass=sp|zuwachs|luft`):
  - **Skillpunkte** (Standard, Runde 2b): Summe der Skillpunkte (SP), die der Spieler mit diesem Ziel und diesem Weg bis
    Saisonende sammelt, über alle drei Attribute des Wegs (60/25/15), mit Decke und Vorliebe. **Das ist die Zahl, mit der
    überall gerechnet wird:** Zelle, Vorschau („Gewählt … +1,76 SP“), Kaderliste (Spalte SP) und Kopf („SP Kader bis
    Saisonende“) zeigen dieselbe Größe aus derselben Funktion.
  - **Eignung**: erwarteter Eignungszuwachs im Ziel bis Saisonende (SP × Matrixgewicht). Das frühere Standard-Maß.
  - **Luft bis Decke**: Abstand des 60-%-Attributs zur individuellen Decke. Zeigt, wo langfristig Platz ist.
- **Beste Zelle** (Runde 2b): goldener Rahmen mit Schein und die Marke „★ Beste“; der Fuß nennt sie mit Namen und Wert. Haben
  mehrere Zellen dieselben Skillpunkte, gewinnt die mit dem größeren Eignungszuwachs.
- **Gewählte Zelle** (Runde 2b): **weißer Doppelrahmen** mit der Marke „Gewählt“. Weiß kommt sonst nirgends als Rahmen vor:
  nicht bei der besten Zelle (Gold), nicht bei den vier Bereichen (Rot, Grün, Blau, Gelb), nicht bei den Vorlieben (Rosa,
  Violett). Ist die beste Zelle gewählt, liegt Weiß außen und Gold innen, beide Marken bleiben lesbar.
- **Zeile:** Disziplin, Eignung, Rang in der eigenen Liga. Vorlieben stehen **vor dem Namen als gefülltes rundes Symbol**
  (Herz rosa, Daumen runter violett), dahinter der Faktor „×1,15“ bzw. „×0,80“; die Zeile ist hinterlegt und trägt links
  einen Balken in derselben Farbe (Abschnitt 3).
- **Zelle:** Wert, 60-%-Attribut, Marke „DECKE“, wenn die Decke diesen Weg bremst. Tooltip: alle drei Attribute mit
  Anteil, Matrixgewicht, Wert, Decke, Zuwachs, dazu die Eignung vorher und nachher.
- **Vorschau rechts** rechnet mit derselben Funktion wie die Zelle: Weg-Profil 60/25/15 mit Decke, „Wo das ankommt“ als
  Top 6 über die Matrix, Belastung der nächsten sechs Spieltage, bei Verletzten der Hinweis „Training ruht bis …“ mit
  der gekürzten Zahl der Trainings. Diese vier Blöcke repariert der parallele Bau in `TrainingModern.tsx`; das Mockup
  zeigt sie nur stimmig mit.
- **Fortschritt dieser Saison** (Runde 2b): Kasten in der Vorschau mit allen zwölf Attributen, nach Bereich gefärbt, je
  Attribut ein Mini-Balken und „+x“ seit Spieltag 1; unveränderte Attribute sind blass, der größte Fortschritt ist gold
  umrandet, im Kopf steht die Summe („bisher +3,4 SP“). Tooltip: Wert am Saisonstart → heute. In der Kaderliste steht unter
  der SP-Zahl klein „bisher +x“. Quelle im Spiel ist der Trainingsverlauf je Spieltag.
- **Kaderliste links** bleibt die Navigation: Ziel und Weg, Vorlieben, Skillpunkte bis Saisonende (klein darunter das
  bisher Gesammelte); sortierbar nach Spieler, Vorlieben und SP.

## 3. Trainingsvorlieben: zwei Lieblingsdisziplinen, eine ungeliebte

### 3.0 Das Vorbild im Code

Das „2 gut, 1 schlecht“ gibt es heute als Attribut-Affinität: `deriveAttributeAffinityProfile`
(`lib/training/training-levelup-service.ts`) würfelt je Spieler **zwei Signatur-Attribute und ein schwaches**, deterministisch
aus `player.id` + `seasonId`, „stark zufällig“ mit Tendenz 0,15 zu Klasse, Traits und den eigenen Top-/Bottom-Attributen.
Wirkung (`organic-season-progression.ts`): Signatur **×1,15**, schwach **×0,80**. Dazu der Fokusachsen-Bonus **+8 %**
(bis +13 % mit Specialist Wing). Die Vorlieben übernehmen genau dieses Muster eine Ebene höher, auf Disziplinen.

### 3.1 Wie gewürfelt wird

Je Spieler, deterministisch (kein `Math.random`), über alle 20 Disziplinen:

    Liebling(d)  = Zufall(player.id, "lieb", d)   + 0,15 wenn Farbe(d) = Klassenfarbe  + 0,15 wenn d unter seinen besten 5
    Ungeliebt(d) = Zufall(player.id, "unlieb", d) + 0,15 wenn Farbe(d) = Gegenfarbe    + 0,15 wenn d unter seinen schwächsten 5

Die zwei höchsten Liebling-Werte sind die Lieblingsdisziplinen, der höchste Ungeliebt-Wert unter den übrigen 18 ist die
ungeliebte. Klassen ohne Farbe (BALANCED) bekommen keine Farbtendenz. Die Tendenz ist bewusst schwach: Im Kader der
Death Peaches passen manche Lieblinge zur Stärke (Maru, Sprinter: Staffel und Climbing), andere überraschen (Conan,
Mage, mag Hockey). Das passt zur Leitlinie „mehrere Wege zum Erfolg“.

**Fest je Spieler, nicht je Saison neu.** Anders als die Attribut-Affinität fließt die Saison nicht in den Zufall: Die
Vorliebe ist eine Charaktereigenschaft, die man scoutet und auf die man einen Kader baut. Beim Scharfschalten wird das
Ergebnis einmal in den Spielstand geschrieben (`gameMetadata.playerTrainingsVorlieben[]`, wie `playerPotential`), damit
eine spätere Änderung der Würfelregel bestehende Spieler nicht umwirft.

### 3.2 Wirkung in Zahlen

| | Trainingsbudget | Moral |
|---|---:|---:|
| Ziel ist eine **Lieblingsdisziplin** | **×1,15** | **+3**, solange sie Ziel ist |
| Ziel ist die **ungeliebte Disziplin** | **×0,80** | **−6**, solange sie Ziel ist |
| jede andere Disziplin | ×1,00 | 0 |

- **Nur beim Training mit Ziel = diese Disziplin**, egal über welchen Weg. Der Faktor liegt auf dem Spieltagsbudget in
  `berechneSpieltagsZuwachs`, also in derselben Rechnung für Buchung und Vorschau (gezeigt = gebucht). Der Verlaufseintrag
  bekommt ein Feld für die Vorliebe.
- **Nicht** betroffen: die Leistungs-Hälfte der Entwicklung, die Wertung im Spiel, die Matrix, die Eignung selbst.
- **Verhältnis zum Vorbild (Entscheidung Chris, 22.11.):** dieselben Faktoren wie die Attribut-Affinität, Liebling ×1,15
  wie das Signatur-Attribut, ungeliebt ×0,80 wie das schwache Attribut. Die Faktoren multiplizieren sich mit der
  Attribut-Affinität; das Maximum auf einem Signatur-Attribut ist 1,15 × 1,15 = 1,32, das Minimum 0,80 × 0,80 = 0,64.
- **Moral** läuft als Grund in `playerMoraleState.reasons` („trainiert Lieblingsdisziplin“ / „trainiert, was er nicht
  mag“), nicht als Buchung je Spieltag: Der Grund gilt, solange das Ziel steht, und fällt mit dem Wechsel weg. Zum
  Vergleich: Ein verfehlter Intensitätswunsch kostet 12 Moral; die Vorliebe ist bewusst kleiner.
- **KI und Delegation:** `kiTrainingsZielVorschlag` gewichtet eine Lieblingsdisziplin mit ×1,15 und die ungeliebte mit
  ×0,80, entscheidet aber weiter nach Kaderlücke. Mensch und KI rechnen gleich; ein delegiertes Team (Ramona) nutzt
  dieselbe Funktion. Die Vorliebe gehört dem Spieler, nicht dem Manager, und ist damit mehrspielerfest.

### 3.3 Balance

- **Nicht mehr exakt neutral.** Zwei von zwanzig Disziplinen geben +15 %, eine gibt −20 %. Bei zufälliger Zielwahl sind das
  2 × 15 − 20 = +10 Prozentpunkte über drei von zwanzig Disziplinen, also (30 − 20) / 20 = **+0,5 % Trainingsbudget** im
  Mittel. (Mit ×1,10 war es genau 0.)
- **In der Praxis deutlicher**, weil gezielt gewählt wird. Rechnung mit 35 % Liebling und 3 % ungeliebt:
  0,35 × 15 − 0,03 × 20 = **+4,7 % Trainingsbudget** (mit ×1,10: +2,9 %). Bei 60 % Training / 40 % Leistung (PR #1696) sind
  das **+2,8 % Entwicklung** im Ligamittel, bei Diligent (75/25) +3,5 %. Im Live-Kader trainieren heute 3 von 10 Spielern
  zufällig ihren Liebling, keiner die ungeliebte: +4,5 % Budget.

| Anteil der Spieler mit Ziel = Liebling (ungeliebt 3 %) | Trainingsbudget | Entwicklung (60/40) | Satz je Spieltag für Ausgleich |
|---:|---:|---:|---:|
| 10 % (zufällige Wahl, ungeliebt 5 %) | +0,5 % | +0,3 % | kein Ausgleich nötig |
| 20 % | +2,4 % | +1,4 % | −2,3 % |
| **35 % (Annahme)** | **+4,7 %** | **+2,8 %** | **−4,4 %** (Mittel 0,226 → 0,216) |
| 50 % | +6,9 % | +4,1 % | −6,5 % |
| 70 % (alle, die können) | +9,9 % | +5,9 % | −9,0 % |

- **Ausgleich:** `TRAINING_SETPOINTS_JE_SPIELTAG` wird um den **gemessenen** Budget-Zuwachs gesenkt, nicht um die Annahme.
  Erwartet sind rund **4 bis 5 %** (bei 35 %: Leicht 0,178 → 0,170, Mittel 0,226 → 0,216, Hart 0,320 → 0,306). Damit bleibt
  die Entwicklung im Ligamittel gleich; wer seinen Liebling trainiert, liegt dann rund 10 % über heute, wer etwas anderes
  trainiert, rund 4 % darunter. Das Mockup rechnet noch mit den ungesenkten Sätzen.
- **Abnahme vor dem Scharfschalten:** Messlauf mit 32 KI-Teams über drei Saisons, Regel an gegen aus; gemessen werden der
  Anteil der Liebling-Ziele und die mittlere Entwicklung. Liegt die Mehrentwicklung über 1 %, wird der Satz um den gemessenen
  Budget-Faktor gesenkt und der Lauf wiederholt (Ziel: ±1 % zum Lauf ohne Regel). Die Verteilung „wenige deutlich besser,
  wenige deutlich schlechter, die Masse kaum“ darf sich nicht verschieben.
- rho und Pp-Abweichung sind nicht berührt: Die Mechanik im Spiel bleibt, wie sie ist.

### 3.4 Sichtbarkeit unter Scouting-Nebel

| Stufe | Sichtbar |
|---|---|
| eigenes Team | alle drei, immer |
| fremd, unbekannt | nichts (drei schraffierte Felder) |
| fremd, beobachtet | eine Lieblingsdisziplin |
| fremd, gescoutet | alle drei |

Feste Stufen wie bei den Attributen, kein „ungefähr“. Sortieren und Filtern fremder Spieler nach Vorlieben geht nur nach
Stufe, bei Gleichstand nach Name. „Fog of War aus“ zeigt alles. Der Scouting-Stand ist je Team getrennt
(`scoutIntelByTeamId`).

### 3.5 Regel-Stempel

- `seasonState.trainingsVorlieben = { seasonId, regel: "v1" | "aus" }`, Modul `lib/resolve/trainings-vorlieben.ts`, jeder
  Rechenweg fragt `trainingsVorliebenRegelFuer(gameState)`, nie eine Prozess-Variable.
- Neues Spiel: an ab Saison 1. Bestehender Spielstand: ab dem nächsten Saisonwechsel; gebuchte Spieltage bleiben.
- Rückweg `OLY_TRAININGS_VORLIEBEN=aus` (neue Saisons), Notbremse `=aus-sofort`. Nur auf dem Server, kein `NEXT_PUBLIC`.

### 3.6 Darstellung

- **Heatmap:** gefülltes rundes Symbol vor dem Disziplinnamen (Herz rosa, Daumen violett), dahinter der Faktor als Marke;
  die Zeile ist rosa bzw. violett hinterlegt und links markiert. Der Faktor steckt schon in der Zellenzahl.
- **Kaderliste:** Spalte „Vorlieben“ mit zwei Herzen und einem Daumen, Name in Disziplinfarbe. Die gerade trainierte
  Vorliebe ist umrandet. Sortierbar.
- **Vorschau:** Kasten „Trainingsvorlieben“ mit drei Karten und einem Satz zur Folge der aktuellen Wahl; an der Moral
  steht „+3“ bzw. „−6“, im Kasten „Gewählt“ die Marke „Liebling ×1,15“ bzw. „ungeliebt ×0,80“.
- **Kopf:** „trainieren ihren Liebling 3 / 10“ und „trainieren Ungeliebtes 0 / 10“.
- **Tooltip** an jedem Symbol mit Faktor und Moral.
- Symbole sind SVG (Herz, Daumen runter), keine Emojis; Rosa und Violett sind eigene Töne, damit sie nicht mit den vier
  Bereichsfarben und nicht mit Gut/Warnung verwechselt werden.

## 4. Was der Bau anfasst

| Teil | Ort |
|---|---|
| Heatmap statt Kachelraster | `app/foundation/training-modern/TrainingModern.tsx` (Plan), eigene Komponente |
| Zuwachs je Zelle | `prognostiziereSpieltagsTraining` je (Ziel, Weg); 60 Rechnungen je Spieler, zwischenspeichern |
| Vorlieben würfeln und speichern | neu `lib/training/trainings-vorlieben.ts`, `gameMetadata.playerTrainingsVorlieben` |
| Faktor im Budget | `berechneSpieltagsZuwachs` (`lib/training/spieltag-training.ts`) |
| Moral-Grund | Moral-Fortschreibung, zwei neue `reasonId` |
| KI-Zielwahl | `kiTrainingsZielVorschlag` |
| Stempel | `lib/resolve/trainings-vorlieben.ts`, Saisonwechsel, Neuanlage |
| Nebel | Kader-, Profil- und Marktansichten über die Scouting-Stufe |

Der Wertungs-Fingerabdruck bewegt sich nicht (kein Eingriff in die Arena-Engine).

## 5. Grenzen des Mockups

- **Fortschritt dieser Saison ist ein Beispielmodell:** bisheriger Plan über elf Spieltage plus zwei Attribute aus der
  Leistungs-Hälfte. Das Abbild trägt den Verlauf je Attribut nicht; im Spiel kommt er aus dem Trainingsverlauf.
- Skillpunkte: Satz je Spieltag (0,178 / 0,226 / 0,32) × Rest-Spieltage, verteilt 60/25/15, Decke bremst (offen ×1, bis 6
  Punkte Rest ×0,45, zu ×0,05), Eignung = Zuwachs × Matrixgewicht. Ohne Attribut-Affinität, Potenzial-Beschleuniger,
  Gebäude und Nebeneffekt. Die App zeigt die Werte der Engine; die Größenordnung (+0,2 bis +0,7 Eignung in neun
  Spieltagen) stimmt.
- Belastungs-Forecast: Trainingslast minus feste Erholung, Einsatz an jedem zweiten Spieltag angenommen.
- Intensitätswünsche (Punkt am Knopf) und die Scouting-Stufen der Cash Creators sind gesetzt, nicht aus dem Spielstand.
- Phone ist nicht Teil dieses Entwurfs.

## 6. Offene Fragen an Chris

1. **Stärke: entschieden** (Chris, 22.11.): ×1,15 / ×0,80 wie die Attribut-Affinität. Offen ist nur der Ausgleich: Satz je
   Spieltag um den gemessenen Wert senken (erwartet 4 bis 5 %), oder das Plus als gewollte Belohnung stehen lassen?
2. **Fest je Spieler** und 3. **Moral +3 / −6** bleiben, bis Chris etwas anderes sagt.
