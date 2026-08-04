import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Team } from "@/lib/data/olyDataTypes";

// GETEILTER LIGA-SETUP-DRAFT: dieses Modul ist die EINZIGE Quelle fuer "wie befuellt sich eine
// frische Liga" (siehe lib/game/league-setup-draft-service.ts Kopfkommentar) — vorher gab es
// denselben ~70-Zeilen-Ablauf dreimal (fresh-season-1, "Neues Spiel"-Assistent) und NIRGENDS im
// Koop-Raum-Start (`startRoom`), was 31 von 32 Koop-Teams ohne Kader zurueckliess. Diese Tests
// decken beide Haelften ab: den Hintergrund-Kickoff (Teil A, von allen drei Aufrufern genutzt)
// und die Reparatur eines bereits bestehenden Saves mit leeren Kadern (Teil B).

const runAiPicksExecutePreview = vi.fn();

vi.mock("@/lib/ai/ai-picks-run-service", () => ({
  runAiPicksExecutePreview: (...args: unknown[]) => runAiPicksExecutePreview(...args),
}));

type FakeSave = { saveId: string; gameState: GameState };

function buildTeam(teamId: string): Team {
  return { teamId, shortCode: teamId, name: `Team ${teamId}` } as unknown as Team;
}

function buildGameState(overrides?: {
  teamIds?: string[];
  rosters?: Array<{ teamId: string; playerId: string }>;
  seasonId?: string;
  leagueSetupStatus?: "in_progress" | "ready" | "failed";
}): GameState {
  const teamIds = overrides?.teamIds ?? ["A-A", "B-B", "C-C"];
  return {
    season: { id: overrides?.seasonId ?? "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    teams: teamIds.map(buildTeam),
    rosters: overrides?.rosters ?? [],
    seasonState: {
      leagueSetupStatus: overrides?.leagueSetupStatus,
      teamControlSettings: {},
    },
  } as unknown as GameState;
}

function createFakePersistence(initialSaves: FakeSave[]) {
  const saves = new Map<string, FakeSave>(initialSaves.map((save) => [save.saveId, save]));
  const saveSingleplayerState = vi.fn((saveId: string, gameState: GameState) => {
    const updated = { saveId, gameState };
    saves.set(saveId, updated);
    return updated;
  });
  return {
    saves,
    saveSingleplayerState,
    getSaveById: vi.fn((saveId: string) => saves.get(saveId) ?? null),
  };
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("league-setup-draft-service", () => {
  beforeEach(() => {
    runAiPicksExecutePreview.mockReset();
  });

  describe("kickoffLeagueSetupDraft (Teil A: Hintergrund-Kickoff)", () => {
    it("marks the save in_progress synchronously and returns immediately (no await on the draft)", async () => {
      const { kickoffLeagueSetupDraft } = await import("@/lib/game/league-setup-draft-service");
      const persistence = createFakePersistence([{ saveId: "save-1", gameState: buildGameState() }]);
      // Der Draft selbst haengt an einem Promise, das erst spaeter aufgeloest wird — kickoff darf
      // trotzdem SOFORT zurueckkehren (detached, kein await), genau der Vertrag, der `startRoom`
      // vor ~40s Blockierung schuetzt.
      let resolveDraft: (() => void) | null = null;
      runAiPicksExecutePreview.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDraft = () => resolve({ teams: [] });
          }),
      );

      const returned = kickoffLeagueSetupDraft({ persistence: persistence as never, saveId: "save-1", logPrefix: "[test]" });

      expect(returned?.gameState.seasonState.leagueSetupStatus).toBe("in_progress");
      expect(persistence.saveSingleplayerState).toHaveBeenCalledWith(
        "save-1",
        expect.objectContaining({ seasonState: expect.objectContaining({ leagueSetupStatus: "in_progress" }) }),
      );
      // Die Funktion ist synchron zurueckgekehrt, OBWOHL der Draft noch haengt — resolveDraft wurde
      // zwar durch den mockImplementation-Aufruf bereits gesetzt, aber das umschliessende Promise
      // ist noch nicht aufgeloest.
      expect(resolveDraft).not.toBeNull();

      resolveDraft!();
      await flushMicrotasks();
    });

    it("excludes human-controlled teams from the writable scope (parity with the solo 'Neues Spiel' wizard)", async () => {
      const { kickoffLeagueSetupDraft } = await import("@/lib/game/league-setup-draft-service");
      const persistence = createFakePersistence([
        { saveId: "save-2", gameState: buildGameState({ teamIds: ["A-A", "B-B", "C-C", "D-D"] }) },
      ]);
      runAiPicksExecutePreview.mockResolvedValue({ teams: [] });

      kickoffLeagueSetupDraft({
        persistence: persistence as never,
        saveId: "save-2",
        excludeTeamIds: ["A-A", "B-B"],
        logPrefix: "[test]",
      });
      await flushMicrotasks();

      expect(runAiPicksExecutePreview).toHaveBeenCalledTimes(1);
      const [runParams] = runAiPicksExecutePreview.mock.calls[0]!;
      expect(runParams.callerWritableTeamIds).toEqual(["C-C", "D-D"]);
    });

    it("keeps callerWritableTeamIds null (no restriction) when excludeTeamIds is empty — fresh-season-1 has no human team yet", async () => {
      const { kickoffLeagueSetupDraft } = await import("@/lib/game/league-setup-draft-service");
      const persistence = createFakePersistence([{ saveId: "save-3", gameState: buildGameState() }]);
      runAiPicksExecutePreview.mockResolvedValue({ teams: [] });

      kickoffLeagueSetupDraft({ persistence: persistence as never, saveId: "save-3", logPrefix: "[test]" });
      await flushMicrotasks();

      const [runParams] = runAiPicksExecutePreview.mock.calls[0]!;
      expect(runParams.callerWritableTeamIds).toBeNull();
    });

    it("uses the reproducible saveId:seasonId:setup draftSeed schema, deriving seasonId from the save when omitted", async () => {
      const { kickoffLeagueSetupDraft } = await import("@/lib/game/league-setup-draft-service");
      const persistence = createFakePersistence([
        { saveId: "save-4", gameState: buildGameState({ seasonId: "season-7" }) },
      ]);
      runAiPicksExecutePreview.mockResolvedValue({ teams: [] });

      kickoffLeagueSetupDraft({ persistence: persistence as never, saveId: "save-4", logPrefix: "[test]" });
      await flushMicrotasks();

      const [runParams] = runAiPicksExecutePreview.mock.calls[0]!;
      expect(runParams).toMatchObject({ saveId: "save-4", seasonId: "season-7", draftSeed: "save-4:season-7:setup" });
    });

    it("flips leagueSetupStatus to ready with below-minimum warnings once the draft resolves", async () => {
      const { kickoffLeagueSetupDraft } = await import("@/lib/game/league-setup-draft-service");
      const persistence = createFakePersistence([{ saveId: "save-5", gameState: buildGameState() }]);
      runAiPicksExecutePreview.mockResolvedValue({
        teams: [
          { teamId: "A-A", teamName: "Team A-A", rosterAfter: 10, targetRosterMin: 8, blockingReasons: [] },
          { teamId: "B-B", teamName: "Team B-B", rosterAfter: 5, targetRosterMin: 8, blockingReasons: ["some_block"] },
        ],
      });

      kickoffLeagueSetupDraft({ persistence: persistence as never, saveId: "save-5", logPrefix: "[test]" });
      await flushMicrotasks();

      expect(persistence.saveSingleplayerState).toHaveBeenLastCalledWith(
        "save-5",
        expect.objectContaining({
          seasonState: expect.objectContaining({
            leagueSetupStatus: "ready",
            leagueSetupWarnings: [
              { teamId: "B-B", teamName: "Team B-B", rosterAfter: 5, targetMin: 8, status: "blocked" },
            ],
          }),
        }),
      );
    });

    it("flags the save failed (retryable) when the background draft throws", async () => {
      const { kickoffLeagueSetupDraft } = await import("@/lib/game/league-setup-draft-service");
      const persistence = createFakePersistence([{ saveId: "save-6", gameState: buildGameState() }]);
      runAiPicksExecutePreview.mockRejectedValue(new Error("boom"));

      kickoffLeagueSetupDraft({ persistence: persistence as never, saveId: "save-6", logPrefix: "[test]" });
      await flushMicrotasks();

      expect(persistence.saveSingleplayerState).toHaveBeenLastCalledWith(
        "save-6",
        expect.objectContaining({ seasonState: expect.objectContaining({ leagueSetupStatus: "failed" }) }),
      );
    });

    it("returns null and never calls the draft when the save cannot be resolved", async () => {
      const { kickoffLeagueSetupDraft } = await import("@/lib/game/league-setup-draft-service");
      const persistence = createFakePersistence([]);

      const returned = kickoffLeagueSetupDraft({ persistence: persistence as never, saveId: "missing", logPrefix: "[test]" });

      expect(returned).toBeNull();
      expect(runAiPicksExecutePreview).not.toHaveBeenCalled();
    });
  });

  describe("repairLeagueSetupEmptyRosters (Teil B: Reparatur bestehender Saves)", () => {
    it("is a no-op (does not call the draft, does not persist) when no team is empty", async () => {
      const { repairLeagueSetupEmptyRosters } = await import("@/lib/game/league-setup-draft-service");
      const persistence = createFakePersistence([
        {
          saveId: "save-full",
          gameState: buildGameState({
            teamIds: ["A-A", "B-B"],
            rosters: [
              { teamId: "A-A", playerId: "p1" },
              { teamId: "B-B", playerId: "p2" },
            ],
          }),
        },
      ]);

      const result = await repairLeagueSetupEmptyRosters({ persistence: persistence as never, saveId: "save-full" });

      expect(result.applied).toBe(false);
      expect(result.emptyTeamIds).toEqual([]);
      expect(runAiPicksExecutePreview).not.toHaveBeenCalled();
      expect(persistence.saveSingleplayerState).not.toHaveBeenCalled();
    });

    it("dry-run (default) previews the plan for empty teams only, WITHOUT persisting anything", async () => {
      const { repairLeagueSetupEmptyRosters } = await import("@/lib/game/league-setup-draft-service");
      // Genau der gemeldete Fall: EIN Team (P-S) hat einen Kader (auch wenn nur ein Spieler), der
      // Rest ist komplett leer.
      const persistence = createFakePersistence([
        {
          saveId: "save-broken",
          gameState: buildGameState({
            teamIds: ["P-S", "M-M", "A-A"],
            rosters: [{ teamId: "P-S", playerId: "p1" }],
          }),
        },
      ]);
      runAiPicksExecutePreview.mockResolvedValue({
        teams: [
          { teamId: "M-M", teamCode: "M-M", teamName: "Mayhem Mavericks", rosterBefore: 0, rosterAfter: 8, targetRosterMin: 8, plannedPicks: [{ status: "planned" }, { status: "planned" }] },
          { teamId: "A-A", teamCode: "A-A", teamName: "Armageddon Aftermath", rosterBefore: 0, rosterAfter: 9, targetRosterMin: 8, plannedPicks: [{ status: "planned" }] },
        ],
      });

      const result = await repairLeagueSetupEmptyRosters({ persistence: persistence as never, saveId: "save-broken", dryRun: true });

      expect(result.applied).toBe(false);
      expect(result.emptyTeamIds).toEqual(["M-M", "A-A"]);
      expect(result.teamsAlreadyFilled).toBe(1);
      expect(result.plan).toHaveLength(2);
      expect(result.plan[0]).toMatchObject({ teamId: "M-M", rosterBefore: 0, rosterAfter: 8, plannedPicks: 2 });

      // Der eigentliche Sicherheitsmechanismus: NUR die leeren Teams gehen in den Draft-Aufruf.
      const [runParams] = runAiPicksExecutePreview.mock.calls[0]!;
      expect(runParams).toMatchObject({ dryRun: true, teamIds: ["M-M", "A-A"], runMode: "season1_optimum_execute" });
      expect(runParams.confirmToken).toBeNull();
      expect(runParams.teamIds).not.toContain("P-S");

      // Nichts wurde gespeichert — reiner Trockenlauf.
      expect(persistence.saveSingleplayerState).not.toHaveBeenCalled();
    });

    it("apply (dryRun:false) drafts only the empty teams, marks the save ready and never touches the already-filled team", async () => {
      const { repairLeagueSetupEmptyRosters } = await import("@/lib/game/league-setup-draft-service");
      const persistence = createFakePersistence([
        {
          saveId: "save-broken-2",
          gameState: buildGameState({
            teamIds: ["P-S", "M-M"],
            rosters: [{ teamId: "P-S", playerId: "p1" }],
          }),
        },
      ]);
      runAiPicksExecutePreview.mockResolvedValue({
        teams: [
          { teamId: "M-M", teamCode: "M-M", teamName: "Mayhem Mavericks", rosterBefore: 0, rosterAfter: 8, targetRosterMin: 8, plannedPicks: [{ status: "applied" }] },
        ],
      });

      const result = await repairLeagueSetupEmptyRosters({ persistence: persistence as never, saveId: "save-broken-2", dryRun: false });

      expect(result.applied).toBe(true);
      expect(result.leagueSetupStatusAfter).toBe("ready");
      expect(result.warnings).toEqual([]);

      const [runParams] = runAiPicksExecutePreview.mock.calls[0]!;
      expect(runParams).toMatchObject({ dryRun: false, teamIds: ["M-M"], confirmToken: expect.any(String) });

      expect(persistence.saveSingleplayerState).toHaveBeenLastCalledWith(
        "save-broken-2",
        expect.objectContaining({
          seasonState: expect.objectContaining({ leagueSetupStatus: "ready", leagueSetupWarnings: [] }),
        }),
      );
    });

    it("is idempotent: a second apply call on the now-fully-filled save is a no-op", async () => {
      const { repairLeagueSetupEmptyRosters } = await import("@/lib/game/league-setup-draft-service");
      const persistence = createFakePersistence([
        {
          saveId: "save-repeat",
          gameState: buildGameState({
            teamIds: ["P-S", "M-M"],
            rosters: [
              { teamId: "P-S", playerId: "p1" },
              { teamId: "M-M", playerId: "p2" },
            ],
          }),
        },
      ]);

      const result = await repairLeagueSetupEmptyRosters({ persistence: persistence as never, saveId: "save-repeat", dryRun: false });

      expect(result.applied).toBe(false);
      expect(runAiPicksExecutePreview).not.toHaveBeenCalled();
    });
  });
});
