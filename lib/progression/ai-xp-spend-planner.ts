import type {
  GameState,
  Player,
  PlayerGeneratorAttributeName,
  PlayerProgressionSpendUpgradeRecord,
  RosterEntry,
  Team,
  TeamIdentity,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { deriveTeamIdentityAxisWeightMap } from "@/lib/foundation/team-identity-settings";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformance } from "@/lib/foundation/player-season-performance";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import {
  applySeasonEndXpSpend,
  previewSeasonEndXpAvailability,
  previewSeasonEndXpSpend,
  type EconomyPreviewContext,
  type PreComputedSeasonXpEntry,
  type SeasonEndXpSpendApplyResult,
  type SeasonEndXpSpendPlannedUpgradeInput,
  type SeasonEndXpSpendPreview,
} from "@/lib/progression/season-end-xp-apply-service";
import {
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  type OfficialDisciplineWeightId,
} from "@/lib/player-generator/official-discipline-weights";
import { getProgressionRatingTier, getSeasonEndUpgradeCost } from "@/lib/training/season-end-progression-preview";

export type AiXpPlayerRole = "star" | "core" | "specialist" | "depth" | "young";

export type AiXpSpendPlayerPlan = {
  playerId: string;
  playerName: string;
  role: AiXpPlayerRole;
  availableXP: number;
  plannedUpgrades: PlayerProgressionSpendUpgradeRecord[];
  reasons: string[];
  disciplineDeltas: SeasonEndXpSpendPreview["players"][number]["disciplineDeltas"];
  xpSpent: number;
  xpRemaining: number;
};

export type AiXpSpendPlan = {
  teamId: string;
  teamCode: string | null;
  teamName: string | null;
  plannedUpgrades: SeasonEndXpSpendPlannedUpgradeInput[];
  normalizedPlannedUpgrades: PlayerProgressionSpendUpgradeRecord[];
  confirmToken: string | null;
  playerPlans: AiXpSpendPlayerPlan[];
  warnings: string[];
  blockers: string[];
  preview: SeasonEndXpSpendPreview;
};

const ATTRIBUTE_KEYS: PlayerGeneratorAttributeName[] = [
  "power",
  "health",
  "stamina",
  "intelligence",
  "awareness",
  "determination",
  "speed",
  "dexterity",
  "charisma",
  "will",
  "spirit",
  "torment",
];

const AXIS_ATTRIBUTES: Record<"pow" | "spe" | "men" | "soc", PlayerGeneratorAttributeName[]> = {
  pow: ["power", "health", "stamina", "determination"],
  spe: ["speed", "dexterity", "stamina", "awareness"],
  men: ["intelligence", "awareness", "will", "spirit"],
  soc: ["charisma", "spirit", "will", "awareness"],
};

const TEAM_FOCUS: Record<string, PlayerGeneratorAttributeName[]> = {
  "C-S": ["dexterity", "speed", "awareness", "will"],
  "W-W": ["intelligence", "awareness", "will", "spirit"],
  "M-M": ["power", "speed", "dexterity", "torment"],
  "C-C": ["stamina", "awareness", "dexterity", "will"],
  "N-W": ["spirit", "stamina", "health", "power"],
  "T-T": ["charisma", "will", "awareness", "intelligence"],
  "B-P": ["speed", "dexterity", "power", "awareness"],
  "A-A": ["health", "stamina", "determination", "will"],
};

const COLOR_ATTRIBUTES: Record<string, PlayerGeneratorAttributeName[]> = {
  red: AXIS_ATTRIBUTES.pow,
  green: AXIS_ATTRIBUTES.spe,
  blue: AXIS_ATTRIBUTES.men,
  yellow: AXIS_ATTRIBUTES.soc,
};

const CLASS_FOCUS: Array<{ tokens: string[]; attributes: PlayerGeneratorAttributeName[]; reason: string }> = [
  { tokens: ["wizard", "mage", "sorcer", "warlock", "witch", "psion"], attributes: ["intelligence", "awareness", "will", "spirit"], reason: "class_mental_magic_fit" },
  { tokens: ["rogue", "ninja", "assassin", "ranger", "duelist"], attributes: ["speed", "dexterity", "awareness"], reason: "class_agility_precision_fit" },
  { tokens: ["warrior", "barbar", "berserk", "beast", "giant"], attributes: ["power", "health", "stamina"], reason: "class_power_body_fit" },
  { tokens: ["priest", "druid", "shaman", "teacher", "bard"], attributes: ["spirit", "will", "charisma", "awareness"], reason: "class_support_leader_fit" },
  { tokens: ["demon", "chaos", "void"], attributes: ["torment", "power", "will"], reason: "class_exploit_torment_fit" },
];

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getTeamIdentity(gameState: GameState, teamId: string): TeamIdentity | null {
  return gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
}

function getRosterRows(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => ({
      roster: entry,
      player: gameState.players.find((player) => player.id === entry.playerId) ?? null,
    }))
    .filter((entry): entry is { roster: RosterEntry; player: Player } => Boolean(entry.player));
}

function getRole(input: {
  player: Player;
  roster: RosterEntry;
  ovrRankInTeam: number;
  rosterSize: number;
}): AiXpPlayerRole {
  if (input.roster.roleTag === "prospect") return "young";
  if (input.roster.roleTag === "bench") return "depth";
  const values = Object.values(input.player.disciplineRatings ?? {}).filter(isFiniteNumber);
  const max = values.length ? Math.max(...values) : 0;
  const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  if (max - avg >= 18) return "specialist";
  if (input.ovrRankInTeam <= Math.max(1, Math.min(2, Math.ceil(input.rosterSize * 0.2)))) return "star";
  return "core";
}

function getMaxUpgrades(role: AiXpPlayerRole, team: Team, profile: TeamStrategyProfile | null) {
  const isCashCreator = team.teamId === "C-C" || team.name.toLowerCase().includes("cash creator");
  if (isCashCreator) return role === "depth" || role === "young" ? 2 : 3;
  if (role === "star") return profile?.prefersStars === "high" ? 5 : 4;
  if (role === "core") return 4;
  if (role === "specialist") return 4;
  return 2;
}

function getRoleReasons(role: AiXpPlayerRole) {
  switch (role) {
    case "star":
      return ["role_star_main_attributes"];
    case "core":
      return ["role_core_team_fit"];
    case "specialist":
      return ["role_specialist_slot_discipline_fit"];
    case "young":
      return ["role_young_broad_development"];
    case "depth":
    default:
      return ["role_depth_efficiency"];
  }
}

function getClassFocus(player: Player) {
  const haystack = [player.className, player.race, ...(player.subclasses ?? [])].join(" ").toLowerCase();
  return CLASS_FOCUS.filter((entry) => entry.tokens.some((token) => haystack.includes(token)));
}

function getTopDisciplineIds(player: Player): OfficialDisciplineWeightId[] {
  return Object.entries(player.disciplineRatings ?? {})
    .filter((entry): entry is [OfficialDisciplineWeightId, number] => officialDisciplineWeightOrder.includes(entry[0] as OfficialDisciplineWeightId) && isFiniteNumber(entry[1]))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([disciplineId]) => disciplineId);
}

function getDisciplineWeightScore(attribute: PlayerGeneratorAttributeName, player: Player) {
  const topDisciplines = getTopDisciplineIds(player);
  if (topDisciplines.length === 0) return 0;
  return topDisciplines.reduce((sum, disciplineId) => sum + (officialDisciplineWeightTable[attribute]?.[disciplineId] ?? 0), 0) * 14;
}

function getFormCardAttributes(gameState: GameState, teamId: string, playerId: string) {
  const cards = (gameState.seasonState.formCards ?? []).filter(
    (card) => card.teamId === teamId && card.playerId === playerId && card.seasonId === gameState.season.id,
  );
  return cards.flatMap((card) => COLOR_ATTRIBUTES[card.cardColor] ?? []);
}

function buildAttributeStaticScore(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  player: Player;
  roster: RosterEntry;
  role: AiXpPlayerRole;
  attribute: PlayerGeneratorAttributeName;
}) {
  let score = 12;
  const reasons: string[] = [];
  const axisWeights = deriveTeamIdentityAxisWeightMap(input.identity);
  for (const [axis, attributes] of Object.entries(AXIS_ATTRIBUTES) as Array<["pow" | "spe" | "men" | "soc", PlayerGeneratorAttributeName[]]>) {
    if (attributes.includes(input.attribute)) {
      score += axisWeights[axis] * 28;
      if (axisWeights[axis] > 0.28) reasons.push(`team_identity_${axis}`);
    }
  }

  if ((TEAM_FOCUS[input.team.teamId] ?? []).includes(input.attribute)) {
    score += 18;
    reasons.push(`team_focus_${input.team.teamId}`);
  }

  for (const focus of getClassFocus(input.player)) {
    if (focus.attributes.includes(input.attribute)) {
      score += 12;
      reasons.push(focus.reason);
    }
  }

  if (getFormCardAttributes(input.gameState, input.team.teamId, input.player.id).includes(input.attribute)) {
    score += 10;
    reasons.push("form_card_color_fit");
  }

  const disciplineScore = getDisciplineWeightScore(input.attribute, input.player);
  if (disciplineScore > 0) {
    score += disciplineScore;
    reasons.push("top_discipline_weight_fit");
  }

  if (input.role === "star" || input.role === "core") {
    score += 8;
    reasons.push("role_priority_investment");
  }
  if (input.role === "depth" || input.role === "young") {
    const value = input.player.attributeSheetStats?.[input.attribute];
    if (isFiniteNumber(value) && value < 45) {
      score += 12;
      reasons.push("low_tier_efficiency");
    }
  }
  if (input.team.teamId === "C-C") {
    const value = input.player.attributeSheetStats?.[input.attribute];
    if (isFiniteNumber(value) && value < 60) {
      score += 14;
      reasons.push("cash_creators_value_upgrade");
    } else {
      score -= 12;
      reasons.push("cash_creators_avoid_expensive_upgrade");
    }
  }
  if (input.role === "depth") score -= 3;

  return { score, reasons: [...new Set(reasons)] };
}

function getPlayerPlanFromPreview(preview: SeasonEndXpSpendPreview, playerId: string) {
  return preview.players.find((entry) => entry.playerId === playerId) ?? null;
}

function buildCandidatePlan(input: {
  currentPlan: SeasonEndXpSpendPlannedUpgradeInput[];
  playerId: string;
  attribute: PlayerGeneratorAttributeName;
}) {
  return [
    ...input.currentPlan,
    {
      playerId: input.playerId,
      attribute: input.attribute,
      source: "manual_xp_spend_preview" as const,
    },
  ];
}

function getAffordableUpgradeCost(input: {
  gameState: GameState;
  teamId: string;
  attribute: PlayerGeneratorAttributeName;
  currentValue: number | null | undefined;
}) {
  if (!isFiniteNumber(input.currentValue) || input.currentValue >= 99) return null;
  const cost = getSeasonEndUpgradeCost({
    tier: getProgressionRatingTier(input.currentValue),
    attribute: input.attribute,
    facilities: { teamFacilities: getTeamFacilityState(input.gameState, input.teamId) },
  });
  return cost.costAfterFacility;
}

export function previewAiSeasonEndXpSpend(save: PersistedSaveGame, teamId: string, cachedEconomyContext?: EconomyPreviewContext, options?: { skipAfterEconomyAudit?: boolean }, preComputedSeasonXp?: Map<string, PreComputedSeasonXpEntry>): AiXpSpendPlan {
  const gameState = save.gameState;
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const controlMode = gameState.seasonState.teamControlSettings?.[teamId]?.controlMode ?? (team?.humanControlled === false ? "ai" : "manual");
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!team) blockers.push("team_not_found");
  if (team && controlMode !== "ai") blockers.push("team_not_ai_controlled");

  const profile = team ? getTeamStrategyProfile(gameState, team.teamId) : null;
  const identity = getTeamIdentity(gameState, teamId);
  if (!identity) warnings.push("team_identity_missing");
  if (!profile) warnings.push("team_strategy_profile_missing");

  const rosterRows = team ? getRosterRows(gameState, team.teamId) : [];
  // Re-use the economy context's pre-built rating map to avoid recomputing for every team.
  const ratings =
    cachedEconomyContext?.beforeRatings ??
    getSeasonDerivations({ gameState, saveId: save.saveId }).ratingsById;
  const rankedRoster = [...rosterRows].sort((left, right) => {
    const leftOvr = ratings.get(left.player.id)?.ovrNormalized ?? left.player.rating ?? 0;
    const rightOvr = ratings.get(right.player.id)?.ovrNormalized ?? right.player.rating ?? 0;
    return rightOvr - leftOvr;
  });
  const rankByPlayerId = new Map(rankedRoster.map((entry, index) => [entry.player.id, index + 1] as const));
  const plannedInputs: SeasonEndXpSpendPlannedUpgradeInput[] = [];
  const reasonsByPlayerId = new Map<string, string[]>();
  const firstAvailabilityByPlayerId = new Map<string, ReturnType<typeof previewSeasonEndXpAvailability>["players"][number]>();
  const initialAvailability = previewSeasonEndXpAvailability(save, teamId, cachedEconomyContext, preComputedSeasonXp);
  warnings.push(...initialAvailability.warnings);
  blockers.push(...initialAvailability.blockingReasons);
  for (const playerPreview of initialAvailability.players) {
    firstAvailabilityByPlayerId.set(playerPreview.playerId, playerPreview);
  }

  const playerOrder = [...rosterRows].sort((left, right) => {
    const leftRole = getRole({ player: left.player, roster: left.roster, ovrRankInTeam: rankByPlayerId.get(left.player.id) ?? 99, rosterSize: rosterRows.length });
    const rightRole = getRole({ player: right.player, roster: right.roster, ovrRankInTeam: rankByPlayerId.get(right.player.id) ?? 99, rosterSize: rosterRows.length });
    const roleWeight = { star: 5, core: 4, specialist: 3, young: 2, depth: 1 } satisfies Record<AiXpPlayerRole, number>;
    return roleWeight[rightRole] - roleWeight[leftRole];
  });

  for (const { player, roster } of playerOrder) {
    if (!player.attributeSheetStats) {
      warnings.push(`attribute_source_missing:${player.id}`);
      continue;
    }
    const role = getRole({ player, roster, ovrRankInTeam: rankByPlayerId.get(player.id) ?? 99, rosterSize: rosterRows.length });
    const maxUpgrades = getMaxUpgrades(role, team!, profile);
    const roleReasons = getRoleReasons(role);
    const candidateAttributes = ATTRIBUTE_KEYS.map((attribute) => {
      const currentValue = player.attributeSheetStats?.[attribute];
      if (!isFiniteNumber(currentValue) || currentValue >= 99) return null;
      const staticScore = buildAttributeStaticScore({ gameState, team: team!, identity, profile, player, roster, role, attribute });
      return { attribute, staticScore };
    })
      .filter((entry): entry is { attribute: PlayerGeneratorAttributeName; staticScore: { score: number; reasons: string[] } } => Boolean(entry))
      .sort((left, right) => right.staticScore.score - left.staticScore.score)
      .slice(0, role === "star" || role === "core" ? 6 : 4);
    let acceptedForPlayer = 0;
    reasonsByPlayerId.set(player.id, roleReasons);
    const initialPlayerPreview = firstAvailabilityByPlayerId.get(player.id);
    if ((player.currentXP ?? 0) <= 0 && (!initialPlayerPreview || initialPlayerPreview.availableXP <= 0)) {
      warnings.push(`no_xp_available:${player.id}`);
      continue;
    }
    let remainingXP = Math.max(0, Math.round(initialPlayerPreview?.availableXP ?? player.currentXP ?? 0));
    const simulatedAttributes = { ...player.attributeSheetStats };

    for (let step = 0; step < maxUpgrades; step += 1) {
      let best:
        | {
            attribute: PlayerGeneratorAttributeName;
            score: number;
            reasons: string[];
            cost: number;
        }
        | null = null;

      for (const { attribute, staticScore } of candidateAttributes) {
        const currentValue = simulatedAttributes?.[attribute];
        const cost = getAffordableUpgradeCost({ gameState, teamId: team!.teamId, attribute, currentValue });
        if (cost == null || cost > remainingXP) continue;
        const costPenalty = cost / (team!.teamId === "C-C" ? 18 : role === "depth" ? 16 : 24);
        const score = staticScore.score - costPenalty;
        if (!best || score > best.score) {
          best = { attribute, score, reasons: staticScore.reasons, cost };
        }
      }

      const threshold = role === "depth" ? 22 : team!.teamId === "C-C" ? 24 : 18;
      if (!best || best.score < threshold) {
        if (
          acceptedForPlayer === 0 &&
          best &&
          role !== "depth" &&
          best.score >= 12 &&
          best.cost <= remainingXP
        ) {
          plannedInputs.push(buildCandidatePlan({ currentPlan: [], playerId: player.id, attribute: best.attribute })[0]!);
          simulatedAttributes[best.attribute] = Math.min(99, (simulatedAttributes[best.attribute] ?? 0) + 1);
          remainingXP -= best.cost;
          acceptedForPlayer += 1;
          reasonsByPlayerId.set(player.id, [...new Set([...(reasonsByPlayerId.get(player.id) ?? []), "conservative_ai_xp_materialization", ...best.reasons])]);
        }
        break;
      }

      plannedInputs.push(buildCandidatePlan({ currentPlan: [], playerId: player.id, attribute: best.attribute })[0]!);
      simulatedAttributes[best.attribute] = Math.min(99, (simulatedAttributes[best.attribute] ?? 0) + 1);
      remainingXP -= best.cost;
      acceptedForPlayer += 1;
      reasonsByPlayerId.set(player.id, [...new Set([...(reasonsByPlayerId.get(player.id) ?? []), ...best.reasons])]);
    }

    if (acceptedForPlayer === 0) {
      const firstPreview = firstAvailabilityByPlayerId.get(player.id);
      if (!firstPreview || firstPreview.availableXP <= 0) warnings.push(`no_xp_available:${player.id}`);
      else warnings.push(`no_ai_upgrade_above_quality_floor:${player.id}`);
    }

    const appearances = preComputedSeasonXp?.get(player.id)?.appearances ?? buildPlayerSeasonPerformance(gameState, player.id)?.appearances ?? null;
    if (role === "young" && !isFiniteNumber(player.potential)) warnings.push(`potential_source_missing:${player.id}`);
    if ((player.salaryDemand ?? 0) > 20 && (appearances ?? 0) <= 1) {
      warnings.push(`expensive_flop_low_usage_guard:${player.id}`);
    }
  }

  const preview = previewSeasonEndXpSpend(save, teamId, plannedInputs, cachedEconomyContext, options?.skipAfterEconomyAudit ? { skipAfterEconomyAudit: true } : undefined, preComputedSeasonXp);
  const normalizedAiPlannedUpgrades = preview.plannedUpgrades.filter((upgrade) => upgrade.source === "manual_xp_spend_preview");
  const previewWarnings = preview.warnings.filter((warning) => warning !== "ai_xp_spend_apply_not_enabled_v1");
  const playerPlans = rosterRows.flatMap(({ player, roster }) => {
    const previewPlayer = getPlayerPlanFromPreview(preview, player.id) ?? null;
    const firstAvailability = firstAvailabilityByPlayerId.get(player.id) ?? null;
    const hasAiInputs = plannedInputs.some((upgrade) => upgrade.playerId === player.id);
    if (!previewPlayer && !hasAiInputs) return [];
    const role = getRole({ player, roster, ovrRankInTeam: rankByPlayerId.get(player.id) ?? 99, rosterSize: rosterRows.length });
    return [
      {
        playerId: player.id,
        playerName: player.name,
        role,
        availableXP: previewPlayer?.availableXP ?? firstAvailability?.availableXP ?? 0,
        plannedUpgrades: hasAiInputs ? (previewPlayer?.plannedUpgrades ?? []).filter((upgrade) => upgrade.source === "manual_xp_spend_preview") : [],
        reasons: reasonsByPlayerId.get(player.id) ?? getRoleReasons(role),
        disciplineDeltas: previewPlayer?.disciplineDeltas ?? [],
        xpSpent: hasAiInputs ? (previewPlayer?.plannedXP ?? 0) : 0,
        xpRemaining: previewPlayer?.remainingXP ?? 0,
      } satisfies AiXpSpendPlayerPlan,
    ];
  });

  return {
    teamId,
    teamCode: team?.shortCode ?? null,
    teamName: team?.name ?? null,
    plannedUpgrades: plannedInputs,
    normalizedPlannedUpgrades: normalizedAiPlannedUpgrades,
    confirmToken: blockers.length === 0 ? preview.confirmToken : null,
    playerPlans,
    warnings: [...new Set([...warnings, ...previewWarnings])],
    blockers: [...new Set([...blockers, ...preview.blockingReasons])],
    preview,
  };
}

export function applyAiSeasonEndXpSpend(
  save: PersistedSaveGame,
  teamId: string,
  confirmToken: string | null | undefined,
  persistence: PersistenceService,
  cachedEconomyContext?: EconomyPreviewContext,
  options?: { skipAfterEconomyAudit?: boolean; deferLeagueWideMarketValueRecalc?: boolean },
  preComputedPlan?: AiXpSpendPlan,
  preComputedSeasonXp?: Map<string, PreComputedSeasonXpEntry>,
): SeasonEndXpSpendApplyResult {
  // Re-use the caller's already-computed plan to avoid a full second preview round-trip.
  const plan = preComputedPlan && confirmToken && confirmToken === preComputedPlan.confirmToken
    ? preComputedPlan
    : previewAiSeasonEndXpSpend(save, teamId, cachedEconomyContext, undefined, preComputedSeasonXp);
  if (plan.blockers.length > 0 || !plan.confirmToken || confirmToken !== plan.confirmToken) {
    return {
      ...plan.preview,
      dryRun: false,
      applied: false,
      eventIds: [],
      blockingReasons: [...new Set([...plan.blockers, confirmToken ? "ai_xp_spend_preview_stale" : "confirm_token_missing"])],
    };
  }
  return applySeasonEndXpSpend(save, teamId, plan.plannedUpgrades, confirmToken, persistence, {
    allowAiTeams: true,
    skipAfterEconomyAudit: options?.skipAfterEconomyAudit,
    deferLeagueWideMarketValueRecalc: options?.deferLeagueWideMarketValueRecalc,
  }, cachedEconomyContext, plan.preview, preComputedSeasonXp);
}
