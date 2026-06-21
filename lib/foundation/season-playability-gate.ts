import type { GameState } from "@/lib/data/olyDataTypes";
import { buildGameFlowState, type GameFlowStep } from "@/lib/foundation/game-flow-controller";

export type SeasonPlayabilityWarningSeverity = "blocker" | "audit_hint" | "known_data_gap";

export type SeasonPlayabilityWarningClassification = {
  warning: string;
  key: string;
  severity: SeasonPlayabilityWarningSeverity;
  quiet: boolean;
  label: string;
};

export type SeasonPlayabilityGate = {
  status: "passed" | "blocked";
  blockers: SeasonPlayabilityWarningClassification[];
  auditHints: SeasonPlayabilityWarningClassification[];
  knownDataGaps: SeasonPlayabilityWarningClassification[];
  flow: {
    phase: string;
    currentStepId: string;
    currentStepStatus: string;
    currentStepTarget: string;
    blockedSteps: string[];
    milestoneChecks: Array<{
      stepId: string;
      present: boolean;
      targetView: string | null;
      expectedTargetView: string;
    }>;
  };
};

const KNOWN_DATA_GAP_LABELS: Record<string, string> = {
  class_factors_source_missing:
    "Bekannte Datenluecke: Klassenfaktoren fehlen noch als echte Quelle; Generator/Progression nutzen den heuristischen Fallback.",
  class_factors_source_incomplete:
    "Bekannte Datenluecke: Klassenfaktoren sind unvollstaendig; Generator/Progression nutzen den heuristischen Fallback.",
  attribute_salary_modifiers_source_missing:
    "Bekannte Datenluecke: Attribut-Gehaltsfaktoren fehlen als Quelle.",
  trait_salary_factors_source_missing:
    "Bekannte Datenluecke: Trait-Gehaltsfaktoren fehlen als Quelle.",
  rank_to_discipline_market_value_source_missing:
    "Bekannte Datenluecke: Rank-zu-Marktwert-Quelle fehlt.",
  rank_to_discipline_market_value_source_incomplete:
    "Bekannte Datenluecke: Rank-zu-Marktwert-Quelle ist unvollstaendig.",
  salary_engine_waits_for_market_value_input:
    "Bekannte Datenluecke: Salary-Forecast wartet auf den finalen Marktwert-Input.",
};

const BLOCKER_KEYS = new Set([
  "matchday_results_source_missing",
  "standings_source_missing",
  "board_objective_settlement_missing",
  "xp_development_before_after_snapshot_missing",
  "season_consequences_missing",
  "season_snapshot_missing",
  "missing_lineup",
  "missing_results",
  "no_active_team",
]);

const AUDIT_HINT_LABELS: Record<string, string> = {
  team_power_debuff: "Team-Power-Debuff wurde angewendet; nur Balance-/Audit-Hinweis, kein Flow-Blocker.",
  transfer_history_empty_in_block_smoke:
    "Block-Smoke hatte keine Transfers; fuer den Season-Loop okay, fuer Economy-Balancing weiter beobachten.",
  ai_audit_team_warnings:
    "AI-Audit hat teambezogene Hinweise; Gesamtnutzung wird separat geprueft.",
  ai_captain_unused: "Einzelne AI-Teams haben keine Captains genutzt; als Planungs-/Balancing-Hinweis verfolgen.",
  ai_push_unused: "Einzelne AI-Teams haben keinen Push genutzt; als Planungs-/Balancing-Hinweis verfolgen.",
  ai_form_cards_unused: "Einzelne AI-Teams haben keine Formkarten genutzt; als Planungs-/Balancing-Hinweis verfolgen.",
  ai_mutators_unused: "Einzelne AI-Teams haben keine Mutatoren genutzt; als Planungs-/Balancing-Hinweis verfolgen.",
  start_rank_derived_from_season1_start_budget:
    "Preisgeld nutzt fuer Season 1 den Startbudget-Rang als Fallback; fuer Playtest okay, Economy-Balancing weiter beobachten.",
  promised_role_usage_gap: "Promised-Role-Gap im Review; Konsequenz-Hinweis, kein technischer Blocker.",
  missing_formcards: "Formkarten fehlen fuer den aktuellen Draft; Hinweis im Planungsflow.",
  empty_roster: "Kader ist leer; im New-Game-Flow fuehrt das in Briefing/Markt statt zum harten Fehler.",
  next_season_apply_requires_preseason_confirm:
    "Neue Saison wird bewusst nur ueber den bestaetigten Pre-Season Workflow gestartet.",
  uses_existing_prize_facility_cash_sources_only:
    "Season-Rewards nutzen aktuell die vorhandenen Preisgeld-/Facility-Cash-Quellen; fuer Economy-Balancing weiter beobachten.",
  preview_only_no_attribute_writes:
    "Player-Development ist im Transition-Schritt als Preview markiert; echte Attribut-Writes laufen ueber Progression-Events.",
  human_teams_manual_only:
    "Sell-Phase bleibt fuer Human-Teams manuell; AI-Teams laufen ueber ihre eigenen Auto-Entscheidungen.",
  buy_after_sell_only:
    "Buy-Phase startet bewusst nach Sell/Contract, damit Roster- und Budgetdruck nicht vermischt wird.",
};

function warningKey(warning: string) {
  const parts = warning.split(":");
  const firstPart = parts[0]?.trim() || warning.trim();
  if (/^[A-Z]-[A-Z]$/.test(firstPart) && parts[1]) {
    return parts[1].trim();
  }
  return firstPart;
}

function blockerLabel(key: string) {
  if (key === "no_active_team") return "Kein aktives Team gesetzt; Flow kann nicht sauber fortfahren.";
  if (key === "missing_lineup") return "Lineup fehlt; Spieltag darf nicht fortgesetzt werden.";
  if (key === "missing_results") return "Spieltagsergebnis fehlt; Season-Fortschritt darf nicht weiterlaufen.";
  if (key === "season_consequences_missing") return "Season-Konsequenzen fehlen im Review-State.";
  if (key === "season_snapshot_missing") return "Season-Snapshot fehlt; Seasonabschluss ist nicht nachvollziehbar.";
  if (key.includes("lineup") && key.includes("missing")) return "Lineup-Quelle fehlt; Spieltag nicht spielbar.";
  if (key.includes("result") && key.includes("missing")) return "Resultat-Quelle fehlt; Seasonabschluss nicht belastbar.";
  return `Echter Blocker: ${key}`;
}

export function classifySeasonPlayabilityWarning(warning: string): SeasonPlayabilityWarningClassification {
  const key = warningKey(warning);

  if (BLOCKER_KEYS.has(key)) {
    return {
      warning,
      key,
      severity: "blocker",
      quiet: false,
      label: blockerLabel(key),
    };
  }

  if (KNOWN_DATA_GAP_LABELS[key]) {
    return {
      warning,
      key,
      severity: "known_data_gap",
      quiet: true,
      label: KNOWN_DATA_GAP_LABELS[key],
    };
  }

  if (AUDIT_HINT_LABELS[key]) {
    return {
      warning,
      key,
      severity: "audit_hint",
      quiet: key === "team_power_debuff",
      label: AUDIT_HINT_LABELS[key],
    };
  }

  if (key.endsWith("_source_missing") || key.endsWith("_source_incomplete")) {
    return {
      warning,
      key,
      severity: "known_data_gap",
      quiet: true,
      label: `Bekannte Datenquelle klaeren: ${key}`,
    };
  }

  if (key.includes("missing") || key.includes("blocked") || key.includes("invalid") || key.includes("failed")) {
    return {
      warning,
      key,
      severity: "blocker",
      quiet: false,
      label: blockerLabel(key),
    };
  }

  return {
    warning,
    key,
    severity: "audit_hint",
    quiet: false,
    label: `Audit-Hinweis: ${key}`,
  };
}

function collectUniqueWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter((warning) => warning.trim().length > 0)));
}

function checkMilestone(steps: GameFlowStep[], stepId: string, expectedTargetView: string) {
  const step = steps.find((entry) => entry.stepId === stepId) ?? null;
  return {
    stepId,
    present: Boolean(step),
    targetView: step?.targetView ?? null,
    expectedTargetView,
  };
}

export function buildSeasonPlayabilityGate(input: {
  gameState: GameState;
  activeTeamId?: string | null;
  warnings?: string[];
}): SeasonPlayabilityGate {
  const flow = buildGameFlowState({
    gameState: input.gameState,
    activeTeamId: input.activeTeamId ?? input.gameState.seasonState.newGameFlow?.selectedTeamId ?? input.gameState.teams[0]?.teamId ?? null,
  });
  const flowWarnings = [
    ...flow.warnings,
    ...(flow.currentStep.status === "blocked" ? flow.currentStep.blockers : []),
  ];
  const classificationsByKey = new Map<string, SeasonPlayabilityWarningClassification>();
  for (const classification of collectUniqueWarnings([...(input.warnings ?? []), ...flowWarnings]).map(
    classifySeasonPlayabilityWarning,
  )) {
    if (!classificationsByKey.has(classification.key)) {
      classificationsByKey.set(classification.key, classification);
    }
  }
  const classifications = [...classificationsByKey.values()];
  const blockers = classifications.filter((entry) => entry.severity === "blocker");
  const auditHints = classifications.filter((entry) => entry.severity === "audit_hint");
  const knownDataGaps = classifications.filter((entry) => entry.severity === "known_data_gap");

  return {
    status: blockers.length > 0 ? "blocked" : "passed",
    blockers,
    auditHints,
    knownDataGaps,
    flow: {
      phase: flow.phase,
      currentStepId: flow.currentStepId,
      currentStepStatus: flow.currentStep.status,
      currentStepTarget: flow.currentStep.targetPanel
        ? `${flow.currentStep.targetView}:${flow.currentStep.targetPanel}`
        : flow.currentStep.targetView,
      blockedSteps: flow.blockedSteps,
      milestoneChecks: [
        checkMilestone(flow.steps, "season_intro", "home"),
        checkMilestone(flow.steps, "buy_players", "market"),
        checkMilestone(flow.steps, flow.steps.some((step) => step.stepId === "check_training") ? "check_training" : "set_training", "trainingV2"),
        checkMilestone(flow.steps, "set_lineup", "lineup"),
        checkMilestone(flow.steps, "open_arena", "matchdayArena"),
        checkMilestone(flow.steps, "review_previous_season", "cockpit"),
      ],
    },
  };
}
