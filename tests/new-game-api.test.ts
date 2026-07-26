import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

// Regression test for the "fresh SOLO new game never drafts AI rosters" bug: the
// "Neues Spiel erstellen" wizard (app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx,
// data-testid="new-game-setup-wizard") posts to THIS route with dryRun:false. Unlike the
// `fresh-season-1` quick-action (app/api/singleplayer-state/route.ts), this route used to return
// immediately after `applyNewGameSetup` without ever kicking off the whole-league AI draft — every
// AI team's roster stayed empty forever (no automatic or reachable trigger populated them). The fix
// mirrors app/api/singleplayer-state/route.ts's `fresh-season-1` background-draft pattern here.

const applyNewGameSetup = vi.fn();
const previewNewGameSetup = vi.fn();

vi.mock("@/lib/game/new-game-setup-service", () => ({
  applyNewGameSetup: (...args: unknown[]) => applyNewGameSetup(...args),
  previewNewGameSetup: (...args: unknown[]) => previewNewGameSetup(...args),
}));

const runAiPicksExecutePreview = vi.fn();

vi.mock("@/lib/ai/ai-picks-run-service", () => ({
  runAiPicksExecutePreview: (...args: unknown[]) => runAiPicksExecutePreview(...args),
}));

vi.mock("@/lib/auth/config", () => ({
  isAuthEnabled: () => false,
}));

type FakeSave = { saveId: string; gameState: GameState };

const persistenceState = { saves: new Map<string, FakeSave>() };

const saveSingleplayerState = vi.fn((saveId: string, gameState: GameState) => {
  const updated = { saveId, gameState };
  persistenceState.saves.set(saveId, updated);
  return updated;
});

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: (saveId: string) => persistenceState.saves.get(saveId) ?? null,
    saveSingleplayerState,
  }),
}));

function buildFakeGameState(overrides?: Partial<GameState["seasonState"]>): GameState {
  return {
    seasonState: {
      leagueSetupStatus: undefined,
      teamControlSettings: {},
      ...overrides,
    },
  } as unknown as GameState;
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("new-game api", () => {
  beforeEach(() => {
    applyNewGameSetup.mockReset();
    previewNewGameSetup.mockReset();
    runAiPicksExecutePreview.mockReset();
    saveSingleplayerState.mockClear();
    persistenceState.saves.clear();
  });

  it("kicks off the whole-league AI draft in the background after creating a fresh solo save", async () => {
    const saveId = "new-game-test-1";
    persistenceState.saves.set(saveId, { saveId, gameState: buildFakeGameState() });
    applyNewGameSetup.mockReturnValue({
      mode: "applied",
      save: { saveId, name: "Solo Save" },
      previousActiveSaveId: null,
      preview: {
        mode: "applied",
        presetId: "solo_1",
        seasonSetup: { seasonId: "season-1" },
        chrisTeamIds: ["M-M"],
        frankyTeamIds: [],
        aiTeamIds: ["A-A", "Z-H"],
      },
    });
    runAiPicksExecutePreview.mockResolvedValue({
      teams: [
        { teamId: "A-A", teamName: "A-A", rosterAfter: 10, targetRosterMin: 8, blockingReasons: [] },
      ],
    });

    const { POST } = await import("@/app/api/new-game/route");

    const response = await POST(
      new Request("http://localhost:3000/api/new-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: "solo_1", dryRun: false, confirmToken: "token-1" }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { result?: { save: { saveId: string } } };
    expect(payload.result?.save.saveId).toBe(saveId);

    // The HTTP response must not block on the draft: it should already have returned before the
    // detached draft call resolves, and the save must be flagged "in_progress" synchronously.
    expect(saveSingleplayerState).toHaveBeenCalledWith(
      saveId,
      expect.objectContaining({ seasonState: expect.objectContaining({ leagueSetupStatus: "in_progress" }) }),
    );

    await flushMicrotasks();

    expect(runAiPicksExecutePreview).toHaveBeenCalledTimes(1);
    const [runParams] = runAiPicksExecutePreview.mock.calls[0]!;
    expect(runParams).toMatchObject({
      saveId,
      seasonId: "season-1",
      dryRun: false,
      teamScope: "all",
      allowSetupAllTeams: true,
    });
    // Regression: the whole-league setup draft must NOT fill the player's own team. The human team
    // (Chris's "M-M") must be excluded from the writable scope so its roster stays empty for manual
    // drafting; only the AI teams are draftable.
    expect(runParams.callerWritableTeamIds).toEqual(["A-A", "Z-H"]);
    expect(runParams.callerWritableTeamIds).not.toContain("M-M");

    expect(saveSingleplayerState).toHaveBeenLastCalledWith(
      saveId,
      expect.objectContaining({ seasonState: expect.objectContaining({ leagueSetupStatus: "ready" }) }),
    );
  });

  it("flags the save as failed (retryable) when the background draft throws", async () => {
    const saveId = "new-game-test-2";
    persistenceState.saves.set(saveId, { saveId, gameState: buildFakeGameState() });
    applyNewGameSetup.mockReturnValue({
      mode: "applied",
      save: { saveId, name: "Solo Save" },
      previousActiveSaveId: null,
      preview: { seasonSetup: { seasonId: "season-1" }, chrisTeamIds: ["M-M"], frankyTeamIds: [], aiTeamIds: ["A-A", "Z-H"] },
    });
    runAiPicksExecutePreview.mockRejectedValue(new Error("boom"));

    const { POST } = await import("@/app/api/new-game/route");
    await POST(
      new Request("http://localhost:3000/api/new-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: "solo_1", dryRun: false, confirmToken: "token-1" }),
      }),
    );

    await flushMicrotasks();

    expect(saveSingleplayerState).toHaveBeenLastCalledWith(
      saveId,
      expect.objectContaining({ seasonState: expect.objectContaining({ leagueSetupStatus: "failed" }) }),
    );
  });
});
