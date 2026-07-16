import type { PlayerPotentialBand, TeamStrategyBias } from "@/lib/data/olyDataTypes";

export type TeamDetailDrawerPlayerCard = {
  playerId: string;
  activePlayerId: string;
  name: string;
  portraitUrl: string | null;
  portraitInitials: string;
  roleTag: string | null;
  promisedRole: string | null;
  className: string | null;
  race: string | null;
  ovr: number | null;
  ovrRank: number | null;
  mvs: number | null;
  mvsRank: number | null;
  pps: number | null;
  ppsRank: number | null;
  marketValue: number | null;
  marketValueDelta: number | null;
  salary: number | null;
  salaryDelta: number | null;
  contractLength: number | null;
  d1Label: string;
  d1Score: number | null;
  d2Label: string;
  d2Score: number | null;
  coreStats: {
    pow: number | null;
    powRank: number | null;
    spe: number | null;
    speRank: number | null;
    men: number | null;
    menRank: number | null;
    soc: number | null;
    socRank: number | null;
  };
  issueTags: string[];
  demands: Array<{
    demandId: string;
    label: string;
    detail: string;
    status: "open" | "fulfilled" | "at_risk" | "failed";
    priority: "low" | "medium" | "high";
    targetDisciplineId?: string | null;
    moraleReward: number;
    moralePenalty: number;
  }>;
  topDisciplines: Array<{ label: string; value: number | null }>;
  potential?: number | null;
  potentialBand?: PlayerPotentialBand | null;
  /** "Neuer Look" CA/PO-Sterne (Tier-3 Rosterkarten) — fog-korrekt, siehe `buildRosterCaPoStarFields`. */
  known?: boolean;
  caStars?: number | null;
  poStarRange?: { min: number; max: number } | null;
  caScore?: number | null;
  poScoreRange?: { min: number; max: number } | null;
};

export type TeamDetailDrawerHistoryRow = {
  seasonId: string;
  seasonName: string;
  isLive: boolean;
  rank: number | null;
  points: number | null;
  pps: number | null;
  ppPow: number | null;
  ppSpe: number | null;
  ppMen: number | null;
  ppSoc: number | null;
  cash: number | null;
  salaryTotal: number | null;
  marketValue: number | null;
  guv: number | null;
  topBuyPlayer: string | null;
  topBuyPlayerId: string | null;
  topBuyAmount: number | null;
  topSellPlayer: string | null;
  topSellPlayerId: string | null;
  topSellAmount: number | null;
  topSellProfit: number | null;
  injuriesCount: number | null;
  averageFatigue: number | null;
  disciplineValues: Partial<Record<string, number | null>>;
};

export type TeamDetailDrawerData = {
  teamId: string;
  teamName: string;
  shortCode: string;
  logoUrl: string | null;
  logoInitials: string;
  controlMode: "manual" | "ai" | "passive";
  generalManager: {
    name: string;
    title: string;
    description: string;
    pow: number;
    spe: number;
    men: number;
    soc: number;
    influencePct: number;
    playerOptDelta: number;
    marketDoctrine: string;
    lineupDoctrine: string;
    facilityPriorities: string[];
    bias: Partial<TeamStrategyBias>;
  } | null;
  rosterSize: number;
  cash: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
  powRank: number | null;
  speRank: number | null;
  menRank: number | null;
  socRank: number | null;
  contractSummaries: Array<{ label: string; salary: number | null }>;
  boardConfidence: {
    value: number;
    pressure: number;
    warnings: string[];
  } | null;
  relationships: {
    allies: Array<{
      teamId: string;
      teamName: string;
      shortCode: string;
      value: number;
      baseValue: number;
      delta: number;
      changed: boolean;
      changeLabel: string | null;
      reasons: string[];
    }>;
    rivals: Array<{
      teamId: string;
      teamName: string;
      shortCode: string;
      value: number;
      baseValue: number;
      delta: number;
      changed: boolean;
      changeLabel: string | null;
      reasons: string[];
    }>;
  };
  objectives: Array<{
    objectiveId: string;
    label: string;
    detail?: string | null;
    actionHint?: string | null;
    category: string;
    targetValue: number | string | boolean | null;
    currentValue: number | string | boolean | null;
    status: "open" | "completed" | "failed" | "at_risk";
  }>;
  teamCaptain: {
    playerId: string;
    playerName: string;
    leadershipScore: number;
    style: string;
    effects: {
      moraleBuffer: number;
      rivalryPressureReductionPct: number;
      teamPowerModifierPct: number;
      conflictSoftenChancePct: number;
    };
    traitSignals: string[];
  } | null;
  history: TeamDetailDrawerHistoryRow[];
  players: TeamDetailDrawerPlayerCard[];
};
