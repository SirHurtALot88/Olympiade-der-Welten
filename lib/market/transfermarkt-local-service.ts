import { randomUUID } from "node:crypto";

import type { ContractShape, GameState, Player, RosterEntry, RosterPromisedRole, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { getImportedPlayerDisplayMarketValue } from "@/lib/data/player-economy-display";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { getTeamPlayerMax } from "@/lib/foundation/roster-limits";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { buildPlayerScoutPotentialFromGameState } from "@/lib/progression/player-potential-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService, PersistedSaveGame } from "@/lib/persistence/types";
import { calculateTransfermarktFit, getTransfermarktBracket, hasMercenaryTrait } from "@/lib/market/transfermarkt-fit";
import { buildContractNegotiationPreview, recommendContractOfferForPlayer } from "@/lib/market/contract-negotiation-preview";
import {
  getRecentlySoldBySameTeam,
  isRecentlySoldBySameTeam,
  RECENTLY_SOLD_SAME_PRESEASON_BLOCKER,
  RECENTLY_SOLD_SAME_PRESEASON_OVERRIDE_WARNING,
} from "@/lib/market/anti-rebuy-guard";
import { buildTransfermarktSaleFactorBreakdown, normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { buildTransfermarktPoolAudit } from "@/lib/market/transfermarkt-pool-audit";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { getTransfermarktTierFromPoints, type TransfermarktRatingTier } from "@/lib/market/transfermarkt-sheet-stats";
import type {
  TransfermarktBuyExecuteResult,
  TransfermarktBuyParams,
  TransfermarktBuyPreview,
} from "@/lib/market/transfermarkt-buy-service";
import type {
  TransfermarktSellExecuteResult,
  TransfermarktSellParams,
  TransfermarktSellPreview,
} from "@/lib/market/transfermarkt-sell-service";
import type {
  TransferHistoryReadParams,
  TransferHistoryReadResult,
} from "@/lib/market/transfer-history-read-service";
import type {
  TransfermarktFreeAgentItem,
  TransfermarktReadParams,
  TransfermarktReadResult,
} from "@/lib/market/transfermarkt-read-service";

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function buildDiverseFreeAgentSlice(items: TransfermarktFreeAgentItem[], limit: number) {
  const bySportProfile = [...items].sort((left, right) => {
    const leftAxisAverage = ((left.pow ?? 0) + (left.spe ?? 0) + (left.men ?? 0) + (left.soc ?? 0)) / 4;
    const rightAxisAverage = ((right.pow ?? 0) + (right.spe ?? 0) + (right.men ?? 0) + (right.soc ?? 0)) / 4;
    const axisDelta = rightAxisAverage - leftAxisAverage;
    if (axisDelta !== 0) {
      return axisDelta;
    }
    return left.name.localeCompare(right.name, "de", { numeric: true, sensitivity: "base" });
  });

  const classBuckets = new Map<string, TransfermarktFreeAgentItem[]>();
  for (const item of bySportProfile) {
    const key = item.className.trim().toLowerCase() || "unknown";
    const bucket = classBuckets.get(key) ?? [];
    bucket.push(item);
    classBuckets.set(key, bucket);
  }

  const orderedBuckets = [...classBuckets.entries()]
    .sort((left, right) => right[1].length - left[1].length)
    .map(([, bucket]) => bucket);

  const selected: TransfermarktFreeAgentItem[] = [];
  const seen = new Set<string>();
  const add = (item: TransfermarktFreeAgentItem | undefined) => {
    if (!item || seen.has(item.playerId) || selected.length >= limit) {
      return;
    }
    selected.push(item);
    seen.add(item.playerId);
  };

  const sportProfileTarget = Math.min(limit, Math.ceil(limit * 0.55));
  for (const item of bySportProfile) {
    add(item);
    if (selected.length >= sportProfileTarget) {
      break;
    }
  }

  let didAdd = true;

  while (selected.length < limit && didAdd) {
    didAdd = false;
    for (const bucket of orderedBuckets) {
      const next = bucket.shift();
      if (!next) {
        continue;
      }
      const before = selected.length;
      add(next);
      didAdd = didAdd || selected.length > before;
      if (selected.length >= limit) {
        break;
      }
    }
  }

  for (const item of bySportProfile) {
    add(item);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

const localFreeAgentBaseCache = new Map<string, TransfermarktFreeAgentItem[]>();
const localFreeAgentTeamCache = new Map<string, TransfermarktFreeAgentItem[]>();
const localMarketContextCache = new Map<string, LocalMarketContext>();
const localNegotiationPreviewCache = new Map<string, ReturnType<typeof buildContractNegotiationPreview>>();

const getPlayerMarketValue = getImportedPlayerDisplayMarketValue;
const getPlayerSalary = (player: Player) => resolvePlayerEconomyContract({ player }).salary;

export type LocalTransfermarktRunContext = {
  persistence: PersistenceService;
  save: PersistedSaveGame;
  deferredWrites: number;
};

function getPlayerPotentialCacheSignature(gameState: GameState) {
  return (gameState.playerPotential ?? [])
    .map((entry) => `${entry.playerId}:${entry.hiddenPotentialScore ?? "-"}:${entry.confidence ?? 0}:${entry.source}`)
    .sort()
    .join("|");
}

function getPlayerMarketCacheSignature(gameState: GameState) {
  return gameState.players
    .map((player) =>
      [
        player.id,
        player.name,
        player.className,
        player.race,
        getPlayerMarketValue(player) ?? "-",
        getPlayerSalary(player) ?? "-",
        player.coreStats.pow,
        player.coreStats.spe,
        player.coreStats.men,
        player.coreStats.soc,
      ].join(":"),
    )
    .sort()
    .join("|");
}

function normalizeTransfermarktTier(value: string | null | undefined): TransfermarktRatingTier | null {
  if (!value) {
    return null;
  }

  return ["S+", "S", "A", "B", "C", "D", "E", "F"].includes(value)
    ? (value as TransfermarktRatingTier)
    : null;
}

function getTeamRosterCacheSignature(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => `${entry.id}:${entry.playerId}:${entry.salary}:${entry.currentValue ?? "-"}:${entry.contractLength}`)
    .sort()
    .join("|");
}

function getRosterPlayers(playersById: Map<string, Player>, rosterEntries: RosterEntry[]) {
  return rosterEntries
    .map((entry) => ({
      entry,
      player: playersById.get(entry.playerId) ?? null,
    }))
    .filter((item): item is { entry: RosterEntry; player: Player } => Boolean(item.player));
}

function getVisibleRosterSalaryTotal(rosterPlayers: Array<{ entry: RosterEntry; player: Player }>) {
  return roundValue(
    rosterPlayers.reduce(
      (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).salary ?? 0),
      0,
    ),
    2,
  );
}

function getVisibleRosterMarketValueTotal(rosterPlayers: Array<{ entry: RosterEntry; player: Player }>) {
  return roundValue(
    rosterPlayers.reduce(
      (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).marketValue ?? 0),
      0,
    ),
    2,
  );
}

function getTopDisciplineScores(disciplinesById: Map<string, string>, player: Player) {
  return Object.entries(player.disciplineRatings)
    .map(([disciplineId, score]) => ({
      disciplineId,
      disciplineName: disciplinesById.get(disciplineId) ?? disciplineId,
      rawScore: score,
      scoreTier: getTransfermarktTierFromPoints(score),
      ppsLastSeason: null,
    }))
    .sort((left, right) => right.rawScore - left.rawScore)
    .slice(0, 3)
    .map((entry) => ({
      disciplineId: entry.disciplineId,
      disciplineName: entry.disciplineName,
      scoreTier: entry.scoreTier,
      ppsLastSeason: entry.ppsLastSeason,
    }));
}

function derivePromisedRoleForBuy(input: {
  explicitRole?: RosterPromisedRole | null;
  contractLength: number;
  purchasePrice: number | null;
  rosterBefore: number;
}): RosterPromisedRole {
  if (input.explicitRole) {
    return input.explicitRole;
  }

  if (input.contractLength >= 4 || (input.purchasePrice ?? 0) >= 35 || input.rosterBefore < 6) {
    return "starter";
  }
  if (input.contractLength >= 2 || (input.purchasePrice ?? 0) >= 18) {
    return "rotation";
  }
  return "prospect";
}

function resolveLocalSave(saveId?: string) {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const requestedSave = saveId ? persistence.getSaveById(saveId) : null;
  if (saveId && !requestedSave) {
    throw new Error(`SQLite save ${saveId} could not be resolved.`);
  }
  const save =
    requestedSave ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("SQLite save could not be loaded.");
  }

  return { persistence, save };
}

function getLocalRunContext(params: TransfermarktBuyParams): LocalTransfermarktRunContext | null {
  const candidate = params.localRunContext as LocalTransfermarktRunContext | null | undefined;
  if (!candidate || typeof candidate !== "object" || !candidate.save || !candidate.persistence) {
    return null;
  }
  return candidate;
}

export function createLocalTransfermarktRunContext(input: {
  save: PersistedSaveGame;
  persistence?: PersistenceService;
}): LocalTransfermarktRunContext {
  return {
    persistence: input.persistence ?? createPersistenceService(),
    save: input.save,
    deferredWrites: 0,
  };
}

export function flushLocalTransfermarktRunContext(context: LocalTransfermarktRunContext) {
  context.save = context.persistence.saveSingleplayerState(context.save.saveId, context.save.gameState);
  context.deferredWrites = 0;
  return context.save;
}

type LocalTransfermarktBuyContext = {
  marketContext: LocalMarketContext;
  save: ReturnType<typeof resolveLocalSave>["save"];
  gameState: GameState;
  team: GameState["teams"][number] | null;
  player: Player | null;
  teamIdentity: GameState["teamIdentities"][number] | null;
  teamStrategyProfile: ReturnType<typeof getTeamStrategyProfile> | null;
  teamRoster: RosterEntry[];
  rosterPlayers: Array<{ entry: RosterEntry; player: Player }>;
  playerAlreadyOwned: boolean;
  recentlySoldBySameTeam: ReturnType<typeof getRecentlySoldBySameTeam>;
  purchasePrice: number | null;
  salary: number | null;
  cashBefore: number | null;
  salaryBefore: number | null;
  marketValueBefore: number | null;
  rosterBefore: number;
  contractLength: number;
  contractShape: ContractShape;
  priorRejectedNegotiation: boolean;
  promisedRole: RosterPromisedRole;
  blockingReasons: string[];
  warnings: string[];
};

type LocalTeamMarketContext = {
  team: GameState["teams"][number];
  teamIdentity: GameState["teamIdentities"][number] | null;
  teamStrategyProfile: ReturnType<typeof getTeamStrategyProfile>;
  rosterEntries: RosterEntry[];
  rosterPlayers: Array<{ entry: RosterEntry; player: Player }>;
  visiblePlayers: Player[];
  rosterCount: number;
  salaryTotal: number;
  marketValueTotal: number;
  playerMin: number | null;
  playerOpt: number | null;
  cash: number;
  rosterCacheSignature: string;
};

type LocalMarketContext = {
  save: ReturnType<typeof resolveLocalSave>["save"];
  gameState: GameState;
  playersById: Map<string, Player>;
  teamsById: Map<string, GameState["teams"][number]>;
  teamIdentityById: Map<string, GameState["teamIdentities"][number]>;
  disciplinesById: Map<string, string>;
  rosterPlayerIds: Set<string>;
  rostersByTeamId: Map<string, RosterEntry[]>;
  teamContextsById: Map<string, LocalTeamMarketContext>;
  cacheKey: string;
};

function getLocalMarketContextKey(save: ReturnType<typeof resolveLocalSave>["save"]) {
  const gameState = save.gameState;
  return [
    save.saveId,
    gameState.season.id,
    gameState.players.length,
    gameState.rosters.length,
    gameState.transferHistory.length,
    getPlayerPotentialCacheSignature(gameState),
    getPlayerMarketCacheSignature(gameState),
  ].join(":");
}

function buildLocalMarketContext(save: ReturnType<typeof resolveLocalSave>["save"]): LocalMarketContext {
  const gameState = save.gameState;
  const cacheKey = getLocalMarketContextKey(save);
  const cached = localMarketContextCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const teamIdentityById = new Map(gameState.teamIdentities.map((identity) => [identity.teamId, identity] as const));
  const disciplinesById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline.name] as const));
  const rosterPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const rostersByTeamId = new Map<string, RosterEntry[]>();
  for (const rosterEntry of gameState.rosters) {
    const roster = rostersByTeamId.get(rosterEntry.teamId);
    if (roster) {
      roster.push(rosterEntry);
    } else {
      rostersByTeamId.set(rosterEntry.teamId, [rosterEntry]);
    }
  }

  const teamContextsById = new Map<string, LocalTeamMarketContext>();
  for (const team of gameState.teams) {
    const rosterEntries = rostersByTeamId.get(team.teamId) ?? [];
    const rosterPlayers = getRosterPlayers(playersById, rosterEntries);
    const teamIdentity = teamIdentityById.get(team.teamId) ?? null;
    teamContextsById.set(team.teamId, {
      team,
      teamIdentity,
      teamStrategyProfile: getTeamStrategyProfile(gameState, team.teamId),
      rosterEntries,
      rosterPlayers,
      visiblePlayers: rosterPlayers.map((item) => item.player),
      rosterCount: rosterEntries.length,
      salaryTotal: getVisibleRosterSalaryTotal(rosterPlayers),
      marketValueTotal: getVisibleRosterMarketValueTotal(rosterPlayers),
      playerMin: teamIdentity?.playerMin ?? null,
      playerOpt: teamIdentity?.playerOpt ?? null,
      cash: team.cash,
      rosterCacheSignature: getTeamRosterCacheSignature(gameState, team.teamId),
    });
  }

  const context: LocalMarketContext = {
    save,
    gameState,
    playersById,
    teamsById,
    teamIdentityById,
    disciplinesById,
    rosterPlayerIds,
    rostersByTeamId,
    teamContextsById,
    cacheKey,
  };
  localMarketContextCache.set(cacheKey, context);
  return context;
}

function buildLocalTransfermarktBuyPreviewFromContext(
  params: TransfermarktBuyParams,
  context: LocalTransfermarktBuyContext,
): TransfermarktBuyPreview {
  const {
    marketContext,
    gameState,
    team,
    player,
    teamIdentity,
    teamStrategyProfile,
    rosterPlayers,
    purchasePrice,
    salary,
    cashBefore,
    salaryBefore,
    marketValueBefore,
    rosterBefore,
    contractLength,
    contractShape,
    promisedRole,
    blockingReasons,
    warnings,
    priorRejectedNegotiation,
  } = context;
  const canBuy = blockingReasons.length === 0;
  const negotiationCacheKey = [
    marketContext.cacheKey,
    params.teamId,
    params.playerId,
    contractLength,
    contractShape,
    params.offeredSalary ?? salary ?? "-",
    priorRejectedNegotiation ? "prior_rejected" : "fresh",
    params.saveId ?? marketContext.save.saveId,
  ].join(":");
  let negotiationPreview = localNegotiationPreviewCache.get(negotiationCacheKey);
  if (!negotiationPreview) {
    negotiationPreview = buildContractNegotiationPreview({
      saveId: params.saveId,
      seasonId: gameState.season.id,
      teamId: params.teamId,
      team,
      teamIdentity,
      teamStrategyProfile,
      player,
      rosterPlayers: rosterPlayers.map((item) => item.player),
      contractLength,
      contractShape,
      offeredSalary: params.offeredSalary ?? null,
      priorBadExperience: priorRejectedNegotiation,
      seasonIdBase: gameState.season.id,
      seasonLabelBase: gameState.season.name,
    });
    localNegotiationPreviewCache.set(negotiationCacheKey, negotiationPreview);
  }
  const contractSalary = negotiationPreview.offeredSalary ?? salary;

  return {
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
          id: team.teamId,
          name: team.name,
          shortCode: team.shortCode,
        }
      : null,
    cashBefore,
    cashAfter: canBuy && cashBefore != null && purchasePrice != null ? cashBefore - purchasePrice : cashBefore,
    salaryBefore,
    salaryAfter: canBuy && salaryBefore != null && contractSalary != null ? salaryBefore + contractSalary : salaryBefore,
    marketValueBefore,
    marketValueAfter: canBuy && marketValueBefore != null && purchasePrice != null ? marketValueBefore + purchasePrice : marketValueBefore,
    rosterBefore,
    rosterAfter: canBuy ? rosterBefore + 1 : rosterBefore,
    purchasePrice,
    salary,
    contractLength,
    contractShape,
    promisedRole,
    currentValue: purchasePrice,
    joinedSeasonId: gameState.season.id,
    expectedSalary: negotiationPreview.expectedSalary,
    baseExpectedSalary: negotiationPreview.baseExpectedSalary,
    demandMultiplier: negotiationPreview.demandMultiplier,
    offeredSalary: negotiationPreview.offeredSalary,
    offerRatio: negotiationPreview.offerRatio,
    yearlySalarySchedule: negotiationPreview.yearlySalarySchedule,
    totalSalary: negotiationPreview.totalSalary,
    roundingAdjustment: negotiationPreview.roundingAdjustment,
    buyoutCost: negotiationPreview.buyoutCost,
    bracket: negotiationPreview.bracket,
    teamFit: negotiationPreview.teamFit,
    acceptanceScore: negotiationPreview.acceptanceScore,
    acceptChance: negotiationPreview.acceptChance,
    counterChance: negotiationPreview.counterChance,
    rejectChance: negotiationPreview.rejectChance,
    contractPreference: negotiationPreview.contractPreference,
    negotiationScoreBreakdown: negotiationPreview.scoreBreakdown,
    negotiationReasons: negotiationPreview.reasons,
    negotiationWarnings: negotiationPreview.warnings,
    negotiationBlockingReasons: negotiationPreview.blockingReasons,
  };
}

function resolveLocalTransfermarktBuyContext(params: TransfermarktBuyParams): LocalTransfermarktBuyContext {
  const runContext = getLocalRunContext(params);
  const save = runContext?.save ?? resolveLocalSave(params.saveId).save;
  const marketContext = buildLocalMarketContext(save);
  const { gameState } = marketContext;
  const teamContext = marketContext.teamContextsById.get(params.teamId) ?? null;
  const team = teamContext?.team ?? null;
  const player = marketContext.playersById.get(params.playerId) ?? null;
  const teamIdentity = teamContext?.teamIdentity ?? null;
  const teamStrategyProfile = teamContext?.teamStrategyProfile ?? null;
  const teamRoster = teamContext?.rosterEntries ?? [];
  const rosterPlayers = teamContext?.rosterPlayers ?? [];
  const playerAlreadyOwned = marketContext.rosterPlayerIds.has(params.playerId);
  const recentlySoldBySameTeam = getRecentlySoldBySameTeam({
    gameState,
    seasonId: gameState.season.id,
    teamId: params.teamId,
    playerId: params.playerId,
  });
  const purchasePrice = player ? getPlayerMarketValue(player) : null;
  const salary = player ? getPlayerSalary(player) : null;
  const cashBefore = teamContext?.cash ?? null;
  const salaryBefore = teamContext?.salaryTotal ?? 0;
  const marketValueBefore = teamContext?.marketValueTotal ?? 0;
  const rosterBefore = teamContext?.rosterCount ?? 0;
  const recommendedContract = recommendContractOfferForPlayer({
    player,
    teamStrategyProfile,
    teamCash: cashBefore,
    marketValue: purchasePrice,
  });
  const contractLength =
    typeof params.contractLength === "number" && Number.isFinite(params.contractLength)
      ? Math.max(1, Math.round(params.contractLength))
      : recommendedContract.contractLength;
  const promisedRole = derivePromisedRoleForBuy({
    explicitRole: params.promisedRole ?? null,
    contractLength,
    purchasePrice,
    rosterBefore,
  });
  const contractShape =
    params.contractShape != null
      ? normalizeContractShape(params.contractShape)
      : recommendedContract.contractShape;
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!team) blockingReasons.push("team_not_found");
  if (!player) blockingReasons.push("player_not_found");
  if (playerAlreadyOwned) blockingReasons.push("player_not_free_agent_in_scope");
  if (purchasePrice == null || purchasePrice <= 0) blockingReasons.push("market_value_missing");
  if (salary == null || salary <= 0) blockingReasons.push("salary_demand_missing");
  if (team && rosterBefore >= getTeamPlayerMax(team, teamIdentity)) blockingReasons.push("roster_limit_reached");
  if (team && purchasePrice != null && team.cash < purchasePrice) blockingReasons.push("insufficient_cash");
  if (recentlySoldBySameTeam && !params.allowRecentlySoldRebuyOverride) {
    blockingReasons.push(RECENTLY_SOLD_SAME_PRESEASON_BLOCKER);
  }
  if (typeof params.contractLength === "number" && contractLength !== recommendedContract.contractLength) {
    warnings.push("contract_length_override_in_effect");
  }
  if (recentlySoldBySameTeam && params.allowRecentlySoldRebuyOverride) {
    warnings.push(RECENTLY_SOLD_SAME_PRESEASON_OVERRIDE_WARNING);
  }

  const priorRejectedNegotiation = (gameState.seasonState.contractNegotiationDrafts ?? []).some(
    (draft) =>
      draft.seasonId === gameState.season.id &&
      draft.teamId === params.teamId &&
      draft.playerId === params.playerId &&
      draft.status === "rejected_bad_experience",
  );

  return {
    marketContext,
    save,
    gameState,
    team,
    player,
    teamIdentity,
    teamStrategyProfile,
    teamRoster,
    rosterPlayers,
    playerAlreadyOwned,
    recentlySoldBySameTeam,
    purchasePrice,
    salary,
    cashBefore,
    salaryBefore,
    marketValueBefore,
    rosterBefore,
    contractLength,
    contractShape,
    promisedRole,
    priorRejectedNegotiation,
    blockingReasons,
    warnings,
  };
}

function normalizeContractShape(value: ContractShape | null | undefined): ContractShape {
  return value === "front_loaded" || value === "back_loaded" ? value : "balanced";
}

export function listLocalTransfermarktFreeAgents(input: TransfermarktReadParams = {}): TransfermarktReadResult {
  const { save } = resolveLocalSave(input.saveId ?? undefined);
  const marketContext = buildLocalMarketContext(save);
  const { gameState, playersById, disciplinesById, rosterPlayerIds, cacheKey } = marketContext;
  const selectedTeamContext = input.teamId ? marketContext.teamContextsById.get(input.teamId) ?? null : null;
  const selectedTeam = selectedTeamContext?.team ?? null;
  const teamSalary = selectedTeamContext?.salaryTotal ?? 0;
  const rosterCount = selectedTeamContext?.rosterCount ?? 0;
  const playerMin = selectedTeamContext?.playerMin ?? null;
  const playerOpt = selectedTeamContext?.playerOpt ?? null;

  let baseItems = localFreeAgentBaseCache.get(cacheKey) ?? null;
  if (!baseItems) {
    const playerRatingsById = buildPlayerRatingContractMap(gameState);
    baseItems = gameState.players
      .filter((player) => !rosterPlayerIds.has(player.id))
      .map<TransfermarktFreeAgentItem>((player) => {
        const marketValue = getPlayerMarketValue(player);
        const salary = getPlayerSalary(player);
        const mercenary = hasMercenaryTrait(player);
        const playerRating = playerRatingsById.get(player.id) ?? null;
        const progressionForecast = buildPlayerProgressionForecast({
          gameState,
          player,
          playerRating,
          seasonPerformance: null,
          trainingModeByPlayerId: player.trainingMode ? { [player.id]: player.trainingMode } : null,
          currentXP: player.currentXP ?? 0,
          spentXP: player.spentXP ?? 0,
          lifetimeXP: player.lifetimeXP ?? null,
        });
        const scoutPotential = buildPlayerScoutPotentialFromGameState({
          gameState,
          player,
          saveId: save.saveId,
          scoutingLevel: 0,
        });

        return {
        playerId: player.id,
        name: player.name,
        className: player.className,
        race: player.race,
        alignment: player.alignment,
        gender: player.gender,
        subclasses: player.subclasses,
        traitsPositive: player.traitsPositive,
        traitsNegative: player.traitsNegative,
        preferredDisciplineIds: player.preferredDisciplineIds,
        subclass1: player.subclasses[0] ?? null,
        subclass2: player.subclasses[1] ?? null,
        subclass3: player.subclasses[2] ?? null,
        traitPos1: player.traitsPositive[0] ?? null,
        traitPos2: player.traitsPositive[1] ?? null,
        traitPos3: player.traitsPositive[2] ?? null,
        traitNeg1: player.traitsNegative[0] ?? null,
        traitNeg2: player.traitsNegative[1] ?? null,
        traitNeg3: player.traitsNegative[2] ?? null,
        marketValue,
        ovr: playerRating?.ovrNormalized ?? null,
        mvs: playerRating?.mvs ?? null,
        salary,
        marketValueSalaryRatio:
          marketValue != null && salary != null && salary > 0 ? roundValue(marketValue / salary, 2) : null,
        bracket: getTransfermarktBracket(marketValue),
        salaryStatus: salary != null ? "known" : "missing",
        pow: player.coreStats.pow,
        spe: player.coreStats.spe,
        men: player.coreStats.men,
        soc: player.coreStats.soc,
        powTier: getTransfermarktTierFromPoints(player.coreStats.pow),
        speTier: getTransfermarktTierFromPoints(player.coreStats.spe),
        menTier: getTransfermarktTierFromPoints(player.coreStats.men),
        socTier: getTransfermarktTierFromPoints(player.coreStats.soc),
        above20: player.disciplineTierCounts.above20,
        above40: player.disciplineTierCounts.above40,
        above60: player.disciplineTierCounts.above60,
        above80: player.disciplineTierCounts.above80,
        powerRating: normalizeTransfermarktTier(player.attributeSheetRatings?.powerRating),
        healthRating: normalizeTransfermarktTier(player.attributeSheetRatings?.healthRating),
        staminaRating: normalizeTransfermarktTier(player.attributeSheetRatings?.staminaRating),
        intelligenceRating: normalizeTransfermarktTier(player.attributeSheetRatings?.intelligenceRating),
        determinationRating: normalizeTransfermarktTier(player.attributeSheetRatings?.determinationRating),
        awarenessRating: normalizeTransfermarktTier(player.attributeSheetRatings?.awarenessRating),
        speedRating: normalizeTransfermarktTier(player.attributeSheetRatings?.speedRating),
        dexterityRating: normalizeTransfermarktTier(player.attributeSheetRatings?.dexterityRating),
        charismaRating: normalizeTransfermarktTier(player.attributeSheetRatings?.charismaRating),
        willRating: normalizeTransfermarktTier(player.attributeSheetRatings?.willRating),
        spiritRating: normalizeTransfermarktTier(player.attributeSheetRatings?.spiritRating),
        tormentRating: normalizeTransfermarktTier(player.attributeSheetRatings?.tormentRating),
        topDisciplineScores: getTopDisciplineScores(disciplinesById, player),
        currentAbilityTier: progressionForecast.currentAbilityTier,
        potentialTier:
          scoutPotential.scoutRating == null
            ? progressionForecast.potentialTier
            : getTransfermarktTierFromPoints(scoutPotential.scoutRating),
        potentialBand: scoutPotential.band,
        potentialRange: scoutPotential.potentialRange,
        scoutingConfidence: scoutPotential.confidence,
        scoutingSource: scoutPotential.source,
        scoutingWarnings: scoutPotential.warnings,
        marketValuePotentialPremiumPct: scoutPotential.marketValuePotentialPremiumPct,
        trainingFormTier: progressionForecast.trainingFormTier,
        developmentTrend: progressionForecast.xpTrend,
        developmentRoute: progressionForecast.developmentRoute,
        regressionRisk: progressionForecast.regressionRisk,
        portraitPath: player.portraitPath ?? null,
        portraitUrl: player.portraitUrl ?? null,
        imageUrl: null,
        availabilityReason: "free_agent",
        teamContextAvailable: false,
        teamCash: null,
        teamSalary: null,
        rosterCount: null,
        playerMin: null,
        playerOpt: null,
        readinessStatus: "unknown",
        affordabilityStatus: null,
        rosterPressureStatus: null,
        fitRace: null,
        fitSubclasses: null,
        fitTraits: null,
        fitAlignment: null,
        mercenary,
        fit: null,
        fitDisplay: "Team waehlen",
        fitSource: "select_team_for_fit",
      };
    });
    localFreeAgentBaseCache.set(cacheKey, baseItems);
  }

  const selectedRosterPlayers = selectedTeamContext?.visiblePlayers ?? [];
  const selectedScoutingLevel = selectedTeam
    ? getFacilityLevel(getTeamFacilityState(gameState, selectedTeam.teamId), "scouting_office")
    : 0;
  const teamCacheKey = selectedTeam
    ? [
        cacheKey,
        selectedTeam.teamId,
        selectedTeamContext?.cash ?? selectedTeam.cash,
        selectedScoutingLevel,
        playerMin ?? "-",
        playerOpt ?? "-",
        selectedTeamContext?.rosterCacheSignature ?? getTeamRosterCacheSignature(gameState, selectedTeam.teamId),
      ].join(":")
    : `${cacheKey}:__no_team__`;
  let items = localFreeAgentTeamCache.get(teamCacheKey) ?? null;
  if (!items) {
    items = baseItems.map<TransfermarktFreeAgentItem>((baseItem) => {
      const player = playersById.get(baseItem.playerId) ?? null;
      const fitBreakdown =
        selectedTeam && player
          ? calculateTransfermarktFit(player, selectedRosterPlayers, { teamId: selectedTeam.teamId })
          : {
              fitRace: 0,
              fitSubclasses: 0,
              fitTraits: 0,
              fitAlignment: 0,
              teamFit: selectedTeam ? 0 : null,
            };
      const scoutPotential = player
        ? buildPlayerScoutPotentialFromGameState({
            gameState,
            player,
            saveId: save.saveId,
            scoutingLevel: selectedScoutingLevel,
          })
        : null;

      return {
        ...baseItem,
        potentialTier:
          scoutPotential?.scoutRating == null
            ? baseItem.potentialTier
            : getTransfermarktTierFromPoints(scoutPotential.scoutRating),
        potentialBand: scoutPotential?.band ?? baseItem.potentialBand,
        potentialRange: scoutPotential?.potentialRange ?? baseItem.potentialRange,
        scoutingConfidence: scoutPotential?.confidence ?? baseItem.scoutingConfidence,
        scoutingSource: scoutPotential?.source ?? baseItem.scoutingSource,
        scoutingWarnings: scoutPotential?.warnings ?? baseItem.scoutingWarnings,
        marketValuePotentialPremiumPct:
          scoutPotential?.marketValuePotentialPremiumPct ?? baseItem.marketValuePotentialPremiumPct,
        teamContextAvailable: Boolean(selectedTeam),
        teamCash: selectedTeam?.cash ?? null,
        teamSalary: selectedTeam ? teamSalary : null,
        rosterCount: selectedTeam ? rosterCount : null,
        playerMin,
        playerOpt,
        affordabilityStatus:
          !selectedTeam || baseItem.marketValue == null
            ? null
            : selectedTeam.cash >= baseItem.marketValue
              ? "affordable"
              : "too_expensive",
        rosterPressureStatus:
          !selectedTeam || playerMin == null || playerOpt == null
            ? null
            : rosterCount < playerMin
              ? "under_min"
              : rosterCount < playerOpt
                ? "under_opt"
                : "at_or_above_opt",
        fitRace: selectedTeam ? fitBreakdown.fitRace : null,
        fitSubclasses: selectedTeam ? fitBreakdown.fitSubclasses : null,
        fitTraits: selectedTeam ? fitBreakdown.fitTraits : null,
        fitAlignment: selectedTeam ? fitBreakdown.fitAlignment : null,
        fit: selectedTeam ? fitBreakdown.teamFit : null,
        fitDisplay:
          !selectedTeam
            ? "Team waehlen"
            : baseItem.mercenary
              ? `${fitBreakdown.teamFit ?? 0} · Mercenary`
              : `${fitBreakdown.teamFit ?? 0}`,
        fitSource: selectedTeam ? "local_approximation_not_golden_master" : "select_team_for_fit",
      };
    });
    localFreeAgentTeamCache.set(teamCacheKey, items);
  }

  const search = input.search?.trim().toLowerCase() ?? "";
  const minMarketValue = input.minMarketValue ?? null;
  const maxMarketValue = input.maxMarketValue ?? null;
  const filtered = items.filter((item) => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search);
    const matchesMin = minMarketValue == null || (item.marketValue ?? Number.NEGATIVE_INFINITY) >= minMarketValue;
    const matchesMax = maxMarketValue == null || (item.marketValue ?? Number.POSITIVE_INFINITY) <= maxMarketValue;
    const recentlySoldBySelectedTeam =
      selectedTeam != null &&
      isRecentlySoldBySameTeam({
        gameState,
        seasonId: gameState.season.id,
        teamId: selectedTeam.teamId,
        playerId: item.playerId,
      });
    return matchesSearch && matchesMin && matchesMax && !recentlySoldBySelectedTeam;
  });

  const itemLimit = input.limit ?? 250;
  const visibleItems = buildDiverseFreeAgentSlice(filtered, itemLimit);

  return {
    items: visibleItems,
    total: filtered.length,
    scope: {
      saveId: save.saveId,
      seasonId: gameState.season.id,
      teamId: selectedTeam?.teamId ?? null,
    },
    teamContext: selectedTeam
      ? {
          teamId: selectedTeam.teamId,
          teamCash: selectedTeam.cash,
          teamSalary,
          rosterCount,
          playerMin: playerMin ?? 0,
          playerOpt: playerOpt ?? 0,
          readinessStatus: "unknown",
          affordabilityStatus: "affordable",
          rosterPressureStatus:
            playerMin != null && rosterCount < playerMin
              ? "under_min"
              : playerOpt != null && rosterCount < playerOpt
                ? "under_opt"
                : "at_or_above_opt",
        }
      : null,
    source: "derived_free_agents",
    notes: ["SQLite/local free agents derived directly from the active singleplayer save."],
    warnings: [],
    poolAudit: buildTransfermarktPoolAudit({
      activeFreeAgents: filtered,
      visibleFeed: visibleItems,
      candidatePool: null,
    }),
  };
}

export function previewLocalTransfermarktBuy(params: TransfermarktBuyParams): TransfermarktBuyPreview {
  const context = resolveLocalTransfermarktBuyContext(params);
  return buildLocalTransfermarktBuyPreviewFromContext(params, context);
}

export function executeLocalTransfermarktBuy(params: TransfermarktBuyParams): TransfermarktBuyExecuteResult {
  const runContext = getLocalRunContext(params);
  const { persistence } = runContext ?? resolveLocalSave(params.saveId);
  const context = resolveLocalTransfermarktBuyContext(params);
  const { save } = context;
  const preview = buildLocalTransfermarktBuyPreviewFromContext(params, context);
  if (!preview.canBuy || !preview.player || !preview.team || preview.purchasePrice == null || preview.salary == null) {
    return {
      ...preview,
      activePlayerCreated: false,
      transferCreated: false,
      teamSeasonStateUpdated: false,
      activePlayerId: null,
      transferId: null,
    };
  }

  const transferHistoryId = `history-${randomUUID()}`;
  const nextState: GameState = {
    ...save.gameState,
    teams: save.gameState.teams.map((team) =>
      team.teamId === params.teamId
        ? {
            ...team,
            cash: team.cash - preview.purchasePrice!,
          }
        : team,
    ),
    rosters: [
      ...save.gameState.rosters,
      {
        id: `roster-${randomUUID()}`,
        teamId: params.teamId,
        playerId: params.playerId,
        contractLength: preview.contractLength,
        salary: preview.offeredSalary ?? preview.salary,
        upkeep: preview.offeredSalary ?? preview.salary,
        purchasePrice: preview.purchasePrice,
        currentValue: preview.currentValue,
        roleTag: "prospect",
        promisedRole: preview.promisedRole ?? null,
        joinedSeasonId: save.gameState.season.id,
      },
    ],
    transferHistory: [
      {
        id: transferHistoryId,
        playerId: params.playerId,
        seasonId: save.gameState.season.id,
        matchdayId: save.gameState.matchdayState.matchdayId ?? null,
        phase: LOCAL_TRANSFER_WINDOW_PHASE,
        source: params.transferSource ?? "manual_transfermarkt_buy",
        seasonLabel: getCanonicalSeasonLabel({
          seasonId: save.gameState.season.id,
          seasonName: save.gameState.season.name,
        }),
        transferType: "buy",
        fromTeamId: null,
        toTeamId: params.teamId,
        fee: preview.purchasePrice,
        salary: preview.offeredSalary ?? preview.salary,
        marketValue: preview.purchasePrice,
        remainingContractLength: preview.contractLength,
        happenedAt: new Date().toISOString(),
      } satisfies TransferHistoryEntry,
      ...save.gameState.transferHistory,
    ],
  };

  if (runContext) {
    runContext.save = {
      ...runContext.save,
      gameState: nextState,
    };
    runContext.deferredWrites += 1;
    if (!params.deferPersist) {
      flushLocalTransfermarktRunContext(runContext);
    }
  } else {
    persistence.saveSingleplayerState(save.saveId, nextState);
  }

  return {
    ...preview,
    activePlayerCreated: true,
    transferCreated: true,
    teamSeasonStateUpdated: true,
    activePlayerId: `local-roster:${save.saveId}:${params.playerId}`,
    transferId: transferHistoryId,
  };
}

export function listLocalTransferHistory(input: TransferHistoryReadParams = {}): TransferHistoryReadResult {
  const persistence = createPersistenceService();
  const requestedSaveId = input.saveId ?? null;
  const requestedSeasonId = input.seasonId ?? null;
  const requestedSave = requestedSaveId ? persistence.getSaveById(requestedSaveId) : null;
  if (requestedSaveId && !requestedSave) {
    return {
      items: [],
      total: 0,
      scope: {
        saveId: requestedSaveId,
        seasonId: requestedSeasonId ?? "unknown-season",
        teamId: input.teamId ?? null,
        type: input.type ?? null,
      },
      saveContext: {
        source: "sqlite",
        requestedSaveId,
        resolvedSaveId: null,
        requestedSeasonId,
        resolvedSeasonId: null,
        saveName: null,
        saveStatus: null,
        scopeWarning: `Requested save ${requestedSaveId} could not be resolved for local transfer history.`,
      },
    };
  }
  const { save } = resolveLocalSave(input.saveId ?? undefined);
  const gameState = save.gameState;
  const availableSeasonIds = new Set([
    gameState.season.id,
    ...gameState.transferHistory.map((entry) => entry.seasonId),
    ...(gameState.seasonState.seasonSnapshots ?? []).map((snapshot) => snapshot.seasonId),
  ]);
  if (requestedSeasonId && !availableSeasonIds.has(requestedSeasonId)) {
    return {
      items: [],
      total: 0,
      scope: {
        saveId: save.saveId,
        seasonId: requestedSeasonId,
        teamId: input.teamId ?? null,
        type: input.type ?? null,
      },
      saveContext: {
        source: "sqlite",
        requestedSaveId,
        resolvedSaveId: save.saveId,
        requestedSeasonId,
        resolvedSeasonId: null,
        saveName: save.name ?? null,
        saveStatus: save.status ?? null,
        scopeWarning: `Requested season ${requestedSeasonId} is not available in save ${save.saveId}.`,
      },
    };
  }
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));

  const localItems = gameState.transferHistory
    .filter((entry) => (input.seasonId ? entry.seasonId === input.seasonId : true))
    .filter((entry) => (input.type ? entry.transferType === input.type : true))
    .filter((entry) =>
      input.teamId ? entry.fromTeamId === input.teamId || entry.toTeamId === input.teamId : true,
    )
    .map((entry) => ({
      transferId: entry.id,
      type: entry.transferType,
      playerId: entry.playerId,
      playerName:
        gameState.players.find((player) => player.id === entry.playerId)?.name ?? entry.playerId,
      fromTeamId: entry.fromTeamId,
      fromTeamName: entry.fromTeamId ? (teamById.get(entry.fromTeamId)?.name ?? null) : null,
      toTeamId: entry.toTeamId,
      toTeamName: entry.toTeamId ? (teamById.get(entry.toTeamId)?.name ?? null) : null,
      fee: entry.fee,
      salary: entry.salary,
      marketValue: entry.marketValue,
      happenedAt: entry.happenedAt,
      saveId: save.saveId,
      seasonId: entry.seasonId,
      seasonLabel: getCanonicalSeasonLabel({
        seasonId: entry.seasonId,
        seasonName: entry.seasonLabel,
      }),
      matchdayId: entry.matchdayId ?? null,
      phase: entry.phase ?? null,
      source: entry.source ?? null,
      remainingContractLength: entry.remainingContractLength ?? null,
    }));

  const localTransferIds = new Set(localItems.map((entry) => entry.transferId));
  const snapshotItems = (gameState.seasonState.seasonSnapshots ?? [])
    .flatMap((snapshot) =>
      (snapshot.transferSnapshots ?? [])
        .filter((entry) => !localTransferIds.has(entry.transferId))
        .filter((entry) => (input.seasonId ? entry.seasonId === input.seasonId : true))
        .filter((entry) => (input.type ? entry.type === input.type : true))
        .filter((entry) =>
          input.teamId ? entry.fromTeamId === input.teamId || entry.toTeamId === input.teamId : true,
        )
        .filter((entry) => entry.amount != null && entry.salary != null && entry.marketValue != null)
        .map((entry) => ({
          transferId: entry.transferId,
          type: entry.type,
          playerId: entry.playerId,
          playerName: entry.playerName,
          fromTeamId: entry.fromTeamId,
          fromTeamName: entry.fromTeamName,
          toTeamId: entry.toTeamId,
          toTeamName: entry.toTeamName,
          fee: entry.amount as number,
          salary: entry.salary as number,
          marketValue: entry.marketValue as number,
          happenedAt: snapshot.archivedAt,
          saveId: save.saveId,
          seasonId: entry.seasonId,
          seasonLabel: getCanonicalSeasonLabel({
            seasonId: entry.seasonId,
            seasonName: snapshot.seasonName,
          }),
          matchdayId: entry.matchdayId ?? null,
          phase: entry.phase ?? "season_snapshot",
          source: entry.source ?? "season_snapshot_transfer",
          remainingContractLength: entry.contractLength ?? null,
        })),
    );
  const filteredItems = [...localItems, ...snapshotItems].sort(
    (left, right) => Date.parse(right.happenedAt) - Date.parse(left.happenedAt),
  );
  const items = filteredItems.slice(0, input.limit ?? 100);

  return {
    items,
    total: filteredItems.length,
    scope: {
      saveId: save.saveId,
      seasonId: input.seasonId ?? gameState.season.id,
      teamId: input.teamId ?? null,
      type: input.type ?? null,
    },
    saveContext: {
      source: "sqlite",
      requestedSaveId,
      resolvedSaveId: save.saveId,
      requestedSeasonId,
      resolvedSeasonId: input.seasonId ?? gameState.season.id,
      saveName: save.name ?? null,
      saveStatus: save.status ?? null,
      scopeWarning: null,
    },
  };
}

export function previewLocalTransfermarktSell(params: TransfermarktSellParams): TransfermarktSellPreview {
  const { save } = resolveLocalSave(params.saveId);
  const marketContext = buildLocalMarketContext(save);
  const { gameState, playersById } = marketContext;
  const teamContext = marketContext.teamContextsById.get(params.teamId) ?? null;
  const team = teamContext?.team ?? null;
  const activePlayer = gameState.rosters.find((entry) => entry.id === params.activePlayerId) ?? null;
  const player = activePlayer ? playersById.get(activePlayer.playerId) ?? null : null;
  const rosterPlayers = teamContext?.rosterPlayers ?? [];
  const cashBefore = teamContext?.cash ?? null;
  const salePlayer = activePlayer ? playersById.get(activePlayer.playerId) ?? null : null;
  const saleEconomy = resolvePlayerEconomyContract({ player: salePlayer, rosterEntry: activePlayer });
  const saleFactorBreakdown = buildTransfermarktSaleFactorBreakdown(gameState, salePlayer, activePlayer);
  const salePrice = saleFactorBreakdown.salePrice ?? saleEconomy.marketValue;
  const marketValueReference = saleFactorBreakdown.baseMarketValue ?? saleEconomy.marketValue ?? null;
  const saleFactor = saleFactorBreakdown.saleFactor;
  const normalizedPurchasePrice = normalizeVisibleRosterMoney(
    activePlayer?.purchasePrice,
    saleEconomy.purchasePrice,
  );
  const profit =
    salePrice != null && normalizedPurchasePrice != null
      ? roundValue(Math.abs(salePrice - normalizedPurchasePrice) < 0.005 ? 0 : salePrice - normalizedPurchasePrice, 2)
      : null;
  const salaryReduction = saleEconomy.salary;
  const teamSalaryBefore = teamContext?.salaryTotal ?? 0;
  const rosterBefore = teamContext?.rosterCount ?? 0;
  const blockingReasons: string[] = [];

  if (!team) blockingReasons.push("team_not_found");
  if (!activePlayer) blockingReasons.push("active_player_not_found");
  if (activePlayer && activePlayer.teamId !== params.teamId) blockingReasons.push("active_player_not_in_team");
  if (!player) blockingReasons.push("player_not_found");

  const canSell = blockingReasons.length === 0;

  return {
    canSell,
    blockingReasons,
    warnings: [],
    player: player
      ? { id: player.id, name: player.name, className: player.className, race: player.race }
      : null,
    team: team
      ? { id: team.teamId, name: team.name, shortCode: team.shortCode }
      : null,
    activePlayer: activePlayer
      ? {
          id: activePlayer.id,
          playerId: activePlayer.playerId,
          status: "active",
          roleTag: activePlayer.roleTag,
          contractLength: activePlayer.contractLength,
          salary: activePlayer.salary,
          purchasePrice: normalizedPurchasePrice,
          currentValue: normalizeVisibleRosterMoney(activePlayer.currentValue, saleEconomy.marketValue),
          joinedSeasonId: activePlayer.joinedSeasonId,
        }
      : null,
    cashBefore,
    cashAfter: canSell && cashBefore != null && salePrice != null ? cashBefore + salePrice : cashBefore,
    rosterBefore,
    rosterAfter: canSell ? Math.max(0, rosterBefore - 1) : rosterBefore,
    teamSalaryBefore,
    teamSalaryAfter: canSell && salaryReduction != null ? Math.max(0, teamSalaryBefore - salaryReduction) : teamSalaryBefore,
    marketValueReference,
    saleFactor,
    salePrice,
    profit,
    salaryReduction,
    projectedReadinessAfterSell: "unknown",
  };
}

export function executeLocalTransfermarktSell(params: TransfermarktSellParams): TransfermarktSellExecuteResult {
  const { persistence, save } = resolveLocalSave(params.saveId);
  const preview = previewLocalTransfermarktSell(params);
  if (!preview.canSell || !preview.activePlayer || !preview.player || !preview.team) {
    return {
      ...preview,
      activePlayerRemoved: false,
      transferCreated: false,
      teamSeasonStateUpdated: false,
      transferId: null,
    };
  }

  const transferHistoryId = `history-${randomUUID()}`;
  const salePrice = preview.salePrice ?? 0;
  const nextState: GameState = {
    ...save.gameState,
    teams: save.gameState.teams.map((team) =>
      team.teamId === params.teamId
        ? {
            ...team,
            cash: team.cash + salePrice,
          }
        : team,
    ),
    rosters: save.gameState.rosters.filter((entry) => entry.id !== params.activePlayerId),
    transferHistory: [
      {
        id: transferHistoryId,
        playerId: preview.player.id,
        seasonId: save.gameState.season.id,
        matchdayId: save.gameState.matchdayState.matchdayId ?? null,
        phase: LOCAL_TRANSFER_WINDOW_PHASE,
        source: params.transferSource ?? "manual_transfermarkt_sell",
        seasonLabel: getCanonicalSeasonLabel({
          seasonId: save.gameState.season.id,
          seasonName: save.gameState.season.name,
        }),
        transferType: "sell",
        fromTeamId: params.teamId,
        toTeamId: null,
        fee: salePrice,
        salary: preview.salaryReduction ?? 0,
        marketValue: salePrice,
        remainingContractLength: preview.activePlayer.contractLength,
        happenedAt: new Date().toISOString(),
      } satisfies TransferHistoryEntry,
      ...save.gameState.transferHistory,
    ],
  };

  persistence.saveSingleplayerState(save.saveId, nextState);

  return {
    ...preview,
    activePlayerRemoved: true,
    transferCreated: true,
    teamSeasonStateUpdated: true,
    transferId: transferHistoryId,
  };
}
