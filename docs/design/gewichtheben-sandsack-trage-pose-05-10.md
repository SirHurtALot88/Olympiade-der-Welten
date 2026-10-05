# Gewichtheben Sandsack-Finale — Weg C, Stufe 1: die echte Trage-Pose (05.10.)

**Status: gebaut, visuell geprüft, Isolationsnachweis bestanden. Weiterhin nur hinter
`sandsackVorschauAktiv`** (erreichbar ausschließlich über `window.__arena.sandsackVorschau()`),
also in keinem echten Spiel sichtbar. Stufe 2 (Format-Mechanik) und Stufe 3 (Boxscore,
Kaderbildschirm, Sonden) sind nicht Teil dieser Runde und wurden nicht angefasst.

Beantwortet Frage 4 aus `gewichtheben-sandsack-rennen-fable-praesentation-03-10.md` Abschnitt 9
(„reicht Schulter/Brust-Anker … oder echte Trage-Pose?“) mit einer echten Pose, die **ohne neues
Sprite-Blatt** auskommt.

---

## 1. Was vorher war

Paket 2 (`gewichtheben-sandsack-finale-paket2-praesentation-04-10.md`) kippte und stauchte die
**ganze** Figur um den Fußpunkt und hängte den Sack an einen von zwei Ankern. Der Körper selbst
blieb im normalen Gehzyklus mit schwingenden Armen. Der Brust-Anker
(`HEBEN_PHASEN.zug.anteil` = 0,326) saß dabei vor dem **Gesicht**, nicht vor der Brust, siehe
Abschnitt 5.

## 2. Was gebaut wurde

Alles in `public/mockups/battle-mode.engine.js`, im Paket-2-Block direkt vor
`zeichneSandsackTraeger()`:

* **`SANDSACK_TRAGE_POSEN`**: sechs Posen, eine je Sack-Stufe, im Stil von `HEBEN_PHASEN`
  (nur Winkel und Körperanteile, keine festen Pixel):

  | Stufe | rumpf (rad) | kopf (rad) | knie | schwank | zittern | griff |
  |---|---:|---:|---:|---:|---:|---|
  | 1 beiläufig | 0,02 | −0,03 | 0,00 | 0,3 | 0 | Schulter |
  | 2 locker | 0,05 | 0,00 | 0,10 | 0,6 | 0 | Schulter |
  | 3 Kopf weicht | 0,10 | +0,06 | 0,22 | 1,0 | 0 | Schulter |
  | 4 umarmt | 0,15 | −0,08 | 0,36 | 1,5 | 0,25 | Brust |
  | 5 gebeugt | 0,24 | −0,14 | 0,55 | 2,1 | 0,5 | Brust |
  | 6 kämpft | 0,34 | −0,20 | 0,74 | 2,8 | 0,85 | Brust |

  Dazu zwei Sonderhaltungen: **Pause** (vornübergebeugt, Hand auf dem Knie, Atemheben) und
  **Bücken** (Rutscher: tief nach dem gefallenen Sack greifen). Weich überblendet über
  `sandsackPoseMisch()`. Die Erschöpfung (`u.vizPuste`, dieselbe Zahl wie der Puste-Ring)
  beugt zusätzlich und lässt den Kopf hängen.
* **Gelenk-Rig aus Streifen** (`zeichneSandsackTragePose()`): Die Figur wird über die echte
  `zeichneSprite()`-Pipeline zweimal in eine Zwischenleinwand gezeichnet. (A) im laufenden
  Schrittbild liefert die Beine, (B) in einem ruhigen Bild liefert Rumpf und Kopf. Danach wird
  sie in vier Streifen neu zusammengesetzt, jeder mit eigener Transformation:
  * Unterschenkel: Sohle fest, Knie nach vorn geschert,
  * Oberschenkel: Becken zurück, Hüfte abgesenkt (Kniebeuge),
  * Rumpf: um den Hüftpunkt gedreht (Rückenbeuge),
  * Kopf: zusätzlich um den Nacken gedreht und abgesenkt (Kopfhaltung).

  Kopf, Rüstung, Haar, Helm, Krone, Schild und Flügel jeder Figur laufen dadurch automatisch mit.
* **Armführung**: Wer trägt, schwingt die Arme nicht mehr. Bild (B) ist je Griff gewählt:
  * Schulter/Pause: Gehzyklus-Spalte 0 mit anliegenden Armen,
  * Brust: `shoot`-Bild 2, der nahe Arm ist angewinkelt und vor den Bauch geführt,
  * Bücken: `shoot`-Bild 3, beide Arme gestreckt, gekippt zeigen sie zum Sack.

  Ausgewählt wurde nach Sichtung aller 13 shoot-Bilder; erreicht über `u.vizJubel`, ohne
  `lunge` und ohne `feldspiel`, also ohne Hantel. `u.vizWaffe=null` unterdrückt Bogen und
  Mündungsfeuer. Ergänzt wird das um Canvas-Unterarme und -Hände in der **gemessenen** Hand-
  und Ärmelfarbe der Figur (`sandsackHandFarbe()`, Pixelprobe am Frontbild bei Zelle 21/47 bzw.
  21/41 nach `sprite-handpunkte.md`, zwischengespeichert je Name).
* **Lebendigkeit**: Torkeln im Schritttakt (aus `u.vizAniPhase`, zwei Schritte je Zyklus),
  Rumpfwanken, schwerer Tritt ab Stufe 4 und Zittern von Sack und Händen ab Stufe 4 (stärker bei
  leerer Puste). Alles deterministisch aus der Szenenzeit, **kein `rr()`**.
* **Rutscher/Pause** als eigene Haltungen. Der Sack fällt vom Trageplatz nach vorn auf den Boden
  (mit Sandwolke), die Figur bückt sich und greift danach. Bei der Pause wird er abgestellt und
  die Hand stützt sich aufs Knie.
* **Vollbild-Kreaturen/Reiher-Mech** (Golem, Krolach usw.) haben kein Ebenen-Rig mit diesen
  Körperanteilen. Sie bekommen dieselben Posenwerte als Ganzkörper-Neigung/-Stauchung, also die
  bekannte, in Fable 7.3 dokumentierte Grenze.
* **Probe** `window.__arena.sandsackTragePoseProbe(name, stufe, opts)`, rein diagnostisch wie
  `renderProbe`. Sie ruft exakt die Produktionsfunktion auf.
* **Skript** `scripts/screenshot-sandsack-trage-pose.mjs`: Galerie, Szene und Stufen-Streifen.

Gemessene Körperanteile (`SANDSACK_KOERPER_ANTEIL`, Zeilenbreiten der Alpha-Silhouette am
Standardkörper, 0 = Scheitel): Nacken 0,41 · Schulter 0,45 · Hüfte 0,68 · Knie 0,83.

## 3. Screenshots

Erzeugt mit:

```sh
node scripts/screenshot-sandsack-trage-pose.mjs docs/design/gewichtheben-sandsack-trage-pose-galerie-05-10.png docs/design/gewichtheben-sandsack-trage-pose-szene-05-10.png 26
```

* **Galerie** (`gewichtheben-sandsack-trage-pose-galerie-05-10.png`): Standardkörper plus fünf
  Kaderfiguren (Draco, Krolach, Lava Golem, Johanna, King Arlen Morgolor), dreifach vergrößert.
  Spalten: Stufe 1–6, Pause, Rutscher (Bücken), leer (Rückweg). Zu sehen ist die stufenweise
  Haltung: aufrecht mit Sack auf der Schulter, dann umarmt vor dem Bauch, zuletzt tief gebeugt
  mit Knie- und Rückenbeuge.
* **Stufen in der echten Szene** (`gewichtheben-sandsack-trage-pose-szene-05-10-stufen.png`):
  Die Vorschau-Szene wird je Stufe auf einen passenden Trip gespult, Ausschnitt mit dreifacher
  Gerätepixeldichte. **Stufe 1 fehlt dort**, weil sie in dieser Kaderpaarung schlicht nicht
  vorkommt: der einzige 15-kg-Sack wird mit dem 20er gedoppelt (35 kg = Stufe 3). Die Galerie
  deckt Stufe 1 ab.
* **Szene in Spielgröße** (`gewichtheben-sandsack-trage-pose-szene-05-10.png`, t = 26 s).

## 4. Isolationsnachweis

`node scripts/miss-alle-disziplinen.mjs 4` (alle zwanzig Disziplinen, Kaderfamilie live-save,
5 Varianten) einmal mit der Engine aus `HEAD` (`e0225175`) und einmal mit diesem Stand. Die
vollständige Textausgabe ist **byte-identisch** (`diff` leer), darunter gewichtheben 0,847 /
0,916. Strukturell ist das auch garantiert: Alle Änderungen liegen im Paket-2-Zeichenblock
hinter `sandsackVorschauAktiv` oder in der neuen Probe. Keine Zeile an
`SANDSACK_STATIONEN`, `sandsackZuteilung()`, `baueSandsackFinale()`, `sandsackSeiteLauf()`,
`sandsackGang()`, `sandsackWuerfe()`, `sandsackLastenplan()`, `sandsackPersoenlichkeit()`,
`LASTEN_FINALE`, am Gate oder an `stepSandsackVorschau()`. Die Paket-2-Rauchtests
(`screenshot-sandsack-finale.mjs` bei t = 43,5 s und 97,9 s) laufen ohne Seitenfehler.

## 5. Nebenbefunde

1. **Blickrichtung des Gasts (behoben, reine Anzeige).** Beide Bahnen laufen von links nach
   rechts. Paket 2 setzte trotzdem `side===0?1:-1`, der Gast lief auf dem Hinweg also rückwärts.
   Mit einer Vorbeuge-Pose wäre das ein Zurücklehnen gegen die Laufrichtung. Jetzt gilt: hin
   blickt nach rechts, rück nach links, für beide Seiten.
2. **Der alte Brust-Anker 0,326 lag auf Augenhöhe.** Die Hantel-Landmarke „Schulter 26,8“ trifft
   beim großen LPC-Chibi-Kopf die Augen. Die echte Schulter liegt bei Anteil 0,45. Die Hantel
   selbst wurde nicht angefasst; ob ihr Front-Rack dasselbe Problem hat, wäre eine eigene Prüfung.
3. **Offen, nicht behoben (Paket-2-Ablauf, `stepSandsackVorschau()`):** Bei Trips mit
   Rutscher/Pause erreicht der „hin“-Teil schon vor dem Ereignis das Stationsende, das Ereignis
   spielt dann bei 55 % der Station, und „rück“ startet wieder am Ende. Die Figur springt also
   zweimal. Das zu beheben hieße, den Ablauf (Schrittfunktion) zu ändern. Das gehört zu Stufe 2,
   nicht zur Pose.

## 6. Ehrliche Grenzen

* **Kein echtes Trage-Sprite.** Die Arme stammen aus dem vorhandenen Blatt (Ruhebild bzw.
  shoot-Bild 2/3) plus gezeichneten Unterarmen. Ein „richtiges“ Umarm-Bild gibt es im Baukasten
  nicht. Bei 50 px Figurhöhe liest es sich als Tragen; in der dreifachen Vergrößerung sieht man,
  dass der gezeichnete Unterarm eine Linie ist und keine Pixelkunst.
* **Nur Profil.** Die Pose ist für die Seitenansicht gebaut, die die Szene ausschließlich
  verwendet.
* **Vollbild-Kreaturen** bekommen nur die Ganzkörper-Fassung (s. Abschnitt 2).

## 7. Geänderte und neue Dateien

* `public/mockups/battle-mode.engine.js`: Trage-Pose-Block, umgebaute
  `zeichneSandsackTraeger()`, optionaler Zielkontext für `sandsackVizZeichneSack()` und
  `sandsackVizPusteRing()` (für bestehende Aufrufer zeichengleich), neue Probe
  `sandsackTragePoseProbe`.
* `scripts/screenshot-sandsack-trage-pose.mjs` (neu).
* Drei PNGs und dieses Dokument unter `docs/design/`.

## 8. Nachtrag 05.10.: Jutesack statt „Kuchen“, kein Schild beim Tragen

Rückmeldung von Chris (Ramona hat mitgeschaut) auf die Screenshots oben:
„Das sieht aus wie Kuchen, eher wie Sandsäcke wäre gut“ und „Die Leute sollten kein Schild
tragen.“ Weiter reine Präsentation (Klasse A), weiter nur hinter `sandsackVorschauAktiv`.

**Sackform** (`sandsackVizZeichneSack()`, `SANDSACK_VIZ_STUFEN`). Das abgerundete Rechteck
mit waagrechten Trennstrichen und Dreiecks-Zipfel las als Tortenschicht. Jetzt ein liegender
Jutesack: unregelmäßiger, praller Umriss mit zwei Eck-„Ohren“ am zugenähten Ende, am anderen
Ende zum Hals gerafft und mit einer Kordel abgebunden (herabhängendes Kordelende), darüber der
ausgefranste Zipfel schräg nach oben. Falten laufen vom Abbinder in den Bauch, Sackleinen als
Diagonal-Webmuster, Licht oben/Last unten. `naht` zählt jetzt **Kreuzstich**-Nähte (1 =
zugenähtes Ende, 2 = + Längsnaht, 3 = + aufgenähter Flicken), Stufe 6 bekommt statt des
schwarzen Querbalkens einen quer umgeschlungenen, gedrehten Strick. Die sechs Stufen sind
länglicher (w/h ≈ 1,6 statt 1,4: 16×10 … 26×15,5) und werden mit `bauch` 0,90 … 1,15
zunehmend praller. Neuer optionaler Parameter `{richtung, haengen}`: das Bindeende zeigt auf
der Schulter nach hinten, und die Enden hängen über die Schulter herab (`haengen` 0,6);
umarmt und am Boden zeigt es nach vorn, im Depot-Stapel abwechselnd.

**Kein Schild.** Neue Aufrufer-Flagge `u.vizOhneSchild` in `zeichneSprite()` (neben der
bestehenden Football-Sperre); ohne die Flagge bleibt der Schild überall wie bisher. Gesetzt
nur in der Sandsack-Szene: Trage-Pose (alle sechs Stufen, Pause, Rutscher/Bücken, auch die
Vollbild-Fassung), Rückweg leer, Wartezone am Depot (als Kopie, sonst tauchte der Schild
zwischen zwei Gängen auf und verschwände wieder), Handfarben-Messbild und die Probe.
Waffen waren schon vorher unterdrückt (`vizWaffe:null`); Helm, Krone und Rüstung bleiben.

Screenshots (gleicher Mechanismus, `scripts/screenshot-sandsack-trage-pose.mjs`, vorher =
die drei Bilder aus Abschnitt 3):

* `gewichtheben-sandsack-jutesack-ohne-schild-galerie-05-10.png`: sechs Figuren × Stufe 1–6,
  Pause, Rutscher, leer (Draco und Johanna ohne Schild)
* `gewichtheben-sandsack-jutesack-ohne-schild-szene-05-10.png`: Szene in Spielgröße
* `gewichtheben-sandsack-jutesack-ohne-schild-szene-05-10-stufen.png`: Stufen 2–6 in der
  Szene (Stufe 1 hat in diesem Duell keinen Trip, wie vorher)

Das Skript schließt jetzt die erste Seite, bevor die zweite (dreifache Pixeldichte) lädt, und
startet Chromium mit `--disable-gpu`. Zwei gleichzeitige Renderer der großen Seite stürzten in
der Agenten-Umgebung reproduzierbar ab, auch mit dem unveränderten Motor.

Isolationsnachweis: `miss-alle-disziplinen.mjs 4` byte-identisch gegen `bf1403e4` (alle 20).
