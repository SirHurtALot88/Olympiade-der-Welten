# Gewichtheben-Pp-„Regression" (29,1 vs. 17,3): Messartefakt, kein Code-Fehler (27.09.)

Reine Diagnose, kein Code auf `main` geändert. Auftrag: klären, ob die Scorecard-Runde vom
26.09. (Abend) zu Recht eine Pp-Regression bei Gewichtheben (29,1 Pp, n=24) auf PR #1036
(„Buehne: WAGNIS wird ein echtes Risiko", generischer Auftritt-Block) zurückführt, obwohl
die PR-Beschreibung Gewichtheben ausdrücklich als **nicht betroffen** auflistet.

## Ergebnis vorab

**Kein Regression, ein Messartefakt aus zwei Ursachen zusammen: Stichprobengröße n=24 statt
n=48, plus ein vorher schon dokumentierter, aber im Scorecard-Vergleich nicht mehr zitierter
Zwischenstand.** Der Gewichtheben-Code selbst hat sich zwischen dem Commit vor und nach
PR #1036 um **keine einzige Zeile** geändert, und die gemessene Pp-Abweichung ist auf beiden
Ständen **bit-identisch** — bei jedem getesteten n und jedem Saatstrom.

## 1. Commit-Grenzen

- **Vorher** (letzter Commit vor PR #1036): `5774125e` — „Bahn: Puste-Haushalt bindet in
  Time-Trial und Spurt (TT-P1/SP-P1) (#1035)"
- **Nachher** (PR-#1036-Merge selbst): `14660167` — „Buehne: WAGNIS wird ein echtes Risiko
  (generischer Auftritt-Block) (#1036)"
- Dazwischen liegt kein weiterer Commit; direkt danach folgt nur noch die Scorecard-Runde
  selbst (`ebb3b99a`, #1038).

## 2. Code-Diff: null Zeilen Gewichtheben-Code betroffen

`git diff 5774125e 14660167` ändert genau drei Dateien: `public/mockups/battle-mode.engine.js`
(58 Zeilen), `scripts/kalibriere-buehne-rezept.mjs` (22 Zeilen, ein Kalibrierwerkzeug für den
generischen Bühnen-Block) und `docs/design/neue-disziplin-handbuch.md` (11 Zeilen, Doku). Im
Engine-Diff betreffen alle Codezeilen ausschließlich `bauBuehne()` (die neuen Konstanten
`BUEHNE_WAGNIS_RISIKO`/`BUEHNE_WAGNIS_ERTRAG` und die Funktionen `buehneErfolgschance`/
`buehneWagnisFaktor`) sowie den generischen Rundenblock, der laut PR-Beschreibung nur für
Speed-Schach, Tennis, Fechten, Showcase, Eiskunstlauf und Wettessen läuft. Jede Erwähnung
von „Gewichtheben"/„Heben" im Diff steht ausschließlich in **Kommentaren** — als Begründung,
warum Gewichtheben *nicht* angefasst wird ("NICHT betroffen: Gewichtheben (eigenes Risiko
über HEBEN_WAGNIS_*)"), oder als Präzedenzfall, an dem sich der neue Trade-off orientiert
(„derselbe Fehler, den Gewichtheben am 06.09. … behoben hat"). Gewichthebens eigenes Chassis
(`hebeUebung`, `HEBEN_WAGNIS_*`, `HEBEN_TAGESMAX_ANSAGE_K`, `spieleBuehneHeben`) taucht in
keinem `+`/`-` Codehunk auf:

```
$ git diff 5774125e 14660167 -- public/mockups/battle-mode.engine.js | grep -iE '^\+|^-' | grep -i heben
+  // nie einen Fehlschlag mehr (d erfolg/d WAGNIS = 0). Derselbe Fehler, den Gewichtheben am
+  // 06.09. mit HEBEN_WAGNIS_ANSAGE_FLEX behoben hat.
+  // Heben): wer mehr wagt, trifft SELTENER (RISIKO senkt die Erfolgschance) und holt bei
+  // NICHT betroffen: Gewichtheben (eigenes Risiko ueber HEBEN_WAGNIS_*), I-Spy (eigener
```

Auch außerhalb der Engine gibt es keinen versteckten gemeinsamen Helfer: `git diff --stat`
zeigt nur die drei oben genannten Dateien, keine Änderung an `official-discipline-weights.ts`,
`spiel-eignung-overrides.ts` oder einer geteilten Formkarten-/Grundattribut-Funktion.

## 3. Messung: bit-identisch auf beiden Ständen

Gemessen mit zwei separaten Git-Worktrees (`/tmp/wt-vorher-5774125e`, `/tmp/wt-nachher-
14660167`) und zwei unabhängigen Saatströmen über den eingebauten `saatVersatz`-Parameter
von `einflussVon()` (0 und 10 000 000 — dasselbe Muster, das der Time-Trial-Pp-Fix vom 23.09.
für unabhängige zweite Saatreihen eingeführt hat):

| n | Saatstrom | Vorher (`5774125e`) | Nachher (`14660167`) |
|---:|---:|---:|---:|
| 24 | versatz=0 | 29,1 Pp | 29,1 Pp |
| 24 | versatz=10 000 000 | 27,3 Pp | 27,3 Pp |
| 48 | versatz=0 | 19,1 Pp | 19,1 Pp |

Jede Zeile ist bit-identisch zwischen vorher und nachher — exakt das Bild, das man erwartet,
wenn der Code sich nicht geändert hat. `scripts/messe-arena-einfluss.mjs gewichtheben 24`
(Standardaufruf ohne Saatversatz) liefert auf beiden Ständen die *genau selben* 29,1 Pp mit
identischem Attribut-Breakdown (power 33,4 %, charisma 26,5 %, health 12,3 %, speed 11,7 % …)
— die 29,1 aus der Scorecard-Runde sind damit exakt reproduziert, nur eben auf **beiden**
Commits, nicht nur nach #1036.

## 4. Warum 29,1 (n=24) und nicht 17,3 (n=48): Stichprobengröße, dokumentierter Effekt

`scripts/messe-arena-einfluss.mjs` selbst warnt seit dem 25./26.08.-Nachtrag ausdrücklich vor
kleinem n: „zu wenig … SYSTEMATISCH zu günstig … Spurt 40,9 Pp bei n=12 gegen 54,7 Pp bei
n=48, Climbing 28,9 gegen 37,2" (Skriptkommentar, Zeilen 26–34). Für Gewichtheben zeigt sich
derselbe Effekt in dieser Messung unübersehbar: **n=24 liegt 8–10 Pp über n=48**, unabhängig
vom Commit. Der historisch dokumentierte Wert 17,3 Pp (`docs/design/gewichtheben-
zufriedenstellend.md`, 04.09., Umbau `HEBEN_TAGESMAX_ANSAGE_K`) wurde ausdrücklich **mit
n=48** gemessen — dieselbe Stichprobengröße, mit der diese Diagnose heute 19,1 Pp misst. Die
Differenz 19,1 vs. 17,3 (1,8 Pp) liegt in derselben Größenordnung wie die Streuung zwischen
zwei unabhängigen Saatströmen bei gleichem n (27,3 vs. 29,1 bei n=24, ebenfalls ~1,8 Pp) und
ist damit vom Messrauschen nicht zu unterscheiden — kein Hinweis auf eine reale Verschlechterung
seither. Ergänzend listet `docs/design/neue-disziplin-handbuch.md` (Stand 02.09., vor dem
04.09.-Umbau) bereits einen älteren Zwischenwert von 34,8 Pp für Gewichtheben — der Wert hat
also schon vor dem 04.09. mehrfach zwischen grob 17 und 35 Pp geschwankt, je nach Rezeptstand
und Messmethode; 29,1 (n=24) fügt sich in diese bekannte Schwankungsbreite ein, statt sie zu
sprengen.

**Einordnung, keine Spekulation:** Die 29,1 Pp der Scorecard-Runde sind real und reproduzierbar
— aber sie waren schon vor PR #1036 da, nicht danach. Die „Regression" ist der Vergleich einer
n=24-Zahl von heute mit einer n=48-Zahl vom 04.09., nicht der Effekt einer Codeänderung.

## 5. Ursachenkette, kurz

1. PR #1036 ändert ausschließlich `bauBuehne()` (den generischen Auftritt-Block für sechs
   andere Disziplinen) und ein zugehöriges Kalibrierskript — nachweislich, per Diff.
2. Gewichthebens eigenes Chassis (`hebeUebung`/`HEBEN_WAGNIS_*`) ist in diesem Diff nicht
   enthalten, weder in Code noch über einen gemeinsamen Helfer.
3. Die Pp-Messung bestätigt das empirisch: identische Werte vor und nach dem Merge, bei
   gleichem n und gleichem Saatstrom.
4. Der scheinbare Sprung von 17,3 auf 29,1 entsteht ausschließlich daraus, dass die
   Scorecard-Runde mit n=24 gemessen hat statt mit dem für diese Kennzahl vorgeschriebenen
   n=48 (`docs/design/neue-disziplin-handbuch.md` Abschnitt 3.1: „`… <diszi> 48`"). Bei n=48
   liegt Gewichtheben heute bei 19,1 Pp — statistisch nicht von den historischen 17,3
   unterscheidbar.

## 6. Folgen

**Kein Code-Fix nötig.** Nichts an Gewichtheben ist kaputt; die Pp-Abweichung liegt bei
korrektem n weiterhin klar unter der 25-Pp-Schranke aus CLAUDE.md. Empfehlung für künftige
Scorecard-Runden: `messe-arena-einfluss.mjs` für die Pp-Pflichtprüfung **immer mit n=48**
aufrufen (wie im Handbuch vorgeschrieben), nicht mit n=24 — n=24 ist für die rho-Sonden
(`miss-feldspiel-rangtreue.mjs`) richtig kalibriert, aber für die Pp-Sonde systematisch zu
klein und erzeugt scheinbare Regressionen wie diese hier.

## Anhang: Reproduktion

```sh
git worktree add /tmp/wt-vorher 5774125e --detach
git worktree add /tmp/wt-nachher 14660167 --detach
ln -s <repo>/node_modules /tmp/wt-vorher/node_modules
ln -s <repo>/node_modules /tmp/wt-nachher/node_modules

node /tmp/wt-vorher/scripts/messe-arena-einfluss.mjs gewichtheben 24   # 29.1 Pp
node /tmp/wt-vorher/scripts/messe-arena-einfluss.mjs gewichtheben 48   # 19.1 Pp
node /tmp/wt-nachher/scripts/messe-arena-einfluss.mjs gewichtheben 24  # 29.1 Pp
node /tmp/wt-nachher/scripts/messe-arena-einfluss.mjs gewichtheben 48  # 19.1 Pp

git diff 5774125e 14660167 -- public/mockups/battle-mode.engine.js \
  | grep -iE '^\+|^-' | grep -i heben   # nur Kommentarzeilen, kein Codehunk
```
