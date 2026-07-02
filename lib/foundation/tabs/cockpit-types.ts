/**
 * Cockpit type cluster (Strangler Phase 1.2).
 *
 * These response/summary/view types are still authored inside
 * `FoundationPageClient.tsx`. This barrel re-exports them under a stable
 * import path so the extracted cockpit panel/host (and future consumers)
 * do not import from the giant page component directly. When the definitions
 * are later moved into this module, consumers stay untouched — only the
 * re-export below flips to a local declaration.
 */
export type {
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
} from "@/app/foundation/FoundationPageClient";
