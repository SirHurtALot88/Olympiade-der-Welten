# Audit-Plan vor der Runde (11.08.2026, abends)

Chris spielt heute Abend eine Runde. Dieser Plan verteilt sechs Prüfgebiete auf Agenten:
**Sponsoren, Finanzen, Punkte, Spielerbilder/Portraits, Berechnungen allgemein, Arena.**
Zweck ist ein **Audit**, kein Umbau: messen, nachrechnen, Auffälligkeiten melden. Nichts
reparieren, ohne dass der Befund vorher berichtet wurde.

---

## 0. Lagebild — zuerst lesen, es ändert die Reihenfolge

Zwei Fakten, heute Abend nachgemessen (nicht vermutet):

1. **Die acht jüngsten Commits liegen NICHT auf `main`.** `fc587ea1`/`4a3513e4` (Sponsoren-Rework
   #501) sind deployt; alles danach — `a3619abd` (Sponsorkarte 57,7 vs 64,1), `b8551b71`/`53a183b8`
   (VK eine Definition), `f58af164` (vier Projektionen), `8ec6454b`/`134229ee` (Payload fährt
   `disciplineResults`/`lineupDrafts` wieder VOLLSTÄNDIG) — liegt nur auf dem Branch
   `claude/bugfixing-agent-run-1azwei`. Der Server deployt per `auto-deploy.sh` ausschließlich
   `main`. **Heute Abend spielt Chris also OHNE die heutigen Fixes**, inklusive der sechs
   nachgewiesenen Falschzahlen aus gekürzten Payloads (Spieltags-Ergebnis, Rekordbuch,
   Meilensteine, PP-Formbonus, Formkarten-Alarm, Saisonziele).
   → **Erste Meldung an Chris, vor allen Messungen**: Branch mergen und deployen — oder bewusst
   mit den bekannten Anzeige-Fehlern spielen. Das ist seine Entscheidung, aber sie muss VOR der
   Runde fallen, denn jedes Audit muss gegen den Code laufen, der abends tatsächlich läuft.
2. **Der aktive Spielstand ist ein NEUES Spiel von heute.** Im Live-Abbild (`active_saves`,
   `owner_id = user_local`): `new-game-1786465783606-0kalpx`, angelegt 11.08. 18:29, **Saison 1,
   Spieltag 2**, letzter Schreibzugriff 18:57. Heute Abend steht also ein **normaler Spieltag** an,
   kein Saisonende. Folgen für die Prioritäten:
   - Spieltags-Buchung (Punkte, Arena, Standings-Apply) und PUT-/Merge-Sicherheit sind **vor** dem
     Spielen zu prüfen — sie schreiben heute Abend in den Spielstand.
   - Sponsor-**Abrechnung** (Saisonende) läuft heute nicht — aber die Sponsor-**Angebote/Karten**
     dieses neuen Saves entstanden bereits unter dem neuen Rework #501 und steuern Entscheidungen.
   - Der alte Stand `new-game-1785823388048-1hf25q` (Saison 2, Spieltag 10, zuletzt 11.08. 05:54)
     existiert weiter und ist der bessere Messkörper für alles, was Historie braucht
     (Ledger über 10 Spieltage, Saisonarchiv, GuV) — an ihm messen, am neuen Save gegenprüfen.

### Reihenfolge (ehrlich beantwortet)

**MUSS vor dem Spielen (kann den Spielstand beschädigen oder eine Entscheidung verfälschen):**

| Prio | Gebiet | Warum vor dem Spielen |
|---|---|---|
| 0 | Merge-/Deploy-Frage (oben) | bestimmt, welcher Code überhaupt auditiert wird |
| 1 | BERECHNUNGEN: PUT-Rundreise & Archiv-Schutz | ein Speichern heute Abend kann Archive/Basislinien klobbern — Datenverlust-Klasse |
| 2 | PUNKTE: Buchungskette Spieltag → Ledger → Standings | wird heute Abend geschrieben; falsch gebucht = dauerhaft falsch |
| 3 | ARENA: Phasen-Summe == gebuchter Score; Bühne zeigt Gebuchtes | die Runde läuft durch die Arena; falsche Anzeige = falsche Aufstellungsentscheidung |
| 4 | SPONSOREN: eingefrorene Leiter == Karte == Abrechnungsvorschau | Vertragskarten des neuen Saves steuern die Kaderplanung dieser Saison |

**KANN warten (nach der Runde, aber zeitnah):**

| Prio | Gebiet | Warum es warten kann |
|---|---|---|
| 5 | FINANZEN: GuV-Parität, Gehaltssummen-Drift, Cash-Schluss | Saisonende ist weit weg; Anzeige-Drift verfälscht heute keine Buchung |
| 6 | BERECHNUNGEN: Rest-Kürzungen (`seasonSnapshots`, `injuryEvents`, `playerBaselines`, `persistedSeasonDerivations`) | Anzeige-Klasse; am neuen Save (1 Spieltag) noch kaum sichtbar |
| 7 | PORTRAITS | rein kosmetisch, keine Rechnung hängt daran |

---

## 1. Gemeinsame Vorarbeit für JEDEN Agenten

**An den echten Spielstand kommen** (Agenten erreichen den Server NICHT, siehe CLAUDE.md):

```sh
git fetch origin live-save
git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > "$SCRATCH/abbild.gz"
gunzip -c "$SCRATCH/abbild.gz" > "$SCRATCH/abbild.sqlite"
OLY_APP_SQLITE_PATH="$SCRATCH/abbild.sqlite" npx tsx scripts/pruefe-save-abbild-frische.ts
```

- **Frische prüfen ist Pflicht** (`pruefe-save-abbild-frische.ts`): der Push kopierte schon einmal
  eine Hauptdatei ohne WAL und lieferte anderthalb Tage alte Stände. Der Cron pusht ca. alle
  10 Minuten — während Chris spielt, veraltet das Abbild minütlich. Ergebnisse mit Zeitstempel des
  Abbilds berichten.
- **Nie** auf `data/persistence/oly-app.sqlite` zeigen (lokaler Store, Stand 04.08. — älter als der
  heutige `live-save`-Force-Push) und **nie** auf etwas, das zurück auf den Server soll.
- Schreibende Skripte (`e2e-saisonende-am-save-abbild.ts` u. ä.) ausschließlich auf einer
  Wegwerf-Kopie der Kopie.
- Relevante Save-IDs: **aktiv/heute** `new-game-1786465783606-0kalpx` (S1, MD2);
  **Messkörper mit Historie** `new-game-1785823388048-1hf25q` (S2, MD10).
- Befehle, die für Chris bestimmt sind: **ohne nachgestellte `#`-Kommentare** (zsh).

**Die sechs Fehlerklassen** — jeder Abschnitt unten sagt, welche er jagt:

1. **Zwei Rechenstellen** für dieselbe Zahl, die auseinanderdriften.
2. **Gelesenes Feld, das niemand schreibt** (z. B. `standing.form`, ehemals `rosterCount`/`salaryTotal` hart `null`).
3. **Tests, die Quelltext-Strings prüfen** statt Werte (bleiben grün über toter Funktion). Deshalb: alle Invarianten unten sind WERT-Messungen am Abbild, kein `grep` im Quelltext als Beweis.
4. **Clientseitige Rechnung auf gekürzten Daten.** Seit `8ec6454b` fahren `disciplineResults`/`lineupDrafts` voll mit (nur auf dem Branch!). Noch beschnitten: `seasonSnapshots`, `persistedSeasonDerivations`, `injuryEvents`, `playerBaselines`.
5. **`??` als Wache gegen leere Liste** — `[]` ist nicht nullish, der Ersatzzweig wird toter Code (bzw. umgekehrt: ein Benchmark liefert IMMER eine Zahl und der echte Wert wird toter Fallback, siehe `team-management-overview.ts:759` als Lehrstück).
6. **Server-Code im Browser-Bundle** (`node:fs`/`better-sqlite3`). Torwächter: `npm run build` muss durchlaufen — einmal am Ende des Audits auf dem Stand, der deployt wird.

---

## 2. PUNKTE (Prio 2)

### Wahrheit
- `lib/resolve/rank-to-points.ts` — Rang→Punkte-Tabelle (`references/sheets/rank-to-points.json`), Verteilung auf Spieler (`distributeRankPointsToPlayers`, Rundungsrest geht in den letzten Eintrag).
- `lib/foundation/season-points-ledger.ts` — `buildSeasonPointsLedger`: Punkteinträge je Performance, Team-/Spieler-Summen, `reconciliationStatus` (Toleranz 0,2).
- `lib/resolve/legacy-matchday-resolve-engine.ts` + `legacy-matchday-result-apply-service.ts` — die Buchung.
- `lib/standings/standings-apply-service.ts`, `standings-preview-engine.ts`, `standings-tiebreaker-policy.ts` — Übernahme in die Tabelle.
- `lib/foundation/discipline-points-source.ts` — Vorrangregel Slice (serverseitig, voll) vor Ledger (client).

### Invarianten (messen, nicht anschauen)
- **P1 — Team == Tabelle:** Für den Messkörper (S2, 10 Spieltage): je Team
  `Σ disciplineResults.teamPoints über alle gewerteten Spieltage == standings[teamId].points`,
  Abweichung < 0,2. Zweite Herleitung: NICHT über den Ledger, sondern roh per SQL/JSON direkt aus
  `season_states.payload_json` summieren.
- **P2 — Spieler == Team:** je (Team, Disziplin, Spieltag):
  `Σ Spielerpunkte == teamPoints` exakt (die Verteilfunktion erzwingt es — prüfen, dass sie
  wirklich lief: `reconciliationStatus == "reconciled"` für **32 von 32** Teams, und
  `playerDerivedTotal` vs `totalPoints` < 0,2).
- **P3 — Lookup deckt ab:** für jede gewertete (playerCount, rank)-Kombination des Abbilds liefert
  `getRankToPointsValue` einen Wert. Jede `rank_to_points_missing`-Warnung im Ledger ist ein Befund.
- **P4 — Quelle der Verteilung:** Verteilung nach `pointSource` zählen. Erwartung: praktisch alles
  `rank_to_points_final_score_share`. Jeder `*_fallback`-Eintrag ist eine Auffälligkeit (Fallbacks
  heißen: `finalPlayerScore` fehlte oder summierte nicht).

### Auffälligkeiten (melden, kein Fehler per se)
- Wie groß ist der Rundungsrest, den `buildNormalizedWeights` dem LETZTEN Spieler zuschiebt?
  Verteilung über alle Einträge ausgeben; systematisch > 0,01 wäre eine schiefe Lastverteilung.
- Teams, deren `pointsByArea`-Summe nicht die `totalPoints` ergibt.
- Tote-Feld-Prüfung (Klasse 2): `standing?.form` wird in `team-management-overview.ts:656/891` als
  `financeForm` gelesen und in `use-season-v2-standings-derivations.ts:44` als Sortier-Fallback
  benutzt — am Abbild zählen, in wie vielen von 32 Standings `form` überhaupt gesetzt ist
  (Vorbefund: 0 von 32). Wenn weiter 0: Leseweg ist toter Code über lebendem Sortierpfad.

### Werkzeug
`OLY_APP_SQLITE_PATH=<kopie> npx tsx scripts/mess-spieltagsergebnis-abweichung.ts --save <id>`
(vergleicht voll gegen kompakt, inkl. Inbox-Durchgriff) und ein kleines Ad-hoc-Skript für P1/P2
(Muster: `scripts/messe-pp-formbonus-am-abbild.ts`).

---

## 3. ARENA (Prio 3)

Vorab klären, WAS gerechnet wird — Ergebnis der Sichtung: die Arena rechnet **nicht selbst**,
sie ZERLEGT den Engine-Score in Phasen (Slots → Push → Form → Mutator → Captain → Power → Final)
und muss am Ende wieder exakt beim gebuchten Score ankommen. Genau diese Naht ist die Prüfstelle.

### Wahrheit
- `lib/season/matchday-arena-presenter.ts` — `buildMatchdayArenaScoreboardView`,
  `getMatchdayArenaPhaseScore`, `buildArenaScoreTrackSegments` (der „Rest"-Balken bei `final`
  erscheint ab |Δ| ≥ 0,05 — das ist der eingebaute Drift-Melder).
- `lib/season/matchday-mvp-scoring-service.ts` — `score = teamResult.finalPreviewScore` (Engine).
- `lib/foundation/discipline-stage/discipline-stage-from-preview.ts` (Vorschau-Zerlegung;
  Kommentar verspricht `Σ(Netto) == score`) und `discipline-stage-from-booked-result.ts`
  (Rückfall aus dem GEBUCHTEN Ergebnis — entstand aus Chris' Meldung „Platz 28 … aber Letzter?").
- `lib/matchday-arena/arena-stat-visuals.ts` — nur Einfärbung/Tiers, keine Buchung.
- `lib/economy/team-beliebtheit.ts` — „Arena" im zweiten Sinn: Beliebtheitsfaktor der
  Arena-Gebäude-Einnahme (wird in FINANZEN mitgeprüft, F3).

### Invarianten
- **A1 — Phasensumme == Buchung:** für jede Zeile jedes gewerteten Spieltags des Messkörpers:
  `getMatchdayArenaPhaseScore(row, "power") == row.score`, |Δ| < 0,05. Jeder sichtbare
  „Rest"-Balken ist ein Befund mit Team/Spieltag/Betrag.
- **A2 — Bühne zeigt Gebuchtes:** für bereits gewertete Disziplinen müssen Bahnen aus
  `disciplineResults` + `playerDisciplinePerformances` kommen (Namen, Team-Rang, Team-Score
  identisch mit Buchung) — NIE aus dem „besten-Spieler-Rate-Modell". Stichprobe: 3 Teams × 2
  Disziplinen des letzten gewerteten Spieltags, Bühnen-Payload gegen SQL-Rohdaten.
- **A3 — Vorschau-Zerlegung schließt:** in `discipline-stage-from-preview`:
  `Σ Spieler-Netto == teamResult.score` je Team/Disziplin (Team-Level-Mods gleichverteilt) — am
  Abbild für den ANSTEHENDEN Spieltag des aktiven Saves rechnen (das ist genau die Ansicht, die
  Chris heute Abend sieht).
- **A4 — Rangdeltas konsistent:** `rankDelta == baseRank − rank` und
  `buildArenaTeamRankMap`-Ränge stimmen mit einer unabhängigen Sortierung der Scores überein
  (Gleichstand: dieselbe Tiebreaker-Reihenfolge wie die Engine).

### Auffälligkeiten
- Häufung von `formCardStatus != "ready"` / `captainStatus != "mapped"` / Team-Power
  `missing_source` — jede dieser Flanken unterdrückt still eine Phasen-Zeile (Anzeige „—"),
  obwohl die Engine den Modifier evtl. verrechnet hat. Zählen, je Spieltag.
- `missingLineup == true`-Teams, die trotzdem Punkte > 0 gebucht haben (oder umgekehrt 0-Zeilen
  ohne Markierung).
- Vorhandene Tests als Landkarte, nicht als Beweis (Klasse 3!): `arena-preview-booked-as-shown`,
  `arena-zeigt-gebuchte-aufstellung`, `arena-panel-player-pp-includes-mutator`,
  `arena-tabelle-auf-einer-linie` — nachsehen, ob sie WERTE prüfen oder Quelltext-Strings.

---

## 4. SPONSOREN (Prio 4)

### Wahrheit
- `lib/sponsor/sponsor-liga-leiter.ts` — Sockel (nach STARTrang) + Wertungstopf (nach ENDrang),
  `SPONSOR_AUSSCHUETTUNG = 1.1`; Ankernormierung: **jede der 11 Kurvenformen hat bei Unterschrift
  denselben Erwartungswert A**.
- `lib/sponsor/sponsor-v3-offer-service.ts` — friert Leiter/Konditionen bei Unterschrift ein
  (`getSponsorV3Terms`), `sponsorV3SettlementParts` (Teleskopsumme), `SPONSOR_BODEN` via `terms.floor`.
- `lib/sponsor/sponsor-settlement-service.ts` — DIE eine Abrechnungsregel; Duplikat-Wache
  `hasSeasonEndPayoutLog`; `getSeasonSponsorCashTotal = bereits gezahlt + projizierter Rest`
  (vorzeichenecht, negative Zeilen zählen).
- `lib/sponsor/sponsor-offer-presenter.ts` / Karten-UI — hier saß der 57,7-vs-64,1-Fehler
  (Vorschau baute die Leiter neu statt die eingefrorene zu lesen; Fix `a3619abd` **nur auf dem Branch**).
- Neu seit #501 (deployt, aber noch nie in einer echten Runde geprüft!): `sponsor-leih*` (Gebäude-Leihe),
  `sponsor-leih-ziele`/`sponsor-special-objectives` (zwei Ziele), `sponsor-rangmarke.ts`.

### Invarianten
- **S1 — Eine Leiter, überall:** für JEDEN Vertrag des aktiven Saves: die Zahlen der Sponsorkarte
  (oben, unten, Detail) == `getSponsorV3Terms(contract)`-Leiter am jeweiligen Rang. Kein Aufruf
  von `sponsorKurvenLeiter` im Anzeige-Pfad außerhalb der Einfrier-/Reroll-Stellen
  (`sponsor-v3-offer-service.ts:256/374`, `sponsor-offer-service.ts:311` Deckel). Das ist die
  Rückfall-Prüfung von Klasse 1 — und sie muss auf dem Stand laufen, der heute Abend deployt ist.
- **S2 — Erwartungswert-Gleichheit:** je Vertrag: `Σ gewichte[i]·leiter[i] == A` für die gezogene
  Form, |Δ| < 0,001 (die Arithmetik verspricht Exaktheit). Über alle 32 Teams des aktiven Saves.
- **S3 — Teleskopsumme der Abrechnung:** `previewSponsorSettlement`: je Team
  `Σ parts.cashDelta == sponsorV3Settle(terms, endrang, goalFraction)`-Gesamtwert; Boden:
  kein Team unter `terms.floor` (und `floor ≥ SPONSOR_BODEN = 47,3`).
- **S4 — Liga-Deckung:** `Σ Sponsorgeld (projiziert, Endrang = aktueller Rang) / Σ Gehälter`
  über 32 Teams. Erwartung nach Messlauf und +10 %-Beschluss: reine Cash-Karten decken die
  Gehälter (~104 %); Gebäude-Leiher liegen darunter (gewollt, „Rubberband"). Werkzeug:
  `npx tsx scripts/messlauf-sponsoren-gebaeude.ts` (synthetisch) + dieselbe Summe am echten Save.
- **S5 — Keine Doppelbuchung:** am Messkörper (S2 hatte ein Saisonende):
  `getSeasonSponsorCashTotal` == Σ Logs + Rest, und nach einem Test-Apply auf der Wegwerf-Kopie
  ist der projizierte Rest exakt 0 (der frühere Doppelzähl-Fehler bei Vorschüssen/Achsen).

### Auffälligkeiten
- Verteilung der 11 Kurvenformen über die 32 KI-Verträge des neuen Saves (eine Liga, die
  geschlossen dieselbe Form zieht, hat keine Auswahl — Messlauf-Punkt 3).
- Teams ohne Vertrag (`sponsor_contract_missing`-Warnungen) — beim neuen Save sollten alle
  KI-Teams gezeichnet haben.
- Rundung: `roundCash` (1 Nachkommastelle) an jeder Zeile — Σ gerundeter Zeilen vs gerundete
  Σ, Drift über 32 Teams ausweisen.
- Leihe: `rewardCash`-Bewertung „Faktor 0,89" (`sponsor-v3-offer-service.ts:245`) — nachrechnen,
  ob eine kleine Leihe ladderseitig besser gestellt ist als Cash (dokumentierte Absicht, aber
  Chris will Auffälligkeiten sehen).

---

## 5. BERECHNUNGEN ALLGEMEIN — Payload, PUT-Rundreise, Ableitungen (Prio 1 + 6)

### Wahrheit
- `lib/persistence/foundation-initial-compact-state.ts` — was der Browser bekommt
  (`compactFoundationInitialGameState`) und was beim Speichern zurückverschmolzen wird
  (`rehydrateGameStateAfterCompactPut`, Append-only-Archiv-Wache).
- `lib/foundation/apply-compact-season-archive-sentinel.ts` — der client-seitige `[]`-Sentinel.
- `lib/foundation/get-season-derivations.ts` + `season-derivations-{compute,cache,signature}.ts`
  + `materialize-season-derivations.ts` — Cache → persistiert → frisch, mit Signatur.
- Die 7 Projektionen `foundation*` (SeasonHistory, FieldRace, FormCardBonus, MatchdayPoints,
  RecordBook, DisciplineTally, PpAreaFormBonus) — laut `8ec6454b` jetzt „wirkungslos", stehen aber noch.

### Invarianten — Prio 1, VOR dem Spielen
- **B1 — PUT-Rundreise ist Identität:** auf einer Wegwerf-Kopie des FRISCHEN Abbilds:
  `rehydrateGameStateAfterCompactPut(voll, compactFoundationInitialGameState(voll))` — Diff gegen
  `voll` muss **leer** sein für: `seasonSnapshots` (Anzahl UND Inhalt), `standingsApplyLogs`,
  `playerBaselines`, `persistedSeasonDerivations`, `transferHistory`, alle Player-Felder,
  `lineupDrafts`/`matchdayResults`/`disciplineResults`. Beide aktiven Saves prüfen. Das ist die
  Datenverlust-Klasse: heute Abend läuft genau dieser Weg bei jedem Speichern.
- **B2 — Sentinel klobbert nicht:** Rundreise MIT client-seitigem Sentinel (`[]` auf
  `seasonSnapshots`/`standingsApplyLogs` stempeln, dann PUT-Merge): Archive bleiben vollständig.
  Achtung Klasse 5 in der Wache selbst: `preserveAppendOnlyArchive` vergleicht nur LÄNGEN — eine
  gleich lange, aber inhaltlich andere Liste käme durch (der Kommentar zu
  `foundationSeasonHistory` benennt das Risiko selbst). Messen, nicht nur lesen.
- **B3 — Projektionen haben keinen Vorrang mehr:** für jede der 7 Projektionen den Leser finden
  und am Abbild belegen, dass bei VOLLEM Payload die Spielstand-Rechnung gewinnt und die
  Projektion niemals vollere Daten überstimmt. (Wenn `main` heute Abend NICHT gemerged wird,
  kehrt sich die Prüfung um: dann müssen die Projektionen die Wahrheit tragen — beide Zustände
  sind je nach Merge-Entscheid zu prüfen.)

### Invarianten — Prio 6, nach der Runde
- **B4 — Rechnet noch etwas auf den Resten?** Die vier weiterhin beschnittenen Felder und ihre
  Client-Leser (per Suche verifiziert):
  - `seasonSnapshots` → u. a. `use-finances-view-model.ts` (hat `archivePending`-Wache),
    `player-league-career-stats.ts`, `career-series.ts`, `league-records-hall-of-fame.ts`,
    `all-time-table.ts`, `ranks-previous-season-podium.ts`, `season-recap-service.ts`,
    `game-inbox-service.ts`, `team-management-overview.ts`, mehrere `tabs/use-*`.
  - `injuryEvents` → `game-inbox-service.ts`, `player-injury-history.ts`,
    `player-season-fatigue-stats.ts`, `team-history-health-metrics.ts`,
    `use-foundation-cross-tab-teams-roster.ts`.
  - `playerBaselines` → `player-detail-drawer.ts`, `player-display-market-value.ts`,
    `tabs/season-stand-render-helpers.tsx`, `tabs/home-v2-ui-helpers.ts`.
  - `persistedSeasonDerivations` → über `get-season-derivations` gekapselt; Client-Seite:
    `use-season-derivations.ts`, `discipline-points-source.ts`.
  Für JEDEN Leser die Frage mit einer Messung beantworten: degradiert er ehrlich
  (`undefined`-Wache → Nachladen/Leerzustand) oder rechnet er auf dem Rest eine FALSCHE Zahl?
  Muster der Messung: `mess-spieltagsergebnis-abweichung.ts` (voll vs kompakt, Zeilen zählen).
  Besonders verdächtig: Leser mit `?? []` statt `=== undefined` — nach dem Sentinel ist `[]`
  nicht mehr von „leeres Archiv" unterscheidbar (Klasse 5).
- **B5 — Signatur invalidiert:** `buildGameStateContentSignature` ändert sich nach einem
  gebuchten Spieltag (sonst servieren Cache/persistierte Ableitungen alte Zahlen). Am Messkörper:
  Signatur vor/nach `standings-apply` vergleichen.
- **B6 — Kein Server-Code im Bundle (Klasse 6):** auf dem Deploy-Stand einmal `npm run build`.
  Zusätzlich `grep` auf neue Importe von `better-sqlite3`/`node:fs` unterhalb von
  `lib/foundation/tabs`, `components/`, `app/foundation` — nur als Hinweisquelle, der Build ist
  der Beweis.

### Auffälligkeiten
- Stale Kommentare, die die ALTE Kürzung beschreiben (z. B. `discipline-points-source.ts` Kopf:
  „disciplineResults … auf den AKTIVEN Spieltag beschnitten" — stimmt seit `8ec6454b` nicht mehr).
  Nicht fixen, aber melden: solche Kommentare verleiten den nächsten Agenten zu falschen Wachen.
- Die 22 KB toter Projektionen selbst (angekündigter „nächster Aufräumschritt").

---

## 6. FINANZEN (Prio 5)

### Wahrheit
- `lib/finance/season-end-guv.ts` — DIE GuV (`buildSeasonGuv`); Apron zählt nur `apronGebucht`;
  Tilgung und Transfers sind Abgrenzung (zählen nicht).
- `lib/finance/season-guv-resolver.ts` — Beschaffung für die Liga (einmal, nicht je Ansicht).
- `lib/foundation/finances/use-finances-view-model.ts` — Finanzen-Tab; enthält BEWUSST einen
  client-sicheren **Nachbau** von `previewFacilitySeasonEndFinance` (dokumentierte Klasse 1!).
- `lib/sponsor/sponsor-team-salary-display.ts` — `getTeamActualSalaryTotal` (echt, `contract.salary`)
  vs `getTeamDisplaySalaryTotal` (geglättet, `expectedSalary`; Bemessung für Apron/Sponsor/KI).
- `lib/season/cash-prize-benchmark-flag.ts` — `CASH_PRIZE_BENCHMARK_ONLY = true`: Preisgeld ist
  abgeschafft, die Kette ist reiner Benchmark.
- `lib/finance/apron-projection.ts`, `lib/season/apron-*.ts` — Umverteilungstopf.

### Invarianten
- **F1 — Drei Gehaltssummen, eine Wahrheit:** je Team am Abbild:
  (a) `getTeamActualSalaryTotal` (= Abrechnungsweg, `resolvePlayerEconomyContract().salary`),
  (b) Resolver-Fallback `buildSalaryTotalByTeam` (rohes `rosters.entry.salary`!),
  (c) `getTeamDisplaySalaryTotal`.
  Invariante: |a − b| < 0,1 für alle 32 Teams (b ist der stille Zweitweg — Klasse 1; wenn ein
  Rostervertrag `salary` roh anders trägt als der aufgelöste Vertrag, zeigt die Liga-Tabelle
  andere Kosten als gebucht werden). a vs c DARF abweichen (Glättung) — Abweichung nur ausweisen.
- **F2 — GuV-Parität der Ansichten:** für das Managerteam:
  `buildFinancesViewModel(...).team.guv == resolveSeasonGuvForTeam(...).guv` — zwei Aufrufwege,
  dieselbe Funktion, aber unterschiedlich beschaffte Teile (Sponsor-Vorschau, Salary-Quelle!).
  Toleranz 0,1. Dasselbe für `einnahmen`/`ausgaben` und jeden `posten`.
- **F3 — Gebäude-Nachbau == Original:** `computeFacilitySeasonEndCash` (Client-Nachbau) gegen
  `previewFacilitySeasonEndFinance` (Server) je Team: `income.total`, `paidUpkeep.total`,
  paid/unpaid-Entscheidung identisch — inklusive Arena-Beliebtheitsfaktor
  (`computeTeamBeliebtheitFromGameState`). Bit-genau laut Kommentaranspruch (round2).
- **F4 — Apron zählt nur gebucht:** solange kein `apronSettlementLogs`-Eintrag `season_end` der
  laufenden Saison existiert, trägt der Apron-Posten 0 zur GuV bei (Zeile sichtbar, Wert daneben).
- **F5 — Kein Preisgeld fließt:** am Messkörper (durchlief ein Saisonende): kein Cash-Delta aus
  `cashPrizeApplyLogs`; Team-Cash-Bewegung der Saison vollständig erklärt durch
  Sponsor-Logs + Gehaltsabzug + Gebäude + Apron + Ziele + Kredite + Transfers. Konkret:
  `cashEnde − cashStart − (Σ gebuchte Posten + Transfersaldo + Kredite)` je Team < 0,5 — jeder
  Rest ist ein unbuchter Geldfluss und einzeln zu benennen.
- **F6 — GuV-Vorzeichen ehrlich:** kein Team mit deutlich positiver GuV und zugleich negativem
  Saison-Cash-Verlauf ohne erklärende Abgrenzung (die alte „Roter-Alarm"-Klasse aus
  `team-management-overview.ts:751 ff.`).

### Auffälligkeiten
- `roundCash`/`round1`/`round2` — drei Rundungsauflösungen im selben Geldfluss; Summendrift über
  32 Teams messen und ausweisen.
- `normalizeEconomyMoney`: skaliert Beträge > 1000 still durch 100, unter −1000 aber nicht
  (asymmetrisch, im Kommentar selbst dokumentiert) — zählen, ob am Abbild irgendein Wert diese
  Schwelle triggert.
- `financeForm`/`form` (siehe PUNKTE-Abschnitt) und weitere gelesene-aber-nie-geschriebene
  Standings-Felder: `rosterCount`/`salaryTotal` in `team-management-overview.ts:462 ff./883 f.`
  hängen an `usesArchivedSnapshotValues` — am Abbild prüfen, ob der Archiv-Zweig je Daten sieht.

---

## 7. SPIELERBILDER / PORTRAITS (Prio 7)

Hier wird nichts „gerechnet" — die Prüffrage ist Klasse 1: **gibt es überall dasselbe
Portrait-Modell, oder zweite Wege?**

### Wahrheit
- `lib/data/mediaAssets.ts` — DAS Modell: `getPlayerPortraitBrowserUrl` (Prioritätskette:
  http(s)/absoluter Web-Pfad → `portraitPath` → statischer Index `public/portraits/`
  (`data/generated/portrait-files.json`) → Legacy-Map (`player-portrait-map.json`, `/Users/…`-Pfade)
  → `/api/media/player-portrait/<id>`), plus `getPlayerPortraitMediaModel`, Varianten-Suffixe.
- `app/api/media/player-portrait/[playerId]/route.ts` — bevorzugt ebenfalls den statischen Index.
- `scripts/generate-portrait-file-index.ts` (`npm run portraits:index`).
- Verbraucher: ~24 Dateien (Drawer, Bühne, Transfermarkt, Scouting, Training, League-Leaders …).

### Prüfungen
- **PT1 — Zweiter Weg (bereits gefunden, verifizieren):**
  `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx:966` definiert eine EIGENE,
  ältere `getPlayerPortraitBrowserUrl` — ohne statischen Index, ohne Varianten; ihr
  API-Fallback greift nur bei `/Users/…`-Pfaden. Nach Aufrufern in der Datei suchen: wird sie
  benutzt, zeigt diese Ansicht für Spieler, deren Bild nur im statischen Index liegt, KEIN
  Portrait, während alle anderen Ansichten eines zeigen. Ist sie tot: als Aufräum-Befund melden.
  Danach: gezielt nach weiteren Schattenkopien suchen (`grep -rn "function getPlayerPortrait"`,
  `"/portraits/"`, `"/api/media/player-portrait"` außerhalb `mediaAssets.ts`).
- **PT2 — Deckungsmessung am Abbild:** über alle Spieler des aktiven Saves zählen, welcher Zweig
  der Kette greift (portraitUrl / portraitPath / statisch / Legacy-Map / API / **kein Bild**).
  Liste der „kein Bild"-Spieler ausgeben. Erwartung: der statische Index trägt die Mehrheit.
- **PT3 — Index frisch:** `npm run portraits:index` auf einer Kopie laufen lassen und
  `data/generated/portrait-files.json` gegen den Ist-Stand diffen — ein veralteter Index ist die
  einzige „Berechnung", die hier kippen kann. Ebenso: Schlüssel-Kollisionen (first-wins in
  `portraitFileByKey`) zählen — bei > 0 die betroffenen Dateinamen melden.
- **PT4 — Team-Logos gleiche Bauart:** dieselben drei Prüfungen für `getTeamLogoBrowserUrl`
  (`team-logos:index`), da identisches Muster.

---

## 8. Abschluss & Berichtsformat

Jeder Agent liefert:
1. **Messwerte** je Invariante (Zahl, Toleranz, bestanden/gefallen) mit Save-ID und
   Abbild-Zeitstempel — keine „sieht korrekt aus"-Sätze.
2. **Befunde** (Invariante gefallen) getrennt von **Auffälligkeiten** (schließt nicht, ist aber
   erklärbar) — Chris hat Auffälligkeiten ausdrücklich bestellt.
3. **Keine Reparaturen** ohne Rückmeldung; Reihenfolge-Empfehlung, falls ein Befund das
   Spielen heute Abend berührt (dann sofort eskalieren, nicht ans Ende des Berichts).

Bereits beim Planen gesehene Verdachtsmomente (an die zuständigen Agenten weiterreichen):
- **[P0] Fix-Commits nicht auf `main`** — heute Abend läuft der Server ohne sie (Abschnitt 0).
- **[Portraits] Schattenkopie** `use-foundation-shell-router-body-scope.tsx:966` (PT1).
- **[Finanzen] Zweitweg Gehalt** `season-guv-resolver.ts` `buildSalaryTotalByTeam` (rohes
  `entry.salary`) vs Abrechnungsweg (F1).
- **[Finanzen] dokumentierter Client-Nachbau** der Gebäude-Season-End-Rechnung (F3).
- **[Punkte] `standing.form`** wird weiterhin gelesen (`financeForm`, Sortier-Fallback), Schreiber
  unauffindbar (P-Auffälligkeit).
- **[Berechnungen] Längen-statt-Inhalt-Vergleich** in `preserveAppendOnlyArchive` (B2) und
  veraltete Kürzungs-Kommentare (`discipline-points-source.ts`).
