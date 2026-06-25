import type {
  GameState,
  Player,
  PlayerMoraleContractIntent,
  PlayerMoraleReason,
  PlayerMoraleState,
  PlayerMoraleVisibleMood,
  PlayerDemandRecord,
  RosterEntry,
  Team,
  TeamIdentity,
} from "@/lib/data/olyDataTypes";
import { buildPlayerSeasonPerformance } from "@/lib/foundation/player-season-performance";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { calculateTransfermarktFit } from "@/lib/market/transfermarkt-fit";
import { buildPlayerDemands, selectTeamCaptain } from "@/lib/morale/player-demands-service";
import { buildTrainingModeDemandRecord, evaluateTrainingModeDemandDelta } from "@/lib/training/training-mode-demand-service";

export type PlayerMoraleAssessment = PlayerMoraleState & {
  smiley: string;
  moodLabel: string;
  moraleSalaryModifier: number;
  moraleContractLengthLimit: number | null;
  moraleRenewalRisk: number;
  suggestedActions: string[];
  warnings: string[];
  source: "stored" | "computed_preview";
};

export type PlayerMoraleInput = {
  gameState: GameState;
  playerId: string;
  teamId?: string | null;
  renewalSalaryPreview?: number | null;
};

const POSITIVE_TRAINING_TRAITS = new Set(["diligent", "disciplined", "motivated", "ambitious", "flexible", "healthy", "resourceful"]);
const NEGATIVE_VOLATILE_TRAITS = new Set(["lazy", "diva", "fainthearted", "paranoid", "obsessive", "egomaniac", "gambler", "mercenary", "renegade"]);
const CORE_AXES = ["pow", "spe", "men", "soc"] as const;

type CoreAxis = (typeof CORE_AXES)[number];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundValue(value: number, digits = 0) {
  return Number(value.toFixed(digits));
}

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getTraits(player: Player) {
  return [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])].map(normalizeToken).filter(Boolean);
}

function hasTrait(player: Player, trait: string) {
  const normalized = normalizeToken(trait);
  return getTraits(player).includes(normalized);
}

function addReason(reasons: PlayerMoraleReason[], reasonId: string, label: string, valueDelta: number, source: string) {
  if (valueDelta === 0) return;
  reasons.push({
    reasonId,
    label,
    valueDelta: roundValue(valueDelta, 1),
    source,
  });
}

function getVisibleMood(morale: number): PlayerMoraleVisibleMood {
  if (morale >= 80) return "excellent";
  if (morale >= 60) return "happy";
  if (morale >= 40) return "neutral";
  if (morale >= 20) return "unhappy";
  return "angry";
}

function getSmiley(mood: PlayerMoraleVisibleMood) {
  switch (mood) {
    case "excellent":
      return "😄";
    case "happy":
      return "🙂";
    case "neutral":
      return "😐";
    case "unhappy":
      return "🙁";
    case "angry":
      return "😡";
    default:
      return "😐";
  }
}

function getMoodLabel(mood: PlayerMoraleVisibleMood) {
  switch (mood) {
    case "excellent":
      return "sehr zufrieden";
    case "happy":
      return "zufrieden";
    case "neutral":
      return "neutral";
    case "unhappy":
      return "unzufrieden";
    case "angry":
      return "verärgert";
    default:
      return "neutral";
  }
}

function getContractIntent(morale: number, player: Player): PlayerMoraleContractIntent {
  if (morale < 22 && !hasTrait(player, "loyal")) return "refuses_extension";
  if (morale < 34) return "considering_exit";
  if (morale < 48) return hasTrait(player, "mercenary") ? "demands_raise" : "short_term_only";
  if (morale < 60 && hasTrait(player, "mercenary")) return "demands_raise";
  return "willing_to_extend";
}

function getRoleExpectedAppearances(roleTag: string | null | undefined) {
  const role = (roleTag ?? "").toLowerCase();
  if (role.includes("starter") || role.includes("star") || role.includes("core")) return 7;
  if (role.includes("rotation")) return 4;
  if (role.includes("bench") || role.includes("depth")) return 3;
  if (role.includes("prospect")) return 2;
  return 4;
}

function getMoraleSalaryModifier(input: {
  morale: number;
  player: Player;
  currentSalary: number | null;
  renewalSalaryPreview: number | null;
}) {
  let modifier = 1;
  if (input.morale >= 84) modifier -= 0.08;
  else if (input.morale >= 68) modifier -= 0.04;
  else if (input.morale >= 60) modifier -= 0.02;
  else if (input.morale < 25) modifier += 0.28;
  else if (input.morale < 40) modifier += 0.16;
  else if (input.morale < 48) modifier += 0.07;

  const currentSalary = input.currentSalary ?? 0;
  const expected = input.renewalSalaryPreview ?? 0;
  const underpaid = currentSalary > 0 && expected > currentSalary * 1.25;
  if (underpaid) {
    modifier += hasTrait(input.player, "mercenary") ? 0.12 : 0.06;
  }
  if (hasTrait(input.player, "loyal") && input.morale >= 45) {
    modifier -= 0.03;
  }
  if (hasTrait(input.player, "mercenary") && input.morale < 60) {
    modifier += 0.06;
  }

  return roundValue(clamp(modifier, 0.78, 1.28), 3);
}

function getContractLengthLimit(morale: number, player: Player) {
  if (morale < 25 && !hasTrait(player, "loyal")) return 1;
  if (morale < 42) return 2;
  return null;
}

function getSuggestedActions(input: { morale: number; intent: PlayerMoraleContractIntent; player: Player }) {
  const actions: string[] = [];
  if (input.intent === "refuses_extension" || input.intent === "considering_exit") {
    actions.push("Verkauf prüfen");
    actions.push("1-Jahres-Bridge-Deal anbieten");
  }
  if (input.morale < 55 || input.intent === "demands_raise") {
    actions.push("Gehaltserhöhung anbieten");
    actions.push("Rolle/Einsatzzeit versprechen");
  }
  if (hasTrait(input.player, "lazy") && input.morale < 60) {
    actions.push("Training reduzieren");
  }
  if (hasTrait(input.player, "mercenary") && input.morale < 70) {
    actions.push("Einmalbonus prüfen");
  }
  if (actions.length === 0) {
    actions.push("Aktuelle Rolle stabil halten");
  }
  return Array.from(new Set(actions));
}

function getTeamRank(gameState: GameState, teamId: string) {
  const standing = gameState.seasonState.standings?.[teamId] ?? null;
  return standing?.rank ?? null;
}

function getLatestSnapshotContext(gameState: GameState, teamId: string, playerId: string) {
  const snapshots = [...((gameState.seasonState as { seasonSnapshots?: Array<Record<string, unknown>> }).seasonSnapshots ?? [])];
  for (const snapshot of snapshots.reverse()) {
    const finalStandings = (snapshot.finalStandings ?? []) as Array<{ teamId?: string; rank?: number | null }>;
    const playerRows = [
      ...(((snapshot.playerPerformances ?? []) as Array<Record<string, unknown>>) ?? []),
      ...(((snapshot.playerPerformanceSnapshots ?? []) as Array<Record<string, unknown>>) ?? []),
    ];
    const teamRow = finalStandings.find((entry) => entry.teamId === teamId) ?? null;
    const playerRow = playerRows.find((entry) => entry.playerId === playerId) ?? null;
    if (teamRow || playerRow) {
      return {
        seasonId: String(snapshot.seasonId ?? ""),
        teamRank: typeof teamRow?.rank === "number" ? teamRow.rank : null,
        ppsRank: typeof playerRow?.ppsRank === "number" ? playerRow.ppsRank : null,
        ovrRank: typeof playerRow?.ovrRank === "number" ? playerRow.ovrRank : null,
        mvsRank: typeof playerRow?.mvsRank === "number" ? playerRow.mvsRank : null,
      };
    }
  }
  return null;
}

function hasCurrentSeasonResults(gameState: GameState) {
  const seasonId = gameState.season.id;
  const hasMatchdayResult = (gameState.seasonState.matchdayResults ?? []).some((entry) => entry.seasonId === seasonId);
  const resultIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((entry) => entry.seasonId === seasonId)
      .map((entry) => entry.id),
  );
  const hasPlayerResult = (gameState.seasonState.playerDisciplinePerformances ?? []).some((entry) =>
    resultIds.has(entry.matchdayResultId),
  );
  return hasMatchdayResult || hasPlayerResult;
}

function getCurrentSeasonMatchdayResultIds(gameState: GameState) {
  const seasonId = gameState.season.id;
  return new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((entry) => entry.seasonId === seasonId)
      .map((entry) => entry.id),
  );
}

function getResolvedTargetMatchdayResultIds(gameState: GameState, disciplineId: string) {
  const resultIds = getCurrentSeasonMatchdayResultIds(gameState);
  const targetResultIds = new Set<string>();
  for (const result of gameState.seasonState.disciplineResults ?? []) {
    if (result.disciplineId === disciplineId && resultIds.has(result.matchdayResultId)) {
      targetResultIds.add(result.matchdayResultId);
    }
  }
  return targetResultIds;
}

function hasPlayerDisciplineAppearance(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
  disciplineId: string;
}) {
  const resultIds = getResolvedTargetMatchdayResultIds(input.gameState, input.disciplineId);
  if (resultIds.size === 0) return false;
  return (input.gameState.seasonState.playerDisciplinePerformances ?? []).some(
    (entry) =>
      resultIds.has(entry.matchdayResultId) &&
      entry.teamId === input.teamId &&
      entry.disciplineId === input.disciplineId &&
      (entry.playerId === input.playerId || entry.activePlayerId === input.playerId),
  );
}

function hasPlayerCaptainDraft(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
  disciplineId: string;
}) {
  const seasonId = input.gameState.season.id;
  return (input.gameState.seasonState.lineupDrafts ?? []).some(
    (draft) =>
      draft.seasonId === seasonId &&
      draft.teamId === input.teamId &&
      draft.entries.some(
        (entry) =>
          entry.disciplineId === input.disciplineId &&
          entry.isCaptain &&
          (entry.playerId === input.playerId || entry.activePlayerId === input.playerId),
      ),
  );
}

function getDemandPriorityMultiplier(demand: PlayerDemandRecord) {
  if (demand.priority === "high") return 1.15;
  if (demand.priority === "low") return 0.7;
  return 1;
}

function getNumericTargetValue(value: PlayerDemandRecord["targetValue"]) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function evaluateDemandDelta(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
  demand: PlayerDemandRecord;
  seasonAppearances: number;
  currentSeasonHasResults: boolean;
}) {
  const { gameState, teamId, playerId, demand } = input;
  const priorityMultiplier = getDemandPriorityMultiplier(demand);
  const reward = Math.max(0, demand.moraleReward) * priorityMultiplier;
  const penalty = Math.min(0, demand.moralePenalty) * priorityMultiplier;
  const targetDisciplineId = demand.targetDisciplineId ?? null;

  if (demand.type === "discipline_start" && targetDisciplineId) {
    const targetResolved = getResolvedTargetMatchdayResultIds(gameState, targetDisciplineId).size > 0;
    const appeared = hasPlayerDisciplineAppearance({ gameState, teamId, playerId, disciplineId: targetDisciplineId });
    if (appeared) return { delta: reward, outcome: "fulfilled" as const };
    if (targetResolved) return { delta: penalty, outcome: "failed" as const };
    if (demand.status === "at_risk") return { delta: penalty * 0.25, outcome: "pressure" as const };
    return { delta: 0, outcome: "open" as const };
  }

  if (demand.type === "captaincy" && targetDisciplineId) {
    const targetResolved = getResolvedTargetMatchdayResultIds(gameState, targetDisciplineId).size > 0;
    const captained = hasPlayerCaptainDraft({ gameState, teamId, playerId, disciplineId: targetDisciplineId });
    if (captained) return { delta: reward, outcome: "fulfilled" as const };
    if (targetResolved) return { delta: penalty, outcome: "failed" as const };
    return { delta: 0, outcome: "open" as const };
  }

  if (demand.type === "appearances") {
    const target = getNumericTargetValue(demand.targetValue);
    if (target == null || target <= 0) return { delta: 0, outcome: "open" as const };
    if (input.seasonAppearances >= target) return { delta: reward, outcome: "fulfilled" as const };
    if (!input.currentSeasonHasResults) return { delta: 0, outcome: "open" as const };
    const gapShare = clamp((target - input.seasonAppearances) / target, 0.25, 1);
    return { delta: penalty * gapShare, outcome: demand.status === "at_risk" ? "pressure" as const : "failed" as const };
  }

  if (demand.type === "facility") {
    if (demand.status === "fulfilled") return { delta: reward, outcome: "fulfilled" as const };
    if (input.currentSeasonHasResults) return { delta: penalty * 0.35, outcome: "pressure" as const };
  }

  if (demand.type === "training_mode") {
    const player = input.gameState.players.find((entry) => entry.id === playerId) ?? null;
    const activeMode = player?.trainingMode ?? "mittel";
    const preferredMode =
      demand.targetValue === "leicht" || demand.targetValue === "mittel" || demand.targetValue === "hart"
        ? demand.targetValue
        : "mittel";
    return evaluateTrainingModeDemandDelta({
      demand: {
        preferredMode,
        currentMode: activeMode,
        status: demand.status,
        moraleReward: demand.moraleReward,
        moralePenalty: demand.moralePenalty,
        mismatchSeverity:
          activeMode === preferredMode
            ? 0
            : (activeMode === "leicht" && preferredMode === "hart") || (activeMode === "hart" && preferredMode === "leicht")
              ? 2
              : 1,
      },
      activeMode,
    });
  }

  if (demand.status === "failed") return { delta: penalty, outcome: "failed" as const };
  if (demand.status === "fulfilled") return { delta: reward, outcome: "fulfilled" as const };
  return { delta: 0, outcome: "open" as const };
}

function applyPlayerDemandMoraleImpact(input: {
  gameState: GameState;
  team: Team;
  player: Player;
  seasonAppearances: number;
  currentSeasonHasResults: boolean;
  reasons: PlayerMoraleReason[];
  warnings: string[];
}) {
  const demands = buildPlayerDemands(input.gameState, input.player.id, input.team.teamId);
  if (demands.length === 0) return 0;

  let rawDelta = 0;
  for (const demand of demands) {
    const result = evaluateDemandDelta({
      gameState: input.gameState,
      teamId: input.team.teamId,
      playerId: input.player.id,
      demand,
      seasonAppearances: input.seasonAppearances,
      currentSeasonHasResults: input.currentSeasonHasResults,
    });
    if (result.delta === 0) continue;
    const roundedDelta = roundValue(result.delta, 1);
    rawDelta += roundedDelta;
    const labelPrefix =
      result.outcome === "fulfilled" ? "Forderung erfuellt" : result.outcome === "failed" ? "Forderung verfehlt" : "Forderung unter Druck";
    addReason(input.reasons, `player_demand_${result.outcome}_${demand.type}`, `${labelPrefix}: ${demand.label}`, roundedDelta, "player_demands");
    if (result.outcome === "failed" && demand.priority === "high") {
      input.warnings.push("high_priority_player_demand_failed");
    }
  }

  const cappedDelta = roundValue(clamp(rawDelta, -18, 12), 1);
  if (cappedDelta < 0) {
    const teamCaptain = selectTeamCaptain(input.gameState, input.team.teamId);
    const buffer = teamCaptain ? roundValue(Math.min(Math.abs(cappedDelta), teamCaptain.effects.moraleBuffer ?? 0), 1) : 0;
    if (buffer > 0) {
      addReason(input.reasons, "team_captain_morale_buffer", "Teamkapitaen puffert Forderungskonflikt", buffer, "team_captain");
      return roundValue(cappedDelta + buffer, 1);
    }
  }

  return cappedDelta;
}

function getRosterPlayers(gameState: GameState, teamId: string, excludedPlayerId: string) {
  const ids = new Set(gameState.rosters.filter((entry) => entry.teamId === teamId && entry.playerId !== excludedPlayerId).map((entry) => entry.playerId));
  return gameState.players.filter((player) => ids.has(player.id));
}

function getPlayerCoreAverage(player: Player) {
  const values = CORE_AXES.map((axis) => player.coreStats?.[axis] ?? 0);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPlayerRosterStrength(player: Player, rosterEntry: RosterEntry | null | undefined) {
  const economy = resolvePlayerEconomyContract({ player, rosterEntry: rosterEntry ?? null });
  const marketSignal = economy.marketValue ?? player.displayMarketValue ?? player.marketValue ?? 0;
  return marketSignal * 1.25 + (player.rating ?? 0) * 0.45 + getPlayerCoreAverage(player) * 0.3;
}

function getStrongestPlayerAxis(player: Player): CoreAxis {
  return CORE_AXES.reduce((best, axis) => ((player.coreStats?.[axis] ?? 0) > (player.coreStats?.[best] ?? 0) ? axis : best), "pow");
}

function getStrongestTeamAxis(teamIdentity: TeamIdentity | null): CoreAxis | null {
  if (!teamIdentity) return null;
  return CORE_AXES.reduce((best, axis) => ((teamIdentity[axis] ?? 0) > (teamIdentity[best] ?? 0) ? axis : best), "pow");
}

function buildRelativePlayerContext(input: {
  gameState: GameState;
  player: Player;
  rosterEntry: RosterEntry;
  teamIdentity: TeamIdentity | null;
}) {
  const rosterRows = input.gameState.rosters
    .filter((entry) => entry.teamId === input.rosterEntry.teamId)
    .map((entry) => {
      const player = input.gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null;
      return player
        ? {
            entry,
            player,
            strength: getPlayerRosterStrength(player, entry),
          }
        : null;
    })
    .filter((entry): entry is { entry: RosterEntry; player: Player; strength: number } => Boolean(entry))
    .sort((left, right) => right.strength - left.strength);

  const rosterCount = rosterRows.length;
  const rosterRank = Math.max(1, rosterRows.findIndex((row) => row.player.id === input.player.id) + 1 || rosterCount);
  const relativeStrength = rosterCount <= 1 ? 1 : 1 - (rosterRank - 1) / Math.max(1, rosterCount - 1);
  const expectationRole = input.rosterEntry.promisedRole ?? input.rosterEntry.roleTag ?? "";
  const role = expectationRole.toLowerCase();
  const isPromisedCore = role.includes("starter") || role.includes("star") || role.includes("core");
  const isExplicitDepth = role.includes("rotation") || role.includes("bench") || role.includes("depth") || role.includes("prospect");
  const strengthTier =
    relativeStrength >= 0.72 || isPromisedCore ? "core" : relativeStrength <= 0.34 || isExplicitDepth ? "depth" : "rotation";
  const expectationWeight = strengthTier === "core" ? 1 : strengthTier === "rotation" ? 0.72 : 0.45;
  const strongestPlayerAxis = getStrongestPlayerAxis(input.player);
  const strongestTeamAxis = getStrongestTeamAxis(input.teamIdentity);
  const strongestTeamAxisValue = strongestTeamAxis ? input.teamIdentity?.[strongestTeamAxis] ?? 0 : 0;
  const strongestTeamAxisPlayerValue = strongestTeamAxis ? input.player.coreStats?.[strongestTeamAxis] ?? 0 : 0;

  return {
    rosterCount,
    rosterRank,
    relativeStrength,
    strengthTier,
    expectationWeight,
    strongestPlayerAxis,
    strongestTeamAxis,
    strongestTeamAxisValue,
    strongestTeamAxisPlayerValue,
  };
}

function getStoredMorale(gameState: GameState, playerId: string, teamId: string | null): PlayerMoraleState | null {
  const storedRows = gameState.playerMoraleState ?? [];
  const exactMatch =
    storedRows.find((entry) => entry.playerId === playerId && (teamId == null || entry.teamId === teamId)) ?? null;
  if (exactMatch) {
    return exactMatch;
  }

  return storedRows.find((entry) => entry.playerId === playerId) ?? null;
}

function normalizeCarryOverMorale(stored: PlayerMoraleState, seasonId: string, currentTeamId: string | null) {
  if (stored.lastUpdatedSeasonId === seasonId) {
    return {
      morale: stored.morale,
      carryWeight: 0.55,
    };
  }

  const sameTeamCarry = currentTeamId != null && stored.teamId === currentTeamId;
  const inactiveSeasons = Math.max(0, stored.inactiveSeasons ?? 0);
  if (inactiveSeasons > 0) {
    const inactiveFactor = Math.max(0.12, 0.22 - (inactiveSeasons - 1) * 0.04);
    const inactiveCarryWeight = Math.max(0.1, 0.16 - (inactiveSeasons - 1) * 0.02);
    return {
      morale: roundValue(clamp(50 + (stored.morale - 50) * inactiveFactor, 0, 100)),
      carryWeight: inactiveCarryWeight,
    };
  }

  return {
    morale: roundValue(clamp(50 + (stored.morale - 50) * (sameTeamCarry ? 0.7 : 0.3), 0, 100)),
    carryWeight: sameTeamCarry ? 0.38 : 0.18,
  };
}

export function assessPlayerMorale(input: PlayerMoraleInput): PlayerMoraleAssessment | null {
  const player = input.gameState.players.find((entry) => entry.id === input.playerId) ?? null;
  if (!player) return null;
  const rosterEntry =
    input.gameState.rosters.find((entry) => entry.playerId === player.id && (input.teamId == null || entry.teamId === input.teamId)) ?? null;
  if (!rosterEntry) return null;
  const team = input.gameState.teams.find((entry) => entry.teamId === rosterEntry.teamId) ?? null;
  if (!team) return null;
  const stored = getStoredMorale(input.gameState, player.id, rosterEntry.teamId);
  const teamIdentity = input.gameState.teamIdentities.find((entry) => entry.teamId === rosterEntry.teamId) ?? null;
  const assessment = computePlayerMorale({
    gameState: input.gameState,
    player,
    rosterEntry,
    team,
    teamIdentity,
    renewalSalaryPreview: input.renewalSalaryPreview ?? null,
  });

  if (!stored) {
    return assessment;
  }

  const carryOver = normalizeCarryOverMorale(stored, input.gameState.season.id, rosterEntry.teamId);
  const blendedMorale = roundValue(
    clamp(carryOver.morale * carryOver.carryWeight + assessment.morale * (1 - carryOver.carryWeight), 0, 100),
  );
  const visibleMood = getVisibleMood(blendedMorale);
  const intent = getContractIntent(blendedMorale, player);
  const salaryModifier = getMoraleSalaryModifier({
    morale: blendedMorale,
    player,
    currentSalary: rosterEntry.salary,
    renewalSalaryPreview: input.renewalSalaryPreview ?? null,
  });

  return {
    ...assessment,
    morale: blendedMorale,
    visibleMood,
    smiley: getSmiley(visibleMood),
    moodLabel: getMoodLabel(visibleMood),
    reasons: [...stored.reasons.slice(0, 2), ...assessment.reasons].slice(0, 8),
    contractIntent: intent,
    moraleSalaryModifier: salaryModifier,
    moraleContractLengthLimit: getContractLengthLimit(blendedMorale, player),
    moraleRenewalRisk: roundValue(clamp(100 - blendedMorale + (intent === "refuses_extension" ? 15 : 0), 0, 100)),
    suggestedActions: getSuggestedActions({ morale: blendedMorale, intent, player }),
    source: "stored",
  };
}

function computePlayerMorale(input: {
  gameState: GameState;
  player: Player;
  rosterEntry: RosterEntry;
  team: Team;
  teamIdentity: TeamIdentity | null;
  renewalSalaryPreview: number | null;
}): PlayerMoraleAssessment {
  const { gameState, player, rosterEntry, team, teamIdentity } = input;
  const reasons: PlayerMoraleReason[] = [];
  const warnings: string[] = [];
  let morale = 50;
  const relativeContext = buildRelativePlayerContext({
    gameState,
    player,
    rosterEntry,
    teamIdentity,
  });

  const currentSeasonHasResults = hasCurrentSeasonResults(gameState);
  const snapshotContext = currentSeasonHasResults
    ? null
    : getLatestSnapshotContext(gameState, team.teamId, player.id);
  const rank = snapshotContext?.teamRank ?? getTeamRank(gameState, team.teamId);
  const rankSource = snapshotContext?.teamRank != null ? "season_snapshot" : "standings";
  if (rank != null) {
    if (rank <= 3) {
      const weight = clamp(
        relativeContext.expectationWeight + (hasTrait(player, "ambitious") ? 0.22 : 0) - (hasTrait(player, "loyal") ? 0.12 : 0),
        0.45,
        1.25,
      );
      const delta = roundValue(12 * weight, 1);
      morale += delta;
      addReason(reasons, "team_title_contender", "Team spielt um Titel/Meisterschaft", delta, rankSource);
    } else if (rank <= 8) {
      const weight = clamp(
        relativeContext.expectationWeight + (hasTrait(player, "ambitious") ? 0.18 : 0) - (hasTrait(player, "loyal") ? 0.08 : 0),
        0.45,
        1.2,
      );
      const delta = roundValue(7 * weight, 1);
      morale += delta;
      addReason(reasons, "team_success", "Team ist sportlich stark", delta, rankSource);
    } else if (rank >= 25) {
      const weight = clamp(
        relativeContext.expectationWeight + (hasTrait(player, "ambitious") ? 0.45 : 0) - (hasTrait(player, "loyal") ? 0.22 : 0),
        0.3,
        1.45,
      );
      const delta = roundValue(-8 * weight, 1);
      morale += delta;
      addReason(reasons, "team_underperforming", "Team bleibt hinter Erwartungen", delta, rankSource);
    }
  }

  const seasonPerformance = buildPlayerSeasonPerformance(gameState, player.id) ?? {
    appearances: 0,
    averageContribution: null,
  };
  const hasSeasonPerformance =
    seasonPerformance.appearances > 0 || seasonPerformance.averageContribution != null;
  const expectationRole = rosterEntry.promisedRole ?? rosterEntry.roleTag;
  const expectedAppearances = getRoleExpectedAppearances(expectationRole);
  const appearanceGap = seasonPerformance.appearances - expectedAppearances;
  if (seasonPerformance.appearances > 0) {
    const usageDelta = clamp(appearanceGap * (expectationRole === "starter" ? 2.4 : 1.6), -14, 10);
    morale += usageDelta;
    addReason(
      reasons,
      usageDelta >= 0 ? "good_playtime" : "low_playtime",
      usageDelta >= 0 ? "Einsatzzeit passt" : "Einsatzzeit unter Rollenerwartung",
      usageDelta,
      "season_performance",
    );
    if (relativeContext.strengthTier === "depth" && appearanceGap >= -1) {
      morale += 3;
      addReason(reasons, "relative_role_fulfilled", "Rolle passt zur relativen Teamposition", 3, "roster_context");
    }
  } else if (expectationRole === "starter" && currentSeasonHasResults && !hasSeasonPerformance) {
    morale -= 12;
    addReason(reasons, "star_not_used", "Versprochener Starter ohne Einsatzzeit", -12, "season_performance");
  } else if (relativeContext.strengthTier === "depth" && currentSeasonHasResults && !hasSeasonPerformance) {
    morale -= 2;
    addReason(reasons, "depth_not_used", "Depth-Spieler ohne Einsatzzeit", -2, "season_performance");
  }

  if (seasonPerformance.averageContribution != null) {
    if (snapshotContext?.ppsRank != null && snapshotContext.ppsRank <= 40) {
      morale += 8;
      addReason(reasons, "strong_pps_rank", "Spieler ist in den Season-PPs stark", 8, "season_snapshot");
    } else if (snapshotContext?.ppsRank != null && snapshotContext.ppsRank <= 80) {
      morale += 5;
      addReason(reasons, "good_pps_rank", "Spieler ist in den Season-PPs solide", 5, "season_snapshot");
    } else if (seasonPerformance.averageContribution >= 18) {
      morale += 9;
      addReason(reasons, "elite_personal_performance", "Spieler liefert eine starke Season", 9, "season_performance");
    } else if (seasonPerformance.averageContribution >= 12) {
      morale += 6;
      addReason(reasons, "good_personal_performance", "Spieler liefert sportlich", 6, "season_performance");
    } else if (
      seasonPerformance.appearances >= 3 &&
      seasonPerformance.averageContribution < 5 &&
      (snapshotContext?.ppsRank == null || snapshotContext.ppsRank > 120)
    ) {
      morale -= 5;
      addReason(reasons, "poor_personal_performance", "Schwache eigene Season", -5, "season_performance");
    }
  }

  const teammates = getRosterPlayers(gameState, team.teamId, player.id);
  const teamFit = teammates.length ? calculateTransfermarktFit(player, teammates, { teamId: team.teamId }).teamFit ?? 0 : 0;
  if (teamFit >= 25) {
    const delta = hasTrait(player, "caring") || hasTrait(player, "altruistic") ? 8 : 5;
    morale += delta;
    addReason(reasons, "good_team_chemistry", "Guter Teamfit/Teamchemie", delta, "team_fit");
  } else if (teamFit < 0) {
    let delta = hasTrait(player, "mercenary") && team.shortCode !== "W-L" && team.teamId !== "W-L" ? -10 : -6;
    if (hasTrait(player, "loyal")) delta += 2;
    morale += delta;
    addReason(reasons, "negative_team_fit", "Negativer Teamfit belastet Moral", delta, "team_fit");
    if (hasTrait(player, "mercenary") && team.shortCode !== "W-L" && team.teamId !== "W-L") {
      warnings.push("mercenary_negative_fit_morale_risk");
    }
  }

  if (
    relativeContext.strongestTeamAxis &&
    relativeContext.strongestTeamAxis === relativeContext.strongestPlayerAxis &&
    relativeContext.strongestTeamAxisPlayerValue >= 45
  ) {
    const delta = relativeContext.strengthTier === "core" ? 4 : 2;
    morale += delta;
    addReason(reasons, "team_axis_fit", "Spielerstaerke passt zur Teamachse", delta, "roster_context");
  } else if (
    relativeContext.strengthTier === "core" &&
    relativeContext.strongestTeamAxis &&
    relativeContext.strongestTeamAxisValue >= 7 &&
    relativeContext.strongestTeamAxisPlayerValue < 35
  ) {
    morale -= 3;
    addReason(reasons, "team_axis_mismatch", "Core-Spieler passt schwach zur Teamachse", -3, "roster_context");
  }

  const trainingMode = player.trainingMode ?? null;
  if (trainingMode === "hart") {
    const delta = hasTrait(player, "lazy") ? -8 : hasTrait(player, "diligent") || hasTrait(player, "disciplined") ? -1 : -4;
    morale += delta;
    addReason(reasons, "hard_training_load", "Harte Trainingslast", delta, "training");
  } else if (trainingMode === "leicht") {
    const delta = hasTrait(player, "ambitious") ? -2 : 2;
    morale += delta;
    addReason(reasons, "light_training_load", "Leichtere Trainingslast", delta, "training");
  }

  const traits = getTraits(player);
  const positiveTraitHits = traits.filter((trait) => POSITIVE_TRAINING_TRAITS.has(trait)).length;
  const negativeTraitHits = traits.filter((trait) => NEGATIVE_VOLATILE_TRAITS.has(trait)).length;
  if (positiveTraitHits > 0) {
    const delta = Math.min(6, positiveTraitHits * 2);
    morale += delta;
    addReason(reasons, "stable_positive_traits", "Stabile positive Traits", delta, "traits");
  }
  if (negativeTraitHits > 0) {
    const delta = -Math.min(8, negativeTraitHits * 2);
    morale += delta;
    addReason(reasons, "volatile_negative_traits", "Volatile negative Traits", delta, "traits");
  }

  const economy = resolvePlayerEconomyContract({ player, rosterEntry });
  const renewalSalary = input.renewalSalaryPreview ?? economy.salary;
  if (rosterEntry.salary > 0 && renewalSalary != null && renewalSalary > rosterEntry.salary * 1.25) {
    const expectationRelief = relativeContext.strengthTier === "depth" ? 2 : relativeContext.strengthTier === "rotation" ? 1 : 0;
    const goodContextDiscount =
      (rank != null && rank <= 3 ? 3 : rank != null && rank <= 8 ? 1 : 0) +
      (seasonPerformance.averageContribution != null && seasonPerformance.averageContribution >= 12 ? 2 : 0) +
      expectationRelief;
    const delta = Math.min(-2, (hasTrait(player, "mercenary") ? -10 : -6) + goodContextDiscount);
    morale += delta;
    addReason(reasons, "underpaid_vs_expectation", "Gehalt liegt unter Erwartung", delta, "contract");
  } else if (rosterEntry.salary > 0 && renewalSalary != null && rosterEntry.salary >= renewalSalary * 1.08) {
    const delta = hasTrait(player, "mercenary") ? 7 : 4;
    morale += delta;
    addReason(reasons, "well_paid", "Gehalt signalisiert Wertschätzung", delta, "contract");
  }

  if (teamIdentity) {
    if (teamIdentity.harmony >= 8 && (hasTrait(player, "diva") || hasTrait(player, "egomaniac") || hasTrait(player, "renegade"))) {
      morale -= 5;
      addReason(reasons, "harmony_trait_friction", "Traits reiben sich an hoher Harmonie", -5, "team_identity");
    }
    if (teamIdentity.manners >= 8 && (hasTrait(player, "scandalous") || hasTrait(player, "gambler") || hasTrait(player, "renegade"))) {
      morale -= 5;
      addReason(reasons, "manners_trait_friction", "Traits passen schlecht zu hohen Manieren", -5, "team_identity");
    }
    if (teamIdentity.ambition >= 8 && hasTrait(player, "ambitious")) {
      morale += 4;
      addReason(reasons, "ambition_match", "Ambition passt zum Teamanspruch", 4, "team_identity");
    }
  }

  const profile = getTeamStrategyProfile(gameState, team.teamId);
  if ((profile?.bias?.harmonyStrictness ?? 0) >= 8 && (hasTrait(player, "diva") || hasTrait(player, "egomaniac"))) {
    morale -= 4;
    addReason(reasons, "strict_harmony_profile", "Strenge Teamkultur reagiert auf Ego-Traits", -4, "team_strategy");
  }

  const demandDelta = applyPlayerDemandMoraleImpact({
    gameState,
    team,
    player,
    seasonAppearances: seasonPerformance.appearances,
    currentSeasonHasResults,
    reasons,
    warnings,
  });
  morale += demandDelta;

  morale = roundValue(clamp(50 + (morale - 50) * 1.2, 0, 100));
  const visibleMood = getVisibleMood(morale);
  const contractIntent = getContractIntent(morale, player);
  const moraleSalaryModifier = getMoraleSalaryModifier({
    morale,
    player,
    currentSalary: rosterEntry.salary,
    renewalSalaryPreview: input.renewalSalaryPreview,
  });
  const moraleContractLengthLimit = getContractLengthLimit(morale, player);
  const moraleRenewalRisk = roundValue(clamp(100 - morale + (contractIntent === "refuses_extension" ? 15 : 0), 0, 100));

  if (contractIntent === "refuses_extension") warnings.push("morale_refuses_extension_risk");
  if (contractIntent === "considering_exit") warnings.push("morale_exit_risk");
  if (moraleContractLengthLimit != null) warnings.push("morale_limits_contract_length");

  return {
    playerId: player.id,
    teamId: team.teamId,
    morale,
    visibleMood,
    smiley: getSmiley(visibleMood),
    moodLabel: getMoodLabel(visibleMood),
    lastUpdatedSeasonId: gameState.season.id,
    reasons: reasons.sort((left, right) => Math.abs(right.valueDelta) - Math.abs(left.valueDelta)).slice(0, 8),
    contractIntent,
    moraleSalaryModifier,
    moraleContractLengthLimit,
    moraleRenewalRisk,
    suggestedActions: getSuggestedActions({ morale, intent: contractIntent, player }),
    warnings,
    source: "computed_preview",
  };
}

export function applyMoraleToSalary(baseSalary: number | null | undefined, morale: PlayerMoraleAssessment | null | undefined) {
  if (baseSalary == null || !Number.isFinite(baseSalary)) return null;
  return roundValue(baseSalary * (morale?.moraleSalaryModifier ?? 1), 2);
}

export function buildPlayerMoraleAudit(gameState: GameState) {
  const rows = gameState.rosters
    .map((entry) => assessPlayerMorale({ gameState, playerId: entry.playerId, teamId: entry.teamId }))
    .filter((entry): entry is PlayerMoraleAssessment => Boolean(entry));
  const criticalRows = rows.filter((entry) => entry.visibleMood === "angry" || entry.visibleMood === "unhappy");
  const refusalRiskRows = rows.filter((entry) => entry.contractIntent === "refuses_extension" || entry.contractIntent === "considering_exit");
  return {
    generatedAt: new Date().toISOString(),
    seasonId: gameState.season.id,
    totalPlayers: rows.length,
    averageMorale: rows.length ? roundValue(rows.reduce((sum, entry) => sum + entry.morale, 0) / rows.length, 1) : null,
    criticalCount: criticalRows.length,
    refusalRiskCount: refusalRiskRows.length,
    rows,
  };
}
