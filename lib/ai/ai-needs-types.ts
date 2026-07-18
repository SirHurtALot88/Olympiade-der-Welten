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
  d1SelectionReasons: AiSideSelectionReason[];
  d2SelectionReasons: AiSideSelectionReason[];
};

export type AiSideSelectionReason = {
  playerId: string;
  activePlayerId: string;
  slotIndex: number;
  disciplineScore: number | null;
  selectionScore: number | null;
  demandBonus: number;
  identityTieBreak: number;
  demandReasons: string[];
  reason: string;
};

export type AiLegacyLineupPreviewStatus = "ready" | "incomplete_roster" | "missing_scores" | "blocked";
export type AiCaptainSelectionStatus =
  | "selected"
  | "skipped_limit_reached"
  | "skipped_reserved"
  | "skipped_not_needed"
  // Opportunistischer Verzicht: Der Kandidat wäre grundsätzlich möglich, aber der erwartete
  // Ertrag rechtfertigt es nicht, einen der knappen Saison-Slots JETZT zu verbrennen
  // (schwache/konservative Diszi, geringer Hebel).
  | "skipped_not_worthwhile"
  // Pacing-Verzicht: Es gäbe einen lohnenden Kandidaten, aber wir sparen den Slot bewusst
  // (max. ein neuer Captain pro Spieltag / stärkere Seite bevorzugt / noch genug Saison übrig).
  | "skipped_saving_for_later"
  | "blocked_policy";

export type AiLegacyLineupSelectedPlayer = {
  playerId: string;
  activePlayerId: string | null;
  name: string | null;
  isCaptain: boolean;
  baseScore: number | null;
  selectionScore?: number | null;
  demandBonus?: number | null;
  identityTieBreak?: number | null;
  demandReasons?: string[];
  selectionReason?: string | null;
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

export type AiLegacyLineupModifierSidePlan = {
  disciplineSide: DisciplineSide;
  intensity: "conserve" | "normal" | "push";
  intensityReason: string;
  primaryFormCardId: string | null;
  secondaryFormCardId: string | null;
  formReason: string;
  mutatorTrait1: string | null;
  mutatorTrait2: string | null;
  mutatorReason: string;
  teamPowerId: string | null;
  teamPowerReason: string;
};

export type AiLegacyLineupAuditSummary = {
  status: "ready" | "warning" | "blocked";
  ready: boolean;
  items: Array<{
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
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
  modifierPlan?: {
    d1: AiLegacyLineupModifierSidePlan;
    d2: AiLegacyLineupModifierSidePlan;
  };
  auditSummary?: AiLegacyLineupAuditSummary;
  d1: AiLegacyLineupSuggestionSide;
  d2: AiLegacyLineupSuggestionSide;
  entries: LegacyLineupEntryInput[];
  scorePreview: LegacyLineupScoreResult;
};
