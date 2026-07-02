"use client";

import type * as React from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";

import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import type {
  CashPrizeApplyLogRecord,
  GamePhase,
  GameState,
  Player,
  SeasonDisciplineScheduleEntry,
  SeasonSnapshotRecord,
  Team,
} from "@/lib/data/olyDataTypes";
import { featureAuditFilters, getFeatureAuditFlags } from "@/lib/foundation/feature-audit-matrix";
import type {
  FeatureAuditEntry,
  FeatureAuditFilter,
  FeatureAuditMatrix,
  FeatureAuditStatus,
} from "@/lib/foundation/feature-audit-matrix";
import type { FoundationPanelId } from "@/lib/foundation/foundation-navigation-history";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import {
  formatAiLineupAuditWarning,
  formatCockpitReason,
  formatMatchdayMvpWarning,
  formatSeasonCompletionStepStatus,
  getCockpitStatusLabel,
  getCockpitStatusPillClass,
  getCockpitStepTone,
  getSeasonCompletionStepTone,
  mapAutoRunStatusToCockpitStatus,
} from "@/lib/foundation/tabs/cockpit-ui-helpers";
import type {
  FoundationAiLineupBatchApplyResponse,
  FoundationApplySummary,
  FoundationAutoRosterFillResponse,
  FoundationMatchdayAutoRunSummary,
  FoundationMatchdayMvpLineupTeam,
  FoundationMatchdayMvpScoreboardRow,
  FoundationMatchdayMvpScoringResponse,
  FoundationMatchdayMvpTopPlayerRow,
  FoundationPrizePreviewItem,
  FoundationPrizePreviewResponse,
  FoundationReadMeta,
  FoundationResolvePreviewResponse,
  FoundationSeasonSnapshotSummary,
  FoundationStandingsPreviewResponse,
  FoundationTableColumn,
  FoundationTablePreset,
  FoundationTablePresetId,
  FoundationTransferHistoryResponse,
  FoundationTransfermarktResponse,
  FoundationView,
  FoundationWholeSeasonDryRunSummary,
  PreSeasonWorkflowApiResponse,
  PreSeasonWorkflowSummaryResponse,
  SaveActionRequest,
  SeasonCompletionApiResponse,
  SeasonCompletionSummaryResponse,
  SeasonTransitionApiResponse,
  SeasonTransitionStepResponse,
  SeasonTransitionSummaryResponse,
  SortState,
  TransfermarktBuySummary,
} from "@/lib/foundation/tabs/cockpit-types";
import type {
  MultiSeasonBalanceDashboard,
  MultiSeasonBalanceEconomyRow,
  MultiSeasonBalanceGameplayRow,
  MultiSeasonBalancePlayerRow,
  MultiSeasonBalanceTeamRow,
} from "@/lib/foundation/multiseason-balance-dashboard";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import type { SaveSummary } from "@/lib/persistence/types";
import { useFoundationShared } from "@/lib/foundation/foundation-shared-context";

export interface FoundationCockpitPanelProps {
  activeSaveId: string;
  activeSaveName: string;
  activeSaveSummary: SaveSummary | null;
  activeView: FoundationView;
  adjustTableColumnWidth: (tableId: string, column: FoundationTableColumn, delta: number) => void;
  aiLineupApplyTeams: Team[];
  aiTeams: Team[];
  canonicalSeasonLabel: string;
  cashApplyFeed: FoundationApplySummary | null;
  cockpitAiLineupStatus: { status: "blocked"; message: string; } | { status: "applied"; message: string; } | { status: "warning"; message: string; } | { status: "ready"; message: string; } | { status: "open"; message: string; };
  cockpitAutoRunStatus: { status: "open"; message: string; } | { status: "applied"; message: string; } | { status: "blocked"; message: string; } | { status: "warning"; message: string; } | { status: "ready"; message: string; };
  cockpitCashApplyStatus: { status: "applied"; message: string; } | { status: "blocked"; message: string; } | { status: "ready"; message: string; } | { status: "open"; message: string; };
  cockpitFlowChecklist: ({ label: string; done: boolean; active?: undefined; } | { label: string; done: boolean; active: boolean; })[];
  cockpitFreshSeasonStatus: { status: "blocked"; message: string; } | { status: "ready"; message: string; } | { status: "applied"; message: string; } | { status: "warning"; message: string; };
  cockpitLineupStatus: { status: "open"; message: string; } | { status: "warning"; message: string; } | { status: "ready"; message: string; };
  cockpitMatchdayAdvanceStatus: { status: "applied"; message: string; } | { status: "blocked"; message: string; } | { status: "ready"; message: string; } | { status: "open"; message: string; };
  cockpitMatchdayMvpScoringStatus: { status: "open"; message: string; } | { status: "blocked"; message: string; } | { status: "applied"; message: string; } | { status: "warning"; message: string; } | { status: "ready"; message: string; };
  cockpitOverallStatus: "Matchday offen" | "Matchday abgeschlossen" | "bereit fuer Matchday-Abschluss" | "bereit fuer Cash Apply" | "bereit fuer Standings Apply" | "bereit fuer Result Apply" | "bereit fuer AI-Lineup-Save" | "Warnings offen" | "blockiert";
  cockpitPrizePreviewStatus: { status: "open"; message: string; } | { status: "blocked"; message: string; } | { status: "ready"; message: string; } | { status: "warning"; message: string; };
  cockpitQuickLinks: { id: FoundationView; label: string; }[];
  cockpitResolveStatus: { status: "open"; message: string; } | { status: "ready"; message: string; } | { status: "blocked"; message: string; } | { status: "warning"; message: string; };
  cockpitResultApplyStatus: { status: "applied"; message: string; } | { status: "blocked"; message: string; } | { status: "ready"; message: string; } | { status: "open"; message: string; };
  cockpitSaveStatus: { status: "blocked"; message: string; } | { status: "ready"; message: string; } | { status: "warning"; message: string; };
  cockpitSeasonSnapshotStatus: { status: "blocked"; message: string; } | { status: "applied"; message: string; } | { status: "ready"; message: string; } | { status: "open"; message: string; };
  cockpitStandingsApplyStatus: { status: "applied"; message: string; } | { status: "blocked"; message: string; } | { status: "ready"; message: string; } | { status: "open"; message: string; };
  cockpitStandingsPreviewStatus: { status: "open"; message: string; } | { status: "warning"; message: string; } | { status: "ready"; message: string; };
  cockpitTransfermarktStatus: { status: "blocked"; message: string; } | { status: "open"; message: string; } | { status: "warning"; message: string; } | { status: "ready"; message: string; };
  cockpitWholeSeasonDryRunStatus: { status: "open"; message: string; } | { status: "blocked"; message: string; } | { status: "applied"; message: string; } | { status: "warning"; message: string; } | { status: "ready"; message: string; };
  currentMatchdayDisciplineSchedule: SeasonDisciplineScheduleEntry | null;
  currentMatchdayDisplayLabel: string;
  currentSeasonCashPrizeApplyLogs: CashPrizeApplyLogRecord[];
  enableAiLineupApplyForAiTeams: () => Promise<void>;
  featureAuditFilter: FeatureAuditFilter;
  featureAuditMatrix: FeatureAuditMatrix;
  filteredFeatureAuditEntries: FeatureAuditEntry[];
  gameState: GameState;
  getBusyActionReason: (task: string) => string;
  getCockpitBusyReason: () => string;
  getReadOnlyActionReason: (action: string) => string;
  getTableColumnWidth: (tableId: string, column: FoundationTableColumn) => number;
  getTableHeaderDragProps: (tableId: string, column: FoundationTableColumn, columns: FoundationTableColumn[]) => { draggable: boolean; onDragStart: (event: React.DragEvent<HTMLTableCellElement>) => void; onDragOver: (event: React.DragEvent<HTMLTableCellElement>) => void; onDrop: (event: React.DragEvent<HTMLTableCellElement>) => void; onDragEnd: () => void; };
  historyFeed: FoundationTransferHistoryResponse | null;
  isSaveBusy: boolean;
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault?: boolean) => boolean;
  lineupModifierStatusSummary: { formCardSourceStatus: "ready"; formCardEffectStatus: "ready"; mutatorSourceStatus: "ready"; mutatorEffectStatus: "ready"; selectedFormCards: number; selectedMutators: number; };
  lineupStatusSummary: { totalTeams: number; readyTeams: number; missingTeams: number; incompleteTeams: number; };
  localSeasonTransitionGate: { gamePhase: GamePhase; canCompleteSeason: boolean; disabledReason: string | null; lastMatchdayId: string; };
  manualTeams: Team[];
  marketBuyPreview: TransfermarktBuySummary | null;
  marketFeed: FoundationTransfermarktResponse | null;
  marketSelectedTeam: Team | null;
  matchdayAdvanceFeed: FoundationApplySummary | null;
  matchdayAutoRunFeed: FoundationMatchdayAutoRunSummary | null;
  matchdayAutoRunIncludeWarningLineups: boolean;
  matchdayAutoRunOverwriteExistingLineups: boolean;
  matchdayAutoRunStopOnTie: boolean;
  matchdayMvpForceReplaceExisting: boolean;
  matchdayMvpScoringFeed: FoundationMatchdayMvpScoringResponse | null;
  moveTableColumn: (tableId: string, columnId: string, direction: "left" | "right", columns: FoundationTableColumn[]) => void;
  multiSeasonBalanceDashboard: MultiSeasonBalanceDashboard;
  multiSeasonEconomyColumns: FoundationTableColumn[];
  multiSeasonGameplayColumns: FoundationTableColumn[];
  multiSeasonPlayerColumns: FoundationTableColumn[];
  multiSeasonTeamBalanceColumns: FoundationTableColumn[];
  openPlayerDrawerById: (playerId: string, activePlayerId?: string | null) => Promise<void>;
  openTeamProfileById: (teamId: string) => void;
  passiveTeams: Team[];
  preSeasonWorkflowBusy: boolean;
  preSeasonWorkflowError: string | null;
  preSeasonWorkflowFeed: PreSeasonWorkflowSummaryResponse | null;
  prizeApplyState: { status: "applied"; label: string; } | { status: "blocked"; label: string; } | { status: "open"; label: string; } | { status: "warning"; label: string; } | { status: "ready"; label: string; };
  prizeAuditCompact: { largeRankChanges: number; missingSourceTeams: number; };
  prizePreviewFeed: FoundationPrizePreviewResponse | null;
  readMeta: FoundationReadMeta;
  readSourceLabel: "Referenzmodus" | "Lokaler Spielstand";
  refreshSeasonCockpit: () => Promise<void>;
  reloadPrizePreviewFeed: () => Promise<FoundationPrizePreviewResponse | null>;
  reloadResolvePreview: (signal?: AbortSignal) => Promise<FoundationResolvePreviewResponse | null>;
  reloadStandingsPreviewFeed: (signal?: AbortSignal) => Promise<FoundationStandingsPreviewResponse | null>;
  renderMultiSeasonEconomyCell: (row: MultiSeasonBalanceEconomyRow, columnId: string) => string | React.JSX.Element;
  renderMultiSeasonGameplayCell: (row: MultiSeasonBalanceGameplayRow, columnId: string) => string | React.JSX.Element;
  renderMultiSeasonPlayerCell: (row: MultiSeasonBalancePlayerRow, columnId: string) => string | number | React.JSX.Element;
  renderMultiSeasonTeamCell: (row: MultiSeasonBalanceTeamRow, columnId: string) => string | number | React.JSX.Element;
  resetTableColumnWidth: (tableId: string, column: FoundationTableColumn) => void;
  resetTableLayout: (tableId: string, columns: FoundationTableColumn[], preset?: FoundationTablePreset) => void;
  resolvePreviewFeed: FoundationResolvePreviewResponse | null;
  resultApplyFeed: FoundationApplySummary | null;
  rosterFillBusy: boolean;
  rosterFillFeed: FoundationAutoRosterFillResponse | null;
  runCockpitAiLineupBatchApply: (execute: boolean) => Promise<FoundationAiLineupBatchApplyResponse | null>;
  runCockpitCashApply: (execute: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitMatchdayAdvance: (execute: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitMatchdayAutoRun: (execute: boolean) => Promise<FoundationMatchdayAutoRunSummary | null>;
  runCockpitMatchdayMvpScoring: (execute: boolean) => Promise<{ error: string | undefined; source: "sqlite"; dryRun: boolean; executed: boolean; status: "ready" | "warning" | "blocked" | "applied"; scope: { saveId: string; seasonId: string; matchdayId: string; }; targetMatchday: { matchdayId: string; label: string; d1DisciplineId: string | null; d1DisciplineName: string | null; d2DisciplineId: string | null; d2DisciplineName: string | null; }; rosterGate: { teamsBelowMinimum: number; teamsBelowTarget: number; teamsMissingTarget: number; warnings: string[]; }; lineupSummary: { totalTeams: number; existingLineups: number; autoGeneratedLineups: number; blockedTeams: number; }; resolveSources: { formCardSourceStatus: "ready" | "missing_source"; formCardSourceLabel: string | null; mutatorSourceStatus: "ready" | "missing_source"; mutatorSourceLabel: string | null; captainSourceStatus: "mapped" | "missing_source"; fatigueSourceStatus: "mapped" | "missing_source"; teamPpsSourceStatus: "ready" | "missing_source"; }; lineupTeams: FoundationMatchdayMvpLineupTeam[]; resolveStatus: string; mutatorMode: "mvp_forced_mutators"; d1Scoreboard: FoundationMatchdayMvpScoreboardRow[]; d2Scoreboard: FoundationMatchdayMvpScoreboardRow[]; d1TopPlayers: FoundationMatchdayMvpTopPlayerRow[]; d2TopPlayers: FoundationMatchdayMvpTopPlayerRow[]; ppWinners: FoundationMatchdayMvpTopPlayerRow[]; totalTeamsScored: number; resultApply: { applied: boolean; matchdayResultId: string | null; replacedExisting: boolean; }; standingsApply: { applied: boolean; auditLogId: string | null; }; warnings: string[]; blockingReasons: string[]; } | null>;
  runCockpitResultApply: (execute: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitRosterFill: (execute: boolean) => Promise<FoundationAutoRosterFillResponse | null>;
  runCockpitStandingsApply: (execute: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitWholeSeasonDryRun: () => Promise<FoundationWholeSeasonDryRunSummary | null>;
  runPreSeasonNextSeasonSetup: () => Promise<PreSeasonWorkflowApiResponse | null>;
  runPreSeasonWorkflowPreview: () => Promise<PreSeasonWorkflowApiResponse | null>;
  runSaveAction: (body: SaveActionRequest) => Promise<void>;
  runSeasonCompletion: (execute: boolean) => Promise<SeasonCompletionApiResponse | null>;
  runSeasonSnapshotAction: (execute: boolean, options?: { forceCreate?: boolean; replaceExisting?: boolean; }) => Promise<{ error: string | undefined; blockingReasons: string[]; ok: boolean; readOnly: true; source: "sqlite" | "prisma"; dryRun: boolean; canCreate: boolean; seasonCompleted: boolean; duplicateDetected: boolean; sourceStatus: "mapped" | "partial" | "missing_source"; saveId: string | null; seasonId: string; snapshot: { snapshotId?: string; seasonId: string; seasonName: string; archivedAt: string; status?: "completed" | "partial" | "dry_run"; finalStandings: Array<{ teamId: string; teamCode: string; teamName: string; rank: number | null; points: number | null; cashEnd: number | null; rosterEnd: number; transferNet: number | null; disciplinePointsByArea: { pow: number | null; spe: number | null; men: number | null; soc: number | null; }; }>; playerPerformances: Array<{ playerId: string; }>; transferSnapshots?: Array<{ transferId: string; }>; warnings?: string[]; }; existingSnapshot: { snapshotId?: string; seasonId: string; archivedAt: string; } | null; allTimeTable: Array<{ teamId: string; teamName: string; seasonsPlayed: number; gold: number; silver: number; bronze: number; top5: number; top10: number; avgRank: number | null; totalHistoricalPoints: number | null; }>; coverage: { totalMatchdays: number; resultAppliedMatchdays: number; standingsAppliedMatchdays: number; cashAppliedMatchdays: number; completedMatchdayIds: string[]; missingResultMatchdayIds: string[]; missingStandingsMatchdayIds: string[]; missingCashMatchdayIds: string[]; }; warnings: string[]; applied: boolean; summary?: FoundationSeasonSnapshotSummary; } | null>;
  runSeasonTransition: (action: "preview" | "start_transition") => Promise<SeasonTransitionApiResponse | null>;
  seasonCompletionFeed: SeasonCompletionSummaryResponse | null;
  seasonEndChampionRow: TeamManagementSnapshotRow;
  seasonHistorySnapshots: SeasonSnapshotRecord[];
  seasonSnapshotFeed: FoundationSeasonSnapshotSummary | null;
  seasonStandRows: TeamManagementSnapshotRow[];
  seasonTransitionBusy: boolean;
  seasonTransitionError: string | null;
  seasonTransitionFeed: SeasonTransitionSummaryResponse | null;
  selectedPrizePreviewRow: FoundationPrizePreviewItem | null;
  selectedStandingRow: TeamManagementSnapshotRow | null;
  setActiveView: Dispatch<SetStateAction<FoundationView>>;
  setFeatureAuditFilter: Dispatch<SetStateAction<FeatureAuditFilter>>;
  setFreshSeasonStartMessage: Dispatch<SetStateAction<string | null>>;
  setMatchdayAutoRunIncludeWarningLineups: Dispatch<SetStateAction<boolean>>;
  setMatchdayAutoRunOverwriteExistingLineups: Dispatch<SetStateAction<boolean>>;
  setMatchdayAutoRunStopOnTie: Dispatch<SetStateAction<boolean>>;
  setMatchdayMvpForceReplaceExisting: Dispatch<SetStateAction<boolean>>;
  setTableColumnVisible: (tableId: string, columnId: string, nextVisible: boolean) => void;
  setWholeSeasonIncludeWarningLineups: Dispatch<SetStateAction<boolean>>;
  setWholeSeasonOverwriteExistingLineups: Dispatch<SetStateAction<boolean>>;
  setWholeSeasonStopOnTie: Dispatch<SetStateAction<boolean>>;
  sortedMultiSeasonEconomyRows: MultiSeasonBalanceEconomyRow[];
  sortedMultiSeasonGameplayRows: MultiSeasonBalanceGameplayRow[];
  sortedMultiSeasonPlayerRows: MultiSeasonBalancePlayerRow[];
  sortedMultiSeasonTeamRows: MultiSeasonBalanceTeamRow[];
  standingsApplyFeed: FoundationApplySummary | null;
  standingsPreviewFeed: FoundationStandingsPreviewResponse | null;
  startTableColumnResize: (tableId: string, column: FoundationTableColumn, event: React.MouseEvent<HTMLSpanElement>) => void;
  tableSorts: Record<string, SortState>;
  toggleTableSort: (tableId: string, columnKey: string) => void;
  visibleMultiSeasonEconomyColumns: FoundationTableColumn[];
  visibleMultiSeasonGameplayColumns: FoundationTableColumn[];
  visibleMultiSeasonPlayerColumns: FoundationTableColumn[];
  visibleMultiSeasonTeamBalanceColumns: FoundationTableColumn[];
  wholeSeasonDryRunFeed: FoundationWholeSeasonDryRunSummary | null;
  wholeSeasonIncludeWarningLineups: boolean;
  wholeSeasonOverwriteExistingLineups: boolean;
  wholeSeasonStopOnTie: boolean;
  ColumnVisibilityManager: ({ title, columns, presets, activePreset, isVisible, onToggle, onMove, getWidth, onStepWidth, onResetWidth, onApplyPreset, onResetToDefault, }: { title: string; columns: FoundationTableColumn[]; presets?: FoundationTablePreset[]; activePreset?: FoundationTablePresetId | null; isVisible: (columnId: string, visibleByDefault?: boolean) => boolean; onToggle: (columnId: string, nextVisible: boolean) => void; onMove?: (columnId: string, direction: "left" | "right") => void; getWidth?: (column: FoundationTableColumn) => number; onStepWidth?: (column: FoundationTableColumn, delta: number) => void; onResetWidth?: (column: FoundationTableColumn) => void; onApplyPreset?: (presetId: Exclude<FoundationTablePresetId, "custom">) => void; onResetToDefault?: () => void; }) => React.JSX.Element;
  formatFeatureAuditStatus: (status: FeatureAuditStatus) => "Geplant" | "Preview" | "Local Write" | "Sandbox" | "Multiplayer" | "Prod";
  formatLocalePoints: (value: number | null | undefined, maximumFractionDigits?: number) => string;
  formatMoney: (value: number) => string;
  formatNullableMoney: (value: number | null | undefined) => string;
  formatSignedNumber: (value: number | null | undefined, digits?: number) => string;
  getPlayerPortraitModel: (player: Pick<Player, "id" | "name" | "portraitUrl" | "portraitPath">) => { src: string | null; thumbSrc: string | null; previewSrc: string | null; initials: string; };
  inferSaveTypeLabel: (value: { saveName?: string | null; saveStatus?: string | null; } | SaveSummary | null | undefined) => "Smoke" | "Fresh Season" | "DryRun" | "Template" | "Arbeitsstand";
  PlayerPortrait: ({ src, initials, alt, className, style, loading, fetchPriority, }: { src: string | null; initials: string; alt: string; className: string; style?: CSSProperties; loading?: "eager" | "lazy"; fetchPriority?: "high" | "low" | "auto"; }) => React.JSX.Element;
  SEASON_TRANSITION_STATIC_STEPS: SeasonTransitionStepResponse[];
  SortableHeader: ({ label, tableId, columnKey, sortState, onToggle, tooltip, }: { label: string; tableId: string; columnKey: string; sortState?: SortState; onToggle: (tableId: string, columnKey: string) => void; tooltip?: string | null; }) => React.JSX.Element;
  syncFoundationViewInUrl: (view: FoundationView, tab?: string | null, playerId?: string | null, options?: { panel?: FoundationPanelId; push?: boolean; facilityId?: string | null; facilityAction?: string | null; team?: string | null; }) => void;
}

export default function FoundationCockpitPanel(props: FoundationCockpitPanelProps) {
  const {
    cockpitAiBatchApplyFeed,
    cockpitAiIncludeWarningTeams,
    cockpitAiOverwriteExisting,
    cockpitBusyKey,
    setCockpitAiIncludeWarningTeams,
    setCockpitAiOverwriteExisting,
    setCockpitBusyKey,
  } = useFoundationShared();
  const {
    activeSaveId,
    activeSaveName,
    activeSaveSummary,
    activeView,
    adjustTableColumnWidth,
    aiLineupApplyTeams,
    aiTeams,
    canonicalSeasonLabel,
    cashApplyFeed,
    cockpitAiLineupStatus,
    cockpitAutoRunStatus,
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
    currentMatchdayDisciplineSchedule,
    currentMatchdayDisplayLabel,
    currentSeasonCashPrizeApplyLogs,
    enableAiLineupApplyForAiTeams,
    featureAuditFilter,
    featureAuditMatrix,
    filteredFeatureAuditEntries,
    gameState,
    getBusyActionReason,
    getCockpitBusyReason,
    getReadOnlyActionReason,
    getTableColumnWidth,
    getTableHeaderDragProps,
    historyFeed,
    isSaveBusy,
    isTableColumnVisible,
    lineupModifierStatusSummary,
    lineupStatusSummary,
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
    multiSeasonBalanceDashboard,
    multiSeasonEconomyColumns,
    multiSeasonGameplayColumns,
    multiSeasonPlayerColumns,
    multiSeasonTeamBalanceColumns,
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
    refreshSeasonCockpit,
    reloadPrizePreviewFeed,
    reloadResolvePreview,
    reloadStandingsPreviewFeed,
    renderMultiSeasonEconomyCell,
    renderMultiSeasonGameplayCell,
    renderMultiSeasonPlayerCell,
    renderMultiSeasonTeamCell,
    resetTableColumnWidth,
    resetTableLayout,
    resolvePreviewFeed,
    resultApplyFeed,
    rosterFillBusy,
    rosterFillFeed,
    runCockpitAiLineupBatchApply,
    runCockpitCashApply,
    runCockpitMatchdayAdvance,
    runCockpitMatchdayAutoRun,
    runCockpitMatchdayMvpScoring,
    runCockpitResultApply,
    runCockpitRosterFill,
    runCockpitStandingsApply,
    runCockpitWholeSeasonDryRun,
    runPreSeasonNextSeasonSetup,
    runPreSeasonWorkflowPreview,
    runSaveAction,
    runSeasonCompletion,
    runSeasonSnapshotAction,
    runSeasonTransition,
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
    setFeatureAuditFilter,
    setFreshSeasonStartMessage,
    setMatchdayAutoRunIncludeWarningLineups,
    setMatchdayAutoRunOverwriteExistingLineups,
    setMatchdayAutoRunStopOnTie,
    setMatchdayMvpForceReplaceExisting,
    setTableColumnVisible,
    setWholeSeasonIncludeWarningLineups,
    setWholeSeasonOverwriteExistingLineups,
    setWholeSeasonStopOnTie,
    sortedMultiSeasonEconomyRows,
    sortedMultiSeasonGameplayRows,
    sortedMultiSeasonPlayerRows,
    sortedMultiSeasonTeamRows,
    standingsApplyFeed,
    standingsPreviewFeed,
    startTableColumnResize,
    tableSorts,
    toggleTableSort,
    visibleMultiSeasonEconomyColumns,
    visibleMultiSeasonGameplayColumns,
    visibleMultiSeasonPlayerColumns,
    visibleMultiSeasonTeamBalanceColumns,
    wholeSeasonDryRunFeed,
    wholeSeasonIncludeWarningLineups,
    wholeSeasonOverwriteExistingLineups,
    wholeSeasonStopOnTie,
    ColumnVisibilityManager,
    formatFeatureAuditStatus,
    formatLocalePoints,
    formatMoney,
    formatNullableMoney,
    formatSignedNumber,
    getPlayerPortraitModel,
    inferSaveTypeLabel,
    PlayerPortrait,
    SEASON_TRANSITION_STATIC_STEPS,
    SortableHeader,
    syncFoundationViewInUrl,
  } = props;

  return (
    <section className="panel" id="foundation-cockpit" data-testid="foundation-cockpit">
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
                            {matchdayAutoRunFeed.steps.map((step: FoundationMatchdayAutoRunSummary["steps"][number]) => (
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
                              const logo = championTeam ? getTeamLogoModel(championTeam, { variant: "thumb" }) : null;
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
                                      {portrait?.thumbSrc ?? portrait?.src ? (
                                        <PlayerPortrait
                                          src={portrait.thumbSrc ?? portrait.src}
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
  );
}
