# PixelLab-Figuren für den D-P-Kader (21.11.)

**Freigabe:** Chris am 21.11., wörtlich: „mein Kader sollte auf jeden Fall immer alle Figuren generiert
haben + die Basis-Animationen“. Gilt nur für Spieler in Chris' eigenem Kader (Team D-P „Death Peaches“,
Save `new-game-1795114260527-nzr0z9`) und nur für die Basis-Animationen (walk/angriff/treffer/tod, je
Süd/Ost/Nord, 16/16/8/16 Aktionsbilder). Keine weiteren Figuren, keine Zusatzanimationen.

Der Kader hat zehn Spieler (aus dem live-save-Abbild gelesen). Vier hatten schon eine Figur (Maru,
Brightpaw, Lilithara, Aeon Flux), sechs fehlten und sind jetzt da.

## Ergebnis

| Figur | Spieler-ID | Klasse / Rasse | PixelLab-ID | Basis | Animationen | Summe |
|---|---|---|---|---:|---:|---:|
| Zyra | player-0933-zyra | Charger / Demon | `97d7b874-e982-4c88-98b4-a7de62e6f37a` | 10 | 18 | 28 |
| Conan | player-1188-conan | Mage / Human | `d4dd2601-c146-4c0d-b837-c61ce6d848ed` | 10 | 12 | 22 |
| Queen Loriana | player-1534-queen-loriana | Bard / Human | `2e9162d5-6839-42b3-94e7-9959ee63e54c` | 10 | 12 | 22 |
| Zynara | player-1009-zynara | Mage / Lizard | `817747d0-ba37-4975-85e7-263a44c40009` | 10 | 18 | 28 |
| Emilia | player-0645-emilia | Rogue / Demon | `4beb6dd7-3da6-4916-a8f6-28c65edc2631` | 10 | 12 | 22 |
| Amarie | player-0919-amarie | Charger / Divine | `1c716dad-1b5e-42b9-b7cc-d2732037a87e` | 10 | 15 | 25 |
| **Summe** | | | | **60** | **87** | **147** |

Guthaben vorher **489,54**, nachher **342,54** Generationen (Differenz 147,0, deckt sich mit der Summe
der Job-Antworten). Reserve 150 unberührt. Kein Nachkauf, keine Wiederholung einer Bestellung.

**Über der Schätzung:** erwartet waren etwa 19 je Figur (115 gesamt), geworden sind es 22 bis 28. Die
Basis kostet fest 10. Eine Animationsrichtung kostet 1 Generation, solange der Animations-Canvas klein
bleibt, und 2, wenn PixelLab ihn für ausladende Figuren vergrößert (Zyras Axt, Zynaras Schlangenleib,
Amaries Flügel und Speer). Das steht erst in der Job-Antwort, nicht vorher.

**Herkunft der Zahlen:** `usage.generations` aus `GET /background-jobs/<job>` je Job (die POST-Antwort
selbst trägt `usage: null`). Ausnahme: Zyras zwölf Animations-Jobs, deren Job-IDs das Skript beim ersten
Lauf noch nicht ausgab; dort stammt die 18 aus der Kontodifferenz (479,54 auf 461,54) unter gehaltenem
`flock /tmp/pixellab-bestell.lock`. Danach gibt `scripts/figuren-erzeuge-basis-charakter.py` die Job-IDs
je Animationsgruppe mit aus.

## Weg

Kanonischer Weg wie bei allen Bestandsfiguren: `POST /create-character-pro`, `create_from_concept` mit dem
Porträt (`public/portraits/<slug>.jpg`), 80×80, `template_id: custom`, `view: low top-down`; danach
`POST /characters/animations` (pixminimax) für die vier Kanon-Gruppen. Beschreibungen, Subjekte, Angriffs-
und Tod-Texte stehen in `figuren-kader-dp-21-11/subjekte.json`. Jede Figur trägt in PixelLab ihren Slug
als Tag. Reihenfolge: erst Zyra komplett als Stilprobe, angesehen, dann die fünf Basen, angesehen, dann
deren Animationen. Jeder POST ging genau einmal raus, alles unter dem Bestell-Lock.

```sh
PIXELLAB_API_KEY=dummy flock /tmp/pixellab-bestell.lock python3 -I scripts/figuren-erzeuge-basis-charakter.py docs/design/figuren-kader-dp-21-11/subjekte.json zyra --nur-basis --tag zyra
PIXELLAB_API_KEY=dummy flock /tmp/pixellab-bestell.lock python3 -I scripts/figuren-erzeuge-basis-charakter.py docs/design/figuren-kader-dp-21-11/subjekte.json zyra --character-id <cid> --warte-animationen
PIXELLAB_API_KEY=dummy python3 -I scripts/figuren-sprites-export.py --nur zyra conan queen-loriana zynara emilia amarie
node scripts/baue-arena-figuren.mjs
```

Die 24 neuen Animationsgruppen stehen mit ihrer Art in `data/generated/figuren-sprites-animationsarten.json`
(Quelle im Index deshalb `gespeichert`, keine Schätzung).

## Tod-Animationen (zum Charakter, kein Umkippen)

- **Zyra:** wird niedergehauen, lässt die Axt fallen, Blut aus der Brust, bricht in einer Blutlache zusammen.
- **Conan:** kleiner Pfeil in den Hals, wird schwindlig, die Brille rutscht, sackt bewusstlos zusammen
  (bewusst unblutig, er ist ein Kind).
- **Queen Loriana:** durchbohrt, stützt sich auf ein in den Boden gerammtes Schwert, sinkt aufs Knie, kippt zur Seite.
- **Zynara:** das violette Leuchten erlischt, die Haube fällt zusammen, sie sinkt in ihre eigenen Schlangenwindungen.
- **Emilia:** ihr eigenes Feuer wendet sich gegen sie, die Flügel verbrennen, zurück bleibt ein glühender Rest.
- **Amarie:** Stich durch die Brust, die Flügel zucken und falten sich, sie bricht unter den Flügeln zusammen.

## Bilder

- Kontaktbögen (Grundposen, dann walk/angriff/treffer/tod je Süd/Ost/Nord, bei 17 Bildern jedes zweite):
  `figuren-kader-dp-21-11/<slug>-bogen.png` für zyra, conan, queen-loriana, zynara, emilia, amarie.
- Arena mit dem D-P-Kader bei 1920×1080 (`scripts/screenshot-kader-figuren.mjs`, Kader per
  `window.__arena.kaderSetzen()`): `gewichtheben-2-lauf.png`, `staffel-2-lauf.png`, `tdm-2-lauf.png`, dazu
  jeweils `*-3-arena.png` (nur die Spielfläche). `figurenStand()` meldet in allen drei Disziplinen
  `ohneGrundpose: []` und `ohneAlleBilder: []`. Die Kopfzeile zeigt den Standard-Teamnamen der Mockup-Seite,
  weil das Skript nur den Kader hereinreicht, keine Team-Metadaten. Der Gegner (eine Kaderfamilien-Variante)
  hat teils keine Figuren, das sind die Glatzköpfe rechts.

## Auffälligkeiten

- **Nord-Animationen drehen teils nach vorn.** Bekannte pixminimax-Schwäche: in einzelnen Nord-Streifen
  zeigt die Figur mitten in der Bewegung die Vorderseite statt des Rückens. Betroffen: Queen Loriana
  (walk, angriff, tod), Conan (treffer, tod), Zynara (walk, angriff, treffer, tod), Amarie (angriff, tod),
  Emilia kaum, Zyra (tod). Süd und Ost sind sauber. Nicht nachbestellt (kein Budget dafür freigegeben, jede
  Nord-Richtung kostet 1 bis 2 Generationen).
- **Amarie** trägt in der Süd-Grundpose zwei Speere (einen aufrecht, einen gesenkt), bestellt war einer.
- **Conan, Angriff Süd:** der Strahl geht nach unten aus dem Bild statt nach vorn.
- **Zynara, Treffer Süd:** ein kurzer roter Hieb-Effekt im zweiten Bild.
- **Animations-Canvas größer als die Grundpose** (84 bis 104 px statt 80) wie bei den Bestandsfiguren
  (z. B. Maru 84); der Motor rechnet die Bildbreite aus Streifenbreite durch Bildzahl.
- **Trainingshalle nicht geprüft:** die Ansicht hängt in der App hinter Login und Spielstand, das Mockup
  `public/mockups/training-modern-18-11.html` hat fest verdrahtete Figuren.

## Prüfung

- `env -u NODE_OPTIONS node scripts/pruefe-wertung-fingerabdruck.mjs --node`: **GESAMT eaafed96150e
  (75 Einträge)**, unverändert (gemessen mit allen sechs neuen Figuren im Index).
- `npx vitest run tests/arena-pixel-figuren.test.ts tests/battlefield-aufklaerungsnebel-bug69.test.ts`: 21 von 21 grün.
- Alle 96 exportierten PNGs geöffnet und vollständig dekodiert, beide JSON-Dateien gültig (nach dem
  Platten-Engpass um 16:40 ausdrücklich geprüft).
