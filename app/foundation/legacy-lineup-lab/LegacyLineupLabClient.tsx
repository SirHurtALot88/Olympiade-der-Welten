"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import FormBoardPanel from "@/app/foundation/legacy-lineup-lab/FormBoardPanel";
import DraftWorkspace from "@/app/foundation/legacy-lineup-lab/DraftWorkspace";
import LineupExpertPanels from "@/app/foundation/legacy-lineup-lab/LineupExpertPanels";
import { LegacyLineupVirtualCardGrid } from "@/app/foundation/legacy-lineup-lab/LegacyLineupVirtualTableBody";
import { useRowVirtualWindow } from "@/lib/foundation/use-row-virtual-window";
import { resolveFirstOpenFormPickCell } from "@/lib/foundation/resolve-first-open-form-cell";

import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { VeloImpactStrip, VeloStatOrbitRow } from "@/components/foundation/velo-ui";
import { getGameTermTooltip } from "@/components/ui/GameTerm";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { DisciplineCategory, FormCardPlanRecord, LineupDraftModifiers, Player, PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";
import {
  appendRoomContextToParams,
  readFoundationRoomContextFromLocation,
  type FoundationRoomContext,
} from "@/lib/room/foundation-room-context-client";
import {
  buildLegacyLineupEntriesFromSelections,
  buildLegacyLineupLabPlayerOptions,
  buildLegacyLineupLabSlots,
  findDuplicateActivePlayerSelections,
} from "@/lib/lineups/legacy-lineup-lab";
import { buildLineupPlayerDemandMap } from "@/lib/morale/player-demands-service";
import {
  calculateMatchdayProjectedPreview,
  getMatchdayIntensityConfig,
  resolveSlotRolesForDiscipline,
  type MatchdayIntensityStage,
  type MatchdaySlotRoleDefinition,
} from "@/lib/lineups/matchday-slot-roles";
import { calculatePerPlayerFormModifier } from "@/lib/lineups/legacy-lineup-modifiers";
import { applyPlannedFormCardsToModifiers } from "@/lib/foundation/form-board-plan-service";
import {
  formatLegacyLineupDragBlockReason,
  getLegacyLineupDragFitTier,
  resolveLegacyLineupDragBlockReason,
  type LegacyLineupDragBlockReason,
  type LegacyLineupDragFitTier,
} from "@/lib/lineups/legacy-lineup-drag-drop";
import { getTransfermarktTierFromPoints } from "@/lib/market/transfermarkt-sheet-stats";
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
import type { AiLegacyLineupPreview } from "@/lib/ai/ai-needs-types";

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
  initialSource?: "sqlite" | "prisma";
  defaultSaveId?: string;
  defaultSaveName?: string;
  defaultSeasonId?: string;
  defaultMatchdayId?: string;
  defaultTeamId?: string;
  highlightMissingSlots?: boolean;
  focusMissingRequestKey?: string | null;
  initialDraftBoardView?: "lineup" | "formBoard";
  onDraftBoardViewApplied?: () => void;
  activeOwnerId?: string | null;
  manageableTeamIds?: string[];
  onTeamChange?: (teamId: string) => void;
  playerCatalog?: Player[];
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onLineupSaved?: (payload: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
    teamId: string;
    silent: boolean;
    draft?: LegacyLineupDraft | null;
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
};

type LineupPlayerTableRow = {
  id: string;
  activePlayerId: string | null;
  portraitUrl: string | null;
  name: string;
  teamName: string;
  contractLength: number | null;
  className: string | null;
  potential: number | null;
  discipline1Score: number | null;
  discipline2Score: number | null;
  appearances: number | null;
  marketValue: number | null;
  traitsPositive: string[];
  traitsNegative: string[];
  injuryStatus: "healthy" | "injured" | "recovering" | null;
  injuryRiskLabel: string | null;
  availabilityBlocker: string | null;
  demands: Array<{
    demandId: string;
    label: string;
    detail: string;
    targetDisciplineId?: string | null;
    status: "open" | "fulfilled" | "at_risk" | "failed";
    priority: "low" | "medium" | "high";
    moraleReward: number;
    moralePenalty: number;
  }>;
  attributeStats: PlayerAttributeSheetStats | null;
  attributeRatings: Partial<Record<keyof PlayerAttributeSheetStats, string | null>> | null;
};

type MatchdayFocusAttribute = {
  key: keyof PlayerAttributeSheetStats;
  label: string;
  shortLabel: string;
  weightPct: number;
  value: number | null;
  ratingLabel: string | null;
};

type MatchdayWeightInfo = Pick<MatchdayFocusAttribute, "key" | "label" | "shortLabel" | "weightPct">;

type MatchdayRosterCard = LineupPlayerTableRow & {
  discipline1Label: string;
  discipline2Label: string;
  selectedSides: Array<"d1" | "d2">;
  topAttributesD1: MatchdayFocusAttribute[];
  topAttributesD2: MatchdayFocusAttribute[];
  fitLane: "d1" | "flex" | "d2";
  fitDelta: number;
  fatigueCount: number | null;
  captainEligible: boolean;
};

type MatchdaySlotPreviewCard = {
  slotKey: string;
  disciplineSide: "d1" | "d2";
  role: MatchdaySlotRoleDefinition | null;
  intensity: MatchdayIntensityStage;
  projected: ReturnType<typeof calculateMatchdayProjectedPreview>;
  selectedScore: number | null;
  selectedPlayerName: string | null;
};

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

type MatchdaySlotReadiness = "empty" | "optimal" | "solid" | "risky";
type TeamdeckFilterMode = "all" | "free" | "assigned" | "blocked";
type TeamdeckSortMode = "top" | "d1" | "d2" | "captain" | "fatigue" | "wish";
type TeamdeckCandidateQualityKey = "instant" | "alternative" | "fatigue" | "blocked" | "emergency";

type LineupMoraleDecision = {
  playerId: string;
  activePlayerId: string | null;
  playerName: string;
  demandId: string;
  label: string;
  detail: string;
  priority: "low" | "medium" | "high";
  targetDisciplineId: string | null;
  fulfilled: boolean;
  isRelevant: boolean;
  moraleDelta: number;
};

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

type MatchdayCardRoleInsight = {
  role: MatchdaySlotRoleDefinition | null;
  projected: ReturnType<typeof calculateMatchdayProjectedPreview> | null;
  majorValue: number | null;
  minorValue: number | null;
  strainValue: number | null;
  keyValues: Array<{
    key: keyof PlayerAttributeSheetStats;
    shortLabel: string;
    value: number | null;
    weightPct: number;
    deltaPct: number;
    emphasis: "primary" | "secondary" | "support";
  }>;
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

type LegacyLineupSortState = {
  key: string;
  direction: "asc" | "desc";
};

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

const attributeShortLabels: Record<keyof PlayerAttributeSheetStats, string> = {
  power: "POW",
  health: "HEA",
  stamina: "STA",
  intelligence: "INT",
  awareness: "AWA",
  determination: "DET",
  speed: "SPD",
  dexterity: "DEX",
  charisma: "CHA",
  will: "WIL",
  spirit: "SPI",
  torment: "TOR",
  height: "HGT",
};

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

function resolveBestCardRoleInsight(
  roles: MatchdaySlotRoleDefinition[],
  attributeStats: PlayerAttributeSheetStats | null | undefined,
  baseScore: number | null | undefined,
  fatigueCount: number | null | undefined,
) : MatchdayCardRoleInsight | null {
  if (!roles.length) {
    return null;
  }

  const insights = roles.map((role) => {
    const majorValue = attributeStats?.[role.majorPositiveAttribute] ?? null;
    const minorValue = attributeStats?.[role.minorPositiveAttribute] ?? null;
    const strainValue = attributeStats?.[role.strainAttribute] ?? null;
    const keyValues = (role.keyAttributes?.length
      ? role.keyAttributes.slice(0, 4)
      : [
          { attribute: role.majorPositiveAttribute, weightPct: 0, deltaPct: 0, emphasis: "primary" as const },
          { attribute: role.minorPositiveAttribute, weightPct: 0, deltaPct: 0, emphasis: "secondary" as const },
          { attribute: role.strainAttribute, weightPct: 0, deltaPct: 0, emphasis: "support" as const },
        ]
    ).map((attribute) => ({
      key: attribute.attribute,
      shortLabel: attributeShortLabels[attribute.attribute],
      value: attributeStats?.[attribute.attribute] ?? null,
      weightPct: attribute.weightPct,
      deltaPct: attribute.deltaPct,
      emphasis: attribute.emphasis,
    }));
    const projected = calculateMatchdayProjectedPreview({
      baseScore: baseScore ?? 0,
      role,
      attributeStats,
      currentFatigueCount: fatigueCount,
      requiredPlayers: roles.length,
      intensity: "normal",
      knownModifierBonus: 0,
      revealVariance: 0,
    });
    return {
      role,
      projected,
      majorValue,
      minorValue,
      strainValue,
      keyValues,
    };
  });

  insights.sort((left, right) => {
    const leftScore = (left.projected?.roleModifier ?? 0) - (left.projected?.fatigueModifier ?? 0);
    const rightScore = (right.projected?.roleModifier ?? 0) - (right.projected?.fatigueModifier ?? 0);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    if ((left.projected?.additionalFatigue ?? 0) !== (right.projected?.additionalFatigue ?? 0)) {
      return (left.projected?.additionalFatigue ?? 0) - (right.projected?.additionalFatigue ?? 0);
    }
    return (right.majorValue ?? 0) - (left.majorValue ?? 0);
  });

  return insights[0] ?? null;
}

function normalizeClassHintToken(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function formatIntensityStageLabel(value: MatchdayIntensityStage) {
  if (value === "conserve") return "Schonen";
  if (value === "push") return "Push";
  return "Normal";
}

function buildSlotFitExplanation(
  role: MatchdaySlotRoleDefinition | null,
  rosterCard: Pick<LineupPlayerTableRow, "className" | "attributeStats" | "attributeRatings"> | null,
  projected: ReturnType<typeof calculateMatchdayProjectedPreview> | null,
  scoreDelta?: number | null,
) {
  const keyAttributes = (role?.keyAttributes ?? [])
    .slice(0, 3)
    .map((attribute) => {
      const value = rosterCard?.attributeStats?.[attribute.attribute] ?? null;
      const rating = rosterCard?.attributeRatings?.[attribute.attribute] ?? null;
      return {
        shortLabel: attributeShortLabels[attribute.attribute],
        value,
        rating,
        weightPct: attribute.weightPct,
        emphasis: attribute.emphasis,
      };
    });
  const positiveAttributes = keyAttributes.filter((attribute) => attribute.emphasis !== "support");
  const strainAttribute = keyAttributes.find((attribute) => attribute.emphasis === "support") ?? null;
  const normalizedClass = normalizeClassHintToken(rosterCard?.className ?? null);
  const roleClassFit =
    role?.classHints?.length && normalizedClass
      ? role.classHints.some((hint) => normalizeClassHintToken(hint) === normalizedClass)
      : false;
  const attributeLine = positiveAttributes.length
    ? positiveAttributes
        .map((attribute) => `${attribute.shortLabel} ${attribute.rating ?? (attribute.value != null ? Math.round(attribute.value) : "—")}`)
        .join(" · ")
    : "Basiswert entscheidet";
  const roleDelta = projected?.roleModifier ?? 0;
  const roleDeltaText = roleDelta
    ? `Rolle ${roleDelta > 0 ? "+" : ""}${formatDecimalScore(roleDelta, 1)}`
    : "Rolle neutral";
  const deltaText =
    scoreDelta != null
      ? `Δ ${scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(scoreDelta, 1)}`
      : projected?.totalProjected != null
        ? `Slot ${formatDecimalScore(projected.totalProjected, 1)}`
        : "Slot offen";
  const summary = role
    ? `${role.label}: ${attributeLine} · ${roleDeltaText}`
    : `${attributeLine} · ${roleDeltaText}`;
  const detailParts = [
    roleClassFit ? "Klassenfit" : role?.classHints?.length ? `Off-Role gegen ${role.classHints.join(" / ")}` : null,
    strainAttribute ? `Belastung ${strainAttribute.shortLabel} ${strainAttribute.rating ?? (strainAttribute.value != null ? Math.round(strainAttribute.value) : "—")}` : null,
    projected?.fatigueModifier ? `Fatigue -${formatDecimalScore(projected.fatigueModifier, 1)}` : null,
    deltaText,
  ].filter(Boolean);

  return {
    summary,
    detail: detailParts.join(" · ") || "Keine besonderen Slot-Abweichungen.",
    roleClassFit,
  };
}

type CandidateAxisKey = "pow" | "spe" | "men" | "soc";

type CandidateAxisReasonChip = {
  axis: CandidateAxisKey;
  label: string;
  rating: string | null;
  tone: string;
  weightPct: number;
  detail: string;
};

type SlotMicroStepState = "done" | "current" | "open";

const attributeAxisKeys: Partial<Record<keyof PlayerAttributeSheetStats, CandidateAxisKey>> = {
  power: "pow",
  health: "pow",
  stamina: "pow",
  determination: "pow",
  speed: "spe",
  dexterity: "spe",
  awareness: "spe",
  intelligence: "men",
  will: "men",
  spirit: "men",
  charisma: "soc",
  torment: "soc",
};

const axisReasonLabels: Record<CandidateAxisKey, string> = {
  pow: "POW",
  spe: "SPE",
  men: "MEN",
  soc: "SOC",
};

const axisReasonToneClasses: Record<CandidateAxisKey, string> = {
  pow: "is-pow",
  spe: "is-spe",
  men: "is-men",
  soc: "is-soc",
};

function buildCandidateAxisReasonChips(
  role: MatchdaySlotRoleDefinition | null,
  rosterCard: Pick<LineupPlayerTableRow, "attributeStats" | "attributeRatings"> | null,
): CandidateAxisReasonChip[] {
  if (!role || !rosterCard) {
    return [];
  }

  const roleAttributes = role.keyAttributes?.length
    ? role.keyAttributes.slice(0, 4)
    : [
        { attribute: role.majorPositiveAttribute, weightPct: 100, deltaPct: 0, emphasis: "primary" as const },
        { attribute: role.minorPositiveAttribute, weightPct: 70, deltaPct: 0, emphasis: "secondary" as const },
        { attribute: role.strainAttribute, weightPct: 40, deltaPct: 0, emphasis: "support" as const },
      ];
  const axisMap = new Map<CandidateAxisKey, CandidateAxisReasonChip>();

  for (const attribute of roleAttributes) {
    if (attribute.emphasis === "support") {
      continue;
    }
    const axis = attributeAxisKeys[attribute.attribute];
    if (!axis) {
      continue;
    }
    const rating = rosterCard.attributeRatings?.[attribute.attribute] ?? null;
    const value = rosterCard.attributeStats?.[attribute.attribute] ?? null;
    const detail = `${axisReasonLabels[axis]} ${rating ?? (value != null ? Math.round(value) : "—")} · Slot ${formatDecimalScore(attribute.weightPct, 0)}%`;
    const existing = axisMap.get(axis);
    if (!existing || attribute.weightPct > existing.weightPct) {
      axisMap.set(axis, {
        axis,
        label: axisReasonLabels[axis],
        rating,
        tone: axisReasonToneClasses[axis],
        weightPct: attribute.weightPct,
        detail,
      });
    }
  }

  return (["pow", "spe", "men", "soc"] as const)
    .map((axis) => axisMap.get(axis))
    .filter((chip): chip is CandidateAxisReasonChip => chip != null)
    .slice(0, 3);
}

function resolveSlotMicroStepStates(input: {
  hasSelection: boolean;
  isActiveSlot: boolean;
  isHoveredAssign: boolean;
  isRecentlyAssigned: boolean;
}): Record<"choose" | "assign" | "next", SlotMicroStepState> {
  if (input.hasSelection) {
    return {
      choose: "done",
      assign: "done",
      next: input.isRecentlyAssigned ? "current" : "done",
    };
  }
  if (!input.isActiveSlot) {
    return { choose: "open", assign: "open", next: "open" };
  }
  if (input.isHoveredAssign) {
    return { choose: "done", assign: "current", next: "open" };
  }
  return { choose: "current", assign: "open", next: "open" };
}

function LegacyLineupCandidateReasonChips({ chips }: { chips: CandidateAxisReasonChip[] }) {
  if (!chips.length) {
    return null;
  }

  return (
    <div className="legacy-lineup-candidate-reason-chips" aria-label="Achsen-Begruendung">
      {chips.map((chip) => (
        <span key={`${chip.axis}-${chip.label}`} className={`legacy-lineup-candidate-reason-chip ${chip.tone}`} title={chip.detail}>
          {chip.label} {chip.rating ?? "—"}
        </span>
      ))}
    </div>
  );
}

function LegacyLineupSlotMicroSteps({
  stepStates,
}: {
  stepStates: Record<"choose" | "assign" | "next", SlotMicroStepState>;
}) {
  const steps = [
    { key: "choose" as const, label: "Waehlen" },
    { key: "assign" as const, label: "Einsetzen" },
    { key: "next" as const, label: "Naechster Slot" },
  ];

  return (
    <div className="legacy-lineup-slot-micro-steps" aria-label="Slot Mikro-Schritte">
      {steps.map((step, index) => (
        <span
          key={step.key}
          className={`legacy-lineup-slot-micro-step is-${stepStates[step.key]}${index < steps.length - 1 ? " has-arrow" : ""}`}
        >
          <strong>{step.label}</strong>
        </span>
      ))}
    </div>
  );
}

function getDragFitTierClass(fitTier: LegacyLineupDragFitTier | null) {
  switch (fitTier) {
    case "best":
      return "is-fit-best";
    case "great":
      return "is-fit-great";
    case "okay":
      return "is-fit-okay";
    case "poor":
      return "is-fit-poor";
    case "blocked":
      return "is-fit-blocked";
    default:
      return "";
  }
}

function LegacyLineupTableCustomization({
  columns,
  activePreset,
  isVisible,
  getWidth,
  onToggle,
  onMove,
  onWidthStep,
  onWidthReset,
  onPresetChange,
  onReset,
}: {
  columns: LegacyLineupTableColumn[];
  activePreset: LegacyLineupTablePresetId | null;
  isVisible: (columnId: string, visibleByDefault?: boolean) => boolean;
  getWidth: (column: LegacyLineupTableColumn) => number;
  onToggle: (columnId: string, nextVisible: boolean) => void;
  onMove: (columnId: string, direction: "left" | "right") => void;
  onWidthStep: (column: LegacyLineupTableColumn, delta: number) => void;
  onWidthReset: (column: LegacyLineupTableColumn) => void;
  onPresetChange: (presetId: Exclude<LegacyLineupTablePresetId, "custom">) => void;
  onReset: () => void;
}) {
  return (
    <details className="column-visibility-manager">
      <summary>Tabelle anpassen</summary>
      <div className="table-customization-presets">
        <label className="filter-field table-customization-preset-field">
          <span>Preset</span>
          <select
            className="input"
            value={activePreset && activePreset !== "custom" ? activePreset : "custom"}
            onChange={(event) => {
              if (event.target.value === "custom") {
                return;
              }
              onPresetChange(event.target.value as Exclude<LegacyLineupTablePresetId, "custom">);
            }}
          >
            <option value="retool_default">Retool Default</option>
            <option value="compact">Compact</option>
            <option value="finance">Finance</option>
            <option value="performance">Performance</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <button className="secondary-button inline-button" type="button" onClick={onReset}>
          Retool Default
        </button>
      </div>
      <div className="column-visibility-grid">
        {columns.map((column) => (
          <div key={column.id} className="column-visibility-option">
            <div className="table-customization-option-main">
              <label className="table-customization-checkbox">
                <input
                  type="checkbox"
                  checked={isVisible(column.id, column.visibleByDefault)}
                  onChange={(event) => onToggle(column.id, event.target.checked)}
                />
                <span>{column.label}</span>
              </label>
            </div>
            <div className="table-customization-option-actions">
              <span className="table-customization-width">{getWidth(column)} px</span>
              <button className="ghost-button" type="button" onClick={() => onMove(column.id, "left")} aria-label={`${column.label} nach links`}>
                ←
              </button>
              <button className="ghost-button" type="button" onClick={() => onMove(column.id, "right")} aria-label={`${column.label} nach rechts`}>
                →
              </button>
              <button className="ghost-button" type="button" onClick={() => onWidthStep(column, -16)} aria-label={`${column.label} schmaler`}>
                −
              </button>
              <button className="ghost-button" type="button" onClick={() => onWidthStep(column, 16)} aria-label={`${column.label} breiter`}>
                +
              </button>
              <button className="ghost-button" type="button" onClick={() => onWidthReset(column)} aria-label={`${column.label} Breite zurücksetzen`}>
                Reset
              </button>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function compareLegacyLineupSortValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "de", { numeric: true, sensitivity: "base" });
}

function LegacyLineupSortableHeader({
  label,
  columnKey,
  sortState,
  onToggle,
}: {
  label: string;
  columnKey: string;
  sortState?: LegacyLineupSortState | null;
  onToggle: (columnKey: string) => void;
}) {
  const isActive = sortState?.key === columnKey;
  const arrow = !isActive ? "↕" : sortState?.direction === "asc" ? "↑" : "↓";

  return (
    <button
      className={`sortable-header${isActive ? " is-active" : ""}`}
      type="button"
      onClick={() => onToggle(columnKey)}
    >
      <span>{label}</span>
      <span className="sortable-arrow">{arrow}</span>
    </button>
  );
}

function formatScore(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPpsScore(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDecimalScore(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatSignedDelta(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value === 0) {
    return "0";
  }
  return `${value > 0 ? "+" : ""}${value}`;
}

function formatSignedCompactInteger(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value);
  if (rounded === 0) {
    return "0";
  }
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function formatNegativeCompactInteger(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value);
  if (rounded === 0) {
    return "0";
  }
  return `-${Math.abs(rounded)}`;
}

function formatNullableScore(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }
  return formatScore(value);
}

function formatWeightInfo(attributes: MatchdayWeightInfo[]) {
  if (attributes.length === 0) {
    return "Gewichtung fehlt";
  }

  return attributes
    .map((attribute) => `${attribute.shortLabel} ${attribute.weightPct}%`)
    .join(" · ");
}

function formatWholeNumber(value: number | null | undefined) {
  return formatNullableScore(value);
}

function getTierStyleClass(value: string | null | undefined) {
  switch (value) {
    case "S+":
      return "is-tier-splus";
    case "S":
      return "is-tier-s";
    case "A":
      return "is-tier-a";
    case "B":
      return "is-tier-b";
    case "C":
      return "is-tier-c";
    case "D":
      return "is-tier-d";
    case "E":
      return "is-tier-e";
    case "F":
      return "is-tier-f";
    default:
      return "";
  }
}

function formatCompactMoney(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTraitList(values: string[] | null | undefined) {
  if (!values || values.length === 0) {
    return "—";
  }
  return values.join(", ");
}

function getExhaustionMultiplier(count: number | null | undefined) {
  if (count == null || count <= 0) {
    return 1;
  }
  if (count >= 4) return 0.8;
  if (count >= 3) return 0.85;
  if (count >= 2) return 0.9;
  return 0.95;
}

function formatExhaustionPoints(score: number | null | undefined, count: number | null | undefined) {
  if (count == null) {
    return "Erschöpfung —";
  }
  if (count <= 0) {
    return "Erschöpfung 0";
  }
  if (score == null || !Number.isFinite(score)) {
    return "Erschöpfung —";
  }
  const penalty = Number((score - score * getExhaustionMultiplier(count)).toFixed(2));
  return `Erschöpfung -${formatScore(penalty)}`;
}

function formatFatigueHint(score: number | null | undefined, count: number | null | undefined) {
  return formatExhaustionPoints(score, count);
}

function formatProjectedRange(base: number | null | undefined, projected: number | null | undefined) {
  if (base == null && projected == null) {
    return "Projected —";
  }
  if (base == null) {
    return `Projected ${formatDecimalScore(projected, 1)}`;
  }
  if (projected == null) {
    return `Projected ${formatDecimalScore(base, 1)}`;
  }

  const low = Math.min(base, projected);
  const high = Math.max(base, projected);
  if (Math.abs(low - high) < 0.05) {
    return `Projected ${formatDecimalScore(projected, 1)}`;
  }
  return `Projected ${formatDecimalScore(low, 1)}–${formatDecimalScore(high, 1)}`;
}

function formatProjectedWindow(low: number | null | undefined, high: number | null | undefined) {
  if (low == null && high == null) {
    return "Projected —";
  }
  if (low == null || high == null) {
    return `Projected ${formatDecimalScore(low ?? high, 1)}`;
  }
  const rangeLow = Math.min(low, high);
  const rangeHigh = Math.max(low, high);
  if (Math.abs(rangeLow - rangeHigh) < 0.05) {
    return `Projected ${formatDecimalScore(rangeHigh, 1)}`;
  }
  return `Projected ${formatDecimalScore(rangeLow, 1)}–${formatDecimalScore(rangeHigh, 1)}`;
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

function resolveAttributeGrade(
  ratings: Partial<Record<keyof PlayerAttributeSheetStats, string | null>> | null | undefined,
  key: keyof PlayerAttributeSheetStats,
  value: number | null | undefined,
) {
  const explicit = ratings?.[key];
  if (explicit) {
    return explicit;
  }
  return getTransfermarktTierFromPoints(value ?? null);
}

function getDisciplineHeatClass(score: number | null | undefined) {
  if (score == null) {
    return "";
  }
  if (score >= 80) {
    return "is-heat-strong";
  }
  if (score >= 60) {
    return "is-heat-good";
  }
  if (score >= 40) {
    return "is-heat-mid";
  }
  return "is-heat-low";
}

function getTopRankClass(rank: number) {
  if (rank <= 3) {
    return "is-rank-top";
  }
  if (rank <= 6) {
    return "is-rank-mid";
  }
  if (rank <= 10) {
    return "is-rank-alert";
  }
  return "";
}

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

function getFatigueHeatClass(value: number | null | undefined) {
  if (value == null) {
    return "";
  }
  if (value >= 3) {
    return "is-fatigue-high";
  }
  if (value >= 1) {
    return "is-fatigue-mid";
  }
  return "is-fatigue-low";
}

function getSlotReadiness(
  slotPreview: MatchdaySlotPreviewCard | null | undefined,
  selectedScore: number | null | undefined,
): { key: MatchdaySlotReadiness; label: string; detail: string } {
  if (!slotPreview || selectedScore == null) {
    return { key: "empty", label: "Leer", detail: "Slot offen" };
  }

  const projected = slotPreview.projected.totalProjected ?? selectedScore;
  if (slotPreview.projected.warnings.length > 0 || projected < 45) {
    return { key: "risky", label: "Riskant", detail: `S ${formatDecimalScore(projected, 1)}` };
  }
  if (projected >= 70) {
    return { key: "optimal", label: "Optimal", detail: `S ${formatDecimalScore(projected, 1)}` };
  }
  return { key: "solid", label: "Solide", detail: `S ${formatDecimalScore(projected, 1)}` };
}

function getTeamdeckCandidateGroupMeta(groupKey: TeamdeckCandidateQualityKey) {
  switch (groupKey) {
    case "instant":
      return {
        label: "Passt sofort",
        description: "Saubere Sofort-Picks fuer den aktiven Slot.",
        tone: "ready" as const,
        order: 0,
      };
    case "alternative":
      return {
        label: "Gute Alternative",
        description: "Spielbar, aber nicht ganz der klarste Direktzug.",
        tone: "info" as const,
        order: 1,
      };
    case "fatigue":
      return {
        label: "Riskant wegen Fatigue",
        description: "Nur mit Bedacht einsetzen oder ueber Team-Einsatz abfedern.",
        tone: "warning" as const,
        order: 2,
      };
    case "blocked":
      return {
        label: "Blockiert / schon eingesetzt",
        description: "Sichtbar zum Verstehen, aber nicht fuer den direkten Flow.",
        tone: "blocked" as const,
        order: 3,
      };
    case "emergency":
    default:
      return {
        label: "Nur Notfall",
        description: "Geht im Zweifel, fuehlt sich aber klar nach Fallback an.",
        tone: "muted" as const,
        order: 4,
      };
  }
}

function getDemandPriorityMultiplier(priority: "low" | "medium" | "high") {
  if (priority === "high") return 1.15;
  if (priority === "low") return 0.7;
  return 1;
}

function getDemandMoraleValue(value: number, priority: "low" | "medium" | "high") {
  return Number((value * getDemandPriorityMultiplier(priority)).toFixed(1));
}

function formatMoraleDelta(value: number) {
  if (value > 0) return `+${formatDecimalScore(value, 1)}`;
  if (value < 0) return formatDecimalScore(value, 1);
  return "0";
}

function formatMoraleScoreEffect(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) < 0.05) return "±0";
  return `${value > 0 ? "+" : ""}${formatDecimalScore(value, 1)}`;
}

function formatMoralePercentEffect(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) < 0.05) return "±0%";
  return `${value > 0 ? "+" : ""}${formatDecimalScore(value, 1)}%`;
}

function formatLineupHintLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "Hinweis";
  }
  if (normalized.includes("captain")) {
    return "Captain prüfen";
  }
  if (normalized.includes("fatigue") || normalized.includes("ersch")) {
    return "Fatigue-Risiko";
  }
  if (normalized.includes("form")) {
    return "Formkarten prüfen";
  }
  if (normalized.includes("slot")) {
    return "Slot-Regel prüfen";
  }
  if (normalized.includes("lineup") || normalized.includes("vollst")) {
    return "Lineup prüfen";
  }
  return "Hinweis";
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

function getFormCardOptionStyle(color: LegacyFormCardOption["color"]) {
  if (color === "red") {
    return { color: "#ff8b86", backgroundColor: "#2b1719" };
  }
  if (color === "green") {
    return { color: "#a8e7aa", backgroundColor: "#172719" };
  }
  if (color === "blue") {
    return { color: "#a9ccff", backgroundColor: "#162033" };
  }
  return { color: "#ffd987", backgroundColor: "#2b2314" };
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
    return power.targetMode === "single_rival" ? "Snipe Rival" : "Snipe Top";
  }
  if (power.effectType === "field_debuff") {
    return `Field x${Math.max(power.targetLimit, 1)}`;
  }
  if (power.effectType === "rivalry_debuff") {
    return "Rivalry";
  }
  if (power.effectType === "support_boost") {
    return "Support";
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
  const sign = power.effectType === "self_boost" || power.effectType === "support_boost" ? "+" : "-";
  return `${power.label} · ${getTeamPowerEffectLabel(power)} · ${getTeamPowerCategoryLabel(power.category)} · ${sign}${formatDecimalScore(effectiveModifier, 1)}%${effectiveExtra ? ` +${formatDecimalScore(effectiveExtra, 1)}% Extra` : ""}${attributeFit ? ` · Fit ${attributeFit > 0 ? "+" : ""}${formatDecimalScore(attributeFit, 1)}% (${formatTeamPowerAttributeTags(power)})` : ` · Tags ${formatTeamPowerAttributeTags(power)}`} · ${power.chargesRemaining}/${power.chargesTotal} · ${source}${isFit ? "" : " · Off-Fit"}`;
}

function getDisciplineToneClass(category: string | null | undefined) {
  if (category === "power") return "is-power";
  if (category === "speed") return "is-speed";
  if (category === "mental") return "is-mental";
  if (category === "social") return "is-social";
  return "is-neutral";
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

function formatLegacyTeamControlModeLabel(mode: "manual" | "ai" | "passive" | null | undefined) {
  if (mode === "manual") return "gefuehrt";
  if (mode === "ai") return "automatisch";
  if (mode === "passive") return "beobachtet";
  return "offen";
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
const SHOW_CLASSIC_LINEUP_WORKSPACE = false;
const SHOW_DRAFT_LINEUP_WORKSPACE = true;

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
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("");
  const [sourceReadOnly, setSourceReadOnly] = useState<boolean>(source === "prisma");
  const [roomContext, setRoomContext] = useState<FoundationRoomContext | null>(null);
  const [playerFilter, setPlayerFilter] = useState("");
  const [teamdeckFilterMode, setTeamdeckFilterMode] = useState<TeamdeckFilterMode>("all");
  const [teamdeckSortMode, setTeamdeckSortMode] = useState<TeamdeckSortMode>("top");
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null);
  const [showOnlyTopSlotCandidates, setShowOnlyTopSlotCandidates] = useState(true);
  const [recentlyAssignedSlotKey, setRecentlyAssignedSlotKey] = useState<string | null>(null);
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
  const [draftBoardView, setDraftBoardView] = useState<"lineup" | "formBoard">(props.initialDraftBoardView ?? "lineup");

  useEffect(() => {
    if (props.initialDraftBoardView) {
      setDraftBoardView(props.initialDraftBoardView);
    }
  }, [props.initialDraftBoardView]);

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
  const [expertPlayerTableScrollTop, setExpertPlayerTableScrollTop] = useState(0);
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
    setRoomContext(readFoundationRoomContextFromLocation());
  }, []);

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
    const scheduleEntries = [...(context.gameState?.seasonState.disciplineSchedule ?? [])]
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
    const captainKeys = new Set(Object.entries(captains).filter(([, value]) => value).map((entry) => entry[1]));
    return baseEntries.map((entry) => ({
      ...entry,
      isCaptain: captainKeys.has(entry.activePlayerId ?? ""),
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
  const isTeamManagementLocked = Boolean(
    params.teamId &&
      props.manageableTeamIds &&
      props.manageableTeamIds.length > 0 &&
      !props.manageableTeamIds.includes(params.teamId),
  );
  const isReadOnly = sourceReadOnly || isTeamManagementLocked;
  const selectedMatchdayOption = useMemo(
    () => options.matchdays.find((matchday) => matchday.id === params.matchdayId) ?? null,
    [options.matchdays, params.matchdayId],
  );
  const selectedTeamIsReady = Boolean(selectedTeamOption?.currentMatchdayReady);
  const selectedMatchdayIsReady = Boolean(selectedMatchdayOption?.isReady);
  const missingSeasonFormCards = Boolean(context && (context.formCards?.length ?? 0) === 0);
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
  const teamLogoUrl = useMemo(
    () => (context?.team ? getTeamLogoBrowserUrl(context.team.id, context.team.logoPath ?? null) : null),
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
  const matchdayRosterCards = useMemo<MatchdayRosterCard[]>(() => {
    const d1DisciplineId = context?.matchdayContract?.discipline1?.disciplineId ?? null;
    const d2DisciplineId = context?.matchdayContract?.discipline2?.disciplineId ?? null;
    const discipline1Label = context?.matchdayContract?.discipline1?.displayName ?? "D1";
    const discipline2Label = context?.matchdayContract?.discipline2?.displayName ?? "D2";
    const d1Focus = disciplineWeightInfo.d1;
    const d2Focus = disciplineWeightInfo.d2;

    return playerRows
      .map((row) => {
        const selectedSides: Array<"d1" | "d2"> = [];
        if (Object.values(selections).includes(row.activePlayerId ?? "")) {
          if (
            row.activePlayerId &&
            slots.some((slot) => slot.disciplineSide === "d1" && selections[slot.key] === row.activePlayerId)
          ) {
            selectedSides.push("d1");
          }
          if (
            row.activePlayerId &&
            slots.some((slot) => slot.disciplineSide === "d2" && selections[slot.key] === row.activePlayerId)
          ) {
            selectedSides.push("d2");
          }
        }

        const fitLane: MatchdayRosterCard["fitLane"] =
          (row.discipline1Score ?? Number.NEGATIVE_INFINITY) - (row.discipline2Score ?? Number.NEGATIVE_INFINITY) >= 8
            ? "d1"
            : (row.discipline2Score ?? Number.NEGATIVE_INFINITY) - (row.discipline1Score ?? Number.NEGATIVE_INFINITY) >= 8
              ? "d2"
              : "flex";

        return {
          ...row,
          discipline1Label,
          discipline2Label,
          selectedSides,
          topAttributesD1: d1Focus.map((attribute) => ({
            ...attribute,
            value: row.attributeStats?.[attribute.key] ?? null,
            ratingLabel: resolveAttributeGrade(row.attributeRatings, attribute.key, row.attributeStats?.[attribute.key] ?? null),
          })),
          topAttributesD2: d2Focus.map((attribute) => ({
            ...attribute,
            value: row.attributeStats?.[attribute.key] ?? null,
            ratingLabel: resolveAttributeGrade(row.attributeRatings, attribute.key, row.attributeStats?.[attribute.key] ?? null),
          })),
          fitLane,
          fitDelta: (row.discipline1Score ?? 0) - (row.discipline2Score ?? 0),
          fatigueCount: row.appearances ?? null,
          captainEligible: Boolean(row.activePlayerId),
        };
      })
      .sort((left, right) => {
        if (left.selectedSides.length !== right.selectedSides.length) {
          return right.selectedSides.length - left.selectedSides.length;
        }

        const leftD1 = left.discipline1Score ?? Number.NEGATIVE_INFINITY;
        const rightD1 = right.discipline1Score ?? Number.NEGATIVE_INFINITY;
        const leftD2 = left.discipline2Score ?? Number.NEGATIVE_INFINITY;
        const rightD2 = right.discipline2Score ?? Number.NEGATIVE_INFINITY;
        const leftBias = leftD1 - leftD2;
        const rightBias = rightD1 - rightD2;

        const getBiasBucket = (bias: number) => {
          if (bias >= 8) {
            return 0;
          }
          if (bias <= -8) {
            return 2;
          }
          return 1;
        };

        const leftBucket = getBiasBucket(leftBias);
        const rightBucket = getBiasBucket(rightBias);
        if (leftBucket !== rightBucket) {
          return leftBucket - rightBucket;
        }

        const leftTopScore = Math.max(leftD1, leftD2);
        const rightTopScore = Math.max(rightD1, rightD2);
        if (leftTopScore !== rightTopScore) {
          return rightTopScore - leftTopScore;
        }

        if (Math.abs(leftBias) !== Math.abs(rightBias)) {
          return Math.abs(rightBias) - Math.abs(leftBias);
        }

        return left.name.localeCompare(right.name, "de");
      });
  }, [context?.matchdayContract?.discipline1?.disciplineId, context?.matchdayContract?.discipline1?.displayName, context?.matchdayContract?.discipline2?.disciplineId, context?.matchdayContract?.discipline2?.displayName, disciplineWeightInfo.d1, disciplineWeightInfo.d2, playerRows, selections, slots]);
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
  const activeSlotRole = activeSlot ? slotRoleByKey.get(activeSlot.key) ?? null : null;

  useEffect(() => {
    if (!activeSlot) {
      return;
    }
    setFocusedDisciplineSide(activeSlot.disciplineSide);
    setTeamdeckSortMode("top");
  }, [activeSlot?.disciplineSide, activeSlot?.key]);

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

  const rivalryPressureByDiscipline = useMemo(() => {
    return Object.fromEntries(
      Object.entries(context?.teamPowerWindows ?? {}).map(([disciplineId, window]) => {
        const topRank = Math.min(...(window?.top8Rivals ?? []).map((rival) => rival.rank));
        const pressure = Number.isFinite(topRank) ? (topRank <= 3 ? 1.5 : 1) : 0;
        return [disciplineId, pressure] as const;
      }),
    );
  }, [context?.teamPowerWindows]);
  const getRivalryPressureForDiscipline = (disciplineId: string | null | undefined) =>
    disciplineId ? rivalryPressureByDiscipline[disciplineId] ?? 0 : 0;

  const slotPreviewByKey = useMemo(() => {
    const previews = slots.map<MatchdaySlotPreviewCard>((slot) => {
      const selectedOption = getSelectedOptionMeta(selections[slot.key]);
      const selectedScore = getSelectedOptionScore(selectedOption, slot.disciplineId);
      const selectedRosterCard = rosterCardByActivePlayerId.get(selections[slot.key] ?? "");
      const sidePreview = resolvedPreview?.disciplineSideScores.find((entry) => entry.disciplineSide === slot.disciplineSide) ?? null;
      const role: MatchdaySlotRoleDefinition | null = slotRoleByKey.get(slot.key) ?? null;
      const intensity = getDisciplineIntensity(slot.disciplineSide);
      const knownModifierBonus =
        calculatePerPlayerFormModifier({
          formModifier: sidePreview?.formModifier,
          selectedPlayers: sidePreview?.selectedPlayers,
          requiredPlayers: sidePreview?.requiredPlayers,
        }) +
        (sidePreview?.mutatorModifier ?? 0) +
        (sidePreview?.teamPowerModifier ?? 0) +
        (captains[slot.disciplineSide] === selections[slot.key] ? sidePreview?.captainBonusTotal ?? 0 : 0);
      const revealVariance =
        (context?.formCardSource?.effectStatus === "ready" ? 0 : 2) +
        (context?.mutatorSource?.effectStatus === "ready" ? 0 : 2) +
        (context?.teamPowerSource?.effectStatus === "ready" ? 0 : 2);

      return {
        slotKey: slot.key,
        disciplineSide: slot.disciplineSide,
        role,
        intensity,
        selectedScore,
        selectedPlayerName: selectedRosterCard?.name ?? null,
        projected: calculateMatchdayProjectedPreview({
          baseScore: selectedScore,
          role,
          attributeStats: selectedRosterCard?.attributeStats ?? null,
          currentFatigueCount: selectedOption?.fatigueCount ?? null,
          requiredPlayers: context?.disciplinePlayerCounts[slot.disciplineId] ?? null,
          intensity,
          knownModifierBonus,
          revealVariance,
          rivalryPressure: getRivalryPressureForDiscipline(slot.disciplineId),
        }),
      };
    });

    return new Map(previews.map((entry) => [entry.slotKey, entry]));
  }, [
    captains,
    context?.disciplinePlayerCounts,
    context?.formCardSource?.effectStatus,
    context?.mutatorSource?.effectStatus,
    context?.teamPowerSource?.effectStatus,
    resolvedPreview,
    rosterCardByActivePlayerId,
    selections,
    getDisciplineIntensity,
    rivalryPressureByDiscipline,
    slotRoleByKey,
    slots,
  ]);
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
  const slotCandidateSummaryByKey = useMemo(() => {
    return new Map(
      slots.map((slot) => {
        const currentProjected = slotPreviewByKey.get(slot.key)?.projected.totalProjected ?? null;
        const role = slotRoleByKey.get(slot.key) ?? null;
        const topCandidates = sortOptionsByDisciplineSkill(getAvailableOptionsForSlot(slot.key), slot.disciplineId)
          .slice(0, 3)
          .map((option) => {
            const rosterCard = rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
            const projected = calculateMatchdayProjectedPreview({
              baseScore: option.disciplineScores[slot.disciplineId] ?? null,
              role,
              attributeStats: rosterCard?.attributeStats ?? null,
              currentFatigueCount: option.fatigueCount ?? null,
              requiredPlayers: context?.disciplinePlayerCounts[slot.disciplineId] ?? null,
              intensity: getDisciplineIntensity(slot.disciplineSide),
              knownModifierBonus: 0,
              revealVariance: 0,
              rivalryPressure: getRivalryPressureForDiscipline(slot.disciplineId),
            });
            const scoreDelta =
              projected.totalProjected != null && currentProjected != null
                ? Number((projected.totalProjected - currentProjected).toFixed(1))
                : null;
            const fitExplanation = buildSlotFitExplanation(role, rosterCard, projected, scoreDelta);
            return {
              activePlayerId: option.activePlayerId,
              name: option.name,
              projectedScore: projected.totalProjected ?? null,
              scoreDelta,
              fitSummary: fitExplanation.summary,
              fitDetail: fitExplanation.detail,
              reasonChips: buildCandidateAxisReasonChips(role, rosterCard),
            };
          });

        return [slot.key, { topCandidates, currentProjected }] as const;
      }),
    );
  }, [context?.disciplinePlayerCounts, getDisciplineIntensity, rivalryPressureByDiscipline, rosterCardByActivePlayerId, slotPreviewByKey, slotRoleByKey, slots]);
  const playerBestSlotSummaryByActivePlayerId = useMemo(() => {
    return new Map(
      playerOptions.map((option) => {
        const candidateSlots = slots
          .map((slot) => {
            const rosterCard = rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
            const role = slotRoleByKey.get(slot.key) ?? null;
            const projected = calculateMatchdayProjectedPreview({
              baseScore: option.disciplineScores[slot.disciplineId] ?? null,
              role,
              attributeStats: rosterCard?.attributeStats ?? null,
              currentFatigueCount: option.fatigueCount ?? null,
              requiredPlayers: context?.disciplinePlayerCounts[slot.disciplineId] ?? null,
              intensity: getDisciplineIntensity(slot.disciplineSide),
              knownModifierBonus: 0,
              revealVariance: 0,
              rivalryPressure: getRivalryPressureForDiscipline(slot.disciplineId),
            });
            const currentProjected = slotPreviewByKey.get(slot.key)?.projected.totalProjected ?? null;
            const projectedDelta =
              projected.totalProjected != null && currentProjected != null
                ? Number((projected.totalProjected - currentProjected).toFixed(1))
                : null;
            return {
              slotKey: slot.key,
              disciplineSide: slot.disciplineSide,
              slotIndex: slot.slotIndex,
              projectedScore: projected.totalProjected ?? null,
              projectedDelta,
              fitSummary: buildSlotFitExplanation(role, rosterCard, projected, projectedDelta).summary,
            };
          })
          .filter((entry) => entry.projectedScore != null)
          .sort((left, right) => {
            if ((right.projectedScore ?? Number.NEGATIVE_INFINITY) !== (left.projectedScore ?? Number.NEGATIVE_INFINITY)) {
              return (right.projectedScore ?? Number.NEGATIVE_INFINITY) - (left.projectedScore ?? Number.NEGATIVE_INFINITY);
            }
            return left.slotKey.localeCompare(right.slotKey, "de");
          })
          .slice(0, 2);

        return [option.activePlayerId, candidateSlots] as const;
      }),
    );
  }, [context?.disciplinePlayerCounts, getDisciplineIntensity, playerOptions, rivalryPressureByDiscipline, rosterCardByActivePlayerId, slotPreviewByKey, slotRoleByKey, slots]);

  const activeSlotCandidateByActivePlayerId = useMemo(() => {
    if (!activeSlot) {
      return new Map<
        string,
        {
          baseScore: number | null;
          projectedScore: number | null;
          scoreDelta: number | null;
          blockReason: ReturnType<typeof resolveLegacyLineupDragBlockReason>;
          fitSummary: string;
          fitDetail: string;
        }
      >();
    }

    const currentProjectedScore = slotPreviewByKey.get(activeSlot.key)?.projected.totalProjected ?? null;
    return new Map(
      playerOptions.map((option) => {
        const rosterCard = rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
        const role = slotRoleByKey.get(activeSlot.key) ?? null;
        const projected = getProjectedCandidateForSlot(activeSlot, option);
        const blockReason = resolveLegacyLineupDragBlockReason({
          availabilityBlocker: rosterCard?.availabilityBlocker ?? null,
          selectedSides: rosterCard?.selectedSides ?? [],
          targetDisciplineSide: activeSlot.disciplineSide,
          captainSide: captainSideByActivePlayerId.get(option.activePlayerId) ?? null,
          hasBaseScore: option.disciplineScores[activeSlot.disciplineId] != null,
        });

        const scoreDelta =
          projected.totalProjected != null && currentProjectedScore != null
            ? Number((projected.totalProjected - currentProjectedScore).toFixed(1))
            : null;
        const fitExplanation = buildSlotFitExplanation(role, rosterCard, projected, scoreDelta);

        return [
          option.activePlayerId,
          {
            baseScore: option.disciplineScores[activeSlot.disciplineId] ?? null,
            projectedScore: projected.totalProjected,
            scoreDelta,
            blockReason,
            fitSummary: fitExplanation.summary,
            fitDetail: fitExplanation.detail,
          },
        ] as const;
      }),
    );
  }, [activeSlot, captainSideByActivePlayerId, context?.disciplinePlayerCounts, getDisciplineIntensity, playerOptions, rosterCardByActivePlayerId, slotPreviewByKey, slotRoleByKey]);

  const activeSlotCandidateSummary = activeSlot ? slotCandidateSummaryByKey.get(activeSlot.key) ?? null : null;

  const teamdeckCandidateEntries = useMemo(() => {
    const selectedInActiveSlot = activeSlot ? selections[activeSlot.key] ?? "" : "";
    const bestProjectedScore = activeSlotCandidateSummary?.topCandidates[0]?.projectedScore ?? null;
    const currentProjectedScore = activeSlotCandidateSummary?.currentProjected ?? null;
    const activeSlotTag = activeSlot ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}` : null;
    const currentTeamdeckDisciplineId =
      activeSlot?.disciplineId ??
      (focusedDisciplineSide === "d1"
        ? context?.matchdayContract?.discipline1?.disciplineId ?? null
        : context?.matchdayContract?.discipline2?.disciplineId ?? null);

    return matchdayRosterCards
      .map((player) => {
        const activeSlotCandidate = player.activePlayerId
          ? activeSlotCandidateByActivePlayerId.get(player.activePlayerId) ?? null
          : null;
        const selectedElsewhere = Boolean(
          player.activePlayerId &&
            player.activePlayerId !== selectedInActiveSlot &&
            player.selectedSides.length > 0,
        );
        const projectedScore = activeSlotCandidate?.projectedScore ?? null;
        const scoreDelta = activeSlotCandidate?.scoreDelta ?? null;
        const fitTier =
          activeSlot && player.activePlayerId
            ? getLegacyLineupDragFitTier({
                blocked: Boolean(activeSlotCandidate?.blockReason || selectedElsewhere),
                projectedScore,
                bestProjectedScore,
                currentProjectedScore,
              })
            : "blocked";
        const relevantDisciplineDemands = player.demands.filter(
          (demand) => demand.targetDisciplineId && demand.targetDisciplineId === currentTeamdeckDisciplineId,
        );
        const preferredSlotTags = (playerBestSlotSummaryByActivePlayerId.get(player.activePlayerId ?? "") ?? [])
          .slice(0, 2)
          .map((entry) => `${entry.disciplineSide.toUpperCase()}-${entry.slotIndex + 1}`);
        const wantsActiveSlot = Boolean(activeSlotTag && preferredSlotTags.includes(activeSlotTag));
        const captainDemand = relevantDisciplineDemands.find((demand) => demand.label === "Captain-Rolle") ?? null;

        let groupKey: TeamdeckCandidateQualityKey = "alternative";
        let detail = "Spielbar fuer diesen Slot.";
        let shortReason = `${formatNullableScore(projectedScore)} Score`;

        if (selectedElsewhere) {
          groupKey = "blocked";
          detail = `Schon in ${player.selectedSides.join(" + ").toUpperCase()} eingesetzt.`;
          shortReason = player.selectedSides.join(" + ").toUpperCase();
        } else if (activeSlotCandidate?.blockReason) {
          groupKey = "blocked";
          detail = formatLegacyLineupDragBlockReason(activeSlotCandidate.blockReason) ?? "Gerade nicht legal einsetzbar.";
          shortReason = "blockiert";
        } else if ((player.fatigueCount ?? 0) >= 3) {
          groupKey = "fatigue";
          detail = `Fatigue ${Math.round(player.fatigueCount ?? 0)} macht den Pick spuerbar riskanter.`;
          shortReason = `F ${Math.round(player.fatigueCount ?? 0)}`;
        } else if (
          fitTier === "poor" ||
          projectedScore == null ||
          (scoreDelta != null && scoreDelta <= -6) ||
          (projectedScore != null && projectedScore < 45)
        ) {
          groupKey = "emergency";
          detail = "Nur als Notfall-Pick sinnvoll.";
          shortReason = scoreDelta != null ? `${scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(scoreDelta, 1)}` : "Notfall";
        } else if (
          fitTier === "best" ||
          fitTier === "great" ||
          (scoreDelta != null && scoreDelta >= 0)
        ) {
          groupKey = "instant";
          detail = "Passt direkt sauber in den Slot.";
          shortReason = scoreDelta != null ? `${scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(scoreDelta, 1)}` : "direkt";
        } else {
          groupKey = "alternative";
          detail = "Gute Alternative, falls du bewusst variieren willst.";
          shortReason = scoreDelta != null ? `${scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(scoreDelta, 1)}` : "Alternative";
        }

        return {
          player,
          activeSlotCandidate,
          relevantDisciplineDemands,
          preferredSlotTags,
          captainDemand,
          wantsActiveSlot,
          isWishMatch: relevantDisciplineDemands.length > 0,
          fitTier,
          groupKey,
          detail,
          shortReason,
          groupMeta: getTeamdeckCandidateGroupMeta(groupKey),
        };
      })
      .filter((entry) => {
        if (teamdeckFilterMode === "free") {
          return entry.player.selectedSides.length === 0 && !entry.player.availabilityBlocker;
        }
        if (teamdeckFilterMode === "assigned") {
          return entry.player.selectedSides.length > 0;
        }
        if (teamdeckFilterMode === "blocked") {
          return entry.groupKey === "blocked";
        }
        return true;
      })
      .sort((left, right) => {
        const leftBlocked = left.groupKey === "blocked";
        const rightBlocked = right.groupKey === "blocked";
        if (leftBlocked !== rightBlocked) {
          return leftBlocked ? 1 : -1;
        }
        const leftSlotScore = left.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY;
        const rightSlotScore = right.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY;
        if (teamdeckSortMode === "top" && leftSlotScore !== rightSlotScore) {
          return rightSlotScore - leftSlotScore;
        }
        if (teamdeckSortMode === "d1") {
          const leftScore = left.player.discipline1Score ?? Number.NEGATIVE_INFINITY;
          const rightScore = right.player.discipline1Score ?? Number.NEGATIVE_INFINITY;
          if (leftScore !== rightScore) {
            return rightScore - leftScore;
          }
        }
        if (teamdeckSortMode === "d2") {
          const leftScore = left.player.discipline2Score ?? Number.NEGATIVE_INFINITY;
          const rightScore = right.player.discipline2Score ?? Number.NEGATIVE_INFINITY;
          if (leftScore !== rightScore) {
            return rightScore - leftScore;
          }
        }
        if (teamdeckSortMode === "captain") {
          const leftCaptainScore =
            (left.player.captainEligible ? 1000 : 0) +
            (left.captainDemand ? 200 : 0) +
            (left.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY);
          const rightCaptainScore =
            (right.player.captainEligible ? 1000 : 0) +
            (right.captainDemand ? 200 : 0) +
            (right.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY);
          if (leftCaptainScore !== rightCaptainScore) {
            return rightCaptainScore - leftCaptainScore;
          }
        }
        if (teamdeckSortMode === "fatigue") {
          const leftFatigue = left.player.fatigueCount ?? Number.POSITIVE_INFINITY;
          const rightFatigue = right.player.fatigueCount ?? Number.POSITIVE_INFINITY;
          if (leftFatigue !== rightFatigue) {
            return leftFatigue - rightFatigue;
          }
        }
        if (teamdeckSortMode === "wish") {
          const leftWishScore =
            (left.isWishMatch ? 1000 : 0) +
            (left.wantsActiveSlot ? 160 : 0) +
            (left.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY);
          const rightWishScore =
            (right.isWishMatch ? 1000 : 0) +
            (right.wantsActiveSlot ? 160 : 0) +
            (right.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY);
          if (leftWishScore !== rightWishScore) {
            return rightWishScore - leftWishScore;
          }
        }
        if (left.groupMeta.order !== right.groupMeta.order) {
          return left.groupMeta.order - right.groupMeta.order;
        }
        if (leftSlotScore !== rightSlotScore) {
          return rightSlotScore - leftSlotScore;
        }
        const leftFocusedScore =
          teamdeckSortMode === "d1"
            ? left.player.discipline2Score ?? Number.NEGATIVE_INFINITY
            : teamdeckSortMode === "d2"
              ? left.player.discipline1Score ?? Number.NEGATIVE_INFINITY
              : Math.max(left.player.discipline1Score ?? Number.NEGATIVE_INFINITY, left.player.discipline2Score ?? Number.NEGATIVE_INFINITY);
        const rightFocusedScore =
          teamdeckSortMode === "d1"
            ? right.player.discipline2Score ?? Number.NEGATIVE_INFINITY
            : teamdeckSortMode === "d2"
              ? right.player.discipline1Score ?? Number.NEGATIVE_INFINITY
              : Math.max(right.player.discipline1Score ?? Number.NEGATIVE_INFINITY, right.player.discipline2Score ?? Number.NEGATIVE_INFINITY);
        if (leftFocusedScore !== rightFocusedScore) {
          return rightFocusedScore - leftFocusedScore;
        }
        return left.player.name.localeCompare(right.player.name, "de");
      });
  }, [
    activeSlot,
    activeSlotCandidateByActivePlayerId,
    activeSlotCandidateSummary?.currentProjected,
    activeSlotCandidateSummary?.topCandidates,
    context?.matchdayContract?.discipline1?.disciplineId,
    context?.matchdayContract?.discipline2?.disciplineId,
    focusedDisciplineSide,
    matchdayRosterCards,
    playerBestSlotSummaryByActivePlayerId,
    selections,
    teamdeckFilterMode,
    teamdeckSortMode,
  ]);
  const teamdeckCandidateGroups = useMemo(() => {
    const keys: TeamdeckCandidateQualityKey[] = ["instant", "alternative", "fatigue", "blocked", "emergency"];
    return keys
      .map((groupKey) => {
        const meta = getTeamdeckCandidateGroupMeta(groupKey);
        const entries = teamdeckCandidateEntries.filter((entry) => entry.groupKey === groupKey);
        const limitedEntries =
          showOnlyTopSlotCandidates && teamdeckFilterMode !== "blocked"
            ? entries.slice(0, groupKey === "instant" ? 5 : groupKey === "blocked" ? 4 : 3)
            : entries;
        return {
          key: groupKey,
          meta,
          entries: limitedEntries,
          totalCount: entries.length,
        };
      })
      .filter((group) => group.entries.length > 0);
  }, [showOnlyTopSlotCandidates, teamdeckCandidateEntries, teamdeckFilterMode]);
  const activeSlotSpotlightCandidates = useMemo(() => {
    return teamdeckCandidateGroups
      .filter((group) => group.key !== "blocked")
      .flatMap((group) => group.entries.slice(0, group.key === "instant" ? 2 : 1))
      .slice(0, 4);
  }, [teamdeckCandidateGroups]);
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

  const matchdayPreviewCards = useMemo(() => {
    const bySide = {
      d1: resolvedPreview?.disciplineSideScores.find((entry) => entry.disciplineSide === "d1") ?? null,
      d2: resolvedPreview?.disciplineSideScores.find((entry) => entry.disciplineSide === "d2") ?? null,
    };
    const d1SlotPreviews = slots
      .filter((slot) => slot.disciplineSide === "d1")
      .map((slot) => slotPreviewByKey.get(slot.key))
      .filter((entry): entry is MatchdaySlotPreviewCard => Boolean(entry));
    const d2SlotPreviews = slots
      .filter((slot) => slot.disciplineSide === "d2")
      .map((slot) => slotPreviewByKey.get(slot.key))
      .filter((entry): entry is MatchdaySlotPreviewCard => Boolean(entry));
    const sumProjected = (entries: MatchdaySlotPreviewCard[]) =>
      entries.reduce((sum, entry) => sum + (entry.projected.totalProjected ?? 0), 0);
    const sumFatigueCost = (entries: MatchdaySlotPreviewCard[]) =>
      entries.reduce((sum, entry) => sum + (entry.projected.additionalFatigue ?? 0), 0);
    const sumFatiguePenalty = (entries: MatchdaySlotPreviewCard[]) =>
      entries.reduce((sum, entry) => sum + (entry.projected.fatigueModifier ?? 0), 0);
    const sumRangeLow = (entries: MatchdaySlotPreviewCard[]) =>
      entries.reduce((sum, entry) => sum + (entry.projected.rangeLow ?? entry.projected.totalProjected ?? 0), 0);
    const sumRangeHigh = (entries: MatchdaySlotPreviewCard[]) =>
      entries.reduce((sum, entry) => sum + (entry.projected.rangeHigh ?? entry.projected.totalProjected ?? 0), 0);
    const d1Projected = sumProjected(d1SlotPreviews);
    const d2Projected = sumProjected(d2SlotPreviews);
    const d1Fatigue = sumFatigueCost(d1SlotPreviews);
    const d2Fatigue = sumFatigueCost(d2SlotPreviews);
    const d1FatiguePenalty = sumFatiguePenalty(d1SlotPreviews);
    const d2FatiguePenalty = sumFatiguePenalty(d2SlotPreviews);
    const totalFatigue = sumFatigueCost(d1SlotPreviews) + sumFatigueCost(d2SlotPreviews);
    const d1Required = context?.matchdayContract?.discipline1?.requiredPlayers ?? 0;
    const d2Required = context?.matchdayContract?.discipline2?.requiredPlayers ?? 0;
    const openSlots =
      Math.max(d1Required - lineupMeta.d1Selected, bySide.d1?.missingPlayers ?? 0, 0) +
      Math.max(d2Required - lineupMeta.d2Selected, bySide.d2?.missingPlayers ?? 0, 0);
    const totalProjected = d1Projected + d2Projected;
    const totalBase =
      d1SlotPreviews.reduce((sum, entry) => sum + (entry.selectedScore ?? 0), 0) +
      d2SlotPreviews.reduce((sum, entry) => sum + (entry.selectedScore ?? 0), 0);
    const riskLevel =
      openSlots > 0
        ? "hoch"
        : Math.abs(totalFatigue) >= 40
          ? "mittel"
          : "niedrig";

    return {
      d1: bySide.d1 ? { ...bySide.d1, totalScore: d1Projected || bySide.d1.totalScore } : bySide.d1,
      d2: bySide.d2 ? { ...bySide.d2, totalScore: d2Projected || bySide.d2.totalScore } : bySide.d2,
      d1RangeLow: sumRangeLow(d1SlotPreviews),
      d1RangeHigh: sumRangeHigh(d1SlotPreviews),
      d2RangeLow: sumRangeLow(d2SlotPreviews),
      d2RangeHigh: sumRangeHigh(d2SlotPreviews),
      totalRangeLow: sumRangeLow(d1SlotPreviews) + sumRangeLow(d2SlotPreviews),
      totalRangeHigh: sumRangeHigh(d1SlotPreviews) + sumRangeHigh(d2SlotPreviews),
      d1Projected,
      d2Projected,
      d1Fatigue,
      d2Fatigue,
      d1FatiguePenalty,
      d2FatiguePenalty,
      totalFatigue,
      openSlots,
      totalProjected,
      totalBase,
      riskLevel,
    };
  }, [
    context?.matchdayContract?.discipline1?.requiredPlayers,
    context?.matchdayContract?.discipline2?.requiredPlayers,
    lineupMeta.d1Selected,
    lineupMeta.d2Selected,
    resolvedPreview,
    slotPreviewByKey,
    slots,
  ]);

  const allAvailablePlayersDeployed = useMemo(() => {
    const totalActive = context?.activePlayers?.length ?? 0;
    if (totalActive === 0) return false;
    const assignedIds = new Set(entries.map((e) => e.activePlayerId).filter(Boolean));
    return assignedIds.size >= totalActive;
  }, [context?.activePlayers?.length, entries]);

  const lineupReadyToSave = useMemo(() => {
    return (
      (matchdayPreviewCards.openSlots === 0 || allAvailablePlayersDeployed) &&
      duplicateSelections.length === 0 &&
      !captainBudgetExceeded &&
      entries.length > 0
    );
  }, [allAvailablePlayersDeployed, captainBudgetExceeded, duplicateSelections.length, entries.length, matchdayPreviewCards.openSlots]);

  const draftIntensityPreview = useMemo(
    () => ({
      baseScore: matchdayPreviewCards.totalBase,
      finalScore: matchdayPreviewCards.totalProjected,
      fatigue: matchdayPreviewCards.totalFatigue,
    }),
    [matchdayPreviewCards.totalBase, matchdayPreviewCards.totalFatigue, matchdayPreviewCards.totalProjected],
  );

  const lineupFlowSummary = useMemo(() => {
    const d1Required = context?.matchdayContract?.discipline1?.requiredPlayers ?? 0;
    const d2Required = context?.matchdayContract?.discipline2?.requiredPlayers ?? 0;
    const totalRequired = d1Required + d2Required;
    const selectedCount = lineupMeta.d1Selected + lineupMeta.d2Selected;
    const progressPercent = totalRequired > 0 ? Math.min(100, Math.round((selectedCount / totalRequired) * 100)) : 0;
    const captainCount = Number(Boolean(captains.d1)) + Number(Boolean(captains.d2));
    const hasDuplicateSelections = duplicateSelections.length > 0;
    const hasOpenSlots = matchdayPreviewCards.openSlots > 0;
    const missingCaptainCount = Number(!captains.d1) + Number(!captains.d2);
    const nextStep = hasOpenSlots
      ? {
          label: "Slots füllen",
          detail: `${matchdayPreviewCards.openSlots} offene Slots · aktiver Fokus ${activeSlot ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}` : "Auto"}`,
          tone: "warning" as const,
        }
      : hasDuplicateSelections
        ? {
            label: "Doppelte Spieler lösen",
            detail: `${duplicateSelections.length} Konflikt${duplicateSelections.length === 1 ? "" : "e"} vor dem Speichern`,
            tone: "blocked" as const,
          }
        : captainBudgetExceeded
          ? {
              label: "Captain-Limit prüfen",
              detail: `${captainUsedBeforeCurrentDraft + captainDraftUsedCount}/${captainSeasonLimit} Saison-Captains`,
              tone: "blocked" as const,
            }
          : lineupMoraleSummary.atRiskCount > 0 && lineupMoraleSummary.netDelta < 0
            ? {
                label: "Forderungen abwägen",
                detail: `${lineupMoraleSummary.atRiskCount} offen · Moral ${formatMoraleDelta(lineupMoraleSummary.netDelta)}`,
                tone: "warning" as const,
              }
          : lineupReadyToSave
            ? {
                label: "Lineup speichern",
                detail:
                  missingCaptainCount > 0
                    ? `Slots voll · Captain optional (${missingCaptainCount} offen)`
                    : "Slots voll · Captain gesetzt · bereit fuer den Matchday-Save",
                tone: "ready" as const,
              }
            : {
                label: draft ? "Bereit fuer Arena" : "Preview pruefen",
                detail: draft ? "Gespeicherter Draft liegt vor" : "Optional Preview berechnen oder direkt speichern",
                tone: "ready" as const,
              };

    return {
      totalRequired,
      selectedCount,
      progressPercent,
      captainCount,
      nextStep,
    };
  }, [
    activeSlot,
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
    lineupReadyToSave,
    matchdayPreviewCards.openSlots,
  ]);
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
        : "Slot waehlen";
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
        detail: `${captainSeasonUsedWithDraft}/${captainSeasonLimit} Saison · ${captainDraftRemaining} uebrig`,
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
        detail: "kurz pruefen",
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
        detail: draft ? "Draft liegt vor" : "alles vollstaendig",
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
	  const lineupMiniAudit = useMemo(() => {
	    const items: Array<{
	      key: string;
	      label: string;
	      detail: string;
	      tone: "ready" | "warning" | "blocked";
	    }> = [];
    if (matchdayPreviewCards.openSlots > 0) {
      items.push({
        key: "open-slots",
        label: "Slots",
        detail: allAvailablePlayersDeployed
          ? `${matchdayPreviewCards.openSlots} offen · alle Spieler eingesetzt`
          : `${matchdayPreviewCards.openSlots} offen`,
        tone: allAvailablePlayersDeployed ? "warning" : "blocked",
      });
    } else {
      items.push({
        key: "open-slots",
        label: "Slots",
        detail: `${lineupFlowSummary.selectedCount}/${lineupFlowSummary.totalRequired || "—"} voll`,
        tone: "ready",
      });
    }
	    if (duplicateSelections.length > 0) {
	      items.push({
	        key: "duplicates",
	        label: "Doppelwahl",
	        detail: `${duplicateSelections.length} Konflikt${duplicateSelections.length === 1 ? "" : "e"}`,
	        tone: "blocked",
	      });
	    }
	    items.push({
	      key: "captain",
	      label: "Captain",
	      detail: captainBudgetExceeded
	        ? `${captainUsedBeforeCurrentDraft + captainDraftUsedCount}/${captainSeasonLimit} Limit`
	        : !captains.d1 && !captains.d2
	          ? "Optional · beide offen"
	          : !captains.d1
	            ? `Optional · ${d1Label} offen`
	            : !captains.d2
	              ? `Optional · ${d2Label} offen`
	              : `${captainSeasonUsedWithDraft}/${captainSeasonLimit} Saison`,
	      tone: captainBudgetExceeded ? "blocked" : captains.d1 || captains.d2 ? "ready" : "warning",
	    });
	    if (missingSeasonFormCards) {
	      items.push({
	        key: "form-source",
	        label: "Form",
	        detail: "Quelle fehlt",
	        tone: "warning",
	      });
	    }
	    if (lineupMoraleSummary.atRiskCount > 0) {
	      items.push({
	        key: "morale",
	        label: "Forderungen",
	        detail: `${lineupMoraleSummary.atRiskCount} offen · ${formatMoraleDelta(lineupMoraleSummary.netDelta)}`,
	        tone: lineupMoraleSummary.netDelta < 0 ? "warning" : "ready",
	      });
	    }
	    if (previewPanelWarnings.length > 0) {
	      items.push({
	        key: "preview",
	        label: "Preview",
	        detail: `${previewPanelWarnings.length} Hinweis${previewPanelWarnings.length === 1 ? "" : "e"}`,
	        tone: "warning",
	      });
	    }
	    const status = items.some((item) => item.tone === "blocked")
	      ? "blocked"
	      : items.some((item) => item.tone === "warning")
	        ? "warning"
	        : "ready";
	    return {
	      status,
	      items,
	      blockingItems: items.filter((item) => item.tone === "blocked"),
	      warningItems: items.filter((item) => item.tone === "warning"),
	    };
	  }, [
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
	  ]);
	  const aiInsightPreview = useMemo(() => {
	    if (selectedTeamOption?.controlMode !== "ai" || aiPreview?.teamId !== params.teamId) {
	      return null;
	    }
	    return aiPreview;
	  }, [aiPreview, params.teamId, selectedTeamOption?.controlMode]);
	  const duplicateSelectionIds = useMemo(() => new Set(duplicateSelections), [duplicateSelections]);
  const slotIssuesByKey = useMemo(() => {
    return new Map(
      slots.map((slot) => {
        const selectedId = selections[slot.key] ?? "";
        const selectedOption = getSelectedOptionMeta(selectedId);
        const selectedRosterCard = rosterCardByActivePlayerId.get(selectedId) ?? null;
        const slotPreview = slotPreviewByKey.get(slot.key) ?? null;
        const selectedDemandDecisions =
          selectedId && selectedRosterCard
            ? (moraleDecisionsByActivePlayerId.get(selectedId) ?? []).filter(
                (decision) =>
                  !decision.targetDisciplineId ||
                  decision.targetDisciplineId === slot.disciplineId ||
                  decision.label === "Captain-Rolle",
              )
            : [];
        const issues: Array<{
          tone: "ready" | "warning" | "blocked";
          label: string;
          detail: string;
        }> = [];

        if (!selectedId) {
          issues.push({
            tone: activeSlot?.key === slot.key ? "blocked" : "warning",
            label: activeSlot?.key === slot.key ? "Hier weiter" : "Spieler fehlt",
            detail: `${slot.disciplineSide.toUpperCase()}-${slot.slotIndex + 1} wartet noch auf einen Spieler.`,
          });
        }
        if (selectedId && duplicateSelectionIds.has(selectedId)) {
          issues.push({
            tone: "blocked",
            label: "Doppelwahl",
            detail: "Dieser Spieler ist schon in einem anderen Slot gesetzt.",
          });
        }
        if ((selectedOption?.fatigueCount ?? 0) >= 3) {
          issues.push({
            tone: "warning",
            label: "Fatigue-Risiko",
            detail: `Fatigue ${Math.round(selectedOption?.fatigueCount ?? 0)}: eher rotieren oder Team-Einsatz senken.`,
          });
        }
        const firstWarning = slotPreview?.projected.warnings[0];
        if (firstWarning) {
          issues.push({
            tone: "warning",
            label: formatLineupHintLabel(firstWarning),
            detail: firstWarning,
          });
        }
        for (const decision of selectedDemandDecisions) {
          issues.push({
            tone: decision.fulfilled ? "ready" : "warning",
            label: decision.fulfilled ? "Forderung erfüllt" : "Forderung offen",
            detail: `${decision.playerName}: ${decision.label} (${formatMoraleDelta(decision.moraleDelta)} Moral)`,
          });
        }

        return [slot.key, issues.slice(0, 4)] as const;
      }),
    );
  }, [activeSlot?.key, duplicateSelectionIds, moraleDecisionsByActivePlayerId, rosterCardByActivePlayerId, selections, slotPreviewByKey, slots]);
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
        return (selectedOption?.fatigueCount ?? 0) >= 3;
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
  const lineupSaveCta = useMemo(() => {
    const blockers: string[] = [];
    if (matchdayPreviewCards.openSlots > 0 && !allAvailablePlayersDeployed) {
      blockers.push(`${matchdayPreviewCards.openSlots} Slot${matchdayPreviewCards.openSlots === 1 ? "" : "s"} offen`);
    }
    if (captainBudgetExceeded) {
      blockers.push(`Captain-Limit ${captainUsedBeforeCurrentDraft + captainDraftUsedCount}/${captainSeasonLimit}`);
    }
    if (duplicateSelections.length > 0) {
      blockers.push(`${duplicateSelections.length} Konflikt${duplicateSelections.length === 1 ? "" : "e"}`);
    }

    if (draft) {
      return {
        tone: "ready" as const,
        label: "Arena bereit",
        detail: "Draft ist gespeichert und kann direkt in die Arena gehen.",
        buttonLabel: "Arena bereit",
      };
    }

    if (lineupReadyToSave) {
      const allDeployedHint = allAvailablePlayersDeployed && matchdayPreviewCards.openSlots > 0
        ? "Alle Spieler eingesetzt · Formkarte & Captain optional."
        : !captains.d1 && !captains.d2
          ? "Slots voll, keine Konflikte. Captains sind optional und können gespart werden."
          : "Slots voll, Captain-Plan passt, keine Konflikte mehr.";
      return {
        tone: "ready" as const,
        label: "Lineup bereit speichern",
        detail: allDeployedHint,
        buttonLabel: "Lineup bereit speichern",
      };
    }

    const blockerCount = blockers.length;
    return {
      tone: blockers.some((entry) => entry.includes("Konflikt")) ? ("blocked" as const) : ("warning" as const),
      label: blockerCount > 0 ? `Noch ${blockerCount} ${blockerCount === 1 ? "Ding" : "Dinge"} offen` : "Noch nicht bereit",
      detail: blockers.slice(0, 3).join(" · ") || "Bitte offene Punkte zuerst aufraeumen.",
      buttonLabel: blockerCount > 0 ? `Noch ${blockerCount} offen` : "Noch nicht bereit",
    };
  }, [allAvailablePlayersDeployed, captainBudgetExceeded, captainDraftUsedCount, captainSeasonLimit, captainUsedBeforeCurrentDraft, captains.d1, captains.d2, draft, duplicateSelections.length, lineupReadyToSave, matchdayPreviewCards.openSlots]);
  const lineupFinishItems = useMemo(() => lineupMiniAudit.items.slice(0, 6), [lineupMiniAudit]);
  const activeSlotIssues = activeSlot ? slotIssuesByKey.get(activeSlot.key) ?? [] : [];
  const teamdeckSortInsight = useMemo(() => {
    const activeLabel = activeSlot ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}` : "Auto";
    const labels: Record<TeamdeckSortMode, { label: string; detail: string }> = {
      top: {
        label: "Top Fit",
        detail: `Beste legale Picks fuer ${activeLabel}.`,
      },
      d1: {
        label: d1Label,
        detail: `Nach ${d1Label}-Staerke sortiert.`,
      },
      d2: {
        label: d2Label,
        detail: `Nach ${d2Label}-Staerke sortiert.`,
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
            ? `Captain moeglich · Moral +${formatDecimalScore(captainDemand.moraleReward, 1)}`
            : "Captain moeglich"
          : "kein Captain-Fokus";
    const riskLabel = blockReason
      ? "blockiert"
      : (option.fatigueCount ?? 0) >= 3
        ? `Fatigue ${Math.round(option.fatigueCount ?? 0)}`
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
    const candidateRisk = previewCandidate?.riskLabel ?? topCandidate?.detail ?? "Slot waehlen";
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
        detail: activeSlotIssues[0]?.detail ?? "Naechste Entscheidung",
        tone: activeSlot && !selections[activeSlot.key] ? "warning" : "ready",
      },
      {
        key: "candidate",
        label: "Kandidat",
        value: candidateName,
        detail: candidateScore != null ? `Score ${formatNullableScore(candidateScore)}` : "auswaehlen",
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
    if (!context || !autoFlowReadyRef.current || isBusy) {
      return;
    }
    if (lastAutoPreviewKeyRef.current === draftStateKey) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastAutoPreviewKeyRef.current = draftStateKey;
      void requestPreview(entries, modifiers, { silent: true });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [context, draftStateKey, entries, isBusy, modifiers]);

	  useEffect(() => {
	    if (!context || !autoFlowReadyRef.current || isBusy || duplicateSelections.length > 0) {
	      return;
	    }
    if (lastAutoPersistKeyRef.current === draftStateKey) {
      return;
    }
    if (skipNextAutoPersistRef.current) {
      skipNextAutoPersistRef.current = false;
      lastAutoPersistKeyRef.current = draftStateKey;
      lastAutoPreviewKeyRef.current = draftStateKey;
      void requestPreview(entries, modifiers, { silent: true });
      return;
    }

    const timer = window.setTimeout(() => {
      lastAutoPersistKeyRef.current = draftStateKey;
      lastAutoPreviewKeyRef.current = draftStateKey;
	      if (source === "prisma" || isReadOnly) {
	        void requestPreview(entries, modifiers, { silent: true });
	        return;
	      }
	      void autoPersistDraftAndPreview(entries);
	    }, 500);

	    return () => window.clearTimeout(timer);
	  }, [context, draftStateKey, duplicateSelections.length, entries, isBusy, isReadOnly, modifiers, source]);

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
    );
    if (saved) {
      props.onOpenArena?.({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        teamId: params.teamId,
      });
    }
  }

  async function handleGenerateFormCards() {
    if (source === "prisma" || isReadOnly) {
      setErrors(["Formkarten koennen nur im lokalen Save erzeugt werden."]);
      setWarnings([]);
      setMessage("");
      return;
    }

    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    setMessage("");

    try {
      const query = new URLSearchParams(params);
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
        `${payload.summary.seasonId}: ${payload.summary.generatedCardCount} Formkarten fuer ${payload.summary.coveredTeamCount} Teams und ${payload.summary.coveredPlayerCount} Spieler lokal erzeugt.` +
          (payload.summary.scrubbedSelectionCount > 0
            ? ` ${payload.summary.scrubbedSelectionCount} alte Kartenauswahlen wurden bereinigt.`
            : ""),
      );
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
    const selectedPowerCount = [modifiers.d1.teamPowerId, modifiers.d2.teamPowerId].filter(Boolean).length;
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

    return `${baseMessage} ${filledSlots}/${slots.length} Slots · Captain ${captainBudgetAfterSave}/${captainSeasonLimit} · Einsatz ${intensityLabels} · ${selectedFormCount} Form · ${selectedPowerCount} Power.`;
  }

  async function saveEntries(
    entriesToSave: LegacyLineupEntryInput[],
    successMessage: string,
    options?: { silent?: boolean; resetTransientAfterReload?: boolean },
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
      const response = await fetch(`/api/lineups/legacy?${query.toString()}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entries: entriesToSave, modifiers }),
      });
      const payload = (await response.json()) as {
        draft?: LegacyLineupDraft;
        warnings?: string[];
        errors?: string[];
        error?: string;
      };

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
      await loadContext(params, source, {
        resetTransient: options?.resetTransientAfterReload ?? true,
      });
      props.onLineupSaved?.({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        teamId: params.teamId,
        silent: Boolean(options?.silent),
        draft: payload.draft ?? null,
      });
      return true;
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
    if (previewRequestKeyRef.current === previewRequestKey) {
      return;
    }
    previewRequestKeyRef.current = previewRequestKey;

    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    if (!options?.silent) {
      setMessage("");
    }

    try {
      const response = await fetch(`/api/lineups/legacy/preview?${query.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: previewBody,
      });
      const payload = (await response.json()) as PreviewResponse;

      if (!response.ok || !payload.preview || !payload.preview.ok) {
        setErrors(payload.errors ?? ["Preview konnte nicht berechnet werden."]);
        setWarnings(payload.warnings ?? []);
        return;
      }

      setPreview(payload.preview);
      setIsPreviewPanelOpen(true);
      setWarnings(payload.preview.scorePreview.validationWarnings ?? []);
      if (!options?.silent) {
        setMessage("Preview berechnet.");
      }
    } finally {
      if (previewRequestKeyRef.current === previewRequestKey) {
        previewRequestKeyRef.current = "";
      }
      setIsBusy(false);
    }
  }

  async function handlePreview() {
    await requestPreview(entries, modifiers);
  }

  async function autoPersistDraftAndPreview(entriesToSave: LegacyLineupEntryInput[]) {
    await saveEntries(entriesToSave, "Draft gespeichert.", {
      silent: true,
      resetTransientAfterReload: false,
    });
    await requestPreview(entriesToSave, modifiers, { silent: true });
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
      setMessage("AI-Vorschau fuer alle Teams geladen. Noch nichts gespeichert.");
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
      setMessage("Bitte zuerst die AI-Vorschau fuer alle Teams laden.");
      return;
    }

    if (!dryRun) {
      if (!aiBatchApplyFeed?.dryRun) {
        setMessage("Bitte zuerst Batch DryRun ausfuehren.");
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
        setErrors([payload.error ?? "AI-Batch-Apply konnte nicht ausgefuehrt werden."]);
        return;
      }

      setAiBatchApplyFeed(payload);
      setWarnings(payload.summary.warnings ?? []);
      if (dryRun) {
        setMessage(`Batch-Test bereit: ${payload.summary.plannedLineups} Auto-Teams wuerden gespeichert.`);
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
        setMessage("AI-Uebernahme abgebrochen. Aktuelle Auswahl bleibt unveraendert.");
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

  function jumpToNextLineupTask() {
    if (matchdayPreviewCards.openSlots > 0) {
      focusNextOpenSlot();
      setMessage("Naechster offener Slot ist im Fokus.");
      return;
    }
    if (lineupReadyToSave && !isReadOnly) {
      setMessage("Lineup ist bereit: Enter speichert.");
      scrollLineupTarget("lineup-command-center");
      return;
    }
    setMessage(draft ? "Arena bereit." : "Preview pruefen oder Lineup speichern.");
  }

  function assignActiveSlotCandidateByIndex(index: number) {
    if (!activeSlot || !activeSlotSpotlightCandidates[index]) {
      return;
    }
    const candidate = activeSlotSpotlightCandidates[index];
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

  function clearActiveSlotSelection() {
    if (!activeSlot || !selections[activeSlot.key]) {
      return;
    }
    updateSelection(activeSlot.key, "");
  }

  function updateSelection(
    slotKey: string,
    activePlayerId: string,
    options?: { advanceFocusToNextOpenSlot?: boolean },
	  ) {
	    setPreview(null);
	    setMatchdayScorePreview(null);
	    setVisibleScoreboardSide(null);
	    setDraft(null);
	    const nextSelections = buildUpdatedSelections(selections, slotKey, activePlayerId);
    if (JSON.stringify(nextSelections) !== JSON.stringify(selections)) {
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

      if (event.code === "Enter" && lineupReadyToSave && !isReadOnly) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void handleSaveDraft();
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
      }
    }

    if (filledCount > 0) {
      rememberLineupUndo(
        `${filledCount} Slots gefuellt`,
        `${lineupMeta.d1Selected + lineupMeta.d2Selected}/${lineupFlowSummary.totalRequired || "—"} vorher gesetzt`,
      );
    }
    setSelections(nextSelections);
    setHoveredCandidate(null);
    setMessage(
      filledCount > 0
        ? `${filledCount} offene Slots mit den besten verfuegbaren Kandidaten gefuellt. Captain bleibt bewusst manuell, Saisonlimit ${captainSeasonUsedWithDraft}/${captainSeasonLimit}.`
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
    const isPositiveEffect = power.effectType === "self_boost" || power.effectType === "support_boost";
    const sign = isPositiveEffect ? "+" : "-";
    const pointPrefix = isPositiveEffect ? "+" : "ca -";
    const fitPointPrefix = (breakdown.attributeFitPoints ?? 0) >= 0 ? pointPrefix : isPositiveEffect ? "-" : "ca +";

    return (
      <span
        className={`legacy-lineup-form-card-chip is-${breakdown.conditional.active ? "red is-power-window-active" : breakdown.isFit ? "blue" : "yellow"}`}
        title={[
          power.description,
          breakdown.conditional.active
            ? `Zusatzeffekt aktiv: ${breakdown.conditional.label} (${breakdown.conditional.sourceLabel})`
            : power.conditionalDescription,
          `Tags: ${formatTeamPowerAttributeTags(power)}`,
          breakdown.basePoints != null ? `${formatDecimalScore(breakdown.basePct, 1)}% ≈ ${pointPrefix}${formatDecimalScore(breakdown.basePoints, 1)} Punkte` : null,
          breakdown.extraPoints ? `Extra ${formatDecimalScore(breakdown.extraPct, 1)}% ≈ ${pointPrefix}${formatDecimalScore(breakdown.extraPoints, 1)} Punkte` : null,
          breakdown.attributeFitPct ? `Attribut-Fit ${breakdown.attributeFitPct > 0 ? "+" : ""}${formatDecimalScore(breakdown.attributeFitPct, 1)}% ≈ ${fitPointPrefix}${formatDecimalScore(Math.abs(breakdown.attributeFitPoints ?? 0), 1)} Punkte` : null,
        ].filter(Boolean).join("\n")}
      >
        {getTeamPowerEffectLabel(power)} · {power.label} {sign}{formatDecimalScore(breakdown.basePct, 1)}%
        {breakdown.basePoints != null ? ` ≈ ${pointPrefix}${formatDecimalScore(breakdown.basePoints, 1)}P` : ""}
        {breakdown.extraPct ? ` · Extra +${formatDecimalScore(breakdown.extraPct, 1)}% ≈ ${formatDecimalScore(breakdown.extraPoints ?? 0, 1)}P` : ""}
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
  }) {
    if (!context || isReadOnly) {
      return;
    }
    const pendingKey = `${input.matchdayId}:${input.disciplineSide}`;
    setFormCardPlanPendingKey(pendingKey);
    setErrors([]);
    setMessage("");
    try {
      const query = new URLSearchParams({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: input.matchdayId,
        teamId: params.teamId,
        source,
      });
      const response = await fetch(`/api/lineups/legacy/form-card-plan?${query.toString()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disciplineSide: input.disciplineSide,
          disciplineId: input.disciplineId,
          primaryFormCardId: input.primaryFormCardId,
          secondaryFormCardId: input.secondaryFormCardId,
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
        input.primaryFormCardId || input.secondaryFormCardId
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
      isReadOnly ? "Bearbeitung gesperrt: Das aktive Team ist fuer diesen Owner im Save nicht steuerbar." : null,
      context?.teamPowerSource?.sourceLabel ?? null,
      getTeamPowerEmptyOptionLabel(disciplineSide),
    ].filter(Boolean).join("\n");
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

  const inner = (
    <div className="stack legacy-lineup-lab-grid is-draft-workspace">
      {errors.length > 0 ? (
        <div className="error-banner">
          {errors.map((error, index) => (
            <p key={`${error}-${index}`}>{error}</p>
          ))}
        </div>
      ) : null}

      {message ? (
        <div className="info-banner">
          <p>{message}</p>
        </div>
      ) : null}

      <section className="panel legacy-lineup-toolbar-panel">
        <div className="panel-header legacy-lineup-toolbar-head">
          {props.embedded ? <div /> : (
            <div>
              <TooltipHeading
                as="h2"
                tooltip="Teamdeck → Spielerkarte → Rollenslot → Mini-Preview → Matchday Preview → Speichern."
              >
                Olympiade Einsatzraum
              </TooltipHeading>
            </div>
          )}
          <span className={`legacy-lineup-readonly-chip ${isReadOnly ? "" : "is-local"}`}>
            {isTeamManagementLocked ? "Nur Ansicht" : isReadOnly ? "Referenzmodus" : "Lokaler Spielstand"}
          </span>
        </div>
        <div className="legacy-matchday-header-compact">
          <strong>{matchdayHeaderSummary}</strong>
          <span>
            Spielstand: {source === "prisma" ? "Referenz" : "lokal"} · Team {formatLegacyTeamControlModeLabel(selectedTeamOption?.controlMode)}
            {isTeamManagementLocked ? " · Nur Ansicht" : ""} · Draft{" "}
            {draft ? "gespeichert" : "offen"}
          </span>
        </div>
        {SHOW_CLASSIC_LINEUP_WORKSPACE ? (
        <>
        <section id="lineup-command-center" className={`legacy-lineup-command-center is-${lineupFlowSummary.nextStep.tone}`}>
          <div className="legacy-lineup-command-main">
            <span className="legacy-lineup-command-kicker">Lineup Flow</span>
            <strong>{lineupFlowSummary.nextStep.label}</strong>
            <small>{lineupFlowSummary.nextStep.detail}</small>
            <div className="legacy-lineup-progress-track" aria-label="Lineup Fortschritt">
              <span style={{ width: `${lineupFlowSummary.progressPercent}%` }} />
            </div>
          </div>
          <div className="legacy-lineup-command-stats">
            <div>
              <span>Slots</span>
              <strong>{lineupFlowSummary.selectedCount}/{lineupFlowSummary.totalRequired || "—"}</strong>
            </div>
            <div>
              <span>Captain</span>
              <strong>{captainSeasonUsedWithDraft}/{captainSeasonLimit}</strong>
            </div>
            <div>
              <span>Formkarten</span>
              <strong>{missingSeasonFormCards ? "Season" : "optional"}</strong>
            </div>
            <div>
              <span>Fatigue</span>
              <strong>{formatDecimalScore(matchdayPreviewCards.totalFatigue, 1)}</strong>
            </div>
            <div>
              <span>Score</span>
              <strong>{formatProjectedWindow(matchdayPreviewCards.totalRangeLow, matchdayPreviewCards.totalRangeHigh)}</strong>
            </div>
            <div>
              <span>Blocker</span>
              <strong>{lineupMiniAudit.blockingItems.length}</strong>
            </div>
          </div>
          <div className="legacy-lineup-command-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={focusNextOpenSlot}
              disabled={isBusy || slots.every((slot) => Boolean(selections[slot.key]))}
              title={
                isBusy
                  ? "Bitte kurz warten."
                  : slots.every((slot) => Boolean(selections[slot.key]))
                    ? "Alle Slots sind schon belegt."
                    : "Springt direkt zum naechsten offenen Slot."
              }
            >
              Nächster Slot
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={handleAutoFillOpenSlots}
              disabled={isBusy || slots.every((slot) => Boolean(selections[slot.key]))}
              title={
                isBusy
                  ? "Bitte kurz warten."
                  : slots.every((slot) => Boolean(selections[slot.key]))
                    ? "Alle Slots sind schon belegt."
                    : "Fuellt offene Slots mit den besten legalen Sofort-Picks."
              }
            >
              Slots füllen
            </button>
              <button
              className={`primary-button${lineupReadyToSave ? " is-ready" : ""}`}
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={isBusy || isReadOnly}
              title={lineupSaveCta.detail}
            >
              {lineupSaveCta.buttonLabel}
            </button>
          </div>
          <div className="legacy-lineup-coach-steps" aria-label="Lineup Coach Schritte">
            {lineupCoachSteps.map((step, index) => (
              <div key={step.key} className={`legacy-lineup-coach-step is-${step.status}`}>
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            ))}
          </div>
          <div className="legacy-lineup-missing-strip" aria-label="Was noch fehlt">
            {lineupMissingChips.map((chip) => (
              <span key={chip.key} className={`legacy-lineup-missing-chip is-${chip.tone}`}>
                <strong>{chip.label}</strong>
                <small>{chip.detail}</small>
              </span>
            ))}
          </div>
        </section>
        <div className="legacy-lineup-flow-ribbon" aria-label="Naechster Einsatzlisten-Schritt">
          <button className="legacy-lineup-flow-card is-active" type="button" onClick={jumpToNextLineupTask}>
            <span>Leertaste</span>
            <strong>
              {matchdayPreviewCards.openSlots > 0
                ? "Zum naechsten offenen Slot"
                : lineupReadyToSave
                    ? "Speichern bereit"
                    : "Preview pruefen"}
            </strong>
            <small>
              {activeSlotIssues[0]?.detail ??
                (activeSlot ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1} im Fokus` : "Auto-Fokus aktiv")}
            </small>
          </button>
          <button
            className="legacy-lineup-flow-card"
            type="button"
            onClick={() => activeSlot && activeSlotSpotlightCandidates[0] ? updateSelection(activeSlot.key, activeSlotSpotlightCandidates[0].player.activePlayerId ?? "", { advanceFocusToNextOpenSlot: true }) : focusNextOpenSlot()}
            disabled={!activeSlot || !activeSlotSpotlightCandidates[0]?.player.activePlayerId}
            title={
              !activeSlot
                ? "Wähle erst einen Slot im Board."
                : !activeSlotSpotlightCandidates[0]?.player.activePlayerId
                  ? "Für diesen Slot gibt es gerade keinen klaren Sofort-Pick."
                  : "Setzt den besten sichtbaren Kandidaten direkt in den aktiven Slot."
            }
          >
            <span>Top Pick</span>
            <strong>{activeSlotSpotlightCandidates[0]?.player.name ?? "Kandidat suchen"}</strong>
            <small>
              {activeSlotSpotlightCandidates[0]
                ? `${activeSlotSpotlightCandidates[0].groupMeta.label} · ${formatNullableScore(activeSlotSpotlightCandidates[0].activeSlotCandidate?.projectedScore)}`
                : "Slot waehlen"}
            </small>
            {activeSlot && activeSlotSpotlightCandidates[0] ? (
              <LegacyLineupCandidateReasonChips
                chips={buildCandidateAxisReasonChips(
                  slotRoleByKey.get(activeSlot.key) ?? null,
                  activeSlotSpotlightCandidates[0].player,
                )}
              />
            ) : null}
          </button>
          <div className={`legacy-lineup-flow-card is-${getDisciplineIntensity(focusedDisciplineSide)}`}>
            <span>Einsatz</span>
            <strong>
              D1 {getDisciplineIntensity("d1") === "push" ? "Push" : getDisciplineIntensity("d1") === "conserve" ? "Schonen" : "Normal"} · D2{" "}
              {getDisciplineIntensity("d2") === "push" ? "Push" : getDisciplineIntensity("d2") === "conserve" ? "Schonen" : "Normal"}
            </strong>
            <small>pro Disziplin steuerbar</small>
          </div>
          <button
            className={`legacy-lineup-flow-card${lineupSaveCta.tone === "ready" ? " is-ready" : lineupSaveCta.tone === "blocked" ? " is-blocked" : " is-warning"}`}
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={isBusy || isReadOnly}
            title={lineupSaveCta.detail}
          >
            <span>Abschluss</span>
            <strong>{lineupSaveCta.label}</strong>
            <small>{lineupReadyToSave ? "Enter speichert" : lineupSaveCta.detail}</small>
          </button>
        </div>
        {lineupUndoSnapshot
          ? (() => {
              const undoSnapshot = lineupUndoSnapshot!;
              return (
                <div className="legacy-lineup-undo-bar">
                  <div>
                    <strong>{undoSnapshot.label}</strong>
                    <span>{undoSnapshot.detail}</span>
                  </div>
                  <div className="legacy-lineup-undo-actions">
                    <button className="secondary-button inline-button" type="button" onClick={restoreLineupUndo}>
                      Rueckgaengig
                    </button>
                    <button className="ghost-button" type="button" onClick={() => setLineupUndoSnapshot(null)} aria-label="Hinweis schließen">
                      OK
                    </button>
                  </div>
                </div>
              );
            })()
          : null}
        {missingSeasonFormCards ? (
          <div className="legacy-lineup-inline-warning">
            <div>
              <strong>Formkarten fehlen noch für diese Season.</strong>
              <span>Erzeuge sie einmal global, bevor der Spieltag sauber revealed werden kann.</span>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleGenerateFormCards()}
              disabled={isBusy || isReadOnly}
              title={
                isReadOnly
                  ? "Im Nur-Ansicht-Modus können keine Formkarten erzeugt werden."
                  : isBusy
                    ? "Bitte kurz warten."
                    : "Erzeugt die fehlenden Saison-Formkarten für den Reveal."
              }
            >
              Formkarten erzeugen
            </button>
          </div>
        ) : null}
        <div className="legacy-lineup-control-bar">
          <label>
            <span>Player</span>
            <input
              className="input"
              type="search"
              value={playerFilter}
              onChange={(event) => setPlayerFilter(event.target.value)}
              placeholder="Spieler filtern"
            />
          </label>
          <label>
            <span className="legacy-lineup-control-label-row">
              <span>Spieltag</span>
              {selectedMatchdayIsReady ? <strong className="legacy-lineup-ready-badge">bereit</strong> : null}
            </span>
            <select
              className={`input legacy-lineup-select${selectedMatchdayIsReady ? " is-complete" : ""}`}
              value={params.matchdayId}
              onChange={(event) => {
                void loadContext({ matchdayId: event.target.value }, source);
              }}
            >
              {options.matchdays.map((matchday) => (
                <option key={matchday.id} value={matchday.id}>
                  {formatMatchdayOptionLabel(matchday)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="legacy-lineup-control-label-row">
              <span>Team</span>
              {selectedTeamIsReady ? <strong className="legacy-lineup-ready-badge">eingesetzt</strong> : null}
            </span>
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
                  {formatTeamOptionLabel(team)}
                </option>
              ))}
            </select>
          </label>
          <label className="legacy-lineup-team-filter-toggle">
            <span>Teamfilter</span>
            <button
              className="secondary-button inline-button"
              type="button"
              onClick={() => setShowManagedTeams((current) => !current)}
            >
              {showManagedTeams ? "Nur manuelle Teams" : "AI-/Passive Teams anzeigen"}
            </button>
          </label>
        </div>
        <div className="legacy-lineup-team-boost-panel is-split">
          {(["d1", "d2"] as const).map((disciplineSide) => {
            const discipline =
              disciplineSide === "d1" ? context?.matchdayContract?.discipline1 ?? null : context?.matchdayContract?.discipline2 ?? null;
            const intensity = getDisciplineIntensity(disciplineSide);
            const intensityConfig = getMatchdayIntensityConfig(intensity);
            return (
              <div key={`discipline-intensity-${disciplineSide}`} className={`legacy-lineup-discipline-intensity is-${intensity}`}>
                <div>
                  <span className="legacy-lineup-team-boost-kicker">{disciplineSide.toUpperCase()} Einsatz</span>
                  <strong>
                    {discipline?.displayName ?? "Diszi"} ·{" "}
                    {intensity === "conserve" ? "Schonen" : intensity === "push" ? "Push" : "Normal"}
                  </strong>
                  <small>
                    Score {formatSignedCompactInteger(intensityConfig.scoreModifier)} · Fatigue +{formatScore(intensityConfig.fatigueBase)}
                  </small>
                </div>
                <div className="legacy-lineup-team-boost-switch" role="group" aria-label={`${disciplineSide.toUpperCase()} Einsatz`} title={getGameTermTooltip("Boost") ?? undefined}>
                  {([
                    { value: "conserve" as const, label: "Schonen" },
                    { value: "normal" as const, label: "Normal" },
                    { value: "push" as const, label: "Push" },
                  ]).map((option) => (
                    <button
                      key={`${disciplineSide}-${option.value}`}
                      className={`secondary-button inline-button${intensity === option.value ? " is-selected" : ""}`}
                      type="button"
                      onClick={() => updateDisciplineIntensityStage(disciplineSide, option.value)}
                      title={`${option.label}: ${getGameTermTooltip("Einsatzstufe") ?? ""}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="legacy-lineup-team-tactics-panel">
          <div className="legacy-lineup-team-tactics-head">
            <div>
              <span className="legacy-lineup-team-boost-kicker">Team-Taktik</span>
              <strong>Formkarten & Reveal-Modifier</strong>
            </div>
            <div className="legacy-lineup-team-tactics-status">
              <span className="pill">Form {formatModifierSourceLabel(context?.formCardSource)}</span>
              <span className="pill">Mutator {formatModifierSourceLabel(context?.mutatorSource)}</span>
              <span className="pill">Powers {formatModifierSourceLabel(context?.teamPowerSource)}</span>
            </div>
          </div>
          <div className="legacy-lineup-team-tactics-grid">
            {(["d1", "d2"] as const).map((disciplineSide) => {
              const discipline =
                disciplineSide === "d1" ? context?.matchdayContract?.discipline1 ?? null : context?.matchdayContract?.discipline2 ?? null;
              const disciplineColor = getFormCardColorForCategory(discipline?.category ?? null);
              return (
                <section key={`team-tactics-${disciplineSide}`} className="legacy-lineup-team-tactics-side">
                  <div className="legacy-lineup-team-tactics-side-head">
                    <strong>{disciplineSide.toUpperCase()} · {discipline?.displayName ?? "—"}</strong>
                    <span>{disciplineColor ? formatFormCardColorLabel(disciplineColor) : "—"}</span>
                  </div>
                  <div className="legacy-lineup-team-tactics-form-readonly">
                    <span>Diszi-Form</span>
                    {renderSelectedFormCardChip(modifiers[disciplineSide].primaryFormCardId, disciplineColor) ?? (
                      <em className="legacy-lineup-draft-tactics-form-empty">—</em>
                    )}
                    <span>Bonus</span>
                    {renderSelectedFormCardChip(modifiers[disciplineSide].secondaryFormCardId, disciplineColor) ?? (
                      <em className="legacy-lineup-draft-tactics-form-empty">—</em>
                    )}
                    <button className="secondary-button" type="button" onClick={() => setDraftBoardView("formBoard")}>
                      Im Formplan bearbeiten
                    </button>
                  </div>
                  <label className="legacy-lineup-lab-slot-row">
                    <span>Team-Power</span>
                    <select
                      className="input"
                      value={modifiers[disciplineSide].teamPowerId ?? ""}
                      onChange={(event) => updateModifier(disciplineSide, "teamPowerId", event.target.value)}
                      disabled={isReadOnly || context?.teamPowerSource?.selectionStatus === "missing_source"}
                      title={getTeamPowerSelectTitle(disciplineSide)}
                    >
                      <option value="">{getTeamPowerEmptyOptionLabel(disciplineSide)}</option>
                      {getTeamPowerOptionsForSide(disciplineSide).map((power) => (
                        <option key={power.id} value={power.id}>
                          {formatTeamPowerOptionLabel(
                            power,
                            discipline?.category ?? null,
                            getTeamPowerConditionalInfo(power, discipline?.disciplineId).active,
                            discipline?.disciplineId ?? null,
                            context?.disciplineWeights ?? null,
                          )}
                        </option>
                      ))}
                    </select>
                    {renderSelectedTeamPowerChip(
                      modifiers[disciplineSide].teamPowerId,
                      disciplineSide,
                      discipline?.disciplineId ?? null,
                      discipline?.category ?? null,
                    )}
                  </label>
                </section>
              );
            })}
          </div>
        </div>
        <div className="legacy-lineup-action-bar">
          <button
            className="secondary-button"
            type="button"
            onClick={handleAutoFillOpenSlots}
            disabled={isBusy || slots.every((slot) => Boolean(selections[slot.key]))}
            title={
              isBusy
                ? "Bitte kurz warten."
                : slots.every((slot) => Boolean(selections[slot.key]))
                  ? "Alle Slots sind schon belegt."
                  : "Füllt alle offenen Slots mit den besten legalen Sofort-Picks."
            }
          >
            Offene Slots füllen
          </button>
          <button
            className={`primary-button${lineupReadyToSave ? " is-ready" : ""}`}
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={isBusy || isReadOnly}
            title={lineupSaveCta.detail}
          >
            {lineupSaveCta.buttonLabel}
          </button>
          <button
            className={`secondary-button${isExpertModeEnabled ? " is-selected" : ""}`}
            type="button"
            onClick={() => setIsExpertModeEnabled((current) => !current)}
          >
            {isExpertModeEnabled ? "Daten-Ansicht aus" : "Daten-Ansicht"}
          </button>
          {isExpertModeEnabled ? (
            <>
              <button className="secondary-button" type="button" onClick={() => void loadContext(params, source)} disabled={isBusy}>
                Kontext laden
              </button>
              <button className="secondary-button" type="button" onClick={() => void handlePreview()} disabled={isBusy} title={isBusy ? "Bitte kurz warten." : "Berechnet die aktuelle Matchday-Vorschau mit deinem jetzigen Stand."}>
                Preview berechnen
              </button>
              <button className="secondary-button" type="button" onClick={() => void handleSaveDraft()} disabled={isBusy || isReadOnly} title={lineupSaveCta.detail}>
                Lineup speichern
              </button>
              <button className="secondary-button" type="button" onClick={() => void handleLoadDraft()} disabled={isBusy}>
                Draft laden
              </button>
              <button className="secondary-button" type="button" onClick={() => void handleAiPreview()} disabled={isBusy}>
                Auto-Team
              </button>
            </>
          ) : null}
        </div>
        {isExpertModeEnabled ? (
          <>
            <div className="legacy-lineup-status-strip">
              <span className="legacy-lineup-status-card">
                <strong>{activeSaveLabel}</strong>
                <span>Aktiver Save</span>
              </span>
              <span className="legacy-lineup-status-card">
                <strong>{source === "prisma" ? "Referenz" : "lokal"}</strong>
                <span>Spielstand</span>
              </span>
              <span className="legacy-lineup-status-card">
                <strong>{context?.team.name ?? "—"}</strong>
                <span>Team</span>
              </span>
              <span className="legacy-lineup-status-card">
                <strong>{context?.matchday.label ?? "—"}</strong>
                <span>Spieltag</span>
              </span>
              <span className="legacy-lineup-status-card">
                <strong>
                  {context?.teamStatus?.lineupFilledCount ?? 0}/{context?.teamStatus?.totalLineupSides ?? "—"}
                </strong>
                <span>Saisonstatus gespeichert</span>
              </span>
              <span className="legacy-lineup-status-card">
                <strong>
                  {context?.teamStatus?.captainUsedCount ?? 0}/{context?.teamStatus?.captainSlots ?? 3}
                </strong>
                <span>Captain</span>
              </span>
              <span className="legacy-lineup-status-card">
                <strong>{context?.activePlayers.length ?? 0}</strong>
                <span>Aktive Spieler</span>
              </span>
              <span className="legacy-lineup-status-card">
                <strong>{draft ? "gespeichert" : "offen"}</strong>
                <span>Aktueller Room-Draft</span>
              </span>
            </div>
            <div className="legacy-lineup-rank-row">
              <strong>Ranks:</strong> {d1Label} {d1Rank ?? "—"} ({context?.matchdayContract?.discipline1?.requiredPlayers ?? "—"}) / {d2Label}{" "}
              {d2Rank ?? "—"} ({context?.matchdayContract?.discipline2?.requiredPlayers ?? "—"})
            </div>
          </>
        ) : null}
        {warnings.length > 0 || duplicateSelections.length > 0 ? (
          <ul className="warning-list compact-list legacy-lineup-warning-list">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
            {duplicateSelections.length > 0 ? <li>Doppelte Spielerwahl erkannt. Speichern bleibt blockiert, bis jede Auswahl eindeutig ist.</li> : null}
          </ul>
        ) : null}
        </>
        ) : null}
      </section>

      {SHOW_DRAFT_LINEUP_WORKSPACE ? (
        <section className="legacy-lineup-draft-board" data-testid="legacy-lineup-draft-board">
	          <div className="legacy-lineup-draft-command">
	            <div className="legacy-lineup-draft-command-main">
	              <span>Matchday Prep</span>
	              <strong>{matchdayHeaderSummary}</strong>
	              <small>
	                {lineupSaveCta.label} · {lineupSaveCta.detail}
	              </small>
	            </div>
	            <div className="legacy-lineup-draft-command-metrics">
	              <span className={matchdayPreviewCards.openSlots > 0 ? "is-warning" : "is-ready"} title={matchdayPreviewCards.openSlots > 0 ? `${matchdayPreviewCards.openSlots} Slots fehlen noch.` : "Alle Slots sind belegt."}>
	                Slots <strong>{lineupFlowSummary.selectedCount}/{lineupFlowSummary.totalRequired || "—"}</strong>
	              </span>
	              <span
                  className={captainBudgetExceeded ? "is-blocked" : captainDraftRemaining <= 0 ? "is-warning" : "is-ready"}
                  title={
                    captainBudgetExceeded
                      ? `Captain-Limit ueberschritten: ${captainUsedBeforeCurrentDraft + captainDraftUsedCount}/${captainSeasonLimit}.`
                      : `${captainDraftUsedCount} Captain${captainDraftUsedCount === 1 ? "" : "s"} heute · ${captainDraftRemaining} Saison-Einsatz${captainDraftRemaining === 1 ? "" : "e"} nach aktuellem Draft frei.`
                  }
                >
	                Captain Saison <strong>{captainSeasonUsedWithDraft}/{captainSeasonLimit}</strong>
	              </span>
	              <span className={missingSeasonFormCards ? "is-warning" : "is-ready"} title={missingSeasonFormCards ? "Formkarten fehlen noch." : "Formkarten sind bereit."}>
	                Form <strong>{missingSeasonFormCards ? "offen" : "bereit"}</strong>
	              </span>
	              <span className="is-score" title="Projected Score-Fenster aus aktuellem Lineup, Rollen, Fatigue und Modifikatoren.">
	                Score <strong>{formatProjectedMetricWindow(matchdayPreviewCards.totalRangeLow, matchdayPreviewCards.totalRangeHigh)}</strong>
	              </span>
	              <span className={matchdayPreviewCards.totalFatigue >= 40 ? "is-warning" : "is-ready"} title="Summe der erwarteten Zusatz-Erschoepfung fuer diesen Spieltag.">
	                Fatigue <strong>{formatDecimalScore(matchdayPreviewCards.totalFatigue, 1)}</strong>
	              </span>
	              <span className={lineupMiniAudit.blockingItems.length > 0 ? "is-blocked" : "is-ready"} title={lineupMiniAudit.blockingItems.map((item) => item.detail).join(" · ") || "Keine harten Blocker."}>
	                Blocker <strong>{lineupMiniAudit.blockingItems.length}</strong>
	              </span>
	              <span className={matchdayPreviewCards.riskLevel === "hoch" ? "is-blocked" : matchdayPreviewCards.riskLevel === "mittel" ? "is-warning" : "is-ready"} title="Gesamtrisiko aus offenen Slots und Fatigue.">
	                Risiko <strong>{matchdayPreviewCards.riskLevel}</strong>
	              </span>
	            </div>
            <div className="legacy-lineup-role-lanes" data-testid="legacy-lineup-role-lanes">
              <span className="legacy-lineup-role-lane is-early">Early Phase</span>
              <span className="legacy-lineup-role-lane is-late">Late Phase</span>
            </div>
            <div className="legacy-lineup-flow-checklist" data-testid="legacy-lineup-flow-checklist">
              <span className={matchdayPreviewCards.openSlots === 0 ? "is-ready" : "is-warning"}>Slots voll</span>
              <span className={!missingSeasonFormCards ? "is-ready" : "is-warning"}>Form geplant</span>
              <span className={!captainBudgetExceeded ? "is-ready" : "is-blocked"}>Captain ok</span>
              <span className={lineupReadyToSave ? "is-ready" : "is-warning"}>Save bereit</span>
            </div>
            <div className="legacy-lineup-draft-command-actions">
              <span className="legacy-lineup-draft-flow-chip" title={lineupFlowSummary.nextStep.detail}>
                {lineupFlowSummary.nextStep.label}
              </span>
              {activeSlotSpotlightCandidates[0] ? (
                <span className="legacy-lineup-draft-flow-chip is-positive" title={activeSlotSpotlightCandidates[0].activeSlotCandidate?.fitSummary ?? activeSlotSpotlightCandidates[0].detail}>
                  Top Pick: {activeSlotSpotlightCandidates[0].player.name}
                </span>
              ) : null}
              <button className="secondary-button" type="button" onClick={focusNextOpenSlot} disabled={isBusy || slots.every((slot) => Boolean(selections[slot.key]))}>
                Nächster Slot
              </button>
              <button className="secondary-button" type="button" onClick={handleAutoFillOpenSlots} disabled={isBusy || slots.every((slot) => Boolean(selections[slot.key]))}>
                Auto-Fill
              </button>
              <button className={`primary-button${lineupReadyToSave ? " is-ready" : ""}`} type="button" onClick={() => void handleSaveDraft()} disabled={isBusy || isReadOnly}>
                {lineupSaveCta.buttonLabel}
              </button>
            </div>
          </div>

          <div className="legacy-lineup-draft-view-tabs" role="tablist" aria-label="Einsatzlisten-Ansicht">
            <button
              id="legacy-lineup-tab-lineup"
              role="tab"
              type="button"
              aria-selected={draftBoardView === "lineup"}
              aria-controls="legacy-lineup-panel-lineup"
              className={draftBoardView === "lineup" ? "is-active" : ""}
              onClick={() => setDraftBoardView("lineup")}
            >
              Lineup
            </button>
            <button
              id="legacy-lineup-tab-formplan"
              role="tab"
              type="button"
              aria-selected={draftBoardView === "formBoard"}
              aria-controls="legacy-lineup-panel-formplan"
              className={draftBoardView === "formBoard" ? "is-active" : ""}
              onClick={() => setDraftBoardView("formBoard")}
            >
              Formplan
              {formPlanOpenCells > 0 ? <span className="legacy-lineup-draft-view-tab-badge">{formPlanOpenCells}</span> : null}
            </button>
          </div>

          {draftBoardView === "lineup" ? (
            <DraftWorkspace>
            <div className="legacy-lineup-draft-decision-strip" aria-label="Aktuelle Lineup-Entscheidung">
              <div className="legacy-lineup-draft-decision-main">
                <span>Aktive Entscheidung</span>
                <strong>{teamdeckSortInsight.label}</strong>
                <small>{teamdeckSortInsight.detail}</small>
              </div>
              <div className="legacy-lineup-draft-decision-cards">
                {activeSlotDecisionCards.map((item) => (
                  <span key={`decision-card-${item.key}`} className={`is-${item.tone}`} title={item.detail}>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                    <em>{item.detail}</em>
                  </span>
                ))}
              </div>
            </div>
            </DraftWorkspace>
          ) : null}

	          <details className="legacy-lineup-draft-collapsible legacy-lineup-draft-footer-wrap">
	            <summary>Audit ({lineupMiniAudit.items.length})</summary>
	            <div className="legacy-lineup-draft-footer">
	            <span className={`is-${lineupMiniAudit.status}`}>Audit {lineupMiniAudit.status === "blocked" ? "blockiert" : lineupMiniAudit.status === "warning" ? "Hinweise" : "sauber"}</span>
	            {lineupMiniAudit.items.slice(0, 5).map((item) => (
	              <span key={`mini-audit-${item.key}`} className={`is-${item.tone}`} title={item.detail}>
	                {item.label} {item.detail}
	              </span>
	            ))}
	            </div>
	          </details>
	
	          {aiInsightPreview ? (
	            <details className="legacy-lineup-draft-collapsible legacy-lineup-ai-insight-wrap">
	              <summary>AI-Planung · {aiInsightPreview.teamName}</summary>
	            <section className="legacy-lineup-ai-insight" aria-label="AI-Planung">
	              <div className="legacy-lineup-ai-insight-head">
	                <div>
	                  <span>AI-Planung</span>
	                  <strong>{aiInsightPreview.teamName}</strong>
	                </div>
	                <div className="legacy-lineup-ai-insight-kpis">
	                  <span title="Summe der geplanten D1/D2-Beitraege vor finalem Arena-Reveal.">
	                    Score <strong>{formatDecimalScore(aiInsightPreview.totalExpectedScore, 1)}</strong>
	                  </span>
	                  <span title="Automatischer Audit aus Slots, Captain-Budget und Preview-Hinweisen.">
	                    Audit <strong>{aiInsightPreview.auditSummary?.status === "blocked" ? "Block" : aiInsightPreview.auditSummary?.status === "warning" ? "Hinweis" : "Ready"}</strong>
	                  </span>
	                  <span title="Genutzte Captain-Seiten im Saisonbudget.">
	                    Captain <strong>{aiInsightPreview.captainSlotsUsed}/{aiInsightPreview.captainSlotsUsed + aiInsightPreview.captainSlotsRemaining}</strong>
	                  </span>
	                </div>
	              </div>
	              <div className="legacy-lineup-ai-insight-grid">
	                {[aiInsightPreview.d1, aiInsightPreview.d2].map((side) => {
	                  const sidePlan = aiInsightPreview.modifierPlan?.[side.disciplineSide] ?? null;
	                  const captainLine = side.reasoning.find((line) => line.toLowerCase().includes("captain")) ?? null;
	                  const bestPick = side.selectedEntries
	                    .filter((entry) => entry.finalContribution != null || entry.baseScore != null)
	                    .sort((left, right) => (right.finalContribution ?? right.baseScore ?? 0) - (left.finalContribution ?? left.baseScore ?? 0))[0] ?? null;
	                  const leverageLabel =
	                    side.teamDisciplineRank != null && side.teamDisciplineRank <= 6
	                      ? "Top-Fenster"
	                      : side.requiredPlayers <= 3
	                        ? "kleine Diszi"
	                        : side.missingSlots > 0
	                          ? "Kaderluecke"
	                          : "stabiler Value";
	                  return (
	                    <article key={`ai-insight-${side.disciplineSide}`} className="legacy-lineup-ai-insight-side">
	                      <div className="legacy-lineup-ai-insight-side-head">
	                        <DisciplineIcon disciplineId={side.disciplineId} label={side.disciplineName ?? side.disciplineSide.toUpperCase()} showLabel />
	                        <span title="Team-Rank und benoetigte Spielerzahl fuer diese Disziplin.">
	                          #{side.teamDisciplineRank ?? "—"} · {side.selectedPlayers}/{side.requiredPlayers}
	                        </span>
	                      </div>
	                      <div className="legacy-lineup-ai-decision-strip" aria-label={`${side.disciplineSide.toUpperCase()} AI-Entscheidung`}>
	                        <span title="Warum die AI diese Seite als wichtig einschaetzt.">
	                          <small>Fenster</small>
	                          <strong>{leverageLabel}</strong>
	                        </span>
	                        <span title={sidePlan?.intensityReason ?? "Normaler Einsatz ohne besonderen Push-/Schonen-Grund."}>
	                          <small>Einsatz</small>
	                          <strong>{sidePlan?.intensity === "push" ? "Push" : sidePlan?.intensity === "conserve" ? "Schonen" : "Normal"}</strong>
	                        </span>
	                        <span title={sidePlan?.formReason ?? "Keine Formkarte geplant."}>
	                          <small>Form</small>
	                          <strong>{sidePlan?.primaryFormCardId || sidePlan?.secondaryFormCardId ? "geplant" : "gespart"}</strong>
	                        </span>
	                        <span title={bestPick?.selectionReason ?? "Beste sichtbare Score-Option in diesem AI-Lineup."}>
	                          <small>Top Pick</small>
	                          <strong>{bestPick?.name ?? "—"}</strong>
	                        </span>
	                      </div>
	                      <div className="legacy-lineup-ai-insight-reason">
	                        <strong>{side.captainName ? `Captain ${side.captainName}` : "Captain offen"}</strong>
	                        <span title={captainLine ?? undefined}>{captainLine ?? "AI spart den Captain fuer ein staerkeres Fenster."}</span>
	                      </div>
	                      <div className="legacy-lineup-ai-reason-stack">
	                        {side.reasoning.slice(0, 3).map((line, index) => (
	                          <span key={`ai-reason-${side.disciplineSide}-${index}`} title={line}>{line}</span>
	                        ))}
	                      </div>
	                      <div className="legacy-lineup-ai-insight-modifiers">
	                        <span title={sidePlan?.intensityReason ?? undefined}>Push {sidePlan?.intensity === "push" ? "ja" : sidePlan?.intensity === "conserve" ? "schonen" : "normal"}</span>
	                        <span title={sidePlan?.formReason ?? undefined}>Form {sidePlan?.primaryFormCardId || sidePlan?.secondaryFormCardId ? "geplant" : "—"}</span>
	                        <span title={sidePlan?.mutatorReason ?? undefined}>Mut {sidePlan?.mutatorTrait1 ? `${sidePlan.mutatorTrait1}${sidePlan.mutatorTrait2 ? ` / ${sidePlan.mutatorTrait2}` : ""}` : "—"}</span>
	                        <span title={sidePlan?.teamPowerReason ?? undefined}>Power {sidePlan?.teamPowerId ? "aktiv" : "—"}</span>
	                      </div>
	                      <ul className="legacy-lineup-ai-insight-players">
	                        {side.selectedEntries.map((player, index) => (
	                          <li key={`ai-insight-player-${side.disciplineSide}-${player.activePlayerId ?? player.playerId}-${index}`} title={player.selectionReason ?? undefined}>
	                            <span>{player.name ?? player.playerId}{player.isCaptain ? " · C" : ""}</span>
	                            <strong>{formatDecimalScore(player.finalContribution ?? player.baseScore, 1)}</strong>
	                            <small>{player.selectionReason ?? `Score ${formatDecimalScore(player.baseScore, 1)}`}</small>
	                          </li>
	                        ))}
	                      </ul>
	                    </article>
	                  );
	                })}
	              </div>
	            </section>
	            </details>
	          ) : null}
	
          {draftBoardView === "formBoard" ? (
            <FormBoardPanel
              modifiers={modifiers}
              context={context}
              draft={draft}
              draftIntensityPreview={draftIntensityPreview}
              formPlanOpenCells={formPlanOpenCells}
              formDeckCards={formDeckCards}
              activeFormPickCell={activeFormPickCell}
              formCardPlanByKey={formCardPlanByKey}
              formCardPlanPendingKey={formCardPlanPendingKey}
              usedFormCards={usedFormCards}
              isReadOnly={isReadOnly}
              matchdayId={params.matchdayId}
              matchdayOptions={options.matchdays}
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
              setActiveFormPickCell={setActiveFormPickCell}
            />
          ) : null}

          {draftBoardView === "lineup" && disciplineAreaRoadmap.length > 0 ? (
            <div className="legacy-lineup-draft-roadmap" aria-label="Disziplin-Roadmap nach Bereich">
              {disciplineAreaRoadmap.map((group) => (
                <section key={`roadmap-${group.key}`} className={`legacy-lineup-draft-roadmap-card is-${group.color}`}>
                  <span>{group.label}</span>
                  <div className="legacy-lineup-draft-roadmap-items">
                    {group.items.map((item) => (
                      <span
                        key={`${group.key}-${item.disciplineId}`}
                        className={`legacy-lineup-draft-roadmap-item${item.isCurrent ? " is-current" : ""}${item.isPast ? " is-past" : ""}`}
                        title={`${item.label} · Rank ${item.rank ?? "—"} · ${item.playerCount ?? "—"} Spieler`}
                      >
                        <strong>{item.shortLabel}</strong> {item.rank ?? "—"} ({item.playerCount ?? "—"})
                      </span>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {draftBoardView === "lineup" ? (
            <div className="legacy-lineup-draft-controls">
              <label>
                <span>Spieler</span>
                <input className="input" type="search" value={playerFilter} onChange={(event) => setPlayerFilter(event.target.value)} placeholder="Name, Klasse, Trait" />
              </label>
              <label>
                <span>Spieltag</span>
                <select className={`input legacy-lineup-select${selectedMatchdayIsReady ? " is-complete" : ""}`} value={params.matchdayId} onChange={(event) => void loadContext({ matchdayId: event.target.value }, source)}>
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
                      {formatTeamOptionLabel(team)}
                    </option>
                  ))}
                </select>
              </label>
              <div className={`legacy-lineup-draft-intensity is-${getDisciplineIntensity(focusedDisciplineSide)}`} role="group" aria-label="Beide Diszis setzen">
                {([
                  { value: "conserve" as const, label: "Schonen" },
                  { value: "normal" as const, label: "Normal" },
                  { value: "push" as const, label: "Push" },
                ]).map((option) => (
                  <button
                    key={option.value}
                    className={getDisciplineIntensity("d1") === option.value && getDisciplineIntensity("d2") === option.value ? "is-selected" : ""}
                    type="button"
                    onClick={() => updateTeamIntensityStage(option.value)}
                    title="Setzt D1 und D2 gleichzeitig. Einzelne Diszi unten im Board feinsteuern."
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <VeloImpactStrip
                className="legacy-lineup-draft-intensity-preview"
                items={[
                  {
                    key: "base",
                    label: "Base",
                    value: formatNullableScore(draftIntensityPreview.baseScore),
                    tone: "neutral",
                  },
                  {
                    key: "tactic",
                    label: "Taktik",
                    value: `D1 ${formatIntensityStageLabel(getDisciplineIntensity("d1"))} · D2 ${formatIntensityStageLabel(getDisciplineIntensity("d2"))}`,
                    tone: "warning",
                  },
                  {
                    key: "final",
                    label: "Final",
                    value: formatNullableScore(draftIntensityPreview.finalScore),
                    tone: "positive",
                  },
                  {
                    key: "fatigue",
                    label: "Fatigue",
                    value: formatDecimalScore(draftIntensityPreview.fatigue, 1),
                    tone: draftIntensityPreview.fatigue >= 40 ? "negative" : "neutral",
                  },
                ]}
              />
            </div>
          ) : null}

          {draftBoardView === "lineup" ? (
            <div className="legacy-lineup-draft-tactics">
              {(["d1", "d2"] as const).map((disciplineSide) => {
                const discipline =
                  disciplineSide === "d1" ? context?.matchdayContract?.discipline1 ?? null : context?.matchdayContract?.discipline2 ?? null;
                const disciplineColor = getFormCardColorForCategory(discipline?.category ?? null);
                return (
                  <section key={`draft-tactics-${disciplineSide}`}>
                    <div>
                      <span>{disciplineSide.toUpperCase()}</span>
                      <strong>{discipline?.displayName ?? "—"}</strong>
                    </div>
                    <div className="legacy-lineup-draft-tactics-form-readonly">
                      <span>Form</span>
                      {renderSelectedFormCardChip(modifiers[disciplineSide].primaryFormCardId, disciplineColor) ?? (
                        <em className="legacy-lineup-draft-tactics-form-empty">—</em>
                      )}
                      {renderSelectedFormCardChip(modifiers[disciplineSide].secondaryFormCardId, disciplineColor)}
                      <button className="secondary-button" type="button" onClick={() => setDraftBoardView("formBoard")}>
                        Im Formplan bearbeiten
                      </button>
                    </div>
                    <select
                      className="input"
                      value={modifiers[disciplineSide].teamPowerId ?? ""}
                      onChange={(event) => updateModifier(disciplineSide, "teamPowerId", event.target.value)}
                      disabled={isReadOnly || context?.teamPowerSource?.selectionStatus === "missing_source"}
                      aria-label={`${disciplineSide.toUpperCase()} Team-Power`}
                      title={getTeamPowerSelectTitle(disciplineSide)}
                    >
                      <option value="">{getTeamPowerEmptyOptionLabel(disciplineSide)}</option>
                      {getTeamPowerOptionsForSide(disciplineSide).map((power) => (
                        <option key={power.id} value={power.id}>
                          {formatTeamPowerOptionLabel(
                            power,
                            discipline?.category ?? null,
                            getTeamPowerConditionalInfo(power, discipline?.disciplineId).active,
                            discipline?.disciplineId ?? null,
                            context?.disciplineWeights ?? null,
                          )}
                        </option>
                      ))}
                    </select>
                  </section>
                );
              })}
            </div>
          ) : null}

          {draftBoardView === "lineup" && usedFormCards.length > 0 ? (
            <section className="legacy-lineup-used-form-cards" aria-label="Bereits genutzte Formkarten">
              <div>
                <span>Bereits genutzt</span>
                <strong>{usedFormCards.length} Formkarten</strong>
              </div>
              <div className="legacy-lineup-used-form-card-list">
                {usedFormCards.map((card) => (
                  <span key={card.id} className={`legacy-lineup-form-card-chip legacy-lineup-used-form-card is-${card.color}`}>
                    <span className="legacy-lineup-form-card-dot" aria-hidden="true" />
                    {formatFormCardValueLabel(card.value)} Punkte · {formatFormCardColorLabel(card.color)}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {draftBoardView === "lineup" ? (
            <div className="legacy-lineup-draft-layout">
            <section className="legacy-lineup-draft-slots" aria-label="D1 / D2 Lineup-Zonen">
              {(["d1", "d2"] as const).map((disciplineSide) => {
                const discipline =
                  disciplineSide === "d1" ? context?.matchdayContract?.discipline1 ?? null : context?.matchdayContract?.discipline2 ?? null;
                const disciplineColor = getFormCardColorForCategory(discipline?.category ?? null);
                const disciplineColorClass = disciplineColor ? `is-discipline-${disciplineColor}` : "is-discipline-neutral";
                const sideSlots = slots.filter((slot) => slot.disciplineSide === disciplineSide);
                const selectedPlayers = disciplineSide === "d1" ? lineupMeta.d1Selected : lineupMeta.d2Selected;
                const requiredPlayers = discipline?.requiredPlayers ?? 0;
                const sideProgressPercent =
                  requiredPlayers > 0 ? Math.min(100, Math.round((selectedPlayers / requiredPlayers) * 100)) : 0;
                const captainOptions = getCaptainOptionsForSide(disciplineSide);
                const captainSelectEntries = getCaptainSelectEntriesForSide(disciplineSide);
                const suggestedCaptain = captainOptions[0] ?? null;
                const captainInfoByActivePlayerId = new Map(
                  captainCandidateInfoBySide[disciplineSide].map((info) => [info.activePlayerId, info] as const),
                );
                const selectedCaptainInfo = captains[disciplineSide]
                  ? captainInfoByActivePlayerId.get(captains[disciplineSide]) ?? null
                  : null;
                const suggestedCaptainInfo = suggestedCaptain
                  ? captainInfoByActivePlayerId.get(suggestedCaptain.activePlayerId) ?? null
                  : null;
                return (
                  <section key={`draft-side-${disciplineSide}`} className={`legacy-lineup-draft-side is-${disciplineSide} ${disciplineColorClass}`} id={`draft-side-${disciplineSide}`}>
                    <div className="legacy-lineup-draft-side-head">
                      <div>
                        <span>{disciplineSide.toUpperCase()}</span>
                        <strong>{discipline?.displayName ?? "—"}</strong>
                        <small>
                          Rank {disciplineSide === "d1" ? d1Rank ?? "—" : d2Rank ?? "—"} · {selectedPlayers}/{requiredPlayers || "—"} Slots
                        </small>
                        <div className="legacy-lineup-progress-track" aria-label={`${disciplineSide.toUpperCase()} Fortschritt`}>
                          <span style={{ width: `${sideProgressPercent}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="legacy-lineup-captain-strip">
                      <div onDoubleClick={() => openPlayerDetailsForActivePlayer(captains[disciplineSide])}>
                        <span>Captain-Ressource</span>
                        <strong>{captains[disciplineSide] ? getSelectedOptionMeta(captains[disciplineSide])?.name ?? "gesetzt" : "offen"}</strong>
                        <small>
                          {selectedCaptainInfo
                            ? `Beitrag +${formatNullableScore(selectedCaptainInfo.estimatedCaptainBonus)} · ${
                                selectedCaptainInfo.moraleReward != null
                                  ? `Moral +${formatDecimalScore(selectedCaptainInfo.moraleReward, 1)}`
                                  : "keine Captain-Forderung"
                              }`
                            : suggestedCaptain
                              ? captainDraftRemaining > 0 || captains[disciplineSide]
                                ? `Vorschlag: +${formatNullableScore(suggestedCaptainInfo?.estimatedCaptainBonus ?? null)} Captain · ${
                                    suggestedCaptainInfo?.moraleReward != null
                                      ? `Moral +${formatDecimalScore(suggestedCaptainInfo.moraleReward, 1)}`
                                      : "keine Captain-Forderung"
                                  }`
                                : `Saisonlimit ${captainSeasonLimit}/${captainSeasonLimit} erreicht`
                              : "Erst Spieler in Slots setzen"}
                        </small>
                        <div className="legacy-lineup-captain-resource-meter" aria-label={`Captain Budget ${captainSeasonUsedWithDraft} von ${captainSeasonLimit}`}>
                          {Array.from({ length: captainSeasonLimit }).map((_, index) => {
                            const slotNumber = index + 1;
                            const isSpent = slotNumber <= captainUsedBeforeCurrentDraft;
                            const isDraft = slotNumber > captainUsedBeforeCurrentDraft && slotNumber <= captainSeasonUsedWithDraft;
                            return (
                              <span
                                key={`${disciplineSide}-draft-captain-budget-${slotNumber}`}
                                className={`${isSpent ? "is-spent" : ""} ${isDraft ? "is-draft" : ""}`.trim()}
                                title={isSpent ? "Schon vor diesem Draft verbraucht" : isDraft ? "Wird verbraucht, wenn du speicherst" : "Noch frei"}
                              />
                            );
                          })}
                          <small>{captainSeasonUsedWithDraft}/{captainSeasonLimit} nach Save</small>
                        </div>
                      </div>
                      <div className="legacy-lineup-captain-impact-grid">
                        <span>
                          <strong>{selectedCaptainInfo ? `+${formatNullableScore(selectedCaptainInfo.estimatedCaptainBonus)}` : suggestedCaptainInfo ? `+${formatNullableScore(suggestedCaptainInfo.estimatedCaptainBonus)}` : "—"}</strong>
                          <small>Score-Wirkung</small>
                        </span>
                        <span>
                          <strong>
                            {selectedCaptainInfo?.moraleReward != null
                              ? `+${formatDecimalScore(selectedCaptainInfo.moraleReward, 1)}`
                              : suggestedCaptainInfo?.moraleReward != null
                                ? `+${formatDecimalScore(suggestedCaptainInfo.moraleReward, 1)}`
                                : "—"}
                          </strong>
                          <small>Happiness</small>
                        </span>
                        <span className={captainDraftRemaining <= 0 && !captains[disciplineSide] ? "is-warning" : ""}>
                          <strong>{captainDraftRemaining}</strong>
                          <small>frei im Draft</small>
                        </span>
                      </div>
                      <div className="legacy-lineup-captain-actions">
                        <select
                          className="input"
                          value={captains[disciplineSide]}
                          onChange={(event) => updateCaptain(disciplineSide, event.target.value)}
                          disabled={isReadOnly || captainSelectEntries.length === 0}
                          title={
                            captainSelectEntries.length === 0
                              ? "Setze zuerst mindestens einen Spieler auf dieser Seite ein."
                              : `${captainDraftRemaining} Captain-Einsatz${captainDraftRemaining === 1 ? "" : "e"} fuer diesen Draft uebrig`
                          }
                        >
                          <option value="">Kein Captain</option>
                          {captainSelectEntries.map((entry) => {
                            const info = captainInfoByActivePlayerId.get(entry.activePlayerId);
                            return (
                              <option key={entry.activePlayerId} value={entry.activePlayerId}>
                                {entry.name} · Captain +{formatNullableScore(info?.estimatedCaptainBonus ?? null)}
                                {info?.moraleReward != null ? ` · Moral +${formatDecimalScore(info.moraleReward, 1)}` : " · keine Forderung"}
                              </option>
                            );
                          })}
                        </select>
                        <button
                          className="secondary-button inline-button"
                          type="button"
                          disabled={
                            !suggestedCaptain ||
                            captains[disciplineSide] === suggestedCaptain.activePlayerId ||
                            (!captains[disciplineSide] && captainDraftRemaining <= 0)
                          }
                          onClick={() => suggestedCaptain && updateCaptain(disciplineSide, suggestedCaptain.activePlayerId)}
                        >
                          Vorschlag bewusst setzen
                        </button>
                      </div>
                    </div>
                    <div className="legacy-lineup-draft-slot-list">
                      {sideSlots.map((slot) => {
                        const role = slotRoleByKey.get(slot.key) ?? null;
                        const selectedRosterCard = rosterCardByActivePlayerId.get(selections[slot.key] ?? "") ?? null;
                        const selectedOption = getSelectedOptionMeta(selections[slot.key]);
                        const selectedScore = getSelectedOptionScore(selectedOption, slot.disciplineId);
                        const slotPreview = slotPreviewByKey.get(slot.key) ?? null;
                        const dragPreview = slotDragPreviewByKey.get(slot.key) ?? null;
                        const slotCandidateSummary = slotCandidateSummaryByKey.get(slot.key) ?? null;
                        const isActiveSlot = activeSlot?.key === slot.key;
                        const slotMicroStepStates = resolveSlotMicroStepStates({
                          hasSelection: Boolean(selections[slot.key]),
                          isActiveSlot,
                          isHoveredAssign: hoveredCandidate?.slotKey === slot.key,
                          isRecentlyAssigned: recentlyAssignedSlotKey === slot.key,
                        });
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
                              weightPct: attribute.weightPct,
                              emphasis: attribute.emphasis,
                            }))
                          : [];
                        return (
                          <article
                            key={`draft-slot-${slot.key}`}
                            className={`legacy-lineup-draft-slot ${disciplineColorClass} ${isActiveSlot ? "is-active" : ""} ${selectedRosterCard ? "is-filled" : "is-empty"} ${draggedActivePlayerId ? "is-drop-ready" : ""} ${getDragFitTierClass(dragPreview?.fitTier ?? null)}`.trim()}
                            id={`draft-slot-${slot.key}`}
                            onClick={() => {
                              setActiveSlotKey(slot.key);
                              setFocusedDisciplineSide(slot.disciplineSide);
                            }}
                            onDragOver={(event) => {
                              const currentDragPreview = slotDragPreviewByKey.get(slot.key) ?? null;
                              if (currentDragPreview?.blockReason) {
                                return;
                              }
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              handleDropOnSlot(slot.key, event.dataTransfer.getData("text/plain") || draggedActivePlayerId);
                            }}
                            title={[
                              role?.description ?? `Slot ${slot.slotIndex + 1}`,
                              dragPreview
                                ? `Drop: ${formatNullableScore(dragPreview.projected.totalProjected)} · Δ ${dragPreview.scoreDelta != null ? `${dragPreview.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(dragPreview.scoreDelta, 1)}` : "—"}`
                                : null,
                            ].filter(Boolean).join("\n")}
                          >
                            {(!selectedRosterCard || isActiveSlot) ? (
                              <LegacyLineupSlotMicroSteps stepStates={slotMicroStepStates} />
                            ) : null}
                            <div className="legacy-lineup-draft-slot-head">
                              <span>{disciplineSide.toUpperCase()}-{slot.slotIndex + 1}</span>
                              <strong>{role?.label ?? `Slot ${slot.slotIndex + 1}`}</strong>
                              {(!selectedRosterCard || isActiveSlot) ? (
                                <small>{role?.description ?? "Standard-Rolle"}</small>
                              ) : null}
                            </div>
                            {selectedRosterCard ? (
                              <div className="legacy-lineup-draft-slot-player">
                                {selectedRosterCard.portraitUrl ? (
                                  <OptimizedMediaImage className="legacy-lineup-draft-slot-portrait" src={selectedRosterCard.portraitUrl} alt={selectedRosterCard.name} width={48} height={48} />
                                ) : (
                                  <span className="legacy-lineup-draft-slot-portrait">—</span>
                                )}
                                <div>
                                  <strong>{selectedRosterCard.name}</strong>
                                  <span>
                                    Base {formatNullableScore(selectedScore)} · Slot {slotPreview?.projected.totalProjected != null ? formatScore(slotPreview.projected.totalProjected) : "—"}
                                  </span>
                                  <small>
                                    Fatigue -{formatDecimalScore(slotPreview?.projected.fatigueModifier ?? 0, 1)} · Extra +{formatScore(slotPreview?.projected.additionalFatigue ?? 0)}
                                  </small>
                                </div>
                              </div>
                            ) : (
                              <div className="legacy-lineup-draft-slot-empty">
                                <strong>{isActiveSlot ? "Hier ablegen" : "Freier Slot"}</strong>
                                {slotCandidateSummary?.topCandidates[0] ? (
                                  <button
                                    className="legacy-lineup-quick-assign-button"
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      updateSelection(slot.key, slotCandidateSummary.topCandidates[0].activePlayerId, {
                                        advanceFocusToNextOpenSlot: true,
                                      });
                                    }}
                                    title={`${slotCandidateSummary.topCandidates[0].name} · ${slotCandidateSummary.topCandidates[0].fitDetail}`}
                                  >
                                    <span>Top Pick: {slotCandidateSummary.topCandidates[0].name}</span>
                                    <strong>{formatNullableScore(slotCandidateSummary.topCandidates[0].projectedScore)}</strong>
                                    <LegacyLineupCandidateReasonChips chips={slotCandidateSummary.topCandidates[0].reasonChips} />
                                    <small>{slotCandidateSummary.topCandidates[0].fitSummary}</small>
                                  </button>
                                ) : (
                                  <span>Spielerkarte hineinziehen</span>
                                )}
                              </div>
                            )}
                            <div className="legacy-lineup-draft-slot-meta">
                              {roleAttributes.map((attribute) => (
                                <span key={`${slot.key}-${attribute.key}`} className={`legacy-lineup-slot-attribute-pill ${getTierStyleClass(attribute.ratingLabel)} ${attribute.emphasis === "support" ? "is-strain" : "is-positive"}`}>
                                  {attribute.shortLabel} {attribute.ratingLabel ?? "—"}
                                </span>
                              ))}
                              {dragPreview ? (
                                <span className={`legacy-lineup-draft-drop-preview ${getDragFitTierClass(dragPreview.fitTier)}`}>
                                  Drop {formatNullableScore(dragPreview.projected.totalProjected)}
                                  {dragPreview.scoreDelta != null ? ` · ${dragPreview.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(dragPreview.scoreDelta, 1)}` : ""}
                                </span>
                              ) : null}
                            </div>
                            {(slotIssuesByKey.get(slot.key) ?? []).length > 0 ? (
                              <div className="legacy-lineup-slot-issue-row" aria-label="Slot Status">
                                {(slotIssuesByKey.get(slot.key) ?? []).slice(0, 2).map((issue, issueIndex) => (
                                  <span
                                    key={`${slot.key}-${issue.label}-${issue.detail}-${issueIndex}`}
                                    className={`legacy-lineup-slot-issue-chip is-${issue.tone}`}
                                    title={issue.detail}
                                  >
                                    {issue.label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {!selectedRosterCard && slotCandidateSummary?.topCandidates.length ? (
                              <div className="legacy-lineup-quick-assign-row">
                                {slotCandidateSummary.topCandidates.slice(0, 3).map((candidate) => (
                                  <button
                                    key={`${slot.key}-draft-quick-${candidate.activePlayerId}`}
                                    className={`legacy-lineup-quick-assign-button${hoveredCandidate?.slotKey === slot.key && hoveredCandidate.activePlayerId === candidate.activePlayerId ? " is-previewed" : ""}`}
                                    type="button"
                                    onMouseEnter={() => scheduleHoveredCandidate({ slotKey: slot.key, activePlayerId: candidate.activePlayerId })}
                                    onMouseLeave={() => setHoveredCandidate(null)}
                                    onFocus={() => scheduleHoveredCandidate({ slotKey: slot.key, activePlayerId: candidate.activePlayerId })}
                                    onBlur={() => setHoveredCandidate(null)}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      updateSelection(slot.key, candidate.activePlayerId, {
                                        advanceFocusToNextOpenSlot: true,
                                      });
                                    }}
                                    title={`${candidate.name} · ${formatNullableScore(candidate.projectedScore)}${
                                      candidate.scoreDelta != null
                                        ? ` · ${candidate.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(candidate.scoreDelta, 1)}`
                                        : ""
                                    } · ${candidate.fitDetail}`}
                                  >
                                    <span>{candidate.name}</span>
                                    <strong>{formatNullableScore(candidate.projectedScore)}</strong>
                                    {candidate.scoreDelta != null ? (
                                      <small>{candidate.scoreDelta >= 0 ? "+" : ""}{formatDecimalScore(candidate.scoreDelta, 1)}</small>
                                    ) : null}
                                    <LegacyLineupCandidateReasonChips chips={candidate.reasonChips} />
                                    <small>{candidate.fitSummary}</small>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <select
                              className="input"
                              value={selections[slot.key] ?? ""}
                              onChange={(event) => updateSelection(slot.key, event.target.value, { advanceFocusToNextOpenSlot: Boolean(event.target.value) })}
                            >
                              <option value="">Spieler wählen</option>
                              {sortOptionsByDisciplineSkill(getAvailableOptionsForSlot(slot.key), slot.disciplineId).map((option) => (
                                <option key={option.activePlayerId} value={option.activePlayerId}>
                                  {renderOptionLabel(option, slot.disciplineId)}
                                </option>
                              ))}
                            </select>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </section>

            <aside className="legacy-lineup-draft-deck" aria-label="Spielerkarten">
              <div className="legacy-lineup-draft-deck-head">
                <div>
                  <span>Spielerkarten</span>
                  <strong>{activeSlot ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}` : "Auto-Fokus"}</strong>
                  <small>
                    {teamdeckCandidateEntries.length}/{matchdayRosterCards.length} sichtbar · {activeSlotRole?.label ?? "Slot wählen"}
                  </small>
                </div>
                <button className={`secondary-button inline-button${showOnlyTopSlotCandidates ? " is-selected" : ""}`} type="button" onClick={() => setShowOnlyTopSlotCandidates((current) => !current)}>
                  {showOnlyTopSlotCandidates ? "Top" : "Alle"}
                </button>
              </div>
              <div className="legacy-lineup-deck-filter" role="group" aria-label="Teamdeck Filter">
                {([
                  { value: "all" as const, label: "Alle" },
                  { value: "free" as const, label: "Frei" },
                  { value: "assigned" as const, label: "Drin" },
                  { value: "blocked" as const, label: "Blockiert" },
                ]).map((option) => (
                  <button key={option.value} className={`secondary-button inline-button${teamdeckFilterMode === option.value ? " is-selected" : ""}`} type="button" onClick={() => setTeamdeckFilterMode(option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
	              <div className="legacy-lineup-deck-filter" role="group" aria-label="Teamdeck Sortierung">
	                {([
	                  { value: "top" as const, label: "Top Fit" },
	                  { value: "d1" as const, label: d1Label },
	                  { value: "d2" as const, label: d2Label },
	                  { value: "captain" as const, label: "Captain" },
	                  { value: "fatigue" as const, label: "Low Fatigue" },
	                  { value: "wish" as const, label: "Wunsch" },
	                ]).map((option) => (
	                  <button
	                    key={option.value}
                    className={`secondary-button inline-button${teamdeckSortMode === option.value ? " is-selected" : ""}`}
                    type="button"
                    onClick={() => setTeamdeckSortMode(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {hoveredCandidatePreview ? (
                <div className={`legacy-lineup-draft-hover-preview${hoveredCandidatePreview.blockReason ? " is-blocked" : hoveredCandidatePreview.scoreDelta != null && hoveredCandidatePreview.scoreDelta >= 0 ? " is-positive" : " is-warning"}`}>
                  <div>
                    <span>{hoveredCandidatePreview.slotLabel} · {hoveredCandidatePreview.roleLabel}</span>
                    <strong>{hoveredCandidatePreview.playerName}</strong>
                  </div>
                  <div className="legacy-lineup-draft-hover-preview-metrics">
                    <span>Score <strong>{formatNullableScore(hoveredCandidatePreview.projectedScore)}</strong></span>
                    <span>
                      Δ{" "}
                      <strong>
                        {hoveredCandidatePreview.scoreDelta != null
                          ? `${hoveredCandidatePreview.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(hoveredCandidatePreview.scoreDelta, 1)}`
                          : "—"}
                      </strong>
                    </span>
                    <span>Ft <strong>+{formatScore(hoveredCandidatePreview.additionalFatigue)}</strong></span>
                  </div>
                  <small>
                    {formatLegacyLineupDragBlockReason(hoveredCandidatePreview.blockReason) ??
                      hoveredCandidatePreview.warnings[0] ??
                      hoveredCandidatePreview.fitDetail ??
                      "passt sauber in den aktiven Slot"}
                  </small>
                </div>
              ) : (
                <div className="legacy-lineup-draft-hover-preview is-idle">
                  <div>
                    <span>Live-Preview</span>
                    <strong>Karte berühren</strong>
                  </div>
                  <small>Score, Delta, Fatigue und Blocker erscheinen hier sofort.</small>
                </div>
              )}
	              <div className="legacy-lineup-draft-card-list">
	                {teamdeckCandidateGroups.map((group) => (
                    <section key={`draft-candidate-group-${group.key}`} className={`legacy-lineup-draft-candidate-group is-${group.key}`}>
                      <div className="legacy-lineup-draft-candidate-group-head">
                        <strong>{group.meta.label}</strong>
                        <span>{group.entries.length}/{group.totalCount}</span>
                      </div>
                      <div className="legacy-lineup-draft-candidate-group-list">
	                {group.entries
	                  .slice(0, showOnlyTopSlotCandidates ? (group.key === "instant" ? 5 : 3) : 40)
	                  .map(({ player, activeSlotCandidate, captainDemand, groupMeta, groupKey, preferredSlotTags, relevantDisciplineDemands, shortReason, wantsActiveSlot }) => {
	                    const focusedSideScore = focusedDisciplineSide === "d1" ? player.discipline1Score : player.discipline2Score;
	                    const bestSlots = playerBestSlotSummaryByActivePlayerId.get(player.activePlayerId ?? "") ?? [];
	                    const currentTeamdeckDisciplineLabel =
	                      activeSlot?.disciplineName ??
	                      (focusedDisciplineSide === "d1"
	                        ? context?.matchdayContract?.discipline1?.displayName ?? "D1"
	                        : context?.matchdayContract?.discipline2?.displayName ?? "D2");
	                    const slotIntentLabel =
	                      preferredSlotTags.length > 0
	                        ? preferredSlotTags.join(" / ")
	                        : bestSlots.length > 0
	                          ? bestSlots.map((entry) => `${entry.disciplineSide.toUpperCase()}-${entry.slotIndex + 1}`).join(" / ")
	                          : null;
	                    const primaryDemand = relevantDisciplineDemands[0] ?? null;
	                    return (
	                      <article
	                        key={`draft-card-${player.id}`}
                        className={`legacy-lineup-draft-player-card is-${groupKey}${player.selectedSides.length > 0 ? " is-selected" : ""}${activeSlotCandidate && !activeSlotCandidate.blockReason ? " is-active-slot-fit" : ""}`}
                        draggable={Boolean(player.activePlayerId)}
                        onDragStart={(event) => {
                          if (!player.activePlayerId) {
                            return;
                          }
                          event.dataTransfer.setData("text/plain", player.activePlayerId);
                          handlePlayerCardDragStart(player.activePlayerId);
                        }}
                        onDragEnd={() => setDraggedActivePlayerId(null)}
                        onMouseEnter={() => {
                          if (activeSlot && player.activePlayerId) {
                            setHoveredCandidate({ slotKey: activeSlot.key, activePlayerId: player.activePlayerId });
                          }
                        }}
                        onMouseLeave={() => {
                          if (hoveredCandidate?.activePlayerId === player.activePlayerId) {
                            setHoveredCandidate(null);
                          }
                        }}
                        onClick={() => {
                          if (!player.activePlayerId) {
                            return;
                          }
                          if (activeSlot) {
                            updateSelection(activeSlot.key, player.activePlayerId, { advanceFocusToNextOpenSlot: true });
                            setFocusedDisciplineSide(activeSlot.disciplineSide);
                            return;
                          }
                          assignPlayerToSide(player.activePlayerId, focusedDisciplineSide);
                        }}
                        onDoubleClick={() => openPlayerDetails(player.id, player.activePlayerId)}
                      >
                        {player.portraitUrl ? (
                          <OptimizedMediaImage className="legacy-lineup-draft-player-portrait" src={player.portraitUrl} alt={player.name} width={48} height={48} />
                        ) : (
                          <span className="legacy-lineup-draft-player-portrait">—</span>
                        )}
                        <div className="legacy-lineup-draft-player-main">
                          <div className="legacy-lineup-draft-player-title">
                            <strong>{player.name}</strong>
                            <span>{player.className ?? "—"} · F {Math.round(player.fatigueCount ?? 0)}</span>
                          </div>
                          <div className="legacy-lineup-draft-player-scores">
                            <span className={getDisciplineHeatClass(player.discipline1Score)}>
                              {player.discipline1Label} {formatNullableScore(player.discipline1Score)}
                            </span>
                            <span className={getDisciplineHeatClass(player.discipline2Score)}>
                              {player.discipline2Label} {formatNullableScore(player.discipline2Score)}
                            </span>
                            <span className={getDisciplineHeatClass(activeSlotCandidate?.projectedScore ?? focusedSideScore)}>
                              Slot {formatNullableScore(activeSlotCandidate?.projectedScore ?? focusedSideScore)}
                            </span>
                          </div>
                          <VeloStatOrbitRow
                            ariaLabel={`${player.name} Slot-Fit`}
                            className="legacy-lineup-draft-orbit"
                            stats={{
                              pow: player.discipline1Score ?? 0,
                              spe: player.discipline2Score ?? 0,
                              men: activeSlotCandidate?.projectedScore ?? focusedSideScore ?? 0,
                              soc: Math.max(player.discipline1Score ?? 0, player.discipline2Score ?? 0),
                            }}
                          />
                          {activeSlotCandidate ? (
                            <VeloImpactStrip
                              className="legacy-lineup-fit-strip"
                              items={[
                                {
                                  key: "base",
                                  label: "Base",
                                  value: formatNullableScore(activeSlotCandidate.baseScore ?? null),
                                  tone: "neutral",
                                },
                                {
                                  key: "final",
                                  label: "Final",
                                  value: formatNullableScore(activeSlotCandidate.projectedScore ?? null),
                                  tone: "positive",
                                },
                                {
                                  key: "delta",
                                  label: "Delta",
                                  value:
                                    activeSlotCandidate.scoreDelta != null
                                      ? `${activeSlotCandidate.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(activeSlotCandidate.scoreDelta, 1)}`
                                      : "—",
                                  tone: (activeSlotCandidate.scoreDelta ?? 0) >= 0 ? "positive" : "negative",
                                },
                              ]}
                            />
                          ) : null}
	                          <div className="legacy-lineup-draft-player-tags">
	                            <span>{groupMeta.label}</span>
	                            <span>{activeSlotCandidate?.fitSummary ?? shortReason}</span>
	                            {slotIntentLabel ? (
	                              <span title="Beste Slot-Empfehlungen">
	                                {slotIntentLabel}
	                              </span>
	                            ) : null}
	                            {wantsActiveSlot ? <span title="Der Spieler will genau in diesen Slot oder diese Rolle.">Wunsch {activeSlot?.key?.replace("slot-", "").toUpperCase() ?? currentTeamdeckDisciplineLabel}</span> : null}
	                            {captainDemand ? <span title={captainDemand.detail}>Captain Wunsch</span> : null}
	                            {primaryDemand && !captainDemand ? (
	                              <span key={`draft-demand-${player.id}-${primaryDemand.demandId}`} title={primaryDemand.detail}>
	                                {primaryDemand.label === "Captain-Rolle"
	                                  ? `Will Captain in ${currentTeamdeckDisciplineLabel}`
	                                  : `${currentTeamdeckDisciplineLabel} Wunsch`}
	                              </span>
	                            ) : null}
	                            {activeSlotCandidate?.scoreDelta != null ? (
	                              <span title="Delta gegenüber dem aktuell belegten Slot.">
	                                {activeSlotCandidate.scoreDelta >= 0 ? "+" : ""}{formatDecimalScore(activeSlotCandidate.scoreDelta, 1)}
	                              </span>
	                            ) : null}
	                          </div>
	                        </div>
	                      </article>
                    );
                  })}
                      </div>
                    </section>
                  ))}
              </div>
            </aside>
            </div>
          ) : null}
          {draftBoardView === "lineup" ? (
            <div className={`legacy-lineup-ready-panel is-${lineupSaveCta.tone}`}>
              <div className="legacy-lineup-ready-panel-main">
                <span>Ready Check</span>
                <strong>{lineupSaveCta.label}</strong>
                <small>
                  {lineupReadyToSave
                    ? "Alles klar: speichern und direkt weiter in die Arena."
                    : lineupSaveCta.detail}
                </small>
              </div>
              <div className="legacy-lineup-ready-panel-list" aria-label="Offene oder geklaerte Punkte">
                {lineupFinishItems.map((item) => (
                  <span key={`finish-item-${item.key}`} className={`is-${item.tone}`} title={item.detail}>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                ))}
              </div>
              <div className="legacy-lineup-ready-panel-actions">
                <button
                  className={`primary-button${lineupReadyToSave ? " is-ready" : ""}`}
                  type="button"
                  onClick={() => void handleSaveDraft()}
                  disabled={isBusy || isReadOnly}
                  title={lineupSaveCta.detail}
                >
                  {lineupSaveCta.buttonLabel}
                </button>
                <small>{lineupReadyToSave ? "Enter speichert sofort." : "Klick zeigt genau, was noch fehlt."}</small>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {showExpertBackupPanels ? (
      <LineupExpertPanels enabled={showExpertBackupPanels}>
      <section className="panel legacy-matchday-room-panel">
        <div className="legacy-matchday-room-hero">
          <div className="legacy-matchday-room-team">
            <div className="legacy-matchday-room-logo-wrap">
              {teamLogoUrl ? (
                <OptimizedMediaImage
                  className="legacy-matchday-room-logo"
                  src={teamLogoUrl}
                  alt={`${context?.team.name ?? "Team"} Logo`}
                  width={52}
                  height={52}
                  loading="eager"
                  fetchPriority="high"
                />
              ) : (
                <span className="legacy-matchday-room-logo legacy-matchday-room-logo-fallback">{teamLogoInitials || "TM"}</span>
              )}
            </div>
            <div className="legacy-matchday-room-copy">
              <span className="legacy-matchday-room-kicker">Olympiade der Welten</span>
              <TooltipHeading
                as="h2"
                tooltip="Ein Team im Fokus: Spielerbilder, aktuelle Spieltagswerte und direkte D1/D2-Zuordnung statt nur Dropdown-Arbeit."
              >
                {context?.team.name ?? "Team wählen"}
              </TooltipHeading>
            </div>
          </div>
          <div className="legacy-matchday-room-badges">
            <span className="pill">Spieltag {context?.matchday.index ?? "—"}</span>
            <span className="pill">Team {formatLegacyTeamControlModeLabel(selectedTeamOption?.controlMode)}</span>
            <span className="pill">
              {selectedTeamOption?.controlMode === "ai"
                ? "Automatisches Team ist im normalen Einsatz-Flow standardmaessig ausgeblendet."
                : "Gefuehrtes Team im Fokus"}
            </span>
          </div>
        </div>
        <div className="legacy-matchday-room-kpis">
          <div className="legacy-matchday-room-kpi">
            <span>D1</span>
            <strong>{d1Label}</strong>
            <small>{context?.matchdayContract?.discipline1?.requiredPlayers ?? "—"} Spieler</small>
          </div>
          <div className="legacy-matchday-room-kpi">
            <span>D2</span>
            <strong>{d2Label}</strong>
            <small>{context?.matchdayContract?.discipline2?.requiredPlayers ?? "—"} Spieler</small>
          </div>
          <div className="legacy-matchday-room-kpi">
            <span>Lineup-Fortschritt</span>
            <strong>
              {lineupMeta.d1Selected + lineupMeta.d2Selected}/{(context?.matchdayContract?.discipline1?.requiredPlayers ?? 0) + (context?.matchdayContract?.discipline2?.requiredPlayers ?? 0)}
            </strong>
            <small>aktive Slots</small>
          </div>
          <div className="legacy-matchday-room-kpi">
            <span>Captain</span>
            <strong>{captainSeasonUsedWithDraft}/{captainSeasonLimit}</strong>
            <small>{[captains.d1, captains.d2].filter(Boolean).length} heute · {captainDraftRemaining} uebrig</small>
          </div>
        </div>
      </section>
      </LineupExpertPanels>
      ) : null}

      {showExpertBackupPanels ? (
      <div className="legacy-lineup-main-flow" aria-label="Teamdeck / Assignment">
        <section className="panel legacy-lineup-player-panel">
          <div className="panel-header">
            <div>
              <TooltipHeading
                as="h2"
                tooltip="Spielerbilder und Matchday-Karten bilden jetzt den Hauptflow. D1-lastige Spieler stehen eher links, D2-lastige eher rechts."
              >
                Matchday Room · Lineup Prep
              </TooltipHeading>
              <p className="legacy-lineup-teamdeck-kicker">Kartenpool fuer Drag & Drop</p>
            </div>
            <div className="legacy-matchday-room-badges">
              <span className="pill">
                Aktiv{" "}
                {activeSlot
                  ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}`
                  : focusedDisciplineSide === "d1"
                    ? d1Label
                    : d2Label}
              </span>
              <span className="pill">{teamdeckCandidateEntries.length}/{matchdayRosterCards.length} Spieler</span>
            </div>
          </div>
          <div className={`legacy-lineup-active-slot-strip${activeSlot && !selections[activeSlot.key] ? " is-next-open" : ""}`}>
            <div className="legacy-lineup-active-slot-copy">
              <span>{activeSlot && !selections[activeSlot.key] ? "Hier weiter" : "Teamdeck sortiert fuer"}</span>
              <strong>
                {activeSlot
                  ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1} · ${activeSlotRole?.label ?? "Standard"}`
                  : "naechsten freien Slot"}
              </strong>
              <small>
                {activeSlotIssues[0]?.detail ??
                  (showOnlyTopSlotCandidates ? "Flow-Modus: beste Kandidaten zuerst" : "Scout-Modus: komplette Liste sichtbar")}
              </small>
            </div>
            <div className="legacy-lineup-active-slot-actions">
              <button
                className={`secondary-button inline-button${showOnlyTopSlotCandidates ? " is-selected" : ""}`}
                type="button"
                onClick={() => setShowOnlyTopSlotCandidates((current) => !current)}
              >
                {showOnlyTopSlotCandidates ? "Top 5" : "Alle Kandidaten"}
              </button>
              {activeSlotKey ? (
                <button
                  className="secondary-button inline-button"
                  type="button"
                  onClick={() => setActiveSlotKey(null)}
                >
                  Auto-Fokus
                </button>
              ) : null}
            </div>
          </div>
          {activeSlot && activeSlotSpotlightCandidates.length ? (
            <div className="legacy-lineup-active-candidate-rail" aria-label="Beste Kandidaten fuer aktiven Slot">
              <div className="legacy-lineup-active-candidate-copy">
                <span>Direkt spielbar</span>
                <strong>
                  {activeSlot.disciplineSide.toUpperCase()}-{activeSlot.slotIndex + 1}
                </strong>
              </div>
              <div className="legacy-lineup-active-candidate-list">
                {activeSlotSpotlightCandidates.map((candidate, index) => (
                  <button
                    key={`active-slot-candidate-${activeSlot.key}-${candidate.player.activePlayerId}`}
                    className={`legacy-lineup-active-candidate-button${hoveredCandidate?.slotKey === activeSlot.key && hoveredCandidate.activePlayerId === candidate.player.activePlayerId ? " is-previewed" : ""}`}
                    type="button"
                    onMouseEnter={() => candidate.player.activePlayerId && scheduleHoveredCandidate({ slotKey: activeSlot.key, activePlayerId: candidate.player.activePlayerId })}
                    onMouseLeave={() => setHoveredCandidate(null)}
                    onFocus={() => candidate.player.activePlayerId && scheduleHoveredCandidate({ slotKey: activeSlot.key, activePlayerId: candidate.player.activePlayerId })}
                    onBlur={() => setHoveredCandidate(null)}
                    onClick={() =>
                      candidate.player.activePlayerId &&
                      updateSelection(activeSlot.key, candidate.player.activePlayerId, {
                        advanceFocusToNextOpenSlot: true,
                      })
                    }
                    title={`${candidate.player.name} · ${candidate.groupMeta.label} · ${formatNullableScore(candidate.activeSlotCandidate?.projectedScore)}`}
                  >
                    <span>#{index + 1}</span>
                    <strong>{candidate.player.name}</strong>
                    <small>
                      {candidate.groupMeta.label} · {formatNullableScore(candidate.activeSlotCandidate?.projectedScore)}
                      {candidate.activeSlotCandidate?.scoreDelta != null
                        ? ` · ${candidate.activeSlotCandidate.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(candidate.activeSlotCandidate.scoreDelta, 1)}`
                        : ""}
                    </small>
                    <LegacyLineupCandidateReasonChips
                      chips={buildCandidateAxisReasonChips(slotRoleByKey.get(activeSlot.key) ?? null, candidate.player)}
                    />
                    <em>{candidate.activeSlotCandidate?.fitSummary ?? candidate.detail}</em>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {hoveredCandidatePreview ? (
	            <div className={`legacy-lineup-candidate-preview${hoveredCandidatePreview.blockReason ? " is-blocked" : hoveredCandidatePreview.scoreDelta != null && hoveredCandidatePreview.scoreDelta >= 0 ? " is-positive" : " is-negative"}`}>
	              <div className="legacy-lineup-candidate-preview-main">
	                <span>{hoveredCandidatePreview.slotLabel} · {hoveredCandidatePreview.roleLabel}</span>
	                <strong>{hoveredCandidatePreview.playerName}</strong>
	              </div>
              <div className="legacy-lineup-candidate-preview-metrics">
                <span>
                  Score <strong>{formatNullableScore(hoveredCandidatePreview.projectedScore)}</strong>
                </span>
                <span>
                  Delta{" "}
                  <strong>
                    {hoveredCandidatePreview.scoreDelta != null
                      ? `${hoveredCandidatePreview.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(hoveredCandidatePreview.scoreDelta, 1)}`
                      : "—"}
                  </strong>
                </span>
                <span>
                  Base <strong>{formatNullableScore(hoveredCandidatePreview.baseScore)}</strong>
                </span>
                <span>
                  Fatigue <strong>{formatSignedCompactInteger(hoveredCandidatePreview.additionalFatigue)}</strong>
                </span>
              </div>
	              <small>
	                {formatLegacyLineupDragBlockReason(hoveredCandidatePreview.blockReason) ??
	                  hoveredCandidatePreview.warnings[0] ??
	                  hoveredCandidatePreview.fitDetail ??
	                  "passt sauber in den aktiven Slot"}
	              </small>
	              <small className="legacy-lineup-candidate-preview-callout">
	                Captain {hoveredCandidatePreview.captainEffect} · Risiko {hoveredCandidatePreview.riskLabel}
	                {hoveredCandidatePreview.wishLabel ? ` · ${hoveredCandidatePreview.wishLabel}` : ""}
	              </small>
	            </div>
	          ) : null}
          <div className="legacy-lineup-deck-filter" role="group" aria-label="Teamdeck Filter">
            {([
              { value: "all" as const, label: "Alle" },
              { value: "free" as const, label: "Frei" },
              { value: "assigned" as const, label: "Eingesetzt" },
              { value: "blocked" as const, label: "Blockiert" },
            ]).map((option) => (
              <button
                key={option.value}
                className={`secondary-button inline-button${teamdeckFilterMode === option.value ? " is-selected" : ""}`}
                type="button"
                onClick={() => setTeamdeckFilterMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="legacy-lineup-deck-filter" role="group" aria-label="Teamdeck Sortierung">
            {([
              { value: "top" as const, label: "Top Fit" },
              { value: "d1" as const, label: d1Label },
              { value: "d2" as const, label: d2Label },
              { value: "captain" as const, label: "Captain" },
              { value: "fatigue" as const, label: "Low Fatigue" },
              { value: "wish" as const, label: "Wunsch" },
            ]).map((option) => (
              <button
                key={option.value}
                className={`secondary-button inline-button${teamdeckSortMode === option.value ? " is-selected" : ""}`}
                type="button"
                onClick={() => setTeamdeckSortMode(option.value)}
                title={`Sortiert die Kandidaten nach ${option.label}.`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="legacy-matchday-lane-grid">
            {teamdeckCandidateGroups.map((group) => (
              <section key={group.key} className={`legacy-matchday-lane legacy-lineup-candidate-group legacy-lineup-candidate-group-${group.key}`}>
                <div className="legacy-matchday-lane-head">
                  <div className="legacy-lineup-candidate-group-copy">
                    <TooltipHeading as="h3" tooltip={group.meta.description}>
                      {group.meta.label}
                    </TooltipHeading>
                    <p className="legacy-lineup-candidate-group-desc">
                      {group.meta.description}
                    </p>
                  </div>
                  <span className="legacy-matchday-lane-count">{group.totalCount}</span>
                </div>
                <LegacyLineupVirtualCardGrid
                    className="legacy-matchday-card-grid legacy-matchday-card-grid-lane"
                    items={group.entries}
                    renderItem={({ player, activeSlotCandidate, detail, groupMeta, shortReason, groupKey, preferredSlotTags, captainDemand, wantsActiveSlot, relevantDisciplineDemands }) => {
                    const focusedSideScore = focusedDisciplineSide === "d1" ? player.discipline1Score : player.discipline2Score;
                    const roleInsight = resolveBestCardRoleInsight(
                      slotRolesByDisciplineSide[focusedDisciplineSide],
                      player.attributeStats,
                      focusedSideScore,
                      player.fatigueCount,
                    );
                    const assignmentLabel = player.selectedSides.length > 0 ? `Aktiv in ${player.selectedSides.join(" + ").toUpperCase()}` : "Verfuegbar";
                    const isPreviewedCandidate = Boolean(
                      activeSlot &&
                        player.activePlayerId &&
                        hoveredCandidate?.slotKey === activeSlot.key &&
                        hoveredCandidate.activePlayerId === player.activePlayerId,
                    );
                    return (
                      <article
                        key={`card-${player.id}`}
                        className={`legacy-matchday-player-card${player.selectedSides.length > 0 ? " is-selected" : ""}${activeSlotCandidate && !activeSlotCandidate.blockReason ? " is-active-slot-fit" : ""}${isPreviewedCandidate ? " is-previewed" : ""}`}
                        draggable={Boolean(player.activePlayerId)}
                        title={[
                          `${player.discipline1Label}: ${player.topAttributesD1.map((attribute) => `${attribute.shortLabel} ${attribute.ratingLabel ?? "—"}`).join(" · ")}`,
                          `${player.discipline2Label}: ${player.topAttributesD2.map((attribute) => `${attribute.shortLabel} ${attribute.ratingLabel ?? "—"}`).join(" · ")}`,
                          roleInsight?.role
                            ? `Fokus ${focusedDisciplineSide.toUpperCase()}: ${roleInsight.role.label} · ${roleInsight.keyValues.map((attribute) => `${attribute.shortLabel} ${attribute.value ?? "—"} (${formatDecimalScore(attribute.weightPct, 1)}%)`).join(" · ")}`
                            : "Kein Rollenprofil",
                        ].join("\n")}
                        onDragStart={(event) => {
                          if (!player.activePlayerId) {
                            return;
                          }
                          event.dataTransfer.setData("text/plain", player.activePlayerId);
                          handlePlayerCardDragStart(player.activePlayerId);
                        }}
                        onDragEnd={() => setDraggedActivePlayerId(null)}
                        onMouseEnter={() => {
                          if (activeSlot && player.activePlayerId) {
                            setHoveredCandidate({ slotKey: activeSlot.key, activePlayerId: player.activePlayerId });
                          }
                        }}
                        onMouseLeave={() => {
                          if (hoveredCandidate?.activePlayerId === player.activePlayerId) {
                            setHoveredCandidate(null);
                          }
                        }}
                        onClick={() => {
                          if (!player.activePlayerId) {
                            return;
                          }
                          if (activeSlot) {
                            updateSelection(activeSlot.key, player.activePlayerId, { advanceFocusToNextOpenSlot: true });
                            setFocusedDisciplineSide(activeSlot.disciplineSide);
                            return;
                          }
                          assignPlayerToSide(player.activePlayerId, focusedDisciplineSide);
                        }}
                        onDoubleClick={() => openPlayerDetails(player.id, player.activePlayerId)}
                      >
                        <div className="legacy-matchday-player-head">
                          {player.portraitUrl ? (
                            <OptimizedMediaImage
                              className="legacy-matchday-player-portrait"
                              src={player.portraitUrl}
                              alt={player.name}
                              width={56}
                              height={56}
                            />
                          ) : (
                            <span className="legacy-matchday-player-portrait legacy-matchday-player-portrait-fallback">—</span>
                          )}
                          <div className="legacy-matchday-player-title">
                            <strong>{player.name}</strong>
                            <span>{player.className ?? "—"} · {player.contractLength ?? "—"} Jahre</span>
                            <span>{assignmentLabel}</span>
                          </div>
                        </div>
                        <div className="legacy-matchday-player-score-row">
                          <span className={`legacy-matchday-player-score-chip ${getDisciplineHeatClass(player.discipline1Score)}`}>
                            {player.discipline1Label}: {formatNullableScore(player.discipline1Score)}
                          </span>
                          <span className={`legacy-matchday-player-score-chip ${getDisciplineHeatClass(player.discipline2Score)}`}>
                            {player.discipline2Label}: {formatNullableScore(player.discipline2Score)}
                          </span>
                        </div>
                        <div className="legacy-matchday-player-meta-row">
                          <span className="legacy-matchday-player-score-chip">
                            {player.fitLane === "d1" ? "D1 Fit" : player.fitLane === "d2" ? "D2 Fit" : "Flex Fit"}
                          </span>
                          <span className={`legacy-matchday-player-score-chip is-quality-${groupKey}`}>
                            {groupMeta.label}
                          </span>
                          {activeSlotCandidate ? (
                            <span
                              className={`legacy-matchday-player-score-chip is-active-slot-chip ${activeSlotCandidate.blockReason ? "is-heat-low" : getDisciplineHeatClass(activeSlotCandidate.projectedScore)}`}
                              title={
                                activeSlotCandidate.blockReason
                                  ? formatLegacyLineupDragBlockReason(activeSlotCandidate.blockReason) ?? "passt nicht"
                                  : `Aktiver Slot · Score ${formatNullableScore(activeSlotCandidate.projectedScore)}`
                              }
                            >
                              {activeSlotCandidate.blockReason
                                ? "Slot: nein"
                                : `Slot ${formatNullableScore(activeSlotCandidate.projectedScore)}${
                                    activeSlotCandidate.scoreDelta != null
                                      ? ` ${activeSlotCandidate.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(activeSlotCandidate.scoreDelta, 1)}`
                                      : ""
                                  }`}
                            </span>
                          ) : null}
                          <span className={`legacy-matchday-player-score-chip ${getFatigueHeatClass(player.fatigueCount)}`}>
                            {formatFatigueHint(
                              Math.max(player.discipline1Score ?? 0, player.discipline2Score ?? 0),
                              player.fatigueCount,
                            )}
                          </span>
                          {wantsActiveSlot ? (
                            <span
                              className="legacy-matchday-player-score-chip is-active-slot-chip"
                              title="Dieser Spieler will genau in diesen Slot oder diese Rolle."
                            >
                              Wunsch {activeSlot?.disciplineSide?.toUpperCase() ?? focusedDisciplineSide.toUpperCase()}-{(activeSlot?.slotIndex ?? 0) + 1}
                            </span>
                          ) : null}
                          {!wantsActiveSlot && preferredSlotTags.length > 0 ? (
                            <span className="legacy-matchday-player-score-chip" title="Beste empfohlene Slots fuer diesen Spieler.">
                              {preferredSlotTags.join(" / ")}
                            </span>
                          ) : null}
                          {player.captainEligible ? <span className="legacy-matchday-player-score-chip">Captain moeglich</span> : null}
                          {captainDemand ? (
                            <span className="legacy-matchday-player-score-chip is-active-slot-chip" title={captainDemand.detail}>
                              Captain-Wunsch
                            </span>
                          ) : null}
                          {player.demands.slice(0, 2).map((demand) => (
                            <span
                              key={`card-demand-${player.id}-${demand.demandId}`}
                              className={`legacy-matchday-player-score-chip ${
                                demand.targetDisciplineId === context?.matchdayContract?.discipline1?.disciplineId ||
                                demand.targetDisciplineId === context?.matchdayContract?.discipline2?.disciplineId
                                  ? "is-active-slot-chip"
                                  : ""
                              }`}
                              title={demand.detail}
                            >
                              Wunsch: {demand.label}
                            </span>
                          ))}
                          {player.injuryStatus && player.injuryStatus !== "healthy" ? (
                            <span className="legacy-matchday-player-score-chip is-heat-low">
                              {player.injuryStatus === "recovering" ? "Recovery" : "Verletzt"}
                            </span>
                          ) : null}
                        </div>
                        <div className="legacy-matchday-player-summary-grid">
                          <div className="legacy-matchday-player-summary-card">
                            <span>Beste Slots</span>
                            <strong>
                              {(playerBestSlotSummaryByActivePlayerId.get(player.activePlayerId ?? "") ?? [])
                                .map((entry) => `${entry.disciplineSide.toUpperCase()}-${entry.slotIndex + 1}`)
                                .join(" · ") || "—"}
                            </strong>
                            <small>
                              {(playerBestSlotSummaryByActivePlayerId.get(player.activePlayerId ?? "") ?? [])
                                .map((entry) => formatNullableScore(entry.projectedScore))
                                .join(" / ") || "Keine Projektion"}
                            </small>
                          </div>
                          <div className="legacy-matchday-player-summary-card">
                            <span>Status</span>
                            <strong>
                              {activeSlot ? groupMeta.label : player.availabilityBlocker
                                ? "Blockiert"
                                : player.injuryStatus === "recovering"
                                  ? "Recovery"
                                  : "Verfuegbar"}
                            </strong>
                            <small>
                              {activeSlot
                                ? `${detail} · ${shortReason}${relevantDisciplineDemands.length > 0 ? ` · ${relevantDisciplineDemands[0]?.label === "Captain-Rolle" ? "Captain-Wunsch" : "Diszi-Wunsch"}` : ""}`
                                : player.injuryRiskLabel ?? formatFatigueHint(Math.max(player.discipline1Score ?? 0, player.discipline2Score ?? 0), player.fatigueCount)}
                            </small>
                          </div>
                        </div>
                        {roleInsight?.role ? (
                          <div
                            className="legacy-matchday-player-role-strip"
                            title={`${roleInsight.role.label} · ${roleInsight.role.description} · ${roleInsight.keyValues.map((attribute) => `${attribute.shortLabel} ${formatDecimalScore(attribute.weightPct, 1)}%${attribute.deltaPct ? ` (${attribute.deltaPct > 0 ? "+" : ""}${formatDecimalScore(attribute.deltaPct, 1)})` : ""}`).join(" · ")}`}
                          >
                            <div className="legacy-matchday-player-role-values">
                              {roleInsight.keyValues.slice(0, 4).map((attribute) => (
                                <span
                                  key={`${roleInsight.role?.roleId}-${attribute.key}`}
                                  className={`legacy-matchday-player-attribute-pill ${attribute.emphasis === "support" ? "is-strain" : "is-positive"}`}
                                >
                                  {attribute.shortLabel} {attribute.value ?? "—"}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="legacy-matchday-player-actions">
                          {activeSlot ? (
                            <button
                              className="secondary-button inline-button"
                              type="button"
                              disabled={!player.activePlayerId || Boolean(activeSlotCandidate?.blockReason)}
                              title={
                                !player.activePlayerId
                                  ? "Dieser Spieler ist gerade nicht verfuegbar."
                                  : activeSlotCandidate?.blockReason
                                    ? formatLegacyLineupDragBlockReason(activeSlotCandidate.blockReason) ?? "Passt gerade nicht legal in den aktiven Slot."
                                    : "Setzt den Spieler direkt in den aktiven Slot."
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                player.activePlayerId &&
                                  updateSelection(activeSlot.key, player.activePlayerId, {
                                    advanceFocusToNextOpenSlot: true,
                                  });
                              }}
                            >
                              In aktiven Slot
                            </button>
                          ) : (
                            <>
                              <button
                                className="secondary-button inline-button"
                                type="button"
                                disabled={!player.activePlayerId}
                                title={player.selectedSides.includes("d1") ? "Entfernt den Spieler wieder aus D1." : "Setzt den Spieler direkt in D1."}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  player.activePlayerId && assignPlayerToSide(player.activePlayerId, "d1");
                                }}
                              >
                                {player.selectedSides.includes("d1") ? "Aus D1" : "Zu D1"}
                              </button>
                              <button
                                className="secondary-button inline-button"
                                type="button"
                                disabled={!player.activePlayerId}
                                title={player.selectedSides.includes("d2") ? "Entfernt den Spieler wieder aus D2." : "Setzt den Spieler direkt in D2."}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  player.activePlayerId && assignPlayerToSide(player.activePlayerId, "d2");
                                }}
                              >
                                {player.selectedSides.includes("d2") ? "Aus D2" : "Zu D2"}
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                    }}
                  />
                  {group.entries.length === 0 ? (
                    <div className="legacy-matchday-lane-empty">
                      <span>Keine Spieler in dieser Gruppe.</span>
                    </div>
                  ) : null}
              </section>
            ))}
          </div>
        </section>

        <section className="legacy-lineup-discipline-board">
          <div className="legacy-lineup-discipline-board-head">
            <div>
              <TooltipHeading
                as="h2"
                tooltip="Der Matchday Room bleibt der Vorbereitungsraum. Die spätere Matchday Arena / Reveal View startet erst nach Preview oder Resolve als eigene Phase."
              >
                Slot-Board
              </TooltipHeading>
            </div>
            <div className="legacy-lineup-board-active-slot">
              <span>Aktiver Slot</span>
              <strong>
                {activeSlot
                  ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1} · ${activeSlotRole?.label ?? "Standard"}`
                  : "Auto"}
              </strong>
            </div>
            <div className="legacy-lineup-focus-switch">
              <button
                className={`secondary-button inline-button${focusedDisciplineSide === "d1" ? " is-selected" : ""}`}
                type="button"
                onClick={() => focusDisciplineSide("d1")}
              >
                Fokus {d1Label}
              </button>
              <button
                className={`secondary-button inline-button${focusedDisciplineSide === "d2" ? " is-selected" : ""}`}
                type="button"
                onClick={() => focusDisciplineSide("d2")}
              >
                Fokus {d2Label}
              </button>
            </div>
          </div>
          <section className="legacy-lineup-discipline-grid">
            {(["d1", "d2"] as const).map((disciplineSide) => {
              const discipline =
                disciplineSide === "d1" ? context?.matchdayContract?.discipline1 ?? null : context?.matchdayContract?.discipline2 ?? null;
              const sideSlots = slots.filter((slot) => slot.disciplineSide === disciplineSide);
              const sidePreview = resolvedPreview?.disciplineSideScores.find((entry) => entry.disciplineSide === disciplineSide) ?? null;
              const sideWeightInfo = disciplineSide === "d1" ? disciplineWeightInfo.d1 : disciplineWeightInfo.d2;
              const disciplineToneClass = getDisciplineToneClass(discipline?.category ?? null);
              const disciplineColor = getFormCardColorForCategory(discipline?.category ?? null);
              const disciplineColorClass = disciplineColor ? `is-discipline-${disciplineColor}` : "is-discipline-neutral";
              const captainOptions = getCaptainOptionsForSide(disciplineSide);
              const captainSelectEntries = getCaptainSelectEntriesForSide(disciplineSide);
              const suggestedCaptain = captainOptions[0] ?? null;
              const captainInfoByActivePlayerId = new Map(
                captainCandidateInfoBySide[disciplineSide].map((info) => [info.activePlayerId, info] as const),
              );
              const selectedCaptainInfo = captains[disciplineSide]
                ? captainInfoByActivePlayerId.get(captains[disciplineSide]) ?? null
                : null;
              const suggestedCaptainInfo = suggestedCaptain
                ? captainInfoByActivePlayerId.get(suggestedCaptain.activePlayerId) ?? null
                : null;
              const selectedPrimaryFormCard = getSelectedFormCardOption(modifiers[disciplineSide].primaryFormCardId);
              const selectedSecondaryFormCard = getSelectedFormCardOption(modifiers[disciplineSide].secondaryFormCardId);
              const selectedSidePower = getSelectedTeamPowerOption(modifiers[disciplineSide].teamPowerId);
              const selectedSidePowerBreakdown = selectedSidePower
                ? getTeamPowerProjectedBreakdown(selectedSidePower, disciplineSide, discipline?.disciplineId, discipline?.category)
                : null;
              const sideIntensity = getDisciplineIntensity(disciplineSide);
              const sideIntensityConfig = getMatchdayIntensityConfig(sideIntensity);
              const sideDemandCount = sideSlots.reduce((sum, slot) => {
                const selectedRosterCard = rosterCardByActivePlayerId.get(selections[slot.key] ?? "");
                return (
                  sum +
                  (selectedRosterCard?.demands.filter((demand) => !demand.targetDisciplineId || demand.targetDisciplineId === slot.disciplineId).length ?? 0)
                );
              }, 0);
              const sideRivalryPressure = sideSlots.some((slot) => getRivalryPressureForDiscipline(slot.disciplineId));

              return (
                <section
                  key={disciplineSide}
                  id={`lineup-side-${disciplineSide}`}
                  className={`panel legacy-lineup-side-panel ${disciplineSide === "d1" ? "legacy-lineup-side-panel-d1" : "legacy-lineup-side-panel-d2"} ${disciplineToneClass} ${disciplineColorClass}${focusedDisciplineSide === disciplineSide ? " is-focused" : ""}`}
                >
                  <div className="legacy-lineup-side-header">
                    <div>
                      <h3>
                        {discipline?.displayName ?? "—"} ({discipline?.requiredPlayers ?? "—"} Spieler)
                      </h3>
                      <p className="muted">
                        Ranks: {discipline?.displayName ?? "—"} {context?.teamDisciplineRanks?.[discipline?.disciplineId ?? ""]?.rank ?? "—"} (
                        {discipline?.requiredPlayers ?? "—"})
                      </p>
                      <p className="legacy-lineup-weight-band">{formatWeightInfo(sideWeightInfo)}</p>
                    </div>
                    <span className="legacy-lineup-side-progress">
                      {disciplineSide === "d1" ? lineupMeta.d1Selected : lineupMeta.d2Selected}/{discipline?.requiredPlayers ?? "—"}
                    </span>
                  </div>
                  <div className="legacy-lineup-side-meta">
                    <span>
                      <strong>Saisonstatus:</strong> {context?.teamStatus?.lineupFilledCount ?? 0}/{context?.teamStatus?.totalLineupSides ?? "—"}
                    </span>
                    <span>
                      <strong>Room jetzt:</strong> {disciplineSide === "d1" ? lineupMeta.d1Selected : lineupMeta.d2Selected}/{discipline?.requiredPlayers ?? "—"}
                    </span>
                    <span>
                      <strong>Gespeichert:</strong> {(draft?.entries ?? []).filter((entry) => entry.disciplineSide === disciplineSide).length}/{discipline?.requiredPlayers ?? "—"}
                    </span>
                    <span>
                      <strong>Captain:</strong> {captains[disciplineSide] ? "gesetzt" : "offen"}
                    </span>
                    <span>
                      <strong>Budget:</strong> {captainSeasonUsedWithDraft}/{captainSeasonLimit} Saison · {captainDraftRemaining} uebrig
                    </span>
                  </div>
                  <div className="legacy-lineup-side-body legacy-lineup-arena-slot-grid">
                    <div className="legacy-lineup-captain-strip">
                      <div onDoubleClick={() => openPlayerDetailsForActivePlayer(captains[disciplineSide])}>
                        <span>Captain-Ressource</span>
                        <strong>{captains[disciplineSide] ? getSelectedOptionMeta(captains[disciplineSide])?.name ?? "gesetzt" : "offen"}</strong>
                        <small>
                          {selectedCaptainInfo
                            ? `Beitrag +${formatNullableScore(selectedCaptainInfo.estimatedCaptainBonus)} · ${
                                selectedCaptainInfo.moraleReward != null
                                  ? `Moral +${formatDecimalScore(selectedCaptainInfo.moraleReward, 1)}`
                                  : "keine Captain-Forderung"
                              }`
                            : suggestedCaptain
                              ? captainDraftRemaining > 0 || captains[disciplineSide]
                                ? `Vorschlag: +${formatNullableScore(suggestedCaptainInfo?.estimatedCaptainBonus ?? null)} Captain · ${
                                    suggestedCaptainInfo?.moraleReward != null
                                      ? `Moral +${formatDecimalScore(suggestedCaptainInfo.moraleReward, 1)}`
                                      : "keine Captain-Forderung"
                                  }`
                                : `Saisonlimit ${captainSeasonLimit}/${captainSeasonLimit} erreicht`
                              : "Erst Spieler in Slots setzen"}
                        </small>
                        <div className="legacy-lineup-captain-resource-meter" aria-label={`Captain Budget ${captainSeasonUsedWithDraft} von ${captainSeasonLimit}`}>
                          {Array.from({ length: captainSeasonLimit }).map((_, index) => {
                            const slotNumber = index + 1;
                            const isSpent = slotNumber <= captainUsedBeforeCurrentDraft;
                            const isDraft = slotNumber > captainUsedBeforeCurrentDraft && slotNumber <= captainSeasonUsedWithDraft;
                            return (
                              <span
                                key={`${disciplineSide}-captain-budget-${slotNumber}`}
                                className={`${isSpent ? "is-spent" : ""} ${isDraft ? "is-draft" : ""}`.trim()}
                                title={isSpent ? "Schon vor diesem Draft verbraucht" : isDraft ? "Wird verbraucht, wenn du speicherst" : "Noch frei"}
                              />
                            );
                          })}
                          <small>{captainSeasonUsedWithDraft}/{captainSeasonLimit} nach Save</small>
                        </div>
                        <small className="legacy-lineup-captain-note">
                          {captains[disciplineSide]
                            ? "Verbraucht beim Speichern 1 von 3 Saison-Captains. Lohnt sich nur, wenn der Swing Ränge oder Forderung/Happiness rettet."
                            : captainDraftRemaining > 0
                              ? "Captain ist optional und wertvoll: Auto-Fill setzt keinen. Erst setzen, wenn Beitrag, Forderung oder Rivalendruck es rechtfertigen."
                              : "Kein freier Captain mehr: entferne einen Draft-Captain oder spare die Ressource fuer spaeter."}
                        </small>
                      </div>
                      <div className="legacy-lineup-captain-impact-grid">
                        <span>
                          <strong>{selectedCaptainInfo ? `+${formatNullableScore(selectedCaptainInfo.estimatedCaptainBonus)}` : suggestedCaptainInfo ? `+${formatNullableScore(suggestedCaptainInfo.estimatedCaptainBonus)}` : "—"}</strong>
                          <small>Score-Wirkung</small>
                        </span>
                        <span>
                          <strong>
                            {selectedCaptainInfo?.moraleReward != null
                              ? `+${formatDecimalScore(selectedCaptainInfo.moraleReward, 1)}`
                              : suggestedCaptainInfo?.moraleReward != null
                                ? `+${formatDecimalScore(suggestedCaptainInfo.moraleReward, 1)}`
                                : "—"}
                          </strong>
                          <small>Happiness</small>
                        </span>
                        <span className={captainDraftRemaining <= 0 && !captains[disciplineSide] ? "is-warning" : ""}>
                          <strong>{captainDraftRemaining}</strong>
                          <small>frei im Draft</small>
                        </span>
                        <span className={captains[disciplineSide] ? "is-warning" : ""}>
                          <strong>{captains[disciplineSide] ? "hoch" : "kontrolliert"}</strong>
                          <small>Ressourcen-Risiko</small>
                        </span>
                      </div>
                      <div className="legacy-lineup-captain-actions">
                        <select
                          className="input"
                          value={captains[disciplineSide]}
                          onChange={(event) => updateCaptain(disciplineSide, event.target.value)}
                          disabled={isReadOnly || captainSelectEntries.length === 0}
                          title={
                            captainSelectEntries.length === 0
                              ? "Setze zuerst mindestens einen Spieler auf dieser Seite ein."
                              : `${captainDraftRemaining} Captain-Einsatz${captainDraftRemaining === 1 ? "" : "e"} fuer diesen Draft uebrig`
                          }
                        >
                          <option value="">Kein Captain</option>
                          {captainSelectEntries.map((entry) => {
                            const info = captainInfoByActivePlayerId.get(entry.activePlayerId);
                            return (
                              <option key={entry.activePlayerId} value={entry.activePlayerId}>
                                {entry.name} · Captain +{formatNullableScore(info?.estimatedCaptainBonus ?? null)}
                                {info?.moraleReward != null ? ` · Moral +${formatDecimalScore(info.moraleReward, 1)}` : " · keine Forderung"}
                              </option>
                            );
                          })}
                        </select>
                        <button
                          className="secondary-button inline-button"
                          type="button"
                          disabled={
                            !suggestedCaptain ||
                            captains[disciplineSide] === suggestedCaptain.activePlayerId ||
                            (!captains[disciplineSide] && captainDraftRemaining <= 0)
                          }
                          onClick={() => suggestedCaptain && updateCaptain(disciplineSide, suggestedCaptain.activePlayerId)}
                        >
                          Vorschlag bewusst setzen
                        </button>
                      </div>
                    </div>
                    <div className="legacy-lineup-side-lever-strip" aria-label={`${disciplineSide.toUpperCase()} Matchday-Hebel`}>
                      <span className={`legacy-lineup-side-lever-card is-intensity-${sideIntensity}`}>
                        <small>Einsatz</small>
                        <strong>{formatIntensityStageLabel(sideIntensity)}</strong>
                        <em>Score {formatSignedCompactInteger(sideIntensityConfig.scoreModifier)} · Fatigue +{formatScore(sideIntensityConfig.fatigueBase)}</em>
                      </span>
                      <span className="legacy-lineup-side-lever-card is-form">
                        <small>Formkarten</small>
                        <strong>
                          {selectedPrimaryFormCard ? formatFormCardValueLabel(selectedPrimaryFormCard.value) : "—"}
                          {selectedSecondaryFormCard ? ` / ${formatFormCardValueLabel(selectedSecondaryFormCard.value)}` : ""}
                        </strong>
                        <em>
                          {[
                            selectedPrimaryFormCard ? `${formatFormCardColorLabel(selectedPrimaryFormCard.color)} F1` : null,
                            selectedSecondaryFormCard ? `${formatFormCardColorLabel(selectedSecondaryFormCard.color)} F2` : null,
                          ].filter(Boolean).join(" · ") || "keine Karte aktiv"}
                        </em>
                      </span>
                      <span className={`legacy-lineup-side-lever-card ${selectedSidePower ? "is-power" : ""}`}>
                        <small>Team Power</small>
                        <strong>{selectedSidePower ? selectedSidePower.label : "—"}</strong>
                        <em>
                          {selectedSidePower && selectedSidePowerBreakdown
                            ? `${getTeamPowerEffectLabel(selectedSidePower)} ${selectedSidePowerBreakdown.basePct > 0 ? "+" : ""}${formatDecimalScore(selectedSidePowerBreakdown.basePct, 1)}% · ${selectedSidePower.chargesRemaining}/${selectedSidePower.chargesTotal}`
                            : "keine Power aktiv"}
                        </em>
                      </span>
                      <span className={`legacy-lineup-side-lever-card ${sideDemandCount ? "is-demand" : ""}`}>
                        <small>Forderungen</small>
                        <strong>{sideDemandCount}</strong>
                        <em>{sideDemandCount ? "direkt in Slots relevant" : "keine aktiven Slot-Wuensche"}</em>
                      </span>
                      <span className={`legacy-lineup-side-lever-card ${sideRivalryPressure ? "is-rivalry" : ""}`}>
                        <small>Rivalen</small>
                        <strong>{sideRivalryPressure ? "aktiv" : "—"}</strong>
                        <em>{sideRivalryPressure ? "Push streut riskanter" : "kein Rivalitaetsdruck"}</em>
                      </span>
                    </div>
                    {disciplineIssuesBySide[disciplineSide].length > 0 ? (
                      <div className="legacy-lineup-side-issue-strip" aria-label={`${disciplineSide.toUpperCase()} Hinweise`}>
                        {disciplineIssuesBySide[disciplineSide].slice(0, 4).map((issue) => (
                          <span key={`${disciplineSide}-${issue.label}-${issue.detail}`} className={`legacy-lineup-side-issue-chip is-${issue.tone}`}>
                            <strong>{issue.label}</strong>
                            <small>{issue.detail}</small>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {sideSlots.map((slot) => (
                      <label
                        key={slot.key}
                        id={`lineup-slot-${slot.key}`}
                        className={`legacy-lineup-lab-slot-row legacy-lineup-slot-dropzone legacy-lineup-arena-slot ${disciplineColorClass} ${draggedActivePlayerId ? "is-drop-ready" : ""} ${activeSlot?.key === slot.key ? "is-active-slot" : ""} ${nextOpenSlotKey === slot.key ? "is-next-target" : ""} ${activeMissingHighlightKey && !selections[slot.key] ? "is-missing-highlight" : ""} ${recentlyAssignedSlotKey === slot.key ? "is-recently-assigned" : ""} ${selections[slot.key] && activeSlot?.key !== slot.key && !slotDragPreviewByKey.get(slot.key) ? "is-compact" : ""} ${getDragFitTierClass(slotDragPreviewByKey.get(slot.key)?.fitTier ?? null)}`.trim()}
                        onClick={() => {
                          setActiveSlotKey(slot.key);
                          setFocusedDisciplineSide(slot.disciplineSide);
                        }}
                        onDoubleClick={() => openPlayerDetailsForActivePlayer(selections[slot.key])}
                        onDragOver={(event) => {
                          const dragPreview = slotDragPreviewByKey.get(slot.key) ?? null;
                          if (dragPreview?.blockReason) {
                            return;
                          }
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleDropOnSlot(slot.key, event.dataTransfer.getData("text/plain") || draggedActivePlayerId);
                        }}
                        title={(() => {
                          const dragPreview = slotDragPreviewByKey.get(slot.key) ?? null;
                          if (!dragPreview || !draggedActivePlayerId) {
                            return undefined;
                          }
                          const blockerLabel = formatLegacyLineupDragBlockReason(dragPreview.blockReason);
                          return [
                            blockerLabel ? `Blocker: ${blockerLabel}` : "Drop möglich",
                            `Projected Score: ${dragPreview.projected.totalProjected != null ? formatScore(dragPreview.projected.totalProjected) : "—"}`,
                            `Score Δ: ${dragPreview.scoreDelta != null ? `${dragPreview.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(dragPreview.scoreDelta, 1)}` : "—"}`,
                            `Base: ${dragPreview.projected.baseScore != null ? formatScore(dragPreview.projected.baseScore) : "—"}`,
                            `Fatigue: -${formatDecimalScore(dragPreview.projected.fatigueModifier ?? 0, 1)} (${Math.round(dragPreview.projected.fatiguePenaltyPercent ?? 0)}%)`,
                            `Form: Preview benutzt den aktuellen Save-Stand; Detailbonus kommt nach Revalidate`,
                            `Captain: ${captainSideByActivePlayerId.get(dragPreview.activePlayerId) ? "bereits anders gebunden" : "frei"}`,
                            `Mutator: Nach Drop über bestehende Preview aktualisiert`,
                            dragPreview.slotRuleLabel ?? "Slot-Regel: Standard",
                          ].join("\n");
                        })()}
                        aria-disabled={Boolean(slotDragPreviewByKey.get(slot.key)?.blockReason)}
                      >
                        {(() => {
                          const selectedOption = getSelectedOptionMeta(selections[slot.key]);
                          const selectedScore = getSelectedOptionScore(selectedOption, slot.disciplineId);
                          const selectedRosterCard = rosterCardByActivePlayerId.get(selections[slot.key] ?? "");
                          const sideEntry =
                            sidePreview?.entries.find(
                              (entry) =>
                                entry.slotIndex === slot.slotIndex &&
                                (!selectedRosterCard || entry.playerId === selectedRosterCard.id),
                            ) ?? null;
                          const moraleScoreEffect = sideEntry?.moraleModifier ?? null;
                          const moralePercentEffect = sideEntry?.moraleModifierPct ?? null;
                          const moraleValue = sideEntry?.morale ?? null;
                          const slotPreview = slotPreviewByKey.get(slot.key) ?? null;
                          const slotCandidateSummary = slotCandidateSummaryByKey.get(slot.key) ?? null;
                          const dragPreview = slotDragPreviewByKey.get(slot.key) ?? null;
                          const role = slotRoleByKey.get(slot.key) ?? null;
                          const isActiveSlot = activeSlot?.key === slot.key;
                          const isCompactSlot = Boolean(selectedRosterCard) && !isActiveSlot && !dragPreview;
                          const intensity = getDisciplineIntensity(slot.disciplineSide);
                          const intensityConfig = getMatchdayIntensityConfig(intensity);
                          const slotReadiness = getSlotReadiness(slotPreview, selectedScore);
                          const isMissingHighlighted = Boolean(activeMissingHighlightKey && !selections[slot.key]);
                          const selectedMoraleDecisions = selectedRosterCard?.activePlayerId
                            ? (moraleDecisionsByActivePlayerId.get(selectedRosterCard.activePlayerId) ?? []).filter(
                                (decision) =>
                                  !decision.targetDisciplineId ||
                                  decision.targetDisciplineId === slot.disciplineId ||
                                  decision.label === "Captain-Rolle",
                              )
                            : [];
                          const slotMoraleDelta = selectedMoraleDecisions.reduce((sum, decision) => sum + decision.moraleDelta, 0);
                          const slotMoraleLabel =
                            selectedMoraleDecisions.length === 0
                              ? "neutral"
                              : selectedMoraleDecisions.every((decision) => decision.fulfilled)
                                ? "erfüllt"
                                : "offen";
                          const roleAttributes =
                            selectedRosterCard && role
                              ? (role.keyAttributes?.length
                                  ? role.keyAttributes.slice(0, 4)
                                  : [
                                      { attribute: role.majorPositiveAttribute, weightPct: 0, deltaPct: 0, emphasis: "primary" as const },
                                      { attribute: role.minorPositiveAttribute, weightPct: 0, deltaPct: 0, emphasis: "secondary" as const },
                                      { attribute: role.strainAttribute, weightPct: 0, deltaPct: 0, emphasis: "support" as const },
                                    ]
                                ).map((attribute) => ({
                                  key: attribute.attribute,
                                  shortLabel: attributeShortLabels[attribute.attribute],
                                  ratingLabel: selectedRosterCard.attributeRatings?.[attribute.attribute] ?? null,
                                  weightPct: attribute.weightPct,
                                  deltaPct: attribute.deltaPct,
                                  emphasis: attribute.emphasis,
                                }))
                              : [];
                          const selectedSlotExplanation = buildSlotFitExplanation(
                            role,
                            selectedRosterCard ?? null,
                            slotPreview?.projected ?? null,
                            null,
                          );
                          const selectedCaptainInfo =
                            captains[slot.disciplineSide] === selections[slot.key] && selectedRosterCard?.activePlayerId
                              ? captainInfoByActivePlayerId.get(selectedRosterCard.activePlayerId) ?? null
                              : null;
                          const selectedTeamPower = getSelectedTeamPowerOption(modifiers[slot.disciplineSide].teamPowerId);
                          const rivalryPressure = getRivalryPressureForDiscipline(slot.disciplineId);
                          const selectedDemandCount =
                            selectedRosterCard?.demands.filter((demand) => !demand.targetDisciplineId || demand.targetDisciplineId === slot.disciplineId).length ?? 0;
                          const slotMicroStepStates = resolveSlotMicroStepStates({
                            hasSelection: Boolean(selections[slot.key]),
                            isActiveSlot,
                            isHoveredAssign: hoveredCandidate?.slotKey === slot.key,
                            isRecentlyAssigned: recentlyAssignedSlotKey === slot.key,
                          });
                          return (
                            <>
                              <div className="legacy-lineup-arena-slot-head">
                                <span className="legacy-lineup-arena-slot-title">
                                  {isActiveSlot ? "Aktiver Slot" : `Slot ${slot.slotIndex + 1}`}
                                </span>
                                <div className="legacy-lineup-slot-head-tags">
                                  {isActiveSlot && !selectedRosterCard ? (
                                    <span className="legacy-lineup-slot-focus-chip">Hier weiter</span>
                                  ) : null}
                                  {isMissingHighlighted ? (
                                    <span className="legacy-lineup-slot-focus-chip is-missing">Fehlt</span>
                                  ) : null}
                                  <span className={`legacy-lineup-slot-state-pill is-${slotReadiness.key}`} title={slotReadiness.detail}>
                                    {slotReadiness.label}
                                  </span>
                                  {dragPreview ? (
                                    <span className={`legacy-lineup-slot-fit-pill ${getDragFitTierClass(dragPreview.fitTier)}`}>
                                      {dragPreview.fitTier === "best"
                                        ? "Optimal"
                                        : dragPreview.fitTier === "great"
                                          ? "Gut"
                                          : dragPreview.fitTier === "okay"
                                            ? "Okay"
                                            : dragPreview.fitTier === "poor"
                                              ? "Schlecht"
                                              : "Blockiert"}
                                    </span>
                                  ) : null}
                                  <span
                                    className="legacy-lineup-arena-slot-role"
                                    title={
                                      role
                                        ? `${role.label} · ${role.description} · ${(role.keyAttributes ?? []).map((attribute) => `${attributeShortLabels[attribute.attribute]} ${formatDecimalScore(attribute.weightPct, 1)}%${attribute.deltaPct ? ` (${attribute.deltaPct > 0 ? "+" : ""}${formatDecimalScore(attribute.deltaPct, 1)})` : ""}`).join(" · ")}`
                                        : `Slot ${slot.slotIndex + 1}`
                                    }
                                  >
                                    {role?.label ?? `Slot ${slot.slotIndex + 1}`}
                                  </span>
                                </div>
                              </div>
                              {!isCompactSlot ? <LegacyLineupSlotMicroSteps stepStates={slotMicroStepStates} /> : null}
                              {!isCompactSlot ? (
                                <div className="legacy-lineup-slot-summary-grid">
                                  <div className="legacy-lineup-slot-summary-card">
                                    <span>Zweck</span>
                                    <strong>{role?.label ?? "Standard"}</strong>
                                    <small>{role?.description ?? `${discipline?.displayName ?? "Diszi"} Slot`}</small>
                                  </div>
                                  <div className="legacy-lineup-slot-summary-card">
                                    <span>Warum passend?</span>
                                    <strong>{selectedRosterCard ? selectedSlotExplanation.summary : "Spieler fehlt"}</strong>
                                    <small>{selectedRosterCard ? selectedSlotExplanation.detail : "Karte ziehen oder Top Pick nutzen."}</small>
                                  </div>
                                  <div className="legacy-lineup-slot-summary-card">
                                    <span>Current</span>
                                    <strong>{sideEntry?.finalContribution != null ? formatScore(sideEntry.finalContribution) : slotPreview?.projected.totalProjected != null ? formatScore(slotPreview.projected.totalProjected) : "—"}</strong>
                                    <small>
                                      Base {selectedScore != null ? formatScore(selectedScore) : "—"}
                                      {moraleScoreEffect != null ? ` · Moral ${formatMoraleScoreEffect(moraleScoreEffect)}` : ""}
                                    </small>
                                  </div>
                                  <div className="legacy-lineup-slot-summary-card">
                                    <span>Drag Preview</span>
                                    <strong>{dragPreview?.projected.totalProjected != null ? formatScore(dragPreview.projected.totalProjected) : "—"}</strong>
                                    <small>
                                      Δ {dragPreview?.scoreDelta != null ? `${dragPreview.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(dragPreview.scoreDelta, 1)}` : "—"}
                                    </small>
                                  </div>
                                  <div className="legacy-lineup-slot-summary-card">
                                    <span>Beste Kandidaten</span>
                                    <strong>
                                      {slotCandidateSummary?.topCandidates.slice(0, 2).map((candidate) => candidate.name).join(" · ") || "—"}
                                    </strong>
                                    <small>
                                      {slotCandidateSummary?.topCandidates
                                        .slice(0, 2)
                                        .map((candidate) =>
                                          candidate.scoreDelta != null
                                            ? `${formatNullableScore(candidate.projectedScore)} (${candidate.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(candidate.scoreDelta, 1)})`
                                            : formatNullableScore(candidate.projectedScore),
                                        )
                                        .join(" / ") || "Keine Alternative"}
                                    </small>
                                  </div>
                                  <div className="legacy-lineup-slot-summary-card">
                                    <span>Moral</span>
                                    <strong>{selectedRosterCard ? formatMoraleScoreEffect(moraleScoreEffect) : "—"}</strong>
                                    <small>
                                      {selectedRosterCard
                                        ? `${moraleValue != null ? `Wert ${formatDecimalScore(moraleValue, 0)} · ` : ""}${formatMoralePercentEffect(moralePercentEffect)} Score · ${selectedMoraleDecisions.length} Forderung${selectedMoraleDecisions.length === 1 ? "" : "en"} ${slotMoraleLabel}`
                                        : "Spieler fehlt"}
                                    </small>
                                  </div>
                                  <div className="legacy-lineup-slot-summary-card">
                                    <span>Slot-Signale</span>
                                    <strong>
                                      {formatIntensityStageLabel(intensity)}
                                      {selectedPrimaryFormCard || selectedSecondaryFormCard ? " · Form" : ""}
                                      {selectedTeamPower ? " · Power" : ""}
                                      {rivalryPressure ? " · Rivalen" : ""}
                                    </strong>
                                    <small>
                                      {[
                                        selectedPrimaryFormCard ? `F1 ${formatFormCardColorLabel(selectedPrimaryFormCard.color)} ${formatFormCardValueLabel(selectedPrimaryFormCard.value)}` : null,
                                        selectedSecondaryFormCard ? `F2 ${formatFormCardColorLabel(selectedSecondaryFormCard.color)} ${formatFormCardValueLabel(selectedSecondaryFormCard.value)}` : null,
                                        selectedTeamPower ? selectedTeamPower.label : null,
                                        selectedDemandCount ? `${selectedDemandCount} Wunsch${selectedDemandCount === 1 ? "" : "e"}` : null,
                                        rivalryPressure ? "Rivalitätsdruck aktiv" : null,
                                      ].filter(Boolean).join(" · ") || "Keine Zusatzsignale"}
                                    </small>
                                  </div>
                                </div>
                              ) : null}
                              {dragPreview ? (
                                <div className={`legacy-lineup-slot-drag-callout ${getDragFitTierClass(dragPreview.fitTier)}`}>
                                  <strong>
                                    {formatLegacyLineupDragBlockReason(dragPreview.blockReason) ??
                                      `Projected ${dragPreview.projected.totalProjected != null ? formatScore(dragPreview.projected.totalProjected) : "—"}`}
                                  </strong>
                                  <span>
                                    Score Δ {dragPreview.scoreDelta != null ? `${dragPreview.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(dragPreview.scoreDelta, 1)}` : "—"} ·
                                    {" "}Base {dragPreview.projected.baseScore != null ? formatScore(dragPreview.projected.baseScore) : "—"} ·
                                    {" "}Fatigue -{formatDecimalScore(dragPreview.projected.fatigueModifier ?? 0, 1)} ·
                                    {" "}{dragPreview.slotRuleLabel ?? "Slot-Regel: Standard"}
                                  </span>
                                </div>
                              ) : null}
                              {!isCompactSlot && slotCandidateSummary?.topCandidates.length ? (
                                <div className="legacy-lineup-quick-assign-row">
                                  {slotCandidateSummary.topCandidates.slice(0, 3).map((candidate) => (
                                    <button
                                      key={`${slot.key}-quick-${candidate.activePlayerId}`}
                                      className={`legacy-lineup-quick-assign-button${hoveredCandidate?.slotKey === slot.key && hoveredCandidate.activePlayerId === candidate.activePlayerId ? " is-previewed" : ""}`}
                                      type="button"
                                      onMouseEnter={() => scheduleHoveredCandidate({ slotKey: slot.key, activePlayerId: candidate.activePlayerId })}
                                      onMouseLeave={() => setHoveredCandidate(null)}
                                      onFocus={() => scheduleHoveredCandidate({ slotKey: slot.key, activePlayerId: candidate.activePlayerId })}
                                      onBlur={() => setHoveredCandidate(null)}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        updateSelection(slot.key, candidate.activePlayerId, {
                                          advanceFocusToNextOpenSlot: true,
                                        });
                                      }}
                                      title={`${candidate.name} · ${formatNullableScore(candidate.projectedScore)}${
                                        candidate.scoreDelta != null
                                          ? ` · ${candidate.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(candidate.scoreDelta, 1)}`
                                          : ""
                                      } · ${candidate.fitDetail}`}
                                    >
                                      <span>{candidate.name}</span>
                                      <strong>{formatNullableScore(candidate.projectedScore)}</strong>
                                      {candidate.scoreDelta != null ? (
                                        <small>{candidate.scoreDelta >= 0 ? "+" : ""}{formatDecimalScore(candidate.scoreDelta, 1)}</small>
                                      ) : null}
                                      <LegacyLineupCandidateReasonChips chips={candidate.reasonChips} />
                                      <small>{candidate.fitSummary}</small>
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              {selectedRosterCard ? (
                                <div className="legacy-lineup-slot-player-card">
                                  <div className="legacy-lineup-slot-player-head">
                                    {captains[slot.disciplineSide] === selections[slot.key] ? (
                                      <span
                                        className="legacy-lineup-slot-captain-pill"
                                        title={
                                          selectedCaptainInfo
                                            ? `Captain-Beitrag +${formatNullableScore(selectedCaptainInfo.estimatedCaptainBonus)}${
                                                selectedCaptainInfo.moraleReward != null
                                                  ? ` · Moral +${formatDecimalScore(selectedCaptainInfo.moraleReward, 1)}`
                                                  : ""
                                              }`
                                            : "Captain"
                                        }
                                      >
                                        Captain {selectedCaptainInfo?.estimatedCaptainBonus != null ? `+${formatNullableScore(selectedCaptainInfo.estimatedCaptainBonus)}` : ""}
                                      </span>
                                    ) : null}
                                    {selectedRosterCard.portraitUrl ? (
                                      <OptimizedMediaImage
                                        className="legacy-lineup-slot-player-portrait"
                                        src={selectedRosterCard.portraitUrl}
                                        alt={selectedRosterCard.name}
                                        width={44}
                                        height={44}
                                      />
                                    ) : (
                                      <span className="legacy-lineup-slot-player-portrait legacy-lineup-slot-player-portrait-fallback">—</span>
                                    )}
                                    <span className={`legacy-lineup-slot-fatigue-badge ${getFatigueHeatClass(selectedOption?.fatigueCount ?? null)}`}>
                                      F {Math.round(selectedOption?.fatigueCount ?? 0)}
                                    </span>
                                    <div className="legacy-lineup-slot-player-copy">
                                      <strong>{selectedRosterCard.name}</strong>
                                      <span>{selectedRosterCard.className ?? "—"} · {selectedRosterCard.contractLength ?? "—"} Jahre</span>
                                    </div>
                                  </div>
                                  <div className="legacy-lineup-slot-chip-row">
                                    <span className={`legacy-matchday-player-score-chip ${getDisciplineHeatClass(selectedScore)}`}>
                                      {discipline?.displayName ?? "Diszi"} {formatNullableScore(selectedScore)}
                                    </span>
                                    <span className={`legacy-matchday-player-score-chip ${getDisciplineHeatClass(slot.disciplineSide === "d1" ? selectedRosterCard.discipline2Score : selectedRosterCard.discipline1Score)}`}>
                                      {slot.disciplineSide === "d1" ? selectedRosterCard.discipline2Label : selectedRosterCard.discipline1Label}{" "}
                                      {formatNullableScore(slot.disciplineSide === "d1" ? selectedRosterCard.discipline2Score : selectedRosterCard.discipline1Score)}
                                    </span>
                                    {roleAttributes.map((attribute) => (
                                      <span
                                        key={`${slot.key}-${attribute.key}`}
                                        className={`legacy-lineup-slot-attribute-pill ${getTierStyleClass(attribute.ratingLabel)} ${attribute.emphasis === "support" ? "is-strain" : "is-positive"}`}
                                        title={
                                          `${attribute.shortLabel} · Slot-Gewicht ${formatDecimalScore(attribute.weightPct, 1)}%${
                                            attribute.deltaPct
                                              ? ` · ${attribute.deltaPct > 0 ? "+" : ""}${formatDecimalScore(attribute.deltaPct, 1)} gegen Basis`
                                              : ""
                                          }`
                                        }
                                      >
                                        {attribute.shortLabel} {attribute.ratingLabel ?? "—"}
                                      </span>
                                    ))}
                                    <span className={`legacy-lineup-slot-attribute-pill is-intensity-${intensity}`}>
                                      {formatIntensityStageLabel(intensity)} {intensityConfig.scoreModifier > 0 ? `+${formatDecimalScore(intensityConfig.scoreModifier, 1)}` : formatDecimalScore(intensityConfig.scoreModifier, 1)}
                                    </span>
                                    {selectedPrimaryFormCard ? (
                                      <span className={`legacy-lineup-slot-attribute-pill is-form is-${selectedPrimaryFormCard.color}`}>
                                        F1 {formatFormCardValueLabel(selectedPrimaryFormCard.value)}
                                      </span>
                                    ) : null}
                                    {selectedSecondaryFormCard ? (
                                      <span className={`legacy-lineup-slot-attribute-pill is-form is-${selectedSecondaryFormCard.color}`}>
                                        F2 {formatFormCardValueLabel(selectedSecondaryFormCard.value)}
                                      </span>
                                    ) : null}
                                    {selectedTeamPower ? (
                                      <span
                                        className="legacy-lineup-slot-attribute-pill is-power"
                                        title={selectedTeamPower.description}
                                      >
                                        Power: {selectedTeamPower.label}
                                      </span>
                                    ) : null}
                                    {selectedRosterCard && moraleScoreEffect != null ? (
                                      <span
                                        className={`legacy-lineup-slot-attribute-pill ${moraleScoreEffect < -0.05 ? "is-morale-risk" : moraleScoreEffect > 0.05 ? "is-morale-boost" : "is-morale-neutral"}`}
                                        title={[
                                          `Moralwert ${moraleValue != null ? formatDecimalScore(moraleValue, 0) : "—"}`,
                                          `Score-Effekt ${formatMoraleScoreEffect(moraleScoreEffect)}`,
                                          `Multiplikator ${formatMoralePercentEffect(moralePercentEffect)}`,
                                        ].join(" · ")}
                                      >
                                        Moral {formatMoraleScoreEffect(moraleScoreEffect)}
                                      </span>
                                    ) : null}
                                    {rivalryPressure ? (
                                      <span className="legacy-lineup-slot-attribute-pill is-rivalry" title="Push wird in Rivalitätsfenstern riskanter und streut stärker.">
                                        Rivalen
                                      </span>
                                    ) : null}
                                    {selectedRosterCard.demands
                                      .filter((demand) => !demand.targetDisciplineId || demand.targetDisciplineId === slot.disciplineId)
                                      .slice(0, 1)
                                      .map((demand) => {
                                        const decision = moraleDecisionByDemandId.get(demand.demandId) ?? null;
                                        return (
                                        <span
                                          key={`${slot.key}-${demand.demandId}`}
                                          className={`legacy-lineup-slot-attribute-pill ${decision?.fulfilled ? "is-positive" : "is-demand-risk"}`}
                                          title={`${demand.detail}${decision ? ` · Moral ${formatMoraleDelta(decision.moraleDelta)}` : ""}`}
                                        >
                                          {decision?.fulfilled ? "Wunsch +" : "Wunsch"}
                                        </span>
                                        );
                                      })}
                                  </div>
                                </div>
                              ) : (
                                <div className={`legacy-lineup-slot-empty-card${isMissingHighlighted ? " is-missing-highlight" : ""}`}>
                                  <strong>{isActiveSlot ? "Naechster Slot" : "Freier Slot"}</strong>
                                  <span>
                                    {isActiveSlot
                                      ? "Spielerkarte hier ablegen oder Top Pick nutzen."
                                      : "Offene Drop-Zone fuer eine Spielerkarte."}
                                  </span>
                                </div>
                              )}
                        {(slotIssuesByKey.get(slot.key) ?? []).length > 0 ? (
                          <div className="legacy-lineup-slot-conflict-list" aria-label={`${formatLineupSlotLabel(slot.key)} Hinweise`}>
                            {(slotIssuesByKey.get(slot.key) ?? []).map((issue) => (
                              <span key={`${slot.key}-${issue.label}-${issue.detail}`} className={`legacy-lineup-slot-conflict-chip is-${issue.tone}`}>
                                <strong>{issue.label}</strong>
                                <small>{issue.detail}</small>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <select
                          className="input"
                          value={selections[slot.key] ?? ""}
                          onChange={(event) =>
                            updateSelection(slot.key, event.target.value, {
                              advanceFocusToNextOpenSlot: Boolean(event.target.value),
                            })
                          }
                        >
                          <option value="">Spieler wählen</option>
                          {sortOptionsByDisciplineSkill(getAvailableOptionsForSlot(slot.key), slot.disciplineId).map((option) => (
                            <option key={option.activePlayerId} value={option.activePlayerId}>
                              {renderOptionLabel(option, slot.disciplineId)}
                            </option>
                          ))}
                        </select>
                              <span
                                className={`legacy-lineup-selection-meta ${getDisciplineHeatClass(selectedScore)} ${getFatigueHeatClass(selectedOption?.fatigueCount ?? null)}`.trim()}
                                title={[
                                  `B = Base Score (${selectedScore != null ? formatScore(selectedScore) : "—"})`,
                                  `R = Rollen-Modifikator (${formatDecimalScore(slotPreview?.projected.roleModifier ?? 0, 1)})`,
                                  `F = Fatigue ${Math.round(selectedOption?.fatigueCount ?? 0)} → -${Math.round(slotPreview?.projected.fatiguePenaltyPercent ?? 0)}% / -${formatDecimalScore(slotPreview?.projected.fatigueModifier ?? 0, 1)}`,
                                  `M = Moral (${moraleValue != null ? formatDecimalScore(moraleValue, 0) : "—"}) → ${formatMoralePercentEffect(moralePercentEffect)} / ${formatMoraleScoreEffect(moraleScoreEffect)}`,
                                  `E = Einsatz-Modifikator (${formatDecimalScore(intensityConfig.scoreModifier, 1)})`,
                                  `S = Projected Score (${slotPreview?.projected.totalProjected != null ? formatScore(slotPreview.projected.totalProjected) : "—"})`,
                                  `Fatigue Info = +${slotPreview?.projected.additionalFatigue ?? 0} · Risiko ${slotPreview?.projected.fatigueRisk ?? "—"} · Slot ${slotPreview?.projected.slotStrainLoad ?? "—"}`,
                                  (slotPreview?.projected.rivalryPressureModifier ?? 0) > 0
                                    ? `Rivalitätsdruck = +${formatDecimalScore(slotPreview?.projected.rivalryPressureModifier ?? 0, 1)} Streuung/Strain bei Push`
                                    : null,
                                  slotPreview?.projected.warnings[0] ?? "Lineup okay",
                                ].filter(Boolean).join("\n")}
                              >
                                <span title="Base Score">B {selectedScore != null ? formatScore(selectedScore) : "—"}</span>
                                <span title="Rollen-Modifikator">R {formatSignedCompactInteger(slotPreview?.projected.roleModifier ?? 0)}</span>
                                <span title="Fatigue-Malus">F {formatNegativeCompactInteger(slotPreview?.projected.fatigueModifier ?? 0)}</span>
                                <span title="Moral-Score-Effekt">M {formatMoraleScoreEffect(moraleScoreEffect)}</span>
                                <span title="Einsatz-Modifikator">E {formatSignedCompactInteger(intensityConfig.scoreModifier)}</span>
                                <span className="legacy-lineup-selection-score-emphasis" title="Projected Score">S {slotPreview?.projected.totalProjected != null ? formatScore(slotPreview.projected.totalProjected) : "—"}</span>
                                <span title="Erwartete Zusatz-Erschöpfung">Ft {formatScore(slotPreview?.projected.additionalFatigue ?? 0)}</span>
                              </span>
                            </>
                          );
                        })()}
                      </label>
                    ))}
                    <div className="legacy-lineup-side-draft-status">
                      <span>Slot-Status: {disciplineSide === "d1" ? lineupMeta.d1Selected : lineupMeta.d2Selected}/{discipline?.requiredPlayers ?? "—"}</span>
                      <span>Captain: {captains[disciplineSide] ? "gesetzt" : "offen"}</span>
                      <span>
                        Draft: {sideSlots.some((slot) => Boolean(selections[slot.key])) ? "im UI-Draft" : "leer"}
                      </span>
                      <span>
                        Gespeichert: {(draft?.entries ?? []).some((entry) => entry.disciplineSide === disciplineSide) ? "ja" : "nein"}
                      </span>
                    </div>
                  </div>
                </section>
              );
            })}
          </section>
        </section>

        <section className="panel legacy-lineup-matchday-preview-panel">
          <div className="panel-header">
            <div>
              <TooltipHeading
                as="h3"
                tooltip="Kompakter Zielbereich fuer D1/D2-Projektion, offene Slots, Risiko und Modifier-Status."
              >
                Matchday Preview
              </TooltipHeading>
            </div>
            <div className="legacy-matchday-room-badges">
              <span className="pill">Spielstand: {source === "prisma" ? "Referenz" : "lokal"}</span>
              <span className="pill">Draft {draft ? "gespeichert" : "offen"}</span>
            </div>
          </div>
          <div className="legacy-lineup-preview-panel-grid">
            <article className="metric-card">
              <span>D1 Preview Score</span>
              <strong>{formatDecimalScore(matchdayPreviewCards.d1Projected, 1)}</strong>
              <small>
                {d1Label} · {formatProjectedWindow(matchdayPreviewCards.d1RangeLow ?? null, matchdayPreviewCards.d1RangeHigh ?? null)} · Fatigue -
                {formatDecimalScore(matchdayPreviewCards.d1FatiguePenalty, 1)} / +{formatDecimalScore(matchdayPreviewCards.d1Fatigue, 1)}
              </small>
            </article>
            <article className="metric-card">
              <span>D2 Preview Score</span>
              <strong>{formatDecimalScore(matchdayPreviewCards.d2Projected, 1)}</strong>
              <small>
                {d2Label} · {formatProjectedWindow(matchdayPreviewCards.d2RangeLow ?? null, matchdayPreviewCards.d2RangeHigh ?? null)} · Fatigue -
                {formatDecimalScore(matchdayPreviewCards.d2FatiguePenalty, 1)} / +{formatDecimalScore(matchdayPreviewCards.d2Fatigue, 1)}
              </small>
            </article>
            <article className="metric-card">
              <span>Gesamtprojektion</span>
              <strong>{formatProjectedWindow(matchdayPreviewCards.totalRangeLow ?? null, matchdayPreviewCards.totalRangeHigh ?? null)}</strong>
              <small>Lineup {lineupMeta.d1Selected + lineupMeta.d2Selected}/{(context?.matchdayContract?.discipline1?.requiredPlayers ?? 0) + (context?.matchdayContract?.discipline2?.requiredPlayers ?? 0)}</small>
            </article>
            <article className="metric-card">
              <span>Fatigue Cost gesamt</span>
              <strong>{formatDecimalScore(matchdayPreviewCards.totalFatigue, 1)}</strong>
              <small>Risiko-Level {matchdayPreviewCards.riskLevel}</small>
            </article>
            <article className="metric-card">
              <span>Morale Impact</span>
              <strong>{formatMoraleDelta(lineupMoraleSummary.netDelta)}</strong>
              <small>{lineupMoraleSummary.fulfilledCount} erfüllt · {lineupMoraleSummary.atRiskCount} offen</small>
            </article>
            <article className="metric-card">
              <span>Status jetzt</span>
              <strong>{draft ? "gespeichert" : "offen"}</strong>
              <small>Room {lineupMeta.d1Selected + lineupMeta.d2Selected} Slots · Save {(draft?.entries ?? []).length}</small>
            </article>
            <article className="metric-card">
              <span>Formkartenstatus</span>
              <strong>{formatModifierSourceLabel(context?.formCardSource)}</strong>
              <small>Formkarten für Season erzeugen bleibt global.</small>
            </article>
            <article className="metric-card">
              <span>Mutatorenstatus</span>
              <strong>{formatModifierSourceLabel(context?.mutatorSource)}</strong>
              <small>Reveal läuft über die Diszi-Buttons.</small>
            </article>
            <article className="metric-card">
              <span>Offene Slots</span>
              <strong>{matchdayPreviewCards.openSlots}</strong>
              <small>{previewPanelWarnings.length ? `${previewPanelWarnings.length} Hinweise` : "Keine offenen Hinweise"}</small>
            </article>
          </div>
          <div className="legacy-lineup-preview-warning-panel">
            <strong>Hinweise</strong>
            {previewPanelWarnings.length ? (
              <ul className="warning-list compact-list legacy-lineup-warning-list">
                {previewPanelWarnings.map((warning) => (
                  <li key={`preview-warning-${warning}`}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Aktuell keine offenen Warnungen.</p>
            )}
          </div>
          <div className="legacy-lineup-morale-panel">
            <div>
              <strong>Forderungen</strong>
              <small>{lineupMoraleSummary.fulfilledCount} erfüllt · {lineupMoraleSummary.atRiskCount} offen · Moral {formatMoraleDelta(lineupMoraleSummary.netDelta)}</small>
            </div>
            <div className="legacy-lineup-morale-list">
              {[...lineupMoraleSummary.urgent, ...lineupMoraleSummary.positive].slice(0, 5).map((decision) => (
                <span
                  key={`morale-${decision.demandId}`}
                  className={`legacy-lineup-morale-chip ${decision.fulfilled ? "is-ready" : "is-warning"}`}
                  title={decision.detail}
                >
                  <strong>{decision.playerName}</strong>
                  <small>{decision.label} · {formatMoraleDelta(decision.moraleDelta)}</small>
                </span>
              ))}
              {lineupMoraleSummary.urgent.length === 0 && lineupMoraleSummary.positive.length === 0 ? (
                <span className="legacy-lineup-morale-chip is-muted">
                  <strong>Keine akuten Forderungen</strong>
                  <small>Diese Aufstellung ist moralisch ruhig.</small>
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {visibleScoreboardSide && matchdayScorePreview ? (
          <section className="panel legacy-lineup-matchday-scoreboard-panel">
            <div className="panel-header">
              <div>
                <h3>
                  {visibleScoreboardSide === "d1"
                    ? `D1 Scoreboard · ${matchdayScorePreview.targetMatchday.d1DisciplineName ?? "—"}`
                    : `D2 Scoreboard · ${matchdayScorePreview.targetMatchday.d2DisciplineName ?? "—"}`}
                </h3>
                <p className="muted">
                  32 Teams aus dem aktiven Save. Δ vergleicht den Endrang mit dem reinen Base-Score-Rang vor Fatigue, Captain, Form und Mutatoren.
                </p>
              </div>
              <div className="legacy-lineup-scoreboard-source-strip">
                <span>Form: {matchdayScorePreview.resolveSources.formCardSourceLabel ?? matchdayScorePreview.resolveSources.formCardSourceStatus}</span>
                <span>Mutator: {matchdayScorePreview.resolveSources.mutatorSourceLabel ?? matchdayScorePreview.resolveSources.mutatorSourceStatus}</span>
                <span>Fatigue: {matchdayScorePreview.resolveSources.fatigueSourceStatus}</span>
              </div>
            </div>
            {isScoreboardResultRevealed && visibleResultBoardSummary ? (
              <section className="legacy-lineup-result-board-shell">
                <div className="legacy-lineup-result-board-main">
                  <article className="legacy-lineup-result-hero-card">
                    <span className="legacy-lineup-result-eyebrow">Matchday Arena · Reveal View · {visibleResultBoardSummary.disciplineLabel}</span>
                    <strong>{visibleResultBoardSummary.message}</strong>
                    <p className="muted">
                      Final Score {formatDecimalScore(visibleResultBoardSummary.winner.score, 1)} · Rang {visibleResultBoardSummary.winner.rank}
                      {visibleResultBoardSummary.winner.points != null ? ` · ${formatDecimalScore(visibleResultBoardSummary.winner.points, 1)} Punkte` : ""}
                    </p>
                    <div className="legacy-matchday-room-badges">
                      <span className="pill">Weiter: Resolve Detail behalten</span>
                      <span className="pill">Done: Player Drawer per Klick/Doppelklick</span>
                    </div>
                  </article>
                  <div className="legacy-lineup-result-team-cards">
                    {visibleMatchdayScoreboard.slice(0, 3).map((entry) => (
                      <article key={`result-team-card-${visibleScoreboardSide}-${entry.teamId}`} className="legacy-lineup-result-team-card">
                        <span className="legacy-lineup-result-rank">#{entry.rank}</span>
                        <strong>{entry.teamName}</strong>
                        <span>Final Score {formatDecimalScore(entry.score, 1)}</span>
                        <span>Base {formatDecimalScore(entry.baseScore, 1)} · Δ {formatSignedDelta(entry.rankDelta)}</span>
                        <span>{entry.points != null ? `${formatDecimalScore(entry.points, 1)} Punkte` : "Punkte —"}</span>
                      </article>
                    ))}
                  </div>
                </div>
                <aside className="legacy-lineup-result-side-panel">
                  <div className="legacy-lineup-result-side-head">
                    <strong>Top-Spieler · {visibleResultBoardSummary.disciplineLabel}</strong>
                    <span className="muted">Kompakte Result-Cards als Vorbereitung für die spätere Matchday-Arena.</span>
                  </div>
                  <div className="legacy-lineup-top-player-card-list">
                    {visibleTopPlayerCards.length ? (
                      visibleTopPlayerCards.map((entry) => (
                        <article
                          key={`result-top-player-card-${visibleScoreboardSide}-${entry.playerId}-${entry.rankInDiscipline}`}
                          className="legacy-lineup-top-player-card"
                          onDoubleClick={() => openPlayerDetails(entry.playerId, entry.activePlayerId)}
                          onClick={() => openPlayerDetails(entry.playerId, entry.activePlayerId)}
                        >
                          <div className="legacy-lineup-top-player-card-head">
                            <span className="legacy-lineup-result-rank">#{entry.rankInDiscipline}</span>
                            {entry.portraitUrl ? (
                              <OptimizedMediaImage
                                className="legacy-matchday-player-portrait"
                                src={entry.portraitUrl}
                                alt={entry.playerName}
                                width={56}
                                height={56}
                              />
                            ) : (
                              <span className="legacy-matchday-player-portrait legacy-matchday-player-portrait-fallback">—</span>
                            )}
                            <div className="legacy-lineup-top-player-card-title">
                              <strong>{entry.playerName}</strong>
                              <span>{entry.teamName}</span>
                              <span>{entry.className ?? "Klasse —"}</span>
                            </div>
                          </div>
                          <div className="legacy-lineup-top-player-card-metrics">
                            <span>Score {formatDecimalScore(entry.finalPlayerScore, 1)}</span>
                            <span>{entry.pointsAwarded != null ? `+${formatDecimalScore(entry.pointsAwarded, 1)} PPs` : "PPs —"}</span>
                          </div>
                          {entry.badges.length ? (
                            <div className="legacy-lineup-top-player-card-badges">
                              {entry.badges.map((badge) => (
                                <span key={`result-player-badge-${entry.playerId}-${badge}`} className="pill">
                                  {badge}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <div className="legacy-lineup-result-empty-card">
                        <strong>Noch keine Top-Spieler</strong>
                        <span className="muted">Nach dem Resolve erscheinen hier die schmalen Highlight-Cards für die Disziplin.</span>
                      </div>
                    )}
                  </div>
                </aside>
              </section>
            ) : null}
            {isExpertModeEnabled ? (
            <>
            <div className="table-shell legacy-lineup-scoreboard-table-shell">
              <table className="team-table legacy-lineup-scoreboard-table">
                <thead>
                  <tr>
                    <th>{isScoreboardResultRevealed ? "Rang" : "Base-Rang"}</th>
                    <th>Δ</th>
                    <th>Team</th>
                    <th>Base</th>
                    <th>Loss</th>
                    <th>Current</th>
                    <th>Captain</th>
                    {scoreboardReveal[visibleScoreboardSide].form ? <th>Form</th> : null}
                    {scoreboardReveal[visibleScoreboardSide].mutators ? <th>Mutator 1</th> : null}
                    {scoreboardReveal[visibleScoreboardSide].mutators ? <th>Mutator 2</th> : null}
                    {isScoreboardResultRevealed ? <th>Bonus</th> : null}
                    {isScoreboardResultRevealed ? <th>Gesamt</th> : null}
                    {isScoreboardResultRevealed ? <th>Finale Punkte</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {visibleMatchdayScoreboard.map((entry) => (
                    <tr key={`legacy-lineup-scoreboard-${visibleScoreboardSide}-${entry.teamId}`}>
                      <td>{isScoreboardResultRevealed ? entry.rank : entry.baseRank}</td>
                      <td className={entry.rankDelta > 0 ? "is-positive-number" : entry.rankDelta < 0 ? "is-negative-number" : undefined}>
                        {isScoreboardResultRevealed ? formatSignedDelta(entry.rankDelta) : "—"}
                      </td>
                      <td>{entry.teamName}</td>
                      <td>{formatDecimalScore(entry.baseScore, 1)}</td>
                      <td>{formatDecimalScore(entry.lossScore, 1)}</td>
                      <td>{formatDecimalScore(entry.currentScore, 1)}</td>
                      <td>{entry.captainScore != null ? formatDecimalScore(entry.captainScore, 1) : "—"}</td>
                      {scoreboardReveal[visibleScoreboardSide].form ? <td>{entry.formScore != null ? formatDecimalScore(entry.formScore, 1) : "—"}</td> : null}
                      {scoreboardReveal[visibleScoreboardSide].mutators ? (
                        <td>{entry.mutator1Label ? `${entry.mutator1Label} · ${formatDecimalScore(entry.mutator1Modifier, 1)}` : "—"}</td>
                      ) : null}
                      {scoreboardReveal[visibleScoreboardSide].mutators ? (
                        <td>{entry.mutator2Label ? `${entry.mutator2Label} · ${formatDecimalScore(entry.mutator2Modifier, 1)}` : "—"}</td>
                      ) : null}
                      {isScoreboardResultRevealed ? <td>{entry.teamPpsStatus === "ready" ? formatDecimalScore(entry.bonusScore, 1) : "—"}</td> : null}
                      {isScoreboardResultRevealed ? <td>{formatDecimalScore(entry.score, 1)}</td> : null}
                      {isScoreboardResultRevealed ? <td>{entry.points != null ? formatDecimalScore(entry.points, 1) : "—"}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isScoreboardResultRevealed ? (
            <div className="table-shell legacy-lineup-scoreboard-table-shell" style={{ marginTop: 12 }}>
              <table className="team-table legacy-lineup-scoreboard-table">
                <thead>
                  <tr>
                    <th>Top</th>
                    <th>Spieler</th>
                    <th>Team</th>
                    <th>Score</th>
                    <th>Punkte</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTopPlayers.length ? (
                    visibleTopPlayers.slice(0, 10).map((entry) => (
                      <tr key={`legacy-lineup-top-player-${visibleScoreboardSide}-${entry.playerId}-${entry.rankInDiscipline}`}>
                        <td>{entry.rankInDiscipline}</td>
                        <td>{entry.playerName}</td>
                        <td>{entry.teamName}</td>
                        <td>{formatDecimalScore(entry.finalPlayerScore, 1)}</td>
                        <td>{entry.pointsAwarded != null ? formatDecimalScore(entry.pointsAwarded, 1) : "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="muted">Noch keine Top-Spieler fuer diese Disziplin vorhanden.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            ) : null}
            </>
            ) : (
              <div className="legacy-lineup-scoreboard-board-rows" data-testid="legacy-lineup-scoreboard-board-rows">
                {visibleMatchdayScoreboard.map((entry) => (
                  <article
                    key={`legacy-lineup-scoreboard-board-${visibleScoreboardSide}-${entry.teamId}`}
                    className="legacy-lineup-scoreboard-board-row"
                  >
                    <div className="legacy-lineup-scoreboard-board-row-head">
                      <span className="legacy-lineup-result-rank">#{isScoreboardResultRevealed ? entry.rank : entry.baseRank}</span>
                      <strong>{entry.teamName}</strong>
                      {isScoreboardResultRevealed && entry.rankDelta !== 0 ? (
                        <span className={entry.rankDelta > 0 ? "is-positive-number" : "is-negative-number"}>
                          {formatSignedDelta(entry.rankDelta)}
                        </span>
                      ) : null}
                    </div>
                    <VeloImpactStrip
                      className="legacy-lineup-scoreboard-impact-strip"
                      items={[
                        {
                          key: "base",
                          label: "Base",
                          value: formatDecimalScore(entry.baseScore, 1),
                          tone: "neutral",
                        },
                        {
                          key: "current",
                          label: "Current",
                          value: formatDecimalScore(entry.currentScore, 1),
                          tone: "neutral",
                        },
                        ...(scoreboardReveal[visibleScoreboardSide].form
                          ? [
                              {
                                key: "form",
                                label: "Form",
                                value: entry.formScore != null ? formatDecimalScore(entry.formScore, 1) : "—",
                                tone: "warning" as const,
                              },
                            ]
                          : []),
                        ...(scoreboardReveal[visibleScoreboardSide].mutators
                          ? [
                              {
                                key: "mutator",
                                label: "Mutator",
                                value:
                                  entry.mutator1Label || entry.mutator2Label
                                    ? `${entry.mutator1Label ?? entry.mutator2Label ?? "—"}`
                                    : "—",
                                tone: "warning" as const,
                              },
                            ]
                          : []),
                        {
                          key: "final",
                          label: isScoreboardResultRevealed ? "Final" : "Proj.",
                          value: formatDecimalScore(isScoreboardResultRevealed ? entry.score : entry.currentScore, 1),
                          tone: "positive",
                        },
                      ]}
                    />
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {showExpertBackupPanels ? (
          <details className="panel legacy-lineup-secondary-panel legacy-lineup-expert-panel">
          <summary>Expert Modus</summary>
          <div className="legacy-lineup-secondary-content">
            <div className="panel panel-compact">
              <div className="panel-header">
                <div>
                  <h3>Spielertabelle</h3>
                  <p className="muted">Präziser Fallback für Sortierung, Column-Handling und den alten Tabellenblick.</p>
                </div>
                <LegacyLineupTableCustomization
                  columns={lineupPlayerTableColumns}
                  activePreset={tablePreferences.lineupPlayerTable?.activePreset ?? "retool_default"}
                  isVisible={(columnId, visibleByDefault) => {
                    const explicit = tablePreferences.lineupPlayerTable?.columnVisibility?.[columnId];
                    if (typeof explicit === "boolean") {
                      return explicit;
                    }
                    return visibleByDefault ?? true;
                  }}
                  getWidth={getLineupPlayerTableWidth}
                  onToggle={toggleLineupPlayerColumn}
                  onMove={moveLineupPlayerColumn}
                  onWidthStep={stepLineupPlayerColumnWidth}
                  onWidthReset={resetLineupPlayerColumnWidth}
                  onPresetChange={setLineupPlayerTablePreset}
                  onReset={() => setLineupPlayerTablePreset("retool_default")}
                />
              </div>
              <div
                className="table-shell legacy-lineup-player-table-shell"
                ref={expertPlayerTableShellRef}
                data-virtualized={expertPlayerTableVirtualWindow.enabled ? "true" : undefined}
                onScroll={(event) => setExpertPlayerTableScrollTop(event.currentTarget.scrollTop)}
              >
                <table className="team-table legacy-lineup-player-table">
                  <colgroup>
                    {visibleLineupPlayerTableColumns.map((column) => (
                      <col key={column.id} style={{ width: `${getLineupPlayerTableWidth(column)}px` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      {visibleLineupPlayerTableColumns.map((column) => (
                        <th key={column.id} style={{ width: `${getLineupPlayerTableWidth(column)}px`, minWidth: `${column.minWidth}px` }}>
                          <LegacyLineupSortableHeader
                            label={column.label}
                            columnKey={column.id}
                            sortState={tablePreferences.lineupPlayerTable?.sortState ?? null}
                            onToggle={toggleLineupPlayerTableSort}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expertPlayerTableVirtualWindow.enabled ? (
                      <tr aria-hidden="true">
                        <td
                          colSpan={visibleLineupPlayerTableColumns.length}
                          style={{ height: expertPlayerTableVirtualWindow.offsetY, padding: 0, border: 0 }}
                        />
                      </tr>
                    ) : null}
                    {visibleExpertPlayerRows.map((player) => (
                      <tr key={player.id} onDoubleClick={() => openPlayerDetails(player.id, player.activePlayerId)}>
                        {visibleLineupPlayerTableColumns.map((column) => {
                          if (column.id === "image") {
                            return (
                              <td key={column.id}>
                                {player.portraitUrl ? (
                                  <OptimizedMediaImage
                                    className="legacy-lineup-player-portrait"
                                    src={player.portraitUrl}
                                    alt={player.name}
                                    width={52}
                                    height={52}
                                  />
                                ) : (
                                  <span className="legacy-lineup-player-portrait legacy-lineup-player-portrait-placeholder">—</span>
                                )}
                              </td>
                            );
                          }
                          if (column.id === "name") return <td key={column.id}>{player.name}</td>;
                          if (column.id === "team") return <td key={column.id}>{player.teamName}</td>;
                          if (column.id === "contractLength") return <td key={column.id}>{player.contractLength ?? "—"}</td>;
                          if (column.id === "className") return <td key={column.id}>{player.className ?? "—"}</td>;
                          if (column.id === "potential") return <td key={column.id}>{formatWholeNumber(player.potential)}</td>;
                          if (column.id === "discipline1Score") {
                            return <td key={column.id} className={getDisciplineHeatClass(player.discipline1Score)}>{formatNullableScore(player.discipline1Score)}</td>;
                          }
                          if (column.id === "discipline2Score") {
                            return <td key={column.id} className={getDisciplineHeatClass(player.discipline2Score)}>{formatNullableScore(player.discipline2Score)}</td>;
                          }
                          if (column.id === "appearances") return <td key={column.id}>{player.appearances ?? "—"}</td>;
                          if (column.id === "marketValue") return <td key={column.id}>{formatCompactMoney(player.marketValue)}</td>;
                          if (column.id === "traitsPositive") return <td key={column.id}>{formatTraitList(player.traitsPositive)}</td>;
                          return <td key={column.id}>{formatTraitList(player.traitsNegative)}</td>;
                        })}
                      </tr>
                    ))}
                    {expertPlayerTableVirtualWindow.enabled ? (
                      <tr aria-hidden="true">
                        <td
                          colSpan={visibleLineupPlayerTableColumns.length}
                          style={{
                            height:
                              expertPlayerTableVirtualWindow.totalHeight -
                              expertPlayerTableVirtualWindow.offsetY -
                              visibleExpertPlayerRows.length * 42,
                            padding: 0,
                            border: 0,
                          }}
                        />
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </details>
        ) : null}
      </div>
      ) : null}

      {showExpertBackupPanels ? (
      <details className="panel legacy-lineup-secondary-panel">
        <summary>Erweiterte Planung anzeigen</summary>
        <div className="legacy-lineup-secondary-content">
          <div className="legacy-lineup-secondary-actions">
            <button className="secondary-button" type="button" onClick={() => void handleAiPreview()} disabled={isBusy}>
              AI-Vorschlag laden
            </button>
            <button className="secondary-button" type="button" onClick={() => void handleAiPreviewAllTeams()} disabled={isBusy}>
              AI Vorschlag alle Teams
            </button>
            <Link
              className="secondary-button"
              href={`/foundation/legacy-resolve-lab?source=${encodeURIComponent(source)}&saveId=${encodeURIComponent(params.saveId)}&seasonId=${encodeURIComponent(params.seasonId)}&matchdayId=${encodeURIComponent(params.matchdayId)}`}
            >
              Spieltag Preview anzeigen
            </Link>
          </div>
          <p className="muted">Formnutzung, AI-Hinweise und Preview-Details bleiben sekundär und überdecken nicht mehr den Arbeitsbereich.</p>
        </div>
      </details>
      ) : null}

      {showExpertBackupPanels ? (
      <details className="panel legacy-lineup-secondary-panel">
        <summary>Erweiterte Technikoptionen</summary>
        <div className="legacy-lineup-secondary-content">
          <div className="legacy-lineup-control-bar legacy-lineup-technical-grid">
            <label>
              <span>Quelle</span>
              <select
                className="input"
                value={source}
                onChange={(event) => {
                  const nextSource = event.target.value === "prisma" ? "prisma" : "sqlite";
                  setSource(nextSource);
                  void loadContext(params, nextSource);
                }}
              >
                <option value="sqlite">Lokaler Spielstand</option>
                <option value="prisma">Referenzmodus</option>
              </select>
            </label>
            <label>
              <span>Save</span>
              <select className="input" value={params.saveId} onChange={(event) => void loadContext({ saveId: event.target.value }, source)}>
                {options.saves.map((save) => (
                  <option key={save.id} value={save.id}>
                    {save.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Season</span>
              <select className="input" value={params.seasonId} onChange={(event) => void loadContext({ seasonId: event.target.value }, source)}>
                {options.seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">Technikwechsel bleibt bewusst außerhalb des normalen Arbeitsflows.</p>
        </div>
      </details>
      ) : null}

      {showExpertBackupPanels ? (
      <details
        className="panel legacy-lineup-secondary-panel"
        open={isPreviewPanelOpen}
        onToggle={(event) => setIsPreviewPanelOpen(event.currentTarget.open)}
      >
        <summary>Vorschau, Formkarten und Mutatoren</summary>
        <div className="legacy-lineup-secondary-content">
          <div className="legacy-lineup-preview-summary">
            <span>Preview Total: {formatNullableScore(resolvedPreview?.scorePreview.totalScore ?? null)}</span>
            <span>Base Score gesamt: {formatNullableScore(resolvedPreview?.scorePreview.baseScore ?? null)}</span>
            <span>Erschöpfung gesamt: {formatNullableScore(resolvedPreview?.scorePreview.fatigueModifier ?? null)}</span>
            <span>Moral gesamt: {formatMoraleScoreEffect(resolvedPreview?.scorePreview.moraleModifier ?? null)}</span>
            <span>Captain-Bonus gesamt: {formatNullableScore(resolvedPreview?.scorePreview.captainBonusTotal ?? null)}</span>
            <span>Formkarten gesamt: {formatNullableScore(resolvedPreview?.scorePreview.formModifier ?? null)}</span>
            <span>Mutator gesamt: {formatNullableScore(resolvedPreview?.scorePreview.mutatorModifier ?? null)}</span>
            <span>Team-Powers gesamt: {formatNullableScore(resolvedPreview?.scorePreview.teamPowerModifier ?? null)}</span>
            <span>Formkarten-Status: {formatModifierSourceLabel(context?.formCardSource)}</span>
            <span>Mutator-Status: {formatModifierSourceLabel(context?.mutatorSource)}</span>
            <span>Power-Status: {formatModifierSourceLabel(context?.teamPowerSource)}</span>
          </div>
          {resolvedPreview ? (
            <div className="legacy-lineup-preview-panels">
              {resolvedPreview.disciplineSideScores.map((side) => (
                <div key={`${side.disciplineId}::${side.disciplineSide}`} className="panel panel-compact">
                  <div className="panel-header">
                    <h3>
                      {(side.disciplineSide ?? "—").toUpperCase()} · {side.disciplineId ?? "—"}
                    </h3>
                  </div>
                  <div className="stats-grid compact">
                    <div>
                      <span className="muted">Base</span>
                      <strong>{formatNullableScore(side.baseScore)}</strong>
                    </div>
                    <div>
                      <span className="muted">Punkte</span>
                      <strong>{formatNullableScore(side.fatigueModifier)}</strong>
                    </div>
                    <div>
                      <span className="muted">Moral</span>
                      <strong>{formatMoraleScoreEffect(side.moraleModifier)}</strong>
                    </div>
                    <div>
                      <span className="muted">Captain</span>
                      <strong>{formatNullableScore(side.captainBonusTotal)}</strong>
                    </div>
                    <div>
                      <span className="muted">Formkarten</span>
                      <strong>{formatNullableScore(side.formModifier)}</strong>
                    </div>
                    <div>
                      <span className="muted">Mutator</span>
                      <strong>{formatNullableScore(side.mutatorModifier)}</strong>
                    </div>
                    <div>
                      <span className="muted">Team-Power</span>
                      <strong>{formatNullableScore(side.teamPowerModifier)}</strong>
                    </div>
                    <div>
                      <span className="muted">Power</span>
                      <strong>{side.teamPowerLabel ?? "—"}</strong>
                    </div>
                    <div>
                      <span className="muted">Total</span>
                      <strong>{formatScore(side.totalScore)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Noch keine Preview berechnet.</p>
          )}
        </div>
      </details>
      ) : null}

      {showExpertBackupPanels ? (
      <details
        className="panel legacy-lineup-secondary-panel"
        open={isAiPreviewPanelOpen}
        onToggle={(event) => setIsAiPreviewPanelOpen(event.currentTarget.open)}
      >
        <summary>AI-Vorschau</summary>
        <div className="legacy-lineup-secondary-content">
          {aiPreview ? (
            <div className="legacy-lineup-lab-preview">
              <div className="legacy-ai-preview-head">
                <div className="legacy-ai-preview-meta">
                  <p>Team: {aiPreview.teamName}</p>
                  <p>Status: {aiPreview.status}</p>
                  <p>Erwarteter Score: {formatScore(aiPreview.totalExpectedScore)}</p>
                  <p>Captain-Regel: {aiPreview.captainRuleStatus}</p>
                  <p>Hinweise: {aiPreview.warnings.length}</p>
                  <p>Erklärung: {aiPreview.explanation}</p>
                </div>
                <div className="legacy-ai-preview-actions">
                  <button className="secondary-button" type="button" onClick={handleAdoptAiPreview}>
                    Vorschlag uebernehmen
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void handleSaveAiPreview()}
                    disabled={isBusy || isReadOnly}
                  >
                    AI-Vorschlag lokal speichern
                  </button>
                  <p className="muted">Uebernahme fuellt nur den UI-Draft. "Lineup speichern" bleibt der einzige Write.</p>
                  <p className="muted">AI-Speichern nutzt denselben lokalen Save-Pfad wie ein manuell gespeichertes Lineup.</p>
                  <Link
                    className="secondary-button"
                    href={`/foundation/legacy-resolve-lab?source=${encodeURIComponent(source)}&saveId=${encodeURIComponent(params.saveId)}&seasonId=${encodeURIComponent(params.seasonId)}&matchdayId=${encodeURIComponent(params.matchdayId)}`}
                  >
                    Resolve Preview öffnen
                  </Link>
                </div>
              </div>
              <div className="legacy-ai-preview-grid">
                {[aiPreview.d1, aiPreview.d2].map((side) => (
                  <section key={`${side.disciplineId ?? "missing"}-${side.disciplineSide}`} className="panel panel-compact legacy-ai-preview-side">
                    <div className="panel-header">
                      <h3>
                        {(side.disciplineSide ?? "—").toUpperCase()} · {side.disciplineName ?? "—"}
                      </h3>
                    </div>
                    <div className="legacy-ai-preview-kpis">
                      <span>Status: {side.status}</span>
                      <span>Slots: {side.selectedPlayers}/{side.requiredPlayers}</span>
                      <span>Captain: {side.captainName ?? "—"}</span>
                      <span>Score: {formatScore(side.expectedScore)}</span>
                    </div>
                    <ul className="legacy-ai-preview-player-list">
                      {side.selectedEntries.map((entry) => (
                        <li
                          key={`${side.disciplineSide}-${entry.activePlayerId ?? entry.playerId}`}
                          onDoubleClick={() => openPlayerDetails(entry.playerId, entry.activePlayerId)}
                        >
                          <strong>{entry.name ?? entry.playerId}</strong>
                          <span>
                            Base {formatNullableScore(entry.baseScore)} · {formatExhaustionPoints(entry.baseScore, entry.fatigueCount)} · Final{" "}
                            {formatNullableScore(entry.finalContribution)}
                          </span>
                          {entry.isCaptain ? <em>Captain</em> : null}
                        </li>
                      ))}
                      {side.selectedEntries.length === 0 ? <li>Keine Spieler vorgeschlagen.</li> : null}
                    </ul>
                    {side.fatigueWarnings.length > 0 ? (
                      <ul className="warning-list compact-list legacy-lineup-warning-list">
                        {side.fatigueWarnings.map((warning, index) => (
                          <li key={`${side.disciplineSide}-fatigue-${index}`}>{warning}</li>
                        ))}
                      </ul>
                    ) : null}
                    {side.warnings.length > 0 ? (
                      <ul className="warning-list compact-list legacy-lineup-warning-list">
                        {side.warnings.map((warning, index) => (
                          <li key={`${side.disciplineSide}-warning-${index}`}>{warning}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="muted">
                      Missing Slots: {side.missingSlots} · Team-Rank: {side.teamDisciplineRank ?? "—"}
                    </p>
                  </section>
                ))}
              </div>
              {aiPreview.warnings.length > 0 ? (
                <ul className="warning-list compact-list legacy-lineup-warning-list">
                  {aiPreview.warnings.map((warning, index) => (
                    <li key={`ai-preview-warning-${index}`}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="muted">Noch keine AI-Vorschau geladen.</p>
          )}
          {aiBatchPreview.length > 0 ? (
            <div className="table-shell" style={{ marginTop: 16 }}>
              {aiBatchSummary ? (
                <div className="legacy-ai-preview-kpis" style={{ marginBottom: 12 }}>
                  <span>Teams: {aiBatchSummary.totalTeams}</span>
                  <span>Ready: {aiBatchSummary.readyTeams}</span>
                  <span>Hinweise: {aiBatchSummary.warningTeams}</span>
                  <span>Blocked: {aiBatchSummary.blockedTeams}</span>
                </div>
              ) : null}
              <div className="legacy-lineup-secondary-actions" style={{ marginBottom: 12 }}>
                <button className="secondary-button" type="button" onClick={() => void handleAiBatchApply(true)} disabled={isBusy}>
                  Batch DryRun
                </button>
                <button className="primary-button" type="button" onClick={() => void handleAiBatchApply(false)} disabled={isBusy || isReadOnly}>
                  AI-Teams lokal speichern
                </button>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={aiBatchIncludeWarnings}
                    onChange={(event) => setAiBatchIncludeWarnings(event.target.checked)}
                    disabled={isBusy}
                  />
                  <span>Warning Teams einschließen</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={aiBatchOverwriteExisting}
                    onChange={(event) => setAiBatchOverwriteExisting(event.target.checked)}
                    disabled={isBusy}
                  />
                  <span>Bestehende Lineups ueberschreiben</span>
                </label>
              </div>
              <p className="muted" style={{ marginBottom: 12 }}>
                Nur Teams mit controlMode=ai und freigegebenem AI-Apply werden gespeichert.
              </p>
              {aiBatchApplyFeed ? (
                <div className="legacy-ai-preview-kpis" style={{ marginBottom: 12 }}>
                  <span>AI Eligible: {aiBatchApplyFeed.summary.aiEligibleTeams}</span>
                  <span>Manual uebersprungen: {aiBatchApplyFeed.summary.skippedManual}</span>
                  <span>Passive uebersprungen: {aiBatchApplyFeed.summary.skippedPassive}</span>
                  <span>Disabled uebersprungen: {aiBatchApplyFeed.summary.skippedDisabled}</span>
                  <span>Ready to Save: {aiBatchApplyFeed.summary.readyToSave}</span>
                  <span>Would Save: {aiBatchApplyFeed.summary.wouldSave}</span>
                  <span>Saved: {aiBatchApplyFeed.summary.savedTeams}</span>
                  <span>Hinweise uebersprungen: {aiBatchApplyFeed.summary.skippedWarning}</span>
                  <span>Skipped Blocked: {aiBatchApplyFeed.summary.skippedBlocked}</span>
                  <span>Skipped Existing: {aiBatchApplyFeed.summary.skippedExisting}</span>
                  <span>Existing: {aiBatchApplyFeed.summary.existingLineups}</span>
                  <span>Would Overwrite: {aiBatchApplyFeed.summary.wouldOverwrite}</span>
                </div>
              ) : null}
              <table className="data-table compact-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Control</th>
                    <th>AI Apply</th>
                    <th>D1 Status</th>
                    <th>D2 Status</th>
                    <th>Status</th>
                    <th>D1</th>
                    <th>D2</th>
                    <th>Score</th>
                    <th>Captain</th>
                    <th>Fehlende Slots</th>
                    <th>Hinweise</th>
                    <th>Apply</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {aiBatchPreview.map((entry) => (
                    <tr key={entry.teamId}>
                      <td>{entry.teamName}</td>
                      <td>{aiBatchApplyFeed?.results.find((result) => result.teamId === entry.teamId)?.controlMode ?? "—"}</td>
                      <td>{aiBatchApplyFeed?.results.find((result) => result.teamId === entry.teamId)?.aiEligible ? "ja" : "nein"}</td>
                      <td>{entry.d1Status}</td>
                      <td>{entry.d2Status}</td>
                      <td>{entry.status}</td>
                      <td>
                        {entry.d1DisciplineName ?? "—"}
                        <br />
                        <span className="muted">
                          {entry.d1SelectedPlayers}/{entry.d1RequiredPlayers}
                        </span>
                      </td>
                      <td>
                        {entry.d2DisciplineName ?? "—"}
                        <br />
                        <span className="muted">
                          {entry.d2SelectedPlayers}/{entry.d2RequiredPlayers}
                        </span>
                      </td>
                      <td>{formatScore(entry.totalExpectedScore)}</td>
                      <td>
                        {entry.d1CaptainName ?? "—"} / {entry.d2CaptainName ?? "—"}
                      </td>
                      <td>{entry.d1MissingSlots + entry.d2MissingSlots}</td>
                      <td>{entry.warnings.length}</td>
                      <td>
                        {aiBatchApplyFeed?.results.find((result) => result.teamId === entry.teamId)?.result ?? "—"}
                      </td>
                      <td>
                        <button className="secondary-button" type="button" onClick={() => void handleOpenAiBatchDetails(entry)}>
                          Team öffnen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </details>
      ) : null}

      {showExpertBackupPanels ? (
      <details className="panel legacy-lineup-secondary-panel">
        <summary>PPs pro Bereich</summary>
        <div className="legacy-lineup-secondary-content">
          <p className="muted">Analyse bleibt verfügbar, aber nicht mehr im direkten Einsetz-Workflow.</p>
          <div className="table-shell legacy-lineup-pps-table-shell">
            <table className="team-table legacy-lineup-pps-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>PPs</th>
                  <th>PP Pow</th>
                  <th>PP Spe</th>
                  <th>PP Men</th>
                  <th>PP Soc</th>
                </tr>
              </thead>
              <tbody>
                {powerPointsRows.map((row) => (
                  <tr key={row.teamCode}>
                    <td className={getTopRankClass(row.rank)}>{row.rank}</td>
                    <td>{row.teamCode}</td>
                    <td className={getTopRankClass(row.rank)}>{formatPpsScore(row.pps)}</td>
                    <td>{formatPpsScore(row.pow)}</td>
                    <td>{formatPpsScore(row.spe)}</td>
                    <td>{formatPpsScore(row.men)}</td>
                    <td>{formatPpsScore(row.soc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
      ) : null}

      {showExpertBackupPanels ? (
      <details className="panel legacy-lineup-secondary-panel">
        <summary>Arbeitsnotizen und Status</summary>
        <div className="legacy-lineup-secondary-content">
          <p className="muted">Aktuelle Einträge: {entries.length}</p>
          <p className="muted">Gespeicherter Draft: {draft ? draft.updatedAt : "noch keiner"}</p>
          <p className="muted">Ergebnisvorschau bleibt nur zum Anschauen. Kein Speichern, keine Ergebniswrites.</p>
          <p className="muted">Auto-Vorschlag bleibt nur zum Anschauen. Kein Auto-Speichern.</p>
        </div>
      </details>
      ) : null}
    </div>
  );

  if (props.embedded) {
    return inner;
  }

  return (
    <main className="app-shell foundation-shell">
      <section className="hero">
        <h1>Einsatzliste</h1>
        <p>{source === "prisma" ? "Referenzmodus" : "Lokaler Spielstand"}</p>
        <p className="muted">
          Diese Version arbeitet mit echtem lokalen Save-Kontext. Prisma bleibt nur Referenz.
        </p>
        <p>
          <Link href="/foundation?view=lineup">Zurück zur Foundation</Link>
        </p>
      </section>
      {inner}
    </main>
  );
}
