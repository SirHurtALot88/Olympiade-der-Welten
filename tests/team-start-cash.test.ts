import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildTeamStartCashSyncPlan,
  loadTeamStartCashReference,
  type TeamStartCashRow,
  type TeamStartCashTargetState,
} from "@/lib/season/team-start-cash";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import type { GameState, Team } from "@/lib/data/olyDataTypes";

function createReferenceRow(partial?: Partial<TeamStartCashRow>): TeamStartCashRow {
  return {
    teamCode: partial?.teamCode ?? "A-A",
    teamName: partial?.teamName ?? "Armageddon Aftermath",
    startCash: partial && "startCash" in partial ? partial.startCash ?? null : 175000,
    season: partial?.season ?? "season-1",
    sourceRow: partial?.sourceRow ?? 2,
    warnings: partial?.warnings ?? [],
  };
}

function createTeamState(partial?: Partial<TeamStartCashTargetState>): TeamStartCashTargetState {
  return {
    id: partial?.id ?? "tss-1",
    saveId: partial?.saveId ?? "save-initial",
    seasonId: partial?.seasonId ?? "season-1",
    teamId: partial?.teamId ?? "A-A",
    teamCode: partial?.teamCode ?? "A-A",
    teamName: partial?.teamName ?? "Armageddon Aftermath",
    currentCash: partial?.currentCash ?? 120000,
  };
}

function createGameState(team: Team): GameState {
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {
        [team.teamId]: {
          points: 0,
        },
      },
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [team],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

describe("team start cash loader", () => {
  it("loads 32 rows with unique team codes and numeric start cash values", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "team-start-cash-"));
    const csvPath = path.join(tempDir, "team-start-cash.csv");
    await fs.writeFile(
      csvPath,
      [
        "teamCode,teamName,startCash,season",
        ...Array.from({ length: 32 }, (_, index) => `T-${index + 1},Team ${index + 1},${100 + index},season-1`),
      ].join("\n"),
      "utf8",
    );

    const result = await loadTeamStartCashReference({
      csvPath,
      jsonPath: path.join(tempDir, "missing.json"),
    });

    expect(result.status).toBe("ok");
    expect(result.rows).toHaveLength(32);
    expect(new Set(result.rows.map((row) => row.teamCode)).size).toBe(32);
    expect(result.rows.every((row) => typeof row.startCash === "number" && !Number.isNaN(row.startCash))).toBe(true);
  });
});

describe("team start cash sync plan", () => {
  it("blocks when the reference does not cover all 32 teams", () => {
    const plan = buildTeamStartCashSyncPlan({
      referenceRows: [createReferenceRow()],
      teamStates: [createTeamState()],
      transfersTotal: 0,
    });

    expect(plan.canWrite).toBe(false);
    expect(plan.blockingReasons).toContain("expected_32_reference_rows_got:1");
    expect(plan.blockingReasons).toContain("expected_32_team_states_got:1");
  });

  it("reports missing or duplicate team codes as blocking errors", () => {
    const referenceRows = [
      createReferenceRow({ teamCode: "A-A", startCash: 100 }),
      createReferenceRow({ teamCode: "A-A", teamName: "Duplicate A-A", startCash: 120 }),
      createReferenceRow({ teamCode: "MISSING", teamName: "Missing Team", startCash: 130 }),
    ];
    const teamStates = [createTeamState()];

    const plan = buildTeamStartCashSyncPlan({
      referenceRows,
      teamStates,
      transfersTotal: 0,
    });

    expect(plan.blockingReasons).toContain("duplicate_reference_team_codes");
    expect(plan.blockingReasons).toContain("missing_teams_in_db");
    expect(plan.items.some((item) => item.status === "duplicate_reference")).toBe(true);
    expect(plan.items.some((item) => item.status === "missing_in_db")).toBe(true);
  });

  it("keeps dry-run non-mutating and returns planned changes", () => {
    const referenceRows = Array.from({ length: 32 }, (_, index) =>
      createReferenceRow({
        teamCode: `T-${index + 1}`,
        teamName: `Team ${index + 1}`,
        startCash: 100 + index,
      }),
    );
    const teamStates = Array.from({ length: 32 }, (_, index) =>
      createTeamState({
        id: `tss-${index + 1}`,
        teamId: `team-${index + 1}`,
        teamCode: `T-${index + 1}`,
        teamName: `Team ${index + 1}`,
        currentCash: 100 + index,
      }),
    );

    const plan = buildTeamStartCashSyncPlan({
      referenceRows,
      teamStates,
      transfersTotal: 0,
      dryRun: true,
    });

    expect(plan.dryRun).toBe(true);
    expect(plan.items).toHaveLength(32);
    expect(plan.items.every((item) => item.status === "matched")).toBe(true);
  });

  it("blocks when transfers exist or current cash already differs from start cash", () => {
    const referenceRows = Array.from({ length: 32 }, (_, index) =>
      createReferenceRow({
        teamCode: `T-${index + 1}`,
        teamName: `Team ${index + 1}`,
        startCash: 100 + index,
      }),
    );
    const teamStates = Array.from({ length: 32 }, (_, index) =>
      createTeamState({
        id: `tss-${index + 1}`,
        teamId: `team-${index + 1}`,
        teamCode: `T-${index + 1}`,
        teamName: `Team ${index + 1}`,
        currentCash: 50 + index,
      }),
    );

    const withTransfers = buildTeamStartCashSyncPlan({
      referenceRows,
      teamStates,
      transfersTotal: 2,
    });

    expect(withTransfers.canWrite).toBe(false);
    expect(withTransfers.blockingReasons).toContain("transfers_already_exist");
    expect(withTransfers.blockingReasons).toContain("active_season_already_mutated");
    expect(withTransfers.blockingReasons).toContain("current_cash_differs_from_start_cash");
  });

  it("blocks rows with invalid start cash", () => {
    const referenceRows = [createReferenceRow({ teamCode: "A-A", startCash: null })];
    const teamStates = [createTeamState()];

    const plan = buildTeamStartCashSyncPlan({
      referenceRows,
      teamStates,
      transfersTotal: 0,
    });

    expect(plan.blockingReasons).toContain("invalid_start_cash_rows");
    expect(plan.items.some((item) => item.status === "invalid_start_cash")).toBe(true);
  });
});

describe("season standings cash regression", () => {
  it("uses current local team cash ahead of a stale standings projection", () => {
    const team: Team = {
      teamId: "A-A",
      shortCode: "A-A",
      name: "Armageddon Aftermath",
      budget: 999999,
      cash: 123456,
      identityId: "A-A",
      humanControlled: true,
      rosterLimit: 12,
      logoPath: null,
    };

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState(team),
      standingsByTeamId: {
        "A-A": {
          rank: 1,
          points: 0,
          cash: 175000,
          budget: 225000,
        },
      },
    });

    expect(result[0]).toMatchObject({
      cash: 123456,
      budget: 225000,
      rosterCount: 0,
      salaryTotal: 0,
      avgContractLength: null,
    });
  });
});
