/**
 * Foundation shell module-scope types (Phase 5.4 — module-scope extraction).
 *
 * This file holds the pure TypeScript type/interface declarations and small
 * static data constants that used to live at module scope inside
 * `FoundationPageClient.tsx` (view types, API response shapes, season-setup
 * static steps, team-identity/strategy field label configs, storage keys,
 * confirm tokens). None of this depends on component state — it is safe to
 * import from both the parent and any extracted tab hosts.
 *
 * `FoundationPageClient.tsx` re-imports everything it needs from here; a
 * handful of previously `export`ed types are re-exported from the parent so
 * existing consumers (`cockpit-types.ts`, `foundation-shared-context.tsx`,
 * `cockpit-handlers.ts`) keep working unchanged.
 */
import type { ContractShape, GameState, NewGameFlowStepId, RosterEntry, TeamControlMode, TeamControlSettings, TeamIdentity, TeamStrategyBias, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import type { FacilityId, SpecialistWingVariant } from "@/lib/facilities/facility-catalog";
import type { getFacilityConditionStatus } from "@/lib/facilities/facility-condition";
import type { FoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import type { SaveSummary } from "@/lib/persistence/types";
import type {
  FoundationTableColumn,
  FoundationTablePreset,
  FoundationTablePresetId,
  SortState,
} from "@/lib/foundation/foundation-table-ui-types";
import type {
  NegotiationDemandBreakdownEntry,
  NegotiationScoreBreakdownEntry,
  PlayerContractPreference,
} from "@/lib/market/contract-negotiation-preview";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import type { DisciplineCategoryFilter } from "@/lib/foundation/tabs/foundation-format-render-helpers";
import type { GameFlowView } from "@/lib/foundation/game-flow-controller";
import type { PlayerProfileTabId } from "@/lib/foundation/player-profile-service";
import type { TeamControlFilter } from "@/lib/foundation/team-control-settings";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

export type PlayerTableScope = "active" | "free_agents" | "all";
export type TrainingModeDraft = PlayerTrainingMode;
export type TrainingClassDraft = string;
export type TrainingDevelopmentFilter = "all" | "growth" | "stable" | "regression";
export type {
  FoundationTableColumn,
  FoundationTablePreset,
  FoundationTablePresetId,
  SortState,
  FacilityId,
  SpecialistWingVariant,
  DisciplineCategoryFilter,
  GameFlowView,
  PlayerProfileTabId,
  TeamControlFilter,
  TeamStrategyProfile,
  FoundationViewId,
};
export type FoundationView =
  | "home"
  | "homeV2"
  | "facilitiesOverviewV2"
  | "scoutingCenterV2"
  | "inboxV2"
  | "hq"
  | "season"
  | "seasonV2"
  | "historyV2"
	  | "cockpit"
	  | "inbox"
  | "seasonPreview"
  | "lineup"
  | "lineupV2"
  | "matchdayArena"
  | "disciplineStage"
  | "matchdayResult"
  | "teams"
  | "training"
  | "trainingCompact"
  | "trainingV2"
  | "players"
  | "playerProfile"
  | "teamProfile"
  | "ranks"
  | "diszis"
  | "leagueLeaders"
  | "allTimeTable"
  | "prize"
  | "market"
  | "marketV2"
  | "history"
  | "debug"
  | "generator"
  | "teamSettings"
  | "encyclopedia"
  | "admin"
  | "credits"
  | "finances";

export const SEASON_SETUP_STEP_IDS: NewGameFlowStepId[] = [
  "season_intro",
  "team_confirm",
  "roster_review",
  "appoint_captain",
  "first_transfers",
  "fill_roster",
  "training_facilities",
  "choose_sponsor",
  "set_lineup",
];

export type SeasonSetupStepTone = "open" | "completed" | "skipped";
export type SeasonSetupStepViewTarget = FoundationView | "manager_team";

export type FoundationCommandItem = {
  id: string;
  label: string;
  detail: string;
  section: "Flow" | "Ansicht" | "Team" | "Spieler" | "Aktion" | "Lexikon";
  keywords: string;
  tone?: "ready" | "warning" | "blocked";
  run: () => void;
};

export type FoundationFlowCoachAction = {
  label: string;
  targetView: FoundationView;
  detail: string;
  tone?: "primary" | "quiet";
};

export type FoundationFlowCoachModel = {
  kicker: string;
  title: string;
  detail: string;
  terms: string[];
  nextLabel: string;
  nextTitle: string;
  progressLabel: string;
  progressPct: number;
  shortcut: string;
  actions: FoundationFlowCoachAction[];
};

export type FoundationFlowLoopStage = {
  id: string;
  label: string;
  detail: string;
  targetView: FoundationView;
  views: FoundationView[];
};

export type FoundationScreenPrimaryAction = {
  kicker: string;
  title: string;
  detail: string;
  status: "offen" | "bereit" | "blockiert" | "erledigt" | "optional";
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string | null;
};


export type SeasonTableMode = "compact" | "expert";
export type TeamRosterRoleFilter = "all" | "starter" | "rotation" | "prospect" | "bench" | "other";
export type TeamRosterFocusMode = "default" | "salary" | "value" | "contracts" | "training";
export type FoundationReadSource = "sqlite" | "prisma";
export type FoundationReadMeta = {
  source: FoundationReadSource;
  readOnly: boolean;
  generatedAt: string;
  saveMode?: FoundationSaveMode;
};
export type FoundationPageClientProps = {
  initialReadSource: FoundationReadSource | null;
  initialSelectedTeamId?: string | null;
  initialSaveId?: string | null;
  initialView?: FoundationView | null;
  initialPersistenceState?: {
    save?: { saveId: string; name?: string; gameState: GameState };
    saves?: SaveSummary[];
    _meta?: FoundationReadMeta;
  } | null;
  /**
   * Owner-ID der eingeloggten Person (Phase-1-Login). Nur gesetzt, wenn
   * OLY_AUTH_ENABLED aktiv ist und eine gueltige Session vorliegt - seedet
   * activeOwnerId, damit Franky auf seinem Geraet seine eigenen Teams sieht statt
   * immer auf Chris' Owner-Scope zurueckzufallen. Bei deaktiviertem Login bleibt
   * dies null und das bisherige Default-Verhalten ist unveraendert.
   */
  initialActiveOwnerId?: string | null;
};

export type FoundationTransfermarktResponse = {
  items: TransfermarktFreeAgentItem[];
  total: number;
  offset: number;
  limit: number;
  returned: number;
  hasMore: boolean;
  source: "derived_free_agents";
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
  } | null;
  teamContext: {
    teamId: string;
    teamCash: number;
    teamSalary: number;
    rosterCount: number;
    playerMin: number;
    playerOpt: number;
    readinessStatus: string;
    affordabilityStatus: "affordable" | "tight" | "too_expensive";
    rosterPressureStatus: "under_min" | "under_opt" | "at_or_above_opt";
  } | null;
  notes: string[];
  warnings: string[];
  poolAudit: {
    activeFreeAgentCount: number;
    visibleFeedCount: number;
    marketValueBuckets: Array<{
      label: "0-5" | "5-10" | "10-20" | "20-30" | "30-50" | "50+";
      count: number;
    }>;
    cheapestVisiblePlayer: {
      playerId: string;
      name: string;
      marketValue: number | null;
    } | null;
    cheapestBuyablePlayer: {
      playerId: string;
      name: string;
      marketValue: number | null;
    } | null;
    cheapestCandidatePoolPlayer: {
      playerId: string;
      name: string;
      marketValue: number | null;
    } | null;
  };
  error?: string;
};

export type TransfermarktBuySummary = {
  canBuy: boolean;
  blockingReasons: string[];
  warnings: string[];
  player: {
    id: string;
    name: string;
    className: string;
    race: string;
  } | null;
  team: {
    id: string;
    name: string;
    shortCode: string;
  } | null;
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  marketValueBefore: number | null;
  marketValueAfter: number | null;
  rosterBefore: number | null;
  rosterAfter: number | null;
  purchasePrice: number | null;
  salary: number | null;
  contractLength: number;
  contractShape?: ContractShape;
  promisedRole?: RosterEntry["promisedRole"] | null;
  currentValue: number | null;
  joinedSeasonId: string;
  expectedSalary?: number | null;
  baseExpectedSalary?: number | null;
  demandMultiplier?: number | null;
  offeredSalary?: number | null;
  offerRatio?: number | null;
  yearlySalarySchedule?: Array<{
    yearIndex: number;
    seasonOffset: number;
    label: string;
    salary: number;
  }>;
  totalSalary?: number | null;
  roundingAdjustment?: number | null;
  buyoutCost?: number | null;
  bracket?: number | null;
  teamFit?: number | null;
  acceptanceScore?: number | null;
  acceptChance?: number | null;
  counterChance?: number | null;
  rejectChance?: number | null;
  contractPreference?: PlayerContractPreference | null;
  demandBreakdown?: NegotiationDemandBreakdownEntry[];
  negotiationScoreBreakdown?: NegotiationScoreBreakdownEntry[];
  negotiationReasons?: string[];
  negotiationWarnings?: string[];
  negotiationBlockingReasons?: string[];
  activePlayerCreated?: boolean;
  transferCreated?: boolean;
  teamSeasonStateUpdated?: boolean;
  activePlayerId?: string | null;
  transferId?: string | null;
};

export type TransfermarktBuyApiResponse = {
  success: boolean;
  summary: TransfermarktBuySummary | null;
  warnings: string[];
  error?: string;
  scope?: Omit<TransfermarktBuyRequestContext, "view"> & { view?: FoundationView };
};

/**
 * Voller Verhandlungs-Preview-Ausschnitt aus `previewContractRenewalAction`
 * (lib/contracts/contract-renewal-service.ts) — dieselben Zahlen, die auch
 * die Season-End-Auto-Verlängerung benutzt. Die Gehaltsverhandlungs-UI
 * konsumiert sie 1:1, es gibt bewusst KEIN paralleles Client-Rechenmodell.
 */
export type ContractRenewalNegotiationPreviewPayload = {
  expectedSalary: number | null;
  baseExpectedSalary?: number | null;
  demandMultiplier?: number | null;
  offeredSalary?: number | null;
  offerRatio?: number | null;
  contractLength?: number;
  contractShape?: ContractShape;
  yearlySalarySchedule?: Array<{ yearIndex: number; seasonOffset: number; label: string; salary: number }>;
  totalSalary?: number | null;
  buyoutCost?: number | null;
  teamFit?: number | null;
  acceptanceScore?: number | null;
  acceptChance?: number | null;
  counterChance?: number | null;
  rejectChance?: number | null;
  contractPreference?: {
    lengthPreference: "short" | "medium" | "long";
    shapePreference: ContractShape;
    preferredMinLength: number;
    preferredMaxLength: number;
    idealLength: number;
    matchQuality: "preferred" | "acceptable" | "mismatch";
    reasons: string[];
    warnings: string[];
  } | null;
  reasons?: string[];
  warnings?: string[];
  blockingReasons?: string[];
  status?: string;
};

export type ContractRenewalMoralePayload = {
  morale: number;
  visibleMood: string;
  smiley: string;
  contractIntent: string;
  salaryModifier: number;
  contractLengthLimit: number | null;
  renewalRisk: number;
  reasons: string[];
  suggestedActions: string[];
  warnings: string[];
};

export type ContractRenewalApiResponse = {
  success: boolean;
  summary: {
    ok: boolean;
    applied?: boolean;
    confirmToken: string;
    warnings: string[];
    blockingReasons: string[];
    negotiationPreview?: ContractRenewalNegotiationPreviewPayload | null;
    morale?: ContractRenewalMoralePayload | null;
    moraleAdjustedExpectedSalary?: number | null;
    contractEvent?: {
      eventType: string;
      oldSalary: number | null;
      newSalary: number | null;
      oldLength: number | null;
      newLength: number | null;
    };
  } | null;
  warnings?: string[];
  blockingReasons?: string[];
  error?: string;
};

export type MarketNegotiationOutcome = {
  status: "accepted" | "countered" | "rejected";
  title: string;
  message: string;
  tone: "success" | "warning" | "error";
  counterSalary?: number | null;
};

export type FacilityUpgradeSummary = {
  ok: boolean;
  dryRun: boolean;
  applied?: boolean;
  action?: "upgrade" | "downgrade";
  confirmToken: string | null;
  facilityEventId?: string | null;
  team: { teamId: string; shortCode: string; name: string } | null;
  facility: { facilityId: FacilityId; label: string; variant: string | null } | null;
  currentLevel: number;
  nextLevel: number | null;
  currentEffect: string;
  nextEffect: string | null;
  upgradeCost: number | null;
  refundAmount?: number | null;
  currentUpkeep: number;
  newUpkeep: number;
  currentIncome: number;
  newIncome: number;
  cashBefore: number | null;
  cashAfter: number | null;
  warnings: string[];
  blockingReasons: string[];
  saveContext: {
    saveId: string;
    seasonId: string;
    saveStatus: string;
  };
};

export type FacilityUpgradeApiResponse = {
  success: boolean;
  summary: FacilityUpgradeSummary | null;
  warnings?: string[];
  blockingReasons?: string[];
  error?: string;
};

export type FacilityMaintenanceSummary = {
  ok: boolean;
  dryRun: boolean;
  applied?: boolean;
  confirmToken: string | null;
  facilityEventId?: string | null;
  team: { teamId: string; shortCode: string; name: string } | null;
  facility: { facilityId: FacilityId; label: string } | null;
  level: number;
  conditionPct: number;
  nextConditionPct: number;
  efficiencyPct: number;
  nextEfficiencyPct: number;
  conditionStatus: ReturnType<typeof getFacilityConditionStatus>;
  maintenanceCost: number;
  cashBefore: number | null;
  cashAfter: number | null;
  warnings: string[];
  blockingReasons: string[];
  saveContext: {
    saveId: string;
    seasonId: string;
    saveStatus: string;
  };
};

export type FacilityMaintenanceApiResponse = {
  success: boolean;
  summary: FacilityMaintenanceSummary | null;
  warnings?: string[];
  blockingReasons?: string[];
  error?: string;
};

export type PreSeasonWorkflowStepSummary = Record<string, number | string | boolean | null>;

export type PreSeasonWorkflowStepSummaryResponse = {
  stepId:
    | "season_review"
    | "season_rewards"
    | "facilities"
    | "player_development"
    | "preseason_management"
    | "transfer_sell_phase"
    | "contract_renewal"
    | "sponsor_choice"
    | "transfer_buy_phase"
    | "next_season_setup"
    | "next_season_ready";
  label: string;
  status: "ready" | "warning" | "blocked" | "preview_only" | "applied";
  productive: boolean;
  summary: PreSeasonWorkflowStepSummary;
  warnings: string[];
  blockingReasons: string[];
  confirmToken: string | null;
};

export type PreSeasonWorkflowSummaryResponse = {
  ok: boolean;
  dryRun: boolean;
  productiveWrites?: boolean;
  applied?: boolean;
  appliedStepId?: string | null;
  auditLogId?: string | null;
  saveContext: {
    saveId: string;
    seasonId: string;
    nextSeasonId: string;
    nextSeasonLabel: string;
    gamePhase: string;
  };
  controlSummary: {
    manualTeams: number;
    aiTeams: number;
    passiveTeams: number;
  };
  steps: PreSeasonWorkflowStepSummaryResponse[];
  warnings: string[];
  blockingReasons: string[];
};

export type PreSeasonWorkflowApiResponse = {
  success: boolean;
  summary: PreSeasonWorkflowSummaryResponse | null;
  warnings?: string[];
  blockingReasons?: string[];
  error?: string;
};

export type SeasonTransitionStepResponse = {
  stepId:
    | "season_check"
    | "season_review"
    | "season_rewards"
    | "player_development"
    | "preseason_management"
    | "transfer_sell_phase"
    | "transfer_buy_phase"
    | "lineup_setup"
    | "next_season_ready";
  label: string;
  status: "open" | "ready" | "applied" | "blocked";
  preview: string;
  warnings: string[];
  blockingReasons: string[];
  canApply: boolean;
};

export type SeasonReviewNamedValueResponse = {
  id: string;
  name: string;
  playerId?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  value: number | string | null;
  label: string;
  source: string;
};

export type SeasonReviewAwardResponse = {
  awardId: string;
  label: string;
  category: "team" | "player" | "transfer" | "discipline";
  winnerType: "team" | "player";
  winnerId: string;
  winnerName: string;
  value: number | string | null;
  reason: string;
  source: string;
};

export type SeasonReviewTransferHighlightResponse = {
  transferId: string;
  label: string;
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  value: number | null;
  source: string;
};

export type SeasonReviewPromisedRoleSignalResponse = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  roleTag: string;
  promisedRole: string;
  appearances: number;
  expectedAppearances: number;
  source: string;
};

export type SeasonReviewXpDevelopmentRowResponse = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  seasonId: string;
  xpEarned: number;
  xpSpent: number;
  attributeDelta: number;
  marketValueDelta: number | null;
  salaryPreviewDelta: number | null;
  fairSnapshot: boolean;
  label: string;
  source: string;
};

export type SeasonObjectiveSettlementResponse = {
  seasonId: string;
  rows: Array<{
    teamId: string;
    teamName: string;
    objectiveId: string;
    label: string;
    category: string;
    status: "open" | "completed" | "failed" | "at_risk";
    cashDelta: number;
    boardConfidenceDelta: number;
    visibleResult: "plus" | "minus" | "neutral";
    reason: string;
  }>;
  byTeamId: Record<
    string,
    {
      teamId: string;
      teamName: string;
      completed: number;
      failed: number;
      atRisk: number;
      open: number;
      cashDelta: number;
      boardConfidenceDelta: number;
      resultLabel: string;
    }
  >;
  totals: {
    cashDelta: number;
    boardConfidenceDelta: number;
    completed: number;
    failed: number;
  };
};

export type SeasonReviewResponse = {
  championTeam: SeasonReviewNamedValueResponse | null;
  finalTable: SeasonReviewNamedValueResponse[];
  topPlayers: SeasonReviewNamedValueResponse[];
  topDisciplinePerformances: SeasonReviewNamedValueResponse[];
  awards: SeasonReviewAwardResponse[];
  storylines: Array<{ storylineId: string; text: string; source: string }>;
  transferHighlights: SeasonReviewTransferHighlightResponse[];
  teamHighlights: SeasonReviewNamedValueResponse[];
  objectiveSettlement?: SeasonObjectiveSettlementResponse;
  promisedRoleSignals?: SeasonReviewPromisedRoleSignalResponse[];
  xpDevelopmentRankings?: {
    topImproved: SeasonReviewXpDevelopmentRowResponse[];
    bottom20: SeasonReviewXpDevelopmentRowResponse[];
    bottomLabel: "least_improved" | "declined";
    missingFairSnapshot: SeasonReviewXpDevelopmentRowResponse[];
  };
  warnings: string[];
};

export type SeasonTransitionSummaryResponse = {
  ok: boolean;
  dryRun: boolean;
  applied?: boolean;
  productiveWrites: false;
  gamePhase: string;
  canCompleteSeason: boolean;
  disabledReason: string | null;
  transition: {
    transitionId: string;
    fromSeasonId: string;
    toSeasonId: string;
    currentStep: string;
    status: "idle" | "preview" | "applying" | "applied" | "failed";
    completedSteps: string[];
    warnings: string[];
    errors: string[];
    createdAt: string;
    appliedAt?: string;
  };
  steps: SeasonTransitionStepResponse[];
  seasonReview?: SeasonReviewResponse;
  warnings: string[];
  blockingReasons: string[];
  saveContext: {
    saveId: string;
    fromSeasonId: string;
    toSeasonId: string;
  };
};

export type SeasonTransitionApiResponse = {
  success: boolean;
  summary: SeasonTransitionSummaryResponse | null;
  warnings?: string[];
  blockingReasons?: string[];
  error?: string;
};

export type SeasonCompletionSummaryResponse = {
  ok: boolean;
  dryRun: boolean;
  applied: boolean;
  status: "ready" | "applied" | "blocked";
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  steps: Array<{
    key: string;
    label: string;
    status: "planned" | "applied" | "already_done" | "blocked" | "skipped";
    warnings: string[];
    blockingReasons: string[];
    auditId: string | null;
  }>;
  seasonReview?: SeasonReviewResponse;
  cashApply?: FoundationApplySummary;
  relationships?: {
    generatedEvents: Array<unknown>;
    insertedEvents: number;
    replacedPreviewEvents: number;
    totalEvents: number;
    warnings: string[];
  };
  snapshot?: FoundationSeasonSnapshotSummary;
  transition?: SeasonTransitionSummaryResponse;
  aiSeasonAudit?: {
    totals: {
      aiDrafts: number;
      captainUses: number;
      formCardUses: number;
      teamPowerUses: number;
      mutatorTraits: number;
      pushSides: number;
    };
    rates: {
      aiDraftCoveragePct: number;
      aiCaptainPerDraftPct: number;
      aiFormCardPerDraftPct: number;
      aiPushSidePct: number;
      aiMutatorTraitPerSidePct: number;
    };
    teams?: Array<{
      teamId: string;
      teamCode: string;
      teamName: string;
      controlMode: TeamControlMode;
      drafts: number;
      captainUses: number;
      formCardUses: number;
      teamPowerUses: number;
      mutatorTraits: number;
      pushSides: number;
      conserveSides: number;
      normalSides: number;
      warnings: string[];
    }>;
    warnings: string[];
  };
  warnings: string[];
  blockingReasons: string[];
};

export type SeasonCompletionApiResponse = {
  success: boolean;
  summary: SeasonCompletionSummaryResponse | null;
  warnings?: string[];
  blockingReasons?: string[];
  error?: string;
};

export const SEASON_TRANSITION_STATIC_STEPS: SeasonTransitionStepResponse[] = [
  {
    stepId: "season_check",
    label: "Saison prüfen",
    status: "open",
    preview: "Prüft, ob der letzte Spieltag abgeschlossen ist.",
    warnings: [],
    blockingReasons: [],
    canApply: false,
  },
  {
    stepId: "season_review",
    label: "Saisonrückblick",
    status: "open",
    preview: "Zeigt Rückblick, Highlights und vorhandene Saisonquellen.",
    warnings: [],
    blockingReasons: [],
    canApply: false,
  },
  {
    stepId: "season_rewards",
    label: "Finanzen",
    status: "open",
    preview: "Preview für Preisgeld, Cash, Facility-Unterhalt und Einnahmen.",
    warnings: [],
    blockingReasons: [],
    canApply: false,
  },
  {
    stepId: "player_development",
    label: "Spielerentwicklung",
    status: "open",
    preview: "XP und Progression bleiben in V1 preview-only.",
    warnings: [],
    blockingReasons: [],
    canApply: false,
  },
  {
    stepId: "preseason_management",
    label: "Pre-Season Management",
    status: "open",
    preview: "Training, Gebäude, Scouting und Management werden vorbereitet.",
    warnings: [],
    blockingReasons: [],
    canApply: false,
  },
  {
    stepId: "transfer_sell_phase",
    label: "Verkäufe",
    status: "open",
    preview: "Verkaufsphase wird als eigener Schritt sichtbar gemacht.",
    warnings: [],
    blockingReasons: [],
    canApply: false,
  },
  {
    stepId: "transfer_buy_phase",
    label: "Käufe",
    status: "open",
    preview: "Kaufphase wird erst nach Verkäufen freigegeben.",
    warnings: [],
    blockingReasons: [],
    canApply: false,
  },
  {
    stepId: "lineup_setup",
    label: "Setup neue Saison",
    status: "open",
    preview: "Lineups und neue Saisonvorbereitung werden später geprüft.",
    warnings: [],
    blockingReasons: [],
    canApply: false,
  },
  {
    stepId: "next_season_ready",
    label: "Neue Saison starten",
    status: "open",
    preview: "Start erfolgt über den bestaetigten Pre-Season Workflow.",
    warnings: ["next_season_apply_requires_preseason_confirm"],
    blockingReasons: [],
    canApply: false,
  },
];

export type TransfermarktBuyPreviewSubject = Pick<TransfermarktFreeAgentItem, "playerId" | "name" | "className" | "race"> &
  Partial<Pick<TransfermarktFreeAgentItem, "portraitUrl" | "marketValue" | "salary" | "bracket" | "ovr" | "mvs">>;

export type TransfermarktBuyRequestContext = {
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  source: "sqlite" | "prisma";
  view: FoundationView;
};

export type TransfermarktSellSummary = {
  canSell: boolean;
  blockingReasons: string[];
  warnings: string[];
  player: {
    id: string;
    name: string;
    className: string;
    race: string;
  } | null;
  team: {
    id: string;
    name: string;
    shortCode: string;
  } | null;
  activePlayer: {
    id: string;
    playerId: string;
    status: string;
    roleTag: string;
    contractLength: number;
    salary: number;
    purchasePrice: number | null;
    currentValue: number | null;
    joinedSeasonId: string;
  } | null;
  cashBefore: number | null;
  cashAfter: number | null;
  rosterBefore: number | null;
  rosterAfter: number | null;
  teamSalaryBefore: number | null;
  teamSalaryAfter: number | null;
  marketValueReference: number | null;
  saleFactor: number | null;
  salePrice: number | null;
  buyoutCost?: number | null;
  netProceeds?: number | null;
  profit: number | null;
  salaryReduction: number | null;
  projectedReadinessAfterSell: string | null;
  activePlayerRemoved?: boolean;
  transferCreated?: boolean;
  teamSeasonStateUpdated?: boolean;
  transferId?: string | null;
  pricingPolicyMultiplier?: number | null;
  coaching?: {
    doctrinePersona: string;
    doctrineHint: string;
    strategyFitSummary: string;
    sellDecisionLabel: string | null;
    sellPriority: number | null;
    sellIntentScore: number | null;
    keepIntentScore: number | null;
    reasonsToSell: string[];
    reasonsToKeep: string[];
    coachingWarnings: string[];
    boardTrustPolicy: string | null;
    boardTrustSmiley: string | null;
    boardReaction: {
      confidenceDelta: number;
      severity: string;
      title: string;
      description: string;
      gmNote: string | null;
      requiresStrongAcknowledgment: boolean;
    };
    gmName: string | null;
    gmArchetype: string | null;
    gmPressureLevel: string;
    gmWarning: string | null;
    gmDetail: string | null;
    gmSoftBlockStarSell: boolean;
    replacementSlot: {
      slotLabel: string;
      maxBuyPrice: number | null;
      minOvrBand: number | null;
      urgency: string;
    } | null;
    pricingPolicyNotes: string[];
    soldPlayerSeasonBanNote: string;
  } | null;
};

export type TransfermarktSellApiResponse = {
  success: boolean;
  summary: TransfermarktSellSummary | null;
  warnings: string[];
  error?: string;
};

export type TransfermarktSellPreviewSubject = {
  activePlayerId: string;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  portraitUrl?: string | null;
};

export type FoundationAiTransferPreviewRecommendation = {
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
  cashAfter: number | null;
  rosterAfter: number | null;
  salaryAfter: number | null;
  fitSummary: string;
  sportsSummary: string;
  budgetReason: string[];
  warnings: string[];
  overallRecommendationScore: number;
  score: number;
  reason: string;
  fitNotes: string[];
  riskNotes: string[];
  strategyNotes: string[];
};

export type FoundationAiTransferPreviewTeam = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  aiTransferPreviewEnabled: boolean;
  status: "ready" | "warning" | "blocked";
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
  topTargets: FoundationAiTransferPreviewRecommendation[];
  recommendedBuys: FoundationAiTransferPreviewRecommendation[];
  skippedTargets: Array<{
    playerId: string;
    name: string;
    reason: string;
    blockingReasons: string[];
  }>;
  warnings: string[];
  explanation: string;
};

export type FoundationAiTransferPreviewResponse = {
  readOnly: true;
  source: "sqlite" | "prisma";
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: "ai" | "all";
  } | null;
  totalTeams: number;
  aiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  teams: FoundationAiTransferPreviewTeam[];
  error?: string;
};

export type FoundationAiSellPreviewCandidate = {
  activePlayerId: string;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  raceName: string;
  ovr: number | null;
  mvs: number | null;
  salary: number | null;
  marketValue: number | null;
  expectedSellValue: number | null;
  contractLength: number | null;
  rosterAfter: number | null;
  salaryAfter: number | null;
  cashAfter: number | null;
  sportValueSummary: string;
  performanceSummary: string;
  strategyFitSummary: string;
  reasonToSell: string[];
  reasonToKeep: string[];
  reasonsToSell: string[];
  reasonsToKeep: string[];
  warnings: string[];
  sellPriority: number;
  sellPriorityScore: number;
};

export type FoundationAiSellPreviewTeam = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  aiSellPreviewEnabled: boolean;
  status: "ready" | "no_sell_need" | "low_roster_depth" | "no_candidates" | "warning" | "blocked";
  strategySummary: string;
  cash: number | null;
  rosterCount: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
  rosterSize: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  targetRosterMin: number | null;
  targetRosterOpt: number | null;
  budgetPressure: "healthy" | "tight" | "critical" | "unknown";
  sellCandidates: FoundationAiSellPreviewCandidate[];
  keepCore: FoundationAiSellPreviewCandidate[];
  warnings: string[];
  blockingReasons: string[];
  explanation: string;
};

export type FoundationAiSellPreviewResponse = {
  readOnly: true;
  source: "sqlite" | "prisma";
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: "ai" | "all";
  } | null;
  totalTeams: number;
  aiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  teams: FoundationAiSellPreviewTeam[];
  error?: string;
};

export type FoundationAiMarketPlanTeam = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  aiTransferPreviewEnabled: boolean;
  aiSellPreviewEnabled: boolean;
  status: "hold" | "buy_only" | "sell_only" | "sell_then_buy" | "warning" | "blocked";
  strategySummary: string;
  currentState: {
    cash: number | null;
    rosterCount: number | null;
    playerMin: number | null;
    playerOpt: number | null;
    salaryTotal: number | null;
    marketValueTotal: number | null;
  };
  sellPlan: {
    candidates: FoundationAiSellPreviewCandidate[];
    totalExpectedSellValue: number | null;
    salaryFreed: number | null;
    expectedSellValue: number | null;
    rosterAfterSell: number | null;
    warnings: string[];
  };
  buyPlan: {
    candidates: FoundationAiTransferPreviewRecommendation[];
    plannedSpend: number | null;
    plannedSalaryAdded: number | null;
    rosterAfterBuy: number | null;
    warnings: string[];
  };
  projectedState: {
    cashAfterPlan: number | null;
    rosterAfterPlan: number | null;
    salaryAfterPlan: number | null;
    marketValueAfterPlan: number | null;
  };
  planSteps: Array<{
    stepType: "sell" | "buy" | "hold" | "warning";
    playerId?: string | null;
    playerName?: string | null;
    amount?: number | null;
    salaryImpact?: number | null;
    rosterImpact?: number | null;
    reason: string;
    sourceStatus: "mapped" | "partial" | "missing_source";
  }>;
  reasons: string[];
  warnings: string[];
  blockingReasons: string[];
};

export type FoundationAiMarketPlanPreviewResponse = {
  readOnly: true;
  source: "sqlite" | "prisma";
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: "ai" | "all";
  } | null;
  totalTeams: number;
  aiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  holdTeams: number;
  buyOnlyTeams: number;
  sellOnlyTeams: number;
  sellThenBuyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  summary: {
    aiTeams: number;
    ready: number;
    hold: number;
    buyOnly: number;
    sellOnly: number;
    sellThenBuy: number;
    warning: number;
    blocked: number;
  };
  teams: FoundationAiMarketPlanTeam[];
  error?: string;
};

export type FoundationAiNeedsPicksCompareTeam = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  currentRosterState: {
    cash: number | null;
    salaryTotal: number | null;
    rosterCount: number | null;
    targetRosterSize: number | null;
    targetRosterGap: number | null;
    budgetStatus: "healthy" | "tight" | "critical" | "unknown";
  };
  openNeeds: Array<{
    axis: "pow" | "spe" | "men" | "soc" | "roster" | "star" | "core" | "depth" | "specialist" | "backup";
    label: string;
    importance: number;
    reason: string;
    sourceStatus: "mapped" | "partial" | "missing_source";
  }>;
  planner: {
    plannerSource: "retool_reference" | "local_inferred";
    slotPlan: string[];
    superstarAllowed: number;
    starAllowed: number;
    coreNeeded: number;
    specialistNeeded: number;
    depthNeeded: number;
    cheapFillNeeded: number;
    backupNeeded: number;
    laneGatePassed: boolean;
    blockingReasons: string[];
    warnings: string[];
  };
  cashStrategy: {
    strategySource: "retool_reference" | "local_inferred" | "missing_source";
    sourceStatus: "ready" | "partial" | "missing_source";
    startingCash: number | null;
    currentCash: number | null;
    targetRoster: number | null;
    minimumRoster: number | null;
    currentRoster: number | null;
    missingMinimumSlots: number;
    missingTargetSlots: number;
    expectedMinimumSlotCost: number | null;
    reservedCashForMinimum: number | null;
    reservedCashForDepth: number | null;
    availableCashForCurrentPick: number | null;
    maxSpendPerPick: number | null;
    maxSpendByLane: Record<string, number | null>;
    cashAggression: number;
    cashDiscipline: number;
    overspendTolerance: number;
    shouldSaveCash: boolean;
    canBuyStar: boolean;
    canBuySuperstar: boolean;
    financePosture:
      | "conservative"
      | "balanced"
      | "aggressive"
      | "desperate"
      | "value_hunter"
      | "cash_rich_but_cautious"
      | "cash_poor_forced_fill";
    spendFactor: number | null;
    allowedBudgetForSearch: number | null;
    attackPressure: number;
    savingsBias: number;
    minCashBuffer: number | null;
    rosterPressure: number;
    needPressure: number;
    spendArchitecture: {
      allowed_budget_for_search: number | null;
      maxSpendTotalThisWindow: number | null;
      maxSpendPerPick: number | null;
      maxSpendByLane: Record<string, number | null>;
      premiumSlotCount: number;
      starSlotCount: number;
      coreSlotCount: number;
      specialistSlotCount: number;
      depthSlotCount: number;
      fillSlotCount: number;
      reserveSlotCount: number;
      minCashBuffer: number | null;
      reservedCashForMinimum: number | null;
      reservedCashForDepth: number | null;
      attackPressure: number;
      savingsBias: number;
      rosterPressure: number;
      needPressure: number;
      financePosture: string;
      spendFactor: number | null;
      reason: string;
    };
    expectedPrizeSignal: {
      expectedPrizeCurrentSeason: number | null;
      expectedPrizeNextSeason1: number | null;
      expectedPrizeNextSeason2: number | null;
      expectedPrizeNextSeason3: number | null;
      expectedPrizeNextSeason4: number | null;
      expectedPrizeFiveSeasonSum: number | null;
      expectedPrizeTrend: "up" | "down" | "flat" | "volatile" | "unknown";
      prizeConfidence: "ready" | "partial" | "missing_source";
      prizeSourceStatus: "ready" | "partial" | "missing_source";
      flowPolicy: "season_end_only" | "missing_source";
      warnings: string[];
    };
    financesValue: number;
    ambitionValue: number;
    boardPressureValue: number;
    harmonyValue: number;
    warnings: string[];
  };
  budgetLanes: Array<{
    lane: string;
    spendCap: number | null;
    priceCap: number | null;
    salaryCap: number | null;
    maxCashShare: number | null;
    minNeedScore: number;
    minTeamFitScore: number;
    allowedWhenUnderMinimum: boolean;
    cheaperAlternativeCheck: boolean;
    reason: string;
    plannedSlots: number;
    remainingSlots: number;
    spendUsed: number;
    active: boolean;
  }>;
  candidatePoolTop: Array<{
    candidateId: string;
    playerId: string;
    playerName: string;
    className: string;
    race: string;
    price: number | null;
    salary: number | null;
    ovr: number | null;
    mvs: number | null;
    candidateAxis: "pow" | "spe" | "men" | "soc" | null;
    bestNeedDisciplineId: string | null;
    finalScore: number;
    scoreBreakdown: {
      playerQualityScore: number;
      needMatchScore: number;
      disciplineCoverageScore: number;
      teamIdentityScore: number;
      classDisciplineFitScore: number;
      rosterBalanceScore: number;
      budgetFitScore: number;
      valueScore: number;
      harmonyFitScore: number;
      riskPenalty: number;
      duplicateProfilePenalty: number;
      offThemePenalty: number;
      classSpamPenalty: number;
    };
    reasons: string[];
  }>;
  plannedPicks: Array<{
    step: number;
    lane: string;
    pickLane: string;
    laneReason: string;
    laneBudgetLimit: number | null;
    laneBudgetUsed: number | null;
    playerId: string;
    playerName: string;
    className: string;
    race: string;
    price: number | null;
    salary: number | null;
    ovr: number | null;
    mvs: number | null;
    candidateAxis: "pow" | "spe" | "men" | "soc" | null;
    bestNeedDisciplineId: string | null;
    isSuperstar: boolean;
    isStar: boolean;
    starPressureWarning: string | null;
    cheaperAlternativeAvailable: boolean;
    specialistNeedFilled: boolean;
    coreNeedFilled: boolean;
    depthNeedFilled: boolean;
    finalScore: number;
    scoreBreakdown: {
      playerQualityScore: number;
      needMatchScore: number;
      disciplineCoverageScore: number;
      teamIdentityScore: number;
      classDisciplineFitScore: number;
      rosterBalanceScore: number;
      budgetFitScore: number;
      laneFitScore: number;
      valueScore: number;
      harmonyFitScore: number;
      riskPenalty: number;
      duplicateProfilePenalty: number;
      offThemePenalty: number;
      classSpamPenalty: number;
    };
    reasons: string[];
  }>;
  sequentialStateSnapshots: Array<{
    step: number;
    lane: string;
    rosterCountBefore: number | null;
    rosterCountAfter: number | null;
    cashBefore: number | null;
    cashAfter: number | null;
    salaryBefore: number | null;
    salaryAfter: number | null;
    laneBudgetUsed: number | null;
    laneBudgetRemaining: number | null;
    laneSlotsRemaining: number;
    remainingOpenNeedAxes: string[];
    pickedPlayerIds: string[];
  }>;
  compareStatus: "matched" | "partial" | "deviated" | "retool_pick_source_missing" | "blocked";
  retoolTopPicksStatus: "available" | "retool_pick_source_missing";
  retoolTopPicks: Array<{
    rank: number;
    playerName: string;
    sourceFile: string;
    note: string;
  }>;
  retoolReferenceFiles: string[];
  matches: string[];
  deviations: Array<{
    step: number;
    expectedPlayerName: string | null;
    actualPlayerName: string | null;
    reason: string;
  }>;
  deviationReasons: string[];
  warnings: string[];
};

export type FoundationAiNeedsPicksCompareResponse = {
  readOnly: true;
  source: "sqlite" | "prisma";
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: "ai" | "all";
    compareSet: string[];
  } | null;
  totalTeams: number;
  aiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  comparedTeams: number;
  matchedTeams: number;
  partialTeams: number;
  deviatedTeams: number;
  missingRetoolTeams: number;
  blockedTeams: number;
  retoolParityMatrix: Array<{
    retoolFile: string;
    purpose: string;
    localAppFile: string;
    status: "ported" | "partially_ported" | "referenced_only" | "missing" | "obsolete";
    openGap: string;
  }>;
  teams: FoundationAiNeedsPicksCompareTeam[];
  error?: string;
};

export type FoundationAiMarketPlanApplyTeamResult = {
  teamId: string;
  teamName: string;
  result:
    | "hold"
    | "planned"
    | "applied"
    | "skipped_manual"
    | "skipped_passive"
    | "skipped_disabled"
    | "skipped_warning"
    | "blocked"
    | "failed_sell"
    | "failed_buy";
  plannedSells: number;
  plannedBuys: number;
  executedSells: number;
  executedBuys: number;
  warnings: string[];
  blockingReasons: string[];
};

export type FoundationAiMarketPlanApplyResponse = {
  source: "sqlite";
  readOnly: boolean;
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied" | "partial_blocked";
  saveContext: {
    source: "sqlite";
    requestedSaveId: string | null;
    resolvedSaveId: string | null;
    requestedSeasonId: string | null;
    resolvedSeasonId: string | null;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  };
  summary: {
    totalTeams: number;
    eligibleAiTeams: number;
    skippedManual: number;
    skippedPassive: number;
    skippedDisabled: number;
    plannedSells: number;
    plannedBuys: number;
    blockedSells: number;
    blockedBuys: number;
    appliedSells: number;
    appliedBuys: number;
    warningTeams: number;
    blockedTeams: number;
    holdTeams: number;
    plannedWrites: number;
  };
  results: FoundationAiMarketPlanApplyTeamResult[];
  warnings: string[];
  blockingReasons: string[];
  error?: string;
};

export type FoundationAutoRosterFillAcquisition = {
  playerId: string;
  playerName: string;
  purchasePrice: number | null;
  salary: number | null;
  contractLength: number;
  transferHistoryId: string | null;
  recommendationScore: number | null;
  status: "planned" | "applied";
  warnings: string[];
  blockingReasons: string[];
};

export type FoundationAutoRosterFillTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  targetRosterSize: number | null;
  targetSource: "team_identity_player_opt" | "strategy_profile_roster_opt" | "target_roster_size_missing";
  rosterBefore: number;
  rosterAfter: number;
  missingBefore: number | null;
  missingAfter: number | null;
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  marketValueBefore: number | null;
  marketValueAfter: number | null;
  freeAgentsAvailable: number | null;
  acquiredPlayers: FoundationAutoRosterFillAcquisition[];
  transferHistoryIds: string[];
  warnings: string[];
  blockingReasons: string[];
  status:
    | "already_at_target"
    | "planned"
    | "filled"
    | "partially_filled"
    | "target_roster_size_missing"
    | "target_unreachable_cash"
    | "target_unreachable_no_free_agents"
    | "buy_blocked_by_existing_rules";
};

export type FoundationAutoRosterFillResponse = {
  source: "sqlite";
  readOnly: boolean;
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied";
  saveContext: {
    source: "sqlite";
    requestedSaveId: string | null;
    resolvedSaveId: string | null;
    requestedSeasonId: string | null;
    resolvedSeasonId: string | null;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  };
  summary: {
    totalTeams: number;
    targetResolvedTeams: number;
    missingTargetTeams: number;
    teamsNeedingBuys: number;
    alreadyAtTargetTeams: number;
    filledTeams: number;
    partialTeams: number;
    blockedTeams: number;
    plannedBuys: number;
    appliedBuys: number;
    historyWrites: number;
  };
  teams: FoundationAutoRosterFillTeamResult[];
  warnings: string[];
  blockingReasons: string[];
  error?: string;
};

export type FoundationAiPreseasonAutomationRun = {
  runId: string;
  seasonId: string;
  status: "running" | "completed" | "failed" | "skipped";
  mode: "setup_draft" | "season_market" | "none";
  startedAt: string;
  completedAt?: string | null;
  aiTeamsTotal: number;
  aiTeamsCompleted: number;
  managerActionsApplied: number;
  transferBuysApplied: number;
  transferSellsApplied: number;
  warnings: string[];
  blockingReasons: string[];
};

export type FoundationAiPreseasonAutomationResponse = {
  ok: boolean;
  skipped: boolean;
  accepted?: boolean;
  reason?: string;
  run: FoundationAiPreseasonAutomationRun;
  error?: string;
};

export type FoundationAiPickAuditResetTeamPickedPlayer = {
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  source: string;
  transferId: string;
  purchasePrice: number | null;
  salary: number | null;
  pow: number;
  spe: number;
  men: number;
  soc: number;
  estimatedTeamFit: number | null;
  profileScore: number | null;
  warnings: string[];
};

export type FoundationAiPickAuditResetTeamRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  targetRosterSize: number | null;
  targetSource: "team_identity_player_opt" | "strategy_profile_roster_opt" | "target_roster_size_missing";
  currentRosterCount: number;
  autoPickedCount: number;
  autoPickedPlayers: FoundationAiPickAuditResetTeamPickedPlayer[];
  classDistribution: Array<{ label: string; count: number }>;
  raceDistribution: Array<{ label: string; count: number }>;
  axisDistribution: {
    pow: number | null;
    spe: number | null;
    men: number | null;
    soc: number | null;
  };
  estimatedTeamFit: number | null;
  warningFlags: string[];
};

export type FoundationAiPickAuditResetCandidate = {
  transferId: string;
  source: string;
  status: "safe_reset" | "blocked_reset";
  historyAction: "append_revert_entry_keep_original" | "blocked_keep_original";
  playerId: string;
  playerName: string;
  className: string | null;
  teamId: string;
  teamCode: string;
  teamName: string;
  rosterEntryId: string | null;
  purchasePrice: number;
  salary: number;
  contractLength: number;
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  rosterBefore: number;
  rosterAfter: number;
  wouldAppendHistorySource: string | null;
  blockingReasons: string[];
};

export type FoundationAiPickAuditResetResponse = {
  source: "sqlite";
  readOnly: boolean;
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied" | "partial_applied";
  saveContext: {
    source: "sqlite";
    requestedSaveId: string | null;
    resolvedSaveId: string | null;
    requestedSeasonId: string | null;
    resolvedSeasonId: string | null;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  };
  summary: {
    totalTransfersInSave: number;
    autoTransfersFound: number;
    manualTransfersProtected: number;
    safeResetTransfers: number;
    blockedResetTransfers: number;
    affectedTeams: number;
    affectedPlayers: number;
    berserkerCount: number;
    warlordCount: number;
    berserkerWarlordSharePct: number | null;
    totalCashRefund: number | null;
    totalSalaryRelief: number | null;
  };
  globalAudit: {
    topClasses: Array<{ label: string; count: number }>;
    topRaces: Array<{ label: string; count: number }>;
    teamsWithWarnings: Array<{ teamId: string; teamName: string; warningCount: number; warnings: string[] }>;
    teamsWithClassSpam: Array<{ teamId: string; teamName: string; dominantClass: string; count: number }>;
  };
  teams: FoundationAiPickAuditResetTeamRow[];
  resetPreview: {
    candidates: FoundationAiPickAuditResetCandidate[];
    safeTransferIds: string[];
    blockedTransferIds: string[];
    wouldRemoveRosterEntries: number;
    wouldAppendHistoryEntries: number;
    wouldWriteLogs: number;
  };
  resetExecution: {
    revertedTransferIds: string[];
    protectedTransferIds: string[];
    appendedHistoryIds: string[];
    logIds: string[];
  };
  recommendedRecovery:
    | {
        action: "create_fresh_test_save";
        suggestedName: string;
        reason: string;
      }
    | null;
  warnings: string[];
  blockingReasons: string[];
  error?: string;
};

export type FoundationSeasonStartResetTeamRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  currentCash: number | null;
  resetCash: number | null;
  currentRosterCount: number;
  resetRosterCount: number;
  currentTransferCount: number;
  warnings: string[];
};

export type FoundationSeasonStartResetResponse = {
  source: "sqlite";
  readOnly: false;
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied";
  saveContext: {
    source: "sqlite";
    requestedSaveId: string | null;
    resolvedSaveId: string | null;
    requestedSeasonId: string | null;
    resolvedSeasonId: string | null;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  };
  summary: {
    currentTransfers: number;
    resetTransfers: number;
    currentRosterEntries: number;
    resetRosterEntries: number;
    currentMatchdayResults: number;
    resetMatchdayResults: number;
    currentStoredLineups: number;
    resetStoredLineups: number;
    teamsAffected: number;
    startCashSource: "reference" | "fresh_seed_fallback";
    startCashRowsApplied: number;
  };
  teams: FoundationSeasonStartResetTeamRow[];
  warnings: string[];
  blockingReasons: string[];
  error?: string;
};

export type FoundationAiLineupBatchApplyTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  aiEligible: boolean;
  previewStatus: string;
  captainSlotsUsed: number | null;
  captainSlotsRemaining: number | null;
  d1CaptainSelectionStatus: string | null;
  d2CaptainSelectionStatus: string | null;
  result:
    | "saved"
    | "skipped_warning"
    | "skipped_blocked"
    | "skipped_existing"
    | "skipped_manual"
    | "skipped_passive"
    | "skipped_disabled"
    | "failed_validation";
  overwriteExisting: boolean;
  warnings: string[];
  blockingReasons: string[];
  saved: boolean;
};

export type FoundationAiLineupBatchApplyResponse = {
  source: "sqlite";
  readOnly: false;
  dryRun: boolean;
  includeWarningTeams: boolean;
  totalTeams: number;
  results: FoundationAiLineupBatchApplyTeamResult[];
  summary: {
    totalTeams: number;
    aiEligibleTeams: number;
    skippedManual: number;
    skippedPassive: number;
    skippedDisabled: number;
    readyToSave: number;
    readyTeams: number;
    warningTeams: number;
    blockedTeams: number;
    wouldSave: number;
    savedTeams: number;
    skippedWarning: number;
    skippedBlocked: number;
    skippedExisting: number;
    existingLineups: number;
    wouldOverwrite: number;
    overwrittenExisting: number;
    plannedLineups: number;
    formCardsSelected?: number;
    negativeFormCardsSelected?: number;
    performanceBreakdown?: {
      formCardPlanningMs: number;
      aiLineupGenerationMs: number;
      lineupValidationMs: number;
      mutatorPlanningMs: number;
      saveWriteMs: number;
      contextLoadMs: number;
      teamPowerPlanningMs: number;
      totalMs: number;
    };
    warnings: string[];
    blockingReasons: string[];
  };
  error?: string;
};

export type FoundationMatchdayMvpLineupTeam = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  readinessBefore: string;
  rosterCount: number;
  requiredPlayers: number;
  targetRosterSize: number | null;
  targetSource: "team_identity_player_opt" | "strategy_profile_roster_opt" | "target_roster_size_missing";
  status:
    | "existing_lineup"
    | "auto_lineup_source"
    | "blocked_underfilled_roster"
    | "blocked_missing_scores"
    | "blocked_invalid_auto_lineup"
    | "blocked_missing_matchday_contract";
  autoGenerated: boolean;
  warnings: string[];
  blockingReasons: string[];
};

export type FoundationMatchdayMvpScoreboardRow = {
  teamId: string;
  teamName: string;
  baseScore: number;
  formCardStatus: "ready" | "missing_source";
  formCardLabel: string | null;
  formCardModifier: number | null;
  mutatorMode: "legacy_selected_traits" | "mvp_forced_mutators";
  mutator1Label: string | null;
  mutator1Modifier: number | null;
  mutator2Label: string | null;
  mutator2Modifier: number | null;
  captainStatus: "mapped" | "missing_source";
  captainModifier: number | null;
  fatigueStatus: "mapped" | "missing_source";
  fatigueModifier: number | null;
  teamPpsStatus: "ready" | "missing_source";
  teamPpsModifier: number | null;
  teamPowerStatus?: "ready" | "missing_source";
  teamPowerLabel?: string | null;
  teamPowerModifier?: number | null;
  teamPowerImpact?: number | null;
  score: number;
  rank: number;
  points: number | null;
  status: string;
  autoLineupSource: boolean;
  warnings: string[];
};

export type FoundationMatchdayMvpTopPlayerRow = {
  disciplineSide: "d1" | "d2";
  disciplineId: string;
  disciplineName: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  finalPlayerScore: number;
  pointsAwarded: number | null;
  mutatorPpsBonus: number | null;
  mutatorScoreBonus: number | null;
  mutatorSelectedTraitLabels?: string[];
  mutatorHitTraitLabels?: string[];
  rankInDiscipline: number;
};

export type FoundationMatchdayMvpScoringResponse = {
  source: "sqlite";
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied";
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  targetMatchday: {
    matchdayId: string;
    label: string;
    d1DisciplineId: string | null;
    d1DisciplineName: string | null;
    d2DisciplineId: string | null;
    d2DisciplineName: string | null;
  };
  rosterGate: {
    teamsBelowMinimum: number;
    teamsBelowTarget: number;
    teamsMissingTarget: number;
    warnings: string[];
  };
  lineupSummary: {
    totalTeams: number;
    existingLineups: number;
    autoGeneratedLineups: number;
    blockedTeams: number;
  };
  resolveSources: {
    formCardSourceStatus: "ready" | "missing_source";
    formCardSourceLabel: string | null;
    mutatorSourceStatus: "ready" | "missing_source";
    mutatorSourceLabel: string | null;
    captainSourceStatus: "mapped" | "missing_source";
    fatigueSourceStatus: "mapped" | "missing_source";
    teamPpsSourceStatus: "ready" | "missing_source";
  };
  lineupTeams: FoundationMatchdayMvpLineupTeam[];
  resolveStatus: string;
  mutatorMode: "mvp_forced_mutators";
  d1Scoreboard: FoundationMatchdayMvpScoreboardRow[];
  d2Scoreboard: FoundationMatchdayMvpScoreboardRow[];
  d1TopPlayers: FoundationMatchdayMvpTopPlayerRow[];
  d2TopPlayers: FoundationMatchdayMvpTopPlayerRow[];
  ppWinners: FoundationMatchdayMvpTopPlayerRow[];
  totalTeamsScored: number;
  resultApply: {
    applied: boolean;
    matchdayResultId: string | null;
    replacedExisting: boolean;
  };
  standingsApply: {
    applied: boolean;
    auditLogId: string | null;
  };
  warnings: string[];
  blockingReasons: string[];
  error?: string;
};

export type SaveActionRequest =
  | { action: "create"; name: string }
  | { action: "clone"; sourceSaveId: string; name: string }
  | { action: "snapshot"; sourceSaveId: string; name?: string }
  | { action: "activate"; saveId: string }
  | { action: "fresh-season-1"; name?: string }
  | { action: "delete"; saveIds: string[] };

export type NewGamePresetId = "solo_1" | "solo_2" | "solo_4" | "online_4v4" | "custom";
export type NewGameTeamPreview = {
  teamId: string;
  shortCode: string;
  name: string;
  budget: number;
  startRank: number;
  controlMode: TeamControlMode;
  ownerId: string;
  ownerLabel: string;
};
export type NewGameSetupPreview = {
  mode: "preview";
  presetId: NewGamePresetId;
  saveName: string;
  sandbox: boolean;
  scenarioType: string;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
  aiTeamIds: string[];
  teams: NewGameTeamPreview[];
  counts: { chris: number; franky: number; ai: number; passive: number; total: number };
  baseline: { playerCount: number; baselineCount: number; resetPlayers: number };
  seasonSetup: {
    seasonId: string;
    currentMatchday: number;
    gamePhase: string;
    matchdayCount: number;
    scheduleCount: number;
    formCardsStatus: string;
    lineupsStatus: string;
    standingsStatus: string;
  };
  room: { enabled: false } | { enabled: true; host: string; pendingParticipant: string; roomCode: string };
  warnings: string[];
  blockers: string[];
  confirmToken: string;
};
export type NewGameSetupApiResponse = {
  preview?: NewGameSetupPreview;
  result?: {
    mode: "applied";
    save: { saveId: string; name: string };
    previousActiveSaveId: string | null;
    preview: NewGameSetupPreview;
  };
  error?: string;
};

export const NEW_GAME_VISIBLE_PRESET_IDS: NewGamePresetId[] = ["solo_1", "online_4v4"];

export const NEW_GAME_PRESET_DEFAULTS: Record<NewGamePresetId, { label: string; chrisTeamIds: string[]; frankyTeamIds: string[]; online: boolean }> = {
  solo_1: { label: "Solo 1 Team", chrisTeamIds: ["M-M"], frankyTeamIds: [], online: false },
  solo_2: { label: "Solo 2 Teams", chrisTeamIds: ["M-M", "D-P"], frankyTeamIds: [], online: false },
  solo_4: { label: "Solo 4 Teams", chrisTeamIds: ["P-S", "D-P", "M-M", "V-W"], frankyTeamIds: [], online: false },
  online_4v4: {
    label: "Online 4v4",
    chrisTeamIds: ["P-S", "D-P", "M-M", "V-W"],
    frankyTeamIds: ["M-S", "P-C", "C-S", "G-G"],
    online: true,
  },
  custom: { label: "Custom", chrisTeamIds: ["M-M"], frankyTeamIds: [], online: false },
};

export type TeamIdentityDraftMap = Record<string, TeamIdentity>;
export type TeamControlDraftMap = Record<string, TeamControlSettings>;
export type TeamStrategyDraftMap = Record<string, TeamStrategyProfile>;
export const teamIdentityFieldLabels: Array<{
  key:
    | "pow"
    | "spe"
    | "men"
    | "soc"
    | "ambition"
    | "finances"
    | "boardConfidence"
    | "harmony"
    | "manners"
    | "popularity"
    | "cooperation"
    | "playerMin"
    | "playerOpt";
  label: string;
}> = [
  { key: "pow", label: "Power" },
  { key: "spe", label: "Speed" },
  { key: "men", label: "Mental" },
  { key: "soc", label: "Social" },
  { key: "ambition", label: "Ambition" },
  { key: "finances", label: "Finances" },
  { key: "boardConfidence", label: "Board Rating" },
  { key: "harmony", label: "Harmony" },
  { key: "manners", label: "Manners" },
  { key: "popularity", label: "Popularity" },
  { key: "cooperation", label: "Cooperation" },
  { key: "playerMin", label: "Player Min" },
  { key: "playerOpt", label: "Player Opt" },
];
export const teamStrategyBiasFieldLabels: Array<{ key: keyof TeamStrategyBias; label: string }> = [
  { key: "cashPriority", label: "Cash" },
  { key: "valuePriority", label: "Value" },
  { key: "starPriority", label: "Stars" },
  { key: "riskTolerance", label: "Risiko" },
  { key: "wageSensitivity", label: "Gehalt" },
  { key: "sellForProfitAggression", label: "Sell Profit" },
  { key: "shortContractPreference", label: "Kurzvertrag" },
  { key: "longContractPreference", label: "Langvertrag" },
  { key: "loyaltyBias", label: "Loyalitaet" },
  { key: "harmonyStrictness", label: "Harmonie" },
  { key: "rosterDepthPreference", label: "Depth" },
  { key: "eliteSmallRosterPreference", label: "Elite klein" },
];
export const teamStrategyListFieldLabels: Array<{
  key:
    | "preferredArchetypes"
    | "avoidedArchetypes"
    | "preferredRaces"
    | "avoidedRaces"
    | "preferredClasses"
    | "avoidedClasses"
    | "hardNoGos";
  label: string;
}> = [
  { key: "preferredArchetypes", label: "Preferred Archetypes" },
  { key: "avoidedArchetypes", label: "Avoided Archetypes" },
  { key: "preferredRaces", label: "Preferred Races" },
  { key: "avoidedRaces", label: "Avoided Races" },
  { key: "preferredClasses", label: "Preferred Classes" },
  { key: "avoidedClasses", label: "Avoided Classes" },
  { key: "hardNoGos", label: "Hard No-Gos" },
];
export const teamStrategyIdentityListFieldLabels: Array<{
  key:
    | "preferredArchetypes"
    | "secondaryArchetypes"
    | "dislikedArchetypes"
    | "preferredRaces"
    | "dislikedRaces"
    | "preferredClasses"
    | "dislikedClasses"
    | "preferredTraits"
    | "dislikedTraits"
    | "lockedNoGos"
    | "strategyWarnings";
  label: string;
}> = [
  { key: "preferredArchetypes", label: "Preferred Archetypes" },
  { key: "secondaryArchetypes", label: "Secondary Archetypes" },
  { key: "dislikedArchetypes", label: "Disliked Archetypes" },
  { key: "preferredRaces", label: "Preferred Races" },
  { key: "dislikedRaces", label: "Disliked Races" },
  { key: "preferredClasses", label: "Preferred Classes" },
  { key: "dislikedClasses", label: "Disliked Classes" },
  { key: "preferredTraits", label: "Preferred Traits" },
  { key: "dislikedTraits", label: "Disliked Traits" },
  { key: "lockedNoGos", label: "Locked No-Gos" },
  { key: "strategyWarnings", label: "Strategy Warnings" },
];
export const teamStrategyLevelFieldLabels: Array<{
  key:
    | "prefersDepth"
    | "prefersStars"
    | "prefersAllrounders"
    | "prefersSpecialists"
    | "shortContractsBias"
    | "longContractsBias"
    | "spendAggression"
    | "saveDiscipline"
    | "overpayTolerance"
    | "sellAggression"
    | "profitSellBias"
    | "loyaltyPreference"
    | "riskToleranceLevel"
    | "emergencyBuyBias";
  label: string;
}> = [
  { key: "prefersDepth", label: "Prefers Depth" },
  { key: "prefersStars", label: "Prefers Stars" },
  { key: "prefersAllrounders", label: "Prefers Allrounders" },
  { key: "prefersSpecialists", label: "Prefers Specialists" },
  { key: "shortContractsBias", label: "Short Contracts Bias" },
  { key: "longContractsBias", label: "Long Contracts Bias" },
  { key: "spendAggression", label: "Spend Aggression" },
  { key: "saveDiscipline", label: "Save Discipline" },
  { key: "overpayTolerance", label: "Overpay Tolerance" },
  { key: "sellAggression", label: "Sell Aggression" },
  { key: "profitSellBias", label: "Profit Sell Bias" },
  { key: "loyaltyPreference", label: "Loyalty Bias" },
  { key: "riskToleranceLevel", label: "Risk Tolerance" },
  { key: "emergencyBuyBias", label: "Emergency Buy Bias" },
];
export const teamStrategySportsBiasFieldLabels: Array<{
  key: "powBias" | "speBias" | "menBias" | "socBias";
  label: string;
}> = [
  { key: "powBias", label: "POW Bias" },
  { key: "speBias", label: "SPE Bias" },
  { key: "menBias", label: "MEN Bias" },
  { key: "socBias", label: "SOC Bias" },
];
export const teamStrategySportsBiasAxisMap = {
  powBias: "pow",
  speBias: "spe",
  menBias: "men",
  socBias: "soc",
} as const;

export type FoundationTransferHistoryItem = {
  transferId: string;
  type: "buy" | "sell" | "contract_exit";
  playerId: string;
  playerName: string;
  fromTeamId: string | null;
  fromTeamName: string | null;
  toTeamId: string | null;
  toTeamName: string | null;
  fee: number;
  salary: number;
  marketValue: number;
  happenedAt: string;
  saveId: string;
  seasonId: string;
  seasonLabel: string;
  matchdayId?: string | null;
  phase?: string | null;
  source?: string | null;
  remainingContractLength?: number | null;
};

export type FoundationTransferHistoryResponse = {
  items: FoundationTransferHistoryItem[];
  total: number;
  offset: number;
  limit: number;
  returned: number;
  hasMore: boolean;
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    type: "buy" | "sell" | "contract_exit" | null;
  } | null;
  saveContext?: {
    source: "sqlite" | "prisma";
    requestedSaveId: string | null;
    resolvedSaveId: string | null;
    requestedSeasonId: string | null;
    resolvedSeasonId: string | null;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  } | null;
  error?: string;
};

export type FoundationTransferRecapItem = {
  transferId: string;
  playerId: string;
  playerName: string;
  fromTeam: string | null;
  toTeam: string | null;
  type: "buy" | "sell" | "contract_exit";
  amount: number;
  salary: number;
  marketValue: number;
  ovr: number | null;
  pps: number | null;
  teamFit: number | null;
  strategyFitReason: string | null;
  cashBefore: number | null;
  cashAfter: number | null;
  rosterBefore: number | null;
  rosterAfter: number | null;
  reason: string;
  warnings: string[];
  realizedProfit: number | null;
  happenedAt: string;
};

export type FoundationTransferRecapTeamSummary = {
  teamId: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  buyCount: number;
  sellCount: number;
  spend: number;
  income: number;
  salaryFreed: number;
  netCashFlow: number;
  currentCash: number | null;
  currentRoster: number | null;
  currentSalary: number | null;
  currentMarketValue: number | null;
  strategySummary: string | null;
  warnings: string[];
};

export type FoundationTransferRecapResponse = {
  readOnly: true;
  source: "sqlite" | "prisma";
  scope: {
    saveId: string | null;
    seasonId: string | null;
    teamId: string | null;
  };
  saveContext?: {
    source: "sqlite" | "prisma";
    requestedSaveId: string | null;
    resolvedSaveId: string | null;
    requestedSeasonId: string | null;
    resolvedSeasonId: string | null;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  } | null;
  summary: {
    buys: number;
    sells: number;
    totalSpend: number;
    totalIncome: number;
    totalSalaryFreed: number;
  };
  topTransfersIn: FoundationTransferRecapItem[];
  topTransfersOut: FoundationTransferRecapItem[];
  biggestSpend: FoundationTransferRecapItem[];
  biggestProfit: FoundationTransferRecapItem[];
  bestValueDeals: FoundationTransferRecapItem[];
  riskyMoves: FoundationTransferRecapItem[];
  teamSummaries: FoundationTransferRecapTeamSummary[];
  warnings: string[];
  error?: string;
};

export type FoundationStandingsPreviewItem = {
  teamId: string;
  teamName: string;
  currentRank: number | null;
  projectedRank: number | null;
  currentPoints: number | null;
  projectedPoints: number | null;
  pointsDelta: number | null;
  matchdayRank: number | null;
  d1Score: number | null;
  d2Score: number | null;
  matchdayScore: number | null;
  totalScore: number | null;
  cash: number | null;
  readinessStatus: string;
  resultStatus: "ready" | "missing_result" | "incomplete_result" | "tie_warning";
  warnings: string[];
  blockedRules: string[];
};

export type FoundationStandingsPreviewResponse = {
  items: FoundationStandingsPreviewItem[];
  summary: {
    totalTeams: number;
    matchdayResultFound: boolean;
    readyTeams: number;
    blockedTeamCount: number;
  };
  blockedRules: string[];
  tieGroups: Array<{
    type: "totalScore" | "projectedPoints";
    value: number;
    affectedTeams: Array<{
      teamId: string;
      teamName: string;
    }>;
    requiresConfirmedTieBreaker: boolean;
  }>;
  source: {
    mode: "sqlite" | "prisma";
    matchdayResult: "local_saved_result" | "prisma_matchday_result" | "missing";
    currentPoints: "local_save_standings" | "sheet_mapping_ready" | "sheet_mapping_missing";
    standingsRules: "global_total_score_preview";
    fixtureCoverage: "not_required_local_results" | "missing_before_after_snapshots" | "before_after_snapshots_ready";
  };
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  } | null;
  error?: string;
};

export type FoundationPrizePreviewItem = {
  teamId: string;
  teamCode: string;
  teamName: string;
  rank: number | null;
  points: number | null;
  currentCash: number | null;
  prizeMoney: number | null;
  /** Projizierte Sponsor-Einnahme beim aktuellen Rang inkl. bereits erfüllter Ziele/Quests. */
  sponsorCash?: number | null;
  /** Gebäude-Einnahmen netto (Einnahmen − Unterhalt). */
  facilityIncome?: number | null;
  rankChangePrize?: {
    source: "retool" | "sheet" | "missing";
    startRankSource?: "standing_startplatz" | "standing_rank_diff" | "season1_start_budget" | "missing";
    startRank: number | null;
    finalRank: number | null;
    rankDelta: number | null;
    bonusMalus: number | null;
    warning?: string;
  };
  projectedCash: number | null;
  status: "ready" | "missing_rank" | "missing_prize" | "missing_cash" | "blocked";
  warnings: string[];
  basisCash?: number | null;
  seasonCash?: number | null;
  salaryTotal?: number | null;
  transferBalance?: number | null;
  payoutIfTenBetter?: number | null;
  payoutIfTenWorse?: number | null;
  projectedCashIfTenBetter?: number | null;
  projectedCashIfTenWorse?: number | null;
  futureSeasons?: Array<{
    seasonLabel: string;
    factor: number | null;
    salaryGrowthFactor?: number | null;
    prizeMoney: number | null;
    salaryTotal?: number | null;
    guv?: number | null;
    projectedCash: number | null;
  }>;
};

export type FoundationPrizePreviewResponse = {
  items: FoundationPrizePreviewItem[];
  blockedRules: string[];
  globalWarnings: string[];
  summary: {
    totalTeams: number;
    calculableTeams: number;
    prizeRowsCount: number;
    blockedItemsCount: number;
    currentFactor?: number | null;
    futureSeasonCount?: number;
    totalPrizeMoney?: number;
    totalRankChangePrize?: number | null;
    forecastSalaryFactorPassthrough?: number | null;
  };
  source: {
    mode: "sqlite" | "prisma";
    standings: "local_save" | "prisma_read_only_unsupported";
    prizeTable: "normalized_sheet" | "missing";
    placementTable?: "sheet" | "missing";
    seasonFactors?: "sheet" | "missing";
  };
  seasonFactors?: Array<{
    seasonLabel: string;
    factor: number | null;
  }>;
  scenarioWindow?: {
    betterBy: number;
    worseBy: number;
  };
  scope: {
    saveId: string;
    seasonId: string;
  } | null;
  error?: string;
};

export type FoundationSeasonManagementItem = {
  teamId: string;
  teamName: string;
  startBudget: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  warnings: string[];
};

export type FoundationSeasonManagementResponse = {
  items: FoundationSeasonManagementItem[];
  missingMappings: string[];
  source: {
    kind: "season_management_sheet";
    budgetColumn: "Startbudget";
  };
  scope: {
    saveId: string;
    seasonId: string;
  } | null;
  error?: string;
};

export type FoundationSeasonStandingsOverviewItem = {
  teamId: string;
  teamName: string | null;
  teamCode: string | null;
  rank: number | null;
  points: number | null;
  cash: number | null;
  cashFc: number | null;
  startplatz: number | null;
  rankDiff: number | null;
  sponsorBasis: number | null;
  sponsorRank: number | null;
  sponsorTotal: number | null;
  guv: number | null;
  cashTotal: number | null;
  form: number | null;
  transfers: number | null;
  rosterCount: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
  disciplineValues: Record<string, number | null>;
  warnings: string[];
};

export type FoundationSeasonStandingsOverviewResponse = {
  items: FoundationSeasonStandingsOverviewItem[];
  missingMappings: string[];
  mappingWarnings: string[];
  source: {
    kind: "season_standings_sheet" | "season_snapshot";
    access: "remote_csv" | "local_csv" | "local_json" | "local_save" | "missing";
    detectedColumns: string[];
    disciplineColumns: Array<{
      normalizedKey: string;
      sheetColumn: string;
    }>;
  };
  scope: {
    saveId: string;
    seasonId: string;
  } | null;
  error?: string;
};

export type FoundationResolvePreviewResponse = {
  source: "sqlite" | "prisma";
  params: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  summary: {
    teamsTotal: number;
    teamsWithLineup: number;
    teamsReady: number;
    teamsUnderfilled: number;
    missingLineups: number;
    teamsMissingLineup: number;
    teamsInvalidLineup: number;
    teamsMissingScoreCoverage: number;
    warningsCount: number;
    d1DisciplineId: string | null;
    d1DisciplineName: string | null;
    d2DisciplineId: string | null;
    d2DisciplineName: string | null;
  };
  preview: {
    status: "ready" | "incomplete_lineups" | "missing_lineups" | "missing_scores" | "missing_sources" | "blocked";
    warnings: string[];
    disciplinePreviews: Array<{
      disciplineId: string;
      disciplineName: string;
      disciplineSide: "d1" | "d2";
      ranking: Array<{
        teamId: string;
        teamName: string;
        rank: number | null;
        finalPreviewScore: number | null;
      }>;
      topPlayers: Array<{
        playerId: string;
        playerName: string;
        teamId: string;
        teamName?: string;
        finalPlayerScore: number;
      }>;
    }>;
    teamResults: Array<{
      teamId: string;
      teamName: string;
      status: string;
      d1Status: string;
      d2Status: string;
      totalPreviewScore: number | null;
    }>;
  };
  teamRows: Array<{
    teamId: string;
    teamName: string;
    status: string;
    readinessStatus: string;
    readinessReasonCodes: string[];
    activePlayersCount: number;
    requiredTotalUniquePlayers: number;
    missingPlayersToRequirement: number;
    topPlayer: string | null;
    shortReason: string;
  }>;
  topPlayers: {
    d1: Array<{
      playerId: string;
      playerName: string;
      teamId: string;
      teamName: string;
      finalPlayerScore: number;
    }>;
    d2: Array<{
      playerId: string;
      playerName: string;
      teamId: string;
      teamName: string;
      finalPlayerScore: number;
    }>;
  };
  warnings: string[];
  error?: string;
};

export type FoundationApplySummary = {
  ok: boolean;
  source: "sqlite" | "prisma";
  dryRun: boolean;
  applied: boolean;
  canApply?: boolean;
  previewStatus?: string;
  blockingReasons?: string[];
  warnings?: string[];
  auditLogId?: string | null;
  duplicateDetected?: boolean;
  summary?: {
    canApply?: boolean;
    blockingReasons?: string[];
    warnings?: string[];
    plannedChanges?: Array<Record<string, unknown>>;
    auditLogId?: string | null;
    duplicateDetected?: boolean;
    previewStatus?: string;
    matchdayResultId?: string;
  } & Record<string, unknown>;
  error?: string;
};

export type FoundationMatchdayAutoRunSummary = {
  ok: boolean;
  source: "sqlite" | "prisma";
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied";
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  summary: {
    lineupsReady: number;
    aiReady: number;
    manualReady: number;
    missingManualTeams: number;
    manualMissing: number;
    passiveReady: number;
    passiveMissing: number;
    warningTeams: number;
    resolveReady: boolean;
    resultApplyAllowed: boolean;
    standingsApplyAllowed: boolean;
    tieBlockers: number;
    cashApplyAllowed: boolean;
    advanceAllowed: boolean;
    plannedWrites: number;
    formCardsSelected?: number;
    negativeFormCardsSelected?: number;
  };
  steps: Array<{
    key: string;
    label: string;
    status: "ready" | "warning" | "blocked" | "planned" | "applied" | "skipped";
    dryRun: boolean;
    canContinue: boolean;
    warnings: string[];
    blockingReasons: string[];
    metrics: Record<string, number | string | boolean | null>;
    plannedWrites: number;
    appliedWrites: number;
    auditId: string | null;
  }>;
  warnings: string[];
  blockingReasons: string[];
  plannedWrites: Array<{
    step: string;
    count: number;
    label: string;
  }>;
  appliedAudits: {
    resultApply: string | null;
    standingsApply: string | null;
    cashApply: string | null;
    matchdayAdvance: string | null;
    aiLineupTeamsSaved: number;
  };
};

export type FoundationWholeSeasonDryRunSummary = {
  ok: boolean;
  readOnly: true;
  source: "sqlite" | "prisma";
  dryRun: true;
  simulationMode: "in_memory_local_copy";
  status: "ready" | "completed" | "warning" | "blocked";
  scope: {
    saveId: string;
    seasonId: string;
    startMatchdayId: string;
    totalMatchdays: number;
    maxMatchdays: number | null;
  };
  simulatedMatchdays: number;
  blockedAtMatchday: {
    matchdayId: string;
    label: string;
  } | null;
  tieBlockers: number;
  missingLineups: number;
  missingManualLineups: number;
  missingAiLineups: number;
  missingPassiveLineups: number;
  manualTeamsReady: number;
  aiTeamsReady: number;
  passiveTeamsReady: number;
  skippedDisabledAiTeams: number;
  missingFormulaSources: string[];
  missingPerformanceSources: string[];
  marketPhaseStatus: {
    status: "not_simulated" | "policy_missing";
    warning: string | null;
  };
  snapshotReadiness: {
    status: "ready" | "warning" | "blocked";
    canCreate: boolean;
    seasonCompleted: boolean;
    duplicateDetected: boolean;
    sourceStatus: "mapped" | "partial" | "missing_source";
    completedMatchdays: number;
    totalMatchdays: number;
    warnings: string[];
    blockingReasons: string[];
  };
  playerPPsReconciliation: {
    status: "reconciled" | "warning" | "missing_source";
    hasResultSource: boolean;
    playersWithPoints: number;
    pointEntries: number;
    totalPlayerPoints: number;
    warnings: string[];
  };
  teamPPsReconciliation: {
    status: "reconciled" | "warning" | "missing_source";
    hasResultSource: boolean;
    reconciledTeams: number;
    missingPlayerPointsTeams: number;
    failedTeams: number;
    totalTeamPoints: number;
    totalPlayerDerivedPoints: number;
    warnings: string[];
  };
  projectedFinalStandings: Array<{
    rank: number | null;
    teamId: string;
    teamCode: string;
    teamName: string;
    points: number | null;
    cash: number | null;
  }>;
  projectedCash: Array<{
    teamId: string;
    teamName: string;
    cash: number | null;
  }>;
  projectedCashTable: Array<{
    teamId: string;
    teamName: string;
    cash: number | null;
  }>;
  projectedTeamSummaries: Array<{
    rank: number | null;
    teamId: string;
    teamCode: string;
    teamName: string;
    points: number | null;
    cash: number | null;
    rosterCount: number;
    salaryTotal: number;
    avgContractLength: number | null;
    marketValueTotal: number | null;
  }>;
  teamSummaries: Array<{
    rank: number | null;
    teamId: string;
    teamCode: string;
    teamName: string;
    points: number | null;
    cash: number | null;
    rosterCount: number;
    salaryTotal: number;
    avgContractLength: number | null;
    marketValueTotal: number | null;
  }>;
  matchdays: Array<{
    matchdayId: string;
    label: string;
    status: "ready" | "warning" | "blocked" | "applied";
    lineupsReady: number;
    missingManualTeams: number;
    warningTeams: number;
    tieBlockers: number;
    plannedWrites: number;
    warnings: string[];
    blockingReasons: string[];
    steps: Array<{
      key: string;
      label: string;
      status: "ready" | "warning" | "blocked" | "planned" | "applied" | "skipped";
      dryRun: boolean;
      canContinue: boolean;
      warnings: string[];
      blockingReasons: string[];
      metrics: Record<string, number | string | boolean | null>;
      plannedWrites: number;
      appliedWrites: number;
      auditId: string | null;
    }>;
  }>;
  stepsByMatchday: Array<{
    matchdayId: string;
    label: string;
    status: "ready" | "warning" | "blocked" | "applied";
    lineupsReady: number;
    missingManualTeams: number;
    warningTeams: number;
    tieBlockers: number;
    plannedWrites: number;
    warnings: string[];
    blockingReasons: string[];
    steps: Array<{
      key: string;
      label: string;
      status: "ready" | "warning" | "blocked" | "planned" | "applied" | "skipped";
      dryRun: boolean;
      canContinue: boolean;
      warnings: string[];
      blockingReasons: string[];
      metrics: Record<string, number | string | boolean | null>;
      plannedWrites: number;
      appliedWrites: number;
      auditId: string | null;
    }>;
  }>;
  warnings: string[];
  blockingReasons: string[];
};

export type AdminSeasonSimulationRunSummary = {
  runId: string;
  saveId: string;
  requestedSeasons: 1 | 2 | 5;
  mode: "dry_run" | "apply";
  fullChurnStress: boolean;
  injuriesTestMode: boolean;
  status: "idle" | "running" | "paused" | "completed" | "blocked" | "cancelled";
  activePhase: string;
  activeSeasonId: string | null;
  activeMatchdayId: string | null;
  activeTeamId: string | null;
  currentOperation: string;
  startedAt: string;
  updatedAt: string;
  heartbeatAt: string;
  completedAt: string | null;
  durationMs: number;
  progressPct: number;
  reports: {
    directory: string;
    jsonl: string;
    summary: string;
  };
  logs: Array<{
    at: string;
    level: "red" | "yellow" | "info";
    phase: string;
    message: string;
  }>;
  issues: Array<{
    at: string;
    level: "red" | "yellow" | "info";
    phase: string;
    message: string;
    code: string;
  }>;
};

export type FoundationSeasonSnapshotSummary = {
  ok: boolean;
  readOnly: true;
  source: "sqlite" | "prisma";
  dryRun: boolean;
  canCreate: boolean;
  seasonCompleted: boolean;
  duplicateDetected: boolean;
  sourceStatus: "mapped" | "partial" | "missing_source";
  saveId: string | null;
  seasonId: string;
  snapshot: {
    snapshotId?: string;
    seasonId: string;
    seasonName: string;
    archivedAt: string;
    status?: "completed" | "partial" | "dry_run";
    finalStandings: Array<{
      teamId: string;
      teamCode: string;
      teamName: string;
      rank: number | null;
      points: number | null;
      cashEnd: number | null;
      rosterEnd: number;
      transferNet: number | null;
      disciplinePointsByArea: {
        pow: number | null;
        spe: number | null;
        men: number | null;
        soc: number | null;
      };
    }>;
    playerPerformances: Array<{
      playerId: string;
    }>;
    transferSnapshots?: Array<{
      transferId: string;
    }>;
    warnings?: string[];
  };
  existingSnapshot: {
    snapshotId?: string;
    seasonId: string;
    archivedAt: string;
  } | null;
  allTimeTable: Array<{
    teamId: string;
    teamName: string;
    seasonsPlayed: number;
    gold: number;
    silver: number;
    bronze: number;
    top5: number;
    top10: number;
    avgRank: number | null;
    totalHistoricalPoints: number | null;
  }>;
  coverage: {
    totalMatchdays: number;
    resultAppliedMatchdays: number;
    standingsAppliedMatchdays: number;
    cashAppliedMatchdays: number;
    completedMatchdayIds: string[];
    missingResultMatchdayIds: string[];
    missingStandingsMatchdayIds: string[];
    missingCashMatchdayIds: string[];
  };
  warnings: string[];
  blockingReasons: string[];
  applied: boolean;
  error?: string;
  summary?: FoundationSeasonSnapshotSummary;
};

export type PersistedFoundationTablePreferenceEntry = {
  version?: number;
  widths?: Record<string, number>;
  hiddenColumnIds?: string[];
  columnVisibility?: Record<string, boolean>;
  columnOrder?: string[];
  pinnedLeft?: string[];
  pinnedRight?: string[];
  activePreset?: FoundationTablePresetId | null;
};

export const FOUNDATION_TABLE_PREFERENCES_STORAGE_KEY = "foundation-table-preferences-v1";

export type PersistedFoundationTablePreferences = Record<
  string,
  PersistedFoundationTablePreferenceEntry
>;

// UI preference only: this drives the manager-facing default focus across views.
// It is not an authorization source; server-side team ownership remains the future authority.
export type ActiveManagerTeamSource = "manual_select" | "route" | "saved_preference" | "default_human_team";

export type ActiveManagerTeamContext = {
  teamId: string;
  source: ActiveManagerTeamSource;
  warning?: string | null;
};

export const FOUNDATION_MANAGER_TEAM_STORAGE_KEY = "foundation-active-manager-team-v1";
export const FOUNDATION_ACTIVE_OWNER_STORAGE_KEY = "foundation-active-owner-v1";
export const FOUNDATION_TEAM_FILTER_STORAGE_KEY = "foundation-team-filter-v1";
export const FOUNDATION_SAVE_MODE_STORAGE_KEY = "foundation-save-mode-v1";
export const RESULT_APPLY_CONFIRM_TOKEN = "APPLY_MATCHDAY_RESULT";
export const STANDINGS_APPLY_CONFIRM_TOKEN = "APPLY_LOCAL_STANDINGS";
export const CASH_APPLY_CONFIRM_TOKEN = "APPLY_LOCAL_CASH_PRIZE";
export const ADVANCE_MATCHDAY_CONFIRM_TOKEN = "ADVANCE_LOCAL_MATCHDAY";
export const MATCHDAY_MVP_SCORING_CONFIRM_TOKEN = "RUN_MATCHDAY_MVP_SCORING";
export const MATCHDAY_AUTO_RUN_CONFIRM_TOKEN = "RUN_LOCAL_MATCHDAY_AUTO";
export const TRANSFER_HISTORY_SEASON_LIMIT = 100;
export const TRANSFER_MARKET_INITIAL_RENDER_LIMIT = 48;
export const TRANSFER_MARKET_RENDER_STEP = 48;
