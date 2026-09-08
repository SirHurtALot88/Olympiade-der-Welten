# Opus-Overseer-Review: PR #858 — Breaking Folter/Survive-Move-Namen + Cypher-Bühnenbild (08.09.)

**Rolle:** unabhängiger Zweitprüfer, nicht an der PR beteiligt — analog zu den bereits erfolgten
Reviews von PR #844, #850, #854. Alle Zahlen in diesem Dokument sind selbst nachgemessen, nicht aus
der PR-Beschreibung übernommen (dort abgeschrieben wird explizit vermerkt).

**Geprüft:** `SirHurtALot88/Olympiade-der-Welten` PR #858, Branch
`claude/breaking-folter-survival-umsetzung-08-09`, Kopf `bb330d8a`, Basis `9e97ecff` (= `origin/main`
zum Prüfzeitpunkt). Isolierter Worktree unter `/tmp/wt-review-858`, `node_modules` vom Haupt-Checkout
symlinkt. Der geteilte Haupt-Worktree wurde nicht angefasst.

## Freigabe-Empfehlung: **FREIGEBEN**

Alle sechs geforderten Prüfpunkte (a–f) sind unabhängig nachgemessen und bestätigen die
PR-Beschreibung punktgenau. Ein Nebenbefund (Testflakiness, siehe 6.) ist umgebungsbedingt und keine
Nacharbeit an der PR. Ein CI-Job war zum Prüfzeitpunkt noch nicht durchgelaufen (siehe 8.) — kein
Blocker für die eigene Messung, aber vor dem Merge sollte er grün abgewartet werden.

---

## 1. Umfang des Diffs

```
lib/lineups/matchday-slot-roles.ts   |  12 +--
public/mockups/battle-mode.engine.js | 200 +++++++++++++++++++++++++++++++++--
2 files changed, 200 insertions(+), 12 deletions(-)
```

Vier Hunks in `battle-mode.engine.js`: (1) sechs `label`/`text`-Umbenennungen im
`SLOTS_JE_DISC.breaking`-Array, (2) `cypher:true` samt Begründungskommentar im Breaking-Eintrag von
`BUEHNE_ART`, (3) eine neue Dispatcher-Zeile in `zeichneBuehne()`, (4) die neue Funktion
`zeichneBreaking()` (rund 165 Zeilen). Sonst nichts — kein Zugriff auf `stepBuehne()`,
`bauBuehne()`, `WERTUNG_AUFTRITT` oder eine der anderen acht Bühnen-Zweige.

## 2. Prüfpunkt (a): `finaleset`-Diskrepanz bewusst unverändert?

Die Opus-Synthese (#857) hatte gefunden: `finaleset` trägt im Motor `klein:"stamina"`, in der
Produktion (`matchday-slot-roles.ts`) aber `focus:["power","torment"]` — beide Texte beschreiben den
Move als „über Power und Torment", der Motor widerspricht seinem eigenen Text. Auftrag: die Zeile
umbenennen, ohne den numerischen Wert anzufassen.

Diff nachgeprüft, Zeile für Zeile:

```diff
- {id:"finaleset",label:"Finale Set",text:"...",gross:"power",klein:"stamina",last:"determination",mueh:"medium",profil:{torment:21.2,...}}
+ {id:"finaleset",label:"Unbroken",  text:"...",gross:"power",klein:"stamina",last:"determination",mueh:"medium",profil:{torment:21.2,...}}
```

`klein:"stamina"` ist **identisch** geblieben. Alle numerisch wirksamen Felder (`id`, `gross`,
`klein`, `last`, `mueh`, `profil`) sind zeichengenau unverändert — nur `label` und `text` (die
sichtbaren Strings) wurden getauscht. Dasselbe gilt in `matchday-slot-roles.ts` für alle sechs
`roleTheme(...)`-Aufrufe: `focus`/`strain`/`fatigueProfile`/`classHints` (Argumente 4–8) sind
byte-identisch, nur `label` (Argument 2) und `description` (Argument 3) geändert. Verifiziert per
`grep -n "\.label\b"` in `matchday-slot-roles.ts`: `label` wird an genau einer Stelle nur zur
Anzeige durchgereicht (`label: theme.label`), nie als Schlüssel für einen Lookup verwendet — eine
Umbenennung kann dort also nichts numerisch verschieben.

**Ergebnis: (a) bestätigt.** Die dokumentierte Diskrepanz besteht unverändert fort (das ist
beabsichtigt — sie zu beheben war ausdrücklich nicht Teil dieses Auftrags) und wurde durch die PR
nicht verschlimmert oder verändert.

## 3. Prüfpunkt (b): `miss-alle-disziplinen.mjs 24` für alle neun Bühnen-Disziplinen

Selbst gemessen, zweimal: einmal auf `bb330d8a` (PR-Kopf), einmal auf den zwei geänderten Dateien
temporär auf `9e97ecff` (PR-Basis) zurückgesetzt — **im selben Worktree**, um jede Umgebungs-Drift
auszuschließen (Kader-Quelle, Node-Version, Zufalls-Startzustand identisch).

**PR-Kopf (`bb330d8a`):**

| Disziplin | rho/Spiel | Spannweite | rho/Saison | Spannweite | Abnahme |
|---|---:|---:|---:|---:|---|
| speed-schach | 0.908 | 0.066 | 0.972 | 0.042 | bestanden |
| showcase | 0.892 | 0.158 | 0.937 | 0.077 | bestanden |
| eiskunstlauf | 0.875 | 0.075 | 0.965 | 0.049 | bestanden |
| **breaking** | **0.869** | **0.114** | **0.951** | **0.168** | bestanden |
| gewichtheben | 0.854 | 0.209 | 0.923 | 0.273 | bestanden |
| wettessen | 0.845 | 0.139 | 0.930 | 0.091 | bestanden |
| tennis | 0.825 | 0.210 | 0.839 | 0.280 | bestanden |
| fechten | 0.816 | 0.192 | 0.888 | 0.133 | bestanden |
| i-spy | 0.684 | 0.353 | 0.804 | 0.608 | **durchgefallen** |

**PR-Basis (`9e97ecff`, Dateien lokal zurückgesetzt):** exakt dieselben neun Zeilen, exakt dieselben
Zahlen bis auf die dritte Nachkommastelle — **bit-identisch** in allen vier Spalten für alle neun
Disziplinen, Breaking eingeschlossen.

Damit ist die PR-Behauptung „0,869/0,114/0,951/0,168, bit-identisch zu vorher" **exakt bestätigt**,
nicht nur für die acht Geschwister, sondern auch für Breaking selbst — was zu erwarten war, weil die
Move-Umbenennung die `profil`-Gewichte nicht anfasst (Punkt a) und `zeichneBreaking()` rein
zeichnerisch ist (Punkt e).

**Nebenbefund, nicht Teil dieses Auftrags:** `i-spy` fällt mit 0,684 unter die 0,80-Schranke aus
CLAUDE.md — und zwar **identisch** vor und nach dieser PR. Das ist ein vorbestehendes Problem einer
anderen Disziplin, das PR #858 weder verursacht noch verschlimmert. Erwähnenswert für die
Priorisierung der nächsten Runde, aber kein Grund, diese PR zurückzuhalten.

## 4. Prüfpunkt (c): `pruefe-slot-invariante.ts`

```
Maximale Abweichung ueber alle 20 Disziplinen x 6 Groessen: 0.005 Pp (mini-dm @ n=2, Attribut stamina)
Invariante haelt: alle Werte <= 0.2 Pp.
```

Alle 20 Disziplinen × 6 Kadergrößen liegen deutlich unter der 0,2-Pp-Toleranz; der größte Ausreißer
(0,005 Pp) betrifft `mini-dm`, nicht `breaking`. Bestanden.

## 5. Prüfpunkt (d): Passt `zeichneBreaking()` zum Survival-Cypher-Konzept?

`zeichneBreaking()` gegen die kanonische React/SVG-Bühne
(`app/foundation/discipline-stage/arena/disciplines/breaking.tsx`) gegengelesen, Element für
Element:

| Element | `breaking.tsx` (Referenz) | `zeichneBreaking()` (Canvas) | Übereinstimmung |
|---|---|---|---|
| Hintergrund | `brkBg` radialer Verlauf, `hsl(275 55% 22%)` → `hsl(280 45% 7%)` | dieselben drei HSL-Stopps, `createRadialGradient` | 1:1 |
| Zonen-Ringe | 4 Zonen, `GEBROCHEN/SCHMERZGRENZE/STONE FACE/MIND FORTRESS`, Radien 1.0/0.72/0.46/0.22 | identische Labels, identische Radien-Faktoren | 1:1 |
| Boden-Risse | 9 Stück, `i*37%40` / `i*53%20-10`, deterministisch | dieselbe Formel, dieselben Konstanten | 1:1 |
| Survivor-Kern | Puls-Glow + gestrichelter Ring, Text „SURVIVOR · UNBROKEN" | Puls über `buehneT` (statt SVG-`<animate>`), gleicher Text, gleiche Farbe (`--nl-warn` ≈ `#f2d75a`) | 1:1 (andere Animationstechnik, gleiches Bild) |
| Wasserzeichen | „BREAKING" oben links, lila | identisch platziert und gefärbt | 1:1 |
| Krone | 👑 auf `rank===1` | 👑 auf `fuehrer` (höchste Summe) | 1:1 |
| Radius ∝ Score | `score/finalMax` | `u.summe/maxSumme` (dieselbe Normierung, die die Punktesäule der anderen acht Bühnen nutzt) | äquivalent |
| Team-Anordnung | ein gemischter Ring (offene Lobby) | zwei Halbkreise, Heim/Gast (**bewusste, dokumentierte Abweichung**) | begründet |

Die einzige Abweichung — zwei Halbkreise statt eines gemischten Rings — ist im Code ausführlich
kommentiert und sachlich begründet: `breaking.tsx` bedient eine offene Lobby mit beliebig vielen
Teams, dieses Canvas-Chassis ist ein festes 6-gegen-6-Duell zweier Seiten, für das die
Team-Zugehörigkeit sichtbar bleiben muss. Das ist keine neue Diskrepanz, sondern dieselbe
Team/Lobby-Spannung, die auch die anderen acht Bühnen-Geschwister zwischen Zwei-Reihen-Ansicht (hier)
und offener Auftritts-Reihung (Produktion) lösen müssen.

**Visueller Spotcheck (Playwright, siehe Punkt 7):** Zwei aufeinanderfolgende Screenshots eines
laufenden Breaking-Duells zeigen den Kern-Mechanismus korrekt: Teilnehmer mit steigendem
Punktestand (Krolach 109→218, Draco 106→212) rücken sichtbar näher an das Zentrum, während
Teilnehmer mit 0 Punkten (Vigilante-Wranglers-Bank) am äußeren `GEBROCHEN`-Rand verharren. Ring-
Labels, `SURVIVOR · UNBROKEN`-Text und Farbpalette entsprechen der Referenz.

**Einziger Polier-Fund (kein Blocker):** Wenn mehrere Teilnehmer sehr ähnliche Punktestände haben
und dadurch nahe beieinander in Zentrumsnähe clustern, überlappen die Namens-/Punkte-Beschriftungen
teils mit den Zonen-Labels (`STONE FACE`/`MIND FORTRESS`) und untereinander — reine
Lesbarkeitsfrage bei Textplatzierung, keine Falschdarstellung von Score oder Rang. Dasselbe
Cluster-Problem besteht in der Natur der Sache auch in der SVG-Referenz bei genug Teilnehmern nahe
am Zentrum. Empfehlung: bei Gelegenheit, nicht vor diesem Merge.

**Ergebnis: (d) bestätigt**, keine neue thematische Diskrepanz.

## 6. Prüfpunkt (e): Dispatcher exklusiv gegated?

```js
function zeichneBuehne(){
  bodenBuehne();
  const art=BB();
  if(art.heben){ zeichneHeben(art); return; }
  if(art.schach){ zeichneSchach(art); return; }
  if(art.cypher){ zeichneBreaking(art); return; }   // <- neue Zeile
  // ... Fallback: Zwei-Reihen-Ansicht für die übrigen sechs Bühnen-Disziplinen
```

- `grep -n "cypher" public/mockups/battle-mode.engine.js` findet das Flag **genau einmal** als
  Objektfeld (`cypher:true`, ausschließlich im Breaking-Eintrag von `BUEHNE_ART`) und genau einmal
  als Dispatcher-Bedingung. Keine andere Disziplin setzt oder liest `art.cypher`.
- Die drei `if(...){ ...; return; }`-Zweige sind einander ausschließend (jede Art-Konfiguration hat
  höchstens eines der drei Flags gesetzt); ein `return` verhindert, dass der Fallback-Zweig für
  die übrigen sechs Disziplinen je erreicht wird, wenn `cypher` gesetzt ist, und umgekehrt.
- `bodenBuehne()` läuft zwar für alle neun Disziplinen gemeinsam vor dem Dispatch, aber
  `zeichneBreaking()` überschreibt die komplette Zeichenfläche sofort mit einem eigenen
  vollflächigen `ctx.fillRect(0,0,W,H)` — der gemeinsame Boden ist für Breaking unsichtbar, es gibt
  keinen visuellen Seiteneffekt in die andere Richtung.
- Scoring-Pfad (`stepBuehne()`, `bauBuehne()`, `WERTUNG_AUFTRITT`) taucht im Diff nicht auf —
  bestätigt auch durch die bit-identische Messung in Punkt 3.

**Ergebnis: (e) bestätigt.** Dritte Instanz desselben etablierten Musters wie `zeichneHeben()`/
`zeichneSchach()`, exklusiv gegated, kein Seiteneffekt auf die acht Geschwister-Zweige.

## 7. Prüfpunkt (f): Vitest — „103/103 grün"?

Zielgerichtet die fünf in der PR genannten Suiten gelaufen lassen (nicht die volle Suite — ein
Versuch, `npx vitest run` ohne Filter laufen zu lassen, wurde nach 400 s Timeout ohne Ausgabe
abgebrochen; das Repo hat offenbar deutlich mehr Tests, als in der verfügbaren Zeit sinnvoll
durchlaufen):

```
npx vitest run tests/battle-mode-arena-team-points.test.ts tests/arena-headless-runner.test.ts \
  tests/battle-mode-arena-resolve-engine.test.ts tests/discipline-stage-arena-canonical-ovr.test.ts \
  tests/buehne-erfindet-keine-formkrise.test.ts

 Test Files  5 passed (5)
      Tests  103 passed (103)
```

**Bestätigt: 103/103, exakt wie in der PR behauptet.**

**Nebenbefund (Testflakiness, nicht PR-verursacht):** Im ersten Durchlauf (direkt nach einem
Vollsuiten-Versuch und einem eigenen Playwright-Sichtcheck) schlug
`arena-headless-runner.test.ts > "schliesst den Browser ... (kein Zombie-Prozess)"` einmal fehl
(erwartet 6 bzw. 0 Chromium-Kindprozesse, gemessen 10). Nachgeprüft durch gezielte Wiederholung:
- Isoliert auf dem PR-Kopf erneut gelaufen → **bestanden**.
- Auf die PR-Basis (`9e97ecff`) zurückgesetzt gelaufen → bestanden (damals mit „vorher"-Baseline 0,
  weil die Umgebung zu dem Zeitpunkt sauber war).
- Wieder auf den PR-Kopf zurückgewechselt, erneut gelaufen → **bestanden**.

Das Muster (fehlschlägt nur direkt nach eigener Zusatzlast, bestanden in jedem sauberen Lauf,
unabhängig davon ob PR-Kopf oder PR-Basis) zeigt: die Ursache ist Ressourcendruck durch **meine
eigenen** vorherigen Prozesse in dieser Prüf-Sandbox (Vollsuiten-Versuch + Playwright-Browser),
nicht ein von der PR verursachter Chromium-Leak. Der finale, saubere Lauf oben bestätigt 103/103.

## 8. Playwright-Sichtprüfung

Playwright lief in dieser Sandbox **ohne** das „Page crashed"-Problem, das die Opus-Synthese (#857)
an anderer Stelle hatte. Eigenes Wegwerf-Skript nach dem Muster von
`scripts/screenshot-speed-schach.mjs` geschrieben, gegen `battle-mode.html` mit `setDisc("breaking")`
laufen lassen, vier Zeitpunkte eines laufenden Duells fotografiert.

Beobachtet (siehe Punkt 5 für den fachlichen Abgleich): lila Druck-Arena, vier gestrichelte
Zonen-Ringe mit korrekten Labels, zentraler `SURVIVOR · UNBROKEN`-Kern, Teilnehmer wandern mit
steigendem Punktestand sichtbar nach innen, Krone auf dem aktuellen Führer sichtbar in späteren
Frames. Zwei Konsolenmeldungen (`ERR_CONNECTION_RESET`, `404`) traten beim Laden auf — beides
Sprite-/Asset-Ladefehler des Wegwerf-Mini-Servers (kein `/api`-Backend in dieser Sandbox), nicht mit
`zeichneBreaking()` selbst zusammenhängend; dieselben Meldungen wären bei jeder anderen Disziplin in
demselben Setup zu erwarten.

## 9. GitHub-CI-Status (informativ)

Zum Prüfzeitpunkt (unabhängig von der eigenen Messung, nur zur Einordnung):

| Check | Status |
|---|---|
| `pps-referenz-frische` | ✅ success |
| `persistenz-suiten` | ✅ success |
| `full-test-suite` | ✅ success |
| `test-and-smoke` | ⏳ noch `in_progress` |

Drei von vier Checks sind grün und decken sich mit der eigenen Messung (Punkt 7). Der vierte
(`test-and-smoke`) war zum Zeitpunkt dieser Review noch nicht durchgelaufen — das ist kein
inhaltlicher Befund, nur ein Zeitfenster-Hinweis: vor dem tatsächlichen Merge sollte er ebenfalls
grün sein. `mergeable_state` stand auf `blocked`, was in diesem Repo typischerweise die noch
ausstehende unabhängige Review bedeutet (dieselbe Regel wie bei #844/#850/#854) und durch dieses
Dokument bzw. eine PR-Review erfüllt wird.

## 10. Gesamteinschätzung

Alle sechs geforderten Prüfpunkte sind unabhängig nachgemessen, nicht nur aus der PR-Beschreibung
übernommen — inklusive eines Vorher/Nachher-Vergleichs auf identischer Kader-Quelle im selben
Worktree, der die „bit-identisch"-Behauptung für alle neun Bühnen-Disziplinen bestätigt. Der einzige
neue Code-Pfad (`zeichneBreaking()`) ist rein zeichnerisch, exklusiv gegated, liest ausschließlich
bereits vorhandene Felder und schreibt nichts auf `TEILNEHMER`. Die Move-Umbenennung lässt jedes
numerisch wirksame Feld in beiden Dateien unangetastet, inklusive der bewusst nicht behobenen
`finaleset`-Altlast. Der einzige Nebenbefund (i-spy unter der 0,80-Schranke) ist vorbestehend und
unverändert durch diese PR.

**Empfehlung: FREIGEBEN**, sobald `test-and-smoke` ebenfalls grün ist (informativer Vorbehalt, kein
inhaltlicher Einwand gegen den Diff selbst).

---

*Erstellt als unabhängige Zweitprüfung, keine eigene Beteiligung an PR #858. Alle Messungen in
diesem Dokument wurden in einem isolierten Worktree (`/tmp/wt-review-858`) selbst ausgeführt, nicht
aus der PR-Beschreibung übernommen.*
