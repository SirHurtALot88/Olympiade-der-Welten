# Basketball: Rollen-Positionierung + Ball-Pose-Fix (26.09.)

Umsetzung von zwei Punkten, beide von Chris bestätigt: (1) die Aufstellung soll auf dem
Feld sichtbar werden (`docs/design/basketball-opus-konzeptreview-26-09.md`, Abschnitt
2.2/P2, auf einem eigenen, hier nicht enthaltenen Branch), (2) der Ball-Pose-Fix aus dem
Bewegungs-Audit (`docs/design/ui-bewegungs-audit-26-09.md`, ebenfalls eigener Branch) und
der Fable-Recherche vom 03.09. (`basketball-finalisierung-recherche-fable.md`, Abschnitt
2.3, "Weg A"/"Weg C"). Keine Änderung an `lib/player-generator/official-discipline-weights.ts`.

## Teil 1: Court-Positionierung nach Rolle

**Befund.** `zuordneSlots()` (`engine.js`) verteilte die sechs Court-Plätze (`SLOTS`: Paint,
Top of Key, Flügelpaar, Eckenpaar) bisher rein nach dem sortierten `SCHUSS_NAH`-Wert —
unabhängig davon, welche der sechs Rollen (Floor General, Rim Pressure, Perimeter, Help
Defense, Clutch Shot, Fast Break) der Manager einem Spieler zugewiesen hat. `BASKETBALL_POS_MOD`
verschiebt zwar ein paar Sub-Skill-Punkte je Rolle, aber niemand stand dadurch sichtbar an
einem anderen Platz.

**Fix.** `BASKETBALL_ROLLE_SLOT` bildet jede der sechs Rollen auf genau einen Court-Platz ab:

| Rolle | Platz | Begründung |
|---|---|---|
| `rimpressure` | 0 — Paint | Center/Power-Forward-artig, attackiert laut Rollentext den Ring |
| `floorgeneral` | 1 — Top of Key | Point-Guard-artig, führt Possessions, zentraler Blick aufs Feld |
| `fastbreak` | 2 — Flügel | Slasher/Umschaltspieler; SCHUSS_NAH-Bonus in `BASKETBALL_POS_MOD` (+2) |
| `helpdefense` | 3 — Flügel | Rotations-/Rebound-Verteidiger; kaum Fernwurf-Bonus |
| `perimeter` | 4 — Ecke | Winkelspieler; SCHUSS_FERN-Bonus (+3) |
| `clutchshot` | 5 — Ecke | reinster Distanzschütze; höchster SCHUSS_FERN-Bonus (+4) |

Die Reihenfolge der vier äußeren Rollen folgt der Netto-Neigung aus `BASKETBALL_POS_MOD`
(SCHUSS_NAH minus SCHUSS_FERN: fastbreak +2, helpdefense +1, perimeter −5, clutchshot −6) —
die Radien von Flügel (150px) und Ecke (145px) liegen ohnehin dicht beieinander, das ist
also eher eine dokumentierte als eine stark spürbare Feinsortierung. Die Zuteilung nach
SCHUSS_NAH bleibt als Rückfall bestehen: für Slots ohne gesetzte Rolle, für Unterzahl, und
für jede andere Feldspiel-Disziplin (Hockey/Football unverändert).

**Nur wirksam bei voller, eindeutiger Aufstellung.** `zuordneSlots()` verwendet die
rollenbasierte Zuteilung nur, wenn (a) die Disziplin Basketball ist, (b) keine
Unterzahl-Sonderregel greift und (c) JEDER gesetzte Spieler eine gültige, paarweise
verschiedene Rolle trägt (`u.slotGesetzt===true`, kein Rundlauf-Rückfall). Das deckt sich
mit dem realen Anwendungsfall (Manager stellt sechs Spieler auf sechs verschiedene
Rollen-Slots) und lässt jede kaderfeste Messung unberührt, weil `feldspielProbe`/
`disziplinProbe` (die einzigen Aufrufer von `miss-alle-disziplinen.mjs`) `place[]` nie
setzen — `slotGesetzt` bleibt dort für jeden Spieler `false`.

**Taktisches Verhalten.** Sobald eine Rolle gesetzt ist, trägt `BASKETBALL_POS_MOD` bereits
seit einer früheren Runde reale ±-Punkte auf SCHUSS_NAH/SCHUSS_FERN/AUFBAU/ZWEITCHANCE/ABWEHR
— das beeinflusst schon vor dieser PR die WUNSCHDISTANZ, mit der ein Ballführer seine
bevorzugte Wurfdistanz wählt (`profil=u.SCHUSS_FERN-u.SCHUSS_NAH`). Die neue
Court-Positionierung verstärkt das jetzt sichtbar: Ein Center steht jetzt auch tatsächlich
im Paint, nicht nur mit leicht höherem SCHUSS_NAH. Eine vollständige taktische Integration
im Sinn von P2 des Konzeptreviews (Rolle bestimmt, wer den Ball nach einem Korb bekommt,
wer den Pick-and-Roll ruft, wer als Erster hilft usw.) geht über den Rahmen dieser PR
hinaus — das bleibt eine eigene, größere Runde (P2/P3 des Konzeptreviews). Umgesetzt ist
hier ausschließlich die Positionierung: visuell vollständig, verhaltensseitig nur über den
bereits vorhandenen POS_MOD-Kanal.

**Visuelle Verifikation** (Playwright, `window.__olyArenaKader.aufstellung` mit allen zwölf
Test-Spielern auf unterschiedliche, gültige Rollen gesetzt): in einer eingespielten
Halbfeld-Szene (`t=17s`) stehen die beiden mit `clutchshot`/`perimeter` belegten Spieler
sichtbar in der Ecke, abseits vom Paint-Gedränge um den `rimpressure`-Spieler — deutlich
anders als die vorherige reine SCHUSS_NAH-Sortierung. Rein defensive Spieler (die ihrem
Gegenspieler folgen, nicht ihrem eigenen Slot) und Spieler in Screen-/Hilfe-/Ballbesitz-
Zuständen weichen wie vorgesehen von ihrem Home-Slot ab — das ist unverändertes, gewolltes
Verhalten (Screens/Hilfe/Wunschdistanz haben in `bewegeSpielerLive` Vorrang vor dem
Slot-Ziel).

## Teil 2: Ball-Pose-Fix

### Weg A — Handpunkt-Tabelle für `walk` (umgesetzt, erweitert)

**Ausgangslage, nachgeprüft:** Ein früherer PR hatte Weg A bereits TEILWEISE umgesetzt —
`BK_HAND_LINKS`/`BK_HAND_RECHTS` (9 Bilder, per Pixelscan gemessen) verankern den Ball beim
Dribbeln in Profilansicht (links/rechts) schon an der schwingenden Hand. Für "hinten"/"vorn"
fiel der Code aber auf einen NIE eigens vermessenen Festwert zurück (`[44,47]`, ohne
Dokumentation offenbar von `HOCKEY_HAND` übernommen) — der Ball blieb dort Bild für Bild an
derselben Stelle stehen. Sichtprüfung (Playwright, `renderProbe`-Kompositbild) zeigt den
Unterschied deutlich: in Profilansicht sitzt der Ball bereits sauber neben dem Körper, in
Front-/Rückenansicht überlappt er weite Teile des Torsos.

**Fix:** `BK_HAND_HINTEN`/`BK_HAND_VORN`, je 9 Bilder, per Pixelscan gemessen
(`scripts/messe-basketball-dribbel-handpunkt.mjs`, Guertelband y=28..54 — breiter als
`HOCKEY_HAND`s y=44..50, weil Bildspalte 3 sonst abgeschnitten wird; dieselbe Spalte-3-
Anomalie zeigt sich auch in den bestehenden `BK_HAND_LINKS`/`-RECHTS`-Werten bei y=36).
Ersetzt den Festwert in der Ball-Zeichenlogik. `BK_HAND_LINKS`/`-RECHTS` bleiben
unverändert (bereits korrekt gemessen).

**Rho-Auswirkung: keine, garantiert per Konstruktion.** `fsBall.x`/`.y`/`handOffX`/`bx`/`by`
werden ausschließlich innerhalb des Zeichenblocks gelesen und nirgends in die Simulation
zurückgeschrieben (geprüft: kein Treffer für `fsBall.` außerhalb des Draw-Codes und eines
Kommentars). Steal-/Pass-/Bewegungslogik lesen `traeger.x/y` direkt, nie den gezeichneten
Ball-Versatz. Diese Änderung ist eine reine Rendering-Korrektur.

**Nebeneffekt Football:** Dieselbe Handpunkt-Tabelle trägt laut bestehendem Code-Kommentar
auch einen getragenen Football (`feldspielDisc==="basketball"||feldspielDisc==="football"`,
so schon vor dieser PR angelegt, Chris' Auftragspunkt 6 vom 03.09.). Football bekommt die
verbesserte Front-/Rücken-Verankerung dadurch kostenlos mit — ebenfalls rein kosmetisch,
ohne jede rho-Wirkung (dieselbe Begründung wie oben).

### Weg C — `spellcast` statt `shoot` für den Wurf (NICHT umgesetzt — Asset-Lücke bestätigt)

Der aktuelle Wurf (`shoot`, 13 Bilder) ist ein Bogenschuss: ein Arm bleibt nahe am Gesicht
(Sehne spannen), der andere reicht waagerecht nach vorn (Bogen halten) — über die GESAMTE
Sequenz, nachgeprüft per `renderProbe` über acht `lunge`-Werte. Kein Einzelbild der
bestehenden Sequenz sieht wie ein Korbwurf aus; ein Umschalten auf einen anderen Frame
derselben Animation behebt das Problem nicht.

**Warum `spellcast` trotz vorhandener Blätter nicht einsetzbar ist, ohne neue Assets zu
laden:** Der Sprite-Baukasten (`public/sprites/baukasten/`) enthält zwar `z_body` (7 Bilder
— exakt das `spellcast`-Format) und Rassen-Varianten (`z_hoerner`, `z_lizard`, `z_ohren`,
`z_schwanz_bg/fg`, `z_fluegel_bg/fg`) sowie `t_body` (8 Bilder, `thrust`-Format) mit
Rüstungs-Varianten (`t_hood`, `t_leder`, `t_orc`) — das steht seit der 23.08.-Runde
("`Stoss-Satz (t_body, 8 Bilder)`, `Zauber-Satz (z_body, 7 Bilder)`") im Baukasten. Diese
Blätter wurden aber **ausdrücklich nur für die stehende Kaderlisten-Figur** übernommen, NIE
für die animierte Arena-Figur verdrahtet (`grep` bestätigt: `z_body`/`t_body` kommen im
gesamten `engine.js` nirgends außerhalb dieses einen Erklärkommentars vor). Entscheidend:
**nur der nackte Körper (Haut) hat diese Posen** — Kopf, Rüstung und Haar (die drei übrigen
Ebenen, die jede sichtbare Figur zusätzlich zum Körper trägt) existieren laut demselben
Kommentar ausschließlich als `slash`-Blätter (6 Bilder). Ein Basketballspieler in
`spellcast`-Pose würde also einen animierten nackten Torso mit eingefrorenem Kopf/Rüstung/
Haar aus einer GANZ ANDEREN Pose zeigen — sichtbar kaputt, kein Fortschritt gegenüber dem
Bogenschuss. Ein vollständiger, kohärenter `spellcast`-Charakter bräuchte `spellcast`-Blätter
für Kopf, Rüstung und Haar (mindestens die vier "vollen" Ebenen `k_/g_/r_/h_`, analog zum
bestehenden `walk`/`shoot`-Kern) — das sind neue Downloads aus dem LPC-Generator-Repo, die
der Auftrag für diese Runde ausdrücklich ausschließt ("ohne neue Asset-Downloads").

**Ehrliches Fazit:** Weg C bleibt eine Folgeaufgabe, sobald die fehlenden Kopf-/Rüstungs-/
Haar-`spellcast`-Blätter geladen werden dürfen (dieselbe Quelle wie die 23.08.-Runde,
`LiberatedPixelCup/universal-lpc-spritesheet-character-generator`, seitengeprüft offen).
Weg B (`thrust` als Ballführer-Pose, ebenfalls neue Assets nötig für Kopf/Rüstung/Haar) hat
dieselbe Lücke. Innerhalb dieser Runde ist Weg A der einzige umsetzbare, gemessene
Fortschritt.

## Messwerte

| | vorher (Baseline) | nachher |
|---|---:|---:|
| rho je Spiel, Basketball, kaderfest (Kader-Familie, `miss-alle-disziplinen.mjs 24 basketball`) | 0,769 | **0,769** (bit-identisch) |
| rho je Spiel, Basketball, zweiter Saatstrom (`--einzelkader`, eigener hartkodierter Kader) | — | 0,809 |
| rho je Spiel, Hockey (Kontrolle, unberührt) | 0,719 (Feldspieler, `stand-aller-disziplinen.md`) | 0,719 (Feldspieler) / 0,669 (alle 12) |
| rho je Spiel, Football (Kontrolle, unberührt) | 0,516 / 0,811 (`stand-aller-disziplinen.md`, älterer Stand) | 0,818 |

rho bit-identisch, weil Teil 1 nur bei einer vollständig gesetzten Aufstellung wirkt (die
kaderfeste Sonde setzt nie eine) und Teil 2 ausschließlich Rendering betrifft. Pp-Abweichung
wurde nicht neu gemessen: Weder die Eignungsmatrix noch ein Rezept-Koeffizient wurden
verändert, und die Positionierung wirkt nachweislich nicht in den kaderfesten Sonden — es
gibt daher nichts, was eine Pp-Bewegung auslösen könnte.

## Geänderte/neue Dateien

- `public/mockups/battle-mode.engine.js` — `BASKETBALL_ROLLE_SLOT`, rollenbasierter Zweig in
  `zuordneSlots()`, `BK_HAND_HINTEN`/`BK_HAND_VORN`, erweiterte Handpunkt-Auswahl im
  Ball-Zeichenblock.
- `scripts/messe-basketball-dribbel-handpunkt.mjs` — neues Messwerkzeug (Pixelscan, wie
  `messe-schach-uhr-handpunkt.mjs`), für eine künftige Nachmessung oder Erweiterung auf
  weitere Blätter wiederverwendbar.
