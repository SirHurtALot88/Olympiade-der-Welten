"use client";
/* eslint-disable */
// AUTO-GENERATED render body extracted from the Foundation page component.
// Contains the real Foundation shell UI (previously the monolith return block).
import dynamic from "next/dynamic";
import { getSeasonEndPayoutStatus } from "@/lib/season/season-end-sponsor-payout-status";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { FoundationShellRouterCockpit, FoundationShellRouterHistoryV2, FoundationShellRouterMarketSell, FoundationShellRouterMarketV2, FoundationShellRouterMatchdayResult, FoundationShellRouterPrize, FoundationShellRouterSeasonPreview, FoundationShellRouterTeams, FoundationShellRouterTraining } from "@/app/foundation/FoundationShellRouter";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import ContractRenewalNegotiationModal from "@/app/foundation/teams-v2/ContractRenewalNegotiationModal";
import { formatNlMoney } from "@/components/foundation/new-look/nl-format";
import { NlCard, StatChip, NlCountUpValue, nlToneClass, type NlTone } from "@/components/foundation/new-look";
import { VeloPendingRanking } from "@/components/foundation/velo-ui";
import { useEffect, useMemo, type CSSProperties } from "react";
import {
  buildTeamShellThemeVars,
  buildTeamVoidVars,
  TEAM_VOID_VAR_PRIMARY,
  TEAM_VOID_VAR_SECONDARY,
} from "@/lib/foundation/team-shell-theme";
import { getTeamAnnualLoanInstallment, getTeamOutstandingDebt } from "@/lib/finance/loan-service";
import { useViewWidth } from "@/lib/ui/view-width-preference";
import { groupGameEncyclopediaEntriesByCategory } from "@/lib/ui/game-encyclopedia";
import { getFoundationBreadcrumb } from "@/lib/foundation/foundation-breadcrumb";
import { RanksRankCell } from "@/components/foundation/RanksRankCell";
import { RivalTag } from "@/components/foundation/RivalTag";
import { getActiveTeamRivalTeamIds } from "@/lib/rivalries/team-rivalries";
import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";
import { FoundationRoomFlowBar } from "@/components/foundation/FoundationRoomFlowBar";
import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";
import { findOwnRoomParticipant } from "@/lib/room/online-room-model";
import { canFoundationNavigateBack, foundationNavigateBack } from "@/lib/foundation/foundation-navigation-history";
import {
  FACILITY_CATALOG,
  FoundationShell,
  FoundationSubNav,
  GAME_ENCYCLOPEDIA_ENTRIES,
  GameTerm,
  PLAYER_PROFILE_TABS,
  PROGRESSION_CLASS_ORDER,
  SPECIALIST_WING_VARIANTS,
  SortableHeader,
  TooltipHeading,
  buildResolvedTeamIdentities,
  buildScenarioWarning,
  buildTeamControlSettingsMap,
  buildTeamIdentityDraftMap,
  buildTeamStrategyProfileMap,
  clampBiasValue,
  clampIdentityValue,
  deriveChrisFrankyTeamIdsFromSettings,
  formatCockpitReason,
  formatCsvList,
  formatDisciplineCategoryLabel,
  formatFoundationSaveModeLabel,
  formatHomeWarningLabel,
  formatIdentityWeight,
  formatLocalePoints,
  formatMoney,
  formatScenarioTypeLabel,
  formatShortSaveId,
  formatTeamControlModeLabel,
  formatTransfermarktCurrency,
  foundationSecondaryViews,
  getFoundationViewScrollTarget,
  getGameFlowStatusLabel,
  getOwnerTeamHighlightClass,
  getPlayerDisplayMarketValue,
  getPlayerDisplayMarketValueDelta,
  getRankHeatClass,
  getRanksMetricToneClass,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntrySalaryDelta,
  getTeamLogoModel,
  getTransfermarktScoutingDisclosure,
  getViewSourceBadgeLabel,
  HOME_HIDDEN_WARNING_KEYS,
  isTeamSetupDraftWishlistPhase,
  joinClassNames,
  normalizeFoundationSaveMode,
  normalizeTeamStrategyLevel,
  parseCsvList,
  prefetchFoundationPanel,
  resolveFoundationSaveMode,
  resolveScenarioMetaLabel,
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
import type {
  FacilityId,
  FoundationView,
  FoundationViewId,
  GameFlowView,
  PlayerProfileTabId,
  PlayerTableScope,
  SpecialistWingVariant,
} from "@/app/foundation/foundation-page-client-exports";
import type {
  AdminSeasonSimulationRunSummary,
  FoundationCommandItem,
  FoundationFlowCoachAction,
  FoundationFlowLoopStage,
  PreSeasonWorkflowStepSummaryResponse,
} from "@/lib/foundation/tabs/foundation-page-types";
import type { FoundationWarningInboxItem } from "@/lib/foundation/tabs/use-foundation-cross-tab-game-flow";
import type { useFoundationCrossTabSeasonBriefing } from "@/lib/foundation/tabs/use-foundation-cross-tab-season-briefing";
import type {
  FoundationDisciplineLeaderEntry,
  FoundationDisciplineRankRow,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-discipline-ranks";
import type { SeasonOverviewOption } from "@/lib/foundation/tabs/use-season-v2-panel-derivations";
import type { buildContextStatusChips } from "@/lib/foundation/tabs/foundation-format-render-helpers";
import type { FoundationTableColumn } from "@/lib/foundation/foundation-table-ui-types";
import type { Discipline, GameInboxItem, Player, PlayerScoutIntelRecord, Team } from "@/lib/data/olyDataTypes";
import { canAdvanceMatchdayFromStep } from "@/lib/foundation/resolve-game-flow-action-step";
import { resolveLigaWertungKopfzeile } from "@/lib/foundation/liga-wertung-kopfzeile";

// Perf/DX (#57): these view panels used to come in eagerly through the
// `foundation-page-client-exports` barrel (or, for the last five, a direct
// top-level import), which forced Next/webpack to compile every large view's
// full dependency graph just to render the /foundation shell once — this is
// the main cause of the ~15s+ cold compile. Every one of these components is
// only ever mounted behind a single `activeView === "…"` (or equivalent)
// gate below, so lazy-loading them via next/dynamic lets each view's chunk
// compile on demand instead of all up front. ssr:false is used throughout:
// this shell only ever renders client-side (see the "use client" pragma
// above and the `gameState.season.id === "loading"` bootstrap gate), so
// there is no server-rendered markup for these panels to
// match — ssr:false simply skips a wasted server render of code that would
// never produce visible output pre-hydration anyway. `prefetchFoundationPanel`
// (lib/foundation/foundation-panel-prefetch.ts) already calls `import(...)`
// against these same real module paths ahead of navigation, independent of
// this wrapping, so hover/focus prefetch keeps warming these exact chunks.
const FoundationHomeV2Panel = dynamic(() => import("@/app/foundation/home-v2/FoundationHomeV2Panel"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="homeV2" label="Home wird geladen…" />,
});
const PlayerProfileClient = dynamic(() => import("@/app/foundation/player-profile/PlayerProfileClient"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Spielerprofil wird geladen…" />,
});
const TeamProfileClient = dynamic(() => import("@/app/foundation/team-profile/TeamProfileClient"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Teamprofil wird geladen…" />,
});
const FacilitiesV2Client = dynamic(() => import("@/app/foundation/facilities-v2/FacilitiesV2Client"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Gebäude werden geladen…" />,
});
const ScoutingCenterV2Client = dynamic(() => import("@/app/foundation/scouting-center-v2/ScoutingCenterV2Client"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Scouting wird geladen…" />,
});
const InboxV2Client = dynamic(() => import("@/app/foundation/inbox-v2/InboxV2Client"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Inbox wird geladen…" />,
});
const PlayerGeneratorPanel = dynamic(() => import("@/app/foundation/PlayerGeneratorPanelNewLook"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Player Generator wird geladen…" />,
});
const FoundationLineupPanel = dynamic(() => import("@/app/foundation/legacy-lineup-lab/FoundationLineupPanel"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="lineup" label="Einsatzliste wird geladen…" />,
});
const FoundationSeasonFinalePanel = dynamic(
  () => import("@/app/foundation/season-v2/FoundationSeasonFinalePanel"),
  { ssr: false },
);
const FoundationSeasonV2Panel = dynamic(() => import("@/app/foundation/season-v2/FoundationSeasonV2Panel"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="seasonV2" label="Saisonstand wird geladen…" />,
});
const FoundationPlayersTableNewLook = dynamic(
  () => import("@/app/foundation/players-table/FoundationPlayersTableNewLook"),
  {
    ssr: false,
    loading: () => <FoundationPanelSkeleton label="Spielerliste wird geladen…" />,
  },
);
const FoundationTeamSettingsHost = dynamic(() => import("@/app/foundation/team-settings/FoundationTeamSettingsHost"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Team-Einstellungen werden geladen…" />,
});
const FoundationRanksHost = dynamic(() => import("@/app/foundation/ranks-v2/FoundationRanksHost"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Rangliste wird geladen…" />,
});
const FoundationLeagueLeadersHost = dynamic(() => import("@/app/foundation/league-leaders-v2/FoundationLeagueLeadersHost"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Liga-Leader werden geladen…" />,
});
const FoundationAllTimeTableHost = dynamic(() => import("@/app/foundation/all-time-table-v2/FoundationAllTimeTableHost"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Ewige Tabelle wird geladen…" />,
});
const FoundationMerklisteHost = dynamic(() => import("@/app/foundation/merkliste-v2/FoundationMerklisteHost"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Merkliste wird geladen…" />,
});
const FoundationDiszisHost = dynamic(() => import("@/app/foundation/ranks-v2/FoundationDiszisHost"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Diszis werden geladen…" />,
});
const FoundationDisciplineStageHost = dynamic(() => import("@/app/foundation/discipline-stage/FoundationDisciplineStageHost"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Arena wird geladen…" />,
});
const FoundationCreditsHost = dynamic(() => import("@/app/foundation/credits/FoundationCreditsHost"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Kredite werden geladen…" />,
});
const FoundationFinancesHost = dynamic(() => import("@/app/foundation/finances/FoundationFinancesHost"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Finanzen werden geladen…" />,
});
const FoundationChangelogHost = dynamic(() => import("@/app/foundation/changelog/FoundationChangelogHost"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Changelog wird geladen…" />,
});

/**
 * Was gerade laeuft, in Worten — fuer Ablaeufe, die spuerbar Zeit brauchen.
 *
 * Bewusst nur die langen: Ein Hinweis fuer jede Kleinigkeit waere Rauschen. Aufgenommen
 * ist, was den Spieler sonst vor einer stillen Oberflaeche sitzen laesst. Der Saisonende-
 * Schritt rechnet die Entwicklung von rund 3000 Spielern durch — gemessen etwa 13 der
 * insgesamt 17 Sekunden. Das ist echte Arbeit und soll auch so benannt werden, statt
 * wegoptimiert oder verschwiegen zu werden.
 *
 * Schluessel sind die `cockpitBusyKey`-Werte aus `cockpit-handlers.ts`.
 */
const FOUNDATION_BUSY_NOTICES: Record<string, { title: string; detail: string } | undefined> = {
  "season-transition-open-transfer-window": {
    title: "Saisonende wird gerechnet",
    detail: "Spielerentwicklung für alle Teams, danach öffnet das Transferfenster. Das dauert einen Moment.",
  },
  "season-transition-advance": {
    title: "Nächster Saisonende-Schritt",
    detail: "Der Assistent rechnet den Schritt durch.",
  },
  "season-transition-start": {
    title: "Season-Wechsel wird gestartet",
    detail: "Saisonabschluss wird vorbereitet.",
  },
  "preseason-next-season-setup": {
    title: "Neue Saison wird aufgesetzt",
    detail: "Spielplan, Kader und Ausgangslage werden erzeugt.",
  },
  "whole-season-dryrun": {
    title: "Saison wird durchsimuliert",
    detail: "Alle Spieltage werden probeweise gerechnet.",
  },
  "matchday-auto-run-execute": {
    title: "Spieltag wird gewertet",
    detail: "Ergebnisse werden geschrieben und der Saisonstand aktualisiert.",
  },
};

const FoundationDebugGameStatePanel = dynamic(
  () => import("@/app/foundation/debug/FoundationDebugGameStatePanel"),
  {
    ssr: false,
    loading: () => <FoundationPanelSkeleton label="Debug-Ansicht wird geladen…" />,
  },
);

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

// W1 · Ranks-Matrix: Tooltips der Aggregat-Spalten. Die Disziplin-Spalten
// bekommen ihren vollen Namen direkt aus `discipline.name`; nur die fünf
// Aggregat-Kürzel brauchen eine feste Erklärung (vorher sagte der Hover nur
// "Nach GEW sortieren", SCH bekam sogar den falschen Achsen-Tooltip).
const RANKS_AGGREGATE_COLUMN_TOOLTIPS: Record<string, string> = {
  rosterSize: "# — Spieler im Kader dieses Teams. Kein Rang, sondern die Kadergröße: ein guter Rang bei kleinem Kader heißt etwas anderes als bei vollem.",
  totalRank: "TOT — Gesamtrang: Teamstärke über alle Disziplinen summiert und ligaweit gerankt. Rang 1 = stärkstes Team.",
  powRank: "POW — Teamrank der Power-Achse (Summe der Power-Disziplinen).",
  speRank: "SPE — Teamrank der Speed-Achse (Summe der Speed-Disziplinen).",
  menRank: "MEN — Teamrank der Mental-Achse (Summe der Mental-Disziplinen).",
  socRank: "SOC — Teamrank der Social-Achse (Summe der Social-Disziplinen).",
};

export function FoundationShellRouterBody(props: FoundationShellRouterBodyProps) {
  const [viewWidthMode] = useViewWidth();
  const {
  activeContextMeta,
  activeContextStatusChips,
  activeFlowCoach,
  activeFlowLoopIndex,
  activeManagerTeamId,
  activeOwner,
  activeSaveId,
  activeSaveName,
  activeTeamCriticalInboxItems,
  activeTeamDecisionInboxItems,
  activeTeamOpenInboxItems,
  activeView,
  activeViewSourceBadge,
  adminSimulationBusy,
  adminSimulationError,
  adminSimulationFullChurn,
  adminSimulationInjuries,
  adminSimulationMode,
  adminSimulationRun,
  adminSimulationSeasonCount,
  bootstrapError,
  bulkAiPicksRefillBusy,
  bulkAiPicksRefillMessage,
  bulkAiPicksProgress,
  runBulkAiTeamsRefill,
  underFilledAiTeamIds,
  canonicalSeasonLabel,
  closeCommandPalette,
  closeFacilityPanel,
  closeFoundationDrilldownPanel,
  closeMarketSellModal,
  closeSeasonBriefing,
  closeTeamProfile,
  cockpitBusyKey,
  commandSearch,
  commandSearchInputRef,
  commitPlayerGeneratorDraft,
  completeSeasonBriefingAndContinue,
  confirmContractRenewalNegotiation,
  confirmFacilityMaintenance,
  confirmFacilityUpgrade,
  confirmTransfermarktSell,
  contractRenewalBusy,
  contractRenewalError,
  contractRenewalNegotiation,
  currentMatchdayDisplayLabel,
  disciplineRanksColumns,
  effectiveActiveOwnerId,
  facilityMaintenanceBusy,
  facilityMaintenanceError,
  facilityMaintenancePreview,
  facilityMaintenanceSuccess,
  facilityUpgradeBusy,
  facilityUpgradeError,
  facilityUpgradePreview,
  facilityUpgradeSuccess,
  foundationActionFeedback,
  foundationActivities,
  foundationFacilityTarget,
  foundationFlowLoopStages,
  foundationManageableTeamIds,
  foundationNavAttention,
  foundationPanel,
  foundationCockpitHostProps,
  foundationPrizeFinanceShellHostProps,
  foundationRanksHostProps,
  foundationLeagueLeadersHostProps,
  foundationAllTimeTableHostProps,
  foundationMerklisteHostProps,
  foundationDiszisHostProps,
  foundationMarketV2ShellHostProps,
  foundationMatchdayResultHostProps,
  foundationHistoryV2HostProps,
  foundationSeasonPreviewHostProps,
  foundationTeamsViewHostProps,
  foundationTrainingCompactHostProps,
  foundationWarningInboxItems,
  gameFlowActionStep,
  matchdayAdvanceStep,
  gameState,
  getTableColumnWidth,
  getTableHeaderDragProps,
  getViewClass,
  globalNextLabel,
  globalNextStatusClass,
  globalNextTitle,
  handleFormCardPlanSaved,
  handleHumanLineupSaved,
  handleManagerTeamSelect,
  homeActiveTeamLogo,
  homeNextMatchdayStatus,
  homeOpenTaskCount,
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
  isMarketSellPanelOpen,
  isPending,
  isSaveBusy,
  isSelectedTeamManagementLocked,
  isTableColumnVisible,
  isTeamSwitchPending,
  isTransferMarketViewActive,
  isViewingArchivedSeason,
  leaguePlayerHeatPools,
  leagueSetupStatus,
  leagueSetupRetryBusy,
  leagueSetupRetryError,
  retryLeagueSetup,
  retryMarketSellPreview,
  lineupDraftBoardView,
  lineupDraftBoardViewRequest,
  lineupFocusRequestKey,
  managerTeamOptions,
  manualTeams,
  marketSellBusy,
  marketSellError,
  marketSellPreview,
  marketSellRiskAcknowledged,
  marketSellSubject,
  marketSellSuccess,
  navigateHomeTab,
  navigateToGameFlowStep,
  navigateToInboxItem,
  navigateToPrizeFinanceViewFromRouting,
  navigateToTeamPicker,
  openFacilityPanel,
  openFoundationViewCommand,
  openPlayerDrawerById,
  openPrizeFinanceView,
  openTeamDrawerById,
  openTeamProfileById,
  openTrainingPlayerTarget,
  onOpenLeagueLeaders,
  orderedDisciplines,
  originateLoanForActiveTeam,
  repayLoanEarlyForActiveTeam,
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
  postAdminSeasonSimulation,
  preSeasonWorkflowBusy,
  preSeasonWorkflowError,
  preSeasonWorkflowFeed,
  rankLeaderCards,
  ranksArchiveMissing,
  isViewingArchivedRanksSeason,
  readMeta,
  readOnlyBannerMessage,
  readSourceLabel,
  reloadSeasonStandingsOverview,
  removeTransferWishlistEntry,
  requestContractRenewalPreview,
  resetTableColumnWidth,
  resetTableLayout,
  resolvedTeamControlSettings,
  roomActivityNotice,
  setRoomActivityNotice,
  roomContext,
  roomLiveState,
  rosterPlayers,
  runFacilityMaintenancePreview,
  runFacilityUpgradePreview,
  commitArenaDiscipline,
  finishMatchdayAndAdvance,
  runCockpitCashApply,
  runPreSeasonWorkflowPreview,
  runPreSeasonNextSeasonSetup,
  runSeasonTransition,
  runFoundationCommand,
  savePlayerGeneratorDrafts,
  saveSyncError,
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
  seasonOverviewOptions,
  seasonOverviewSeasonId,
  seasonOverviewSourceLabel,
  seasonStandingsLoading,
  seasonV2ArchiveRows,
  seasonV2DisciplineLeaders,
  seasonV2GmRows,
  seasonV2LeaderTeam,
  seasonV2MomentumTeam,
  seasonV2PlayerRows,
  seasonV2PressureTeam,
  seasonV2SelectedTeamSummary,
  seasonV2StandingsRows,
  seasonV2TeamTopPlayersByColumn,
  seasonV2FormCardBonusByTeamId,
  seasonV2TopPlayers,
  selectedBoardConfidence,
  selectedEncyclopediaEntry,
  selectedHqAxisSummary,
  selectedHqFinanceWarnings,
  selectedHqGmStory,
  selectedHqInboxItems,
  selectedHqMoraleSummary,
  selectedOpenObjectives,
  selectedRoster,
  selectedRosterTableRows,
  selectedSeasonOverviewLabel,
  selectedStandingRow,
  selectedTeamFieldRaceForm,
  fieldRacePlayedMatchdayCount,
  fieldRaceTotalTeams,
  homeFieldRaceRankMovement,
  selectedTeam,
  selectedTeamTopSixAxisStats,
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
  selectedTeamId,
  selectedTeamPlayerDemands,
  selectedTeamPowers,
  selectedTeamScoutPipeline,
  setActiveManagerTeam,
  setActiveView,
  setAdminSimulationFullChurn,
  setAdminSimulationInjuries,
  setAdminSimulationMode,
  setAdminSimulationSeasonCount,
  setCommandSearch,
  setContractRenewalNegotiation,
  setFoundationActionFeedback,
  setInboxCategoryFilter,
  setInboxIncludeDismissed,
  setInboxIncludeDone,
  setInboxV2SelectedItemId,
  setLineupDraftBoardView,
  setLineupDraftBoardViewRequest,
  setMarketSellRiskAcknowledged,
  setPlayerClassFilter,
  setPlayerProfileData,
  setPlayerProfileTab,
  setPlayerScope,
  setPlayerTeamFilter,
  setPlayerTrainingClass,
  setPlayerTrainingMode,
  setScoutingCenterTab,
  setSeasonOverviewSeasonId,
  setSelectedEncyclopediaEntryId,
  setSelectedTeamDetailTab,
  setShowCommandPalette,
  setSpecialistWingVariantDraft,
  setTableColumnVisible,
  showCommandPalette,
  showCompactFlowCoach,
  showCompactHeader,
  showFlowCoach,
  sortedDisciplineRankRows,
  sortedPlayersTableRows,
  specialistWingVariantDraft,
  startAdminSeasonSimulationRun,
  startTableColumnResize,
  tableSorts,
  teamProfileData,
  teamBeliebtheit,
  toggleTableSort,
  trainingFacilityEffectPreview,
  trainingFacilityRows,
  trainingFacilitySeasonEndFinance,
  trainingForecastSummary,
  trainingV2ModeOptions,
  triggerGlobalNext,
  updateInboxItemStatus,
  visibleDisciplineRanksColumns,
  visibleFoundationCommandItems,
  visibleInboxItems,
  } = props;

  // Rivalen-Hervorhebung (additiv): Team-IDs aller Rivalen des aktiven Teams.
  // Leeres Set, wenn kein aktives Team oder keine Rivalität existiert (graceful).
  const activeTeamRivalIds = getActiveTeamRivalTeamIds(gameState, activeManagerTeamId);

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


  // #81 — Ansichts-Titel + Breadcrumb (nur Neuer Look). Labels stammen aus der
  // bestehenden Nav-Konfiguration; Team-Kontext nur wenn wirklich vorhanden.
  const newLookBreadcrumbData = getFoundationBreadcrumb(activeView as FoundationViewId);
  const newLookBreadcrumb = newLookBreadcrumbData ? (
    <nav className="foundation-shell-breadcrumb nl-breadcrumb" aria-label="Brotkrumen-Navigation" data-testid="foundation-breadcrumb">
      <span className="foundation-shell-breadcrumb-crumb is-root">{newLookBreadcrumbData.group}</span>
      <span className="foundation-shell-breadcrumb-sep" aria-hidden="true">›</span>
      <strong className="foundation-shell-breadcrumb-crumb is-view">{newLookBreadcrumbData.view}</strong>
      {activeView === "teams" && selectedTeam ? (
        <>
          <span className="foundation-shell-breadcrumb-sep" aria-hidden="true">›</span>
          <span className="foundation-shell-breadcrumb-crumb is-context">{selectedTeam.name}</span>
        </>
      ) : null}
    </nav>
  ) : undefined;

  // Cleanup: "AKTIVES TEAM"-Picker lebt jetzt kompakt in der Sidebar (neben dem
  // Neuer-Look-Toggle) statt im großen Context-Banner auf jeder Ansicht.
  // Value/onChange/Optionsliste bleiben unverändert aus dem Router-Body-Scope —
  // hier wird die Kontrolle nur einmal gebaut und an FoundationShell durchgereicht.
  const activeTeamPickerNode = selectedTeam ? (
    <div className="foundation-manager-team" data-testid="active-manager-team">
      {(() => {
        const logo = getTeamLogoModel(selectedTeam);
        return (
          <OptimizedMediaImage
            className="foundation-manager-team-logo"
            src={logo.src}
            alt={`${selectedTeam.name} Logo`}
            loading="eager"
            fetchPriority="high"
            fallbackLabel={selectedTeam.shortCode}
            fallback={
              <span className="foundation-manager-team-logo team-logo-placeholder">{selectedTeam.shortCode}</span>
            }
          />
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
      {isTeamSwitchPending ? <span className="pill foundation-context-tag">Teamwechsel...</span> : null}
    </div>
  ) : null;

  // Team-Shell-Theme: die Akzent-Tokens der ganzen Shell folgen dem aktiven
  // Manager-Team (Primär-/Sekundärfarbe aus team-colors.ts). Ohne gewähltes
  // Team ("Alle 32 Teams anzeigen") bleibt der Standard-Look — vars ist dann
  // null und <main> bekommt weder style noch data-team-theme.
  const teamThemeCode = selectedTeam?.shortCode ?? null;
  const teamShellThemeVars = useMemo(() => buildTeamShellThemeVars(teamThemeCode), [teamThemeCode]);
  useEffect(() => {
    // Der Body-Void (Fläche neben dem Shell auf breiten Monitoren) liegt
    // außerhalb von <main> — die body:has()-Regel in globals.css liest diese
    // beiden Variablen mit neutralem Rückfall.
    const voidVars = buildTeamVoidVars(teamThemeCode);
    const body = document.body;
    if (voidVars) {
      body.style.setProperty(TEAM_VOID_VAR_PRIMARY, voidVars.primary);
      body.style.setProperty(TEAM_VOID_VAR_SECONDARY, voidVars.secondary);
    } else {
      body.style.removeProperty(TEAM_VOID_VAR_PRIMARY);
      body.style.removeProperty(TEAM_VOID_VAR_SECONDARY);
    }
    return () => {
      body.style.removeProperty(TEAM_VOID_VAR_PRIMARY);
      body.style.removeProperty(TEAM_VOID_VAR_SECONDARY);
    };
  }, [teamThemeCode]);

  // #82 — echte Zähler-Badges (nur Neuer Look, nur reale Zahlen).
  const teamsRosterBadgeCount =
    Array.isArray(selectedRoster) && selectedRoster.length > 0 ? selectedRoster.length : null;

  // ===== W1 · Ranks-Matrix: Achsen-Gruppen, Gruppenband, gepinnte eigene Zeile =====
  // Chris' Entscheidung: Spalten werden nach POW/SPE/MEN/SOC gruppiert und je
  // Gruppe ein-/ausgeblendet — der px-Spalten-Manager entfällt (bewusster Tausch
  // Feinsteuerung gegen Klarheit). Sichtbarkeit läuft weiter über den
  // bestehenden Tabellen-Store (isTableColumnVisible/setTableColumnVisible),
  // damit die Wahl wie bisher pro Save erhalten bleibt.
  const ranksCategoryLabels: Record<string, string> = {
    power: "Power",
    speed: "Speed",
    mental: "Mental",
    social: "Social",
  };
  const ranksAxisGroups = (() => {
    const groups: Array<{
      category: string;
      label: string;
      columns: FoundationTableColumn[];
      anyVisible: boolean;
    }> = [];
    for (const column of disciplineRanksColumns as FoundationTableColumn[]) {
      const discipline = orderedDisciplines.find((entry: Discipline) => entry.id === column.id);
      if (!discipline) {
        continue;
      }
      let group = groups.find((candidate) => candidate.category === discipline.category);
      if (!group) {
        group = {
          category: discipline.category,
          label: ranksCategoryLabels[discipline.category] ?? discipline.category,
          columns: [],
          anyVisible: false,
        };
        groups.push(group);
      }
      group.columns.push(column);
      if (isTableColumnVisible("disciplineRanksTable", column.id, column.visibleByDefault)) {
        group.anyVisible = true;
      }
    }
    return groups;
  })();
  // Gruppenband über den sichtbaren Spalten: Achsenfarbe lebt NUR noch hier —
  // die Zellen darunter färben ausschließlich nach Rang (Legende darüber).
  const ranksHeaderGroups = (() => {
    const cells: Array<{ key: string; category: string; label: string; span: number }> = [];
    for (const column of visibleDisciplineRanksColumns as FoundationTableColumn[]) {
      const discipline = orderedDisciplines.find((entry: Discipline) => entry.id === column.id);
      const category = column.id === "team" ? "team" : (discipline?.category ?? "base");
      const last = cells[cells.length - 1];
      if (last && last.category === category) {
        last.span += 1;
      } else {
        cells.push({
          key: `ranks-group-${category}-${column.id}`,
          category,
          label:
            category === "team"
              ? ""
              : category === "base"
                ? "Teamranks"
                : (ranksCategoryLabels[category] ?? category),
          span: 1,
        });
      }
    }
    return cells;
  })();
  // GEMELDET VON CHRIS: „kannst du oben das eigene team entfernen? das irritiert auf jeden fall
  // wenn man mal 4 teams zb steuern würde."
  //
  // Hier stand eine Kopie der eigenen Zeile, oben an die Tabelle gepinnt. Sie setzte GENAU EIN
  // eigenes Team voraus: gepinnt wurde `activeManagerTeamId`, also das gerade ausgewählte. Wer
  // mehrere Teams steuert, sieht dann eins davon doppelt und die anderen nicht — eine Auszeichnung,
  // die je nach Auswahl auf ein anderes Team springt und über die Ligatabelle nichts aussagt.
  //
  // Die eigenen Teams bleiben trotzdem auffindbar, und zwar auf einem Weg, der mit jeder Anzahl
  // funktioniert: jede gesteuerte Zeile trägt weiter den „Dein Team"-Chip, die Akzentlinie über
  // `is-active-team-row` und die Besitzer-Tönung aus `getOwnerTeamHighlightClass`.

  return (
    (
    <main
      className="app-shell foundation-shell foundation-app is-new-look"
      data-view-width={viewWidthMode}
      data-team-theme={teamShellThemeVars ? teamThemeCode ?? undefined : undefined}
      style={teamShellThemeVars ? (teamShellThemeVars as CSSProperties) : undefined}
    >
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
            <strong>Foundation lädt</strong>
            <span>Spielstand wird vorbereitet …</span>
          </div>
        </div>
      ) : null}
      {persistenceError || saveSyncError ? (
        <div className="foundation-persistence-banner transfer-callout is-warning" role="status">
          <strong>{persistenceError ?? saveSyncError}</strong>
        </div>
      ) : null}
      {leagueSetupStatus === "in_progress" ? (
        <div
          className="foundation-persistence-banner transfer-callout is-info"
          role="status"
          aria-live="polite"
          data-testid="foundation-league-setup-banner"
          data-league-setup-status="in_progress"
        >
          <strong>Liga wird erstellt … (KI-Teams werden befüllt)</strong>
          {/* GEMESSEN, nicht geschaetzt: „rund eine Minute" stand hier seit der ersten Fassung. Vier
              Raumstarts am 18.08. brauchten 126 s, 172 s und (mit dauernden Schreibvorgaengen
              nebenher) 317 s. Wer nach 60 Sekunden auf ein fertiges Feld schaut, haelt eine
              richtige Anzeige fuer einen Fehler. */}
          <span>Das dauert ein bis zwei Minuten. Du kannst schon andere Ansichten öffnen — wir aktualisieren automatisch.</span>
          {/* CHRIS: „wobei seinen sponsor picken und einkaufen könnte man eigentlich ja schon".
              Stimmt — im Raum nachgemessen: `/api/sponsor/choose` und `/api/transfermarkt/buy`
              antworten waehrend des Drafts mit 200/success. Der Satz steht nur im Raum, weil nur
              dort gemessen wurde; im Solo-Fall behaupten wir es deshalb nicht. */}
          {roomContext ? (
            <span data-testid="foundation-league-setup-banner-schon-moeglich">
              Sponsor wählen und einkaufen geht bereits — beides wartet nicht auf die KI-Kader. Erst
              der Spieltag braucht sie.
            </span>
          ) : null}
        </div>
      ) : leagueSetupStatus === "failed" ? (
        <div
          className="foundation-persistence-banner transfer-callout is-warning"
          role="alert"
          data-testid="foundation-league-setup-banner"
          data-league-setup-status="failed"
        >
          <strong>Liga-Setup fehlgeschlagen</strong>
          <span>
            {leagueSetupRetryError ?? "Die KI-Team-Kader konnten nicht automatisch befüllt werden."} Ohne KI-Kader kann Matchday 1 nicht gespielt werden.
          </span>
          <button
            className="secondary-button inline-button"
            type="button"
            data-testid="foundation-league-setup-retry-button"
            onClick={() => void retryLeagueSetup()}
            disabled={leagueSetupRetryBusy}
          >
            {leagueSetupRetryBusy ? "Wird erneut versucht …" : "Erneut versuchen"}
          </button>
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
        breadcrumb={newLookBreadcrumb}
        /* D1: dieselbe Quelle wie der Breadcrumb — der Ansichtsname wird nicht zweimal
           bestimmt, nur zweimal verwendet (sichtbar als Krume, semantisch als h1). */
        viewTitle={newLookBreadcrumbData?.view ?? null}
        teamPicker={activeTeamPickerNode}
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
          ) : /* S5/S5 (Audit Spieltag): die Sidebar-Kopie "Datenansicht"/"Manager"
                 kontrollierte hier nichts — `viewMode`/`onViewModeChange` wurden
                 zwar bis in SeasonStandingsV2Client.tsx durchgereicht, aber nie
                 gelesen. Der SICHTBARE Umschalter war "Daten"/"Board"/"Vereine"
                 IM Panel (SeasonStandingsNewLook.tsx, eigener localStorage-
                 Zustand) — zwei Tab-Ebenen, von denen nur eine echt etwas tat.
                 Klick auf "Manager" hier änderte sichtbar gar nichts (Befund).
                 Statt beide Ebenen zu synchronisieren (Race-Risiko zwischen zwei
                 Zustandsquellen für dieselbe Frage), fällt die tote Ebene weg —
                 "Vereine" im Panel selbst zeigt exakt denselben Manager-Inhalt. */
          activeView === "playerProfile" ? (
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
            // EIN Filtersystem (Audit I1): Die äußeren Kategorie-Reiter sind weg — sie
            // konkurrierten mit den Pills in der Inbox selbst und boten Kategorien an
            // („Warnungen", „Finanzen"), die als leere „Alles erledigt"-Seiten neben
            // „11 offen" endeten (Audit I2). Gefiltert wird nur noch in der Inbox.
            null
          ) : activeView === "scoutingCenterV2" ? (
            // S3 (Audit „markt"): der separate "Empfehlungen"-Reiter bestand am Saisonstart aus
            // einer einzigen Karte plus Erklärtext — in die Übersicht gefaltet
            // (ScoutingCenterV2NewLook rendert den Inhalt jetzt unter "overview"; ein alter
            // `?tab=recommended`-Deep-Link fällt dort weiterhin auf denselben Inhalt zurück).
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                { id: "overview", label: "Übersicht" },
                { id: "reports", label: "Scouting Report" },
              ]}
              activeId={scoutingCenterTab}
              onSelect={(id) => {
                setScoutingCenterTab(id as typeof scoutingCenterTab);
                syncFoundationViewInUrl("scoutingCenterV2", id, null, { push: true });
              }}
            />
          ) : activeView === "trainingCompact" ? (
            // Steuerung/Forecast-Subnav entfernt (Audit TR4): „Forecast" war kein eigener
            // Inhalt, sondern nur ein Scroll-Anker auf die Entwicklungsfilter derselben
            // Seite — zwei Reiter, die dieselbe Kartenwand zeigten. Seit der Steuer-Tabelle
            // (Paket T5) stehen Steuerung UND Forecast in einer Tabelle; ein Umschalter,
            // der nichts umschaltet, verspricht nur einen Unterschied, den es nicht gibt.
            null
          ) : activeView === "prize" ? (
            // LEGACY: Der "Preisgeld"-Untertab ist entfernt — Preisgeld wird nicht
            // mehr ausgezahlt/genutzt. Es gibt nur noch Sponsoren, daher kein
            // Sponsoren/Preisgeld-Umschalter mehr (die View rendert direkt die
            // Sponsoren-Seite über den Default `prizeFinanceTab === "sponsors"`).
            null
          ) : activeView === "teams" && selectedTeam ? (
            <FoundationSubNav
              className="foundation-shell-subnav"
              items={[
                { id: "roster", label: "Kader", count: teamsRosterBadgeCount },
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
          {/* Der "Weiter"-Header-Button ist die einzige kanonische Next-Action
              (Leertaste). Das Label hier wäre reine Dopplung — nur der
              Loop-Stepper darunter bleibt zur Orientierung. */}
          <span className="foundation-flow-coach-shortcut">{activeFlowCoach.shortcut}</span>
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
              Nächster Schritt: {globalNextLabel}
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
            <header className="season-briefing-header nl-reveal" style={{ "--nl-reveal-i": 0 } as CSSProperties}>
              <div className="season-briefing-hero">
                <span className="season-briefing-eyebrow">Season-Einstieg</span>
                <h1 id="season-briefing-title" className="season-briefing-title">{gameState.season.name}</h1>
                <p className="season-briefing-lead">Lies die Saison-Vorschau durch und markiere sie danach als erledigt.</p>
              </div>
              <button className="nl-sb-btn is-ghost" type="button" onClick={() => closeSeasonBriefing(false)}>
                Später
              </button>
            </header>
            <div className="season-briefing-body">
              {!seasonBriefingScheduleReady ? (
                <p className="season-briefing-loading" data-testid="season-briefing-loading">
                  Diszi-Plan und Saison-Faktoren werden geladen …
                </p>
              ) : null}
              <div
                className="season-briefing-kpis nl-reveal"
                role="group"
                aria-label="Season-Faktoren"
                style={{ "--nl-reveal-i": 1 } as CSSProperties}
              >
                <article className={joinClassNames("season-briefing-kpi", nlToneClass("accent"))}>
                  <span className="season-briefing-kpi-label">Salary Factor</span>
                  <NlCountUpValue
                    className="season-briefing-kpi-value nl-tnum"
                    value={seasonBriefingData.currentFactor}
                    format={(v) => `${formatLocalePoints(v, 2)}x`}
                  />
                  <span className="season-briefing-kpi-sub">Basis für Gehälter, Sponsoren und Forecast</span>
                </article>
                <article className={joinClassNames("season-briefing-kpi", nlToneClass("neutral"))}>
                  <span className="season-briefing-kpi-label">Matchdays</span>
                  <NlCountUpValue
                    className="season-briefing-kpi-value nl-tnum"
                    value={seasonBriefingData.scheduleCount}
                    format={(v) => formatLocalePoints(v, 0)}
                  />
                  <span className="season-briefing-kpi-sub">Diszi-Paare in dieser Season</span>
                </article>
                <article className={joinClassNames("season-briefing-kpi", nlToneClass("men"))}>
                  <span className="season-briefing-kpi-label">POW / SPE / MEN / SOC</span>
                  <span className="season-briefing-kpi-value nl-tnum">{seasonBriefingTeamAxes}</span>
                  <span className="season-briefing-kpi-sub">{selectedTeam ? `${selectedTeam.shortCode} Team-Identity` : "Team wählen"}</span>
                </article>
                <article className={joinClassNames("season-briefing-kpi", nlToneClass("good"))}>
                  <span className="season-briefing-kpi-label">Cash</span>
                  <NlCountUpValue
                    className="season-briefing-kpi-value nl-tnum"
                    value={seasonBriefingTeamCash}
                    format={(v) => formatTransfermarktCurrency(v)}
                  />
                  <span className="season-briefing-kpi-sub">Startbudget für Transfers</span>
                </article>
              </div>

              <section className="season-briefing-section nl-reveal" style={{ "--nl-reveal-i": 2 } as CSSProperties}>
                <div className="season-briefing-section-head">
                  <h3 className="season-briefing-section-title">Spieltags-Reihenfolge</h3>
                  <p className="season-briefing-section-lead">
                    Alle Diszi-Paare der Season — Farb-Dopplungen und Spieltage mit 11–12 Slots sind markiert.
                  </p>
                </div>
                <div className="season-briefing-matchday-grid">
                  {seasonBriefingScheduleReady ? (
                    seasonBriefingData.firstMatchdays.map((entry: SeasonBriefingMatchdayEntry, index: number) => (
                      <article
                        key={`season-briefing-md-${entry.matchdayId}`}
                        className={joinClassNames(
                          "season-briefing-matchday nl-reveal",
                          entry.sameColor && "has-same-color",
                          entry.isHeavyRoster && "has-heavy-roster",
                        )}
                        style={{ "--nl-reveal-i": Math.min(index + 2, 12) } as CSSProperties}
                      >
                        <span className="season-briefing-md-label">{entry.label}</span>
                        <div className="season-briefing-discipline-row">
                          {entry.disciplines.map((discipline: SeasonBriefingDisciplineEntry) => {
                            const tone: NlTone =
                              discipline.color === "red"
                                ? "pow"
                                : discipline.color === "green"
                                  ? "spe"
                                  : discipline.color === "blue"
                                    ? "men"
                                    : discipline.color === "yellow"
                                      ? "soc"
                                      : "neutral";
                            return (
                              <span
                                key={`season-briefing-md-${entry.matchdayId}-${discipline.name}`}
                                className={joinClassNames("season-briefing-diszi-chip", nlToneClass(tone))}
                              >
                                <b className="season-briefing-diszi-name">{discipline.name}</b>
                                <small className="season-briefing-diszi-meta">
                                  {discipline.playerCount ?? "—"} Slots · {formatDisciplineCategoryLabel(discipline.category)}
                                </small>
                              </span>
                            );
                          })}
                        </div>
                        {entry.isHeavySameColor ? (
                          <span className={joinClassNames("season-briefing-badge is-combo", nlToneClass("risk"))}>
                            Farb-Dopplung + Kaderdruck · {entry.totalSlots} Slots
                          </span>
                        ) : entry.sameColor ? (
                          <span className={joinClassNames("season-briefing-badge", nlToneClass("warn"))}>
                            Farb-Dopplung · gleiche Kategorie am selben Spieltag
                          </span>
                        ) : entry.isHeavyRoster ? (
                          <span className={joinClassNames("season-briefing-badge", nlToneClass("risk"))}>
                            Kaderdruck · {entry.totalSlots} Slots
                          </span>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <p className="season-briefing-empty">Spieltags-Paare erscheinen, sobald der Diszi-Plan geladen ist.</p>
                  )}
                </div>
              </section>

              <div className="season-briefing-two-col nl-reveal" style={{ "--nl-reveal-i": 3 } as CSSProperties}>
                <NlCard eyebrow="Slots" title="Große Diszis">
                  <p className="season-briefing-card-lead">Nach Slotgröße sortiert; die Spieltags-Reihenfolge steht oben.</p>
                  <div className="season-briefing-chip-list">
                    {seasonBriefingScheduleReady ? (
                      seasonBriefingData.bigDisciplines.map((slot: SeasonBriefingBigDisciplineSlot) => {
                        const tone: NlTone =
                          slot.color === "red"
                            ? "pow"
                            : slot.color === "green"
                              ? "spe"
                              : slot.color === "blue"
                                ? "men"
                                : slot.color === "yellow"
                                  ? "soc"
                                  : "neutral";
                        return (
                          <span
                            key={`season-briefing-big-${slot.matchdayId}-${slot.disciplineId}`}
                            className={joinClassNames("season-briefing-diszi-chip is-big", nlToneClass(tone))}
                          >
                            <b className="season-briefing-diszi-name">{slot.displayName}</b>
                            <small className="season-briefing-diszi-meta">{slot.matchdayLabel} · {slot.playerCount ?? "—"} Slots</small>
                          </span>
                        );
                      })
                    ) : (
                      <p className="season-briefing-empty">Slot-Größen folgen mit dem Diszi-Plan.</p>
                    )}
                  </div>
                </NlCard>
                <NlCard eyebrow="Kollisionen" title="Farb-Dopplungen">
                  {!seasonBriefingScheduleReady ? (
                    <p className="season-briefing-empty">Farb-Kollisionen werden nach dem Laden des Diszi-Plans angezeigt.</p>
                  ) : seasonBriefingData.sameColorMatchdays.length > 0 ? (
                    <div className="season-briefing-chip-list">
                      {seasonBriefingData.sameColorMatchdays.map((entry: SeasonBriefingMatchdayEntry) => (
                        <span
                          key={`season-briefing-double-${entry.matchdayId}`}
                          className={joinClassNames("season-briefing-diszi-chip", nlToneClass("warn"))}
                        >
                          <b className="season-briefing-diszi-name">{entry.label}</b>
                          <small className="season-briefing-diszi-meta">
                            {entry.disciplines.map((discipline: SeasonBriefingDisciplineEntry) => discipline.name).join(" / ")}
                          </small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="season-briefing-empty">
                      In dieser Season keine gleiche Farbe doppelt am selben Spieltag. Breiter Kader wird etwas entspannter.
                    </p>
                  )}
                  {seasonBriefingData.futureFactors.length > 0 ? (
                    <div className="season-briefing-factor-row">
                      {seasonBriefingData.futureFactors.map((entry: SeasonBriefingFactorEntry) => (
                        <StatChip
                          key={`season-briefing-factor-${entry.label}`}
                          label={entry.label}
                          value={`${formatLocalePoints(entry.factor, 2)}x`}
                          tone="accent"
                        />
                      ))}
                    </div>
                  ) : null}
                </NlCard>
              </div>
            </div>
            <div className="foundation-modal-actions">
              <button
                className="nl-sb-btn is-ghost"
                type="button"
                onClick={() => {
                  closeSeasonBriefing(false);
                  setFoundationView("diszis", setActiveView);
                }}
              >
                Diszis ansehen
              </button>
              <button
                className="nl-sb-btn is-primary"
                type="button"
                onClick={completeSeasonBriefingAndContinue}
              >
                Erledigt
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {/* Slim status line only — Save-Name + "AKTIVES TEAM" leben jetzt kompakt
          in der Sidebar (siehe activeTeamPickerNode oben). data-testid bleibt
          erhalten, weil Screenshots/Smoke-Skripte darauf warten. */}
      <section className={`foundation-context-banner${isSaveBusy ? " is-loading" : ""}${showCompactHeader ? " is-compact" : ""}`} data-testid="foundation-context-banner">
        {/* Save-Chip (roher Save-ID-Aufklappmenü) entfernt — Save-Name, Season
            und Spieltag leben bereits kompakt in der Sidebar; der abgeschnittene
            "new-game…"-String oben stiftete nur Verwirrung. */}
        <div className="foundation-context-main" data-testid="foundation-save-compact-menu" />
        {roomContext ? (
          (() => {
            // Kompakter Room-Chip statt großem zentralem Banner: die schlanke
            // Pill-Zeile lebt am rechten Rand des Kontext-Banners. Room-Code +
            // "Zur Room-Ansicht" bleiben sichtbar, die Save-ID bleibt im
            // title-Tooltip (Hover), damit sie keine Höhe frisst. Der
            // Flow-Schritt/Weiter-Knopf steht NICHT mehr im Tooltip — die
            // `FoundationRoomFlowBar` unten zeigt ihn sichtbar und bedienbar an;
            // zwei Stellen mit derselben Wahrheit (eine davon nur im
            // Hover-Text) wären nur eine Quelle für Drift gewesen.
            //
            // BEFUND (Auftrag): `roomActivityNotice` stand hier bis eben NUR im title-Attribut,
            // also unsichtbar ohne Hover — eine Aktion des Mitspielers (Transfer, Lineup, Spieltag)
            // ging damit praktisch spurlos an einem vorbei. Die Notiz steht jetzt zusaetzlich als
            // eigene sichtbare Zeile.
            // Entdoppelt (Paket B): dieselbe Suche stand hier vorher direkt inline und ein zweites
            // Mal am Host-Vorbehalt des Saisonwechsel-Gates — siehe Kommentar an
            // `findOwnRoomParticipant` (lib/room/online-room-model.ts).
            const roomIdentity = findOwnRoomParticipant(roomLiveState, roomContext.participantId);
            return (
              <>
                <div
                  className="foundation-room-chip"
                  data-testid="foundation-room-context-banner"
                  title={`Multiplayer-Room · Raum ${roomContext.roomCode} · Save ${formatShortSaveId(roomContext.saveId)}`}
                >
                  <span className="pill foundation-room-chip-code">
                    <span aria-hidden="true">👥</span> Raum {roomContext.roomCode}
                  </span>
                  {roomIdentity ? (
                    <span className="pill foundation-room-chip-participant" data-testid="foundation-room-participant-identity">
                      {roomIdentity.displayName}
                    </span>
                  ) : null}
                  <a className="secondary-button inline-button foundation-room-chip-link" href={`/room/${roomContext.roomCode}`}>
                    Zur Room-Ansicht
                  </a>
                </div>
                {roomActivityNotice ? (
                  <div
                    className="foundation-action-feedback is-toast is-info foundation-room-activity-notice"
                    role="status"
                    aria-live="polite"
                    data-testid="foundation-room-activity-notice"
                  >
                    <div className="foundation-ai-preseason-copy">
                      <span className="eyebrow">Mitspieler-Aktion</span>
                      <strong>{roomActivityNotice.title}</strong>
                      <span className="muted">{roomActivityNotice.detail}</span>
                    </div>
                    <button
                      className="table-link-button"
                      type="button"
                      onClick={() => setRoomActivityNotice(null)}
                    >
                      ausblenden
                    </button>
                  </div>
                ) : null}
              </>
            );
          })()
        ) : null}
        {/* Laufende Langlaeufer benennen, solange sie laufen.
            Das Aktions-Feedback darunter meldet erst das ERGEBNIS und blendet sich nach
            6 Sekunden aus — fuer einen Lauf, der laenger dauert als das, taugt es nicht.
            Der Saisonende-Schritt rechnet die Spielerentwicklung fuer alle Teams und
            braucht dafuer echte Sekunden; ohne Ansage sieht das aus, als haenge das Spiel.
            Diese Zeile haengt am Busy-Schluessel und steht damit exakt so lange wie die
            Arbeit — kein Timer, der zu frueh oder zu spaet abraeumt. */}
        {FOUNDATION_BUSY_NOTICES[cockpitBusyKey ?? ""] ? (
          <div
            className="foundation-action-feedback is-toast is-info"
            role="status"
            aria-live="polite"
            data-testid="foundation-busy-notice"
          >
            <div className="foundation-ai-preseason-copy">
              <span className="eyebrow">Läuft gerade</span>
              <strong>{FOUNDATION_BUSY_NOTICES[cockpitBusyKey ?? ""]!.title}</strong>
              <span className="muted">{FOUNDATION_BUSY_NOTICES[cockpitBusyKey ?? ""]!.detail}</span>
            </div>
          </div>
        ) : null}
        {foundationActionFeedback ? (
          <div
            className={`foundation-action-feedback is-toast is-${foundationActionFeedback.tone}`}
            role="status"
            aria-live="polite"
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

      {roomContext && roomLiveState ? (
        <FoundationRoomFlowBar roomContext={roomContext} roomLiveState={roomLiveState} />
      ) : null}

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
            {/* Nur EIN Primary pro Ansicht: der Header-"Weiter"-Button ist der
                globale Akzent; die View-Hauptaktion wird als Secondary abgestuft,
                damit klar ist, was DER nächste Schritt ist. */}
            <button
              className={`secondary-button foundation-screen-action-button${screenPrimaryAction.disabled ? " is-disabled" : ""}`}
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
                <h2>Info-Buch für Kennzahlen und Systeme</h2>
                <p>
                  Abkürzungen, Werte und wichtige Formellogik ohne Tabellenballast. Die Einträge zeigen bewusst Faktoren
                  und Lesart, nicht jede interne Nachkommastelle.
                </p>
              </div>
              <button className="secondary-button inline-button" type="button" onClick={() => setShowCommandPalette(true)}>
                Begriff suchen
              </button>
            </div>

            <div className="foundation-encyclopedia-layout">
              <nav className="foundation-encyclopedia-index" aria-label="Lexikon-Themen">
                {groupGameEncyclopediaEntriesByCategory(GAME_ENCYCLOPEDIA_ENTRIES).map((group) => (
                  <div key={group.category} role="group" aria-label={group.category} style={{ display: "grid", gap: 8 }}>
                    <div
                      className="eyebrow"
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        padding: "4px 2px",
                        background: "var(--nl-panel-2, rgba(15, 22, 33, 0.96))",
                      }}
                    >
                      {group.category}
                    </div>
                    {group.entries.map((entry) => (
                      <button
                        key={entry.id}
                        className={`foundation-encyclopedia-index-item${selectedEncyclopediaEntry?.id === entry.id ? " is-active" : ""}`}
                        type="button"
                        onClick={() => setSelectedEncyclopediaEntryId(entry.id)}
                        title={entry.short}
                      >
                        <strong>{entry.term}</strong>
                        <small>{entry.short}</small>
                      </button>
                    ))}
                  </div>
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


          {activeView === "homeV2" ? (() => {
          // Kredit-Kern (Fog of War): nur für das aktive Manager-Team, nie für
          // ein fremdes Team, siehe `use-credits-view-model.ts`.
          const homeLoanInstallment = activeManagerTeamId
            ? getTeamAnnualLoanInstallment(gameState, activeManagerTeamId)
            : null;
          const homeOutstandingDebt = activeManagerTeamId
            ? getTeamOutstandingDebt(gameState, activeManagerTeamId)
            : null;
          return (
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
              loanInstallment: homeLoanInstallment,
              outstandingDebt: homeOutstandingDebt,
              rosterCount: selectedRosterTableRows.length,
              // Wave D · Feld-Rennen (D1/D2/D4) — fog-sicher, additiv.
              fieldRaceForm: selectedTeamFieldRaceForm,
              fieldRacePlayedMatchdays: fieldRacePlayedMatchdayCount,
              fieldRaceTotalTeams,
              fieldRaceRankMovement: homeFieldRaceRankMovement,
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
                    : "Flow bereit — weiter zum nächsten Schritt.",
              // S1: roher Schlüssel bleibt am Chip — die Home-Ansicht braucht ihn,
              // um Band-Doppelungen zu filtern und Chips klickbar zu machen.
              warnings: (homeWarnings as string[])
                .filter((warning: string) => !HOME_HIDDEN_WARNING_KEYS.includes(warning))
                .map((warning: string) => ({ key: warning, label: formatHomeWarningLabel(warning) })),
              // Friction fix (Generalprobe #2): a fresh save starts with no
              // human-controlled team and no flow-blocker routes there — surface
              // a dedicated CTA instead of the silently-hidden `no_active_team` chip.
              showTeamPickerCta: manualTeams.length === 0,
              onOpenTeamPicker: navigateToTeamPicker,
              topPlayers: homeV2TopPlayers,
              // F4: Radar = Office-Kopf = Markt-Vorschau (Ø Top-6 je Achse).
              teamAxisAverages: selectedTeamTopSixAxisStats,
              leagueHeatPools: leaguePlayerHeatPools,
              facilities: homeV2Facilities,
              scheduleItems: homeV2ScheduleItems,
              // G3: der echte Spielplan — scheduleItems ist nur das 4er-Fenster
              // des Steppers und taugt nicht als Saisonlänge.
              seasonMatchdayTotal: gameState.season.matchdayIds.length,
              inboxItems: homeV2InboxItems,
              // F4: Zähler = volle Entscheidungsliste (identisch zur Inbox),
              // die Item-Liste bleibt die Top-5-Anzeige.
              inboxOpenCount: homeOpenTaskCount,
              inboxCriticalCount: activeTeamCriticalInboxItems.length,
              todayCards: homeTodayCards,
              // S1 (Mockup homeV2): Kapitän-Hinweis im Board-Block — dieselbe Quelle
              // wie die Kapitänwahl im Office (Kandidatenliste), keine zweite Rechnung.
              captainSummary: (() => {
                const candidates = selectedTeamCaptainCandidates ?? [];
                if (candidates.length === 0) return null;
                const current =
                  candidates.find(
                    (candidate: { playerId: string }) => candidate.playerId === selectedTeamCaptainPlayerId,
                  ) ?? null;
                const best = candidates.reduce(
                  (
                    leader: { playerId: string; playerName: string; leadershipScore: number } | null,
                    candidate: { playerId: string; playerName: string; leadershipScore: number },
                  ) => (leader == null || candidate.leadershipScore > leader.leadershipScore ? candidate : leader),
                  null,
                );
                const challenger =
                  current && best && best.playerId !== current.playerId && best.leadershipScore > current.leadershipScore + 1
                    ? best
                    : null;
                return {
                  captainName: current?.playerName ?? null,
                  captainLeadership: current?.leadershipScore ?? null,
                  challengerName: challenger?.playerName ?? null,
                  challengerLeadership: challenger?.leadershipScore ?? null,
                };
              })(),
              onContinue: triggerGlobalNext,
              // Alle Home-Schnellsprünge pushen einen History-Eintrag (wie die
              // Sidebar), damit „Zurück" von der Zielseite verlässlich wieder auf
              // Home führt statt auf den zuvor aktiven Tab.
              onOpenTeams: () => setFoundationView("teams", setActiveView, { push: true }),
              onOpenLineup: () => setFoundationView("lineup", setActiveView, { push: true }),
              onOpenArena: () => setFoundationView("matchdayArena", setActiveView, { push: true }),
              onOpenMarket: () => setFoundationView("marketV2", setActiveView, { push: true }),
              onOpenTraining: () => setFoundationView("trainingCompact", setActiveView, { push: true }),
              onOpenOffice: () => navigateHomeTab("office"),
              onOpenSeason: () => setFoundationView("seasonV2", setActiveView, { push: true }),
              // Aufgaben (Inbox) wird von Home aus geöffnet — History-Push, damit
              // Zurück verlässlich auf Home zurückführt statt auf den zuvor
              // aktiven Tab (z. B. Teams) zu springen.
              onOpenInbox: () => setFoundationView("inboxV2", setActiveView, { push: true }),
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
              loanInstallment: homeLoanInstallment,
              outstandingDebt: homeOutstandingDebt,
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
              selectedTeamTopSixAxisStats,
              rosterPlayers,
              onNavigate: (view) => setFoundationView(view, setActiveView),
              onOpenTeam: (teamId) => openTeamDrawerById(teamId),
              onNavigateInboxItem: navigateToInboxItem,
            }}
          />
          );
          })() : null}

          <FoundationShellRouterTeams
            active={activeView === "teams"}
            selectedTeam={selectedTeam}
            hostProps={foundationTeamsViewHostProps}
          />

          {/* Gehaltsverhandlung („Verlängern") — Overlay-Modal, bewusst auf
              Body-Ebene gemountet, damit es sowohl aus dem Kader-Tab
              (FoundationTeamsNewLook) als auch aus dem Verträge-Tab
              (FoundationTeamsDetailPanel, inkl. Auslauf-Center) funktioniert.
              Alle Zahlen kommen aus der Server-Preview (dryRun), Bestätigen
              läuft über den bestehenden Renewal-Apply-Pfad. */}
          {contractRenewalNegotiation ? (
            <ContractRenewalNegotiationModal
              subject={contractRenewalNegotiation}
              busy={contractRenewalBusy != null && !String(contractRenewalBusy).startsWith("preview:")}
              error={contractRenewalError}
              requestPreview={requestContractRenewalPreview}
              onConfirm={(draft) => void confirmContractRenewalNegotiation(draft)}
              onClose={() => setContractRenewalNegotiation(null)}
            />
          ) : null}

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
                  // Zurück soll auf den Herkunfts-Tab führen (z. B. Teams, Marktplatz,
                  // Rangliste), von dem das Spieler-Profil geöffnet wurde — nicht
                  // pauschal auf Home. Das Öffnen pusht einen History-Eintrag
                  // (openPlayerDrawerById / openPlayerProfileById mit push: true), also
                  // bringt uns der Browser-Back verlässlich dorthin zurück. Nur ohne
                  // History fällt es auf Home zurück.
                  if (canFoundationNavigateBack()) {
                    foundationNavigateBack();
                    return;
                  }
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
                  <FoundationPanelSkeleton label="Spielerprofil wird geladen…" />
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
                onOpenPlayer={(playerId, activePlayerId) => void openPlayerDrawerById(playerId, activePlayerId)}
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
                    ? `${selectedTeam.name} gehört nicht zu deinen steuerbaren Teams. Gebäude sind nur zur Ansicht offen.`
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
                beliebtheit={teamBeliebtheit}
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
                recruitmentBudget={selectedStandingRow?.cash != null ? formatNlMoney(selectedStandingRow.cash) : "—"}
                rosterCount={selectedStandingRow?.rosterCount ?? (Array.isArray(selectedRoster) ? selectedRoster.length : 0)}
                rosterMinimum={selectedStandingRow?.playerMin ?? null}
                rosterOptimum={selectedStandingRow?.playerOpt ?? null}
                draftContextNote="Teams starten mit Budget und leerem Kader. Base-Infos im Transfermarkt reichen für den ersten Draft — Scouting verfeinert die Sicht, ersetzt aber nicht den Markt."
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
                onOpenPlayer={(playerId) => void openPlayerDrawerById(playerId)}
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
                // F4-Regel „eine Quelle pro Größe": derselbe Zähler wie auf Home
                // (`homeOpenTaskCount` = `activeTeamDecisionInboxItems.length`) —
                // „offen" meint, was zu TUN ist; Berichte zählen nicht mit.
                openCount={activeTeamDecisionInboxItems.length}
                criticalCount={activeTeamCriticalInboxItems.length}
                teamLabel={selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : null}
                categoryFilter={inboxCategoryFilter}
                onCategoryFilterChange={setInboxCategoryFilter}
                hideCategoryFilters
                includeDone={inboxIncludeDone}
                onIncludeDoneChange={setInboxIncludeDone}
                includeDismissed={inboxIncludeDismissed}
                onIncludeDismissedChange={setInboxIncludeDismissed}
                /**
                 * GEMELDET: „ich wollte zu training über die inbox message und wurde zur team
                 * ansicht weitergeleitet".
                 *
                 * Der Handler bekam die `itemId` der angeklickten Karte — und warf sie weg
                 * (`_itemId`). Stattdessen schlug er den gerade AUSGEWAEHLTEN Eintrag nach, und
                 * ohne Auswahl schlicht den ERSTEN der Liste. Die CTA-Knoepfe rufen aber
                 * `stopPropagation()`, setzen die Auswahl also gar nicht auf ihre eigene Karte:
                 * Beim ersten Oeffnen der Inbox landete jeder Klick deterministisch beim ersten
                 * Eintrag. Und diese Liste ist NICHT nach Dringlichkeit sortiert — Kapitaen,
                 * Sponsor und Vertragsaufloesung (alle mit Ziel `teams`) stehen dort oft vor den
                 * Trainings-Eintraegen. Wer „Training öffnen" klickte, landete im Kader.
                 *
                 * Der frühere Fix e574215 konnte das nicht heilen: Er hat die ZIELE in
                 * `game-inbox-service.ts` berichtigt. Die sind seitdem korrekt — sie wurden hier
                 * nur nie gelesen.
                 *
                 * Richtig verdrahtet gibt es das laengst, in `FoundationInboxV2Host.tsx:96-104`.
                 * Nur wird die Komponente, die diesen Host rendert, nirgends verwendet.
                 */
                onOpenItem={(itemId) => {
                  const sourceItem = visibleInboxItems.find((item: GameInboxItem) => item.itemId === itemId);
                  if (sourceItem) {
                    navigateToInboxItem(sourceItem);
                  }
                }}
                onRunChoice={(itemId, choiceId) => {
                  if (choiceId !== "open-target") {
                    return;
                  }
                  const sourceItem = visibleInboxItems.find((item: GameInboxItem) => item.itemId === itemId);
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

          {/* Ebenfalls nur per CSS versteckt gewesen — siehe Generator darunter. */}
          {activeView === "admin" ? (
          <section className="panel" id="foundation-admin" data-testid="foundation-admin">
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
          ) : null}

          {/* Frueher nur per CSS versteckt: `PlayerGeneratorPanel` wurde damit in JEDER
              Ansicht gemountet und mit dem kompletten Spielerbestand gerendert. Jetzt echtes
              Gate wie bei den uebrigen Views. `id` und `data-testid` bleiben — die
              Perf-Audit-Skripte warten darauf. */}
          {activeView === "generator" ? (
          <section className="panel" id="foundation-generator" data-testid="foundation-generator">
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
              onCommitDraft={commitPlayerGeneratorDraft}
            />
          </section>
          ) : null}

          <FoundationShellRouterCockpit
            active={activeView === "cockpit"}
            hostProps={foundationCockpitHostProps}
          />

          {activeView === "lineup" || activeView === "lineupV2" ? (
          <FoundationLineupPanel
            active
            /**
             * DIE TEAM-ID GEHOERT NICHT IN DIESEN SCHLUESSEL.
             *
             * GEMELDET VON CHRIS: „wenn ich das team wechsel dass die seite aktualisiert und die
             * aufstellung weg ist". Genau das stand hier: aendert sich der Schluessel, baut React
             * `LegacyLineupLabClient` komplett neu auf — mitsamt jeder ungespeicherten Auswahl.
             *
             * Der Neuaufbau war dabei ueberfluessig: der Client reagiert selbst auf ein von aussen
             * geaendertes `defaultTeamId` und laedt den Kontext des neuen Teams. Er ist die
             * einzige der fuenf Groessen, fuer die es diesen eigenen Weg gibt — Spielstand, Saison,
             * Spieltag und Besitzer bleiben drin, dort ist ein Neuaufbau richtig.
             */
            clientKey={`lineup-${activeSaveId}-${gameState.season.id}-${gameState.matchdayState.matchdayId}-${effectiveActiveOwnerId}`}
            teamTooltip={
              selectedTeam
                ? `${selectedTeam.name}: Einsatzliste mit Focus Mode — Slots, Kandidaten und Preview.`
                : "Matchday Room für Teamwahl, Slots und Preview."
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
          <div id="foundation-matchday-arena" data-testid="foundation-matchday-arena">
          {/* Arena = die (ehemalige) Disziplin-Bühne. Der View bleibt `matchdayArena`
              (überall im Season-Flow verdrahtet), rendert aber jetzt die native Bühne.
              Die Landmark-ID `foundation-matchday-arena` bleibt am Container (Scroll-Target
              via getFoundationViewScrollTarget + Gameplay-Smoke-Locator).
              Es gibt keinen Abschluss-Knopf mehr: Jede zu Ende gespielte Disziplin bucht
              sich selbst (onCommitDiscipline) — nach D1 als halber Spieltag, nach D2 samt
              Preisgeld und Spieltagswechsel. Der eigene Advance-Button der Bühne bleibt
              damit unnötig (onAdvanceMatchday=null). Die alte Arena-Panel-UI
              (matchday-arena-v2) wurde entfernt. */}
          <FoundationDisciplineStageHost
            gameState={gameState}
            selectedTeamId={selectedTeamId}
            activeManagerTeamId={activeManagerTeamId}
            saveId={activeSaveId}
            seasonId={gameState.season.id}
            matchdayId={gameState.matchdayState.matchdayId}
            // Kanonische, ligaweite OVR/Rang-Karte (Server-Slice, volles Save) — dieselbe
            // Quelle, aus der Kader/Spielerprofil/Ranglisten lesen. Ohne sie rechnet die
            // Buehne selbst aus dem kompakten Client-Payload nach (siehe
            // docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md) und weicht von "der einen OVR" ab.
            canonicalRatingByPlayerId={playerRatingsById}
            // Der Spieltagswechsel gehoert in die Arena, nicht in einen Kasten darunter.
            // Vorher stand er in der "Spieltagsergebnis"-Sektion — die ist entfernt, und
            // damit waere der Spieltag aus dem normalen Spielverlauf nicht mehr
            // abschliessbar gewesen (man landete im Cockpit und hing dort fest).
            //
            // Gate wie zuvor ueber `canAdvanceMatchdayFromStep`: "ready" allein genuegt
            // NICHT — der Schritt steht auf "warning", sobald das Board gerissene
            // Saisonziele meldet. Das ist eine Mitteilung, kein Hindernis. Ist der
            // Spieltag noch nicht gewertet, gibt es keinen Knopf (null), und die Buehne
            // zeigt stattdessen ihren Hinweis.
            //
            // Aufruf ueber `finishMatchdayAndAdvance` statt direkt ueber
            // `runCockpitMatchdayAdvance`: der reine Aufruf verschluckte eine Ablehnung
            // (422 mit `blockingReasons`) vollstaendig. Der Knopf wurde kurz grau und
            // danach war der Spieltag trotzdem derselbe — von aussen nicht von "Knopf tut
            // nichts" zu unterscheiden. Der Wrapper meldet Start, Erfolg und Ablehnung
            // mit Begruendung zurueck (aus beiden Ablagen der Route plus Warnungen) und
            // raeumt die alten Flow-Haken weg. Bewusst OHNE `?.`: ein fehlender Handler
            // ist ein Fehler und soll knallen, nicht still nichts tun.
            //
            // Die NAVIGATION in den Saisonstand stand frueher hier. Sie ist in
            // `finishMatchdayAndAdvance` gewandert — nicht in die Spieltags-Logik, sondern
            // nur eine Ebene hoch in denselben Shell-Body-Scope. Grund: das globale
            // "Weiter" schliesst denselben Spieltag ab und hatte die Kopie nicht, also
            // stand man je nach geklicktem Knopf woanders. Ein Ziel, eine Stelle.
            // Bewusst `await` und bewusst OHNE `?.`: die Buehne haelt ihren Knopf so lange auf
            // "schaltet weiter…", und ein fehlender Handler soll knallen statt still nichts zu tun.
            onAdvanceMatchday={
              canAdvanceMatchdayFromStep(matchdayAdvanceStep)
                ? async () => {
                    await finishMatchdayAndAdvance();
                  }
                : null
            }
            onCommitDiscipline={commitArenaDiscipline}
            onOpenPlayer={(playerId) => openPlayerDrawerById(playerId)}
            onOpenTeam={(teamId) => openTeamDrawerById(teamId)}
            // S3 Pre-Matchday: „Einsatzliste öffnen →" ist der Held vor dem Anpfiff.
            // History-Push wie bei den Home-Schnellsprüngen, damit „Zurück" wieder
            // in der Arena landet.
            onOpenLineup={() => setFoundationView("lineup", setActiveView, { push: true })}
            roomContext={roomContext}
          />
              {/* Die "Spieltagsergebnis"-Sektion ist entfernt: sie wiederholte, was die
                  Arena und der Saisonstand ohnehin zeigen, und war der Grund, warum der
                  Spieltagswechsel unterhalb der Buehne versteckt lag. Der Knopf sitzt
                  jetzt in der Arena (onAdvanceMatchday oben). */}
          </div>
          ) : null}

          <FoundationShellRouterMatchdayResult
            active={activeView === "matchdayResult"}
            hostProps={foundationMatchdayResultHostProps}
          />

          {/* SAISONABSCHLUSS. Sichtbar, sobald die Saison durch ist — genau dann, wenn der
              Flow bisher ins Cockpit zeigte. Steht UEBER der Tabelle, weil am Saisonende
              nicht der Tabellenstand die Frage ist, sondern "was jetzt". */}
          {/* Sichtbar in JEDER Saisonende-Phase, nicht nur in den ersten beiden. Vorher stand
              hier `season_completed || season_review` — die Liste verschwand also genau dann,
              wenn der Spieler ueber den Rueckblick hinaus war und die restlichen Schritte
              (Transferfenster, Vertraege, neue Saison) noch offen hatte. */}
          {activeView === "seasonV2" && isSeasonEndPhase(gameState.gamePhase) ? (
            <FoundationSeasonFinalePanel
              gameState={gameState}
              activeTeamId={activeManagerTeamId}
              /* „Erledigt" heisst: das Sponsorgeld ist auf dem Konto — nicht bloss,
                 dass der Schritt schon einmal ausgeloest wurde. Ein Spielstand, in dem
                 der Schritt vor der Buchungs-Reparatur lief, traegt ein Audit-Log ohne
                 Zahlung; dort muss der Knopf wieder anfassbar sein. */
              seasonEndPayoutStatus={getSeasonEndPayoutStatus(gameState, gameState.season.id)}
              developmentApplied={(gameState.playerProgressionEvents ?? []).some(
                (event: { seasonId: string }) => event.seasonId === gameState.season.id,
              )}
              nextSeasonReady={Boolean(preSeasonWorkflowFeed?.ok)}
              busy={Boolean(preSeasonWorkflowBusy) || cockpitBusyKey != null}
              readOnly={readMeta.readOnly}
              onApplyPrize={() => void runCockpitCashApply(true)}
              onLoadNextSeasonPreview={() => void runPreSeasonWorkflowPreview()}
              onStartNextSeason={() => {
                // Der Saisonstart schreibt Snapshot, Entwicklung, Spielplan und Formkarten —
                // das ist nichts, was man aus Versehen ausloest.
                if (!window.confirm("Neue Saison starten? Das schreibt Entwicklung, neuen Spielplan und Formkarten.")) return;
                void runPreSeasonNextSeasonSetup();
              }}
              onOpenDevelopment={() => setFoundationView("trainingCompact", setActiveView, { push: true })}
              onOpenRoster={() => setFoundationView("teams", setActiveView, { push: true })}
              onOpenTransferWindow={() => void runSeasonTransition("open_transfer_window")}
              /* Ohne diese vier Zeilen ist jede Ablehnung des Servers auf dieser Seite
                 unsichtbar — der Knopf tut dann scheinbar nichts. Siehe die Prop-Doku im
                 Panel. */
              workflowError={preSeasonWorkflowError}
              workflowBlockingReasons={preSeasonWorkflowFeed?.blockingReasons ?? []}
              sponsorChoicePending={Number(
                preSeasonWorkflowFeed?.steps?.find(
                  (step: PreSeasonWorkflowStepSummaryResponse) => step.stepId === "sponsor_choice",
                )?.summary?.manualPending ?? 0,
              )}
              onOpenSponsors={() => openPrizeFinanceView()}
            />
          ) : null}

          {(activeView === "seasonV2") ? (
            <FoundationSeasonV2Panel
              active={activeView === "seasonV2"}
              selectedSeasonId={seasonOverviewSeasonId}
              selectedSeasonLabel={selectedSeasonOverviewLabel}
              sourceLabel={seasonOverviewSourceLabel}
              sourceBadgeLabel={getViewSourceBadgeLabel("seasonV2", activeContextMeta)}
              isArchived={isViewingArchivedSeason}
              /* B5: „archiviert" und „durch" sind zwei verschiedene Aussagen. Ohne diese Zeile
                 fiel die abgeschlossene Saison des Spielstands in den Zweig „Saison läuft" —
                 direkt unter der Ueberschrift „Saison abgeschlossen". */
              isSeasonEnded={isSeasonEndPhase(gameState.gamePhase)}
              seasonOptions={seasonOverviewOptions}
              selectedTeamSummary={seasonV2SelectedTeamSummary}
              leaderTeam={seasonV2LeaderTeam}
              momentumTeam={seasonV2MomentumTeam}
              pressureTeam={seasonV2PressureTeam}
              topPlayer={seasonV2TopPlayers[0] ?? null}
              standingsRows={seasonV2StandingsRows}
              topPlayers={seasonV2TopPlayers}
              teamTopPlayersByColumn={seasonV2TeamTopPlayersByColumn}
              teamFormCardBonusByTeamId={seasonV2FormCardBonusByTeamId}
              playerRows={seasonV2PlayerRows}
              gmRows={seasonV2GmRows}
              archiveRows={seasonV2ArchiveRows}
              disciplineLeaders={seasonV2DisciplineLeaders}
              rivalTeamIds={activeTeamRivalIds}
              isLoading={seasonStandingsLoading}
              onChangeSeason={(seasonId) => {
                setSeasonOverviewSeasonId(seasonId);
                void reloadSeasonStandingsOverview(seasonId);
              }}
              onOpenTeam={(teamId) => openTeamProfileById(teamId)}
              onOpenPlayer={(playerId) => void openPlayerDrawerById(playerId)}
              onOpenRanks={() => setFoundationView("ranks", setActiveView)}
              // Der Knopf heisst "Sponsoren" (SeasonStandingsNewLook.tsx) — er muss auch dorthin
              // fuehren. Bis hierher zwang er die Preisgeld-Ansicht auf, die weder Namen noch
              // Seltenheit zeigt, und aus der es seit dem Wegfall des Umschalters keinen Rueckweg gab.
              onOpenPrize={() => openPrizeFinanceView()}
            />
          ) : null}

          <FoundationShellRouterSeasonPreview
            active={activeView === "seasonPreview"}
            hostProps={foundationSeasonPreviewHostProps}
          />

          {activeView === "players" ? (
            <FoundationPlayersTableNewLook
              rows={sortedPlayersTableRows}
              gameState={gameState}
              leaguePlayerHeatPools={leaguePlayerHeatPools}
              sortState={tableSorts.playersTable}
              onToggleSort={(columnKey: string) => toggleTableSort("playersTable", columnKey)}
              playerScope={playerScope}
              onChangeScope={(scope: PlayerTableScope) => {
                setPlayerScope(scope);
                if (scope === "free_agents") {
                  setPlayerTeamFilter("ALL");
                }
              }}
              teams={gameState.teams}
              playerTeamFilter={playerTeamFilter}
              onChangeTeamFilter={setPlayerTeamFilter}
              playerClassFilter={playerClassFilter}
              playerClassOptions={playerClassOptions}
              onChangeClassFilter={setPlayerClassFilter}
              playerBracketCounts={playerBracketCounts}
              openPlayerDrawerById={openPlayerDrawerById}
              openTeamProfileById={openTeamProfileById}
            />
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
                  Ranks - Teamstärke pro Diszi
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
                  {/* Wie auf dem Saisonstand (G5): Klartext statt der halbenglischen
                      Status-Flag-Reihe „Live · Aktive Season · lokale Results" — die
                      technische Quelle bleibt als Tooltip erreichbar. */}
                  <span
                    className={`pill ${isViewingArchivedRanksSeason ? "is-warning" : "is-ready"}`}
                    title={seasonOverviewSourceLabel}
                  >
                    {resolveLigaWertungKopfzeile({
                      istArchiv: isViewingArchivedRanksSeason,
                      istAbgeschlossen: isSeasonEndPhase(gameState.gamePhase),
                    })}
                  </span>
                  {ranksArchiveMissing ? (
                    <span className="pill is-warning">Rang-Archiv fehlt — es zählt der laufende Stand</span>
                  ) : null}
                  {/* W1-Befund 7: Zustand und Aktion trennen — "alles gefüllt"
                      ist ein Status (Pill), nur "nachpicken" ist ein Button. */}
                  {!readMeta.readOnly && readMeta.source !== "prisma" && runBulkAiTeamsRefill ? (
                    !bulkAiPicksRefillBusy && (underFilledAiTeamIds?.length ?? 0) === 0 ? (
                      <span className="pill is-ready" title="Alle KI-Teams sind gefüllt — nichts zu tun">
                        KI-Teams gefüllt
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="secondary-button inline-button"
                        disabled={bulkAiPicksRefillBusy}
                        title="Alle nicht befüllten KI-Teams automatisch nachpicken"
                        onClick={() => void runBulkAiTeamsRefill()}
                      >
                        {bulkAiPicksRefillBusy
                          ? bulkAiPicksProgress
                            ? `Draftet… ${bulkAiPicksProgress.done}/${bulkAiPicksProgress.total}`
                            : "Wirbt an…"
                          : `KI-Teams nachpicken (${underFilledAiTeamIds?.length ?? 0})`}
                      </button>
                    )
                  ) : null}
                  {bulkAiPicksRefillBusy && bulkAiPicksProgress ? (
                    <span className="pill is-running ranks-draft-progress" title="KI-Draft läuft — Teams werden nacheinander besetzt">
                      <span className="ranks-draft-progress-count">
                        <strong>{bulkAiPicksProgress.done}</strong>
                        <span className="muted"> / {bulkAiPicksProgress.total} Teams gepickt</span>
                      </span>
                      <span className="ranks-draft-progress-bar" aria-hidden="true">
                        <span
                          style={{
                            width: `${
                              bulkAiPicksProgress.total > 0
                                ? Math.round((bulkAiPicksProgress.done / bulkAiPicksProgress.total) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </span>
                    </span>
                  ) : null}
                  {!bulkAiPicksRefillBusy && bulkAiPicksRefillMessage ? (
                    <span
                      className={`pill ${bulkAiPicksRefillMessage.tone === "success" ? "is-ready" : "is-warning"}`}
                      title={bulkAiPicksRefillMessage.text}
                    >
                      {bulkAiPicksRefillMessage.text}
                    </span>
                  ) : null}
                </div>
              </div>
              {/* W1 (Chris' Entscheidung): Achsen-Gruppen statt px-Spalten-Manager.
                  Je Gruppe ein Schalter, der alle Disziplin-Spalten der Achse
                  ein-/ausblendet; "Standard" setzt das Tabellen-Layout zurück. */}
              <div className="ranks-axis-groups" role="group" aria-label="Achsen-Gruppen ein- oder ausblenden" data-testid="ranks-axis-groups">
                <span className="ranks-axis-groups-label">Achsen-Gruppen</span>
                {ranksAxisGroups.map((group) => (
                  <button
                    key={group.category}
                    type="button"
                    className={joinClassNames(
                      "ranks-axis-group-toggle",
                      `is-${group.category}`,
                      group.anyVisible && "is-active",
                    )}
                    aria-pressed={group.anyVisible}
                    title={
                      group.anyVisible
                        ? `${group.label}-Disziplinen ausblenden (${group.columns.length} Spalten)`
                        : `${group.label}-Disziplinen einblenden (${group.columns.length} Spalten)`
                    }
                    onClick={() =>
                      group.columns.forEach((column) =>
                        setTableColumnVisible("disciplineRanksTable", column.id, !group.anyVisible),
                      )
                    }
                  >
                    <span className="ranks-axis-group-dot" aria-hidden="true" />
                    {group.label}
                    <small className="nl-tnum">{group.columns.length}</small>
                  </button>
                ))}
                <button
                  type="button"
                  className="ghost-button ranks-axis-groups-reset"
                  onClick={() => resetTableLayout("disciplineRanksTable", disciplineRanksColumns)}
                  title="Alle Spalten, Reihenfolge und Breiten auf den Standard zurücksetzen"
                >
                  Standard
                </button>
              </div>
            </div>
            <section className="ranks-leader-grid" aria-label="Aktuelle Teamstärke Leader">
              {rankLeaderCards.map((entry: FoundationDisciplineLeaderEntry) => (
                <article key={`rank-leader-${entry.id}`} className={`ranks-leader-card is-${entry.tone}`}>
                  <span>{entry.label}</span>
                  <strong>{entry.row?.team.name ?? "—"}</strong>
                  {/* „Stärke", nicht „Punkte": der Wert ist der Teamstärke-Score der Rank-Matrix
                      (scorePack — Summe der Top-6-Disziplin-Ratings der Kader, team-discipline-
                      rank-engine.ts), keine erspielte Größe. „Punkte" meint auf derselben Seite
                      bereits die PPs des Saison-Rankings — ein Wort pro Größe. */}
                  <small title="Teamstärke-Score aus den Disziplin-Ratings der Kader (Rank-Matrix) — nicht die erspielten PPs des Saison-Rankings">
                    {entry.row ? `#1 · Stärke ${formatLocalePoints(entry.row.scorePack[entry.scoreKey], 1)}` : "keine Werte"}
                  </small>
                </article>
              ))}
            </section>
            {/* W1: Legende trennt die zwei Farbsysteme — Zellenfarbe = Rang,
                Achsenfarbe lebt nur noch im Gruppenband über den Spalten. */}
            <div className="ranks-color-legend" role="note" aria-label="Farb-Legende der Rank-Matrix" data-testid="ranks-color-legend">
              <span className="ranks-color-legend-item">
                <b>Zellenfarbe = Rang:</b>
                <span className="ranks-heatstrip" role="img" aria-label="Heat-Skala: Rang 1 bis 3 grün, 4 bis 6 gelb, 7 bis 10 rot, ab 11 ruhig">
                  <i className="rank-strong" />
                  <i className="rank-mid" />
                  <i className="rank-weak" />
                  <i className="rank-muted" />
                </span>
                <span className="nl-tnum">1–3 · 4–6 · 7–10 · ab 11 ruhig</span>
              </span>
              <span className="ranks-color-legend-item">
                <b>Farbband oben = Achse</b> (Power · Speed · Mental · Social) — Kürzel hovern zeigt den vollen Disziplinnamen.
              </span>
              <span className="ranks-color-legend-item is-scrollhint">Weitere Disziplinen rechts — die Tabelle scrollt, die Team-Spalte bleibt stehen.</span>
            </div>
            <div className="ranks-table-scrollwrap">
            <div className="table-shell">
              <table className="team-table ranks-table">
                <colgroup>
                  {visibleDisciplineRanksColumns.map((column: FoundationTableColumn) => (
                    <col key={column.id} style={{ width: `${getTableColumnWidth("disciplineRanksTable", column)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  {/* W1: Gruppenband — die EINZIGE Stelle mit Achsenfarbe. */}
                  <tr className="ranks-group-row" data-testid="ranks-axis-group-row">
                    {ranksHeaderGroups.map((group) => (
                      <th
                        key={group.key}
                        colSpan={group.span}
                        scope="colgroup"
                        className={joinClassNames(
                          "ranks-group-cell",
                          `is-${group.category}`,
                          group.category === "team" && "ranks-sticky-team",
                        )}
                      >
                        {group.label}
                      </th>
                    ))}
                  </tr>
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
                            <SortableHeader
                              label={column.label}
                              tableId="disciplineRanks"
                              columnKey={column.dataKey}
                              sortState={tableSorts.disciplineRanks}
                              onToggle={toggleTableSort}
                              tooltip={
                                discipline
                                  ? `${discipline.name} — Teamstärke-Rang in dieser Disziplin (Top-6-Spieler je Team). Klick sortiert.`
                                  : (RANKS_AGGREGATE_COLUMN_TOOLTIPS[column.id] ?? null)
                              }
                            />
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
                        "ranks-row-clickable",
                        row.team.teamId === activeManagerTeamId && "is-active-team-row",
                        activeTeamRivalIds.has(row.team.teamId) && "is-rival",
                        getOwnerTeamHighlightClass(resolvedTeamControlSettings[row.team.teamId]),
                      )}
                      onClick={() => openTeamProfileById(row.team.teamId)}
                      title={`${row.team.name} — Teamprofil öffnen`}
                    >
                      {visibleDisciplineRanksColumns.map((column: FoundationTableColumn, columnIndex: number) => {
                        if (column.id === "team") {
                          return (
                            <td key={column.id} className="ranks-sticky-team">
                              <span className="ranks-team-name-wrap">
                                {row.team.name}
                                {row.team.teamId === activeManagerTeamId ? (
                                  <span className="ranks-own-tag">Dein Team</span>
                                ) : null}
                                {activeTeamRivalIds.has(row.team.teamId) ? <RivalTag /> : null}
                              </span>
                            </td>
                          );
                        }
                        if (column.id === "rosterSize") {
                          // Reine Auskunft, kein Rang — deshalb ohne Heat-Farbe. Die Zahl steht
                          // neben den Raengen, damit „stark" und „duenn besetzt" unterscheidbar
                          // bleiben.
                          return (
                            <td key={column.id} className="nl-tnum" title={`${row.team.name}: ${row.rosterSize} Spieler im Kader`}>
                              {row.rosterSize}
                            </td>
                          );
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
            </div>
          </section>
          <FoundationRanksHost {...foundationRanksHostProps} />
          </>
          ) : null}

          {activeView === "leagueLeaders" ? <FoundationLeagueLeadersHost {...foundationLeagueLeadersHostProps} /> : null}

          {activeView === "allTimeTable" ? <FoundationAllTimeTableHost {...foundationAllTimeTableHostProps} /> : null}

          {activeView === "merkliste" ? <FoundationMerklisteHost {...foundationMerklisteHostProps} /> : null}

          {activeView === "diszis" ? <FoundationDiszisHost {...foundationDiszisHostProps} /> : null}
          {/* S4/A4 (Audit Spieltag): Der frühere Standalone-View `disciplineStage` ist
              entfallen — die Bühne rendert jetzt im `matchdayArena`-View (siehe oben).
              Wer diese Ansicht trotzdem ansteuert (alter Link/Lesezeichen), bekam bis
              hierher eine komplett leere Fläche ohne Text, ohne Hinweis, ohne Weg
              zurück — eine echte Sackgasse. `VeloPendingRanking` ist genau für erklärte
              Leerzustände gebaut (siehe Arena-Pre-Matchday, S3) — hier ohne Slots, nur
              Titel + Erklärung + ein echter Weg weiter in die Arena. */}
          {activeView === "disciplineStage" ? (
            <div className="foundation-discipline-stage-redirect" data-testid="foundation-discipline-stage-redirect">
              <VeloPendingRanking
                eyebrow="Disziplin-Bühne"
                title="Diese Ansicht ist umgezogen"
                note="Die Bühne läuft jetzt direkt in der Spieltags-Arena — als eigene Ansicht gibt es sie nicht mehr. Dort siehst du Startbereitschaft, laufende Disziplinen und die Spieltags-Wertung an einem Ort."
                meta={
                  <button
                    type="button"
                    className="nl-result-button is-primary"
                    onClick={() => setFoundationView("matchdayArena", setActiveView, { push: true })}
                  >
                    Zur Arena →
                  </button>
                }
                data-testid="discipline-stage-redirect-pending-ranking"
              />
            </div>
          ) : null}

          <FoundationShellRouterPrize
            active={activeView === "prize"}
            hostProps={foundationPrizeFinanceShellHostProps}
          />

          <FoundationShellRouterMarketV2
            active={isTransferMarketViewActive}
            hostProps={foundationMarketV2ShellHostProps}
          />

          <FoundationShellRouterMarketSell
            active={isMarketSellPanelOpen}
            hostProps={{
              readMetaSource: readMeta.source,
              selectedTeam: selectedTeam ?? null,
              marketSellPreview,
              marketSellSubject,
              marketSellBusy,
              marketSellError,
              marketSellSuccess,
              marketSellRiskAcknowledged,
              onMarketSellRiskAcknowledgedChange: setMarketSellRiskAcknowledged,
              playerRatingsById,
              playerSeasonPerformanceMap,
              derivationsInput: {
                gameState,
                selectedTeamId: selectedTeam?.teamId ?? "",
                getPlayerDisplayMarketValue,
                getRosterEntryDisplayMarketValue,
                getRosterEntryDisplaySalary,
                getPlayerDisplayMarketValueDelta,
                getRosterEntrySalaryDelta,
              },
              closeMarketSellModal,
              confirmTransfermarktSell,
              retryMarketSellPreview,
            }}
          />

          <FoundationShellRouterHistoryV2
            active={activeView === "history" || activeView === "historyV2"}
            hostProps={foundationHistoryV2HostProps}
          />

          {activeView === "credits" ? (
            <FoundationCreditsHost
              gameState={gameState}
              teamId={activeManagerTeamId}
              onBorrow={originateLoanForActiveTeam}
              onEarlyPayoff={repayLoanEarlyForActiveTeam}
            />
          ) : null}

          {/* saveId: Seed fürs Season-Ökonomie-Fenster (Salary-Factor-Chip) — muss die echte
              activeSaveId sein, damit Finanzen dieselben Faktoren zeigen wie Briefing + KI. */}
          {activeView === "finances" ? (
            <FoundationFinancesHost
              gameState={gameState}
              teamId={activeManagerTeamId}
              saveId={activeSaveId}
              onOpenTeam={(teamId) => openTeamProfileById(teamId)}
            />
          ) : null}

          {/* Der Changelog braucht keinen Spielstand — er liest die zur Build-Zeit generierte Datei. */}
          {activeView === "changelog" ? <FoundationChangelogHost /> : null}

          {/* Der Debug-Block hing bis hierher nur an einer CSS-Klasse (`getViewClass` gibt
              lediglich `foundation-section-hidden` zurueck). Das hiess: der komplette
              GameState wurde bei JEDEM Render JEDER Ansicht durch `JSON.stringify` geschickt
              — bei einem echten Save sind das zweistellige Megabyte Text pro Render, die
              niemand je zu sehen bekam. Jetzt haengt er an einem echten Gate und nutzt das
              vorhandene `FoundationDebugGameStatePanel`, das ohnehin schon die bessere
              Darstellung mitbringt (Zusammenfassung statt Rohtext, volles JSON erst auf
              Klick und bei 2 MB abgeschnitten). */}
          {activeView === "debug" ? <FoundationDebugGameStatePanel gameState={gameState} /> : null}

      </div>
      </FoundationShell>
    </main>
  )
  );
}
