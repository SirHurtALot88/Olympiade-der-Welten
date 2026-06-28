import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";
import { getAiManagerMarketSpendableCash, resolveMarketSpendableCashForPlanner } from "@/lib/ai/ai-manager-apply-service";
import { getTeamObjectiveAiBias, type TeamObjectiveAiBias } from "@/lib/board/team-season-objectives-service";
import type { ContractShape, GameState, Player, Team, TeamControlMode, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { getTeamStrategyProfile, withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import { withNormalizedTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { projectFoundationStateFromPrisma } from "@/lib/db/read/foundation-read-projection";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import { recommendContractOfferForPlayer } from "@/lib/market/contract-negotiation-preview";
import {
  createLocalTransfermarktRunContext,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
} from "@/lib/market/transfermarkt-local-service";
import { listTransfermarktFreeAgents } from "@/lib/market/transfermarkt-read-service";
import {
  MERCENARY_NEGATIVE_FIT_PENALTY_REASON,
  calculateTransfermarktFit,
  getMercenaryNegativeFitPenalty,
  normalizeTransfermarktToken,
} from "@/lib/market/transfermarkt-fit";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  annotateBuyRecommendations,
  loadDoctrineContext,
  resolveTeamReplacementSlots,
} from "@/lib/ai/ai-transfer-plan-enrichment";
import { getSeasonDisciplineScheduleEntry } from "@/lib/season/season-discipline-schedule";
import {
  buildTeamThemeCompositionRuntimeContext,
  calculateThemeCompositionScore,
  getTeamThemeCompositionTarget,
  type TeamThemeCompositionRuntimeContext,
} from "@/lib/ai/team-theme-composition-service";

export type AiTransferPreviewSource = "sqlite" | "prisma";
export type AiTransferPreviewTeamScope = "ai" | "all";
export type AiTransferPreviewTeamStatus = "ready" | "warning" | "blocked";

export type AiTransferPreviewParams = {
  source?: AiTransferPreviewSource;
  saveId?: string | null;
  seasonId?: string | null;
  teamId?: string | null;
  teamScope?: AiTransferPreviewTeamScope;
  excludedPlayerIds?: string[] | null;
  limit?: number | null;
  fullScoringLimit?: number | null;
  /** Picks/planner: budget-only stage-0 over full FA feed. Default strategic funnel for TM board. */
  candidateScopeMode?: AiPreviewCandidateScopeMode | null;
  buyNeedOnly?: boolean | null;
  forceBuyScanTeamIds?: string[] | null;
};

export type AiPreviewCandidateScopeMode = "strategic" | "budget_wide";

/** Full-score cap for budget_wide when caller does not pass fullScoringLimit. */
export const AI_PREVIEW_BUDGET_WIDE_DEFAULT_FULL_SCORING = 480;

export type AiTransferPreviewRecommendation = {
  playerId: string;
  playerName: string;
  name: string;
  className: string;
  race: string;
  ovr: number | null;
  mvs: number | null;
  price: number | null;
  marketValue: number | null;
  salary: number | null;
  contractLength: number | null;
  contractShape?: ContractShape | null;
  cashAfter: number | null;
  rosterAfter: number | null;
  salaryAfter: number | null;
  teamFit: number | null;
  needMatchLabel?: string | null;
  fitSummary: string;
  sportsSummary: string;
  budgetReason: string[];
  warnings: string[];
  overallRecommendationScore: number;
  score: number;
  themeCompositionScore?: number;
  themeTier?: string;
  themeTags?: string[];
  reason: string;
  fitNotes: string[];
  riskNotes: string[];
  strategyNotes: string[];
  buyIntentScore?: number | null;
  passIntentScore?: number | null;
  replacementFitScore?: number | null;
  strategicBuyScore?: number | null;
  buyDecisionLabel?: string | null;
  replacementSlotId?: string | null;
  reasonToBuy?: string[];
  reasonToPass?: string[];
};

export type AiTransferPreviewSkippedTarget = {
  playerId: string;
  name: string;
  reason: string;
  blockingReasons: string[];
};

export type AiTransferPreviewTeamEntry = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  aiTransferPreviewEnabled: boolean;
  status: AiTransferPreviewTeamStatus;
  cash: number | null;
  salary: number | null;
  salaryTotal: number | null;
  rosterSize: number | null;
  rosterCount: number | null;
  targetRosterMin: number | null;
  targetRosterOpt: number | null;
  marketValueTotal: number | null;
  needSummary: string;
  budgetStatus: "healthy" | "tight" | "critical" | "unknown";
  rosterStatus: "under_min" | "under_opt" | "at_or_above_opt" | "unknown";
  legalCandidatePool?: AiTransferPreviewRecommendation[];
  topTargets: AiTransferPreviewRecommendation[];
  recommendedBuys: AiTransferPreviewRecommendation[];
  skippedTargets: AiTransferPreviewSkippedTarget[];
  warnings: string[];
  explanation: string;
};

export type AiTransferPreviewResult = {
  readOnly: true;
  source: AiTransferPreviewSource;
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: AiTransferPreviewTeamScope;
  };
  totalTeams: number;
  aiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  teams: AiTransferPreviewTeamEntry[];
  debugPerformance?: {
    durationMs: number;
    teamCount: number;
    candidateScans: number;
    hardFilterCount: number;
    roughScoreCount: number;
    candidateEnrichments: number;
    fullBuyPreviewCount: number;
    negotiationPreviewCount: number;
    contextMs?: number;
    baseFeedMs?: number;
    teamScopeMs?: number;
    teamPrepMs?: number;
    controlStrategyMs?: number;
    objectiveBiasMs?: number;
    needsMs?: number;
    rosterPrepMs?: number;
    themeRuntimeMs?: number;
    roughShortlistMs?: number;
    fullScoreMs?: number;
    recommendationMs?: number;
  };
};

type ResolvedPreviewContext = {
  source: AiTransferPreviewSource;
  saveId: string;
  seasonId: string;
  gameState: GameState;
  localRunContext?: ReturnType<typeof createLocalTransfermarktRunContext> | null;
};

type RosterEntry = GameState["rosters"][number];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

const CLASS_COLOR_BY_CLASS: Record<string, "red" | "green" | "blue" | "yellow"> = {
  berserker: "red",
  warlord: "red",
  tank: "red",
  sprinter: "green",
  rogue: "green",
  charger: "green",
  mage: "blue",
  overseer: "blue",
  templar: "blue",
  bard: "yellow",
  hero: "yellow",
  badass: "yellow",
  tactician: "yellow",
};

const CLASS_AXIS_BY_COLOR: Record<"red" | "green" | "blue" | "yellow", "pow" | "spe" | "men" | "soc"> = {
  red: "pow",
  green: "spe",
  blue: "men",
  yellow: "soc",
};

const candidateTokenCache = new WeakMap<TransfermarktFreeAgentItem, string[]>();
const semanticTokenCache = new Map<string, ReadonlySet<string>>();
const candidateMatchContextCache = new WeakMap<string[], { set: Set<string>; expanded: string[] }>();
const listMatchCountCache = new WeakMap<string[], Map<string, number>>();

function getSemanticTokens(token: string) {
  const normalized = normalizeTransfermarktToken(token);
  const semantic = new Set<string>();
  if (!normalized) {
    return semantic;
  }
  const cached = semanticTokenCache.get(normalized);
  if (cached) {
    return cached;
  }

  semantic.add(normalized);
  const mappedColor = CLASS_COLOR_BY_CLASS[normalized];
  if (mappedColor) {
    semantic.add(mappedColor);
    semantic.add(CLASS_AXIS_BY_COLOR[mappedColor]);
  }

  if (["wizard", "warlock", "summoner", "arcane", "spell", "mage", "magic"].some((entry) => normalized.includes(entry))) {
    semantic.add("blue");
    semantic.add("men");
    semantic.add("mage");
    semantic.add("magic");
  }
  if (["teacher", "leader", "captain", "mentor", "bard", "hero", "tactician", "charisma", "social"].some((entry) => normalized.includes(entry))) {
    semantic.add("yellow");
    semantic.add("soc");
    semantic.add("leader");
    semantic.add("mentor");
  }
  if (["assassin", "ninja", "rogue", "sprinter", "charger", "agile", "speed", "scout"].some((entry) => normalized.includes(entry))) {
    semantic.add("green");
    semantic.add("spe");
    semantic.add("agile");
    semantic.add("speed");
  }
  if (["berserker", "warlord", "tank", "bruiser", "guardian", "frontline", "power"].some((entry) => normalized.includes(entry))) {
    semantic.add("red");
    semantic.add("pow");
    semantic.add("bruiser");
    semantic.add("frontline");
  }

  semanticTokenCache.set(normalized, semantic);
  return semantic;
}

function expandSemanticTokens(values: string[]) {
  const expanded = new Set<string>();
  for (const value of values) {
    for (const token of getSemanticTokens(value)) {
      expanded.add(token);
    }
  }
  return expanded;
}

function getTeamMarketValueTotal(gameState: GameState, teamId: string) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => {
      const player = playersById.get(entry.playerId) ?? null;
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).marketValue ?? 0);
    }, 0);
}

function getRosterEconomyContext(
  gameState: GameState,
  teamId: string,
  playersById = new Map(gameState.players.map((player) => [player.id, player] as const)),
  rosterEntries: RosterEntry[] | null = null,
) {
  const rosterPlayers = (rosterEntries ?? gameState.rosters.filter((entry) => entry.teamId === teamId))
    .map((entry) => ({
      entry,
      player: playersById.get(entry.playerId) ?? null,
    }))
    .filter((item): item is { entry: RosterEntry; player: Player } => Boolean(item.player));
  return {
    rosterCount: rosterPlayers.length,
    salaryTotal: roundValue(
      rosterPlayers.reduce(
        (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).salary ?? 0),
        0,
      ),
      2,
    ),
    marketValueTotal: roundValue(
      rosterPlayers.reduce(
        (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).marketValue ?? 0),
        0,
      ),
      2,
    ),
  };
}

function capRosterTarget(value: number | null | undefined, rosterLimit: number) {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(Math.round(value), rosterLimit);
}

function normalizeGameState(gameState: GameState) {
  return withNormalizedTeamStrategyProfiles(withNormalizedTeamControlSettings(gameState));
}

function getBudgetStatus(team: Team) {
  if (!Number.isFinite(team.cash) || !Number.isFinite(team.budget) || team.budget <= 0) {
    return "unknown" as const;
  }

  const ratio = team.cash / team.budget;
  if (ratio <= 0.18) return "critical" as const;
  if (ratio <= 0.4) return "tight" as const;
  return "healthy" as const;
}

function getRosterStatus(input: {
  rosterCount: number | null;
  playerMin: number | null;
  playerOpt: number | null;
}) {
  if (input.rosterCount == null || input.playerMin == null || input.playerOpt == null) {
    return "unknown" as const;
  }

  if (input.rosterCount < input.playerMin) return "under_min" as const;
  if (input.rosterCount < input.playerOpt) return "under_opt" as const;
  return "at_or_above_opt" as const;
}

function getCurrentMatchdayRosterRequirement(gameState: GameState) {
  const activeMatchdayId = gameState.matchdayState.matchdayId;
  const scheduleEntry = getSeasonDisciplineScheduleEntry(gameState, activeMatchdayId);
  if (!scheduleEntry) {
    return null;
  }

  const d1Players = scheduleEntry.discipline1?.playerCount ?? 0;
  const d2Players = scheduleEntry.discipline2?.playerCount ?? 0;
  const totalPlayers = d1Players + d2Players;

  return totalPlayers > 0 ? totalPlayers : null;
}

function getCombinedCandidateTokens(item: TransfermarktFreeAgentItem) {
  const cached = candidateTokenCache.get(item);
  if (cached) {
    return cached;
  }

  const tokens = [...expandSemanticTokens([
    item.className,
    item.race,
    item.alignment,
    ...item.subclasses,
    ...item.traitsPositive,
    ...item.traitsNegative,
    ...item.topDisciplineScores.map((entry) => entry.disciplineName),
  ])];
  candidateTokenCache.set(item, tokens);
  return tokens;
}

function countListMatches(values: string[], candidateTokens: string[]) {
  const normalized = values.map(normalizeTransfermarktToken).filter(Boolean);
  if (normalized.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const cacheKey = normalized.join("|");
  let perCandidateCache = listMatchCountCache.get(candidateTokens);
  if (!perCandidateCache) {
    perCandidateCache = new Map<string, number>();
    listMatchCountCache.set(candidateTokens, perCandidateCache);
  }
  const cached = perCandidateCache.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  let context = candidateMatchContextCache.get(candidateTokens);
  if (!context) {
    const candidateSet = expandSemanticTokens(candidateTokens);
    context = {
      set: candidateSet,
      expanded: [...candidateSet],
    };
    candidateMatchContextCache.set(candidateTokens, context);
  }

  const matchCount = normalized.filter((token) => {
    const semanticTokens = [...getSemanticTokens(token)];
    return semanticTokens.some(
      (semantic) =>
        context.set.has(semantic) ||
        context.expanded.some((candidate) => candidate.includes(semantic) || semantic.includes(candidate)),
    );
  }).length;
  perCandidateCache.set(cacheKey, matchCount);
  return matchCount;
}

function getStrategyPriorityBoost(item: TransfermarktFreeAgentItem, strategyProfile: ReturnType<typeof getTeamStrategyProfile>) {
  if (!strategyProfile) {
    return 0;
  }

  const candidateTokens = getCombinedCandidateTokens(item);
  const exactPreferredClassHits = (strategyProfile.preferredClasses ?? []).filter(
    (entry) => normalizeTransfermarktToken(entry) === normalizeTransfermarktToken(item.className),
  ).length;
  const preferredClassHits = countListMatches(strategyProfile.preferredClasses ?? [], candidateTokens);
  const preferredArchetypeHits = countListMatches(strategyProfile.preferredArchetypes ?? [], candidateTokens);
  const preferredRaceHits = countListMatches(strategyProfile.preferredRaces ?? [], candidateTokens);
  const valuePriority = clamp((strategyProfile.bias.valuePriority ?? 5) / 10, 0, 1);
  const salary = item.salary ?? 0;
  const axisAverage = ((item.pow ?? 0) + (item.spe ?? 0) + (item.men ?? 0) + (item.soc ?? 0)) / 4;
  const valueBoost = valuePriority >= 0.7 ? (axisAverage / Math.max(1, salary + 5)) * valuePriority * 1.8 : 0;

  return exactPreferredClassHits * 55 + preferredClassHits * 18 + preferredArchetypeHits * 12 + preferredRaceHits * 32 + valueBoost;
}

function getPreviewSignalBoost(scored: ReturnType<typeof scoreCandidate>) {
  return scored.strategyNotes.some((note) => note.includes("Rassenkern")) ? 34 : 0;
}

function itemHasThemeToken(item: TransfermarktFreeAgentItem, values: string[]) {
  return countListMatches(values, getCombinedCandidateTokens(item)) > 0;
}

function getHardQuotaCheapBoost(teamId: string, item: TransfermarktFreeAgentItem) {
  const female = normalizeTransfermarktToken(item.gender) === "female" || normalizeTransfermarktToken(item.gender) === "weiblich" || normalizeTransfermarktToken(item.gender) === "w";
  const race = normalizeTransfermarktToken(item.race);
  const hasPet = race === "animal" || itemHasThemeToken(item, ["Animal", "Pet", "Beast"]);
  switch (teamId) {
    case "H-R":
      return itemHasThemeToken(item, ["Demon", "Hell", "Infernal", "Devil", "Fiend", "Prime Evil", "Succubus", "Incubus"]) ? 95 : -22;
    case "P-C":
      return itemHasThemeToken(item, ["Pirate", "Swashbuckler", "Wayfarer", "Corsair"]) ? 90 : -18;
    case "D-P":
      return female && itemHasThemeToken(item, ["Demon", "Hell", "Infernal", "Succubus", "Dark", "Shadow", "Temptress"]) ? 75 : female ? 25 : -20;
    case "T-G":
      return itemHasThemeToken(item, ["Tall", "Giant", "Colossus", "Titan"]) ? 100 : -24;
    case "V-D":
      return female || hasPet ? 85 : -26;
    default:
      return 0;
  }
}

function getPotentialValueScore(item: TransfermarktFreeAgentItem) {
  const bandScore =
    item.potentialBand === "elite"
      ? 1
      : item.potentialBand === "high"
        ? 0.72
        : item.potentialBand === "medium"
          ? 0.38
          : item.potentialBand === "low"
            ? 0.12
            : 0;
  const confidenceFactor = item.scoutingConfidence == null ? 0.55 : clamp(item.scoutingConfidence / 100, 0.25, 1);
  return bandScore * confidenceFactor;
}

function getPotentialStrategyWeight(team: Team, strategyProfile: ReturnType<typeof getTeamStrategyProfile>) {
  const teamToken = `${team.teamId} ${team.name} ${strategyProfile?.strategySummary ?? ""} ${strategyProfile?.buyStyle ?? ""}`.toLowerCase();
  if (teamToken.includes("cash creator") || teamToken.includes("value")) return 0.16;
  if (teamToken.includes("teacher") || teamToken.includes("development") || teamToken.includes("academy")) return 0.14;
  if (teamToken.includes("mayhem") || teamToken.includes("champion") || teamToken.includes("topteam")) return 0.05;
  return 0.09;
}

function buildNeedSummary(input: {
  weakestAxes: Array<"pow" | "spe" | "men" | "soc">;
  rosterStatus: AiTransferPreviewTeamEntry["rosterStatus"];
  budgetStatus: AiTransferPreviewTeamEntry["budgetStatus"];
}) {
  const axisLabel =
    input.weakestAxes.length > 0
      ? input.weakestAxes.map((axis) => axis.toUpperCase()).join(" / ")
      : "keine klare Achsenluecke";
  const rosterLabel =
    input.rosterStatus === "under_min"
      ? "Kader unter Minimum"
      : input.rosterStatus === "under_opt"
        ? "Kader unter Optimum"
        : input.rosterStatus === "at_or_above_opt"
          ? "Kader bei/ueber Optimum"
          : "Kaderstatus offen";
  const budgetLabel =
    input.budgetStatus === "healthy"
      ? "Budget gesund"
      : input.budgetStatus === "tight"
        ? "Budget eng"
        : input.budgetStatus === "critical"
          ? "Budget kritisch"
          : "Budgetstatus offen";

  return `${rosterLabel} · ${budgetLabel} · Fokus: ${axisLabel}.`;
}

function getPlayerById(gameState: GameState, playerId: string) {
  return gameState.players.find((entry) => entry.id === playerId) ?? null;
}

function buildRosterByTeamId(gameState: GameState) {
  const rosterByTeamId = new Map<string, GameState["rosters"]>();
  for (const rosterEntry of gameState.rosters) {
    const existing = rosterByTeamId.get(rosterEntry.teamId);
    if (existing) {
      existing.push(rosterEntry);
    } else {
      rosterByTeamId.set(rosterEntry.teamId, [rosterEntry]);
    }
  }
  return rosterByTeamId;
}

function buildRecentlySoldByTeamPlayerMap(gameState: GameState) {
  const byTeamPlayer = new Map<string, Set<string>>();
  const currentSeasonId = gameState.season.id;
  for (const entry of gameState.transferHistory) {
    if (
      entry.seasonId !== currentSeasonId ||
      entry.transferType !== "sell" ||
      entry.fromTeamId == null ||
      entry.playerId == null
    ) {
      continue;
    }
    const existing = byTeamPlayer.get(entry.fromTeamId) ?? new Set<string>();
    existing.add(entry.playerId);
    byTeamPlayer.set(entry.fromTeamId, existing);
  }
  return byTeamPlayer;
}

function getCandidatePrimaryAxis(item: TransfermarktFreeAgentItem): "pow" | "spe" | "men" | "soc" {
  const axisValues: Array<["pow" | "spe" | "men" | "soc", number]> = [
    ["pow", item.pow ?? 0],
    ["spe", item.spe ?? 0],
    ["men", item.men ?? 0],
    ["soc", item.soc ?? 0],
  ];
  axisValues.sort((left, right) => right[1] - left[1]);
  return axisValues[0]?.[0] ?? "pow";
}

function matchesHardNoGoCandidate(profile: TeamStrategyProfile | null, item: TransfermarktFreeAgentItem) {
  if (!profile || profile.hardNoGos.length === 0) {
    return false;
  }

  const tokens = getCombinedCandidateTokens(item);
  const normalizedRace = normalizeTransfermarktToken(item.race);
  return profile.hardNoGos.some((entry) => {
    const normalized = normalizeTransfermarktToken(entry);
    if (!normalized) {
      return false;
    }
    if (normalized.includes("nonhuman") && normalizedRace !== "human") {
      return true;
    }
    if (normalized.includes("human") && normalized.includes("anti") && normalizedRace === "human") {
      return true;
    }
    return tokens.some((token) => token === normalized || token.includes(normalized) || normalized.includes(token));
  });
}

function buildCheapCandidateScore(input: {
  item: TransfermarktFreeAgentItem;
  teamId: string;
  weakestAxes: Array<"pow" | "spe" | "men" | "soc">;
  needs: ReturnType<typeof evaluateAiNeeds>;
  strategyProfile: TeamStrategyProfile | null;
  objectiveBias?: TeamObjectiveAiBias | null;
}) {
  const { item, teamId, weakestAxes, needs, strategyProfile } = input;
  const salary = item.salary ?? 0;
  const axisMap = {
    pow: clamp((item.pow ?? 0) / 100, 0, 1),
    spe: clamp((item.spe ?? 0) / 100, 0, 1),
    men: clamp((item.men ?? 0) / 100, 0, 1),
    soc: clamp((item.soc ?? 0) / 100, 0, 1),
  };
  const axisNeedScore =
    weakestAxes.length > 0
      ? clamp(weakestAxes.reduce((sum, axis) => sum + axisMap[axis], 0) / weakestAxes.length, 0, 1)
      : axisMap[getCandidatePrimaryAxis(item)];
  const disciplineNeedScore = clamp(
    item.topDisciplineScores.filter((entry) => needs.topNeedDisciplineIds.includes(entry.disciplineId)).length / 2,
    0,
    1,
  );
  const objectiveAxisScore = getObjectiveAxisScore(axisMap, input.objectiveBias);
  const strategyBoost = getStrategyPriorityBoost(item, strategyProfile);
  const hardQuotaBoost = getHardQuotaCheapBoost(teamId, item);
  return (
    axisNeedScore * 42 +
    objectiveAxisScore * 26 +
    disciplineNeedScore * 28 +
    Math.max(0, 14 - salary) +
    strategyBoost +
    hardQuotaBoost
  );
}

function getAxisValue(item: TransfermarktFreeAgentItem, axis: "pow" | "spe" | "men" | "soc") {
  return item[axis] ?? 0;
}

function getObjectivePriorityAxes(objectiveBias?: TeamObjectiveAiBias | null) {
  return (["pow", "spe", "men", "soc"] as const).filter((axis) => (objectiveBias?.axisPriorities?.[axis] ?? 0) > 0.25);
}

function getStrategicLaneAxes(input: {
  weakestAxes: Array<"pow" | "spe" | "men" | "soc">;
  objectiveBias?: TeamObjectiveAiBias | null;
}): Array<"pow" | "spe" | "men" | "soc"> {
  const objectiveAxes = getObjectivePriorityAxes(input.objectiveBias);
  if (objectiveAxes.length > 0) {
    return Array.from(new Set<"pow" | "spe" | "men" | "soc">([...objectiveAxes, ...input.weakestAxes]));
  }
  if (input.weakestAxes.length > 0) return input.weakestAxes;
  return ["pow", "spe", "men", "soc"];
}

function getObjectiveAxisScore(
  axisMap: Record<"pow" | "spe" | "men" | "soc", number>,
  objectiveBias?: TeamObjectiveAiBias | null,
) {
  const weights = objectiveBias?.axisPriorities ?? {};
  const entries = (["pow", "spe", "men", "soc"] as const)
    .map((axis) => ({ axis, weight: weights[axis] ?? 0 }))
    .filter((entry) => entry.weight > 0);
  const weightSum = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (weightSum <= 0) return 0;
  return clamp(entries.reduce((sum, entry) => sum + axisMap[entry.axis] * entry.weight, 0) / weightSum, 0, 1);
}

function getClassAxis(item: TransfermarktFreeAgentItem): "pow" | "spe" | "men" | "soc" | null {
  const color = CLASS_COLOR_BY_CLASS[normalizeTransfermarktToken(item.className)];
  return color ? CLASS_AXIS_BY_COLOR[color] : null;
}

function getValueRatio(item: TransfermarktFreeAgentItem) {
  if (item.marketValueSalaryRatio != null && Number.isFinite(item.marketValueSalaryRatio)) {
    return item.marketValueSalaryRatio;
  }
  const marketValue = item.marketValue ?? 0;
  const salary = item.salary ?? 0;
  return salary > 0 ? marketValue / salary : 0;
}

const AI_CHEAP_FILL_MARKET_VALUE_CAP = 15;
const AI_RESERVE_MARKET_VALUE_CAP = 20;
const AI_EXPENSIVE_EARLY_SCAN_CAP = 60;

function getAiPreviewMarketValue(item: TransfermarktFreeAgentItem) {
  return item.marketValue ?? Number.POSITIVE_INFINITY;
}

function isAiCheapFillCandidate(item: TransfermarktFreeAgentItem) {
  return getAiPreviewMarketValue(item) < AI_CHEAP_FILL_MARKET_VALUE_CAP;
}

function isAiReserveCandidate(item: TransfermarktFreeAgentItem) {
  return getAiPreviewMarketValue(item) < AI_RESERVE_MARKET_VALUE_CAP;
}

function matchesStrategicStageZeroGate(input: {
  item: TransfermarktFreeAgentItem;
  weakestAxes: Array<"pow" | "spe" | "men" | "soc">;
  needs: ReturnType<typeof evaluateAiNeeds>;
  rosterStatus: AiTransferPreviewTeamEntry["rosterStatus"];
  objectiveBias?: TeamObjectiveAiBias | null;
}) {
  if (isAiCheapFillCandidate(input.item)) return true;
  const laneAxes = getStrategicLaneAxes({ weakestAxes: input.weakestAxes, objectiveBias: input.objectiveBias });
  const classAxis = getClassAxis(input.item);
  const axisHit = laneAxes.some((axis) => getAxisValue(input.item, axis) >= 40 || classAxis === axis);
  const disciplineHit = input.item.topDisciplineScores.some((entry) => input.needs.topNeedDisciplineIds.includes(entry.disciplineId));
  const valueHit = getValueRatio(input.item) >= (input.rosterStatus === "under_min" ? 3.2 : 4.2);
  const reserveFit = input.rosterStatus === "under_min" && isAiReserveCandidate(input.item);

  return axisHit || disciplineHit || valueHit || reserveFit;
}

function buildStrategicAiPreviewScope(input: {
  baseFreeAgents: TransfermarktFreeAgentItem[];
  marketValueSortedAsc?: boolean;
  spendableCash: number;
  teamId: string;
  rosterPlayers: Player[];
  playerById: Map<string, Player>;
  limit: number;
  fullScoringLimit: number | null;
  weakestAxes: Array<"pow" | "spe" | "men" | "soc">;
  needs: ReturnType<typeof evaluateAiNeeds>;
  strategyProfile: TeamStrategyProfile | null;
  objectiveBias?: TeamObjectiveAiBias | null;
  rosterStatus: AiTransferPreviewTeamEntry["rosterStatus"];
  globallyExcludedPlayerIds: Set<string>;
  recentlySoldPlayerIds: Set<string>;
  onScan?: (item: TransfermarktFreeAgentItem) => void;
}) {
  const selected = new Map<string, TransfermarktFreeAgentItem>();
  const stage0SkippedTargets: AiTransferPreviewSkippedTarget[] = [];
  const primaryAffordable: Array<{ item: TransfermarktFreeAgentItem; cheapScore: number }> = [];
  const mercenaryFallbackAffordable: Array<{ item: TransfermarktFreeAgentItem; cheapScore: number }> = [];
  const budget = Math.max(0, input.spendableCash);
  const targetSize =
    input.fullScoringLimit != null
      ? Math.max(input.fullScoringLimit * 3, input.limit * 4)
      : Math.max(input.rosterStatus === "under_min" ? 120 : 80, Math.ceil(input.limit * 1.15));

  for (const item of input.baseFreeAgents) {
    if (input.globallyExcludedPlayerIds.has(item.playerId)) continue;
    if (input.recentlySoldPlayerIds.has(item.playerId)) continue;
    if (item.marketValue == null || item.salary == null) continue;
    if (item.marketValue > budget) {
      if (stage0SkippedTargets.length < 5) {
        stage0SkippedTargets.push({
          playerId: item.playerId,
          name: item.name,
          reason: "insufficient_cash",
          blockingReasons: ["insufficient_cash"],
        });
      }
      if (input.marketValueSortedAsc) {
        break;
      }
      continue;
    }
    if (!matchesStrategicStageZeroGate({
      item,
      weakestAxes: input.weakestAxes,
      needs: input.needs,
      rosterStatus: input.rosterStatus,
      objectiveBias: input.objectiveBias,
    })) {
      continue;
    }
    input.onScan?.(item);
    const cheapReserveBoost =
      isAiCheapFillCandidate(item) ? 22
        : isAiReserveCandidate(item) ? 12
          : item.marketValue != null && item.marketValue > AI_EXPENSIVE_EARLY_SCAN_CAP ? -18
            : 0;
    const row = {
      item,
      cheapScore: buildCheapCandidateScore({
        item,
        teamId: input.teamId,
        weakestAxes: input.weakestAxes,
        needs: input.needs,
        strategyProfile: input.strategyProfile,
        objectiveBias: input.objectiveBias,
      }) + cheapReserveBoost,
    };
    primaryAffordable.push(row);
  }
  const affordable = primaryAffordable.length > 0 ? primaryAffordable : mercenaryFallbackAffordable;

  const add = (item: TransfermarktFreeAgentItem | null | undefined) => {
    if (!item || selected.has(item.playerId) || selected.size >= targetSize) return;
    selected.set(item.playerId, item);
  };
  const addMany = (items: TransfermarktFreeAgentItem[]) => {
    for (const item of items) {
      add(item);
      if (selected.size >= targetSize) break;
    }
  };

  const ranked = [...affordable].sort((left, right) => right.cheapScore - left.cheapScore);
  addMany(ranked.slice(0, Math.max(24, Math.ceil(targetSize * 0.28))).map((entry) => entry.item));

  const laneAxes = getStrategicLaneAxes({ weakestAxes: input.weakestAxes, objectiveBias: input.objectiveBias });
  for (const axis of laneAxes) {
    addMany(
      [...affordable]
        .filter(({ item }) => getAxisValue(item, axis) >= 40 || getClassAxis(item) === axis)
        .sort((left, right) => {
          const axisDelta = getAxisValue(right.item, axis) - getAxisValue(left.item, axis);
          if (axisDelta !== 0) return axisDelta;
          return right.cheapScore - left.cheapScore;
        })
        .slice(0, Math.max(12, Math.ceil(targetSize * 0.14)))
        .map((entry) => entry.item),
    );
  }

  addMany(
    [...affordable]
      .filter(({ item }) => item.topDisciplineScores.some((entry) => input.needs.topNeedDisciplineIds.includes(entry.disciplineId)))
      .sort((left, right) => right.cheapScore - left.cheapScore)
      .slice(0, Math.max(16, Math.ceil(targetSize * 0.16)))
      .map((entry) => entry.item),
  );

  addMany(
    [...affordable]
      .sort((left, right) => {
        const ratioDelta = getValueRatio(right.item) - getValueRatio(left.item);
        if (Math.abs(ratioDelta) > 0.01) return ratioDelta;
        return right.cheapScore - left.cheapScore;
      })
      .slice(0, Math.max(18, Math.ceil(targetSize * 0.18)))
      .map((entry) => entry.item),
  );

  addMany(
    [...affordable]
      .sort((left, right) => {
        const priceDelta = (left.item.marketValue ?? Number.POSITIVE_INFINITY) - (right.item.marketValue ?? Number.POSITIVE_INFINITY);
        if (priceDelta !== 0) return priceDelta;
        return right.cheapScore - left.cheapScore;
      })
      .slice(0, Math.max(18, Math.ceil(targetSize * 0.18)))
      .map((entry) => entry.item),
  );

  addMany(ranked.map((entry) => entry.item));

  return {
    candidates: [...selected.values()],
    stage0SkippedTargets,
    affordableCount: affordable.length,
  };
}

export function buildBudgetWideAffordableScope(input: {
  baseFreeAgents: TransfermarktFreeAgentItem[];
  marketValueSortedAsc?: boolean;
  spendableCash: number;
  globallyExcludedPlayerIds: Set<string>;
  recentlySoldPlayerIds: Set<string>;
  onScan?: (item: TransfermarktFreeAgentItem) => void;
}) {
  const candidates: TransfermarktFreeAgentItem[] = [];
  const stage0SkippedTargets: AiTransferPreviewSkippedTarget[] = [];
  const budget = Math.max(0, input.spendableCash);

  for (const item of input.baseFreeAgents) {
    if (input.globallyExcludedPlayerIds.has(item.playerId)) continue;
    if (input.recentlySoldPlayerIds.has(item.playerId)) continue;
    if (item.marketValue == null || item.salary == null) continue;
    if (item.marketValue > budget) {
      if (stage0SkippedTargets.length < 5) {
        stage0SkippedTargets.push({
          playerId: item.playerId,
          name: item.name,
          reason: "insufficient_cash",
          blockingReasons: ["insufficient_cash"],
        });
      }
      if (input.marketValueSortedAsc) {
        break;
      }
      continue;
    }
    input.onScan?.(item);
    candidates.push(item);
  }

  return {
    candidates,
    stage0SkippedTargets,
    affordableCount: candidates.length,
  };
}

function resolveRoughShortlistLimit(input: {
  candidateScopeMode: AiPreviewCandidateScopeMode;
  scopedCount: number;
  limit: number;
  fullScoringLimit: number | null;
  rosterStatus: AiTransferPreviewTeamEntry["rosterStatus"];
}) {
  if (input.candidateScopeMode === "budget_wide") {
    const cap = input.fullScoringLimit ?? AI_PREVIEW_BUDGET_WIDE_DEFAULT_FULL_SCORING;
    return Math.min(input.scopedCount, Math.max(120, cap));
  }
  if (input.fullScoringLimit != null) {
    return Math.min(input.scopedCount, input.fullScoringLimit);
  }
  if (input.limit >= input.scopedCount) {
    return Math.min(input.scopedCount, Math.max(72, Math.ceil(input.scopedCount * 0.12)));
  }
  return Math.max(16, Math.min(24, input.limit));
}

function enrichCandidateForTeam(input: {
  context: ResolvedPreviewContext;
  team: Team;
  item: TransfermarktFreeAgentItem;
  rosterPlayers: Player[];
  playerById: Map<string, Player>;
  teamSalary: number | null;
  playerMin: number | null;
  playerOpt: number | null;
}): TransfermarktFreeAgentItem {
  const player = input.playerById.get(input.item.playerId) ?? null;
  const fitBreakdown =
    player
      ? calculateTransfermarktFit(player, input.rosterPlayers, { teamId: input.team.teamId })
      : {
          fitRace: 0,
          fitSubclasses: 0,
          fitTraits: 0,
          fitAlignment: 0,
          teamFit: 0,
        };

  return {
    ...input.item,
    teamContextAvailable: true,
    teamCash: input.team.cash ?? null,
    teamSalary: input.item.teamSalary ?? input.teamSalary,
    rosterCount: input.rosterPlayers.length,
    playerMin: input.playerMin,
    playerOpt: input.playerOpt,
    affordabilityStatus:
      input.item.marketValue == null
        ? null
        : input.team.cash >= input.item.marketValue
          ? "affordable"
          : "too_expensive",
    rosterPressureStatus:
      input.playerMin == null || input.playerOpt == null
        ? null
        : input.rosterPlayers.length < input.playerMin
          ? "under_min"
          : input.rosterPlayers.length < input.playerOpt
            ? "under_opt"
            : "at_or_above_opt",
    fitRace: fitBreakdown.fitRace,
    fitSubclasses: fitBreakdown.fitSubclasses,
    fitTraits: fitBreakdown.fitTraits,
    fitAlignment: fitBreakdown.fitAlignment,
    fit: fitBreakdown.teamFit,
    fitDisplay: input.item.mercenary ? `${fitBreakdown.teamFit ?? 0} · Mercenary` : `${fitBreakdown.teamFit ?? 0}`,
    fitSource: "local_approximation_not_golden_master" as const,
  };
}

function buildRosterClassCounts(rosterEntries: RosterEntry[], playersById: Map<string, Player>) {
  const counts = new Map<string, number>();
  for (const rosterEntry of rosterEntries) {
    const player = playersById.get(rosterEntry.playerId) ?? null;
    const classToken = normalizeTransfermarktToken(player?.className ?? "");
    if (!classToken) {
      continue;
    }
    counts.set(classToken, (counts.get(classToken) ?? 0) + 1);
  }
  return counts;
}

function buildDiverseCandidateSlice<T extends { item: { className: string; race?: string | null } }>(
  entries: T[],
  limit: number,
  perClassCap = 2,
  perRaceCap = 5,
) {
  const selected: T[] = [];
  const classCounts = new Map<string, number>();
  const raceCounts = new Map<string, number>();

  for (const entry of entries) {
    const classToken = normalizeTransfermarktToken(entry.item.className);
    const raceToken = normalizeTransfermarktToken(entry.item.race ?? "");
    const currentClassCount = classCounts.get(classToken) ?? 0;
    const currentRaceCount = raceCounts.get(raceToken) ?? 0;
    if (currentClassCount >= perClassCap || (raceToken && currentRaceCount >= perRaceCap)) {
      continue;
    }
    selected.push(entry);
    classCounts.set(classToken, currentClassCount + 1);
    if (raceToken) raceCounts.set(raceToken, currentRaceCount + 1);
    if (selected.length >= limit) {
      return selected;
    }
  }

  for (const entry of entries) {
    if (selected.includes(entry)) {
      continue;
    }
    selected.push(entry);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

async function resolvePreviewContext(params: AiTransferPreviewParams): Promise<ResolvedPreviewContext> {
  const source = params.source === "prisma" ? "prisma" : "sqlite";

  if (source === "prisma") {
    const snapshot = await loadFoundationSnapshotFromPrisma(params.saveId ?? undefined);
    if (!snapshot) {
      throw new Error("Prisma foundation snapshot could not be loaded.");
    }

    const projected = projectFoundationStateFromPrisma(snapshot);
    return {
      source,
      saveId: projected.save.saveId,
      seasonId: projected.save.gameState.season.id,
      gameState: normalizeGameState(projected.save.gameState),
      localRunContext: null,
    };
  }

  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const requestedSave = params.saveId ? persistence.getSaveById(params.saveId) : null;
  if (params.saveId && !requestedSave) {
    throw new Error(`Requested save ${params.saveId} could not be resolved for AI transfer preview.`);
  }
  const save =
    requestedSave ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("SQLite save could not be loaded.");
  }

  return {
    source,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    gameState: normalizeGameState(save.gameState),
    localRunContext: createLocalTransfermarktRunContext({ persistence, save }),
  };
}

async function loadFreeAgentsForTeam(context: ResolvedPreviewContext, teamId: string, limit: number) {
  const reader = context.source === "prisma" ? listTransfermarktFreeAgents : listLocalTransfermarktFreeAgents;
  return await reader({
    saveId: context.saveId,
    seasonId: context.seasonId,
    teamId,
    limit,
    mode: context.source === "sqlite" ? "ai_preview" : undefined,
    localRunContext: context.localRunContext,
  });
}

function buildCandidatePreview(
  context: ResolvedPreviewContext,
  team: Team,
  item: TransfermarktFreeAgentItem,
) {
  if (context.source === "sqlite") {
    const cashBefore = item.teamCash ?? team.cash ?? null;
    const salaryBefore = item.teamSalary ?? null;
    const rosterBefore = item.rosterCount ?? null;
    const purchasePrice = item.marketValue ?? null;
    const salary = item.salary ?? null;
    const player = context.gameState.players.find((candidate) => candidate.id === item.playerId) ?? null;
    const teamRoster = context.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const teamSalary = teamRoster.reduce((sum, entry) => sum + (entry.salary ?? entry.upkeep ?? 0), 0);
    const identity = context.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const contractOffer = recommendContractOfferForPlayer({
      player,
      teamStrategyProfile: getTeamStrategyProfile(context.gameState, team.teamId),
      teamCash: cashBefore,
      marketValue: purchasePrice,
      teamFit: item.fit,
      currentTeamSalary: teamSalary,
      teamIdentity: identity,
      dealRole: item.needMatchLabel ?? null,
      rosterCountBefore: rosterBefore,
      teamRosterMin: item.playerMin,
      teamRosterOpt: item.playerOpt,
      isFirstSeason: context.seasonId === "season-1",
    });
    const blockingReasons: string[] = [];

    if (purchasePrice == null || purchasePrice <= 0) blockingReasons.push("market_value_missing");
    if (salary == null || salary <= 0) blockingReasons.push("salary_demand_missing");
    if (rosterBefore != null && rosterBefore >= team.rosterLimit) blockingReasons.push("roster_limit_reached");
    if (cashBefore != null && purchasePrice != null && cashBefore < purchasePrice) blockingReasons.push("insufficient_cash");

    const canBuy = blockingReasons.length === 0;
    return {
      canBuy,
      blockingReasons,
      warnings: [] as string[],
      player: {
        id: item.playerId,
        name: item.name,
        className: item.className,
        race: item.race,
      },
      team: {
        id: team.teamId,
        name: team.name,
        shortCode: team.shortCode,
      },
      cashBefore,
      cashAfter: canBuy && cashBefore != null && purchasePrice != null ? cashBefore - purchasePrice : cashBefore,
      salaryBefore,
      salaryAfter: canBuy && salaryBefore != null && salary != null ? salaryBefore + salary : salaryBefore,
      marketValueBefore: null,
      marketValueAfter: null,
      rosterBefore,
      rosterAfter: canBuy && rosterBefore != null ? rosterBefore + 1 : rosterBefore,
      purchasePrice,
      salary,
      contractLength: contractOffer.contractLength,
      contractShape: contractOffer.contractShape,
      currentValue: purchasePrice,
      joinedSeasonId: context.seasonId,
      expectedSalary: salary,
      offeredSalary: salary,
      offerRatio: null,
      yearlySalarySchedule: undefined,
      totalSalary: salary,
      roundingAdjustment: null,
      buyoutCost: null,
      bracket: item.bracket ?? null,
      teamFit: item.fit ?? null,
      acceptanceScore: null,
      acceptChance: null,
      counterChance: null,
      rejectChance: null,
      negotiationReasons: [],
      negotiationWarnings: [],
      negotiationBlockingReasons: [],
    };
  }

  const teamCash = item.teamCash ?? team.cash ?? null;
  const teamSalary = item.teamSalary ?? null;
  const rosterCount = item.rosterCount ?? null;
  const blockingReasons: string[] = [];
  if (item.marketValue == null || item.marketValue <= 0) blockingReasons.push("market_value_missing");
  if (item.salary == null || item.salary <= 0) blockingReasons.push("salary_demand_missing");
  if (teamCash != null && item.marketValue != null && teamCash < item.marketValue) blockingReasons.push("insufficient_cash");

  const canBuy = blockingReasons.length === 0;
  return {
    canBuy,
    blockingReasons,
    warnings: [] as string[],
    cashBefore: teamCash,
    cashAfter: canBuy && teamCash != null && item.marketValue != null ? teamCash - item.marketValue : teamCash,
    salaryBefore: teamSalary,
    salaryAfter: canBuy && teamSalary != null && item.salary != null ? teamSalary + item.salary : teamSalary,
    rosterBefore: rosterCount,
    rosterAfter: canBuy && rosterCount != null ? rosterCount + 1 : rosterCount,
    marketValueBefore: null,
    marketValueAfter: null,
    purchasePrice: item.marketValue,
    salary: item.salary,
  };
}

function scoreCandidate(input: {
  item: TransfermarktFreeAgentItem;
  budgetStatus: AiTransferPreviewTeamEntry["budgetStatus"];
  rosterStatus: AiTransferPreviewTeamEntry["rosterStatus"];
  weakestAxes: Array<"pow" | "spe" | "men" | "soc">;
  needs: ReturnType<typeof evaluateAiNeeds>;
  team: Team;
  context: ResolvedPreviewContext;
  rosterClassCounts: Map<string, number>;
  strategyProfile: TeamStrategyProfile | null;
  playerById: Map<string, Player>;
  rosterRaceTokens: Set<string>;
  themeRuntimeContext: TeamThemeCompositionRuntimeContext | null;
  objectiveBias?: TeamObjectiveAiBias | null;
}) {
  const { item, budgetStatus, rosterStatus, weakestAxes, needs } = input;
  const preview = buildCandidatePreview(input.context, input.team, item);
  const candidateTokens = getCombinedCandidateTokens(item);
  const strategyProfile = input.strategyProfile;
  const player = input.playerById.get(item.playerId) ?? null;

  const preferredRaceHits = countListMatches(strategyProfile?.preferredRaces ?? [], [normalizeTransfermarktToken(item.race)]);
  const avoidedRaceHits = countListMatches(strategyProfile?.avoidedRaces ?? [], [normalizeTransfermarktToken(item.race)]);
  const exactPreferredClassHits = (strategyProfile?.preferredClasses ?? []).filter(
    (entry) => normalizeTransfermarktToken(entry) === normalizeTransfermarktToken(item.className),
  ).length;
  const preferredClassHits = countListMatches(strategyProfile?.preferredClasses ?? [], [normalizeTransfermarktToken(item.className)]);
  const avoidedClassHits = countListMatches(strategyProfile?.avoidedClasses ?? [], [normalizeTransfermarktToken(item.className)]);
  const preferredArchetypeHits = countListMatches(strategyProfile?.preferredArchetypes ?? [], candidateTokens);
  const avoidedArchetypeHits = countListMatches(strategyProfile?.avoidedArchetypes ?? [], candidateTokens);
  const explicitThemeCount =
    (strategyProfile?.preferredClasses?.length ?? 0) +
    (strategyProfile?.preferredArchetypes?.length ?? 0) +
    (strategyProfile?.preferredRaces?.length ?? 0);
  const preferredThemeHits = preferredRaceHits + preferredClassHits + preferredArchetypeHits;
  const missingPreferredClassPenalty =
    (strategyProfile?.preferredClasses?.length ?? 0) > 0 && preferredClassHits === 0 ? 0.32 : 0;
  const missingPreferredArchetypePenalty =
    (strategyProfile?.preferredArchetypes?.length ?? 0) > 0 && preferredArchetypeHits === 0 ? 0.18 : 0;
  const currentClassCount = input.rosterClassCounts.get(normalizeTransfermarktToken(item.className)) ?? 0;
  const isSpamSensitiveClass = ["berserker", "warlord"].includes(normalizeTransfermarktToken(item.className));

  const potentialValueScore = getPotentialValueScore(item);
  const potentialStrategyWeight = getPotentialStrategyWeight(input.team, strategyProfile);
  const disciplineNeedScore = clamp(
    item.topDisciplineScores.filter((entry) => needs.topNeedDisciplineIds.includes(entry.disciplineId)).length / 2,
    0,
    1,
  );
  const axisMap = {
    pow: clamp((item.pow ?? 0) / 100, 0, 1),
    spe: clamp((item.spe ?? 0) / 100, 0, 1),
    men: clamp((item.men ?? 0) / 100, 0, 1),
    soc: clamp((item.soc ?? 0) / 100, 0, 1),
  };
  const axisNeedScore =
    weakestAxes.length > 0
      ? clamp(weakestAxes.reduce((sum, axis) => sum + axisMap[axis], 0) / weakestAxes.length, 0, 1)
      : clamp(Math.max(axisMap.pow, axisMap.spe, axisMap.men, axisMap.soc), 0, 1);
  const salary = preview.salary ?? item.salary ?? 0;
  const salaryValueScore = clamp(
    (axisNeedScore + disciplineNeedScore + Math.max(item.fit ?? 0, 0) / 16) / Math.max(1, salary + 5),
    0,
    1,
  );
  const rosterNeedBonus = rosterStatus === "under_min" ? 1 : rosterStatus === "under_opt" ? 0.6 : 0.15;
  const fitScore = clamp(((item.fit ?? 0) + 8) / 16, 0, 1);
  const mercenaryNegativeFitPenalty = getMercenaryNegativeFitPenalty({
    teamId: input.team.teamId,
    teamName: input.team.name,
    isMercenary: item.mercenary,
    teamFit: item.fit,
  });
  const identityAxisAlignment = clamp(
    ((strategyProfile?.powBias ?? 25) / 100) * axisMap.pow +
      ((strategyProfile?.speBias ?? 25) / 100) * axisMap.spe +
      ((strategyProfile?.menBias ?? 25) / 100) * axisMap.men +
      ((strategyProfile?.socBias ?? 25) / 100) * axisMap.soc,
    0,
    1,
  );
  const objectiveAxisScore = getObjectiveAxisScore(axisMap, input.objectiveBias);
  const salaryPenaltyBase =
    preview.salary != null && preview.cashBefore != null && preview.cashBefore > 0
      ? clamp(preview.salary / preview.cashBefore, 0, 1)
      : 0;
  const wagePenalty = salaryPenaltyBase * ((strategyProfile?.bias.wageSensitivity ?? 5) / 10);
  const riskPenalty = budgetStatus === "critical" ? 0.35 : budgetStatus === "tight" ? 0.18 : 0;
  const objectiveBuyBonus = input.objectiveBias
    ? input.objectiveBias.rosterUrgency * 0.08 + input.objectiveBias.buyAggression * 0.05 + Math.max(input.objectiveBias.pressure - 7, 0) * 0.015
    : 0;
  const objectiveFinancePenalty = input.objectiveBias
    ? input.objectiveBias.budgetConservatism * salaryPenaltyBase * 0.18
    : 0;
  const strategyBonus =
    preferredRaceHits * 0.08 +
    exactPreferredClassHits * 0.95 +
    preferredClassHits * 0.7 +
    preferredArchetypeHits * 0.45 +
    clamp((strategyProfile?.bias.valuePriority ?? 5) / 10, 0, 1) * salaryValueScore * 0.16 +
    clamp((strategyProfile?.bias.starPriority ?? 5) / 10, 0, 1) * disciplineNeedScore * 0.14;
  const strategyPenalty = avoidedRaceHits * 0.35 + avoidedClassHits * 0.18 + avoidedArchetypeHits * 0.12;
  const themeMismatchPenalty =
    explicitThemeCount > 0 && preferredThemeHits === 0
      ? clamp(((strategyProfile?.bias.harmonyStrictness ?? 5) / 10) * 0.34, 0.12, 0.38)
      : 0;
  const classRepeatPenalty =
    currentClassCount > 0
      ? clamp(currentClassCount * (isSpamSensitiveClass && preferredClassHits === 0 ? 0.11 : 0.07), 0.07, 0.28)
      : 0;
  const spamClassPenalty = isSpamSensitiveClass && preferredThemeHits === 0 ? 0.12 : 0;
  const rosterRaceContinuity = input.rosterRaceTokens.has(normalizeTransfermarktToken(item.race));
  const raceContinuityBonus = rosterRaceContinuity ? 0.22 : 0;
  const phase =
    rosterStatus === "under_min" ? "phase_a_minimum" : rosterStatus === "under_opt" ? "phase_b_core_optimum" : "phase_c_depth_luxury";
  const themeComposition = player
    ? calculateThemeCompositionScore({
        gameState: input.context.gameState,
        team: input.team,
        player,
        candidateQuality: Math.max(item.pow ?? 0, item.spe ?? 0, item.men ?? 0, item.soc ?? 0),
        candidateRoleFit: (item.fit ?? 0) + exactPreferredClassHits,
        phase,
        runtimeContext: input.themeRuntimeContext,
      })
    : null;
  const themeBoost = themeComposition ? clamp(themeComposition.themeCompositionScore / 100, -0.32, 0.42) : 0;

  const rawScore =
    0.18 +
    rosterNeedBonus * 0.18 +
    axisNeedScore * 0.18 +
    disciplineNeedScore * 0.1 +
    salaryValueScore * 0.12 +
    potentialValueScore * potentialStrategyWeight +
    fitScore * 0.1 +
    identityAxisAlignment * 0.3 +
    objectiveAxisScore * 0.16 +
    raceContinuityBonus +
    themeBoost +
    objectiveBuyBonus +
    strategyBonus -
    wagePenalty * 0.16 -
    objectiveFinancePenalty -
    riskPenalty -
    strategyPenalty -
    themeMismatchPenalty -
    missingPreferredClassPenalty -
    missingPreferredArchetypePenalty -
    classRepeatPenalty -
    spamClassPenalty -
    Math.abs(mercenaryNegativeFitPenalty) / 100;
  const score = roundValue(clamp(rawScore, 0, 1) * 100, 1);

  const strategyNotes: string[] = [];
  const fitNotes: string[] = [];
  const riskNotes: string[] = [];
  const blockingReasons = [...preview.blockingReasons];

  if (preferredRaceHits > 0) strategyNotes.push(`passt zur Wunsch-Rasse ${item.race}`);
  if (themeComposition && getTeamThemeCompositionTarget(input.team)) {
    strategyNotes.push(`Theme ${themeComposition.themeTier} (${roundValue(themeComposition.themeCompositionScore, 1)})`);
  }
  if (rosterRaceContinuity) strategyNotes.push(`haelt Rassenkern ${item.race} stabil`);
  if (preferredClassHits > 0) strategyNotes.push(`passt zur Wunsch-Klasse ${item.className}`);
  if (preferredArchetypeHits > 0) strategyNotes.push("passt zum hinterlegten Team-Stil");
  if (identityAxisAlignment >= 0.62) strategyNotes.push("passt zu den Teamachsen");
  if (objectiveAxisScore >= 0.55) strategyNotes.push("passt zum Board-Achsenziel");
  if ((potentialValueScore >= 0.5 || item.potentialBand === "elite" || item.potentialBand === "high") && potentialStrategyWeight >= 0.09) {
    strategyNotes.push(`Scouting sieht ${item.potentialBand}-Potential (${item.scoutingConfidence ?? 0}% Confidence)`);
  }
  if (potentialValueScore >= 0.5 && potentialStrategyWeight < 0.09) {
    fitNotes.push("Potential ist nett, Sofort-Impact bleibt wichtiger");
  }
  if (input.objectiveBias?.rosterUrgency != null && input.objectiveBias.rosterUrgency >= 0.7) {
    strategyNotes.push("Roster-Ziel erhoeht Kaufprioritaet");
  }
  if (input.objectiveBias?.pressure != null && input.objectiveBias.pressure >= 8) {
    strategyNotes.push("Boarddruck macht den Markt aggressiver");
  }
  if (avoidedRaceHits > 0) riskNotes.push(`Teamprofil meidet ${item.race}`);
  if (avoidedClassHits > 0) riskNotes.push(`Teamprofil meidet ${item.className}`);
  if (avoidedArchetypeHits > 0) riskNotes.push("Archetyp kollidiert mit dem Team-Stil");
  if (themeMismatchPenalty > 0) riskNotes.push("klare Themenvorgaben werden nicht getroffen");
  if (themeComposition?.themeTier === "outsider") riskNotes.push("Theme Composition: Außenseiter ohne klare Ausnahme");
  if (themeComposition?.themeTier === "avoid") riskNotes.push("Theme Composition: Avoid-Tag getroffen");
  if (missingPreferredClassPenalty > 0) riskNotes.push("passt zu keiner bevorzugten Klasse");
  if (missingPreferredArchetypePenalty > 0) riskNotes.push("passt zu keinem bevorzugten Archetyp");
  if (classRepeatPenalty > 0.1) riskNotes.push(`Klasse ${item.className} ist im Team schon stark vertreten`);
  if (spamClassPenalty > 0) riskNotes.push(`${item.className} wirkt fuer dieses Team zu generisch`);
  if (mercenaryNegativeFitPenalty < 0) {
    riskNotes.push(`${MERCENARY_NEGATIVE_FIT_PENALTY_REASON}: ${mercenaryNegativeFitPenalty}`);
  }
  if (disciplineNeedScore > 0) {
    fitNotes.push(
      `deckt Need-Diszis ${item.topDisciplineScores
        .filter((entry) => needs.topNeedDisciplineIds.includes(entry.disciplineId))
        .map((entry) => entry.disciplineName)
        .join(" / ")}`,
    );
  }
  if (weakestAxes.length > 0) {
    const strongAxes = weakestAxes.filter((axis) => axisMap[axis] >= 0.55).map((axis) => axis.toUpperCase());
    if (strongAxes.length > 0) {
      fitNotes.push(`staerkt ${strongAxes.join(" / ")}`);
    }
  }
  if (budgetStatus !== "healthy" && preview.cashAfter != null && preview.cashAfter < (preview.cashBefore ?? 0) * 0.2) {
    riskNotes.push("Cash nach Kauf wird sehr eng");
  }
  if (input.objectiveBias?.budgetConservatism != null && input.objectiveBias.budgetConservatism >= 0.65) {
    riskNotes.push("Finance-Ziel bremst riskante Ausgaben");
  }
  if (item.salary != null && item.teamCash != null && item.salary > item.teamCash * 0.2) {
    riskNotes.push("Gehalt frisst viel Rest-Cash");
  }
  if (!preview.canBuy) {
    if (blockingReasons.includes("insufficient_cash")) riskNotes.push("nicht bezahlbar");
    if (blockingReasons.includes("market_value_missing")) riskNotes.push("Marktwert fehlt");
    if (blockingReasons.includes("salary_demand_missing")) riskNotes.push("Gehalt fehlt");
  }
  if (item.mercenary) {
    strategyNotes.push("Mercenary-Fit bleibt flexibel");
  }

  const reasonParts = [
    rosterStatus === "under_min" ? "Kader unter Minimum" : rosterStatus === "under_opt" ? "Kader unter Optimum" : "Kader bereits breit",
    fitNotes[0],
    strategyNotes[0],
  ].filter(Boolean);

  const fitSummary =
    fitNotes.length > 0
      ? fitNotes.join(" · ")
      : item.fit != null
        ? `Team-Fit ${roundValue(item.fit, 1)}`
        : "kein klarer Fit-Vorteil";
  const sportsSummary = `POW ${Math.round(item.pow ?? 0)} / SPE ${Math.round(item.spe ?? 0)} / MEN ${Math.round(item.men ?? 0)} / SOC ${Math.round(item.soc ?? 0)}`;
  const budgetReason: string[] = [];
  if (budgetStatus === "critical") {
    budgetReason.push("Budget ist kritisch");
  } else if (budgetStatus === "tight") {
    budgetReason.push("Budget ist eng");
  } else if (budgetStatus === "healthy") {
    budgetReason.push("Budget ist gesund");
  }
  if (preview.cashBefore != null && preview.cashAfter != null) {
    budgetReason.push(`Cash ${roundValue(preview.cashBefore, 2)} -> ${roundValue(preview.cashAfter, 2)}`);
  }
  const warnings = Array.from(new Set([...riskNotes, ...preview.warnings]));

  return {
    score,
    preview,
    blockingReasons,
    reason: reasonParts.join(" · ") || "solider Allround-Fit",
    fitSummary,
    sportsSummary,
    budgetReason,
    warnings,
    fitNotes,
    riskNotes,
    strategyNotes,
    themeComposition,
  };
}

function getTeamStatus(entry: {
  controlMode: TeamControlMode;
  aiTransferPreviewEnabled: boolean;
  recommendedBuys: AiTransferPreviewRecommendation[];
  warnings: string[];
  teamScope: AiTransferPreviewTeamScope;
}) {
  if (!entry.aiTransferPreviewEnabled && entry.controlMode === "ai") {
    return "blocked" as const;
  }
  if (entry.teamScope === "all" && entry.controlMode !== "ai") {
    return "warning" as const;
  }
  if (entry.recommendedBuys.length === 0) {
    return entry.warnings.length > 0 ? ("warning" as const) : ("blocked" as const);
  }
  return entry.warnings.length > 0 ? ("warning" as const) : ("ready" as const);
}

function toPreviewRecommendation(entry: {
  item: TransfermarktFreeAgentItem;
  scored: ReturnType<typeof scoreCandidate>;
  strategyProfile: TeamStrategyProfile | null;
}): AiTransferPreviewRecommendation {
  return {
    playerId: entry.item.playerId,
    playerName: entry.item.name,
    name: entry.item.name,
    className: entry.item.className,
    race: entry.item.race,
    ovr: entry.item.ovr ?? null,
    mvs: entry.item.mvs ?? null,
    marketValue: entry.scored.preview.purchasePrice,
    price: entry.scored.preview.purchasePrice,
    salary: entry.scored.preview.salary,
    contractLength: null,
    contractShape: entry.scored.preview.contractShape ?? null,
    cashAfter: entry.scored.preview.cashAfter,
    rosterAfter: entry.scored.preview.rosterAfter,
    salaryAfter: entry.scored.preview.salaryAfter,
    teamFit: entry.item.fit ?? null,
    needMatchLabel: entry.item.needMatchLabel ?? null,
    fitSummary: entry.scored.fitSummary,
    sportsSummary: entry.scored.sportsSummary,
    budgetReason: entry.scored.budgetReason,
    warnings: entry.scored.warnings,
    overallRecommendationScore: entry.scored.score,
    score: entry.scored.score,
    themeCompositionScore: entry.scored.themeComposition?.themeCompositionScore,
    themeTier: entry.scored.themeComposition?.themeTier,
    themeTags: entry.scored.themeComposition?.playerThemeTags,
    reason: entry.scored.reason,
    fitNotes: entry.scored.fitNotes,
    riskNotes: entry.scored.riskNotes,
    strategyNotes:
      entry.scored.strategyNotes.length > 0
        ? entry.scored.strategyNotes
        : [entry.strategyProfile?.strategySummary ?? "kein Sonderprofil"],
  };
}

export async function buildAiTransfermarktPreview(params: AiTransferPreviewParams = {}): Promise<AiTransferPreviewResult> {
  const startedAt = Date.now();
  const context = await resolvePreviewContext(params);
  const contextResolvedAt = Date.now();
  const teamScope = params.teamScope === "all" ? "all" : "ai";
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit) ? Math.max(10, Math.round(params.limit)) : 90;
  const candidateScopeMode: AiPreviewCandidateScopeMode =
    params.candidateScopeMode === "budget_wide" ? "budget_wide" : "strategic";
  const globallyExcludedPlayerIds = new Set((params.excludedPlayerIds ?? []).filter(Boolean));
  const currentMatchdayRosterRequirement = getCurrentMatchdayRosterRequirement(context.gameState);

  const requestedTeam =
    params.teamId != null
      ? context.gameState.teams.find((team) => team.teamId === params.teamId) ?? null
      : null;

  if (params.teamId && !requestedTeam) {
    throw new Error(`Team ${params.teamId} could not be found.`);
  }

  const candidateTeams = (requestedTeam ? [requestedTeam] : context.gameState.teams).filter((team) => {
    if (requestedTeam) return true;
    if (teamScope === "all") return true;
    const control = getTeamControlSettings(context.gameState, team.teamId);
    return control?.controlMode === "ai";
  });

  const baseFeedStartedAt = Date.now();
  const baseFreeAgentFeed =
    context.source === "sqlite"
      ? listLocalTransfermarktFreeAgents({
          saveId: context.saveId,
          seasonId: context.seasonId,
          limit: Math.max(context.gameState.players.length, 5000),
          mode: "ai_preview",
          localRunContext: context.localRunContext,
        })
      : null;
  const baseFreeAgents = [...(baseFreeAgentFeed?.items ?? [])].sort((left, right) => {
    const leftValue = left.marketValue ?? Number.POSITIVE_INFINITY;
    const rightValue = right.marketValue ?? Number.POSITIVE_INFINITY;
    if (leftValue !== rightValue) return leftValue - rightValue;
    return getValueRatio(right) - getValueRatio(left);
  });
  const baseFeedFinishedAt = Date.now();
  const rosterByTeamId = buildRosterByTeamId(context.gameState);
  const playerById = new Map(context.gameState.players.map((player) => [player.id, player] as const));
  const recentlySoldByTeamPlayer = buildRecentlySoldByTeamPlayerMap(context.gameState);
  const fullScoringLimit =
    typeof params.fullScoringLimit === "number" && Number.isFinite(params.fullScoringLimit)
      ? Math.max(24, Math.round(params.fullScoringLimit))
      : null;
  const debugPerformance = {
    candidateScans: 0,
    hardFilterCount: 0,
    roughScoreCount: 0,
    candidateEnrichments: 0,
    fullBuyPreviewCount: 0,
    negotiationPreviewCount: 0,
    teamScopeMs: 0,
    teamPrepMs: 0,
    controlStrategyMs: 0,
    objectiveBiasMs: 0,
    needsMs: 0,
    rosterPrepMs: 0,
    themeRuntimeMs: 0,
    roughShortlistMs: 0,
    fullScoreMs: 0,
    recommendationMs: 0,
  };

  const teams = await Promise.all(
    candidateTeams.map(async (team) => {
      const teamPrepStartedAt = Date.now();
      const controlStrategyStartedAt = Date.now();
      const control = getTeamControlSettings(context.gameState, team.teamId);
      const strategyProfile = getTeamStrategyProfile(context.gameState, team.teamId);
      debugPerformance.controlStrategyMs += Date.now() - controlStrategyStartedAt;
      const objectiveBiasStartedAt = Date.now();
      const objectiveBias = getTeamObjectiveAiBias(context.gameState, team.teamId);
      debugPerformance.objectiveBiasMs += Date.now() - objectiveBiasStartedAt;
      const needsStartedAt = Date.now();
      const needs = evaluateAiNeeds(context.gameState, team.teamId);
      debugPerformance.needsMs += Date.now() - needsStartedAt;
      const rosterPrepStartedAt = Date.now();
      const identity = context.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      const teamRosterEntries = rosterByTeamId.get(team.teamId) ?? [];
      const rosterEconomy = getRosterEconomyContext(context.gameState, team.teamId, playerById, teamRosterEntries);
      const directPlayerMin = Math.max(
        capRosterTarget(identity?.playerMin ?? null, team.rosterLimit),
        capRosterTarget(currentMatchdayRosterRequirement ?? null, team.rosterLimit),
      );
      const directPlayerOpt = Math.max(
        capRosterTarget(identity?.playerOpt ?? null, team.rosterLimit),
        directPlayerMin,
      );
      const directRosterStatus = getRosterStatus({
        rosterCount: rosterEconomy.rosterCount,
        playerMin: directPlayerMin > 0 ? directPlayerMin : null,
        playerOpt: directPlayerOpt > 0 ? directPlayerOpt : null,
      });
      const forceBuyScanTeamIds = new Set(params.forceBuyScanTeamIds ?? []);
      const shouldDeepScanBuyCandidates =
        requestedTeam != null ||
        (teamScope === "all" && control?.controlMode !== "ai" && !params.buyNeedOnly) ||
        (control?.controlMode === "ai" && directRosterStatus !== "at_or_above_opt") ||
        (control?.controlMode === "ai" && (objectiveBias?.rosterUrgency ?? 0) >= 0.7) ||
        (control?.controlMode === "ai" && (objectiveBias?.pressure ?? 0) >= 8) ||
        forceBuyScanTeamIds.has(team.teamId);
      const rosterPlayers = teamRosterEntries
        .map((entry) => playerById.get(entry.playerId) ?? null)
        .filter((entry): entry is Player => Boolean(entry));
      const rosterRaceTokens = new Set(
        rosterPlayers.map((player) => normalizeTransfermarktToken(player.race)).filter(Boolean),
      );
      const rosterClassCounts = buildRosterClassCounts(teamRosterEntries, playerById);
      debugPerformance.rosterPrepMs += Date.now() - rosterPrepStartedAt;
      const themeRuntimeStartedAt = Date.now();
      const themeRuntimeContext = buildTeamThemeCompositionRuntimeContext(context.gameState, team);
      debugPerformance.themeRuntimeMs += Date.now() - themeRuntimeStartedAt;
      const effectivePlayerMin = Math.max(
        capRosterTarget(identity?.playerMin ?? null, team.rosterLimit),
        capRosterTarget(currentMatchdayRosterRequirement ?? null, team.rosterLimit),
      );
      const effectivePlayerOpt = Math.max(
        capRosterTarget(identity?.playerOpt ?? null, team.rosterLimit),
        effectivePlayerMin,
      );
      const rosterStatus = getRosterStatus({
        rosterCount: rosterEconomy.rosterCount,
        playerMin: effectivePlayerMin > 0 ? effectivePlayerMin : null,
        playerOpt: effectivePlayerOpt > 0 ? effectivePlayerOpt : null,
      });
      const effectiveMarketCash = resolveMarketSpendableCashForPlanner({
        gameState: context.gameState,
        teamId: team.teamId,
        teamCash: team.cash,
        rosterBelowMin: rosterStatus === "under_min" || directRosterStatus === "under_min",
        forceRosterFill: forceBuyScanTeamIds.has(team.teamId),
      });
      const budgetTeam = { ...team, cash: effectiveMarketCash ?? team.cash };
      const budgetStatus = getBudgetStatus(budgetTeam);
      const weakestAxes = needs.uncoveredNeedAxes.slice(0, 2);
      const warnings: string[] = [];

      if (teamScope === "all" && control?.controlMode === "manual") {
        warnings.push("manuell gesteuertes Team – Vorschlag nur informativ");
      }
      if (teamScope === "all" && control?.controlMode === "passive") {
        warnings.push("passives Team – Vorschlag nur informativ");
      }
      if (control?.controlMode === "ai" && !control.aiTransferPreviewEnabled) {
        warnings.push("AI-Transfer-Preview ist fuer dieses Team deaktiviert");
      }
      warnings.push(...(objectiveBias?.warnings ?? []));
      debugPerformance.teamPrepMs += Date.now() - teamPrepStartedAt;
      const stage0SkippedTargets: AiTransferPreviewSkippedTarget[] = [];
      const teamScopeStartedAt = Date.now();
      const scopedFreeAgents =
        !shouldDeepScanBuyCandidates
          ? []
          : context.source !== "sqlite"
            ? (await loadFreeAgentsForTeam(context, team.teamId, limit)).items.filter((item) => !globallyExcludedPlayerIds.has(item.playerId))
            : (() => {
                const spendableCash = budgetTeam.cash ?? 0;
                if (teamRosterEntries.length >= team.rosterLimit || spendableCash <= 0) {
                  return [];
                }
                const recentlySoldPlayerIds = recentlySoldByTeamPlayer.get(team.teamId) ?? new Set<string>();
                const onScan = () => {
                  debugPerformance.candidateScans += 1;
                };
                if (candidateScopeMode === "budget_wide") {
                  const budgetScope = buildBudgetWideAffordableScope({
                    baseFreeAgents,
                    marketValueSortedAsc: true,
                    spendableCash,
                    globallyExcludedPlayerIds,
                    recentlySoldPlayerIds,
                    onScan,
                  });
                  stage0SkippedTargets.push(...budgetScope.stage0SkippedTargets);
                  return budgetScope.candidates;
                }
                const strategicScope = buildStrategicAiPreviewScope({
                  baseFreeAgents,
                  marketValueSortedAsc: true,
                  spendableCash,
                  teamId: team.teamId,
                  rosterPlayers,
                  playerById,
                  limit,
                  fullScoringLimit,
                  weakestAxes,
                  needs,
                  strategyProfile,
                  objectiveBias,
                  rosterStatus,
                  globallyExcludedPlayerIds,
                  recentlySoldPlayerIds,
                  onScan,
                });
                stage0SkippedTargets.push(...strategicScope.stage0SkippedTargets);
                return strategicScope.candidates;
              })();
      debugPerformance.teamScopeMs += Date.now() - teamScopeStartedAt;
      debugPerformance.hardFilterCount += scopedFreeAgents.length;
      if (!scopedFreeAgents.length) {
        if (shouldDeepScanBuyCandidates) {
          warnings.push("keine Free Agents im aktuellen Scope gefunden");
        }
      }
      if (
        currentMatchdayRosterRequirement != null &&
        rosterEconomy.rosterCount < Math.min(currentMatchdayRosterRequirement, team.rosterLimit)
      ) {
        warnings.push(`aktueller Spieltag braucht ${Math.min(currentMatchdayRosterRequirement, team.rosterLimit)} aktive Slots`);
      }

      const roughShortlistLimit = resolveRoughShortlistLimit({
        candidateScopeMode,
        scopedCount: scopedFreeAgents.length,
        limit,
        fullScoringLimit,
        rosterStatus,
      });
      const roughShortlistStartedAt = Date.now();
      const roughShortlist =
        context.source === "sqlite"
          ? (() => {
              const roughRanked = scopedFreeAgents
                .map((item) => ({
                  item,
                  roughScore: buildCheapCandidateScore({
                    item,
                    teamId: team.teamId,
                    weakestAxes,
                    needs,
                    strategyProfile,
                    objectiveBias,
                  }),
                }))
                .sort((left, right) => right.roughScore - left.roughScore);
              const selected = new Map<string, (typeof roughRanked)[number]["item"]>();
              for (const entry of roughRanked.slice(0, roughShortlistLimit)) {
                selected.set(entry.item.playerId, entry.item);
              }

              if (candidateScopeMode === "budget_wide") {
                let cheapFillAdded = 0;
                for (const item of scopedFreeAgents) {
                  if (cheapFillAdded >= 240) break;
                  if (!isAiCheapFillCandidate(item)) continue;
                  selected.set(item.playerId, item);
                  cheapFillAdded += 1;
                }
              }

              const addShortlistCoverage = (items: TransfermarktFreeAgentItem[], maxCount: number) => {
                for (const item of items.slice(0, Math.max(0, maxCount))) {
                  selected.set(item.playerId, item);
                }
              };

              // Performance gate: avoid enriching the full market, but never take the first N rows blindly.
              // Coverage is drawn from price, ratio, need axes and discipline needs so every pick lane can still surface.
              const cheapCoverageLimit = Math.min(
                scopedFreeAgents.length,
                candidateScopeMode === "budget_wide"
                  ? Math.max(160, Math.ceil(roughShortlistLimit * 0.45))
                  : rosterStatus === "under_min"
                    ? Math.max(32, Math.ceil(roughShortlistLimit * 1.25))
                    : Math.max(24, Math.ceil(roughShortlistLimit * 1.1)),
              );
              const coverageChunk =
                candidateScopeMode === "budget_wide"
                  ? Math.max(24, Math.ceil(cheapCoverageLimit / 6))
                  : Math.max(5, Math.ceil(cheapCoverageLimit / 4));
              addShortlistCoverage(
                [...scopedFreeAgents].sort((left, right) => {
                  const priceDelta =
                    (left.marketValue ?? Number.POSITIVE_INFINITY) -
                    (right.marketValue ?? Number.POSITIVE_INFINITY);
                  if (priceDelta !== 0) return priceDelta;
                  return getValueRatio(right) - getValueRatio(left);
                }),
                coverageChunk,
              );
              addShortlistCoverage(
                [...scopedFreeAgents].sort((left, right) => {
                  const ratioDelta = getValueRatio(right) - getValueRatio(left);
                  if (Math.abs(ratioDelta) > 0.01) return ratioDelta;
                  return (left.marketValue ?? Number.POSITIVE_INFINITY) - (right.marketValue ?? Number.POSITIVE_INFINITY);
                }),
                coverageChunk,
              );
              const laneAxes = getStrategicLaneAxes({ weakestAxes, objectiveBias });
              addShortlistCoverage(
                [...scopedFreeAgents]
                  .filter((item) => laneAxes.some((axis) => getAxisValue(item, axis) >= 40 || getClassAxis(item) === axis))
                  .sort((left, right) => {
                    const leftAxis = Math.max(...laneAxes.map((axis) => getAxisValue(left, axis)));
                    const rightAxis = Math.max(...laneAxes.map((axis) => getAxisValue(right, axis)));
                    if (rightAxis !== leftAxis) return rightAxis - leftAxis;
                    return getValueRatio(right) - getValueRatio(left);
                  }),
                coverageChunk,
              );
              addShortlistCoverage(
                [...scopedFreeAgents]
                  .filter((item) =>
                    item.topDisciplineScores.some((entry) => needs.topNeedDisciplineIds.includes(entry.disciplineId)),
                  )
                  .sort((left, right) => {
                    const leftHits = left.topDisciplineScores.filter((entry) => needs.topNeedDisciplineIds.includes(entry.disciplineId)).length;
                    const rightHits = right.topDisciplineScores.filter((entry) => needs.topNeedDisciplineIds.includes(entry.disciplineId)).length;
                    if (rightHits !== leftHits) return rightHits - leftHits;
                    return getValueRatio(right) - getValueRatio(left);
                  }),
                coverageChunk,
              );

              return [...selected.values()].map((item) =>
                enrichCandidateForTeam({
                  context,
                  team: budgetTeam,
                  item,
                  rosterPlayers,
                  playerById,
                  teamSalary: rosterEconomy.salaryTotal,
                  playerMin: effectivePlayerMin > 0 ? effectivePlayerMin : null,
                  playerOpt: effectivePlayerOpt > 0 ? effectivePlayerOpt : null,
                }),
              );
            })()
          : scopedFreeAgents;
      debugPerformance.roughShortlistMs += Date.now() - roughShortlistStartedAt;
      debugPerformance.roughScoreCount += scopedFreeAgents.length;
      debugPerformance.candidateEnrichments += roughShortlist.length;

      const fullScoreStartedAt = Date.now();
      const scored = roughShortlist
        .map((item) => ({
          item,
          scored: scoreCandidate({
            item,
            budgetStatus,
            rosterStatus,
            weakestAxes,
            needs,
            team: budgetTeam,
            context,
            rosterClassCounts,
            strategyProfile,
            playerById,
            rosterRaceTokens,
            themeRuntimeContext,
            objectiveBias,
          }),
        }))
        .sort((left, right) => right.scored.score - left.scored.score);
      debugPerformance.fullScoreMs += Date.now() - fullScoreStartedAt;
      debugPerformance.fullBuyPreviewCount += scored.length;

      const recommendationStartedAt = Date.now();
      const affordableCandidates = buildDiverseCandidateSlice(
        scored.filter((entry) => entry.scored.preview.canBuy && entry.scored.score > 0),
        24,
        2,
        5,
      );
      const rankedAffordableCandidates = [...affordableCandidates].sort((left, right) => {
        const leftBoost = getStrategyPriorityBoost(left.item, strategyProfile);
        const rightBoost = getStrategyPriorityBoost(right.item, strategyProfile);
        return right.scored.score + rightBoost + getPreviewSignalBoost(right.scored) - (left.scored.score + leftBoost + getPreviewSignalBoost(left.scored));
      });
      const legalCandidatePool = scored
        .filter((entry) => entry.scored.preview.canBuy)
        .map((entry) =>
          toPreviewRecommendation({
            item: entry.item,
            scored: entry.scored,
            strategyProfile,
          }),
        )
        .sort((left, right) => {
          const leftPrice = left.price ?? left.marketValue ?? Number.POSITIVE_INFINITY;
          const rightPrice = right.price ?? right.marketValue ?? Number.POSITIVE_INFINITY;
          if (leftPrice !== rightPrice) {
            return leftPrice - rightPrice;
          }
          return (right.score ?? 0) - (left.score ?? 0);
        });

      const recommendedBuysRaw = rankedAffordableCandidates
        .slice(0, 3)
        .map<AiTransferPreviewRecommendation>((entry) =>
          toPreviewRecommendation({
            item: entry.item,
            scored: entry.scored,
            strategyProfile,
          }),
        );
      const doctrine = loadDoctrineContext(context.gameState, team.teamId);
      const replacementSlots = resolveTeamReplacementSlots({
        gameState: context.gameState,
        teamId: team.teamId,
      });
      const recommendedBuys = annotateBuyRecommendations({
        gameState: context.gameState,
        teamId: team.teamId,
        recommendations: recommendedBuysRaw,
        doctrine,
        replacementSlots,
        rosterAfterSell: rosterEconomy.rosterCount,
        playerMin: effectivePlayerMin > 0 ? effectivePlayerMin : null,
        playerOpt: effectivePlayerOpt > 0 ? effectivePlayerOpt : null,
        teamCash: team.cash ?? null,
        cashAfterSell: team.cash ?? null,
        plannedSellCount: 0,
        rosterPlayerIds: context.gameState.rosters
          .filter((entry) => entry.teamId === team.teamId)
          .map((entry) => entry.playerId),
        coversNeedAxis: (candidate) => Boolean(candidate.needMatchLabel),
      });

      const skippedTargets = [
        ...stage0SkippedTargets,
        ...scored
          .filter((entry) => !entry.scored.preview.canBuy || entry.scored.score <= 0)
          .slice(0, Math.max(0, 5 - stage0SkippedTargets.length))
          .map<AiTransferPreviewSkippedTarget>((entry) => ({
            playerId: entry.item.playerId,
            name: entry.item.name,
            reason:
              !entry.scored.preview.canBuy
                ? entry.scored.blockingReasons[0] ?? "preview_blocked"
                : entry.scored.riskNotes[0] ?? "fit_too_weak",
            blockingReasons: entry.scored.blockingReasons,
          })),
      ];

      const needSummary = buildNeedSummary({
        weakestAxes,
        rosterStatus,
        budgetStatus,
      });

      const explanation = [
        strategyProfile?.strategySummary,
        recommendedBuys[0] ? `Top-Pick: ${recommendedBuys[0].name} (${recommendedBuys[0].reason}).` : "Kein sauberer Kaufvorschlag im aktuellen Markt.",
      ]
        .filter(Boolean)
        .join(" ");

      const status = getTeamStatus({
        controlMode: control?.controlMode ?? "manual",
        aiTransferPreviewEnabled: control?.aiTransferPreviewEnabled ?? false,
        recommendedBuys,
        warnings,
        teamScope,
      });
      debugPerformance.recommendationMs += Date.now() - recommendationStartedAt;

      return {
        teamId: team.teamId,
        teamCode: team.shortCode,
        teamName: team.name,
        controlMode: control?.controlMode ?? "manual",
        aiTransferPreviewEnabled: control?.aiTransferPreviewEnabled ?? false,
        status,
        cash: team.cash ?? null,
        salary: rosterEconomy.salaryTotal,
        salaryTotal: rosterEconomy.salaryTotal,
        rosterSize: rosterEconomy.rosterCount,
        rosterCount: rosterEconomy.rosterCount,
        targetRosterMin: effectivePlayerMin > 0 ? effectivePlayerMin : null,
        targetRosterOpt: effectivePlayerOpt > 0 ? effectivePlayerOpt : null,
        marketValueTotal: rosterEconomy.marketValueTotal,
        needSummary,
        budgetStatus,
        rosterStatus,
        legalCandidatePool,
        topTargets: rankedAffordableCandidates.map<AiTransferPreviewRecommendation>((entry) =>
          toPreviewRecommendation({
            item: entry.item,
            scored: entry.scored,
            strategyProfile,
          }),
        ),
        recommendedBuys,
        skippedTargets,
        warnings,
        explanation,
      } satisfies AiTransferPreviewTeamEntry;
    }),
  );

  const sortedTeams = [...teams].sort((left, right) => {
    const leftScore = left.recommendedBuys[0]?.score ?? -1;
    const rightScore = right.recommendedBuys[0]?.score ?? -1;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return left.teamName.localeCompare(right.teamName, "de");
  });

  return {
    readOnly: true,
    source: context.source,
    scope: {
      saveId: context.saveId,
      seasonId: context.seasonId,
      teamId: requestedTeam?.teamId ?? null,
      teamScope,
    },
    totalTeams: sortedTeams.length,
    aiTeams: sortedTeams.filter((team) => team.controlMode === "ai").length,
    skippedManual: requestedTeam
      ? 0
      : teamScope === "all"
        ? context.gameState.teams.filter((team) => getTeamControlSettings(context.gameState, team.teamId)?.controlMode === "manual").length
        : 0,
    skippedPassive: requestedTeam
      ? 0
      : teamScope === "all"
        ? context.gameState.teams.filter((team) => getTeamControlSettings(context.gameState, team.teamId)?.controlMode === "passive").length
        : 0,
    skippedDisabled: requestedTeam
      ? 0
      : context.gameState.teams.filter((team) => {
          const settings = getTeamControlSettings(context.gameState, team.teamId);
          return settings?.controlMode === "ai" && !settings.aiTransferPreviewEnabled;
        }).length,
    readyTeams: sortedTeams.filter((team) => team.status === "ready").length,
    warningTeams: sortedTeams.filter((team) => team.status === "warning").length,
    blockedTeams: sortedTeams.filter((team) => team.status === "blocked").length,
    teams: sortedTeams,
    debugPerformance: {
      durationMs: Date.now() - startedAt,
      contextMs: contextResolvedAt - startedAt,
      baseFeedMs: baseFeedFinishedAt - baseFeedStartedAt,
      teamCount: candidateTeams.length,
      ...debugPerformance,
    },
  };
}
