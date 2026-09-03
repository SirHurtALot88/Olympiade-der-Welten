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
   = 5,5` (vorher 6,6; Mitte von Chris' Rahmen „5-6") und `BASKETBALL_PPS_ANTEIL_MITTE = 0,25`
   (Opus' schärfer trennende Variante — Chris kann beide mit einer Zeile ändern).
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
