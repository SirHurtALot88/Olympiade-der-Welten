"use client";
import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";
import {
  FoundationShellRouterCockpit,
  FoundationShellRouterHistoryV2,
  FoundationShellRouterHomeV2,
  FoundationShellRouterInboxV2,
  FoundationShellRouterLineup,
  FoundationShellRouterMarketSell,
  FoundationShellRouterMarketV2,
  FoundationShellRouterMatchdayArena,
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
import type { TeamDetailDrawerData, TeamDetailDrawerHistoryRow } from "@/app/foundation/TeamDetailDrawer";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { GameTerm } from "@/components/ui/GameTerm";
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
  buildTeamContractSeasonTable,
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
import type { FeatureAuditStatus } from "@/lib/foundation/feature-audit-matrix";
import { featureAuditFilters, getFeatureAuditFlags } from "@/lib/foundation/feature-audit-matrix";
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
import { FoundationStateProvider } from "@/lib/foundation/foundation-state-context";
import type { SponsorNegotiationProfile } from "@/lib/data/olyDataTypes";
import { buildScoutPipelineSummary } from "@/lib/scouting/facility-scout-pipeline-service";
import {
  canAddPlayerToTransferWishlist,
  getScoutingWishlistSlotMessage,
  isTeamSetupDraftWishlistPhase,
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
import {
  SeasonEndXpSpendPlannedUpgradeInput,
  SeasonEndXpSpendPreview,
  SeasonEndXpSpendApplyResult,
} from "@/lib/progression/season-end-xp-apply-service";
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
import {
  isFoundationNavigationQuiet,
  markFoundationNavigationQuiet,
  pauseFoundationNavigationSideEffects,
} from "@/lib/foundation/navigation-coalescing";
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
import { useCockpitPanelDerivations } from "@/lib/foundation/tabs/use-cockpit-panel-derivations";
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
} from "@/lib/foundation/tabs/season-v2-derivations";
import {
  shouldBuildPrizeV2Ui as resolveShouldBuildPrizeV2Ui,
  shouldLoadPrizePreviewFeed as resolveShouldLoadPrizePreviewFeed,
} from "@/lib/foundation/tabs/prize-v2-derivations";
import { useSeasonStandRows } from "@/lib/foundation/tabs/use-season-stand-rows";
import { resolveShouldBuildTeamsScopedRatings } from "@/lib/foundation/tabs/teams-view-derivations";
import { useTeamsHydrationPhase, useTeamsViewRowDerivations } from "@/lib/foundation/tabs/use-teams-view-derivations";
import { useTeamsRosterTableDerivations } from "@/lib/foundation/tabs/use-teams-roster-table-derivations";
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
import FoundationDiszisHost from "@/app/foundation/ranks-v2/FoundationDiszisHost";
import FoundationRanksHost from "@/app/foundation/ranks-v2/FoundationRanksHost";
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
  EMPTY_SEASON_END_PROGRESSION_PREVIEW,
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
  SeasonEndAttributeDraft,
  SeasonEndXpSpendApiResponse,
  SeasonEndXpSpendSummary,
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
  formatAiLineupAuditWarning,
  formatCockpitReason,
  formatHomeWarningLabel,
  formatMatchdayMvpWarning,
  formatObjectiveStatusLabel,
  formatSeasonCompletionStepStatus,
  getAiTransferBudgetLabel,
  getAiTransferRosterLabel,
  getAiTransferStatusLabel,
  getAiTransferStatusPillClass,
  getCockpitStatusLabel,
  getCockpitStatusPillClass,
  getCockpitStepTone,
  getGameFlowStatusClass,
  getGameFlowStatusLabel,
  getSeasonCompletionStepTone,
  mapAutoRunStatusToCockpitStatus,
} from "@/lib/foundation/tabs/cockpit-ui-helpers";
import {
  createCockpitAiBatchHandlers,
  createCockpitPreseasonHandlers,
  createCockpitSeasonTransitionHandlers,
} from "@/lib/foundation/tabs/cockpit-handlers";
import { createCockpitMatchdayApplyHandlers } from "@/lib/foundation/tabs/cockpit-matchday-handlers";
import {
  renderMultiSeasonEconomyCell,
  renderMultiSeasonGameplayCell,
  renderMultiSeasonPlayerCell,
  renderMultiSeasonTeamCell,
} from "@/lib/foundation/tabs/multiseason-balance-cell-renderers";
import { getTransferWindowStatus } from "@/lib/market/transfer-window-policy";
import {
  buildTransferMarketActiveWishlistPlayerIds,
  buildTransferMarketScoutingIntelByPlayerId,
  buildTransferMarketScoutingWatchPlayerIds,
} from "@/lib/foundation/tabs/use-market-v2-derivations";
import { getPrizePreviewGlobalWarnings } from "@/lib/foundation/tabs/use-prize-panel-derivations";
import { useSeasonPreviewDerivations } from "@/lib/foundation/tabs/use-season-preview-derivations";
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
const FoundationMatchdayArenaPanel = dynamic(
  () => import("@/app/foundation/matchday-arena-v2/FoundationMatchdayArenaPanel"),
  { ssr: false },
);
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
    setLineupDraftBoardView, scoutingCenterTab, setScoutingCenterTab, showCommandPalette, setShowCommandPalette, commandSearch, setCommandSearch, showExtendedTeamPanels, setShowExtendedTeamPanels, showGameFlowPanel,
    setShowGameFlowPanel, inboxCategoryFilter, setInboxCategoryFilter, inboxIncludeDone, setInboxIncludeDone, inboxIncludeDismissed, setInboxIncludeDismissed, selectedMatchdaySummaryId, setSelectedMatchdaySummaryId, teamSettingsSearch,
    setTeamSettingsSearch, showTeamDisciplines, setShowTeamDisciplines, selectedTeamDetailTab, setSelectedTeamDetailTab, showTeamContractPreviewRows, setShowTeamContractPreviewRows, teamRosterRoleFilter, setTeamRosterRoleFilter, teamRosterFocusMode,
    setTeamRosterFocusMode, showSelectedRosterPpsBreakdown, setShowSelectedRosterPpsBreakdown, trainingModeDraft, setTrainingModeDraft, trainingClassDraft, setTrainingClassDraft, trainingDevelopmentFilter, setTrainingDevelopmentFilter, trainingFacilityPreviewId,
    setTrainingFacilityPreviewId, seasonEndAttributeDraft, setSeasonEndAttributeDraft, plannedXpUpgrades, setPlannedXpUpgrades, seasonEndXpSpendPreview, setSeasonEndXpSpendPreview, seasonEndXpSpendBusy, setSeasonEndXpSpendBusy, seasonEndXpSpendError,
    setSeasonEndXpSpendError, seasonEndXpSpendSuccess, setSeasonEndXpSpendSuccess, seasonTableMode, setSeasonTableMode, showSeasonTopPlayerAreas, setShowSeasonTopPlayerAreas, tableSorts, setTableSorts, playerScope,
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
  const [prizeForecastRank, setPrizeForecastRank] = useState(1);
  useEffect(() => {
    setHistoryPage(1);
  }, [activeSaveId]);

  const activeTransferMarketTab = "v2" as const;
  const isTransferMarketViewActive = activeView === "marketV2";
  const activeTransferHistoryTab = "v2" as const;
  const isTransferHistoryViewActive = activeView === "historyV2";
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
  const shouldBuildHomeV2Overview = activeView === "homeV2";
  const shouldBuildTransferHistoryView = isTransferHistoryViewActive;
  const shouldBuildDebugView = activeView === "debug";
  const [featureAuditFilter, setFeatureAuditFilter] = useState<FeatureAuditFilter>("all");
  const [matchdaySummaryTab, setMatchdaySummaryTab] = useState<"matchday" | "season">("matchday");
  const shouldBuildTeamContracts = activeView === "teams" && selectedTeamDetailTab === "contracts";
  const shouldBuildExtendedTeamPanels = activeView === "teams" && showExtendedTeamPanels;
  const {
    shouldBuildTeamsView,
    shouldBuildTeamsOverviewTable,
    shouldBuildTeamsPlayerRatings,
    teamsHydrationPhase,
  } = useTeamsHydrationPhase({
    activeView,
    selectedTeamId,
    selectedTeamDetailTab,
    shouldBuildTeamContracts,
    shouldBuildExtendedTeamPanels,
  });
  const shouldLoadTransferHistoryFeed = resolveShouldLoadTransferHistoryFeed(activeView as FoundationViewId);
  const shouldLoadPrizePreviewFeed = resolveShouldLoadPrizePreviewFeed(
    activeView as FoundationViewId,
    prizeFinanceTab,
  );
  const shouldBuildPrizeV2Ui = resolveShouldBuildPrizeV2Ui(activeView as FoundationViewId, prizeFinanceTab);
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
  const shouldBuildSeasonTopPlayerRows =
    activeView === "seasonV2" ||
    activeView === "ranks" ||
    activeView === "diszis" ||
    activeView === "prize";
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
      setSeasonEndXpSpendPreview,
      setSeasonEndXpSpendError,
      setSeasonEndXpSpendSuccess,
      setPlannedXpUpgrades,
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

    setTrainingModeDraft((current) => ({
      ...current,
      [playerId]: mode,
    }));

    const nextGameState: GameState = {
      ...gameState,
      players: gameState.players.map((player) => (player.id === playerId ? { ...player, trainingMode: mode } : player)),
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
      const { buildPlayerDrawerDataFromGameState } = await import("@/lib/foundation/player-detail-drawer");
      const nextData = buildPlayerDrawerDataFromGameState({
        gameState: gameStateRef.current,
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

    setSeasonBriefingOpen(true);
    setFoundationPanel("briefing");
    syncFoundationViewInUrl(activeView, null, null, {
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

  const { runCockpitAiLineupBatchApply, runCockpitRosterFill } = useMemo(
    () =>
      createCockpitAiBatchHandlers({
        readMetaSource: readMeta.source,
        showReadOnlyNotice,
        setCockpitBusyKey,
        buildCockpitScopeParams,
        roomContext,
        marketAiApplyIncludeWarnings,
        cockpitAiIncludeWarningTeams,
        cockpitAiOverwriteExisting,
        setMarketAiApplyBusy,
        setMarketAiApplyFeed,
        setRosterFillBusy,
        setRosterFillFeed,
        setCockpitAiBatchApplyFeed,
        reloadAfterMarketRosterApply,
        reloadResolvePreview,
      }),
    [
      readMeta.source,
      showReadOnlyNotice,
      setCockpitBusyKey,
      buildCockpitScopeParams,
      roomContext,
      marketAiApplyIncludeWarnings,
      cockpitAiIncludeWarningTeams,
      cockpitAiOverwriteExisting,
      reloadAfterMarketRosterApply,
      reloadResolvePreview,
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
    runCockpitMatchdayMvpScoring,
    runCockpitResultApply,
    runCockpitStandingsApply,
    runCockpitCashApply,
    runCockpitMatchdayAdvance,
    runCockpitMatchdayAutoRun,
  } = matchdayArenaApplyHandlers;

  const { runPreSeasonWorkflowPreview, runPreSeasonNextSeasonSetup } = useMemo(
    () =>
      createCockpitPreseasonHandlers({
        readMetaSource: readMeta.source,
        showReadOnlyNotice,
        setCockpitBusyKey,
        withRoomBody,
        activeSaveId,
        preSeasonWorkflowFeed,
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
      }),
    [
      activeSaveId,
      loadSave,
      preSeasonWorkflowFeed,
      readMeta.source,
      reloadHistoryFeed,
      reloadSeasonManagementOverview,
      reloadSeasonStandingsOverview,
      reloadTransferRecapFeed,
      setActiveView,
      setCockpitBusyKey,
      setMarketReloadToken,
      setPreSeasonWorkflowBusy,
      setPreSeasonWorkflowError,
      setPreSeasonWorkflowFeed,
    ],
  );

  const {
    runSeasonTransition,
    runSeasonCompletion,
    runCockpitWholeSeasonDryRun,
    runSeasonSnapshotAction,
    refreshSeasonCockpit,
  } = useMemo(
    () =>
      createCockpitSeasonTransitionHandlers({
        readMetaSource: readMeta.source,
        showReadOnlyNotice,
        setCockpitBusyKey,
        withRoomBody,
        activeSaveId,
        seasonId: gameState.season.id,
        wholeSeasonMaxMatchdays,
        wholeSeasonIncludeWarningLineups,
        wholeSeasonOverwriteExistingLineups,
        wholeSeasonStopOnTie,
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
      }),
    [
      activeSaveId,
      gameState.season.id,
      loadSave,
      readMeta.source,
      reloadHistoryFeed,
      reloadPrizePreviewFeed,
      reloadResolvePreview,
      reloadSeasonManagementOverview,
      reloadSeasonStandingsOverview,
      reloadStandingsPreviewFeed,
      reloadTransferRecapFeed,
      setActiveView,
      setCashApplyFeed,
      setCockpitBusyKey,
      setFoundationActionFeedback,
      setSeasonCompletionFeed,
      setSeasonSnapshotFeed,
      setSeasonTransitionBusy,
      setSeasonTransitionError,
      setSeasonTransitionFeed,
      setWholeSeasonDryRunFeed,
      wholeSeasonIncludeWarningLineups,
      wholeSeasonMaxMatchdays,
      wholeSeasonOverwriteExistingLineups,
      wholeSeasonStopOnTie,
    ],
  );

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

  function addSeasonEndXpUpgrade(playerId: string, attribute: PlayerGeneratorAttributeName) {
    if (!selectedTeamCanManage) {
      setSeasonEndXpSpendError(`${selectedTeam?.name ?? "Dieses Team"} gehoert nicht zu deinen steuerbaren Teams. Training ist read-only.`);
      showTeamManagementLockedNotice();
      return;
    }
    const plannedPlayer = seasonEndProgressionPreview?.rows.find((row) => row.playerId === playerId)?.playerName ?? "Spieler";
    setSeasonEndXpSpendSuccess(`Training geplant: ${plannedPlayer} +1 ${SEASON_END_ATTRIBUTE_LABELS[attribute]}. Noch nicht gespeichert.`);
    setSeasonEndXpSpendError(null);
    setPlannedXpUpgrades((current) => [
      ...current,
      {
        playerId,
        attribute,
        source: "manual_xp_spend_preview",
      },
    ]);
  }

  function removeSeasonEndXpUpgrade(playerId: string, attribute?: PlayerGeneratorAttributeName) {
    if (!selectedTeamCanManage) {
      setSeasonEndXpSpendError(`${selectedTeam?.name ?? "Dieses Team"} gehoert nicht zu deinen steuerbaren Teams. Training ist read-only.`);
      showTeamManagementLockedNotice();
      return;
    }
    setSeasonEndXpSpendSuccess("Training angepasst: ein geplantes Upgrade entfernt. Noch nicht gespeichert.");
    setSeasonEndXpSpendError(null);
    setPlannedXpUpgrades((current) => {
      const index = [...current]
        .reverse()
        .findIndex((upgrade) => upgrade.playerId === playerId && (!attribute || upgrade.attribute === attribute));
      if (index < 0) return current;
      const removeIndex = current.length - 1 - index;
      return current.filter((_, candidateIndex) => candidateIndex !== removeIndex);
    });
  }

  async function confirmSeasonEndXpSpend() {
    if (!seasonEndXpSpendPreview?.confirmToken) {
      setSeasonEndXpSpendError("xp_spend_preview_missing: Bitte Preview neu laden.");
      return;
    }
    if (seasonEndXpSpendPreview.saveContext.saveId !== activeSaveId || seasonEndXpSpendPreview.team?.teamId !== selectedTeam.teamId) {
      setSeasonEndXpSpendError("xp_spend_preview_stale: Save oder Team hat sich geaendert. Bitte neu planen.");
      return;
    }
    if (readMeta.source === "prisma") {
      showReadOnlyNotice();
      return;
    }
    if (!selectedTeamCanManage) {
      setSeasonEndXpSpendError(`${selectedTeam.name} gehoert nicht zu deinen steuerbaren Teams. Training ist read-only.`);
      showTeamManagementLockedNotice();
      return;
    }

    setSeasonEndXpSpendBusy(true);
    setSeasonEndXpSpendError(null);
    setSeasonEndXpSpendSuccess(null);

    try {
      const response = await fetch("/api/progression/season-end-xp-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRoomBody({
          source: readMeta.source,
          saveId: activeSaveId,
          teamId: selectedTeam.teamId,
          plannedUpgrades: plannedXpUpgrades,
          dryRun: false,
          confirmToken: seasonEndXpSpendPreview.confirmToken,
        })),
      });
      const payload = (await response.json()) as SeasonEndXpSpendApiResponse;
      if (!response.ok || !payload.success || !payload.summary || !("applied" in payload.summary)) {
        setSeasonEndXpSpendError(payload.error ?? payload.blockingReasons?.join(" · ") ?? "XP-Apply blockiert.");
        setSeasonEndXpSpendPreview(payload.summary && "dryRun" in payload.summary ? (payload.summary as SeasonEndXpSpendPreview) : seasonEndXpSpendPreview);
        return;
      }

      setSeasonEndXpSpendSuccess(
        plannedXpUpgrades.length > 0
          ? `XP-Upgrades bestaetigt: ${payload.summary.eventIds.length} Progression-Event(s) · ${plannedXpUpgrades.length} Upgrade(s) geschrieben.`
          : `Season-XP eingesammelt: ${payload.summary.eventIds.length} Progression-Event(s) geschrieben.`,
      );
      setPlannedXpUpgrades([]);
      setSeasonEndXpSpendPreview(null);
      await loadSave(activeSaveId);
    } catch {
      setSeasonEndXpSpendError("XP-Apply konnte nicht ausgefuehrt werden.");
    } finally {
      setSeasonEndXpSpendBusy(false);
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
    setPlannedXpUpgrades([]);
    setSeasonEndXpSpendPreview(null);
    setSeasonEndXpSpendError(null);
    setSeasonEndXpSpendSuccess(null);
  }, [activeSaveId, selectedTeamId]);

  useEffect(() => {
    if (!activeSaveId || !selectedTeamId || isFoundationBootstrapState || plannedXpUpgrades.length === 0) {
      setSeasonEndXpSpendPreview(null);
      setSeasonEndXpSpendError(null);
      setSeasonEndXpSpendBusy(false);
      return undefined;
    }

    const controller = new AbortController();
    setSeasonEndXpSpendBusy(true);
    setSeasonEndXpSpendError(null);

    fetch("/api/progression/season-end-xp-spend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(withRoomBody({
        source: readMeta.source,
        saveId: activeSaveId,
        teamId: selectedTeamId,
        plannedUpgrades: plannedXpUpgrades,
        dryRun: true,
      })),
    })
      .then(async (response) => {
        const payload = (await response.json()) as SeasonEndXpSpendApiResponse;
        if (controller.signal.aborted) {
          return;
        }
        setSeasonEndXpSpendPreview(payload.summary && "dryRun" in payload.summary ? (payload.summary as SeasonEndXpSpendPreview) : null);
        if (!response.ok || payload.error) {
          setSeasonEndXpSpendError(payload.error ?? payload.blockingReasons?.join(" · ") ?? "XP-Preview blockiert.");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        setSeasonEndXpSpendError(error instanceof Error ? error.message : "XP-Preview konnte nicht geladen werden.");
        setSeasonEndXpSpendPreview(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSeasonEndXpSpendBusy(false);
        }
      });

    return () => controller.abort();
  }, [activeSaveId, isFoundationBootstrapState, plannedXpUpgrades, readMeta.source, selectedTeamId]);

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
    if (activeView === "players") {
      prefetchFoundationPanel("trainingCompact");
    }
    if (activeView === "matchdayArena") {
      prefetchFoundationPanel("seasonV2");
    }
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
    if (targetView === "lineup") {
      setLineupFocusRequestKey(`lineup-${navigationTeamId ?? activeManagerTeamId ?? "team"}-${Date.now()}`);
      if (targetPanel === "form-board") {
        setLineupDraftBoardViewRequest("formBoard");
      }
    }
    const panel = typeof item.targetParams.panel === "string" ? item.targetParams.panel : null;
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
        ? "Aktion laeuft gerade."
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

  const selectedIdentity = useMemo(
    () =>
      selectedTeam
        ? gameState.teamIdentities.find((identity) => identity.teamId === selectedTeam.teamId) ?? null
        : null,
    [gameState.teamIdentities, selectedTeam],
  );
  const selectedIdentityDraft = useMemo(
    () => (selectedTeam ? teamIdentityDraft[selectedTeam.teamId] ?? selectedIdentity ?? null : null),
    [selectedIdentity, selectedTeam, teamIdentityDraft],
  );
  const selectedIdentityAxisBias = useMemo(
    () => deriveTeamIdentityAxisBias(selectedIdentityDraft),
    [selectedIdentityDraft],
  );
  const selectedTeamStrategyDraft = useMemo(
    () => (selectedTeam ? teamStrategyDraft[selectedTeam.teamId] ?? resolvedTeamStrategyProfiles[selectedTeam.teamId] ?? null : null),
    [resolvedTeamStrategyProfiles, selectedTeam, teamStrategyDraft],
  );
  const selectedTeamHasUnsavedChanges = useMemo(() => {
    if (!selectedTeam) {
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
    resolvedTeamControlSettings,
    resolvedTeamStrategyProfiles,
    selectedIdentity,
    selectedTeam,
    teamControlDraft,
    teamIdentityDraft,
    teamStrategyDraft,
  ]);
  const filteredTeamSettingsTeams = useMemo(() => {
    const query = teamSettingsSearch.trim().toLowerCase();
    if (!query) {
      return gameState.teams;
    }

    return gameState.teams.filter((team) => {
      const haystack = `${team.name} ${team.shortCode} ${team.teamId}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [gameState.teams, teamSettingsSearch]);
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
  const selectedTeamContractTable = useMemo(
    () =>
      selectedTeam && shouldBuildTeamContracts
        ? buildTeamContractSeasonTable({
            gameState,
            teamId: selectedTeam.teamId,
            seasonLabelBase: canonicalSeasonLabel,
          })
        : null,
    [canonicalSeasonLabel, gameState, selectedTeam, shouldBuildTeamContracts],
  );
  const selectedTeamContractShapeMix = useMemo(() => {
    if (!selectedTeamContractTable) {
      return null;
    }

    const activeRows = selectedTeamContractTable.rows.filter((row) => row.status === "active");
    const totalCount = activeRows.length;
    const buckets: Record<
      ContractShape,
      {
        shape: ContractShape;
        label: string;
        count: number;
        totalSalary: number;
        currentDelta: number;
        futureDelta: number;
      }
    > = {
      balanced: { shape: "balanced", label: "Balanced", count: 0, totalSalary: 0, currentDelta: 0, futureDelta: 0 },
      front_loaded: { shape: "front_loaded", label: "Front-loaded", count: 0, totalSalary: 0, currentDelta: 0, futureDelta: 0 },
      back_loaded: { shape: "back_loaded", label: "Back-loaded", count: 0, totalSalary: 0, currentDelta: 0, futureDelta: 0 },
    };

    activeRows.forEach((row) => {
      const shape = row.contractShape ?? "balanced";
      const scheduleSalary = row.yearlySalarySchedule.reduce((sum, entry) => sum + (Number.isFinite(entry.salary) ? entry.salary : 0), 0);
      const totalSalary = row.totalSalary ?? scheduleSalary;
      if (!Number.isFinite(totalSalary) || totalSalary <= 0) {
        buckets[shape].count += 1;
        return;
      }

      const contractLength = Math.max(1, row.contractLength || row.yearlySalarySchedule.length || 1);
      const balancedAnnualSalary = totalSalary / contractLength;
      const currentSalary = row.yearlySalarySchedule[0]?.salary ?? balancedAnnualSalary;
      const futureSalary = Math.max(0, totalSalary - currentSalary);
      const balancedFutureSalary = Math.max(0, totalSalary - balancedAnnualSalary);

      buckets[shape].count += 1;
      buckets[shape].totalSalary += totalSalary;
      buckets[shape].currentDelta += currentSalary - balancedAnnualSalary;
      buckets[shape].futureDelta += futureSalary - balancedFutureSalary;
    });

    const entries = (["balanced", "front_loaded", "back_loaded"] as ContractShape[]).map((shape) => {
      const bucket = buckets[shape];
      return {
        ...bucket,
        share: totalCount > 0 ? (bucket.count / totalCount) * 100 : 0,
        totalSalary: roundViewNumber(bucket.totalSalary, 2),
        currentDelta: roundViewNumber(bucket.currentDelta, 2),
        futureDelta: roundViewNumber(bucket.futureDelta, 2),
      };
    });

    const nonBalancedCurrentDelta = entries
      .filter((entry) => entry.shape !== "balanced")
      .reduce((sum, entry) => sum + entry.currentDelta, 0);
    const nonBalancedFutureDelta = entries
      .filter((entry) => entry.shape !== "balanced")
      .reduce((sum, entry) => sum + entry.futureDelta, 0);

    return {
      totalCount,
      entries,
      nonBalancedCount: entries.filter((entry) => entry.shape !== "balanced").reduce((sum, entry) => sum + entry.count, 0),
      currentDelta: roundViewNumber(nonBalancedCurrentDelta, 2),
      futureDelta: roundViewNumber(nonBalancedFutureDelta, 2),
    };
  }, [selectedTeamContractTable]);
  const selectedTeamContractPreviewRowCount = useMemo(
    () => selectedTeamContractTable?.rows.filter((row) => row.status === "preview").length ?? 0,
    [selectedTeamContractTable],
  );
  const visibleSelectedTeamContractRows = useMemo(
    () =>
      selectedTeamContractTable?.rows.filter((row) => showTeamContractPreviewRows || row.status !== "preview") ?? [],
    [selectedTeamContractTable, showTeamContractPreviewRows],
  );
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
  const selectedAiTeamId = shouldBuildExtendedTeamPanels
    ? selectedTeamControl?.controlMode === "ai"
      ? selectedTeam?.teamId
      : aiTeams[0]?.teamId
    : null;
  const aiPreview = useMemo(
    () => (selectedAiTeamId && shouldBuildExtendedTeamPanels ? runAiTurn(gameState, selectedAiTeamId) : null),
    [gameState, selectedAiTeamId, shouldBuildExtendedTeamPanels],
  );
  const aiMarketPreview = useMemo(
    () => (selectedAiTeamId && shouldBuildExtendedTeamPanels ? buildAiTransferIntents(gameState, selectedAiTeamId) : []),
    [gameState, selectedAiTeamId, shouldBuildExtendedTeamPanels],
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

  const seasonTableColumns = useMemo<FoundationTableColumn[]>(
    () => {
      const contractColumns = saisonstandColumnContract.columns.map((column) => ({
        id: column.normalizedKey,
        label: column.displayLabel,
        dataKey: column.normalizedKey,
        defaultWidth: Math.max(Math.round(column.columnSize ?? 96), 52),
        minWidth: column.normalizedKey === "mannschaft" ? 150 : 52,
        visibleByDefault: column.compactVisible,
        tooltip:
          column.normalizedKey === "bonuspunkte"
            ? `${column.sourceDescription} ${column.transformNote ?? ""}`.trim()
            : undefined,
      }));

      return [
        ...contractColumns,
        { id: "actions", label: "Aktion", dataKey: "actions", defaultWidth: 120, minWidth: 100, visibleByDefault: true },
      ];
    },
    [],
  );
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
      { id: "appearances", label: "Einsaetze", dataKey: "appearances", defaultWidth: 94, minWidth: 78 },
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
      { id: "fee", label: "Abloese", dataKey: "fee", defaultWidth: 110, minWidth: 90 },
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
  const standingsPreviewColumns = useMemo<FoundationTableColumn[]>(
    () => [
      { id: "team", label: "Team", dataKey: "team", defaultWidth: 220, minWidth: 170 },
      { id: "currentPoints", label: "Aktuelle Punkte", dataKey: "currentPoints", defaultWidth: 120, minWidth: 100 },
      { id: "matchdayScore", label: "Matchday Score", dataKey: "matchdayScore", defaultWidth: 120, minWidth: 100 },
      { id: "matchdayRank", label: "Matchday Rang", dataKey: "matchdayRank", defaultWidth: 110, minWidth: 90 },
      { id: "pointsDelta", label: "Punkte Delta", dataKey: "pointsDelta", defaultWidth: 110, minWidth: 90 },
      { id: "projectedPoints", label: "Punkte nachher", dataKey: "projectedPoints", defaultWidth: 120, minWidth: 100 },
      { id: "projectedRank", label: "Preview Rang", dataKey: "projectedRank", defaultWidth: 110, minWidth: 90 },
      { id: "currentRank", label: "Aktueller Rang", dataKey: "currentRank", defaultWidth: 110, minWidth: 90, visibleByDefault: false },
      { id: "resultStatus", label: "Result Status", dataKey: "resultStatus", defaultWidth: 140, minWidth: 120 },
      { id: "d1Score", label: "D1", dataKey: "d1Score", defaultWidth: 90, minWidth: 72, visibleByDefault: false },
      { id: "d2Score", label: "D2", dataKey: "d2Score", defaultWidth: 90, minWidth: 72, visibleByDefault: false },
      { id: "cash", label: "Cash", dataKey: "cash", defaultWidth: 110, minWidth: 90, visibleByDefault: false },
      { id: "readinessStatus", label: "Readiness", dataKey: "readinessStatus", defaultWidth: 140, minWidth: 120, visibleByDefault: false },
      { id: "warnings", label: "Warnings", dataKey: "warnings", defaultWidth: 260, minWidth: 180 },
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
  const selectedRosterColumns = useMemo<FoundationTableColumn[]>(
    () => [
      { id: "image", label: "Bild", dataKey: "image", defaultWidth: 96, minWidth: 80 },
      { id: "name", label: "Name", dataKey: "name", defaultWidth: 220, minWidth: 170 },
      { id: "class", label: "Klasse", dataKey: "class", defaultWidth: 130, minWidth: 110 },
      { id: "race", label: "Rasse", dataKey: "race", defaultWidth: 120, minWidth: 96 },
      { id: "mw", label: "MW", dataKey: "mw", defaultWidth: 110, minWidth: 90 },
      { id: "salePrice", label: "VK", dataKey: "salePrice", defaultWidth: 104, minWidth: 86 },
      { id: "saleFactor", label: "Faktor", dataKey: "saleFactor", defaultWidth: 84, minWidth: 72 },
      { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 110, minWidth: 90 },
      { id: "value", label: "Value", dataKey: "value", defaultWidth: 96, minWidth: 78 },
      { id: "contract", label: "LZ", dataKey: "contract", defaultWidth: 76, minWidth: 64 },
      { id: "ovr", label: "OVR", dataKey: "ovr", defaultWidth: 90, minWidth: 72 },
      { id: "mvs", label: "MVS", dataKey: "mvs", defaultWidth: 90, minWidth: 72 },
      { id: "pps", label: "PPs", dataKey: "pps", defaultWidth: 90, minWidth: 72 },
      ...(showSelectedRosterPpsBreakdown
        ? [
            { id: "ppPow", label: "PP POW", dataKey: "ppPow", defaultWidth: 78, minWidth: 66 },
            { id: "ppSpe", label: "PP SPE", dataKey: "ppSpe", defaultWidth: 78, minWidth: 66 },
            { id: "ppMen", label: "PP MEN", dataKey: "ppMen", defaultWidth: 78, minWidth: 66 },
            { id: "ppSoc", label: "PP SOC", dataKey: "ppSoc", defaultWidth: 78, minWidth: 66 },
          ]
        : []),
      { id: "pow", label: "POW", dataKey: "pow", defaultWidth: 74, minWidth: 60 },
      { id: "spe", label: "SPE", dataKey: "spe", defaultWidth: 74, minWidth: 60 },
      { id: "men", label: "MEN", dataKey: "men", defaultWidth: 74, minWidth: 60 },
      { id: "soc", label: "SOC", dataKey: "soc", defaultWidth: 74, minWidth: 60 },
      ...(
        showTeamDisciplines
          ? orderedDisciplines.map((discipline) => ({
              id: discipline.id,
              label: discipline.name.slice(0, 3).toUpperCase(),
              dataKey: discipline.id,
              defaultWidth: 82,
              minWidth: 68,
            }))
          : []
      ),
    ],
    [orderedDisciplines, showSelectedRosterPpsBreakdown, showTeamDisciplines],
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
          description: "Kernwerte fuer schnellen Spieltagsblick.",
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

  const {
    featureAuditMatrix,
    filteredFeatureAuditEntries,
    multiSeasonBalanceDashboard,
    multiSeasonTeamBalanceColumns,
    multiSeasonEconomyColumns,
    multiSeasonPlayerColumns,
    multiSeasonGameplayColumns,
    visibleMultiSeasonTeamBalanceColumns,
    visibleMultiSeasonEconomyColumns,
    visibleMultiSeasonPlayerColumns,
    visibleMultiSeasonGameplayColumns,
    sortedMultiSeasonTeamRows,
    sortedMultiSeasonEconomyRows,
    sortedMultiSeasonPlayerRows,
    sortedMultiSeasonGameplayRows,
  } = useCockpitPanelDerivations({
    gameState,
    resolvePreviewFeed,
    featureAuditFilter,
    tableColumnPreferences,
    tableSorts,
    isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
  });

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
    () => (selectedTeam ? buildSponsorCommercialRating({ gameState, teamId: selectedTeam.teamId }) : null),
    [gameState, selectedTeam],
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

  const selectedAtRiskObjectives = useMemo(
    () => selectedTeamObjectives.filter((objective) => objective.status === "at_risk" || objective.status === "failed"),
    [selectedTeamObjectives],
  );
  const selectedTransfermarktBoardObjectives = useMemo(
    () =>
      selectedTeamObjectives
        .filter((objective) => objective.status === "open" || objective.status === "at_risk" || objective.status === "failed")
        .filter((objective) =>
          objective.category === "transfer" ||
          objective.category === "player" ||
          objective.category === "roster" ||
          objective.objectiveId === "finance-salary-ratio" ||
          objective.objectiveId === "finance-rebuild-cash-buffer",
        )
        .slice(0, 3),
    [selectedTeamObjectives],
  );

  const selectedTeamCaptainProfile = useMemo(
    () => (selectedTeam ? selectTeamCaptain(gameState, selectedTeam.teamId) : null),
    [gameState, selectedTeam?.teamId],
  );
  const selectedTeamRivalries = useMemo(() => {
    if (!selectedTeam) {
      return [];
    }
    return buildTeamRivalryLedger(gameState)
      .filter((entry) => entry.teamAId === selectedTeam.teamId || entry.teamBId === selectedTeam.teamId)
      .slice(0, 4);
  }, [gameState, selectedTeam?.teamId]);
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
  const selectedHqPriorityCards = useMemo(() => {
    const cards: Array<{
      key: string;
      kicker: string;
      title: string;
      detail: string;
      tone: "board" | "finance" | "lineup" | "story" | "power";
      targetView: FoundationView;
    }> = [];
    const urgentObjective = selectedAtRiskObjectives[0] ?? selectedOpenObjectives[0] ?? null;
    if (urgentObjective) {
      cards.push({
        key: `objective-${urgentObjective.objectiveId}`,
        kicker: urgentObjective.status === "at_risk" || urgentObjective.status === "failed" ? "Boarddruck" : "Boardziel",
        title: urgentObjective.label,
        detail: urgentObjective.actionHint ?? urgentObjective.detail ?? `${String(urgentObjective.currentValue ?? "—")} / ${String(urgentObjective.targetValue ?? "—")}`,
        tone: "board",
        targetView: urgentObjective.category === "finance" ? "prize" : urgentObjective.category === "facility" ? "trainingV2" : "season",
      });
    }
    if (selectedHqFinanceWarnings[0]) {
      cards.push({
        key: "finance-warning",
        kicker: "Finanzen",
        title: "Cash/Gehalt prüfen",
        detail: selectedHqFinanceWarnings[0],
        tone: "finance",
        targetView: "prize",
      });
    }
    if (selectedTeamPlayerDemands[0]) {
      cards.push({
        key: `demand-${selectedTeamPlayerDemands[0].demandId}`,
        kicker: "Forderung",
        title: selectedTeamPlayerDemands[0].playerName,
        detail: selectedTeamPlayerDemands[0].label,
        tone: "lineup",
        targetView: selectedTeamPlayerDemands[0].type === "facility" ? "trainingV2" : "lineup",
      });
    }
    if (selectedTeamRivalries[0]) {
      const rivalry = selectedTeamRivalries[0];
      const rivalId = rivalry.teamAId === selectedTeam?.teamId ? rivalry.teamBId : rivalry.teamAId;
      const rivalTeam = gameState.teams.find((team) => team.teamId === rivalId) ?? null;
      cards.push({
        key: `rivalry-${rivalry.rivalryId}`,
        kicker: "Rivalität",
        title: rivalTeam?.name ?? "Rivale aktiv",
        detail: `${rivalry.theme} · Intensität ${rivalry.intensity}`,
        tone: "story",
        targetView: "hq",
      });
    }
    if (selectedTeamPowers.some((power) => power.chargesRemaining > 0)) {
      const readyPower = selectedTeamPowers.find((power) => power.chargesRemaining > 0) ?? null;
      cards.push({
        key: `power-${readyPower?.id ?? "ready"}`,
        kicker: "Team Power",
        title: readyPower?.label ?? "Powers bereit",
        detail: readyPower ? `${readyPower.chargesRemaining}/${readyPower.chargesTotal} Einsätze · in der Einsatzliste spielen` : "In der Einsatzliste einsetzen.",
        tone: "power",
        targetView: "lineup",
      });
    }
    if (cards.length === 0) {
      cards.push({
        key: "stable",
        kicker: "Status",
        title: "Front Office stabil",
        detail: "Keine akute Board-, Finanz- oder Kaderwarnung. Fokus auf Einsatzliste und Entwicklung.",
        tone: "story",
        targetView: "lineup",
      });
    }
    return cards.slice(0, 5);
  }, [
    gameState.teams,
    selectedAtRiskObjectives,
    selectedHqFinanceWarnings,
    selectedOpenObjectives,
    selectedTeam?.teamId,
    selectedTeamPlayerDemands,
    selectedTeamPowers,
    selectedTeamRivalries,
  ]);

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
  const transferMarketV2RosterRows = useMemo(() => {
    if (!shouldBuildMarketView) {
      return [];
    }
    const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
    return gameState.rosters
      .map((entry) => {
        const player = playersById.get(entry.playerId);
        if (!player) {
          return null;
        }
        const playerRating = playerRatingsById.get(player.id) ?? null;
        const portrait = getPlayerPortraitModel(player);
        return {
          activePlayerId: entry.id,
          playerId: player.id,
          teamId: entry.teamId,
          name: player.name,
          className: player.className,
          race: player.race,
          portraitUrl: portrait.src ?? null,
          marketValue: getRosterEntryDisplayMarketValue(entry, player),
          salary: getRosterEntryDisplaySalary(entry, player),
          contractLength: entry.contractLength ?? null,
          pps: playerRating?.ppsSeason ?? player.pps ?? null,
          ovr: playerRating?.ovrNormalized ?? player.ovr ?? null,
          mvs: playerRating?.mvs ?? null,
          valueScore:
            (playerRating?.ppsSeason ?? player.pps ?? null) != null && getRosterEntryDisplaySalary(entry, player) != null && (getRosterEntryDisplaySalary(entry, player) ?? 0) > 0
              ? (playerRating?.ppsSeason ?? player.pps ?? 0) / (getRosterEntryDisplaySalary(entry, player) ?? 1)
              : null,
          pow: player.coreStats.pow ?? null,
          spe: player.coreStats.spe ?? null,
          men: player.coreStats.men ?? null,
          soc: player.coreStats.soc ?? null,
          disciplineRatings: player.disciplineRatings,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [gameState.players, gameState.rosters, playerRatingsById, shouldBuildMarketView]);
  const rosterPlayersByOvr = useMemo(
    () =>
      [...rosterPlayers].sort((left, right) => {
        const leftRating = playerRatingsById.get(left.player.id);
        const rightRating = playerRatingsById.get(right.player.id);
        return compareTeamRosterPlayersByOvrOrMarketValue({
          left: {
            ovr: leftRating?.ovrNormalized,
            marketValue: getRosterEntryDisplayMarketValue(left.entry, left.player),
            mvs: leftRating?.mvs,
            name: left.player.name,
          },
          right: {
            ovr: rightRating?.ovrNormalized,
            marketValue: getRosterEntryDisplayMarketValue(right.entry, right.player),
            mvs: rightRating?.mvs,
            name: right.player.name,
          },
        });
      }),
    [playerRatingsById, rosterPlayers],
  );
  const starters = useMemo(
    () =>
      activeView === "teams" && showExtendedTeamPanels
        ? rosterPlayersByOvr.filter((item) => item.entry.roleTag === "starter")
        : [],
    [activeView, rosterPlayersByOvr, showExtendedTeamPanels],
  );
  const bench = useMemo(
    () =>
      activeView === "teams" && showExtendedTeamPanels
        ? rosterPlayersByOvr.filter((item) => item.entry.roleTag !== "starter")
        : [],
    [activeView, rosterPlayersByOvr, showExtendedTeamPanels],
  );

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

  const {
    teamsViewRows,
    sortedTeamsViewRows,
    teamHistorySeasonPointColumns,
    teamHistoryPointRankMaps,
    teamsViewSummary,
    selectedHqAxisSummary,
  } = useTeamsViewRowDerivations({
    enabled: shouldBuildTeamsView,
    teamsHydrationPhase,
    shouldBuildTeamsOverviewTable,
    selectedTeam,
    seasonStandRows,
    currentAreaRanksByTeamId,
    teamsViewSort: tableSorts.teamsView,
  });

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
    currentAreaRanksByTeamId,
    seasonPointsLedger,
    teamObjectiveOverview,
    currentMatchdayDisciplineSchedule,
  });

  const selectedTeamsHistoryData = useMemo<TeamDetailDrawerData | null>(() => {
    if (activeView !== "teams") {
      return null;
    }
    return buildTeamDetailDrawerData(selectedTeam.teamId, "history-summary");
  }, [
    activeView,
    canonicalSeasonLabel,
    currentAreaRanksByTeamId,
    currentMatchdayDisciplineSchedule,
    gameState,
    playerRatingsById,
    seasonPointsLedger,
    selectedTeam.teamId,
    teamObjectiveOverview.boardConfidence,
    teamObjectiveOverview.objectives,
    seasonStandRows,
  ]);
  const teamEconomyTiles = useMemo(() => {
    const data = selectedTeamsHistoryData;
    if (!data) {
      return [];
    }
    return [
      {
        label: "Gehalt",
        value: data.salaryTotal != null ? formatMoney(data.salaryTotal) : "—",
        note: `${data.rosterSize} Spieler`,
        detail: "Gesamtgehaltsblock des aktiven Kaders",
        tone: "salary" as const,
      },
      {
        label: "Marktwert",
        value: data.marketValueTotal != null ? formatMoney(data.marketValueTotal) : "—",
        note: data.cash != null ? `Cash ${formatMoney(data.cash)}` : "—",
        detail: "Team-Marktwert und Liquidität",
        tone: "value" as const,
      },
    ];
  }, [selectedTeamsHistoryData]);
  const freeAgents = useMemo(() => {
    if (!shouldBuildExtendedTeamPanels) {
      return [];
    }

    const rosteredIds = new Set(gameState.rosters.map((entry) => entry.playerId));
    return gameState.players
      .filter((player) => !rosteredIds.has(player.id))
      .sort((left, right) => {
        const leftRating = playerRatingsById.get(left.id);
        const rightRating = playerRatingsById.get(right.id);
        const ovrDelta =
          (rightRating?.ovrNormalized ?? Number.NEGATIVE_INFINITY) -
          (leftRating?.ovrNormalized ?? Number.NEGATIVE_INFINITY);
        if (ovrDelta !== 0) {
          return ovrDelta;
        }

        return left.name.localeCompare(right.name, "de");
      })
      .slice(0, 6);
  }, [gameState.players, gameState.rosters, playerRatingsById, shouldBuildExtendedTeamPanels]);

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
    seasonEndFacilityInput,
    seasonEndProgressionPreview,
    trainingV2ModeOptions,
  } = useFoundationCrossTabTraining({
    shouldBuildTrainingView,
    shouldBuildTrainingCompactView,
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
    plannedXpUpgradesLength: plannedXpUpgrades.length,
    seasonEndAttributeDraft,
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
    hqTransferWishlistEntries,
    hqTransferSellMarkers,
    hqContractExpiringCount,
    hqTrainingFocusCount,
  } = useFoundationCrossTabMarketFilters({
    activeView: activeView as FoundationViewId,
    shouldBuildMarketView,
    shouldBuildTeamsView,
    shouldBuildHomeV2Overview,
    activeSaveId,
    gameState,
    selectedTeam,
    selectedTeamFacilityState,
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
  const visibleSelectedRosterColumns = useMemo(
    () => {
      const orderedColumns = applyStoredColumnOrder(
        selectedRosterColumns,
        tableColumnPreferences.selectedRosterTable?.columnOrder,
        getTablePinnedLeftIds("selectedRosterTable"),
        getTablePinnedRightIds("selectedRosterTable"),
      ).filter((column) =>
        isTableColumnVisible("selectedRosterTable", column.id, column.visibleByDefault),
      );
      const breakdownColumnIds = new Set(["ppPow", "ppSpe", "ppMen", "ppSoc"]);
      const breakdownColumns = orderedColumns.filter((column) => breakdownColumnIds.has(column.id));
      if (breakdownColumns.length === 0) {
        return orderedColumns;
      }
      const baseColumns = orderedColumns.filter((column) => !breakdownColumnIds.has(column.id));
      const ppsIndex = baseColumns.findIndex((column) => column.id === "pps");
      if (ppsIndex === -1) {
        return orderedColumns;
      }
      return [
        ...baseColumns.slice(0, ppsIndex + 1),
        ...breakdownColumns,
        ...baseColumns.slice(ppsIndex + 1),
      ];
    },
    [selectedRosterColumns, tableColumnPreferences],
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
      (gameState.seasonState.matchdayResults ?? []).some((result) => result.seasonId === gameState.season.id)
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
            ? `${aiTeams.length} Teams werden automatisch gefuehrt`
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
        detail: `${getTeamLockedName(payload.teamId)} ist fuer ${currentMatchdayDisplayLabel} aktualisiert. KI-Lineups werden bei Bedarf nachgezogen.`,
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
    const normalizedStoredRun = normalizeAiPreseasonRun(aiPreseasonStoredRun);
    const storedStatus = normalizedStoredRun?.status ?? null;
    const alreadyHandled =
      storedStatus === "running" ||
      storedStatus === "completed" ||
      storedStatus === "skipped" ||
      storedStatus === "failed";
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
  const closeSeasonBriefing = (markCompleted = true) => {
    const briefingKey = buildSeasonBriefingDismissKey(activeSaveId, gameState.season.id);
    setSeasonBriefingOpen(false);
    setFoundationPanel((current) => (current === "briefing" ? null : current));
    seasonBriefingDismissedRef.current.add(briefingKey);
    seasonBriefingAutoOpenedRef.current = briefingKey;
    writeSeasonBriefingDismissedToStorage(activeSaveId, gameState.season.id);
    if (seasonBriefingStepStatus === "open") {
      updateNewGameFlowStepStatus("season_intro", markCompleted ? "completed" : "skipped");
    }
    clearSeasonBriefingFromUrl();
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

    setFoundationView((seasonSetupFlow?.rosterCount ?? rosterPlayers.length) === 0 ? "marketV2" : "trainingCompact", setActiveView);
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
            xp: row.player.currentXP ?? 0,
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
      return [
      {
        key: "lineup",
        kicker: "Heute wichtig",
        title: homeNextMatchdayStatus.openSlots > 0 ? `${homeNextMatchdayStatus.openSlots} Slots offen` : "Einsatz bereit",
        detail: homeNextMatchdayStatus.openSlots > 0 ? "erst Team setzen" : "direkt Arena spielen",
        tone: homeNextMatchdayStatus.openSlots > 0 ? "warning" : "ready",
        view: homeNextMatchdayStatus.openSlots > 0 ? "lineup" : "matchdayArena",
      },
      {
        key: "team",
        kicker: "Teamzustand",
        title: selectedStandingRow?.rank != null ? `Rang #${selectedStandingRow.rank}` : "Team pruefen",
        detail: selectedStandingRow?.points != null ? `${formatLocalePoints(selectedStandingRow.points, 1)} Punkte` : "Roster & Finanzen",
        tone: "info",
        view: "teams",
      },
      {
        key: "tasks",
        kicker: "Aufgaben",
        title: homeTasks.length > 0 ? `${homeTasks.length} Quest${homeTasks.length === 1 ? "" : "s"}` : "Keine offenen Quests",
        detail: homeTasks[0]?.title ?? "bereit fuer den naechsten Zug",
        tone: homeTasks.some((task) => task.severity === "critical")
          ? "warning"
          : homeTasks.length > 0
            ? "info"
            : "ready",
        view: homeTasks.length > 0 ? "inboxV2" : "home",
      },
    ];
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
          currentXP: row.player.currentXP ?? 0,
          spentXP: row.player.spentXP ?? 0,
          lifetimeXP: row.player.lifetimeXP ?? null,
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
        };
      }),
    [gameState, selectedTeam?.teamId, sortedSeasonStandRows],
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
  const seasonV2TopPlayers = useMemo(() => {
    const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
    return sortedSeasonTopPlayerRows.slice(0, SEASON_V2_TOP_PLAYER_LIMIT).map((row) => {
      const player = playerById.get(row.playerId) ?? null;
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
  }, [gameState.players, sortedSeasonTopPlayerRows]);
  const seasonV2PlayerRows = useMemo(() => {
    const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
    return sortedSeasonTopPlayerRows.map((row) => {
      const player = playerById.get(row.playerId) ?? null;
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
  }, [gameState.players, sortedSeasonTopPlayerRows]);
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
  const {
    sortedSelectedRosterTableRows,
    filteredSelectedRosterTableRows,
    teamRosterFocusOptions,
    teamRosterRoleFilterOptions,
  } = useTeamsRosterTableDerivations({
    selectedRosterTableRows,
    selectedRosterSort: tableSorts.selectedRoster,
    disciplines: gameState.disciplines,
    gameState,
    teamRosterFocusMode,
    teamRosterRoleFilter,
    getRosterEntryDisplayMarketValue,
    getRosterEntryDisplaySalary,
    getRosterEntrySalarySortValue,
    getRosterEntrySalaryDelta,
  });
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

  useEffect(() => {
    if (!shouldBuildPrizeV2Ui) {
      return;
    }
    const defaultRank = selectedPrizePreviewRow?.rank ?? selectedStandingRow?.rank ?? 1;
    setPrizeForecastRank(clampValue(Math.round(defaultRank), 1, 32));
  }, [selectedPrizePreviewRow?.rank, selectedStandingRow?.rank, selectedTeam?.teamId, shouldBuildPrizeV2Ui]);
  const prizeForecastRankRow = useMemo(
    () => prizePreviewRows.find((row) => row.rank === prizeForecastRank) ?? null,
    [prizeForecastRank, prizePreviewRows],
  );
  const prizeForecastSalaryTotal = useMemo(() => {
    if (!shouldBuildPrizeV2Ui) {
      return null;
    }
    if (selectedPrizePreviewRow?.salaryTotal != null) {
      return selectedPrizePreviewRow.salaryTotal;
    }

    if (!selectedTeam) {
      return null;
    }

    return roundViewNumber(
      selectedRoster.reduce((sum, rosterEntry) => {
        const player = gameState.players.find((candidate) => candidate.id === rosterEntry.playerId) ?? null;
        return sum + (resolvePlayerEconomyContract({ player, rosterEntry }).salary ?? 0);
      }, 0),
      1,
    );
  }, [gameState.players, selectedPrizePreviewRow?.salaryTotal, selectedRoster, selectedTeam, shouldBuildPrizeV2Ui]);
  const prizeForecastRows = useMemo(() => {
    if (!shouldBuildPrizeV2Ui) {
      return [];
    }
    const startCash = selectedPrizePreviewRow?.currentCash ?? selectedTeam?.cash ?? null;
    const salaryTotal = prizeForecastSalaryTotal;
    const rankRow = prizeForecastRankRow;
    const currentFactor = prizePreviewFeed?.summary.currentFactor ?? null;

    if (startCash == null || salaryTotal == null || !rankRow) {
      return [];
    }

    const seasonPrizeRows = [
      { label: "GuV", factor: currentFactor, prizeMoney: rankRow.prizeMoney ?? null, salaryGrowthFactor: 1 },
      ...(rankRow.futureSeasons ?? []).slice(0, 4).map((entry, index) => ({
        label: `GuV +${index + 1}`,
        factor: entry.factor ?? null,
        prizeMoney: entry.prizeMoney ?? null,
        salaryGrowthFactor: entry.salaryGrowthFactor ?? null,
      })),
    ];

    const paddedRows = [
      ...seasonPrizeRows,
      ...Array.from({ length: Math.max(0, 5 - seasonPrizeRows.length) }, (_, index) => ({
        label: `GuV +${seasonPrizeRows.length + index}`,
        factor: null,
        prizeMoney: rankRow.prizeMoney ?? null,
        salaryGrowthFactor: 1,
      })),
    ].slice(0, 5);

    let runningCash = startCash;
    return paddedRows.map((row) => {
      const projectedSalaryTotal = roundViewNumber(salaryTotal, 1);
      const guv = row.prizeMoney == null ? null : roundViewNumber(row.prizeMoney - projectedSalaryTotal, 1);
      const cashAfter = guv == null ? null : roundViewNumber(runningCash + guv, 1);
      if (cashAfter != null) {
        runningCash = cashAfter;
      }

      return {
        ...row,
        salaryTotal: projectedSalaryTotal,
        guv,
        cashAfter,
      };
    });
  }, [prizeForecastRankRow, prizeForecastSalaryTotal, prizePreviewFeed?.summary.currentFactor, selectedPrizePreviewRow?.currentCash, selectedTeam?.cash, shouldBuildPrizeV2Ui]);
  const sortedPrizePreviewRows = useMemo(
    () => {
      if (!shouldBuildPrizeV2Ui) {
        return [];
      }
      return sortRows(prizePreviewRows, tableSorts.prizePreview, {
        team: (row) => row.teamName,
        projectedRank: (row) => row.rank ?? Number.POSITIVE_INFINITY,
        points: (row) => row.points ?? Number.NEGATIVE_INFINITY,
        currentCash: (row) => row.currentCash ?? Number.NEGATIVE_INFINITY,
        basisCash: (row) => row.basisCash ?? Number.NEGATIVE_INFINITY,
        seasonCash: (row) => row.seasonCash ?? Number.NEGATIVE_INFINITY,
        prizeMoney: (row) => row.prizeMoney ?? Number.NEGATIVE_INFINITY,
        startRank: (row) => row.rankChangePrize?.startRank ?? Number.POSITIVE_INFINITY,
        rankDelta: (row) => row.rankChangePrize?.rankDelta ?? Number.NEGATIVE_INFINITY,
        rankChangePrize: (row) => row.rankChangePrize?.bonusMalus ?? Number.NEGATIVE_INFINITY,
        payoutIfTenBetter: (row) => row.payoutIfTenBetter ?? Number.NEGATIVE_INFINITY,
        payoutIfTenWorse: (row) => row.payoutIfTenWorse ?? Number.NEGATIVE_INFINITY,
        projectedCash: (row) => row.projectedCash ?? Number.NEGATIVE_INFINITY,
        status: (row) => row.status,
      });
    },
    [prizePreviewRows, shouldBuildPrizeV2Ui, tableSorts.prizePreview],
  );
  const displayPrizePreviewRows = useMemo(() => {
    if (!shouldBuildPrizeV2Ui) {
      return [];
    }
    if (!selectedTeam?.teamId) {
      return sortedPrizePreviewRows;
    }
    const selectedRowIndex = sortedPrizePreviewRows.findIndex((row) => row.teamId === selectedTeam.teamId);
    if (selectedRowIndex <= 0) {
      return sortedPrizePreviewRows;
    }
    const selectedRow = sortedPrizePreviewRows[selectedRowIndex];
    return [selectedRow, ...sortedPrizePreviewRows.slice(0, selectedRowIndex), ...sortedPrizePreviewRows.slice(selectedRowIndex + 1)];
  }, [selectedTeam?.teamId, shouldBuildPrizeV2Ui, sortedPrizePreviewRows]);
  const prizeFutureSeasonLabels = useMemo(
    () => {
      if (!shouldBuildPrizeV2Ui) {
        return [];
      }
      return (prizePreviewFeed?.seasonFactors ?? []).filter((row) => row.seasonLabel !== "Aktuell");
    },
    [prizePreviewFeed, shouldBuildPrizeV2Ui],
  );
  const prizePreviewTableColumns = useMemo<FoundationTableColumn[]>(
    () => [
      { id: "team", label: "Team", dataKey: "team", defaultWidth: 220, minWidth: 170 },
      { id: "projectedRank", label: "Rang", dataKey: "projectedRank", defaultWidth: 84, minWidth: 68 },
      { id: "startRank", label: "Start", dataKey: "startRank", defaultWidth: 84, minWidth: 68 },
      { id: "rankDelta", label: "Δ Rang", dataKey: "rankDelta", defaultWidth: 92, minWidth: 74 },
      { id: "currentCash", label: "Cash aktuell", dataKey: "currentCash", defaultWidth: 120, minWidth: 96 },
      { id: "basisCash", label: "Basis Cash", dataKey: "basisCash", defaultWidth: 118, minWidth: 96 },
      { id: "seasonCash", label: "Season-Anteil", dataKey: "seasonCash", defaultWidth: 128, minWidth: 100 },
      { id: "currentFactor", label: "Faktor", dataKey: "currentFactor", defaultWidth: 88, minWidth: 74 },
      { id: "prizeMoney", label: "Preisgeld", dataKey: "prizeMoney", defaultWidth: 116, minWidth: 92 },
      { id: "rankChangePrize", label: "Rank Bonus", dataKey: "rankChangePrize", defaultWidth: 118, minWidth: 96 },
      { id: "payoutIfTenBetter", label: "+10 Plätze", dataKey: "payoutIfTenBetter", defaultWidth: 116, minWidth: 92 },
      { id: "payoutIfTenWorse", label: "-10 Plätze", dataKey: "payoutIfTenWorse", defaultWidth: 116, minWidth: 92 },
      { id: "projectedCash", label: "Cash nachher", dataKey: "projectedCash", defaultWidth: 126, minWidth: 100 },
      ...prizeFutureSeasonLabels.map((entry) => ({
        id: `future-${entry.seasonLabel}`,
        label: entry.seasonLabel,
        dataKey: `future-${entry.seasonLabel}`,
        defaultWidth: 112,
        minWidth: 90,
        visibleByDefault: false,
      })),
      { id: "warnings", label: "Hinweise", dataKey: "warnings", defaultWidth: 260, minWidth: 170 },
    ],
    [prizeFutureSeasonLabels],
  );
  const visiblePrizePreviewColumns = useMemo(
    () => {
      if (!shouldBuildPrizeV2Ui) {
        return [];
      }
      return applyStoredColumnOrder(
        prizePreviewTableColumns,
        tableColumnPreferences.prizePreviewTable?.columnOrder,
        getTablePinnedLeftIds("prizePreviewTable"),
        getTablePinnedRightIds("prizePreviewTable"),
      ).filter((column) =>
        isTableColumnVisible("prizePreviewTable", column.id, column.visibleByDefault),
      );
    },
    [prizePreviewTableColumns, shouldBuildPrizeV2Ui, tableColumnPreferences],
  );
  const prizeV2Rows = useMemo(
    () => {
      if (!shouldBuildPrizeV2Ui) {
        return [];
      }
      return sortedPrizePreviewRows.map((row) => {
        const team = gameState.teams.find((entry) => entry.teamId === row.teamId) ?? null;
        const logoModel = team
          ? getTeamLogoModel(team)
          : {
              src: null,
              initials:
                row.teamCode ||
                row.teamName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("") ||
                "?",
            };
        return {
          teamId: row.teamId,
          teamName: row.teamName,
          teamCode: row.teamCode,
          logoUrl: logoModel.src,
          logoInitials: logoModel.initials,
          rank: row.rank,
          points: row.points ?? null,
          currentCash: row.currentCash ?? null,
          basisCash: row.basisCash ?? null,
          seasonCash: row.seasonCash ?? null,
          currentFactor: prizePreviewFeed?.summary.currentFactor ?? null,
          prizeMoney: row.prizeMoney ?? null,
          bonusMalus: row.rankChangePrize?.bonusMalus ?? null,
          startRank: row.rankChangePrize?.startRank ?? null,
          rankDelta: row.rankChangePrize?.rankDelta ?? null,
          projectedCash: row.projectedCash ?? null,
          salaryTotal: row.salaryTotal ?? null,
          status: row.status,
          warnings: row.warnings,
          isSelected: row.teamId === selectedTeam?.teamId,
        };
      });
    },
    [gameState.teams, prizePreviewFeed?.summary.currentFactor, selectedTeam?.teamId, shouldBuildPrizeV2Ui, sortedPrizePreviewRows],
  );
  const prizeV2SelectedTeamSummary = useMemo(() => {
    if (!shouldBuildPrizeV2Ui || !selectedPrizePreviewRow) {
      return null;
    }
    return {
      teamId: selectedPrizePreviewRow.teamId,
      teamName: selectedPrizePreviewRow.teamName,
      teamCode: selectedPrizePreviewRow.teamCode,
      rank: selectedPrizePreviewRow.rank,
      points: selectedPrizePreviewRow.points ?? null,
      currentCash: selectedPrizePreviewRow.currentCash ?? null,
      basisCash: selectedPrizePreviewRow.basisCash ?? null,
      seasonCash: selectedPrizePreviewRow.seasonCash ?? null,
      prizeMoney: selectedPrizePreviewRow.prizeMoney ?? null,
      bonusMalus: selectedPrizePreviewRow.rankChangePrize?.bonusMalus ?? null,
      projectedCash: selectedPrizePreviewRow.projectedCash ?? null,
      salaryTotal: selectedPrizePreviewRow.salaryTotal ?? null,
      payoutIfTenBetter: selectedPrizePreviewRow.payoutIfTenBetter ?? null,
      payoutIfTenWorse: selectedPrizePreviewRow.payoutIfTenWorse ?? null,
    };
  }, [selectedPrizePreviewRow, shouldBuildPrizeV2Ui]);
  const prizeV2LeaderRow = shouldBuildPrizeV2Ui ? (prizeV2Rows[0] ?? null) : null;
  const prizeV2SwingRow = useMemo(
    () => {
      if (!shouldBuildPrizeV2Ui) {
        return null;
      }
      return (
      [...prizeV2Rows].sort(
        (left, right) => Math.abs(right.rankDelta ?? 0) - Math.abs(left.rankDelta ?? 0) || (left.rank ?? 99) - (right.rank ?? 99),
      )[0] ?? null
      );
    },
    [prizeV2Rows, shouldBuildPrizeV2Ui],
  );
  const prizeV2RiskRow = useMemo(
    () => {
      if (!shouldBuildPrizeV2Ui) {
        return null;
      }
      return (
      [...prizeV2Rows].sort((left, right) => {
        const leftWarnings = left.warnings.length;
        const rightWarnings = right.warnings.length;
        if (rightWarnings !== leftWarnings) return rightWarnings - leftWarnings;
        return (left.projectedCash ?? Number.POSITIVE_INFINITY) - (right.projectedCash ?? Number.POSITIVE_INFINITY);
      })[0] ?? null
      );
    },
    [prizeV2Rows, shouldBuildPrizeV2Ui],
  );
  const prizeV2FactorRows = useMemo(
    () => {
      if (!shouldBuildPrizeV2Ui) {
        return [];
      }
      return (prizePreviewFeed?.seasonFactors ?? []).map((entry) => ({ seasonLabel: entry.seasonLabel, factor: entry.factor ?? null }));
    },
    [prizePreviewFeed, shouldBuildPrizeV2Ui],
  );
  const prizeV2Summary = useMemo(
    () => {
      if (!shouldBuildPrizeV2Ui) {
        return {
          totalTeams: 0,
          calculableTeams: 0,
          blockedItemsCount: 0,
          currentFactor: null,
          futureSeasonCount: 0,
          totalPrizeMoney: null,
          totalRankChangePrize: null,
          forecastSalaryFactorPassthrough: null,
        };
      }
      return {
      totalTeams: prizePreviewFeed?.summary.totalTeams ?? 0,
      calculableTeams: prizePreviewFeed?.summary.calculableTeams ?? 0,
      blockedItemsCount: prizePreviewFeed?.summary.blockedItemsCount ?? 0,
      currentFactor: prizePreviewFeed?.summary.currentFactor ?? null,
      futureSeasonCount: prizePreviewFeed?.summary.futureSeasonCount ?? 0,
      totalPrizeMoney: prizePreviewFeed?.summary.totalPrizeMoney ?? null,
      totalRankChangePrize: prizePreviewFeed?.summary.totalRankChangePrize ?? null,
      forecastSalaryFactorPassthrough: prizePreviewFeed?.summary.forecastSalaryFactorPassthrough ?? null,
      };
    },
    [prizePreviewFeed, shouldBuildPrizeV2Ui],
  );

  const lineupStatusSummary = useMemo(() => {
    const rows = resolvePreviewFeed?.teamRows ?? [];
    const missingTeams = rows.filter((row) => row.readinessStatus === "missing_lineup").length;
    const incompleteTeams = rows.filter((row) =>
      ["underfilled_roster", "invalid_lineup", "missing_score_coverage"].includes(row.readinessStatus),
    ).length;
    const readyTeams = rows.filter((row) => row.readinessStatus === "ready").length;
    return {
      totalTeams: rows.length,
      readyTeams,
      missingTeams,
      incompleteTeams,
    };
  }, [resolvePreviewFeed]);

  const lineupModifierStatusSummary = useMemo(() => {
    const currentDrafts = (gameState.seasonState.lineupDrafts ?? []).filter(
      (draft) => draft.seasonId === gameState.season.id && draft.matchdayId === gameState.matchdayState.matchdayId,
    );
    const selectedFormCards = currentDrafts.reduce((sum, draft) => {
      const d1 = draft.modifiers?.d1;
      const d2 = draft.modifiers?.d2;
      return (
        sum +
        [d1?.primaryFormCardId, d1?.secondaryFormCardId, d2?.primaryFormCardId, d2?.secondaryFormCardId].filter(Boolean)
          .length
      );
    }, 0);
    const selectedMutators = currentDrafts.reduce((sum, draft) => {
      const d1 = draft.modifiers?.d1;
      const d2 = draft.modifiers?.d2;
      return sum + [d1?.mutatorTrait1, d1?.mutatorTrait2, d2?.mutatorTrait1, d2?.mutatorTrait2].filter(Boolean).length;
    }, 0);

    return {
      formCardSourceStatus: "ready" as const,
      formCardEffectStatus: "ready" as const,
      mutatorSourceStatus: "ready" as const,
      mutatorEffectStatus: "ready" as const,
      selectedFormCards,
      selectedMutators,
    };
  }, [gameState.matchdayState.matchdayId, gameState.season.id, gameState.seasonState.lineupDrafts]);

  const cockpitSaveStatus = useMemo(() => {
    if (readMeta.source === "prisma") {
      return {
        status: "blocked" as const,
        message: "Prisma/Supabase ist hier nur Referenz. Apply-Aktionen bleiben gesperrt.",
      };
    }
    if (gameState.teams.length === 32) {
      return {
        status: "ready" as const,
        message: "Lokaler Testspielstand ist aktiv und vollstaendig geladen.",
      };
    }
    return {
      status: "warning" as const,
      message: "Der lokale Save ist geladen, aber die Teamanzahl weicht vom 32-Team-Contract ab.",
    };
  }, [gameState.teams.length, readMeta.source]);

  const cockpitFreshSeasonStatus = useMemo(() => {
    const totalTeams = seasonStandRows.length;
    const zeroPointTeams = seasonStandRows.filter((row) => (row.points ?? 0) === 0).length;
    const budgetAlignedTeams = seasonStandRows.filter(
      (row) => row.budget != null && row.cash != null && Number(row.budget.toFixed(2)) === Number(row.cash.toFixed(2)),
    ).length;
    const hasTransfers = (historyFeed?.items.length ?? 0) > 0 || gameState.transferHistory.length > 0;
    const hasStoredResults = (gameState.seasonState.matchdayResults?.length ?? 0) > 0;

    if (readMeta.source === "prisma") {
      return {
        status: "blocked" as const,
        message: "Fresh Season 1 kann nur lokal gestartet und bewertet werden.",
      };
    }

    if (
      totalTeams === 32 &&
      zeroPointTeams === totalTeams &&
      budgetAlignedTeams === totalTeams &&
      !hasTransfers &&
      !hasStoredResults
    ) {
      return {
        status: "ready" as const,
        message: "Der aktive Save sieht wie ein frischer Season-1-Start aus: Cash = Budget, Punkte = 0.",
      };
    }

    if (freshSeasonStartMessage) {
      return {
        status: "applied" as const,
        message: freshSeasonStartMessage,
      };
    }

    return {
      status: "warning" as const,
      message: "Der aktive Save ist bereits benutzt oder nicht mehr auf frischem Season-1-Stand.",
    };
  }, [freshSeasonStartMessage, gameState.seasonState.matchdayResults, gameState.transferHistory.length, historyFeed, readMeta.source, seasonStandRows]);

  const cockpitTransfermarktStatus = useMemo(() => {
    if (readMeta.source === "prisma") {
      return {
        status: "blocked" as const,
        message: "Prisma bleibt read-only. Testkaeufe laufen nur im lokalen SQLite-Save.",
      };
    }

    if (!marketFeed) {
      return {
        status: "open" as const,
        message: "Transfermarkt-Feed noch nicht geladen.",
      };
    }

    if (!marketTeamId) {
      return {
        status: "open" as const,
        message: "Team waehlen, damit Kaufvorschau, Cash und Roster-Druck bewertet werden koennen.",
      };
    }

    if (!marketFeed.teamContext) {
      return {
        status: "warning" as const,
        message: "Teamkontext fehlt noch. Feed neu laden oder Team erneut waehlen.",
      };
    }

    if ((marketFeed.items?.length ?? 0) === 0) {
      return {
        status: "warning" as const,
        message: "Keine Free Agents im aktuellen lokalen Feed gefunden.",
      };
    }

    return {
      status: "ready" as const,
      message: "Transfermarkt ist lokal spielbar. Kaufvorschau zeigt echte Before/After-Werte.",
    };
  }, [marketFeed, marketTeamId, readMeta.source]);

  const cockpitLineupStatus = useMemo(() => {
    if (!resolvePreviewFeed) {
      return {
        status: "open" as const,
        message: "Status noch nicht geladen. Preview oeffnen, um Readiness und fehlende Teams zu sehen.",
      };
    }
    if (lineupStatusSummary.missingTeams > 0) {
      return {
        status: "warning" as const,
        message: `${lineupStatusSummary.missingTeams} Teams ohne gespeicherte Einsatzliste.`,
      };
    }
    if (lineupStatusSummary.incompleteTeams > 0) {
      return {
        status: "warning" as const,
        message: `${lineupStatusSummary.incompleteTeams} Teams sind noch unvollstaendig oder ohne Score-Coverage.`,
      };
    }
    if (lineupStatusSummary.readyTeams === lineupStatusSummary.totalTeams && lineupStatusSummary.totalTeams > 0) {
      return {
        status: "ready" as const,
        message: "Alle Teams sind fuer diesen Spieltag lineup-seitig ready.",
      };
    }
    return {
      status: "open" as const,
      message: "Readiness ist vorhanden, aber noch nicht vollstaendig eingeordnet.",
    };
  }, [lineupStatusSummary, resolvePreviewFeed]);

  const cockpitAiLineupStatus = useMemo(() => {
    if (readMeta.source === "prisma") {
      return {
        status: "blocked" as const,
        message: "Prisma bleibt hier read-only. AI-Teams koennen im Cockpit nur im lokalen Save gespeichert werden.",
      };
    }
    if (cockpitAiBatchApplyFeed?.error) {
      return {
        status: "blocked" as const,
        message: cockpitAiBatchApplyFeed.error,
      };
    }
    if (cockpitAiBatchApplyFeed && !cockpitAiBatchApplyFeed.dryRun && cockpitAiBatchApplyFeed.summary.savedTeams > 0) {
      return {
        status: "applied" as const,
        message: `${cockpitAiBatchApplyFeed.summary.savedTeams} AI-Teams wurden lokal aufgestellt.`,
      };
    }
    if (cockpitAiBatchApplyFeed?.dryRun) {
      if (cockpitAiBatchApplyFeed.summary.blockedTeams > 0) {
        return {
          status: "warning" as const,
          message: `${cockpitAiBatchApplyFeed.summary.blockedTeams} AI-Teams bleiben im DryRun blockiert.`,
        };
      }
      if (cockpitAiBatchApplyFeed.summary.plannedLineups > 0) {
        return {
          status: "ready" as const,
          message: `${cockpitAiBatchApplyFeed.summary.plannedLineups} AI-Lineups koennen lokal gespeichert werden.`,
        };
      }
      return {
        status: "warning" as const,
        message: "Der DryRun hat aktuell keine speicherbaren AI-Lineups gefunden.",
      };
    }
    if (aiLineupApplyTeams.length === 0) {
      return {
        status: "warning" as const,
        message:
          aiTeams.length > 0
            ? "AI-Teams sind vorhanden, aber AI-Lineup-Apply ist noch nicht freigegeben. Ueber den Aktivieren-Button oder in den Team Settings kann das lokal freigegeben werden."
            : "Aktuell ist kein Team mit controlMode=ai und aktivem AI-Lineup-Apply freigegeben.",
      };
    }
    return {
      status: "open" as const,
      message: "DryRun zeigt zuerst, welche AI-Teams lokal aufgestellt werden koennen.",
    };
  }, [aiLineupApplyTeams.length, aiTeams.length, cockpitAiBatchApplyFeed, readMeta.source]);

  const cockpitResolveStatus = useMemo(() => {
    const status = resolvePreviewFeed?.preview.status;
    if (!status) {
      return { status: "open" as const, message: "Noch keine Resolve Preview geladen." };
    }
    if (status === "ready") {
      return { status: "ready" as const, message: "Resolve Preview ist bereit und zeigt D1/D2 Rankings read-only." };
    }
    if (status === "blocked") {
      return { status: "blocked" as const, message: "Resolve Preview ist blockiert und benoetigt erst geklaerte Quellen oder Lineups." };
    }
    return { status: "warning" as const, message: `Resolve Preview meldet ${status}.` };
  }, [resolvePreviewFeed]);

  const cockpitResultApplyStatus = useMemo(() => {
    const summary = resultApplyFeed?.summary;
    const blockingReasons = resultApplyFeed?.blockingReasons ?? summary?.blockingReasons ?? [];
    if (resultApplyFeed?.applied) {
      return { status: "applied" as const, message: "Result Apply wurde lokal gespeichert." };
    }
    if (resultApplyFeed && (resultApplyFeed.canApply ?? summary?.canApply) === false) {
      return { status: "blocked" as const, message: blockingReasons[0] ?? "Result Apply ist aktuell blockiert." };
    }
    if (resolvePreviewFeed?.preview.status === "ready") {
      return { status: "ready" as const, message: "Result Apply kann nach Dry-Run lokal bestaetigt werden." };
    }
    return { status: "open" as const, message: "Erst Resolve Preview laden, dann Dry-Run oder Apply ausfuehren." };
  }, [resolvePreviewFeed, resultApplyFeed]);

  const cockpitStandingsPreviewStatus = useMemo(() => {
    if (!standingsPreviewFeed) {
      return { status: "open" as const, message: "Noch keine Standings Preview geladen." };
    }
    if ((standingsPreviewFeed.blockedRules?.length ?? 0) > 0) {
      return { status: "warning" as const, message: standingsPreviewFeed.blockedRules[0] ?? "Standings Preview hat offene Blocker." };
    }
    if ((standingsPreviewFeed.summary.readyTeams ?? 0) === (standingsPreviewFeed.summary.totalTeams ?? 0) && (standingsPreviewFeed.summary.totalTeams ?? 0) > 0) {
      return { status: "ready" as const, message: "Punkte-Delta und projected Rank sind fuer alle Teams berechnet." };
    }
    return { status: "warning" as const, message: "Standings Preview ist noch nicht fuer alle Teams ready." };
  }, [standingsPreviewFeed]);

  const cockpitStandingsApplyStatus = useMemo(() => {
    const summary = standingsApplyFeed?.summary;
    const blockingReasons = standingsApplyFeed?.blockingReasons ?? summary?.blockingReasons ?? [];
    if (standingsApplyFeed?.applied) {
      return { status: "applied" as const, message: "Standings Apply wurde lokal geschrieben." };
    }
    if (standingsApplyFeed && (standingsApplyFeed.canApply ?? summary?.canApply) === false) {
      return { status: "blocked" as const, message: blockingReasons[0] ?? "Standings Apply ist blockiert." };
    }
    if ((standingsPreviewFeed?.blockedRules?.length ?? 0) === 0 && (standingsPreviewFeed?.summary.readyTeams ?? 0) > 0) {
      return { status: "ready" as const, message: "Standings Apply kann nach Dry-Run lokal bestaetigt werden." };
    }
    return { status: "open" as const, message: "Erst Standings Preview in einen apply-faehigen Zustand bringen." };
  }, [standingsApplyFeed, standingsPreviewFeed]);

  const cockpitPrizePreviewStatus = useMemo(() => {
    if (!prizePreviewFeed) {
      return { status: "open" as const, message: "Noch keine Preisgeld-Vorschau geladen." };
    }
    if (prizePreviewHardBlocked.length > 0) {
      return { status: "blocked" as const, message: prizePreviewHardBlocked[0] ?? "Preisgeldtabelle ist nicht verwendbar." };
    }
    if ((prizePreviewFeed.summary.calculableTeams ?? 0) > 0 && (prizePreviewFeed.summary.blockedItemsCount ?? 0) === 0) {
      return { status: "ready" as const, message: "Cash vorher, Preisgeld und Cash nachher sind fuer alle Teams berechenbar." };
    }
    return { status: "warning" as const, message: "Preisgeld-Vorschau ist nur teilweise berechenbar." };
  }, [prizePreviewFeed, prizePreviewHardBlocked]);

  const cockpitCashApplyStatus = useMemo(() => {
    const summary = cashApplyFeed?.summary;
    const blockingReasons = cashApplyFeed?.blockingReasons ?? summary?.blockingReasons ?? [];
    if (cashApplyFeed?.applied || currentSeasonCashPrizeApplyLogs.length > 0) {
      return { status: "applied" as const, message: currentSeasonCashPrizeApplyLogs.length > 0 ? "Preisgeld wurde fuer diese Season bereits angewendet." : "Cash Apply wurde lokal gespeichert." };
    }
    if (cashApplyFeed && (cashApplyFeed.canApply ?? summary?.canApply) === false) {
      return { status: "blocked" as const, message: blockingReasons[0] ?? "Cash Apply ist blockiert." };
    }
    if ((prizePreviewFeed?.summary.calculableTeams ?? 0) > 0 && (prizePreviewFeed?.summary.blockedItemsCount ?? 0) === 0) {
      return { status: "ready" as const, message: "Cash Apply kann nach Dry-Run lokal bestaetigt werden." };
    }
    return { status: "open" as const, message: "Erst Preisgeld-Vorschau vollstaendig berechnen." };
  }, [cashApplyFeed, currentSeasonCashPrizeApplyLogs.length, prizePreviewFeed]);

  const cockpitSeasonSnapshotStatus = useMemo(() => {
    const currentSeasonSnapshot = (gameState.seasonState.seasonSnapshots ?? []).find(
      (snapshot) => snapshot.seasonId === gameState.season.id,
    );
    if (readMeta.source === "prisma") {
      return {
        status: "blocked" as const,
        message: "Prisma bleibt read-only. Season-Snapshots koennen nur im lokalen SQLite-Save gespeichert werden.",
      };
    }
    if (seasonSnapshotFeed?.applied) {
      return {
        status: "applied" as const,
        message: "Die Saisonhistorie wurde lokal archiviert.",
      };
    }
    if (seasonSnapshotFeed?.canCreate) {
      return {
        status: "ready" as const,
        message: "Die aktuelle Season kann jetzt lokal als Historien-Snapshot gespeichert werden.",
      };
    }
    if (seasonSnapshotFeed && !seasonSnapshotFeed.canCreate) {
      return {
        status: "blocked" as const,
        message: seasonSnapshotFeed.blockingReasons[0] ?? "Season Snapshot ist aktuell blockiert.",
      };
    }
    if (currentSeasonSnapshot) {
      return {
        status: "applied" as const,
        message: "Fuer diese Season existiert bereits ein lokaler Snapshot.",
      };
    }
    return {
      status: "open" as const,
      message: "DryRun zeigt zuerst, ob die aktuelle Season bereits sauber archiviert werden kann.",
    };
  }, [gameState.season.id, gameState.seasonState.seasonSnapshots, readMeta.source, seasonSnapshotFeed]);

  const cockpitMatchdayAdvanceStatus = useMemo(() => {
    const summary = matchdayAdvanceFeed?.summary;
    const blockingReasons = matchdayAdvanceFeed?.blockingReasons ?? summary?.blockingReasons ?? [];
    if (matchdayAdvanceFeed?.applied) {
      return { status: "applied" as const, message: "Der lokale Save wurde auf den naechsten Matchday fortgeschrieben." };
    }
    if (matchdayAdvanceFeed && (matchdayAdvanceFeed.canApply ?? summary?.canApply) === false) {
      return { status: "blocked" as const, message: blockingReasons[0] ?? "Matchday-Fortschritt ist blockiert." };
    }
    if (cashApplyFeed?.applied) {
      return { status: "ready" as const, message: "Der Spieltag kann jetzt lokal abgeschlossen und auf den naechsten Matchday gesetzt werden." };
    }
    return { status: "open" as const, message: "Erst Result, Standings und Cash fuer den aktuellen Matchday lokal abschliessen." };
  }, [cashApplyFeed, matchdayAdvanceFeed]);

  const cockpitAutoRunStatus = useMemo(() => {
    if (!matchdayAutoRunFeed) {
      return { status: "open" as const, message: "DryRun zeigt zuerst, ob der aktuelle Matchday lokal komplett durchlaufen kann." };
    }
    if (matchdayAutoRunFeed.status === "applied") {
      const formCards = matchdayAutoRunFeed.summary.formCardsSelected ?? 0;
      const advanceText = matchdayAutoRunFeed.summary.advanceAllowed ? " Der Spieltag wurde fortgeschrieben." : "";
      return {
        status: "applied" as const,
        message: `Der aktuelle Matchday wurde lokal ausgefuehrt. AI-Lineups und ${formCards} Formkarten wurden vorbereitet.${advanceText}`,
      };
    }
    if (matchdayAutoRunFeed.status === "blocked") {
      return {
        status: "blocked" as const,
        message: matchdayAutoRunFeed.blockingReasons[0]
          ? formatCockpitReason(matchdayAutoRunFeed.blockingReasons[0])
          : "Der Auto-Run ist blockiert.",
      };
    }
    if (matchdayAutoRunFeed.status === "warning") {
      return { status: "warning" as const, message: "Der Auto-Run meldet Warnungen. Bitte Step-Details pruefen." };
    }
    if (matchdayAutoRunFeed.summary.resolveReady) {
      const formCards = matchdayAutoRunFeed.summary.formCardsSelected ?? 0;
      return {
        status: "ready" as const,
        message: `DryRun ist bereit: Lineups passen, ${formCards} Formkarten sind im Plan. Der Matchday kann lokal simuliert werden.`,
      };
    }
    return { status: "ready" as const, message: "DryRun ist geladen. Der Matchday kann lokal simuliert werden." };
  }, [matchdayAutoRunFeed]);

  const cockpitWholeSeasonDryRunStatus = useMemo(() => {
    if (!wholeSeasonDryRunFeed) {
      return { status: "open" as const, message: "Die Saison-Simulation nutzt eine isolierte lokale Kopie und zeigt zuerst moegliche Blocker ueber alle Spieltage." };
    }
    if (wholeSeasonDryRunFeed.status === "blocked") {
      if (wholeSeasonDryRunFeed.blockingReasons.includes("ai_lineup_apply_disabled")) {
        return {
          status: "blocked" as const,
          message: `${wholeSeasonDryRunFeed.skippedDisabledAiTeams} AI-Teams sind noch nicht fuer AI-Lineup-Apply freigegeben. Aktiviere zuerst Step 5 oder die Team Settings.`,
        };
      }
      return {
        status: "blocked" as const,
        message: wholeSeasonDryRunFeed.blockedAtMatchday
          ? `${wholeSeasonDryRunFeed.blockedAtMatchday.label}: ${formatCockpitReason(wholeSeasonDryRunFeed.blockingReasons[0] ?? "season_dryrun_blocked")}`
          : formatCockpitReason(wholeSeasonDryRunFeed.blockingReasons[0] ?? "season_dryrun_blocked"),
      };
    }
    if (wholeSeasonDryRunFeed.status === "completed") {
      return { status: "applied" as const, message: "Die lokale Saison wurde auf einer isolierten In-Memory-Kopie komplett durchsimuliert." };
    }
    if (wholeSeasonDryRunFeed.status === "warning") {
      return { status: "warning" as const, message: "Die Saison konnte auf der In-Memory-Kopie weitgehend simuliert werden, meldet aber Warnungen." };
    }
    return { status: "ready" as const, message: "Die lokale Saison konnte komplett auf einer isolierten Kopie durchsimuliert werden." };
  }, [wholeSeasonDryRunFeed]);

  const cockpitMatchdayMvpScoringStatus = useMemo(() => {
    if (!matchdayMvpScoringFeed) {
      return {
        status: "open" as const,
        message: "Noch kein Matchday-1 DryRun geladen. Der MVP rechnet bei Bedarf mit echten Base Scores und markiert Auto-Lineups sauber.",
      };
    }
    if (matchdayMvpScoringFeed.error) {
      return {
        status: "blocked" as const,
        message: matchdayMvpScoringFeed.error,
      };
    }
    if (matchdayMvpScoringFeed.status === "blocked") {
      return {
        status: "blocked" as const,
        message: matchdayMvpScoringFeed.blockingReasons[0]
          ? formatCockpitReason(matchdayMvpScoringFeed.blockingReasons[0])
          : "Der Matchday-1 Slice ist aktuell blockiert.",
      };
    }
    if (matchdayMvpScoringFeed.status === "applied") {
      return {
        status: "applied" as const,
        message: "Matchday 1 wurde lokal durchgerechnet und in Result- plus Standings-State geschrieben.",
      };
    }
    if (matchdayMvpScoringFeed.status === "warning") {
      return {
        status: "warning" as const,
        message: "Der Slice ist spielbar. Warnungen betreffen derzeit vor allem Wunschkader, Auto-Lineups oder noch fehlende Spezialquellen.",
      };
    }
    return {
      status: "ready" as const,
      message: "DryRun ist bereit. D1 und D2 koennen jetzt lokal in den aktiven Save geschrieben werden.",
    };
  }, [matchdayMvpScoringFeed]);

  const cockpitFlowChecklist = useMemo(
    () => [
      { label: "Matchday offen", done: true },
      {
        label: "AI-Teams aufgestellt",
        done: Boolean(cockpitAiBatchApplyFeed && !cockpitAiBatchApplyFeed.dryRun && cockpitAiBatchApplyFeed.summary.savedTeams > 0),
        active: cockpitAiLineupStatus.status === "ready",
      },
      { label: "Result Apply", done: Boolean(resultApplyFeed?.applied), active: cockpitResultApplyStatus.status === "ready" },
      { label: "Standings Apply", done: Boolean(standingsApplyFeed?.applied), active: cockpitStandingsApplyStatus.status === "ready" },
      { label: "Ergebnis im Saisonstand", done: Boolean(standingsApplyFeed?.applied), active: cockpitStandingsApplyStatus.status === "ready" },
    ],
    [
      cockpitAiBatchApplyFeed,
      cockpitAiLineupStatus.status,
      cockpitResultApplyStatus.status,
      cockpitStandingsApplyStatus.status,
      resultApplyFeed?.applied,
      standingsApplyFeed?.applied,
    ],
  );

  const cockpitOverallStatus = useMemo(() => {
    if (matchdayAdvanceFeed?.applied) {
      return "Matchday abgeschlossen";
    }
    if (cockpitMatchdayAdvanceStatus.status === "ready") {
      return "bereit fuer Matchday-Abschluss";
    }
    if (cockpitCashApplyStatus.status === "ready") {
      return "bereit fuer Cash Apply";
    }
    if (cockpitStandingsApplyStatus.status === "ready") {
      return "bereit fuer Standings Apply";
    }
    if (cockpitResultApplyStatus.status === "ready") {
      return "bereit fuer Result Apply";
    }
    if (cockpitAiLineupStatus.status === "ready") {
      return "bereit fuer AI-Lineup-Save";
    }
    if (
      cockpitAiLineupStatus.status === "warning" ||
      cockpitResolveStatus.status === "warning" ||
      cockpitLineupStatus.status === "warning" ||
      cockpitStandingsPreviewStatus.status === "warning" ||
      cockpitPrizePreviewStatus.status === "warning"
    ) {
      return "Warnings offen";
    }
    if (
      cockpitAiLineupStatus.status === "blocked" ||
      cockpitResolveStatus.status === "blocked" ||
      cockpitResultApplyStatus.status === "blocked" ||
      cockpitStandingsApplyStatus.status === "blocked" ||
      cockpitCashApplyStatus.status === "blocked" ||
      cockpitMatchdayAdvanceStatus.status === "blocked"
    ) {
      return "blockiert";
    }
    return "Matchday offen";
  }, [
    cockpitAiLineupStatus.status,
    cockpitCashApplyStatus.status,
    cockpitLineupStatus.status,
    cockpitMatchdayAdvanceStatus.status,
    cockpitPrizePreviewStatus.status,
    cockpitResolveStatus.status,
    cockpitResultApplyStatus.status,
    cockpitStandingsApplyStatus.status,
    cockpitStandingsPreviewStatus.status,
    matchdayAdvanceFeed?.applied,
  ]);

  const cockpitQuickLinks = useMemo(
    () =>
      [
        { id: "season", label: "Saisonstand" },
        { id: "lineup", label: "Einsatzliste" },
        { id: "marketV2", label: "Transfermarkt" },
        { id: "prize", label: "Preisgeld" },
      ] as Array<{ id: FoundationView; label: string }>,
    [],
  );

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

  const isAdminView = activeView === "admin";
  const isGeneratorView = activeView === "generator";
  const isDebugView = activeView === "debug";
  const isTrainingCompactOrLegacyView = activeView === "training" || activeView === "trainingCompact";
  const seasonV2HydrationPhase: "shell" | "full" = "full";
  const seasonRatingsPlayerIds: string[] = [];
  const shouldBuildTeamsAreaRanks = teamsHydrationPhase === "full";
  const handleTeamsHydrationPhaseChange = (_phase: "shell" | "full") => undefined;
  const foundationRouterMigrationPreview = (
    <Fragment>
      <FoundationShellRouterTeams active={activeView === "teams"} selectedTeam={selectedTeam} hostProps={undefined as never} />
      <FoundationShellRouterCockpit active={activeView === "cockpit"} hostProps={undefined as never} />
      <FoundationShellRouterSeasonV2 active={activeView === "seasonV2"} hostProps={undefined as never} />
      <FoundationShellRouterPrize active={activeView === "prize"} hostProps={undefined as never} />
      <FoundationShellRouterLineup active={activeView === "lineup" || activeView === "lineupV2"} hostProps={undefined as never} />
      <FoundationShellRouterMarketV2 active={activeView === "marketV2"} hostProps={undefined as never} />
      <FoundationShellRouterMarketSell active={activeView === "marketV2" && foundationPanel === "sell"} hostProps={undefined as never} />
      <FoundationShellRouterMatchdayArena active={activeView === "matchdayArena"} hostProps={undefined as never} />
      <FoundationShellRouterMatchdayResult active={activeView === "matchdayResult"} hostProps={undefined as never} />
      <FoundationShellRouterHistoryV2 active={activeView === "history" || activeView === "historyV2"} hostProps={undefined as never} />
      <FoundationShellRouterSeasonPreview active={activeView === "seasonPreview"} hostProps={undefined as never} />
    </Fragment>
  );
  void isAdminView;
  void isGeneratorView;
  void isDebugView;
  void isTrainingCompactOrLegacyView;
  void isMarketOfferPanelOpen;
  void seasonV2HydrationPhase;
  void seasonRatingsPlayerIds;
  void shouldBuildTeamsPlayerRatings;
  void shouldBuildTeamsAreaRanks;
  void handleTeamsHydrationPhaseChange;
  void foundationRouterMigrationPreview;

  const prizePreviewGlobalWarnings = useMemo(
    () => getPrizePreviewGlobalWarnings(prizePreviewFeed),
    [prizePreviewFeed],
  );

  const { visibleStandingsPreviewColumns, sortedStandingsPreviewRows } = useSeasonPreviewDerivations({
    standingsPreviewFeed,
    tableColumnPreferences,
    standingsPreviewSort: tableSorts.standingsPreview,
    isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
  });

  const visibleTeamsViewColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        TEAMS_VIEW_COLUMNS,
        tableColumnPreferences.teamsView?.columnOrder,
        getTablePinnedLeftIds("teamsView"),
        getTablePinnedRightIds("teamsView"),
      ).filter((column) => isTableColumnVisible("teamsView", column.id, column.visibleByDefault)),
    [getTablePinnedLeftIds, getTablePinnedRightIds, isTableColumnVisible, tableColumnPreferences],
  );

  const transferWindowStatus = useMemo(
    () => (shouldBuildMarketView ? getTransferWindowStatus(gameState) : null),
    [gameState, shouldBuildMarketView],
  );

  const transferMarketScoutingWatchPlayerIds = useMemo(
    () =>
      shouldBuildMarketView
        ? buildTransferMarketScoutingWatchPlayerIds(gameState, activeManagerTeamId)
        : [],
    [activeManagerTeamId, gameState, shouldBuildMarketView],
  );

  const transferMarketScoutingIntelByPlayerId = useMemo(
    () =>
      shouldBuildMarketView
        ? buildTransferMarketScoutingIntelByPlayerId(gameState, activeManagerTeamId)
        : new Map(),
    [activeManagerTeamId, gameState, shouldBuildMarketView],
  );

  const transferMarketActiveWishlistPlayerIds = useMemo(
    () =>
      shouldBuildMarketView
        ? buildTransferMarketActiveWishlistPlayerIds(gameState, activeManagerTeamId)
        : [],
    [activeManagerTeamId, gameState, shouldBuildMarketView],
  );

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
    aiMarketPreview,
    aiPreview,
    aiTeams,
    applyNewGamePreset,
    bench,
    bootstrapError,
    canonicalSeasonLabel,
    cashApplyFeed,
    changeFoundationSaveMode,
    chooseTeamSponsor,
    closeCommandPalette,
    closeFacilityPanel,
    closeFoundationDrilldownPanel,
    closeMarketSellModal,
    closeSeasonBriefing,
    closeTeamProfile,
    cockpitAiBatchApplyFeed,
    cockpitAiIncludeWarningTeams,
    cockpitAiLineupStatus,
    cockpitAiOverwriteExisting,
    cockpitAutoRunStatus,
    cockpitBusyKey,
    cockpitCashApplyStatus,
    cockpitFlowChecklist,
    cockpitFreshSeasonStatus,
    cockpitLineupStatus,
    cockpitMatchdayAdvanceStatus,
    cockpitMatchdayMvpScoringStatus,
    cockpitOverallStatus,
    cockpitPrizePreviewStatus,
    cockpitQuickLinks,
    cockpitResolveStatus,
    cockpitResultApplyStatus,
    cockpitSaveStatus,
    cockpitSeasonSnapshotStatus,
    cockpitStandingsApplyStatus,
    cockpitStandingsPreviewStatus,
    cockpitTransfermarktStatus,
    cockpitWholeSeasonDryRunStatus,
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
    currentSeasonCashPrizeApplyLogs,
    disciplineCategoryFilter,
    disciplineConfigTableColumns,
    disciplineRanksColumns,
    displayPrizePreviewRows,
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
    featureAuditFilter,
    featureAuditMatrix,
    filteredFeatureAuditEntries,
    filteredSelectedRosterTableRows,
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
    freeAgents,
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
    lineupDraftBoardView,
    lineupDraftBoardViewRequest,
    lineupFocusRequestKey,
    lineupModifierStatusSummary,
    lineupStatusSummary,
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
    multiSeasonBalanceDashboard,
    multiSeasonEconomyColumns,
    multiSeasonGameplayColumns,
    multiSeasonPlayerColumns,
    multiSeasonTeamBalanceColumns,
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
    prizeApplyState,
    prizeAuditCompact,
    prizeFinanceTab,
    prizeForecastRank,
    prizeForecastRankRow,
    prizeForecastRows,
    prizePreviewFeed,
    prizePreviewGlobalWarnings,
    prizePreviewHardBlocked,
    prizePreviewTableColumns,
    prizeV2FactorRows,
    prizeV2LeaderRow,
    prizeV2RiskRow,
    prizeV2SelectedTeamSummary,
    prizeV2Summary,
    prizeV2SwingRow,
    rankLeaderCards,
    readMeta,
    readOnlyBannerMessage,
    readSourceLabel,
    refreshSeasonCockpit,
    reloadPrizePreviewFeed,
    reloadResolvePreview,
    reloadSeasonStandingsOverview,
    reloadStandingsPreviewFeed,
    removeTransferWishlistEntry,
    renderMultiSeasonEconomyCell,
    renderMultiSeasonGameplayCell,
    renderMultiSeasonPlayerCell,
    renderMultiSeasonTeamCell,
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
    runCockpitAiLineupBatchApply,
    runCockpitCashApply,
    runCockpitMatchdayAdvance,
    runCockpitMatchdayAutoRun,
    runCockpitMatchdayMvpScoring,
    runCockpitResultApply,
    runCockpitRosterFill,
    runCockpitStandingsApply,
    runCockpitWholeSeasonDryRun,
    runFacilityMaintenancePreview,
    runFacilityUpgradePreview,
    runFinishMatchdaySimple,
    runFoundationCommand,
    runNewGameSetup,
    runPreSeasonNextSeasonSetup,
    runPreSeasonWorkflowPreview,
    runSaveAction,
    runSeasonCompletion,
    runSeasonSnapshotAction,
    runSeasonStartReset,
    runSeasonTransition,
    savePlayerGeneratorDrafts,
    saveSummaries,
    saveSyncError,
    saveTeamSettings,
    scheduleActiveManagerTeam,
    scoutingCenterTab,
    scoutingHubV2TargetSections,
    scoutingHubV2Visibility,
    screenPrimaryAction,
    seasonBriefingData,
    seasonBriefingOpen,
    seasonBriefingScheduleReady,
    seasonBriefingTeamAxes,
    seasonBriefingTeamCash,
    seasonCompletionFeed,
    seasonDisciplineScheduleRows,
    seasonEndChampionRow,
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
    selectedPrizePreviewRow,
    selectedRoster,
    selectedRosterTableRows,
    selectedSeasonOverviewLabel,
    selectedStandingRow,
    selectedTeam,
    selectedTeamAverageAxisStats,
    selectedTeamCanManage,
    selectedTeamCaptainProfile,
    selectedTeamCommercialRating,
    selectedTeamContractPreviewRowCount,
    selectedTeamContractShapeMix,
    selectedTeamContractTable,
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
    selectedTeamSponsorContract,
    selectedTeamSponsorOffers,
    selectedTeamStrategyDraft,
    selectedTeamStrategyProfile,
    selectedTeamsHistoryData,
    selectedTransfermarktBoardObjectives,
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
    setFeatureAuditFilter,
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
    setPrizeForecastRank,
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
    setSponsorChoiceProfiles,
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
    sortedMultiSeasonEconomyRows,
    sortedMultiSeasonGameplayRows,
    sortedMultiSeasonPlayerRows,
    sortedMultiSeasonTeamRows,
    sortedPlayersTableRows,
    sortedPpAreaRows,
    sortedSelectedRosterTableRows,
    sortedStandingsPreviewRows,
    sortedTeamsViewRows,
    sortedTransferHistoryRows,
    specialistWingVariantDraft,
    sponsorChoiceBusy,
    sponsorChoiceMessage,
    sponsorChoiceProfiles,
    standingsApplyFeed,
    standingsPreviewColumns,
    standingsPreviewFeed,
    startAdminSeasonSimulationRun,
    startTableColumnResize,
    starters,
    tableSorts,
    teamContextFilter,
    teamControlDraft,
    teamControlMessage,
    teamEconomyTiles,
    teamHistoryPointRankMaps,
    teamIdentityMessage,
    teamObjectiveOverview,
    teamOwners,
    teamProfileData,
    teamRosterFocusMode,
    teamRosterFocusOptions,
    teamRosterRoleFilter,
    teamRosterRoleFilterOptions,
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
    transferMarketActiveWishlistPlayerIds,
    transferMarketScoutingIntelByPlayerId,
    transferMarketScoutingWatchPlayerIds,
    transferMarketV2RosterRows,
    transferSeasonOptions,
    transferWindowStatus,
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
    visibleMultiSeasonEconomyColumns,
    visibleMultiSeasonGameplayColumns,
    visibleMultiSeasonPlayerColumns,
    visibleMultiSeasonTeamBalanceColumns,
    visiblePlayersTableColumns,
    visiblePrizePreviewColumns,
    visibleSelectedRosterColumns,
    visibleSelectedTeamContractRows,
    visibleStandingsPreviewColumns,
    visibleTeamsViewColumns,
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
  FoundationMatchdayArenaPanel,
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
  applySponsorNegotiationToComponents,
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
  featureAuditFilters,
  filterTeamsByControlScope,
  formatActiveManagerTeamSource,
  formatAiLineupAuditWarning,
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
  formatMatchdayMvpWarning,
  formatMoney,
  formatMoraleContractIntentLabel,
  formatNullableMoney,
  formatObjectiveStatusLabel,
  formatPpFormBonus,
  formatPpsValue,
  formatScenarioTypeLabel,
  formatSeasonCompletionStepStatus,
  formatShortSaveId,
  formatSignedDisplayMoney,
  formatSignedNumber,
  formatSignedTransfermarktCurrency,
  formatTeamControlModeLabel,
  formatTransfermarktCurrency,
  formatWholeNumber,
  foundationSecondaryViews,
  getClassColorClassName,
  getCockpitStatusLabel,
  getCockpitStatusPillClass,
  getCockpitStepTone,
  getFeatureAuditFlags,
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
  getRosterEntrySalaryDelta,
  getScoutingWishlistSlotLimit,
  getSeasonCashHeatClass,
  getSeasonCompletionStepTone,
  getSponsorNegotiationMultiplier,
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
  mapAutoRunStatusToCockpitStatus,
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
