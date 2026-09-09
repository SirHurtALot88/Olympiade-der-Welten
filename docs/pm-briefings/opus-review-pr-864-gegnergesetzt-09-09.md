# Opus-Overseer-Review: PR #864 — Gegnerseite liest Aufstellung auch auf Bahn und Arena/Kampf

Unabhängige Zweitprüfung, analog zu den Reviews von PR #844/#850/#854/#858/#859. Ich habe an
PR #864 nicht mitgearbeitet. Geprüft in einem isolierten Worktree (`/tmp/wt-review-864`, eigener
Branch `review-864-…`, `node_modules` symlinkt auf den geteilten Store), nicht im geteilten
Haupt-Worktree. Basis-Vergleich in einem zweiten, ebenso isolierten Worktree (`/tmp/wt-review-864-base`,
`origin/main` @ `70ee2bfc`).

**Empfehlung: FREIGEBEN.** Der Diff ist exakt die zwei behaupteten Zeilen (plus Kommentare), sitzt
exakt dort, wo die PR sie verortet, und der jeweilige Vergleichswert (`d`) ist an beiden Stellen
tatsächlich das, was die PR behauptet (`disc` in `build()`, `bahnDisc` in `bauSpurt()`). Ich habe
den eigentlichen Fix — nicht nur die Regressionsfreiheit — mit eigenen, von der PR unabhängig
gewählten Parametern selbst nachgestellt und bestätigt: vorher ignoriert der Motor die
Gegner-Aufstellung vollständig, nachher nicht. Alle Zahlen der PR-Beschreibung (Bit-Identität über
20 Disziplinen, Slot-Invariante, 133 Vitest) habe ich unabhängig nachgemessen und exakt bestätigt.

---

## 0. Fünf Sätze vorab

1. **Der Diff ist wirklich nur zwei Zeilen** (plus Kommentare, 15 Einfügungen/2 Löschungen, eine
   Datei) — `git diff origin/main...HEAD` bestätigt das, keine dritte Stelle angefasst.
2. **Der Vergleichswert stimmt an beiden Stellen.** In `build()` ist `d` durch `const
   d=disc,n=jeSeiteVon(d)…` (Zeile 14082) tatsächlich `disc`; in `bauSpurt()` ist `d` durch `const
   d=bahnDisc, art=BA()…` (Zeile 17863) tatsächlich `bahnDisc`. Beides genau wie die PR behauptet,
   nicht nur benannt.
3. **Der Behavioral-Test der PR ist reproduzierbar — mit eigenen Parametern, nicht nur mit ihren.**
   Ich habe Mini-DM (2 von 4 Gegnern) statt TDM (3 von 6) und Spurt mit anderen zwei Namen als die
   PR getestet: auf `origin/main` baut der Motor in beiden Fällen die volle Katalog-Besetzung
   (4/4), ignoriert die gesetzte Aufstellung vollständig; auf dem PR-Kopf baut er exakt die
   gesetzten 2 mit den richtigen Namen. Kein Zweifel am Fix.
4. **`node scripts/miss-alle-disziplinen.mjs 24` ist bit-identisch über alle 20 Disziplinen**,
   sequenziell und unkontendiert gemessen (nicht parallel — ein erster, gleichzeitig mit eigenen
   Vitest-/tsx-Läufen konkurrierender Versuch führte zu CPU-Kontention und vorzeitigen Timeouts,
   s. Abschnitt 3). Eingeschlossen: alle fünf `ARENA_RESOLVED_DISCIPLINE_IDS`-Disziplinen
   (Basketball, Gewichtheben, Hockey, Speed-Schach, Showcase) und alle zwölf
   Feldspiel-/Bühnen-Disziplinen mit dem `gastGesetzt`-Kniff von vorher.
5. **133/133 Vitest, Slot-Invariante max. 0,005 Pp** — beide exakt wie in der PR behauptet.

---

## 1. Der Diff selbst

```
public/mockups/battle-mode.engine.js | 17 +++++++++++++++--
 1 file changed, 15 insertions(+), 2 deletions(-)
```

Zwei funktionale Zeilenpaare, sonst nur Kommentare:

```js
// build(), Zeile ~14113-14114
const gastGesetzt=OPP.filter(p=>place[p.n]&&place[p.n].d===d);
const gegner=(gastGesetzt.length?gastGesetzt:OPP).slice(0,n);

// bauSpurt(), Zeile ~17880-17881
const gastGesetzt=OPP.filter(p=>place[p.n]&&place[p.n].d===d);
const gegen=(gastGesetzt.length?gastGesetzt:OPP).slice(0,n);
```

Zeichen für Zeichen identisch mit dem Muster in `bauFeldspiel` (Zeile 5470-5471, Vergleichswert
`feldspielDisc`) und `bauBuehne` (Zeile 10999-11000, Vergleichswert `buehneDisc`) — verifiziert,
alle drei Stellen tatsächlich gelesen, nicht nur per Grep verglichen.

## 2. Kontext beider Stellen (Punkt 3a des Auftrags)

**`build()`** (Funktion beginnt Zeile 14068): `KFOKUS=null;…` dann die drei Chassis-Weichen
(`istFeldspiel`/`istBuehne`/`istBahn` → jeweils `return bauX(saat)`), erst danach beginnt der
eigentliche Arena/Kampf-Aufbau mit `const d=disc, n=jeSeiteVon(d), slotListe=slotsVon(d);` (Zeile
14082). `d` ist hier also tatsächlich `disc` — exakt der Wert, gegen den `place[p.n].d` verglichen
werden muss, weil `place` global über `d`/`feldspielDisc`/`buehneDisc`/`bahnDisc` geschrieben wird
(je nachdem, welche der vier Weichen zuletzt griff). Die `mine`-Seite (Zeile 14087-14089) liest
`place` bereits über denselben `d`-Wert (`inDisc(d)`, `place[p.n].d===d` in `slotFuer`) — der Fix
macht die Gastseite damit tatsächlich symmetrisch zur Heimseite, nicht nur ähnlich.

**`bauSpurt()`** (Funktion beginnt Zeile 17804): nach dem Kursmischer und `bahnFallenTypen=null;…`
folgt `const d=bahnDisc, art=BA(), n=art.jeSeite;` (Zeile 17863). `d` ist hier `bahnDisc`, exakt der
Wert, den `build()` vor dem Aufruf setzt (`if(istBahn(disc)){bahnDisc=disc; return
bauSpurt(saat);}`, Zeile 14075) — und derselbe Wert, über den `place` für Bahn-Disziplinen
geschrieben wird. Auch hier liest `mine` (`inDisc(d)`, `slotFuer` Zeile 17873) bereits über
denselben `d`. Kein Diskrepanz zwischen dem behaupteten und dem tatsächlichen Vergleichswert an
beiden Stellen.

## 3. Eigener Behavioral-Test (Punkt 3b des Auftrags) — unabhängig von der PR gewählt

Die PR benennt selbst ehrlich die Einschränkung, dass `disziplinProbe()`/`miss-alle-disziplinen.mjs`
nur `SQUAD`/`OPP` tauschen, aber nie `place` setzen (nachgelesen: `kaderSetzen`, Zeile 22511-22515,
und `disziplinProbe`, Zeile 22516 ff., tatsächlich keine Zeile darin schreibt `place`). Ich habe das
selbst nachvollzogen — `place` wird nur einmal, beim Laden der Seite, aus
`window.__olyArenaKader.aufstellung` befüllt (Zeile 12802-12810), **vor** jedem `<script>`-Lauf, per
`await` in der äußeren async-IIFE (Zeile 3201). Das heißt: `window.__olyArenaKader` muss per
`page.addInitScript` **vor** `page.goto()` gesetzt werden, nicht per `page.evaluate()` danach — sonst
kommt es nie an.

Playwright-Skript selbst geschrieben (nicht aus der PR kopiert), zwei Läufe mit **eigenen**
Parametern:

**Mini-DM statt TDM, 2 von 4 statt 3 von 6, andere Namen** (`Krag'Zul`, `Seraph-11` aus dem
6-köpfigen `OPP`-Katalog gesetzt, `jeSeite`=4):

| | `origin/main` | PR-Kopf |
|---|---|---|
| gebaute Gäste | **4** (Greenkraut, Krag'Zul, Tidesprinter, Seraph-11 — volle Katalog-Reihenfolge, Aufstellung ignoriert) | **2** (Krag'Zul, Seraph-11 — genau die gesetzten) |

**Spurt statt TDM, 2 von 6 statt 3 von 6, andere Namen** (`Greenkraut`, `Cassandra`, `jeSeite`=4):

| | `origin/main` | PR-Kopf |
|---|---|---|
| gebaute Gäste | **4** (Greenkraut, Krag'Zul, Tidesprinter, Seraph-11 — aufgefüllt, Aufstellung ignoriert) | **2** (Greenkraut, Cassandra — genau die gesetzten) |

Beide Läufe bestätigen den Fix unabhängig von der PR-eigenen Verifikation, mit eigener
Disziplinwahl, eigener Feldgröße und eigenen Namen. Skripte lagen unter
`/tmp/wt-review-864/probe-864.mjs` und `probe-864-bahn.mjs` (nicht Teil des Commits, nur für diese
Prüfung).

## 4. `miss-alle-disziplinen.mjs 24` — alle 20 Disziplinen (Punkt 3c des Auftrags)

**Wichtiger methodischer Fund dieser Prüfung selbst:** ein erster Versuch, Kopf- und Basis-Lauf
parallel zueinander UND parallel zu eigenen Vitest-/`pruefe-slot-invariante`-Läufen zu fahren, führte
zu CPU-Kontention (4 Kerne, mehrere gleichzeitige Chromium-Instanzen) — beide 24er-Läufe liefen in
ihr eigenes 580s-Zeitlimit, bevor sie alle 20 Disziplinen geschafft hatten. Die Disziplinen, die in
diesem kontendierten Lauf auf beiden Seiten fertig wurden (`tdm`, `mini-dm`), waren bereits
bit-identisch — aber das war keine vollständige Prüfung. Zweiter, sauberer Versuch: beide Läufe
**sequenziell, je allein, mit 1500s Zeitlimit**, dann `diff`:

```
node scripts/miss-alle-disziplinen.mjs 24     (PR-Kopf, dann origin/main, nacheinander, je allein)
diff /tmp/miss-head-full.txt /tmp/miss-base-full.txt
→ BIT-IDENTISCH: HEAD == BASE (alle 20 Disziplinen)
```

| Disziplin | Chassis | rho/Spiel (Median) | Abnahme | HEAD==BASE |
|---|---|---:|---|---|
| staffel | bahn | 0,915 | bestanden | ✓ |
| speed-schach | buehne | 0,908 | bestanden | ✓ (live/ARENA_RESOLVED) |
| showcase | buehne | 0,892 | bestanden | ✓ (live/ARENA_RESOLVED) |
| eiskunstlauf | buehne | 0,885 | bestanden | ✓ |
| spurt | bahn | 0,871 | bestanden | ✓ |
| breaking | buehne | 0,869 | bestanden | ✓ |
| takeshis-castle | bahn | 0,861 | bestanden | ✓ |
| gewichtheben | buehne | 0,854 | bestanden | ✓ (live/ARENA_RESOLVED) |
| wettessen | buehne | 0,845 | bestanden | ✓ |
| time-trial | bahn | 0,828 | bestanden | ✓ |
| tennis | buehne | 0,825 | bestanden | ✓ |
| fechten | buehne | 0,816 | bestanden | ✓ |
| climbing | bahn | 0,790 | knapp | ✓ |
| basketball | feldspiel | 0,769 | knapp | ✓ (live/ARENA_RESOLVED) |
| i-spy | buehne | 0,684 | durchgefallen | ✓ |
| hockey | feldspiel | 0,669 | durchgefallen | ✓ (live/ARENA_RESOLVED) |
| football | feldspiel | 0,516 | durchgefallen | ✓ |
| battlefield | arena | 0,387 | durchgefallen | ✓ |
| tdm | arena | 0,253 | durchgefallen | ✓ |
| mini-dm | arena | 0,094 | durchgefallen | ✓ |

Alle 20 Zeilen exakt wie in der PR-Beschreibung tabelliert (auf drei Nachkommastellen), inklusive
aller fünf `ARENA_RESOLVED_DISCIPLINE_IDS`-Disziplinen (`lib/resolve/battle-mode-arena-team-points.ts:159-165`
gelesen, bestätigt: `basketball, gewichtheben, hockey, speed-schach, showcase` — alle fünf über
`FELDSPIEL_ART`/`BUEHNE_ART` registriert, s. Abschnitt 6) und aller zwölf
Feldspiel-/Bühnen-Geschwister mit dem vorbestehenden `gastGesetzt`-Kniff. Kein einziger
Seitenfehler in beiden Läufen (`Seitenfehler: keine`).

Das bestätigt die PR-Behauptung exakt: die Standard-Messkette zeigt hier — wie ehrlich in der PR
zugegeben — nur Regressionsfreiheit, nicht den eigentlichen Fix (dafür Abschnitt 3).

## 5. Slot-Invariante (Punkt 3d)

```
npx tsx scripts/pruefe-slot-invariante.ts
→ Maximale Abweichung ueber alle 20 Disziplinen x 6 Groessen: 0.005 Pp (mini-dm @ n=2, Attribut stamina)
→ Invariante haelt: alle Werte <= 0.2 Pp.
```

Exakt wie in der PR behauptet.

## 6. Vitest (Punkt 3e)

Die genannten 12 Dateien, exakt diese Liste, auf dem PR-Kopf:

```
tests/arena-headless-runner.test.ts
tests/battle-mode-arena-resolve-engine.test.ts
tests/battle-mode-arena-team-points.test.ts
tests/battle-mode-arena-matchday-resolve-e2e.test.ts
tests/minidm-token-size.test.ts
tests/battle-arena-rennplan-ansage.test.ts
tests/battle-zielansage-kontrakt.test.ts
tests/battle-arena-heal-attribution.test.ts
tests/basketball-pps-referenz-drift.test.ts
tests/battle-arena-ein-modell-ueberall.test.ts
tests/battle-arena-endscreen-tooltip-wurzel.test.ts
tests/leertaste-battle-arena-season-flow.test.ts
```

Ergebnis: **12 Dateien, 133 Tests, alle grün** — exakt die behauptete Zahl.

## 7. Bahn-/Arena-spezifischer Sonderfall? (Punkt 3f)

Geprüft, ob eine andere `n`-Semantik oder Team-Größen-Zählung in Bahn/Arena gegenüber
Feldspiel/Bühne einen übersehenen Sonderfall verursachen könnte:

- **`n` ist in beiden Funktionen dieselbe Art von Wert wie in `bauFeldspiel`/`bauBuehne`**:
  `n=jeSeiteVon(d)` in `build()` (Zeile 14082) bzw. `n=art.jeSeite` in `bauSpurt()` (Zeile 17863) —
  dieselbe Katalog-Feldgröße wie `n=art.jeSeite` in `bauFeldspiel`/`bauBuehne`, kein zweiter
  Zählmodus.
- **Kein Auffüllen bei Unterzahl, in allen vier Chassis gleich.** `(gastGesetzt.length?gastGesetzt:OPP).slice(0,n)`
  füllt eine unvollständige Gastaufstellung NICHT auf `n` auf — bei 2 gesetzten und `n=4` bleibt
  die Liste bei Länge 2. Das ist in `bauFeldspiel` explizit Chris' Vorgabe ("pruefe dass man auch
  mit 3v6 antreten kann, das ist erlaubt aber natuerlich ist man dann deutlich schwaecher") und
  gilt jetzt symmetrisch für Bahn/Arena.
- **Verteilung einer kürzeren Gästeliste auf Reihen/Bahnen ist rein index-basiert, kein
  `n`-Bezug, der crashen könnte.** In `build()`: `oByRow[…Math.min(2,Math.floor(i*3/n))].push(o)`
  läuft über `gegner.forEach((o,i)=>…)` — bei einer kürzeren Liste laufen einfach weniger
  Iterationen, kein Zugriff außerhalb des Arrays. In `bauSpurt()`: `gegen.forEach((o,i)=>setz(o,1,i*2+1,true,i))`
  vergibt Bahnen rein über den Index der tatsächlichen Länge — bei 2 statt 4 Läufern entstehen
  einfach 2 statt 4 Bahnen, keine undefinierte Bahn, kein Absturz. Beides selbst gelesen und
  nachvollzogen, nicht nur angenommen.
- **Kein Sonderfall gefunden**, den die PR übersehen haben könnte. Die Übertragung ist tatsächlich
  1:1, nicht nur behauptet 1:1.

## 8. GitHub-CI (Punkt 4 des Auftrags)

Stand zum Prüfzeitpunkt: vier Checks, drei bereits grün, einer lief noch.

| Check | Status |
|---|---|
| pps-referenz-frische | ✅ success |
| persistenz-suiten | ✅ success |
| full-test-suite | ✅ success |
| test-and-smoke | ⏳ in_progress |

`mergeable_state: blocked` — zum Prüfzeitpunkt kein `failure`, nur der eine noch laufende Check
bzw. fehlende Review-Freigabe. **Vor dem tatsächlichen Merge sollte `test-and-smoke` grün bestätigt
werden** — konnte hier nicht mehr abgewartet werden, ohne den Review zu verzögern.

## 9. Was ich NICHT verifizieren konnte

- **`test-and-smoke`-CI-Ergebnis** — lief zum Prüfzeitpunkt noch (Abschnitt 8).
- **Die `--je-seite=2/3/4/5/6`-Tabelle der PR** (Punkt 2 der PR-Beschreibung) habe ich nicht
  separat nachgerechnet — der Behavioral-Test in Abschnitt 3 deckt dieselbe Frage (Feldgröße ≠
  Katalog) direkter und aussagekräftiger ab, und die Bit-Identität in Abschnitt 4 bestätigt
  bereits, dass sich an der `n`-Verdrahtung selbst nichts verschoben hat.
- **Ein visueller Screenshot-Spotcheck** — wie die PR selbst habe auch ich keinen zusätzlichen
  reinen Bildvergleich gemacht; der gezählte Teilnehmer-Nachweis aus Abschnitt 3 ist präziser und
  deckt dieselbe Frage ab.
- **Verhalten in einer echten Saison-Simulation** (nicht nur `disziplinProbe()`/`battle-mode.html`)
  — wie bei allen bisherigen Reviews dieser Datei war das nicht Teil dieser Prüfung.

---

## Freigabe-Empfehlung: FREIGEBEN

Jede Behauptung der PR-Beschreibung hält der unabhängigen Nachprüfung stand: der Diff ist exakt
zwei Zeilen an exakt den behaupteten Stellen mit exakt dem behaupteten (und tatsächlich
zutreffenden) Vergleichswert; der eigentliche Fix wurde von mir mit eigenen, andersartigen
Parametern eigenständig reproduziert, nicht nur der PR-eigene Test nachvollzogen; alle 20
Disziplinen sind bit-identisch (sequenziell, unkontendiert nachgemessen — der erste parallele
Versuch dieser Prüfung selbst litt unter CPU-Kontention und lieferte nur eine Teilmenge, s.
Abschnitt 4); Slot-Invariante und 133/133 Vitest exakt bestätigt; kein übersehener
Bahn/Arena-Sonderfall gefunden.

**Einziger offener Punkt vor dem tatsächlichen Merge:** `test-and-smoke` sollte grün abschließen —
lief zum Prüfzeitpunkt noch, kein bekannter Fehlschlag.

---

*Erstellt als unabhängiger Overseer-Review, ohne Beteiligung an PR #864.*

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01UYLNtXkprKr1XK4c3X2xQq
