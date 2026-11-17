# Asset-Herkunfts-Audit: nur noch PixelLab (17.11.)

Anlass, Chris am 17.11., wörtlich: „Das mit Pixel lab gilt auch für alle anderen diszis! Wir nutzen keine
alten Assets mehr sondern nur noch eie aus Pixel lab". Gemeint sind Kulissen, Böden, Requisiten, Fallen,
Möbel und Objekte in allen zwanzig Disziplinen und in allem Neuen. Charaktere und Animationen bleiben
gesperrt (nur Bestand) und gehören nicht zu diesem Audit.

Dieses Dokument ist ein reines Lese-Audit: nichts bestellt, nichts im Code geändert. Der Kontostand wurde am
17.11. per `GET https://api.pixellab.ai/v2/balance` gelesen: **1677 Generationen** (Tier 3, Abo aktiv).

Kostenmaßstab aus der I-Spy-Runde vom 17.11.: eine Breitformat-Kulisse 792×300 kostet **25 Gen.**, ein
Möbelstück oder Requisit **13 Gen. je Auftrag**.

## 0. Kurzfassung

- **Sauber sind 4 von 20 Disziplinen:** TDM, Mini-DM, Staffel und I-Spy. „Sauber" heißt: Kulisse und alle
  sichtbaren Requisiten stammen im Normalbetrieb aus PixelLab. Ausgenommen sind dabei Linien, Marker, HUD
  und Effekte sowie die Handgeräte der Klasse C (Abschnitt 4).
- **16 Disziplinen sind nicht sauber.**
  - 12 davon zeigen mindestens eine **prozedural in Python gemalte Kulissen-Variante**: Basketball,
    Battlefield, Climbing, Eiskunstlauf, Fechten, Football, Gewichtheben, Hockey, Showcase, Speed-Schach,
    Tennis und Wettessen.
  - Die übrigen 4 haben eine PixelLab-Kulisse, aber **Requisiten aus Canvas-Primitiven oder LPC-Kacheln**:
    Breaking, Spurt, Takeshi's Castle und Zeitfahren.
- **Der größte Brocken ist unsichtbar dokumentiert.** 18 der 54 Motor-Kulissen (33 %) sind keine
  PixelLab-Bilder. Sie stammen aus `scripts/baue-szenen-varianten.py`, `-varianten-2.py` und
  `baue-szenen-schauplaetze.py`. Diese Skripte malen die Umgebung „ohne PixelLab-Zugang … prozedural in
  Pixel-Art" (Docstring, Zeile 14–16). `public/sprites/kulissen/quellen.json` behauptet dagegen im
  `_hinweis`: „Alle Bilder unter kulissen/ entstehen aus den PixelLab-Szenen".
- **Einiges ist schon bezahlt, aber nicht eingebaut.** 25 PixelLab-Bilder liegen fertig da und sind nirgends
  im Motor verdrahtet:
  - in `public/sprites/arena/` (10): `falle_fegearm`, `grube_*` (3), `kaefig_*` (4) und
    `bruecke_wackel_*` (2);
  - nur als Rohbild unter `data/generated/pixellab-requisiten/roh/` (15): `wettessen_teller_*` (3),
    `wettessen_kotzeimer`, `breaking_pfahl`, `eiskunst_spotlight`, `eis_kufenspuren`,
    `eiskunst_tannen_bergkette`, `takeshi_fort_segment`, `takeshi_rammbock`, `takeshi_wasserkanone`,
    `football_becken`, `spurt_outdoor_strand`, `stier` und `hai`.

  Mehrere Lücken lassen sich damit für **0 Gen.** schließen.
- **Kosten der Wellen:**

  | Welle | Inhalt | Basis | mit Puffer |
  |---|---|---:|---:|
  | A | 18 Kulissen | **450 Gen.** | ~675 Gen. (×1,5 für Nachbestellungen) |
  | B | häufige Requisiten | **364 Gen.** | ~475 Gen. (×1,3) |
  | C | Details, Kernumfang | **64 Gen.** | — |
  | C | optionale Posten | bis +221 Gen. | — |
  | **Summe** | A + B + C (Kern) | **878 Gen.** | ~1215 Gen. |

  Das passt in den Kontostand (1677 Gen.), lässt aber nur noch wenig Reserve für weitere Runden.

## 1. Methode und Belege

| Quelle | Was sie belegt |
|---|---|
| `public/sprites/arena/quellen.json` | Herkunft jeder Arena-Kachel (LPC/OpenGameArt bzw. PixelLab mit Job-ID) |
| `data/generated/pixellab-requisiten/auswahl.json` | jeder PixelLab-Auftrag mit Prompt, Saat und Job-ID (88 Einträge); deckt auch die 16 Arena-Dateien ohne `quellen.json`-Eintrag ab (`truhe_*`, `kaefig_*`, `grube_*`, `bruecke_*`, `falle_fegearm`) |
| `public/sprites/kulissen/quellen.json` | Job-IDs nur für die nachträglich erzeugten Kulissen: I-Spy-Hallen, Showcase-Prospekte und die gebackenen Breaking-/Showcase-Fassungen |
| `public/sprites/{basketball,buehne,football,waffen,schiff}/quellen.json` | Ball, Korb, Schachfiguren und Helme: PixelLab. Parkett: LPC. `korb_seite`/`korb_front`: Kenney. `baelle_varianten`, Zuschauer: OGA |
| `lib/foundation/discipline-scenes.ts` (Kopf) | Die Szenen der Asset-Runde vom 01./02.11. (`public/szenen/`) zeigt das Spiel nicht. Sie sind nur Werkzeug-Quelle für die Kulissen |
| `scripts/baue-szenen-varianten*.py`, `scripts/baue-szenen-schauplaetze.py` | welche Szenen-Varianten prozedural gemalt sind (Abschnitt 2) |
| `public/mockups/battle-mode.kulissen.js` | welche Kulissen der Motor wirklich zieht (54 Bilder) |
| `public/mockups/battle-mode.engine.js` | `A_TEILE`, `BK_TEILE`, `FK_TEILE` und `SB_TEILE` (geladene Dateien); `if(!mitKulisse)`-Weichen (was nur im Rückfall sichtbar ist); `zeichne*`/`boden*` (Canvas-Primitive) |

**Einschränkung zu den Original-Szenen.** Dass die Original-Szenen der Asset-Runde PixelLab sind, ist nur
pauschal belegt: durch den Commit `addeede9` („Neue PixelLab-Assets … 20 Disziplin-Szenen") und durch den
Docstring in `baue-szenen-varianten.py`. Job-IDs je Bild gibt es dafür nicht (Risiko R1).

## 2. Kulissen: welche Motor-Kulisse woher kommt

| Disziplin | PixelLab (Original der Asset-Runde oder eigener Auftrag) | **prozedural gemalt (nicht PixelLab)** | Bauskript der Variante |
|---|---|---|---|
| TDM | basis, lava, frost | — | — |
| Mini-DM | basis, saegewerk, strom-kaefig | — | — |
| Battlefield | eroberung | **wuestenruine** | `baue-szenen-schauplaetze.py` |
| Basketball | parkett | **streetcourt** | `baue-szenen-schauplaetze.py` |
| Hockey | eis | **bergsee** | `baue-szenen-schauplaetze.py` |
| Football | feld | **strand** | `baue-szenen-schauplaetze.py` |
| Gewichtheben | sandsack | **hafen, oase** | `baue-szenen-varianten.py` |
| Speed-Schach | — (das PixelLab-Original `turniersaal` hat der Motor **nicht** eingebunden) | **park, zug** | `baue-szenen-varianten-2.py` |
| Showcase | buehne (Original + PixelLab-Prospekt) | **festival**; **zirkus** ist ein Mischfall (Prospekt PixelLab, Zirkusrahmen prozedural) | `baue-szenen-varianten-2.py` |
| Eiskunstlauf | kuer | **waldsee** | `baue-szenen-schauplaetze.py` |
| Breaking | standard, brutal (Licht gebacken) | — | — |
| Wettessen | jahrmarkt | **nachtmarkt, bierzelt** | `baue-szenen-varianten.py`, `-varianten-2.py` |
| Tennis | court | **riviera, dach** | `baue-szenen-varianten-2.py` |
| Fechten | piste | **schlosshof** | `baue-szenen-schauplaetze.py` |
| Staffel | arena | — | — |
| Spurt | kurs ist ein Mischfall, s. u.; hyrox-Arena (`hyrox_arena.jpg`, PixelLab, #1550; die alte `hyrox_halle.jpg` aus `szenen/spurt/hyrox.jpg` ist entfernt) | — | — |
| Takeshi's Castle | keine Kulisse: Route aus PixelLab-Bodenkacheln und -Requisiten | (`szenen/takeshis-castle/eisfestung`, `dschungel` sind prozedural, im Spiel aber nicht gezeigt) | — |
| Zeitfahren | alle 11 Karten (Parallax-Ebenen der Asset-Runde) | — | — |
| Climbing | wand | **fels, eis** | `baue-szenen-varianten-2.py` |
| I-Spy | aztec, horror, lostplace, ruinengarten (eigene Aufträge 792×300 vom 17.11.) | — | — |

**Die prozeduralen Varianten sind Mischfälle.** Die Spielfläche (Platz, Bahn, Brett) ist aus dem
PixelLab-Original übernommen und höchstens umgefärbt. Alles drumherum, also Himmel, Skyline, Häuser,
Zelte, Bäume und Effekte, ist mit PIL gemalt (Bayer-Dithering, feste Palette).

**Spurt `kurs.jpg`:** Belag, Tribüne, Geräte und Anzeigetafel stammen aus der PixelLab-Szene.
Drei Teile sind dagegen prozedural (`scripts/baue-kulisse-buehnen.py`):

- das **Hallendach** (`_sp_hallendach`),
- die **Sponsorenbande** (`_sp_sponsorenbande`),
- sechs **Betreuer-Strichfiguren** (`_sp_betreuer`).

## 3. Tabelle je Disziplin: was im Normalbetrieb NICHT PixelLab ist

Legende der Sichtbarkeit: **H** = Haupt-Kulisse, **R** = häufig sichtbares Requisit, **D** = kleines Detail.
Kosten in Gen. nach dem Maßstab oben; „0" heißt, dass ein bereits bezahltes PixelLab-Bild existiert.

| Disziplin (Formate) | Nicht-PixelLab im Bild | Fundstelle | Sicht | Ersatz / Gen. |
|---|---|---|---|---|
| TDM | — (LPC `boden_sand`, `mauer_ziegel` und `fackel` nur im Rückfall ohne Kulisse) | `bodenArena()` | — | 0 |
| Mini-DM | — | — | — | 0 |
| Battlefield (Pods) | Kulisse wuestenruine; Fahnenmast der Eroberungspunkte (der Motor zeichnet ihn selbst) | `kulissen/battlefield/wuestenruine.jpg`; Docstring `baue-kulisse-battlefield.py` | H; D | 25; 13 |
| Basketball | Kulisse streetcourt (Parkett LPC und Zuschauer OGA nur im Rückfall) | `bodenFeldspiel()` | H | 25 |
| Hockey | Kulisse bergsee; Tore, Strafbank, Puck; Schläger in der Hand | `zeichneTor()`, `zeichneStrafbank()`, `zeichneFeldspiel()`, `zeichneHockeyschlaeger()` | H; R; D | 25; 26 (Tor, Bank); Puck 13 (C) |
| Football | Kulisse strand | — | H | 25 |
| Gewichtheben (Hantel-Duell, Sandsack-Schicht) | Kulissen hafen und oase; Hantel, Plattform, Kampfrichterlampen und Zuschauerpunkte über der Kulisse; Sandsack-Schicht: Silos, Rampe, Säcke | `bodenHeben()` (Zuschauer ab ca. Z. 32082, auch mit Kulisse), `zeichneHantel()`, `zeichneSandsackParBuehne()` | H; R | 50; 26 (Hantel, Plattform); 39 (Silo, Rampe, Sack); Lampen und Zuschauer s. C |
| Speed-Schach | **beide** Kulissen park und zug; Schachuhr; Brett (Gitter) | `zeichneSchachuhr()`, `zeichneSchachBrett()` | H; R | 50, **oder 0** über `turniersaal`; Uhr 13; Brett = Marker |
| Showcase | Kulisse festival, Rahmen von zirkus; Jury-Pult mit Buzzern (auch mit Kulisse); Act-Requisiten (Zielscheibe, Felsbrocken); Bogen in der Hand | `bodenShowcase()` ab ca. Z. 31363, `zeichneZielscheibe()`, `zeichneFelsbrocken()` | H; R; D | 50; 13 + 26 |
| Eiskunstlauf | Kulisse waldsee; Startbereich mit Kiss-and-Cry; Kufe | `bodenEis()` | H; R; D | 25; 13 (zusätzlich ungenutzt vorhanden: Spotlight, Kufenspuren, Bergkette, alle 0) |
| Breaking (Folter) | 9 Folterwerkzeuge auf dem Tisch und in der Faust (Strick, Rute, Peitsche, Daumenschraube, Zange, Brandeisen, Keil, Nagelkeule, Säge); Pfahl/Folterplatz | `FOLTER_GERAETE` (Z. ca. 18944), `zeichneBreaking()` | R | 26 (2 Reihen-Aufträge wie `schach`) bzw. 117 einzeln; Pfahl **0** (`breaking_pfahl`) |
| Wettessen | Kulissen nachtmarkt und bierzelt; Bankettafel, Ketchup-/Senfflaschen, Wimpelkette und Menüschild (auch mit Kulisse); Tellerstapel | `bodenWettessen()`, `zeichneWettessenMenuSchild()`, `zeichneWettessen()` | H; R | 50; 52; Teller **0** (`wettessen_teller_*` 3×), Kotzeimer 0 |
| Tennis | Kulissen riviera und dach; Netz; Schläger | `bodenTennis()`, `zeichneSchlaeger()` | H; R; D | 50; 13 |
| Fechten | Kulisse schlosshof; Degen (Piste, Lampen und Tafel sind Marker/HUD) | `zeichneDegen()` | H; D | 25 |
| Staffel | Staffelstab in der Hand | `zeichneStab()` | D | C |
| Spurt (Standard, Hatz, HYROX) | Kopf- und Fußstreifen von kurs.jpg (Dach, Bande, Betreuer); **Hatz-Fegearm als roter Balken**; Spikes | `zeichneHatzUeberlagerung()`, `_sp_*` in `baue-kulisse-buehnen.py` | R; D | Fegearm **0** (`falle_fegearm`); Streifen 25 (C) |
| Takeshi's Castle | **LPC `boden_stein`** in „Skipping Stones" und als Hangsteine; **LPC `boden_erde`** in der Schlammgrube „Dragon God Lake" | `zeichneFalleTakeshi()` (`case "steine"`, `case "schlamm"`), `bodenTakeshiRoute()` ca. Z. 45329 | R | Schlamm **0** (`boden_schlamm`); Trittsteine 13 |
| Zeitfahren (11 Karten) | Warnschilder, Leitpfosten, Startpodest, Zwischenzeit-Tore und Ziel als Primitive über dem PixelLab-Panorama; Weste | `bodenZeitfahren()`/`zfStreckenbild()` (ab Z. 46272) | R; D | 52 (Schild, Pfosten, Podest, Tor) |
| Climbing | Kulissen fels und eis; Griffe, Volumen und Exen | `bodenWand()` (Griffe ab ca. Z. 47180) | H; R | 50; 39 (Griffsatz 2 Aufträge, Volumen 1) |
| I-Spy | — (Hallen, Möbel und Truhen PixelLab; Primitive nur als Rückfall); Lupe | `ispyZeichneMoebelBild()` | D | C |

## 4. Wellen

### Welle A: große Kulissen (18 Bilder, 450 Gen.)

Die 18 prozeduralen Varianten aus Abschnitt 2, jede als eigener Breitformat-Auftrag nach dem I-Spy-Muster:
ein großer, leerer Ort, die Motor-Geometrie zeichnet weiter der Motor. Gerechnet sind **18 × 25 = 450 Gen.**,
mit realistischen Nachbestellungen etwa 675 Gen.

**Nullkosten-Alternative (A0).** Man kann die 18 Varianten vorübergehend aus
`battle-mode.kulissen.js` nehmen. Jede Disziplin behält ihr PixelLab-Original, nur Speed-Schach braucht
dann eine neue Motor-Kulisse aus dem vorhandenen PixelLab-Original `turniersaal`. Kosten: **0 Gen.**
Preis dafür: weniger Abwechslung, bis Welle A durch ist.

### Welle B: häufig sichtbare Requisiten (364 Gen.)

Zuerst die **0-Gen.-Posten**, alle schon bezahlt:

| Ersatz | Lücke |
|---|---|
| `falle_fegearm` | Hatz-Fegearm |
| `wettessen_teller_*` (3×) | Tellerstapel |
| `wettessen_kotzeimer` | — (vorhanden, ungenutzt) |
| `breaking_pfahl` | Folterplatz |
| `boden_schlamm` | Takeshi-Schlammgrube statt LPC-Erde |

Danach die Neubestellungen:

| Disziplin | Requisiten | Gen. |
|---|---|---:|
| Zeitfahren | Warnschild, Leitpfosten, Startpodest, Zwischenzeit-Tor | 52 |
| Wettessen | Bankettafel, Flaschen, Wimpelkette, Menüschild | 52 |
| Climbing | Griffsatz, Volumen | 39 |
| Showcase | Jury-Pult, Zielscheibe, Felsbrocken | 39 |
| Gewichtheben (Sandsack-Schicht) | Silo, Rampe, Sack | 39 |
| Gewichtheben (Hantel-Duell) | Hantel, Plattform | 26 |
| Hockey | Tor, Strafbank | 26 |
| Breaking | 9 Folterwerkzeuge als 2 Reihen-Aufträge | 26 |
| Takeshi | Trittsteine | 13 |
| Tennis | Netz | 13 |
| Speed-Schach | Schachuhr | 13 |
| Eiskunstlauf | Kiss-and-Cry | 13 |
| Battlefield | Fahnenmast | 13 |
| **Summe** | | **364** |

**Wiederverwendung über Disziplinen hinweg:**

- Ein Zielbogen für Zeitfahren könnte `spurt_bogen_finish` übernehmen.
- Die neuen Trittsteine passen auch für Battlefield und Mini-DM.
- Für die geplanten Mini-DM-Bausteine liegen `grube_*`, `kaefig_*` und `bruecke_wackel_*` schon bezahlt
  bereit (`docs/design/arenen-mechaniken-konzept-konsolidiert-15-11.md`, Abschnitt 4).

### Welle C: kleine Details (Kern 64 Gen., optional bis +221 Gen.)

**Kern (64 Gen.):**

- Puck (13)
- Kampfrichterlampen beim Gewichtheben (13)
- Spurt-Kopf- und -Fußstreifen als ein Breitformat-Auftrag (25)
- Zuschauerreihe beim Gewichtheben (13), nur falls Chris eine Publikumsgruppe als Requisit gelten lässt

**Optional, Chris entscheidet:**

- **10 Handgeräte, die mit der Figur mitgedreht werden** (130 Gen.): Hockeyschläger, Kufe, Staffelstab,
  Tennisschläger, Degen, Showcase-Bogen, Zeitfahr-Weste, Spikes, Mikrofon, Lupe (`zeichneStab()` …
  `zeichneLupe()`, Z. 748–5520).
- **Rückfall-Kacheln ohne Kulisse** (91 Gen.): LPC `boden_sand`, `mauer_ziegel`, `fackel`, `rasen`,
  `bahn_ocker`, Parkett und OGA-Zuschauer.

## 5. Was kein Asset ist oder nicht ersetzt werden sollte (Vorschlag, Chris entscheidet)

- **Linien, Marker und HUD bleiben Canvas.** Dazu gehören:
  - Spielfeldlinien, Bahnlinien, Teamhälften und Mittellinie;
  - Fechtpiste und Schachbrett-Gitter;
  - Kontrollpunkt-Ringe, Sockel in Teamfarbe, Etiketten und Tafeln;
  - Shot-Clock, Trefferlampen, Hatz-Beschriftung;
  - die Curbs und Fan-Parolen im Zeitfahren;
  - Effekte: Blutflecken, Funken, Staub (`zeichneEffekte()`, `zeichneBodenstaub()`).

  Diese Elemente tragen Spielinformation, die sich jeden Frame ändert. Ein Bild würde sie schlechter lesbar
  machen.
- **Die Handgeräte gehören zum Animations-Rig der Figuren.** Sie hängen frame-genau an der Pose. Ein
  PixelLab-Bild müsste dafür je Haltung passen, und das kommt der gesperrten Animationsfrage nahe.
  Vorschlag: vorerst ausklammern.
- **`zeichneSchiri()` ist eine Figur.** Ersatz hieße: neuer Charakter, und der ist gesperrt. Nicht bestellen.
  Möglich wäre eine Bestandsfigur oder der Schiedsrichter fällt weg.
- **Rückfall-Pfade** (`if(!mitKulisse)`) mit LPC-, OGA- und Primitiv-Grafik sieht man im Normalbetrieb nicht,
  nur bei einem Ladefehler oder im Headless-Runner. Vorschlag: nicht ersetzen, sondern bei Gelegenheit
  vereinfachen, zum Beispiel einfarbige Fläche statt LPC.
- **Ungenutzte Fremddateien** könnte man aufräumen statt ersetzen (0 Gen.):
  - `vogel_adler.png` (LPC), `basketball/korb_seite.png`, `korb_front.png` (Kenney), `baelle_varianten.png`
    (OGA): kein Motor-Verweis;
  - `szenen/takeshis-castle/{eisfestung,dschungel}.html` (prozedural, nie gezeigt).
- **Charakter-Bestand bleibt unberührt:** Waffen-Overlays (LPC Skorpio, `sprites/waffen/`), Baukasten-Figuren
  (LPC), `pirat_schiff` (OGA).
- **Die Foundation-Bühne** (`app/foundation/discipline-stage/arena/disciplines/*.tsx`, React-SVG) ist eine
  schematische Datenbühne aus Vektorformen und Teamlogos, keine Illustration. Vorschlag: nicht Teil der Regel.

## 6. Empfohlene Reihenfolge

1. **0-Gen.-Schritte sofort.** Dazu gehören:
   - die bezahlten, ungenutzten PixelLab-Bilder verdrahten: Fegearm, Teller, Pfahl, Takeshi-Schlamm;
   - die irreführenden Herkunftstexte korrigieren: `_hinweis` in `kulissen/quellen.json`, Einträge für die 18
     prozeduralen Kulissen.

   Alles reine Anzeige. Den Wertungs-Fingerabdruck prüfen (`e80babacb68c`).
2. **Welle A mit einem Piloten beginnen** (eine Variante, zum Beispiel Tennis riviera, 25 Gen.). Er zeigt, ob
   ein PixelLab-Breitformat die Motor-Geometrie trägt (Platz, Bahn). Bis der Pilot steht, entscheidet Chris
   zwischen A0 (prozedurale Varianten vorübergehend aus) und Weiterlaufen. Danach die übrigen 17, nach
   Spielhäufigkeit sortiert.
3. **Welle B** in der Reihenfolge Zeitfahren, Wettessen, Gewichtheben, Climbing, Breaking, Showcase, Hockey,
   Rest. Der Grund: das sind die meisten Spielminuten mit dauerhaft sichtbaren Primitiven.
4. **Welle C** nur nach Chris' Entscheid zu Handgeräten und Zuschauern.

## 7. Risiken

- **R1 – Herkunft der Original-Szenen nur pauschal belegt.** Es gibt keine Job-IDs je Szene. Falls einzelne
  Ebenen der Asset-Runde doch aus Fremdpaketen stammen, wächst Welle A.
- **R2 – Geometrie.** PixelLab liefert kein exaktes Spielfeld. Die Kulissen müssen nach dem I-Spy- bzw.
  „Rahmen statt Material"-Muster gebaut werden: leere Fläche, und der Motor zeichnet Linien und Geräte.
  Sonst laufen Feld und Bild auseinander.
- **R3 – Stilbruch.** Neue Requisiten neben den Original-Szenen brauchen dieselbe Prompt-Familie und
  Saat (`seed 11`, „16-bit RPG style, clean single color dark outline", s. `auswahl.json`).
- **R4 – Kontostand.** Mit Puffer ~1215 von 1677 Gen. Danach bleiben rund 460 Gen. für alles andere.
  Welle C (optional) und neue Disziplinen konkurrieren darum.
- **R5 – Fingerabdruck.** Neue Bilder dürfen keine Felder an Läufer- oder Spielerobjekten anlegen.
  Die Prüfsumme `GESAMT e80babacb68c` muss gleich bleiben.
- **R6 – Charakter-Grenze.** Zuschauer, Betreuer, Schiedsrichter und Tiere (`stier`, `hai` liegen roh vor)
  sind figurennah. Im Zweifel fragen, statt bestellen.

## 8. Vorschlag für einen CLAUDE.md-Absatz (nicht eingetragen)

> **Nur noch PixelLab-Assets — gilt für alle zwanzig Disziplinen.** Chris am 17.11., wörtlich: „Das mit Pixel
> lab gilt auch für alle anderen diszis! Wir nutzen keine alten Assets mehr sondern nur noch eie aus Pixel
> lab". Jede sichtbare Kulisse, jeder Boden, jedes Requisit, jede Falle und jedes Möbelstück in einer
> Disziplin oder einem neuen Format kommt aus PixelLab, mit Job-ID in `data/generated/pixellab-requisiten/
> auswahl.json` bzw. `quellen.json`. Keine neuen LPC-, OpenGameArt- oder Kenney-Teile, keine prozedural in
> Python gemalten Kulissen (`baue-szenen-varianten*.py`) und keine Canvas-Primitive als Ersatz für ein
> Objekt. Linien, Marker, HUD und Effekte bleiben Canvas. Charaktere und Animationen bleiben gesperrt (s.
> oben), Requisiten sind frei bestellbar. Vor einer Neubestellung erst die bezahlten, ungenutzten Bilder in
> `data/generated/pixellab-requisiten/roh/` prüfen; Stand und Kosten je Disziplin:
> `docs/design/pixellab-nur-neue-assets-audit-17-11.md`.

## 9. Stand Welle A nach Batch 2 (17.11.)

Chris am 17.11.: „welle 2 ja“. Batch 2 hat die übrigen **12** prozedural gemalten Kulissen durch eigene
PixelLab-Breitformate (792×300, Saat 11, `/v2/generate-image-v2`) ersetzt. Damit sind alle **18** Varianten aus
Abschnitt 2 erledigt (Batch 1: 6, Batch 2: 12). Je Bild laut Auftrags-Job **25 Gen.**

| Disziplin / Variante | Roh | Sichtprüfung (Vorher/Nachher unter `docs/design/pixellab-nur-neue-assets-17-11/`) | Gen. |
|---|---|---|---:|
| Wettessen Nachtmarkt | `kulisse_wettessen_nachtmarkt` | `welle-a-wettessen-nachtmarkt-*.jpg` | 25 |
| Wettessen Festzelt (bierzelt) | `kulisse_wettessen_bierzelt` | `welle-a-wettessen-bierzelt-*.jpg` | 25 |
| Gewichtheben Hafen | `kulisse_gewichtheben_hafen` | `welle-a-gewichtheben-hafen-*.jpg` | 25 |
| Gewichtheben Oase | `kulisse_gewichtheben_oase` | `welle-a-gewichtheben-oase-*.jpg` | 25 |
| Fechten Schlosshof | `kulisse_fechten_schlosshof` | `welle-a-fechten-schlosshof-*.jpg` | 25 + 25 (erste Fassung verworfen: graue Leerfarbe statt Himmel) |
| Showcase Festival | `kulisse_showcase_festival` | `welle-a-showcase-festival-*.jpg` | 25 |
| Showcase Zirkus | `kulisse_showcase_zirkus` | `welle-a-showcase-zirkus-*.jpg` | 25 |
| Battlefield Wüstenruine | `kulisse_battlefield_wuestenruine` | `welle-a-battlefield-wuestenruine-*.jpg` | 25 |
| Speed-Schach Park | `kulisse_speed_schach_park` | `welle-a-speed-schach-park-*.jpg` | 25 |
| Speed-Schach Zug (Speisewagen) | `kulisse_speed_schach_zug` | `welle-a-speed-schach-zug-*.jpg` | 25 |
| Climbing Fels | `kulisse_climbing_fels` | `welle-a-climbing-fels-*.jpg` (auch `-nachher-spaet`: Wand mitgescrollt) | 25 |
| Climbing Eis | `kulisse_climbing_eis` | `welle-a-climbing-eis-*.jpg` | 25 |
| **Summe Batch 2** | | | **325** (13 Aufträge) |

**Entscheidungen im Bau.**

- **Speed-Schach**: das PixelLab-Original `turniersaal` bleibt unbenutzt (Chris am 17.11.: nicht nutzbar). Statt
  dessen sind `park` und `zug` neu eingeordnet, also eigene Breitformate, kein Rückgriff auf das Original.
- **Wettessen**: Chassis bleibt `buehne` (jahrmarkt bleibt der Zuschnitt der Original-Szene). Nur Nachtmarkt und
  Festzelt kommen als fertige Quelle (`QUELLE_VARIANTEN` in `baue-arena-kulissen.py`, `PL_NUR` in
  `baue-kulisse-buehnen.py`). Die Wimpelkette und das Schild zeichnet weiter der Motor, deshalb steht keine im Prompt.
- **Battlefield Wüstenruine**: nur Untergrund und Ruinenrand, keine Wege und keine Bauten in der Mitte. Die drei Orte
  (x = MID, y = 85/235/385), die Ringe und die Masten zeichnet der Motor, `baue-kulisse-battlefield.py` überspringt die
  Variante, wenn das Rohbild vorliegt.
- **Climbing**: die Wand scrollt mit der Kamera, deshalb ist aus dem Breitformat dieselbe senkrecht nahtlose Kachel gebaut
  wie bisher (obere Hälfte plus gespiegelte Kopie). Beide Bilder sind reine Wandfläche ohne Griffe, Himmel oder Boden.
  `wand` (Halle) bleibt das PixelLab-Original der Asset-Runde.
- **Leerfarbe von PixelLab (neu gefunden).** Manche Breitformate haben einen Randstreifen aus reinem Weiß
  (Nachtmarkt 38 px links/rechts) oder aus dem Neutralgrau (177,176,178) (Zug: 26 px oben, 28 px unten). Weiß wird durch
  gespiegelte Nachbarpixel ersetzt, graue Letterbox weggeschnitten (`_weisse_raender_fuellen()` in
  `baue-kulisse-buehnen.py`). **Das behebt einen Fehler aus Batch 1:** `tennis/dach.jpg` trug seit Batch 1 je 20 px weißen
  Rand links und rechts (im Bild `welle-a-tennis-dach-nachher.jpg` als heller Balken sichtbar). Das Bild ist mit dem
  Batch-2-Bau neu erzeugt. Alle anderen Batch-1-Bilder haben keinen Randstreifen (nachgemessen, bit-identisch).

**Gesamt Welle A:** Batch 1 (6 Bilder, 150 Gen.) + Batch 2 (13 Aufträge, 325 Gen.) = 475 Gen. Nullkosten-Posten
(Fegearm, Teller, Pfahl, Takeshi-Schlamm) und Welle B/C sind davon unberührt und weiter offen.

**Football (Strang) — nicht geändert.** Der Auftrag „Football-Strang neu ordnen wie in diesem Dokument beschrieben“ ist
hier nicht beschrieben: der Audit nennt für Football nur die Kulisse `strand` (Abschnitt 2/3, 25 Gen.), und die ist seit
Batch 1 erledigt. Es gibt keine Reihenfolge, die neu zu ordnen wäre; `football/feld` bleibt das PixelLab-Original der
Asset-Runde, `football/strand` die neue Kulisse, Reihenfolge in `battle-mode.kulissen.js` unverändert (feld, strand). Ein
Umbau auf Verdacht würde den Wertungs-Fingerabdruck nicht verändern, aber auch nichts nachweisbar verbessern. Falls
Chris etwas Bestimmtes meinte (z. B. `football_becken` verdrahten, Strand als Standard-Kulisse oder Football-Strang im
Sinne von „Strand-Variante“), braucht der nächste Agent den genauen Satz.
