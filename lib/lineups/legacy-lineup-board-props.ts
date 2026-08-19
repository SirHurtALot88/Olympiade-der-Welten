/**
 * Props-Vertrag der Einsatzlisten-Ansicht.
 *
 * Diese Typen lagen früher in `app/foundation/legacy-lineup-lab-v2/LegacyLineupFocusV2Board.tsx`.
 * Diese Komponente wurde nirgends mehr gerendert — `LegacyLineupLabClient` mountet
 * seit dem "Neuen Look" ausschließlich `LineupNewLook` bzw. `FormBoardPanel`. Die
 * Datei hing nur noch an einem toten `dynamic()`-Import und daran, dass
 * `LineupNewLook` ihren Props-Typ importierte; drei Contract-Tests prüften
 * dauerhaft rot gegen ihren Inhalt.
 *
 * Der VERTRAG wird weiter gebraucht (`LineupNewLook` leitet seine Props per
 * `Pick<…>` davon ab, und der Client versorgt ihn), die 1.700 Zeilen tote UI
 * darunter nicht. Deshalb steht der Typ jetzt hier — bei den übrigen
 * Lineup-Typen in `lib/lineups/`, ohne Client-Komponente drumherum.
 */

import type { ReactNode } from "react";

import type { LegacyLineupCandidateTab } from "@/lib/lineups/legacy-lineup-candidate-tabs";
import type { LegacyLineupDragFitTier } from "@/lib/lineups/legacy-lineup-drag-drop";
import type { LegacyLineupLabSlot } from "@/lib/lineups/legacy-lineup-lab";
import type { LegacyInjuryRiskProjectionRef, LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type { MatchdayIntensityStage, MatchdaySlotRoleDefinition } from "@/lib/lineups/matchday-slot-roles";

export type LineupBoardRosterCard = {
  id: string;
  activePlayerId: string | null;
  portraitUrl: string | null;
  name: string;
  className: string | null;
  discipline1Score: number | null;
  discipline2Score: number | null;
  playerOvr?: number | null;
  playerPps?: number | null;
  coreStats?: {
    pow: number;
    spe: number;
    men: number;
    soc: number;
  } | null;
};

export type LineupBoardCandidateAxisReasonChip = {
  axis: string;
  label: string;
  rating: string | null;
  tone: string;
  detail: string;
};

export type LineupBoardSlotCandidate = {
  activePlayerId: string;
  name: string;
  projectedScore: number | null;
  scoreDelta: number | null;
  fitSummary: string;
  fitDetail: string;
  reasonChips?: LineupBoardCandidateAxisReasonChip[];
  roleModifier?: number | null;
  rangeLow?: number | null;
  rangeHigh?: number | null;
  warnings?: string[];
};

export type LineupBoardSlotCandidateSummary = {
  topCandidates: LineupBoardSlotCandidate[];
  currentProjected: number | null;
};

export type LineupBoardPlayerBestSlotEntry = {
  slotKey: string;
  disciplineSide: "d1" | "d2";
  slotIndex: number;
  projectedScore: number | null;
  projectedDelta: number | null;
  fitSummary: string;
};

export type LineupBoardCandidateEntry = {
  player: LineupBoardRosterCard & {
    discipline1Label?: string;
    discipline2Label?: string;
    fatigueCount?: number | null;
  };
  activeSlotCandidate: {
    projectedScore: number | null;
    scoreDelta: number | null;
    blockReason?: string | null;
    fitSummary?: string;
    baseScore?: number | null;
    roleModifier?: number | null;
    rangeLow?: number | null;
    rangeHigh?: number | null;
    warnings?: string[];
    fatigueModifier?: number | null;
    additionalFatigue?: number | null;
  } | null;
  groupKey: string;
  groupMeta: { label: string };
  wantsActiveSlot: boolean;
  detail: string;
  shortReason: string;
  fitTier?: string | null;
  preferredSlotTags?: string[];
};

export type LineupBoardCandidateGroup = {
  key: string;
  meta: { label: string };
  entries: LineupBoardCandidateEntry[];
  totalCount: number;
};

export type LineupBoardSlotIssue = {
  label: string;
  detail: string;
  tone: string;
};

export type LineupBoardRoleAttribute = {
  key: string;
  shortLabel: string;
  ratingLabel: string | null;
  emphasis?: string;
};

export type LineupBoardSlotDragPreview = {
  projected: { totalProjected: number | null };
  scoreDelta: number | null;
  blockReason: string | null;
  fitTier: string | null;
};

export type LineupBoardCaptainSelectEntry = {
  activePlayerId: string;
  name: string;
};

export type LineupBoardCaptainInfo = {
  activePlayerId: string;
  estimatedCaptainBonus: number | null;
  moraleReward: number | null;
};

export type LegacyLineupFocusV2BoardProps = {
  context: LegacyLineupLoadedContext | null;
  slots: LegacyLineupLabSlot[];
  selections: Record<string, string>;
  activeSlotKey: string | null;
  nextOpenSlotKey: string | null;
  onActiveSlotChange: (slotKey: string) => void;
  rosterCardByActivePlayerId: Map<string, LineupBoardRosterCard>;
  slotCandidateSummaryByKey: Map<string, LineupBoardSlotCandidateSummary>;
  slotPreviewByKey: Map<
    string,
    {
      projected: {
        totalProjected: number | null;
        additionalFatigue?: number | null;
        fatigueModifier?: number | null;
        roleModifier?: number | null;
        rangeLow?: number | null;
        rangeHigh?: number | null;
        warnings?: string[];
      };
      selectedScore?: number | null;
    }
  >;
  slotRoleByKey: Map<string, MatchdaySlotRoleDefinition | null>;
  slotIssuesByKey: Map<string, LineupBoardSlotIssue[]>;
  slotRoleAttributesByKey: Map<string, LineupBoardRoleAttribute[]>;
  slotDragPreviewByKey: Map<string, LineupBoardSlotDragPreview>;
  draggedActivePlayerId: string | null;
  onDragStart: (activePlayerId: string) => void;
  onDragEnd: () => void;
  onDropOnSlot: (slotKey: string, activePlayerId: string | null) => void;
  getDragFitTierClass: (fitTier: LegacyLineupDragFitTier | string | null) => string;
  getTierStyleClass: (ratingLabel: string | null | undefined) => string;
  candidateGroups: LineupBoardCandidateGroup[];
  candidateTab: LegacyLineupCandidateTab;
  onCandidateTabChange: (tab: LegacyLineupCandidateTab) => void;
  playerBestSlotSummaryByActivePlayerId: Map<string, LineupBoardPlayerBestSlotEntry[]>;
  captains: Record<"d1" | "d2", string>;
  captainSelectEntriesBySide: Record<"d1" | "d2", LineupBoardCaptainSelectEntry[]>;
  captainInfoBySide: Record<"d1" | "d2", LineupBoardCaptainInfo[]>;
  captainDraftRemaining: number;
  captainSeasonUsedWithDraft: number;
  captainSeasonLimit: number;
  onUpdateCaptain: (disciplineSide: "d1" | "d2", activePlayerId: string) => void;
  lineupMeta: { d1Selected: number; d2Selected: number };
  d1Rank: number | null;
  d2Rank: number | null;
  getSelectedOptionMeta: (activePlayerId: string) => {
    name: string;
    fatigueCount?: number | null;
    /**
     * Einsatz-Verletzungsrisiko je Intensitaet (aus dem echten Wurf-Modell vorberechnet).
     * Die Einsatzliste zeigt es pro aufgestelltem Spieler an — Feature-Request: man sah
     * vor dem Spieltag nicht, wer Verletzungspotential traegt, "in der Arena isses zu spaet".
     */
    injuryRiskProjection?: LegacyInjuryRiskProjectionRef | null;
  } | null;
  onAssignPlayer: (slotKey: string, activePlayerId: string) => void;
  /** Increments on every real assignment (click, digit-key, Enter top-pick) — see LegacyLineupLabClient. */
  assignPulse?: number;
  onClearSlot: (slotKey: string) => void;
  onOpenPlayer: (playerId: string, activePlayerId?: string | null) => void;
  isReadOnly: boolean;
  isBusy: boolean;
  matchdayHeaderSummary: string;
  matchdayPreviewCards: {
    openSlots: number;
    totalRangeLow: number | null;
    totalRangeHigh: number | null;
    totalFatigue: number;
    riskLevel: string;
  };
  lineupFlowSummary: {
    selectedCount: number;
    totalRequired: number;
    nextStep: { label: string; detail: string };
    /* B2: siehe `LineupFlowSummary` — die Anzeige spricht an einem gewerteten Spieltag in der
       Vergangenheit. Optional, weil dieser Prop-Typ absichtlich enger ist als die volle
       Zusammenfassung und nicht jeder Aufrufer sie vollstaendig durchreicht. */
    matchdayAlreadyScored?: boolean;
  };
  lineupSaveCta: {
    tone: string;
    label: string;
    detail: string;
    buttonLabel: string;
  };
  lineupReadyToSave: boolean;
  lineupFinishItems: Array<{ key: string; label: string; detail: string; tone: string }>;
  lineupMiniAuditBlockers: number;
  captainBudgetExceeded: boolean;
  missingSeasonFormCards: boolean;
  formatProjectedMetricWindow: (low: number | null | undefined, high: number | null | undefined) => string;
  onFocusNextOpenSlot: () => void;
  onAutoFillOpenSlots: () => void;
  onSaveDraft: () => void;
  getDisciplineIntensity: (disciplineSide: "d1" | "d2") => MatchdayIntensityStage;
  onUpdateDisciplineIntensity: (disciplineSide: "d1" | "d2", intensity: MatchdayIntensityStage) => void;
  playerFilter: string;
  onPlayerFilterChange: (value: string) => void;
  controlsSlot?: ReactNode;
  tacticsSlot?: ReactNode;
  disciplineColorClassBySide: Record<"d1" | "d2", string>;
  formMiniChipsBySide?: Record<
    "d1" | "d2",
    { primaryLabel: string | null; secondaryLabel: string | null; hasSelection: boolean }
  >;
  currentMatchdayId?: string | null;
  onAssignFormCardToSide?: (input: {
    disciplineSide: "d1" | "d2";
    slot: "primary" | "secondary";
    cardId: string;
  }) => void;
  getFormBoardCardOptionsForSide?: (
    disciplineSide: "d1" | "d2",
    slot: "primary" | "secondary",
  ) => Array<{ id: string; label: string; color: string }>;
  /** Draft saved + no blockers + all slots filled — enables gated Arena CTA. */
  arenaReady?: boolean;
  onNavigateArena?: () => void;
  /** Per-side projected totals at Schonen/Normal/Push for tactic preview cards. */
  disciplineTacticPreviewBySide?: Record<
    "d1" | "d2",
    { conserve: number | null; normal: number | null; push: number | null }
  >;
};
