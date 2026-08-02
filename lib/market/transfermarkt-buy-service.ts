import { ActivePlayerRoleTag, ActivePlayerStatus, TransferType, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { buildActivePlayerId } from "@/lib/db/seed/mappers";
import { db } from "@/src/server/db";
import { resolveSeasonOneMarketBuyBlocker } from "@/lib/season/transfer-season-policy";
import type { ContractShape, ContractYearSalary, GameState, RosterPromisedRole } from "@/lib/data/olyDataTypes";
import type {
  NegotiationDemandBreakdownEntry,
  NegotiationScoreBreakdownEntry,
  NegotiationVerdict,
  PlayerContractPreference,
} from "@/lib/market/contract-negotiation-preview";

type PrismaLike = Pick<
  PrismaClient,
  "save" | "season" | "team" | "teamSeasonState" | "player" | "activePlayer" | "transfer" | "$transaction"
>;

export type TransfermarktBuyParams = {
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  /**
   * Optionaler Idempotenz-Schlüssel pro Benutzer-Aktion (z. B. ein Doppelklick oder ein
   * Netzwerk-Retry sendet denselben Schlüssel erneut). Ist er gesetzt, bekommt der
   * Transfer-History-Eintrag eine daraus abgeleitete, deterministische ID; ein zweiter
   * Aufruf mit demselben Schlüssel bucht NICHT erneut (kein doppelter Kaufpreis), sondern
   * meldet den bereits ausgeführten Transfer zurück. Ohne Schlüssel bleibt alles wie bisher.
   */
  idempotencyKey?: string;
  contractLength?: number;
  contractShape?: ContractShape;
  offeredSalary?: number;
  promisedRole?: RosterPromisedRole;
  transferSource?: string;
  purchasePriceOverride?: number;
  purchasePriceOverrideReason?: string;
  allowRecentlySoldRebuyOverride?: boolean;
  /**
   * Root-cause fix (2026-07-04, W-W chronically stuck below hardMin — see
   * outputs/real-engine-s1s5-final/progress-log.md): SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER (any team
   * sold this player already this season) has no override anywhere, unlike the same-team-specific
   * `allowRecentlySoldRebuyOverride`. That cooldown exists to stop healthy teams from speculative
   * sell-then-immediately-rebuy churn — a reasonable rule for the normal buy/sell pipeline. But the
   * emergency-roster-repair fallback (chunked-redraft-topup-service.ts, mode
   * "preseason_roster_repair") is a last-resort mechanism that only ever runs for a team still below
   * hardMin after every earlier tier (unified engine, regular repair) has failed. On a late-season
   * save the free-agent pool's cheap tier can be thin enough that a below-hardMin team's entire
   * legal candidate shortlist is a single player — and losing that one candidate to an unrelated
   * team's independent sale in the same session permanently strands the repair with no fallback of
   * its own, since retrying doesn't change the (correct, by design) cooldown. This flag lets a
   * caller explicitly accept that trade-off for a specific, narrowly-scoped case (a team still below
   * its absolute roster minimum), without weakening the cooldown for any regular buy.
   */
  bypassSoldThisSeasonCooldown?: boolean;
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
  /** K (verhandlung-rework.md Abschnitt 1, Achse C) — Konditionen-Aufschlag in Gehaltsprozent. */
  conditionsAdjustmentPct?: number | null;
  /** D * R_rej — unter diesem Gehalt bricht die Verhandlung ohne Gegenangebot ab. */
  rejectThresholdSalary?: number | null;
  /** D * R_money — reine Geld-Schwelle. */
  moneyThresholdSalary?: number | null;
  /** D * R_full — "Zusage ab X", die feste Schwelle fuer den Tooltip. */
  acceptThresholdSalary?: number | null;
  /** D * P (Stolz-Kappe) — mehr fordert der Spieler nie selbst. */
  prideCapSalary?: number | null;
  /** Deterministisches Verdikt; steuert negotiateBuy() im Client statt eines argmax ueber die
   *  drei Anzeige-Prozente. */
  verdict?: NegotiationVerdict | null;
  /** Geld-Gegenangebot (nur bei verdict === "counter_money"); wird angezeigt, NICHT ins eigene
   *  Angebot zurueckgeschrieben (das war die Ratsche, Abschnitt 4.1). */
  counterSalary?: number | null;
  /** Konditionen-Gegenangebot (nur bei verdict === "counter_conditions"). */
  counterConditions?: { contractLength: number; contractShape: ContractShape } | null;
  contractPreference?: PlayerContractPreference | null;
  demandBreakdown?: NegotiationDemandBreakdownEntry[];
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
  /**
   * Nur beim erfolgreichen LOKALEN Kauf (nicht Prisma, nicht der Fast-Batch-Pfad für AI-Massenkäufe)
   * gesetzt: der volle, bereits persistierte Spielstand direkt nach dem Kauf — inkl. der vom
   * Persistenz-Layer vergebenen neuen `saveVersion` und materialisierten Ableitungen (siehe
   * `persistTransfermarktGameState` in transfermarkt-local-service.ts). Der Buy-Endpunkt kompaktiert
   * ihn (dieselbe `compactFoundationInitialGameState`-Funktion wie der State-Endpunkt) und hängt ihn
   * der Antwort an, damit der Client danach nicht den gesamten Spielstand neu über das Netz holen muss.
   * Bleibt es undefined, fällt der Client auf den bisherigen vollen Reload zurück.
   */
  gameStateAfter?: GameState;
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
  const seasonOneMarketBlocker = resolveSeasonOneMarketBuyBlocker(params.seasonId, params.transferSource);
  if (seasonOneMarketBlocker) {
    blockingReasons.push(seasonOneMarketBlocker);
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
