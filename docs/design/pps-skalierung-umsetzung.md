# PPs-Skalierung, umgesetzt: die Impact-Kurve statt des Spieltags-Perzentils

Branch `claude/pps-skalierung-umsetzung`, abgezweigt von `origin/main`. Setzt
`docs/design/pps-skalierung-opus.md` (Opus-Konsultation, Branch `claude/pps-skalierung-opus`,
noch nicht gemergt) um — **Umsetzung, keine neue Modellrecherche**. Der Auftrag, kurz wiederholt:
Chris' Beschwerde am gerade gebauten Perzentil-Modell (`docs/design/boxscore-an-pps.md`), wörtlich
„es soll nicht in jedem team duell immer ein spieler volle punktzahl bekommen", war von Opus bereits
gemessen und mit einer konkreten Lösung beantwortet — dieses Dokument berichtet, was davon gebaut
wurde, mit welchen Zahlen, und wie/wann nachgezogen werden muss.

---

## 0. Kurzfassung

1. **Das Perzentil-Modell ist ersetzt, nicht nur getuned.** `computeIndividualBoxscorePpsFromFixtureResults()`
   (`lib/resolve/battle-mode-arena-team-points.ts`) vergleicht den rohen Boxscore-Impact eines
   Spielers jetzt gegen eine **feste, einmalig gezogene Referenzverteilung**, nicht mehr gegen den
   Pool des aktuellen Spieltags. `percentileOf()` ist ersatzlos entfernt.
2. **Die Kurve**: `PPs = MAX · min(1, (max(0, I) / I_krass)^γ)`, mit
   `γ = ln(a_mitte) / ln(I_mittel / I_krass)`. `I_mittel`/`I_krass` kommen — **je Feldgröße
   getrennt** — aus `data/generated/basketball-pps-referenz.json`.
3. **Zwei benannte, kommentierte Konstanten, keine tief vergrabene Zahl**: `BASKETBALL_INDIVIDUAL_PPS_MAX
   = 5,5` (vorher 6,6; Mitte von Chris' Rahmen „5-6") und `BASKETBALL_PPS_ANTEIL_MITTE = 0,25`.
   Letztere war die einzige offene Zahl dieser Runde und ist seit dem 04.09. **an echten Duellen
   gemessen entschieden**, nicht mehr Geschmackssache — s. Abschnitt 9.
4. **Die Referenz ist produktionsnah gezogen**, nicht aus dem kleinen Mockup-Demokader: über
   `scripts/ziehe-basketball-pps-referenz.ts` gegen echte Liga-Kader aus dem `live-save`-Abbild,
   `[FIXTURES]` Fixtures je Feldgröße, über `runArenaFixtures()` — derselbe Weg, den der echte
   Matchday-Resolve nimmt.
5. **Ein Drift-Wächter** (`tests/basketball-pps-referenz-drift.test.ts`) schlägt fehl, wenn sich der
   rohe Boxscore-Impact seit dem letzten Ziehen um mehr als 25 % verschoben hat — genau die Art
   Drift, die den alten Plan-Zahlen unbemerkt einen Faktor 2,5 einbrachte (Opus-Dokument
   Abschnitt 1.3).
6. **`npm test` bleibt vollständig grün**, s. Abschnitt 5.

---

## 1. Warum ein Perzentil-Modell die Beschwerde nicht beheben konnte

Ein Perzentilrang gegen den Pool desselben Spieltags hat eine strukturelle Eigenschaft, die keine
Parametrisierung wegbekommt: der Duellbeste liegt praktisch immer im obersten Zehntel jeder
Verteilung, die überwiegend aus Nicht-Duellbesten besteht — unabhängig davon, ob sein Rohwert für
die Disziplin gut oder mittelmäßig ist. Gemessen im Opus-Dokument: ein Impact von 33,5 (schwacher
Spieltag) und einer von 67,4 (starker Spieltag, das Doppelte) bekamen beide ~6,5 von 6,6 möglichen
Punkten. Ein größerer Pool behebt das nicht — er ändert nur, *wie viele* im Pool schwächer waren,
nicht *ob* 41,4 für diese Disziplin viel oder wenig ist.

Was fehlte, war kein größerer Pool, sondern ein **absoluter Maßstab**: eine feste Referenz, gegen
die ein Rohwert unabhängig vom Rest des Spieltags eingeordnet wird.

---

## 2. Die Impact-Kurve

### 2.1 Formel

```
Eingang:   I       roher Boxscore-Impact des Spielers (ArenaFixtureBoxscoreEintrag.wert)
           n       Feldgroesse dieses Spieltags (Spieler je Seite, 2..6)

Referenz:  I_mittel(n)   Median der Referenzverteilung fuer Feldgroesse n
           I_krass(n)    99,5-Perzentil der Referenzverteilung fuer Feldgroesse n

Regler:    MAX      = 5,5      Hoechstpunktzahl je Disziplin
           a_mitte  = 0,25     Anteil des Maximums fuer einen mittelmaessigen Auftritt

Ableitung: gamma(n) = ln(a_mitte) / ln( I_mittel(n) / I_krass(n) )

Ergebnis:  PPs = MAX * min(1, ( max(0, I) / I_krass(n) )^gamma(n) )
```

Implementiert als `ppsAusBasketballImpact()` in `lib/resolve/battle-mode-arena-team-points.ts`,
mit der Referenz-Auflösung `resolveBasketballPpsReferenz()` daneben.

### 2.2 Warum diese Form (kurz — die volle Herleitung steht im Opus-Dokument Abschnitt 4)

- **Zwei benannte Anker statt drei frei getunter Zahlen.** Die Kurve geht per Konstruktion durch
  (`I_mittel` → 25 % von MAX) und (`I_krass` → MAX). Beide Anker sind gemessene Eigenschaften der
  Disziplin, keine Erfindungen.
- **Deckel statt Asymptote.** `min(1, …)` heißt: wer `I_krass` erreicht, bekommt die volle
  Punktzahl — Chris' „max 5-6" wörtlich genommen, nicht nur angenähert.
- **Boden bei 0.** `max(0, I)` — ein negativer Impact (real gemessen) gibt 0 PPs, nie negative.
  Dieselbe Bodenregel wie `distributeByValues()` in `lib/resolve/rank-to-points.ts`.
- **Je Feldgröße getrennt**, weil der Rohwert massiv mit der Feldgröße skaliert (Median-Impact 2v2
  ≈ 33,5, 6v6 ≈ 11,1 im Opus-Dokument, produktionsnah gezogen s. Abschnitt 4 unten) — eine
  gemeinsame Kurve würde Chris' Problem bei kleiner Besetzung über einen anderen Mechanismus
  reproduzieren.

---

## 3. Beispielrechnungen

Alle Zahlen unten sind mit der echten, gezogenen Referenz gerechnet (`data/generated/basketball-pps-referenz.json`, Abschnitt 4). Die V1-Perzentil-Spalte ist mit dem Code entfernt (`percentileOf()` gibt es nicht mehr) und deshalb nur an den zwei Punkten belegbar, die das Opus-Dokument selbst gemessen hat (Abschnitt 1 oben) — für beliebige andere Quantile lässt sie sich nicht mehr nachrechnen, ohne das alte Modell wieder einzubauen.

### 3.1 Schwacher, starker und krasser Spieltag (playerCount 6)

| Impact | Referenz-Perzentil (playerCount 6) | PPs neu |
|---|---:|---:|
| 4,47 (`I_gering`) | p10 | 0,34 |
| 15,4 (`I_mittel` = iMittel, „mittelmäßig") | p50 | `MAX·0,25` = 1,38 |
| 31,53 (`I_stark`) | p90 | 3,08 |
| 52,65 (`I_krass` = iKrass, „krass") | p99,5 | `MAX` = 5,50 |

### 3.2 Dieselbe Rohleistung, unterschiedliche Feldgröße

| Impact | PPs bei playerCount 2 | PPs bei playerCount 4 | PPs bei playerCount 6 |
|---|---:|---:|---:|
| 20 | 0,18 | 1,01 | 1,85 |

Derselbe Rohwert 20 ist bei playerCount 2 (iMittel 52,5 — sechs Spieler teilen sich sonst dieselbe
Eignungssumme unter mehr Konkurrenz um den Ball) fast nichts wert, bei playerCount 6 (iMittel 15,4)
schon über dem Mittelmaß — genau die Feldgrößen-Trennung, die Abschnitt 2.2 begründet.

### 3.3 Der Kernnachweis: unabhängig vom Rest des Spieltags

Zwei Duelle, derselbe Spieler mit demselben Rohwert (33,5) — einmal an einem schwachen Spieltag
(Gegner liefert nur 1), einmal an einem starken (Gegner liefert 67,4):

| Spieltag | Spieler-Impact | Gegner-Impact | PPs V1 (Perzentil, Opus-Messung) | PPs V2 (Kurve, playerCount 6) |
|---|---:|---:|---:|---:|
| schwach | 33,5 | 1,0 | ~6,5 (von 6,6) | 3,30 |
| stark | 33,5 | 67,4 | ~6,5 (von 6,6) | 3,30 |

Unter V2 bekommt derselbe Spieler in beiden Fällen **dieselbe** PPs-Zahl — das ist der Punkt. (Die
V1-Zahlen sind aus dem Opus-Dokument übernommen, nicht neu gemessen — das Modell existiert im Code
nicht mehr.)

---

## 4. Die Referenz: wie sie gezogen wurde

`scripts/ziehe-basketball-pps-referenz.ts`, gegen das `live-save`-Abbild (CLAUDE.md, „An die
Spielstände kommen"):

| | |
|---|---|
| Quell-Save | `new-game-1787123325719-swnjlk` (Oly New Game Custom 19.8.2026, 09:08:45) |
| Mechanismus | `buildArenaTeam()` (echte Liga-Kader) + `runArenaFixtures()` (echter Matchday-Resolve-Pfad) |
| Fixtures je Feldgröße | 304 (Ziel: ≥ 300) |
| Paarungen | 19 Runden aus je 16 durchgemischten Paarungen, 32 Teams |
| Motor-SHA1 | `01cb2ce543c150d56261e899f1155491f0af7a62` |
| Repo-Commit | `d4430b81794fca6120711abccc8ee158336476e6` |
| Gezogen am | 2026-09-03T20:11:00.178Z |

Gezogen in fünf parallelen Prozessen (`--feldgroesse=<n>` je Feldgröße, danach `--merge`) statt
einem sequenziellen Lauf — dabei ein reales Speicherproblem gefunden und behoben: `runArenaFixtures()`
startet nur EINEN Browser für den ganzen übergebenen Fixture-Batch, und dessen Speicherverbrauch
wuchs über viele sequenzielle Motor-Neueinhängungen unbegrenzt (2,7+ GB nach rund 150 Fixtures in
einem Prozess). Mit fünf parallelen Prozessen drückte das den Host unter 1 GB freien Speicher und
der Memory-Cgroup-OOM-Killer beendete die Läufe, bevor ein einziger Teil-Stand geschrieben war.
Behoben durch Batching: `zieheFeldgroesse()` ruft `runArenaFixtures()` jetzt in Gruppen von 20
Fixtures auf (Kosten: ein paar zusätzliche Browser-Starts, Sekunden statt Minuten), wodurch der
Speicher pro Prozess klein und stabil bleibt.

### 4.1 Referenzwerte je Feldgröße

| playerCount | iMittel (Median) | iKrass (p99,5) | Spielerwerte |
|---:|---:|---:|---:|
| 2 | 52,5 | 101,01 | 1216 |
| 3 | 34,0 | 77,22 | 1824 |
| 4 | 24,9 | 65,68 | 2432 |
| 5 | 19,1 | 54,5 | 3040 |
| 6 | 15,4 | 52,65 | 3648 |

Deutlich höher als die Übergangs-Platzhalterwerte aus dem Opus-Dokument (dort aus dem schmalen
Mockup-Demokader geschätzt, z. B. n=6 iMittel 11,1 gegen jetzt 15,4) — erwartet, s. Abschnitt 2.2:
genau der Unterschied zwischen Demokader-Eignungsspanne (~20-70) und einem echten Liga-Feld, den
diese Runde beheben sollte.

---

## 5. Tests

- `tests/battle-mode-arena-team-points.test.ts` — komplett auf die Kurve umgeschrieben:
  - `ppsAusBasketballImpact()` gegen eine handgebaute Referenz (unabhängig von der echten
    Ziehung, bleibt bei einem Neuziehen gültig): Boden bei 0, trifft beide Anker exakt, Deckel
    oberhalb `iKrass`, streng monoton, entartete Referenz → 0 statt NaN.
  - `resolveBasketballPpsReferenz()`: bekannte Feldgrößen exakt, Fallback auf die nächstgelegene
    bei `null`/zu klein/zu groß.
  - `computeIndividualBoxscorePpsFromFixtureResults()`: der Kern-Regressionstest gegen Chris'
    Beschwerde — derselbe Rohwert ergibt unabhängig vom Rest des Spieltags dieselben PPs; ein
    schwacher Spieltag vergibt nirgends die volle Punktzahl; ein krasser Ausreißer erreicht sie;
    verschiedene Feldgrößen bewerten denselben Rohwert unterschiedlich.
  - `runBattleModeArenaMatchday`: liga2-Spieler bekommen dieselben PPs, ob liga1 desselben
    Spieltags mitlief oder nicht.
- `tests/basketball-pps-referenz-drift.test.ts` — **neu**, der Wächter aus dem Opus-Dokument
  Abschnitt 8.3: vergleicht den Median-Impact von 24 Demokader-Spielen mit einem beim Ziehen
  eingefrorenen Demokader-Vergleichswert (nicht mit dem produktiven `iMittel` — die Populationen
  liegen systematisch auseinander, s. Kommentar dort). Weicht er um mehr als 25 % ab, muss die
  Referenz neu gezogen werden. **Beim ersten echten Ziehen selbst gefunden:** sowohl der
  Demokader-Median-Schritt in `scripts/ziehe-basketball-pps-referenz.ts` als auch dieser Test
  griffen auf `spiel.teilnehmer` zu — `feldspielProbe()` liefert das Feld aber unter `spiel.spieler`
  (jeder Eintrag trägt `wert`, s. `battle-mode.engine.js` ~16046). Beide Stellen krachten deshalb
  beim ersten produktiven Lauf mit einem `TypeError`, unabhängig von den Fixture-Ergebnissen selbst
  — kein Modellfehler, ein Feldname, der beim Schreiben nie gegen die echte Motor-Antwort geprüft
  wurde. Behoben an beiden Stellen.
- `npm test`: alle Suiten grün (s. Log dieser Runde).

---

## 6. Wann neu ziehen

Bei jeder Änderung, die den rohen Boxscore-Impact verschiebt:

- `feldspielWert()` (Gewichte, neue Posten),
- `SPIELDAUER_BASKETBALL`/`VIERTEL_*` (die Ursache der 2,5-fachen Drift zwischen dem 31.08. und
  dem 03.09., s. Opus-Dokument Abschnitt 1.3),
- das Basketball-Rezept, die Sub-Skill-Zuordnung, `BASKETBALL_POS_MOD`, die Slot-Aufschläge,
- größere Änderungen an der Kadergenerierung oder am Attributniveau der Liga.

Der Drift-Wächter (Abschnitt 5) fängt das ab, ohne dass jemand von Hand nachmisst — er schlägt
fehl, sagt aber nicht automatisch die richtige neue Zahl; dafür:

```sh
git fetch origin live-save
git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > /tmp/abbild.gz
gunzip -c /tmp/abbild.gz > /tmp/abbild.sqlite
OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-basketball-pps-referenz.ts
```

Ein voller Lauf (alle fünf Feldgrößen nacheinander) dauert bei 300+ Fixtures je Feldgröße gut zwei
Stunden. Parallelisierbar über `--feldgroesse=<n>` (fünf Prozesse) + `--merge` — dann etwa ein
Fünftel der Zeit.

---

## 7. Was bewusst unverändert blieb

- **Jede andere Disziplin/jeder andere Modus**: dieselbe Sperre wie beim letzten Mal,
  `isBattleModeSave(gameState) && disciplineId === "basketball"`.
- **Die Unterzahl-Nebenwirkung** (Opus-Dokument Abschnitt 7.1): tritt eine Seite in Unterzahl an
  (z. B. 3v6), bekommt die Überzahl-Seite spürbar mehr PPs, weil die Referenz weiterhin nach der
  gewürfelten, nicht der tatsächlich gefelderten Größe schlüsselt. Opus' eigene Empfehlung — „erste
  Umsetzung ohne Dämpfer, aber dokumentiert" — ist umgesetzt, nicht stillschweigend ignoriert.
- **Fragen 6/7 aus der V1-Runde** (Rolling-Historie über Saisons; ob diese PPs in dieselben
  Saison-Ledger wie PPS-PPs fließen): weiterhin offen, außerhalb dieser Änderung.

---

## 8. Geänderte/neue Dateien

| Datei | Änderung |
|---|---|
| `lib/resolve/battle-mode-arena-team-points.ts` | Kernänderung: Impact-Kurve statt Perzentil, neue Konstanten, Feldgrößen-Auflösung |
| `lib/battle/arena-headless-runner.ts` | Zwei Robustheits-Fixes (tsx-Kompatibilität, Netzwerk-Abriegelung), gefunden beim Bau des Ziehskripts |
| `lib/lineups/legacy-lineup-types.ts` | Kommentar auf V2 aktualisiert |
| `data/generated/basketball-pps-referenz.json` | **neu** — die gezogene Referenz |
| `scripts/ziehe-basketball-pps-referenz.ts` | **neu** — zieht die Referenz gegen echte Liga-Kader |
| `tests/battle-mode-arena-team-points.test.ts` | V1-Perzentil-Tests durch V2-Kurven-Tests ersetzt |
| `tests/basketball-pps-referenz-drift.test.ts` | **neu** — der Drift-Wächter |
| `scripts/miss-basketball-pps-anteil-mitte.ts` | **neu** (04.09.) — misst `a_mitte`-Kandidaten an echten Duellen, s. Abschnitt 9 |

---

## 9. `BASKETBALL_PPS_ANTEIL_MITTE`: entschieden bei 0,25, gemessen statt geraten (04.09.)

Diese Konstante war der **einzige** offene Punkt dieser Runde: 0,25 (ausgeliefert, Opus'
Empfehlung) gegen 0,45 (Chris' älteres Beispiel). Chris hat die Entscheidung ausdrücklich
zurückgegeben — „trifft bei Basketball eine gemessene Entscheidung oder frag fable" —, also ist sie
hier gemessen worden, nicht abgewogen.

**Ergebnis: 0,25 bleibt.** Der ausgelieferte Wert ist bestätigt, keine Codeänderung nötig.

### 9.1 Wie gemessen wurde

`scripts/miss-basketball-pps-anteil-mitte.ts` (neu) zieht echte Duelle über denselben Weg wie das
Referenz-Ziehskript — `buildArenaTeam()` gegen echte Liga-Kader aus dem `live-save`-Abbild,
`runArenaFixtures()` als Motorpfad — und wertet die **rohen Duell-Boxscores** gegen mehrere
`a_mitte`-Kandidaten aus. Entscheidend: die Simulation läuft **einmal**, alle Kandidaten sehen
danach **exakt dieselben Duelle** (`--roh=<pfad>` + `--nur-auswertung`), nicht je eine eigene
Ziehung.

| | |
|---|---|
| Quell-Save | `new-game-1787123325719-swnjlk` (`live-save`, gespiegelt 2026-09-04 05:10, Spiegel geprüft) |
| Duelle | 352 (160 bei 6v6, 96 bei 4v4, 96 bei 2v2) |
| Spielerwerte | 3.072 |
| Gemessen am | 2026-09-04 |

**Nebenbefund, unbestellt, aber wichtig: die eingefrorene Referenz ist unabhängig bestätigt.** Diese
Ziehung ist eine komplett eigene Stichprobe (andere Saaten, andere Paarungen) und reproduziert die
Referenzwerte aus Abschnitt 4.1 fast exakt:

| Feldgröße | iMittel (eingefroren) | Median (neue Stichprobe) | iKrass (eingefroren) | p99,5 (neue Stichprobe) |
|---:|---:|---:|---:|---:|
| 2 | 52,5 | 52,9 | 101,01 | 101,9 |
| 4 | 24,9 | 25,1 | 65,68 | 65,1 |
| 6 | 15,4 | 15,6 | 52,65 | 52,1 |

### 9.2 Der wichtigste Fund: Chris' wörtliche Beschwerde hängt gar nicht an `a_mitte`

Chris' Satz war „es soll nicht in jedem team duell immer ein spieler volle punktzahl bekommen".
Gemessen, Anteil der Duelle, in denen **mindestens ein Spieler die volle Punktzahl 5,50 bekommt**:

| Feldgröße | a_mitte 0,20 | **0,25** | 0,35 | 0,45 |
|---:|---:|---:|---:|---:|
| 2v2 | 3,1 % | **3,1 %** | 3,1 % | 3,1 % |
| 4v4 | 4,2 % | **4,2 %** | 4,2 % | 4,2 % |
| 6v6 | 5,6 % | **5,6 %** | 5,6 % | 5,6 % |

**Identisch, in jeder Zeile.** Das ist kein Messrauschen, sondern eine Eigenschaft der Formel: die
volle Punktzahl fällt genau dann, wenn `I ≥ I_krass` — und diese Bedingung enthält `gamma`
überhaupt nicht. Wie oft ein Duell die Höchstnote sieht, entscheidet **allein `I_krass`** (das
99,5.-Perzentil, s. Opus-Dokument offene Frage 2), nicht `a_mitte`.

Damit ist die Beschwerde bereits durch das ausgelieferte Modell beantwortet — **einmal in rund
achtzehn 6v6-Duellen** statt wie unter V1 in praktisch jedem. Und die Frage nach `a_mitte`
reduziert sich auf die **zweite Hälfte** von Chris' neuerer Aussage: die Trennschärfe zwischen
„krass" und „mittelmäßig".

### 9.3 Wo `a_mitte` wirklich beißt

Alle Zahlen 6v6 (160 Duelle), die Vollständige über alle drei Feldgrößen im Skript-Ausdruck:

| Größe | a_mitte 0,20 | **0,25 (ausgeliefert)** | 0,35 | 0,45 |
|---|---:|---:|---:|---:|
| gamma (6v6) | 1,309 | **1,128** | 0,854 | 0,650 |
| Duelle mit **≥ 90 % von MAX** | 8,1 % | **9,4 %** | 11,9 % | 15,6 % |
| Duelle mit ≥ 95 % von MAX | 7,5 % | **7,5 %** | 8,1 % | 8,1 % |
| mittelmäßiger Auftritt (Median-Impact) | 1,12 | **1,40** | 1,95 | 2,50 |
| schwacher Auftritt (p10-Impact) | 0,21 | **0,33** | 0,66 | 1,10 |
| Duellbester p10 / Median / p90 | 2,46 / 3,38 / 4,79 | **2,75 / 3,63 / 4,89** | 3,26 / 4,00 / 5,03 | 3,69 / 4,33 / 5,14 |
| **Spreizung der Duellbesten (p10..p90)** | 2,33 | **2,14** | 1,77 | **1,45** |
| Team-Ausschüttung (Median, Summe je Team) | 7,9 | **9,3** | 12,2 | 15,1 |

Drei Dinge stehen darin, und alle drei zeigen in dieselbe Richtung:

1. **Beinahe-Höchstnoten.** 0,45 vergibt in **15,6 %** der 6v6-Duelle mindestens 90 % der
   Höchstnote, 0,25 in **9,4 %** — zwei Drittel mehr. Der Deckel selbst fällt gleich oft (9.2),
   aber 0,45 drückt das Feld darunter spürbar näher an ihn heran. Das ist genau die Richtung, aus
   der Chris' Beschwerde kam.
2. **Trennschärfe.** Der Abstand zwischen einem schwachen und einem starken Duellbesten beträgt bei
   0,25 **2,14 PPs**, bei 0,45 nur **1,45**. Und der Abstand mittelmäßig → typischer Duellbester:
   1,40 gegen 3,63 (Faktor 2,6) bei 0,25, 2,50 gegen 4,33 (Faktor 1,7) bei 0,45. Chris' neuere
   Aussage betont ausdrücklich, „was ein krasser impact ist und was mittelmäßig" — 0,25 trennt das
   messbar deutlicher.
3. **Ausschüttungsniveau — das Argument, das gar keine Geschmacksfrage ist.** Diese PPs ersetzen
   `pointsAwarded` auf dem PPS-Pfad (`legacy-matchday-resolve-engine.ts` Z. 798/829), die Team-Summe
   ist also direkt mit `rank-to-points` vergleichbar (`references/sheets/rank-to-points.json`,
   playerCount 6: Rang 1 = 19,9, Rang 4 = 16,1, Rang 8 = 11,8, Rang 11 = 9,1, Rang 16 = 5,6):

   | a_mitte | Team-Summe (Median) | entspricht PPS-Rang |
   |---|---:|---|
   | **0,25** | **9,3** | **10-11 (unteres Mittelfeld)** |
   | 0,35 | 12,2 | 7-8 (Mitte) |
   | 0,45 | 15,1 | 4-5 (oberes Mittelfeld) |

   `MAX` wurde in dieser Runde von 6,6 auf 5,5 gesenkt, **weil** das Modell sonst jedem Team im
   Mittel Meisterniveau zahlt (Abschnitt 2 / Opus-Dokument Abschnitt 6). `a_mitte = 0,45` macht
   64 % dieser Senkung wieder rückgängig und schiebt eine Durchschnittsmannschaft zurück in Richtung
   Meisterausschüttung. Das ist kein Geschmack, das ist derselbe Fehler auf einem anderen Regler.

### 9.4 Und Chris' älteres Beispiel? Es spricht nicht für 0,45.

Die Begründung für 0,45 lautete: Chris nannte einmal „ein mittlerer Spieler ca. 2,5" — und
`2,5 / 5,5 ≈ 0,45`. Diese Rechnung setzt still voraus, dass ein Topspieler die **vollen 5,5**
bekommt. Chris' Satz sagt aber etwas anderes (`docs/design/battle-mode-pps-modell-plan.md`
Abschnitt 0, wörtlich):

> „… bis zu sechs oder fünf PPs pro Disziplin bekommen — ein **Topspieler z. B. fünf**, ein
> **mittlerer Spieler ca. 2,5**, ein **schlechter Spieler 0,5**. Als Beispiel."

Das ist eine Aussage über **Verhältnisse zu dem, was ein Topspieler tatsächlich bekommt**
(Mitte/Bester = 0,50, Schwach/Bester = 0,10) — und ein typischer Duellbester bekommt gemessen
3,63 (0,25) bzw. 4,33 (0,45), nicht 5,5. So gemessen:

| Feldgröße | Verhältnis | Chris' Beispiel | **0,25** | 0,35 | 0,45 |
|---:|---|---:|---:|---:|---:|
| 6v6 | Mitte / Duellbester | 0,50 | **0,39** | 0,49 | 0,58 |
| 6v6 | Schwach / Duellbester | 0,10 | **0,09** | 0,16 | 0,25 |
| 4v4 | Mitte / Duellbester | 0,50 | **0,44** | 0,53 | 0,62 |
| 4v4 | Schwach / Duellbester | 0,10 | **0,15** | 0,24 | 0,34 |
| 2v2 | Mitte / Duellbester | 0,50 | **0,51** | 0,61 | 0,68 |
| 2v2 | Schwach / Duellbester | 0,10 | **0,19** | 0,29 | 0,39 |

**0,25 liegt bei 2v2 und 4v4 auf beiden Verhältnissen näher an Chris' Beispiel als 0,45, bei 6v6
auf dem unteren.** Auf dem „schlechter Spieler"-Ende trifft 0,25 die 0,10 bei 6v6 fast exakt (0,09),
während 0,45 mit 0,25 das Zweieinhalbfache ausschüttet. Der ältere Satz ist also **kein** Argument
für 0,45, sobald man ihn misst statt ihn auf den Deckel zu normieren. Nur wer „2,5" absolut liest,
landet bei 0,45 — und dann bekommt der schlechte Spieler 1,10 statt 0,5.

### 9.5 Warum nicht 0,35 als Kompromiss

0,35 wurde mitgemessen und trifft bei 6v6 das Mitte/Bester-Verhältnis (0,49) und setzt die
Team-Ausschüttung genau auf PPS-Rang 8 (12,2 gegen 11,8). Trotzdem nicht gewählt:

- Es kostet Trennschärfe (Spreizung 1,77 statt 2,14) und vergibt in 11,9 % statt 9,4 % der Duelle
  mindestens 90 % der Höchstnote — beides in die Richtung, aus der die Beschwerde kam.
- Chris hat weder 0,35 genannt noch eine mittlere Ausschüttung auf Rang 8 verlangt. Eine Zahl zu
  wählen, weil sie „in der Mitte liegt", ist genau das freihändige Setzen, das die Projektregel
  „keine erfundenen Werte" untersagt. 0,25 hat eine benannte Herleitung (Opus-Dokument
  Abschnitt 6) und wird von den Messungen oben getragen.

### 9.6 Rangtreue: strukturell unberührt, trotzdem nachgemessen

Die Kurve ist eine **streng monoton steigende** Abbildung desselben Rohwerts — die Reihenfolge der
Spieler kann sich mit `a_mitte` gar nicht ändern. Nachgemessen an allen 13.824 Spielerpaaren der
352 gezogenen Duelle: **0 Paare drehen zwischen 0,25 und 0,45 die Reihenfolge**, 9 Paare (0,065 %)
unterscheiden sich ausschließlich darin, ob `roundPps()`s zwei Nachkommastellen sie zu einem
Gleichstand zusammenziehen.

Zusätzlich die reguläre Sonde, `node scripts/miss-alle-disziplinen.mjs 24 basketball` auf diesem
Branch:

| | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Abnahme |
|---|---:|---:|---:|---|
| Basislinie (`data/generated/rangtreue-basislinie.json`) | 0,757 | 0,102 | 0,923 | knapp |
| dieser Branch | **0,757** | 0,102 | **0,923** | knapp |

Unverändert auf die dritte Stelle — wie erwartet, denn `a_mitte` sitzt hinter dem Motor, nicht in
ihm.

### 9.7 Wie das nachzurechnen ist

```sh
git fetch origin live-save
git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > /tmp/abbild.gz
gunzip -c /tmp/abbild.gz > /tmp/abbild.sqlite
OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/miss-basketball-pps-anteil-mitte.ts --feldgroessen=6 --fixtures=160 --roh=/tmp/duelle-6.json
npx tsx scripts/miss-basketball-pps-anteil-mitte.ts --nur-auswertung --roh=/tmp/duelle-6.json
```

Der erste Aufruf simuliert (bei 6v6 rund 15 Minuten für 160 Duelle), der zweite rechnet die Tabelle
aus den gespeicherten Rohdaten in Sekunden neu — auch für weitere Kandidaten, indem man `KANDIDATEN`
im Skriptkopf ergänzt.
