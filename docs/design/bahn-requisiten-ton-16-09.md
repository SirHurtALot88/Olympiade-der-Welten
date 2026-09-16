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

## Teil 1 — Time-Trial (Assets 55 → 100)

### A3 — Aero-Helm

**Vorher:** `DISZIPLIN_PROP` kannte acht Einträge, keinen für Time-Trial — ein Zeitfahrer trug
buchstäblich nichts, was ihn von einem Spurt-/Staffel-/Climbing-Läufer unterscheidet (Scorecard-
Befund, PR #948 hat es selbst als „bewusst ausgelassen" protokolliert).

**Nachher:** `ZF_HELM` (neunter `DISZIPLIN_PROP`-Eintrag, Kopf- statt Hand-Anker, Feldname `kopf`
— derselbe freie-Objektliteral-Vertrag wie bei `eiskunstlauf.fuss`) + `ZF_HELM_PHASEN`
(`steigung`/`abfahrt`/`ebene`, gesteuert vom selben `u.vizNeigung`, das PR #948 schon für die
Körperhaltung liest) + `zeichneAeroHelm()`. Aufrufstelle in `zeichneSpurt()`, direkt neben dem
Takeshi-Startnummernband, **innerhalb desselben** `ctx.save()/scale()/restore()`-Blocks, mit
derselben `x-32*Z+cx*Z`/`y-46*Z+cy*Z`-Ankerformel wie Hockey/Heben/Takeshi (Z-Skalierung inklusive
— die 12.09.-Falle "ohne Z-Skalierung driftet die Requisite 5-10px je Figurgröße" betrifft diesen
Code also nicht).

**Ankerpunkt gemessen, nicht geschätzt.** Vor dem Bauen geprüft: es gab noch keine `KOPF_`-
Ankertabelle für Bahn-Läufer, wohl aber die etablierte Pixelscan-Methode (`window.__arena.
renderProbe`, dasselbe Werkzeug wie bei `TAKESHI_HAND`/`FUSS_EISKUNSTLAUF`). Per Playwright über
alle vier Blickrichtungen vermessen: der Kopf beginnt bei y=11 (Scheitel) und erreicht bei y≈17
seine volle Breite (~20px), die Schulterbreite (~25-31px) setzt erst ab y≈30-32 ein — deckt sich
mit dem dokumentierten `TAKESHI_HAND`-Befund "Schulter bei y=32". `y=17, x≈31-32` liegt damit sicher
im Kopf. Praktisch wird nur Richtung 3 ("rechts") erreicht, weil Time-Trial nicht `route:true`
setzt (anders als Takeshi) — die übrigen drei Einträge bleiben trotzdem vollständig, für denselben
Fallback-Vertrag wie jede andere Requisite der Tabelle.

**Sichtbarkeits-Nachbesserung.** Der erste Entwurf (dunkler Rand, Radius 4,4/3,4 Zellen, Farbe
`#2f6fb0`) verschwand per Pixelscan zwar nachweislich an der richtigen Stelle, war aber am
32-px-Sprite gegen dunkle Charakterköpfe kaum zu erkennen. Zweiter Durchgang: größer (5,2/4,0),
hellerer Blauton (`#4fa3e0`), heller statt dunkler Rand, plus ein heller Diagonalstreifen über die
Schale (das klassische Rennhelm-Erkennungsmerkmal UND ein zweiter Kontrastanker). Auf hellen/
mittelhellen Charakteren (z. B. "Gleichmaß Greenkraut") ist der Helm danach klar als blauer Akzent
am Kopf zu erkennen; auf sehr dunkel/groß-behaupteten Charakteren (z. B. "Gleichmaß Draco", ein
großköpfiges Chassis) bleibt er ein kleiner, aber vorhandener Akzent — dieselbe Klasse Kompromiss,
die `FUSS_EISKUNSTLAUF` für sich selbst dokumentiert ("ein paar Pixel Wackeln ... ist der
akzeptierte Kompromiss").

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
- `git diff --stat origin/main` → nur `public/mockups/battle-mode.engine.js` geändert (262
  Zeilen neu, 15 gelöscht), keine Nebenwirkung auf andere Dateien.
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

**Pixel-genauer Nachweis statt Augenschein allein:** die Canvas-Pixel wurden per
`getImageData()` nach der Schalenfarbe des Helms (`#4fa3e0`) durchsucht — für alle zwölf Läufer
eines Time-Trial-Rennens fand sich ein Treffer-Cluster innerhalb weniger Pixel des rechnerisch
erwarteten Ankerpunkts (aus derselben `x-32*Z+cx*Z`/`y-46*Z+cy*Z`-Formel wie im Code). Das belegt:
die Requisite wird korrekt Z-skaliert an der beabsichtigten Kopfposition gezeichnet, für jede der
zwölf unterschiedlich großen Kaderfiguren, nicht nur zufällig für eine.

**Am Bild:**
- **Time-Trial:** ein heller Blauton mit Diagonalstreifen ist am Kopf sichtbar, auf mittelhellen
  Charakteren klar als Helm lesbar, auf sehr dunklen/großköpfigen Charakteren ein kleinerer, aber
  vorhandener Akzent (s. „Sichtbarkeits-Nachbesserung" oben — ehrlich benannte Grenze, nicht
  verschwiegen).
- **Spurt:** eine helle Sohle mit Spikes-Zacken ist am Fußpunkt sichtbar; wie bei
  `FUSS_EISKUNSTLAUF` bereits dokumentiert, wandert der tatsächliche Fuß im Laufzyklus um mehrere
  Pixel um den festen Ankerpunkt — der Effekt ist an einigen Frames deutlicher als an anderen,
  dieselbe akzeptierte Unschärfe wie beim Vorbild.
- **Gegenprobe:** `setDisc('staffel')`, `setDisc('takeshis-castle')`, `setDisc('climbing')` zeigen
  keine Spur der neuen Requisiten oder Posen — die Gates (`BA().zeitfahren`/`BA().spurt`) greifen
  nachweislich nur bei ihrer eigenen Disziplin, bestätigt sowohl durch den bit-identischen
  rho-Isolationsnachweis oben als auch durch Sichtprüfung der Screenshots.

**Ton nicht hörbar in Playwright** — stattdessen durch Code-Inspektion verifiziert: alle acht neuen
`sfx()`-Aufrufe (vier je Disziplin) rufen ausschließlich Ereignisnamen auf, die in
`TON_KATALOG["time-trial"]`/`TON_KATALOG.spurt` existieren (`start`/`bergauf`/`zwischenzeit`/`ziel`
bzw. `startschuss`/`huerde`/`riss`/`ziel`), an Kanten im Bewegungsablauf, die dem `stepStaffel()`-
Vorbild entsprechen. Ein Konsolen-Log-Abgriff (`window.__zfHelmDebug`/vergleichbare Instrumentierung)
diente während der Entwicklung der Positionsverifikation und wurde vor dem Commit vollständig
entfernt — kein Debug-Code im Produktionspfad.

## Nicht Teil dieser PR

- `TON_KATALOG`/`gelaendeFaktor()`/`tempoVon()`/`wert()`/die Rennlogik — nur gelesen, keine Zeile
  verändert.
- Publikums-Loop bei Time-Trial und Spurt (s. B1.b im Plan) — Risiko ohne zusätzliche Punkte.
- Scorecard-Nachzug (`docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`) —
  gehört laut Plan Abschnitt 6.1 in einen eigenen, sequenziellen PR, nachdem dieser hier gemergt ist.
- Eine größere/andere Requisiten-Silhouette für den Aero-Helm, falls die 32-px-Lesbarkeit auf
  Dauer nicht überzeugt (s. Plan Abschnitt 8, Punkt 2) — diese PR liefert die im Plan beschriebene
  Iteration (eine Nachbesserung bereits eingearbeitet), eine weitere wäre eine eigene Runde.
