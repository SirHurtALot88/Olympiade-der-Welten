# Offene Referenzen fürs Upgrade — Recherche 19.09.2026

Chris' Frage: gibt es frei zugänglichen Code von Eslabong oder ähnlichen Spielen, woran man
sich für Animationen oder Sportspiele orientieren kann, und womit lässt sich der Stand noch
hochziehen? Reine Recherche, kein Code, keine Verdrahtung.

**Kurzfassung vorweg:** Eslabong selbst ist zu (Steam-App 4560660, nur Patch-Notes öffentlich,
kein Repo, keine Assets). Der ergiebigste Fund liegt aber nicht extern, sondern **im eigenen
Repo bereits angelegt und nur zu einem Bruchteil ausgeschöpft**: der Sprite-Baukasten zieht
seit dem 23.08. aus dem offiziellen LPC-Generator-Repo auf GitHub, und von dessen Umfang ist
ein kleiner Teil verbaut. Externe Auto-Battler-Codebasen taugen dagegen kaum als Quelle zum
Übernehmen — dazu unten mehr, mit Begründung statt Wunschliste.

## 1. Woher die aktuellen Sprites stammen — nachgeprüft, nicht vermutet

Jede Sprite-Kategorie im Repo trägt eine `quellen.json` bzw. `CREDITS-*.txt` mit Paket,
Urheber, Lizenz und Original-URL (`public/sprites/*/quellen.json`,
`public/sprites/arena/HERKUNFT/`). Das ist bereits vorbildlich dokumentiert — hier die
Kurzfassung dessen, was drinsteht:

- **Kämpfer-Baukasten** (`public/sprites/baukasten/`, 124 Ebenen, `README.md` dort): Kern
  von der **Liberated Pixel Cup (LPC) Base Assets**, seit 23.08. ergänzt um **209+12 Blätter**
  aus dem offiziellen Generator-Repo `LiberatedPixelCup/Universal-LPC-Spritesheet-Character-
  Generator` auf GitHub (walk/run/shoot/hurt/idle für 45 Ebenen, weiblicher Körper, weiblich
  geschnittene Leder-/Plattenrüstung, zuletzt am 05.09. fünf Football-Ebenen aus
  `hat/helmet/bascinet_round`, `hat/visor/grated`, `shoulders/mantal`,
  `torso/clothes/sleeveless2`, `legs/leggings`). Lizenzen OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0.
- **Kreaturen** (`monster/`, `goblin/`, `zwerg/`, `voidborn/`, `insekt/`, `gnom/`, `fisch/`,
  `elementar/`, `schiff/`, `pflanze/`): einzeln von OpenGameArt bezogen — `[LPC] Monsters`,
  `[LPC] Female Orc/Ogre/Goblin/Troll`, `Flying Dragon Rework` (bewusster Stilbruch, von
  Chris freigegeben, weil LPC keinen Drachenkopf kennt) u. a. Lizenzmix CC0/CC-BY/CC-BY-SA/
  OGA-BY/GPL, für privates Spiel überall unkritisch.
- **Arena- und Bahn-Böden** (`arena/`, `public/sprites/basketball/`): LPC-Terrain-Pakete
  (`[LPC] Terrains`, `ZRPG Tiles`, `RPG Terrains` u. a., CC-BY-SA 3.0) sowie **Kenney Sports
  Pack** (CC0) für `korb_topdown.png` und, seit 03.09., Football-Ball/-Helm
  (`public/sprites/football/quellen.json`).
- **Football-Ausrüstung — bereits erfolglos gesucht, nicht offen:** `football-assets.md`
  (03.09.) dokumentiert eine vollständige Suche nach football-spezifischen LPC-Layern (lokaler
  Volltext-Grep über den kompletten geklonten Generator, 89 353 Dateien, plus OpenGameArt-
  Stichwortsuche über 12 Begriffe) — **kein Treffer**. Verbaut ist stattdessen generische
  Rüstung (`shoulders_mantal`, `bascinet_round`, `sleeveless2`), passend umbenannt. **Diesen
  Weg noch einmal zu gehen wäre doppelte Arbeit** — das war bereits die richtige Antwort.

Die Vermutung aus der Aufgabenstellung, `FUSS_EISKUNSTLAUF` im Engine-Code sei ein Hinweis auf
LPC-Namensmuster, stimmt **so nicht**: das ist ein Fußanker-Konstant für die Eiskunstlauf-
Requisiten-Zeichnung (`battle-mode.engine.js` Zeile 630), kein Sprite-Dateiname. Der eigentliche
Beleg für LPC liegt in den `quellen.json`-Dateien und ist damit stärker, als die Vermutung nahelegt.

## 2. Ungenutzte LPC-Erweiterungen — der ergiebigste, günstigste Fund

Der Generator ist bereits als lokaler Checkout im Zugriff gewesen (s. `football-assets.md`) und
liegt vollständig offen auf GitHub (MIT-artige LPC-Sammellizenz, s. o.). Drei konkrete Lücken,
die das eigene `baukasten/README.md` selbst schon benennt oder die sich aus dem
Ebenen-Vergleich ergeben:

### a) Nur 3 Frisuren von >30 im Generator-Repo verbaut — **Aufwand: klein**

`index.json` führt genau `haar_dread`, `haar_lang`, `haar_mop` plus das generische `h_*`
(`flat_top_fade/male`) als Frisuren. Der LPC-Generator führt in `sheet_definitions/hair/` u. a.
`afro`, `bangs`, `bob`, `bunches`, `cornrows`, `mohawk`, `page`, `pixie`, `ponytail`,
`princess`, `spiked`, `twintail`, `wavy` — für exakt dieselben Bewegungen (`walk`, `slash`,
`shoot`, `hurt`), im selben 64×64-Raster, mit derselben Recolor-Rampe wie die drei bereits
genutzten. Das ist die gleiche mechanische Übernahme, die für die weiblichen Körper und die
Football-Ausrüstung schon zweimal gemacht wurde (Blatt kopieren, in `quellen.json` eintragen,
`RUEST_QUELLEN`/Recolor-Tabelle erweitern) — kein neuer Code, nur mehr Zeilen in bestehenden
Tabellen. Nutzen: die über 100 Kaderfamilien-Charaktere tragen aktuell effektiv vier
Frisurvarianten; zehn zusätzliche Frisuren würden die visuelle Wiedererkennbarkeit einzelner
Sportler spürbar erhöhen, ohne die Recolor-Logik anzufassen.

### b) Weitere Tierköpfe für neue "Kreaturen"-Rassen — **Aufwand: klein bis mittel**

`kopf_*` deckt bereits 20 Köpfe ab (Alien, Orc, Wolf, Lizard, Minotaur, Vampire, Zombie,
Skeleton u. a.), alle laut `README.md` mit dem `adult`-Kopfschnitt kompatibel — inklusive der
weiblichen Körper. Der LPC-Satz führt in `head/heads/` zusätzlich Bär, Hirsch, Fuchs, Huhn,
Kuh, Pferd — bisher nicht übernommen. Für die bereits im Spiel vorgesehenen, aber sprite-armen
Rassen (`gnom`, `elementar`, `voidborn` haben je nur eine Handvoll Blätter, s. `quellen.json`)
wäre das eine günstige Ergänzung, sofern eine dieser Rassen thematisch zu einem Tierkopf passt.
Aufwand höher als (a), weil pro Kopf ein Alpha-Masken-Abgleich nötig ist (dieselbe Methode wie
beim Goblin-Fund, s. `goblin/quellen.json`), nicht nur ein Dateikopiervorgang.

### c) Ausrüstungs-Layer für Athleten-Optik (Rucksack, Köcher, weitere Umhänge/Capes) —
**Aufwand: klein**

`torso/quiver`, `back/backpack` und weitere `cape`-Varianten liegen im Generator-Repo bereits
vor und sind bisher nicht im Baukasten. Für Speerwurf/Bogen-nahe Disziplinen (falls es sowas
in den 20 Disziplinen gibt) oder als reine Diversitäts-Ergänzung im Kader eine kleine, günstige
Erweiterung nach demselben Muster wie (a).

### Was der Generator NICHT hat — keine Zeit investieren

Das eigene `baukasten/README.md` hat das bereits sauber vermessen: **kein** `run`-Blatt für
Plattenrüstung, Umhänge oder irgendeine Waffe im gesamten LPC-Satz — das ist LPC-Standard, kein
Beschaffungsproblem. Wer rennende Kämpfer mit Rüstung/Waffe braucht, muss zeichnen (lassen),
nicht suchen. Ebenso: football-/baseball-/hockeyspezifische Ausrüstung existiert im LPC-Satz
nachweislich nicht (s. Abschnitt 1) — dafür zeichnet die Engine Schläger, Hanteln, Schachuhr
und Kufe bereits selbst zur Laufzeit (`zeichneHockeyschlaeger`, `zeichneHantel`,
`zeichneSchachuhr`, `zeichneKufe` in `battle-mode.engine.js`), was für Sportgeräte ohnehin der
bessere Weg ist als eine Sprite-Suche, die schon einmal leer ausging.

## 3. Externe Sprite-Packs außerhalb LPC

- **Kenney "Sports Pack" (350+, CC0, `opengameart.org/content/sports-pack-350`):** bereits
  teilweise im Einsatz (Basketballkorb, Football-Ball/-Helm). **Ungenutzter Rest:** Tennis-,
  Baseball-, Golf-, Bowling- und Dodgeball-Sprites im selben Paket, gleiche CC0-Lizenz, gleicher
  flacher Top-Down-Stil wie die bereits verbauten Stücke — für Spielfeld-/Ausrüstungsrequisiten
  (Bälle, Bahnen, Tore) in weiteren Ballsport-Disziplinen eine kleine, sofort nutzbare
  Ergänzung, **aber nicht für Charakter-Sprites**: der Stil (flach, vektorartig) passt nicht
  zum pixeligen LPC-Look der Kämpfer und würde dort einen Stilbruch erzeugen, den es bei den
  Charakteren bisher nirgends gibt (anders als bei den Drachen, wo der Stilbruch bewusst und
  von Chris freigegeben ist).
- **"Boxer Game Character" (CC0, OpenGameArt):** auf den ersten Blick passend (Kampfsport,
  Idle/Walk/Punch/Hurt/KO-Animationen) — bei näherem Hinsehen **nicht geeignet**: Cartoon-Stil
  mit großem Kopf-Körper-Verhältnis, andere Zellengröße als das 64×64-LPC-Raster, keine
  Vier-Richtungs-Ansicht (nur Seitenansicht). Ein Einbau würde entweder alle anderen Kämpfer
  im selben Match optisch aus dem Rahmen fallen lassen oder eine komplette Neuvermessung nach
  sich ziehen — der Aufwand steht in keinem Verhältnis zum Nutzen einer einzigen Zusatzpose.
  **Verworfen.**

## 4. Externe Auto-Battler-/Sportsim-Codebasen — ehrlich geprüft, meist nicht übertragbar

- **`Jameskmonger/creature-chess`** (TypeScript, React, Node; Auto-Chess-Klon,
  `github.com/Jameskmonger/creature-chess`): einzige halbwegs vergleichbare Open-Source-
  Codebase mit echtem Auto-Battle-Rundenmodell. **Lizenz ist AGPL-3.0** — starkes Copyleft, das
  bei Codeübernahme in ein öffentlich erreichbares Spiel (die Olympiade läuft live unter
  `olympiade.duckdns.org`) zur Pflicht führen würde, den **gesamten** verbundenen Quellcode
  offenzulegen. Für dieses Projekt (nicht Open Source) ist direkte Codeübernahme damit
  ausgeschlossen. Als reine **Lektüre zur Rundenstruktur** (Matchmaking, Board-Zustand,
  Kampfsimulation getrennt vom Rendering) unproblematisch — Ideen/Architekturmuster sind nicht
  urheberrechtlich geschützt, nur der Code selbst. Aufwand für "reinlesen und Muster
  mitnehmen": klein; Aufwand für "Code übernehmen": nicht zulässig, daher nicht bewertet.
- **Generische 2D-Engines (Godot, Torque2D, PlayCanvas, Phaser):** alle MIT/ähnlich frei,
  aber strukturell die falsche Antwort — das Projekt hat sich bewusst gegen eine fertige
  Engine entschieden (handgeschriebener Canvas-Motor, ~30 000 Zeilen, tief mit dem eigenen
  Rezept-/Eignungssystem verwoben). Ein Umstieg wäre ein Rewrite, kein Upgrade. Nicht
  empfohlen.
- **Eslabong selbst:** wie in der Aufgabenstellung korrekt vermutet, kein Zugriff — proprietär,
  nur Patch-Notes und ein Community-Wiki (`eslabong-game.wiki`) öffentlich, kein Repo, keine
  Assets. Nichts zu holen außer Gameplay-Beschreibungen aus den Patch-Notes selbst, die dem
  Team ohnehin schon als Referenz dienen.
- **Reine Canvas-Sprite-/Partikel-Bibliotheken** (`IceCreamYou/Canvas-Sprite-Animations`,
  MIT; diverse kleinere Partikel-Snippets): technisch nutzbar, aber der Motor hat sein eigenes,
  bereits funktionierendes Sprite-/Recolor-/Animationssystem (`zeichneSprite`, Frame-Tabellen,
  Recolor-Rampen). Eine fremde Bibliothek einzuziehen hieße, zwei Animationssysteme parallel zu
  pflegen. **Als Techniken-Fundus lohnt es sich trotzdem**, gezielt Einzeltechniken zu lesen
  (nicht den Code zu importieren): Squash-&-Stretch-Skalierung bei Aufprall/Landung,
  Screen-Shake bei Treffern, kurze additive Partikel-Bursts bei Toren/K.O. — alles Techniken,
  keine Assets, patent- und lizenzfrei übernehmbar als eigene Umsetzung. Aufwand pro Technik:
  klein bis mittel, je nachdem wie viele Aufrufstellen im Motor betroffen sind.

## 5. Priorisierte Empfehlung

| # | Fund | Was übernehmen | Aufwand | Warum zuerst/nicht |
|---|---|---|---|---|
| 1 | LPC-Frisuren (Abschnitt 2a) | ~10 weitere Frisur-Blätter, gleiches Kopiermuster wie bisher | klein | Größter Diversitätsgewinn pro Stunde Arbeit, Infrastruktur existiert komplett |
| 2 | LPC-Zusatzausrüstung (Abschnitt 2c) | Rucksack/Köcher/weitere Umhänge | klein | Gleiches Muster, geringes Risiko |
| 3 | LPC-Tierköpfe (Abschnitt 2b) | 3-6 neue Köpfe für sprite-arme Rassen | klein-mittel | Braucht Alpha-Masken-Abgleich pro Kopf, aber bewährte Methode |
| 4 | Kenney-Sportsrequisiten (Abschnitt 3) | Bälle/Bahnen für weitere Ballsport-Disziplinen | klein | Nur Requisiten, keine Charaktere — kein Stilrisiko |
| 5 | Game-Feel-Techniken (Abschnitt 4, Squash&Stretch/Screen-Shake) | Technik nachbauen, nicht Code kopieren | mittel | Wirkung erst bei mehreren Aufrufstellen sichtbar |

**Explizit nicht empfohlen:** Boxer-Sprite-Pack (Stilbruch), Engine-Wechsel (Rewrite statt
Upgrade), Codeübernahme aus `creature-chess` (AGPL-Konflikt), erneute Suche nach
football-/sportspezifischen LPC-Layern (bereits erschöpfend gemacht, ergebnislos).

## Quellen

- [LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)
- [LPC Sprite Sheet Generator (gehostet)](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/)
- [Sports Pack (350+), OpenGameArt / Kenney, CC0](https://opengameart.org/content/sports-pack-350)
- [Boxer Game Character, OpenGameArt, CC0](https://opengameart.org/content/boxer-game-character)
- [Jameskmonger/creature-chess (AGPL-3.0)](https://github.com/Jameskmonger/creature-chess)
- [IceCreamYou/Canvas-Sprite-Animations (MIT)](https://github.com/IceCreamYou/Canvas-Sprite-Animations)
- [Eslabong auf Steam](https://store.steampowered.com/app/4560660/Eslabong/) /
  [Eslabong-Wiki, Auto-Battler-Guide](https://eslabong-game.wiki/en/combat/eslabong-auto-battler)
- Interne Belege: `public/sprites/baukasten/README.md`, `public/sprites/*/quellen.json`,
  `public/sprites/arena/README.md`, `docs/design/football-assets.md`
