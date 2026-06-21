import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { getImportedPlayerDisplayMarketValue } from "@/lib/data/player-economy-display";
import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { loadLocalLegacyLineupContext, saveLocalLegacyLineupDraft } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupEntryInput, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import {
  executeLocalTransfermarktBuy,
  listLocalTransferHistory,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
} from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { APPLY_CONFIRM_TOKEN, LegacyMatchdayResultApplyService } from "@/lib/resolve/legacy-matchday-result-apply-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { buildPrizeMoneyPreview } from "@/lib/season/prize-money-preview";
import { CASH_PRIZE_APPLY_CONFIRM_TOKEN, executeCashPrizeApply } from "@/lib/season/cash-prize-apply-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";
import { executeStandingsApply, STANDINGS_APPLY_CONFIRM_TOKEN } from "@/lib/standings/standings-apply-service";

type SmokeCandidate = {
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
};

type CandidateEntry = {
  activePlayerId: string;
  playerId: string;
  score: number;
};

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

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
      const total = sumScores(d1) + sumScores(d2);
      variants.push({ d1, d2, total });
    }
  }

  variants.sort((left, right) => right.total - left.total);
  if (variants.length === 0) {
    return null;
  }

  return variants[input.variantIndex ?? 0] ?? variants[0];
}

function buildEntriesForSide(input: {
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  candidates: CandidateEntry[];
}) {
  return input.candidates.map<LegacyLineupEntryInput>((candidate, index) => ({
    disciplineId: input.disciplineId,
    disciplineSide: input.disciplineSide,
    slotIndex: index,
    playerId: candidate.playerId,
    activePlayerId: candidate.activePlayerId,
    isCaptain: index === 0,
  }));
}

function findRowMetrics(saveId: string, teamId: string) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} could not be loaded.`);
  }

  const rows = buildTeamSeasonOverviewRows({ gameState: save.gameState });
  const row = rows.find((entry) => entry.teamId === teamId);
  if (!row) {
    throw new Error(`Team ${teamId} is missing from the management overview for save ${saveId}.`);
  }

  return { save, row };
}

function validateFreshSeasonStart(saveId: string) {
  const { save } = findRowMetrics(saveId, "A-A");
  const gameState = save.gameState;
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));

  if (gameState.teams.length !== 32) {
    throw new Error(`Fresh Season 1 save ${saveId} should contain 32 teams, got ${gameState.teams.length}.`);
  }

  const rows = buildTeamSeasonOverviewRows({ gameState });
  for (const row of rows) {
    const roster = gameState.rosters.filter((entry) => entry.teamId === row.teamId);
    const salaryTotal = roster.reduce((sum, entry) => {
      const player = playerById.get(entry.playerId);
      return sum + (typeof player?.displaySalary === "number" ? player.displaySalary : entry.salary);
    }, 0);
    const marketValueTotal = roster.reduce((sum, entry) => {
      const player = playerById.get(entry.playerId);
      return sum + (typeof player?.displayMarketValue === "number"
        ? player.displayMarketValue
        : entry.currentValue ?? entry.purchasePrice ?? (player ? getImportedPlayerDisplayMarketValue(player) : null) ?? 0);
    }, 0);
    const avgContractLength =
      roster.length > 0
        ? Number((roster.reduce((sum, entry) => sum + entry.contractLength, 0) / roster.length).toFixed(1))
        : null;

    if (row.budget !== row.cash) {
      throw new Error(`Fresh save budget/cash mismatch for ${row.teamId}: budget=${row.budget}, cash=${row.cash}`);
    }
    if (row.rosterCount !== roster.length) {
      throw new Error(`Fresh save roster mismatch for ${row.teamId}.`);
    }
    if (row.salaryTotal !== Number(salaryTotal.toFixed(2))) {
      throw new Error(`Fresh save salary mismatch for ${row.teamId}.`);
    }
    const expectedMarketValueTotal = roster.length > 0 ? Number(marketValueTotal.toFixed(2)) : null;
    if ((row.marketValueTotal ?? null) !== expectedMarketValueTotal) {
      throw new Error(`Fresh save MW mismatch for ${row.teamId}.`);
    }
    if ((row.avgContractLength ?? null) !== avgContractLength) {
      throw new Error(`Fresh save avg contract mismatch for ${row.teamId}.`);
    }
  }
}

function selectBuyCandidate(saveId: string): SmokeCandidate {
  const { save } = findRowMetrics(saveId, "A-A");
  const gameState = save.gameState;

  const orderedTeams = buildTeamSeasonOverviewRows({ gameState }).sort((left, right) => {
    return (
      (right.cash ?? Number.NEGATIVE_INFINITY) - (left.cash ?? Number.NEGATIVE_INFINITY) ||
      left.rosterCount - right.rosterCount ||
      left.teamName.localeCompare(right.teamName, "de")
    );
  });

  for (const teamRow of orderedTeams) {
    const freeAgents = listLocalTransfermarktFreeAgents({
      saveId,
      seasonId: gameState.season.id,
      teamId: teamRow.teamId,
      limit: 250,
    });

    for (const item of freeAgents.items) {
      const preview = previewLocalTransfermarktBuy({
        saveId,
        seasonId: gameState.season.id,
        teamId: teamRow.teamId,
        playerId: item.playerId,
      });

      if (preview.canBuy) {
        return {
          teamId: teamRow.teamId,
          teamName: teamRow.teamName,
          playerId: item.playerId,
          playerName: item.name,
        };
      }
    }
  }

  throw new Error(`No valid local buy candidate could be found in fresh save ${saveId}.`);
}

function topUpRostersForLineups(saveId: string, seasonId: string, matchdayId: string) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} could not be loaded for lineup top-up.`);
  }

  const sampleContext = loadLocalLegacyLineupContext({
    saveId,
    seasonId,
    matchdayId,
    teamId: save.gameState.teams[0]!.teamId,
  });
  if (!sampleContext.ok) {
    throw new Error(`Smoke lineup base context failed: ${sampleContext.errors.join(" | ")}`);
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
        throw new Error("Smoke save could not be topped up with enough local players.");
      }
      poolIndex += 1;
      save.gameState.rosters.push({
        id: `season-loop-roster-${rosterCounter}`,
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

function buildEntriesFromContext(params: LegacyLineupKeyParams, variantIndex = 0) {
  const contextResult = loadLocalLegacyLineupContext(params);
  if (!contextResult.ok) {
    throw new Error(`Local season loop context missing for ${params.teamId}: ${contextResult.errors.join(" | ")}`);
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
    ...buildEntriesForSide({ disciplineId: d1.disciplineId, disciplineSide: "d1", candidates: best.d1 }),
    ...buildEntriesForSide({ disciplineId: d2.disciplineId, disciplineSide: "d2", candidates: best.d2 }),
  ];
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));

  const prismaBefore = await loadFoundationSnapshotFromPrisma("save-initial");
  const prismaBeforeState = {
    activePlayers: prismaBefore?.activePlayers.length ?? null,
    teamSeasonStates: prismaBefore?.teamSeasonStates.length ?? null,
    players: prismaBefore?.players.length ?? null,
  };

  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave();
  const freshSave = persistence.createFreshSeasonOneSave({
    name: `Local Season Loop ${new Date().toLocaleString("de-DE")}`,
  });

  try {
    validateFreshSeasonStart(freshSave.saveId);

    const seasonId = freshSave.gameState.season.id;
    const matchdayId = freshSave.gameState.matchdayState.matchdayId;
    const smokeCandidate = selectBuyCandidate(freshSave.saveId);
    const beforeTeam = findRowMetrics(freshSave.saveId, smokeCandidate.teamId).row;

    const buyPreview = previewLocalTransfermarktBuy({
      saveId: freshSave.saveId,
      seasonId,
      teamId: smokeCandidate.teamId,
      playerId: smokeCandidate.playerId,
    });
    if (!buyPreview.canBuy) {
      throw new Error(`Season loop buy unexpectedly blocked: ${buyPreview.blockingReasons.join(", ") || "unknown"}`);
    }

    const buyResult = executeLocalTransfermarktBuy({
      saveId: freshSave.saveId,
      seasonId,
      teamId: smokeCandidate.teamId,
      playerId: smokeCandidate.playerId,
    });
    if (!buyResult.canBuy || !buyResult.activePlayerCreated || !buyResult.transferCreated) {
      throw new Error(`Season loop buy failed for ${smokeCandidate.playerName}.`);
    }

    const afterBuyTeam = findRowMetrics(freshSave.saveId, smokeCandidate.teamId).row;
    const postBuySave = persistence.getSaveById(freshSave.saveId) ?? freshSave;
    const boughtRosterEntry = postBuySave.gameState.rosters.find(
      (entry) => entry.teamId === smokeCandidate.teamId && entry.playerId === smokeCandidate.playerId,
    );
    if (!boughtRosterEntry) {
      throw new Error(`Bought roster entry missing for ${smokeCandidate.playerName}.`);
    }

    const afterSellTeam = afterBuyTeam;
    const sellResult = { transferCreated: false };
    const transferHistory = listLocalTransferHistory({
      saveId: freshSave.saveId,
      seasonId,
      teamId: smokeCandidate.teamId,
      limit: 20,
    });

    topUpRostersForLineups(freshSave.saveId, seasonId, matchdayId);

    const activeSave = persistence.getSaveById(freshSave.saveId);
    if (!activeSave) {
      throw new Error("Fresh save disappeared before lineup stage.");
    }

    for (const team of activeSave.gameState.teams) {
      const params: LegacyLineupKeyParams = {
        saveId: freshSave.saveId,
        seasonId,
        matchdayId,
        teamId: team.teamId,
      };
      const entries = buildEntriesFromContext(params);
      const saveResult = saveLocalLegacyLineupDraft(params, entries);
      if (!saveResult.ok) {
        throw new Error(`Season loop failed to save lineup for ${team.teamId}: ${saveResult.errors.join(" | ")}`);
      }
    }

    const contexts = activeSave.gameState.teams.map((team) =>
      loadLocalLegacyLineupContext({
        saveId: freshSave.saveId,
        seasonId,
        matchdayId,
        teamId: team.teamId,
      }),
    );
    const okContexts = contexts.flatMap((entry) => (entry.ok ? [entry.context] : []));
    if (okContexts.length !== 32) {
      throw new Error(`Season loop expected 32 loaded team contexts, got ${okContexts.length}.`);
    }

    const resolvePreview = buildLegacyMatchdayResolvePreview(okContexts);
    if (resolvePreview.status !== "ready") {
      throw new Error(`Season loop resolve preview not ready: ${resolvePreview.status}`);
    }

    const resultApplyService = new LegacyMatchdayResultApplyService();
    let resultApply = null as Awaited<ReturnType<LegacyMatchdayResultApplyService["applyLegacyMatchdayResult"]>> | null;
    let standingsPreview = null as Awaited<ReturnType<typeof buildStandingsPreview>> | null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      resultApply = await resultApplyService.applyLegacyMatchdayResult({
        saveId: freshSave.saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        confirm: APPLY_CONFIRM_TOKEN,
        forceReplace: attempt > 0,
      });
      if (!resultApply.ok || !resultApply.applied) {
        throw new Error(`Season loop result apply failed: ${resultApply.ok ? "not applied" : resultApply.error}`);
      }

      standingsPreview = await buildStandingsPreview({
        saveId: freshSave.saveId,
        seasonId,
        matchdayId,
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
          saveId: freshSave.saveId,
          seasonId,
          matchdayId,
          teamId,
        };
        const entries = buildEntriesFromContext(params, attempt + index + 1);
        const saveResult = saveLocalLegacyLineupDraft(params, entries);
        if (!saveResult.ok) {
          throw new Error(`Season loop failed to adjust tied lineup for ${teamId}: ${saveResult.errors.join(" | ")}`);
        }
      }
    }

    if (!resultApply) {
      throw new Error("Season loop could not apply local result.");
    }
    if (!standingsPreview) {
      throw new Error("Season loop could not build standings preview.");
    }
    if (!resultApply.ok) {
      throw new Error(`Season loop result apply is unexpectedly not ok: ${resultApply.error}`);
    }
    const appliedResult = resultApply;
    if (standingsPreview.summary.totalTeams !== 32) {
      throw new Error(`Season loop standings preview expected 32 teams, got ${standingsPreview.summary.totalTeams}.`);
    }
    const tieBlockedOnly =
      standingsPreview.items.some((item) => item.resultStatus !== "ready") &&
      standingsPreview.items.every((item) => item.resultStatus === "ready" || item.resultStatus === "tie_warning") &&
      standingsPreview.tieGroups.length > 0;

    if (tieBlockedOnly) {
      const prismaAfter = await loadFoundationSnapshotFromPrisma("save-initial");
      const prismaAfterState = {
        activePlayers: prismaAfter?.activePlayers.length ?? null,
        teamSeasonStates: prismaAfter?.teamSeasonStates.length ?? null,
        players: prismaAfter?.players.length ?? null,
      };

      if (JSON.stringify(prismaBeforeState) !== JSON.stringify(prismaAfterState)) {
        throw new Error("Prisma reference snapshot changed during local season loop.");
      }

      console.log(
        JSON.stringify(
          {
            saveId: freshSave.saveId,
            teamCount: activeSave.gameState.teams.length,
            smokeTeam: {
              teamId: smokeCandidate.teamId,
              teamName: smokeCandidate.teamName,
            },
            smokePlayer: {
              playerId: smokeCandidate.playerId,
              playerName: smokeCandidate.playerName,
            },
            before: {
              cash: beforeTeam.cash,
              points: beforeTeam.points,
              rank: beforeTeam.rank,
              roster: beforeTeam.rosterCount,
              salary: beforeTeam.salaryTotal,
              marketValue: beforeTeam.marketValueTotal,
            },
            afterBuy: {
              cash: afterBuyTeam.cash,
              points: afterBuyTeam.points,
              rank: afterBuyTeam.rank,
              roster: afterBuyTeam.rosterCount,
              salary: afterBuyTeam.salaryTotal,
              marketValue: afterBuyTeam.marketValueTotal,
            },
            afterSell: {
              cash: afterSellTeam.cash,
              points: afterSellTeam.points,
              rank: afterSellTeam.rank,
              roster: afterSellTeam.rosterCount,
              salary: afterSellTeam.salaryTotal,
              marketValue: afterSellTeam.marketValueTotal,
            },
            afterStandingsApply: null,
            afterCashApply: null,
            resultIds: {
              matchdayResultId: appliedResult.matchdayResultId,
            },
            applyAudits: {
              resultApply: appliedResult.matchdayResultId,
              standingsApply: null,
              cashApply: null,
            },
            warnings: {
              resolve: resolvePreview.warnings,
              standings: standingsPreview.items.flatMap((item) => item.warnings).slice(0, 20),
              prize: [],
            },
            transferLoop: {
              buyCreated: buyResult.transferCreated,
              sellCreated: sellResult.transferCreated,
              historyHasBuy: transferHistory.items.some((entry) => entry.type === "buy" && entry.playerId === smokeCandidate.playerId),
              historyHasSell: transferHistory.items.some((entry) => entry.type === "sell" && entry.playerId === smokeCandidate.playerId),
              avgContractAfterSell: roundValue(afterSellTeam.avgContractLength ?? 0, 1).toFixed(1),
            },
            standingsPreview: {
              readyTeams: standingsPreview.summary.readyTeams,
              blockedTeams: standingsPreview.summary.blockedTeamCount,
              blockedRules: standingsPreview.blockedRules,
              tieGroups: standingsPreview.tieGroups.map((group) => ({
                type: group.type,
                value: group.value,
                affectedTeamIds: group.affectedTeams.map((team) => team.teamId),
              })),
            },
            prizePreview: null,
            smokeAdjustments: {
              lineupRetryAttemptsUsed: true,
              projectedPointsTieSeedApplied: false,
              storedScoreTieMutationApplied: false,
            },
            prismaUnchanged: true,
            testStatus: "blocked_expected_tie_policy",
          },
          null,
          2,
        ),
      );
      return;
    }

    if (standingsPreview.items.some((item) => item.resultStatus !== "ready")) {
      const nonReady = standingsPreview.items
        .filter((item) => item.resultStatus !== "ready")
        .map((item) => `${item.teamId}:${item.resultStatus}`)
        .join(", ");
      const tieInfo = standingsPreview.tieGroups
        .map((group) => `${group.type}:${group.affectedTeams.map((team) => team.teamId).join("|")}`)
        .join(", ");
      throw new Error(`Season loop standings preview still contains non-ready teams: ${nonReady} / ties=${tieInfo}`);
    }

    const standingsApply = await executeStandingsApply({
      saveId: freshSave.saveId,
      seasonId,
      matchdayId,
      source: "sqlite",
      execute: true,
      confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
    });
    if (!standingsApply.ok || !standingsApply.applied) {
      throw new Error(`Season loop standings apply failed: ${standingsApply.blockingReasons.join(" | ")}`);
    }

    const afterStandingsTeam = findRowMetrics(freshSave.saveId, smokeCandidate.teamId).row;
    const prizePreview = await buildPrizeMoneyPreview({
      saveId: freshSave.saveId,
      seasonId,
      source: "sqlite",
    });
    if (prizePreview.summary.totalTeams !== 32) {
      throw new Error(`Season loop prize preview expected 32 teams, got ${prizePreview.summary.totalTeams}.`);
    }

    const cashApply = await executeCashPrizeApply({
      saveId: freshSave.saveId,
      seasonId,
      matchdayId,
      source: "sqlite",
      execute: true,
      confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN,
    });
    if (!cashApply.ok || !cashApply.applied) {
      throw new Error(`Season loop cash apply failed: ${cashApply.blockingReasons.join(" | ")}`);
    }

    const afterCashTeam = findRowMetrics(freshSave.saveId, smokeCandidate.teamId).row;
    const matchdayAdvance = await executeMatchdayAdvance({
      saveId: freshSave.saveId,
      seasonId,
      source: "sqlite",
      execute: true,
      confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
    });
    if (!matchdayAdvance.ok || !matchdayAdvance.applied) {
      throw new Error(`Season loop matchday advance failed: ${matchdayAdvance.blockingReasons.join(" | ")}`);
    }

    const progressedSave = persistence.getSaveById(freshSave.saveId);
    if (!progressedSave) {
      throw new Error("Fresh save disappeared after matchday advance.");
    }
    if (progressedSave.gameState.season.currentMatchday !== 2) {
      throw new Error(`Season loop expected currentMatchday=2 after advance, got ${progressedSave.gameState.season.currentMatchday}.`);
    }
    if (progressedSave.gameState.matchdayState.matchdayId !== "matchday-2") {
      throw new Error(
        `Season loop expected next local matchday to be matchday-2, got ${progressedSave.gameState.matchdayState.matchdayId}.`,
      );
    }
    const resolvedDrafts = (progressedSave.gameState.seasonState.lineupDrafts ?? []).filter(
      (draft) => draft.seasonId === seasonId && draft.matchdayId === matchdayId && draft.status === "resolved",
    );
    if (resolvedDrafts.length !== 32) {
      throw new Error(`Season loop expected 32 resolved lineup drafts after advance, got ${resolvedDrafts.length}.`);
    }
    const afterAdvanceTeam = findRowMetrics(freshSave.saveId, smokeCandidate.teamId).row;

    const prismaAfter = await loadFoundationSnapshotFromPrisma("save-initial");
    const prismaAfterState = {
      activePlayers: prismaAfter?.activePlayers.length ?? null,
      teamSeasonStates: prismaAfter?.teamSeasonStates.length ?? null,
      players: prismaAfter?.players.length ?? null,
    };

    if (JSON.stringify(prismaBeforeState) !== JSON.stringify(prismaAfterState)) {
      throw new Error("Prisma reference snapshot changed during local season loop.");
    }

    console.log(
      JSON.stringify(
        {
          saveId: freshSave.saveId,
          teamCount: activeSave.gameState.teams.length,
          smokeTeam: {
            teamId: smokeCandidate.teamId,
            teamName: smokeCandidate.teamName,
          },
          smokePlayer: {
            playerId: smokeCandidate.playerId,
            playerName: smokeCandidate.playerName,
          },
          before: {
            cash: beforeTeam.cash,
            points: beforeTeam.points,
            rank: beforeTeam.rank,
            roster: beforeTeam.rosterCount,
            salary: beforeTeam.salaryTotal,
            marketValue: beforeTeam.marketValueTotal,
          },
          afterBuy: {
            cash: afterBuyTeam.cash,
            points: afterBuyTeam.points,
            rank: afterBuyTeam.rank,
            roster: afterBuyTeam.rosterCount,
            salary: afterBuyTeam.salaryTotal,
            marketValue: afterBuyTeam.marketValueTotal,
          },
          afterSell: {
            cash: afterSellTeam.cash,
            points: afterSellTeam.points,
            rank: afterSellTeam.rank,
            roster: afterSellTeam.rosterCount,
            salary: afterSellTeam.salaryTotal,
            marketValue: afterSellTeam.marketValueTotal,
          },
          afterStandingsApply: {
            cash: afterStandingsTeam.cash,
            points: afterStandingsTeam.points,
            rank: afterStandingsTeam.rank,
            roster: afterStandingsTeam.rosterCount,
            salary: afterStandingsTeam.salaryTotal,
            marketValue: afterStandingsTeam.marketValueTotal,
          },
          afterCashApply: {
            cash: afterCashTeam.cash,
            points: afterCashTeam.points,
            rank: afterCashTeam.rank,
            roster: afterCashTeam.rosterCount,
            salary: afterCashTeam.salaryTotal,
            marketValue: afterCashTeam.marketValueTotal,
          },
          afterMatchdayAdvance: {
            cash: afterAdvanceTeam.cash,
            points: afterAdvanceTeam.points,
            rank: afterAdvanceTeam.rank,
            roster: afterAdvanceTeam.rosterCount,
            salary: afterAdvanceTeam.salaryTotal,
            marketValue: afterAdvanceTeam.marketValueTotal,
            currentMatchday: progressedSave.gameState.season.currentMatchday,
            activeMatchdayId: progressedSave.gameState.matchdayState.matchdayId,
            pendingTeams: progressedSave.gameState.matchdayState.pendingTeamIds.length,
          },
          resultIds: {
            matchdayResultId: appliedResult.matchdayResultId,
          },
          applyAudits: {
            resultApply: appliedResult.matchdayResultId,
            standingsApply: standingsApply.auditLogId,
            cashApply: cashApply.auditLogId,
            matchdayAdvance: matchdayAdvance.auditLogId,
          },
          warnings: {
            resolve: resolvePreview.warnings,
            standings: standingsPreview.items.flatMap((item) => item.warnings).slice(0, 20),
            prize: prizePreview.globalWarnings,
          },
          transferLoop: {
            buyCreated: buyResult.transferCreated,
            sellCreated: sellResult.transferCreated,
            historyHasBuy: transferHistory.items.some((entry) => entry.type === "buy" && entry.playerId === smokeCandidate.playerId),
            historyHasSell: transferHistory.items.some((entry) => entry.type === "sell" && entry.playerId === smokeCandidate.playerId),
            avgContractAfterSell: roundValue(afterSellTeam.avgContractLength ?? 0, 1).toFixed(1),
          },
          standingsPreview: {
            readyTeams: standingsPreview.summary.readyTeams,
            blockedTeams: standingsPreview.summary.blockedTeamCount,
          },
          prizePreview: {
            calculableTeams: prizePreview.summary.calculableTeams,
            blockedItems: prizePreview.summary.blockedItemsCount,
          },
          smokeAdjustments: {
            lineupRetryAttemptsUsed: true,
            projectedPointsTieSeedApplied: false,
            storedScoreTieMutationApplied: false,
          },
          prismaUnchanged: true,
          testStatus: "passed",
        },
        null,
        2,
      ),
    );
  } finally {
    if (previousActiveSave?.saveId) {
      persistence.activateSave(previousActiveSave.saveId);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
