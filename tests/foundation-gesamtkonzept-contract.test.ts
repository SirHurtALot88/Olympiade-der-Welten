import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildGameFlowState } from "@/lib/foundation/game-flow-controller";
import type { GameState } from "@/lib/data/olyDataTypes";

const root = process.cwd();

function minimalMatchdayGameState(): GameState {
  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 2, matchdayIds: ["season-2-md-1", "season-2-md-2"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      matchdayResults: [{ id: "result-1", seasonId: "season-2", matchdayId: "season-2-md-1", appliedAt: "2026-01-01T00:00:00.000Z" }],
    },
    matchdayState: {
      matchdayId: "season-2-md-2",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [{ teamId: "M-M", shortCode: "M-M", name: "Mayhem", budget: 500, cash: 300, identityId: "M-M", humanControlled: true, rosterLimit: 12, logoPath: null }],
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
  } as GameState;
}

describe("foundation gesamtkonzept contract", () => {
  it("keeps transfer inbox gated to open transfer windows", () => {
    const inboxSource = readFileSync(join(root, "lib/foundation/game-inbox-service.ts"), "utf8");

    expect(inboxSource).toContain("transferWindowOpen && sellCandidate");
    expect(inboxSource).toContain("transferWindowOpen && rosterCount");
    expect(inboxSource).toContain("team_captain_missing");
    expect(inboxSource).toContain("getPrimaryInboxTask");
  });

  it("excludes mid-season transfer steps from matchday flow", () => {
    const flowControllerSource = readFileSync(join(root, "lib/foundation/game-flow-controller.ts"), "utf8");
    const crossTabFlowSource = readFileSync(join(root, "lib/foundation/tabs/use-foundation-cross-tab-game-flow.ts"), "utf8");

    expect(flowControllerSource).not.toContain('stepId: "matchday_buy_players"');
    expect(flowControllerSource).not.toContain('stepId: "matchday_sell_players"');
    expect(flowControllerSource).toContain('stepId: "matchday_facilities"');
    expect(crossTabFlowSource).toContain("resolveGameFlowActionStep");
    expect(crossTabFlowSource).not.toContain('gameFlowActionStep.stepId === "matchday_buy_players"');
  });

  it("builds matchday flow without mid-season buy/sell steps at runtime", () => {
    const gameState = minimalMatchdayGameState();
    const flow = buildGameFlowState({ gameState, activeTeamId: gameState.teams[0]?.teamId ?? null });
    const stepIds = flow.steps.map((step) => step.stepId);

    expect(stepIds).not.toContain("matchday_buy_players");
    expect(stepIds).not.toContain("matchday_sell_players");
    expect(stepIds).toContain("matchday_facilities");
    expect(stepIds).toContain("advance_to_next_matchday");
  });

  it("keeps bootstrap overlay, save retry helper and accessibility concept available", () => {
    const shellBodySource = readFileSync(join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
    const persistenceSource = readFileSync(join(root, "lib/foundation/tabs/use-foundation-persistence-actions.ts"), "utf8");

    expect(shellBodySource).toContain("foundation-bootstrap-overlay");
    expect(shellBodySource).toContain("Foundation laedt");
    expect(persistenceSource).toContain("foundationFetchWithRetry");
    expect(persistenceSource).toContain("loadPersistentState");
    expect(existsSync(join(root, "docs/ACCESSIBILITY_CONCEPT.md"))).toBe(true);
    expect(existsSync(join(root, "docs/season-flow-playtest.md"))).toBe(true);
  });

  it("keeps fetch slow warning wired to activity registry", () => {
    const activityRegistrySource = readFileSync(join(root, "lib/foundation/foundation-activity-registry.ts"), "utf8");
    const scopeSource = readFileSync(join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8");

    expect(activityRegistrySource).toContain("fetchSlowWarning");
    expect(scopeSource).toContain("fetchSlowWarning");
    expect(scopeSource).not.toContain('window.alert("Prisma/Supabase mode is read-only');
  });
});
