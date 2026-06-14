"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { LineupDraftModifiers, Player, PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";
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
import {
  calculateMatchdayProjectedPreview,
  getMatchdayIntensityConfig,
  resolveSlotRolesForDiscipline,
  type MatchdayIntensityStage,
  type MatchdaySlotRoleDefinition,
} from "@/lib/lineups/matchday-slot-roles";
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
  LegacyLineupLoadedContext,
  LegacyModifierSourceSummary,
  LegacyLineupPreviewResult,
} from "@/lib/lineups/legacy-lineup-types";
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
  onTeamChange?: (teamId: string) => void;
  playerCatalog?: Player[];
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
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

type MatchdayCardRoleInsight = {
  role: MatchdaySlotRoleDefinition | null;
  projected: ReturnType<typeof calculateMatchdayProjectedPreview> | null;
  majorValue: number | null;
  minorValue: number | null;
  strainValue: number | null;
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
    const projected = calculateMatchdayProjectedPreview({
      baseScore: baseScore ?? 0,
      role,
      attributeStats,
      currentFatigueCount: fatigueCount,
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
  if (Math.abs(low - high) < 0.05) {
    return `Projected ${formatDecimalScore(high, 1)}`;
  }
  return `Projected ${formatDecimalScore(low, 1)}–${formatDecimalScore(high, 1)}`;
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
    },
    d2: {
      primaryFormCardId: null,
      secondaryFormCardId: null,
      mutatorTrait1: null,
      mutatorTrait2: null,
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
  return `${formCardColorIcon[card.color]} ${card.playerName} · ${formatFormCardColorLabel(card.color)} · ${formatFormCardValueLabel(card.value)}${multiplier} · ${polarity}`;
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

function buildDraftStateFromAiPreview(preview: AiLegacyLineupPreview) {
  const nextSelections: Record<string, string> = {};
  for (const entry of preview.entries) {
    nextSelections[`${entry.disciplineId}::${entry.disciplineSide}::${entry.slotIndex}`] = entry.activePlayerId ?? "";
  }

  return {
    selections: nextSelections,
    captains: {
      d1: preview.d1.captainActivePlayerId ?? "",
      d2: preview.d2.captainActivePlayerId ?? "",
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
  const [slotIntensity, setSlotIntensity] = useState<Record<string, MatchdayIntensityStage>>({});
  const [captains, setCaptains] = useState<Record<"d1" | "d2", string>>({ d1: "", d2: "" });
  const [modifiers, setModifiers] = useState<LineupDraftModifiers>(() => createEmptyLineupModifiers());
  const [isBusy, setIsBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("");
  const [isReadOnly, setIsReadOnly] = useState<boolean>(source === "prisma");
  const [roomContext, setRoomContext] = useState<FoundationRoomContext | null>(null);
  const [playerFilter, setPlayerFilter] = useState("");
  const [showManagedTeams, setShowManagedTeams] = useState(false);
  const [draggedActivePlayerId, setDraggedActivePlayerId] = useState<string | null>(null);
  const [focusedDisciplineSide, setFocusedDisciplineSide] = useState<"d1" | "d2">("d1");
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
  const skipNextAutoPersistRef = useRef(false);
  useEffect(() => {
    setRoomContext(readFoundationRoomContextFromLocation());
  }, []);

  function withRoomQuery(query: URLSearchParams) {
    return appendRoomContextToParams(query, roomContext);
  }

  const resolvedPreview = preview?.ok ? preview : null;
  const d1Label = context?.matchdayContract?.discipline1?.displayName ?? "—";
  const d2Label = context?.matchdayContract?.discipline2?.displayName ?? "—";
  const d1Rank = context?.teamDisciplineRanks?.[context?.matchdayContract?.discipline1?.disciplineId ?? ""]?.rank ?? null;
  const d2Rank = context?.teamDisciplineRanks?.[context?.matchdayContract?.discipline2?.disciplineId ?? ""]?.rank ?? null;

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
    });
  }, [matchdayScorePreview, visibleScoreboardSide]);
  const visibleTopPlayers = useMemo<MatchdayMvpTopPlayerRow[]>(() => {
    if (!matchdayScorePreview || !visibleScoreboardSide) {
      return [];
    }

    return visibleScoreboardSide === "d1"
      ? matchdayScorePreview.d1TopPlayers ?? []
      : matchdayScorePreview.d2TopPlayers ?? [];
  }, [matchdayScorePreview, visibleScoreboardSide]);
  const playerRows = useMemo<LineupPlayerTableRow[]>(() => {
    if (!context) {
      return [];
    }

    const d1DisciplineId = context.matchdayContract?.discipline1?.disciplineId ?? null;
    const d2DisciplineId = context.matchdayContract?.discipline2?.disciplineId ?? null;
    const scoreMap = new Map(context.disciplineScores.map((entry) => [`${entry.playerId}::${entry.disciplineId}`, entry.score] as const));
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
  const selectedMatchdayOption = useMemo(
    () => options.matchdays.find((matchday) => matchday.id === params.matchdayId) ?? null,
    [options.matchdays, params.matchdayId],
  );
  const selectedTeamIsReady = Boolean(selectedTeamOption?.currentMatchdayReady);
  const selectedMatchdayIsReady = Boolean(selectedMatchdayOption?.isReady);
  const missingSeasonFormCards = Boolean(context && (context.formCards?.length ?? 0) === 0);
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
  const matchdayRosterLanes = useMemo(
    () => ({
      d1: matchdayRosterCards.filter((player) => player.fitLane === "d1"),
      flex: matchdayRosterCards.filter((player) => player.fitLane === "flex"),
      d2: matchdayRosterCards.filter((player) => player.fitLane === "d2"),
    }),
    [matchdayRosterCards],
  );

  const rosterCardByActivePlayerId = useMemo(() => {
    return new Map(
      matchdayRosterCards
        .filter((player) => Boolean(player.activePlayerId))
        .map((player) => [player.activePlayerId as string, player]),
    );
  }, [matchdayRosterCards]);
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

  const slotPreviewByKey = useMemo(() => {
    const previews = slots.map<MatchdaySlotPreviewCard>((slot) => {
      const selectedOption = getSelectedOptionMeta(selections[slot.key]);
      const selectedScore = getSelectedOptionScore(selectedOption, slot.disciplineId);
      const selectedRosterCard = rosterCardByActivePlayerId.get(selections[slot.key] ?? "");
      const sidePreview = resolvedPreview?.disciplineSideScores.find((entry) => entry.disciplineSide === slot.disciplineSide) ?? null;
      const role: MatchdaySlotRoleDefinition | null = slotRoleByKey.get(slot.key) ?? null;
      const intensity = slotIntensity[slot.key] ?? "normal";
      const knownModifierBonus =
        (sidePreview?.formModifier ?? 0) +
        (sidePreview?.mutatorModifier ?? 0) +
        (captains[slot.disciplineSide] === selections[slot.key] ? sidePreview?.captainBonusTotal ?? 0 : 0);
      const revealVariance =
        (context?.formCardSource?.effectStatus === "ready" ? 0 : 2) +
        (context?.mutatorSource?.effectStatus === "ready" ? 0 : 2);

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
          intensity,
          knownModifierBonus,
          revealVariance,
        }),
      };
    });

    return new Map(previews.map((entry) => [entry.slotKey, entry]));
  }, [
    captains,
    context?.formCardSource?.effectStatus,
    context?.mutatorSource?.effectStatus,
    resolvedPreview,
    rosterCardByActivePlayerId,
    selections,
    slotIntensity,
    slotRoleByKey,
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
              intensity: slotIntensity[slot.key] ?? "normal",
              knownModifierBonus: 0,
              revealVariance: 0,
            });
            return {
              activePlayerId: option.activePlayerId,
              name: option.name,
              projectedScore: projected.totalProjected ?? null,
              scoreDelta:
                projected.totalProjected != null && currentProjected != null
                  ? Number((projected.totalProjected - currentProjected).toFixed(1))
                  : null,
            };
          });

        return [slot.key, { topCandidates, currentProjected }] as const;
      }),
    );
  }, [rosterCardByActivePlayerId, slotIntensity, slotPreviewByKey, slotRoleByKey, slots]);
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
              intensity: slotIntensity[slot.key] ?? "normal",
              knownModifierBonus: 0,
              revealVariance: 0,
            });
            const currentProjected = slotPreviewByKey.get(slot.key)?.projected.totalProjected ?? null;
            return {
              slotKey: slot.key,
              disciplineSide: slot.disciplineSide,
              slotIndex: slot.slotIndex,
              projectedScore: projected.totalProjected ?? null,
              projectedDelta:
                projected.totalProjected != null && currentProjected != null
                  ? Number((projected.totalProjected - currentProjected).toFixed(1))
                  : null,
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
  }, [playerOptions, rosterCardByActivePlayerId, slotIntensity, slotPreviewByKey, slotRoleByKey, slots]);
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
        intensity: slotIntensity[slot.key] ?? "normal",
        knownModifierBonus: 0,
        revealVariance: 0,
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
  }, [captainSideByActivePlayerId, draggedActivePlayerId, rosterCardByActivePlayerId, slotIntensity, slotPreviewByKey, slotRoleByKey, slots]);

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
    const d1Required = context?.matchdayContract?.discipline1?.requiredPlayers ?? 0;
    const d2Required = context?.matchdayContract?.discipline2?.requiredPlayers ?? 0;
    const totalRequired = d1Required + d2Required;
    return `${context?.team.name ?? "Team"} · Spieltag ${context?.matchday.index ?? "—"} · ${d1Label} ${lineupMeta.d1Selected}/${d1Required || "—"} · ${d2Label} ${lineupMeta.d2Selected}/${d2Required || "—"} · Lineup ${lineupMeta.d1Selected + lineupMeta.d2Selected}/${totalRequired || "—"} · Captain ${captains.d1 || captains.d2 ? "gesetzt" : "offen"}`;
  }, [captains.d1, captains.d2, context?.matchday.index, context?.matchdayContract?.discipline1?.requiredPlayers, context?.matchdayContract?.discipline2?.requiredPlayers, context?.team.name, d1Label, d2Label, lineupMeta.d1Selected, lineupMeta.d2Selected]);

  const previewPanelWarnings = useMemo(() => {
    const nextWarnings = [...warnings];
    if (resolvedPreview?.validation?.warnings?.length) {
      nextWarnings.push(...resolvedPreview.validation.warnings);
    }
    if (!captains.d1 || !captains.d2) {
      nextWarnings.push("Kein Captain gesetzt");
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
  }, [captains.d1, captains.d2, resolvedPreview?.disciplineSideScores, resolvedPreview?.validation?.warnings, selections, slotPreviewByKey, slots, warnings]);

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
    const sumRangeLow = (entries: MatchdaySlotPreviewCard[]) =>
      entries.reduce((sum, entry) => sum + (entry.projected.rangeLow ?? entry.projected.totalProjected ?? 0), 0);
    const sumRangeHigh = (entries: MatchdaySlotPreviewCard[]) =>
      entries.reduce((sum, entry) => sum + (entry.projected.rangeHigh ?? entry.projected.totalProjected ?? 0), 0);
    const d1Projected = sumProjected(d1SlotPreviews);
    const d2Projected = sumProjected(d2SlotPreviews);
    const totalFatigue = sumFatigueCost(d1SlotPreviews) + sumFatigueCost(d2SlotPreviews);
    const openSlots =
      (bySide.d1?.missingPlayers ?? 0) + (bySide.d2?.missingPlayers ?? 0);
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
      totalFatigue,
      openSlots,
      totalProjected,
      totalBase,
      riskLevel,
    };
  }, [resolvedPreview, slotPreviewByKey, slots]);

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

    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    setMessage("");

    try {
      const response = await fetch(`/api/lineups/legacy/lab-context?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as LabContextResponse & { error?: string };

      if (!response.ok || payload.error) {
        setErrors([payload.error ?? "Lineup-Kontext konnte nicht geladen werden."]);
        return;
      }

      setSource(payload.source);
      setIsReadOnly(payload.readOnly);
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
      setSlotIntensity({});
      setCaptains(nextCaptains);
      setModifiers(normalizeLineupModifiers(payload.context?.existingDraft?.modifiers));
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void loadContext(defaultParamsFromProps(props), props.initialSource ?? "sqlite");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!props.embedded) {
      return;
    }
    if (
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
  }, [props.defaultMatchdayId, props.defaultSaveId, props.defaultSeasonId, props.defaultTeamId, props.initialSource]);

  useEffect(() => {
    if (!context) {
      return;
    }
    autoFlowReadyRef.current = true;
    lastAutoPersistKeyRef.current = draftStateKey;
    lastAutoPreviewKeyRef.current = "";
  }, [context, draftStateKey, params.matchdayId, params.saveId, params.seasonId, params.teamId, source]);

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
    setSlotIntensity({});
    setCaptains(nextCaptains);
    setModifiers(normalizeLineupModifiers(context?.existingDraft?.modifiers));
    setDraft(context?.existingDraft ?? null);
    setMessage(context?.existingDraft ? "Draft geladen." : "Kein bestehender Draft vorhanden.");
  }

  async function handleSaveDraft() {
    await saveEntries(entries, "Draft gespeichert.");
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

  async function saveEntries(
    entriesToSave: LegacyLineupEntryInput[],
    successMessage: string,
    options?: { silent?: boolean; resetTransientAfterReload?: boolean },
  ) {
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
        return;
      }

      setDraft(payload.draft ?? null);
      setWarnings(payload.warnings ?? []);
      if (!options?.silent) {
        setMessage(successMessage);
      }
      await loadContext(params, source, {
        resetTransient: options?.resetTransientAfterReload ?? true,
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function requestPreview(
    entriesToPreview: LegacyLineupEntryInput[],
    previewModifiers: LineupDraftModifiers,
    options?: { silent?: boolean },
  ) {
    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    if (!options?.silent) {
      setMessage("");
    }

    try {
      const query = new URLSearchParams(params);
      query.set("source", source);
      const response = await fetch(`/api/lineups/legacy/preview?${query.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entries: entriesToPreview, modifiers: previewModifiers }),
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
      if (nextReveal) {
        setScoreboardReveal((current) => ({
          ...current,
          [side]: {
            form: nextReveal.form ?? current[side].form,
            mutators: nextReveal.mutators ?? current[side].mutators,
          },
        }));
      }
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

  async function handleAiPreview() {
    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    setMessage("");

    try {
      const query = new URLSearchParams(params);
      query.set("source", source);
      const response = await fetch(`/api/lineups/legacy/ai-preview?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as AiPreviewResponse & { error?: string };

      if (!response.ok || !payload.preview) {
        setErrors(payload.errors ?? [payload.error ?? "AI-Vorschau konnte nicht geladen werden."]);
        setWarnings(payload.warnings ?? []);
        return;
      }

      setAiPreview(payload.preview);
      setAiBatchPreview([]);
      setAiBatchSummary(null);
      setIsAiPreviewPanelOpen(true);
      applyAiPreviewToUiDraft(payload.preview, {
        confirmOnOverwrite: true,
        message: "AI-Vorschlag geladen und in die Slots uebernommen. Noch nicht gespeichert.",
      });
    } finally {
      setIsBusy(false);
    }
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
      setErrors(["Prisma/Supabase mode is read-only in this build."]);
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
        ? `Jetzt ${aiBatchApplyFeed.summary.plannedLineups} AI-Teams lokal speichern? Warning-Teams werden eingeschlossen.`
        : `Jetzt ${aiBatchApplyFeed.summary.plannedLineups} Ready-AI-Teams lokal speichern?`;
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
        setMessage(`Batch DryRun bereit: ${payload.summary.plannedLineups} AI-Teams wuerden gespeichert.`);
      } else {
        await loadContext(params, source);
        await handleAiPreviewAllTeams();
        setMessage(`Batch gespeichert: ${payload.summary.savedTeams} AI-Teams lokal uebernommen.`);
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAiPreviewForTeam(teamId: string) {
    setIsBusy(true);
    setErrors([]);
    setWarnings([]);
    setMessage("");

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
        setErrors(payload.errors ?? [payload.error ?? "AI-Vorschau konnte nicht geladen werden."]);
        setWarnings(payload.warnings ?? []);
        return;
      }

      setAiPreview(payload.preview);
      setIsAiPreviewPanelOpen(true);
      applyAiPreviewToUiDraft(payload.preview, {
        confirmOnOverwrite: true,
        message: `${payload.preview.teamName}: AI-Vorschlag geladen und in die Slots uebernommen. Noch nicht gespeichert.`,
      });
    } finally {
      setIsBusy(false);
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
    setSlotIntensity({});
    setCaptains(nextDraft.captains);
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
    setWarnings(previewToApply.warnings ?? []);
    setMessage(options?.message ?? "AI-Vorschlag uebernommen – noch nicht gespeichert.");
    return true;
  }

  function updateSelection(slotKey: string, activePlayerId: string) {
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
    setSelections((current) => {
      const nextEntries = Object.fromEntries(
        Object.entries(current).map(([key, value]) => [key, value === activePlayerId && key !== slotKey ? "" : value]),
      );

      return {
        ...nextEntries,
        [slotKey]: activePlayerId,
      };
    });
  }

  function updateSlotIntensityStage(slotKey: string, intensity: MatchdayIntensityStage) {
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
    setSlotIntensity((current) => ({
      ...current,
      [slotKey]: intensity,
    }));
  }

  function assignPlayerToSide(activePlayerId: string, disciplineSide: "d1" | "d2") {
    const existingSlot = slots.find(
      (slot) => slot.disciplineSide === disciplineSide && selections[slot.key] === activePlayerId,
    );
    if (existingSlot) {
      setPreview(null);
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
    updateSelection(nextOpenSlot.key, activePlayerId);
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
    updateSelection(slotKey, droppedActivePlayerId);
    setDraggedActivePlayerId(null);
  }

  function updateCaptain(disciplineSide: "d1" | "d2", activePlayerId: string) {
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
    setCaptains((current) => ({
      ...current,
      [disciplineSide]: activePlayerId,
    }));
  }

  function updateModifier(
    disciplineSide: "d1" | "d2",
    key: keyof LineupDraftModifiers["d1"],
    value: string,
  ) {
    setPreview(null);
    setMatchdayScorePreview(null);
    setVisibleScoreboardSide(null);
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
      setErrors(["Prisma/Supabase mode is read-only in this build."]);
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

  function getCaptainOptionsForSide(disciplineSide: "d1" | "d2") {
    const activePlayerIds = new Set(
      slots
        .filter((slot) => slot.disciplineSide === disciplineSide)
        .map((slot) => selections[slot.key])
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

  function getSelectedFormCardOption(cardId: string | null | undefined) {
    if (!cardId) {
      return null;
    }

    return (context?.formCards ?? []).find((card) => card.id === cardId) ?? null;
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
    <div className="stack legacy-lineup-lab-grid">
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
                Matchday Room · Lineup Prep
              </TooltipHeading>
            </div>
          )}
          <span className={`legacy-lineup-readonly-chip ${isReadOnly ? "" : "is-local"}`}>
            {isReadOnly ? "Prisma read-only" : "SQLite/local"}
          </span>
        </div>
        <div className="legacy-matchday-header-compact">
          <strong>{matchdayHeaderSummary}</strong>
          <span>Quelle: {source === "prisma" ? "Prisma / Referenz" : "SQLite/local"} · Status: {selectedTeamOption?.controlMode ?? "manual"} · Draft {draft ? "gespeichert" : "offen"}</span>
        </div>
        {missingSeasonFormCards ? (
          <div className="legacy-lineup-inline-warning">
            <div>
              <strong>Formkarten fehlen noch für diese Season.</strong>
              <span>Erzeuge sie einmal global, bevor der Spieltag sauber revealed werden kann.</span>
            </div>
            <button className="secondary-button" type="button" onClick={() => void handleGenerateFormCards()} disabled={isBusy || isReadOnly}>
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
        <div className="legacy-lineup-action-bar">
          <button
            className={`secondary-button${isExpertModeEnabled ? " is-selected" : ""}`}
            type="button"
            onClick={() => setIsExpertModeEnabled((current) => !current)}
          >
            {isExpertModeEnabled ? "Expert Modus aus" : "Expert Modus an"}
          </button>
          {isExpertModeEnabled ? (
            <>
              <button className="secondary-button" type="button" onClick={() => void loadContext(params, source)} disabled={isBusy}>
                Kontext laden
              </button>
              <button className="secondary-button" type="button" onClick={() => void handlePreview()} disabled={isBusy}>
                Preview berechnen
              </button>
              <button className="secondary-button" type="button" onClick={() => void handleSaveDraft()} disabled={isBusy || isReadOnly}>
                Lineup speichern
              </button>
              <button className="secondary-button" type="button" onClick={() => void handleLoadDraft()} disabled={isBusy}>
                Draft laden
              </button>
              <button className="secondary-button" type="button" onClick={() => void handleAiPreview()} disabled={isBusy}>
                AI Team
              </button>
            </>
          ) : null}
        </div>
        <div className="legacy-lineup-status-strip">
          <span className="legacy-lineup-status-card">
            <strong>{activeSaveLabel}</strong>
            <span>Aktiver Save</span>
          </span>
          <span className="legacy-lineup-status-card">
            <strong>{source === "prisma" ? "Prisma / Referenz" : "SQLite / lokal"}</strong>
            <span>Quelle</span>
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
        {warnings.length > 0 || duplicateSelections.length > 0 ? (
          <ul className="warning-list compact-list legacy-lineup-warning-list">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
            {duplicateSelections.length > 0 ? <li>Doppelte Spielerwahl erkannt. Speichern bleibt blockiert, bis jede Auswahl eindeutig ist.</li> : null}
          </ul>
        ) : null}
      </section>

      <section className="panel legacy-matchday-room-panel">
        <div className="legacy-matchday-room-hero">
          <div className="legacy-matchday-room-team">
            <div className="legacy-matchday-room-logo-wrap">
              {teamLogoUrl ? (
                <img className="legacy-matchday-room-logo" src={teamLogoUrl} alt={`${context?.team.name ?? "Team"} Logo`} />
              ) : (
                <span className="legacy-matchday-room-logo legacy-matchday-room-logo-fallback">{teamLogoInitials || "TM"}</span>
              )}
            </div>
            <div className="legacy-matchday-room-copy">
              <span className="legacy-matchday-room-kicker">Matchday Room</span>
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
            <span className="pill">Control {selectedTeamOption?.controlMode ?? "manual"}</span>
            <span className="pill">
              {selectedTeamOption?.controlMode === "ai"
                ? "AI-Team ist im normalen Einsatz-Flow standardmäßig ausgeblendet."
                : "Manuelles Team im Fokus"}
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
            <strong>{captains.d1 || captains.d2 ? "gesetzt" : "offen"}</strong>
            <small>{context?.teamStatus?.captainUsedCount ?? 0}/{context?.teamStatus?.captainSlots ?? 3} saisonweit</small>
          </div>
        </div>
      </section>

      <div className="legacy-lineup-main-flow">
        <section className="panel legacy-lineup-player-panel">
          <div className="panel-header">
            <div>
              <TooltipHeading
                as="h2"
                tooltip="Spielerbilder und Matchday-Karten bilden jetzt den Hauptflow. D1-lastige Spieler stehen eher links, D2-lastige eher rechts."
              >
                Teamdeck / Assignment
              </TooltipHeading>
            </div>
            <div className="legacy-matchday-room-badges">
              <span className="pill">Schritt 1 · Spieler ziehen oder direkt senden</span>
              <span className="pill">Schritt 2 · Diszi im Fokus verfeinern</span>
            </div>
          </div>
          <div className="legacy-matchday-lane-grid">
            {([
              {
                key: "d1" as const,
                title: `${playerRows.length > 0 ? d1Label : "D1"} Fokus`,
                subtitle: "Linke Seite fuer Spieler mit klar besserem D1-Fit.",
                players: matchdayRosterLanes.d1,
              },
              {
                key: "flex" as const,
                title: "Flexible Mitte",
                subtitle: "Ausgleichsspieler, die beide Diszis solide abdecken.",
                players: matchdayRosterLanes.flex,
              },
              {
                key: "d2" as const,
                title: `${playerRows.length > 0 ? d2Label : "D2"} Fokus`,
                subtitle: "Rechte Seite fuer Spieler mit klar besserem D2-Fit.",
                players: matchdayRosterLanes.d2,
              },
            ]).map((lane) => (
              <section key={lane.key} className={`legacy-matchday-lane legacy-matchday-lane-${lane.key}`}>
                <div className="legacy-matchday-lane-head">
                  <div>
                    <TooltipHeading as="h3" tooltip={lane.subtitle}>
                      {lane.title}
                    </TooltipHeading>
                  </div>
                  <span className="legacy-matchday-lane-count">{lane.players.length}</span>
                </div>
                <div className="legacy-matchday-card-grid legacy-matchday-card-grid-lane">
                  {lane.players.map((player) => {
                    const focusedSideScore = focusedDisciplineSide === "d1" ? player.discipline1Score : player.discipline2Score;
                    const roleInsight = resolveBestCardRoleInsight(
                      slotRolesByDisciplineSide[focusedDisciplineSide],
                      player.attributeStats,
                      focusedSideScore,
                      player.fatigueCount,
                    );
                    const assignmentLabel = player.selectedSides.length > 0 ? `Aktiv in ${player.selectedSides.join(" + ").toUpperCase()}` : "Verfuegbar";
                    return (
                      <article
                        key={`card-${player.id}`}
                        className={`legacy-matchday-player-card${player.selectedSides.length > 0 ? " is-selected" : ""}`}
                        draggable={Boolean(player.activePlayerId)}
                        title={[
                          `${player.discipline1Label}: ${player.topAttributesD1.map((attribute) => `${attribute.shortLabel} ${attribute.ratingLabel ?? "—"}`).join(" · ")}`,
                          `${player.discipline2Label}: ${player.topAttributesD2.map((attribute) => `${attribute.shortLabel} ${attribute.ratingLabel ?? "—"}`).join(" · ")}`,
                          roleInsight?.role
                            ? `Fokus ${focusedDisciplineSide.toUpperCase()}: ${roleInsight.role.label} · Major ${attributeShortLabels[roleInsight.role.majorPositiveAttribute]} ${roleInsight.majorValue ?? "—"} · Minor ${attributeShortLabels[roleInsight.role.minorPositiveAttribute]} ${roleInsight.minorValue ?? "—"} · Strain ${attributeShortLabels[roleInsight.role.strainAttribute]} ${roleInsight.strainValue ?? "—"}`
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
                        onClick={() => {
                          if (!player.activePlayerId) {
                            return;
                          }
                          assignPlayerToSide(player.activePlayerId, focusedDisciplineSide);
                        }}
                        onDoubleClick={() => openPlayerDetails(player.id, player.activePlayerId)}
                      >
                        <div className="legacy-matchday-player-head">
                          {player.portraitUrl ? (
                            <img className="legacy-matchday-player-portrait" src={player.portraitUrl} alt={player.name} />
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
                          <span className={`legacy-matchday-player-score-chip ${getFatigueHeatClass(player.fatigueCount)}`}>
                            {formatFatigueHint(
                              Math.max(player.discipline1Score ?? 0, player.discipline2Score ?? 0),
                              player.fatigueCount,
                            )}
                          </span>
                          {player.captainEligible ? <span className="legacy-matchday-player-score-chip">Captain moeglich</span> : null}
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
                              {player.availabilityBlocker
                                ? "Blockiert"
                                : player.injuryStatus === "recovering"
                                  ? "Recovery"
                                  : "Verfuegbar"}
                            </strong>
                            <small>{player.injuryRiskLabel ?? formatFatigueHint(Math.max(player.discipline1Score ?? 0, player.discipline2Score ?? 0), player.fatigueCount)}</small>
                          </div>
                        </div>
                        {roleInsight?.role ? (
                          <div
                            className="legacy-matchday-player-role-strip"
                            title={`${roleInsight.role.label} · ${roleInsight.role.description} · Major ${attributeShortLabels[roleInsight.role.majorPositiveAttribute]} · Minor ${attributeShortLabels[roleInsight.role.minorPositiveAttribute]} · Strain ${attributeShortLabels[roleInsight.role.strainAttribute]}`}
                          >
                            <div className="legacy-matchday-player-role-values">
                              <span className="legacy-matchday-player-attribute-pill is-positive">
                                {attributeShortLabels[roleInsight.role.majorPositiveAttribute]} {roleInsight.majorValue ?? "—"}
                              </span>
                              <span className="legacy-matchday-player-attribute-pill is-positive">
                                {attributeShortLabels[roleInsight.role.minorPositiveAttribute]} {roleInsight.minorValue ?? "—"}
                              </span>
                              <span className="legacy-matchday-player-attribute-pill is-strain">
                                {attributeShortLabels[roleInsight.role.strainAttribute]} {roleInsight.strainValue ?? "—"}
                              </span>
                            </div>
                          </div>
                        ) : null}
                        <div className="legacy-matchday-player-actions">
                          <button
                            className="secondary-button inline-button"
                            type="button"
                            disabled={!player.activePlayerId}
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
                            onClick={(event) => {
                              event.stopPropagation();
                              player.activePlayerId && assignPlayerToSide(player.activePlayerId, "d2");
                            }}
                          >
                            {player.selectedSides.includes("d2") ? "Aus D2" : "Zu D2"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {lane.players.length === 0 ? (
                    <div className="legacy-matchday-lane-empty">
                      <span>Keine Spieler in dieser Fit-Gruppe.</span>
                    </div>
                  ) : null}
                </div>
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
                D1 / D2 Lineup-Zonen
              </TooltipHeading>
            </div>
            <div className="legacy-lineup-focus-switch">
              <button
                className={`secondary-button inline-button${focusedDisciplineSide === "d1" ? " is-selected" : ""}`}
                type="button"
                onClick={() => setFocusedDisciplineSide("d1")}
              >
                Fokus {d1Label}
              </button>
              <button
                className={`secondary-button inline-button${focusedDisciplineSide === "d2" ? " is-selected" : ""}`}
                type="button"
                onClick={() => setFocusedDisciplineSide("d2")}
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
              const disciplineColor = getFormCardColorForCategory(discipline?.category ?? null);
              const disciplineToneClass = getDisciplineToneClass(discipline?.category ?? null);

              return (
                <section
                  key={disciplineSide}
                  className={`panel legacy-lineup-side-panel ${disciplineSide === "d1" ? "legacy-lineup-side-panel-d1" : "legacy-lineup-side-panel-d2"} ${disciplineToneClass}${focusedDisciplineSide === disciplineSide ? " is-focused" : ""}`}
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
                  </div>
                  <div className="legacy-lineup-side-body legacy-lineup-arena-slot-grid">
                    {sideSlots.map((slot) => (
                      <label
                        key={slot.key}
                        className={`legacy-lineup-lab-slot-row legacy-lineup-slot-dropzone legacy-lineup-arena-slot ${draggedActivePlayerId ? "is-drop-ready" : ""} ${getDragFitTierClass(slotDragPreviewByKey.get(slot.key)?.fitTier ?? null)}`.trim()}
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
                          const sideEntry = sidePreview?.entries.find((entry) => entry.slotIndex === slot.slotIndex) ?? null;
                          const slotPreview = slotPreviewByKey.get(slot.key) ?? null;
                          const slotCandidateSummary = slotCandidateSummaryByKey.get(slot.key) ?? null;
                          const dragPreview = slotDragPreviewByKey.get(slot.key) ?? null;
                          const role = slotRoleByKey.get(slot.key) ?? null;
                          const intensity = slotIntensity[slot.key] ?? "normal";
                          const intensityConfig = getMatchdayIntensityConfig(intensity);
                          const roleAttributes =
                            selectedRosterCard && role
                              ? [
                                  {
                                    key: role.majorPositiveAttribute,
                                    shortLabel: attributeShortLabels[role.majorPositiveAttribute],
                                    ratingLabel: selectedRosterCard.attributeRatings?.[role.majorPositiveAttribute] ?? null,
                                  },
                                  {
                                    key: role.minorPositiveAttribute,
                                    shortLabel: attributeShortLabels[role.minorPositiveAttribute],
                                    ratingLabel: selectedRosterCard.attributeRatings?.[role.minorPositiveAttribute] ?? null,
                                  },
                                  {
                                    key: role.strainAttribute,
                                    shortLabel: attributeShortLabels[role.strainAttribute],
                                    ratingLabel: selectedRosterCard.attributeRatings?.[role.strainAttribute] ?? null,
                                  },
                                ]
                              : [];
                          return (
                            <>
                              <div className="legacy-lineup-arena-slot-head">
                                <span className="legacy-lineup-arena-slot-title">Slot {slot.slotIndex + 1}</span>
                                <div className="legacy-lineup-slot-head-tags">
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
                                        ? `${role.label} · ${role.description} · Major ${attributeShortLabels[role.majorPositiveAttribute]} · Minor ${attributeShortLabels[role.minorPositiveAttribute]} · Strain ${attributeShortLabels[role.strainAttribute]}`
                                        : `Slot ${slot.slotIndex + 1}`
                                    }
                                  >
                                    {role?.label ?? `Slot ${slot.slotIndex + 1}`}
                                  </span>
                                </div>
                              </div>
                              <div className="legacy-lineup-slot-summary-grid">
                                <div className="legacy-lineup-slot-summary-card">
                                  <span>Zweck</span>
                                  <strong>{role?.label ?? "Standard"}</strong>
                                  <small>{role?.description ?? `${discipline?.displayName ?? "Diszi"} Slot`}</small>
                                </div>
                                <div className="legacy-lineup-slot-summary-card">
                                  <span>Current</span>
                                  <strong>{slotPreview?.projected.totalProjected != null ? formatScore(slotPreview.projected.totalProjected) : "—"}</strong>
                                  <small>Base {selectedScore != null ? formatScore(selectedScore) : "—"}</small>
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
                              </div>
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
                              {selectedRosterCard ? (
                                <div className="legacy-lineup-slot-player-card">
                                  <div className="legacy-lineup-slot-player-head">
                                    {captains[slot.disciplineSide] === selections[slot.key] ? (
                                      <span className="legacy-lineup-slot-captain-pill">Captain</span>
                                    ) : null}
                                    {selectedRosterCard.portraitUrl ? (
                                      <img className="legacy-lineup-slot-player-portrait" src={selectedRosterCard.portraitUrl} alt={selectedRosterCard.name} />
                                    ) : (
                                      <span className="legacy-lineup-slot-player-portrait legacy-lineup-slot-player-portrait-fallback">—</span>
                                    )}
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
                                    {roleAttributes.map((attribute, index) => (
                                      <span
                                        key={`${slot.key}-${attribute.key}`}
                                        className={`legacy-lineup-slot-attribute-pill ${getTierStyleClass(attribute.ratingLabel)} ${index < 2 ? "is-positive" : "is-strain"}`}
                                        title={
                                          index === 0
                                            ? `Major ${attribute.shortLabel}`
                                            : index === 1
                                              ? `Minor ${attribute.shortLabel}`
                                              : `Strain ${attribute.shortLabel}`
                                        }
                                      >
                                        {attribute.shortLabel} {attribute.ratingLabel ?? "—"}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="legacy-lineup-slot-empty-card">
                                  <strong>Freier Slot</strong>
                                  <span>Spielerkarte aus dem Teamdeck oder Dropdown-Fallback nutzen.</span>
                                </div>
                              )}
                        <label className="legacy-lineup-lab-slot-row">
                          <span>Einsatzstufe</span>
                          <select
                            className="input"
                            value={intensity}
                            onChange={(event) => updateSlotIntensityStage(slot.key, event.target.value as MatchdayIntensityStage)}
                          >
                            <option value="conserve">Schonen</option>
                            <option value="normal">Normal</option>
                            <option value="push">Push</option>
                          </select>
                        </label>
                        <select
                          className="input"
                          value={selections[slot.key] ?? ""}
                          onChange={(event) => updateSelection(slot.key, event.target.value)}
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
                                  `E = Einsatz-Modifikator (${formatDecimalScore(intensityConfig.scoreModifier, 1)})`,
                                  `S = Projected Score (${slotPreview?.projected.totalProjected != null ? formatScore(slotPreview.projected.totalProjected) : "—"})`,
                                  `Fatigue Info = +${slotPreview?.projected.additionalFatigue ?? 0} · Risiko ${slotPreview?.projected.fatigueRisk ?? "—"} · Slot ${slotPreview?.projected.slotStrainLoad ?? "—"}`,
                                  slotPreview?.projected.warnings[0] ?? "Lineup okay",
                                ].join("\n")}
                              >
                                <span title="Base Score">B {selectedScore != null ? formatScore(selectedScore) : "—"}</span>
                                <span title="Rollen-Modifikator">R {formatSignedCompactInteger(slotPreview?.projected.roleModifier ?? 0)}</span>
                                <span title="Fatigue-Malus">F {formatNegativeCompactInteger(slotPreview?.projected.fatigueModifier ?? 0)}</span>
                                <span title="Einsatz-Modifikator">E {formatSignedCompactInteger(intensityConfig.scoreModifier)}</span>
                                <span className="legacy-lineup-selection-score-emphasis" title="Projected Score">S {slotPreview?.projected.totalProjected != null ? formatScore(slotPreview.projected.totalProjected) : "—"}</span>
                                <span title="Erwartete Zusatz-Erschöpfung">Ft {formatScore(slotPreview?.projected.additionalFatigue ?? 0)}</span>
                              </span>
                            </>
                          );
                        })()}
                      </label>
                    ))}
                    <label
                      className="legacy-lineup-lab-slot-row legacy-lineup-arena-slot legacy-lineup-arena-slot-captain"
                      onDoubleClick={() => openPlayerDetailsForActivePlayer(captains[disciplineSide])}
                    >
                      <span>Captain</span>
                      <select
                        className="input"
                        value={captains[disciplineSide]}
                        onChange={(event) => updateCaptain(disciplineSide, event.target.value)}
                      >
                        <option value="">Kein Captain</option>
                        {getCaptainOptionsForSide(disciplineSide).map((option) => (
                          <option key={option.activePlayerId} value={option.activePlayerId}>
                            {renderOptionLabel(option, discipline?.disciplineId ?? null)}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const selectedCaptain = getSelectedOptionMeta(captains[disciplineSide]);
                        const selectedCaptainScore = getSelectedOptionScore(selectedCaptain, discipline?.disciplineId ?? null);
                        return (
                          <span
                            className={`legacy-lineup-selection-meta ${getDisciplineHeatClass(selectedCaptainScore)} ${getFatigueHeatClass(selectedCaptain?.fatigueCount ?? null)}`.trim()}
                          >
                            Captain · Base {selectedCaptainScore != null ? formatScore(selectedCaptainScore) : "—"} ·{" "}
                            {formatExhaustionPoints(selectedCaptainScore, selectedCaptain?.fatigueCount ?? null)}
                          </span>
                        );
                      })()}
                    </label>
                    <div className="legacy-lineup-modifier-grid">
                      <label className="legacy-lineup-lab-slot-row">
                        <span>Formkarte Diszi</span>
                        <select
                          className="input"
                          value={modifiers[disciplineSide].primaryFormCardId ?? ""}
                          onChange={(event) => updateModifier(disciplineSide, "primaryFormCardId", event.target.value)}
                          disabled={isReadOnly || context?.formCardSource?.selectionStatus === "missing_source"}
                        >
                          <option value="">Keine Formkarte</option>
                          {getFormCardOptionsForSide(disciplineSide, "primary").map((card) => (
                            <option key={card.id} value={card.id}>
                              {formatFormCardOptionLabel(card, disciplineColor)}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const card = getSelectedFormCardOption(modifiers[disciplineSide].primaryFormCardId);
                          if (!card) return null;
                          return (
                            <span className={`legacy-lineup-form-card-chip is-${card.color}`}>
                              <span className="legacy-lineup-form-card-dot" aria-hidden="true" />
                              {formatFormCardColorLabel(card.color)} {formatFormCardValueLabel(card.value)}
                              {disciplineColor === card.color ? " · x2" : ""}
                            </span>
                          );
                        })()}
                      </label>
                      <label className="legacy-lineup-lab-slot-row">
                        <span>Formkarte D1/D2</span>
                        <select
                          className="input"
                          value={modifiers[disciplineSide].secondaryFormCardId ?? ""}
                          onChange={(event) => updateModifier(disciplineSide, "secondaryFormCardId", event.target.value)}
                          disabled={isReadOnly || context?.formCardSource?.selectionStatus === "missing_source"}
                        >
                          <option value="">Keine Bonus-Formkarte</option>
                          {getFormCardOptionsForSide(disciplineSide, "secondary").map((card) => (
                            <option key={card.id} value={card.id}>
                              {formatFormCardOptionLabel(card, disciplineColor)}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const card = getSelectedFormCardOption(modifiers[disciplineSide].secondaryFormCardId);
                          if (!card) return null;
                          return (
                            <span className={`legacy-lineup-form-card-chip is-${card.color}`}>
                              <span className="legacy-lineup-form-card-dot" aria-hidden="true" />
                              {formatFormCardColorLabel(card.color)} {formatFormCardValueLabel(card.value)}
                              {disciplineColor === card.color ? " · x2" : ""}
                            </span>
                          );
                        })()}
                      </label>
                    </div>
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
              <span className="pill">Quelle: {source === "prisma" ? "Prisma / Referenz" : "SQLite/local"}</span>
              <span className="pill">Draft {draft ? "gespeichert" : "offen"}</span>
            </div>
          </div>
          <div className="legacy-lineup-preview-panel-grid">
            <article className="metric-card">
              <span>D1 Projected Range</span>
              <strong>{formatProjectedWindow(matchdayPreviewCards.d1RangeLow ?? null, matchdayPreviewCards.d1RangeHigh ?? null)}</strong>
              <small>{d1Label} · offene Slots {matchdayPreviewCards.d1?.missingPlayers ?? 0}</small>
            </article>
            <article className="metric-card">
              <span>D2 Projected Range</span>
              <strong>{formatProjectedWindow(matchdayPreviewCards.d2RangeLow ?? null, matchdayPreviewCards.d2RangeHigh ?? null)}</strong>
              <small>{d2Label} · offene Slots {matchdayPreviewCards.d2?.missingPlayers ?? 0}</small>
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
              <small>{previewPanelWarnings.length ? `${previewPanelWarnings.length} Warnings` : "Keine offenen Warnings"}</small>
            </article>
          </div>
          <div className="legacy-lineup-preview-warning-panel">
            <strong>Warnings</strong>
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
            {visibleResultBoardSummary ? (
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
                              <img className="legacy-matchday-player-portrait" src={entry.portraitUrl} alt={entry.playerName} />
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
            <div className="table-shell legacy-lineup-scoreboard-table-shell">
              <table className="team-table legacy-lineup-scoreboard-table">
                <thead>
                  <tr>
                    <th>Rang</th>
                    <th>Δ</th>
                    <th>Team</th>
                    <th>Base</th>
                    <th>Loss</th>
                    <th>Current</th>
                    <th>Captain</th>
                    <th>Form</th>
                    {scoreboardReveal[visibleScoreboardSide].mutators ? <th>Mutator 1</th> : null}
                    {scoreboardReveal[visibleScoreboardSide].mutators ? <th>Mutator 2</th> : null}
                    <th>Bonus</th>
                    <th>Gesamt</th>
                    <th>Finale Punkte</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMatchdayScoreboard.map((entry) => (
                    <tr key={`legacy-lineup-scoreboard-${visibleScoreboardSide}-${entry.teamId}`}>
                      <td>{entry.rank}</td>
                      <td className={entry.rankDelta > 0 ? "is-positive-number" : entry.rankDelta < 0 ? "is-negative-number" : undefined}>
                        {formatSignedDelta(entry.rankDelta)}
                      </td>
                      <td>{entry.teamName}</td>
                      <td>{formatDecimalScore(entry.baseScore, 1)}</td>
                      <td>{formatDecimalScore(entry.lossScore, 1)}</td>
                      <td>{formatDecimalScore(entry.currentScore, 1)}</td>
                      <td>{entry.captainScore != null ? formatDecimalScore(entry.captainScore, 1) : "—"}</td>
                      <td>{entry.formScore != null ? formatDecimalScore(entry.formScore, 1) : "—"}</td>
                      {scoreboardReveal[visibleScoreboardSide].mutators ? (
                        <td>{entry.mutator1Label ? `${entry.mutator1Label} · ${formatDecimalScore(entry.mutator1Modifier, 1)}` : "—"}</td>
                      ) : null}
                      {scoreboardReveal[visibleScoreboardSide].mutators ? (
                        <td>{entry.mutator2Label ? `${entry.mutator2Label} · ${formatDecimalScore(entry.mutator2Modifier, 1)}` : "—"}</td>
                      ) : null}
                      <td>{entry.teamPpsStatus === "ready" ? formatDecimalScore(entry.bonusScore, 1) : "—"}</td>
                      <td>{formatDecimalScore(entry.score, 1)}</td>
                      <td>{entry.points != null ? formatDecimalScore(entry.points, 1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <div className="table-shell legacy-lineup-player-table-shell">
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
                    {playerRows.map((player) => (
                      <tr key={player.id} onDoubleClick={() => openPlayerDetails(player.id, player.activePlayerId)}>
                        {visibleLineupPlayerTableColumns.map((column) => {
                          if (column.id === "image") {
                            return (
                              <td key={column.id}>
                                {player.portraitUrl ? (
                                  <img className="legacy-lineup-player-portrait" src={player.portraitUrl} alt={player.name} />
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
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </details>
        ) : null}
      </div>

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
                <option value="sqlite">SQLite / lokal</option>
                <option value="prisma">Prisma / Referenz (read-only)</option>
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
            <span>Captain-Bonus gesamt: {formatNullableScore(resolvedPreview?.scorePreview.captainBonusTotal ?? null)}</span>
            <span>Formkarten gesamt: {formatNullableScore(resolvedPreview?.scorePreview.formModifier ?? null)}</span>
            <span>Mutator gesamt: {formatNullableScore(resolvedPreview?.scorePreview.mutatorModifier ?? null)}</span>
            <span>Formkarten-Status: {formatModifierSourceLabel(context?.formCardSource)}</span>
            <span>Mutator-Status: {formatModifierSourceLabel(context?.mutatorSource)}</span>
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
                  <p>Warnings: {aiPreview.warnings.length}</p>
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
                  <span>Warning: {aiBatchSummary.warningTeams}</span>
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
                  <span>Skipped Warning: {aiBatchApplyFeed.summary.skippedWarning}</span>
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
                    <th>Warnings</th>
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
          <p className="muted">Resolve Preview bleibt read-only. Kein Apply, keine Result-Writes.</p>
          <p className="muted">AI-Vorschlag bleibt read-only. Kein Auto-Speichern, kein AI-Apply.</p>
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
        <p>{source === "prisma" ? "Prisma/Supabase · read-only" : "SQLite/local · schreibbar"}</p>
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
