import fs from "node:fs";
import path from "node:path";

import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import { buildAiLeagueManagementPreview } from "@/lib/ai/ai-team-management-preview-service";
import { buildTeamObjectiveOverview, refreshTeamObjectiveState } from "@/lib/board/team-season-objectives-service";
import type { GameState, LineupDraftModifiers, TeamPowerEffectType, TeamPowerTargetMode } from "@/lib/data/olyDataTypes";
import {
  GM_INFLUENCE_PCT,
  TEAM_GENERAL_MANAGER_PROFILES,
  getTeamGeneralManager,
  withNormalizedTeamGeneralManagers,
} from "@/lib/foundation/team-general-managers";
import { getTeamStrategyProfile, withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import { createDefaultLineupDraftModifiers } from "@/lib/lineups/legacy-lineup-modifiers";
import { loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import type { DisciplineSide, LegacyLineupLoadedContext, LegacyTeamPowerOption } from "@/lib/lineups/legacy-lineup-types";
import {
  calculateMatchdayProjectedPreview,
  resolveSlotRolesForDiscipline,
} from "@/lib/lineups/matchday-slot-roles";
import { calculateTeamPowerModifierForSide, ensureLocalTeamPowersForSeason, getTeamPowerOptions } from "@/lib/lineups/team-powers";
import { buildTeamPlayerDemandMap, selectTeamCaptain } from "@/lib/morale/player-demands-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  officialDisciplineWeightLabels,
  officialDisciplineWeightMatrix,
  officialDisciplineWeightOrder,
  playerGeneratorAttributeKeys,
} from "@/lib/player-generator/official-discipline-weights";
import { buildTeamRivalryLedger, getTeamRelationship, getTeamRelationshipRecords } from "@/lib/rivalries/team-rivalries";

type IssueSeverity = "error" | "warning";

type AuditIssue = {
  severity: IssueSeverity;
  system: string;
  code: string;
  message: string;
  teamId?: string;
};

type AiPowerPickAudit = {
  teamId: string;
  teamCode: string;
  side: DisciplineSide;
  disciplineId: string;
  disciplineName: string;
  powerLabel: string;
  effectType: TeamPowerEffectType;
  targetMode: TeamPowerTargetMode;
  basePct: number;
  conditionalPct: number;
  attributeFitPct: number;
  impactPct: number;
  top8Rivals: number;
};

function parseArgs(argv: string[]) {
  const getValue = (flag: string, fallback = "") => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] ?? fallback : fallback;
  };
  return {
    saveId: getValue("--saveId"),
    seasonId: getValue("--seasonId"),
    matchdayId: getValue("--matchdayId"),
    outDir: getValue("--outDir", "outputs/new-management-systems-audit"),
  };
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function minMaxAvg(values: number[]) {
  if (values.length === 0) return { min: 0, max: 0, avg: 0 };
  return {
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
    avg: round(values.reduce((sum, value) => sum + value, 0) / values.length),
  };
}

function pushIssue(issues: AuditIssue[], severity: IssueSeverity, system: string, code: string, message: string, extra?: Partial<AuditIssue>) {
  issues.push({ severity, system, code, message, ...extra });
}

function getSideDiscipline(context: LegacyLineupLoadedContext, side: DisciplineSide) {
  return side === "d1" ? context.matchdayContract?.discipline1 ?? null : context.matchdayContract?.discipline2 ?? null;
}

function getConditionalBonusPct(context: LegacyLineupLoadedContext, disciplineId: string, power: LegacyTeamPowerOption) {
  if (power.conditionalTrigger !== "rival_top8_discipline") return 0;
  return (context.teamPowerWindows?.[disciplineId]?.top8Rivals.length ?? 0) > 0 ? power.conditionalBonusPct : 0;
}

function buildSinglePowerModifiers(side: DisciplineSide, powerId: string): LineupDraftModifiers {
  const modifiers = createDefaultLineupDraftModifiers();
  modifiers[side].teamPowerId = powerId;
  return modifiers;
}

function normalizeAuditGameState(saveGameState: GameState, saveId: string, seasonId: string) {
  const withGms = withNormalizedTeamGeneralManagers(saveGameState);
  const withProfiles = withNormalizedTeamStrategyProfiles(withGms);
  const withPowers = ensureLocalTeamPowersForSeason(withProfiles, saveId, seasonId);
  return refreshTeamObjectiveState(withPowers);
}

function auditGeneralManagers(gameState: GameState, issues: AuditIssue[]) {
  const profileIds = new Set(TEAM_GENERAL_MANAGER_PROFILES.map((profile) => profile.gmId));
  const archetypeCounts = new Map<string, number>();
  for (const profile of TEAM_GENERAL_MANAGER_PROFILES) {
    archetypeCounts.set(profile.archetype, (archetypeCounts.get(profile.archetype) ?? 0) + 1);
    if (profile.pow < 0 || profile.pow > 20 || profile.spe < 0 || profile.spe > 20 || profile.men < 0 || profile.men > 20 || profile.soc < 0 || profile.soc > 20) {
      pushIssue(issues, "error", "gms", "gm_profile_axis_out_of_range", `${profile.name} hat Axis-Werte ausserhalb 0-20.`);
    }
    for (const value of [profile.ambition, profile.finances, profile.boardConfidence, profile.harmony, profile.manners, profile.popularity, profile.cooperation]) {
      if (value < 1 || value > 10) {
        pushIssue(issues, "error", "gms", "gm_profile_management_out_of_range", `${profile.name} hat Management-Werte ausserhalb 1-10.`);
        break;
      }
    }
  }

  if (TEAM_GENERAL_MANAGER_PROFILES.length !== 100 || profileIds.size !== 100) {
    pushIssue(issues, "error", "gms", "gm_profile_pool_invalid", `GM-Profilpool ist ${TEAM_GENERAL_MANAGER_PROFILES.length}/${profileIds.size}, erwartet 100 eindeutige Profile.`);
  }
  if ([...archetypeCounts.values()].some((count) => count !== 10) || archetypeCounts.size !== 10) {
    pushIssue(issues, "error", "gms", "gm_archetype_distribution_invalid", "GM-Archetypen sind nicht sauber 10x10 verteilt.");
  }

  const assignments = gameState.seasonState.teamGeneralManagers ?? {};
  const usedGmIds = new Set<string>();
  let gmAppliedIdentities = 0;
  let gmAppliedProfiles = 0;
  let humanSlotAssignments = 0;
  for (const team of gameState.teams) {
    const gm = getTeamGeneralManager(gameState, team.teamId);
    if (!gm) {
      pushIssue(issues, "error", "gms", "gm_assignment_missing", `${team.name} hat keinen GM.`, { teamId: team.teamId });
      continue;
    }
    usedGmIds.add(gm.profile.gmId);
    if (gm.assignment.influencePct !== GM_INFLUENCE_PCT) {
      pushIssue(issues, "warning", "gms", "gm_influence_non_default", `${team.name} hat GM-Influence ${gm.assignment.influencePct}% statt ${GM_INFLUENCE_PCT}%.`, { teamId: team.teamId });
    }
    if (gm.assignment.source === "human_slot") humanSlotAssignments += 1;
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    if (identity?.sourceNote?.includes(`gm:${gm.profile.gmId}`)) gmAppliedIdentities += 1;
    const strategy = getTeamStrategyProfile(gameState, team.teamId);
    if (strategy?.strategyVersion?.includes("+gm-v1")) gmAppliedProfiles += 1;
  }
  if (Object.keys(assignments).length !== gameState.teams.length) {
    pushIssue(issues, "error", "gms", "gm_assignment_count_invalid", `GM-Zuweisungen ${Object.keys(assignments).length}/${gameState.teams.length}.`);
  }
  if (gmAppliedProfiles !== gameState.teams.length) {
    pushIssue(issues, "error", "gms", "gm_strategy_profile_not_applied", `GM-Strategieeffekt ist nur bei ${gmAppliedProfiles}/${gameState.teams.length} Teams sichtbar.`);
  }

  return {
    profileCount: TEAM_GENERAL_MANAGER_PROFILES.length,
    uniqueProfileCount: profileIds.size,
    archetypeCount: archetypeCounts.size,
    assignments: Object.keys(assignments).length,
    uniqueAssignedGms: usedGmIds.size,
    humanSlotAssignments,
    gmAppliedIdentities,
    gmAppliedProfiles,
    influencePct: GM_INFLUENCE_PCT,
  };
}

function auditBoardObjectives(gameState: GameState, issues: AuditIssue[]) {
  const overview = buildTeamObjectiveOverview(gameState);
  const byTeam = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const byStatus = new Map<string, number>();
  let playerObjectiveCount = 0;
  let medalObjectiveCount = 0;
  let rivalryObjectiveCount = 0;
  let aiBiasWarnings = 0;

  for (const objective of overview.objectives) {
    byTeam.set(objective.teamId, (byTeam.get(objective.teamId) ?? 0) + 1);
    byCategory.set(objective.category, (byCategory.get(objective.category) ?? 0) + 1);
    byStatus.set(objective.status, (byStatus.get(objective.status) ?? 0) + 1);
    if (objective.category === "player") playerObjectiveCount += 1;
    if (objective.objectiveId === "sport-matchday-medals") medalObjectiveCount += 1;
    if (objective.objectiveId.startsWith("rivalry-")) rivalryObjectiveCount += 1;
    if (!objective.label || objective.targetValue == null || objective.currentValue == null) {
      pushIssue(issues, "warning", "board", "objective_display_fields_incomplete", `${objective.teamId}: ${objective.objectiveId} hat unvollstaendige Anzeige-Felder.`, { teamId: objective.teamId });
    }
  }

  for (const team of gameState.teams) {
    const count = byTeam.get(team.teamId) ?? 0;
    if (count !== 4) {
      pushIssue(issues, "error", "board", "objective_count_per_team_invalid", `${team.name} hat ${count} Boardziele, erwartet 4.`, { teamId: team.teamId });
    }
    const board = overview.boardConfidence[team.teamId] ?? null;
    if (!board) {
      pushIssue(issues, "error", "board", "board_confidence_missing", `${team.name} hat keine Board Confidence.`, { teamId: team.teamId });
    } else if (board.value < 1 || board.value > 10 || board.pressure < 1 || board.pressure > 10) {
      pushIssue(issues, "error", "board", "board_confidence_out_of_range", `${team.name} hat Board-Werte ausserhalb 1-10.`, { teamId: team.teamId });
    }

    const bias = overview.aiBiasByTeamId[team.teamId] ?? null;
    if (!bias) {
      pushIssue(issues, "error", "board", "objective_ai_bias_missing", `${team.name} hat keinen Board-AI-Bias.`, { teamId: team.teamId });
    } else {
      const values = [bias.transferAggression, bias.buyAggression, bias.sellAggression, bias.budgetConservatism, bias.facilityPriority, bias.developmentPriority, bias.moralePriority, bias.rosterUrgency];
      if (values.some((value) => value < 0 || value > 1)) {
        pushIssue(issues, "error", "board", "objective_ai_bias_out_of_range", `${team.name} hat AI-Bias ausserhalb 0-1.`, { teamId: team.teamId });
      }
      aiBiasWarnings += bias.warnings.length;
    }
  }

  if (playerObjectiveCount === 0) {
    pushIssue(issues, "warning", "board", "no_player_objectives_selected", "Im aktuellen Save ist kein Player-Peak-Ziel in der kompakten Board-Auswahl.");
  }
  if (medalObjectiveCount === 0) {
    pushIssue(issues, "warning", "board", "no_medal_objectives_selected", "Im aktuellen Save ist kein Spieltagsmedaillen-Ziel in der kompakten Board-Auswahl.");
  }
  if (rivalryObjectiveCount === 0) {
    pushIssue(issues, "warning", "board", "no_rivalry_objectives_selected", "Im aktuellen Save ist kein Rivalitätsziel in der kompakten Board-Auswahl.");
  }

  return {
    objectiveCount: overview.objectives.length,
    teamsWithObjectives: byTeam.size,
    boardConfidenceCount: Object.keys(overview.boardConfidence).length,
    aiBiasCount: Object.keys(overview.aiBiasByTeamId).length,
    playerObjectiveCount,
    medalObjectiveCount,
    rivalryObjectiveCount,
    aiBiasWarnings,
    categories: Object.fromEntries([...byCategory.entries()].sort()),
    statuses: Object.fromEntries([...byStatus.entries()].sort()),
    overviewWarnings: overview.warnings,
  };
}

function auditManagementAiActiveUsage(gameState: GameState, issues: AuditIssue[]) {
  const overview = buildTeamObjectiveOverview(gameState);
  const leaguePreview = buildAiLeagueManagementPreview(gameState);
  const strategicIntents = new Map<string, number>();
  const riskProfiles = new Map<string, number>();
  const trainingFocuses = new Map<string, number>();
  const trainingIntensities = new Map<string, number>();
  const buildingActions = new Map<string, number>();
  let teamsWithObjectiveWarningsInAiProfile = 0;
  let teamsWithBoardPressureApplied = 0;
  let teamsWithNonZeroBudgetPlan = 0;
  let teamsWithActionableBuildingPlan = 0;
  let teamsWithTrainingReasons = 0;

  if (leaguePreview.teams.length !== gameState.teams.length) {
    pushIssue(issues, "error", "management_ai", "management_preview_team_count_invalid", `Management-AI Preview deckt ${leaguePreview.teams.length}/${gameState.teams.length} Teams ab.`);
  }

  for (const teamPlan of leaguePreview.teams) {
    strategicIntents.set(teamPlan.profile.strategicIntent, (strategicIntents.get(teamPlan.profile.strategicIntent) ?? 0) + 1);
    riskProfiles.set(teamPlan.profile.riskProfile, (riskProfiles.get(teamPlan.profile.riskProfile) ?? 0) + 1);
    trainingFocuses.set(teamPlan.trainingPlan.selectedTrainingFocus, (trainingFocuses.get(teamPlan.trainingPlan.selectedTrainingFocus) ?? 0) + 1);
    trainingIntensities.set(teamPlan.trainingPlan.selectedTrainingIntensity, (trainingIntensities.get(teamPlan.trainingPlan.selectedTrainingIntensity) ?? 0) + 1);
    teamPlan.buildingPlan.forEach((row) => buildingActions.set(row.action, (buildingActions.get(row.action) ?? 0) + 1));

    const bias = overview.aiBiasByTeamId[teamPlan.teamId] ?? null;
    if (teamPlan.profile.warnings.some((warning) => warning.startsWith("board_objective:"))) {
      teamsWithObjectiveWarningsInAiProfile += 1;
    }
    if (bias && teamPlan.profile.boardPressure >= bias.pressure * 10) {
      teamsWithBoardPressureApplied += 1;
    }
    const buckets = teamPlan.budgetPlan.bucketsBefore;
    if (buckets.transferBudget > 0 || buckets.buildingBudget > 0 || buckets.maintenanceBudget > 0) {
      teamsWithNonZeroBudgetPlan += 1;
    }
    if (teamPlan.buildingPlan.some((row) => row.action !== "skip")) {
      teamsWithActionableBuildingPlan += 1;
    }
    if (teamPlan.trainingPlan.reasons.length > 0) {
      teamsWithTrainingReasons += 1;
    }
  }

  if (teamsWithBoardPressureApplied !== leaguePreview.teams.length) {
    pushIssue(issues, "error", "management_ai", "board_pressure_not_applied_to_management_ai", `Boarddruck ist nur bei ${teamsWithBoardPressureApplied}/${leaguePreview.teams.length} AI-Profilen sichtbar.`);
  }
  if (teamsWithNonZeroBudgetPlan === 0) {
    pushIssue(issues, "error", "management_ai", "management_ai_budget_plan_inactive", "Management-AI erzeugt keine Budgetplaene.");
  }
  if (teamsWithTrainingReasons === 0) {
    pushIssue(issues, "error", "management_ai", "management_ai_training_plan_inactive", "Management-AI erzeugt keine begruendeten Trainingsplaene.");
  }
  if (strategicIntents.size < 2 || trainingFocuses.size < 2) {
    pushIssue(issues, "warning", "management_ai", "management_ai_low_variance", "Management-AI zeigt im aktuellen Save wenig Varianz in Intent/Training.");
  }

  return {
    teams: leaguePreview.teams.length,
    teamsWithObjectiveWarningsInAiProfile,
    teamsWithBoardPressureApplied,
    teamsWithNonZeroBudgetPlan,
    teamsWithActionableBuildingPlan,
    teamsWithTrainingReasons,
    strategicIntents: Object.fromEntries([...strategicIntents.entries()].sort()),
    riskProfiles: Object.fromEntries([...riskProfiles.entries()].sort()),
    trainingFocuses: Object.fromEntries([...trainingFocuses.entries()].sort()),
    trainingIntensities: Object.fromEntries([...trainingIntensities.entries()].sort()),
    buildingActions: Object.fromEntries([...buildingActions.entries()].sort()),
    samplePlans: leaguePreview.teams.slice(0, 8).map((team) => ({
      teamId: team.teamId,
      teamCode: team.teamCode,
      intent: team.profile.strategicIntent,
      risk: team.profile.riskProfile,
      boardPressure: team.profile.boardPressure,
      training: `${team.trainingPlan.selectedTrainingFocus}/${team.trainingPlan.selectedTrainingIntensity}`,
      transferBudget: team.budgetPlan.bucketsBefore.transferBudget,
      buildingBudget: team.budgetPlan.bucketsBefore.buildingBudget,
      topBuildingAction: team.buildingPlan.find((row) => row.action !== "skip")?.action ?? "skip",
      warnings: team.profile.warnings.slice(0, 4),
    })),
  };
}

function auditDemandsAndCaptains(gameState: GameState, issues: AuditIssue[]) {
  const byDemandType = new Map<string, number>();
  const byDemandStatus = new Map<string, number>();
  const captainStyles = new Map<string, number>();
  let totalDemands = 0;
  let playersWithDemands = 0;
  let teamsWithDemands = 0;
  let captainCount = 0;
  const leadershipScores: number[] = [];

  for (const team of gameState.teams) {
    const demandMap = buildTeamPlayerDemandMap(gameState, team.teamId);
    let teamDemandCount = 0;
    for (const [playerId, demands] of demandMap.entries()) {
      if (demands.length > 2) {
        pushIssue(issues, "error", "demands", "player_demand_stack_too_high", `${team.name}: ${playerId} hat ${demands.length} Forderungen.`, { teamId: team.teamId });
      }
      if (demands.length > 0) playersWithDemands += 1;
      teamDemandCount += demands.length;
      for (const demand of demands) {
        totalDemands += 1;
        byDemandType.set(demand.type, (byDemandType.get(demand.type) ?? 0) + 1);
        byDemandStatus.set(demand.status, (byDemandStatus.get(demand.status) ?? 0) + 1);
        if (demand.moralePenalty > 0 || demand.moraleReward < 0) {
          pushIssue(issues, "error", "demands", "player_demand_morale_direction_invalid", `${team.name}: ${demand.label} hat verdrehte Morale-Werte.`, { teamId: team.teamId });
        }
      }
    }
    if (teamDemandCount > 0) teamsWithDemands += 1;

    const captain = selectTeamCaptain(gameState, team.teamId);
    if (!captain) {
      pushIssue(issues, "error", "captains", "team_captain_missing", `${team.name} hat keinen Lore-Teamcaptain.`, { teamId: team.teamId });
    } else {
      captainCount += 1;
      leadershipScores.push(captain.leadershipScore);
      captainStyles.set(captain.style, (captainStyles.get(captain.style) ?? 0) + 1);
      if (
        captain.effects.moraleBuffer < 1 ||
        captain.effects.rivalryPressureReductionPct < 4 ||
        captain.effects.teamPowerModifierPct < 1 ||
        captain.effects.conflictSoftenChancePct < 6
      ) {
        pushIssue(issues, "error", "captains", "team_captain_effect_out_of_range", `${team.name}: Captain-Effekte sind ausserhalb der erwarteten Mindestwerte.`, { teamId: team.teamId });
      }
    }
  }

  if (totalDemands === 0) {
    pushIssue(issues, "warning", "demands", "no_player_demands_generated", "Im aktuellen Save wurden keine Spielerforderungen generiert.");
  }
  if (captainCount !== gameState.teams.length) {
    pushIssue(issues, "error", "captains", "team_captain_coverage_incomplete", `Teamcaptains ${captainCount}/${gameState.teams.length}.`);
  }

  return {
    totalDemands,
    playersWithDemands,
    teamsWithDemands,
    byDemandType: Object.fromEntries([...byDemandType.entries()].sort()),
    byDemandStatus: Object.fromEntries([...byDemandStatus.entries()].sort()),
    captainCount,
    captainStyles: Object.fromEntries([...captainStyles.entries()].sort()),
    leadershipScore: minMaxAvg(leadershipScores),
  };
}

function auditRivalries(gameState: GameState, issues: AuditIssue[]) {
  const records = getTeamRelationshipRecords();
  const ledger = buildTeamRivalryLedger(gameState);
  const expectedRecordCount = gameState.teams.length * (gameState.teams.length - 1);
  const primaryTeams = new Set<string>();
  for (const entry of ledger) {
    primaryTeams.add(entry.teamAId);
    primaryTeams.add(entry.teamBId);
  }
  const projectSuicideZeroHeroes = getTeamRelationship("P-S", "Z-H")?.value ?? null;
  const zeroHeroesProjectSuicide = getTeamRelationship("Z-H", "P-S")?.value ?? null;

  if (records.length !== expectedRecordCount) {
    pushIssue(issues, "error", "rivalries", "relationship_matrix_count_invalid", `Beziehungsmatrix hat ${records.length}/${expectedRecordCount} gerichtete Beziehungen.`);
  }
  if (ledger.length === 0) {
    pushIssue(issues, "error", "rivalries", "rivalry_ledger_empty", "Rivalry Ledger ist leer.");
  }
  if (primaryTeams.size < Math.floor(gameState.teams.length * 0.75)) {
    pushIssue(issues, "warning", "rivalries", "rivalry_team_coverage_low", `Nur ${primaryTeams.size}/${gameState.teams.length} Teams haben aktive Rivalry-Ledger-Eintraege.`);
  }
  if (projectSuicideZeroHeroes == null || zeroHeroesProjectSuicide == null) {
    pushIssue(issues, "warning", "rivalries", "known_rivalry_pair_missing", "Project Suicide / Zero Heroes ist in der Beziehungsmatrix nicht beidseitig lesbar.");
  }

  return {
    relationshipRecords: records.length,
    expectedRelationshipRecords: expectedRecordCount,
    ledgerEntries: ledger.length,
    mutualEntries: ledger.filter((entry) => entry.isMutual).length,
    teamsCovered: primaryTeams.size,
    topRivalries: ledger.slice(0, 10).map((entry) => ({
      label: entry.label,
      intensity: entry.intensity,
      theme: entry.theme,
      mutual: entry.isMutual,
      values: `${entry.teamAValue}/${entry.teamBValue}`,
    })),
    knownPairs: {
      projectSuicideZeroHeroes,
      zeroHeroesProjectSuicide,
    },
  };
}

function auditSlotRoles(issues: AuditIssue[]) {
  const rows: Array<{ disciplineId: string; slotCount: number; roles: number; maxAverageDrift: number }> = [];
  let totalRoleSets = 0;
  let fallbackRoleSets = 0;
  let keyAttributesWithZeroBase = 0;

  for (const disciplineId of officialDisciplineWeightOrder) {
    for (const slotCount of [2, 3, 4, 5, 6]) {
      const roles = resolveSlotRolesForDiscipline(disciplineId, officialDisciplineWeightLabels[disciplineId], slotCount);
      totalRoleSets += 1;
      if (roles.length !== slotCount) {
        pushIssue(issues, "error", "slots", "slot_role_count_invalid", `${disciplineId}: ${roles.length}/${slotCount} Rollen.`);
      }
      if (roles.some((role) => role.roleId.startsWith("generic-"))) fallbackRoleSets += 1;

      const profileTotals = Object.fromEntries(playerGeneratorAttributeKeys.map((attribute) => [attribute, 0])) as Record<string, number>;
      for (const role of roles) {
        const keyAttributes = role.keyAttributes ?? [];
        const profile = role.slotWeightProfile ?? role.baseWeightProfile ?? {};
        const sum = playerGeneratorAttributeKeys.reduce((total, attribute) => total + (profile[attribute] ?? 0), 0);
        if (Math.abs(sum - 100) > 0.6) {
          pushIssue(issues, "error", "slots", "slot_role_weight_sum_invalid", `${disciplineId}/${slotCount}: ${role.label} summiert auf ${round(sum, 1)} statt 100.`);
        }
        for (const attribute of playerGeneratorAttributeKeys) {
          profileTotals[attribute] = (profileTotals[attribute] ?? 0) + (profile[attribute] ?? 0);
        }
        for (const entry of keyAttributes) {
          const base = officialDisciplineWeightMatrix[disciplineId][entry.attribute] ?? 0;
          if (entry.weightPct > 0 && base <= 0) {
            keyAttributesWithZeroBase += 1;
            pushIssue(issues, "error", "slots", "slot_role_uses_zero_base_attribute", `${disciplineId}/${slotCount}: ${role.label} nutzt ${entry.attribute}, obwohl die Disziplin dort 0 hat.`);
          }
        }
      }

      const maxAverageDrift = Math.max(
        ...playerGeneratorAttributeKeys.map((attribute) => {
          const average = (profileTotals[attribute] ?? 0) / Math.max(roles.length, 1);
          const base = officialDisciplineWeightMatrix[disciplineId][attribute] ?? 0;
          return Math.abs(average - base);
        }),
      );
      rows.push({ disciplineId, slotCount, roles: roles.length, maxAverageDrift: round(maxAverageDrift, 2) });
      if (maxAverageDrift > 0.8) {
        pushIssue(issues, "warning", "slots", "slot_role_average_drift_high", `${disciplineId}/${slotCount}: Durchschnitt driftet ${round(maxAverageDrift, 2)} Punkte von der Basisgewichtung.`);
      }
    }
  }

  const weightliftingRoles = resolveSlotRolesForDiscipline("gewichtheben", "Gewichtheben", 2);
  const normal = calculateMatchdayProjectedPreview({
    baseScore: 70,
    role: weightliftingRoles[0],
    attributeStats: { power: 72, health: 68, stamina: 60, determination: 70 },
    currentFatigueCount: 4,
    intensity: "normal",
    rivalryPressure: 2,
  });
  const push = calculateMatchdayProjectedPreview({
    baseScore: 70,
    role: weightliftingRoles[0],
    attributeStats: { power: 72, health: 68, stamina: 60, determination: 70 },
    currentFatigueCount: 4,
    intensity: "push",
    rivalryPressure: 2,
  });
  if (normal.rivalryPressureModifier !== 0 || push.rivalryPressureModifier <= 0 || push.additionalFatigue <= normal.additionalFatigue) {
    pushIssue(issues, "error", "slots", "rivalry_pressure_projection_invalid", "Rivalitätsdruck greift nicht korrekt nur bei Push.");
  }

  return {
    totalRoleSets,
    fallbackRoleSets,
    keyAttributesWithZeroBase,
    maxAverageDrift: minMaxAvg(rows.map((row) => row.maxAverageDrift)),
    projectionCheck: {
      normalRivalryPressure: normal.rivalryPressureModifier,
      pushRivalryPressure: push.rivalryPressureModifier,
      normalAdditionalFatigue: normal.additionalFatigue,
      pushAdditionalFatigue: push.additionalFatigue,
      pushWarnings: push.warnings,
    },
    sampleRows: rows.filter((row) => row.slotCount === 6).slice(0, 20),
  };
}

function auditTeamPowersAndAi(gameState: GameState, saveId: string, seasonId: string, matchdayId: string, issues: AuditIssue[]) {
  let selectedPowers = 0;
  let teamsWithPowers = 0;
  let aiContextsLoaded = 0;
  let aiContextFailed = 0;
  let aiCaptainSelections = 0;
  let aiCaptainSelectionsWhenAvailable = 0;
  let aiDemandBonusSelections = 0;
  let aiDemandBonusCandidates = 0;
  const picks: AiPowerPickAudit[] = [];
  const balanceImpacts: number[] = [];
  const attributeFits: number[] = [];
  const captainAvailableGameState: GameState = {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      lineupDrafts: [],
    },
  };

  for (const team of gameState.teams) {
    const powers = getTeamPowerOptions({ gameState, seasonId, teamId: team.teamId }).filter((power) => power.selectedForSeason);
    selectedPowers += powers.length;
    if (powers.length > 0) teamsWithPowers += 1;
    const identityPowers = powers.filter((power) => power.source === "team_identity");
    const chargeSignature = identityPowers.map((power) => power.chargesTotal).sort((left, right) => left - right).join("/");
    if (identityPowers.length < 3 || chargeSignature !== "2/3/4") {
      pushIssue(issues, "error", "powers", "team_power_identity_charge_invalid", `${team.name}: Identity-Powers ${identityPowers.length}, Charges ${chargeSignature}.`, { teamId: team.teamId });
    }
    for (const power of powers) {
      if ((power.positiveAttributeTags ?? []).length !== 2 || !power.negativeAttributeTag) {
        pushIssue(issues, "error", "powers", "team_power_tags_missing", `${team.name}: ${power.label} hat unvollstaendige Tags.`, { teamId: team.teamId });
      }
      for (const disciplineId of officialDisciplineWeightOrder) {
        const disciplineCategory = gameState.disciplines.find((discipline) => discipline.id === disciplineId)?.category ?? null;
        const result = calculateTeamPowerModifierForSide({
          modifiers: buildSinglePowerModifiers("d1", power.id),
          disciplineSide: "d1",
          disciplineId,
          disciplineCategory,
          teamPowers: powers,
          conditionalBonusPct: 0,
        });
        balanceImpacts.push(result.teamPowerImpact);
        attributeFits.push(result.teamPowerAttributeFitPct);
      }
    }

    const contextResult = loadLocalLegacyLineupContextFromGameState(gameState, { saveId, seasonId, matchdayId, teamId: team.teamId });
    if (!contextResult.ok) {
      aiContextFailed += 1;
      pushIssue(issues, "warning", "powers", "lineup_context_failed", `${team.name}: Lineup-Kontext fuer AI-Power-Check konnte nicht geladen werden.`, { teamId: team.teamId });
      continue;
    }
    aiContextsLoaded += 1;
    const context = contextResult.context;
    const preview = buildAiLegacyLineupPreview(context, "sqlite");
    const modifiers = buildAiLegacyLineupModifiers(context, preview.entries);
    if (preview.d1.captainSelectionStatus === "selected") aiCaptainSelections += 1;
    if (preview.d2.captainSelectionStatus === "selected") aiCaptainSelections += 1;

    const captainAvailableContextResult = loadLocalLegacyLineupContextFromGameState(captainAvailableGameState, {
      saveId,
      seasonId,
      matchdayId,
      teamId: team.teamId,
    });
    if (captainAvailableContextResult.ok) {
      const captainAvailablePreview = buildAiLegacyLineupPreview(captainAvailableContextResult.context, "sqlite");
      if (captainAvailablePreview.d1.captainSelectionStatus === "selected") aiCaptainSelectionsWhenAvailable += 1;
      if (captainAvailablePreview.d2.captainSelectionStatus === "selected") aiCaptainSelectionsWhenAvailable += 1;
    }
    for (const reason of preview.debugReasoning) {
      const match = /demandBonus=([0-9.]+)/i.exec(reason);
      if (!match) continue;
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) {
        aiDemandBonusCandidates += 1;
      }
    }
    for (const reason of [...preview.d1.reasoning, ...preview.d2.reasoning]) {
      const match = /demandBonus=([0-9.]+)/i.exec(reason);
      if (!match) continue;
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) {
        aiDemandBonusSelections += 1;
      }
    }
    for (const side of ["d1", "d2"] as const) {
      const powerId = modifiers[side].teamPowerId ?? null;
      const discipline = getSideDiscipline(context, side);
      if (!powerId || !discipline) continue;
      const power = (context.teamPowers ?? []).find((entry) => entry.id === powerId) ?? null;
      if (!power) continue;
      const result = calculateTeamPowerModifierForSide({
        modifiers,
        disciplineSide: side,
        disciplineId: discipline.disciplineId,
        disciplineCategory: discipline.category,
        teamPowers: context.teamPowers ?? [],
        conditionalBonusPct: getConditionalBonusPct(context, discipline.disciplineId, power),
      });
      picks.push({
        teamId: team.teamId,
        teamCode: team.shortCode ?? team.teamId,
        side,
        disciplineId: discipline.disciplineId,
        disciplineName: discipline.displayName,
        powerLabel: power.label,
        effectType: power.effectType,
        targetMode: power.targetMode,
        basePct: result.teamPowerBasePct,
        conditionalPct: result.teamPowerConditionalPct,
        attributeFitPct: result.teamPowerAttributeFitPct,
        impactPct: result.teamPowerImpact,
        top8Rivals: context.teamPowerWindows?.[discipline.disciplineId]?.top8Rivals.length ?? 0,
      });
    }
  }

  const impact = minMaxAvg(balanceImpacts);
  const attributeFit = minMaxAvg(attributeFits);
  if (teamsWithPowers !== gameState.teams.length) {
    pushIssue(issues, "error", "powers", "team_power_coverage_incomplete", `Team-Powers ${teamsWithPowers}/${gameState.teams.length} Teams.`);
  }
  if (aiContextsLoaded > 0 && picks.length === 0) {
    pushIssue(issues, "error", "powers", "ai_team_power_selection_missing", "AI hat keine einzige Team-Power gewaehlt.");
  }
  if (aiContextsLoaded > 0 && aiCaptainSelections === 0 && aiCaptainSelectionsWhenAvailable === 0) {
    pushIssue(issues, "error", "lineup_ai", "ai_captain_selection_missing", "Lineup-AI waehlt selbst mit freien Captain-Slots keine Captains.");
  }
  if (aiDemandBonusCandidates > 0 && aiDemandBonusSelections === 0) {
    pushIssue(issues, "warning", "lineup_ai", "ai_demands_not_selected", "Spielerforderungen erzeugen Demand-Boni, landen im aktuellen Save aber in keinem ausgewaehlten AI-Slot.");
  }
  if (impact.max > 13 || attributeFit.min < -0.8 || attributeFit.max > 2) {
    pushIssue(issues, "error", "powers", "team_power_balance_out_of_range", `Power-Balance ausserhalb Range: Impact ${impact.min}-${impact.max}, Fit ${attributeFit.min}-${attributeFit.max}.`);
  }

  return {
    selectedPowers,
    teamsWithPowers,
    aiContextsLoaded,
    aiContextFailed,
    aiCaptainSelections,
    aiCaptainSelectionsWhenAvailable,
    aiDemandBonusCandidates,
    aiDemandBonusSelections,
    aiPowerPicks: picks.length,
    impact,
    attributeFit,
    topPicks: [...picks].sort((left, right) => right.impactPct - left.impactPct).slice(0, 12),
  };
}

function auditUiMarkers(repoRoot: string, issues: AuditIssue[]) {
  const checks = [
    {
      file: "app/foundation/FoundationPageClient.tsx",
      markers: ["home-board-objectives", "team-board-objectives", "getTeamGeneralManager", "selectTeamCaptain", "teamObjectiveOverview"],
    },
    {
      file: "app/foundation/TeamDetailDrawer.tsx",
      markers: ["General Manager", "Board Confidence", "Board & Führung", "Team Captain", "team-drawer-objective-grid"],
    },
    {
      file: "app/foundation/PlayerDetailDrawer.tsx",
      markers: ["Forderungen", "demands"],
    },
    {
      file: "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx",
      markers: ["buildLineupPlayerDemandMap", "Attribut-Fit", "Rivalitätsdruck", "formatTeamPowerOptionLabel", "slotRoleByKey"],
    },
    {
      file: "lib/lineups/legacy-lineup-types.ts",
      markers: ["teamPowerAttributeFitPct", "teamPowerWindows", "positiveAttributeTags"],
    },
  ];
  const rows: Array<{ file: string; marker: string; found: boolean }> = [];
  for (const check of checks) {
    const absolutePath = path.join(repoRoot, check.file);
    const content = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
    for (const marker of check.markers) {
      const found = content.includes(marker);
      rows.push({ file: check.file, marker, found });
      if (!found) {
        pushIssue(issues, "error", "ui", "ui_marker_missing", `${marker} fehlt in ${check.file}.`);
      }
    }
  }
  return {
    checked: rows.length,
    found: rows.filter((row) => row.found).length,
    rows,
  };
}

function buildMarkdown(input: {
  status: "passed" | "failed";
  generatedAt: string;
  scope: { saveId: string; seasonId: string; matchdayId: string; teams: number };
  audits: Record<string, unknown>;
  issues: AuditIssue[];
}) {
  const errors = input.issues.filter((issue) => issue.severity === "error");
  const warnings = input.issues.filter((issue) => issue.severity === "warning");
  const aiTopPicks = (input.audits.powers as { topPicks?: AiPowerPickAudit[] }).topPicks ?? [];
  const issueLines = input.issues.length
    ? input.issues.map((issue) => `- ${issue.severity.toUpperCase()} [${issue.system}] ${issue.code}: ${issue.message}`)
    : ["- Keine Fehler oder Warnungen."];

  return [
    "# New Management Systems Audit",
    "",
    `Status: ${input.status.toUpperCase()}`,
    `Erstellt: ${input.generatedAt}`,
    `Save: ${input.scope.saveId}`,
    `Season: ${input.scope.seasonId}`,
    `Matchday: ${input.scope.matchdayId}`,
    `Teams: ${input.scope.teams}`,
    "",
    "## Kurzfazit",
    "",
    `- Fehler/Warnungen: ${errors.length}/${warnings.length}`,
    `- GMs: ${(input.audits.gms as { assignments: number }).assignments}/${input.scope.teams} Teams, ${(input.audits.gms as { profileCount: number }).profileCount} Profile`,
    `- Boardziele: ${(input.audits.board as { objectiveCount: number }).objectiveCount} Ziele, ${(input.audits.board as { boardConfidenceCount: number }).boardConfidenceCount} Board-Ratings`,
    `- Management-AI: ${(input.audits.managementAi as { teams: number }).teams} Teamplaene, ${(input.audits.managementAi as { teamsWithBoardPressureApplied: number }).teamsWithBoardPressureApplied}x Boarddruck aktiv`,
    `- Spielerforderungen: ${(input.audits.demandsAndCaptains as { totalDemands: number }).totalDemands} Forderungen`,
    `- Teamcaptains: ${(input.audits.demandsAndCaptains as { captainCount: number }).captainCount}/${input.scope.teams}`,
    `- Rivalries: ${(input.audits.rivalries as { ledgerEntries: number }).ledgerEntries} Ledger-Eintraege`,
    `- Slotrollen: ${(input.audits.slots as { totalRoleSets: number }).totalRoleSets} Rollen-Sets, Drift ${(input.audits.slots as { maxAverageDrift: { max: number } }).maxAverageDrift.max}`,
    `- Powers/Lineup-AI: ${(input.audits.powers as { aiPowerPicks: number }).aiPowerPicks} Power-Picks, ${(input.audits.powers as { aiCaptainSelections: number; aiCaptainSelectionsWhenAvailable: number }).aiCaptainSelections} aktuelle Captain-Picks (${(input.audits.powers as { aiCaptainSelectionsWhenAvailable: number }).aiCaptainSelectionsWhenAvailable} bei freien Slots), ${(input.audits.powers as { aiDemandBonusSelections: number }).aiDemandBonusSelections} Demand-Bonus-Slots`,
    `- UI-Marker: ${(input.audits.ui as { found: number }).found}/${(input.audits.ui as { checked: number }).checked}`,
    "",
    "## Top AI Power Picks",
    "",
    aiTopPicks.length ? "| Team | Seite | Disziplin | Power | Impact | Basis | Extra | Fit | Rivalen |" : "_Keine Picks._",
    ...(aiTopPicks.length
      ? [
          "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
          ...aiTopPicks.map(
            (pick) =>
              `| ${pick.teamCode} | ${pick.side.toUpperCase()} | ${pick.disciplineName} | ${pick.powerLabel} | ${pick.impactPct}% | ${pick.basePct}% | ${pick.conditionalPct}% | ${pick.attributeFitPct}% | ${pick.top8Rivals} |`,
          ),
        ]
      : []),
    "",
    "## Issues",
    "",
    ...issueLines,
    "",
    "## Output",
    "",
    "- `new-management-systems-audit.json`",
    "- `new-management-systems-audit.md`",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, "..");
  const outDir = path.resolve(repoRoot, args.outDir);
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = (args.saveId ? persistence.getSaveById(args.saveId) : null) ?? persistence.getActiveSave() ?? bootstrapped.save;
  const seasonId = args.seasonId || save.gameState.season.id;
  const matchdayId = args.matchdayId || save.gameState.matchdayState.matchdayId;
  const issues: AuditIssue[] = [];
  const gameState = normalizeAuditGameState(save.gameState, save.saveId, seasonId);

  const audits = {
    gms: auditGeneralManagers(gameState, issues),
    board: auditBoardObjectives(gameState, issues),
    managementAi: auditManagementAiActiveUsage(gameState, issues),
    demandsAndCaptains: auditDemandsAndCaptains(gameState, issues),
    rivalries: auditRivalries(gameState, issues),
    slots: auditSlotRoles(issues),
    powers: auditTeamPowersAndAi(gameState, save.saveId, seasonId, matchdayId, issues),
    ui: auditUiMarkers(repoRoot, issues),
  };
  const status = issues.some((issue) => issue.severity === "error") ? "failed" : "passed";
  const generatedAt = new Date().toISOString();
  const payload = {
    status,
    generatedAt,
    scope: {
      saveId: save.saveId,
      seasonId,
      matchdayId,
      teams: gameState.teams.length,
    },
    audits,
    issues,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "new-management-systems-audit.json"), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(outDir, "new-management-systems-audit.md"), buildMarkdown(payload));

  console.log(`New management systems audit: ${status}`);
  console.log(`Report: ${path.join(outDir, "new-management-systems-audit.md")}`);
  console.log(`Issues: ${issues.filter((issue) => issue.severity === "error").length} errors, ${issues.filter((issue) => issue.severity === "warning").length} warnings`);
  console.log(`GM profiles: ${audits.gms.profileCount}, Board objectives: ${audits.board.objectiveCount}, AI power picks: ${audits.powers.aiPowerPicks}`);

  if (status === "failed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
