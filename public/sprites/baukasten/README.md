# Sprite-Baukasten — die 77 Blätter als Dateien

Diese Blätter lagen bisher nur als base64-Zeichenketten in zwei HTML-Dokumenten: im
Artefakt „Sprite-Baukasten" und in `public/mockups/battle-mode.html`. Das ist kein guter
Aufbewahrungsort — ein Blatt, das man nicht abspeichert, ist beim nächsten Mal ein Blatt,
das man neu suchen muss. Hier liegen sie als das, was sie sind: PNG-Dateien.

`index.json` nennt zu jedem Blatt Breite, Höhe, Bildzahl und Richtungszahl.

## Aufbau

Alle Blätter sind Rasterbilder im LPC-Format: eine Zelle ist **64 × 64** Pixel, die
Spalten sind die Einzelbilder der Bewegung, die Zeilen die vier Blickrichtungen
(oben, links, unten, rechts). Waffen brauchen mehr Platz und benutzen breitere Zellen —
128 beim Schwert, 192 bei Axt und Stab — und werden entsprechend versetzt gezeichnet.

| Bilder | Bewegung | Blätter |
|---|---|---|
| 6 | Schlag (`slash`) | 49 |
| 7 | Zauber (`spellcast`) | 8 |
| 8 | Stoß (`thrust`) | 4 |
| 9 | Gang (`walk`) | 4 |
| 13 | Schuss (`shoot`) | 6 |

## Was das bedeutet — und wo die Lücke ist

Den **vollen Satz aus Gang, Schlag und Schuss** haben nur vier Ebenen:

| Ebene | Gang | Schlag | Schuss |
|---|---|---|---|
| Körper | `k_walk` | `k_slash` | `k_shoot` |
| Kopf | `g_walk` | `g_slash` | `g_shoot` |
| Rüstung | `r_walk` | `r_slash` | `r_shoot` |
| Haar | `h_walk` | `h_slash` | `h_shoot` |

Alles andere — Krone, Bart, Schulterstücke, Arm- und Beinschienen, Stiefel, Umhang,
Hörnerhelm, Visier, Schild, Doppelaxt und die zwanzig Köpfe — gibt es **nur als
Schlag-Blatt**. Der Baukasten war für stehende Posen gebaut, nicht für Animation.

### Die Lücke ist geschlossen (23.08.)

Der LPC-Satz liegt nicht hinter der Netzsperre — er liegt auf **GitHub**, und GitHub ist
offen. Aus `LiberatedPixelCup/universal-lpc-spritesheet-character-generator` sind **209
Blätter** dazugekommen: `walk`, `run`, `shoot`, `hurt` und `idle` für alle 45 Ebenen, die
sich eindeutig zuordnen ließen.

Die Zuordnung ist gemessen, nicht geraten. Verglichen wurde die **Alpha-Maske** — die
überlebt das Umfärben, die Farben nicht. Alle 45 Ebenen sind darüber hinaus **byte-identisch**
mit ihrer LPC-Quelle; `quellen.json` nennt zu jeder Ebene den Pfad im LPC-Satz.

Damit fällt die Teilung „stehende Figur aus dem vollen Satz, laufender Kämpfer aus dem
animierbaren Kern" weg. Auch die `hurt`-Blätter für gefallene Kämpfer sind jetzt da.

### Weibliche Körper sind da (24.08.)

Zwölf neue Blätter aus derselben Quelle, byte-identisch übernommen: `kw_*` ist der
**weibliche Körper** (`body/bodies/female/`), `gw_*` der **weibliche Menschenkopf**
(`head/heads/human/female/`), jeweils für `walk`, `run`, `idle`, `hurt`, `shoot`, `slash`.

Drei Dinge sind nachgemessen, nicht vermutet:

- **Gleiche Blattmaße** wie die männlichen Gegenstücke in allen sechs Bewegungen —
  gleiche Zellen, gleiche Bildzahlen, ein Drop-in-Ersatz für `k_*`/`g_*`.
- **Gleiche 6-Farben-Basisrampe** wie der männliche Körper — das Umfärben zur Laufzeit
  funktioniert unverändert.
- **Die Tierköpfe passen auch auf den weiblichen Körper.** Die `sheet_definitions` des
  LPC-Generators erklären alle `adult`-Köpfe (Alien, Wolf, Echse, …) ausdrücklich für
  `female` gültig, mit demselben Blatt und denselben Offsets; Sichtprüfung bestätigt.
  Nur der Menschenkopf hat ein eigenes weibliches Blatt — dafür ist `gw_*` da.

Einbau-Idee (rückwärtskompatibel): ein optionales Feld `geschlecht` am Bauplan; fehlt es,
werden wie bisher `k_*`/`g_*` gezeichnet, steht dort `"w"`, greifen `kw_*`/`gw_*`.
Die 124 bestehenden Rezepte bleiben unangetastet gültig. Grenze: das männliche Haar
`h_*` (`flat_top_fade/male`) hat **kein** weibliches Pendant im Satz; die `adult`-Frisuren
(`haar_lang`, `haar_mop`, `haar_dread`) passen dagegen auf beide Körper.

**Was weiterhin fehlt — und warum es nicht nachzuholen ist.** Sieben Ebenen haben kein
`run`. Nachgemessen im gesamten LPC-Satz, nicht nur in unserem Ausschnitt:

| Ebene | Lage im LPC-Satz |
|---|---|
| Arme, Beine (Plattenrüstung) | `run` gibt es unter `arms/` und `legs/` **nur für Stoff und Kleinteile** — Armschienen, Handschuhe, Ringe, Hosen. Für **Plattenrüstung in keiner Variante**, weder `male` noch `thin` |
| Umhang, Fetzen | die Kategorie `cape/` hat **null** `run`-Blätter, über alle Umhänge hinweg |
| Haar | unser `h_*` stammt aus `hair/flat_top_fade/male/`, das kein `run` führt. Der Ordner `adult/` daneben hat eines — aber es ist **anderes Bild** (byte-verschieden in jeder Bewegung), also kein Ersatz |
| **Waffen** | **keine einzige Waffe im ganzen Satz** hat ein `run`-Blatt, null von allen |

Das ist kein Loch im Download, sondern der LPC-Standard: getragene Platten, Umhänge und
Waffen werden nur zu `walk` und den Angriffen geführt. Draco kann mit Doppelaxt stehen und
gehen, nicht rennen. Wer das ändern will, muss zeichnen — oder im Sprint `walk` fahren.

## Umfärben

Jede Ebene liegt **einmal** vor und wird zur Laufzeit umgefärbt: sechs Farben werden
gegen sechs andere getauscht. Jede Kategorie hat dabei ihre **eigene Basisrampe** —
Körper liegt im Ton `light`, Haar in `orange`, Metall in `steel`, Stoff in seinem ersten
Ton. Wer überall die Körperrampe anlegt, färbt Haar und Metall nie um; es sieht dann nur
zufällig passend aus.

| Kategorie | Töne |
|---|---|
| Haut | 7 |
| Haar | 26 |
| Metall | 8 |
| Stoff | 24 |

Ein grüner Ork und eine blaue Echse sind dieselbe Datei.

## Herkunft und Lizenz

Liberated Pixel Cup. Urheber laut `CREDITS.csv` im Repo: bluecarrot16, JaidynReiman,
BenCreating, Evert, ElizaWy, TheraHedwig, MuffinElZangano, Durrani, Johannes Sjölund,
Stephen Challener. Lizenzen OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 — Copyleft, dessen
Pflichten erst bei Weitergabe greifen; dies ist ein privates, nicht verkauftes Spiel.
