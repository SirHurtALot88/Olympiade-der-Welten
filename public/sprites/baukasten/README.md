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

**Was weiterhin fehlt:** `run` für sieben Ebenen (Arme, Beine, Umhang, Fetzen, Haar) — und
für **Waffen überhaupt**. Keine einzige Waffe im LPC-Satz hat ein `run`-Blatt, null von
allen; Waffen werden dort nur zu `walk` und den Angriffen geführt. Das ist kein Loch im
Download, sondern der Standard. Draco kann mit Doppelaxt stehen und gehen, nicht rennen.

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
