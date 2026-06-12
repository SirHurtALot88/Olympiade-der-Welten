import type { DisciplineSide, LegacyLineupEntryInput, LegacyLineupScoreResult } from "@/lib/lineups/legacy-lineup-types";

export type AiNeedAxis = "pow" | "spe" | "men" | "soc";

export type AiDisciplineNeedSummary = {
  disciplineId: string | null;
  disciplineSide: DisciplineSide;
  averageDisciplineScore: number;
  needScore: number;
  playerCount: number;
  keyAttributes: string[];
  focusAxes: AiNeedAxis[];
};

export type AiNeedsSummary = {
  teamId: string;
  matchdayId: string;
  rosterPressure: {
    rosterCount: number;
    rosterGap: number;
    rosterFillPressure: number;
    budgetPressure: number;
    upkeepPressure: number;
  };
  axisDeficits: Record<AiNeedAxis, number>;
  d1NeedSummary: AiDisciplineNeedSummary;
  d2NeedSummary: AiDisciplineNeedSummary;
  recommendedPriority: "d1" | "d2" | "balanced";
  warnings: string[];
};

export type AiLegacyLineupSuggestion = {
  entries: LegacyLineupEntryInput[];
  scorePreview: LegacyLineupScoreResult;
  needsSummary: AiNeedsSummary;
  warnings: string[];
  debugReasoning: string[];
};

export type AiLegacyLineupPreviewStatus = "ready" | "incomplete_roster" | "missing_scores" | "blocked";
export type AiCaptainSelectionStatus =
  | "selected"
  | "skipped_limit_reached"
  | "skipped_not_needed"
  | "blocked_policy";

export type AiLegacyLineupSelectedPlayer = {
  playerId: string;
  activePlayerId: string | null;
  name: string | null;
  isCaptain: boolean;
  baseScore: number | null;
  fatigueCount: number | null;
  fatigueMultiplier: number | null;
  fatigueAdjustedScore: number | null;
  captainBonus: number | null;
  finalContribution: number | null;
};

export type AiLegacyLineupSuggestionSide = {
  disciplineId: string | null;
  disciplineSide: DisciplineSide;
  disciplineName: string | null;
  status: AiLegacyLineupPreviewStatus;
  requiredPlayers: number;
  selectedPlayers: number;
  missingSlots: number;
  captainActivePlayerId: string | null;
  captainPlayerId: string | null;
  captainName: string | null;
  captainSlotsUsed: number;
  captainSlotsRemaining: number;
  captainSelectionStatus: AiCaptainSelectionStatus | null;
  expectedBaseScore: number | null;
  expectedCaptainBonus: number | null;
  expectedScore: number;
  teamDisciplineRank: number | null;
  rankSourceStatus: string | null;
  selectedEntries: AiLegacyLineupSelectedPlayer[];
  fatigueWarnings: string[];
  warnings: string[];
  reasoning: string[];
};

export type AiLegacyLineupPreview = {
  source: "sqlite" | "prisma";
  readOnly: boolean;
  teamId: string;
  teamCode: string;
  teamName: string;
  matchdayId: string;
  status: AiLegacyLineupPreviewStatus;
  captainRuleStatus: string;
  captainSlotsUsed: number;
  captainSlotsRemaining: number;
  totalExpectedScore: number;
  expectedScore: number;
  warnings: string[];
  explanation: string;
  debugReasoning: string[];
  d1: AiLegacyLineupSuggestionSide;
  d2: AiLegacyLineupSuggestionSide;
  entries: LegacyLineupEntryInput[];
  scorePreview: LegacyLineupScoreResult;
};
