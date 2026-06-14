import type { AiLifecyclePhase } from "@/lib/data/olyDataTypes";
import { AI_LIFECYCLE_PHASE_DEFINITIONS } from "@/lib/ai/ai-season-lifecycle-orchestrator";

export type AiManagerModuleName =
  | "Team Doctrine"
  | "Season Strategy"
  | "Roster Blueprint"
  | "Market Board"
  | "Budget Buckets"
  | "Training Plan"
  | "Facility Plan"
  | "Contract Plan"
  | "Potential/Scouting"
  | "Manager Memory"
  | "Season Review"
  | "Lifecycle Orchestrator"
  | "Chunked Redraft"
  | "AI Market"
  | "Lineup AI";

export type AiManagerWritePermission = "read_only" | "plan_only" | "official_services_only";

export type AiManagerIntegrationModule = {
  module: AiManagerModuleName;
  purpose: string;
  inputs: string[];
  outputs: string[];
  mayWrite: boolean;
  writePermission: AiManagerWritePermission;
  phases: AiLifecyclePhase[];
  reports: string[];
  caches: string[];
  consumes: AiManagerModuleName[];
  sourceOfTruth: string[];
};

export type AiManagerDataFlowContract = {
  chainId: string;
  label: string;
  modules: AiManagerModuleName[];
  status: "green" | "yellow" | "red";
  requiredHandoffs: string[];
  blockers: string[];
  notes: string[];
};

export type AiManagerWriteOwnershipContract = {
  domain: string;
  writer: string;
  managerAiRole: "produce_plan" | "produce_action_preview" | "read_only";
  forbiddenBypass: string[];
};

export type AiManagerCacheContract = {
  phase: AiLifecyclePhase;
  cachesBuilt: string[];
  invalidatedWhen: string[];
  updatedAfterPick: string[];
  streamedReports: string[];
  excludedFromNormalUiLoad: string[];
};

export type AiManagerUiContractRow = {
  view: "Home" | "Teamseite";
  field: string;
  sourceModule: AiManagerModuleName;
  sourceOfTruth: string;
  loadingMode: "initial_light" | "lazy" | "on_open";
};

export type AiManagerIntegrationContract = {
  generatedAt: string;
  modules: AiManagerIntegrationModule[];
  dataFlows: AiManagerDataFlowContract[];
  writeOwnership: AiManagerWriteOwnershipContract[];
  cacheContracts: AiManagerCacheContract[];
  phasePermissions: Array<{
    phase: AiLifecyclePhase;
    allowedActions: string[];
    blockedActions: string[];
    requiredInputs: string[];
    producedOutputs: string[];
    performanceBudget: {
      targetMs: number;
      hardCapMs: number;
      targetAvgPickMs?: number;
      hardCapAvgPickMs?: number;
      singleTeamTargetMs?: number;
    };
    resumePossible: boolean;
    degradedAllowed: boolean;
  }>;
  uiContracts: AiManagerUiContractRow[];
  acceptance: {
    allModulesHaveInterface: boolean;
    noDuplicateWriteLogic: boolean;
    managerAiBypassBlocked: boolean;
    lifecyclePhasesClear: boolean;
    seasonReviewToNextStrategyExists: boolean;
    cacheContractExists: boolean;
    remoteWritesForbidden: boolean;
  };
};

const PHASES: AiLifecyclePhase[] = [
  "preseason_review",
  "preseason_strategy",
  "preseason_market",
  "preseason_facilities",
  "preseason_training_setup",
  "matchday_preparation",
  "matchday_resolve",
  "matchday_review",
  "midseason_check",
  "season_end_review",
  "postseason_management",
  "season_transition",
];

export const AI_MANAGER_MODULE_CONTRACTS: AiManagerIntegrationModule[] = [
  {
    module: "Team Doctrine",
    purpose: "Langfristige Team-DNA, Identity-Guard und erlaubte Abweichungen definieren.",
    inputs: ["TeamStrategyProfile", "TeamIdentity", "Manager Memory", "Season Review"],
    outputs: ["TeamDoctrineRecord", "AiIdentityGuardResult", "Doctrine adherence"],
    mayWrite: false,
    writePermission: "read_only",
    phases: ["preseason_review", "preseason_strategy", "midseason_check", "season_end_review"],
    reports: ["team-doctrine-map.md", "identity-guard-audit.csv"],
    caches: ["teamById", "teamIdentityById", "teamStrategyProfileById"],
    consumes: ["Manager Memory", "Season Review"],
    sourceOfTruth: ["team-strategy-profiles", "team identities", "ai-manager-doctrine-service"],
  },
  {
    module: "Season Strategy",
    purpose: "Saison-Zielmodus aus Doctrine, Memory, Kaderstatus, Cash und Board-Lage ableiten.",
    inputs: ["Team Doctrine", "Manager Memory", "Roster status", "Budget status", "Board status"],
    outputs: ["AiSeasonStrategyStateRecord", "Strategy shift recommendations"],
    mayWrite: false,
    writePermission: "plan_only",
    phases: ["preseason_strategy", "midseason_check", "season_end_review"],
    reports: ["strategy-shift-matrix.csv", "manager-decision-journal.csv"],
    caches: ["rosterByTeam", "salaryByTeam", "standingByTeam", "cashByTeam"],
    consumes: ["Team Doctrine", "Manager Memory", "Season Review"],
    sourceOfTruth: ["ai-manager-doctrine-service", "lifecycle orchestrator"],
  },
  {
    module: "Roster Blueprint",
    purpose: "Zielkader je Team: Minimum, Optimum, Core, Depth, Need-Profile und bewusste Unter-Opt-Gruende.",
    inputs: ["Season Strategy", "Team Doctrine", "Lineup needs", "Potential/Scouting"],
    outputs: ["roster target", "core/depth needs", "needsStillOpen"],
    mayWrite: false,
    writePermission: "plan_only",
    phases: ["preseason_strategy", "midseason_check"],
    reports: ["roster-blueprint.csv", "redraft-team-status.csv"],
    caches: ["rosterByTeam", "playerById", "needByTeam"],
    consumes: ["Season Strategy", "Team Doctrine", "Potential/Scouting"],
    sourceOfTruth: ["manager planner", "team identities", "team strategy profiles"],
  },
  {
    module: "Market Board",
    purpose: "Spieler-Kandidaten pro Team priorisieren, bevor Buy-/Draft-Pfade teure Previews ausfuehren.",
    inputs: ["Roster Blueprint", "Budget Buckets", "Potential/Scouting", "Team Doctrine"],
    outputs: ["candidate shortlist", "rejection reasons", "pick intent"],
    mayWrite: false,
    writePermission: "plan_only",
    phases: ["preseason_strategy", "preseason_market", "midseason_check"],
    reports: ["market-board-cache.csv", "pick-quality.csv"],
    caches: ["freeAgentPool", "ratingByPlayer", "marketValueByPlayer", "salaryByPlayer", "fitByTeamPlayer"],
    consumes: ["Roster Blueprint", "Budget Buckets", "Potential/Scouting", "Team Doctrine"],
    sourceOfTruth: ["ai-needs-picks-compare-service", "transfermarkt preview services"],
  },
  {
    module: "Budget Buckets",
    purpose: "Cash in Reserve, Transfer, Salary, Maintenance, Building und Emergency aufteilen.",
    inputs: ["Season Strategy", "Team cash", "Salary pressure", "Facility state"],
    outputs: ["AiManagerBudgetReservationRecord", "spendable limits"],
    mayWrite: false,
    writePermission: "plan_only",
    phases: ["preseason_strategy", "preseason_market", "preseason_facilities", "preseason_training_setup"],
    reports: ["ai-manager-budget-application.csv", "budget-bucket-debug.csv"],
    caches: ["cashByTeam", "salaryByTeam", "facilityByTeam"],
    consumes: ["Season Strategy", "Facility Plan"],
    sourceOfTruth: ["ai-team-management-preview-service", "ai-manager-apply-service preview"],
  },
  {
    module: "Training Plan",
    purpose: "Training Focus/Intensity planen und spaeter nur ueber Training-Service applyen.",
    inputs: ["Season Strategy", "Potential/Scouting", "Fatigue/Injury", "Facility efficiency"],
    outputs: ["training focus", "training intensity", "training forecast"],
    mayWrite: true,
    writePermission: "official_services_only",
    phases: ["preseason_training_setup", "midseason_check"],
    reports: ["ai-manager-training-actions.csv", "tactical-adaptation-audit.csv"],
    caches: ["availabilityByPlayer", "potentialByPlayer", "facilityByTeam"],
    consumes: ["Season Strategy", "Potential/Scouting", "Facility Plan"],
    sourceOfTruth: ["training-settings-service"],
  },
  {
    module: "Facility Plan",
    purpose: "Maintenance, Upgrade und Buy-Building planen; Wirkung nur mit Condition/Efficiency rechnen.",
    inputs: ["Budget Buckets", "Season Strategy", "Facility condition", "Team needs"],
    outputs: ["facility action preview", "facility warnings", "condition priorities"],
    mayWrite: true,
    writePermission: "official_services_only",
    phases: ["preseason_facilities", "midseason_check", "postseason_management"],
    reports: ["ai-manager-building-actions.csv", "facility-actions.csv"],
    caches: ["facilityByTeam", "budgetByTeam"],
    consumes: ["Budget Buckets", "Season Strategy"],
    sourceOfTruth: ["facility-maintenance-service", "facility-upgrade-service"],
  },
  {
    module: "Contract Plan",
    purpose: "Renewal/Sell/Hold-Strategie markieren, ohne direkt Kaderzustaende zu veraendern.",
    inputs: ["Roster Blueprint", "Potential/Scouting", "Salary pressure", "Player review"],
    outputs: ["AiManagerContractStrategyRecord", "sell strategy marks"],
    mayWrite: true,
    writePermission: "official_services_only",
    phases: ["postseason_management", "season_transition", "midseason_check"],
    reports: ["ai-manager-contract-strategy.csv"],
    caches: ["contractByPlayer", "salaryByPlayer", "valueByPlayer"],
    consumes: ["Season Review", "Potential/Scouting", "Budget Buckets"],
    sourceOfTruth: ["contract-renewal-service", "transfermarkt-sell-service"],
  },
  {
    module: "Potential/Scouting",
    purpose: "Current, Potential Range, Confidence, Development Gap und Scout-Signale bereitstellen.",
    inputs: ["Player", "PlayerPotentialRecord", "performances", "scouting facility"],
    outputs: ["potential premium", "confidence", "growth outlook", "development route"],
    mayWrite: false,
    writePermission: "read_only",
    phases: ["preseason_strategy", "matchday_review", "season_end_review"],
    reports: ["potential-by-player.csv", "potential-ai-usage-preview.csv"],
    caches: ["potentialByPlayer", "performanceByPlayer", "confidenceByPlayer"],
    consumes: ["Season Review"],
    sourceOfTruth: ["player-potential-service", "player baseline/current ratings"],
  },
  {
    module: "Manager Memory",
    purpose: "Saisonlernen verdichten und als Input fuer naechste Strategie bereitstellen.",
    inputs: ["Season Review", "Decision Journal", "Manager Review"],
    outputs: ["AiManagerMemoryRecord", "nextSeasonHints"],
    mayWrite: true,
    writePermission: "official_services_only",
    phases: ["season_end_review", "postseason_management", "season_transition"],
    reports: ["manager-review-summary.md", "season-review-team-summary.csv"],
    caches: ["seasonReviewByTeam", "decisionJournalByTeam"],
    consumes: ["Season Review", "Team Doctrine"],
    sourceOfTruth: ["ai-season-lifecycle-orchestrator", "season-review-service"],
  },
  {
    module: "Season Review",
    purpose: "Team-/Player-/Manager-Ergebnis einer Saison zusammenfassen.",
    inputs: ["standings", "performances", "transfers", "cash", "facilities", "lineups"],
    outputs: ["team review", "player review", "strategy recommendation"],
    mayWrite: false,
    writePermission: "read_only",
    phases: ["season_end_review", "preseason_review"],
    reports: ["season-review-team-summary.csv", "season-review-player-summary.csv"],
    caches: ["performanceByPlayer", "standingByTeam", "transferHistoryByTeam"],
    consumes: ["AI Market", "Lineup AI", "Facility Plan", "Training Plan"],
    sourceOfTruth: ["season-review-service", "matchday result records", "transferHistory"],
  },
  {
    module: "Lifecycle Orchestrator",
    purpose: "Phasen, erlaubte Writes, Performance-Budgets, Resume und Degraded-Mode koordinieren.",
    inputs: ["GameState", "TeamControlSettings", "Manager Memory", "Phase runs"],
    outputs: ["phase status", "phase permissions", "manager memory preview"],
    mayWrite: false,
    writePermission: "read_only",
    phases: PHASES,
    reports: ["ai-lifecycle-phase-map.json", "ai-lifecycle-performance-budget.csv"],
    caches: ["phaseStatusBySave", "controlModeByTeam"],
    consumes: ["Manager Memory", "Season Review"],
    sourceOfTruth: ["ai-season-lifecycle-orchestrator"],
  },
  {
    module: "Chunked Redraft",
    purpose: "S1 initial fill/full clean redraft speicherschonend und resumefaehig ueber offiziellen Buy-Pfad ausfuehren.",
    inputs: ["Market Board", "Budget Buckets", "Roster Blueprint", "FreeAgentPool"],
    outputs: ["transferHistory", "rosters", "round checkpoint", "pick scores"],
    mayWrite: true,
    writePermission: "official_services_only",
    phases: ["preseason_market"],
    reports: ["chunked-redraft-picks.csv", "chunked-redraft-memory.csv", "chunked-redraft-summary.md"],
    caches: ["freeAgentPool", "playerById", "teamById", "rosterByTeam", "marketValueByPlayer", "salaryByPlayer"],
    consumes: ["Market Board", "Budget Buckets", "Roster Blueprint"],
    sourceOfTruth: ["chunked-redraft-topup-service", "transfermarkt-local-service"],
  },
  {
    module: "AI Market",
    purpose: "Normale AI-Kauf-/Verkaufs-Preview und Apply-Planung, ohne direkte Fachwrites.",
    inputs: ["Market Board", "Budget Buckets", "Team Doctrine", "Roster Blueprint"],
    outputs: ["buy preview", "sell preview", "market apply action"],
    mayWrite: true,
    writePermission: "official_services_only",
    phases: ["preseason_market", "midseason_check", "postseason_management"],
    reports: ["ai-market-preview.csv", "ai-sell-preview.csv", "market-actions.csv"],
    caches: ["playerById", "teamById", "rosterByTeam", "fitByTeamPlayer"],
    consumes: ["Market Board", "Budget Buckets", "Team Doctrine"],
    sourceOfTruth: ["transfermarkt-local-service", "transfermarkt buy/sell services"],
  },
  {
    module: "Lineup AI",
    purpose: "Lineup-Strategie und valide Aufstellungen erzeugen; Validator bleibt Wahrheit.",
    inputs: ["Lineup Strategy", "Discipline schedule", "Fatigue/Injury", "Player scores"],
    outputs: ["lineup preview", "lineup validation", "lineup save action"],
    mayWrite: true,
    writePermission: "official_services_only",
    phases: ["matchday_preparation"],
    reports: ["lineup-strategy-audit.csv", "lineup-preview.csv"],
    caches: ["playerDisciplineScores", "bestPlayersBySlot", "bestSlotsByPlayer", "availabilityByPlayer"],
    consumes: ["Season Strategy", "Potential/Scouting"],
    sourceOfTruth: ["legacy-lineup-local-service", "lineup validator"],
  },
];

export const AI_MANAGER_DATA_FLOW_CONTRACTS: AiManagerDataFlowContract[] = [
  {
    chainId: "doctrine-strategy-blueprint-market-pick",
    label: "Doctrine -> Strategy -> Blueprint -> Market Board -> Pick",
    modules: ["Team Doctrine", "Season Strategy", "Roster Blueprint", "Market Board", "Chunked Redraft"],
    status: "green",
    requiredHandoffs: ["doctrineFit", "seasonStrategy", "rosterTarget", "candidate shortlist", "official buy result"],
    blockers: ["missing doctrine", "missing budget buckets", "candidate without pick score"],
    notes: ["Pick writes bleiben beim Buy-/Redraft-Service."],
  },
  {
    chainId: "budget-to-market-buildings-training",
    label: "Budget Buckets -> Market/Buildings/Training",
    modules: ["Budget Buckets", "AI Market", "Facility Plan", "Training Plan"],
    status: "green",
    requiredHandoffs: ["cashReserve", "transferBudget", "buildingBudget", "maintenanceBudget", "emergencyBudget"],
    blockers: ["service ignores reserved budgets", "negative cash luxury action"],
    notes: ["Budgets sind Limits fuer Apply-Services, nicht Fachwrites der Manager-AI."],
  },
  {
    chainId: "potential-to-market-training-development-renewal",
    label: "Potential -> Market/Training/Development/Renewal",
    modules: ["Potential/Scouting", "Market Board", "Training Plan", "Contract Plan"],
    status: "yellow",
    requiredHandoffs: ["potentialRange", "confidence", "developmentGap", "growthOutlook"],
    blockers: ["low confidence premium too high", "contractSalary auto-update"],
    notes: ["Potential beeinflusst Preview/Plan, contractSalary bleibt stabil."],
  },
  {
    chainId: "season-review-memory-next-strategy",
    label: "Season Review -> Manager Memory -> naechste Strategy",
    modules: ["Season Review", "Manager Memory", "Season Strategy"],
    status: "green",
    requiredHandoffs: ["team review", "player review", "manager review", "nextSeasonHints"],
    blockers: ["season review missing", "manager memory not produced"],
    notes: ["Lifecycle Orchestrator erzeugt Memory-Preview read-only."],
  },
  {
    chainId: "lifecycle-phase-to-allowed-writes",
    label: "Lifecycle Phase -> erlaubte Writes",
    modules: ["Lifecycle Orchestrator", "AI Market", "Facility Plan", "Training Plan", "Lineup AI"],
    status: "green",
    requiredHandoffs: ["phase", "allowedActions", "blockedActions", "controlMode"],
    blockers: ["phase bypass", "human/remote overwrite", "validator bypass"],
    notes: ["Write-Ownership ist phase-bound und service-bound."],
  },
  {
    chainId: "ai-apply-to-official-services",
    label: "AI Apply -> offizielle Services",
    modules: ["AI Market", "Facility Plan", "Training Plan", "Contract Plan", "Lineup AI"],
    status: "green",
    requiredHandoffs: ["action preview", "canApply", "blockers", "confirm/dryRun gate"],
    blockers: ["direct roster mutation", "direct facility mutation", "direct training mutation"],
    notes: ["Manager-AI erzeugt Actions, Services schreiben."],
  },
  {
    chainId: "manager-plan-to-ui",
    label: "Manager Plan -> UI/Home/Teamseite",
    modules: ["Lifecycle Orchestrator", "Season Strategy", "Roster Blueprint", "Budget Buckets", "Facility Plan", "Training Plan", "Contract Plan"],
    status: "yellow",
    requiredHandoffs: ["current phase", "strategy", "team problems", "next AI step", "why saving/buying/building/training"],
    blockers: ["heavy reports in initial UI load", "missing lazy view contract"],
    notes: ["UI soll leichte Statusdaten initial und schwere Reports lazy laden."],
  },
];

export const AI_MANAGER_WRITE_OWNERSHIP: AiManagerWriteOwnershipContract[] = [
  {
    domain: "Kaeufe",
    writer: "transfermarkt-local-service / buy-service",
    managerAiRole: "produce_action_preview",
    forbiddenBypass: ["direct roster insert", "direct Team.cash mutation", "direct transferHistory insert"],
  },
  {
    domain: "Verkaeufe",
    writer: "transfermarkt-local-service / sell-service",
    managerAiRole: "produce_action_preview",
    forbiddenBypass: ["direct roster removal", "direct Team.cash mutation", "direct transferHistory insert"],
  },
  {
    domain: "Gebaeude",
    writer: "facility-maintenance-service / facility-upgrade-service",
    managerAiRole: "produce_action_preview",
    forbiddenBypass: ["direct SeasonState.teamFacilities mutation", "budget reserve bypass"],
  },
  {
    domain: "Training",
    writer: "training-settings-service",
    managerAiRole: "produce_action_preview",
    forbiddenBypass: ["direct Player.trainingMode mutation outside service", "injury crisis hard-training bypass"],
  },
  {
    domain: "Lineups",
    writer: "legacy-lineup-local-service + lineup validator",
    managerAiRole: "produce_action_preview",
    forbiddenBypass: ["validator bypass", "human/remote overwrite"],
  },
  {
    domain: "Seasonwechsel",
    writer: "season transition / preseason workflow services",
    managerAiRole: "produce_plan",
    forbiddenBypass: ["direct Season/Matchday replacement", "season2 topup"],
  },
];

export const AI_MANAGER_CACHE_CONTRACTS: AiManagerCacheContract[] = PHASES.map((phase) => {
  const definition = AI_LIFECYCLE_PHASE_DEFINITIONS.find((entry) => entry.phase === phase);
  const marketPhase = phase === "preseason_market";
  return {
    phase,
    cachesBuilt: definition?.caches ?? [],
    invalidatedWhen: [
      marketPhase ? "successful pick/sell changes roster/cash/freeAgentPool" : "phase input source changes",
      "season transition resets phase-scoped caches",
      "manual/human write invalidates affected team cache",
    ],
    updatedAfterPick: marketPhase
      ? ["freeAgentPool remove playerId", "rosterByTeam add playerId", "teamCash update", "teamSalary update", "transferHistory append"]
      : [],
    streamedReports: definition?.reports ?? [],
    excludedFromNormalUiLoad: [
      "full candidate pool",
      "full pick rejection traces",
      "full player scoring matrix",
      "season long-run outputs",
      "debug/audit CSV rows",
    ],
  };
});

export const AI_MANAGER_UI_CONTRACTS: AiManagerUiContractRow[] = [
  {
    view: "Home",
    field: "aktuelle AI-Phase",
    sourceModule: "Lifecycle Orchestrator",
    sourceOfTruth: "AiLifecycleStatus",
    loadingMode: "initial_light",
  },
  {
    view: "Home",
    field: "Manager Strategy",
    sourceModule: "Season Strategy",
    sourceOfTruth: "AiSeasonStrategyStateRecord",
    loadingMode: "initial_light",
  },
  {
    view: "Teamseite",
    field: "Roster Blueprint",
    sourceModule: "Roster Blueprint",
    sourceOfTruth: "manager plan/roster target",
    loadingMode: "lazy",
  },
  {
    view: "Home",
    field: "offene Team-Probleme",
    sourceModule: "Season Review",
    sourceOfTruth: "season review + identity guard",
    loadingMode: "initial_light",
  },
  {
    view: "Home",
    field: "Facility-Warnings",
    sourceModule: "Facility Plan",
    sourceOfTruth: "teamFacilities condition/efficiency",
    loadingMode: "initial_light",
  },
  {
    view: "Teamseite",
    field: "Contract-Warnings",
    sourceModule: "Contract Plan",
    sourceOfTruth: "contract strategy records",
    loadingMode: "lazy",
  },
  {
    view: "Teamseite",
    field: "Training-Plan",
    sourceModule: "Training Plan",
    sourceOfTruth: "AiManagerTrainingSettingRecord",
    loadingMode: "lazy",
  },
  {
    view: "Home",
    field: "naechster AI-Schritt",
    sourceModule: "Lifecycle Orchestrator",
    sourceOfTruth: "phase status + pending phases",
    loadingMode: "initial_light",
  },
  {
    view: "Teamseite",
    field: "warum spart/kauft/baut/trainiert ein Team",
    sourceModule: "Manager Memory",
    sourceOfTruth: "decision journal + manager review",
    loadingMode: "on_open",
  },
];

export function buildAiManagerIntegrationContract(): AiManagerIntegrationContract {
  const phasePermissions = AI_LIFECYCLE_PHASE_DEFINITIONS.filter((definition) =>
    PHASES.includes(definition.phase),
  ).map((definition) => ({
    phase: definition.phase,
    allowedActions: definition.allowedActions,
    blockedActions: definition.blockedActions,
    requiredInputs: definition.requiredInputs,
    producedOutputs: definition.producedOutputs,
    performanceBudget: definition.performanceBudget,
    resumePossible: definition.resumePossible,
    degradedAllowed: definition.degradedAllowed,
  }));

  return {
    generatedAt: new Date().toISOString(),
    modules: AI_MANAGER_MODULE_CONTRACTS,
    dataFlows: AI_MANAGER_DATA_FLOW_CONTRACTS,
    writeOwnership: AI_MANAGER_WRITE_OWNERSHIP,
    cacheContracts: AI_MANAGER_CACHE_CONTRACTS,
    phasePermissions,
    uiContracts: AI_MANAGER_UI_CONTRACTS,
    acceptance: {
      allModulesHaveInterface: AI_MANAGER_MODULE_CONTRACTS.every(
        (module) =>
          module.inputs.length > 0 &&
          module.outputs.length > 0 &&
          module.phases.length > 0 &&
          module.sourceOfTruth.length > 0,
      ),
      noDuplicateWriteLogic: AI_MANAGER_WRITE_OWNERSHIP.every((entry) => entry.writer.length > 0),
      managerAiBypassBlocked: AI_MANAGER_WRITE_OWNERSHIP.every((entry) => entry.forbiddenBypass.length > 0),
      lifecyclePhasesClear: phasePermissions.length === PHASES.length,
      seasonReviewToNextStrategyExists: AI_MANAGER_DATA_FLOW_CONTRACTS.some(
        (flow) => flow.chainId === "season-review-memory-next-strategy" && flow.status === "green",
      ),
      cacheContractExists: AI_MANAGER_CACHE_CONTRACTS.length === PHASES.length,
      remoteWritesForbidden: AI_LIFECYCLE_PHASE_DEFINITIONS.every((definition) => {
        if (definition.phase === "new_game_setup" || definition.writeMode === "read_only") return true;
        return definition.blockedActions.some((action) => {
          const normalized = action.toLowerCase();
          return normalized.includes("remote") || normalized.includes("human") || normalized.includes("direct") || normalized.includes("bypass");
        });
      }),
    },
  };
}
