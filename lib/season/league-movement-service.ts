/**
 * LEAGUE_MOVEMENT — Auf-/Abstieg zwischen den beiden 16er-Ligen (Task #158).
 *
 * Chris' Antworten vom 18.10. auf Task #161 (`docs/design/liga-split-plan.md`, Abschnitt 10,
 * Fragen 10.3/10.4/10.6/10.8) haben die Finanzfragen geklärt, die diesen Schritt bis dahin
 * blockierten (siehe `docs/design/auf-abstieg-konzept-vorbereitung-17-10-2026.md`). Dieser Schritt
 * setzt NUR den mechanischen Rahmen um, der dort bereits als entschieden/gebaut dokumentiert ist:
 *
 *   - 3 Auf-/Absteiger je Saisonübergang (`RELEGATION_COUNT`, `lib/season/league-split.ts`).
 *   - Liga-2-Rang 1..RELEGATION_COUNT steigt auf, Liga-1-Rang (LEAGUE_SIZE-RELEGATION_COUNT+1)..
 *     LEAGUE_SIZE steigt ab — ein einfacher Tausch, keine Relegations-/Playoff-Variante (diese
 *     Lesart war am 17.10. noch nicht ausdrücklich bestätigt, s. Vorbereitungsdokument Abschnitt 1,
 *     ist aber Teil des Task-158-Auftrags vom 18.10. als "confirmed default").
 *   - Endrang = Punkte, dann Punkteverhältnis als Tiebreaker (bereits gebaut, s.
 *     `lib/standings/saisonstand-punkte-nachbuchung.ts`).
 *
 * TIE-HANDLING AN DER GRENZE: `seasonState.standings[teamId].rank` (die Anzeige-Tabelle) vergibt
 * bei einem ECHTEN, über Punkte/Verhältnis/totalScore nicht auflösbaren Gleichstand bewusst `null`
 * (Policy `block_on_tie`, `lib/standings/standings-tiebreaker-policy.ts`) — richtig für eine
 * Anzeige, die eine Bestätigung verlangt, aber Auf-/Abstieg braucht eine EINDEUTIGE Entscheidung,
 * keine offene Anzeige. Dieser Schritt baut deshalb seine eigene, nie-`null`-Rangfolge mit
 * `resolveProjectedRankWithTiePolicy(..., "deterministic_sort")` — demselben Kriterien-Pfad
 * (Punkte → Verhältnis → totalScore → Spieltag-/Ausgangsrang → Teamname als letzter, immer
 * eindeutiger Tiebreaker), nur ohne den Abbruch bei einem echten Gleichstand.
 *
 * NUR BATTLE-MODE: `isLeagueSplitActive(gameState)` muss `true` sein (`leagueByTeamId` gesetzt und
 * nicht leer) — jeder Manager-Mode-/Legacy-Save liefert `applicable: false` und bleibt unangetastet.
 */
import type { GameState, LeagueMovementLogRecord, Team } from "@/lib/data/olyDataTypes";
import { randomUUID } from "@/lib/utils/random-id";
import { LEAGUE_SIZE, RELEGATION_COUNT, getLeagueTeamIds, isLeagueSplitActive, type LeagueTier } from "@/lib/season/league-split";
import { resolveProjectedRankWithTiePolicy, type StandingsTieBreakItem } from "@/lib/standings/standings-tiebreaker-policy";

export type LeagueMovementTeamChange = {
  teamId: string;
  teamName: string;
  fromTier: LeagueTier;
  toTier: LeagueTier;
  /** Finaler, NIE-`null`-Rang innerhalb der ALTEN Liga (1..Liga-Größe), deterministisch tiebreak-aufgelöst. */
  finalRank: number;
};

export type LeagueMovementResult = {
  /** `false` für Manager-Mode/Legacy-Saves ohne aktiven Liga-Split — dann ist alles andere unten leer/null. */
  applicable: boolean;
  /** Die NEUE `leagueByTeamId`-Zuordnung, bereit zum Persistieren — `null`, wenn `applicable === false`. */
  leagueByTeamId: Record<string, LeagueTier> | null;
  /** Liga 2 → Liga 1, sortiert nach `finalRank` aufsteigend. */
  promoted: LeagueMovementTeamChange[];
  /** Liga 1 → Liga 2, sortiert nach `finalRank` aufsteigend. */
  relegated: LeagueMovementTeamChange[];
  warnings: string[];
};

type RankedTeam = { teamId: string; teamName: string; rank: number };

/**
 * Die Teams EINER Liga, deterministisch 1..N geordnet — nie `null`, siehe Dateikopf.
 */
function buildTierRankedTeams(gameState: GameState, tier: LeagueTier): RankedTeam[] {
  const teamIds = getLeagueTeamIds(gameState, tier);
  const standings = gameState.seasonState.standings ?? {};
  const teamNameById = new Map((gameState.teams ?? []).map((team: Team) => [team.teamId, team.name] as const));

  const items: StandingsTieBreakItem[] = teamIds.map((teamId) => {
    const standing = standings[teamId];
    return {
      teamId,
      teamName: teamNameById.get(teamId) ?? teamId,
      totalScore: null,
      // `?? 0` statt `null`: "deterministic_sort" filtert Items mit `projectedPoints == null`
      // komplett heraus (siehe standings-tiebreaker-policy.ts) — ein Team OHNE Punktezeile soll
      // trotzdem einen (dann schlechtesten) Rang bekommen, nicht aus der Auf-/Abstiegsrechnung
      // verschwinden.
      projectedPoints: standing?.points ?? 0,
      currentRank: standing?.rank ?? null,
      currentPoints: standing?.points ?? null,
      matchdayRank: null,
      cash: null,
      verhaeltnis: standing?.verhaeltnis ?? null,
    };
  });

  const rankByTeamId = resolveProjectedRankWithTiePolicy(items, "deterministic_sort");
  return items
    .map((item) => ({
      teamId: item.teamId,
      teamName: item.teamName,
      rank: rankByTeamId.get(item.teamId) ?? Number.POSITIVE_INFINITY,
    }))
    .sort((left, right) => left.rank - right.rank);
}

/**
 * Berechnet die neue Liga-Zuordnung — reine Funktion, schreibt nichts. `applyLeagueMovement`
 * unten übernimmt das Schreiben in `seasonState.leagueByTeamId`.
 */
export function computeLeagueMovement(gameState: GameState): LeagueMovementResult {
  if (!isLeagueSplitActive(gameState)) {
    return { applicable: false, leagueByTeamId: null, promoted: [], relegated: [], warnings: [] };
  }

  const warnings: string[] = [];
  const liga1 = buildTierRankedTeams(gameState, "liga1");
  const liga2 = buildTierRankedTeams(gameState, "liga2");

  if (liga1.length !== LEAGUE_SIZE) warnings.push(`liga1_team_count_unerwartet:${liga1.length}`);
  if (liga2.length !== LEAGUE_SIZE) warnings.push(`liga2_team_count_unerwartet:${liga2.length}`);

  // Geklemmt auf die tatsächliche Ligagröße — eine (im Spiel heute nicht vorgesehene) verkleinerte
  // Liga bekäme sonst mehr Auf-/Absteiger als sie Plätze hat.
  const promotionSlots = Math.min(RELEGATION_COUNT, liga2.length);
  const relegationSlots = Math.min(RELEGATION_COUNT, liga1.length);

  const promotedTeams = liga2.slice(0, promotionSlots);
  const relegatedTeams = liga1.slice(liga1.length - relegationSlots);

  const promoted: LeagueMovementTeamChange[] = promotedTeams.map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    fromTier: "liga2" as const,
    toTier: "liga1" as const,
    finalRank: team.rank,
  }));
  const relegated: LeagueMovementTeamChange[] = relegatedTeams.map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    fromTier: "liga1" as const,
    toTier: "liga2" as const,
    finalRank: team.rank,
  }));

  const leagueByTeamId: Record<string, LeagueTier> = { ...(gameState.seasonState.leagueByTeamId ?? {}) };
  for (const team of promoted) leagueByTeamId[team.teamId] = "liga1";
  for (const team of relegated) leagueByTeamId[team.teamId] = "liga2";

  return { applicable: true, leagueByTeamId, promoted, relegated, warnings };
}

/**
 * Wendet `computeLeagueMovement` an: schreibt die neue Zuordnung in `seasonState.leagueByTeamId`
 * der ABGESCHLOSSENEN Saison. Alles danach — Sponsorverträge, Apron, der Spielplan der nächsten
 * Saison (`preseason-workflow-service.ts`) — liest dieses Feld frisch aus dem persistierten Save
 * und sieht damit automatisch die neue Liga, ohne einen zweiten Übergabe-Pfad.
 *
 * NICHT idempotenz-gesichert — dafuer gibt es `applyLeagueMovementOnce` weiter unten, das beide
 * Saisonende-Wege benutzen.
 */
export function applyLeagueMovement(gameState: GameState): { gameState: GameState; result: LeagueMovementResult } {
  const result = computeLeagueMovement(gameState);
  if (!result.applicable || !result.leagueByTeamId) {
    return { gameState, result };
  }
  return {
    gameState: {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        leagueByTeamId: result.leagueByTeamId,
      },
    },
    result,
  };
}

/** Der Idempotenz-Eintrag dieser Saison — `null`, wenn der Auf-/Abstieg fuer sie noch nicht lief. */
export function findLeagueMovementLog(gameState: GameState, seasonId: string): LeagueMovementLogRecord | null {
  return (gameState.seasonState.leagueMovementLogs ?? []).find((log) => log.seasonId === seasonId) ?? null;
}

export type LeagueMovementOnceResult = {
  /** Der Zustand NACH dem Schritt — bei `applied === false` exakt das uebergebene Objekt (gleiche Referenz). */
  gameState: GameState;
  result: LeagueMovementResult;
  applied: boolean;
  /** `true`, wenn fuer `seasonId` schon ein `leagueMovementLogs`-Eintrag lag. */
  alreadyDone: boolean;
  logRecord: LeagueMovementLogRecord | null;
};

/**
 * AUF-/ABSTIEG GENAU EINMAL JE SAISON — Bewegung UND Idempotenz-Eintrag in einem Zug.
 *
 * Es gibt zwei Wege ans Saisonende (siehe `season-end-tail-settlement.ts`): den Cockpit-Lauf
 * (`runLocalSeasonCompletion`) und die Saisonende-Seite (Abrechnung buchen → Verkäufe & Verträge →
 * Neue Saison starten). Nur der erste kannte den Schritt `league_movement`; wer über die
 * Saisonende-Seite spielte, startete die neue Saison mit der ALTEN Liga-Zuordnung — kein Team stieg
 * auf oder ab, und damit rollten auch die Sponsorverträge (`advanceSponsorContractsForNewSeason`)
 * und die neuen Angebote (`regenerateSponsorOffersForSeason`) gegen die alte Liga.
 *
 * Beide Wege rufen deshalb diese eine Funktion: der Cockpit-Lauf im Schritt `league_movement`, der
 * Saisonwechsel (`preseason-workflow-service.ts`, `next_season_setup`) als letzte Station vor dem
 * Bau der neuen Saison. Wer zuerst kommt, bewegt; der zweite findet den Log-Eintrag und tut nichts.
 *
 * Ohne aktiven Liga-Split (jeder Manager-Mode-/Legacy-Save) gibt die Funktion den uebergebenen
 * Zustand UNVERAENDERT (dieselbe Referenz) zurueck — kein Feld, kein Log, bit-identisch.
 *
 * Reine Funktion: schreibt nichts, das Persistieren bleibt beim Aufrufer.
 */
export function applyLeagueMovementOnce(
  gameState: GameState,
  input: { saveId: string; seasonId: string; createdAt?: string; logId?: string },
): LeagueMovementOnceResult {
  if (!isLeagueSplitActive(gameState)) {
    return {
      gameState,
      result: { applicable: false, leagueByTeamId: null, promoted: [], relegated: [], warnings: [] },
      applied: false,
      alreadyDone: false,
      logRecord: null,
    };
  }
  const existing = findLeagueMovementLog(gameState, input.seasonId);
  if (existing) {
    return { gameState, result: computeLeagueMovement(gameState), applied: false, alreadyDone: true, logRecord: existing };
  }
  const { gameState: movedGameState, result } = applyLeagueMovement(gameState);
  if (!result.applicable) {
    return { gameState, result, applied: false, alreadyDone: false, logRecord: null };
  }
  const logRecord: LeagueMovementLogRecord = {
    id: input.logId ?? `league-movement:${input.seasonId}:${randomUUID()}`,
    saveId: input.saveId,
    seasonId: input.seasonId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    promotedTeamIds: result.promoted.map((team) => team.teamId),
    relegatedTeamIds: result.relegated.map((team) => team.teamId),
  };
  return {
    gameState: {
      ...movedGameState,
      seasonState: {
        ...movedGameState.seasonState,
        leagueMovementLogs: [logRecord, ...(movedGameState.seasonState.leagueMovementLogs ?? [])],
      },
    },
    result,
    applied: true,
    alreadyDone: false,
    logRecord,
  };
}
