# Opus-Overseer-Review PR #867 — Produktivierungswelle 2 (fuenf Buehnen-Disziplinen arena-aufgeloest)

**Datum:** 09.09.2026
**PR:** [#867](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/867) —
„PRODUKTIONSCODE (besondere Review-Sorgfalt): Produktivierungswelle 2 — fuenf Buehnen-Disziplinen
arena-aufgeloest (09.09.)"
**Branch:** `feat/produktivierungswelle-2-buehne`, Kopf `bbe368b2`, Basis `origin/main` = `e6461933`
**Reviewer:** unabhaengiger Opus-Overseer, **nicht an der PR beteiligt** (Zweitpruefung wie bei
#844/#850/#854/#858/#859/#864)
**Pruefumgebung:** isolierter Worktree `/tmp/wt-review-867` (PR-Kopf) plus zweiter, unberuehrter
Worktree `/tmp/wt-review-867-main` auf `origin/main`. Der geteilte Haupt-Worktree wurde nicht
angefasst.

---

## 0. Empfehlung

### **FREIGEBEN MIT NACHTRAG**

Die zentrale Behauptung der PR — „reine Konfigurationsaenderung, der Diff an
`public/mockups/battle-mode.engine.js` ist leer" — **haelt der unabhaengigen Pruefung stand, und
zwar auf Blob-Hash-Ebene, nicht nur dem Auge nach.** Jede einzelne der zehn im Auftrag genannten
Pruefungen wurde selbst gefahren, keine aus der PR-Beschreibung uebernommen. Alle
Zahlenbehauptungen der PR sind **exakt** reproduziert worden — 1027/8132, 560/560, ±0,000 fuer alle
zwanzig Disziplinen, 0 Fehler / 2 Warnungen bei eslint.

Zwei Dinge gehen ueber „nachgerechnet" hinaus und sind der eigentliche Gewinn dieser Zweitpruefung:

1. **Der Test-Fund ist echt, nicht behauptet.** Ich habe die Kontrolldisziplin probeweise auf
   `"fechten"` zurueckgedreht — die Suite faellt dann tatsaechlich mit **drei** roten Tests um, und
   der neue Wachhund meldet sich als erster mit der Ursache statt mit einem Zahlendiff. Der Fund
   war nicht kosmetisch beschrieben, er war real.
2. **Die fuenf Referenzen sind bitgenau reproduzierbar.** Ich habe zwei davon gegen dasselbe
   `live-save`-Abbild neu gezogen (Tennis n=6 ueber das Duell-Chassis, Eiskunstlauf n=2 ueber das
   Auftritt-Chassis, je 64 Fixtures, je ~8,7 Minuten) — beide kommen **Zeichen fuer Zeichen**
   identisch heraus. Das ist der Nachweis, den die PR-Beschreibung selbst nicht antritt.

Der **Nachtrag** ist ausdruecklich **kein Merge-Blocker**: drei Kommentar-/Formatierungsstellen,
zwei davon aelter als diese PR (Abschnitt 8). Sie beruehren kein Verhalten, keinen Testausgang und
keine Zahl. Sie gehoeren in einen eigenen, winzigen Folge-PR, nicht in diesen.

**Zusaetzlicher Risikobefund, unabhaengig erhoben:** Auf dem Live-Server hat **kein einziger Save**
`gameMode: "battle"` — ich habe alle sieben Saves im aktuellen `live-save`-Abbild einzeln aus
`game_metadata.payload_json` gelesen (Abschnitt 7). Diese Aenderung ist damit fuer Chris' laufendes
Spiel heute **schlafend**. Das senkt das Risiko dieses PRs auf praktisch null und deckt sich mit
dem, was die PR unter „Nicht verifiziert" selbst offenlegt.

---

## 1. Was ich gepruefte habe, und was dabei herauskam — Kurztafel

| # | Pruefung | Behauptung der PR | Mein Ergebnis | Urteil |
|---|---|---|---|---|
| 1 | Isolierter Worktree | — | angelegt, `node_modules` verlinkt, Haupt-Worktree unberuehrt | ok |
| 2 | `battle-mode.engine.js` unveraendert | „Diff ist LEER" | **Blob-Hash identisch** (`abb29257…`), kein `public/`-Eintrag im Diff ueberhaupt | **bestaetigt** |
| 3 | Einstiegspunkte + `katalogStandardgroesse` | Auftritt 3x / Duell 2x, 3/4/5/3/5 | alle fuenf Flags in `BUEHNE_ART` einzeln nachgelesen, alle fuenf `playerCount` in `dataAdapter.ts` einzeln nachgelesen | **bestaetigt** |
| 4 | Fuenf neue PPS-Referenzen | frisch, sauber, gegen echten Kader | Motor-Hash **aktuell**, Save im Abbild vorhanden, alle 25 Eintraege gueltig, **zwei bitgenau nachgezogen** | **bestaetigt, verschaerft** |
| 5 | `npx vitest run` | 1027 / 8132 gruen | **1027 Dateien / 8132 Tests gruen**, beide Wachhund-Dateien gruen, Chromium-E2E lief wirklich | **bestaetigt** |
| 6 | rho, alle 20, PR-Kopf **und** `main` | „Zeile fuer Zeile identisch" | zweimal voll gefahren, **20 von 20 Zeilen identisch** | **bestaetigt** |
| 7 | `pruefe-slot-invariante.ts` | haelt, max 0,005 Pp | haelt, max **0,005 Pp** (mini-dm @ n=2), Grenze 0,2 | **bestaetigt** |
| 8 | I-Spy-Ausschluss | rho 0,684, unter der Schranke | **frisch gemessen 0,684** — Ausschluss war richtig | **bestaetigt** |
| 9 | `tsc --noEmit` | 560 / 560, keiner in geaenderter Datei | **560 auf beiden**, kein Treffer in einer der sechs geaenderten Dateien | **bestaetigt** |
| 10 | GitHub-CI | — | **alle vier Checks gruen** | ok |
| + | Mutationsprobe am Test-Fund | (nicht behauptet) | mit `"fechten"` fallen **3 Tests** um — Fund ist real | **neu** |
| + | PPs-Kurve aller zehn Disziplinen | (nicht behauptet) | die fuenf Neuen liegen im selben Korridor wie die fuenf Alten | **neu** |
| + | Battle-Mode-Nutzung im Live-Save | „kein aktiver Save" | **0 von 7 Saves** haben `gameMode:"battle"` | **bestaetigt** |

---

## 2. Der Diff — was wirklich drin ist

```
 data/generated/breaking-pps-referenz.json            115 +
 data/generated/eiskunstlauf-pps-referenz.json        115 +
 data/generated/fechten-pps-referenz.json             115 +
 data/generated/tennis-pps-referenz.json              115 +
 data/generated/wettessen-pps-referenz.json           115 +
 lib/battle/arena-headless-runner.ts                   39 +/  5 -
 lib/resolve/battle-mode-arena-team-points.ts         163 +
 scripts/ziehe-buehne-pps-referenz.ts                 431 +
 tests/battle-mode-arena-matchday-resolve-e2e.test.ts  34 +/ 13 -
 tests/battle-mode-arena-resolve-engine.test.ts        36 +/ 15 -
 tests/battle-mode-arena-team-points.test.ts           29 +
 11 Dateien, 1307 +, 33 -
```

`git merge-base origin/main HEAD` = `e6461933` = `origin/main`s Kopf. Der Branch ist also **exakt
auf dem aktuellen main** aufgesetzt, ein Commit, kein Merge-Ballast.

**Eine Praezisierung zur PR-Beschreibung.** Die Formulierung „reine Konfigurationsaenderung"
stimmt in der Sache, koennte einen fluechtigen Leser aber glauben lassen, es sei **nur**
`battle-mode-arena-team-points.ts` beruehrt. Tatsaechlich sind **zwei** Produktionsdateien
geaendert: dazu `lib/battle/arena-headless-runner.ts` (die drei Chassis-Mengen). Die PR nennt das
im Schlussabsatz („Beruehrt die geteilte Engine-Anbindung … und den Punkte-Pfad") ausdruecklich,
und der Diff dort besteht aus zwei Mengen-Erweiterungen plus Kommentar — kein Kontrollfluss, keine
Verzweigung, keine Funktion. Die Aussage traegt also; ich halte sie nur fest, damit niemand die
Datei beim Nachlesen uebersieht.

---

## 3. Punkt 2 — ist der Motor wirklich unberuehrt?

Nicht „im Diff sehe ich nichts", sondern der harte Nachweis:

```
git rev-parse origin/main:public/mockups/battle-mode.engine.js  -> abb29257a1aac389a07e77257ab376b386459c2c
git rev-parse HEAD:public/mockups/battle-mode.engine.js         -> abb29257a1aac389a07e77257ab376b386459c2c
git diff --name-only origin/main...HEAD -- public/              -> (leer)
```

Gleiche Blob-SHA heisst **bitgleich**. Und unter `public/` steht ueberhaupt kein Eintrag im Diff,
nicht nur beim Motor. Damit ist die Kernbehauptung der PR nicht plausibel, sondern **beweisbar**
wahr.

Dasselbe habe ich fuer **alle Eingaben der rho-Messung** gemacht, weil davon Punkt 6 abhaengt:

| Datei | main | PR |
|---|---|---|
| `public/mockups/battle-mode.engine.js` | `abb29257…` | **identisch** |
| `public/mockups/battle-mode.html` | `d357246c…` | **identisch** |
| `data/generated/kaderfamilie-live-save.json` | `e6bc3078…` | **identisch** |
| `data/generated/rangtreue-basislinie.json` | `599209c5…` | **identisch** |
| `scripts/lib/rangtreue-messung.mjs` | `615244d0…` | **identisch** |
| `scripts/pruefe-rangtreue-schranke.mjs` | `d2379734…` | **identisch** |
| `scripts/miss-alle-disziplinen.mjs` | `ec32a1cf…` | **identisch** |

Die einzigen Dateien unter `public/`, `data/`, `scripts/lib/` im gesamten Diff sind die fuenf neuen
JSON-Referenzen. Die rho-Gleichheit ist damit **strukturell zwingend** — und wurde trotzdem
zweimal empirisch gefahren (Abschnitt 6), weil „zwingend" in diesem Repo schon oefter „ungeprueft"
geheissen hat.

---

## 4. Punkt 3 — Chassis und Katalogfeldgroesse, jede einzeln nachgelesen

### 4.1 Die `BUEHNE_ART`-Flags (aus `battle-mode.engine.js`, Zeilen 10598 ff.)

| Disziplin | `heben` | `duell` | sonstige Flags | daraus folgt | im PR eingetragen als |
|---|:---:|:---:|---|---|---|
| eiskunstlauf | – | – | **`duett:true`** | Auftritt | Auftritt ✓ |
| breaking | – | – | `cypher:true` | Auftritt | Auftritt ✓ |
| wettessen | – | – | – | Auftritt | Auftritt ✓ |
| tennis | – | **`duell:true`** | – | Duell | Duell ✓ |
| fechten | – | **`duell:true`** | – | Duell | Duell ✓ |
| *i-spy (Kontrolle)* | – | **`duell:true`** | – | *Duell* | *nicht eingetragen* |

**Die `duett`/`duell`-Falle ist real, und die PR faellt nicht hinein.** Ich habe
`spieleBuehneAuftritt()` (engine.js Zeile 22077) gelesen: die Weiche ist
`if(!BUEHNE_ART[bd] || BUEHNE_ART[bd].heben || BUEHNE_ART[bd].duell) return null;` — sie fragt
`heben`/`duell` ab, **`duett` kommt darin ueberhaupt nicht vor**. Eiskunstlauf laeuft also korrekt
und ohne Sonderfall durch den Auftritts-Einstieg.

Ich bin der `duett`-Mechanik zusaetzlich nachgegangen, weil sie einen Einfluss auf die
INDIVIDUELLEN Boxscore-Werte haben koennte — genau die Zahl, aus der jetzt PPs werden. Ergebnis
(engine.js Zeile 11144 ff.): `duett` mischt die Rundenpunkte zweier Partner im Verhaeltnis
**80/20** (`ra.punkte = round(0.8*pa + 0.2*pb)`), es setzt sie **nicht gleich**. Die individuelle
Unterscheidbarkeit bleibt also erhalten — nachweisbar auch daran, dass Eiskunstlauf frisch
gemessen bei rho **0,885** steht, was bei gleichgesetzten Partnerwerten unmoeglich waere. Und die
Fusion greift **vor** dem Lauf auf `runden[]`, waehrend `u.summe` erst in `stepBuehne()` daraus
aufaddiert wird (`u.summe += r.punkte`, Zeile 11580) — die Teamsumme, die
`spieleBuehneAuftritt()` als Seitenstand liest, bleibt exakt erhalten. Kein Leck.

Ebenfalls geprueft: `MOTOREN[bd].wert()` ist fuer **alle** `BUEHNE_ART`-Disziplinen
`o[u.n] = u.summe` (Zeile 21405) — auch fuer die Duell-Disziplinen. Die Herkunftsangaben in der
`DISZIPLINEN`-Tabelle des neuen Skripts („`MOTOREN.tennis.wert() = u.summe, s. WERTUNG_DUELL()`")
sind damit sachlich richtig, nicht nur plausibel abgeschrieben.

### 4.2 `katalogStandardgroesse` — der Wert, bei dem man 6 nehmen wuerde

Alle fuenf einzeln aus `lib/data/dataAdapter.ts` gelesen:

| Disziplin | `Discipline.playerCount` (dataAdapter.ts) | `BUEHNE_ART[d].jeSeite` (Motor) | im PR eingetragen |
|---|---:|---:|---:|
| eiskunstlauf (Anzeigename „Eiskunst") | **3** | 6 | **3** ✓ |
| breaking | **4** | 6 | **4** ✓ |
| wettessen | **5** | 6 | **5** ✓ |
| tennis | **3** | 6 | **3** ✓ |
| fechten | **5** | 6 | **5** ✓ |

**Fuenf von fuenf richtig.** Und die Falle ist keine erfundene: `jeSeite` ist fuer **alle fuenf** 6,
ein Copy-Paste aus der Motor-Tabelle haette also fuenfmal denselben falschen Wert geliefert, ohne
dass irgendetwas rot geworden waere (es ist nur der Rueckfall fuer einen Spieltag ohne
ermittelbare Feldgroesse — er wuerde still die falsche Referenz-Feldgroesse waehlen). Dass der
Kommentar an jeder der fuenf Stellen „**NICHT 6**" ausdruecklich hinschreibt, ist genau die Art
Kommentar, die diese Klasse Fehler beim naechsten Mal verhindert.

### 4.3 Sind die drei Chassis-Mengen und die Aufloesungsliste konsistent?

Ja, und das Modul erzwingt es selbst. Zwei Fail-Fasts beim Modul-Laden, beide **schon vorhanden**
und beide von dieser PR mitbedient:

- „Chassis-Menge → arena-aufgeloest" (`battle-mode-arena-team-points.ts` Zeile 235)
- „arena-aufgeloest → eigener Impact-Konfig-Eintrag" (Zeile 646) — mit einer sehr guten Begruendung
  im Kommentar: ohne eigenen Eintrag faellt `loeseArenaImpactKonfigAuf()` **still** auf Basketballs
  Referenz zurueck (iKrass 51,5 bei n=6), und ein Buehnen-Rohwert von ~1200 gegen 51,5 normiert
  reisst den `min(1, …)`-Deckel fuer **jeden** Spieler. Alle bekaemen kommentarlos 5,5 PPs.

Zusaetzlich haelt `tests/battle-mode-arena-team-points.test.ts` beide Richtungen ueber die
oeffentliche Schnittstelle fest, inklusive `referenz !== basketball` je Disziplin. Der neue Test
„enthaelt Eiskunstlauf, Breaking, Wettessen, Tennis und Fechten" fuegt sich dort sauber ein.

Und, wichtig fuer die Behauptung „reine Konfiguration": ich habe **alle** Verwendungsstellen von
`ARENA_RESOLVED_DISCIPLINE_IDS` durchgesehen (`legacy-matchday-resolve-engine.ts`,
`arena-matchday-resolve-service.ts`, `arena-headless-runner.ts`, zwei Skripte). **Jede** einzelne
arbeitet ueber Mengen-Zugehoerigkeit, **keine** ueber ein Disziplins-Literal. Es gibt also keine
vergessene zweite Liste, in die die fuenf haetten eingetragen werden muessen. Das ist der Grund,
warum diese Welle wirklich nur aus Eintraegen besteht — die Architektur wurde in Welle 1 dafuer
gebaut, und sie haelt.

---

## 5. Punkt 4 — die fuenf neuen PPS-Referenzen

### 5.1 Provenienz

| Datei | `motorSha1` | aktuell? | `repoCommit` | Save |
|---|---|:---:|---|---|
| eiskunstlauf | `c93f0f3b49…` | **ja** | `e6461933…` | `new-game-1787123325719-swnjlk` |
| breaking | `c93f0f3b49…` | **ja** | `e6461933…` | dito |
| wettessen | `c93f0f3b49…` | **ja** | `e6461933…` | dito |
| tennis | `c93f0f3b49…` | **ja** | `e6461933…` | dito |
| fechten | `c93f0f3b49…` | **ja** | `e6461933…` | dito |

`sha1sum public/mockups/battle-mode.engine.js` im Worktree ergibt
`c93f0f3b491be6865d7f99e228123e713ab17df9` — **exakt** der in allen fuenf Dateien eingetragene
Hash. Die Referenzen sind also gegen **genau den Motor** gezogen, der mit ihnen ausgeliefert wird.
`repoCommit` ist `e6461933` = der Basis-Commit. Und der Save `new-game-1787123325719-swnjlk`
existiert im heute frisch gezogenen `live-save`-Abbild (`saves`-Tabelle, `updated_at`
2026-08-23) — es ist derselbe echte Liga-Kader, gegen den auch Welle 1 und Basketball gezogen
wurden. **Kein Demokader, kein synthetischer Kader.**

Nebenbefund, **nicht** dieser PR anzulasten: von den zehn Referenzen sind nach dieser PR **fuenf
aktuell und fuenf veraltet** (basketball, hockey, gewichtheben, showcase, speed-schach — alle
gegen aeltere Motor-Staende gezogen). `scripts/pruefe-pps-referenz-frische.ts` meldet das und
schlaegt fehl; der CI-Job dazu ist **absichtlich** `continue-on-error: true`, mit einer in
`.github/workflows/ci.yml` (Zeilen 292-305) ausfuehrlich begruendeten Entscheidung (der Hash deckt
die ganze 20.000-Zeilen-Datei ab, ein Pflicht-Check waere ab Tag eins dauerrot). Der Zustand
existierte **vor** dieser PR unveraendert; die PR **verbessert** ihn (vorher 0 von 5 aktuell,
jetzt 5 von 10). Kein Einwand.

### 5.2 Sind die Eintraege gesund?

Alle **25** Eintraege (5 Disziplinen x Feldgroessen 2..6) geprueft:
`iMittel > 0` **und** `iKrass > iMittel` — **25 von 25 erfuellt**, kein entarteter Eintrag. Genau
die Bedingung, die `ppsAusArenaImpact()` und `resolveArenaPpsReferenz()` selbst als
Gueltigkeitsschwelle benutzen. Jede Feldgroesse hat 64 Fixtures (= `ceil(60/16) * 16`, passend zur
`FIXTURES_ZIEL = 60`-Angabe im Kopf der Datei — die 60 ist das Ziel, die 64 das erreichte).

### 5.3 Determinismus — selbst nachgemessen

Das ist der Teil, den die PR-Beschreibung nicht antritt, und der die Referenzen von „hier sind
Zahlen" zu „hier sind nachvollziehbare Zahlen" macht. Ich habe gegen **das heute frisch gezogene**
`live-save`-Abbild (Spiegelfrische zuvor geprueft: `live-save` 0,0 h alt, `bug-reports` 0,2 h alt)
neu gezogen:

```
OLY_APP_SQLITE_PATH=…/abbild.sqlite npx tsx scripts/ziehe-buehne-pps-referenz.ts tennis --feldgroesse=6
OLY_APP_SQLITE_PATH=…/abbild.sqlite npx tsx scripts/ziehe-buehne-pps-referenz.ts eiskunstlauf --feldgroesse=2
```

| Lauf | Chassis | Dauer | Ergebnis |
|---|---|---|---|
| tennis n=6 | Duell | 517 s / 64 Fixtures | `iMittel 761`, `iKrass 1200,82`, **alle 11 Quantile identisch** |
| eiskunstlauf n=2 | Auftritt (mit `duett`) | 522 s / 64 Fixtures | `iMittel 929,5`, `iKrass 1221,95`, **alle 11 Quantile identisch** |

Beide Male ein **JSON-String-Vergleich Zeichen fuer Zeichen gegen die eingecheckte Datei:
`true`.** Beide Chassis abgedeckt, das `duett`-Sonderfall-Chassis eingeschlossen. Das Skript hat
in beiden Faellen von selbst denselben Save gewaehlt wie die Originalziehung.

Kleiner Hinweis fuers Protokoll: das Skript nimmt `repo.listSaves()[0]`, also schlicht den ersten
Save-Kopf. Reproduzierbar ist das nur, **weil** die `saveId` in der Ausgabe mitgeschrieben wird —
genau so, wie es sein soll. Es ist keine Schwaeche, aber wer spaeter neu zieht, sollte die
`quelle.saveId` gegenpruefen, statt anzunehmen, es sei „schon der richtige".

### 5.4 Landen die neuen Referenzen in einer sinnvollen PPs-Kurve?

Eine Pruefung, die im Auftrag nicht stand, die ich aber fuer den wichtigsten inhaltlichen Test
halte: eine formal gueltige Referenz kann trotzdem eine unbrauchbare Punktverteilung erzeugen. Ich
habe deshalb die echten Quantile jeder Referenz durch die **echte Produktionsfunktion**
`ppsAusArenaImpact()` geschickt:

| Disziplin | n | PPs bei p5 / p25 / p50 / p75 / p95 / p99,5 |
|---|---:|---|
| basketball *(Alt)* | 6 | 0,21 / 0,76 / 1,38 / 2,18 / 3,66 / 5,50 |
| gewichtheben *(Alt)* | 6 | 0,37 / 0,82 / 1,38 / 2,34 / 3,95 / 5,50 |
| hockey *(Alt)* | 6 | 0,26 / 0,78 / 1,38 / 2,19 / 3,56 / 5,50 |
| speed-schach *(Alt)* | 6 | 0,42 / 0,87 / 1,38 / 2,22 / 4,03 / 5,50 |
| showcase *(Alt)* | 6 | 0,34 / 0,81 / 1,37 / 2,27 / 4,11 / 5,50 |
| **eiskunstlauf** | 6 | 0,27 / 0,71 / 1,38 / 2,34 / 4,08 / 5,50 |
| **breaking** | 6 | 0,38 / 0,78 / 1,37 / 2,24 / 3,49 / 5,50 |
| **wettessen** | 6 | 0,47 / 0,90 / 1,38 / 2,09 / 3,63 / 5,50 |
| **tennis** | 6 | 0,28 / 0,75 / 1,38 / 2,39 / 4,42 / 5,50 |
| **fechten** | 6 | 0,42 / 0,88 / 1,38 / 2,17 / 3,93 / 5,50 |

Der Median landet ueberall bei 1,38 PPs (= `0,25 x 5,5`) und das 99,5.-Perzentil bei 5,50 — das ist
**per Konstruktion** so, die Kurve geht durch genau diese zwei Anker. Interessant ist der Bereich
**dazwischen**, und dort liegen die fuenf Neuen mitten im Feld der fuenf Alten (p95 zwischen 3,49
und 4,42; die Alten zwischen 3,56 und 4,11). **Kein Ausreisser, kein „alle bekommen das Maximum",
kein „alle bekommen null".** Dieselbe Rechnung bei n=3 ergibt dasselbe Bild.

Das ist der praktische Gegenbeweis zum Fail-Fast-Szenario aus Abschnitt 4.3: haette eine der fuenf
still auf Basketballs Referenz zurueckgegriffen, stuende in ihrer Zeile ueberall 5,50.

---

## 6. Punkte 5-9 — die Werkzeugpruefungen im Detail

### 6.1 Testsuite (`npx vitest run`, PR-Kopf)

```
Test Files  1027 passed | 2 skipped (1029)
     Tests  8132 passed | 23 skipped (8155)
  Duration  1243.92 s
```

**Exakt die behaupteten 1027 / 8132.** Beide geaenderten Wachhund-Dateien zusaetzlich einzeln
gefahren:

- `battle-mode-arena-resolve-engine.test.ts` + `battle-mode-arena-team-points.test.ts`:
  **83 Tests gruen**.
- `battle-mode-arena-matchday-resolve-e2e.test.ts` mit `--reporter=verbose`: **3 von 3 gruen**, und
  zwar **wirklich gelaufen**, nicht ueber `describe.skipIf(!CHROMIUM_VERFUEGBAR)` weggeschaltet —
  der echte Arena-Lauf brauchte 7,4 s bzw. 3,7 s. Das war mir wichtig, weil ein stillschweigend
  uebersprungener E2E-Test die Aussage „die Gegenprobe funktioniert" wertlos machen wuerde.

### 6.2 Die Mutationsprobe — ist der Test-Fund echt?

Die PR behauptet, zwei Tests haetten Fechten als „garantiert nicht arena-aufgeloeste"
Kontrolldisziplin benutzt und waeren durch diese Welle still entwertet worden. Das ist eine
Behauptung ueber einen Zustand, den es nach der Reparatur nicht mehr gibt — also habe ich ihn
wiederhergestellt: `D2_KONTROLL_DISZIPLIN` probeweise zurueck auf `"fechten"` gesetzt und die Datei
laufen lassen.

```
× ist NICHT arena-aufgeloest -- sonst pruefen die Gegenproben unten nichts mehr
    AssertionError: expected true to be false
× wendet das 2/1/0-Modell fuer Basketball in einem Battle-Mode-Save an, NICHT die Rang-Formel
    AssertionError: expected 'arena' to be 'pps'
× Die D2-Kontrolldisziplin bleibt byte-identisch, …
    AssertionError: expected { disciplineId: 'fechten', …(5) } to deeply equal { … }
Tests  3 failed | 6 passed (9)
```

**Drei rote Tests, und der Wachhund meldet sich als erster** — mit einer Zeile, die die Ursache
benennt, statt mit dem Zahlendiff („`expected 'arena' to be 'pps'`"), an dem man ohne den Wachhund
haengengeblieben waere. Der Fund war real, und die Reparatur ist strukturell richtig geloest:
nicht durch stilles Austauschen des Literals, sondern durch **eine benannte Konstante plus einen
Test, der die Annahme selbst prueft**. Genau die Bauart, die den naechsten Wellen-PR sofort
aufklaert. Anschliessend sauber zurueckgesetzt (`git checkout --`).

### 6.3 Rangtreue, alle 20 Disziplinen, **beide** Baeume

Zweimal voll gefahren (je ~9 Minuten), einmal auf dem PR-Kopf, einmal im unberuehrten
`origin/main`-Worktree. Die beiden Tabellen sind **Zeile fuer Zeile identisch**:

| Disziplin | Basislinie | PR-Kopf | `origin/main` | Diff PR↔main |
|---|---:|---:|---:|:---:|
| tdm | 0,253 | 0,253 | 0,253 | **0,000** |
| mini-dm | 0,094 | 0,094 | 0,094 | **0,000** |
| battlefield | 0,387 | 0,387 | 0,387 | **0,000** |
| spurt | 0,871 | 0,871 | 0,871 | **0,000** |
| time-trial | 0,828 | 0,828 | 0,828 | **0,000** |
| climbing | 0,790 | 0,790 | 0,790 | **0,000** |
| staffel | 0,915 | 0,915 | 0,915 | **0,000** |
| takeshis-castle | 0,861 | 0,861 | 0,861 | **0,000** |
| gewichtheben | 0,847 | **0,854** | **0,854** | **0,000** |
| showcase | 0,892 | 0,892 | 0,892 | **0,000** |
| **eiskunstlauf** | 0,875 | **0,885** | **0,885** | **0,000** |
| **breaking** | 0,869 | 0,869 | 0,869 | **0,000** |
| **wettessen** | 0,845 | 0,845 | 0,845 | **0,000** |
| speed-schach | 0,908 | 0,908 | 0,908 | **0,000** |
| *i-spy* | 0,684 | **0,684** | 0,684 | **0,000** |
| **tennis** | 0,825 | 0,825 | 0,825 | **0,000** |
| **fechten** | 0,816 | 0,816 | 0,816 | **0,000** |
| basketball | 0,769 | 0,769 | 0,769 | **0,000** |
| football | 0,516 | 0,516 | 0,516 | **0,000** |
| hockey | 0,669 | 0,669 | 0,669 | **0,000** |

Beide Laeufe: „Bestanden: keine Disziplin ist um mehr als ihre Schranke gefallen."

**Zu den zwei Abweichungen gegen die Basislinie** (gewichtheben +0,007, eiskunstlauf +0,010): Sie
reproduzieren sich **identisch auf unberuehrtem `main`**, sind also nachweislich **nicht** von
diesem PR verursacht — die eingecheckte Basislinie vom 06.09. ist fuer diese beiden schlicht alt
(Eiskunstlaufs Rundenzahl wurde am 07.09. verdoppelt). Beide Bewegungen gehen **nach oben**,
weshalb die nur Rueckgaenge fangende CI-Schranke sie nie gemeldet hat. Die PR beschreibt genau das
in ihrem Abschnitt „Nebenfund, bewusst nicht mitrepariert" — und **die Entscheidung, es nicht
mitzureparieren, ist richtig**: eine Neuziehung der Basislinie im selben PR haette die
Beweisfuehrung „alle zwanzig Zeilen ±0,000" unlesbar gemacht. Das gehoert in einen eigenen PR.

**Ein Befund am Rande, der nicht diesem PR gehoert, aber notiert werden sollte:** Basketball steht
bei **0,769** und Hockey bei **0,669** — beide **unter** der 0,80-Schranke aus CLAUDE.md, und beide
sind bereits arena-aufgeloest (seit Welle 0/1). Die Achse-1-Argumentation dieses PRs wird also nur
auf **neue** Eintraege angewandt, nicht rueckwirkend auf die bestehenden. Das ist konsistent mit
der Historie (sie wurden angeschlossen, bevor die Schranke als Aufnahmekriterium galt) und ist
**kein Einwand gegen diesen PR** — aber es heisst, dass „arena-aufgeloest" nach diesem Merge nicht
gleichbedeutend mit „besteht die Schranke" ist. Wer die Liste spaeter als Qualitaetssiegel liest,
irrt sich. Fuer die Projektaufsicht: Hockey und Basketball ueber 0,80 zu heben, ist die
sinnvollste naechste Rangtreue-Arbeit nach dieser Welle.

### 6.4 Slot-Invariante

```
Maximale Abweichung ueber alle 20 Disziplinen x 6 Groessen: 0.005 Pp (mini-dm @ n=2, stamina)
Invariante haelt: alle Werte <= 0.2 Pp.
```

Wie behauptet. Alle fuenf betroffenen Disziplinen (eiskunstlauf, breaking, wettessen, tennis,
fechten) liegen bei 0,000-0,003 Pp.

### 6.5 I-Spy — war der Ausschluss richtig?

**Ja, eindeutig.** Frisch gemessen: **rho = 0,684**, gegen eine Schranke von 0,80. Das ist keine
Grenzentscheidung, sondern **0,116 darunter** — I-Spy ist die schlechteste der vier
Duell-Buehnen mit deutlichem Abstand (speed-schach 0,908, tennis 0,825, fechten 0,816).

Technisch waere der Eintrag der billigste von allen gewesen: I-Spy traegt `duell:true` wie
Speed-Schach, Tennis und Fechten, das Chassis existiert, es haette **eine Zeile** gebraucht. Genau
das macht den Nicht-Eintrag zum wertvollsten Teil dieses PRs: **die Achse „Rangtreue bestanden"
darf nicht davon abhaengen, wie billig die Achse „Chassis existiert" zu erfuellen ist.** Dass ein
eigener Regressionstest das festhaelt — und im Kommentar sagt, was zu tun ist, falls I-Spy spaeter
ueber 0,80 gehoben wird („faellt dieser Test absichtlich rot und ist DANN mit der neuen Zahl zu
aktualisieren") — ist genau die richtige Bauart.

Ich habe die Auswahl auch in die Gegenrichtung geprueft: gibt es eine Disziplin, die die Schranke
besteht, ein Chassis haette und **trotzdem** fehlt? Nein. Die uebrigen Bestandenen (staffel 0,915,
spurt 0,871, takeshis-castle 0,861, time-trial 0,828) sind ausnahmslos **Bahn**-Disziplinen, und
`spieleBahn*()` existiert im Motor nicht — fuer sie waere es ein Bauauftrag, keine Konfiguration.
Die Auswahl der fuenf ist damit **vollstaendig und minimal**: genau die Schnittmenge, nicht mehr
und nicht weniger.

### 6.6 TypeScript

| | PR-Kopf | `origin/main` |
|---|---:|---:|
| `npx tsc --noEmit`, Zahl der `error TS` | **560** | **560** |

Und: **kein einziger** der 560 Fehler nennt eine der sechs geaenderten Dateien (gefiltert ueber
alle sechs Dateinamen — leeres Ergebnis). Die 560 sind vorbestehende Altlast, unveraendert
weitergereicht.

### 6.7 ESLint

Auf allen sechs geaenderten Dateien: **0 Fehler, 2 Warnungen**, beide in
`tests/battle-mode-arena-team-points.test.ts:1094` (`'_disziplin'`/`'_options'` ungenutzt) —
vorbestehend, nur durch die neuen Zeilen verschoben. Wie behauptet.

### 6.8 GitHub-CI

Alle vier Checks auf `bbe368b2` **gruen**: `test-and-smoke`, `full-test-suite`,
`persistenz-suiten`, `pps-referenz-frische`. `mergeable_state: clean`.

---

## 7. Risiko im Betrieb — wie viel kann hier schiefgehen?

Diese Frage ist bei einer Aenderung an `ARENA_RESOLVED_DISCIPLINE_IDS` die eigentliche
Review-Frage, und ich habe sie unabhaengig beantwortet statt sie aus der PR zu uebernehmen.

Ich habe alle sieben Saves im heutigen `live-save`-Abbild aufgemacht und
`scenarioMeta.gameMode` gelesen:

| Save | `gameMode` |
|---|---|
| new-game-1784747079649-n90y4m | *(nicht gesetzt)* |
| new-game-1785412846578-h0z7cl | *(nicht gesetzt)* |
| new-game-1785823388048-1hf25q | *(nicht gesetzt)* |
| new-game-1786465783606-0kalpx | *(nicht gesetzt)* |
| new-game-1786626914058-hwz8fk | *(nicht gesetzt)* |
| save-1786699040510-89rv3s | *(nicht gesetzt)* |
| new-game-1787123325719-swnjlk | *(nicht gesetzt)* |

`resolveGameMode()` uebersetzt „nicht gesetzt" nach `"manager"` — **kein einziger Save auf dem
Server ist ein Battle-Mode-Save.** Und `legacy-matchday-resolve-engine.ts` greift den Arena-Pfad
nur unter `isBattleModeArenaEligible && ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId)` ab, wobei
die erste Bedingung `isBattleModeSave()` enthaelt.

**Folge: Diese Aenderung kann an Chris' laufendem Spiel heute nichts verstellen.** Der Nutzen ist
real, aber latent — er wird erst sichtbar, wenn ein neuer Save mit Battle-Mode-Wahl angelegt wird.
Die PR sagt das unter „Nicht verifiziert" selbst; ich bestaetige es aus den Daten. Das ist der
Grund, warum ich bei einer Aenderung an der zentralen Live-Liste trotzdem ohne Zoegern zur Freigabe
komme.

Bleibt das Risiko fuer **kuenftige** Battle-Mode-Saves. Dort gilt: die Punktvergabe der fuenf neuen
laeuft ueber genau dieselben Funktionen wie die der fuenf alten (`ppsAusArenaImpact()`,
`computeIndividualBoxscorePpsFromFixtureResults()` — beide unveraendert), gegen frisch gezogene,
massstabsrichtige Referenzen (Abschnitt 5.4), abgesichert durch zwei Fail-Fasts beim Modul-Laden
und vier Querpruef-Tests. Das ist so gut abgesichert, wie es diese Architektur hergibt.

---

## 8. Der Nachtrag — drei Kleinigkeiten, kein Blocker

Nichts davon beruehrt Verhalten, Testausgang oder eine Zahl. **Alle drei gehoeren in einen eigenen,
winzigen Folge-PR, nicht in diesen** — der Beweiswert von „nur Konfiguration" haengt daran, dass
dieser Diff klein bleibt.

**N1 — Formatierungsrest im Kommentarkopf** (`tests/battle-mode-arena-resolve-engine.test.ts`,
Zeilen 19-20). Beim Einfuegen des neuen Kommentarblocks ist der Abschluss des alten
zerfasert: eine Leerzeile mitten im Block, dann `*/` ohne Einrueckung am Zeilenanfang. Syntaktisch
einwandfrei (eslint sagt nichts), optisch ein Fremdkoerper zwischen zwei sonst sehr sorgfaeltigen
Bloecken.

```js
 * bisherigen PPS-Pfad, selbst wenn die Map gesetzt ist.
                                    <- Leerzeile ohne `*`
*/                                  <- ohne fuehrendes Leerzeichen
```

Zu machen: die Leerzeile entfernen und `*/` auf ` */` einruecken.

**N2 — Kopfkommentar derselben Datei ist inhaltlich ueberholt** (Zeilen 15-18, vorbestehend seit
Welle 1). Er sagt: *„eine mitgelieferte Arena-Punkte-Map darf NUR fuer
`disciplineId === "basketball"` … greifen — jede andere Kombination (…, jede andere Disziplin, …)
bleibt exakt beim bisherigen PPS-Pfad"*. Das war zur Entstehungszeit richtig, ist seit Welle 1
falsch und wird durch diese PR von „eine" auf „zehn" Disziplinen weiter von der Wahrheit
entfernt. Da diese PR die Datei ohnehin anfasst und die daneben stehende Kontrolldisziplin
mustergueltig dokumentiert, faellt der Widerspruch beim Lesen jetzt staerker auf als vorher.

Zu machen: „NUR fuer `disciplineId === "basketball"`" ersetzen durch „nur fuer Disziplinen in
`ARENA_RESOLVED_DISCIPLINE_IDS`".

**N3 — dieselbe Altlast im Produktionscode** (`lib/resolve/legacy-matchday-resolve-engine.ts`,
Zeile 714, vorbestehend): *„`ARENA_RESOLVED_DISCIPLINE_IDS` — aktuell Basketball und
Gewichtheben"*. Nach diesem Merge sind es zehn. Der Code selbst ist richtig (Mengen-Zugehoerigkeit,
kein Literal), nur die Klammer luegt. Am saubersten waere, die Aufzaehlung **ersatzlos zu
streichen** statt sie auf zehn zu aktualisieren — dann kann sie bei Welle 3 nicht wieder veralten.

---

## 9. Was ich **nicht** verifizieren konnte — ehrlich benannt

1. **Keine Sicht-QA.** Ich habe kein Spiel gestartet und keinen Spieltag in der laufenden App
   aufgeloest. Die Aenderung beruehrt argumentativ keine Darstellung (nur den Resolve-Pfad und
   Referenzdaten), aber das ist **argumentiert, nicht gesehen** — dieselbe Einschraenkung, die die
   PR selbst nennt. Da kein Save Battle Mode benutzt (Abschnitt 7), gaebe es zurzeit auch nichts
   zu sehen.

2. **Determinismus nur an 2 von 25 Zellen nachgezogen.** Tennis n=6 und Eiskunstlauf n=2, je 64
   Fixtures, zusammen ~17 Minuten Rechenzeit. Alle 25 nachzuziehen waere ein Lauf von rund vier
   Stunden gewesen. Die zwei sind so gewaehlt, dass **beide Chassis** und der `duett`-Sonderfall
   abgedeckt sind; die uebrigen 23 folgen demselben Codepfad mit anderen Saat-Praefixen. Ich halte
   die Stichprobe fuer aussagekraeftig, aber sie ist eine Stichprobe.

3. **Die Rangtreue-Basislinie selbst habe ich nicht neu gezogen.** Ich habe gegen die eingecheckte
   `rangtreue-basislinie.json` gemessen — auf beiden Baeumen dieselbe Datei, der Vergleich PR↔main
   ist davon unabhaengig. Ob die Basislinie fuer gewichtheben/eiskunstlauf **den richtigen** neuen
   Wert haette, sagt meine Messung nicht (sie sagt nur: derselbe auf beiden Seiten).

4. **Kein Zugriff auf den Server.** Wie in CLAUDE.md beschrieben, nur ueber die GitHub-Spiegel.
   Beide waren frisch (`live-save` 0,0 h, `bug-reports` 0,2 h) — die Save-Aussagen in Abschnitt 7
   ruhen also auf einem aktuellen Abbild, nicht auf einem alten.

5. **Nebenbeobachtung ausserhalb dieses PRs:** ein voller `vitest run` **veraendert die
   versionierte Datei `data/generated/oly-player-stats.json`** (ein `portraitUrl`-Feld springt von
   `/api/media/player-portrait/…` auf `/portraits/….jpg`). Vorbestehend, reproduzierbar, hat mit
   diesem PR nichts zu tun — aber eine Testsuite, die in einen eingecheckten Datenstand schreibt,
   ist eine Falle fuer jeden kuenftigen Reviewer, der danach `git status` liest. Eigenes Ticket
   wert.

---

## 10. Fazit

Diese PR macht genau das, was sie sagt, und sie sagt es nachpruefbar. Der Motor ist bitgleich, die
Chassis-Zuordnung stimmt fuer alle fuenf, die fuenf Katalogfeldgroessen sind einzeln richtig (und
keine ist die naheliegende 6), die Referenzen sind frisch, gesund, gegen den echten Liga-Kader
gezogen und **bitgenau reproduzierbar**, die Rangtreue aller zwanzig Disziplinen steht auf beiden
Baeumen auf derselben Zahl, und die Testsuite ist gruen — 1027/8132, exakt wie behauptet.

Zwei Dinge heben die Arbeit ueber „korrekt" hinaus. Der **I-Spy-Nichteintrag** haelt eine
Projektregel gegen die Bequemlichkeit — eine Zeile Aufwand, 0,116 rho Abstand zur Schranke, und die
Entscheidung faellt fuer die Schranke. Und der **Test-Fund** ist nicht still weggebuegelt, sondern
strukturell geloest: benannte Konstante plus Wachhund, der die Annahme selbst prueft. Ich habe
nachgewiesen, dass beide Wachhunde tatsaechlich beissen (drei rote Tests bei der Mutationsprobe).
Das ist die Bauart, die Welle 3 zwanzig Minuten Suchen erspart.

Der Nachtrag sind drei Kommentarzeilen, zwei davon aelter als dieser PR.

### **FREIGEBEN MIT NACHTRAG** — mergen wie er ist; N1-N3 in einen eigenen Folge-PR.

---

*Unabhaengige Zweitpruefung, Opus-Overseer, 09.09.2026. Alle Mess- und Testlaeufe selbst gefahren:
2x `pruefe-rangtreue-schranke.mjs` (voll, 20 Disziplinen), 1x `vitest run` (voll) plus 3
Einzeldateien, 1x Mutationsprobe, 2x `tsc --noEmit`, 1x `pruefe-slot-invariante.ts`, 1x `eslint`,
1x `pruefe-pps-referenz-frische.ts`, 1x `pruefe-spiegel-frische.ts`, 2x
`ziehe-buehne-pps-referenz.ts` (Determinismus), 1x PPs-Kurvenrechnung ueber alle zehn Disziplinen,
1x Save-Inspektion des `live-save`-Abbilds.*
