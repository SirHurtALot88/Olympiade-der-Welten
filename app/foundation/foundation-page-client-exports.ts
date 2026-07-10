"use client";

/** Canonical re-exports for FoundationShellRouterBody (not via scope hook). */
export { default as BudgetedMediaImage } from "@/components/foundation/BudgetedMediaImage";
export { default as ClassColorChip, getClassColorClassName } from "@/app/foundation/ClassColorChip";
export { default as ClassIcon } from "@/app/foundation/ClassIcon";
export { default as DisciplineIcon } from "@/app/foundation/DisciplineIcon";
export { default as RaceIcon } from "@/app/foundation/RaceIcon";
export { default as PlayerGeneratorPanel } from "@/app/foundation/PlayerGeneratorPanel";
export { default as FoundationPlayerPortraitPreview } from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
export { default as FacilitiesV2Client } from "@/app/foundation/facilities-v2/FacilitiesV2Client";
export { default as FoundationHomeV2Panel } from "@/app/foundation/home-v2/FoundationHomeV2Panel";
export { default as InboxV2Client } from "@/app/foundation/inbox-v2/InboxV2Client";
export { default as FoundationLineupPanel } from "@/app/foundation/legacy-lineup-lab/FoundationLineupPanel";
export { default as FoundationMatchdayArenaPanel } from "@/app/foundation/matchday-arena-v2/FoundationMatchdayArenaPanel";
export { default as PlayerProfileClient } from "@/app/foundation/player-profile/PlayerProfileClient";
export { default as ScoutingCenterV2Client } from "@/app/foundation/scouting-center-v2/ScoutingCenterV2Client";
export { default as FoundationSeasonV2Panel } from "@/app/foundation/season-v2/FoundationSeasonV2Panel";
export { default as FoundationShell } from "@/app/foundation/shell/FoundationShell";
export { default as FoundationSubNav } from "@/app/foundation/shell/FoundationSubNav";
export { default as FoundationSponsorsPanel } from "@/app/foundation/sponsors-v2/FoundationSponsorsPanel";
export { default as TeamProfileClient } from "@/app/foundation/team-profile/TeamProfileClient";
export { default as FoundationTeamsDetailPanel } from "@/app/foundation/teams-v2/FoundationTeamsDetailPanel";
export { default as TrainingCompactClient } from "@/app/foundation/training-compact/TrainingCompactClient";
export { default as TransferHistoryV2Client } from "@/app/foundation/transfer-history-v2/TransferHistoryV2Client";
export { default as FoundationTransfermarktV2Panel } from "@/app/foundation/transfermarkt-v2/FoundationTransfermarktV2Panel";
export { ColumnVisibilityManager, SortableHeader } from "@/components/foundation/FoundationTableUi";
export { GameTerm } from "@/components/ui/GameTerm";
export { TooltipHeading } from "@/components/ui/TooltipHeading";
export { runAiTurn } from "@/lib/ai/aiTurnEngine";
export { FACILITY_CATALOG, SPECIALIST_WING_VARIANTS } from "@/lib/facilities/facility-catalog";
export { featureAuditFilters, getFeatureAuditFlags } from "@/lib/foundation/feature-audit-matrix";
export { FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS } from "@/lib/foundation/foundation-admin-dev-flags";
export { setFoundationView } from "@/lib/foundation/foundation-navigation";
export { prefetchFoundationPanel } from "@/lib/foundation/foundation-panel-prefetch";
export { getLineupDraftSideCounts } from "@/lib/foundation/matchday-lineup-readiness";
export { getPoolHeatClass } from "@/lib/foundation/player-league-heat";
export { PLAYER_PROFILE_TABS } from "@/lib/foundation/player-profile-service";
export { formatPpFormBonus } from "@/lib/foundation/pp-area-form-bonus";
export { SEASON_TRANSITION_STATIC_STEPS } from "@/lib/foundation/tabs/foundation-page-types";
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
  joinClassNames,
  normalizeTeamStrategyLevel,
  scrollToFoundationTarget,
  syncFoundationViewInUrl,
  withSynchronizedStrategyAliases,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";
export { getTeamLogoModel } from "@/lib/data/mediaAssets";
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
export { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";
export {
  getPlayerDisplayMarketValue,
  getPlayerDisplayMarketValueDelta,
  getPlayerDisplaySalary,
  getRankHeatClass,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntryCurrentSeasonSalary,
  getRosterEntrySalaryDelta,
  getSeasonCashHeatClass,
  getTeamHistoryRankToneClass,
  renderEconomyDelta,
  renderMetricBar,
  roundViewNumber,
} from "@/lib/foundation/tabs/season-stand-render-helpers";
export { getTeamAxisRankTooltip, getTeamsViewColumnTitle } from "@/lib/foundation/tabs/teams-ui-helpers";
export { HISTORY_ALL_SEASONS_FILTER } from "@/lib/foundation/tabs/use-history-v2-derivations";
export {
  DEFAULT_ACTIVE_OWNER_ID,
  buildTeamControlSettingsMap,
  deriveChrisFrankyTeamIdsFromSettings,
  filterTeamsByControlScope,
} from "@/lib/foundation/team-control-settings";
export { buildResolvedTeamIdentities } from "@/lib/foundation/team-identity-settings";
export { buildTeamStrategyProfileMap } from "@/lib/foundation/team-strategy-profiles";
export { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
export { getTransfermarktScoutingDisclosure } from "@/lib/market/transfermarkt-scouting";
export {
  FOUNDATION_SAVE_MODE_OPTIONS,
  formatFoundationSaveModeLabel,
  normalizeFoundationSaveMode,
  resolveFoundationSaveMode,
} from "@/lib/persistence/foundation-save-mode";
export { PROGRESSION_CLASS_ORDER } from "@/lib/training/class-progression-config";
export { describeRoomFlowButton, getRoomFlowStep } from "@/lib/room/room-flow-controller";
export {
  getScoutingWishlistSlotLimit,
  getTeamTransferWishlistEntries,
  isTeamSetupDraftWishlistPhase,
} from "@/lib/scouting/scouting-wishlist-slots";
export { applySponsorNegotiationToComponents, getSponsorNegotiationMultiplier } from "@/lib/sponsor/sponsor-negotiation";
export { GAME_ENCYCLOPEDIA_ENTRIES } from "@/lib/ui/game-encyclopedia";
export { MappingHighlight } from "@/app/foundation/MappingHighlight";

export type {
  FacilityId,
  FoundationView,
  FoundationViewId,
  NewGamePresetId,
  PlayerTableScope,
  TeamStrategyProfile,
} from "@/lib/foundation/tabs/foundation-page-types";
export type { DisciplineCategoryFilter } from "@/lib/foundation/tabs/foundation-format-render-helpers";
export type { GameFlowView } from "@/lib/foundation/game-flow-controller";
export type { PlayerProfileTabId } from "@/lib/foundation/player-profile-service";
export type { SpecialistWingVariant } from "@/lib/facilities/facility-catalog";
export type { TeamControlFilter } from "@/lib/foundation/team-control-settings";
