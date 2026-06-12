import { execFileSync } from "node:child_process";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { loadLocalLegacyLineupContext, saveLocalLegacyLineupDraft, calculateLocalLegacyLineupPreview } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupEntryInput, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { APPLY_CONFIRM_TOKEN, LegacyMatchdayResultApplyService } from "@/lib/resolve/legacy-matchday-result-apply-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { buildPrizeMoneyPreview } from "@/lib/season/prize-money-preview";
import { CASH_PRIZE_APPLY_CONFIRM_TOKEN, executeCashPrizeApply } from "@/lib/season/cash-prize-apply-service";
import { previewMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";
import { executeStandingsApply, STANDINGS_APPLY_CONFIRM_TOKEN } from "@/lib/standings/standings-apply-service";

type CandidateEntry = {
  activePlayerId: string;
  playerId: string;
  score: number;
};

type SingleLoopSummary = {
  saveId: string;
  teamCount: number;
  smokeTeam: {
    teamId: string;
    teamName: string;
  };
  smokePlayer: {
    playerId: string;
    playerName: string;
  };
  before: Record<string, unknown>;
  afterBuy: Record<string, unknown>;
  afterSell: Record<string, unknown>;
  afterStandingsApply: Record<string, unknown>;
  afterCashApply: Record<string, unknown>;
  afterMatchdayAdvance: {
    currentMatchday: number;
    activeMatchdayId: string;
    pendingTeams: number;
  } & Record<string, unknown>;
  applyAudits: {
    resultApply: string | null;
    standingsApply: string | null;
    cashApply: string | null;
    matchdayAdvance: string | null;
  };
};

function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) return [[]];
  if (items.length < count) return [];

  const result: T[][] = [];
  for (let index = 0; index <= items.length - count; index += 1) {
    const head = items[index];
    if (!head) continue;
    for (const tail of combinations(items.slice(index + 1), count - 1)) {
      result.push([head, ...tail]);
    }
  }
  return result;
}

function sumScores(entries: CandidateEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.score, 0);
}

function selectBestDisjointLineup(input: {
  d1PlayerCount: number;
  d2PlayerCount: number;
  d1Candidates: CandidateEntry[];
  d2Candidates: CandidateEntry[];
  variantIndex?: number;
}) {
  const d1Combos = combinations(input.d1Candidates, input.d1PlayerCount);
  const d2Combos = combinations(input.d2Candidates, input.d2PlayerCount);
  const variants: Array<{
    d1: CandidateEntry[];
    d2: CandidateEntry[];
    total: number;
  }> = [];

  for (const d1 of d1Combos) {
    const usedIds = new Set(d1.map((entry) => entry.activePlayerId));
    for (const d2 of d2Combos) {
      if (d2.some((entry) => usedIds.has(entry.activePlayerId))) continue;
      variants.push({ d1, d2, total: sumScores(d1) + sumScores(d2) });
    }
  }

  variants.sort((left, right) => right.total - left.total);
  return variants[input.variantIndex ?? 0] ?? null;
}

function buildEntriesForSide(input: {
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  candidates: CandidateEntry[];
  captainEnabled?: boolean;
}) {
  return input.candidates.map<LegacyLineupEntryInput>((candidate, index) => ({
    disciplineId: input.disciplineId,
    disciplineSide: input.disciplineSide,
    slotIndex: index,
    playerId: candidate.playerId,
    activePlayerId: candidate.activePlayerId,
    isCaptain: Boolean(input.captainEnabled) && index === 0,
  }));
}

function buildEntriesFromContext(
  params: LegacyLineupKeyParams,
  variantIndex = 0,
  options?: { d1Captain?: boolean; d2Captain?: boolean },
) {
  const contextResult = loadLocalLegacyLineupContext(params);
  if (!contextResult.ok) {
    throw new Error(`Local multi-loop context missing for ${params.teamId}: ${contextResult.errors.join(" | ")}`);
  }

  const context = contextResult.context;
  const d1 = context.matchdayContract?.discipline1;
  const d2 = context.matchdayContract?.discipline2;
  if (!d1 || !d2 || !d1.requiredPlayers || !d2.requiredPlayers) {
    throw new Error(`D1/D2 context missing for ${params.teamId}.`);
  }

  const scoreMap = new Map(
    context.disciplineScores.map((entry) => [`${entry.playerId}::${entry.disciplineId}`, entry.score] as const),
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
    variantIndex,
  });
  if (!best) {
    throw new Error(`Could not build a valid lineup for ${params.teamId}.`);
  }

  return [
    ...buildEntriesForSide({
      disciplineId: d1.disciplineId,
      disciplineSide: "d1",
      candidates: best.d1,
      captainEnabled: options?.d1Captain ?? true,
    }),
    ...buildEntriesForSide({
      disciplineId: d2.disciplineId,
      disciplineSide: "d2",
      candidates: best.d2,
      captainEnabled: options?.d2Captain ?? true,
    }),
  ];
}

function topUpRostersForLineups(saveId: string, seasonId: string, matchdayId: string) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} could not be loaded for multi-loop lineup top-up.`);
  }

  const sampleContext = loadLocalLegacyLineupContext({
    saveId,
    seasonId,
    matchdayId,
    teamId: save.gameState.teams[0]!.teamId,
  });
  if (!sampleContext.ok) {
    throw new Error(`Multi-loop lineup base context failed: ${sampleContext.errors.join(" | ")}`);
  }

  const requiredUniquePlayers =
    (sampleContext.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (sampleContext.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);

  if (requiredUniquePlayers <= 0) {
    return;
  }

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
        throw new Error("Multi-loop save could not be topped up with enough local players.");
      }
      poolIndex += 1;
      save.gameState.rosters.push({
        id: `multi-loop-roster-${rosterCounter}`,
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

function parseSingleLoopSummary(raw: string): SingleLoopSummary {
  return JSON.parse(raw) as SingleLoopSummary;
}

async function runSecondMatchdayCycle(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamIds: string[];
}) {
  topUpRostersForLineups(input.saveId, input.seasonId, input.matchdayId);

  const contextsBeforeSave = input.teamIds.map((teamId) =>
    loadLocalLegacyLineupContext({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      teamId,
    }),
  );
  const okContextsBeforeSave = contextsBeforeSave.flatMap((entry) => (entry.ok ? [entry.context] : []));
  if (okContextsBeforeSave.length !== input.teamIds.length) {
    throw new Error(`Expected ${input.teamIds.length} contexts for ${input.matchdayId}, got ${okContextsBeforeSave.length}.`);
  }

  for (const teamId of input.teamIds) {
    const params: LegacyLineupKeyParams = {
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      teamId,
    };
    const entries = buildEntriesFromContext(params, 0, { d1Captain: true, d2Captain: false });
    const saveResult = saveLocalLegacyLineupDraft(params, entries);
    if (!saveResult.ok) {
      throw new Error(`Multi-loop failed to save lineup for ${teamId} on ${input.matchdayId}: ${saveResult.errors.join(" | ")}`);
    }
  }

  const contexts = input.teamIds.map((teamId) =>
    loadLocalLegacyLineupContext({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      teamId,
    }),
  );
  const okContexts = contexts.flatMap((entry) => (entry.ok ? [entry.context] : []));
  const resolvePreview = buildLegacyMatchdayResolvePreview(okContexts);
  if (resolvePreview.status !== "ready") {
    throw new Error(`Resolve preview not ready for ${input.matchdayId}: ${resolvePreview.status}`);
  }

  let fatigueTeamsCount = 0;
  for (const teamId of input.teamIds) {
    const preview = calculateLocalLegacyLineupPreview({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      teamId,
    });
    if (!preview.ok) {
      throw new Error(`Lineup preview missing for ${teamId} on ${input.matchdayId}: ${preview.errors.join(" | ")}`);
    }
    if ((preview.scorePreview.fatigueModifier ?? 0) < 0) {
      fatigueTeamsCount += 1;
    }
  }

  const resultApplyService = new LegacyMatchdayResultApplyService();
  let resultApply = null as Awaited<ReturnType<LegacyMatchdayResultApplyService["applyLegacyMatchdayResult"]>> | null;
  let standingsPreview = null as Awaited<ReturnType<typeof buildStandingsPreview>> | null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    resultApply = await resultApplyService.applyLegacyMatchdayResult({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      source: "sqlite",
      execute: true,
      confirm: APPLY_CONFIRM_TOKEN,
      forceReplace: attempt > 0,
    });
    if (!resultApply.ok || !resultApply.applied) {
      throw new Error(`Result apply failed for ${input.matchdayId}: ${resultApply.ok ? "not applied" : resultApply.error}`);
    }

    standingsPreview = await buildStandingsPreview({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      source: "sqlite",
    });

    const tieOnlyNotReady =
      standingsPreview.items.every((item) => item.resultStatus === "ready" || item.resultStatus === "tie_warning") &&
      standingsPreview.tieGroups.length > 0;
    if (standingsPreview.items.every((item) => item.resultStatus === "ready")) {
      break;
    }
    if (!tieOnlyNotReady) {
      break;
    }

    const tiedTeamIds = Array.from(
      new Set(standingsPreview.tieGroups.flatMap((group) => group.affectedTeams.map((team) => team.teamId))),
    );
    for (const [index, teamId] of tiedTeamIds.entries()) {
      const params: LegacyLineupKeyParams = {
        saveId: input.saveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        teamId,
      };
      const entries = buildEntriesFromContext(params, attempt + index + 1, { d1Captain: true, d2Captain: false });
      const saveResult = saveLocalLegacyLineupDraft(params, entries);
      if (!saveResult.ok) {
        throw new Error(`Tie-adjust lineup failed for ${teamId} on ${input.matchdayId}: ${saveResult.errors.join(" | ")}`);
      }
    }
  }

  if (!resultApply || !standingsPreview) {
    throw new Error(`Could not complete result/standings phase for ${input.matchdayId}.`);
  }
  if (standingsPreview.items.some((item) => item.resultStatus !== "ready")) {
    const nonReady = standingsPreview.items.filter((item) => item.resultStatus !== "ready").map((item) => item.teamId).join(", ");
    throw new Error(`Non-ready standings teams on ${input.matchdayId}: ${nonReady}`);
  }

  const standingsApply = await executeStandingsApply({
    saveId: input.saveId,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    source: "sqlite",
    execute: true,
    confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
  });
  if (!standingsApply.ok || !standingsApply.applied) {
    throw new Error(`Standings apply failed for ${input.matchdayId}: ${standingsApply.blockingReasons.join(" | ")}`);
  }

  const prizePreview = await buildPrizeMoneyPreview({
    saveId: input.saveId,
    seasonId: input.seasonId,
    source: "sqlite",
  });

  const cashApply = await executeCashPrizeApply({
    saveId: input.saveId,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    source: "sqlite",
    execute: true,
    confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN,
  });
  if (!cashApply.ok || !cashApply.applied) {
    throw new Error(`Cash apply failed for ${input.matchdayId}: ${cashApply.blockingReasons.join(" | ")}`);
  }

  const currentSave = createPersistenceService().getSaveById(input.saveId);
  if (!currentSave) {
    throw new Error(`Save ${input.saveId} missing after ${input.matchdayId}.`);
  }
  const advancePreview = await previewMatchdayAdvance({
    saveId: input.saveId,
    seasonId: input.seasonId,
    source: "sqlite",
  });

  return {
    disciplineIds: {
      d1: okContextsBeforeSave[0]?.matchdayContract?.discipline1?.disciplineId ?? null,
      d2: okContextsBeforeSave[0]?.matchdayContract?.discipline2?.disciplineId ?? null,
    },
    disciplineNames: {
      d1: okContextsBeforeSave[0]?.matchdayContract?.discipline1?.displayName ?? null,
      d2: okContextsBeforeSave[0]?.matchdayContract?.discipline2?.displayName ?? null,
    },
    fatigueTeamsCount,
    resolveWarnings: resolvePreview.warnings,
    standingsWarnings: standingsPreview.items.flatMap((item) => item.warnings).slice(0, 20),
    prizeWarnings: prizePreview.globalWarnings,
    auditIds: {
      resultApply: "matchdayResultId" in resultApply ? resultApply.matchdayResultId : null,
      standingsApply: standingsApply.auditLogId,
      cashApply: cashApply.auditLogId,
    },
    advancePreview: {
      canApply: advancePreview.canApply,
      blockingReasons: advancePreview.blockingReasons,
      noNextMatchday: advancePreview.blockingReasons.includes("no_next_matchday_configured"),
      nextMatchdayId: advancePreview.scope.nextMatchdayId,
      nextMatchdayLabel: advancePreview.summary.nextMatchdayLabel,
    },
    persistedCounts: {
      matchdayResults: currentSave.gameState.seasonState.matchdayResults?.length ?? 0,
      standingsApplyLogs: currentSave.gameState.seasonState.standingsApplyLogs?.length ?? 0,
      cashPrizeApplyLogs: currentSave.gameState.seasonState.cashPrizeApplyLogs?.length ?? 0,
      matchdayAdvanceLogs: currentSave.gameState.seasonState.matchdayAdvanceLogs?.length ?? 0,
    },
    currentMatchday: currentSave.gameState.season.currentMatchday,
    activeMatchdayId: currentSave.gameState.matchdayState.matchdayId,
  };
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));

  const projectRoot = path.resolve(__dirname, "..");
  const singleLoopRaw = execFileSync("npx", ["tsx", "scripts/smoke-local-season-loop.ts"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  const firstLoop = parseSingleLoopSummary(singleLoopRaw);

  const prismaBeforeSecond = await loadFoundationSnapshotFromPrisma("save-initial");
  const prismaBeforeState = {
    activePlayers: prismaBeforeSecond?.activePlayers.length ?? null,
    teamSeasonStates: prismaBeforeSecond?.teamSeasonStates.length ?? null,
    players: prismaBeforeSecond?.players.length ?? null,
  };

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(firstLoop.saveId);
  if (!save) {
    throw new Error(`Follow-up multi-loop save ${firstLoop.saveId} could not be loaded.`);
  }
  if (save.gameState.season.matchdayIds.length < 2) {
    throw new Error(`Multi-matchday smoke needs at least 2 configured matchdays, got ${save.gameState.season.matchdayIds.length}.`);
  }
  if (save.gameState.matchdayState.matchdayId !== "matchday-2") {
    throw new Error(`Expected active matchday-2 after first local loop, got ${save.gameState.matchdayState.matchdayId}.`);
  }

  const md1Context = loadLocalLegacyLineupContext({
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    matchdayId: save.gameState.season.matchdayIds[0]!,
    teamId: save.gameState.teams[0]!.teamId,
  });
  const md2Context = loadLocalLegacyLineupContext({
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    matchdayId: "matchday-2",
    teamId: save.gameState.teams[0]!.teamId,
  });
  if (!md1Context.ok || !md2Context.ok) {
    throw new Error(`Could not load matchday contracts for comparison: ${[...(md1Context.ok ? [] : md1Context.errors), ...(md2Context.ok ? [] : md2Context.errors)].join(" | ")}`);
  }

  const secondCycle = await runSecondMatchdayCycle({
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    matchdayId: "matchday-2",
    teamIds: save.gameState.teams.map((team) => team.teamId),
  });

  if (md1Context.context.matchdayContract?.discipline1?.disciplineId === md2Context.context.matchdayContract?.discipline1?.disciplineId &&
      md1Context.context.matchdayContract?.discipline2?.disciplineId === md2Context.context.matchdayContract?.discipline2?.disciplineId) {
    throw new Error("Expected matchday 2 disciplines to differ from matchday 1.");
  }
  if (secondCycle.fatigueTeamsCount <= 0) {
    throw new Error("Expected at least one team to carry fatigue into matchday 2 preview.");
  }
  if (secondCycle.persistedCounts.matchdayResults < 2 || secondCycle.persistedCounts.standingsApplyLogs < 2 || secondCycle.persistedCounts.cashPrizeApplyLogs < 2) {
    throw new Error("Expected result, standings and cash logs to be preserved across two matchdays.");
  }
  if (secondCycle.advancePreview.noNextMatchday) {
    throw new Error("Expected a configured next matchday after completing the second local matchday cycle.");
  }

  const prismaAfterSecond = await loadFoundationSnapshotFromPrisma("save-initial");
  const prismaAfterState = {
    activePlayers: prismaAfterSecond?.activePlayers.length ?? null,
    teamSeasonStates: prismaAfterSecond?.teamSeasonStates.length ?? null,
    players: prismaAfterSecond?.players.length ?? null,
  };
  if (JSON.stringify(prismaBeforeState) !== JSON.stringify(prismaAfterState)) {
    throw new Error("Prisma reference snapshot changed during local multi-matchday loop.");
  }

  console.log(
    JSON.stringify(
      {
        saveId: save.saveId,
        configuredMatchdays: save.gameState.season.matchdayIds,
        smokeTeam: firstLoop.smokeTeam,
        smokePlayer: firstLoop.smokePlayer,
        firstMatchday: {
          activeAfterAdvance: firstLoop.afterMatchdayAdvance.activeMatchdayId,
          applyAudits: firstLoop.applyAudits,
        },
        secondMatchday: secondCycle,
        disciplineChange: {
          matchday1: {
            d1: md1Context.context.matchdayContract?.discipline1?.displayName ?? null,
            d2: md1Context.context.matchdayContract?.discipline2?.displayName ?? null,
          },
          matchday2: {
            d1: md2Context.context.matchdayContract?.discipline1?.displayName ?? null,
            d2: md2Context.context.matchdayContract?.discipline2?.displayName ?? null,
          },
        },
        prismaUnchanged: true,
        seasonBoundary: {
          nextMatchdayExistsAfterSecondCycle: !secondCycle.advancePreview.noNextMatchday,
          reason: secondCycle.advancePreview.blockingReasons,
          nextPreviewMatchdayId: secondCycle.advancePreview.nextMatchdayId,
          nextPreviewMatchdayLabel: secondCycle.advancePreview.nextMatchdayLabel,
        },
        testStatus: "passed",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
