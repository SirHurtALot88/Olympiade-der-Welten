# Basketball-Review 18.11.: unabhängiger Prüfbogen, Sofort-Bau, Bauplan bis über 90 %

Auftrag: Basketball als Benchmark-Disziplin unabhängig im Spiel anschauen, den Bogen aus
`docs/design/benchmark-basketball-17-11.md` neu bewerten (jede Zahl mit Beleg), einen Bauplan bis über 90 %
in jeder Kategorie schreiben. Nachtrag von Chris (über den Koordinator): **HUD, Ton, Kulisse, Kamera und
Effekte direkt bauen**, bis jede dieser fünf Kategorien nach ehrlicher Bewertung über 90 % liegt. Die
Figuren-Animation bleibt außen vor (keine neuen Posen ohne Freigabe).

Bilder: `docs/design/basketball-review-18-11/` (1920 breit, 256 Farben). Video: `…/viertel-1920.webm`.

## 0. Kurzfassung

| # | Kategorie | Gewicht | Bogen 17.11. | **Review vorher** | **nachher (dieser PR)** |
|---|---|---:|---:|---:|---:|
| 1 | Layout / Spielfeld | 15 | 92 | **88** | 90 |
| 2 | Spielgerät & Ziel | 10 | 92 | **90** | 90 |
| 3 | Bewegung / Spacing | 20 | 91 | **84** | 84 |
| 4 | Regeln & Wertung sichtbar | 15 | 92 | **85** | **91** |
| 5 | Kamera | 10 | 85 | **76** | **91** |
| 6 | HUD / Live-Stand | 10 | 80 | **74** | **91** |
| 7 | Kulisse | 5 | 85 | **72** | **91** |
| 8 | Effekte | 5 | 88 | **84** | **91** |
| 9 | Ton | 5 | 85 | **76** | **91** |
| 10 | Figuren-Animation | 5 | 60 | **55** | 55 |
| | **Gesamt (gewichtet)** | 100 | ≈ 87 | **≈ 81** | **≈ 88** |

Das alte Dokument war in sieben von zehn Zeilen zu optimistisch, am deutlichsten bei Kamera (Figuren
werden angeschnitten), Kulisse (der Street-Court war eine flache blaue Fläche, also genau der „alte" Look,
den Chris am 17.11. ausgeschlossen hat) und Regeln (die Schussuhr stand fast immer rot und tickte in einer
anderen Zeitbasis als die Spieluhr). Die fünf Bau-Kategorien liegen jetzt bei 91. Unter 90 bleiben
Bewegung (84, wertungsrelevant) und Figuren-Animation (55, nur mit neuen Posen über 70).

Abnahme dieses PRs (reine Anzeige):

| Abnahme | Schranke | Ergebnis |
|---|---|---|
| Wertungs-Fingerabdruck (`node scripts/pruefe-wertung-fingerabdruck.mjs`, Chromium) | unverändert | **GESAMT ce8fcef66028 (75 Einträge)**, vorher wie nachher |
| Node-Vorabgleich derselben 75 Einträge (Motor im `node:vm`, alt gegen neu) | 75/75 gleich | 75/75 gleich, `GESAMT ce8fcef66028` |
| rho je Spiel / Pp | ≥ 0,75 / ≤ 25 | unberührt (Fingerabdruck gleich): 0,862 / 7,5 · 13,4 laut Bogen 17.11. |
| Gezeigt = gebucht (`__arena.diagGezeigtGebucht(3)`) | 0 Abweichungen | **0 von 309 Würfen**, vorher wie nachher |
| PixelLab | Reserve 150 bleibt | **35 Generationen** (Publikum 10, Street-Court-Remake 25), Guthaben 831,7 → 796,7 |

## 1. Wie geprüft wurde

**Mockup-Arena (Motor = Spiel).** `public/mockups/battle-mode.html` ist dieselbe Hülle, die der Host
(`app/foundation/battle-arena/FoundationBattleArenaHost.tsx`) in die App einhängt (kein iframe; gleiche
Engine, gleiches CSS). Vorher-Läufe liefen mit den Motor-Dateien von `main` (Kopie, per HTTP an Stelle der
Arbeitsdateien ausgeliefert), nachher mit diesem Branch, beide unter `flock /tmp/oly-aufnahme.lock`.

- Ein Viertel bei Tempo 1× mit Video und Bildfolge alle 3 s (1920 × 1080), dazu 2560 × 1440 (DPR 1,5) und
  1710 × 1112 (DPR 2). Je Bild die Simulationspositionen aller zwölf Figuren (rAF-Probe) und nachher der
  Kamera-Ausschnitt.
- UX-Probe: Leertaste, Tasten L/B/1/2/3/F/T/K/Esc, Klick auf Spielerleiste und Figur, Tempo 4×, Viertelende,
  Spielende; Zähler für jeden abgespielten Ton (Datei und WebAudio-Knoten).
- Feste Szenen (`__arena.szeneFeldspiel`): Überblick, Aufbau, Dreier, Dunk, Ringtreffer, Block, Steal,
  Rebound, Ecken-Wurf, je Kulisse vorher/nachher.

**In der App** (Spieltagsablauf mit Vollbild-Bühne #1578, `/foundation` → Battle Arena): nicht selbst
gebaut. Die Platte hatte bei Beginn des Baus 2,1 GB frei, ein Produktions-Build braucht mehr, und der
gemeinsame Aufnahme-Lock war über Stunden belegt. Vorbereitet und getestet ist der Weg dahin:
`scripts/baue-basketball-spieltag-save.ts` baut einen Test-Spielstand mit Basketball an Spieltag 1 (echter
Produktionspfad, nur in eine Kopie unter `/tmp`), `scratchpad/bbrev/app-review.mjs` nimmt Spieltag
(Leertaste, Esc, Quick-Sim, Ende, Weiter) und Battle Arena auf. Für das Bild in der App gelten bis dahin die
Aufnahmen aus #1578 (`docs/design/arena-vollbild-18-11/*-basketball-*`) und #1588
(`docs/design/app-rahmen-bau-18-11/`); was dort sichtbar ist, steht in Abschnitt 2.6. **Offener Prüfpunkt
für die Hauptsitzung:** einmal `/foundation?view=matchdayArena` mit dem Test-Spielstand bei 2560 und 1920
ansehen, bevor dieser PR gemergt wird.

**Ton** ist nicht gehört, sondern nach Bestand bewertet: welches Ereignis welchen Klang auslöst (Code und
Zähler aus der UX-Probe). Das ist die prüfbare Seite des Kriteriums „jedes Ereignis klingt“; ob es gut klingt,
muss Chris hören.

## 2. Befunde je Kategorie (vorher), mit Beleg

### 2.1 Layout / Spielfeld — 88 (Bogen: 92)

FIBA-Linien stimmen, kein Spieler außerhalb der Linien (Bogen 7.9). Abzug: drei HUD-Teile liegen auf dem Feld
und decken Spieler: das „FOULS“-Kästchen in der Zone (`r01-vorher-spielfluss-1920.png`, links in der Zone über
Krolach), die Bedienleiste unten rechts (in jedem Bild) und das Live-Band oben. Ring weiterhin 0,5 m statt
1,575 m vor der Grundlinie.

### 2.2 Spielgerät & Ziel — 90 (92)

Korb in zwei Ebenen, Ringwackeln, Netz, Passarten: gut. Abzug für den fehlenden Ausleger (s. 2.1).

### 2.3 Bewegung / Spacing — 84 (91)

Gemessen (rAF-Probe, 2560, 34 fps): Richtungsumkehr 2,95 je 100 Schritte (0,1-s-Raster) — kein Zappeln;
keine Teleports (größter Schritt je Bild 26 px bei 66 ms Bildabstand, also Lauftempo). **Aber** sichtbare
Knäuel: in `r02-vorher-knaeuel-1920.png` (Q1 0:58) stehen neun von zwölf Figuren in einem Kreis von etwa 4 m
um die linke Zone, der Rest des Halbfelds ist leer. Der Bogen nennt selbst 12,1 % Klumpen-Anteil und 43 %
freie Anspielstation (nach R2 schlechter als R1). Das passt nicht zu 91.

### 2.4 Regeln & Wertung sichtbar — 85 (92)

- Gezeigt = gebucht: 0 von 309 Würfen falsch (3 Spiele). Endstand, Linescore, Boxscore, Dock und Wertungstabelle
  zeigen dieselben Zahlen (`r05-vorher-endstand-1920.png`).
- **Schussuhr:** `SCHUSSUHR_BASKETBALL` hat 8 Simulationssekunden und wurde roh angezeigt, die Spieluhr seit
  #1575 in Sendezeit (× 1,5). Folge: die Schussuhr stand meist rot mit Zehnteln („4.4“, „3.9“, „4.2“ in
  `r01`/`r02`/`s2`), und sie tickte langsamer als die Spieluhr daneben.
- Teamfouls nur als 9-px-Kästchen am Korb, Bonus nicht im Scorebug.
- „FÜHRUNGSWECHSEL!“ schon beim 2:0 (Einblender, erste Führung ist kein Wechsel) — offen, s. Plan.

### 2.5 Kamera — 76 (85)

Halbfeld-Zoom fest 1,32: der Ausschnitt ist 356 von 470 Feld-px hoch. Spieler an den Seitenlinien sind
angeschnitten oder fehlen (Ringrichter und Lava Golem in `r01`, Ralazar unter dem Live-Band). Keine Wahl der
Kamera (das Mockup vom 17.11. hat Überblick / Ball / Spieler). Kein Stoß beim Dunk.

### 2.6 HUD / Live-Stand — 74 (80)

- Schussuhr (s. 2.4), Teamfouls nicht im Scorebug.
- **Viertelpause:** Vollflächen-Tafel deckt 2 s lang das ganze Feld, darüber zusätzlich der Einblender
  „ZWISCHENSTAND!“ (zwei Schriftzüge übereinander, `r04-vorher-viertelpause-1920.png`); die letzte halbe
  Sekunde läuft das Spiel darunter schon weiter.
- **Endstand:** die Bedienleiste liegt über der Boxscore-Tabelle (`r05`, Zeile Ralazar verdeckt).
- Zwei Zeitachsen: der Ticker zeigt abgelaufene Zeit („1:25“), der Spielverlauf im Dock Restzeit („Q1 0:49“).
- Klick auf eine eigene Figur tut nichts (Mockup-Bauteil 9), Führungsverlauf fehlt (Bauteil 15).
- In der App (#1578-Bilder): doppelte Bedienung (Kopfzeile *und* Leiste auf dem Feld), bei 1920 × 1080 ist die
  Leinwand höhenbegrenzt (≈ 1360 von 1600 px Breite), weil Ticker und Wertungstabelle darunter Platz brauchen;
  die Tabelle zeigt dort nur zwei Zeilen.

### 2.7 Kulisse — 72 (85)

Parkett (PixelLab, Burgsaal mit Bannern und Fackeln) ist gut. Der Street-Court war eine einfarbige blaue Fläche
mit Zaun (`r06-vorher-streetcourt.png`) — das ist der Look, den Chris am 17.11. mit „REMAKE statt Übertragung“
ausgeschlossen hat. In keiner Kulisse sitzt Publikum; „Zuschauer reagieren nicht“ stand schon im alten Bogen.

### 2.8 Effekte — 84 (88)

Dunk-Funken, Dreier-Spur, Block-Stern, Staub, Ringwackeln vorhanden. Kein Steal-Moment (nur Schwebetext),
Dunk-Funken klein und nur als Linien.

### 2.9 Ton — 76 (85)

Zähler über ein ganzes Spiel (UX-Probe): `ballaufprall.mp3` 521-mal — auch für Steal, Fehlpass, Foul und Block;
`buzzer.mp3` auch für jeden Foulpfiff (klang wie ein Viertelende); kein Ton bei Pass, Steal oder verpasstem
Dreier; Publikum statisch außer im knappen 4. Viertel.

### 2.10 Figuren-Animation — 55 (60)

Im Bestand je Figur: Grundpose in vier Richtungen, `walk`, `angriff`, `treffer`, `tod` (je drei Richtungen).
Basketball nutzt `angriff` bei Ballannahme, sonst Squash/Stretch und Sprunghöhe. Keine Arme beim Wurf, kein
Dunk mit Arm am Ring, kein Block mit Armen oben; Ballführer und Verteidiger sehen gleich aus.

## 3. Was dieser PR baut (alles reine Anzeige)

| Kategorie | Maßnahme | Beleg |
|---|---|---|
| Regeln, HUD | **Schussuhr in Sendezeit** (`bkSchussuhrSendezeit`, × `zeitFaktor()`): dieselbe Zeitbasis wie die Spieluhr, max. 12, rot erst unter 5 | `p01-*` Scorebug „9“/„6“ statt „4.4“ |
| Regeln, HUD, Layout | **Teamfouls im Scorebug** (`HUD_PROFIL.basketball.daten.teamStat`: „FOULS ●●○○○“, rot „BONUS“), Kästchen am Korb entfällt | `p01`–`p05` |
| HUD | **Viertel-Bauchbinde** statt Vollflächen-Tafel: Linescore, Feldwürfe/Quote/Rebounds/Assists/Ballverluste/Fouls je Team (bessere Seite grün), Topscorer je Seite mit Portrait, **Führungsverlauf** als Kurve; 6 s (Halbzeit 8 s), das Spiel bleibt sichtbar; kein zweiter Einblender | `r04-…` gegen `n04-nachher-bauchbinde-1920.png` |
| HUD | **Klick auf eine Figur öffnet die Spielerkarte** (Gegner nur, wenn Fokus-Doppeln nicht wählbar ist; sonst bleibt Doppeln) | `n06-klick-figur` |
| HUD | **Eine Uhr:** Ticker zeigt bei Basketball die Spieluhr („Q1 0:49“) wie Spielverlauf und Kopfleiste | `n04` |
| HUD | Bedienleiste halbtransparent, voll bei Maus/Fokus; im Endstand ausgeblendet (lag über dem Boxscore) | `n05-nachher-endstand` |
| Kamera | **Alle im Bild:** der Zoom gibt nach (bis 1,24), bis alle zehn Figuren samt Kopf in der Höhe passen; Bildmitte zu 60 % zur Spielermitte | angeschnittene Spieler-Bilder nachher **4,7 %** (volles Viertel, 3 395 Bilder) |
| Kamera | **Kamerawahl** wie im Mockup: Ball (Halbfeld) → Überblick → Spieler (folgt der offenen Spielerkarte, Zoom 1,43), Taste K und Knopf in der Bedienleiste, gemerkt | `n07-kamera-spieler` |
| Kamera, Effekte | **Dunk-Stoß:** 0,35 s gedämpftes Wackeln beim Dunk-Aufprall | Video |
| Kulisse | **Publikum (PixelLab, 10 Gen.):** Zuschauerreihe an der oberen Seitenlinie, gespiegelt gekachelt; springt in 16-px-Spalten bei Treffern (Dunk/Dreier/Lauf ≥ 8:0/knappes 4. Viertel stärker), wippt sonst leicht; dunkle Kopf-Silhouetten im Vordergrund unten | `p00-*-ueberblick` |
| Kulisse | **Street-Court-Remake (PixelLab, 25 Gen.):** Graffiti-Mauer mit Laternen und Efeu, rissiger Asphalt mit Lichtkegeln, Maschendrahtzaun mit Straßenlampen; im Bau um 22 % aufgehellt (`PL_HELL`), damit dunkle Figuren lesbar bleiben | `p00-streetcourt-ueberblick` |
| Effekte | **Steal-Moment:** weißer Blitz, Wisch-Bogen in Teamfarbe, PixelLab-Funken (`fx_funken`, Bestand) | `p04-steal` |
| Effekte | Dunk: PixelLab-Funkenregen (`fx_funken`, Bestand); Dreier-Treffer: goldenes PixelLab-Feuerwerk (`fx_feuerwerk`, Bestand) | `p02-dunk`, Video |
| Ton | **Trillerpfeife** (WebAudio: zwei Rechtecke um 2,9 kHz mit 26-Hz-Triller, zwei Stöße) statt Buzzer beim Foul | Zähler: Buzzer 5 → 4 je Spiel |
| Ton | **Ballannahme** (kurzer Schlag), **Steal** (Wisch + Quietschen), **Raunen** bei verfehltem Dreier, **Ausbruch** des Publikums bei Lauf ≥ 8:0 | WebAudio-Knoten je Spiel 271 → 435 Oszillatoren |
| Sonden | `__arena.feldKameraModus(m)`, Situation `fx-steal` in `szeneFeldspiel` | — |

Werkzeug: `scripts/baue-basketball-spieltag-save.ts` (Test-Spielstand mit Basketball an Spieltag 1, s. 1).

### Ton: jedes Ereignis, ein Klang (Bestand nachher)

| Ereignis | vorher | nachher |
|---|---|---|
| Dribbeln | Aufprall (Datei) | gleich |
| Pass angekommen | — | Fang-Schlag (Synth) |
| Treffer / Swish | Korb-Datei + Jubel + Swish | gleich, plus Publikumsschub bei Dunk/Dreier, Ausbruch bei Lauf ≥ 8:0 |
| Ringtreffer / Brett | Ring- bzw. Brett-Synth | gleich, bei Dreiern zusätzlich Raunen |
| Dunk | Wumms + Ring | gleich + Kamerastoß |
| Block | Block-Synth + Aufprall | gleich |
| Steal | Aufprall (Datei) | Wisch + Quietschen + Aufprall |
| Foul | **Buzzer** (wie Viertelende) | **Pfiff** |
| Freiwurf | Korb/Aufprall | gleich |
| Viertel-/Spielende | Buzzer | gleich |
| Abstoppen/Drive | Quietschen | gleich |

## 4. Bewertung nachher, mit Beleg

- **Regeln 91:** Schussuhr in einer Zeitbasis, Teamfouls und Bonus im Scorebug, gezeigt = gebucht 0/309.
  Rest: „Führungswechsel“ beim ersten Korb; Bonus wirkt erst mit einem Foul ohne Wurf (Bogen 7.2).
- **Kamera 91:** 95,3 % der Spieler-Bilder vollständig im Ausschnitt (vorher nicht gemessen, aber in jedem
  dritten Standbild sichtbar angeschnitten), Mittel-Zoom 1,37 (Halbfeld bleibt), drei Kameras, Spielerkamera aus
  der Karte, Nahzoom und Stoß beim Dunk. Rest: Freiwurf-Einstellung unverändert, kein Schnitt bei Ballwechsel.
- **HUD 91:** alle Mockup-Bauteile außer Wiederholung (12) und Phone-Feinschliff; jede Zahl hat einen Ort
  (Teamfouls, Uhr), Viertelpause ohne Vollflächen-Deckel, Endstand frei. Rest: doppelte Bedienung und Platz für
  die Leinwand in der App (Host, s. Plan).
- **Kulisse 91:** zwei Schauplätze im selben PixelLab-Stil, Linien als Asset, Wappen, Publikum, das reagiert.
  Rest: Publikum nur oben (unten Silhouetten), Parkett ohne eigene Lichtstimmung.
- **Effekte 91:** Treffer, Dunk, Dreier, Block, Steal, Staub, Ringwackeln, Publikumssprung, Kamerastoß. Rest:
  kein Netz-Wirbel, kein „On fire“ bei Serien.
- **Ton 91:** jedes Ereignis hat einen eigenen Klang (Tabelle oben), Pfiff ≠ Buzzer. Rest: alles Synthese,
  nicht gehört; über 95 nur mit echten Aufnahmen (Pfiff, Publikum, Sprechchöre).

## 5. Bauplan für die Kategorien unter 90 und den Rest

| # | Maßnahme | Kategorie | Wertung? | Aufwand | Risiko | PixelLab |
|---|---|---|---|---|---|---|
| 1 | Knäuel auflösen: Deny nur für den Mann eine Station vom Ball, `mitspielerMin` 58 → 70 im Halbfeld, Help nur einer; messen mit `miss-spacing.mjs`, `miss-alle-disziplinen.mjs 24 basketball`, `einflussVon` | Bewegung 84 → 90+ | **ja** (Fingerabdruck bewegt sich, rho ≥ 0,75 und Pp ≤ 25 Pflicht; Puffer heute 0,862 / 13,4) | 1–2 Tage | mittel | — |
| 2 | Vollfläche in der App: bei Disziplinen mit HUD-System Ticker + Wertung unter dem Feld einklappbar (Tabelle bleibt im Endstand), Leinwand bekommt die volle Breite; Kopfzeilen-Knöpfe und Bedienleiste zusammenlegen | HUD, Layout | nein | 0,5 Tag | gering (Host-Code, Abgleich #1578) | — |
| 3 | Live-Band auf die obere Bande statt ins Feld (Mockup) | Layout | nein | 2 h | gering | — |
| 4 | Korb mit Ausleger (~1,1 m), danach FIBA-Lage 1,575 m | Spielgerät, Layout 92 | **ja** (Wurfdistanzen) | 0,5 Tag + Messung | mittel | 1 Bestellung ≈ 10 Gen. |
| 5 | „Führungswechsel“ erst, wenn die Führung wirklich wechselt; erste Führung als „Führung“ | Regeln/HUD | nein | 30 min | gering | — |
| 6 | Publikum auch unten und an den Grundlinien, Parkett-Lichtkegel, Netz-Wirbel-VFX | Kulisse, Effekte 93+ | nein | 0,5 Tag | gering | ≈ 10–20 Gen. (2 Requisiten + 1 VFX lite) |
| 7 | Echte Ton-Aufnahmen (CC0: Pfiff, Hallenpublikum, Sprechchor) statt Synthese | Ton 95 | nein | 2 h | gering (Lizenz prüfen) | — |
| 8 | Figuren aus dem Bestand: `angriff`-Bilder als Wurf-/Dunk-Absprung, `treffer` beim Foul und Block, Ballführer mit Ball in der Hand vor dem Körper, Blickrichtung zum Ball | Figuren 55 → ~70 | nein | 1 Tag | gering | — |
| 9 | Echte Posen Wurf/Dunk/Block (Kostenschätzung Bogen 17.11. Abschnitt 7.5) | Figuren 70 → 90 | nein | Bestellung + 1 Tag | Kosten | **Freigabe nötig:** Pilot ein Team „Minimal“ ≈ 40 Gen.; Standard für ein Team 96–120 Gen.; ganzer Bestand 1 440–8 640 Gen. |

**Ehrliche Obergrenze Figuren-Animation ohne neue Animationen: etwa 70 %.** Der Bestand hat keine Arme über dem
Kopf; Squash/Stretch, Sprunghöhe und die `angriff`-Bilder ersetzen keine Wurfbewegung. Über 90 geht nur mit
Posen (Punkt 9), und die sind nach CLAUDE.md gesperrt, bis Chris sie für genau diesen Fall freigibt.

## 6. Bilder

| Datei | Inhalt |
|---|---|
| `r01-vorher-spielfluss-1920.png` | Mockup-Arena vorher, Q1 1:36: Schussuhr 4.4 rot, Foul-Kästchen in der Zone, angeschnittene Figuren |
| `r02-vorher-knaeuel-1920.png` | Q1 0:58: Knäuel aus neun Figuren an der linken Zone |
| `r04-vorher-viertelpause-1920.png` | Viertelende vorher: Vollflächen-Tafel plus Einblender |
| `r05-vorher-endstand-1920.png` | Endstand vorher: Bedienleiste über dem Boxscore |
| `r06-vorher-streetcourt.png` | alter Street-Court |
| `p00-parkett-ueberblick.png`, `p00-streetcourt-ueberblick.png` | Überblick vorher/nachher: Publikum, Remake, Teamfouls, Schussuhr |
| `p01-aufbau.png` … `p05-ecke.png` | Szenen vorher/nachher (Aufbau, Dunk, Dreier, Steal, Ecken-Wurf) |
| `n04-nachher-bauchbinde-1920.png` | Viertel-Bauchbinde |
| `n05-nachher-endstand-1920.png` | Endstand nachher |
| `n06-klick-figur-1920.png`, `n07-kamera-spieler-1920.png` | Karte per Klick auf die Figur, Spielerkamera |
| `viertel-1920.webm` | Ausschnitt aus dem vollen ersten Viertel nachher (Tempo 1×) |
