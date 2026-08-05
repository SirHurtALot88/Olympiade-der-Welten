"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRafThrottledScrollTop } from "@/lib/foundation/use-raf-throttled-scroll";

import { calculateLocalLegacyLineupPreviewFromContext } from "@/lib/lineups/legacy-lineup-preview-from-context";
import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";
import { useRowVirtualWindow } from "@/lib/foundation/use-row-virtual-window";
import { resolveFirstOpenFormPickCell } from "@/lib/foundation/resolve-first-open-form-cell";

import { isFoundationTeamManagementLocked } from "@/lib/foundation/foundation-admin-dev-flags";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { DisciplineCategory, FormCardPlanRecord, GameState, LineupDraftModifiers, Player, PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";
import {
  appendRoomContextToParams,
  readFoundationRoomContextFromLocation,
  type FoundationRoomContext,
} from "@/lib/room/foundation-room-context-client";
import { getFatiguePerformancePenaltyPercent, getInjuryRiskPercent } from "@/lib/fatigue/fatigue-calibration";
import {
  buildLegacyLineupEntriesFromSelections,
  buildLegacyLineupLabPlayerOptions,
  buildLegacyLineupLabSlots,
  findDuplicateActivePlayerSelections,
} from "@/lib/lineups/legacy-lineup-lab";
import { buildLineupPlayerDemandMap, selectTeamCaptain } from "@/lib/morale/player-demands-service";
import {
  applyCaptainRivalryPressureReduction,
  calculateMatchdayProjectedPreview,
  getMatchdayIntensityConfig,
  resolveSlotRolesForDiscipline,
  type MatchdayIntensityStage,
  type MatchdaySlotRoleDefinition,
} from "@/lib/lineups/matchday-slot-roles";
import { calculatePerPlayerFormModifier } from "@/lib/lineups/legacy-lineup-modifiers";
import { describeLineupRosterShortfall, isLineupArenaReady } from "@/lib/lineups/lineup-roster-shortfall";
import { applyPlannedFormCardsToModifiers } from "@/lib/foundation/form-board-plan-service";
import {
  formatLegacyLineupDragBlockReason,
  getLegacyLineupDragFitTier,
  resolveLegacyLineupDragBlockReason,
  type LegacyLineupDragBlockReason,
  type LegacyLineupDragFitTier,
} from "@/lib/lineups/legacy-lineup-drag-drop";
import {
  filterLegacyLineupCandidateEntries,
  type LegacyLineupCandidateTab,
} from "@/lib/lineups/legacy-lineup-candidate-tabs";
import type {
  LegacyLineupDraft,
  LegacyLineupEntryInput,
  LegacyFormCardOption,
  LegacyTeamPowerOption,
  LegacyLineupLoadedContext,
  LegacyModifierSourceSummary,
  LegacyLineupPreviewResult,
} from "@/lib/lineups/legacy-lineup-types";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";
import { areTeamPowersEnabled, describeTeamPowerDebuffEffect, isTeamPowerDebuffEffect } from "@/lib/lineups/team-powers";
import type { AiLegacyLineupPreview } from "@/lib/ai/ai-needs-types";
import { prefetchMatchdayArenaBase } from "@/lib/foundation/foundation-panel-prefetch";
// Rechenkern der Kandidaten-/Kader-Ableitungen und der Bewertungs-/Freigabe-Kette:
// nach `lib/lineups/lineup-candidate-model.ts` und `lib/lineups/lineup-audit.ts`
// verschoben (siehe dortige Kommentare). Diese Komponente behaelt nur noch duenne
// `useMemo`-Huellen, die diese Funktionen mit denselben Eingaben aufrufen wie vorher.
import {
  attributeShortLabels,
  buildActiveSlotCandidateByActivePlayerId,
  buildCandidateAxisReasonChips,
  buildMatchdayRosterCards,
  buildPlayerBestSlotSummaryByActivePlayerId,
  buildSlotCandidateSummaryByKey,
  buildSlotFitExplanation,
  buildSlotPreviewByKey,
  buildTeamdeckCandidateEntries,
  buildTeamdeckCandidateGroups,
  formatDecimalScore,
  formatNullableScore,
  formatScore,
  getTeamdeckCandidateGroupMeta,
  isElevatedFatigue,
  formatFatigueImpactDetail,
  normalizeClassHintToken,
  resolveAttributeGrade,
  type ActiveSlotCandidate,
  type LineupPlayerTableRow,
  type MatchdayFocusAttribute,
  type MatchdayRosterCard,
  type MatchdaySlotPreviewCard,
  type PlayerBestSlotEntry,
  type SlotCandidateSummaryEntry,
  type TeamdeckCandidateEntry,
  type TeamdeckCandidateGroup,
  type TeamdeckCandidateQualityKey,
  type TeamdeckFilterMode,
  type TeamdeckSortMode,
} from "@/lib/lineups/lineup-candidate-model";
import {
  buildLineupFlowSummary,
  buildLineupMiniAudit,
  buildLineupSaveCta,
  buildMatchdayPreviewCards,
  buildSlotIssuesByKey,
  computeLineupReadyToSave,
  formatLineupHintLabel,
  formatMoraleDelta,
  type LineupMoraleDecision,
} from "@/lib/lineups/lineup-audit";

// Perf/DX (#57): these three sub-views are each only rendered behind a single
// runtime condition (newLook flag, formBoard tab, focusV2 variant) — never all
// at once. Lazy-loading them keeps LegacyLineupLabClient's own dev compile
// graph from dragging in ~3.7k lines of sibling UI that a given session may
// never touch. ssr:false is safe: none of the three read window/document at
// module scope (only inside effects/handlers), and each is reached solely via
// client-side state after this component has already mounted, so there is no
// SSR/hydration path to preserve.
const LineupNewLook = dynamic(() => import("@/app/foundation/legacy-lineup-lab/LineupNewLook"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="lineup" label="Neuer Look wird geladen…" />,
});
const FormBoardPanel = dynamic(() => import("@/app/foundation/legacy-lineup-lab/FormBoardPanel"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="lineup" label="Formplan wird geladen…" />,
});

type LabOptions = {
  saves: Array<{ id: string; name: string; status: string }>;
  seasons: Array<{ id: string; name: string; year: number; status: string }>;
  matchdays: Array<{
    id: string;
    label: string;
    index: number;
    status: string;
    discipline1Label?: string | null;
    discipline1RequiredPlayers?: number | null;
    discipline2Label?: string | null;
    discipline2RequiredPlayers?: number | null;
    sourceStatus?: string | null;
    readyTeams?: number;
    totalTeams?: number;
    isReady?: boolean;
  }>;
  teams: Array<{
    id: string;
    name: string;
    activePlayers: number;
    controlMode?: "manual" | "ai" | "passive";
    aiLineupApplyEnabled?: boolean;
    lineupFilledCount?: number;
    totalLineupSides?: number;
    captainUsedCount?: number;
    captainSlots?: number;
    statusLabel?: string;
    currentMatchdayReady?: boolean;
  }>;
};

type LabContextResponse = {
  params: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
    teamId: string;
  };
  source: "sqlite" | "prisma";
  readOnly: boolean;
  context: LegacyLineupLoadedContext | null;
  contextWarnings: string[];
  contextErrors: string[];
  options: LabOptions;
};

type PreviewResponse = {
  preview?: LegacyLineupPreviewResult | null;
  errors?: string[];
  warnings?: string[];
};

type FormCardPlanResponse = {
  plans?: FormCardPlanRecord[];
  errors?: string[];
  warnings?: string[];
  error?: string;
};

type AiPreviewResponse = {
  preview?: AiLegacyLineupPreview | null;
  errors?: string[];
  warnings?: string[];
};

type MatchdayMvpScoreboardRow = {
  teamId: string;
  teamName: string;
  baseScore: number;
  formCardStatus: "ready" | "missing_source";
  formCardLabel: string | null;
  formCardModifier: number | null;
  mutatorMode: "legacy_selected_traits" | "mvp_forced_mutators";
  mutator1Label: string | null;
  mutator1Modifier: number | null;
  mutator2Label: string | null;
  mutator2Modifier: number | null;
  captainStatus: "mapped" | "missing_source";
  captainModifier: number | null;
  fatigueStatus: "mapped" | "missing_source";
  fatigueModifier: number | null;
  teamPpsStatus: "ready" | "missing_source";
  teamPpsModifier: number | null;
  score: number;
  rank: number;
  points: number | null;
  status: string;
  autoLineupSource: boolean;
  warnings: string[];
};

type MatchdayMvpScoringResponse = {
  source: "sqlite";
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied";
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  targetMatchday: {
    matchdayId: string;
    label: string;
    d1DisciplineId: string | null;
    d1DisciplineName: string | null;
    d2DisciplineId: string | null;
    d2DisciplineName: string | null;
  };
  resolveSources: {
    formCardSourceStatus: "ready" | "missing_source";
    formCardSourceLabel: string | null;
    mutatorSourceStatus: "ready" | "missing_source";
    mutatorSourceLabel: string | null;
    captainSourceStatus: "mapped" | "missing_source";
    fatigueSourceStatus: "mapped" | "missing_source";
    teamPpsSourceStatus: "ready" | "missing_source";
  };
  d1Scoreboard: MatchdayMvpScoreboardRow[];
  d2Scoreboard: MatchdayMvpScoreboardRow[];
  d1TopPlayers: MatchdayMvpTopPlayerRow[];
  d2TopPlayers: MatchdayMvpTopPlayerRow[];
  totalTeamsScored: number;
  warnings: string[];
  blockingReasons: string[];
  error?: string;
};

type MatchdayMvpTopPlayerRow = {
  disciplineSide: "d1" | "d2";
  disciplineId: string;
  disciplineName: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  finalPlayerScore: number;
  pointsAwarded: number | null;
  mutatorPpsBonus: number | null;
  mutatorScoreBonus: number | null;
  rankInDiscipline: number;
};

type MatchdayMvpScoreboardRowView = MatchdayMvpScoreboardRow & {
  baseRank: number;
  rankDelta: number;
  lossScore: number;
  currentScore: number;
  captainScore: number | null;
  formScore: number | null;
  bonusScore: number;
};

type AiBatchPreviewResponse = {
  readOnly: true;
  source: "sqlite" | "prisma";
  matchdayId: string;
  totalTeams: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  teams: AiBatchPreviewEntry[];
  error?: string;
};

type AiBatchApplyTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  aiEligible: boolean;
  previewStatus: string;
  result:
    | "saved"
    | "skipped_warning"
    | "skipped_blocked"
    | "skipped_existing"
    | "skipped_manual"
    | "skipped_passive"
    | "skipped_disabled"
    | "failed_validation";
  overwriteExisting: boolean;
  warnings: string[];
  blockingReasons: string[];
  saved: boolean;
};

type AiBatchApplyResponse = {
  source: "sqlite";
  readOnly: false;
  dryRun: boolean;
  includeWarningTeams: boolean;
  totalTeams: number;
  results: AiBatchApplyTeamResult[];
  summary: {
    totalTeams: number;
    aiEligibleTeams: number;
    skippedManual: number;
    skippedPassive: number;
    skippedDisabled: number;
    readyToSave: number;
    readyTeams: number;
    warningTeams: number;
    blockedTeams: number;
    wouldSave: number;
    savedTeams: number;
    skippedWarning: number;
    skippedBlocked: number;
    skippedExisting: number;
    existingLineups: number;
    wouldOverwrite: number;
    overwrittenExisting: number;
    plannedLineups: number;
    warnings: string[];
    blockingReasons: string[];
  };
  error?: string;
};

type AiBatchPreviewEntry = {
  teamId: string;
  teamName: string;
  teamCode: string;
  status: string;
  d1Status: string;
  d2Status: string;
  totalExpectedScore: number;
  d1DisciplineName: string | null;
  d2DisciplineName: string | null;
  d1SelectedPlayers: number;
  d1RequiredPlayers: number;
  d1MissingSlots: number;
  d2SelectedPlayers: number;
  d2RequiredPlayers: number;
  d2MissingSlots: number;
  d1CaptainName: string | null;
  d2CaptainName: string | null;
  warnings: string[];
  blockingReasons: string[];
  explanation: string;
};

type LegacyLineupLabClientProps = {
  embedded?: boolean;
  uiVariant?: "classic" | "focusV2";
  initialSource?: "sqlite" | "prisma";
  defaultSaveId?: string;
  defaultSaveName?: string;
  defaultSeasonId?: string;
  defaultMatchdayId?: string;
  defaultTeamId?: string;
  highlightMissingSlots?: boolean;
  focusMissingRequestKey?: string | null;
  initialDraftBoardView?: "lineup" | "formBoard";
  draftBoardView?: "lineup" | "formBoard";
  onDraftBoardViewChange?: (view: "lineup" | "formBoard") => void;
  shellControlledDraftBoardView?: boolean;
  onDraftBoardViewApplied?: () => void;
  activeOwnerId?: string | null;
  manageableTeamIds?: string[];
  onTeamChange?: (teamId: string) => void;
  playerCatalog?: Player[];
  embeddedGameState?: GameState;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onLineupSaved?: (payload: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
    teamId: string;
    silent: boolean;
    draft?: LegacyLineupDraft | null;
    saveVersion?: number | null;
    contentSignature?: string | null;
  }) => void;
  onFormCardPlanSaved?: (payload: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
    teamId: string;
    plans: FormCardPlanRecord[];
  }) => void;
  onOpenArena?: (payload: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
    teamId: string;
  }) => void;
  roomContext?: FoundationRoomContext | null;
};

// LineupPlayerTableRow/MatchdayFocusAttribute/MatchdayRosterCard/MatchdaySlotPreviewCard:
// siehe lib/lineups/lineup-candidate-model.ts (dort importiert).

type MatchdaySlotDragPreviewCard = {
  slotKey: string;
  activePlayerId: string;
  disciplineSide: "d1" | "d2";
  projected: ReturnType<typeof calculateMatchdayProjectedPreview>;
  currentProjectedScore: number | null;
  scoreDelta: number | null;
  blockReason: LegacyLineupDragBlockReason | null;
  fitTier: LegacyLineupDragFitTier;
  slotRuleLabel: string | null;
};

// TeamdeckFilterMode/TeamdeckSortMode/TeamdeckCandidateQualityKey: siehe
// lib/lineups/lineup-candidate-model.ts. LineupMoraleDecision: siehe
// lib/lineups/lineup-audit.ts (beide importiert).

type LegacyLineupUndoSnapshot = {
  id: string;
  label: string;
  detail: string;
  selections: Record<string, string>;
  captains: Record<"d1" | "d2", string>;
  activeSlotKey: string | null;
  focusedDisciplineSide: "d1" | "d2";
};

type LegacyLineupHoveredCandidate = {
  slotKey: string;
  activePlayerId: string;
};

type LineupPowerPointsRow = {
  rank: number;
  teamCode: string;
  pps: number;
  pow: number;
  spe: number;
  men: number;
  soc: number;
};

type LegacyLineupTableColumn = {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  visibleByDefault?: boolean;
};

type LegacyLineupTablePresetId = "retool_default" | "compact" | "finance" | "performance" | "custom";

type LegacyLineupTablePreferences = Record<
  string,
  {
    widths?: Record<string, number>;
    columnVisibility?: Record<string, boolean>;
    columnOrder?: string[];
    activePreset?: LegacyLineupTablePresetId | null;
    sortState?: {
      key: string;
      direction: "asc" | "desc";
    } | null;
  }
>;

type LegacyLineupTablePreset = {
  id: Exclude<LegacyLineupTablePresetId, "custom">;
  label: string;
  visibleColumnIds: string[];
  order: string[];
};

const LEGACY_LINEUP_TABLE_PREFERENCES_STORAGE_KEY = "legacy-lineup-table-preferences-v1";

const attributeLabels: Record<keyof PlayerAttributeSheetStats, string> = {
  power: "Power",
  health: "Health",
  stamina: "Stamina",
  intelligence: "Intelligence",
  awareness: "Awareness",
  determination: "Determination",
  speed: "Speed",
  dexterity: "Dexterity",
  charisma: "Charisma",
  will: "Will",
  spirit: "Spirit",
  torment: "Torment",
  height: "Height",
};

// attributeShortLabels: siehe lib/lineups/lineup-candidate-model.ts (dort importiert).

function loadLegacyLineupTablePreferences(): LegacyLineupTablePreferences {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(LEGACY_LINEUP_TABLE_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as LegacyLineupTablePreferences;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getLegacyLineupTableWidths(columns: LegacyLineupTableColumn[]) {
  return Object.fromEntries(columns.map((column) => [column.id, column.defaultWidth]));
}

function orderLegacyLineupColumns(columns: LegacyLineupTableColumn[], columnOrder?: string[]) {
  const orderIndex = new Map((columnOrder ?? []).map((columnId, index) => [columnId, index]));
  return [...columns].sort((left, right) => {
    const leftIndex = orderIndex.get(left.id);
    const rightIndex = orderIndex.get(right.id);

    if (leftIndex == null && rightIndex == null) {
      return columns.findIndex((column) => column.id === left.id) - columns.findIndex((column) => column.id === right.id);
    }
    if (leftIndex == null) {
      return 1;
    }
    if (rightIndex == null) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}

// normalizeClassHintToken: siehe lib/lineups/lineup-candidate-model.ts (dort importiert).

function formatIntensityStageLabel(value: MatchdayIntensityStage) {
  if (value === "conserve") return "Schonen";
  if (value === "push") return "Push";
  return "Normal";
}

// buildSlotFitExplanation/buildCandidateAxisReasonChips: siehe
// lib/lineups/lineup-candidate-model.ts (dort importiert).

function compareLegacyLineupSortValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "de", { numeric: true, sensitivity: "base" });
}

// formatScore/formatDecimalScore/formatNullableScore/isElevatedFatigue/
// formatFatigueImpactDetail: siehe lib/lineups/lineup-candidate-model.ts
// (dort importiert).

function formatTraitList(values: string[] | null | undefined) {
  if (!values || values.length === 0) {
    return "—";
  }
  return values.join(", ");
}

function formatExhaustionPoints(score: number | null | undefined, fatigue: number | null | undefined) {
  const value = Math.round(fatigue ?? 0);
  if (fatigue == null) {
    return "Erschöpfung —";
  }
  if (value <= 0) {
    return "Erschöpfung 0";
  }
  const penaltyPercent = getFatiguePerformancePenaltyPercent(fatigue);
  if (score == null || !Number.isFinite(score)) {
    return `Erschöpfung F${value} · −${formatDecimalScore(penaltyPercent, 1)}%`;
  }
  const penalty = Number((score * penaltyPercent / 100).toFixed(2));
  return `Erschöpfung F${value} · −${formatScore(penalty)} (−${formatDecimalScore(penaltyPercent, 1)}%)`;
}

function formatProjectedMetricWindow(low: number | null | undefined, high: number | null | undefined) {
  if (low == null && high == null) {
    return "—";
  }
  if (low == null || high == null) {
    return formatDecimalScore(low ?? high, 1);
  }
  const rangeLow = Math.min(low, high);
  const rangeHigh = Math.max(low, high);
  if (Math.abs(rangeLow - rangeHigh) < 0.05) {
    return formatDecimalScore(rangeHigh, 1);
  }
  return `${formatDecimalScore(rangeLow, 1)}–${formatDecimalScore(rangeHigh, 1)}`;
}

function formatCompactDisciplineCode(label: string | null | undefined) {
  const compactSource = (label ?? "").replace(/[^a-zA-ZäöüÄÖÜß]/g, "");
  if (!compactSource) {
    return "—";
  }
  const compact = compactSource.slice(0, 3).toLowerCase();
  return compact.charAt(0).toUpperCase() + compact.slice(1);
}

function getDisciplineAreaLabel(category: DisciplineCategory) {
  if (category === "power") return "POW";
  if (category === "speed") return "SPE";
  if (category === "mental") return "MEN";
  return "SOC";
}

function getDisciplineAreaColor(category: DisciplineCategory) {
  if (category === "power") return "red";
  if (category === "speed") return "green";
  if (category === "mental") return "blue";
  return "yellow";
}

function sortDisciplineTimelineEntries(
  left: { matchdayIndex: number; order: number; label: string },
  right: { matchdayIndex: number; order: number; label: string },
) {
  if (left.matchdayIndex !== right.matchdayIndex) {
    return left.matchdayIndex - right.matchdayIndex;
  }
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  return left.label.localeCompare(right.label, "de");
}

function formatMatchdayOptionLabel(matchday: LabOptions["matchdays"][number]) {
  const d1 =
    matchday.discipline1Label != null
      ? `${matchday.discipline1Label} (${matchday.discipline1RequiredPlayers ?? "—"})`
      : null;
  const d2 =
    matchday.discipline2Label != null
      ? `${matchday.discipline2Label} (${matchday.discipline2RequiredPlayers ?? "—"})`
      : null;
  const disciplines = d1 && d2 ? `${d1} / ${d2}` : null;
  const baseLabel = disciplines ? `${matchday.label} · ${disciplines}` : matchday.label;
  return matchday.isReady ? `✓ ${baseLabel}` : baseLabel;
}

function formatTeamOptionLabel(team: LabOptions["teams"][number]) {
  const baseLabel = team.statusLabel ?? `${team.name} (${team.activePlayers})`;
  return team.currentMatchdayReady ? `✓ ${baseLabel}` : baseLabel;
}

/**
 * "Neuer Look"-Team-Dropdown (nur hier verwendet, s. `controlsSlot` im
 * flag-gated `LineupNewLook`-Zweig): `formatTeamOptionLabel`/`statusLabel`
 * bleiben für den Alt-Look unangetastet, deren Kurzform "Lineup X/Y" ist dort
 * unverändert — sie zählt aber SAISON-weit gespeicherte Aufstellungen
 * (`lineupFilledCount`/`totalLineupSides`, s. `countSeasonLineupDisciplineSides`
 * / `buildLineupDisciplineContract` in `lib/lineups/lineup-discipline-contract.ts`),
 * NICHT die heute im Board belegten Slots. Genau diese Doppel-Bedeutung von
 * "Lineup X/Y" (heute vs. Saison) hat für die gemeldete Verwechslung
 * gesorgt ("9/5" oben vs. "0/20" hier). Diese Variante macht den Saison-Scope
 * explizit, ohne die zugrunde liegende Zählung zu verändern.
 */
function formatNlTeamOptionLabel(team: LabOptions["teams"][number]) {
  const readyMark = team.currentMatchdayReady ? "✓ " : "";
  if (team.totalLineupSides != null && team.lineupFilledCount != null) {
    const captainPart =
      team.captainUsedCount != null && team.captainSlots != null
        ? ` · Captain (Saison) ${team.captainUsedCount}/${team.captainSlots}`
        : "";
    return `${readyMark}${team.name} · Saison-Aufstellungen gespeichert ${team.lineupFilledCount}/${team.totalLineupSides}${captainPart}`;
  }
  return formatTeamOptionLabel(team);
}

function getTopAttributeWeights(
  weights: LegacyLineupLoadedContext["disciplineWeights"] | null | undefined,
  disciplineId: string | null | undefined,
  limit = 4,
) {
  if (!weights || !disciplineId) {
    return [];
  }

  return weights
    .filter((weight) => weight.disciplineId === disciplineId && weight.weightPct > 0)
    .sort((left, right) => right.weightPct - left.weightPct)
    .slice(0, limit)
    .map((weight) => ({
      key: weight.attributeKey as keyof PlayerAttributeSheetStats,
      label: attributeLabels[weight.attributeKey as keyof PlayerAttributeSheetStats] ?? weight.attributeKey,
      shortLabel: attributeShortLabels[weight.attributeKey as keyof PlayerAttributeSheetStats] ?? weight.attributeKey.toUpperCase(),
      weightPct: weight.weightPct,
    }));
}

// resolveAttributeGrade: siehe lib/lineups/lineup-candidate-model.ts (dort importiert).

function resolveTeamDisciplineRank(
  ranks: LegacyLineupLoadedContext["teamDisciplineRanks"] | null | undefined,
  disciplineId: string | null | undefined,
  label?: string | null,
) {
  if (!ranks || !disciplineId) {
    return null;
  }
  const candidates = Array.from(
    new Set(
      [disciplineId, normalizeLineupDisciplineFieldName(disciplineId), label, label ? normalizeLineupDisciplineFieldName(label) : null]
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => [value, value.replace(/_/g, "-"), value.replace(/-/g, "_")]),
    ),
  );
  for (const key of candidates) {
    const rank = ranks[key]?.rank;
    if (rank != null) {
      return rank;
    }
  }
  const normalizedTarget = normalizeLineupDisciplineFieldName(label ?? disciplineId);
  const fuzzyMatch = Object.entries(ranks).find(([key]) => normalizeLineupDisciplineFieldName(key) === normalizedTarget);
  return fuzzyMatch?.[1]?.rank ?? null;
}

// getTeamdeckCandidateGroupMeta/formatMoraleDelta/formatLineupHintLabel: siehe
// lib/lineups/lineup-candidate-model.ts bzw. lib/lineups/lineup-audit.ts (dort
// importiert).

function getDemandPriorityMultiplier(priority: "low" | "medium" | "high") {
  if (priority === "high") return 1.15;
  if (priority === "low") return 0.7;
  return 1;
}

function getDemandMoraleValue(value: number, priority: "low" | "medium" | "high") {
  return Number((value * getDemandPriorityMultiplier(priority)).toFixed(1));
}

function hasLineupDraftValues(
  selections: Record<string, string>,
  captains: Record<"d1" | "d2", string>,
) {
  return Object.values(selections).some(Boolean) || Object.values(captains).some(Boolean);
}

function createEmptyLineupModifiers(): LineupDraftModifiers {
  return {
    d1: {
      primaryFormCardId: null,
      secondaryFormCardId: null,
      mutatorTrait1: null,
      mutatorTrait2: null,
      teamPowerId: null,
      intensity: "normal",
    },
    d2: {
      primaryFormCardId: null,
      secondaryFormCardId: null,
      mutatorTrait1: null,
      mutatorTrait2: null,
      teamPowerId: null,
      intensity: "normal",
    },
  };
}

function normalizeLineupModifiers(modifiers?: Partial<LineupDraftModifiers> | null): LineupDraftModifiers {
  return {
    d1: {
      ...createEmptyLineupModifiers().d1,
      ...(modifiers?.d1 ?? {}),
    },
    d2: {
      ...createEmptyLineupModifiers().d2,
      ...(modifiers?.d2 ?? {}),
    },
  };
}

function formatFormCardColorLabel(color: LegacyFormCardOption["color"]) {
  if (color === "red") return "POW";
  if (color === "green") return "SPE";
  if (color === "blue") return "MEN";
  return "SOC";
}

const formCardColorOrder: LegacyFormCardOption["color"][] = ["red", "green", "blue", "yellow"];

const formCardColorIcon: Record<LegacyFormCardOption["color"], string> = {
  red: "●",
  green: "●",
  blue: "●",
  yellow: "●",
};

// Bereichs-Hex der Formkarten (POW=rot, SPE=grün, MEN=blau, SOC=gelb) — identisch zu
// `.legacy-lineup-form-card-option.is-*` in globals.css. Für die farbige, etwas größere
// Punkte-Anzeige der Dropdown-Optionen.
const formCardColorHex: Record<LegacyFormCardOption["color"], string> = {
  red: "#ff8b86",
  green: "#a8e7aa",
  blue: "#a9ccff",
  yellow: "#ffd987",
};

const formCardOptionStyle = (card: LegacyFormCardOption): CSSProperties => ({
  color: formCardColorHex[card.color],
  fontSize: "13px",
  fontWeight: 700,
});

function getFormCardColorForCategory(category: string | null | undefined): LegacyFormCardOption["color"] | null {
  if (category === "power") return "red";
  if (category === "speed") return "green";
  if (category === "mental") return "blue";
  if (category === "social") return "yellow";
  return null;
}

function formatFormCardValueLabel(value: number) {
  return value > 0 ? `+${formatScore(value)}` : formatScore(value);
}

function formatFormCardOptionLabel(card: LegacyFormCardOption, disciplineColor?: LegacyFormCardOption["color"] | null) {
  const polarity = card.value < 0 ? "Malus" : "Bonus";
  const multiplier = disciplineColor && card.color === disciplineColor ? " · x2" : "";
  return `${formCardColorIcon[card.color]} ${formatFormCardValueLabel(card.value)} Punkte · ${formatFormCardColorLabel(card.color)}${multiplier} · ${polarity}`;
}

function getFormCardEffectiveValue(card: LegacyFormCardOption | null, disciplineColor?: LegacyFormCardOption["color"] | null) {
  if (!card) return 0;
  return card.value * (disciplineColor && card.color === disciplineColor ? 2 : 1);
}

function formatFormPlanImpact(
  primary: LegacyFormCardOption | null,
  secondary: LegacyFormCardOption | null,
  disciplineColor?: LegacyFormCardOption["color"] | null,
) {
  const impact = getFormCardEffectiveValue(primary, disciplineColor) + getFormCardEffectiveValue(secondary, disciplineColor);
  if (Math.abs(impact) < 0.05) return "±0";
  return `${impact > 0 ? "+" : ""}${formatScore(impact)}`;
}

function sortFormCardsForDiscipline(cards: LegacyFormCardOption[], disciplineColor?: LegacyFormCardOption["color"] | null) {
  return [...cards].sort((left, right) => {
    const leftPriority = disciplineColor && left.color === disciplineColor ? -1 : formCardColorOrder.indexOf(left.color);
    const rightPriority = disciplineColor && right.color === disciplineColor ? -1 : formCardColorOrder.indexOf(right.color);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    if (left.value !== right.value) {
      return right.value - left.value;
    }
    return left.playerName.localeCompare(right.playerName, "de");
  });
}

function getTeamPowerCategoryLabel(category: LegacyTeamPowerOption["category"]) {
  if (category === "power") return "POW";
  if (category === "speed") return "SPE";
  if (category === "mental") return "MEN";
  if (category === "social") return "SOC";
  return "FLEX";
}

function getTeamPowerEffectLabel(power: Pick<LegacyTeamPowerOption, "effectType" | "targetMode" | "targetLimit">) {
  if (power.effectType === "snipe_debuff") {
    return power.targetMode === "single_rival" ? "Debuff · Snipe Rival" : "Debuff · Snipe Top";
  }
  if (power.effectType === "field_debuff") {
    return `Debuff · Field x${Math.max(power.targetLimit, 1)}`;
  }
  if (power.effectType === "rivalry_debuff") {
    return "Debuff · Rivalry";
  }
  if (power.effectType === "support_boost") {
    return "Boost · Support";
  }
  return "Boost";
}

function getTeamPowerCategoryForDiscipline(category: string | null | undefined): LegacyTeamPowerOption["category"] {
  if (category === "power" || category === "speed" || category === "mental" || category === "social") {
    return category;
  }
  return "flex";
}

const TEAM_POWER_ATTRIBUTE_LABELS: Record<string, string> = {
  power: "Power",
  health: "Health",
  determination: "Determination",
  stamina: "Stamina",
  speed: "Speed",
  dexterity: "Dexterity",
  awareness: "Awareness",
  intelligence: "Intelligence",
  will: "Will",
  charisma: "Charisma",
  spirit: "Spirit",
  torment: "Torment",
};

function formatTeamPowerAttributeTags(power: LegacyTeamPowerOption) {
  const positives = (power.positiveAttributeTags ?? []).map((tag) => TEAM_POWER_ATTRIBUTE_LABELS[tag] ?? tag).join("/");
  return power.negativeAttributeTag ? `${positives} vs ${TEAM_POWER_ATTRIBUTE_LABELS[power.negativeAttributeTag] ?? power.negativeAttributeTag}` : positives;
}

function getTeamPowerDisciplineWeight(
  disciplineWeights: Array<{ disciplineId: string; attributeKey: string; weightPct: number }> | null | undefined,
  disciplineId: string | null | undefined,
  attributeKey: string,
) {
  if (!disciplineId) return 0;
  return disciplineWeights?.find((entry) => entry.disciplineId === disciplineId && entry.attributeKey === attributeKey)?.weightPct ?? 0;
}

function calculateTeamPowerAttributeFitPctForUi(
  power: LegacyTeamPowerOption,
  disciplineId: string | null | undefined,
  disciplineWeights: Array<{ disciplineId: string; attributeKey: string; weightPct: number }> | null | undefined,
  fitMultiplier = 1,
) {
  const positiveTags = power.positiveAttributeTags ?? [];
  if (!disciplineId || positiveTags.length === 0) return 0;
  const positiveAverage =
    positiveTags.reduce((sum, tag) => sum + getTeamPowerDisciplineWeight(disciplineWeights, disciplineId, tag), 0) /
    positiveTags.length;
  const negativeWeight = power.negativeAttributeTag
    ? getTeamPowerDisciplineWeight(disciplineWeights, disciplineId, power.negativeAttributeTag)
    : 0;
  const fitScore = positiveAverage - negativeWeight * 0.35;
  const rawFit = fitScore >= 18 ? 2 : fitScore >= 12 ? 1.2 : fitScore >= 7 ? 0.6 : positiveAverage <= 1 && negativeWeight >= 10 ? -0.8 : positiveAverage <= 3 ? -0.4 : 0;
  return Number((rawFit * fitMultiplier).toFixed(1));
}

function formatTeamPowerOptionLabel(
  power: LegacyTeamPowerOption,
  disciplineCategory?: string | null,
  conditionalActive = false,
  disciplineId?: string | null,
  disciplineWeights?: Array<{ disciplineId: string; attributeKey: string; weightPct: number }> | null,
) {
  const targetCategory = getTeamPowerCategoryForDiscipline(disciplineCategory);
  const isFit = power.category === "flex" || power.category === targetCategory;
  const fitMultiplier = isFit ? 1 : 0.6;
  const effectiveModifier = Number((power.modifier * fitMultiplier).toFixed(1));
  const effectiveExtra = conditionalActive ? Number((power.conditionalBonusPct * fitMultiplier).toFixed(1)) : 0;
  const attributeFit = calculateTeamPowerAttributeFitPctForUi(power, disciplineId, disciplineWeights, fitMultiplier);
  const source = power.source === "facility" ? "Facility" : "Team";
  const isDebuffEffect = isTeamPowerDebuffEffect(power.effectType);
  const sign = isDebuffEffect ? "-" : "+";
  const debuffHint = isDebuffEffect ? " · wirkt gegen Gegner, nicht auf deinen Score" : "";
  return `${power.label} · ${getTeamPowerEffectLabel(power)} · ${getTeamPowerCategoryLabel(power.category)} · ${sign}${formatDecimalScore(effectiveModifier, 1)}%${effectiveExtra ? ` +${formatDecimalScore(effectiveExtra, 1)}% Extra` : ""}${attributeFit ? ` · Fit ${attributeFit > 0 ? "+" : ""}${formatDecimalScore(attributeFit, 1)}% (${formatTeamPowerAttributeTags(power)})` : ` · Tags ${formatTeamPowerAttributeTags(power)}`} · ${power.chargesRemaining}/${power.chargesTotal} · ${source}${isFit ? "" : " · Off-Fit"}${debuffHint}`;
}

function formatModifierSourceLabel(source: LegacyModifierSourceSummary | null | undefined) {
  if (!source) {
    return "Quelle fehlt";
  }
  if (source.selectionStatus === "missing_source") {
    return "Quelle fehlt";
  }
  if (source.effectStatus === "pending_source") {
    return "Auswahl bereit · Effekt offen";
  }
  return "Bereit";
}

function buildDraftStateFromAiPreview(preview: AiLegacyLineupPreview) {
  const nextSelections: Record<string, string> = {};
  for (const entry of preview.entries) {
    nextSelections[`${entry.disciplineId}::${entry.disciplineSide}::${entry.slotIndex}`] = entry.activePlayerId ?? "";
  }

  return {
    selections: nextSelections,
    captains: {
      d1: preview.d1.captainSelectionStatus === "selected" ? preview.d1.captainActivePlayerId ?? "" : "",
      d2: preview.d2.captainSelectionStatus === "selected" ? preview.d2.captainActivePlayerId ?? "" : "",
    } satisfies Record<"d1" | "d2", string>,
  };
}

function buildEntriesFromDraftState(
  draftState: LegacyLineupDraft["entries"] | { selections: Record<string, string> },
  slots: ReturnType<typeof buildLegacyLineupLabSlots>,
  playerOptions: ReturnType<typeof buildLegacyLineupLabPlayerOptions>,
  captains?: Record<"d1" | "d2", string>,
) {
  const selections =
    "selections" in draftState
      ? draftState.selections
      : Object.fromEntries(
          draftState.map((entry) => [
            `${entry.disciplineId}::${entry.disciplineSide}::${entry.slotIndex}`,
            entry.activePlayerId ?? "",
          ]),
        );

  const baseEntries = buildLegacyLineupEntriesFromSelections({
    slots,
    selections,
    playerOptions,
  });

  if (!captains) {
    return baseEntries;
  }

  return baseEntries.map((entry) => ({
    ...entry,
    isCaptain: captains[entry.disciplineSide] === entry.activePlayerId,
  }));
}

function defaultParamsFromProps(props: LegacyLineupLabClientProps) {
  return {
    saveId: props.defaultSaveId ?? "",
    seasonId: props.defaultSeasonId ?? "season-1",
    matchdayId: props.defaultMatchdayId ?? "matchday-1",
    teamId: props.defaultTeamId ?? "",
  };
}

const LEGACY_LINEUP_EXPERT_MODE_STORAGE_KEY = "legacy-lineup-expert-mode-v1";

function loadLegacyLineupExpertModePreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(LEGACY_LINEUP_EXPERT_MODE_STORAGE_KEY) === "true";
}

function buildLineupMeta(context: LegacyLineupLoadedContext | null, selections: Record<string, string>) {
  const d1 = context?.matchdayContract?.discipline1 ?? null;
  const d2 = context?.matchdayContract?.discipline2 ?? null;
  const countSelected = (disciplineId: string | null | undefined, disciplineSide: "d1" | "d2") =>
    Object.keys(selections).filter((key) => key.startsWith(`${disciplineId}::${disciplineSide}::`) && selections[key]).length;

  return {
    d1,
    d2,
    d1Selected: d1 ? countSelected(d1.disciplineId, "d1") : 0,
    d2Selected: d2 ? countSelected(d2.disciplineId, "d2") : 0,
  };
}

export default function LegacyLineupLabClient(props: LegacyLineupLabClientProps) {
  const uiVariant = props.uiVariant ?? "classic";
  // "Neuer Look" Flag (additiv): Hook läuft unverändert vor allen anderen Hooks;
  // das eigentliche Gate sitzt NACH allen Hooks/Derivations (siehe vor `const inner`).
  const [params, setParams] = useState(() => defaultParamsFromProps(props));
  const [source, setSource] = useState<"sqlite" | "prisma">(props.initialSource ?? "sqlite");
  const [options, setOptions] = useState<LabOptions>({
    saves: [],
    seasons: [],
    matchdays: [],
    teams: [],
  });
  const [context, setContext] = useState<LegacyLineupLoadedContext | null>(null);
  const [draft, setDraft] = useState<LegacyLineupDraft | null>(null);
  const [preview, setPreview] = useState<LegacyLineupPreviewResult | null>(null);
  const [aiPreview, setAiPreview] = useState<AiLegacyLineupPreview | null>(null);
  const [aiBatchPreview, setAiBatchPreview] = useState<AiBatchPreviewEntry[]>([]);
  const [aiBatchSummary, setAiBatchSummary] = useState<{
    totalTeams: number;
    readyTeams: number;
    warningTeams: number;
    blockedTeams: number;
  } | null>(null);
  const [aiBatchApplyFeed, setAiBatchApplyFeed] = useState<AiBatchApplyResponse | null>(null);
  const [aiBatchIncludeWarnings, setAiBatchIncludeWarnings] = useState(false);
  const [aiBatchOverwriteExisting, setAiBatchOverwriteExisting] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [teamIntensity, setTeamIntensity] = useState<MatchdayIntensityStage>("normal");
  const [captains, setCaptains] = useState<Record<"d1" | "d2", string>>({ d1: "", d2: "" });
  const [modifiers, setModifiers] = useState<LineupDraftModifiers>(() => createEmptyLineupModifiers());
  const [isBusy, setIsBusy] = useState(false);
  const loadContextRequestKeyRef = useRef<string>("");
  const loadContextAbortRef = useRef<AbortController | null>(null);
  const previewRequestKeyRef = useRef<string>("");
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewSequenceRef = useRef(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("");
  const [sourceReadOnly, setSourceReadOnly] = useState<boolean>(source === "prisma");
  const [roomContext, setRoomContext] = useState<FoundationRoomContext | null>(null);
  const [playerFilter, setPlayerFilter] = useState("");
  const [focusV2CandidateTab, setFocusV2CandidateTab] = useState<LegacyLineupCandidateTab>("all");
  // v1 decision-clarity default: land on "Frei" (undeployed players) so the rail leads with the
  // players who still need a slot — each already carries its "Bester Slot"-Empfehlung. Users can
  // still switch back to "Alle"/"Eingesetzt"/"Blockiert" via the Teamdeck-Filter buttons.
  const [teamdeckFilterMode, setTeamdeckFilterMode] = useState<TeamdeckFilterMode>("free");
  const [teamdeckSortMode, setTeamdeckSortMode] = useState<TeamdeckSortMode>("fit");
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null);
  const [showOnlyTopSlotCandidates, setShowOnlyTopSlotCandidates] = useState(false);
  const [recentlyAssignedSlotKey, setRecentlyAssignedSlotKey] = useState<string | null>(null);
  // Increments on every real candidate assignment (click, digit-key, Enter top-pick) regardless of
  // which slot ends up focused afterwards — lets the v2 board flash its score feedback reliably even
  // though focus usually jumps to the next open slot in the same tick as the assignment.
  const [lineupAssignPulse, setLineupAssignPulse] = useState(0);
  const [lineupUndoSnapshot, setLineupUndoSnapshot] = useState<LegacyLineupUndoSnapshot | null>(null);
  const [hoveredCandidate, setHoveredCandidate] = useState<LegacyLineupHoveredCandidate | null>(null);
  const hoveredCandidateDebounceRef = useRef<number | null>(null);
  const scheduleHoveredCandidate = useCallback((candidate: LegacyLineupHoveredCandidate | null) => {
    if (hoveredCandidateDebounceRef.current != null) {
      window.clearTimeout(hoveredCandidateDebounceRef.current);
      hoveredCandidateDebounceRef.current = null;
    }
    if (candidate == null) {
      setHoveredCandidate(null);
      return;
    }
    hoveredCandidateDebounceRef.current = window.setTimeout(() => {
      setHoveredCandidate(candidate);
      hoveredCandidateDebounceRef.current = null;
    }, 24);
  }, []);
  const [showManagedTeams, setShowManagedTeams] = useState(false);
  const [draggedActivePlayerId, setDraggedActivePlayerId] = useState<string | null>(null);
  const [focusedDisciplineSide, setFocusedDisciplineSide] = useState<"d1" | "d2">("d1");
  const [activeMissingHighlightKey, setActiveMissingHighlightKey] = useState<string | null>(null);
  const [internalDraftBoardView, setInternalDraftBoardView] = useState<"lineup" | "formBoard">(
    props.draftBoardView ?? props.initialDraftBoardView ?? "lineup",
  );
  const draftBoardView = props.draftBoardView ?? internalDraftBoardView;
  const setDraftBoardView = (view: "lineup" | "formBoard") => {
    props.onDraftBoardViewChange?.(view);
    if (props.draftBoardView == null) {
      setInternalDraftBoardView(view);
    }
  };

  useEffect(() => {
    if (props.draftBoardView) {
      setInternalDraftBoardView(props.draftBoardView);
    } else if (props.initialDraftBoardView) {
      setInternalDraftBoardView(props.initialDraftBoardView);
    }
  }, [props.draftBoardView, props.initialDraftBoardView]);

  useEffect(() => {
    if (props.initialDraftBoardView === "formBoard") {
      pendingFormBoardFocusRef.current = true;
    }
  }, [props.initialDraftBoardView]);

  const [formCardPlanPendingKey, setFormCardPlanPendingKey] = useState<string | null>(null);
  const [activeFormPickCell, setActiveFormPickCell] = useState<{
    matchdayId: string;
    disciplineSide: "d1" | "d2";
    slot: "primary" | "secondary";
    disciplineId: string | null;
    disciplineColor: LegacyFormCardOption["color"] | null;
  } | null>(null);
  const formCardPlanSaveTimerRef = useRef<number | null>(null);
  const pendingFormBoardFocusRef = useRef(false);
  const [expertPlayerTableScrollTop, handleExpertPlayerTableScroll] = useRafThrottledScrollTop();
  const [expertPlayerTableViewportHeight, setExpertPlayerTableViewportHeight] = useState(560);
  const expertPlayerTableShellRef = useRef<HTMLDivElement | null>(null);
  const pendingFormCardPlanRef = useRef<{
    matchdayId: string;
    disciplineSide: "d1" | "d2";
    disciplineId: string | null;
    primaryFormCardId: string | null;
    secondaryFormCardId: string | null;
  } | null>(null);
  const [isPreviewPanelOpen, setIsPreviewPanelOpen] = useState(false);
  const [isAiPreviewPanelOpen, setIsAiPreviewPanelOpen] = useState(false);
  const [matchdayScorePreview, setMatchdayScorePreview] = useState<MatchdayMvpScoringResponse | null>(null);
  const [visibleScoreboardSide, setVisibleScoreboardSide] = useState<"d1" | "d2" | null>(null);
  const [scoreboardReveal, setScoreboardReveal] = useState<Record<"d1" | "d2", { form: boolean; mutators: boolean }>>({
    d1: { form: false, mutators: false },
    d2: { form: false, mutators: false },
  });
  const [isExpertModeEnabled, setIsExpertModeEnabled] = useState<boolean>(() => loadLegacyLineupExpertModePreference());
  const [tablePreferences, setTablePreferences] = useState<LegacyLineupTablePreferences>(() =>
    loadLegacyLineupTablePreferences(),
  );
  const autoFlowReadyRef = useRef(false);
  const lastAutoPersistKeyRef = useRef("");
  const lastAutoPreviewKeyRef = useRef("");
  const lastAiInsightKeyRef = useRef("");
  const skipNextAutoPersistRef = useRef(false);
  const recentlyAssignedSlotTimeoutRef = useRef<number | null>(null);
  const lastMissingFocusRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (recentlyAssignedSlotTimeoutRef.current) {
        window.clearTimeout(recentlyAssignedSlotTimeoutRef.current);
      }
      if (formCardPlanSaveTimerRef.current) {
        window.clearTimeout(formCardPlanSaveTimerRef.current);
      }
    };
  }, []);
  useEffect(() => {
    setRoomContext(props.roomContext ?? readFoundationRoomContextFromLocation());
  }, [props.roomContext]);

  function withRoomQuery(query: URLSearchParams) {
    if (props.activeOwnerId) {
      query.set("activeOwnerId", props.activeOwnerId);
    }
    const teamId = query.get("teamId") ?? params.teamId;
    const controlMode = options.teams.find((team) => team.id === teamId)?.controlMode ?? null;
    if (controlMode) {
      query.set("controlMode", controlMode);
    }
    if (teamId) {
      query.set("activeManagerTeamId", teamId);
    }
    return appendRoomContextToParams(query, roomContext);
  }

  const resolvedPreview = preview?.ok ? preview : null;
  const d1Label = context?.matchdayContract?.discipline1?.displayName ?? "—";
  const d2Label = context?.matchdayContract?.discipline2?.displayName ?? "—";
  const d1Rank = resolveTeamDisciplineRank(
    context?.teamDisciplineRanks,
    context?.matchdayContract?.discipline1?.disciplineId,
    context?.matchdayContract?.discipline1?.displayName,
  );
  const d2Rank = resolveTeamDisciplineRank(
    context?.teamDisciplineRanks,
    context?.matchdayContract?.discipline2?.disciplineId,
    context?.matchdayContract?.discipline2?.displayName,
  );
  const disciplineAreaRoadmap = useMemo(() => {
    if (!context) {
      return [];
    }

    const categoryOrder: DisciplineCategory[] = ["power", "speed", "mental", "social"];
    const disciplineMetaById = new Map(context.disciplines.map((discipline) => [discipline.id, discipline]));
    const activeDisciplineIds = new Set(
      [context.matchdayContract?.discipline1?.disciplineId, context.matchdayContract?.discipline2?.disciplineId].filter(
        (disciplineId): disciplineId is string => Boolean(disciplineId),
      ),
    );
    const scheduleEntries = [...(context.seasonDisciplineSchedule ?? [])]
      .filter((entry) => entry.seasonId === context.season.id)
      .sort((left, right) => left.matchdayIndex - right.matchdayIndex);

    const timelineEntries =
      scheduleEntries.length > 0
        ? scheduleEntries.flatMap((entry) =>
            [entry.discipline1, entry.discipline2].flatMap((discipline, disciplineOrder) => {
              if (!discipline?.disciplineId) {
                return [];
              }
              const meta = disciplineMetaById.get(discipline.disciplineId);
              const category = (discipline.category as DisciplineCategory | null | undefined) ?? meta?.category ?? null;
              if (!category) {
                return [];
              }
              return [
                {
                  disciplineId: discipline.disciplineId,
                  label: discipline.displayName ?? meta?.name ?? discipline.disciplineId,
                  category,
                  playerCount:
                    discipline.playerCount ??
                    context.seasonDisciplineConfigs.find((config) => config.disciplineId === discipline.disciplineId)?.playerCount ??
                    null,
                  matchdayIndex: entry.matchdayIndex,
                  order: disciplineOrder,
                },
              ];
            }),
          )
        : [...context.seasonDisciplineConfigs]
            .sort((left, right) =>
              sortDisciplineTimelineEntries(
                {
                  matchdayIndex: Math.floor((left.displayOrder ?? left.originalOrder ?? 0) / 2) + 1,
                  order: (left.displayOrder ?? left.originalOrder ?? 0) % 2,
                  label: disciplineMetaById.get(left.disciplineId)?.name ?? left.disciplineId,
                },
                {
                  matchdayIndex: Math.floor((right.displayOrder ?? right.originalOrder ?? 0) / 2) + 1,
                  order: (right.displayOrder ?? right.originalOrder ?? 0) % 2,
                  label: disciplineMetaById.get(right.disciplineId)?.name ?? right.disciplineId,
                },
              ),
            )
            .flatMap((config, index) => {
              const meta = disciplineMetaById.get(config.disciplineId);
              if (!meta) {
                return [];
              }
              return [
                {
                  disciplineId: config.disciplineId,
                  label: meta.name,
                  category: meta.category,
                  playerCount: config.playerCount ?? null,
                  matchdayIndex: Math.floor(index / 2) + 1,
                  order: index % 2,
                },
              ];
            });

    const itemsByCategory = new Map<
      DisciplineCategory,
      Array<{
        disciplineId: string;
        label: string;
        shortLabel: string;
        rank: number | null;
        playerCount: number | null;
        isCurrent: boolean;
        isPast: boolean;
      }>
    >(categoryOrder.map((category) => [category, []]));

    for (const entry of timelineEntries) {
      const items = itemsByCategory.get(entry.category);
      if (!items) {
        continue;
      }
      items.push({
        disciplineId: entry.disciplineId,
        label: entry.label,
        shortLabel: formatCompactDisciplineCode(entry.label),
        rank: resolveTeamDisciplineRank(context.teamDisciplineRanks, entry.disciplineId, entry.label),
        playerCount: entry.playerCount ?? null,
        isCurrent: activeDisciplineIds.has(entry.disciplineId),
        isPast: entry.matchdayIndex < context.matchday.index && !activeDisciplineIds.has(entry.disciplineId),
      });
    }

    return categoryOrder
      .map((category) => ({
        key: category,
        label: getDisciplineAreaLabel(category),
        color: getDisciplineAreaColor(category),
        items: itemsByCategory.get(category) ?? [],
      }))
      .filter((group) => group.items.length > 0);
  }, [context]);

  const slots = useMemo(() => (context ? buildLegacyLineupLabSlots(context) : []), [context]);
  const playerOptions = useMemo(() => (context ? buildLegacyLineupLabPlayerOptions(context) : []), [context]);
  const lineupMeta = useMemo(() => buildLineupMeta(context, selections), [context, selections]);
  const entries = useMemo(() => {
    const baseEntries = buildLegacyLineupEntriesFromSelections({
      slots,
      selections,
      playerOptions,
    });
    // Captain ist PRO DISZIPLIN-SEITE gesetzt (`captains.d1` / `captains.d2`, Regel:
    // perDisciplineSideMaxCaptains = 1). Vorher wurde hier nur ein flaches Set der
    // Spieler-IDs gebildet — die Seite fiel weg. Steht derselbe Spieler auf beiden Seiten
    // in der Aufstellung, galt er dadurch auf BEIDEN als Captain, obwohl er nur für eine
    // gesetzt wurde: die Saison-Zählung sprang auf 2/3 und im Feld trugen zwei Slots das
    // C-Abzeichen. Der Vergleich muss die Seite einschließen — genau so, wie es der
    // Draft-Speicherpfad weiter oben bereits tut.
    return baseEntries.map((entry) => ({
      ...entry,
      isCaptain: Boolean(entry.activePlayerId) && captains[entry.disciplineSide] === entry.activePlayerId,
    }));
  }, [captains, playerOptions, selections, slots]);
  const captainSeasonLimit = context?.teamStatus?.captainSlots ?? context?.captainRule?.seasonCaptainSlots ?? context?.matchdayContract?.seasonCaptainSlots ?? 3;
  const captainUsedBeforeCurrentDraftSideKeys = useMemo(() => {
    const existingDraftCaptainKeys = new Set(
      (context?.existingDraft?.entries ?? [])
        .filter((entry) => entry.isCaptain)
        .map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
    );
    const seasonCaptainKeys = new Set(context?.teamStatus?.captainUsedSides ?? []);
    for (const key of existingDraftCaptainKeys) {
      seasonCaptainKeys.delete(key);
    }
    return seasonCaptainKeys;
  }, [context?.existingDraft?.entries, context?.teamStatus?.captainUsedSides]);
  const captainUsedBeforeCurrentDraft = useMemo(() => {
    if ((context?.teamStatus?.captainUsedSides ?? []).length > 0) {
      return captainUsedBeforeCurrentDraftSideKeys.size;
    }
    const existingDraftCaptainCount = new Set(
      (context?.existingDraft?.entries ?? [])
        .filter((entry) => entry.isCaptain)
        .map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
    ).size;
    return Math.max(0, (context?.teamStatus?.captainUsedCount ?? 0) - existingDraftCaptainCount);
  }, [captainUsedBeforeCurrentDraftSideKeys.size, context?.existingDraft?.entries, context?.teamStatus?.captainUsedCount, context?.teamStatus?.captainUsedSides]);
  const currentDraftCaptainSideKeys = useMemo(() => {
    const keys: string[] = [];
    if (captains.d1 && context?.matchdayContract?.discipline1?.disciplineId) {
      keys.push(`${context.matchdayContract.discipline1.disciplineId}::d1`);
    }
    if (captains.d2 && context?.matchdayContract?.discipline2?.disciplineId) {
      keys.push(`${context.matchdayContract.discipline2.disciplineId}::d2`);
    }
    return new Set(keys);
  }, [captains.d1, captains.d2, context?.matchdayContract?.discipline1?.disciplineId, context?.matchdayContract?.discipline2?.disciplineId]);
  const captainDraftAllowedCount = Math.max(0, captainSeasonLimit - captainUsedBeforeCurrentDraft);
  const captainDraftUsedCount = currentDraftCaptainSideKeys.size;
  const captainSeasonUsedWithDraft = Math.min(captainSeasonLimit, captainUsedBeforeCurrentDraft + captainDraftUsedCount);
  const captainDraftRemaining = Math.max(0, captainDraftAllowedCount - captainDraftUsedCount);
  const captainBudgetExceeded = captainUsedBeforeCurrentDraft + captainDraftUsedCount > captainSeasonLimit;
  const getDisciplineIntensity = useCallback(
    (disciplineSide: "d1" | "d2") => modifiers[disciplineSide]?.intensity ?? teamIntensity,
    [modifiers.d1.intensity, modifiers.d2.intensity, teamIntensity],
  );
  const draftStateKey = useMemo(
    () =>
      JSON.stringify({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        teamId: params.teamId,
        source,
        entries,
        modifiers,
      }),
    [entries, modifiers, params.matchdayId, params.saveId, params.seasonId, params.teamId, source],
  );
  const duplicateSelections = useMemo(() => findDuplicateActivePlayerSelections(selections), [selections]);
  const activeSaveLabel = useMemo(() => {
    return options.saves.find((save) => save.id === params.saveId)?.name ?? props.defaultSaveName ?? params.saveId ?? "—";
  }, [options.saves, params.saveId, props.defaultSaveName]);
  const powerPointsRows = useMemo<LineupPowerPointsRow[]>(() => {
    const rows = (context?.allTeamIdentities ?? []).map((team) => ({
      teamCode: team.teamCode,
      pow: team.pow,
      spe: team.spe,
      men: team.men,
      soc: team.soc,
      pps: team.pow + team.spe + team.men + team.soc,
    }));

    return [...rows]
      .sort((left, right) => {
        if (right.pps !== left.pps) {
          return right.pps - left.pps;
        }
        return left.teamCode.localeCompare(right.teamCode, "de");
      })
      .map((row, index) => ({
        rank: index + 1,
        ...row,
      }));
  }, [context?.allTeamIdentities]);
  const visibleMatchdayScoreboard = useMemo<MatchdayMvpScoreboardRowView[]>(() => {
    if (!matchdayScorePreview || !visibleScoreboardSide) {
      return [];
    }

    const rows = visibleScoreboardSide === "d1" ? matchdayScorePreview.d1Scoreboard : matchdayScorePreview.d2Scoreboard;
    const revealState = scoreboardReveal[visibleScoreboardSide];
    const showResultLayer = Boolean(revealState.form && revealState.mutators);
    const rankedByBase = [...rows]
      .sort((left, right) => {
        if (right.baseScore !== left.baseScore) {
          return right.baseScore - left.baseScore;
        }
        return left.teamName.localeCompare(right.teamName, "de");
      })
      .map((row, index) => ({ teamId: row.teamId, rank: index + 1 }));
    const baseRankByTeamId = new Map(rankedByBase.map((entry) => [entry.teamId, entry.rank]));

    return rows.map((row) => {
      const baseRank = baseRankByTeamId.get(row.teamId) ?? row.rank;
      const fatigueModifier = row.fatigueStatus === "mapped" ? row.fatigueModifier ?? 0 : 0;
      const captainModifier = row.captainStatus === "mapped" ? row.captainModifier ?? 0 : 0;
      return {
        ...row,
        baseRank,
        rankDelta: baseRank - row.rank,
        lossScore: Number(fatigueModifier.toFixed(1)),
        currentScore: Number((row.baseScore + fatigueModifier).toFixed(1)),
        captainScore: row.captainStatus === "mapped" ? Number(captainModifier.toFixed(1)) : null,
        formScore: row.formCardStatus === "ready" ? Number((row.formCardModifier ?? 0).toFixed(1)) : null,
        bonusScore: row.teamPpsStatus === "ready" ? Number((row.teamPpsModifier ?? 0).toFixed(1)) : 0,
      };
    }).sort((left, right) => {
      if (showResultLayer) {
        return left.rank - right.rank;
      }
      if (left.baseRank !== right.baseRank) {
        return left.baseRank - right.baseRank;
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });
  }, [matchdayScorePreview, scoreboardReveal, visibleScoreboardSide]);
  const visibleTopPlayers = useMemo<MatchdayMvpTopPlayerRow[]>(() => {
    if (!matchdayScorePreview || !visibleScoreboardSide) {
      return [];
    }

    return visibleScoreboardSide === "d1"
      ? matchdayScorePreview.d1TopPlayers ?? []
      : matchdayScorePreview.d2TopPlayers ?? [];
  }, [matchdayScorePreview, visibleScoreboardSide]);
  const visibleScoreboardReveal = visibleScoreboardSide ? scoreboardReveal[visibleScoreboardSide] : null;
  const isScoreboardResultRevealed = Boolean(visibleScoreboardReveal?.form && visibleScoreboardReveal?.mutators);
  const playerRows = useMemo<LineupPlayerTableRow[]>(() => {
    if (!context) {
      return [];
    }

    const d1DisciplineId = context.matchdayContract?.discipline1?.disciplineId ?? null;
    const d2DisciplineId = context.matchdayContract?.discipline2?.disciplineId ?? null;
    const scoreMap = new Map(context.disciplineScores.map((entry) => [`${entry.playerId}::${entry.disciplineId}`, entry.score] as const));
    const demandMap = buildLineupPlayerDemandMap({
      seasonId: context.season.id,
      teamId: context.team.id,
      rosterPlayers: context.rosterPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        traitsPositive: player.traitsPositive ?? [],
        traitsNegative: player.traitsNegative ?? [],
        disciplineRatings: Object.fromEntries(
          context.disciplines.map((discipline) => [
            discipline.id,
            scoreMap.get(`${player.id}::${discipline.id}`) ?? 0,
          ]),
        ),
        coreStats: player.coreStats,
        attributeSheetStats: player.attributeStats ?? undefined,
        pps: player.pps ?? null,
        ovr: player.ovr ?? null,
      })),
      matchdayDisciplines: [
        context.matchdayContract?.discipline1
          ? {
              id: context.matchdayContract.discipline1.disciplineId,
              name: context.matchdayContract.discipline1.displayName,
              category: context.matchdayContract.discipline1.category as DisciplineCategory,
              playerCount: context.matchdayContract.discipline1.requiredPlayers,
            }
          : null,
        context.matchdayContract?.discipline2
          ? {
              id: context.matchdayContract.discipline2.disciplineId,
              name: context.matchdayContract.discipline2.displayName,
              category: context.matchdayContract.discipline2.category as DisciplineCategory,
              playerCount: context.matchdayContract.discipline2.requiredPlayers,
            }
          : null,
      ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      playerSeasonAppearances: Object.fromEntries(
        context.rosterPlayers.map((player) => [player.id, context.fatigueByPlayerId?.[player.id]?.count ?? 0] as const),
      ),
    });
    const activePlayerByPlayerId = new Map(
      context.activePlayers.map((entry) => [
        entry.playerId,
        {
          activePlayerId: entry.id,
          contractLength: entry.contractLength ?? null,
          marketValue: entry.marketValue ?? null,
        },
      ]),
    );

    const filteredRows = context.rosterPlayers
      .map((player) => {
        const activePlayer = activePlayerByPlayerId.get(player.id);
        return {
          id: player.id,
          activePlayerId: activePlayer?.activePlayerId ?? null,
          portraitUrl: getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, null),
          name: player.name,
          teamName: context.team.name,
          contractLength: activePlayer?.contractLength ?? null,
          className: player.className ?? null,
          potential: player.potential ?? null,
          discipline1Score: d1DisciplineId ? scoreMap.get(`${player.id}::${d1DisciplineId}`) ?? null : null,
          discipline2Score: d2DisciplineId ? scoreMap.get(`${player.id}::${d2DisciplineId}`) ?? null : null,
          appearances: context.fatigueByPlayerId?.[player.id]?.count ?? null,
          marketValue: player.displayMarketValue ?? activePlayer?.marketValue ?? null,
          playerOvr: player.ovr ?? null,
          playerPps: player.pps ?? null,
          coreStats: player.coreStats ?? null,
          traitsPositive: player.traitsPositive ?? [],
          traitsNegative: player.traitsNegative ?? [],
          injuryStatus: player.injuryStatus ?? null,
          injuryRiskLabel: player.injuryRiskLabel ?? null,
          availabilityBlocker: player.availabilityBlocker ?? null,
          demands: (demandMap.get(player.id) ?? []).map((demand) => ({
            demandId: demand.demandId,
            label: demand.label,
            detail: demand.detail,
            targetDisciplineId: demand.targetDisciplineId ?? null,
            status: demand.status,
            priority: demand.priority,
            moraleReward: demand.moraleReward,
            moralePenalty: demand.moralePenalty,
          })),
          attributeStats: player.attributeStats ?? null,
          attributeRatings: player.attributeRatings ?? null,
        };
      })
      .filter((player) => {
        if (!playerFilter.trim()) {
          return true;
        }
        const needle = playerFilter.trim().toLowerCase();
        return [
          player.name,
          player.teamName,
          player.className ?? "",
          formatTraitList(player.traitsPositive),
          formatTraitList(player.traitsNegative),
        ].some((value) => value.toLowerCase().includes(needle));
      });

    const sortState = tablePreferences.lineupPlayerTable?.sortState ?? null;
    if (!sortState) {
      return filteredRows;
    }

    const accessors: Record<string, (row: LineupPlayerTableRow) => string | number> = {
      image: (row) => row.name,
      name: (row) => row.name,
      team: (row) => row.teamName,
      contractLength: (row) => row.contractLength ?? Number.NEGATIVE_INFINITY,
      className: (row) => row.className ?? "",
      potential: (row) => row.potential ?? Number.NEGATIVE_INFINITY,
      discipline1Score: (row) => row.discipline1Score ?? Number.NEGATIVE_INFINITY,
      discipline2Score: (row) => row.discipline2Score ?? Number.NEGATIVE_INFINITY,
      appearances: (row) => row.appearances ?? Number.NEGATIVE_INFINITY,
      marketValue: (row) => row.marketValue ?? Number.NEGATIVE_INFINITY,
      traitsPositive: (row) => formatTraitList(row.traitsPositive),
      traitsNegative: (row) => formatTraitList(row.traitsNegative),
    };
    const accessor = accessors[sortState.key];
    if (!accessor) {
      return filteredRows;
    }

    return [...filteredRows].sort((left, right) => {
      const result = compareLegacyLineupSortValues(accessor(left), accessor(right));
      return sortState.direction === "asc" ? result : -result;
    });
  }, [context, playerFilter, tablePreferences.lineupPlayerTable?.sortState]);

  const expertPlayerTableVirtualWindow = useRowVirtualWindow({
    count: playerRows.length,
    scrollTop: expertPlayerTableScrollTop,
    viewportHeight: expertPlayerTableViewportHeight,
  });
  const visibleExpertPlayerRows = useMemo(
    () => playerRows.slice(expertPlayerTableVirtualWindow.start, expertPlayerTableVirtualWindow.end),
    [expertPlayerTableVirtualWindow.end, expertPlayerTableVirtualWindow.start, playerRows],
  );

  useEffect(() => {
    const node = expertPlayerTableShellRef.current;
    if (!node || !isExpertModeEnabled) {
      return;
    }
    const syncHeight = () => setExpertPlayerTableViewportHeight(node.clientHeight || 560);
    syncHeight();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncHeight) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [isExpertModeEnabled, playerRows.length]);

  const filteredTeamOptions = useMemo(() => {
    const currentTeam = options.teams.find((team) => team.id === params.teamId) ?? null;
    if (showManagedTeams) {
      return options.teams;
    }

    const manualTeams = options.teams.filter((team) => (team.controlMode ?? "manual") === "manual");
    if (!currentTeam || manualTeams.some((team) => team.id === currentTeam.id)) {
      return manualTeams;
    }

    return [currentTeam, ...manualTeams];
  }, [options.teams, params.teamId, showManagedTeams]);
  const selectedTeamOption = useMemo(
    () => options.teams.find((team) => team.id === params.teamId) ?? null,
    [options.teams, params.teamId],
  );
  const isTeamManagementLocked = isFoundationTeamManagementLocked(params.teamId, props.manageableTeamIds);
  const isReadOnly = sourceReadOnly || isTeamManagementLocked;
  const selectedMatchdayOption = useMemo(
    () => options.matchdays.find((matchday) => matchday.id === params.matchdayId) ?? null,
    [options.matchdays, params.matchdayId],
  );
  const selectedTeamIsReady = Boolean(selectedTeamOption?.currentMatchdayReady);
  const selectedMatchdayIsReady = Boolean(selectedMatchdayOption?.isReady);
  const missingSeasonFormCards = Boolean(context && (context.formCards?.length ?? 0) === 0);
  const focusV2FormMiniChipsBySide = useMemo(() => {
    const buildSide = (disciplineSide: "d1" | "d2") => {
      const primaryCard =
        (context?.formCards ?? []).find((card) => card.id === modifiers[disciplineSide].primaryFormCardId) ?? null;
      const secondaryCard =
        (context?.formCards ?? []).find((card) => card.id === modifiers[disciplineSide].secondaryFormCardId) ?? null;
      return {
        primaryLabel: primaryCard ? `F1 ${formatFormCardValueLabel(primaryCard.value)}` : null,
        secondaryLabel: secondaryCard ? `F2+ ${formatFormCardValueLabel(secondaryCard.value)}` : null,
        hasSelection: Boolean(primaryCard || secondaryCard),
      };
    };
    return { d1: buildSide("d1"), d2: buildSide("d2") };
  }, [context?.formCards, modifiers]);
  const usedFormCards = useMemo(
    () => sortFormCardsForDiscipline((context?.formCards ?? []).filter((card) => card.isUsed)),
    [context?.formCards],
  );
  const formCardPlanByKey = useMemo(() => {
    const map = new Map<string, FormCardPlanRecord>();
    for (const plan of context?.formCardPlans ?? []) {
      map.set(`${plan.matchdayId}:${plan.disciplineSide}`, plan);
    }
    return map;
  }, [context?.formCardPlans]);
  const plannedFormCardIds = useMemo(() => {
    const set = new Set<string>();
    for (const plan of context?.formCardPlans ?? []) {
      if (plan.primaryFormCardId) set.add(plan.primaryFormCardId);
      if (plan.secondaryFormCardId) set.add(plan.secondaryFormCardId);
    }
    return set;
  }, [context?.formCardPlans]);
  const formPlanOpenCells = useMemo(() => {
    let count = 0;
    for (const entry of context?.seasonDisciplineSchedule ?? []) {
      for (const disciplineSide of ["d1", "d2"] as const) {
        const slot = disciplineSide === "d1" ? entry.discipline1 : entry.discipline2;
        if (!slot) continue;
        const plan = formCardPlanByKey.get(`${entry.matchdayId}:${disciplineSide}`);
        if (!plan?.primaryFormCardId && !plan?.secondaryFormCardId) {
          count += 1;
        }
      }
    }
    return count;
  }, [context?.seasonDisciplineSchedule, formCardPlanByKey]);

  useEffect(() => {
    if (draftBoardView !== "formBoard" || !context || !pendingFormBoardFocusRef.current) {
      return;
    }
    const firstOpenCell = resolveFirstOpenFormPickCell({
      schedule: context.seasonDisciplineSchedule ?? [],
      formCardPlanByKey,
      currentMatchdayId: params.matchdayId,
      getFormCardColorForCategory,
    });
    if (firstOpenCell) {
      setActiveFormPickCell(firstOpenCell);
      window.requestAnimationFrame(() => {
        document
          .querySelector(
            `[data-form-board-cell-id="${firstOpenCell.matchdayId}:${firstOpenCell.disciplineSide}:${firstOpenCell.slot}"]`,
          )
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
    pendingFormBoardFocusRef.current = false;
    props.onDraftBoardViewApplied?.();
  }, [context, draftBoardView, formCardPlanByKey, params.matchdayId, props.onDraftBoardViewApplied]);

  const formDeckCards = useMemo(
    () =>
      sortFormCardsForDiscipline(context?.formCards ?? []).map((card) => ({
        ...card,
        isReserved: plannedFormCardIds.has(card.id),
      })),
    [context?.formCards, plannedFormCardIds],
  );
  const formCardCounts = useMemo(() => {
    const cards = context?.formCards ?? [];
    return {
      positiveAvailable: cards.filter((card) => card.value > 0 && !card.isUsed).length,
      negativeAvailable: cards.filter((card) => card.value < 0 && !card.isUsed).length,
    };
  }, [context?.formCards]);
  const teamLogoUrl = useMemo(
    () =>
      context?.team
        ? getTeamLogoBrowserUrl(context.team.id, context.team.logoPath ?? null, { variant: "thumb" })
        : null,
    [context?.team],
  );
  const teamLogoInitials = useMemo(() => {
    const sourceName = context?.team?.name ?? selectedTeamOption?.name ?? "Team";
    return sourceName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [context?.team?.name, selectedTeamOption?.name]);
  const disciplineWeightInfo = useMemo(() => {
    const d1DisciplineId = context?.matchdayContract?.discipline1?.disciplineId ?? null;
    const d2DisciplineId = context?.matchdayContract?.discipline2?.disciplineId ?? null;
    return {
      d1: getTopAttributeWeights(context?.disciplineWeights, d1DisciplineId),
      d2: getTopAttributeWeights(context?.disciplineWeights, d2DisciplineId),
    };
  }, [
    context?.disciplineWeights,
    context?.matchdayContract?.discipline1?.disciplineId,
    context?.matchdayContract?.discipline2?.disciplineId,
  ]);
  // Rechenkern in lib/lineups/lineup-candidate-model.ts (buildMatchdayRosterCards) —
  // duenne Huelle, identische Eingaben wie vorher inline.
  const matchdayRosterCards = useMemo<MatchdayRosterCard[]>(
    () =>
      buildMatchdayRosterCards({
        playerRows,
        selections,
        slots,
        discipline1Label: context?.matchdayContract?.discipline1?.displayName ?? "D1",
        discipline2Label: context?.matchdayContract?.discipline2?.displayName ?? "D2",
        disciplineWeightInfo,
      }),
    [context?.matchdayContract?.discipline1?.displayName, context?.matchdayContract?.discipline2?.displayName, disciplineWeightInfo, playerRows, selections, slots],
  );
  const rosterCardByActivePlayerId = useMemo(() => {
    return new Map(
      matchdayRosterCards
        .filter((player) => Boolean(player.activePlayerId))
        .map((player) => [player.activePlayerId as string, player]),
    );
  }, [matchdayRosterCards]);
  const selectedDisciplineIdsByActivePlayerId = useMemo(() => {
    const next = new Map<string, Set<string>>();
    for (const slot of slots) {
      const activePlayerId = selections[slot.key] ?? "";
      if (!activePlayerId) {
        continue;
      }
      const disciplines = next.get(activePlayerId) ?? new Set<string>();
      disciplines.add(slot.disciplineId);
      next.set(activePlayerId, disciplines);
    }
    return next;
  }, [selections, slots]);
  const matchdayDisciplineIds = useMemo(
    () =>
      new Set(
        [
          context?.matchdayContract?.discipline1?.disciplineId ?? null,
          context?.matchdayContract?.discipline2?.disciplineId ?? null,
        ].filter((disciplineId): disciplineId is string => Boolean(disciplineId)),
      ),
    [context?.matchdayContract?.discipline1?.disciplineId, context?.matchdayContract?.discipline2?.disciplineId],
  );
  const moraleDecisions = useMemo<LineupMoraleDecision[]>(() => {
    const captainIdsByDisciplineId = new Map<string, string>();
    if (captains.d1 && context?.matchdayContract?.discipline1?.disciplineId) {
      captainIdsByDisciplineId.set(context.matchdayContract.discipline1.disciplineId, captains.d1);
    }
    if (captains.d2 && context?.matchdayContract?.discipline2?.disciplineId) {
      captainIdsByDisciplineId.set(context.matchdayContract.discipline2.disciplineId, captains.d2);
    }

    return matchdayRosterCards.flatMap((player) => {
      const selectedDisciplineIds = player.activePlayerId
        ? selectedDisciplineIdsByActivePlayerId.get(player.activePlayerId) ?? new Set<string>()
        : new Set<string>();
      const selectedAnywhere = selectedDisciplineIds.size > 0;

      return player.demands
        .map<LineupMoraleDecision | null>((demand) => {
          const targetDisciplineId = demand.targetDisciplineId ?? null;
          const isCaptainDemand = demand.label === "Captain-Rolle";
          const isAppearanceDemand = demand.label.includes("Einsätze");
          const isDisciplineDemand = Boolean(targetDisciplineId);
          const isRelevant =
            isAppearanceDemand ||
            (targetDisciplineId ? matchdayDisciplineIds.has(targetDisciplineId) : !isCaptainDemand);

          if (!isRelevant) {
            return null;
          }

          const fulfilled = isCaptainDemand
            ? Boolean(
                player.activePlayerId &&
                  targetDisciplineId &&
                  captainIdsByDisciplineId.get(targetDisciplineId) === player.activePlayerId,
              )
            : isDisciplineDemand && targetDisciplineId
              ? selectedDisciplineIds.has(targetDisciplineId)
              : selectedAnywhere;
          const moraleDelta = fulfilled
            ? getDemandMoraleValue(Math.max(0, demand.moraleReward), demand.priority)
            : getDemandMoraleValue(demand.moralePenalty, demand.priority);

          return {
            playerId: player.id,
            activePlayerId: player.activePlayerId,
            playerName: player.name,
            demandId: demand.demandId,
            label: demand.label,
            detail: demand.detail,
            priority: demand.priority,
            targetDisciplineId,
            fulfilled,
            isRelevant,
            moraleDelta,
          };
        })
        .filter((entry): entry is LineupMoraleDecision => Boolean(entry));
    });
  }, [
    captains.d1,
    captains.d2,
    context?.matchdayContract?.discipline1?.disciplineId,
    context?.matchdayContract?.discipline2?.disciplineId,
    matchdayDisciplineIds,
    matchdayRosterCards,
    selectedDisciplineIdsByActivePlayerId,
  ]);
  const moraleDecisionByDemandId = useMemo(
    () => new Map(moraleDecisions.map((decision) => [decision.demandId, decision] as const)),
    [moraleDecisions],
  );
  const moraleDecisionsByActivePlayerId = useMemo(() => {
    const next = new Map<string, LineupMoraleDecision[]>();
    for (const decision of moraleDecisions) {
      if (!decision.activePlayerId) {
        continue;
      }
      const list = next.get(decision.activePlayerId) ?? [];
      list.push(decision);
      next.set(decision.activePlayerId, list);
    }
    return next;
  }, [moraleDecisions]);
  const lineupMoraleSummary = useMemo(() => {
    const fulfilled = moraleDecisions.filter((decision) => decision.fulfilled);
    const atRisk = moraleDecisions.filter((decision) => !decision.fulfilled && decision.isRelevant);
    const netDelta = moraleDecisions.reduce((sum, decision) => sum + decision.moraleDelta, 0);
    const urgent = [...atRisk]
      .sort((left, right) => {
        const priorityScore = { high: 3, medium: 2, low: 1 };
        if (priorityScore[right.priority] !== priorityScore[left.priority]) {
          return priorityScore[right.priority] - priorityScore[left.priority];
        }
        return left.moraleDelta - right.moraleDelta;
      })
      .slice(0, 3);
    const positive = [...fulfilled]
      .sort((left, right) => right.moraleDelta - left.moraleDelta)
      .slice(0, 3);

    return {
      fulfilledCount: fulfilled.length,
      atRiskCount: atRisk.length,
      netDelta: Number(netDelta.toFixed(1)),
      urgent,
      positive,
    };
  }, [moraleDecisions]);
  const captainSideByActivePlayerId = useMemo(() => {
    const next = new Map<string, "d1" | "d2">();
    if (captains.d1) {
      next.set(captains.d1, "d1");
    }
    if (captains.d2) {
      next.set(captains.d2, "d2");
    }
    return next;
  }, [captains.d1, captains.d2]);

  const slotRoleByKey = useMemo(() => {
    const d1Roles = resolveSlotRolesForDiscipline(
      context?.matchdayContract?.discipline1?.disciplineId ?? null,
      context?.matchdayContract?.discipline1?.displayName ?? null,
      context?.matchdayContract?.discipline1?.requiredPlayers ?? null,
    );
    const d2Roles = resolveSlotRolesForDiscipline(
      context?.matchdayContract?.discipline2?.disciplineId ?? null,
      context?.matchdayContract?.discipline2?.displayName ?? null,
      context?.matchdayContract?.discipline2?.requiredPlayers ?? null,
    );

    return new Map<string, MatchdaySlotRoleDefinition | null>(
      slots.map((slot) => {
        const roleForSlot = (
          slot.disciplineSide === "d1" ? d1Roles[slot.slotIndex] ?? null : d2Roles[slot.slotIndex] ?? null
        ) as MatchdaySlotRoleDefinition | null;
        return [slot.key, roleForSlot] as const;
      }),
    );
  }, [
    context?.matchdayContract?.discipline1?.disciplineId,
    context?.matchdayContract?.discipline1?.displayName,
    context?.matchdayContract?.discipline1?.requiredPlayers,
    context?.matchdayContract?.discipline2?.disciplineId,
    context?.matchdayContract?.discipline2?.displayName,
    context?.matchdayContract?.discipline2?.requiredPlayers,
    slots,
  ]);

  const slotRolesByDisciplineSide = useMemo(() => {
    const next: Record<"d1" | "d2", MatchdaySlotRoleDefinition[]> = { d1: [], d2: [] };
    for (const slot of slots) {
      const role = slotRoleByKey.get(slot.key);
      if (role) {
        next[slot.disciplineSide].push(role);
      }
    }
    return next;
  }, [slotRoleByKey, slots]);

  const activeSlot = useMemo(() => {
    return (
      slots.find((slot) => slot.key === activeSlotKey) ??
      slots.find((slot) => !selections[slot.key]) ??
      slots[0] ??
      null
    );
  }, [activeSlotKey, selections, slots]);
  const nextOpenSlotKey = useMemo(
    () => slots.find((slot) => !selections[slot.key])?.key ?? null,
    [selections, slots],
  );
  const nextOpenSlot = useMemo(
    () => slots.find((slot) => slot.key === nextOpenSlotKey) ?? null,
    [nextOpenSlotKey, slots],
  );
  const activeSlotRole = activeSlot ? slotRoleByKey.get(activeSlot.key) ?? null : null;

  useEffect(() => {
    if (!activeSlot) {
      return;
    }
    setFocusedDisciplineSide(activeSlot.disciplineSide);
    setTeamdeckSortMode("fit");
  }, [activeSlot?.disciplineSide, activeSlot?.key]);

  useEffect(() => {
    if (activeSlotKey || !nextOpenSlotKey) {
      return;
    }
    setActiveSlotKey(nextOpenSlotKey);
  }, [activeSlotKey, nextOpenSlotKey]);

  useEffect(() => {
    if (typeof window === "undefined" || uiVariant !== "focusV2") {
      return;
    }
    const raw = window.sessionStorage.getItem("lineup-v2-return-focus");
    if (!raw) {
      return;
    }
    try {
      const payload = JSON.parse(raw) as { matchdayId?: string; teamId?: string };
      if (payload.matchdayId && payload.matchdayId !== params.matchdayId) {
        return;
      }
      if (payload.teamId && payload.teamId !== params.teamId) {
        return;
      }
      window.sessionStorage.removeItem("lineup-v2-return-focus");
      if (nextOpenSlotKey) {
        setActiveSlotKey(nextOpenSlotKey);
        window.setTimeout(() => scrollLineupTarget(`lineup-slot-${nextOpenSlotKey}`), 120);
      }
    } catch {
      window.sessionStorage.removeItem("lineup-v2-return-focus");
    }
  }, [nextOpenSlotKey, params.matchdayId, params.teamId, uiVariant]);

  useEffect(() => {
    const requestKey = props.focusMissingRequestKey ?? null;
    if (!props.highlightMissingSlots || !requestKey || lastMissingFocusRequestKeyRef.current === requestKey || slots.length === 0) {
      return;
    }
    const nextOpenSlot = slots.find((slot) => !selections[slot.key]) ?? null;
    if (!nextOpenSlot) {
      return;
    }
    lastMissingFocusRequestKeyRef.current = requestKey;
    setActiveMissingHighlightKey(requestKey);
    setActiveSlotKey(nextOpenSlot.key);
    setFocusedDisciplineSide(nextOpenSlot.disciplineSide);
    setShowOnlyTopSlotCandidates(true);
    setMessage(`${nextOpenSlot.disciplineSide.toUpperCase()}-${nextOpenSlot.slotIndex + 1} ist noch offen und wurde markiert.`);
    window.setTimeout(() => scrollLineupTarget(`lineup-slot-${nextOpenSlot.key}`), 120);
    window.setTimeout(() => {
      setActiveMissingHighlightKey((current) => (current === requestKey ? null : current));
    }, 12000);
  }, [props.focusMissingRequestKey, props.highlightMissingSlots, selections, slots]);

  const activeTeamCaptain = useMemo(() => {
    const gameStateForCaptain = props.embeddedGameState ?? context?.gameState ?? null;
    const teamId = context?.teamId ?? params.teamId;
    if (!gameStateForCaptain || !teamId) return null;
    return selectTeamCaptain(gameStateForCaptain, teamId);
  }, [props.embeddedGameState, context?.gameState, context?.teamId, params.teamId]);

  const rivalryPressureByDiscipline = useMemo(() => {
    const rivalryPressureReductionPct = activeTeamCaptain?.effects.rivalryPressureReductionPct ?? 0;
    return Object.fromEntries(
      Object.entries(context?.teamPowerWindows ?? {}).map(([disciplineId, window]) => {
        const topRank = Math.min(...(window?.top8Rivals ?? []).map((rival) => rival.rank));
        const pressure = Number.isFinite(topRank) ? (topRank <= 3 ? 1.5 : 1) : 0;
        // "Ruhepol" captain effect: a strong captain calms rivalry-driven push strain.
        return [disciplineId, applyCaptainRivalryPressureReduction(pressure, rivalryPressureReductionPct)] as const;
      }),
    );
  }, [context?.teamPowerWindows, activeTeamCaptain]);
  const getRivalryPressureForDiscipline = (disciplineId: string | null | undefined) =>
    disciplineId ? rivalryPressureByDiscipline[disciplineId] ?? 0 : 0;

  // Intensitaet je Seite als Wert statt Closure — die verschobenen Rechenkerne in
  // lib/lineups/lineup-candidate-model.ts nehmen Daten, keine Funktionen entgegen.
  const intensityBySide = useMemo(
    () => ({ d1: getDisciplineIntensity("d1"), d2: getDisciplineIntensity("d2") }),
    [getDisciplineIntensity],
  );

  // Rechenkern in lib/lineups/lineup-candidate-model.ts (buildSlotPreviewByKey) —
  // duenne Huelle, identische Eingaben wie vorher inline.
  const slotPreviewByKey = useMemo(
    () =>
      buildSlotPreviewByKey({
        slots,
        selections,
        playerOptions,
        rosterCardByActivePlayerId,
        resolvedPreview,
        slotRoleByKey,
        intensityBySide,
        context,
        captains,
        rivalryPressureByDiscipline,
      }),
    [
      captains,
      context,
      intensityBySide,
      playerOptions,
      resolvedPreview,
      rosterCardByActivePlayerId,
      rivalryPressureByDiscipline,
      selections,
      slotRoleByKey,
      slots,
    ],
  );
  const captainCandidateInfoBySide = useMemo(() => {
    const getPriorityMultiplier = (priority: "low" | "medium" | "high") => {
      if (priority === "high") return 1.15;
      if (priority === "low") return 0.7;
      return 1;
    };

    return Object.fromEntries(
      (["d1", "d2"] as const).map((disciplineSide) => {
        const discipline =
          disciplineSide === "d1"
            ? context?.matchdayContract?.discipline1 ?? null
            : context?.matchdayContract?.discipline2 ?? null;
        const entries = slots
          .filter((slot) => slot.disciplineSide === disciplineSide)
          .map((slot) => {
            const activePlayerId = selections[slot.key] ?? "";
            const player = getSelectedOptionMeta(activePlayerId);
            const rosterCard = rosterCardByActivePlayerId.get(activePlayerId) ?? null;
            const slotPreview = slotPreviewByKey.get(slot.key) ?? null;
            const captainDemand =
              rosterCard?.demands.find(
                (demand) =>
                  demand.label === "Captain-Rolle" &&
                  (!demand.targetDisciplineId || demand.targetDisciplineId === discipline?.disciplineId),
              ) ?? null;
            const estimatedBase =
              slotPreview?.projected.totalProjected ?? player?.disciplineScores[discipline?.disciplineId ?? ""] ?? null;
            const estimatedCaptainBonus = estimatedBase == null ? null : Number((estimatedBase * 0.5).toFixed(1));
            const moraleReward =
              captainDemand == null
                ? null
                : Number((Math.max(0, captainDemand.moraleReward) * getPriorityMultiplier(captainDemand.priority)).toFixed(1));

            return {
              activePlayerId,
              playerName: player?.name ?? rosterCard?.name ?? "Spieler",
              estimatedBase,
              estimatedCaptainBonus,
              captainDemand,
              moraleReward,
            };
          })
          .filter((entry) => Boolean(entry.activePlayerId));

        return [disciplineSide, entries] as const;
      }),
    ) as Record<
      "d1" | "d2",
      Array<{
        activePlayerId: string;
        playerName: string;
        estimatedBase: number | null;
        estimatedCaptainBonus: number | null;
        captainDemand: LineupPlayerTableRow["demands"][number] | null;
        moraleReward: number | null;
      }>
    >;
  }, [
    context?.matchdayContract?.discipline1,
    context?.matchdayContract?.discipline2,
    rosterCardByActivePlayerId,
    selections,
    slotPreviewByKey,
    slots,
  ]);
  // Rechenkern in lib/lineups/lineup-candidate-model.ts (buildSlotCandidateSummaryByKey) —
  // duenne Huelle, identische Eingaben wie vorher inline (inkl. Bug-T-002-Fix und
  // Projektions-vor-Slice-Reihenfolge, siehe Kommentar dort).
  const slotCandidateSummaryByKey = useMemo(
    () =>
      buildSlotCandidateSummaryByKey({
        slots,
        selections,
        playerOptions,
        slotPreviewByKey,
        slotRoleByKey,
        rosterCardByActivePlayerId,
        captainSideByActivePlayerId,
        context,
        intensityBySide,
        rivalryPressureByDiscipline,
      }),
    [
      captainSideByActivePlayerId,
      context,
      intensityBySide,
      playerOptions,
      rivalryPressureByDiscipline,
      rosterCardByActivePlayerId,
      selections,
      slotPreviewByKey,
      slotRoleByKey,
      slots,
    ],
  );
  // Rechenkern in lib/lineups/lineup-candidate-model.ts (buildPlayerBestSlotSummaryByActivePlayerId).
  const playerBestSlotSummaryByActivePlayerId = useMemo(
    () =>
      buildPlayerBestSlotSummaryByActivePlayerId({
        playerOptions,
        slots,
        rosterCardByActivePlayerId,
        slotRoleByKey,
        context,
        intensityBySide,
        rivalryPressureByDiscipline,
        slotPreviewByKey,
      }),
    [context, intensityBySide, playerOptions, rivalryPressureByDiscipline, rosterCardByActivePlayerId, slotPreviewByKey, slotRoleByKey, slots],
  );

  // Rechenkern in lib/lineups/lineup-candidate-model.ts (buildActiveSlotCandidateByActivePlayerId).
  const activeSlotCandidateByActivePlayerId: Map<string, ActiveSlotCandidate> = useMemo(
    () =>
      buildActiveSlotCandidateByActivePlayerId({
        activeSlot,
        captainSideByActivePlayerId,
        context,
        intensityBySide,
        playerOptions,
        rosterCardByActivePlayerId,
        slotPreviewByKey,
        slotRoleByKey,
        rivalryPressureByDiscipline,
      }),
    [activeSlot, captainSideByActivePlayerId, context, intensityBySide, playerOptions, rosterCardByActivePlayerId, rivalryPressureByDiscipline, slotPreviewByKey, slotRoleByKey],
  );

  const activeSlotCandidateSummary = activeSlot ? slotCandidateSummaryByKey.get(activeSlot.key) ?? null : null;

  // Rechenkern in lib/lineups/lineup-candidate-model.ts (buildTeamdeckCandidateEntries) —
  // entscheidet, welcher Spieler beim Druecken von "1" im Teamdeck landet.
  const teamdeckCandidateEntries: TeamdeckCandidateEntry[] = useMemo(
    () =>
      buildTeamdeckCandidateEntries({
        activeSlot,
        selections,
        activeSlotCandidateSummary,
        activeSlotCandidateByActivePlayerId,
        matchdayRosterCards,
        playerBestSlotSummaryByActivePlayerId,
        context,
        focusedDisciplineSide,
        teamdeckFilterMode,
        teamdeckSortMode,
      }),
    [
      activeSlot,
      activeSlotCandidateByActivePlayerId,
      activeSlotCandidateSummary,
      context,
      focusedDisciplineSide,
      matchdayRosterCards,
      playerBestSlotSummaryByActivePlayerId,
      selections,
      teamdeckFilterMode,
      teamdeckSortMode,
    ],
  );
  // Rechenkern in lib/lineups/lineup-candidate-model.ts (buildTeamdeckCandidateGroups).
  const teamdeckCandidateGroups: TeamdeckCandidateGroup[] = useMemo(
    () => buildTeamdeckCandidateGroups({ teamdeckCandidateEntries, showOnlyTopSlotCandidates, teamdeckFilterMode }),
    [showOnlyTopSlotCandidates, teamdeckCandidateEntries, teamdeckFilterMode],
  );
  // Mirrors the v2 focus board's own candidate-tab + search filtering exactly (same helper,
  // same source list), so keyboard digit-shortcuts always match what the user visually sees
  // there instead of a separately-computed "spotlight" list.
  const focusV2VisibleCandidates = useMemo(() => {
    if (uiVariant !== "focusV2") {
      return [];
    }
    return filterLegacyLineupCandidateEntries(teamdeckCandidateGroups, focusV2CandidateTab, playerFilter);
  }, [focusV2CandidateTab, playerFilter, teamdeckCandidateGroups, uiVariant]);
  const activeSlotSpotlightGroups = useMemo(() => {
    return teamdeckCandidateGroups
      .filter((group) => group.key !== "blocked" && group.entries.length > 0)
      .map((group) => ({
        ...group,
        entries: group.entries.slice(0, group.key === "instant" ? 3 : 2),
      }))
      .filter((group) => group.entries.length > 0);
  }, [teamdeckCandidateGroups]);
  const activeSlotSpotlightCandidates = useMemo(() => {
    return activeSlotSpotlightGroups.flatMap((group) => group.entries).slice(0, 6);
  }, [activeSlotSpotlightGroups]);
  const slotDragPreviewByKey = useMemo(() => {
    if (!draggedActivePlayerId) {
      return new Map<string, MatchdaySlotDragPreviewCard>();
    }

    const draggedOption = getSelectedOptionMeta(draggedActivePlayerId);
    const draggedRosterCard = rosterCardByActivePlayerId.get(draggedActivePlayerId) ?? null;
    if (!draggedOption || !draggedRosterCard) {
      return new Map<string, MatchdaySlotDragPreviewCard>();
    }

    const normalizedClassName = normalizeClassHintToken(draggedRosterCard.className);
    const previews = slots.map((slot) => {
      const role = slotRoleByKey.get(slot.key) ?? null;
      const baseScore = draggedOption.disciplineScores[slot.disciplineId] ?? null;
      const projected = calculateMatchdayProjectedPreview({
        baseScore,
        role,
        attributeStats: draggedRosterCard.attributeStats ?? null,
        currentFatigueCount: draggedOption.fatigueCount ?? null,
        requiredPlayers: context?.disciplinePlayerCounts[slot.disciplineId] ?? null,
        intensity: getDisciplineIntensity(slot.disciplineSide),
        knownModifierBonus: 0,
        revealVariance: 0,
        rivalryPressure: getRivalryPressureForDiscipline(slot.disciplineId),
      });
      const slotRuleLabel =
        role?.classHints?.length && normalizedClassName
          ? role.classHints.some((hint) => normalizeClassHintToken(hint) === normalizedClassName)
            ? `Slot-Regel ok: ${role.classHints.join(" / ")}`
            : `Off-Role: ${role.classHints.join(" / ")}`
          : role?.classHints?.length
            ? `Slot-Regel: ${role.classHints.join(" / ")}`
            : null;
      const blockReason = resolveLegacyLineupDragBlockReason({
        availabilityBlocker: draggedRosterCard.availabilityBlocker,
        selectedSides: draggedRosterCard.selectedSides,
        targetDisciplineSide: slot.disciplineSide,
        captainSide: captainSideByActivePlayerId.get(draggedActivePlayerId) ?? null,
        hasBaseScore: baseScore != null,
      });
      const currentProjectedScore = slotPreviewByKey.get(slot.key)?.projected.totalProjected ?? null;
      return {
        slotKey: slot.key,
        activePlayerId: draggedActivePlayerId,
        disciplineSide: slot.disciplineSide,
        projected,
        currentProjectedScore,
        scoreDelta:
          projected.totalProjected != null && currentProjectedScore != null
            ? Number((projected.totalProjected - currentProjectedScore).toFixed(1))
            : null,
        blockReason,
        fitTier: "blocked" as const,
        slotRuleLabel,
      };
    });

    const bestProjectedScore = previews.reduce<number | null>((best, preview) => {
      if (preview.blockReason || preview.projected.totalProjected == null) {
        return best;
      }
      if (best == null || preview.projected.totalProjected > best) {
        return preview.projected.totalProjected;
      }
      return best;
    }, null);

    return new Map(
      previews.map((preview) => [
        preview.slotKey,
        {
          ...preview,
          fitTier: getLegacyLineupDragFitTier({
            blocked: Boolean(preview.blockReason),
            projectedScore: preview.projected.totalProjected,
            bestProjectedScore,
            currentProjectedScore: preview.currentProjectedScore,
          }),
        },
      ]),
    );
  }, [captainSideByActivePlayerId, context?.disciplinePlayerCounts, draggedActivePlayerId, getDisciplineIntensity, rivalryPressureByDiscipline, rosterCardByActivePlayerId, slotPreviewByKey, slotRoleByKey, slots]);

  const visibleTopPlayerCards = useMemo(() => {
    const scoreboardByTeamId = new Map(visibleMatchdayScoreboard.map((entry) => [entry.teamId, entry]));
    const captainActivePlayerId = visibleScoreboardSide ? captains[visibleScoreboardSide] : "";

    return visibleTopPlayers.slice(0, 10).map((entry) => {
      const playerRow = playerRows.find((player) => player.id === entry.playerId) ?? null;
      const rosterCard = playerRow?.activePlayerId ? rosterCardByActivePlayerId.get(playerRow.activePlayerId) ?? null : null;
      const teamScore = scoreboardByTeamId.get(entry.teamId) ?? null;
      const isCaptain =
        Boolean(captainActivePlayerId) &&
        Boolean(playerRow?.activePlayerId) &&
        playerRow?.activePlayerId === captainActivePlayerId;
      const badges = [
        isCaptain ? "Captain" : null,
        teamScore?.formCardStatus === "ready" && (teamScore.formCardModifier ?? 0) !== 0 ? "Formkarte" : null,
        (entry.mutatorPpsBonus ?? 0) > 0 || (entry.mutatorScoreBonus ?? 0) > 0 ? "Mutator" : null,
        (playerRow?.appearances ?? 0) > 0 ? "Fatigue" : null,
        entry.rankInDiscipline <= 3 ? "Highlight" : null,
      ].filter((badge): badge is string => Boolean(badge));

      return {
        ...entry,
        portraitUrl: playerRow?.portraitUrl ?? null,
        className: playerRow?.className ?? null,
        activePlayerId: playerRow?.activePlayerId ?? null,
        fatigueCount: playerRow?.appearances ?? null,
        rosterCard,
        badges,
      };
    });
  }, [captains, playerRows, rosterCardByActivePlayerId, visibleMatchdayScoreboard, visibleScoreboardSide, visibleTopPlayers]);

  const visibleResultBoardSummary = useMemo(() => {
    if (!visibleScoreboardSide || visibleMatchdayScoreboard.length === 0) {
      return null;
    }

    const winner = visibleMatchdayScoreboard[0] ?? null;
    const runnerUp = visibleMatchdayScoreboard[1] ?? null;
    const disciplineLabel =
      visibleScoreboardSide === "d1"
        ? matchdayScorePreview?.targetMatchday.d1DisciplineName ?? d1Label
        : matchdayScorePreview?.targetMatchday.d2DisciplineName ?? d2Label;

    if (!winner) {
      return null;
    }

    const message = runnerUp
      ? `${winner.teamName} führt ${disciplineLabel} mit ${formatDecimalScore(winner.score, 1)} vor ${runnerUp.teamName} an.`
      : `${winner.teamName} führt ${disciplineLabel} an.`;

    return {
      disciplineLabel,
      winner,
      runnerUp,
      message,
    };
  }, [d1Label, d2Label, matchdayScorePreview, visibleMatchdayScoreboard, visibleScoreboardSide]);

  const matchdayHeaderSummary = useMemo(() => {
    if (!context?.team || !context?.matchday) {
      return "Spieltag wird geladen…";
    }
    const d1Required = context.matchdayContract?.discipline1?.requiredPlayers ?? 0;
    const d2Required = context.matchdayContract?.discipline2?.requiredPlayers ?? 0;
    const totalRequired = d1Required + d2Required;
    const captainCount = [captains.d1, captains.d2].filter(Boolean).length;
    return `${context?.team.name ?? "Team"} · Spieltag ${context?.matchday.index ?? "—"} · ${d1Label} ${lineupMeta.d1Selected}/${d1Required || "—"} · ${d2Label} ${lineupMeta.d2Selected}/${d2Required || "—"} · Lineup ${lineupMeta.d1Selected + lineupMeta.d2Selected}/${totalRequired || "—"} · Captain ${captainSeasonUsedWithDraft}/${captainSeasonLimit} (${captainCount} heute)`;
  }, [captainSeasonLimit, captainSeasonUsedWithDraft, captains.d1, captains.d2, context?.matchday.index, context?.matchdayContract?.discipline1?.requiredPlayers, context?.matchdayContract?.discipline2?.requiredPlayers, context?.team.name, d1Label, d2Label, lineupMeta.d1Selected, lineupMeta.d2Selected]);

  const previewPanelWarnings = useMemo(() => {
    const nextWarnings = [...warnings];
    if (resolvedPreview?.validation?.warnings?.length) {
      nextWarnings.push(...resolvedPreview.validation.warnings);
    }
    if (captainBudgetExceeded) {
      nextWarnings.push(`Captain-Limit ueberschritten: ${captainUsedBeforeCurrentDraft + captainDraftUsedCount}/${captainSeasonLimit}`);
    }
    if (captains.d1 && !slots.some((slot) => slot.disciplineSide === "d1" && selections[slot.key] === captains.d1)) {
      nextWarnings.push("Captain D1 ohne Slotspieler");
    }
    if (captains.d2 && !slots.some((slot) => slot.disciplineSide === "d2" && selections[slot.key] === captains.d2)) {
      nextWarnings.push("Captain D2 ohne Slotspieler");
    }
    if ((resolvedPreview?.disciplineSideScores ?? []).some((entry) => (entry.missingPlayers ?? 0) > 0)) {
      nextWarnings.push("Lineup unvollständig");
    }
    for (const preview of slotPreviewByKey.values()) {
      nextWarnings.push(...preview.projected.warnings);
    }
    return Array.from(new Set(nextWarnings));
  }, [captainBudgetExceeded, captainDraftUsedCount, captainSeasonLimit, captainUsedBeforeCurrentDraft, captains.d1, captains.d2, resolvedPreview?.disciplineSideScores, resolvedPreview?.validation?.warnings, selections, slotPreviewByKey, slots, warnings]);

  // Rechenkern in lib/lineups/lineup-audit.ts (buildMatchdayPreviewCards).
  const matchdayPreviewCards = useMemo(
    () =>
      buildMatchdayPreviewCards({
        resolvedPreview,
        slots,
        slotPreviewByKey,
        d1RequiredPlayers: context?.matchdayContract?.discipline1?.requiredPlayers ?? 0,
        d2RequiredPlayers: context?.matchdayContract?.discipline2?.requiredPlayers ?? 0,
        lineupMetaD1Selected: lineupMeta.d1Selected,
        lineupMetaD2Selected: lineupMeta.d2Selected,
      }),
    [
      context?.matchdayContract?.discipline1?.requiredPlayers,
      context?.matchdayContract?.discipline2?.requiredPlayers,
      lineupMeta.d1Selected,
      lineupMeta.d2Selected,
      resolvedPreview,
      slotPreviewByKey,
      slots,
    ],
  );

  const focusV2DisciplineTacticPreviewBySide = useMemo(() => {
    const buildForSide = (disciplineSide: "d1" | "d2") => {
      const filledCount = slots.filter((slot) => slot.disciplineSide === disciplineSide && selections[slot.key]).length;
      const currentIntensity = getDisciplineIntensity(disciplineSide);
      const currentTotal = disciplineSide === "d1" ? matchdayPreviewCards.d1Projected : matchdayPreviewCards.d2Projected;
      const estimate = (targetIntensity: MatchdayIntensityStage) => {
        if (filledCount === 0 || currentTotal == null) return null;
        const deltaPerSlot =
          getMatchdayIntensityConfig(targetIntensity).scoreModifier - getMatchdayIntensityConfig(currentIntensity).scoreModifier;
        return Number((currentTotal + deltaPerSlot * filledCount).toFixed(1));
      };
      return {
        conserve: estimate("conserve"),
        normal: estimate("normal"),
        push: estimate("push"),
      };
    };
    return { d1: buildForSide("d1"), d2: buildForSide("d2") };
  }, [
    getDisciplineIntensity,
    matchdayPreviewCards.d1Projected,
    matchdayPreviewCards.d2Projected,
    selections,
    slots,
  ]);

  /**
   * Bandbreite (Confidence-Band) der Disziplin-Projektion je Intensitaetsstufe.
   *
   * Kein neues Modell: pro Slot wird DIESELBE Projektionsfunktion
   * `calculateMatchdayProjectedPreview` mit der jeweils hypothetischen Intensitaet
   * erneut aufgerufen (gleiche Eingaben wie in `slotPreviewByKey`, nur `intensity`
   * getauscht). Die Aggregation auf Disziplin-Ebene ist byte-identisch zu der,
   * die `matchdayPreviewCards.d1RangeLow/d1RangeHigh` bereits fuer die AKTIVE
   * Intensitaet nutzt:
   *   low  = Σ (slot.rangeLow  ?? slot.totalProjected ?? 0) ueber alle Slots der Seite
   *   high = Σ (slot.rangeHigh ?? slot.totalProjected ?? 0) ueber alle Slots der Seite
   * Leere Slots liefern baseScore=null → totalProjected/rangeLow/rangeHigh = null
   * und tragen damit 0 bei. Ist keine Seite besetzt, bleibt der Eintrag null
   * (gleiche Null-Regel wie beim Punktwert in focusV2DisciplineTacticPreviewBySide).
   */
  const focusV2DisciplineTacticRangeBySide = useMemo(() => {
    const buildForSide = (disciplineSide: "d1" | "d2") => {
      const sidePreviews = slots
        .filter((slot) => slot.disciplineSide === disciplineSide)
        .map((slot) => slotPreviewByKey.get(slot.key))
        .filter((entry): entry is MatchdaySlotPreviewCard => Boolean(entry));
      const filledCount = sidePreviews.filter((entry) => entry.selectedScore != null).length;
      const estimateRange = (targetIntensity: MatchdayIntensityStage) => {
        if (filledCount === 0) return null;
        let low = 0;
        let high = 0;
        for (const entry of sidePreviews) {
          const projected = calculateMatchdayProjectedPreview({ ...entry.projectionInput, intensity: targetIntensity });
          low += projected.rangeLow ?? projected.totalProjected ?? 0;
          high += projected.rangeHigh ?? projected.totalProjected ?? 0;
        }
        return { low: Number(low.toFixed(1)), high: Number(high.toFixed(1)) };
      };
      return {
        conserve: estimateRange("conserve"),
        normal: estimateRange("normal"),
        push: estimateRange("push"),
      };
    };
    return { d1: buildForSide("d1"), d2: buildForSide("d2") };
  }, [slotPreviewByKey, slots]);

  const allAvailablePlayersDeployed = useMemo(() => {
    const totalActive = context?.activePlayers?.length ?? 0;
    if (totalActive === 0) return false;
    const assignedIds = new Set(entries.map((e) => e.activePlayerId).filter(Boolean));
    return assignedIds.size >= totalActive;
  }, [context?.activePlayers?.length, entries]);

  /**
   * Reicht der Kader ueberhaupt fuer die Plaetze dieses Spieltags? Ist er zu klein, laeuft die
   * Kandidatenliste irgendwann leer — und sagte bisher nur "Keine Kandidaten in dieser Gruppe".
   * Gemeldet als "spieler können nichtmehr in disziplinen eingesetzt werden". Der Hinweis nennt
   * die Zahlen und sagt, dass so anzutreten erlaubt ist.
   */
  const lineupRosterShortfall = useMemo(() => {
    const assignedPlayerCount = new Set(entries.map((entry) => entry.activePlayerId).filter(Boolean)).size;
    return describeLineupRosterShortfall({
      requiredSlots:
        (context?.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
        (context?.matchdayContract?.discipline2?.requiredPlayers ?? 0),
      availablePlayerCount: context?.activePlayers?.length ?? 0,
      rosterPlayerCount: context?.rosterPlayers?.length ?? 0,
      assignedPlayerCount,
    });
  }, [
    context?.activePlayers?.length,
    context?.matchdayContract?.discipline1?.requiredPlayers,
    context?.matchdayContract?.discipline2?.requiredPlayers,
    context?.rosterPlayers?.length,
    entries,
  ]);

  // Rechenkern in lib/lineups/lineup-audit.ts (computeLineupReadyToSave).
  const lineupReadyToSave = useMemo(
    () =>
      computeLineupReadyToSave({
        openSlots: matchdayPreviewCards.openSlots,
        allAvailablePlayersDeployed,
        duplicateSelectionsCount: duplicateSelections.length,
        captainBudgetExceeded,
        entriesCount: entries.length,
      }),
    [allAvailablePlayersDeployed, captainBudgetExceeded, duplicateSelections.length, entries.length, matchdayPreviewCards.openSlots],
  );

  const draftIntensityPreview = useMemo(
    () => ({
      baseScore: matchdayPreviewCards.totalBase,
      finalScore: matchdayPreviewCards.totalProjected,
      fatigue: matchdayPreviewCards.totalFatigue,
    }),
    [matchdayPreviewCards.totalBase, matchdayPreviewCards.totalFatigue, matchdayPreviewCards.totalProjected],
  );

  // Rechenkern in lib/lineups/lineup-audit.ts (buildLineupFlowSummary).
  const lineupFlowSummary = useMemo(
    () =>
      buildLineupFlowSummary({
        activeSlot,
        captainBudgetExceeded,
        captainDraftUsedCount,
        captainSeasonLimit,
        captainUsedBeforeCurrentDraft,
        captains,
        d1RequiredPlayers: context?.matchdayContract?.discipline1?.requiredPlayers ?? 0,
        d2RequiredPlayers: context?.matchdayContract?.discipline2?.requiredPlayers ?? 0,
        hasDraft: Boolean(draft),
        duplicateSelectionsCount: duplicateSelections.length,
        lineupMetaD1Selected: lineupMeta.d1Selected,
        lineupMetaD2Selected: lineupMeta.d2Selected,
        moraleAtRiskCount: lineupMoraleSummary.atRiskCount,
        moraleNetDelta: lineupMoraleSummary.netDelta,
        lineupReadyToSave,
        openSlots: matchdayPreviewCards.openSlots,
      }),
    [
      activeSlot,
      captainBudgetExceeded,
      captainDraftUsedCount,
      captainSeasonLimit,
      captainUsedBeforeCurrentDraft,
      captains.d1,
      captains.d2,
      context?.matchdayContract?.discipline1?.requiredPlayers,
      context?.matchdayContract?.discipline2?.requiredPlayers,
      draft,
      duplicateSelections.length,
      lineupMeta.d1Selected,
      lineupMeta.d2Selected,
      lineupMoraleSummary.atRiskCount,
      lineupMoraleSummary.netDelta,
      lineupReadyToSave,
      matchdayPreviewCards.openSlots,
    ],
  );
  const lineupCoachSteps = useMemo(() => {
    const slotsDone = lineupFlowSummary.totalRequired > 0 && matchdayPreviewCards.openSlots === 0;
    const hasDuplicates = duplicateSelections.length > 0;
    const saveDone = Boolean(draft);
    const selectedDetail =
      lineupFlowSummary.totalRequired > 0
        ? `${lineupFlowSummary.selectedCount}/${lineupFlowSummary.totalRequired}`
        : "bereit";
    const activeSlotDetail = activeSlot
      ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}`
      : slotsDone
        ? "alle Slots"
        : "Slot wählen";
    const formatIntensityLabel = (value: MatchdayIntensityStage) =>
      value === "conserve" ? "Schonen" : value === "push" ? "Push" : "Normal";
    const tacticLabel = `D1 ${formatIntensityLabel(getDisciplineIntensity("d1"))} · D2 ${formatIntensityLabel(getDisciplineIntensity("d2"))}`;
    return [
      {
        key: "focus",
        label: "Fokus",
        detail: activeSlotDetail,
        status: activeSlot || slotsDone ? "done" : "current",
      },
      {
        key: "assign",
        label: "Einsetzen",
        detail: slotsDone ? "voll" : `${matchdayPreviewCards.openSlots} offen · ${selectedDetail}`,
        status: slotsDone ? "done" : activeSlot ? "current" : "open",
      },
      {
        key: "captains",
        label: "Captain",
        detail: `${captainSeasonUsedWithDraft}/${captainSeasonLimit} Saison · ${captainDraftRemaining} übrig`,
        status: captainBudgetExceeded ? "blocked" : captains.d1 || captains.d2 ? "done" : "open",
      },
      {
        key: "morale",
        label: "Moral",
        detail: `${lineupMoraleSummary.fulfilledCount}/${lineupMoraleSummary.fulfilledCount + lineupMoraleSummary.atRiskCount || "—"} erfüllt · ${formatMoraleDelta(lineupMoraleSummary.netDelta)}`,
        status: lineupMoraleSummary.atRiskCount > 0 && lineupMoraleSummary.netDelta < 0 ? "current" : "done",
      },
      {
        key: "tactic",
        label: "Taktik",
        detail: tacticLabel,
        status: hasDuplicates || captainBudgetExceeded ? "blocked" : slotsDone ? "done" : "open",
      },
      {
        key: "save",
        label: "Speichern",
        detail: saveDone ? "gespeichert" : lineupReadyToSave ? "bereit" : "offen",
        status: saveDone ? "done" : lineupReadyToSave ? "current" : "open",
      },
      {
        key: "arena",
        label: "Arena",
        detail: saveDone ? "bereit" : "nach Save",
        status: saveDone ? "current" : "open",
      },
    ] as const;
  }, [
    activeSlot,
    captainBudgetExceeded,
    captainDraftRemaining,
    captainSeasonLimit,
    captainSeasonUsedWithDraft,
    captains.d1,
    captains.d2,
    draft,
    duplicateSelections.length,
    lineupFlowSummary.captainCount,
    lineupFlowSummary.selectedCount,
    lineupFlowSummary.totalRequired,
    lineupMoraleSummary.atRiskCount,
    lineupMoraleSummary.fulfilledCount,
    lineupMoraleSummary.netDelta,
    lineupReadyToSave,
    matchdayPreviewCards.openSlots,
    getDisciplineIntensity,
  ]);

	  const lineupMissingChips = useMemo(() => {
    const chips: Array<{
      key: string;
      label: string;
      detail: string;
      tone: "ready" | "warning" | "blocked";
    }> = [];
    const d1Required = context?.matchdayContract?.discipline1?.requiredPlayers ?? 0;
    const d2Required = context?.matchdayContract?.discipline2?.requiredPlayers ?? 0;
    const d1Open = Math.max(d1Required - lineupMeta.d1Selected, 0);
    const d2Open = Math.max(d2Required - lineupMeta.d2Selected, 0);

    if (d1Open > 0) {
      chips.push({
        key: "d1-open",
        label: `${d1Label}: ${d1Open} Slot${d1Open === 1 ? "" : "s"}`,
        detail: "Spieler einsetzen",
        tone: "warning",
      });
    }
    if (d2Open > 0) {
      chips.push({
        key: "d2-open",
        label: `${d2Label}: ${d2Open} Slot${d2Open === 1 ? "" : "s"}`,
        detail: "Spieler einsetzen",
        tone: "warning",
      });
    }
    if (duplicateSelections.length > 0) {
      chips.push({
        key: "duplicates",
        label: `${duplicateSelections.length} Doppelwahl`,
        detail: "Konflikt loesen",
        tone: "blocked",
      });
    }
    if (captainBudgetExceeded) {
      chips.push({
        key: "captain-budget",
        label: "Captain-Limit",
        detail: `${captainUsedBeforeCurrentDraft + captainDraftUsedCount}/${captainSeasonLimit} genutzt`,
        tone: "blocked",
      });
    } else if (!captains.d1 || !captains.d2) {
      chips.push({
        key: "captain-open",
        label: !captains.d1 && !captains.d2 ? "Captains offen" : !captains.d1 ? `${d1Label} Captain offen` : `${d2Label} Captain offen`,
        detail: "optional, aber oft ein sauberer Gratis-Boost",
        tone: "warning",
      });
    }
    if (previewPanelWarnings.length > 0 && chips.length < 5) {
      chips.push({
        key: "warnings",
        label: `${previewPanelWarnings.length} Hinweis${previewPanelWarnings.length === 1 ? "" : "e"}`,
        detail: "kurz prüfen",
        tone: "warning",
      });
    }
    if (lineupMoraleSummary.atRiskCount > 0 && chips.length < 5) {
      chips.push({
        key: "morale-risk",
        label: `${lineupMoraleSummary.atRiskCount} Forderung${lineupMoraleSummary.atRiskCount === 1 ? "" : "en"}`,
        detail: `Moral ${formatMoraleDelta(lineupMoraleSummary.netDelta)}`,
        tone: lineupMoraleSummary.netDelta < 0 ? "warning" : "ready",
      });
    }

    if (chips.length === 0) {
      chips.push({
        key: "ready",
        label: draft ? "Arena bereit" : "Bereit zum Speichern",
        detail: draft ? "Draft liegt vor" : "alles vollständig",
        tone: "ready",
      });
    }

	    return chips.slice(0, 5);
  }, [
    captainBudgetExceeded,
    captainDraftUsedCount,
    captainSeasonLimit,
    captainUsedBeforeCurrentDraft,
    captains.d1,
    captains.d2,
    context?.matchdayContract?.discipline1?.requiredPlayers,
    context?.matchdayContract?.discipline2?.requiredPlayers,
    d1Label,
    d2Label,
    draft,
    duplicateSelections.length,
    lineupMeta.d1Selected,
    lineupMeta.d2Selected,
    lineupMoraleSummary.atRiskCount,
    lineupMoraleSummary.netDelta,
	    previewPanelWarnings.length,
	  ]);
	  // Rechenkern in lib/lineups/lineup-audit.ts (buildLineupMiniAudit) — gatet das
	  // Speichern. Ein hier verlorenes Blocking-Item liesse eine ungueltige Aufstellung
	  // in einen Spieltag, der danach nicht mehr korrigierbar ist.
	  const lineupMiniAudit = useMemo(
	    () =>
	      buildLineupMiniAudit({
	        openSlots: matchdayPreviewCards.openSlots,
	        allAvailablePlayersDeployed,
	        selectedCount: lineupFlowSummary.selectedCount,
	        totalRequired: lineupFlowSummary.totalRequired,
	        duplicateSelectionsCount: duplicateSelections.length,
	        captainBudgetExceeded,
	        captainUsedBeforeCurrentDraft,
	        captainDraftUsedCount,
	        captainSeasonLimit,
	        captains,
	        d1Label,
	        d2Label,
	        captainSeasonUsedWithDraft,
	        missingSeasonFormCards,
	        moraleAtRiskCount: lineupMoraleSummary.atRiskCount,
	        moraleNetDelta: lineupMoraleSummary.netDelta,
	        previewWarningsCount: previewPanelWarnings.length,
	      }),
	    [
	      allAvailablePlayersDeployed,
	      captainBudgetExceeded,
	      captainDraftUsedCount,
	      captainSeasonLimit,
	      captainSeasonUsedWithDraft,
	      captainUsedBeforeCurrentDraft,
	      captains.d1,
	      captains.d2,
	      d1Label,
	      d2Label,
	      duplicateSelections.length,
	      lineupFlowSummary.selectedCount,
	      lineupFlowSummary.totalRequired,
	      lineupMoraleSummary.atRiskCount,
	      lineupMoraleSummary.netDelta,
	      matchdayPreviewCards.openSlots,
	      missingSeasonFormCards,
	      previewPanelWarnings.length,
	    ],
	  );
	  const aiInsightPreview = useMemo(() => {
	    if (selectedTeamOption?.controlMode !== "ai" || aiPreview?.teamId !== params.teamId) {
	      return null;
	    }
	    return aiPreview;
	  }, [aiPreview, params.teamId, selectedTeamOption?.controlMode]);
	  const duplicateSelectionIds = useMemo(() => new Set(duplicateSelections), [duplicateSelections]);
  // Rechenkern in lib/lineups/lineup-audit.ts (buildSlotIssuesByKey).
  const slotIssuesByKey = useMemo(
    () =>
      buildSlotIssuesByKey({
        slots,
        selections,
        playerOptions,
        rosterCardByActivePlayerId,
        slotPreviewByKey,
        duplicateSelectionIds,
        moraleDecisionsByActivePlayerId,
        activeSlotKey: activeSlot?.key ?? null,
      }),
    [activeSlot?.key, duplicateSelectionIds, moraleDecisionsByActivePlayerId, playerOptions, rosterCardByActivePlayerId, selections, slotPreviewByKey, slots],
  );
  const slotRoleAttributesByKey = useMemo(() => {
    return new Map(
      slots.map((slot) => {
        const role = slotRoleByKey.get(slot.key) ?? null;
        const selectedRosterCard = rosterCardByActivePlayerId.get(selections[slot.key] ?? "") ?? null;
        const roleAttributes = role?.keyAttributes
          ? role.keyAttributes.slice(0, 3).map((attribute) => ({
              key: attribute.attribute,
              shortLabel: attributeShortLabels[attribute.attribute] ?? attribute.attribute,
              ratingLabel: selectedRosterCard
                ? resolveAttributeGrade(
                    selectedRosterCard.attributeRatings,
                    attribute.attribute,
                    selectedRosterCard.attributeStats?.[attribute.attribute] ?? null,
                  )
                : null,
              emphasis: attribute.emphasis,
            }))
          : [];
        return [slot.key, roleAttributes] as const;
      }),
    );
  }, [rosterCardByActivePlayerId, selections, slotRoleByKey, slots]);
  const disciplineColorClassBySide = useMemo(() => {
    const buildSideClass = (disciplineSide: "d1" | "d2") => {
      const discipline =
        disciplineSide === "d1" ? context?.matchdayContract?.discipline1 ?? null : context?.matchdayContract?.discipline2 ?? null;
      const disciplineColor = getFormCardColorForCategory(discipline?.category ?? null);
      return disciplineColor ? `is-discipline-${disciplineColor}` : "is-discipline-neutral";
    };
    return {
      d1: buildSideClass("d1"),
      d2: buildSideClass("d2"),
    };
  }, [context?.matchdayContract?.discipline1?.category, context?.matchdayContract?.discipline2?.category]);
  const disciplineIssuesBySide = useMemo(() => {
    const next: Record<
      "d1" | "d2",
      Array<{
        tone: "ready" | "warning" | "blocked";
        label: string;
        detail: string;
      }>
    > = { d1: [], d2: [] };

    (["d1", "d2"] as const).forEach((disciplineSide) => {
      const requiredPlayers =
        disciplineSide === "d1"
          ? context?.matchdayContract?.discipline1?.requiredPlayers ?? 0
          : context?.matchdayContract?.discipline2?.requiredPlayers ?? 0;
      const selectedPlayers = disciplineSide === "d1" ? lineupMeta.d1Selected : lineupMeta.d2Selected;
      const sideSlots = slots.filter((slot) => slot.disciplineSide === disciplineSide);
      const duplicateCount = sideSlots.filter((slot) => duplicateSelectionIds.has(selections[slot.key] ?? "")).length;
      const fatigueRiskCount = sideSlots.filter((slot) => {
        const selectedOption = getSelectedOptionMeta(selections[slot.key]);
        return isElevatedFatigue(selectedOption?.fatigueCount);
      }).length;

      if (selectedPlayers < requiredPlayers) {
        const openSlots = requiredPlayers - selectedPlayers;
        next[disciplineSide].push({
          tone: "warning",
          label: `${openSlots} Slot${openSlots === 1 ? "" : "s"} offen`,
          detail: `${disciplineSide.toUpperCase()} ist noch nicht voll besetzt.`,
        });
      }
      if (captains[disciplineSide] && !sideSlots.some((slot) => selections[slot.key] === captains[disciplineSide])) {
        next[disciplineSide].push({
          tone: "blocked",
          label: "Captain ohne Slot",
          detail: "Captain ist gesetzt, aber nicht in dieser Diszi aufgestellt.",
        });
      }
      if (duplicateCount > 0) {
        next[disciplineSide].push({
          tone: "blocked",
          label: "Doppelwahl",
          detail: `${duplicateCount} Slot${duplicateCount === 1 ? "" : "s"} kollidieren noch.`,
        });
      }
      if (fatigueRiskCount > 0) {
        next[disciplineSide].push({
          tone: "warning",
          label: "Fatigue hoch",
          detail: `${fatigueRiskCount} Pick${fatigueRiskCount === 1 ? "" : "s"} tragen spuerbares Erschoepfungsrisiko.`,
        });
      }
      if (missingSeasonFormCards) {
        next[disciplineSide].push({
          tone: "warning",
          label: "Formkarten fehlen",
          detail: "Reveal und finale Lesbarkeit werden besser, sobald Formkarten erzeugt sind.",
        });
      }
    });

    return next;
  }, [
    captains,
    context?.matchdayContract?.discipline1?.requiredPlayers,
    context?.matchdayContract?.discipline2?.requiredPlayers,
    duplicateSelectionIds,
    lineupMeta.d1Selected,
    lineupMeta.d2Selected,
    missingSeasonFormCards,
    selections,
    slots,
  ]);
  const disciplineWorkflowSteps = useMemo(() => {
    return (["d1", "d2"] as const).map((disciplineSide) => {
      const requiredPlayers =
        disciplineSide === "d1"
          ? context?.matchdayContract?.discipline1?.requiredPlayers ?? 0
          : context?.matchdayContract?.discipline2?.requiredPlayers ?? 0;
      const selectedPlayers = disciplineSide === "d1" ? lineupMeta.d1Selected : lineupMeta.d2Selected;
      const openSlots = Math.max(0, requiredPlayers - selectedPlayers);
      const sideIssues = disciplineIssuesBySide[disciplineSide] ?? [];
      const status =
        openSlots === 0 ? "done" : sideIssues.some((issue) => issue.tone === "blocked") ? "blocked" : "current";
      return {
        key: disciplineSide,
        label: disciplineSide === "d1" ? d1Label : d2Label,
        selectedPlayers,
        requiredPlayers,
        openSlots,
        status,
        detail:
          openSlots === 0
            ? "voll besetzt"
            : sideIssues[0]?.detail ?? `${openSlots} Slot${openSlots === 1 ? "" : "s"} noch offen`,
      };
    });
  }, [
    context?.matchdayContract?.discipline1?.requiredPlayers,
    context?.matchdayContract?.discipline2?.requiredPlayers,
    d1Label,
    d2Label,
    disciplineIssuesBySide,
    lineupMeta.d1Selected,
    lineupMeta.d2Selected,
  ]);
  // Rechenkern in lib/lineups/lineup-audit.ts (buildLineupSaveCta).
  const lineupSaveCta = useMemo(
    () =>
      buildLineupSaveCta({
        openSlots: matchdayPreviewCards.openSlots,
        allAvailablePlayersDeployed,
        captainBudgetExceeded,
        captainUsedBeforeCurrentDraft,
        captainDraftUsedCount,
        captainSeasonLimit,
        duplicateSelectionsCount: duplicateSelections.length,
        hasDraft: Boolean(draft),
        lineupReadyToSave,
        captains,
      }),
    [allAvailablePlayersDeployed, captainBudgetExceeded, captainDraftUsedCount, captainSeasonLimit, captainUsedBeforeCurrentDraft, captains.d1, captains.d2, draft, duplicateSelections.length, lineupReadyToSave, matchdayPreviewCards.openSlots],
  );
  const lineupFinishItems = useMemo(() => lineupMiniAudit.items.slice(0, 6), [lineupMiniAudit]);
  // Der Weg in die Arena darf nicht strenger sein als die Bereitschaftspruefung des Spieltags:
  // ein Kader, der die Plaetze gar nicht besetzen KANN, erreicht "0 offene Slots" nie und waere
  // hier fuer immer haengengeblieben. Siehe `lineup-roster-shortfall`.
  const focusV2ArenaReady = useMemo(
    () =>
      isLineupArenaReady({
        hasSavedDraft: Boolean(draft),
        hasBlockingIssues: lineupMiniAudit.blockingItems.length > 0,
        openSlots: matchdayPreviewCards.openSlots,
        allAvailablePlayersDeployed,
      }),
    [allAvailablePlayersDeployed, draft, lineupMiniAudit.blockingItems.length, matchdayPreviewCards.openSlots],
  );
  const activeSlotIssues = activeSlot ? slotIssuesByKey.get(activeSlot.key) ?? [] : [];
  const teamdeckSortInsight = useMemo(() => {
    const activeLabel = activeSlot ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}` : "Auto";
    const labels: Record<TeamdeckSortMode, { label: string; detail: string }> = {
      fit: {
        label: "Passt sofort",
        detail: `Gruppiert nach Slot-Fit für ${activeLabel}.`,
      },
      top: {
        label: "Top Fit",
        detail: `Beste legale Picks für ${activeLabel}.`,
      },
      d1: {
        label: d1Label,
        detail: `Nach ${d1Label}-Stärke sortiert.`,
      },
      d2: {
        label: d2Label,
        detail: `Nach ${d2Label}-Stärke sortiert.`,
      },
      captain: {
        label: "Captain",
        detail: "Captain-Wert, Forderungen und Slot-Score zuerst.",
      },
      fatigue: {
        label: "Low Fatigue",
        detail: "Frische Spieler zuerst, Risiko runter.",
      },
      wish: {
        label: "Wunsch",
        detail: "Spieler mit passendem Diszi- oder Slotwunsch zuerst.",
      },
    };
    return labels[teamdeckSortMode];
  }, [activeSlot, d1Label, d2Label, teamdeckSortMode]);
  const hoveredCandidatePreview = useMemo(() => {
    if (!hoveredCandidate) {
      return null;
    }

    const slot = slots.find((entry) => entry.key === hoveredCandidate.slotKey) ?? null;
    const option = getSelectedOptionMeta(hoveredCandidate.activePlayerId);
    const rosterCard = rosterCardByActivePlayerId.get(hoveredCandidate.activePlayerId) ?? null;
    if (!slot || !option || !rosterCard) {
      return null;
    }

    const role = slotRoleByKey.get(slot.key) ?? null;
    const projected = calculateMatchdayProjectedPreview({
      baseScore: option.disciplineScores[slot.disciplineId] ?? null,
      role,
      attributeStats: rosterCard.attributeStats ?? null,
      currentFatigueCount: option.fatigueCount ?? null,
      requiredPlayers: context?.disciplinePlayerCounts[slot.disciplineId] ?? null,
      intensity: getDisciplineIntensity(slot.disciplineSide),
      knownModifierBonus: 0,
      revealVariance: 0,
      rivalryPressure: getRivalryPressureForDiscipline(slot.disciplineId),
    });
    const currentProjected = slotPreviewByKey.get(slot.key)?.projected.totalProjected ?? null;
    const scoreDelta =
      projected.totalProjected != null && currentProjected != null
        ? Number((projected.totalProjected - currentProjected).toFixed(1))
        : null;
    const fitExplanation = buildSlotFitExplanation(role, rosterCard, projected, scoreDelta);
    const blockReason = resolveLegacyLineupDragBlockReason({
      availabilityBlocker: rosterCard.availabilityBlocker,
      selectedSides: rosterCard.selectedSides,
      targetDisciplineSide: slot.disciplineSide,
      captainSide: captainSideByActivePlayerId.get(hoveredCandidate.activePlayerId) ?? null,
      hasBaseScore: option.disciplineScores[slot.disciplineId] != null,
    });
    const relevantDemands = rosterCard.demands.filter(
      (demand) =>
        !demand.targetDisciplineId ||
        demand.targetDisciplineId === slot.disciplineId ||
        demand.label === "Captain-Rolle",
    );
    const captainDemand = relevantDemands.find((demand) => demand.label === "Captain-Rolle") ?? null;
    const captainEffect =
      captains[slot.disciplineSide] === hoveredCandidate.activePlayerId
        ? "ist bereits Captain"
        : rosterCard.captainEligible
          ? captainDemand
            ? `Captain möglich · Moral +${formatDecimalScore(captainDemand.moraleReward, 1)}`
            : "Captain möglich"
          : "kein Captain-Fokus";
    const riskLabel = blockReason
      ? "blockiert"
      : isElevatedFatigue(option.fatigueCount)
        ? formatFatigueImpactDetail(option.fatigueCount)
        : projected.warnings[0]
          ? "Hinweis"
          : "niedrig";

    return {
      slotLabel: `${slot.disciplineSide.toUpperCase()}-${slot.slotIndex + 1}`,
      playerName: option.name,
      roleLabel: role?.label ?? "Standard",
      projectedScore: projected.totalProjected,
      currentProjected,
      scoreDelta,
      baseScore: projected.baseScore,
      fatigueModifier: projected.fatigueModifier,
      additionalFatigue: projected.additionalFatigue,
      warnings: projected.warnings,
      blockReason,
      fitDetail: fitExplanation.detail,
      captainEffect,
      riskLabel,
      wishLabel:
        relevantDemands.length > 0
          ? relevantDemands
              .slice(0, 2)
              .map((demand) => (demand.label === "Captain-Rolle" ? "Captain-Wunsch" : `Wunsch ${slot.disciplineName}`))
              .join(" · ")
          : null,
    };
  }, [captainSideByActivePlayerId, captains, context?.disciplinePlayerCounts, getDisciplineIntensity, hoveredCandidate, rivalryPressureByDiscipline, rosterCardByActivePlayerId, slotPreviewByKey, slotRoleByKey, slots]);
  const activeSlotDecisionCards = useMemo(() => {
    const topCandidate = activeSlotSpotlightCandidates[0] ?? null;
    const activeSlotLabel = activeSlot ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}` : null;
    const previewCandidate =
      hoveredCandidatePreview && activeSlotLabel && hoveredCandidatePreview.slotLabel === activeSlotLabel
        ? hoveredCandidatePreview
        : null;
    const candidateName = previewCandidate?.playerName ?? topCandidate?.player.name ?? "Top Pick";
    const candidateScore = previewCandidate?.projectedScore ?? topCandidate?.activeSlotCandidate?.projectedScore ?? null;
    const candidateDelta = previewCandidate?.scoreDelta ?? topCandidate?.activeSlotCandidate?.scoreDelta ?? null;
    const candidateRisk = previewCandidate?.riskLabel ?? topCandidate?.detail ?? "Slot wählen";
    const fatigueText =
      previewCandidate != null
        ? `+${formatScore(previewCandidate.additionalFatigue)}`
        : topCandidate?.player.fatigueCount != null
          ? `F ${Math.round(topCandidate.player.fatigueCount)}`
          : "—";

    return [
      {
        key: "slot",
        label: activeSlotLabel ?? "Slot",
        value: activeSlotRole?.label ?? "Auto",
        detail: activeSlotIssues[0]?.detail ?? "Nächste Entscheidung",
        tone: activeSlot && !selections[activeSlot.key] ? "warning" : "ready",
      },
      {
        key: "candidate",
        label: "Kandidat",
        value: candidateName,
        detail: candidateScore != null ? `Score ${formatNullableScore(candidateScore)}` : "auswählen",
        tone: candidateScore != null ? "ready" : "warning",
      },
      {
        key: "delta",
        label: "Delta",
        value: candidateDelta != null ? `${candidateDelta >= 0 ? "+" : ""}${formatDecimalScore(candidateDelta, 1)}` : "—",
        detail: "gegen aktuellen Slot",
        tone: candidateDelta == null ? "warning" : candidateDelta >= 0 ? "ready" : "warning",
      },
      {
        key: "fatigue",
        label: "Fatigue",
        value: fatigueText,
        detail: candidateRisk,
        tone:
          String(candidateRisk).toLowerCase().includes("block") || String(candidateRisk).toLowerCase().includes("fatigue")
            ? "warning"
            : "ready",
      },
    ] as const;
  }, [
    activeSlot,
    activeSlotIssues,
    activeSlotRole?.label,
    activeSlotSpotlightCandidates,
    hoveredCandidatePreview,
    selections,
  ]);

  function getLineupPlayerTableWidth(column: LegacyLineupTableColumn) {
    return tablePreferences.lineupPlayerTable?.widths?.[column.id] ?? column.defaultWidth;
  }

  function setLineupPlayerTablePreset(presetId: Exclude<LegacyLineupTablePresetId, "custom">) {
    const preset = lineupPlayerTablePresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    const visibility = Object.fromEntries(
      lineupPlayerTableColumns.map((column) => [column.id, preset.visibleColumnIds.includes(column.id)]),
    );

    setTablePreferences((current) => ({
      ...current,
      lineupPlayerTable: {
        widths: getLegacyLineupTableWidths(lineupPlayerTableColumns),
        columnVisibility: visibility,
        columnOrder: [...preset.order],
        activePreset: preset.id,
        sortState: currentSortStateForPreset(preset.id),
      },
    }));
  }

  function currentSortStateForPreset(presetId: Exclude<LegacyLineupTablePresetId, "custom">) {
    if (presetId === "performance") {
      return {
        key: "discipline1Score",
        direction: "desc" as const,
      };
    }

    return {
      key: "name",
      direction: "asc" as const,
    };
  }

  function updateLineupPlayerTableAsCustom(
    updater: (current: LegacyLineupTablePreferences["lineupPlayerTable"]) => LegacyLineupTablePreferences["lineupPlayerTable"],
  ) {
    setTablePreferences((current) => {
      const nextEntry = updater(current.lineupPlayerTable);
      return {
        ...current,
        lineupPlayerTable: {
          widths: nextEntry?.widths ?? {},
          columnVisibility: nextEntry?.columnVisibility ?? {},
          columnOrder: nextEntry?.columnOrder ?? lineupPlayerTableColumns.map((column) => column.id),
          activePreset: "custom",
          sortState: nextEntry?.sortState ?? current.lineupPlayerTable?.sortState ?? null,
        },
      };
    });
  }

  function toggleLineupPlayerColumn(columnId: string, nextVisible: boolean) {
    updateLineupPlayerTableAsCustom((current) => ({
      widths: current?.widths ?? {},
      columnVisibility: {
        ...(current?.columnVisibility ?? {}),
        [columnId]: nextVisible,
      },
      columnOrder: current?.columnOrder ?? lineupPlayerTableColumns.map((column) => column.id),
      activePreset: "custom",
      sortState: current?.sortState ?? null,
    }));
  }

  function moveLineupPlayerColumn(columnId: string, direction: "left" | "right") {
    updateLineupPlayerTableAsCustom((current) => {
      const order = orderLegacyLineupColumns(
        lineupPlayerTableColumns,
        current?.columnOrder,
      ).map((column) => column.id);
      const currentIndex = order.indexOf(columnId);
      if (currentIndex === -1) {
        return current;
      }

      const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= order.length) {
        return current;
      }

      const nextOrder = [...order];
      const [moved] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(targetIndex, 0, moved);

      return {
        widths: current?.widths ?? {},
        columnVisibility: current?.columnVisibility ?? {},
        columnOrder: nextOrder,
        activePreset: "custom",
        sortState: current?.sortState ?? null,
      };
    });
  }

  function stepLineupPlayerColumnWidth(column: LegacyLineupTableColumn, delta: number) {
    updateLineupPlayerTableAsCustom((current) => ({
      widths: {
        ...(current?.widths ?? {}),
        [column.id]: Math.max(column.minWidth, getLineupPlayerTableWidth(column) + delta),
      },
      columnVisibility: current?.columnVisibility ?? {},
      columnOrder: current?.columnOrder ?? lineupPlayerTableColumns.map((entry) => entry.id),
      activePreset: "custom",
      sortState: current?.sortState ?? null,
    }));
  }

  function resetLineupPlayerColumnWidth(column: LegacyLineupTableColumn) {
    updateLineupPlayerTableAsCustom((current) => ({
      widths: {
        ...(current?.widths ?? {}),
        [column.id]: column.defaultWidth,
      },
      columnVisibility: current?.columnVisibility ?? {},
      columnOrder: current?.columnOrder ?? lineupPlayerTableColumns.map((entry) => entry.id),
      activePreset: "custom",
      sortState: current?.sortState ?? null,
    }));
  }

  function toggleLineupPlayerTableSort(columnKey: string) {
    updateLineupPlayerTableAsCustom((current) => {
      const currentSort = current?.sortState ?? null;
      const nextSort =
        currentSort?.key !== columnKey
          ? ({ key: columnKey, direction: "desc" } as const)
          : currentSort.direction === "desc"
            ? ({ key: columnKey, direction: "asc" } as const)
            : null;

      return {
        widths: current?.widths ?? {},
        columnVisibility: current?.columnVisibility ?? {},
        columnOrder: current?.columnOrder ?? lineupPlayerTableColumns.map((entry) => entry.id),
        activePreset: "custom",
        sortState: nextSort,
      };
    });
  }

  async function loadContext(
    overrides?: Partial<typeof params>,
    nextSource?: "sqlite" | "prisma",
    options?: { resetTransient?: boolean },
  ) {
    const effectiveSource = nextSource ?? source;
    const shouldResetTransient = options?.resetTransient ?? true;
    const nextParams = { ...params, ...overrides };
    const query = new URLSearchParams(
      Object.entries(nextParams).filter(([, value]) => Boolean(value)) as Array<[string, string]>,
    );
    query.set("source", effectiveSource);
    const requestQuery = withRoomQuery(query);
    const requestKey = `${effectiveSource}:${requestQuery.toString()}`;
    if (loadContextRequestKeyRef.current === requestKey) {
      return;
    }

    loadContextAbortRef.current?.abort();
    const controller = new AbortController();
    loadContextRequestKeyRef.current = requestKey;
    loadContextAbortRef.current = controller;

    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    setMessage("");

    try {
      const response = await fetch(`/api/lineups/legacy/lab-context?${requestQuery.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as LabContextResponse & { error?: string };
      if (controller.signal.aborted) {
        return;
      }

      if (!response.ok || payload.error) {
        setErrors([payload.error ?? "Lineup-Kontext konnte nicht geladen werden."]);
        return;
      }

      setSource(payload.source);
      setSourceReadOnly(payload.readOnly);
      setParams(payload.params);
      setOptions(payload.options);
      setContext(payload.context);
      setDraft(payload.context?.existingDraft ?? null);
      if (shouldResetTransient) {
        setPreview(null);
        setMatchdayScorePreview(null);
        setVisibleScoreboardSide(null);
        setAiPreview(null);
        setAiBatchPreview([]);
        setAiBatchSummary(null);
        setIsPreviewPanelOpen(false);
        setIsAiPreviewPanelOpen(false);
      }
      setWarnings([...payload.contextWarnings, ...payload.contextErrors]);

      const nextSelections: Record<string, string> = {};
      const nextCaptains: Record<"d1" | "d2", string> = { d1: "", d2: "" };
      for (const entry of payload.context?.existingDraft?.entries ?? []) {
        nextSelections[`${entry.disciplineId}::${entry.disciplineSide}::${entry.slotIndex}`] = entry.activePlayerId ?? "";
        if (entry.isCaptain && entry.activePlayerId) {
          nextCaptains[entry.disciplineSide] = entry.activePlayerId;
        }
      }
      setSelections(nextSelections);
      setTeamIntensity("normal");
      setCaptains(nextCaptains);
      setModifiers(applyPlannedFormCardsToModifiers(payload.context, normalizeLineupModifiers(payload.context?.existingDraft?.modifiers)));
      setLineupUndoSnapshot(null);
      setHoveredCandidate(null);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Lineup-Kontext wurde neu geladen."
          : "Einsatzliste konnte gerade nicht geladen werden. Bitte erneut versuchen.";
      setErrors([message]);
    } finally {
      if (loadContextAbortRef.current === controller) {
        loadContextAbortRef.current = null;
        loadContextRequestKeyRef.current = "";
        setIsBusy(false);
      }
    }
  }

  useEffect(() => {
    if (props.embedded) {
      return;
    }
    void loadContext(defaultParamsFromProps(props), props.initialSource ?? "sqlite");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!props.embedded) {
      return;
    }
    if (!props.defaultSaveId || !props.defaultSeasonId || !props.defaultMatchdayId || !props.defaultTeamId) {
      return;
    }
    if (
      context &&
      props.defaultSaveId &&
      props.defaultSaveId === params.saveId &&
      props.defaultSeasonId === params.seasonId &&
      props.defaultMatchdayId === params.matchdayId &&
      props.defaultTeamId === params.teamId &&
      props.initialSource === source
    ) {
      return;
    }
    void loadContext(
      {
        saveId: props.defaultSaveId,
        seasonId: props.defaultSeasonId,
        matchdayId: props.defaultMatchdayId,
        teamId: props.defaultTeamId,
      },
      props.initialSource ?? "sqlite",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, props.defaultMatchdayId, props.defaultSaveId, props.defaultSeasonId, props.defaultTeamId, props.initialSource]);

	  useEffect(() => {
	    if (!context) {
	      return;
	    }
	    autoFlowReadyRef.current = true;
	    lastAutoPersistKeyRef.current = draftStateKey;
	    lastAutoPreviewKeyRef.current = "";
	  }, [context, draftStateKey, params.matchdayId, params.saveId, params.seasonId, params.teamId, source]);
	
	  useEffect(() => {
	    if (!context || selectedTeamOption?.controlMode !== "ai") {
	      return;
	    }
	    const key = `${params.saveId}:${params.seasonId}:${params.matchdayId}:${params.teamId}:${source}`;
	    if (lastAiInsightKeyRef.current === key) {
	      return;
	    }
	    lastAiInsightKeyRef.current = key;
	    void loadAiPreviewForTeam(params.teamId, {
	      silent: true,
	      applyToDraft: false,
	      openPanel: false,
	    });
	  }, [context, params.matchdayId, params.saveId, params.seasonId, params.teamId, selectedTeamOption?.controlMode, source]);

  useEffect(() => {
    if (!context || !autoFlowReadyRef.current || duplicateSelections.length > 0) {
      return;
    }
    if (lastAutoPreviewKeyRef.current === draftStateKey) {
      return;
    }
    if (skipNextAutoPersistRef.current) {
      skipNextAutoPersistRef.current = false;
      lastAutoPreviewKeyRef.current = draftStateKey;
      void requestPreview(entries, modifiers, { silent: true });
      return;
    }

    const timer = window.setTimeout(() => {
      lastAutoPreviewKeyRef.current = draftStateKey;
      void requestPreview(entries, modifiers, { silent: true });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [context, draftStateKey, duplicateSelections.length, entries, modifiers]);

  async function handleLoadDraft() {
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
    setAiPreview(null);
    setAiBatchPreview([]);
    setAiBatchSummary(null);
    const nextSelections: Record<string, string> = {};
    const nextCaptains: Record<"d1" | "d2", string> = { d1: "", d2: "" };
    for (const entry of context?.existingDraft?.entries ?? []) {
      nextSelections[`${entry.disciplineId}::${entry.disciplineSide}::${entry.slotIndex}`] = entry.activePlayerId ?? "";
      if (entry.isCaptain && entry.activePlayerId) {
        nextCaptains[entry.disciplineSide] = entry.activePlayerId;
      }
    }
    setSelections(nextSelections);
    setTeamIntensity("normal");
    setCaptains(nextCaptains);
    setModifiers(applyPlannedFormCardsToModifiers(context, normalizeLineupModifiers(context?.existingDraft?.modifiers)));
    setDraft(context?.existingDraft ?? null);
    setLineupUndoSnapshot(null);
    setHoveredCandidate(null);
    setMessage(context?.existingDraft ? "Draft geladen." : "Kein bestehender Draft vorhanden.");
  }

  async function handleSaveDraft() {
    if (lineupMiniAudit.blockingItems.length > 0) {
      setErrors(lineupMiniAudit.blockingItems.map((item) => `${item.label}: ${item.detail}`));
      setWarnings(lineupMiniAudit.warningItems.map((item) => `${item.label}: ${item.detail}`));
      setMessage("");
      return;
    }
    const saved = await saveEntries(
      entries,
      lineupMiniAudit.status === "warning"
        ? "Mini-Audit mit Hinweisen bestanden. Draft gespeichert."
        : "Mini-Audit sauber. Draft gespeichert.",
      { skipContextReload: source === "sqlite" },
    );
    if (saved) {
      // Speichern heisst "ich bin bereit" — NICHT "los geht's". Frueher sprang die
      // Einsatzliste direkt (nach dem Handoff-Overlay) in die Arena; damit war der
      // Spieltag angestossen, sobald man nur zwischenspeichern wollte, und im
      // Mehrspieler-Betrieb konnte man den anderen die Arena vor die Nase setzen.
      // Der Wechsel passiert jetzt ausschliesslich ueber den "Zur Arena"-Knopf.
      //
      // Der Arena-Prefetch bleibt aber genau hier: Die Arena laedt beim Oeffnen ihr
      // Engine-Bundle (Resolve-Preview ueber 32 Teams, der teuerste Teil des Uebergangs).
      // Wir warmen den Session-Cache jetzt schon beim Speichern, sodass der spaetere
      // Klick auf "Zur Arena" die Daten fertig vorfindet — dieselbe Ersparnis wie zuvor,
      // nur ohne den ungewollten Sprung.
      prefetchMatchdayArenaBase({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        teamId: params.teamId,
        source: "sqlite",
        includeDetails: true,
        immediate: true,
      });
      const scoreLabel = formatProjectedMetricWindow(matchdayPreviewCards.totalRangeLow, matchdayPreviewCards.totalRangeHigh);
      setMessage(`Einsatzliste gespeichert — bereit (${scoreLabel} Pkt. projiziert). Weiter mit „Zur Arena“.`);
    }
  }

  async function handleGenerateFormCards() {
    if (source === "prisma" || isReadOnly) {
      setErrors(["Formkarten können nur im lokalen Save erzeugt werden."]);
      setWarnings([]);
      setMessage("");
      return;
    }

    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    setMessage("");

    try {
      const query = withRoomQuery(new URLSearchParams(params));
      query.set("source", source);
      const response = await fetch(`/api/lineups/legacy/form-cards?${query.toString()}`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        summary?: {
          seasonId: string;
          coveredTeamCount: number;
          coveredPlayerCount: number;
          generatedCardCount: number;
          scrubbedSelectionCount: number;
          warnings?: string[];
        };
        errors?: string[];
        warnings?: string[];
        error?: string;
      };

      if (!response.ok || !payload.summary) {
        setErrors(payload.errors ?? [payload.error ?? "Formkarten konnten nicht erzeugt werden."]);
        setWarnings(payload.warnings ?? []);
        return;
      }

      await loadContext(params, source);
      setWarnings(payload.summary.warnings ?? []);
      setMessage(
        `${payload.summary.seasonId}: ${payload.summary.generatedCardCount} Formkarten für ${payload.summary.coveredTeamCount} Teams und ${payload.summary.coveredPlayerCount} Spieler lokal erzeugt.` +
          (payload.summary.scrubbedSelectionCount > 0
            ? ` ${payload.summary.scrubbedSelectionCount} alte Kartenauswahlen wurden bereinigt.`
            : ""),
      );
    } catch {
      setErrors(["Formkarten konnten nicht erzeugt werden."]);
      setWarnings([]);
    } finally {
      setIsBusy(false);
    }
  }

  function buildLineupSaveFeedback(entriesToSave: LegacyLineupEntryInput[], baseMessage: string) {
    const filledSlots = entriesToSave.filter((entry) => entry.activePlayerId).length;
    const captainSides = new Set(
      entriesToSave
        .filter((entry) => entry.isCaptain)
        .map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
    );
    // Bei abgeschalteten Team-Powers taucht der Teil gar nicht mehr in der Meldung auf.
    // Alte Drafts tragen ihre `teamPowerId` weiter mit sich — ohne diese Klammer meldete
    // das Speichern also "1 Power" fuer etwas, das nirgends mehr waehlbar ist und nicht wirkt.
    const selectedPowerCount = areTeamPowersEnabled()
      ? [modifiers.d1.teamPowerId, modifiers.d2.teamPowerId].filter(Boolean).length
      : null;
    const selectedFormCount = [
      modifiers.d1.primaryFormCardId,
      modifiers.d1.secondaryFormCardId,
      modifiers.d2.primaryFormCardId,
      modifiers.d2.secondaryFormCardId,
    ].filter(Boolean).length;
    const intensityLabels = (["d1", "d2"] as const)
      .map((side) => formatIntensityStageLabel(modifiers[side].intensity ?? "normal"))
      .join("/");
    const captainBudgetAfterSave = Math.min(captainSeasonLimit, captainUsedBeforeCurrentDraft + captainSides.size);

    const parts = [
      `${filledSlots}/${slots.length} Slots`,
      `Captain ${captainBudgetAfterSave}/${captainSeasonLimit}`,
      `Einsatz ${intensityLabels}`,
      `${selectedFormCount} Form`,
      selectedPowerCount == null ? null : `${selectedPowerCount} Power`,
    ].filter(Boolean);

    return `${baseMessage} ${parts.join(" · ")}.`;
  }

  async function saveEntries(
    entriesToSave: LegacyLineupEntryInput[],
    successMessage: string,
    options?: { silent?: boolean; resetTransientAfterReload?: boolean; skipContextReload?: boolean },
  ): Promise<boolean> {
    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    if (!options?.silent) {
      setMessage("");
    }

    try {
      const query = new URLSearchParams(params);
      query.set("source", source);
      withRoomQuery(query);
      const putLineup = (confirmLock: boolean) =>
        fetch(`/api/lineups/legacy?${query.toString()}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ entries: entriesToSave, modifiers, confirmLock }),
        });
      let response = await putLineup(false);
      let payload = (await response.json()) as {
        draft?: LegacyLineupDraft;
        saveVersion?: number | null;
        contentSignature?: string | null;
        warnings?: string[];
        errors?: string[];
        error?: string;
        commitment?: { hasFormCards: boolean; hasCaptain: boolean; isEmptyCommitment: boolean };
      };

      /**
       * Das Speichern nagelt den Spieltag fest — danach sind Formkarten, Kapitaen und
       * Aufstellung nicht mehr aenderbar. Die Route speichert deshalb erst auf Bestaetigung
       * und meldet im ersten Anlauf zurueck, WAS eingesetzt wird.
       *
       * Ohne Formkarte UND ohne Kapitaen wird deutlicher gefragt: das ist fast nie Absicht
       * und danach nicht mehr zu korrigieren.
       */
      if (response.status === 409 && payload.error === "lineup_lock_confirmation_required") {
        const commitment = payload.commitment;
        const einsatz = commitment?.isEmptyCommitment
          ? "Du setzt WEDER eine Formkarte NOCH einen Kapitän ein."
          : [
              commitment?.hasFormCards ? "Formkarte(n) gesetzt" : "keine Formkarte",
              commitment?.hasCaptain ? "Kapitän gesetzt" : "kein Kapitän",
            ].join(" · ");
        const confirmed =
          typeof window === "undefined"
            ? false
            : window.confirm(
                `Aufstellung abgeben und für diesen Spieltag festlegen?\n\n${einsatz}\n\n` +
                  "Danach lassen sich Aufstellung, Kapitän und Formkarten für diesen Spieltag " +
                  "nicht mehr ändern.",
              );
        if (!confirmed) {
          setMessage("");
          setWarnings([]);
          return false;
        }
        response = await putLineup(true);
        payload = (await response.json()) as typeof payload;
      }

      if (!response.ok) {
        setErrors(payload.errors ?? [payload.error ?? "Draft konnte nicht gespeichert werden."]);
        setWarnings(payload.warnings ?? []);
        return false;
      }

      setDraft(payload.draft ?? null);
      setWarnings(payload.warnings ?? []);
      if (!options?.silent) {
        setMessage(buildLineupSaveFeedback(entriesToSave, successMessage));
      }
      if (!options?.skipContextReload) {
        await loadContext(params, source, {
          resetTransient: options?.resetTransientAfterReload ?? true,
        });
      }
      props.onLineupSaved?.({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        teamId: params.teamId,
        silent: Boolean(options?.silent),
        draft: payload.draft ?? null,
        saveVersion: payload.saveVersion ?? null,
        contentSignature: payload.contentSignature ?? null,
      });
      return true;
    } catch {
      setErrors(["Draft konnte nicht gespeichert werden."]);
      setWarnings([]);
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function requestPreview(
    entriesToPreview: LegacyLineupEntryInput[],
    previewModifiers: LineupDraftModifiers,
    options?: { silent?: boolean },
  ) {
    const query = new URLSearchParams(params);
    query.set("source", source);
    const previewBody = JSON.stringify({ entries: entriesToPreview, modifiers: previewModifiers });
    const previewRequestKey = `${query.toString()}:${previewBody}`;
    if (!options?.silent && previewRequestKeyRef.current === previewRequestKey) {
      return;
    }
    previewRequestKeyRef.current = previewRequestKey;

    const previewSequence = options?.silent ? ++previewSequenceRef.current : previewSequenceRef.current;
    let abortController: AbortController | null = null;
    if (options?.silent) {
      previewAbortRef.current?.abort();
      abortController = new AbortController();
      previewAbortRef.current = abortController;
    } else {
      setIsBusy(true);
      setErrors([]);
      setWarnings([]);
      setMessage("");
    }

    try {
      if (options?.silent && source === "sqlite" && context) {
        const localResult = calculateLocalLegacyLineupPreviewFromContext(
          context,
          entriesToPreview,
          previewModifiers,
          context.fatigueByPlayerId ?? null,
          props.embeddedGameState ?? null,
        );
        if (options?.silent && previewSequence !== previewSequenceRef.current) {
          return;
        }
        if (!localResult.ok) {
          if (!options?.silent) {
            setErrors(localResult.errors ?? ["Preview konnte nicht berechnet werden."]);
          }
          return;
        }
        setPreview(localResult);
        setWarnings(localResult.scorePreview.validationWarnings ?? []);
        return;
      }

      const response = await fetch(`/api/lineups/legacy/preview?${query.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: previewBody,
        signal: abortController?.signal,
      });
      const payload = (await response.json()) as PreviewResponse;

      if (options?.silent && previewSequence !== previewSequenceRef.current) {
        return;
      }

      if (!response.ok || !payload.preview || !payload.preview.ok) {
        if (!options?.silent) {
          setErrors(payload.errors ?? ["Preview konnte nicht berechnet werden."]);
          setWarnings(payload.warnings ?? []);
        }
        return;
      }

      setPreview(payload.preview);
      if (!options?.silent) {
        setIsPreviewPanelOpen(true);
      }
      setWarnings(payload.preview.scorePreview.validationWarnings ?? []);
      if (!options?.silent) {
        setMessage("Preview berechnet.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (!options?.silent) {
        setErrors(["Preview konnte nicht berechnet werden."]);
      }
    } finally {
      if (previewRequestKeyRef.current === previewRequestKey) {
        previewRequestKeyRef.current = "";
      }
      if (!options?.silent) {
        setIsBusy(false);
      }
    }
  }

  async function handlePreview() {
    await requestPreview(entries, modifiers);
  }

  async function loadMatchdayScoreboard(side: "d1" | "d2", nextReveal?: Partial<{ form: boolean; mutators: boolean }>) {
    if (source === "prisma" || isReadOnly) {
      setErrors(["Die 32er-Spieltagswertung ist nur im lokalen Save verfügbar."]);
      setMessage("");
      return;
    }

    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    setMessage("");

    try {
      const response = await fetch("/api/season/matchday-mvp-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          saveId: params.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          source,
          dryRun: true,
          execute: false,
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        summary?: MatchdayMvpScoringResponse;
        error?: string;
      };

      const nextFeed = payload.summary
        ? { ...payload.summary, error: payload.error }
        : null;
      if (!response.ok || !nextFeed) {
        setErrors([payload.error ?? "Die Spieltagswertung konnte nicht geladen werden."]);
        return;
      }

      setMatchdayScorePreview(nextFeed);
      setVisibleScoreboardSide(side);
      setScoreboardReveal((current) => ({
        ...current,
        [side]: nextReveal
          ? {
              form: nextReveal.form ?? current[side].form,
              mutators: nextReveal.mutators ?? current[side].mutators,
            }
          : { form: false, mutators: false },
      }));
      setWarnings([...nextFeed.warnings, ...nextFeed.blockingReasons]);
      setMessage(
        `${side === "d1" ? nextFeed.targetMatchday.d1DisciplineName : nextFeed.targetMatchday.d2DisciplineName}: ${nextFeed.totalTeamsScored ?? (side === "d1" ? nextFeed.d1Scoreboard.length : nextFeed.d2Scoreboard.length)} Teams geladen.`,
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleScoreboardReveal(side: "d1" | "d2", revealKey: "form" | "mutators") {
    const nextValue = !scoreboardReveal[side][revealKey];
    await loadMatchdayScoreboard(side, { [revealKey]: nextValue });
  }

	  async function loadAiPreviewForTeam(
	    teamId: string,
	    loadOptions?: {
	      applyToDraft?: boolean;
	      openPanel?: boolean;
	      silent?: boolean;
	      message?: string;
	    },
	  ) {
	    const silent = Boolean(loadOptions?.silent);
	    if (!silent) {
	      setIsBusy(true);
	      setErrors([]);
	      setWarnings([]);
	      setMessage("");
	    }
	
	    try {
	      const query = new URLSearchParams({
	        ...params,
	        teamId,
	        source,
	      });
	      const response = await fetch(`/api/lineups/legacy/ai-preview?${query.toString()}`, {
	        cache: "no-store",
	      });
	      const payload = (await response.json()) as AiPreviewResponse & { error?: string };
	
	      if (!response.ok || !payload.preview) {
	        if (!silent) {
	          setErrors(payload.errors ?? [payload.error ?? "AI-Vorschau konnte nicht geladen werden."]);
	          setWarnings(payload.warnings ?? []);
	        }
	        return null;
	      }
	
	      setAiPreview(payload.preview);
	      setAiBatchPreview([]);
	      setAiBatchSummary(null);
	      if (loadOptions?.openPanel) {
	        setIsAiPreviewPanelOpen(true);
	      }
	      if (loadOptions?.applyToDraft) {
	        applyAiPreviewToUiDraft(payload.preview, {
	          confirmOnOverwrite: true,
	          message: loadOptions.message ?? "AI-Vorschlag geladen und in die Slots uebernommen. Noch nicht gespeichert.",
	        });
	      }
	      return payload.preview;
	    } catch {
	      if (!silent) {
	        setErrors(["AI-Vorschau konnte nicht geladen werden."]);
	        setWarnings([]);
	      }
	      return null;
	    } finally {
	      if (!silent) {
	        setIsBusy(false);
	      }
	    }
	  }
	
	  async function handleAiPreview() {
	    await loadAiPreviewForTeam(params.teamId, {
	      applyToDraft: true,
	      openPanel: true,
	    });
	  }

  async function handleAiPreviewAllTeams() {
    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    setMessage("");

    try {
      const query = new URLSearchParams({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        source,
      });
      const response = await fetch(`/api/lineups/legacy/ai-batch-preview?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as AiBatchPreviewResponse;

      if (!response.ok) {
        setErrors([payload.error ?? "AI-Batch-Vorschau konnte nicht geladen werden."]);
        return;
      }

      setAiBatchPreview(payload.teams);
      setAiBatchSummary({
        totalTeams: payload.totalTeams,
        readyTeams: payload.readyTeams,
        warningTeams: payload.warningTeams,
        blockedTeams: payload.blockedTeams,
      });
      setAiBatchApplyFeed(null);
      setAiPreview(null);
      setIsAiPreviewPanelOpen(true);
      setWarnings([]);
      setMessage("AI-Vorschau für alle Teams geladen. Noch nichts gespeichert.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleOpenAiBatchDetails(entry: AiBatchPreviewEntry) {
    setParams((current) => ({
      ...current,
      teamId: entry.teamId,
    }));
    props.onTeamChange?.(entry.teamId);
    setWarnings(entry.warnings);
    await handleAiPreviewForTeam(entry.teamId);
  }

  async function handleAiBatchApply(dryRun: boolean) {
    if (source === "prisma" || isReadOnly) {
      setErrors(["Referenzmodus ist nur zum Anschauen. Bitte lokalen Spielstand nutzen."]);
      setMessage("");
      return;
    }

    if (aiBatchPreview.length === 0) {
      setMessage("Bitte zuerst die AI-Vorschau für alle Teams laden.");
      return;
    }

    if (!dryRun) {
      if (!aiBatchApplyFeed?.dryRun) {
        setMessage("Bitte zuerst Batch DryRun ausführen.");
        return;
      }

      const confirmText = aiBatchIncludeWarnings
        ? `Jetzt ${aiBatchApplyFeed.summary.plannedLineups} Auto-Teams lokal speichern? Hinweis-Teams werden eingeschlossen.`
        : `Jetzt ${aiBatchApplyFeed.summary.plannedLineups} bereite Auto-Teams lokal speichern?`;
      const overwriteHint =
        aiBatchOverwriteExisting && aiBatchApplyFeed.summary.wouldOverwrite > 0
          ? ` ${aiBatchApplyFeed.summary.wouldOverwrite} bestehende Einsatzlisten werden ersetzt.`
          : "";
      const confirmed = window.confirm(confirmText + overwriteHint);
      if (!confirmed) {
        setMessage("Batch-Speichern abgebrochen.");
        return;
      }
    }

    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    setMessage("");

    try {
      const query = new URLSearchParams({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        source,
      });
      withRoomQuery(query);
      const response = await fetch(`/api/lineups/legacy/ai-batch-apply?${query.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dryRun,
          confirm: dryRun ? false : true,
          includeWarningTeams: aiBatchIncludeWarnings,
          overwriteExisting: aiBatchOverwriteExisting,
        }),
      });
      const payload = (await response.json()) as AiBatchApplyResponse;

      if (!response.ok) {
        setErrors([payload.error ?? "AI-Batch-Apply konnte nicht ausgeführt werden."]);
        return;
      }

      setAiBatchApplyFeed(payload);
      setWarnings(payload.summary.warnings ?? []);
      if (dryRun) {
        setMessage(`Batch-Test bereit: ${payload.summary.plannedLineups} Auto-Teams würden gespeichert.`);
      } else {
        await loadContext(params, source);
        await handleAiPreviewAllTeams();
        setMessage(`Batch gespeichert: ${payload.summary.savedTeams} Auto-Teams lokal uebernommen.`);
      }
    } finally {
      setIsBusy(false);
    }
  }

	  async function handleAiPreviewForTeam(teamId: string) {
	    const previewForTeam = await loadAiPreviewForTeam(teamId, {
	      applyToDraft: true,
	      openPanel: true,
	    });
	    if (previewForTeam) {
	      setMessage(`${previewForTeam.teamName}: AI-Vorschlag geladen und in die Slots uebernommen. Noch nicht gespeichert.`);
	    }
	  }

  function applyAiPreviewToUiDraft(
    previewToApply: AiLegacyLineupPreview,
    options?: { confirmOnOverwrite?: boolean; message?: string },
  ) {
    const nextDraft = buildDraftStateFromAiPreview(previewToApply);
    const hasExistingValues = hasLineupDraftValues(selections, captains);
    const changesCurrentDraft =
      JSON.stringify(nextDraft.selections) !== JSON.stringify(selections) ||
      nextDraft.captains.d1 !== captains.d1 ||
      nextDraft.captains.d2 !== captains.d2;

    if (options?.confirmOnOverwrite && hasExistingValues && changesCurrentDraft) {
      const confirmed = window.confirm(
        "Aktuelle Auswahl ersetzen? Der AI-Vorschlag fuellt nur den UI-Draft und speichert noch nichts.",
      );
      if (!confirmed) {
        setMessage("AI-Uebernahme abgebrochen. Aktuelle Auswahl bleibt unverändert.");
        return false;
      }
    }

    skipNextAutoPersistRef.current = true;
    setSelections(nextDraft.selections);
    setTeamIntensity("normal");
    setCaptains(nextDraft.captains);
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
    setWarnings(previewToApply.warnings ?? []);
    setMessage(options?.message ?? "AI-Vorschlag uebernommen – noch nicht gespeichert.");
    return true;
  }

  function buildUpdatedSelections(currentSelections: Record<string, string>, slotKey: string, activePlayerId: string) {
    const nextEntries = Object.fromEntries(
      Object.entries(currentSelections).map(([key, value]) => [
        key,
        activePlayerId && value === activePlayerId && key !== slotKey ? "" : value,
      ]),
    );

    return {
      ...nextEntries,
      [slotKey]: activePlayerId,
    };
  }

  function getNextOpenSlotKeyAfter(slotKey: string, nextSelections: Record<string, string>) {
    const currentIndex = slots.findIndex((slot) => slot.key === slotKey);
    const orderedSlots =
      currentIndex >= 0 ? [...slots.slice(currentIndex + 1), ...slots.slice(0, currentIndex + 1)] : slots;
    return orderedSlots.find((slot) => !nextSelections[slot.key])?.key ?? slotKey;
  }

  function formatLineupSlotLabel(slotKey: string) {
    const slot = slots.find((entry) => entry.key === slotKey) ?? null;
    if (!slot) {
      return "Slot";
    }
    return `${slot.disciplineSide.toUpperCase()}-${slot.slotIndex + 1}`;
  }

  function scrollLineupTarget(targetId: string) {
    if (typeof document === "undefined") {
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });
  }

  function rememberLineupUndo(label: string, detail: string) {
    setLineupUndoSnapshot({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label,
      detail,
      selections,
      captains,
      activeSlotKey,
      focusedDisciplineSide,
    });
  }

  function restoreLineupUndo() {
    if (!lineupUndoSnapshot) {
      return;
    }
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
    setSelections(lineupUndoSnapshot.selections);
    setCaptains(lineupUndoSnapshot.captains);
    setActiveSlotKey(lineupUndoSnapshot.activeSlotKey);
    setFocusedDisciplineSide(lineupUndoSnapshot.focusedDisciplineSide);
    setLineupUndoSnapshot(null);
    setHoveredCandidate(null);
    setMessage("Rueckgaengig gemacht.");
  }

  function focusSlotByOffset(offset: number) {
    if (slots.length === 0) {
      return;
    }
    const currentKey = activeSlot?.key ?? activeSlotKey ?? slots[0]?.key ?? null;
    const currentIndex = Math.max(0, slots.findIndex((slot) => slot.key === currentKey));
    const nextIndex = (currentIndex + offset + slots.length) % slots.length;
    const nextSlot = slots[nextIndex] ?? null;
    if (!nextSlot) {
      return;
    }
    setActiveSlotKey(nextSlot.key);
    setFocusedDisciplineSide(nextSlot.disciplineSide);
    setHoveredCandidate(null);
    scrollLineupTarget(`lineup-slot-${nextSlot.key}`);
  }

  function focusNextOpenSlot() {
    const nextOpenSlot =
      slots.find((slot) => slot.disciplineSide === focusedDisciplineSide && !selections[slot.key]) ??
      slots.find((slot) => !selections[slot.key]) ??
      slots.find((slot) => slot.disciplineSide === focusedDisciplineSide) ??
      slots[0] ??
      null;
    if (!nextOpenSlot) {
      return;
    }
    setActiveSlotKey(nextOpenSlot.key);
    setFocusedDisciplineSide(nextOpenSlot.disciplineSide);
    setHoveredCandidate(null);
    scrollLineupTarget(`lineup-slot-${nextOpenSlot.key}`);
  }

  function focusDisciplineOpenSlot(disciplineSide: "d1" | "d2") {
    const nextSlot =
      slots.find((slot) => slot.disciplineSide === disciplineSide && !selections[slot.key]) ??
      slots.find((slot) => slot.disciplineSide === disciplineSide) ??
      null;
    if (!nextSlot) {
      return;
    }
    setActiveSlotKey(nextSlot.key);
    setFocusedDisciplineSide(nextSlot.disciplineSide);
    setHoveredCandidate(null);
    scrollLineupTarget(`lineup-slot-${nextSlot.key}`);
  }

  function jumpToNextLineupTask() {
    if (matchdayPreviewCards.openSlots > 0) {
      focusNextOpenSlot();
      setMessage("Nächster offener Slot ist im Fokus.");
      return;
    }
    if (lineupReadyToSave && !isReadOnly) {
      setMessage("Lineup ist bereit: Enter speichert.");
      scrollLineupTarget("lineup-command-center");
      return;
    }
    setMessage(draft ? "Arena bereit." : "Preview prüfen oder Lineup speichern.");
  }

  function assignActiveSlotCandidateByIndex(index: number) {
    // In focusV2, resolve against the same tab/search-filtered list the board actually renders,
    // so "1"-"4" always match the candidate the user sees at that position.
    const sourceCandidates = uiVariant === "focusV2" ? focusV2VisibleCandidates : activeSlotSpotlightCandidates;
    if (!activeSlot || !sourceCandidates[index]) {
      return;
    }
    const candidate = sourceCandidates[index];
    const activePlayerId = candidate.player.activePlayerId ?? null;
    if (!activePlayerId) {
      return;
    }
    const candidateState = activeSlotCandidateByActivePlayerId.get(activePlayerId) ?? null;
    if (candidateState?.blockReason) {
      setMessage(formatLegacyLineupDragBlockReason(candidateState.blockReason) ?? "Kandidat passt nicht in den aktiven Slot.");
      return;
    }
    updateSelection(activeSlot.key, activePlayerId, { advanceFocusToNextOpenSlot: true });
  }

  function getFocusV2TopPickActivePlayerId() {
    const topPick =
      focusV2VisibleCandidates.find((entry) => !entry.activeSlotCandidate?.blockReason) ?? focusV2VisibleCandidates[0] ?? null;
    return topPick?.player.activePlayerId ?? null;
  }

  function clearActiveSlotSelection() {
    if (!activeSlot || !selections[activeSlot.key]) {
      return;
    }
    updateSelection(activeSlot.key, "");
  }

  function clearSlotSelection(slotKey: string) {
    if (!selections[slotKey]) {
      return;
    }
    updateSelection(slotKey, "");
  }

  function updateSelection(
    slotKey: string,
    activePlayerId: string,
    options?: { advanceFocusToNextOpenSlot?: boolean },
	  ) {
	    // Bug T-002 (defensive net): updateSelection ist der EINE Ort, an dem jede
	    // Zuweisung (Klick, Drag&Drop, Best-Fit, Top-Pick, Optimieren, Enter-Taste)
	    // letztlich landet. Blockierte Kandidaten (schon anderswo gesetzt, nicht
	    // verfügbar, Captain-Regel, Slot-Regel) dürfen NIE zugewiesen werden —
	    // unabhängig davon, ob der jeweilige Aufrufer schon selbst gefiltert hat.
	    // Gleicher Check wie die Kandidatenliste (resolveLegacyLineupDragBlockReason).
	    if (activePlayerId) {
	      const targetSlot = slots.find((slot) => slot.key === slotKey);
	      if (targetSlot) {
	        const rosterCard = rosterCardByActivePlayerId.get(activePlayerId) ?? null;
	        const option = getSelectedOptionMeta(activePlayerId);
	        const blockReason = resolveLegacyLineupDragBlockReason({
	          availabilityBlocker: rosterCard?.availabilityBlocker ?? null,
	          selectedSides: rosterCard?.selectedSides ?? [],
	          targetDisciplineSide: targetSlot.disciplineSide,
	          captainSide: captainSideByActivePlayerId.get(activePlayerId) ?? null,
	          hasBaseScore: option?.disciplineScores[targetSlot.disciplineId] != null,
	        });
	        if (blockReason) {
	          setMessage(formatLegacyLineupDragBlockReason(blockReason) ?? "Kandidat passt nicht in den aktiven Slot.");
	          return;
	        }
	      }
	    }
	    setPreview(null);
	    setMatchdayScorePreview(null);
	    setVisibleScoreboardSide(null);
	    setDraft(null);
	    const nextSelections = buildUpdatedSelections(selections, slotKey, activePlayerId);
    if (JSON.stringify(nextSelections) !== JSON.stringify(selections)) {
      if (activePlayerId) {
        setLineupAssignPulse((count) => count + 1);
      }
      const nextPlayerName = getSelectedOptionMeta(activePlayerId)?.name ?? "";
      const previousPlayerName = getSelectedOptionMeta(selections[slotKey])?.name ?? "";
      rememberLineupUndo(
        activePlayerId ? `${nextPlayerName || "Spieler"} eingesetzt` : `${formatLineupSlotLabel(slotKey)} geleert`,
        activePlayerId
          ? `${formatLineupSlotLabel(slotKey)}${previousPlayerName ? ` · vorher ${previousPlayerName}` : ""}`
          : previousPlayerName
            ? `${previousPlayerName} entfernt`
            : "Slot war leer",
      );
	    }
	    setSelections(nextSelections);
	    setDraft(null);
	    setHoveredCandidate(null);
    if (recentlyAssignedSlotTimeoutRef.current) {
      window.clearTimeout(recentlyAssignedSlotTimeoutRef.current);
    }
    setRecentlyAssignedSlotKey(activePlayerId ? slotKey : null);
    if (activePlayerId) {
      recentlyAssignedSlotTimeoutRef.current = window.setTimeout(() => {
        setRecentlyAssignedSlotKey(null);
        recentlyAssignedSlotTimeoutRef.current = null;
      }, 900);
    }
    if (options?.advanceFocusToNextOpenSlot && activePlayerId) {
      const nextSlotKey = getNextOpenSlotKeyAfter(slotKey, nextSelections);
      setActiveSlotKey(nextSlotKey);
      const nextSlot = slots.find((slot) => slot.key === nextSlotKey);
      if (nextSlot) {
        setFocusedDisciplineSide(nextSlot.disciplineSide);
        scrollLineupTarget(`lineup-slot-${nextSlot.key}`);
      }
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isTextTarget =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable ||
        target?.closest("[contenteditable='true']");
      const modalOpen = Boolean(document.querySelector(".foundation-modal-backdrop, .player-drawer-backdrop, [role='dialog']"));
      if (isTextTarget || modalOpen || isBusy) {
        return;
      }

      const digitMatch = event.code.match(/^(?:Digit|Numpad)([1-4])$/);
      if (digitMatch) {
        event.preventDefault();
        event.stopImmediatePropagation();
        assignActiveSlotCandidateByIndex(Number(digitMatch[1]) - 1);
        return;
      }

      if (event.code === "ArrowUp") {
        event.preventDefault();
        event.stopImmediatePropagation();
        focusSlotByOffset(-1);
        return;
      }

      if (event.code === "ArrowDown") {
        event.preventDefault();
        event.stopImmediatePropagation();
        focusSlotByOffset(1);
        return;
      }

      if (event.code === "Tab") {
        event.preventDefault();
        event.stopImmediatePropagation();
        focusSlotByOffset(event.shiftKey ? -1 : 1);
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        event.stopImmediatePropagation();
        jumpToNextLineupTask();
        return;
      }

      if (event.code === "Backspace" || event.code === "Delete") {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearActiveSlotSelection();
        return;
      }

      if (event.code === "Enter" && !isReadOnly) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const topCandidate =
          uiVariant === "focusV2"
            ? getFocusV2TopPickActivePlayerId()
            : activeSlotSpotlightCandidates[0]?.player.activePlayerId ?? null;
        if (activeSlot && !selections[activeSlot.key] && topCandidate) {
          updateSelection(activeSlot.key, topCandidate, { advanceFocusToNextOpenSlot: true });
          return;
        }
        if (lineupReadyToSave) {
          void handleSaveDraft();
        }
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [
    activeSlot,
    activeSlotCandidateByActivePlayerId,
    activeSlotSpotlightCandidates,
    activeSlotKey,
    isBusy,
    isReadOnly,
    lineupReadyToSave,
    matchdayPreviewCards.openSlots,
    selections,
    slots,
    uiVariant,
    focusV2VisibleCandidates,
  ]);

  function getProjectedCandidateForSlot(
    slot: ReturnType<typeof buildLegacyLineupLabSlots>[number],
    option: ReturnType<typeof buildLegacyLineupLabPlayerOptions>[number],
  ) {
    const rosterCard = rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
    return calculateMatchdayProjectedPreview({
      baseScore: option.disciplineScores[slot.disciplineId] ?? null,
      role: slotRoleByKey.get(slot.key) ?? null,
      attributeStats: rosterCard?.attributeStats ?? null,
      currentFatigueCount: option.fatigueCount ?? null,
      requiredPlayers: context?.disciplinePlayerCounts[slot.disciplineId] ?? null,
      intensity: getDisciplineIntensity(slot.disciplineSide),
      knownModifierBonus: 0,
      revealVariance: 0,
      rivalryPressure: getRivalryPressureForDiscipline(slot.disciplineId),
    });
  }

  function handleAutoFillOpenSlots() {
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);

    const nextSelections = { ...selections };
    const assignedActivePlayerIds = new Set(Object.values(nextSelections).filter(Boolean));
    let filledCount = 0;
    let projectedScoreGain = 0;

    for (const slot of slots) {
      if (nextSelections[slot.key]) {
        continue;
      }

      const bestCandidate = playerOptions
        .filter((option) => {
          if (assignedActivePlayerIds.has(option.activePlayerId)) {
            return false;
          }
          const rosterCard = rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
          return !rosterCard?.availabilityBlocker && option.disciplineScores[slot.disciplineId] != null;
        })
        .map((option) => ({
          option,
          projected: getProjectedCandidateForSlot(slot, option),
        }))
        .sort((left, right) => {
          const leftScore = left.projected.totalProjected ?? Number.NEGATIVE_INFINITY;
          const rightScore = right.projected.totalProjected ?? Number.NEGATIVE_INFINITY;
          if (leftScore !== rightScore) {
            return rightScore - leftScore;
          }
          return left.option.name.localeCompare(right.option.name, "de");
        })[0];

      if (bestCandidate) {
        nextSelections[slot.key] = bestCandidate.option.activePlayerId;
        assignedActivePlayerIds.add(bestCandidate.option.activePlayerId);
        filledCount += 1;
        projectedScoreGain += bestCandidate.projected.totalProjected ?? 0;
      }
    }

    if (filledCount > 0) {
      rememberLineupUndo(
        `${filledCount} Slots gefüllt`,
        `${lineupMeta.d1Selected + lineupMeta.d2Selected}/${lineupFlowSummary.totalRequired || "—"} vorher gesetzt`,
      );
    }
    setSelections(nextSelections);
    setHoveredCandidate(null);
    setMessage(
      filledCount > 0
        ? `${filledCount} offene Slots per Auto-Fill Rest gefüllt (Score-Projektion +${projectedScoreGain.toFixed(1)} gesamt). Undo ist direkt verfügbar, Captain bleibt bewusst manuell (${captainSeasonUsedWithDraft}/${captainSeasonLimit}).`
        : "Keine offenen Slots oder keine legalen Kandidaten gefunden.",
    );
  }

	  function updateTeamIntensityStage(intensity: MatchdayIntensityStage) {
	    setPreview(null);
	    setMatchdayScorePreview(null);
	    setVisibleScoreboardSide(null);
	    setDraft(null);
	    setTeamIntensity(intensity);
	    setModifiers((current) => ({
	      ...current,
	      d1: { ...current.d1, intensity },
	      d2: { ...current.d2, intensity },
	    }));
	  }

	  function updateDisciplineIntensityStage(disciplineSide: "d1" | "d2", intensity: MatchdayIntensityStage) {
	    setPreview(null);
	    setMatchdayScorePreview(null);
	    setVisibleScoreboardSide(null);
	    setDraft(null);
	    setModifiers((current) => ({
	      ...current,
	      [disciplineSide]: {
	        ...current[disciplineSide],
	        intensity,
	      },
	    }));
	  }

  function assignPlayerToSide(activePlayerId: string, disciplineSide: "d1" | "d2") {
    const existingSlot = slots.find(
      (slot) => slot.disciplineSide === disciplineSide && selections[slot.key] === activePlayerId,
    );
    if (existingSlot) {
      rememberLineupUndo(
        `${getSelectedOptionMeta(activePlayerId)?.name ?? "Spieler"} entfernt`,
        `${formatLineupSlotLabel(existingSlot.key)} geleert`,
	      );
	      setPreview(null);
	      setDraft(null);
	      setSelections((current) => ({
        ...current,
        [existingSlot.key]: "",
      }));
      setCaptains((current) =>
        current[disciplineSide] === activePlayerId
          ? {
              ...current,
              [disciplineSide]: "",
            }
          : current,
      );
      return;
    }

    const nextOpenSlot =
      slots.find((slot) => slot.disciplineSide === disciplineSide && !selections[slot.key]) ??
      slots.find((slot) => slot.disciplineSide === disciplineSide);
    if (!nextOpenSlot) {
      return;
    }
    updateSelection(nextOpenSlot.key, activePlayerId, { advanceFocusToNextOpenSlot: true });
  }

  function focusDisciplineSide(disciplineSide: "d1" | "d2") {
    setFocusedDisciplineSide(disciplineSide);
    const nextSlot =
      slots.find((slot) => slot.disciplineSide === disciplineSide && !selections[slot.key]) ??
      slots.find((slot) => slot.disciplineSide === disciplineSide) ??
      null;
    setActiveSlotKey(nextSlot?.key ?? null);
    scrollLineupTarget(`lineup-side-${disciplineSide}`);
  }

  function handlePlayerCardDragStart(activePlayerId: string | null) {
    setDraggedActivePlayerId(activePlayerId ?? null);
  }

  function handleDropOnSlot(slotKey: string, droppedActivePlayerId: string | null) {
    if (!droppedActivePlayerId) {
      return;
    }
    const dragPreview = slotDragPreviewByKey.get(slotKey) ?? null;
    if (dragPreview?.blockReason) {
      setMessage(formatLegacyLineupDragBlockReason(dragPreview.blockReason) ?? "Drop blockiert.");
      setDraggedActivePlayerId(null);
      return;
    }
    updateSelection(slotKey, droppedActivePlayerId, { advanceFocusToNextOpenSlot: true });
    setDraggedActivePlayerId(null);
  }

  function updateCaptain(disciplineSide: "d1" | "d2", activePlayerId: string) {
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
    setDraft(null);
    setCaptains((current) => ({
      ...current,
      [disciplineSide]: activePlayerId,
    }));
    if (activePlayerId) {
      const captainInfo = captainCandidateInfoBySide[disciplineSide].find((candidate) => candidate.activePlayerId === activePlayerId) ?? null;
      const captainName = getCaptainDisplayName(activePlayerId) ?? "Captain";
      const nextCaptainBudget = Math.min(captainSeasonLimit, captainSeasonUsedWithDraft + (captains[disciplineSide] ? 0 : 1));
      const budgetWarning =
        !captains[disciplineSide] && captainDraftRemaining <= 0
          ? ` Achtung: Saisonbudget ist bereits voll. Der Ready-Check markiert das sauber, bis du Captain-Budget frei machst.`
          : "";
      setMessage(
        `Captain gesetzt: ${captainName} · Score-Boost +${formatNullableScore(captainInfo?.estimatedCaptainBonus ?? null)} PP auf diesen Spieler · ${
          captainInfo?.moraleReward != null ? `Happiness +${formatDecimalScore(captainInfo.moraleReward, 1)}` : "kein Forderungsbonus"
        } · verbraucht beim Speichern Saisonbudget ${nextCaptainBudget}/${captainSeasonLimit}.${budgetWarning}`,
      );
    } else if (captains[disciplineSide]) {
      setMessage(`Captain entfernt. Dieser Einsatz wird beim Speichern nicht verbraucht · Budget bleibt ${captainSeasonUsedWithDraft}/${captainSeasonLimit}.`);
    }
  }

  function updateModifier(
    disciplineSide: "d1" | "d2",
    key: keyof LineupDraftModifiers["d1"],
    value: string,
  ) {
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
    setDraft(null);
    setModifiers((current) => ({
      ...current,
      [disciplineSide]: {
        ...current[disciplineSide],
        [key]: value || null,
      },
    }));
  }

  function updateFormCardSelection(
    disciplineSide: "d1" | "d2",
    slot: "primary" | "secondary",
    cardId: string | null,
  ) {
    if (isReadOnly || !context) {
      return;
    }

    const discipline =
      disciplineSide === "d1"
        ? context.matchdayContract?.discipline1 ?? null
        : context.matchdayContract?.discipline2 ?? null;
    const sideModifiers = modifiers[disciplineSide];
    const nextPrimary = slot === "primary" ? cardId : sideModifiers.primaryFormCardId;
    const nextSecondary = slot === "secondary" ? cardId : sideModifiers.secondaryFormCardId;

    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
    setDraft(null);
    setModifiers((current) => ({
      ...current,
      [disciplineSide]: {
        ...current[disciplineSide],
        primaryFormCardId: nextPrimary,
        secondaryFormCardId: nextSecondary,
      },
    }));
    queueFormCardPlanSave({
      matchdayId: params.matchdayId,
      disciplineSide,
      disciplineId: discipline?.disciplineId ?? null,
      primaryFormCardId: nextPrimary ?? null,
      secondaryFormCardId: nextSecondary ?? null,
    });
  }

  function renderInlineFormCardSelectors(
    disciplineSide: "d1" | "d2",
    disciplineColor: LegacyFormCardOption["color"] | null,
  ) {
    const pendingKey = `${params.matchdayId}:${disciplineSide}`;
    const isFormPending = formCardPlanPendingKey === pendingKey;

    return (
      <div className="legacy-lineup-draft-tactics-form">
        <label className="legacy-lineup-form-select-field">
          <span>F1</span>
          <select
            className="input"
            value={modifiers[disciplineSide].primaryFormCardId ?? ""}
            onChange={(event) =>
              updateFormCardSelection(disciplineSide, "primary", event.target.value || null)
            }
            disabled={isReadOnly || isFormPending || missingSeasonFormCards}
            aria-label={`${disciplineSide.toUpperCase()} Formkarte F1`}
          >
            <option value="">Keine Karte</option>
            {getFormCardOptionsForSide(disciplineSide, "primary").map((card) => (
              <option key={card.id} value={card.id} style={formCardOptionStyle(card)}>
                {formatFormCardOptionLabel(card, disciplineColor)}
              </option>
            ))}
          </select>
        </label>
        <label className="legacy-lineup-form-select-field">
          <span>F2</span>
          <select
            className="input"
            value={modifiers[disciplineSide].secondaryFormCardId ?? ""}
            onChange={(event) =>
              updateFormCardSelection(disciplineSide, "secondary", event.target.value || null)
            }
            disabled={isReadOnly || isFormPending || missingSeasonFormCards}
            aria-label={`${disciplineSide.toUpperCase()} Formkarte F2`}
          >
            <option value="">Keine Karte</option>
            {getFormCardOptionsForSide(disciplineSide, "secondary").map((card) => (
              <option key={card.id} value={card.id} style={formCardOptionStyle(card)}>
                {formatFormCardOptionLabel(card, disciplineColor)}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  function handleAdoptAiPreview() {
    if (!aiPreview) {
      return;
    }

    applyAiPreviewToUiDraft(aiPreview, { confirmOnOverwrite: true });
  }

  async function handleSaveAiPreview() {
    if (!aiPreview) {
      setMessage("Noch kein AI-Vorschlag vorhanden.");
      return;
    }

    if (source === "prisma" || isReadOnly) {
      setErrors(["Referenzmodus ist nur zum Anschauen. Bitte lokalen Spielstand nutzen."]);
      setMessage("");
      return;
    }

    const nextDraft = buildDraftStateFromAiPreview(aiPreview);
    const nextEntries = buildEntriesFromDraftState(nextDraft, slots, playerOptions, nextDraft.captains);
    const overwritesExisting =
      (draft?.entries.length ?? 0) > 0 || hasLineupDraftValues(selections, captains);
    const confirmText = overwritesExisting
      ? "Bestehende Einsatzliste wird ersetzt. AI-Vorschlag jetzt lokal speichern?"
      : "AI-Vorschlag jetzt lokal speichern?";
    const confirmed = window.confirm(confirmText);
    if (!confirmed) {
      setMessage("AI-Speichern abgebrochen.");
      return;
    }

    setSelections(nextDraft.selections);
    setCaptains(nextDraft.captains);
    setPreview(null);
    setWarnings(aiPreview.warnings ?? []);
    await saveEntries(nextEntries, "AI-Vorschlag gespeichert.");
  }

  function getAvailableOptionsForSlot(slotKey: string) {
    const selectedByOtherSlots = new Set(
      Object.entries(selections)
        .filter(([key, value]) => key !== slotKey && value)
        .map(([, value]) => value),
    );

    return playerOptions.filter((option) => {
      const selectedHere = selections[slotKey];
      return option.activePlayerId === selectedHere || !selectedByOtherSlots.has(option.activePlayerId);
    });
  }

  function getSelectedOptionMeta(activePlayerId: string | null | undefined) {
    if (!activePlayerId) {
      return null;
    }

    return playerOptions.find((option) => option.activePlayerId === activePlayerId) ?? null;
  }

  function getSelectedOptionScore(
    option: ReturnType<typeof buildLegacyLineupLabPlayerOptions>[number] | null,
    disciplineId: string | null | undefined,
  ) {
    if (!option || !disciplineId) {
      return null;
    }

    return option.disciplineScores[disciplineId] ?? null;
  }

  function renderOptionLabel(
    option: ReturnType<typeof buildLegacyLineupLabPlayerOptions>[number],
    disciplineId: string | null | undefined,
  ) {
    const score = disciplineId ? option.disciplineScores[disciplineId] ?? null : null;
    const injuryLabel =
      option.injuryStatus === "recovering"
        ? " · frisch zurück"
        : option.injuryRiskPercent != null && option.injuryRiskPercent > 0
          ? ` · ${option.injuryRiskLabel ?? "Verletzungsrisiko"} ${option.injuryRiskPercent}%`
          : "";
    return `${option.name} · ${score != null ? formatScore(score) : "—"} · ${formatExhaustionPoints(score, option.fatigueCount ?? null)}${injuryLabel}`;
  }

  function sortOptionsByDisciplineSkill(
    options: ReturnType<typeof buildLegacyLineupLabPlayerOptions>,
    disciplineId: string | null | undefined,
  ) {
    return [...options].sort((left, right) => {
      const leftScore = disciplineId ? left.disciplineScores[disciplineId] ?? Number.NEGATIVE_INFINITY : Number.NEGATIVE_INFINITY;
      const rightScore = disciplineId ? right.disciplineScores[disciplineId] ?? Number.NEGATIVE_INFINITY : Number.NEGATIVE_INFINITY;
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
      return left.name.localeCompare(right.name, "de");
    });
  }

  function getCaptainOptionsForSelectionMap(
    disciplineSide: "d1" | "d2",
    selectionMap: Record<string, string>,
  ) {
    const activePlayerIds = new Set(
      slots
        .filter((slot) => slot.disciplineSide === disciplineSide)
        .map((slot) => selectionMap[slot.key])
        .filter(Boolean),
    );
    const disciplineId =
      disciplineSide === "d1"
        ? context?.matchdayContract?.discipline1?.disciplineId ?? null
        : context?.matchdayContract?.discipline2?.disciplineId ?? null;
    return sortOptionsByDisciplineSkill(
      playerOptions.filter((option) => activePlayerIds.has(option.activePlayerId)),
      disciplineId,
    );
  }

  function getCaptainOptionsForSide(disciplineSide: "d1" | "d2") {
    return getCaptainOptionsForSelectionMap(disciplineSide, selections);
  }

  function getCaptainSelectEntriesForSelectionMap(
    disciplineSide: "d1" | "d2",
    selectionMap: Record<string, string>,
  ) {
    const rankedOptions = getCaptainOptionsForSelectionMap(disciplineSide, selectionMap);
    const entries = rankedOptions.map((option) => ({
      activePlayerId: option.activePlayerId,
      name: option.name,
    }));
    const knownActivePlayerIds = new Set(entries.map((entry) => entry.activePlayerId));
    const activePlayerIds = slots
      .filter((slot) => slot.disciplineSide === disciplineSide)
      .map((slot) => selectionMap[slot.key])
      .filter((activePlayerId): activePlayerId is string => Boolean(activePlayerId));

    for (const activePlayerId of activePlayerIds) {
      if (knownActivePlayerIds.has(activePlayerId)) {
        continue;
      }
      const rosterCard = rosterCardByActivePlayerId.get(activePlayerId) ?? null;
      entries.push({
        activePlayerId,
        name: rosterCard?.name ?? "Spieler",
      });
      knownActivePlayerIds.add(activePlayerId);
    }

    return entries;
  }

  function getCaptainSelectEntriesForSide(disciplineSide: "d1" | "d2") {
    return getCaptainSelectEntriesForSelectionMap(disciplineSide, selections);
  }

  function getCaptainDisplayName(activePlayerId: string | null | undefined) {
    if (!activePlayerId) {
      return null;
    }

    return getSelectedOptionMeta(activePlayerId)?.name ?? rosterCardByActivePlayerId.get(activePlayerId)?.name ?? null;
  }

  function getSelectedFormCardOption(cardId: string | null | undefined) {
    if (!cardId) {
      return null;
    }

    return (context?.formCards ?? []).find((card) => card.id === cardId) ?? null;
  }

  function renderSelectedFormCardChip(cardId: string | null | undefined, disciplineColor?: LegacyFormCardOption["color"] | null) {
    const card = getSelectedFormCardOption(cardId);
    if (!card) {
      return null;
    }

    return (
      <span className={`legacy-lineup-form-card-chip is-${card.color}`}>
        <span className="legacy-lineup-form-card-dot" aria-hidden="true" />
        {formatFormCardColorLabel(card.color)} {formatFormCardValueLabel(card.value)}
        {disciplineColor === card.color ? " · x2" : ""}
      </span>
    );
  }

  function getSelectedTeamPowerOption(powerId: string | null | undefined) {
    if (!powerId) {
      return null;
    }

    return (context?.teamPowers ?? []).find((power) => power.id === powerId) ?? null;
  }

  function getTeamPowerConditionalInfo(power: LegacyTeamPowerOption, disciplineId: string | null | undefined) {
    if (!disciplineId || power.conditionalTrigger !== "rival_top8_discipline" || !power.conditionalBonusPct) {
      return { active: false, bonusPct: 0, label: null as string | null, sourceLabel: null as string | null };
    }
    const powerWindow = context?.teamPowerWindows?.[disciplineId] ?? null;
    const topRival = powerWindow?.top8Rivals[0] ?? null;
    if (!topRival) {
      return { active: false, bonusPct: 0, label: null, sourceLabel: null };
    }
    return {
      active: true,
      bonusPct: power.conditionalBonusPct,
      label: `${topRival.teamName} #${topRival.rank}`,
      sourceLabel:
        powerWindow?.rankSource === "active_roster_top6_sum_discipline_score"
          ? "Rank Table Top 6"
          : powerWindow?.rankSource ?? "Rank Table",
    };
  }

  function getTeamPowerProjectedBreakdown(
    power: LegacyTeamPowerOption,
    disciplineSide: "d1" | "d2",
    disciplineId: string | null | undefined,
    disciplineCategory?: string | null,
  ) {
    const targetCategory = getTeamPowerCategoryForDiscipline(disciplineCategory);
    const isFit = power.category === "flex" || power.category === targetCategory;
    const fitMultiplier = isFit ? 1 : 0.6;
    const conditional = getTeamPowerConditionalInfo(power, disciplineId);
    const basePct = Number((power.modifier * fitMultiplier).toFixed(1));
    const extraPct = conditional.active ? Number((conditional.bonusPct * fitMultiplier).toFixed(1)) : 0;
    const attributeFitPct = calculateTeamPowerAttributeFitPctForUi(power, disciplineId, context?.disciplineWeights, fitMultiplier);
    const sidePreview = resolvedPreview?.disciplineSideScores.find((entry) => entry.disciplineSide === disciplineSide) ?? null;
    const anchorScore =
      sidePreview?.totalScore != null
        ? Math.max(sidePreview.totalScore - (sidePreview.teamPowerModifier ?? 0), 0)
        : null;
    const basePoints = anchorScore == null ? null : Number(((anchorScore * basePct) / 100).toFixed(1));
    const extraPoints = anchorScore == null ? null : Number(((anchorScore * extraPct) / 100).toFixed(1));
    const attributeFitPoints = anchorScore == null ? null : Number(((anchorScore * attributeFitPct) / 100).toFixed(1));
    return { isFit, conditional, basePct, extraPct, attributeFitPct, basePoints, extraPoints, attributeFitPoints };
  }

  function renderSelectedTeamPowerChip(
    powerId: string | null | undefined,
    disciplineSide: "d1" | "d2",
    disciplineId: string | null | undefined,
    disciplineCategory?: string | null,
  ) {
    const power = getSelectedTeamPowerOption(powerId);
    if (!power) {
      return null;
    }
    const breakdown = getTeamPowerProjectedBreakdown(power, disciplineSide, disciplineId, disciplineCategory);
    const isDebuffEffect = isTeamPowerDebuffEffect(power.effectType);
    const isPositiveEffect = !isDebuffEffect;
    const sign = isPositiveEffect ? "+" : "-";
    const pointPrefix = isPositiveEffect ? "+" : "ca -";
    const fitPointPrefix = (breakdown.attributeFitPoints ?? 0) >= 0 ? pointPrefix : isPositiveEffect ? "-" : "ca +";
    const totalImpactPct = Number((breakdown.basePct + breakdown.extraPct + breakdown.attributeFitPct).toFixed(1));
    const debuffSummary = describeTeamPowerDebuffEffect({
      effectType: power.effectType,
      targetMode: power.targetMode,
      targetLimit: power.targetLimit,
      impactPct: totalImpactPct,
    });

    return (
      <span
        className={`legacy-lineup-form-card-chip is-${isDebuffEffect ? "debuff" : breakdown.conditional.active ? "red is-power-window-active" : breakdown.isFit ? "blue" : "yellow"}`}
        title={[
          power.description,
          debuffSummary ? `${debuffSummary} — wirkt bei der Spieltag-Auflösung gegen Gegner, nicht auf deinen eigenen Score.` : null,
          breakdown.conditional.active
            ? `Zusatzeffekt aktiv: ${breakdown.conditional.label} (${breakdown.conditional.sourceLabel})`
            : power.conditionalDescription,
          `Tags: ${formatTeamPowerAttributeTags(power)}`,
          !isDebuffEffect && breakdown.basePoints != null ? `${formatDecimalScore(breakdown.basePct, 1)}% ≈ ${pointPrefix}${formatDecimalScore(breakdown.basePoints, 1)} Punkte` : null,
          !isDebuffEffect && breakdown.extraPoints ? `Extra ${formatDecimalScore(breakdown.extraPct, 1)}% ≈ ${pointPrefix}${formatDecimalScore(breakdown.extraPoints, 1)} Punkte` : null,
          breakdown.attributeFitPct ? `Attribut-Fit ${breakdown.attributeFitPct > 0 ? "+" : ""}${formatDecimalScore(breakdown.attributeFitPct, 1)}% ≈ ${fitPointPrefix}${formatDecimalScore(Math.abs(breakdown.attributeFitPoints ?? 0), 1)} Punkte` : null,
        ].filter(Boolean).join("\n")}
      >
        {isDebuffEffect ? "Debuff" : "Boost"} · {power.label}
        {isDebuffEffect
          ? debuffSummary
            ? ` · ${debuffSummary.replace(/^Debuff · /, "")}`
            : ""
          : ` ${sign}${formatDecimalScore(breakdown.basePct, 1)}%${breakdown.basePoints != null ? ` ≈ ${pointPrefix}${formatDecimalScore(breakdown.basePoints, 1)}P` : ""}`}
        {!isDebuffEffect && breakdown.extraPct ? ` · Extra +${formatDecimalScore(breakdown.extraPct, 1)}% ≈ ${formatDecimalScore(breakdown.extraPoints ?? 0, 1)}P` : ""}
        {breakdown.attributeFitPct ? ` · Fit ${breakdown.attributeFitPct > 0 ? "+" : ""}${formatDecimalScore(breakdown.attributeFitPct, 1)}%` : ""}
        {breakdown.conditional.active ? ` · ${breakdown.conditional.label}` : ""}
        {` · ${power.chargesRemaining}/${power.chargesTotal}`}
      </span>
    );
  }

  function getFormCardOptionsForSide(disciplineSide: "d1" | "d2", slot: "primary" | "secondary") {
    const sideSelection = modifiers[disciplineSide];
    const discipline =
      disciplineSide === "d1"
        ? context?.matchdayContract?.discipline1 ?? null
        : context?.matchdayContract?.discipline2 ?? null;
    const disciplineColor = getFormCardColorForCategory(discipline?.category ?? null);
    const selectedCardId =
      slot === "primary" ? sideSelection.primaryFormCardId : sideSelection.secondaryFormCardId;
    const reservedCards = new Set(
      [
        modifiers.d1.primaryFormCardId,
        modifiers.d1.secondaryFormCardId,
        modifiers.d2.primaryFormCardId,
        modifiers.d2.secondaryFormCardId,
      ].filter((value): value is string => Boolean(value) && value !== selectedCardId),
    );

    const availableCards = (context?.formCards ?? []).filter((card) => {
      if (reservedCards.has(card.id)) {
        return false;
      }
      if (slot === "secondary" && card.value < 0) {
        return false;
      }
      return !card.isUsed || card.id === selectedCardId;
    });
    return sortFormCardsForDiscipline(availableCards, disciplineColor);
  }

  function getFormBoardCardOptions(
    matchdayId: string,
    disciplineSide: "d1" | "d2",
    slot: "primary" | "secondary",
    disciplineColor?: LegacyFormCardOption["color"] | null,
  ) {
    const plan = formCardPlanByKey.get(`${matchdayId}:${disciplineSide}`) ?? null;
    const selectedCardId = slot === "primary" ? plan?.primaryFormCardId ?? null : plan?.secondaryFormCardId ?? null;
    const siblingCardId = slot === "primary" ? plan?.secondaryFormCardId ?? null : plan?.primaryFormCardId ?? null;
    return sortFormCardsForDiscipline(
      (context?.formCards ?? []).filter((card) => {
        if (slot === "secondary" && card.value <= 0) {
          return false;
        }
        if (card.id === selectedCardId) {
          return true;
        }
        if (card.id === siblingCardId) {
          return false;
        }
        if (card.isUsed) {
          return false;
        }
        return !plannedFormCardIds.has(card.id);
      }),
      disciplineColor,
    );
  }

  async function handleSaveFormCardPlan(input: {
    matchdayId: string;
    disciplineSide: "d1" | "d2";
    disciplineId: string | null;
    primaryFormCardId: string | null;
    secondaryFormCardId: string | null;
    /**
     * Push-Ziel der Seite. Bewusst dreiwertig: fehlt das Feld, laesst der Server
     * das gespeicherte Push-Ziel unangetastet — sonst wuerde jeder Kartenklick
     * die Intensitaets-Planung derselben Seite mitloeschen.
     */
    plannedIntensity?: MatchdayIntensityStage | null;
  }) {
    if (!context || isReadOnly) {
      return;
    }
    const pendingKey = `${input.matchdayId}:${input.disciplineSide}`;
    setFormCardPlanPendingKey(pendingKey);
    setErrors([]);
    setMessage("");
    try {
      const query = withRoomQuery(new URLSearchParams({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: input.matchdayId,
        teamId: params.teamId,
        source,
      }));
      const response = await fetch(`/api/lineups/legacy/form-card-plan?${query.toString()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disciplineSide: input.disciplineSide,
          disciplineId: input.disciplineId,
          primaryFormCardId: input.primaryFormCardId,
          secondaryFormCardId: input.secondaryFormCardId,
          ...("plannedIntensity" in input ? { plannedIntensity: input.plannedIntensity ?? null } : {}),
        }),
      });
      const payload = (await response.json()) as FormCardPlanResponse;
      if (!response.ok || payload.error || payload.errors?.length) {
        setErrors(payload.errors ?? [payload.error ?? "Formkarten-Plan konnte nicht gespeichert werden."]);
        return;
      }
      setContext((current) => current ? { ...current, formCardPlans: payload.plans ?? [] } : current);
      props.onFormCardPlanSaved?.({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: input.matchdayId,
        teamId: params.teamId,
        plans: payload.plans ?? [],
      });
      if (input.matchdayId === params.matchdayId) {
        setModifiers((current) =>
          applyPlannedFormCardsToModifiers(
            { ...context, formCardPlans: payload.plans ?? [] },
            current,
            { overwriteCurrentMatchday: true },
          ),
        );
        setDraft(null);
        setPreview(null);
        setMatchdayScorePreview(null);
      }
      setWarnings(payload.warnings ?? []);
      setMessage(
        "plannedIntensity" in input
          ? input.plannedIntensity == null
            ? "Push-Ziel entfernt."
            : `Push-Ziel gespeichert: ${formatIntensityStageLabel(input.plannedIntensity)}.`
          : input.primaryFormCardId || input.secondaryFormCardId
            ? input.matchdayId === params.matchdayId
              ? "Formplan synchronisiert — Entwurf übernimmt die Karten automatisch."
              : "Formplan gespeichert."
            : input.matchdayId === params.matchdayId
              ? "Formkarten entfernt — Entwurf wurde angepasst."
              : "Formplan-Eintrag entfernt.",
      );
    } catch {
      setErrors(["Formkarten-Plan konnte gerade nicht gespeichert werden."]);
    } finally {
      setFormCardPlanPendingKey(null);
    }
  }

  function queueFormCardPlanSave(input: {
    matchdayId: string;
    disciplineSide: "d1" | "d2";
    disciplineId: string | null;
    primaryFormCardId: string | null;
    secondaryFormCardId: string | null;
  }) {
    pendingFormCardPlanRef.current = input;
    if (formCardPlanSaveTimerRef.current) {
      window.clearTimeout(formCardPlanSaveTimerRef.current);
    }
    formCardPlanSaveTimerRef.current = window.setTimeout(() => {
      const pending = pendingFormCardPlanRef.current;
      pendingFormCardPlanRef.current = null;
      if (pending) {
        void handleSaveFormCardPlan(pending);
      }
    }, 300);
  }

  /**
   * Push-Ziel einer Spieltag-Seite im Formplan setzen bzw. wieder loeschen
   * (nochmal auf die aktive Stufe klicken = "kein Plan").
   *
   * Rein planerisch: die Wertung liest weiterhin nur die Intensitaet des am
   * Spieltag gespeicherten Entwurfs. Faellt der Plan auf den AKTIVEN Spieltag,
   * wird er zusaetzlich sofort in den Entwurf uebernommen — sonst muesste man
   * dieselbe Entscheidung zweimal treffen.
   */
  function setFormPlanIntensity(input: {
    matchdayId: string;
    disciplineSide: "d1" | "d2";
    disciplineId: string | null;
    intensity: MatchdayIntensityStage | null;
  }) {
    if (isReadOnly) {
      return;
    }
    const plan = formCardPlanByKey.get(`${input.matchdayId}:${input.disciplineSide}`) ?? null;
    if (input.matchdayId === params.matchdayId && input.intensity) {
      updateDisciplineIntensityStage(input.disciplineSide, input.intensity);
    }
    void handleSaveFormCardPlan({
      matchdayId: input.matchdayId,
      disciplineSide: input.disciplineSide,
      disciplineId: input.disciplineId,
      primaryFormCardId: plan?.primaryFormCardId ?? null,
      secondaryFormCardId: plan?.secondaryFormCardId ?? null,
      plannedIntensity: input.intensity,
    });
  }

  function assignFormCardToCell(input: {
    matchdayId: string;
    disciplineSide: "d1" | "d2";
    disciplineId: string | null;
    slot: "primary" | "secondary";
    cardId: string;
  }) {
    if (isReadOnly) {
      return;
    }
    const plan = formCardPlanByKey.get(`${input.matchdayId}:${input.disciplineSide}`) ?? null;
    queueFormCardPlanSave({
      matchdayId: input.matchdayId,
      disciplineSide: input.disciplineSide,
      disciplineId: input.disciplineId,
      primaryFormCardId: input.slot === "primary" ? input.cardId : plan?.primaryFormCardId ?? null,
      secondaryFormCardId: input.slot === "secondary" ? input.cardId : plan?.secondaryFormCardId ?? null,
    });
  }

  function assignFormCardFromDeck(cardId: string) {
    if (!activeFormPickCell || isReadOnly) {
      return;
    }
    const plan = formCardPlanByKey.get(`${activeFormPickCell.matchdayId}:${activeFormPickCell.disciplineSide}`) ?? null;
    queueFormCardPlanSave({
      matchdayId: activeFormPickCell.matchdayId,
      disciplineSide: activeFormPickCell.disciplineSide,
      disciplineId: activeFormPickCell.disciplineId,
      primaryFormCardId:
        activeFormPickCell.slot === "primary" ? cardId : plan?.primaryFormCardId ?? null,
      secondaryFormCardId:
        activeFormPickCell.slot === "secondary" ? cardId : plan?.secondaryFormCardId ?? null,
    });
    setActiveFormPickCell(null);
  }

  function clearActiveFormPickCell() {
    if (!activeFormPickCell || isReadOnly) {
      return;
    }
    const plan = formCardPlanByKey.get(`${activeFormPickCell.matchdayId}:${activeFormPickCell.disciplineSide}`) ?? null;
    queueFormCardPlanSave({
      matchdayId: activeFormPickCell.matchdayId,
      disciplineSide: activeFormPickCell.disciplineSide,
      disciplineId: activeFormPickCell.disciplineId,
      primaryFormCardId: activeFormPickCell.slot === "primary" ? null : plan?.primaryFormCardId ?? null,
      secondaryFormCardId: activeFormPickCell.slot === "secondary" ? null : plan?.secondaryFormCardId ?? null,
    });
    setActiveFormPickCell(null);
  }

  function skipFormCardsForSide(input: {
    matchdayId: string;
    disciplineSide: "d1" | "d2";
    disciplineId: string | null;
  }) {
    if (isReadOnly) {
      return;
    }
    queueFormCardPlanSave({
      matchdayId: input.matchdayId,
      disciplineSide: input.disciplineSide,
      disciplineId: input.disciplineId,
      primaryFormCardId: null,
      secondaryFormCardId: null,
    });
    setActiveFormPickCell(null);
  }

  // Formkarten-Direktzuweisung aus der Einsatzliste (statt nur über die Formplan-Seite):
  // setzt/leert eine Slot-Karte für die AKTUELLE Spieltag-Seite. Persistiert über denselben
  // Formplan-Save-Pfad wie das FormBoardPanel (queueFormCardPlanSave → Modifier-Sync).
  function assignDisciplineFormCardFromLineup(
    disciplineSide: "d1" | "d2",
    slot: "primary" | "secondary",
    cardId: string | null,
    disciplineId: string | null,
  ) {
    if (isReadOnly) {
      return;
    }
    const plan = formCardPlanByKey.get(`${params.matchdayId}:${disciplineSide}`) ?? null;
    queueFormCardPlanSave({
      matchdayId: params.matchdayId,
      disciplineSide,
      disciplineId,
      primaryFormCardId: slot === "primary" ? cardId : plan?.primaryFormCardId ?? null,
      secondaryFormCardId: slot === "secondary" ? cardId : plan?.secondaryFormCardId ?? null,
    });
  }

  function buildLineupFormCardControlForSide(disciplineSide: "d1" | "d2") {
    const discipline =
      disciplineSide === "d1"
        ? context?.matchdayContract?.discipline1 ?? null
        : context?.matchdayContract?.discipline2 ?? null;
    const color = getFormCardColorForCategory(discipline?.category ?? null);
    const plan = formCardPlanByKey.get(`${params.matchdayId}:${disciplineSide}`) ?? null;
    const toChoice = (card: LegacyFormCardOption) => ({
      id: card.id,
      label: formatFormCardOptionLabel(card, color),
      // Bereichsfarbe der Karte (POW=rot, SPE=grün, MEN=blau, SOC=gelb) für die
      // farbige, etwas größere Punkte-Anzeige im Einsatzlisten-Dropdown.
      color: card.color,
    });
    return {
      disciplineId: discipline?.disciplineId ?? null,
      colorLabel: color ? formatFormCardColorLabel(color) : null,
      primarySelectedId: plan?.primaryFormCardId ?? null,
      secondarySelectedId: plan?.secondaryFormCardId ?? null,
      primaryOptions: getFormBoardCardOptions(params.matchdayId, disciplineSide, "primary", color).map(toChoice),
      secondaryOptions: getFormBoardCardOptions(params.matchdayId, disciplineSide, "secondary", color).map(toChoice),
    };
  }

  function getTeamPowerOptionsForSide(disciplineSide: "d1" | "d2") {
    const selectedPowerId = modifiers[disciplineSide].teamPowerId;
    const otherPowerId = disciplineSide === "d1" ? modifiers.d2.teamPowerId : modifiers.d1.teamPowerId;
    const discipline =
      disciplineSide === "d1"
        ? context?.matchdayContract?.discipline1 ?? null
        : context?.matchdayContract?.discipline2 ?? null;
    const targetCategory = getTeamPowerCategoryForDiscipline(discipline?.category ?? null);

    return [...(context?.teamPowers ?? [])]
      .filter((power) => {
        if (otherPowerId && power.id === otherPowerId) {
          return false;
        }
        return !power.isUsedUp || power.id === selectedPowerId;
      })
      .sort((left, right) => {
        const leftFit = left.category === "flex" || left.category === targetCategory ? 0 : 1;
        const rightFit = right.category === "flex" || right.category === targetCategory ? 0 : 1;
        if (leftFit !== rightFit) return leftFit - rightFit;
        if (left.source !== right.source) return left.source === "team_identity" ? -1 : 1;
        if (left.modifier !== right.modifier) return right.modifier - left.modifier;
        return left.label.localeCompare(right.label, "de");
      });
  }

  function getTeamPowerEmptyOptionLabel(disciplineSide: "d1" | "d2") {
    if (context?.teamPowerSource?.selectionStatus === "missing_source") {
      return "Powers Quelle fehlt";
    }

    const powers = context?.teamPowers ?? [];
    if (powers.length === 0) {
      return "Keine Team-Power vorhanden";
    }

    if (getTeamPowerOptionsForSide(disciplineSide).length > 0) {
      return "Keine Team-Power";
    }

    const selectedPowerId = modifiers[disciplineSide].teamPowerId;
    const otherPowerId = disciplineSide === "d1" ? modifiers.d2.teamPowerId : modifiers.d1.teamPowerId;
    const availableForSide = powers.filter((power) => !power.isUsedUp || power.id === selectedPowerId);
    if (availableForSide.length === 0) {
      return "Alle Team-Powers verbraucht";
    }
    if (otherPowerId && availableForSide.every((power) => power.id === otherPowerId)) {
      return "Power schon in anderer Diszi";
    }

    return "Keine Team-Power verfügbar";
  }

  function getTeamPowerSelectTitle(disciplineSide: "d1" | "d2") {
    return [
      isReadOnly ? "Bearbeitung gesperrt: Das aktive Team ist für diesen Owner im Save nicht steuerbar." : null,
      context?.teamPowerSource?.sourceLabel ?? null,
      getTeamPowerEmptyOptionLabel(disciplineSide),
    ].filter(Boolean).join("\n");
  }

  /**
   * Team-Power-Auswahl für die Einsatzliste ("Neuer Look"). Die Auswahl-Logik
   * (welche Power für welche Seite wählbar ist, Sortierung nach Fit/Quelle,
   * Beschriftung mit Effekt/Fit/Ladungen) existiert bereits für die alte
   * Ansicht — hier wird sie nur in ein reines Datenmodell für `LineupNewLook`
   * überführt. Es wird nichts neu berechnet: `getTeamPowerOptionsForSide`,
   * `formatTeamPowerOptionLabel`, `getTeamPowerConditionalInfo` und
   * `getTeamPowerProjectedBreakdown` sind dieselben Funktionen wie zuvor.
   *
   * Ohne diesen Durchreicher konnte man in der Einsatzliste GAR KEINE
   * Team-Power mehr setzen: die Optionen wurden zwar weiterhin abgeleitet,
   * aber von keiner Ansicht mehr gerendert.
   */
  function buildLineupTeamPowerControlForSide(disciplineSide: "d1" | "d2") {
    const discipline =
      disciplineSide === "d1"
        ? context?.matchdayContract?.discipline1 ?? null
        : context?.matchdayContract?.discipline2 ?? null;
    const disciplineId = discipline?.disciplineId ?? null;
    const disciplineCategory = discipline?.category ?? null;
    const selectedId = modifiers[disciplineSide].teamPowerId ?? null;
    const options = getTeamPowerOptionsForSide(disciplineSide).map((power) => {
      const conditional = getTeamPowerConditionalInfo(power, disciplineId);
      return {
        id: power.id,
        label: formatTeamPowerOptionLabel(
          power,
          disciplineCategory,
          conditional.active,
          disciplineId,
          context?.disciplineWeights,
        ),
        isDebuff: isTeamPowerDebuffEffect(power.effectType),
        isOffFit: !(power.category === "flex" || power.category === getTeamPowerCategoryForDiscipline(disciplineCategory)),
      };
    });

    const selectedPower = getSelectedTeamPowerOption(selectedId);
    let selectedSummary: string | null = null;
    if (selectedPower) {
      const breakdown = getTeamPowerProjectedBreakdown(selectedPower, disciplineSide, disciplineId, disciplineCategory);
      const isDebuffEffect = isTeamPowerDebuffEffect(selectedPower.effectType);
      const totalPct = Number((breakdown.basePct + breakdown.extraPct + breakdown.attributeFitPct).toFixed(1));
      selectedSummary = [
        `${isDebuffEffect ? "−" : "+"}${formatDecimalScore(Math.abs(totalPct), 1)}%`,
        isDebuffEffect ? "gegen Gegner" : breakdown.isFit ? "Fit" : "Off-Fit",
        breakdown.conditional.active ? `Zusatz aktiv (${breakdown.conditional.label})` : null,
        `${selectedPower.chargesRemaining}/${selectedPower.chargesTotal} Ladungen`,
      ]
        .filter(Boolean)
        .join(" · ");
    }

    return {
      disciplineId,
      selectedId,
      options,
      emptyLabel: getTeamPowerEmptyOptionLabel(disciplineSide),
      title: getTeamPowerSelectTitle(disciplineSide),
      selectedSummary,
      sourceLabel: context?.teamPowerSource?.sourceLabel ?? null,
    };
  }

  function openPlayerDetails(playerId: string, activePlayerId?: string | null) {
    props.onOpenPlayerDetails?.({ playerId, activePlayerId });
  }

  function getPlayerIdForActivePlayer(activePlayerId: string | null | undefined) {
    if (!activePlayerId) {
      return null;
    }

    return playerOptions.find((option) => option.activePlayerId === activePlayerId)?.playerId ?? null;
  }

  function openPlayerDetailsForActivePlayer(activePlayerId: string | null | undefined) {
    const playerId = getPlayerIdForActivePlayer(activePlayerId);
    if (playerId) {
      openPlayerDetails(playerId, activePlayerId);
    }
  }

  const showExpertBackupPanels = isExpertModeEnabled;
  const lineupPlayerTableColumns = useMemo<LegacyLineupTableColumn[]>(
    () => [
      { id: "image", label: "Bild", defaultWidth: 84, minWidth: 72 },
      { id: "name", label: "Name", defaultWidth: 190, minWidth: 150 },
      { id: "team", label: "Team", defaultWidth: 150, minWidth: 120 },
      { id: "contractLength", label: "LZ", defaultWidth: 70, minWidth: 58 },
      { id: "className", label: "Klasse", defaultWidth: 118, minWidth: 98 },
      { id: "potential", label: "Potential", defaultWidth: 96, minWidth: 82 },
      { id: "discipline1Score", label: d1Label, defaultWidth: 88, minWidth: 72 },
      { id: "discipline2Score", label: d2Label, defaultWidth: 88, minWidth: 72 },
      { id: "appearances", label: "Einsätze", defaultWidth: 92, minWidth: 78 },
      { id: "marketValue", label: "MW", defaultWidth: 108, minWidth: 88 },
      { id: "traitsPositive", label: "TraitPos", defaultWidth: 180, minWidth: 140 },
      { id: "traitsNegative", label: "TraitNeg", defaultWidth: 180, minWidth: 140 },
    ],
    [d1Label, d2Label],
  );
  const lineupPlayerTablePresets = useMemo<LegacyLineupTablePreset[]>(
    () => {
      const defaultOrder = lineupPlayerTableColumns.map((column) => column.id);
      return [
        {
          id: "retool_default",
          label: "Retool Default",
          order: defaultOrder,
          visibleColumnIds: defaultOrder,
        },
        {
          id: "compact",
          label: "Compact",
          order: defaultOrder,
          visibleColumnIds: ["image", "name", "className", "discipline1Score", "discipline2Score", "appearances", "marketValue"],
        },
        {
          id: "finance",
          label: "Finance",
          order: defaultOrder,
          visibleColumnIds: ["image", "name", "team", "contractLength", "marketValue", "traitsPositive", "traitsNegative"],
        },
        {
          id: "performance",
          label: "Performance",
          order: defaultOrder,
          visibleColumnIds: ["image", "name", "className", "potential", "discipline1Score", "discipline2Score", "appearances"],
        },
      ];
    },
    [lineupPlayerTableColumns],
  );
  const visibleLineupPlayerTableColumns = useMemo(
    () =>
      orderLegacyLineupColumns(
        lineupPlayerTableColumns,
        tablePreferences.lineupPlayerTable?.columnOrder,
      ).filter((column) => {
        const explicit = tablePreferences.lineupPlayerTable?.columnVisibility?.[column.id];
        if (typeof explicit === "boolean") {
          return explicit;
        }
        return column.visibleByDefault ?? true;
      }),
    [lineupPlayerTableColumns, tablePreferences.lineupPlayerTable?.columnOrder, tablePreferences.lineupPlayerTable?.columnVisibility],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      LEGACY_LINEUP_TABLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(tablePreferences),
    );
  }, [tablePreferences]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      LEGACY_LINEUP_EXPERT_MODE_STORAGE_KEY,
      isExpertModeEnabled ? "true" : "false",
    );
  }, [isExpertModeEnabled]);

  // "Neuer Look" Flag-Gate (additiv): alle Hooks und Derivations sind an dieser
  // Stelle bereits gelaufen (stabile Hook-Reihenfolge beim Umschalten). Der neue
  // Squad-Builder konsumiert dieselben abgeleiteten Daten und ruft dieselben
  // Handler auf wie der focusV2-Pfad; Flag aus => bestehende Ansicht unverändert.
    //
    // Formplan-Ansicht: Der Shell schaltet die Sub-View auf "formplan" (=> draftBoardView "formBoard").
    // Früher rendere der Client dennoch immer die Einsatzliste (LineupNewLook), sodass der Formplan-Tab
    // nichts anzeigte ("Seite funktioniert nicht"). Das bereits vollständig gebaute FormBoardPanel wird
    // hier jetzt gemountet und mit den vorhandenen Handlern/Derivations versorgt.
    if (draftBoardView === "formBoard") {
      return (
        <FormBoardPanel
          modifiers={modifiers}
          context={context}
          draft={draft}
          draftIntensityPreview={draftIntensityPreview}
          formPlanOpenCells={formPlanOpenCells}
          formDeckCards={formDeckCards}
          formCardCounts={formCardCounts}
          activeFormPickCell={activeFormPickCell}
          formCardPlanByKey={formCardPlanByKey}
          formCardPlanPendingKey={formCardPlanPendingKey}
          usedFormCards={usedFormCards}
          isReadOnly={isReadOnly}
          matchdayId={params.matchdayId}
          matchdayOptions={options.matchdays}
          /* Saison-Ressourcen-Kontext für das Formplan-Cockpit: Captain-Budget kommt
             aus den bestehenden Derivations oben (keine Neuberechnung). Eine
             Captain-Vorausplanung pro Spieltag existiert bewusst nicht. Das
             Push-Ziel dagegen schon — es liegt im Formkarten-Plan-Datensatz. */
          captainSeasonLimit={captainSeasonLimit}
          captainSeasonUsedWithDraft={captainSeasonUsedWithDraft}
          captainDraftRemaining={captainDraftRemaining}
          setFormPlanIntensity={setFormPlanIntensity}
          formatModifierSourceLabel={formatModifierSourceLabel}
          formatFormPlanImpact={formatFormPlanImpact}
          formatFormCardValueLabel={formatFormCardValueLabel}
          formatFormCardColorLabel={formatFormCardColorLabel}
          formatFormCardOptionLabel={formatFormCardOptionLabel}
          formatNullableScore={formatNullableScore}
          resolveTeamDisciplineRank={resolveTeamDisciplineRank}
          getFormCardColorForCategory={getFormCardColorForCategory}
          getFormBoardCardOptions={getFormBoardCardOptions}
          renderSelectedFormCardChip={renderSelectedFormCardChip}
          clearActiveFormPickCell={clearActiveFormPickCell}
          assignFormCardFromDeck={assignFormCardFromDeck}
          assignFormCardToCell={assignFormCardToCell}
          setActiveFormPickCell={setActiveFormPickCell}
          skipFormCardsForSide={skipFormCardsForSide}
        />
      );
    }
    return (
      <LineupNewLook
        context={context}
        slots={slots}
        selections={selections}
        activeSlotKey={activeSlot?.key ?? null}
        nextOpenSlotKey={nextOpenSlotKey}
        onActiveSlotChange={(slotKey) => {
          setActiveSlotKey(slotKey);
          const slot = slots.find((entry) => entry.key === slotKey);
          if (slot) {
            setFocusedDisciplineSide(slot.disciplineSide);
          }
        }}
        rosterCardByActivePlayerId={rosterCardByActivePlayerId}
        slotCandidateSummaryByKey={slotCandidateSummaryByKey}
        slotPreviewByKey={slotPreviewByKey}
        slotRoleByKey={slotRoleByKey}
        slotIssuesByKey={slotIssuesByKey}
        candidateGroups={teamdeckCandidateGroups}
        candidateTab={focusV2CandidateTab}
        onCandidateTabChange={setFocusV2CandidateTab}
        playerBestSlotSummaryByActivePlayerId={playerBestSlotSummaryByActivePlayerId}
        captains={captains}
        captainSelectEntriesBySide={{
          d1: getCaptainSelectEntriesForSide("d1"),
          d2: getCaptainSelectEntriesForSide("d2"),
        }}
        captainInfoBySide={captainCandidateInfoBySide}
        captainDraftRemaining={captainDraftRemaining}
        captainSeasonUsedWithDraft={captainSeasonUsedWithDraft}
        captainSeasonLimit={captainSeasonLimit}
        onUpdateCaptain={updateCaptain}
        lineupMeta={lineupMeta}
        d1Rank={d1Rank}
        d2Rank={d2Rank}
        getSelectedOptionMeta={getSelectedOptionMeta}
        assignPulse={lineupAssignPulse}
        onAssignPlayer={(slotKey, activePlayerId) => {
          updateSelection(slotKey, activePlayerId, { advanceFocusToNextOpenSlot: true });
          const slot = slots.find((entry) => entry.key === slotKey);
          if (slot) {
            setFocusedDisciplineSide(slot.disciplineSide);
          }
        }}
        onClearSlot={(slotKey) => updateSelection(slotKey, "")}
        onOpenPlayer={(playerId, activePlayerId) => openPlayerDetails(playerId, activePlayerId)}
        isReadOnly={isReadOnly}
        isBusy={isBusy}
        matchdayPreviewCards={matchdayPreviewCards}
        lineupFlowSummary={lineupFlowSummary}
        lineupSaveCta={lineupSaveCta}
        lineupReadyToSave={lineupReadyToSave}
        lineupFinishItems={lineupFinishItems}
        formatProjectedMetricWindow={formatProjectedMetricWindow}
        onFocusNextOpenSlot={focusNextOpenSlot}
        onAutoFillOpenSlots={handleAutoFillOpenSlots}
        onSaveDraft={() => void handleSaveDraft()}
        getDisciplineIntensity={getDisciplineIntensity}
        onUpdateDisciplineIntensity={updateDisciplineIntensityStage}
        playerFilter={playerFilter}
        onPlayerFilterChange={setPlayerFilter}
        rosterShortfall={lineupRosterShortfall}
        arenaReady={focusV2ArenaReady}
        onNavigateArena={
          props.onOpenArena
            ? () => {
                if (typeof window !== "undefined") {
                  window.sessionStorage.setItem("lineup-v2-arena-handoff", "1");
                }
                props.onOpenArena?.({
                  saveId: params.saveId,
                  seasonId: params.seasonId,
                  matchdayId: params.matchdayId,
                  teamId: params.teamId,
                });
              }
            : undefined
        }
        disciplineTacticPreviewBySide={focusV2DisciplineTacticPreviewBySide}
        disciplineTacticRangeBySide={focusV2DisciplineTacticRangeBySide}
        recentlyAssignedSlotKey={recentlyAssignedSlotKey}
        undoInfo={lineupUndoSnapshot ? { label: lineupUndoSnapshot.label, detail: lineupUndoSnapshot.detail } : null}
        onUndo={restoreLineupUndo}
        statusMessage={message}
        errors={errors}
        resolvePreview={preview}
        formCardControlsBySide={{
          d1: buildLineupFormCardControlForSide("d1"),
          d2: buildLineupFormCardControlForSide("d2"),
        }}
        onAssignDisciplineFormCard={assignDisciplineFormCardFromLineup}
        formCardSavePendingSide={{
          d1: formCardPlanPendingKey === `${params.matchdayId}:d1`,
          d2: formCardPlanPendingKey === `${params.matchdayId}:d2`,
        }}
        // Abgeschaltete Team-Powers reichen gar keine Controls durch. Die Ansicht blendet
        // den Block bei `null` komplett aus — auch dann, wenn ein alter Draft noch eine
        // `teamPowerId` gespeichert hat. Genau daran hing das Dropdown zuletzt noch: die
        // Optionsliste war leer, die gespeicherte Auswahl hielt den Kasten aber am Leben.
        teamPowerControlsBySide={
          areTeamPowersEnabled()
            ? {
                d1: buildLineupTeamPowerControlForSide("d1"),
                d2: buildLineupTeamPowerControlForSide("d2"),
              }
            : null
        }
        onAssignTeamPower={(disciplineSide, powerId) => updateModifier(disciplineSide, "teamPowerId", powerId ?? "")}
        controlsSlot={
          <>
            <label>
              <span>Spieltag</span>
              <select
                className={`input legacy-lineup-select${selectedMatchdayIsReady ? " is-complete" : ""}`}
                value={params.matchdayId}
                onChange={(event) => void loadContext({ matchdayId: event.target.value }, source)}
              >
                {options.matchdays.map((matchday) => (
                  <option key={matchday.id} value={matchday.id}>
                    {formatMatchdayOptionLabel(matchday)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Team</span>
              <select
                className={`input legacy-lineup-select${selectedTeamIsReady ? " is-complete" : ""}`}
                value={params.teamId}
                onChange={(event) => {
                  const nextTeamId = event.target.value;
                  props.onTeamChange?.(nextTeamId);
                  void loadContext({ teamId: nextTeamId }, source);
                }}
              >
                {filteredTeamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {formatNlTeamOptionLabel(team)}
                  </option>
                ))}
              </select>
            </label>
          </>
        }
      />
    );
}
