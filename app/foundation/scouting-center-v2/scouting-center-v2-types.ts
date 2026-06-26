import type { PlayerPotentialBand } from "@/lib/data/olyDataTypes";

export type ScoutingHubV2WatchTarget = {
  playerId: string;
  playerName: string;
  className: string;
  marketValue: string;
  baseInfoSummary: string;
  pow?: number | null;
  spe?: number | null;
  men?: number | null;
  soc?: number | null;
  caOverall?: number | null;
  caPow?: number | null;
  caSpe?: number | null;
  caMen?: number | null;
  caSoc?: number | null;
  caDisplay?: string | null;
  poDisplay?: string | null;
  poMin?: number | null;
  poMax?: number | null;
  poPow?: number | null;
  poSpe?: number | null;
  poMen?: number | null;
  poSoc?: number | null;
  potentialGap?: number | null;
  potentialScore?: number | null;
  potentialBand?: PlayerPotentialBand | null;
  scoutStatus?: "active" | "bookmarked";
  scoutCertainty?: number | null;
  scoutSourceLabel?: string | null;
  scoutMilestone?: string | null;
};

export type ScoutingHubV2PipelineRecord = {
  playerId: string;
  playerName: string;
  source: string;
  certainty: number;
};

export type ScoutingHubV2PipelineSummary = {
  occupiedSlots: number;
  maxSlots: number;
  tickGain: number;
  passiveActive: number;
  draftSuspended?: boolean;
  records: ScoutingHubV2PipelineRecord[];
};

export type ScoutingHubV2TabId = "overview" | "reports" | "recommended";

export type ScoutingHubV2ClientProps = {
  teamName: string;
  scoutingFacilityLevel: number;
  scoutingFacilityLabel: string;
  recruitmentBudget: string;
  rosterCount: number;
  rosterMinimum: number | null;
  rosterOptimum: number | null;
  draftContextNote: string;
  disclosureLevel: number;
  visibleAtTier: string[];
  hiddenAtTier: string[];
  baseInfoAlwaysVisible: string[];
  activeScoutTargets: ScoutingHubV2WatchTarget[];
  bookmarkedTargets?: ScoutingHubV2WatchTarget[];
  /** @deprecated use activeScoutTargets */
  watchTargets?: ScoutingHubV2WatchTarget[];
  scoutPipeline?: ScoutingHubV2PipelineSummary | null;
  activeTab?: ScoutingHubV2TabId;
  onActiveTabChange?: (tab: ScoutingHubV2TabId) => void;
  hideSubNav?: boolean;
  onOpenMarket: () => void;
  onOpenPlayer: (playerId: string) => void;
};

/** @deprecated Use ScoutingHubV2ClientProps — kept for import stability during preview rollout */
export type ScoutingCenterV2ClientProps = ScoutingHubV2ClientProps;
