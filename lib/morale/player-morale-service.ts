import type {
  GameState,
  Player,
  PlayerMoraleContractIntent,
  PlayerMoraleReason,
  PlayerMoraleState,
  PlayerMoraleVisibleMood,
  RosterEntry,
  Team,
  TeamIdentity,
} from "@/lib/data/olyDataTypes";
import { buildPlayerSeasonPerformance } from "@/lib/foundation/player-season-performance";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { calculateTransfermarktFit } from "@/lib/market/transfermarkt-fit";

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
  if (input.morale >= 84) modifier -= 0.05;
  else if (input.morale >= 68) modifier -= 0.02;
  else if (input.morale < 25) modifier += 0.28;
  else if (input.morale < 40) modifier += 0.16;
  else if (input.morale < 52) modifier += 0.07;

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

  return roundValue(clamp(modifier, 0.82, 1.45), 3);
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

function getRosterPlayers(gameState: GameState, teamId: string, excludedPlayerId: string) {
  const ids = new Set(gameState.rosters.filter((entry) => entry.teamId === teamId && entry.playerId !== excludedPlayerId).map((entry) => entry.playerId));
  return gameState.players.filter((player) => ids.has(player.id));
}

function getStoredMorale(gameState: GameState, playerId: string, teamId: string | null): PlayerMoraleState | null {
  return (
    (gameState.playerMoraleState ?? []).find((entry) => entry.playerId === playerId && (teamId == null || entry.teamId === teamId)) ??
    null
  );
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

  const blendedMorale = roundValue(clamp(stored.morale * 0.55 + assessment.morale * 0.45, 0, 100));
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
  let morale = 55;

  const rank = getTeamRank(gameState, team.teamId);
  if (rank != null) {
    if (rank <= 8) {
      const delta = hasTrait(player, "ambitious") ? 10 : 7;
      morale += delta;
      addReason(reasons, "team_success", "Team ist sportlich stark", delta, "standings");
    } else if (rank >= 25) {
      const delta = hasTrait(player, "loyal") ? -4 : hasTrait(player, "ambitious") ? -13 : -8;
      morale += delta;
      addReason(reasons, "team_underperforming", "Team bleibt hinter Erwartungen", delta, "standings");
    }
  }

  const seasonPerformance = buildPlayerSeasonPerformance(gameState, player.id) ?? {
    appearances: 0,
    averageContribution: null,
  };
  const expectedAppearances = getRoleExpectedAppearances(rosterEntry.roleTag);
  const appearanceGap = seasonPerformance.appearances - expectedAppearances;
  if (seasonPerformance.appearances > 0) {
    const usageDelta = clamp(appearanceGap * (rosterEntry.roleTag === "starter" ? 2.4 : 1.6), -14, 10);
    morale += usageDelta;
    addReason(
      reasons,
      usageDelta >= 0 ? "good_playtime" : "low_playtime",
      usageDelta >= 0 ? "Einsatzzeit passt" : "Einsatzzeit unter Rollenerwartung",
      usageDelta,
      "season_performance",
    );
  } else if (rosterEntry.roleTag === "starter") {
    morale -= 12;
    addReason(reasons, "star_not_used", "Starter ohne Einsatzzeit", -12, "season_performance");
  }

  if (seasonPerformance.averageContribution != null) {
    if (seasonPerformance.averageContribution >= 12) {
      morale += 5;
      addReason(reasons, "good_personal_performance", "Spieler liefert sportlich", 5, "season_performance");
    } else if (seasonPerformance.appearances >= 3 && seasonPerformance.averageContribution < 5) {
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
    const delta = hasTrait(player, "mercenary") ? -10 : -6;
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

  morale = roundValue(clamp(morale, 0, 100));
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
