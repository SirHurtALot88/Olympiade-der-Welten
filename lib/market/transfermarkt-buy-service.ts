import { ActivePlayerRoleTag, ActivePlayerStatus, TransferType, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { buildActivePlayerId } from "@/lib/db/seed/mappers";
import { db } from "@/src/server/db";
import type { ContractShape, ContractYearSalary, RosterPromisedRole } from "@/lib/data/olyDataTypes";
import type { NegotiationScoreBreakdownEntry, PlayerContractPreference } from "@/lib/market/contract-negotiation-preview";

type PrismaLike = Pick<
  PrismaClient,
  "save" | "season" | "team" | "teamSeasonState" | "player" | "activePlayer" | "transfer" | "$transaction"
>;

export type TransfermarktBuyParams = {
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  contractLength?: number;
  contractShape?: ContractShape;
  offeredSalary?: number;
  promisedRole?: RosterPromisedRole;
  transferSource?: string;
  purchasePriceOverride?: number;
  purchasePriceOverrideReason?: string;
  allowRecentlySoldRebuyOverride?: boolean;
  fastLocalBatch?: boolean;
  localRunContext?: unknown;
  deferPersist?: boolean;
};

export type TransfermarktBuyPreview = {
  canBuy: boolean;
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
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  marketValueBefore: number | null;
  marketValueAfter: number | null;
  rosterBefore: number | null;
  rosterAfter: number | null;
  purchasePrice: number | null;
  salary: number | null;
  contractLength: number;
  contractShape?: ContractShape;
  promisedRole?: RosterPromisedRole | null;
  currentValue: number | null;
  joinedSeasonId: string;
  expectedSalary?: number | null;
  baseExpectedSalary?: number | null;
  demandMultiplier?: number | null;
  offeredSalary?: number | null;
  offerRatio?: number | null;
  yearlySalarySchedule?: ContractYearSalary[];
  totalSalary?: number | null;
  roundingAdjustment?: number | null;
  buyoutCost?: number | null;
  bracket?: number | null;
  teamFit?: number | null;
  acceptanceScore?: number | null;
  acceptChance?: number | null;
  counterChance?: number | null;
  rejectChance?: number | null;
  contractPreference?: PlayerContractPreference | null;
  negotiationScoreBreakdown?: NegotiationScoreBreakdownEntry[];
  negotiationReasons?: string[];
  negotiationWarnings?: string[];
  negotiationBlockingReasons?: string[];
  dealPressure?: {
    happinessPressure: number | null;
    trustRisk: number | null;
    pushPressure: number | null;
    signals: string[];
  } | null;
};

export type TransfermarktBuyExecuteResult = TransfermarktBuyPreview & {
  activePlayerCreated: boolean;
  transferCreated: boolean;
  teamSeasonStateUpdated: boolean;
  activePlayerId: string | null;
  transferId: string | null;
};

type ResolvedBuyContext = {
  preview: TransfermarktBuyPreview;
  teamSeasonState: {
    id: string;
    saveId: string;
    seasonId: string;
    teamId: string;
    cash: number;
  } | null;
  playerAttributes: {
    marketValue: number;
    salaryDemand: number;
  } | null;
};

function normalizeContractLength(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.round(value));
}

async function resolveBuyContext(
  database: PrismaLike,
  params: TransfermarktBuyParams,
): Promise<ResolvedBuyContext> {
  const contractLength = normalizeContractLength(params.contractLength);
  const [save, season, team, teamSeasonState, player, activePlayerScopeRows, currentRosterRows] = await Promise.all([
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
    database.player.findUnique({
      where: { id: params.playerId },
      select: {
        id: true,
        name: true,
        className: true,
        race: true,
        attributes: {
          select: {
            marketValue: true,
            salaryDemand: true,
          },
        },
      },
    }),
    database.activePlayer.findMany({
      where: {
        saveId: params.saveId,
        seasonId: params.seasonId,
        OR: [{ playerId: params.playerId }],
      },
      select: {
        id: true,
        playerId: true,
        teamId: true,
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
        currentValue: true,
        purchasePrice: true,
      },
    }),
  ]);

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!save) {
    blockingReasons.push("save_not_found");
  }
  if (!season) {
    blockingReasons.push("season_not_found");
  }
  if (save && season && season.saveId !== save.id) {
    blockingReasons.push("season_not_in_save");
  }
  if (!team) {
    blockingReasons.push("team_not_found");
  }
  if (!teamSeasonState) {
    blockingReasons.push("team_season_state_not_found");
  }
  if (!player) {
    blockingReasons.push("player_not_found");
  }
  if (player && !player.attributes) {
    blockingReasons.push("player_attribute_missing");
  }
  if (activePlayerScopeRows.some((row) => row.playerId === params.playerId)) {
    blockingReasons.push("player_not_free_agent_in_scope");
    blockingReasons.push("active_player_duplicate");
  }

  const purchasePrice = player?.attributes?.marketValue ?? null;
  const salary = player?.attributes?.salaryDemand ?? null;
  const rosterBefore = currentRosterRows.length;
  const salaryBefore = currentRosterRows.reduce((sum, row) => sum + row.salary, 0);
  const marketValueBefore = currentRosterRows.reduce(
    (sum, row) => sum + (row.currentValue ?? row.purchasePrice ?? 0),
    0,
  );
  const cashBefore = teamSeasonState?.cash ?? null;
  const rosterLimit = teamSeasonState?.rosterLimit ?? null;

  if (purchasePrice == null || purchasePrice <= 0) {
    blockingReasons.push("market_value_missing");
  }
  if (salary == null || salary <= 0) {
    blockingReasons.push("salary_demand_missing");
  }
  if (rosterLimit != null && rosterBefore >= rosterLimit) {
    blockingReasons.push("roster_limit_reached");
  }
  if (cashBefore != null && purchasePrice != null && cashBefore < purchasePrice) {
    blockingReasons.push("insufficient_cash");
  }
  if (contractLength !== 1) {
    warnings.push("contract_length_override_in_effect");
  }

  const canBuy = blockingReasons.length === 0;

  return {
    teamSeasonState: teamSeasonState
      ? {
          id: teamSeasonState.id,
          saveId: teamSeasonState.saveId,
          seasonId: teamSeasonState.seasonId,
          teamId: teamSeasonState.teamId,
          cash: teamSeasonState.cash,
        }
      : null,
    playerAttributes: player?.attributes
      ? {
          marketValue: player.attributes.marketValue,
          salaryDemand: player.attributes.salaryDemand,
        }
      : null,
    preview: {
      canBuy,
      blockingReasons,
      warnings,
      player: player
        ? {
            id: player.id,
            name: player.name,
            className: player.className,
            race: player.race,
          }
        : null,
      team: team
        ? {
            id: team.id,
            name: team.name,
            shortCode: team.shortCode,
          }
        : null,
      cashBefore,
      cashAfter: canBuy && cashBefore != null && purchasePrice != null ? cashBefore - purchasePrice : cashBefore,
      salaryBefore,
      salaryAfter: canBuy && salary != null ? salaryBefore + salary : salaryBefore,
      marketValueBefore,
      marketValueAfter:
        canBuy && purchasePrice != null ? marketValueBefore + purchasePrice : marketValueBefore,
      rosterBefore,
      rosterAfter: canBuy ? rosterBefore + 1 : rosterBefore,
      purchasePrice,
      salary,
      contractLength,
      currentValue: purchasePrice,
      joinedSeasonId: params.seasonId,
    },
  };
}

export async function previewTransfermarktBuy(
  params: TransfermarktBuyParams,
  database: PrismaLike = db as PrismaLike,
): Promise<TransfermarktBuyPreview> {
  const context = await resolveBuyContext(database, params);
  return context.preview;
}

export async function executeTransfermarktBuy(
  params: TransfermarktBuyParams,
  database: PrismaLike = db as PrismaLike,
): Promise<TransfermarktBuyExecuteResult> {
  const context = await resolveBuyContext(database, params);
  if (!context.preview.canBuy || !context.teamSeasonState || !context.playerAttributes) {
    return {
      ...context.preview,
      activePlayerCreated: false,
      transferCreated: false,
      teamSeasonStateUpdated: false,
      activePlayerId: null,
      transferId: null,
    };
  }

  const playerAttributes = context.playerAttributes;
  const activePlayerId = buildActivePlayerId(params.saveId, params.seasonId, params.playerId);
  const transferId = `transfer-buy:${randomUUID()}`;

  await database.$transaction(async (tx) => {
    await tx.activePlayer.create({
      data: {
        id: activePlayerId,
        saveId: params.saveId,
        seasonId: params.seasonId,
        teamId: params.teamId,
        playerId: params.playerId,
        status: ActivePlayerStatus.active,
        roleTag: ActivePlayerRoleTag.prospect,
        contractLength: context.preview.contractLength,
        salary: playerAttributes.salaryDemand,
        upkeep: playerAttributes.salaryDemand,
        purchasePrice: playerAttributes.marketValue,
        currentValue: playerAttributes.marketValue,
        joinedSeasonId: params.seasonId,
      },
    });

    await tx.transfer.create({
      data: {
        id: transferId,
        saveId: params.saveId,
        seasonId: params.seasonId,
        playerId: params.playerId,
        fromTeamId: null,
        toTeamId: params.teamId,
        type: TransferType.buy,
        fee: playerAttributes.marketValue,
        salary: playerAttributes.salaryDemand,
        marketValue: playerAttributes.marketValue,
        remainingContractLength: context.preview.contractLength,
        happenedAt: new Date(),
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
          decrement: playerAttributes.marketValue,
        },
      },
    });
  });

  return {
    ...context.preview,
    activePlayerCreated: true,
    transferCreated: true,
    teamSeasonStateUpdated: true,
    activePlayerId,
    transferId,
  };
}
