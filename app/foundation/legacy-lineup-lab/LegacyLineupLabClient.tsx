"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRafThrottledScrollTop } from "@/lib/foundation/use-raf-throttled-scroll";

import { calculateLocalLegacyLineupPreviewFromContext } from "@/lib/lineups/legacy-lineup-preview-from-context";
import DraftWorkspace from "@/app/foundation/legacy-lineup-lab/DraftWorkspace";
import LineupExpertPanels from "@/app/foundation/legacy-lineup-lab/LineupExpertPanels";
import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";
import { LegacyLineupVirtualCardGrid } from "@/app/foundation/legacy-lineup-lab/LegacyLineupVirtualTableBody";
import { useRowVirtualWindow } from "@/lib/foundation/use-row-virtual-window";
import { resolveFirstOpenFormPickCell } from "@/lib/foundation/resolve-first-open-form-cell";

import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import FoundationPlayerPortraitPreview from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
import { VeloImpactStrip } from "@/components/foundation/velo-ui";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import { isFoundationTeamManagementLocked } from "@/lib/foundation/foundation-admin-dev-flags";
import { getGameTermTooltip } from "@/components/ui/GameTerm";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { DisciplineCategory, FormCardPlanRecord, GameState, LineupDraftModifiers, Player, PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";
import {
  appendRoomContextToParams,
  readFoundationRoomContextFromLocation,
  type FoundationRoomContext,
} from "@/lib/room/foundation-room-context-client";
import { getFatiguePerformanceMultiplier, getFatiguePerformancePenaltyPercent, getInjuryRiskPercent } from "@/lib/fatigue/fatigue-calibration";
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
import { applyPlannedFormCardsToModifiers } from "@/lib/foundation/form-board-plan-service";
import {
  formatLegacyLineupDragBlockReason,
  getLegacyLineupDragFitTier,
  resolveLegacyLineupDragBlockReason,
  type LegacyLineupDragBlockReason,
  type LegacyLineupDragFitTier,
} from "@/lib/lineups/legacy-lineup-drag-drop";
import { getTransfermarktTierFromPoints } from "@/lib/market/transfermarkt-sheet-stats";
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
import { describeTeamPowerDebuffEffect, isTeamPowerDebuffEffect } from "@/lib/lineups/team-powers";
import type { AiLegacyLineupPreview } from "@/lib/ai/ai-needs-types";

// Perf/DX (#57): these three sub-views are each only rendered behind a single
// runtime condition (newLook flag, formBoard tab, focusV2 variant) — never all
// at once. Lazy-loading them keeps LegacyLineupLabClient's own dev compile
// graph from dragging in ~3.7k lines of sibling UI that a given session may
// never touch. ssr:false is safe: none of the three read window/document at
// module scope (only inside effects/handlers), and each is reached solely via
// client-side state after this component has already mounted, so there is no
// SSR/hydration path to preserve.
const LegacyLineupFocusV2Board = dynamic(
  () => import("@/app/foundation/legacy-lineup-lab-v2/LegacyLineupFocusV2Board"),
  {
    ssr: false,
    loading: () => <FoundationPanelSkeleton variant="lineup" label="Focus-Board wird geladen…" />,
  },
);
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
  playerOvr: number | null;
  playerPps: number | null;
  coreStats: {
    pow: number;
    spe: number;
    men: number;
    soc: number;
  } | null;
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
type TeamdeckSortMode = "fit" | "top" | "d1" | "d2" | "captain" | "fatigue" | "wish";
type TeamdeckCandidateQualityKey = "instant" | "alternative" | "fatigue" | "blocked" | "emergency";

type LineupPortraitPreviewSource = Pick<
  LineupPlayerTableRow,
  "id" | "name" | "portraitUrl" | "className" | "playerOvr" | "playerPps" | "coreStats"
>;

function wrapLineupPortraitHoverPreview(
  card: ReactNode,
  player: LineupPortraitPreviewSource,
  disabled = false,
) {
  if (!player.coreStats) {
    return card;
  }

  return (
    <FoundationPlayerPortraitPreview
      playerId={player.id}
      name={player.name}
      portraitUrl={player.portraitUrl}
      portraitInitials={player.name.slice(0, 2).toUpperCase()}
      playerOvr={player.playerOvr}
      playerMvs={null}
      playerPps={player.playerPps}
      pow={player.coreStats.pow}
      spe={player.coreStats.spe}
      men={player.coreStats.men}
      soc={player.coreStats.soc}
      leagueHeatPools={createEmptyLeaguePlayerHeatPools()}
      variant="team"
      context="roster"
      previewDensity="compact"
      playerClassName={player.className}
      disabled={disabled}
    >
      {card}
    </FoundationPlayerPortraitPreview>
  );
}

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
    { key: "choose" as const, label: "Wählen" },
    { key: "assign" as const, label: "Einsetzen" },
    { key: "next" as const, label: "Nächster Slot" },
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

function getDragFitTierClass(fitTier: LegacyLineupDragFitTier | string | null) {
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

const FATIGUE_UI_MEDIUM = 40;
const FATIGUE_UI_HIGH = 65;

function isElevatedFatigue(fatigue: number | null | undefined) {
  return (fatigue ?? 0) >= FATIGUE_UI_MEDIUM;
}

function formatFatigueImpactDetail(fatigue: number | null | undefined) {
  const value = Math.round(fatigue ?? 0);
  if (value <= 0) {
    return "Fatigue 0";
  }
  const penalty = getFatiguePerformancePenaltyPercent(fatigue);
  const injury = getInjuryRiskPercent(fatigue);
  return `Fatigue ${value} · −${formatDecimalScore(penalty, 1)}% Leistung · ${formatDecimalScore(injury, 1)}% Verletzungsrisiko`;
}

function getExhaustionMultiplier(fatigue: number | null | undefined) {
  return getFatiguePerformanceMultiplier(fatigue);
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

function formatFatigueRiskCauseLabel(
  fatigue: number | null | undefined,
  warnings: string[] | null | undefined,
  additionalFatigue?: number | null,
) {
  if (!isElevatedFatigue(fatigue) && !warnings?.length && !(additionalFatigue && additionalFatigue >= 3)) {
    return "stabil";
  }
  if (warnings?.length) {
    return warnings[0];
  }
  if ((fatigue ?? 0) >= FATIGUE_UI_HIGH) {
    return "hohe Vorbelastung";
  }
  if ((additionalFatigue ?? 0) >= 4) {
    return "Push macht ihn teurer";
  }
  return "mehr Last als normal";
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
  if (value >= FATIGUE_UI_HIGH) {
    return "is-fatigue-high";
  }
  if (value >= FATIGUE_UI_MEDIUM) {
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
        description: "Saubere Sofort-Picks für den aktiven Slot.",
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
        description: "Nur mit Bedacht einsetzen oder über Team-Einsatz abfedern.",
        tone: "warning" as const,
        order: 2,
      };
    case "blocked":
      return {
        label: "Blockiert / schon eingesetzt",
        description: "Sichtbar zum Verstehen, aber nicht für den direkten Flow.",
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
    if (normalized.includes("kostet bereits")) {
      return "Fatigue-Malus";
    }
    return "Fatigue-Risiko";
  }
  if (normalized.includes("form")) {
    return "Formkarten prüfen";
  }
  if (normalized.includes("off-role") || normalized.includes("passt schwach")) {
    return "Off-Role";
  }
  if (normalized.includes("starker slot-fit") || normalized.includes("playbook-profil")) {
    return "Guter Slot-Fit";
  }
  if (normalized.includes("push bei stark")) {
    return "Push riskant";
  }
  if (normalized.includes("rivalitaet") || normalized.includes("rivalitätsdruck")) {
    return "Rivalitätsdruck";
  }
  if (normalized.includes("schwaches") && normalized.includes("strain")) {
    return "Strain-Risiko";
  }
  if (normalized.includes("slotrolle fehlt")) {
    return "Keine Rolle";
  }
  if (normalized.includes("slot")) {
    return "Rollen-Hinweis";
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
  if (mode === "manual") return "geführt";
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
  const [lineupHandoffOverlay, setLineupHandoffOverlay] = useState<{
    teamName: string;
    d1Label: string;
    d2Label: string;
    scoreLabel: string;
  } | null>(null);
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
        // Bug T-002: getAvailableOptionsForSlot() prüft nur Slot-Kollision, NICHT
        // Verfügbarkeit/Captain-Regel/Slot-Regel. Ohne diesen Filter konnte
        // Best-Fit/Top-Pick einen laut Kandidatenliste blockierten Spieler
        // vorschlagen & zuweisen. Denselben Check wie teamdeckCandidateEntries
        // (resolveLegacyLineupDragBlockReason) anwenden, BEVOR sortiert/geslict wird.
        const topCandidates = sortOptionsByDisciplineSkill(
          getAvailableOptionsForSlot(slot.key).filter((option) => {
            const rosterCard = rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
            const blockReason = resolveLegacyLineupDragBlockReason({
              availabilityBlocker: rosterCard?.availabilityBlocker ?? null,
              selectedSides: rosterCard?.selectedSides ?? [],
              targetDisciplineSide: slot.disciplineSide,
              captainSide: captainSideByActivePlayerId.get(option.activePlayerId) ?? null,
              hasBaseScore: option.disciplineScores[slot.disciplineId] != null,
            });
            return blockReason == null;
          }),
          slot.disciplineId,
        )
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
              roleModifier: projected.roleModifier,
              rangeLow: projected.rangeLow,
              rangeHigh: projected.rangeHigh,
              warnings: projected.warnings,
            };
          });

        return [slot.key, { topCandidates, currentProjected }] as const;
      }),
    );
  }, [
    captainSideByActivePlayerId,
    context?.disciplinePlayerCounts,
    getDisciplineIntensity,
    rivalryPressureByDiscipline,
    rosterCardByActivePlayerId,
    slotPreviewByKey,
    slotRoleByKey,
    slots,
  ]);
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
          });
        // Keep the full ranked list here (bounded by slot count, so cheap); callers that only
        // want the top picks (e.g. classic "Wunsch" tags) slice further at the usage site. The
        // v2 focus board's player-focus highlight needs the delta for every slot, not just top 2.

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
          roleModifier: number;
          rangeLow: number | null;
          rangeHigh: number | null;
          warnings: string[];
          fatigueModifier: number;
          additionalFatigue: number;
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
            roleModifier: projected.roleModifier,
            rangeLow: projected.rangeLow,
            rangeHigh: projected.rangeHigh,
            warnings: projected.warnings,
            fatigueModifier: projected.fatigueModifier,
            additionalFatigue: projected.additionalFatigue,
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
        let detail = "Spielbar für diesen Slot.";
        let shortReason = `${formatNullableScore(projectedScore)} Score`;

        if (selectedElsewhere) {
          groupKey = "blocked";
          detail = `Schon in ${player.selectedSides.join(" + ").toUpperCase()} eingesetzt.`;
          shortReason = player.selectedSides.join(" + ").toUpperCase();
        } else if (activeSlotCandidate?.blockReason) {
          groupKey = "blocked";
          detail = formatLegacyLineupDragBlockReason(activeSlotCandidate.blockReason) ?? "Gerade nicht legal einsetzbar.";
          shortReason = "blockiert";
        } else if (isElevatedFatigue(player.fatigueCount)) {
          groupKey = "fatigue";
          detail = `${formatFatigueImpactDetail(player.fatigueCount)} macht den Pick spürbar riskanter.`;
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
                    : "Slots voll · Captain gesetzt · bereit für den Matchday-Save",
                tone: "ready" as const,
              }
            : {
                label: draft ? "Bereit für Arena" : "Preview prüfen",
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
        if (selectedOption?.injuryStatus === "injured") {
          issues.unshift({
            tone: "blocked",
            label: "Verletzt",
            detail: "Verletzter Spieler — aus dem Lineup nehmen oder ersetzen.",
          });
        } else if (selectedOption?.injuryStatus === "recovering") {
          issues.unshift({
            tone: "warning",
            label: "Recovery",
            detail: "Spieler erholt sich noch — Belastung reduzieren.",
          });
        }
        if (isElevatedFatigue(selectedOption?.fatigueCount)) {
          issues.push({
            tone: "warning",
            label: "Fatigue-Risiko",
            detail: `${formatFatigueImpactDetail(selectedOption?.fatigueCount)}: eher rotieren oder Team-Einsatz senken.`,
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
  const focusV2ArenaReady = useMemo(
    () => Boolean(draft) && lineupMiniAudit.blockingItems.length === 0 && matchdayPreviewCards.openSlots === 0,
    [draft, lineupMiniAudit.blockingItems.length, matchdayPreviewCards.openSlots],
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
      const d1Label = context?.matchdayContract?.discipline1?.displayName ?? "D1";
      const d2Label = context?.matchdayContract?.discipline2?.displayName ?? "D2";
      const scoreLabel = formatProjectedMetricWindow(matchdayPreviewCards.totalRangeLow, matchdayPreviewCards.totalRangeHigh);
      const prefersReducedMotion =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("lineup-v2-arena-handoff", "1");
      }
      if (prefersReducedMotion || !props.onOpenArena) {
        setMessage("Einsatzliste gespeichert — Wechsel zur Arena …");
        props.onOpenArena?.({
          saveId: params.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          teamId: params.teamId,
        });
        return;
      }
      setLineupHandoffOverlay({
        teamName: context?.team.name ?? "Team",
        d1Label,
        d2Label,
        scoreLabel,
      });
      window.setTimeout(() => {
        setLineupHandoffOverlay(null);
        props.onOpenArena?.({
          saveId: params.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          teamId: params.teamId,
        });
      }, 2000);
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
      const response = await fetch(`/api/lineups/legacy?${query.toString()}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entries: entriesToSave, modifiers }),
      });
      const payload = (await response.json()) as {
        draft?: LegacyLineupDraft;
        saveVersion?: number | null;
        contentSignature?: string | null;
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
              <option key={card.id} value={card.id}>
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
              <option key={card.id} value={card.id}>
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
