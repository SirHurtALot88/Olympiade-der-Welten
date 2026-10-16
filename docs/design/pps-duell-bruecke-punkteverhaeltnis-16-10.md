# PPS-Duell-Bruecke, Punkteverhaeltnis und Abnahmetabelle (16.10.)

Umsetzung von Gruppe 2 aus `docs/design/battle-mode-20-spieltage-liga-mechanik-16-10.md`
(Abschnitte 3 und 5, PR-Punkte 4–6), erweitert um die Korrektur der Projektaufsicht vom selben Tag
(Brücke = verbindlicher Rückfall, Abnahmetabelle mit Wächter-Test, Mini-DM nicht als „besteht schon“,
Bit-Identität für Manager-Saves nachgewiesen, Rohwerte persistiert). Basis: `main` = `ace43062`.
Alles, was hier als Zahl steht, ist heute gemessen — die Befehle stehen jeweils dabei (Abschnitte 2, 3, 4, 5).

---

## 0. Kurzfassung

1. **In einem Battle-Save zahlt jede Disziplin 2/1/0 je Fixture.** Gibt es kein gezähltes
   Arena-Ergebnis, entscheidet der PPS-Score beider Seiten **desselben Fixtures** nur darüber, wer
   gewinnt (`resolutionSource: "pps_duell"`). Die Rangtabelle (`getRankToPointsValue()`, bis 19,9
   für Rang 1) setzt in einem Battle-Save **nie** mehr Team-Punkte — auch nicht, wenn der Arena-Lauf
   scheitert. Ohne Fixture gibt es `null` + Warnung `battle_mode_ohne_duell:<disziplin>` statt
   stiller Rangpunkte.
2. **Punkteverhältnis = Tiebreaker, keine Zusatzpunkte.** `D = max(1, round(10·min(1, m/M90)))`,
   Remis 0, Sieger +D, Verlierer −D. Je Ergebniszeile persistiert: `marge` (Rohabstand),
   `verhaeltnis` (±D), `margeM90` (verwendete Bezugsgröße), `duellSeiten` (Rohwerte) und
   `opponentTeamId`. Tabelle sortiert `Punkte → Verhältnis → totalScore → …`.
3. **Zwei Mengen statt einer.** `ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS` (15, Motor angeschlossen)
   und `ARENA_RESOLVED_DISCIPLINE_IDS` (die, deren Arena-Ergebnis zählt). Die zweite wird von
   `tests/disziplin-abnahme-guard.test.ts` gegen `data/generated/disziplin-abnahme.json`
   geprüft: wer nicht besteht und nicht auf Chris' Ausnahmeliste steht (nur Hockey), fliegt raus
   und spielt über die Brücke.
4. **Mini-DM bleibt auf der Brücke** (Begründung in Abschnitt 4) — Pod-Resolve ist Folge-Task.
5. **Manager-Saves bit-identisch**, nachgewiesen an allen acht Saves des heutigen Live-Abbilds
   (80 Spieltags-Vorschauen, Ledger, Saisonstand-Nachbuchung; Abschnitt 5).

---

## 1. Die Brücke

`lib/resolve/battle-mode-pps-duell.ts` (rein, synchron, kein Browser) liefert
`berechnePpsDuellOverrides()` — dieselbe Form wie die Arena-Overrides. Eingehängt in
`buildLegacyMatchdayResolvePreview()` (`legacy-matchday-resolve-engine.ts`) an genau der Stelle der
Arena-Overrides:

- Fixtures des Spieltags aus `seasonState.schedule` (beide Ligen; `leagueTier` wird nicht verlangt,
  damit auch ein Battle-Save ohne Split nicht still auf die Rangtabelle fällt).
- Je Disziplin: Teams mit Arena-Ergebnis sind ausgenommen, alle übrigen Fixtures werden aus dem
  Score nach Team-Power-Debuffs (derselbe, nach dem gerankt wird) als Duell gewertet.
- `teamPoints` 2/1/0, `pointSource: "battle_mode_pps_duell_win_draw_loss"`,
  `resolutionSource: "pps_duell"`, `opponentTeamId` gesetzt. Individuelle Spieler-PPs bleiben wie im
  Konzept 5.2 beim bisherigen PPS-Anteil (`distributeRankPointsToPlayers()`) — nur der TEAM-Wert
  wechselt.
- **Mutator in Duell-Slots:** der Score-Anteil des Mutators bleibt (er entscheidet das Duell mit),
  der flache PP-Nachschlag (`mutatorPpsBonus`, +0,3) entfällt (`toBattleDuellMutatorResult()`).
  Sonst stünde er als Zusatzpunkt neben 2/1/0 in der Tabelle — die Arena-Seiten verlieren ihn seit
  29.09. bereits (organischer Mutator). Offene Frage 3.
- Tabelle und Ledger buchen `"pps_duell"` wie `"arena"` als feste Punktzahl
  (`istDuellWertung()`, eine Stelle für `standings-preview-engine.ts` und
  `season-points-ledger.ts`) — ohne das hätte die Saisonstand-Nachbuchung die Rangpunkte am Ende
  wieder hineingeschrieben.
- Die Bühne (`DisciplineStageArena.tsx`) zeigt bei Duell-Zeilen die gebuchten 2/1/0 statt einer
  frisch nachgeschlagenen Rangtabelle (betraf vorher auch die Arena-Disziplinen).

Wann greift was, in einem Battle-Save:

| Fall | Team-Punkte |
|---|---|
| Disziplin in `ARENA_RESOLVED_DISCIPLINE_IDS`, Arena-Lauf ok | Arena 2/1/0 |
| dieselbe, Arena-Lauf für eine Liga gescheitert / Team ohne Ergebnis | PPS-Duell 2/1/0 |
| angeschlossen, aber Abnahme nicht bestanden (Basketball, rho 0,795) | PPS-Duell 2/1/0 (kein Arena-Lauf mehr) |
| nicht angeschlossen (Football, I-Spy, Battlefield, TDM, Mini-DM) | PPS-Duell 2/1/0 |
| synchroner Pfad / Auto-Run (kein Arena-Lauf) | PPS-Duell 2/1/0 |
| Team ohne Fixture | `null` + Warnung, nie Rangpunkte |

---

## 2. Punkteverhältnis

Formel und Beispiele wie Konzept 3.3 (`tests/battle-mode-pps-duell.test.ts` rechnet sie nach:
Basketball 87:72 bei M90 47 → 3, Gewichtheben 6:0 → 10, I-Spy 1274:999 bei M90 416 → 7, kg-Tiebreak
bei 3:3 → 1, Remis → 0, ohne Referenz → 5 mit Warnung `verhaeltnis_referenz_fehlt:<quelle>:<disziplin>`).

**Referenz `M90(quelle, disziplin, feldgröße)`** in `data/generated/verhaeltnis-referenz.json`:

- Quelle `pps`, alle 20 Disziplinen × Feldgröße 2..6, `scripts/ziehe-verhaeltnis-referenz.ts`:
  echte Kader des Live-Abbilds (`swnjlk`, Saison 2), **KI-Aufstellung des Spiels**
  (`buildAiLegacyLineupPreviewWithModifiers()`, dieselbe Funktion wie der Auto-Run: Schonen/Pushen,
  Formkarten, Kapitän, Team-Power), gewertet über `buildLegacyMatchdayResolvePreview()`, drei
  Spieltage, je Spieltag zwei Zufallspaarungen **innerhalb der Liga** (Split über
  `buildInitialLeagueAssignment()` nachgebildet) → 96 Fixtures je Disziplin und Feldgröße.
  **Zwei Funde beim Ziehen**, beide im Skript festgehalten: (1) der geteilte Lineup-Kontext-Cache
  schlüsselt nicht nach dem Disziplin-Spielplan — ohne Reset je Probe kamen fremde Score-Maps
  zurück und jedes Duell war ein Remis (das Skript bricht jetzt ab, wenn eine Probe weniger als vier
  verschiedene Scores hat); (2) „beste n ohne Modifikatoren“ (die Methode der
  `*-pps-referenz`-Skripte) unterschätzt die Ränder eines echten Battle-Spieltags um etwa die
  Hälfte (Eiskunstlauf M90 41–108 gegen 92–206 mit KI-Aufstellung) — damit landeten im Battle-E2E
  42 % der Siege auf D = 10. Standard ist deshalb `--aufstellung=ki`; `--aufstellung=beste-n`
  bleibt als Schalter.
- Quelle `arena`, `scripts/ziehe-verhaeltnis-referenz-arena.ts`: `runArenaFixtures()` wie die
  PPS-Referenz-Skripte, m = |Seitenstand-Differenz|, 3 Runden × 16 Paarungen = 48 Fixtures je
  Feldgröße. Gezogen für alle zwölf gewerteten Arena-Disziplinen mit echtem Seitenstand; Basketball (derzeit
  nicht gewertet) fehlt — bei Wiederaufnahme mitziehen.
- **Abweichung vom Konzept 3.4, bewusst:** eigene Datei statt eines `margeReferenz`-Felds in den
  `*-pps-referenz.json`. Diese neu zu ziehen hätte iMittel/iKrass mitbewegt (Motor seit der letzten
  Ziehung verändert) und damit die individuellen PPs aller Arena-Disziplinen still verschoben.
- **Staffel und Time-Trial** haben keine Arena-Referenz: `spieleBahn()` gibt `seiten` als 1:0 —
  m wäre immer 1. Bis der Motor den Zeitabstand hinausreicht (Konzept 3.2, zwei additive Zeilen in
  `spieleBahn()`), gilt für sie D = 5 je Sieg (Folge-Task 3).

**Tabelle.** `StandingRecord.verhaeltnis` und `StandingsPreviewItem.projectedVerhaeltnis` werden bei
jeder Buchung aus den gebuchten `DisciplineResultRecord.verhaeltnis` der Saison **neu summiert**
(`lib/standings/standings-verhaeltnis.ts`) — idempotent bei `forceReplace`, ohne zweite
Baseline-Mechanik. `sortForProjectedPoints()` (`standings-tiebreaker-policy.ts`) sortiert
`projectedPoints → verhaeltnis → totalScore → matchdayRank → currentRank → Name`; die
Gleichstand-Erkennung beachtet das Verhältnis ebenfalls. Sind beide Werte `null` (jeder
Manager-Save), ist die Stufe wirkungslos. Die Saisonstand-Nachbuchung rankt mit demselben
Tiebreaker. Eine sichtbare Tabellenspalte ist nicht Teil dieses PRs (Konzept Gruppe 3, PR 10).

---

## 3. Abnahmetabelle und Wächter

**Projektaufsicht 16.10.:** die Prämisse „die 15 arena-aufgelösten Disziplinen bestehen alle“ war
nicht belegt, und die Zahlen in `gesamtstand-audit-13-10.md` / `stand-aller-disziplinen.md`
widersprachen sich. Deshalb heute alle 15 angeschlossenen Disziplinen **frisch** gemessen, an
`ace43062` (Motor unverändert durch diesen PR), mit den Projekt-Standardwerkzeugen:

- rho: `node scripts/miss-alle-disziplinen.mjs 24 <disziplinen…>` (kaderfest, fünf echte Paarungen,
  Median über die Kader-Familie)
- Pp: `node scripts/messe-arena-einfluss.mjs <disziplin>` (48 Läufe, Staffel 144, +15, Mutatoren
  je Lauf) und dasselbe mit `--saat-versatz=10000000`

| Disziplin | rho je Spiel (Spannweite) | Pp Strom 0 / 1 | Abnahme | gewertet? |
|---|---:|---:|---|---|
| Time-Trial | 0,943 (0,049) | 11,4 / 12,5 | besteht | ja |
| Staffel | 0,937 (0,089) | 21,1 / 22,0 | besteht | ja |
| Speed-Schach | 0,910 (0,089) | 12,1 / 11,0 | besteht | ja |
| Wettessen | 0,910 (0,122) | 8,7 / 10,0 | besteht | ja |
| Spurt | 0,910 (0,142) | 19,4 / 14,9 | besteht | ja |
| Takeshi's Castle | 0,898 (0,062) | 18,9 / 17,7 | besteht | ja |
| Eiskunstlauf | 0,866 (0,105) | 18,8 / 19,8 | besteht | ja |
| Gewichtheben | 0,865 (0,143) | 8,5 / 10,0 | besteht | ja |
| Fechten | 0,860 (0,191) | 20,1 / 20,7 | besteht | ja |
| Showcase | 0,835 (0,148) | 11,1 / 12,7 | besteht | ja |
| Climbing | 0,833 (0,135) | 12,0 / 9,5 | besteht | ja |
| Tennis | 0,813 (0,199) | 6,9 / 4,4 | besteht | ja |
| Breaking | 0,801 (0,289) | 14,3 / 13,9 | besteht (knapp, große Spannweite) | ja |
| **Basketball** | **0,795** (0,085) | nicht gemessen (rho entscheidet bereits) | **rho unter 0,80** | **nein → Brücke** |
| Hockey | 0,640 (0,222), nur Feldspieler 0,676 | 39,4 (Doku, n=6) | nicht bestanden | ja — **Chris-Ausnahme** |

**Tennis und Takeshi, die widersprüchlichen Fälle:** beide bestehen heute klar (Tennis Pp 6,9/4,4
statt der 53,9/56,4 im Audit vom 13.10.; Takeshi 18,9/17,7 statt 36,4). Auch Gewichtheben (29,1 →
8,5/10,0), Showcase (28,4 → 11,1/12,7) und Fechten (40,6 → 20,1/20,7) stehen frisch unter 25. Die
Methode ist nicht die Ursache: Gewichtheben und Fechten mit `--mutatoren=aus` gemessen ergeben 9,4
bzw. 20,9 — dieselbe Größenordnung. Zwischen den Audit-Zahlen und heute liegen Motor-Änderungen
genau dieser Disziplinen (Gewichtheben-Pp-Kalibrierung #1148 am 04.10., Tennis T-F2 #1192 am 13.10.,
Fechten-Format #1111 am 15.10.); die älteren Zahlen sind veraltet, nicht falsch gemessen.

**Folge für die Menge:** einzig Basketball fällt heraus (rho 0,795 bei 24 Spielen; das Audit
nannte 0,756). Es bleibt angeschlossen, zahlt in Battle Mode aber über die Brücke, bis eine Runde
rho über 0,80 hebt oder Chris es wie Hockey abnimmt. Climbing (0,833) und Breaking (0,801) bestehen
— Breaking nur knapp und mit 0,289 Kaderspannweite; eine Rezeptänderung dort muss neu abgenommen
werden.

**Tabelle und Wächter.** `data/generated/disziplin-abnahme.json` hält je Disziplin rho, Spannweite,
Saison-rho, beide Pp-Ströme, Befehl, Läufe/Spiele, Datum, Commit und `frisch` (true = heute
gemessen; false = aus der Doku, nur bei den fünf nicht angeschlossenen und Hockeys Pp).
`tests/disziplin-abnahme-guard.test.ts` prüft:

1. jede Disziplin in `ARENA_RESOLVED_DISCIPLINE_IDS` ist angeschlossen und besteht laut Tabelle
   (rho > 0,80, zwei Pp-Ströme ≤ 25) — oder steht in `ARENA_ABNAHME_AUSNAHMEN` (nur Hockey, mit
   Quelle);
2. umgekehrt: eine angeschlossene Disziplin, die besteht, aber nicht gewertet wird, ist ein Fehler
   (Menge und Tabelle müssen zusammen nachgezogen werden);
3. Mini-DM steht nicht in der Menge.

Die Querprüfungen beim Modul-Laden (`battle-mode-arena-team-points.ts`: Chassis-Menge ⊂ Menge,
Menge → Impact-Konfig) laufen jetzt gegen die ANGESCHLOSSENE Menge — Basketball bleibt dort
vollständig verdrahtet (Chassis, PPS-Referenz, Konfig, Host-Werkzeug).

---

## 4. Mini-DM: warum nicht die sechste arena-gewertete Disziplin

Der Auftrag nannte Mini-DM als ersten Kandidaten („besteht bereits beide Kriterien, es fehlt nur
der Pod-Resolve-Pfad“). Frisch nachgemessen (`node scripts/miss-mini-dm-ffa-abnahme.mjs`, zehn echte
Kader, 210 Vierergruppen × 6 Events, zwei Saatströme) und gegen das gelesen, was eine Spieltagswertung
tatsächlich bucht, hält das nicht:

| Größe | Strom 0 | Strom 10 000 000 | Was sie misst |
|---|---:|---:|---|
| rho je Runde, Mittel / **Median** | 0,822 / **0,800** | 0,816 / **0,800** | 4 Kämpfer einer Rollenrunde |
| Vierergruppen mit Runden-rho unter 0,80 | 62 von 210 | 73 von 210 | — |
| rho je Event (16 Kämpfer, Anteil) | 0,686 | 0,686 | alle 16 Kämpfer eines Events |
| Team-rho (Eventplatz) | 0,865 | 0,872 | Team-Eignung gegen Event-Platz |
| Pp (13.10., nicht neu gemessen) | 8,7 | 9,0 | — |

Drei Gründe, warum Mini-DM in diesem PR **auf der Brücke bleibt**:

1. **Die Schranke ist „über 0,80“, gemessen am Median** (so `miss-alle-disziplinen.mjs` und
   CLAUDE.md). Der Median je Runde liegt in beiden Strömen bei genau 0,800 — nicht darüber. Die
   0,82 der Doku vom 13.10. ist das Mittel.
2. **Die gemessene Einheit ist nicht die gebuchte.** Liga-Punkte (2-1-0-0) entstehen aus dem
   EVENT-Platz. Ein Event sind vier Rollenrunden, in denen jedes Team nacheinander seine vier
   eignungsbesten Kämpfer des GESAMTEN Kaders schickt (`spieleMiniDmFfaEvent()`,
   `kader[i % kader.length]` nach `d["mini-dm"]` sortiert; der Pod-Runner `runMiniDmFfaPodFixtures()`
   reicht `buildArenaTeam()` = ganzer Kader durch). Die Spieltags-Aufstellung (Mini-DM
   `requiredPlayers` = 1, Chris: „immer 4 teams mit je 1 spieler“) liest der Motor gar nicht. Auf
   Event-Ebene über 16 Kämpfer sind es 0,686; auf Team-Ebene 0,87 — aber für ein Format, das der
   Spieler über seine Aufstellung nicht steuert.
3. **Der Pod-Resolve ist kein Fixture.** 4 Teams je Pod, 2-1-0-0, 12 statt 16 Punkte je Liga und
   Spieltag (Konzept 7.5, offen), eigene Override-Form, eigener Runner-Pfad, eigene
   Verhältnis-Definition. Das ist ein eigener PR mit eigener Abnahme.

Bis dahin läuft Mini-DM wie Football, I-Spy, Battlefield und TDM über die PPS-Duell-Brücke
(2/1/0 im Fixture des Spieltags). `tests/disziplin-abnahme-guard.test.ts` hält fest, dass Mini-DM
nicht in `ARENA_RESOLVED_DISCIPLINE_IDS` steht.

---

## 5. Verifikation

### 5.1 Bit-Identität Manager-Mode (Auflage 4 der Projektaufsicht)

Frisch gespiegeltes Live-Abbild (`live-save` 16.10. 14:40 UTC, `pruefe-spiegel-frische`: frisch),
alle **acht** Saves (sämtlich `gameMode` manager), je Save **alle zehn Spieltage** der aktiven
Saison: `buildLegacyMatchdayResolvePreview()` auf den echten Aufstellungen (SHA-256 der kompletten
Vorschau-JSON), dazu `buildSeasonPointsLedger()` und `zieheSaisonstandPunkteNach()` (Hash des
geschriebenen Saisonstands). Sonde einmal auf `main` (`ace43062`) und einmal auf diesem Branch, je
gegen eine eigene Kopie desselben Abbilds:

```
OLY_APP_SQLITE_PATH=<kopie> npx tsx scripts/pruefe-resolve-bit-identitaet.ts <ausgabe.json>
cmp bit-vorher.json bit-nachher.json   ->  IDENTISCH
```

80 Spieltags-Vorschauen, 8 Ledger, 8 Nachbuchungen: **byte-identisch** (die Ausgabe enthält je
Spieltag den Hash, je Save die Summe aller Team-Punkte, z. B. `swnjlk`: 3001,9). Möglich, weil jeder
neue Schlüssel (`marge`, `verhaeltnis`, `margeM90`, `duellSeiten`, `projectedVerhaeltnis`,
`StandingRecord.verhaeltnis`) nur an Battle-Duell-Zeilen entsteht und die Sortierstufe ohne
Verhältnis wirkungslos ist. Die Sonde lief nach der letzten Änderung unter `lib/`.

### 5.2 Battle-E2E (Wizard-Pfad, kein Mock)

`scripts/e2e-battle-pps-duell.ts 3`: frischer Battle-Save über `applyNewGameSetup({ presetId: "solo_1", gameMode: "battle" })`, Liga-Draft
(`fuehreLigaSetupDraftAus`), alle Teams KI, drei Spieltage per `runLocalMatchdayAutoRun` +
`executeMatchdayAdvance`, danach die GEBUCHTEN Zeilen ausgewertet:

| Prüfung | Ergebnis |
|---|---|
| gebuchte Disziplin-Zeilen | 192 (3 Spieltage × 2 Disziplinen × 32 Teams) |
| `teamPoints` außerhalb {0,1,2} | **0** |
| Quellen | 192 × `pps_duell` / `battle_mode_pps_duell_win_draw_loss` — **kein** `rank_to_points_*` |
| Disziplinen | I-Spy, Battlefield (nie Arena) und Time-Trial, Fechten, Speed-Schach, Staffel (arena-gewertet, der Auto-Run fährt keine Arena → Brücke) |
| Fixtures mit Punktsumme ≠ 2 oder Verhältnis-Summe ≠ 0 | **0** von 96 |
| Verhältnis-Summe je Liga | 0 / 0 |
| nicht ganzzahlige Tabellenpunkte | 0 von 32 (kein Mutator-PP-Rest mehr) |
| D-Verteilung der Sieger (1…10) | 26 · 8 · 12 · 4 · 8 · 5 · 5 · 1 · 5 · 22 |
| Teams ohne Rang (block_on_tie) | 0 |

Liga 1 nach drei Spieltagen (Punkte/Verhältnis): R-L 10/+21, L-R 8/+17, P-S 8/+13, V-D 8/+13, N-N 8/+9,
C-S 8/−7, … — fünf Teams mit 8 Punkten, sauber nach Verhältnis geordnet. (Die gespeicherten
Ränge laufen über beide Ligen statt je Liga; das ist ein vorbestehender Fehler der
Saisonstand-Nachbuchung, Folge-Task 5.)

**Kalibrierung, offen gelegt:** 22 von 96 Siegen (23 %) bekamen D = 10; die M90-Definition zielt auf
10 %. Die Referenz stammt aus dem reifen Live-Save (Saison 2), das E2E ist eine frische Saison 1 —
deren Kader streuen stärker. Mit der ersten, ungeeigneten Referenz (beste n statt KI-Aufstellung,
Abschnitt 2) waren es 42 %. Weil `marge` und `margeM90` an jeder Zeile stehen, lässt sich D jederzeit
ohne neue Simulation neu rechnen, sobald echte Battle-Saisons vorliegen (Offene Frage 2).

### 5.3 Tests

- neu: `tests/battle-mode-pps-duell.test.ts` (13 Tests: Formel inkl. Konzept-Beispiele, Brücke,
  **Invariante** „jede Battle-Zeile mit Fixture zahlt 0/1/2 und nie `rank_to_points_*`“ auch bei
  ausgefallenem Arena-Lauf einer arena-fähigen Disziplin, Arena sticht Brücke, Battle ohne Fixture →
  `null` + Warnung, Manager-Save ohne neue Schlüssel, Tiebreaker-Reihenfolge, Saisonsumme,
  Referenzdatei vollständig) und `tests/disziplin-abnahme-guard.test.ts` (7 Tests, Abschnitt 3).
- angepasst: `battle-mode-arena-matchday-resolve-e2e.test.ts` (die D2-Kontrolldisziplin zahlt jetzt
  2/1/0 als PPS-Duell statt Rangpunkte — genau die gewollte Änderung, mit echtem Chromium-Lauf),
  `battle-mode-arena-team-points.test.ts` (Verdrahtungstests prüfen die angeschlossene Menge),
  `arena-matchday-weg-b-beide-disziplinen.test.ts`/`arena-override-nur-fuer-die-gelaufene-disziplin.test.ts`
  (Basketball → Speed-Schach als gewertete Testdisziplin).
- **Volle Suite** (`npx vitest run --testTimeout=180000`, 1047 Dateien): 8362 grün, 23 übersprungen,
  1 rot — `matchday-auto-run-service.test.ts` „persists the same-day injury malus …“ mit seinem fest
  eingebauten 40-s-Timeout unter Vollast; dieselbe Datei allein: 9/9 grün.
- `npx tsc --noEmit -p tsconfig.check.json` sauber; die zwei neuen Skripte und Tests zusätzlich
  einzeln typgeprüft; ESLint auf allen geänderten Dateien 0 Fehler. Keine `.js`-Datei geändert
  (Motor unberührt), daher kein `node --check` nötig.
- **Gesperrte Eignungsmatrix nicht angefasst** (`lib/player-generator/official-discipline-weights.ts`
  unverändert).

---

## 6. Offene Fragen für Chris

Jede hier ist als begründete Standardannahme gebaut, nichts blockiert.

1. **Verhältnis = Tiebreaker, keine Zusatzpunkte** (Konzept 7.1). Gebaut als Tiebreaker; falls Chris
   Punkte meinte, wäre das eine neue Ökonomie statt 2/1/0.
2. **M90 als Bezug** (Konzept 7.2): ein Zehntel der Siege bekommt die 10. Alternativ p95/max.
3. **Mutator-PP in Duell-Slots** (neu): der flache +0,3-PP-Nachschlag entfällt in jedem Battle-Duell
   (PPS-Duell wie Arena), der Score-Anteil bleibt. Begründung: sonst stünden Zusatzpunkte neben
   2/1/0 in der Tabelle. Chris' Satz vom 29.09. („Manager-Modus und die fünf nicht simulierten
   Battle-Disziplinen behalten das bisherige System“) stammt aus der Rang-Ökonomie; ob er für 2/1/0
   weiter gelten soll, muss Chris sagen.
4. **Basketball fällt aus der Arena-Wertung** (rho je Spiel 0,795, Median, 24 Spiele, kaderfest), bis eine Kalibrierrunde rho über 0,80
   hebt — oder Chris nimmt es wie Hockey ausdrücklich ab (Eintrag in `ARENA_ABNAHME_AUSNAHMEN`).
5. **Konzept-Frage 7.4 ist damit faktisch beantwortet**: jede Disziplin zahlt im Battle Mode sofort
   2/1/0, auch vor ihrer Arena-Abnahme. Das ist Chris' „beides gibt normal 2 Punkte“ wörtlich; der
   alte Zustand (bis 19,9 für Rang 1) ist in keinem Battle-Save mehr erreichbar.
6. **Mini-DM 2-1-0-0 je Pod und welches Format genau** (Abschnitt 4): Soll das Pod-Event die
   Spieltags-Aufstellung (1 Spieler) spielen oder den ganzen Kader in vier Rollenrunden, wie der Motor
   es heute tut? Davon hängt ab, welche rho die Abnahmezahl ist.

---

## 7. Folge-Tasks

1. **Mini-DM-Pod-Resolve** (Konzept 5.3): Format-Entscheidung (Frage 6), dann Runner-Anbindung über
   `runMiniDmFfaPodFixtures()` (existiert, bisher nur Präsentation), Override je Pod-Team mit 2-1-0-0,
   Verhältnis aus Rundenpunkten gegen den Pod-Median, Abnahme am GEBUCHTEN Event (Team-rho und
   Median > 0,80), Eintrag in Tabelle + `ARENA_RESOLVED_DISCIPLINE_IDS`.
2. **Basketball-Kalibrierung** (rho 0,795 → über 0,80), danach Tabelle neu messen, Eintrag zurück.
3. **Zeitabstand für Staffel/Time-Trial**: `spieleBahn()` reicht `marge` (Time-Trial `delta`,
   Staffel `|z[0]−z[1]|`) hinaus, Runner/Override reichen es durch, Arena-Referenz für beide ziehen.
   Bis dahin D = 5 je Sieg.
4. **Tabellenspalte „Verhältnis“** in `SeasonStandingsNewLook.tsx` (Konzept Gruppe 3, PR 10).
5. **Saisonstand-Nachbuchung rankt über beide Ligen statt je Liga** (`zieheSaisonstandPunkteNach()`,
   vorbestehend, nicht von diesem PR verursacht; am Battle-E2E sichtbar: Liga-1-Ränge 3, 6, 8, …).
   Als eigener Task vorgeschlagen.
6. **Lineup-Kontext-Cache**: der geteilte Lineup-Kontext-Cache
   (`getSharedLineupContextBase`) schlüsselt nicht nach dem Disziplin-Spielplan — für das
   Referenzskript relevant (dort mit Reset gelöst), im Spiel nur, wenn sich der Spielplan eines
   Spieltags nachträglich ändert. Beobachten, nicht dringend.
