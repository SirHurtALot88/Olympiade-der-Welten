import { TransferType, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { buildLegacyMatchdayReadiness, type LegacyMatchdayReadinessStatus } from "@/lib/lineups/legacy-matchday-readiness";
import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { LegacyLineupRepository } from "@/lib/lineups/legacy-lineup-repository";
import { normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { resolveTransfermarktSellProceeds } from "@/lib/market/transfermarkt-sell-proceeds";
import { db } from "@/src/server/db";

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

type PrismaLike = Pick<
  PrismaClient,
  | "save"
  | "season"
  | "team"
  | "teamSeasonState"
  | "player"
  | "activePlayer"
  | "transfer"
  | "matchday"
  | "lineupSlot"
  | "$transaction"
>;

export type TransfermarktSellParams = {
  saveId: string;
  seasonId: string;
  teamId: string;
  activePlayerId: string;
  transferSource?: string;
  localRunContext?: unknown;
  deferPersist?: boolean;
};

export type TransfermarktSellPreview = {
  canSell: boolean;
  blockingReasons: string[];
  warnings: string[];
  player: {
    id: string;
    name: string;
    className: string;
    race: string;
  } | null;
  team: {
    id: string;
    name: string;
    shortCode: string;
  } | null;
  activePlayer: {
    id: string;
    playerId: string;
    status: string;
    roleTag: string;
    contractLength: number;
    salary: number;
    purchasePrice: number | null;
    currentValue: number | null;
    joinedSeasonId: string;
  } | null;
  cashBefore: number | null;
  cashAfter: number | null;
  rosterBefore: number | null;
  rosterAfter: number | null;
  teamSalaryBefore: number | null;
  teamSalaryAfter: number | null;
  marketValueReference: number | null;
  saleFactor: number | null;
  salePrice: number | null;
  buyoutCost?: number | null;
  netProceeds?: number | null;
  profit: number | null;
  salaryReduction: number | null;
  projectedReadinessAfterSell: LegacyMatchdayReadinessStatus | "unknown" | null;
  coaching?: import("@/lib/market/transfermarkt-sell-coaching-service").TransfermarktSellCoachingView | null;
  pricingPolicyMultiplier?: number | null;
};

export type TransfermarktSellExecuteResult = TransfermarktSellPreview & {
  activePlayerRemoved: boolean;
  transferCreated: boolean;
  teamSeasonStateUpdated: boolean;
  transferId: string | null;
};

type ResolvedSellContext = {
  preview: TransfermarktSellPreview;
  activePlayer: {
    id: string;
    saveId: string;
    seasonId: string;
    teamId: string;
    playerId: string;
    status: string;
    roleTag: string;
    contractLength: number;
    salary: number;
    purchasePrice: number | null;
    currentValue: number | null;
    joinedSeasonId: string;
  } | null;
  teamSeasonState: {
    id: string;
    saveId: string;
    seasonId: string;
    teamId: string;
    cash: number;
    playerMin: number;
    playerOpt: number;
  } | null;
};

async function buildProjectedReadinessAfterSell(
  database: PrismaLike,
  params: TransfermarktSellParams,
  activePlayerId: string,
): Promise<{
  projectedReadinessAfterSell: LegacyMatchdayReadinessStatus | "unknown" | null;
  warnings: string[];
}> {
  const matchday = await database.matchday.findFirst({
    where: {
      seasonId: params.seasonId,
    },
    orderBy: [{ index: "asc" }],
    select: {
      id: true,
    },
  });

  if (!matchday) {
    return {
      projectedReadinessAfterSell: null,
      warnings: ["matchday_missing_for_readiness_preview"],
    };
  }

  const loader = new LegacyLineupContextLoader(
    database as unknown as typeof db,
    new LegacyLineupRepository(database as unknown as typeof db),
  );
  const loaded = await loader.loadLegacyLineupContext({
    saveId: params.saveId,
    seasonId: params.seasonId,
    matchdayId: matchday.id,
    teamId: params.teamId,
  });

  if (!loaded.ok) {
    return {
      projectedReadinessAfterSell: "unknown",
      warnings: ["readiness_context_unavailable_for_sell_preview"],
    };
  }

  const projectedContext = {
    ...loaded.context,
    activePlayers: loaded.context.activePlayers.filter((row) => row.id !== activePlayerId),
  };

  return {
    projectedReadinessAfterSell: buildLegacyMatchdayReadiness(projectedContext).readinessStatus,
    warnings: loaded.warnings.map((warning) => `readiness_context:${warning}`),
  };
}

async function resolveSellContext(
  database: PrismaLike,
  params: TransfermarktSellParams,
): Promise<ResolvedSellContext> {
  const [save, season, team, teamSeasonState, activePlayer, currentRosterRows, lineupSlots] = await Promise.all([
    database.save.findUnique({
      where: { id: params.saveId },
    }),
    database.season.findUnique({
      where: { id: params.seasonId },
    }),
    database.team.findUnique({
      where: { id: params.teamId },
    }),
    database.teamSeasonState.findUnique({
      where: {
        saveId_seasonId_teamId: {
          saveId: params.saveId,
          seasonId: params.seasonId,
          teamId: params.teamId,
        },
      },
    }),
    database.activePlayer.findUnique({
      where: { id: params.activePlayerId },
      select: {
        id: true,
        saveId: true,
        seasonId: true,
        teamId: true,
        playerId: true,
        status: true,
        roleTag: true,
        contractLength: true,
        salary: true,
        purchasePrice: true,
        currentValue: true,
        joinedSeasonId: true,
        player: {
          select: {
            id: true,
            name: true,
            className: true,
            race: true,
            attributes: {
              select: {
                displayMarketValue: true,
                marketValue: true,
              },
            },
          },
        },
      },
    }),
    database.activePlayer.findMany({
      where: {
        saveId: params.saveId,
        seasonId: params.seasonId,
        teamId: params.teamId,
      },
      select: {
        id: true,
        salary: true,
      },
    }),
    database.lineupSlot.findMany({
      where: {
        activePlayerId: params.activePlayerId,
        lineup: {
          saveId: params.saveId,
          seasonId: params.seasonId,
          teamId: params.teamId,
        },
      },
      select: {
        id: true,
        lineupId: true,
      },
    }),
  ]);

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!save) blockingReasons.push("save_not_found");
  if (!season) blockingReasons.push("season_not_found");
  if (save && season && season.saveId !== save.id) blockingReasons.push("season_not_in_save");
  if (!team) blockingReasons.push("team_not_found");
  if (!teamSeasonState) blockingReasons.push("team_season_state_not_found");
  if (!activePlayer) blockingReasons.push("active_player_not_found");

  if (activePlayer && activePlayer.teamId !== params.teamId) {
    blockingReasons.push("active_player_not_in_team");
  }
  if (activePlayer && activePlayer.saveId !== params.saveId) {
    blockingReasons.push("active_player_not_in_save");
  }
  if (activePlayer && activePlayer.seasonId !== params.seasonId) {
    blockingReasons.push("active_player_not_in_season");
  }
  if (activePlayer && !activePlayer.player) {
    blockingReasons.push("player_not_found");
  }

  const salePrice = normalizeVisibleRosterMoney(
    activePlayer?.currentValue ?? activePlayer?.purchasePrice ?? null,
    activePlayer?.player?.attributes?.displayMarketValue ?? activePlayer?.player?.attributes?.marketValue ?? null,
  );
  const marketValueReference =
    activePlayer?.player?.attributes?.displayMarketValue ??
    activePlayer?.player?.attributes?.marketValue ??
    normalizeVisibleRosterMoney(activePlayer?.currentValue, null) ??
    null;
  const saleFactor =
    salePrice != null && marketValueReference != null && marketValueReference > 0
      ? Number((salePrice / marketValueReference).toFixed(2))
      : null;
  const normalizedPurchasePrice = normalizeVisibleRosterMoney(
    activePlayer?.purchasePrice,
    activePlayer?.player?.attributes?.displayMarketValue ?? activePlayer?.player?.attributes?.marketValue ?? null,
  );
  const sellProceeds =
    activePlayer && salePrice != null
      ? resolveTransfermarktSellProceeds({
          rosterEntry: {
            id: activePlayer.id,
            playerId: activePlayer.playerId,
            teamId: activePlayer.teamId,
            roleTag: activePlayer.roleTag,
            contractLength: activePlayer.contractLength,
            salary: activePlayer.salary,
            contractShape: "balanced",
            purchasePrice: normalizedPurchasePrice,
            joinedSeasonId: activePlayer.joinedSeasonId,
          },
          grossSalePrice: salePrice,
          purchasePrice: normalizedPurchasePrice,
        })
      : null;
  const buyoutCost = sellProceeds?.buyoutCost ?? null;
  const netProceeds = sellProceeds?.netProceeds ?? salePrice;
  const profit =
    netProceeds != null && normalizedPurchasePrice != null
      ? roundValue(Math.abs(netProceeds - normalizedPurchasePrice) < 0.005 ? 0 : netProceeds - normalizedPurchasePrice, 2)
      : sellProceeds?.netProfitVsPurchase ?? null;
  const salaryReduction = activePlayer?.salary ?? null;
  const rosterBefore = currentRosterRows.length;
  const rosterAfter = activePlayer ? Math.max(0, rosterBefore - 1) : rosterBefore;
  const teamSalaryBefore = currentRosterRows.reduce((sum, row) => sum + row.salary, 0);
  const teamSalaryAfter =
    activePlayer && salaryReduction != null ? Math.max(0, teamSalaryBefore - salaryReduction) : teamSalaryBefore;
  const cashBefore = teamSeasonState?.cash ?? null;
  const cashAfter = cashBefore != null && netProceeds != null ? cashBefore + netProceeds : cashBefore;

  if (salePrice == null || salePrice <= 0) {
    blockingReasons.push("sale_price_missing");
  }
  if (salaryReduction == null || salaryReduction < 0) {
    blockingReasons.push("active_player_salary_missing");
  }
  if (activePlayer && activePlayer.status !== "active") {
    blockingReasons.push("active_player_not_active");
  }
  if (lineupSlots.length > 0) {
    warnings.push("active_player_referenced_in_lineup");
  }

  if (teamSeasonState && rosterAfter < 7) warnings.push("team_would_fall_under_7");
  if (teamSeasonState && rosterAfter < teamSeasonState.playerMin) warnings.push("team_would_fall_under_player_min");
  if (teamSeasonState && rosterAfter < teamSeasonState.playerOpt) warnings.push("team_would_fall_under_player_opt");

  const readinessPreview =
    activePlayer && activePlayer.teamId === params.teamId && activePlayer.seasonId === params.seasonId
      ? await buildProjectedReadinessAfterSell(database, params, activePlayer.id)
      : { projectedReadinessAfterSell: null, warnings: [] as string[] };

  warnings.push(...readinessPreview.warnings);
  if (
    readinessPreview.projectedReadinessAfterSell &&
    readinessPreview.projectedReadinessAfterSell !== "ready" &&
    readinessPreview.projectedReadinessAfterSell !== "unknown"
  ) {
    warnings.push("team_readiness_would_get_worse");
  }

  const canSell = blockingReasons.length === 0;

  return {
    activePlayer: activePlayer
      ? {
          id: activePlayer.id,
          saveId: activePlayer.saveId,
          seasonId: activePlayer.seasonId,
          teamId: activePlayer.teamId,
          playerId: activePlayer.playerId,
          status: activePlayer.status,
          roleTag: activePlayer.roleTag,
          contractLength: activePlayer.contractLength,
          salary: activePlayer.salary,
        purchasePrice: normalizedPurchasePrice,
        currentValue: salePrice,
          joinedSeasonId: activePlayer.joinedSeasonId,
        }
      : null,
    teamSeasonState: teamSeasonState
      ? {
          id: teamSeasonState.id,
          saveId: teamSeasonState.saveId,
          seasonId: teamSeasonState.seasonId,
          teamId: teamSeasonState.teamId,
          cash: teamSeasonState.cash,
          playerMin: teamSeasonState.playerMin,
          playerOpt: teamSeasonState.playerOpt,
        }
      : null,
    preview: {
      canSell,
      blockingReasons,
      warnings: Array.from(new Set(warnings)),
      player: activePlayer?.player
        ? {
            id: activePlayer.player.id,
            name: activePlayer.player.name,
            className: activePlayer.player.className,
            race: activePlayer.player.race,
          }
        : null,
      team: team
        ? {
            id: team.id,
            name: team.name,
            shortCode: team.shortCode,
          }
        : null,
      activePlayer: activePlayer
        ? {
            id: activePlayer.id,
            playerId: activePlayer.playerId,
            status: activePlayer.status,
            roleTag: activePlayer.roleTag,
            contractLength: activePlayer.contractLength,
            salary: activePlayer.salary,
            purchasePrice: activePlayer.purchasePrice,
            currentValue: activePlayer.currentValue,
            joinedSeasonId: activePlayer.joinedSeasonId,
          }
        : null,
      cashBefore,
      cashAfter,
      rosterBefore,
      rosterAfter,
      teamSalaryBefore,
      teamSalaryAfter,
      marketValueReference,
      saleFactor,
      salePrice,
      buyoutCost,
      netProceeds,
      profit,
      salaryReduction,
      projectedReadinessAfterSell: readinessPreview.projectedReadinessAfterSell,
    },
  };
}

export async function previewTransfermarktSell(
  params: TransfermarktSellParams,
  database: PrismaLike = db as PrismaLike,
): Promise<TransfermarktSellPreview> {
  const context = await resolveSellContext(database, params);
  return context.preview;
}

export async function executeTransfermarktSell(
  params: TransfermarktSellParams,
  database: PrismaLike = db as PrismaLike,
): Promise<TransfermarktSellExecuteResult> {
  const context = await resolveSellContext(database, params);
  if (!context.preview.canSell || !context.activePlayer || !context.teamSeasonState || !context.preview.player) {
    return {
      ...context.preview,
      activePlayerRemoved: false,
      transferCreated: false,
      teamSeasonStateUpdated: false,
      transferId: null,
    };
  }

  const transferId = `transfer-sell:${randomUUID()}`;
  const salePrice = context.preview.salePrice ?? 0;
  const netProceeds = context.preview.netProceeds ?? salePrice;
  const salary = context.activePlayer.salary;
  const marketValue = context.activePlayer.currentValue ?? context.activePlayer.purchasePrice ?? salePrice;

  await database.$transaction(async (tx) => {
    await tx.transfer.create({
      data: {
        id: transferId,
        saveId: params.saveId,
        seasonId: params.seasonId,
        playerId: context.activePlayer!.playerId,
        fromTeamId: params.teamId,
        toTeamId: null,
        type: TransferType.sell,
        fee: salePrice,
        salary,
        marketValue,
        remainingContractLength: context.activePlayer!.contractLength,
        happenedAt: new Date(),
      },
    });

    await tx.activePlayer.delete({
      where: {
        id: context.activePlayer!.id,
      },
    });

    await tx.teamSeasonState.update({
      where: {
        saveId_seasonId_teamId: {
          saveId: params.saveId,
          seasonId: params.seasonId,
          teamId: params.teamId,
        },
      },
      data: {
        cash: {
          increment: netProceeds,
        },
      },
    });
  });

  return {
    ...context.preview,
    activePlayerRemoved: true,
    transferCreated: true,
    teamSeasonStateUpdated: true,
    transferId,
  };
}
