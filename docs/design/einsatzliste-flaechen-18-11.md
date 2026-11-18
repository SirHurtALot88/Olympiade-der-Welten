# Einsatzliste: ruhige Disziplin-Flächen (alle 20, 18.11.)

Auftrag Chris, 18.11.: „Kannst du für die Einsatzliste wie im Mockup auch jeweils je nach Disziplin einen
einfachen passenden Background, der nicht aufdringlich ist, für die Disziplin generieren?“ Gemeint ist die
Feldfläche in der Mitte der modernen Einsatzliste (`EinsatzlisteModern.tsx`, `.elm-feld`), auf der die
Platzkarten liegen. Heute ist sie für alle Disziplinen einfarbig dunkel.

Nach der Stilprobe (drei Disziplinen) hat Chris am 18.11. freigegeben: „Die übrigen Flächen bitte
generieren, Fable bekommt die Freigabe“.

**Stand: alle 20 Flächen liegen vor, nichts ist in die App eingebaut.** Den Einbau macht ein Bau-Agent.

## Bilder

- **Übersicht aller 20 in App-Behandlung:** `docs/design/einsatzliste-flaechen-18-11/uebersicht-alle-20.png`
  (60 % Abdunklung auf UI-Grund, Vignette, Platzkarten-Attrappen).
- Vergleich neu gegen vorhandenen Arenaboden (aus der Stilprobe, Eiskunstlauf und Battlefield mit der
  jetzt gewählten Fläche neu gebaut): `vergleich-eiskunstlauf.png`, `vergleich-battlefield.png`,
  `vergleich-wettessen.png` im selben Ordner.
- Die Flächen: `public/sprites/einsatzliste-flaechen/<disziplin>.jpg` (1344×768, 76–172 KB), Dateiname =
  Disziplin-ID (`takeshis-castle.jpg`, `i-spy.jpg`, `mini-dm.jpg`, `speed-schach.jpg`, `time-trial.jpg`).
  Herkunft und Protokoll aller 35 Aufträge: `public/sprites/einsatzliste-flaechen/quellen.json`.

## Stil-Regeln

1. **Reine Draufsicht, ein Material, bildfüllend.** Die Spielfläche reicht von Rand zu Rand; kein
   Drumherum (Tribüne, Wand, Möbel). Die vorhandenen Arenaböden sind Schrägsichten mit Publikum, Banden-
   werbung und Schrift — unter Karten liest man das als Unruhe.
2. **Keine Figuren, keine Schrift, keine Logos, keine Requisiten.** Nur Material und Markierung.
3. **Ein bis zwei disziplintypische Zeichen**, dünn und kontrastarm. Das Zeichen trägt die
   Wiedererkennung, nicht die Farbe.
4. **Gedeckte Farben, wenig Kontrast, niedriger Detailgrad** (`detail: low detail`, `outline: lineless`).
   Die Fläche darf hell sein; die App dunkelt ab.
5. **Behandlung in der App (Empfehlung für den Einbau):** `background-size: cover`, darüber
   `rgba(10,14,22,.60)` und eine radiale Vignette zum Rand (Rand ~85 % dunkel), `image-rendering: pixelated`.
   Karten behalten ihren deckenden dunklen Grund; der Gold-Akzent bleibt die einzige kräftige Farbe.
6. **Ein Bild je Disziplin**, nicht je Arena-Variante.
7. **Nur Material, Linien per CSS/SVG** bei Basketball, Tennis, Hockey, Football: die Bilder zeigen
   Parkett, Sand, Eis mit Bande, Mähstreifen — ohne Spielfeldlinien. pixen hält Symmetrie und exakte
   Linien nicht (Football-Versuch 1 malte Pseudo-Ziffern und Fußballbögen).

## Die 20 Flächen

| Disziplin | Datei | Was man sieht | Urteil |
|---|---|---|---|
| basketball | `basketball.jpg` | Ahorn-Parkett, keine Linien | gut (Linien per CSS) |
| battlefield | `battlefield.jpg` | wilde Wiese, Trampelpfade, Steine, Büsche am Rand | gut, etwas unruhiger als der Rest |
| breaking | `breaking.jpg` | Kellerbeton, Abfluss, Risse, Rostflecken | gut |
| climbing | `climbing.jpg` | graue Boulderwand mit bunten Griffen | gut |
| eiskunstlauf | `eiskunstlauf.jpg` | ganze Eisbahn mit Bande, Kufenschleifen, keine Kreise/Linien | gut |
| fechten | `fechten.jpg` | Metallbahn quer über dunklen Hallenboden | brauchbar, sehr dunkel |
| football | `football.jpg` | breite Mähstreifen, keine Linien | gut (Linien per CSS) |
| gewichtheben | `gewichtheben.jpg` | Holzplattformen zwischen Gummimatten | schwach: liest sich als Holz/Gummi-Streifen |
| hockey | `hockey.jpg` | weißes Eis mit Kratzern, heller Rand, keine Linien | brauchbar; braucht die CSS-Linien |
| i-spy | `i-spy.jpg` | Tempelplatten, Ornamentkreis, Moos | gut |
| mini-dm | `mini-dm.jpg` | zwei Sandgruben mit Kreidezeichen | brauchbar; Kreide recht hell, zwei statt einer Grube |
| showcase | `showcase.jpg` | dunkle Bühnenbretter, zwei Lichtkegel | gut, sehr dezent |
| speed-schach | `speed-schach.jpg` | Schachbrettpflaster in zwei Grautönen | gut |
| spurt | `spurt.jpg` | rote Tartanbahn, Bahnlinien (senkrecht) | gut |
| staffel | `staffel.jpg` | graue Bahn, Bahnlinien, Wechselmarke | schwach: grau statt blaugrau, nahe an Time-Trial |
| takeshis-castle | `takeshis-castle.jpg` | Schlammgrube, zwei Holzstege, Pfütze, Fußspuren | gut, etwas unruhiger |
| tdm | `tdm.jpg` | Betonplatten, je ein blaues und rotes Feld | schwach: Zonen klein und außermittig |
| tennis | `tennis.jpg` | roter Sand, keine Linien | gut (Linien per CSS) |
| time-trial | `time-trial.jpg` | Asphalt mit gestricheltem Mittelstreifen | gut |
| wettessen | `wettessen.jpg` | Holztisch mit Läufer | gut (aus der Stilprobe) |

Die bisherige Battlefield-Fläche (Rasen mit Kreidekreisen, „Fußballplatz“) und die Eiskunstlauf-Fläche mit
Bully-Kreis aus der Stilprobe sind ersetzt; sie stehen im Commit `cdfbf718`.

## Technik und Kosten

- Endpunkt `POST /v2/create-image-pixen`, 672×384, `view: "high top-down"`, `outline: "lineless"`,
  `detail: "low detail"`, `no_background: false`. **1 Generation je Bild** (aus `usage.generations`).
- Bau: Rohbild 2× NEAREST auf 1344×768, JPEG Qualität 80.
- Bestellung: Einmal-Client ohne POST-Wiederholung, je Auftrag unter `flock /tmp/pixellab-bestell.lock`,
  `/balance` vor und nach jedem Auftrag.
- **Stilprobe: 5 Generationen** (866,74 → 861,74). **Hauptrunde: 30 Generationen** (Obergrenze 45;
  861,74 → 831,74). Zusammen 35 für 20 Flächen.

Hauptrunde, Saat 21 = erster Versuch, 22/23 = Nachversuche:

| Disziplin | Versuche | gewählt | Grund für Nachversuch |
|---|---:|---|---|
| eiskunstlauf | 2 | Saat 23 | Saat 21: Bahn links angeschnitten, Tribüne im Bild |
| battlefield | 1 | Saat 21 | — |
| basketball | 2 | Saat 22 | Saat 21: malte Feldlinien trotz „no lines“ |
| hockey | 2 | Saat 22 | Saat 21: volle Bemalung mit Bullykreisen, beige |
| football | 3 | Saat 23 | 21: Pseudo-Ziffern und Fußballbögen; 22: zu schmale, harte Streifen |
| fechten | 2 | Saat 22 | Saat 21: Bahn nur ein dünnes Geländer |
| climbing | 3 | Saat 23 | 21: rissige Erde statt Fels; 22: Lochplatte ohne Griffe |
| mini-dm | 2 | Saat 22 | Saat 21: zwei Gruben, sehr kontrastreich |
| gewichtheben | 2 | Saat 21 | Saat 22 schlechter (eine Plattform außermittig) |
| tdm | 2 | Saat 21 | Saat 22 schlechter (rot-blaue Streifen) |
| übrige 9 | je 1 | Saat 21 | — |

## Lehren für weitere Bestellungen

- „covers the entire image from the left edge to the right edge“ plus „landscape format“ ist nötig,
  sonst malt das Modell die Fläche als Objekt in eine Umgebung.
- **Verneinungen ziehen an:** „no lines, no court markings“ lieferte Linien. Besser den Sportnamen
  weglassen und das Material positiv beschreiben („plain wooden parquet floor … nothing else on it“).
- Der Sportname bringt die ganze Bemalung mit (hockey, football). Für Material-Flächen vermeiden; für
  Flächen, die ein Zeichen brauchen (bouldering wall, running track), hilft er.
- Laufrichtung von Linien/Streifen lässt sich nicht steuern (Bahnlinien kamen senkrecht trotz „horizontal“).
- Zahlwörter („one single pit“) hält pixen nicht zuverlässig.

## Offen für den Einbau

- CSS/SVG-Linien für Basketball, Tennis, Hockey, Football.
- Schwache Kandidaten (gewichtheben, staffel, tdm) können später mit je 1–3 Generationen nachgebessert
  werden; sie sind unter der Abdunklung unauffällig, nur wenig eindeutig.
- Das Bauskript (PIL) liegt nicht im Repo; die Behandlung steht in Regel 5 und unter „Technik“.
