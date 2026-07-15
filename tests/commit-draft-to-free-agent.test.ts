import { describe, expect, it } from "vitest";

import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import type { GameState, PlayerGeneratorDraft } from "@/lib/data/olyDataTypes";
import { loadImportedPlayerStats } from "@/lib/data/playerStatsAdapter";
import { commitDraftAsFreeAgent } from "@/lib/player-generator/commit-draft-to-free-agent";
import { createDefaultPlayerGeneratorInput, generatePlayerDraft } from "@/lib/player-generator/player-generator-service";

const players = loadImportedPlayerStats();

function createTestGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [],
    teamIdentities: [],
    players,
    disciplines: foundationSeedDisciplines,
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-26T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 0,
      unmappedPlayers: [],
    },
    ...overrides,
  } as GameState;
}

/** A draft whose economy fields are fully populated (same params the
 * generator service's own test suite uses to prove marketValue/salary/ovr
 * come back non-null — see tests/player-generator-service.test.ts, "shows
 * draft economy projections..."). */
function buildCommittableDraft(seed: string): PlayerGeneratorDraft {
  return generatePlayerDraft({
    generatorInput: {
      ...createDefaultPlayerGeneratorInput(),
      preferredArchetype: "mage",
      contractMode: "front_loaded",
      seed,
    },
    players,
    disciplines: foundationSeedDisciplines,
  });
}

describe("commitDraftAsFreeAgent", () => {
  it("maps a committable draft to a valid free-agent Player and appends it to gameState.players", () => {
    const draft = buildCommittableDraft("commit-draft-basic");
    expect(draft.generated.diagnostics.saveStatus.commitReasons).toEqual([]);

    const gameState = createTestGameState();
    const result = commitDraftAsFreeAgent({ gameState, draft });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Valid Player: has the non-optional fields the draft itself doesn't
    // carry (Player requires `alignment`/`gender`, PlayerGeneratorDraft has
    // neither — see the commit-draft-to-free-agent.ts doc comment).
    expect(result.player.alignment).toBe("N");
    expect(result.player.gender).toBe("x");
    expect(typeof result.player.id).toBe("string");
    expect(result.player.id.length).toBeGreaterThan(0);
    expect(result.player.name).toBe(draft.generated.name);
    expect(result.player.className).toBe(draft.generated.className);
    expect(result.player.race).toBe(draft.generated.race);

    // Economy fields come straight from the draft's already-computed
    // values, never recomputed.
    expect(result.player.rating).toBeCloseTo(draft.generated.ovr as number, 5);
    expect(result.player.ovr).toBeCloseTo(draft.generated.ovr as number, 5);
    expect(result.player.marketValue).toBeCloseTo(draft.generated.marketValue as number, 5);
    expect(result.player.salaryDemand).toBeCloseTo(draft.generated.salary as number, 5);
    expect(result.player.potential).toBeCloseTo(draft.generated.potential as number, 5);
    expect(result.player.pps).toBe(draft.generated.pps);

    // coreStats/disciplineRatings seeded from the draft's axes/discipline data.
    expect(result.player.coreStats).toEqual(draft.generated.axes);
    expect(result.player.disciplineRatings).toEqual(draft.generated.disciplineRatings);
    expect(result.player.disciplineTierCounts.above20).toBe(
      Object.values(draft.generated.disciplineRatings).filter((value) => value > 20).length,
    );

    // Inserted into players, gameState otherwise untouched.
    expect(result.gameState.players).toHaveLength(gameState.players.length + 1);
    expect(result.gameState.players[result.gameState.players.length - 1]).toBe(result.player);
    expect(result.gameState.rosters).toBe(gameState.rosters);
    expect(result.gameState.teams).toBe(gameState.teams);
    // The input gameState itself must stay untouched (pure function, no
    // mutation of the caller's arrays/objects).
    expect(gameState.players).toHaveLength(players.length);
  });

  it("appears as a free agent (present in players, absent from rosters) exactly like the Transfermarkt free-agent derivation", () => {
    const draft = buildCommittableDraft("commit-draft-free-agent-pool");
    const gameState = createTestGameState();
    const result = commitDraftAsFreeAgent({ gameState, draft });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Mirrors the exact filter transfermarkt-local-service.ts uses to
    // derive the free-agent pool: players not referenced by any roster entry.
    const rosterPlayerIds = new Set(result.gameState.rosters.map((entry) => entry.playerId));
    const freeAgentIds = new Set(
      result.gameState.players.filter((player) => !rosterPlayerIds.has(player.id)).map((player) => player.id),
    );
    expect(freeAgentIds.has(result.playerId)).toBe(true);
  });

  it("generates a unique id per commit, even for the same draft committed twice in a row", () => {
    const draft = buildCommittableDraft("commit-draft-repeat");
    const first = commitDraftAsFreeAgent({ gameState: createTestGameState(), draft });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = commitDraftAsFreeAgent({ gameState: first.gameState, draft });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.playerId).not.toBe(first.playerId);
    expect(second.gameState.players).toHaveLength(first.gameState.players.length + 1);
  });

  it("blocks the commit when the draft has no usable market value", () => {
    const draft = buildCommittableDraft("commit-draft-blocked-mv");
    const brokenDraft: PlayerGeneratorDraft = {
      ...draft,
      generated: { ...draft.generated, marketValue: null },
    };

    const result = commitDraftAsFreeAgent({ gameState: createTestGameState(), draft: brokenDraft });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("draft_missing_market_value");
  });

  it("blocks the commit when the draft has no usable salary", () => {
    const draft = buildCommittableDraft("commit-draft-blocked-salary");
    const brokenDraft: PlayerGeneratorDraft = {
      ...draft,
      generated: { ...draft.generated, salary: null },
    };

    const result = commitDraftAsFreeAgent({ gameState: createTestGameState(), draft: brokenDraft });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("draft_missing_salary");
  });

  it("blocks the commit on a hard validation block (blocked_archetype_conflict)", () => {
    const draft = buildCommittableDraft("commit-draft-blocked-validation");
    const brokenDraft: PlayerGeneratorDraft = {
      ...draft,
      validationStatus: "blocked_archetype_conflict",
    };

    const result = commitDraftAsFreeAgent({ gameState: createTestGameState(), draft: brokenDraft });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("draft_validation_blocked");
  });
});
