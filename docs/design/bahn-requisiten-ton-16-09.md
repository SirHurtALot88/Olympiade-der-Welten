# Bahn-Requisiten und Bahn-Ton: Time-Trial + Spurt (16.09.)

Auftrag B1+B2 aus `docs/pm-briefings/opus-plan-top-zehn-ueber-90-16-09.md` Abschnitt 5: Time-Trial
(Platz 10 der Scorecard, Gesamt 85,5 %) und Spurt (Platz 11, 83,0 %) hängen beide an derselben
Lücke — Assets-Kriterium A3 (disziplinrichtige Requisite) und A4 (Ton) fehlten für beide, obwohl
beide bereits arena-resolved sind und ihre rho-Werte (0,825 bzw. 0,894) deutlich über der 0,80-
Schranke liegen. **Reine Präsentation, kein Rezept-/Rangtreue-Risiko** — `wert()`, `tempoVon()`,
`rr()`, die Rennlogik: keine Zeile davon wurde angefasst.

Beide Aufträge fassen dieselbe `DISZIPLIN_PROP`-Objektregion und denselben Requisiten-Aufrufblock
in `zeichneSpurt()` an (echtes Merge-Konflikt-Risiko bei paralleler Arbeit) und liefen deshalb
nacheinander in einem Worktree, zwei getrennte Commits.

**Nachbesserungsrunde (dritter Commit):** die unabhängige Review von PR #952 fand einen echten,
nicht-blockierenden-aber-wichtigen A3-Befund gegen den Time-Trial-Helm (kein Rangtreue-/
Ton-Problem — Spurt und der Ton-Teil waren laut Review sauber): der Kopf-Anker war gegen eine
fiktive, undekorierte Referenzfigur gemessen, während alle 17 echten SQUAD/OPP-Kaderfiguren
bereits eine eigene Kopf-Dekoration tragen. Abschnitt „A3 — Startnummer-Weste auf der Brust"
unten dokumentiert den vollständigen Befund und den Umbau vom Kopf- auf einen Brust-Anker,
gegen alle 17 Kaderfiguren nachgewiesen statt gegen 1-2 Beispiele.

## Teil 1 — Time-Trial (Assets 55 → 100)

### A3 — Startnummer-Weste auf der Brust (nach Kopf-Requisite umgebaut)

**Vorher:** `DISZIPLIN_PROP` kannte acht Einträge, keinen für Time-Trial — ein Zeitfahrer trug
buchstäblich nichts, was ihn von einem Spurt-/Staffel-/Climbing-Läufer unterscheidet (Scorecard-
Befund, PR #948 hat es selbst als „bewusst ausgelassen" protokolliert).

**Erster Entwurf (verworfen): Aero-Helm am Kopf.** Ein `ZF_HELM`-Eintrag mit Kopf-Anker
(`y≈17, x≈31-32`, per Pixelscan an `window.__arena.renderProbe("__Sondentest",...)` gemessen —
derselben Methode wie `TAKESHI_HAND`/`FUSS_EISKUNSTLAUF`). Die unabhängige Review von PR #952 hat
diesen Entwurf **zu Recht verworfen**: die Messung lief gegen eine fiktive, komplett undekorierte
Referenzfigur, die im echten Kader gar nicht vorkommt. Nachgesehen im `BAU`-Katalog (`:1165 ff.`):
**alle 17 SQUAD/OPP-Demo-Charaktere** haben am Kopf bereits etwas — Helm+Hörner (Draco), Krone+Haar
(King Arlen Morgolor, Inefinna), langes Haar (Johanna, Jorund, Lulu, Ralazar the Balanced,
Cassandra), Kapuze (Greenkraut) oder sind komplett `vollbild`/`reiherMech` (Lava Golem, Krolach,
Krag'Zul, Tidesprinter, Seraph-11, je ein eigenes Blatt statt des LPC-Baukastens). Die eigene
Verifikation hatte das mit „auf dunklen/großköpfigen Charakteren nur ein kleiner Akzent" bereits
angedeutet, aber die Tragweite unterschätzt: der Reviewer fand am realen Kader **null** sichtbare
Helm-Pixel bei Greenkraut (dem eigenen Positivbeispiel im ersten Doku-Stand) und kaum etwas bei
Draco/Krag'Zul/Tidesprinter. Ein größerer/kontrastreicherer Kopf-Entwurf hätte denselben Fehler nur
in abgeschwächter Form wiederholt — jede Requisite AM KOPF konkurriert dort mit etwas, das laut
BAU-Katalog schon da ist.

**Nachher: weg vom Kopf, auf die Brust.** Genau die Ausweichoption, die der Opus-Plan selbst nennt
(Abschnitt 8, Punkt 2: „eine Zeitfahr-Rückennummer in eigener Farbe"). Neuer Anker `ZF_BRUST`
(Feldname `brust`, derselbe freie-Objektliteral-Vertrag wie `eiskunstlauf.fuss`), per Pixelscan neu
gemessen — diesmal für den Torso statt den Kopf: über `y=35..49` ist die Silhouette in **jeder**
der vier Blickrichtungen mindestens 21 px breit, deutlich stabiler als der schmale, stark
dekorierte Kopfbereich, und kein `BAU`-Flag setzt dort eine eigene Dekoration (`ruest`/`ruestTon`
färben nur die Grundfläche ein, auf der eine hell-kontrastierte Weste trotzdem aufliegt — dasselbe
Prinzip wie das Startnummernband auf dem Arm, das auf jeder Armfarbe sitzt, weil es nach der Figur
gezeichnet wird). Anker bei `y=41` (Torso-Mitte), `x` variiert leicht je Blickrichtung
(30–34, aus derselben Pixelscan-Messung). `ZF_BRUST_PHASEN` bleibt an `u.vizNeigung` gekoppelt
(leichte Vor-/Rückneigung der ganzen Weste statt eines Helmkeils) + `zeichneZeitfahrWeste()`:
eine große, flächige Weste mit diagonalem Rennstreifen und angedeuteter Ziffer. Aufrufstelle
unverändert in `zeichneSpurt()`, gleiche Z-Skalierungsformel, gleicher `ctx.save/scale/restore`-
Block.

**Farbwahl, zweite Runde.** Der erste Brust-Entwurf nutzte ein kräftiges Gelb (`#f2c230`) — beim
Diff-Test gegen den vollen Kader fiel auf, dass `RUEST_TON.gold` (`:887 ff.`, King Arlen Morgolor
und Inefinna tragen `ruestTon:"gold"`) praktisch denselben Ton einfärbt (`#D19B2E`/`#F0C858`): die
Weste wäre dort gegen die eigene Rüstungsfarbe verschwunden — genau der Fehler, den dieser Auftrag
beheben soll, nur an anderer Stelle wiederholt. Endgültige Farbe: kräftiges Magenta (`#ff2f92`) —
kein Ton im `BAU`-Katalog (die drei `RUEST_TON`-Rampen gold/bronze/dunkel, alle `vollbildFarbe`-
und Hautfarbwerte) liegt in der Nähe.

**Verifikation gegen den vollen Kader, nicht gegen 1-2 Beispiele.** Dafür ein neues, permanentes
Diagnose-Werkzeug `window.__arena.zeitfahrWesteProbe(name, dir)` (rein lesend, kein `rr()`, nach
demselben Muster wie `renderProbe`/`hockeyschlaegerProbe`) — zeichnet eine Figur exakt wie
`renderProbe(name,"walk",false,dir)` und hängt danach die **echte Produktionsformel** aus
`DISZIPLIN_PROP["time-trial"]` an, kein zweites Formel-Duplikat. Für alle 17 SQUAD/OPP-Figuren
diff-getestet (Bild mit vs. ohne Weste, damit ein Treffer nicht zufällig mit einer bereits
vorhandenen Körperfarbe verwechselt wird):

| Charakter | Diff-Pixel | Magenta-Kernfarbe | Charakter | Diff-Pixel | Magenta-Kernfarbe |
|---|--:|--:|---|--:|--:|
| Draco | 169 | 63 | Krag'Zul | 148 | 60 |
| Lava Golem | 137 | 45 | Tidesprinter | 249 | 90 |
| Krolach | 135 | 42 | Seraph-11 | 248 | 90 |
| Johanna | 157 | 61 | Ralazar the Balanced | 143 | 56 |
| King Arlen Morgolor | 107 | 27 | Cassandra | 158 | 61 |
| Gram | 157 | 61 | Rhyx'Tal | 228 | 76 |
| Xelara | 171 | 68 | Jorund | 163 | 61 |
| Inefinna | 106 | 27 | Lulu | 160 | 61 |
| Greenkraut | 219 | 78 | | | |

**Alle 17 von 17 zeigen einen klaren Treffer** (Minimum 106 Diff-Pixel/27 Magenta-Kernpixel bei
King Arlen Morgolor/Inefinna, den beiden Gold-gerüsteten Figuren — nicht mehr 0 wie beim
verworfenen Helm-Entwurf gegen Greenkraut). Auch die fünf `vollbild`/`reiherMech`-Figuren
(Lava Golem, Krolach, Krag'Zul, Tidesprinter, Seraph-11 — andere Sprite-Blätter, andere
Körperproportionen) zeigen die Weste sichtbar auf dem Torso, nicht abgeschnitten oder frei
schwebend. Screenshots aller 17 wurden während der Verifikation erzeugt und geprüft (nicht
eingecheckt, reine Verifikationsartefakte).

### A4 — Ton

**Vorher:** `TON_KATALOG["time-trial"]` stand seit PR 0.1 (12.09.) vollständig mit fünf Ereignissen
(`start`, `zwischenzeit`, `bergauf`, `ziel`, `publikum`) — `sfx("time-trial", …)` stand an **null**
Aufrufstellen.

**Nachher:** vier `sfx()`-Aufrufe in `stepZeitfahren()`, jeder an einer Kante, nicht an einem
Zustand (Vorbild `stepStaffel()`):

| Ereignis | Auslöser | Merkerfeld |
|---|---|---|
| `start` | Übergang "wartet" → "fährt" (deckt auch den ersten Fahrer ab, dessen `startT` schon ≤ dem allerersten `rennT` liegt und der `vizRampe` nie >0 sieht) | `u.vizStartTon` |
| `bergauf` | `gelaendeAn(pos).art` wechselt auf `"steigung"` | `u.vizZone` (hält die zuletzt gesehene Zonenart) |
| `zwischenzeit` | `u.zz[]` (von `stepSpurt()` im selben Tick gefüllt) wächst um einen Eintrag | `u.vizZzTonN` |
| `ziel` | `u.fertig` wird zum ersten Mal gesetzt | `u.vizZielTon` |

`publikum` (Loop) ist **ausdrücklich nicht Teil des Auftrags** — A4 ist binär, zwei Ereignisse
genügen laut Scorecard-Methodik, und ein Loop bräuchte die `tonLoopStart`/`tonLoopStop`-Paarung mit
eigenem `reset()`-N1-Fix (zusätzliches Risiko ohne zusätzliche Punkte).

**Vertrag eingehalten:** alle neuen Felder sind `viz*`-Einmal-Merker, keiner fließt zurück in
`tempoVon()`/`rr()`/`MOTOREN["time-trial"].wert()`. `sfx()` selbst ruft nachweislich nie `rr()` und
ist ohne `AudioContext` ein stiller No-Op — `disziplinProbe()`/`miss-alle-disziplinen.mjs`
durchlaufen die Funktion trotzdem mit jedem Frame, ohne Nebenwirkung.

## Teil 2 — Spurt (Assets 55 → 100, Movement 85 → 100)

### A3 — Spikes

**Vorher:** kein `DISZIPLIN_PROP.spurt`-Eintrag.

**Nachher:** `SPURT_FUSS` **wiederverwendet** `FUSS_EISKUNSTLAUF` unverändert (nicht neu vermessen)
— dessen eigener Kommentar hält fest, dass die Tabelle am generischen `body_walk`/`bodyw_walk`-
Sprite gemessen wurde, demselben Blatt, das jeder Bahn-Läufer für seinen Laufzyklus benutzt. Eine
zweite Fußgeometrie zu vermessen wäre dieselbe Zahl noch einmal erhoben. `SPIKES_PHASEN`
(`laufen`/`huerde`) + `zeichneSpikes()` (helle Sohle, drei dunkle Zacken als Spikes-Erkennungs-
merkmal). Aufrufstelle analog zu Teil 1, gegated auf `BA().spurt`, Phase aus `u.huerde>0`.

### A4 — Ton

`TON_KATALOG.spurt` stand ebenfalls seit PR 0.1 vollständig (`startschuss`, `huerde`, `riss`,
`ziel`, `publikum`) — vier `sfx()`-Aufrufe neu in `stepHuerden()`:

| Ereignis | Auslöser |
|---|---|
| `startschuss` | einmal je Rennen, Modul-Flagge `spurtStartschussAn` (1:1 `staffelStartschussAn`-Muster, inkl. `reset()`-N1-Fix) |
| `huerde` | Kante `u.huerde>0` (Eintritt in den Hindernis-Stopp) |
| `riss` | Kante `u.leer` wird `true` (Erschöpfung erreicht) |
| `ziel` | `u.fertig` wird zum ersten Mal gesetzt |

### M4-Bonus — Hürdenflug-Pose

`u.vizHuerde` (0..1, weich aus `u.huerde>0` nachgezogen, dieselbe Glättungskonstante wie
`vizErschoepft`) wird in `zeichneSpurt()` gelesen und ergibt eine kleine Sprunghöhe plus eine
minimal gestreckte Silhouette — exakt nach dem `zfTilt`/`zfHaltung`-Muster, das PR #948 für
Zeitfahren vorgemacht hat, gegated auf `BA().spurt` (jede andere Bahn bit-identisch).

## rho — unverändert (Isolationsnachweis)

```
node scripts/miss-alle-disziplinen.mjs 24 time-trial spurt staffel takeshis-castle climbing
```

```
staffel             bahn    12   0.899   Spannweite 0.100   Saison 0.951   bestanden
spurt               bahn    12   0.894   Spannweite 0.138   Saison 0.916   bestanden
takeshis-castle     bahn    12   0.879   Spannweite 0.101   Saison 0.958   bestanden
climbing            bahn    12   0.834   Spannweite 0.209   Saison 0.860   bestanden
time-trial          bahn    12   0.825   Spannweite 0.082   Saison 0.825   bestanden
```

Bit-identisch zum Vorherstand für alle fünf Zeilen (Time-Trial 0,825, Spurt 0,894 — genau die
beiden Zahlen, die der Plan als Ziel nennt). Vollständiger Lauf über alle zwanzig Disziplinen
(`node scripts/miss-alle-disziplinen.mjs 24`, keine Filterung) bestätigt: **jede einzelne der
zwanzig Zeilen ist bit-identisch** zur zuletzt bekannten Basislinie (`data/generated/rangtreue-
basislinie.json`, Stand 16.09.) — insbesondere die drei anderen Bahn-Disziplinen (Staffel,
Takeshi's Castle, Climbing), die dieselbe `DISZIPLIN_PROP`-Region und denselben Aufrufblock in
räumlicher Nähe teilen, haben sich um keine Nachkommastelle bewegt.

| Disziplin | rho je Spiel | Abnahme |
|---|---:|---|
| speed-schach | 0,908 | bestanden |
| staffel | 0,899 | bestanden |
| spurt | 0,894 | bestanden |
| showcase | 0,892 | bestanden |
| eiskunstlauf | 0,885 | bestanden |
| takeshis-castle | 0,879 | bestanden |
| breaking | 0,869 | bestanden |
| wettessen | 0,845 | bestanden |
| gewichtheben | 0,843 | bestanden |
| climbing | 0,834 | bestanden |
| fechten | 0,826 | bestanden |
| **time-trial** | **0,825** | **bestanden** |
| tennis | 0,825 | bestanden |
| basketball | 0,769 | knapp |
| football | 0,722 | knapp |
| i-spy | 0,684 | durchgefallen |
| hockey (alle) | 0,669 | durchgefallen |
| hockey (nur Feldspieler) | 0,719 | knapp |
| mini-dm | 0,256 | durchgefallen |
| battlefield | 0,251 | durchgefallen |
| tdm | 0,165 | durchgefallen |

## Technische Checks

- `node --check public/mockups/battle-mode.engine.js` → OK.
- `git diff --stat origin/main` → nur `public/mockups/battle-mode.engine.js` (plus dieses
  Dokument) geändert, keine Nebenwirkung auf andere Dateien. Die Nachbesserungsrunde allein
  (dieser Commit gegen den vorigen) ändert 121 Zeilen neu, 83 gelöscht — überwiegend der
  Umbau von `ZF_HELM`/`zeichneAeroHelm` auf `ZF_BRUST`/`zeichneZeitfahrWeste` plus das neue
  `zeitfahrWesteProbe()`-Diagnosewerkzeug.
- `npx tsc --noEmit` → 906 Fehler, **identisch** zu einem frischen `origin/main`-Checkout
  (gegengeprüft in einem separaten Worktree) — ausschließlich vorbestehende Typfehler in
  `tests/*.ts`, `public/mockups/*.js` ist nicht Teil von `tsconfig.json`s `include`.
- `npx tsx scripts/pruefe-slot-invariante.ts` → Maximum über alle 20 Disziplinen x 6 Größen:
  0,005 Pp (mini-dm), Time-Trial/Spurt bei 0,000-0,003 Pp — weit unter der 0,2-Pp-Schranke.
- `npx vitest run tests/spiele-bahn-invarianten.test.ts tests/battle-arena-rennplan-ansage.test.ts`
  → 2 Dateien, 24 Tests, alle grün.
- `npx vitest run tests/battle-zielansage-kontrakt.test.ts tests/battle-arena-heal-attribution.test.ts
  tests/battle-mode-arena-team-points.test.ts tests/arena-headless-runner.test.ts
  tests/battle-arena-ein-modell-ueberall.test.ts` → 5 Dateien, 101 Tests, alle grün.

## Visuelle Verifikation

Chromium unter `/opt/pw-browsers` gegen `public/mockups/battle-mode.html` (Playwright, `file://`-
URL, kein Server nötig — `#t2` öffnet die Arena, `window.__arena.setDisc(...)`, `#play`).

**Pixel-genauer Nachweis statt Augenschein allein, zweimal.** Erste Runde (Renn-Simulation,
zwölf Läufer): die Canvas-Pixel eines laufenden Time-Trial-Rennens wurden per `getImageData()`
nach der Requisitenfarbe durchsucht — für alle zwölf Läufer fand sich ein Treffer-Cluster
innerhalb weniger Pixel des rechnerisch erwarteten Ankerpunkts (aus derselben
`x-32*Z+cx*Z`/`y-46*Z+cy*Z`-Formel wie im Code). Das belegt: die Requisite wird korrekt Z-skaliert
an der beabsichtigten Position gezeichnet, für jede der zwölf unterschiedlich großen Kaderfiguren.
Zweite Runde, NACH dem Review-Fund und dem Umbau vom Kopf auf die Brust: derselbe Diff-Test gegen
alle 17 SQUAD/OPP-Kaderfiguren (s. Tabelle oben) statt gegen ein simuliertes Rennen mit zufälliger
Kaderauswahl — genau die Lücke, die der erste Verifikationsdurchgang hatte („1-2 Beispielfiguren
sehen gut aus" ist keine Aussage über den vollen Kader).

**Am Bild:**
- **Time-Trial:** die magentafarbene Weste mit diagonalem Rennstreifen ist auf der Brust **aller
  17 Kaderfiguren** sichtbar, einschließlich der fünf `vollbild`/`reiherMech`-Figuren (andere
  Sprite-Blätter) und der beiden `ruestTon:"gold"`-Figuren (wo die ursprüngliche gelbe Fassung
  verschwunden wäre, s. „Farbwahl, zweite Runde" oben). Kein Charakter zeigt 0 oder nahe-0
  Diff-Pixel — der Fehler, den die Review am Kopf-Entwurf fand, ist am neuen Anker nicht
  reproduzierbar.
- **Spurt:** eine helle Sohle mit Spikes-Zacken ist am Fußpunkt sichtbar; wie bei
  `FUSS_EISKUNSTLAUF` bereits dokumentiert, wandert der tatsächliche Fuß im Laufzyklus um mehrere
  Pixel um den festen Ankerpunkt — der Effekt ist an einigen Frames deutlicher als an anderen,
  dieselbe akzeptierte Unschärfe wie beim Vorbild. Von der Nachbesserung nicht betroffen (Review
  fand ausschließlich den Time-Trial-Helm problematisch, Spurt/Ton waren laut Review sauber).
- **Gegenprobe:** `setDisc('staffel')`, `setDisc('takeshis-castle')`, `setDisc('climbing')` zeigen
  keine Spur der neuen Requisiten oder Posen — die Gates (`BA().zeitfahren`/`BA().spurt`) greifen
  nachweislich nur bei ihrer eigenen Disziplin, bestätigt sowohl durch den bit-identischen
  rho-Isolationsnachweis oben als auch durch Sichtprüfung der Screenshots.

**Ton nicht hörbar in Playwright** — stattdessen durch Code-Inspektion verifiziert: alle acht neuen
`sfx()`-Aufrufe (vier je Disziplin) rufen ausschließlich Ereignisnamen auf, die in
`TON_KATALOG["time-trial"]`/`TON_KATALOG.spurt` existieren (`start`/`bergauf`/`zwischenzeit`/`ziel`
bzw. `startschuss`/`huerde`/`riss`/`ziel`), an Kanten im Bewegungsablauf, die dem `stepStaffel()`-
Vorbild entsprechen. Während der Entwicklung diente ein Konsolen-Log-Abgriff (temporär, an der
Aufrufstelle in `zeichneSpurt()`) der Positionsverifikation für den Kopf-Entwurf und wurde vor
dem ersten Commit vollständig entfernt — kein Debug-Code im Produktionspfad. Das dauerhafte
Diagnose-Werkzeug `window.__arena.zeitfahrWesteProbe()` (s. oben) ist bewusst **kein** Debug-Rest,
sondern nach demselben Muster wie `renderProbe`/`hockeyschlaegerProbe` als permanente, rein
lesende Sonde angelegt — genau das fehlte, um den Kopf-Fehler vor dem ersten Commit gegen den
vollen Kader zu fangen, und steht jetzt für künftige A3-Verifikationen bereit.

## Nicht Teil dieser PR

- `TON_KATALOG`/`gelaendeFaktor()`/`tempoVon()`/`wert()`/die Rennlogik — nur gelesen, keine Zeile
  verändert.
- Publikums-Loop bei Time-Trial und Spurt (s. B1.b im Plan) — Risiko ohne zusätzliche Punkte.
- Scorecard-Nachzug (`docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`) —
  gehört laut Plan Abschnitt 6.1 in einen eigenen, sequenziellen PR, nachdem dieser hier gemergt ist.
- Eine physisch korrekte Sichtbarkeit der Weste je Blickrichtung (z. B. nur von vorn, nicht von
  hinten) — wie jede andere Requisite in diesem Katalog (Hockeyschläger, Schachuhr, Startnummern-
  band) wird sie aus allen vier Richtungen gezeichnet, kreative Vereinfachung statt physikalischer
  Genauigkeit, konsistent mit dem Rest des Katalogs.
