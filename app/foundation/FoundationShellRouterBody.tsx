"use client";
/* eslint-disable */
// AUTO-GENERATED render body extracted from the Foundation page component.
// Contains the real Foundation shell UI (previously the monolith return block).
import { FoundationDeferredMount } from "@/lib/foundation/FoundationDeferredMount";
import { FoundationSharedProvider } from "@/lib/foundation/foundation-shared-context";
import { FoundationShellRouterCockpit, FoundationShellRouterHistoryV2, FoundationShellRouterMarketV2, FoundationShellRouterMatchdayResult, FoundationShellRouterPrize, FoundationShellRouterSeasonPreview, FoundationShellRouterTeams, FoundationShellRouterTraining } from "@/app/foundation/FoundationShellRouter";
import FoundationRanksHost from "@/app/foundation/ranks-v2/FoundationRanksHost";
import FoundationLeagueLeadersHost from "@/app/foundation/league-leaders-v2/FoundationLeagueLeadersHost";
import FoundationDiszisHost from "@/app/foundation/ranks-v2/FoundationDiszisHost";
import { RanksRankCell } from "@/components/foundation/RanksRankCell";
import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";
import type { RoomParticipant } from "@/types/game";
import {
  BudgetedMediaImage,
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
  FoundationSubNav,
  FoundationTeamsDetailPanel,
  GAME_ENCYCLOPEDIA_ENTRIES,
  GameTerm,
  HISTORY_ALL_SEASONS_FILTER,
  InboxV2Client,
  MappingHighlight,
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
  TransferHistoryV2Client,
  WarningList,
  buildResolvedTeamIdentities,
  buildScenarioWarning,
  buildTeamControlSettingsMap,
  buildTeamIdentityDraftMap,
  buildTeamStrategyProfileMap,
  clampBiasValue,
  clampIdentityValue,
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
  getSeasonCashHeatClass,
  getTeamAxisRankTooltip,
  getTeamHistoryRankToneClass,
  getTeamLogoModel,
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
} from "@/app/foundation/foundation-page-client-exports";
import FoundationTeamSettingsHost from "@/app/foundation/team-settings/FoundationTeamSettingsHost";
import type {
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
} from "@/app/foundation/foundation-page-client-exports";
import type {
  AdminSeasonSimulationRunSummary,
  FoundationCommandItem,
  FoundationFlowCoachAction,
  FoundationFlowLoopStage,
} from "@/lib/foundation/tabs/foundation-page-types";
import type { FoundationWarningInboxItem } from "@/lib/foundation/tabs/use-foundation-cross-tab-game-flow";
import type { useFoundationCrossTabSeasonBriefing } from "@/lib/foundation/tabs/use-foundation-cross-tab-season-briefing";
import type {
  FoundationDisciplineLeaderEntry,
  FoundationDisciplineRankRow,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-discipline-ranks";
import type { FoundationPlayerScopeRow } from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";
import type { SeasonOverviewOption } from "@/lib/foundation/tabs/use-season-v2-panel-derivations";
import type { buildContextStatusChips } from "@/lib/foundation/tabs/foundation-format-render-helpers";
import type { TeamOwner } from "@/lib/foundation/team-control-settings";
import type { FoundationTableColumn } from "@/lib/foundation/foundation-table-ui-types";
import type { GameEncyclopediaEntry } from "@/lib/ui/game-encyclopedia";
import type { InboxV2Item } from "@/app/foundation/inbox-v2/inbox-v2-types";
import type { Discipline, GameInboxItem, MappingWarning, Player, PlayerScoutIntelRecord, Team } from "@/lib/data/olyDataTypes";

// Derived render-only types for callback params below. These mirror the real
// producer shapes (leaf hooks under lib/foundation/tabs/*) even though the
// props destructured into this component are typed as `Record<string, any>`
// by design (see foundation-shell-router-body-props.ts, Phase 5.8 boundary).
type SeasonBriefingScope = ReturnType<typeof useFoundationCrossTabSeasonBriefing>;
type SeasonBriefingData = SeasonBriefingScope["seasonBriefingData"];
type SeasonBriefingMatchdayEntry = SeasonBriefingData["firstMatchdays"][number];
type SeasonBriefingDisciplineEntry = SeasonBriefingMatchdayEntry["disciplines"][number];
type SeasonBriefingBigDisciplineSlot = SeasonBriefingData["bigDisciplines"][number];
type SeasonBriefingFactorEntry = SeasonBriefingData["futureFactors"][number];
type ContextStatusChip = ReturnType<typeof buildContextStatusChips>[number];
// Matches the inline `areaRows` literal built for marketSellPlayerContext in
// use-foundation-shell-router-body-scope.tsx (not a separately exported type).
type MarketSellAreaRow = { key: string; value: number | null; tone: string };

export function FoundationShellRouterBody(props: FoundationShellRouterBodyProps) {
  const {
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
  foundationCockpitHostProps,
  foundationPrizeFinanceShellHostProps,
  foundationRanksHostProps,
  foundationLeagueLeadersHostProps,
  foundationDiszisHostProps,
  foundationMarketV2ShellHostProps,
  foundationMatchdayResultHostProps,
  foundationHistoryV2HostProps,
  foundationSeasonPreviewHostProps,
  foundationTeamsViewHostProps,
  foundationTrainingCompactHostProps,
  foundationWarningInboxItems,
  freshSeasonStartMessage,
  gameFlowActionStep,
  gameModeOwnershipChrisIds,
  gameModeOwnershipLimits,
  gameState,
  getBusyActionReason,
  getCockpitBusyReason,
  getReadOnlyActionReason,
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
  historyClassFilter,
  historyFeed,
  historyLoadingMore,
  historySearch,
  historySeasonFilter,
  historySourceFilter,
  historyTeamFilter,
  historyTypeFilter,
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
  selectedTeam,
  selectedTeamAverageAxisStats,
  selectedTeamCanManage,
  selectedTeamCaptainProfile,
  selectedTeamCaptainCandidates,
  selectedTeamCaptainPlayerId,
  assignTeamCaptainBusy,
  assignTeamCaptainForSelectedTeam,
  captainEffectsTooltip,
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
  showCompactFlowCoach,
  showCompactHeader,
  showExtendedTeamPanels,
  showFlowCoach,
  showReadOnlyNotice,
  showSelectedRosterPpsBreakdown,
  showTeamContractPreviewRows,
  showTeamDisciplines,
  sortedDisciplineRankRows,
  sortedPlayersTableRows,
  sortedPpAreaRows,
  specialistWingVariantDraft,
  standingsApplyFeed,
  standingsPreviewFeed,
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
  trainingFacilityEffectPreview,
  trainingFacilityRows,
  trainingFacilitySeasonEndFinance,
  trainingForecastSummary,
  trainingV2ModeOptions,
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
  wholeSeasonDryRunFeed,
  wholeSeasonIncludeWarningLineups,
  wholeSeasonOverwriteExistingLineups,
  wholeSeasonStopOnTie,
  } = props;

  const foundationTeamSettingsHostProps = {
    ...props,
    normalizeFoundationSaveMode,
    withSynchronizedStrategyAliases,
    buildResolvedTeamIdentities,
    buildScenarioWarning,
    buildTeamControlSettingsMap,
    buildTeamIdentityDraftMap,
    buildTeamStrategyProfileMap,
    clampBiasValue,
    clampIdentityValue,
    deriveChrisFrankyTeamIdsFromSettings,
    formatCsvList,
    parseCsvList,
    normalizeTeamStrategyLevel,
    resolveFoundationSaveMode,
    setFoundationView,
    teamIdentityFieldLabels,
    teamStrategyBiasFieldLabels,
    teamStrategyIdentityListFieldLabels,
    teamStrategyLevelFieldLabels,
    teamStrategyListFieldLabels,
    teamStrategySportsBiasAxisMap,
    teamStrategySportsBiasFieldLabels,
    formatScenarioTypeLabel,
    formatFoundationSaveModeLabel,
    formatTeamControlModeLabel,
    formatMoney,
    formatLocalePoints,
    formatIdentityWeight,
    formatShortSaveId,
    formatTransfermarktCurrency,
    formatCockpitReason,
  };

  const isTeamSettingsViewActive = activeView === "teamSettings";
  return (
    (
    <FoundationSharedProvider>
    <main className="app-shell foundation-shell foundation-app">
      {bootstrapError && gameState?.season?.id === "loading" ? (
        <div className="foundation-persistence-banner transfer-callout is-warning" role="status">
          <strong>{bootstrapError}</strong>
          <button className="secondary-button inline-button" type="button" onClick={() => window.location.reload()}>
            Neu laden
          </button>
        </div>
      ) : null}
      {gameState?.season?.id === "loading" && !bootstrapError ? (
        <div className="foundation-bootstrap-overlay" role="status" aria-live="polite">
          <div className="foundation-bootstrap-overlay-card">
            <strong>Foundation laedt</strong>
            <span>Spielstand wird vorbereitet …</span>
          </div>
        </div>
      ) : null}
      {persistenceError || saveSyncError ? (
        <div className="foundation-persistence-banner transfer-callout is-warning" role="status">
          <strong>{persistenceError ?? saveSyncError}</strong>
        </div>
      ) : null}
      <FoundationShell
        activeView={activeView as FoundationViewId}
        attentionByViewId={foundationNavAttention}
        seasonLabel={canonicalSeasonLabel}
        matchdayDisplayLabel={currentMatchdayDisplayLabel}
        currentMatchday={gameState.season.currentMatchday}
        onNavigate={(view) => {
          if (view === "prize") {
            openPrizeFinanceView();
            return;
          }
          setFoundationView(view as FoundationView, setActiveView, { push: true });
        }}
        onPrefetchView={prefetchFoundationPanel}
        isPending={isPending}
        activities={foundationActivities}
        subNav={
          activeView === "marketV2" ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                { id: "browse", label: "Markt" },
                ...(foundationPanel === "offer" ? [{ id: "offer", label: "Vertragsangebot" }] : []),
                ...(foundationPanel === "sell" ? [{ id: "sell", label: "Verkauf" }] : []),
              ]}
              activeId={
                foundationPanel === "offer" ? "offer" : foundationPanel === "sell" ? "sell" : "browse"
              }
              onSelect={(id) => {
                if (id === "browse") {
                  closeFoundationDrilldownPanel();
                }
              }}
            />
          ) : activeView === "homeV2" ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                { id: "overview", label: "Übersicht" },
                { id: "office", label: "Office" },
              ]}
              activeId={homeV2Tab}
              onSelect={(id) => navigateHomeTab(id === "office" ? "office" : "overview")}
            />
          ) : activeView === "seasonV2" ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                { id: "table", label: "Datenansicht" },
                { id: "gms", label: "Manager" },
              ]}
              activeId={seasonStandingsMode}
              onSelect={(id) => setSeasonStandingsMode(id as "table" | "gms")}
            />
          ) : activeView === "playerProfile" ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={PLAYER_PROFILE_TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
              activeId={playerProfileTab}
              onSelect={(id) => {
                setPlayerProfileTab(id as PlayerProfileTabId);
                if (playerProfileData) {
                  syncFoundationViewInUrl("playerProfile", id, playerProfileData.playerId);
                }
              }}
            />
          ) : activeView === "lineup" || activeView === "lineupV2" ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                { id: "lineup", label: "Einsatzliste" },
                { id: "formBoard", label: "Formplan" },
              ]}
              activeId={lineupDraftBoardViewRequest ?? lineupDraftBoardView}
              onSelect={(id) => {
                const nextView = id === "formBoard" ? "formBoard" : "lineup";
                setLineupDraftBoardView(nextView);
                setLineupDraftBoardViewRequest(null);
                syncFoundationViewInUrl("lineup", nextView === "formBoard" ? "formplan" : "lineup", null, { push: true });
              }}
            />
          ) : activeView === "inboxV2" ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                { id: "ALL", label: "Alle" },
                { id: "task", label: "Aufgaben" },
                { id: "warning", label: "Warnungen" },
                { id: "transfer", label: "Transfers" },
                { id: "finance", label: "Finanzen" },
                { id: "training", label: "Training" },
              ]}
              activeId={inboxCategoryFilter}
              onSelect={(id) => {
                setInboxCategoryFilter(id);
                syncFoundationViewInUrl("inboxV2", id === "ALL" ? null : id, null, { push: true });
              }}
            />
          ) : activeView === "scoutingCenterV2" ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                { id: "overview", label: "Übersicht" },
                { id: "reports", label: "Scouting Report" },
                { id: "recommended", label: "Empfehlungen" },
              ]}
              activeId={scoutingCenterTab}
              onSelect={(id) => {
                setScoutingCenterTab(id as typeof scoutingCenterTab);
                syncFoundationViewInUrl("scoutingCenterV2", id, null, { push: true });
              }}
            />
          ) : activeView === "trainingCompact" ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                { id: "control", label: "Steuerung" },
                { id: "forecast", label: "Forecast" },
              ]}
              activeId="control"
              onSelect={(id) => {
                const targetId = id === "forecast" ? "training-compact-forecast" : "training-compact-controls";
                document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          ) : activeView === "prize" ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                {
                  id: "sponsors",
                  label: "Sponsoren",
                  needsAttention: foundationNavAttention.prize,
                },
                { id: "prize", label: "Preisgeld" },
              ]}
              activeId={prizeFinanceTab}
              onSelect={(id) => navigatePrizeFinanceTab(id === "prize" ? "prize" : "sponsors")}
            />
          ) : activeView === "teams" && selectedTeam ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                { id: "roster", label: "Kader" },
                { id: "portraits", label: "Portraits" },
                { id: "contracts", label: "Verträge" },
                { id: "transfer", label: "Transfers" },
              ]}
              activeId={selectedTeamDetailTab}
              onSelect={(id) => setSelectedTeamDetailTab(id as "roster" | "contracts" | "portraits" | "transfer")}
            />
          ) : activeView === "trainingV2" || activeView === "facilitiesOverviewV2" ? (
            foundationPanel === "facility" && foundationFacilityTarget ? (
              <FoundationSubNav
                className="foundation-shell-subnav"
                items={[
                  { id: "overview", label: "Gebäude" },
                  {
                    id: "facility",
                    label:
                      foundationFacilityTarget.action === "maintenance"
                        ? "Wartung"
                        : foundationFacilityTarget.action === "downgrade"
                          ? "Downgrade"
                          : "Upgrade",
                  },
                ]}
                activeId="facility"
                onSelect={(id) => {
                  if (id === "overview") {
                    closeFacilityPanel();
                  }
                }}
              />
            ) : null
          ) : null
        }
        headerActions={
          <>
            <button
              className={`primary-button foundation-global-next-button ${globalNextStatusClass}`}
              data-testid="foundation-global-next-button"
              type="button"
              onClick={triggerGlobalNext}
              title={globalNextTitle}
            >
              <span>Weiter</span>
              <strong>{globalNextLabel}</strong>
              <small>Leertaste</small>
            </button>
            <button
              className="pill foundation-tab foundation-tab-search"
              type="button"
              title="Suche öffnen"
              onClick={() => setShowCommandPalette(true)}
            >
              Suchen
            </button>
          </>
        }
      >

      {foundationSecondaryViews.some((view) => view.id === activeView) ? (
        <div className="foundation-utility-strip">
          <span className="pill foundation-utility-label">Technische Ansicht</span>
          {foundationSecondaryViews.map((view) => (
            <button
              key={view.id}
              className={`pill foundation-tab foundation-tab-secondary${activeView === view.id ? " is-active" : ""}`}
              type="button"
              title={view.tooltip}
              onClick={() => setFoundationView(view.id, setActiveView)}
            >
              {view.label}
            </button>
          ))}
          <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("admin", setActiveView)}>
            Zu Admin
          </button>
        </div>
      ) : null}

      {showFlowCoach ? (
      <section className="foundation-flow-coach" aria-label="Aktueller Gameplay-Flow">
        <div>
          <span>{activeFlowCoach.kicker}</span>
          <strong>{activeFlowCoach.title}</strong>
          <small>{activeFlowCoach.detail}</small>
          <div className="foundation-flow-coach-progress" aria-label={`${activeFlowCoach.progressLabel} ${activeFlowCoach.progressPct} Prozent`}>
            <span>{activeFlowCoach.progressLabel}</span>
            <div>
              <i style={{ width: `${activeFlowCoach.progressPct}%` }} />
            </div>
          </div>
        </div>
        <div className="foundation-flow-coach-right">
          <div className="foundation-flow-coach-terms" aria-label="Erklaerte Begriffe">
            {activeFlowCoach.terms.map((term: string) => (
              <GameTerm key={`flow-term-${activeView}-${term}`} term={term} />
            ))}
          </div>
          <div className="foundation-flow-coach-actions" aria-label="Direkte Flow-Aktionen">
            {activeFlowCoach.actions.map((action: FoundationFlowCoachAction) => (
              <button
                key={`flow-action-${activeView}-${action.targetView}-${action.label}`}
                className={`foundation-flow-coach-action${action.tone === "primary" ? " is-primary" : ""}`}
                type="button"
                onClick={() => openFoundationViewCommand(action.targetView)}
                title={action.detail}
              >
                <span>{action.label}</span>
                <small>{action.detail}</small>
                <b aria-hidden="true">›</b>
              </button>
            ))}
          </div>
        </div>
        <div className="foundation-flow-coach-cta">
          <span className="foundation-flow-coach-mode" title="Schwere Tabellen und Zusatzpanels werden erst beim Oeffnen vorbereitet.">
            Schnellmodus
          </span>
          <span className="foundation-flow-coach-shortcut">{activeFlowCoach.shortcut}</span>
          <small className="muted" title={globalNextTitle}>
            Naechster Schritt: {globalNextLabel}
          </small>
        </div>
        <div className="foundation-flow-loop" aria-label="Gameplay Loop">
          {foundationFlowLoopStages.map((stage: FoundationFlowLoopStage, index: number) => (
            <button
              key={`foundation-flow-loop-${stage.id}`}
              className={`foundation-flow-loop-step${index === activeFlowLoopIndex ? " is-active" : ""}${index < activeFlowLoopIndex ? " is-done" : ""}`}
              type="button"
              onClick={() => openFoundationViewCommand(stage.targetView)}
              title={stage.detail}
            >
              <span>{index + 1}</span>
              <strong>{stage.label}</strong>
              <small>{stage.detail} · Alt+{index + 1}</small>
            </button>
          ))}
        </div>
      </section>
      ) : null}

      {showCompactFlowCoach ? (
        <section className="foundation-flow-coach foundation-flow-coach-compact" aria-label="Gameplay-Flow kompakt">
          <div className="foundation-flow-coach-compact-copy">
            <span>{activeFlowCoach.kicker}</span>
            <strong>{activeFlowCoach.title}</strong>
            <small>{activeFlowCoach.detail}</small>
          </div>
          <div className="foundation-flow-coach-right">
            <div className="foundation-flow-coach-terms" aria-label="Erklärte Begriffe">
              {activeFlowCoach.terms.map((term: string) => (
                <GameTerm key={`compact-flow-term-${activeView}-${term}`} term={term} />
              ))}
            </div>
            <div className="foundation-flow-coach-actions" aria-label="Direkte Flow-Aktionen">
              {activeFlowCoach.actions.map((action: FoundationFlowCoachAction) => (
                <button
                  key={`compact-flow-action-${activeView}-${action.targetView}-${action.label}`}
                  className={`foundation-flow-coach-action${action.tone === "primary" ? " is-primary" : ""}`}
                  type="button"
                  onClick={() => openFoundationViewCommand(action.targetView)}
                  title={action.detail}
                >
                  <span>{action.label}</span>
                  <small>{action.detail}</small>
                  <b aria-hidden="true">›</b>
                </button>
              ))}
            </div>
          </div>
          <div className="foundation-flow-coach-cta">
            <span className="foundation-flow-coach-shortcut">{activeFlowCoach.shortcut}</span>
            <small className="muted" title={globalNextTitle}>
              Naechster Schritt: {globalNextLabel}
            </small>
          </div>
          <div className="foundation-flow-loop foundation-flow-loop-compact" aria-label="Gameplay Loop">
            {foundationFlowLoopStages.map((stage: FoundationFlowLoopStage, index: number) => (
              <button
                key={`compact-foundation-flow-loop-${stage.id}`}
                className={`foundation-flow-loop-step${index === activeFlowLoopIndex ? " is-active" : ""}${index < activeFlowLoopIndex ? " is-done" : ""}`}
                type="button"
                onClick={() => openFoundationViewCommand(stage.targetView)}
                title={stage.detail}
              >
                <span>{index + 1}</span>
                <strong>{stage.label}</strong>
                <small>{stage.detail}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {showCommandPalette ? (
        <div
          className="foundation-command-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCommandPalette();
            }
          }}
        >
          <section className="foundation-command-palette" role="dialog" aria-modal="true" aria-label="Foundation Schnellzugriff">
            <div className="foundation-command-search">
              <span className="foundation-command-kicker">Schnellzugriff</span>
              <input
                ref={commandSearchInputRef}
                className="input"
                type="search"
                value={commandSearch}
                onChange={(event) => setCommandSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && visibleFoundationCommandItems[0]) {
                    event.preventDefault();
                    runFoundationCommand(visibleFoundationCommandItems[0]);
                  }
                }}
                placeholder="Ansicht, Team, Spieler, Aktion oder Begriff suchen"
              />
            </div>
            <div className="foundation-command-list">
              {visibleFoundationCommandItems.map((command: FoundationCommandItem) => (
                <button
                  key={command.id}
                  className={`foundation-command-item${command.tone ? ` is-${command.tone}` : ""}`}
                  type="button"
                  onClick={() => runFoundationCommand(command)}
                >
                  <span className="foundation-command-section">{command.section}</span>
                  <span className="foundation-command-copy">
                    <strong>{command.label}</strong>
                    <small>{command.detail}</small>
                  </span>
                </button>
              ))}
              {visibleFoundationCommandItems.length === 0 ? (
                <div className="foundation-command-empty">
                  <strong>Kein Treffer</strong>
                  <span>Suchbegriff kuerzen oder direkt einen Tab nutzen.</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {seasonBriefingOpen ? (
        <div
          className="foundation-modal-backdrop season-briefing-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="season-briefing-title"
          data-testid="season-briefing-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeSeasonBriefing(false);
            }
          }}
        >
          <section className="foundation-modal season-briefing-page" data-testid="season-briefing-page">
            <header className="foundation-drilldown-header season-briefing-header">
              <div className="stack">
                <span className="eyebrow">Season-Einstieg</span>
                <h1 id="season-briefing-title">{gameState.season.name}</h1>
                <p className="muted">Lies die Saison-Vorschau durch und markiere sie danach als erledigt.</p>
              </div>
              <button className="secondary-button inline-button" type="button" onClick={() => closeSeasonBriefing(false)}>
                Später
              </button>
            </header>
            <div className="foundation-drilldown-body season-briefing-body">
              {!seasonBriefingScheduleReady ? (
                <p className="muted season-briefing-loading" data-testid="season-briefing-loading">
                  Diszi-Plan und Saison-Faktoren werden geladen …
                </p>
              ) : null}
              <section className="season-briefing-kpis" aria-label="Season-Faktoren">
                <article>
                  <span>Salary Factor</span>
                  <strong>{seasonBriefingData.currentFactor != null ? `${formatLocalePoints(seasonBriefingData.currentFactor, 2)}x` : "—"}</strong>
                  <small>Basis fuer Gehaelter, Preisgeld und Forecast</small>
                </article>
                <article>
                  <span>Matchdays</span>
                  <strong>{seasonBriefingData.scheduleCount}</strong>
                  <small>Diszi-Paare in dieser Season</small>
                </article>
                <article>
                  <span>POW / SPE / MEN / SOC</span>
                  <strong>{seasonBriefingTeamAxes}</strong>
                  <small>{selectedTeam ? `${selectedTeam.shortCode} Team-Identity` : "Team waehlen"}</small>
                </article>
                <article>
                  <span>Cash</span>
                  <strong>{seasonBriefingTeamCash == null ? "—" : formatTransfermarktCurrency(seasonBriefingTeamCash)}</strong>
                  <small>Startbudget fuer Transfers</small>
                </article>
              </section>

              <section className="season-briefing-section">
                <div className="panel-header compact">
                  <div className="stack">
                    <h3>Spieltags-Reihenfolge</h3>
                    <p className="muted">Alle Diszi-Paare der Season — Farb-Dopplungen und Spieltage mit 11–12 Slots sind markiert.</p>
                  </div>
                </div>
                <div className="season-briefing-matchday-grid">
                  {seasonBriefingScheduleReady ? (
                    seasonBriefingData.firstMatchdays.map((entry: SeasonBriefingMatchdayEntry) => (
                      <article
                        key={`season-briefing-md-${entry.matchdayId}`}
                        className={joinClassNames(
                          "season-briefing-matchday",
                          entry.sameColor && "has-same-color",
                          entry.isHeavyRoster && "has-heavy-roster",
                        )}
                      >
                        <span className="eyebrow">{entry.label}</span>
                        <div className="season-briefing-discipline-row">
                          {entry.disciplines.map((discipline: SeasonBriefingDisciplineEntry) => (
                            <span
                              key={`season-briefing-md-${entry.matchdayId}-${discipline.name}`}
                              className={`season-briefing-discipline-chip is-${discipline.color}`}
                            >
                              <b>{discipline.name}</b>
                              <small>{discipline.playerCount ?? "—"} Slots · {formatDisciplineCategoryLabel(discipline.category)}</small>
                            </span>
                          ))}
                        </div>
                        {entry.isHeavySameColor ? (
                          <small className="season-briefing-heavy-label is-multicolor">
                            Farb-Dopplung + Kaderdruck: {entry.totalSlots} Slots an diesem Spieltag
                          </small>
                        ) : entry.sameColor ? (
                          <small className="text-warning">Farb-Dopplung: gleiche Kategorie am selben Spieltag</small>
                        ) : entry.isHeavyRoster ? (
                          <small className="season-briefing-heavy-label">
                            Kaderdruck: {entry.totalSlots} Slots an diesem Spieltag
                          </small>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <p className="muted">Spieltags-Paare erscheinen, sobald der Diszi-Plan geladen ist.</p>
                  )}
                </div>
              </section>

              <section className="season-briefing-two-col">
                <article className="season-briefing-section">
                  <h3>Große Diszis</h3>
                  <p className="muted">Nach Slotgröße sortiert; die Spieltags-Reihenfolge steht oben.</p>
                  <div className="season-briefing-chip-list">
                    {seasonBriefingScheduleReady ? (
                      seasonBriefingData.bigDisciplines.map((slot: SeasonBriefingBigDisciplineSlot) => (
                        <span key={`season-briefing-big-${slot.matchdayId}-${slot.disciplineId}`} className={`season-briefing-discipline-chip is-${slot.color}`}>
                          <b>{slot.displayName}</b>
                          <small>{slot.matchdayLabel} · {slot.playerCount ?? "—"} Slots</small>
                        </span>
                      ))
                    ) : (
                      <p className="muted">Slot-Groessen folgen mit dem Diszi-Plan.</p>
                    )}
                  </div>
                </article>
                <article className="season-briefing-section">
                  <h3>Farb-Dopplungen</h3>
                  {!seasonBriefingScheduleReady ? (
                    <p className="muted">Farb-Kollisionen werden nach dem Laden des Diszi-Plans angezeigt.</p>
                  ) : seasonBriefingData.sameColorMatchdays.length > 0 ? (
                    <div className="season-briefing-chip-list">
                      {seasonBriefingData.sameColorMatchdays.map((entry: SeasonBriefingMatchdayEntry) => (
                        <span key={`season-briefing-double-${entry.matchdayId}`} className="season-briefing-warning-chip">
                          <b>{entry.label}</b>
                          <small>{entry.disciplines.map((discipline: SeasonBriefingDisciplineEntry) => discipline.name).join(" / ")}</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">In dieser Season keine gleiche Farbe doppelt am selben Spieltag. Breiter Kader wird etwas entspannter.</p>
                  )}
                  <div className="season-briefing-factor-row">
                    {seasonBriefingData.futureFactors.map((entry: SeasonBriefingFactorEntry) => (
                      <span key={`season-briefing-factor-${entry.label}`} className="pill">
                        {entry.label}: {formatLocalePoints(entry.factor, 2)}x
                      </span>
                    ))}
                  </div>
                </article>
              </section>
            </div>
            <div className="foundation-modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  closeSeasonBriefing(false);
                  setFoundationView("diszis", setActiveView);
                }}
              >
                Diszis ansehen
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={completeSeasonBriefingAndContinue}
              >
                Erledigt
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className={`foundation-context-banner${isSaveBusy ? " is-loading" : ""}${showCompactHeader ? " is-compact" : ""}`} data-testid="foundation-context-banner">
        <div className="foundation-context-main">
          {activeView !== "homeV2" ? (
            showCompactHeader ? (
              <details className="foundation-save-compact-menu" data-testid="foundation-save-compact-menu">
                <summary>{isSaveBusy ? "Save lädt…" : formatShortSaveId(activeSaveId)}</summary>
                <strong className="foundation-save-compact-full">{activeSaveName}</strong>
                <span className="muted">
                  {gameState.season.name} · Spieltag {activeContextMeta?.activeMatchday ?? gameState.season.currentMatchday} ·{" "}
                  {formatGamePhaseLabel(activeContextMeta?.gamePhase ?? gameState.gamePhase)}
                </span>
              </details>
            ) : (
              <>
                <span className="eyebrow">Spielstand</span>
                <strong>{isSaveBusy ? "Save-Wechsel lädt..." : activeSaveName}</strong>
                <span className="muted">
                  {gameState.season.name} · Spieltag {activeContextMeta?.activeMatchday ?? gameState.season.currentMatchday} ·{" "}
                  {formatGamePhaseLabel(activeContextMeta?.gamePhase ?? gameState.gamePhase)}
                </span>
              </>
            )
          ) : null}
        </div>
        {roomContext ? (
          <div className="foundation-ai-preseason-banner is-ready" data-testid="foundation-room-context-banner">
            <div className="foundation-ai-preseason-copy">
              <span className="eyebrow">Multiplayer-Room</span>
              <strong>Raum {roomContext.roomCode}</strong>
              {(() => {
                const roomIdentity = roomLiveState?.roomParticipants.find(
                  (participant: RoomParticipant) => participant.participantId === roomContext.participantId,
                );
                return roomIdentity ? (
                  <span className="pill" data-testid="foundation-room-participant-identity">
                    Participant {roomIdentity.displayName}
                  </span>
                ) : null;
              })()}
              <span className="muted">
                Save {formatShortSaveId(roomContext.saveId)}
                {roomLiveState
                  ? ` · Schritt: ${getRoomFlowStep(roomLiveState.roomFlowState.step).label} · ${
                      describeRoomFlowButton({
                        state: roomLiveState,
                        participantId: roomContext.participantId,
                      }).label
                    }`
                  : " · Schreibaktionen laufen serverseitig mit Sitzplatz-Token."}
              </span>
              {roomActivityNotice ? (
                <span className="muted">{roomActivityNotice.title} — {roomActivityNotice.detail}</span>
              ) : null}
            </div>
            <a className="secondary-button inline-button" href={`/room/${roomContext.roomCode}`}>
              Zur Room-Ansicht
            </a>
          </div>
        ) : null}
        {foundationActionFeedback ? (
          <div
            className={`foundation-action-feedback is-${foundationActionFeedback.tone}`}
            role="status"
            data-testid="foundation-action-feedback"
          >
            <div className="foundation-ai-preseason-copy">
              <span className="eyebrow">Aktion</span>
              <strong>{foundationActionFeedback.title}</strong>
              <span className="muted">{foundationActionFeedback.detail}</span>
            </div>
            <button className="table-link-button" type="button" onClick={() => setFoundationActionFeedback(null)}>
              ausblenden
            </button>
          </div>
        ) : null}
        {selectedTeam ? (
          <div className="foundation-manager-team" data-testid="active-manager-team">
            {(() => {
              const logo = getTeamLogoModel(selectedTeam);
              return logo.src ? (
                <img
                  className="foundation-manager-team-logo"
                  src={logo.src}
                  alt={`${selectedTeam.name} Logo`}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              ) : (
                <span className="foundation-manager-team-logo team-logo-placeholder">{selectedTeam.shortCode}</span>
              );
            })()}
            <label className="foundation-manager-team-select">
              <span>Aktives Team</span>
              <select
                className="input"
                value={selectedTeam.teamId}
                aria-label="Aktives Manager-Team"
                onChange={(event) => handleManagerTeamSelect(event.target.value)}
              >
                <option value="__all_teams__">Alle 32 Teams anzeigen</option>
                {managerTeamOptions.map((team: Team) => (
                  <option key={team.teamId} value={team.teamId}>
                    {team.shortCode} · {team.name}
                  </option>
                ))}
              </select>
            </label>
            {!showCompactHeader ? (
            <div className="foundation-manager-team-meta">
              <span className="pill">{selectedTeam.shortCode}</span>
              <span className="pill">Manager {activeOwner?.label ?? activeOwnerId}</span>
              <span className="pill">{formatTeamControlModeLabel(selectedTeamControl?.controlMode)}</span>
              {FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS ? (
                <span className="pill foundation-source-pill is-local" title="Temporärer Admin-Dev-Modus: alle Teams sind bearbeitbar.">
                  Admin: alle Teams
                </span>
              ) : isSelectedTeamManagementLocked ? (
                <span className="pill foundation-source-pill is-readonly">Nur Ansicht</span>
              ) : null}
              <span className="pill">Auswahl {formatActiveManagerTeamSource(activeManagerTeamSource)}</span>
              {isTeamSwitchPending ? <span className="pill foundation-context-tag">Teamwechsel...</span> : null}
            </div>
            ) : null}
            {!showCompactHeader ? (
            <div className="foundation-manager-team-controls" data-testid="active-owner-controls">
              <label className="foundation-mini-select">
                <span>Manager</span>
                <select
                  className="input"
                  value={activeOwner?.ownerId ?? DEFAULT_ACTIVE_OWNER_ID}
                  aria-label="Aktiver Owner"
                  onChange={(event) => {
                    const nextOwnerId = event.target.value;
                    setActiveOwnerId(nextOwnerId);
                    setTeamContextFilter("my_teams");
                    const nextTeams = filterTeamsByControlScope(gameState.teams, resolvedTeamControlSettings, "my_teams", nextOwnerId);
                    const nextTeam = nextTeams[0] ?? manualTeams[0] ?? gameState.teams[0];
                    if (nextTeam) {
                      setActiveManagerTeam(nextTeam.teamId, "manual_select");
                    }
                  }}
                >
                  {teamOwners.map((owner: TeamOwner) => (
                    <option key={owner.ownerId} value={owner.ownerId}>
                      {owner.label} · {owner.controlledTeamIds.length}
                    </option>
                  ))}
                </select>
              </label>
              <label className="foundation-mini-select">
                <span>Filter</span>
                <select
                  className="input"
                  value={teamContextFilter}
                  aria-label="Teamfilter"
                  onChange={(event) => setTeamContextFilter(event.target.value as TeamControlFilter)}
                >
                  <option value="my_teams">Meine Teams</option>
                  <option value="human">Gefuehrte Teams</option>
                  <option value="ai">Automatische Teams</option>
                  <option value="passive">Beobachtete Teams</option>
                  <option value="all">Alle Teams</option>
                  {teamOwners
                    .filter((owner: TeamOwner) => owner.ownerId !== "ai")
                    .map((owner: TeamOwner) => (
                      <option key={`owner-filter-${owner.ownerId}`} value={`owner:${owner.ownerId}`}>
                        Manager: {owner.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            ) : null}
            {!showCompactHeader ? (
            <div className="foundation-manager-team-switch" data-testid="human-team-quick-switch">
              {ownerQuickSwitchTeams.slice(0, 8).map((team: Team) => (
                <button
                  key={`quick-team-${team.teamId}`}
                  className={`table-link-button${team.teamId === selectedTeam.teamId ? " is-active" : ""}`}
                  type="button"
                  onClick={() => scheduleActiveManagerTeam(team.teamId, "manual_select")}
                >
                  {team.shortCode}
                </button>
              ))}
            </div>
            ) : null}
          </div>
        ) : null}
        <div className="foundation-context-chips" aria-label="Spielstand- und Saisonkontext">
          <span className="pill foundation-context-tag">{resolveScenarioMetaLabel(activeContextMeta)}</span>
          <span className="pill">{formatScenarioTypeLabel(activeContextMeta?.scenarioType)}</span>
          {readMeta.readOnly ? (
            <span className="pill foundation-source-pill is-readonly">{activeViewSourceBadge}</span>
          ) : null}
          {activeContextStatusChips.map((chip: ContextStatusChip) => (
            <span
              key={chip.label}
              className={`transfer-status-pill${chip.warning ? " is-warning" : chip.ready ? " is-ready" : ""}`}
            >
              {chip.label}
            </span>
          ))}
        </div>
      </section>

      {readOnlyBannerMessage ? (
        <section
          className="foundation-access-banner is-readonly is-compact"
          role="status"
          aria-label="Steuerungsstatus"
          title={readOnlyBannerMessage}
        >
          <span className="transfer-status-pill is-warning">Nur Ansicht</span>
        </section>
      ) : null}

      {screenPrimaryAction ? (
        <section
          className={joinClassNames(
            "foundation-screen-action",
            "is-compact",
            `is-${screenPrimaryAction.status}`,
            screenPrimaryAction.disabled && "is-disabled",
          )}
          aria-label="Hauptaktion dieser Ansicht"
        >
          <div className="foundation-screen-action-cta">
            <button
              className={`primary-button foundation-screen-action-button${screenPrimaryAction.disabled ? " is-disabled" : ""}`}
              type="button"
              onClick={screenPrimaryAction.onClick}
              disabled={screenPrimaryAction.disabled}
              title={
                [screenPrimaryAction.title, screenPrimaryAction.detail, screenPrimaryAction.disabledReason]
                  .filter(Boolean)
                  .join(" · ") || screenPrimaryAction.buttonLabel
              }
            >
              {screenPrimaryAction.buttonLabel}
            </button>
          </div>
        </section>
      ) : null}

      {activeView === "homeV2" && foundationWarningInboxItems.some((item: FoundationWarningInboxItem) => item.severity === "blocked") ? (
        <section className="foundation-warning-inbox" aria-label="Offene Hinweise">
          <div className="foundation-warning-inbox-summary">
            <span className="eyebrow">Hinweise</span>
            <strong>
              {
                foundationWarningInboxItems.filter((item: FoundationWarningInboxItem) => item.severity === "blocked")
                  .length
              }{" "}
              kritisch
            </strong>
          </div>
          <div className="foundation-warning-inbox-list">
            {foundationWarningInboxItems
              .filter((item: FoundationWarningInboxItem) => item.severity === "blocked")
              .map((item: FoundationWarningInboxItem) => (
              <button
                key={item.id}
                className={`foundation-warning-inbox-item is-${item.severity}`}
                type="button"
                title={item.detail}
                onClick={() => {
                  if (item.inboxItem) {
                    navigateToInboxItem(item.inboxItem);
                    return;
                  }
                  if (item.targetTeamId || item.targetPanel) {
                    navigateToGameFlowStep(item.targetView as GameFlowView, item.targetTeamId, item.targetPanel);
                    return;
                  }
                  if (item.targetView === "prize") {
                    navigateToPrizeFinanceViewFromRouting(item.targetPanel ?? null);
                    return;
                  }
                  setFoundationView(item.targetView, setActiveView);
                  scrollToFoundationTarget(getFoundationViewScrollTarget(item.targetView));
                }}
              >
                <span className={`foundation-warning-dot is-${item.severity}`} aria-hidden="true" />
                <span>
                  <strong>{item.title}</strong>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="foundation-content">
          {activeView === "encyclopedia" ? (
          <section className="panel foundation-encyclopedia-panel" id="foundation-encyclopedia" data-testid="foundation-encyclopedia">
            <div className="foundation-encyclopedia-hero">
              <div>
                <span className="eyebrow">Lexikon</span>
                <h2>Info-Buch fuer Kennzahlen und Systeme</h2>
                <p>
                  Abkuerzungen, Werte und wichtige Formellogik ohne Tabellenballast. Die Eintraege zeigen bewusst Faktoren
                  und Lesart, nicht jede interne Nachkommastelle.
                </p>
              </div>
              <button className="secondary-button inline-button" type="button" onClick={() => setShowCommandPalette(true)}>
                Begriff suchen
              </button>
            </div>

            <div className="foundation-encyclopedia-layout">
              <nav className="foundation-encyclopedia-index" aria-label="Lexikon-Themen">
                {GAME_ENCYCLOPEDIA_ENTRIES.map((entry) => (
                  <button
                    key={entry.id}
                    className={`foundation-encyclopedia-index-item${selectedEncyclopediaEntry?.id === entry.id ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedEncyclopediaEntryId(entry.id)}
                    title={entry.short}
                  >
                    <span>{entry.category}</span>
                    <strong>{entry.term}</strong>
                    <small>{entry.short}</small>
                  </button>
                ))}
              </nav>

              {selectedEncyclopediaEntry ? (
                <article className="foundation-encyclopedia-entry">
                  <div className="foundation-encyclopedia-entry-head">
                    <span className="pill">{selectedEncyclopediaEntry.category}</span>
                    <h3>{selectedEncyclopediaEntry.term}</h3>
                    <p>{selectedEncyclopediaEntry.meaning}</p>
                  </div>

                  <div className="foundation-encyclopedia-grid">
                    <section>
                      <span className="eyebrow">Faktoren</span>
                      <ul>
                        {selectedEncyclopediaEntry.factors.map((factor: string) => (
                          <li key={`${selectedEncyclopediaEntry.id}-${factor}`}>{factor}</li>
                        ))}
                      </ul>
                    </section>
                    <section>
                      <span className="eyebrow">So liest du es</span>
                      <p>{selectedEncyclopediaEntry.usage}</p>
                      {selectedEncyclopediaEntry.caveat ? (
                        <p className="foundation-encyclopedia-caveat">{selectedEncyclopediaEntry.caveat}</p>
                      ) : null}
                    </section>
                  </div>

                  <div className="foundation-encyclopedia-aliases">
                    {selectedEncyclopediaEntry.aliases.slice(0, 8).map((alias: string) => (
                      <span key={`${selectedEncyclopediaEntry.id}-${alias}`}>{alias}</span>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>
          </section>
          ) : null}


          {activeView === "homeV2" ? (
          <FoundationHomeV2Panel
            active
            tab={homeV2Tab}
            overview={{
              teamName: selectedTeam?.name ?? "Kein Team",
              teamCode: selectedTeam?.shortCode ?? "—",
              teamLogoUrl: homeActiveTeamLogo?.src ?? null,
              teamLogoInitials: homeActiveTeamLogo?.initials ?? selectedTeam?.shortCode ?? "?",
              seasonName: gameState.season.name,
              matchdayLabel: currentMatchdayDisplayLabel,
              managerLabel: activeOwner?.label ?? "—",
              controlModeLabel: formatTeamControlModeLabel(selectedTeamControl?.controlMode),
              rank: selectedStandingRow?.rank ?? null,
              points: selectedStandingRow?.points ?? null,
              cash: selectedStandingRow?.cash ?? null,
              salaryTotal: selectedStandingRow?.salaryTotal ?? null,
              guv: selectedStandingRow?.guv ?? null,
              rosterCount: selectedRosterTableRows.length,
              gmStoryLabel: selectedHqGmStory?.label ?? null,
              gmStoryDetail: selectedHqGmStory?.detail ?? null,
              gmStoryTone: selectedHqGmStory?.tone ?? null,
              boardPressure: selectedBoardConfidence?.pressure ?? null,
              boardRating: selectedBoardConfidence?.value ?? null,
              boardObjectives: homeV2BoardObjectives,
              nextStepLabel: globalNextLabel,
              nextStepStatus: getGameFlowStatusLabel(gameFlowActionStep.status),
              nextStepDetail:
                gameFlowActionStep.blockers[0]
                  ? formatCockpitReason(gameFlowActionStep.blockers[0])
                  : gameFlowActionStep.warnings[0]
                    ? formatCockpitReason(gameFlowActionStep.warnings[0])
                    : "Flow bereit — weiter zum naechsten Schritt.",
              warnings: homeWarnings.map(formatHomeWarningLabel),
              topPlayers: homeV2TopPlayers,
              leagueHeatPools: leaguePlayerHeatPools,
              facilities: homeV2Facilities,
              scheduleItems: homeV2ScheduleItems,
              inboxItems: homeV2InboxItems,
              todayCards: homeTodayCards,
              onContinue: triggerGlobalNext,
              onOpenTeams: () => setFoundationView("teams", setActiveView),
              onOpenLineup: () => setFoundationView("lineup", setActiveView),
              onOpenMarket: () => setFoundationView("marketV2", setActiveView),
              onOpenTraining: () => setFoundationView("trainingCompact", setActiveView),
              onOpenOffice: () => navigateHomeTab("office"),
              onOpenSeason: () => setFoundationView("seasonV2", setActiveView),
              onOpenInbox: () => setFoundationView("inboxV2", setActiveView),
              onCompleteInboxItem: (itemId) => {
                const sourceItem = visibleInboxItems.find((item: GameInboxItem) => item.itemId === itemId);
                if (sourceItem) {
                  updateInboxItemStatus(sourceItem, "done");
                }
              },
              onOpenBoardObjectives: () => {
                setFoundationView("teams", setActiveView);
                scrollToFoundationTarget("team-board-objectives");
              },
              onOpenPlayer: (playerId) => openPlayerDrawerById(playerId),
            }}
            office={{
              homeNextMatchdayStatus,
              selectedTeamPlayerDemands,
              selectedHqFinanceWarnings,
              selectedStandingRow,
              activeTeamOpenInboxItems,
              activeTeamCriticalInboxItems,
              selectedOpenObjectives,
              selectedBoardConfidence,
              hqTrainingFocusCount,
              selectedTeamGeneralManager,
              hqTransferWishlistEntries,
              selectedTeamCaptainProfile,
              selectedTeamCaptainCandidates,
              selectedTeamCaptainPlayerId,
              assignTeamCaptainBusy,
              onAssignTeamCaptain: assignTeamCaptainForSelectedTeam,
              captainEffectsTooltip,
              selectedTeamPowers,
              hqContractExpiringCount,
              hqTransferSellMarkers,
              selectedHqMoraleSummary,
              selectedRosterTableRows,
              selectedHqAxisSummary,
              selectedHqInboxItems,
              selectedHqGmStory,
              selectedTeam,
              selectedTeamControl,
              homeActiveTeamLogo,
              gameState,
              currentMatchdayDisplayLabel,
              selectedTeamCanManage,
              isReadOnlyMode: readMeta.readOnly,
              selectedTeamAverageAxisStats,
              rosterPlayers,
              onNavigate: (view) => setFoundationView(view, setActiveView),
              onOpenTeam: (teamId) => openTeamDrawerById(teamId),
              onNavigateInboxItem: navigateToInboxItem,
            }}
          />
          ) : null}

          <FoundationShellRouterTeams
            active={activeView === "teams"}
            selectedTeam={selectedTeam}
            hostProps={foundationTeamsViewHostProps}
          />

          <FoundationShellRouterTraining
            active={activeView === "trainingCompact"}
            selectedTeam={selectedTeam}
            hostProps={foundationTrainingCompactHostProps}
          />

          <section className={`panel foundation-player-profile-panel${getViewClass("playerProfile")}`}>
            {activeView === "playerProfile" && playerProfileData ? (
              <PlayerProfileClient
                data={playerProfileData}
                activeTab={playerProfileTab}
                onTabChange={(tab) => {
                  setPlayerProfileTab(tab);
                  syncFoundationViewInUrl("playerProfile", tab, playerProfileData.playerId);
                }}
                onClose={() => {
                  playerProfileHydrationSequenceRef.current += 1;
                  setPlayerProfileData(null);
                  setFoundationView("homeV2", setActiveView);
                  syncFoundationViewInUrl("homeV2");
                }}
                onOpenTraining={() => openTrainingPlayerTarget(playerProfileData.playerId)}
                onOpenContractOffer={() => setFoundationView("marketV2", setActiveView)}
                onOpenLeagueLeaders={onOpenLeagueLeaders}
                onOpenTeam={(teamId) => openTeamProfileById(teamId)}
                trainingRow={playerProfileTrainingRow}
                trainingModeOptions={trainingV2ModeOptions}
                trainingClassOptions={PROGRESSION_CLASS_ORDER.map((className) => ({ value: className, label: className }))}
                onSetTrainingMode={(playerId, mode) => {
                  void setPlayerTrainingMode(playerId, mode);
                }}
                onSetTrainingClass={(playerId, trainingClass) => {
                  void setPlayerTrainingClass(playerId, trainingClass);
                }}
                trainingReadOnly={playerProfileTrainingReadOnly}
              />
            ) : activeView === "playerProfile" ? (
              <div className="foundation-view-loading-panel" data-testid="foundation-player-profile-loading">
                {gameState.season.id === "loading" || playerProfileLoading ? (
                  <p className="foundation-view-loading">Spielerprofil wird geladen …</p>
                ) : (
                  <div className="player-drawer-callout">
                    <strong>Spielerprofil nicht verfügbar</strong>
                    <p className="muted">
                      Der Spieler konnte im aktuellen Save nicht geladen werden. Prüfe die URL oder wähle den Spieler erneut aus dem Kader.
                    </p>
                    <button className="secondary-button" type="button" onClick={() => closeFoundationDrilldownPanel()}>
                      Zurück
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </section>

          <section className={`panel foundation-team-profile-panel${getViewClass("teamProfile")}`}>
            {activeView === "teamProfile" && teamProfileData ? (
              <TeamProfileClient
                data={teamProfileData}
                onClose={closeTeamProfile}
                onOpenPlayer={(playerId, activePlayerId) => void openPlayerProfileById(playerId, activePlayerId)}
                leagueHeatPools={leaguePlayerHeatPools}
              />
            ) : null}
          </section>

          <section className={`panel foundation-facilities-overview-v2-panel${getViewClass("facilitiesOverviewV2", "trainingV2")}`}>
            {(activeView === "facilitiesOverviewV2" || activeView === "trainingV2") && selectedTeam ? (
              <FacilitiesV2Client
                source={readMeta.source}
                managementLocked={isSelectedTeamManagementLocked}
                managementLockedReason={
                  isSelectedTeamManagementLocked
                    ? `${selectedTeam.name} gehoert nicht zu deinen steuerbaren Teams. Gebaeude sind nur zur Ansicht offen.`
                    : null
                }
                selectedTeam={selectedTeam}
                selectedTeamControlMode={formatTeamControlModeLabel(selectedTeamControl?.controlMode)}
                seasonLabel={canonicalSeasonLabel}
                onOpenTraining={() => setFoundationView("trainingCompact", setActiveView)}
                onOpenTeams={() => setFoundationView("teams", setActiveView)}
                facilityPanelTarget={
                  foundationPanel === "facility" && foundationFacilityTarget
                    ? {
                        facilityId: foundationFacilityTarget.facilityId as FacilityId,
                        action: foundationFacilityTarget.action as "upgrade" | "downgrade" | "maintenance",
                      }
                    : null
                }
                onOpenFacilityPanel={(facilityId, action) => openFacilityPanel(facilityId, action)}
                onCloseFacilityPanel={closeFacilityPanel}
                summary={{
                  cashCurrent: selectedTeam.cash,
                  netFacilityResult: trainingFacilitySeasonEndFinance.netFacilityResult,
                  recoveryAfterTraining: trainingForecastSummary.recoveryAfterTraining,
                }}
                trainingFacilityEffectPreview={trainingFacilityEffectPreview}
                facilityRows={trainingFacilityRows}
                specialistWingVariant={specialistWingVariantDraft}
                specialistWingOptions={Object.entries(SPECIALIST_WING_VARIANTS).map(([value, variant]) => ({
                  value: value as SpecialistWingVariant,
                  label: variant.label,
                }))}
                onSetSpecialistWingVariant={setSpecialistWingVariantDraft}
                facilityUpgradeBusy={facilityUpgradeBusy}
                facilityUpgradePreview={facilityUpgradePreview}
                facilityUpgradeError={facilityUpgradeError}
                facilityUpgradeSuccess={facilityUpgradeSuccess}
                facilityMaintenanceBusy={facilityMaintenanceBusy}
                facilityMaintenancePreview={facilityMaintenancePreview}
                facilityMaintenanceError={facilityMaintenanceError}
                facilityMaintenanceSuccess={facilityMaintenanceSuccess}
                onRunFacilityUpgradePreview={(facilityId, action) => {
                  void runFacilityUpgradePreview(facilityId, action);
                }}
                onConfirmFacilityUpgrade={() => {
                  void confirmFacilityUpgrade();
                }}
                onRunFacilityMaintenancePreview={(facilityId) => {
                  void runFacilityMaintenancePreview(facilityId);
                }}
                onConfirmFacilityMaintenance={() => {
                  void confirmFacilityMaintenance();
                }}
              />
            ) : null}
          </section>

          <section className={`panel foundation-scouting-center-v2-panel${getViewClass("scoutingCenterV2")}`}>
            {activeView === "scoutingCenterV2" ? (
              <ScoutingCenterV2Client
                activeTab={scoutingCenterTab}
                onActiveTabChange={setScoutingCenterTab}
                hideSubNav
                teamName={selectedTeam?.name ?? "Kein Team"}
                scoutingFacilityLevel={scoutingHubV2Visibility.scoutingLevel}
                scoutingFacilityLabel={
                  FACILITY_CATALOG.find((entry) => entry.facilityId === "scouting_office")?.label ?? "Scouting Office"
                }
                recruitmentBudget={selectedStandingRow?.cash != null ? formatMoney(selectedStandingRow.cash) : "—"}
                rosterCount={selectedRosterTableRows.length}
                rosterMinimum={selectedStandingRow?.playerMin ?? null}
                rosterOptimum={selectedStandingRow?.playerOpt ?? null}
                draftContextNote="Teams starten mit Budget und leerem Kader. Base-Infos im Transfermarkt reichen fuer den ersten Draft — Scouting verfeinert die Sicht, ersetzt aber nicht den Markt."
                disclosureLevel={getTransfermarktScoutingDisclosure(scoutingHubV2Visibility.scoutingLevel).level}
                visibleAtTier={scoutingHubV2Visibility.visibleAtTier}
                hiddenAtTier={scoutingHubV2Visibility.hiddenAtTier}
                baseInfoAlwaysVisible={scoutingHubV2Visibility.baseInfoAlwaysVisible}
                activeScoutTargets={scoutingHubV2TargetSections.activeTargets}
                bookmarkedTargets={scoutingHubV2TargetSections.bookmarkedTargets}
                watchTargets={scoutingHubV2TargetSections.activeTargets}
                scoutPipeline={
                  selectedTeamScoutPipeline
                    ? {
                        facilityLevel: selectedTeamScoutPipeline.facilityLevel,
                        occupiedSlots: selectedTeamScoutPipeline.occupiedSlots,
                        maxSlots: selectedTeamScoutPipeline.config.maxSlots,
                        tickGain: selectedTeamScoutPipeline.config.tickGain,
                        passiveActive: selectedTeamScoutPipeline.passiveActive,
                        passiveSlots: selectedTeamScoutPipeline.config.passiveSlots,
                        focusTickGain: selectedTeamScoutPipeline.focusTickGain,
                        wishlistTickGain: selectedTeamScoutPipeline.wishlistTickGain,
                        passiveTickGain: selectedTeamScoutPipeline.passiveTickGain,
                        draftSuspended: isTeamSetupDraftWishlistPhase(gameState, selectedTeam.teamId),
                        records: selectedTeamScoutPipeline.records.map((record: PlayerScoutIntelRecord) => {
                          const player = gameState.players.find((entry: Player) => entry.id === record.playerId);
                          return {
                            playerId: record.playerId,
                            playerName: player?.name ?? record.playerId,
                            source: record.source,
                            certainty: record.certainty,
                          };
                        }),
                      }
                    : null
                }
                onOpenMarket={() => setFoundationView("marketV2", setActiveView)}
                onOpenFacilities={() => setFoundationView("facilitiesOverviewV2", setActiveView)}
                onOpenPlayer={(playerId) => openPlayerProfileById(playerId)}
                queueEntries={scoutingQueueEntries}
                focusEtaLabel={
                  scoutingFocusSummary && Number.isFinite(scoutingFocusSummary.etaMatchdays)
                    ? `noch ${scoutingFocusSummary.etaMatchdays} Spieltag${scoutingFocusSummary.etaMatchdays === 1 ? "" : "e"}`
                    : null
                }
                onReorderQueue={reorderTransferWishlist}
                onRemoveFromQueue={removeTransferWishlistEntry}
                report={scoutingReport}
                selectedReportPlayerId={scoutingReportSelectedPlayerId}
                onSelectReportPlayer={setScoutingReportSelectedPlayerId}
              />
            ) : null}
          </section>

          <section className={`panel foundation-inbox-v2-panel${getViewClass("inboxV2")}`}>
            {activeView === "inboxV2" && selectedTeam ? (
              <InboxV2Client
                items={inboxV2Items}
                selectedItemId={inboxV2SelectedItemId ?? inboxV2Items[0]?.id ?? null}
                onSelectItem={setInboxV2SelectedItemId}
                openCount={activeTeamOpenInboxItems.length}
                criticalCount={activeTeamCriticalInboxItems.length}
                teamLabel={selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : null}
                categoryFilter={inboxCategoryFilter}
                onCategoryFilterChange={setInboxCategoryFilter}
                hideCategoryFilters
                includeDone={inboxIncludeDone}
                onIncludeDoneChange={setInboxIncludeDone}
                includeDismissed={inboxIncludeDismissed}
                onIncludeDismissedChange={setInboxIncludeDismissed}
                onRunChoice={(_itemId, choiceId) => {
                  if (choiceId !== "open-target") {
                    return;
                  }
                  const selected = inboxV2Items.find((item: InboxV2Item) => item.id === (inboxV2SelectedItemId ?? inboxV2Items[0]?.id));
                  const sourceItem = visibleInboxItems.find((item: GameInboxItem) => item.itemId === selected?.id);
                  if (sourceItem) {
                    navigateToInboxItem(sourceItem);
                  }
                }}
                onMarkDone={(itemId) => {
                  const sourceItem = visibleInboxItems.find((item: GameInboxItem) => item.itemId === itemId);
                  if (sourceItem) {
                    updateInboxItemStatus(sourceItem, "done");
                  }
                }}
                onDismiss={(itemId) => {
                  const sourceItem = visibleInboxItems.find((item: GameInboxItem) => item.itemId === itemId);
                  if (sourceItem) {
                    updateInboxItemStatus(sourceItem, "dismissed");
                  }
                }}
              />
            ) : null}
          </section>



          {activeView === "teamSettings" ? (
            <FoundationTeamSettingsHost {...foundationTeamSettingsHostProps} />
          ) : null}

          <section className={`panel${getViewClass("admin")}`} id="foundation-admin" data-testid="foundation-admin">
            <div className="panel-header">
              <div className="stack season-panel-head">
                <h2>Admin</h2>
                <p className="muted">Technischer Bereich für Save-, Import- und Debug-Themen. Team-Lore und Steuerung liegen jetzt im eigenen Team-Settings-Tab.</p>
              </div>
            </div>
            <div className="room-meta foundation-admin-meta">
              <span className="pill">Spielstand: {readSourceLabel}</span>
              <span className="pill">Save {activeSaveName}</span>
              <span className="pill">Teams {gameState.teams.length}</span>
            </div>
            <div className="foundation-save-actions" style={{ marginTop: 16 }}>
              <button className="primary-button" type="button" onClick={() => setActiveView("teamSettings")}>
                Team Settings öffnen
              </button>
            </div>
            <section className="panel inset-panel admin-season-sim-panel" style={{ marginTop: 16 }}>
              <div className="panel-header compact">
                <div className="stack">
                  <h3>Season Simulation Control</h3>
                  <p className="muted">
                    Kontrollierter lokaler Runner mit Heartbeat, echten Phasen-Writes und append-only Reports. Keine Prisma-/Supabase-Writes.
                  </p>
                </div>
                <span className={`transfer-status-pill${adminSimulationRun?.status === "blocked" ? " is-warning" : adminSimulationRun?.status === "running" ? " is-ready" : ""}`}>
                  {adminSimulationRun?.status ?? "idle"}
                </span>
              </div>

              <div className="admin-season-sim-controls">
                <label>
                  Seasons
                  <select
                    value={adminSimulationSeasonCount}
                    onChange={(event) => setAdminSimulationSeasonCount(Number(event.target.value) === 5 ? 5 : Number(event.target.value) === 2 ? 2 : 1)}
                    disabled={adminSimulationRun?.status === "running"}
                  >
                    <option value={1}>1 Season</option>
                    <option value={2}>2 Seasons</option>
                    <option value={5}>5 Seasons</option>
                  </select>
                </label>
                <label>
                  Modus
                  <select
                    value={adminSimulationMode}
                    onChange={(event) => setAdminSimulationMode(event.target.value === "apply" ? "apply" : "dry_run")}
                    disabled={adminSimulationRun?.status === "running"}
                  >
                    <option value="dry_run">Dry Run</option>
                    <option value="apply">Apply</option>
                  </select>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={adminSimulationFullChurn}
                    onChange={(event) => setAdminSimulationFullChurn(event.target.checked)}
                    disabled={adminSimulationRun?.status === "running"}
                  />
                  Full-Churn Stressmodus
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={adminSimulationInjuries}
                    onChange={(event) => setAdminSimulationInjuries(event.target.checked)}
                    disabled={adminSimulationRun?.status === "running"}
                  />
                  Injuries Testmode
                </label>
              </div>

              <div className="cockpit-actions admin-season-sim-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={readMeta.readOnly || adminSimulationBusy || adminSimulationRun?.status === "running"}
                  onClick={() => {
                    void startAdminSeasonSimulationRun();
                  }}
                >
                  Simulation starten
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={adminSimulationBusy || adminSimulationRun?.status !== "running"}
                  onClick={() => {
                    void postAdminSeasonSimulation("pause");
                  }}
                >
                  Pause
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={adminSimulationBusy || adminSimulationRun?.status !== "paused"}
                  onClick={() => {
                    void postAdminSeasonSimulation("resume");
                  }}
                >
                  Resume
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={adminSimulationBusy || !adminSimulationRun || ["completed", "blocked", "cancelled"].includes(adminSimulationRun.status)}
                  onClick={() => {
                    void postAdminSeasonSimulation("cancel");
                  }}
                >
                  Abbrechen
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={adminSimulationBusy || !adminSimulationRun}
                  onClick={() => {
                    void postAdminSeasonSimulation("tick");
                  }}
                >
                  Nächsten Schritt ausführen
                </button>
              </div>

              {adminSimulationError ? <p className="text-negative">{adminSimulationError}</p> : null}

              <div className="admin-season-sim-progress">
                <div className="player-drawer-progress-track">
                  <span style={{ width: `${adminSimulationRun?.progressPct ?? 0}%` }} />
                </div>
                <strong>{adminSimulationRun?.progressPct ?? 0}%</strong>
              </div>

              <div className="teams-summary-grid history-summary-grid admin-season-sim-grid">
                <article className="metric-card">
                  <span>Aktive Phase</span>
                  <strong>{adminSimulationRun?.activePhase ?? "—"}</strong>
                </article>
                <article className="metric-card">
                  <span>Season</span>
                  <strong>{adminSimulationRun?.activeSeasonId ?? gameState.season.id}</strong>
                </article>
                <article className="metric-card">
                  <span>Matchday</span>
                  <strong>{adminSimulationRun?.activeMatchdayId ?? gameState.matchdayState.matchdayId}</strong>
                </article>
                <article className="metric-card">
                  <span>Team</span>
                  <strong>{adminSimulationRun?.activeTeamId ?? "—"}</strong>
                </article>
                <article className="metric-card">
                  <span>Operation</span>
                  <strong>{adminSimulationRun?.currentOperation ?? "bereit"}</strong>
                </article>
                <article className="metric-card">
                  <span>Dauer</span>
                  <strong>{adminSimulationRun ? `${Math.round(adminSimulationRun.durationMs / 1000)}s` : "—"}</strong>
                </article>
                <article className="metric-card">
                  <span>Heartbeat</span>
                  <strong>{adminSimulationRun?.heartbeatAt ? new Date(adminSimulationRun.heartbeatAt).toLocaleTimeString("de-DE") : "—"}</strong>
                </article>
                <article className="metric-card">
                  <span>Reports</span>
                  <strong>{adminSimulationRun?.reports.summary ? adminSimulationRun.reports.summary.split("/").at(-1) : "—"}</strong>
                </article>
              </div>

              {adminSimulationRun ? (
                <div className="admin-season-sim-report-links">
                  <span className="pill">JSONL: {adminSimulationRun.reports.jsonl}</span>
                  <span className="pill">Summary: {adminSimulationRun.reports.summary}</span>
                </div>
              ) : null}

              <div className="admin-season-sim-issues">
                <div>
                  <strong>Issues</strong>
                  <ul className="warning-list compact-list cockpit-detail-list">
                    {adminSimulationRun?.issues.slice(-8).map((issue: AdminSeasonSimulationRunSummary["issues"][number]) => (
                      <li key={`${issue.at}-${issue.code}-${issue.message}`} className={issue.level === "red" ? "text-negative" : issue.level === "yellow" ? "text-warning" : undefined}>
                        [{issue.level.toUpperCase()}] {issue.phase}: {issue.message}
                      </li>
                    ))}
                    {(adminSimulationRun?.issues.length ?? 0) === 0 ? <li>Keine RED/YELLOW Issues.</li> : null}
                  </ul>
                </div>
                <div>
                  <strong>Letzte Logs</strong>
                  <ul className="warning-list compact-list cockpit-detail-list">
                    {adminSimulationRun?.logs.slice(-20).map((entry: AdminSeasonSimulationRunSummary["logs"][number]) => (
                      <li key={`${entry.at}-${entry.phase}-${entry.message}`}>
                        {new Date(entry.at).toLocaleTimeString("de-DE")} · {entry.phase} · {entry.message}
                      </li>
                    ))}
                    {(adminSimulationRun?.logs.length ?? 0) === 0 ? <li>Noch keine Logs.</li> : null}
                  </ul>
                </div>
              </div>
            </section>
            <details className="panel inset-panel" style={{ marginTop: 16 }}>
              <summary>Technische Übersicht</summary>
              <div className="stats-grid" style={{ marginTop: 12 }}>
                <article className="metric-card">
                  <span>Spieler</span>
                  <strong>{gameState.mappingReport.importedPlayerCount}</strong>
                </article>
                <article className="metric-card">
                  <span>Warnungen</span>
                  <strong>{gameState.mappingReport.warnings.length}</strong>
                </article>
                <article className="metric-card">
                  <span>Rosters</span>
                  <strong>{gameState.rosters.length}</strong>
                </article>
                <article className="metric-card">
                  <span>Transfer Listings</span>
                  <strong>{gameState.transferListings.length}</strong>
                </article>
              </div>
            </details>
          </section>

          <section className={`panel${getViewClass("generator")}`} id="foundation-generator" data-testid="foundation-generator">
            <div className="panel-header">
              <div className="stack season-panel-head">
                <h2>Player Generator</h2>
                <p className="muted">Lokale Drafts für neue Spieler, ohne produktive Spieler automatisch zu verändern.</p>
              </div>
            </div>

            <PlayerGeneratorPanel
              players={gameState.players}
              disciplines={gameState.disciplines}
              drafts={gameState.seasonState.playerGeneratorDrafts ?? []}
              teamContexts={playerGeneratorTeamContexts}
              activeTeamId={selectedTeam?.teamId ?? null}
              readOnly={readMeta.readOnly}
              readSourceLabel={readSourceLabel}
              onSaveDrafts={savePlayerGeneratorDrafts}
            />
          </section>

          <FoundationShellRouterCockpit
            active={activeView === "cockpit"}
            hostProps={foundationCockpitHostProps}
          />

          {activeView === "lineup" || activeView === "lineupV2" ? (
          <FoundationLineupPanel
            active
            uiVariant="focusV2"
            clientKey={`lineup-${activeSaveId}-${gameState.season.id}-${gameState.matchdayState.matchdayId}-${activeManagerTeamId}-${effectiveActiveOwnerId}`}
            teamTooltip={
              selectedTeam
                ? `${selectedTeam.name}: Einsatzliste mit Focus Mode — Slots, Kandidaten und Preview.`
                : "Matchday Room fuer Teamwahl, Slots und Preview."
            }
            client={{
              embedded: true,
              initialSource: "sqlite",
              defaultSaveId: activeSaveId,
              defaultSaveName: activeSaveName,
              defaultSeasonId: gameState.season.id,
              defaultMatchdayId: gameState.matchdayState.matchdayId,
              defaultTeamId: activeManagerTeamId,
              highlightMissingSlots: Boolean(lineupFocusRequestKey),
              focusMissingRequestKey: lineupFocusRequestKey,
              draftBoardView: lineupDraftBoardViewRequest ?? lineupDraftBoardView,
              onDraftBoardViewChange: (view) => {
                setLineupDraftBoardView(view);
                setLineupDraftBoardViewRequest(null);
                syncFoundationViewInUrl("lineup", view === "formBoard" ? "formplan" : "lineup", null, { push: true });
              },
              shellControlledDraftBoardView: true,
              initialDraftBoardView: lineupDraftBoardViewRequest ?? undefined,
              onDraftBoardViewApplied: () => setLineupDraftBoardViewRequest(null),
              activeOwnerId: effectiveActiveOwnerId,
              manageableTeamIds: foundationManageableTeamIds,
              onTeamChange: (teamId) => setActiveManagerTeam(teamId, "manual_select"),
              playerCatalog: gameState.players,
              onOpenPlayerDetails: (payload) => openPlayerDrawerById(payload.playerId, payload.activePlayerId),
              onLineupSaved: handleHumanLineupSaved,
              onFormCardPlanSaved: handleFormCardPlanSaved,
              onOpenArena: () => setFoundationView("matchdayArena", setActiveView),
              roomContext,
            }}
          />
          ) : null}

          {activeView === "matchdayArena" ? (
          <FoundationMatchdayArenaPanel
            active
            ready={saveSummaries.length > 0 && Boolean(selectedTeamId)}
            sourceBadgeLabel={getViewSourceBadgeLabel("matchdayArena", activeContextMeta)}
            contextLabel={`${activeSaveName} · ${gameState.season.id} · ${gameState.matchdayState.matchdayId}`}
            blockerSummary={matchdayArenaBlockerSummary}
            blockerGapDetail={activeManagerArenaGapDetail}
            onOpenLineup={() => setFoundationView("lineup", setActiveView)}
            clientKey={`${activeSaveId}-${gameState.season.id}-${gameState.matchdayState.matchdayId}-${activeManagerTeamId}`}
            client={{
              initialSource: "sqlite",
              defaultSaveId: activeSaveId,
              defaultSeasonId: gameState.season.id,
              defaultMatchdayId: gameState.matchdayState.matchdayId,
              defaultTeamId: activeManagerTeamId,
              playerCatalog: gameState.players,
              teams: gameState.teams,
              teamControlSettingsMap: teamControlDraft,
              roomContext: roomContext,
              onOpenPlayerDetails: (payload) => openPlayerDrawerById(payload.playerId, payload.activePlayerId),
              onOpenTeam: openTeamDrawerById,
              onBackToLineup: shouldShowArenaBackToLineup ? () => setFoundationView("lineup", setActiveView) : null,
              onOpenMatchdayResult: () => {
                setSelectedMatchdaySummaryId(gameState.matchdayState.matchdayId);
                window.setTimeout(() => {
                  document.getElementById("arena-result-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 40);
              },
              onOpenSeason: () => setFoundationView("seasonV2", setActiveView),
            }}
            resultSummary={
              <section className="panel arena-result-summary" id="arena-result-summary" data-testid="arena-result-summary">
                <div className="panel-header">
                  <div className="stack">
                    <h2>Spieltagsergebnis</h2>
                    <span className="muted">
                      {matchdaySummary.seasonId} · Spieltag {matchdaySummary.matchdayNumber ?? "—"} · direkt aus gespeicherten Matchday-Results
                    </span>
                  </div>
                  <div className="matchday-result-actions">
                    <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("matchdayArena", setActiveView)}>
                      Zur Arena
                    </button>
                    <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("seasonV2", setActiveView)}>
                      Saisonstand ansehen
                    </button>
                    {matchdaySummary.hasResult ? (
                      <button className="primary-button inline-button" type="button" onClick={triggerGlobalNext}>
                        Weiter
                      </button>
                    ) : (
                      <button
                        className="primary-button inline-button"
                        type="button"
                        data-testid="arena-finish-matchday-button"
                        disabled={readMeta.readOnly || cockpitBusyKey != null}
                        onClick={() => void runFinishMatchdaySimple()}
                        title="Berechnet alle Ergebnisse, schreibt Wertung und wechselt zum naechsten Spieltag."
                      >
                        {cockpitBusyKey === "matchday-auto-run-execute" ? "Laeuft..." : "Spieltag abschliessen"}
                      </button>
                    )}
                  </div>
                </div>
                {matchdaySummary.topTeams.length === 0 && matchdaySummary.bottomTeams.length === 0 ? (
                  <div className="transfer-callout is-warning arena-result-empty-state">
                    <strong>Noch kein Spieltagsergebnis vorhanden</strong>
                    <span>Nach dem finalen Reveal erscheinen hier Tageswertung, Rangänderung und Top Player.</span>
                  </div>
                ) : (
                  <div className="matchday-result-hero-grid">
                    <article className="metric-card">
                      <span>Aktives Team</span>
                      <strong>{activeTeamMatchdaySummaryRow?.teamShortCode ?? selectedTeam?.shortCode ?? "—"}</strong>
                      <small>
                        Tagesrang {activeTeamMatchdaySummaryRow?.matchdayRank ?? "—"} · {activeTeamMatchdaySummaryRow?.matchdayPoints ?? "—"} Pkt
                      </small>
                    </article>
                    <article className="metric-card">
                      <span>Rangänderung</span>
                      <strong className={activeTeamMatchdaySummaryRow?.rankDirection === "up" ? "text-positive" : activeTeamMatchdaySummaryRow?.rankDirection === "down" ? "text-negative" : undefined}>
                        {activeTeamMatchdaySummaryRow?.rankDelta != null
                          ? activeTeamMatchdaySummaryRow.rankDelta > 0
                            ? `↑ +${activeTeamMatchdaySummaryRow.rankDelta}`
                            : activeTeamMatchdaySummaryRow.rankDelta < 0
                              ? `↓ ${activeTeamMatchdaySummaryRow.rankDelta}`
                              : "0"
                          : "—"}
                      </strong>
                      <small>{activeTeamMatchdaySummaryRow?.seasonRankBeforeMatchday ?? "—"} → {activeTeamMatchdaySummaryRow?.seasonRankAfterMatchday ?? "—"}</small>
                    </article>
                    <article className="metric-card">
                      <span>D1</span>
                      <strong>{matchdaySummary.d1.disciplineName ?? "—"}</strong>
                      <small>{matchdaySummary.d1.disciplineId ?? "missing_source"}</small>
                    </article>
                    <article className="metric-card">
                      <span>D2</span>
                      <strong>{matchdaySummary.d2.disciplineName ?? "—"}</strong>
                      <small>{matchdaySummary.d2.disciplineId ?? "missing_source"}</small>
                    </article>
                  </div>
                )}
              </section>
            }
          />
          ) : null}

          <FoundationShellRouterMatchdayResult
            active={activeView === "matchdayResult"}
            hostProps={foundationMatchdayResultHostProps}
          />

          {(activeView === "seasonV2") ? (
            <FoundationSeasonV2Panel
              active={activeView === "seasonV2"}
              selectedSeasonId={seasonOverviewSeasonId}
              selectedSeasonLabel={selectedSeasonOverviewLabel}
              sourceLabel={seasonOverviewSourceLabel}
              sourceBadgeLabel={getViewSourceBadgeLabel("seasonV2", activeContextMeta)}
              isArchived={isViewingArchivedSeason}
              seasonOptions={seasonOverviewOptions}
              selectedTeamSummary={seasonV2SelectedTeamSummary}
              leaderTeam={seasonV2LeaderTeam}
              momentumTeam={seasonV2MomentumTeam}
              pressureTeam={seasonV2PressureTeam}
              topPlayer={seasonV2TopPlayers[0] ?? null}
              standingsRows={seasonV2StandingsRows}
              topPlayers={seasonV2TopPlayers}
              playerRows={seasonV2PlayerRows}
              gmRows={seasonV2GmRows}
              archiveRows={seasonV2ArchiveRows}
              disciplineLeaders={seasonV2DisciplineLeaders}
              isLoading={seasonStandingsLoading}
              onChangeSeason={(seasonId) => {
                setSeasonOverviewSeasonId(seasonId);
                void reloadSeasonStandingsOverview(seasonId);
              }}
              onOpenTeam={(teamId) => openTeamProfileById(teamId)}
              onOpenPlayer={(playerId) => openPlayerProfileById(playerId)}
              viewMode={seasonStandingsMode}
              onViewModeChange={setSeasonStandingsMode}
              onOpenRanks={() => setFoundationView("ranks", setActiveView)}
              onOpenPrize={() => openPrizeFinanceView({ tab: "prize" })}
            />
          ) : null}

          <FoundationShellRouterSeasonPreview
            active={activeView === "seasonPreview"}
            hostProps={foundationSeasonPreviewHostProps}
          />

          {activeView === "players" ? (
          <section className={`panel${getViewClass("players")}`} id="players-table">
            <div className="panel-header">
              <h2>Players</h2>
            </div>
            <div className="players-toolbar players-toolbar-compact">
              <label className="filter-field">
                <span>Umfang</span>
                <select
                  className="input"
                  value={playerScope}
                  onChange={(event) => setPlayerScope(event.target.value as PlayerTableScope)}
                >
                  <option value="active">Aktive Spieler</option>
                  <option value="free_agents">Free Agents anzeigen</option>
                  <option value="all">Alle Spieler anzeigen</option>
                </select>
              </label>
              <label className="filter-field">
                <span>Team</span>
                <select
                  className="input"
                  value={playerTeamFilter}
                  onChange={(event) => setPlayerTeamFilter(event.target.value)}
                >
                  <option value="ALL">Alle</option>
                  {gameState.teams.map((team: Team) => (
                    <option key={team.teamId} value={team.teamId}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>Klasse</span>
                <select
                  className="input"
                  value={playerClassFilter}
                  onChange={(event) => setPlayerClassFilter(event.target.value)}
                >
                  <option value="ALL">Alle</option>
                  {playerClassOptions.map((className: string) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </label>
              <article className="metric-card players-count-card players-count-card-compact">
                <span>Anzahl</span>
                <strong>{playersTableRows.length}</strong>
              </article>
            </div>
            <div className="players-bracket-strip">
              {(
                [
                  { bracket: 1, range: "<12.5M" },
                  { bracket: 2, range: "12.5–17.5M" },
                  { bracket: 3, range: "17.5–22.5M" },
                  { bracket: 4, range: "22.5–30M" },
                  { bracket: 5, range: "30–37.5M" },
                  { bracket: 6, range: "37.5–45M" },
                  { bracket: 7, range: "45–55M" },
                  { bracket: 8, range: "55–70M" },
                  { bracket: 9, range: "70M+" },
                ] as const
              ).map(({ bracket, range }) => (
                <span key={bracket} className="bracket-pill">
                  <strong className="bracket-pill-bracket">B{bracket}</strong>
                  <span className="bracket-pill-range">{range}</span>
                  <strong className="bracket-pill-count">{playerBracketCounts[bracket] ?? 0}</strong>
                </span>
              ))}
            </div>
            <div className="table-shell">
              <table className="team-table players-table">
                <colgroup>
                  {visiblePlayersTableColumns.map((column: FoundationTableColumn) => (
                    <col key={column.id} style={{ width: `${getTableColumnWidth("playersTable", column)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {visiblePlayersTableColumns.map((column: FoundationTableColumn) => (
                      <th
                        key={column.id}
                        {...getTableHeaderDragProps("playersTable", column, visiblePlayersTableColumns)}
                        style={{ width: `${getTableColumnWidth("playersTable", column)}px`, minWidth: `${column.minWidth}px` }}
                      >
                        <div className="resizable-header-cell">
                          {column.id === "image" ? (
                            <span>Bild</span>
                          ) : (
                            <SortableHeader label={column.label} tableId="playersTable" columnKey={column.dataKey} sortState={tableSorts.playersTable} onToggle={toggleTableSort} />
                          )}
                          <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("playersTable", column, event)} onDoubleClick={() => resetTableColumnWidth("playersTable", column)} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayersTableRows.slice(0, 160).map((row: FoundationPlayerScopeRow) => (
                    <tr key={row.player.id} onClick={() => void openPlayerDrawerById(row.player.id, row.roster?.id)}>
                      {visiblePlayersTableColumns.map((column: FoundationTableColumn) => {
                        if (column.id === "image") {
                          const portrait = getPlayerPortraitModel(row.player);
                          return (
                            <td key={column.id}>
                              <FoundationPlayerPortraitPreview
                                playerId={row.player.id}
                                name={row.player.name}
                                portraitUrl={portrait.src}
                                portraitInitials={portrait.initials}
                                playerOvr={row.playerOvr}
                                playerMvs={row.playerMvs}
                                playerPps={row.playerPps}
                                pow={row.player.coreStats.pow ?? null}
                                spe={row.player.coreStats.spe ?? null}
                                men={row.player.coreStats.men ?? null}
                                soc={row.player.coreStats.soc ?? null}
                                leagueHeatPools={leaguePlayerHeatPools}
                                variant="team"
                                context="teamGrid"
                                playerClassName={row.player.className}
                                subMeta={row.team?.name ?? "Free Agent"}
                              >
                                {portrait.src ? (
                                  <img
                                    className="transfermarkt-portrait"
                                    src={portrait.src}
                                    alt={row.player.name}
                                    width={56}
                                    height={56}
                                    loading="lazy"
                                    decoding="async"
                                    fetchPriority="low"
                                  />
                                ) : (
                                  <div className="transfermarkt-portrait transfermarkt-portrait-placeholder" aria-label={`${row.player.name} placeholder`}>
                                    {portrait.initials}
                                  </div>
                                )}
                              </FoundationPlayerPortraitPreview>
                            </td>
                          );
                        }
                        if (column.id === "name") {
                          return (
                            <td key={column.id}>
                              <div className="table-player-cell">
                                <button
                                  className="table-link-button"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openPlayerDrawerById(row.player.id, row.roster?.id);
                                  }}
                                >
                                  {row.player.name}
                                </button>
                                <span>{row.transferStatus}</span>
                              </div>
                            </td>
                          );
                        }
                        if (column.id === "team") {
                          const teamLogo = row.team ? getTeamLogoModel(row.team) : null;
                          return (
                            <td key={column.id}>
                              <button
                                className="players-table-team-cell players-table-team-button"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (row.team) {
                                    openTeamProfileById(row.team.teamId);
                                  }
                                }}
                              >
                                {teamLogo?.src ? (
                                  <BudgetedMediaImage
                                    className="players-table-team-logo"
                                    src={teamLogo.src}
                                    alt={`${row.team?.name ?? "Team"} Logo`}
                                    loading="lazy"
                                    fetchPriority="low"
                                  />
                                ) : (
                                  <span className="players-table-team-logo players-table-team-logo-placeholder" aria-label={`${row.team?.name ?? "Free Agent"} Logo Platzhalter`}>
                                    {teamLogo?.initials ?? "FA"}
                                  </span>
                                )}
                                <span>{row.team?.name ?? "Free Agent"}</span>
                              </button>
                            </td>
                          );
                        }
                        if (column.id === "class") {
                          return (
                            <td key={column.id}>
                              <ClassIcon classNameValue={row.player.className} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
                            </td>
                          );
                        }
                        if (column.id === "race") {
                          return (
                            <td key={column.id}>
                              <RaceIcon race={row.player.race} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
                            </td>
                          );
                        }
                        if (column.id === "pps") return <td key={column.id} className={row.playerPps != null ? getPoolHeatClass(row.playerPps, leaguePlayerHeatPools.pps) : ""}>{row.playerPps != null ? formatPpsValue(row.playerPps) : "—"}</td>;
                        if (column.id === "ovr") return <td key={column.id} className={row.playerOvr != null ? getPoolHeatClass(row.playerOvr, leaguePlayerHeatPools.ovr) : ""}>{formatWholeNumber(row.playerOvr)}</td>;
                        if (column.id === "mvs") return <td key={column.id} className={row.playerMvs != null ? getPoolHeatClass(row.playerMvs, leaguePlayerHeatPools.mvs) : ""}>{row.playerMvs != null ? formatPpsValue(row.playerMvs) : "—"}</td>;
                        if (column.id === "mw") {
                          const marketValue = getPlayerDisplayMarketValue(row.player);
                          const marketValueDelta = getPlayerDisplayMarketValueDelta(row.player, row.roster, gameState);
                          return (
                            <td key={column.id}>
                              <span className="players-table-money-cell">
                                <span>{formatLocalePoints(marketValue, 2)}</span>
                                {renderEconomyDelta(marketValueDelta, "higher", "players-table-money-delta")}
                              </span>
                            </td>
                          );
                        }
                        if (column.id === "salary") {
                          const salary = row.roster ? getRosterEntryDisplaySalary(row.roster, row.player) : getPlayerDisplaySalary(row.player);
                          const salaryDelta = getRosterEntrySalaryDelta(row.roster, row.player, gameState);
                          return (
                            <td key={column.id}>
                              <span className="players-table-money-cell">
                                <span>{formatLocalePoints(salary, 2)}</span>
                                {renderEconomyDelta(salaryDelta, "lower", "players-table-money-delta")}
                              </span>
                            </td>
                          );
                        }
                        if (column.id === "contract") return <td key={column.id}>{row.roster ? row.roster.contractLength : "—"}</td>;
                        if (column.id === "appearances") return <td key={column.id}>{row.seasonPerformance ? row.seasonPerformance.appearances : "—"}</td>;
                        if (column.id === "bestDiscipline") {
                          return (
                            <td key={column.id}>
                              <DisciplineIcon label={row.bestDiscipline ?? "—"} showLabel={Boolean(row.bestDiscipline)} />
                            </td>
                          );
                        }
                        if (column.id === "careerLeague") {
                          const stats = row.careerLeagueStats;
                          if (!stats) {
                            return <td key={column.id}>—</td>;
                          }
                          return (
                            <td key={column.id} title={`Alltime Liga: ${stats.seasonsPlayed} Saison(en) · ${stats.appearances} Einsätze · ${formatLocalePoints(stats.totalPps, 1)} PPs`}>
                              <span className="players-table-career-stat">
                                {stats.appearances} / {formatLocalePoints(stats.totalPps, 1)}
                              </span>
                            </td>
                          );
                        }
                        const traits = [
                          ...row.player.traitsPositive,
                          ...row.player.traitsNegative.map((trait) => `-${trait}`),
                        ];
                        return <td key={column.id}>{traits.length > 0 ? traits.join(", ") : "—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted players-footnote">
              Farben sind liga-relativ: jede Stufe steht fuer ein Achtel des aktuellen Liga-Pools. So sticht auch ein POW 61 klar hervor, wenn er ligaweit in den Top 12,5% liegt.
            </p>
          </section>
          ) : null}

          {activeView === "ranks" ? (
          <>
          <section className="panel" id="discipline-ranks">
            <div className="panel-header ranks-panel-header">
              <div className="ranks-panel-heading">
                <TooltipHeading
                  as="h2"
                  tooltip="Retool-Logik: Pro Team zaehlen je Disziplin die Top 6 aktiven Spieler, ihre Werte werden summiert und ligaweit gerankt. TOT / POW / SPE / MEN / SOC zeigen die aggregierten Teamranks derselben Quelle."
                >
                  Ranks - Teamstaerke pro Diszi
                </TooltipHeading>
                <div className="ranks-season-toolbar">
                  <label className="filter-field ranks-season-select">
                    <span>Saison</span>
                    <select
                      className="input"
                      value={seasonOverviewSeasonId}
                      onChange={(event) => setSeasonOverviewSeasonId(event.target.value)}
                    >
                      {(seasonOverviewOptions ?? []).map((option: SeasonOverviewOption) => (
                        <option key={option.seasonId} value={option.seasonId}>
                          {option.seasonName} {option.status === "active" ? "(aktiv)" : "(Archiv)"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className={`pill ${isViewingArchivedRanksSeason ? "is-warning" : "is-ready"}`}>
                    {isViewingArchivedRanksSeason ? "Archiv" : "Live"}
                  </span>
                  {ranksArchiveMissing ? (
                    <span className="pill is-warning">Rank-Archiv fehlt · Live-Fallback</span>
                  ) : null}
                  <span className="muted ranks-season-source">{seasonOverviewSourceLabel}</span>
                </div>
              </div>
              <ColumnVisibilityManager
                title="Spalten"
                columns={disciplineRanksColumns}
                activePreset={getTableActivePreset("disciplineRanksTable")}
                isVisible={(columnId, visibleByDefault) =>
                  isTableColumnVisible("disciplineRanksTable", columnId, visibleByDefault)
                }
                onToggle={(columnId, nextVisible) => setTableColumnVisible("disciplineRanksTable", columnId, nextVisible)}
                onMove={(columnId, direction) => moveTableColumn("disciplineRanksTable", columnId, direction, disciplineRanksColumns)}
                getWidth={(column) => getTableColumnWidth("disciplineRanksTable", column)}
                onStepWidth={(column, delta) => adjustTableColumnWidth("disciplineRanksTable", column, delta)}
                onResetWidth={(column) => resetTableColumnWidth("disciplineRanksTable", column)}
                onResetToDefault={() => resetTableLayout("disciplineRanksTable", disciplineRanksColumns)}
              />
            </div>
            <section className="ranks-leader-grid" aria-label="Aktuelle Teamstaerke Leader">
              {rankLeaderCards.map((entry: FoundationDisciplineLeaderEntry) => (
                <article key={`rank-leader-${entry.id}`} className={`ranks-leader-card is-${entry.tone}`}>
                  <span>{entry.label}</span>
                  <strong>{entry.row?.team.name ?? "—"}</strong>
                  <small>
                    {entry.row ? `#1 · ${formatLocalePoints(entry.row.scorePack[entry.scoreKey], 1)} Punkte` : "keine Werte"}
                  </small>
                </article>
              ))}
            </section>
            <div className="table-shell">
              <table className="team-table ranks-table">
                <colgroup>
                  {visibleDisciplineRanksColumns.map((column: FoundationTableColumn) => (
                    <col key={column.id} style={{ width: `${getTableColumnWidth("disciplineRanksTable", column)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {visibleDisciplineRanksColumns.map((column: FoundationTableColumn, columnIndex: number) => {
                      const discipline = orderedDisciplines.find((entry: Discipline) => entry.id === column.id);
                      const previousDiscipline = [...visibleDisciplineRanksColumns.slice(0, columnIndex)]
                        .reverse()
                        .map((entry: FoundationTableColumn) => orderedDisciplines.find((disciplineEntry: Discipline) => disciplineEntry.id === entry.id))
                        .find(Boolean);
                      const startsDisciplineGroup = Boolean(discipline && previousDiscipline?.category !== discipline.category);
                      return (
                        <th
                          key={column.id}
                          {...getTableHeaderDragProps("disciplineRanksTable", column, visibleDisciplineRanksColumns)}
                          className={joinClassNames(
                            column.id === "team" ? "ranks-sticky-team" : "",
                            getRanksMetricToneClass(column.id, "head"),
                            discipline ? `season-standings-cell-discipline ranks-head-discipline ranks-head-discipline-${discipline.category}` : "",
                            startsDisciplineGroup && "ranks-discipline-group-start",
                          )}
                          style={{ width: `${getTableColumnWidth("disciplineRanksTable", column)}px`, minWidth: `${column.minWidth}px` }}
                        >
                          <div className="resizable-header-cell">
                            <SortableHeader label={column.label} tableId="disciplineRanks" columnKey={column.dataKey} sortState={tableSorts.disciplineRanks} onToggle={toggleTableSort} />
                            <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("disciplineRanksTable", column, event)} onDoubleClick={() => resetTableColumnWidth("disciplineRanksTable", column)} />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedDisciplineRankRows.map((row: FoundationDisciplineRankRow) => (
                    <tr
                      key={row.team.teamId}
                      className={joinClassNames(
                        row.team.teamId === activeManagerTeamId && "is-active-team-row",
                        getOwnerTeamHighlightClass(resolvedTeamControlSettings[row.team.teamId]),
                      )}
                      onClick={() => openTeamProfileById(row.team.teamId)}
                    >
                      {visibleDisciplineRanksColumns.map((column: FoundationTableColumn, columnIndex: number) => {
                        if (column.id === "team") {
                          return <td key={column.id} className="ranks-sticky-team">{row.team.name}</td>;
                        }
                        if (column.id === "totalRank") {
                          return (
                            <td key={column.id} className={joinClassNames(getRanksMetricToneClass(column.id, "cell"), row.scorePack.total > 0 ? getRankHeatClass(row.totalRank, gameState.teams.length) : "")}>
                              <RanksRankCell rank={row.totalRank} delta={row.rankDeltas?.total} />
                            </td>
                          );
                        }
                        if (column.id === "powRank") {
                          return (
                            <td key={column.id} className={joinClassNames(getRanksMetricToneClass(column.id, "cell"), row.scorePack.pow > 0 ? getRankHeatClass(row.powRank, gameState.teams.length) : "")}>
                              <RanksRankCell rank={row.powRank} delta={row.rankDeltas?.pow} />
                            </td>
                          );
                        }
                        if (column.id === "speRank") {
                          return (
                            <td key={column.id} className={joinClassNames(getRanksMetricToneClass(column.id, "cell"), row.scorePack.spe > 0 ? getRankHeatClass(row.speRank, gameState.teams.length) : "")}>
                              <RanksRankCell rank={row.speRank} delta={row.rankDeltas?.spe} />
                            </td>
                          );
                        }
                        if (column.id === "menRank") {
                          return (
                            <td key={column.id} className={joinClassNames(getRanksMetricToneClass(column.id, "cell"), row.scorePack.men > 0 ? getRankHeatClass(row.menRank, gameState.teams.length) : "")}>
                              <RanksRankCell rank={row.menRank} delta={row.rankDeltas?.men} />
                            </td>
                          );
                        }
                        if (column.id === "socRank") {
                          return (
                            <td key={column.id} className={joinClassNames(getRanksMetricToneClass(column.id, "cell"), row.scorePack.soc > 0 ? getRankHeatClass(row.socRank, gameState.teams.length) : "")}>
                              <RanksRankCell rank={row.socRank} delta={row.rankDeltas?.soc} />
                            </td>
                          );
                        }
                        const rank = row.disciplineRanks[column.id] ?? 0;
                        const discipline = orderedDisciplines.find((entry: Discipline) => entry.id === column.id);
                        const previousDiscipline = [...visibleDisciplineRanksColumns.slice(0, columnIndex)]
                          .reverse()
                          .map((entry: FoundationTableColumn) => orderedDisciplines.find((disciplineEntry: Discipline) => disciplineEntry.id === entry.id))
                          .find(Boolean);
                        const startsDisciplineGroup = Boolean(discipline && previousDiscipline?.category !== discipline.category);
                        return (
                          <td
                            key={`${row.team.teamId}-${column.id}`}
                            className={joinClassNames(
                              "ranks-discipline-cell",
                              discipline ? `ranks-discipline-cell-${discipline.category}` : "",
                              startsDisciplineGroup && "ranks-discipline-group-start",
                              row.scorePack.disciplines[column.id] > 0 ? getRankHeatClass(rank, gameState.teams.length) : "",
                            )}
                          >
                            {rank}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <FoundationRanksHost {...foundationRanksHostProps} />
          <FoundationLeagueLeadersHost {...foundationLeagueLeadersHostProps} />
          </>
          ) : null}

          {activeView === "diszis" ? <FoundationDiszisHost {...foundationDiszisHostProps} /> : null}

          <FoundationShellRouterPrize
            active={activeView === "prize"}
            hostProps={foundationPrizeFinanceShellHostProps}
          />

          <FoundationShellRouterMarketV2
            active={isTransferMarketViewActive}
            hostProps={foundationMarketV2ShellHostProps}
          />

          {isMarketSellPanelOpen ? (
            <section className="foundation-drilldown-page transfer-sell-page" data-testid="transfer-sell-page" aria-label="Verkaufsdialog">
                <header className="foundation-drilldown-header">
                  <div className="stack">
                    <span className="eyebrow">Verkauf</span>
                    <h1>{marketSellPreview?.player?.name ?? marketSellSubject?.playerName ?? "Spieler verkaufen"}</h1>
                    <p className="muted">
                      Spielstand: {readMeta.source === "prisma" ? "Referenz" : "lokal"}
                    </p>
                  </div>
                  <button className="secondary-button inline-button" type="button" onClick={closeMarketSellModal}>
                    Zurück
                  </button>
                </header>

                <div className="foundation-drilldown-body foundation-modal-body transfer-buy-modal-body">
                  {(() => {
                    const context = marketSellPlayerContext;
                    const portraitSrc = marketSellSubject?.portraitUrl ?? null;
                    const playerName = marketSellPreview?.player?.name ?? marketSellSubject?.playerName ?? "Unbekannt";
                    const className = marketSellPreview?.player?.className ?? marketSellSubject?.className ?? "—";
                    const race = marketSellPreview?.player?.race ?? marketSellSubject?.race ?? "—";
                    const saleVsMarketValue =
                      marketSellPreview?.salePrice != null && marketSellPreview.marketValueReference != null
                        ? marketSellPreview.salePrice - marketSellPreview.marketValueReference
                        : null;

                    return (
                      <div className="transfer-buy-player-line transfer-sell-hero-line">
                        <div className="transfer-modal-player-hero transfer-sell-hero">
                          {portraitSrc ? (
                            <img
                              className="transfermarkt-portrait transfer-sell-portrait"
                              src={portraitSrc}
                              alt={playerName}
                              width={72}
                              height={72}
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
                            />
                          ) : (
                            <div className="transfermarkt-portrait transfermarkt-portrait-placeholder transfer-sell-portrait" aria-label={`${playerName} placeholder`}>
                              {playerName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="transfer-modal-player-summary">
                            <div className="transfer-modal-player-head">
                              <strong>{playerName}</strong>
                              <div className="transfer-modal-player-meta">
                                <ClassColorChip className={className} />
                                <span className="muted">{race}</span>
                                <span className="pill">
                                  {marketSellPreview?.team?.shortCode ?? selectedTeam?.shortCode ?? "—"} · {marketSellPreview?.team?.name ?? selectedTeam?.name ?? "Kein Team gewaehlt"}
                                </span>
                              </div>
                            </div>
                            <div className="transfer-modal-player-kpis transfer-sell-kpis">
                              <article className="transfer-modal-kpi is-money">
                                <span>Verkaufspreis</span>
                                <strong>{formatTransfermarktCurrency(marketSellPreview?.salePrice ?? null)}</strong>
                                <small className={saleVsMarketValue != null ? (saleVsMarketValue >= 0 ? "text-positive" : "text-negative") : undefined}>
                                  vs. MW {saleVsMarketValue != null ? formatSignedTransfermarktCurrency(saleVsMarketValue) : "—"}
                                </small>
                              </article>
                              <article className="transfer-modal-kpi">
                                <span>Faktor</span>
                                <strong>{marketSellPreview?.saleFactor != null ? `${formatLocalePoints(marketSellPreview.saleFactor, 2)}x` : "—"}</strong>
                              </article>
                              <article className="transfer-modal-kpi">
                                <span>PPs</span>
                                <strong>{formatPpsValue(context?.rating?.ppsSeason ?? context?.performance?.totalPoints ?? null)}</strong>
                              </article>
                              <article className="transfer-modal-kpi">
                                <span>OVR</span>
                                <strong>{formatWholeNumber(context?.rating?.ovrNormalized ?? context?.player?.ovr ?? null)}</strong>
                              </article>
                            </div>
                          </div>
                        </div>
                        <span className={`transfer-status-pill${marketSellPreview?.canSell ? " is-ready" : " is-blocked"}`}>
                          {readMeta.source === "prisma" ? "read-only" : marketSellPreview?.canSell ? "bereit" : "geblockt"}
                        </span>
                      </div>
                    );
                  })()}

                  {marketSellError ? (
                    <div className="transfer-feedback-banner is-error">
                      <strong>Verkaufsvorschau blockiert</strong>
                      <span>{marketSellError}</span>
                    </div>
                  ) : null}
                  {marketSellSuccess ? (
                    <div className="transfer-feedback-banner is-success">
                      <strong>Verkauf erfolgreich</strong>
                      <span>{marketSellSuccess}</span>
                    </div>
                  ) : null}

                  {marketSellPreview ? (
                    <>
                      <div className="transfer-sell-layout">
                        <div className="transfer-callout-title">
                          <strong>Performance</strong>
                          <span className="muted">{marketSellPreview.team?.shortCode ?? "—"} · {marketSellPreview.team?.name ?? "—"}</span>
                        </div>
                        <div className="metric-grid compact transfer-sell-metric-grid">
                          <article className="metric-card">
                            <span>OVR</span>
                            <strong>{formatWholeNumber(marketSellPlayerContext?.rating?.ovrNormalized ?? marketSellPlayerContext?.player?.ovr ?? null)}</strong>
                            <small>Rang {marketSellPlayerContext?.rating?.ovrRank ?? "—"}</small>
                          </article>
                          <article className="metric-card">
                            <span>MVS</span>
                            <strong>{formatPpsValue(marketSellPlayerContext?.rating?.mvs ?? null)}</strong>
                            <small>Rang {marketSellPlayerContext?.rating?.mvsRank ?? "—"}</small>
                          </article>
                          <article className="metric-card">
                            <span>Season PPs</span>
                            <strong>{formatPpsValue(marketSellPlayerContext?.rating?.ppsSeason ?? marketSellPlayerContext?.performance?.totalPoints ?? null)}</strong>
                            <small>Rang {marketSellPlayerContext?.rating?.ppsSeasonRank ?? "—"}</small>
                          </article>
                          <article className="metric-card">
                            <span>Einsaetze</span>
                            <strong>{marketSellPlayerContext?.performance?.appearances ?? "—"}</strong>
                            <small>Top 10 {marketSellPlayerContext?.performance?.top10Count ?? "—"} · MVP {marketSellPlayerContext?.performance?.mvpCount ?? "—"}</small>
                          </article>
                          <article className="metric-card">
                            <span>Letzter Einsatz</span>
                            <strong>{marketSellPlayerContext?.performance?.latestDisciplineLabel ?? "—"}</strong>
                            <small>
                              Score {formatPpsValue(marketSellPlayerContext?.performance?.latestFinalScore ?? null)} · Rang{" "}
                              {marketSellPlayerContext?.performance?.latestRankInDiscipline ?? "—"}
                            </small>
                          </article>
                          <article className="metric-card">
                            <span>Beste Diszi</span>
                            <strong>{marketSellPlayerContext?.performance?.bestDisciplineLabel ?? "—"}</strong>
                            <small>{formatPpsValue(marketSellPlayerContext?.performance?.bestDisciplineScore ?? null)} Score</small>
                          </article>
                        </div>
                      </div>

                      <div className="transfer-modal-section">
                        <div className="transfer-callout-title">
                          <strong>PP-Profil</strong>
                          <span className="muted">aktive Season</span>
                        </div>
                        <div className="transfer-sell-area-grid">
                          {(marketSellPlayerContext?.areaRows ?? []).map((area: MarketSellAreaRow) => (
                            <article className={`transfer-sell-area-card is-${area.tone}`} key={area.key}>
                              <span>{area.key}</span>
                              <strong>{formatPpsValue(area.value)}</strong>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div className="transfer-modal-section">
                        <div className="transfer-callout-title">
                          <strong>Entwicklung & Vertrag</strong>
                          <span className="muted">{marketSellPreview.transferCreated ? "geschrieben" : "Preview"}</span>
                        </div>
                        <div className="metric-grid compact transfer-sell-metric-grid">
                          <article className="metric-card">
                            <span>MW aktuell</span>
                            <strong>{formatTransfermarktCurrency(marketSellPlayerContext?.currentMarketValue ?? marketSellPreview.marketValueReference)}</strong>
                            <small>
                              Kaderwert {formatTransfermarktCurrency(marketSellPlayerContext?.rosterMarketValue ?? marketSellPreview.activePlayer?.currentValue ?? null)}
                            </small>
                          </article>
                          <article className="metric-card">
                            <span>MW Delta</span>
                            <strong className={marketSellPlayerContext?.marketValueDelta != null ? (marketSellPlayerContext.marketValueDelta >= 0 ? "text-positive" : "text-negative") : undefined}>
                              {marketSellPlayerContext?.marketValueDelta != null ? formatSignedDisplayMoney(marketSellPlayerContext.marketValueDelta) : "—"}
                            </strong>
                            <small>aktuell vs. Kaderwert</small>
                          </article>
                          <article className="metric-card">
                            <span>Kaufpreis</span>
                            <strong>{formatTransfermarktCurrency(marketSellPlayerContext?.purchasePrice ?? marketSellPreview.activePlayer?.purchasePrice ?? null)}</strong>
                            <small>letzter Einstieg</small>
                          </article>
                          <article className="metric-card">
                            <span>GuV Verkauf</span>
                            <strong className={marketSellPlayerContext?.saleProfit != null ? (marketSellPlayerContext.saleProfit >= 0 ? "text-positive" : "text-negative") : undefined}>
                              {marketSellPlayerContext?.saleProfit != null ? formatSignedDisplayMoney(marketSellPlayerContext.saleProfit) : "—"}
                            </strong>
                            <small>Preis minus Einstieg</small>
                          </article>
                          <article className="metric-card">
                            <span>Gehalt</span>
                            <strong>{formatTransfermarktCurrency(marketSellPlayerContext?.salary ?? marketSellPreview.activePlayer?.salary ?? null)}</strong>
                            <small className={marketSellPlayerContext?.salaryDelta != null ? (marketSellPlayerContext.salaryDelta <= 0 ? "text-positive" : "text-negative") : undefined}>
                              vs. normal {marketSellPlayerContext?.salaryDelta != null ? formatSignedDisplayMoney(marketSellPlayerContext.salaryDelta) : "—"}
                            </small>
                          </article>
                          <article className="metric-card">
                            <span>Laufzeit</span>
                            <strong>{marketSellPreview.activePlayer?.contractLength ?? "—"}</strong>
                            <small>Rolle {marketSellPreview.activePlayer?.roleTag ?? "—"}</small>
                          </article>
                        </div>
                      </div>

                      <div className="transfer-sell-history-grid">
                        <div className="transfer-modal-section">
                          <div className="transfer-callout-title">
                            <strong>Letzte Einsaetze</strong>
                            <span className="muted">{marketSellPlayerContext?.recentMatchdays.length ?? 0}</span>
                          </div>
                          {marketSellPlayerContext?.recentMatchdays.length ? (
                            <div className="transfer-sell-mini-table">
                              {marketSellPlayerContext.recentMatchdays.map((entry: {
                                matchdayId: string;
                                totalContribution: number | null;
                                averageFinalScore: number | null;
                                bestDisciplineLabel: string | null;
                              }) => (
                                <div className="transfer-sell-mini-row" key={entry.matchdayId}>
                                  <span>{entry.matchdayId}</span>
                                  <strong>{formatPpsValue(entry.totalContribution)}</strong>
                                  <small>{entry.bestDisciplineLabel ?? "—"} · Score {formatPpsValue(entry.averageFinalScore)}</small>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="muted transfer-empty-hint">Noch keine Matchday-Historie fuer diesen Spieler.</p>
                          )}
                        </div>

                        <div className="transfer-modal-section">
                          <div className="transfer-callout-title">
                            <strong>Top-Diszis</strong>
                            <span className="muted">{marketSellPlayerContext?.topDisciplines.length ?? 0}</span>
                          </div>
                          {marketSellPlayerContext?.topDisciplines.length ? (
                            <div className="transfer-sell-mini-table">
                              {marketSellPlayerContext.topDisciplines.map((entry: {
                                disciplineId: string;
                                disciplineName: string;
                                totalContribution: number | null;
                                averageContribution: number | null;
                                averageFinalScore: number | null;
                              }) => (
                                <div className="transfer-sell-mini-row" key={entry.disciplineId}>
                                  <span>{entry.disciplineName}</span>
                                  <strong>{formatPpsValue(entry.totalContribution)}</strong>
                                  <small>Ø Beitrag {formatPpsValue(entry.averageContribution)} · Ø Score {formatPpsValue(entry.averageFinalScore)}</small>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="muted transfer-empty-hint">Noch keine Disziplin-Historie verfuegbar.</p>
                          )}
                        </div>

                        <div className="transfer-modal-section">
                          <div className="transfer-callout-title">
                            <strong>Transferhistorie</strong>
                            <span className="muted">{marketSellPlayerContext?.transferEvents.length ?? 0}</span>
                          </div>
                          {marketSellPlayerContext?.transferEvents.length ? (
                            <div className="transfer-sell-mini-table">
                              {marketSellPlayerContext.transferEvents.map((entry: {
                                id: string;
                                type: "buy" | "sell" | "contract_exit";
                                label: string;
                                seasonLabel: string;
                                fee: number;
                                salary: number;
                                fromTeam: string;
                                toTeam: string;
                              }) => (
                                <div className="transfer-sell-mini-row" key={entry.id}>
                                  <span className={getTransferTypePillClass(entry.type)}>{entry.label}</span>
                                  <strong>{formatTransfermarktCurrency(entry.fee)}</strong>
                                  <small>
                                    {entry.seasonLabel} · {entry.fromTeam} → {entry.toTeam} · Gehalt {formatTransfermarktCurrency(entry.salary)}
                                  </small>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="muted transfer-empty-hint">Keine Transfers im Save gefunden.</p>
                          )}
                        </div>
                      </div>

                      <div className="transfer-modal-section">
                        <div className="transfer-callout-title">
                          <strong>Team-Auswirkung</strong>
                          <span className="muted">Preview</span>
                        </div>
                        <div className="metric-grid compact transfer-sell-metric-grid">
                          <article className="metric-card">
                            <span>Verkaufspreis</span>
                            <strong>{formatTransfermarktCurrency(marketSellPreview.salePrice)}</strong>
                            {(() => {
                              const saleVsMarketValue =
                                marketSellPreview.salePrice != null && marketSellPreview.marketValueReference != null
                                  ? marketSellPreview.salePrice - marketSellPreview.marketValueReference
                                  : null;
                              return (
                                <small className={saleVsMarketValue != null ? (saleVsMarketValue >= 0 ? "text-positive" : "text-negative") : undefined}>
                                  Faktor {marketSellPreview.saleFactor != null ? `${formatLocalePoints(marketSellPreview.saleFactor, 2)}x` : "—"} · vs. MW{" "}
                                  {saleVsMarketValue != null ? formatSignedTransfermarktCurrency(saleVsMarketValue) : "—"}
                                </small>
                              );
                            })()}
                          </article>
                          <article className="metric-card">
                            <span>Gehaltsentlastung</span>
                            <strong>{formatTransfermarktCurrency(marketSellPreview.salaryReduction)}</strong>
                            <small>Sofort aus Teamgehalt raus</small>
                          </article>
                          <article className="metric-card">
                            <span>Cash</span>
                            <strong>
                              {formatTransfermarktCurrency(marketSellPreview.cashBefore)} → {formatTransfermarktCurrency(marketSellPreview.cashAfter)}
                            </strong>
                          </article>
                          <article className="metric-card">
                            <span>Kader</span>
                            <strong>
                              {marketSellPreview.rosterBefore ?? "—"} → {marketSellPreview.rosterAfter ?? "—"}
                            </strong>
                          </article>
                          <article className="metric-card">
                            <span>Teamgehalt</span>
                            <strong>
                              {formatTransfermarktCurrency(marketSellPreview.teamSalaryBefore)} → {formatTransfermarktCurrency(marketSellPreview.teamSalaryAfter)}
                            </strong>
                          </article>
                          <article className="metric-card">
                            <span>Readiness</span>
                            <strong>{marketSellPreview.projectedReadinessAfterSell ?? "—"}</strong>
                          </article>
                        </div>
                      </div>
                      {marketSellPreview.coaching ? (
                        <div className="transfer-modal-section" data-testid="transfer-sell-coaching-panel">
                          <div className="transfer-callout-title">
                            <strong>Strategie & Board</strong>
                            <span className="muted">{marketSellPreview.coaching.doctrinePersona}</span>
                          </div>
                          <p className="muted">{marketSellPreview.coaching.strategyFitSummary}</p>
                          <div className="metric-grid compact transfer-sell-metric-grid">
                            <article className="metric-card">
                              <span>Auto-Empfehlung</span>
                              <strong>{marketSellPreview.coaching.sellDecisionLabel ?? "—"}</strong>
                              <small>Prioritaet {marketSellPreview.coaching.sellPriority ?? "—"}</small>
                            </article>
                            <article className="metric-card">
                              <span>GM</span>
                              <strong>{marketSellPreview.coaching.gmName ?? "—"}</strong>
                              <small>{marketSellPreview.coaching.gmPressureLevel} · {marketSellPreview.coaching.gmArchetype ?? "—"}</small>
                            </article>
                            <article className="metric-card">
                              <span>Board</span>
                              <strong>{marketSellPreview.coaching.boardReaction.title}</strong>
                              <small>{marketSellPreview.coaching.boardTrustSmiley ?? "—"} · {marketSellPreview.coaching.boardTrustPolicy ?? "—"}</small>
                            </article>
                            <article className="metric-card">
                              <span>Marktsperre</span>
                              <strong>1 Saison</strong>
                              <small>{marketSellPreview.coaching.soldPlayerSeasonBanNote}</small>
                            </article>
                          </div>
                          {marketSellPreview.coaching.gmWarning ? (
                            <div className="transfer-feedback-banner is-warning">
                              <strong>GM-Hinweis</strong>
                              <span>{marketSellPreview.coaching.gmWarning}</span>
                              {marketSellPreview.coaching.gmDetail ? <small className="muted">{marketSellPreview.coaching.gmDetail}</small> : null}
                            </div>
                          ) : null}
                          {marketSellPreview.coaching.replacementSlot ? (
                            <div className="transfer-callout is-warning">
                              <strong>Nachfolger-Slot</strong>
                              <p>{marketSellPreview.coaching.replacementSlot.slotLabel}</p>
                              <small className="muted">
                                Budget bis {formatTransfermarktCurrency(marketSellPreview.coaching.replacementSlot.maxBuyPrice)} ·
                                Ziel-OVR {marketSellPreview.coaching.replacementSlot.minOvrBand ?? "—"}
                              </small>
                            </div>
                          ) : null}
                          <div className="transfer-buy-meta-grid">
                            <div className="transfer-callout">
                              <strong>Gruende fuer Verkauf</strong>
                              {marketSellPreview.coaching.reasonsToSell.length ? (
                                <ul className="warning-list">
                                  {marketSellPreview.coaching.reasonsToSell.map((reason: string) => (
                                    <li key={`sell-${reason}`}>{reason}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="muted">Keine Verkaufsgruende.</p>
                              )}
                            </div>
                            <div className="transfer-callout">
                              <strong>Gruende dagegen</strong>
                              {marketSellPreview.coaching.reasonsToKeep.length ? (
                                <ul className="warning-list">
                                  {marketSellPreview.coaching.reasonsToKeep.map((reason: string) => (
                                    <li key={`keep-${reason}`}>{reason}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="muted">Keine Haltegruende.</p>
                              )}
                            </div>
                          </div>
                          {(marketSellPreview.coaching.boardReaction.requiresStrongAcknowledgment ||
                            marketSellPreview.coaching.gmSoftBlockStarSell) &&
                          (marketSellPreview.coaching.keepIntentScore ?? 0) >= 55 ? (
                            <label className="transfer-sell-risk-ack">
                              <input
                                type="checkbox"
                                checked={marketSellRiskAcknowledged}
                                onChange={(event) => setMarketSellRiskAcknowledged(event.target.checked)}
                              />
                              <span>
                                Ich bestaetige den Verkauf trotz Board-/GM-Warnung (
                                {marketSellPreview.coaching.boardReaction.title})
                              </span>
                            </label>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="transfer-buy-meta-grid">
                        <div className="transfer-callout is-blocked">
                          <div className="transfer-callout-title">
                            <strong>Blocking Reasons</strong>
                            <span className="muted">{marketSellPreview.blockingReasons.length}</span>
                          </div>
                          {marketSellPreview.blockingReasons.length ? (
                            <ul className="warning-list">
                              {marketSellPreview.blockingReasons.map((reason: string) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="muted">Keine blockierenden Gruende.</p>
                          )}
                        </div>
                        <div className="transfer-callout is-warning">
                          <div className="transfer-callout-title">
                            <strong>Warnings</strong>
                            <span className="muted">{marketSellPreview.warnings.length}</span>
                          </div>
                          {marketSellPreview.warnings.length ? (
                            <ul className="warning-list">
                              {marketSellPreview.warnings.map((warning: string) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="muted">Keine Warnungen.</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="muted transfer-empty-hint">
                      Verkaufsvorschau wird geladen oder ist fuer diesen Kontext noch nicht verfuegbar.
                    </p>
                  )}
                </div>

                <div className="foundation-modal-actions">
                  <button className="secondary-button" type="button" onClick={closeMarketSellModal}>
                    Abbrechen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    data-testid="transfer-sell-confirm-button"
                    disabled={
                      readMeta.source === "prisma" ||
                      !marketSellPreview?.canSell ||
                      marketSellBusy ||
                      ((marketSellPreview?.coaching?.boardReaction.requiresStrongAcknowledgment ||
                        (marketSellPreview?.coaching?.gmSoftBlockStarSell &&
                          (marketSellPreview?.coaching?.keepIntentScore ?? 0) >= 55)) &&
                        !marketSellRiskAcknowledged)
                    }
                    title={
                      readMeta.source === "prisma"
                        ? "Im Referenzmodus bleibt der Verkauf gesperrt."
                        : !marketSellPreview?.canSell
                          ? marketSellPreview?.blockingReasons?.[0] ?? "Dieser Verkauf ist gerade noch blockiert."
                          : marketSellBusy
                            ? "Der Verkauf wird gerade vorbereitet."
                            : "Verkauf jetzt final bestätigen."
                    }
                    onClick={() => {
                      void confirmTransfermarktSell();
                    }}
                  >
                    {marketSellBusy ? "Verkauf laeuft..." : "Verkauf bestaetigen"}
                  </button>
                </div>
            </section>
          ) : null}

          <FoundationShellRouterHistoryV2
            active={activeView === "history" || activeView === "historyV2"}
            hostProps={foundationHistoryV2HostProps}
          />

          <div className={`foundation-warning-grid${getViewClass("debug")}`}>
            <WarningList title="Spieler ohne Team" warnings={gameState.mappingReport.unmappedPlayers} />
            <WarningList title="Teams ohne Spieler" warnings={gameState.mappingReport.teamsWithoutPlayers} />
            <WarningList
              title="Mapping ohne Player-Match"
              warnings={gameState.mappingReport.mappingRowsWithoutPlayerMatch}
            />
          </div>

          <section className={`panel${getViewClass("debug")}`}>
            <div className="panel-header">
              <h2>Import- und Mapping-Report</h2>
            </div>
            <div className="source-report">
              <p>
                <strong>Spielerquelle:</strong> {gameState.mappingReport.mappingSource}
              </p>
              <p>
                <strong>Teamquelle:</strong> {gameState.mappingReport.teamSource}
              </p>
              <p>
                <strong>Verarbeitete Mapping-Zeilen:</strong> {gameState.mappingReport.processedMappingRows}
              </p>
              <p>
                <strong>Generiert am:</strong>{" "}
                {new Date(gameState.mappingReport.generatedAt).toLocaleString("de-DE")}
              </p>
            </div>
            <ul className="mapping-highlight-list">
              {gameState.mappingReport.warnings.slice(0, 18).map((warning: MappingWarning, index: number) => (
                <MappingHighlight key={`${warning.type}-${index}`} warning={warning} />
              ))}
            </ul>
          </section>

          <section className={`panel${getViewClass("debug")}`}>
            <div className="panel-header">
              <h2>GameState Debug</h2>
            </div>
            <pre className="debug-json">{JSON.stringify(gameState, null, 2)}</pre>
          </section>

      </div>
      </FoundationShell>
    </main>
    </FoundationSharedProvider>
  )
  );
}
