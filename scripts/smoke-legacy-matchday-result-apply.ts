import {
  loadLocalLegacyLineupContext,
  saveLocalLegacyLineupDraft,
} from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupEntryInput, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  APPLY_CONFIRM_TOKEN,
  LegacyMatchdayResultApplyService,
} from "@/lib/resolve/legacy-matchday-result-apply-service";

type CandidateEntry = {
  activePlayerId: string;
  playerId: string;
  score: number;
};

function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) return [[]];
  if (items.length < count) return [];

  const result: T[][] = [];
  for (let index = 0; index <= items.length - count; index += 1) {
    const head = items[index];
    const tails = combinations(items.slice(index + 1), count - 1);
    for (const tail of tails) {
      result.push([head, ...tail]);
    }
  }
  return result;
}

function sumScores(entries: CandidateEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.score, 0);
}

function buildEntriesForSide(input: {
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  candidates: CandidateEntry[];
  withCaptain: boolean;
}): LegacyLineupEntryInput[] {
  return input.candidates.map((candidate, index) => ({
    disciplineId: input.disciplineId,
    disciplineSide: input.disciplineSide,
    slotIndex: index,
    playerId: candidate.playerId,
    activePlayerId: candidate.activePlayerId,
    isCaptain: input.withCaptain && index === 0,
  }));
}

function selectBestDisjointLineup(input: {
  d1PlayerCount: number;
  d2PlayerCount: number;
  d1Candidates: CandidateEntry[];
  d2Candidates: CandidateEntry[];
}) {
  const d1Combos = combinations(input.d1Candidates, input.d1PlayerCount);
  const d2Combos = combinations(input.d2Candidates, input.d2PlayerCount);

  let best:
    | {
        d1: CandidateEntry[];
        d2: CandidateEntry[];
        total: number;
      }
    | null = null;

  for (const d1 of d1Combos) {
    const usedIds = new Set(d1.map((entry) => entry.activePlayerId));
    for (const d2 of d2Combos) {
      if (d2.some((entry) => usedIds.has(entry.activePlayerId))) {
        continue;
      }
      const total = sumScores(d1) + sumScores(d2);
      if (!best || total > best.total) {
        best = { d1, d2, total };
      }
    }
  }

  return best;
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    execute: args.has("--execute"),
    forceReplace: args.has("--force"),
  };
}

async function main() {
  const args = parseArgs();
  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave()?.saveId ?? null;
  const smokeSave = persistence.createFreshSeasonOneSave({
    name: `Resolve Apply Smoke ${new Date().toLocaleString("de-DE")}`,
  });

  try {
    const baseParams = {
      saveId: smokeSave.saveId,
      seasonId: smokeSave.gameState.season.id,
      matchdayId: smokeSave.gameState.matchdayState.matchdayId,
    };
    const save = persistence.getSaveById(smokeSave.saveId) ?? smokeSave;
    const sampleContext = loadLocalLegacyLineupContext({
      ...baseParams,
      teamId: save.gameState.teams[0]!.teamId,
    });
    if (!sampleContext.ok) {
      throw new Error(`Smoke base context failed: ${sampleContext.errors.join(" | ")}`);
    }
    const requiredUniquePlayers =
      (sampleContext.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
      (sampleContext.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);

    if (requiredUniquePlayers > 0) {
      const usedPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
      const freePlayerPool = save.gameState.players.filter((player) => !usedPlayerIds.has(player.id));
      let poolIndex = 0;
      let rosterCounter = save.gameState.rosters.length;
      let changed = false;

      for (const team of save.gameState.teams) {
        const teamRoster = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
        const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);
        for (let index = 0; index < shortfall; index += 1) {
          const player = freePlayerPool[poolIndex];
          if (!player) {
            throw new Error("Smoke save could not be topped up with enough local players.");
          }
          poolIndex += 1;
          save.gameState.rosters.push({
            id: `smoke-roster-${rosterCounter}`,
            teamId: team.teamId,
            playerId: player.id,
            contractLength: 3,
            salary: Math.round(player.salaryDemand),
            upkeep: Math.round(player.salaryDemand),
            purchasePrice: Math.round(player.marketValue),
            currentValue: Math.round(player.marketValue),
            roleTag: "bench",
            joinedSeasonId: save.gameState.season.id,
          });
          changed = true;
          rosterCounter += 1;
        }
      }

      if (changed) {
        persistence.saveSingleplayerState(save.saveId, save.gameState);
      }
    }

    const liveSave = persistence.getSaveById(smokeSave.saveId) ?? smokeSave;
    for (const team of liveSave.gameState.teams) {
      const params: LegacyLineupKeyParams = {
        ...baseParams,
        teamId: team.teamId,
      };
      const contextResult = loadLocalLegacyLineupContext(params);
      if (!contextResult.ok) {
        throw new Error(`Local lineup context failed for ${team.teamId}: ${contextResult.errors.join(" | ")}`);
      }

      const { context } = contextResult;
      const d1 = context.matchdayContract?.discipline1;
      const d2 = context.matchdayContract?.discipline2;
      if (!d1 || !d2 || !d1.requiredPlayers || !d2.requiredPlayers) {
        throw new Error(`Matchday contract incomplete for ${team.teamId}.`);
      }

      const scoreMap = new Map(
        context.disciplineScores.map((score) => [`${score.playerId}::${score.disciplineId}`, score.score] as const),
      );
      const d1Candidates = context.activePlayers
        .map((player) => ({
          activePlayerId: player.id,
          playerId: player.playerId,
          score: scoreMap.get(`${player.playerId}::${d1.disciplineId}`),
        }))
        .filter((entry): entry is CandidateEntry => typeof entry.score === "number")
        .sort((left, right) => right.score - left.score);
      const d2Candidates = context.activePlayers
        .map((player) => ({
          activePlayerId: player.id,
          playerId: player.playerId,
          score: scoreMap.get(`${player.playerId}::${d2.disciplineId}`),
        }))
        .filter((entry): entry is CandidateEntry => typeof entry.score === "number")
        .sort((left, right) => right.score - left.score);

      const best = selectBestDisjointLineup({
        d1PlayerCount: d1.requiredPlayers,
        d2PlayerCount: d2.requiredPlayers,
        d1Candidates,
        d2Candidates,
      });

      if (!best) {
        throw new Error(`No valid lineup combo found for ${team.teamId}.`);
      }

      const entries = [
        ...buildEntriesForSide({
          disciplineId: d1.disciplineId,
          disciplineSide: "d1",
          candidates: best.d1,
          withCaptain: true,
        }),
        ...buildEntriesForSide({
          disciplineId: d2.disciplineId,
          disciplineSide: "d2",
          candidates: best.d2,
          withCaptain: false,
        }),
      ];

      const saveResult = saveLocalLegacyLineupDraft(params, entries);
      if (!saveResult.ok) {
        throw new Error(`Draft save failed for ${team.teamId}: ${saveResult.errors.join(" | ")}`);
      }
    }

    const service = new LegacyMatchdayResultApplyService();
    const dryRunResult = await service.applyLegacyMatchdayResult({
      ...baseParams,
      source: "sqlite",
    });

    if (!dryRunResult.ok) {
      throw new Error(`Dry run failed: ${dryRunResult.error}`);
    }

    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          saveId: smokeSave.saveId,
          seasonId: baseParams.seasonId,
          matchdayId: baseParams.matchdayId,
          previewStatus: dryRunResult.previewStatus,
          teamsTotal: dryRunResult.teamsTotal,
          resultsWritten: dryRunResult.resultsWritten,
          playerPerformancesWritten: dryRunResult.playerPerformancesWritten,
          highlightsWritten: dryRunResult.highlightsWritten,
          warningsCount: dryRunResult.warningsCount,
        },
        null,
        2,
      ),
    );

    if (!args.execute) {
      console.log("Dry run only. Re-run with --execute for local apply.");
      return;
    }

    const executeResult = await service.applyLegacyMatchdayResult({
      ...baseParams,
      source: "sqlite",
      execute: true,
      confirm: APPLY_CONFIRM_TOKEN,
      forceReplace: args.forceReplace,
    });

    if (!executeResult.ok) {
      throw new Error(`Execute failed: ${executeResult.error}`);
    }

    const saved = persistence.getSaveById(smokeSave.saveId);
    const seasonState = saved?.gameState.seasonState;
    const duplicateResult = await service.applyLegacyMatchdayResult({
      ...baseParams,
      source: "sqlite",
      execute: true,
      confirm: APPLY_CONFIRM_TOKEN,
    });

    console.log(
      JSON.stringify(
        {
          mode: "execute",
          applied: executeResult.applied,
          matchdayResultRows: seasonState?.matchdayResults?.length ?? 0,
          disciplineResultRows: seasonState?.disciplineResults?.length ?? 0,
          playerPerformanceRows: seasonState?.playerDisciplinePerformances?.length ?? 0,
          highlightRows: seasonState?.disciplineHighlights?.length ?? 0,
          auditLogRows: seasonState?.resultAuditLogs?.length ?? 0,
          duplicateBlocked: !duplicateResult.ok,
        },
        null,
        2,
      ),
    );
  } finally {
    if (previousActiveSave) {
      persistence.activateSave(previousActiveSave);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
