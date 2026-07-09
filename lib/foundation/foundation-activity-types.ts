export type FoundationActivityTone = "running" | "success" | "warning" | "blocked" | "info";

export type FoundationActivityItem = {
  id: string;
  label: string;
  detail?: string;
  tone: FoundationActivityTone;
  progressPct?: number | null;
};

export type FoundationActivityPreseasonRunSnapshot = {
  status: "running" | "completed" | "failed" | "skipped";
  mode: "setup_draft" | "season_market" | "none";
  aiTeamsTotal: number;
  aiTeamsCompleted: number;
  transferBuysApplied: number;
  transferSellsApplied: number;
  managerActionsApplied: number;
  blockingReasons: string[];
};

export type FoundationActivityAdminSimulationSnapshot = {
  status: "idle" | "running" | "paused" | "completed" | "blocked" | "cancelled";
  currentOperation: string;
  progressPct: number;
  activePhase: string;
};

export type FoundationActivityLineupEnsureSnapshot = {
  totalTeams: number;
  readyTeams: number;
  savedTeams: number;
  existingLineups: number;
  blockedTeams: number;
  totalMs?: number | null;
};

export type FoundationActivityInput = {
  isSaveBusy: boolean;
  aiPreseasonBusy: boolean;
  aiPreseasonRun: FoundationActivityPreseasonRunSnapshot | null;
  aiLineupEnsureBusy: boolean;
  aiLineupEnsure: FoundationActivityLineupEnsureSnapshot | null;
  adminSimulationBusy: boolean;
  adminSimulationRun: FoundationActivityAdminSimulationSnapshot | null;
  seasonTransitionBusy: boolean;
  preSeasonWorkflowBusy: boolean;
  seasonStartResetBusy: boolean;
  newGameBusy: boolean;
  rosterFillBusy: boolean;
  adminBalancingBusy: boolean;
  cockpitBusyKey: string | null;
  aiTeamsCount: number;
  marketBuyBusy?: boolean;
  marketSellBusy?: boolean;
  contractRenewalBusy?: boolean;
  sponsorChoiceBusy?: boolean;
  facilityUpgradeBusy?: boolean;
  facilityMaintenanceBusy?: boolean;
  assignTeamCaptainBusy?: boolean;
  marketAiPreviewBusy?: boolean;
  liveSyncStatus?: "connected" | "syncing" | "reconnecting" | "disconnected" | "idle";
  fetchSlowWarning?: boolean;
  showIdleReady?: boolean;
};
