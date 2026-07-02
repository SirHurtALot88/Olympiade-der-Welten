export type FeatureAuditStatus =
  | "planned"
  | "preview"
  | "local_write"
  | "sandbox_ready"
  | "multiplayer_ready"
  | "prod_ready";

export type FeatureAuditCategory =
  | "Core Save"
  | "Multiplayer"
  | "Team Management"
  | "Transfermarkt"
  | "Training"
  | "Facilities"
  | "XP / Progression"
  | "Contracts"
  | "Lineups"
  | "Formkarten"
  | "Mutatoren"
  | "Matchday Resolve"
  | "Arena"
  | "Standings"
  | "Preisgeld"
  | "Season Review"
  | "Pre-Season"
  | "AI Market"
  | "Redraft"
  | "Home Screen"
  | "Flow Controller"
  | "Board/Sponsor"
  | "Scouting/Potential"
  | "Baseline"
  | "UI Infrastructure";

export type FeatureWriteSafetyStatus = "covered" | "missing" | "not_applicable";

export type FeatureAuditFilter =
  | "all"
  | "blockers"
  | "preview-only"
  | "local-write"
  | "missing-smoke"
  | "multiplayer-missing";

export type FeatureAuditEntry = {
  featureId: string;
  label: string;
  category: FeatureAuditCategory;
  status: FeatureAuditStatus;
  views: string[];
  writePaths: string[];
  testCoverage: string[];
  smokeCoverage: string[];
  knownBlockers: string[];
  proofFiles: string[];
  writeSafety: FeatureWriteSafetyStatus;
  multiplayerReady: boolean;
  sandboxOnly: boolean;
  prodReady: boolean;
  lastChecked: string;
};

export type FeatureAuditFlags = {
  hasBlockers: boolean;
  missingTests: boolean;
  missingSmoke: boolean;
  localWriteWithoutWriteSafety: boolean;
  multiplayerMissing: boolean;
};

export type FeatureAuditMatrix = {
  generatedAt: string;
  entries: FeatureAuditEntry[];
  summary: {
    total: number;
    statusCounts: Record<FeatureAuditStatus, number>;
    prodReady: number;
    sandboxReadyOrBetter: number;
    previewOnly: number;
    localWrite: number;
    multiplayerReady: number;
    missingTests: number;
    missingSmoke: number;
    localWriteWithoutWriteSafety: number;
    multiplayerMissing: number;
    blockerCount: number;
    topBlockers: Array<{ featureId: string; label: string; blocker: string }>;
  };
};

type RegistryInput = Omit<FeatureAuditEntry, "lastChecked"> & {
  lastChecked?: string;
};

const DEFAULT_LAST_CHECKED = "registry_initial";

export const featureAuditFilters: Array<{ id: FeatureAuditFilter; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "blockers", label: "Nur Blocker" },
  { id: "preview-only", label: "Preview-only" },
  { id: "local-write", label: "Local Write" },
  { id: "missing-smoke", label: "Smoke fehlt" },
  { id: "multiplayer-missing", label: "MP fehlt" },
];

const registry: RegistryInput[] = [
  {
    featureId: "core-save-context",
    label: "Save-/Season-Kontext",
    category: "Core Save",
    status: "sandbox_ready",
    views: ["foundation", "context-banner", "cockpit"],
    writePaths: ["lib/persistence/save-repository.ts"],
    testCoverage: ["team-management-overview.test.ts", "server-save-migration.test.ts"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["prod_db_save_context_pending"],
    proofFiles: ["gameplay-smoke-proof.json", "server-persistence-readiness-audit.json"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "player-baseline",
    label: "Player Baseline",
    category: "Baseline",
    status: "sandbox_ready",
    views: ["players", "drawer", "audit"],
    writePaths: [],
    testCoverage: ["player-baseline-audit.json"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["baseline_server_import_contract_pending"],
    proofFiles: ["player-baseline-audit.json", "player-baseline-audit.md"],
    writeSafety: "not_applicable",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "new-game-setup",
    label: "New Game Setup Wizard",
    category: "Core Save",
    status: "local_write",
    views: ["teamSettings", "new-game-wizard"],
    writePaths: ["lib/game/new-game-setup-service.ts", "app/api/new-game/route.ts"],
    testCoverage: ["new-game-setup-service.test.ts", "new-game-setup-ui-contract.test.ts"],
    smokeCoverage: ["smoke_missing"],
    knownBlockers: ["production_room_persistence_pending"],
    proofFiles: [],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "server-persistence-readiness",
    label: "Server-Persistenz-Kontrakt",
    category: "Core Save",
    status: "preview",
    views: ["admin", "audit"],
    writePaths: ["lib/server/server-save-migration.ts"],
    testCoverage: ["server-save-migration.test.ts", "server-authoritative-write-guard.test.ts"],
    smokeCoverage: ["server:audit-persistence-readiness"],
    knownBlockers: ["server_database_schema_pending", "production_auth_provider_pending"],
    proofFiles: ["server-persistence-readiness-audit.json", "server-persistence-readiness-audit.md"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "multiplayer-room",
    label: "Online Room / Participants",
    category: "Multiplayer",
    status: "multiplayer_ready",
    views: ["home", "room", "context-banner"],
    writePaths: ["lib/room/room-store.ts", "app/api/room/route.ts", "lib/socket/server.ts"],
    testCoverage: ["room-store.test.ts", "multiplayer-room-ui-contract.test.ts"],
    smokeCoverage: ["app:smoke-multiplayer-e2e"],
    knownBlockers: ["real_login_provider_pending", "persistent_room_database_pending"],
    proofFiles: ["multiplayer-e2e-proof.json", "multiplayer-e2e-summary.md"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "team-ownership-control",
    label: "Ownership & Control Mode",
    category: "Team Management",
    status: "multiplayer_ready",
    views: ["teamSettings", "context-banner", "home"],
    writePaths: ["lib/foundation/team-control-settings.ts", "lib/room/server-authoritative-write-guard.ts"],
    testCoverage: ["team-control-ownership.test.ts", "server-authoritative-write-guard.test.ts"],
    smokeCoverage: ["app:smoke-gameplay", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["server_authority_persistence_pending"],
    proofFiles: ["multiplayer-e2e-proof.json", "manager-scenario-testsave-v1.json"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "global-active-team",
    label: "Global Active Team",
    category: "Team Management",
    status: "sandbox_ready",
    views: ["home", "teams", "market", "trainingV2", "lineup", "arena"],
    writePaths: ["localStorage UI preference"],
    testCoverage: ["foundation-transfermarkt-ui-contract.test.ts", "team-management-overview.test.ts"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["save_switch_visual_regression_needs_periodic_smoke"],
    proofFiles: ["gameplay-smoke-proof.json"],
    writeSafety: "not_applicable",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
	  {
	    featureId: "home-screen",
	    label: "Manager Home Screen",
    category: "Home Screen",
    status: "sandbox_ready",
    views: ["home"],
    writePaths: [],
    testCoverage: ["multiplayer-room-ui-contract.test.ts"],
    smokeCoverage: ["app:smoke-gameplay", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["season_history_data_quality_gaps_visible"],
    proofFiles: ["smoke-foundation.png", "multiplayer-chris-home.png", "multiplayer-franky-home.png"],
    writeSafety: "not_applicable",
    multiplayerReady: true,
	    sandboxOnly: true,
	    prodReady: false,
	  },
	  {
	    featureId: "inbox-notification-center",
	    label: "Inbox & Notification Center",
	    category: "UI Infrastructure",
	    status: "local_write",
	    views: ["home", "inbox", "foundation-header"],
	    writePaths: ["gameState.gameInboxItems via persistLocalGameStateImmediately"],
	    testCoverage: [
	      "game-inbox-service.test.ts",
	      "game-inbox-ui-contract.test.ts",
	      "inbox-quick-action-service.test.ts",
	      "fatigue-injury-inbox-integration.test.ts",
	    ],
	    smokeCoverage: ["app:smoke-gameplay", "app:smoke-gameplay-write"],
	    knownBlockers: [],
	    proofFiles: ["gameplay-smoke-proof.json"],
	    writeSafety: "covered",
	    multiplayerReady: true,
	    sandboxOnly: true,
	    prodReady: false,
	  },
	  {
	    featureId: "flow-controller",
    label: "Globaler Weiter-Button",
    category: "Flow Controller",
    status: "multiplayer_ready",
    views: ["foundation-header", "home", "arena", "season"],
    writePaths: ["lib/foundation/game-flow-controller.ts", "lib/room/room-flow-controller.ts"],
    testCoverage: ["game-flow-controller.test.ts", "flow-blocker-routing.test.ts", "room-flow-controller.test.ts"],
    smokeCoverage: ["app:smoke-gameplay", "app:smoke-gameplay-write", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["destructive_server_apply_steps_pending"],
    proofFiles: ["gameplay-smoke-proof.json", "multiplayer-ready-state.png"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "transfer-buy",
    label: "Transfermarkt Kaufen",
    category: "Transfermarkt",
    status: "multiplayer_ready",
    views: ["market", "drawer"],
    writePaths: ["lib/market/transfermarkt-local-service.ts", "app/api/transfermarkt/buy/route.ts"],
    testCoverage: ["transfermarkt-buy-service.test.ts", "foundation-transfermarkt-ui-contract.test.ts"],
    smokeCoverage: ["app:smoke-gameplay", "app:smoke-gameplay-write", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["production_room_persistence_pending"],
    proofFiles: ["gameplay-smoke-proof.json", "multiplayer-e2e-proof.json"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "transfer-sell",
    label: "Transfermarkt Verkaufen",
    category: "Transfermarkt",
    status: "multiplayer_ready",
    views: ["teams", "market", "drawer"],
    writePaths: ["lib/market/transfermarkt-local-service.ts", "app/api/transfermarkt/sell/route.ts"],
    testCoverage: ["transfermarkt-sell-service.test.ts", "foundation-transfermarkt-ui-contract.test.ts"],
    smokeCoverage: ["app:smoke-gameplay", "app:smoke-gameplay-write", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["contract_and_trust_sell_reasons_need_more_regression"],
    proofFiles: ["gameplay-smoke-proof.json", "multiplayer-e2e-proof.json"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "transfer-wishlist",
    label: "Wishlist / Scouting-Markt",
    category: "Transfermarkt",
    status: "sandbox_ready",
    views: ["market"],
    writePaths: ["local save wishlist"],
    testCoverage: ["foundation-transfermarkt-ui-contract.test.ts"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["real_scouting_source_pending"],
    proofFiles: ["gameplay-smoke-proof.json"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "ai-market",
    label: "AI Sell/Renewal/Buy",
    category: "AI Market",
    status: "sandbox_ready",
    views: ["cockpit", "preseason"],
    writePaths: ["lib/ai/ai-market-plan-apply-service.ts", "lib/season/preseason-workflow-service.ts"],
    testCoverage: ["ai-market-anti-rebuy-audit.csv", "preseason-workflow-ui-contract.test.ts"],
    smokeCoverage: ["app:smoke-gameplay-write"],
    knownBlockers: ["season3_market_activity_balance_suspicious", "transfer_history_multiseason_visibility_needs_fix"],
    proofFiles: ["ai-market-season2-actions.csv", "ai-market-anti-rebuy-audit.csv"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "redraft",
    label: "Redraft / Top-Up",
    category: "Redraft",
    status: "sandbox_ready",
    views: ["cockpit", "audit"],
    writePaths: ["lib/ai/ai-picks-run-service.ts", "lib/ai/auto-roster-fill-service.ts"],
    testCoverage: ["clean-redraft-mode-audit.json"],
    smokeCoverage: ["ai:audit-clean-redraft-mode"],
    knownBlockers: ["full_clean_redraft_from_empty_not_executed_by_design"],
    proofFiles: ["clean-redraft-mode-audit.json", "clean-redraft-mode-audit.md"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "facilities-upgrade",
    label: "Facilities Preview/Apply",
    category: "Facilities",
    status: "multiplayer_ready",
    views: ["trainingV2"],
    writePaths: ["lib/facilities/facility-upgrade-service.ts", "app/api/facilities/upgrade/route.ts"],
    testCoverage: ["facility-upgrade-service.test.ts"],
    smokeCoverage: ["app:smoke-gameplay", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["facility_roi_balance_needs_more_multiseason_data"],
    proofFiles: ["gameplay-smoke-proof.json"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "facilities-season-finance",
    label: "Facility Finance Season-End",
    category: "Facilities",
    status: "local_write",
    views: ["trainingV2", "preseason", "season"],
    writePaths: ["lib/season/preseason-workflow-service.ts"],
    testCoverage: ["season-end-facility-audit.csv"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["facility_roi_balance_needs_more_multiseason_data"],
    proofFiles: ["season-end-facility-audit.csv", "multiseason-rerun-transition-s2-s3-facility-audit.csv"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "training-forecast",
    label: "Training Forecast",
    category: "Training",
    status: "preview",
    views: ["trainingV2", "drawer", "market"],
    writePaths: ["training preview only"],
    testCoverage: ["player-progression-forecast.test.ts"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["net_development_multiseason_balance_pending"],
    proofFiles: ["season3-training-audit.csv", "multiseason-xp-audit.csv"],
    writeSafety: "not_applicable",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "training-forecast-facilities",
    label: "Training Forecast Facility Source",
    category: "Training",
    status: "sandbox_ready",
    views: ["trainingV2", "drawer"],
    writePaths: ["lib/training/player-progression-forecast.ts", "lib/facilities/facility-effects.ts"],
    testCoverage: ["player-progression-forecast.test.ts", "facility-effects.test.ts"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: [],
    proofFiles: [],
    writeSafety: "not_applicable",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "xp-manual-spend",
    label: "XP Manual Spend",
    category: "XP / Progression",
    status: "local_write",
    views: ["trainingV2", "drawer"],
    writePaths: ["lib/progression/season-end-xp-apply-service.ts", "app/api/progression/season-end-xp-spend/route.ts"],
    testCoverage: ["season-end-xp-apply-service.test.ts"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["server_authoritative_xp_apply_pending"],
    proofFiles: ["season-end-progression-audit.csv"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "ai-xp-auto-spend",
    label: "AI XP Auto-Spend",
    category: "XP / Progression",
    status: "preview",
    views: ["trainingV2", "preseason"],
    writePaths: ["lib/progression/ai-xp-spend-planner.ts", "lib/progression/season-end-xp-apply-service.ts"],
    testCoverage: ["ai-xp-spend-planner.test.ts"],
    smokeCoverage: ["smoke_missing"],
    knownBlockers: ["ai_apply_confirm_e2e_pending"],
    proofFiles: ["multiseason-rerun-transition-s2-s3-progression-audit.csv"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "economy-recalc-after-xp",
    label: "Economy Recalc nach XP",
    category: "XP / Progression",
    status: "preview",
    views: ["trainingV2", "drawer"],
    writePaths: ["preview only"],
    testCoverage: ["season-end-xp-apply-service.test.ts"],
    smokeCoverage: ["smoke_missing"],
    knownBlockers: ["market_value_salary_truth_needs_final_confirmation"],
    proofFiles: ["season-end-progression-audit.csv"],
    writeSafety: "not_applicable",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "contracts-renewals",
    label: "Contracts / Renewals",
    category: "Contracts",
    status: "local_write",
    views: ["teams", "market", "preseason"],
    writePaths: ["lib/contracts/contract-renewal-service.ts", "lib/market/contract-negotiation-preview.ts"],
    testCoverage: ["contract-renewal-service.test.ts"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["multi_year_transfer_history_visibility_needs_fix", "negotiation_dialog_full_confirm_flow_pending"],
    proofFiles: ["multiseason-rerun-transition-s2-s3-transfer-audit.csv"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "lineups",
    label: "Einsatzliste / Lineups",
    category: "Lineups",
    status: "multiplayer_ready",
    views: ["lineup"],
    writePaths: ["lib/lineups/legacy-lineup-local-service.ts", "app/api/lineups/legacy/route.ts"],
    testCoverage: ["legacy-lineup-local-service.test.ts"],
    smokeCoverage: ["app:smoke-gameplay", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["ai_team_suggestion_slot_fill_recently_fixed_needs_regression"],
    proofFiles: ["season3-lineup-readiness.csv", "gameplay-smoke-proof.json"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "formcards",
    label: "Formkarten",
    category: "Formkarten",
    status: "multiplayer_ready",
    views: ["lineup", "arena"],
    writePaths: ["season setup local service"],
    testCoverage: ["season-formcards-regeneration-audit.json"],
    smokeCoverage: ["app:smoke-gameplay", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["player_manual_formcard_selection_permissions_pending"],
    proofFiles: ["season-formcards-regeneration-audit.json", "season3-formcards-audit.csv"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "mutator-scoring",
    label: "Mutator Score + PPs",
    category: "Mutatoren",
    status: "sandbox_ready",
    views: ["arena", "resolve", "audit"],
    writePaths: ["lib/resolve/legacy-matchday-result-apply-service.ts"],
    testCoverage: ["mutator-scoring-audit.json"],
    smokeCoverage: ["mutator:audit"],
    knownBlockers: ["needs_full_season2_regression"],
    proofFiles: ["mutator-scoring-audit.json", "mutator-team-score-audit.csv", "mutator-player-pps-audit.csv"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "matchday-resolve",
    label: "Matchday Resolve / Apply",
    category: "Matchday Resolve",
    status: "multiplayer_ready",
    views: ["arena", "cockpit"],
    writePaths: ["lib/resolve/legacy-matchday-result-apply-service.ts", "app/api/resolve/legacy-matchday-apply/route.ts"],
    testCoverage: ["resolve-result tests", "standings tests"],
    smokeCoverage: ["app:smoke-gameplay-write", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["production_room_persistence_pending"],
    proofFiles: ["season2-simulation-summary.json", "season2-matchday-results.csv", "multiplayer-e2e-proof.json"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "arena",
    label: "Matchday Arena",
    category: "Arena",
    status: "sandbox_ready",
    views: ["matchdayArena"],
    writePaths: ["read/result presenter; resolve via service"],
    testCoverage: ["arena presenter/UI contract tests"],
    smokeCoverage: ["app:smoke-gameplay", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["missing_lineups_empty_state_current_save"],
    proofFiles: ["season2-arena-smoke-proof.json", "multiplayer-result-sync.png"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "matchday-summary",
    label: "Spieltagsergebnis Summary",
    category: "Arena",
    status: "sandbox_ready",
    views: ["matchdayArena", "matchdayResult"],
    writePaths: ["read-only presenter"],
    testCoverage: ["matchday-summary tests"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["historical_matchday_selection_needs_more_browser_coverage"],
    proofFiles: ["gameplay-smoke-proof.json"],
    writeSafety: "not_applicable",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "standings",
    label: "Saisonstand / History",
    category: "Standings",
    status: "sandbox_ready",
    views: ["season", "home"],
    writePaths: ["lib/standings/standings-apply-service.ts", "app/api/standings/apply/route.ts"],
    testCoverage: ["standings tests", "season-points-prize-regression smoke"],
    smokeCoverage: ["app:smoke-gameplay", "season:smoke-points-prize-regression"],
    knownBlockers: ["ui_history_validation_pending", "season_history_player_team_values_incomplete"],
    proofFiles: ["season-points-prize-regression.json", "season2-standings-final.csv"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "prize-money",
    label: "Preisgeld / RankChange",
    category: "Preisgeld",
    status: "local_write",
    views: ["prize", "season", "preseason"],
    writePaths: ["lib/season/cash-prize-apply-service.ts", "app/api/season/cash-prize-apply/route.ts"],
    testCoverage: ["season-points-prize-regression smoke"],
    smokeCoverage: ["season:smoke-points-prize-regression", "app:smoke-gameplay"],
    knownBlockers: ["sponsor_contract_fallback_documented"],
    proofFiles: ["season-end-prize-rank-change-audit.json", "season-points-prize-regression.json"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "season-review",
    label: "Season Review / Awards",
    category: "Season Review",
    status: "sandbox_ready",
    views: ["preseason", "seasonReview"],
    writePaths: ["read-only presenter"],
    testCoverage: ["season-review-service tests"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["missing_sources_reduce_awards_in_some_saves"],
    proofFiles: ["season1-awards.json", "multiseason-rerun-transition-s2-s3-awards.json"],
    writeSafety: "not_applicable",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "preseason-workflow",
    label: "Pre-Season Workflow",
    category: "Pre-Season",
    status: "multiplayer_ready",
    views: ["cockpit", "season", "home"],
    writePaths: ["lib/season/preseason-workflow-service.ts", "app/api/season/preseason-workflow/route.ts"],
    testCoverage: ["preseason-workflow-ui-contract.test.ts"],
    smokeCoverage: ["app:smoke-gameplay", "app:smoke-gameplay-write", "app:smoke-multiplayer-e2e"],
    knownBlockers: ["ai_market_activity_and_history_persistence_need_hardening"],
    proofFiles: ["multiseason-rerun-transition-s2-s3-summary.json"],
    writeSafety: "covered",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "board-sponsor-objectives",
    label: "Board / Sponsor Objectives",
    category: "Board/Sponsor",
    status: "local_write",
    views: ["home", "teams", "seasonReview", "preseason"],
    writePaths: ["lib/sponsor/sponsor-offer-service.ts", "lib/sponsor/sponsor-settlement-service.ts", "app/api/sponsor/choose/route.ts"],
    testCoverage: ["sponsor-offer-service.test.ts", "sponsor-commercial-rating-service.test.ts", "sponsor-tier-pool.test.ts", "team-season-objectives-service.test.ts"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["sponsor_tier_balancing_pending"],
    proofFiles: ["docs/design/sponsor-system-v2.md"],
    writeSafety: "covered",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "scouting-potential",
    label: "Scouting / Potential",
    category: "Scouting/Potential",
    status: "sandbox_ready",
    views: ["market", "drawer", "trainingV2", "scoutingCenterV2"],
    writePaths: ["lib/scouting/scouting-watchlist-service.ts", "lib/scouting/facility-scout-pipeline-service.ts", "app/api/scouting/watchlist/route.ts", "lib/market/transfermarkt-scouting.ts"],
    testCoverage: ["transfermarkt-scouting.test.ts", "scouting-watchlist-service.test.ts", "facility-scout-pipeline-service.test.ts"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["potential_history_calibration_pending"],
    proofFiles: [],
    writeSafety: "not_applicable",
    multiplayerReady: false,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "global-table-controls",
    label: "Global Table Controls",
    category: "UI Infrastructure",
    status: "sandbox_ready",
    views: ["season", "market", "teams", "ranks", "trainingV2", "cockpit"],
    writePaths: ["localStorage UI layout"],
    testCoverage: ["global-table-layout tests"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["some_legacy_tables_still_unwired"],
    proofFiles: ["gameplay-smoke-proof.json"],
    writeSafety: "not_applicable",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
  {
    featureId: "multiseason-balance-dashboard",
    label: "Multi-Season Balance",
    category: "UI Infrastructure",
    status: "sandbox_ready",
    views: ["cockpit"],
    writePaths: [],
    testCoverage: ["multiseason-balance-dashboard.test.ts"],
    smokeCoverage: ["app:smoke-gameplay"],
    knownBlockers: ["season1_partial_history_source_visible", "season3_in_progress_excluded_by_design"],
    proofFiles: ["multiseason-rerun.json", "multiseason-balance-flags.csv"],
    writeSafety: "not_applicable",
    multiplayerReady: true,
    sandboxOnly: true,
    prodReady: false,
  },
];

export const featureRegistry: FeatureAuditEntry[] = registry.map((entry) => ({
  ...entry,
  lastChecked: entry.lastChecked ?? DEFAULT_LAST_CHECKED,
}));

export function getFeatureAuditFlags(entry: FeatureAuditEntry): FeatureAuditFlags {
  const missingTests = entry.testCoverage.length === 0 || entry.testCoverage.includes("test_missing");
  const missingSmoke = entry.smokeCoverage.length === 0 || entry.smokeCoverage.includes("smoke_missing");
  const localWriteWithoutWriteSafety = entry.status === "local_write" && entry.writeSafety !== "covered";
  return {
    hasBlockers: entry.knownBlockers.length > 0,
    missingTests,
    missingSmoke,
    localWriteWithoutWriteSafety,
    multiplayerMissing: !entry.multiplayerReady,
  };
}

export function filterFeatureAuditEntries(
  entries: FeatureAuditEntry[],
  filter: FeatureAuditFilter,
): FeatureAuditEntry[] {
  if (filter === "all") return entries;
  return entries.filter((entry) => {
    const flags = getFeatureAuditFlags(entry);
    if (filter === "blockers") return flags.hasBlockers;
    if (filter === "preview-only") return entry.status === "preview" || entry.status === "planned";
    if (filter === "local-write") return entry.status === "local_write";
    if (filter === "missing-smoke") return flags.missingSmoke;
    if (filter === "multiplayer-missing") return flags.multiplayerMissing;
    return true;
  });
}

export function buildFeatureAuditMatrix(input?: {
  generatedAt?: string;
  availableProofFiles?: string[];
}): FeatureAuditMatrix {
  const generatedAt = input?.generatedAt ?? new Date().toISOString();
  const availableProofFiles = new Set(input?.availableProofFiles ?? []);
  const entries = featureRegistry.map((entry) => {
    const hasAllProofFiles =
      availableProofFiles.size === 0 || entry.proofFiles.every((fileName) => availableProofFiles.has(fileName));
    return {
      ...entry,
      lastChecked: hasAllProofFiles ? generatedAt : "proof_missing",
    };
  });
  const statusCounts: Record<FeatureAuditStatus, number> = {
    planned: 0,
    preview: 0,
    local_write: 0,
    sandbox_ready: 0,
    multiplayer_ready: 0,
    prod_ready: 0,
  };
  for (const entry of entries) {
    statusCounts[entry.status] += 1;
  }
  const flags = entries.map((entry) => ({ entry, flags: getFeatureAuditFlags(entry) }));
  const topBlockers = entries
    .flatMap((entry) =>
      entry.knownBlockers.map((blocker) => ({
        featureId: entry.featureId,
        label: entry.label,
        blocker,
      })),
    )
    .slice(0, 10);

  return {
    generatedAt,
    entries,
    summary: {
      total: entries.length,
      statusCounts,
      prodReady: entries.filter((entry) => entry.prodReady || entry.status === "prod_ready").length,
      sandboxReadyOrBetter: entries.filter((entry) =>
        ["sandbox_ready", "multiplayer_ready", "prod_ready"].includes(entry.status),
      ).length,
      previewOnly: entries.filter((entry) => entry.status === "preview" || entry.status === "planned").length,
      localWrite: entries.filter((entry) => entry.status === "local_write").length,
      multiplayerReady: entries.filter((entry) => entry.multiplayerReady).length,
      missingTests: flags.filter((entry) => entry.flags.missingTests).length,
      missingSmoke: flags.filter((entry) => entry.flags.missingSmoke).length,
      localWriteWithoutWriteSafety: flags.filter((entry) => entry.flags.localWriteWithoutWriteSafety).length,
      multiplayerMissing: flags.filter((entry) => entry.flags.multiplayerMissing).length,
      blockerCount: entries.reduce((total, entry) => total + entry.knownBlockers.length, 0),
      topBlockers,
    },
  };
}
