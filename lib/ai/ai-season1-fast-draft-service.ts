import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  flushLocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";

type Axis = "pow" | "spe" | "men" | "soc";

export type AiSeason1FastDraftResult = {
  status: "completed" | "partial" | "skipped";
  seasonId: string;
  aiTeamsTotal: number;
  aiTeamsCompleted: number;
  transferBuysApplied: number;
  warnings: string[];
  blockingReasons: string[];
  durationMs: number;
  teamResults: Array<{
    teamId: string;
    teamCode: string;
    rosterBefore: number;
    rosterAfter: number;
    targetRoster: number;
    buysApplied: number;
    cashAfter: number;
    blockingReasons: string[];
  }>;
};

type Candidate = {
  player: Player;
  marketValue: number;
  salary: number;
  axis: Axis;
  axisValue: number;
  average: number;
  potential: number;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function getAxisValue(player: Player, axis: Axis) {
  return player.coreStats[axis] ?? 0;
}

function getPlayerAxis(player: Player): Axis {
  const entries: Array<[Axis, number]> = [
    ["pow", player.coreStats.pow ?? 0],
    ["spe", player.coreStats.spe ?? 0],
    ["men", player.coreStats.men ?? 0],
    ["soc", player.coreStats.soc ?? 0],
  ];
  entries.sort((left, right) => right[1] - left[1]);
  return entries[0]?.[0] ?? "pow";
}

function getTeamAxisNeeds(gameState: GameState, team: Team, rosterPlayerIds: Set<string>): Record<Axis, number> {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
  const desired: Record<Axis, number> = {
    pow: identity?.pow ?? 5,
    spe: identity?.spe ?? 5,
    men: identity?.men ?? 5,
    soc: identity?.soc ?? 5,
  };
  const rosterPlayers = gameState.rosters
    .filter((entry) => entry.teamId === team.teamId && rosterPlayerIds.has(entry.playerId))
    .map((entry) => gameState.players.find((player) => player.id === entry.playerId))
    .filter((player): player is Player => Boolean(player));

  if (rosterPlayers.length === 0) {
    return desired;
  }

  const averages: Record<Axis, number> = {
    pow: rosterPlayers.reduce((sum, player) => sum + (player.coreStats.pow ?? 0), 0) / rosterPlayers.length,
    spe: rosterPlayers.reduce((sum, player) => sum + (player.coreStats.spe ?? 0), 0) / rosterPlayers.length,
    men: rosterPlayers.reduce((sum, player) => sum + (player.coreStats.men ?? 0), 0) / rosterPlayers.length,
    soc: rosterPlayers.reduce((sum, player) => sum + (player.coreStats.soc ?? 0), 0) / rosterPlayers.length,
  };

  return {
    pow: desired.pow * 10 + Math.max(0, 55 - averages.pow),
    spe: desired.spe * 10 + Math.max(0, 55 - averages.spe),
    men: desired.men * 10 + Math.max(0, 55 - averages.men),
    soc: desired.soc * 10 + Math.max(0, 55 - averages.soc),
  };
}

function getTargetRoster(gameState: GameState, team: Team) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
  const preferred = identity?.playerOpt ?? identity?.playerMin ?? team.rosterLimit ?? 12;
  return Math.max(1, Math.min(team.rosterLimit ?? preferred, preferred));
}

function getMinimumRoster(gameState: GameState, team: Team) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
  const opt = identity?.playerOpt ?? team.rosterLimit ?? 12;
  const min = identity?.playerMin ?? Math.min(opt, 8);
  return Math.max(1, Math.min(team.rosterLimit ?? min, min));
}

function getPotentialScore(gameState: GameState, playerId: string) {
  const potential = gameState.playerPotential?.find((entry) => entry.playerId === playerId);
  if (typeof potential?.hiddenPotentialScore === "number") {
    return potential.hiddenPotentialScore;
  }
  if (potential?.revealedPotentialRange) {
    return (potential.revealedPotentialRange.min + potential.revealedPotentialRange.max) / 2;
  }
  return 50;
}

function buildCandidates(gameState: GameState): Candidate[] {
  const rosteredPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  return gameState.players
    .filter((player) => !rosteredPlayerIds.has(player.id))
    .map((player) => {
      const economy = resolvePlayerEconomyContract({ player });
      const marketValue = economy.marketValue ?? 0;
      const salary = economy.salary ?? 0;
      const axis = getPlayerAxis(player);
      const average = ((player.coreStats.pow ?? 0) + (player.coreStats.spe ?? 0) + (player.coreStats.men ?? 0) + (player.coreStats.soc ?? 0)) / 4;
      return {
        player,
        marketValue,
        salary,
        axis,
        axisValue: getAxisValue(player, axis),
        average,
        potential: getPotentialScore(gameState, player.id),
      };
    })
    .filter((candidate) => candidate.marketValue > 0 && candidate.salary > 0)
    .sort((left, right) => {
      const leftValue = (left.average + left.potential * 0.35) / Math.max(1, left.marketValue + left.salary * 1.8);
      const rightValue = (right.average + right.potential * 0.35) / Math.max(1, right.marketValue + right.salary * 1.8);
      return rightValue - leftValue || left.player.name.localeCompare(right.player.name, "de");
    });
}

function scoreCandidate(input: {
  candidate: Candidate;
  team: Team;
  targetRoster: number;
  rosterCount: number;
  rosterClassCounts: Map<string, number>;
  axisNeeds: Record<Axis, number>;
}) {
  const { candidate, team, targetRoster, rosterCount, rosterClassCounts, axisNeeds } = input;
  const rosterGap = Math.max(0, targetRoster - rosterCount);
  const cash = team.cash ?? 0;
  const reservePerMissingSlot = rosterGap > 1 ? 6 : 0;
  const spendableNow = Math.max(0, cash - Math.max(0, rosterGap - 1) * reservePerMissingSlot);
  if (candidate.marketValue > spendableNow) {
    return Number.NEGATIVE_INFINITY;
  }

  const axisNeed = axisNeeds[candidate.axis] ?? 0;
  const valueScore = (candidate.average + candidate.potential * 0.35) / Math.max(1, candidate.marketValue + candidate.salary * 1.8);
  const affordability = Math.max(0, 1 - candidate.marketValue / Math.max(1, cash));
  const classPenalty = Math.max(0, (rosterClassCounts.get(candidate.player.className) ?? 0) - 1) * 8;
  const cheapFillBoost = rosterCount < Math.min(7, targetRoster) ? Math.max(0, 26 - candidate.marketValue) * 0.8 : 0;

  return (
    valueScore * 18 +
    axisNeed * (candidate.axisValue / 100) * 0.55 +
    candidate.average * 0.22 +
    candidate.potential * 0.12 +
    affordability * 16 +
    cheapFillBoost -
    classPenalty
  );
}

function getAiTeams(gameState: GameState) {
  return gameState.teams.filter((team) => {
    const control = getTeamControlSettings(gameState, team.teamId);
    return control?.controlMode === "ai";
  });
}

export function runAiSeason1FastDraft(input: {
  saveId: string;
  seasonId: string;
  persistence?: PersistenceService;
  maxDurationMs?: number;
}): AiSeason1FastDraftResult {
  const startedAt = Date.now();
  const persistence = input.persistence ?? createPersistenceService();
  const save = persistence.getSaveById(input.saveId);
  if (!save) {
    throw new Error(`Save ${input.saveId} not found.`);
  }
  if (save.gameState.season.id !== input.seasonId) {
    throw new Error(`Season ${input.seasonId} is not active in save ${input.saveId}.`);
  }

  const runContext = createLocalTransfermarktRunContext({ save, persistence });
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  const maxDurationMs = input.maxDurationMs ?? 150_000;
  let candidates = buildCandidates(runContext.save.gameState);
  const aiTeams = getAiTeams(runContext.save.gameState);
  const teamResults = new Map<string, AiSeason1FastDraftResult["teamResults"][number]>();
  let transferBuysApplied = 0;
  let madeProgress = true;

  for (const team of aiTeams) {
    const rosterBefore = runContext.save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const targetRoster = getTargetRoster(runContext.save.gameState, team);
    teamResults.set(team.teamId, {
      teamId: team.teamId,
      teamCode: team.shortCode,
      rosterBefore,
      rosterAfter: rosterBefore,
      targetRoster,
      buysApplied: 0,
      cashAfter: team.cash ?? 0,
      blockingReasons: [],
    });
  }

  while (madeProgress) {
    madeProgress = false;
    if (Date.now() - startedAt > maxDurationMs) {
      warnings.push("fast_draft_time_budget_reached");
      break;
    }

    for (const teamId of aiTeams.map((team) => team.teamId)) {
      const gameState = runContext.save.gameState;
      const team = gameState.teams.find((entry) => entry.teamId === teamId);
      if (!team) continue;

      const result = teamResults.get(teamId);
      if (!result) continue;

      const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === teamId);
      const targetRoster = result.targetRoster;
      if (rosterEntries.length >= targetRoster) {
        result.rosterAfter = rosterEntries.length;
        result.cashAfter = roundValue(team.cash ?? 0);
        continue;
      }

      const rosteredPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
      const rosterClassCounts = new Map<string, number>();
      for (const entry of rosterEntries) {
        const player = gameState.players.find((candidate) => candidate.id === entry.playerId);
        if (!player) continue;
        rosterClassCounts.set(player.className, (rosterClassCounts.get(player.className) ?? 0) + 1);
      }
      const axisNeeds = getTeamAxisNeeds(gameState, team, rosteredPlayerIds);
      const freeCandidates = candidates.filter((entry) => !rosteredPlayerIds.has(entry.player.id));
      const scorePool = (pool: Candidate[]) =>
        pool
          .map((entry) => ({
            entry,
            score: scoreCandidate({
              candidate: entry,
              team,
              targetRoster,
              rosterCount: rosterEntries.length,
              rosterClassCounts,
              axisNeeds,
            }),
          }))
          .filter((entry) => Number.isFinite(entry.score))
          .sort((left, right) => right.score - left.score)[0]?.entry ?? null;
      const candidate =
        scorePool(freeCandidates.slice(0, 420)) ??
        scorePool(
          freeCandidates
            .filter((entry) => entry.marketValue <= (team.cash ?? 0))
            .sort((left, right) => left.marketValue - right.marketValue || right.average - left.average)
            .slice(0, 240),
        );

      if (!candidate) {
        result.blockingReasons.push("no_fast_candidate_affordable");
        result.rosterAfter = rosterEntries.length;
        result.cashAfter = roundValue(team.cash ?? 0);
        continue;
      }

      const buy = executeLocalTransfermarktBuy({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId,
        playerId: candidate.player.id,
        contractLength: candidate.marketValue >= 35 ? 3 : 2,
        contractShape: "balanced",
        promisedRole: rosterEntries.length < 7 || candidate.marketValue >= 35 ? "starter" : "rotation",
        transferSource: "ai_roster_fill",
        fastLocalBatch: true,
        deferPersist: true,
        localRunContext: runContext,
      });

      if (!buy.transferCreated) {
        result.blockingReasons.push(...buy.blockingReasons);
        continue;
      }

      madeProgress = true;
      transferBuysApplied += 1;
      result.buysApplied += 1;
      result.rosterAfter += 1;
      result.cashAfter = roundValue(buy.cashAfter ?? result.cashAfter);
      candidates = candidates.filter((entry) => entry.player.id !== candidate.player.id);
    }
  }

  flushLocalTransfermarktRunContext(runContext);
  const finalSave = persistence.getSaveById(input.saveId) ?? runContext.save;
  const finalAiTeams = getAiTeams(finalSave.gameState);
  const finalTeamResults = finalAiTeams.map((team) => {
    const existing = teamResults.get(team.teamId);
    const rosterAfter = finalSave.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const cashAfter = finalSave.gameState.teams.find((entry) => entry.teamId === team.teamId)?.cash ?? existing?.cashAfter ?? 0;
    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      rosterBefore: existing?.rosterBefore ?? rosterAfter,
      rosterAfter,
      targetRoster: existing?.targetRoster ?? getTargetRoster(finalSave.gameState, team),
      buysApplied: existing?.buysApplied ?? 0,
      cashAfter: roundValue(cashAfter),
      blockingReasons: [...new Set(existing?.blockingReasons ?? [])],
    };
  });
  const minimumByTeamId = new Map(finalAiTeams.map((team) => [team.teamId, getMinimumRoster(finalSave.gameState, team)] as const));
  const aiTeamsCompleted = finalTeamResults.filter((team) => team.rosterAfter >= (minimumByTeamId.get(team.teamId) ?? team.targetRoster)).length;
  const unfinishedMinimumTeams = finalTeamResults.filter((team) => team.rosterAfter < (minimumByTeamId.get(team.teamId) ?? team.targetRoster));
  const unfinishedOptimumTeams = finalTeamResults.filter((team) => team.rosterAfter < team.targetRoster);
  if (unfinishedOptimumTeams.length > 0) {
    warnings.push(`fast_draft_under_optimum_teams:${unfinishedOptimumTeams.length}`);
  }
  if (unfinishedMinimumTeams.length > 0) {
    warnings.push(`fast_draft_unfinished_minimum_teams:${unfinishedMinimumTeams.length}`);
  }

  return {
    status: aiTeams.length === 0 ? "skipped" : unfinishedMinimumTeams.length > 0 ? "partial" : "completed",
    seasonId: input.seasonId,
    aiTeamsTotal: finalAiTeams.length,
    aiTeamsCompleted,
    transferBuysApplied,
    warnings: [...new Set(warnings)],
    blockingReasons: [...new Set(blockingReasons)],
    durationMs: Date.now() - startedAt,
    teamResults: finalTeamResults,
  };
}
