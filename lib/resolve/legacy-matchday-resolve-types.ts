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
  // Same-day injury malus (siehe lib/fatigue/fatigue-calibration.ts INJURY_PERFORMANCE_MULTIPLIER),
  // angewandt NACH Fatigue: injuryAdjustedValue = fatigueAdjustedValue * INJURY_PERFORMANCE_MULTIPLIER,
  // sofern injuryApplied true ist. Für die Arena-Bühne (optisches Verletzungs-Feedback +
  // Score-Aufschlüsselung), siehe lib/foundation/discipline-stage/discipline-stage-from-preview.ts.
  injuryApplied?: boolean;
  injuryAdjustedValue?: number | null;
  captainBonus?: number | null;
  mutatorBonus?: number | null;
  mutatorPpsBonus?: number | null;
  formShare?: number | null; // pro Spieler angewandter Form-Anteil (flach + Jitter)
  /** Sein eigener Intensitaets-Wurf (schonen/normal/pushen), seeded pro Spieler und Spieltag. */
  intensityShare?: number | null;
  /** Der Modifikator SEINER Slot-Rolle (Clutch Shot, Fastbreak und so weiter). */
  slotRoleShare?: number | null;
  /** Sein anteiliger Teil der echten Seiten-Effekte: Team-Power, Mutator-Rest, Rundung. */
  teamEffectShare?: number | null;
  /** Sein anteiliger Teil der Team-Power — eigenes Feld, damit die Buehne sie benennen kann. */
  teamPowerShare?: number | null;
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
  /**
   * Battle Mode PR7 (docs/design/battle-mode-spielmodus-plan.md, Abschnitt 2.4): woher `teamPoints`
   * stammt — `"pps"` (Standard, jede Manager-Mode-Disziplin und jede Nicht-Basketball-Disziplin in
   * Battle Mode) oder `"arena"` (Battle-Mode-Basketball, `teamPoints` kommt aus einem echten
   * Arena-Duell, s. lib/resolve/battle-mode-arena-team-points.ts). Fehlt das Feld (aeltere
   * Preview-Objekte), gilt der Default `"pps"` — kein Verhalten aendert sich dadurch.
   */
  resolutionSource?: "pps" | "arena";
  /**
   * Nur gesetzt, wenn `resolutionSource === "arena"`: der deterministische Seed
   * (`${saveId}:${seasonId}:${matchdayId}:arena:${homeTeamId}:${awayTeamId}`), mit dem sich genau
   * dieses Arena-Duell reproduzieren liesse. Die "Versionierung", die Chris fuer PR7 wollte — keine
   * Replay-Funktion, nur eine sichtbare, nachvollziehbare Kennung je Ergebnis.
   */
  arenaMatchSeed?: string | null;
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
    injuryApplied?: boolean;
    injuryAdjustedValue?: number | null;
    captainBonus: number | null;
    mutatorBonus?: number | null;
    mutatorPpsBonus?: number | null;
    formShare?: number | null; // pro Spieler angewandter Form-Anteil (flach + Jitter)
    /** Sein eigener Intensitaets-Wurf (schonen/normal/pushen), seeded pro Spieler und Spieltag. */
    intensityShare?: number | null;
    /** Der Modifikator SEINER Slot-Rolle (Clutch Shot, Fastbreak und so weiter). */
    slotRoleShare?: number | null;
    /** Sein anteiliger Teil der echten Seiten-Effekte: Team-Power, Mutator-Rest, Rundung. */
    teamEffectShare?: number | null;
    /** Sein anteiliger Teil der Team-Power — eigenes Feld, damit die Buehne sie benennen kann. */
    teamPowerShare?: number | null;
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
