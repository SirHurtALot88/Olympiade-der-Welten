export type ScoutingHubV2WatchTarget = {
  playerId: string;
  playerName: string;
  className: string;
  marketValue: string;
  baseInfoSummary: string;
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
  records: ScoutingHubV2PipelineRecord[];
};

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
  watchTargets: ScoutingHubV2WatchTarget[];
  scoutPipeline?: ScoutingHubV2PipelineSummary | null;
  onOpenMarket: () => void;
  onOpenHomeV2: () => void;
  onOpenPlayer: (playerId: string) => void;
};

/** @deprecated Use ScoutingHubV2ClientProps — kept for import stability during preview rollout */
export type ScoutingCenterV2ClientProps = ScoutingHubV2ClientProps;
