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
   geprüft — je Kriterium und nur mit frisch gemessenen Werten: wer ein Kriterium verfehlt, das
   keine Chris-Ausnahme deckt, fliegt raus und spielt über die Brücke. Heute gewertet: **12 klar
   bestanden plus Breaking genau auf der Schranke** (Beobachtungsliste). Draußen: Basketball (rho)
   und Hockey (Chris' Ausnahme deckt nur rho, Pp nicht frisch gemessen).
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
| angeschlossen, aber Abnahme nicht bestanden (Basketball: rho 0,795; Hockey: Pp nicht frisch, Ausnahme deckt nur rho) | PPS-Duell 2/1/0 (kein Arena-Lauf mehr) |
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
  Feldgröße. Gezogen für zwölf Arena-Disziplinen mit echtem Seitenstand (die elf gewerteten außer Staffel/
  Time-Trial plus Hockey, vorsorglich); Basketball (derzeit nicht gewertet) fehlt — bei
  Wiederaufnahme mitziehen.
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
| Breaking | 0,801 (0,289) | 14,3 / 13,9 | **genau auf der Schranke** (Beobachtungsliste) | ja |
| **Basketball** | **0,795** (0,085) | nicht gemessen (rho entscheidet bereits) | **rho unter 0,80** | **nein → Brücke** |
| **Hockey** | 0,640 (0,222), nur Feldspieler 0,676 | 39,4 (Doku, n=6, **nicht frisch**) | rho: Chris-Ausnahme; **Pp offen** | **nein → Brücke** |

**Tennis und Takeshi, die widersprüchlichen Fälle:** beide bestehen heute klar (Tennis Pp 6,9/4,4
statt der 53,9/56,4 im Audit vom 13.10.; Takeshi 18,9/17,7 statt 36,4). Auch Gewichtheben (29,1 →
8,5/10,0), Showcase (28,4 → 11,1/12,7) und Fechten (40,6 → 20,1/20,7) stehen frisch unter 25. Die
Methode ist nicht die Ursache: Gewichtheben und Fechten mit `--mutatoren=aus` gemessen ergeben 9,4
bzw. 20,9 — dieselbe Größenordnung. Zwischen den Audit-Zahlen und heute liegen Motor-Änderungen
genau dieser Disziplinen (Gewichtheben-Pp-Kalibrierung #1148 am 04.10., Tennis T-F2 #1192 am 13.10.,
Fechten-Format #1111 am 15.10.); die älteren Zahlen sind veraltet, nicht falsch gemessen.

**Ergebnis: 12 klar bestanden, plus Breaking genau auf der Schranke** (rho 0,801 bei
Kaderspannweite 0,289). Breaking bleibt gewertet, steht aber in der Tabelle auf der
`beobachtungsliste` und wird bei der nächsten Nachmessung zuerst geprüft; die Schranke selbst wird
nicht angepasst.

**Folge für die Menge (13 gewertet):**
- **Basketball** fällt heraus (rho 0,795 bei 24 Spielen; das Audit nannte 0,756). Es bleibt
  angeschlossen, zahlt in Battle Mode aber über die Brücke, bis eine Runde rho über 0,80 hebt oder
  Chris es ausdrücklich abnimmt.
- **Hockey** fällt ebenfalls heraus (Projektaufsicht 16.10.): Chris hat nur Hockeys Rangtreue
  abgenommen, vor dem 21.09., also bevor die Pp-Prüfung Pflicht wurde. Eine Pp-Ausnahme hat er nie
  gegeben, und Hockeys Pp ist nur der Doku-Wert 39,4 (n = 6, nach Chromium-Abstürzen), nicht frisch
  mit zwei Strömen gemessen. Die Ausnahme trägt deshalb `deckt: ["rho"]`, der Wächter prüft Pp
  weiter. Hockey kommt zurück, sobald eine frische Pp-Messung (≥ 24 Läufe, zwei Ströme, ≤ 25)
  vorliegt oder Chris die Pp-Ausnahme ausdrücklich gibt. Eine Feldspiel-Pp-Messung dauert Stunden
  (die Basketball-Messung wurde heute deshalb abgebrochen) und war in dieser Runde nicht machbar.

**Tabelle und Wächter.** `data/generated/disziplin-abnahme.json` hält je Disziplin rho, Spannweite,
Saison-rho, beide Pp-Ströme, Befehl, Läufe/Spiele, Datum, Commit und die Frische **je Messgröße**:
`rhoFrisch`/`ppFrisch` (true = heute mit dem genannten Befehl gemessen; false = aus der Doku
übernommen bzw. nicht gemessen — bei den fünf nicht angeschlossenen, bei Hockeys und Mini-DMs Pp und
bei Basketballs abgebrochener Pp-Messung). Dazu die `beobachtungsliste` (Breaking).
`tests/disziplin-abnahme-guard.test.ts` prüft:

1. jede Disziplin in `ARENA_RESOLVED_DISCIPLINE_IDS` ist angeschlossen und besteht laut Tabelle
   **je Kriterium mit frischen Werten** (rho > 0,80; zwei Pp-Ströme ≤ 25). Eine Ausnahme in
   `ARENA_ABNAHME_AUSNAHMEN` deckt nur die Kriterien in ihrem `deckt`-Feld (heute: Hockey,
   `deckt: ["rho"]`) — alle übrigen prüft der Wächter normal weiter;
2. umgekehrt: eine angeschlossene Disziplin, die besteht, aber nicht gewertet wird, ist ein Fehler
   (Menge und Tabelle müssen zusammen nachgezogen werden);
3. Mini-DM steht nicht in der Menge; Hockey steht ohne frische Pp-Messung nicht in der Menge;
   Breaking steht auf der Beobachtungsliste.

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
  Referenzdatei vollständig) und `tests/disziplin-abnahme-guard.test.ts` (9 Tests, Abschnitt 3).
- angepasst: `battle-mode-arena-matchday-resolve-e2e.test.ts` (die D2-Kontrolldisziplin zahlt jetzt
  2/1/0 als PPS-Duell statt Rangpunkte — genau die gewollte Änderung, mit echtem Chromium-Lauf),
  `battle-mode-arena-team-points.test.ts` (Verdrahtungstests prüfen die angeschlossene Menge),
  `arena-matchday-weg-b-beide-disziplinen.test.ts`/`arena-override-nur-fuer-die-gelaufene-disziplin.test.ts`
  (Basketball → Speed-Schach, Hockey → Gewichtheben als gewertete Testdisziplinen).
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
   hebt — oder Chris nimmt es ausdrücklich ab (Eintrag in `ARENA_ABNAHME_AUSNAHMEN` mit `deckt: ["rho"]`).
4a. **Hockey: Pp-Ausnahme oder Messung?** Chris' Abnahme deckt nur rho. Hockey läuft über die
   Brücke, bis entweder eine frische Pp-Messung ≤ 25 vorliegt oder Chris ausdrücklich auch Pp
   ausnimmt (`deckt: ["rho", "pp"]`).
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

---

## 8. Nachtrag 17.–18.10.: Abnahme der Brücke selbst (final, nach vier Opus-Präzisierungsrunden)

Bis hierher war rho/Pp **für die Brücke** nur behauptet, nie nachgewiesen — die Projektaufsicht
hat das angemahnt, obwohl die Brücke am 16.10. schon faktisch alle 20 Disziplinen jeder
Battle-Saison trägt (Arena läuft noch nicht im Auto-Run, K1) und dauerhaft mindestens die fünf nie
arena-angeschlossenen Disziplinen (Football, I-Spy, Battlefield, TDM, Mini-DM) tragen wird. Dieser
Abschnitt holt das nach, gemessen an `6a003097` (main, PR 0 + PR 1) → Commit der finalen Läufe
`ea63c5b6` (dieser Zweig), Werkzeug `scripts/miss-pps-duell-bruecke-abnahme.ts`. Die Messung lief
über vier Präzisierungsrunden der Projektaufsicht; **dies ist der finale Stand**, zwei frühere
Fassungen (16.–17.10.) sind ausdrücklich überholt und werden hier nicht als gültig berichtet.

> **Kernaussage zuerst, ungeschönt:** **Die Brücke besteht die Einzelspiel-rho-Abnahme auf
> Fixture-Ebene derzeit nicht.** Mittel 0,61–0,78, nur 27–51 % der Fixtures ≥ 0,80 bei Feldgröße 6.
> Ursache ist der Team-Rang-Topf (Paartreue gleiche Seite 97–100 %, über beide Seiten 76–89 %). Fix
> in Task #176. Die Seiten-Ebene (alle sieben messbaren Disziplinen > 0,80 bei Feldgröße 6) und Pp
> (7 von 8 bestehen) kommen weiter unten als **Zusatzgrößen**, nicht als Eröffnung — sie beantworten
> eine andere, engere Frage (individuelle Eignung vs. vergebene PP innerhalb einer Teamseite bzw.
> Verzerrung des Score-Kanals) und dürfen die Fixture-Ebene-Aussage oben nicht verdecken.
>
> **Nachtrag 25.10., wichtig für alles Folgende: dieser gesamte Abschnitt 8 (bis einschließlich
> 8.6) wurde — ohne dass es damals bemerkt wurde — zu 100 % über den ALTEN `"pps"`-Pfad gemessen,
> nie über die Brücke (`"pps_duell"`) selbst.** `scripts/miss-pps-duell-bruecke-abnahme.ts` setzte
> `scenarioMeta.gameMode` nie auf `"battle"`, wodurch `isBattleModeArenaEligible` immer `false`
> blieb. Gefixt (25.10., **Abschnitt 8.7**) — aber der Fix allein reicht nicht aus: alle acht
> Live-Spielstände haben nur eine Dummy-Spielplan-Kette (1 Fixture/Spieltag statt eines echten
> Rundenplans), wodurch auch NACH dem Fix nur **5,5 %** der gemessenen Team-Seiten echt über
> `"pps_duell"` laufen. Die Zahlen unten (8.2–8.6) bleiben als historischer Befund stehen, sind
> aber WEDER vor noch nach dem Fix eine belastbare Aussage über die eigentliche Brücke — **Details,
> neu gemessene Zahlen und Einordnung in Abschnitt 8.7.**

### 8.1 Was eigentlich zu messen ist

Die Brücke selbst hat keine Attribut-Logik — `outcomeAusPunkten()` vergleicht zwei fertige
Team-Scores und verteilt 2/1/0. Der Score kommt aus dem alten, Arena-unabhängigen „legacy
PPS"-Pfad (`scoreLegacyLineupDisciplineSide()`, gefüttert aus `calculateRawDisciplineScore()`) —
demselben Kanal, über den vor der Arena schon die Rangtabelle lief. Daraus zwei getrennte Fragen:

- **rho**: trifft „höhere Eignung gewinnt/bekommt mehr" zu — auf **Spieler-Ebene**, wie CLAUDE.md
  es für jede Disziplin verlangt ("Stat 80 → einer der Top-Leute"), nicht nur auf Team-Ebene?
- **Pp**: überdeckt ein anderer Kanal (Slot-Rolle, Trait/Mutator, Formkarte, Kapitän,
  Verletzungsleistung, Team-Power-Debuff) im **echten Spiel** die Matrixgewichte zusätzlich?

**Drei Methodik-Korrekturen, jede durch Nachrechnen gefunden, keine durch Vermutung:**

1. (17.10., erste Korrektur) Eine erste Fassung maß Team-Eignung gegen den binären Duell-Ausgang
   und Teil B mit neutralen Modifikatoren — beides beantwortete die CLAUDE.md-Frage nicht genau
   genug (CLAUDE.md verlangt Spieler-Ebene; neutrale Modifikatoren schalten genau die Kanäle aus,
   die die eigentliche Frage betreffen).
2. (17.10., zweite Korrektur) Teil A maß pro Saatstrom denselben Spieltags-Pool — der Spieler-rho
   hängt nicht von der Zufallspaarung ab, also waren beide „Ströme" bit-identisch, keine echte
   zweite, unabhängige Messung. Fix: disjunkte Spieltags-Fenster je Strom.
3. (17.10., dritte Korrektur, der größte Fund) Teil B verglich den über
   `calculateRawDisciplineScore`+`buildCompetitionRanks`+`mapRankToDisciplineStat` **frisch neu
   hergeleiteten** Wert einer Attribut-Anhebung gegen den **historischen**, aus der SQLite
   gelesenen Basiswert. Schon die blosse Differenz zwischen „historisch" und „frisch neu
   hergeleitet" erzeugte einen Sprung — bei JEDEM Attribut gleich, auch bei einem mit
   Matrix-/Override-Gewicht 0 (das die Formel komplett ignorieren muss). Das erzeugte einen
   kompletten Fehlbefund: Football las 64,4/55,8 Pp statt der tatsächlichen 5,9/12,5 — ein
   Mess-Artefakt, kein Befund am Spiel (Details 8.3). **Fix, jetzt dauerhaft eingebaut:**
   Basislinie UND Anhebung über DIESELBE Neuherleitung im selben Lauf, nur das Delta additiv auf
   den echten Basiswert; ein Plausibilitätstest bricht die Messung ab, wenn ein Attribut mit
   Gewicht 0 doch ein Delta ≠ 0 liefert (s. 8.5). Lehre dokumentiert in
   `docs/design/neue-disziplin-handbuch.md` Abschnitt 3.2: **Basiswert und Anhebung müssen immer
   über denselben Rechenweg im selben Lauf gehen, nie über einen gespeicherten/historischen
   Basiswert.** Geprüft: `messe-arena-einfluss.mjs`/`einflussVon()` ist von GENAU diesem Fehler
   nicht betroffen (beide Läufe frisch im selben Simulationslauf), hat aber eine verwandte,
   bereits dokumentierte Schwachstelle (Seed-/rr()-Aufrufzahl-Drift, `battle-mode.engine.js:9545`).

### 8.2 Teil A: Spieler-rho und Fixture-rho

Methodik: echter Live-Save-Kader (`swnjlk`), echte KI-Aufstellung
(`buildAiLegacyLineupPreviewWithModifiers()`, dieselbe Funktion wie der Auto-Run),
`buildLegacyMatchdayResolvePreview()`, 3 Spieltage je Strom (disjunkte Fenster, s. 8.1 Punkt 2),
Feldgrößen 3/4/5/6, Paarung innerhalb der Liga. Zwei Größen:

- **Seiten-Ebene** (die ursprüngliche K2-Abnahmezahl): je Team-Seite einer Disziplin an einem
  Spieltag (= ein Spiel/Boxscore) Spearman-rho zwischen `entries[].baseValue` (p.d) und
  `entries[].pointsAwarded`, n≥3 durch `spearman()` erzwungen.
- **Fixture-Ebene** (Opus-Auflage, zweite Präzisierungsrunde): dieselbe Korrelation über BEIDE
  Seiten eines Fixtures (2n Spieler) — näher an Chris' eigentlicher Frage („wer am
  eignungsstärksten ist, holt auch übers Duell hinweg die meisten Punkte").

**Seiten-Ebene je Feldgröße** (Median, beide Ströme):

| Feldgröße | Football | I-Spy | Battlefield | TDM | Basketball | Hockey | Fechten |
|---|---:|---:|---:|---:|---:|---:|---:|
| 3 | 1,000 / 1,000 | 1,000 / 1,000 | 1,000 / 1,000 | 1,000 / 1,000 | 1,000 / 1,000 | 1,000 / 1,000 | 1,000 / 1,000 |
| 4 | 0,800 / 1,000 | 1,000 / 1,000 | 0,800 / 0,800 | 0,800 / 0,800 | 0,800 / 0,800 | 0,800 / 1,000 | 0,800 / 0,800 |
| 5 | 0,900 / 0,900 | 0,900 / 0,900 | 0,800 / 0,850 | 0,900 / 0,900 | 0,900 / 0,900 | 0,900 / 0,900 | 0,900 / 0,900 |
| 6 | 0,886 / 0,886 | 0,886 / 0,900 | 0,829 / 0,829 | 0,886 / 0,886 | 0,900 / 0,900 | 0,900 / 0,921 | 0,829 / 0,886 |

**Feldgröße 3 ist IMMER exakt 1,0, Feldgröße 4 fast immer exakt 0,8 — das sind keine echten
Messwerte, sondern Diskretisierungsartefakte** (Opus, mathematisch: Spearman bei n=3 kennt nur
die Werte {1,0; 0,5; −0,5; −1,0}, bei n=4 nur {1,0; 0,8; 0,6; …} — ein einziger Rangtausch landet
bei n=4 exakt AUF der 0,80-Schranke, nie „darüber"). **„Über 0,80" ist deshalb für Feldgröße 3/4
keine zulässige Aussage auf Seiten-Ebene.** Feldgröße 5 berührt die Schranke einmal exakt
(Battlefield, Strom 0: 0,800); **Feldgröße 6 besteht robust und ausnahmslos** (0,829–0,921 über
alle sieben messbaren Disziplinen und beide Ströme — Mini-DM n.a., s. 8.4).

**Fixture-Ebene (2n Spieler) und CLAUDE.md-Hockey-Methodik, Feldgröße 6** (Mittel beider Ströme):

| Disziplin | Fixture-rho Mittel | Anteil Fixtures ≥0,80 | Star Rang 1 | Star Top 2 | Paartreue ≥15 Pkt gesamt | **selbe Seite** | **über Seiten** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Football | 0,72 | 35 % | 70 % | 85 % | 91 % | **99 %** | 84 % |
| I-Spy | 0,70 | 42 % | 58 % | 70 % | 92 % | **98 %** | 85 % |
| Battlefield | 0,72 | 43 % | 59 % | 72 % | 93 % | **98 %** | 89 % |
| TDM | 0,72 | 46 % | 54 % | 74 % | 91 % | **98 %** | 86 % |
| Basketball | 0,69 | 32 % | 73 % | 84 % | 89 % | **100 %** | 80 % |
| Hockey | 0,68 | 43 % | 55 % | 67 % | 88 % | **99 %** | 79 % |
| Fechten | 0,63 | 34 % | 69 % | 77 % | 87 % | **98 %** | 80 % |
| Mini-DM | n.a. (s. 8.4) | n.a. | 84 % | 100 % | 99 % | n.a. (nur 1 Spieler/Seite) | 99 % |

**Die Fixture-Ebene ist bei JEDER Feldgröße nur mäßig — nicht nur bei 3/4.** Mittelwert 0,61–0,78,
Anteil ≥0,80 nur 20–59 % über alle vier Feldgrößen und alle acht Disziplinen. Star Rang 1 (51–88 %)
und Star Top 2 (65–100 %) liegen meist in der Größenordnung der kaderfesten Hockey-Referenz aus
CLAUDE.md (58 %/78 %), teils darüber. **Die Paartreue ab 15 Punkten Abstand zerfällt klar in zwei
Eimer**: bei Paaren DERSELBEN Seite 95–100 % (nahe am CLAUDE.md-Idealbild „99 % bei gut
funktionierenden Disziplinen"), bei Paaren ÜBER beide Seiten nur 76–94 %. Dieser Unterschied ist
real und über alle acht Disziplinen und beide Ströme konsistent — kein Rauschen.

**Ursache (Opus-Auflage, vierte Präzisierungsrunde; Code gelesen, nicht vermutet):**
`distributeRankPointsToPlayers()` bekommt in `legacy-matchday-resolve-engine.ts` (Zeile 840,
960–963) als `rank` IMMER `rankedTeam.rank` aus `rankWithinLeagueScope()` (Zeile 86–107) — den Rang
des TEAMS nach rohem Score INNERHALB seiner Liga. Diese Team-Summe wird dann anteilig auf die
Spieler verteilt. Zwei Spieler DESSELBEN Teams teilen sich dieselbe Summen-Basis — ihr Vergleich
isoliert reine individuelle Eignung, daher 95–100 %. Zwei Spieler VERSCHIEDENER Teams vergleichen
zusätzlich die GESAMTE LIGA-RANG-STÄRKE ihrer Teams — ein Star in einem schwachen Team (kleiner
Topf) kann so weniger PP bekommen als ein Mittelmaß-Spieler in einem starken Team (großer Topf).
**Das ist NICHT an den Duell-/Brücken-Ausgang gekoppelt** — Chris' Entscheidung vom 30.08.
(`battle-mode-spielmodus-plan.md` 5.1, PP vollständig von Team-Punkten entkoppelt) ist code-seitig
eingehalten, geprüft über beide genannten Codestellen. **Es ist aber auch nicht die von Chris
gemeinte direkte Liga-Relation**: Arenas `ppsAusArenaImpact()` (`battle-mode-arena-team-points.ts`
Zeile 1116) misst einen Spieler-Impact-Wert DIREKT gegen eine feste, ligaweit gezogene
Referenzkurve (`iMittel`/`iKrass`) — kein Team, kein anderer Spieler geht ein. Der Brücken-/
legacy-PPS-Pfad tut das nicht; er nestet die individuelle Leistung in einen Team-Rang-Topf. Das ist
ein echter, vorbestehender struktureller Befund am legacy-PPS-Pfad (nicht von der Brücke
verursacht, gilt für jede Disziplin, die über diesen Pfad läuft, auch Manager Mode — dort aber
gewolltes Design, nicht Teil der Korrektur) → **Task #176** („Brücken-PPs: Team-Rang-Topf statt
Liga-Relation entkoppeln", Lösungsrichtung: Impact-Kurve wie Arena aus dem individuellen PPS-Score
gegen eine ligaweite Referenz, NUR Battle Mode, Manager Mode bleibt bit-identisch, Zeitpunkt NACH
PR3, da es die Wertung der Battle-Saves ändert). **Dieser PR ändert daran nichts** — reine Messung.

### 8.3 Teil B: Pp unter echten Bedingungen

Methodik: derselbe, bereits vom echten Spieltag gezogene Kontext (reale Formkarten, reale
Mutator-Slots, reale Team-Power, realer Kapitän, reale Fatigue/Verletzung/Moral) — nur die
`disciplineScores`-Zahl **eines bereits gefelderten Spielers** wird für ein Attribut um +15
angehoben, über die echte Liga-Rangabbildung (`buildCompetitionRanks` + `mapRankToDisciplineStat`
— derselbe Mechanismus, der p.d im Spiel erzeugt), Basislinie UND Anhebung über denselben
Rechenweg (s. 8.1 Punkt 3 — der Baseline-Mismatch-Fix). Lineup-Auswahl, Formkarten, Mutatoren,
Team-Power, Kapitän bleiben unverändert. Gemessen wird die Änderung von `pointsAwarded`, 8
Team-Seiten-Ziehungen × 12 Attribute je Disziplin und Strom (96 Läufe), Feldgröße 6, zwei Ströme.

| Disziplin | Pp Strom 0 | Pp Strom 10 000 000 | Bestanden (≤25)? |
|---|---:|---:|---|
| Football | 5,9 | 12,5 | **Ja** |
| I-Spy | 7,9 | 12,4 | Ja |
| Battlefield | 8,8 | 10,9 | Ja |
| TDM | 7,0 | 17,9 | Ja |
| Basketball | 10,1 | 9,0 | Ja |
| Hockey | 7,4 | 8,2 | Ja |
| Fechten | 15,0 | 9,1 | Ja |
| Mini-DM | 30,5 | 30,5 | **Nicht belastbar**, s. 8.4 |

**Sieben von acht bestehen klar, einstellig bis knapp unter 18.** Football bestand in der ersten
Fassung dieser Runde NICHT (64,4/55,8) — das war der Baseline-Mismatch-Fehler aus 8.1 Punkt 3, kein
echter Befund am Spiel. Mit dem Fix liest Football 5,9/12,5, in derselben Größenordnung wie die
übrigen sechs bestehenden Disziplinen. **Es gibt deshalb keinen „Football-Pp-Befund" mehr zu
untersuchen** — eine eigens dafür vorgesehene Diagnose-Aufgabe wurde aus genau diesem Grund
zurückgestellt, bevor sie Ressourcen bekam.

**Football gegen Matrix UND Override — eine offene Entscheidung für Chris, kein Nebenbefund.**
`calculateRawDisciplineScore()` ruft `resolveDisciplineWeightProfile(dId)`, die bei vorhandenem
Override (`lib/player-generator/spiel-eignung-overrides.ts`, Chris' Bestätigung E3) GENAU DIESEN
statt der offiziellen Matrix liefert — der legacy-PPS-Kanal liest für Football also den Override,
nicht die Matrix, und die Tabelle oben rechnet entsprechend gegen den Override (5,9/12,5, bestanden).
Gegen die ROHE MATRIX gerechnet (dieselben gemessenen Prozentsätze, andere Vergleichsbasis) liest
Football dagegen **83,3 / 80,4 Pp** — weit über der Schranke. Hauptursache: `spirit` wiegt in der
Matrix 25 % (das schwerste Einzelgewicht), im Override nur 3 % (von Chris bewusst so entschieden,
E3) und im Spiel gemessen nur 2–3 %. Das ist keine neue Verzerrung — die Lücke zur Matrix IST der
Override, genau wie E3 ihn beschlossen hat. **Offene Frage an Chris, explizit, nicht als Fußnote:
Football — Anzeige nach Override statt Matrix ausrichten, ja oder nein?** (gegen Override: 5,9/12,5;
gegen Matrix: 83,3/80,4). Eine „Ja"-Antwort bestätigt nur den bereits gültigen E3-Beschluss für die
Anzeige/Kaufseite; ein „Nein" wäre eine neue, bisher nicht gestellte Grundsatzfrage.

### 8.4 Mini-DM: Teil A auf Spieler-Ebene nicht übertragbar, Teil B nicht belastbar

- **Teil A, Seiten-Ebene**: 0 messbare Team-Seiten-Spiele bei jeder Feldgröße. Mini-DMs
  Spieltags-Slot hat `playerCount` 1 (Kader-/Pod-Konvention, s. Abschnitt 4 oben); jede Team-Seite
  feldet damit genau einen Spieler, und Spearman-rho braucht mindestens drei Punkte.
- **Teil A, Fixture-/Star-Ebene**: BLEIBT messbar (2 Spieler reichen für ein Paar) und zeigt ein
  gesundes Bild — Star Rang 1 82–88 %, Star Top 2 immer 100 %, Paartreue ≥15 Punkte 98–100 %
  (ausschließlich „über Seiten", da es keine zwei Spieler derselben Seite gibt). Kein Hinweis auf
  ein Problem auf dieser Ebene.
- **Teil B: NICHT BELASTBAR, nicht „durchgefallen"** — mit dem Baseline-Mismatch-Fix ein von Null
  verschiedener Wert, aber **30,5 Pp in BEIDEN Strömen, exakt gleich.** Zwei eigentlich unabhängige
  Saatströme, die exakt denselben Wert liefern, sind **dasselbe Rotflaggen-Muster wie der frühere
  Bug mit bit-identischen Medianen** (s. 8.1 Punkt 2) — ein Hinweis darauf, dass die Messung bei
  `playerCount` 1 und nur 8 Ziehungen vermutlich keine echte, voneinander unabhängige Streuung
  zeigt, nicht darauf, dass 30,5 eine belastbare, präzise Zahl ist. **Offen, bis Chris' Entscheidung
  über das Pod-Format vorliegt** (Abschnitt 4/8.4, Folge-Task Mini-DM-Pod-Resolve) — danach lohnt
  sich eine Messung mit einer dafür passenden Methode, nicht diese Sonde.

Das deckt sich mit Abschnitt 4 oben: Mini-DMs eigentliche Abnahme ist die dort beschriebene
Event-/Pod-Messung (`scripts/miss-mini-dm-ffa-abnahme.mjs`, rho 0,80 am Median, `data/generated/
disziplin-abnahme.json`), nicht diese Brücken-Sonde. Mini-DM bleibt aus genau den dort genannten
Gründen auf der Brücke, und diese Messung ändert daran nichts.

### 8.5 Der deterministische Formel-Wächter und der Plausibilitätstest

`tests/pps-duell-bruecke-score-kanal.test.ts` (12/12 grün) hält zwei Eigenschaften fest:

1. Bei **neutralen** Modifikatoren ist der Score-Kanal exakt linear/matrixproportional — eine
   Eigenschaft der Formel (gewichtete Summe), kein Messergebnis.
2. **Plausibilitätstest** (neu, Opus-Auflage nach dem Baseline-Mismatch-Fund): ein Attribut mit
   Gewicht 0 im tatsächlich genutzten Profil muss über die ECHTE Liga-Rangabbildung
   (`buildCompetitionRanks`+`mapRankToDisciplineStat`) EXAKT Delta 0 liefern — für vier Disziplinen
   × alle zwölf Attribute, synthetische 40-Spieler-Liga, kein Live-Save nötig. Derselbe Test läuft
   LIVE in `scripts/miss-pps-duell-bruecke-abnahme.ts` und bricht die Messung mit einem Error ab,
   wenn er verletzt wird — genau die Fehlerklasse aus 8.1 Punkt 3 fällt damit künftig automatisch
   auf, statt eine falsche Zahl zu erzeugen.

Keines von beiden ist die Abnahmezahl selbst — die ist Teil B (8.3) und Teil A (8.2).

### 8.6 Einordnung und Guard-Test

> **Nachtrag 25.10. (Abschnitt 8.7):** jede Zahl in diesem Unterabschnitt stammt aus einer Messung,
> die versehentlich zu 100 % den alten `"pps"`-Pfad maß (gameMode-Bug). Nach dem Fix bleiben die
> Fixture-Ebene-Zahlen praktisch unverändert (weiterhin >90 % `"pps"`, s. 8.7) — die Einordnung
> unten gilt unverändert, ist aber keine Aussage über die eigentliche Brücke.

**Die Einzelspiel-rho-Abnahme auf Fixture-Ebene besteht die Brücke derzeit NICHT** (0,61–0,78
Mittel, nur 27–51 % der Fixtures ≥0,80 bei Feldgröße 6 — größtenteils erklärt durch den
vorbestehenden Team-Rang-Topf-Effekt, 8.2, Task #176, nicht primär durch die Feldgröße). Das ist
die Kernaussage dieses Abschnitts (s. Kasten zu Beginn von Abschnitt 8) und wird hier nicht
beschönigt.

Als **Zusatzgrößen**, die eine andere, engere Frage beantworten: **rho (Seiten-Ebene) besteht** für
alle sieben messbaren Disziplinen bei Feldgröße 6 (0,829–0,921, beide Ströme) und für sechs von
sieben bei Feldgröße 5 (eine Berührung der Schranke, Battlefield Strom 0) — **Feldgröße 3/4 sind
Diskretisierungsartefakte, keine Aussage „bestanden" oder „durchgefallen".** **Pp besteht für
sieben von acht** (alle außer Mini-DM), **Football nach dem Baseline-Mismatch-Fix klar bestanden**
(kein eigenständiger Befund mehr, offene Entscheidung bleibt nur noch die Anzeige-Frage Matrix vs.
Override, s. 8.3). **Mini-DMs Pp (30,5/30,5) ist NICHT BELASTBAR**, nicht „durchgefallen" — die
exakte Gleichheit zwischen zwei eigentlich unabhängigen Saatströmen ist dasselbe Rotflaggen-Muster
wie der frühere Bit-identische-Mediane-Bug (8.1 Punkt 2), kein verlässlicher Beleg für einen Wert
über oder unter der Schranke. Offen bis Chris' Pod-Format-Entscheidung (s. 8.4).

`tests/pps-duell-bruecke-player-rho-guard.test.ts` prüft die gespeicherte
`data/generated/pps-duell-bruecke-abnahme.json` gegen die CLAUDE.md-Schranke:

- Seiten-rho > 0,80 bei Feldgröße 6, beide Ströme, alle sieben messbaren Disziplinen (robuster
  Wächter, keine Diskretisierungsgrenzfälle).
- Paartreue ≥15 Punkte „selbe Seite" ≥ 0,90 als struktureller Gesundheits-Check (zeigt an, ob der
  reine Eignungsvergleich noch funktioniert, unabhängig vom Team-Rang-Topf-Effekt).
- Pp ≤ 25 für jede Disziplin außer einer kleinen, benannten Ausnahmeliste — **aktuell nur Mini-DM**
  (Football ist nach dem Fix aus der Liste raus). Die Ausnahmeliste wird gegen unbemerktes Wachsen
  geprüft (dasselbe Muster wie `ARENA_ABNAHME_AUSNAHMEN`).

Bewusst **kein** Wächter auf der Fixture-Ebene oder auf Star/Paartreue-über-Seiten: diese Zahlen
spiegeln den vorbestehenden Team-Rang-Topf-Effekt (Task #176), nicht die Qualität der Brücke selbst
— ein Wächter darauf würde entweder dauerhaft rot sein (bis Task #176 behoben ist) oder eine
willkürliche, nicht aussagekräftige Schranke brauchen.

**Für das Hauptprojekt, nicht Teil dieses Auftrags:**
- **Task #176** (Brücken-PPs: Team-Rang-Topf statt Liga-Relation entkoppeln, NUR Battle Mode,
  Lösungsrichtung Impact-Kurve wie Arena, nach PR3 — Konzeptrunde/battle-mode-spielmodus-plan.md
  5.1 entspricht Chris' eigener Entscheidung, keine neue Grundsatzfrage). **Das ist die eigentliche
  Baustelle hinter der Fixture-Ebene-Kernaussage oben — nicht die Brücke selbst.**
- **Offene Frage an Chris, explizit (s. 8.3): Football — Anzeige nach Override statt Matrix
  ausrichten, ja oder nein?** (gegen Override: 5,9/12,5 Pp, bestanden; gegen Matrix: 83,3/80,4 Pp).
- Mini-DMs Pp bei 30,5/30,5 ist NICHT belastbar (Rotflaggen-Muster, s. 8.4) — offen bis Chris' Pod-
  Format-Entscheidung; danach eine Messung mit einer dafür passenden Methode, nicht diese Sonde.

**Messbefehl:**
```sh
OLY_APP_SQLITE_PATH=<abbild> npx tsx scripts/miss-pps-duell-bruecke-abnahme.ts \
  [--disziplinen=a,b,...] [--spieltage=3] [--feldgroessen=3,4,5,6] [--pp-trials-je-seite=8] \
  [--skip-teil-b] [--ausgabe=<pfad>]
```

### 8.7 Nachtrag 25.10. (Opus-Audit Task #191): gameMode-Fix — und ein tieferliegender, zweiter Befund

**Der Fund.** `scripts/miss-pps-duell-bruecke-abnahme.ts` biegt den Spielplan für den Probe-Spieltag
korrekt auf die gewünschten Disziplinen um, setzte aber **nirgends** `scenarioMeta.gameMode =
"battle"` am verwendeten Save (einem der acht Manager-Mode-Saves des Live-Abbilds).
`resolveGameMode()`/`isBattleModeSave()` (`lib/season/game-mode.ts`) fallen ohne dieses Feld auf
`"manager"` zurück, `isBattleModeArenaEligible` in `legacy-matchday-resolve-engine.ts` blieb dadurch
**immer** `false`, und jede gemessene Zeile lief als `resolutionSource: "pps"` — der alte, vor PR
#1296 gültige Rangpfad — statt `"pps_duell"` (die eigentlich zu messende Brücke aus
`ppAusSpielerScore()`). **Der gesamte obige Abschnitt 8 (8.1–8.6) misst damit zu 100 % den alten
Pfad, nie die Brücke selbst** — unabhängig davon, wie die einzelnen Zahlen dort eingeordnet wurden.

Derselbe Fund stand bereits in PR #1284 (18.10., "Nebenfund", nie gemergt — von PR #1296
überholt und inzwischen geschlossen) mit demselben einzeiligen Fix. Der Fix wurde nie in PR #1296
übernommen, dessen eigene Abschnitt-3-Neumessung ("rho/Pp-Neumessung der PPS-Duell-Brücke") maß
deshalb **ebenfalls** versehentlich den alten Pfad, trotz des irreführenden Namens.

**Der Fix** (minimal-invasiv, nur dieses Skript, keine Produktionslogik):

```ts
const gs: GameState = {
  ...basis,
  scenarioMeta: { ...basis.scenarioMeta, gameMode: "battle" } as GameState["scenarioMeta"],
  seasonState: { /* unverändert */ },
};
```

Direkt verifiziert (nicht nur behauptet): ohne den Fix liefert eine Testmessung 0 % `"pps_duell"`-
Zeilen (64/64 `"pps"`); mit dem Fix erscheinen `"pps_duell"`-Zeilen überhaupt erstmals. Der Fix ist
korrekt und notwendig.

**Der zweite, tiefere Befund (beim Nachmessen entdeckt, nicht Teil der ursprünglichen Aufgabe):
der Fix allein reicht nicht für eine belastbare Messung.** `findeSpieltagsFixtures()`
(`battle-mode-pps-duell.ts`) liest `seasonState.schedule` — den echten Spieltags-Spielplan (wer
spielt an Spieltag k gegen wen). Alle acht Spielstände im aktuellen Live-Abbild haben
`isLeagueSplitActive() === false` und damit laut `season-fixture-schedule.ts` (Kopfkommentar) nur
die alte **"Dummy-Paarung"** aus `preseason-workflow-service.ts`: eine Kette von genau EINEM
Fixture pro Spieltag (z. B. `A-A/B-B`, dann `B-B/B-P`, dann `B-P/C-C`, …), nicht ein echter
Rundenplan für alle 32 Teams. `new-game-1787123325719-swnjlk` hat so über die ganze Saison nur 10
Fixtures (ein Fixture pro Spieltag) statt der ~160 (16 je Spieltag × 10 Spieltage), die ein echter
Rundenplan bräuchte — geprüft für alle acht Live-Saves, überall dasselbe Bild (2 oder 10 Fixtures
gesamt, nie mehr).

**Folge, direkt nachgemessen** (4 Disziplin-Paare × 3 Spieltage, Feldgröße 6, 768 Team-Seiten
gesamt, nach dem gameMode-Fix): nur **5,5 % (42/768) laufen als `"pps_duell"`**, 12,5 % als
`"mini_dm_pod"` (Mini-DM, davon unabhängig), die restlichen **82 % bleiben `"pps"`** — mit genau
der Begründung `battle_mode_ohne_duell:<disziplin>` (kein Gegner über `findeSpieltagsFixtures()`
gefunden). Das volle Rohergebnis steht in `data/generated/pps-duell-bruecke-abnahme.json` unter
`gameModeFixResolutionSourceStichprobe`.

**Was das für die neu gemessenen Zahlen bedeutet — zwei Sorten:**

- **Seiten-Ebene-rho** (Tabelle 8.2, Spalte "Seite"): von diesem Problem **nicht** betroffen. Sie
  vergleicht Spieler INNERHALB eines Teams und ist durch Konstruktion identisch, egal ob die
  individuelle PP-Verteilung über den alten Team-Rang-Topf (`"pps"`) oder über `ppAusSpielerScore()`
  (`"pps_duell"`) läuft — beide sind monoton in der eigenen Punktzahl des Spielers. Sie war **nie**
  ein Test, welcher Mechanismus aktiv ist, weder vor noch nach diesem Fix. Neu gemessen (6
  Spieltage je Strom, 8 Standarddisziplinen, Feldgröße 6, zwei disjunkte Fenster):

  | Disziplin | Strom 0 | Strom 1 (10 000 000) |
  |---|---:|---:|
  | Football | 0,886 | 0,899 |
  | I-Spy | 0,886 | 0,900 |
  | Battlefield | 0,829 | 0,886 |
  | TDM | 0,886 | 0,886 |
  | Basketball | 0,900 | 0,900 |
  | Hockey | 0,900 | 0,900 |
  | Fechten | 0,829 | 0,900 |

  Alle 14 Werte bestehen die 0,80-Schranke, in derselben Größenordnung wie vor dem Fix
  (0,829–0,921) — **erwartungsgemäß unverändert**, s. o.

- **Fixture-Ebene / Star / Paartreue-über-Seiten** (die eigentliche Kernaussage-Zahl dieses
  Abschnitts): potenziell betroffen, aber zu über 90 % weiterhin über den alten `"pps"`-Pfad
  gezogen. Neu gemessen, Feldgröße 6, Mittel beider Ströme: Football 0,72 (vorher 0,72),
  Fechten 0,62 (vorher 0,63), Hockey 0,68 (vorher 0,68) — **praktisch identisch zu den Zahlen vor
  dem Fix**, konsistent mit dem 5,5-%-Anteil oben. Diese Messung bestätigt oder widerlegt damit
  **nicht**, ob PR #1296s `ppAusSpielerScore()`-Entkopplung (Task #176, der strukturelle Befund
  aus 8.2) die Fixture-Ebene tatsächlich verbessert — dafür bräuchte es einen Spielstand, an dem
  die Brücke überhaupt in nennenswertem Umfang greift.

**Warum Teil B (Pp) hier nicht neu gezogen wurde.** Die Pp-Messung hängt nicht an `resolutionSource`
— sie misst direkt, wie `pointsAwarded` auf eine Attribut-Anhebung reagiert, unabhängig vom
Verteilungsmechanismus. Bei weiterhin >90 % unverändertem Mechanismus wäre ein voller Neulauf
(geschätzt 80–100 Minuten für beide Ströme) voraussichtlich kaum anders ausgefallen als die
bestehenden, bereits bestandenen Zahlen (Abschnitt 8.3) — kein valider Erkenntnisgewinn für die
Rechenzeit. Die Tabelle in 8.3 bleibt deshalb unverändert stehen, jetzt aber mit demselben Vorbehalt
versehen wie die Fixture-Ebene oben.

**Einordnung, ungeschönt:** dieser zweite Befund wurde beim Audit nicht erwartet und ist unabhängig
vom gameMode-Fix selbst — der Fix bleibt richtig und notwendig (ohne ihn: 0 % `"pps_duell"`,
nachweislich), aber **keiner der in Abschnitt 8 gemessenen Werte, weder vor noch nach dem Fix,
validiert die eigentliche PPS-Duell-Brücke mit nennenswerter statistischer Masse.** Eine
aussagekräftige Messung braucht einen Spielstand mit `isLeagueSplitActive() === true` (echter
Rundenplan-Generator, `season-fixture-schedule.ts`) oder synthetisierte, vollständige
Spieltags-Fixtures für alle 32 Teams — beides außerhalb des Umfangs dieses Fixes (reine
Skript-Korrektur, keine Produktionslogik) und ein eigenständiger Folge-Auftrag.

**Manager-Mode-Bit-Identität.** Dieser Fix ändert ausschließlich `scripts/miss-pps-duell-bruecke-
abnahme.ts` — eine Datei, die von keinem Produktions- oder App-Code importiert wird (geprüft via
Volltextsuche). Der Resolve-/Mapper-Pfad (`legacy-matchday-resolve-engine.ts`,
`legacy-matchday-result-mapper.ts`, `season-points-ledger.ts`) ist dadurch bit-identisch
unberührt — keine separate Sonde nötig, da es keine gemeinsame Codefläche gibt, die der Fix
erreichen könnte.

**Testwächter.** `tests/pps-duell-bruecke-player-rho-guard.test.ts` neu gemessen und angepasst: die
frühere harte Annahme "Mini-DM hat auf Seiten-Ebene immer n=0" war selbst ein Artefakt des
gameMode-Bugs (Mini-DM lief vor dem Fix nie über `mini_dm_pod`, s. o.) — nach dem Fix schwankt n je
Fenster (0 oder ~30). Mini-DM bleibt von der rho-Schranke ausgenommen, die feste n/median-Erwartung
wurde entfernt (Begründung im Testkommentar).

---

## 9. Nachtrag 26.10. (Task #199): echte Spieltags-Fixtures statt der Dummy-Kette — jetzt gemessen

Folge-Auftrag zu Abschnitt 8.7: der dort beschriebene zweite Befund („alle acht Saves des
Live-Abbilds haben `isLeagueSplitActive() === false`, nur 5,5 % der Team-Seiten liefen tatsächlich
`"pps_duell"`") ist jetzt behoben, nicht nur dokumentiert — mit einer frischen, echten
Spieltags-Fixture-Grundlage statt der alten Dummy-Kette.

### 9.1 Testgrundlage: Weg (a), über den echten Wizard-Pfad

Kein Save von Hand gebastelt (Weg (b) aus dem Auftrag war nicht nötig). Neuer, wiederverwendbarer
Testhelfer **`tests/helpers/build-battle-mode-league-split-save.ts`**: baut einen frischen Save über
denselben Pfad wie `scripts/e2e-battle-pps-duell.ts` und `tests/helpers/mini-dm-ffa-battle-save.ts`
— `applyNewGameSetup({ presetId: "solo_1", gameMode: "battle" })` → `fuehreLigaSetupDraftAus()`
(echte, organische KI-Draft-Engine, ~2 Minuten) — und prüft danach selbst (nicht nur hoffend):
`isLeagueSplitActive() === true`, UND jeder geplante Spieltag hat ≥ 16 Fixtures (2 Ligen × 8
Paarungen), nicht die alte 1-Fixture-Kette. Schreibt in eine eigene Temp-SQLite, nie in die
Live-Save-Kopie. Verifiziert (Smoke-Lauf): 32 Teams, 2×16 Ligen, **20 Spieltage, 320 Fixtures
gesamt, 16 je Spieltag** — ein echter Rundenplan (`buildSeasonFixtureSchedule()`/
`buildDoubleRoundRobin()`, Task #157), nicht die Dummy-Kette aus `preseason-workflow-service.ts`.

`scripts/miss-pps-duell-bruecke-abnahme.ts` bekam einen neuen Schalter **`--synth-liga-split`**: baut
statt einen Save aus dem Live-Abbild zu lesen, genau diesen frischen Liga-Split-Save und misst
direkt darauf — der Rest des Skripts (Teil A/B, Spearman, Pp-Einfluss, Plausibilitätstest) ist
unverändert. Zusätzlich neu: `resolutionSourceVerteilung` in der Ausgabe zählt, welcher Pfad
(`"pps_duell"`, `"mini_dm_pod"`, `"pps"`) tatsächlich lief — der direkte Beleg, ob die Messung
diesmal wirklich die Brücke trifft.

### 9.2 Messung und der direkte Beleg: 100 % treffen jetzt die Brücke

Zwei unabhängige Ströme, **je ein eigener, unabhängig gebauter Save** (nicht derselbe Save mit zwei
Fenstern wie bisher — noch strenger unabhängig), 8 Standarddisziplinen, Feldgrößen 3/4/5/6, je 3
disjunkte Spieltage, Pp-Trials 4 je Seite (reduziert von Dokumentstandard 8 — s. Einschränkung
9.4):

```sh
npx tsx scripts/miss-pps-duell-bruecke-abnahme.ts --synth-liga-split --stroeme=0 \
  --disziplinen=football,i-spy,battlefield,tdm,mini-dm,basketball,hockey,fechten \
  --spieltage=3 --pp-trials-je-seite=4 \
  --ausgabe=data/generated/pps-duell-bruecke-abnahme-liga-split-26-10-strom0.json
# analog --stroeme=10000000, …-strom1.json
```

| | Strom 0 | Strom 1 (10 000 000) |
|---|---:|---:|
| Team-Seiten gesamt | 3072 | 3072 |
| davon `"pps_duell"` | 2688 | 2688 |
| davon `"mini_dm_pod"` (Mini-DM) | 384 | 384 |
| davon `"pps"` (alter Rückfall) | **0** | **0** |

**Zum ersten Mal seit Einführung der Brücke (PR #1296): 0 % Rückfall, 100 % echte Brücke.** Vorher
(Abschnitt 8.7, derselbe Zähler): 82 % `"pps"`, nur 5,5 % `"pps_duell"`. Das ist der direkte, nicht
behauptete Beleg, dass diese Messung diesmal tatsächlich `ppAusSpielerScore()` trifft, nicht den
alten Team-Rang-Pfad.

### 9.3 Ergebnis Teil A (rho) — Feldgröße 6, beide Ströme

| Disziplin | Seiten-rho S0 | Seiten-rho S1 | Fixture-rho Ø S0 | Fixture-rho Ø S1 | Fixture ≥0,80 S0 | Fixture ≥0,80 S1 | Paartreue ≥15 über Seiten S0 | über Seiten S1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Football | 0,829 | 0,886 | 0,834 | 0,845 | 70 % | 77 % | 98 % | 97 % |
| I-Spy | 0,892 | 0,943 | 0,890 | 0,909 | 88 % | 97 % | 99 % | 100 % |
| Battlefield | 0,886 | 0,886 | 0,854 | 0,817 | 78 % | 69 % | 98 % | 97 % |
| TDM | 0,899 | 0,900 | 0,872 | 0,851 | 81 % | 76 % | 98 % | 97 % |
| Mini-DM | 0,914 | 0,935 | 0,881 | 0,868 | 86 % | 81 % | 97 % | 97 % |
| Basketball | 0,943 | 0,914 | 0,901 | 0,851 | 91 % | 76 % | 99 % | 97 % |
| Hockey | 0,935 | 0,900 | 0,856 | 0,835 | 76 % | 72 % | 98 % | 99 % |
| Fechten | 0,943 | 0,943 | 0,893 | 0,883 | 91 % | 83 % | 98 % | 97 % |

**Seiten-rho: alle 16 Werte (8 Disziplinen × 2 Ströme) über 0,80** — besteht die CLAUDE.md-Schranke
robust, genau wie vor diesem Auftrag (dieses Maß war nie vom Dummy-Fixture-Problem betroffen, s.
Abschnitt 8.7).

**Fixture-rho — die Zahl, die Abschnitt 8 als „bestehen derzeit NICHT" eingeordnet hatte (Mittel
0,61–0,78, nur 27–51 % ≥ 0,80) — sieht unter dieser Messung drastisch anders aus:** Mittel jetzt
0,817–0,909 (vorher 0,61–0,78), Anteil ≥ 0,80 jetzt 69–97 % (vorher 27–51 %). Paartreue ≥15 Punkte
**über Seiten** jetzt 97–100 % (vorher 76–94 %) — nahe an der „selbe Seite"-Idealzahl (99–100 %,
unverändert gesund). Star Rang 1 71–94 %, Star Top 2 84–98 % über alle Zellen — in derselben
Größenordnung wie CLAUDE.mds kaderfeste Hockey-Referenz (58 %/78 %), meist darüber.

### 9.4 Ergebnis Teil B (Pp) — ein Befund, nicht nur eine Tabelle

| Disziplin | Pp Strom 0 | Pp Strom 1 | Bestanden (≤25)? |
|---|---:|---:|---|
| Football | 6,1 | 21,2 | Ja |
| I-Spy | 8,3 | 3,1 | Ja |
| Battlefield | 5,6 | 10,7 | Ja |
| TDM | 13,1 | 6,2 | Ja |
| Mini-DM | 5,6 | 23,0 | Ja (knapp) |
| Basketball | 16,7 | 3,6 | Ja |
| Hockey | 6,1 | **31,6** | **Nein** |
| Fechten | 14,6 | 12,1 | Ja |

15 von 16 Zellen bestehen. **Hockey verfehlt die Schranke in Strom 1 (31,6 > 25)** — ein echter,
hier zum ersten Mal unter realen `pps_duell`-Bedingungen gemessener Befund, keine Wiederholung
eines alten (Hockeys Pp war laut Abschnitt 8.3 vorher nie frisch gemessen, nur der Doku-Wert 39,4
übernommen). Ob das eine echte strukturelle Verzerrung ist oder Rauschen einer kleinen
Stichprobe, lässt sich mit dieser Messung NICHT sauber trennen — s. Einschränkung unten.

### 9.5 Einschränkung, ungeschönt: zwei Variablen ändern sich gleichzeitig

**Diese Messung ist kein sauberes A/B gegenüber Abschnitt 8.2/8.7.** Zwei Dinge unterscheiden sich
gleichzeitig vom vorherigen Lauf:

1. **Echte statt Dummy-Fixtures** (die eigentlich zu prüfende Variable) — direkt belegt über
   `resolutionSourceVerteilung` (9.2).
2. **Ein frischer Battle-Mode-Save der Saison 1** (keine Spielgeschichte, keine angesammelte
   Fatigue/Verletzung/Formkarten-Drift, homogenere Start-Rosterwerte aus der Liga-Draft-KI) statt
   des reifen, Saison-2-Live-Save-Abbilds (`swnjlk`), das Abschnitt 8 verwendete.

Die dramatische Verbesserung der Fixture-rho/Paartreue-Zahlen (9.3) lässt sich mit dieser Messung
**nicht eindeutig auf (1) zurückführen** — ein Teil könnte an (2) liegen (ein frischerer, homogenerer
Kader könnte den Team-Rang-Topf-Effekt aus Task #176 unabhängig von Duell/Brücke abschwächen).
**Task #176 ist damit NICHT als erledigt zu lesen** — nur, dass unter DIESEN Bedingungen (frischer
Save + echte Fixtures) das Symptom deutlich kleiner ausfällt. Eine Messung, die (1) von (2) trennt,
bräuchte entweder einen reifen Battle-Mode-Save mit echtem Liga-Split (mehrere durchgespielte
Saisons über denselben Wizard-Pfad) oder eine zusätzliche Kontrollmessung auf dem frischen Save MIT
künstlich wieder eingesetzter Dummy-Kette — beides nicht Teil dieses Auftrags.

**Zweite, kleinere Einschränkung:** Pp-Trials je Seite war 4 statt des Doku-Standards 8 (Laufzeit:
~55 Minuten je Strom bei 8 Disziplinen × 4 Feldgrößen × 3 Spieltage, davon 12 Zellen mit vollem
Teil-B-Kostenanteil je Strom — ein Verdoppeln auf 8 Trials hätte den Teil-B-Anteil allein auf ~67
Minuten je Strom getrieben). Die Pp-Werte oben (insbesondere Hockeys 31,6 und die beiden Werte nahe
an der Schranke, Football 21,2 und Mini-DM 23,0) stehen deshalb auf einer kleineren Stichprobe als
sonst üblich und sollten vor einer endgültigen Einordnung mit `--pp-trials-je-seite=8` nachgezogen
werden.

### 9.6 Was dieser Auftrag NICHT war und wofür die Zahlen hier stehen

Die Ausgaben (`data/generated/pps-duell-bruecke-abnahme-liga-split-26-10-strom{0,1}.json`) sind
bewusst **separate Dateien**, nicht ein Überschreiben von `data/generated/pps-duell-bruecke-
abnahme.json` — und `tests/pps-duell-bruecke-player-rho-guard.test.ts` bleibt unverändert gegen die
alte (nach Abschnitt 8.7 selbst als nicht belastbar markierte) Datei. Grund: diese Messung deckt nur
8 der 8 Standarddisziplinen mit reduzierten Pp-Trials ab (9.5) und lief auf einem strukturell
anderen Save (9.5) — sie durch die Hauptdatei zu ersetzen würde unbemerkt sowohl die
Vergleichsgrundlage für künftige Nachmessungen ändern als auch den konkreten Hockey-Pp-Befund (9.4)
unkommentiert in den Wächter einschleusen. Das ist eine bewusste Entscheidung, keine Auslassung.

**Für das Hauptprojekt, nicht Teil dieses Auftrags (nur beschrieben, nicht begonnen):**
- Hockeys Pp-Befund (31,6, Strom 1) mit `--pp-trials-je-seite=8` auf einem frischen Liga-Split-Save
  nachziehen, um Rauschen von echter Verzerrung zu trennen.
- Eine Messung, die (1) echte Fixtures und (2) Save-Reife unabhängig variiert (9.5), um zu klären,
  ob Task #176 (Team-Rang-Topf) durch echte Fixtures tatsächlich entschärft wird oder ob die
  Verbesserung an der frischen Saison 1 liegt.
- Eine Entscheidung, ob/wie die Hauptdatei (`pps-duell-bruecke-abnahme.json`) und ihr Wächter auf
  diese Methodik (`--synth-liga-split`) umgestellt werden sollen, sobald die obigen zwei Punkte
  geklärt sind.

**Validierung dieses Auftrags:** `npx tsc --noEmit -p tsconfig.check.json` sauber; ESLint auf den
beiden geänderten/neuen Dateien 0 Fehler (nur vorbestehende `any`/unused-vars-Warnungen,
unverändert); `tests/pps-duell-bruecke-player-rho-guard.test.ts`,
`tests/pps-duell-bruecke-score-kanal.test.ts`, `tests/battle-mode-pps-duell.test.ts` weiterhin grün
(37/37) — unverändert, weil kein Produktionscode angefasst wurde (nur `scripts/miss-pps-duell-
bruecke-abnahme.ts` und der neue Testhelfer). Gesperrte Eignungsmatrix
(`lib/player-generator/official-discipline-weights.ts`) nicht angefasst. Kein Resolve-/Mapper-/
Ledger-Code geändert — keine Manager-Mode-Bit-Identitätsprüfung nötig (dieselbe Begründung wie
Abschnitt 8.7: reine Skript-/Testinfrastruktur-Änderung, keine gemeinsame Codefläche mit der
Produktion).
