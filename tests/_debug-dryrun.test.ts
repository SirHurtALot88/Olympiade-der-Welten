import { describe, it } from "vitest";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { runWholeSeasonDryRun } from "@/lib/season/whole-season-dryrun-service";
import type { PersistenceService } from "@/lib/persistence/types";

function createTestPersistence(gameState = createFreshSeasonOneGameState()) {
  const state = { gameState: structuredClone(gameState) };
  return {
    state,
    bootstrapSingleplayerSave() { return { save: { saveId: "test-save", name: "Test Save", status: "active" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", gameState: structuredClone(state.gameState) }, createdFromSeed: false }; },
    getActiveSave() { return { saveId: "test-save", name: "Test Save", status: "active" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", gameState: structuredClone(state.gameState) }; },
    getSaveById(saveId: string) { if (saveId !== "test-save") return null; return { saveId: "test-save", name: "Test Save", status: "active" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", gameState: structuredClone(state.gameState) }; },
    saveSingleplayerState(saveId: string, nextGameState: typeof gameState) { if (saveId !== "test-save") throw new Error(`Unknown save ${saveId}`); state.gameState = structuredClone(nextGameState); return this.getActiveSave()!; },
    createSave() { throw new Error("not needed"); },
    createFreshSeasonOneSave() { throw new Error("not needed"); },
    cloneSave() { throw new Error("not needed"); },
    activateSave(saveId: string) { return saveId === "test-save" ? this.getActiveSave() : null; },
    listSaves() { return [{ saveId: "test-save", name: "Test Save", status: "active" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]; },
  } as PersistenceService & { state: { gameState: typeof gameState } };
}

describe("debug", () => {
  it("shows matchday 1 blocking reason", async () => {
    const persistence = createTestPersistence();
    const current = persistence.getSaveById("test-save")!;
    
    let maxRequired = 0;
    for (const matchdayId of current.gameState.season.matchdayIds) {
      const scheduleEntry = current.gameState.seasonState.disciplineSchedule?.find(e => e.matchdayId === matchdayId);
      if (!scheduleEntry) throw new Error(`No schedule for ${matchdayId}`);
      const d1 = current.gameState.disciplines.find(e => e.id === scheduleEntry.discipline1?.disciplineId);
      const d2 = current.gameState.disciplines.find(e => e.id === scheduleEntry.discipline2?.disciplineId);
      const d1Count = scheduleEntry.discipline1?.playerCount ?? d1?.playerCount ?? 0;
      const d2Count = scheduleEntry.discipline2?.playerCount ?? d2?.playerCount ?? 0;
      maxRequired = Math.max(maxRequired, d1Count + d2Count);
    }
    console.log("maxRequired:", maxRequired);
    
    const nextGs = structuredClone(persistence.state.gameState);
    const usedPlayerIds = new Set(nextGs.rosters.map((e: any) => e.playerId));
    const freePlayers = nextGs.players.filter((p: any) => !usedPlayerIds.has(p.id));
    let poolIndex = 0, rosterCounter = nextGs.rosters.length;
    for (const team of nextGs.teams) {
      const teamRoster = nextGs.rosters.filter((e: any) => e.teamId === (team as any).teamId);
      const shortfall = Math.max(0, maxRequired - teamRoster.length);
      for (let i = 0; i < shortfall; i++) {
        const player = freePlayers[poolIndex++];
        if (!player) throw new Error("Not enough free players");
        nextGs.rosters.push({ id: `roster-${rosterCounter++}`, teamId: (team as any).teamId, playerId: (player as any).id, contractLength: 3, salary: Math.round((player as any).salaryDemand), upkeep: Math.round((player as any).salaryDemand), purchasePrice: Math.round((player as any).marketValue), currentValue: Math.round((player as any).marketValue), roleTag: "bench", joinedSeasonId: nextGs.season.id });
      }
    }
    nextGs.seasonState.teamControlSettings = Object.fromEntries(
      nextGs.teams.map((team: any) => [team.teamId, { teamId: team.teamId, controlMode: "ai" as const, aiLineupPreviewEnabled: true, aiLineupApplyEnabled: true, aiLineupAutoApplyEnabled: false, aiTransferPreviewEnabled: false, aiTransferAutoApplyEnabled: false, aiSellPreviewEnabled: false, aiSellAutoApplyEnabled: false, notes: null, strategyLock: null }])
    );
    persistence.saveSingleplayerState("test-save", nextGs);
    
    const result = await runWholeSeasonDryRun({ source: "sqlite", saveId: "test-save", seasonId: nextGs.season.id, maxMatchdays: 2, options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, stopOnMissingManualLineups: true, advanceAfterEachMatchday: true, includeMarketPhase: false } }, persistence);
    
    console.log("matchdays:", result.matchdays.length);
    console.log("blockedAt:", JSON.stringify(result.blockedAtMatchday));
    console.log("blockingReasons:", result.blockingReasons);
    console.log("matchday0 blockingReasons:", result.matchdays[0]?.blockingReasons);
    console.log("matchday0 status:", result.matchdays[0]?.status);
    for (const step of result.matchdays[0]?.steps ?? []) {
      if (step.blockingReasons.length > 0) {
        console.log("  STEP", step.key, "blocking:", step.blockingReasons);
      }
    }
  }, 60_000);
});
