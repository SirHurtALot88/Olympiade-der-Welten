"use client";

import { useRef, useState } from "react";

import { GAME_ENCYCLOPEDIA_ENTRIES, getGameEncyclopediaEntry } from "@/lib/ui/game-encyclopedia";
import {
  FACILITY_CATALOG,
  getFacilityLevelDefinition,
  SPECIALIST_WING_VARIANTS,
  type FacilityId,
  type SpecialistWingVariant,
} from "@/lib/facilities/facility-catalog";
import {
  FOUNDATION_SAVE_MODE_OPTIONS,
  formatFoundationSaveModeLabel,
  normalizeFoundationSaveMode,
  resolveFoundationSaveMode,
  type FoundationSaveMode,
} from "@/lib/persistence/foundation-save-mode";
import type { SaveSummary } from "@/lib/persistence/types";
import type {
	  GameState,
	  GameInboxItem,
	  MappingWarning,
  AdminBalancingConfig,
  NewGameFlowStepId,
  NewGameFlowStepStatus,
  Player,
  PlayerGeneratorDraft,
  ContractNegotiationDraft,
  ContractShape,
  RosterEntry,
  Team,
  TeamControlMode,
  TeamControlSettings,
  TeamIdentity,
  TeamStrategyBias,
  TeamStrategyProfile,
  TransferSellMarkerEntry,
  TransferWishlistEntry,
  FormCardPlanRecord,
} from "@/lib/data/olyDataTypes";
import { getDefaultAdminBalancingConfig, resolveAdminBalancingConfig } from "@/lib/admin/balancing-config";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import {
  AI_OWNER_ID,
  DEFAULT_ACTIVE_OWNER_ID,
  applyChrisFrankyOwnershipToTeamControlSettings,
  applyGameModeOwnership,
  buildTeamControlSettingsMap,
  buildTeamOwners,
  canOwnerManageTeam,
  deriveChrisFrankyTeamIdsFromSettings,
  filterTeamsByControlScope,
  getGameModeOwnershipLimits,
  getTeamControlSettings,
  isAiLineupBatchApplyEnabled,
  mergeAiAutomationFromDraft,
  resolveGameModeFromState,
  type TeamControlFilter,
  withNormalizedTeamControlSettings,
} from "@/lib/foundation/team-control-settings";
import {
  buildTeamStrategyProfileMap,
  getTeamStrategyProfile,
  withNormalizedTeamStrategyProfiles,
} from "@/lib/foundation/team-strategy-profiles";
import type { SponsorNegotiationProfile } from "@/lib/data/olyDataTypes";
import {
  appendRoomContextToParams,
  readFoundationRoomContextFromLocation,
  withRoomContextBody,
  type FoundationRoomContext,
} from "@/lib/room/foundation-room-context-client";
import type { OlyRoomState, RoomRealtimeEvent } from "@/types/game";
import { normalizeFoundationViewParam, getDefaultFoundationViewTarget, type FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import {
  canFoundationNavigateBack,
  foundationNavigateBack,
  mergeFoundationHistoryReplaceState,
  parseFoundationFacilityFromUrl,
  parseFoundationPanelFromUrl,
  parseFoundationUrlStateFromLocation,
  readFoundationHistoryState,
  writeFoundationUrlState,
  type FoundationPanelId,
} from "@/lib/foundation/foundation-navigation-history";
import { parseFoundationPlayerIdFromUrl, parseFoundationTabFromUrl, syncFoundationUrlState, type FoundationUrlState } from "@/lib/foundation/foundation-url-state";
import {
  buildContextStatusChips,
  buildScenarioWarning,
  buildViewContextWarning,
  formatActiveManagerTeamSource,
  formatChancePercent,
  formatContractLengthPreferenceLabel,
  formatContractNumber,
  formatContractPreferenceCurrentStatus,
  formatContractPreferenceMatchLabel,
  formatContractShapeLabel,
  formatCsvList,
  formatDisciplineCategoryLabel,
  formatDisplayMoney,
  formatFeatureAuditStatus,
  formatGamePhaseLabel,
  formatIdentityWeight,
  formatMoney,
  formatMoraleContractIntentLabel,
  formatNullableMoney,
  formatNullablePps,
  formatPlayerRatingValue,
  formatPpsValue,
  formatScenarioTypeLabel,
  formatShortSaveId,
  formatSignedDisplayMoney,
  formatSignedNumber,
  formatSignedPercent,
  formatSignedTransfermarktCurrency,
  formatTeamControlModeLabel,
  formatWholeNumber,
  getAiLineupEnsureStatusClass,
  getAiMarketPlanStatusLabel,
  getAiMarketPlanStatusPillClass,
  getAiNeedsCompareStatusLabel,
  getAiNeedsCompareStatusPillClass,
  getAiPreseasonModeLabel,
  getAiPreseasonStatusClass,
  getAiPreseasonStatusLabel,
  getInboxCategoryIcon,
  getInboxCategoryLabel,
  getInboxSeverityLabel,
  getInboxSeverityPillClass,
  getInboxStatusLabel,
  getInboxStatusPillClass,
  getNegotiationFactorTone,
  getNegotiationOutcomeToneClass,
  getTransferSourceLabel,
  getTransferTypeLabel,
  getTransferTypePillClass,
  getViewSourceBadgeLabel,
  inferSaveTypeLabel,
  resolveScenarioMetaLabel,
  type DisciplineCategoryFilter,
  formatNegotiationSignalLabel,
  parseCsvList,
} from "@/lib/foundation/tabs/foundation-format-render-helpers";
import type {
  FoundationTableColumn,
  FoundationTablePreset,
  FoundationTablePresetId,
  SortState,
} from "@/lib/foundation/foundation-table-ui-types";
import { PLAYER_PROFILE_TABS, type PlayerProfileTabId } from "@/lib/foundation/player-profile-service";
import type {
  ActiveManagerTeamContext,
  ActiveManagerTeamSource,
  AdminSeasonSimulationRunSummary,
  ContractRenewalApiResponse,
  FacilityMaintenanceApiResponse,
  FacilityMaintenanceSummary,
  FacilityUpgradeApiResponse,
  FacilityUpgradeSummary,
  FoundationAiLineupBatchApplyResponse,
  FoundationAiLineupBatchApplyTeamResult,
  FoundationAiMarketPlanApplyResponse,
  FoundationAiMarketPlanApplyTeamResult,
  FoundationAiMarketPlanPreviewResponse,
  FoundationAiMarketPlanTeam,
  FoundationAiNeedsPicksCompareResponse,
  FoundationAiNeedsPicksCompareTeam,
  FoundationAiPickAuditResetCandidate,
  FoundationAiPickAuditResetResponse,
  FoundationAiPickAuditResetTeamPickedPlayer,
  FoundationAiPickAuditResetTeamRow,
  FoundationAiPreseasonAutomationResponse,
  FoundationAiPreseasonAutomationRun,
  FoundationAiSellPreviewCandidate,
  FoundationAiSellPreviewResponse,
  FoundationAiSellPreviewTeam,
  FoundationAiTransferPreviewRecommendation,
  FoundationAiTransferPreviewResponse,
  FoundationAiTransferPreviewTeam,
  FoundationApplySummary,
  FoundationAutoRosterFillAcquisition,
  FoundationAutoRosterFillResponse,
  FoundationAutoRosterFillTeamResult,
  FoundationCommandItem,
  FoundationFlowCoachAction,
  FoundationFlowCoachModel,
  FoundationFlowLoopStage,
  FoundationMatchdayAutoRunSummary,
  FoundationMatchdayMvpLineupTeam,
  FoundationMatchdayMvpScoreboardRow,
  FoundationMatchdayMvpScoringResponse,
  FoundationMatchdayMvpTopPlayerRow,
  FoundationPageClientProps,
  FoundationPrizePreviewItem,
  FoundationPrizePreviewResponse,
  FoundationReadMeta,
  FoundationReadSource,
  FoundationResolvePreviewResponse,
  FoundationScreenPrimaryAction,
  FoundationSeasonManagementItem,
  FoundationSeasonManagementResponse,
  FoundationSeasonSnapshotSummary,
  FoundationSeasonStandingsOverviewItem,
  FoundationSeasonStandingsOverviewResponse,
  FoundationSeasonStartResetResponse,
  FoundationSeasonStartResetTeamRow,
  FoundationStandingsPreviewItem,
  FoundationStandingsPreviewResponse,
  FoundationTransferHistoryItem,
  FoundationTransferHistoryResponse,
  FoundationTransferRecapItem,
  FoundationTransferRecapResponse,
  FoundationTransferRecapTeamSummary,
  FoundationTransfermarktResponse,
  FoundationView,
  FoundationWholeSeasonDryRunSummary,
  MarketNegotiationOutcome,
  NewGamePresetId,
  NewGameSetupApiResponse,
  NewGameSetupPreview,
  NewGameTeamPreview,
  PersistedFoundationTablePreferenceEntry,
  PersistedFoundationTablePreferences,
  PlayerTableScope,
  PreSeasonWorkflowApiResponse,
  PreSeasonWorkflowStepSummary,
  PreSeasonWorkflowStepSummaryResponse,
  PreSeasonWorkflowSummaryResponse,
  SaveActionRequest,
  SeasonCompletionApiResponse,
  SeasonCompletionSummaryResponse,
  SeasonObjectiveSettlementResponse,
  SeasonReviewAwardResponse,
  SeasonReviewNamedValueResponse,
  SeasonReviewPromisedRoleSignalResponse,
  SeasonReviewResponse,
  SeasonReviewTransferHighlightResponse,
  SeasonReviewXpDevelopmentRowResponse,
  SeasonSetupStepTone,
  SeasonSetupStepViewTarget,
  SeasonTableMode,
  SeasonTransitionApiResponse,
  SeasonTransitionStepResponse,
  SeasonTransitionSummaryResponse,
  TeamControlDraftMap,
  TeamIdentityDraftMap,
  TeamRosterFocusMode,
  TeamRosterRoleFilter,
  TeamStrategyDraftMap,
  TrainingClassDraft,
  TrainingDevelopmentFilter,
  TrainingModeDraft,
  TransfermarktBuyApiResponse,
  TransfermarktBuyPreviewSubject,
  TransfermarktBuyRequestContext,
  TransfermarktBuySummary,
  TransfermarktSellApiResponse,
  TransfermarktSellPreviewSubject,
  TransfermarktSellSummary,
} from "@/lib/foundation/tabs/foundation-page-types";
import {
  ADVANCE_MATCHDAY_CONFIRM_TOKEN,
  CASH_APPLY_CONFIRM_TOKEN,
  FOUNDATION_ACTIVE_OWNER_STORAGE_KEY,
  FOUNDATION_MANAGER_TEAM_STORAGE_KEY,
  FOUNDATION_SAVE_MODE_STORAGE_KEY,
  FOUNDATION_TABLE_PREFERENCES_STORAGE_KEY,
  FOUNDATION_TEAM_FILTER_STORAGE_KEY,
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
  MATCHDAY_MVP_SCORING_CONFIRM_TOKEN,
  NEW_GAME_PRESET_DEFAULTS,
  NEW_GAME_VISIBLE_PRESET_IDS,
  RESULT_APPLY_CONFIRM_TOKEN,
  SEASON_SETUP_STEP_IDS,
  SEASON_TRANSITION_STATIC_STEPS,
  STANDINGS_APPLY_CONFIRM_TOKEN,
  TRANSFER_HISTORY_SEASON_LIMIT,
  TRANSFER_MARKET_INITIAL_RENDER_LIMIT,
  TRANSFER_MARKET_RENDER_STEP,
  teamIdentityFieldLabels,
  teamStrategyBiasFieldLabels,
  teamStrategyIdentityListFieldLabels,
  teamStrategyLevelFieldLabels,
  teamStrategyListFieldLabels,
  teamStrategySportsBiasAxisMap,
  teamStrategySportsBiasFieldLabels,
} from "@/lib/foundation/tabs/foundation-page-types";
import {
  buildTeamIdentityDraftMap,
  clampBiasValue,
  clampIdentityValue,
  clampValue,
  initialGameState,
  loadFoundationTablePreferences,
  normalizeAiPreseasonRun,
  normalizeFoundationTablePreferenceEntry,
  normalizeInboxTargetView,
  normalizeTeamStrategyLevel,
  parseFoundationTeamIdFromUrl,
  parseFoundationViewFromUrl,
  persistFoundationActiveOwnerId,
  persistFoundationManagerTeamId,
  persistFoundationSaveMode,
  persistFoundationTeamFilter,
  readSeasonBriefingDismissedFromStorage,
  readStoredFoundationActiveOwnerId,
  readStoredFoundationManagerTeamId,
  readStoredFoundationSaveMode,
  readStoredFoundationTeamFilter,
  resolveDefaultManagerTeamId,
  resolveFoundationPanelScrollTarget,
  resolveFoundationTeamId,
  resolveFoundationViewTarget,
  resolvePreferredFoundationTeamContext,
  withNormalizedLocalTeamSettings,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";

import type { FoundationActionFeedback, FoundationPageClientProps } from "@/lib/foundation/tabs/foundation-page-types";

export function useFoundationPageState({
  initialReadSource,
  initialSelectedTeamId,
  initialSaveId,
  initialView,
  initialPersistenceState,
}: FoundationPageClientProps) {
  const initialPersistedSave = initialPersistenceState?.save?.gameState ? initialPersistenceState.save : null;
  const initialClientGameState = withNormalizedLocalTeamSettings(initialPersistedSave?.gameState ?? initialGameState);
  const initialOwnershipDraft = deriveChrisFrankyTeamIdsFromSettings(
    initialClientGameState.teams,
    buildTeamControlSettingsMap(initialClientGameState.teams, initialClientGameState.seasonState.teamControlSettings),
  );

  const [gameState, setGameState] = useState<GameState>(() => initialClientGameState);
  const gameStateRef = useRef(initialClientGameState);
  const [teamIdentityDraft, setTeamIdentityDraft] = useState<TeamIdentityDraftMap>(() =>
    buildTeamIdentityDraftMap(initialClientGameState.teams, initialClientGameState.teamIdentities),
  );
  const [teamControlDraft, setTeamControlDraft] = useState<TeamControlDraftMap>(() =>
    buildTeamControlSettingsMap(initialClientGameState.teams, initialClientGameState.seasonState.teamControlSettings),
  );
  const [gameModeOwnershipChrisIds, setGameModeOwnershipChrisIds] = useState<string[]>(
    () => initialOwnershipDraft.chrisTeamIds,
  );
  const [gameModeOwnershipFrankyIds, setGameModeOwnershipFrankyIds] = useState<string[]>(
    () => initialOwnershipDraft.frankyTeamIds,
  );
  const [teamStrategyDraft, setTeamStrategyDraft] = useState<TeamStrategyDraftMap>(() =>
    buildTeamStrategyProfileMap(
      initialClientGameState.teams,
      initialClientGameState.teamIdentities,
      initialClientGameState.seasonState.teamStrategyProfiles,
    ),
  );
  const [teamIdentityMessage, setTeamIdentityMessage] = useState<string | null>(null);
  const [teamControlMessage, setTeamControlMessage] = useState<string | null>(null);
  const [teamStrategyMessage, setTeamStrategyMessage] = useState<string | null>(null);
  const [saveSummaries, setSaveSummaries] = useState<SaveSummary[]>(initialPersistenceState?.saves ?? []);
  const [activeSaveId, setActiveSaveId] = useState<string>(initialPersistedSave?.saveId ?? "save-singleplayer-dev");
  const [foundationSaveMode, setFoundationSaveMode] = useState<FoundationSaveMode>(() =>
    normalizeFoundationSaveMode(initialPersistenceState?._meta?.saveMode ?? readStoredFoundationSaveMode()),
  );
  const [roomContext, setRoomContext] = useState<FoundationRoomContext | null>(null);
  const [roomLiveState, setRoomLiveState] = useState<OlyRoomState | null>(null);
  const [roomActivityNotice, setRoomActivityNotice] = useState<{ title: string; detail: string } | null>(null);
  const [activeSaveName, setActiveSaveName] = useState<string>(initialPersistedSave?.name ?? "Singleplayer Foundation");
  const [isSaveBusy, setIsSaveBusy] = useState<boolean>(false);
  const [readMeta, setReadMeta] = useState<FoundationReadMeta>({
    source: initialPersistenceState?._meta?.source ?? "sqlite",
    readOnly: initialPersistenceState?._meta?.readOnly ?? false,
    generatedAt: initialPersistenceState?._meta?.generatedAt ?? new Date().toISOString(),
    saveMode: initialPersistenceState?._meta?.saveMode,
  });
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() =>
    resolveFoundationTeamId(initialClientGameState.teams, initialSelectedTeamId) ?? initialClientGameState.teams[0]?.teamId ?? "",
  );
  const [managerTeamPreferenceHydrated, setManagerTeamPreferenceHydrated] = useState(false);
  const [activeManagerTeamSource, setActiveManagerTeamSource] = useState<ActiveManagerTeamSource>(() =>
    resolveFoundationTeamId(initialClientGameState.teams, initialSelectedTeamId) ? "route" : "default_human_team",
  );
  const [activeOwnerId, setActiveOwnerId] = useState<string>(() => readStoredFoundationActiveOwnerId());
  const [teamContextFilter, setTeamContextFilter] = useState<TeamControlFilter>(() => readStoredFoundationTeamFilter());
  const [activeManagerTeamWarning, setActiveManagerTeamWarning] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<FoundationView>(
    () => resolveFoundationViewTarget((initialView ?? parseFoundationViewFromUrl() ?? "homeV2") as FoundationView),
  );
  const [homeV2Tab, setHomeV2Tab] = useState<"overview" | "office">(() => {
    if (typeof window === "undefined") return "overview";
    const view = normalizeFoundationViewParam(new URL(window.location.href).searchParams.get("view"));
    const tab = parseFoundationTabFromUrl();
    if (tab === "office" || view === "hq") return "office";
    return "overview";
  });
  const [prizeFinanceTab, setPrizeFinanceTab] = useState<"sponsors" | "prize">(() => {
    if (typeof window === "undefined") return "sponsors";
    const tab = parseFoundationTabFromUrl();
    if (tab === "preisgeld" || tab === "prize") return "prize";
    return "sponsors";
  });
  const [playerProfileTab, setPlayerProfileTab] = useState<PlayerProfileTabId>("overview");
  const [playerProfileData, setPlayerProfileData] = useState<PlayerDetailDrawerData | null>(null);
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false);
  const [inboxV2SelectedItemId, setInboxV2SelectedItemId] = useState<string | null>(null);
  const [selectedEncyclopediaEntryId, setSelectedEncyclopediaEntryId] = useState(() => getGameEncyclopediaEntry("OVR")?.id ?? "ovr");
  const [lineupFocusRequestKey, setLineupFocusRequestKey] = useState<string | null>(null);
  const [lineupDraftBoardViewRequest, setLineupDraftBoardViewRequest] = useState<"lineup" | "formBoard" | null>(null);
  const [lineupDraftBoardView, setLineupDraftBoardView] = useState<"lineup" | "formBoard">("lineup");
  const [scoutingCenterTab, setScoutingCenterTab] = useState<"overview" | "reports" | "recommended">(() => {
    if (typeof window === "undefined") return "overview";
    const view = normalizeFoundationViewParam(new URL(window.location.href).searchParams.get("view"));
    const tab = parseFoundationTabFromUrl();
    if (view !== "scoutingCenterV2" || !tab) return "overview";
    if (tab === "reports" || tab === "recommended" || tab === "overview") return tab;
    return "overview";
  });
  const [scoutingReportSelectedPlayerId, setScoutingReportSelectedPlayerId] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const commandSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [showExtendedTeamPanels, setShowExtendedTeamPanels] = useState<boolean>(false);
  const [showGameFlowPanel, setShowGameFlowPanel] = useState<boolean>(false);
  const [inboxCategoryFilter, setInboxCategoryFilter] = useState<string>("ALL");
  const [inboxMode, setInboxMode] = useState<"decisions" | "chronicle">("decisions");
  const [inboxIncludeDone, setInboxIncludeDone] = useState<boolean>(false);
  const [inboxIncludeDismissed, setInboxIncludeDismissed] = useState<boolean>(false);
  const [selectedMatchdaySummaryId, setSelectedMatchdaySummaryId] = useState<string | null>(null);
  const [teamSettingsSearch, setTeamSettingsSearch] = useState<string>("");
  const [showTeamDisciplines, setShowTeamDisciplines] = useState<boolean>(false);
  const [selectedTeamDetailTab, setSelectedTeamDetailTab] = useState<"roster" | "contracts" | "portraits" | "transfer">("roster");
  const [seasonV2HydrationPhase, setSeasonV2HydrationPhase] = useState<"shell" | "full">("shell");
  const [showTeamContractPreviewRows, setShowTeamContractPreviewRows] = useState<boolean>(false);
  const [teamRosterRoleFilter, setTeamRosterRoleFilter] = useState<TeamRosterRoleFilter>("all");
  const [teamRosterFocusMode, setTeamRosterFocusMode] = useState<TeamRosterFocusMode>("default");
  const [showSelectedRosterPpsBreakdown, setShowSelectedRosterPpsBreakdown] = useState(false);
  const [trainingModeDraft, setTrainingModeDraft] = useState<Record<string, TrainingModeDraft>>({});
  const [trainingClassDraft, setTrainingClassDraft] = useState<Record<string, TrainingClassDraft>>({});
  const [trainingDevelopmentFilter, setTrainingDevelopmentFilter] = useState<TrainingDevelopmentFilter>("all");
  const [trainingFacilityPreviewId, setTrainingFacilityPreviewId] = useState<string | null>(null);
  const [seasonTableMode, setSeasonTableMode] = useState<SeasonTableMode>("expert");
  const [teamsHydrationPhase, setTeamsHydrationPhase] = useState<"shell" | "full">("shell");
  const [showSeasonTopPlayerAreas, setShowSeasonTopPlayerAreas] = useState<boolean>(false);
  const [tableSorts, setTableSorts] = useState<Record<string, SortState>>({
    teamTable: { key: "punkte", direction: "desc" },
    playersTable: { key: "ovr", direction: "desc" },
    teamsView: { key: "overallRank", direction: "asc" },
    disciplineRanks: { key: "totalRank", direction: "asc" },
    disciplineConfig: { key: "originalOrder", direction: "asc" },
    ppArea: { key: "rank", direction: "asc" },
    seasonTopPlayers: { key: "rank", direction: "asc" },
    prizeMoney: { key: "rank", direction: "asc" },
    sponsorPlacement: { key: "rankDelta", direction: "desc" },
    teamPrize: { key: "place", direction: "asc" },
    prizePreview: { key: "projectedRank", direction: "asc" },
    selectedRoster: { key: "ovr", direction: "desc" },
    transferMarket: { key: "marketValue", direction: "asc" },
    transferHistory: { key: "happenedAt", direction: "desc" },
    standingsPreview: { key: "totalScore", direction: "desc" },
  });
  const [playerScope, setPlayerScope] = useState<PlayerTableScope>("active");
  const [playerTeamFilter, setPlayerTeamFilter] = useState<string>("ALL");
  const [playerClassFilter, setPlayerClassFilter] = useState<string>("ALL");
  const [playerBracketFilter, setPlayerBracketFilter] = useState<string>("ALL");
  const [marketClassFilter, setMarketClassFilter] = useState<string>("ALL");
  const [marketRaceFilter, setMarketRaceFilter] = useState<string>("ALL");
  const [marketSubclassFilter, setMarketSubclassFilter] = useState<string>("ALL");
  const [marketAlignmentFilter, setMarketAlignmentFilter] = useState<string>("ALL");
  const [marketGenderFilter, setMarketGenderFilter] = useState<string>("ALL");
  const [marketPositiveTraitFilter, setMarketPositiveTraitFilter] = useState<string>("ALL");
  const [marketNegativeTraitFilter, setMarketNegativeTraitFilter] = useState<string>("ALL");
  const [marketBracketFilter, setMarketBracketFilter] = useState<string>("ALL");
  const [marketTeamId, setMarketTeamId] = useState<string>("");
  const [marketFocusPlayerId, setMarketFocusPlayerId] = useState<string | null>(null);
  const [foundationPanel, setFoundationPanel] = useState<FoundationPanelId>(null);
  const [foundationFacilityTarget, setFoundationFacilityTarget] = useState<{ facilityId: string; action: string } | null>(null);
  const [marketSearch, setMarketSearch] = useState<string>("");
  const [marketMaxValue, setMarketMaxValue] = useState<number>(150);
  const marketValueFilterManualRef = useRef(false);
  const marketCashLimitTeamRef = useRef<string | null>(null);
  const [marketMaxSalary, setMarketMaxSalary] = useState<number>(40);
  const [marketMinRatio, setMarketMinRatio] = useState<number>(0);
  const [marketMinPow, setMarketMinPow] = useState<number>(1);
  const [marketMinSpe, setMarketMinSpe] = useState<number>(1);
  const [marketMinMen, setMarketMinMen] = useState<number>(1);
  const [marketMinSoc, setMarketMinSoc] = useState<number>(1);
  const [marketShowAdvancedColumns, setMarketShowAdvancedColumns] = useState<boolean>(false);
  const [marketShowAutoAnalysis, setMarketShowAutoAnalysis] = useState<boolean>(false);
  const [marketShowTransferRecap, setMarketShowTransferRecap] = useState<boolean>(false);
  const [marketRenderLimit, setMarketRenderLimit] = useState<number>(TRANSFER_MARKET_INITIAL_RENDER_LIMIT);
  const [marketLoadingMore, setMarketLoadingMore] = useState<boolean>(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState<boolean>(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [saveSyncError, setSaveSyncError] = useState<string | null>(null);
  const [marketReloadToken, setMarketReloadToken] = useState<number>(0);
  const [marketFeed, setMarketFeed] = useState<FoundationTransfermarktResponse | null>(null);
  const [marketBuyBusy, setMarketBuyBusy] = useState<boolean>(false);
  const [marketBuyError, setMarketBuyError] = useState<string | null>(null);
  const [marketBuySuccess, setMarketBuySuccess] = useState<string | null>(null);
  const [foundationActionFeedback, setFoundationActionFeedback] = useState<FoundationActionFeedback | null>(null);
  const [seasonBriefingOpen, setSeasonBriefingOpen] = useState<boolean>(false);
  const [freshSeasonStartMessage, setFreshSeasonStartMessage] = useState<string | null>(null);
  const [newGamePresetId, setNewGamePresetId] = useState<NewGamePresetId>("solo_1");
  const [newGameChrisTeamIds, setNewGameChrisTeamIds] = useState<string[]>(NEW_GAME_PRESET_DEFAULTS.solo_1.chrisTeamIds);
  const [newGameFrankyTeamIds, setNewGameFrankyTeamIds] = useState<string[]>(NEW_GAME_PRESET_DEFAULTS.solo_1.frankyTeamIds);
  const [newGameSandbox, setNewGameSandbox] = useState<boolean>(false);
  const [newGameSaveName, setNewGameSaveName] = useState<string>("");
  const [newGamePreview, setNewGamePreview] = useState<NewGameSetupPreview | null>(null);
  const [newGameBusy, setNewGameBusy] = useState<boolean>(false);
  const [newGameError, setNewGameError] = useState<string | null>(null);
  const [newGameSuccess, setNewGameSuccess] = useState<string | null>(null);
  const [marketBuyPreview, setMarketBuyPreview] = useState<TransfermarktBuySummary | null>(null);
  const [marketBuyPreviewContext, setMarketBuyPreviewContext] = useState<TransfermarktBuyRequestContext | null>(null);
  const [marketNegotiationOutcome, setMarketNegotiationOutcome] = useState<MarketNegotiationOutcome | null>(null);
  const [marketPreviewPlayerId, setMarketPreviewPlayerId] = useState<string | null>(null);
  const [marketBuySubject, setMarketBuySubject] = useState<TransfermarktBuyPreviewSubject | null>(null);
  const [marketSellBusy, setMarketSellBusy] = useState<boolean>(false);
  const [marketSellError, setMarketSellError] = useState<string | null>(null);
  const [marketSellSuccess, setMarketSellSuccess] = useState<string | null>(null);
  const [marketSellPreview, setMarketSellPreview] = useState<TransfermarktSellSummary | null>(null);
  const [contractRenewalBusy, setContractRenewalBusy] = useState<string | null>(null);
  const [contractRenewalMessage, setContractRenewalMessage] = useState<string | null>(null);
  const [contractRenewalError, setContractRenewalError] = useState<string | null>(null);
  const [contractRenewalNegotiation, setContractRenewalNegotiation] = useState<{
    teamId: string;
    playerId: string;
    playerName: string;
    contractLength: number;
    offeredSalary: number | null;
    expectedSalary: number | null;
    confirmToken: string;
  } | null>(null);
  const [sponsorChoiceBusy, setSponsorChoiceBusy] = useState<string | null>(null);
  const [sponsorChoiceMessage, setSponsorChoiceMessage] = useState<string | null>(null);
  const [sponsorChoiceProfiles, setSponsorChoiceProfiles] = useState<Record<string, SponsorNegotiationProfile>>({});
  const [marketSellSubject, setMarketSellSubject] = useState<TransfermarktSellPreviewSubject | null>(null);
  const [marketSellRiskAcknowledged, setMarketSellRiskAcknowledged] = useState<boolean>(false);
  const [marketContractLengthDraft, setMarketContractLengthDraft] = useState<number | null>(null);
  const [marketContractShapeDraft, setMarketContractShapeDraft] = useState<ContractShape | null>(null);
  const [marketOfferedSalaryDraft, setMarketOfferedSalaryDraft] = useState<number | null>(null);
  const [marketAiTeamScope, setMarketAiTeamScope] = useState<"ai" | "all">("ai");
  const [marketAiPreviewBusy, setMarketAiPreviewBusy] = useState<boolean>(false);
  const [marketAiPreviewError, setMarketAiPreviewError] = useState<string | null>(null);
  const [marketAiPreviewFeed, setMarketAiPreviewFeed] = useState<FoundationAiTransferPreviewResponse | null>(null);
  const [marketAiPreviewSelectedTeamId, setMarketAiPreviewSelectedTeamId] = useState<string | null>(null);
  const [marketAiSellTeamScope, setMarketAiSellTeamScope] = useState<"ai" | "all">("ai");
  const [marketAiSellPreviewBusy, setMarketAiSellPreviewBusy] = useState<boolean>(false);
  const [marketAiSellPreviewError, setMarketAiSellPreviewError] = useState<string | null>(null);
  const [marketAiSellPreviewFeed, setMarketAiSellPreviewFeed] = useState<FoundationAiSellPreviewResponse | null>(null);
  const [marketAiSellPreviewSelectedTeamId, setMarketAiSellPreviewSelectedTeamId] = useState<string | null>(null);
  const [marketAiPlanTeamScope, setMarketAiPlanTeamScope] = useState<"ai" | "all">("ai");
  const [marketAiPlanPreviewBusy, setMarketAiPlanPreviewBusy] = useState<boolean>(false);
  const [marketAiPlanPreviewError, setMarketAiPlanPreviewError] = useState<string | null>(null);
  const [marketAiPlanPreviewFeed, setMarketAiPlanPreviewFeed] = useState<FoundationAiMarketPlanPreviewResponse | null>(null);
  const [marketAiPlanPreviewSelectedTeamId, setMarketAiPlanPreviewSelectedTeamId] = useState<string | null>(null);
  const [marketAiCompareTeamScope, setMarketAiCompareTeamScope] = useState<"ai" | "all">("ai");
  const [marketAiCompareBusy, setMarketAiCompareBusy] = useState<boolean>(false);
  const [marketAiCompareError, setMarketAiCompareError] = useState<string | null>(null);
  const [marketAiCompareFeed, setMarketAiCompareFeed] = useState<FoundationAiNeedsPicksCompareResponse | null>(null);
  const [marketAiCompareSelectedTeamId, setMarketAiCompareSelectedTeamId] = useState<string | null>(null);
  const [marketAiApplyBusy, setMarketAiApplyBusy] = useState<boolean>(false);
  const [marketAiApplyFeed, setMarketAiApplyFeed] = useState<FoundationAiMarketPlanApplyResponse | null>(null);
  const [marketAiApplyIncludeWarnings, setMarketAiApplyIncludeWarnings] = useState<boolean>(false);
  const [rosterFillBusy, setRosterFillBusy] = useState<boolean>(false);
  const [rosterFillFeed, setRosterFillFeed] = useState<FoundationAutoRosterFillResponse | null>(null);
  const [aiPreseasonBusy, setAiPreseasonBusy] = useState<boolean>(false);
  const [aiPreseasonFeed, setAiPreseasonFeed] = useState<FoundationAiPreseasonAutomationResponse | null>(null);
  const aiPreseasonRunStartedRef = useRef<Set<string>>(new Set());
  const seasonBriefingAutoOpenedRef = useRef<string | null>(null);
  const seasonBriefingDismissedRef = useRef<Set<string>>(new Set());
  const [aiLineupEnsureBusy, setAiLineupEnsureBusy] = useState<boolean>(false);
  const [aiLineupEnsureFeed, setAiLineupEnsureFeed] = useState<FoundationAiLineupBatchApplyResponse | null>(null);
  const aiLineupEnsureRunStartedRef = useRef<Set<string>>(new Set());
  const [cockpitAiBatchApplyFeed, setCockpitAiBatchApplyFeed] = useState<FoundationAiLineupBatchApplyResponse | null>(null);
  const [cockpitAiIncludeWarningTeams, setCockpitAiIncludeWarningTeams] = useState<boolean>(false);
  const [cockpitAiOverwriteExisting, setCockpitAiOverwriteExisting] = useState<boolean>(false);
  const [cockpitBusyKey, setCockpitBusyKey] = useState<string | null>(null);
  const [aiPickAuditBusy, setAiPickAuditBusy] = useState<boolean>(false);
  const [aiPickAuditFeed, setAiPickAuditFeed] = useState<FoundationAiPickAuditResetResponse | null>(null);
  const [seasonStartResetBusy, setSeasonStartResetBusy] = useState<boolean>(false);
  const [seasonStartResetFeed, setSeasonStartResetFeed] = useState<FoundationSeasonStartResetResponse | null>(null);
  const [teamProfileTeamId, setTeamProfileTeamId] = useState<string | null>(null);
  const pendingTeamActivationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyFeed, setHistoryFeed] = useState<FoundationTransferHistoryResponse | null>(null);
  const [transferRecapFeed, setTransferRecapFeed] = useState<FoundationTransferRecapResponse | null>(null);
  const [resolvePreviewFeed, setResolvePreviewFeed] = useState<FoundationResolvePreviewResponse | null>(null);
  const [matchdayMvpScoringFeed, setMatchdayMvpScoringFeed] = useState<FoundationMatchdayMvpScoringResponse | null>(null);
  const [matchdayMvpForceReplaceExisting, setMatchdayMvpForceReplaceExisting] = useState<boolean>(false);
  const [resultApplyFeed, setResultApplyFeed] = useState<FoundationApplySummary | null>(null);
  const [standingsPreviewFeed, setStandingsPreviewFeed] = useState<FoundationStandingsPreviewResponse | null>(null);
  const [standingsApplyFeed, setStandingsApplyFeed] = useState<FoundationApplySummary | null>(null);
  const [disciplineCategoryFilter, setDisciplineCategoryFilter] = useState<DisciplineCategoryFilter>("all");
  const [seasonManagementFeed, setSeasonManagementFeed] = useState<FoundationSeasonManagementResponse | null>(null);
  const [facilityUpgradeBusy, setFacilityUpgradeBusy] = useState<boolean>(false);
  const [facilityUpgradePreview, setFacilityUpgradePreview] = useState<FacilityUpgradeSummary | null>(null);
  const [facilityUpgradeError, setFacilityUpgradeError] = useState<string | null>(null);
  const [facilityUpgradeSuccess, setFacilityUpgradeSuccess] = useState<string | null>(null);
  const [facilityMaintenanceBusy, setFacilityMaintenanceBusy] = useState<boolean>(false);
  const [facilityMaintenancePreview, setFacilityMaintenancePreview] = useState<FacilityMaintenanceSummary | null>(null);
  const [facilityMaintenanceError, setFacilityMaintenanceError] = useState<string | null>(null);
  const [facilityMaintenanceSuccess, setFacilityMaintenanceSuccess] = useState<string | null>(null);
  const [specialistWingVariantDraft, setSpecialistWingVariantDraft] = useState<SpecialistWingVariant>("power_gym");
  const [preSeasonWorkflowBusy, setPreSeasonWorkflowBusy] = useState<boolean>(false);
  const [preSeasonWorkflowFeed, setPreSeasonWorkflowFeed] = useState<PreSeasonWorkflowSummaryResponse | null>(null);
  const [preSeasonWorkflowError, setPreSeasonWorkflowError] = useState<string | null>(null);
  const [seasonTransitionBusy, setSeasonTransitionBusy] = useState<boolean>(false);
  const [seasonTransitionFeed, setSeasonTransitionFeed] = useState<SeasonTransitionSummaryResponse | null>(null);
  const [seasonCompletionFeed, setSeasonCompletionFeed] = useState<SeasonCompletionSummaryResponse | null>(null);
  const [seasonTransitionError, setSeasonTransitionError] = useState<string | null>(null);
  const [seasonStandingsFeed, setSeasonStandingsFeed] = useState<FoundationSeasonStandingsOverviewResponse | null>(null);
  const [seasonStandingsLoading, setSeasonStandingsLoading] = useState(false);
  const [seasonStandingsMode, setSeasonStandingsMode] = useState<"table" | "gms">("table");
  const [seasonOverviewSeasonId, setSeasonOverviewSeasonId] = useState<string>(initialClientGameState.season.id);
  const seasonOverviewScopeRef = useRef(`${activeSaveId}:${initialClientGameState.season.id}`);
  const [prizePreviewFeed, setPrizePreviewFeed] = useState<FoundationPrizePreviewResponse | null>(null);
  const [cashApplyFeed, setCashApplyFeed] = useState<FoundationApplySummary | null>(null);
  const [matchdayAdvanceFeed, setMatchdayAdvanceFeed] = useState<FoundationApplySummary | null>(null);
  const [matchdayAutoRunFeed, setMatchdayAutoRunFeed] = useState<FoundationMatchdayAutoRunSummary | null>(null);
  const [matchdayAutoRunIncludeWarningLineups, setMatchdayAutoRunIncludeWarningLineups] = useState<boolean>(false);
  const [matchdayAutoRunOverwriteExistingLineups, setMatchdayAutoRunOverwriteExistingLineups] = useState<boolean>(false);
  const [matchdayAutoRunStopOnTie, setMatchdayAutoRunStopOnTie] = useState<boolean>(true);
  const [wholeSeasonDryRunFeed, setWholeSeasonDryRunFeed] = useState<FoundationWholeSeasonDryRunSummary | null>(null);
  const [seasonSnapshotFeed, setSeasonSnapshotFeed] = useState<FoundationSeasonSnapshotSummary | null>(null);
  const [wholeSeasonIncludeWarningLineups, setWholeSeasonIncludeWarningLineups] = useState<boolean>(false);
  const [wholeSeasonOverwriteExistingLineups, setWholeSeasonOverwriteExistingLineups] = useState<boolean>(false);
  const [wholeSeasonStopOnTie, setWholeSeasonStopOnTie] = useState<boolean>(true);
  const [wholeSeasonMaxMatchdays, setWholeSeasonMaxMatchdays] = useState<number>(2);
  const [adminSimulationSeasonCount, setAdminSimulationSeasonCount] = useState<1 | 2 | 5>(1);
  const [adminSimulationMode, setAdminSimulationMode] = useState<"dry_run" | "apply">("dry_run");
  const [adminSimulationFullChurn, setAdminSimulationFullChurn] = useState<boolean>(false);
  const [adminSimulationInjuries, setAdminSimulationInjuries] = useState<boolean>(false);
  const [adminSimulationRun, setAdminSimulationRun] = useState<AdminSeasonSimulationRunSummary | null>(null);
  const [derivationsCacheBusy, setDerivationsCacheBusy] = useState(false);
  const [derivationsCacheMessage, setDerivationsCacheMessage] = useState<string | null>(null);
  const [adminSimulationBusy, setAdminSimulationBusy] = useState<boolean>(false);
  const [adminSimulationError, setAdminSimulationError] = useState<string | null>(null);
  const [adminBalancingDraft, setAdminBalancingDraft] = useState<AdminBalancingConfig>(() =>
    resolveAdminBalancingConfig(initialClientGameState.seasonState.adminBalancingConfig),
  );
  const [adminBalancingMessage, setAdminBalancingMessage] = useState<string | null>(null);
  const [adminBalancingBusy, setAdminBalancingBusy] = useState<boolean>(false);
  const [historySeasonFilter, setHistorySeasonFilter] = useState<string>(initialClientGameState.season.id);
  const [historyTeamFilter, setHistoryTeamFilter] = useState<string>("ALL");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>("ALL");
  const [historyClassFilter, setHistoryClassFilter] = useState<string>("ALL");
  const [historySourceFilter, setHistorySourceFilter] = useState<string>("ALL");
  const [historySearch, setHistorySearch] = useState<string>("");
  const [tableColumnPreferences, setTableColumnPreferences] = useState<PersistedFoundationTablePreferences>(() =>
    Object.fromEntries(
      Object.entries(loadFoundationTablePreferences()).map(([tableId, entry]) => [
        tableId,
        normalizeFoundationTablePreferenceEntry(entry),
      ]),
    ),
  );

  return {
    initialPersistedSave,
    initialClientGameState,
    initialOwnershipDraft,
    gameStateRef,
    commandSearchInputRef,
    marketValueFilterManualRef,
    marketCashLimitTeamRef,
    aiPreseasonRunStartedRef,
    seasonBriefingAutoOpenedRef,
    seasonBriefingDismissedRef,
    aiLineupEnsureRunStartedRef,
    pendingTeamActivationRef,
    seasonOverviewScopeRef,
    gameState,
    setGameState,
    teamIdentityDraft,
    setTeamIdentityDraft,
    teamControlDraft,
    setTeamControlDraft,
    gameModeOwnershipChrisIds,
    setGameModeOwnershipChrisIds,
    gameModeOwnershipFrankyIds,
    setGameModeOwnershipFrankyIds,
    teamStrategyDraft,
    setTeamStrategyDraft,
    teamIdentityMessage,
    setTeamIdentityMessage,
    teamControlMessage,
    setTeamControlMessage,
    teamStrategyMessage,
    setTeamStrategyMessage,
    saveSummaries,
    setSaveSummaries,
    activeSaveId,
    setActiveSaveId,
    foundationSaveMode,
    setFoundationSaveMode,
    roomContext,
    setRoomContext,
    roomLiveState,
    setRoomLiveState,
    roomActivityNotice,
    setRoomActivityNotice,
    activeSaveName,
    setActiveSaveName,
    isSaveBusy,
    setIsSaveBusy,
    readMeta,
    setReadMeta,
    selectedTeamId,
    setSelectedTeamId,
    managerTeamPreferenceHydrated,
    setManagerTeamPreferenceHydrated,
    activeManagerTeamSource,
    setActiveManagerTeamSource,
    activeOwnerId,
    setActiveOwnerId,
    teamContextFilter,
    setTeamContextFilter,
    activeManagerTeamWarning,
    setActiveManagerTeamWarning,
    activeView,
    setActiveView,
    homeV2Tab,
    setHomeV2Tab,
    prizeFinanceTab,
    setPrizeFinanceTab,
    playerProfileTab,
    setPlayerProfileTab,
    playerProfileData,
    setPlayerProfileData,
    playerProfileLoading,
    setPlayerProfileLoading,
    inboxV2SelectedItemId,
    setInboxV2SelectedItemId,
    selectedEncyclopediaEntryId,
    setSelectedEncyclopediaEntryId,
    lineupFocusRequestKey,
    setLineupFocusRequestKey,
    lineupDraftBoardViewRequest,
    setLineupDraftBoardViewRequest,
    lineupDraftBoardView,
    setLineupDraftBoardView,
    scoutingCenterTab,
    setScoutingCenterTab,
    scoutingReportSelectedPlayerId,
    setScoutingReportSelectedPlayerId,
    showCommandPalette,
    setShowCommandPalette,
    commandSearch,
    setCommandSearch,
    showExtendedTeamPanels,
    setShowExtendedTeamPanels,
    showGameFlowPanel,
    setShowGameFlowPanel,
    inboxCategoryFilter,
    setInboxCategoryFilter,
    inboxMode,
    setInboxMode,
    inboxIncludeDone,
    setInboxIncludeDone,
    inboxIncludeDismissed,
    setInboxIncludeDismissed,
    selectedMatchdaySummaryId,
    setSelectedMatchdaySummaryId,
    teamSettingsSearch,
    setTeamSettingsSearch,
    showTeamDisciplines,
    setShowTeamDisciplines,
    selectedTeamDetailTab,
    setSelectedTeamDetailTab,
    seasonV2HydrationPhase,
    setSeasonV2HydrationPhase,
    showTeamContractPreviewRows,
    setShowTeamContractPreviewRows,
    teamRosterRoleFilter,
    setTeamRosterRoleFilter,
    teamRosterFocusMode,
    setTeamRosterFocusMode,
    showSelectedRosterPpsBreakdown,
    setShowSelectedRosterPpsBreakdown,
    trainingModeDraft,
    setTrainingModeDraft,
    trainingClassDraft,
    setTrainingClassDraft,
    trainingDevelopmentFilter,
    setTrainingDevelopmentFilter,
    trainingFacilityPreviewId,
    setTrainingFacilityPreviewId,
    seasonTableMode,
    setSeasonTableMode,
    teamsHydrationPhase,
    setTeamsHydrationPhase,
    showSeasonTopPlayerAreas,
    setShowSeasonTopPlayerAreas,
    tableSorts,
    setTableSorts,
    playerScope,
    setPlayerScope,
    playerTeamFilter,
    setPlayerTeamFilter,
    playerClassFilter,
    setPlayerClassFilter,
    playerBracketFilter,
    setPlayerBracketFilter,
    marketClassFilter,
    setMarketClassFilter,
    marketRaceFilter,
    setMarketRaceFilter,
    marketSubclassFilter,
    setMarketSubclassFilter,
    marketAlignmentFilter,
    setMarketAlignmentFilter,
    marketGenderFilter,
    setMarketGenderFilter,
    marketPositiveTraitFilter,
    setMarketPositiveTraitFilter,
    marketNegativeTraitFilter,
    setMarketNegativeTraitFilter,
    marketBracketFilter,
    setMarketBracketFilter,
    marketTeamId,
    setMarketTeamId,
    marketFocusPlayerId,
    setMarketFocusPlayerId,
    foundationPanel,
    setFoundationPanel,
    foundationFacilityTarget,
    setFoundationFacilityTarget,
    marketSearch,
    setMarketSearch,
    marketMaxValue,
    setMarketMaxValue,
    marketMaxSalary,
    setMarketMaxSalary,
    marketMinRatio,
    setMarketMinRatio,
    marketMinPow,
    setMarketMinPow,
    marketMinSpe,
    setMarketMinSpe,
    marketMinMen,
    setMarketMinMen,
    marketMinSoc,
    setMarketMinSoc,
    marketShowAdvancedColumns,
    setMarketShowAdvancedColumns,
    marketShowAutoAnalysis,
    setMarketShowAutoAnalysis,
    marketShowTransferRecap,
    setMarketShowTransferRecap,
    marketRenderLimit,
    setMarketRenderLimit,
    marketLoadingMore,
    setMarketLoadingMore,
    historyLoadingMore,
    setHistoryLoadingMore,
    bootstrapError,
    setBootstrapError,
    persistenceError,
    setPersistenceError,
    saveSyncError,
    setSaveSyncError,
    marketReloadToken,
    setMarketReloadToken,
    marketFeed,
    setMarketFeed,
    marketBuyBusy,
    setMarketBuyBusy,
    marketBuyError,
    setMarketBuyError,
    marketBuySuccess,
    setMarketBuySuccess,
    foundationActionFeedback,
    setFoundationActionFeedback,
    seasonBriefingOpen,
    setSeasonBriefingOpen,
    freshSeasonStartMessage,
    setFreshSeasonStartMessage,
    newGamePresetId,
    setNewGamePresetId,
    newGameChrisTeamIds,
    setNewGameChrisTeamIds,
    newGameFrankyTeamIds,
    setNewGameFrankyTeamIds,
    newGameSandbox,
    setNewGameSandbox,
    newGameSaveName,
    setNewGameSaveName,
    newGamePreview,
    setNewGamePreview,
    newGameBusy,
    setNewGameBusy,
    newGameError,
    setNewGameError,
    newGameSuccess,
    setNewGameSuccess,
    marketBuyPreview,
    setMarketBuyPreview,
    marketBuyPreviewContext,
    setMarketBuyPreviewContext,
    marketNegotiationOutcome,
    setMarketNegotiationOutcome,
    marketPreviewPlayerId,
    setMarketPreviewPlayerId,
    marketBuySubject,
    setMarketBuySubject,
    marketSellBusy,
    setMarketSellBusy,
    marketSellError,
    setMarketSellError,
    marketSellSuccess,
    setMarketSellSuccess,
    marketSellPreview,
    setMarketSellPreview,
    contractRenewalBusy,
    setContractRenewalBusy,
    contractRenewalMessage,
    setContractRenewalMessage,
    contractRenewalError,
    setContractRenewalError,
    contractRenewalNegotiation,
    setContractRenewalNegotiation,
    sponsorChoiceBusy,
    setSponsorChoiceBusy,
    sponsorChoiceMessage,
    setSponsorChoiceMessage,
    sponsorChoiceProfiles,
    setSponsorChoiceProfiles,
    marketSellSubject,
    setMarketSellSubject,
    marketSellRiskAcknowledged,
    setMarketSellRiskAcknowledged,
    marketContractLengthDraft,
    setMarketContractLengthDraft,
    marketContractShapeDraft,
    setMarketContractShapeDraft,
    marketOfferedSalaryDraft,
    setMarketOfferedSalaryDraft,
    marketAiTeamScope,
    setMarketAiTeamScope,
    marketAiPreviewBusy,
    setMarketAiPreviewBusy,
    marketAiPreviewError,
    setMarketAiPreviewError,
    marketAiPreviewFeed,
    setMarketAiPreviewFeed,
    marketAiPreviewSelectedTeamId,
    setMarketAiPreviewSelectedTeamId,
    marketAiSellTeamScope,
    setMarketAiSellTeamScope,
    marketAiSellPreviewBusy,
    setMarketAiSellPreviewBusy,
    marketAiSellPreviewError,
    setMarketAiSellPreviewError,
    marketAiSellPreviewFeed,
    setMarketAiSellPreviewFeed,
    marketAiSellPreviewSelectedTeamId,
    setMarketAiSellPreviewSelectedTeamId,
    marketAiPlanTeamScope,
    setMarketAiPlanTeamScope,
    marketAiPlanPreviewBusy,
    setMarketAiPlanPreviewBusy,
    marketAiPlanPreviewError,
    setMarketAiPlanPreviewError,
    marketAiPlanPreviewFeed,
    setMarketAiPlanPreviewFeed,
    marketAiPlanPreviewSelectedTeamId,
    setMarketAiPlanPreviewSelectedTeamId,
    marketAiCompareTeamScope,
    setMarketAiCompareTeamScope,
    marketAiCompareBusy,
    setMarketAiCompareBusy,
    marketAiCompareError,
    setMarketAiCompareError,
    marketAiCompareFeed,
    setMarketAiCompareFeed,
    marketAiCompareSelectedTeamId,
    setMarketAiCompareSelectedTeamId,
    marketAiApplyBusy,
    setMarketAiApplyBusy,
    marketAiApplyFeed,
    setMarketAiApplyFeed,
    marketAiApplyIncludeWarnings,
    setMarketAiApplyIncludeWarnings,
    rosterFillBusy,
    setRosterFillBusy,
    rosterFillFeed,
    setRosterFillFeed,
    aiPreseasonBusy,
    setAiPreseasonBusy,
    aiPreseasonFeed,
    setAiPreseasonFeed,
    aiLineupEnsureBusy,
    setAiLineupEnsureBusy,
    aiLineupEnsureFeed,
    setAiLineupEnsureFeed,
    cockpitAiBatchApplyFeed,
    setCockpitAiBatchApplyFeed,
    cockpitAiIncludeWarningTeams,
    setCockpitAiIncludeWarningTeams,
    cockpitAiOverwriteExisting,
    setCockpitAiOverwriteExisting,
    cockpitBusyKey,
    setCockpitBusyKey,
    aiPickAuditBusy,
    setAiPickAuditBusy,
    aiPickAuditFeed,
    setAiPickAuditFeed,
    seasonStartResetBusy,
    setSeasonStartResetBusy,
    seasonStartResetFeed,
    setSeasonStartResetFeed,
    teamProfileTeamId,
    setTeamProfileTeamId,
    historyFeed,
    setHistoryFeed,
    transferRecapFeed,
    setTransferRecapFeed,
    resolvePreviewFeed,
    setResolvePreviewFeed,
    matchdayMvpScoringFeed,
    setMatchdayMvpScoringFeed,
    matchdayMvpForceReplaceExisting,
    setMatchdayMvpForceReplaceExisting,
    resultApplyFeed,
    setResultApplyFeed,
    standingsPreviewFeed,
    setStandingsPreviewFeed,
    standingsApplyFeed,
    setStandingsApplyFeed,
    disciplineCategoryFilter,
    setDisciplineCategoryFilter,
    seasonManagementFeed,
    setSeasonManagementFeed,
    facilityUpgradeBusy,
    setFacilityUpgradeBusy,
    facilityUpgradePreview,
    setFacilityUpgradePreview,
    facilityUpgradeError,
    setFacilityUpgradeError,
    facilityUpgradeSuccess,
    setFacilityUpgradeSuccess,
    facilityMaintenanceBusy,
    setFacilityMaintenanceBusy,
    facilityMaintenancePreview,
    setFacilityMaintenancePreview,
    facilityMaintenanceError,
    setFacilityMaintenanceError,
    facilityMaintenanceSuccess,
    setFacilityMaintenanceSuccess,
    specialistWingVariantDraft,
    setSpecialistWingVariantDraft,
    preSeasonWorkflowBusy,
    setPreSeasonWorkflowBusy,
    preSeasonWorkflowFeed,
    setPreSeasonWorkflowFeed,
    preSeasonWorkflowError,
    setPreSeasonWorkflowError,
    seasonTransitionBusy,
    setSeasonTransitionBusy,
    seasonTransitionFeed,
    setSeasonTransitionFeed,
    seasonCompletionFeed,
    setSeasonCompletionFeed,
    seasonTransitionError,
    setSeasonTransitionError,
    seasonStandingsFeed,
    setSeasonStandingsFeed,
    seasonStandingsLoading,
    setSeasonStandingsLoading,
    seasonStandingsMode,
    setSeasonStandingsMode,
    seasonOverviewSeasonId,
    setSeasonOverviewSeasonId,
    prizePreviewFeed,
    setPrizePreviewFeed,
    cashApplyFeed,
    setCashApplyFeed,
    matchdayAdvanceFeed,
    setMatchdayAdvanceFeed,
    matchdayAutoRunFeed,
    setMatchdayAutoRunFeed,
    matchdayAutoRunIncludeWarningLineups,
    setMatchdayAutoRunIncludeWarningLineups,
    matchdayAutoRunOverwriteExistingLineups,
    setMatchdayAutoRunOverwriteExistingLineups,
    matchdayAutoRunStopOnTie,
    setMatchdayAutoRunStopOnTie,
    wholeSeasonDryRunFeed,
    setWholeSeasonDryRunFeed,
    seasonSnapshotFeed,
    setSeasonSnapshotFeed,
    wholeSeasonIncludeWarningLineups,
    setWholeSeasonIncludeWarningLineups,
    wholeSeasonOverwriteExistingLineups,
    setWholeSeasonOverwriteExistingLineups,
    wholeSeasonStopOnTie,
    setWholeSeasonStopOnTie,
    wholeSeasonMaxMatchdays,
    setWholeSeasonMaxMatchdays,
    adminSimulationSeasonCount,
    setAdminSimulationSeasonCount,
    adminSimulationMode,
    setAdminSimulationMode,
    adminSimulationFullChurn,
    setAdminSimulationFullChurn,
    adminSimulationInjuries,
    setAdminSimulationInjuries,
    adminSimulationRun,
    setAdminSimulationRun,
    derivationsCacheBusy,
    setDerivationsCacheBusy,
    derivationsCacheMessage,
    setDerivationsCacheMessage,
    adminSimulationBusy,
    setAdminSimulationBusy,
    adminSimulationError,
    setAdminSimulationError,
    adminBalancingDraft,
    setAdminBalancingDraft,
    adminBalancingMessage,
    setAdminBalancingMessage,
    adminBalancingBusy,
    setAdminBalancingBusy,
    historySeasonFilter,
    setHistorySeasonFilter,
    historyTeamFilter,
    setHistoryTeamFilter,
    historyTypeFilter,
    setHistoryTypeFilter,
    historyClassFilter,
    setHistoryClassFilter,
    historySourceFilter,
    setHistorySourceFilter,
    historySearch,
    setHistorySearch,
    tableColumnPreferences,
    setTableColumnPreferences,
  };
}
