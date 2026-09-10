# Opus-Overseer-Review PR #880 — Ziel 3: Bahn-Chassis produktionsangeschlossen (Staffel/Spurt/Takeshi/Time-Trial)

**Datum:** 10.09.2026
**PR:** #880, Branch `claude/feinschliff-ziel3-bahn-takeshi-09-10`, Kopf `f44e7223`
**Basis der PR:** `c56fffd7` (Merge-Base gegen `origin/main`; `main` steht inzwischen auf `4e578e58`)
**Reviewer:** unabhaengiger Opus-Overseer, an der PR nicht mitgearbeitet
**Pruefumgebung:** zwei eigene, isolierte Worktrees (`wt-880` auf `f44e7223`, `wt-base` auf
`c56fffd7`), `node_modules` je als Symlink auf den Hauptbaum. Im geteilten Hauptbaum wurde
nichts gemessen und nichts angefasst.

**Warum diese Review strenger ausfaellt als die drei Geschwister-Reviews (#874/#875/#876):**
diese PR ist die einzige der vier Feinschliff-PRs, die `ARENA_RESOLVED_DISCIPLINE_IDS` anfasst.
Was hier durchgeht, zahlt ab dem naechsten Spieltag echte Spielerpunkte aus. Ich habe deshalb
nicht nur geprueft, ob der Anschluss technisch haelt, sondern auch, **welche Zahlen er am Ende
wirklich ausschuettet** — und genau dort liegt der eine Fund, der diese Review von einem
glatten „freigeben" abhaelt.

---

## Freigabe-Empfehlung

# FREIGEBEN MIT NACHTRAG — mit EINER Auflage

**Staffel, Takeshi's Castle und Time-Trial sind ohne Vorbehalt anschlussreif.** Alle
Kernbehauptungen dazu halten meiner eigenen Nachmessung stand, teils exakt auf die von der PR
genannte Ziffer.

**Spurt sollte in dieser Form NICHT mitgemerged werden.** Nicht wegen des Codes dieser PR — der
ist fuer alle vier identisch und sauber —, sondern weil Spurts mitgelieferte PPS-Referenz
nachweislich verunreinigt ist und deshalb bei den Feldgroessen 2 und 3 **weniger als die Haelfte
der PPs auszahlt, die jede andere Disziplin fuer dieselbe Leistung zahlt** (Abschnitt 3, F1).
Der Eingriff ist eine Zeile: `"spurt"` aus `ARENA_RESOLVED_DISCIPLINE_IDS` und aus
`ARENA_BAHN_DISCIPLINE_IDS` nehmen, den Rest mergen — die drei anderen Bahnen sind davon
vollstaendig unberuehrt (die Querpruefung beim Modul-Laden traegt das, s. 2.4). Alternativ:
Spurts Referenz neu ziehen, nachdem geklaert ist, warum ein Team von 32 seine Aufstellung nicht
angewendet bekommt.

Alle uebrigen Funde (F2–F8) sind Aktenlage und Kommentar-Genauigkeit, kein Merge-Hindernis.

---

## 1. Was ich selbst gefahren habe

Alle Laeufe synchron und blockierend, in meinen eigenen Worktrees. Keine Zahl aus der
PR-Beschreibung uebernommen.

| Lauf | Ergebnis |
|---|---|
| `miss-alle-disziplinen.mjs 24` x 5 Bahn, PR-Kopf vs. `c56fffd7` | **bit-identisch** (`diff` leer) |
| `miss-alle-disziplinen.mjs 24` x 9 Buehne + basketball/hockey/football, PR vs. Basis | **bit-identisch** |
| `tests/spiele-bahn-invarianten.test.ts` (echter Chromium) | **12/12 gruen**, 105 s |
| `tests/battle-mode-arena-team-points.test.ts` + `arena-headless-runner.test.ts` | **84/84 gruen** |
| Mutationsprobe: Climbing kuenstlich eingetragen | Test **rot**, genau der eine (s. 2.4) |
| `npx tsc --noEmit` PR vs. Basis | **560 : 560**, identische Dateiverteilung |
| `scripts/pruefe-pps-referenz-frische.ts` PR vs. Basis | Exit 1 auf **beiden** Seiten, Job ist `continue-on-error` (s. 2.6) |
| Eigene Playwright-Sonde, 240 Saaten x 5 Bahnen (eigene Spearman-Implementierung) | s. 2.1/2.2 |
| Eigene Feldgroessen-Sonde gegen den echten Spielstand (`runArenaFixtures`) | s. Abschnitt 3 |
| Feldgroessen-Matrix Time-Trial n=2..6, dazu n=3/n=4 mit 96 statt 24 Spielen | s. Abschnitt 5 |
| Stichprobe aus der Matrix der PR: staffel n=2, spurt n=2, spurt n=6, takeshi n=2 | **0,950 / 0,825 / 0,918 / 0,858 — alle vier ziffernidentisch zur PR** |
| GitHub-CI auf `f44e7223` | **4/4 gruen**: `test-and-smoke`, `full-test-suite`, `persistenz-suiten`, `pps-referenz-frische` |

Die Rangtreue-Lage, auf beiden Seiten zeichengleich:

```
staffel 0.915 | spurt 0.871 | takeshis-castle 0.861 | time-trial 0.828 | climbing 0.790
speed-schach 0.908 | showcase 0.892 | eiskunstlauf 0.885 | breaking 0.869 | gewichtheben 0.854
wettessen 0.845 | tennis 0.825 | fechten 0.816 | i-spy 0.684
basketball 0.769 | hockey 0.669 | football 0.516
```

Damit ist die Kernzusage der PR — **rein additiv, kein Motorbyte bewegt** — von zwei Seiten
belegt: der Diff an `battle-mode.engine.js` enthaelt **18 `+`-Zeilen und keine einzige
`-`-Zeile**, und siebzehn gemessene Disziplinen liefern auf beiden Baeumen dieselben Ziffern.

---

## 2. Behauptung fuer Behauptung

### 2.1 Boxscore-Wert: `bahnTeamstand().punkte` statt `MOTOREN[bd].wert()`

**Der Grund stimmt.** `MOTOREN[bd].wert()` (`:21303`) liefert

* fuer Staffel `-(u.etappenZeit ?? …) + u.wechselKonto` — **negativ**, weil Etappenzeiten
  zweistellig sind und `wechselKonto` klein,
* fuer Spurt/Time-Trial/Climbing `-(pl+1)`, also **-1 bis -N**,
* fuer Takeshi's Castle `burgwertung(u)`, und das ist **exakt dieselbe Zahl**, die
  `bahnTeamstand()` im `"burg"`-Zweig in `punkte` legt.

`ppsAusArenaImpact()` rechnet `Math.max(0, impact)/iKrass` (`:1023`). Fuer Staffel/Spurt/
Time-Trial waere der rohe Motorwert damit tatsaechlich fuer **jeden** Laeufer 0 PPs. Die
Entscheidung ist also nicht Geschmack, sondern notwendig — und sie ist am richtigen Ort
getroffen (im Boxscore, nicht in der Kurve).

**Die Begruendung ist aber in einem Punkt falsch, und zwar in allen drei Kommentaren, die sie
tragen** (`spieleBahn()` im Motor, `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`, `ziehe-buehne-pps-
referenz.ts`): `bahnTeamstand().punkte` ist **nicht** durchweg nicht-negativ. Fuer die
Wertungsmodi `"rang"` und `"etappe"` ja (reine Rangzahl 1..N). Fuer `"burg"` — also Takeshi's
Castle — nicht: dort ist `punkte` = `burgpunkte(u) + zielbonus(u)`, und das kann unter null
fallen.

Eigene Messung, 240 Saaten je Bahn, Boxscore direkt aus `spieleBahn()` gelesen:

| Bahn | Boxscore-Werte | davon negativ | Anteil |
|---|---:|---:|---:|
| staffel | 2880 | 0 | 0 % |
| spurt | 1920 | 0 | 0 % |
| **takeshis-castle** | 2880 | **296** | **10,3 %** |
| time-trial | 2880 | 0 | 0 % |
| climbing | 2880 | 0 | 0 % |

Die mitgelieferte Referenz sagt dasselbe: `takeshis-castle-pps-referenz.json` traegt bei n=3/4/5/6
die Quantile `p1 = -0,49 / -1,27 / -2,19 / -2,05`, bei n=6 sogar `p5 = -0,49`.

**Ist das schlimm? Nein — aber es gehoert benannt.** Ein Laeufer mit negativer Burgwertung
bekommt 0,00 PPs. Das ist thematisch sogar stimmig (wer bei Takeshi frueh ausscheidet, hat
nichts geholt; ich habe nebenbei 467 von 2880 Laeufern als ausgeschieden gezaehlt, 16 %).
Bemerkenswert ist nur, dass **Takeshi damit die erste arena-aufgeloeste Disziplin ist, in der
ein nennenswerter Anteil der Spieler exakt null bekommt** — Basketballs Referenz hat bei n=4
ein `p1` von 4,87 und bei n=6 von 0,24, faellt also praktisch nie auf den Deckel. Chris sollte
das wissen, bevor er sich wundert. Siehe **F2**.

### 2.2 Die „elementweise pro Rennen exakt 1,0"-Invariante

**Selbst reproduziert, mit eigener Spearman-Implementierung, ohne den PR-Test anzufassen** —
240 Saaten je Bahn, `window.__arena.spiele()` gegen `window.__arena.spieleBahn()`:

| Bahn | Rennen | rho je Rennen (min / max) | Rennen mit rho < 1 | rho **gepoolt** |
|---|---:|---|---:|---:|
| staffel | 240 | 1,000000 / 1,000000 | **0** | **0,99193** |
| spurt | 240 | 1,000000 / 1,000000 | 0 | 1,000000 |
| takeshis-castle | 240 | 1,000000 / 1,000000 | 0 | 1,000000 |
| time-trial | 240 | 1,000000 / 1,000000 | 0 | 1,000000 |
| climbing (Kontrolle) | 240 | 1,000000 / 1,000000 | 0 | 1,000000 |

**Beide Zahlen der PR sind exakt getroffen**: je Rennen 1,0, gepoolt 0,992 (ich messe 0,99193).
Der PR-Autor hat den richtigen Test geschrieben, und der beschriebene Stolperstein ist echt.

**Praeziser als die PR-Beschreibung:** der Pooling-Fehler tritt **nur bei der Staffel** auf,
nicht generell. Bei Spurt/Time-Trial/Climbing ist `wert()` selbst `-(Platz)` und `punkte` ist
`N-Platz+1` — bei fester Feldgroesse ist das eine streng monotone Abbildung, gepoolt also
ebenfalls 1,0. Bei Takeshi sind beide Groessen sogar zeichengleich. Nur die Staffel hat auf der
einen Seite eine kontinuierliche Groesse (Etappenzeit) und auf der anderen eine Rangzahl — dort
wandert die Skala von Rennen zu Rennen. Der Test-Kommentar im Code sagt das korrekt („240 Saaten
Staffel"), die PR-Beschreibung verallgemeinert es. Siehe **F3**.

**Ein Nebenbefund, der staerker ist als er aussieht:** `spieleBahn()` setzt `stumm=true`,
`spiele()` nicht. Dass die per-Rennen-Korrelation trotzdem in 960 von 960 Rennen exakt 1,0 ist,
beweist empirisch, dass die `stumm`-Klammer den Zufallsstrom nicht verschiebt — sonst liefen
beide Aufrufe verschiedene Rennen und die Ordnung waere gebrochen. Das ist genau die
Neutralitaet, die man sonst muehsam per Grep behaupten muesste.

**Was die Invariante NICHT abdeckt:** sie laeuft ausschliesslich auf der Motor-Standardfeldgroesse
(`BAHN_ART[d].jeSeite`). Beim Lesen der Sortierregeln faellt eine Stelle auf, an der die beiden
Groessen strukturell auseinanderlaufen koennten: `bahnRangliste()` ordnet Nichtfertige nach
`b.pos - a.pos` (Streckenanteil), `MOTOREN[bd].wert()` dagegen nach `(bahnZeit(u) ?? 99)`, was
alle Nichtfertigen gleichsetzt. Gleiches gilt fuer die Staffel, wo `bahnLeistung()` bei
`etappenZeit == null` `null` liefert, `wert()` aber auf `u.fertig ?? 60` zurueckfaellt. Ich habe
nachgezaehlt: in allen 240 Rennen je Bahn gab es **null** Laeufer ohne Zielzeit (ausser bei
Takeshi, das aber im `"burg"`-Modus laeuft und deshalb gar nicht sortiert). Die Invariante haelt
also — **empirisch, nicht strukturell**. Siehe **F4**.

### 2.3 `katalogStandardgroesse` — einzeln nachgesehen?

**Ja, alle vier stimmen.** Direkt aus `lib/data/dataAdapter.ts`:

| Disziplin | `Discipline.playerCount` (dataAdapter) | in der PR | `BAHN_ART[d].jeSeite` (Motor) |
|---|---:|---:|---:|
| staffel | 3 | 3 ✓ | 6 |
| spurt | 2 | 2 ✓ | **4** |
| takeshis-castle | 4 | 4 ✓ | 6 |
| time-trial | 4 | 4 ✓ | 6 |

Keine ist 6, keine ist von einer Vorlage kopiert. Die Falle, vor der die Kommentare warnen, ist
sauber umgangen.

**Der Kommentar selbst hat allerdings einen Zahlendreher:** er behauptet zweimal,
`BAHN_ART[d].jeSeite` sei „fuer alle vier 6". Fuer Spurt ist es **4**. Das ist nicht
belanglos — genau diese 4 ist die Ursache des Funds in Abschnitt 3. Siehe **F5**.

### 2.4 Climbing bewusst draussen — haelt der Regressionstest wirklich?

**Ja, und ich habe es nicht nur gelesen, sondern erzwungen.** Der Test existiert
(`tests/battle-mode-arena-team-points.test.ts`, „enthaelt NICHT Climbing (besteht die
Rangtreue-Schranke knapp nicht, 0,790 < 0,80)").

Zwei Mutationsproben in meinem Worktree, danach zurueckgesetzt:

1. **Nur** `"climbing"` in `ARENA_RESOLVED_DISCIPLINE_IDS` eingetragen → die Suite faellt schon
   beim Modul-Laden um, mit der Fail-Fast-Meldung „steht in ARENA_RESOLVED_DISCIPLINE_IDS, aber
   NICHT in ARENA_IMPACT_KONFIG_JE_DISZIPLIN". Climbing kann also gar nicht still hineinrutschen.
2. Climbing **zusaetzlich** mit einem eigenen Impact-Block versehen (Time-Trials Referenz
   geliehen) → genau **ein** Test wird rot, und zwar der Climbing-Regressionstest:
   `AssertionError: expected true to be false`, 1 failed | 74 passed.

Der Test tut also genau das, was die PR ihm zuschreibt. Das ist der sauberste Teil dieser PR.

**Eine Praezisierung:** die PR sagt, „beide Fail-Fast-Querpruefungen" seien um die neue Menge
erweitert worden. Erweitert wurde **eine** (die Chassis-Mengen-Schleife, `:253`). Die zweite
(`:754`) laeuft ohnehin ueber `ARENA_RESOLVED_DISCIPLINE_IDS` und deckt die vier neuen Eintraege
automatisch mit ab — sie brauchte keine Zeile. Die Wirkung stimmt, die Beschreibung ist
ungenau. Aktenlage.

### 2.5 Rangtreue-Neutralitaet

**Bit-identisch, von mir selbst gemessen**, auf beiden Baeumen mit derselben Kaderfamilie
(`data/generated/kaderfamilie-live-save.json`, md5 auf beiden Seiten gleich):

* fuenf Bahn-Disziplinen inkl. Climbing als Kontrollgruppe → `diff` leer,
* neun Buehnen-Disziplinen + Basketball/Hockey/Football → `diff` leer.

Zusammen mit dem Diff (18 `+`-Zeilen, 0 `-`-Zeilen im Motor) ist die Zusage „rein additiv"
damit doppelt belegt.

### 2.6 `pruefe-pps-referenz-frische.ts`

Selbst gefahren, auf beiden Baeumen. Die vier neuen Referenzen stehen auf `aktuell` (Motor-Hash
`bbd08be6…`); die zehn bestehenden auf `VERALTET`. Das Skript endet mit Exit 1 — **auf dem
Basis-Commit allerdings genauso** (dort sind fuenf der zehn veraltet). Der CI-Job ist bewusst
`continue-on-error: true` (`.github/workflows/ci.yml:314`, mit ausfuehrlicher Begruendung), und
GitHub meldet ihn folgerichtig als `success`. Die PR beschreibt das korrekt.

Dass die zehn bestehenden Referenzen trotz `VERALTET` **nicht** neu gezogen werden muessen, habe
ich unabhaengig belegt: die Rangtreue aller zwoelf Nicht-Bahn-Disziplinen ist vorher/nachher
bit-identisch, und der Motor-Diff enthaelt keine geloeschte Zeile. Der Hash aendert sich, der
rohe Boxscore-Wert nicht.

---

## 3. Der Fund, der die Auflage begruendet: Spurt

Dies ist der Teil, den die PR nicht geprueft hat und der bei der Abnahme des Plans ausdruecklich
verlangt war. Plan, Abschnitt 6.4, woertlich:

> Abnahme: **(a) die tatsaechliche Teilnehmerzahl je Seite entspricht `n`**, (b) rho bleibt bei
> jeder Feldgroesse ueber 0,80.

Die PR liefert (b) — die Feldgroessen-Matrix — und laesst **(a)** aus. Ich habe (a) nachgeholt,
und zwar nicht mit `disziplinProbe(jeSeite)` (das setzt `art.jeSeite` um und misst deshalb
etwas, das die Produktion nie faehrt), sondern ueber **denselben Produktionspfad, den ein echter
Spieltag nimmt**: `runArenaFixtures()` gegen den echten Spielstand
(`data/persistence/oly-app.sqlite`, 32 Teams, 64 Fixtures — Zeichen fuer Zeichen der Aufbau von
`scripts/ziehe-buehne-pps-referenz.ts`, nur mit einer Zaehlung je Fixture daneben).

### 3.1 Spurt faehrt nie mehr als 4 gegen 4 — auch wenn 6 nominiert sind

| Lauf | Fixtures | Boxscore-Eintraege | erwartet | Verteilung |
|---|---:|---:|---:|---|
| **spurt, n=6 nominiert** | 64 | **512** | 768 | 64x **8** |
| spurt, n=2 nominiert | 64 | 264 | 256 | 60x 4, **4x 6** |
| staffel, n=2 (Kontrolle) | 64 | 256 | 256 | 64x 4 |

Der Grund steht in `bauSpurt()` (`:17863`): `const n = art.jeSeite;` und danach
`mine = (…).slice(0, n)` / `gegen = (…).slice(0, n)`. Fuer Spurt ist `jeSeite` **4** — Spurt ist
die **einzige** der vierzehn arena-aufgeloesten Disziplinen, deren Motor-Feldgroesse unter der
maximalen Saison-Feldgroesse 6 liegt (alle anderen: 6, nachgezaehlt fuer `BUEHNE_ART`,
`BAHN_ART` und `FELDSPIEL_ART`).

Die Saison wuerfelt die Feldgroesse je Disziplin gleichverteilt aus 2..6
(`buildSeasonPlayerCountByDiscipline`, `lib/season/season-discipline-schedule.ts:107` — Spurt
liegt in der Kategorie „speed" mit genau fuenf Disziplinen, bekommt also eine Permutation von
`[2,3,4,5,6]`). **In zwei von fuenf Saisons laufen damit ein bis zwei nominierte Spurt-Laeufer je
Seite ueberhaupt nicht mit.**

Was mit ihnen passiert, habe ich zu Ende verfolgt:
`computeIndividualBoxscorePpsFromFixtureResults()` (`:1091`) iteriert ausschliesslich ueber
`result.boxscore`. Wer dort fehlt, steht nicht in der Map. Und
`legacy-matchday-resolve-engine.ts:834` liest
`arenaIndividualPpsForThisDiscipline?.get(playerId) ?? distributedPoints.entries[index]?.points`
— der fehlende Spieler faellt also auf den **alten** PPS-Pfad zurueck. Ich habe das mit einem
synthetischen Fixture direkt nachgestellt: der nicht gelaufene Spieler fehlt in der Map.

Das ist kein Absturz, aber ein **Mischbetrieb innerhalb einer Disziplin und desselben Teams**:
vier Spieler bekommen Arena-PPs auf der „max 5,5"-Skala, ein bis zwei bekommen einen Anteil aus
dem Rang-zu-Punkte-Topf (dessen Rang-1-Wert bei Feldgroesse 6 rund 19,9 betraegt). Es ist damit
moeglich, dass ein Spieler, der gar nicht gelaufen ist, mehr PPs bekommt als der Sieger des
Rennens.

### 3.2 Ein Team von 32 bekommt seine Spurt-Aufstellung nicht angewendet

Der zweite Teil des Funds ist der schwerere. Bei n=2 lieferten **4 von 64 Fixtures 6 statt 4
Laeufer** — und alle vier betreffen **dasselbe Team** (`V-W`), jeweils auf seiner eigenen Seite:

```
V-V vs V-W: 6 Eintraege (erwartet 4) — home 2, away 4
R-C vs V-W: 6 Eintraege (erwartet 4) — home 2, away 4
W-L vs V-W: 6 Eintraege (erwartet 4) — home 2, away 4
V-W vs T-T: 6 Eintraege (erwartet 4) — home 4, away 2
```

`V-W` stellt also **vier** Laeufer gegen die zwei des Gegners. Der Mechanismus ist die
Ersatzaufstellung in `bauSpurt()`: `const ersatz = [...SQUAD].sort(…).slice(0, n)` und
`mine = (gesetzt.length ? gesetzt : ersatz).slice(0, n)` — wenn `gesetzt` leer ist, weil die
Aufstellung nicht im `place`-Objekt ankam, setzt der Motor still seine eigenen `n = 4` besten
ein. Bei Staffel (Kontrolllauf, `jeSeite` 6) tritt derselbe Fall bei **keinem** der 32 Teams
auf — es ist also kein genereller Aufstellungsfehler, sondern einer, der `V-W` in Spurt trifft.
Die Wurzel (ein Namensdoppel in `buildArenaAufstellung()`? ein nicht aufloesbarer Slot?) habe ich
**nicht** isoliert; das gehoert in einen eigenen Auftrag.

### 3.3 Was das mit den ausgezahlten Punkten macht

Die vier Ausreisser-Fixtures sind 3 % der Stichprobe und landen damit **genau im 99,5.-Perzentil**,
aus dem `iKrass` gezogen wird. Nachgerechnet, und es geht exakt auf:

* n=2: 60 Fixtures x 4 Laeufer + 4 Fixtures x 6 Laeufer = **264** Werte. Haeufigkeiten 1..4 je 64,
  5 und 6 je 4. Median = **3** (statt 2,5), p99,5 = **6** (statt 4). Genau die Werte in
  `spurt-pps-referenz.json`.
* n=3: 60 x 6 + 4 x 7 = **388** Werte, Median = **4** (statt 3,5), p99,5 = **7** (statt 6).
  Ebenfalls exakt die Werte in der Datei.

Und so sieht die Auszahlung aus. Ich habe `ppsAusArenaImpact()` mit den mitgelieferten Referenzen
gefahren (max 5,5 · anteilMitte 0,25, wie bei allen anderen Disziplinen):

| Disziplin, Feldgroesse | Sieger | 2. | 3. | Letzter | Summe des Feldes |
|---|---:|---:|---:|---:|---:|
| Staffel n=2 (sauber) | **5,50** | 2,35 | 0,71 | 0,09 | 8,65 |
| Time-Trial n=2 (sauber) | **5,50** | 2,35 | 0,71 | 0,09 | 8,65 |
| **Spurt n=2 (verunreinigt)** | **2,44** | 1,38 | 0,61 | 0,15 | **4,58** |
| Staffel n=3 (sauber) | **5,50** | 3,44 | 1,94 | 0,05 | 12,18 |
| **Spurt n=3 (verunreinigt)** | **3,75** | 2,39 | 1,38 | 0,04 | **8,48** |
| Spurt n=4/5/6 (unauffaellig) | 5,50 | 3,99 | 2,75 | 0,04 | 15,80 |

**Der Sieger eines Spurts bei Feldgroesse 2 bekommt 2,44 statt 5,50 PPs — 56 % weniger als der
Sieger jedes strukturell identischen Rennens.** Das gesamte Feld holt knapp die Haelfte. Bei
Feldgroesse 3 sind es 32 % weniger. Zusammen betrifft das rund zwei von fuenf Saisons.

Das ist kein Fehler im Code dieser PR — die Referenz ist ein ehrlicher Auszug aus einem Pfad,
der sich schon vorher so verhalten hat. Aber **diese PR ist der Moment, in dem diese Zahlen
anfangen, echte Punkte auszuzahlen**, und dann ist eine Referenz, in der 3 % der Stichprobe aus
einem anderen Rennformat stammen, nicht gut genug. Deshalb die Auflage.

Bei n=4/5/6 ist Spurts Referenz uebrigens **richtig**, und zwar aus dem Grund, der oben wie ein
Problem aussah: weil der Motor immer auf 8 Laeufer kappt, ist die dort gemessene Verteilung
(1..8, `iKrass` 8) genau die, die die Produktion faehrt. Das ist Glueck, nicht Absicht — der
Kommentar in der PR sagt ja, `jeSeite` sei „fuer alle vier 6".

---

## 4. Was die Feldgroessen-Matrix der PR misst — und was nicht

Die Matrix entsteht ueber `miss-alle-disziplinen.mjs --je-seite=n`, und das setzt intern
`art.jeSeite = n` (`disziplinProbe`, `:22545`). Fuer Staffel, Takeshi und Time-Trial ist das
identisch mit der Produktion. **Fuer Spurt nicht:** die Matrixzeilen n=5 (0,892) und n=6 (0,918)
beschreiben Rennen mit 10 bzw. 12 Laeufern, die es in der Produktion nicht gibt — dort laufen in
beiden Faellen 8. Die produktionsechte Zahl fuer Spurt bei nominierter Feldgroesse 5 oder 6 ist
die n=4-Zeile (0,871 / 0,871). Sie liegt ebenfalls ueber der Schranke, die Matrix ist also nicht
*falsch*, aber sie beschreibt fuer zwei ihrer fuenf Spurt-Zeilen eine andere Maschine. Siehe **F6**.

---

## 5. Time-Trial bei n=3: meine Einschaetzung weicht von der der PR ab

Die Zahl selbst habe ich exakt reproduziert (24 Spiele, fuenf Kaderpaarungen):

| n je Seite | rho je Spiel | Spannweite | rho Saison | Spannweite | PR sagt |
|---:|---:|---:|---:|---:|---|
| 2 | 0,925 | 0,250 | 1,000 | 0,200 | 0,925 ✓ |
| **3** | **0,790** | 0,271 | **0,771** | 0,229 | 0,790 ✓ |
| 4 | 0,818 | 0,155 | 0,833 | 0,150 | 0,818 ✓ |
| 5 | 0,821 | 0,054 | 0,806 | 0,061 | 0,821 ✓ |
| 6 | 0,828 | 0,087 | 0,832 | 0,056 | 0,828 ✓ |

**Die PR erklaert den Ausreisser mit Kaderrauschen. Fuer die Einzelspielzahl gebe ich ihr recht,
fuer die Saisonzahl nicht.** Ich habe n=3 mit **96 statt 24 Spielen** nachgemessen:

```
time-trial  n=3, 24 Spiele:  rho je Spiel 0,790 (knapp)       rho Saison 0,771
time-trial  n=3, 96 Spiele:  rho je Spiel 0,839 (bestanden)   rho Saison 0,771
time-trial  n=4, 96 Spiele:  rho je Spiel 0,829 (bestanden)   rho Saison 0,810   (Kontrolle)
```

Die Einzelspielzahl steigt bei vierfacher Stichprobe von 0,790 auf **0,839** und liegt damit
klar ueber der Schranke — das ist genau das Verhalten, das man von Rauschen erwartet, und die
Diagnose der PR ist insoweit bestaetigt. **Die Saisonzahl bleibt in beiden Laeufen bei 0,771**,
also stabil unter 0,80 — waehrend die Kontrolle bei n=4 mit derselben Stichprobe auf 0,810
kommt. Der Einbruch sitzt also bei 3 je Seite, nicht generell bei kleinen Feldern.

Nach der Zwei-Spalten-Regel aus `CLAUDE.md` ist das die unangenehmere Haelfte: „Ist die
Saisonzahl hoch und die Einzelspielzahl niedrig, fehlen EREIGNISSE. Sind beide niedrig, belohnt
die Mechanik das Falsche." Hier ist die Saisonzahl (Validitaet) niedrig und ruehrt sich nicht,
waehrend die Einzelspielzahl bei mehr Daten hochgeht — das Muster passt in keine der beiden
Schubladen sauber, aber es ist **kein reines Ereigniszahl-Problem**. Bei 3 je Seite sind es nur
sechs Laeufer, und eine Rangkorrelation ueber sechs Punkte ist grob quantisiert; ich wuerde
daraus keine Panik ableiten, aber auch nicht „Rauschen, erledigt".

**Meine Einschaetzung:** die PR-Entscheidung, G4 bei 12 statt 15 zu lassen, ist richtig und
vorsichtig genug. Kritisch ist der Fund **nicht** — Time-Trial ist bei jeder anderen Feldgroesse
sauber, und bei n=3 haelt die Einzelspielzahl bei ausreichender Stichprobe. Aber die
Begruendung sollte ehrlicher lauten: nicht „innerhalb des Kaderrauschens", sondern „die
Einzelspielzahl ist Rauschen, die Saisonzahl bei 3v3 ist reproduzierbar niedrig und noch nicht
verstanden". Das gehoert in `docs/design/stand-aller-disziplinen.md`, nicht in einen Nachtrag,
den niemand wiederfindet. Siehe **F7**.

---

## 6. `takeshi.tsx` — die fuenf Zonen stammen wirklich aus dem Motor

**Behauptung geprueft, sie stimmt.** `BAHN_ART["takeshis-castle"].zonen` (`:17240`) traegt:

```js
zonen:[{bis:0.12,boden:"pfad",    um:"wiese"},
       {bis:0.36,boden:"kies",    um:"waelle"},
       {bis:0.60,boden:"planken", um:"see"},
       {bis:0.86,boden:"pfad",    um:"huegel"},
       {bis:1.00,boden:"pflaster",um:"hof"}]
```

`takeshi.tsx:43-48` traegt dieselben fuenf `bis`-Marken und dieselben fuenf `boden`-Werte,
Zeichen fuer Zeichen. Die Etiketten (`SAMMELPLATZ · WIESE`, `HOLZBAUTEN · WALD`,
`DER SEE · SCHLAMMUFER`, `DER HANG`, `BURGHOF`) entsprechen der `um`-Spalte und dem Kommentar
darueber im Motor.

**Und die Korrektur am Plantext ist berechtigt.** Der Plan (Abschnitt 6.5) nennt
„Schlamm, Wasser, Stein, Eis, Wiese". Im Motor gibt es kein Terrain „Eis" — `"eis"` existiert
dort nur als **Fallentyp** (`fallenBild.TECHNIK:["labyrinth","eis"]`), und „Stein" gibt es
ueberhaupt nicht, wohl aber `kies`, `planken`, `pflaster`. Der PR-Autor hat den Motor gelesen
statt den Plan abgeschrieben. Das ist genau die richtige Reihenfolge.

Die zehn Fallenbilder (`labyrinth, steine, tuer, brueckenball, eis, walzen, seilwand, schlamm,
raeder, spitzen`) sind vollstaendig und decken `fallenBild` exakt ab.

**Zwei ehrliche Einschraenkungen, die die PR nicht nennt:**

* Die zehn Symbole stehen **gleichverteilt** auf 5 %…95 % der Route (`takeshi.tsx:180`). Der
  Motor hat **vierzehn** Stationen an festen, ungleichen Marken (`hindernisse: [0.07 … 0.96]`).
  Die `.tsx` zeigt also die richtigen Bilder an ungefaehr richtigen Stellen, nicht die Strecke.
  Fuer eine Feld-Uebersicht ist das voellig in Ordnung — nur ist es keine 1:1-Uebernahme, wie
  es die Zonen sind. Siehe **F8**.
* Die beigelegten Vorher/Nachher-Screenshots belegen die **Auffaecherung nicht**. Auf beiden
  stehen alle Tokens am Start, und dort ueberlappen sie unabhaengig von der Bahnenzahl. Dass der
  Versatz wirklich breiter wurde, habe ich statt dessen am Code abgenommen:
  `(t.laneIdx % 5) - 2` mit Faktor 9 (±18 px) wird zu `(t.laneIdx % 9) - 4` mit Faktor 11
  (±44 px). Der Diff ist eindeutig, das Bild ist es nicht.

Der Rest der Datei ist unauffaellig: `getPointAtLength` erst im Effekt nach dem Mount, feste
`viewBox`-Geometrie (also keine fehlende Resize-Abhaengigkeit), `dangerouslySetInnerHTML` nur mit
Strings aus einer festen Konstantenliste, kein Zugriff auf Motor- oder Wertungszustand.

---

## 7. Funde

**F1 — Spurt: verunreinigte PPS-Referenz und ungenutzte Nominierungen. VOR DEM MERGE ENTSCHEIDEN.**
Zwei getrennte Beobachtungen mit derselben Wurzel (`BAHN_ART.spurt.jeSeite = 4`):
(a) bei nominierter Feldgroesse 5 oder 6 laufen 8 statt 10/12 Spieler, der Rest faellt auf den
alten PPS-Pfad zurueck — Mischbetrieb in einer Disziplin;
(b) 4 von 64 Referenz-Fixtures liefen 4 gegen 2, weil ein Team seine Aufstellung nicht angewendet
bekam; dadurch steht in `spurt-pps-referenz.json` bei n=2 `iKrass` 6 statt 4 und bei n=3 7 statt
6, und der Sieger bekommt 2,44 statt 5,50 bzw. 3,75 statt 5,50 PPs.
**Empfehlung:** `"spurt"` aus `ARENA_RESOLVED_DISCIPLINE_IDS` und `ARENA_BAHN_DISCIPLINE_IDS`
nehmen und die drei anderen Bahnen mergen (die Fail-Fast-Querpruefungen tragen das ohne weitere
Aenderung), **oder** die Referenz neu ziehen, nachdem die Aufstellungsluecke geklaert ist.

**F2 — „nicht-negativ" stimmt fuer Takeshi nicht.** 10,3 % der Takeshi-Boxscore-Werte sind
negativ (gemessen, 240 Saaten); die mitgelieferte Referenz zeigt es an ihren `p1`/`p5`-Quantilen
selbst. Diese Spieler bekommen 0,00 PPs. Sachlich vertretbar, aber der Satz „ordnungsidentische,
**nicht-negative** Zwillingsgroesse" steht wortgleich an drei Stellen im Code und ist dort falsch.
Halbsatz nachziehen.

**F3 — der 0,992-Befund ist staffelspezifisch.** Gepoolt messe ich fuer Spurt, Takeshi,
Time-Trial und Climbing exakt 1,0; nur die Staffel faellt auf 0,99193. Der Test-Kommentar sagt es
richtig, die PR-Beschreibung verallgemeinert. Aktenlage.

**F4 — die Rangordnungs-Invariante ist empirisch, nicht strukturell.** `bahnRangliste()` und
`MOTOREN[bd].wert()` sortieren Nichtfertige nach verschiedenen Schluesseln (`pos` gegen
`bahnZeit ?? 99`; bei der Staffel `null` gegen `fertig ?? 60`). In 240 Saaten je Bahn gab es
keinen einzigen Laeufer ohne Zielzeit, deshalb faellt es nicht auf. Ein Rezept, das kuenftig
DNFs erzeugt (oder eine kleinere Feldgroesse mit Zeitueberschreitung), koennte die Invariante
brechen — und dann waeren PPs und Rangtreue-Messung leise verschieden. Ein Testfall mit
erzwungenem DNF waere die billige Absicherung.

**F5 — Kommentar-Zahlendreher.** „`BAHN_ART[d].jeSeite` (Motor-Feldgroesse, fuer alle vier 6)"
steht in `battle-mode-arena-team-points.ts` und sinngemaess in `ziehe-buehne-pps-referenz.ts`.
Spurt hat 4. Genau diese 4 ist die Ursache von F1.

**F6 — die Feldgroessen-Matrix misst fuer Spurt bei n=5/6 eine Maschine, die es nicht gibt.**
`--je-seite=n` setzt `art.jeSeite` um, die Produktion nicht. Die produktionsechte Spurt-Zahl fuer
nominierte 5 oder 6 ist die n=4-Zeile.

**F7 — Time-Trial n=3: die Saisonzahl ist der bleibende Teil.** rho je Spiel steigt bei 96 statt
24 Spielen von 0,790 auf 0,839; rho Saison bleibt in beiden Laeufen 0,771. Die
Entscheidung (G4 = 12) ist richtig, die Begruendung („Kaderrauschen") deckt nur die eine Haelfte.

**F8 — die zehn Fallenbilder in `takeshi.tsx` stehen gleichverteilt, der Motor hat vierzehn
Stationen an festen Marken.** Praesentational unkritisch; die PR sollte es nur nicht als
1:1-Uebernahme verkaufen, wie es bei den Zonen zu Recht der Fall ist.

**F9 — die Ueberschrift „Assets 60 % → 95 %" trifft fuer diese PR nicht zu.** Die PR rechnet
selbst korrekt vor: A4 (Ton) bleibt 0, also **80**; die 95 kommen erst, wenn PR 0 (#872) gemerged
ist und die vier Ton-Aufrufstellen ergaenzt werden — was ausdruecklich nicht Teil dieser PR ist.
Auch A3 (Requisiten-Zeile) gehoert #872. Im Text steht es, in der Ueberschrift nicht.

**F10 — die PR setzt einen Plan um, der auf ihrer eigenen Basis noch nicht liegt.** Basis ist
`c56fffd7`, der Plan kam mit `688ef656`. Ohne Belang fuer den Code, aber wer den Branch
auscheckt, findet die referenzierte Plandatei nicht.

---

## 8. Was ich nicht pruefen konnte

* **Die Wurzel der Aufstellungsluecke bei Team `V-W`** (F1b). Reproduzierbar in 4 von 4 seiner
  Spurt-Fixtures, in der Staffel bei keinem Team — aber ich habe nicht isoliert, ob es an einem
  Namensdoppel in `buildArenaAufstellung()`, an `resolveSlotRoleShortId()` oder an den Kaderdaten
  dieses einen Teams liegt. Das ist ein eigener Auftrag, kein Review-Anhang.
* **Ein echter Spieltag-Resolve mit ausgezahlten PPs.** Ich habe die Kurve, die Referenz und den
  Weg durch `computeIndividualBoxscorePpsFromFixtureResults()` /
  `legacy-matchday-resolve-engine.ts` gerechnet und punktuell mit einem synthetischen Fixture
  nachgestellt — aber keine ganze Saison durchgespielt. Die Zahlen in 3.3 sind aus der Kurve
  gerechnet, nicht aus einem Endstand abgelesen.
* **Die `.tsx` im laufenden DEV-Arena-Harness.** Ich habe die beiden beigelegten Screenshots
  gelesen und den Code abgenommen, aber keinen Next-Server gestartet. Die Auffaecherung ist
  deshalb am Diff belegt, nicht am Bild (Abschnitt 6).
* **Der Server.** Wie in `CLAUDE.md` beschrieben kommen Agenten nicht heran; alles hier ist am
  Repo, an den zwei Worktrees und am lokalen Spielstands-Abbild gemessen.

---

## 9. Fazit

Handwerklich ist das die sauberste der vier Feinschliff-PRs. Der Motor-Diff ist rein additiv
(18 `+`-Zeilen, keine `-`-Zeile), siebzehn gemessene Disziplinen sind vorher/nachher
bit-identisch, `tsc` bringt auf beiden Baeumen dieselben 560 vorbestehenden Fehler, die zwoelf
Pflicht-Invarianten laufen in echtem Chromium durch, alle vier CI-Jobs sind gruen, und die
beiden Zahlen, die mich am meisten interessiert haben — je Rennen 1,0 und gepoolt 0,992 —, habe
ich mit eigener Implementierung auf die Nachkommastelle wiedergefunden. Der Climbing-Ausschluss
ist nicht nur dokumentiert, sondern durch zwei ineinandergreifende Sperren erzwungen; ich habe
beide durch Mutation rot gemacht.

Was fehlt, ist die Abnahme (a) aus dem Plan: **entspricht die tatsaechliche Teilnehmerzahl je
Seite der nominierten?** Fuer drei der vier Bahnen ja. Fuer Spurt nein, und daran haengt eine
Referenz, die bei zwei von fuenf Feldgroessen weniger als die Haelfte der ueblichen PPs auszahlt.
Das ist keine Schlamperei des Autors — der Fehler ist aelter als diese PR und war ohne einen Lauf
gegen den echten Spielstand nicht zu sehen. Aber es ist der Unterschied zwischen „Praesentation"
und „echte Punkte", und genau deshalb war fuer diese PR eine zweite Messung verlangt.

**FREIGEBEN MIT NACHTRAG — unter der Auflage aus F1.** Staffel, Takeshi's Castle und Time-Trial
koennen so, wie sie sind, auf `main`. Spurt braucht vorher entweder eine Zeile weniger oder eine
neue Referenz.

---
_Generated by [Claude Code](https://claude.ai/code)_
