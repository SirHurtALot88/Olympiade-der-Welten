import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  buildGeneratedFormCardRecordsForSeason,
  calculateFormModifierForSide,
  getLegacyFormCardSourceSummary,
  getLegacyMutatorSourceSummary,
  calculateMutatorModifierForSide,
  createDefaultLineupDraftModifiers,
  ensureLocalFormCardsForSeason,
  getFormCardColorForDisciplineCategory,
  getTeamFormCardOptions,
  buildLegacyMutatorTraitOptionsForRoster,
  normalizeLineupDraftModifiers,
} from "@/lib/lineups/legacy-lineup-modifiers";
import {
  calculateTeamPowerModifierForSide,
  ensureLocalTeamPowersForSeason,
  getTeamPowerOptions,
} from "@/lib/lineups/team-powers";
import { buildLineupDisciplineContract, buildMatchdayLineupContract, countSeasonCaptains, countSeasonLineupDisciplineSides, createLineupDraftId, formatLineupTeamStatusLabel, getSeasonCaptainDisciplineSideKeys, SEASON_CAPTAIN_SLOTS } from "@/lib/lineups/lineup-discipline-contract";
import { buildLegacyLineupAggregateScore, scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import { computeTeamDisciplineRankTable, computeTeamDisciplineRanks } from "@/lib/lineups/team-discipline-ranks";
import { getTeamRelationship } from "@/lib/rivalries/team-rivalries";
import { selectTeamCaptain } from "@/lib/morale/player-demands-service";
import { buildPlayerMoralePerformanceMap } from "@/lib/morale/player-morale-performance";
import type { FormCardPlanRecord, GameState, LineupDraft, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import type {
  LegacyLineupContextLoadResult,
  LegacyLineupDraft,
  LegacyLineupEntryInput,
  LegacyLineupKeyParams,
  LegacyLineupLoadedContext,
  LegacyLineupPreviewResult,
  LegacyLineupSaveResult,
  LegacyLineupValidationOptions,
} from "@/lib/lineups/legacy-lineup-types";
import { getImportedPlayerDisplayMarketValue, getImportedPlayerDisplaySalary } from "@/lib/data/player-economy-display";
import { getInjuryRiskBand, getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import { officialDisciplineWeightTable, playerGeneratorAttributeKeys, type OfficialDisciplineWeightId } from "@/lib/player-generator/official-discipline-weights";
import { getSeasonDisciplineScheduleEntry, withNormalizedSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

function roundScore(value: number) {
  return Number(value.toFixed(2));
}

function resolveLocalSave(saveId?: string, persistence: PersistenceService = createPersistenceService()) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    (saveId ? persistence.getSaveById(saveId) : null) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("SQLite save could not be loaded.");
  }

  return { persistence, save };
}

function toLegacyDraft(draft: LineupDraft): LegacyLineupDraft {
  return {
    lineupId: draft.lineupId,
    saveId: draft.saveId,
    seasonId: draft.seasonId,
    matchdayId: draft.matchdayId,
    teamId: draft.teamId,
    status: draft.status,
    entries: [...draft.entries].sort((left, right) => {
      if (left.disciplineId !== right.disciplineId) {
        return left.disciplineId.localeCompare(right.disciplineId);
      }
      if (left.disciplineSide !== right.disciplineSide) {
        return left.disciplineSide.localeCompare(right.disciplineSide);
      }
      return left.slotIndex - right.slotIndex;
    }),
    modifiers: normalizeLineupDraftModifiers(draft.modifiers),
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

function getStoredDrafts(gameState: GameState) {
  return gameState.seasonState.lineupDrafts ?? [];
}

function clearMissingFormCardSelections(
  draft: LineupDraft,
  validCardIds: Set<string>,
): LineupDraft {
  const modifiers = normalizeLineupDraftModifiers(draft.modifiers);
  const sanitizeCardId = (value: string | null | undefined) => (value && validCardIds.has(value) ? value : null);

  return {
    ...draft,
    modifiers: {
      d1: {
        ...modifiers.d1,
        primaryFormCardId: sanitizeCardId(modifiers.d1.primaryFormCardId),
        secondaryFormCardId: sanitizeCardId(modifiers.d1.secondaryFormCardId),
      },
      d2: {
        ...modifiers.d2,
        primaryFormCardId: sanitizeCardId(modifiers.d2.primaryFormCardId),
        secondaryFormCardId: sanitizeCardId(modifiers.d2.secondaryFormCardId),
      },
    },
  };
}

function getStoredDraft(gameState: GameState, params: LegacyLineupKeyParams) {
  const draft = getStoredDrafts(gameState).find(
    (entry) =>
      entry.saveId === params.saveId &&
      entry.seasonId === params.seasonId &&
      entry.matchdayId === params.matchdayId &&
      entry.teamId === params.teamId,
  );
  return draft ? toLegacyDraft(draft) : null;
}

function buildDisciplineSidePlayerCounts(context: LegacyLineupLoadedContext) {
  const result: Record<string, number> = {};
  const d1 = context.matchdayContract?.discipline1;
  const d2 = context.matchdayContract?.discipline2;
  if (d1?.requiredPlayers != null) {
    result[`${d1.disciplineId}::d1`] = d1.requiredPlayers;
  }
  if (d2?.requiredPlayers != null) {
    result[`${d2.disciplineId}::d2`] = d2.requiredPlayers;
  }
  return result;
}

function buildTeamStatus(gameState: GameState, teamId: string, seasonId: string) {
  const allDrafts = getStoredDrafts(gameState);
  const captainUsedSides = Array.from(
    getSeasonCaptainDisciplineSideKeys({
      lineups: allDrafts,
      teamId,
      seasonId,
    }),
  );
  return {
    lineupFilledCount: countSeasonLineupDisciplineSides({
      lineups: allDrafts,
      teamId,
      seasonId,
    }),
    captainUsedCount: countSeasonCaptains({
      lineups: allDrafts,
      teamId,
      seasonId,
    }),
    captainUsedSides,
  };
}

function buildLocalFatigueMap(gameState: GameState, params: LegacyLineupKeyParams) {
  const normalizedGameState = withNormalizedSeasonDisciplineSchedule(gameState);
  const season = normalizedGameState.season.id === params.seasonId ? normalizedGameState.season : null;
  if (!season) {
    return null;
  }

  const currentIndex = season.matchdayIds.findIndex((matchdayId) => matchdayId === params.matchdayId);
  if (currentIndex <= 0) {
    return {};
  }

  const previousMatchdayIds = season.matchdayIds.slice(Math.max(0, currentIndex - 4), currentIndex);
  const drafts = (normalizedGameState.seasonState.lineupDrafts ?? [])
    .filter((draft) => draft.seasonId === params.seasonId && draft.teamId === params.teamId)
    .filter((draft) => previousMatchdayIds.includes(draft.matchdayId));
  const matchdayOrder = new Map(season.matchdayIds.map((matchdayId, index) => [matchdayId, index]));
  const playerByMatchday = new Map<string, Set<number>>();

  for (const draft of drafts) {
    const order = matchdayOrder.get(draft.matchdayId);
    if (order == null) {
      continue;
    }
    for (const playerId of new Set(draft.entries.map((entry) => entry.playerId))) {
      const used = playerByMatchday.get(playerId) ?? new Set<number>();
      used.add(order);
      playerByMatchday.set(playerId, used);
    }
  }

  const fatigueMap: Record<string, { count: number; multiplier: number }> = {};
  for (const [playerId, orders] of playerByMatchday.entries()) {
    const sorted = Array.from(orders).sort((left, right) => right - left);
    let count = 0;
    let cursor = currentIndex - 1;
    for (const order of sorted) {
      if (order === cursor) {
        count += 1;
        cursor -= 1;
      } else if (order < cursor) {
        break;
      }
    }

    let multiplier = 1;
    if (count >= 4) multiplier = 0.8;
    else if (count >= 3) multiplier = 0.85;
    else if (count >= 2) multiplier = 0.9;
    else if (count >= 1) multiplier = 0.95;

    fatigueMap[playerId] = { count, multiplier };
  }

  return fatigueMap;
}

type SharedLineupContextBase = {
  normalizedGameState: GameState;
  season: GameState["season"];
  matchday: {
    id: string;
    seasonId: string;
    index: number;
    label: string;
    fixtureIds: string[];
    status: string;
  };
  lineupContract: ReturnType<typeof buildLineupDisciplineContract>;
  matchdayContract: ReturnType<typeof buildMatchdayLineupContract>;
  requiredDisciplineIds: string[];
  rankDisciplineIds: string[];
  playersById: Map<string, Player>;
  rosterEntriesByTeamId: Map<string, RosterEntry[]>;
  teamById: Map<string, GameState["teams"][number]>;
  teamIdentityByTeamId: Map<string, NonNullable<GameState["teamIdentities"][number]>>;
  localDisciplineWeights: Array<{
    disciplineId: string;
    attributeKey: string;
    weightPct: number;
  }>;
  scoreByPlayerAndDiscipline: Map<string, number>;
  fatigueByTeamId: Map<string, ReturnType<typeof buildLocalFatigueMap>>;
  teamDisciplineRanksByTeamId: Map<string, ReturnType<typeof computeTeamDisciplineRanks>>;
  disciplineRankTable: ReturnType<typeof computeTeamDisciplineRankTable>;
  teamNameById: Map<string, string>;
};

const sharedLineupContextBaseCache = new Map<string, SharedLineupContextBase>();

function buildSharedLineupContextBaseCacheKey(gameState: GameState, params: LegacyLineupKeyParams) {
  const rosterSignature = gameState.rosters
    .map((entry) => `${entry.teamId}:${entry.playerId}:${entry.salary}:${entry.contractLength}`)
    .sort()
    .join("|");
  const lineupDraftSignature = (gameState.seasonState.lineupDrafts ?? [])
    .map((draft) => `${draft.lineupId}:${draft.updatedAt}:${draft.entries.length}:${draft.status}`)
    .sort()
    .join("|");
  return [
    params.saveId,
    params.seasonId,
    params.matchdayId,
    gameState.players.length,
    gameState.disciplines.length,
    gameState.rosters.length,
    gameState.seasonState.formCards?.length ?? 0,
    gameState.seasonState.teamPowers?.length ?? 0,
    JSON.stringify(gameState.seasonState.teamFacilities ?? {}),
    rosterSignature,
    lineupDraftSignature,
  ].join("::");
}

function getSharedLineupContextBase(gameState: GameState, params: LegacyLineupKeyParams): SharedLineupContextBase | null {
  const gameStateWithFormCards = ensureLocalFormCardsForSeason(gameState, params.saveId, params.seasonId);
  const hasCurrentSeasonPowers = (gameStateWithFormCards.seasonState.teamPowers ?? []).some(
    (power) => power.seasonId === params.seasonId,
  );
  const gameStateWithPowers = hasCurrentSeasonPowers
    ? gameStateWithFormCards
    : ensureLocalTeamPowersForSeason(gameStateWithFormCards, params.saveId, params.seasonId);
  const cacheKey = buildSharedLineupContextBaseCacheKey(gameStateWithPowers, params);
  const cached = sharedLineupContextBaseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const normalizedGameState = withNormalizedSeasonDisciplineSchedule(gameStateWithPowers);
  const season = normalizedGameState.season.id === params.seasonId ? normalizedGameState.season : null;
  const matchdayIndex = season ? season.matchdayIds.findIndex((matchdayId) => matchdayId === params.matchdayId) : -1;
  const scheduleEntry =
    season && matchdayIndex >= 0 ? getSeasonDisciplineScheduleEntry(normalizedGameState, params.matchdayId) : null;
  const matchday =
    season && matchdayIndex >= 0
      ? {
          id: params.matchdayId,
          seasonId: params.seasonId,
          index: matchdayIndex + 1,
          label: scheduleEntry?.matchdayLabel ?? `Spieltag ${matchdayIndex + 1}`,
          fixtureIds: [],
          status:
            normalizedGameState.matchdayState.matchdayId === params.matchdayId ? normalizedGameState.matchdayState.status : "planning",
        }
      : null;

  if (!season || !matchday) {
    return null;
  }

  const playersById = new Map(normalizedGameState.players.map((player) => [player.id, player] as const));
  const rosterEntriesByTeamId = new Map<string, RosterEntry[]>();
  for (const rosterEntry of normalizedGameState.rosters) {
    const existing = rosterEntriesByTeamId.get(rosterEntry.teamId);
    if (existing) {
      existing.push(rosterEntry);
    } else {
      rosterEntriesByTeamId.set(rosterEntry.teamId, [rosterEntry]);
    }
  }

  const lineupContract = buildLineupDisciplineContract(normalizedGameState.disciplines);
  const matchdayContract = buildMatchdayLineupContract({
    season,
    matchday,
    disciplines: normalizedGameState.disciplines,
    disciplineSchedule: normalizedGameState.seasonState.disciplineSchedule,
  });
  const requiredDisciplineIds = [matchdayContract.discipline1?.disciplineId, matchdayContract.discipline2?.disciplineId].filter(
    (value): value is string => Boolean(value),
  );
  const rankDisciplineIds = Array.from(
    new Set(normalizedGameState.disciplines.map((discipline) => discipline.id).filter((value): value is string => Boolean(value))),
  );
  const scoreDisciplineIds = Array.from(new Set([...requiredDisciplineIds, ...rankDisciplineIds]));

  const scoreByPlayerAndDiscipline = new Map<string, number>();
  for (const player of normalizedGameState.players) {
    for (const disciplineId of scoreDisciplineIds) {
      scoreByPlayerAndDiscipline.set(`${player.id}::${disciplineId}`, roundScore(player.disciplineRatings[disciplineId] ?? 0));
    }
  }

  const localDisciplineWeights = requiredDisciplineIds.flatMap((disciplineId) =>
    playerGeneratorAttributeKeys
      .map((attributeKey) => ({
        disciplineId,
        attributeKey,
        weightPct: officialDisciplineWeightTable[attributeKey][disciplineId as OfficialDisciplineWeightId] ?? 0,
      }))
      .filter((entry) => entry.weightPct > 0)
      .sort((left, right) => right.weightPct - left.weightPct),
  );
  const rosterAssignments = normalizedGameState.rosters.map((entry) => ({
    teamId: entry.teamId,
    playerId: entry.playerId,
  }));
  const disciplineRankTable = computeTeamDisciplineRankTable({
    teamIds: normalizedGameState.teams.map((entry) => entry.teamId),
    disciplineIds: rankDisciplineIds.length > 0 ? rankDisciplineIds : requiredDisciplineIds,
    rosterAssignments,
    scoreByPlayerAndDiscipline,
  });
  const mappedDisciplineRankIds = rankDisciplineIds.length > 0 ? rankDisciplineIds : requiredDisciplineIds;
  const teamDisciplineRanksByTeamId = new Map<string, ReturnType<typeof computeTeamDisciplineRanks>>();
  for (const team of normalizedGameState.teams) {
    teamDisciplineRanksByTeamId.set(
      team.teamId,
      Object.fromEntries(
        mappedDisciplineRankIds.map((disciplineId) => {
          const row = disciplineRankTable.find(
            (entry) => entry.teamId === team.teamId && entry.disciplineId === disciplineId,
          );
          return [
            disciplineId,
            row
              ? {
                  rank: row.rank,
                  score: row.score,
                  sourceStatus: "mapped_with_transform" as const,
                  rankSource: "active_roster_top6_sum_discipline_score",
                }
              : {
                  rank: null,
                  score: null,
                  sourceStatus: "missing_source" as const,
                  rankSource: null,
                },
          ] as const;
        }),
      ),
    );
  }

  const sharedBase: SharedLineupContextBase = {
    normalizedGameState,
    season,
    matchday,
    lineupContract,
    matchdayContract,
    requiredDisciplineIds,
    rankDisciplineIds,
    playersById,
    rosterEntriesByTeamId,
    teamById: new Map(normalizedGameState.teams.map((team) => [team.teamId, team] as const)),
    teamIdentityByTeamId: new Map(normalizedGameState.teamIdentities.map((identity) => [identity.teamId, identity] as const)),
    localDisciplineWeights,
    scoreByPlayerAndDiscipline,
    fatigueByTeamId: new Map(),
    teamDisciplineRanksByTeamId,
    disciplineRankTable,
    teamNameById: new Map(normalizedGameState.teams.map((entry) => [entry.teamId, entry.name] as const)),
  };

  sharedLineupContextBaseCache.set(cacheKey, sharedBase);
  return sharedBase;
}

function buildContextFromGameState(gameState: GameState, params: LegacyLineupKeyParams): LegacyLineupContextLoadResult {
  const sharedBase = getSharedLineupContextBase(gameState, params);
  const normalizedGameState = sharedBase?.normalizedGameState ?? withNormalizedSeasonDisciplineSchedule(gameState);
  const season = sharedBase?.season ?? null;
  const matchday = sharedBase?.matchday ?? null;
  const team = sharedBase?.teamById.get(params.teamId) ?? normalizedGameState.teams.find((entry) => entry.teamId === params.teamId) ?? null;
  const teamIdentity =
    sharedBase?.teamIdentityByTeamId.get(params.teamId) ??
    normalizedGameState.teamIdentities.find((entry) => entry.teamId === params.teamId) ??
    null;
  const teamStrategyProfile = getTeamStrategyProfile(normalizedGameState, params.teamId);

  const errors: string[] = [];
  if (!season) errors.push(`Season ${params.seasonId} could not be found in the local save.`);
  if (!matchday) errors.push(`Matchday ${params.matchdayId} could not be found in the local save.`);
  if (!team) errors.push(`Team ${params.teamId} could not be found in the local save.`);
  if (!teamIdentity) errors.push(`Team identity for ${params.teamId} could not be found in the local save.`);

  if (errors.length > 0 || !season || !matchday || !team || !teamIdentity) {
    return {
      ok: false,
      errors,
      warnings: [],
    };
  }

  const lineupContract = sharedBase?.lineupContract ?? buildLineupDisciplineContract(normalizedGameState.disciplines);
  const matchdayContract =
    sharedBase?.matchdayContract ??
    buildMatchdayLineupContract({
      season,
      matchday,
      disciplines: normalizedGameState.disciplines,
      disciplineSchedule: normalizedGameState.seasonState.disciplineSchedule,
    });
  const requiredDisciplineIds = sharedBase?.requiredDisciplineIds ?? [
    matchdayContract.discipline1?.disciplineId,
    matchdayContract.discipline2?.disciplineId,
  ].filter((value): value is string => Boolean(value));
  const rankDisciplineIds =
    sharedBase?.rankDisciplineIds ??
    Array.from(
      new Set(normalizedGameState.disciplines.map((discipline) => discipline.id).filter((value): value is string => Boolean(value))),
    );
  const mappedDisciplineRankIds = rankDisciplineIds.length > 0 ? rankDisciplineIds : requiredDisciplineIds;
  const rosterEntries = sharedBase?.rosterEntriesByTeamId.get(params.teamId) ?? normalizedGameState.rosters.filter((entry) => entry.teamId === params.teamId);
  const playersById = sharedBase?.playersById ?? new Map(normalizedGameState.players.map((player) => [player.id, player]));
  const activePlayers = rosterEntries
    .map((entry) => ({
      entry,
      player: playersById.get(entry.playerId) ?? null,
    }))
    .filter((item): item is { entry: (typeof rosterEntries)[number]; player: NonNullable<ReturnType<typeof playersById.get>> } => Boolean(item.player));
  const availabilityByPlayerId = new Map(
    activePlayers.map(({ entry }) => [
      entry.playerId,
      getPlayerAvailabilityView(normalizedGameState, entry.playerId, params.teamId, params.matchdayId),
    ] as const),
  );
  const selectableActivePlayers = activePlayers.filter(({ entry }) => !availabilityByPlayerId.get(entry.playerId)?.isUnavailable);
  const existingDraft = getStoredDraft(normalizedGameState, params);
  const existingDraftLineupId = existingDraft?.lineupId ?? null;
  const teamStatus = buildTeamStatus(normalizedGameState, params.teamId, params.seasonId);
  const scoreByPlayerAndDiscipline = sharedBase?.scoreByPlayerAndDiscipline ?? new Map<string, number>();
  let teamDisciplineRanks = sharedBase?.teamDisciplineRanksByTeamId.get(params.teamId);
  if (!teamDisciplineRanks) {
    if (scoreByPlayerAndDiscipline.size === 0) {
      for (const player of normalizedGameState.players) {
        for (const disciplineId of mappedDisciplineRankIds) {
          scoreByPlayerAndDiscipline.set(`${player.id}::${disciplineId}`, roundScore(player.disciplineRatings[disciplineId] ?? 0));
        }
      }
    }
    teamDisciplineRanks = computeTeamDisciplineRanks({
      teamId: params.teamId,
      teamIds: normalizedGameState.teams.map((entry) => entry.teamId),
      disciplineIds: mappedDisciplineRankIds,
      rosterAssignments: normalizedGameState.rosters.map((entry) => ({
        teamId: entry.teamId,
        playerId: entry.playerId,
      })),
      scoreByPlayerAndDiscipline,
    });
    sharedBase?.teamDisciplineRanksByTeamId.set(params.teamId, teamDisciplineRanks);
  }
  const disciplineRankTable =
    sharedBase?.disciplineRankTable ??
    computeTeamDisciplineRankTable({
      teamIds: normalizedGameState.teams.map((entry) => entry.teamId),
      disciplineIds: mappedDisciplineRankIds,
      rosterAssignments: normalizedGameState.rosters.map((entry) => ({
        teamId: entry.teamId,
        playerId: entry.playerId,
      })),
      scoreByPlayerAndDiscipline,
    });
  const teamNameById = sharedBase?.teamNameById ?? new Map(normalizedGameState.teams.map((entry) => [entry.teamId, entry.name] as const));
  const teamPowerWindows = Object.fromEntries(
    requiredDisciplineIds.map((disciplineId) => {
      const top8Rivals = disciplineRankTable
        .filter((row) => row.disciplineId === disciplineId && row.teamId !== params.teamId && row.rank != null && row.rank <= 8)
        .map((row) => ({
          teamId: row.teamId,
          teamName: teamNameById.get(row.teamId) ?? row.teamId,
          rank: row.rank ?? 99,
          relationship: getTeamRelationship(params.teamId, row.teamId)?.value ?? 0,
        }))
        .filter((row) => row.relationship <= -2)
        .sort((left, right) => left.relationship - right.relationship || left.rank - right.rank);
      return [
        disciplineId,
        {
          disciplineId,
          rankSource: "active_roster_top6_sum_discipline_score",
          sourceStatus: "mapped_with_transform",
          top8Rivals,
        },
      ] as const;
    }),
  );
  let fatigueByPlayerId = sharedBase?.fatigueByTeamId.get(params.teamId);
  if (fatigueByPlayerId === undefined) {
    fatigueByPlayerId = buildLocalFatigueMap(normalizedGameState, params);
    sharedBase?.fatigueByTeamId.set(params.teamId, fatigueByPlayerId);
  }
  const localDisciplineWeights = sharedBase?.localDisciplineWeights ?? [];
  const rosterPlayerRefs: LegacyLineupLoadedContext["rosterPlayers"] = activePlayers.map(({ player }) => {
    const availability = availabilityByPlayerId.get(player.id) ?? getPlayerAvailabilityView(normalizedGameState, player.id, params.teamId, params.matchdayId);
    const fatigue = availability.fatigue ?? player.fatigue ?? null;
    const injuryRiskBand = getInjuryRiskBand(fatigue ?? 0);
    return {
      id: player.id,
      name: player.name,
      portraitUrl: player.portraitUrl ?? null,
      className: player.className,
      race: player.race,
      displayMarketValue: getImportedPlayerDisplayMarketValue(player),
      displaySalary: getImportedPlayerDisplaySalary(player),
      potential: player.potential ?? null,
      ovr: player.ovr ?? player.rating ?? null,
      pps: player.pps ?? null,
      fatigue,
      injuryStatus: availability.injuryStatus,
      injuryUntilMatchday: availability.injuryUntilMatchday ?? null,
      injuryRiskPercent: fatigue != null ? injuryRiskBand.riskPercent : null,
      injuryRiskBand: fatigue != null ? injuryRiskBand.label : null,
      injuryRiskLabel: fatigue != null ? injuryRiskBand.uiLabel : null,
      availabilityBlocker: availability.blocker,
      form: player.form ?? null,
      traitsPositive: player.traitsPositive ?? [],
      traitsNegative: player.traitsNegative ?? [],
      attributeStats: player.attributeSheetStats ?? null,
      attributeRatings: {
        power: player.attributeSheetRatings?.powerRating ?? null,
        health: player.attributeSheetRatings?.healthRating ?? null,
        stamina: player.attributeSheetRatings?.staminaRating ?? null,
        intelligence: player.attributeSheetRatings?.intelligenceRating ?? null,
        awareness: player.attributeSheetRatings?.awarenessRating ?? null,
        determination: player.attributeSheetRatings?.determinationRating ?? null,
        speed: player.attributeSheetRatings?.speedRating ?? null,
        dexterity: player.attributeSheetRatings?.dexterityRating ?? null,
        charisma: player.attributeSheetRatings?.charismaRating ?? null,
        will: player.attributeSheetRatings?.willRating ?? null,
        spirit: player.attributeSheetRatings?.spiritRating ?? null,
        torment: player.attributeSheetRatings?.tormentRating ?? null,
      },
      coreStats: {
        pow: player.coreStats.pow,
        spe: player.coreStats.spe,
        men: player.coreStats.men,
        soc: player.coreStats.soc,
      },
    };
  });

  return {
    ok: true,
    warnings: [],
    context: {
      saveId: params.saveId,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      teamId: params.teamId,
      entries: existingDraft?.entries ?? [],
      disciplinePlayerCounts: Object.fromEntries(
        lineupContract.map((entry) => [entry.disciplineId, entry.requiredPlayers ?? 0]),
      ),
      disciplineSidePlayerCounts: Object.fromEntries(
        [matchdayContract.discipline1, matchdayContract.discipline2]
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .map((entry) => [`${entry.disciplineId}::${entry.disciplineSide}`, entry.requiredPlayers ?? 0] as const),
      ),
      disciplineSideCaptainCounts: Object.fromEntries(
        [matchdayContract.discipline1, matchdayContract.discipline2]
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .map((entry) => [`${entry.disciplineId}::${entry.disciplineSide}`, entry.requiredCaptains] as const),
      ),
      activePlayers: selectableActivePlayers.map(({ entry }) => ({
        id: entry.id,
        saveId: params.saveId,
        seasonId: params.seasonId,
        teamId: params.teamId,
        playerId: entry.playerId,
        contractLength: entry.contractLength,
        salary: entry.salary,
        upkeep: entry.upkeep,
        marketValue: entry.currentValue ?? entry.purchasePrice ?? null,
      })),
      disciplineScores: selectableActivePlayers.flatMap(({ player }) =>
        requiredDisciplineIds.map((disciplineId) => ({
          playerId: player.id,
          disciplineId,
          score: roundScore(player.disciplineRatings[disciplineId] ?? 0),
        })),
      ),
      save: {
        id: params.saveId,
        name: `${params.saveId} (local)`,
        status: "active",
      },
      season: {
        id: season.id,
        saveId: params.saveId,
        name: season.name,
        year: season.year,
        currentMatchday: season.currentMatchday,
        status: "active",
      },
      matchday,
      team: {
        id: team.teamId,
        shortCode: team.shortCode,
        name: team.name,
        logoPath: team.logoPath ?? null,
      },
      teamSeasonState: {
        id: `local-team-season-state:${params.saveId}:${params.seasonId}:${params.teamId}`,
        saveId: params.saveId,
        seasonId: params.seasonId,
        teamId: params.teamId,
        cash: team.cash,
        budget: team.budget,
        rosterLimit: team.rosterLimit,
        playerOpt: teamIdentity.playerOpt,
      },
      teamIdentity: {
        pow: teamIdentity.pow,
        spe: teamIdentity.spe,
        men: teamIdentity.men,
        soc: teamIdentity.soc,
      },
      teamStrategyProfile,
      allTeamIdentities: normalizedGameState.teams
        .map((teamEntry) => {
          const identity = normalizedGameState.teamIdentities.find((entry) => entry.teamId === teamEntry.teamId);
          if (!identity) {
            return null;
          }
          return {
            teamId: teamEntry.teamId,
            teamCode: teamEntry.shortCode,
            teamName: teamEntry.name,
            pow: identity.pow,
            spe: identity.spe,
            men: identity.men,
            soc: identity.soc,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      rosterPlayers: rosterPlayerRefs,
      disciplines: normalizedGameState.disciplines.map((discipline) => ({
        id: discipline.id,
        name: discipline.name,
        category: discipline.category,
      })),
      seasonDisciplineSchedule: (normalizedGameState.seasonState.disciplineSchedule ?? []).filter(
        (entry) => entry.seasonId === params.seasonId,
      ),
      disciplineWeights: localDisciplineWeights,
      seasonDisciplineConfigs: lineupContract.map((entry) => ({
        disciplineId: entry.disciplineId,
        originalOrder: entry.order,
        displayOrder: entry.order,
        playerCount: entry.requiredPlayers,
        requiredCaptains: entry.requiredCaptains,
        mutator1: null,
        mutator2: null,
        sourceStatus: entry.sourceStatus,
      })),
      existingDraft,
      contextMeta: {
        ...params,
        d1DisciplineId: matchdayContract.discipline1?.disciplineId ?? null,
        d2DisciplineId: matchdayContract.discipline2?.disciplineId ?? null,
      },
      lineupContract,
      matchdayContract,
      teamStatus: {
        lineupFilledCount: teamStatus.lineupFilledCount,
        totalLineupSides: matchdayContract.totalDisciplineSidesInSeason,
        captainUsedCount: teamStatus.captainUsedCount,
        captainUsedSides: teamStatus.captainUsedSides,
        captainSlots: SEASON_CAPTAIN_SLOTS,
        displayLabel: formatLineupTeamStatusLabel({
          team,
          lineupFilledCount: teamStatus.lineupFilledCount,
          totalLineupSides: matchdayContract.totalDisciplineSidesInSeason,
          captainUsedCount: teamStatus.captainUsedCount,
        }),
      },
      fatigueByPlayerId,
      moraleByPlayerId: null,
      fatigueSourceStatus: fatigueByPlayerId ? "mapped" : "missing_source",
      teamDisciplineRanks: teamDisciplineRanks,
      teamPowerWindows,
      captainRule: {
        seasonCaptainSlots: SEASON_CAPTAIN_SLOTS,
        perDisciplineSideMaxCaptains: 1,
        sourceStatus: "mapped_with_transform",
      },
      formCardSource: getLegacyFormCardSourceSummary(),
      mutatorSource: getLegacyMutatorSourceSummary(),
      teamPowerSource: {
        selectionStatus: "ready",
        effectStatus: "ready",
        sourceLabel: "Team-Powers: drei Identity-Powers mit 4/3/2 Charges plus Facility-Boni auf Level 2/4.",
        warnings: [],
      },
      formCards: getTeamFormCardOptions({
        gameState: normalizedGameState,
        seasonId: params.seasonId,
        teamId: params.teamId,
        lineupId: existingDraftLineupId,
      }),
      formCardPlans: (normalizedGameState.seasonState.formCardPlans ?? []).filter(
        (plan) => plan.seasonId === params.seasonId && plan.teamId === params.teamId,
      ),
      teamPowers: getTeamPowerOptions({
        gameState: normalizedGameState,
        seasonId: params.seasonId,
        teamId: params.teamId,
        lineupId: existingDraftLineupId,
      }),
      mutatorTraitOptions: buildLegacyMutatorTraitOptionsForRoster(rosterPlayerRefs),
    },
  };
}

export function loadLocalLegacyLineupContextFromGameState(
  gameState: GameState,
  params: LegacyLineupKeyParams,
): LegacyLineupContextLoadResult {
  return buildContextFromGameState(gameState, params);
}

function normalizeEntries(entries: LegacyLineupEntryInput[]) {
  return [...entries]
    .map((entry) => ({
      ...entry,
      disciplineId: entry.disciplineId.trim(),
      playerId: entry.playerId.trim(),
      activePlayerId: entry.activePlayerId?.trim() ?? null,
      isCaptain: Boolean(entry.isCaptain),
    }))
    .sort((left, right) => {
      if (left.disciplineId !== right.disciplineId) {
        return left.disciplineId.localeCompare(right.disciplineId);
      }
      if (left.disciplineSide !== right.disciplineSide) {
        return left.disciplineSide.localeCompare(right.disciplineSide);
      }
      return left.slotIndex - right.slotIndex;
    });
}

function buildValidationOptions(context: LegacyLineupLoadedContext): LegacyLineupValidationOptions {
  const previousCaptainKeys = new Set(
    (context.existingDraft?.entries ?? [])
      .filter((entry) => entry.isCaptain)
      .map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
  );
  const captainUsedBeforeCurrentDraftSides = new Set(context.teamStatus?.captainUsedSides ?? []);
  for (const key of previousCaptainKeys) {
    captainUsedBeforeCurrentDraftSides.delete(key);
  }

  return {
    enforceCompleteness: false,
    seasonCaptainLimit: SEASON_CAPTAIN_SLOTS,
    captainUsedBeforeCurrentDraft: Math.max(0, (context.teamStatus?.captainUsedCount ?? 0) - previousCaptainKeys.size),
    captainUsedBeforeCurrentDraftSides: Array.from(captainUsedBeforeCurrentDraftSides),
  };
}

export function loadLocalLegacyLineupContext(
  params: LegacyLineupKeyParams,
  persistence?: PersistenceService,
): LegacyLineupContextLoadResult {
  const { save } = resolveLocalSave(params.saveId, persistence);
  return buildContextFromGameState(save.gameState, {
    ...params,
    saveId: save.saveId,
  });
}

export function getLocalLegacyLineupDraft(params: LegacyLineupKeyParams, persistence?: PersistenceService) {
  const { save } = resolveLocalSave(params.saveId, persistence);
  return getStoredDraft(save.gameState, { ...params, saveId: save.saveId });
}

export function generateLocalLegacyFormCardsForSeason(
  params: LegacyLineupKeyParams,
  persistence?: PersistenceService,
) {
  const { persistence: resolvedPersistence, save } = resolveLocalSave(params.saveId, persistence);
  const effectiveParams = { ...params, saveId: save.saveId };
  if (save.gameState.season.id !== effectiveParams.seasonId) {
    return {
      ok: false as const,
      errors: ["form_cards_season_is_not_active"],
      warnings: ["Formkarten lassen sich nur fuer die aktive lokale Season erzeugen."],
    };
  }

  const generatedCards = buildGeneratedFormCardRecordsForSeason(
    save.gameState,
    effectiveParams.saveId,
    effectiveParams.seasonId,
  );
  const validCardIds = new Set(generatedCards.map((card) => card.id));
  const existingCards = save.gameState.seasonState.formCards ?? [];
  const replacedCardCount = existingCards.filter(
    (card) => card.seasonId === effectiveParams.seasonId,
  ).length;
  const remainingCards = existingCards.filter(
    (card) => card.seasonId !== effectiveParams.seasonId,
  );
  const teamDrafts = getStoredDrafts(save.gameState);
  let scrubbedSelectionCount = 0;
  const nextDrafts = teamDrafts.map((draft) => {
    if (draft.seasonId !== effectiveParams.seasonId) {
      return draft;
    }

    const normalizedBefore = normalizeLineupDraftModifiers(draft.modifiers);
    const nextDraft = clearMissingFormCardSelections(draft, validCardIds);
    const normalizedAfter = normalizeLineupDraftModifiers(nextDraft.modifiers);
    const beforeIds = [
      normalizedBefore.d1.primaryFormCardId,
      normalizedBefore.d1.secondaryFormCardId,
      normalizedBefore.d2.primaryFormCardId,
      normalizedBefore.d2.secondaryFormCardId,
    ];
    const afterIds = [
      normalizedAfter.d1.primaryFormCardId,
      normalizedAfter.d1.secondaryFormCardId,
      normalizedAfter.d2.primaryFormCardId,
      normalizedAfter.d2.secondaryFormCardId,
    ];
    scrubbedSelectionCount += beforeIds.filter((value, index) => value !== afterIds[index]).length;
    return nextDraft;
  });

  const nextGameState: GameState = {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      formCards: [...remainingCards, ...generatedCards],
      lineupDrafts: nextDrafts,
    },
  };
  resolvedPersistence.saveSingleplayerState(save.saveId, nextGameState);

  const rosterPlayerCount = save.gameState.rosters.length;
  const coveredPlayerCount = new Set(generatedCards.map((card) => card.playerId)).size;
  const coveredTeamCount = new Set(generatedCards.map((card) => card.teamId)).size;
  const warnings: string[] = [];
  if (coveredPlayerCount === 0) {
    warnings.push("In dieser Season hat aktuell kein Team klassengebundene Formkartenquellen.");
  } else if (coveredPlayerCount < rosterPlayerCount) {
    warnings.push("Ein Teil der Season-Kader hat keine Formkartenfarbe aus der Legacy-Klassenlogik.");
  }

  return {
    ok: true as const,
    source: "sqlite" as const,
    seasonId: effectiveParams.seasonId,
    rosterPlayerCount,
    coveredPlayerCount,
    coveredTeamCount,
    generatedCardCount: generatedCards.length,
    replacedCardCount,
    scrubbedSelectionCount,
    warnings,
  };
}

export function ensureLocalLegacyFormCardsForSeason(
  params: LegacyLineupKeyParams,
  persistence?: PersistenceService,
) {
  const { persistence: resolvedPersistence, save } = resolveLocalSave(params.saveId, persistence);
  const effectiveParams = { ...params, saveId: save.saveId };
  if (save.gameState.season.id !== effectiveParams.seasonId) {
    return {
      ok: false as const,
      errors: ["form_cards_season_is_not_active"],
      warnings: ["Formkarten lassen sich nur fuer die aktive lokale Season sicherstellen."],
    };
  }

  const existingSeasonCards = (save.gameState.seasonState.formCards ?? []).filter(
    (card) => card.seasonId === effectiveParams.seasonId,
  );
  if (existingSeasonCards.length > 0) {
    return {
      ok: true as const,
      source: "sqlite" as const,
      seasonId: effectiveParams.seasonId,
      generatedCardCount: 0,
      existingCardCount: existingSeasonCards.length,
      warnings: [],
    };
  }

  const nextGameState = ensureLocalFormCardsForSeason(save.gameState, effectiveParams.saveId, effectiveParams.seasonId);
  resolvedPersistence.saveSingleplayerState(save.saveId, nextGameState);
  const generatedCardCount = (nextGameState.seasonState.formCards ?? []).filter(
    (card) => card.seasonId === effectiveParams.seasonId,
  ).length;

  return {
    ok: true as const,
    source: "sqlite" as const,
    seasonId: effectiveParams.seasonId,
    generatedCardCount,
    existingCardCount: 0,
    warnings: generatedCardCount === 0 ? ["In dieser Season wurden keine Formkartenquellen gefunden."] : [],
  };
}

export type SaveLocalLegacyFormCardPlanInput = LegacyLineupKeyParams & {
  disciplineSide: "d1" | "d2";
  disciplineId?: string | null;
  primaryFormCardId?: string | null;
  secondaryFormCardId?: string | null;
};

export function saveLocalLegacyFormCardPlan(
  input: SaveLocalLegacyFormCardPlanInput,
  persistence?: PersistenceService,
): {
  ok: boolean;
  plans: FormCardPlanRecord[];
  errors: string[];
  warnings: string[];
} {
  const { persistence: resolvedPersistence, save } = resolveLocalSave(input.saveId, persistence);
  const effectiveSaveId = save.saveId;
  const gameState = withNormalizedSeasonDisciplineSchedule(save.gameState);
  const scheduleEntry = (gameState.seasonState.disciplineSchedule ?? []).find(
    (entry) => entry.seasonId === input.seasonId && entry.matchdayId === input.matchdayId,
  );
  if (!scheduleEntry) {
    return { ok: false, plans: [], errors: ["form_card_plan_matchday_missing"], warnings: [] };
  }

  const sideSlot = input.disciplineSide === "d1" ? scheduleEntry.discipline1 : scheduleEntry.discipline2;
  const disciplineId = input.disciplineId ?? sideSlot?.disciplineId ?? null;
  if (!sideSlot || (disciplineId && sideSlot.disciplineId !== disciplineId)) {
    return { ok: false, plans: [], errors: ["form_card_plan_discipline_side_missing"], warnings: [] };
  }

  const requestedCardIds = [input.primaryFormCardId ?? null, input.secondaryFormCardId ?? null].filter(
    (value): value is string => Boolean(value),
  );
  const validCards = new Set(
    (gameState.seasonState.formCards ?? [])
      .filter((card) => card.seasonId === input.seasonId && card.teamId === input.teamId)
      .map((card) => card.id),
  );
  const positiveCardIds = new Set(
    (gameState.seasonState.formCards ?? [])
      .filter((card) => card.seasonId === input.seasonId && card.teamId === input.teamId && card.cardValue > 0)
      .map((card) => card.id),
  );
  const invalidCardId = requestedCardIds.find((cardId) => !validCards.has(cardId));
  const teamPlans = (gameState.seasonState.formCardPlans ?? []).filter(
    (plan) => plan.seasonId === input.seasonId && plan.teamId === input.teamId,
  );
  if (invalidCardId) {
    return {
      ok: false,
      plans: teamPlans,
      errors: [`form_card_plan_card_missing:${invalidCardId}`],
      warnings: [],
    };
  }
  if (input.secondaryFormCardId && !positiveCardIds.has(input.secondaryFormCardId)) {
    return {
      ok: false,
      plans: teamPlans,
      errors: [`form_card_plan_secondary_must_be_positive:${input.secondaryFormCardId}`],
      warnings: [],
    };
  }

  const now = new Date().toISOString();
  const planId = `form-card-plan:${effectiveSaveId}:${input.seasonId}:${input.matchdayId}:${input.teamId}:${input.disciplineSide}`;
  const allPlans = gameState.seasonState.formCardPlans ?? [];
  const nextPlan: FormCardPlanRecord | null =
    requestedCardIds.length > 0
      ? {
          id: planId,
          saveId: effectiveSaveId,
          seasonId: input.seasonId,
          teamId: input.teamId,
          matchdayId: input.matchdayId,
          disciplineSide: input.disciplineSide,
          disciplineId,
          primaryFormCardId: input.primaryFormCardId ?? null,
          secondaryFormCardId: input.secondaryFormCardId ?? null,
          updatedAt: now,
        }
      : null;
  const reservedCardIds = new Set(requestedCardIds);
  const nextPlans = [
    ...allPlans.filter((plan) => {
      if (plan.id === planId) {
        return false;
      }
      if (plan.seasonId !== input.seasonId || plan.teamId !== input.teamId) {
        return true;
      }
      return ![plan.primaryFormCardId, plan.secondaryFormCardId].some((cardId) => cardId && reservedCardIds.has(cardId));
    }),
    ...(nextPlan ? [nextPlan] : []),
  ].sort(
    (left, right) =>
      left.seasonId.localeCompare(right.seasonId) ||
      left.teamId.localeCompare(right.teamId) ||
      left.matchdayId.localeCompare(right.matchdayId) ||
      left.disciplineSide.localeCompare(right.disciplineSide),
  );

  const nextGameState: GameState = {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      formCardPlans: nextPlans,
    },
  };
  resolvedPersistence.saveSingleplayerState(effectiveSaveId, nextGameState);

  return {
    ok: true,
    plans: nextPlans.filter((plan) => plan.seasonId === input.seasonId && plan.teamId === input.teamId),
    errors: [],
    warnings: reservedCardIds.size > 0 ? ["Doppelte Formkartenplaene wurden fuer diese Karte bereinigt."] : [],
  };
}

export function saveLocalLegacyLineupDraft(
  params: LegacyLineupKeyParams,
  entries: LegacyLineupEntryInput[],
  modifiers = createDefaultLineupDraftModifiers(),
  persistence?: PersistenceService,
): LegacyLineupSaveResult {
  const { persistence: resolvedPersistence, save } = resolveLocalSave(params.saveId, persistence);
  const effectiveParams = { ...params, saveId: save.saveId };
  if (save.gameState.matchdayState.matchdayId !== effectiveParams.matchdayId) {
    return {
      ok: false,
      errors: ["lineup_matchday_is_not_active"],
      warnings: ["Only the active local matchday can be edited. Older matchdays stay locked after progress."],
    };
  }
  const contextResult = buildContextFromGameState(save.gameState, effectiveParams);
  if (!contextResult.ok) {
    return { ok: false, errors: contextResult.errors, warnings: contextResult.warnings };
  }

  const normalizedEntries = normalizeEntries(entries);
  const validation = validateLegacyLineupContext(
    {
      ...contextResult.context,
      entries: normalizedEntries,
      disciplineSidePlayerCounts: buildDisciplineSidePlayerCounts(contextResult.context),
      disciplineSideCaptainCounts: contextResult.context.disciplineSideCaptainCounts,
    },
    buildValidationOptions(contextResult.context),
  );

  if (!validation.isValid) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const now = new Date().toISOString();
  const lineupId = createLineupDraftId(effectiveParams);
  const existingDrafts = getStoredDrafts(save.gameState);
  const existing = existingDrafts.find((draft) => draft.lineupId === lineupId) ?? null;
  if (existing && ["locked", "resolved"].includes(existing.status)) {
    return {
      ok: false,
      errors: ["lineup_draft_is_locked"],
      warnings: ["This lineup is already locked/resolved and can no longer be overwritten."],
    };
  }
  const nextDraft: LineupDraft = {
    lineupId,
    saveId: effectiveParams.saveId,
    seasonId: effectiveParams.seasonId,
    matchdayId: effectiveParams.matchdayId,
    teamId: effectiveParams.teamId,
    status: "draft",
    entries: normalizedEntries,
    modifiers: normalizeLineupDraftModifiers(modifiers),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const nextGameState: GameState = {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      lineupDrafts: [
        ...existingDrafts.filter((draft) => draft.lineupId !== lineupId),
        nextDraft,
      ],
    },
  };

  resolvedPersistence.saveSingleplayerState(save.saveId, nextGameState);

  return {
    ok: true,
    draft: toLegacyDraft(nextDraft),
    warnings: validation.warnings,
  };
}

export function saveLocalLegacyLineupDraftBatch(
  drafts: Array<{
    params: LegacyLineupKeyParams;
    entries: LegacyLineupEntryInput[];
    modifiers?: LegacyLineupDraft["modifiers"];
  }>,
  persistence?: PersistenceService,
): {
  ok: boolean;
  savedCount: number;
  errors: string[];
  warnings: string[];
} {
  if (drafts.length === 0) {
    return { ok: true, savedCount: 0, errors: [], warnings: [] };
  }

  const { persistence: resolvedPersistence, save } = resolveLocalSave(drafts[0]!.params.saveId, persistence);
  const errors: string[] = [];
  const warnings: string[] = [];
  const effectiveDrafts = drafts.map((draft) => ({
    ...draft,
    params: {
      ...draft.params,
      saveId: save.saveId,
    },
    modifiers: normalizeLineupDraftModifiers(draft.modifiers ?? createDefaultLineupDraftModifiers()),
  }));

  const now = new Date().toISOString();
  const existingDrafts = getStoredDrafts(save.gameState);
  const nextDrafts: LineupDraft[] = [];
  const nextDraftIds = new Set<string>();

  for (const draftInput of effectiveDrafts) {
    if (save.gameState.matchdayState.matchdayId !== draftInput.params.matchdayId) {
      errors.push("lineup_matchday_is_not_active");
      continue;
    }

    const contextResult = buildContextFromGameState(save.gameState, draftInput.params);
    if (!contextResult.ok) {
      errors.push(...contextResult.errors);
      warnings.push(...contextResult.warnings);
      continue;
    }

    const normalizedEntries = normalizeEntries(draftInput.entries);
    const validation = validateLegacyLineupContext(
      {
        ...contextResult.context,
        entries: normalizedEntries,
        disciplineSidePlayerCounts: buildDisciplineSidePlayerCounts(contextResult.context),
        disciplineSideCaptainCounts: contextResult.context.disciplineSideCaptainCounts,
      },
      buildValidationOptions(contextResult.context),
    );

    warnings.push(...validation.warnings);
    if (!validation.isValid) {
      errors.push(...validation.errors);
      continue;
    }

    const lineupId = createLineupDraftId(draftInput.params);
    const existing = existingDrafts.find((entry) => entry.lineupId === lineupId) ?? null;
    if (existing && ["locked", "resolved"].includes(existing.status)) {
      errors.push("lineup_draft_is_locked");
      warnings.push("This lineup is already locked/resolved and can no longer be overwritten.");
      continue;
    }

    nextDraftIds.add(lineupId);
    nextDrafts.push({
      lineupId,
      saveId: draftInput.params.saveId,
      seasonId: draftInput.params.seasonId,
      matchdayId: draftInput.params.matchdayId,
      teamId: draftInput.params.teamId,
      status: "draft",
      entries: normalizedEntries,
      modifiers: draftInput.modifiers,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      savedCount: 0,
      errors: Array.from(new Set(errors)),
      warnings: Array.from(new Set(warnings)),
    };
  }

  const nextGameState: GameState = {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      lineupDrafts: [
        ...existingDrafts.filter((draft) => !nextDraftIds.has(draft.lineupId)),
        ...nextDrafts,
      ],
    },
  };

  resolvedPersistence.saveSingleplayerState(save.saveId, nextGameState);

  return {
    ok: true,
    savedCount: nextDrafts.length,
    errors: [],
    warnings: Array.from(new Set(warnings)),
  };
}

export function calculateLocalLegacyLineupPreview(
  params: LegacyLineupKeyParams,
  entries?: LegacyLineupEntryInput[],
  modifiers?: LegacyLineupDraft["modifiers"],
  persistence?: PersistenceService,
): LegacyLineupPreviewResult {
  const contextResult = loadLocalLegacyLineupContext(params, persistence);
  if (!contextResult.ok) {
    return contextResult;
  }

  const { save } = resolveLocalSave(params.saveId, persistence);
  const fatigueMap = buildLocalFatigueMap(save.gameState, {
    ...params,
    saveId: save.saveId,
  });

  return calculateLocalLegacyLineupPreviewFromContext(contextResult.context, entries, modifiers, fatigueMap);
}

export function calculateLocalLegacyLineupPreviewFromContext(
  context: LegacyLineupLoadedContext,
  entries?: LegacyLineupEntryInput[],
  modifiers?: LegacyLineupDraft["modifiers"],
  fatigueMap: ReturnType<typeof buildLocalFatigueMap> = context.fatigueByPlayerId ?? null,
): LegacyLineupPreviewResult {
  const previewEntries = normalizeEntries(entries ?? context.existingDraft?.entries ?? []);
  const previewPlayerIds = new Set(previewEntries.map((entry) => entry.playerId));
  const moraleByPlayerId = buildPlayerMoralePerformanceMap({
    gameState: context.gameState,
    teamId: context.teamId,
    rosterEntries:
      context.gameState?.rosters.filter((entry) => entry.teamId === context.teamId && previewPlayerIds.has(entry.playerId)) ??
      null,
  });
  const previewModifiers = normalizeLineupDraftModifiers(modifiers ?? context.existingDraft?.modifiers);
  const validation = validateLegacyLineupContext(
    {
      ...context,
      entries: previewEntries,
      disciplineSidePlayerCounts: buildDisciplineSidePlayerCounts(context),
      disciplineSideCaptainCounts: context.disciplineSideCaptainCounts,
    },
    buildValidationOptions(context),
  );

  const previewPairs = [
    context.matchdayContract?.discipline1
      ? `${context.matchdayContract.discipline1.disciplineId}::${context.matchdayContract.discipline1.disciplineSide}`
      : null,
    context.matchdayContract?.discipline2
      ? `${context.matchdayContract.discipline2.disciplineId}::${context.matchdayContract.discipline2.disciplineSide}`
      : null,
    ...previewEntries.map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
  ].filter((value): value is string => Boolean(value));
  const uniquePairs = Array.from(new Set(previewPairs));
  const teamCaptain = context.gameState ? selectTeamCaptain(context.gameState, context.teamId) : null;
  const scorePartsWithModifierWarnings = uniquePairs.map((pair) => {
    const [disciplineId, disciplineSide] = pair.split("::") as [string, "d1" | "d2"];
    const sideEntries = previewEntries.filter(
      (entry) => entry.disciplineId === disciplineId && entry.disciplineSide === disciplineSide,
    );
    const disciplineMeta =
      disciplineSide === "d1"
        ? context.matchdayContract?.discipline1 ?? null
        : context.matchdayContract?.discipline2 ?? null;
    const formResult = calculateFormModifierForSide({
      modifiers: previewModifiers,
      disciplineSide,
      disciplineColor: getFormCardColorForDisciplineCategory(disciplineMeta?.category),
      playerCount: sideEntries.length,
      formCards: context.formCards ?? [],
    });
    const mutatorResult = calculateMutatorModifierForSide({
      modifiers: previewModifiers,
      disciplineSide,
      entries: sideEntries.map((entry) => ({ playerId: entry.playerId })),
      rosterPlayers: context.rosterPlayers,
    });
    const teamPowerResult = calculateTeamPowerModifierForSide({
      modifiers: previewModifiers,
      disciplineSide,
      disciplineId,
      disciplineCategory: disciplineMeta?.category,
      teamPowers: context.teamPowers ?? [],
      teamCaptainPowerModifierPct: teamCaptain?.effects.teamPowerModifierPct ?? null,
      conditionalBonusPct: (() => {
        const selectedPower = context.teamPowers?.find((power) => power.id === previewModifiers[disciplineSide].teamPowerId) ?? null;
        if (!selectedPower?.conditionalTrigger || !selectedPower.conditionalBonusPct) {
          return 0;
        }
        if (selectedPower.conditionalTrigger === "rival_top8_discipline") {
          return (context.teamPowerWindows?.[disciplineId]?.top8Rivals.length ?? 0) > 0 ? selectedPower.conditionalBonusPct : 0;
        }
        return 0;
      })(),
    });
    const effectiveMutatorModifier =
      context.mutatorSource?.effectStatus === "ready" ? mutatorResult.mutatorModifier : null;
    const effectiveMutatorBonuses =
      context.mutatorSource?.effectStatus === "ready" ? mutatorResult.playerMutatorBonuses : null;
    const effectiveTeamPowerModifier =
      context.teamPowerSource?.effectStatus === "ready" ? teamPowerResult.teamPowerModifier : null;
    return {
      score: scoreLegacyLineupDisciplineSide({
        disciplineId,
        disciplineSide,
        entries: previewEntries,
        disciplineScores: context.disciplineScores,
        activePlayers: context.activePlayers,
        rosterPlayers: context.rosterPlayers,
        requiredPlayers:
          context.disciplineSidePlayerCounts?.[pair] ??
          context.disciplinePlayerCounts[disciplineId] ??
          null,
        fatigueByPlayerId: fatigueMap,
        moraleByPlayerId,
        fatigueSourceStatus: fatigueMap ? "mapped" : "missing_source",
        intensity: previewModifiers[disciplineSide].intensity,
        formCardsAvailable: formResult.formCardsAvailable,
        formCardsSelected: formResult.formCardsSelected,
        formModifier: formResult.formModifier,
        mutatorText: mutatorResult.mutatorText,
        mutatorModifier: effectiveMutatorModifier,
        mutatorBonusByPlayerId: effectiveMutatorBonuses,
        teamPowerSelected: teamPowerResult.teamPowerSelected,
        teamPowerStatus: context.teamPowerSource?.effectStatus === "ready" ? "ready" : "missing_source",
        teamPowerLabel: teamPowerResult.teamPowerLabel,
        teamPowerModifier: effectiveTeamPowerModifier,
        teamPowerImpact: teamPowerResult.teamPowerImpact,
        teamPowerBasePct: teamPowerResult.teamPowerBasePct,
        teamPowerConditionalPct: teamPowerResult.teamPowerConditionalPct,
        teamPowerAttributeFitPct: teamPowerResult.teamPowerAttributeFitPct,
        teamPowerEffectType: context.teamPowers?.find((power) => power.id === previewModifiers[disciplineSide].teamPowerId)?.effectType ?? null,
        teamPowerTargetMode: context.teamPowers?.find((power) => power.id === previewModifiers[disciplineSide].teamPowerId)?.targetMode ?? null,
        teamPowerTargetLimit: context.teamPowers?.find((power) => power.id === previewModifiers[disciplineSide].teamPowerId)?.targetLimit ?? null,
      }),
      modifierWarnings: [...formResult.warnings, ...mutatorResult.warnings, ...teamPowerResult.warnings],
    };
  });
  const scoreParts = scorePartsWithModifierWarnings.map((entry) => entry.score);
  const scorePreview = buildLegacyLineupAggregateScore(scoreParts);
  const modifierWarnings = Array.from(
    new Set(scorePartsWithModifierWarnings.flatMap((entry) => entry.modifierWarnings)),
  );

  return {
    ok: true,
    contextMeta: context.contextMeta,
    validation,
    disciplineSideScores: scoreParts,
    scorePreview: {
      ...scorePreview,
      validationWarnings: [
        ...validation.warnings,
        ...scorePreview.validationWarnings,
        ...modifierWarnings,
      ],
      modifierWarnings: [...(scorePreview.modifierWarnings ?? []), ...modifierWarnings],
    },
    warnings: [],
  };
}
