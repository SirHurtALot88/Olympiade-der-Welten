"use client";
import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";
import {
  FoundationShellRouterCockpit,
  FoundationShellRouterHistoryV2,
  FoundationShellRouterHomeV2,
  FoundationShellRouterInboxV2,
  FoundationShellRouterLineup,
  FoundationShellRouterMarketSell,
  FoundationShellRouterMatchdayResult,
  FoundationShellRouterPrize,
  FoundationShellRouterSeasonPreview,
  FoundationShellRouterSeasonV2,
  FoundationShellRouterTeams,
} from "@/app/foundation/FoundationShellRouter";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Fragment, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";

import ClassColorChip, { getClassColorClassName } from "@/app/foundation/ClassColorChip";
import ClassIcon from "@/app/foundation/ClassIcon";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import RaceIcon from "@/app/foundation/RaceIcon";
import type { TeamDetailDrawerData, TeamDetailDrawerHistoryRow } from "@/lib/foundation/team-detail-drawer-types";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { GameTerm } from "@/components/ui/GameTerm";
import {
  ColumnVisibilityManager,
  SortableHeader,
  sortTableRows as sortRows,
} from "@/components/foundation/FoundationTableUi";
import { GAME_ENCYCLOPEDIA_ENTRIES, getGameEncyclopediaEntry } from "@/lib/ui/game-encyclopedia";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { buildAiTransferIntents } from "@/lib/ai/aiTransferMarket";
import { runAiTurn } from "@/lib/ai/aiTurnEngine";
import { buildTeamObjectiveOverview, refreshTeamObjectiveState } from "@/lib/board/team-season-objectives-service";
import { getMetricBarPercent, getPoolHeatClass } from "@/lib/foundation/player-league-heat";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import {
  FACILITY_CATALOG,
  getFacilityLevelDefinition,
  SPECIALIST_WING_VARIANTS,
  type FacilityId,
  type SpecialistWingVariant,
} from "@/lib/facilities/facility-catalog";
import {
  getFacilityLevel,
  getTeamFacilityState,
} from "@/lib/facilities/facility-effects";
import {
  buildContractNegotiationDraft,
  type NegotiationDemandBreakdownEntry,
  type NegotiationScoreBreakdownEntry,
  type PlayerContractPreference,
} from "@/lib/market/contract-negotiation-preview";
import { getTransfermarktAdvancedColumns, getTransfermarktBaseColumns } from "@/lib/market/transfermarkt-column-contract";
import {
  formatTransfermarktCurrency,
  formatTransfermarktPoints,
  formatTransfermarktRatio,
  type TransfermarktTier,
} from "@/lib/market/transfermarkt-formatting-contract";
import { buildTransfermarktSaleFactorBreakdown, normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import {
  getTransfermarktScoutingDisclosure,
  getTransfermarktScoutingVisibilityBuckets,
} from "@/lib/market/transfermarkt-scouting";
import { getTransfermarktPortraitModel } from "@/lib/market/transfermarkt-lab";
import { evaluateTransferListing } from "@/lib/market/transfer-market";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
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
  PlayerGeneratorAttributeName,
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
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS,
  resolveFoundationManageableTeamIds,
  resolveFoundationTeamCanManage,
} from "@/lib/foundation/foundation-admin-dev-flags";
import {
  getSaisonstandCompactContractColumns,
  getSaisonstandExpertContractColumns,
  saisonstandExpertPresetWidths,
  saisonstandDisciplineColumns,
  saisonstandFinanceColumns,
  saisonstandLeftPinnedColumns,
  saisonstandColumnContract,
  type SaisonstandColumnContractEntry,
} from "@/lib/foundation/saisonstand-column-contract";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { getPlayerDisplayMarketValueDelta as resolvePlayerDisplayMarketValueDelta } from "@/lib/foundation/player-display-market-value";
import { getPlayerBaselineEconomyReference } from "@/lib/players/player-baseline-service";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import { buildPlayerLeagueCareerStatsMap } from "@/lib/foundation/player-league-career-stats";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import {
  buildFieldRaceLedger,
  getFieldRaceRecentForm,
  type FieldRaceLedgerEntry,
} from "@/lib/foundation/build-field-race-ledger";
import {
  deriveTeamIdentityAxisBias,
  buildResolvedTeamIdentities,
  buildTeamIdentityOverrideMap,
  withNormalizedTeamIdentityOverrides,
} from "@/lib/foundation/team-identity-settings";
import {
  getAxisSharePercentages,
  getTeamGeneralManager,
  getTeamGeneralManagerProfile,
  withNormalizedTeamGeneralManagers,
} from "@/lib/foundation/team-general-managers";
import { buildGmStoryView } from "@/lib/foundation/gm-story";
import { getFormCardFlowStatus } from "@/lib/foundation/form-card-flow";
import {
  getLineupDraftSideCounts,
  getMatchdayLineupSideRequirements,
  getTeamMatchdayLineupDraft,
  getTeamMatchdayLineupOpenSlots,
  isTeamMatchdayLineupComplete,
  isTeamMatchdayLineupOperationallyReady,
  isTeamMatchdayLineupSubmitted,
  mergeTeamLineupDraftIntoGameState,
} from "@/lib/foundation/matchday-lineup-readiness";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import {
  formatLineupOperationalGapDetail,
  mergeFormCardPlansIntoGameState,
} from "@/lib/foundation/matchday-arena-readiness";
import {
  AI_OWNER_ID,
  DEFAULT_ACTIVE_OWNER_ID,
  applyChrisFrankyOwnershipToTeamControlSettings,
  applyGameModeOwnership,
  buildTeamControlSettingsMap,
  canOwnerManageTeam,
  deriveChrisFrankyTeamIdsFromSettings,
  filterTeamsByControlScope,
  getGameModeOwnershipLimits,
  getTeamControlSettings,
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
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamDevelopmentTrainingBonusPct } from "@/lib/foundation/team-development-tendency";
import { buildStandingsTransferBalanceByTeamId } from "@/lib/season/transfer-standings-balance";
import {
  getScoutingWishlistSlotLimit,
  getTeamTransferWishlistEntries,
} from "@/lib/scouting/scouting-wishlist-slots";
import { shouldAutoOpenSeasonBriefing, type GameFlowView } from "@/lib/foundation/game-flow-controller";
import { formatGameFlowBlocker, formatGameFlowBlockerList } from "@/lib/foundation/game-flow-blocker-labels";
import { buildGameInboxItems, filterGameInboxItems, getPrimaryInboxTask } from "@/lib/foundation/game-inbox-service";
import { buildMatchdaySummary, getMatchdaySummaryOptions } from "@/lib/foundation/matchday-summary";
import { buildSeasonReadinessChecklist } from "@/lib/foundation/season-readiness-checklist";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";
import { buildTeamPlayerDemandMap, selectTeamCaptain } from "@/lib/morale/player-demands-service";
import {
  buildCaptainCandidateProfiles,
  getTeamCaptainEffectsTooltip,
  setTeamCaptain,
} from "@/lib/morale/team-captain-service";
import { buildPlayerMoraleAudit } from "@/lib/morale/player-morale-service";
import { buildTeamRivalryLedger } from "@/lib/rivalries/team-rivalries";
import { buildTeamRelationshipCards } from "@/lib/rivalries/team-relationship-dynamics";
import {
  addScoutingWatchlistEntry,
  getScoutingWatchlistForTeam,
  removeScoutingWatchlistEntry,
  syncWishlistToScoutingWatchlist,
} from "@/lib/scouting/scouting-watchlist-service";
import { buildSponsorCommercialRating } from "@/lib/sponsor/sponsor-commercial-rating-service";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";
import { buildFoundationNavAttention } from "@/lib/foundation/foundation-nav-attention";
import { FoundationSharedProvider, useFoundationShared } from "@/lib/foundation/foundation-shared-context";
import { FoundationStateProvider } from "@/lib/foundation/foundation-state-context";
import type { SponsorNegotiationProfile } from "@/lib/data/olyDataTypes";
import { buildScoutPipelineSummary } from "@/lib/scouting/facility-scout-pipeline-service";
import {
  canAddPlayerToTransferWishlist,
  getNextWishlistPriorityRank,
  getScoutingWishlistSlotMessage,
  isTeamSetupDraftWishlistPhase,
  reorderTeamTransferWishlist,
} from "@/lib/scouting/scouting-wishlist-slots";
import { buildScoutingWatchTargetStarFields } from "@/lib/scouting/player-star-scouting-bridge";
import { buildScoutingHubTargetSections } from "@/lib/scouting/scouting-hub-targets-service";
import { getTransfermarktBracket } from "@/lib/market/transfermarkt-fit";
import { getTeamPowerOptions } from "@/lib/lineups/team-powers";
import { getDisciplineColor, getSeasonDisciplineSchedule, getSeasonDisciplineScheduleEntry } from "@/lib/season/season-discipline-schedule";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-service";
import {
  CANONICAL_PROGRESS_TRAITS,
  PROGRESSION_ATTRIBUTE_ORDER,
  PROGRESSION_CLASS_ORDER,
} from "@/lib/training/class-progression-config";
import {
  buildTeamHistoryDisciplineValuesFromRecord,
  buildTeamHistoryDisciplineValuesFromSnapshot,
} from "@/lib/season/season-discipline-area-groups";
import { buildPlayerDevelopmentInsight, getPotentialBand } from "@/lib/progression/player-potential-service";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import {
  appendRoomContextToParams,
  readFoundationRoomContextFromLocation,
  withRoomContextBody,
  type FoundationRoomContext,
} from "@/lib/room/foundation-room-context-client";
import { describeRoomWriteError, isStaleSaveVersionError } from "@/lib/room/parse-room-write-context";
import { getClientSocket } from "@/lib/socket/client";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import {
  GLOBAL_TABLE_LAYOUT_VERSION,
  GLOBAL_TABLE_STORAGE_KEYS,
  clampTableColumnWidth,
  getDefaultGlobalTableWidths,
  getGlobalTablePinZone,
  normalizeGlobalTablePreferenceEntry,
  reorderGlobalTableColumns,
  uniqueGlobalColumnIds,
  type GlobalTableColumnConfig,
} from "@/lib/ui/global-table-layout";
import type { OlyRoomState, RoomRealtimeEvent } from "@/types/game";
import { describeRoomFlowButton, getRoomFlowStep } from "@/lib/room/room-flow-controller";
import { TEAM_BOARD_PRESSURE_TOOLTIP, TEAM_BOARD_RATING_TOOLTIP } from "@/lib/foundation/team-board-tooltips";
import { VeloImpactStrip, VeloStatOrbitRow } from "@/components/foundation/velo-ui";
import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";
import FoundationPlayerPortraitPreview from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
import { normalizeFoundationViewParam, getDefaultFoundationViewTarget, type FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import {
  prefetchFoundationPanel,
  prefetchFoundationDefaultPanels,
  prefetchPlayerDirectoryData,
  prefetchSeasonStandingsData,
} from "@/lib/foundation/foundation-panel-prefetch";
import { pauseFoundationNavigationSideEffects } from "@/lib/foundation/navigation-coalescing";
import {
  canFoundationNavigateBack,
  foundationNavigateBack,
  mergeFoundationHistoryReplaceState,
  parseFoundationFacilityFromUrl,
  parseFoundationNewGameIntentFromUrl,
  parseFoundationPanelFromUrl,
  parseFoundationUrlStateFromLocation,
  readFoundationHistoryState,
  writeFoundationUrlState,
  type FoundationPanelId,
} from "@/lib/foundation/foundation-navigation-history";
import {
  parseFoundationPlayerIdFromUrl,
  parseFoundationSaveIdFromUrl,
  parseFoundationTabFromUrl,
  syncFoundationUrlState,
  type FoundationUrlState,
} from "@/lib/foundation/foundation-url-state";
import { useFoundationKeyboardNavigation } from "@/lib/foundation/use-foundation-keyboard-navigation";
import { buildFoundationActivities } from "@/lib/foundation/foundation-activity-registry";
import type { FoundationStateContextValue } from "@/lib/foundation/foundation-state-context";
import { usePlayerDirectorySlice } from "@/lib/foundation/use-player-directory-slice";
import { useSeasonRatingsSlice } from "@/lib/foundation/use-season-ratings-slice";
import { usePlayerDirectorySortWorker } from "@/lib/foundation/use-player-directory-sort-worker";
import { useSeasonDerivations } from "@/lib/foundation/use-season-derivations";
import { useTeamOverviewSlice } from "@/lib/foundation/use-team-overview-slice";
import { compareTeamRosterPlayersByOvrOrMarketValue } from "@/lib/foundation/team-roster-player-sort";
import { hydrateTeamOverviewSliceRows } from "@/lib/foundation/team-overview-slice";
import { useFoundationCrossTabDisciplineRanks } from "@/lib/foundation/tabs/use-foundation-cross-tab-discipline-ranks";
import { useFoundationCrossTabPlayerDirectory } from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";
import { useFoundationCrossTabMarketFilters } from "@/lib/foundation/tabs/use-foundation-cross-tab-market-filters";
import { useFoundationCrossTabTeamsRoster } from "@/lib/foundation/tabs/use-foundation-cross-tab-teams-roster";
import {
  resolveFoundationLineupIssueTeamId,
  useFoundationCrossTabMatchdayLineup,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-matchday-lineup";
import { useFoundationCrossTabSeasonBriefing } from "@/lib/foundation/tabs/use-foundation-cross-tab-season-briefing";
import { useFoundationCrossTabHomeV2 } from "@/lib/foundation/tabs/use-foundation-cross-tab-home-v2";
import { useFoundationCrossTabGameFlow } from "@/lib/foundation/tabs/use-foundation-cross-tab-game-flow";
import { useFoundationCrossTabSeasonPrize } from "@/lib/foundation/tabs/use-foundation-cross-tab-season-prize";
import { useFoundationCrossTabTeamControl } from "@/lib/foundation/tabs/use-foundation-cross-tab-team-control";
import { useFoundationCrossTabCommandPalette } from "@/lib/foundation/tabs/use-foundation-cross-tab-command-palette";
import { useFoundationCrossTabFlowCoach } from "@/lib/foundation/tabs/use-foundation-cross-tab-flow-coach";
import { useFoundationCrossTabScreenPrimaryAction } from "@/lib/foundation/tabs/use-foundation-cross-tab-screen-primary-action";
import { useFoundationCrossTabFoundationActivities } from "@/lib/foundation/tabs/use-foundation-cross-tab-foundation-activities";
import {
  getFoundationBusyActionReason,
  getFoundationCockpitBusyReason,
  getFoundationReadOnlyActionReason,
} from "@/lib/foundation/tabs/use-foundation-state-context-value";
import { useFoundationCrossTabTraining } from "@/lib/foundation/tabs/use-foundation-cross-tab-training";
import type { FoundationTrainingCompactShellHostProps } from "@/app/foundation/training-compact/FoundationTrainingCompactShellHost";
import {
  shouldBuildDisciplineRanks as resolveShouldBuildDisciplineRanks,
  shouldBuildFullSeasonStandRows,
  shouldBuildPpAreaRows,
  shouldBuildSeasonHistorySnapshots,
  shouldBuildSeasonOverviewOptions,
  shouldBuildSeasonStandRows,
  shouldBuildSeasonV2PlayerRatings,
  shouldBuildSelectedStandingRow,
  shouldBuildSortedSeasonStandRows,
  shouldBuildLeagueTrainingLeaderRows,
} from "@/lib/foundation/tabs/season-v2-derivations";
import { useSeasonStandRows } from "@/lib/foundation/tabs/use-season-stand-rows";
import {
  shouldLoadPrizePreviewFeed as resolveShouldLoadPrizePreviewFeed,
} from "@/lib/foundation/tabs/prize-v2-derivations";
import {
  buildLeagueLeaderBoards,
  buildLeagueTrainingLeaderRows,
  type LeagueLeaderCategoryId,
} from "@/lib/foundation/league-leaders-service";
import { resolveShouldBuildTeamsScopedRatings, shouldBuildTeamsView as resolveShouldBuildTeamsView } from "@/lib/foundation/tabs/teams-view-derivations";
import type { FoundationMatchdayResultShellHostProps } from "@/app/foundation/matchday-result-v2/FoundationMatchdayResultShellHost";
import type { FoundationHistoryV2ShellHostProps } from "@/app/foundation/transfer-history-v2/FoundationHistoryV2ShellHost";
import type { FoundationSeasonPreviewShellHostProps } from "@/app/foundation/season-preview-v2/FoundationSeasonPreviewShellHost";
import type { FoundationTeamsViewHostProps } from "@/app/foundation/teams-v2/FoundationTeamsViewHost";
import type { FoundationCockpitHostProps } from "@/app/foundation/cockpit-v2/FoundationCockpitHost";
import type { FoundationPrizeFinanceShellHostProps } from "@/app/foundation/prize-v2/FoundationPrizeFinanceShellHost";
import type { FoundationPrizeV2PanelProps } from "@/app/foundation/prize-v2/FoundationPrizeV2Panel";
import { buildFoundationSeasonTableColumns } from "@/lib/foundation/tabs/season-table-column-defs";
import FoundationShell from "@/app/foundation/shell/FoundationShell";
import FoundationSubNav from "@/app/foundation/shell/FoundationSubNav";
import {
  shouldBuildFoundationGameFlow,
  useFoundationGameInboxItems,
} from "@/lib/foundation/tabs/use-foundation-game-flow";
import { useTrainingForecastLimit } from "@/lib/foundation/tabs/use-training-forecast-limit";
import {
  shouldLoadSeasonManagementFeed as resolveShouldLoadSeasonManagementFeed,
  shouldLoadStandingsPreviewFeed as resolveShouldLoadStandingsPreviewFeed,
  shouldLoadTransferHistoryFeed as resolveShouldLoadTransferHistoryFeed,
  shouldRefreshSeasonOverviewOnReload,
} from "@/lib/foundation/tabs/use-standings-preview-feed";
import type { FoundationDiszisHostProps } from "@/app/foundation/ranks-v2/FoundationDiszisHost";
import type { FoundationRanksHostProps } from "@/app/foundation/ranks-v2/FoundationRanksHost";
import type { FoundationLeagueLeadersHostProps } from "@/app/foundation/league-leaders-v2/FoundationLeagueLeadersHost";
import type { FoundationAllTimeTableHostProps } from "@/app/foundation/all-time-table-v2/FoundationAllTimeTableHost";
import { buildAllTimeTableModel } from "@/lib/foundation/all-time-table";
import type { FoundationMarketV2ShellHostProps } from "@/app/foundation/transfermarkt-v2/FoundationMarketV2ShellHost";
import FoundationTeamSettingsHost from "@/app/foundation/team-settings/FoundationTeamSettingsHost";
import FoundationTeamsViewHost from "@/app/foundation/teams-v2/FoundationTeamsViewHost";
import { PLAYER_PROFILE_TABS, type PlayerProfileTabId } from "@/lib/foundation/player-profile-service";

import { useFoundationPageState } from "@/lib/foundation/tabs/use-foundation-page-state";
import { useFoundationPersistenceActions } from "@/lib/foundation/tabs/use-foundation-persistence-actions";
import {
  useFoundationLiveSync,
  type FoundationMarketFeedReloaders,
  type FoundationSeasonFeedReloaders,
} from "@/lib/foundation/tabs/use-foundation-live-sync";
import { useFoundationMarketFeedActions } from "@/lib/foundation/tabs/use-foundation-market-feed-actions";
import {
  useFoundationSeasonFeedActions,
  useFoundationSeasonOverviewFeedEffect,
} from "@/lib/foundation/tabs/use-foundation-season-feed-actions";
import { buildGameStateContentSignature } from "@/lib/foundation/season-derivations-signature";
// --- Phase 5.4: module scope extracted to lib/foundation (import instead of inline duplicate) ---
import {
  ADVANCE_MATCHDAY_CONFIRM_TOKEN,
  ActiveManagerTeamContext,
  ActiveManagerTeamSource,
  AdminSeasonSimulationRunSummary,
  CASH_APPLY_CONFIRM_TOKEN,
  ContractRenewalApiResponse,
  FOUNDATION_ACTIVE_OWNER_STORAGE_KEY,
  FOUNDATION_MANAGER_TEAM_STORAGE_KEY,
  FOUNDATION_SAVE_MODE_STORAGE_KEY,
  FOUNDATION_TABLE_PREFERENCES_STORAGE_KEY,
  FOUNDATION_TEAM_FILTER_STORAGE_KEY,
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
  FoundationTableColumn,
  FoundationTablePreset,
  FoundationTablePresetId,
  FoundationTransferHistoryItem,
  FoundationTransferHistoryResponse,
  FoundationTransferRecapItem,
  FoundationTransferRecapResponse,
  FoundationTransferRecapTeamSummary,
  FoundationTransfermarktResponse,
  FoundationView,
  FoundationWholeSeasonDryRunSummary,
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
  MATCHDAY_MVP_SCORING_CONFIRM_TOKEN,
  MarketNegotiationOutcome,
  NEW_GAME_PRESET_DEFAULTS,
  NEW_GAME_VISIBLE_PRESET_IDS,
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
  RESULT_APPLY_CONFIRM_TOKEN,
  SEASON_SETUP_STEP_IDS,
  SEASON_TRANSITION_STATIC_STEPS,
  STANDINGS_APPLY_CONFIRM_TOKEN,
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
  SortState,
  TRANSFER_HISTORY_SEASON_LIMIT,
  TRANSFER_MARKET_INITIAL_RENDER_LIMIT,
  TRANSFER_MARKET_RENDER_STEP,
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
  teamIdentityFieldLabels,
  teamStrategyBiasFieldLabels,
  teamStrategyIdentityListFieldLabels,
  teamStrategyLevelFieldLabels,
  teamStrategyListFieldLabels,
  teamStrategySportsBiasAxisMap,
  teamStrategySportsBiasFieldLabels,
} from "@/lib/foundation/tabs/foundation-page-types";
import {
  PlayerPortrait,
  TEAM_ROSTER_PORTRAIT_LOADING,
  applyStoredColumnOrder,
  buildPlayerProfileHydrationFailureKey,
  buildPlayerProfileHydrationLoadingKey,
  buildPlayerProfileHydrationSuccessKey,
  buildSeasonBriefingDismissKey,
  buildTeamIdentityDraftMap,
  clampBiasValue,
  clampIdentityValue,
  clampValue,
  clearSeasonBriefingDismissedFromStorage,
  compareSortValues,
  foundationAdminViews,
  foundationInternalViews,
  foundationPrimaryViews,
  foundationSecondaryViews,
  foundationViews,
  getDefaultTableWidths,
  getFoundationViewScrollTarget,
  getOwnerTeamHighlightClass,
  getPlayerPortraitModel,
  getRanksMetricToneClass,
  getRawFoundationTeamParam,
  getResponsiveTableImageSize,
  getTeamRosterRoleBucket,
  homeTaskLabelContract,
  initialGameState,
  isAbortError,
  isStaleAiPreseasonRun,
  joinClassNames,
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
  resolvePreferredFoundationTeamId,
  scrollToFoundationTarget,
  seasonBriefingDismissStorageKey,
  syncFoundationSaveIdInUrl,
  syncFoundationTeamIdInUrl,
  syncFoundationViewInUrl,
  uniqueColumnIds,
  withNormalizedLocalTeamSettings,
  withSynchronizedStrategyAliases,
  writeSeasonBriefingDismissedToStorage,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";
import {
  DisciplineCategoryFilter,
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
  formatNegotiationSignalLabel,
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
  parseCsvList,
  resolveScenarioMetaLabel,
} from "@/lib/foundation/tabs/foundation-format-render-helpers";
import {
  buildMetricRankClassMap,
  buildMetricRankMap,
  buildNullableSharedRankMap,
  buildSharedRankMap,
  formatSeasonContractNumber,
  getEconomyDeltaClass,
  getHeatClass,
  getPlayerBaselineEconomy,
  getPlayerDisplayMarketValue,
  getPlayerDisplayMarketValueDelta,
  getPlayerDisplaySalary,
  getPlayerOvr,
  getRankHeatClass,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntryCurrentSeasonSalary,
  getRosterEntryNormalSalary,
  getRosterEntrySalaryDelta,
  getRosterEntrySalarySortValue,
  getRosterPlayers,
  getSeasonCashHeatClass,
  getSeasonFactorToneClass,
  getSeasonMatrixRankClass,
  getSeasonTopPlayerTeamTagStyle,
  getTeamHistoryRankToneClass,
  getTop10TrafficRankClass,
  getTransferHistoryAxisHeaderClass,
  isPlausibleSalaryDeltaReference,
  renderEconomyDelta,
  renderMetricBar,
  roundViewNumber,
} from "@/lib/foundation/tabs/season-stand-render-helpers";
import {
  formatCockpitReason,
  formatHomeWarningLabel,
  formatObjectiveStatusLabel,
  getAiTransferBudgetLabel,
  getAiTransferRosterLabel,
  getAiTransferStatusLabel,
  getAiTransferStatusPillClass,
  getCockpitStatusPillClass,
  getGameFlowStatusClass,
  getGameFlowStatusLabel,
} from "@/lib/foundation/tabs/cockpit-ui-helpers";
import { createCockpitMatchdayApplyHandlers } from "@/lib/foundation/tabs/cockpit-matchday-handlers";
import {
  formatFitDisplay,
  formatMarketDevelopmentRoute,
  formatMarketDevelopmentTrend,
  formatMarketRisk,
  formatTopDisciplineScores,
  getMarketTierStyle,
  renderMarketTraitList,
  renderPillValue,
  renderTransfermarktPotential,
} from "@/lib/foundation/tabs/transfermarkt-render-helpers";
import {
  PRESEASON_NEXT_SEASON_SETUP_CONFIRM_TOKEN,
  SEASON_COMPLETION_CONFIRM_TOKEN,
  SEASON_SNAPSHOT_CONFIRM_TOKEN,
} from "@/lib/foundation/tabs/cockpit-confirm-tokens";
import {
  PpAreaFormBonusTotals,
  PpAreaKey,
  buildPpAreaFormBonusByTeamId,
  createEmptyPpAreaFormBonusTotals,
  formatPpFormBonus,
} from "@/lib/foundation/pp-area-form-bonus";
import {
  SortDirection,
} from "@/lib/foundation/foundation-table-ui-types";
import {
  FoundationNavigationTransition,
  bindFoundationNavigationStart,
  bindFoundationNavigationTransition,
  setFoundationView,
} from "@/lib/foundation/foundation-navigation";
import {
  EMPTY_FEATURE_AUDIT_MATRIX,
  EMPTY_MULTI_SEASON_BALANCE_DASHBOARD,
} from "@/lib/foundation/tabs/use-cockpit-panel-derivations";
import {
  HISTORY_ALL_SEASONS_FILTER,
  TRANSFER_HISTORY_ALL_SEASONS_PAGE_SIZE,
} from "@/lib/foundation/tabs/use-history-v2-derivations";
import {
  getTeamAxisRankTooltip,
  getTeamsViewColumnTitle,
  TEAMS_VIEW_COLUMNS,
} from "@/lib/foundation/tabs/teams-ui-helpers";
import {
  formatLocalePoints,
} from "@/lib/foundation/tabs/home-v2-ui-helpers";


const PlayerDetailDrawer = dynamic(() => import("@/app/foundation/PlayerDetailDrawer"), { ssr: false });
const TeamProfileClient = dynamic(() => import("@/app/foundation/team-profile/TeamProfileClient"), {
  ssr: false,
  loading: () => null,
});
const PlayerProfileClient = dynamic(() => import("@/app/foundation/player-profile/PlayerProfileClient"), {
  ssr: false,
  loading: () => null,
});
const PlayerGeneratorPanel = dynamic(() => import("@/app/foundation/PlayerGeneratorPanel"), { ssr: false });
const FoundationTransfermarktV2Panel = dynamic(
  () => import("@/app/foundation/transfermarkt-v2/FoundationTransfermarktV2Panel"),
  {
    ssr: false,
    loading: () => <FoundationPanelSkeleton variant="marketV2" label="Transfermarkt wird geladen…" />,
  },
);
const TransferHistoryV2Client = dynamic(() => import("@/app/foundation/transfer-history-v2/TransferHistoryV2Client"), { ssr: false });
const FoundationSeasonV2Host = dynamic(() => import("@/app/foundation/season-v2/FoundationSeasonV2Host"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="seasonV2" label="Saisonstand wird geladen…" />,
});
const FoundationSeasonV2Panel = dynamic(() => import("@/app/foundation/season-v2/FoundationSeasonV2Panel"), {
  ssr: false,
});
const FoundationLineupPanel = dynamic(() => import("@/app/foundation/legacy-lineup-lab/FoundationLineupPanel"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="lineup" label="Einsatzliste wird geladen…" />,
});
const FoundationTeamsDetailPanel = dynamic(() => import("@/app/foundation/teams-v2/FoundationTeamsDetailPanel"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="teams" label="Teams werden geladen…" />,
});
const FoundationSponsorsPanel = dynamic(() => import("@/app/foundation/sponsors-v2/FoundationSponsorsPanel"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="default" label="Sponsoren werden geladen…" />,
});
const TrainingCompactClient = dynamic(() => import("@/app/foundation/training-compact/TrainingCompactClient"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="trainingCompact" label="Training wird geladen…" />,
});
const FacilitiesV2Client = dynamic(() => import("@/app/foundation/facilities-v2/FacilitiesV2Client"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="default" label="Gebäude werden geladen…" />,
});
const FoundationHomeV2Panel = dynamic(() => import("@/app/foundation/home-v2/FoundationHomeV2Panel"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="homeV2" label="Home wird geladen…" />,
});
const FacilitiesOverviewV2Client = dynamic(
  () => import("@/app/foundation/facilities-overview-v2/FacilitiesOverviewV2Client"),
  { ssr: false },
);
const ScoutingCenterV2Client = dynamic(() => import("@/app/foundation/scouting-center-v2/ScoutingCenterV2Client"), {
  ssr: false,
});
const InboxV2Client = dynamic(() => import("@/app/foundation/inbox-v2/InboxV2Client"), { ssr: false });
const FoundationDebugGameStatePanel = dynamic(
  () => import("@/app/foundation/debug/FoundationDebugGameStatePanel"),
  { ssr: false },
);
const FoundationPlayersTablePanel = dynamic(
  () => import("@/app/foundation/players-table/FoundationPlayersTablePanel"),
  {
    ssr: false,
    loading: () => <FoundationPanelSkeleton variant="default" label="Spielerliste wird geladen…" />,
  },
);

const FOUNDATION_SEASON_SNAPSHOTS_ENDPOINT = "/api/season/snapshots";

const SEASON_V2_TOP_PLAYER_LIMIT = 32;
let runFoundationNavigationTransition: FoundationNavigationTransition = (callback) => {
  callback();
};

function abbreviateDisciplineName(value: string) {
  const normalized = value.trim();
  return (normalized.length > 0 ? normalized : "—").slice(0, 3).toLocaleUpperCase("de");
}

function formatPotentialRange(item: TransfermarktFreeAgentItem) {
  if (!item.potentialRange) {
    return "Range —";
  }
  return `${item.potentialRange.min}-${item.potentialRange.max}`;
}

function normalizeMarketTier(value: string | null | undefined): TransfermarktTier | null {
  const normalized = value === "99" ? "S+" : value;
  return normalized === "S+" ||
    normalized === "S" ||
    normalized === "A" ||
    normalized === "B" ||
    normalized === "C" ||
    normalized === "D" ||
    normalized === "E" ||
    normalized === "F"
    ? normalized
    : null;
}

function getTeamLogoModel(team: Pick<Team, "teamId" | "name" | "logoPath">) {
  const src =
    [team.logoPath].find((value) => typeof value === "string" && value.length > 0 && !value.startsWith("/Users/")) ??
    (team.logoPath?.startsWith("/Users/") ? `/api/media/team-logo/${encodeURIComponent(team.teamId)}` : null);

  const initials = team.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

  return { src, initials };
}

const SEASON_TOP_PLAYER_TEAM_TAG_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  "A-A": { bg: "rgba(125, 44, 48, 0.74)", border: "rgba(236, 92, 89, 0.82)", text: "#ffe0dc", glow: "rgba(236, 92, 89, 0.28)" },
  "B-B": { bg: "rgba(117, 65, 29, 0.76)", border: "rgba(245, 139, 57, 0.82)", text: "#ffe4ca", glow: "rgba(245, 139, 57, 0.25)" },
  "B-P": { bg: "rgba(44, 42, 62, 0.78)", border: "rgba(143, 130, 201, 0.8)", text: "#ebe7ff", glow: "rgba(143, 130, 201, 0.24)" },
  "C-C": { bg: "rgba(117, 90, 37, 0.76)", border: "rgba(247, 205, 91, 0.84)", text: "#fff1c8", glow: "rgba(247, 205, 91, 0.26)" },
  "C-S": { bg: "rgba(55, 78, 92, 0.76)", border: "rgba(159, 205, 225, 0.76)", text: "#e6f7ff", glow: "rgba(159, 205, 225, 0.22)" },
  "D-L": { bg: "rgba(63, 44, 79, 0.76)", border: "rgba(179, 116, 220, 0.8)", text: "#f1ddff", glow: "rgba(179, 116, 220, 0.24)" },
  "D-P": { bg: "rgba(111, 68, 89, 0.76)", border: "rgba(245, 154, 189, 0.78)", text: "#ffe1ee", glow: "rgba(245, 154, 189, 0.23)" },
  "G-G": { bg: "rgba(116, 86, 31, 0.78)", border: "rgba(250, 194, 70, 0.86)", text: "#fff0bd", glow: "rgba(250, 194, 70, 0.27)" },
  "H-R": { bg: "rgba(105, 34, 34, 0.78)", border: "rgba(241, 76, 68, 0.86)", text: "#ffe0dd", glow: "rgba(241, 76, 68, 0.27)" },
  "L-K": { bg: "rgba(51, 62, 78, 0.78)", border: "rgba(142, 169, 207, 0.76)", text: "#e8f0ff", glow: "rgba(142, 169, 207, 0.22)" },
  "L-R": { bg: "rgba(62, 55, 51, 0.78)", border: "rgba(185, 162, 139, 0.72)", text: "#f4e6d8", glow: "rgba(185, 162, 139, 0.2)" },
  "M-M": { bg: "rgba(101, 60, 35, 0.78)", border: "rgba(238, 145, 75, 0.84)", text: "#ffe5cf", glow: "rgba(238, 145, 75, 0.25)" },
  "M-S": { bg: "rgba(78, 40, 72, 0.78)", border: "rgba(210, 104, 183, 0.78)", text: "#ffdff7", glow: "rgba(210, 104, 183, 0.22)" },
  "N-N": { bg: "rgba(64, 54, 82, 0.78)", border: "rgba(176, 148, 227, 0.8)", text: "#eee5ff", glow: "rgba(176, 148, 227, 0.23)" },
  "N-W": { bg: "rgba(45, 84, 54, 0.78)", border: "rgba(121, 202, 131, 0.78)", text: "#def8df", glow: "rgba(121, 202, 131, 0.24)" },
  "P-C": { bg: "rgba(51, 75, 93, 0.78)", border: "rgba(101, 185, 225, 0.76)", text: "#dff5ff", glow: "rgba(101, 185, 225, 0.22)" },
  "P-S": { bg: "rgba(70, 52, 108, 0.78)", border: "rgba(169, 133, 255, 0.86)", text: "#eee5ff", glow: "rgba(169, 133, 255, 0.27)" },
  "R-C": { bg: "rgba(92, 45, 81, 0.78)", border: "rgba(231, 128, 203, 0.78)", text: "#ffe2f8", glow: "rgba(231, 128, 203, 0.24)" },
  "R-L": { bg: "rgba(40, 85, 61, 0.78)", border: "rgba(109, 215, 143, 0.82)", text: "#d9ffe5", glow: "rgba(109, 215, 143, 0.25)" },
  "R-R": { bg: "rgba(34, 87, 98, 0.78)", border: "rgba(83, 205, 225, 0.78)", text: "#d8fbff", glow: "rgba(83, 205, 225, 0.23)" },
  "S-C": { bg: "rgba(98, 46, 38, 0.78)", border: "rgba(236, 104, 83, 0.82)", text: "#ffe1dc", glow: "rgba(236, 104, 83, 0.25)" },
  "S-S": { bg: "rgba(75, 84, 96, 0.78)", border: "rgba(190, 205, 224, 0.78)", text: "#edf5ff", glow: "rgba(190, 205, 224, 0.22)" },
  "T-C": { bg: "rgba(62, 91, 74, 0.78)", border: "rgba(151, 217, 174, 0.76)", text: "#e2ffea", glow: "rgba(151, 217, 174, 0.22)" },
  "T-G": { bg: "rgba(70, 75, 80, 0.78)", border: "rgba(175, 185, 194, 0.76)", text: "#f0f4f8", glow: "rgba(175, 185, 194, 0.22)" },
  "T-T": { bg: "rgba(94, 61, 39, 0.78)", border: "rgba(226, 163, 90, 0.8)", text: "#ffe7ca", glow: "rgba(226, 163, 90, 0.23)" },
  "U-A": { bg: "rgba(44, 75, 91, 0.78)", border: "rgba(112, 185, 223, 0.76)", text: "#e2f6ff", glow: "rgba(112, 185, 223, 0.22)" },
  "V-D": { bg: "rgba(91, 45, 77, 0.78)", border: "rgba(229, 116, 193, 0.78)", text: "#ffe2f5", glow: "rgba(229, 116, 193, 0.22)" },
  "V-V": { bg: "rgba(76, 68, 100, 0.78)", border: "rgba(180, 160, 238, 0.78)", text: "#eee7ff", glow: "rgba(180, 160, 238, 0.23)" },
  "V-W": { bg: "rgba(75, 53, 90, 0.78)", border: "rgba(190, 137, 225, 0.78)", text: "#f5e1ff", glow: "rgba(190, 137, 225, 0.22)" },
  "W-L": { bg: "rgba(64, 73, 77, 0.78)", border: "rgba(165, 190, 198, 0.76)", text: "#e9f6f9", glow: "rgba(165, 190, 198, 0.2)" },
  "W-W": { bg: "rgba(42, 72, 111, 0.78)", border: "rgba(104, 168, 244, 0.84)", text: "#ddecff", glow: "rgba(104, 168, 244, 0.25)" },
  "Z-H": { bg: "rgba(50, 77, 116, 0.78)", border: "rgba(92, 164, 245, 0.84)", text: "#e0efff", glow: "rgba(92, 164, 245, 0.25)" },
};

function hashTeamColorSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getPpAreaKeyForDisciplineCategory(category: string | null | undefined): Exclude<PpAreaKey, "total"> | null {
  if (category === "power") return "pow";
  if (category === "speed") return "spe";
  if (category === "mental") return "men";
  if (category === "social") return "soc";
  return null;
}

function pickRatingsForPlayerIds<T>(ratingsById: Map<string, T>, playerIds: string[]): Map<string, T> {
  const picked = new Map<string, T>();
  for (const playerId of playerIds) {
    const rating = ratingsById.get(playerId);
    if (rating !== undefined) {
      picked.set(playerId, rating);
    }
  }
  return picked;
}

function getPlayerPortraitBrowserUrl(playerId: string, portraitUrl?: string | null, portraitPath?: string | null) {
  if (portraitUrl?.startsWith("http://") || portraitUrl?.startsWith("https://") || (portraitUrl?.startsWith("/") && !portraitUrl.startsWith("/Users/"))) {
    return portraitUrl;
  }

  if (portraitPath?.startsWith("/") && !portraitPath.startsWith("/Users/")) {
    return portraitPath;
  }

  if (portraitPath?.startsWith("/Users/")) {
    return `/api/media/player-portrait/${encodeURIComponent(playerId)}`;
  }

  return null;
}

function WarningList({
  title,
  warnings,
}: {
  title: string;
  warnings: string[];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      {warnings.length > 0 ? (
        <ul className="warning-list">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Aktuell keine offenen Punkte.</p>
      )}
    </section>
  );
}


export function useFoundationShellRouterBodyScope({
  initialReadSource,
  initialSelectedTeamId,
  initialSaveId,
  initialView,
  initialPersistenceState,
  initialActiveOwnerId,
}: FoundationPageClientProps): FoundationShellRouterBodyProps {
  const foundationPageState = useFoundationPageState({
    initialReadSource,
    initialSelectedTeamId,
    initialSaveId,
    initialView,
    initialPersistenceState,
    initialActiveOwnerId,
  });
  const {
    initialPersistedSave, initialClientGameState, initialOwnershipDraft, gameStateRef, commandSearchInputRef, marketValueFilterManualRef, marketCashLimitTeamRef, aiPreseasonRunStartedRef, seasonBriefingAutoOpenedRef, seasonBriefingDismissedRef,
    aiLineupEnsureRunStartedRef, pendingTeamActivationRef, seasonOverviewScopeRef, gameState, setGameState, teamIdentityDraft, setTeamIdentityDraft, teamControlDraft, setTeamControlDraft, gameModeOwnershipChrisIds,
    setGameModeOwnershipChrisIds, gameModeOwnershipFrankyIds, setGameModeOwnershipFrankyIds, teamStrategyDraft, setTeamStrategyDraft, teamIdentityMessage, setTeamIdentityMessage, teamControlMessage, setTeamControlMessage, teamStrategyMessage,
    setTeamStrategyMessage, saveSummaries, setSaveSummaries, activeSaveId, setActiveSaveId, foundationSaveMode, setFoundationSaveMode, roomContext, setRoomContext, roomLiveState,
    setRoomLiveState, roomActivityNotice, setRoomActivityNotice, activeSaveName, setActiveSaveName, isSaveBusy, setIsSaveBusy, readMeta, setReadMeta, selectedTeamId,
    setSelectedTeamId, activeManagerTeamSource, setActiveManagerTeamSource, activeOwnerId, setActiveOwnerId, teamContextFilter, setTeamContextFilter, activeManagerTeamWarning, setActiveManagerTeamWarning, activeView,
    setActiveView, homeV2Tab, setHomeV2Tab, prizeFinanceTab, setPrizeFinanceTab, playerProfileTab, setPlayerProfileTab, playerProfileData, setPlayerProfileData, playerProfileLoading,
    setPlayerProfileLoading, inboxV2SelectedItemId, setInboxV2SelectedItemId, selectedEncyclopediaEntryId, setSelectedEncyclopediaEntryId, lineupFocusRequestKey, setLineupFocusRequestKey, lineupDraftBoardViewRequest, setLineupDraftBoardViewRequest, lineupDraftBoardView,
    setLineupDraftBoardView, scoutingCenterTab, setScoutingCenterTab, scoutingReportSelectedPlayerId, setScoutingReportSelectedPlayerId, showCommandPalette, setShowCommandPalette, commandSearch, setCommandSearch, showExtendedTeamPanels, setShowExtendedTeamPanels, showGameFlowPanel,
    setShowGameFlowPanel, inboxCategoryFilter, setInboxCategoryFilter, inboxIncludeDone, setInboxIncludeDone, inboxIncludeDismissed, setInboxIncludeDismissed, selectedMatchdaySummaryId, setSelectedMatchdaySummaryId, teamSettingsSearch,
    setTeamSettingsSearch, showTeamDisciplines, setShowTeamDisciplines, selectedTeamDetailTab, setSelectedTeamDetailTab, showTeamContractPreviewRows, setShowTeamContractPreviewRows, teamRosterRoleFilter, setTeamRosterRoleFilter, teamRosterFocusMode,
    setTeamRosterFocusMode, showSelectedRosterPpsBreakdown, setShowSelectedRosterPpsBreakdown, trainingModeDraft, setTrainingModeDraft, trainingClassDraft, setTrainingClassDraft, trainingDevelopmentFilter, setTrainingDevelopmentFilter, trainingFacilityPreviewId,
    setTrainingFacilityPreviewId, seasonTableMode, setSeasonTableMode, showSeasonTopPlayerAreas, setShowSeasonTopPlayerAreas, tableSorts, setTableSorts, playerScope,
    setPlayerScope, playerTeamFilter, setPlayerTeamFilter, playerClassFilter, setPlayerClassFilter, playerBracketFilter, setPlayerBracketFilter, marketClassFilter, setMarketClassFilter, marketRaceFilter, setMarketRaceFilter, marketSubclassFilter,
    setMarketSubclassFilter, marketAlignmentFilter, setMarketAlignmentFilter, marketGenderFilter, setMarketGenderFilter, marketPositiveTraitFilter, setMarketPositiveTraitFilter, marketNegativeTraitFilter, setMarketNegativeTraitFilter, marketBracketFilter,
    setMarketBracketFilter, marketTeamId, setMarketTeamId, marketFocusPlayerId, setMarketFocusPlayerId, foundationPanel, setFoundationPanel, foundationFacilityTarget, setFoundationFacilityTarget, marketSearch,
    setMarketSearch, marketMaxValue, setMarketMaxValue, marketMaxSalary, setMarketMaxSalary, marketMinRatio, setMarketMinRatio, marketMinPow, setMarketMinPow, marketMinSpe,
    setMarketMinSpe, marketMinMen, setMarketMinMen, marketMinSoc, setMarketMinSoc, marketShowAdvancedColumns, setMarketShowAdvancedColumns, marketShowAutoAnalysis, setMarketShowAutoAnalysis, marketShowTransferRecap,
    setMarketShowTransferRecap, marketRenderLimit, setMarketRenderLimit, marketLoadingMore, setMarketLoadingMore, historyLoadingMore, setHistoryLoadingMore, bootstrapError, setBootstrapError, persistenceError,
    setPersistenceError, saveSyncError, setSaveSyncError, marketReloadToken, setMarketReloadToken, marketFeed, setMarketFeed, marketBuyBusy, setMarketBuyBusy, marketBuyError,
    setMarketBuyError, marketBuySuccess, setMarketBuySuccess, foundationActionFeedback, setFoundationActionFeedback, seasonBriefingOpen, setSeasonBriefingOpen, freshSeasonStartMessage, setFreshSeasonStartMessage, newGamePresetId,
    setNewGamePresetId, newGameChrisTeamIds, setNewGameChrisTeamIds, newGameFrankyTeamIds, setNewGameFrankyTeamIds, newGameSandbox, setNewGameSandbox, newGameSaveName, setNewGameSaveName, newGamePreview,
    setNewGamePreview, newGameBusy, setNewGameBusy, newGameError, setNewGameError, newGameSuccess, setNewGameSuccess, marketBuyPreview, setMarketBuyPreview, marketBuyPreviewContext,
    setMarketBuyPreviewContext, marketNegotiationOutcome, setMarketNegotiationOutcome, marketPreviewPlayerId, setMarketPreviewPlayerId, marketBuySubject, setMarketBuySubject, marketSellBusy, setMarketSellBusy, marketSellError,
    setMarketSellError, marketSellSuccess, setMarketSellSuccess, marketSellPreview, setMarketSellPreview, contractRenewalBusy, setContractRenewalBusy, contractRenewalMessage, setContractRenewalMessage, contractRenewalError,
    setContractRenewalError, contractRenewalNegotiation, setContractRenewalNegotiation, sponsorChoiceBusy, setSponsorChoiceBusy, sponsorChoiceMessage, setSponsorChoiceMessage, marketSellSubject,
    setMarketSellSubject, marketSellRiskAcknowledged, setMarketSellRiskAcknowledged, marketContractLengthDraft, setMarketContractLengthDraft, marketContractShapeDraft, setMarketContractShapeDraft, marketOfferedSalaryDraft, setMarketOfferedSalaryDraft, marketAiTeamScope,
    setMarketAiTeamScope, marketAiPreviewBusy, setMarketAiPreviewBusy, marketAiPreviewError, setMarketAiPreviewError, marketAiPreviewFeed, setMarketAiPreviewFeed, marketAiPreviewSelectedTeamId, setMarketAiPreviewSelectedTeamId, marketAiSellTeamScope,
    setMarketAiSellTeamScope, marketAiSellPreviewBusy, setMarketAiSellPreviewBusy, marketAiSellPreviewError, setMarketAiSellPreviewError, marketAiSellPreviewFeed, setMarketAiSellPreviewFeed, marketAiSellPreviewSelectedTeamId, setMarketAiSellPreviewSelectedTeamId, marketAiPlanTeamScope,
    setMarketAiPlanTeamScope, marketAiPlanPreviewBusy, setMarketAiPlanPreviewBusy, marketAiPlanPreviewError, setMarketAiPlanPreviewError, marketAiPlanPreviewFeed, setMarketAiPlanPreviewFeed, marketAiPlanPreviewSelectedTeamId, setMarketAiPlanPreviewSelectedTeamId, marketAiCompareTeamScope,
    setMarketAiCompareTeamScope, marketAiCompareBusy, setMarketAiCompareBusy, marketAiCompareError, setMarketAiCompareError, marketAiCompareFeed, setMarketAiCompareFeed, marketAiCompareSelectedTeamId, setMarketAiCompareSelectedTeamId, marketAiApplyBusy,
    setMarketAiApplyBusy, marketAiApplyFeed, setMarketAiApplyFeed, marketAiApplyIncludeWarnings, setMarketAiApplyIncludeWarnings, rosterFillBusy, setRosterFillBusy, rosterFillFeed, setRosterFillFeed, aiPreseasonBusy,
    setAiPreseasonBusy, aiPreseasonFeed, setAiPreseasonFeed, aiLineupEnsureBusy, setAiLineupEnsureBusy, aiLineupEnsureFeed, setAiLineupEnsureFeed, cockpitAiBatchApplyFeed, setCockpitAiBatchApplyFeed, cockpitAiIncludeWarningTeams, setCockpitAiIncludeWarningTeams, cockpitAiOverwriteExisting, setCockpitAiOverwriteExisting, cockpitBusyKey, setCockpitBusyKey, aiPickAuditBusy, setAiPickAuditBusy, aiPickAuditFeed,
    setAiPickAuditFeed, seasonStartResetBusy, setSeasonStartResetBusy, seasonStartResetFeed, setSeasonStartResetFeed, teamProfileTeamId, setTeamProfileTeamId, historyFeed, setHistoryFeed, transferRecapFeed,
    setTransferRecapFeed, resolvePreviewFeed, setResolvePreviewFeed, matchdayMvpScoringFeed, setMatchdayMvpScoringFeed, matchdayMvpForceReplaceExisting, setMatchdayMvpForceReplaceExisting, resultApplyFeed, setResultApplyFeed, standingsPreviewFeed,
    setStandingsPreviewFeed, standingsApplyFeed, setStandingsApplyFeed, disciplineCategoryFilter, setDisciplineCategoryFilter, seasonManagementFeed, setSeasonManagementFeed, facilityUpgradeBusy, setFacilityUpgradeBusy, facilityUpgradePreview,
    setFacilityUpgradePreview, facilityUpgradeError, setFacilityUpgradeError, facilityUpgradeSuccess, setFacilityUpgradeSuccess, facilityMaintenanceBusy, setFacilityMaintenanceBusy, facilityMaintenancePreview, setFacilityMaintenancePreview, facilityMaintenanceError,
    setFacilityMaintenanceError, facilityMaintenanceSuccess, setFacilityMaintenanceSuccess, specialistWingVariantDraft, setSpecialistWingVariantDraft, preSeasonWorkflowBusy, setPreSeasonWorkflowBusy, preSeasonWorkflowFeed, setPreSeasonWorkflowFeed, preSeasonWorkflowError,
    setPreSeasonWorkflowError, seasonTransitionBusy, setSeasonTransitionBusy, seasonTransitionFeed, setSeasonTransitionFeed, seasonCompletionFeed, setSeasonCompletionFeed, seasonTransitionError, setSeasonTransitionError, seasonStandingsFeed,
    setSeasonStandingsFeed, seasonStandingsLoading, setSeasonStandingsLoading, seasonStandingsMode, setSeasonStandingsMode, seasonOverviewSeasonId, setSeasonOverviewSeasonId, prizePreviewFeed, setPrizePreviewFeed, cashApplyFeed,
    setCashApplyFeed, matchdayAdvanceFeed, setMatchdayAdvanceFeed, matchdayAutoRunFeed, setMatchdayAutoRunFeed, matchdayAutoRunIncludeWarningLineups, setMatchdayAutoRunIncludeWarningLineups, matchdayAutoRunOverwriteExistingLineups, setMatchdayAutoRunOverwriteExistingLineups, matchdayAutoRunStopOnTie,
    setMatchdayAutoRunStopOnTie, wholeSeasonDryRunFeed, setWholeSeasonDryRunFeed, seasonSnapshotFeed, setSeasonSnapshotFeed, wholeSeasonIncludeWarningLineups, setWholeSeasonIncludeWarningLineups, wholeSeasonOverwriteExistingLineups, setWholeSeasonOverwriteExistingLineups, wholeSeasonStopOnTie,
    setWholeSeasonStopOnTie, wholeSeasonMaxMatchdays, setWholeSeasonMaxMatchdays, adminSimulationSeasonCount, setAdminSimulationSeasonCount, adminSimulationMode, setAdminSimulationMode, adminSimulationFullChurn, setAdminSimulationFullChurn, adminSimulationInjuries,
    setAdminSimulationInjuries, adminSimulationRun, setAdminSimulationRun, adminSimulationBusy, setAdminSimulationBusy, adminSimulationError, setAdminSimulationError, adminBalancingDraft, setAdminBalancingDraft, adminBalancingMessage,
    setAdminBalancingMessage, adminBalancingBusy, setAdminBalancingBusy, historySeasonFilter, setHistorySeasonFilter, historyTeamFilter, setHistoryTeamFilter, historyTypeFilter, setHistoryTypeFilter, historyClassFilter,
    setHistoryClassFilter, historySourceFilter, setHistorySourceFilter, historySearch, setHistorySearch, tableColumnPreferences, setTableColumnPreferences,
  } = foundationPageState;

  const [historyPage, setHistoryPage] = useState(1);
  const [assignTeamCaptainBusy, setAssignTeamCaptainBusy] = useState(false);
  const [leagueLeadersReturnContext, setLeagueLeadersReturnContext] = useState<{
    playerId: string;
    playerName: string;
  } | null>(null);
  useEffect(() => {
    setHistoryPage(1);
  }, [activeSaveId]);

  // Aktions-Feedback beim View-Wechsel leeren, damit ein "Kapitän ernannt" o.ä.
  // nicht veraltet über anderen Ansichten stehen bleibt.
  useEffect(() => {
    setFoundationActionFeedback(null);
  }, [activeView, setFoundationActionFeedback]);

  // Erfolg/Info/Warnung nach kurzer Zeit selbst ausblenden; Fehler bleiben
  // stehen, bis sie manuell geschlossen werden oder der User wegnavigiert.
  useEffect(() => {
    if (!foundationActionFeedback) {
      return;
    }
    if (foundationActionFeedback.tone === "error" || foundationActionFeedback.tone === "blocked") {
      return;
    }
    const timer = setTimeout(() => setFoundationActionFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [foundationActionFeedback, setFoundationActionFeedback]);

  const activeTransferMarketTab = "v2" as const;
  const isTransferMarketViewActive = activeView === "marketV2";
  const activeTransferHistoryTab = "v2" as const;
  const isTransferHistoryViewActive = activeView === "historyV2" || activeView === "history";
  const shouldBuildTeamsHeavyComparison = activeView === "teams" && showExtendedTeamPanels;
  const shouldBuildDisciplineRanks = resolveShouldBuildDisciplineRanks({
    activeView: activeView as FoundationViewId,
    shouldBuildTeamsHeavyComparison,
  });
  const shouldBuildTeamHistory = shouldBuildTeamsHeavyComparison;
  const shouldBuildTrainingCompactView = activeView === "trainingCompact" || activeView === "training";
  const shouldBuildTrainingFacilitiesView = activeView === "trainingV2" || activeView === "facilitiesOverviewV2";
  const shouldBuildTrainingView = shouldBuildTrainingCompactView || shouldBuildTrainingFacilitiesView;
  const shouldBuildPlayerProfileTrainingRow = activeView === "playerProfile" && Boolean(playerProfileData);
  const shouldBuildPlayerDirectory = activeView === "players";
  const shouldBuildMarketView = isTransferMarketViewActive;
  const shouldBuildScoutingHubView = activeView === "scoutingCenterV2";
  const shouldBuildHomeV2Overview = activeView === "homeV2";
  const shouldBuildTransferHistoryView = isTransferHistoryViewActive;
  const shouldBuildDebugView = activeView === "debug";
  const [matchdaySummaryTab, setMatchdaySummaryTab] = useState<"matchday" | "season">("matchday");
  const shouldBuildTeamContracts = activeView === "teams" && selectedTeamDetailTab === "contracts";
  const shouldBuildExtendedTeamPanels = activeView === "teams" && showExtendedTeamPanels;
  const shouldBuildTeamsView = resolveShouldBuildTeamsView(activeView);
  const shouldLoadTransferHistoryFeed = resolveShouldLoadTransferHistoryFeed(activeView as FoundationViewId);
  const shouldLoadPrizePreviewFeed = resolveShouldLoadPrizePreviewFeed(
    activeView as FoundationViewId,
    prizeFinanceTab,
  );
  const shouldLoadStandingsPreviewFeed = resolveShouldLoadStandingsPreviewFeed(activeView as FoundationViewId);
  const shouldLoadSeasonManagementFeed = resolveShouldLoadSeasonManagementFeed(activeView as FoundationViewId, homeV2Tab);
  const shouldBuildGameFlow = shouldBuildFoundationGameFlow(activeView, homeV2Tab);
  const shouldBuildGameInbox = shouldBuildGameFlow;
  const shouldLoadSeasonOverviewFeed =
    activeView === "seasonV2" ||
    activeView === "prize" ||
    activeView === "ranks" ||
    activeView === "diszis" ||
    activeView === "leagueLeaders" ||
    activeView === "allTimeTable";
  const shouldLoadTeamsHistoryOverview = activeView === "teams" && showExtendedTeamPanels;
  const shouldLoadSeasonOverviewFeedActive = shouldLoadSeasonOverviewFeed || shouldLoadTeamsHistoryOverview;
  const shouldLoadSeasonArchive =
    activeView === "season" ||
    activeView === "seasonV2" ||
    activeView === "prize" ||
    activeView === "ranks" ||
    activeView === "leagueLeaders" ||
    activeView === "allTimeTable" ||
    activeView === "teams" ||
    activeView === "teamProfile" ||
    activeView === "players" ||
    activeView === "playerProfile";
  const isFoundationBootstrapState = gameState.season.id === "loading" || selectedTeamId === "loading-team";
  const shouldBuildSeasonStandRowsGate = shouldBuildSeasonStandRows({
    activeView: activeView as FoundationViewId,
    shouldBuildTeamsView,
    shouldBuildHomeV2Overview,
  });
  const shouldBuildFullSeasonStandRowsGate = shouldBuildFullSeasonStandRows({
    activeView: activeView as FoundationViewId,
    shouldBuildTeamsView,
    shouldBuildHomeV2Overview,
  });
  const shouldBuildSeasonHistorySnapshotsGate = shouldBuildSeasonHistorySnapshots({
    activeView: activeView as FoundationViewId,
    shouldLoadSeasonOverviewFeedActive,
  });
  const shouldBuildSeasonOverviewOptionsGate = shouldBuildSeasonOverviewOptions({
    shouldBuildSeasonHistorySnapshots: shouldBuildSeasonHistorySnapshotsGate,
  });
  const shouldBuildPpAreaRowsGate = shouldBuildPpAreaRows(activeView as FoundationViewId);
  const shouldBuildSeasonFormBonusGate = shouldBuildPpAreaRowsGate || activeView === "seasonV2" || shouldBuildTeamsView;
  const shouldBuildSelectedStandingRowGate = shouldBuildSelectedStandingRow({
    activeView: activeView as FoundationViewId,
    shouldBuildSeasonStandRows: shouldBuildSeasonStandRowsGate,
  });
  // Only "teams" (FoundationTeamsDetailPanel) and "prize" (FoundationSponsorsPanel) render
  // the commercial rating; buildSponsorCommercialRating() runs a full league-wide
  // buildTeamSeasonOverviewRows() scan, so keep this narrower than shouldBuildSelectedStandingRowGate
  // (which also fires for ranks/diszis/season/cockpit) to avoid recomputing it on every tab.
  const shouldBuildSponsorCommercialRatingGate = shouldBuildTeamsView || activeView === "prize";


  useEffect(() => {
    setRoomContext(readFoundationRoomContextFromLocation());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const prefetchHeavyFoundationPanels = () => {
      void import("@/app/foundation/season-v2/FoundationSeasonV2Panel");
      void import("@/app/foundation/teams-v2/FoundationTeamsDetailPanel");
      void import("@/app/foundation/legacy-lineup-lab/FoundationLineupPanel");
      void import("@/app/foundation/transfermarkt-v2/FoundationTransfermarktV2Panel");
    };

    const schedule =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback.bind(window)
        : (callback: () => void) => window.setTimeout(callback, 1200);

    const cancel =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback.bind(window)
        : (handle: number) => window.clearTimeout(handle);

    const handle = schedule(prefetchHeavyFoundationPanels);
    return () => cancel(handle);
  }, []);

  useEffect(() => {
    if (!roomContext) {
      setRoomLiveState(null);
      setRoomActivityNotice(null);
      return undefined;
    }

    const currentRoomContext = roomContext;
    const socket = getClientSocket();

    function handleRoomJoined(payload: { roomCode: string; state: OlyRoomState }) {
      if (payload.roomCode.toUpperCase() !== currentRoomContext.roomCode.toUpperCase()) {
        return;
      }
      setRoomLiveState(payload.state);
    }

    function handleRoomState(state: OlyRoomState) {
      if (state.roomCode.toUpperCase() !== currentRoomContext.roomCode.toUpperCase()) {
        return;
      }
      setRoomLiveState(state);
    }

    socket.on("roomJoined", handleRoomJoined);
    socket.on("roomState", handleRoomState);
    function handleRoomError(payload: { roomCode?: string; message?: string }) {
      if (payload.roomCode && payload.roomCode.toUpperCase() !== currentRoomContext.roomCode.toUpperCase()) {
        return;
      }
      setRoomLiveState(null);
      setFoundationActionFeedback({
        tone: "warning",
        title: "Room-Session abgelaufen",
        detail: payload.message ?? "Der gespeicherte Sitzplatz ist ungültig. Bitte Room neu öffnen oder Save neu laden.",
      });
    }
    socket.on("roomError", handleRoomError);
    socket.emit("rejoinRoom", {
      roomCode: currentRoomContext.roomCode,
      seatToken: currentRoomContext.seatToken,
    });

    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("roomState", handleRoomState);
      socket.off("roomError", handleRoomError);
    };
  }, [roomContext]);

  useEffect(() => {
    if (!roomContext?.saveId || roomContext.saveId === activeSaveId || isSaveBusy) {
      return;
    }
    void runSaveAction({ action: "activate", saveId: roomContext.saveId });
  }, [activeSaveId, isSaveBusy, roomContext?.saveId]);

  useEffect(() => {
    setAdminBalancingDraft(resolveAdminBalancingConfig(gameState.seasonState.adminBalancingConfig));
    setAdminBalancingMessage(null);
  }, [activeSaveId, gameState.seasonState.adminBalancingConfig]);

  function updateAdminClassWeight(className: string, attribute: PlayerGeneratorAttributeName, value: number) {
    setAdminBalancingDraft((current) => ({
      ...current,
      classProgressionWeights: {
        ...current.classProgressionWeights,
        [className]: {
          ...current.classProgressionWeights[className],
          [attribute]: Number.isFinite(value) ? value : 0,
        },
      },
    }));
    setAdminBalancingMessage(null);
  }

  function updateAdminTraitTrainingFactor(trait: string, value: number) {
    setAdminBalancingDraft((current) => ({
      ...current,
      traitTrainingFactorsPct: {
        ...current.traitTrainingFactorsPct,
        [trait]: Number.isFinite(value) ? value : 0,
      },
    }));
    setAdminBalancingMessage(null);
  }

  function updateAdminPrizePercent(index: number, value: number) {
    setAdminBalancingDraft((current) => {
      const prizeMoneyPercents = [...current.prizeMoneyPercents];
      prizeMoneyPercents[index] = Math.max(0, Number.isFinite(value) ? value : 0);
      return {
        ...current,
        prizeMoneyPercents,
      };
    });
    setAdminBalancingMessage(null);
  }

  function withRoomBody<T extends Record<string, unknown>>(body: T) {
    const targetTeamId = typeof body.teamId === "string" ? body.teamId : selectedTeamId;
    const targetControl = targetTeamId
      ? buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings)[targetTeamId]
      : null;
    const resolvedOwnerId =
      targetControl?.ownerSlot === "user"
        ? DEFAULT_ACTIVE_OWNER_ID
        : targetControl?.ownerId?.trim() || effectiveActiveOwnerId;
    return withRoomContextBody(
      {
        ...body,
        activeManagerTeamId: targetTeamId || selectedTeamId,
        activeOwnerId: resolvedOwnerId,
        controlMode: targetControl?.controlMode ?? null,
      },
      roomContext,
    );
  }

  const shouldLoadTransferRecapFeed = false;
  const isMarketSellPanelOpen = foundationPanel === "sell" && marketSellSubject != null;
  const isMarketOfferPanelOpen = foundationPanel === "offer";
  const shouldBuildPlayerRatings =
    shouldBuildMarketView ||
    shouldBuildPlayerDirectory ||
    shouldBuildTrainingView ||
    shouldBuildHomeV2Overview ||
    isMarketSellPanelOpen ||
    isMarketOfferPanelOpen ||
    shouldBuildExtendedTeamPanels ||
    activeView === "teams" ||
    activeView === "teamProfile" ||
    activeView === "seasonV2" ||
    activeView === "ranks" ||
    activeView === "diszis" ||
    activeView === "leagueLeaders" ||
    activeView === "prize";
  const shouldBuildSeasonTopPlayerRows =
    activeView === "seasonV2" ||
    activeView === "ranks" ||
    activeView === "diszis" ||
    activeView === "leagueLeaders" ||
    activeView === "prize";
  const shouldBuildLeagueLeaderBoards = activeView === "ranks" || activeView === "leagueLeaders";
  const shouldBuildAllTimeTable = activeView === "allTimeTable";
  const shouldLoadSeasonLedger = shouldBuildPlayerDirectory;
  const shouldLoadSeasonRatings = shouldBuildPlayerRatings || shouldBuildTrainingView;
  const shouldFetchSeasonRatingsFromApi = shouldLoadSeasonRatings && !shouldLoadSeasonLedger;
  const seasonContentSignature = useMemo(() => buildGameStateContentSignature(gameState), [gameState]);
  const playerDirectorySlice = usePlayerDirectorySlice({
    enabled: shouldBuildPlayerDirectory,
    saveId: activeSaveId,
    seasonId: gameState.season.id,
    contentSignature: seasonContentSignature,
  });
  const seasonRatingsSlice = useSeasonRatingsSlice({
    enabled: shouldFetchSeasonRatingsFromApi,
    saveId: activeSaveId,
    seasonId: gameState.season.id,
    contentSignature: seasonContentSignature,
    source: readMeta.source,
  });
  const teamOverviewSlice = useTeamOverviewSlice({
    enabled:
      shouldBuildSeasonStandRowsGate &&
      Boolean(activeSaveId) &&
      activeSaveId !== "loading-save" &&
      gameState.season.id !== "loading",
    saveId: activeSaveId,
    seasonId: seasonOverviewSeasonId || gameState.season.id,
    contentSignature: seasonContentSignature,
  });
  const { seasonStandRows } = useSeasonStandRows({
    shouldBuildSeasonStandRows: shouldBuildSeasonStandRowsGate,
    shouldBuildFullSeasonStandRows: shouldBuildFullSeasonStandRowsGate,
    gameState,
    activeSaveId,
    seasonOverviewSeasonId: seasonOverviewSeasonId || gameState.season.id,
    seasonStandingsFeed,
    seasonManagementFeed,
    teamOverviewSlice,
  });
  // Teams-Detail (Verträge/Kader) zeigt pro Spieler ausklappbare Disziplin-PPs.
  // Die dafür nötigen echten Pro-Disziplin-Punkte liegen NUR im Season-Ledger
  // (aggregierte Achsen-PPs kommen aus dem Ratings-Slice) — daher wird das
  // (gecachte) `useSeasonDerivations` hier zusätzlich aktiviert, sobald die
  // Teams-Ansicht offen ist. Andere Ledger-Konsumenten bleiben über ihre
  // eigenen `shouldLoad*`-Gates unberührt (Ratings kommen weiter aus dem Slice).
  const shouldLoadTeamsRosterDisciplineLedger = shouldBuildTeamsView;
  const shouldLoadSeasonDerivations =
    shouldLoadTeamsRosterDisciplineLedger ||
    (shouldLoadSeasonLedger && Boolean(playerDirectorySlice.error)) ||
    (shouldLoadSeasonRatings && (Boolean(seasonRatingsSlice.error) || seasonRatingsSlice.ratingsById.size === 0));
  const deferredGameState = useDeferredValue(gameState);
  const inboxGameState = deferredGameState;
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    bindFoundationNavigationTransition(startTransition);
    bindFoundationNavigationStart(() => {
      pauseFoundationNavigationSideEffects({
        autoPersistPausedRef,
        autoPersistUnpauseTimeoutRef,
        foundationViewTransitionUntilRef,
      });
    });
    return () => {
      bindFoundationNavigationTransition((callback) => {
        callback();
      });
      bindFoundationNavigationStart(() => undefined);
    };
  }, []);
  const [isTeamSwitchPending, startTeamSwitchTransition] = useTransition();
  const deferredMarketSearch = useDeferredValue(marketSearch);
  const deferredHistorySearch = useDeferredValue(historySearch);
  const deferredPlayerTeamFilter = useDeferredValue(playerTeamFilter);
  const deferredPlayerClassFilter = useDeferredValue(playerClassFilter);
  const deferredPlayerBracketFilter = useDeferredValue(playerBracketFilter);
  const seasonTableShellRef = useRef<HTMLDivElement | null>(null);
  const tableResizeState = useRef<{
    tableId: string;
    columnId: string;
    startX: number;
    startWidth: number;
    minWidth: number;
    maxWidth?: number;
  } | null>(null);
  const tableDragState = useRef<{ tableId: string; columnId: string } | null>(null);
  const marketBuyPreviewRequestVersion = useRef(0);
  const marketSellPreviewRequestVersion = useRef(0);
  const marketFeedReloadersRef = useRef<FoundationMarketFeedReloaders>({
    reloadMarketFeed: async () => null,
    reloadHistoryFeed: async () => null,
    reloadTransferRecapFeed: async () => null,
  });
  const seasonFeedReloadersRef = useRef<FoundationSeasonFeedReloaders>({
    reloadSeasonStandingsOverview: async () => null,
    reloadStandingsPreviewFeed: async () => null,
    reloadPrizePreviewFeed: async () => null,
    reloadSeasonManagementOverview: async () => null,
    reloadResolvePreview: async () => null,
  });
  const fullSeasonArchiveLoadKeyRef = useRef<string | null>(null);
  const loadedSeasonArchiveSignatureRef = useRef<string | null>(null);
  const pendingPlayerProfileHydrationRef = useRef<{ playerId: string; tab: PlayerProfileTabId } | null>(null);
  const briefingUrlHydratedRef = useRef(false);
  // Startbildschirm-"Neues Spiel" (?newGame=1): Die Absicht wird EINMAL beim Mount
  // festgehalten. Der URL-Parameter selbst überlebt die erste Foundation-URL-
  // Synchronisierung nicht (er ist kein Teil von FoundationUrlState), deshalb kann
  // shouldSuppressSeasonBriefingReopen ihn nicht später erneut aus der URL lesen.
  // Gemerkt wird zusätzlich der Save, der beim Betreten aktiv war ("Baseline"):
  // Solange dieser Save aktiv bleibt, wird sein Season-Einstieg unterdrückt, damit
  // der New-Game-Assistent nicht sofort verdeckt wird. Sobald ein anderer Save
  // aktiv ist (= das neue Spiel wurde erstellt), greift wieder die normale Logik
  // und der Season-Einstieg des NEUEN Spiels läuft ganz regulär.
  const newGameIntentRef = useRef<boolean | null>(null);
  if (newGameIntentRef.current === null) {
    newGameIntentRef.current = parseFoundationNewGameIntentFromUrl();
  }
  const newGameIntentBaselineSaveIdRef = useRef<string | null>(null);
  const playerProfileHydrationAttemptRef = useRef<string | null>(null);
  const playerProfileHydrationSequenceRef = useRef(0);
  const previousFoundationViewRef = useRef<FoundationView | null>(null);
  const aiPreseasonCompanionReloadRunIdRef = useRef<string | null>(null);
  const playerProfileDataRef = useRef<PlayerDetailDrawerData | null>(null);
  playerProfileDataRef.current = playerProfileData;

  const [fetchSlowWarning, setFetchSlowWarning] = useState(false);
  const handleFetchSlow = useCallback(() => setFetchSlowWarning(true), []);
  const handleFetchSlowClear = useCallback(() => setFetchSlowWarning(false), []);

  function showReadOnlyNotice() {
    setFoundationActionFeedback({
      tone: "blocked",
      title: "Nur Lesen",
      detail: "Prisma/Supabase-Modus ist schreibgeschützt. Für lokale Saves auf SQLite-Modus wechseln.",
    });
  }

  const {
    loadSave,
    persistLocalGameStateImmediately,
    handleStaleRoomSaveWrite,
    runSaveAction,
    changeFoundationSaveMode,
    clearSaveScopedFeeds,
    skipNextFullPersistCountRef,
    hasPersistedInitialState,
    hasLoadedPersistentState,
    foundationViewTransitionUntilRef,
    autoPersistPausedRef,
    autoPersistUnpauseTimeoutRef,
    autoPersistInFlightRef,
    liveSaveRefreshInFlightRef,
    liveSaveVersionSignatureRef,
  } = useFoundationPersistenceActions({
    initialPersistedSave,
    initialSaveId,
    initialReadSource,
    initialSelectedTeamId,
    gameState,
    setGameState,
    gameStateRef,
    activeSaveId,
    setActiveSaveId,
    setActiveSaveName,
    foundationSaveMode,
    setFoundationSaveMode,
    setSaveSummaries,
    readMeta,
    setReadMeta,
    selectedTeamId,
    setSelectedTeamId,
    activeManagerTeamSource,
    setActiveManagerTeamSource,
    setActiveManagerTeamWarning,
    setMarketTeamId,
    setIsSaveBusy,
    setPersistenceError,
    setBootstrapError,
    setTrainingModeDraft,
    setTrainingClassDraft,
    setActiveView,
    setSeasonOverviewSeasonId,
    roomContext,
    feedSetters: {
      setMarketFeed,
      setMarketRenderLimit,
      setMarketLoadingMore,
      setMarketBuyPreview,
      setMarketBuyPreviewContext,
      setMarketBuyError,
      setMarketBuySuccess,
      setMarketBuySubject,
      setFoundationPanel,
      setMarketSellPreview,
      setMarketSellError,
      setMarketSellSuccess,
      setMarketSellSubject,
      setMarketSellRiskAcknowledged,
      setMarketAiPreviewFeed,
      setMarketAiSellPreviewFeed,
      setMarketAiPlanPreviewFeed,
      setMarketAiCompareFeed,
      setMarketAiApplyFeed,
      setRosterFillFeed,
      setAiPreseasonFeed,
      setAiPreseasonBusy,
      setAiPickAuditFeed,
      setSeasonStartResetFeed,
      setHistoryFeed,
      setHistorySeasonFilter,
      setTransferRecapFeed,
      setResolvePreviewFeed,
      setCockpitAiBatchApplyFeed,
      setMatchdayMvpScoringFeed,
      setResultApplyFeed,
      setStandingsPreviewFeed,
      setStandingsApplyFeed,
      setSeasonManagementFeed,
      setFacilityUpgradePreview,
      setFacilityUpgradeError,
      setFacilityUpgradeSuccess,
      setPreSeasonWorkflowFeed,
      setPreSeasonWorkflowError,
      setSeasonTransitionFeed,
      setSeasonCompletionFeed,
      setSeasonTransitionError,
      setSeasonStandingsFeed,
      setSeasonOverviewSeasonId,
      setPrizePreviewFeed,
      setCashApplyFeed,
      setMatchdayAdvanceFeed,
      setMatchdayAutoRunFeed,
      setWholeSeasonDryRunFeed,
      setSeasonSnapshotFeed,
      setPlayerProfileData,
      setTeamProfileTeamId,
      setFoundationActionFeedback,
    },
    onSaveConflictReload: async (reloaded) => {
      const profilePlayerId = playerProfileDataRef.current?.playerId ?? null;
      if (!profilePlayerId) {
        return;
      }
      playerProfileHydrationAttemptRef.current = null;
      try {
        const { buildPlayerDrawerDataFromGameState } = await import("@/lib/foundation/player-detail-drawer");
        const refreshedProfile = buildPlayerDrawerDataFromGameState({
          gameState: reloaded,
          playerId: profilePlayerId,
          activePlayerId: playerProfileDataRef.current?.activePlayerId,
          source: readMeta.source,
        });
        setPlayerProfileData(refreshedProfile);
        if (refreshedProfile) {
          playerProfileHydrationAttemptRef.current = buildPlayerProfileHydrationSuccessKey(
            reloaded.season.id,
            profilePlayerId,
          );
        }
      } catch {
        setPlayerProfileData(null);
      }
    },
    showReadOnlyNotice,
    syncFoundationViewInUrl,
    setFreshSeasonStartMessage,
    onFetchSlow: handleFetchSlow,
    onFetchSlowClear: handleFetchSlowClear,
  });

  const {
    reloadMarketFeed,
    reloadAiTransferPreview,
    reloadAiSellPreview,
    reloadAiMarketPlanPreview,
    reloadAiNeedsPicksCompare,
    reloadHistoryFeed,
    loadMoreHistoryFeed,
    reloadTransferRecapFeed,
    loadMoreMarketFeed,
  } = useFoundationMarketFeedActions({
    activeSaveId,
    activeView,
    gameStateSeasonId: gameState.season.id,
    readMeta,
    isFoundationBootstrapState,
    marketTeamId,
    marketMaxValue,
    marketFeed,
    setMarketFeed,
    setMarketRenderLimit,
    marketLoadingMore,
    setMarketLoadingMore,
    marketReloadToken,
    marketAiTeamScope,
    marketAiSellTeamScope,
    marketAiPlanTeamScope,
    marketAiCompareTeamScope,
    setMarketAiPreviewBusy,
    setMarketAiPreviewError,
    setMarketAiPreviewFeed,
    setMarketAiPreviewSelectedTeamId,
    setMarketAiSellPreviewBusy,
    setMarketAiSellPreviewError,
    setMarketAiSellPreviewFeed,
    setMarketAiSellPreviewSelectedTeamId,
    setMarketAiPlanPreviewBusy,
    setMarketAiPlanPreviewError,
    setMarketAiPlanPreviewFeed,
    setMarketAiPlanPreviewSelectedTeamId,
    setMarketAiCompareBusy,
    setMarketAiCompareError,
    setMarketAiCompareFeed,
    setMarketAiCompareSelectedTeamId,
    historyFeed,
    setHistoryFeed,
    historySeasonFilter,
    historyLoadingMore,
    setHistoryLoadingMore,
    setTransferRecapFeed,
    shouldLoadTransferHistoryFeed,
    shouldLoadTransferRecapFeed,
    seasonOverviewSeasonId,
    marketFeedReloadersRef,
  });

  const { reloadLiveSeasonState, liveSyncStatus } = useFoundationLiveSync({
    gameState,
    setGameState,
    activeSaveId,
    foundationSaveMode,
    readMeta,
    activeView,
    seasonOverviewSeasonId,
    setSeasonOverviewSeasonId,
    roomContext,
    roomLiveState,
    setRoomActivityNotice,
    setSaveSyncError,
    setFoundationActionFeedback,
    setMarketReloadToken,
    shouldLoadStandingsPreviewFeed,
    shouldLoadPrizePreviewFeed,
    shouldLoadSeasonManagementFeed,
    loadSave,
    marketFeedReloadersRef,
    seasonFeedReloadersRef,
    autoPersistPausedRef,
    autoPersistUnpauseTimeoutRef,
    autoPersistInFlightRef,
    liveSaveRefreshInFlightRef,
    liveSaveVersionSignatureRef,
    foundationViewTransitionUntilRef,
    hasLoadedPersistentState,
  });

  const {
    reloadResolvePreview,
    reloadStandingsPreviewFeed,
    reloadPrizePreviewFeed,
    reloadSeasonStandingsOverview,
    reloadSeasonManagementOverview,
    buildCockpitScopeParams,
  } = useFoundationSeasonFeedActions({
    activeSaveId,
    activeView,
    gameStateSeasonId: gameState.season.id,
    gameStateMatchdayId: gameState.matchdayState.matchdayId,
    readMeta,
    isFoundationBootstrapState,
    roomContext,
    seasonOverviewSeasonId,
    seasonContentSignature,
    marketReloadToken,
    prizeFinanceTab,
    shouldLoadPrizePreviewFeed,
    shouldLoadStandingsPreviewFeed,
    shouldLoadSeasonManagementFeed,
    seasonFeedReloadersRef,
    setResolvePreviewFeed,
    setStandingsPreviewFeed,
    setPrizePreviewFeed,
    setSeasonStandingsFeed,
    setSeasonStandingsLoading,
    setSeasonManagementFeed,
    setCockpitAiBatchApplyFeed,
    setResultApplyFeed,
    setStandingsApplyFeed,
    setCashApplyFeed,
    setMatchdayAdvanceFeed,
  });

  async function saveAdminBalancingConfig(nextDraft = adminBalancingDraft) {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    const nextConfig = resolveAdminBalancingConfig({
      ...nextDraft,
      updatedAt: new Date().toISOString(),
    });
    const nextGameState: GameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        adminBalancingConfig: nextConfig,
      },
    };

    setAdminBalancingBusy(true);
    setAdminBalancingMessage(null);
    setGameState(nextGameState);
    try {
      await persistLocalGameStateImmediately(nextGameState);
      setAdminBalancingDraft(nextConfig);
      setAdminBalancingMessage("Balancing-Matrix gespeichert. Neue Progression/Preisgeld-Previews nutzen diese Werte.");
    } catch (error) {
      setAdminBalancingMessage(error instanceof Error ? error.message : "Balancing-Matrix konnte nicht gespeichert werden.");
    } finally {
      setAdminBalancingBusy(false);
    }
  }

  async function resetAdminBalancingConfig() {
    const defaults = getDefaultAdminBalancingConfig();
    setAdminBalancingDraft(defaults);
    await saveAdminBalancingConfig(defaults);
  }

  function setActiveManagerTeam(
    teamId: string,
    source: ActiveManagerTeamSource = "manual_select",
    // `saveIdOverride` scopes the persisted team preference to a specific save id.
    // Needed right after creating a new game: at that point the `activeSaveId`
    // captured in this closure is still the PREVIOUS save's id (the new save's
    // setActiveSaveId has not re-rendered this closure yet), so persisting under
    // the closure value would scope the new team to the wrong save — and the
    // previous save's team could then resurface. Callers that already know the
    // freshly created save id pass it here.
    saveIdOverride?: string | null,
  ) {
    const resolvedTeamId = resolveFoundationTeamId(gameState.teams, teamId);
    if (!resolvedTeamId) {
      setActiveManagerTeamWarning(`Team ${teamId} ist in diesem Save nicht vorhanden.`);
      return;
    }

    // Viewing/switching the active team must not change teamControlSettings.
    // Ownership (manual vs ai) is edited explicitly in Team Settings and persisted via saveTeamSettings().
    setSelectedTeamId(resolvedTeamId);
    setActiveManagerTeamSource(source);
    setActiveManagerTeamWarning(null);
    if (isTransferMarketViewActive) {
      setMarketTeamId(resolvedTeamId);
    }
    syncFoundationTeamIdInUrl(resolvedTeamId);
    persistFoundationManagerTeamId(resolvedTeamId, saveIdOverride ?? activeSaveId, source);
  }

  function clearPendingTeamActivation() {
    if (pendingTeamActivationRef.current) {
      clearTimeout(pendingTeamActivationRef.current);
      pendingTeamActivationRef.current = null;
    }
  }

  function scheduleActiveManagerTeam(teamId: string, source: ActiveManagerTeamSource = "manual_select", afterSelect?: () => void) {
    clearPendingTeamActivation();
    pendingTeamActivationRef.current = setTimeout(() => {
      pendingTeamActivationRef.current = null;
      setActiveManagerTeam(teamId, source);
      afterSelect?.();
    }, 180);
  }

  function handleManagerTeamSelect(value: string) {
    if (value === "__all_teams__") {
      setTeamContextFilter("all");
      setActiveManagerTeamWarning("Alle 32 Teams sind im Dropdown sichtbar. Aktives Manager-Team bleibt unverändert.");
      return;
    }

    startTeamSwitchTransition(() => {
      setActiveManagerTeam(value, "manual_select");
    });
  }

  function toggleTableSort(tableId: string, columnKey: string) {
    setTableSorts((current) => {
      const previous = current[tableId];
      if (previous?.key === columnKey) {
        return {
          ...current,
          [tableId]: {
            key: columnKey,
            direction: previous.direction === "asc" ? "desc" : "asc",
          },
        };
      }

      // Achsen (POW/SPE/MEN/SOC) und Einzeldisziplinen in der Spielerliste
      // beantworten "wer ist der Beste?" — dort ist beim ersten Klick
      // absteigend (höchster Wert zuerst) die natürliche Erwartung, sonst
      // muss man immer zweimal klicken. Alle anderen Spalten bleiben beim
      // bisherigen "asc zuerst"-Verhalten.
      const wantsDescendingFirst =
        tableId === "playersTable" &&
        (columnKey.startsWith("discipline:") || ["pow", "spe", "men", "soc"].includes(columnKey));

      return {
        ...current,
        [tableId]: {
          key: columnKey,
          direction: wantsDescendingFirst ? "desc" : "asc",
        },
      };
    });
  }

  function getViewClass(...views: FoundationView[]) {
    return views.includes(activeView) ? "" : " foundation-section-hidden";
  }

  function showTeamManagementLockedNotice(teamName = selectedTeam?.name ?? "dieses Team") {
    setFoundationActionFeedback({
      tone: "warning",
      title: "Team gesperrt",
      detail: `${teamName} gehört nicht zu deinen steuerbaren Teams. Du kannst es ansehen, aber Management-Aktionen sind gesperrt.`,
    });
  }

  async function refreshOpenPlayerProfileAfterTrainingChange(nextGameState: GameState, playerId: string) {
    if (playerProfileDataRef.current?.playerId !== playerId) {
      return;
    }

    try {
      const { buildPlayerDrawerDataFromGameState } = await import("@/lib/foundation/player-detail-drawer");
      const refreshedProfile = buildPlayerDrawerDataFromGameState({
        gameState: nextGameState,
        playerId,
        activePlayerId: playerProfileDataRef.current.activePlayerId,
        source: readMeta.source,
        manageableTeamIds: foundationManageableTeamIds,
        saveId: activeSaveId,
      });
      if (refreshedProfile) {
        setPlayerProfileData(refreshedProfile);
      }
    } catch (error) {
      console.warn("Player profile training refresh failed.", error);
    }
  }

  async function persistNewGameFlowStepStatus(stepId: NewGameFlowStepId, status: NewGameFlowStepStatus) {
    if (readMeta.source === "prisma" || readMeta.readOnly) {
      return;
    }

    const response = await fetch(
      `/api/singleplayer-state?${new URLSearchParams({
        source: readMeta.source,
        saveMode: foundationSaveMode,
      }).toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "new-game-flow-step",
          saveId: activeSaveId,
          stepId,
          status,
          selectedTeamId: selectedTeamId ?? activeManagerTeamId ?? null,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Flow-Schritt konnte nicht gespeichert werden.");
    }

    const payload = (await response.json()) as {
      save?: { saveId: string; name?: string; saveVersion?: number };
      saves?: SaveSummary[];
    };
    if (payload.save?.name) {
      setActiveSaveName(payload.save.name);
    }
    if (payload.saves) {
      setSaveSummaries(payload.saves);
    }
    if (payload.save?.saveVersion != null) {
      setGameState((current) =>
        current.saveVersion === payload.save?.saveVersion
          ? current
          : {
              ...current,
              saveVersion: payload.save?.saveVersion,
            },
      );
    }
  }

  async function setPlayerTrainingMode(playerId: string, mode: TrainingModeDraft) {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    // T-009: Kein Season-Phasen-Lock mehr für Trainingsintensität — Training
    // bleibt für das eigene (steuerbare) Team immer einstellbar. Siehe
    // lib/foundation/game-phase-action-policy.ts (isTrainingIntensityLockedForSeason
    // liefert dauerhaft `false`); readMeta.readOnly oben deckt weiterhin den
    // "fremdes Team / reine Ansicht"-Fall ab.

    setTrainingModeDraft((current) => ({
      ...current,
      [playerId]: mode,
    }));

    const teamId = gameState.rosters.find((entry) => entry.playerId === playerId)?.teamId ?? null;
    const nextGameState: GameState = {
      ...gameState,
      players: gameState.players.map((player) => (player.id === playerId ? { ...player, trainingMode: mode } : player)),
      seasonState: teamId
        ? {
            ...gameState.seasonState,
            trainingIntensityConfirmations: {
              ...(gameState.seasonState.trainingIntensityConfirmations ?? {}),
              [teamId]: {
                teamId,
                seasonId: gameState.season.id,
                confirmedAt: new Date().toISOString(),
                sourcePlanId: "manual_player_training_mode",
              },
            },
          }
        : gameState.seasonState,
    };

    setGameState(nextGameState);
    void refreshOpenPlayerProfileAfterTrainingChange(nextGameState, playerId);
    try {
      await persistLocalGameStateImmediately(nextGameState);
    } catch (error) {
      setFoundationActionFeedback({
        tone: "warning",
        title: "Training nicht gespeichert",
        detail: error instanceof Error ? error.message : "Training konnte nicht gespeichert werden.",
      });
    }
  }

  async function setPlayerTrainingClass(playerId: string, trainingClass: TrainingClassDraft) {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    setTrainingClassDraft((current) => ({
      ...current,
      [playerId]: trainingClass,
    }));

    const nextGameState: GameState = {
      ...gameState,
      players: gameState.players.map((player) => (player.id === playerId ? { ...player, trainingClass } : player)),
    };

    setGameState(nextGameState);
    void refreshOpenPlayerProfileAfterTrainingChange(nextGameState, playerId);
    try {
      await persistLocalGameStateImmediately(nextGameState);
    } catch (error) {
      setFoundationActionFeedback({
        tone: "warning",
        title: "Trainingsklasse nicht gespeichert",
        detail: error instanceof Error ? error.message : "Trainingsklasse konnte nicht gespeichert werden.",
      });
    }
  }

  function updateTeamControlDraft(teamId: string, updater: (current: TeamControlSettings) => TeamControlSettings) {
    setTeamControlDraft((current) => {
      const base =
        current[teamId] ??
        buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings)[teamId];

      if (!base) {
        return current;
      }

      return {
        ...current,
        [teamId]: updater(base),
      };
    });
    setTeamControlMessage(null);
  }

  function applyCurrentSaveOwnershipDraft(chrisTeamIds: string[], frankyTeamIds: string[]) {
    setTeamControlDraft(
      applyChrisFrankyOwnershipToTeamControlSettings(gameState.teams, chrisTeamIds, frankyTeamIds, teamControlDraft),
    );
    setTeamControlMessage("Ownership im Draft angepasst. Bitte 'Lokal speichern' klicken.");
  }

  function toggleCurrentSaveTeamOwnership(owner: "chris" | "franky", teamId: string) {
    const { chrisTeamIds, frankyTeamIds } = deriveChrisFrankyTeamIdsFromSettings(gameState.teams, teamControlDraft);
    if (owner === "chris") {
      const nextChrisTeamIds = chrisTeamIds.includes(teamId)
        ? chrisTeamIds.filter((entry) => entry !== teamId)
        : [...chrisTeamIds.filter((entry) => entry !== teamId), teamId].filter((entry) => !frankyTeamIds.includes(entry));
      applyCurrentSaveOwnershipDraft(
        nextChrisTeamIds,
        frankyTeamIds.filter((entry) => entry !== teamId),
      );
      return;
    }

    const nextFrankyTeamIds = frankyTeamIds.includes(teamId)
      ? frankyTeamIds.filter((entry) => entry !== teamId)
      : [...frankyTeamIds.filter((entry) => entry !== teamId), teamId].filter((entry) => !chrisTeamIds.includes(entry));
    applyCurrentSaveOwnershipDraft(
      chrisTeamIds.filter((entry) => entry !== teamId),
      nextFrankyTeamIds,
    );
  }

  function applyGameModeOwnershipDraft(chrisTeamIds: string[], frankyTeamIds: string[]) {
    setGameModeOwnershipChrisIds(chrisTeamIds);
    setGameModeOwnershipFrankyIds(frankyTeamIds);
    setTeamControlDraft(
      applyChrisFrankyOwnershipToTeamControlSettings(gameState.teams, chrisTeamIds, frankyTeamIds, teamControlDraft),
    );
    setTeamControlMessage("Team-Zuordnung im Draft angepasst. Bitte 'Lokal speichern' klicken.");
  }

  function setSoloPlayerTeam(teamId: string) {
    applyGameModeOwnershipDraft([teamId], []);
  }

  function toggleGameModeOwnershipTeam(owner: "chris" | "franky", teamId: string) {
    const limits = getGameModeOwnershipLimits(resolveGameModeFromState(gameState));
    if (owner === "chris") {
      const nextChrisTeamIds = gameModeOwnershipChrisIds.includes(teamId)
        ? gameModeOwnershipChrisIds.filter((entry) => entry !== teamId)
        : gameModeOwnershipChrisIds.length >= limits.chrisMax && limits.chrisMax === 1
          ? [teamId]
          : gameModeOwnershipChrisIds.length >= limits.chrisMax
            ? gameModeOwnershipChrisIds
            : [...gameModeOwnershipChrisIds.filter((entry) => entry !== teamId), teamId].filter(
                (entry) => !gameModeOwnershipFrankyIds.includes(entry),
              );
      applyGameModeOwnershipDraft(nextChrisTeamIds, gameModeOwnershipFrankyIds.filter((entry) => entry !== teamId));
      return;
    }

    const nextFrankyTeamIds = gameModeOwnershipFrankyIds.includes(teamId)
      ? gameModeOwnershipFrankyIds.filter((entry) => entry !== teamId)
      : gameModeOwnershipFrankyIds.length >= limits.frankyMax
        ? gameModeOwnershipFrankyIds
        : [...gameModeOwnershipFrankyIds.filter((entry) => entry !== teamId), teamId].filter(
            (entry) => !gameModeOwnershipChrisIds.includes(entry),
          );
    applyGameModeOwnershipDraft(
      gameModeOwnershipChrisIds.filter((entry) => entry !== teamId),
      nextFrankyTeamIds,
    );
  }

  function updateTeamIdentityDraft(teamId: string, updater: (current: TeamIdentity) => TeamIdentity) {
    setTeamIdentityDraft((current) => {
      const base =
        current[teamId] ??
        buildTeamIdentityDraftMap(gameState.teams, gameState.teamIdentities)[teamId];

      if (!base) {
        return current;
      }

      return {
        ...current,
        [teamId]: updater(base),
      };
    });
    setTeamIdentityMessage(null);
  }

  function selectTeamSettingsTeam(nextTeamId: string) {
    if (!nextTeamId || nextTeamId === selectedTeamId) {
      return;
    }

    if (
      selectedTeamHasUnsavedChanges &&
      typeof window !== "undefined" &&
      !window.confirm("Nicht gespeicherte Team-Settings verwerfen und zu einem anderen Team wechseln?")
    ) {
      return;
    }

    setActiveManagerTeam(nextTeamId, "manual_select");
  }

  /**
   * Room-safe path for "Lokal speichern" while an Online-Room is active: the generic whole-state
   * PUT (`/api/singleplayer-state`) is blocked with 409 `room_save_generic_write_forbidden` for
   * room saves, so this sends only the per-team identity/control-settings diffs through the new
   * scoped, room-guarded endpoints (`/api/team-settings/identity`, `/api/team-settings/control`)
   * instead of one combined whole-save write. Game-mode ownership reassignment (moving a team
   * between Chris/Franky) and team-strategy-profile edits made on this same screen are NOT sent
   * while in a Room — those remain a solo/setup-time action for now (see Phase 2 co-op report).
   */
  async function saveTeamSettingsInRoom() {
    const strategyChanged = gameState.teams.some(
      (team) =>
        JSON.stringify(teamStrategyDraft[team.teamId] ?? null) !==
        JSON.stringify(resolvedTeamStrategyProfiles[team.teamId] ?? null),
    );
    if (gameModeOwnershipDraftChanged || strategyChanged) {
      setTeamControlMessage(
        "Spielmodus-/Team-Zuordnung und Strategy-Profile können in einem laufenden Online-Room aktuell nicht gespeichert werden. Bitte nur Identity- und Admin-Settings speichern oder außerhalb des Rooms anpassen.",
      );
      return;
    }

    const changedTeamIds = new Set<string>();
    for (const team of gameState.teams) {
      const currentIdentity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      if (JSON.stringify(teamIdentityDraft[team.teamId] ?? null) !== JSON.stringify(currentIdentity)) {
        changedTeamIds.add(team.teamId);
      }
      const currentControl = resolvedTeamControlSettings[team.teamId] ?? null;
      if (JSON.stringify(teamControlDraft[team.teamId] ?? null) !== JSON.stringify(currentControl)) {
        changedTeamIds.add(team.teamId);
      }
    }

    if (changedTeamIds.size === 0) {
      setTeamIdentityMessage("Keine Änderungen zum Speichern.");
      setTeamControlMessage("Keine Änderungen zum Speichern.");
      return;
    }

    setIsSaveBusy(true);
    try {
      for (const teamId of changedTeamIds) {
        const draftIdentity = teamIdentityDraft[teamId];
        if (draftIdentity) {
          const response = await fetch("/api/team-settings/identity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(withRoomBody({ saveId: activeSaveId, teamId, identity: draftIdentity })),
          });
          const payload = await response.json().catch(() => ({}));
          if (await handleStaleRoomSaveWrite(payload)) {
            return;
          }
          if (!response.ok || !payload.success) {
            setTeamIdentityMessage(payload.error ?? "Team-Identity konnte nicht gespeichert werden.");
            return;
          }
        }

        const draftControl = teamControlDraft[teamId];
        if (draftControl) {
          const response = await fetch("/api/team-settings/control", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              withRoomBody({
                saveId: activeSaveId,
                teamId,
                control: {
                  notes: draftControl.notes,
                  strategyLock: draftControl.strategyLock,
                  displayLabel: draftControl.displayLabel,
                  aiLineupPreviewEnabled: draftControl.aiLineupPreviewEnabled,
                  aiLineupApplyEnabled: draftControl.aiLineupApplyEnabled,
                  aiLineupAutoApplyEnabled: draftControl.aiLineupAutoApplyEnabled,
                  aiTransferPreviewEnabled: draftControl.aiTransferPreviewEnabled,
                  aiTransferAutoApplyEnabled: draftControl.aiTransferAutoApplyEnabled,
                  aiSellPreviewEnabled: draftControl.aiSellPreviewEnabled,
                  aiSellAutoApplyEnabled: draftControl.aiSellAutoApplyEnabled,
                },
              }),
            ),
          });
          const payload = await response.json().catch(() => ({}));
          if (await handleStaleRoomSaveWrite(payload)) {
            return;
          }
          if (!response.ok || !payload.success) {
            setTeamControlMessage(payload.error ?? "Team-Admin-Settings konnten nicht gespeichert werden.");
            return;
          }
        }
      }

      setTeamIdentityMessage("Team-Identitäten wurden gespeichert.");
      setTeamControlMessage("Team-Admin-Settings wurden gespeichert.");
      await loadSave(activeSaveId, foundationSaveMode, { compactInitial: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Team-Settings konnten nicht gespeichert werden.";
      setTeamControlMessage(message);
    } finally {
      setIsSaveBusy(false);
    }
  }

  async function saveTeamSettings() {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    if (roomContext) {
      await saveTeamSettingsInRoom();
      return;
    }

    const identityOverrides = buildTeamIdentityOverrideMap(gameState.teams, teamIdentityDraft);
    const resolvedIdentities = buildResolvedTeamIdentities(gameState.teams, gameState.teamIdentities, identityOverrides);
    const saveMode = resolveGameModeFromState(gameState);
    const limits = getGameModeOwnershipLimits(saveMode);
    if (saveMode === "online_4v4" && (gameModeOwnershipChrisIds.length !== 4 || gameModeOwnershipFrankyIds.length !== 4)) {
      setTeamControlMessage("Online 4v4 braucht genau 4 Chris-Teams und 4 Franky-Teams.");
      return;
    }
    if (saveMode === "solo_1" && gameModeOwnershipChrisIds.length !== 1) {
      setTeamControlMessage("Solo braucht genau 1 menschliches Team.");
      return;
    }
    if (gameModeOwnershipChrisIds.length > limits.chrisMax || gameModeOwnershipFrankyIds.length > limits.frankyMax) {
      setTeamControlMessage("Zu viele Teams für den aktiven Spielmodus zugeordnet.");
      return;
    }

    const ownershipGameState = applyGameModeOwnership(gameState, {
      saveMode,
      chrisTeamIds: gameModeOwnershipChrisIds,
      frankyTeamIds: gameModeOwnershipFrankyIds,
    });
    const nextTeamControlSettings = mergeAiAutomationFromDraft(
      ownershipGameState.seasonState.teamControlSettings ?? {},
      teamControlDraft,
    );
    const nextGameState = withNormalizedLocalTeamSettings({
      ...ownershipGameState,
      teamIdentities: resolvedIdentities,
      seasonState: {
        ...ownershipGameState.seasonState,
        teamIdentityOverrides: identityOverrides,
        teamControlSettings: nextTeamControlSettings,
        teamStrategyProfiles: buildTeamStrategyProfileMap(
          gameState.teams,
          resolvedIdentities,
          teamStrategyDraft,
        ),
      },
    });

    setGameState(nextGameState);
    setIsSaveBusy(true);
    try {
      await persistLocalGameStateImmediately(nextGameState);
      hasPersistedInitialState.current = false;
      hasLoadedPersistentState.current = true;
      setTeamControlDraft(nextTeamControlSettings);
      const savedOwnership = deriveChrisFrankyTeamIdsFromSettings(nextGameState.teams, nextTeamControlSettings);
      setGameModeOwnershipChrisIds(savedOwnership.chrisTeamIds);
      setGameModeOwnershipFrankyIds(savedOwnership.frankyTeamIds);

      const nextSelectedControl = selectedTeam ? nextTeamControlSettings[selectedTeam.teamId] : null;
      if (nextSelectedControl?.controlMode === "manual" && nextSelectedControl.ownerId && nextSelectedControl.ownerId !== activeOwnerId) {
        setActiveOwnerId(nextSelectedControl.ownerId);
        persistFoundationActiveOwnerId(nextSelectedControl.ownerId);
      }

      setTeamIdentityMessage("Team-Identitäten wurden lokal gespeichert.");
      setTeamControlMessage("Team-Admin-Settings wurden lokal gespeichert.");
      setTeamStrategyMessage("Strategy Profiles wurden lokal gespeichert.");
      await loadSave(activeSaveId, foundationSaveMode, { compactInitial: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Team-Settings konnten nicht lokal gespeichert werden.";
      setTeamIdentityMessage(null);
      setTeamControlMessage(message);
      setTeamStrategyMessage(null);
    } finally {
      setIsSaveBusy(false);
    }
  }

  async function enableAiLineupApplyForAiTeams() {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    if (aiTeams.length === 0) {
      setTeamControlMessage("Es gibt aktuell keine AI-Teams zum Aktivieren.");
      return;
    }

    setTeamControlDraft((current) =>
      Object.fromEntries(
        Object.entries(current).map(([teamId, settings]) => [
          teamId,
          settings.controlMode === "ai"
            ? {
                ...settings,
                aiLineupPreviewEnabled: true,
                aiLineupApplyEnabled: true,
              }
            : settings,
        ]),
      ),
    );
    setTeamControlMessage("AI-Lineup Apply im Draft gesetzt. Bitte in Team Settings 'Lokal speichern'.");
  }

  async function enableAiMarketPreviewForAiTeams() {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    if (aiTeams.length === 0) {
      setTeamControlMessage("Es gibt aktuell keine AI-Teams für die Marktfreigabe.");
      return;
    }

    setTeamControlDraft((current) =>
      Object.fromEntries(
        Object.entries(current).map(([teamId, settings]) => [
          teamId,
          settings.controlMode === "ai"
            ? {
                ...settings,
                aiTransferPreviewEnabled: true,
                aiSellPreviewEnabled: true,
              }
            : settings,
        ]),
      ),
    );
    setTeamControlMessage("AI-Marktfreigaben im Draft gesetzt. Bitte in Team Settings 'Lokal speichern'.");
  }

  function savePlayerGeneratorDrafts(nextDrafts: PlayerGeneratorDraft[]) {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    setGameState((current) => ({
      ...current,
      seasonState: {
        ...current.seasonState,
        playerGeneratorDrafts: nextDrafts,
      },
    }));
  }

  /**
   * Player-Generator Phase 2 — "Als Free Agent übernehmen". Mirrors
   * `chooseTeamSponsor`'s fetch-then-`loadSave` pattern 1:1: POST the
   * mutation to the guarded route (which loads/writes the save directly via
   * persistence, independent of this client's in-memory `gameState`), then
   * refetch so `gameState.players` picks up the newly inserted free agent.
   * The committed draft is intentionally left in the saved-drafts list
   * (the user can delete it manually) — re-committing it is harmless, it
   * just mints another free agent with a fresh id rather than erroring.
   */
  async function commitPlayerGeneratorDraft(
    draft: PlayerGeneratorDraft,
  ): Promise<{ success: boolean; error?: string; playerId?: string; playerName?: string }> {
    if (readMeta.readOnly || readMeta.source === "prisma") {
      showReadOnlyNotice();
      return { success: false, error: "read_only" };
    }
    try {
      const response = await fetch("/api/player-generator/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          saveId: activeSaveId,
          draft,
          dryRun: false,
          source: readMeta.source,
        })),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        summary?: { playerId?: string; playerName?: string } | null;
      };
      if (!response.ok || !payload.success) {
        return { success: false, error: payload.error ?? "player_generator_commit_failed" };
      }
      await loadSave(activeSaveId);
      return {
        success: true,
        playerId: payload.summary?.playerId,
        playerName: payload.summary?.playerName ?? draft.generated.name,
      };
    } catch {
      return { success: false, error: "player_generator_commit_failed" };
    }
  }

  function saveContractNegotiationDrafts(nextDrafts: ContractNegotiationDraft[]) {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }
    if (!selectedTeamCanManage) {
      showTeamManagementLockedNotice();
      return;
    }

    setGameState((current) => ({
      ...current,
      seasonState: {
        ...current.seasonState,
        contractNegotiationDrafts: nextDrafts,
      },
    }));
  }

  function saveTransferWishlist(nextEntries: TransferWishlistEntry[]) {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    const teamId = marketTeamId || selectedTeam?.teamId || null;
    setGameState((current) => {
      let next: GameState = {
        ...current,
        seasonState: {
          ...current.seasonState,
          transferWishlist: nextEntries,
        },
      };
      if (teamId) {
        next = syncWishlistToScoutingWatchlist(next, teamId);
      }
      return next;
    });
  }

  function showScoutingWishlistSlotNotice(teamId: string, playerId?: string | null) {
    const message = getScoutingWishlistSlotMessage(canAddPlayerToTransferWishlist(gameState, teamId, playerId));
    if (message) {
      setFoundationActionFeedback({
        tone: "warning",
        title: "Wunschliste voll",
        detail: message,
      });
    }
  }

  function saveTransferSellMarkers(nextEntries: TransferSellMarkerEntry[]) {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }
    if (!selectedTeamCanManage) {
      showTeamManagementLockedNotice();
      return;
    }

    setGameState((current) => ({
      ...current,
      seasonState: {
        ...current.seasonState,
        transferSellMarkers: nextEntries,
      },
    }));
  }

  function buildWishlistEntry(item: TransfermarktFreeAgentItem): TransferWishlistEntry {
    return {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `wishlist-${item.playerId}-${Date.now()}`,
      saveId: activeSaveId,
      seasonId: gameState.season.id,
      playerId: item.playerId,
      playerName: item.name,
      className: item.className,
      race: item.race,
      marketValue: item.marketValue ?? null,
      salary: item.salary ?? null,
      bracket: item.bracket ?? null,
      pow: item.pow ?? null,
      spe: item.spe ?? null,
      men: item.men ?? null,
      soc: item.soc ?? null,
      teamId: marketTeamId || null,
      createdAt: new Date().toISOString(),
      priorityRank: marketTeamId ? getNextWishlistPriorityRank(gameState, marketTeamId) : null,
    };
  }

  function toggleTransferWishlist(item: TransfermarktFreeAgentItem) {
    const teamId = marketTeamId || selectedTeam?.teamId || null;
    const currentEntries = gameState.seasonState.transferWishlist ?? [];
    const existing = currentEntries.find((entry) => entry.playerId === item.playerId);
    if (existing) {
      saveTransferWishlist(currentEntries.filter((entry) => entry.playerId !== item.playerId));
      return;
    }
    if (!teamId) {
      return;
    }
    const slotCheck = canAddPlayerToTransferWishlist(gameState, teamId, item.playerId);
    if (!slotCheck.ok) {
      showScoutingWishlistSlotNotice(teamId, item.playerId);
      return;
    }

    saveTransferWishlist([buildWishlistEntry(item), ...currentEntries]);
  }

  function removeTransferWishlistEntry(playerId: string) {
    saveTransferWishlist((gameState.seasonState.transferWishlist ?? []).filter((entry) => entry.playerId !== playerId));
  }

  function reorderTransferWishlist(playerId: string, targetIndex: number) {
    const teamId = marketTeamId || selectedTeam?.teamId || null;
    if (!teamId) {
      return;
    }
    saveTransferWishlist(
      reorderTeamTransferWishlist(gameState.seasonState.transferWishlist ?? [], teamId, playerId, targetIndex),
    );
  }

  function toggleScoutingWatch(item: TransfermarktFreeAgentItem) {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }
    if (!selectedTeamCanManage || !activeManagerTeamId) {
      showTeamManagementLockedNotice();
      return;
    }

    const teamId = activeManagerTeamId;
    const watched = getScoutingWatchlistForTeam(gameState, teamId).some((entry) => entry.playerId === item.playerId);
    setGameState((current) =>
      watched
        ? removeScoutingWatchlistEntry({ gameState: current, teamId, playerId: item.playerId })
        : addScoutingWatchlistEntry({ gameState: current, teamId, playerId: item.playerId }),
    );
  }

  function toggleTransferSellMarker(input: {
    teamId: string;
    playerId: string;
    playerName: string;
    contractLength: number;
    buyoutCost: number | null;
    marketValueAtExit: number | null;
    morale: number | null;
  }) {
    const currentEntries = gameState.seasonState.transferSellMarkers ?? [];
    const existing = currentEntries.find((entry) => entry.teamId === input.teamId && entry.playerId === input.playerId);
    if (existing) {
      saveTransferSellMarkers(
        currentEntries.filter((entry) => !(entry.teamId === input.teamId && entry.playerId === input.playerId)),
      );
      return;
    }

    const nextEntry: TransferSellMarkerEntry = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `sell-marker-${input.teamId}-${input.playerId}-${Date.now()}`,
      saveId: activeSaveId,
      seasonId: gameState.season.id,
      teamId: input.teamId,
      playerId: input.playerId,
      playerName: input.playerName,
      contractLength: input.contractLength,
      buyoutCost: input.buyoutCost,
      marketValueAtExit: input.marketValueAtExit,
      morale: input.morale,
      createdAt: new Date().toISOString(),
    };

    saveTransferSellMarkers([nextEntry, ...currentEntries]);
  }

  function updateTeamStrategyDraft(teamId: string, updater: (current: TeamStrategyProfile) => TeamStrategyProfile) {
    setTeamStrategyDraft((current) => {
      const base =
        current[teamId] ??
        buildTeamStrategyProfileMap(gameState.teams, gameState.teamIdentities, gameState.seasonState.teamStrategyProfiles)[teamId];

      if (!base) {
        return current;
      }

      return {
        ...current,
        [teamId]: updater(base),
      };
    });
    setTeamStrategyMessage(null);
  }

  async function openPlayerProfileById(
    playerId: string,
    activePlayerId?: string | null,
    options?: { quickPeek?: boolean; tab?: PlayerProfileTabId; push?: boolean },
  ) {
    setSeasonBriefingOpen(false);
    setFoundationPanel((current) => (current === "briefing" ? null : current));
    const hydrationSuccessKey = buildPlayerProfileHydrationSuccessKey(gameState.season.id, playerId);
    const hydrationRequestId = ++playerProfileHydrationSequenceRef.current;
    playerProfileHydrationAttemptRef.current = buildPlayerProfileHydrationLoadingKey(gameState.season.id, playerId);
    if (playerProfileData?.playerId !== playerId) {
      setPlayerProfileData(null);
    }
    setPlayerProfileLoading(true);
    setPlayerProfileTab(options?.tab ?? "overview");
    setActiveView("playerProfile");
    syncFoundationViewInUrl("playerProfile", options?.tab ?? "overview", playerId, {
      push: options?.push ?? false,
      team: selectedTeamId,
    });
    try {
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => resolve());
          return;
        }
        resolve();
      });
      const [{ buildPlayerDrawerDataFromGameState }, { hydrateGameStatePlayerAttributeSheet }] = await Promise.all([
        import("@/lib/foundation/player-detail-drawer"),
        import("@/lib/foundation/hydrate-player-attribute-sheet"),
      ]);
      const hydratedGameState = await hydrateGameStatePlayerAttributeSheet({
        gameState: gameStateRef.current,
        saveId: activeSaveId,
        playerId,
      });
      const nextData = buildPlayerDrawerDataFromGameState({
        gameState: hydratedGameState,
        playerId,
        activePlayerId,
        source: readMeta.source,
        manageableTeamIds: foundationManageableTeamIds,
        saveId: activeSaveId,
      });

      if (!nextData) {
        if (hydrationRequestId !== playerProfileHydrationSequenceRef.current) {
          return;
        }
        setPlayerProfileData(null);
        playerProfileHydrationAttemptRef.current = buildPlayerProfileHydrationFailureKey(
          gameState.season.id,
          playerId,
          gameState.players.length,
        );
        return;
      }

      if (hydrationRequestId !== playerProfileHydrationSequenceRef.current) {
        return;
      }

      playerProfileHydrationAttemptRef.current = hydrationSuccessKey;
      setPlayerProfileData(nextData);
    } catch (error) {
      if (hydrationRequestId !== playerProfileHydrationSequenceRef.current) {
        return;
      }
      console.warn("Player profile hydration failed.", error);
      setPlayerProfileData(null);
      playerProfileHydrationAttemptRef.current = buildPlayerProfileHydrationFailureKey(
        gameState.season.id,
        playerId,
        gameState.players.length,
      );
    } finally {
      if (hydrationRequestId === playerProfileHydrationSequenceRef.current) {
        setPlayerProfileLoading(false);
      }
    }
  }

  async function openPlayerDrawerById(playerId: string, activePlayerId?: string | null) {
    await openPlayerProfileById(playerId, activePlayerId, { push: true });
  }

  function navigateHomeTab(tab: "overview" | "office") {
    setHomeV2Tab(tab);
    setFoundationView("homeV2", setActiveView);
    syncFoundationViewInUrl("homeV2", tab === "office" ? "office" : null);
    scrollToFoundationTarget(tab === "office" ? "foundation-hq" : "foundation-home-v2");
  }

  function navigatePrizeFinanceTab(tab: "sponsors" | "prize") {
    setPrizeFinanceTab(tab);
    setFoundationView("prize", setActiveView);
    syncFoundationViewInUrl("prize", tab === "prize" ? "preisgeld" : "sponsors");
    scrollToFoundationTarget(tab === "prize" ? "prize-money" : "sponsor-choice");
  }

  function resolvePrizeFinanceTabFromPanel(panel?: string | null): "sponsors" | "prize" {
    if (panel === "sponsor-choice" || panel === "sponsors" || panel === "sponsor") {
      return "sponsors";
    }
    return "prize";
  }

  function navigateToPrizeFinanceViewFromRouting(panel?: string | null, push = false) {
    openPrizeFinanceView({ tab: resolvePrizeFinanceTabFromPanel(panel), push });
  }

  function openPrizeFinanceView(options?: { tab?: "sponsors" | "prize"; push?: boolean }) {
    const urlTab = typeof window !== "undefined" ? parseFoundationTabFromUrl() : null;
    const needsSponsorChoice = Boolean(selectedTeam && selectedTeamCanManage && !selectedTeamSponsorContract);
    const nextTab =
      options?.tab ??
      (urlTab === "preisgeld" || urlTab === "prize"
        ? "prize"
        : urlTab === "sponsors" || urlTab === "sponsor"
          ? "sponsors"
          : needsSponsorChoice
            ? "sponsors"
            : "prize");
    setPrizeFinanceTab(nextTab);
    setFoundationView("prize", setActiveView, { push: options?.push ?? true });
    syncFoundationViewInUrl("prize", nextTab === "prize" ? "preisgeld" : "sponsors");
    scrollToFoundationTarget(nextTab === "prize" ? "prize-money" : "sponsor-choice");
  }

  function openTrainingPlayerTarget(playerId: string, target: "training" | "upgrade" = "training") {
    setFoundationView("trainingCompact", setActiveView);
    scrollToFoundationTarget(target === "upgrade" ? `training-upgrade-player-${playerId}` : `training-player-${playerId}`);
  }

  function onOpenLeagueLeaders(
    categoryId: LeagueLeaderCategoryId,
    returnContext?: { playerId: string; playerName: string },
  ) {
    setLeagueLeadersReturnContext(returnContext ?? null);
    // Rangliste wird i. d. R. aus einem Spieler-Profil heraus geöffnet (returnContext
    // gesetzt) — ein History-Eintrag wird gepusht, damit Zurück (Browser-Back oder der
    // "Zurück zu {Spieler}"-Link) verlässlich zum Herkunfts-Profil zurückführt.
    setFoundationView("leagueLeaders", setActiveView, { push: true });
    scrollToFoundationTarget(`league-leaders-${categoryId}`);
  }

  function openTeamProfileById(teamId: string) {
    if (!gameState.teams.some((team) => team.teamId === teamId)) {
      return;
    }

    clearPendingTeamActivation();
    setTeamProfileTeamId(teamId);
    syncFoundationTeamIdInUrl(teamId);
    setActiveView("teamProfile");
    syncFoundationUrlState({
      view: "teamProfile",
      tab: null,
      playerId: null,
      team: teamId,
      panel: null,
      facilityId: null,
      facilityAction: null,
      saveId: parseFoundationSaveIdFromUrl(),
    }, { mode: "push" });
  }

  function openTeamDrawerById(teamId: string) {
    openTeamProfileById(teamId);
  }

  function closeTeamProfile() {
    setTeamProfileTeamId(null);
    // Zurück soll auf den Herkunfts-Tab führen (z. B. Saisonstand), von dem das
    // Team-Profil geöffnet wurde — nicht pauschal auf „Teams". Das Öffnen pusht
    // einen History-Eintrag (openTeamProfileById, mode: "push"), also bringt uns
    // der Browser-Back verlässlich dorthin zurück. Nur ohne History fällt es auf
    // die Teams-Übersicht zurück.
    if (canFoundationNavigateBack()) {
      foundationNavigateBack();
      return;
    }
    setFoundationView("teams", setActiveView);
    syncFoundationViewInUrl("teams");
  }

  function resolveSellSubjectFromPlayerId(playerId: string, teamId: string): TransfermarktSellPreviewSubject | null {
    const player = gameState.players.find((entry) => entry.id === playerId);
    if (!player) {
      return null;
    }

    const activeEntry = gameState.rosters.find(
      (entry) => entry.playerId === playerId && entry.teamId === teamId,
    );
    if (!activeEntry) {
      return null;
    }

    return {
      activePlayerId: activeEntry.id,
      playerId: player.id,
      playerName: player.name,
      className: player.className,
      race: player.race,
      portraitUrl: player.portraitUrl ?? null,
    };
  }

  function applyFoundationNavigationState(state: FoundationUrlState) {
    const resolvedPanel =
      state.view === "playerProfile" && state.panel === "briefing" ? null : (state.panel ?? null);
    setFoundationPanel(resolvedPanel);
    if (state.playerId) {
      setMarketFocusPlayerId(state.playerId);
    }
    if (state.facilityId) {
      setFoundationFacilityTarget({
        facilityId: state.facilityId,
        action: state.facilityAction ?? "upgrade",
      });
    } else {
      setFoundationFacilityTarget(null);
    }
    if (state.view === "teamProfile" && state.team) {
      setTeamProfileTeamId(state.team);
    }
    if (state.panel === "briefing" && state.view !== "playerProfile" && !shouldSuppressSeasonBriefingReopen()) {
      openSeasonBriefingPanel({ push: false });
    } else {
      setSeasonBriefingOpen(false);
      if (state.panel === "briefing") {
        setFoundationPanel(null);
      }
    }
    if (state.panel === "sell" && state.playerId && state.team) {
      const sellSubject = resolveSellSubjectFromPlayerId(state.playerId, state.team);
      if (sellSubject) {
        setMarketSellSubject(sellSubject);
        void requestTransfermarktSellPreview(sellSubject, state.team);
      }
    } else if (state.panel !== "sell") {
      setMarketSellSubject(null);
    setMarketSellRiskAcknowledged(false);
    }
    if (state.view === "playerProfile" && state.playerId) {
      setActiveView("playerProfile");
      if (playerProfileData?.playerId !== state.playerId) {
        setPlayerProfileData(null);
      }
      setPlayerProfileLoading(true);
      void openPlayerProfileById(state.playerId, null, {
        tab: (state.tab as PlayerProfileTabId | null) ?? "overview",
      });
    } else if (state.view === "playerProfile") {
      playerProfileHydrationSequenceRef.current += 1;
      setPlayerProfileData(null);
      setActiveView(state.team ? "teams" : "homeV2");
    } else {
      playerProfileHydrationSequenceRef.current += 1;
      setActiveView(state.view as FoundationView);
      setPlayerProfileData(null);
    }
    if (state.view !== "teamProfile") {
      setTeamProfileTeamId(null);
    }
    if (state.panel === "offer" && state.playerId) {
      setMarketFocusPlayerId(state.playerId);
    }
  }

  const applyFoundationNavigationStateRef = useRef(applyFoundationNavigationState);
  applyFoundationNavigationStateRef.current = applyFoundationNavigationState;

  function openMarketOfferPanel(playerId: string) {
    setFoundationPanel("offer");
    setMarketFocusPlayerId(playerId);
    setFoundationView("marketV2", setActiveView);
    syncFoundationViewInUrl("marketV2", null, playerId, {
      panel: "offer",
      push: true,
      team: selectedTeamId,
    });
  }

  function closeFoundationDrilldownPanel() {
    if (seasonBriefingOpen || foundationPanel === "briefing") {
      closeSeasonBriefing(false);
      return;
    }

    if (canFoundationNavigateBack()) {
      foundationNavigateBack();
      return;
    }

    setFoundationPanel(null);
    setSeasonBriefingOpen(false);
    setMarketSellSubject(null);
    setMarketSellRiskAcknowledged(false);
    setFoundationFacilityTarget(null);

    if (activeView === "playerProfile") {
      playerProfileHydrationSequenceRef.current += 1;
      setPlayerProfileData(null);
      setFoundationView("homeV2", setActiveView);
      syncFoundationViewInUrl("homeV2", null, null, { team: selectedTeamId });
      return;
    }

    if (activeView === "teamProfile") {
      closeTeamProfile();
    }
  }

  function openSeasonBriefingPanel(options?: { push?: boolean }) {
    if (shouldSuppressSeasonBriefingReopen()) {
      setSeasonBriefingOpen(false);
      setFoundationPanel((current) => (current === "briefing" ? null : current));
      clearSeasonBriefingFromUrl();
      return;
    }

    if (activeView !== "homeV2" && activeView !== "home") {
      setFoundationView("homeV2", setActiveView);
    }

    setSeasonBriefingOpen(true);
    setFoundationPanel("briefing");
    syncFoundationViewInUrl("homeV2", null, null, {
      panel: "briefing",
      push: options?.push ?? true,
      team: selectedTeamId,
    });
  }

  function shouldSuppressSeasonBriefingReopen() {
    // Startbildschirm-"Neues Spiel": Solange die beim Mount festgehaltene New-Game-
    // Absicht gilt UND noch der Bestands-Save aktiv ist (Baseline noch nicht bekannt
    // oder unverändert), bleibt der Season-Einstieg des ALTEN Saves unterdrückt —
    // sonst würde der Assistent (Team-Settings → Saves) sofort von der Vorschau des
    // Bestandsspiels überdeckt. Sobald ein neuer Save aktiv ist, endet die
    // Unterdrückung und der Season-Einstieg des NEUEN Spiels läuft ganz normal.
    if (
      newGameIntentRef.current &&
      (newGameIntentBaselineSaveIdRef.current === null ||
        activeSaveId === newGameIntentBaselineSaveIdRef.current)
    ) {
      return true;
    }
    const briefingKey = buildSeasonBriefingDismissKey(activeSaveId, gameState.season.id);
    const seasonIntroStep = gameState.seasonState.newGameFlow?.steps?.find((step) => step.stepId === "season_intro");
    return (
      seasonBriefingDismissedRef.current.has(briefingKey) ||
      readSeasonBriefingDismissedFromStorage(activeSaveId, gameState.season.id) ||
      seasonIntroStep?.status === "completed" ||
      seasonIntroStep?.status === "skipped" ||
      !shouldAutoOpenSeasonBriefing(gameState, seasonIntroStep?.status ?? seasonBriefingStepStatus)
    );
  }

  function clearSeasonBriefingFromUrl() {
    const tab =
      activeView === "homeV2" && homeV2Tab === "office"
        ? "office"
        : activeView === "playerProfile"
          ? playerProfileTab
          : null;
    syncFoundationViewInUrl(activeView, tab, playerProfileData?.playerId ?? null, {
      panel: null,
      push: false,
      team: selectedTeamId,
    });
  }

  function openFacilityPanel(facilityId: string, action: "upgrade" | "downgrade" | "maintenance") {
    setFoundationFacilityTarget({ facilityId, action });
    setFoundationPanel("facility");
    const facilityView = activeView === "facilitiesOverviewV2" ? "facilitiesOverviewV2" : "trainingV2";
    if (activeView !== facilityView) {
      setFoundationView(facilityView, setActiveView);
    }
    syncFoundationViewInUrl(facilityView, null, null, {
      panel: "facility",
      facilityId,
      facilityAction: action,
      push: true,
      team: selectedTeamId,
    });
  }

  function closeFacilityPanel() {
    closeFoundationDrilldownPanel();
  }

  function exportSelectedTeamSettingsJson() {
    if (!selectedTeam || !selectedIdentityDraft || !selectedTeamStrategyDraft) {
      return;
    }

    const payload = {
      teamId: selectedTeam.teamId,
      teamCode: selectedTeam.shortCode,
      teamName: selectedTeam.name,
      readSource: readMeta.source,
      activeSaveId,
      identity: selectedIdentityDraft,
      identityOverride: gameState.seasonState.teamIdentityOverrides?.[selectedTeam.teamId] ?? null,
      controlSettings: teamControlDraft[selectedTeam.teamId] ?? resolvedTeamControlSettings[selectedTeam.teamId] ?? null,
      strategyProfile: selectedTeamStrategyDraft,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedTeam.teamId.toLowerCase()}-team-settings.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openPlayerDrawerBuyPreview(player: {
    playerId: string;
    name: string;
    className: string | null;
    race: string | null;
  }) {
    if (activeView !== "marketV2") {
      setFoundationView("marketV2", setActiveView);
    }
    openMarketOfferPanel(player.playerId);
  }

  function persistContractNegotiationDraftFromSummary(summary: TransfermarktBuySummary | null) {
    if (readMeta.readOnly || !summary?.player?.id || !summary.team?.id) {
      return;
    }

    const draft = buildContractNegotiationDraft({
      saveId: activeSaveId,
      seasonId: gameState.season.id,
      teamId: summary.team.id,
      playerId: summary.player.id,
      playerName: summary.player.name,
      preview: {
        expectedSalary: summary.expectedSalary ?? null,
        baseExpectedSalary: summary.baseExpectedSalary ?? null,
        demandMultiplier: summary.demandMultiplier ?? null,
        offeredSalary: summary.offeredSalary ?? null,
        offerRatio: summary.offerRatio ?? null,
        contractLength: summary.contractLength,
        contractShape: summary.contractShape ?? "balanced",
        yearlySalarySchedule: summary.yearlySalarySchedule ?? [],
        totalSalary: summary.totalSalary ?? null,
        roundingAdjustment: summary.roundingAdjustment ?? null,
        buyoutCost: summary.buyoutCost ?? null,
        bracket: summary.bracket ?? null,
        teamFit: summary.teamFit ?? null,
        acceptanceScore: summary.acceptanceScore ?? null,
        acceptChance: summary.acceptChance ?? null,
        counterChance: summary.counterChance ?? null,
        rejectChance: summary.rejectChance ?? null,
        demandBreakdown: summary.demandBreakdown ?? [],
        scoreBreakdown: summary.negotiationScoreBreakdown ?? [],
        reasons: summary.negotiationReasons ?? [],
        warnings: summary.negotiationWarnings ?? [],
        blockingReasons: summary.negotiationBlockingReasons ?? [],
        status:
          summary.negotiationBlockingReasons && summary.negotiationBlockingReasons.length > 0
            ? "blocked_missing_salary_source"
            : "ready_for_review",
      },
    });

    const currentDrafts = gameState.seasonState.contractNegotiationDrafts ?? [];
    const nextDrafts = [
      draft,
      ...currentDrafts.filter((entry) => entry.draftId !== draft.draftId),
    ];
    saveContractNegotiationDrafts(nextDrafts);
  }

  function persistContractNegotiationOutcome(summary: TransfermarktBuySummary | null, status: ContractNegotiationDraft["status"], extraWarnings: string[] = []) {
    if (readMeta.readOnly || !summary?.player?.id || !summary.team?.id) {
      return;
    }

    const draft = buildContractNegotiationDraft({
      saveId: activeSaveId,
      seasonId: gameState.season.id,
      teamId: summary.team.id,
      playerId: summary.player.id,
      playerName: summary.player.name,
      preview: {
        expectedSalary: summary.expectedSalary ?? null,
        baseExpectedSalary: summary.baseExpectedSalary ?? null,
        demandMultiplier: summary.demandMultiplier ?? null,
        offeredSalary: summary.offeredSalary ?? null,
        offerRatio: summary.offerRatio ?? null,
        contractLength: summary.contractLength,
        contractShape: summary.contractShape ?? "balanced",
        yearlySalarySchedule: summary.yearlySalarySchedule ?? [],
        totalSalary: summary.totalSalary ?? null,
        roundingAdjustment: summary.roundingAdjustment ?? null,
        buyoutCost: summary.buyoutCost ?? null,
        bracket: summary.bracket ?? null,
        teamFit: summary.teamFit ?? null,
        acceptanceScore: summary.acceptanceScore ?? null,
        acceptChance: summary.acceptChance ?? null,
        counterChance: summary.counterChance ?? null,
        rejectChance: summary.rejectChance ?? null,
        demandBreakdown: summary.demandBreakdown ?? [],
        scoreBreakdown: summary.negotiationScoreBreakdown ?? [],
        reasons: summary.negotiationReasons ?? [],
        warnings: [...(summary.negotiationWarnings ?? []), ...extraWarnings],
        blockingReasons: summary.negotiationBlockingReasons ?? [],
        status,
      },
    });

    const currentDrafts = gameState.seasonState.contractNegotiationDrafts ?? [];
    const nextDrafts = [
      draft,
      ...currentDrafts.filter((entry) => entry.draftId !== draft.draftId),
    ];
    const nextGameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        contractNegotiationDrafts: nextDrafts,
      },
    };
    setGameState(nextGameState);
    void persistLocalGameStateImmediately(nextGameState).catch((error) => {
      console.warn("Contract negotiation draft persist failed.", error);
    });
  }

  async function negotiateTransfermarktBuy() {
    if (!marketBuyPreview?.player?.id || !marketBuyPreview.team?.id || marketBuyBusy) {
      return;
    }

    const acceptChance = marketBuyPreview.acceptChance ?? 0;
    const counterChance = marketBuyPreview.counterChance ?? 0;
    const rejectChance = marketBuyPreview.rejectChance ?? 0;
    const expectedSalary = marketBuyPreview.expectedSalary ?? marketBuyPreview.salary ?? null;
    const offeredSalary = marketOfferedSalaryDraft ?? marketBuyPreview.offeredSalary ?? expectedSalary;

    if (rejectChance >= acceptChance && rejectChance >= counterChance) {
      persistContractNegotiationOutcome(marketBuyPreview, "rejected_bad_experience", ["negotiation_rejected_bad_experience"]);
      setMarketNegotiationOutcome({
        status: "rejected",
        tone: "error",
        title: "Angebot abgelehnt",
        message: `${marketBuyPreview.player.name} bricht die Verhandlung mit ${marketBuyPreview.team.shortCode} ab. Dieses Team-Spieler-Paar bekommt für künftige Angebote einen Vertrauensmalus.`,
      });
      window.requestAnimationFrame(() => {
      });
      return;
    }

    if (counterChance > acceptChance) {
      const counterSalary =
        expectedSalary != null
          ? Number(Math.max(expectedSalary * 1.04, (offeredSalary ?? expectedSalary) * 1.08).toFixed(2))
          : offeredSalary ?? null;
      persistContractNegotiationOutcome(marketBuyPreview, "countered");
      setMarketOfferedSalaryDraft(counterSalary);
      if (marketBuySubject && counterSalary != null) {
        await requestTransfermarktBuyPreview(marketBuySubject, marketBuyPreview.team.id, {
          contractLength: marketContractLengthDraft,
          contractShape: marketContractShapeDraft,
          offeredSalary: counterSalary,
        });
      }
      setMarketNegotiationOutcome({
        status: "countered",
        tone: "warning",
        title: "Gegenseite verhandelt nach",
        message: `${marketBuyPreview.player.name} will weiterreden, erwartet aber eher ${counterSalary != null ? formatDisplayMoney(counterSalary) : "—"} pro Season. Das Angebot wurde angepasst und kann erneut verhandelt werden.`,
        counterSalary,
      });
      window.requestAnimationFrame(() => {
      });
      return;
    }

    persistContractNegotiationOutcome(marketBuyPreview, "accepted_pending_confirm");
    setMarketNegotiationOutcome({
      status: "accepted",
      tone: "success",
      title: "Angebot angenommen",
      message: `${marketBuyPreview.player.name} akzeptiert: Ablöse ${formatTransfermarktCurrency(marketBuyPreview.purchasePrice)}, Vertrag ${marketBuyPreview.contractLength} Season(s), Gehalt gesamt ${marketBuyPreview.totalSalary != null ? formatDisplayMoney(marketBuyPreview.totalSalary) : "—"}, Cash danach ${formatTransfermarktCurrency(marketBuyPreview.cashAfter)}.`,
    });
    window.requestAnimationFrame(() => {
    });
  }

  function resolveMarketBuyTeamId(teamIdOverride?: string | null) {
    return teamIdOverride ?? marketTeamId ?? selectedTeamId ?? activeManagerTeamId ?? "";
  }

  async function openMarketBuyModal(item: TransfermarktBuyPreviewSubject, teamIdOverride?: string) {
    const effectiveTeamId = resolveMarketBuyTeamId(teamIdOverride);
    if (!canManageTeamId(effectiveTeamId)) {
      setMarketBuyError(`${getTeamLockedName(effectiveTeamId)} gehört nicht zu deinen steuerbaren Teams. Kaufen ist gesperrt.`);
      showTeamManagementLockedNotice(getTeamLockedName(effectiveTeamId));
      return;
    }

    if (effectiveTeamId) {
      setMarketTeamId(effectiveTeamId);
      if (effectiveTeamId !== selectedTeamId) {
        setSelectedTeamId(effectiveTeamId);
        syncFoundationTeamIdInUrl(effectiveTeamId);
      }
    }

    if (activeView !== "marketV2") {
      setFoundationView("marketV2", setActiveView);
    }

    setMarketFocusPlayerId(item.playerId);
    openMarketOfferPanel(item.playerId);
  }

  function resetMarketBuyDemandFrame() {
    if (!marketBuySubject) {
      return;
    }
    setMarketContractLengthDraft(null);
    setMarketContractShapeDraft(null);
    setMarketOfferedSalaryDraft(null);
    setMarketNegotiationOutcome(null);
    void requestTransfermarktBuyPreview(marketBuySubject, resolveMarketBuyTeamId(marketBuyPreview?.team?.id), {
      contractLength: null,
      contractShape: null,
      offeredSalary: null,
    });
  }

  async function requestTransfermarktSellPreview(subject: TransfermarktSellPreviewSubject, teamIdOverride?: string) {
    const requestVersion = ++marketSellPreviewRequestVersion.current;
    const effectiveTeamId = teamIdOverride ?? selectedTeam?.teamId ?? "";

    if (readMeta.source === "prisma") {
      if (requestVersion !== marketSellPreviewRequestVersion.current) {
        return;
      }
      setMarketSellError("Prisma-Referenz ist read-only. Für Verkäufe bitte lokalen Testspielstand nutzen.");
      setMarketSellPreview(null);
      return;
    }

    if (!canManageTeamId(effectiveTeamId)) {
      if (requestVersion !== marketSellPreviewRequestVersion.current) {
        return;
      }
      setMarketSellError(`${getTeamLockedName(effectiveTeamId)} gehört nicht zu deinen steuerbaren Teams. Verkaufen ist gesperrt.`);
      setMarketSellPreview(null);
      return;
    }

    if (!effectiveTeamId) {
      if (requestVersion !== marketSellPreviewRequestVersion.current) {
        return;
      }
      setMarketSellError("Bitte zuerst ein Team im Kaderbereich wählen.");
      setMarketSellPreview(null);
      return;
    }

    setMarketSellBusy(true);
    setMarketSellError(null);
    setMarketSellSuccess(null);
    setMarketSellPreview(null);

    try {
      const response = await fetch("/api/transfermarkt/sell", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(withRoomBody({
          saveId: activeSaveId,
          seasonId: gameState.season.id,
          teamId: effectiveTeamId,
          activePlayerId: subject.activePlayerId,
          dryRun: true,
          source: readMeta.source,
        })),
      });
      const payload = (await response.json()) as TransfermarktSellApiResponse;
      if (requestVersion !== marketSellPreviewRequestVersion.current) {
        return;
      }
      if (payload.summary) {
        setMarketSellPreview(payload.summary);
      } else {
        setMarketSellPreview(null);
      }
      if (payload.error) {
        setMarketSellError(payload.error);
        return;
      }
      if (!payload.summary) {
        setMarketSellError("Verkaufsvorschau konnte nicht geladen werden.");
      }
    } catch {
      if (requestVersion === marketSellPreviewRequestVersion.current) {
        setMarketSellError("Verkaufsvorschau konnte nicht geladen werden.");
        setMarketSellPreview(null);
      }
    } finally {
      if (requestVersion === marketSellPreviewRequestVersion.current) {
        setMarketSellBusy(false);
      }
    }
  }

  async function openMarketSellModal(subject: TransfermarktSellPreviewSubject, teamIdOverride?: string) {
    const effectiveTeamId = teamIdOverride ?? selectedTeam?.teamId ?? "";
    if (!canManageTeamId(effectiveTeamId)) {
      setMarketSellError(`${getTeamLockedName(effectiveTeamId)} gehört nicht zu deinen steuerbaren Teams. Verkaufen ist gesperrt.`);
      showTeamManagementLockedNotice(getTeamLockedName(effectiveTeamId));
      return;
    }
    setMarketSellError(null);
    setMarketSellSuccess(null);
    setMarketSellPreview(null);
    setMarketSellSubject(subject);
    setFoundationPanel("sell");
    syncFoundationViewInUrl(activeView, null, subject.playerId, {
      panel: "sell",
      push: true,
      team: effectiveTeamId,
    });
    await requestTransfermarktSellPreview(subject, teamIdOverride);
  }

  function closeMarketSellModal() {
    marketSellPreviewRequestVersion.current += 1;
    closeFoundationDrilldownPanel();
  }

  async function confirmTransfermarktSell() {
    if (readMeta.source === "prisma") {
      setMarketSellError("Prisma-Referenz ist read-only. Für Verkäufe bitte lokalen Testspielstand nutzen.");
      return;
    }

    if (!marketSellPreview?.activePlayer?.id || !marketSellPreview.team?.id) {
      return;
    }
    if (!canManageTeamId(marketSellPreview.team.id)) {
      setMarketSellError(`${getTeamLockedName(marketSellPreview.team.id)} gehört nicht zu deinen steuerbaren Teams. Verkaufen ist gesperrt.`);
      showTeamManagementLockedNotice(getTeamLockedName(marketSellPreview.team.id));
      return;
    }

    setMarketSellBusy(true);
    setMarketSellError(null);
    setMarketSellSuccess(null);

    try {
      const response = await fetch("/api/transfermarkt/sell", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(withRoomBody({
          saveId: activeSaveId,
          seasonId: gameState.season.id,
          teamId: marketSellPreview.team.id,
          activePlayerId: marketSellPreview.activePlayer.id,
          dryRun: false,
          source: readMeta.source,
        })),
      });
      const payload = (await response.json()) as TransfermarktSellApiResponse;
      if (await handleStaleRoomSaveWrite(payload)) {
        return;
      }
      if (payload.summary) {
        setMarketSellPreview(payload.summary);
      }
      if (!response.ok || payload.error || !payload.summary || !payload.summary.canSell) {
        setMarketSellError(
          payload.error ??
            payload.summary?.blockingReasons?.[0] ??
            "Verkauf konnte nicht bestätigt werden.",
        );
        return;
      }

      const sellFeedback = `${payload.summary.player?.name ?? "Spieler"} verkauft: Cash ${formatTransfermarktCurrency(
        payload.summary.cashBefore,
      )} → ${formatTransfermarktCurrency(payload.summary.cashAfter)} · Gehalt ${formatTransfermarktCurrency(
        payload.summary.teamSalaryBefore,
      )} → ${formatTransfermarktCurrency(payload.summary.teamSalaryAfter)} · Kader ${payload.summary.rosterBefore ?? "—"} → ${
        payload.summary.rosterAfter ?? "—"
      }.`;
      setMarketSellSuccess(sellFeedback);
      setFoundationActionFeedback({
        tone: "success",
        title: "Verkauf abgeschlossen",
        detail: sellFeedback,
      });
      setMarketSellSubject(null);
    setMarketSellRiskAcknowledged(false);
      setFoundationPanel(null);
      await Promise.all([
        loadSave(activeSaveId),
        reloadMarketFeed(marketTeamId),
        reloadHistoryFeed(),
        reloadTransferRecapFeed(),
        reloadSeasonStandingsOverview(),
        reloadSeasonManagementOverview(),
      ]);
      setMarketReloadToken((current) => current + 1);
    } catch {
      setMarketSellError("Verkauf konnte nicht bestätigt werden.");
    } finally {
      setMarketSellBusy(false);
    }
  }

  const reloadAfterMarketRosterApply = useCallback(async () => {
    await Promise.all([
      loadSave(activeSaveId),
      reloadMarketFeed(),
      reloadHistoryFeed(),
      reloadTransferRecapFeed(),
      reloadAiTransferPreview(),
      reloadAiSellPreview(),
      reloadAiMarketPlanPreview(),
      reloadSeasonStandingsOverview(),
      reloadSeasonManagementOverview(),
    ]);
    setMarketReloadToken((current) => current + 1);
  }, [
    activeSaveId,
    loadSave,
    reloadAiMarketPlanPreview,
    reloadAiSellPreview,
    reloadAiTransferPreview,
    reloadHistoryFeed,
    reloadMarketFeed,
    reloadSeasonManagementOverview,
    reloadSeasonStandingsOverview,
    reloadTransferRecapFeed,
  ]);

  // Manuelles Neu-Anwerfen der KI-Picks für EIN Team (z. B. ein Team, dessen
  // Kader nach dem Setup leer geblieben ist). Nutzt denselben scoped picks-run-
  // Endpoint und dieselbe Reload-Kette wie der Cockpit-Roster-Fill; scope "all"
  // + teamIds:[teamId] + allowSetupAllTeams begrenzt den Lauf auf genau dieses
  // Team.
  const [teamPicksRefillBusyTeamId, setTeamPicksRefillBusyTeamId] = useState<string | null>(null);
  const [teamPicksRefillMessage, setTeamPicksRefillMessage] = useState<
    { teamId: string; tone: "success" | "error"; text: string } | null
  >(null);

  const runTeamPicksRefill = useCallback(
    async (teamId: string) => {
      if (!teamId) {
        return;
      }
      if (readMeta.readOnly || readMeta.source === "prisma") {
        showReadOnlyNotice();
        return;
      }
      if (teamPicksRefillBusyTeamId) {
        return;
      }

      setTeamPicksRefillBusyTeamId(teamId);
      setTeamPicksRefillMessage(null);
      try {
        const response = await fetch(`/api/ai/picks-run?${buildCockpitScopeParams().toString()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            withRoomContextBody(
              {
                dryRun: false,
                confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
                teamScope: "all",
                teamIds: [teamId],
                allowSetupAllTeams: true,
              },
              roomContext,
            ),
          ),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          executed?: boolean;
          blockingReasons?: string[];
          teams?: Array<{ teamId: string; rosterBefore?: number; rosterAfter?: number; blockingReasons?: string[] }>;
        };

        if (!response.ok || payload.error) {
          setTeamPicksRefillMessage({
            teamId,
            tone: "error",
            text: payload.error ?? payload.blockingReasons?.join(" · ") ?? "KI-Picks konnten nicht angewendet werden.",
          });
          return;
        }

        const teamResult = payload.teams?.find((entry) => entry.teamId === teamId) ?? null;
        const picksApplied =
          teamResult?.rosterAfter != null && teamResult.rosterBefore != null
            ? teamResult.rosterAfter - teamResult.rosterBefore
            : null;

        if (!payload.executed || (picksApplied != null && picksApplied <= 0)) {
          const teamBlockers = teamResult?.blockingReasons ?? [];
          const blockers = teamBlockers.length > 0 ? teamBlockers : payload.blockingReasons ?? [];
          setTeamPicksRefillMessage({
            teamId,
            tone: "error",
            text:
              blockers.length > 0
                ? blockers.slice(0, 3).join(" · ")
                : "Keine neuen Picks angewendet (kein passender Spieler oder Budget).",
          });
          return;
        }

        setTeamPicksRefillMessage({
          teamId,
          tone: "success",
          text: picksApplied != null ? `${picksApplied} Spieler geholt.` : "KI-Picks angewendet.",
        });
        await reloadAfterMarketRosterApply();
      } catch {
        setTeamPicksRefillMessage({ teamId, tone: "error", text: "KI-Picks konnten nicht angewendet werden." });
      } finally {
        setTeamPicksRefillBusyTeamId(null);
      }
    },
    [
      buildCockpitScopeParams,
      readMeta.readOnly,
      readMeta.source,
      reloadAfterMarketRosterApply,
      roomContext,
      showReadOnlyNotice,
      teamPicksRefillBusyTeamId,
    ],
  );

  const matchdayArenaApplyHandlers = useMemo(
    () =>
      createCockpitMatchdayApplyHandlers({
        readMetaSource: readMeta.source,
        showReadOnlyNotice,
        setCockpitBusyKey,
        withRoomBody,
        activeSaveId,
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        firstMatchdayId: gameState.season.matchdayIds[0] ?? gameState.matchdayState.matchdayId,
        matchdayMvpForceReplaceExisting,
        matchdayAutoRunIncludeWarningLineups,
        matchdayAutoRunOverwriteExistingLineups,
        matchdayAutoRunStopOnTie,
        setResultApplyFeed,
        setStandingsApplyFeed,
        setCashApplyFeed,
        setMatchdayAdvanceFeed,
        setMatchdayAutoRunFeed,
        setMatchdayMvpScoringFeed,
        reloadResolvePreview,
        reloadStandingsPreviewFeed,
        reloadPrizePreviewFeed,
        reloadLiveSeasonState,
        loadSave,
        reloadSeasonStandingsOverview,
        reloadSeasonManagementOverview,
        reloadHistoryFeed,
        reloadTransferRecapFeed,
        bumpMarketReloadToken: () => setMarketReloadToken((current) => current + 1),
        setFoundationActionFeedback,
      }),
    [
      activeSaveId,
      gameState.matchdayState.matchdayId,
      gameState.season.id,
      gameState.season.matchdayIds,
      loadSave,
      matchdayAutoRunIncludeWarningLineups,
      matchdayAutoRunOverwriteExistingLineups,
      matchdayAutoRunStopOnTie,
      matchdayMvpForceReplaceExisting,
      readMeta.source,
      reloadHistoryFeed,
      reloadLiveSeasonState,
      reloadPrizePreviewFeed,
      reloadResolvePreview,
      reloadSeasonManagementOverview,
      reloadSeasonStandingsOverview,
      reloadStandingsPreviewFeed,
      reloadTransferRecapFeed,
      setCashApplyFeed,
      setCockpitBusyKey,
      setFoundationActionFeedback,
      setMarketReloadToken,
      setMatchdayAdvanceFeed,
      setMatchdayAutoRunFeed,
      setMatchdayMvpScoringFeed,
      setResultApplyFeed,
      setStandingsApplyFeed,
    ],
  );

  const {
    runCockpitMatchdayAdvance,
    runCockpitMatchdayAutoRun,
  } = matchdayArenaApplyHandlers;

  async function runAiPreseasonBackground() {
    if (readMeta.source === "prisma") {
      return null;
    }

    setAiPreseasonBusy(true);
    setAiPreseasonFeed(null);
    try {
      const response = await fetch(`/api/ai/preseason-background?${buildCockpitScopeParams().toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomContextBody({}, roomContext)),
      });
      const payload = (await response.json()) as FoundationAiPreseasonAutomationResponse;
      setAiPreseasonFeed(payload);
      const preseasonRunFinished =
        !payload.skipped && payload.run != null && payload.run.status !== "running";
      if (preseasonRunFinished) {
        if (payload.run) {
          aiPreseasonCompanionReloadRunIdRef.current = payload.run.runId;
        }
        await reloadAfterMarketRosterApply();
      }
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI Preseason konnte nicht gestartet werden.";
      const payload: FoundationAiPreseasonAutomationResponse = {
        ok: false,
        skipped: false,
        error: message,
        run: {
          runId: `client-error-${Date.now()}`,
          seasonId: gameState.season.id,
          status: "failed",
          mode: "none",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          aiTeamsTotal: aiTeams.length,
          aiTeamsCompleted: 0,
          managerActionsApplied: 0,
          transferBuysApplied: 0,
          transferSellsApplied: 0,
          warnings: [],
          blockingReasons: [message],
        },
      };
      setAiPreseasonFeed(payload);
      return payload;
    } finally {
      setAiPreseasonBusy(false);
    }
  }

  async function runAiPickAuditReset(execute: boolean) {
    if (readMeta.source === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setAiPickAuditBusy(true);
    try {
      const response = await fetch(
        `/api/ai/picks-audit-reset?${new URLSearchParams({
          saveId: activeSaveId,
          seasonId: gameState.season.id,
          source: readMeta.source,
        }).toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dryRun: !execute,
            confirmToken: execute ? "RESET_AI_SETUP_TRANSFERS_ONLY" : undefined,
            force: execute ? (aiPickAuditFeed?.summary.blockedResetTransfers ?? 0) > 0 : undefined,
          }),
        },
      );
      const payload = (await response.json()) as FoundationAiPickAuditResetResponse;
      setAiPickAuditFeed(payload);

      if (execute && response.ok && payload.executed) {
        await Promise.all([
          loadSave(activeSaveId),
          reloadMarketFeed(),
          reloadHistoryFeed(),
          reloadTransferRecapFeed(),
          reloadAiTransferPreview(),
          reloadAiSellPreview(),
          reloadAiMarketPlanPreview(),
          reloadAiNeedsPicksCompare(),
          reloadSeasonStandingsOverview(),
          reloadSeasonManagementOverview(),
        ]);
        setMarketReloadToken((current) => current + 1);
      }
      return payload;
    } finally {
      setAiPickAuditBusy(false);
    }
  }

  async function runSeasonStartReset(execute: boolean) {
    if (readMeta.source === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setSeasonStartResetBusy(true);
    try {
      const response = await fetch(
        `/api/singleplayer-state/season-start-reset?${new URLSearchParams({
          saveId: activeSaveId,
          seasonId: gameState.season.id,
          source: readMeta.source,
        }).toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dryRun: !execute,
            confirmToken: execute ? SEASON_START_RESET_CONFIRM_TOKEN : undefined,
          }),
        },
      );
      const payload = (await response.json()) as FoundationSeasonStartResetResponse;
      setSeasonStartResetFeed(payload);

      if (execute && response.ok && payload.executed) {
        setFreshSeasonStartMessage("Aktueller Save wurde auf Season-Start-Basis zurückgesetzt.");
        await Promise.all([
          loadSave(activeSaveId),
          reloadMarketFeed(),
          reloadHistoryFeed(),
          reloadTransferRecapFeed(),
          reloadAiTransferPreview(),
          reloadAiSellPreview(),
          reloadAiMarketPlanPreview(),
          reloadAiNeedsPicksCompare(),
          reloadSeasonStandingsOverview(),
          reloadSeasonManagementOverview(),
          reloadResolvePreview(),
        ]);
        setMarketReloadToken((current) => current + 1);
      }

      return payload;
    } finally {
      setSeasonStartResetBusy(false);
    }
  }

  async function runFacilityUpgradePreview(facilityId: FacilityId, action: "upgrade" | "downgrade" = "upgrade") {
    if (readMeta.source === "prisma") {
      setFacilityUpgradeError("Prisma-Referenz ist read-only. Facility-Upgrades laufen nur im lokalen Save.");
      return;
    }
    if (!selectedTeamCanManage) {
      const message = `${selectedTeam?.name ?? "Dieses Team"} gehört nicht zu deinen steuerbaren Teams. Gebäude sind read-only.`;
      setFacilityUpgradeError(message);
      showTeamManagementLockedNotice();
      return;
    }

    setTrainingFacilityPreviewId(facilityId);
    setFacilityUpgradeBusy(true);
    setFacilityUpgradeError(null);
    setFacilityUpgradeSuccess(null);

    try {
      const response = await fetch("/api/facilities/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          source: readMeta.source,
          saveId: activeSaveId,
          teamId: selectedTeam.teamId,
          facilityId,
          variant: facilityId === "specialist_wing" ? specialistWingVariantDraft : null,
          action,
          dryRun: true,
        })),
      });
      const payload = (await response.json()) as FacilityUpgradeApiResponse;
      setFacilityUpgradePreview(payload.summary ?? null);
      if (!response.ok || !payload.success || payload.error) {
        const reasons = payload.blockingReasons ?? payload.summary?.blockingReasons ?? [];
        setFacilityUpgradeError(
          payload.error
            ? formatCockpitReason(payload.error)
            : reasons.length > 0
              ? reasons.map(formatCockpitReason).join(" · ")
              : "Upgrade-Vorschau ist gerade blockiert.",
        );
      }
    } catch {
      setFacilityUpgradeError("Facility-Preview konnte nicht geladen werden.");
      setFacilityUpgradePreview(null);
    } finally {
      setFacilityUpgradeBusy(false);
    }
  }

  async function confirmFacilityUpgrade() {
    if (!facilityUpgradePreview?.facility?.facilityId || !facilityUpgradePreview.confirmToken) {
      setFacilityUpgradeError("facility_upgrade_preview_missing: Bitte Upgrade erneut prüfen.");
      return;
    }
    if (facilityUpgradePreview.saveContext.saveId !== activeSaveId || facilityUpgradePreview.team?.teamId !== selectedTeam.teamId) {
      setFacilityUpgradeError("facility_upgrade_preview_stale: Save oder Team hat sich geändert. Bitte Preview neu laden.");
      return;
    }
    if (!selectedTeamCanManage) {
      setFacilityUpgradeError(`${selectedTeam.name} gehört nicht zu deinen steuerbaren Teams. Gebäude sind read-only.`);
      showTeamManagementLockedNotice();
      return;
    }

    setFacilityUpgradeBusy(true);
    setFacilityUpgradeError(null);
    setFacilityUpgradeSuccess(null);

    try {
      const response = await fetch("/api/facilities/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          source: readMeta.source,
          saveId: activeSaveId,
          teamId: selectedTeam.teamId,
          facilityId: facilityUpgradePreview.facility.facilityId,
          variant: facilityUpgradePreview.facility.variant,
          action: facilityUpgradePreview.action ?? "upgrade",
          dryRun: false,
          confirmToken: facilityUpgradePreview.confirmToken,
        })),
      });
      const payload = (await response.json()) as FacilityUpgradeApiResponse;
      setFacilityUpgradePreview(payload.summary ?? null);
      if (!response.ok || !payload.success || !payload.summary) {
        const reasons = payload.blockingReasons ?? payload.summary?.blockingReasons ?? [];
        setFacilityUpgradeError(
          payload.error
            ? formatCockpitReason(payload.error)
            : reasons.length > 0
              ? reasons.map(formatCockpitReason).join(" · ")
              : "Facility-Upgrade blockiert.",
        );
        return;
      }
      setFacilityUpgradeSuccess(
        `${payload.summary.facility?.label ?? "Facility"} aktualisiert: Level ${payload.summary.currentLevel} → ${
          payload.summary.nextLevel ?? payload.summary.currentLevel
        } · Cash ${formatTransfermarktCurrency(payload.summary.cashBefore)} → ${formatTransfermarktCurrency(payload.summary.cashAfter)} · ${
          payload.summary.nextEffect ?? payload.summary.currentEffect
        }.`,
      );
      setFoundationActionFeedback({
        tone: "success",
        title: payload.summary.action === "downgrade" ? "Gebäude gedowngradet" : "Gebäude aktualisiert",
        detail: `${payload.summary.facility?.label ?? "Facility"}: Level ${payload.summary.currentLevel} → ${
          payload.summary.nextLevel ?? payload.summary.currentLevel
        } · Cash ${formatTransfermarktCurrency(payload.summary.cashBefore)} → ${formatTransfermarktCurrency(payload.summary.cashAfter)} · ${
          payload.summary.nextEffect ?? payload.summary.currentEffect
        }.`,
      });
      await Promise.all([loadSave(activeSaveId), reloadPrizePreviewFeed(), reloadStandingsPreviewFeed()]);
      setMarketReloadToken((current) => current + 1);
    } catch {
      setFacilityUpgradeError("Facility-Upgrade konnte nicht ausgeführt werden.");
    } finally {
      setFacilityUpgradeBusy(false);
    }
  }

  async function runFacilityMaintenancePreview(facilityId: FacilityId) {
    if (readMeta.source === "prisma") {
      setFacilityMaintenanceError("Prisma-Referenz ist read-only. Facility-Wartung läuft nur im lokalen Save.");
      return;
    }
    if (!selectedTeamCanManage) {
      setFacilityMaintenanceError(`${selectedTeam?.name ?? "Dieses Team"} gehört nicht zu deinen steuerbaren Teams. Wartung ist read-only.`);
      showTeamManagementLockedNotice();
      return;
    }

    setTrainingFacilityPreviewId(facilityId);
    setFacilityMaintenanceBusy(true);
    setFacilityMaintenanceError(null);
    setFacilityMaintenanceSuccess(null);

    try {
      const response = await fetch("/api/facilities/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          source: readMeta.source,
          saveId: activeSaveId,
          teamId: selectedTeam.teamId,
          facilityId,
          dryRun: true,
        })),
      });
      const payload = (await response.json()) as FacilityMaintenanceApiResponse;
      setFacilityMaintenancePreview(payload.summary ?? null);
      if (!response.ok || !payload.success || payload.error) {
        const reasons = payload.blockingReasons ?? payload.summary?.blockingReasons ?? [];
        setFacilityMaintenanceError(
          payload.error
            ? formatCockpitReason(payload.error)
            : reasons.length > 0
              ? reasons.map(formatCockpitReason).join(" · ")
              : "Wartungs-Vorschau ist gerade blockiert.",
        );
      }
    } catch {
      setFacilityMaintenanceError("Facility-Wartung konnte nicht geladen werden.");
      setFacilityMaintenancePreview(null);
    } finally {
      setFacilityMaintenanceBusy(false);
    }
  }

  async function confirmFacilityMaintenance() {
    if (!facilityMaintenancePreview?.facility?.facilityId || !facilityMaintenancePreview.confirmToken) {
      setFacilityMaintenanceError("facility_maintenance_preview_missing: Bitte Wartung erneut prüfen.");
      return;
    }
    if (
      facilityMaintenancePreview.saveContext.saveId !== activeSaveId ||
      facilityMaintenancePreview.team?.teamId !== selectedTeam.teamId
    ) {
      setFacilityMaintenanceError("facility_maintenance_preview_stale: Save oder Team hat sich geändert. Bitte Preview neu laden.");
      return;
    }
    if (!selectedTeamCanManage) {
      setFacilityMaintenanceError(`${selectedTeam.name} gehört nicht zu deinen steuerbaren Teams. Wartung ist read-only.`);
      showTeamManagementLockedNotice();
      return;
    }

    setFacilityMaintenanceBusy(true);
    setFacilityMaintenanceError(null);
    setFacilityMaintenanceSuccess(null);

    try {
      const response = await fetch("/api/facilities/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          source: readMeta.source,
          saveId: activeSaveId,
          teamId: selectedTeam.teamId,
          facilityId: facilityMaintenancePreview.facility.facilityId,
          dryRun: false,
          confirmToken: facilityMaintenancePreview.confirmToken,
        })),
      });
      const payload = (await response.json()) as FacilityMaintenanceApiResponse;
      setFacilityMaintenancePreview(payload.summary ?? null);
      if (!response.ok || !payload.success || !payload.summary) {
        const reasons = payload.blockingReasons ?? payload.summary?.blockingReasons ?? [];
        setFacilityMaintenanceError(
          payload.error
            ? formatCockpitReason(payload.error)
            : reasons.length > 0
              ? reasons.map(formatCockpitReason).join(" · ")
              : "Facility-Wartung blockiert.",
        );
        return;
      }
      setFacilityMaintenanceSuccess(
        `${payload.summary.facility?.label ?? "Facility"} gewartet. Zustand ${formatWholeNumber(payload.summary.conditionPct)}% → ${formatWholeNumber(
          payload.summary.nextConditionPct,
        )}%.`,
      );
      setFoundationActionFeedback({
        tone: "success",
        title: "Wartung abgeschlossen",
        detail: `${payload.summary.facility?.label ?? "Facility"}: Zustand ${formatWholeNumber(payload.summary.conditionPct)}% → ${formatWholeNumber(
          payload.summary.nextConditionPct,
        )}%.`,
      });
      await Promise.all([loadSave(activeSaveId), reloadPrizePreviewFeed(), reloadStandingsPreviewFeed()]);
      setMarketReloadToken((current) => current + 1);
    } catch {
      setFacilityMaintenanceError("Facility-Wartung konnte nicht ausgeführt werden.");
    } finally {
      setFacilityMaintenanceBusy(false);
    }
  }

  async function runFinishMatchdaySimple() {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }
    // Force solo-safe options: keep existing lineups, no tie-stop, advance after cash
    const savedInclude = matchdayAutoRunIncludeWarningLineups;
    const savedOverwrite = matchdayAutoRunOverwriteExistingLineups;
    const savedStop = matchdayAutoRunStopOnTie;
    setMatchdayAutoRunIncludeWarningLineups(false);
    setMatchdayAutoRunOverwriteExistingLineups(false);
    setMatchdayAutoRunStopOnTie(false);
    try {
      const runCockpitMatchdayAutoRun = matchdayArenaApplyHandlers?.runCockpitMatchdayAutoRun;
      if (!runCockpitMatchdayAutoRun) {
        return;
      }
      const result = await runCockpitMatchdayAutoRun(true);
      const advanced = result?.summary?.advanceAllowed ?? false;
      if (advanced) {
        setFoundationView("homeV2", setActiveView);
        setFoundationActionFeedback({
          tone: "success",
          title: "Spieltag abgeschlossen",
          detail: "Ergebnisse gesichert. Der nächste Spieltag ist bereit.",
        });
      } else {
        setFoundationActionFeedback({
          tone: "warning",
          title: "Spieltag nicht vollständig abgeschlossen",
          detail: "Bitte Cockpit prüfen — ein Schritt ist möglicherweise blockiert.",
        });
      }
    } finally {
      setMatchdayAutoRunIncludeWarningLineups(savedInclude);
      setMatchdayAutoRunOverwriteExistingLineups(savedOverwrite);
      setMatchdayAutoRunStopOnTie(savedStop);
    }
  }

  async function postAdminSeasonSimulation(action: "start" | "tick" | "pause" | "resume" | "cancel" | "status") {
    if (readMeta.source === "prisma") {
      showReadOnlyNotice();
      return null;
    }
    setAdminSimulationBusy(true);
    setAdminSimulationError(null);
    try {
      const response = await fetch("/api/admin/season-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          runId: adminSimulationRun?.runId,
          saveId: activeSaveId,
          seasonCount: adminSimulationSeasonCount,
          mode: adminSimulationMode,
          fullChurnStress: adminSimulationFullChurn,
          injuriesTestMode: adminSimulationInjuries,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        run?: AdminSeasonSimulationRunSummary | null;
        error?: string;
      };
      if (!response.ok || payload.error) {
        setAdminSimulationError(payload.error ?? "Season Simulation konnte nicht gestartet werden.");
      }
      if (payload.run) {
        setAdminSimulationRun(payload.run);
        if (payload.run.status === "completed" || payload.run.status === "blocked" || payload.run.status === "cancelled") {
          await Promise.all([loadSave(activeSaveId), reloadSeasonStandingsOverview(), reloadPrizePreviewFeed()]);
        }
      }
      return payload.run ?? null;
    } catch {
      setAdminSimulationError("Season Simulation API nicht erreichbar.");
      return null;
    } finally {
      setAdminSimulationBusy(false);
    }
  }

  async function startAdminSeasonSimulationRun() {
    const confirmed =
      adminSimulationMode === "dry_run" ||
      window.confirm("Diese Simulation schreibt in den aktiv gewählten lokalen Save. Fortfahren?");
    if (!confirmed) return;
    await postAdminSeasonSimulation("start");
  }

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (adminSimulationRun?.status !== "running" || adminSimulationBusy) {
      return;
    }

    const timer = window.setTimeout(() => {
      void postAdminSeasonSimulation("tick");
    }, 900);

    return () => window.clearTimeout(timer);
  }, [adminSimulationBusy, adminSimulationRun?.runId, adminSimulationRun?.status, adminSimulationRun?.updatedAt]);

  useEffect(() => {
    if (
      readMeta.source === "prisma" ||
      readMeta.readOnly ||
      !activeSaveId ||
      activeSaveId === "loading-save" ||
      !adminSimulationRun?.runId
    ) {
      return;
    }
    void postAdminSeasonSimulation("status");
  }, [activeSaveId, adminSimulationRun?.runId, readMeta.readOnly, readMeta.source]);

  useEffect(() => {
    if (!adminSimulationRun || !["running", "paused"].includes(adminSimulationRun.status)) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void postAdminSeasonSimulation("status");
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [adminSimulationRun?.runId, adminSimulationRun?.status]);

  useEffect(() => {
    setTeamIdentityDraft(buildTeamIdentityDraftMap(gameState.teams, gameState.teamIdentities));
  }, [gameState.teamIdentities, gameState.teams]);

  useEffect(() => {
    setTeamControlDraft(buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings));
    const savedOwnership = deriveChrisFrankyTeamIdsFromSettings(
      gameState.teams,
      buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings),
    );
    setGameModeOwnershipChrisIds(savedOwnership.chrisTeamIds);
    setGameModeOwnershipFrankyIds(savedOwnership.frankyTeamIds);
  }, [gameState.seasonState.teamControlSettings, gameState.teams]);

  useEffect(() => {
    setTeamStrategyDraft(
      buildTeamStrategyProfileMap(gameState.teams, gameState.teamIdentities, gameState.seasonState.teamStrategyProfiles),
    );
  }, [gameState.seasonState.teamStrategyProfiles, gameState.teamIdentities, gameState.teams]);

  useEffect(() => {
    const requestedView = parseFoundationViewFromUrl();
    const requestedPlayerId = parseFoundationPlayerIdFromUrl();
    const requestedTab = parseFoundationTabFromUrl();
    if (requestedView === "playerProfile" && requestedPlayerId) {
      pendingPlayerProfileHydrationRef.current = {
        playerId: requestedPlayerId,
        tab: (requestedTab as PlayerProfileTabId | null) ?? "overview",
      };
      setPlayerProfileTab((requestedTab as PlayerProfileTabId | null) ?? "overview");
      setPlayerProfileLoading(true);
      setActiveView("playerProfile");
    } else if (requestedView) {
      setActiveView(requestedView);
    }

    if (requestedView === "teamProfile") {
      const teamId = parseFoundationTeamIdFromUrl(initialClientGameState.teams);
      if (teamId) {
        setTeamProfileTeamId(teamId);
      }
    }

    const requestedPanel = parseFoundationPanelFromUrl();
    if (requestedPanel) {
      if (requestedPanel !== "briefing") {
        setFoundationPanel(requestedPanel);
      }
      if (requestedPanel === "offer") {
        const offerPlayerId = parseFoundationPlayerIdFromUrl();
        if (offerPlayerId) {
          setMarketFocusPlayerId(offerPlayerId);
        }
      }
      if (requestedPanel === "sell") {
        const sellPlayerId = parseFoundationPlayerIdFromUrl();
        const sellTeamId = parseFoundationTeamIdFromUrl(initialClientGameState.teams);
        if (sellPlayerId && sellTeamId) {
          const sellSubject = resolveSellSubjectFromPlayerId(sellPlayerId, sellTeamId);
          if (sellSubject) {
            setMarketSellSubject(sellSubject);
            void requestTransfermarktSellPreview(sellSubject, sellTeamId);
          }
        }
      }
    }

    const facilityTarget = parseFoundationFacilityFromUrl();
    if (facilityTarget.facilityId) {
      setFoundationFacilityTarget({
        facilityId: facilityTarget.facilityId,
        action: facilityTarget.facilityAction ?? "upgrade",
      });
    }

    if (requestedTab === "office" || requestedView === "hq") {
      setHomeV2Tab("office");
    }

    if (requestedView === "scoutingCenterV2") {
      if (requestedTab === "reports" || requestedTab === "recommended" || requestedTab === "overview") {
        setScoutingCenterTab(requestedTab);
      }
    }

    const requestedTeamContext = resolvePreferredFoundationTeamContext(initialClientGameState.teams, {
      currentTeamId: selectedTeamId,
      currentSource: activeManagerTeamSource,
      initialTeamId: initialSelectedTeamId,
      savedTeamId: initialClientGameState.seasonState.newGameFlow?.selectedTeamId ?? null,
      activeSaveId,
      settingsMap: buildTeamControlSettingsMap(initialClientGameState.teams, initialClientGameState.seasonState.teamControlSettings),
    });
    if (requestedTeamContext.teamId && requestedTeamContext.teamId !== "loading-team") {
      setSelectedTeamId(requestedTeamContext.teamId);
      setActiveManagerTeamSource(requestedTeamContext.source);
      setActiveManagerTeamWarning(requestedTeamContext.warning ?? null);
    }

    writeFoundationUrlState(
      {
        view: (requestedView ?? "homeV2") as FoundationViewId,
        tab: requestedTab,
        playerId: requestedPlayerId,
        team:
          requestedTeamContext.teamId && requestedTeamContext.teamId !== "loading-team"
            ? requestedTeamContext.teamId
            : parseFoundationTeamIdFromUrl(initialClientGameState.teams),
        panel: requestedPanel,
        facilityId: facilityTarget.facilityId,
        facilityAction: facilityTarget.facilityAction,
        saveId: parseFoundationSaveIdFromUrl(),
      },
      "replace",
    );
  }, [initialSelectedTeamId]);

  useEffect(() => {
    if (gameState.season.id === "loading" || playerProfileData) {
      return;
    }
    if (activeView !== "playerProfile") {
      return;
    }

    const pending = pendingPlayerProfileHydrationRef.current;
    const urlState = parseFoundationUrlStateFromLocation();
    const playerId = pending?.playerId ?? urlState.playerId;
    const tab = pending?.tab ?? (urlState.tab as PlayerProfileTabId | null) ?? playerProfileTab;

    if (!playerId) {
      return;
    }

    const attemptKey = buildPlayerProfileHydrationSuccessKey(gameState.season.id, playerId);
    const failureKey = buildPlayerProfileHydrationFailureKey(gameState.season.id, playerId, gameState.players.length);
    const loadingKey = buildPlayerProfileHydrationLoadingKey(gameState.season.id, playerId);
    if (
      playerProfileHydrationAttemptRef.current === attemptKey ||
      playerProfileHydrationAttemptRef.current === failureKey ||
      playerProfileHydrationAttemptRef.current === loadingKey
    ) {
      return;
    }

    pendingPlayerProfileHydrationRef.current = null;
    void openPlayerProfileById(playerId, null, { tab });
  }, [activeView, gameState.players.length, gameState.season.id, playerProfileData, playerProfileTab]);

  useEffect(() => {
    const previousView = previousFoundationViewRef.current;
    previousFoundationViewRef.current = activeView;

    if (activeView !== "playerProfile" || !playerProfileData) {
      return;
    }
    if (previousView === "playerProfile") {
      return;
    }

    void refreshOpenPlayerProfileAfterTrainingChange(gameState, playerProfileData.playerId);
  }, [activeView, gameState, playerProfileData?.playerId]);

  useEffect(() => {
    function handlePopState() {
      setRoomContext(readFoundationRoomContextFromLocation());
      const fromHistory = readFoundationHistoryState();
      if (fromHistory) {
        applyFoundationNavigationStateRef.current(fromHistory);
        return;
      }
      applyFoundationNavigationStateRef.current(parseFoundationUrlStateFromLocation());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useFoundationKeyboardNavigation({
    onBack: () => {
      if (canFoundationNavigateBack()) {
        foundationNavigateBack();
        return;
      }
      closeFoundationDrilldownPanel();
    },
    canBack: () =>
      canFoundationNavigateBack() ||
      Boolean(foundationPanel || activeView === "playerProfile" || activeView === "teamProfile" || playerProfileData),
  });

  useEffect(() => {
    if (!gameState.teams.some((team) => team.teamId === selectedTeamId)) {
      const nextContext = resolvePreferredFoundationTeamContext(gameState.teams, {
        currentTeamId: null,
        currentSource: activeManagerTeamSource,
        initialTeamId: initialSelectedTeamId,
        savedTeamId: gameState.seasonState.newGameFlow?.selectedTeamId ?? null,
        activeSaveId,
        settingsMap: buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings),
      });
      setSelectedTeamId(nextContext.teamId);
      setActiveManagerTeamSource(nextContext.source);
      setActiveManagerTeamWarning(nextContext.warning ?? "Aktives Team war in diesem Save nicht vorhanden und wurde zurückgesetzt.");
      return;
    }

    if (selectedTeamId && selectedTeamId !== "loading-team" && gameState.season.id !== "loading") {
      syncFoundationTeamIdInUrl(selectedTeamId);
      persistFoundationManagerTeamId(selectedTeamId, activeSaveId, activeManagerTeamSource);
    }
  }, [activeManagerTeamSource, activeSaveId, gameState.teams, initialSelectedTeamId, selectedTeamId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      FOUNDATION_TABLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(tableColumnPreferences),
    );
  }, [tableColumnPreferences]);

  useEffect(() => {
    if (!shouldLoadSeasonArchive || isFoundationBootstrapState || !activeSaveId || activeSaveId === "loading-save") {
      return;
    }

    if (gameState.seasonState.seasonSnapshots !== undefined) {
      fullSeasonArchiveLoadKeyRef.current = null;
      return;
    }

    const archiveLoadKey = `${activeSaveId}:${gameState.season.id}:season-archive-full`;
    if (fullSeasonArchiveLoadKeyRef.current === archiveLoadKey) {
      return;
    }

    fullSeasonArchiveLoadKeyRef.current = archiveLoadKey;
    void loadSave(activeSaveId, foundationSaveMode, { compactInitial: false })
      .then((nextGameState) => {
        if (!nextGameState) {
          // Full-save load returned nothing — clear the key so a later render
          // can retry instead of leaving archive-gated views (Ewige Tabelle)
          // on a loading skeleton that never resolves.
          fullSeasonArchiveLoadKeyRef.current = null;
          return;
        }
        // Materialize an archive even when the save carries none: `?? []` flips
        // `hasArchive` true so archive-gated views degrade to their honest
        // empty-state ("keine archivierten Saisons") instead of an eternal
        // skeleton. A real archive is used verbatim; a concurrently-loaded one
        // is never clobbered.
        const loadedSnapshots = nextGameState.seasonState.seasonSnapshots ?? [];
        setGameState((previous) => ({
          ...previous,
          seasonState: {
            ...previous.seasonState,
            seasonSnapshots: previous.seasonState.seasonSnapshots ?? loadedSnapshots,
          },
        }));
        void reloadSeasonStandingsOverview(seasonOverviewSeasonId || nextGameState.season.id);
      })
      .catch(() => {
        fullSeasonArchiveLoadKeyRef.current = null;
      });
  }, [
    activeSaveId,
    foundationSaveMode,
    gameState.season.id,
    gameState.seasonState.seasonSnapshots,
    isFoundationBootstrapState,
    seasonOverviewSeasonId,
    shouldLoadSeasonArchive,
  ]);

  useEffect(() => {
    if (isFoundationBootstrapState || !activeSaveId || activeSaveId === "loading-save") {
      return;
    }
    prefetchFoundationDefaultPanels();
  }, [activeSaveId, isFoundationBootstrapState]);

  useEffect(() => {
    if (isFoundationBootstrapState) {
      return;
    }
    prefetchFoundationPanel(activeView as FoundationViewId);
    if (activeView === "matchdayArena") {
      prefetchFoundationPanel("seasonV2");
      if (activeSaveId && activeSaveId !== "loading-save" && gameState.season.id !== "loading") {
        prefetchSeasonStandingsData({
          saveId: activeSaveId,
          seasonId: seasonOverviewSeasonId || gameState.season.id,
          contentSignature: seasonContentSignature,
          source: readMeta.source,
        });
      }
    }
  }, [
    activeView,
    isFoundationBootstrapState,
    activeSaveId,
    gameState.season.id,
    seasonOverviewSeasonId,
    seasonContentSignature,
    readMeta.source,
  ]);

  useEffect(() => {
    if (isFoundationBootstrapState || activeView !== "players") {
      return;
    }
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof idleWindow.requestIdleCallback !== "function") {
      return;
    }
    const idleHandle = idleWindow.requestIdleCallback(() => {
      prefetchFoundationPanel("trainingCompact");
    });
    return () => {
      idleWindow.cancelIdleCallback?.(idleHandle);
    };
  }, [activeView, isFoundationBootstrapState]);

  useEffect(() => {
    // Legacy→v2 view normalization: replace (no history entry), otherwise Back
    // would land on the legacy id and immediately redirect again (a trap).
    if (activeView === "home") {
      setFoundationView("homeV2", setActiveView, { push: false });
    }
    if (activeView === "inbox") {
      setFoundationView("inboxV2", setActiveView, { push: false });
    }
    if (activeView === "market") {
      setFoundationView("marketV2", setActiveView, { push: false });
    }
    if (activeView === "history") {
      setFoundationView("historyV2", setActiveView, { push: false });
    }
    if (activeView === "season") {
      setFoundationView("seasonV2", setActiveView, { push: false });
    }
  }, [activeView]);

  async function requestTransfermarktBuyPreview(
    item: TransfermarktBuyPreviewSubject,
    teamIdOverride?: string,
    previewOverrides?: {
      contractLength?: number | null;
      contractShape?: ContractShape | null;
      offeredSalary?: number | null;
      clearNegotiationOutcome?: boolean;
    },
  ) {
    const requestVersion = ++marketBuyPreviewRequestVersion.current;
    const effectiveTeamId = resolveMarketBuyTeamId(teamIdOverride);
    const effectiveContractLength = previewOverrides?.contractLength ?? marketContractLengthDraft;
    const effectiveContractShape = previewOverrides?.contractShape ?? marketContractShapeDraft;
    const effectiveOfferedSalary =
      previewOverrides && "offeredSalary" in previewOverrides
        ? previewOverrides.offeredSalary ?? null
        : marketOfferedSalaryDraft;

    if (readMeta.source === "prisma") {
      if (requestVersion !== marketBuyPreviewRequestVersion.current) {
        return;
      }
      setMarketBuyError("Prisma-Referenz ist read-only. Für Käufe bitte lokalen Testspielstand starten.");
      setMarketBuyPreview(null);
      setMarketBuyPreviewContext(null);
      setMarketPreviewPlayerId(item.playerId);
      return;
    }

    if (!effectiveTeamId) {
      if (requestVersion !== marketBuyPreviewRequestVersion.current) {
        return;
      }
      setMarketBuyError("Bitte zuerst ein Team wählen.");
      setMarketBuyPreview(null);
      setMarketBuyPreviewContext(null);
      setMarketPreviewPlayerId(item.playerId);
      return;
    }

    if (!canManageTeamId(effectiveTeamId)) {
      if (requestVersion !== marketBuyPreviewRequestVersion.current) {
        return;
      }
      setMarketBuyError(`${getTeamLockedName(effectiveTeamId)} gehört nicht zu deinen steuerbaren Teams. Kaufen ist gesperrt.`);
      setMarketBuyPreview(null);
      setMarketBuyPreviewContext(null);
      setMarketPreviewPlayerId(item.playerId);
      return;
    }

    const feedSaveId = marketFeed?.scope?.saveId ?? activeSaveId;
    const feedSeasonId = marketFeed?.scope?.seasonId ?? gameState.season.id;
    if (feedSaveId !== activeSaveId || feedSeasonId !== gameState.season.id) {
      if (requestVersion !== marketBuyPreviewRequestVersion.current) {
        return;
      }
      setMarketBuyError(
        `buy_save_context_mismatch: Transfermarkt-Feed ${feedSaveId}/${feedSeasonId}, aktiver Save ${activeSaveId}/${gameState.season.id}. Bitte Feed neu laden.`,
      );
      setMarketBuyPreview(null);
      setMarketBuyPreviewContext(null);
      setMarketPreviewPlayerId(item.playerId);
      return;
    }

    const requestContext: TransfermarktBuyRequestContext = {
      saveId: activeSaveId,
      seasonId: gameState.season.id,
      teamId: effectiveTeamId,
      playerId: item.playerId,
      source: readMeta.source,
      view: activeView,
    };

    const shouldClearNegotiationOutcome = previewOverrides?.clearNegotiationOutcome !== false;

    setMarketBuyBusy(true);
    setMarketBuyError(null);
    setMarketBuySuccess(null);
    if (shouldClearNegotiationOutcome) {
      setMarketNegotiationOutcome(null);
    }
    setMarketBuyPreviewContext(null);
    setMarketPreviewPlayerId(item.playerId);

    try {
      const response = await fetch("/api/transfermarkt/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(withRoomBody({
          saveId: requestContext.saveId,
          seasonId: requestContext.seasonId,
          teamId: requestContext.teamId,
          playerId: requestContext.playerId,
          ...(effectiveContractLength != null ? { contractLength: effectiveContractLength } : {}),
          ...(effectiveContractShape != null ? { contractShape: effectiveContractShape } : {}),
          ...(effectiveOfferedSalary != null ? { offeredSalary: effectiveOfferedSalary } : {}),
          dryRun: true,
          source: readMeta.source,
        })),
      });
      const payload = (await response.json()) as TransfermarktBuyApiResponse;
      if (requestVersion !== marketBuyPreviewRequestVersion.current) {
        return;
      }
      if (payload.summary) {
        setMarketBuyPreview(payload.summary);
        setMarketBuyPreviewContext(requestContext);
        persistContractNegotiationDraftFromSummary(payload.summary);
      } else {
        setMarketBuyPreview(null);
        setMarketBuyPreviewContext(null);
      }
      if (payload.error) {
        setMarketBuyError(payload.error);
        return;
      }
      if (!payload.summary) {
        setMarketBuyError("Kaufvorschau konnte nicht geladen werden.");
        return;
      }
      setMarketBuyError(null);
    } catch {
      if (requestVersion === marketBuyPreviewRequestVersion.current) {
        setMarketBuyError("Kaufvorschau konnte nicht geladen werden.");
        setMarketBuyPreview(null);
        setMarketBuyPreviewContext(null);
      }
    } finally {
      if (requestVersion === marketBuyPreviewRequestVersion.current) {
        setMarketBuyBusy(false);
      }
    }
  }

  async function confirmTransfermarktBuy() {
    if (readMeta.source === "prisma") {
      setMarketBuyError("Prisma-Referenz ist read-only. Für Käufe bitte lokalen Testspielstand starten.");
      return;
    }

    if (!marketBuyPreview?.player?.id || !marketBuyPreview?.team?.id) {
      return;
    }
    if (!canManageTeamId(marketBuyPreview.team.id)) {
      setMarketBuyError(`${getTeamLockedName(marketBuyPreview.team.id)} gehört nicht zu deinen steuerbaren Teams. Kaufen ist gesperrt.`);
      showTeamManagementLockedNotice(getTeamLockedName(marketBuyPreview.team.id));
      return;
    }

    const buyContext = marketBuyPreviewContext;
    if (!buyContext) {
      setMarketBuyError("buy_save_context_missing: Bitte Kaufvorschau erneut laden.");
      return;
    }

    if (
      buyContext.saveId !== activeSaveId ||
      buyContext.seasonId !== gameState.season.id ||
      buyContext.teamId !== marketBuyPreview.team.id ||
      buyContext.playerId !== marketBuyPreview.player.id ||
      buyContext.source !== readMeta.source
    ) {
      setMarketBuyError(
        `buy_save_context_mismatch: Preview ${buyContext.saveId}/${buyContext.seasonId}/${buyContext.teamId}/${buyContext.playerId}, aktiv ${activeSaveId}/${gameState.season.id}/${marketBuyPreview.team.id}/${marketBuyPreview.player.id}. Bitte Kaufvorschau neu laden.`,
      );
      return;
    }

    setMarketBuyBusy(true);
    setMarketBuyError(null);
    setMarketBuySuccess(null);

    try {
      const response = await fetch("/api/transfermarkt/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(withRoomBody({
          saveId: buyContext.saveId,
          seasonId: buyContext.seasonId,
          teamId: buyContext.teamId,
          playerId: buyContext.playerId,
          ...(marketContractLengthDraft != null ? { contractLength: marketContractLengthDraft } : {}),
          ...(marketContractShapeDraft != null ? { contractShape: marketContractShapeDraft } : {}),
          ...(marketOfferedSalaryDraft != null ? { offeredSalary: marketOfferedSalaryDraft } : {}),
          dryRun: false,
          source: buyContext.source,
        })),
      });
      const payload = (await response.json()) as TransfermarktBuyApiResponse;
      if (payload.summary) {
        setMarketBuyPreview(payload.summary);
      }
      if (!response.ok || payload.error || !payload.summary || !payload.summary.canBuy) {
        setMarketBuyError(
          payload.error ??
            payload.summary?.blockingReasons?.[0] ??
            "Kauf konnte nicht bestätigt werden.",
        );
        return;
      }

      setMarketBuyPreview(payload.summary);
      const buyFeedback = `${payload.summary.player?.name ?? "Spieler"} gekauft: Cash ${formatTransfermarktCurrency(payload.summary.cashBefore)} → ${formatTransfermarktCurrency(
          payload.summary.cashAfter,
        )} · Gehalt ${formatTransfermarktCurrency(payload.summary.salaryBefore)} → ${formatTransfermarktCurrency(payload.summary.salaryAfter)} · Kader ${
          payload.summary.rosterBefore ?? "—"
        } → ${payload.summary.rosterAfter ?? "—"}.`;
      setMarketBuySuccess(buyFeedback);
      setFoundationActionFeedback({
        tone: "success",
        title: "Kauf abgeschlossen",
        detail: buyFeedback,
      });
      setActiveManagerTeam(payload.summary.team?.id ?? marketBuyPreview.team.id, "manual_select");
      setFoundationPanel(null);
      syncFoundationViewInUrl("marketV2", null, null, { team: selectedTeamId });
      setMarketBuySubject(null);
      setMarketBuyPreviewContext(null);
      await Promise.all([
        loadSave(buyContext.saveId),
        reloadMarketFeed(payload.summary.team?.id ?? marketBuyPreview.team.id),
        marketAiPreviewFeed ? reloadAiTransferPreview(marketAiPreviewSelectedTeamId) : Promise.resolve(null),
        marketAiSellPreviewFeed ? reloadAiSellPreview(marketAiSellPreviewSelectedTeamId) : Promise.resolve(null),
        marketAiPlanPreviewFeed ? reloadAiMarketPlanPreview(marketAiPlanPreviewSelectedTeamId) : Promise.resolve(null),
        marketAiCompareFeed ? reloadAiNeedsPicksCompare(marketAiCompareSelectedTeamId) : Promise.resolve(null),
        reloadHistoryFeed(),
        reloadSeasonStandingsOverview(),
        reloadSeasonManagementOverview(),
      ]);
      setMarketReloadToken((current) => current + 1);
    } catch {
      setMarketBuyError("Kauf konnte nicht bestätigt werden.");
    } finally {
      setMarketBuyBusy(false);
    }
  }

  /**
   * Dry-run-Preview für die Gehaltsverhandlung (Verlängern-Fenster). Reine
   * Lese-Operation gegen /api/contracts/renewal — liefert die vollständige
   * `negotiationPreview` (Forderung, Accept/Counter/Reject, Gehaltstreppe,
   * Moral) für die aktuell eingestellten Konditionen. Kein State-Write.
   */
  async function requestContractRenewalPreview(input: {
    teamId: string;
    playerId: string;
    contractLength: number;
    offeredSalary: number | null;
    contractShape?: ContractShape;
  }): Promise<ContractRenewalApiResponse | null> {
    if (readMeta.source === "prisma") {
      return null;
    }
    try {
      const response = await fetch("/api/contracts/renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          saveId: activeSaveId,
          teamId: input.teamId,
          playerId: input.playerId,
          action: "renew",
          contractLength: input.contractLength,
          offeredSalary: input.offeredSalary,
          contractShape: input.contractShape ?? "balanced",
          dryRun: true,
          source: readMeta.source,
        })),
      });
      return (await response.json()) as ContractRenewalApiResponse;
    } catch {
      return null;
    }
  }

  async function openContractRenewalNegotiation(input: {
    teamId: string;
    playerId: string;
    playerName: string;
    contractLength?: number | null;
  }) {
    if (readMeta.readOnly || readMeta.source === "prisma") {
      showReadOnlyNotice();
      return;
    }
    if (!canManageTeamId(input.teamId)) {
      setContractRenewalError(`${getTeamLockedName(input.teamId)} gehört nicht zu deinen steuerbaren Teams. Vertragsaktionen sind gesperrt.`);
      showTeamManagementLockedNotice(getTeamLockedName(input.teamId));
      return;
    }

    const rosterEntry = gameState.rosters.find(
      (entry) => entry.teamId === input.teamId && entry.playerId === input.playerId,
    ) ?? null;
    const startLength = input.contractLength ?? 2;
    setContractRenewalBusy(`preview:${input.teamId}:${input.playerId}`);
    setContractRenewalError(null);
    try {
      const previewResponse = await fetch("/api/contracts/renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          saveId: activeSaveId,
          teamId: input.teamId,
          playerId: input.playerId,
          action: "renew",
          contractLength: startLength,
          contractShape: "balanced",
          dryRun: true,
          source: readMeta.source,
        })),
      });
      const previewPayload = (await previewResponse.json()) as ContractRenewalApiResponse;
      if (!previewResponse.ok || previewPayload.error || !previewPayload.summary?.confirmToken) {
        setContractRenewalError(
          previewPayload.error ??
            previewPayload.summary?.blockingReasons?.[0] ??
            `${input.playerName}: Verhandlungsvorschau blockiert.`,
        );
        return;
      }
      // Start-Angebot: moral-adjustierte Erwartung (falls vorhanden), sonst
      // die rohe Forderung — derselbe Default, den auch der Season-End-Tick
      // beim Auto-Renewal ansetzt.
      const expectedSalary = previewPayload.summary.negotiationPreview?.expectedSalary ?? null;
      const startOffer = previewPayload.summary.moraleAdjustedExpectedSalary ?? expectedSalary;
      setContractRenewalNegotiation({
        teamId: input.teamId,
        playerId: input.playerId,
        playerName: input.playerName,
        contractLength: startLength,
        offeredSalary: startOffer,
        expectedSalary,
        confirmToken: previewPayload.summary.confirmToken,
        contractShape: "balanced",
        currentSalary: rosterEntry?.salary ?? null,
        currentLength: rosterEntry?.contractLength ?? null,
        currentShape: rosterEntry?.contractShape ?? null,
        initialPreview: previewPayload.summary,
      });
    } catch {
      setContractRenewalError(`${input.playerName}: Verhandlungsvorschau konnte nicht geladen werden.`);
    } finally {
      setContractRenewalBusy(null);
    }
  }

  /**
   * Bestätigt die Gehaltsverhandlung. `draft` trägt die im Fenster zuletzt
   * eingestellten Konditionen (Gehalt/Laufzeit/Form); ohne draft gelten die
   * beim Öffnen gespeicherten Werte. Der Apply-Pfad holt sich server-seitig
   * einen frischen confirmToken (Preview + Apply in `runContractRenewalAction`),
   * daher ist der Token aus dem Öffnen-Preview hier nicht stale-gefährdet.
   */
  async function confirmContractRenewalNegotiation(draft?: {
    contractLength?: number;
    offeredSalary?: number | null;
    contractShape?: ContractShape;
  }) {
    if (!contractRenewalNegotiation) {
      return;
    }
    const applied = await runContractRenewalAction({
      teamId: contractRenewalNegotiation.teamId,
      playerId: contractRenewalNegotiation.playerId,
      playerName: contractRenewalNegotiation.playerName,
      action: "renew",
      contractLength: draft?.contractLength ?? contractRenewalNegotiation.contractLength,
      offeredSalary:
        draft && "offeredSalary" in draft ? draft.offeredSalary ?? null : contractRenewalNegotiation.offeredSalary,
      contractShape: draft?.contractShape ?? contractRenewalNegotiation.contractShape ?? "balanced",
    });
    // Fenster bleibt bei Fehlschlag offen, damit der Gate-Grund (z. B.
    // Phase-Sperre bis Season-End) direkt im Verhandlungsfenster sichtbar ist.
    if (applied) {
      setContractRenewalNegotiation(null);
    }
  }

  async function chooseTeamSponsor(offerId: string) {
    if (!selectedTeam || readMeta.readOnly || readMeta.source === "prisma") {
      showReadOnlyNotice();
      return;
    }
    if (!canManageTeamId(selectedTeam.teamId)) {
      showTeamManagementLockedNotice(selectedTeam.name);
      return;
    }
    setSponsorChoiceBusy(offerId);
    setSponsorChoiceMessage(null);
    try {
      const response = await fetch("/api/sponsor/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          saveId: activeSaveId,
          teamId: selectedTeam.teamId,
          offerId,
          dryRun: false,
          source: readMeta.source,
        })),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string; summary?: { contract?: { name?: string } } };
      if (!response.ok || payload.error) {
        setSponsorChoiceMessage(payload.error ?? "Sponsor konnte nicht gewählt werden.");
        return;
      }
      setSponsorChoiceMessage(`${payload.summary?.contract?.name ?? "Sponsor"} für ${selectedTeam.shortCode} unterzeichnet.`);
      updateNewGameFlowStepStatus("choose_sponsor", "completed");
      await loadSave(activeSaveId);
      await reloadSeasonManagementOverview();
    } catch {
      setSponsorChoiceMessage("Sponsor konnte nicht gewählt werden.");
    } finally {
      setSponsorChoiceBusy(null);
    }
  }

  /**
   * Kreditaufnahme (Bank, Phase 1) — mirrors `chooseTeamSponsor`'s
   * fetch-then-`loadSave` pattern 1:1: POST the mutation, then refetch the
   * save so `gameState` (and everything derived from it, incl. the Credits
   * view model) reflects the new loan/cash immediately. Always the active
   * manager's own team (fog of war), never a `teamId` param.
   */
  async function originateLoanForActiveTeam(
    principal: number,
    termSeasons: number,
    lenderTeamId?: string | null,
    adminOverride?: boolean,
  ): Promise<{ ok: boolean; reason: string | null }> {
    if (!activeManagerTeamId || readMeta.readOnly || readMeta.source === "prisma") {
      showReadOnlyNotice();
      return { ok: false, reason: "not_available" };
    }
    if (!canManageTeamId(activeManagerTeamId)) {
      showTeamManagementLockedNotice();
      return { ok: false, reason: "not_available" };
    }
    try {
      const response = await fetch("/api/finance/loan/originate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          saveId: activeSaveId,
          seasonId: gameState.season.id,
          teamId: activeManagerTeamId,
          principal,
          termSeasons,
          // `null`/omitted selects the bank; a team id selects a team offer
          // (Phase 3 — see docs/design/kredit-system.md).
          lenderTeamId: lenderTeamId ?? null,
          adminOverride: adminOverride === true,
          source: readMeta.source,
        })),
      });
      const payload = (await response.json()) as { ok?: boolean; reason?: string | null };
      if (!response.ok || !payload.ok) {
        return { ok: false, reason: payload.reason ?? "loan_originate_failed" };
      }
      await loadSave(activeSaveId);
      return { ok: true, reason: null };
    } catch {
      return { ok: false, reason: "network_error" };
    }
  }

  /**
   * Vorab-Rückzahlung (vorzeitige Ablösung) — mirrors `originateLoanForActiveTeam`'s
   * fetch-then-`loadSave` pattern 1:1: POST the mutation, then refetch the
   * save so `gameState` reflects the freed-up cash/cleared loan immediately.
   * Always the active manager's own team (fog of war), never a `teamId` param.
   */
  async function repayLoanEarlyForActiveTeam(
    loanId: string,
    adminOverride?: boolean,
  ): Promise<{ ok: boolean; reason: string | null; payoff: number | null }> {
    if (!activeManagerTeamId || readMeta.readOnly || readMeta.source === "prisma") {
      showReadOnlyNotice();
      return { ok: false, reason: "not_available", payoff: null };
    }
    if (!canManageTeamId(activeManagerTeamId)) {
      showTeamManagementLockedNotice();
      return { ok: false, reason: "not_available", payoff: null };
    }
    try {
      const response = await fetch("/api/finance/loan/early-payoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          saveId: activeSaveId,
          seasonId: gameState.season.id,
          teamId: activeManagerTeamId,
          loanId,
          adminOverride: adminOverride === true,
          source: readMeta.source,
        })),
      });
      const payload = (await response.json()) as { ok?: boolean; reason?: string | null; payoff?: number | null };
      if (!response.ok || !payload.ok) {
        return { ok: false, reason: payload.reason ?? "loan_early_payoff_failed", payoff: payload.payoff ?? null };
      }
      await loadSave(activeSaveId);
      return { ok: true, reason: null, payoff: payload.payoff ?? null };
    } catch {
      return { ok: false, reason: "network_error", payoff: null };
    }
  }

  async function runContractRenewalAction(input: {
    teamId: string;
    playerId: string;
    playerName: string;
    action: "renew" | "release";
    contractLength?: number | null;
    offeredSalary?: number | null;
    contractShape?: ContractShape;
  }): Promise<boolean> {
    if (readMeta.readOnly || readMeta.source === "prisma") {
      showReadOnlyNotice();
      return false;
    }
    if (!canManageTeamId(input.teamId)) {
      setContractRenewalError(`${getTeamLockedName(input.teamId)} gehört nicht zu deinen steuerbaren Teams. Vertragsaktionen sind gesperrt.`);
      showTeamManagementLockedNotice(getTeamLockedName(input.teamId));
      return false;
    }

    const busyKey = `${input.action}:${input.teamId}:${input.playerId}`;
    setContractRenewalBusy(busyKey);
    setContractRenewalError(null);
    setContractRenewalMessage(null);

    try {
      const previewResponse = await fetch("/api/contracts/renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          saveId: activeSaveId,
          teamId: input.teamId,
          playerId: input.playerId,
          action: input.action,
          contractLength: input.contractLength,
          offeredSalary: input.offeredSalary,
          contractShape: input.contractShape,
          dryRun: true,
          source: readMeta.source,
        })),
      });
      const previewPayload = (await previewResponse.json()) as ContractRenewalApiResponse;
      if (!previewResponse.ok || previewPayload.error || !previewPayload.summary?.confirmToken) {
        setContractRenewalError(
          previewPayload.error ??
            previewPayload.summary?.blockingReasons?.[0] ??
            `${input.playerName}: Vertragsvorschau blockiert.`,
        );
        return false;
      }

      const applyResponse = await fetch("/api/contracts/renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          saveId: activeSaveId,
          teamId: input.teamId,
          playerId: input.playerId,
          action: input.action,
          contractLength: input.contractLength,
          offeredSalary: input.offeredSalary ?? previewPayload.summary.negotiationPreview?.expectedSalary ?? null,
          contractShape: input.contractShape,
          dryRun: false,
          confirmToken: previewPayload.summary.confirmToken,
          source: readMeta.source,
        })),
      });
      const applyPayload = (await applyResponse.json()) as ContractRenewalApiResponse;
      if (!applyResponse.ok || applyPayload.error || !applyPayload.summary?.applied) {
        setContractRenewalError(
          applyPayload.error ??
            applyPayload.summary?.blockingReasons?.[0] ??
            `${input.playerName}: Vertragsaktion blockiert.`,
        );
        return false;
      }

      setContractRenewalMessage(
        input.action === "renew"
          ? `${input.playerName} wurde verlängert.`
          : `${input.playerName} wurde freigegeben.`,
      );
      setFoundationActionFeedback({
        tone: "success",
        title: input.action === "renew" ? "Vertrag verlängert" : "Spieler freigegeben",
        detail:
          input.action === "renew"
            ? `${input.playerName}: neuer Vertrag ist gespeichert. Gehalt und Laufzeit sind im Team-Dossier aktualisiert.`
            : `${input.playerName}: Kaderplatz und Gehaltsdruck wurden aktualisiert.`,
      });
      await Promise.all([
        loadSave(activeSaveId),
        reloadMarketFeed(input.teamId),
        reloadHistoryFeed(),
        reloadSeasonManagementOverview(),
      ]);
      setMarketReloadToken((current) => current + 1);
      return true;
    } catch {
      setContractRenewalError(`${input.playerName}: Vertragsaktion konnte nicht ausgeführt werden.`);
      return false;
    } finally {
      setContractRenewalBusy(null);
    }
  }

  function applyNewGamePreset(presetId: NewGamePresetId) {
    const preset = NEW_GAME_PRESET_DEFAULTS[presetId];
    setNewGamePresetId(presetId);
    setNewGameChrisTeamIds(preset.chrisTeamIds);
    setNewGameFrankyTeamIds(preset.frankyTeamIds);
    setNewGamePreview(null);
    setNewGameError(null);
    setNewGameSuccess(null);
  }

  function setNewGameSoloTeam(teamId: string) {
    setNewGameChrisTeamIds([teamId]);
    setNewGameFrankyTeamIds([]);
    setNewGamePreview(null);
    setNewGameError(null);
    setNewGameSuccess(null);
  }

  function toggleNewGameTeam(owner: "chris" | "franky", teamId: string) {
    const limits = getGameModeOwnershipLimits(newGamePresetId);
    setNewGamePreview(null);
    setNewGameError(null);
    setNewGameSuccess(null);
    if (owner === "chris") {
      setNewGameChrisTeamIds((current) =>
        current.includes(teamId)
          ? current.filter((entry) => entry !== teamId)
          : limits.chrisMax === 1
            ? [teamId]
            : current.length >= limits.chrisMax
              ? current
              : [...current.filter((entry) => entry !== teamId), teamId].filter(
                  (entry) => !newGameFrankyTeamIds.includes(entry),
                ),
      );
      return;
    }

    setNewGameFrankyTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((entry) => entry !== teamId)
        : current.length >= limits.frankyMax
          ? current
          : [...current.filter((entry) => entry !== teamId), teamId].filter((entry) => !newGameChrisTeamIds.includes(entry)),
    );
  }

  async function runNewGameSetup(dryRun: boolean) {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    if (!dryRun && (!newGamePreview || newGamePreview.blockers.length > 0)) {
      setNewGameError("Bitte erst ein gültiges New-Game-Setup prüfen.");
      return;
    }

    if (!dryRun) {
      const confirmed = window.confirm(
        "Neuen lokalen Spielstand erstellen und aktivieren? Der aktuelle Save bleibt erhalten, aber die App wechselt danach auf den neuen Save.",
      );
      if (!confirmed) {
        return;
      }
    }

    setNewGameBusy(true);
    setNewGameError(null);
    setNewGameSuccess(null);

    try {
      const response = await fetch("/api/new-game", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          presetId: newGamePresetId,
          chrisTeamIds: newGameChrisTeamIds,
          frankyTeamIds: newGameFrankyTeamIds,
          sandbox: newGameSandbox,
          saveName: newGameSaveName.trim() || undefined,
          dryRun,
          confirmToken: dryRun ? null : newGamePreview?.confirmToken,
        }),
      });
      const payload = (await response.json()) as NewGameSetupApiResponse;
      if (!response.ok || payload.error) {
        setNewGameError(payload.error ?? "New-Game-Setup konnte nicht ausgeführt werden.");
        return;
      }

      if (dryRun && payload.preview) {
        setNewGamePreview(payload.preview);
        return;
      }

      if (payload.result?.save.saveId) {
        const newSaveId = payload.result.save.saveId;
        clearSaveScopedFeeds();
        const nextSaveMode = normalizeFoundationSaveMode(payload.result.preview.presetId);
        setFoundationSaveMode(nextSaveMode);
        await loadSave(newSaveId, nextSaveMode);
        // The new save is now active, so the "Neues Spiel"-intent that suppressed
        // the PREVIOUS save's season briefing must end here — otherwise the intent
        // refs stay latched for the whole session (they are never reset elsewhere)
        // and leak onto the fresh save, permanently suppressing ITS season intro.
        newGameIntentRef.current = false;
        newGameIntentBaselineSaveIdRef.current = null;
        // Pin the freshly created + activated save into the URL so a reload,
        // new tab, or the homepage "Solo spielen" link loads exactly this
        // save instead of falling back to the global active save row.
        syncFoundationSaveIdInUrl(newSaveId);
        const firstTeamId = payload.result.preview.chrisTeamIds[0] ?? payload.result.preview.frankyTeamIds[0] ?? null;
        if (firstTeamId) {
          // Scope the active-team preference to the NEW save id explicitly: the
          // `activeSaveId` in this closure is still the previous save's id, so
          // without the override the new team would be persisted under the old
          // save and the previous save's team (e.g. P-S) could resurface.
          setActiveManagerTeam(firstTeamId, "manual_select", newSaveId);
        }
        setNewGamePreview(payload.result.preview);
        setNewGameSuccess(`Neuer Spielstand aktiv: ${payload.result.save.name}`);
        setActiveView("home");
        syncFoundationViewInUrl("home");
        openSeasonBriefingPanel();
      }
    } catch {
      setNewGameError("New-Game-Setup konnte nicht geladen werden.");
    } finally {
      setNewGameBusy(false);
    }
  }

  const {
    resolvedTeamControlSettings,
    resolvedTeamStrategyProfiles,
    aiTeams,
    aiLineupApplyTeams,
    aiLineupEnsureTeams,
    aiMarketEnabledTeams,
    aiMarketDisabledTeams,
    manualTeams,
    passiveTeams,
    activeSaveGameMode,
    gameModeOwnershipLimits,
    savedGameModeOwnership,
    gameModeOwnershipDraftChanged,
    currentSaveOwnership,
    teamOwners,
    activeOwner,
    effectiveActiveOwnerId,
    managerTeamOptions,
    localUserManualTeams,
    ownerQuickSwitchTeams,
    foundationManageableTeamIds,
  } = useFoundationCrossTabTeamControl({
    gameState,
    activeOwnerId,
    teamContextFilter,
    gameModeOwnershipChrisIds,
    gameModeOwnershipFrankyIds,
  });

  // Bulk-Nachpicken (Ranks-Überblick): alle KI-geführten Teams (controlMode ===
  // "ai" — menschlich geführte Teams sind über `aiTeams` bereits ausgeschlossen),
  // deren aktueller Kader unter dem Kader-Minimum liegt. Kader-Zählung wie im Rest
  // des Shells (`gameState.rosters` je teamId), Minimum via `deriveRosterTargets`.
  const underFilledAiTeamIds = useMemo(() => {
    const rosterCountByTeamId = new Map<string, number>();
    for (const entry of gameState.rosters) {
      rosterCountByTeamId.set(entry.teamId, (rosterCountByTeamId.get(entry.teamId) ?? 0) + 1);
    }
    return aiTeams
      .filter((team) => {
        const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
        const { playerMin } = deriveRosterTargets(team, identity);
        return (rosterCountByTeamId.get(team.teamId) ?? 0) < playerMin;
      })
      .map((team) => team.teamId);
  }, [aiTeams, gameState.rosters, gameState.teamIdentities]);

  // Ein Klick → picks-run für alle unterbesetzten KI-Teams auf einmal. Nutzt
  // denselben scoped picks-run-Endpoint + dieselbe Reload-Kette wie das Einzel-
  // Nachpicken (`runTeamPicksRefill`); scope "all" + teamIds + allowSetupAllTeams
  // begrenzt den Lauf auf genau diese Teams.
  const [bulkAiPicksRefillBusy, setBulkAiPicksRefillBusy] = useState(false);
  const [bulkAiPicksRefillMessage, setBulkAiPicksRefillMessage] = useState<
    { tone: "success" | "error"; text: string } | null
  >(null);
  // Live-Draft-Fortschritt: {done, total} während "KI-Teams picken" läuft, sonst null.
  // Getrieben durch die team-granulare Schleife unten (statt einem Batch-Call), damit
  // man den Draft oben in der Rang-Tabelle live mitverfolgen kann.
  const [bulkAiPicksProgress, setBulkAiPicksProgress] = useState<{ done: number; total: number } | null>(null);

  const runBulkAiTeamsRefill = useCallback(async () => {
    if (readMeta.readOnly || readMeta.source === "prisma") {
      showReadOnlyNotice();
      return;
    }
    if (bulkAiPicksRefillBusy) {
      return;
    }
    const teamIds = underFilledAiTeamIds;
    if (teamIds.length === 0) {
      setBulkAiPicksRefillMessage({ tone: "error", text: "Alle KI-Teams sind gefüllt." });
      return;
    }

    setBulkAiPicksRefillBusy(true);
    setBulkAiPicksRefillMessage(null);
    setBulkAiPicksProgress({ done: 0, total: teamIds.length });
    let filledTeams = 0;
    let hadError = false;
    const blockersAll: string[] = [];
    try {
      // Team-granular statt Batch: pro KI-Team ein eigener picks-run, damit der
      // Fortschritt (X/Y Teams) LIVE hochzählt. Server-Semantik bleibt gleich; jeder
      // Lauf persistiert, der nächste sieht den bereits geschrumpften Free-Agent-Pool.
      for (let index = 0; index < teamIds.length; index += 1) {
        const teamId = teamIds[index]!;
        try {
          const response = await fetch(`/api/ai/picks-run?${buildCockpitScopeParams().toString()}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              withRoomContextBody(
                {
                  dryRun: false,
                  confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
                  teamScope: "all",
                  teamIds: [teamId],
                  allowSetupAllTeams: true,
                },
                roomContext,
              ),
            ),
          });
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            executed?: boolean;
            blockingReasons?: string[];
            teams?: Array<{ teamId: string; rosterBefore?: number; rosterAfter?: number }>;
          };
          if (!response.ok || payload.error) {
            hadError = true;
            if (payload.error) blockersAll.push(payload.error);
          } else if (payload.executed === true) {
            // Nur zählen, wenn die Picks TATSÄCHLICH angewendet+persistiert wurden. `rosterAfter` ist der
            // GEPLANTE Kader (auch bei geblockten Teams befüllt), executed=false ⇒ nichts persistiert —
            // die alte rosterAfter>rosterBefore-Heuristik zählte geblockte Teams fälschlich als aufgefüllt.
            filledTeams += 1;
          } else if (payload.blockingReasons?.length) {
            blockersAll.push(...payload.blockingReasons);
          }
        } catch {
          hadError = true;
        }
        setBulkAiPicksProgress({ done: index + 1, total: teamIds.length });
      }

      if (filledTeams > 0) {
        setBulkAiPicksRefillMessage({
          tone: "success",
          text: `${filledTeams} KI-${filledTeams === 1 ? "Team" : "Teams"} aufgefüllt.`,
        });
      } else {
        setBulkAiPicksRefillMessage({
          tone: "error",
          text: hadError
            ? "KI-Picks konnten nicht (vollständig) angewendet werden."
            : blockersAll.length > 0
              ? Array.from(new Set(blockersAll)).slice(0, 3).join(" · ")
              : "Keine neuen Picks angewendet (kein passender Spieler oder Budget).",
        });
      }
      // Nur EINMAL am Ende neu laden (nicht pro Team) → kein N-facher Full-Reload.
      await reloadAfterMarketRosterApply();
    } finally {
      setBulkAiPicksRefillBusy(false);
      setBulkAiPicksProgress(null);
    }
  }, [
    buildCockpitScopeParams,
    bulkAiPicksRefillBusy,
    readMeta.readOnly,
    readMeta.source,
    reloadAfterMarketRosterApply,
    roomContext,
    showReadOnlyNotice,
    underFilledAiTeamIds,
  ]);

  useEffect(() => {
    if (activeView !== "playerProfile" || playerProfileTab !== "contract" || !playerProfileData?.playerId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const { buildPlayerDrawerDataFromGameState } = await import("@/lib/foundation/player-detail-drawer");
      const { hydrateGameStatePlayerAttributeSheet } = await import("@/lib/foundation/hydrate-player-attribute-sheet");
      const hydratedGameState = await hydrateGameStatePlayerAttributeSheet({
        gameState: gameStateRef.current,
        saveId: activeSaveId,
        playerId: playerProfileData.playerId,
      });
      if (cancelled) {
        return;
      }
      const refreshedProfile = buildPlayerDrawerDataFromGameState({
        gameState: hydratedGameState,
        playerId: playerProfileData.playerId,
        source: readMeta.source,
        manageableTeamIds: foundationManageableTeamIds,
        saveId: activeSaveId,
      });
      if (cancelled || !refreshedProfile) {
        return;
      }
      setPlayerProfileData(refreshedProfile);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeSaveId,
    activeView,
    foundationManageableTeamIds,
    playerProfileData?.playerId,
    playerProfileTab,
    readMeta.source,
  ]);

  useEffect(() => {
    const snapshots = gameState.seasonState.seasonSnapshots;
    if (snapshots === undefined) {
      return;
    }

    const signature = snapshots.map((snapshot) => snapshot.seasonId).join("|");
    if (loadedSeasonArchiveSignatureRef.current === signature) {
      return;
    }
    loadedSeasonArchiveSignatureRef.current = signature;

    const profilePlayerId = playerProfileDataRef.current?.playerId ?? null;
    if (!profilePlayerId) {
      return;
    }

    void import("@/lib/foundation/player-detail-drawer").then(({ buildPlayerDrawerDataFromGameState }) => {
      const refreshedProfile = buildPlayerDrawerDataFromGameState({
        gameState: gameStateRef.current,
        playerId: profilePlayerId,
        source: readMeta.source,
        manageableTeamIds: foundationManageableTeamIds,
      });
      if (!refreshedProfile) {
        return;
      }
      setPlayerProfileData(refreshedProfile);
      playerProfileHydrationAttemptRef.current = buildPlayerProfileHydrationSuccessKey(
        gameStateRef.current.season.id,
        profilePlayerId,
      );
    });
  }, [
    foundationManageableTeamIds,
    gameState.seasonState.seasonSnapshots,
    readMeta.source,
  ]);

  const managementViews = useMemo(
    () => new Set<FoundationView>(["lineup", "market", "marketV2", "training", "trainingCompact", "trainingV2", "teamSettings"]),
    [],
  );

  useEffect(() => {
    persistFoundationActiveOwnerId(activeOwner?.ownerId ?? DEFAULT_ACTIVE_OWNER_ID);
  }, [activeOwner?.ownerId]);

  useEffect(() => {
    persistFoundationTeamFilter(teamContextFilter);
  }, [teamContextFilter]);

  useEffect(() => {
    if (!gameState.teams.length || teamContextFilter === "all") {
      return;
    }

    if (managerTeamOptions.some((team) => team.teamId === selectedTeamId)) {
      return;
    }

    const nextTeam = managerTeamOptions[0];
    if (!nextTeam) {
      return;
    }

    setActiveManagerTeam(nextTeam.teamId, "saved_preference");
    setActiveManagerTeamWarning("Aktives Team passte nicht mehr zum aktuellen Owner-/Teamfilter und wurde neu gesetzt.");
  }, [gameState.teams.length, managerTeamOptions, selectedTeamId, teamContextFilter]);

  const activeManagerTeamId = selectedTeamId;
  const selectedTeam = useMemo(
    () => gameState.teams.find((team) => team.teamId === activeManagerTeamId) ?? gameState.teams[0] ?? null,
    [activeManagerTeamId, gameState.teams],
  );
  const readSourceLabel = readMeta.source === "prisma" ? "Referenzmodus" : "Lokaler Spielstand";
  const selectedTeamControl = useMemo(
    () => (selectedTeam ? getTeamControlSettings(gameState, selectedTeam.teamId) : null),
    [gameState, selectedTeam],
  );
  const isLocalUserManualTeam = (settings: TeamControlSettings | null | undefined) =>
    Boolean(
      settings &&
        settings.controlMode === "manual" &&
        (settings.ownerId === DEFAULT_ACTIVE_OWNER_ID || settings.ownerSlot === "user" || settings.displayLabel === "Chris"),
    );
  const selectedTeamCanManage = resolveFoundationTeamCanManage(
    canOwnerManageTeam(selectedTeamControl, effectiveActiveOwnerId) || isLocalUserManualTeam(selectedTeamControl),
  );
  const isSelectedTeamManagementLocked = Boolean(selectedTeam) && !selectedTeamCanManage;
  function canManageTeamId(teamId: string | null | undefined) {
    if (!teamId) {
      return false;
    }
    const settings = getTeamControlSettings(gameState, teamId);
    return resolveFoundationTeamCanManage(
      canOwnerManageTeam(settings, effectiveActiveOwnerId) || isLocalUserManualTeam(settings),
    );
  }

  const playerProfileTrainingReadOnly =
    readMeta.readOnly ||
    !playerProfileData?.teamId ||
    !canManageTeamId(playerProfileData.teamId);

  function getTeamLockedName(teamId: string | null | undefined) {
    return gameState.teams.find((team) => team.teamId === teamId)?.name ?? selectedTeam?.name ?? "dieses Team";
  }
  useEffect(() => {
    if (readMeta.readOnly || !selectedTeam || !isSelectedTeamManagementLocked || !managementViews.has(activeView)) {
      return;
    }
    const fallbackTeam = ownerQuickSwitchTeams.find((team) => canManageTeamId(team.teamId)) ?? null;
    if (!fallbackTeam || fallbackTeam.teamId === selectedTeam.teamId) {
      return;
    }
    setActiveManagerTeam(fallbackTeam.teamId, "saved_preference");
    setActiveManagerTeamWarning(
      `${selectedTeam.name} war hier nur Ansicht. Für ${activeView === "trainingV2" || activeView === "trainingCompact" || activeView === "training" ? "Training oder Gebäude" : "diese Management-Ansicht"} wurde auf ${fallbackTeam.name} gewechselt.`,
    );
  }, [
    activeView,
    readMeta.readOnly,
    isSelectedTeamManagementLocked,
    managementViews,
    ownerQuickSwitchTeams,
    selectedTeam,
  ]);
  const selectedTeamStrategyProfile = useMemo(
    () => (selectedTeam ? getTeamStrategyProfile(gameState, selectedTeam.teamId) : null),
    [gameState, selectedTeam],
  );
  const activeSaveSummary = useMemo(
    () => saveSummaries.find((save) => save.saveId === activeSaveId) ?? null,
    [activeSaveId, saveSummaries],
  );
  const activeSaveIsInCurrentMode = useMemo(
    () => saveSummaries.some((save) => save.saveId === activeSaveId),
    [activeSaveId, saveSummaries],
  );
  const activeContextMeta = useMemo(
    () => activeSaveSummary?.scenarioMeta ?? gameState.scenarioMeta ?? null,
    [activeSaveSummary, gameState.scenarioMeta],
  );
  const activeSaveTypeLabel = useMemo(
    () =>
      inferSaveTypeLabel({
        saveName: activeSaveSummary?.name ?? activeSaveName,
        saveStatus: activeSaveSummary?.status ?? "active",
      }),
    [activeSaveName, activeSaveSummary],
  );
  const activeScenarioWarning = useMemo(
    () => buildScenarioWarning(activeContextMeta),
    [activeContextMeta],
  );
  const activeContextStatusChips = useMemo(
    () => buildContextStatusChips(activeContextMeta),
    [activeContextMeta],
  );
  const activeViewContextWarning = useMemo(
    () => buildViewContextWarning(activeView, activeContextMeta, gameState.gamePhase ?? "season_active"),
    [activeContextMeta, activeView, gameState.gamePhase],
  );
  const activeViewSourceBadge = useMemo(
    () => getViewSourceBadgeLabel(activeView, activeContextMeta),
    [activeContextMeta, activeView],
  );
  const activeSaveLooksLikeDryRunSmoke = useMemo(() => {
    const normalized = `${activeSaveSummary?.name ?? activeSaveName}`.toLowerCase();
    return normalized.includes("dryrun smoke") || normalized.includes("dry-run smoke") || normalized.includes("whole season dryrun smoke");
  }, [activeSaveName, activeSaveSummary]);
  const currentMatchdayDisplayLabel = useMemo(() => {
    if (typeof gameState.season.currentMatchday === "number" && Number.isFinite(gameState.season.currentMatchday)) {
      return `Spieltag ${gameState.season.currentMatchday}`;
    }
    // Fallback: never surface the raw slug (e.g. "matchday-1") as a user-facing
    // label — extract the trailing number so it still reads "Spieltag N".
    const matchdayId = gameState.matchdayState.matchdayId;
    const slugNumber = matchdayId.match(/(\d+)\s*$/);
    return slugNumber ? `Spieltag ${slugNumber[1]}` : matchdayId;
  }, [gameState.matchdayState.matchdayId, gameState.season.currentMatchday]);
  const {
    gameFlowState,
    gameInboxItems,
    activeTeamInboxItems,
    activeTeamOpenInboxItems,
    activeTeamDecisionInboxItems,
    activeTeamChronicleInboxItems,
    activeTeamDecisionCriticalInboxItems,
    foundationNavAttention,
    focusMatchdayLoop,
    inboxPrimaryTeamItem,
    gameFlowActionStep,
    matchdayArenaReadiness,
    matchdayArenaBlockerSummary,
    transferWindowHint,
    flowOverrideInboxItem,
    primaryInboxItem,
    foundationWarningInboxItems,
    acknowledgedFlowStepIds,
    setAcknowledgedFlowStepIds,
    acknowledgeFlowStep,
  } = useFoundationCrossTabGameFlow({
    activeView,
    homeV2Tab,
    inboxGameState,
    gameState,
    activeSaveId,
    activeManagerTeamId,
    effectiveActiveOwnerId,
    teamContextFilter,
    selectedTeamCanManage,
    activeContextMeta,
    activeViewContextWarning,
    activeManagerTeamWarning,
    resolvePreviewFeed,
    shouldBuildGameInbox,
  });
  const activeTeamCriticalInboxItems = activeTeamDecisionCriticalInboxItems;
  const activeManagerMatchdayReady = matchdayArenaBlockerSummary.isArenaReady;
  const activeManagerArenaBlockerReason = matchdayArenaBlockerSummary.primaryReason as typeof matchdayArenaReadiness.blocker;
  const activeManagerArenaGapDetail = matchdayArenaBlockerSummary.detail;
  const resolveLineupIssueTeamId = (preferredTeamId?: string | null) =>
    resolveFoundationLineupIssueTeamId({
      gameState,
      resolvePreviewFeed,
      managerTeamOptions,
      resolvedTeamControlSettings,
      preferredTeamId,
    });
  const navigateToGameFlowStep = (targetView: GameFlowView, teamId?: string | null, targetPanel?: string | null) => {
    if (targetView === "hq") {
      navigateHomeTab("office");
      setShowGameFlowPanel(false);
      return;
    }
    const navigationTeamId = targetView === "lineup" ? resolveLineupIssueTeamId(teamId) : teamId;
    if (navigationTeamId && navigationTeamId !== activeManagerTeamId) {
      setActiveManagerTeam(navigationTeamId, "manual_select");
    }
    if (targetView === "lineup") {
      setLineupFocusRequestKey(`lineup-${navigationTeamId ?? activeManagerTeamId ?? "team"}-${Date.now()}`);
      if (targetPanel === "form-board") {
        setLineupDraftBoardViewRequest("formBoard");
      }
    }
    if (targetPanel === "season-briefing") {
      setFoundationView("homeV2", setActiveView);
      setShowGameFlowPanel(false);
      openSeasonBriefingPanel();
      scrollToFoundationTarget("foundation-home");
      return;
    }
    if (targetPanel === "captain-picker") {
      // Kapitänswahl ist jetzt im Kader-Tab eingebettet (wie die AI-Teams).
      setSelectedTeamDetailTab("roster");
      setFoundationView(resolveFoundationViewTarget("teams"), setActiveView);
      setShowGameFlowPanel(false);
      scrollToFoundationTarget("foundation-teams-captain-picker");
      return;
    }
    if (targetPanel === "sponsor-choice") {
      openPrizeFinanceView({ tab: "sponsors", push: false });
      setShowGameFlowPanel(false);
      return;
    }
    if (targetView === "teams") {
      if (targetPanel === "contracts") {
        setSelectedTeamDetailTab("contracts");
      } else {
        setSelectedTeamDetailTab("roster");
      }
    }
    const resolvedView = resolveFoundationViewTarget(targetView as FoundationView);
    if (resolvedView === "marketV2") {
      setMarketFocusPlayerId(null);
    }
    if (resolvedView === "prize") {
      navigateToPrizeFinanceViewFromRouting(targetPanel, false);
      setShowGameFlowPanel(false);
      return;
    }
    setFoundationView(resolvedView, setActiveView);
    setShowGameFlowPanel(false);
    scrollToFoundationTarget(
      resolveFoundationPanelScrollTarget({
        targetView: resolvedView,
        panel: targetPanel,
      }),
    );
  };
  // Friction fix (Generalprobe #2): "Dein Team wählen" lives under Team-Settings
  // → "Spielmodus & KI", not the default tab, and nothing routed a fresh player
  // there. Deep-links straight into that sub-tab via `?view=teamSettings&tab=control`
  // (read on mount by FoundationTeamSettingsNewLook), used by the HQ CTA below.
  const navigateToTeamPicker = () => {
    setFoundationView("teamSettings", setActiveView, { push: true });
    syncFoundationViewInUrl("teamSettings", "control", null, { push: false });
  };
  const updateNewGameFlowStepStatus = (stepId: NewGameFlowStepId, status: NewGameFlowStepStatus) => {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    const now = new Date().toISOString();
    skipNextFullPersistCountRef.current += 1;
    void persistNewGameFlowStepStatus(stepId, status).catch((error) => {
      console.error(error);
      skipNextFullPersistCountRef.current = Math.max(0, skipNextFullPersistCountRef.current - 1);
    });
    setGameState((current) => {
      const previous = current.seasonState.newGameFlow ?? {
        active: true,
        selectedTeamId,
        steps: [],
      };
      const nextSteps = SEASON_SETUP_STEP_IDS.map((id) => {
        const stored = previous.steps?.find((step) => step.stepId === id);
        if (id !== stepId) {
          return stored ?? { stepId: id, status: "open" as const };
        }

        return {
          stepId: id,
          status,
          completedAt: status === "completed" ? now : stored?.completedAt ?? null,
          skippedAt: status === "skipped" ? now : stored?.skippedAt ?? null,
        };
      });
      const isHandled = nextSteps.every((step) => step.status === "completed" || step.status === "skipped");

      return {
        ...current,
        seasonState: {
          ...current.seasonState,
          newGameFlow: {
            ...previous,
            active: true,
            dismissed: false,
            selectedTeamId: selectedTeamId ?? previous.selectedTeamId ?? null,
            steps: nextSteps,
            updatedAt: now,
            completedAt: isHandled ? previous.completedAt ?? now : previous.completedAt ?? null,
          },
        },
      };
    });
  };
  useEffect(() => {
    const flow = gameState.seasonState.newGameFlow;
    const selectedFlowTeamId = resolveFoundationTeamId(
      gameState.teams,
      flow?.selectedTeamId ?? selectedTeamId ?? activeManagerTeamId,
    );
    const teamConfirmStatus = flow?.steps?.find((step) => step.stepId === "team_confirm")?.status ?? "open";
    if (
      readMeta.source !== "sqlite" ||
      readMeta.readOnly ||
      !flow?.active ||
      !selectedFlowTeamId ||
      teamConfirmStatus !== "open"
    ) {
      return;
    }

    updateNewGameFlowStepStatus("team_confirm", "completed");
  }, [
    activeManagerTeamId,
    gameState.seasonState.newGameFlow,
    gameState.teams,
    readMeta.readOnly,
    readMeta.source,
    selectedTeamId,
  ]);
  useEffect(() => {
    const flow = gameState.seasonState.newGameFlow;
    const trainingStepStatus = flow?.steps?.find((step) => step.stepId === "training_facilities")?.status ?? "open";
    const selectedTeamRosterIds = new Set(
      gameState.rosters.filter((entry) => entry.teamId === activeManagerTeamId).map((entry) => entry.playerId),
    );
    const anyPlayerHasTrainingMode = gameState.players.some(
      (player) => selectedTeamRosterIds.has(player.id) && player.trainingMode != null,
    );
    if (
      readMeta.source !== "sqlite" ||
      readMeta.readOnly ||
      !flow?.active ||
      trainingStepStatus !== "open" ||
      (activeView !== "trainingV2" && activeView !== "trainingCompact" && activeView !== "training") ||
      !anyPlayerHasTrainingMode
    ) {
      return;
    }

    updateNewGameFlowStepStatus("training_facilities", "completed");
  }, [
    activeManagerTeamId,
    activeView,
    gameState.players,
    gameState.rosters,
    gameState.seasonState.newGameFlow,
    readMeta.readOnly,
    readMeta.source,
  ]);
  useEffect(() => {
    const flow = gameState.seasonState.newGameFlow;
    if (readMeta.source !== "sqlite" || readMeta.readOnly || !flow?.active || flow.dismissed || !activeManagerTeamId) {
      return;
    }

    const storedStatusById = new Map((flow.steps ?? []).map((step) => [step.stepId, step.status] as const));
    const rosterCount = gameState.rosters.filter((entry) => entry.teamId === activeManagerTeamId).length;
    const targetRosterCount = Math.max(
      10,
      Math.min(12, gameState.teams.find((team) => team.teamId === activeManagerTeamId)?.rosterLimit ?? 12),
    );
    const hasTransfers = gameState.transferHistory.some(
      (transfer) =>
        transfer.seasonId === gameState.season.id &&
        (transfer.toTeamId === activeManagerTeamId || transfer.fromTeamId === activeManagerTeamId),
    );

    if (storedStatusById.get("roster_review") === "open" && rosterCount > 0) {
      updateNewGameFlowStepStatus("roster_review", "completed");
    }
    if (storedStatusById.get("first_transfers") === "open" && hasTransfers) {
      updateNewGameFlowStepStatus("first_transfers", "completed");
    }
    if (storedStatusById.get("fill_roster") === "open" && rosterCount >= targetRosterCount) {
      updateNewGameFlowStepStatus("fill_roster", "completed");
    }
  }, [
    activeManagerTeamId,
    gameState.rosters,
    gameState.season.id,
    gameState.seasonState.newGameFlow,
    gameState.transferHistory,
    gameState.teams,
    readMeta.readOnly,
    readMeta.source,
  ]);
  const dismissNewGameFlow = () => {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    const now = new Date().toISOString();
    setGameState((current) => ({
      ...current,
      seasonState: {
        ...current.seasonState,
        newGameFlow: {
          ...(current.seasonState.newGameFlow ?? { steps: [] }),
          active: false,
          dismissed: true,
          selectedTeamId: selectedTeamId ?? current.seasonState.newGameFlow?.selectedTeamId ?? null,
          updatedAt: now,
        },
      },
    }));
  };
  const navigateSeasonSetupStep = (stepId: NewGameFlowStepId) => {
    const targetTeamId =
      resolveFoundationTeamId(gameState.teams, gameState.seasonState.newGameFlow?.selectedTeamId ?? selectedTeamId ?? activeManagerTeamId) ??
      activeManagerTeamId;
    if (targetTeamId && targetTeamId !== activeManagerTeamId) {
      setActiveManagerTeam(targetTeamId, "manual_select");
    }

    if (stepId === "season_intro") {
      const briefingKey = buildSeasonBriefingDismissKey(activeSaveId, gameState.season.id);
      seasonBriefingDismissedRef.current.delete(briefingKey);
      clearSeasonBriefingDismissedFromStorage(activeSaveId, gameState.season.id);
      seasonBriefingAutoOpenedRef.current = null;
      setFoundationView("homeV2", setActiveView);
      openSeasonBriefingPanel();
      scrollToFoundationTarget("foundation-home");
      return;
    }

    if (stepId === "team_confirm") {
      setFoundationView("homeV2", setActiveView);
      scrollToFoundationTarget("foundation-home");
      return;
    }

    if (stepId === "roster_review") {
      setSelectedTeamDetailTab("roster");
      setFoundationView("teams", setActiveView);
      scrollToFoundationTarget("team-focus-roster");
      return;
    }

    if (stepId === "appoint_captain") {
      // Kapitänswahl ist jetzt im Kader-Tab eingebettet (wie die AI-Teams).
      setSelectedTeamDetailTab("roster");
      setFoundationView("teams", setActiveView);
      scrollToFoundationTarget("foundation-teams-captain-picker");
      return;
    }

    if (stepId === "first_transfers" || stepId === "fill_roster") {
      const targetTeam = gameState.teams.find((team) => team.teamId === targetTeamId) ?? selectedTeam;
      const cashBudget = Math.max(12, Math.min(150, Math.floor(((targetTeam?.cash ?? 40) * 0.65))));
      setMarketTeamId(targetTeamId);
      setMarketSearch("");
      setMarketClassFilter("ALL");
      setMarketRaceFilter("ALL");
      setMarketSubclassFilter("ALL");
      setMarketAlignmentFilter("ALL");
      setMarketGenderFilter("ALL");
      setMarketPositiveTraitFilter("ALL");
      setMarketNegativeTraitFilter("ALL");
      setMarketBracketFilter("ALL");
      setMarketMaxValue(cashBudget);
      marketValueFilterManualRef.current = true;
      setMarketMaxSalary(40);
      setMarketMinRatio(stepId === "first_transfers" ? 3 : 2);
      setMarketMinPow(1);
      setMarketMinSpe(1);
      setMarketMinMen(1);
      setMarketMinSoc(1);
      setMarketShowAutoAnalysis(true);
      setFoundationView("marketV2", setActiveView);
      scrollToFoundationTarget("transfer-market");
      return;
    }

    if (stepId === "training_facilities") {
      setFoundationView("scoutingCenterV2", setActiveView);
      scrollToFoundationTarget("foundation-scouting-hub-v2");
      return;
    }

    if (stepId === "choose_sponsor") {
      openPrizeFinanceView({ tab: "sponsors" });
      return;
    }

    navigateToGameFlowStep("lineup", targetTeamId);
  };
  const navigateToInboxItem = (item: GameInboxItem) => {
    const targetView = normalizeInboxTargetView(item.targetView);
    const itemTeamId = item.teamId ?? (typeof item.targetParams.team === "string" ? item.targetParams.team : null);
    const navigationTeamId =
      targetView === "lineup" && (item.source === "lineup_drafts" || item.title.toLowerCase().includes("lineup"))
        ? resolveLineupIssueTeamId(itemTeamId)
        : itemTeamId;
    if (navigationTeamId && navigationTeamId !== activeManagerTeamId) {
      setActiveManagerTeam(navigationTeamId, "manual_select");
    }
    const panel = typeof item.targetParams.panel === "string" ? item.targetParams.panel : null;
    if (targetView === "lineup") {
      setLineupFocusRequestKey(`lineup-${navigationTeamId ?? activeManagerTeamId ?? "team"}-${Date.now()}`);
      if (panel === "form-board") {
        setLineupDraftBoardViewRequest("formBoard");
      }
    }
    const focusPlayerId =
      item.playerId ??
      (typeof item.targetParams.player === "string" ? item.targetParams.player : null);
    if (targetView === "teams") {
      if (panel === "contracts") {
        setSelectedTeamDetailTab("contracts");
      } else {
        setSelectedTeamDetailTab("roster");
      }
    }
    const resolvedView = resolveFoundationViewTarget(targetView);
    if (resolvedView === "marketV2" && focusPlayerId) {
      setMarketFocusPlayerId(focusPlayerId);
    } else if (resolvedView === "marketV2") {
      setMarketFocusPlayerId(null);
    }
    if (resolvedView === "prize") {
      navigateToPrizeFinanceViewFromRouting(panel, false);
      setShowGameFlowPanel(false);
      return;
    }
    setFoundationView(resolvedView, setActiveView);
    setShowGameFlowPanel(false);
    scrollToFoundationTarget(
      resolveFoundationPanelScrollTarget({
        targetView: resolvedView,
        panel,
      }),
    );
  };
  const updateInboxItemStatus = (item: GameInboxItem, status: GameInboxItem["status"]) => {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    const existingItems = gameState.gameInboxItems ?? [];
    const hasStoredItem = existingItems.some((entry) => entry.itemId === item.itemId);
    const nextItems = hasStoredItem
      ? existingItems.map((entry) => (entry.itemId === item.itemId ? { ...entry, status } : entry))
      : [...existingItems, { ...item, status }];
    const nextGameState = {
      ...gameState,
      gameInboxItems: nextItems,
    };

    setGameState(nextGameState);
    if (readMeta.source !== "prisma" && !readMeta.readOnly && activeSaveId !== "loading-save") {
      void persistLocalGameStateImmediately(nextGameState).catch((error) => {
        console.error(error);
      });
    }
  };
  const globalNextDisabled = primaryInboxItem
    ? false
    : gameFlowActionStep.status === "applying" || cockpitBusyKey != null || seasonTransitionBusy;
  const globalNextLabel = primaryInboxItem?.title ?? gameFlowActionStep.label;
  const globalNextTitle = primaryInboxItem
    ? `${primaryInboxItem.title}: ${primaryInboxItem.description}`
    : gameFlowActionStep.status === "blocked"
      ? formatGameFlowBlockerList(
          matchdayArenaBlockerSummary.reasons.length > 0
            ? matchdayArenaBlockerSummary.reasons
            : gameFlowActionStep.blockers,
        ) || "Leertaste: zum blockierten Schritt springen"
      : globalNextDisabled
        ? "Aktion läuft gerade."
        : gameFlowActionStep.status === "optional" &&
            (gameFlowActionStep.stepId === "matchday_facilities" || gameFlowActionStep.stepId === "facilities")
          ? "Leertaste: optional prüfen oder überspringen"
          : transferWindowHint.open
          ? `Leertaste: Weiter · ${transferWindowHint.label}`
          : "Leertaste: Weiter";
  const globalNextStatusClass = primaryInboxItem
    ? primaryInboxItem.severity === "critical"
      ? "is-blocked"
      : primaryInboxItem.severity === "warning"
        ? "is-warning"
        : "is-ready"
    : getGameFlowStatusClass(gameFlowActionStep.status);
  const triggerGlobalNext = async () => {
    if (activeView === "matchdayArena" && !activeManagerMatchdayReady) {
      const lineupInboxItem =
        primaryInboxItem?.itemId.startsWith("lineup_missing:") ? primaryInboxItem : null;
      if (lineupInboxItem) {
        navigateToInboxItem(lineupInboxItem);
      } else {
        navigateToGameFlowStep("lineup", resolveLineupIssueTeamId(activeManagerTeamId));
      }
      return;
    }
    if (
      activeView === "lineup" &&
      activeManagerMatchdayReady &&
      !homeNextMatchdayStatus.resultAvailable &&
      primaryInboxItem?.itemId.startsWith("lineup_missing:")
    ) {
      setFoundationView("matchdayArena", setActiveView);
      return;
    }
    if (primaryInboxItem) {
      navigateToInboxItem(primaryInboxItem);
      return;
    }
    if (globalNextDisabled) {
      setShowGameFlowPanel(true);
      return;
    }
    if (gameFlowActionStep.stepId === "advance_to_next_matchday" && gameFlowActionStep.status === "ready") {
      const result = await matchdayArenaApplyHandlers?.runCockpitMatchdayAdvance(true);
      if (result?.applied) {
        setAcknowledgedFlowStepIds(new Set());
      } else {
        setShowGameFlowPanel(true);
      }
      return;
    }
    if (gameFlowActionStep.stepId === "finalize_transfers" && gameFlowActionStep.status === "ready") {
      if (readMeta.readOnly) {
        showReadOnlyNotice();
        return;
      }
      const teamId = gameFlowActionStep.teamId ?? activeManagerTeamId;
      if (!activeSaveId || activeSaveId === "loading-save" || !teamId) {
        setShowGameFlowPanel(true);
        return;
      }
      setCockpitBusyKey("finalize-transfers");
      try {
        const params = appendRoomContextToParams(
          new URLSearchParams({
            saveId: activeSaveId,
            seasonId: gameState.season.id,
            matchdayId: gameState.matchdayState.matchdayId,
            teamId,
          }),
          roomContext,
        );
        const response = await fetch(`/api/lineups/legacy/finalize-transfers?${params.toString()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withRoomContextBody({}, roomContext)),
        });
        if (!response.ok) {
          setShowGameFlowPanel(true);
          return;
        }
        // Re-hydrate gameState.seasonState (incl. formCards) for the already-active
        // save without disrupting the current view -- loadSave() only clears
        // save-scoped feeds / caches when switching to a *different* saveId, so
        // calling it with the current activeSaveId is a light, in-place refresh.
        await loadSave(activeSaveId);
        acknowledgeFlowStep("finalize_transfers");
        navigateToGameFlowStep("lineup", resolveLineupIssueTeamId(teamId));
      } catch (error) {
        console.error(error);
        setShowGameFlowPanel(true);
      } finally {
        setCockpitBusyKey(null);
      }
      return;
    }
    if (gameFlowActionStep.stepId === "scouting_facilities") {
      updateNewGameFlowStepStatus("training_facilities", "completed");
    }
    navigateToGameFlowStep(gameFlowActionStep.targetView, gameFlowActionStep.teamId, gameFlowActionStep.targetPanel);
    acknowledgeFlowStep(gameFlowActionStep.stepId);
  };
  const closeCommandPalette = () => {
    setShowCommandPalette(false);
    setCommandSearch("");
  };

  const openFoundationViewCommand = (view: FoundationView) => {
    if (view === "hq") {
      navigateHomeTab("office");
      return;
    }
    const targetView = resolveFoundationViewTarget(view);
    if (targetView === "prize") {
      openPrizeFinanceView({ tab: "prize" });
      return;
    }
    if (targetView === "homeV2") {
      setHomeV2Tab("overview");
      syncFoundationViewInUrl("homeV2");
    }
    setFoundationView(targetView, setActiveView);
    scrollToFoundationTarget(getFoundationViewScrollTarget(targetView));
  };

  const openEncyclopediaEntry = (termOrId: string) => {
    const entry = getGameEncyclopediaEntry(termOrId) ?? GAME_ENCYCLOPEDIA_ENTRIES.find((item) => item.id === termOrId);
    setSelectedEncyclopediaEntryId(entry?.id ?? "ovr");
    setFoundationView("encyclopedia", setActiveView);
    scrollToFoundationTarget("foundation-encyclopedia");
  };

  const { foundationCommandItems, visibleFoundationCommandItems } = useFoundationCrossTabCommandPalette({
    activeView,
    activeManagerTeamId,
    commandSearch,
    gameState,
    globalNextLabel,
    globalNextStatusClass,
    gameFlowActionStepCta: gameFlowActionStep.cta,
    isTransferMarketViewActive,
    primaryInboxItem,
    selectedEncyclopediaEntryId,
    triggerGlobalNext,
    openFoundationViewCommand,
    openTeamDrawerById,
    openPlayerDrawerById,
    openEncyclopediaEntry,
    inboxCategoryFilter,
    setInboxCategoryFilter,
    setActiveView,
  });
  const { activeFlowCoach, foundationFlowLoopStages, activeFlowLoopIndex } = useFoundationCrossTabFlowCoach({
    activeView,
    homeV2Tab,
    globalNextLabel,
    globalNextTitle,
    gameFlowPhase: gameFlowState.phase,
    preseasonWizardStepId: gameFlowActionStep.stepId,
  });

  const selectedEncyclopediaEntry =
    GAME_ENCYCLOPEDIA_ENTRIES.find((entry) => entry.id === selectedEncyclopediaEntryId) ?? GAME_ENCYCLOPEDIA_ENTRIES[0];

  const runFoundationCommand = (command: FoundationCommandItem) => {
    command.run();
    closeCommandPalette();
  };

  useEffect(() => {
    const onOpenGameTerm = (event: Event) => {
      const termId = event instanceof CustomEvent ? String(event.detail?.termId ?? "") : "";
      if (!termId) return;
      openEncyclopediaEntry(termId);
    };

    window.addEventListener("foundation:open-game-term", onOpenGameTerm);
    return () => window.removeEventListener("foundation:open-game-term", onOpenGameTerm);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isTextTarget =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable ||
        target?.closest("[contenteditable='true']");
      const modalOpen = Boolean(document.querySelector(".foundation-drilldown-page, .player-drawer-backdrop, [role='dialog']"));
      const activeViewHandlesOwnSpace = activeView === "lineup" || activeView === "lineupV2" || activeView === "matchdayArena";
      if (isTextTarget || modalOpen || activeViewHandlesOwnSpace || globalNextDisabled) return;
      event.preventDefault();
      void triggerGlobalNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
	  }, [activeManagerTeamId, activeView, gameFlowActionStep, globalNextDisabled, primaryInboxItem, triggerGlobalNext]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isTextTarget =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable ||
        target?.closest("[contenteditable='true']");

      if ((event.metaKey || event.ctrlKey) && event.code === "KeyK") {
        event.preventDefault();
        setShowCommandPalette(true);
        return;
      }

      if (!isTextTarget && event.altKey && !event.ctrlKey && !event.metaKey && /^Digit[1-5]$/.test(event.code)) {
        const index = Number(event.code.replace("Digit", "")) - 1;
        const stage = foundationFlowLoopStages[index];
        if (stage) {
          event.preventDefault();
          openFoundationViewCommand(stage.targetView);
          return;
        }
      }

      if (event.code === "Escape" && showCommandPalette) {
        event.preventDefault();
        closeCommandPalette();
        return;
      }

      if (!isTextTarget && event.code === "Slash" && !showCommandPalette) {
        event.preventDefault();
        setShowCommandPalette(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [foundationFlowLoopStages, showCommandPalette]);

  useEffect(() => {
    if (!showCommandPalette) {
      return;
    }
    window.setTimeout(() => commandSearchInputRef.current?.focus(), 30);
  }, [showCommandPalette]);

  const shouldBuildTeamSettingsView = activeView === "teamSettings";

  const selectedIdentity = useMemo(
    () =>
      shouldBuildTeamSettingsView && selectedTeam
        ? gameState.teamIdentities.find((identity) => identity.teamId === selectedTeam.teamId) ?? null
        : null,
    [gameState.teamIdentities, selectedTeam, shouldBuildTeamSettingsView],
  );
  const selectedIdentityDraft = useMemo(
    () =>
      shouldBuildTeamSettingsView && selectedTeam
        ? teamIdentityDraft[selectedTeam.teamId] ?? selectedIdentity ?? null
        : null,
    [selectedIdentity, selectedTeam, shouldBuildTeamSettingsView, teamIdentityDraft],
  );
  const selectedIdentityAxisBias = useMemo(
    () => (shouldBuildTeamSettingsView ? deriveTeamIdentityAxisBias(selectedIdentityDraft) : null),
    [selectedIdentityDraft, shouldBuildTeamSettingsView],
  );
  const selectedTeamStrategyDraft = useMemo(
    () =>
      shouldBuildTeamSettingsView && selectedTeam
        ? teamStrategyDraft[selectedTeam.teamId] ?? resolvedTeamStrategyProfiles[selectedTeam.teamId] ?? null
        : null,
    [resolvedTeamStrategyProfiles, selectedTeam, shouldBuildTeamSettingsView, teamStrategyDraft],
  );
  const selectedTeamHasUnsavedChanges = useMemo(() => {
    if (!shouldBuildTeamSettingsView || !selectedTeam) {
      return false;
    }

    const identityChanged =
      JSON.stringify(teamIdentityDraft[selectedTeam.teamId] ?? null) !== JSON.stringify(selectedIdentity ?? null);
    const controlChanged =
      JSON.stringify(teamControlDraft[selectedTeam.teamId] ?? null) !==
        JSON.stringify(resolvedTeamControlSettings[selectedTeam.teamId] ?? null) || gameModeOwnershipDraftChanged;
    const strategyChanged =
      JSON.stringify(teamStrategyDraft[selectedTeam.teamId] ?? null) !==
      JSON.stringify(resolvedTeamStrategyProfiles[selectedTeam.teamId] ?? null);

    return identityChanged || controlChanged || strategyChanged;
  }, [
    gameModeOwnershipDraftChanged,
    resolvedTeamControlSettings,
    resolvedTeamStrategyProfiles,
    selectedIdentity,
    selectedTeam,
    shouldBuildTeamSettingsView,
    teamControlDraft,
    teamIdentityDraft,
    teamStrategyDraft,
  ]);
  const filteredTeamSettingsTeams = useMemo(() => {
    if (!shouldBuildTeamSettingsView) {
      return gameState.teams;
    }
    const query = teamSettingsSearch.trim().toLowerCase();
    if (!query) {
      return gameState.teams;
    }

    return gameState.teams.filter((team) => {
      const haystack = `${team.name} ${team.shortCode} ${team.teamId}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [gameState.teams, shouldBuildTeamSettingsView, teamSettingsSearch]);
  const selectedTeamSettingsIndex = useMemo(
    () => gameState.teams.findIndex((team) => team.teamId === selectedTeamId),
    [gameState.teams, selectedTeamId],
  );

  const selectedRoster = useMemo(
    () => (selectedTeam ? gameState.rosters.filter((entry) => entry.teamId === selectedTeam.teamId) : []),
    [gameState.rosters, selectedTeam],
  );
  const canonicalSeasonLabel = useMemo(
    () =>
      getCanonicalSeasonLabel({
        seasonId: gameState.season.id,
        seasonName: gameState.season.name,
      }),
    [gameState.season.id, gameState.season.name],
  );

  const rosterPlayers = useMemo(() => getRosterPlayers(gameState, selectedRoster), [gameState, selectedRoster]);
  const playerGeneratorTeamContexts = useMemo(
    () =>
      gameState.teams.map((team) => {
        const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
        const salaryTotal = rosterEntries.reduce((sum, entry) => sum + (Number.isFinite(entry.salary) ? entry.salary : 0), 0);
        const generalManager = getTeamGeneralManager(gameState, team.teamId);
        return {
          team,
          identity: gameState.teamIdentities.find((identity) => identity.teamId === team.teamId) ?? null,
          generalManager: generalManager?.profile ?? null,
          rosterCount: rosterEntries.length,
          averageSalary: rosterEntries.length > 0 ? roundViewNumber(salaryTotal / rosterEntries.length, 2) : null,
        };
      }),
    [gameState],
  );
  const marketSelectedTeam = useMemo(
    () => gameState.teams.find((team) => team.teamId === marketTeamId) ?? null,
    [gameState.teams, marketTeamId],
  );
  const marketCashMaxValue = useMemo(() => {
    if (!marketSelectedTeam || typeof marketSelectedTeam.cash !== "number" || !Number.isFinite(marketSelectedTeam.cash)) {
      return 150;
    }
    return Number(clampValue(marketSelectedTeam.cash, 0, 150).toFixed(2));
  }, [marketSelectedTeam]);
  const marketAiSelectedTeam = useMemo(
    () => marketAiPreviewFeed?.teams.find((team) => team.teamId === marketAiPreviewSelectedTeamId) ?? null,
    [marketAiPreviewFeed, marketAiPreviewSelectedTeamId],
  );
  const marketAiSellSelectedTeam = useMemo(
    () => marketAiSellPreviewFeed?.teams.find((team) => team.teamId === marketAiSellPreviewSelectedTeamId) ?? null,
    [marketAiSellPreviewFeed, marketAiSellPreviewSelectedTeamId],
  );
  const marketAiPlanSelectedTeam = useMemo(
    () => marketAiPlanPreviewFeed?.teams.find((team) => team.teamId === marketAiPlanPreviewSelectedTeamId) ?? null,
    [marketAiPlanPreviewFeed, marketAiPlanPreviewSelectedTeamId],
  );
  const marketAiCompareSelectedTeam = useMemo(
    () => marketAiCompareFeed?.teams.find((team) => team.teamId === marketAiCompareSelectedTeamId) ?? null,
    [marketAiCompareFeed, marketAiCompareSelectedTeamId],
  );
  const marketPreviewPlayer = useMemo(
    () => marketFeed?.items.find((item) => item.playerId === marketPreviewPlayerId) ?? null,
    [marketFeed?.items, marketPreviewPlayerId],
  );
  useEffect(() => {
    setMarketBuyPreview(null);
    setMarketBuyPreviewContext(null);
    setMarketBuyError(null);
    setMarketBuySuccess(null);
    setMarketPreviewPlayerId(null);
    setMarketBuySubject(null);
    setFoundationPanel(null);
  }, [activeSaveId, marketTeamId, readMeta.source]);

  useEffect(() => {
    setMarketBuyPreview(null);
    setMarketBuyPreviewContext(null);
    setMarketPreviewPlayerId(null);
    setMarketBuyError(null);
    setMarketBuySuccess(null);
    setMarketBuySubject(null);
    setFoundationPanel(null);
  }, [marketTeamId]);

  useEffect(() => {
    if (!isTransferMarketViewActive || marketTeamId || !selectedTeamId) {
      return;
    }
    setMarketTeamId(selectedTeamId);
  }, [isTransferMarketViewActive, marketTeamId, selectedTeamId]);

  useEffect(() => {
    if (activeView !== "market" || !marketSelectedTeam) {
      return;
    }

    const teamChanged = marketCashLimitTeamRef.current !== marketSelectedTeam.teamId;
    marketCashLimitTeamRef.current = marketSelectedTeam.teamId;
    if (!teamChanged && marketValueFilterManualRef.current) {
      return;
    }

    marketValueFilterManualRef.current = false;
    setMarketMaxValue(marketCashMaxValue);
  }, [activeView, marketCashMaxValue, marketSelectedTeam?.teamId]);

  useEffect(() => {
    setMarketAiPreviewFeed(null);
    setMarketAiPreviewError(null);
    setMarketAiPreviewSelectedTeamId(null);
  }, [activeSaveId, readMeta.source, marketAiTeamScope]);

  useEffect(() => {
    setMarketAiSellPreviewFeed(null);
    setMarketAiSellPreviewError(null);
    setMarketAiSellPreviewSelectedTeamId(null);
  }, [activeSaveId, readMeta.source, marketAiSellTeamScope]);

  useEffect(() => {
    if (playerScope === "free_agents" && playerTeamFilter !== "ALL") {
      setPlayerTeamFilter("ALL");
    }
  }, [playerScope, playerTeamFilter]);

  const seasonTableColumns = useMemo<FoundationTableColumn[]>(() => buildFoundationSeasonTableColumns(), []);
  const playersTableColumns = useMemo<FoundationTableColumn[]>(
    () => [
      { id: "image", label: "Bild", dataKey: "image", defaultWidth: 96, minWidth: 80 },
      { id: "name", label: "Name", dataKey: "name", defaultWidth: 220, minWidth: 170 },
      { id: "team", label: "Team", dataKey: "team", defaultWidth: 180, minWidth: 140 },
      { id: "class", label: "Klasse", dataKey: "class", defaultWidth: 140, minWidth: 110 },
      { id: "race", label: "Rasse", dataKey: "race", defaultWidth: 120, minWidth: 96 },
      { id: "pps", label: "PPs", dataKey: "pps", defaultWidth: 96, minWidth: 78 },
      { id: "ovr", label: "OVR", dataKey: "ovr", defaultWidth: 96, minWidth: 78 },
      { id: "mvs", label: "MVS", dataKey: "mvs", defaultWidth: 96, minWidth: 78 },
      { id: "mw", label: "MW", dataKey: "mw", defaultWidth: 120, minWidth: 100 },
      { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 120, minWidth: 100 },
      { id: "contract", label: "Vertrag", dataKey: "contract", defaultWidth: 96, minWidth: 80 },
      { id: "appearances", label: "Einsätze", dataKey: "appearances", defaultWidth: 94, minWidth: 78 },
      { id: "bestDiscipline", label: "Beste Diszi", dataKey: "bestDiscipline", defaultWidth: 120, minWidth: 98 },
      {
        id: "careerLeague",
        label: "Alltime",
        dataKey: "careerLeague",
        defaultWidth: 108,
        minWidth: 88,
        tooltip: "Gesamte Liga-Einsätze und PPs über alle Saisons (Archiv + Live).",
      },
      { id: "traits", label: "Traits", dataKey: "traits", defaultWidth: 230, minWidth: 180 },
    ],
    [],
  );
  const transfermarktColumns = useMemo(
    () => [
      ...getTransfermarktBaseColumns(),
      ...(marketShowAdvancedColumns ? getTransfermarktAdvancedColumns() : []),
    ],
    [marketShowAdvancedColumns],
  );
  const transferHistoryColumns = useMemo<FoundationTableColumn[]>(
    () => [
      { id: "image", label: "Bild", dataKey: "image", defaultWidth: 104, minWidth: 84 },
      { id: "name", label: "Spieler", dataKey: "name", defaultWidth: 220, minWidth: 170 },
      { id: "season", label: "Saison", dataKey: "season", defaultWidth: 110, minWidth: 90 },
      { id: "type", label: "Typ", dataKey: "type", defaultWidth: 90, minWidth: 72 },
      { id: "from", label: "Von", dataKey: "from", defaultWidth: 180, minWidth: 140 },
      { id: "to", label: "Zu", dataKey: "to", defaultWidth: 180, minWidth: 140 },
      { id: "fee", label: "Ablöse", dataKey: "fee", defaultWidth: 110, minWidth: 90 },
      { id: "guv", label: "GuV", dataKey: "guv", defaultWidth: 110, minWidth: 90 },
      { id: "marketValue", label: "Marktwert", dataKey: "marketValue", defaultWidth: 110, minWidth: 90 },
      { id: "pow", label: "Power", dataKey: "pow", defaultWidth: 90, minWidth: 72 },
      { id: "spe", label: "Speed", dataKey: "spe", defaultWidth: 90, minWidth: 72 },
      { id: "men", label: "Mental", dataKey: "men", defaultWidth: 90, minWidth: 72 },
      { id: "soc", label: "Social", dataKey: "soc", defaultWidth: 90, minWidth: 72 },
      { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 110, minWidth: 90 },
      { id: "className", label: "Klasse", dataKey: "className", defaultWidth: 120, minWidth: 96 },
      { id: "race", label: "Rasse", dataKey: "race", defaultWidth: 120, minWidth: 96 },
      { id: "happenedAt", label: "Zeitpunkt", dataKey: "happenedAt", defaultWidth: 180, minWidth: 150 },
      { id: "remainingContractLength", label: "Restlaufzeit", dataKey: "remainingContractLength", defaultWidth: 118, minWidth: 96 },
      { id: "source", label: "Quelle", dataKey: "source", defaultWidth: 132, minWidth: 110, visibleByDefault: false },
    ],
    [],
  );
  const orderedDisciplines = useMemo(() => {
    const saisonstandOrderIndex = new Map<string, number>(
      saisonstandDisciplineColumns.map((disciplineKey, index) => [disciplineKey, index] as const),
    );

    return [...gameState.disciplines].sort((left, right) => {
      const leftKey = normalizeLineupDisciplineFieldName(left.id);
      const rightKey = normalizeLineupDisciplineFieldName(right.id);
      const leftIndex = saisonstandOrderIndex.get(leftKey) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = saisonstandOrderIndex.get(rightKey) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      const leftOrder = left.displayOrder ?? left.originalOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.displayOrder ?? right.originalOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.name.localeCompare(right.name, "de");
    });
  }, [gameState.disciplines]);
  const disciplineRanksColumns = useMemo<FoundationTableColumn[]>(
    () => [
      { id: "team", label: "Team", dataKey: "team", defaultWidth: 178, minWidth: 150, maxWidth: 210 },
      { id: "totalRank", label: "TOT", dataKey: "totalRank", defaultWidth: 64, minWidth: 58, maxWidth: 76 },
      { id: "powRank", label: "POW", dataKey: "powRank", defaultWidth: 64, minWidth: 58, maxWidth: 76 },
      { id: "speRank", label: "SPE", dataKey: "speRank", defaultWidth: 64, minWidth: 58, maxWidth: 76 },
      { id: "menRank", label: "MEN", dataKey: "menRank", defaultWidth: 64, minWidth: 58, maxWidth: 76 },
      { id: "socRank", label: "SOC", dataKey: "socRank", defaultWidth: 64, minWidth: 58, maxWidth: 76 },
      ...orderedDisciplines.map((discipline) => ({
        id: discipline.id,
        label: discipline.name.replace(/\s+/g, "").slice(0, 3).toUpperCase(),
        dataKey: discipline.id,
        defaultWidth: 44,
        minWidth: 40,
        maxWidth: 52,
      })),
    ],
    [orderedDisciplines],
  );
  const disciplineConfigTableColumns = useMemo<FoundationTableColumn[]>(
    () => [
      { id: "originalOrder", label: "Original-Reihenfolge", dataKey: "originalOrder", defaultWidth: 170, minWidth: 130 },
      { id: "displayOrder", label: "Reihenfolge", dataKey: "displayOrder", defaultWidth: 120, minWidth: 96 },
      { id: "name", label: "Disziplin", dataKey: "name", defaultWidth: 220, minWidth: 160 },
      { id: "playerCount", label: "Spieleranzahl", dataKey: "playerCount", defaultWidth: 128, minWidth: 104 },
      { id: "mutator1", label: "Mutator 1", dataKey: "mutator1", defaultWidth: 160, minWidth: 120 },
      { id: "mutator2", label: "Mutator 2", dataKey: "mutator2", defaultWidth: 160, minWidth: 120 },
    ],
    [],
  );
  const seasonCompactPresets = useMemo<FoundationTablePreset[]>(
    () => {
      const compactOrder = [
        ...getSaisonstandCompactContractColumns().map((column) => column.normalizedKey),
        "actions",
      ];
      const compactColumns = compactOrder
        .map((columnId) => seasonTableColumns.find((column) => column.id === columnId))
        .filter((column): column is FoundationTableColumn => Boolean(column));
      const defaultOrder = compactColumns.map((column) => column.id);
      return [
        {
          id: "retool_default",
          label: "Retool Default",
          description: "Harte Reihenfolge der kompakten Saisonansicht.",
          order: defaultOrder,
          visibleColumnIds: compactColumns.filter((column) => column.visibleByDefault ?? true).map((column) => column.id),
          pinnedLeft: ["platz", "mannschaft", "punkte"],
        },
        {
          id: "compact",
          label: "Compact",
          description: "Kernwerte für schnellen Spieltagsblick.",
          order: defaultOrder,
          visibleColumnIds: ["platz", "mannschaft", "punkte", "tdm", "gewichtheben", "hockey", "schach", "takeshi", "vertragslange", "actions"],
          pinnedLeft: ["platz", "mannschaft", "punkte"],
        },
        {
          id: "finance",
          label: "Finance",
          description: "Finanznahe Saisonwerte ohne volle Expertensicht.",
          order: defaultOrder,
          visibleColumnIds: ["platz", "mannschaft", "punkte", "vertragslange", "actions"],
          pinnedLeft: ["platz", "mannschaft", "punkte"],
        },
        {
          id: "performance",
          label: "Performance",
          description: "Disziplinlastige Sicht auf Punkte und Kernleistungen.",
          order: defaultOrder,
          visibleColumnIds: defaultOrder.filter((columnId) => columnId !== "actions").concat("actions"),
          pinnedLeft: ["platz", "mannschaft", "punkte"],
        },
      ];
    },
    [seasonTableColumns],
  );
  const getSeasonTableDefaultColumnWidth = (column: FoundationTableColumn) =>
    seasonTableMode === "expert" ? (saisonstandExpertPresetWidths[column.id] ?? column.defaultWidth) : column.defaultWidth;

  const getSeasonTableColumnWidth = (column: FoundationTableColumn) =>
    clampTableColumnWidth(column, tableColumnPreferences.seasonTable?.widths?.[column.id] ?? getSeasonTableDefaultColumnWidth(column));

  const getTableColumnWidth = (tableId: string, column: FoundationTableColumn) =>
    clampTableColumnWidth(column, tableColumnPreferences[tableId]?.widths?.[column.id] ?? column.defaultWidth);

  const getTableActivePreset = (tableId: string) =>
    tableColumnPreferences[tableId]?.activePreset ?? ("retool_default" as const);

  const isTableColumnVisible = (tableId: string, columnId: string, visibleByDefault = true) => {
    const explicit = tableColumnPreferences[tableId]?.columnVisibility?.[columnId];
    if (typeof explicit === "boolean") {
      return explicit;
    }

    return !tableColumnPreferences[tableId]?.hiddenColumnIds?.includes(columnId) && visibleByDefault;
  };

  const getTablePinnedLeftIds = (tableId: string) =>
    (tableColumnPreferences[tableId]?.pinnedLeft?.length ? tableColumnPreferences[tableId]?.pinnedLeft : GLOBAL_TABLE_STORAGE_KEYS[tableId]?.defaultPinnedLeft) ?? [];

  const getTablePinnedRightIds = (tableId: string) =>
    (tableColumnPreferences[tableId]?.pinnedRight?.length ? tableColumnPreferences[tableId]?.pinnedRight : GLOBAL_TABLE_STORAGE_KEYS[tableId]?.defaultPinnedRight) ?? [];

  const markTableAsCustom = (entry: PersistedFoundationTablePreferenceEntry | undefined) => ({
    version: GLOBAL_TABLE_LAYOUT_VERSION,
    widths: entry?.widths ?? {},
    hiddenColumnIds: entry?.hiddenColumnIds ?? [],
    columnVisibility: entry?.columnVisibility ?? {},
    columnOrder: entry?.columnOrder ?? [],
    pinnedLeft: entry?.pinnedLeft ?? [],
    pinnedRight: entry?.pinnedRight ?? [],
    activePreset: "custom" as const,
  });

  const getVisibleColumnIdsForPreset = (columns: FoundationTableColumn[], visibleColumnIds: string[]) => {
    const visibleSet = new Set(visibleColumnIds);
    return Object.fromEntries(columns.map((column) => [column.id, visibleSet.has(column.id)]));
  };

  const startTableColumnResize = (
    tableId: string,
    column: FoundationTableColumn,
    event: React.MouseEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    tableResizeState.current = {
      tableId,
      columnId: column.id,
      startX: event.clientX,
      startWidth: tableId === "seasonTable" ? getSeasonTableColumnWidth(column) : getTableColumnWidth(tableId, column),
      minWidth: column.minWidth,
      maxWidth: column.maxWidth,
    };

    const handlePointerMove = (moveEvent: MouseEvent) => {
      const resizeState = tableResizeState.current;
      if (!resizeState) {
        return;
      }

      const nextWidth = Math.round(resizeState.startWidth + (moveEvent.clientX - resizeState.startX));
      setTableColumnPreferences((current) => ({
        ...current,
        [resizeState.tableId]: {
          ...markTableAsCustom(current[resizeState.tableId]),
          widths: {
            ...(current[resizeState.tableId]?.widths ?? {}),
            [resizeState.columnId]: clampTableColumnWidth(resizeState, nextWidth),
          },
        },
      }));
    };

    const handlePointerUp = () => {
      tableResizeState.current = null;
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
  };

  const resetTableColumnWidth = (tableId: string, column: FoundationTableColumn) => {
    setTableColumnPreferences((current) => ({
      ...current,
      [tableId]: {
        ...markTableAsCustom(current[tableId]),
        widths: {
          ...(current[tableId]?.widths ?? {}),
          [column.id]: clampTableColumnWidth(
            column,
            tableId === "seasonTable" ? getSeasonTableDefaultColumnWidth(column) : column.defaultWidth,
          ),
        },
      },
    }));
  };

  const setTableColumnVisible = (tableId: string, columnId: string, nextVisible: boolean) => {
    setTableColumnPreferences((current) => {
      const hidden = new Set(current[tableId]?.hiddenColumnIds ?? []);
      if (nextVisible) {
        hidden.delete(columnId);
      } else {
        hidden.add(columnId);
      }

      return {
        ...current,
        [tableId]: {
          ...markTableAsCustom(current[tableId]),
          widths: current[tableId]?.widths ?? {},
          hiddenColumnIds: Array.from(hidden),
          columnVisibility: {
            ...(current[tableId]?.columnVisibility ?? {}),
            [columnId]: nextVisible,
          },
        },
      };
    });
  };

  const setTransferMarketAdvancedColumnsVisible = (nextVisible: boolean) => {
    setMarketShowAdvancedColumns(nextVisible);
    setTableColumnPreferences((current) => {
      const advancedIds = getTransfermarktAdvancedColumns().map((column) => column.id);
      const hidden = new Set(current.transferMarketTable?.hiddenColumnIds ?? []);
      const columnVisibility = { ...(current.transferMarketTable?.columnVisibility ?? {}) };

      for (const columnId of advancedIds) {
        if (nextVisible) {
          hidden.delete(columnId);
        } else {
          hidden.add(columnId);
        }
        columnVisibility[columnId] = nextVisible;
      }

      return {
        ...current,
        transferMarketTable: {
          ...markTableAsCustom(current.transferMarketTable),
          widths: current.transferMarketTable?.widths ?? {},
          hiddenColumnIds: Array.from(hidden),
          columnVisibility,
        },
      };
    });
  };

  const adjustTableColumnWidth = (tableId: string, column: FoundationTableColumn, delta: number) => {
    setTableColumnPreferences((current) => {
      const currentWidth = tableId === "seasonTable" ? getSeasonTableColumnWidth(column) : getTableColumnWidth(tableId, column);
      return {
        ...current,
        [tableId]: {
          ...markTableAsCustom(current[tableId]),
          widths: {
            ...(current[tableId]?.widths ?? {}),
            [column.id]: clampTableColumnWidth(column, currentWidth + delta),
          },
        },
      };
    });
  };

  const moveTableColumn = (tableId: string, columnId: string, direction: "left" | "right", columns: FoundationTableColumn[]) => {
    setTableColumnPreferences((current) => {
      const baseOrder = applyStoredColumnOrder(
        columns,
        current[tableId]?.columnOrder,
        current[tableId]?.pinnedLeft,
        current[tableId]?.pinnedRight,
      ).map((column) => column.id);
      const currentIndex = baseOrder.indexOf(columnId);
      if (currentIndex === -1) {
        return current;
      }

      const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= baseOrder.length) {
        return current;
      }

      const nextOrder = [...baseOrder];
      const [movedColumnId] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(targetIndex, 0, movedColumnId);

      return {
        ...current,
        [tableId]: {
          ...markTableAsCustom(current[tableId]),
          columnOrder: nextOrder,
        },
      };
    });
  };

  const moveTableColumnTo = (tableId: string, sourceColumnId: string, targetColumnId: string, columns: FoundationTableColumn[]) => {
    if (sourceColumnId === targetColumnId) {
      return;
    }

    setTableColumnPreferences((current) => {
      const entry = current[tableId];
      const entryWithPinnedDefaults = {
        ...entry,
        pinnedLeft: getTablePinnedLeftIds(tableId),
        pinnedRight: getTablePinnedRightIds(tableId),
      };
      const sourceZone = getGlobalTablePinZone(entryWithPinnedDefaults, sourceColumnId);
      const targetZone = getGlobalTablePinZone(entryWithPinnedDefaults, targetColumnId);
      if (sourceZone !== targetZone) {
        return current;
      }

      const baseOrder = applyStoredColumnOrder(
        columns,
        entry?.columnOrder,
        getTablePinnedLeftIds(tableId),
        getTablePinnedRightIds(tableId),
      ).map((column) => column.id);
      const nextOrder = reorderGlobalTableColumns(baseOrder, sourceColumnId, targetColumnId);
      if (nextOrder === baseOrder || nextOrder.join("|") === baseOrder.join("|")) {
        return current;
      }

      return {
        ...current,
        [tableId]: {
          ...markTableAsCustom(entry),
          columnOrder: nextOrder,
        },
      };
    });
  };

  const getTableHeaderDragProps = (tableId: string, column: FoundationTableColumn, columns: FoundationTableColumn[]) => {
    const disabled = column.draggable === false;
    return {
      draggable: !disabled,
      onDragStart: (event: React.DragEvent<HTMLTableCellElement>) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        tableDragState.current = { tableId, columnId: column.id };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${tableId}:${column.id}`);
      },
      onDragOver: (event: React.DragEvent<HTMLTableCellElement>) => {
        const dragState = tableDragState.current;
        if (!dragState || dragState.tableId !== tableId || dragState.columnId === column.id) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      onDrop: (event: React.DragEvent<HTMLTableCellElement>) => {
        const dragState = tableDragState.current;
        tableDragState.current = null;
        if (!dragState || dragState.tableId !== tableId) {
          return;
        }
        event.preventDefault();
        moveTableColumnTo(tableId, dragState.columnId, column.id, columns);
      },
      onDragEnd: () => {
        tableDragState.current = null;
      },
    };
  };

  const applyTablePreset = (tableId: string, preset: FoundationTablePreset, columns: FoundationTableColumn[]) => {
    setTableColumnPreferences((current) => ({
      ...current,
      [tableId]: {
        version: GLOBAL_TABLE_LAYOUT_VERSION,
        widths: getDefaultTableWidths(columns),
        hiddenColumnIds: columns
          .filter((column) => !preset.visibleColumnIds.includes(column.id))
          .map((column) => column.id),
        columnVisibility: getVisibleColumnIdsForPreset(columns, preset.visibleColumnIds),
        columnOrder: [...preset.order],
        pinnedLeft: [...(preset.pinnedLeft ?? [])],
        pinnedRight: [...(preset.pinnedRight ?? [])],
        activePreset: preset.id,
      },
    }));
  };

  const resetTableLayout = (tableId: string, columns: FoundationTableColumn[], preset?: FoundationTablePreset) => {
    if (preset) {
      applyTablePreset(tableId, preset, columns);
      return;
    }

    setTableColumnPreferences((current) => {
      const next = { ...current };
      delete next[tableId];
      return next;
    });
  };

  const seasonDisciplineRankMaps = useMemo(() => {
    if (activeView !== "seasonV2") {
      return Object.fromEntries(
        saisonstandDisciplineColumns.map((disciplineKey) => [disciplineKey, new Map<string, number | null>()]),
      ) as Record<(typeof saisonstandDisciplineColumns)[number], Map<string, number | null>>;
    }
    return Object.fromEntries(
      saisonstandDisciplineColumns.map((disciplineKey) => [
        disciplineKey,
        buildNullableSharedRankMap(
          seasonStandRows.map((row) => ({
            teamId: row.teamId,
            value: row.disciplineValues[disciplineKey] ?? null,
          })),
        ),
      ]),
    ) as Record<(typeof saisonstandDisciplineColumns)[number], Map<string, number | null>>;
  }, [activeView, seasonStandRows]);

  const seasonFormBonusByTeamId = useMemo(
    () =>
      shouldBuildSeasonFormBonusGate
        ? buildPpAreaFormBonusByTeamId(gameState, seasonOverviewSeasonId)
        : ({} as ReturnType<typeof buildPpAreaFormBonusByTeamId>),
    [gameState, seasonOverviewSeasonId, shouldBuildSeasonFormBonusGate],
  );

  const selectedStandingRow = useMemo(
    () =>
      shouldBuildSelectedStandingRowGate
        ? seasonStandRows.find((row) => row.teamId === selectedTeam?.teamId) ?? null
        : null,
    [seasonStandRows, selectedTeam, shouldBuildSelectedStandingRowGate],
  );
  const selectedTeamSponsorOffers = useMemo(
    () => (selectedTeam ? getTeamSponsorOffers(gameState, selectedTeam.teamId) : []),
    [gameState, selectedTeam],
  );
  const selectedTeamSponsorContract = useMemo(
    () => (selectedTeam ? getTeamSponsorContract(gameState, selectedTeam.teamId) : null),
    [gameState, selectedTeam],
  );
  const selectedTeamCommercialRating = useMemo(
    () =>
      selectedTeam && shouldBuildSponsorCommercialRatingGate
        ? buildSponsorCommercialRating({ gameState, teamId: selectedTeam.teamId })
        : null,
    [gameState, selectedTeam, shouldBuildSponsorCommercialRatingGate],
  );
  const selectedTeamScoutPipeline = useMemo(
    () => (selectedTeam ? buildScoutPipelineSummary(gameState, selectedTeam.teamId) : null),
    [gameState, selectedTeam],
  );
  const selectedTeamGeneralManager = useMemo(
    () => (selectedTeam ? getTeamGeneralManager(gameState, selectedTeam.teamId) : null),
    [gameState, selectedTeam?.teamId],
  );
  const {
    teamObjectiveOverview,
    selectedTeamObjectives,
    selectedBoardConfidence,
    selectedOpenObjectives,
    selectedHqGmStory,
    selectedHqInboxItems,
    selectedHqFinanceWarnings,
    selectedHqMoraleSummary,
    selectedTeamGmAxisShares,
    selectedTeamGmBiasHighlights,
    selectedTeamPlayerDemands,
  } = useFoundationCrossTabHomeV2({
    activeView,
    shouldBuildHomeV2Overview,
    shouldBuildTeamsView,
    shouldBuildMarketView,
    teamProfileTeamId,
    inboxGameState,
    gameState,
    gameInboxItems,
    selectedTeam,
    selectedStandingRow,
    selectedTeamGeneralManager,
  });

  const selectedTeamCaptainProfile = useMemo(
    () => (selectedTeam ? selectTeamCaptain(gameState, selectedTeam.teamId) : null),
    [gameState, selectedTeam?.teamId],
  );
  const selectedTeamCaptainPlayerId = useMemo(() => {
    if (!selectedTeam) {
      return null;
    }
    return (
      gameState.teamCaptains?.find(
        (entry) => entry.seasonId === gameState.season.id && entry.teamId === selectedTeam.teamId,
      )?.playerId ?? null
    );
  }, [gameState.season.id, gameState.teamCaptains, selectedTeam?.teamId]);
  const selectedTeamCaptainCandidates = useMemo(
    () => (selectedTeam ? buildCaptainCandidateProfiles(gameState, selectedTeam.teamId).slice(0, 8) : []),
    [gameState, selectedTeam?.teamId],
  );
  const selectedTeamPowers = useMemo(
    () =>
      selectedTeam
        ? getTeamPowerOptions({
            gameState,
            seasonId: gameState.season.id,
            teamId: selectedTeam.teamId,
            lineupId: null,
          })
        : [],
    [gameState, selectedTeam?.teamId],
  );

  const seasonDerivations = useSeasonDerivations({
    enabled: shouldLoadSeasonDerivations,
    gameState,
    saveId: activeSaveId,
    contentSignature: seasonContentSignature,
  });
  const seasonPointsLedger =
    shouldLoadSeasonLedger || shouldLoadTeamsRosterDisciplineLedger ? seasonDerivations.ledger : null;

  // Feld-Rennen-Ledger (Wave D · D1/D2/D4): geteilte, fog-sichere Datenquelle
  // für Feld-Form-Strip (letzte 5 Spieltage), feld-relative Home-KPIs und
  // Rang-Movement. `useSeasonDerivations` ist aus Performance-Gründen nur im
  // Fallback aktiv (`shouldLoadSeasonDerivations`), daher wird der bereits
  // memoisierte `fieldRaceLedger` bevorzugt und nur bei leerem Cache über den
  // sanktionierten Helper `buildFieldRaceLedger` (dieselbe Quelle) nachgezogen
  // — ohne die teure Voll-Derivation zu erzwingen.
  const fieldRaceLedger = useMemo(() => {
    const shared = seasonDerivations.fieldRaceLedger;
    if (shared.matchdays.length > 0) {
      return shared;
    }
    // On-demand aus dem bereits gebauten Punkte-Ledger (kein Doppel-Build).
    return buildFieldRaceLedger(gameState, gameState.season.id, seasonDerivations.ledger);
  }, [seasonDerivations.fieldRaceLedger, seasonDerivations.ledger, gameState]);

  /** Letzte bis zu 5 Spieltage des aktiven Teams (D1 Feld-Form-Strip). */
  const selectedTeamFieldRaceForm: FieldRaceLedgerEntry[] = useMemo(
    () => (selectedTeam ? getFieldRaceRecentForm(fieldRaceLedger, selectedTeam.teamId, 5) : []),
    [fieldRaceLedger, selectedTeam?.teamId],
  );

  /** Anzahl bereits gespielter Spieltage der Season (für Frühphasen-Zustände). */
  const fieldRacePlayedMatchdayCount = fieldRaceLedger.matchdays.length;
  const fieldRaceTotalTeams = gameState.teams.length;

  /** Rang-Movement (Δ vs. letzter Spieltag) je Team — letzter Ledger-Eintrag (D4). */
  const fieldRaceRankDeltaByTeamId = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const [teamId, rows] of fieldRaceLedger.rowsByTeamId) {
      map.set(teamId, rows.length > 0 ? rows[rows.length - 1].rankDeltaVsPrev : null);
    }
    return map;
  }, [fieldRaceLedger]);

  const homeFieldRaceRankMovement = selectedTeam
    ? fieldRaceRankDeltaByTeamId.get(selectedTeam.teamId) ?? null
    : null;

  const fullPlayerRatingsById = useMemo(() => {
    if (shouldBuildPlayerDirectory && playerDirectorySlice.ratingsById.size > 0 && !playerDirectorySlice.error) {
      return playerDirectorySlice.ratingsById;
    }
    if (shouldLoadSeasonLedger || seasonRatingsSlice.error) {
      return seasonDerivations.ratingsById;
    }
    if (seasonRatingsSlice.ratingsById.size > 0) {
      return seasonRatingsSlice.ratingsById;
    }
    return seasonDerivations.ratingsById;
  }, [
    playerDirectorySlice.error,
    playerDirectorySlice.ratingsById,
    seasonDerivations.ratingsById,
    seasonRatingsSlice.error,
    seasonRatingsSlice.ratingsById,
    shouldBuildPlayerDirectory,
    shouldLoadSeasonLedger,
  ]);
  const playerRatingsById = useMemo(() => {
    if (shouldBuildPlayerRatings) {
      return fullPlayerRatingsById;
    }
    if (shouldBuildTrainingView) {
      return pickRatingsForPlayerIds(
        fullPlayerRatingsById,
        rosterPlayers.map(({ player }) => player.id),
      );
    }
    return new Map();
  }, [fullPlayerRatingsById, rosterPlayers, shouldBuildPlayerRatings, shouldBuildTrainingView]);
  const {
    ppAreaRows,
    seasonHistorySnapshots,
    seasonOverviewOptions,
    sortedPpAreaRows,
    ppAreaRankClassMaps,
    ppAreaMetricPools,
    prizePreviewHardBlocked,
    prizePreviewRows,
    selectedPrizePreviewRow,
    seasonEndChampionRow,
    currentSeasonCashPrizeApplyLogs,
    prizeApplyState,
    prizeAuditCompact,
  } = useFoundationCrossTabSeasonPrize({
    activeView: activeView as FoundationViewId,
    shouldBuildPpAreaRows: shouldBuildPpAreaRowsGate,
    shouldBuildSeasonHistorySnapshots: shouldBuildSeasonHistorySnapshotsGate,
    shouldBuildSeasonOverviewOptions: shouldBuildSeasonOverviewOptionsGate,
    shouldLoadPrizePreviewFeed,
    gameState,
    seasonStandRows,
    seasonFormBonusByTeamId,
    tableSorts,
    prizePreviewFeed,
    cashApplyFeed,
    selectedTeam,
  });

  const selectedSeasonSnapshot = useMemo(
    () => seasonHistorySnapshots.find((snapshot) => snapshot.seasonId === seasonOverviewSeasonId) ?? null,
    [seasonHistorySnapshots, seasonOverviewSeasonId],
  );
  const isViewingArchivedSeason = selectedSeasonSnapshot != null && seasonOverviewSeasonId !== gameState.season.id;
  const selectedSeasonOverviewOption =
    seasonOverviewOptions.find((option) => option.seasonId === seasonOverviewSeasonId) ?? seasonOverviewOptions[0] ?? null;
  const selectedSeasonOverviewLabel = selectedSeasonOverviewOption?.seasonName ?? seasonOverviewSeasonId;
  const seasonOverviewSourceLabel = isViewingArchivedSeason
    ? `Archiv-Snapshot · ${selectedSeasonSnapshot?.archivedAt ? new Date(selectedSeasonSnapshot.archivedAt).toLocaleString("de-DE") : "lokal"}`
    : "Aktive Season · lokale Results";

  useFoundationSeasonOverviewFeedEffect({
    activeSaveId,
    gameStateSeasonId: gameState.season.id,
    isFoundationBootstrapState,
    seasonOverviewSeasonId,
    setSeasonOverviewSeasonId,
    seasonStandingsFeed,
    seasonOverviewOptions,
    shouldLoadSeasonOverviewFeed,
    shouldLoadSeasonOverviewFeedActive,
    shouldLoadTeamsHistoryOverview,
    seasonOverviewScopeRef,
    reloadSeasonStandingsOverview,
  });

  const archivedSeasonDisciplineLeaderboards = useMemo(() => {
    if (!selectedSeasonSnapshot) {
      return [];
    }

    const disciplineRows = new Map<
      string,
      {
        disciplineId: string;
        disciplineName: string;
        players: Array<{
          playerId: string;
          playerName: string;
          teamCode: string | null;
          teamName: string | null;
          appearances: number;
          totalContribution: number | null;
          averageContribution: number | null;
          averageFinalScore: number | null;
        }>;
      }
    >();

    for (const player of selectedSeasonSnapshot.playerPerformances ?? []) {
      for (const discipline of player.disciplineBreakdown ?? []) {
        const bucket = disciplineRows.get(discipline.disciplineId) ?? {
          disciplineId: discipline.disciplineId,
          disciplineName: discipline.disciplineName,
          players: [],
        };
        bucket.players.push({
          playerId: player.playerId,
          playerName: player.playerName,
          teamCode: player.teamCode ?? null,
          teamName: player.teamName ?? null,
          appearances: discipline.appearances,
          totalContribution: discipline.totalContribution ?? null,
          averageContribution: discipline.averageContribution ?? null,
          averageFinalScore: discipline.averageFinalScore ?? null,
        });
        disciplineRows.set(discipline.disciplineId, bucket);
      }
    }

    return Array.from(disciplineRows.values())
      .map((entry) => ({
        ...entry,
        players: entry.players
          .sort((left, right) => {
            const contributionDelta =
              (right.totalContribution ?? Number.NEGATIVE_INFINITY) -
              (left.totalContribution ?? Number.NEGATIVE_INFINITY);
            if (contributionDelta !== 0) {
              return contributionDelta;
            }
            return (right.averageFinalScore ?? Number.NEGATIVE_INFINITY) - (left.averageFinalScore ?? Number.NEGATIVE_INFINITY);
          })
          .slice(0, 6),
      }))
      .sort((left, right) => left.disciplineName.localeCompare(right.disciplineName, "de"));
  }, [selectedSeasonSnapshot]);

  const {
    disciplineRankRows,
    sortedDisciplineRankRows,
    disciplineLeaderEntries,
    seasonDisciplineScheduleRows,
    seasonBriefingScheduleReady,
    currentMatchdayDisciplineSchedule,
    visibleDisciplineConfigRows,
    isViewingArchivedRanksSeason,
    ranksArchiveMissing,
  } = useFoundationCrossTabDisciplineRanks({
    activeView: activeView as FoundationViewId,
    shouldBuildTeamsHeavyComparison,
    shouldLoadSeasonOverviewFeed,
    isFoundationBootstrapState,
    gameState,
    activeSaveId,
    orderedDisciplines,
    disciplineCategoryFilter,
    ranksSeasonId: seasonOverviewSeasonId || gameState.season.id,
    seasonHistorySnapshots,
    tableSorts,
  });
  const rankLeaderCards = disciplineLeaderEntries;

  const currentAreaRanksByTeamId = useMemo(() => {
    if (shouldBuildDisciplineRanks && disciplineRankRows.length > 0) {
      return new Map(
        disciplineRankRows.map((row) => [
          row.team.teamId,
          {
            pow: row.scorePack.pow > 0 ? row.powRank || null : null,
            spe: row.scorePack.spe > 0 ? row.speRank || null : null,
            men: row.scorePack.men > 0 ? row.menRank || null : null,
            soc: row.scorePack.soc > 0 ? row.socRank || null : null,
          },
        ]),
      );
    }

    if (!shouldBuildTeamsView && activeView !== "teamProfile") {
      return new Map<string, { pow: number | null; spe: number | null; men: number | null; soc: number | null }>();
    }

    const powRankMap = buildSharedRankMap(
      seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsPow ?? 0 })),
    );
    const speRankMap = buildSharedRankMap(
      seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsSpe ?? 0 })),
    );
    const menRankMap = buildSharedRankMap(
      seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsMen ?? 0 })),
    );
    const socRankMap = buildSharedRankMap(
      seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsSoc ?? 0 })),
    );

    return new Map(
      seasonStandRows.map((row) => {
        const hasActiveRoster = row.rosterCount > 0;
        return [
          row.teamId,
          {
            pow: hasActiveRoster && (row.ppsPow ?? 0) > 0 ? powRankMap.get(row.teamId) ?? null : null,
            spe: hasActiveRoster && (row.ppsSpe ?? 0) > 0 ? speRankMap.get(row.teamId) ?? null : null,
            men: hasActiveRoster && (row.ppsMen ?? 0) > 0 ? menRankMap.get(row.teamId) ?? null : null,
            soc: hasActiveRoster && (row.ppsSoc ?? 0) > 0 ? socRankMap.get(row.teamId) ?? null : null,
          },
        ] as const;
      }),
    );
  }, [activeView, disciplineRankRows, seasonStandRows, shouldBuildDisciplineRanks, shouldBuildTeamsView]);

  const selectedHqAxisSummary = null;

  const selectedTeamAverageAxisStats = useMemo(() => {
    if (rosterPlayers.length === 0) {
      return null;
    }
    const totals = rosterPlayers.reduce(
      (sum, { player }) => ({
        pow: sum.pow + (player.coreStats.pow ?? 0),
        spe: sum.spe + (player.coreStats.spe ?? 0),
        men: sum.men + (player.coreStats.men ?? 0),
        soc: sum.soc + (player.coreStats.soc ?? 0),
      }),
      { pow: 0, spe: 0, men: 0, soc: 0 },
    );
    const count = rosterPlayers.length;
    return {
      pow: totals.pow / count,
      spe: totals.spe / count,
      men: totals.men / count,
      soc: totals.soc / count,
    };
  }, [rosterPlayers]);

  const {
    selectedRosterTableRows,
    buildTeamDetailDrawerData,
    teamProfileData,
  } = useFoundationCrossTabTeamsRoster({
    shouldBuildTeamsView,
    shouldBuildHomeV2Overview,
    shouldBuildMarketView,
    teamProfileTeamId,
    canonicalSeasonLabel,
    gameState,
    rosterPlayers,
    playerRatingsById,
    seasonStandRows,
    seasonStandRowsSeasonId: seasonOverviewSeasonId || gameState.season.id,
    activeSaveId,
    currentAreaRanksByTeamId,
    seasonPointsLedger,
    teamObjectiveOverview,
    currentMatchdayDisciplineSchedule,
    manageableTeamIds: foundationManageableTeamIds,
  });

  const playerSeasonPerformanceMap = useMemo(
    () => {
      const shouldBuild =
        shouldBuildTrainingView ||
        shouldBuildPlayerDirectory ||
        shouldBuildMarketView ||
        shouldBuildHomeV2Overview ||
        isMarketSellPanelOpen;
      if (!shouldBuild || !shouldLoadSeasonDerivations) {
        return new Map();
      }
      return seasonDerivations.performanceByPlayerId;
    },
    [
      isMarketSellPanelOpen,
      seasonDerivations.performanceByPlayerId,
      shouldBuildHomeV2Overview,
      shouldBuildMarketView,
      shouldBuildPlayerDirectory,
      shouldBuildTrainingView,
      shouldLoadSeasonDerivations,
    ],
  );
  const playerLeagueCareerStatsMap = useMemo(
    () => {
      if (shouldBuildPlayerDirectory && playerDirectorySlice.payload && !playerDirectorySlice.error) {
        return new Map(Object.entries(playerDirectorySlice.careerStatsByPlayerId));
      }
      return shouldBuildPlayerDirectory
        ? buildPlayerLeagueCareerStatsMap(gameState, {
            currentSeasonPerformanceByPlayerId: playerSeasonPerformanceMap,
            currentSeasonLedger: seasonPointsLedger,
          })
        : new Map();
    },
    [
      gameState,
      playerDirectorySlice.careerStatsByPlayerId,
      playerDirectorySlice.error,
      playerDirectorySlice.payload,
      playerSeasonPerformanceMap,
      seasonPointsLedger,
      shouldBuildPlayerDirectory,
    ],
  );
  const marketSellPlayerContext = useMemo(() => {
    const playerId =
      marketSellPreview?.player?.id ??
      marketSellPreview?.activePlayer?.playerId ??
      marketSellSubject?.playerId ??
      null;
    if (!playerId) {
      return null;
    }

    const teamId =
      marketSellPreview?.team?.id ??
      gameState.rosters.find((entry) => entry.id === marketSellPreview?.activePlayer?.id || entry.id === marketSellSubject?.activePlayerId)?.teamId ??
      selectedTeam.teamId;
    const player = gameState.players.find((entry) => entry.id === playerId) ?? null;
    const rosterEntry =
      gameState.rosters.find((entry) => entry.id === marketSellPreview?.activePlayer?.id) ??
      gameState.rosters.find((entry) => entry.id === marketSellSubject?.activePlayerId) ??
      gameState.rosters.find((entry) => entry.playerId === playerId && entry.teamId === teamId) ??
      null;
    const rating = playerRatingsById.get(playerId) ?? null;
    const performance = playerSeasonPerformanceMap.get(playerId) ?? null;
    const teamById = new Map(gameState.teams.map((team) => [team.teamId, team]));
    const transferEvents = gameState.transferHistory
      .filter((entry) => entry.playerId === playerId)
      .sort((left, right) => {
        const rightTime = Date.parse(right.happenedAt);
        const leftTime = Date.parse(left.happenedAt);
        if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
          return rightTime - leftTime;
        }
        return right.seasonId.localeCompare(left.seasonId, "de", { numeric: true });
      })
      .slice(0, 5)
      .map((entry) => ({
        id: entry.id,
        type: entry.transferType,
        label: getTransferTypeLabel(entry.transferType),
        seasonLabel: entry.seasonLabel ?? entry.seasonId,
        phase: entry.phase ?? "—",
        fee: entry.fee,
        salary: entry.salary,
        marketValue: entry.marketValue,
        fromTeam: entry.fromTeamId ? teamById.get(entry.fromTeamId)?.shortCode ?? entry.fromTeamId : "Free",
        toTeam: entry.toTeamId ? teamById.get(entry.toTeamId)?.shortCode ?? entry.toTeamId : "Free",
      }));
    const latestBuyForCurrentTeam =
      [...gameState.transferHistory]
        .filter((entry) => entry.playerId === playerId && entry.transferType === "buy" && entry.toTeamId === teamId)
        .sort((left, right) => Date.parse(right.happenedAt) - Date.parse(left.happenedAt))[0] ?? null;
    const purchasePrice =
      latestBuyForCurrentTeam?.fee ??
      rosterEntry?.purchasePrice ??
      marketSellPreview?.activePlayer?.purchasePrice ??
      null;
    const currentMarketValue = player
      ? getPlayerDisplayMarketValue(player)
      : marketSellPreview?.marketValueReference ?? null;
    const rosterMarketValue = player && rosterEntry ? getRosterEntryDisplayMarketValue(rosterEntry, player) : marketSellPreview?.activePlayer?.currentValue ?? null;
    const marketValueDelta = player && rosterEntry ? getPlayerDisplayMarketValueDelta(player, rosterEntry, gameState) : null;
    const salary = player && rosterEntry ? getRosterEntryDisplaySalary(rosterEntry, player) : marketSellPreview?.activePlayer?.salary ?? null;
    const salaryDelta = player && rosterEntry ? getRosterEntrySalaryDelta(rosterEntry, player, gameState) : null;
    const saleProfit =
      marketSellPreview?.salePrice != null && purchasePrice != null
        ? roundViewNumber(marketSellPreview.salePrice - purchasePrice, 2)
        : marketSellPreview?.profit ?? null;
    const areaRows = [
      { key: "POW", value: rating?.ppPow ?? performance?.pointsByArea.pow ?? null, tone: "power" },
      { key: "SPE", value: rating?.ppSpe ?? performance?.pointsByArea.spe ?? null, tone: "speed" },
      { key: "MEN", value: rating?.ppMen ?? performance?.pointsByArea.men ?? null, tone: "mental" },
      { key: "SOC", value: rating?.ppSoc ?? performance?.pointsByArea.soc ?? null, tone: "social" },
    ];

    return {
      player,
      rosterEntry,
      rating,
      performance,
      transferEvents,
      purchasePrice,
      currentMarketValue,
      rosterMarketValue,
      marketValueDelta,
      salary,
      salaryDelta,
      saleProfit,
      areaRows,
      recentMatchdays: performance?.matchdayBreakdown.slice(0, 4) ?? [],
      topDisciplines: performance?.topDisciplineRows.slice(0, 4) ?? [],
    };
  }, [
    gameState.players,
    gameState.rosters,
    gameState.teams,
    gameState.transferHistory,
    marketSellPreview,
    marketSellSubject,
    playerRatingsById,
    playerSeasonPerformanceMap,
    selectedTeam.teamId,
  ]);
  const selectedTeamFacilityState = useMemo(
    () => getTeamFacilityState(gameState, selectedTeam.teamId),
    [gameState, selectedTeam.teamId],
  );
  const {
    activeManagerLineupSubmitted,
    activeManagerLineupReady,
    aiLineupMissingTeamIds,
    homeNextMatchdayStatus,
    matchdaySummary,
    matchdaySummaryOptions,
    activeMatchdaySummaryId,
    activeTeamMatchdaySummaryRow,
    ensureAiLineupsForCurrentMatchday,
  } = useFoundationCrossTabMatchdayLineup({
    activeView,
    gameState,
    activeManagerTeamId,
    aiLineupEnsureTeams,
    currentMatchdayDisciplineSchedule,
    selectedMatchdaySummaryId,
    activeSaveId,
    readMetaSource: readMeta.source,
    readMetaReadOnly: readMeta.readOnly,
    roomContext,
    foundationSaveMode,
    aiLineupEnsureBusy,
    setAiLineupEnsureBusy,
    setAiLineupEnsureFeed,
    loadSave,
  });
  const {
    localSeasonTransitionGate,
    seasonSetupFlow,
    seasonBriefingData,
    seasonReadinessChecklist,
  } = useFoundationCrossTabSeasonBriefing({
    activeView,
    activeSaveId,
    activeManagerTeamId,
    gameState,
    selectedTeam,
    rosterPlayers,
    selectedTeamFacilityState,
    selectedTeamSponsorContract,
    currentMatchdayDisciplineSchedule,
    homeNextMatchdayStatus,
    seasonDisciplineScheduleRows,
    prizePreviewFeed,
  });
  const {
    trainingPlayerForecastRows,
    trainingForecastSummary,
    trainingDevelopmentSummary,
    filteredTrainingPlayerForecastRows,
    trainingLoadPlanByPlayerId,
    trainingPlayerRowViews,
    playerProfileTrainingRow,
    trainingFacilityRows,
    selectedTrainingFacilityPreview,
    trainingFacilityForecast,
    trainingFacilitySeasonEndFinance,
    trainingFacilityEffectPreview,
    teamBeliebtheit,
    trainingV2ModeOptions,
  } = useFoundationCrossTabTraining({
    // Compact-tab derivations now live in `FoundationTrainingCompactShellHost`
    // (Foundation Perf Phase 3): the parent scope hook no longer pays for the
    // whole-roster `buildOrganicSeasonProgression` pass when only the compact
    // training tab is active. Facilities view and player-profile training row
    // still need the shared forecast rows, so those flags stay unchanged.
    shouldBuildTrainingView: shouldBuildTrainingFacilitiesView,
    shouldBuildTrainingCompactView: false,
    shouldBuildTrainingFacilitiesView,
    shouldBuildPlayerProfileTrainingRow,
    gameState,
    selectedTeam,
    selectedTeamFacilityState,
    rosterPlayers,
    playerRatingsById,
    playerSeasonPerformanceMap,
    trainingModeDraft,
    trainingClassDraft,
    trainingDevelopmentFilter,
    trainingFacilityPreviewId,
    playerProfileData,
    readMeta,
  });

  const { orderedIds: playerDirectoryOrderedIds, sortRows: sortPlayerDirectoryRows } =
    usePlayerDirectorySortWorker();
  const {
    leaguePlayerHeatPools,
    playerScopeRows,
    playerClassOptions,
    playersTableScopeRows,
    playersTableRows,
    sortedPlayersTableRows,
    displayedPlayersTableRows,
    playerBracketCounts,
  } = useFoundationCrossTabPlayerDirectory({
    activeView: activeView as FoundationViewId,
    shouldBuildPlayerDirectory,
    shouldBuildMarketView,
    shouldBuildTeamHistory,
    showExtendedTeamPanels,
    selectedTeamDetailTab,
    gameState,
    playerRatingsById,
    playerDirectorySlice,
    playerScope,
    playerSeasonPerformanceMap,
    seasonPointsLedger,
    deferredPlayerTeamFilter,
    deferredPlayerClassFilter,
    deferredPlayerBracketFilter,
    tableSorts,
    playerDirectoryOrderedIds,
    sortPlayerDirectoryRows,
  });
  const {
    transferSellMarkerKeySet,
    transferWishlistEntries,
    transferWishlistEntriesForMarketV2,
    scoutingHubV2TargetSections,
    scoutingHubV2Visibility,
    scoutingQueueEntries,
    scoutingFocusSummary,
    scoutingReport,
    hqTransferWishlistEntries,
    hqTransferSellMarkers,
    hqContractExpiringCount,
    hqTrainingFocusCount,
  } = useFoundationCrossTabMarketFilters({
    activeView: activeView as FoundationViewId,
    shouldBuildMarketView,
    shouldBuildScoutingHubView,
    shouldBuildTeamsView,
    shouldBuildHomeV2Overview,
    activeSaveId,
    gameState,
    selectedTeam,
    selectedTeamFacilityState,
    scoutingReportSelectedPlayerId,
    selectedRosterTableRows,
  });

  const seasonModeColumns = useMemo(
    () => {
      const contractColumns = getSaisonstandExpertContractColumns();
      const columnById = new Map(seasonTableColumns.map((column) => [column.id, column]));
      return contractColumns
        .map((column) => columnById.get(column.normalizedKey))
        .filter((column): column is FoundationTableColumn => Boolean(column));
    },
    [seasonTableColumns],
  );
  const visibleSeasonTableColumns = useMemo(() => seasonModeColumns, [seasonModeColumns]);
  const seasonTablePinnedOffsets = useMemo(() => {
    const pinnedIds = new Set<string>(["platz", "mannschaft", "punkte"]);
    let currentLeft = 0;
    const offsets = new Map<string, number>();
    for (const column of visibleSeasonTableColumns) {
      if (!pinnedIds.has(column.id)) {
        continue;
      }
      offsets.set(column.id, currentLeft);
      currentLeft += getSeasonTableColumnWidth(column);
    }
    return offsets;
  }, [visibleSeasonTableColumns]);
  const visiblePlayersTableColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        playersTableColumns,
        tableColumnPreferences.playersTable?.columnOrder,
        getTablePinnedLeftIds("playersTable"),
        getTablePinnedRightIds("playersTable"),
      ).filter((column) => isTableColumnVisible("playersTable", column.id, column.visibleByDefault)),
    [playersTableColumns, tableColumnPreferences],
  );

  const visibleTransferHistoryColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        transferHistoryColumns,
        tableColumnPreferences.transferHistoryTable?.columnOrder,
        getTablePinnedLeftIds("transferHistoryTable"),
        getTablePinnedRightIds("transferHistoryTable"),
      ).filter((column) =>
        isTableColumnVisible("transferHistoryTable", column.id, column.visibleByDefault),
      ),
    [transferHistoryColumns, tableColumnPreferences],
  );
  const visibleDisciplineRanksColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        disciplineRanksColumns,
        tableColumnPreferences.disciplineRanksTable?.columnOrder,
        getTablePinnedLeftIds("disciplineRanksTable"),
        getTablePinnedRightIds("disciplineRanksTable"),
      ).filter((column) =>
        isTableColumnVisible("disciplineRanksTable", column.id, column.visibleByDefault),
      ),
    [disciplineRanksColumns, tableColumnPreferences],
  );
  const visibleDisciplineConfigColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        disciplineConfigTableColumns,
        tableColumnPreferences.disciplineConfigTable?.columnOrder,
        getTablePinnedLeftIds("disciplineConfigTable"),
        getTablePinnedRightIds("disciplineConfigTable"),
      ).filter((column) =>
        isTableColumnVisible("disciplineConfigTable", column.id, column.visibleByDefault),
      ),
    [disciplineConfigTableColumns, tableColumnPreferences],
  );
  const scrollSeasonTableToColumn = (columnId: string) => {
    const shell = seasonTableShellRef.current;
    if (!shell) {
      return;
    }

    const targetIndex = visibleSeasonTableColumns.findIndex((column) => column.id === columnId);
    if (targetIndex < 0) {
      return;
    }

    const left = visibleSeasonTableColumns
      .slice(0, targetIndex)
      .reduce((sum, column) => sum + getSeasonTableColumnWidth(column), 0);

    shell.scrollTo({
      left: Math.max(left - 18, 0),
      behavior: "smooth",
    });
  };

  const visibleTransfermarktColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        transfermarktColumns,
        tableColumnPreferences.transferMarketTable?.columnOrder,
        getTablePinnedLeftIds("transferMarketTable"),
        getTablePinnedRightIds("transferMarketTable"),
      ).filter((column) => isTableColumnVisible("transferMarketTable", column.id, true)),
    [tableColumnPreferences, transfermarktColumns],
  );

  const transferMarketRows = useMemo(() => {
    if (!shouldBuildMarketView) {
      return [];
    }

    return (marketFeed?.items ?? [])
      .map((item, index) => ({
        id: `derived-free-agent-${index + 1}`,
        item,
        sortRecommendation: marketSelectedTeam ? item.fitSource : "watch",
      }))
      .filter((entry) => {
        const normalizedMarketSearch = deferredMarketSearch.trim().toLowerCase();
        const matchesSearch =
          normalizedMarketSearch.length === 0 ||
          entry.item.name.toLowerCase().includes(normalizedMarketSearch);
        const matchesClass = marketClassFilter === "ALL" || entry.item.className === marketClassFilter;
        const matchesRace = marketRaceFilter === "ALL" || entry.item.race === marketRaceFilter;
        const matchesSubclass =
          marketSubclassFilter === "ALL" || entry.item.subclasses.includes(marketSubclassFilter);
        const matchesAlignment = marketAlignmentFilter === "ALL" || entry.item.alignment === marketAlignmentFilter;
        const matchesGender = marketGenderFilter === "ALL" || entry.item.gender === marketGenderFilter;
        const matchesPositiveTrait =
          marketPositiveTraitFilter === "ALL" || entry.item.traitsPositive.includes(marketPositiveTraitFilter);
        const matchesNegativeTrait =
          marketNegativeTraitFilter === "ALL" || entry.item.traitsNegative.includes(marketNegativeTraitFilter);
        const matchesBracket = marketBracketFilter === "ALL" || String(entry.item.bracket ?? "") === marketBracketFilter;
        const matchesValue = (entry.item.marketValue ?? Number.POSITIVE_INFINITY) <= marketMaxValue;
        const matchesSalary = (entry.item.salary ?? Number.POSITIVE_INFINITY) <= marketMaxSalary;
        const matchesRatio = (entry.item.marketValueSalaryRatio ?? Number.NEGATIVE_INFINITY) >= marketMinRatio;
        const matchesPow = (entry.item.pow ?? Number.NEGATIVE_INFINITY) >= marketMinPow;
        const matchesSpe = (entry.item.spe ?? Number.NEGATIVE_INFINITY) >= marketMinSpe;
        const matchesMen = (entry.item.men ?? Number.NEGATIVE_INFINITY) >= marketMinMen;
        const matchesSoc = (entry.item.soc ?? Number.NEGATIVE_INFINITY) >= marketMinSoc;

        return (
          matchesSearch &&
          matchesClass &&
          matchesRace &&
          matchesSubclass &&
          matchesAlignment &&
          matchesGender &&
          matchesPositiveTrait &&
          matchesNegativeTrait &&
          matchesBracket &&
          matchesValue &&
          matchesSalary &&
          matchesRatio &&
          matchesPow &&
          matchesSpe &&
          matchesMen &&
          matchesSoc
        );
      });
  }, [
    marketAlignmentFilter,
    marketClassFilter,
    marketBracketFilter,
    marketFeed,
    marketGenderFilter,
    marketMaxSalary,
    marketMaxValue,
    marketMinMen,
    marketMinPow,
    marketMinRatio,
    marketMinSoc,
    marketMinSpe,
    marketNegativeTraitFilter,
    marketPositiveTraitFilter,
    marketRaceFilter,
    deferredMarketSearch,
    marketSelectedTeam,
    shouldBuildMarketView,
    marketSubclassFilter,
  ]);

  const historyPlayerById = useMemo(
    () => (shouldBuildTransferHistoryView ? new Map(gameState.players.map((player) => [player.id, player] as const)) : new Map()),
    [gameState.players, shouldBuildTransferHistoryView],
  );
  const transferHistoryProfitById = useMemo(() => {
    if (!shouldBuildTransferHistoryView) {
      return new Map<string, number | null>();
    }

    const purchaseMap = new Map<string, number>();
    const profitByTransferId = new Map<string, number | null>();
    const sortedEntries = [...(historyFeed?.items ?? [])].sort(
      (left, right) => Date.parse(left.happenedAt) - Date.parse(right.happenedAt),
    );

    for (const entry of sortedEntries) {
      if (entry.type === "buy" && entry.toTeamId) {
        purchaseMap.set(`${entry.toTeamId}:${entry.playerId}`, entry.fee);
        continue;
      }

      if (entry.type === "sell" && entry.fromTeamId) {
        const key = `${entry.fromTeamId}:${entry.playerId}`;
        const previousBuyFee = purchaseMap.get(key);
        profitByTransferId.set(entry.transferId, previousBuyFee != null ? roundViewNumber(entry.fee - previousBuyFee, 2) : null);
        purchaseMap.delete(key);
      }
    }

    return profitByTransferId;
  }, [historyFeed, shouldBuildTransferHistoryView]);
  const transferHistoryClassOptions = useMemo(
    () =>
      shouldBuildTransferHistoryView
        ? Array.from(
            new Set(
              (historyFeed?.items ?? [])
                .map((entry) => historyPlayerById.get(entry.playerId)?.className ?? null)
                .filter(Boolean) as string[],
            ),
          ).sort((left, right) => left.localeCompare(right))
        : [],
    [historyFeed, historyPlayerById, shouldBuildTransferHistoryView],
  );
  const transferHistorySourceOptions = useMemo(
    () =>
      shouldBuildTransferHistoryView
        ? Array.from(new Set((historyFeed?.items ?? []).map((entry) => entry.source ?? "missing_source"))).sort(
            (left, right) => left.localeCompare(right),
          )
        : [],
    [historyFeed, shouldBuildTransferHistoryView],
  );

  const transferHistoryRows = useMemo(() => {
    if (!shouldBuildTransferHistoryView) {
      return [];
    }

    return (historyFeed?.items ?? [])
      .map((entry) => {
        const player = historyPlayerById.get(entry.playerId) ?? null;
        const portrait = getPlayerPortraitModel({
          id: entry.playerId,
          name: entry.playerName,
          portraitUrl: player?.portraitUrl ?? null,
          portraitPath: player?.portraitPath ?? null,
        });
        const playerRating = playerRatingsById.get(entry.playerId) ?? null;
        const normalizedSource = entry.source ?? "missing_source";
        const economyBenchmark = player ? resolvePlayerEconomyContract({ playerId: player.id, player }) : null;
        const salaryBenchmark =
          entry.type === "buy" && economyBenchmark?.expectedSalary != null
            ? economyBenchmark.expectedSalary
            : null;
        const salaryDelta =
          salaryBenchmark != null && Number.isFinite(entry.salary)
            ? roundViewNumber(entry.salary - salaryBenchmark, 2)
            : null;

        return {
          ...entry,
          player,
          portraitUrl: portrait.previewSrc ?? portrait.src,
          portraitInitials: portrait.initials,
          seasonLabel: entry.seasonLabel ?? entry.seasonId,
          className: player?.className ?? null,
          race: player?.race ?? null,
          pow: player?.coreStats.pow ?? null,
          spe: player?.coreStats.spe ?? null,
          men: player?.coreStats.men ?? null,
          soc: player?.coreStats.soc ?? null,
          ovr: playerRating?.ovrNormalized ?? null,
          pps: playerRating?.ppsSeason ?? null,
          mvs: playerRating?.mvs ?? null,
          guv: entry.type === "sell" ? transferHistoryProfitById.get(entry.transferId) ?? null : null,
          salaryBenchmark,
          salaryDelta,
          sourceKey: normalizedSource,
          sourceLabel: getTransferSourceLabel(entry.source),
        };
      })
      .filter((entry) => {
        const normalizedHistorySearch = deferredHistorySearch.trim().toLowerCase();
        const matchesSeason =
          historySeasonFilter === HISTORY_ALL_SEASONS_FILTER ||
          entry.seasonId === historySeasonFilter ||
          entry.seasonLabel === historySeasonFilter;
        const matchesType = historyTypeFilter === "ALL" || entry.type === historyTypeFilter;
        const matchesTeam =
          historyTeamFilter === "ALL" || entry.fromTeamId === historyTeamFilter || entry.toTeamId === historyTeamFilter;
        const matchesClass = historyClassFilter === "ALL" || entry.className === historyClassFilter;
        const matchesSource = historySourceFilter === "ALL" || entry.sourceKey === historySourceFilter;
        const matchesSearch =
          normalizedHistorySearch.length === 0 ||
          entry.playerName.toLowerCase().includes(normalizedHistorySearch);

        return matchesSeason && matchesType && matchesTeam && matchesClass && matchesSource && matchesSearch;
      });
  }, [
    historyFeed,
    deferredHistorySearch,
    historySeasonFilter,
    historyTeamFilter,
    historyTypeFilter,
    historyClassFilter,
    historyPlayerById,
    historySourceFilter,
    playerRatingsById,
    shouldBuildTransferHistoryView,
    transferHistoryProfitById,
  ]);

  const transferHistorySummary = useMemo(() => {
    const buyRows = transferHistoryRows.filter((row) => row.type === "buy");
    const sellRows = transferHistoryRows.filter((row) => row.type === "sell");
    const totalFee = transferHistoryRows.reduce((sum, row) => sum + row.fee, 0);
    const buyFee = buyRows.reduce((sum, row) => sum + row.fee, 0);
    const sellFee = sellRows.reduce((sum, row) => sum + row.fee, 0);
    const sellProfitRows = sellRows.filter((row) => row.guv != null);
    const totalProfit = sellProfitRows.reduce((sum, row) => sum + (row.guv ?? 0), 0);

    return {
      count: transferHistoryRows.length,
      buyFee,
      sellFee,
      averageFee: transferHistoryRows.length > 0 ? totalFee / transferHistoryRows.length : null,
      averageProfit: sellProfitRows.length > 0 ? totalProfit / sellProfitRows.length : null,
      netTransferBalance: sellFee - buyFee,
    };
  }, [transferHistoryRows]);
  const transferHistorySeasonBreakdown = useMemo(() => {
    if (!shouldBuildTransferHistoryView) {
      return [];
    }

    const counts = new Map<string, number>();
    for (const entry of historyFeed?.items ?? []) {
      const label = entry.seasonLabel ?? entry.seasonId;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return Array.from(counts.entries()).sort(([left], [right]) =>
      left.localeCompare(right, "de", { numeric: true }),
    );
  }, [historyFeed, shouldBuildTransferHistoryView]);
  const transferHistoryRequestedSeasonLabel = historyFeed?.saveContext?.requestedSeasonId ?? "Alle Seasons";
  const transferHistoryResolvedSeasonLabel =
    historyFeed?.saveContext?.requestedSeasonId == null
      ? "Alle Seasons"
      : historyFeed?.saveContext?.resolvedSeasonId ?? historyFeed?.scope?.seasonId ?? gameState.season.id;

  const hasSeasonResultsForHome = useMemo(
    () => {
      if (!shouldBuildHomeV2Overview) {
        return false;
      }
      return (
      seasonStandRows.some((row) => (row.points ?? 0) > 0) ||
      (gameState.seasonState.matchdayResults ?? []).some(
        (result) => result.seasonId === gameState.season.id && result.status === "preview_applied",
      )
      );
    },
    [gameState.season.id, gameState.seasonState.matchdayResults, seasonStandRows, shouldBuildHomeV2Overview],
  );
  const homeLeagueRows = useMemo(() => {
    if (!shouldBuildHomeV2Overview) {
      return [];
    }
    const rankedRows = [...seasonStandRows].sort((left, right) => {
      const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return (right.points ?? 0) - (left.points ?? 0);
    });
    const activeIndex = rankedRows.findIndex((row) => row.teamId === activeManagerTeamId);
    const selectedIndexes = new Set<number>();
    rankedRows.slice(0, 5).forEach((_, index) => selectedIndexes.add(index));
    if (activeIndex >= 0) {
      selectedIndexes.add(activeIndex);
      selectedIndexes.add(activeIndex - 1);
      selectedIndexes.add(activeIndex + 1);
    }

    return Array.from(selectedIndexes)
      .filter((index) => index >= 0 && index < rankedRows.length)
      .sort((left, right) => left - right)
      .map((index) => rankedRows[index]!);
  }, [activeManagerTeamId, seasonStandRows, shouldBuildHomeV2Overview]);
  const homeOwnerTeamRows = useMemo(() => {
    if (!shouldBuildHomeV2Overview) {
      return [];
    }
    const ownerTeams = filterTeamsByControlScope(gameState.teams, resolvedTeamControlSettings, "my_teams", effectiveActiveOwnerId);
    const ownerTeamIds = new Set(ownerTeams.map((team) => team.teamId));
    return seasonStandRows
      .filter((row) => ownerTeamIds.has(row.teamId))
      .sort((left, right) => (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY));
  }, [effectiveActiveOwnerId, gameState.teams, resolvedTeamControlSettings, seasonStandRows, shouldBuildHomeV2Overview]);
  const homeMultiplayerOwnerGroups = useMemo(() => {
    if (!shouldBuildHomeV2Overview) {
      return [];
    }
    const standingsByTeamId = new Map(seasonStandRows.map((row) => [row.teamId, row]));
    const teamById = new Map(gameState.teams.map((team) => [team.teamId, team]));

    return teamOwners
      .filter((owner) => owner.controlledTeamIds.length > 0 || owner.ownerId === AI_OWNER_ID)
      .map((owner) => {
        const teamIds = owner.ownerId === AI_OWNER_ID
          ? aiTeams.map((team) => team.teamId)
          : owner.controlledTeamIds;
        const rows = teamIds
          .map((teamId) => {
            const standingsRow = standingsByTeamId.get(teamId);
            const team = teamById.get(teamId);
            return {
              teamId,
              teamCode: standingsRow?.teamCode ?? team?.shortCode ?? teamId,
              teamName: standingsRow?.teamName ?? team?.name ?? teamId,
              rank: standingsRow?.rank ?? null,
              points: standingsRow?.points ?? null,
              cash: standingsRow?.cash ?? team?.cash ?? null,
              guv: standingsRow?.guv ?? null,
              salaryTotal: standingsRow?.salaryTotal ?? null,
              controlMode: resolvedTeamControlSettings[teamId]?.controlMode ?? (owner.ownerId === AI_OWNER_ID ? "ai" : "manual"),
            };
          })
          .sort((left, right) => (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY));
        const isActiveOwner = owner.ownerId === effectiveActiveOwnerId;
        const readyState =
          owner.ownerId === AI_OWNER_ID
            ? `${aiTeams.length} Teams werden automatisch geführt`
            : isActiveOwner
              ? gameFlowActionStep.label
              : owner.type === "remote_player"
                ? "Mitspieler wartet auf Freigabe"
                : "Bereit zur Steuerung";

        return {
          owner,
          teamIds,
          rows,
          readyState,
          isActiveOwner,
        };
      });
  }, [aiTeams, effectiveActiveOwnerId, gameFlowActionStep.label, gameState.teams, resolvedTeamControlSettings, seasonStandRows, teamOwners]);
  const homeActiveTeamLogo = selectedTeam ? getTeamLogoModel(selectedTeam) : null;
  const handleFormCardPlanSaved = (payload: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
    teamId: string;
    plans: FormCardPlanRecord[];
  }) => {
    if (payload.saveId !== activeSaveId) {
      return;
    }

    setGameState((current) =>
      mergeFormCardPlansIntoGameState(current, payload.plans, {
        seasonId: payload.seasonId,
        teamId: payload.teamId,
      }),
    );

  };
  const handleHumanLineupSaved = (payload: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
    teamId: string;
    silent: boolean;
    draft?: {
      seasonId: string;
      matchdayId: string;
      teamId: string;
      entries: unknown[];
      status?: string;
    } | null;
    saveVersion?: number | null;
    contentSignature?: string | null;
  }) => {
    const lineupSyncAllowed =
      payload.saveId === activeSaveId &&
      payload.seasonId === gameState.season.id &&
      payload.matchdayId === gameState.matchdayState.matchdayId &&
      canManageTeamId(payload.teamId);
    if (!lineupSyncAllowed) {
      return;
    }

    skipNextFullPersistCountRef.current += 1;

    if (payload.draft) {
      setGameState((current) => {
        const lineupDrafts = [...(current.seasonState.lineupDrafts ?? [])];
        const draftIndex = lineupDrafts.findIndex(
          (entry) =>
            entry.seasonId === payload.draft!.seasonId &&
            entry.matchdayId === payload.draft!.matchdayId &&
            entry.teamId === payload.draft!.teamId,
        );
        if (draftIndex >= 0) {
          lineupDrafts[draftIndex] = payload.draft as (typeof lineupDrafts)[number];
        } else {
          lineupDrafts.push(payload.draft as (typeof lineupDrafts)[number]);
        }
        return {
          ...current,
          saveVersion: payload.saveVersion ?? current.saveVersion,
          seasonState: {
            ...current.seasonState,
            lineupDrafts,
          },
        };
      });
    } else if (payload.saveVersion != null) {
      setGameState((current) => ({
        ...current,
        saveVersion: payload.saveVersion ?? current.saveVersion,
      }));
    }

    if (!payload.silent) {
      setFoundationActionFeedback({
        tone: "success",
        title: "Lineup gespeichert",
        detail: `${getTeamLockedName(payload.teamId)} ist für ${currentMatchdayDisplayLabel} aktualisiert. KI-Lineups werden bei Bedarf nachgezogen.`,
      });
    }
    void reloadLiveSeasonState("manual_apply", { compactReload: true });
    void ensureAiLineupsForCurrentMatchday("human_lineup_saved");
  };
  const seasonBriefingTeamAxes = selectedIdentity
    ? `${formatWholeNumber(selectedIdentity.pow)}/${formatWholeNumber(selectedIdentity.spe)}/${formatWholeNumber(selectedIdentity.men)}/${formatWholeNumber(selectedIdentity.soc)}`
    : "—";
  const seasonBriefingTeamCash =
    selectedTeam && Number.isFinite(selectedTeam.cash)
      ? selectedTeam.cash
      : selectedTeam && Number.isFinite(selectedTeam.budget)
        ? selectedTeam.budget
        : null;
  const seasonBriefingStepStatus =
    gameState.seasonState.newGameFlow?.steps?.find((step) => step.stepId === "season_intro")?.status ??
    seasonSetupFlow?.steps.find((step) => step.stepId === "season_intro")?.status ??
    null;
  const aiPreseasonStoredRun =
    (gameState.seasonState.aiPreseasonAutomationRuns?.[gameState.season.id] as FoundationAiPreseasonAutomationRun | undefined) ?? null;
  const aiPreseasonDisplayRun =
    normalizeAiPreseasonRun(
      aiPreseasonStoredRun?.status === "running"
        ? aiPreseasonStoredRun
        : aiPreseasonFeed?.run?.status === "running"
          ? aiPreseasonFeed.run
          : aiPreseasonStoredRun,
    );
  // "Neues Spiel"-Baseline festhalten: sobald der Assistent mit New-Game-Absicht
  // betreten wurde und ein echter (nicht-Bootstrap) Save aktiv ist, merken wir
  // dessen ID. shouldSuppressSeasonBriefingReopen unterdrückt den Season-Einstieg
  // nur, solange genau dieser Save aktiv bleibt — nach dem Erstellen wechselt der
  // aktive Save und die Unterdrückung endet automatisch.
  useEffect(() => {
    if (!newGameIntentRef.current) {
      return;
    }
    if (newGameIntentBaselineSaveIdRef.current === null && activeSaveId && !isFoundationBootstrapState) {
      newGameIntentBaselineSaveIdRef.current = activeSaveId;
    }
  }, [activeSaveId, isFoundationBootstrapState]);
  useEffect(() => {
    seasonBriefingAutoOpenedRef.current = null;
    briefingUrlHydratedRef.current = false;
    const briefingKey = buildSeasonBriefingDismissKey(activeSaveId, gameState.season.id);
    if (readSeasonBriefingDismissedFromStorage(activeSaveId, gameState.season.id)) {
      seasonBriefingDismissedRef.current.add(briefingKey);
      seasonBriefingAutoOpenedRef.current = briefingKey;
    }
  }, [activeSaveId, gameState.season.id]);
  useEffect(() => {
    if (isFoundationBootstrapState || briefingUrlHydratedRef.current) {
      return;
    }

    const requestedPanel = parseFoundationPanelFromUrl();
    if (requestedPanel !== "briefing") {
      briefingUrlHydratedRef.current = true;
      return;
    }

    briefingUrlHydratedRef.current = true;
    if (shouldSuppressSeasonBriefingReopen()) {
      setSeasonBriefingOpen(false);
      setFoundationPanel(null);
      clearSeasonBriefingFromUrl();
      return;
    }

    openSeasonBriefingPanel({ push: false });
  }, [activeSaveId, gameState.season.id, isFoundationBootstrapState, seasonBriefingStepStatus]);
  useEffect(() => {
    if (!seasonBriefingOpen) {
      return undefined;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSeasonBriefing(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [seasonBriefingOpen]);

  useEffect(() => {
    if (shouldSuppressSeasonBriefingReopen()) {
      return;
    }

    if (
      !shouldAutoOpenSeasonBriefing(gameState, seasonBriefingStepStatus) ||
      !seasonBriefingScheduleReady
    ) {
      return;
    }

    const autoOpenKey = buildSeasonBriefingDismissKey(activeSaveId, gameState.season.id);
    if (
      seasonBriefingAutoOpenedRef.current === autoOpenKey ||
      seasonBriefingDismissedRef.current.has(autoOpenKey) ||
      readSeasonBriefingDismissedFromStorage(activeSaveId, gameState.season.id)
    ) {
      return;
    }

    seasonBriefingAutoOpenedRef.current = autoOpenKey;
    openSeasonBriefingPanel({ push: false });
  }, [
    activeSaveId,
    gameState.gamePhase,
    gameState.season.currentMatchday,
    gameState.season.id,
    gameState.season.isCompleted,
    gameState.seasonState.newGameFlow?.steps,
    seasonBriefingScheduleReady,
    seasonBriefingStepStatus,
  ]);
  useEffect(() => {
    if (!seasonBriefingOpen || !shouldSuppressSeasonBriefingReopen()) {
      return;
    }

    setSeasonBriefingOpen(false);
    setFoundationPanel((current) => (current === "briefing" ? null : current));
    clearSeasonBriefingFromUrl();
  }, [
    activeSaveId,
    gameState,
    gameState.gamePhase,
    gameState.season.currentMatchday,
    gameState.season.id,
    gameState.season.isCompleted,
    seasonBriefingOpen,
    seasonBriefingStepStatus,
  ]);
  useEffect(() => {
    const isFirstSeason = /season[-_\s]*1\b/i.test(`${gameState.season.id} ${gameState.season.name}`);
    // Verwaister „running"-Lauf (Server-Prozess während der ~131 s-Draft-Laufzeit abgebrochen — Hot-Reload,
    // Navigation, Proxy-Timeout): am ROHEN Datensatz erkennen, BEVOR normalizeAiPreseasonRun ihn zu „failed"
    // umschreibt. Ohne diese Erkennung bliebe der (jetzt „failed" wirkende) Lauf als „bereits behandelt"
    // stehen und der Draft würde NIE erneut angestoßen → „KI pickt gar nicht / hängt für immer".
    const staleOrphanRun = isStaleAiPreseasonRun(aiPreseasonStoredRun);
    const normalizedStoredRun = normalizeAiPreseasonRun(aiPreseasonStoredRun);
    const storedStatus = normalizedStoredRun?.status ?? null;
    const alreadyHandled =
      !staleOrphanRun &&
      (storedStatus === "running" ||
        storedStatus === "completed" ||
        storedStatus === "skipped" ||
        storedStatus === "failed");
    const seasonIntroHandled =
      seasonBriefingStepStatus === "completed" || seasonBriefingStepStatus === "skipped";
    const firstSeasonTrigger =
      isFirstSeason &&
      seasonIntroHandled &&
      (gameFlowState.currentStepId === "scouting_facilities" || gameFlowState.currentStepId === "buy_players");
    const followingSeasonTrigger =
      !isFirstSeason &&
      gameFlowState.phase === "preseason" &&
      gameFlowState.currentStepId === "buy_players";
    const runKey = `${activeSaveId}:${gameState.season.id}`;

    if (staleOrphanRun) {
      // Verwaisten Lauf: den Session-Guard freigeben, damit der Draft (Bedingungen unten erfüllt) neu startet.
      aiPreseasonRunStartedRef.current.delete(runKey);
    }

    if (
      readMeta.source !== "sqlite" ||
      readMeta.readOnly ||
      isFoundationBootstrapState ||
      !activeSaveId ||
      activeSaveId === "loading-save" ||
      aiTeams.length === 0 ||
      aiPreseasonBusy ||
      alreadyHandled ||
      aiPreseasonRunStartedRef.current.has(runKey) ||
      (!firstSeasonTrigger && !followingSeasonTrigger)
    ) {
      return;
    }

    aiPreseasonRunStartedRef.current.add(runKey);
    void runAiPreseasonBackground();
  }, [
    activeSaveId,
    aiPreseasonBusy,
    aiPreseasonStoredRun?.status,
    aiTeams.length,
    gameFlowState.currentStepId,
    gameFlowState.phase,
    gameState.season.id,
    gameState.season.name,
    isFoundationBootstrapState,
    readMeta.readOnly,
    readMeta.source,
    seasonBriefingStepStatus,
  ]);
  useEffect(() => {
    const shouldPollAiPreseason =
      readMeta.source === "sqlite" &&
      !readMeta.readOnly &&
      activeSaveId &&
      activeSaveId !== "loading-save" &&
      (aiPreseasonBusy || aiPreseasonDisplayRun?.status === "running");

    if (!shouldPollAiPreseason) {
      return;
    }

    let cancelled = false;
    let inFlight = false;
    const pollAiPreseasonRun = async () => {
      if (cancelled || inFlight) {
        return;
      }
      inFlight = true;
      try {
        const nextGameState = await loadSave(activeSaveId, foundationSaveMode, { compactInitial: true });
        const nextRun =
          (nextGameState?.seasonState.aiPreseasonAutomationRuns?.[nextGameState.season.id] as FoundationAiPreseasonAutomationRun | undefined) ??
          null;
        if (!cancelled && nextRun) {
          const normalizedRun = normalizeAiPreseasonRun(nextRun);
          if (!normalizedRun) {
            return;
          }
          setAiPreseasonFeed((current) => ({
            ok: normalizedRun.status === "completed",
            skipped: normalizedRun.status === "skipped",
            reason: current?.reason,
            error: current?.error,
            run: normalizedRun,
          }));
          const preseasonRunFinished =
            normalizedRun.status !== "running" && normalizedRun.status !== "skipped";
          if (
            preseasonRunFinished &&
            aiPreseasonCompanionReloadRunIdRef.current !== normalizedRun.runId
          ) {
            aiPreseasonCompanionReloadRunIdRef.current = normalizedRun.runId;
            await reloadAfterMarketRosterApply();
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("AI-Preseason-Status konnte gerade nicht aktualisiert werden.", error);
        }
      } finally {
        inFlight = false;
      }
    };

    void pollAiPreseasonRun();
    const intervalId = window.setInterval(() => {
      void pollAiPreseasonRun();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    activeSaveId,
    aiPreseasonBusy,
    aiPreseasonDisplayRun?.status,
    foundationSaveMode,
    readMeta.readOnly,
    readMeta.source,
    reloadAfterMarketRosterApply,
  ]);
  // Generalprobe #1: a fresh Season 1 auto-fills all 32 AI rosters in the
  // BACKGROUND on the server (~40s), flagged via `seasonState.leagueSetupStatus`
  // ("in_progress" | "ready" | "failed"). Poll every 5s while "in_progress" so
  // the "Liga wird erstellt…" banner (see FoundationShellRouterBody) clears
  // itself without a manual reload.
  const leagueSetupStatus = gameState.seasonState.leagueSetupStatus ?? null;
  const [leagueSetupRetryBusy, setLeagueSetupRetryBusy] = useState(false);
  const [leagueSetupRetryError, setLeagueSetupRetryError] = useState<string | null>(null);
  useEffect(() => {
    if (
      readMeta.source !== "sqlite" ||
      !activeSaveId ||
      activeSaveId === "loading-save" ||
      leagueSetupStatus !== "in_progress"
    ) {
      return undefined;
    }

    let cancelled = false;
    const pollLeagueSetupStatus = async () => {
      const nextGameState = await loadSave(activeSaveId, foundationSaveMode, { compactInitial: true });
      if (!cancelled && nextGameState) {
        setGameState(nextGameState);
      }
    };

    const intervalId = window.setInterval(() => {
      void pollLeagueSetupStatus();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeSaveId, foundationSaveMode, leagueSetupStatus, loadSave, readMeta.source, setGameState]);

  // CHUNKED league-setup completion. The server's fresh-S1 whole-league draft is a single long (~40s)
  // detached task; a server-side time limit on long background tasks can cut it short, so the league is
  // flagged "ready" while many teams are still empty (the "Draft nach ~11 Teams abgebrochen" symptom).
  // Fix: once "ready", if several teams are still below their roster minimum in a fresh S1 preseason,
  // FINISH the draft CLIENT-side in SMALL chunks — each a separate scoped picks-run request (the same
  // endpoint the "KI-Teams nachpicken" button uses), ~4 teams/request so every call stays well under the
  // server task limit. Idempotent + resumable (only under-min teams are drafted; a reload mid-fill just
  // continues) and ref-guarded to run once per save. A normal mid-season load is excluded by the
  // preseason + "several teams under min" gate, so this never auto-drafts an established league.
  const leagueSetupAutoFinishRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      readMeta.source !== "sqlite" ||
      readMeta.readOnly ||
      !activeSaveId ||
      activeSaveId === "loading-save" ||
      leagueSetupStatus !== "ready" ||
      gameState.gamePhase !== "preseason_management"
    ) {
      return undefined;
    }
    const rosterCountByTeamId = new Map<string, number>();
    for (const entry of gameState.rosters) {
      rosterCountByTeamId.set(entry.teamId, (rosterCountByTeamId.get(entry.teamId) ?? 0) + 1);
    }
    const teamsToDraft = gameState.teams
      .filter((team) => {
        const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
        const { playerMin } = deriveRosterTargets(team, identity);
        return (rosterCountByTeamId.get(team.teamId) ?? 0) < playerMin;
      })
      .map((team) => team.teamId);
    // >= 4 under-min teams ⇒ an incomplete fresh-setup draft, not a normal single-team roster gap.
    if (teamsToDraft.length < 4 || leagueSetupAutoFinishRef.current === activeSaveId) {
      return undefined;
    }
    leagueSetupAutoFinishRef.current = activeSaveId;

    let cancelled = false;
    void (async () => {
      const CHUNK_SIZE = 4;
      for (let index = 0; index < teamsToDraft.length; index += CHUNK_SIZE) {
        if (cancelled) return;
        const chunk = teamsToDraft.slice(index, index + CHUNK_SIZE);
        try {
          await fetch(`/api/ai/picks-run?${buildCockpitScopeParams().toString()}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              withRoomContextBody(
                {
                  dryRun: false,
                  confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
                  teamScope: "all",
                  teamIds: chunk,
                  allowSetupAllTeams: true,
                },
                roomContext,
              ),
            ),
          });
        } catch {
          // A failed chunk must not abort the rest — later chunks (and a reload) still make progress.
        }
      }
      if (cancelled) return;
      const nextGameState = await loadSave(activeSaveId, foundationSaveMode, { compactInitial: true });
      if (!cancelled && nextGameState) {
        setGameState(nextGameState);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally keyed only on save + status: the draft runs once per save (ref-guarded); rosters/teams
    // are read at fire time (freshly loaded) and must not re-trigger the effect as they fill in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSaveId, leagueSetupStatus, gameState.gamePhase]);

  const retryLeagueSetup = async () => {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
      return;
    }

    setLeagueSetupRetryBusy(true);
    setLeagueSetupRetryError(null);
    try {
      const params = new URLSearchParams({
        saveId: activeSaveId,
        seasonId: gameState.season.id,
        source: readMeta.source,
      });
      // Route the retry through the same ORGANIC draft engine (/api/ai/picks-run) as the fresh-season-1
      // setup and the manual re-pick buttons, instead of the legacy /api/ai/roster-fill planner — so a
      // "failed setup" retry doesn't reproduce the bipolar auto-roster-fill bug it's meant to fix.
      const response = await fetch(`/api/ai/picks-run?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomContextBody(
            {
              dryRun: false,
              confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
              teamScope: "all",
              allowSetupAllTeams: true,
            },
            roomContext,
          ),
        ),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; executed?: boolean } | null;
      if (!response.ok || !payload || payload.error) {
        setLeagueSetupRetryError(payload?.error ?? "Liga-Setup konnte nicht erneut gestartet werden.");
        setGameState((current) => ({
          ...current,
          seasonState: { ...current.seasonState, leagueSetupStatus: "failed" },
        }));
        return;
      }
      const nextGameState = await loadSave(activeSaveId, foundationSaveMode, { compactInitial: true });
      setGameState((current) => {
        const base = nextGameState ?? current;
        return { ...base, seasonState: { ...base.seasonState, leagueSetupStatus: "ready" } };
      });
    } catch (error) {
      setLeagueSetupRetryError(error instanceof Error ? error.message : "Netzwerkfehler beim erneuten Liga-Setup.");
      setGameState((current) => ({
        ...current,
        seasonState: { ...current.seasonState, leagueSetupStatus: "failed" },
      }));
    } finally {
      setLeagueSetupRetryBusy(false);
    }
  };
  const closeSeasonBriefing = (markCompleted = true) => {
    const briefingKey = buildSeasonBriefingDismissKey(activeSaveId, gameState.season.id);
    const shouldPersistIntroStep = markCompleted && seasonBriefingStepStatus === "open";

    setSeasonBriefingOpen(false);
    setFoundationPanel((current) => (current === "briefing" ? null : current));
    seasonBriefingDismissedRef.current.add(briefingKey);
    seasonBriefingAutoOpenedRef.current = briefingKey;
    writeSeasonBriefingDismissedToStorage(activeSaveId, gameState.season.id);

    if (activeView !== "homeV2" && activeView !== "home") {
      setFoundationView("homeV2", setActiveView);
    } else {
      clearSeasonBriefingFromUrl();
    }

    if (shouldPersistIntroStep) {
      queueMicrotask(() => {
        updateNewGameFlowStepStatus("season_intro", "completed");
      });
    }
  };
  const completeSeasonBriefingAndContinue = () => {
    closeSeasonBriefing(true);
    const nextRequiredFlowStep = gameFlowState.steps.find(
      (step) => step.stepId !== "season_intro" && (step.status === "ready" || step.status === "warning" || step.status === "blocked"),
    );
    const nextFlowStep = nextRequiredFlowStep ?? gameFlowState.nextStep;

    if (
      nextFlowStep &&
      nextFlowStep.stepId !== "season_intro" &&
      nextFlowStep.targetPanel !== "season-briefing"
    ) {
      navigateToGameFlowStep(nextFlowStep.targetView, nextFlowStep.teamId ?? activeManagerTeamId, nextFlowStep.targetPanel);
      return;
    }

    setFoundationView("homeV2", setActiveView);
  };
  const assignTeamCaptainForSelectedTeam = async (playerId: string) => {
    if (!selectedTeam || readMeta.readOnly || assignTeamCaptainBusy) {
      if (readMeta.readOnly) {
        showReadOnlyNotice();
      }
      return;
    }
    if (!canManageTeamId(selectedTeam.teamId)) {
      showTeamManagementLockedNotice(getTeamLockedName(selectedTeam.teamId));
      return;
    }

    setAssignTeamCaptainBusy(true);
    try {
      const optimisticGameState = setTeamCaptain(gameState, selectedTeam.teamId, playerId);
      setGameState(optimisticGameState);
      const response = await fetch(
        `/api/singleplayer-state?${new URLSearchParams({
          source: readMeta.source,
          saveMode: foundationSaveMode,
        }).toString()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "assign-team-captain",
            saveId: activeSaveId,
            teamId: selectedTeam.teamId,
            playerId,
          }),
        },
      );
      if (!response.ok) {
        throw new Error("Kapitän konnte nicht gespeichert werden.");
      }
      updateNewGameFlowStepStatus("appoint_captain", "completed");
      const captain = optimisticGameState.teamCaptains?.find(
        (entry) => entry.seasonId === gameState.season.id && entry.teamId === selectedTeam.teamId,
      );
      setFoundationActionFeedback({
        tone: "success",
        title: "Kapitän ernannt",
        detail: captain ? `${captain.playerName} führt das Team in ${gameState.season.name}.` : "Saison-Kapitän gespeichert.",
      });
    } catch (error) {
      console.error(error);
      setFoundationActionFeedback({
        tone: "error",
        title: "Kapitän nicht gespeichert",
        detail: error instanceof Error ? error.message : "Bitte erneut versuchen.",
      });
      void reloadLiveSeasonState("manual_apply", { compactReload: true });
    } finally {
      setAssignTeamCaptainBusy(false);
    }
  };
  const homeWarnings = useMemo(() => {
    if (!shouldBuildHomeV2Overview) {
      return [] as Array<"missing_lineups" | "lineup_ready_not_submitted" | "missing_form_cards" | "form_cards_ready_not_submitted">;
    }
    if (!shouldBuildHomeV2Overview) {
      return [] as string[];
    }
    const warnings: string[] = [];
    if (!selectedTeam) warnings.push("no_active_team");
    if (!hasSeasonResultsForHome) warnings.push("season_started_no_results");
    if (activeViewContextWarning?.includes("keine abgeschlossenen")) warnings.push("no_final_standings");
    if (homeNextMatchdayStatus.openSlots > 0) warnings.push("missing_lineups");
    if (
      homeNextMatchdayStatus.openSlots === 0 &&
      !homeNextMatchdayStatus.resultAvailable &&
      !activeManagerLineupSubmitted
    ) {
      warnings.push("lineup_not_submitted");
    }
    if (homeNextMatchdayStatus.openSlots > 0 && !homeNextMatchdayStatus.hasFormCardPool) {
      warnings.push("formcard_pool_missing");
    } else if (
      homeNextMatchdayStatus.openSlots === 0 &&
      homeNextMatchdayStatus.hasFormCardPool &&
      !homeNextMatchdayStatus.hasFormCards &&
      !homeNextMatchdayStatus.resultAvailable
    ) {
      warnings.push("formcards_assignment_optional");
    }
    if (activeManagerTeamId) {
      const formCardAudit = buildFormCardSeasonUsageAudit(gameState, gameState.season.id).rows.find(
        (row) => row.teamId === activeManagerTeamId,
      );
      if ((formCardAudit?.unusedNegativeCards ?? 0) > 0) {
        warnings.push("unused_negative_formcards");
      }
    }
    if ((gameState.scenarioMeta?.scenarioType ?? activeContextMeta?.scenarioType ?? "").includes("manager_multiplayer") && !activeContextMeta?.roomId) {
      warnings.push("room_not_connected");
    }
    return Array.from(new Set(warnings));
  }, [
    activeContextMeta?.roomId,
    activeContextMeta?.scenarioType,
    activeManagerTeamId,
    activeViewContextWarning,
    gameState,
    gameState.scenarioMeta?.scenarioType,
    gameState.season.id,
    hasSeasonResultsForHome,
    homeNextMatchdayStatus.hasFormCardPool,
    homeNextMatchdayStatus.hasFormCards,
    homeNextMatchdayStatus.openSlots,
    activeManagerLineupSubmitted,
    selectedTeam,
    shouldBuildHomeV2Overview,
  ]);
  const homePlayerCards = useMemo(
    () => {
      if (!shouldBuildHomeV2Overview) {
        return [];
      }
      return selectedRosterTableRows
        .map((row) => {
          const portrait = getPlayerPortraitModel(row.player);
          const salary = getRosterEntryDisplaySalary(row.entry, row.player);
          const marketValue = getRosterEntryDisplayMarketValue(row.entry, row.player);
          const rating = playerRatingsById.get(row.player.id) ?? null;
          const seasonPerformance = playerSeasonPerformanceMap.get(row.player.id) ?? null;
          return {
            ...row,
            portrait,
            salary,
            marketValue,
            marketValueDelta: getPlayerDisplayMarketValueDelta(row.player, row.entry, gameState),
            salaryDelta: getRosterEntrySalaryDelta(row.entry, row.player, gameState),
            // XP-System abgeschafft: XP-Badge/Kachel entfällt (currentXP ist immer 0).
            xp: 0,
            fatigue: row.player.fatigue ?? 0,
            ppPow: rating?.ppPow ?? seasonPerformance?.pointsByArea.pow ?? null,
            ppSpe: rating?.ppSpe ?? seasonPerformance?.pointsByArea.spe ?? null,
            ppMen: rating?.ppMen ?? seasonPerformance?.pointsByArea.men ?? null,
            ppSoc: rating?.ppSoc ?? seasonPerformance?.pointsByArea.soc ?? null,
          };
        })
        .sort((left, right) => {
          const leftRoleScore = /star|core|starter/i.test(left.entry.roleTag ?? "") ? 1 : 0;
          const rightRoleScore = /star|core|starter/i.test(right.entry.roleTag ?? "") ? 1 : 0;
          if (rightRoleScore !== leftRoleScore) {
            return rightRoleScore - leftRoleScore;
          }

          const ppsDelta = (right.playerPps ?? Number.NEGATIVE_INFINITY) - (left.playerPps ?? Number.NEGATIVE_INFINITY);
          if (ppsDelta !== 0) {
            return ppsDelta;
          }

          const mvsDelta = (right.playerMvs ?? Number.NEGATIVE_INFINITY) - (left.playerMvs ?? Number.NEGATIVE_INFINITY);
          if (mvsDelta !== 0) {
            return mvsDelta;
          }

          return (right.playerOvr ?? Number.NEGATIVE_INFINITY) - (left.playerOvr ?? Number.NEGATIVE_INFINITY);
        })
        .slice(0, 6);
    },
    [gameState, playerRatingsById, playerSeasonPerformanceMap, selectedRosterTableRows, shouldBuildHomeV2Overview],
  );
	  const homeTasks = useMemo(
	    () => {
        if (!shouldBuildHomeV2Overview) {
          return [];
        }
        return filterGameInboxItems(activeTeamInboxItems.length > 0 ? activeTeamInboxItems : gameInboxItems, { includeDismissed: false, includeDone: false })
	        .filter((item) => item.category === "task" || item.category === "warning" || item.severity === "critical")
          .sort((left, right) => {
            const severityOrder: Record<GameInboxItem["severity"], number> = {
              critical: 0,
              warning: 1,
              info: 2,
            };
            return severityOrder[left.severity] - severityOrder[right.severity];
          })
	        .slice(0, 5);
      },
	    [activeTeamInboxItems, gameInboxItems, shouldBuildHomeV2Overview],
	  );
  const homeTodayCards = useMemo<Array<{
    key: string;
    kicker: string;
    title: string;
    detail: string;
    tone: "ready" | "warning" | "info";
    view: FoundationView;
  }>>(
    () => {
      if (!shouldBuildHomeV2Overview) {
        return [];
      }
      const cards: Array<{
        key: string;
        kicker: string;
        title: string;
        detail: string;
        tone: "ready" | "warning" | "info";
        view: FoundationView;
        urgency: number;
      }> = [
      {
        key: "lineup",
        kicker: "Heute wichtig",
        title: homeNextMatchdayStatus.openSlots > 0 ? `${homeNextMatchdayStatus.openSlots} Slots offen` : "Einsatz bereit",
        detail: homeNextMatchdayStatus.openSlots > 0 ? "erst Team setzen" : "direkt Arena spielen",
        tone: homeNextMatchdayStatus.openSlots > 0 ? "warning" : "ready",
        view: homeNextMatchdayStatus.openSlots > 0 ? "lineup" : "matchdayArena",
        urgency: homeNextMatchdayStatus.openSlots > 0 ? 0 : 2,
      },
      {
        key: "team",
        kicker: "Teamzustand",
        title: selectedStandingRow?.rank != null ? `Rang #${selectedStandingRow.rank}` : "Team prüfen",
        detail: selectedStandingRow?.points != null ? `${formatLocalePoints(selectedStandingRow.points, 1)} Punkte` : "Roster & Finanzen",
        tone: "info",
        view: "teams",
        urgency: 3,
      },
      {
        key: "tasks",
        kicker: "Aufgaben",
        title: homeTasks.length > 0 ? `${homeTasks.length} Quest${homeTasks.length === 1 ? "" : "s"}` : "Keine offenen Quests",
        detail: homeTasks[0]?.title ?? "bereit für den nächsten Zug",
        tone: homeTasks.some((task) => task.severity === "critical")
          ? "warning"
          : homeTasks.length > 0
            ? "info"
            : "ready",
        view: homeTasks.length > 0 ? "inboxV2" : "home",
        urgency: homeTasks.some((task) => task.severity === "critical") ? 1 : homeTasks.length > 0 ? 4 : 5,
      },
    ];
    return cards.sort((left, right) => left.urgency - right.urgency);
    },
    [homeNextMatchdayStatus.openSlots, homeTasks, selectedStandingRow?.points, selectedStandingRow?.rank, shouldBuildHomeV2Overview],
  );
	  const homeNewsItems = useMemo(() => {
	    const sourceItems = activeTeamInboxItems.length > 0 ? activeTeamInboxItems : gameInboxItems;
	    return sourceItems
	      .filter((item) => item.status === "open" && ["news", "result", "finance", "transfer", "facility"].includes(item.category))
	      .slice(0, 5);
	  }, [activeTeamInboxItems, gameInboxItems]);
	  const homeStoryItems = useMemo(() => {
	    const sourceItems = activeTeamInboxItems.length > 0 ? activeTeamInboxItems : gameInboxItems;
	    return sourceItems
	      .filter((item) => item.status === "open" && item.source.startsWith("story:"))
	      .slice(0, 3);
	  }, [activeTeamInboxItems, gameInboxItems]);

  const homeV2FacilityIds: FacilityId[] = [
    "scouting_office",
    "training_center",
    "analytics_room",
    "fan_shop",
    "recovery_center",
  ];
  const homeV2Facilities = useMemo(
    () => {
      if (!shouldBuildHomeV2Overview) {
        return [];
      }
      return homeV2FacilityIds.map((facilityId) => {
        const catalogEntry = FACILITY_CATALOG.find((entry) => entry.facilityId === facilityId);
        const level = getFacilityLevel(selectedTeamFacilityState, facilityId);
        return {
          facilityId,
          label: catalogEntry?.label ?? facilityId,
          level,
          maxLevel: catalogEntry?.maxLevel ?? 5,
        };
      });
    },
    [selectedTeamFacilityState, shouldBuildHomeV2Overview],
  );
  const homeV2TopPlayers = useMemo(
    () => {
      if (!shouldBuildHomeV2Overview) {
        return [];
      }
      return homePlayerCards.slice(0, 6).map((row, index) => {
        const rating = playerRatingsById.get(row.player.id) ?? null;
        const seasonPerformance = playerSeasonPerformanceMap.get(row.player.id) ?? null;
        const forecast = buildPlayerProgressionForecast({
          gameState,
          player: row.player,
          playerRating: rating,
          seasonPerformance,
          // XP-System abgeschafft: XP-Inputs neutralisiert (0/organisch).
          currentXP: 0,
          spentXP: 0,
          lifetimeXP: null,
        });
        const developmentInsight = buildPlayerDevelopmentInsight({
          gameState,
          player: row.player,
          currentRating: forecast.currentAbilityRating,
          performanceRating: rating?.ratingPps ?? rating?.ppsSeason ?? null,
          scoutingLevel: 5,
          scoutPotential: forecast.scoutPotential,
        });
        return {
          playerId: row.player.id,
          name: row.player.name,
          portraitUrl: row.portrait.src,
          portraitInitials: row.portrait.initials,
          rosterRank: index + 1,
          playerOvr: row.playerOvr,
          playerPps: row.playerPps,
          playerMvs: row.playerMvs,
          pow: row.player.coreStats.pow,
          spe: row.player.coreStats.spe,
          men: row.player.coreStats.men,
          soc: row.player.coreStats.soc,
          contractLength: row.entry.contractLength ?? null,
          marketValue: row.marketValue,
          highlight: index === 0 ? ("top" as const) : null,
          caRating: developmentInsight.currentRating,
          poRangeMin: developmentInsight.potentialRangeDisplay?.min ?? null,
          poRangeMax: developmentInsight.potentialRangeDisplay?.max ?? null,
        };
      });
    },
    [gameState, homePlayerCards, playerRatingsById, playerSeasonPerformanceMap, shouldBuildHomeV2Overview],
  );
  const homeV2ScheduleItems = useMemo(() => {
    if (!shouldBuildHomeV2Overview) {
      return [];
    }
    const currentIndex = gameState.season.matchdayIds.indexOf(gameState.matchdayState.matchdayId);
    return gameState.season.matchdayIds.slice(Math.max(0, currentIndex), currentIndex + 4).map((matchdayId, offset) => ({
      matchdayId,
      label: matchdayId,
      isCurrent: offset === 0,
      isPast: currentIndex >= 0 && gameState.season.matchdayIds.indexOf(matchdayId) < currentIndex,
    }));
  }, [gameState.matchdayState.matchdayId, gameState.season.matchdayIds, shouldBuildHomeV2Overview]);
  const homeV2BoardObjectives = useMemo(
    () => {
      if (!shouldBuildHomeV2Overview || !activeManagerTeamId) {
        return [];
      }
      return teamObjectiveOverview.objectives
        .filter((objective) => objective.teamId === activeManagerTeamId && objective.status !== "completed")
        .slice(0, 4)
        .map((objective) => ({
          objectiveId: objective.objectiveId,
          label: objective.label,
          status: objective.status,
          currentValue: objective.currentValue ?? null,
          targetValue: objective.targetValue ?? null,
        }));
    },
    [activeManagerTeamId, shouldBuildHomeV2Overview, teamObjectiveOverview.objectives],
  );
  const homeV2InboxItems = useMemo(
    () =>
      homeTasks.map((item) => ({
        id: item.itemId,
        title: item.title,
        detail: item.description,
        severity: item.severity,
      })),
    [homeTasks],
  );
  const facilitiesOverviewV2Snapshots = useMemo(
    () =>
      FACILITY_CATALOG.map((catalogEntry) => {
        const level = getFacilityLevel(selectedTeamFacilityState, catalogEntry.facilityId);
        const levelDefinition = getFacilityLevelDefinition(catalogEntry.facilityId, level);
        return {
          facilityId: catalogEntry.facilityId,
          label: catalogEntry.label,
          description: catalogEntry.description,
          level,
          maxLevel: catalogEntry.maxLevel,
          upkeep: levelDefinition?.seasonUpkeep ?? null,
          effectDescription: levelDefinition?.effectDescription ?? catalogEntry.effectDescription,
        };
      }),
    [selectedTeamFacilityState],
  );
  const visibleInboxItems = useMemo(
    () =>
      filterGameInboxItems(activeTeamInboxItems, {
        category: inboxCategoryFilter,
        includeDone: inboxIncludeDone,
        includeDismissed: inboxIncludeDismissed,
      }),
    [activeTeamInboxItems, inboxCategoryFilter, inboxIncludeDismissed, inboxIncludeDone],
  );
  const inboxV2Items = useMemo(
    () =>
      visibleInboxItems.map((item) => ({
        id: item.itemId,
        category: item.category.toUpperCase(),
        title: item.title,
        detail: item.description,
        severity: item.severity,
        status: item.status,
        choices:
          item.ctaLabel && item.targetView
            ? [{ id: "open-target", label: item.ctaLabel, detail: `Springe zu ${item.targetView}.` }]
            : undefined,
      })),
    [visibleInboxItems],
  );

  const sortedSeasonStandRows = useMemo(
    () => {
      if (!shouldBuildSortedSeasonStandRows(activeView as FoundationViewId)) {
        return [];
      }
      return sortRows(seasonStandRows, tableSorts.teamTable, {
        platzierung: () => Number.POSITIVE_INFINITY,
        platz: (row) => row.rank ?? Number.POSITIVE_INFINITY,
        mannschaft: (row) => row.teamName,
        kurzel: (row) => row.teamCode,
        punkte: (row) => row.points ?? Number.NEGATIVE_INFINITY,
        cash: (row) => row.cash ?? Number.NEGATIVE_INFINITY,
        cash_fc: (row) => row.cashFc ?? Number.NEGATIVE_INFINITY,
        startplatz: (row) => row.startplatz ?? Number.POSITIVE_INFINITY,
        rank_diff: (row) => row.rankDiff ?? Number.NEGATIVE_INFINITY,
        basis: (row) => row.sponsorBasis ?? Number.NEGATIVE_INFINITY,
        sponsor_total: (row) => row.sponsorTotal ?? Number.NEGATIVE_INFINITY,
        guv: (row) => row.guv ?? Number.NEGATIVE_INFINITY,
        cash_total: (row) => row.cashTotal ?? Number.NEGATIVE_INFINITY,
        form: (row) => seasonFormBonusByTeamId[row.teamId]?.total ?? row.financeForm ?? Number.NEGATIVE_INFINITY,
        gehalt: (row) => row.salaryTotal,
        vertragslange: (row) => row.avgContractLength ?? Number.NEGATIVE_INFINITY,
        transfers: (row) => row.transfersSeasonValue ?? Number.NEGATIVE_INFINITY,
      });
    },
    [activeView, seasonFormBonusByTeamId, seasonStandRows, tableSorts.teamTable],
  );
  const seasonTopPlayerRows = useMemo(() => {
    if (!shouldBuildSeasonTopPlayerRows) {
      return [];
    }
    if (
      shouldFetchSeasonRatingsFromApi &&
      seasonRatingsSlice.loading &&
      playerRatingsById.size === 0 &&
      !selectedSeasonSnapshot
    ) {
      return [];
    }
    const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
    const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));

    if (selectedSeasonSnapshot) {
      return [...(selectedSeasonSnapshot.playerPerformances ?? [])]
        .map((player) => {
          const activePlayer = playerById.get(player.playerId) ?? null;
          const team = player.teamId ? teamById.get(player.teamId) ?? null : null;
          const snapshotClassName = (player as { className?: string | null }).className ?? null;
          const totalPoints = player.pps ?? player.totalPoints ?? player.totalContribution ?? null;
          const breakdownAreaPoints = (player.disciplineBreakdown ?? []).reduce(
            (totals, entry) => {
              const discipline = gameState.disciplines.find((candidate) => candidate.id === entry.disciplineId) ?? null;
              const value = entry.totalContribution ?? 0;
              if (discipline?.category === "power") totals.pow += value;
              if (discipline?.category === "speed") totals.spe += value;
              if (discipline?.category === "mental") totals.men += value;
              if (discipline?.category === "social") totals.soc += value;
              return totals;
            },
            { pow: 0, spe: 0, men: 0, soc: 0 },
          );

          return {
            playerId: player.playerId,
            name: player.playerName,
            teamId: player.teamId ?? null,
            teamCode: player.teamCode ?? team?.shortCode ?? null,
            teamName: player.teamName ?? team?.name ?? "—",
            className: snapshotClassName ?? activePlayer?.className ?? null,
            pps: totalPoints,
            ppsRank: player.ppsRank ?? null,
            ovr: player.ovr ?? null,
            mvs: player.mvs ?? null,
            marketValue: player.marketValue ?? null,
            bracket: getTransfermarktBracket(player.marketValue ?? null),
            ppPow: player.powPoints ?? (breakdownAreaPoints.pow > 0 ? roundViewNumber(breakdownAreaPoints.pow, 1) : null),
            ppSpe: player.spePoints ?? (breakdownAreaPoints.spe > 0 ? roundViewNumber(breakdownAreaPoints.spe, 1) : null),
            ppMen: player.menPoints ?? (breakdownAreaPoints.men > 0 ? roundViewNumber(breakdownAreaPoints.men, 1) : null),
            ppSoc: player.socPoints ?? (breakdownAreaPoints.soc > 0 ? roundViewNumber(breakdownAreaPoints.soc, 1) : null),
          };
        })
        .sort((left, right) => {
          const ppsDelta = (right.pps ?? Number.NEGATIVE_INFINITY) - (left.pps ?? Number.NEGATIVE_INFINITY);
          if (ppsDelta !== 0) {
            return ppsDelta;
          }
          return left.name.localeCompare(right.name, "de");
        })
        .map((row, index) => ({ ...row, rank: index + 1 }));
    }

    const rosterByPlayerId = new Map(gameState.rosters.map((roster) => [roster.playerId, roster] as const));

    return gameState.players
      .map((player) => {
        const roster = rosterByPlayerId.get(player.id) ?? null;
        if (!roster) {
          return null;
        }

        const team = teamById.get(roster.teamId) ?? null;
        const rating = playerRatingsById.get(player.id) ?? null;
        const seasonPerformance = playerSeasonPerformanceMap.get(player.id) ?? null;
        const ledgerPlayer = seasonPointsLedger?.playerSummariesByPlayerId.get(player.id) ?? null;
        const marketValue = getPlayerDisplayMarketValue(player);
        const resolvedPps =
          rating?.ppsSeason ??
          seasonPerformance?.totalPoints ??
          ledgerPlayer?.totalPoints ??
          null;

        return {
          playerId: player.id,
          name: player.name,
          teamId: team?.teamId ?? null,
          teamCode: team?.shortCode ?? null,
          teamName: team?.name ?? "—",
          className: player.className ?? null,
          pps: resolvedPps != null ? roundViewNumber(resolvedPps, 1) : null,
          ppsRank: rating?.ppsSeasonRank ?? null,
          ovr: rating?.ovrNormalized ?? null,
          mvs: rating?.mvs ?? null,
          marketValue,
          bracket: getTransfermarktBracket(marketValue),
          ppPow:
            rating?.ppPow ??
            seasonPerformance?.pointsByArea.pow ??
            (ledgerPlayer != null ? roundViewNumber(ledgerPlayer.pointsByArea.power ?? 0, 1) : null),
          ppSpe:
            rating?.ppSpe ??
            seasonPerformance?.pointsByArea.spe ??
            (ledgerPlayer != null ? roundViewNumber(ledgerPlayer.pointsByArea.speed ?? 0, 1) : null),
          ppMen:
            rating?.ppMen ??
            seasonPerformance?.pointsByArea.men ??
            (ledgerPlayer != null ? roundViewNumber(ledgerPlayer.pointsByArea.mental ?? 0, 1) : null),
          ppSoc:
            rating?.ppSoc ??
            seasonPerformance?.pointsByArea.soc ??
            (ledgerPlayer != null ? roundViewNumber(ledgerPlayer.pointsByArea.social ?? 0, 1) : null),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((left, right) => {
        const ppsDelta = (right.pps ?? Number.NEGATIVE_INFINITY) - (left.pps ?? Number.NEGATIVE_INFINITY);
        if (ppsDelta !== 0) {
          return ppsDelta;
        }

        const ovrDelta = (right.ovr ?? Number.NEGATIVE_INFINITY) - (left.ovr ?? Number.NEGATIVE_INFINITY);
        if (ovrDelta !== 0) {
          return ovrDelta;
        }

        return left.name.localeCompare(right.name, "de");
      })
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [
    gameState.disciplines,
    gameState.players,
    gameState.rosters,
    gameState.teams,
    playerRatingsById,
    playerSeasonPerformanceMap,
    seasonPointsLedger,
    selectedSeasonSnapshot,
    shouldBuildSeasonTopPlayerRows,
  ]);

  const sortedSeasonTopPlayerRows = useMemo(
    () =>
      sortRows(seasonTopPlayerRows, tableSorts.seasonTopPlayers, {
        rank: (row) => row.rank,
        name: (row) => row.name,
        team: (row) => row.teamCode ?? row.teamName ?? "",
        pps: (row) => row.pps ?? Number.NEGATIVE_INFINITY,
        pow: (row) => row.ppPow ?? Number.NEGATIVE_INFINITY,
        spe: (row) => row.ppSpe ?? Number.NEGATIVE_INFINITY,
        men: (row) => row.ppMen ?? Number.NEGATIVE_INFINITY,
        soc: (row) => row.ppSoc ?? Number.NEGATIVE_INFINITY,
        ovr: (row) => row.ovr ?? Number.NEGATIVE_INFINITY,
        mvs: (row) => row.mvs ?? Number.NEGATIVE_INFINITY,
        marketValue: (row) => row.marketValue ?? Number.NEGATIVE_INFINITY,
        bracket: (row) => row.bracket ?? Number.NEGATIVE_INFINITY,
      }),
    [seasonTopPlayerRows, tableSorts.seasonTopPlayers],
  );

  const leagueTrainingLeaderRows = useMemo(() => {
    if (!shouldBuildLeagueTrainingLeaderRows(activeView)) {
      return [];
    }

    return buildLeagueTrainingLeaderRows(gameState);
  }, [activeView, gameState]);

  const leagueLeaderBoards = useMemo(() => {
    if (!shouldBuildLeagueLeaderBoards || seasonTopPlayerRows.length === 0) {
      return [];
    }

    return buildLeagueLeaderBoards({
      seasonRows: seasonTopPlayerRows,
      trainingRows: leagueTrainingLeaderRows,
    });
  }, [leagueTrainingLeaderRows, seasonTopPlayerRows, shouldBuildLeagueLeaderBoards]);

  // Ewige Tabelle — Live-Stand der laufenden Saison je Team, direkt aus dem
  // Season-Standings-Feed (siehe `shouldLoadSeasonOverviewFeed`, das den
  // Feed für "allTimeTable" mit-lädt). Ohne geladenen Feed bleibt die Ewige
  // Tabelle ehrlich auf Archiv-Saisons beschränkt (kein erfundener Live-Wert).
  const allTimeTableLiveStandingsByTeamId = useMemo(() => {
    if (!shouldBuildAllTimeTable || !seasonStandingsFeed) {
      return undefined;
    }
    // Der Standings-Feed liefert den Team-Marktwert nicht immer (z. B. an MD1) —
    // dann zeigte die Ewige-Tabelle-Live-Sicht bei allen Teams "—". Fallback auf
    // den live aus dem Kader summierten Marktwert (identisch zur Teams-Tabelle).
    // Client-sicher inline berechnet (kein Import aus AI-/Persistenz-Services,
    // die better-sqlite3/fs ins Client-Bundle ziehen wuerden).
    const playerMwById = new Map(
      gameState.players.map((player) => [
        player.id,
        player.displayMarketValue ?? player.marketValue ?? 0,
      ]),
    );
    const rosterMwByTeamId = new Map<string, number>();
    for (const entry of gameState.rosters ?? []) {
      rosterMwByTeamId.set(
        entry.teamId,
        (rosterMwByTeamId.get(entry.teamId) ?? 0) + (playerMwById.get(entry.playerId) ?? 0),
      );
    }
    return Object.fromEntries(
      seasonStandingsFeed.items.map((item) => [
        item.teamId,
        {
          rank: item.rank ?? null,
          points: item.points ?? null,
          marketValue: item.marketValueTotal ?? rosterMwByTeamId.get(item.teamId) ?? null,
          cash: item.cashTotal ?? item.cash ?? null,
        },
      ]),
    );
  }, [gameState, seasonStandingsFeed, shouldBuildAllTimeTable]);

  const allTimeTableModel = useMemo(() => {
    if (!shouldBuildAllTimeTable) {
      return null;
    }
    return buildAllTimeTableModel({
      gameState,
      selectedTeamId: activeManagerTeamId,
      liveStandingsByTeamId: allTimeTableLiveStandingsByTeamId,
    });
  }, [activeManagerTeamId, allTimeTableLiveStandingsByTeamId, gameState, shouldBuildAllTimeTable]);

  const seasonV2StandingsRows = useMemo(
    () =>
      sortedSeasonStandRows.map((row) => {
        const logo = getTeamLogoModel(row.team);
        const generalManager = getTeamGeneralManager(gameState, row.teamId);
        return {
          teamId: row.teamId,
          teamName: row.teamName,
          teamCode: row.teamCode,
          gmName: generalManager?.profile.name ?? null,
          gmTitle: generalManager?.profile.title ?? null,
          gmArchetype: generalManager?.profile.archetype ?? null,
          logoUrl: logo.src,
          logoInitials: logo.initials,
          rank: row.rank ?? null,
          rankDiff: row.rankDiff ?? null,
          points: row.points ?? null,
          pps: row.ppsTotal ?? null,
          pow: row.ppsPow ?? null,
          spe: row.ppsSpe ?? null,
          men: row.ppsMen ?? null,
          soc: row.ppsSoc ?? null,
          cash: row.cash ?? null,
          salaryTotal: row.salaryTotal ?? null,
          guv: row.guv ?? null,
          sponsorTotal: row.sponsorTotal ?? null,
          marketValueTotal: row.marketValueTotal ?? null,
          disciplineValues: {
            bonuspunkte: row.disciplineValues.bonuspunkte ?? null,
            tdm: row.disciplineValues.tdm ?? null,
            mini_dm: row.disciplineValues.mini_dm ?? null,
            gewichtheben: row.disciplineValues.gewichtheben ?? null,
            hockey: row.disciplineValues.hockey ?? null,
            breaking: row.disciplineValues.breaking ?? null,
            staffel: row.disciplineValues.staffel ?? null,
            time_trial: row.disciplineValues.time_trial ?? null,
            spurt: row.disciplineValues.spurt ?? null,
            climbing: row.disciplineValues.climbing ?? null,
            fechten: row.disciplineValues.fechten ?? null,
            schach: row.disciplineValues.schach ?? null,
            takeshi: row.disciplineValues.takeshi ?? null,
            tennis: row.disciplineValues.tennis ?? null,
            i_spy: row.disciplineValues.i_spy ?? null,
            wettessen: row.disciplineValues.wettessen ?? null,
            basketball: row.disciplineValues.basketball ?? null,
            football: row.disciplineValues.football ?? null,
            battlefield: row.disciplineValues.battlefield ?? null,
            eiskunst: row.disciplineValues.eiskunst ?? null,
            showcase: row.disciplineValues.showcase ?? null,
          },
          rosterCount: row.rosterCount ?? 0,
          avgContractLength: row.avgContractLength ?? null,
          isSelected: selectedTeam?.teamId === row.teamId,
          // D4 Rang-Movement: Δ Gesamtrang vs. letztem Spieltag (nicht saison-
          // übergreifend wie `rankDiff`, sondern feldrennen-spezifisch pro
          // Spieltag) — letzter Ledger-Eintrag; null am ersten Spieltag. Der
          // Ledger gilt für die LIVE-Season; auf Archiv-Snapshots daher bewusst
          // kein Live-Delta (sonst irreführend) → null.
          fieldRaceRankDelta: isViewingArchivedSeason
            ? null
            : fieldRaceRankDeltaByTeamId.get(row.teamId) ?? null,
        };
      }),
    [fieldRaceRankDeltaByTeamId, gameState, isViewingArchivedSeason, selectedTeam?.teamId, sortedSeasonStandRows],
  );
  const seasonV2PpRows = useMemo(
    () =>
      sortedPpAreaRows.map((row) => ({
        teamId: row.team.teamId,
        teamName: row.team.name,
        teamCode: row.team.shortCode,
        rank: row.rank,
        total: row.pps.total,
        pow: row.pps.pow,
        spe: row.pps.spe,
        men: row.pps.men,
        soc: row.pps.soc,
      })),
    [sortedPpAreaRows],
  );
  // T-073 (Performance): `seasonV2TopPlayers` und `seasonV2PlayerRows` bauten
  // beide `new Map(gameState.players.map(...))` mit identischem Deps-Array —
  // hier einmal extrahiert und in beiden Nachbar-Memos wiederverwendet.
  // `seasonV2PlayerById` referenziert nur `gameState.players`, genau wie
  // zuvor beide Inline-Maps, daher identische Invalidierung/Ergebnis.
  const seasonV2PlayerById = useMemo(
    () => new Map(gameState.players.map((player) => [player.id, player] as const)),
    [gameState.players],
  );
  const seasonV2TopPlayers = useMemo(() => {
    return sortedSeasonTopPlayerRows.slice(0, SEASON_V2_TOP_PLAYER_LIMIT).map((row) => {
      const player = seasonV2PlayerById.get(row.playerId) ?? null;
      const portrait = player ? getPlayerPortraitModel(player) : { src: null, initials: row.name.slice(0, 2).toUpperCase() };
      return {
        playerId: row.playerId,
        name: row.name,
        teamId: row.teamId ?? null,
        teamCode: row.teamCode ?? null,
        teamName: row.teamName ?? null,
        className: row.className ?? null,
        portraitUrl: portrait.src,
        portraitInitials: portrait.initials,
        rank: row.rank,
        pps: row.pps ?? null,
        ovr: row.ovr ?? null,
        mvs: row.mvs ?? null,
        ppPow: row.ppPow ?? null,
        ppSpe: row.ppSpe ?? null,
        ppMen: row.ppMen ?? null,
        ppSoc: row.ppSoc ?? null,
      };
    });
  }, [seasonV2PlayerById, sortedSeasonTopPlayerRows]);
  const seasonV2PlayerRows = useMemo(() => {
    return sortedSeasonTopPlayerRows.map((row) => {
      const player = seasonV2PlayerById.get(row.playerId) ?? null;
      const portrait = player ? getPlayerPortraitModel(player) : { src: null, initials: row.name.slice(0, 2).toUpperCase() };
      return {
        playerId: row.playerId,
        name: row.name,
        teamId: row.teamId ?? null,
        teamCode: row.teamCode ?? null,
        teamName: row.teamName ?? null,
        className: row.className ?? null,
        portraitUrl: portrait.src,
        portraitInitials: portrait.initials,
        rank: row.rank,
        pps: row.pps ?? null,
        ovr: row.ovr ?? null,
        mvs: row.mvs ?? null,
        ppPow: row.ppPow ?? null,
        ppSpe: row.ppSpe ?? null,
        ppMen: row.ppMen ?? null,
        ppSoc: row.ppSoc ?? null,
      };
    });
  }, [seasonV2PlayerById, sortedSeasonTopPlayerRows]);
  const seasonV2SelectedTeamSummary = useMemo(
    () =>
      selectedStandingRow
        ? {
            teamId: selectedStandingRow.teamId,
            teamName: selectedStandingRow.teamName,
            teamCode: selectedStandingRow.teamCode,
            rank: selectedStandingRow.rank ?? null,
            points: selectedStandingRow.points ?? null,
            pps: selectedStandingRow.ppsTotal ?? null,
            cash: selectedStandingRow.cash ?? null,
            salaryTotal: selectedStandingRow.salaryTotal ?? null,
            guv: selectedStandingRow.guv ?? null,
            sponsorTotal: selectedStandingRow.sponsorTotal ?? null,
            marketValueTotal: selectedStandingRow.marketValueTotal ?? null,
          }
        : null,
    [selectedStandingRow],
  );
  const seasonV2LeaderTeam = seasonV2StandingsRows[0] ?? null;
  const seasonV2MomentumTeam = useMemo(
    () =>
      [...seasonV2StandingsRows]
        .filter((row) => (row.rankDiff ?? 0) > 0)
        .sort(
          (left, right) =>
            (right.rankDiff ?? 0) - (left.rankDiff ?? 0) ||
            (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY),
        )[0] ??
      seasonV2StandingsRows[1] ??
      null,
    [seasonV2StandingsRows],
  );
  const seasonV2PressureTeam = useMemo(
    () =>
      [...seasonV2StandingsRows].sort((left, right) => {
        const leftPressure =
          (left.salaryTotal ?? 0) / Math.max(1, Math.abs(left.cash ?? 0) + Math.abs(left.salaryTotal ?? 0)) +
          ((left.guv ?? 0) < 0 ? Math.abs(left.guv ?? 0) / 1000 : 0);
        const rightPressure =
          (right.salaryTotal ?? 0) / Math.max(1, Math.abs(right.cash ?? 0) + Math.abs(right.salaryTotal ?? 0)) +
          ((right.guv ?? 0) < 0 ? Math.abs(right.guv ?? 0) / 1000 : 0);
        return rightPressure - leftPressure;
      })[0] ?? null,
    [seasonV2StandingsRows],
  );
  const seasonV2ArchiveRows = useMemo(
    () =>
      seasonHistorySnapshots.map((snapshot) => ({
        seasonId: snapshot.seasonId,
        seasonName: snapshot.seasonName,
        archivedAt: snapshot.archivedAt ?? null,
        teamCount: snapshot.finalStandings.length,
        playerCount: snapshot.playerPerformances.length,
      })),
    [seasonHistorySnapshots],
  );
  const seasonV2GmRows = useMemo(
    () =>
      gameState.teams
        .map((team) => {
          const logo = getTeamLogoModel(team);
          const generalManager = getTeamGeneralManager(gameState, team.teamId);
          const boardConfidence = teamObjectiveOverview.boardConfidence[team.teamId] ?? null;
          const snapshotHistory = seasonHistorySnapshots
            .map((snapshot) => {
              const snapshotGm = snapshot.gmAssignments?.find((entry) => entry.teamId === team.teamId) ?? null;
              if (!snapshotGm) return null;
              return {
                seasonId: snapshot.seasonId,
                seasonName: snapshot.seasonName,
                gmId: snapshotGm.gmId,
                gmName: snapshotGm.gmName,
                gmTitle: snapshotGm.gmTitle,
                source: snapshotGm.source,
                boardConfidenceValue: snapshotGm.boardConfidenceValue ?? null,
                boardPressure: snapshotGm.boardPressure ?? null,
                previousGmId: snapshotGm.previousGmId ?? null,
                dismissalReason: snapshotGm.dismissalReason ?? null,
              };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
          const currentHistory = generalManager
            ? [
                {
                  seasonId: gameState.season.id,
                  seasonName: gameState.season.name,
                  gmId: generalManager.profile.gmId,
                  gmName: generalManager.profile.name,
                  gmTitle: generalManager.profile.title,
                  source: generalManager.assignment.source,
                  boardConfidenceValue: boardConfidence?.value ?? null,
                  boardPressure: boardConfidence?.pressure ?? null,
                  previousGmId: generalManager.assignment.previousGmId ?? null,
                  dismissalReason: generalManager.assignment.dismissalReason ?? null,
                },
              ]
            : [];
          return {
            teamId: team.teamId,
            teamName: team.name,
            teamCode: team.shortCode,
            logoUrl: logo.src,
            logoInitials: logo.initials,
            gmId: generalManager?.profile.gmId ?? null,
            gmName: generalManager?.profile.name ?? null,
            gmTitle: generalManager?.profile.title ?? null,
            gmArchetype: generalManager?.profile.archetype ?? null,
            description: generalManager?.profile.description ?? null,
            marketDoctrine: generalManager?.profile.marketDoctrine ?? null,
            lineupDoctrine: generalManager?.profile.lineupDoctrine ?? null,
            facilityPriorities: generalManager?.profile.facilityPriorities ?? [],
            preferredTraits: generalManager?.profile.preferredTraits ?? [],
            influencePct: generalManager?.assignment.influencePct ?? null,
            source: generalManager?.assignment.source ?? null,
            assignedSeasonId: generalManager?.assignment.assignedSeasonId ?? null,
            boardConfidenceValue: boardConfidence?.value ?? null,
            boardPressure: boardConfidence?.pressure ?? null,
            previousGmId: generalManager?.assignment.previousGmId ?? null,
            dismissalReason: generalManager?.assignment.dismissalReason ?? null,
            history: [...currentHistory, ...snapshotHistory].map((entry) => {
              const profile = getTeamGeneralManagerProfile(entry.gmId);
              return {
                ...entry,
                gmTitle: entry.gmTitle || profile?.title || entry.gmId,
                gmName: entry.gmName || profile?.name || entry.gmId,
              };
            }),
          };
        })
        .sort((left, right) => (right.boardPressure ?? 0) - (left.boardPressure ?? 0) || left.teamName.localeCompare(right.teamName, "de")),
    [gameState, seasonHistorySnapshots, teamObjectiveOverview.boardConfidence],
  );
  const seasonV2DisciplineLeaders = useMemo(
    () =>
      archivedSeasonDisciplineLeaderboards
        .map((discipline) => {
          const leader = discipline.players[0] ?? null;
          if (!leader) {
            return null;
          }
          return {
            disciplineId: discipline.disciplineId,
            disciplineName: discipline.disciplineName,
            playerId: leader.playerId,
            playerName: leader.playerName,
            teamCode: leader.teamCode ?? null,
            appearances: leader.appearances,
            totalContribution: leader.totalContribution ?? null,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .slice(0, 6),
    [archivedSeasonDisciplineLeaderboards],
  );

  const seasonTopPlayerRankClassMaps = useMemo(
    () => ({
      pps: buildMetricRankClassMap(seasonTopPlayerRows.map((row) => ({ id: row.playerId, value: row.pps }))),
      pow: buildMetricRankClassMap(seasonTopPlayerRows.map((row) => ({ id: row.playerId, value: row.ppPow }))),
      spe: buildMetricRankClassMap(seasonTopPlayerRows.map((row) => ({ id: row.playerId, value: row.ppSpe }))),
      men: buildMetricRankClassMap(seasonTopPlayerRows.map((row) => ({ id: row.playerId, value: row.ppMen }))),
      soc: buildMetricRankClassMap(seasonTopPlayerRows.map((row) => ({ id: row.playerId, value: row.ppSoc }))),
      ovr: buildMetricRankClassMap(seasonTopPlayerRows.map((row) => ({ id: row.playerId, value: row.ovr }))),
      mvs: buildMetricRankClassMap(seasonTopPlayerRows.map((row) => ({ id: row.playerId, value: row.mvs }))),
    }),
    [seasonTopPlayerRows],
  );
  const seasonTopPlayerMetricPools = useMemo(
    () => ({
      pps: seasonTopPlayerRows.map((row) => row.pps),
      pow: seasonTopPlayerRows.map((row) => row.ppPow),
      spe: seasonTopPlayerRows.map((row) => row.ppSpe),
      men: seasonTopPlayerRows.map((row) => row.ppMen),
      soc: seasonTopPlayerRows.map((row) => row.ppSoc),
      ovr: seasonTopPlayerRows.map((row) => row.ovr),
      mvs: seasonTopPlayerRows.map((row) => row.mvs),
    }),
    [seasonTopPlayerRows],
  );
  const sortedTransferMarketRows = useMemo(
    () =>
      sortRows(transferMarketRows, tableSorts.transferMarket, {
        name: (row) => row.item.name,
        imageUrl: (row) => row.item.imageUrl ?? "",
        className: (row) => row.item.className,
        subclasses: (row) => row.item.subclasses.join(", "),
        traits: (row) => [...row.item.traitsPositive, ...row.item.traitsNegative].join(", "),
        race: (row) => row.item.race,
        alignment: (row) => row.item.alignment,
        gender: (row) => row.item.gender,
        marketValue: (row) => row.item.marketValue ?? Number.NEGATIVE_INFINITY,
        salary: (row) => row.item.salary ?? Number.NEGATIVE_INFINITY,
        ovr: (row) => row.item.ovr ?? Number.NEGATIVE_INFINITY,
        mvs: (row) => row.item.mvs ?? Number.NEGATIVE_INFINITY,
        currentAbilityTier: (row) => row.item.currentAbilityTier ?? "",
        potentialTier: (row) => row.item.potentialTier ?? "",
        trainingFormTier: (row) => row.item.trainingFormTier ?? "",
        developmentTrend: (row) => row.item.developmentTrend ?? "",
        developmentRoute: (row) => row.item.developmentRoute ?? "",
        regressionRisk: (row) => row.item.regressionRisk ?? "",
        marketValueSalaryRatio: (row) => row.item.marketValueSalaryRatio ?? Number.NEGATIVE_INFINITY,
        bracket: (row) => row.item.bracket ?? Number.NEGATIVE_INFINITY,
        pow: (row) => row.item.pow ?? Number.NEGATIVE_INFINITY,
        spe: (row) => row.item.spe ?? Number.NEGATIVE_INFINITY,
        men: (row) => row.item.men ?? Number.NEGATIVE_INFINITY,
        soc: (row) => row.item.soc ?? Number.NEGATIVE_INFINITY,
        topDisciplineScores: (row) => row.item.topDisciplineScores.map((entry) => entry.scoreTier ?? "").join(","),
        above20: (row) => row.item.above20 ?? Number.NEGATIVE_INFINITY,
        above40: (row) => row.item.above40 ?? Number.NEGATIVE_INFINITY,
        above60: (row) => row.item.above60 ?? Number.NEGATIVE_INFINITY,
        above80: (row) => row.item.above80 ?? Number.NEGATIVE_INFINITY,
        powerRating: (row) => row.item.powerRating ?? "",
        healthRating: (row) => row.item.healthRating ?? "",
        staminaRating: (row) => row.item.staminaRating ?? "",
        intelligenceRating: (row) => row.item.intelligenceRating ?? "",
        determinationRating: (row) => row.item.determinationRating ?? "",
        awarenessRating: (row) => row.item.awarenessRating ?? "",
        speedRating: (row) => row.item.speedRating ?? "",
        dexterityRating: (row) => row.item.dexterityRating ?? "",
        charismaRating: (row) => row.item.charismaRating ?? "",
        willRating: (row) => row.item.willRating ?? "",
        spiritRating: (row) => row.item.spiritRating ?? "",
        tormentRating: (row) => row.item.tormentRating ?? "",
        subclass1: (row) => row.item.subclasses[0] ?? "",
        subclass2: (row) => row.item.subclasses[1] ?? "",
        subclass3: (row) => row.item.subclasses[2] ?? "",
        traitPos1: (row) => row.item.traitsPositive[0] ?? "",
        traitPos2: (row) => row.item.traitsPositive[1] ?? "",
        traitPos3: (row) => row.item.traitsPositive[2] ?? "",
        traitNeg1: (row) => row.item.traitsNegative[0] ?? "",
        traitNeg2: (row) => row.item.traitsNegative[1] ?? "",
        traitNeg3: (row) => row.item.traitsNegative[2] ?? "",
        fitRace: (row) => row.item.fitRace ?? Number.NEGATIVE_INFINITY,
        fitSubclasses: (row) => row.item.fitSubclasses ?? Number.NEGATIVE_INFINITY,
        fitTraits: (row) => row.item.fitTraits ?? Number.NEGATIVE_INFINITY,
        fitAlignment: (row) => row.item.fitAlignment ?? Number.NEGATIVE_INFINITY,
        fitDisplay: (row) => row.item.fitDisplay,
      }),
    [tableSorts.transferMarket, transferMarketRows],
  );
  useEffect(() => {
    setMarketRenderLimit(TRANSFER_MARKET_INITIAL_RENDER_LIMIT);
  }, [
    activeView,
    marketAlignmentFilter,
    marketBracketFilter,
    marketClassFilter,
    marketGenderFilter,
    marketMaxSalary,
    marketMaxValue,
    marketMinMen,
    marketMinPow,
    marketMinRatio,
    marketMinSoc,
    marketMinSpe,
    marketNegativeTraitFilter,
    marketPositiveTraitFilter,
    marketRaceFilter,
    marketSearch,
    marketSubclassFilter,
    marketTeamId,
    tableSorts.transferMarket.direction,
    tableSorts.transferMarket.key,
  ]);
  const visibleTransferMarketRows = useMemo(
    () => sortedTransferMarketRows.slice(0, marketRenderLimit),
    [marketRenderLimit, sortedTransferMarketRows],
  );
  const marketLoadedCount = marketFeed?.items.length ?? 0;

  const transferWishlistByPlayerId = useMemo(
    () => new Map(transferWishlistEntries.map((entry) => [entry.playerId, entry] as const)),
    [transferWishlistEntries],
  );

  const transferDecisionBoard = useMemo(() => {
    const buyPick =
      sortedTransferMarketRows.find((row) => marketSelectedTeam && (row.item.fit ?? 0) > 0 && row.item.teamContextAvailable) ??
      sortedTransferMarketRows[0] ??
      null;
    const watchPick =
      sortedTransferMarketRows.find((row) => transferWishlistByPlayerId.has(row.item.playerId)) ??
      sortedTransferMarketRows.find((row) => (row.item.mvs ?? 0) >= 4 || (row.item.ovr ?? 0) >= 65) ??
      sortedTransferMarketRows[1] ??
      null;
    const sellPick =
      selectedRosterTableRows
        .map((row) => {
          const salary = getRosterEntryDisplaySalary(row.entry, row.player) ?? 0;
          const pps = row.playerPps ?? 0;
          return {
            row,
            salary,
            score: salary / Math.max(pps, 1),
          };
        })
        .sort((left, right) => right.score - left.score)[0] ?? null;

    const buyReasons = buyPick
      ? [
          formatFitDisplay(buyPick.item),
          buyPick.item.affordabilityStatus ? `Budget ${buyPick.item.affordabilityStatus}` : null,
          buyPick.item.bracket ? `Rolle ${buyPick.item.bracket}` : null,
        ].filter((entry): entry is string => Boolean(entry)).slice(0, 3)
      : ["Filter lockern"];
    const buyWarnings = buyPick
      ? [
          buyPick.item.teamContextAvailable ? null : "Team wählen",
          buyPick.item.affordabilityStatus && buyPick.item.affordabilityStatus !== "affordable" ? "Budget prüfen" : null,
          buyPick.item.rosterPressureStatus === "at_or_above_opt" ? "Kader voll" : null,
        ].filter((entry): entry is string => Boolean(entry)).slice(0, 3)
      : [];
    const watchReasons = watchPick
      ? [
          watchPick.item.ovr != null ? `OVR ${formatWholeNumber(watchPick.item.ovr)}` : null,
          watchPick.item.mvs != null ? `MVS ${formatPpsValue(watchPick.item.mvs)}` : null,
          watchPick.item.marketValue != null ? formatTransfermarktCurrency(watchPick.item.marketValue) : null,
        ].filter((entry): entry is string => Boolean(entry)).slice(0, 3)
      : ["Kandidaten merken"];
    const sellReasons = sellPick
      ? [
          `Gehalt ${formatMoney(sellPick.salary)}`,
          sellPick.row.playerPps != null ? `PPs ${formatPpsValue(sellPick.row.playerPps)}` : null,
          sellPick.score > 1 ? "teuer pro PPs" : "Verkaufskandidat",
        ].filter((entry): entry is string => Boolean(entry)).slice(0, 3)
      : ["Kader halten"];

    return {
      buyPick,
      buyReasons,
      buyWarnings,
      watchPick,
      watchReasons,
      sellPick,
      sellReasons,
    };
  }, [marketSelectedTeam, selectedRosterTableRows, sortedTransferMarketRows, transferWishlistByPlayerId]);

  const activeMarketFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (marketSearch.trim()) chips.push(`Suche: ${marketSearch.trim()}`);
    if (marketClassFilter !== "ALL") chips.push(`Klasse: ${marketClassFilter}`);
    if (marketRaceFilter !== "ALL") chips.push(`Volk: ${marketRaceFilter}`);
    if (marketSubclassFilter !== "ALL") chips.push(`Subklasse: ${marketSubclassFilter}`);
    if (marketAlignmentFilter !== "ALL") chips.push(`Alignment: ${marketAlignmentFilter}`);
    if (marketGenderFilter !== "ALL") chips.push(`Gender: ${marketGenderFilter}`);
    if (marketPositiveTraitFilter !== "ALL") chips.push(`Trait+: ${marketPositiveTraitFilter}`);
    if (marketNegativeTraitFilter !== "ALL") chips.push(`Trait-: ${marketNegativeTraitFilter}`);
    if (marketBracketFilter !== "ALL") chips.push(`Rolle: ${marketBracketFilter}`);
    if (marketMaxValue !== marketCashMaxValue) chips.push(`MW bis ${formatLocalePoints(marketMaxValue, marketMaxValue % 1 === 0 ? 0 : 1)}`);
    if (marketMaxSalary < 40) chips.push(`Gehalt bis ${marketMaxSalary}`);
    if (marketMinRatio > 0) chips.push(`Ratio ab ${marketMinRatio}`);
    if (marketMinPow > 1) chips.push(`POW ab ${marketMinPow}`);
    if (marketMinSpe > 1) chips.push(`SPE ab ${marketMinSpe}`);
    if (marketMinMen > 1) chips.push(`MEN ab ${marketMinMen}`);
    if (marketMinSoc > 1) chips.push(`SOC ab ${marketMinSoc}`);
    return chips.slice(0, 10);
  }, [
    marketAlignmentFilter,
    marketBracketFilter,
    marketCashMaxValue,
    marketClassFilter,
    marketGenderFilter,
    marketMaxSalary,
    marketMaxValue,
    marketMinMen,
    marketMinPow,
    marketMinRatio,
    marketMinSoc,
    marketMinSpe,
    marketNegativeTraitFilter,
    marketPositiveTraitFilter,
    marketRaceFilter,
    marketSearch,
    marketSubclassFilter,
  ]);

  const sortedTransferHistoryRows = useMemo(
    () =>
      sortRows(transferHistoryRows, tableSorts.transferHistory, {
        name: (row) => row.playerName,
        season: (row) => row.seasonLabel,
        from: (row) => row.fromTeamName ?? row.fromTeamId ?? "FA",
        to: (row) => row.toTeamName ?? row.toTeamId ?? "FA",
        type: (row) => row.type,
        fee: (row) => row.fee,
        guv: (row) => row.guv ?? Number.NEGATIVE_INFINITY,
        marketValue: (row) => row.marketValue,
        pow: (row) => row.pow ?? Number.NEGATIVE_INFINITY,
        spe: (row) => row.spe ?? Number.NEGATIVE_INFINITY,
        men: (row) => row.men ?? Number.NEGATIVE_INFINITY,
        soc: (row) => row.soc ?? Number.NEGATIVE_INFINITY,
        salary: (row) => row.salary,
        className: (row) => row.className ?? "",
        source: (row) => row.sourceLabel,
        remainingContractLength: (row) => row.remainingContractLength ?? Number.NEGATIVE_INFINITY,
        happenedAt: (row) => Date.parse(row.happenedAt),
      }),
    [tableSorts.transferHistory, transferHistoryRows],
  );
  const historyAllSeasonsSelected = historySeasonFilter === HISTORY_ALL_SEASONS_FILTER;
  const historyPageCount = useMemo(
    () =>
      historyAllSeasonsSelected
        ? Math.max(1, Math.ceil(sortedTransferHistoryRows.length / TRANSFER_HISTORY_ALL_SEASONS_PAGE_SIZE))
        : 1,
    [historyAllSeasonsSelected, sortedTransferHistoryRows.length],
  );
  const visibleTransferHistoryRows = useMemo(
    () =>
      historyAllSeasonsSelected
        ? sortedTransferHistoryRows.slice(
            (historyPage - 1) * TRANSFER_HISTORY_ALL_SEASONS_PAGE_SIZE,
            historyPage * TRANSFER_HISTORY_ALL_SEASONS_PAGE_SIZE,
          )
        : sortedTransferHistoryRows,
    [historyAllSeasonsSelected, historyPage, sortedTransferHistoryRows],
  );
  const historyVisibleRangeLabel = useMemo(() => {
    if (sortedTransferHistoryRows.length === 0) {
      return "0–0";
    }
    if (!historyAllSeasonsSelected) {
      return `1–${visibleTransferHistoryRows.length}`;
    }
    const start = (historyPage - 1) * TRANSFER_HISTORY_ALL_SEASONS_PAGE_SIZE + 1;
    const end = start + visibleTransferHistoryRows.length - 1;
    return `${start}–${end}`;
  }, [historyAllSeasonsSelected, historyPage, sortedTransferHistoryRows.length, visibleTransferHistoryRows.length]);
  useEffect(() => {
    const maxLoadedPage = Math.max(1, historyPageCount);
    if (historyPage > maxLoadedPage) {
      setHistoryPage(maxLoadedPage);
    }
  }, [historyPage, historyPageCount]);

  const {
    shouldShowArenaBackToLineup,
    seasonEndRosterActionsActive,
    selectedTeamRosterActionsAvailable,
    selectedTeamRosterActionHint,
    screenPrimaryAction,
    readOnlyBannerMessage,
  } = useFoundationCrossTabScreenPrimaryAction({
    activeView,
    activeManagerMatchdayReady,
    activeManagerArenaBlockerReason,
    gameState,
    readMeta,
    localSeasonTransitionGate,
    marketTeamId,
    marketBuyBusy,
    marketPreviewPlayer,
    marketSelectedTeam,
    selectedTeam,
    selectedTeamCanManage,
    selectedTeamHasUnsavedChanges,
    isSelectedTeamManagementLocked,
    inboxPrimaryTeamItem,
    canManageTeamId,
    setFoundationView,
    setActiveView,
    navigateHomeTab,
    navigateToInboxItem,
    openMarketOfferPanel,
  });

  const showCompactHeader = activeView !== "home";
  const foundationActivities = useFoundationCrossTabFoundationActivities({
    isSaveBusy,
    aiPreseasonBusy,
    aiPreseasonDisplayRun,
    aiLineupEnsureBusy,
    aiLineupEnsureTeamsCount: aiLineupEnsureTeams.length,
    aiLineupMissingTeamIdsCount: aiLineupMissingTeamIds.length,
    aiLineupEnsureFeed,
    adminSimulationBusy,
    adminSimulationRun,
    seasonTransitionBusy,
    preSeasonWorkflowBusy,
    seasonStartResetBusy,
    newGameBusy,
    rosterFillBusy,
    aiTeamsRefillBusy: bulkAiPicksRefillBusy,
    adminBalancingBusy,
    cockpitBusyKey,
    aiTeamsCount: aiTeams.length,
    marketBuyBusy,
    marketSellBusy,
    contractRenewalBusy,
    sponsorChoiceBusy,
    facilityUpgradeBusy,
    facilityMaintenanceBusy,
    assignTeamCaptainBusy,
    marketAiPreviewBusy,
    liveSyncStatus,
    showIdleReady: gameState.season.id !== "loading",
    fetchSlowWarning,
  });

  const isAdminView = activeView === "admin";
  const isGeneratorView = activeView === "generator";
  const isDebugView = activeView === "debug";
  const isTrainingCompactOrLegacyView = activeView === "training" || activeView === "trainingCompact";
  const seasonV2HydrationPhase: "shell" | "full" = "full";
  const seasonRatingsPlayerIds: string[] = [];
  void isAdminView;
  void isGeneratorView;
  void isDebugView;
  void isTrainingCompactOrLegacyView;
  void isMarketOfferPanelOpen;
  void seasonV2HydrationPhase;
  void seasonRatingsPlayerIds;

  const matchdayResultSourceBadgeLabel = useMemo(
    () => getViewSourceBadgeLabel("matchdayResult", activeContextMeta),
    [activeContextMeta],
  );

  const foundationMatchdayResultHostProps: FoundationMatchdayResultShellHostProps = {
    sourceBadgeLabel: matchdayResultSourceBadgeLabel,
    matchdaySummary,
    activeMatchdaySummaryId,
    matchdaySummaryOptions,
    activeTeamMatchdaySummaryRow,
    activeManagerTeamId,
    selectedTeam,
    resolvedTeamControlSettings,
    setSelectedMatchdaySummaryId,
    setActiveView,
    openTeamProfileById,
    triggerGlobalNext,
  };

  const foundationSeasonPreviewHostProps: FoundationSeasonPreviewShellHostProps = {
    activeSaveId,
    gameState,
    standingsPreviewFeed,
    tableColumnPreferences,
    tableSorts,
    isTableColumnVisible,
    setTableColumnVisible,
    getTableColumnWidth,
    getTableHeaderDragProps,
    startTableColumnResize,
    resetTableColumnWidth,
    toggleTableSort,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
    ColumnVisibilityManager,
    SortableHeader,
    openTeamProfileById,
  };

  const historySourceBadgeLabel = useMemo(
    () => getViewSourceBadgeLabel("historyV2", activeContextMeta),
    [activeContextMeta],
  );

  const foundationHistoryV2HostProps: FoundationHistoryV2ShellHostProps = {
    sourceBadgeLabel: historySourceBadgeLabel,
    activeSaveId,
    saveName: activeSaveName,
    gameState,
    ownTeamId: selectedTeamId ?? null,
    historyFeed,
    playerRatingsById,
    transferHistorySort: tableSorts.transferHistory,
    seasonFilter: historySeasonFilter,
    onSeasonFilterChange: setHistorySeasonFilter,
    teamFilter: historyTeamFilter,
    onTeamFilterChange: setHistoryTeamFilter,
    typeFilter: historyTypeFilter,
    onTypeFilterChange: setHistoryTypeFilter,
    classFilter: historyClassFilter,
    onClassFilterChange: setHistoryClassFilter,
    sourceFilter: historySourceFilter,
    onSourceFilterChange: setHistorySourceFilter,
    search: historySearch,
    onSearchChange: setHistorySearch,
    teamOptions: gameState.teams.map((team) => ({
      teamId: team.teamId,
      name: team.name,
      shortCode: team.shortCode,
    })),
    onOpenPlayer: openPlayerProfileById,
    onOpenTeam: openTeamProfileById,
    hasMore: (historyFeed?.total ?? 0) > (historyFeed?.items.length ?? 0),
    loadingMore: historyLoadingMore,
    onLoadMore: loadMoreHistoryFeed,
  };

  const transferSeasonOptions = useMemo(() => {
    const labelBySeasonId = new Map<string, string>();
    labelBySeasonId.set(
      gameState.season.id,
      getCanonicalSeasonLabel({
        seasonId: gameState.season.id,
        seasonName: gameState.season.name,
      }),
    );

    for (const entry of gameState.transferHistory) {
      labelBySeasonId.set(
        entry.seasonId,
        getCanonicalSeasonLabel({
          seasonId: entry.seasonId,
          seasonName: entry.seasonLabel ?? null,
        }),
      );
    }

    for (const snapshot of gameState.seasonState.seasonSnapshots ?? []) {
      labelBySeasonId.set(
        snapshot.seasonId,
        getCanonicalSeasonLabel({
          seasonId: snapshot.seasonId,
          seasonName: snapshot.seasonName,
        }),
      );
    }

    return Array.from(labelBySeasonId.entries())
      .sort(([leftId], [rightId]) => rightId.localeCompare(leftId, "de", { numeric: true }))
      .map(([seasonId, label]) => ({ seasonId, label }));
  }, [
    gameState.season.id,
    gameState.season.name,
    gameState.seasonState.seasonSnapshots,
    gameState.transferHistory,
  ]);


  const foundationTeamsViewHostProps: Omit<FoundationTeamsViewHostProps, "selectedTeam"> = {
    activeView,
    selectedTeamId,
    gameState,
    tableSorts,
    seasonStandRows,
    shouldBuildDisciplineRanks,
    disciplineRankRows,
    teamsViewSort: tableSorts.teamsView,
    teamRosterFocusMode,
    teamRosterRoleFilter,
    rosterPlayers,
    tableColumnPreferences,
    isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
    buildTeamDetailDrawerData,
    formatMoney,
    getRosterEntrySalarySortValue,
    selectedRosterTableRows,
    shouldBuildTeamContracts,
    showExtendedTeamPanels,
    selectedTeamDetailTab,
    getRosterEntryDisplayMarketValue,
    getRosterEntryDisplaySalary,
    getRosterEntryCurrentSeasonSalary,
    getRosterEntrySalaryDelta,
    playerRatingsById,
    getRankHeatClass,
    SortableHeader,
    getTableColumnWidth,
    getTableHeaderDragProps,
    toggleTableSort,
    startTableColumnResize,
    resetTableColumnWidth,
    joinClassNames,
    getOwnerTeamHighlightClass,
    resolvedTeamControlSettings,
    scheduleActiveManagerTeam,
    openTeamProfileById,
    onOpenSeason: () => setFoundationView("seasonV2", setActiveView),
    formatLocalePoints,
    getSeasonCashHeatClass,
    formatWholeNumber,
    formatNullableMoney,
    formatSignedDisplayMoney,
    getTeamHistoryRankToneClass,
    selectedTeamObjectives,
    teamObjectiveOverview,
    selectedTeamSponsorContract,
    selectedTeamSponsorOffers,
    selectedTeamCommercialRating,
    sponsorChoiceMessage,
    sponsorChoiceBusy,
    chooseTeamSponsor,
    renderMetricBar,
    leaguePlayerHeatPools,
    setTeamRosterRoleFilter,
    setTeamRosterFocusMode,
    selectedStandingRow,
    selectedRoster,
    showTeamContractPreviewRows,
    setShowTeamContractPreviewRows,
    contractRenewalBusy,
    openContractRenewalNegotiation,
    openMarketSellModal,
    openPlayerDrawerById,
    getPlayerPortraitModel,
    getClassColorClassName,
    renderEconomyDelta,
    getPlayerDisplayMarketValueDelta,
    formatPpsValue,
    formatDisplayMoney,
    formatContractShapeLabel,
    formatMoraleContractIntentLabel,
    getPlayerDisplaySalary,
    selectedIdentity,
    aiTeams,
    isPending,
    isReadOnlyMode: readMeta.readOnly,
    showReadOnlyNotice,
    setGameState,
    runAiTurn,
    setShowExtendedTeamPanels,
    formatTransfermarktCurrency,
    roundViewNumber,
    getLineupDraftSideCounts,
    isSelectedTeamManagementLocked,
    selectedTeamControl,
    formatTeamControlModeLabel,
    openTeamDrawerById,
    playerSeasonPerformanceMap,
    confirmContractRenewalNegotiation,
    formatObjectiveStatusLabel,
    formatCockpitReason,
    getPoolHeatClass,
    getResponsiveTableImageSize,
    getTeamLogoModel,
    setContractRenewalNegotiation,
    setShowSelectedRosterPpsBreakdown,
    setShowTeamDisciplines,
    toggleTransferSellMarker,
    transferSellMarkerKeySet,
    selectedBoardConfidence,
    showTeamDisciplines,
    contractRenewalNegotiation,
    showSelectedRosterPpsBreakdown,
    selectedTeamCanManage,
    selectedTeamRosterActionsAvailable,
    selectedTeamRosterActionHint,
    contractRenewalMessage,
    contractRenewalError,
    marketSellBusy,
    // Manuelles KI-Pick-Auffüllen für genau dieses Team (Kader-Tab).
    runTeamPicksRefill,
    teamPicksRefillBusyTeamId,
    teamPicksRefillMessage,
    // Saison-Kapitän wählen direkt aus dem Kader-Tab (wie AI-Teams). Kandidaten
    // + Führungs-Breakdown baut die Kaderansicht selbst aus `gameState`; hier
    // reicht der aktuelle Kapitän, der Assign-Handler und der Busy-State.
    selectedTeamCaptainPlayerId,
    assignTeamCaptainForSelectedTeam,
    assignTeamCaptainBusy,
    // D1 Feld-Form-Strip auf dem Team-Profil (Neuer Look).
    fieldRaceRecentForm: selectedTeamFieldRaceForm,
    fieldRacePlayedMatchdayCount,
  };

  const foundationCockpitHostProps: FoundationCockpitHostProps = {
    activeSaveId,
    activeSaveName,
    activeSaveSummary,
    activeView,
    adjustTableColumnWidth,
    aiLineupApplyTeams,
    aiTeams,
    canonicalSeasonLabel,
    cashApplyFeed,
    currentMatchdayDisciplineSchedule,
    currentMatchdayDisplayLabel,
    currentSeasonCashPrizeApplyLogs,
    enableAiLineupApplyForAiTeams,
    formatFeatureAuditStatus,
    formatLocalePoints,
    formatMoney,
    formatNullableMoney,
    formatSignedNumber,
    gameState,
    getBusyActionReason: getFoundationBusyActionReason,
    getCockpitBusyReason: getFoundationCockpitBusyReason,
    getPlayerPortraitModel,
    getReadOnlyActionReason: getFoundationReadOnlyActionReason,
    getTableColumnWidth,
    getTableHeaderDragProps,
    historyFeed,
    inferSaveTypeLabel,
    isSaveBusy,
    isTableColumnVisible,
    localSeasonTransitionGate,
    manualTeams,
    marketBuyPreview,
    marketFeed,
    marketSelectedTeam,
    matchdayAdvanceFeed,
    matchdayAutoRunFeed,
    matchdayAutoRunIncludeWarningLineups,
    matchdayAutoRunOverwriteExistingLineups,
    matchdayAutoRunStopOnTie,
    matchdayMvpForceReplaceExisting,
    matchdayMvpScoringFeed,
    moveTableColumn,
    openPlayerDrawerById,
    openTeamProfileById,
    passiveTeams,
    preSeasonWorkflowBusy,
    preSeasonWorkflowError,
    preSeasonWorkflowFeed,
    prizeApplyState,
    prizeAuditCompact,
    prizePreviewFeed,
    readMeta,
    readSourceLabel,
    reloadPrizePreviewFeed,
    reloadResolvePreview,
    reloadStandingsPreviewFeed,
    resetTableColumnWidth,
    resetTableLayout,
    resolvePreviewFeed,
    resultApplyFeed,
    rosterFillBusy,
    rosterFillFeed,
    runSaveAction,
    seasonCompletionFeed,
    seasonEndChampionRow,
    seasonHistorySnapshots,
    seasonSnapshotFeed,
    seasonStandRows,
    seasonTransitionBusy,
    seasonTransitionError,
    seasonTransitionFeed,
    selectedPrizePreviewRow,
    selectedStandingRow,
    setActiveView,
    setFreshSeasonStartMessage,
    setMatchdayAutoRunIncludeWarningLineups,
    setMatchdayAutoRunOverwriteExistingLineups,
    setMatchdayAutoRunStopOnTie,
    setMatchdayMvpForceReplaceExisting,
    setTableColumnVisible,
    setWholeSeasonIncludeWarningLineups,
    setWholeSeasonOverwriteExistingLineups,
    setWholeSeasonStopOnTie,
    standingsApplyFeed,
    standingsPreviewFeed,
    startTableColumnResize,
    syncFoundationViewInUrl,
    tableSorts,
    toggleTableSort,
    wholeSeasonDryRunFeed,
    wholeSeasonIncludeWarningLineups,
    wholeSeasonOverwriteExistingLineups,
    wholeSeasonStopOnTie,
    ColumnVisibilityManager,
    PlayerPortrait,
    SEASON_TRANSITION_STATIC_STEPS,
    SortableHeader,
    freshSeasonStartMessage,
    marketTeamId,
    prizePreviewHardBlocked,
    tableColumnPreferences,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
    wholeSeasonMaxMatchdays,
    aiBatchDeps: {
      buildCockpitScopeParams,
      roomContext,
      marketAiApplyIncludeWarnings,
      reloadAfterMarketRosterApply,
      reloadResolvePreview,
      setMarketAiApplyBusy,
      setMarketAiApplyFeed,
      setRosterFillBusy,
      setRosterFillFeed,
      showReadOnlyNotice,
    },
    matchdayDeps: {
      showReadOnlyNotice,
      withRoomBody,
      activeSaveId,
      matchdayMvpForceReplaceExisting,
      matchdayAutoRunIncludeWarningLineups,
      matchdayAutoRunOverwriteExistingLineups,
      matchdayAutoRunStopOnTie,
      setResultApplyFeed,
      setStandingsApplyFeed,
      setCashApplyFeed,
      setMatchdayAdvanceFeed,
      setMatchdayAutoRunFeed,
      setMatchdayMvpScoringFeed,
      reloadResolvePreview,
      reloadStandingsPreviewFeed,
      reloadPrizePreviewFeed,
      reloadLiveSeasonState,
      loadSave,
      reloadSeasonStandingsOverview,
      reloadSeasonManagementOverview,
      reloadHistoryFeed,
      reloadTransferRecapFeed,
      bumpMarketReloadToken: () => setMarketReloadToken((current) => current + 1),
      setFoundationActionFeedback,
    },
    preseasonDeps: {
      showReadOnlyNotice,
      withRoomBody,
      activeSaveId,
      setPreSeasonWorkflowBusy,
      setPreSeasonWorkflowError,
      setPreSeasonWorkflowFeed,
      loadSave,
      reloadSeasonStandingsOverview,
      reloadSeasonManagementOverview,
      reloadHistoryFeed,
      reloadTransferRecapFeed,
      bumpMarketReloadToken: () => setMarketReloadToken((current) => current + 1),
      setActiveView,
      syncFoundationViewInUrl,
    },
    seasonTransitionDeps: {
      showReadOnlyNotice,
      withRoomBody,
      activeSaveId,
      setSeasonTransitionBusy,
      setSeasonTransitionError,
      setSeasonTransitionFeed,
      setSeasonCompletionFeed,
      setCashApplyFeed,
      setSeasonSnapshotFeed,
      setWholeSeasonDryRunFeed,
      setFoundationActionFeedback,
      loadSave,
      reloadResolvePreview,
      reloadStandingsPreviewFeed,
      reloadPrizePreviewFeed,
      reloadSeasonStandingsOverview,
      reloadSeasonManagementOverview,
      reloadHistoryFeed,
      reloadTransferRecapFeed,
      setActiveView,
      syncFoundationViewInUrl,
    },
  };

  const foundationPrizeFinanceShellHostProps: FoundationPrizeFinanceShellHostProps = {
    activeView: activeView as FoundationViewId,
    seasonStandRows,
    prizeFinanceTab,
    sponsorsPanelProps: {
      gameState,
      selectedTeamName: selectedTeam?.name ?? "Team",
      selectedTeamCommercialRating,
      selectedTeamSponsorContract,
      selectedTeamSponsorOffers,
      sponsorChoiceMessage,
      sponsorChoiceBusy,
      selectedTeamCanManage,
      formatMoney,
      chooseTeamSponsor,
      prizeFinanceTab,
    },
    prizePanelBaseProps: {
      gameState,
      activeContextMeta,
      prizePreviewFeed,
      prizeApplyState,
      selectedTeam,
      tableSorts: { prizePreview: tableSorts.prizePreview },
      formatLocalePoints,
      formatNullableMoney,
      formatSignedDisplayMoney,
      getViewSourceBadgeLabel: getViewSourceBadgeLabel as unknown as (view: string, meta: unknown) => string,
      setFoundationView: setFoundationView as unknown as (view: string, setActiveViewFn: (view: string) => void) => void,
      setActiveView: setActiveView as unknown as (view: string) => void,
      openTeamProfileById,
      getTableActivePreset,
      isTableColumnVisible,
      setTableColumnVisible,
      moveTableColumn,
      getTableColumnWidth,
      adjustTableColumnWidth,
      resetTableColumnWidth,
      resetTableLayout,
      getTableHeaderDragProps,
      startTableColumnResize,
      toggleTableSort,
      ColumnVisibilityManager: ColumnVisibilityManager as unknown as FoundationPrizeV2PanelProps["ColumnVisibilityManager"],
      SortableHeader,
      selectedRoster,
      selectedStandingRow,
      prizePreviewSort: tableSorts.prizePreview,
      tableColumnPreferences,
      getTablePinnedLeftIds,
      getTablePinnedRightIds,
    },
  };

  const foundationLeagueLeadersHostProps: FoundationLeagueLeadersHostProps = {
    categories: leagueLeaderBoards,
    selectedTeamId: activeManagerTeamId,
    seasonLabel: canonicalSeasonLabel,
    gameState,
    returnContext: leagueLeadersReturnContext,
    onReturnToPlayer: leagueLeadersReturnContext
      ? () => {
          const returnPlayerId = leagueLeadersReturnContext.playerId;
          setLeagueLeadersReturnContext(null);
          // "Zurück zu {Spieler}" soll zum Herkunfts-Profil zurückführen. Da das Öffnen
          // der Rangliste (onOpenLeagueLeaders) einen History-Eintrag pusht, bringt uns
          // der Browser-Back verlässlich dorthin zurück. Nur ohne History (z. B. direkter
          // Deep-Link) fällt es auf ein erneutes Öffnen des Profils zurück.
          if (canFoundationNavigateBack()) {
            foundationNavigateBack();
            return;
          }
          openPlayerProfileById(returnPlayerId);
        }
      : undefined,
    onOpenPlayer: openPlayerProfileById,
  };

  const foundationAllTimeTableHostProps: FoundationAllTimeTableHostProps = {
    model: allTimeTableModel,
    selectedTeamId: activeManagerTeamId,
    seasonLabel: canonicalSeasonLabel,
    onOpenTeam: openTeamProfileById,
  };

  const foundationRanksHostProps: FoundationRanksHostProps = {
    sortedPpAreaRows: sortedPpAreaRows as unknown as FoundationRanksHostProps["sortedPpAreaRows"],
    ppAreaRankClassMaps,
    ppAreaMetricPools,
    tableSorts: { ppArea: tableSorts.ppArea },
    toggleTableSort,
    openTeamProfileById,
    ownTeamId: activeManagerTeamId ?? selectedTeamId ?? null,
    renderPpAreaMetricCell: (value, formBonus, options: { tone: string; pool: Array<number | null | undefined>; fallbackMax: number }) =>
      renderMetricBar(value, {
        tone: options.tone as Parameters<typeof renderMetricBar>[1]["tone"],
        pool: options.pool,
        fallbackMax: options.fallbackMax,
        format: (nextValue) => formatPpsValue(nextValue),
        detail: formatPpFormBonus(formBonus),
        detailNegative: (formBonus ?? 0) < 0,
      }),
    SortableHeader,
  };

  const foundationDiszisHostProps: FoundationDiszisHostProps = {
    disciplineConfigTableColumns,
    visibleDisciplineConfigColumns,
    disciplineCategoryFilter,
    setDisciplineCategoryFilter,
    visibleDisciplineConfigRows,
    seasonDisciplineScheduleRows,
    currentMatchdayId: gameState.matchdayState.matchdayId,
    getTableActivePreset,
    isTableColumnVisible,
    setTableColumnVisible,
    moveTableColumn,
    getTableColumnWidth,
    adjustTableColumnWidth,
    resetTableColumnWidth,
    resetTableLayout,
    getTableHeaderDragProps,
    startTableColumnResize,
    tableSorts: { disciplineConfig: tableSorts.disciplineConfig },
    toggleTableSort,
    ColumnVisibilityManager: ColumnVisibilityManager as unknown as FoundationDiszisHostProps["ColumnVisibilityManager"],
    SortableHeader: SortableHeader as unknown as FoundationDiszisHostProps["SortableHeader"],
  };

  const foundationTrainingCompactHostProps: Omit<FoundationTrainingCompactShellHostProps, "selectedTeam"> = {
    gameState,
    selectedTeamFacilityState,
    rosterPlayers,
    playerRatingsById,
    playerSeasonPerformanceMap,
    trainingModeDraft,
    trainingClassDraft,
    trainingDevelopmentFilter,
    onSetTrainingDevelopmentFilter: setTrainingDevelopmentFilter,
    selectedTeamControlMode: formatTeamControlModeLabel(selectedTeamControl?.controlMode),
    seasonLabel: canonicalSeasonLabel,
    // T-009: kein Season-Phasen-Lock mehr — `managementLocked` deckt nur noch
    // den "fremdes Team / reine Ansicht"-Fall ab, Training bleibt fürs eigene
    // Team immer einstellbar.
    managementLocked: isSelectedTeamManagementLocked,
    managementLockedReason: isSelectedTeamManagementLocked
      ? selectedTeam
        ? `${selectedTeam.name} gehört nicht zu deinen steuerbaren Teams. Training ist nur zur Ansicht offen.`
        : null
      : null,
    trainingClassOptions: PROGRESSION_CLASS_ORDER.map((className) => ({ value: className, label: className })),
    onSetTrainingMode: (playerId, mode) => {
      void setPlayerTrainingMode(playerId, mode);
    },
    onSetTrainingClass: (playerId, trainingClass) => {
      void setPlayerTrainingClass(playerId, trainingClass);
    },
    onOpenPlayerDetails: (payload) => openPlayerDrawerById(payload.playerId, payload.activePlayerId),
    onOpenFacilities: () => setFoundationView("trainingV2", setActiveView),
    onOpenTeams: () => setFoundationView("teams", setActiveView),
  };

  const foundationMarketV2ShellHostProps: FoundationMarketV2ShellHostProps = {
    gameState,
    activeSaveId,
    activeSaveName,
    activeManagerTeamId,
    effectiveActiveOwnerId,
    foundationManageableTeamIds,
    selectedTeam,
    selectedTeamObjectives,
    transferWishlistEntriesForMarketV2: transferWishlistEntriesForMarketV2 as unknown as FoundationMarketV2ShellHostProps["transferWishlistEntriesForMarketV2"],
    marketVisibleFeedCount: marketFeed?.poolAudit.visibleFeedCount ?? 0,
    marketActiveFreeAgentCount: marketFeed?.poolAudit.activeFreeAgentCount ?? 0,
    sourceBadgeLabel: getViewSourceBadgeLabel("marketV2", activeContextMeta),
    marketFocusPlayerId,
    foundationPanel,
    activeView: activeView as FoundationViewId,
    isFoundationBootstrapState,
    readMetaSource: readMeta.source,
    resolvedTeamControlSettings,
    playerRatingsById,
    seasonPointsLedger:
      isTransferMarketViewActive && shouldLoadSeasonDerivations ? seasonDerivations.ledger : undefined,
    roomContext,
    formatGamePhaseLabel,
    getRosterEntryDisplayMarketValue,
    getRosterEntryDisplaySalary,
    getTeamLockedName,
    setActiveView,
    setActiveManagerTeam,
    setMarketFocusPlayerId,
    setFoundationActionFeedback: setFoundationActionFeedback as unknown as FoundationMarketV2ShellHostProps["setFoundationActionFeedback"],
    openPlayerDrawerById,
    toggleTransferWishlist,
    removeTransferWishlistEntry,
    toggleScoutingWatch,
    openMarketOfferPanel,
    closeFoundationDrilldownPanel,
    openMarketSellModal,
    loadSave: loadSave as unknown as FoundationMarketV2ShellHostProps["loadSave"],
  };

  const foundationShellRouterBodyProps = {
    activeContextMeta,
    activeContextStatusChips,
    activeFlowCoach,
    activeFlowLoopIndex,
    activeManagerArenaGapDetail,
    activeManagerTeamId,
    activeManagerTeamSource,
    activeMatchdaySummaryId,
    activeOwner,
    activeOwnerId,
    activeSaveGameMode,
    activeSaveId,
    activeSaveIsInCurrentMode,
    activeSaveName,
    activeSaveSummary,
    activeScenarioWarning,
    activeTeamCriticalInboxItems,
    activeTeamMatchdaySummaryRow,
    activeTeamOpenInboxItems,
    activeView,
    activeViewSourceBadge,
    adjustTableColumnWidth,
    adminSimulationBusy,
    adminSimulationError,
    adminSimulationFullChurn,
    adminSimulationInjuries,
    adminSimulationMode,
    adminSimulationRun,
    adminSimulationSeasonCount,
    aiLineupApplyTeams,
    aiTeams,
    applyNewGamePreset,
    bootstrapError,
    bulkAiPicksRefillBusy,
    bulkAiPicksRefillMessage,
    bulkAiPicksProgress,
    runBulkAiTeamsRefill,
    underFilledAiTeamIds,
    buildTeamDetailDrawerData,
    canonicalSeasonLabel,
    cashApplyFeed,
    changeFoundationSaveMode,
    closeCommandPalette,
    closeFacilityPanel,
    closeFoundationDrilldownPanel,
    closeMarketSellModal,
    closeSeasonBriefing,
    closeTeamProfile,
    cockpitAiBatchApplyFeed,
    cockpitAiIncludeWarningTeams,
    cockpitAiOverwriteExisting,
    cockpitBusyKey,
    commandSearch,
    commandSearchInputRef,
    completeSeasonBriefingAndContinue,
    confirmContractRenewalNegotiation,
    confirmFacilityMaintenance,
    confirmFacilityUpgrade,
    confirmTransfermarktSell,
    contractRenewalBusy,
    contractRenewalError,
    contractRenewalMessage,
    contractRenewalNegotiation,
    currentMatchdayDisciplineSchedule,
    currentMatchdayDisplayLabel,
    currentSaveOwnership,
    disciplineCategoryFilter,
    disciplineConfigTableColumns,
    disciplineRanksColumns,
    effectiveActiveOwnerId,
    enableAiLineupApplyForAiTeams,
    exportSelectedTeamSettingsJson,
    facilityMaintenanceBusy,
    facilityMaintenanceError,
    facilityMaintenancePreview,
    facilityMaintenanceSuccess,
    facilityUpgradeBusy,
    facilityUpgradeError,
    facilityUpgradePreview,
    facilityUpgradeSuccess,
    filteredTeamSettingsTeams,
    foundationActionFeedback,
    foundationActivities,
    foundationFacilityTarget,
    foundationFlowLoopStages,
    foundationManageableTeamIds,
    foundationNavAttention,
    foundationPanel,
    foundationSaveMode,
    foundationWarningInboxItems,
    freshSeasonStartMessage,
    gameFlowActionStep,
    gameModeOwnershipChrisIds,
    gameModeOwnershipLimits,
    gameState,
    getBusyActionReason: getFoundationBusyActionReason,
    getCockpitBusyReason: getFoundationCockpitBusyReason,
    getReadOnlyActionReason: getFoundationReadOnlyActionReason,
    getTableActivePreset,
    getTableColumnWidth,
    getTableHeaderDragProps,
    getTeamLockedName,
    getViewClass,
    globalNextLabel,
    globalNextStatusClass,
    globalNextTitle,
    handleFormCardPlanSaved,
    handleHumanLineupSaved,
    handleManagerTeamSelect,
    historyAllSeasonsSelected,
    historyClassFilter,
    historyFeed,
    historyLoadingMore,
    historyPage,
    historyPageCount,
    historySearch,
    historySeasonFilter,
    historySourceFilter,
    historyTeamFilter,
    historyTypeFilter,
    historyVisibleRangeLabel,
    homeActiveTeamLogo,
    homeNextMatchdayStatus,
    homeTodayCards,
    homeV2BoardObjectives,
    homeV2Facilities,
    homeV2InboxItems,
    homeV2ScheduleItems,
    homeV2Tab,
    homeV2TopPlayers,
    homeWarnings,
    hqContractExpiringCount,
    hqTrainingFocusCount,
    hqTransferSellMarkers,
    hqTransferWishlistEntries,
    inboxCategoryFilter,
    inboxIncludeDismissed,
    inboxIncludeDone,
    inboxV2Items,
    inboxV2SelectedItemId,
    isFoundationBootstrapState,
    isMarketSellPanelOpen,
    isPending,
    isSaveBusy,
    isSelectedTeamManagementLocked,
    isTableColumnVisible,
    isTeamSwitchPending,
    isTransferHistoryViewActive,
    isTransferMarketViewActive,
    isViewingArchivedSeason,
    leaguePlayerHeatPools,
    leagueSetupStatus,
    leagueSetupRetryBusy,
    leagueSetupRetryError,
    retryLeagueSetup,
    lineupDraftBoardView,
    lineupDraftBoardViewRequest,
    lineupFocusRequestKey,
    loadMoreHistoryFeed,
    loadSave,
    localSeasonTransitionGate,
    managerTeamOptions,
    manualTeams,
    marketBuyPreview,
    marketFeed,
    marketFocusPlayerId,
    marketSelectedTeam,
    marketSellBusy,
    marketSellError,
    marketSellPlayerContext,
    marketSellPreview,
    marketSellRiskAcknowledged,
    marketSellSubject,
    marketSellSuccess,
    matchdayAdvanceFeed,
    matchdayArenaBlockerSummary,
    matchdayAutoRunFeed,
    matchdayAutoRunIncludeWarningLineups,
    matchdayAutoRunOverwriteExistingLineups,
    matchdayAutoRunStopOnTie,
    matchdayMvpForceReplaceExisting,
    matchdayMvpScoringFeed,
    matchdaySummary,
    matchdaySummaryOptions,
    matchdaySummaryTab,
    moveTableColumn,
    navigateHomeTab,
    navigatePrizeFinanceTab,
    navigateToGameFlowStep,
    navigateToInboxItem,
    navigateToPrizeFinanceViewFromRouting,
    navigateToTeamPicker,
    newGameBusy,
    newGameChrisTeamIds,
    newGameError,
    newGameFrankyTeamIds,
    newGamePresetId,
    newGamePreview,
    newGameSandbox,
    newGameSaveName,
    newGameSuccess,
    openContractRenewalNegotiation,
    requestContractRenewalPreview,
    openFacilityPanel,
    openFoundationViewCommand,
    openMarketOfferPanel,
    openMarketSellModal,
    openPlayerDrawerById,
    openPlayerProfileById,
    openPrizeFinanceView,
    openTeamDrawerById,
    openTeamProfileById,
    openTrainingPlayerTarget,
    onOpenLeagueLeaders,
    orderedDisciplines,
    originateLoanForActiveTeam,
    repayLoanEarlyForActiveTeam,
    ownerQuickSwitchTeams,
    passiveTeams,
    persistenceError,
    playerBracketCounts,
    playerClassFilter,
    playerClassOptions,
    playerGeneratorTeamContexts,
    playerProfileData,
    playerProfileHydrationSequenceRef,
    playerProfileLoading,
    playerProfileTab,
    playerProfileTrainingReadOnly,
    playerProfileTrainingRow,
    playerRatingsById,
    playerScope,
    playerSeasonPerformanceMap,
    playerTeamFilter,
    playersTableRows,
    postAdminSeasonSimulation,
    ppAreaMetricPools,
    ppAreaRankClassMaps,
    preSeasonWorkflowBusy,
    preSeasonWorkflowError,
    preSeasonWorkflowFeed,
    prizeFinanceTab,
    rankLeaderCards,
    ranksArchiveMissing,
    isViewingArchivedRanksSeason,
    readMeta,
    readOnlyBannerMessage,
    readSourceLabel,
    reloadPrizePreviewFeed,
    reloadResolvePreview,
    reloadSeasonStandingsOverview,
    reloadStandingsPreviewFeed,
    removeTransferWishlistEntry,
    resetTableColumnWidth,
    resetTableLayout,
    resolvePreviewFeed,
    resolvedTeamControlSettings,
    resultApplyFeed,
    roomActivityNotice,
    roomContext,
    roomLiveState,
    rosterFillBusy,
    rosterFillFeed,
    rosterPlayers,
    runCockpitMatchdayAdvance,
    runCockpitMatchdayAutoRun,
    runFacilityMaintenancePreview,
    runFacilityUpgradePreview,
    runFinishMatchdaySimple,
    runFoundationCommand,
    runNewGameSetup,
    runSaveAction,
    runSeasonStartReset,
    savePlayerGeneratorDrafts,
    commitPlayerGeneratorDraft,
    saveSummaries,
    saveSyncError,
    saveTeamSettings,
    scheduleActiveManagerTeam,
    scoutingCenterTab,
    scoutingHubV2TargetSections,
    scoutingHubV2Visibility,
    scoutingQueueEntries,
    scoutingFocusSummary,
    scoutingReport,
    scoutingReportSelectedPlayerId,
    setScoutingReportSelectedPlayerId,
    reorderTransferWishlist,
    screenPrimaryAction,
    seasonBriefingData,
    seasonBriefingOpen,
    seasonBriefingScheduleReady,
    seasonBriefingTeamAxes,
    seasonBriefingTeamCash,
    seasonCompletionFeed,
    seasonDisciplineScheduleRows,
    seasonHistorySnapshots,
    seasonOverviewOptions,
    seasonOverviewSeasonId,
    seasonOverviewSourceLabel,
    seasonSnapshotFeed,
    seasonStandRows,
    seasonStandingsLoading,
    seasonStandingsMode,
    seasonStartResetBusy,
    seasonStartResetFeed,
    seasonTransitionBusy,
    seasonTransitionError,
    seasonTransitionFeed,
    seasonV2ArchiveRows,
    seasonV2DisciplineLeaders,
    seasonV2GmRows,
    seasonV2LeaderTeam,
    seasonV2MomentumTeam,
    seasonV2PlayerRows,
    seasonV2PressureTeam,
    seasonV2SelectedTeamSummary,
    seasonV2StandingsRows,
    seasonV2TopPlayers,
    selectTeamSettingsTeam,
    selectedBoardConfidence,
    selectedEncyclopediaEntry,
    selectedHqAxisSummary,
    selectedHqFinanceWarnings,
    selectedHqGmStory,
    selectedHqInboxItems,
    selectedHqMoraleSummary,
    selectedIdentity,
    selectedIdentityAxisBias,
    selectedIdentityDraft,
    selectedOpenObjectives,
    selectedRoster,
    selectedRosterTableRows,
    selectedSeasonOverviewLabel,
    selectedStandingRow,
    // Wave D · Feld-Rennen-Ableitungen für die Home-Übersicht (D1/D2/D4).
    selectedTeamFieldRaceForm,
    fieldRacePlayedMatchdayCount,
    fieldRaceTotalTeams,
    homeFieldRaceRankMovement,
    selectedTeam,
    selectedTeamAverageAxisStats,
    selectedTeamCanManage,
    selectedTeamCaptainProfile,
    selectedTeamCaptainCandidates,
    selectedTeamCaptainPlayerId,
    assignTeamCaptainBusy,
    assignTeamCaptainForSelectedTeam,
    captainEffectsTooltip: getTeamCaptainEffectsTooltip(),
    selectedTeamControl,
    selectedTeamDetailTab,
    selectedTeamGeneralManager,
    selectedTeamGmAxisShares,
    selectedTeamGmBiasHighlights,
    selectedTeamHasUnsavedChanges,
    selectedTeamId,
    selectedTeamObjectives,
    selectedTeamPlayerDemands,
    selectedTeamPowers,
    selectedTeamRosterActionHint,
    selectedTeamRosterActionsAvailable,
    selectedTeamScoutPipeline,
    selectedTeamSettingsIndex,
    selectedTeamStrategyDraft,
    selectedTeamStrategyProfile,
    setActiveManagerTeam,
    setActiveOwnerId,
    setActiveView,
    setAdminSimulationFullChurn,
    setAdminSimulationInjuries,
    setAdminSimulationMode,
    setAdminSimulationSeasonCount,
    setCockpitAiIncludeWarningTeams,
    setCockpitAiOverwriteExisting,
    setCockpitBusyKey,
    setCommandSearch,
    setContractRenewalNegotiation,
    setDisciplineCategoryFilter,
    setFoundationActionFeedback,
    setFreshSeasonStartMessage,
    setGameModeOwnershipChrisIds,
    setGameModeOwnershipFrankyIds,
    setGameState,
    setHistoryClassFilter,
    setHistoryPage,
    setHistorySearch,
    setHistorySeasonFilter,
    setHistorySourceFilter,
    setHistoryTeamFilter,
    setHistoryTypeFilter,
    setInboxCategoryFilter,
    setInboxIncludeDismissed,
    setInboxIncludeDone,
    setInboxV2SelectedItemId,
    setLineupDraftBoardView,
    setLineupDraftBoardViewRequest,
    setMarketFocusPlayerId,
    setMarketSellRiskAcknowledged,
    setMatchdayAutoRunIncludeWarningLineups,
    setMatchdayAutoRunOverwriteExistingLineups,
    setMatchdayAutoRunStopOnTie,
    setMatchdayMvpForceReplaceExisting,
    setMatchdaySummaryTab,
    setNewGamePreview,
    setNewGameSandbox,
    setNewGameSaveName,
    setNewGameSoloTeam,
    setPlayerClassFilter,
    setPlayerProfileData,
    setPlayerProfileTab,
    setPlayerScope,
    setPlayerTeamFilter,
    setPlayerTrainingClass,
    setPlayerTrainingMode,
    setScoutingCenterTab,
    setSeasonOverviewSeasonId,
    setSeasonStandingsMode,
    setSelectedEncyclopediaEntryId,
    setSelectedMatchdaySummaryId,
    setSelectedTeamDetailTab,
    setShowCommandPalette,
    setShowExtendedTeamPanels,
    setShowSelectedRosterPpsBreakdown,
    setShowTeamContractPreviewRows,
    setShowTeamDisciplines,
    setSoloPlayerTeam,
    setSpecialistWingVariantDraft,
    setTableColumnVisible,
    setTeamContextFilter,
    setTeamControlDraft,
    setTeamControlMessage,
    setTeamIdentityDraft,
    setTeamIdentityMessage,
    setTeamRosterFocusMode,
    setTeamRosterRoleFilter,
    setTeamSettingsSearch,
    setTeamStrategyDraft,
    setTeamStrategyMessage,
    setTrainingDevelopmentFilter,
    setWholeSeasonIncludeWarningLineups,
    setWholeSeasonOverwriteExistingLineups,
    setWholeSeasonStopOnTie,
    shouldBuildTeamContracts,
    shouldShowArenaBackToLineup,
    showCommandPalette,
    showCompactFlowCoach: false,
    showCompactHeader,
    showExtendedTeamPanels,
    showFlowCoach: false,
    showReadOnlyNotice,
    showSelectedRosterPpsBreakdown,
    showTeamContractPreviewRows,
    showTeamDisciplines,
    sortedDisciplineRankRows,
    sortedPlayersTableRows,
    sortedPpAreaRows,
    sortedTransferHistoryRows,
    specialistWingVariantDraft,
    standingsApplyFeed,
    standingsPreviewFeed,
    foundationMatchdayResultHostProps,
    foundationHistoryV2HostProps,
    foundationSeasonPreviewHostProps,
    foundationTeamsViewHostProps,
    foundationCockpitHostProps,
    foundationPrizeFinanceShellHostProps,
    foundationRanksHostProps,
    foundationLeagueLeadersHostProps,
    foundationAllTimeTableHostProps,
    foundationDiszisHostProps,
    foundationMarketV2ShellHostProps,
    foundationTrainingCompactHostProps,
    startAdminSeasonSimulationRun,
    startTableColumnResize,
    tableSorts,
    teamContextFilter,
    teamControlDraft,
    teamControlMessage,
    teamIdentityMessage,
    teamObjectiveOverview,
    teamOwners,
    teamProfileData,
    teamRosterFocusMode,
    teamRosterRoleFilter,
    teamSettingsSearch,
    teamStrategyMessage,
    toggleGameModeOwnershipTeam,
    toggleNewGameTeam,
    toggleScoutingWatch,
    toggleTableSort,
    toggleTransferSellMarker,
    toggleTransferWishlist,
    trainingDevelopmentFilter,
    trainingDevelopmentSummary,
    teamBeliebtheit,
    trainingFacilityEffectPreview,
    trainingFacilityRows,
    trainingFacilitySeasonEndFinance,
    trainingForecastSummary,
    trainingPlayerForecastRows,
    trainingPlayerRowViews,
    trainingV2ModeOptions,
    transferHistoryClassOptions,
    transferHistoryRequestedSeasonLabel,
    transferHistoryResolvedSeasonLabel,
    transferHistorySeasonBreakdown,
    transferHistorySourceOptions,
    transferHistorySummary,
    transferSeasonOptions,
    transferWishlistEntriesForMarketV2,
    triggerGlobalNext,
    updateInboxItemStatus,
    updateTeamControlDraft,
    updateTeamIdentityDraft,
    updateTeamStrategyDraft,
    visibleDisciplineConfigColumns,
    visibleDisciplineConfigRows,
    visibleDisciplineRanksColumns,
    visibleFoundationCommandItems,
    visibleInboxItems,
    visiblePlayersTableColumns,
    visibleTransferHistoryRows,
    wholeSeasonDryRunFeed,
    wholeSeasonIncludeWarningLineups,
    wholeSeasonOverwriteExistingLineups,
    wholeSeasonStopOnTie,
  };
  return foundationShellRouterBodyProps as FoundationShellRouterBodyProps;
}


export {
  ClassColorChip,
  ClassIcon,
  ColumnVisibilityManager,
  DEFAULT_ACTIVE_OWNER_ID,
  DisciplineIcon,
  FACILITY_CATALOG,
  FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS,
  FOUNDATION_SAVE_MODE_OPTIONS,
  FacilitiesV2Client,
  FoundationHomeV2Panel,
  FoundationLineupPanel,
  FoundationPlayerPortraitPreview,
  FoundationSeasonV2Panel,
  FoundationShell,
  FoundationSponsorsPanel,
  FoundationSubNav,
  FoundationTeamsDetailPanel,
  FoundationTransfermarktV2Panel,
  GAME_ENCYCLOPEDIA_ENTRIES,
  GameTerm,
  HISTORY_ALL_SEASONS_FILTER,
  InboxV2Client,
  NEW_GAME_PRESET_DEFAULTS,
  NEW_GAME_VISIBLE_PRESET_IDS,
  PLAYER_PROFILE_TABS,
  PROGRESSION_CLASS_ORDER,
  PlayerGeneratorPanel,
  PlayerPortrait,
  PlayerProfileClient,
  RaceIcon,
  SEASON_TRANSITION_STATIC_STEPS,
  SPECIALIST_WING_VARIANTS,
  ScoutingCenterV2Client,
  SortableHeader,
  TeamProfileClient,
  TooltipHeading,
  TrainingCompactClient,
  TransferHistoryV2Client,
  WarningList,
  buildResolvedTeamIdentities,
  buildScenarioWarning,
  buildTeamControlSettingsMap,
  buildTeamIdentityDraftMap,
  buildTeamStrategyProfileMap,
  clampBiasValue,
  clampIdentityValue,
  clampValue,
  deriveChrisFrankyTeamIdsFromSettings,
  describeRoomFlowButton,
  filterTeamsByControlScope,
  formatActiveManagerTeamSource,
  formatCockpitReason,
  formatContractShapeLabel,
  formatCsvList,
  formatDisciplineCategoryLabel,
  formatDisplayMoney,
  formatFeatureAuditStatus,
  formatFoundationSaveModeLabel,
  formatGamePhaseLabel,
  formatHomeWarningLabel,
  formatIdentityWeight,
  formatLocalePoints,
  formatMoney,
  formatMoraleContractIntentLabel,
  formatNullableMoney,
  formatObjectiveStatusLabel,
  formatPpFormBonus,
  formatPpsValue,
  formatScenarioTypeLabel,
  formatShortSaveId,
  formatSignedDisplayMoney,
  formatSignedNumber,
  formatSignedTransfermarktCurrency,
  formatTeamControlModeLabel,
  formatTransfermarktCurrency,
  formatWholeNumber,
  foundationSecondaryViews,
  getClassColorClassName,
  getCockpitStatusPillClass,
  getFoundationViewScrollTarget,
  getGameFlowStatusLabel,
  getLineupDraftSideCounts,
  getOwnerTeamHighlightClass,
  getPlayerDisplayMarketValue,
  getPlayerDisplayMarketValueDelta,
  getPlayerDisplaySalary,
  getPlayerPortraitModel,
  getPoolHeatClass,
  getRankHeatClass,
  getRanksMetricToneClass,
  getResponsiveTableImageSize,
  getRoomFlowStep,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntryCurrentSeasonSalary,
  getRosterEntrySalaryDelta,
  getScoutingWishlistSlotLimit,
  getSeasonCashHeatClass,
  getTeamAxisRankTooltip,
  getTeamHistoryRankToneClass,
  getTeamLogoModel,
  getTeamTransferWishlistEntries,
  getTeamsViewColumnTitle,
  getTransferSourceLabel,
  getTransferTypePillClass,
  getTransfermarktScoutingDisclosure,
  getViewSourceBadgeLabel,
  inferSaveTypeLabel,
  isTeamSetupDraftWishlistPhase,
  joinClassNames,
  normalizeFoundationSaveMode,
  normalizeTeamStrategyLevel,
  parseCsvList,
  prefetchFoundationPanel,
  renderEconomyDelta,
  renderMetricBar,
  resolveFoundationSaveMode,
  resolveScenarioMetaLabel,
  roundViewNumber,
  runAiTurn,
  scrollToFoundationTarget,
  setFoundationView,
  syncFoundationViewInUrl,
  teamIdentityFieldLabels,
  teamStrategyBiasFieldLabels,
  teamStrategyIdentityListFieldLabels,
  teamStrategyLevelFieldLabels,
  teamStrategyListFieldLabels,
  teamStrategySportsBiasAxisMap,
  teamStrategySportsBiasFieldLabels,
  withSynchronizedStrategyAliases,
};

export type {
  DisciplineCategoryFilter,
  FacilityId,
  FoundationView,
  FoundationViewId,
  GameFlowView,
  NewGamePresetId,
  PlayerProfileTabId,
  PlayerTableScope,
  SpecialistWingVariant,
  TeamControlFilter,
  TeamStrategyProfile,
};
