"use client";
import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";

import { getClassColorClassName } from "@/app/foundation/ClassColorChip";
import {
  ColumnVisibilityManager,
  SortableHeader,
  sortTableRows as sortRows,
} from "@/components/foundation/FoundationTableUi";
import { GAME_ENCYCLOPEDIA_ENTRIES, getGameEncyclopediaEntry } from "@/lib/ui/game-encyclopedia";
import { AUTO_ROSTER_FILL_CONFIRM_TOKEN } from "@/lib/ai/auto-roster-fill-contract";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { buildAiTransferIntents } from "@/lib/ai/aiTransferMarket";
import { runAiTurn } from "@/lib/ai/aiTurnEngine";
import { buildTeamObjectiveOverview, refreshTeamObjectiveState } from "@/lib/board/team-season-objectives-service";
import { getMetricBarPercent, getPoolHeatClass } from "@/lib/foundation/player-league-heat";
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
import { shouldAutoOpenSeasonBriefing } from "@/lib/foundation/game-flow-controller";
import { isTrainingIntensityLockedForSeason } from "@/lib/foundation/game-phase-action-policy";
import { formatGameFlowBlocker, formatGameFlowBlockerList } from "@/lib/foundation/game-flow-blocker-labels";
import { buildGameInboxItems, filterGameInboxItems, getPrimaryInboxTask } from "@/lib/foundation/game-inbox-service";
import { buildMatchdaySummary, getMatchdaySummaryOptions } from "@/lib/foundation/matchday-summary";
import { buildSeasonReadinessChecklist } from "@/lib/foundation/season-readiness-checklist";
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
import { applySponsorNegotiationToComponents, getSponsorNegotiationMultiplier } from "@/lib/sponsor/sponsor-negotiation";
import { buildFoundationNavAttention } from "@/lib/foundation/foundation-nav-attention";
import { FoundationSharedProvider, useFoundationShared } from "@/lib/foundation/foundation-shared-context";
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
  buildTeamHistoryDisciplineValuesFromRecord,
  buildTeamHistoryDisciplineValuesFromSnapshot,
  CANONICAL_PROGRESS_TRAITS,
  PROGRESSION_ATTRIBUTE_ORDER,
  PROGRESSION_CLASS_ORDER,
} from "@/lib/training/class-progression-config";
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
  getDefaultGlobalTableWidths,
  normalizeGlobalTablePreferenceEntry,
  uniqueGlobalColumnIds,
  type GlobalTableColumnConfig,
} from "@/lib/ui/global-table-layout";
import type { OlyRoomState, RoomRealtimeEvent } from "@/types/game";
import { describeRoomFlowButton, getRoomFlowStep } from "@/lib/room/room-flow-controller";
import { TEAM_BOARD_PRESSURE_TOOLTIP, TEAM_BOARD_RATING_TOOLTIP } from "@/lib/foundation/team-board-tooltips";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import { normalizeFoundationViewParam, getDefaultFoundationViewTarget, type FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import {
  prefetchFoundationPanel,
  prefetchFoundationDefaultPanels,
  prefetchMatchdayArenaBase,
  prefetchPlayerDirectoryData,
  prefetchSeasonStandingsData,
} from "@/lib/foundation/foundation-panel-prefetch";
import {
  buildPlayerProfileSessionKey,
  getCachedPlayerProfileData,
  setCachedPlayerProfileData,
} from "@/lib/foundation/player-profile-session-cache";
import { gameStateNeedsPlayerAttributeSheetHydration } from "@/lib/foundation/hydrate-player-attribute-sheet";
import { pauseFoundationNavigationSideEffects } from "@/lib/foundation/navigation-coalescing";
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
import { useFoundationKeyboardNavigation } from "@/lib/foundation/use-foundation-keyboard-navigation";
import { buildFoundationActivities } from "@/lib/foundation/foundation-activity-registry";
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
import { createFoundationGameFlowNavigator } from "@/lib/foundation/tabs/foundation-game-flow-navigation";
import { createFoundationNewGameFlowHandlers } from "@/lib/foundation/tabs/foundation-new-game-flow-handlers";
import type { FoundationHomeV2HostProps } from "@/app/foundation/home-v2/FoundationHomeV2Host";
import type { FoundationSeasonV2HostProps } from "@/app/foundation/season-v2/FoundationSeasonV2Host";
import {
  createTriggerGlobalNext,
  createUpdateInboxItemStatus,
  deriveGlobalNextUi,
} from "@/lib/foundation/tabs/foundation-global-next-actions";
import { buildFoundationShellRouterBodyProps } from "@/lib/foundation/tabs/build-foundation-shell-router-body-props";

import { useFoundationTablePreferences } from "@/lib/foundation/tabs/use-foundation-table-preferences";
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
  useFoundationStateContextValue,
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
import type { FoundationInboxV2HostProps } from "@/app/foundation/inbox-v2/FoundationInboxV2Host";
import type { FoundationPrizeFinanceShellHostProps } from "@/app/foundation/prize-v2/FoundationPrizeFinanceShellHost";
import type { FoundationPrizeV2PanelProps } from "@/app/foundation/prize-v2/FoundationPrizeV2Panel";
import {
  buildFoundationDisciplineConfigTableColumns,
  buildFoundationDisciplineRanksColumns,
  buildFoundationPlayersTableColumns,
  buildFoundationSeasonCompactPresets,
  buildFoundationSeasonTableColumns,
  buildFoundationTransferHistoryTableColumns,
  buildSeasonModeColumns,
  buildSeasonTablePinnedOffsets,
  scrollSeasonTableToColumn as scrollSeasonTableToColumnHelper,
} from "@/lib/foundation/tabs/foundation-table-column-defs";
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
  PersistedFoundationTablePreferences,
  PlayerTableScope,
  PreSeasonWorkflowApiResponse,
  PreSeasonWorkflowStepSummary,
  PreSeasonWorkflowStepSummaryResponse,
  PreSeasonWorkflowSummaryResponse,
  RESULT_APPLY_CONFIRM_TOKEN,
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
  resolveFoundationTeamId,
  resolveFoundationViewTarget,
  resolvePreferredFoundationTeamContext,
  resolvePreferredFoundationTeamId,
  scrollToFoundationTarget,
  seasonBriefingDismissStorageKey,
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
  buildArchivedSeasonDisciplineLeaderboards,
  buildCurrentAreaRanksByTeamId,
  buildMetricRankMap,
  buildSeasonDisciplineRankMaps,
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
  buildOrderedFoundationDisciplines,
  getTeamAxisRankTooltip,
  getTeamsViewColumnTitle,
  TEAMS_VIEW_COLUMNS,
} from "@/lib/foundation/tabs/teams-ui-helpers";
import {
  formatLocalePoints,
} from "@/lib/foundation/tabs/home-v2-ui-helpers";


const FOUNDATION_SEASON_SNAPSHOTS_ENDPOINT = "/api/season/snapshots";

let runFoundationNavigationTransition: FoundationNavigationTransition = (callback) => {
  callback();
};

export function useFoundationShellRouterBodyScope({
  initialReadSource,
  initialSelectedTeamId,
  initialSaveId,
  initialView,
  initialPersistenceState,
}: FoundationPageClientProps): FoundationShellRouterBodyProps {
  const foundationPageState = useFoundationPageState({ initialReadSource, initialSelectedTeamId, initialSaveId, initialView, initialPersistenceState });
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
    setShowGameFlowPanel, inboxCategoryFilter, setInboxCategoryFilter, inboxMode, inboxIncludeDone, setInboxIncludeDone, inboxIncludeDismissed, setInboxIncludeDismissed, selectedMatchdaySummaryId, setSelectedMatchdaySummaryId, teamSettingsSearch,
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
    setContractRenewalError, contractRenewalNegotiation, setContractRenewalNegotiation, sponsorChoiceBusy, setSponsorChoiceBusy, sponsorChoiceMessage, setSponsorChoiceMessage, sponsorChoiceProfiles, setSponsorChoiceProfiles, marketSellSubject,
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
  const [homeV2OverviewHeavyReady, setHomeV2OverviewHeavyReady] = useState(false);
  useEffect(() => {
    if (activeView !== "homeV2") {
      setHomeV2OverviewHeavyReady(false);
      return;
    }
    setHomeV2OverviewHeavyReady(false);
    const schedule =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(() => setHomeV2OverviewHeavyReady(true), { timeout: 1500 })
        : window.setTimeout(() => setHomeV2OverviewHeavyReady(true), 0);
    return () => {
      if (typeof cancelIdleCallback === "function" && typeof schedule === "number") {
        cancelIdleCallback(schedule);
      } else {
        clearTimeout(schedule as ReturnType<typeof setTimeout>);
      }
    };
  }, [activeView]);
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
    activeView === "seasonV2" || activeView === "prize" || activeView === "ranks" || activeView === "diszis";
  const shouldLoadTeamsHistoryOverview = activeView === "teams" && showExtendedTeamPanels;
  const shouldLoadSeasonOverviewFeedActive = shouldLoadSeasonOverviewFeed || shouldLoadTeamsHistoryOverview;
  const shouldLoadSeasonArchive =
    activeView === "season" ||
    activeView === "seasonV2" ||
    activeView === "prize" ||
    activeView === "ranks" ||
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
    socket.emit("rejoinRoom", {
      roomCode: currentRoomContext.roomCode,
      seatToken: currentRoomContext.seatToken,
    });

    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("roomState", handleRoomState);
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
    activeView === "seasonV2" ||
    activeView === "ranks" ||
    activeView === "diszis" ||
    activeView === "prize";
  const shouldBuildLeagueLeaderBoards = activeView === "ranks";
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
  const shouldLoadSeasonDerivations =
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
  const playerProfileHydrationAttemptRef = useRef<string | null>(null);
  const playerProfileHydrationSequenceRef = useRef(0);
  const previousFoundationViewRef = useRef<FoundationView | null>(null);
  const aiPreseasonCompanionReloadRunIdRef = useRef<string | null>(null);
  const playerProfileDataRef = useRef<PlayerDetailDrawerData | null>(null);
  playerProfileDataRef.current = playerProfileData;

  function showReadOnlyNotice() {
    window.alert("Prisma/Supabase mode is read-only in this build. Switch to SQLite mode to edit local saves.");
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

  const { reloadLiveSeasonState } = useFoundationLiveSync({
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

  function setActiveManagerTeam(teamId: string, source: ActiveManagerTeamSource = "manual_select") {
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
    persistFoundationManagerTeamId(resolvedTeamId, activeSaveId, source);
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
      setActiveManagerTeamWarning("Alle 32 Teams sind im Dropdown sichtbar. Aktives Manager-Team bleibt unveraendert.");
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

      return {
        ...current,
        [tableId]: {
          key: columnKey,
          direction: "asc",
        },
      };
    });
  }

  function getViewClass(...views: FoundationView[]) {
    return views.includes(activeView) ? "" : " foundation-section-hidden";
  }

  function showTeamManagementLockedNotice(teamName = selectedTeam?.name ?? "dieses Team") {
    window.alert(`${teamName} gehoert nicht zu deinen steuerbaren Teams. Du kannst es ansehen, aber Management-Aktionen sind gesperrt.`);
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
        const profileCacheKey =
          activeSaveId && activeSaveId !== "loading-save"
            ? buildPlayerProfileSessionKey(activeSaveId, nextGameState.season.id, playerId)
            : null;
        if (profileCacheKey) {
          setCachedPlayerProfileData(
            profileCacheKey,
            buildGameStateContentSignature(nextGameState),
            refreshedProfile,
          );
        }
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

    if (isTrainingIntensityLockedForSeason(gameState)) {
      window.alert(
        "Trainingsintensitaet ist fuer diese Season bereits festgelegt (seit dem ersten Spieltag versiegelt). Aenderung erst zum naechsten Saisonstart moeglich.",
      );
      return;
    }

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
      window.alert(error instanceof Error ? error.message : "Training konnte nicht gespeichert werden.");
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
      window.alert(error instanceof Error ? error.message : "Trainingsklasse konnte nicht gespeichert werden.");
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

  async function saveTeamSettings() {
    if (readMeta.readOnly) {
      showReadOnlyNotice();
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
      setTeamControlMessage("Zu viele Teams fuer den aktiven Spielmodus zugeordnet.");
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
      setTeamControlMessage("Es gibt aktuell keine AI-Teams fuer die Marktfreigabe.");
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
      window.alert(message);
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
    const profileCacheKey =
      activeSaveId && activeSaveId !== "loading-save"
        ? buildPlayerProfileSessionKey(activeSaveId, gameState.season.id, playerId)
        : null;
    const profileContentSignature = buildGameStateContentSignature(gameStateRef.current);
    const cachedProfile =
      profileCacheKey && !gameStateNeedsPlayerAttributeSheetHydration(gameStateRef.current, playerId)
        ? getCachedPlayerProfileData(profileCacheKey, profileContentSignature)
        : null;

    setPlayerProfileTab(options?.tab ?? "overview");
    setActiveView("playerProfile");
    syncFoundationViewInUrl("playerProfile", options?.tab ?? "overview", playerId, {
      push: options?.push ?? false,
      team: selectedTeamId,
    });

    if (cachedProfile) {
      playerProfileHydrationAttemptRef.current = hydrationSuccessKey;
      setPlayerProfileData(cachedProfile);
      setPlayerProfileLoading(false);
      return;
    }

    playerProfileHydrationAttemptRef.current = buildPlayerProfileHydrationLoadingKey(gameState.season.id, playerId);
    if (playerProfileData?.playerId !== playerId) {
      setPlayerProfileData(null);
    }
    setPlayerProfileLoading(true);
    try {
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
      if (profileCacheKey) {
        setCachedPlayerProfileData(
          profileCacheKey,
          buildGameStateContentSignature(hydratedGameState),
          nextData,
        );
      }
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
    setFoundationView("ranks", setActiveView);
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
    }, { mode: "push" });
  }

  function openTeamDrawerById(teamId: string) {
    openTeamProfileById(teamId);
  }

  function closeTeamProfile() {
    setTeamProfileTeamId(null);
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
        message: `${marketBuyPreview.player.name} bricht die Verhandlung mit ${marketBuyPreview.team.shortCode} ab. Dieses Team-Spieler-Paar bekommt fuer kuenftige Angebote einen Vertrauensmalus.`,
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
      setMarketBuyError(`${getTeamLockedName(effectiveTeamId)} gehoert nicht zu deinen steuerbaren Teams. Kaufen ist gesperrt.`);
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
      setMarketSellError("Prisma-Referenz ist read-only. Fuer Verkaeufe bitte lokalen Testspielstand nutzen.");
      setMarketSellPreview(null);
      return;
    }

    if (!canManageTeamId(effectiveTeamId)) {
      if (requestVersion !== marketSellPreviewRequestVersion.current) {
        return;
      }
      setMarketSellError(`${getTeamLockedName(effectiveTeamId)} gehoert nicht zu deinen steuerbaren Teams. Verkaufen ist gesperrt.`);
      setMarketSellPreview(null);
      return;
    }

    if (!effectiveTeamId) {
      if (requestVersion !== marketSellPreviewRequestVersion.current) {
        return;
      }
      setMarketSellError("Bitte zuerst ein Team im Kaderbereich waehlen.");
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
      setMarketSellError(`${getTeamLockedName(effectiveTeamId)} gehoert nicht zu deinen steuerbaren Teams. Verkaufen ist gesperrt.`);
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
      setMarketSellError("Prisma-Referenz ist read-only. Fuer Verkaeufe bitte lokalen Testspielstand nutzen.");
      return;
    }

    if (!marketSellPreview?.activePlayer?.id || !marketSellPreview.team?.id) {
      return;
    }
    if (!canManageTeamId(marketSellPreview.team.id)) {
      setMarketSellError(`${getTeamLockedName(marketSellPreview.team.id)} gehoert nicht zu deinen steuerbaren Teams. Verkaufen ist gesperrt.`);
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
            "Verkauf konnte nicht bestaetigt werden.",
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
      setMarketSellError("Verkauf konnte nicht bestaetigt werden.");
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
        setFreshSeasonStartMessage("Aktueller Save wurde auf Season-Start-Basis zurueckgesetzt.");
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
      const message = `${selectedTeam?.name ?? "Dieses Team"} gehoert nicht zu deinen steuerbaren Teams. Gebaeude sind read-only.`;
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
      setFacilityUpgradeError("facility_upgrade_preview_missing: Bitte Upgrade erneut pruefen.");
      return;
    }
    if (facilityUpgradePreview.saveContext.saveId !== activeSaveId || facilityUpgradePreview.team?.teamId !== selectedTeam.teamId) {
      setFacilityUpgradeError("facility_upgrade_preview_stale: Save oder Team hat sich geaendert. Bitte Preview neu laden.");
      return;
    }
    if (!selectedTeamCanManage) {
      setFacilityUpgradeError(`${selectedTeam.name} gehoert nicht zu deinen steuerbaren Teams. Gebaeude sind read-only.`);
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
      setFacilityUpgradeError("Facility-Upgrade konnte nicht ausgefuehrt werden.");
    } finally {
      setFacilityUpgradeBusy(false);
    }
  }

  async function runFacilityMaintenancePreview(facilityId: FacilityId) {
    if (readMeta.source === "prisma") {
      setFacilityMaintenanceError("Prisma-Referenz ist read-only. Facility-Wartung laeuft nur im lokalen Save.");
      return;
    }
    if (!selectedTeamCanManage) {
      setFacilityMaintenanceError(`${selectedTeam?.name ?? "Dieses Team"} gehoert nicht zu deinen steuerbaren Teams. Wartung ist read-only.`);
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
      setFacilityMaintenanceError("facility_maintenance_preview_missing: Bitte Wartung erneut pruefen.");
      return;
    }
    if (
      facilityMaintenancePreview.saveContext.saveId !== activeSaveId ||
      facilityMaintenancePreview.team?.teamId !== selectedTeam.teamId
    ) {
      setFacilityMaintenanceError("facility_maintenance_preview_stale: Save oder Team hat sich geaendert. Bitte Preview neu laden.");
      return;
    }
    if (!selectedTeamCanManage) {
      setFacilityMaintenanceError(`${selectedTeam.name} gehoert nicht zu deinen steuerbaren Teams. Wartung ist read-only.`);
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
      setFacilityMaintenanceError("Facility-Wartung konnte nicht ausgefuehrt werden.");
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
          detail: "Ergebnisse gesichert. Der naechste Spieltag ist bereit.",
        });
      } else {
        setFoundationActionFeedback({
          tone: "warning",
          title: "Spieltag nicht vollstaendig abgeschlossen",
          detail: "Bitte Cockpit pruefen — ein Schritt ist moeglicherweise blockiert.",
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
      window.confirm("Diese Simulation schreibt in den aktiv gewaehlten lokalen Save. Fortfahren?");
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
        settingsMap: buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings),
      });
      setSelectedTeamId(nextContext.teamId);
      setActiveManagerTeamSource(nextContext.source);
      setActiveManagerTeamWarning(nextContext.warning ?? "Aktives Team war in diesem Save nicht vorhanden und wurde zurueckgesetzt.");
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
    void loadSave(activeSaveId, foundationSaveMode, { compactInitial: false }).then((nextGameState) => {
      if (nextGameState?.seasonState.seasonSnapshots === undefined) {
        return;
      }
      setGameState((previous) => ({
        ...previous,
        seasonState: {
          ...previous.seasonState,
          seasonSnapshots: nextGameState.seasonState.seasonSnapshots,
        },
      }));
      void reloadSeasonStandingsOverview(seasonOverviewSeasonId || nextGameState.season.id);
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
    if (
      activeView === "matchdayArena" ||
      activeView === "lineup" ||
      activeView === "lineupV2"
    ) {
      prefetchFoundationPanel("seasonV2");
      if (
        activeSaveId &&
        activeSaveId !== "loading-save" &&
        gameState.season.id !== "loading" &&
        selectedTeamId &&
        selectedTeamId !== "loading-team"
      ) {
        prefetchMatchdayArenaBase({
          saveId: activeSaveId,
          seasonId: gameState.season.id,
          matchdayId: gameState.matchdayState.matchdayId,
          teamId: selectedTeamId,
          source: readMeta.source,
        });
      }
    }
    if (activeView === "matchdayArena") {
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
    selectedTeamId,
    isFoundationBootstrapState,
    activeSaveId,
    gameState.season.id,
    gameState.matchdayState.matchdayId,
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
    if (activeView === "home") {
      setFoundationView("homeV2", setActiveView);
    }
    if (activeView === "inbox") {
      setFoundationView("inboxV2", setActiveView);
    }
    if (activeView === "market") {
      setFoundationView("marketV2", setActiveView);
    }
    if (activeView === "history") {
      setFoundationView("historyV2", setActiveView);
    }
    if (activeView === "season") {
      setFoundationView("seasonV2", setActiveView);
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
      setMarketBuyError("Prisma-Referenz ist read-only. Fuer Kaeufe bitte lokalen Testspielstand starten.");
      setMarketBuyPreview(null);
      setMarketBuyPreviewContext(null);
      setMarketPreviewPlayerId(item.playerId);
      return;
    }

    if (!effectiveTeamId) {
      if (requestVersion !== marketBuyPreviewRequestVersion.current) {
        return;
      }
      setMarketBuyError("Bitte zuerst ein Team waehlen.");
      setMarketBuyPreview(null);
      setMarketBuyPreviewContext(null);
      setMarketPreviewPlayerId(item.playerId);
      return;
    }

    if (!canManageTeamId(effectiveTeamId)) {
      if (requestVersion !== marketBuyPreviewRequestVersion.current) {
        return;
      }
      setMarketBuyError(`${getTeamLockedName(effectiveTeamId)} gehoert nicht zu deinen steuerbaren Teams. Kaufen ist gesperrt.`);
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
      setMarketBuyError("Prisma-Referenz ist read-only. Fuer Kaeufe bitte lokalen Testspielstand starten.");
      return;
    }

    if (!marketBuyPreview?.player?.id || !marketBuyPreview?.team?.id) {
      return;
    }
    if (!canManageTeamId(marketBuyPreview.team.id)) {
      setMarketBuyError(`${getTeamLockedName(marketBuyPreview.team.id)} gehoert nicht zu deinen steuerbaren Teams. Kaufen ist gesperrt.`);
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
            "Kauf konnte nicht bestaetigt werden.",
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
      setMarketBuyError("Kauf konnte nicht bestaetigt werden.");
    } finally {
      setMarketBuyBusy(false);
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
      setContractRenewalError(`${getTeamLockedName(input.teamId)} gehoert nicht zu deinen steuerbaren Teams. Vertragsaktionen sind gesperrt.`);
      showTeamManagementLockedNotice(getTeamLockedName(input.teamId));
      return;
    }

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
          contractLength: input.contractLength ?? 2,
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
      const expectedSalary = previewPayload.summary.negotiationPreview?.expectedSalary ?? null;
      setContractRenewalNegotiation({
        teamId: input.teamId,
        playerId: input.playerId,
        playerName: input.playerName,
        contractLength: input.contractLength ?? 2,
        offeredSalary: expectedSalary,
        expectedSalary,
        confirmToken: previewPayload.summary.confirmToken,
      });
    } catch {
      setContractRenewalError(`${input.playerName}: Verhandlungsvorschau konnte nicht geladen werden.`);
    } finally {
      setContractRenewalBusy(null);
    }
  }

  async function confirmContractRenewalNegotiation() {
    if (!contractRenewalNegotiation) {
      return;
    }
    await runContractRenewalAction({
      teamId: contractRenewalNegotiation.teamId,
      playerId: contractRenewalNegotiation.playerId,
      playerName: contractRenewalNegotiation.playerName,
      action: "renew",
      contractLength: contractRenewalNegotiation.contractLength,
      offeredSalary: contractRenewalNegotiation.offeredSalary,
    });
    setContractRenewalNegotiation(null);
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
    const negotiationProfile = sponsorChoiceProfiles[offerId] ?? "balanced";
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
          negotiationProfile,
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

  async function runContractRenewalAction(input: {
    teamId: string;
    playerId: string;
    playerName: string;
    action: "renew" | "release";
    contractLength?: number | null;
    offeredSalary?: number | null;
  }) {
    if (readMeta.readOnly || readMeta.source === "prisma") {
      showReadOnlyNotice();
      return;
    }
    if (!canManageTeamId(input.teamId)) {
      setContractRenewalError(`${getTeamLockedName(input.teamId)} gehoert nicht zu deinen steuerbaren Teams. Vertragsaktionen sind gesperrt.`);
      showTeamManagementLockedNotice(getTeamLockedName(input.teamId));
      return;
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
        return;
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
        return;
      }

      setContractRenewalMessage(
        input.action === "renew"
          ? `${input.playerName} wurde verlaengert.`
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
    } catch {
      setContractRenewalError(`${input.playerName}: Vertragsaktion konnte nicht ausgefuehrt werden.`);
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
      setNewGameError("Bitte erst ein gueltiges New-Game-Setup pruefen.");
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
        setNewGameError(payload.error ?? "New-Game-Setup konnte nicht ausgefuehrt werden.");
        return;
      }

      if (dryRun && payload.preview) {
        setNewGamePreview(payload.preview);
        return;
      }

      if (payload.result?.save.saveId) {
        clearSaveScopedFeeds();
        const nextSaveMode = normalizeFoundationSaveMode(payload.result.preview.presetId);
        setFoundationSaveMode(nextSaveMode);
        await loadSave(payload.result.save.saveId, nextSaveMode);
        const firstTeamId = payload.result.preview.chrisTeamIds[0] ?? payload.result.preview.frankyTeamIds[0] ?? null;
        if (firstTeamId) {
          setActiveManagerTeam(firstTeamId, "manual_select");
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

  const trainingIntensityLockedForSeason = isTrainingIntensityLockedForSeason(gameState);

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
      `${selectedTeam.name} war hier nur Ansicht. Fuer ${activeView === "trainingV2" || activeView === "trainingCompact" || activeView === "training" ? "Training oder Gebaeude" : "diese Management-Ansicht"} wurde auf ${fallbackTeam.name} gewechselt.`,
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
    return gameState.matchdayState.matchdayId;
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
  const { navigateToGameFlowStep, navigateToInboxItem } = useMemo(
    () =>
      createFoundationGameFlowNavigator({
        navigateHomeTab,
        setShowGameFlowPanel,
        resolveLineupIssueTeamId,
        activeManagerTeamId,
        setActiveManagerTeam,
        setLineupFocusRequestKey,
        setLineupDraftBoardViewRequest,
        setFoundationView,
        setActiveView,
        openSeasonBriefingPanel,
        setSelectedTeamDetailTab,
        setMarketFocusPlayerId,
        navigateToPrizeFinanceViewFromRouting,
        openPrizeFinanceView,
      }),
    [
      activeManagerTeamId,
      navigateHomeTab,
      navigateToPrizeFinanceViewFromRouting,
      openPrizeFinanceView,
      openSeasonBriefingPanel,
      resolveLineupIssueTeamId,
      setActiveManagerTeam,
      setActiveView,
      setFoundationView,
      setLineupDraftBoardViewRequest,
      setLineupFocusRequestKey,
      setMarketFocusPlayerId,
      setSelectedTeamDetailTab,
      setShowGameFlowPanel,
    ],
  );
  const { updateNewGameFlowStepStatus, dismissNewGameFlow, navigateSeasonSetupStep } = useMemo(
    () =>
      createFoundationNewGameFlowHandlers({
        readMeta,
        showReadOnlyNotice,
        skipNextFullPersistCountRef,
        persistNewGameFlowStepStatus,
        setGameState,
        selectedTeamId,
        gameState,
        activeSaveId,
        activeManagerTeamId,
        setActiveManagerTeam,
        setFoundationView,
        setActiveView,
        seasonBriefingDismissedRef,
        seasonBriefingAutoOpenedRef,
        openSeasonBriefingPanel,
        navigateHomeTab,
        setSelectedTeamDetailTab,
        selectedTeam,
        setMarketTeamId,
        setMarketSearch,
        setMarketClassFilter,
        setMarketRaceFilter,
        setMarketSubclassFilter,
        setMarketAlignmentFilter,
        setMarketGenderFilter,
        setMarketPositiveTraitFilter,
        setMarketNegativeTraitFilter,
        setMarketBracketFilter,
        setMarketMaxValue,
        marketValueFilterManualRef,
        setMarketMaxSalary,
        setMarketMinRatio,
        setMarketMinPow,
        setMarketMinSpe,
        setMarketMinMen,
        setMarketMinSoc,
        setMarketShowAutoAnalysis,
        openPrizeFinanceView,
        navigateToGameFlowStep,
      }),
    [
      activeManagerTeamId,
      activeSaveId,
      gameState,
      marketValueFilterManualRef,
      navigateHomeTab,
      navigateToGameFlowStep,
      openPrizeFinanceView,
      openSeasonBriefingPanel,
      persistNewGameFlowStepStatus,
      readMeta,
      selectedTeam,
      selectedTeamId,
      setActiveManagerTeam,
      setActiveView,
      setFoundationView,
      setMarketAlignmentFilter,
      setMarketBracketFilter,
      setMarketClassFilter,
      setMarketGenderFilter,
      setMarketMaxSalary,
      setMarketMaxValue,
      setMarketMinMen,
      setMarketMinPow,
      setMarketMinRatio,
      setMarketMinSoc,
      setMarketMinSpe,
      setMarketNegativeTraitFilter,
      setMarketPositiveTraitFilter,
      setMarketRaceFilter,
      setMarketSearch,
      setMarketShowAutoAnalysis,
      setMarketSubclassFilter,
      setMarketTeamId,
      setSelectedTeamDetailTab,
      showReadOnlyNotice,
    ],
  );
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
  const updateInboxItemStatus = createUpdateInboxItemStatus({
    readMeta,
    showReadOnlyNotice,
    gameState,
    setGameState,
    activeSaveId,
    persistLocalGameStateImmediately,
  });
  const { globalNextDisabled, globalNextLabel, globalNextTitle, globalNextStatusClass } = deriveGlobalNextUi({
    primaryInboxItem,
    gameFlowActionStep,
    cockpitBusyKey,
    seasonTransitionBusy,
    matchdayArenaBlockerSummary,
    transferWindowHint,
  });
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

  const { activeFlowCoach, foundationFlowLoopStages, activeFlowLoopIndex } = useFoundationCrossTabFlowCoach({
    activeView,
    homeV2Tab,
    globalNextLabel,
    globalNextTitle,
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
  const playersTableColumns = useMemo<FoundationTableColumn[]>(() => buildFoundationPlayersTableColumns(), []);
  const transfermarktColumns = useMemo(
    () => [
      ...getTransfermarktBaseColumns(),
      ...(marketShowAdvancedColumns ? getTransfermarktAdvancedColumns() : []),
    ],
    [marketShowAdvancedColumns],
  );
  const transferHistoryColumns = useMemo<FoundationTableColumn[]>(() => buildFoundationTransferHistoryTableColumns(), []);
  const orderedDisciplines = useMemo(
    () => buildOrderedFoundationDisciplines(gameState.disciplines),
    [gameState.disciplines],
  );
  const disciplineRanksColumns = useMemo<FoundationTableColumn[]>(
    () => buildFoundationDisciplineRanksColumns(orderedDisciplines),
    [orderedDisciplines],
  );
  const disciplineConfigTableColumns = useMemo<FoundationTableColumn[]>(
    () => buildFoundationDisciplineConfigTableColumns(),
    [],
  );
  const seasonCompactPresets = useMemo<FoundationTablePreset[]>(
    () => buildFoundationSeasonCompactPresets(seasonTableColumns),
    [seasonTableColumns],
  );
  const {
    getSeasonTableDefaultColumnWidth,
    getSeasonTableColumnWidth,
    getTableColumnWidth,
    getTableActivePreset,
    isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
    startTableColumnResize,
    resetTableColumnWidth,
    setTableColumnVisible,
    setTransferMarketAdvancedColumnsVisible,
    adjustTableColumnWidth,
    moveTableColumn,
    moveTableColumnTo,
    getTableHeaderDragProps,
    applyTablePreset,
    resetTableLayout,
  } = useFoundationTablePreferences({
    tableColumnPreferences,
    setTableColumnPreferences,
    seasonTableMode,
    marketShowAdvancedColumns,
    setMarketShowAdvancedColumns,
  });

  const seasonDisciplineRankMaps = useMemo(
    () => buildSeasonDisciplineRankMaps(activeView, saisonstandDisciplineColumns, seasonStandRows),
    [activeView, seasonStandRows],
  );

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
    homeV2Tab,
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
  const seasonPointsLedger = shouldLoadSeasonLedger ? seasonDerivations.ledger : null;
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

  const {
    disciplineRankRows,
    sortedDisciplineRankRows,
    disciplineLeaderEntries,
    seasonDisciplineScheduleRows,
    seasonBriefingScheduleReady,
    currentMatchdayDisciplineSchedule,
    visibleDisciplineConfigRows,
  } = useFoundationCrossTabDisciplineRanks({
    activeView: activeView as FoundationViewId,
    shouldBuildTeamsHeavyComparison,
    shouldLoadSeasonOverviewFeed,
    isFoundationBootstrapState,
    gameState,
    activeSaveId,
    orderedDisciplines,
    disciplineCategoryFilter,
    tableSorts,
  });
  const rankLeaderCards = disciplineLeaderEntries;

  const currentAreaRanksByTeamId = useMemo(
    () =>
      buildCurrentAreaRanksByTeamId({
        shouldBuildDisciplineRanks,
        disciplineRankRows,
        shouldBuildTeamsView,
        activeView,
        seasonStandRows,
      }),
    [activeView, disciplineRankRows, seasonStandRows, shouldBuildDisciplineRanks, shouldBuildTeamsView],
  );

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
  const triggerGlobalNext = createTriggerGlobalNext({
    activeView,
    activeManagerTeamId,
    activeManagerMatchdayReady,
    homeNextMatchdayStatus,
    primaryInboxItem,
    globalNextDisabled,
    gameFlowActionStep,
    navigateToInboxItem,
    navigateToGameFlowStep,
    resolveLineupIssueTeamId,
    setFoundationView,
    setActiveView,
    setShowGameFlowPanel,
    matchdayArenaApplyHandlers,
    setAcknowledgedFlowStepIds,
    updateNewGameFlowStepStatus,
    acknowledgeFlowStep,
  });
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
  const {
    localSeasonTransitionGate,
    seasonSetupFlow,
    seasonBriefingData,
    seasonReadinessChecklist,
  } = useFoundationCrossTabSeasonBriefing({
    activeView,
    homeV2Tab,
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
    homeV2Tab,
    homeV2OverviewHeavyReady,
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
    () => buildSeasonModeColumns(seasonTableColumns),
    [seasonTableColumns],
  );
  const visibleSeasonTableColumns = useMemo(() => seasonModeColumns, [seasonModeColumns]);
  const seasonTablePinnedOffsets = useMemo(
    () => buildSeasonTablePinnedOffsets(visibleSeasonTableColumns, getSeasonTableColumnWidth),
    [visibleSeasonTableColumns],
  );
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
    scrollSeasonTableToColumnHelper(
      seasonTableShellRef.current,
      visibleSeasonTableColumns,
      columnId,
      getSeasonTableColumnWidth,
    );
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
          buyPick.item.teamContextAvailable ? null : "Team waehlen",
          buyPick.item.affordabilityStatus && buyPick.item.affordabilityStatus !== "affordable" ? "Budget pruefen" : null,
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
    adminBalancingBusy,
    cockpitBusyKey,
    aiTeamsCount: aiTeams.length,
  });

  const foundationStateContextValue = useFoundationStateContextValue({
    gameState,
    setGameState,
    activeSaveId,
    activeSaveName,
    foundationSaveMode,
    readMeta,
    selectedTeamId,
    activeManagerTeamId,
    isFoundationBootstrapState,
    foundationManageableTeamIds,
    loadSave,
    reloadLiveSeasonState,
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
  };

  const foundationHomeV2HostProps: FoundationHomeV2HostProps = {
    tab: homeV2Tab,
    gameState,
    seasonStandRows,
    selectedRosterTableRows,
    playerRatingsById,
    playerSeasonPerformanceMap,
    selectedStandingRow,
    selectedTeam,
    selectedTeamControl,
    selectedTeamFacilityState,
    activeManagerTeamId,
    activeTeamDecisionInboxItems,
    activeTeamDecisionCriticalInboxItems,
    teamObjectives: teamObjectiveOverview.objectives,
    activeViewContextWarning,
    activeContextMeta,
    homeNextMatchdayStatus,
    activeManagerLineupSubmitted,
    enableTopPlayerForecasts: homeV2OverviewHeavyReady,
    leaguePlayerHeatPools,
    currentMatchdayDisplayLabel,
    activeOwnerLabel: activeOwner?.label ?? null,
    selectedHqGmStory,
    selectedBoardConfidence,
    globalNextLabel,
    gameFlowActionStep,
    triggerGlobalNext,
    navigateHomeTab,
    onNavigateView: (view) => setFoundationView(view, setActiveView),
    scrollToFoundationTarget,
    openPlayerDrawerById,
    office: {
      seasonReadinessChecklist,
      selectedTeamPlayerDemands,
      selectedHqFinanceWarnings,
      selectedOpenObjectives,
      hqTrainingFocusCount,
      selectedTeamGeneralManager,
      hqTransferWishlistEntries,
      selectedTeamCaptainProfile,
      selectedTeamCaptainCandidates,
      selectedTeamCaptainPlayerId,
      assignTeamCaptainBusy,
      onAssignTeamCaptain: assignTeamCaptainForSelectedTeam,
      captainEffectsTooltip: getTeamCaptainEffectsTooltip(),
      selectedTeamPowers,
      hqContractExpiringCount,
      hqTransferSellMarkers,
      selectedHqMoraleSummary,
      selectedHqAxisSummary,
      selectedHqInboxItems,
      selectedTeamCanManage,
      isReadOnlyMode: readMeta.readOnly,
      selectedTeamAverageAxisStats,
      rosterPlayers,
      onNavigate: (view) => setFoundationView(view, setActiveView),
      onOpenTeam: openTeamDrawerById,
      onNavigateInboxItem: navigateToInboxItem,
    },
  };

  const foundationSeasonV2HostProps: FoundationSeasonV2HostProps = {
    gameState,
    selectedTeamId: selectedTeam?.teamId ?? null,
    seasonStandRows,
    seasonFormBonusByTeamId,
    teamTableSort: tableSorts.teamTable,
    selectedStandingRow,
    seasonHistorySnapshots,
    boardConfidence: teamObjectiveOverview.boardConfidence,
    activeView,
    shouldBuildSeasonV2PlayerRatings: shouldBuildSeasonV2PlayerRatings(
      activeView as FoundationViewId,
      seasonV2HydrationPhase,
    ),
    shouldFetchSeasonRatingsFromApi,
    seasonRatingsLoading: seasonRatingsSlice.loading,
    playerRatingsById,
    playerSeasonPerformanceMap,
    seasonPointsLedger,
    seasonTopPlayersSort: tableSorts.seasonTopPlayers,
    seasonOverviewSeasonId,
    sourceBadgeLabel: getViewSourceBadgeLabel("seasonV2", activeContextMeta),
    isLoading: seasonStandingsLoading,
    onChangeSeason: (seasonId) => {
      setSeasonOverviewSeasonId(seasonId);
      void reloadSeasonStandingsOverview(seasonId);
    },
    onOpenTeam: openTeamProfileById,
    onOpenPlayer: openPlayerProfileById,
    viewMode: seasonStandingsMode,
    onViewModeChange: setSeasonStandingsMode,
    onOpenRanks: () => setFoundationView("ranks", setActiveView),
    onOpenPrize: () => openPrizeFinanceView({ tab: "prize" }),
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
    getViewClass,
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
    sponsorChoiceProfiles,
    sponsorChoiceBusy,
    applySponsorNegotiationToComponents,
    getSponsorNegotiationMultiplier,
    setSponsorChoiceProfiles,
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
      sponsorChoiceProfiles,
      sponsorChoiceBusy,
      selectedTeamCanManage,
      formatMoney,
      applySponsorNegotiationToComponents,
      getSponsorNegotiationMultiplier,
      setSponsorChoiceProfiles,
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
    returnContext: leagueLeadersReturnContext,
    onReturnToPlayer: leagueLeadersReturnContext
      ? () => {
          openPlayerProfileById(leagueLeadersReturnContext.playerId);
          setLeagueLeadersReturnContext(null);
        }
      : undefined,
    onOpenPlayer: openPlayerProfileById,
  };

  const foundationRanksHostProps: FoundationRanksHostProps = {
    sortedPpAreaRows: sortedPpAreaRows as unknown as FoundationRanksHostProps["sortedPpAreaRows"],
    ppAreaRankClassMaps,
    ppAreaMetricPools,
    tableSorts: { ppArea: tableSorts.ppArea },
    toggleTableSort,
    openTeamProfileById,
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
    managementLocked: isSelectedTeamManagementLocked || trainingIntensityLockedForSeason,
    managementLockedReason: isSelectedTeamManagementLocked
      ? selectedTeam
        ? `${selectedTeam.name} gehoert nicht zu deinen steuerbaren Teams. Training ist nur zur Ansicht offen.`
        : null
      : trainingIntensityLockedForSeason
        ? "Trainingsintensitaet fuer diese Season festgelegt — Aenderung erst zum naechsten Saisonstart moeglich (versiegelt seit dem ersten Spieltag)."
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

  const foundationInboxV2HostProps: FoundationInboxV2HostProps = {
    selectedTeam,
    activeTeamInboxItems,
    activeTeamDecisionInboxItems,
    activeTeamDecisionCriticalInboxItems,
    activeTeamChronicleInboxItems,
    inboxMode,
    inboxCategoryFilter,
    inboxIncludeDone,
    inboxIncludeDismissed,
    inboxV2SelectedItemId,
    setInboxV2SelectedItemId,
    setInboxIncludeDone,
    setInboxIncludeDismissed,
    gameState,
    setGameState,
    readMeta,
    activeSaveId,
    persistLocalGameStateImmediately,
    navigateToInboxItem,
    updateInboxItemStatus,
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

  const foundationShellRouterBodyProps = buildFoundationShellRouterBodyProps({
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
    activeTeamInboxItems,
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
    homeNextMatchdayStatus,
    homeV2Tab,
    hqContractExpiringCount,
    hqTrainingFocusCount,
    hqTransferSellMarkers,
    hqTransferWishlistEntries,
    inboxCategoryFilter,
    inboxIncludeDismissed,
    inboxIncludeDone,
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
    leaguePlayerHeatPools,
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
    seasonSnapshotFeed,
    seasonStandRows,
    seasonStandingsLoading,
    seasonStandingsMode,
    seasonStartResetBusy,
    seasonStartResetFeed,
    seasonTransitionBusy,
    seasonTransitionError,
    seasonTransitionFeed,
    selectTeamSettingsTeam,
    selectedAiTeamId,
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
    selectedStandingRow,
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
    foundationHomeV2HostProps,
    foundationSeasonV2HostProps,
    foundationMatchdayResultHostProps,
    foundationHistoryV2HostProps,
    foundationSeasonPreviewHostProps,
    foundationTeamsViewHostProps,
    foundationCockpitHostProps,
    foundationPrizeFinanceShellHostProps,
    foundationRanksHostProps,
    foundationLeagueLeadersHostProps,
    foundationDiszisHostProps,
    foundationMarketV2ShellHostProps,
    foundationTrainingCompactHostProps,
    foundationInboxV2HostProps,
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
    visiblePlayersTableColumns,
    visibleTransferHistoryRows,
    wholeSeasonDryRunFeed,
    wholeSeasonIncludeWarningLineups,
    wholeSeasonOverwriteExistingLineups,
    wholeSeasonStopOnTie,
  });
  return {
    foundationShellRouterBodyProps: foundationShellRouterBodyProps as FoundationShellRouterBodyProps,
    foundationStateContextValue,
  };
}
