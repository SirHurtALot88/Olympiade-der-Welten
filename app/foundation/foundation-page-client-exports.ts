"use client";

/** Canonical re-exports for FoundationShellRouterBody (not via scope hook). */
export {
  ClassColorChip,
  getClassColorClassName,
} from "@/app/foundation/ClassColorChip";
export {
  ClassIcon,
} from "@/app/foundation/ClassIcon";
export {
  DisciplineIcon,
} from "@/app/foundation/DisciplineIcon";
export {
  FoundationPlayerPortraitPreview,
} from "@/app/foundation/FoundationPlayerPortraitPreview";
export {
  PlayerGeneratorPanel,
} from "@/app/foundation/PlayerGeneratorPanel";
export {
  RaceIcon,
} from "@/app/foundation/RaceIcon";
export {
  FacilitiesV2Client,
} from "@/app/foundation/facilities-v2/FacilitiesV2Client";
export {
  FoundationHomeV2Panel,
} from "@/app/foundation/home-v2/FoundationHomeV2Panel";
export {
  InboxV2Client,
} from "@/app/foundation/inbox-v2/InboxV2Client";
export {
  FoundationLineupPanel,
} from "@/app/foundation/legacy-lineup-lab/FoundationLineupPanel";
export {
  FoundationMatchdayArenaPanel,
} from "@/app/foundation/matchday-arena-v2/FoundationMatchdayArenaPanel";
export {
  PlayerProfileClient,
} from "@/app/foundation/player-profile/PlayerProfileClient";
export {
  ScoutingCenterV2Client,
} from "@/app/foundation/scouting-v2/ScoutingCenterV2Client";
export {
  FoundationSeasonV2Panel,
} from "@/app/foundation/season-v2/FoundationSeasonV2Panel";
export {
  FoundationShell,
} from "@/app/foundation/shell/FoundationShell";
export {
  FoundationSubNav,
} from "@/app/foundation/shell/FoundationSubNav";
export {
  FoundationSponsorsPanel,
} from "@/app/foundation/sponsors-v2/FoundationSponsorsPanel";
export {
  TeamProfileClient,
} from "@/app/foundation/team-profile/TeamProfileClient";
export {
  FoundationTeamsDetailPanel,
} from "@/app/foundation/teams-v2/FoundationTeamsDetailPanel";
export {
  TrainingCompactClient,
} from "@/app/foundation/training-compact/TrainingCompactClient";
export {
  TransferHistoryV2Client,
} from "@/app/foundation/transfer-history-v2/TransferHistoryV2Client";
export {
  FoundationTransfermarktV2Panel,
} from "@/app/foundation/transfermarkt-v2/FoundationTransfermarktV2Panel";
export {
  ColumnVisibilityManager,
  SortableHeader,
} from "@/components/foundation/FoundationTableUi";
export {
  GameTerm,
} from "@/components/ui/GameTerm";
export {
  TooltipHeading,
} from "@/components/ui/TooltipHeading";
export {
  runAiTurn,
} from "@/lib/ai/aiTurnEngine";
export {
  FACILITY_CATALOG,
  SPECIALIST_WING_VARIANTS,
} from "@/lib/facilities/facility-catalog";
export {
  featureAuditFilters,
  getFeatureAuditFlags,
} from "@/lib/foundation/feature-audit-matrix";
export {
  FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS,
  filterTeamsByControlScope,
} from "@/lib/foundation/foundation-admin-dev-flags";
export {
  setFoundationView,
} from "@/lib/foundation/foundation-navigation";
export {
  prefetchFoundationPanel,
} from "@/lib/foundation/foundation-panel-prefetch";
export {
  getLineupDraftSideCounts,
} from "@/lib/foundation/matchday-lineup-readiness";
export {
  getPoolHeatClass,
} from "@/lib/foundation/player-league-heat";
export {
  PLAYER_PROFILE_TABS,
} from "@/lib/foundation/player-profile-service";
export {
  formatPpFormBonus,
} from "@/lib/foundation/pp-area-form-bonus";
export {
  SEASON_TRANSITION_STATIC_STEPS,
} from "@/lib/foundation/tabs/cockpit-types";
export {
  formatAiLineupAuditWarning,
  formatCockpitReason,
  formatHomeWarningLabel,
  formatMatchdayMvpWarning,
  formatObjectiveStatusLabel,
  formatSeasonCompletionStepStatus,
  getCockpitStatusLabel,
  getCockpitStatusPillClass,
  getCockpitStepTone,
  getGameFlowStatusLabel,
  getSeasonCompletionStepTone,
  mapAutoRunStatusToCockpitStatus,
} from "@/lib/foundation/tabs/cockpit-ui-helpers";
export {
  buildScenarioWarning,
  formatActiveManagerTeamSource,
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
  formatPpsValue,
  formatScenarioTypeLabel,
  formatShortSaveId,
  formatSignedDisplayMoney,
  formatSignedNumber,
  formatSignedTransfermarktCurrency,
  formatTeamControlModeLabel,
  formatWholeNumber,
  getTransferSourceLabel,
  getTransferTypePillClass,
  getViewSourceBadgeLabel,
  inferSaveTypeLabel,
  parseCsvList,
  resolveScenarioMetaLabel,
} from "@/lib/foundation/tabs/foundation-format-render-helpers";
export {
  DEFAULT_ACTIVE_OWNER_ID,
  PlayerPortrait,
  WarningList,
  buildTeamIdentityDraftMap,
  clampBiasValue,
  clampIdentityValue,
  clampValue,
  foundationSecondaryViews,
  getFoundationViewScrollTarget,
  getOwnerTeamHighlightClass,
  getPlayerPortraitModel,
  getRanksMetricToneClass,
  getResponsiveTableImageSize,
  getTeamLogoModel,
  joinClassNames,
  normalizeTeamStrategyLevel,
  scrollToFoundationTarget,
  syncFoundationViewInUrl,
  withSynchronizedStrategyAliases,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";
export {
  NEW_GAME_PRESET_DEFAULTS,
  NEW_GAME_VISIBLE_PRESET_IDS,
  teamIdentityFieldLabels,
  teamStrategyBiasFieldLabels,
  teamStrategyIdentityListFieldLabels,
  teamStrategyLevelFieldLabels,
  teamStrategyListFieldLabels,
  teamStrategySportsBiasAxisMap,
  teamStrategySportsBiasFieldLabels,
} from "@/lib/foundation/tabs/foundation-page-types";
export {
  formatLocalePoints,
} from "@/lib/foundation/tabs/home-v2-ui-helpers";
export {
  getPlayerDisplayMarketValue,
  getPlayerDisplayMarketValueDelta,
  getPlayerDisplaySalary,
  getRankHeatClass,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntrySalaryDelta,
  getSeasonCashHeatClass,
  getTeamHistoryRankToneClass,
  renderEconomyDelta,
  renderMetricBar,
  roundViewNumber,
} from "@/lib/foundation/tabs/season-stand-render-helpers";
export {
  getTeamAxisRankTooltip,
  getTeamsViewColumnTitle,
} from "@/lib/foundation/tabs/teams-ui-helpers";
export {
  HISTORY_ALL_SEASONS_FILTER,
} from "@/lib/foundation/tabs/use-history-v2-derivations";
export {
  buildTeamControlSettingsMap,
  deriveChrisFrankyTeamIdsFromSettings,
} from "@/lib/foundation/team-control-settings";
export {
  buildResolvedTeamIdentities,
} from "@/lib/foundation/team-identity-settings";
export {
  buildTeamStrategyProfileMap,
} from "@/lib/foundation/team-strategy-profiles";
export {
  formatTransfermarktCurrency,
} from "@/lib/market/transfermarkt-formatting-contract";
export {
  getTransfermarktScoutingDisclosure,
} from "@/lib/market/transfermarkt-scouting";
export {
  FOUNDATION_SAVE_MODE_OPTIONS,
  formatFoundationSaveModeLabel,
  normalizeFoundationSaveMode,
  resolveFoundationSaveMode,
} from "@/lib/persistence/foundation-save-mode";
export {
  PROGRESSION_CLASS_ORDER,
} from "@/lib/progression/progression-class-order";
export {
  describeRoomFlowButton,
  getRoomFlowStep,
} from "@/lib/room/room-flow-controller";
export {
  getScoutingWishlistSlotLimit,
  getTeamTransferWishlistEntries,
  isTeamSetupDraftWishlistPhase,
} from "@/lib/scouting/scouting-wishlist-slots";
export {
  applySponsorNegotiationToComponents,
  getSponsorNegotiationMultiplier,
} from "@/lib/sponsor/sponsor-negotiation";
export {
  GAME_ENCYCLOPEDIA_ENTRIES,
} from "@/lib/ui/game-encyclopedia";
export { MappingHighlight } from "@/app/foundation/MappingHighlight";

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
} from "@/lib/foundation/tabs/foundation-page-types";

