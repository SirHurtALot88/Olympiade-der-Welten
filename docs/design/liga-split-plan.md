# Umsetzungsplan: Zwei-Ligen-Split (2×16) + echter Spielplan mit Paarungen

Recherche-Stand: 2026-08-25, Repo `/home/user/Olympiade-der-Welten`, Branch-Stand `main` lokal. Alle Datei-/Funktionsangaben sind gegen den echten Code geprüft, nicht vermutet. Erarbeitet von Fable auf Basis der Entscheidungen, die Chris in der Sitzung vom 25.08. getroffen hat.

---

## 0. Wichtige Funde vorab (die Chris' Annahmen präzisieren oder ihnen widersprechen)

Diese Punkte stehen bewusst zuerst, weil sie Entscheidungen im Rest des Plans tragen:

1. **„M-M" und „R-R" sind keine Budget-Tier-Codes, sondern Team-Kürzel** (Mayhem Mavericks, Riptide Rivers). Die echten Startbudgets kommen aus `references/sheets/season-management.csv` (Spalte `Startbudget`), werden in `lib/data/dataAdapter.ts` → `loadSourceTeams()` (Z. 251–261) über die Season-Management-Zeilen in `team.budget`/`team.cash` gemappt. Sortiert man danach, ist **M-M mit 325 Rang 1 und R-R mit 170 Rang 32** — genau das prüft `buildStartRankByTeamId()` in `lib/game/new-game-setup-service.ts` (Z. 138–144, Warnungen `start_rank_reference_mismatch:M-M/R-R` in Z. 313–318) heute schon als Invariante. Chris' Satz „M-M wäre 1. Liga und R-R wäre 2. Liga" heißt also schlicht: **Budget-Startränge 1–16 → Liga 1, 17–32 → Liga 2** (Grenze: Startbudget ≥ 250 = Liga 1). Achtung als Falle: die `budget`-Werte in `data/source/teams.json` (970k–1590k, invers-alphabetisch) sind **nicht** die Spielbudgets — sie werden zur Laufzeit vom Sheet überschrieben.
2. **Es gibt heute gar keine echten Paarungen.** `SeasonState.schedule: Fixture[]` existiert (`lib/data/olyDataTypes.ts` Z. 2459–2465, mit `homeTeamId`/`awayTeamId`), wird aber von `buildSeasonFixtures()` in `lib/season/preseason-workflow-service.ts` (Z. 443–455) mit **einer Dummy-Paarung pro Spieltag** gefüllt (`teamIds[index % length]` gegen `teamIds[(index+1) % length]`). Konsumenten lesen daraus nur Spieltags-Metadaten. Der „Spielplan"-Tab (`app/foundation/ranks-v2/FoundationDiszisNewLook.tsx`) zeigt heute ausschließlich den **Disziplinen**-Plan (welche 2 Disziplinen an welchem Spieltag), keine Gegner.
3. **Gewertet wird als Rennen, nicht als Duell**: `buildLegacyMatchdayResolvePreview()` (`lib/resolve/legacy-matchday-resolve-engine.ts`) scored alle 32 Teams je Disziplin, rankt sie über `rankDescendingSharedTies` und übersetzt den Rang via `getRankToPointsValue(playerCount, rank)` in Teampunkte. Der Split macht daraus zwei 16er-Rennen — die **Formel bleibt identisch**, nur der Ranking-Pool wird die eigene Liga. Genau das löst den Architektur-Konflikt (Abschnitt 1).
4. **Nur 10 Spieltage, aber 15 nötige Runden für ein volles Round-Robin von 16 Teams.** Die Spieltagszahl hängt an den Disziplinen: 20 Disziplinen ÷ 2 pro Spieltag = 10 (`getRequiredSeasonDisciplineMatchdayCount`). „Keine doppelten Paarungen" ist erfüllbar (Runden 1–10 der Circle-Methode), aber **jedes Team verpasst pro Saison 5 der 15 möglichen Gegner**. Design-Entscheidung, die Chris kennen muss (→ Abschnitt 10.1).
5. **Chris' eigene Team-Presets liegen quer über beide künftigen Ligen**: `CHRIS_ONLINE_4V4_TEAM_IDS = ["P-S", "D-P", "M-M", "V-W"]` — P-S (6) und M-M (1) wären Liga 1, D-P (18) und V-W (30) Liga 2. **Ein Verbot „ein Mensch nur in einer Liga" würde bestehende Presets und Chris' realen Spielstand brechen.**
6. **Der Apron ist ein drittes globales 32er-System**, das in Chris' Entscheidungen nicht vorkommt: `computeApronLines()` zieht zwei Linien am **Median-Gehalt der ganzen Liga**. Bei getrennten Ligen mit unterschiedlichem Gehaltsniveau würde ein globaler Median Liga 1 strukturell bestrafen und Liga 2 subventionieren (→ Empfehlung 3.4, Rückfrage 10.4).
7. **Nicht jede „32" im Code ist eine Rang-32.** Viele Stellen meinen „Anzahl Teams im Save" (bleibt 32!). Umgestellt werden muss ausschließlich der **Rangraum** (Tabellenplätze, Leitern, Perzentile) — dafür klar benannte Konstanten `TEAM_COUNT_TOTAL = 32` vs. `LEAGUE_SIZE = 16` einführen.

---

## 1. Die Architektur-Entscheidung und warum sie den Konflikt auflöst

**Entschieden ist:** Zwei vollwertige Ligen à 16 Teams mit je eigener Tabelle, eigenem Rangraum 1–16 und eigener Sponsor-/Finanz-Basis; identische Formeln, aber liga-lokal ausgewertet; Paarungs-Spielplan pro Liga ohne Wiederholungen; 3 Auf-/Absteiger.

Der bisherige Konflikt: Scoring und Sponsoring setzen einen *gemeinsamen* 32er-Rangraum voraus, während ein Paarungssystem den Spieltag in Teilmengen zerlegt. Die Entscheidung löst das durch Verkleinerung des Bezugssystems statt Kompromiss: **die Liga (16 Teams) wird überall dort die Welt, wo heute „die 32" die Welt sind.** Rennen-Scoring bleibt strukturell unverändert (alle Teams *einer Liga* treten gemeinsam an), Sponsorleiter bleibt strukturell unverändert (Sockel nach Startrang, Topf nach Endrang — nur über 16 Sprossen), und die Paarung wird eine **zusätzliche Schicht obendrauf**, die die Punktformel nicht anfasst.

---

## 2. Datenmodell-Änderungen

### 2.1 Liga-Zugehörigkeit lebt am `SeasonState`, nicht am `Team`

**`seasonState.leagueByTeamId: Record<string, "liga1" | "liga2">`** — Liga-Zugehörigkeit ändert sich pro Saison (Auf-/Abstieg), ist also ein Saison-Fakt wie `standings`, nicht Team-Identität. Historie (Season-Snapshots) muss beantworten können „in welcher Liga spielte Team X in Saison 3?" — das kann nur ein Saison-Feld.

```ts
export type LeagueTier = "liga1" | "liga2";

export type SeasonState = {
  leagueByTeamId?: Record<string, LeagueTier>;   // fehlt bei Alt-Saisons → Legacy-32er-Modus
  leagueSplitMigrationVersion?: number;
};

export type Fixture = {
  id: string; homeTeamId: string; awayTeamId: string;
  matchdayId: string; status: "scheduled" | "resolved";
  leagueTier?: LeagueTier;
};
```

Neue zentrale Datei `lib/season/league-split.ts`: `LEAGUE_SIZE = 16`, `RELEGATION_COUNT = 3`, `getLeagueOf()`, `getLeagueTeamIds()`, `isLeagueSplitActive()` (der eine Schalter Legacy-32 vs. 2×16), `buildInitialLeagueAssignment()`.

### 2.2 Startränge und Standings werden liga-lokal
Betroffen: `new-game-setup-service.ts`, `preseason-workflow-service.ts` (`buildZeroStandings`), `lib/standings/standings-preview-engine.ts` + `standings-apply-service.ts`, `lib/resolve/legacy-matchday-resolve-engine.ts` (Ranking je Liga-Teilmenge), `lib/foundation/team-discipline-rank-engine.ts`.

### 2.3 Was bleibt global? (Empfehlung)
**Spieler-bezogene Perzentile/Heat-Bänder bleiben global über alle 32 Teams** (Transfermarkt ist einer, Spielerqualität ist absolut, Historienvergleichbarkeit). **Team-Rang-bezogene Anzeigen werden liga-lokal** (Saisonstand, Sponsor-Perzentile, Board-Ziele).

### 2.4 Mehrspieler (Empfehlung)
**Ja, ein Mensch darf Teams in beiden Ligen kontrollieren — keine Sperre.** Ist bereits Realität in den bestehenden Presets (auch Chris' eigenem Online-4v4-Preset); ein Verbot würde bestehende Saves brechen. Kein Kopf-an-Kopf-Ergebnis zum "verschenken" beim Rennen-Scoring, also geringes Missbrauchsrisiko. Einzige Ergänzung: im Season-Review transparent ausweisen, wenn zwei Teams derselben Person im Auf-/Abstiegsrennen stehen.

---

## 3. Sponsor-/Finanz-Separierung (Datei + Funktion)

Grundprinzip: **Formeln bleiben, Rangraum wird parametrisiert** — die Konstante 32 wird überall durch `LEAGUE_SIZE`/Leiterlänge ersetzt; Legacy-Saves mit eingefrorenen 32er-Leitern rechnen weiter korrekt 32er.

- **`sponsor-v3-model.ts`**: `SPONSOR_V3_RANKS = 32` aus allen Kernfunktionen lösen → Rangraum = Leiterlänge/Parameter. `sponsorV3StrengthClassOf` proportional auf 16 skalieren (1–5 stark, 6–11 mittel, 12–16 schwach).
- **`sponsor-liga-leiter.ts`**: `SPONSOR_LIGA_RANKS` parametrisieren. **`SPONSOR_WERTUNGSTOPF` muss je Liga halbiert werden**, sonst verdoppelt sich die Auszahlung pro Team. Offene Frage: Topf 50/50, gehaltsproportional, oder bewusst asymmetrisch (z. B. 60/40 Liga1/Liga2, damit Aufstieg sich finanziell lohnt)? → Chris-Entscheidung (10.3).
- **`sponsor-curve-shapes.ts`**: alle 11 Referenz-Arrays sind 32-lang, brauchen 16er-Pendants (mechanisch ableitbar, aber Flächennormierung neu testen).
- **`sponsor-v3-offer-service.ts`, `sponsor-team-quality-rank.ts`, `sponsor-rangmarke.ts`, `sponsor-tier-pool.ts`, `sponsor-leih-ziele.ts`, `sponsor-economy-calibration.ts`**: analoge Parametrisierung, Details im Volldokument.
- **Apron** (`apron-service.ts`): Empfehlung, pro Liga zu rechnen statt global (sonst dauerhafte Liga-1-Steuer durch globalen Gehalts-Median) — noch nicht von Chris bestätigt.
- **Board-Ziele, Titelrennen**: Rank-Ziele im 16er-Raum, Formeln unverändert.

---

## 4. Entwurf: Auf-/Abstiegs-Sponsor-Bonus/Malus („Zonen-Term")

Ein **Zonen-Aufschlag/-Abschlag direkt in der Basisleiter** (`sponsorLigaLeiter()`), keine neue Settlement-Buchung:

```ts
export const SPONSOR_ZONE_AUFSTIEG_BONUS = 6;   // Liga 2, Endränge 1..3
export const SPONSOR_ZONE_ABSTIEG_MALUS  = 6;   // Liga 1, Endränge 14..16

function zonenTerm(rank, tier, salaryFactor) {
  if (tier === "liga2" && rank <= 3) return  SPONSOR_ZONE_AUFSTIEG_BONUS * salaryFactor;
  if (tier === "liga1" && rank > 13) return -SPONSOR_ZONE_ABSTIEG_MALUS * salaryFactor;
  return 0;
}
```

Fließt **vor dem Einfrieren** in die Leiter ein (wie beim bestehenden `leihVerzicht`-Muster) — kein zweiter Rechenpfad, keine Drift. Der Anker absorbiert den Term automatisch korrekt (EV bleibt planbar), Monotonie bleibt erhalten. Dimensionierung ~6 C, skaliert mit Salary Factor — spürbar, aber kleiner als die Faktor-Schwankung. Bewusst **kein** Ziel-basierter Bonus (EV-neutrale Ziele sind im bestehenden Code nachweislich wirkungslos/frustrierend — Kommentar zu `festesZiel` in `sponsor-v3-model.ts`).

---

## 5. Fixture-/Spielplan-Generator

**Circle-Methode (Standard-Round-Robin) je Liga**, 16 Teams → 15 eindeutige Runden à 8 Paarungen; die Saison nutzt 10 davon (Runden `offset+1…offset+10`), Seed `${saveId}:${seasonId}:fixtures-v1:${leagueTier}` bestimmt Team-Permutation und Runden-Offset — über Saisons rotieren so auch die "verpassten" Gegner.

Neue Datei `lib/season/season-fixture-schedule.ts`. Verdrahtung: neues Spiel + Saisonwechsel (`buildSeasonFixtures()` ersetzen, **nach** Anwendung des Auf-/Abstiegs). **Wichtiger Fund**: drei Stellen interpretieren `schedule.length` heute als Spieltagszahl (`use-history-v2-derivations.ts`, `transfermarkt-local-service.ts`, `transfer-recap-service.ts`) — bricht bei 160 statt 10 Fixtures, muss auf `matchdayIds.length` umgestellt werden.

**Wichtig**: die Paarung ändert **keine Punkte** (Formel bleibt identisch, Chris-Vorgabe). Sie ist die Anzeige-/Erzähl-Schicht für den Spielplan-Tab; ob sie später auch spielwirksam werden soll (Duell-Bonus), ist offen (10.2).

Teststrategie: Eigenschaftstests (keine Doppel-Paarung, alle liga-intern, 160 Fixtures gesamt), Determinismus, Property-Sweep über alle 15 Offsets, E2E am Live-Abbild-Klon.

---

## 6. Spielplan-Tab-UI

Fehlende Daten: Gegner je Spieltag, dessen Liga-Tabellenrang (`standings[opponentId].rank`), dessen Team-Rang in den zwei Spieltags-Disziplinen (`buildTeamDisciplineRankRowsFromGameState()`, künftig liga-lokal). Betroffene Dateien: `use-foundation-cross-tab-discipline-ranks.ts`, `FoundationDiszisNewLook.tsx`, `foundation-nav-config.ts` (Tooltip), `SeasonStandingsNewLook.tsx` (zwei Tabellen mit Zonen-Markierung).

---

## 7. Saisonende-Logik für Auf-/Abstieg

Zwei Einbauorte: (1) **Feststellen** — neuer Schritt `league_movement` in `runSeasonCompletion()`, zwischen `snapshot` und `transition`, auf der bereits Form-Card-bereinigten Endtabelle (derselben, auf der Sponsor-Settlement abrechnet). (2) **Anwenden** — in `buildNextSeasonGameState()`: neue Liga-Zuordnung berechnen, dann liga-lokale Startplätze vergeben (Verbleiber nach altem Rang, Aufsteiger/Absteiger an den jeweiligen Rand der neuen Liga), erst danach Sponsorangebote/Fixtures der Folgesaison bauen.

---

## 8. Migration bestehender Spielstände (inkl. Live-Save)

**Kein Split mitten in einer laufenden Saison** — Split-Aktivierung am nächsten Saisonübergang. Legacy-Modus bleibt für alte Saisons/Snapshots dauerhaft lauffähig (`isLeagueSplitActive`-Schalter). Für Bestands-Saves (inkl. Live-Save) ist die saubere Zuordnung vermutlich der **sportliche Endrang der letzten Saison** statt Startbudget — Chris muss das bestätigen (10.5), sonst könnte der Live-Save M-M je nach Tabellenstand in die "falsche" Liga stecken.

Migrationsmarker `seasonState.leagueSplitMigrationVersion` nach bestehendem Muster (`sponsorLadderMigrationVersion`). **Test ausschließlich gegen eine frische Kopie des Live-Save-Abbilds**, nie gegen den Server (Standard-Workflow aus `CLAUDE.md`: Spiegel-Frische prüfen, `live-save`-Branch ziehen, `OLY_APP_SQLITE_PATH` auf die Kopie zeigen). Neues Skript `scripts/e2e-liga-split-am-save-abbild.ts` nach Vorbild von `scripts/e2e-saisonende-am-save-abbild.ts`.

---

## 9. Empfohlene Umsetzungsreihenfolge (8 PRs, jede hält `main` deploybar)

1. Fundament & Rangraum-Parametrisierung (kein Verhalten geändert, nur Konstanten → Parameter, Default 32).
2. Fixture-Generator + Datenmodell (noch nicht aktiv, nur unit-getestet).
3. Liga-lokales Scoring & Standings hinter dem `isLeagueSplitActive`-Schalter.
4. Sponsor-/Finanz-Separierung (16er-Kurvenformen, Töpfe je Liga, Apron je Liga).
5. Zonen-Term (Auf-/Abstiegs-Bonus/Malus) — nach PR 4, damit auf sauberen 16er-Töpfen kalibriert wird.
6. **Aktivierung**: neues Spiel + Saisonübergang + Auf-/Abstieg — ab hier entstehen echte Split-Saves.
7. UI (Spielplan-Tab, Saisonstand-Tabellen, Season-Review).
8. Migration Bestands-Saves + Live-Abbild-E2E — erst nach grünem Abbild-Lauf deployen.

---

## 10. Offene Fragen — Chris-Entscheidung nötig

1. **10 Spieltage ⇒ 5 von 15 möglichen Gegnern werden pro Saison verpasst** (rotiert über Saisons via Seed). Akzeptabel, oder sollen es 15 Spieltage werden (würde Disziplinen-Wiederholungen in einer Saison bedeuten)?
2. **Bedeutung der Paarung**: rein informativ/Anzeige (spricht für "Formel identisch"), oder soll das Duell später auch Punkte/Boni geben?
3. **Sponsor-Topfgröße je Liga**: 50/50, gehaltsproportional, oder bewusst asymmetrisch (z. B. 60/40), damit Aufstieg sich finanziell lohnt?
4. **Apron pro Liga rechnen** (empfohlen) — bestätigen?
5. **Zuordnungs-Kriterium für Bestands-Saves** (inkl. Live-Save): sportlicher Endrang der letzten Saison statt Startbudget?
6. **Mehrjahres-Sponsorverträge über einen Auf-/Abstieg hinweg**: Leiter beim Reroll auf neue Liga umbauen (Vorschlag), oder Ausstiegsklausel bei Abstieg?
7. **Punkte-Inflation vs. Historie**: Ränge 1–16 zahlen im Schnitt mehr Punkte als 1–32 — Ewige Tabelle/Rekorde nicht mehr 1:1 vergleichbar. Hinnehmen (Ära-Markierung) oder kalibrieren?
8. **"Meister"-Begriff**: zwei Liga-Sieger, aber ein Gesamt-Meister (Liga 1)? Zählt Liga-2-Platz-1 als "Titel" für Achievements?
9. **32er-kalibrierte Sponsor-Parameter** (Stärkeklassen-Wahrscheinlichkeiten, Anker-Sigma, Kurvenformen) übernehmen wir proportional — nach 1–2 Split-Saisons am Live-Abbild nachmessen, ok?
10. **KI-Schwellwerte** ("Top 8", "Rang ≤ 20" in diversen `lib/ai/`-Services) sind teils 32er-geeicht — eigener Sweep nötig, in dieser Recherche nicht vollständig erfasst.
11. **Multiplayer-Interessenkonflikt** (ein Mensch mit Teams in beiden Ligen im Auf-/Abstiegsrennen): empfohlen zuzulassen, aber bewusst abnicken.
12. Test-Voraussetzung: Spiegel muss frisch sein (`npx tsx scripts/pruefe-spiegel-frische.ts`), sonst ist die Migrationsverifikation gegen ein "totes" Abbild wertlos.

---

**Kern-Dateien für den Einstieg**: `lib/season/league-split.ts` (neu) · `lib/season/season-fixture-schedule.ts` (neu) · `lib/sponsor/sponsor-liga-leiter.ts` · `lib/sponsor/sponsor-v3-model.ts` · `lib/sponsor/sponsor-v3-offer-service.ts` · `lib/sponsor/sponsor-team-quality-rank.ts` · `lib/sponsor/sponsor-rangmarke.ts` · `lib/sponsor/sponsor-curve-shapes.ts` · `lib/resolve/legacy-matchday-resolve-engine.ts` · `lib/standings/standings-preview-engine.ts` + `standings-apply-service.ts` · `lib/season/preseason-workflow-service.ts` · `lib/season/season-completion-service.ts` · `lib/game/new-game-setup-service.ts` · `lib/foundation/team-discipline-rank-engine.ts` · `lib/foundation/tabs/use-foundation-cross-tab-discipline-ranks.ts` · `app/foundation/ranks-v2/FoundationDiszisNewLook.tsx` · `app/foundation/season-v2/SeasonStandingsNewLook.tsx` · `lib/persistence/save-repository.ts` · `lib/season/apron-service.ts` · `lib/board/team-season-objectives-service.ts`.
