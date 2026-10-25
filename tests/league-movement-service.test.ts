/**
 * TASK #158 — `league_movement`: 3-Auf-/3-Absteiger-Logik, Tie-Handling an der Grenze.
 *
 * Deckt `lib/season/league-movement-service.ts` ab: reine Funktionstests ohne Persistenz. Der
 * Saisonende-Integrationspfad (`runLocalSeasonCompletion`, Schritt `league_movement`) steht in
 * `tests/league-movement-season-completion-e2e.test.ts`.
 */
import { describe, expect, it } from "vitest";

import type { GameState, StandingRecord, Team } from "@/lib/data/olyDataTypes";
import { LEAGUE_SIZE, RELEGATION_COUNT, type LeagueTier } from "@/lib/season/league-split";
import { applyLeagueMovement, computeLeagueMovement } from "@/lib/season/league-movement-service";

function buildTeams(tier: LeagueTier, count: number, prefix: string): Team[] {
  return Array.from({ length: count }, (_, index) => ({
    teamId: `${prefix}${index + 1}`,
    shortCode: `${prefix}${index + 1}`,
    name: `${tier === "liga1" ? "Liga1" : "Liga2"} Team ${index + 1}`,
    budget: 100,
    cash: 100,
  })) as Team[];
}

/**
 * Baut einen Battle-Mode-GameState mit zwei vollen 16er-Ligen. `standingsByRank` ordnet jeder
 * Liga eine Liste von Team-IDs IN RANG-REIHENFOLGE zu (Index 0 = Rang 1) — die Punkte werden
 * daraus absteigend vergeben, sodass `rank` im `StandingRecord` dieselbe Reihenfolge ergibt.
 */
function buildTwoLeagueGameState(input: {
  liga1Order: string[];
  liga2Order: string[];
  /** Team-IDs, deren `StandingRecord.rank` bewusst `null` bleibt (simulierter block_on_tie-Fall). */
  nullRankTeamIds?: string[];
}): GameState {
  const liga1Teams = buildTeams("liga1", LEAGUE_SIZE, "L1-");
  const liga2Teams = buildTeams("liga2", LEAGUE_SIZE, "L2-");
  const teams = [...liga1Teams, ...liga2Teams];
  const leagueByTeamId: Record<string, LeagueTier> = {};
  for (const team of liga1Teams) leagueByTeamId[team.teamId] = "liga1";
  for (const team of liga2Teams) leagueByTeamId[team.teamId] = "liga2";

  const standings: Record<string, StandingRecord> = {};
  const nullRankTeamIds = new Set(input.nullRankTeamIds ?? []);
  for (const [order, tier] of [[input.liga1Order, "liga1"], [input.liga2Order, "liga2"]] as const) {
    order.forEach((teamId, index) => {
      const rank = index + 1;
      standings[teamId] = {
        points: order.length - index,
        rank: nullRankTeamIds.has(teamId) ? null : rank,
      };
    });
  }

  return {
    season: { id: "season-5", name: "Season 5", year: 5, matchdayIds: ["md-1"], currentMatchday: 1 },
    gamePhase: "season_review",
    matchdayState: { matchdayId: "md-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    players: [],
    rosters: [],
    disciplines: [],
    transferHistory: [],
    seasonState: {
      seasonId: "season-5",
      schedule: [],
      standings,
      leagueByTeamId,
    },
  } as unknown as GameState;
}

describe("computeLeagueMovement", () => {
  it("Manager-Mode/Legacy (kein leagueByTeamId): applicable=false, nichts wird vorgeschlagen", () => {
    const gameState = {
      season: { id: "s1" },
      teams: [],
      seasonState: {},
    } as unknown as GameState;
    const result = computeLeagueMovement(gameState);
    expect(result.applicable).toBe(false);
    expect(result.leagueByTeamId).toBeNull();
    expect(result.promoted).toEqual([]);
    expect(result.relegated).toEqual([]);
  });

  it("Liga-2-Rang 1-3 steigen auf, Liga-1-Rang 14-16 steigen ab — straight swap, RELEGATION_COUNT=3", () => {
    const liga1Order = Array.from({ length: LEAGUE_SIZE }, (_, i) => `L1-${i + 1}`);
    const liga2Order = Array.from({ length: LEAGUE_SIZE }, (_, i) => `L2-${i + 1}`);
    const gameState = buildTwoLeagueGameState({ liga1Order, liga2Order });

    const result = computeLeagueMovement(gameState);
    expect(result.applicable).toBe(true);
    expect(RELEGATION_COUNT).toBe(3);

    expect(result.promoted.map((t) => t.teamId)).toEqual(["L2-1", "L2-2", "L2-3"]);
    expect(result.promoted.every((t) => t.fromTier === "liga2" && t.toTier === "liga1")).toBe(true);
    expect(result.promoted.map((t) => t.finalRank)).toEqual([1, 2, 3]);

    expect(result.relegated.map((t) => t.teamId)).toEqual(["L1-14", "L1-15", "L1-16"]);
    expect(result.relegated.every((t) => t.fromTier === "liga1" && t.toTier === "liga2")).toBe(true);
    expect(result.relegated.map((t) => t.finalRank)).toEqual([14, 15, 16]);

    // Genau 6 Teams bewegt, alle anderen 26 bleiben wo sie waren.
    const movedIds = new Set([...result.promoted.map((t) => t.teamId), ...result.relegated.map((t) => t.teamId)]);
    expect(movedIds.size).toBe(6);

    const nextAssignment = result.leagueByTeamId!;
    for (const teamId of ["L2-1", "L2-2", "L2-3"]) expect(nextAssignment[teamId]).toBe("liga1");
    for (const teamId of ["L1-14", "L1-15", "L1-16"]) expect(nextAssignment[teamId]).toBe("liga2");
    // Unveraenderte Teams bleiben exakt in ihrer alten Liga.
    expect(nextAssignment["L1-1"]).toBe("liga1");
    expect(nextAssignment["L2-16"]).toBe("liga2");
    expect(Object.keys(nextAssignment)).toHaveLength(2 * LEAGUE_SIZE);
  });

  it("Tie-Handling an der Grenze: ein echter Gleichstand (block_on_tie liefert rank=null) wird trotzdem deterministisch nach Punkten/Verhaeltnis/Teamname aufgeloest", () => {
    const liga2Order = Array.from({ length: LEAGUE_SIZE }, (_, i) => `L2-${i + 1}`);
    const liga1Order = Array.from({ length: LEAGUE_SIZE }, (_, i) => `L1-${i + 1}`);
    // L1-14 und L1-15 sind in der ANZEIGE-Policy ein ungeloester Gleichstand (rank: null) --
    // `computeLeagueMovement` darf trotzdem nicht unentschieden bleiben.
    const gameState = buildTwoLeagueGameState({
      liga1Order,
      liga2Order,
      nullRankTeamIds: ["L1-14", "L1-15"],
    });
    // Beide Teams bekommen in den StandingRecords dieselben Punkte (echter Gleichstand) --
    // `buildTwoLeagueGameState` vergibt sie ueber den Index, hier manuell gleichziehen.
    gameState.seasonState.standings!["L1-15"] = { ...gameState.seasonState.standings!["L1-15"]!, points: gameState.seasonState.standings!["L1-14"]!.points };

    const result = computeLeagueMovement(gameState);
    expect(result.applicable).toBe(true);
    // Es werden trotzdem GENAU drei Absteiger bestimmt, keiner bleibt unentschieden.
    expect(result.relegated).toHaveLength(3);
    expect(result.relegated.map((t) => t.teamId).sort()).toEqual(["L1-14", "L1-15", "L1-16"].sort());
    // Kein Rang ist `NaN`/`null` -- die deterministische Sortierung (Teamname als letzter
    // Tiebreaker) hat eine eindeutige Reihenfolge erzeugt.
    for (const team of result.relegated) {
      expect(Number.isFinite(team.finalRank)).toBe(true);
    }
  });

  it("Promotion-/Relegation-Slots sind auf die tatsaechliche Ligagroesse geklemmt (keine Ueberraschung bei einer verkleinerten Liga)", () => {
    const liga1Order = Array.from({ length: LEAGUE_SIZE }, (_, i) => `L1-${i + 1}`);
    const liga2Order = ["L2-only-a", "L2-only-b"];
    const gameState = buildTwoLeagueGameState({ liga1Order, liga2Order });
    // Liga 2 künstlich auf 2 Teams verkleinert (Randfall, im Spiel heute nicht vorgesehen).
    gameState.teams = gameState.teams.filter(
      (team) => gameState.seasonState.leagueByTeamId![team.teamId] !== "liga2" || liga2Order.includes(team.teamId),
    );
    gameState.seasonState.leagueByTeamId = {
      ...Object.fromEntries(liga1Order.map((teamId) => [teamId, "liga1" as const])),
      ...Object.fromEntries(liga2Order.map((teamId) => [teamId, "liga2" as const])),
    };

    const result = computeLeagueMovement(gameState);
    expect(result.promoted).toHaveLength(2); // nicht 3 — Liga 2 hat nur 2 Teams.
    expect(result.warnings.some((warning) => warning.startsWith("liga2_team_count_unerwartet"))).toBe(true);
  });
});

describe("applyLeagueMovement", () => {
  it("schreibt die neue Zuordnung in seasonState.leagueByTeamId, laesst den Rest des GameState unveraendert", () => {
    const liga1Order = Array.from({ length: LEAGUE_SIZE }, (_, i) => `L1-${i + 1}`);
    const liga2Order = Array.from({ length: LEAGUE_SIZE }, (_, i) => `L2-${i + 1}`);
    const gameState = buildTwoLeagueGameState({ liga1Order, liga2Order });

    const { gameState: nextGameState, result } = applyLeagueMovement(gameState);
    expect(nextGameState.seasonState.leagueByTeamId).toEqual(result.leagueByTeamId);
    // Standings selbst (die Historie der ABGESCHLOSSENEN Saison) bleiben unberuehrt.
    expect(nextGameState.seasonState.standings).toBe(gameState.seasonState.standings);
    expect(nextGameState.teams).toBe(gameState.teams);
  });

  it("Manager-Mode: gibt den GameState unveraendert (selbe Referenz) zurueck", () => {
    const gameState = { season: { id: "s1" }, teams: [], seasonState: {} } as unknown as GameState;
    const { gameState: nextGameState, result } = applyLeagueMovement(gameState);
    expect(nextGameState).toBe(gameState);
    expect(result.applicable).toBe(false);
  });
});
