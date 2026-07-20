import type { LegacyMutatorSlotEffect, LegacyResolveMutatorMode } from "@/lib/lineups/legacy-lineup-types";
import type { TeamPowerEffectType, TeamPowerTargetMode } from "@/lib/data/olyDataTypes";

export type ResolveHighlightType =
  | "best_player_discipline"
  | "strongest_team_score"
  | "closest_score_gap"
  | "missing_lineup_warning"
  | "injury_event";

export type ResolvePreviewStatus =
  | "ready"
  | "incomplete_lineups"
  | "missing_lineups"
  | "missing_scores"
  | "missing_sources"
  | "blocked";

export type PlayerPerformancePreview = {
  matchdayId: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  teamId: string;
  playerId: string;
  activePlayerId?: string | null;
  playerName: string;
  slotIndex: number;
  baseValue: number;
  fatigueAdjustedValue?: number | null;
  captainBonus?: number | null;
  mutatorBonus?: number | null;
  mutatorPpsBonus?: number | null;
  formShare?: number | null; // pro Spieler angewandter Form-Anteil (flach + Jitter)
  finalPlayerScore: number;
  scoreContribution: number;
  pointsAwarded: number | null;
  pointSource: string;
  rankInTeam: number;
  rankInDiscipline: number;
  isTop10: boolean;
  isMvpCandidate: boolean;
  storyWeight?: number;
};

export type DisciplineHighlightCandidate = {
  matchdayId: string;
  disciplineId: string;
  highlightType: ResolveHighlightType;
  teamId?: string;
  playerId?: string;
  relatedTeamId?: string;
  importanceScore: number;
  shortSummary?: string;
  payload: Record<string, unknown>;
};

export type DisciplineTeamResolvePreview = {
  teamId: string;
  teamName: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  status: ResolvePreviewStatus;
  baseScore: number;
  fatigueModifier: number | null;
  fatigueStatus: "mapped" | "missing_source";
  intensity?: "conserve" | "normal" | "push" | null;
  intensityModifier?: number | null;
  captainStatus: "mapped" | "missing_source";
  captainBonus: number | null;
  formCardStatus: "ready" | "missing_source";
  formCardLabel: string | null;
  formModifier: number | null;
  mutatorMode: LegacyResolveMutatorMode;
  mutatorModifier: number | null;
  mutatorSlots: LegacyMutatorSlotEffect[];
  teamPowerStatus?: "ready" | "missing_source";
  teamPowerLabel?: string | null;
  teamPowerModifier?: number | null;
  teamPowerImpact?: number | null;
  teamPowerBasePct?: number | null;
  teamPowerConditionalPct?: number | null;
  teamPowerAttributeFitPct?: number | null;
  teamPowerEffectType?: TeamPowerEffectType | null;
  teamPowerTargetMode?: TeamPowerTargetMode | null;
  teamPowerTargetLimit?: number | null;
  teamPpsModifier: number | null;
  teamPpsStatus: "ready" | "missing_source";
  finalPreviewScore: number;
  score: number;
  rank: number;
  teamPoints: number | null;
  pointSource: string;
  warnings: string[];
  missingLineup: boolean;
  missingPlayers: number;
  isComplete: boolean;
  missingScores: string[];
  entries: Array<{
    playerId: string;
    activePlayerId: string | null;
    playerName: string;
    slotIndex: number;
    baseValue: number | null;
    fatigueAdjustedValue: number | null;
    captainBonus: number | null;
    mutatorBonus?: number | null;
    mutatorPpsBonus?: number | null;
    formShare?: number | null; // pro Spieler angewandter Form-Anteil (flach + Jitter)
    finalPlayerScore: number | null;
    pointsAwarded?: number | null;
    isCaptain: boolean;
    warnings: string[];
  }>;
};

export type DisciplineResolvePreview = {
  disciplineId: string;
  disciplineName: string;
  disciplineSide: "d1" | "d2";
  teamResults: DisciplineTeamResolvePreview[];
  topPlayers: PlayerPerformancePreview[];
  highlightCandidates: DisciplineHighlightCandidate[];
};

export type TeamResolvePreview = {
  teamId: string;
  teamName: string;
  status: ResolvePreviewStatus;
  d1DisciplineId: string | null;
  d1Status: ResolvePreviewStatus;
  d1Score: number;
  d1Points: number | null;
  d2DisciplineId: string | null;
  d2Status: ResolvePreviewStatus;
  d2Score: number;
  d2Points: number | null;
  totalScore: number;
  totalPoints: number | null;
  rank: number;
  warnings: string[];
  missingLineup: boolean;
  missingScores: string[];
};

export type LegacyMatchdayResolvePreview = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  status: ResolvePreviewStatus;
  disciplinePreviews: DisciplineResolvePreview[];
  teamResults: TeamResolvePreview[];
  warnings: string[];
  missingLineups: Array<{
    teamId: string;
    teamName: string;
  }>;
  incompleteLineups: Array<{
    teamId: string;
    teamName: string;
    disciplineSide: "d1" | "d2";
  }>;
  missingScores: string[];
};
