import type {
  Discipline,
  GameState,
  Player,
  PlayerDemandRecord,
  RosterEntry,
  TeamCaptainRecord,
} from "@/lib/data/olyDataTypes";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { buildPlayerSeasonPerformance } from "@/lib/foundation/player-season-performance";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildTrainingModeDemandRecord } from "@/lib/training/training-mode-demand-service";

type DemandPlayerLike = Pick<
  Player,
  | "id"
  | "name"
  | "traitsPositive"
  | "traitsNegative"
  | "disciplineRatings"
  | "coreStats"
  | "attributeSheetStats"
  | "pps"
  | "ovr"
> & {
  trainingMode?: Player["trainingMode"];
  fatigue?: number;
  potential?: number;
  age?: number | null;
};

type DemandDisciplineLike = Pick<Discipline, "id" | "name" | "category"> & { playerCount?: number | null };

type DemandContext = {
  seasonId: string;
  teamId: string;
  matchdayId?: string | null;
  matchdayIndex?: number | null;
  matchdayDisciplines?: DemandDisciplineLike[];
  rosterPlayers: DemandPlayerLike[];
  rosterEntries?: RosterEntry[];
  playerSeasonAppearances?: Record<string, number>;
  facilityLevels?: Record<string, number>;
};

const CAPTAIN_POSITIVE_TRAITS = new Set(["eloquent", "motivated", "ambitious", "disciplined", "resourceful", "loyal"]);
const CAPTAIN_DEMAND_TRAITS = new Set(["eloquent", "ambitious", "egomaniac", "diva"]);
const DEMAND_TRAITS = new Set(["ambitious", "motivated", "diligent", "disciplined", "diva", "egomaniac", "mercenary", "obsessive"]);
const LOW_MAINTENANCE_TRAITS = new Set(["loyal", "humble", "flexible"]);
const FACILITY_TRAITS = new Set(["diligent", "disciplined", "motivated", "resourceful"]);
const MAX_CAPTAIN_DEMANDS_PER_TEAM = 1;
const CAPTAIN_DEMAND_ELITE_SCORE = 96;
const CAPTAIN_DEMAND_RARE_WINDOW_PERCENT = 8;

function normalizeTrait(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getTraits(player: Pick<Player, "traitsPositive" | "traitsNegative">) {
  return [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])].map(normalizeTrait).filter(Boolean);
}

function hasAnyTrait(player: Pick<Player, "traitsPositive" | "traitsNegative">, traits: Set<string>) {
  return getTraits(player).some((trait) => traits.has(trait));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function stableDemandHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getCaptainDemandScoreThreshold(playerCount: number | null | undefined) {
  const count = playerCount ?? 4;
  if (count <= 2) return 94;
  if (count <= 4) return 95;
  return 96;
}

function isCaptainDemandRareWindow(input: {
  context: DemandContext;
  playerId: string;
  disciplineId: string;
  score: number;
}) {
  if (input.score >= CAPTAIN_DEMAND_ELITE_SCORE) return true;
  const key = [
    input.context.seasonId,
    input.context.teamId,
    input.context.matchdayId ?? `md-${input.context.matchdayIndex ?? "unknown"}`,
    input.playerId,
    input.disciplineId,
    "captain-demand-v2",
  ].join(":");
  return stableDemandHash(key) % 100 < CAPTAIN_DEMAND_RARE_WINDOW_PERCENT;
}

function getTopDiscipline(player: DemandPlayerLike, disciplines: DemandDisciplineLike[]) {
  return [...disciplines]
    .map((discipline) => ({
      discipline,
      score: player.disciplineRatings[discipline.id] ?? 0,
    }))
    .sort((left, right) => right.score - left.score)[0] ?? null;
}

function rankPlayersForDiscipline(players: DemandPlayerLike[], disciplineId: string) {
  return [...players]
    .sort((left, right) => (right.disciplineRatings[disciplineId] ?? 0) - (left.disciplineRatings[disciplineId] ?? 0))
    .map((player, index) => [player.id, index + 1] as const);
}

function getDisciplineRankSnapshot(players: DemandPlayerLike[], playerId: string, disciplineId: string) {
  const ranked = rankPlayersForDiscipline(players, disciplineId).map(([id, rank]) => ({
    id,
    rank,
    score: players.find((player) => player.id === id)?.disciplineRatings[disciplineId] ?? 0,
  }));
  const current = ranked.find((entry) => entry.id === playerId) ?? null;
  const nextBest = ranked.find((entry) => entry.id !== playerId) ?? null;
  return {
    rank: current?.rank ?? 99,
    score: current?.score ?? 0,
    gapToNextBest: round((current?.score ?? 0) - (nextBest?.score ?? 0), 1),
  };
}

function buildRosterRankMap(context: DemandContext) {
  return new Map(
    [...context.rosterPlayers]
      .sort((left, right) => ((right.ovr ?? right.pps ?? 0) - (left.ovr ?? left.pps ?? 0)) || right.name.localeCompare(left.name, "de"))
      .map((entry, index) => [entry.id, index + 1] as const),
  );
}

function getCaptainDemandCandidateScore(input: {
  context: DemandContext;
  player: DemandPlayerLike;
  rosterRank: number;
}) {
  const top = getTopDiscipline(input.player, input.context.matchdayDisciplines ?? []);
  if (!top) return null;

  const requiredScore = getCaptainDemandScoreThreshold(top.discipline.playerCount);
  if (top.score < requiredScore) return null;

  const traits = getTraits(input.player);
  const hasCaptainTrait = traits.some((trait) => CAPTAIN_DEMAND_TRAITS.has(trait));
  const hasLeaderTrait = traits.some((trait) => CAPTAIN_POSITIVE_TRAITS.has(trait));
  const disciplineRank = getDisciplineRankSnapshot(input.context.rosterPlayers, input.player.id, top.discipline.id);
  const isRosterStar = input.rosterRank <= 2 || (input.player.ovr ?? 0) >= 92 || (input.player.pps ?? 0) >= 22;
  const isDisciplineStar =
    disciplineRank.rank === 1 ||
    (disciplineRank.rank <= 2 && top.score >= CAPTAIN_DEMAND_ELITE_SCORE);
  const hasClearCaptainCase =
    disciplineRank.gapToNextBest >= 7 ||
    top.score >= CAPTAIN_DEMAND_ELITE_SCORE ||
    ((top.discipline.playerCount ?? 4) <= 2 && top.score >= 97);
  const isTinyDisciplineStarClaim =
    (top.discipline.playerCount ?? 4) <= 2 &&
    top.score >= 97 &&
    disciplineRank.rank === 1 &&
    disciplineRank.gapToNextBest >= 10;
  const hasDemandVoice = hasCaptainTrait || (hasLeaderTrait && top.score >= CAPTAIN_DEMAND_ELITE_SCORE);

  if (!isRosterStar || !isDisciplineStar || !hasClearCaptainCase || !hasDemandVoice) return null;
  if (hasAnyTrait(input.player, LOW_MAINTENANCE_TRAITS) && !hasCaptainTrait) return null;
  if (!isTinyDisciplineStarClaim && !isCaptainDemandRareWindow({ context: input.context, playerId: input.player.id, disciplineId: top.discipline.id, score: top.score })) {
    return null;
  }

  const traitScore = traits.reduce((sum, trait) => {
    if (trait === "eloquent") return sum + 9;
    if (trait === "ambitious") return sum + 7;
    if (trait === "egomaniac" || trait === "diva") return sum + 5;
    if (CAPTAIN_POSITIVE_TRAITS.has(trait)) return sum + 3;
    return sum;
  }, 0);

  return {
    top,
    disciplineRank: disciplineRank.rank,
    gapToNextBest: disciplineRank.gapToNextBest,
    requiredScore,
    score: round(top.score * 0.62 + Math.max(0, 6 - input.rosterRank) * 8 + traitScore + Math.max(0, disciplineRank.gapToNextBest), 2),
  };
}

function selectCaptainDemandPlayerIds(context: DemandContext, rosterRankMap = buildRosterRankMap(context)) {
  return new Set(
    context.rosterPlayers
      .map((player) => {
        const rosterRank = rosterRankMap.get(player.id) ?? 99;
        const candidate = getCaptainDemandCandidateScore({ context, player, rosterRank });
        return candidate ? { playerId: player.id, score: candidate.score, topScore: candidate.top.score, rosterRank } : null;
      })
      .filter((entry): entry is { playerId: string; score: number; topScore: number; rosterRank: number } => Boolean(entry))
      .sort((left, right) => right.score - left.score || right.topScore - left.topScore || left.rosterRank - right.rosterRank)
      .slice(0, MAX_CAPTAIN_DEMANDS_PER_TEAM)
      .map((entry) => entry.playerId),
  );
}

function buildDisciplineDemand(input: {
  context: DemandContext;
  player: DemandPlayerLike;
  rosterRank: number;
}): PlayerDemandRecord | null {
  const disciplines = input.context.matchdayDisciplines?.length
    ? input.context.matchdayDisciplines
    : Object.keys(input.player.disciplineRatings).map((id) => ({ id, name: id, category: "power" as const }));
  const top = getTopDiscipline(input.player, disciplines);
  if (!top || top.score < 58) return null;
  const rankMap = new Map(rankPlayersForDiscipline(input.context.rosterPlayers, top.discipline.id));
  const disciplineRank = rankMap.get(input.player.id) ?? 99;
  const requiredPlayers = top.discipline.playerCount ?? 2;
  const wantsSpot =
    disciplineRank <= Math.max(requiredPlayers + 1, 3) ||
    input.rosterRank <= 4 ||
    hasAnyTrait(input.player, DEMAND_TRAITS);
  if (!wantsSpot || hasAnyTrait(input.player, LOW_MAINTENANCE_TRAITS) && input.rosterRank > 5) return null;

  return {
    demandId: `${input.context.seasonId}:${input.context.teamId}:${input.player.id}:discipline:${top.discipline.id}`,
    seasonId: input.context.seasonId,
    teamId: input.context.teamId,
    playerId: input.player.id,
    type: "discipline_start",
    label: `${top.discipline.name} starten`,
    detail: `${input.player.name} sieht sich in ${top.discipline.name} als Startoption (#${disciplineRank} im Team).`,
    targetDisciplineId: top.discipline.id,
    targetDisciplineName: top.discipline.name,
    targetCategory: top.discipline.category,
    targetValue: "Start",
    currentValue: `#${disciplineRank}`,
    status: disciplineRank <= requiredPlayers ? "fulfilled" : disciplineRank <= requiredPlayers + 2 ? "at_risk" : "open",
    moraleReward: input.rosterRank <= 3 ? 10 : 7,
    moralePenalty: input.rosterRank <= 3 ? -16 : -10,
    priority: input.rosterRank <= 3 || disciplineRank <= requiredPlayers + 1 ? "high" : "medium",
    source: "player_demands_v1_discipline_fit",
  };
}

function buildCaptainDemand(input: {
  context: DemandContext;
  player: DemandPlayerLike;
  rosterRank: number;
  captainDemandAllowedPlayerIds?: Set<string>;
}): PlayerDemandRecord | null {
  if (input.captainDemandAllowedPlayerIds && !input.captainDemandAllowedPlayerIds.has(input.player.id)) return null;
  const candidate = getCaptainDemandCandidateScore(input);
  if (!candidate) return null;
  const top = candidate.top;
  return {
    demandId: `${input.context.seasonId}:${input.context.teamId}:${input.player.id}:captain`,
    seasonId: input.context.seasonId,
    teamId: input.context.teamId,
    playerId: input.player.id,
    type: "captaincy",
    label: "Captain-Rolle",
    detail: `${input.player.name} fordert Captain nur fuer dieses Star-Fenster: ${top.discipline.name} ${round(top.score, 0)} Punkte, #${candidate.disciplineRank} im Team, Abstand ${round(candidate.gapToNextBest, 1)}.`,
    targetDisciplineId: top.discipline.id,
    targetDisciplineName: top.discipline.name,
    targetCategory: top.discipline.category,
    targetValue: "Captain",
    currentValue: "offen",
    status: "open",
    moraleReward: input.rosterRank <= 2 ? 8 : 6,
    moralePenalty: input.rosterRank <= 2 ? -12 : -8,
    priority: top.score >= CAPTAIN_DEMAND_ELITE_SCORE || ((top.discipline.playerCount ?? 4) <= 2 && top.score >= 92) ? "high" : "medium",
    source: "player_demands_v2_rare_star_window",
  };
}

function buildAppearanceDemand(input: {
  context: DemandContext;
  player: DemandPlayerLike;
  rosterRank: number;
}): PlayerDemandRecord | null {
  if (input.rosterRank > 8 && !hasAnyTrait(input.player, DEMAND_TRAITS)) return null;
  const current = input.context.playerSeasonAppearances?.[input.player.id] ?? 0;
  const target = input.rosterRank <= 3 ? 5 : input.rosterRank <= 6 ? 3 : 2;
  if (current >= target || hasAnyTrait(input.player, LOW_MAINTENANCE_TRAITS) && current >= 1) return null;
  return {
    demandId: `${input.context.seasonId}:${input.context.teamId}:${input.player.id}:appearances`,
    seasonId: input.context.seasonId,
    teamId: input.context.teamId,
    playerId: input.player.id,
    type: "appearances",
    label: `${target} Einsätze`,
    detail: `${input.player.name} will diese Season sichtbar eingebunden werden.`,
    targetValue: target,
    currentValue: current,
    status: current >= target ? "fulfilled" : current >= target - 1 ? "at_risk" : "open",
    moraleReward: 6,
    moralePenalty: input.rosterRank <= 3 ? -14 : -8,
    priority: input.rosterRank <= 3 ? "high" : "medium",
    source: "player_demands_v1_role_usage",
  };
}

function buildTrainingModePlayerDemand(input: {
  context: DemandContext;
  player: DemandPlayerLike;
  rosterRank: number;
}): PlayerDemandRecord | null {
  return buildTrainingModeDemandRecord({
    context: {
      seasonId: input.context.seasonId,
      teamId: input.context.teamId,
      matchdayIndex: input.context.matchdayIndex ?? null,
    },
    player: {
      id: input.player.id,
      name: input.player.name,
      traitsPositive: input.player.traitsPositive,
      traitsNegative: input.player.traitsNegative,
      trainingMode: input.player.trainingMode ?? "mittel",
      fatigue: input.player.fatigue ?? 0,
      potential: input.player.potential ?? 0,
      age: input.player.age,
    },
    rosterRank: input.rosterRank,
  });
}

function buildFacilityDemand(input: {
  context: DemandContext;
  player: DemandPlayerLike;
}): PlayerDemandRecord | null {
  if (!hasAnyTrait(input.player, FACILITY_TRAITS)) return null;
  const trainingLevel = input.context.facilityLevels?.training_center ?? 0;
  if (trainingLevel >= 1) return null;
  return {
    demandId: `${input.context.seasonId}:${input.context.teamId}:${input.player.id}:facility:training_center`,
    seasonId: input.context.seasonId,
    teamId: input.context.teamId,
    playerId: input.player.id,
    type: "facility",
    label: "Training verbessern",
    detail: `${input.player.name} will bessere Trainingsbedingungen sehen.`,
    targetValue: "Trainingszentrum Level 1",
    currentValue: `Level ${trainingLevel}`,
    status: "open",
    moraleReward: 5,
    moralePenalty: -6,
    priority: "low",
    source: "player_demands_v1_diligent_facility",
  };
}

function buildDemandContext(gameState: GameState, teamId: string): DemandContext {
  const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === teamId);
  const rosterIds = new Set(rosterEntries.map((entry) => entry.playerId));
  const rosterPlayers = gameState.players.filter((player) => rosterIds.has(player.id));
  const currentSchedule = gameState.seasonState.disciplineSchedule?.find((entry) => entry.matchdayId === gameState.matchdayState.matchdayId) ?? null;
  const matchdayDisciplines = [currentSchedule?.discipline1?.disciplineId, currentSchedule?.discipline2?.disciplineId]
    .filter((id): id is string => Boolean(id))
    .map((id) => gameState.disciplines.find((discipline) => discipline.id === id))
    .filter((discipline): discipline is Discipline => Boolean(discipline));
  const facilities = getTeamFacilityState(gameState, teamId).facilities;
  return {
    seasonId: gameState.season.id,
    teamId,
    matchdayId: gameState.matchdayState.matchdayId,
    matchdayIndex: currentSchedule?.matchdayIndex ?? null,
    matchdayDisciplines,
    rosterPlayers,
    rosterEntries,
    playerSeasonAppearances: Object.fromEntries(
      rosterPlayers.map((player) => [player.id, buildPlayerSeasonPerformance(gameState, player.id)?.appearances ?? 0] as const),
    ),
    facilityLevels: Object.fromEntries(Object.entries(facilities).map(([facilityId, state]) => [facilityId, state.level ?? 0] as const)),
  };
}

export function buildPlayerDemandsForContext(
  context: DemandContext,
  player: DemandPlayerLike,
  options?: {
    rosterRankMap?: Map<string, number>;
    captainDemandAllowedPlayerIds?: Set<string>;
  },
): PlayerDemandRecord[] {
  const rosterRankMap = options?.rosterRankMap ?? buildRosterRankMap(context);
  const captainDemandAllowedPlayerIds = options?.captainDemandAllowedPlayerIds ?? selectCaptainDemandPlayerIds(context, rosterRankMap);
  const rosterRank = rosterRankMap.get(player.id) ?? 99;
  const demandCandidates = [
    buildDisciplineDemand({ context, player, rosterRank }),
    buildCaptainDemand({ context, player, rosterRank, captainDemandAllowedPlayerIds }),
    buildAppearanceDemand({ context, player, rosterRank }),
    buildTrainingModePlayerDemand({ context, player, rosterRank }),
    buildFacilityDemand({ context, player }),
  ].filter((entry): entry is PlayerDemandRecord => Boolean(entry));

  return demandCandidates
    .sort((left, right) => {
      const priorityScore = { high: 3, medium: 2, low: 1 };
      return priorityScore[right.priority] - priorityScore[left.priority] || left.label.localeCompare(right.label, "de");
    })
    .slice(0, 2);
}

export function buildPlayerDemands(gameState: GameState, playerId: string, teamId: string): PlayerDemandRecord[] {
  const context = buildDemandContext(gameState, teamId);
  const player = context.rosterPlayers.find((entry) => entry.id === playerId) ?? null;
  if (!player) return [];
  const stored = (gameState.playerDemands ?? []).filter(
    (demand) => demand.seasonId === gameState.season.id && demand.teamId === teamId && demand.playerId === playerId,
  );
  if (stored.length > 0) return stored.slice(0, 2);
  return buildPlayerDemandsForContext(context, player);
}

export function buildTeamPlayerDemandMap(gameState: GameState, teamId: string) {
  const context = buildDemandContext(gameState, teamId);
  const rosterRankMap = buildRosterRankMap(context);
  const captainDemandAllowedPlayerIds = selectCaptainDemandPlayerIds(context, rosterRankMap);
  return new Map(
    context.rosterPlayers.map(
      (player) => [
        player.id,
        buildPlayerDemandsForContext(context, player, {
          rosterRankMap,
          captainDemandAllowedPlayerIds,
        }),
      ] as const,
    ),
  );
}

export function buildLineupPlayerDemandMap(input: {
  seasonId: string;
  teamId: string;
  rosterPlayers: Array<DemandPlayerLike & { ovr?: number | null; pps?: number | null }>;
  matchdayDisciplines: DemandDisciplineLike[];
  playerSeasonAppearances?: Record<string, number>;
}) {
  const context: DemandContext = {
    seasonId: input.seasonId,
    teamId: input.teamId,
    matchdayId: null,
    matchdayIndex: null,
    rosterPlayers: input.rosterPlayers,
    matchdayDisciplines: input.matchdayDisciplines,
    playerSeasonAppearances: input.playerSeasonAppearances,
  };
  const rosterRankMap = buildRosterRankMap(context);
  const captainDemandAllowedPlayerIds = selectCaptainDemandPlayerIds(context, rosterRankMap);
  return new Map(
    input.rosterPlayers.map(
      (player) => [
        player.id,
        buildPlayerDemandsForContext(context, player, {
          rosterRankMap,
          captainDemandAllowedPlayerIds,
        }),
      ] as const,
    ),
  );
}

export function selectTeamCaptain(gameState: GameState, teamId: string): TeamCaptainRecord | null {
  const stored = (gameState.teamCaptains ?? []).find((entry) => entry.seasonId === gameState.season.id && entry.teamId === teamId);
  if (stored) return stored;
  const rosterIds = new Set(gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId));
  const players = gameState.players.filter((player) => rosterIds.has(player.id));
  if (players.length === 0) return null;
  const ratings = buildPlayerRatingContractMap(gameState);
  const candidates = players
    .map((player) => {
      const stats = player.attributeSheetStats;
      const traits = getTraits(player);
      const traitBonus = traits.reduce((sum, trait) => sum + (CAPTAIN_POSITIVE_TRAITS.has(trait) ? 4 : trait === "renegade" || trait === "scandalous" ? 1.5 : 0), 0);
      const leadershipScore =
        (stats?.charisma ?? player.coreStats.soc ?? 0) * 0.32 +
        (stats?.will ?? player.coreStats.men ?? 0) * 0.2 +
        (stats?.determination ?? player.coreStats.pow ?? 0) * 0.18 +
        (stats?.awareness ?? player.coreStats.men ?? 0) * 0.16 +
        (ratings.get(player.id)?.mvs ?? player.ovr ?? 0) * 0.08 +
        traitBonus;
      return { player, traits, leadershipScore: round(leadershipScore, 1) };
    })
    .sort((left, right) => right.leadershipScore - left.leadershipScore || left.player.name.localeCompare(right.player.name, "de"));
  const best = candidates[0];
  if (!best) return null;
  const stats = best.player.attributeSheetStats;
  const style =
    best.traits.includes("eloquent") || (stats?.charisma ?? 0) >= 70
      ? "inspirer"
      : best.traits.includes("renegade") || best.traits.includes("scandalous") || (stats?.torment ?? 0) >= 65
        ? "enforcer"
        : (stats?.awareness ?? 0) >= 70 || (stats?.intelligence ?? 0) >= 70
          ? "operator"
          : best.traits.includes("gambler")
            ? "wildcard"
            : "leader";
  return {
    seasonId: gameState.season.id,
    teamId,
    playerId: best.player.id,
    playerName: best.player.name,
    leadershipScore: best.leadershipScore,
    style,
    effects: {
      moraleBuffer: round(clamp(best.leadershipScore / 18, 1, 6), 1),
      rivalryPressureReductionPct: round(clamp(best.leadershipScore / 3.5, 4, 24), 1),
      teamPowerModifierPct: round(clamp(best.leadershipScore / 9, 1, 8), 1),
      conflictSoftenChancePct: round(clamp(best.leadershipScore / 2.5, 6, 32), 1),
    },
    traitSignals: best.traits.filter((trait) => CAPTAIN_POSITIVE_TRAITS.has(trait) || ["renegade", "scandalous", "gambler"].includes(trait)).slice(0, 4),
    source: "team_captain_selector_v1",
  };
}
