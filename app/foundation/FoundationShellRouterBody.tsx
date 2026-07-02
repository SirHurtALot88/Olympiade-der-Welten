"use client";
/* eslint-disable */
// AUTO-GENERATED render body extracted from the Foundation page component.
// Contains the real Foundation shell UI (previously the monolith return block).
import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";
import {
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
} from "@/app/foundation/FoundationPageClient";
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
} from "@/app/foundation/FoundationPageClient";

export function FoundationShellRouterBody({
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
  showCompactFlowCoach,
  showCompactHeader,
  showExtendedTeamPanels,
  showFlowCoach,
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
}: FoundationShellRouterBodyProps) {
  const isTeamSettingsViewActive = activeView === "teamSettings";
  return (
    (
    <main className="app-shell foundation-shell foundation-app">
      {bootstrapError || persistenceError || saveSyncError ? (
        <div className="foundation-persistence-banner transfer-callout is-warning" role="status">
          <strong>{bootstrapError ?? persistenceError ?? saveSyncError}</strong>
          {bootstrapError ? (
            <button className="secondary-button inline-button" type="button" onClick={() => window.location.reload()}>
              Neu laden
            </button>
          ) : null}
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
                { id: "lineup", label: activeView === "lineupV2" ? "Einsatzliste v2" : "Einsatzliste" },
                { id: "formBoard", label: "Formplan" },
              ]}
              activeId={lineupDraftBoardViewRequest ?? lineupDraftBoardView}
              onSelect={(id) => {
                const nextView = id === "formBoard" ? "formBoard" : "lineup";
                setLineupDraftBoardView(nextView);
                setLineupDraftBoardViewRequest(null);
                syncFoundationViewInUrl(activeView, nextView === "formBoard" ? "formplan" : "lineup", null, { push: true });
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
                { id: "reports", label: "Reports" },
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
              ]}
              activeId={selectedTeamDetailTab}
              onSelect={(id) => setSelectedTeamDetailTab(id as "roster" | "contracts" | "portraits")}
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
            {activeFlowCoach.terms.map((term) => (
              <GameTerm key={`flow-term-${activeView}-${term}`} term={term} />
            ))}
          </div>
          <div className="foundation-flow-coach-actions" aria-label="Direkte Flow-Aktionen">
            {activeFlowCoach.actions.map((action) => (
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
          {foundationFlowLoopStages.map((stage, index) => (
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
              {activeFlowCoach.terms.map((term) => (
                <GameTerm key={`compact-flow-term-${activeView}-${term}`} term={term} />
              ))}
            </div>
            <div className="foundation-flow-coach-actions" aria-label="Direkte Flow-Aktionen">
              {activeFlowCoach.actions.map((action) => (
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
            {foundationFlowLoopStages.map((stage, index) => (
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
              {visibleFoundationCommandItems.map((command) => (
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
                    <p className="muted">Alle Diszi-Paare der Season — Farb-Dopplungen sind markiert.</p>
                  </div>
                </div>
                <div className="season-briefing-matchday-grid">
                  {seasonBriefingScheduleReady ? (
                    seasonBriefingData.firstMatchdays.map((entry) => (
                      <article key={`season-briefing-md-${entry.matchdayId}`} className={joinClassNames("season-briefing-matchday", entry.sameColor && "has-same-color")}>
                        <span className="eyebrow">{entry.label}</span>
                        <div className="season-briefing-discipline-row">
                          {entry.disciplines.map((discipline) => (
                            <span
                              key={`season-briefing-md-${entry.matchdayId}-${discipline.name}`}
                              className={`season-briefing-discipline-chip is-${discipline.color}`}
                            >
                              <b>{discipline.name}</b>
                              <small>{discipline.playerCount ?? "—"} Slots · {formatDisciplineCategoryLabel(discipline.category)}</small>
                            </span>
                          ))}
                        </div>
                        {entry.sameColor ? <small className="text-warning">Farb-Dopplung: gleiche Kategorie am selben Spieltag</small> : null}
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
                      seasonBriefingData.bigDisciplines.map((slot) => (
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
                      {seasonBriefingData.sameColorMatchdays.map((entry) => (
                        <span key={`season-briefing-double-${entry.matchdayId}`} className="season-briefing-warning-chip">
                          <b>{entry.label}</b>
                          <small>{entry.disciplines.map((discipline) => discipline.name).join(" / ")}</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">In dieser Season keine gleiche Farbe doppelt am selben Spieltag. Breiter Kader wird etwas entspannter.</p>
                  )}
                  <div className="season-briefing-factor-row">
                    {seasonBriefingData.futureFactors.map((entry) => (
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
            <>
          <span className="eyebrow">Spielstand</span>
          <strong>{isSaveBusy ? "Save-Wechsel lädt..." : activeSaveName}</strong>
          <span className="muted">
            {gameState.season.name} · Spieltag {activeContextMeta?.activeMatchday ?? gameState.season.currentMatchday} ·{" "}
            {formatGamePhaseLabel(activeContextMeta?.gamePhase ?? gameState.gamePhase)}
          </span>
            </>
          ) : (
            <>
              <span className="eyebrow">Team</span>
              <strong>{selectedTeam?.name ?? "Kein Team"}</strong>
              <span className="muted">
                {gameState.season.name} · {currentMatchdayDisplayLabel}
              </span>
            </>
          )}
        </div>
        {roomContext ? (
          <div className="foundation-ai-preseason-banner is-ready" data-testid="foundation-room-context-banner">
            <div className="foundation-ai-preseason-copy">
              <span className="eyebrow">Multiplayer-Room</span>
              <strong>Raum {roomContext.roomCode}</strong>
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
                {managerTeamOptions.map((team) => (
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
                  {teamOwners.map((owner) => (
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
                    .filter((owner) => owner.ownerId !== "ai")
                    .map((owner) => (
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
              {ownerQuickSwitchTeams.slice(0, 8).map((team) => (
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
          <span className={`pill foundation-source-pill${readMeta.readOnly ? " is-readonly" : ""}`}>{activeViewSourceBadge}</span>
          {activeContextStatusChips.map((chip) => (
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

      {activeView === "homeV2" && foundationWarningInboxItems.length > 0 ? (
        <section className="foundation-warning-inbox" aria-label="Offene Hinweise">
          <div className="foundation-warning-inbox-summary">
            <span className="eyebrow">Hinweise</span>
            <strong>{foundationWarningInboxItems.length} offen</strong>
          </div>
          <div className="foundation-warning-inbox-list">
            {foundationWarningInboxItems.map((item) => (
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
                        {selectedEncyclopediaEntry.factors.map((factor) => (
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
                    {selectedEncyclopediaEntry.aliases.slice(0, 8).map((alias) => (
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

          <section className={`panel foundation-training-compact-panel${activeView === "trainingCompact" ? " is-active" : ""}`}>
            {activeView === "trainingCompact" && selectedTeam ? (
              <TrainingCompactClient
                selectedTeam={selectedTeam}
                selectedTeamControlMode={formatTeamControlModeLabel(selectedTeamControl?.controlMode)}
                seasonLabel={canonicalSeasonLabel}
                managementLocked={isSelectedTeamManagementLocked}
                managementLockedReason={
                  isSelectedTeamManagementLocked
                    ? `${selectedTeam.name} gehoert nicht zu deinen steuerbaren Teams. Training ist nur zur Ansicht offen.`
                    : null
                }
                summary={{
                  recoveryBeforeTraining: trainingForecastSummary.recoveryBeforeTraining,
                  recoveryAfterTraining: trainingForecastSummary.recoveryAfterTraining,
                  performanceXp: trainingForecastSummary.performanceXp,
                  totalXp: trainingForecastSummary.totalXp,
                  lightModeCount: trainingForecastSummary.lightModeCount,
                  hardModeCount: trainingForecastSummary.hardModeCount,
                  trainingXpAfter: trainingFacilityEffectPreview.trainingXp.after,
                  trainingXpModifierPct: trainingFacilityEffectPreview.trainingXp.modifierPct,
                }}
                developmentFilter={trainingDevelopmentFilter}
                developmentSummary={trainingDevelopmentSummary}
                onSetDevelopmentFilter={setTrainingDevelopmentFilter}
                trainingModeOptions={trainingV2ModeOptions}
                trainingClassOptions={PROGRESSION_CLASS_ORDER.map((className) => ({ value: className, label: className }))}
                playerRows={trainingPlayerRowViews}
                allPlayerCount={trainingPlayerForecastRows.length}
                onSetTrainingMode={(playerId, mode) => {
                  void setPlayerTrainingMode(playerId, mode);
                }}
                onSetTrainingClass={(playerId, trainingClass) => {
                  void setPlayerTrainingClass(playerId, trainingClass);
                }}
                onOpenPlayerDetails={(payload) => openPlayerDrawerById(payload.playerId, payload.activePlayerId)}
                onOpenFacilities={() => setFoundationView("trainingV2", setActiveView)}
                onOpenTeams={() => setFoundationView("teams", setActiveView)}
              />
            ) : null}
          </section>

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
                        occupiedSlots: selectedTeamScoutPipeline.occupiedSlots,
                        maxSlots: selectedTeamScoutPipeline.config.maxSlots,
                        tickGain: selectedTeamScoutPipeline.config.tickGain,
                        passiveActive: selectedTeamScoutPipeline.passiveActive,
                        draftSuspended: isTeamSetupDraftWishlistPhase(gameState, selectedTeam.teamId),
                        records: selectedTeamScoutPipeline.records.map((record) => {
                          const player = gameState.players.find((entry) => entry.id === record.playerId);
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
                onOpenPlayer={(playerId) => openPlayerProfileById(playerId)}
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
                  const selected = inboxV2Items.find((item) => item.id === (inboxV2SelectedItemId ?? inboxV2Items[0]?.id));
                  const sourceItem = visibleInboxItems.find((item) => item.itemId === selected?.id);
                  if (sourceItem) {
                    navigateToInboxItem(sourceItem);
                  }
                }}
                onMarkDone={(itemId) => {
                  const sourceItem = visibleInboxItems.find((item) => item.itemId === itemId);
                  if (sourceItem) {
                    updateInboxItemStatus(sourceItem, "done");
                  }
                }}
                onDismiss={(itemId) => {
                  const sourceItem = visibleInboxItems.find((item) => item.itemId === itemId);
                  if (sourceItem) {
                    updateInboxItemStatus(sourceItem, "dismissed");
                  }
                }}
              />
            ) : null}
          </section>



	          <section className={`panel${getViewClass("teamSettings")}`} id="foundation-team-settings">
            <div className="panel-header">
              <h2>Team Settings</h2>
            </div>
            <div className="room-meta foundation-admin-meta">
              <span className="pill">{canonicalSeasonLabel}</span>
              <span className="pill">Save {activeSaveName}</span>
              <span className="pill">Scenario {formatScenarioTypeLabel(activeSaveSummary?.scenarioMeta?.scenarioType ?? gameState.scenarioMeta?.scenarioType)}</span>
              <span className={`pill foundation-source-pill${readMeta.readOnly ? " is-readonly" : ""}`}>Spielstand: {readSourceLabel}</span>
              <span className="pill">Matchday {gameState.season.currentMatchday}</span>
              <span className="pill">Teams {gameState.teams.length}</span>
              <span className="pill">Spieler {gameState.players.length}</span>
              <span className="pill">Roster {gameState.rosters.length}</span>
            </div>
            <div className="foundation-team-settings-hero">
              <article className="foundation-team-settings-lead">
                <span className="foundation-kicker">Control Room</span>
                <strong>Spielmodus, Team-Zuordnung und AI-Automation.</strong>
                <p className="muted">
                  Der Spielmodus ist die einzige Wahrheit fuer Ownership. Solo = 1 Team, Online 4v4 = 4+4 Teams, Rest AI.
                </p>
                <div className="room-meta foundation-admin-meta">
                  <span className={`pill${selectedTeamHasUnsavedChanges ? " warning-pill" : " success-pill"}`}>
                    {selectedTeamHasUnsavedChanges ? "Aenderungen offen" : "Alles synchron"}
                  </span>
                  <span className="pill">Aktiv {selectedTeam?.shortCode ?? "—"}</span>
                  <span className="pill">GM {selectedTeamGeneralManager?.profile.name ?? "—"}</span>
                  <span className="pill">Steuerung {formatTeamControlModeLabel(selectedTeamControl?.controlMode)}</span>
                </div>
                <div className="foundation-save-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => document.getElementById("foundation-team-settings-saves")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    Saves & Start
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => document.getElementById("foundation-team-settings-team-selection")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    Team-Fokus
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => document.getElementById("foundation-team-settings-controls")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    Team-KI
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => document.getElementById("foundation-admin")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    Admin
                  </button>
                </div>
              </article>
              <div className="foundation-team-settings-overview">
                <article className="metric-card">
                  <span>Aktiver Save</span>
                  <strong>{activeSaveName}</strong>
                  <small>{formatFoundationSaveModeLabel(foundationSaveMode)}</small>
                </article>
                <article className="metric-card">
                  <span>Saves im Bereich</span>
                  <strong>{saveSummaries.length}</strong>
                  <small>{activeSaveIsInCurrentMode ? "aktiver Save sichtbar" : "aktiver Save ausserhalb"}</small>
                </article>
                <article className="metric-card">
                  <span>Steuerung</span>
                  <strong>{manualTeams.length}/{aiTeams.length}/{passiveTeams.length}</strong>
                  <small>Manual · AI · Passive</small>
                </article>
                <article className="metric-card">
                  <span>Aktives Team</span>
                  <strong>{selectedTeam?.shortCode ?? "—"}</strong>
                  <small>{selectedStandingRow?.rank != null ? `Rang #${selectedStandingRow.rank}` : "noch ohne Rang"}</small>
                </article>
              </div>
            </div>
            <div className="foundation-main-grid">
              <section className="panel" id="foundation-team-settings-saves">
                <div className="panel-header">
                  <h2>Spielstaende</h2>
                </div>
                <div className="stack">
                  <article className="metric-card">
                    <span>Aktiv</span>
                    <strong>{activeSaveName}</strong>
                    <small className="muted">
                      {activeSaveSummary ? `Update ${new Date(activeSaveSummary.updatedAt).toLocaleString("de-DE")}` : activeSaveId}
                    </small>
                    <small className="muted">
                      <span data-testid="foundation-active-save-id">{formatShortSaveId(activeSaveId)}</span> · {formatScenarioTypeLabel(activeSaveSummary?.scenarioMeta?.scenarioType ?? gameState.scenarioMeta?.scenarioType)}
                    </small>
                    <small className="muted">
                      {activeSaveSummary?.scenarioMeta?.activeSeasonId ?? gameState.scenarioMeta?.activeSeasonId ?? gameState.season.id} ·{" "}
                      {activeSaveSummary?.scenarioMeta?.gamePhase ?? gameState.scenarioMeta?.gamePhase ?? gameState.gamePhase ?? "season_active"} ·{" "}
                      MD {activeSaveSummary?.scenarioMeta?.activeMatchday ?? gameState.scenarioMeta?.activeMatchday ?? gameState.season.currentMatchday}
                    </small>
                    <small className={`foundation-read-status${readMeta.readOnly ? " is-readonly" : ""}`}>
                      Spielstand: {readSourceLabel}
                    </small>
                  </article>
                  {activeScenarioWarning ? (
                    <div className="transfer-callout is-warning">
                      <strong>Save-Hinweis</strong>
                      <span>{activeScenarioWarning}</span>
                    </div>
                  ) : null}

                  <label className="filter-field">
                    <span>Save-Bereich</span>
                    <select
                      className="input"
                      data-testid="foundation-save-mode-select"
                      value={foundationSaveMode}
                      disabled={isSaveBusy || readMeta.readOnly}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("den Save-Bereich")
                          : isSaveBusy
                            ? getBusyActionReason("Der Save-Wechsel")
                            : "Waehlt, in welchem Bereich lokale Spielstaende angezeigt und gesteuert werden."
                      }
                      onChange={(event) => changeFoundationSaveMode(normalizeFoundationSaveMode(event.target.value))}
                    >
                      {FOUNDATION_SAVE_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <span>Aktiven Save wechseln</span>
                    <select
                      className="input"
                      data-testid="foundation-save-switch-select"
                      value={activeSaveIsInCurrentMode ? activeSaveId : ""}
                      disabled={isSaveBusy || readMeta.readOnly || saveSummaries.length === 0}
                      title={
                        saveSummaries.length === 0
                          ? "In diesem Save-Bereich gibt es gerade keine Spielstaende."
                          : readMeta.readOnly
                            ? getReadOnlyActionReason("den aktiven Spielstand")
                            : isSaveBusy
                              ? getBusyActionReason("Der Save-Wechsel")
                              : "Waehlt den lokalen Spielstand, mit dem du weiterarbeitest."
                      }
                      onChange={(event) => {
                        const nextSaveId = event.target.value;
                        if (!nextSaveId) {
                          return;
                        }
                        void runSaveAction({ action: "activate", saveId: nextSaveId });
                      }}
                    >
                      {!activeSaveIsInCurrentMode ? (
                        <option value="" disabled>
                          Kein Save in diesem Bereich
                        </option>
                      ) : null}
                      {saveSummaries.map((save) => (
                        <option key={save.saveId} value={save.saveId}>
                          {save.name} · {formatFoundationSaveModeLabel(save.saveMode ?? resolveFoundationSaveMode(save))} ({save.status})
                        </option>
                      ))}
                    </select>
                  </label>

                  <section className="panel" data-testid="new-game-setup-wizard">
                    <div className="panel-header">
                      <h3>Neues Spiel starten</h3>
                      <span className="pill">Baseline · Startbudget · Ownership</span>
                    </div>
                    <p className="muted">
                      Erst pruefen, dann erstellen. Der aktuelle Save bleibt erhalten; beim Confirm wird ein neuer lokaler Save aktiv.
                    </p>
                    <div className="filter-grid">
                      <label className="filter-field">
                        <span>Spielmodus</span>
                        <select
                          className="input"
                          value={newGamePresetId}
                          disabled={newGameBusy || readMeta.readOnly}
                          title={
                            readMeta.readOnly
                              ? getReadOnlyActionReason("den Spielmodus")
                              : newGameBusy
                                ? getBusyActionReason("Das New-Game-Setup")
                                : "Waehlt das Basissetup fuer das neue Spiel."
                          }
                          onChange={(event) => applyNewGamePreset(event.target.value as NewGamePresetId)}
                        >
                          {NEW_GAME_VISIBLE_PRESET_IDS.map((presetId) => (
                            <option key={presetId} value={presetId}>
                              {NEW_GAME_PRESET_DEFAULTS[presetId].label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="filter-field">
                        <span>Save-Name</span>
                        <input
                          className="input"
                          value={newGameSaveName}
                          disabled={newGameBusy || readMeta.readOnly}
                          title={
                            readMeta.readOnly
                              ? getReadOnlyActionReason("den Save-Namen")
                              : newGameBusy
                                ? getBusyActionReason("Das New-Game-Setup")
                                : "Optionaler Name fuer den neuen lokalen Spielstand."
                          }
                          placeholder="Optional, sonst automatisch"
                          onChange={(event) => {
                            setNewGameSaveName(event.target.value);
                            setNewGamePreview(null);
                          }}
                        />
                      </label>
                      <label className="filter-field checkbox-field">
                        <input
                          type="checkbox"
                          checked={newGameSandbox}
                          disabled={newGameBusy || readMeta.readOnly}
                          title={
                            readMeta.readOnly
                              ? getReadOnlyActionReason("die Sandbox-Markierung")
                              : newGameBusy
                                ? getBusyActionReason("Das New-Game-Setup")
                                : "Markiert den neuen Save klar als Test- oder Sandbox-Stand."
                          }
                          onChange={(event) => {
                            setNewGameSandbox(event.target.checked);
                            setNewGamePreview(null);
                          }}
                        />
                        <span>als Sandbox/Testsave markieren</span>
                      </label>
                    </div>

                    {newGamePresetId === "solo_1" ? (
                      <label className="filter-field" data-testid="new-game-solo-team-select">
                        <span>Dein Team</span>
                        <select
                          className="input"
                          disabled={newGameBusy || readMeta.readOnly}
                          value={newGameChrisTeamIds[0] ?? ""}
                          title={
                            readMeta.readOnly
                              ? getReadOnlyActionReason("die Team-Zuordnung")
                              : newGameBusy
                                ? getBusyActionReason("Das New-Game-Setup")
                                : "Waehle genau 1 Team fuer den Solo-Spielstand."
                          }
                          onChange={(event) => {
                            if (event.target.value) {
                              setNewGameSoloTeam(event.target.value);
                            }
                          }}
                        >
                          <option value="" disabled>
                            Team waehlen
                          </option>
                          {[...gameState.teams]
                            .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
                            .map((team) => (
                              <option key={`new-game-solo-${team.teamId}`} value={team.teamId}>
                                {team.name} ({team.shortCode}) · Budget {formatMoney(team.budget)}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : (
                      <>
                        <div className="metric-grid compact">
                          <article className="metric-card">
                            <span>Chris</span>
                            <strong>{newGameChrisTeamIds.length}/4</strong>
                            <small>{newGameChrisTeamIds.join(" · ") || "kein Team"}</small>
                          </article>
                          <article className="metric-card">
                            <span>Franky</span>
                            <strong>{newGameFrankyTeamIds.length}/4</strong>
                            <small>{newGameFrankyTeamIds.join(" · ") || "kein Team"}</small>
                          </article>
                          <article className="metric-card">
                            <span>Rest</span>
                            <strong>{Math.max(0, gameState.teams.length - newGameChrisTeamIds.length - newGameFrankyTeamIds.length)}</strong>
                            <small>Auto-Teams</small>
                          </article>
                        </div>

                        <div className="team-chip-grid" data-testid="new-game-ownership-picker">
                          {[...gameState.teams]
                            .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
                            .map((team) => {
                              const isChris = newGameChrisTeamIds.includes(team.teamId);
                              const isFranky = newGameFrankyTeamIds.includes(team.teamId);
                              return (
                                <div
                                  key={`new-game-team-${team.teamId}`}
                                  className={`team-settings-team-card${isChris ? " is-owned-by-user" : ""}${isFranky ? " is-owned-by-remote" : ""}`}
                                  onClick={() => openTeamProfileById(team.teamId)}
                                  title="Teamprofil öffnen"
                                >
                                  <strong>{team.shortCode}</strong>
                                  <span>{team.name}</span>
                                  <small>Budget {formatMoney(team.budget)}</small>
                                  <div className="foundation-save-actions save-summary-actions">
                                    <button
                                      className={isChris ? "primary-button inline-button" : "secondary-button inline-button"}
                                      type="button"
                                      disabled={newGameBusy || readMeta.readOnly || isFranky}
                                      title={
                                        isFranky
                                          ? "Dieses Team ist bereits Franky zugeordnet."
                                          : readMeta.readOnly
                                            ? getReadOnlyActionReason("die Team-Zuordnung")
                                            : newGameBusy
                                              ? getBusyActionReason("Das New-Game-Setup")
                                              : "Ordnet dieses Team Chris/User fuer den neuen Spielstand zu."
                                      }
                                      onClick={() => toggleNewGameTeam("chris", team.teamId)}
                                    >
                                      Chris
                                    </button>
                                    <button
                                      className={isFranky ? "primary-button inline-button" : "secondary-button inline-button"}
                                      type="button"
                                      disabled={newGameBusy || readMeta.readOnly || isChris}
                                      title={
                                        isChris
                                          ? "Dieses Team ist bereits Chris/User zugeordnet."
                                          : readMeta.readOnly
                                            ? getReadOnlyActionReason("die Team-Zuordnung")
                                            : newGameBusy
                                              ? getBusyActionReason("Das New-Game-Setup")
                                              : "Ordnet dieses Team Franky fuer den neuen Spielstand zu."
                                      }
                                      onClick={() => toggleNewGameTeam("franky", team.teamId)}
                                    >
                                      Franky
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </>
                    )}

                    <div className="foundation-save-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={newGameBusy || readMeta.readOnly}
                        title={
                          readMeta.readOnly
                            ? getReadOnlyActionReason("das New-Game-Setup")
                            : newGameBusy
                              ? getBusyActionReason("Das New-Game-Setup")
                              : "Prueft Baseline, Ownership und Season-Setup, bevor der neue Spielstand gebaut wird."
                        }
                        onClick={() => void runNewGameSetup(true)}
                      >
                        {newGameBusy ? "Prueft..." : "Setup pruefen"}
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          newGameBusy ||
                          readMeta.readOnly ||
                          !newGamePreview ||
                          newGamePreview.blockers.length > 0
                        }
                        title={
                          readMeta.readOnly
                            ? getReadOnlyActionReason("ein neues Spiel")
                            : newGameBusy
                              ? getBusyActionReason("Das New-Game-Setup")
                              : !newGamePreview
                                ? "Bitte zuerst das Setup pruefen."
                                : newGamePreview.blockers.length > 0
                                  ? `Noch offen: ${newGamePreview.blockers.map((reason) => formatCockpitReason(reason)).join(" · ")}`
                                  : "Erstellt den neuen lokalen Spielstand mit dem geprueften Setup."
                        }
                        onClick={() => void runNewGameSetup(false)}
                      >
                        Neues Spiel erstellen
                      </button>
                    </div>

                    {newGameError ? <p className="text-negative">{newGameError}</p> : null}
                    {newGameSuccess ? <p className="text-positive">{newGameSuccess}</p> : null}
                    {newGamePreview ? (
                      <section className="panel">
                        <div className="panel-header">
                          <h3>New-Game Preview</h3>
                          <span className={newGamePreview.blockers.length > 0 ? "transfer-status-pill is-danger" : "transfer-status-pill is-ready"}>
                            {newGamePreview.blockers.length > 0 ? "blockiert" : "ready"}
                          </span>
                        </div>
                        <div className="metric-grid compact">
                          <article className="metric-card">
                            <span>Baseline</span>
                            <strong>{newGamePreview.baseline.baselineCount}/{newGamePreview.baseline.playerCount}</strong>
                            <small>Spieler werden auf Ursprung gesetzt</small>
                          </article>
                          <article className="metric-card">
                            <span>Season</span>
                            <strong>{newGamePreview.seasonSetup.seasonId}</strong>
                            <small>{newGamePreview.seasonSetup.matchdayCount} Spieltage · Matchday {newGamePreview.seasonSetup.currentMatchday}</small>
                          </article>
                          <article className="metric-card">
                            <span>Ownership</span>
                            <strong>{newGamePreview.counts.chris}+{newGamePreview.counts.franky}+{newGamePreview.counts.ai}</strong>
                            <small>Chris · Franky · AI</small>
                          </article>
                          <article className="metric-card">
                            <span>Room</span>
                            <strong>{newGamePreview.room.enabled ? "Online vorbereitet" : "Solo"}</strong>
                            <small>{newGamePreview.room.enabled ? "Code beim Erstellen" : "kein Room"}</small>
                          </article>
                        </div>
                        <div className="table-shell">
                          <table className="data-table compact-table">
                            <thead>
                              <tr>
                                <th>StartRank</th>
                                <th>Team</th>
                                <th>Budget</th>
                                <th>Owner</th>
                                <th>Mode</th>
                              </tr>
                            </thead>
                            <tbody>
                              {newGamePreview.teams
                                .filter((team) => team.ownerLabel !== "AI" || team.startRank <= 5 || team.teamId === "R-R")
                                .sort((a, b) => a.startRank - b.startRank)
                                .map((team) => (
                                  <tr key={`new-game-preview-${team.teamId}`} onClick={() => openTeamProfileById(team.teamId)}>
                                    <td>{team.startRank}</td>
                                    <td>{team.shortCode} · {team.name}</td>
                                    <td>{formatMoney(team.budget)}</td>
                                    <td>{team.ownerLabel}</td>
                                    <td>{formatTeamControlModeLabel(team.controlMode)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        {newGamePreview.warnings.length > 0 ? (
                          <p className="muted">Hinweise: {newGamePreview.warnings.join(" · ")}</p>
                        ) : null}
                        {newGamePreview.blockers.length > 0 ? (
                          <p className="text-negative">Blocker: {newGamePreview.blockers.join(" · ")}</p>
                        ) : null}
                      </section>
                    ) : null}
                  </section>

                  <div className="foundation-save-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isSaveBusy || readMeta.readOnly}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("einen neuen Save")
                          : isSaveBusy
                            ? getBusyActionReason("Die Save-Aktion")
                            : "Erstellt einen neuen lokalen Spielstand auf Basis des aktuellen Zustands."
                      }
                      onClick={() => {
                        const name = `Save ${new Date().toLocaleString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`;
                        void runSaveAction({ action: "create", name });
                      }}
                    >
                      Neuer Save
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={isSaveBusy || readMeta.readOnly}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("ein neues Spiel")
                          : isSaveBusy
                            ? getBusyActionReason("Die Save-Aktion")
                            : "Startet einen frischen Season-1-Spielstand, ohne bestehende Saves zu loeschen."
                      }
                      onClick={() => {
                        const confirmed = window.confirm(
                          "Erstellt einen neuen lokalen Testspielstand fuer Season 1. Bestehende Saves bleiben erhalten.",
                        );
                        if (!confirmed) {
                          return;
                        }

                        setFreshSeasonStartMessage(null);
                        void runSaveAction({
                          action: "fresh-season-1",
                          name: `Fresh Season 1 ${new Date().toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`,
                        });
                      }}
                    >
                      Neues Spiel / Season 1 starten
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isSaveBusy || readMeta.readOnly}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("den aktiven Save")
                          : isSaveBusy
                            ? getBusyActionReason("Die Save-Aktion")
                            : "Dupliziert den aktuellen Spielstand als sichere Arbeitskopie."
                      }
                      onClick={() => {
                        void runSaveAction({ action: "clone", sourceSaveId: activeSaveId, name: `${activeSaveName} Kopie` });
                      }}
                    >
                      Save duplizieren
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={seasonStartResetBusy || readMeta.readOnly}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("den Season-Start-Reset")
                          : seasonStartResetBusy
                            ? getBusyActionReason("Der Season-Start-Reset")
                            : "Prueft, wie der aktuelle Save auf den Season-Start zurueckgesetzt wuerde."
                      }
                      onClick={() => {
                        void runSeasonStartReset(false);
                      }}
                    >
                      {seasonStartResetBusy ? "Laedt..." : "Season-Start-Reset pruefen"}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={seasonStartResetBusy || readMeta.readOnly || !seasonStartResetFeed || !seasonStartResetFeed.dryRun}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("den Season-Start-Reset")
                          : seasonStartResetBusy
                            ? getBusyActionReason("Der Season-Start-Reset")
                            : !seasonStartResetFeed || !seasonStartResetFeed.dryRun
                              ? "Bitte zuerst den Reset trocken pruefen."
                              : "Setzt den aktuellen lokalen Save hart auf den Season-Start zurueck."
                      }
                      onClick={() => {
                        if (!seasonStartResetFeed) {
                          return;
                        }
                        const confirmed = window.confirm(
                          `Aktuellen Save jetzt hart auf Season-Start zuruecksetzen? ${seasonStartResetFeed.summary.currentTransfers} Transfers, ${seasonStartResetFeed.summary.currentRosterEntries} Roster-Eintraege und gespeicherte Spieltagsdaten werden entfernt.`,
                        );
                        if (!confirmed) {
                          return;
                        }
                        void runSeasonStartReset(true);
                      }}
                    >
                      Season-Start-Reset ausfuehren
                    </button>
                  </div>

                  {freshSeasonStartMessage ? <p className="text-positive">{freshSeasonStartMessage}</p> : null}
                  {seasonStartResetFeed ? (
                    <section className="panel">
                      <div className="panel-header">
                        <h3>Season-Start-Reset</h3>
                        <span className={getCockpitStatusPillClass(seasonStartResetFeed.status)}>
                          {getCockpitStatusLabel(seasonStartResetFeed.status)}
                        </span>
                      </div>
                      <p className="muted">
                        Save {seasonStartResetFeed.saveContext.saveName ?? activeSaveName} ·{" "}
                        {seasonStartResetFeed.saveContext.resolvedSeasonId ?? gameState.season.id}
                      </p>
                      <div className="metric-grid compact">
                        <article className="metric-card">
                          <span>Transfers</span>
                          <strong>{seasonStartResetFeed.summary.currentTransfers} → {seasonStartResetFeed.summary.resetTransfers}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Roster</span>
                          <strong>{seasonStartResetFeed.summary.currentRosterEntries} → {seasonStartResetFeed.summary.resetRosterEntries}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Stored Results</span>
                          <strong>{seasonStartResetFeed.summary.currentMatchdayResults} → {seasonStartResetFeed.summary.resetMatchdayResults}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Lineups</span>
                          <strong>{seasonStartResetFeed.summary.currentStoredLineups} → {seasonStartResetFeed.summary.resetStoredLineups}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Start-Cash Quelle</span>
                          <strong>{seasonStartResetFeed.summary.startCashSource === "reference" ? "Referenz" : "Fresh Seed"}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Cash-Zeilen</span>
                          <strong>{seasonStartResetFeed.summary.startCashRowsApplied}</strong>
                        </article>
                      </div>
                      {seasonStartResetFeed.saveContext.scopeWarning ? (
                        <p className="text-negative">{seasonStartResetFeed.saveContext.scopeWarning}</p>
                      ) : null}
                      {seasonStartResetFeed.warnings.length > 0 ? (
                        <p className="muted">Warnings: {seasonStartResetFeed.warnings.join(" · ")}</p>
                      ) : null}
                      {seasonStartResetFeed.blockingReasons.length > 0 ? (
                        <p className="text-negative">Blocker: {seasonStartResetFeed.blockingReasons.join(" · ")}</p>
                      ) : null}
                      <div className="table-shell">
                        <table className="data-table compact-table">
                          <thead>
                            <tr>
                              <th>Team</th>
                              <th>Cash jetzt</th>
                              <th>Cash Reset</th>
                              <th>Roster jetzt</th>
                              <th>Roster Reset</th>
                              <th>Transfers</th>
                            </tr>
                          </thead>
                          <tbody>
                            {seasonStartResetFeed.teams.map((team) => (
                              <tr key={`season-start-reset-${team.teamId}`} onClick={() => openTeamProfileById(team.teamId)}>
                                <td>{team.teamCode} · {team.teamName}</td>
                                <td>{formatTransfermarktCurrency(team.currentCash)}</td>
                                <td>{formatTransfermarktCurrency(team.resetCash)}</td>
                                <td>{team.currentRosterCount}</td>
                                <td>{team.resetRosterCount}</td>
                                <td>{team.currentTransferCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}

                  <div className="save-summary-list">
                    {saveSummaries.length === 0 ? (
                      <div className="transfer-callout">
                        <strong>Keine Spielstaende in diesem Bereich</strong>
                        <span>Wechsle den Save-Bereich oder starte ein neues Spiel in diesem Modus.</span>
                      </div>
                    ) : null}
                    {saveSummaries.map((save) => {
                      const meta = save.scenarioMeta;
                      const warning = buildScenarioWarning(meta);
                      const resolvedSaveMode = save.saveMode ?? resolveFoundationSaveMode(save);
                      return (
                        <article
                          key={save.saveId}
                          className={`save-summary-card${save.saveId === activeSaveId ? " is-active" : ""}`}
                        >
                          <div className="save-summary-card-head">
                            <strong>{save.name}</strong>
                            <span className="pill">{formatScenarioTypeLabel(meta?.scenarioType)}</span>
                          </div>
                          <span className="muted">
                            {formatShortSaveId(save.saveId)} · {formatFoundationSaveModeLabel(resolvedSaveMode)} · {save.status}
                          </span>
                          <span className="muted">
                            {meta?.activeSeasonId ?? "—"} · {meta?.gamePhase ?? "—"} · MD {meta?.activeMatchday ?? "—"}
                          </span>
                          <span className="muted">Update {new Date(save.updatedAt).toLocaleString("de-DE")}</span>
                          <div className="save-summary-flags">
                            <span className={`transfer-status-pill${meta?.containsFinalStandings ? " is-ready" : " is-warning"}`}>
                              S1-Endstand {meta?.containsFinalStandings ? "ja" : "nein"}
                            </span>
                            <span className={`transfer-status-pill${meta?.scenarioType === "season2_start" ? " is-ready" : ""}`}>
                              S2-Start {meta?.scenarioType === "season2_start" ? "ja" : "nein"}
                            </span>
                            {meta?.isStableTestPoint ? <span className="transfer-status-pill is-ready">Stable Testpoint</span> : null}
                            {meta?.scenarioType === "sandbox_multiseason_test" ? (
                              <span className="transfer-status-pill is-warning">Sandbox</span>
                            ) : null}
                            {meta?.allowTestWrites ? (
                              <span className="transfer-status-pill is-warning">Test Writes erlaubt</span>
                            ) : null}
                          </div>
                          {warning ? <span className="muted">{warning}</span> : null}
                          <div className="foundation-save-actions save-summary-actions">
                            <button
                              className="secondary-button inline-button"
                              type="button"
                              disabled={isSaveBusy || readMeta.readOnly || save.saveId === activeSaveId}
                              title={
                                save.saveId === activeSaveId
                                  ? "Dieser Save ist bereits aktiv."
                                  : readMeta.readOnly
                                    ? getReadOnlyActionReason("den aktiven Save")
                                    : isSaveBusy
                                      ? getBusyActionReason("Die Save-Aktion")
                                      : "Macht diesen lokalen Save zum aktiven Arbeitsstand."
                              }
                              onClick={() => void runSaveAction({ action: "activate", saveId: save.saveId })}
                            >
                              Als aktiv setzen
                            </button>
                            <button
                              className="secondary-button inline-button"
                              type="button"
                              disabled={isSaveBusy || readMeta.readOnly}
                              title={
                                readMeta.readOnly
                                  ? getReadOnlyActionReason("diesen Save")
                                  : isSaveBusy
                                    ? getBusyActionReason("Die Save-Aktion")
                                    : "Erstellt eine Kopie dieses Spielstands."
                              }
                              onClick={() => void runSaveAction({ action: "clone", sourceSaveId: save.saveId, name: `${save.name} Kopie` })}
                            >
                              Klonen
                            </button>
                            <button
                              className="secondary-button inline-button"
                              type="button"
                              disabled={isSaveBusy || readMeta.readOnly}
                              title={
                                readMeta.readOnly
                                  ? getReadOnlyActionReason("einen Snapshot")
                                  : isSaveBusy
                                    ? getBusyActionReason("Die Save-Aktion")
                                    : "Erstellt einen fest eingefrorenen Snapshot dieses Spielstands."
                              }
                              onClick={() => void runSaveAction({ action: "snapshot", sourceSaveId: save.saveId, name: `${save.name} Snapshot` })}
                            >
                              Snapshot erstellen
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Importstatus</h2>
                </div>
                <div className="metric-grid">
                  <article className="metric-card">
                    <span>Spieler</span>
                    <strong>{gameState.mappingReport.importedPlayerCount}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Teams</span>
                    <strong>{gameState.mappingReport.teamCount}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Gemappt</span>
                    <strong>{gameState.mappingReport.matchedRosterCount}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Warnungen</span>
                    <strong>{gameState.mappingReport.warnings.length}</strong>
                  </article>
                </div>
              </section>

              <section className="panel foundation-wide foundation-team-settings-focus-panel">
                <div className="panel-header">
                  <div className="stack">
                    <h2>Aktives Team</h2>
                    <p className="muted">Das aktuell ausgewaehlte Team steht hier im Zentrum. Von hier springst du direkt in Kader, Markt oder Team-Drawer.</p>
                  </div>
                  <div className="room-meta foundation-admin-meta">
                    <span className="pill">{selectedTeam?.name ?? "Kein Team"}</span>
                    <span className="pill">Roster {selectedRoster.length}</span>
                    <span className="pill">GM {selectedTeamGeneralManager?.profile.archetype ?? "—"}</span>
                  </div>
                </div>
                <div className="foundation-team-settings-focus-grid">
                  <article className="foundation-team-settings-focus-card is-primary">
                    <span>Team</span>
                    <strong>{selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "Kein Team aktiv"}</strong>
                    <small>
                      {selectedTeam
                        ? `${formatTeamControlModeLabel(selectedTeamControl?.controlMode)} · ${selectedStandingRow?.rank != null ? `Rang #${selectedStandingRow.rank}` : "noch ohne Rang"}`
                        : "Waehle oben ein Team fuer Identity, Strategy und Control."}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Punkte</span>
                    <strong>{selectedStandingRow?.points != null ? formatLocalePoints(selectedStandingRow.points, 1) : "—"}</strong>
                    <small>Live-Stand</small>
                  </article>
                  <article className="metric-card">
                    <span>Cash</span>
                    <strong>{selectedStandingRow?.cash != null ? formatMoney(selectedStandingRow.cash) : "—"}</strong>
                    <small>liquide Mittel</small>
                  </article>
                  <article className="metric-card">
                    <span>Gehalt</span>
                    <strong>{selectedStandingRow?.salaryTotal != null ? formatMoney(selectedStandingRow.salaryTotal) : "—"}</strong>
                    <small>aktueller Kader</small>
                  </article>
                  <article className="metric-card">
                    <span>MW</span>
                    <strong>{selectedStandingRow?.marketValueTotal != null ? formatMoney(selectedStandingRow.marketValueTotal) : "—"}</strong>
                    <small>gesamter Kader</small>
                  </article>
                  <article className="metric-card">
                    <span>Sponsor</span>
                    <strong>{selectedStandingRow?.sponsorTotal != null ? formatMoney(selectedStandingRow.sponsorTotal) : "—"}</strong>
                    <small>pro Season</small>
                  </article>
                </div>
                {selectedTeamGeneralManager ? (
                  <div className="foundation-team-settings-gm-panel">
                    <article className="foundation-team-settings-focus-card foundation-team-settings-gm-summary">
                      <span>GM-Einfluss</span>
                      <strong>{selectedTeamGeneralManager.profile.name}</strong>
                      {selectedHqGmStory ? (
                        <span className={`transfer-status-pill${selectedHqGmStory.isHotSeat ? " is-warning" : selectedHqGmStory.isReplacement ? " is-info" : ""}`}>
                          {selectedHqGmStory.statusLabel}
                        </span>
                      ) : null}
                      <p>
                        {selectedTeamGeneralManager.profile.title} wirkt aktuell zu{" "}
                        <strong>{selectedTeamGeneralManager.assignment.influencePct}%</strong> auf Teamidentitaet, Pick-Fokus,
                        Cash-Risiko und Vertragsstil.
                      </p>
                      {selectedTeamGmAxisShares ? (
                        <div className="team-drawer-gm-axis-row">
                          <span className="is-pow">POW {selectedTeamGmAxisShares.pow}%</span>
                          <span className="is-spe">SPE {selectedTeamGmAxisShares.spe}%</span>
                          <span className="is-men">MEN {selectedTeamGmAxisShares.men}%</span>
                          <span className="is-soc">SOC {selectedTeamGmAxisShares.soc}%</span>
                        </div>
                      ) : null}
                    </article>
                    <article className="foundation-team-settings-focus-card">
                      <span>Wie er tickt</span>
                      <strong>dominante Hebel</strong>
                      <div className="team-drawer-gm-bias-grid">
                        {selectedTeamGmBiasHighlights.map((entry) => (
                          <div className="team-drawer-gm-bias-row" key={`gm-bias-${entry.key}`}>
                            <span>{entry.label}</span>
                            <strong>
                              {entry.tendency} · {entry.rawValue}/10
                            </strong>
                            <small>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</small>
                          </div>
                        ))}
                      </div>
                    </article>
                    <article className="foundation-team-settings-focus-card">
                      <span>Doktrin</span>
                      <strong>{selectedTeamGeneralManager.profile.marketDoctrine}</strong>
                      <small>{selectedTeamGeneralManager.profile.lineupDoctrine}</small>
                      <div className="foundation-pill-row">
                        {selectedTeamGeneralManager.profile.facilityPriorities.slice(0, 3).map((facility) => (
                          <span className="pill" key={`gm-facility-${facility}`}>
                            {facility}
                          </span>
                        ))}
                      </div>
                    </article>
                  </div>
                ) : null}
                <div className="foundation-save-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!selectedTeam}
                    title={selectedTeam ? "Teamprofil öffnen" : "Waehle zuerst ein Team aus."}
                    onClick={() => selectedTeam && openTeamProfileById(selectedTeam.teamId)}
                  >
                    Teamprofil
                  </button>
                </div>
              </section>

              <section className="panel foundation-wide" id="foundation-team-settings-team-selection">
                <div className="panel-header">
                  <div className="stack">
                    <h2>Team-Auswahl</h2>
                    <p className="muted">Waehlt das Team fuer Identity, Strategy Profile und Control Settings. Der Wechsel bleibt ueber die URL teilbar.</p>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "minmax(240px, 1.3fr) minmax(220px, 1fr) auto auto",
                    alignItems: "end",
                  }}
                >
                  <label className="stack">
                    <span>Team waehlen</span>
                    <select
                      className="input"
                      value={selectedTeamId}
                      onChange={(event) => selectTeamSettingsTeam(event.target.value)}
                    >
                      {gameState.teams.map((team) => (
                        <option key={team.teamId} value={team.teamId}>
                          {team.name} ({team.shortCode})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="stack">
                    <span>Teamliste filtern</span>
                    <input
                      className="input"
                      type="search"
                      placeholder="Name oder Teamcode"
                      value={teamSettingsSearch}
                      onChange={(event) => setTeamSettingsSearch(event.target.value)}
                    />
                  </label>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={selectedTeamSettingsIndex <= 0}
                    title={
                      selectedTeamSettingsIndex <= 0
                        ? "Du bist bereits beim ersten Team der Liste."
                        : "Springt zum vorherigen Team in der aktuellen Liste."
                    }
                    onClick={() => {
                      const previousTeam = gameState.teams[selectedTeamSettingsIndex - 1];
                      if (previousTeam) {
                        selectTeamSettingsTeam(previousTeam.teamId);
                      }
                    }}
                  >
                    Vorheriges
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={selectedTeamSettingsIndex < 0 || selectedTeamSettingsIndex >= gameState.teams.length - 1}
                    title={
                      selectedTeamSettingsIndex < 0 || selectedTeamSettingsIndex >= gameState.teams.length - 1
                        ? "Du bist bereits beim letzten Team der Liste."
                        : "Springt zum naechsten Team in der aktuellen Liste."
                    }
                    onClick={() => {
                      const nextTeam = gameState.teams[selectedTeamSettingsIndex + 1];
                      if (nextTeam) {
                        selectTeamSettingsTeam(nextTeam.teamId);
                      }
                    }}
                  >
                    Naechstes
                  </button>
                </div>
                <div className="room-meta foundation-admin-meta" style={{ marginTop: 12 }}>
                  <span className="pill">Aktiv {selectedTeam?.name ?? "—"}</span>
                  <span className="pill">Code {selectedTeam?.shortCode ?? "—"}</span>
                  <span className="pill">Teams {gameState.teams.length}</span>
                  <span className="pill">{selectedTeamHasUnsavedChanges ? "Nicht gespeichert" : "Synchron"}</span>
                </div>
                <div className="team-selector">
                  {filteredTeamSettingsTeams.map((team) => {
                    const rosterCount = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
                    const isActive = selectedTeam?.teamId === team.teamId;
                    const controlMode = resolvedTeamControlSettings[team.teamId]?.controlMode ?? "manual";

                    return (
                      <button
                        key={team.teamId}
                        className={`team-selector-card${isActive ? " is-active" : ""}`}
                        type="button"
                        onClick={() => {
                          selectTeamSettingsTeam(team.teamId);
                          setFoundationView("teamSettings", setActiveView);
                        }}
                      >
                        <span className="team-selector-code">{team.shortCode}</span>
                        <strong>{team.name}</strong>
                        <span className="muted">
                          Roster {rosterCount} · {formatTeamControlModeLabel(controlMode)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="panel foundation-wide" id="foundation-team-settings-controls">
                <div className="panel-header">
                  <div className="stack">
                    <h2>Spielmodus &amp; Team-Zuordnung</h2>
                    <p className="muted">
                      Eine Wahrheit pro Save: Der Spielmodus legt fest, wie viele Teams menschlich sind. Alles andere laeuft als AI.
                      Aenderungen erst mit &quot;Lokal speichern&quot; dauerhaft schreiben.
                    </p>
                  </div>
                  <div className="foundation-save-actions">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={readMeta.readOnly}
                      title={readMeta.readOnly ? getReadOnlyActionReason("die Team-Control-Settings") : "Speichert Spielmodus-Zuordnung und AI-Automation in diesem Save."}
                      onClick={saveTeamSettings}
                    >
                      Lokal speichern
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={readMeta.readOnly}
                      title={readMeta.readOnly ? getReadOnlyActionReason("den Team-Control-Draft") : "Setzt alle lokalen Entwurfs-Aenderungen auf den gespeicherten Stand zurueck."}
                      onClick={() => {
                        const savedSettings = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
                        const savedOwnership = deriveChrisFrankyTeamIdsFromSettings(gameState.teams, savedSettings);
                        setTeamIdentityDraft(buildTeamIdentityDraftMap(gameState.teams, gameState.teamIdentities));
                        setTeamControlDraft(savedSettings);
                        setGameModeOwnershipChrisIds(savedOwnership.chrisTeamIds);
                        setGameModeOwnershipFrankyIds(savedOwnership.frankyTeamIds);
                        setTeamStrategyDraft(
                          buildTeamStrategyProfileMap(
                            gameState.teams,
                            gameState.teamIdentities,
                            gameState.seasonState.teamStrategyProfiles,
                          ),
                        );
                        setTeamIdentityMessage("Nicht gespeicherte Team-Identity-Änderungen wurden verworfen.");
                        setTeamControlMessage("Nicht gespeicherte Änderungen wurden verworfen.");
                        setTeamStrategyMessage("Nicht gespeicherte Strategy-Profile wurden verworfen.");
                      }}
                    >
                      Draft verwerfen
                    </button>
                  </div>
                  {readMeta.readOnly ? (
                    <p className="foundation-screen-action-reason">Warum nicht: {getReadOnlyActionReason("die Team-Control-Settings")}</p>
                  ) : null}
                </div>
                <div className="room-meta foundation-admin-meta" style={{ marginTop: 12 }}>
                  <span className="pill" data-testid="foundation-active-game-mode">
                    Modus {formatFoundationSaveModeLabel(activeSaveGameMode)}
                  </span>
                  <span className="pill">Chris {currentSaveOwnership.chrisTeamIds.length}/{gameModeOwnershipLimits.chrisMax}</span>
                  {gameModeOwnershipLimits.frankyMax > 0 ? (
                    <span className="pill">Franky {currentSaveOwnership.frankyTeamIds.length}/{gameModeOwnershipLimits.frankyMax}</span>
                  ) : null}
                  <span className="pill">AI {aiTeams.length}</span>
                  <span className={`pill foundation-source-pill${readMeta.readOnly ? " is-readonly" : ""}`}>Speichern: {readSourceLabel}</span>
                </div>

                <section className="panel" data-testid="game-mode-ownership-panel" style={{ marginTop: 12 }}>
                  <div className="panel-header">
                    <div className="stack">
                      <h3>Team-Zuordnung</h3>
                      <p className="muted">
                        {activeSaveGameMode === "online_4v4"
                          ? "Waehle genau 4 Teams fuer Chris und 4 fuer Franky. Alle anderen Teams bleiben AI."
                          : activeSaveGameMode === "solo_1"
                            ? "Waehle genau 1 Team fuer dich. Alle anderen Teams bleiben AI."
                            : `Maximal ${gameModeOwnershipLimits.chrisMax} Chris-Team(s)${gameModeOwnershipLimits.frankyMax ? ` und ${gameModeOwnershipLimits.frankyMax} Franky-Team(s)` : ""}.`}
                      </p>
                    </div>
                  </div>

                  {activeSaveGameMode === "solo_1" || (gameModeOwnershipLimits.chrisMax === 1 && gameModeOwnershipLimits.frankyMax === 0) ? (
                    <label className="filter-field" style={{ marginTop: 12 }}>
                      <span>Dein Team</span>
                      <select
                        className="input"
                        data-testid="solo-player-team-select"
                        disabled={readMeta.readOnly}
                        value={gameModeOwnershipChrisIds[0] ?? ""}
                        onChange={(event) => {
                          if (event.target.value) {
                            setSoloPlayerTeam(event.target.value);
                          }
                        }}
                      >
                        <option value="" disabled>
                          Team waehlen
                        </option>
                        {gameState.teams.map((team) => (
                          <option key={`solo-team-${team.teamId}`} value={team.teamId}>
                            {team.name} ({team.shortCode})
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      <div className="metric-grid compact" style={{ marginTop: 12 }}>
                        <article className="metric-card">
                          <span>Chris</span>
                          <strong>{currentSaveOwnership.chrisTeamIds.length}/{gameModeOwnershipLimits.chrisMax}</strong>
                          <small>{currentSaveOwnership.chrisTeamIds.join(" · ") || "kein Team"}</small>
                        </article>
                        <article className="metric-card">
                          <span>Franky</span>
                          <strong>{currentSaveOwnership.frankyTeamIds.length}/{gameModeOwnershipLimits.frankyMax}</strong>
                          <small>{currentSaveOwnership.frankyTeamIds.join(" · ") || "kein Team"}</small>
                        </article>
                        <article className="metric-card">
                          <span>AI</span>
                          <strong>
                            {Math.max(
                              0,
                              gameState.teams.length -
                                currentSaveOwnership.chrisTeamIds.length -
                                currentSaveOwnership.frankyTeamIds.length,
                            )}
                          </strong>
                          <small>automatisch</small>
                        </article>
                      </div>
                      <div className="team-chip-grid" data-testid="game-mode-ownership-picker">
                        {[...gameState.teams]
                          .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
                          .map((team) => {
                            const isChris = currentSaveOwnership.chrisTeamIds.includes(team.teamId);
                            const isFranky = currentSaveOwnership.frankyTeamIds.includes(team.teamId);
                            return (
                              <div
                                key={`game-mode-team-${team.teamId}`}
                                className={`team-settings-team-card${isChris ? " is-owned-by-user" : ""}${isFranky ? " is-owned-by-remote" : ""}`}
                              >
                                <strong>{team.shortCode}</strong>
                                <span>{team.name}</span>
                                <div className="foundation-save-actions save-summary-actions">
                                  <button
                                    className={isChris ? "primary-button inline-button" : "secondary-button inline-button"}
                                    type="button"
                                    disabled={readMeta.readOnly || isFranky}
                                    onClick={() => toggleGameModeOwnershipTeam("chris", team.teamId)}
                                  >
                                    Chris
                                  </button>
                                  <button
                                    className={isFranky ? "primary-button inline-button" : "secondary-button inline-button"}
                                    type="button"
                                    disabled={readMeta.readOnly || isChris || gameModeOwnershipLimits.frankyMax === 0}
                                    onClick={() => toggleGameModeOwnershipTeam("franky", team.teamId)}
                                  >
                                    Franky
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </>
                  )}
                </section>

                <section className="panel" data-testid="ai-automation-panel" style={{ marginTop: 12 }}>
                  <div className="panel-header">
                    <div className="stack">
                      <h3>AI-Automation (nur AI-Teams)</h3>
                      <p className="muted">Preview- und Apply-Flags fuer automatisierte AI-Teams. Ownership bleibt unveraendert.</p>
                    </div>
                  </div>
                  <div className="table-shell" style={{ marginTop: 12 }}>
                    <table className="data-table compact-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Lineup Preview</th>
                          <th>Lineup Apply</th>
                          <th>Transfer Preview</th>
                          <th>Sell Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameState.teams
                          .filter((team) => (teamControlDraft[team.teamId] ?? resolvedTeamControlSettings[team.teamId])?.controlMode === "ai")
                          .map((team) => {
                            const settings = teamControlDraft[team.teamId] ?? resolvedTeamControlSettings[team.teamId];
                            if (!settings) return null;
                            return (
                              <tr key={`ai-auto-${team.teamId}`}>
                                <td>
                                  <strong>{team.shortCode}</strong>
                                  <span className="muted"> {team.name}</span>
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={settings.aiLineupPreviewEnabled}
                                    disabled={readMeta.readOnly}
                                    onChange={(event) => {
                                      updateTeamControlDraft(team.teamId, (current) => ({
                                        ...current,
                                        aiLineupPreviewEnabled: event.target.checked,
                                      }));
                                    }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={settings.aiLineupApplyEnabled ?? settings.aiLineupAutoApplyEnabled}
                                    disabled={readMeta.readOnly}
                                    onChange={(event) => {
                                      updateTeamControlDraft(team.teamId, (current) => ({
                                        ...current,
                                        aiLineupApplyEnabled: event.target.checked,
                                      }));
                                    }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={settings.aiTransferPreviewEnabled}
                                    disabled={readMeta.readOnly}
                                    onChange={(event) => {
                                      updateTeamControlDraft(team.teamId, (current) => ({
                                        ...current,
                                        aiTransferPreviewEnabled: event.target.checked,
                                      }));
                                    }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={settings.aiSellPreviewEnabled}
                                    disabled={readMeta.readOnly}
                                    onChange={(event) => {
                                      updateTeamControlDraft(team.teamId, (current) => ({
                                        ...current,
                                        aiSellPreviewEnabled: event.target.checked,
                                      }));
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
                <div className="foundation-save-actions" style={{ marginTop: 12 }}>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!selectedTeam || !selectedIdentityDraft || !selectedTeamStrategyDraft}
                    title={
                      !selectedTeam
                        ? "Waehle zuerst ein Team aus."
                        : !selectedIdentityDraft || !selectedTeamStrategyDraft
                          ? "Fuer dieses Team fehlen noch lokale Identity- oder Strategy-Daten."
                          : "Exportiert die aktuellen lokalen Team-Settings als JSON."
                    }
                    onClick={exportSelectedTeamSettingsJson}
                  >
                    Export JSON
                  </button>
                </div>
                {!selectedTeam || !selectedIdentityDraft || !selectedTeamStrategyDraft ? (
                  <p className="foundation-screen-action-reason">
                    Warum nicht: {!selectedTeam ? "Waehle zuerst ein Team aus." : "Fuer dieses Team fehlen noch lokale Identity- oder Strategy-Daten."}
                  </p>
                ) : null}
                {teamIdentityMessage ? <p className="text-positive">{teamIdentityMessage}</p> : null}
                {teamControlMessage ? <p className="text-positive">{teamControlMessage}</p> : null}
                {teamStrategyMessage ? <p className="text-positive">{teamStrategyMessage}</p> : null}

                {selectedTeam && selectedTeamStrategyDraft ? (
                  <div className="panel inset-panel" style={{ marginTop: 18 }}>
                    <div className="panel-header">
                      <div className="stack">
                        <h3>Team Strategy Profile</h3>
                        <p className="muted">
                          Ausfuehrlicher lokaler Lore- und Bias-Kontext fuer AI-Erklaerungen. Keine Automatik, keine Auto-Apply-Aktion.
                        </p>
                      </div>
                      <div className="room-meta foundation-admin-meta">
                        <span className="pill">{selectedTeam.name}</span>
                        <span className="pill">{selectedTeam.shortCode}</span>
                        <span className="pill">Steuerung {formatTeamControlModeLabel(selectedTeamControl?.controlMode)}</span>
                      </div>
                    </div>

                    <div className="stats-grid" style={{ marginTop: 12 }}>
                      <article className="metric-card">
                        <span>POW</span>
                        <strong>{selectedIdentityDraft?.pow ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>SPE</span>
                        <strong>{selectedIdentityDraft?.spe ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>MEN</span>
                        <strong>{selectedIdentityDraft?.men ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>SOC</span>
                        <strong>{selectedIdentityDraft?.soc ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Player Type</span>
                        <strong>{selectedIdentityDraft?.playerType ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Profil-Version</span>
                        <strong>{selectedTeamStrategyDraft.strategyVersion ?? "v1-local"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Roster Target</span>
                        <strong>
                          {(selectedTeamStrategyDraft.rosterMinTarget ?? selectedIdentityDraft?.playerMin ?? "—")}/
                          {(selectedTeamStrategyDraft.rosterOptTarget ?? selectedIdentityDraft?.playerOpt ?? "—")}
                        </strong>
                      </article>
                    </div>

                    <div className="panel inset-panel" style={{ marginTop: 16 }}>
                      <div className="panel-header">
                        <div className="stack">
                          <h3>Local Overrides</h3>
                          <p className="muted">
                            Defaults kommen aus den kanonischen Teamquellen. Gespeichert wird nur lokal im aktiven Save, niemals in Prisma.
                          </p>
                        </div>
                      </div>
                      <div className="room-meta foundation-admin-meta" style={{ marginTop: 12 }}>
                        <span className="pill">Save {activeSaveName}</span>
                        <span className="pill">Identity Default {selectedIdentityDraft?.sourceNote ?? "—"}</span>
                        <span className="pill">
                          Identity Override {gameState.seasonState.teamIdentityOverrides?.[selectedTeam.teamId] ? "ja" : "nein"}
                        </span>
                        <span className="pill">Control Save seasonState.teamControlSettings</span>
                        <span className="pill">Strategy Save seasonState.teamStrategyProfiles</span>
                      </div>
                    </div>

                    {selectedIdentityDraft ? (
                      <div className="panel inset-panel" style={{ marginTop: 16 }}>
                        <div className="panel-header">
                          <div className="stack">
                            <h3>Identity Rohwerte</h3>
                            <p className="muted">Exakte Team-Identitaet aus den lokalen Quellen. Diese Rohwerte werden nicht auf generische 50er- oder 60er-Biaswerte geglaettet.</p>
                          </div>
                          <div className="room-meta foundation-admin-meta">
                            <span className="pill">Default: {selectedIdentityDraft.sourceNote ?? "—"}</span>
                            <span className="pill">Raw Identity</span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                            marginTop: 12,
                          }}
                        >
                          <label className="stack">
                            <span>Player Type</span>
                            <select
                              className="input"
                              disabled={readMeta.readOnly}
                              value={selectedIdentityDraft.playerType ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateTeamIdentityDraft(selectedTeam.teamId, (current) => ({
                                  ...current,
                                  playerType: value || null,
                                }));
                              }}
                            >
                              <option value="">—</option>
                              <option value="F">F</option>
                              <option value="C">C</option>
                            </select>
                          </label>
                          {teamIdentityFieldLabels.map((field) => (
                            <label key={field.key} className="stack">
                              <span>{field.label}</span>
                              <input
                                className="input"
                                type="number"
                                min={0}
                                max={field.key === "playerMin" || field.key === "playerOpt" ? 32 : 20}
                                step={field.key === "playerMin" || field.key === "playerOpt" ? 1 : 0.5}
                                disabled={readMeta.readOnly}
                                value={selectedIdentityDraft[field.key]}
                                onChange={(event) => {
                                  const nextValue = clampIdentityValue(Number(event.target.value), field.key);
                                  updateTeamIdentityDraft(selectedTeam.teamId, (current) => ({
                                    ...current,
                                    [field.key]: nextValue,
                                  }));
                                }}
                              />
                            </label>
                          ))}
                        </div>

                        {selectedIdentityAxisBias ? (
                          <div className="stats-grid" style={{ marginTop: 16 }}>
                            <article className="metric-card">
                              <span>POW Bias</span>
                              <strong>{formatIdentityWeight(selectedIdentityAxisBias.pow)}</strong>
                            </article>
                            <article className="metric-card">
                              <span>SPE Bias</span>
                              <strong>{formatIdentityWeight(selectedIdentityAxisBias.spe)}</strong>
                            </article>
                            <article className="metric-card">
                              <span>MEN Bias</span>
                              <strong>{formatIdentityWeight(selectedIdentityAxisBias.men)}</strong>
                            </article>
                            <article className="metric-card">
                              <span>SOC Bias</span>
                              <strong>{formatIdentityWeight(selectedIdentityAxisBias.soc)}</strong>
                            </article>
                          </div>
                        ) : null}
                        <p className="muted" style={{ marginTop: 10 }}>
                          Derived Axis Bias % = round(Achsenwert / Summe aus Power, Speed, Mental, Social * 100).
                          {selectedIdentityAxisBias?.warning === "identity_axis_sum_zero"
                            ? " Warnung: identity_axis_sum_zero."
                            : ""}
                        </p>

                        <div className="foundation-save-actions" style={{ marginTop: 16 }}>
                          <button
                            className="primary-button"
                            type="button"
                            disabled={readMeta.readOnly}
                            title={readMeta.readOnly ? getReadOnlyActionReason("die Team-Identity") : "Speichert die lokalen Rohwerte und Biases dieses Teams."}
                            onClick={saveTeamSettings}
                          >
                            Identity lokal speichern
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={readMeta.readOnly}
                            title={readMeta.readOnly ? getReadOnlyActionReason("die Team-Identity") : "Setzt die Team-Identity fuer dieses Team auf den Default zurueck."}
                            onClick={() => {
                              const resetIdentities = buildResolvedTeamIdentities(gameState.teams, gameState.teamIdentities, {});
                              const resetIdentity = resetIdentities.find((identity) => identity.teamId === selectedTeam.teamId);
                              if (!resetIdentity) {
                                return;
                              }
                              setTeamIdentityDraft((current) => ({
                                ...current,
                                [selectedTeam.teamId]: resetIdentity,
                              }));
                              setTeamIdentityMessage(`Default-Identity fuer ${selectedTeam.name} wiederhergestellt.`);
                            }}
                          >
                            Identity auf Default
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "grid",
                        gap: 16,
                        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                        marginTop: 16,
                      }}
                    >
                      <label className="stack">
                        <span>Fantasy Theme</span>
                        <input
                          className="input"
                          type="text"
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.fantasyTheme ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                fantasyTheme: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Lore Theme</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.loreTheme ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                loreTheme: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Summary</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.strategySummary}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                strategySummary: value,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Buy Style</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.buyStyle}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                buyStyle: value,
                                transferStyleNote: current.transferStyleNote === current.buyStyle ? value : current.transferStyleNote,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Sell Style</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.sellStyle}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                sellStyle: value,
                                sellStyleNote: current.sellStyleNote === current.sellStyle ? value : current.sellStyleNote,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Contract Style</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.contractStyle}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                contractStyle: value,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Roster Style</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.rosterStyle}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                rosterStyle: value,
                                lineupStyleNote: current.lineupStyleNote === current.rosterStyle ? value : current.lineupStyleNote,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Notes</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.notes ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                notes: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        marginTop: 16,
                      }}
                    >
                      {teamStrategyIdentityListFieldLabels.map((field) => (
                        <label key={field.key} className="stack">
                          <span>{field.label}</span>
                          <textarea
                            className="input"
                            rows={2}
                            disabled={readMeta.readOnly}
                            value={formatCsvList(selectedTeamStrategyDraft[field.key])}
                            placeholder="comma, separated, values"
                            onChange={(event) => {
                              const next = parseCsvList(event.target.value);
                              updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                                withSynchronizedStrategyAliases(current, {
                                  [field.key]: next,
                                } as Partial<TeamStrategyProfile>),
                              );
                            }}
                          />
                        </label>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        marginTop: 16,
                      }}
                    >
                      <label className="stack">
                        <span>Roster Min Target</span>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          max={32}
                          step={1}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.rosterMinTarget ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value === "" ? null : Math.max(0, Math.min(32, Math.round(Number(event.target.value))));
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                rosterMinTarget: nextValue,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Roster Opt Target</span>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          max={32}
                          step={1}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.rosterOptTarget ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value === "" ? null : Math.max(0, Math.min(32, Math.round(Number(event.target.value))));
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                rosterOptTarget: nextValue,
                              }),
                            );
                          }}
                        />
                      </label>
                      {teamStrategyLevelFieldLabels.map((field) => (
                        <label key={field.key} className="stack">
                          <span>{field.label}</span>
                          <select
                            className="input"
                            disabled={readMeta.readOnly}
                            value={selectedTeamStrategyDraft[field.key] ?? "medium"}
                            onChange={(event) => {
                              updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                                withSynchronizedStrategyAliases(current, {
                                  [field.key]: normalizeTeamStrategyLevel(event.target.value),
                                } as Partial<TeamStrategyProfile>),
                              );
                            }}
                          >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                          </select>
                        </label>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        marginTop: 16,
                      }}
                    >
                      {teamStrategySportsBiasFieldLabels.map((field) => (
                        <article key={field.key} className="metric-card">
                          <span>{field.label}</span>
                          <strong>{formatIdentityWeight(selectedIdentityAxisBias?.[teamStrategySportsBiasAxisMap[field.key]] ?? null)}</strong>
                          <small className="muted">read-only aus Identity Rohwerten</small>
                        </article>
                      ))}
                      <label className="stack">
                        <span>Lineup Style Note</span>
                        <textarea
                          className="input"
                          rows={2}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.lineupStyleNote ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                lineupStyleNote: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Transfer Style Note</span>
                        <textarea
                          className="input"
                          rows={2}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.transferStyleNote ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                transferStyleNote: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Sell Style Note</span>
                        <textarea
                          className="input"
                          rows={2}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.sellStyleNote ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                sellStyleNote: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                    </div>

                    <details className="panel inset-panel" style={{ marginTop: 16 }}>
                      <summary>Legacy-Kompatibilitaet / Debug</summary>
                      <p className="muted" style={{ marginTop: 12 }}>
                        Diese Werte dienen nur der Rueckwaertskompatibilitaet und sind nicht die primaere Team Identity oder die fuehrende AI-Bias-Quelle.
                      </p>
                      <div
                        style={{
                          display: "grid",
                          gap: 12,
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          marginTop: 12,
                        }}
                      >
                        {teamStrategyListFieldLabels.map((field) => (
                          <label key={field.key} className="stack">
                            <span>{field.label}</span>
                            <textarea
                              className="input"
                              rows={2}
                              disabled={readMeta.readOnly}
                              value={formatCsvList(selectedTeamStrategyDraft[field.key])}
                              placeholder="comma, separated, values"
                              onChange={(event) => {
                                const next = parseCsvList(event.target.value);
                                updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                                  withSynchronizedStrategyAliases(current, {
                                    [field.key]: next,
                                  } as Partial<TeamStrategyProfile>),
                                );
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </details>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        marginTop: 16,
                      }}
                    >
                      {teamStrategyBiasFieldLabels.map((field) => (
                        <label key={field.key} className="stack">
                          <span>{field.label}</span>
                          <input
                            className="input"
                            type="number"
                            min={1}
                            max={10}
                            step={1}
                            disabled={readMeta.readOnly}
                            value={selectedTeamStrategyDraft.bias[field.key]}
                            onChange={(event) => {
                              const nextValue = clampBiasValue(Number(event.target.value));
                              updateTeamStrategyDraft(selectedTeam.teamId, (current) => ({
                                ...current,
                                bias: {
                                  ...current.bias,
                                  [field.key]: nextValue,
                                },
                              }));
                            }}
                          />
                        </label>
                      ))}
                    </div>

                    <div className="foundation-save-actions" style={{ marginTop: 16 }}>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={readMeta.readOnly}
                        title={readMeta.readOnly ? getReadOnlyActionReason("das Strategy-Profil") : "Speichert das lokale Strategy-Profil dieses Teams im aktiven Save."}
                        onClick={saveTeamSettings}
                      >
                        Strategy Profile lokal speichern
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={readMeta.readOnly}
                        title={readMeta.readOnly ? getReadOnlyActionReason("das Strategy-Profil") : "Verwirft ungespeicherte Strategy-Aenderungen und springt auf den aktuellen Save-Stand zurueck."}
                        onClick={() => {
                          setTeamStrategyDraft(
                            buildTeamStrategyProfileMap(
                              gameState.teams,
                              gameState.teamIdentities,
                              gameState.seasonState.teamStrategyProfiles,
                            ),
                          );
                          setTeamStrategyMessage("Strategy-Profile-Draft wurde auf den lokalen Save-Stand zurueckgesetzt.");
                        }}
                      >
                        Strategy Draft zuruecksetzen
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={readMeta.readOnly}
                        title={readMeta.readOnly ? getReadOnlyActionReason("das Strategy-Profil") : "Setzt das Strategy-Profil dieses Teams auf die Default-Werte zurueck."}
                        onClick={() => {
                          const defaults = buildTeamStrategyProfileMap(gameState.teams, gameState.teamIdentities);
                          const resetProfile = defaults[selectedTeam.teamId];
                          if (!resetProfile) {
                            return;
                          }
                          setTeamStrategyDraft((current) => ({
                            ...current,
                            [selectedTeam.teamId]: resetProfile,
                          }));
                          setTeamStrategyMessage(`Default-Profil fuer ${selectedTeam.name} wiederhergestellt.`);
                        }}
                      >
                        Reset auf Default
                      </button>
                    </div>
                    {readMeta.readOnly ? <p className="muted">Prisma/Supabase bleibt read-only. Profile koennen dort nicht gespeichert werden.</p> : null}
                    {selectedTeamStrategyProfile ? (
                      <p className="muted" style={{ marginTop: 8 }}>
                        AI read-only Kontext: {selectedTeamStrategyProfile.strategySummary}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>

            </div>
          </section>

          <section className={`panel${getViewClass("admin")}`} id="foundation-admin">
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
                    {adminSimulationRun?.issues.slice(-8).map((issue) => (
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
                    {adminSimulationRun?.logs.slice(-20).map((entry) => (
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

          <section className={`panel${getViewClass("generator")}`} id="foundation-generator">
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

          <section className={`panel${getViewClass("cockpit")}`} data-testid="foundation-cockpit" id="foundation-cockpit">
            <div className="panel-header">
              <div className="stack season-panel-head">
                <h2>Spieltag-Cockpit</h2>
              </div>
              <div className="season-toolbar">
                <button
                  className="secondary-button inline-button"
                  type="button"
                  disabled={cockpitBusyKey != null}
                  onClick={() => {
                    void refreshSeasonCockpit();
                  }}
                >
                  Cockpit aktualisieren
                </button>
              </div>
            </div>

            <div className="room-meta foundation-admin-meta">
              <span className="pill">Save {activeSaveName}</span>
              <span className="pill">{canonicalSeasonLabel}</span>
              <span className="pill">{currentMatchdayDisplayLabel}</span>
              <span className={`pill foundation-source-pill${readMeta.readOnly ? " is-readonly" : ""}`}>Spielstand {readSourceLabel}</span>
              <span className="pill">Manuell {manualTeams.length}</span>
              <span className="pill">Auto {aiTeams.length}</span>
              <span className="pill">Passiv {passiveTeams.length}</span>
            </div>

            <div className="cockpit-live-banner">
              <strong>{currentMatchdayDisplayLabel} aktiv</strong>
              <span>
                Lokaler Spielstand bleibt die Schreibquelle. Pruefen, Testlauf und Anwenden bleiben sichtbar getrennt.
              </span>
            </div>

            <section className="panel cockpit-balance-dashboard" data-testid="multi-season-balance-dashboard">
              <div className="panel-header">
                <div className="stack season-panel-head">
                  <h3>Multi-Season Balance</h3>
                  <p className="muted">
                    Auswertung aus Saison-Snapshots, aktivem Save, Transferhistorie, Gebaeuden und Entwicklung.
                  </p>
                </div>
                <span className="pill">Source local save</span>
              </div>

              <div className="metric-grid cockpit-summary-grid">
                {multiSeasonBalanceDashboard.summaryCards.map((card) => (
                  <article key={card.label} className={`metric-card balance-summary-card is-${card.tone}`}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.detail}</small>
                  </article>
                ))}
              </div>

              {multiSeasonBalanceDashboard.warnings.length > 0 ? (
                <div className="balance-warning-grid" data-testid="multi-season-balance-warnings">
                  {multiSeasonBalanceDashboard.warnings.slice(0, 8).map((warning) => (
                    <article key={`${warning.type}-${warning.teamId ?? warning.playerId ?? warning.title}`} className={`panel inset-panel balance-warning-card is-${warning.severity}`}>
                      <span className="pill">{warning.type}</span>
                      <strong>{warning.title}</strong>
                      <p>{warning.message}</p>
                      <small>source: {warning.source}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">Keine Balance-Warnings aus den vorhandenen Quellen.</p>
              )}

              <div className="cockpit-actions balance-export-links">
                {multiSeasonBalanceDashboard.exportLinks.map((link) => (
                  <a key={link.path} className="secondary-button" href={link.path}>
                    {link.label}
                  </a>
                ))}
              </div>

              <div className="balance-dashboard-grid">
                <article className="panel inset-panel">
                  <div className="panel-header">
                    <h4>Team Balance</h4>
                    <ColumnVisibilityManager
                      title="Spalten"
                      columns={multiSeasonTeamBalanceColumns}
                      isVisible={(columnId, visibleByDefault) => isTableColumnVisible("multiSeasonTeamBalanceTable", columnId, visibleByDefault)}
                      onToggle={(columnId, nextVisible) => setTableColumnVisible("multiSeasonTeamBalanceTable", columnId, nextVisible)}
                      onMove={(columnId, direction) => moveTableColumn("multiSeasonTeamBalanceTable", columnId, direction, multiSeasonTeamBalanceColumns)}
                      getWidth={(column) => getTableColumnWidth("multiSeasonTeamBalanceTable", column)}
                      onStepWidth={(column, delta) => adjustTableColumnWidth("multiSeasonTeamBalanceTable", column, delta)}
                      onResetWidth={(column) => resetTableColumnWidth("multiSeasonTeamBalanceTable", column)}
                      onResetToDefault={() => resetTableLayout("multiSeasonTeamBalanceTable", multiSeasonTeamBalanceColumns)}
                    />
                  </div>
                  <div className="compact-table-shell">
                    <table className="compact-table balance-table">
                      <thead>
                        <tr>
                          {visibleMultiSeasonTeamBalanceColumns.map((column) => (
                            <th
                              key={column.id}
                              style={{ width: getTableColumnWidth("multiSeasonTeamBalanceTable", column), minWidth: getTableColumnWidth("multiSeasonTeamBalanceTable", column) }}
                              {...getTableHeaderDragProps("multiSeasonTeamBalanceTable", column, multiSeasonTeamBalanceColumns)}
                            >
                              <SortableHeader label={column.label} tableId="multiSeasonTeamBalanceTable" columnKey={column.dataKey} sortState={tableSorts.multiSeasonTeamBalanceTable} onToggle={toggleTableSort} />
                              <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("multiSeasonTeamBalanceTable", column, event)} onDoubleClick={() => resetTableColumnWidth("multiSeasonTeamBalanceTable", column)} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedMultiSeasonTeamRows.slice(0, 12).map((row) => (
                          <tr key={row.teamId} onClick={() => openTeamProfileById(row.teamId)}>
                            {visibleMultiSeasonTeamBalanceColumns.map((column) => (
                              <td key={`${row.teamId}-${column.id}`}>{renderMultiSeasonTeamCell(row, column.id)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="panel inset-panel">
                  <div className="panel-header">
                    <h4>Cash / Economy</h4>
                    <ColumnVisibilityManager
                      title="Spalten"
                      columns={multiSeasonEconomyColumns}
                      isVisible={(columnId, visibleByDefault) => isTableColumnVisible("multiSeasonEconomyTable", columnId, visibleByDefault)}
                      onToggle={(columnId, nextVisible) => setTableColumnVisible("multiSeasonEconomyTable", columnId, nextVisible)}
                      onMove={(columnId, direction) => moveTableColumn("multiSeasonEconomyTable", columnId, direction, multiSeasonEconomyColumns)}
                      getWidth={(column) => getTableColumnWidth("multiSeasonEconomyTable", column)}
                      onStepWidth={(column, delta) => adjustTableColumnWidth("multiSeasonEconomyTable", column, delta)}
                      onResetWidth={(column) => resetTableColumnWidth("multiSeasonEconomyTable", column)}
                      onResetToDefault={() => resetTableLayout("multiSeasonEconomyTable", multiSeasonEconomyColumns)}
                    />
                  </div>
                  <div className="compact-table-shell">
                    <table className="compact-table balance-table">
                      <thead>
                        <tr>
                          {visibleMultiSeasonEconomyColumns.map((column) => (
                            <th
                              key={column.id}
                              style={{ width: getTableColumnWidth("multiSeasonEconomyTable", column), minWidth: getTableColumnWidth("multiSeasonEconomyTable", column) }}
                              {...getTableHeaderDragProps("multiSeasonEconomyTable", column, multiSeasonEconomyColumns)}
                            >
                              <SortableHeader label={column.label} tableId="multiSeasonEconomyTable" columnKey={column.dataKey} sortState={tableSorts.multiSeasonEconomyTable} onToggle={toggleTableSort} />
                              <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("multiSeasonEconomyTable", column, event)} onDoubleClick={() => resetTableColumnWidth("multiSeasonEconomyTable", column)} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedMultiSeasonEconomyRows.slice(0, 12).map((row) => (
                          <tr key={row.teamId} onClick={() => openTeamProfileById(row.teamId)}>
                            {visibleMultiSeasonEconomyColumns.map((column) => (
                              <td key={`${row.teamId}-${column.id}`}>{renderMultiSeasonEconomyCell(row, column.id)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="panel inset-panel">
                  <div className="panel-header">
                    <h4>Player Progression</h4>
                    <ColumnVisibilityManager
                      title="Spalten"
                      columns={multiSeasonPlayerColumns}
                      isVisible={(columnId, visibleByDefault) => isTableColumnVisible("multiSeasonPlayerProgressionTable", columnId, visibleByDefault)}
                      onToggle={(columnId, nextVisible) => setTableColumnVisible("multiSeasonPlayerProgressionTable", columnId, nextVisible)}
                      onMove={(columnId, direction) => moveTableColumn("multiSeasonPlayerProgressionTable", columnId, direction, multiSeasonPlayerColumns)}
                      getWidth={(column) => getTableColumnWidth("multiSeasonPlayerProgressionTable", column)}
                      onStepWidth={(column, delta) => adjustTableColumnWidth("multiSeasonPlayerProgressionTable", column, delta)}
                      onResetWidth={(column) => resetTableColumnWidth("multiSeasonPlayerProgressionTable", column)}
                      onResetToDefault={() => resetTableLayout("multiSeasonPlayerProgressionTable", multiSeasonPlayerColumns)}
                    />
                  </div>
                  <div className="compact-table-shell">
                    <table className="compact-table balance-table">
                      <thead>
                        <tr>
                          {visibleMultiSeasonPlayerColumns.map((column) => (
                            <th
                              key={column.id}
                              style={{ width: getTableColumnWidth("multiSeasonPlayerProgressionTable", column), minWidth: getTableColumnWidth("multiSeasonPlayerProgressionTable", column) }}
                              {...getTableHeaderDragProps("multiSeasonPlayerProgressionTable", column, multiSeasonPlayerColumns)}
                            >
                              <SortableHeader label={column.label} tableId="multiSeasonPlayerProgressionTable" columnKey={column.dataKey} sortState={tableSorts.multiSeasonPlayerProgressionTable} onToggle={toggleTableSort} />
                              <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("multiSeasonPlayerProgressionTable", column, event)} onDoubleClick={() => resetTableColumnWidth("multiSeasonPlayerProgressionTable", column)} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedMultiSeasonPlayerRows.slice(0, 12).map((row) => (
                          <tr key={row.playerId} onClick={() => void openPlayerDrawerById(row.playerId)}>
                            {visibleMultiSeasonPlayerColumns.map((column) => (
                              <td key={`${row.playerId}-${column.id}`}>{renderMultiSeasonPlayerCell(row, column.id)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="panel inset-panel">
                  <div className="panel-header">
                    <h4>Gameplay</h4>
                    <ColumnVisibilityManager
                      title="Spalten"
                      columns={multiSeasonGameplayColumns}
                      isVisible={(columnId, visibleByDefault) => isTableColumnVisible("multiSeasonGameplayTable", columnId, visibleByDefault)}
                      onToggle={(columnId, nextVisible) => setTableColumnVisible("multiSeasonGameplayTable", columnId, nextVisible)}
                      onMove={(columnId, direction) => moveTableColumn("multiSeasonGameplayTable", columnId, direction, multiSeasonGameplayColumns)}
                      getWidth={(column) => getTableColumnWidth("multiSeasonGameplayTable", column)}
                      onStepWidth={(column, delta) => adjustTableColumnWidth("multiSeasonGameplayTable", column, delta)}
                      onResetWidth={(column) => resetTableColumnWidth("multiSeasonGameplayTable", column)}
                      onResetToDefault={() => resetTableLayout("multiSeasonGameplayTable", multiSeasonGameplayColumns)}
                    />
                  </div>
                  <div className="compact-table-shell">
                    <table className="compact-table balance-table">
                      <thead>
                        <tr>
                          {visibleMultiSeasonGameplayColumns.map((column) => (
                            <th
                              key={column.id}
                              style={{ width: getTableColumnWidth("multiSeasonGameplayTable", column), minWidth: getTableColumnWidth("multiSeasonGameplayTable", column) }}
                              {...getTableHeaderDragProps("multiSeasonGameplayTable", column, multiSeasonGameplayColumns)}
                            >
                              <SortableHeader label={column.label} tableId="multiSeasonGameplayTable" columnKey={column.dataKey} sortState={tableSorts.multiSeasonGameplayTable} onToggle={toggleTableSort} />
                              <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("multiSeasonGameplayTable", column, event)} onDoubleClick={() => resetTableColumnWidth("multiSeasonGameplayTable", column)} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedMultiSeasonGameplayRows.map((row) => (
                          <tr key={row.metric}>
                            {visibleMultiSeasonGameplayColumns.map((column) => (
                              <td key={`${row.metric}-${column.id}`}>{renderMultiSeasonGameplayCell(row, column.id)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            </section>

            <section className="panel cockpit-feature-audit" data-testid="feature-audit-matrix">
              <div className="panel-header">
                <div className="stack season-panel-head">
                  <h3>Feature Audit</h3>
                  <p className="muted">
                    Lebende Matrix fuer Kernfeatures, Tests, Smokes, Write-Safety, Multiplayer-Stand und bekannte Luecken.
                  </p>
                </div>
                <div className="cockpit-actions balance-export-links">
                  <a className="secondary-button" href="/outputs/feature-audit-matrix.md">
                    Markdown
                  </a>
                  <a className="secondary-button" href="/outputs/feature-audit-matrix.csv">
                    CSV
                  </a>
                </div>
              </div>

              <div className="metric-grid cockpit-summary-grid">
                <article className="metric-card feature-audit-summary-card">
                  <span>Features</span>
                  <strong>{featureAuditMatrix.summary.total}</strong>
                  <small>zentral erfasst</small>
                </article>
                <article className="metric-card feature-audit-summary-card is-good">
                  <span>Sandbox+</span>
                  <strong>{featureAuditMatrix.summary.sandboxReadyOrBetter}</strong>
                  <small>sandbox/multiplayer/prod</small>
                </article>
                <article className="metric-card feature-audit-summary-card is-warning">
                  <span>Preview</span>
                  <strong>{featureAuditMatrix.summary.previewOnly}</strong>
                  <small>noch nicht voll angewendet</small>
                </article>
                <article className="metric-card feature-audit-summary-card is-danger">
                  <span>Blocker</span>
                  <strong>{featureAuditMatrix.summary.blockerCount}</strong>
                  <small>offene Punkte</small>
                </article>
                <article className="metric-card feature-audit-summary-card">
                  <span>Tests fehlen</span>
                  <strong>{featureAuditMatrix.summary.missingTests}</strong>
                  <small>test_missing</small>
                </article>
                <article className="metric-card feature-audit-summary-card">
                  <span>Smoke fehlt</span>
                  <strong>{featureAuditMatrix.summary.missingSmoke}</strong>
                  <small>smoke_missing</small>
                </article>
                <article className="metric-card feature-audit-summary-card">
                  <span>Write-Safety fehlt</span>
                  <strong>{featureAuditMatrix.summary.localWriteWithoutWriteSafety}</strong>
                  <small>local_write ohne Gate</small>
                </article>
                <article className="metric-card feature-audit-summary-card">
                  <span>MP fehlt</span>
                  <strong>{featureAuditMatrix.summary.multiplayerMissing}</strong>
                  <small>noch nicht room-ready</small>
                </article>
              </div>

              <div className="feature-audit-filterbar" aria-label="Feature Audit Filter">
                {featureAuditFilters.map((filter) => (
                  <button
                    key={filter.id}
                    className={`secondary-button inline-button${featureAuditFilter === filter.id ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setFeatureAuditFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {featureAuditMatrix.summary.topBlockers.length > 0 ? (
                <div className="feature-audit-blocker-strip" data-testid="feature-audit-top-blockers">
                  {featureAuditMatrix.summary.topBlockers.slice(0, 5).map((blocker) => (
                    <span key={`${blocker.featureId}-${blocker.blocker}`} className="pill warning-pill">
                      {blocker.label}: {formatCockpitReason(blocker.blocker)}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="compact-table-shell feature-audit-table-shell">
                <table className="compact-table feature-audit-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Status</th>
                      <th>Tests</th>
                      <th>Smoke</th>
                      <th>Write Safety</th>
                      <th>Multiplayer</th>
                      <th>Blocker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeatureAuditEntries.map((entry) => {
                      const flags = getFeatureAuditFlags(entry);
                      return (
                        <tr key={entry.featureId}>
                          <td>
                            <strong>{entry.label}</strong>
                            <small>
                              {entry.category} · {entry.views.slice(0, 4).join(", ")}
                            </small>
                          </td>
                          <td>
                            <span className={`pill feature-audit-status is-${entry.status}`}>
                              {formatFeatureAuditStatus(entry.status)}
                            </span>
                          </td>
                          <td>
                            <span className={`pill${flags.missingTests ? " warning-pill" : ""}`}>
                              {flags.missingTests ? "test_missing" : `${entry.testCoverage.length} Tests`}
                            </span>
                          </td>
                          <td>
                            <span className={`pill${flags.missingSmoke ? " warning-pill" : ""}`}>
                              {flags.missingSmoke ? "smoke_missing" : entry.smokeCoverage.slice(0, 2).join(", ")}
                            </span>
                          </td>
                          <td>
                            <span className={`pill${flags.localWriteWithoutWriteSafety ? " warning-pill" : ""}`}>
                              {flags.localWriteWithoutWriteSafety ? "missing" : entry.writeSafety}
                            </span>
                          </td>
                          <td>
                            <span className={`pill${entry.multiplayerReady ? " success-pill" : " warning-pill"}`}>
                              {entry.multiplayerReady ? "ready" : "missing"}
                            </span>
                          </td>
                          <td>
                            {entry.knownBlockers.length > 0 ? (
                              <span>{entry.knownBlockers.slice(0, 2).map(formatCockpitReason).join(" · ")}</span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="cockpit-topbar">
              <article className="panel cockpit-overview-card">
                <div className="panel-header">
                  <div>
                    <h3>Aktueller Stand</h3>
                    <p className="muted">Kompakter Leitstand für den aktiven Matchday und den nächsten sinnvollen Schritt.</p>
                  </div>
                </div>
                <div className="cockpit-flow-strip">
                  {cockpitFlowChecklist.map((step) => (
                    <div
                      key={step.label}
                      className={`cockpit-flow-item${step.done ? " is-done" : ""}${step.active ? " is-active" : ""}`}
                    >
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
                <div className="metric-grid cockpit-summary-grid">
                  <article className="metric-card">
                    <span>Save</span>
                    <strong>{activeSaveName}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Matchday</span>
                    <strong>{currentMatchdayDisplayLabel}</strong>
                  </article>
                  <article className="metric-card">
                    <span>D1 / D2</span>
                    <strong>
                      {currentMatchdayDisciplineSchedule?.discipline1?.displayName ?? "—"} /{" "}
                      {currentMatchdayDisciplineSchedule?.discipline2?.displayName ?? "—"}
                    </strong>
                  </article>
                  <article className="metric-card">
                    <span>Lineups</span>
                    <strong>{getCockpitStatusLabel(cockpitLineupStatus.status)}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Auto-Teams</span>
                    <strong>{aiTeams.length}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Abschlussstatus</span>
                    <strong>{cockpitOverallStatus}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Nächster Schritt</span>
                    <strong>
                      {cockpitMatchdayAdvanceStatus.status === "ready"
                        ? "Matchday abschließen"
                        : cockpitCashApplyStatus.status === "ready"
                          ? "Cash Apply"
                          : cockpitStandingsApplyStatus.status === "ready"
                            ? "Standings Apply"
                            : cockpitResultApplyStatus.status === "ready"
                              ? "Result Apply"
                              : "Preview / Lineups"}
                    </strong>
                  </article>
                </div>
              </article>

              <article className="panel cockpit-quicklinks-card">
                <div className="panel-header">
                  <div>
                    <h3>Quicklinks</h3>
                    <p className="muted">Die Hauptansichten für Kaufen, Setzen, Prüfen und Anwenden.</p>
                  </div>
                </div>
                <div className="cockpit-link-grid">
                  {cockpitQuickLinks.map((link) => (
                    <button
                      key={link.id}
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        const targetView = link.id === "season" ? "seasonV2" : link.id;
                        setActiveView(targetView);
                        syncFoundationViewInUrl(targetView);
                      }}
                    >
                      {link.label}
                    </button>
                  ))}
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={cockpitBusyKey != null}
                    title={
                      cockpitBusyKey != null
                        ? getCockpitBusyReason()
                        : "Laedt die Season-End-Preview fuer Preisgeld, Rangbewegung und Cash."
                    }
                    onClick={() => {
                      setCockpitBusyKey("resolve-preview");
                      void reloadResolvePreview().finally(() => setCockpitBusyKey(null));
                    }}
                  >
                    Resolve Preview laden
                  </button>
                </div>
              </article>
            </div>

            <div className="cockpit-grid">
              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitSaveStatus.status)}`}>
                <div className="panel-header">
                  <h3>1. Save Status</h3>
                  <span className={getCockpitStatusPillClass(cockpitSaveStatus.status)}>{getCockpitStatusLabel(cockpitSaveStatus.status)}</span>
                </div>
                <p>{cockpitSaveStatus.message}</p>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Aktiver Save: {activeSaveName}</li>
                  <li>Teams: {gameState.teams.length}</li>
                  <li>Season: {gameState.season.id}</li>
                  <li>Matchday: {currentMatchdayDisplayLabel}</li>
                  <li>
                    Matchday-Diszis: {currentMatchdayDisciplineSchedule?.discipline1?.displayName ?? "—"} /{" "}
                    {currentMatchdayDisciplineSchedule?.discipline2?.displayName ?? "—"}
                  </li>
                  <li>Quelle: {readSourceLabel}</li>
                </ul>
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitFreshSeasonStatus.status)}`} data-testid="cockpit-step-fresh-season">
                <div className="panel-header">
                  <h3>2. Fresh Season 1 Status</h3>
                  <span className={getCockpitStatusPillClass(cockpitFreshSeasonStatus.status)}>{getCockpitStatusLabel(cockpitFreshSeasonStatus.status)}</span>
                </div>
                <p>{cockpitFreshSeasonStatus.message}</p>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Punkte = 0: {seasonStandRows.filter((row) => (row.points ?? 0) === 0).length} / {seasonStandRows.length || "—"}</li>
                  <li>Cash = Budget: {seasonStandRows.filter((row) => row.budget != null && row.cash != null && Number(row.budget.toFixed(2)) === Number(row.cash.toFixed(2))).length} / {seasonStandRows.length || "—"}</li>
                  <li>Transfers im Save: {historyFeed?.items.length ?? gameState.transferHistory.length}</li>
                  <li>Stored Results: {gameState.seasonState.matchdayResults?.length ?? 0}</li>
                </ul>
                <button
                  className="secondary-button"
                  data-testid="cockpit-fresh-season-start"
                  type="button"
                  disabled={isSaveBusy || readMeta.readOnly}
                  onClick={() => {
                    const confirmed = window.confirm(
                      "Erstellt einen neuen lokalen Testspielstand fuer Season 1. Bestehende Saves bleiben erhalten.",
                    );
                    if (!confirmed) {
                      return;
                    }

                    setFreshSeasonStartMessage(null);
                    void runSaveAction({
                      action: "fresh-season-1",
                      name: `Fresh Season 1 ${new Date().toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`,
                    });
                  }}
                >
                  Neues Spiel / Season 1 starten
                </button>
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitTransfermarktStatus.status)}`}>
                <div className="panel-header">
                  <h3>3. Transfermarkt Status</h3>
                  <span className={getCockpitStatusPillClass(cockpitTransfermarktStatus.status)}>{getCockpitStatusLabel(cockpitTransfermarktStatus.status)}</span>
                </div>
                <p>{cockpitTransfermarktStatus.message}</p>
                <div className="metric-grid cockpit-mini-grid">
                  <article className="metric-card">
                    <span>Team</span>
                    <strong>{marketSelectedTeam?.name ?? "Team waehlen"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Free Agents</span>
                    <strong>{marketFeed?.items.length ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Kaufvorschau</span>
                    <strong>{marketBuyPreview?.player?.name ?? "—"}</strong>
                  </article>
                </div>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Cash: {marketFeed?.teamContext ? formatMoney(marketFeed.teamContext.teamCash) : "—"}</li>
                  <li>Gehalt: {marketFeed?.teamContext ? formatMoney(marketFeed.teamContext.teamSalary) : "—"}</li>
                  <li>Roster: {marketFeed?.teamContext?.rosterCount ?? "—"}</li>
                  <li>Readiness: {marketFeed?.teamContext?.readinessStatus ?? "—"}</li>
                </ul>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setActiveView("marketV2");
                    syncFoundationViewInUrl("marketV2");
                  }}
                >
                  Transfermarkt oeffnen
                </button>
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitLineupStatus.status)}`}>
                <div className="panel-header">
                  <h3>4. Einsatzlisten Status</h3>
                  <span className={getCockpitStatusPillClass(cockpitLineupStatus.status)}>{getCockpitStatusLabel(cockpitLineupStatus.status)}</span>
                </div>
                <p>{cockpitLineupStatus.message}</p>
                <div className="metric-grid cockpit-mini-grid">
                  <article className="metric-card">
                    <span>Ready</span>
                    <strong>{lineupStatusSummary.readyTeams}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Incomplete</span>
                    <strong>{lineupStatusSummary.incompleteTeams}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Missing</span>
                    <strong>{lineupStatusSummary.missingTeams}</strong>
                  </article>
                  <article className="metric-card">
                    <span>AI Eligible</span>
                    <strong>{aiLineupApplyTeams.length}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Formkarten gesetzt</span>
                    <strong>{lineupModifierStatusSummary.selectedFormCards}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Mutatoren gesetzt</span>
                    <strong>{lineupModifierStatusSummary.selectedMutators}</strong>
                  </article>
                </div>
                <ul className="cockpit-warning-list">
                  <li>Formkarten Source Status: {lineupModifierStatusSummary.formCardSourceStatus}</li>
                  <li>Formkarten Effekt: {lineupModifierStatusSummary.formCardEffectStatus}</li>
                  <li>Mutator Source Status: {lineupModifierStatusSummary.mutatorSourceStatus}</li>
                  <li>Mutator Effekt: {lineupModifierStatusSummary.mutatorEffectStatus}</li>
                </ul>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setActiveView("lineup");
                      syncFoundationViewInUrl("lineup");
                    }}
                  >
                    Einsatzliste oeffnen
                  </button>
                </div>
                <div className="panel inset-panel" style={{ marginTop: 14 }}>
                  <div className="panel-header">
                    <div className="stack">
                      <h4>Matchday Auto-Run</h4>
                      <p className="muted">Fuehrt den lokalen Spieltag bis Ergebnis, Tabelle und naechstem Spieltag aus. Kein Prisma-Write, keine Transfers.</p>
                    </div>
                    <span className={getCockpitStatusPillClass(cockpitAutoRunStatus.status)}>{getCockpitStatusLabel(cockpitAutoRunStatus.status)}</span>
                  </div>
                  <p>{cockpitAutoRunStatus.message}</p>
                  <div className="metric-grid cockpit-mini-grid">
                    <article className="metric-card">
                      <span>Lineups ready</span>
                      <strong>{matchdayAutoRunFeed?.summary.lineupsReady ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>AI ready</span>
                      <strong>{matchdayAutoRunFeed?.summary.aiReady ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Manual ready</span>
                      <strong>{matchdayAutoRunFeed?.summary.manualReady ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Manual fehlt</span>
                      <strong>{matchdayAutoRunFeed?.summary.manualMissing ?? matchdayAutoRunFeed?.summary.missingManualTeams ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Passive ready</span>
                      <strong>{matchdayAutoRunFeed?.summary.passiveReady ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Passive fehlt</span>
                      <strong>{matchdayAutoRunFeed?.summary.passiveMissing ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Warnings</span>
                      <strong>{matchdayAutoRunFeed?.summary.warningTeams ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Tie Blocker</span>
                      <strong>{matchdayAutoRunFeed?.summary.tieBlockers ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Weiter</span>
                      <strong>{matchdayAutoRunFeed ? (matchdayAutoRunFeed.summary.advanceAllowed ? "ja" : "nein") : "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Formkarten</span>
                      <strong>{matchdayAutoRunFeed?.summary.formCardsSelected ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Negative Karten</span>
                      <strong>{matchdayAutoRunFeed?.summary.negativeFormCardsSelected ?? "—"}</strong>
                    </article>
                  </div>
                  <div className="inline-toggle-row" style={{ marginTop: 12 }}>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={matchdayAutoRunIncludeWarningLineups}
                        disabled={readMeta.readOnly || cockpitBusyKey != null}
                        onChange={(event) => setMatchdayAutoRunIncludeWarningLineups(event.target.checked)}
                      />
                      <span>Warning Lineups einschließen</span>
                    </label>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={matchdayAutoRunOverwriteExistingLineups}
                        disabled={readMeta.readOnly || cockpitBusyKey != null}
                        onChange={(event) => setMatchdayAutoRunOverwriteExistingLineups(event.target.checked)}
                      />
                      <span>Bestehende AI-Lineups ueberschreiben</span>
                    </label>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={matchdayAutoRunStopOnTie}
                        disabled={readMeta.readOnly || cockpitBusyKey != null}
                        onChange={(event) => setMatchdayAutoRunStopOnTie(event.target.checked)}
                      />
                      <span>Bei Tie sofort stoppen</span>
                    </label>
                  </div>
                  <div className="cockpit-actions" style={{ marginTop: 12 }}>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={readMeta.readOnly || cockpitBusyKey != null}
                      onClick={() => {
                        void runCockpitMatchdayAutoRun(false);
                      }}
                    >
                      Auto-Run DryRun pruefen
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={
                        readMeta.readOnly ||
                        cockpitBusyKey != null ||
                        !matchdayAutoRunFeed ||
                        !matchdayAutoRunFeed.dryRun ||
                        matchdayAutoRunFeed.status === "blocked"
                      }
                      onClick={() => {
                        const confirmed = window.confirm(
                          "Jetzt den aktuellen Matchday lokal ausführen? Der Auto-Run speichert AI-Lineups, Ergebnis, Tabelle und springt danach zum nächsten Schritt. Preisgeld, Cash und Transferfenster bleiben beim Saisonende.",
                        );
                        if (!confirmed) return;
                        void runCockpitMatchdayAutoRun(true);
                      }}
                    >
                      Spieltag komplett ausführen
                    </button>
                  </div>
                  {matchdayAutoRunFeed ? (
                    <>
                      <ul className="warning-list compact-list cockpit-detail-list" style={{ marginTop: 12 }}>
                        <li>Resolve ready: {String(matchdayAutoRunFeed.summary.resolveReady)}</li>
                        <li>Result Apply erlaubt: {String(matchdayAutoRunFeed.summary.resultApplyAllowed)}</li>
                        <li>Standings Apply erlaubt: {String(matchdayAutoRunFeed.summary.standingsApplyAllowed)}</li>
                        <li>Matchday Advance: {String(matchdayAutoRunFeed.summary.advanceAllowed)}</li>
                        <li>Formkarten im Plan: {matchdayAutoRunFeed.summary.formCardsSelected ?? "—"}</li>
                        <li>Negative Formkarten in Slot 1: {matchdayAutoRunFeed.summary.negativeFormCardsSelected ?? "—"}</li>
                        <li>Preisgeld/Cash: season_end_only</li>
                        <li>Geplante Writes: {matchdayAutoRunFeed.summary.plannedWrites}</li>
                      </ul>
                      <div className="compact-table-shell" style={{ marginTop: 12 }}>
                        <table className="compact-table">
                          <thead>
                            <tr>
                              <th>Step</th>
                              <th>Status</th>
                              <th>Planned</th>
                              <th>Applied</th>
                              <th>Audit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchdayAutoRunFeed.steps.map((step) => (
                              <tr key={`matchday-auto-run-${step.key}`}>
                                <td>{step.label}</td>
                                <td>{getCockpitStatusLabel(mapAutoRunStatusToCockpitStatus(step.status))}</td>
                                <td>{step.plannedWrites}</td>
                                <td>{step.appliedWrites}</td>
                                <td>{step.auditId ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {(matchdayAutoRunFeed.blockingReasons.length || matchdayAutoRunFeed.warnings.length) ? (
                        <ul className="warning-list compact-list cockpit-detail-list cockpit-detail-list-warning" style={{ marginTop: 12 }}>
                          {matchdayAutoRunFeed.blockingReasons.slice(0, 4).map((reason) => (
                            <li key={`auto-run-block-${reason}`}>{formatCockpitReason(reason)}</li>
                          ))}
                          {matchdayAutoRunFeed.warnings.slice(0, 3).map((warning) => (
                            <li key={`auto-run-warning-${warning}`}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="cockpit-actions" style={{ marginTop: 12 }}>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            setActiveView("lineup");
                            syncFoundationViewInUrl("lineup");
                          }}
                        >
                          Einsatzliste öffnen
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            setActiveView("season");
                            syncFoundationViewInUrl("season");
                          }}
                        >
                          Saisonstand öffnen
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="muted" style={{ marginTop: 10 }}>
                      DryRun zeigt AI-Lineups, Resolve, Result Apply und Standings im lokalen Matchday-Flow. Preisgeld, Cash und Transferfenster laufen separat am Saisonende.
                    </p>
                  )}
                </div>
                <div className="panel inset-panel" style={{ marginTop: 14 }}>
                  <div className="panel-header">
                    <div className="stack">
                      <h4>Season DryRun simulieren</h4>
                      <p className="muted">Simuliert die restliche Saison nur auf einer isolierten lokalen Kopie. Keine echten Writes, kein Prisma.</p>
                    </div>
                    <span className={getCockpitStatusPillClass(cockpitWholeSeasonDryRunStatus.status)}>{getCockpitStatusLabel(cockpitWholeSeasonDryRunStatus.status)}</span>
                  </div>
                  <p>{cockpitWholeSeasonDryRunStatus.message}</p>
                  <div className="metric-grid cockpit-mini-grid">
                    <article className="metric-card">
                      <span>Simulierte Spieltage</span>
                      <strong>{wholeSeasonDryRunFeed?.simulatedMatchdays ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Blockiert ab</span>
                      <strong>{wholeSeasonDryRunFeed?.blockedAtMatchday?.label ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Tie Blocker</span>
                      <strong>{wholeSeasonDryRunFeed?.tieBlockers ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Fehlende Manuals</span>
                      <strong>{wholeSeasonDryRunFeed?.missingManualLineups ?? "—"}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Fehlende AI</span>
                      <strong>{wholeSeasonDryRunFeed?.missingAiLineups ?? "—"}</strong>
                    </article>
                  </div>
                  <div className="inline-toggle-row" style={{ marginTop: 12 }}>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={wholeSeasonIncludeWarningLineups}
                        disabled={readMeta.readOnly || cockpitBusyKey != null}
                        onChange={(event) => setWholeSeasonIncludeWarningLineups(event.target.checked)}
                      />
                      <span>Warning Lineups einschließen</span>
                    </label>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={wholeSeasonOverwriteExistingLineups}
                        disabled={readMeta.readOnly || cockpitBusyKey != null}
                        onChange={(event) => setWholeSeasonOverwriteExistingLineups(event.target.checked)}
                      />
                      <span>Bestehende AI-Lineups simuliert überschreiben</span>
                    </label>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={wholeSeasonStopOnTie}
                        disabled={readMeta.readOnly || cockpitBusyKey != null}
                        onChange={(event) => setWholeSeasonStopOnTie(event.target.checked)}
                      />
                      <span>Bei Tie stoppen</span>
                    </label>
                  </div>
                  <div className="cockpit-actions" style={{ marginTop: 12 }}>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={readMeta.readOnly || cockpitBusyKey != null}
                      onClick={() => {
                        void runCockpitWholeSeasonDryRun();
                      }}
                    >
                      Season DryRun simulieren
                    </button>
                  </div>
                  {wholeSeasonDryRunFeed ? (
                    <>
                      <ul className="warning-list compact-list cockpit-detail-list" style={{ marginTop: 12 }}>
                        <li>Read only: {String(wholeSeasonDryRunFeed.readOnly)}</li>
                        <li>Simulation: {wholeSeasonDryRunFeed.simulationMode}</li>
                        <li>Start: {wholeSeasonDryRunFeed.scope.startMatchdayId}</li>
                        <li>Spieltage gesamt: {wholeSeasonDryRunFeed.scope.totalMatchdays}</li>
                        <li>Max Matchdays: {wholeSeasonDryRunFeed.scope.maxMatchdays ?? "—"}</li>
                        <li>Warnings: {wholeSeasonDryRunFeed.warnings.length}</li>
                        <li>Snapshot: {wholeSeasonDryRunFeed.snapshotReadiness.status}</li>
                        <li>Player PPs: {wholeSeasonDryRunFeed.playerPPsReconciliation.status}</li>
                        <li>Team PPs: {wholeSeasonDryRunFeed.teamPPsReconciliation.status}</li>
                      </ul>
                      <div className="metric-grid cockpit-mini-grid" style={{ marginTop: 12 }}>
                        <article className="metric-card">
                          <span>AI bereit</span>
                          <strong>{wholeSeasonDryRunFeed.aiTeamsReady}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Manual bereit</span>
                          <strong>{wholeSeasonDryRunFeed.manualTeamsReady}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Passive bereit</span>
                          <strong>{wholeSeasonDryRunFeed.passiveTeamsReady}</strong>
                        </article>
                        <article className="metric-card">
                          <span>AI disabled</span>
                          <strong>{wholeSeasonDryRunFeed.skippedDisabledAiTeams}</strong>
                        </article>
                      </div>
                      <div className="compact-table-shell" style={{ marginTop: 12 }}>
                        <table className="compact-table">
                          <thead>
                            <tr>
                              <th>Spieltag</th>
                              <th>Status</th>
                              <th>Lineups</th>
                              <th>Manual fehlt</th>
                              <th>Warnings</th>
                              <th>Ties</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wholeSeasonDryRunFeed.matchdays.map((matchday) => (
                              <tr key={`whole-season-${matchday.matchdayId}`}>
                                <td>{matchday.label}</td>
                                <td>{getCockpitStatusLabel(mapAutoRunStatusToCockpitStatus(matchday.status))}</td>
                                <td>{matchday.lineupsReady}</td>
                                <td>{matchday.missingManualTeams}</td>
                                <td>{matchday.warningTeams}</td>
                                <td>{matchday.tieBlockers}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="compact-table-shell" style={{ marginTop: 12 }}>
                        <table className="compact-table">
                          <thead>
                            <tr>
                              <th>Platz</th>
                              <th>Team</th>
                              <th>Punkte</th>
                              <th>Cash</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wholeSeasonDryRunFeed.projectedFinalStandings.slice(0, 12).map((row) => (
                              <tr key={`whole-season-standing-${row.teamId}`} onClick={() => openTeamProfileById(row.teamId)}>
                                <td>{row.rank ?? "—"}</td>
                                <td>{row.teamName}</td>
                                <td>{row.points ?? "—"}</td>
                                <td>{row.cash ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="metric-grid cockpit-mini-grid" style={{ marginTop: 12 }}>
                        <article className="metric-card">
                          <span>Snapshot fertig</span>
                          <strong>
                            {wholeSeasonDryRunFeed.snapshotReadiness.completedMatchdays}/
                            {wholeSeasonDryRunFeed.snapshotReadiness.totalMatchdays}
                          </strong>
                        </article>
                        <article className="metric-card">
                          <span>Team PPs ok</span>
                          <strong>{wholeSeasonDryRunFeed.teamPPsReconciliation.reconciledTeams}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Team PPs fail</span>
                          <strong>{wholeSeasonDryRunFeed.teamPPsReconciliation.failedTeams}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Spieler mit PPs</span>
                          <strong>{wholeSeasonDryRunFeed.playerPPsReconciliation.playersWithPoints}</strong>
                        </article>
                      </div>
                      {(wholeSeasonDryRunFeed.blockingReasons.length || wholeSeasonDryRunFeed.warnings.length) ? (
                        <ul className="warning-list compact-list cockpit-detail-list cockpit-detail-list-warning" style={{ marginTop: 12 }}>
                          {wholeSeasonDryRunFeed.blockingReasons.slice(0, 4).map((reason) => (
                            <li key={`whole-season-block-${reason}`}>{formatCockpitReason(reason)}</li>
                          ))}
                          {wholeSeasonDryRunFeed.warnings.slice(0, 4).map((warning) => (
                            <li key={`whole-season-warning-${warning}`}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                      {(wholeSeasonDryRunFeed.missingFormulaSources.length ||
                        wholeSeasonDryRunFeed.missingPerformanceSources.length ||
                        wholeSeasonDryRunFeed.snapshotReadiness.blockingReasons.length ||
                        wholeSeasonDryRunFeed.playerPPsReconciliation.warnings.length ||
                        wholeSeasonDryRunFeed.teamPPsReconciliation.warnings.length) ? (
                        <ul className="warning-list compact-list cockpit-detail-list" style={{ marginTop: 12 }}>
                          {wholeSeasonDryRunFeed.marketPhaseStatus.warning ? (
                            <li>{wholeSeasonDryRunFeed.marketPhaseStatus.warning}</li>
                          ) : null}
                          {wholeSeasonDryRunFeed.missingFormulaSources.map((warning) => (
                            <li key={`whole-season-formula-${warning}`}>{warning}</li>
                          ))}
                          {wholeSeasonDryRunFeed.missingPerformanceSources.map((warning) => (
                            <li key={`whole-season-performance-${warning}`}>{warning}</li>
                          ))}
                          {wholeSeasonDryRunFeed.snapshotReadiness.blockingReasons.map((reason) => (
                            <li key={`whole-season-snapshot-${reason}`}>{formatCockpitReason(reason)}</li>
                          ))}
                          {wholeSeasonDryRunFeed.playerPPsReconciliation.warnings.slice(0, 2).map((warning) => (
                            <li key={`whole-season-player-pps-${warning}`}>{warning}</li>
                          ))}
                          {wholeSeasonDryRunFeed.teamPPsReconciliation.warnings.slice(0, 2).map((warning) => (
                            <li key={`whole-season-team-pps-${warning}`}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p className="muted" style={{ marginTop: 10 }}>
                      Die Simulation nutzt die bestehende Matchday-Kette auf einer isolierten In-Memory-Kopie und zeigt Blocker frueh an.
                    </p>
                  )}
                </div>
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(
                rosterFillFeed?.status === "applied"
                  ? "ready"
                  : rosterFillFeed?.status === "blocked"
                    ? "blocked"
                    : rosterFillFeed?.status === "warning"
                      ? "warning"
                      : "open",
              )}`}>
                <div className="panel-header">
                  <div className="stack">
                    <h3>5. Alle Teams auf Zielkader bringen</h3>
                    <p className="muted">Vor jedem Matchday-Scoring werden alle 32 Teams im aktiven Save ueber echte lokale Kauefe auf ihre Zielspieleranzahl gebracht. Keine stillen Kader-Inserts, keine Fremd-Saves.</p>
                  </div>
                  <span className={getCockpitStatusPillClass(
                    rosterFillFeed?.status === "applied"
                      ? "ready"
                      : rosterFillFeed?.status === "blocked"
                        ? "blocked"
                        : rosterFillFeed?.status === "warning"
                          ? "warning"
                          : "open",
                  )}>
                    {getCockpitStatusLabel(
                      rosterFillFeed?.status === "applied"
                        ? "ready"
                        : rosterFillFeed?.status === "blocked"
                          ? "blocked"
                          : rosterFillFeed?.status === "warning"
                            ? "warning"
                            : "open",
                    )}
                  </span>
                </div>
                <p>MW und Gehaelter laufen ueber die interne Economy-/Vertragsberechnung. Fuer diesen expliziten Matchday-Setup-Schritt duerfen auch manuelle Teams aufgefuellt werden, aber nur ueber den echten lokalen Buy-Pfad mit Cash-, Gehalts- und Historien-Spur.</p>
                <div className="metric-grid cockpit-mini-grid">
                  <article className="metric-card">
                    <span>Teams gesamt</span>
                    <strong>{rosterFillFeed?.summary.totalTeams ?? gameState.teams.length}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Target gefunden</span>
                    <strong>{rosterFillFeed?.summary.targetResolvedTeams ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Target fehlt</span>
                    <strong>{rosterFillFeed?.summary.missingTargetTeams ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Teams mit Kaufbedarf</span>
                    <strong>{rosterFillFeed?.summary.teamsNeedingBuys ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Geplante Kaeufe</span>
                    <strong>{rosterFillFeed?.summary.plannedBuys ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Ausgefuehrte Kaeufe</span>
                    <strong>{rosterFillFeed?.summary.appliedBuys ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Historien-IDs</span>
                    <strong>{rosterFillFeed?.summary.historyWrites ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Schon voll</span>
                    <strong>{rosterFillFeed?.summary.alreadyAtTargetTeams ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Partial / blockiert</span>
                    <strong>{rosterFillFeed ? `${rosterFillFeed.summary.partialTeams} / ${rosterFillFeed.summary.blockedTeams}` : "—"}</strong>
                  </article>
                </div>
                <div className="transfer-context-banner" style={{ marginTop: 12 }}>
                  <strong>Save-Scope</strong>
                  <span>
                    Save {rosterFillFeed?.saveContext?.saveName ?? activeSaveName} ·{" "}
                    {inferSaveTypeLabel(rosterFillFeed?.saveContext ?? activeSaveSummary)}. Angefragt:{" "}
                    {rosterFillFeed?.saveContext?.requestedSaveId ?? activeSaveId} /{" "}
                    {rosterFillFeed?.saveContext?.requestedSeasonId ?? gameState.season.id}. Aufgeloest:{" "}
                    {rosterFillFeed?.saveContext?.resolvedSaveId ?? activeSaveId} /{" "}
                    {rosterFillFeed?.saveContext?.resolvedSeasonId ?? gameState.season.id}. Nur dieser lokale Save wird angefasst, Prisma bleibt read-only.
                  </span>
                </div>
                {rosterFillFeed?.saveContext?.scopeWarning ? (
                  <div className="transfer-callout is-warning" style={{ marginTop: 12 }}>
                    <strong>Scope-Warnung</strong>
                    <span>{rosterFillFeed.saveContext.scopeWarning}</span>
                  </div>
                ) : null}
                <div className="cockpit-actions" style={{ marginTop: 12 }}>
                  <label className="inline-checkbox" style={{ marginRight: 12 }}>
                    <input
                      type="checkbox"
                      checked={matchdayMvpForceReplaceExisting}
                      disabled={readMeta.readOnly || cockpitBusyKey != null}
                      onChange={(event) => setMatchdayMvpForceReplaceExisting(event.target.checked)}
                    />
                    <span>Bestehendes Matchday-1-Resultat ersetzen</span>
                  </label>
                </div>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null || rosterFillBusy}
                    onClick={() => {
                      void runCockpitRosterFill(false);
                    }}
                  >
                    Roster-Fill DryRun
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={
                      readMeta.readOnly ||
                      cockpitBusyKey != null ||
                      rosterFillBusy ||
                      !rosterFillFeed ||
                      !rosterFillFeed.dryRun ||
                      rosterFillFeed.summary.plannedBuys === 0
                    }
                    onClick={() => {
                      if (!rosterFillFeed?.dryRun) {
                        return;
                      }
                      const confirmed = window.confirm(
                        `Jetzt ${rosterFillFeed.summary.plannedBuys} echte lokale Kaeufe ausfuehren, um alle Teams fuer Matchday 1 auf Zielgroesse zu bringen?`,
                      );
                      if (!confirmed) return;
                      void runCockpitRosterFill(true);
                    }}
                  >
                    Alle Teams lokal auffuellen
                  </button>
                </div>
                {rosterFillFeed ? (
                  <>
                    <ul className="warning-list compact-list cockpit-detail-list" style={{ marginTop: 12 }}>
                      <li>Target gefunden: {rosterFillFeed.summary.targetResolvedTeams}</li>
                      <li>Teams mit Kaufbedarf: {rosterFillFeed.summary.teamsNeedingBuys}</li>
                      <li>Schon voll: {rosterFillFeed.summary.alreadyAtTargetTeams}</li>
                      <li>Historien-Eintraege: {rosterFillFeed.summary.historyWrites}</li>
                    </ul>
                    {(rosterFillFeed.warnings.length || rosterFillFeed.blockingReasons.length) ? (
                      <ul className="warning-list compact-list cockpit-detail-list cockpit-detail-list-warning">
                        {rosterFillFeed.warnings.slice(0, 4).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                        {rosterFillFeed.blockingReasons.slice(0, 4).map((reason) => (
                          <li key={reason}>{formatCockpitReason(reason)}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="compact-table-shell" style={{ marginTop: 12 }}>
                      <table className="compact-table">
                        <thead>
                          <tr>
                            <th>Team</th>
                            <th>Mode</th>
                            <th>Vorher</th>
                            <th>Ziel</th>
                            <th>Nachher</th>
                            <th>Cash</th>
                            <th>Gehalt</th>
                            <th>Kauefe</th>
                            <th>Historie</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rosterFillFeed.teams.map((entry) => (
                            <tr key={`roster-fill-${entry.teamId}`} onClick={() => openTeamProfileById(entry.teamId)}>
                              <td>{entry.teamName}</td>
                              <td>{entry.controlMode}</td>
                              <td>{entry.rosterBefore}</td>
                              <td>{entry.targetRosterSize ?? "—"}</td>
                              <td>{entry.rosterAfter}</td>
                              <td>{`${formatNullableMoney(entry.cashBefore)} -> ${formatNullableMoney(entry.cashAfter)}`}</td>
                              <td>{`${formatNullableMoney(entry.salaryBefore)} -> ${formatNullableMoney(entry.salaryAfter)}`}</td>
                              <td>
                                {entry.acquiredPlayers.length > 0
                                  ? entry.acquiredPlayers
                                      .map((player) => `${player.playerName}${player.status === "planned" ? " (plan)" : ""}`)
                                      .join(", ")
                                  : "—"}
                              </td>
                              <td>{entry.transferHistoryIds.length > 0 ? entry.transferHistoryIds.join(", ") : "—"}</td>
                              <td>{entry.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {rosterFillFeed.executed ? (
                      <p className="muted" style={{ marginTop: 10 }}>
                        Jeder erfolgreiche Setup-Kauf muss im selben Save sofort in Transferhistorie, Transfer Recap, Cash, Gehalt und Kadergroesse sichtbar sein.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="muted" style={{ marginTop: 10 }}>
                    Dieser Schritt liest pro Team die echte Zielspieleranzahl, plant nur reale Kaeufe im aktuellen Save und zieht erst danach die Matchday-Logik nach.
                  </p>
                )}
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitAiLineupStatus.status)}`}>
                <div className="panel-header">
                  <div className="stack">
                    <h3>6. Auto-Teams aufstellen</h3>
                    <p className="muted">Nur automatisch gefuehrte Teams mit aktiver Freigabe werden lokal als Einsatzliste gespeichert.</p>
                  </div>
                  <span className={getCockpitStatusPillClass(cockpitAiLineupStatus.status)}>{getCockpitStatusLabel(cockpitAiLineupStatus.status)}</span>
                </div>
                <p>{cockpitAiLineupStatus.message}</p>
                <div className="metric-grid cockpit-mini-grid">
                  <article className="metric-card">
                    <span>Auto bereit</span>
                    <strong>{cockpitAiBatchApplyFeed?.summary.aiEligibleTeams ?? aiLineupApplyTeams.length}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Gefuehrte uebersprungen</span>
                    <strong>{cockpitAiBatchApplyFeed?.summary.skippedManual ?? manualTeams.length}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Beobachtete uebersprungen</span>
                    <strong>{cockpitAiBatchApplyFeed?.summary.skippedPassive ?? passiveTeams.length}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Auto aus</span>
                    <strong>{cockpitAiBatchApplyFeed?.summary.skippedDisabled ?? Math.max(aiTeams.length - aiLineupApplyTeams.length, 0)}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Speicherbereit</span>
                    <strong>{cockpitAiBatchApplyFeed?.summary.readyToSave ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Hinweise</span>
                    <strong>{cockpitAiBatchApplyFeed?.summary.warningTeams ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Existing</span>
                    <strong>{cockpitAiBatchApplyFeed?.summary.existingLineups ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Saved</span>
                    <strong>{cockpitAiBatchApplyFeed?.summary.savedTeams ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Skipped</span>
                    <strong>
                      {cockpitAiBatchApplyFeed
                        ? cockpitAiBatchApplyFeed.summary.skippedManual +
                          cockpitAiBatchApplyFeed.summary.skippedPassive +
                          cockpitAiBatchApplyFeed.summary.skippedDisabled +
                          cockpitAiBatchApplyFeed.summary.skippedWarning +
                          cockpitAiBatchApplyFeed.summary.skippedBlocked +
                          cockpitAiBatchApplyFeed.summary.skippedExisting
                        : "—"}
                    </strong>
                  </article>
                </div>
                <div className="transfer-context-banner" style={{ marginTop: 12 }}>
                  <strong>Nur Einsatzlisten</strong>
                  <span>Manual und Passive Teams bleiben unveraendert. Es gibt hier keine Result-, Standings- oder Cash-Aktion.</span>
                </div>
                <div className="inline-toggle-row" style={{ marginTop: 12 }}>
                  <label className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={cockpitAiIncludeWarningTeams}
                      disabled={readMeta.readOnly || cockpitBusyKey != null}
                      onChange={(event) => setCockpitAiIncludeWarningTeams(event.target.checked)}
                    />
                    <span>Warning Teams einschließen</span>
                  </label>
                  <label className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={cockpitAiOverwriteExisting}
                      disabled={readMeta.readOnly || cockpitBusyKey != null}
                      onChange={(event) => setCockpitAiOverwriteExisting(event.target.checked)}
                    />
                    <span>Bestehende Lineups ueberschreiben</span>
                  </label>
                </div>
                <div className="cockpit-actions" style={{ marginTop: 12 }}>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null || Math.max(aiTeams.length - aiLineupApplyTeams.length, 0) === 0}
                    onClick={enableAiLineupApplyForAiTeams}
                  >
                    Auto-Aufstellungen aktivieren
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null}
                    onClick={() => {
                      void runCockpitAiLineupBatchApply(false);
                    }}
                  >
                    DryRun prüfen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={
                      readMeta.readOnly ||
                      cockpitBusyKey != null ||
                      !cockpitAiBatchApplyFeed ||
                      !cockpitAiBatchApplyFeed.dryRun ||
                      cockpitAiBatchApplyFeed.summary.plannedLineups === 0
                    }
                    onClick={() => {
                      if (!cockpitAiBatchApplyFeed?.dryRun) {
                        return;
                      }
                      const warningHint = cockpitAiIncludeWarningTeams
                        ? " Warning-Teams werden eingeschlossen."
                        : "";
                      const overwriteHint =
                        cockpitAiOverwriteExisting && cockpitAiBatchApplyFeed.summary.wouldOverwrite > 0
                          ? ` ${cockpitAiBatchApplyFeed.summary.wouldOverwrite} bestehende Einsatzlisten werden ersetzt.`
                          : "";
                      const confirmed = window.confirm(
                        `Jetzt ${cockpitAiBatchApplyFeed.summary.plannedLineups} AI-Lineups lokal speichern?${warningHint}${overwriteHint}`,
                      );
                      if (!confirmed) return;
                      void runCockpitAiLineupBatchApply(true);
                    }}
                  >
                    AI-Lineups lokal speichern
                  </button>
                </div>
                {cockpitAiBatchApplyFeed ? (
                  <>
                    <ul className="warning-list compact-list cockpit-detail-list" style={{ marginTop: 12 }}>
                      <li>AI Eligible: {cockpitAiBatchApplyFeed.summary.aiEligibleTeams}</li>
                      <li>Manual uebersprungen: {cockpitAiBatchApplyFeed.summary.skippedManual}</li>
                      <li>Passive uebersprungen: {cockpitAiBatchApplyFeed.summary.skippedPassive}</li>
                      <li>Disabled uebersprungen: {cockpitAiBatchApplyFeed.summary.skippedDisabled}</li>
                      <li>Ready to Save: {cockpitAiBatchApplyFeed.summary.readyToSave}</li>
                      <li>Warnings: {cockpitAiBatchApplyFeed.summary.warningTeams}</li>
                      <li>Existing: {cockpitAiBatchApplyFeed.summary.existingLineups}</li>
                      <li>Saved: {cockpitAiBatchApplyFeed.summary.savedTeams}</li>
                      <li>Skipped: {cockpitAiBatchApplyFeed.summary.skippedWarning + cockpitAiBatchApplyFeed.summary.skippedBlocked + cockpitAiBatchApplyFeed.summary.skippedExisting}</li>
                    </ul>
                    {(cockpitAiBatchApplyFeed.summary.warnings.length || cockpitAiBatchApplyFeed.summary.blockingReasons.length) ? (
                      <ul className="warning-list compact-list cockpit-detail-list cockpit-detail-list-warning">
                        {cockpitAiBatchApplyFeed.summary.warnings.slice(0, 2).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                        {cockpitAiBatchApplyFeed.summary.blockingReasons.slice(0, 3).map((reason) => (
                          <li key={reason}>{formatCockpitReason(reason)}</li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="muted" style={{ marginTop: 10 }}>
                    DryRun zeigt zuerst, welche AI-Teams gespeichert wuerden und welche Manual-/Passive-Teams geschuetzt bleiben.
                  </p>
                )}
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitMatchdayMvpScoringStatus.status)}`}>
                <div className="panel-header">
                  <div className="stack">
                    <h3>7. Matchday 1 MVP-Scoring</h3>
                    <p className="muted">Dieser Slice liest die zwei echten Matchday-Disziplinen, erzeugt bei Bedarf klar markierte Auto-Lineups aus echten aktiven Spielern und schreibt D1, D2 und Saisonstand lokal in denselben Save.</p>
                  </div>
                  <span className={getCockpitStatusPillClass(cockpitMatchdayMvpScoringStatus.status)}>
                    {getCockpitStatusLabel(cockpitMatchdayMvpScoringStatus.status)}
                  </span>
                </div>
                <p>{cockpitMatchdayMvpScoringStatus.message}</p>
                <div className="transfer-context-banner" style={{ marginTop: 12 }}>
                  <strong>Save-Scope</strong>
                  <span>
                    Save {activeSaveName} · Matchday 1 only. Kein Fallback auf Fremd-Saves, kein Prisma-Write, keine Fake-Mutatoren. Wenn Captain, Form oder Fatigue fehlen, bleibt der Slice bei echtem Base Score und kennzeichnet das sichtbar.
                  </span>
                </div>
                <div className="metric-grid cockpit-mini-grid" style={{ marginTop: 12 }}>
                  <article className="metric-card">
                    <span>Teams</span>
                    <strong>{matchdayMvpScoringFeed?.lineupSummary.totalTeams ?? gameState.teams.length}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Bestehende Lineups</span>
                    <strong>{matchdayMvpScoringFeed?.lineupSummary.existingLineups ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Auto-Lineups</span>
                    <strong>{matchdayMvpScoringFeed?.lineupSummary.autoGeneratedLineups ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Blockierte Teams</span>
                    <strong>{matchdayMvpScoringFeed?.lineupSummary.blockedTeams ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Unter Minimum 7</span>
                    <strong>{matchdayMvpScoringFeed?.rosterGate.teamsBelowMinimum ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Unter Wunschkader</span>
                    <strong>{matchdayMvpScoringFeed?.rosterGate.teamsBelowTarget ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Wunschkader fehlt</span>
                    <strong>{matchdayMvpScoringFeed?.rosterGate.teamsMissingTarget ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>D1</span>
                    <strong>{matchdayMvpScoringFeed?.targetMatchday.d1DisciplineName ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>D2</span>
                    <strong>{matchdayMvpScoringFeed?.targetMatchday.d2DisciplineName ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Teams gescored</span>
                    <strong>{matchdayMvpScoringFeed?.totalTeamsScored ?? "—"}</strong>
                  </article>
                </div>
                <div className="cockpit-actions" style={{ marginTop: 12 }}>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null}
                    onClick={() => {
                      void runCockpitMatchdayMvpScoring(false);
                    }}
                  >
                    Matchday-1 DryRun
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={
                      readMeta.readOnly ||
                      cockpitBusyKey != null ||
                      !matchdayMvpScoringFeed ||
                      !matchdayMvpScoringFeed.dryRun ||
                      matchdayMvpScoringFeed.status === "blocked" ||
                      (matchdayMvpScoringFeed.resultApply.replacedExisting && !matchdayMvpForceReplaceExisting)
                    }
                    onClick={() => {
                      if (!matchdayMvpScoringFeed?.dryRun) {
                        return;
                      }
                      const replaceHint = matchdayMvpScoringFeed.resultApply.replacedExisting
                        ? " Das bestehende Matchday-1-Resultat wird kontrolliert ersetzt."
                        : "";
                      const confirmed = window.confirm(
                        `Jetzt ${matchdayMvpScoringFeed.targetMatchday.label} lokal durchrechnen und D1/D2 Punkte in den aktiven Save schreiben?${replaceHint}`,
                      );
                      if (!confirmed) return;
                      void runCockpitMatchdayMvpScoring(true);
                    }}
                  >
                    Matchday 1 lokal schreiben
                  </button>
                </div>
                {matchdayMvpScoringFeed ? (
                  <>
                    <ul className="warning-list compact-list cockpit-detail-list" style={{ marginTop: 12 }}>
                      <li>Save: {matchdayMvpScoringFeed.scope.saveId}</li>
                      <li>Season: {matchdayMvpScoringFeed.scope.seasonId}</li>
                      <li>Matchday: {matchdayMvpScoringFeed.targetMatchday.label}</li>
                      <li>Resolve Status: {matchdayMvpScoringFeed.resolveStatus}</li>
                      <li>Mutator Modus: {matchdayMvpScoringFeed.mutatorMode}</li>
                      <li>Matchday-Minimum: 7 aktive Spieler</li>
                      <li>Result Apply: {String(matchdayMvpScoringFeed.resultApply.applied)}</li>
                      <li>Standings Apply: {String(matchdayMvpScoringFeed.standingsApply.applied)}</li>
                    </ul>
                    <ul className="compact-list cockpit-detail-list" style={{ marginTop: 8 }}>
                      <li>
                        Formkarten Quelle:{" "}
                        {matchdayMvpScoringFeed.resolveSources.formCardSourceLabel
                          ? `${matchdayMvpScoringFeed.resolveSources.formCardSourceStatus} · ${matchdayMvpScoringFeed.resolveSources.formCardSourceLabel}`
                          : matchdayMvpScoringFeed.resolveSources.formCardSourceStatus}
                      </li>
                      <li>
                        Mutatoren Quelle:{" "}
                        {matchdayMvpScoringFeed.resolveSources.mutatorSourceLabel
                          ? `${matchdayMvpScoringFeed.resolveSources.mutatorSourceStatus} · ${matchdayMvpScoringFeed.resolveSources.mutatorSourceLabel}`
                          : matchdayMvpScoringFeed.resolveSources.mutatorSourceStatus}
                      </li>
                      <li>Captain Quelle: {matchdayMvpScoringFeed.resolveSources.captainSourceStatus}</li>
                      <li>Fatigue Quelle: {matchdayMvpScoringFeed.resolveSources.fatigueSourceStatus}</li>
                      <li>Team-PP Quelle: {matchdayMvpScoringFeed.resolveSources.teamPpsSourceStatus}</li>
                    </ul>
                    {(matchdayMvpScoringFeed.warnings.length || matchdayMvpScoringFeed.blockingReasons.length) ? (
                      <ul className="warning-list compact-list cockpit-detail-list cockpit-detail-list-warning">
                        {matchdayMvpScoringFeed.warnings.slice(0, 4).map((warning) => (
                          <li key={`matchday-mvp-warning-${warning}`}>{formatMatchdayMvpWarning(warning)}</li>
                        ))}
                        {matchdayMvpScoringFeed.blockingReasons.slice(0, 4).map((reason) => (
                          <li key={`matchday-mvp-blocking-${reason}`}>{formatCockpitReason(reason)}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="compact-table-shell" style={{ marginTop: 12 }}>
                      <table className="compact-table">
                        <thead>
                          <tr>
                            <th>Team</th>
                            <th>Mode</th>
                            <th>Quelle</th>
                            <th>Kader</th>
                            <th>Target</th>
                            <th>Pflicht</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchdayMvpScoringFeed.lineupTeams.map((entry) => (
                            <tr key={`matchday-mvp-lineup-${entry.teamId}`} onClick={() => openTeamProfileById(entry.teamId)}>
                              <td>{entry.teamName}</td>
                              <td>{entry.controlMode}</td>
                              <td>{entry.autoGenerated ? "auto_lineup_source" : "existing_lineup"}</td>
                              <td>{entry.rosterCount}</td>
                              <td>{entry.targetRosterSize ?? "—"}</td>
                              <td>{entry.requiredPlayers}</td>
                              <td>{entry.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="compact-table-shell" style={{ marginTop: 12 }}>
                      <table className="compact-table">
                        <caption style={{ captionSide: "top", textAlign: "left", padding: "0 0 8px 0" }}>
                          D1 Scoreboard · {matchdayMvpScoringFeed.targetMatchday.d1DisciplineName ?? "—"}
                        </caption>
                        <thead>
                          <tr>
                            <th>Rang</th>
                            <th>Team</th>
                            <th>Base</th>
                            <th>Form</th>
                            <th>Mutator 1</th>
                            <th>Mutator 2</th>
                            <th>Captain</th>
                            <th>Fatigue</th>
                            <th>Final</th>
                            <th>Punkte</th>
                            <th>PP Team</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchdayMvpScoringFeed.d1Scoreboard.map((entry) => (
                            <tr key={`matchday-mvp-d1-${entry.teamId}`} onClick={() => openTeamProfileById(entry.teamId)}>
                              <td>{entry.rank}</td>
                              <td>{entry.teamName}</td>
                              <td>{formatLocalePoints(entry.baseScore, 0)}</td>
                              <td>{entry.formCardStatus === "ready" ? formatLocalePoints(entry.formCardModifier, 1) : "missing_source"}</td>
                              <td>{entry.mutator1Label ? `${entry.mutator1Label} · ${formatLocalePoints(entry.mutator1Modifier, 1)}` : "—"}</td>
                              <td>{entry.mutator2Label ? `${entry.mutator2Label} · ${formatLocalePoints(entry.mutator2Modifier, 1)}` : "—"}</td>
                              <td>{entry.captainStatus === "mapped" ? formatLocalePoints(entry.captainModifier, 1) : "missing_source"}</td>
                              <td>{entry.fatigueStatus === "mapped" ? formatLocalePoints(entry.fatigueModifier, 1) : "missing_source"}</td>
                              <td>{formatLocalePoints(entry.score, 0)}</td>
                              <td>{entry.points ?? "—"}</td>
                              <td>{entry.teamPpsStatus === "ready" ? formatLocalePoints(entry.teamPpsModifier, 1) : "missing_source"}</td>
                              <td>{entry.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="compact-table-shell" style={{ marginTop: 12 }}>
                      <table className="compact-table">
                        <caption style={{ captionSide: "top", textAlign: "left", padding: "0 0 8px 0" }}>
                          D2 Scoreboard · {matchdayMvpScoringFeed.targetMatchday.d2DisciplineName ?? "—"}
                        </caption>
                        <thead>
                          <tr>
                            <th>Rang</th>
                            <th>Team</th>
                            <th>Base</th>
                            <th>Form</th>
                            <th>Mutator 1</th>
                            <th>Mutator 2</th>
                            <th>Captain</th>
                            <th>Fatigue</th>
                            <th>Final</th>
                            <th>Punkte</th>
                            <th>PP Team</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchdayMvpScoringFeed.d2Scoreboard.map((entry) => (
                            <tr key={`matchday-mvp-d2-${entry.teamId}`} onClick={() => openTeamProfileById(entry.teamId)}>
                              <td>{entry.rank}</td>
                              <td>{entry.teamName}</td>
                              <td>{formatLocalePoints(entry.baseScore, 0)}</td>
                              <td>{entry.formCardStatus === "ready" ? formatLocalePoints(entry.formCardModifier, 1) : "missing_source"}</td>
                              <td>{entry.mutator1Label ? `${entry.mutator1Label} · ${formatLocalePoints(entry.mutator1Modifier, 1)}` : "—"}</td>
                              <td>{entry.mutator2Label ? `${entry.mutator2Label} · ${formatLocalePoints(entry.mutator2Modifier, 1)}` : "—"}</td>
                              <td>{entry.captainStatus === "mapped" ? formatLocalePoints(entry.captainModifier, 1) : "missing_source"}</td>
                              <td>{entry.fatigueStatus === "mapped" ? formatLocalePoints(entry.fatigueModifier, 1) : "missing_source"}</td>
                              <td>{formatLocalePoints(entry.score, 0)}</td>
                              <td>{entry.points ?? "—"}</td>
                              <td>{entry.teamPpsStatus === "ready" ? formatLocalePoints(entry.teamPpsModifier, 1) : "missing_source"}</td>
                              <td>{entry.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="compact-table-shell" style={{ marginTop: 12 }}>
                      <table className="compact-table">
                        <caption style={{ captionSide: "top", textAlign: "left", padding: "0 0 8px 0" }}>
                          Top 10 Spieler D1
                        </caption>
                        <thead>
                          <tr>
                            <th>Rang</th>
                            <th>Spieler</th>
                            <th>Team</th>
                            <th>Final</th>
                            <th>Punkte</th>
                            <th>Mutator PP</th>
                            <th>Mutator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchdayMvpScoringFeed.d1TopPlayers.map((entry) => (
                            <tr key={`matchday-mvp-top-d1-${entry.playerId}-${entry.rankInDiscipline}`} onClick={() => void openPlayerDrawerById(entry.playerId)}>
                              <td>{entry.rankInDiscipline}</td>
                              <td>{entry.playerName}</td>
                              <td>{entry.teamName}</td>
                              <td>{formatLocalePoints(entry.finalPlayerScore, 1)}</td>
                              <td>{entry.pointsAwarded != null ? formatLocalePoints(entry.pointsAwarded, 1) : "—"}</td>
                              <td>{entry.mutatorPpsBonus != null && entry.mutatorPpsBonus > 0 ? formatLocalePoints(entry.mutatorPpsBonus, 1) : "—"}</td>
                              <td>{entry.mutatorSelectedTraitLabels?.length ? entry.mutatorSelectedTraitLabels.join(" + ") : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="compact-table-shell" style={{ marginTop: 12 }}>
                      <table className="compact-table">
                        <caption style={{ captionSide: "top", textAlign: "left", padding: "0 0 8px 0" }}>
                          Top 10 Spieler D2
                        </caption>
                        <thead>
                          <tr>
                            <th>Rang</th>
                            <th>Spieler</th>
                            <th>Team</th>
                            <th>Final</th>
                            <th>Punkte</th>
                            <th>Mutator PP</th>
                            <th>Mutator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchdayMvpScoringFeed.d2TopPlayers.map((entry) => (
                            <tr key={`matchday-mvp-top-d2-${entry.playerId}-${entry.rankInDiscipline}`} onClick={() => void openPlayerDrawerById(entry.playerId)}>
                              <td>{entry.rankInDiscipline}</td>
                              <td>{entry.playerName}</td>
                              <td>{entry.teamName}</td>
                              <td>{formatLocalePoints(entry.finalPlayerScore, 1)}</td>
                              <td>{entry.pointsAwarded != null ? formatLocalePoints(entry.pointsAwarded, 1) : "—"}</td>
                              <td>{entry.mutatorPpsBonus != null && entry.mutatorPpsBonus > 0 ? formatLocalePoints(entry.mutatorPpsBonus, 1) : "—"}</td>
                              <td>{entry.mutatorSelectedTraitLabels?.length ? entry.mutatorSelectedTraitLabels.join(" + ") : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="compact-table-shell" style={{ marginTop: 12 }}>
                      <table className="compact-table">
                        <caption style={{ captionSide: "top", textAlign: "left", padding: "0 0 8px 0" }}>
                          PP Gewinner
                        </caption>
                        <thead>
                          <tr>
                            <th>Diszi</th>
                            <th>Spieler</th>
                            <th>Team</th>
                            <th>Mutator PP</th>
                            <th>Mutator</th>
                            <th>Punkte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchdayMvpScoringFeed.ppWinners.map((entry) => (
                            <tr key={`matchday-mvp-pp-${entry.disciplineSide}-${entry.playerId}-${entry.rankInDiscipline}`} onClick={() => void openPlayerDrawerById(entry.playerId)}>
                              <td>{entry.disciplineName}</td>
                              <td>{entry.playerName}</td>
                              <td>{entry.teamName}</td>
                              <td>{entry.mutatorPpsBonus != null ? formatLocalePoints(entry.mutatorPpsBonus, 1) : "—"}</td>
                              <td>{entry.mutatorSelectedTraitLabels?.length ? entry.mutatorSelectedTraitLabels.join(" + ") : "—"}</td>
                              <td>{entry.pointsAwarded != null ? formatLocalePoints(entry.pointsAwarded, 1) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="muted" style={{ marginTop: 10 }}>
                    Der DryRun liest die echten Season-Diszis des ersten Spieltags, erzeugt nur bei Bedarf lokale Auto-Lineups und zeigt danach beide 32er-Scoreboards plus die spaetere Standings-Schreibbarkeit.
                  </p>
                )}
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitResolveStatus.status)}`}>
                <div className="panel-header">
                  <h3>8. Resolve Preview</h3>
                  <span className={getCockpitStatusPillClass(cockpitResolveStatus.status)}>{getCockpitStatusLabel(cockpitResolveStatus.status)}</span>
                </div>
                <p>{cockpitResolveStatus.message}</p>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={cockpitBusyKey != null}
                    onClick={() => {
                      setCockpitBusyKey("resolve-preview");
                      void reloadResolvePreview().finally(() => setCockpitBusyKey(null));
                    }}
                  >
                    Resolve Preview berechnen
                  </button>
                </div>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Status: {resolvePreviewFeed?.preview.status ?? "—"}</li>
                  <li>D1: {resolvePreviewFeed?.summary.d1DisciplineName ?? "—"}</li>
                  <li>D2: {resolvePreviewFeed?.summary.d2DisciplineName ?? "—"}</li>
                  <li>Warnings: {resolvePreviewFeed?.warnings.length ?? 0}</li>
                </ul>
                {resolvePreviewFeed?.topPlayers.d1?.length ? (
                  <p className="muted">
                    Top D1:{" "}
                    {resolvePreviewFeed.topPlayers.d1.slice(0, 3).map((player, index) => (
                      <span key={`cockpit-top-d1-${player.playerId}`}>
                        {index > 0 ? ", " : null}
                        <button
                          className="table-link-button"
                          type="button"
                          onClick={() => void openPlayerDrawerById(player.playerId)}
                        >
                          {player.playerName} ({player.teamName})
                        </button>
                      </span>
                    ))}
                  </p>
                ) : null}
                {resolvePreviewFeed?.topPlayers.d2?.length ? (
                  <p className="muted">
                    Top D2:{" "}
                    {resolvePreviewFeed.topPlayers.d2.slice(0, 3).map((player, index) => (
                      <span key={`cockpit-top-d2-${player.playerId}`}>
                        {index > 0 ? ", " : null}
                        <button
                          className="table-link-button"
                          type="button"
                          onClick={() => void openPlayerDrawerById(player.playerId)}
                        >
                          {player.playerName} ({player.teamName})
                        </button>
                      </span>
                    ))}
                  </p>
                ) : null}
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setActiveView("lineup");
                    syncFoundationViewInUrl("lineup");
                  }}
                >
                  Einsatzliste öffnen
                </button>
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitResultApplyStatus.status)}`}>
                <div className="panel-header">
                  <h3>7. Result Apply</h3>
                  <span className={getCockpitStatusPillClass(cockpitResultApplyStatus.status)}>{getCockpitStatusLabel(cockpitResultApplyStatus.status)}</span>
                </div>
                <p>{cockpitResultApplyStatus.message}</p>
                <p className="muted cockpit-step-hint">Reihenfolge: 1. DryRun prüfen, 2. Bestätigung lesen, 3. lokal anwenden.</p>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null || resolvePreviewFeed?.preview.status == null}
                    onClick={() => {
                      void runCockpitResultApply(false);
                    }}
                  >
                    1. Result DryRun pruefen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null || resolvePreviewFeed?.preview.status !== "ready"}
                    onClick={() => {
                      const confirmed = window.confirm("Result Apply schreibt nur lokale Matchday-Results. Fortfahren?");
                      if (!confirmed) return;
                      void runCockpitResultApply(true);
                    }}
                  >
                    2. Result lokal anwenden
                  </button>
                </div>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Preview Status: {resultApplyFeed?.previewStatus ?? resultApplyFeed?.summary?.previewStatus ?? "—"}</li>
                  <li>Geplante Writes: {Array.isArray(resultApplyFeed?.summary?.plannedChanges) ? resultApplyFeed?.summary?.plannedChanges?.length : "—"}</li>
                  <li>Audit: {resultApplyFeed?.summary?.matchdayResultId ?? "—"}</li>
                </ul>
                {(resultApplyFeed?.blockingReasons ?? resultApplyFeed?.summary?.blockingReasons ?? []).length ? (
                  <ul className="warning-list compact-list cockpit-detail-list cockpit-detail-list-warning">
                    {(resultApplyFeed?.blockingReasons ?? resultApplyFeed?.summary?.blockingReasons ?? []).slice(0, 4).map((reason) => (
                      <li key={reason}>{formatCockpitReason(reason)}</li>
                    ))}
                  </ul>
                ) : null}
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitStandingsPreviewStatus.status)}`}>
                <div className="panel-header">
                  <h3>8. Standings Preview</h3>
                  <span className={getCockpitStatusPillClass(cockpitStandingsPreviewStatus.status)}>{getCockpitStatusLabel(cockpitStandingsPreviewStatus.status)}</span>
                </div>
                <p>{cockpitStandingsPreviewStatus.message}</p>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={cockpitBusyKey != null}
                    onClick={() => {
                      setCockpitBusyKey("standings-preview");
                      void reloadStandingsPreviewFeed().finally(() => setCockpitBusyKey(null));
                    }}
                  >
                    Standings Preview laden
                  </button>
                </div>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Ready Teams: {standingsPreviewFeed?.summary?.readyTeams ?? "—"}</li>
                  <li>Blocked Teams: {standingsPreviewFeed?.summary?.blockedTeamCount ?? "—"}</li>
                  <li>Tie Groups: {standingsPreviewFeed?.tieGroups?.length ?? 0}</li>
                </ul>
                {(standingsPreviewFeed?.blockedRules ?? []).length ? (
                  <ul className="warning-list compact-list cockpit-detail-list cockpit-detail-list-warning">
                    {(standingsPreviewFeed?.blockedRules ?? []).slice(0, 4).map((rule) => (
                      <li key={rule}>{formatCockpitReason(rule)}</li>
                    ))}
                  </ul>
                ) : null}
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setActiveView("season");
                    syncFoundationViewInUrl("season");
                  }}
                >
                  Saisonstand öffnen
                </button>
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitStandingsApplyStatus.status)}`}>
                <div className="panel-header">
                  <h3>9. Standings Apply</h3>
                  <span className={getCockpitStatusPillClass(cockpitStandingsApplyStatus.status)}>{getCockpitStatusLabel(cockpitStandingsApplyStatus.status)}</span>
                </div>
                <p>{cockpitStandingsApplyStatus.message}</p>
                <p className="muted cockpit-step-hint">Erst Preview laden, dann DryRun, erst danach lokal anwenden.</p>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null || !standingsPreviewFeed}
                    onClick={() => {
                      void runCockpitStandingsApply(false);
                    }}
                  >
                    1. Standings DryRun pruefen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null || cockpitStandingsApplyStatus.status !== "ready"}
                    onClick={() => {
                      const confirmed = window.confirm("Standings Apply schreibt nur lokale Punkte und Raenge. Fortfahren?");
                      if (!confirmed) return;
                      void runCockpitStandingsApply(true);
                    }}
                  >
                    2. Standings lokal anwenden
                  </button>
                </div>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Duplicate Schutz: {String(standingsApplyFeed?.summary?.duplicateDetected ?? standingsApplyFeed?.duplicateDetected ?? false)}</li>
                  <li>Audit: {standingsApplyFeed?.summary?.auditLogId ?? standingsApplyFeed?.auditLogId ?? "—"}</li>
                  <li>Planned Changes: {Array.isArray(standingsApplyFeed?.summary?.plannedChanges) ? standingsApplyFeed?.summary?.plannedChanges?.length : "—"}</li>
                </ul>
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(prizeApplyState.status)}`}>
                <div className="panel-header">
                  <h3>{gameState.season.name} abgeschlossen: Preisgeld & Cash</h3>
                  <span className={getCockpitStatusPillClass(prizeApplyState.status)}>{prizeApplyState.label}</span>
                </div>
                <p className="muted cockpit-step-hint">
                  Prominenter Season-End-Finance-Check fuer dein aktives Team. Preisgeld bleibt idempotent und wird nicht doppelt angewendet.
                </p>
                <div className="teams-summary-grid history-summary-grid">
                  <article className="metric-card">
                    <span>Champion</span>
                    <strong>{seasonEndChampionRow?.team.name ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Dein Rang</span>
                    <strong>{selectedPrizePreviewRow?.rank ?? selectedStandingRow?.rank ?? "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Basispreisgeld</span>
                    <strong>{selectedPrizePreviewRow?.prizeMoney != null ? formatLocalePoints(selectedPrizePreviewRow.prizeMoney, 1) : "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Rank Bonus/Malus</span>
                    <strong>{selectedPrizePreviewRow?.rankChangePrize?.bonusMalus != null ? formatLocalePoints(selectedPrizePreviewRow.rankChangePrize.bonusMalus, 1) : "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Cash vorher</span>
                    <strong>{selectedPrizePreviewRow?.currentCash != null ? formatLocalePoints(selectedPrizePreviewRow.currentCash, 1) : "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Cash nach Season-End</span>
                    <strong>{selectedPrizePreviewRow?.projectedCash != null ? formatLocalePoints(selectedPrizePreviewRow.projectedCash, 1) : "—"}</strong>
                  </article>
                </div>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>StartRank Quelle: {selectedPrizePreviewRow?.rankChangePrize?.startRankSource ?? "—"}</li>
                  <li>FinalRank Quelle: final standings</li>
                  <li>Apply Logs aktuelle Season: {currentSeasonCashPrizeApplyLogs.length}</li>
                  <li>Idempotenz: {currentSeasonCashPrizeApplyLogs.length > 0 ? "already_applied / Button deaktivieren" : "offen"}</li>
                </ul>
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitPrizePreviewStatus.status)}`}>
                <div className="panel-header">
                  <h3>1. Preisgeld & Finanzen Preview</h3>
                  <span className={getCockpitStatusPillClass(cockpitPrizePreviewStatus.status)}>{getCockpitStatusLabel(cockpitPrizePreviewStatus.status)}</span>
                </div>
                <p>Dieser Block gehoert nicht zum Spieltagsflow. Preisgeld und Cash werden nur einmal am Saisonende geprueft und verrechnet.</p>
                <p className="muted cockpit-step-hint">Season-End Reihenfolge: Season Review, Preisgeld & Finanzen, Facilities, XP, Verkaufen, Verlängern, Kaufen, Season Setup.</p>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={cockpitBusyKey != null}
                    onClick={() => {
                      setCockpitBusyKey("prize-preview");
                      void reloadPrizePreviewFeed().finally(() => setCockpitBusyKey(null));
                    }}
                  >
                    Preisgeld Preview laden
                  </button>
                </div>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Berechenbar: {prizePreviewFeed?.summary.calculableTeams ?? "—"}</li>
                  <li>Blockiert: {prizePreviewFeed?.summary.blockedItemsCount ?? "—"}</li>
                  <li>Gesamtpreisgeld: {prizePreviewFeed?.summary.totalPrizeMoney != null ? formatLocalePoints(prizePreviewFeed.summary.totalPrizeMoney, 1) : "—"}</li>
                  <li>Total RankChange: {prizePreviewFeed?.summary.totalRankChangePrize != null ? formatLocalePoints(prizePreviewFeed.summary.totalRankChangePrize, 1) : "—"}</li>
                  <li>Missing Source Teams: {prizeAuditCompact.missingSourceTeams}</li>
                  <li>Große Rangbewegungen: {prizeAuditCompact.largeRankChanges}</li>
                  <li>Global Warnings: {prizePreviewFeed?.globalWarnings.length ?? 0}</li>
                </ul>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setActiveView("prize");
                    syncFoundationViewInUrl("prize");
                  }}
                >
                  Preisgeld öffnen
                </button>
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitCashApplyStatus.status)}`}>
                <div className="panel-header">
                  <h3>Season-End: Cash Apply</h3>
                  <span className={getCockpitStatusPillClass(cockpitCashApplyStatus.status)}>{getCockpitStatusLabel(cockpitCashApplyStatus.status)}</span>
                </div>
                <p>Cash wird nicht im Spieltag verrechnet. Dieser Schritt bleibt nur fuer den Saisonabschluss sichtbar.</p>
                <p className="muted cockpit-step-hint">Nicht Teil des Matchday-Resolve-Flows. Transferfenster danach: erst Verkauf, dann Kauf.</p>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null || !prizePreviewFeed}
                    title={
                      readMeta.readOnly
                        ? getReadOnlyActionReason("den Cash-DryRun")
                        : cockpitBusyKey != null
                          ? getCockpitBusyReason()
                          : !prizePreviewFeed
                            ? "Bitte zuerst die Preisgeld-Preview laden."
                            : "Prueft den lokalen Cash-Apply einmal trocken."
                    }
                    onClick={() => {
                      void runCockpitCashApply(false);
                    }}
                  >
                    1. Cash DryRun pruefen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null || cockpitCashApplyStatus.status !== "ready"}
                    title={
                      readMeta.readOnly
                        ? getReadOnlyActionReason("den Cash-Apply")
                        : cockpitBusyKey != null
                          ? getCockpitBusyReason()
                          : cockpitCashApplyStatus.status !== "ready"
                            ? cockpitCashApplyStatus.message
                            : "Schreibt die lokalen Cash-Werte fuer den Saisonabschluss."
                    }
                    onClick={() => {
                      const confirmed = window.confirm("Cash Apply schreibt nur lokale Cash-Werte. Fortfahren?");
                      if (!confirmed) return;
                      void runCockpitCashApply(true);
                    }}
                  >
                    2. Cash lokal anwenden
                  </button>
                </div>
                {readMeta.readOnly || cockpitBusyKey != null || !prizePreviewFeed || cockpitCashApplyStatus.status !== "ready" ? (
                  <p className="foundation-screen-action-reason">
                    Warum nicht: {readMeta.readOnly
                      ? getReadOnlyActionReason("den Cash-Apply")
                      : cockpitBusyKey != null
                        ? getCockpitBusyReason()
                        : !prizePreviewFeed
                          ? "Bitte zuerst die Preisgeld-Preview laden."
                          : cockpitCashApplyStatus.message}
                  </p>
                ) : null}
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Duplicate Schutz: {String(cashApplyFeed?.summary?.duplicateDetected ?? cashApplyFeed?.duplicateDetected ?? false)}</li>
                  <li>Audit: {cashApplyFeed?.summary?.auditLogId ?? cashApplyFeed?.auditLogId ?? "—"}</li>
                  <li>Planned Changes: {Array.isArray(cashApplyFeed?.summary?.plannedChanges) ? cashApplyFeed?.summary?.plannedChanges?.length : "—"}</li>
                </ul>
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(preSeasonWorkflowFeed?.ok ? "ready" : preSeasonWorkflowFeed ? "warning" : "open")}`}>
                <div className="panel-header">
                  <h3>Pre-Season Workflow</h3>
                  <span className={getCockpitStatusPillClass(preSeasonWorkflowFeed?.ok ? "ready" : preSeasonWorkflowFeed ? "warning" : "open")}>
                    {preSeasonWorkflowFeed?.applied ? "applied" : preSeasonWorkflowFeed ? "preview" : "idle"}
                  </span>
                </div>
                <p>Wizard fuer Finanzen, Facilities, Entwicklung, Sell-before-Buy und Season-2-Setup. Nicht alles heimlich in einem Klick.</p>
                <p className="muted cockpit-step-hint">
                  Gefuehrte Teams: warten auf deine Entscheidung · Auto-Teams: Verkauf/Kauf bereit · Beobachtete Teams: uebersprungen
                </p>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || preSeasonWorkflowBusy}
                    title={
                      readMeta.readOnly
                        ? getReadOnlyActionReason("die Pre-Season-Preview")
                        : preSeasonWorkflowBusy
                          ? getBusyActionReason("Die Pre-Season-Preview")
                          : "Laedt die komplette Pre-Season-Vorschau fuer Finanzen, Facilities, Entwicklung und Markt."
                    }
                    onClick={() => {
                      void runPreSeasonWorkflowPreview();
                    }}
                  >
                    Pre-Season Preview laden
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || preSeasonWorkflowBusy}
                    title={
                      readMeta.readOnly
                        ? getReadOnlyActionReason("den Saisonwechsel-Assistenten")
                        : preSeasonWorkflowBusy
                          ? getBusyActionReason("Die Pre-Season-Preview")
                          : "Prueft den Saisonwechsel als gefuehrten Assistenten."
                    }
                    onClick={() => {
                      void runSeasonTransition("preview");
                    }}
                  >
                    Saisonwechsel-Assistent prüfen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={readMeta.readOnly || preSeasonWorkflowBusy || !preSeasonWorkflowFeed?.ok}
                    title={
                      readMeta.readOnly
                        ? getReadOnlyActionReason("die neue Saison")
                        : preSeasonWorkflowBusy
                          ? getBusyActionReason("Der Pre-Season-Workflow")
                          : preSeasonWorkflowFeed?.ok
                            ? "Schreibt Snapshot, Progression, neue Schedule/Formkarten und startet die naechste Season."
                            : "Erst Pre-Season Preview laden und Blocker pruefen."
                    }
                    onClick={() => {
                      const confirmed = window.confirm("Neue Saison starten? Das schreibt Snapshot, Progression, neue Schedule, Formkarten und setzt den Flow auf Seasonstart.");
                      if (!confirmed) return;
                      void runPreSeasonNextSeasonSetup();
                    }}
                  >
                    Neue Saison starten
                  </button>
                </div>
                {readMeta.readOnly || preSeasonWorkflowBusy || !preSeasonWorkflowFeed?.ok ? (
                  <p className="foundation-screen-action-reason">
                    Warum nicht: {readMeta.readOnly
                      ? getReadOnlyActionReason("die neue Saison")
                      : preSeasonWorkflowBusy
                        ? getBusyActionReason("Der Pre-Season-Workflow")
                        : "Erst Pre-Season Preview laden und Blocker pruefen."}
                  </p>
                ) : null}
                {preSeasonWorkflowFeed ? (
                  <>
                    <div className="training-cash-grid">
                      <span>Aktuelle Season</span>
                      <strong>{preSeasonWorkflowFeed.saveContext.seasonId}</strong>
                      <span>Nächste Season</span>
                      <strong>{preSeasonWorkflowFeed.saveContext.nextSeasonLabel}</strong>
                      <span>Gefuehrte Teams</span>
                      <strong>{preSeasonWorkflowFeed.controlSummary.manualTeams}</strong>
                      <span>Auto-Teams</span>
                      <strong>{preSeasonWorkflowFeed.controlSummary.aiTeams}</strong>
                      <span>Beobachtete Teams</span>
                      <strong>{preSeasonWorkflowFeed.controlSummary.passiveTeams}</strong>
                      <span>Game Phase nach Apply</span>
                      <strong>season_active</strong>
                    </div>
                    <div className="training-facility-grid">
                      {preSeasonWorkflowFeed.steps.map((step, index) => (
                        <div className="training-facility-card" key={step.stepId}>
                          <div className="training-facility-card-head">
                            <strong>{index + 1}. {step.label}</strong>
                            <span className={`transfer-status-pill ${step.status === "blocked" ? "is-warning" : step.status === "ready" || step.status === "applied" ? "is-ready" : "is-warning"}`}>
                              {step.status}
                            </span>
                          </div>
                          <p className="muted">{step.productive ? "produktiver Step nur mit Confirm/Service" : "preview-only"}</p>
                          <div className="training-facility-stats">
                            {Object.entries(step.summary).slice(0, 5).map(([key, value]) => (
                              <span key={`${step.stepId}-${key}`}>{key}: {String(value)}</span>
                            ))}
                          </div>
                          {step.warnings.length > 0 ? <p className="muted">Hinweise: {step.warnings.slice(0, 3).join(" · ")}</p> : null}
                          {step.blockingReasons.length > 0 ? <p className="text-negative">Blocker: {step.blockingReasons.join(" · ")}</p> : null}
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                {preSeasonWorkflowError ? <p className="text-negative">{preSeasonWorkflowError}</p> : null}
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(seasonTransitionFeed?.ok ? "ready" : seasonTransitionFeed ? "warning" : "open")}`}>
                <div className="panel-header">
                  <h3>Saisonabschluss & Review</h3>
                  <span className={getCockpitStatusPillClass(seasonTransitionFeed?.ok ? "ready" : seasonTransitionFeed ? "warning" : "open")}>
                    {seasonCompletionFeed?.status ?? seasonTransitionFeed?.transition.status ?? "idle"}
                  </span>
                </div>
                <p>Saison sauber schließen: Board-Ziele, Preisgeld, Beziehungen, Snapshot, neue Saison und AI-Einsatz werden zusammen geprüft.</p>
                <p className="muted cockpit-step-hint">Erst Abschluss pruefen, dann ausfuehren. Der echte Write laeuft atomar mit Recovery, damit der Save nicht halb im Saisonwechsel haengen bleibt.</p>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || seasonTransitionBusy}
                    title={
                      readMeta.readOnly
                        ? getReadOnlyActionReason("den Saisonwechsel-Assistenten")
                        : seasonTransitionBusy
                          ? getBusyActionReason("Der Saisonwechsel-Assistent")
                          : "Zeigt die naechsten Saisonwechsel-Schritte erst einmal nur als Preview."
                    }
                    onClick={() => {
                      void runSeasonTransition("preview");
                    }}
                  >
                    Assistent previewen
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || seasonTransitionBusy || !localSeasonTransitionGate.canCompleteSeason}
                    title={localSeasonTransitionGate.disabledReason ?? "Prueft Board-Ziele, Preisgeld, Beziehungen, Snapshot, naechste Saison und AI-Audit ohne zu schreiben"}
                    onClick={() => {
                      void runSeasonCompletion(false);
                    }}
                  >
                    Abschluss pruefen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={readMeta.readOnly || seasonTransitionBusy || !localSeasonTransitionGate.canCompleteSeason}
                    title={localSeasonTransitionGate.disabledReason ?? "Transition-State speichern"}
                    onClick={() => {
                      void runSeasonTransition("start_transition");
                    }}
                  >
                    Saison abschließen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={readMeta.readOnly || seasonTransitionBusy || !localSeasonTransitionGate.canCompleteSeason}
                    title={localSeasonTransitionGate.disabledReason ?? "Preisgeld, Snapshot, Review und AI-Audit ausführen"}
                    onClick={() => {
                      void runSeasonCompletion(true);
                    }}
                  >
                    Abschluss-Run
                  </button>
                </div>
                {readMeta.readOnly || seasonTransitionBusy || !localSeasonTransitionGate.canCompleteSeason ? (
                  <p className="foundation-screen-action-reason">
                    Warum nicht: {readMeta.readOnly
                      ? getReadOnlyActionReason("den Saisonabschluss")
                      : seasonTransitionBusy
                        ? getBusyActionReason("Der Saisonwechsel-Assistent")
                        : localSeasonTransitionGate.disabledReason ?? "Der Saisonabschluss hat noch offene Blocker."}
                  </p>
                ) : null}
                {seasonCompletionFeed ? (
                  <>
                    <div className="season-completion-board" data-testid="season-completion-board">
                      <div className={`season-completion-hero is-${seasonCompletionFeed.status}`}>
                        <span className="eyebrow">{seasonCompletionFeed.dryRun ? "Preview" : "Saisonabschluss"}</span>
                        <strong>
                          {seasonCompletionFeed.status === "applied"
                            ? "Saison sauber abgeschlossen"
                            : seasonCompletionFeed.status === "blocked"
                              ? "Abschluss blockiert"
                              : "Bereit zum Abschluss"}
                        </strong>
                        <small>
                          {seasonCompletionFeed.status === "blocked"
                            ? seasonCompletionFeed.blockingReasons.map(formatCockpitReason).slice(0, 2).join(" · ") || "Offene Blocker pruefen."
                            : "Board, Geld, Beziehungen, Snapshot, Transition und AI-Audit sind im gleichen Lauf sichtbar."}
                        </small>
                      </div>
                      <div className="season-completion-step-row">
                        {seasonCompletionFeed.steps.map((step, index) => (
                          <div className={`season-completion-step ${getSeasonCompletionStepTone(step.status)}`} key={`completion-step-${step.key}`}>
                            <span>{index + 1}</span>
                            <strong>{step.label}</strong>
                            <small>{formatSeasonCompletionStepStatus(step.status)}</small>
                          </div>
                        ))}
                      </div>
                      <div className="season-completion-card-grid">
                        <div className="season-completion-card">
                          <span>Board-Ziele</span>
                          <strong>
                            {seasonCompletionFeed.seasonReview?.objectiveSettlement
                              ? `${seasonCompletionFeed.seasonReview.objectiveSettlement.totals.completed} / ${seasonCompletionFeed.seasonReview.objectiveSettlement.totals.completed + seasonCompletionFeed.seasonReview.objectiveSettlement.totals.failed} erreicht`
                              : "offen"}
                          </strong>
                          <small>
                            Board {formatSignedNumber(seasonCompletionFeed.seasonReview?.objectiveSettlement?.totals.boardConfidenceDelta, 2)} · Cash{" "}
                            {formatSignedNumber(seasonCompletionFeed.seasonReview?.objectiveSettlement?.totals.cashDelta, 1)}
                          </small>
                        </div>
                        <div className="season-completion-card">
                          <span>Preisgeld</span>
                          <strong>{formatSeasonCompletionStepStatus(seasonCompletionFeed.steps.find((step) => step.key === "cash_apply")?.status)}</strong>
                          <small>{seasonCompletionFeed.cashApply?.applied ? "Cash wurde geschrieben." : "Noch Preview oder bereits vorhanden."}</small>
                        </div>
                        <div className="season-completion-card">
                          <span>Beziehungen</span>
                          <strong>{seasonCompletionFeed.relationships?.insertedEvents ?? 0} Events</strong>
                          <small>{seasonCompletionFeed.relationships?.generatedEvents.length ?? 0} berechnet · Rival/Ally Verlauf bleibt nachvollziehbar</small>
                        </div>
                        <div className="season-completion-card">
                          <span>Snapshot</span>
                          <strong>{formatSeasonCompletionStepStatus(seasonCompletionFeed.steps.find((step) => step.key === "snapshot")?.status)}</strong>
                          <small>Finaltabelle, Spielerleistungen und Transferhistorie werden eingefroren.</small>
                        </div>
                      </div>
                      <div className="season-completion-ai-card">
                        <div>
                          <span className="eyebrow">AI Einsatz-Audit</span>
                          <strong>
                            {seasonCompletionFeed.aiSeasonAudit?.totals.aiDrafts ?? 0} Lineups · Cap{" "}
                            {seasonCompletionFeed.aiSeasonAudit?.rates.aiCaptainPerDraftPct ?? 0}% · Form{" "}
                            {seasonCompletionFeed.aiSeasonAudit?.rates.aiFormCardPerDraftPct ?? 0}% · Push{" "}
                            {seasonCompletionFeed.aiSeasonAudit?.rates.aiPushSidePct ?? 0}%
                          </strong>
                          <small>
                            Powers {seasonCompletionFeed.aiSeasonAudit?.totals.teamPowerUses ?? 0} · Mutatoren{" "}
                            {seasonCompletionFeed.aiSeasonAudit?.totals.mutatorTraits ?? 0}
                          </small>
                        </div>
                        {(seasonCompletionFeed.aiSeasonAudit?.teams ?? []).filter((team) => team.controlMode === "ai" && team.warnings.length > 0).slice(0, 5).map((team) => (
                          <div className="season-completion-ai-team" key={`completion-ai-${team.teamId}`}>
                            <strong>{team.teamCode} · {team.teamName}</strong>
                            <span>
                              {team.warnings.map(formatAiLineupAuditWarning).join(" · ")}
                            </span>
                          </div>
                        ))}
                        {(seasonCompletionFeed.aiSeasonAudit?.teams ?? []).filter((team) => team.controlMode === "ai" && team.warnings.length > 0).length === 0 ? (
                          <div className="season-completion-ai-team is-clean">
                            <strong>Keine AI-Blocker</strong>
                            <span>Captain, Form, Push und Mutatoren werden im Save genutzt oder sind bewusst nicht auffaellig.</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {seasonCompletionFeed.aiSeasonAudit?.warnings.length ? (
                      <div className="training-warning-strip">
                        <span className="transfer-status-pill is-warning">AI-Audit</span>
                        <span>{seasonCompletionFeed.aiSeasonAudit.warnings.slice(0, 5).map(formatAiLineupAuditWarning).join(" · ")}</span>
                      </div>
                    ) : null}
                    {seasonCompletionFeed.seasonReview?.objectiveSettlement ? (
                      <div className="training-warning-strip">
                        <span className="transfer-status-pill is-ready">Konsequenzen</span>
                        <span>
                          Board-Ziele: {seasonCompletionFeed.seasonReview.objectiveSettlement.totals.completed} erfuellt ·{" "}
                          {seasonCompletionFeed.seasonReview.objectiveSettlement.totals.failed} verfehlt · Board{" "}
                          {formatSignedNumber(seasonCompletionFeed.seasonReview.objectiveSettlement.totals.boardConfidenceDelta, 2)}
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {seasonTransitionFeed ? (
                  <>
                    <div className="training-cash-grid">
                      <span>GamePhase</span>
                      <strong>{seasonTransitionFeed.gamePhase}</strong>
                      <span>Transition currentStep</span>
                      <strong>{seasonTransitionFeed.transition.currentStep}</strong>
                      <span>Status</span>
                      <strong>{seasonTransitionFeed.transition.status}</strong>
                      <span>Von / nach Season</span>
                      <strong>{seasonTransitionFeed.saveContext.fromSeasonId} → {seasonTransitionFeed.saveContext.toSeasonId}</strong>
                    </div>
                  </>
                ) : null}
                <div className="training-facility-grid">
                  {(seasonTransitionFeed?.steps ?? SEASON_TRANSITION_STATIC_STEPS).map((step, index) => (
                    <div className="training-facility-card" key={`transition-${step.stepId}`}>
                      <div className="training-facility-card-head">
                        <strong>{index + 1}. {step.label}</strong>
                        <span className={`transfer-status-pill ${step.status === "blocked" ? "is-warning" : step.status === "ready" || step.status === "applied" ? "is-ready" : "is-warning"}`}>
                          {step.status}
                        </span>
                      </div>
                      <p className="muted">{step.preview}</p>
                      {step.stepId === "season_review" && seasonTransitionFeed?.seasonReview ? (
                        <div className="season-review-preview" data-testid="season-review-preview">
                          <div className="season-review-hero">
                            {(() => {
                              const champion = seasonTransitionFeed.seasonReview.championTeam;
                              const championTeam = champion?.teamId ? gameState.teams.find((team) => team.teamId === champion.teamId) ?? null : null;
                              const logo = championTeam ? getTeamLogoModel(championTeam) : null;
                              return (
                                <>
                                  <div className="season-review-hero-logo">
                                    {logo?.src ? (
                                      <img
                                        src={logo.src}
                                        alt={`${champion?.name ?? "Champion"} Logo`}
                                        loading="lazy"
                                        decoding="async"
                                        fetchPriority="low"
                                      />
                                    ) : (
                                      <span>{logo?.initials ?? "CH"}</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="eyebrow">Champion</span>
                                    <h4>{champion?.name ?? "—"}</h4>
                                    <p>{champion?.label ?? "Kein finaler Saisonstand vorhanden."}</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          <div className="season-review-mini-grid">
                            <div>
                              <strong>Top 3 Teams</strong>
                              {seasonTransitionFeed.seasonReview.finalTable.slice(0, 3).map((entry, tableIndex) => (
                                <span key={`review-table-${entry.id}`}>{tableIndex + 1}. {entry.name} · {entry.label}</span>
                              ))}
                              {seasonTransitionFeed.seasonReview.finalTable.length === 0 ? <span>—</span> : null}
                            </div>
                            <div>
                              <strong>Top 5 Spieler</strong>
                              {seasonTransitionFeed.seasonReview.topPlayers.slice(0, 5).map((entry, playerIndex) => {
                                const player = gameState.players.find((item) => item.id === entry.id) ?? null;
                                const portrait = player ? getPlayerPortraitModel(player) : null;
                                return (
                                  <span className="season-review-player-row" key={`review-player-${entry.id}`}>
                                    <span className="season-review-player-avatar">
                                      {portrait?.src ? (
                                        <PlayerPortrait
                                          src={portrait.src}
                                          initials={portrait.initials}
                                          alt={`${entry.name} Portrait`}
                                          className=""
                                        />
                                      ) : portrait?.initials ?? playerIndex + 1}
                                    </span>
                                    {entry.name} · {entry.label}
                                  </span>
                                );
                              })}
                              {seasonTransitionFeed.seasonReview.topPlayers.length === 0 ? <span>—</span> : null}
                            </div>
                          </div>
                          <div className="season-review-awards">
                            {seasonTransitionFeed.seasonReview.awards.slice(0, 8).map((award) => (
                              <div className="season-review-award-card" key={`review-award-${award.awardId}`}>
                                <span>{award.label}</span>
                                <strong>{award.winnerName}</strong>
                                <small>{award.reason}</small>
                              </div>
                            ))}
                            {seasonTransitionFeed.seasonReview.awards.length === 0 ? <p className="muted">Keine Awards ohne belastbare Quellen.</p> : null}
                          </div>
                          {seasonTransitionFeed.seasonReview.objectiveSettlement ? (
                            <div className="season-review-objective-settlement">
                              <div className="season-review-objective-summary">
                                <strong>Board-Ziele</strong>
                                <span>
                                  {seasonTransitionFeed.seasonReview.objectiveSettlement.totals.completed} erfuellt ·{" "}
                                  {seasonTransitionFeed.seasonReview.objectiveSettlement.totals.failed} verfehlt · Cash{" "}
                                  {formatSignedNumber(seasonTransitionFeed.seasonReview.objectiveSettlement.totals.cashDelta, 1)} · Board{" "}
                                  {formatSignedNumber(seasonTransitionFeed.seasonReview.objectiveSettlement.totals.boardConfidenceDelta, 2)}
                                </span>
                              </div>
                              <div className="season-review-awards">
                                {Object.values(seasonTransitionFeed.seasonReview.objectiveSettlement.byTeamId)
                                  .sort((left, right) => (right.completed - left.completed) || (left.failed - right.failed) || left.teamName.localeCompare(right.teamName, "de"))
                                  .slice(0, 8)
                                  .map((entry) => (
                                    <div
                                      className={`season-review-award-card is-${entry.resultLabel}`}
                                      key={`objective-settlement-${entry.teamId}`}
                                    >
                                      <span>{entry.teamName}</span>
                                      <strong>
                                        {entry.completed}/{entry.completed + entry.failed + entry.atRisk + entry.open} Ziele
                                      </strong>
                                      <small>
                                        Cash {formatSignedNumber(entry.cashDelta, 1)} · Board {formatSignedNumber(entry.boardConfidenceDelta, 2)}
                                      </small>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ) : null}
                          <div className="season-review-highlight-grid">
                            <div>
                              <strong>Diszi-Highlights</strong>
                              {seasonTransitionFeed.seasonReview.topDisciplinePerformances.slice(0, 4).map((entry) => (
                                <span key={`review-diszi-${entry.id}`}>{entry.name} · {entry.label}</span>
                              ))}
                              {seasonTransitionFeed.seasonReview.topDisciplinePerformances.length === 0 ? <span>—</span> : null}
                            </div>
                            <div>
                              <strong>Transfers</strong>
                              {seasonTransitionFeed.seasonReview.transferHighlights.slice(0, 4).map((entry) => (
                                <span key={`review-transfer-${entry.transferId}`}>{entry.label}: {entry.playerName} · {entry.value ?? "—"}</span>
                              ))}
                              {seasonTransitionFeed.seasonReview.transferHighlights.length === 0 ? <span>—</span> : null}
                            </div>
                            <div>
                              <strong>Storylines</strong>
                              {seasonTransitionFeed.seasonReview.storylines.slice(0, 4).map((entry) => (
                                <span key={`review-story-${entry.storylineId}`}>{entry.text}</span>
                              ))}
                              {seasonTransitionFeed.seasonReview.storylines.length === 0 ? <span>source_missing</span> : null}
                            </div>
                            <div>
                              <strong>XP Entwicklung</strong>
                              {(seasonTransitionFeed.seasonReview.xpDevelopmentRankings?.topImproved ?? []).slice(0, 3).map((entry) => (
                                <span key={`review-xp-top-${entry.playerId}`}>{entry.playerName} · +{entry.attributeDelta} Attr · {entry.xpEarned} XP</span>
                              ))}
                              {(seasonTransitionFeed.seasonReview.xpDevelopmentRankings?.topImproved.length ?? 0) === 0 ? <span>noch keine fairen Before/After-Snapshots</span> : null}
                            </div>
                            <div>
                              <strong>{seasonTransitionFeed.seasonReview.xpDevelopmentRankings?.bottomLabel === "declined" ? "Regression Bottom" : "Least improved"}</strong>
                              {(seasonTransitionFeed.seasonReview.xpDevelopmentRankings?.bottom20 ?? []).slice(0, 3).map((entry) => (
                                <span key={`review-xp-bottom-${entry.playerId}`}>{entry.playerName} · {entry.attributeDelta} Attr · {entry.xpSpent} XP spent</span>
                              ))}
                              {(seasonTransitionFeed.seasonReview.xpDevelopmentRankings?.bottom20.length ?? 0) === 0 ? <span>—</span> : null}
                            </div>
                            <div>
                              <strong>Role-Versprechen</strong>
                              {(seasonTransitionFeed.seasonReview.promisedRoleSignals ?? []).slice(0, 3).map((entry) => (
                                <span key={`review-promised-${entry.playerId}`}>{entry.playerName} · {entry.promisedRole}: {entry.appearances}/{entry.expectedAppearances}</span>
                              ))}
                              {(seasonTransitionFeed.seasonReview.promisedRoleSignals?.length ?? 0) === 0 ? <span>keine offenen Widersprueche</span> : null}
                            </div>
                          </div>
                          <button className="primary-button inline-button" type="button" disabled>
                            Weiter zu Finanzen
                          </button>
                        </div>
                      ) : null}
                      {step.warnings.length > 0 ? <p className="muted">Warnings: {step.warnings.join(" · ")}</p> : null}
                      {step.blockingReasons.length > 0 ? <p className="text-negative">Blocker: {step.blockingReasons.join(" · ")}</p> : null}
                      {step.stepId !== "season_review" ? (
                        <button className="secondary-button inline-button" type="button" disabled>
                          Weiter
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {seasonTransitionError ? <p className="text-negative">{seasonTransitionError}</p> : null}
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitSeasonSnapshotStatus.status)}`}>
                <div className="panel-header">
                  <h3>11b. Season Snapshot / Historie</h3>
                  <span className={getCockpitStatusPillClass(cockpitSeasonSnapshotStatus.status)}>{getCockpitStatusLabel(cockpitSeasonSnapshotStatus.status)}</span>
                </div>
                <p>{cockpitSeasonSnapshotStatus.message}</p>
                <p className="muted cockpit-step-hint">Archiviert nur echte lokale Saisonstaende, Spielerleistungen und Transferhistorie. Keine Cash-, Result- oder Standings-Writes.</p>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null}
                    onClick={() => {
                      void runSeasonSnapshotAction(false);
                    }}
                  >
                    1. Snapshot DryRun pruefen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null || cockpitSeasonSnapshotStatus.status !== "ready"}
                    onClick={() => {
                      const confirmed = window.confirm("Die aktuelle lokale Season-Historie wird archiviert. Fortfahren?");
                      if (!confirmed) return;
                      void runSeasonSnapshotAction(true);
                    }}
                  >
                    2. Snapshot lokal speichern
                  </button>
                </div>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Archivierte Seasons: {seasonHistorySnapshots.length}</li>
                  <li>All-Time Teams: {seasonSnapshotFeed?.allTimeTable.length ?? "—"}</li>
                  <li>Transfer-Snapshots: {seasonSnapshotFeed?.snapshot.transferSnapshots?.length ?? "—"}</li>
                  <li>Performance-Snapshots: {seasonSnapshotFeed?.snapshot.playerPerformances.length ?? "—"}</li>
                  <li>Prisma bleibt: read-only</li>
                </ul>
                {(seasonSnapshotFeed?.blockingReasons.length ?? 0) > 0 ? (
                  <ul className="warning-list compact-list cockpit-detail-list cockpit-detail-list-warning">
                    {seasonSnapshotFeed?.blockingReasons.slice(0, 4).map((reason) => (
                      <li key={reason}>{formatCockpitReason(reason)}</li>
                    ))}
                  </ul>
                ) : null}
              </article>

              <article className={`panel cockpit-step ${getCockpitStepTone(cockpitMatchdayAdvanceStatus.status)}`}>
                <div className="panel-header">
                  <h3>12. Abschlussstatus Spieltag</h3>
                  <span className={getCockpitStatusPillClass(cockpitMatchdayAdvanceStatus.status)}>{getCockpitStatusLabel(cockpitMatchdayAdvanceStatus.status)}</span>
                </div>
                <p>{cockpitMatchdayAdvanceStatus.message}</p>
                <p className="muted cockpit-step-hint">Dieser Schritt schließt nur den aktuellen lokalen Spieltag ab und wechselt auf den nächsten.</p>
                <div className="cockpit-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null}
                    onClick={() => {
                      void runCockpitMatchdayAdvance(false);
                    }}
                  >
                    1. Matchday DryRun pruefen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={readMeta.readOnly || cockpitBusyKey != null || cockpitMatchdayAdvanceStatus.status !== "ready"}
                    onClick={() => {
                      const confirmed = window.confirm("Der aktuelle Spieltag wird lokal abgeschlossen und der Save auf den naechsten Matchday gesetzt. Fortfahren?");
                      if (!confirmed) return;
                      void runCockpitMatchdayAdvance(true);
                    }}
                  >
                    2. Matchday abschliessen
                  </button>
                </div>
                <ul className="warning-list compact-list cockpit-detail-list">
                  <li>Result Apply: {resultApplyFeed?.applied ? "geschrieben" : "offen"}</li>
                  <li>Standings Apply: {standingsApplyFeed?.applied ? "geschrieben" : "offen"}</li>
                  <li>Preisgeld/Cash: season_end_only</li>
                  <li>Naechster Matchday: {typeof matchdayAdvanceFeed?.summary?.nextMatchdayLabel === "string" ? matchdayAdvanceFeed.summary.nextMatchdayLabel : "—"}</li>
                  <li>Lineups gesperrt: {typeof matchdayAdvanceFeed?.summary?.lockedLineups === "number" ? matchdayAdvanceFeed.summary.lockedLineups : "—"}</li>
                  <li>Prisma bleibt: read-only</li>
                </ul>
                {(matchdayAdvanceFeed?.blockingReasons ?? matchdayAdvanceFeed?.summary?.blockingReasons ?? []).length ? (
                  <ul className="warning-list compact-list cockpit-detail-list cockpit-detail-list-warning">
                    {(matchdayAdvanceFeed?.blockingReasons ?? matchdayAdvanceFeed?.summary?.blockingReasons ?? []).slice(0, 4).map((reason) => (
                      <li key={reason}>{formatCockpitReason(reason)}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </div>
          </section>

          {activeView === "lineup" ? (
          <FoundationLineupPanel
            active
            onSwitchToFocusV2={() => setFoundationView("lineupV2", setActiveView, { push: true })}
            clientKey={`lineup-${activeSaveId}-${gameState.season.id}-${gameState.matchdayState.matchdayId}-${activeManagerTeamId}-${effectiveActiveOwnerId}`}
            teamTooltip={
              selectedTeam
                ? `${selectedTeam.name}: ${
                    selectedTeamControl?.controlMode === "ai"
                      ? "AI-gesteuert"
                      : selectedTeamControl?.controlMode === "passive"
                        ? "passiv"
                        : "manuell"
                  }. Bestehende Settings bleiben read-only sichtbar, bis du im Adminbereich etwas änderst.`
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

          {activeView === "lineupV2" ? (
          <FoundationLineupPanel
            active
            uiVariant="focusV2"
            onSwitchToClassic={() => setFoundationView("lineup", setActiveView, { push: true })}
            clientKey={`lineup-v2-${activeSaveId}-${gameState.season.id}-${gameState.matchdayState.matchdayId}-${activeManagerTeamId}-${effectiveActiveOwnerId}`}
            teamTooltip={
              selectedTeam
                ? `${selectedTeam.name}: Focus-Mode Preview für die Einsatzliste.`
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
                syncFoundationViewInUrl("lineupV2", view === "formBoard" ? "formplan" : "lineup", null, { push: true });
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
              onSwitchToClassic: () => setFoundationView("lineup", setActiveView, { push: true }),
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

          <section className={`panel${getViewClass("matchdayResult")}`} id="foundation-matchday-result" data-testid="foundation-matchday-result">
            <div className="panel-header">
              <div className="stack">
                <TooltipHeading
                  as="h2"
                  tooltip="Spieltagsranking nutzt nur die gespeicherten D1+D2-Ergebnisse dieses Matchdays. Saisonstand zeigt kumulierte Punkte bis zu diesem Spieltag."
                >
                  Spieltagsergebnis
                </TooltipHeading>
                <span className="muted">
                  {matchdaySummary.seasonId} · Spieltag {matchdaySummary.matchdayNumber ?? "—"} · {matchdaySummary.matchdayId}
                </span>
              </div>
              <div className="matchday-result-actions">
                <span className="pill foundation-source-pill">{getViewSourceBadgeLabel("matchdayResult", activeContextMeta)}</span>
                <label className="filter-field compact-filter">
                  <span>Matchday</span>
                  <select
                    className="input"
                    value={activeMatchdaySummaryId}
                    onChange={(event) => setSelectedMatchdaySummaryId(event.target.value)}
                  >
                    {matchdaySummaryOptions.length ? (
                      matchdaySummaryOptions.map((option) => (
                        <option key={option.matchdayId} value={option.matchdayId}>
                          MD {option.matchdayNumber ?? "—"} · {option.matchdayId}
                        </option>
                      ))
                    ) : (
                      <option value={activeMatchdaySummaryId}>Keine gespeicherten Results</option>
                    )}
                  </select>
                </label>
                <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("matchdayArena", setActiveView)}>
                  Zur Arena
                </button>
                <button className="primary-button inline-button" type="button" onClick={() => setFoundationView("seasonV2", setActiveView)}>
                  Saisonstand anzeigen
                </button>
              </div>
            </div>

            <div className="matchday-result-hero-grid">
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
                <small>
                  {activeTeamMatchdaySummaryRow?.seasonRankBeforeMatchday ?? "—"} → {activeTeamMatchdaySummaryRow?.seasonRankAfterMatchday ?? "—"}
                </small>
              </article>
            </div>

            {matchdaySummary.warnings.length ? (
              <div className="transfer-callout is-warning">
                <strong>Quellen/Warnungen</strong>
                <span>{matchdaySummary.warnings.slice(0, 6).join(" · ")}</span>
              </div>
            ) : null}

            <div className="matchday-result-tabs" role="tablist" aria-label="Spieltag oder Saisonstand">
              <button
                className={`secondary-button inline-button${matchdaySummaryTab === "matchday" ? " is-selected" : ""}`}
                type="button"
                onClick={() => setMatchdaySummaryTab("matchday")}
              >
                Spieltag
              </button>
              <button
                className={`secondary-button inline-button${matchdaySummaryTab === "season" ? " is-selected" : ""}`}
                type="button"
                onClick={() => setMatchdaySummaryTab("season")}
              >
                Saisonstand
              </button>
            </div>

            {matchdaySummaryTab === "season" ? (
              <div className="table-shell matchday-result-table-shell">
                <table className="team-table matchday-result-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Tagesrang</th>
                      <th>Tagespunkte</th>
                      <th>D1 Score</th>
                      <th>D2 Score</th>
                      <th>Rang vorher</th>
                      <th>Rang nachher</th>
                      <th>Δ Rang</th>
                      <th>Kumuliert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchdaySummary.teamRows.map((row) => (
                      <tr
                        key={`matchday-summary-row-${row.teamId}`}
                        className={joinClassNames(
                          row.teamId === activeManagerTeamId && "is-active-team-row",
                          getOwnerTeamHighlightClass(resolvedTeamControlSettings[row.teamId]),
                        )}
                        onClick={() => openTeamProfileById(row.teamId)}
                      >
                        <td><strong>{row.teamShortCode}</strong> · {row.teamName}</td>
                        <td>{row.matchdayRank ?? "—"}</td>
                        <td>{row.matchdayPoints ?? "—"}</td>
                        <td>{row.d1Score != null ? formatLocalePoints(row.d1Score, 1) : "—"}</td>
                        <td>{row.d2Score != null ? formatLocalePoints(row.d2Score, 1) : "—"}</td>
                        <td>{row.seasonRankBeforeMatchday ?? "—"}</td>
                        <td>{row.seasonRankAfterMatchday ?? "—"}</td>
                        <td className={row.rankDirection === "up" ? "text-positive" : row.rankDirection === "down" ? "text-negative" : undefined}>
                          {row.rankDelta != null ? (row.rankDelta > 0 ? `↑ +${row.rankDelta}` : row.rankDelta < 0 ? `↓ ${row.rankDelta}` : "0") : "—"}
                        </td>
                        <td>{row.cumulativePoints ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <section className="panel">
              <div className="panel-header">
                <h3>Highlights</h3>
                <button className="primary-button inline-button" type="button" onClick={() => setFoundationView("cockpit", setActiveView)}>
                  Weiter zum nächsten Schritt
                </button>
              </div>
              {matchdaySummary.highlights.length ? (
                <div className="matchday-result-highlight-grid">
                  {matchdaySummary.highlights.map((highlight) => (
                    <article key={highlight.id} className="metric-card">
                      <span>{highlight.label}</span>
                      <strong>{highlight.value}</strong>
                      <small>{highlight.source}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">Keine Highlight-Karten ohne gespeicherte Highlight-Quelle.</p>
              )}
            </section>
          </section>


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

          <section className={`panel${getViewClass("seasonPreview")}`} id="standings-preview">
            <div className="panel-header">
              <h2>Preview aus gespeicherten Results</h2>
              <ColumnVisibilityManager
                title="Spalten"
                columns={standingsPreviewColumns}
                isVisible={(columnId, visibleByDefault) =>
                  isTableColumnVisible("standingsPreviewTable", columnId, visibleByDefault)
                }
                onToggle={(columnId, nextVisible) =>
                  setTableColumnVisible("standingsPreviewTable", columnId, nextVisible)
                }
              />
            </div>
            <p className="muted">
              Scope: {standingsPreviewFeed?.scope?.saveId ?? activeSaveId} / {standingsPreviewFeed?.scope?.seasonId ?? gameState.season.id} /{" "}
              {standingsPreviewFeed?.scope?.matchdayId ?? gameState.matchdayState.matchdayId} · Teams: {standingsPreviewFeed?.summary.totalTeams ?? 0}
            </p>
            <p className="muted">
              Diese Version nutzt globales Gesamtscoring aller Teams; keine Fame-/Draw-/Allianzlogik.
            </p>
            <p className="muted">
              Read-only. Diese Vorschau liest lokale gespeicherte Spieltagsergebnisse, berechnet Punkte-Delta und projected Rank, aber schreibt keine Standings-, Cash- oder Preisgeldwerte.
            </p>
            {standingsPreviewFeed?.blockedRules?.length ? (
              <div className="panel" style={{ marginBottom: 16 }}>
                <strong>Globales Gesamtranking aller Teams, ohne Fame-, Draw- oder Allianzlogik.</strong>
                <p className="muted" style={{ marginTop: 8 }}>
                  Die Preview kombiniert gespeicherte Matchday-Results mit dem aktuellen lokalen Punktestand und der Rank-to-Points-Tabelle.
                  Offene Blocker betreffen nur fehlende Punkte-Mappings oder echte Tie-Breaker-Faelle.
                </p>
                <ul className="warning-list">
                  {standingsPreviewFeed.blockedRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
                {standingsPreviewFeed.blockedRules.includes("global_score_tie_breaker_missing") &&
                (standingsPreviewFeed.tieGroups?.length ?? 0) > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <strong>Gleichstand erkannt: Tie-Breaker-Regel fehlt. Apply bleibt blockiert.</strong>
                    <ul className="warning-list">
                      {standingsPreviewFeed.tieGroups.map((group, index) => (
                        <li key={`${group.type}-${group.value}-${index}`}>
                          {group.type} {formatLocalePoints(group.value, 2)}:{" "}
                          {group.affectedTeams.map((team) => `${team.teamName} (${team.teamId})`).join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="teams-summary-grid history-summary-grid">
              <article className="metric-card">
                <span>Stored Result</span>
                <strong>{standingsPreviewFeed?.summary.matchdayResultFound ? "gefunden" : "fehlend"}</strong>
              </article>
              <article className="metric-card">
                <span>Ready Teams</span>
                <strong>{standingsPreviewFeed?.summary.readyTeams ?? 0}</strong>
              </article>
              <article className="metric-card">
                <span>Blocked Rules</span>
                <strong>{standingsPreviewFeed?.blockedRules.length ?? 0}</strong>
              </article>
            </div>
            <div className="table-shell">
              <table className="team-table">
                <colgroup>
                  {visibleStandingsPreviewColumns.map((column) => (
                    <col key={column.id} style={{ width: `${getTableColumnWidth("standingsPreviewTable", column)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {visibleStandingsPreviewColumns.map((column) => (
                      <th
                        key={column.id}
                        {...getTableHeaderDragProps("standingsPreviewTable", column, visibleStandingsPreviewColumns)}
                        style={{ width: `${getTableColumnWidth("standingsPreviewTable", column)}px`, minWidth: `${column.minWidth}px` }}
                      >
                        <div className="resizable-header-cell">
                          <SortableHeader
                            label={column.label}
                            tableId="standingsPreview"
                            columnKey={column.dataKey}
                            sortState={tableSorts.standingsPreview}
                            onToggle={toggleTableSort}
                          />
                          <span
                            className="column-resizer"
                            draggable={false}
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`${column.label} Breite anpassen`}
                            onMouseDown={(event) => startTableColumnResize("standingsPreviewTable", column, event)}
                            onDoubleClick={() => resetTableColumnWidth("standingsPreviewTable", column)}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedStandingsPreviewRows.map((row) => (
                    <tr key={row.teamId} onClick={() => openTeamProfileById(row.teamId)}>
                      {visibleStandingsPreviewColumns.map((column) => {
                        if (column.id === "team") return <td key={column.id}><div className="table-team-cell"><strong>{row.teamName}</strong><span>{row.teamId}</span></div></td>;
                        if (column.id === "warnings") return <td key={column.id}>{row.warnings.join(", ") || "—"}</td>;
                        if (column.id === "readinessStatus") return <td key={column.id}>{row.readinessStatus}</td>;
                        if (column.id === "resultStatus") return <td key={column.id}>{row.resultStatus}</td>;
                        if (column.id === "currentRank") return <td key={column.id}>{row.currentRank ?? "—"}</td>;
                        if (column.id === "projectedRank") return <td key={column.id}>{row.projectedRank ?? "—"}</td>;
                        if (column.id === "currentPoints") return <td key={column.id}>{row.currentPoints ?? "BLOCKED"}</td>;
                        if (column.id === "projectedPoints") return <td key={column.id}>{row.projectedPoints ?? "—"}</td>;
                        if (column.id === "pointsDelta") return <td key={column.id}>{row.pointsDelta ?? "—"}</td>;
                        if (column.id === "matchdayRank") return <td key={column.id}>{row.matchdayRank ?? "—"}</td>;
                        if (column.id === "matchdayScore") return <td key={column.id}>{row.matchdayScore != null ? formatLocalePoints(row.matchdayScore, 2) : "—"}</td>;
                        if (column.id === "d1Score") return <td key={column.id}>{row.d1Score != null ? formatLocalePoints(row.d1Score) : "—"}</td>;
                        if (column.id === "d2Score") return <td key={column.id}>{row.d2Score != null ? formatLocalePoints(row.d2Score) : "—"}</td>;
                        if (column.id === "cash") return <td key={column.id}>{row.cash != null ? formatTransfermarktCurrency(row.cash) : "—"}</td>;
                        return <td key={column.id}>{row.totalScore != null ? formatLocalePoints(row.totalScore) : "—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

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
                  {gameState.teams.map((team) => (
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
                  {playerClassOptions.map((className) => (
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
                  {visiblePlayersTableColumns.map((column) => (
                    <col key={column.id} style={{ width: `${getTableColumnWidth("playersTable", column)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {visiblePlayersTableColumns.map((column) => (
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
                  {sortedPlayersTableRows.slice(0, 160).map((row) => (
                    <tr key={row.player.id} onClick={() => void openPlayerDrawerById(row.player.id, row.roster?.id)}>
                      {visiblePlayersTableColumns.map((column) => {
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
                                context="roster"
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
                                <span>{row.seasonPerformance?.sourceLabel ?? row.transferStatus}</span>
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
                                  <img
                                    className="players-table-team-logo"
                                    src={teamLogo.src}
                                    alt={`${row.team?.name ?? "Team"} Logo`}
                                    loading="lazy"
                                    decoding="async"
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

          <section className={`panel${getViewClass("ranks")}`} id="discipline-ranks">
            <div className="panel-header">
              <TooltipHeading
                as="h2"
                tooltip="Retool-Logik: Pro Team zaehlen je Disziplin die Top 6 aktiven Spieler, ihre Werte werden summiert und ligaweit gerankt. TOT / POW / SPE / MEN / SOC zeigen die aggregierten Teamranks derselben Quelle."
              >
                Ranks - Teamstaerke pro Diszi
              </TooltipHeading>
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
              {rankLeaderCards.map((entry) => (
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
                  {visibleDisciplineRanksColumns.map((column) => (
                    <col key={column.id} style={{ width: `${getTableColumnWidth("disciplineRanksTable", column)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {visibleDisciplineRanksColumns.map((column, columnIndex) => {
                      const discipline = orderedDisciplines.find((entry) => entry.id === column.id);
                      const previousDiscipline = [...visibleDisciplineRanksColumns.slice(0, columnIndex)]
                        .reverse()
                        .map((entry) => orderedDisciplines.find((disciplineEntry) => disciplineEntry.id === entry.id))
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
                  {sortedDisciplineRankRows.map((row) => (
                    <tr
                      key={row.team.teamId}
                      className={joinClassNames(
                        row.team.teamId === activeManagerTeamId && "is-active-team-row",
                        getOwnerTeamHighlightClass(resolvedTeamControlSettings[row.team.teamId]),
                      )}
                      onClick={() => openTeamProfileById(row.team.teamId)}
                    >
                      {visibleDisciplineRanksColumns.map((column, columnIndex) => {
                        if (column.id === "team") {
                          return <td key={column.id} className="ranks-sticky-team">{row.team.name}</td>;
                        }
                        if (column.id === "totalRank") return <td key={column.id} className={joinClassNames(getRanksMetricToneClass(column.id, "cell"), row.scorePack.total > 0 ? getRankHeatClass(row.totalRank, gameState.teams.length) : "")}>{row.totalRank}</td>;
                        if (column.id === "powRank") return <td key={column.id} className={joinClassNames(getRanksMetricToneClass(column.id, "cell"), row.scorePack.pow > 0 ? getRankHeatClass(row.powRank, gameState.teams.length) : "")}>{row.powRank}</td>;
                        if (column.id === "speRank") return <td key={column.id} className={joinClassNames(getRanksMetricToneClass(column.id, "cell"), row.scorePack.spe > 0 ? getRankHeatClass(row.speRank, gameState.teams.length) : "")}>{row.speRank}</td>;
                        if (column.id === "menRank") return <td key={column.id} className={joinClassNames(getRanksMetricToneClass(column.id, "cell"), row.scorePack.men > 0 ? getRankHeatClass(row.menRank, gameState.teams.length) : "")}>{row.menRank}</td>;
                        if (column.id === "socRank") return <td key={column.id} className={joinClassNames(getRanksMetricToneClass(column.id, "cell"), row.scorePack.soc > 0 ? getRankHeatClass(row.socRank, gameState.teams.length) : "")}>{row.socRank}</td>;
                        const rank = row.disciplineRanks[column.id] ?? 0;
                        const discipline = orderedDisciplines.find((entry) => entry.id === column.id);
                        const previousDiscipline = [...visibleDisciplineRanksColumns.slice(0, columnIndex)]
                          .reverse()
                          .map((entry) => orderedDisciplines.find((disciplineEntry) => disciplineEntry.id === entry.id))
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

          <section className={`panel${getViewClass("diszis")}`} id="discipline-config">
            <div className="panel-header">
              <TooltipHeading
                as="h2"
                tooltip="Diese Ansicht bildet den Diszis-Reiter aus dem Draftboard nach: originale Reihenfolge, neue Reihenfolge, Spieleranzahl und vorbereitete Mutator-Slots pro Disziplin."
              >
                Disziplin-Konfiguration
              </TooltipHeading>
              <ColumnVisibilityManager
                title="Spalten"
                columns={disciplineConfigTableColumns}
                activePreset={getTableActivePreset("disciplineConfigTable")}
                isVisible={(columnId, visibleByDefault) =>
                  isTableColumnVisible("disciplineConfigTable", columnId, visibleByDefault)
                }
                onToggle={(columnId, nextVisible) => setTableColumnVisible("disciplineConfigTable", columnId, nextVisible)}
                onMove={(columnId, direction) => moveTableColumn("disciplineConfigTable", columnId, direction, disciplineConfigTableColumns)}
                getWidth={(column) => getTableColumnWidth("disciplineConfigTable", column)}
                onStepWidth={(column, delta) => adjustTableColumnWidth("disciplineConfigTable", column, delta)}
                onResetWidth={(column) => resetTableColumnWidth("disciplineConfigTable", column)}
                onResetToDefault={() => resetTableLayout("disciplineConfigTable", disciplineConfigTableColumns)}
              />
            </div>
            <div className="discipline-category-filterbar" aria-label="Disziplin-Kategorien">
              {([
                { id: "all", label: "Alle" },
                { id: "power", label: "POW" },
                { id: "speed", label: "SPE" },
                { id: "mental", label: "MEN" },
                { id: "social", label: "SOC" },
              ] as Array<{ id: DisciplineCategoryFilter; label: string }>).map((filter) => (
                <button
                  key={`discipline-category-filter-${filter.id}`}
                  className={`secondary-button inline-button${disciplineCategoryFilter === filter.id ? " is-selected" : ""}`}
                  type="button"
                  onClick={() => setDisciplineCategoryFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
              <span>{visibleDisciplineConfigRows.length} Diszis</span>
            </div>
            <div className="table-shell">
              <table className="team-table discipline-config-table">
                <colgroup>
                  {visibleDisciplineConfigColumns.map((column) => (
                    <col key={column.id} style={{ width: `${getTableColumnWidth("disciplineConfigTable", column)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {visibleDisciplineConfigColumns.map((column) => (
                      <th
                        key={column.id}
                        {...getTableHeaderDragProps("disciplineConfigTable", column, visibleDisciplineConfigColumns)}
                        style={{ width: `${getTableColumnWidth("disciplineConfigTable", column)}px`, minWidth: `${column.minWidth}px` }}
                      >
                        <div className="resizable-header-cell">
                          <SortableHeader label={column.label} tableId="disciplineConfig" columnKey={column.dataKey} sortState={tableSorts.disciplineConfig} onToggle={toggleTableSort} />
                          <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("disciplineConfigTable", column, event)} onDoubleClick={() => resetTableColumnWidth("disciplineConfigTable", column)} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleDisciplineConfigRows.map((discipline) => (
                    <tr key={discipline.id}>
                      {visibleDisciplineConfigColumns.map((column) => {
                        if (column.id === "originalOrder") return <td key={column.id} className={`discipline-order-cell is-${discipline.category}`}>{discipline.originalOrder}</td>;
                        if (column.id === "displayOrder") return <td key={column.id}>{discipline.displayOrder}</td>;
                        if (column.id === "name") {
                          return (
                            <td key={column.id}>
                              <div className="table-player-cell">
                                <strong>{discipline.name}</strong>
                                <span>{discipline.category}</span>
                              </div>
                            </td>
                          );
                        }
                        if (column.id === "playerCount") return <td key={column.id}>{discipline.playerCount}</td>;
                        if (column.id === "mutator1") return <td key={column.id}>{discipline.mutator1 || "-"}</td>;
                        return <td key={column.id}>{discipline.mutator2 || "-"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel inset-panel" style={{ marginTop: 16 }}>
              <div className="panel-header">
                <div className="stack">
                  <TooltipHeading
                    as="h3"
                    tooltip="Einsatzliste, Cockpit, Matchday Auto-Run und Whole Season DryRun lesen denselben lokalen Plan."
                  >
                    Saison-Matchday-Plan
                  </TooltipHeading>
                </div>
                <span className="pill">
                  {seasonDisciplineScheduleRows[0]?.sourceStatus ?? "legacy_seed"}
                </span>
              </div>
              <div className="table-shell">
                <table className="team-table discipline-config-table">
                  <thead>
                    <tr>
                      <th>Spieltag</th>
                      <th>D1</th>
                      <th>D1 Spieler</th>
                      <th>D2</th>
                      <th>D2 Spieler</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonDisciplineScheduleRows.map((entry) => (
                      <tr key={entry.matchdayId}>
                        <td className={entry.matchdayId === gameState.matchdayState.matchdayId ? "is-current-matchday" : undefined}>
                          {entry.matchdayLabel}
                        </td>
                        <td>{entry.discipline1?.displayName ?? "—"}</td>
                        <td>{entry.discipline1?.playerCount ?? "—"}</td>
                        <td>{entry.discipline2?.displayName ?? "—"}</td>
                        <td>{entry.discipline2?.playerCount ?? "—"}</td>
                        <td>{entry.sourceStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {seasonDisciplineScheduleRows[0]?.sourceNote ? (
                <p className="muted" style={{ marginTop: 10 }}>
                  {seasonDisciplineScheduleRows[0].sourceNote}
                </p>
              ) : null}
            </div>
          </section>

          <section className={`panel${getViewClass("ranks")}`}>
            <div className="panel-header">
            <TooltipHeading
              as="h2"
              tooltip="Summe aus POW, SPE, MEN und SOC je Team. Werte in Klammern, z.B. (+8), zeigen den reinen Formkartenbonus, der in diese Punkte eingeflossen ist. Top 3 sind stark markiert, Rang 4-10 markiert, ab Rang 11 neutral."
            >
              PPs pro Bereich
            </TooltipHeading>
            </div>
            <div className="table-shell narrow-table-shell season-pp-summary-shell">
              <table className="team-table pp-table season-pp-table">
                <thead>
                  <tr>
                    <th><SortableHeader label="Rank" tableId="ppArea" columnKey="rank" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th><SortableHeader label="Team" tableId="ppArea" columnKey="team" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th><SortableHeader label="PPs" tableId="ppArea" columnKey="pps" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th className="pp-head-pow"><SortableHeader label="PP Pow" tableId="ppArea" columnKey="pow" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th className="pp-head-spe"><SortableHeader label="PP Spe" tableId="ppArea" columnKey="spe" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th className="pp-head-men"><SortableHeader label="PP Men" tableId="ppArea" columnKey="men" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th className="pp-head-soc"><SortableHeader label="PP Soc" tableId="ppArea" columnKey="soc" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPpAreaRows.map((row) => {
                    const teamId = row.team.teamId;
                    return (
                      <tr key={row.team.teamId} onClick={() => openTeamProfileById(row.team.teamId)}>
                        <td>{row.rank}</td>
                        <td>{row.team.name}</td>
                            <td className={ppAreaRankClassMaps.total.get(teamId) || undefined}>
                              {renderMetricBar(row.pps.total, {
                                tone: "pps",
                                pool: ppAreaMetricPools.total,
                                fallbackMax: 300,
                                format: (value) => formatPpsValue(value),
                                detail: formatPpFormBonus(row.formBonus.total),
                                detailNegative: (row.formBonus.total ?? 0) < 0,
                              })}
                            </td>
                            <td className={ppAreaRankClassMaps.pow.get(teamId) || undefined}>
                              {renderMetricBar(row.pps.pow, {
                                tone: "pow",
                                pool: ppAreaMetricPools.pow,
                                fallbackMax: 120,
                                format: (value) => formatPpsValue(value),
                                detail: formatPpFormBonus(row.formBonus.pow),
                                detailNegative: (row.formBonus.pow ?? 0) < 0,
                              })}
                            </td>
                            <td className={ppAreaRankClassMaps.spe.get(teamId) || undefined}>
                              {renderMetricBar(row.pps.spe, {
                                tone: "spe",
                                pool: ppAreaMetricPools.spe,
                                fallbackMax: 120,
                                format: (value) => formatPpsValue(value),
                                detail: formatPpFormBonus(row.formBonus.spe),
                                detailNegative: (row.formBonus.spe ?? 0) < 0,
                              })}
                            </td>
                            <td className={ppAreaRankClassMaps.men.get(teamId) || undefined}>
                              {renderMetricBar(row.pps.men, {
                                tone: "men",
                                pool: ppAreaMetricPools.men,
                                fallbackMax: 120,
                                format: (value) => formatPpsValue(value),
                                detail: formatPpFormBonus(row.formBonus.men),
                                detailNegative: (row.formBonus.men ?? 0) < 0,
                              })}
                            </td>
                            <td className={ppAreaRankClassMaps.soc.get(teamId) || undefined}>
                              {renderMetricBar(row.pps.soc, {
                                tone: "soc",
                                pool: ppAreaMetricPools.soc,
                                fallbackMax: 120,
                                format: (value) => formatPpsValue(value),
                                detail: formatPpFormBonus(row.formBonus.soc),
                                detailNegative: (row.formBonus.soc ?? 0) < 0,
                              })}
                            </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <FoundationSponsorsPanel
            gameState={gameState}
            selectedTeamName={selectedTeam?.name ?? "Team"}
            selectedTeamCommercialRating={selectedTeamCommercialRating}
            selectedTeamSponsorContract={selectedTeamSponsorContract}
            selectedTeamSponsorOffers={selectedTeamSponsorOffers}
            sponsorChoiceMessage={sponsorChoiceMessage}
            sponsorChoiceProfiles={sponsorChoiceProfiles}
            sponsorChoiceBusy={sponsorChoiceBusy}
            selectedTeamCanManage={selectedTeamCanManage}
            getViewClass={getViewClass}
            formatMoney={formatMoney}
            applySponsorNegotiationToComponents={applySponsorNegotiationToComponents}
            getSponsorNegotiationMultiplier={getSponsorNegotiationMultiplier}
            setSponsorChoiceProfiles={setSponsorChoiceProfiles}
            chooseTeamSponsor={chooseTeamSponsor}
            prizeFinanceTab={prizeFinanceTab}
          />

          <section className={`panel${getViewClass("prize")}${prizeFinanceTab !== "prize" ? " foundation-section-hidden" : ""}`} id="prize-money">
            <div className="prize-v2-shell">
              <section className="prize-v2-hero">
                <div className="prize-v2-hero-copy">
                  <span className="prize-v2-kicker">Preisgeld</span>
                  <h2>{gameState.season.name} · Saisonende</h2>
                  <p>
                    Echte Preisgeldtabelle mit Basis-Anteil, Season-Anteil, Bonus/Malus und 5-Seasons-Forecast.
                    Der Ablauf bleibt gleich: Endstand, Preisgeld/Cash, dann erst Verkaufs- und Kaufphase.
                  </p>
                  <div className="prize-v2-pill-row">
                    <span className="pill foundation-source-pill">{getViewSourceBadgeLabel("prize", activeContextMeta)}</span>
                    <span className={`pill ${prizePreviewHardBlocked.length > 0 ? "is-warning" : "is-ready"}`}>
                      {prizePreviewHardBlocked.length > 0 ? `${prizePreviewHardBlocked.length} Blocker` : "ohne Blocker"}
                    </span>
                    <span className="pill">{prizeV2Summary.calculableTeams}/{prizeV2Summary.totalTeams} Teams berechenbar</span>
                  </div>
                </div>
                <div className="prize-v2-hero-actions">
                  <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("seasonV2", setActiveView)}>
                    Saison v2
                  </button>
                  <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("teams", setActiveView)}>
                    Teams
                  </button>
                </div>
              </section>

              <section className="prize-v2-story-grid" aria-label="Preisgeld-Fokus">
                <article className="prize-v2-story-card is-leader">
                  <span>Top Auszahlung</span>
                  <strong>{prizeV2LeaderRow ? prizeV2LeaderRow.teamName : "—"}</strong>
                  <small>{prizeV2LeaderRow ? `#${prizeV2LeaderRow.rank ?? "—"} · ${formatNullableMoney(prizeV2LeaderRow.prizeMoney)}` : "kein Leader"}</small>
                </article>
                <article className="prize-v2-story-card is-selected">
                  <span>Dein Outlook</span>
                  <strong>{prizeV2SelectedTeamSummary ? prizeV2SelectedTeamSummary.teamName : "—"}</strong>
                  <small>
                    {prizeV2SelectedTeamSummary
                      ? `#${prizeV2SelectedTeamSummary.rank ?? "—"} · ${formatLocalePoints(prizeV2SelectedTeamSummary.currentCash, 1)} → ${formatLocalePoints(prizeV2SelectedTeamSummary.projectedCash, 1)}`
                      : "kein Team aktiv"}
                  </small>
                </article>
                <article className="prize-v2-story-card is-swing">
                  <span>Größter Swing</span>
                  <strong>{prizeV2SwingRow ? prizeV2SwingRow.teamName : "—"}</strong>
                  <small>
                    {prizeV2SwingRow
                      ? `${formatSignedDisplayMoney(prizeV2SwingRow.rankDelta)} Plätze · ${formatSignedDisplayMoney(prizeV2SwingRow.bonusMalus)}`
                      : "kein Ausschlag"}
                  </small>
                </article>
                <article className="prize-v2-story-card is-risk">
                  <span>Finanzrisiko</span>
                  <strong>{prizeV2RiskRow ? prizeV2RiskRow.teamName : "—"}</strong>
                  <small>
                    {prizeV2RiskRow
                      ? `Cash danach ${formatLocalePoints(prizeV2RiskRow.projectedCash, 1)} · ${prizeV2RiskRow.warnings.length} Hinweise`
                      : "kein Drucksignal"}
                  </small>
                </article>
              </section>

              <section className="prize-v2-factor-strip" aria-label="Saisonfaktoren">
                {prizeV2FactorRows.length > 0 ? (
                  prizeV2FactorRows.map((entry) => (
                    <article key={entry.seasonLabel} className={`prize-v2-factor-card ${entry.factor == null ? "is-neutral" : entry.factor >= 1.18 ? "is-strong" : entry.factor >= 1 ? "is-good" : entry.factor >= 0.9 ? "is-mid" : "is-low"}`}>
                      <span>{entry.seasonLabel}</span>
                      <strong>{formatLocalePoints(entry.factor, 2)}</strong>
                    </article>
                  ))
                ) : (
                  <article className="prize-v2-factor-card is-neutral">
                    <span>Faktoren</span>
                    <strong>—</strong>
                  </article>
                )}
              </section>

              <section className="prize-v2-main-grid">
                <div className="prize-v2-table-panel">
                  <div className="panel-header prize-v2-panel-header">
                    <div className="stack">
                      <h3>Preisgeld-Tabelle</h3>
                      <p className="muted">Die klassische Haupttabelle bleibt vorne. Spalten, Sortierung und Forecast bleiben erhalten.</p>
                    </div>
                    <ColumnVisibilityManager
                      title="Spalten"
                      columns={prizePreviewTableColumns}
                      activePreset={getTableActivePreset("prizePreviewTable")}
                      isVisible={(columnId, visibleByDefault) =>
                        isTableColumnVisible("prizePreviewTable", columnId, visibleByDefault)
                      }
                      onToggle={(columnId, nextVisible) => setTableColumnVisible("prizePreviewTable", columnId, nextVisible)}
                      onMove={(columnId, direction) => moveTableColumn("prizePreviewTable", columnId, direction, prizePreviewTableColumns)}
                      getWidth={(column) => getTableColumnWidth("prizePreviewTable", column)}
                      onStepWidth={(column, delta) => adjustTableColumnWidth("prizePreviewTable", column, delta)}
                      onResetWidth={(column) => resetTableColumnWidth("prizePreviewTable", column)}
                      onResetToDefault={() => resetTableLayout("prizePreviewTable", prizePreviewTableColumns)}
                    />
                  </div>
                  <section className="prize-v2-primary-forecast">
                    <div className="panel-header prize-v2-panel-header">
                      <div className="stack">
                        <h3>Eigenes Team Forecast</h3>
                        <p className="muted">Das eigene Team steht oben: Cash, Faktor, Preisgeld und 5-Seasons-Folge direkt an der Haupttabelle.</p>
                      </div>
                      <label className="filter-field prize-forecast-rank-select">
                        <span>Platz simulieren</span>
                        <select
                          className="input"
                          value={prizeForecastRank}
                          onChange={(event) => setPrizeForecastRank(clampValue(Number(event.target.value), 1, 32))}
                        >
                          {Array.from({ length: Math.max(32, prizePreviewFeed?.summary.prizeRowsCount ?? 0) }, (_, index) => index + 1).map((rank) => (
                            <option key={rank} value={rank}>
                              Platz {rank}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="prize-v2-team-strip">
                      <article>
                        <span>Cash vorher</span>
                        <strong>{prizeV2SelectedTeamSummary?.currentCash != null ? formatLocalePoints(prizeV2SelectedTeamSummary.currentCash, 1) : "—"}</strong>
                      </article>
                      <article>
                        <span>Season Faktor</span>
                        <strong>{formatLocalePoints(prizePreviewFeed?.summary.currentFactor ?? null, 2)}</strong>
                      </article>
                      <article>
                        <span>Preisgeld</span>
                        <strong>{prizeV2SelectedTeamSummary?.prizeMoney != null ? formatLocalePoints(prizeV2SelectedTeamSummary.prizeMoney, 1) : "—"}</strong>
                      </article>
                      <article>
                        <span>Bonus / Malus</span>
                        <strong className={prizeV2SelectedTeamSummary?.bonusMalus != null && prizeV2SelectedTeamSummary.bonusMalus < 0 ? "text-negative" : "text-positive"}>
                          {formatSignedDisplayMoney(prizeV2SelectedTeamSummary?.bonusMalus)}
                        </strong>
                      </article>
                      <article>
                        <span>Cash nachher</span>
                        <strong>{prizeV2SelectedTeamSummary?.projectedCash != null ? formatLocalePoints(prizeV2SelectedTeamSummary.projectedCash, 1) : "—"}</strong>
                      </article>
                      <article>
                        <span>Simulierter Platz</span>
                        <strong>{prizeForecastRankRow ? `${prizeForecastRank}.` : "—"}</strong>
                      </article>
                    </div>
                    {prizeForecastRows.length === 0 ? (
                      <p className="muted">Forecast wartet auf Preisgeld-Preview, Team-Cash und Gehaltssumme.</p>
                    ) : (
                      <div className="table-shell prize-v2-forecast-shell">
                        <table className="team-table prize-v2-forecast-table">
                          <thead>
                            <tr>
                              <th>Season</th>
                              <th>Faktor</th>
                              <th>Preisgeld</th>
                              <th>Gehalt</th>
                              <th>GuV</th>
                              <th>Cash</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prizeForecastRows.map((row) => (
                              <tr key={row.label}>
                                <td>{row.label}</td>
                                <td>{formatLocalePoints(row.factor ?? null, 2)}</td>
                                <td>{row.prizeMoney != null ? formatLocalePoints(row.prizeMoney, 1) : "—"}</td>
                                <td>{row.salaryTotal != null ? formatLocalePoints(row.salaryTotal, 1) : "—"}</td>
                                <td className={row.guv != null && row.guv < 0 ? "text-negative" : "text-positive"}>{formatSignedDisplayMoney(row.guv)}</td>
                                <td>{row.cashAfter != null ? formatLocalePoints(row.cashAfter, 1) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                  <div className="table-shell">
                    <table className="team-table prize-team-table">
                <colgroup>
                  {visiblePrizePreviewColumns.map((column) => (
                    <col key={column.id} style={{ width: `${getTableColumnWidth("prizePreviewTable", column)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {visiblePrizePreviewColumns.map((column) => (
                      <th
                        key={column.id}
                        {...getTableHeaderDragProps("prizePreviewTable", column, visiblePrizePreviewColumns)}
                        style={{ width: `${getTableColumnWidth("prizePreviewTable", column)}px`, minWidth: `${column.minWidth}px` }}
                      >
                        <div className="resizable-header-cell">
                          <SortableHeader label={column.label} tableId="prizePreview" columnKey={column.dataKey} sortState={tableSorts.prizePreview} onToggle={toggleTableSort} />
                          <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("prizePreviewTable", column, event)} onDoubleClick={() => resetTableColumnWidth("prizePreviewTable", column)} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayPrizePreviewRows.map((row) => (
                    <tr
                      key={row.teamId}
                      className={`prize-team-table-row${row.teamId === selectedTeam?.teamId ? " is-selected" : ""}`}
                      onClick={() => openTeamProfileById(row.teamId)}
                    >
                      {visiblePrizePreviewColumns.map((column) => {
                        if (column.id === "team") return <td key={column.id}>{row.teamName}</td>;
                        if (column.id === "projectedRank") return <td key={column.id}>{row.rank ?? "—"}</td>;
                        if (column.id === "startRank") return <td key={column.id}>{row.rankChangePrize?.startRank ?? "—"}</td>;
                        if (column.id === "rankDelta") return <td key={column.id}>{row.rankChangePrize?.rankDelta != null ? formatLocalePoints(row.rankChangePrize.rankDelta, 0) : "—"}</td>;
                        if (column.id === "currentCash") return <td key={column.id}>{row.currentCash != null ? formatLocalePoints(row.currentCash, 1) : "—"}</td>;
                        if (column.id === "basisCash") return <td key={column.id}>{row.basisCash != null ? formatLocalePoints(row.basisCash, 1) : "—"}</td>;
                        if (column.id === "seasonCash") return <td key={column.id}>{row.seasonCash != null ? formatLocalePoints(row.seasonCash, 1) : "—"}</td>;
                        if (column.id === "currentFactor") {
                          return <td key={column.id}>{formatLocalePoints(prizePreviewFeed?.summary.currentFactor ?? null, 2)}</td>;
                        }
                        if (column.id === "prizeMoney") return <td key={column.id}>{row.prizeMoney != null ? formatLocalePoints(row.prizeMoney, 1) : "—"}</td>;
                        if (column.id === "rankChangePrize") return <td key={column.id}>{row.rankChangePrize?.bonusMalus != null ? formatLocalePoints(row.rankChangePrize.bonusMalus, 1) : "—"}</td>;
                        if (column.id === "payoutIfTenBetter") return <td key={column.id}>{row.payoutIfTenBetter != null ? formatLocalePoints(row.payoutIfTenBetter, 1) : "—"}</td>;
                        if (column.id === "payoutIfTenWorse") return <td key={column.id}>{row.payoutIfTenWorse != null ? formatLocalePoints(row.payoutIfTenWorse, 1) : "—"}</td>;
                        if (column.id === "projectedCash") return <td key={column.id}>{row.projectedCash != null ? formatLocalePoints(row.projectedCash, 1) : "—"}</td>;
                        if (column.id === "warnings") return <td key={column.id}>{row.warnings.join(", ") || "—"}</td>;
                        const seasonLabel = column.id.replace(/^future-/, "");
                        const seasonRow = row.futureSeasons?.find((future) => future.seasonLabel === seasonLabel) ?? null;
                        return <td key={column.id}>{seasonRow?.prizeMoney != null ? formatLocalePoints(seasonRow.prizeMoney, 1) : "—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
                  </div>
                </div>

                <aside className="prize-v2-side-rail">
                  <section className="prize-v2-side-panel">
                    <div className="panel-header prize-v2-panel-header">
                      <div className="stack">
                        <h3>Season-End Review</h3>
                        <p className="muted">Die Funktion von v1 bleibt: lesen, prüfen, dann erst Season-End-Schritte auslösen.</p>
                      </div>
                      <span className={getCockpitStatusPillClass(prizeApplyState.status)}>{prizeApplyState.label}</span>
                    </div>
                    <div className="prize-v2-review-grid">
                      <article>
                        <span>Preisgeld-Zeilen</span>
                        <strong>{prizePreviewFeed?.summary.prizeRowsCount ?? 0}</strong>
                      </article>
                      <article>
                        <span>Berechenbar</span>
                        <strong>{prizePreviewFeed?.summary.calculableTeams ?? 0}</strong>
                      </article>
                      <article>
                        <span>Faktor aktuell</span>
                        <strong>{formatLocalePoints(prizePreviewFeed?.summary.currentFactor ?? null, 2)}</strong>
                      </article>
                      <article>
                        <span>Folge-Seasons</span>
                        <strong>{prizePreviewFeed?.summary.futureSeasonCount ?? 0}</strong>
                      </article>
                      <article>
                        <span>Rank Bonus/Malus</span>
                        <strong className={prizePreviewFeed?.summary.totalRankChangePrize != null && prizePreviewFeed.summary.totalRankChangePrize < 0 ? "text-negative" : "text-positive"}>
                          {prizePreviewFeed?.summary.totalRankChangePrize != null ? formatSignedDisplayMoney(prizePreviewFeed.summary.totalRankChangePrize) : "—"}
                        </strong>
                      </article>
                      <article>
                        <span>Champion</span>
                        <strong>{seasonEndChampionRow?.team.name ?? "—"}</strong>
                      </article>
                    </div>
                    {prizeV2SelectedTeamSummary ? (
                      <div className="prize-v2-scenario-box">
                        <strong>{prizeV2SelectedTeamSummary.teamName}</strong>
                        <small>
                          {prizePreviewFeed?.scenarioWindow
                            ? `+${prizePreviewFeed.scenarioWindow.betterBy}: ${formatNullableMoney(prizeV2SelectedTeamSummary.payoutIfTenBetter)} · -${prizePreviewFeed.scenarioWindow.worseBy}: ${formatNullableMoney(prizeV2SelectedTeamSummary.payoutIfTenWorse)}`
                            : "Kein Szenariofenster gefunden."}
                        </small>
                      </div>
                    ) : null}
                    {prizePreviewHardBlocked.length > 0 ? (
                      <div className="prize-v2-warning-box is-blocked">
                        <strong>Blocker</strong>
                        <ul>
                          {prizePreviewHardBlocked.slice(0, 4).map((rule) => (
                            <li key={rule}>{rule}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {prizePreviewGlobalWarnings.length > 0 ? (
                      <div className="prize-v2-warning-box">
                        <strong>Hinweise</strong>
                        <ul>
                          {prizePreviewGlobalWarnings.slice(0, 4).map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <p className="muted cockpit-step-hint">
                      RankChange: Season 1 nutzt Startbudget als StartRank; spätere Seasons nutzen den Vorjahresrang, falls als Quelle vorhanden.
                    </p>
                  </section>
                </aside>
              </section>
            </div>
          </section>

          {activeView === "teams" && selectedTeam ? (
          <FoundationTeamsDetailPanel
            active
            gameState={gameState}
            selectedTeam={selectedTeam}
            sortedTeamsViewRows={sortedTeamsViewRows}
            visibleTeamsViewColumns={visibleTeamsViewColumns}
            getViewClass={getViewClass}
            SortableHeader={SortableHeader}
            getTableColumnWidth={getTableColumnWidth}
            getTableHeaderDragProps={getTableHeaderDragProps}
            getTeamsViewColumnTitle={getTeamsViewColumnTitle}
            toggleTableSort={toggleTableSort}
            startTableColumnResize={startTableColumnResize}
            resetTableColumnWidth={resetTableColumnWidth}
            tableSorts={tableSorts}
            joinClassNames={joinClassNames}
            getOwnerTeamHighlightClass={getOwnerTeamHighlightClass}
            resolvedTeamControlSettings={resolvedTeamControlSettings}
            scheduleActiveManagerTeam={scheduleActiveManagerTeam}
            openTeamProfileById={openTeamProfileById}
            formatMoney={formatMoney}
            formatLocalePoints={formatLocalePoints}
            getSeasonCashHeatClass={getSeasonCashHeatClass}
            formatWholeNumber={formatWholeNumber}
            getTeamAxisRankTooltip={getTeamAxisRankTooltip}
            getRankHeatClass={getRankHeatClass}
            teamHistoryPointRankMaps={teamHistoryPointRankMaps}
            selectedTeamsHistoryData={selectedTeamsHistoryData}
            teamEconomyTiles={teamEconomyTiles}
            formatNullableMoney={formatNullableMoney}
            formatSignedDisplayMoney={formatSignedDisplayMoney}
            getTeamHistoryRankToneClass={getTeamHistoryRankToneClass}
            selectedTeamObjectives={selectedTeamObjectives}
            teamObjectiveOverview={teamObjectiveOverview}
            selectedTeamSponsorContract={selectedTeamSponsorContract}
            selectedTeamSponsorOffers={selectedTeamSponsorOffers}
            selectedTeamCommercialRating={selectedTeamCommercialRating}
            sponsorChoiceMessage={sponsorChoiceMessage}
            sponsorChoiceProfiles={sponsorChoiceProfiles}
            sponsorChoiceBusy={sponsorChoiceBusy}
            applySponsorNegotiationToComponents={applySponsorNegotiationToComponents}
            getSponsorNegotiationMultiplier={getSponsorNegotiationMultiplier}
            setSponsorChoiceProfiles={setSponsorChoiceProfiles}
            chooseTeamSponsor={chooseTeamSponsor}
            selectedTeamContractShapeMix={selectedTeamContractShapeMix}
            renderMetricBar={renderMetricBar}
            leaguePlayerHeatPools={leaguePlayerHeatPools}
            selectedTeamDetailTab={selectedTeamDetailTab}
            teamRosterRoleFilter={teamRosterRoleFilter}
            setTeamRosterRoleFilter={setTeamRosterRoleFilter}
            teamRosterFocusMode={teamRosterFocusMode}
            setTeamRosterFocusMode={setTeamRosterFocusMode}
            sortedSelectedRosterTableRows={sortedSelectedRosterTableRows}
            filteredSelectedRosterTableRows={filteredSelectedRosterTableRows}
            selectedStandingRow={selectedStandingRow}
            selectedRoster={selectedRoster}
            visibleSelectedRosterColumns={visibleSelectedRosterColumns}
            selectedTeamContractTable={selectedTeamContractTable}
            selectedTeamContractPreviewRowCount={selectedTeamContractPreviewRowCount}
            visibleSelectedTeamContractRows={visibleSelectedTeamContractRows}
            showTeamContractPreviewRows={showTeamContractPreviewRows}
            setShowTeamContractPreviewRows={setShowTeamContractPreviewRows}
            contractRenewalBusy={contractRenewalBusy}
            openContractRenewalNegotiation={openContractRenewalNegotiation}
            openMarketSellModal={openMarketSellModal}
            openPlayerDrawerById={openPlayerDrawerById}
            playerRatingsById={playerRatingsById}
            getPlayerPortraitModel={getPlayerPortraitModel}
            getClassColorClassName={getClassColorClassName}
            getRosterEntryDisplaySalary={getRosterEntryDisplaySalary}
            getRosterEntryDisplayMarketValue={getRosterEntryDisplayMarketValue}
            renderEconomyDelta={renderEconomyDelta}
            getPlayerDisplayMarketValueDelta={getPlayerDisplayMarketValueDelta}
            getRosterEntrySalaryDelta={getRosterEntrySalaryDelta}
            formatPpsValue={formatPpsValue}
            formatDisplayMoney={formatDisplayMoney}
            formatContractShapeLabel={formatContractShapeLabel}
            formatMoraleContractIntentLabel={formatMoraleContractIntentLabel}
            getPlayerDisplaySalary={getPlayerDisplaySalary}
            starters={starters}
            bench={bench}
            selectedIdentity={selectedIdentity}
            freeAgents={freeAgents}
            aiPreview={aiPreview}
            selectedAiTeamId={selectedAiTeamId}
            aiMarketPreview={aiMarketPreview}
            isPending={isPending}
            isReadOnlyMode={readMeta.readOnly}
            showReadOnlyNotice={showReadOnlyNotice}
            setGameState={setGameState}
            runAiTurn={runAiTurn}
            showExtendedTeamPanels={showExtendedTeamPanels}
            setShowExtendedTeamPanels={setShowExtendedTeamPanels}
            formatTransfermarktCurrency={formatTransfermarktCurrency}
            roundViewNumber={roundViewNumber}
            getLineupDraftSideCounts={getLineupDraftSideCounts}
            isSelectedTeamManagementLocked={isSelectedTeamManagementLocked}
            selectedTeamControl={selectedTeamControl}
            formatTeamControlModeLabel={formatTeamControlModeLabel}
            openTeamDrawerById={openTeamDrawerById}
            selectedRosterTableRows={selectedRosterTableRows}
            shouldBuildTeamContracts={shouldBuildTeamContracts}
            playerSeasonPerformanceMap={playerSeasonPerformanceMap}
            confirmContractRenewalNegotiation={confirmContractRenewalNegotiation}
            formatObjectiveStatusLabel={formatObjectiveStatusLabel}
            formatCockpitReason={formatCockpitReason}
            getPoolHeatClass={getPoolHeatClass}
            getResponsiveTableImageSize={getResponsiveTableImageSize}
            getTeamLogoModel={getTeamLogoModel}
            setContractRenewalNegotiation={setContractRenewalNegotiation}
            setShowSelectedRosterPpsBreakdown={setShowSelectedRosterPpsBreakdown}
            setShowTeamDisciplines={setShowTeamDisciplines}
            toggleTransferSellMarker={toggleTransferSellMarker}
            selectedBoardConfidence={selectedBoardConfidence}
            showTeamDisciplines={showTeamDisciplines}
            teamRosterRoleFilterOptions={teamRosterRoleFilterOptions}
            teamRosterFocusOptions={teamRosterFocusOptions}
            contractRenewalNegotiation={contractRenewalNegotiation}
            showSelectedRosterPpsBreakdown={showSelectedRosterPpsBreakdown}
            selectedTeamCanManage={selectedTeamCanManage}
            selectedTeamRosterActionsAvailable={selectedTeamRosterActionsAvailable}
            selectedTeamRosterActionHint={selectedTeamRosterActionHint}
            contractRenewalMessage={contractRenewalMessage}
            contractRenewalError={contractRenewalError}
          />
          ) : null}

          {isTransferMarketViewActive ? (
          <FoundationTransfermarktV2Panel
            active
            transferWindowStatus={transferWindowStatus}
            marketVisibleFeedCount={marketFeed?.poolAudit.visibleFeedCount ?? 0}
            marketActiveFreeAgentCount={marketFeed?.poolAudit.activeFreeAgentCount ?? 0}
            sourceBadgeLabel={getViewSourceBadgeLabel("marketV2", activeContextMeta)}
            activeSaveName={activeSaveName}
            seasonId={gameState.season.id}
            selectedTeamLabel={selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "—"}
            formatGamePhaseLabel={formatGamePhaseLabel}
            clientKey={`market-v2-${activeSaveId}-${gameState.season.id}`}
            client={{
              defaultSaveId: activeSaveId,
              defaultSeasonId: gameState.season.id,
              bootstrapReady: !isFoundationBootstrapState,
              defaultTeamId: activeManagerTeamId,
              source: readMeta.source,
              activeOwnerId: effectiveActiveOwnerId,
              manageableTeamIds: foundationManageableTeamIds,
              teamControlModesByTeamId: Object.fromEntries(
                Object.entries(resolvedTeamControlSettings).map(([teamId, settings]) => [teamId, settings.controlMode]),
              ),
              teamControlOwnersByTeamId: Object.fromEntries(
                Object.entries(resolvedTeamControlSettings).map(([teamId, settings]) => [
                  teamId,
                  {
                    ownerId: settings.ownerId ?? null,
                    ownerSlot: settings.ownerSlot ?? null,
                  },
                ]),
              ),
              teams: gameState.teams,
              disciplines: gameState.disciplines,
              rosterRows: transferMarketV2RosterRows,
              wishlistEntries: transferWishlistEntriesForMarketV2,
              wishlistPlayerIds: transferWishlistEntriesForMarketV2.map((entry) => entry.playerId),
              boardObjectiveHighlights: selectedTransfermarktBoardObjectives,
              onOpenPlayerDetails: (payload) => openPlayerDrawerById(payload.playerId, payload.activePlayerId),
              onOpenHistory: () => setFoundationView("historyV2", setActiveView),
              onToggleWishlist: (item) => {
                toggleTransferWishlist(item);
              },
              onRemoveWishlist: (playerId) => {
                removeTransferWishlistEntry(playerId);
              },
              scoutingWatchPlayerIds: transferMarketScoutingWatchPlayerIds,
              scoutingIntelByPlayerId: transferMarketScoutingIntelByPlayerId,
              scoutingActiveWishlistPlayerIds: transferMarketActiveWishlistPlayerIds,
              scoutingPipelineCapacity: activeManagerTeamId
                ? {
                    occupied: getTeamTransferWishlistEntries(gameState, activeManagerTeamId).length,
                    max: getScoutingWishlistSlotLimit(gameState, activeManagerTeamId),
                    draftSuspended: isTeamSetupDraftWishlistPhase(gameState, activeManagerTeamId),
                  }
                : null,
              onToggleScoutingWatch: (item) => {
                toggleScoutingWatch(item);
              },
              initialPlayerId: marketFocusPlayerId,
              onInitialPlayerFocusConsumed: () => setMarketFocusPlayerId(null),
              offerPanelActive: foundationPanel === "offer" && activeView === "marketV2",
              onOpenOfferPanel: openMarketOfferPanel,
              onCloseOfferPanel: closeFoundationDrilldownPanel,
              roomContext,
              onBuyCompleted: async (teamId) => {
                setActiveManagerTeam(teamId, "manual_select");
                setFoundationActionFeedback({
                  tone: "success",
                  title: "Kauf abgeschlossen",
                  detail: `${getTeamLockedName(teamId)} wurde aktualisiert. Cash, Gehalt, Kader und Marktfeed sind neu geladen.`,
                });
                await loadSave(activeSaveId);
              },
              onSell: (payload) => {
                void openMarketSellModal({
                  activePlayerId: payload.activePlayerId,
                  playerId: payload.playerId,
                  playerName: payload.playerName,
                  className: payload.className,
                  race: payload.race ?? "",
                  portraitUrl: payload.portraitUrl ?? null,
                });
              },
            }}
          />
          ) : null}

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
                          {(marketSellPlayerContext?.areaRows ?? []).map((area) => (
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
                              <span>AI-Empfehlung</span>
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
                                  {marketSellPreview.coaching.reasonsToSell.map((reason) => (
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
                                  {marketSellPreview.coaching.reasonsToKeep.map((reason) => (
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
                              {marketSellPreview.blockingReasons.map((reason) => (
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
                              {marketSellPreview.warnings.map((warning) => (
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

          {isTransferHistoryViewActive ? (
          <section className={`panel${getViewClass("history", "historyV2")}`} id="transfer-history">
            <div className="panel-header">
              <TooltipHeading
                as="h2"
                tooltip="Read-only Verlauf aus dem aktiven Save mit Save- und Season-Scope. Filter und Spalten bleiben direkt daneben."
              >
                Transferhistorie
              </TooltipHeading>
              <span className="pill foundation-source-pill">source: active local save</span>
            </div>
            <TransferHistoryV2Client
                sourceBadgeLabel={getViewSourceBadgeLabel("historyV2", activeContextMeta)}
                saveName={historyFeed?.saveContext?.saveName ?? activeSaveName}
                requestedScopeLabel={`${historyFeed?.saveContext?.requestedSaveId ?? activeSaveId} / ${transferHistoryRequestedSeasonLabel}`}
                resolvedScopeLabel={`${historyFeed?.saveContext?.resolvedSaveId ?? historyFeed?.scope?.saveId ?? activeSaveId} / ${transferHistoryResolvedSeasonLabel}`}
                totalLoaded={historyFeed?.items.length ?? 0}
                totalAvailable={historyFeed?.total ?? 0}
                seasonBreakdown={transferHistorySeasonBreakdown}
                summary={transferHistorySummary}
                filteredRows={sortedTransferHistoryRows}
                visibleRows={visibleTransferHistoryRows}
                historyVisibleRangeLabel={historyVisibleRangeLabel}
                isAllSeasons={historyAllSeasonsSelected}
                historyPage={historyPage}
                historyPageCount={historyPageCount}
                onPrevPage={() => setHistoryPage((current) => Math.max(1, current - 1))}
                onNextPage={() => setHistoryPage((current) => Math.min(historyPageCount, current + 1))}
                scopeWarning={historyFeed?.saveContext?.scopeWarning ?? null}
                error={historyFeed?.error ?? null}
                seasonFilter={historySeasonFilter}
                allSeasonsValue={HISTORY_ALL_SEASONS_FILTER}
                seasonOptions={transferSeasonOptions}
                teamFilter={historyTeamFilter}
                teamOptions={gameState.teams.map((team) => ({ teamId: team.teamId, name: team.name, shortCode: team.shortCode }))}
                typeFilter={historyTypeFilter}
                classFilter={historyClassFilter}
                sourceFilter={historySourceFilter}
                classOptions={transferHistoryClassOptions}
                sourceOptions={transferHistorySourceOptions.map((sourceKey) => ({
                  key: sourceKey,
                  label: getTransferSourceLabel(sourceKey === "missing_source" ? null : sourceKey),
                }))}
                search={historySearch}
                onSeasonFilterChange={setHistorySeasonFilter}
                onTeamFilterChange={setHistoryTeamFilter}
                onTypeFilterChange={setHistoryTypeFilter}
                onClassFilterChange={setHistoryClassFilter}
                onSourceFilterChange={setHistorySourceFilter}
                onSearchChange={setHistorySearch}
                onResetFilters={() => {
                  setHistorySeasonFilter(gameState.season.id);
                  setHistoryPage(1);
                  setHistoryTeamFilter("ALL");
                  setHistoryTypeFilter("ALL");
                  setHistoryClassFilter("ALL");
                  setHistorySourceFilter("ALL");
                  setHistorySearch("");
                }}
                onOpenPlayer={(playerId) => openPlayerProfileById(playerId)}
                onOpenTeam={(teamId) => openTeamProfileById(teamId)}
                hasMore={(historyFeed?.total ?? 0) > (historyFeed?.items.length ?? 0)}
                loadingMore={historyLoadingMore}
                onLoadMore={() => void loadMoreHistoryFeed()}
              />
          </section>
          ) : null}

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
              {gameState.mappingReport.warnings.slice(0, 18).map((warning, index) => (
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
  )
  );
}
