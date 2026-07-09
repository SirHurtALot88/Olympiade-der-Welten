"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import ArenaRevealPlaybackPanel from "@/app/foundation/matchday-arena-v2/ArenaRevealPlaybackPanel";
import MatchdayArenaPlayerCard from "@/components/matchday-arena/MatchdayArenaPlayerCard";
import { VeloImpactStrip, VeloStatOrbitRow, type VeloAxisKey } from "@/components/foundation/velo-ui";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { Player, Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";
import {
  buildArenaRankPoolSizes,
  getArenaAxisValueTier,
  getArenaFocusEntryCardTier,
  getArenaRankTier,
  resolveArenaEntryRankPools,
  type ArenaRankPoolState,
} from "@/lib/matchday-arena/arena-stat-visuals";
import { buildMatchdayMutatorTraitsBySide } from "@/lib/lineups/legacy-lineup-modifiers";
import { resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import {
  MATCHDAY_ARENA_PHASES,
  buildArenaPlayerRankLookup,
  buildArenaScoreTrackSegments,
  buildArenaSlotScoreByTeamId,
  buildArenaTeamRankMap,
  buildMatchdayArenaScoreboardView,
  countArenaMutatorHitsByTeam,
  formatArenaMutatorSelectionLabel,
  formatArenaRankDelta,
  getArenaStepRankDelta,
  getPreviousArenaRevealStep,
  getMatchdayArenaPhaseBreakdown,
  getMatchdayArenaPhaseDelta,
  getMatchdayArenaPhaseScore,
  ARENA_SCORE_TRACK_SEGMENT_LABELS,
  type MatchdayArenaScoreboardRowView,
  type MatchdayArenaPhaseBreakdownItem,
} from "@/lib/season/matchday-arena-presenter";
import type {
  MatchdayMvpScoringResult,
  MatchdayMvpTopPlayerRow,
} from "@/lib/season/matchday-mvp-scoring-service";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { normalizeRoomArenaState } from "@/lib/room/arena-sync-state";
import { getClientSocket } from "@/lib/socket/client";
import type { RoomJoinedPayload } from "@/types/events";
import type { CoachRole, OlyRoomState, RoomArenaState } from "@/types/game";
import {
  buildMatchdayArenaBaseSessionKey,
  buildMatchdayArenaResolveSessionKey,
  getMatchdayArenaBaseBundle,
  getMatchdayArenaResolvePreview,
  setMatchdayArenaBaseBundle,
  setMatchdayArenaResolvePreview,
} from "@/lib/foundation/matchday-arena-session-cache";

type MatchdayArenaV2ClientProps = {
  initialSource?: "sqlite" | "prisma";
  defaultSaveId: string;
  defaultSeasonId: string;
  defaultMatchdayId: string;
  defaultTeamId?: string | null;
  playerCatalog: Player[];
  teams: Team[];
  teamControlSettingsMap: Record<string, TeamControlSettings>;
  roomContext?: FoundationRoomContext | null;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onOpenTeam?: (teamId: string) => void;
  onBackToLineup?: (() => void) | null;
  onOpenMatchdayResult?: (() => void) | null;
  onOpenSeason?: (() => void) | null;
  onOpenTraining?: (() => void) | null;
};

type ArenaLabOptions = {
  teams: Array<{
    id: string;
    name: string;
    controlMode?: "manual" | "ai" | "passive";
  }>;
};

type ArenaContextResponse = {
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
  options: ArenaLabOptions;
  error?: string;
};

type ArenaBaseResponse = ArenaContextResponse & {
  ok?: boolean;
  scoreSummary?: MatchdayMvpScoringResult | null;
  scoreWarnings?: string[];
  scoreBlockingReasons?: string[];
  resolvePreview?: ArenaResolveResponse | null;
  standingsPreview?: ArenaStandingsPreviewResponse | null;
};

type ArenaResolveResponse = {
  source: "sqlite" | "prisma";
  params: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  summary: {
    d1DisciplineId: string | null;
    d1DisciplineName: string | null;
    d2DisciplineId: string | null;
    d2DisciplineName: string | null;
  };
  teamDetails: Array<{
    teamId: string;
    teamName: string;
    entries: Array<{
      disciplineSide: "d1" | "d2";
      slotIndex: number;
      playerId: string;
      activePlayerId: string | null;
      playerName: string;
      baseScore: number | null;
      fatigueAdjustedScore: number | null;
      captainBonus: number | null;
      mutatorBonus: number | null;
      mutatorPpsBonus?: number | null;
      finalPlayerScore: number | null;
      pointsAwarded: number | null;
      isCaptain: boolean;
      warnings: string[];
    }>;
  }>;
  topPlayers: {
    d1: Array<{
      playerId: string;
      rankInDiscipline: number;
      playerName: string;
      teamId: string;
      teamName: string;
      finalPlayerScore: number;
      pointsAwarded: number | null;
      mutatorPpsBonus?: number | null;
      slotIndex: number;
      isMvpCandidate: boolean;
    }>;
    d2: Array<{
      playerId: string;
      rankInDiscipline: number;
      playerName: string;
      teamId: string;
      teamName: string;
      finalPlayerScore: number;
      pointsAwarded: number | null;
      mutatorPpsBonus?: number | null;
      slotIndex: number;
      isMvpCandidate: boolean;
    }>;
  };
  playerCatalog: Array<{
    playerId: string;
    activePlayerId: string | null;
    teamId: string;
    teamName: string;
    name: string;
    portraitUrl: string | null;
    className: string | null;
  }>;
  warnings: string[];
  error?: string;
};

type ArenaStandingsPreviewResponse = {
  items: Array<{
    teamId: string;
    currentRank: number | null;
    projectedRank: number | null;
  }>;
  error?: string;
};

type ArenaPhaseControlSpeed = 1 | 2 | 4;
type ArenaDisciplinePhase = "d1" | "d2" | "total";
type ArenaDisciplineSide = "d1" | "d2";
type ArenaRevealPhaseId = (typeof MATCHDAY_ARENA_PHASES)[number]["id"];

type ArenaRevealSessionContext = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
};

type PersistedArenaRevealSession = {
  version: 1;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  activeDisciplinePhase: ArenaDisciplinePhase;
  phaseId: ArenaRevealPhaseId;
  revealedSlotCountByDiscipline: Record<ArenaDisciplineSide, number>;
  completedDisciplinePhases: Record<ArenaDisciplineSide, boolean>;
  focusTeamId: string | null;
  updatedAt: string;
};

const MATCHDAY_ARENA_REVEAL_SESSION_STORAGE_PREFIX = "matchday-arena-reveal-session-v1";

const ARENA_PLAYER_RANK_TOOLTIPS = {
  slotBase:
    "S# · Slot-Rang: Platz dieses Spielers im gleichen Slot (z. B. D1-2) über alle 32 Teams — nur Base-Score.",
  totalBase:
    "G# · Gesamtrang: Platz nach kumuliertem Base-Score in der aktiven Disziplin über alle Teams.",
  slotBoosted:
    "S+# · Slot-Rang mit Boni: wie S#, inkl. Form- und Mutator-Anteil — soweit im Reveal bereits sichtbar.",
  totalBoosted:
    "G+# · Gesamtrang mit Boni: wie G#, inkl. Form- und Mutator-Anteil — soweit im Reveal bereits sichtbar.",
} as const;

function renderArenaRankTag(
  label: string,
  rank: number | null,
  variant: "base" | "boosted",
  tooltip: string,
  poolSize: number,
) {
  const tier = getArenaRankTier(rank, poolSize);
  return (
    <span className={`arena-v2-rank-tag is-${variant} is-tier-${tier}`} title={tooltip}>
      <small>{label}</small>
      <strong>#{rank ?? "—"}</strong>
    </span>
  );
}

type ArenaPlayerAxisStat = {
  axis: "POW" | "SPE" | "MEN" | "SOC";
  value: number | null;
};

function axisStatsToOrbitStats(axisStats: ArenaPlayerAxisStat[]) {
  const stats = { pow: 0, spe: 0, men: 0, soc: 0 };
  for (const stat of axisStats) {
    const key = stat.axis.toLowerCase() as VeloAxisKey;
    if (key in stats && stat.value != null && Number.isFinite(stat.value)) {
      stats[key] = stat.value;
    }
  }
  return stats;
}

type ArenaFocusTeamEntryCard = {
  disciplineSide: "d1" | "d2";
  playerId: string;
  activePlayerId: string | null;
  playerName: string;
  teamName: string;
  className: string | null;
  portraitUrl: string | null;
  slotIndex: number;
  slotLabel: string;
  roleLabel: string;
  roleHint: string;
  baseScore: number | null;
  fatigueAdjustedScore: number | null;
  mutatorBonus: number | null;
  finalPlayerScore: number | null;
  pointsAwarded: number | null;
  mutatorPpsBonus?: number | null;
  isCaptain: boolean;
  warnings: string[];
  axisStats: ArenaPlayerAxisStat[];
  rankInSlotBase: number | null;
  rankTotalBase: number | null;
  rankInSlotBoosted: number | null;
  rankTotalBoosted: number | null;
};

type ArenaTopPlayerCard = MatchdayMvpTopPlayerRow & {
  portraitUrl: string | null;
  className: string | null;
  activePlayerId: string | null;
  axisStats: ArenaPlayerAxisStat[];
  badges: string[];
};

type ArenaMatchdayWinnerRow = {
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  rank: number;
  medal: "gold" | "silver" | "bronze" | null;
  d1Points: number | null;
  d2Points: number | null;
  totalPoints: number | null;
  d1Score: number | null;
  d2Score: number | null;
  totalScore: number;
  seasonRank: number | null;
  seasonRankDelta: number | null;
  d1Mutators: string[];
  d2Mutators: string[];
};

function formatDecimalScore(value: number | null | undefined, fractionDigits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatSignedDelta(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  if (Math.abs(value) < 0.05) {
    return "±0,0";
  }
  return `${value > 0 ? "+" : ""}${formatDecimalScore(value, 1)}`;
}

function formatSeasonRankChange(rank: number | null | undefined, delta: number | null | undefined) {
  if (rank == null || !Number.isFinite(rank)) {
    return "—";
  }
  if (delta == null || !Number.isFinite(delta) || delta === 0) {
    return `${rank}`;
  }
  return `${rank} (${delta > 0 ? "+" : ""}${delta})`;
}

function formatMutatorChip(label: string | null | undefined, modifier: number | null | undefined) {
  if (!label) {
    return null;
  }
  return `${label}${modifier != null && Number.isFinite(modifier) ? ` ${formatSignedDelta(modifier)}` : ""}`;
}

function formatArenaSourceLabel(value: string | null | undefined) {
  if (!value || value === "missing_source") {
    return "—";
  }
  return value;
}

function getPhaseDuration(speed: ArenaPhaseControlSpeed) {
  if (speed === 4) return 650;
  if (speed === 2) return 1050;
  return 1600;
}

async function readArenaJsonPayload<TPayload extends { error?: string }>(
  response: Response,
  fallbackError: string,
): Promise<TPayload> {
  try {
    return (await response.json()) as TPayload;
  } catch {
    return { error: fallbackError } as TPayload;
  }
}

function formatArenaWarning(message: string) {
  const planningTargetMatch = message.match(/^(.+): below_planning_target \((.+)\)$/);
  if (planningTargetMatch) {
    return `${planningTargetMatch[1]}: Einsatzliste noch nicht voll geplant (${planningTargetMatch[2]}).`;
  }
  if (message === "missing_lineups") {
    return "Es fehlen noch Einsatzlisten fuer diesen Spieltag.";
  }
  if (message.startsWith("resolve_preview:")) {
    return `Resolve-Vorschau fehlt: ${message.replace("resolve_preview:", "")}`;
  }
  if (message.startsWith("standings_preview:")) {
    return `Tabellen-Vorschau fehlt: ${message.replace("standings_preview:", "")}`;
  }
  if (message === "No existing legacy lineup draft was found for this team and matchday.") {
    return "Für dieses Team gibt es noch keine gespeicherte Einsatzliste.";
  }
  return message;
}

function getPlanningWarningTeamName(message: string) {
  return message.match(/^(.+): below_planning_target \(.+\)$/)?.[1]?.trim() ?? null;
}

function isArenaAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function formatArenaStatusLabel(status: string | null | undefined) {
  if (status === "ready") return "bereit";
  if (status === "blocked") return "blockiert";
  if (status === "warning") return "prüfen";
  if (status === "resolved") return "abgeschlossen";
  return "wartet";
}

type ArenaLoadStage = "idle" | "scoreboard" | "players" | "ready";

function formatArenaLoadStageLabel(stage: ArenaLoadStage, scoreStatus: string | null | undefined) {
  if (stage === "scoreboard") {
    return "Wertung lädt";
  }
  if (stage === "players") {
    return "Spieler laden";
  }
  if (stage === "ready") {
    return formatArenaStatusLabel(scoreStatus);
  }
  return "startet";
}

function formatArenaLoadStageHint(stage: ArenaLoadStage) {
  if (stage === "scoreboard") {
    return "32 Teams werden bewertet — Auto-Lineups, Formkarten und Resolve laufen im Hintergrund.";
  }
  if (stage === "players") {
    return "Teamboard ist bereit. Slot-Details und Spieler-Ränge werden noch nachgeladen.";
  }
  return null;
}

function getToneForTeam(
  teamId: string,
  selectedTeamId: string | null,
  teamOptions: ArenaLabOptions["teams"],
  teamControlSettingsMap: Record<string, TeamControlSettings>,
): "current" | "manual" | "ai" | "passive" {
  if (selectedTeamId && teamId === selectedTeamId) {
    return "current";
  }

  const option = teamOptions.find((entry) => entry.id === teamId) ?? null;
  const controlMode = option?.controlMode ?? teamControlSettingsMap[teamId]?.controlMode ?? "manual";
  if (controlMode === "passive") {
    return "passive";
  }
  if (controlMode === "ai") {
    return "ai";
  }
  return "manual";
}

function defaultArenaParams(props: MatchdayArenaV2ClientProps) {
  return {
    saveId: props.defaultSaveId,
    seasonId: props.defaultSeasonId,
    matchdayId: props.defaultMatchdayId,
    teamId: resolveArenaTeamId(props.teams, props.defaultTeamId),
  };
}

function resolveArenaTeamId(teams: Team[], teamId: string | null | undefined) {
  if (teamId && teams.some((team) => team.teamId === teamId)) {
    return teamId;
  }
  return teams[0]?.teamId ?? "";
}

function buildMatchdayArenaRevealSessionStorageKey(context: ArenaRevealSessionContext) {
  return [
    MATCHDAY_ARENA_REVEAL_SESSION_STORAGE_PREFIX,
    encodeURIComponent(context.saveId),
    encodeURIComponent(context.seasonId),
    encodeURIComponent(context.matchdayId),
  ].join(":");
}

function isArenaDisciplinePhase(value: unknown): value is ArenaDisciplinePhase {
  return value === "d1" || value === "d2" || value === "total";
}

function isArenaRevealPhaseId(value: unknown): value is ArenaRevealPhaseId {
  return MATCHDAY_ARENA_PHASES.some((phase) => phase.id === value);
}

function normalizeArenaRevealSlotCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(64, Math.floor(value))) : 0;
}

function readStoredMatchdayArenaRevealSession(context: ArenaRevealSessionContext): PersistedArenaRevealSession | null {
  if (typeof window === "undefined" || !context.saveId || !context.seasonId || !context.matchdayId) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildMatchdayArenaRevealSessionStorageKey(context));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedArenaRevealSession>;
    if (
      parsed.version !== 1 ||
      parsed.saveId !== context.saveId ||
      parsed.seasonId !== context.seasonId ||
      parsed.matchdayId !== context.matchdayId ||
      !isArenaDisciplinePhase(parsed.activeDisciplinePhase) ||
      !isArenaRevealPhaseId(parsed.phaseId)
    ) {
      return null;
    }

    const completedDisciplinePhases = {
      d1: Boolean(parsed.completedDisciplinePhases?.d1),
      d2: Boolean(parsed.completedDisciplinePhases?.d2),
    };
    if (parsed.activeDisciplinePhase === "d2") {
      completedDisciplinePhases.d1 = true;
    }
    if (parsed.activeDisciplinePhase === "total" || parsed.phaseId === "result") {
      completedDisciplinePhases.d1 = true;
      completedDisciplinePhases.d2 = true;
    }

    return {
      version: 1,
      saveId: context.saveId,
      seasonId: context.seasonId,
      matchdayId: context.matchdayId,
      activeDisciplinePhase: parsed.phaseId === "result" ? "total" : parsed.activeDisciplinePhase,
      phaseId: parsed.phaseId,
      revealedSlotCountByDiscipline: {
        d1: normalizeArenaRevealSlotCount(parsed.revealedSlotCountByDiscipline?.d1),
        d2: normalizeArenaRevealSlotCount(parsed.revealedSlotCountByDiscipline?.d2),
      },
      completedDisciplinePhases,
      focusTeamId: typeof parsed.focusTeamId === "string" && parsed.focusTeamId ? parsed.focusTeamId : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function persistMatchdayArenaRevealSession(session: PersistedArenaRevealSession) {
  if (typeof window === "undefined" || !session.saveId || !session.seasonId || !session.matchdayId) {
    return;
  }

  try {
    window.localStorage.setItem(
      buildMatchdayArenaRevealSessionStorageKey(session),
      JSON.stringify({
        ...session,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Local persistence is a resume convenience; the Arena still works without it.
  }
}

function removeStoredMatchdayArenaRevealSession(context: ArenaRevealSessionContext) {
  if (typeof window === "undefined" || !context.saveId || !context.seasonId || !context.matchdayId) {
    return;
  }

  try {
    window.localStorage.removeItem(buildMatchdayArenaRevealSessionStorageKey(context));
  } catch {
    // Ignore storage failures; reset still applies to in-memory reveal state.
  }
}

function clampPct(value: number) {
  return Math.max(6, Math.min(100, value));
}

function ArenaAnimatedScore({ value, fractionDigits = 1 }: { value: number; fractionDigits?: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = previousValueRef.current;
    const to = value;
    if (Math.abs(from - to) < 0.01) {
      setDisplayValue(to);
      previousValueRef.current = to;
      return;
    }
    previousValueRef.current = to;
    const start = performance.now();
    const duration = 420;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (to - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(to);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value]);

  return (
    <strong className="arena-v2-board-score is-counting">
      {formatDecimalScore(displayValue, fractionDigits)}
    </strong>
  );
}

const ARENA_BOARD_ROW_STRIDE = 66;
const ARENA_BOARD_VIRTUAL_OVERSCAN = 4;

function buildFocusedArenaBoardRows<T extends { teamId: string }>(rows: T[], userTeamId: string | null | undefined): T[] {
  if (!userTeamId || rows.length <= 10) {
    return rows;
  }
  const userIndex = rows.findIndex((row) => row.teamId === userTeamId);
  if (userIndex < 0) {
    return rows.slice(0, 10);
  }
  const indices = new Set<number>();
  for (let index = 0; index < Math.min(3, rows.length); index += 1) {
    indices.add(index);
  }
  for (let index = Math.max(0, userIndex - 3); index <= Math.min(rows.length - 1, userIndex + 3); index += 1) {
    indices.add(index);
  }
  return [...indices].sort((left, right) => left - right).map((index) => rows[index]!);
}

type ArenaAct = "prep" | "reveal" | "result";
type ArenaGuidedState = "loading" | "prep" | "ready" | "reveal" | "result";

type ArenaBoardRowModel = {
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  rank: number;
  stepRankDelta: number | null;
  score: number;
  points: number | null;
  baseRank?: number;
  rankDelta?: number;
  projectedRank?: number | null;
  tone: string;
  detailChips: string[];
  trackSegments?: Array<{ id: string; value: number; tone: string; label: string }>;
  breakdown?: MatchdayArenaPhaseBreakdownItem[];
};

type ArenaBoardRowProps = {
  row: ArenaBoardRowModel;
  maxBoardScore: number;
  widthPct: number;
  isSelected: boolean;
  isActiveTeam: boolean;
  effectiveBoardMode: string;
  isSlotsPhase: boolean;
  slotDelta: number | null;
  stepRankDeltaLabel: string | null;
  statSecondaryLabel: string | null;
  teamResult: { seasonRank?: number | null; seasonRankDelta?: number | null } | null;
  paramsTeamId: string;
  onTeamRowClick: (teamId: string) => void;
  onOpenTeam?: (teamId: string) => void;
  registerRowRef: (teamId: string, node: HTMLElement | null) => void;
};

const ArenaBoardRow = memo(function ArenaBoardRow({
  row,
  maxBoardScore,
  widthPct,
  isSelected,
  isActiveTeam,
  effectiveBoardMode,
  isSlotsPhase,
  slotDelta,
  stepRankDeltaLabel,
  statSecondaryLabel,
  teamResult,
  paramsTeamId,
  onTeamRowClick,
  onOpenTeam,
  registerRowRef,
}: ArenaBoardRowProps) {
  return (
    <article
      ref={(node) => registerRowRef(row.teamId, node)}
      className={`arena-v2-board-row is-${row.tone}${isSelected ? " is-selected" : ""}${isActiveTeam ? " is-active-team" : ""}`}
      role="listitem"
      tabIndex={0}
      aria-current={isSelected ? "true" : undefined}
      title={isSelected ? "Team-Fokus aufheben" : `${row.teamName} fokussieren`}
      onClick={() => onTeamRowClick(row.teamId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onTeamRowClick(row.teamId);
        }
      }}
    >
      <div className="arena-v2-board-row-main">
        <span className="arena-v2-board-rank">
          #{row.rank}
          {stepRankDeltaLabel ? (
            <span
              className={`arena-v2-board-rank-delta${(row.stepRankDelta ?? 0) > 0 ? " is-up" : " is-down"}`}
              title="Rangänderung seit dem letzten Reveal-Schritt"
            >
              {stepRankDeltaLabel}
            </span>
          ) : null}
        </span>
        {row.teamLogoUrl ? (
          <OptimizedMediaImage className="arena-v2-board-logo" src={row.teamLogoUrl} alt={`${row.teamName} Logo`} width={32} height={32} />
        ) : (
          <span className="arena-v2-board-logo arena-v2-board-logo-fallback">—</span>
        )}
        <div className="arena-v2-board-copy">
          <button
            type="button"
            className="table-link-button arena-v2-board-team-link"
            onClick={(event) => {
              event.stopPropagation();
              onOpenTeam?.(row.teamId);
            }}
          >
            {row.teamName}
          </button>
          {row.detailChips.length > 0 ? (
            <div className="arena-v2-board-chips">
              {row.detailChips.slice(0, effectiveBoardMode === "total" ? 2 : 4).map((chip) => (
                <span key={`${row.teamId}-${chip}`} className="pill arena-v2-board-chip">
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="arena-v2-board-track-wrap">
        <div className="arena-v2-board-track">
          {(row.trackSegments?.length ?? 0) > 0 ? (
            <div className="arena-v2-board-track-stack" style={{ width: `${widthPct}%` }}>
              {row.trackSegments!.map((segment) => (
                <span
                  key={`${row.teamId}-${segment.id}`}
                  className={`arena-v2-board-track-segment is-${segment.id} is-${segment.tone}`}
                  style={{ flexGrow: Math.max(Math.abs(segment.value), 0.01) }}
                  title={`${segment.label}: ${formatSignedDelta(segment.value)}`}
                />
              ))}
            </div>
          ) : (
            <div className="arena-v2-board-track-fill" style={{ width: `${widthPct}%` }} />
          )}
        </div>
        <span className="arena-v2-board-track-rank">Rang {row.rank}</span>
      </div>
      <div className="arena-v2-board-stats">
        <ArenaAnimatedScore value={row.score} />
        {statSecondaryLabel ? <span>{statSecondaryLabel}</span> : null}
      </div>
      {isSelected && (row.breakdown?.length ?? 0) > 0 ? (
        <VeloImpactStrip
          className="arena-v2-board-row-velo-strip"
          items={row.breakdown!.slice(0, 5).map((entry) => ({
            key: entry.id,
            label: entry.label,
            value: entry.valueLabel || "—",
            tone: entry.tone === "negative" ? "negative" : entry.tone === "positive" ? "positive" : "neutral",
          }))}
        />
      ) : null}
    </article>
  );
});

export default function MatchdayArenaV2Client(props: MatchdayArenaV2ClientProps) {
  const [params, setParams] = useState(() => defaultArenaParams(props));
  const [source, setSource] = useState<"sqlite" | "prisma">(props.initialSource ?? "sqlite");
  const [loadStage, setLoadStage] = useState<ArenaLoadStage>("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [context, setContext] = useState<LegacyLineupLoadedContext | null>(null);
  const [teamOptions, setTeamOptions] = useState<ArenaLabOptions["teams"]>([]);
  const [scoreFeed, setScoreFeed] = useState<MatchdayMvpScoringResult | null>(null);
  const [resolveFeed, setResolveFeed] = useState<ArenaResolveResponse | null>(null);
  const [standingsPreviewFeed, setStandingsPreviewFeed] = useState<ArenaStandingsPreviewResponse | null>(null);
  const [focusTeamId, setFocusTeamId] = useState<string | null>(props.defaultTeamId ?? null);
  const [activeDisciplinePhase, setActiveDisciplinePhase] = useState<ArenaDisciplinePhase>("d1");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [revealedSlotCountByDiscipline, setRevealedSlotCountByDiscipline] = useState<Record<ArenaDisciplineSide, number>>({
    d1: 0,
    d2: 0,
  });
  const [completedDisciplinePhases, setCompletedDisciplinePhases] = useState<Record<ArenaDisciplineSide, boolean>>({
    d1: false,
    d2: false,
  });
  const [restoredRevealSessionLabel, setRestoredRevealSessionLabel] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [revealEventActive, setRevealEventActive] = useState(false);
  const [mvpSpotlightActive, setMvpSpotlightActive] = useState(false);
  const [speed, setSpeed] = useState<ArenaPhaseControlSpeed>(1);
  const [roomSyncRole, setRoomSyncRole] = useState<CoachRole | null>(null);
  const [roomArenaSyncState, setRoomArenaSyncState] = useState<RoomArenaState | null>(null);
  const lastAppliedRoomArenaVersionRef = useRef<number | null>(null);
  const requestSequenceRef = useRef(0);
  const baseRequestAbortRef = useRef<AbortController | null>(null);
  const resolveRequestAbortRef = useRef<AbortController | null>(null);
  const detailRequestAbortRef = useRef<AbortController | null>(null);
  const boardListRef = useRef<HTMLDivElement | null>(null);
  const boardRowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scoreFeedCacheRef = useRef<Map<string, MatchdayMvpScoringResult>>(new Map());
  const revealPulseTimerRef = useRef<number | null>(null);
  const revealSignatureRef = useRef<string | null>(null);
  const [boardScrollTop, setBoardScrollTop] = useState(0);
  const [boardViewportHeight, setBoardViewportHeight] = useState(560);
  const [showArenaHandoffBanner, setShowArenaHandoffBanner] = useState(false);
  const [arenaShowAllTeams, setArenaShowAllTeams] = useState(false);
  const [broadcastFocusMode, setBroadcastFocusMode] = useState(false);

  const handleBackToLineup = useCallback(() => {
    if (typeof window !== "undefined") {
      const openSlots = Math.max(0, (context?.matchdayContract?.discipline1?.requiredPlayers ?? 0) + (context?.matchdayContract?.discipline2?.requiredPlayers ?? 0));
      window.sessionStorage.setItem(
        "lineup-v2-return-focus",
        JSON.stringify({ matchdayId: params.matchdayId, teamId: params.teamId, openSlotsHint: openSlots }),
      );
    }
    props.onBackToLineup?.();
  }, [context?.matchdayContract?.discipline1?.requiredPlayers, context?.matchdayContract?.discipline2?.requiredPlayers, params.matchdayId, params.teamId, props.onBackToLineup]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (window.sessionStorage.getItem("lineup-v2-arena-handoff") === "1") {
      setShowArenaHandoffBanner(true);
      window.sessionStorage.removeItem("lineup-v2-arena-handoff");
      const timer = window.setTimeout(() => setShowArenaHandoffBanner(false), 6500);
      return () => window.clearTimeout(timer);
    }
  }, []);
  const boardScrollRafRef = useRef<number | null>(null);
  const handleBoardScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    if (boardScrollRafRef.current != null) {
      return;
    }
    boardScrollRafRef.current = window.requestAnimationFrame(() => {
      setBoardScrollTop(scrollTop);
      boardScrollRafRef.current = null;
    });
  }, []);
  const teamRowClickTimerRef = useRef<number | null>(null);
  const hasAutoScrolledToFocusRef = useRef(false);
  const shouldScrollToActiveTeamAfterStepRef = useRef(false);
  const firstTeamId = props.teams[0]?.teamId ?? "";
  const externalParams = useMemo(() => defaultArenaParams(props), [
    props.defaultMatchdayId,
    props.defaultSaveId,
    props.defaultSeasonId,
    props.defaultTeamId,
    firstTeamId,
    props.teams.length,
  ]);

  const currentPhase =
    phaseIndex < 0
      ? null
      : (MATCHDAY_ARENA_PHASES[Math.min(phaseIndex, MATCHDAY_ARENA_PHASES.length - 1)]?.id ?? null);
  const displayPhase =
    currentPhase ?? MATCHDAY_ARENA_PHASES[0]?.id ?? "slots";

  async function loadResolvePreview(
    canonicalParams: typeof params,
    nextSource: typeof source,
    requestId: number,
    signal: AbortSignal,
  ) {
    const resolveCacheKey = buildMatchdayArenaResolveSessionKey({
      saveId: canonicalParams.saveId,
      seasonId: canonicalParams.seasonId,
      matchdayId: canonicalParams.matchdayId,
      source: nextSource,
    });
    const cachedResolve = getMatchdayArenaResolvePreview<ArenaResolveResponse>(resolveCacheKey);
    if (cachedResolve && requestSequenceRef.current === requestId && !signal.aborted) {
      setResolveFeed(cachedResolve);
      setLoadStage("ready");
      return;
    }

    const canonicalContextQuery = new URLSearchParams({
      saveId: canonicalParams.saveId,
      seasonId: canonicalParams.seasonId,
      matchdayId: canonicalParams.matchdayId,
      teamId: canonicalParams.teamId,
      source: nextSource,
    });

    try {
      const response = await fetch(`/api/resolve/legacy-matchday-preview?${canonicalContextQuery.toString()}`, {
        cache: "no-store",
        signal,
      });
      const payload = await readArenaJsonPayload<ArenaResolveResponse>(
        response,
        "Resolve-Vorschau hat keine lesbare Antwort geliefert.",
      );

      if (requestSequenceRef.current !== requestId || signal.aborted) {
        return;
      }

      if (response.ok && !payload.error) {
        setResolveFeed(payload);
        setMatchdayArenaResolvePreview(resolveCacheKey, payload);
        setWarnings((current) => Array.from(new Set([...current, ...payload.warnings])));
      } else {
        const detail = payload.error ?? "Resolve-Vorschau konnte nicht geladen werden.";
        setResolveFeed(null);
        setWarnings((current) => Array.from(new Set([...current, `resolve_preview:${detail}`])));
      }
    } catch (error) {
      if (isArenaAbortError(error) || signal.aborted || requestSequenceRef.current !== requestId) {
        return;
      }
      setResolveFeed(null);
      setWarnings((current) =>
        Array.from(
          new Set([
            ...current,
            `resolve_preview:${error instanceof Error ? error.message : String(error)}`,
          ]),
        ),
      );
    } finally {
      if (requestSequenceRef.current === requestId && !signal.aborted) {
        setLoadStage("ready");
      }
      if (resolveRequestAbortRef.current?.signal === signal) {
        resolveRequestAbortRef.current = null;
      }
    }
  }

  async function loadArena(nextParams = params, nextSource = source) {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    baseRequestAbortRef.current?.abort();
    resolveRequestAbortRef.current?.abort();
    detailRequestAbortRef.current?.abort();
    const baseController = new AbortController();
    baseRequestAbortRef.current = baseController;
    resolveRequestAbortRef.current = null;
    detailRequestAbortRef.current = null;
    const resolvedParams = {
      ...nextParams,
      teamId: resolveArenaTeamId(props.teams, nextParams.teamId),
    };

    if (!resolvedParams.saveId || !resolvedParams.seasonId || !resolvedParams.matchdayId || !resolvedParams.teamId) {
      if (requestSequenceRef.current === requestId) {
        setErrors(["Für Arena v2 fehlt Save-, Season-, Matchday- oder Team-Kontext."]);
        setLoadStage("idle");
      }
      return;
    }

    setLoadStage("scoreboard");
    if (requestSequenceRef.current === requestId) {
      setErrors([]);
      setWarnings([]);
      setResolveFeed(null);
    }

    try {
      const contextQuery = new URLSearchParams({
        saveId: resolvedParams.saveId,
        seasonId: resolvedParams.seasonId,
        matchdayId: resolvedParams.matchdayId,
        teamId: resolvedParams.teamId,
        source: nextSource,
        includeDetails: "0",
      });
      const scoreCacheKey = `${resolvedParams.saveId}:${resolvedParams.seasonId}:${resolvedParams.matchdayId}:${nextSource}`;
      const cachedScoreFeed = scoreFeedCacheRef.current.get(scoreCacheKey) ?? null;
      const arenaBaseSessionKey = buildMatchdayArenaBaseSessionKey({
        saveId: resolvedParams.saveId,
        seasonId: resolvedParams.seasonId,
        matchdayId: resolvedParams.matchdayId,
        teamId: resolvedParams.teamId,
        source: nextSource,
      });

      if (nextSource === "sqlite") {
        const cachedBundlePayload = getMatchdayArenaBaseBundle<ArenaBaseResponse>(arenaBaseSessionKey);
        if (cachedBundlePayload?.context) {
          const scoreSummary = cachedScoreFeed ?? cachedBundlePayload.scoreSummary ?? null;
          if (scoreSummary) {
            const storedRevealSession = props.roomContext
              ? null
              : readStoredMatchdayArenaRevealSession(cachedBundlePayload.params);
            setSource(cachedBundlePayload.source);
            setParams(cachedBundlePayload.params);
            setContext(cachedBundlePayload.context);
            setTeamOptions(cachedBundlePayload.options.teams);
            setScoreFeed(scoreSummary);
            scoreFeedCacheRef.current.set(scoreCacheKey, scoreSummary);
            setStandingsPreviewFeed(cachedBundlePayload.standingsPreview ?? null);
            setFocusTeamId(cachedBundlePayload.params.teamId);
            setWarnings(
              Array.from(
                new Set([
                  ...cachedBundlePayload.contextWarnings,
                  ...cachedBundlePayload.contextErrors,
                  ...(cachedBundlePayload.scoreWarnings ?? []),
                  ...(cachedBundlePayload.scoreBlockingReasons ?? []),
                  ...scoreSummary.warnings,
                  ...scoreSummary.blockingReasons,
                  ...(cachedBundlePayload.resolvePreview?.warnings ?? []),
                ]),
              ),
            );
            if (storedRevealSession) {
              setActiveDisciplinePhase(storedRevealSession.activeDisciplinePhase);
              setPhaseIndex(
                Math.max(0, MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === storedRevealSession.phaseId)),
              );
              setRevealedSlotCountByDiscipline(storedRevealSession.revealedSlotCountByDiscipline);
              setCompletedDisciplinePhases(storedRevealSession.completedDisciplinePhases);
              setRestoredRevealSessionLabel(
                `Fortgesetzt bei ${storedRevealSession.activeDisciplinePhase.toUpperCase()} · ${
                  MATCHDAY_ARENA_PHASES.find((phase) => phase.id === storedRevealSession.phaseId)?.label ?? "Slots"
                }`,
              );
            } else {
              setActiveDisciplinePhase("d1");
              setPhaseIndex(0);
              setRevealedSlotCountByDiscipline({ d1: 0, d2: 0 });
              setCompletedDisciplinePhases({ d1: false, d2: false });
              setRestoredRevealSessionLabel(null);
            }
            setIsPlaying(false);
            if (cachedBundlePayload.resolvePreview) {
              setResolveFeed(cachedBundlePayload.resolvePreview);
              setLoadStage("ready");
              return;
            }

            setLoadStage("players");
            const resolveController = new AbortController();
            resolveRequestAbortRef.current = resolveController;
            void loadResolvePreview(cachedBundlePayload.params, cachedBundlePayload.source, requestId, resolveController.signal);
            return;
          }
        }

        const bundleResponse = await fetch(`/api/matchday/arena-base?${contextQuery.toString()}`, {
          cache: "no-store",
          signal: baseController.signal,
        });
        const bundlePayload = await readArenaJsonPayload<ArenaBaseResponse>(
          bundleResponse,
          "Der Arena-v2-Basisblock hat keine lesbare Antwort geliefert.",
        );

        if (requestSequenceRef.current !== requestId || baseController.signal.aborted) {
          return;
        }

        if (!bundleResponse.ok || bundlePayload.error || !bundlePayload.context) {
          setErrors([bundlePayload.error ?? bundlePayload.contextErrors?.[0] ?? "Arena v2 konnte den Basisblock nicht laden."]);
          setContext(null);
          setScoreFeed(null);
          setLoadStage("idle");
          return;
        }

        const scoreSummary = cachedScoreFeed ?? bundlePayload.scoreSummary ?? null;
        if (!scoreSummary) {
          setErrors(["Arena v2 konnte die Spieltagswertung nicht laden."]);
          setParams(bundlePayload.params);
          setSource(bundlePayload.source);
          setContext(bundlePayload.context);
          setTeamOptions(bundlePayload.options.teams);
          setScoreFeed(null);
          setLoadStage("idle");
          return;
        }

        setMatchdayArenaBaseBundle(arenaBaseSessionKey, bundlePayload);

        const storedRevealSession = props.roomContext ? null : readStoredMatchdayArenaRevealSession(bundlePayload.params);
        setSource(bundlePayload.source);
        setParams(bundlePayload.params);
        setContext(bundlePayload.context);
        setTeamOptions(bundlePayload.options.teams);
        setScoreFeed(scoreSummary);
        scoreFeedCacheRef.current.set(scoreCacheKey, scoreSummary);
        setStandingsPreviewFeed(bundlePayload.standingsPreview ?? null);
        setFocusTeamId(bundlePayload.params.teamId);
        setWarnings(
          Array.from(
            new Set([
              ...bundlePayload.contextWarnings,
              ...bundlePayload.contextErrors,
              ...(bundlePayload.scoreWarnings ?? []),
              ...(bundlePayload.scoreBlockingReasons ?? []),
              ...scoreSummary.warnings,
              ...scoreSummary.blockingReasons,
              ...(bundlePayload.resolvePreview?.warnings ?? []),
            ]),
          ),
        );
        if (storedRevealSession) {
          setActiveDisciplinePhase(storedRevealSession.activeDisciplinePhase);
          setPhaseIndex(Math.max(0, MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === storedRevealSession.phaseId)));
          setRevealedSlotCountByDiscipline(storedRevealSession.revealedSlotCountByDiscipline);
          setCompletedDisciplinePhases(storedRevealSession.completedDisciplinePhases);
          setRestoredRevealSessionLabel(
            `Fortgesetzt bei ${storedRevealSession.activeDisciplinePhase.toUpperCase()} · ${
              MATCHDAY_ARENA_PHASES.find((phase) => phase.id === storedRevealSession.phaseId)?.label ?? "Slots"
            }`,
          );
        } else {
          setActiveDisciplinePhase("d1");
          setPhaseIndex(0);
          setRevealedSlotCountByDiscipline({ d1: 0, d2: 0 });
          setCompletedDisciplinePhases({ d1: false, d2: false });
          setRestoredRevealSessionLabel(null);
        }
        setIsPlaying(false);
        if (bundlePayload.resolvePreview) {
          setResolveFeed(bundlePayload.resolvePreview);
          setLoadStage("ready");
          return;
        }

        setLoadStage("players");

        const resolveController = new AbortController();
        resolveRequestAbortRef.current = resolveController;
        void loadResolvePreview(bundlePayload.params, bundlePayload.source, requestId, resolveController.signal);
        return;
      }

      const [contextResult, scoreResult] = await Promise.allSettled([
        fetch(`/api/lineups/legacy/lab-context?${contextQuery.toString()}`, {
          cache: "no-store",
          signal: baseController.signal,
        }).then(async (response) => ({
          ok: response.ok,
          payload: await readArenaJsonPayload<ArenaContextResponse>(
            response,
            "Der Arena-v2-Kontext hat keine lesbare Antwort geliefert.",
          ),
        })),
        cachedScoreFeed
          ? Promise.resolve({
              ok: true,
              payload: { summary: cachedScoreFeed },
            })
          : fetch("/api/season/matchday-mvp-score", {
          method: "POST",
          signal: baseController.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            saveId: resolvedParams.saveId,
            seasonId: resolvedParams.seasonId,
            matchdayId: resolvedParams.matchdayId,
            source: nextSource,
            dryRun: true,
            execute: false,
          }),
        }).then(async (response) => ({
          ok: response.ok,
          payload: await readArenaJsonPayload<{
            summary?: MatchdayMvpScoringResult;
            error?: string;
          }>(response, "Arena v2 konnte die 32er-Wertung nicht lesen."),
        })),
      ]);

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      if (contextResult.status === "rejected" && isArenaAbortError(contextResult.reason)) {
        return;
      }

      if (baseController.signal.aborted) {
        return;
      }

      if (
        contextResult.status === "rejected" ||
        (contextResult.status === "fulfilled" && (!contextResult.value.ok || contextResult.value.payload.error))
      ) {
        const detail =
          contextResult.status === "fulfilled"
            ? contextResult.value.payload.error ?? "Arena v2 konnte den Matchday-Kontext nicht laden."
            : contextResult.reason instanceof Error
              ? contextResult.reason.message
              : "Arena v2 konnte den Matchday-Kontext nicht laden.";
        setErrors([detail]);
        setContext(null);
        setScoreFeed(null);
        setLoadStage("idle");
        return;
      }

      const contextPayload = contextResult.value.payload;
      const canonicalParams = contextPayload.params;

      if (
        scoreResult.status === "rejected" &&
        !isArenaAbortError(scoreResult.reason) &&
        !baseController.signal.aborted
      ) {
        setErrors([
          scoreResult.reason instanceof Error
            ? `Arena v2 konnte die Spieltagswertung nicht laden: ${scoreResult.reason.message}`
            : "Arena v2 konnte die Spieltagswertung nicht laden.",
        ]);
        setParams(canonicalParams);
        setSource(contextPayload.source);
        setContext(contextPayload.context);
        setTeamOptions(contextPayload.options.teams);
        setScoreFeed(null);
        setLoadStage("idle");
        return;
      }

      if (scoreResult.status === "fulfilled" && (!scoreResult.value.ok || !scoreResult.value.payload.summary)) {
        const errorPayload = scoreResult.value.payload;
        setErrors([
          "error" in errorPayload && errorPayload.error
            ? errorPayload.error
            : "Arena v2 konnte die Spieltagswertung nicht laden.",
        ]);
        setParams(canonicalParams);
        setSource(contextPayload.source);
        setContext(contextPayload.context);
        setTeamOptions(contextPayload.options.teams);
        setScoreFeed(null);
        setLoadStage("idle");
        return;
      }

      if (scoreResult.status === "rejected" && isArenaAbortError(scoreResult.reason)) {
        return;
      }

      const scorePayload = scoreResult.status === "fulfilled" ? scoreResult.value.payload : null;
      if (!scorePayload?.summary) {
        return;
      }

      const storedRevealSession = props.roomContext ? null : readStoredMatchdayArenaRevealSession(canonicalParams);

      setSource(contextPayload.source);
      setParams(contextPayload.params);
      setContext(contextPayload.context);
      setTeamOptions(contextPayload.options.teams);
      setScoreFeed(scorePayload.summary);
      scoreFeedCacheRef.current.set(scoreCacheKey, scorePayload.summary);
      setStandingsPreviewFeed(null);
      setFocusTeamId(canonicalParams.teamId);
      setWarnings(
        Array.from(
          new Set([
            ...contextPayload.contextWarnings,
            ...contextPayload.contextErrors,
            ...scorePayload.summary.warnings,
            ...scorePayload.summary.blockingReasons,
          ]),
        ),
      );
      if (storedRevealSession) {
        setActiveDisciplinePhase(storedRevealSession.activeDisciplinePhase);
        setPhaseIndex(Math.max(0, MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === storedRevealSession.phaseId)));
        setRevealedSlotCountByDiscipline(storedRevealSession.revealedSlotCountByDiscipline);
        setCompletedDisciplinePhases(storedRevealSession.completedDisciplinePhases);
        setRestoredRevealSessionLabel(
          `Fortgesetzt bei ${storedRevealSession.activeDisciplinePhase.toUpperCase()} · ${
            MATCHDAY_ARENA_PHASES.find((phase) => phase.id === storedRevealSession.phaseId)?.label ?? "Slots"
          }`,
        );
      } else {
        setActiveDisciplinePhase("d1");
        setPhaseIndex(0);
        setRevealedSlotCountByDiscipline({ d1: 0, d2: 0 });
        setCompletedDisciplinePhases({ d1: false, d2: false });
        setRestoredRevealSessionLabel(null);
      }
      setIsPlaying(false);
      setLoadStage("players");

      const resolveController = new AbortController();
      resolveRequestAbortRef.current = resolveController;
      void loadResolvePreview(canonicalParams, contextPayload.source, requestId, resolveController.signal);
    } catch (error) {
      if (isArenaAbortError(error) || baseController.signal.aborted) {
        return;
      }
      if (requestSequenceRef.current === requestId) {
        setErrors([
          error instanceof Error
            ? `Arena v2 konnte nicht geladen werden: ${error.message}`
            : "Arena v2 konnte nicht geladen werden.",
        ]);
        setLoadStage("idle");
      }
    } finally {
      if (baseRequestAbortRef.current === baseController) {
        baseRequestAbortRef.current = null;
      }
    }
  }

  useEffect(() => {
    void loadArena(externalParams, props.initialSource ?? "sqlite");
    hasAutoScrolledToFocusRef.current = false;
    boardRowRefs.current.clear();
    return () => {
      requestSequenceRef.current += 1;
      baseRequestAbortRef.current?.abort();
      baseRequestAbortRef.current = null;
      resolveRequestAbortRef.current?.abort();
      resolveRequestAbortRef.current = null;
      detailRequestAbortRef.current?.abort();
      detailRequestAbortRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalParams, props.initialSource]);

  useEffect(() => {
    if (props.roomContext || !scoreFeed || !params.saveId || !params.seasonId || !params.matchdayId) {
      return;
    }

    persistMatchdayArenaRevealSession({
      version: 1,
      saveId: params.saveId,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      activeDisciplinePhase,
      phaseId: displayPhase,
      revealedSlotCountByDiscipline,
      completedDisciplinePhases,
      focusTeamId,
      updatedAt: new Date().toISOString(),
    });
  }, [
    activeDisciplinePhase,
    completedDisciplinePhases,
    displayPhase,
    focusTeamId,
    params.matchdayId,
    params.saveId,
    params.seasonId,
    revealedSlotCountByDiscipline,
    scoreFeed,
  ]);

  const d1Label = scoreFeed?.targetMatchday.d1DisciplineName ?? context?.matchdayContract?.discipline1?.displayName ?? "D1";
  const d2Label = scoreFeed?.targetMatchday.d2DisciplineName ?? context?.matchdayContract?.discipline2?.displayName ?? "D2";
  const d1Id = scoreFeed?.targetMatchday.d1DisciplineId ?? context?.matchdayContract?.discipline1?.disciplineId ?? null;
  const d2Id = scoreFeed?.targetMatchday.d2DisciplineId ?? context?.matchdayContract?.discipline2?.disciplineId ?? null;
  const d1Required = context?.matchdayContract?.discipline1?.requiredPlayers ?? 0;
  const d2Required = context?.matchdayContract?.discipline2?.requiredPlayers ?? 0;

  const isRoomHost = roomSyncRole === "A";
  const isRoomRevealSyncActive = Boolean(props.roomContext);
  const canControlArenaReveal = !isRoomRevealSyncActive || isRoomHost;
  const roomRevealWaitingForHost =
    isRoomRevealSyncActive && !isRoomHost && (roomArenaSyncState?.status ?? "idle") === "idle";

  function applyRoomArenaSync(arenaSync: RoomArenaState | null | undefined) {
    if (!arenaSync || arenaSync.status === "idle") {
      return;
    }
    if (arenaSync.saveId !== params.saveId) {
      return;
    }
    if (arenaSync.seasonId && arenaSync.seasonId !== params.seasonId) {
      return;
    }
    if (arenaSync.matchdayId && arenaSync.matchdayId !== params.matchdayId) {
      return;
    }
    if (lastAppliedRoomArenaVersionRef.current === arenaSync.version) {
      return;
    }

    lastAppliedRoomArenaVersionRef.current = arenaSync.version;
    const normalized = normalizeRoomArenaState(arenaSync);
    setActiveDisciplinePhase(normalized.activeDisciplinePhase);
    setPhaseIndex(normalized.phaseIndex);
    setRevealedSlotCountByDiscipline({ ...normalized.revealedSlotCountByDiscipline });
    setCompletedDisciplinePhases({ ...normalized.completedDisciplinePhases });
    setIsPlaying(false);
    shouldScrollToActiveTeamAfterStepRef.current = true;
  }

  useEffect(() => {
    if (!props.roomContext) {
      setRoomSyncRole(null);
      setRoomArenaSyncState(null);
      lastAppliedRoomArenaVersionRef.current = null;
      return undefined;
    }

    const roomContext = props.roomContext;
    const socket = getClientSocket();

    function handleRoomJoined(payload: RoomJoinedPayload) {
      if (payload.roomCode !== roomContext.roomCode.toUpperCase()) {
        return;
      }
      if (payload.participantId !== roomContext.participantId) {
        return;
      }
      setRoomSyncRole(payload.role);
      setRoomArenaSyncState(payload.state.arenaSyncState ?? null);
      applyRoomArenaSync(payload.state.arenaSyncState);
    }

    function handleRoomState(nextState: OlyRoomState) {
      if (nextState.roomCode !== roomContext.roomCode.toUpperCase()) {
        return;
      }
      setRoomArenaSyncState(nextState.arenaSyncState ?? null);
      applyRoomArenaSync(nextState.arenaSyncState);
    }

    socket.emit("rejoinRoom", {
      roomCode: roomContext.roomCode,
      seatToken: roomContext.seatToken,
    });
    socket.on("roomJoined", handleRoomJoined);
    socket.on("roomState", handleRoomState);

    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("roomState", handleRoomState);
    };
  }, [params.matchdayId, params.saveId, params.seasonId, props.roomContext]);

  const d1ScoreboardView = useMemo<MatchdayArenaScoreboardRowView[]>(
    () => buildMatchdayArenaScoreboardView(scoreFeed?.d1Scoreboard ?? []),
    [scoreFeed?.d1Scoreboard],
  );
  const d2ScoreboardView = useMemo<MatchdayArenaScoreboardRowView[]>(
    () => buildMatchdayArenaScoreboardView(scoreFeed?.d2Scoreboard ?? []),
    [scoreFeed?.d2Scoreboard],
  );

  const scoreboardByTeamId = useMemo(() => {
    return {
      d1: new Map(d1ScoreboardView.map((row) => [row.teamId, row] as const)),
      d2: new Map(d2ScoreboardView.map((row) => [row.teamId, row] as const)),
    };
  }, [d1ScoreboardView, d2ScoreboardView]);

  const standingsRankChangeByTeamId = useMemo(() => {
    return new Map(
      (standingsPreviewFeed?.items ?? []).map((item) => {
        const delta =
          item.currentRank != null && item.projectedRank != null
            ? item.currentRank - item.projectedRank
            : null;
        return [item.teamId, { projectedRank: item.projectedRank, delta }] as const;
      }),
    );
  }, [standingsPreviewFeed?.items]);

  const matchdayWinnerRows = useMemo<ArenaMatchdayWinnerRow[]>(() => {
    const teamIds = new Set<string>([
      ...props.teams.map((team) => team.teamId),
      ...scoreboardByTeamId.d1.keys(),
      ...scoreboardByTeamId.d2.keys(),
    ]);

    const rows = [...teamIds].map((teamId) => {
      const d1 = scoreboardByTeamId.d1.get(teamId) ?? null;
      const d2 = scoreboardByTeamId.d2.get(teamId) ?? null;
      const team = props.teams.find((entry) => entry.teamId === teamId) ?? null;
      const d1Points = d1?.points ?? null;
      const d2Points = d2?.points ?? null;
      const totalPoints =
        d1Points == null && d2Points == null ? null : Number(((d1Points ?? 0) + (d2Points ?? 0)).toFixed(1));
      const d1Score = d1?.score ?? null;
      const d2Score = d2?.score ?? null;
      const totalScore = Number(((d1Score ?? 0) + (d2Score ?? 0)).toFixed(1));
      const seasonRankChange = standingsRankChangeByTeamId.get(teamId) ?? null;

      return {
        teamId,
        teamName: d1?.teamName ?? d2?.teamName ?? team?.name ?? teamId,
        teamLogoUrl: team ? getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null, { variant: "thumb" }) : null,
        rank: 0,
        medal: null,
        d1Points,
        d2Points,
        totalPoints,
        d1Score,
        d2Score,
        totalScore,
        seasonRank: seasonRankChange?.projectedRank ?? null,
        seasonRankDelta: seasonRankChange?.delta ?? null,
        d1Mutators: [
          formatMutatorChip(d1?.mutator1Label, d1?.mutator1Modifier),
          formatMutatorChip(d1?.mutator2Label, d1?.mutator2Modifier),
        ].filter((entry): entry is string => Boolean(entry)),
        d2Mutators: [
          formatMutatorChip(d2?.mutator1Label, d2?.mutator1Modifier),
          formatMutatorChip(d2?.mutator2Label, d2?.mutator2Modifier),
        ].filter((entry): entry is string => Boolean(entry)),
      } satisfies ArenaMatchdayWinnerRow;
    });

    return rows
      .sort((left, right) => {
        if ((right.totalPoints ?? Number.NEGATIVE_INFINITY) !== (left.totalPoints ?? Number.NEGATIVE_INFINITY)) {
          return (right.totalPoints ?? Number.NEGATIVE_INFINITY) - (left.totalPoints ?? Number.NEGATIVE_INFINITY);
        }
        if (right.totalScore !== left.totalScore) {
          return right.totalScore - left.totalScore;
        }
        return left.teamName.localeCompare(right.teamName, "de");
      })
      .map((row, index) => ({
        ...row,
        rank: index + 1,
        medal: index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "bronze" : null,
      }));
  }, [props.teams, scoreboardByTeamId, standingsRankChangeByTeamId]);

  const matchdayWinnerByTeamId = useMemo(
    () => new Map(matchdayWinnerRows.map((row) => [row.teamId, row] as const)),
    [matchdayWinnerRows],
  );

  const resolvePlayerCatalogById = useMemo(
    () => new Map((resolveFeed?.playerCatalog ?? []).map((player) => [player.playerId, player] as const)),
    [resolveFeed?.playerCatalog],
  );
  const foundationPlayerById = useMemo(
    () => new Map(props.playerCatalog.map((player) => [player.id, player] as const)),
    [props.playerCatalog],
  );

  function resolveArenaPortrait(playerId: string, fallbackPortraitUrl?: string | null) {
    const foundationPlayer = foundationPlayerById.get(playerId) ?? null;
    return getPlayerPortraitBrowserUrl(
      playerId,
      fallbackPortraitUrl ?? foundationPlayer?.portraitUrl ?? null,
      foundationPlayer?.portraitPath ?? null,
      { variant: "thumb" },
    );
  }

  function resolveArenaClassName(playerId: string, fallbackClassName?: string | null) {
    const foundationPlayer = foundationPlayerById.get(playerId) ?? null;
    return fallbackClassName ?? foundationPlayer?.className ?? null;
  }

  function buildArenaAxisStats(playerId: string): ArenaPlayerAxisStat[] {
    const foundationPlayer = foundationPlayerById.get(playerId) ?? null;
    if (!foundationPlayer?.coreStats) {
      return [];
    }
    return [
      { axis: "POW", value: foundationPlayer.coreStats.pow ?? null },
      { axis: "SPE", value: foundationPlayer.coreStats.spe ?? null },
      { axis: "MEN", value: foundationPlayer.coreStats.men ?? null },
      { axis: "SOC", value: foundationPlayer.coreStats.soc ?? null },
    ];
  }

  const focusTeamDetail = useMemo(() => {
    if (!focusTeamId) {
      return null;
    }
    return resolveFeed?.teamDetails.find((entry) => entry.teamId === focusTeamId) ?? null;
  }, [focusTeamId, resolveFeed?.teamDetails]);

  const focusWinnerRow = useMemo(() => {
    if (!focusTeamId) {
      return null;
    }
    return matchdayWinnerByTeamId.get(focusTeamId) ?? null;
  }, [focusTeamId, matchdayWinnerByTeamId]);

  const focusTeam = useMemo(
    () => (focusTeamId ? props.teams.find((team) => team.teamId === focusTeamId) ?? null : null),
    [focusTeamId, props.teams],
  );
  const focusTeamName = focusWinnerRow?.teamName ?? focusTeamDetail?.teamName ?? focusTeam?.name ?? "Top Player";
  const focusTeamLogoUrl =
    focusWinnerRow?.teamLogoUrl ??
    (focusTeam ? getTeamLogoBrowserUrl(focusTeam.teamId, focusTeam.logoPath ?? null, { variant: "thumb" }) : null);

  const topPlayersBySide = useMemo(() => {
    const buildTopPlayers = (topPlayers: MatchdayMvpTopPlayerRow[], scoreboard: MatchdayArenaScoreboardRowView[]) =>
      [...topPlayers]
        .sort(
          (left, right) =>
            (right.pointsAwarded ?? Number.NEGATIVE_INFINITY) - (left.pointsAwarded ?? Number.NEGATIVE_INFINITY) ||
            right.finalPlayerScore - left.finalPlayerScore ||
            left.playerName.localeCompare(right.playerName, "de"),
        )
        .slice(0, 12)
        .map((player) => {
          const catalogPlayer = resolvePlayerCatalogById.get(player.playerId) ?? null;
          const scoreboardRow = scoreboard.find((entry) => entry.teamId === player.teamId) ?? null;
          const selectedTraitLabels = player.mutatorSelectedTraitLabels?.length
            ? player.mutatorSelectedTraitLabels
            : [scoreboardRow?.mutator1Label ?? null, scoreboardRow?.mutator2Label ?? null].filter(
                (label): label is string => Boolean(label),
              );

          const badges = [
            (player.mutatorPpsBonus ?? 0) > 0 || (player.mutatorScoreBonus ?? 0) > 0 ? "Mutator" : null,
            scoreboardRow?.formCardStatus === "ready" && (scoreboardRow.formCardModifier ?? 0) !== 0 ? "Form" : null,
            scoreboardRow?.captainStatus === "mapped" && (scoreboardRow.captainModifier ?? 0) !== 0 ? "Captain" : null,
            (player.pointsAwarded ?? 0) > 0 ? "PPs" : null,
          ].filter((badge): badge is string => Boolean(badge));

          return {
            ...player,
            portraitUrl: resolveArenaPortrait(player.playerId, catalogPlayer?.portraitUrl ?? null),
            className: resolveArenaClassName(player.playerId, catalogPlayer?.className ?? null),
            activePlayerId: catalogPlayer?.activePlayerId ?? null,
            axisStats: buildArenaAxisStats(player.playerId),
            badges,
            mutatorSelectedTraitLabels: selectedTraitLabels,
          } satisfies ArenaTopPlayerCard;
        });

    return {
      d1: buildTopPlayers(scoreFeed?.d1TopPlayers ?? [], d1ScoreboardView),
      d2: buildTopPlayers(scoreFeed?.d2TopPlayers ?? [], d2ScoreboardView),
    };
  }, [d1ScoreboardView, d2ScoreboardView, resolvePlayerCatalogById, foundationPlayerById, scoreFeed?.d1TopPlayers, scoreFeed?.d2TopPlayers]);

  const ppWinnerCards = useMemo(() => {
    return [...(scoreFeed?.ppWinners ?? [])]
      .sort(
        (left, right) =>
          (right.pointsAwarded ?? Number.NEGATIVE_INFINITY) - (left.pointsAwarded ?? Number.NEGATIVE_INFINITY) ||
          right.finalPlayerScore - left.finalPlayerScore,
      )
      .slice(0, 8)
      .map((player) => {
        const catalogPlayer = resolvePlayerCatalogById.get(player.playerId) ?? null;
        return {
          ...player,
          portraitUrl: resolveArenaPortrait(player.playerId, catalogPlayer?.portraitUrl ?? null),
          className: resolveArenaClassName(player.playerId, catalogPlayer?.className ?? null),
          activePlayerId: catalogPlayer?.activePlayerId ?? null,
          axisStats: buildArenaAxisStats(player.playerId),
          badges: [(player.pointsAwarded ?? 0) > 0 ? "PPs" : "Score"].filter(Boolean) as string[],
        } satisfies ArenaTopPlayerCard;
      });
  }, [scoreFeed?.ppWinners, resolvePlayerCatalogById, foundationPlayerById]);

  const slotsPhaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "slots");
  const finalPhaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "final");
  const resultPhaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "result");
  const isResultPhase = displayPhase === "result";
  const effectiveBoardMode: ArenaDisciplinePhase =
    isResultPhase && activeDisciplinePhase === "total"
      ? "total"
      : activeDisciplinePhase === "d2"
        ? "d2"
        : "d1";
  const activeDisciplineSide: ArenaDisciplineSide = effectiveBoardMode === "d2" ? "d2" : "d1";
  const matchdayMutatorTraitsBySide = useMemo(
    () =>
      params.saveId && params.seasonId && params.matchdayId
        ? buildMatchdayMutatorTraitsBySide({
            saveId: params.saveId,
            seasonId: params.seasonId,
            matchdayId: params.matchdayId,
            d1DisciplineId: d1Id,
            d2DisciplineId: d2Id,
          })
        : null,
    [d1Id, d2Id, params.matchdayId, params.saveId, params.seasonId],
  );
  const activeMatchdayMutatorLabel =
    matchdayMutatorTraitsBySide && effectiveBoardMode !== "total"
      ? matchdayMutatorTraitsBySide[activeDisciplineSide].join(" · ")
      : null;
  const matchdayMutatorLabelsBySide = useMemo(() => {
    if (!matchdayMutatorTraitsBySide) {
      return { d1: null, d2: null };
    }
    const formatSide = (traits: [string, string]) => traits.filter(Boolean).join(" · ") || null;
    return {
      d1: formatSide(matchdayMutatorTraitsBySide.d1),
      d2: formatSide(matchdayMutatorTraitsBySide.d2),
    };
  }, [matchdayMutatorTraitsBySide]);
  const canShowResultLayer =
    isResultPhase && activeDisciplinePhase === "total" && completedDisciplinePhases.d1 && completedDisciplinePhases.d2;
  const mvpSpotlightPlayer = ppWinnerCards[0] ?? null;
  const isArenaEventMode = isPlaying || revealEventActive;
  const canShowFinalLayer = effectiveBoardMode !== "total" && (displayPhase === "final" || canShowResultLayer);
  const revealedPhaseIndex = Math.max(0, MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === displayPhase));
  const isPhaseRevealed = (phaseId: (typeof MATCHDAY_ARENA_PHASES)[number]["id"]) => {
    const targetIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === phaseId);
    return targetIndex >= 0 && targetIndex <= revealedPhaseIndex;
  };

  useEffect(() => {
    if (!canShowResultLayer || displayPhase !== "result" || !mvpSpotlightPlayer) {
      setMvpSpotlightActive(false);
      return;
    }
    setMvpSpotlightActive(true);
    const timer = window.setTimeout(() => setMvpSpotlightActive(false), 2000);
    return () => window.clearTimeout(timer);
  }, [canShowResultLayer, displayPhase, mvpSpotlightPlayer?.playerId]);

  const d1SlotRoles = useMemo(
    () => resolveSlotRolesForDiscipline(d1Id, d1Label, d1Required),
    [d1Id, d1Label, d1Required],
  );
  const d2SlotRoles = useMemo(
    () => resolveSlotRolesForDiscipline(d2Id, d2Label, d2Required),
    [d2Id, d2Label, d2Required],
  );
  const activeDisciplineLabel = activeDisciplineSide === "d2" ? d2Label : d1Label;
  const activeSlotRoles = activeDisciplineSide === "d2" ? d2SlotRoles : d1SlotRoles;
  const maxD1SlotRevealCount = d1SlotRoles.length;
  const maxD2SlotRevealCount = d2SlotRoles.length;
  const maxSlotRevealCount = activeSlotRoles.length;

  function emitHostRoomArenaAdvance() {
    const roomContext = props.roomContext;
    if (!roomContext) {
      return;
    }

    const socket = getClientSocket();
    socket.emit("advanceRoomArenaStep", {
      roomCode: roomContext.roomCode,
      seatToken: roomContext.seatToken,
      maxSlotRevealCountByDiscipline: {
        d1: maxD1SlotRevealCount,
        d2: maxD2SlotRevealCount,
      },
      force: true,
    });
  }

  useEffect(() => {
    if (!props.roomContext || !isRoomHost || loadStage !== "ready") {
      return;
    }
    if ((roomArenaSyncState?.status ?? "idle") !== "idle") {
      return;
    }
    if (maxD1SlotRevealCount <= 0 && maxD2SlotRevealCount <= 0) {
      return;
    }

    const socket = getClientSocket();
    socket.emit("startRoomArena", {
      roomCode: props.roomContext.roomCode,
      seatToken: props.roomContext.seatToken,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      disciplineSide: "d1",
      maxSlotRevealCountByDiscipline: {
        d1: maxD1SlotRevealCount,
        d2: maxD2SlotRevealCount,
      },
    });
  }, [
    isRoomHost,
    loadStage,
    maxD1SlotRevealCount,
    maxD2SlotRevealCount,
    params.matchdayId,
    params.seasonId,
    props.roomContext,
    roomArenaSyncState?.status,
  ]);

  const revealedSlotCount = Math.min(
    revealedSlotCountByDiscipline[activeDisciplineSide],
    maxSlotRevealCount,
  );
  const activeDisciplineSlotsComplete = revealedSlotCount >= maxSlotRevealCount;
  const activeDisciplineRevealComplete = activeDisciplineSlotsComplete && phaseIndex >= finalPhaseIndex;
  const canSwitchToD2 =
    completedDisciplinePhases.d1 ||
    (activeDisciplinePhase === "d1" &&
      revealedSlotCountByDiscipline.d1 >= maxD1SlotRevealCount &&
      phaseIndex >= finalPhaseIndex);
  const canShowTotalResults =
    completedDisciplinePhases.d1 &&
    (completedDisciplinePhases.d2 ||
      (activeDisciplinePhase === "d2" &&
        revealedSlotCountByDiscipline.d2 >= maxD2SlotRevealCount &&
        phaseIndex >= finalPhaseIndex));
  const isSlotsPhase = displayPhase === "slots";

  useEffect(() => {
    const signature = `${activeDisciplinePhase}:${displayPhase}:${revealedSlotCount}:${phaseIndex}`;
    if (revealSignatureRef.current && revealSignatureRef.current !== signature) {
      setRevealEventActive(true);
      if (revealPulseTimerRef.current) {
        window.clearTimeout(revealPulseTimerRef.current);
      }
      revealPulseTimerRef.current = window.setTimeout(() => setRevealEventActive(false), 720);
    }
    revealSignatureRef.current = signature;
    return () => {
      if (revealPulseTimerRef.current) {
        window.clearTimeout(revealPulseTimerRef.current);
      }
    };
  }, [activeDisciplinePhase, displayPhase, phaseIndex, revealedSlotCount]);

  const slotScoresAtCount = useMemo(() => {
    const teamDetails = resolveFeed?.teamDetails ?? [];
    return (count: number) => buildArenaSlotScoreByTeamId(teamDetails, activeDisciplineSide, count);
  }, [activeDisciplineSide, resolveFeed?.teamDetails]);

  const slotScoreByTeamId = useMemo(() => {
    const scoreByTeamId = slotScoresAtCount(revealedSlotCount);
    const deltaByTeamId = new Map<string, number>();
    const targetSide = activeDisciplineSide;

    (resolveFeed?.teamDetails ?? []).forEach((team) => {
      const disciplineEntries = team.entries
        .filter((entry) => entry.disciplineSide === targetSide)
        .sort((left, right) => left.slotIndex - right.slotIndex);
      const currentSlotBase = disciplineEntries.find((entry) => entry.slotIndex === revealedSlotCount - 1)?.baseScore ?? null;
      if (currentSlotBase != null) {
        deltaByTeamId.set(team.teamId, Number(currentSlotBase.toFixed(1)));
      }
    });

    return {
      scoreByTeamId,
      deltaByTeamId,
    };
  }, [activeDisciplineSide, resolveFeed?.teamDetails, revealedSlotCount, slotScoresAtCount]);

  const arenaTeamRankMaps = useMemo(() => {
    if (effectiveBoardMode === "total") {
      return {
        currentRankByTeamId: new Map<string, number>(),
        stepRankDeltaByTeamId: new Map<string, number | null>(),
      };
    }

    const sourceRows = effectiveBoardMode === "d2" ? d2ScoreboardView : d1ScoreboardView;
    const currentStep = { phaseId: displayPhase, revealedSlotCount };
    const previousStep = getPreviousArenaRevealStep(currentStep, maxSlotRevealCount);
    const currentRankByTeamId = buildArenaTeamRankMap(sourceRows, currentStep, slotScoresAtCount);
    const previousRankByTeamId = previousStep
      ? buildArenaTeamRankMap(sourceRows, previousStep, slotScoresAtCount)
      : null;
    const stepRankDeltaByTeamId = new Map<string, number | null>();

    for (const row of sourceRows) {
      stepRankDeltaByTeamId.set(
        row.teamId,
        getArenaStepRankDelta(
          currentRankByTeamId.get(row.teamId),
          previousRankByTeamId?.get(row.teamId),
        ),
      );
    }

    return {
      currentRankByTeamId,
      stepRankDeltaByTeamId,
    };
  }, [
    d1ScoreboardView,
    d2ScoreboardView,
    displayPhase,
    effectiveBoardMode,
    maxSlotRevealCount,
    revealedSlotCount,
    slotScoresAtCount,
  ]);

  const arenaRankContextBySide = useMemo(() => {
    const visibleSlotCount = isSlotsPhase ? revealedSlotCount : maxSlotRevealCount;
    const teamDetails = resolveFeed?.teamDetails ?? [];
    const teamCount = Math.max(d1ScoreboardView.length, d2ScoreboardView.length, 1);

    const buildSide = (disciplineSide: "d1" | "d2", requiredPlayers: number) => {
      const sourceScoreboard = disciplineSide === "d2" ? d2ScoreboardView : d1ScoreboardView;
      const formModifierByTeamId = new Map(
        sourceScoreboard.map(
          (row) => [row.teamId, row.formCardStatus === "ready" ? row.formCardModifier ?? 0 : 0] as const,
        ),
      );
      const candidates = teamDetails.flatMap((team) =>
        team.entries
          .filter((entry) => entry.disciplineSide === disciplineSide && entry.slotIndex < visibleSlotCount)
          .map((entry) => ({
            playerId: entry.playerId,
            teamId: team.teamId,
            slotIndex: entry.slotIndex,
            baseScore: entry.baseScore,
            mutatorBonus: entry.mutatorBonus ?? null,
          })),
      );
      const poolSizes = buildArenaRankPoolSizes(candidates);
      const slotPoolFallback = teamCount;
      const totalPoolFallback = teamCount * Math.max(requiredPlayers, 1);

      return {
        lookup: buildArenaPlayerRankLookup({
          candidates,
          formModifierByTeamId,
          includeFormBonus: revealedPhaseIndex >= MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "form"),
          includeMutatorBonus: revealedPhaseIndex >= MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "mutator"),
        }),
        slotPoolSizeByIndex: poolSizes.slotPoolSizeByIndex,
        totalPoolSize: poolSizes.totalPoolSize,
        slotPoolFallback,
        totalPoolFallback,
      } satisfies ArenaRankPoolState & { lookup: ReturnType<typeof buildArenaPlayerRankLookup> };
    };

    return {
      d1: buildSide("d1", d1Required),
      d2: buildSide("d2", d2Required),
    };
  }, [
    d1Required,
    d1ScoreboardView,
    d2Required,
    d2ScoreboardView,
    isSlotsPhase,
    maxSlotRevealCount,
    resolveFeed?.teamDetails,
    revealedPhaseIndex,
    revealedSlotCount,
  ]);

  const boardDisciplineSide: "d1" | "d2" = effectiveBoardMode === "d2" ? "d2" : "d1";
  const mutatorHitCountByTeamId = useMemo(() => {
    if (!resolveFeed?.teamDetails || effectiveBoardMode === "total") {
      return new Map<string, { hits: number; players: number }>();
    }
    const visibleSlotCount = isSlotsPhase ? revealedSlotCount : maxSlotRevealCount;
    return countArenaMutatorHitsByTeam(resolveFeed.teamDetails, boardDisciplineSide, visibleSlotCount);
  }, [
    boardDisciplineSide,
    effectiveBoardMode,
    isSlotsPhase,
    maxSlotRevealCount,
    resolveFeed?.teamDetails,
    revealedSlotCount,
  ]);

  const focusScoreboardRow = useMemo(() => {
    if (!focusTeamId || effectiveBoardMode === "total") {
      return null;
    }
    const sourceRows = effectiveBoardMode === "d2" ? d2ScoreboardView : d1ScoreboardView;
    return sourceRows.find((row) => row.teamId === focusTeamId) ?? null;
  }, [d1ScoreboardView, d2ScoreboardView, effectiveBoardMode, focusTeamId]);

  const buildFocusEntries = (disciplineSide: "d1" | "d2") => {
    if (!focusTeamDetail) {
      return [];
    }
    const disciplineId = disciplineSide === "d1" ? d1Id : d2Id;
    const disciplineLabel = disciplineSide === "d1" ? d1Label : d2Label;
    const requiredPlayers = disciplineSide === "d1" ? d1Required : d2Required;
    const slotRoles = resolveSlotRolesForDiscipline(disciplineId, disciplineLabel, requiredPlayers);
    const roleByIndex = new Map(slotRoles.map((role, slotIndex) => [slotIndex, role] as const));

    return focusTeamDetail.entries
      .filter((entry) => entry.disciplineSide === disciplineSide)
      .sort((left, right) => left.slotIndex - right.slotIndex)
      .map((entry) => {
        const catalogPlayer = resolvePlayerCatalogById.get(entry.playerId) ?? null;
        const role = roleByIndex.get(entry.slotIndex) ?? null;
        const rankSnapshot =
          arenaRankContextBySide[disciplineSide].lookup.get(`${entry.playerId}::${entry.slotIndex}`) ?? null;
        return {
          disciplineSide,
          playerId: entry.playerId,
          activePlayerId: entry.activePlayerId,
          playerName: entry.playerName,
          teamName: focusTeamDetail.teamName,
          className: resolveArenaClassName(entry.playerId, catalogPlayer?.className ?? null),
          portraitUrl: resolveArenaPortrait(entry.playerId, catalogPlayer?.portraitUrl ?? null),
          slotIndex: entry.slotIndex,
          slotLabel: `${disciplineSide.toUpperCase()}-${entry.slotIndex + 1}${entry.isCaptain ? " · Captain" : ""}`,
          roleLabel: role?.label ?? `Slot ${entry.slotIndex + 1}`,
          roleHint: role?.description ?? "Spielerbeitrag in dieser Rolle.",
          baseScore: entry.baseScore,
          fatigueAdjustedScore: entry.fatigueAdjustedScore,
          mutatorBonus: entry.mutatorBonus,
          finalPlayerScore: entry.finalPlayerScore,
          pointsAwarded: entry.pointsAwarded,
          mutatorPpsBonus: entry.mutatorPpsBonus,
          isCaptain: entry.isCaptain,
          warnings: entry.warnings,
          axisStats: buildArenaAxisStats(entry.playerId),
          rankInSlotBase: rankSnapshot?.rankInSlotBase ?? null,
          rankTotalBase: rankSnapshot?.rankTotalBase ?? null,
          rankInSlotBoosted: rankSnapshot?.rankInSlotBoosted ?? null,
          rankTotalBoosted: rankSnapshot?.rankTotalBoosted ?? null,
        } satisfies ArenaFocusTeamEntryCard;
      });
  };

  const focusTeamEntries = useMemo(
    () => ({
      d1: buildFocusEntries("d1"),
      d2: buildFocusEntries("d2"),
    }),
    [focusTeamDetail, d1Id, d1Label, d1Required, d2Id, d2Label, d2Required, resolvePlayerCatalogById, foundationPlayerById, arenaRankContextBySide],
  );

  const boardRows = useMemo(() => {
    if (effectiveBoardMode === "total") {
      return matchdayWinnerRows.map((row) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        teamLogoUrl: row.teamLogoUrl,
        rank: row.rank,
        stepRankDelta: null,
        score: row.totalScore,
        points: row.totalPoints,
        baseRank: row.rank,
        rankDelta: row.seasonRankDelta ?? 0,
        projectedRank: row.seasonRank,
        tone: getToneForTeam(row.teamId, focusTeamId, teamOptions, props.teamControlSettingsMap),
        detailChips: [
          `${d1Label} ${formatDecimalScore(row.d1Points, 1)}`,
          `${d2Label} ${formatDecimalScore(row.d2Points, 1)}`,
        ],
        breakdown: [] as ReturnType<typeof getMatchdayArenaPhaseBreakdown>,
        trackSegments: [],
      }));
    }

    const sourceRows = effectiveBoardMode === "d2" ? d2ScoreboardView : d1ScoreboardView;
    const sideKey = effectiveBoardMode === "d2" ? "d2" : "d1";

    return [...sourceRows]
      .sort((left, right) => {
        const leftScore =
          isSlotsPhase
            ? slotScoreByTeamId.scoreByTeamId.get(left.teamId) ?? 0
            : getMatchdayArenaPhaseScore(left, displayPhase) ?? 0;
        const rightScore =
          isSlotsPhase
            ? slotScoreByTeamId.scoreByTeamId.get(right.teamId) ?? 0
            : getMatchdayArenaPhaseScore(right, displayPhase) ?? 0;
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        return left.teamName.localeCompare(right.teamName, "de");
      })
      .map((row, index) => {
        const mutatorHits = mutatorHitCountByTeamId.get(row.teamId)?.hits ?? null;
        const mutatorSelection = activeMatchdayMutatorLabel ?? formatArenaMutatorSelectionLabel(row);
        const slotsScore = isSlotsPhase ? slotScoreByTeamId.scoreByTeamId.get(row.teamId) ?? 0 : null;
        const trackSegments = buildArenaScoreTrackSegments(row, displayPhase, { slotsScore });
        return {
          teamId: row.teamId,
          teamName: row.teamName,
          teamLogoUrl: getTeamLogoBrowserUrl(row.teamId, props.teams.find((team) => team.teamId === row.teamId)?.logoPath ?? null, { variant: "thumb" }),
          rank: arenaTeamRankMaps.currentRankByTeamId.get(row.teamId) ?? index + 1,
          stepRankDelta: arenaTeamRankMaps.stepRankDeltaByTeamId.get(row.teamId) ?? null,
          score:
            isSlotsPhase
              ? slotScoreByTeamId.scoreByTeamId.get(row.teamId) ?? 0
              : getMatchdayArenaPhaseScore(row, displayPhase) ?? row.score,
          points: canShowResultLayer ? row.points : null,
          baseRank: row.baseRank,
          rankDelta: row.rankDelta,
          projectedRank: standingsRankChangeByTeamId.get(row.teamId)?.projectedRank ?? null,
          tone: getToneForTeam(row.teamId, focusTeamId, teamOptions, props.teamControlSettingsMap),
          detailChips: [
            isPhaseRevealed("push")
              ? row.intensity
                ? `${row.intensity === "push" ? "Push" : row.intensity === "conserve" ? "Schonen" : "Normal"} ${formatSignedDelta(row.pushScore)}`
                : `Push ${formatSignedDelta(row.pushScore)}`
              : null,
            isPhaseRevealed("form")
              ? row.formCardStatus === "ready"
                ? row.formCardLabel
                  ? `${formatSignedDelta(row.formCardModifier)} · ${row.formCardLabel}`
                  : `Form ${formatSignedDelta(row.formCardModifier)}`
                : "Form —"
              : null,
            isPhaseRevealed("mutator")
              ? [
                  mutatorSelection ? `Mutator ${mutatorSelection}` : null,
                  mutatorHits != null ? `${mutatorHits} Treffer` : null,
                  row.totalMutatorScore != null ? formatSignedDelta(row.totalMutatorScore) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || `Mutator ${formatSignedDelta(row.totalMutatorScore)}`
              : null,
            isPhaseRevealed("captain")
              ? row.captainStatus === "mapped"
                ? `Captain ${formatSignedDelta(row.captainModifier)}`
                : "Captain —"
              : null,
            isPhaseRevealed("power")
              ? row.teamPowerStatus === "ready"
                ? row.teamPowerLabel
                  ? row.teamPowerModifier != null && row.teamPowerModifier !== 0
                    ? `Power ${formatSignedDelta(row.teamPowerModifier)} · ${row.teamPowerLabel}`
                    : row.teamPowerImpact != null && row.teamPowerImpact > 0
                      ? `Power ${row.teamPowerImpact.toFixed(1)}% · ${row.teamPowerLabel}`
                      : `Power · ${row.teamPowerLabel}`
                  : `Power ${formatSignedDelta(row.teamPowerModifier)}`
                : "Power —"
              : null,
            canShowFinalLayer ? `Final ${formatDecimalScore(row.score, 1)}` : null,
          ].filter((chip): chip is string => Boolean(chip)),
          breakdown: getMatchdayArenaPhaseBreakdown(row, displayPhase, { mutatorHitCount: mutatorHits }),
          trackSegments,
          sideKey,
        };
      });
  }, [
    effectiveBoardMode,
    matchdayWinnerRows,
    focusTeamId,
    teamOptions,
    props.teamControlSettingsMap,
    props.teams,
    d1ScoreboardView,
    d2ScoreboardView,
    displayPhase,
    isSlotsPhase,
    revealedSlotCount,
    maxSlotRevealCount,
    canShowFinalLayer,
    canShowResultLayer,
    slotScoreByTeamId,
    standingsRankChangeByTeamId,
    arenaTeamRankMaps,
    mutatorHitCountByTeamId,
    activeMatchdayMutatorLabel,
    d1Label,
    d2Label,
  ]);

  const maxBoardScore = useMemo(
    () => boardRows.reduce((max, row) => Math.max(max, row.score ?? 0), 0),
    [boardRows],
  );

  const isFocusedBoardMode = loadStage === "ready" && effectiveBoardMode !== "total";
  const isArenaFocusedTenTeamView = isFocusedBoardMode && !arenaShowAllTeams;
  const visibleBoardRows = useMemo(
    () => (isArenaFocusedTenTeamView ? buildFocusedArenaBoardRows(boardRows, params.teamId) : boardRows),
    [boardRows, isArenaFocusedTenTeamView, params.teamId],
  );

  const arenaAct: ArenaAct =
    loadStage !== "ready" ? "prep" : canShowResultLayer ? "result" : "reveal";
  const arenaGuidedState: ArenaGuidedState =
    loadStage === "idle" || loadStage === "scoreboard"
      ? "loading"
      : loadStage === "players"
        ? "prep"
        : canShowResultLayer
          ? "result"
          : isPlaying || revealEventActive || phaseIndex > 0
            ? "reveal"
            : "ready";

  const leaderRow = boardRows[0] ?? null;
  const boardLeaderLabel = leaderRow?.teamName ?? "—";
  const topDuelBroadcast = useMemo(() => {
    if (loadStage !== "ready" || boardRows.length < 2) {
      return null;
    }
    const leader = boardRows[0];
    const challenger = boardRows[1];
    if (!leader || !challenger || (leader.score ?? 0) <= 0) {
      return null;
    }
    return {
      leader,
      challenger,
      gap: Math.max(0, (leader.score ?? 0) - (challenger.score ?? 0)),
    };
  }, [boardRows, loadStage]);
  const boardVirtualWindow = useMemo(() => {
    const start = Math.max(0, Math.floor(boardScrollTop / ARENA_BOARD_ROW_STRIDE) - ARENA_BOARD_VIRTUAL_OVERSCAN);
    const end = Math.min(
      boardRows.length,
      Math.ceil((boardScrollTop + boardViewportHeight) / ARENA_BOARD_ROW_STRIDE) + ARENA_BOARD_VIRTUAL_OVERSCAN,
    );
    return { start, end, offsetY: start * ARENA_BOARD_ROW_STRIDE };
  }, [boardRows.length, boardScrollTop, boardViewportHeight]);
  useEffect(() => {
    const node = boardListRef.current;
    if (!node) {
      return;
    }
    const syncViewport = () => setBoardViewportHeight(node.clientHeight || 560);
    syncViewport();
    const observer = new ResizeObserver(syncViewport);
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadStage, boardRows.length]);
  const boardLabel =
    effectiveBoardMode === "total" ? "Gesamtwertung" : effectiveBoardMode === "d1" ? `${d1Label} Reveal` : `${d2Label} Reveal`;
  const canGoBackArenaStep =
    activeDisciplinePhase === "total" ||
    activeDisciplinePhase === "d2" ||
    phaseIndex > 0 ||
    (phaseIndex === slotsPhaseIndex && revealedSlotCount > 0);
  const canGoForwardArenaStep =
    (phaseIndex === slotsPhaseIndex && revealedSlotCount < maxSlotRevealCount) ||
    phaseIndex < finalPhaseIndex ||
    (activeDisciplinePhase === "d1" && activeDisciplineRevealComplete) ||
    (activeDisciplinePhase === "d2" && activeDisciplineRevealComplete) ||
    (activeDisciplinePhase === "total" && phaseIndex < resultPhaseIndex);

  function setRevealedSlotCount(side: ArenaDisciplineSide, count: number) {
    setRevealedSlotCountByDiscipline((current) => ({
      ...current,
      [side]: Math.max(0, count),
    }));
  }

  function switchToDiscipline(side: ArenaDisciplineSide) {
    if (isRoomRevealSyncActive) {
      return;
    }
    if (side === "d2" && !canSwitchToD2) {
      return;
    }
    setIsPlaying(false);
    setActiveDisciplinePhase(side);
    setPhaseIndex(0);
  }

  function showTotalResults() {
    if (isRoomRevealSyncActive) {
      return;
    }
    if (!canShowTotalResults) {
      return;
    }
    setIsPlaying(false);
    setCompletedDisciplinePhases({ d1: true, d2: true });
    setActiveDisciplinePhase("total");
    setPhaseIndex(resultPhaseIndex);
  }

  function resetArenaReveal() {
    if (!canControlArenaReveal) {
      return;
    }
    removeStoredMatchdayArenaRevealSession(params);
    setIsPlaying(false);
    setActiveDisciplinePhase("d1");
    setPhaseIndex(0);
    setRevealedSlotCountByDiscipline({ d1: 0, d2: 0 });
    setCompletedDisciplinePhases({ d1: false, d2: false });
    setRestoredRevealSessionLabel(null);
  }

  function toggleFocusTeam(teamId: string) {
    setFocusTeamId((currentTeamId) => (currentTeamId === teamId ? null : teamId));
  }

  function handleTeamRowClick(teamId: string) {
    if (teamRowClickTimerRef.current) {
      window.clearTimeout(teamRowClickTimerRef.current);
    }
    teamRowClickTimerRef.current = window.setTimeout(() => {
      teamRowClickTimerRef.current = null;
      toggleFocusTeam(teamId);
    }, 220);
  }

  function handleTeamProfileOpen(teamId: string) {
    props.onOpenTeam?.(teamId);
  }

  function scrollArenaTeamIntoView(teamId: string | null | undefined, behavior: ScrollBehavior = "smooth") {
    const targetTeamId = teamId ?? params.teamId;
    if (!targetTeamId) {
      return;
    }

    const attemptScroll = () => {
      const listElement = boardListRef.current;
      const rowElement = boardRowRefs.current.get(targetTeamId);
      if (!listElement || !rowElement) {
        return false;
      }

      const rowTop = rowElement.offsetTop;
      const rowHeight = rowElement.offsetHeight;
      const listHeight = listElement.clientHeight;
      const targetScrollTop = rowTop - (listHeight - rowHeight) / 2;
      const maxScrollTop = Math.max(0, listElement.scrollHeight - listHeight);

      listElement.scrollTo({
        top: Math.max(0, Math.min(targetScrollTop, maxScrollTop)),
        behavior,
      });
      return true;
    };

    window.requestAnimationFrame(() => {
      if (!attemptScroll()) {
        window.requestAnimationFrame(attemptScroll);
      }
    });
  }

  function requestScrollToActiveTeamAfterRevealStep() {
    shouldScrollToActiveTeamAfterStepRef.current = true;
  }

  function handleAdvanceArenaStep() {
    if (!canGoForwardArenaStep || !canControlArenaReveal) {
      return;
    }
    if (isRoomRevealSyncActive && isRoomHost) {
      emitHostRoomArenaAdvance();
      return;
    }
    advanceArenaStep();
    requestScrollToActiveTeamAfterRevealStep();
  }

  function advanceArenaStep() {
    if (phaseIndex < 0) {
      setPhaseIndex(0);
      setRevealedSlotCount(activeDisciplineSide, 0);
      return;
    }
    if (!canGoForwardArenaStep) {
      return;
    }
    if (phaseIndex === slotsPhaseIndex && revealedSlotCount < maxSlotRevealCount) {
      setRevealedSlotCount(activeDisciplineSide, revealedSlotCount + 1);
      return;
    }
    const nextPhaseIndex = Math.min(phaseIndex + 1, MATCHDAY_ARENA_PHASES.length - 1);
    if (MATCHDAY_ARENA_PHASES[nextPhaseIndex]?.id === "result") {
      if (activeDisciplinePhase === "d1") {
        setCompletedDisciplinePhases((current) => ({ ...current, d1: true }));
        setActiveDisciplinePhase("d2");
        setPhaseIndex(0);
        setRevealedSlotCount("d2", 0);
        return;
      }
      if (activeDisciplinePhase === "d2") {
        setCompletedDisciplinePhases({ d1: true, d2: true });
        setActiveDisciplinePhase("total");
      }
    }
    setPhaseIndex(nextPhaseIndex);
  }

  function rewindArenaStep() {
    if (!canControlArenaReveal) {
      return;
    }
    if (!canGoBackArenaStep) {
      return;
    }
    if (activeDisciplinePhase === "total") {
      setActiveDisciplinePhase("d2");
      setPhaseIndex(finalPhaseIndex);
      setRevealedSlotCount("d2", maxD2SlotRevealCount);
      return;
    }
    if (phaseIndex === slotsPhaseIndex && revealedSlotCount > 0) {
      setRevealedSlotCount(activeDisciplineSide, revealedSlotCount - 1);
      return;
    }
    if (phaseIndex === slotsPhaseIndex && activeDisciplinePhase === "d2") {
      setActiveDisciplinePhase("d1");
      setPhaseIndex(finalPhaseIndex);
      setRevealedSlotCount("d1", maxD1SlotRevealCount);
      return;
    }
    const previousPhaseIndex = Math.max(phaseIndex - 1, 0);
    const previousPhase = MATCHDAY_ARENA_PHASES[previousPhaseIndex]?.id;
    setPhaseIndex(previousPhaseIndex);
    if (previousPhase === "slots") {
      setRevealedSlotCount(activeDisciplineSide, maxSlotRevealCount);
    }
  }

  function getCurrentStepDuration() {
    const baseDuration = getPhaseDuration(speed);
    if (displayPhase === "slots") {
      return baseDuration + 350;
    }
    return baseDuration;
  }

  function startRevealPlayback() {
    if (!canControlArenaReveal) {
      return;
    }
    if (activeDisciplinePhase === "total") {
      setActiveDisciplinePhase("d1");
      setCompletedDisciplinePhases({ d1: false, d2: false });
      setRevealedSlotCountByDiscipline({ d1: 0, d2: 0 });
    } else {
      setRevealedSlotCount(activeDisciplineSide, 0);
    }
    setPhaseIndex(0);
    setIsPlaying(true);
  }

  function jumpToArenaPhase(phaseId: (typeof MATCHDAY_ARENA_PHASES)[number]["id"]) {
    if (!canControlArenaReveal) {
      return;
    }
    const nextPhaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === phaseId);
    if (nextPhaseIndex < 0) {
      return;
    }
    const slotsPhaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "slots");
    setIsPlaying(false);
    if (phaseId === "result") {
      if (activeDisciplinePhase === "d1" && canSwitchToD2) {
        setCompletedDisciplinePhases((current) => ({ ...current, d1: true }));
        setActiveDisciplinePhase("d2");
        setPhaseIndex(0);
        setRevealedSlotCount("d2", 0);
        return;
      }
      showTotalResults();
      return;
    }
    setPhaseIndex(nextPhaseIndex);

    if (phaseId === "slots") {
      setRevealedSlotCount(activeDisciplineSide, 0);
      return;
    }

    if (slotsPhaseIndex >= 0 && nextPhaseIndex > slotsPhaseIndex) {
      setRevealedSlotCount(activeDisciplineSide, maxSlotRevealCount);
      return;
    }

    setRevealedSlotCount(activeDisciplineSide, 0);
  }

  useEffect(() => {
    if (
      !canShowTotalResults ||
      standingsPreviewFeed ||
      !params.saveId ||
      !params.seasonId ||
      !params.matchdayId
    ) {
      return undefined;
    }

    const controller = new AbortController();
    detailRequestAbortRef.current?.abort();
    detailRequestAbortRef.current = controller;

    const query = new URLSearchParams({
      saveId: params.saveId,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      teamId: params.teamId,
      source,
    });

    void fetch(`/api/standings/preview?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => ({
        ok: response.ok,
        payload: await readArenaJsonPayload<ArenaStandingsPreviewResponse>(
          response,
          "Tabellen-Vorschau hat keine lesbare Antwort geliefert.",
        ),
      }))
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        if (result.ok && !result.payload.error) {
          setStandingsPreviewFeed(result.payload);
          return;
        }
        const detail = result.payload.error ?? "Standings-Preview konnte nicht geladen werden.";
        setWarnings((current) => Array.from(new Set([...current, `standings_preview:${detail}`])));
      })
      .catch((error) => {
        if (isArenaAbortError(error)) {
          return;
        }
        setWarnings((current) =>
          Array.from(
            new Set([
              ...current,
              `standings_preview:${error instanceof Error ? error.message : String(error)}`,
            ]),
          ),
        );
      })
      .finally(() => {
        if (detailRequestAbortRef.current === controller) {
          detailRequestAbortRef.current = null;
        }
      });

    return () => controller.abort();
  }, [canShowTotalResults, params.matchdayId, params.saveId, params.seasonId, params.teamId, source, standingsPreviewFeed]);

  useEffect(() => {
    if (loadStage === "scoreboard" || !scoreFeed || !params.teamId) {
      return undefined;
    }

    scrollArenaTeamIntoView(params.teamId, hasAutoScrolledToFocusRef.current ? "smooth" : "auto");
    hasAutoScrolledToFocusRef.current = true;
  }, [loadStage, params.teamId, scoreFeed]);

  useEffect(() => {
    if (!shouldScrollToActiveTeamAfterStepRef.current) {
      return;
    }

    shouldScrollToActiveTeamAfterStepRef.current = false;
    scrollArenaTeamIntoView(params.teamId, "smooth");
  }, [
    activeDisciplinePhase,
    completedDisciplinePhases,
    params.teamId,
    phaseIndex,
    revealedSlotCountByDiscipline,
  ]);

  useEffect(() => {
    if (!isPlaying || isRoomRevealSyncActive) {
      return undefined;
    }
    if (phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1) {
      setIsPlaying(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      advanceArenaStep();
      requestScrollToActiveTeamAfterRevealStep();
    }, getCurrentStepDuration());

    return () => window.clearTimeout(timeoutId);
  }, [isPlaying, isRoomRevealSyncActive, phaseIndex, speed, displayPhase, activeSlotRoles.length, revealedSlotCount, maxSlotRevealCount]);

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
      if (isTextTarget) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        if (!canControlArenaReveal) {
          return;
        }
        setIsPlaying(false);
        handleAdvanceArenaStep();
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        setIsPlaying(false);
        handleAdvanceArenaStep();
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        setIsPlaying(false);
        rewindArenaStep();
      }

      if (event.code === "ArrowDown" || event.code === "ArrowUp") {
        if (!boardRows.length) {
          return;
        }
        event.preventDefault();
        setIsPlaying(false);
        const currentIndex = focusTeamId ? boardRows.findIndex((row) => row.teamId === focusTeamId) : -1;
        const startIndex = currentIndex >= 0 ? currentIndex : event.code === "ArrowDown" ? -1 : boardRows.length;
        const nextIndex = Math.min(
          Math.max(startIndex + (event.code === "ArrowDown" ? 1 : -1), 0),
          boardRows.length - 1,
        );
        const nextTeamId = boardRows[nextIndex]?.teamId;
        if (!nextTeamId) {
          return;
        }
        setFocusTeamId(nextTeamId);
        scrollArenaTeamIntoView(nextTeamId, "auto");
        window.requestAnimationFrame(() => {
          boardRowRefs.current.get(nextTeamId)?.focus({ preventScroll: true });
        });
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  });

  const focusModeLabel = focusTeamId ? `${focusTeamName} im Fokus` : "Top Player im Fokus";
  const seasonLabel = getCanonicalSeasonLabel({ seasonId: context?.seasonId ?? params.seasonId });
  const matchdayLabel = context?.matchday?.label ?? scoreFeed?.targetMatchday.label ?? params.matchdayId;
  const userTeamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const team of props.teams) {
      const settings = props.teamControlSettingsMap[team.teamId];
      if (
        settings?.controlMode === "manual" &&
        (settings.ownerId == null || settings.ownerId === DEFAULT_ACTIVE_OWNER_ID)
      ) {
        ids.add(team.teamId);
      }
    }
    return ids;
  }, [props.teamControlSettingsMap, props.teams]);
  const userTeamNames = useMemo(() => {
    const names = new Set<string>();
    for (const team of props.teams) {
      if (!userTeamIds.has(team.teamId)) {
        continue;
      }
      names.add(team.name);
      names.add(team.teamId);
      if (team.shortCode) {
        names.add(team.shortCode);
      }
    }
    return names;
  }, [props.teams, userTeamIds]);
  const visibleWarnings = useMemo(() => {
    const hasUserTeamPlanningWarning = warnings.some((warning) => {
      const teamName = getPlanningWarningTeamName(warning);
      return teamName ? userTeamNames.has(teamName) : false;
    });

    return warnings.filter((warning) => {
      const planningTeamName = getPlanningWarningTeamName(warning);
      if (planningTeamName) {
        return userTeamNames.has(planningTeamName);
      }
      if (warning === "missing_lineups") {
        return hasUserTeamPlanningWarning;
      }
      if (warning === "No existing legacy lineup draft was found for this team and matchday.") {
        return userTeamIds.has(params.teamId);
      }
      return true;
    });
  }, [params.teamId, userTeamIds, userTeamNames, warnings]);
  const openWarnings = visibleWarnings.map(formatArenaWarning);
  const blockedTeams = scoreFeed?.lineupSummary.blockedTeams ?? 0;
  const autoLineups = scoreFeed?.lineupSummary.autoGeneratedLineups ?? 0;

  const renderFocusEntries = (
    items: ArenaFocusTeamEntryCard[],
    disciplineLabel: string,
    fallbackPlayers: ArenaTopPlayerCard[],
    rankPoolState: ArenaRankPoolState,
  ) => {
    if (!focusTeamId) {
      return (
        <div className="arena-v2-player-stack">
          {fallbackPlayers.slice(0, 10).map((player) => (
            <MatchdayArenaPlayerCard
              key={`${disciplineLabel}-${player.playerId}`}
              rank={player.rankInDiscipline}
              portraitUrl={player.portraitUrl}
              playerName={player.playerName}
              teamName={player.teamName}
              className={player.className}
              scoreLabel={`${formatDecimalScore(player.finalPlayerScore, 1)} Score`}
              pointsLabel={
                canShowResultLayer
                  ? player.pointsAwarded != null
                    ? `${formatDecimalScore(player.pointsAwarded, 1)} PPs`
                    : "—"
                  : "PPs im Result"
              }
              contributionLabel={player.disciplineName}
              axisStats={player.axisStats}
              badges={player.badges}
              variant="compact"
              onOpen={player.activePlayerId ? () => props.onOpenPlayerDetails?.({ playerId: player.playerId, activePlayerId: player.activePlayerId }) : undefined}
            />
          ))}
        </div>
      );
    }

    const visibleItems =
      displayPhase === "slots" ? items.filter((entry) => entry.slotIndex < revealedSlotCount) : items;

    return (
      <div className="arena-v2-slot-stack is-compact">
        {visibleItems.length === 0 ? (
          <article className="arena-v2-slot-card is-compact">
            <div className="arena-v2-slot-empty">
              <span className="arena-v2-slot-kicker">Slots verborgen</span>
              <strong>{disciplineLabel} startet bei 0</strong>
            </div>
          </article>
        ) : null}
        {visibleItems.map((entry) => {
          const entryRankPools = resolveArenaEntryRankPools(entry.slotIndex, rankPoolState);
          return (
          <article
            key={`${disciplineLabel}-${entry.playerId}-${entry.slotIndex}`}
            className={`arena-v2-slot-card is-compact is-tier-${getArenaFocusEntryCardTier(entry, entryRankPools)}${entry.isCaptain ? " is-captain" : ""}${revealEventActive ? " is-arena-slot-pulse" : ""}${entry.rankInSlotBase === 1 ? " is-slot-winner" : ""}`}
            role={entry.activePlayerId ? "button" : undefined}
            tabIndex={entry.activePlayerId ? 0 : undefined}
            onClick={() => entry.activePlayerId && props.onOpenPlayerDetails?.({ playerId: entry.playerId, activePlayerId: entry.activePlayerId })}
            onKeyDown={(event) => {
              if (!entry.activePlayerId) {
                return;
              }
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                props.onOpenPlayerDetails?.({ playerId: entry.playerId, activePlayerId: entry.activePlayerId });
              }
            }}
          >
            <div className="arena-v2-slot-player">
              {entry.portraitUrl ? (
                <OptimizedMediaImage
                  className="arena-v2-slot-portrait"
                  src={entry.portraitUrl}
                  alt={entry.playerName}
                  width={34}
                  height={34}
                />
              ) : (
                <span className="arena-v2-slot-portrait arena-v2-slot-portrait-fallback">—</span>
              )}
              <div className="arena-v2-slot-copy">
                <div className="arena-v2-slot-title-row">
                  <span className="arena-v2-slot-kicker">{entry.slotLabel}</span>
                  <strong title={entry.playerName}>{entry.playerName}</strong>
                  <span className="arena-v2-slot-role" title={entry.roleHint}>
                    {entry.roleLabel}
                  </span>
                </div>
                <div className="arena-v2-slot-meta-row">
                  <span>{entry.className ?? "—"}</span>
                  {canShowResultLayer ? <span>PPs {formatDecimalScore(entry.pointsAwarded, 1)}</span> : null}
                </div>
              </div>
            </div>
            <VeloImpactStrip
              className="arena-v2-slot-impact-strip"
              items={[
                {
                  key: "base",
                  label: "Base",
                  value: formatDecimalScore(entry.baseScore, 1),
                  tone: "neutral",
                },
                {
                  key: "mutator",
                  label: "Mutator",
                  value:
                    entry.mutatorBonus != null
                      ? `${entry.mutatorBonus >= 0 ? "+" : ""}${formatDecimalScore(entry.mutatorBonus, 1)}`
                      : "—",
                  tone: (entry.mutatorBonus ?? 0) >= 0 ? "positive" : "negative",
                },
                {
                  key: "final",
                  label: "Final",
                  value: canShowFinalLayer ? formatDecimalScore(entry.finalPlayerScore, 1) : "—",
                  tone: "positive",
                },
              ]}
            />
            <div className="arena-v2-rank-tag-row">
              {renderArenaRankTag("S#", entry.rankInSlotBase, "base", ARENA_PLAYER_RANK_TOOLTIPS.slotBase, entryRankPools.slotPoolSize)}
              {renderArenaRankTag("G#", entry.rankTotalBase, "base", ARENA_PLAYER_RANK_TOOLTIPS.totalBase, entryRankPools.totalPoolSize)}
              {renderArenaRankTag("S+#", entry.rankInSlotBoosted, "boosted", ARENA_PLAYER_RANK_TOOLTIPS.slotBoosted, entryRankPools.slotPoolSize)}
              {renderArenaRankTag("G+#", entry.rankTotalBoosted, "boosted", ARENA_PLAYER_RANK_TOOLTIPS.totalBoosted, entryRankPools.totalPoolSize)}
            </div>
            {entry.axisStats.length ? (
              <VeloStatOrbitRow
                className="arena-v2-slot-orbit-row"
                ariaLabel={`${entry.playerName} Attribute`}
                stats={axisStatsToOrbitStats(entry.axisStats)}
              />
            ) : null}
            {entry.warnings.length ? <p className="arena-v2-slot-warning">{entry.warnings[0]}</p> : null}
          </article>
          );
        })}
      </div>
    );
  };

  const activeFocusEntries = activeDisciplineSide === "d2" ? focusTeamEntries.d2 : focusTeamEntries.d1;
  const activeTopPlayers = activeDisciplineSide === "d2" ? topPlayersBySide.d2 : topPlayersBySide.d1;
  const activeRequiredPlayers = activeDisciplineSide === "d2" ? d2Required : d1Required;
  const focusSideSlotPillLabel = focusTeamId
    ? displayPhase === "slots"
      ? (() => {
          const currentRole = revealedSlotCount > 0 ? activeSlotRoles[revealedSlotCount - 1] : null;
          const base = `Slot ${revealedSlotCount}/${maxSlotRevealCount}`;
          return currentRole ? `${base} · ${currentRole.label}` : base;
        })()
      : `${activeFocusEntries.length}/${activeRequiredPlayers}`
    : `${activeTopPlayers.length} sichtbar`;
  const activeFocusBoardRow = focusTeamId ? boardRows.find((row) => row.teamId === focusTeamId) ?? null : null;
  const loadStageHint = formatArenaLoadStageHint(loadStage);
  const isPlayerPanelLoading = loadStage === "players" && !resolveFeed;

  const renderPlayerPanelBody = (
    entries: ArenaFocusTeamEntryCard[],
    disciplineLabel: string,
    fallbackPlayers: ArenaTopPlayerCard[],
    rankPoolState: ArenaRankPoolState,
  ) => {
    if (isPlayerPanelLoading && focusTeamId) {
      return (
        <div className="arena-v2-panel-loading arena-v2-side-loading" role="status" aria-live="polite">
          <strong>Spieler-Details laden</strong>
          <span>Slot-Scores, Ränge und Portraits werden nach dem Teamboard nachgeladen.</span>
        </div>
      );
    }
    return renderFocusEntries(entries, disciplineLabel, fallbackPlayers, rankPoolState);
  };

  return (
    <div className={`arena-v2-shell is-act-${arenaAct}${isArenaEventMode ? " is-event-mode" : ""}${isFocusedBoardMode ? " is-focused-board" : ""}${broadcastFocusMode ? " is-broadcast-mode" : ""}`}>
      {showArenaHandoffBanner ? (
        <div className="arena-v2-handoff-banner" role="status" data-testid="arena-lineup-handoff-banner">
          <strong>Einsatzliste gespeichert</strong>
          <span>Reveal startet hier — Play oder Leertaste für den nächsten Schritt.</span>
        </div>
      ) : null}
      {arenaGuidedState === "loading" || arenaGuidedState === "prep" || arenaGuidedState === "ready" ? (
        <div className={`arena-v2-guided-state is-${arenaGuidedState}`} data-testid="arena-guided-empty-state" aria-live="polite">
          {arenaGuidedState === "loading" ? (
            <>
              <strong>Wertung wird vorbereitet</strong>
              <span>32 Teams, Auto-Lineups und Resolve laufen — gleich geht&apos;s los.</span>
            </>
          ) : arenaGuidedState === "prep" ? (
            <>
              <strong>Spieler-Details laden</strong>
              <span>Portraits und Slot-Scores kommen gleich — Board folgt im nächsten Schritt.</span>
            </>
          ) : (
            <>
              <strong>Bereit für den Reveal</strong>
              <span>Play startet die Show · Leertaste = Schritt · Fokus-Board zeigt Top 3 + dein Team ±3.</span>
            </>
          )}
        </div>
      ) : null}
      <section className="panel arena-v2-hero">
        <div className="arena-v2-hero-main">
          <div className="arena-v2-kicker-row">
            <span className="pill foundation-source-pill">Arena v2</span>
            <span className="pill">{seasonLabel}</span>
            <span className="pill">{matchdayLabel}</span>
            <span className={`pill${loadStage === "ready" ? " is-success" : loadStage === "idle" ? "" : " is-loading"}`}>
              {formatArenaLoadStageLabel(loadStage, scoreFeed?.status)}
            </span>
          </div>
          <div className="arena-v2-title-row">
            <div>
              <TooltipHeading
                as="h2"
                tooltip="Arena v2 stellt den Spieltag als zentrales Matchboard dar: Teams links, Fokus-Spieler rechts, dazu Reveal, PPs und Slot-Beiträge ohne Tabellenchaos."
              >
                {d1Label} / {d2Label}
              </TooltipHeading>
              <p className="arena-v2-subline">
                {focusModeLabel} · {boardLabel} · {arenaAct === "prep" ? "Vorbereitung" : arenaAct === "result" ? "Ergebnis" : "Reveal"} ·{" "}
                {MATCHDAY_ARENA_PHASES.find((phase) => phase.id === displayPhase)?.label ?? "Result"}
              </p>
              {loadStageHint ? <p className="arena-v2-load-hint">{loadStageHint}</p> : null}
            </div>
            <div className="arena-v2-hero-actions">
              <button
                className={`secondary-button inline-button${broadcastFocusMode ? " is-selected" : ""}`}
                type="button"
                data-testid="arena-v2-broadcast-toggle"
                onClick={() => setBroadcastFocusMode((current) => !current)}
                title={broadcastFocusMode ? "Broadcast-Modus aus — Seitenpanels wieder an" : "Broadcast-Modus — Board vergrößern, Nebenpanels ausblenden"}
              >
                {broadcastFocusMode ? "Fokus aus" : "Broadcast"}
              </button>
              {props.onBackToLineup ? (
                <button className="secondary-button inline-button" type="button" onClick={handleBackToLineup}>
                  Einsatzliste
                </button>
              ) : null}
              {props.onOpenMatchdayResult ? (
                <button
                  className="secondary-button inline-button"
                  type="button"
                  disabled={!canShowResultLayer}
                  onClick={props.onOpenMatchdayResult}
                  title={canShowResultLayer ? "Spieltagsergebnis öffnen" : "Spieltagsergebnis wird nach D1 und D2 freigeschaltet"}
                >
                  Ergebnis
                </button>
              ) : null}
              {props.onOpenSeason ? (
                <button
                  className="primary-button inline-button"
                  type="button"
                  disabled={!canShowResultLayer}
                  onClick={props.onOpenSeason}
                  title={canShowResultLayer ? "Saisonstand öffnen" : "Saisonstand bleibt bis zum Result verborgen"}
                >
                  Saisonstand
                </button>
              ) : null}
            </div>
          </div>
          <div className="arena-v2-hero-metrics">
            <article className="arena-v2-metric">
              <span>Leader</span>
              <strong>{boardLeaderLabel}</strong>
              <small>
                {leaderRow
                  ? canShowResultLayer
                    ? `${formatDecimalScore(leaderRow.points, 1)} PPs · ${formatDecimalScore(leaderRow.score, 1)} Score`
                    : `${formatDecimalScore(leaderRow.score, 1)} Score · ${MATCHDAY_ARENA_PHASES.find((phase) => phase.id === displayPhase)?.label ?? "Slots"}`
                  : "—"}
              </small>
            </article>
            <article className="arena-v2-metric">
              <span>Auto-Lineups</span>
              <strong>{autoLineups}</strong>
              <small>{blockedTeams} blockiert · {scoreFeed?.lineupSummary.totalTeams ?? 0} Teams gesamt</small>
            </article>
            <article className="arena-v2-metric">
              <span>Reveal-Sources</span>
              <strong>{formatArenaSourceLabel(scoreFeed?.resolveSources.formCardSourceLabel)}</strong>
              <small>Form · Captain {formatArenaSourceLabel(scoreFeed?.resolveSources.captainSourceStatus)} · Team-PPs {formatArenaSourceLabel(scoreFeed?.resolveSources.teamPpsSourceStatus)}</small>
            </article>
          </div>
        </div>
      </section>

      {(errors.length > 0 || openWarnings.length > 0) && (
        <section className="arena-v2-feedback-grid" aria-label="Arena Hinweise">
          {errors.length > 0 ? (
            <article className="arena-v2-feedback is-error">
              <strong>Arena v2 braucht noch Input</strong>
              <span>{errors[0]}</span>
            </article>
          ) : null}
          {openWarnings.slice(0, 3).map((warning, index) => (
            <article key={`arena-v2-warning-${index}`} className="arena-v2-feedback is-warning">
              <strong>Hinweis</strong>
              <span>{warning}</span>
            </article>
          ))}
        </section>
      )}

      <section className={`panel arena-v2-timeline-panel arena-v2-act-reveal${revealEventActive ? " is-reveal-event" : ""}`} data-testid="arena-reveal-timeline">
        <div className="arena-v2-timeline-head">
          <div>
            <strong>Reveal-Fortschritt</strong>
          </div>
          <div className="arena-v2-phase-pills">
            <span className="pill">Aktiv: {activeDisciplineLabel}</span>
            <span className="pill">Slots {revealedSlotCount}/{maxSlotRevealCount}</span>
            <span className="pill">{canShowResultLayer ? `PPs ${scoreFeed?.ppWinners.length ?? 0} sichtbar` : "PPs im Result"}</span>
          </div>
        </div>
        <ArenaRevealPlaybackPanel
          activePhase={displayPhase}
          onSelectPhase={canControlArenaReveal ? jumpToArenaPhase : undefined}
          controls={
            <>
              <div className="arena-v2-control-row arena-v2-timeline-controls">
                <button
                  className={`secondary-button inline-button${effectiveBoardMode === "total" ? " is-selected" : ""}`}
                  type="button"
                  disabled={!canShowTotalResults || isRoomRevealSyncActive}
                  onClick={showTotalResults}
                  title={canShowTotalResults ? "Gesamtwertung anzeigen" : "Gesamtwertung wird erst nach D1 und D2 freigeschaltet"}
                >
                  Gesamt
                </button>
                <button
                  className={`secondary-button inline-button${effectiveBoardMode === "d1" ? " is-selected" : ""}`}
                  type="button"
                  disabled={isRoomRevealSyncActive}
                  onClick={() => switchToDiscipline("d1")}
                >
                  {d1Label}
                </button>
                <button
                  className={`secondary-button inline-button${effectiveBoardMode === "d2" ? " is-selected" : ""}`}
                  type="button"
                  disabled={!canSwitchToD2 || isRoomRevealSyncActive}
                  onClick={() => switchToDiscipline("d2")}
                  title={canSwitchToD2 ? `${d2Label} Reveal anzeigen` : `${d2Label} wird nach Abschluss von ${d1Label} freigeschaltet`}
                >
                  {d2Label}
                </button>
                <button className="primary-button inline-button" type="button" disabled={!canControlArenaReveal} onClick={() => (isPlaying ? setIsPlaying(false) : startRevealPlayback())}>
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button className="secondary-button inline-button" type="button" disabled={!canControlArenaReveal} onClick={resetArenaReveal}>
                  Zurücksetzen
                </button>
                {[1, 2, 4].map((entry) => (
                  <button
                    key={`speed-${entry}`}
                    className={`secondary-button inline-button${speed === entry ? " is-selected" : ""}`}
                    type="button"
                    title={entry === 1 ? "Normaltempo" : entry === 2 ? "Schnell" : "Turbo-Reveal"}
                    onClick={() => setSpeed(entry as ArenaPhaseControlSpeed)}
                  >
                    {entry === 1 ? "Normal" : entry === 2 ? "Schnell" : "Turbo"}
                  </button>
                ))}
              </div>
              {effectiveBoardMode !== "total" ? (
                <div className="arena-v2-score-legend" aria-label="Score-Balken Legende">
                  {(["slots", "push", "form", "mutator", "captain", "power"] as const).map((segmentId) => (
                    <span key={segmentId} className={`arena-v2-score-legend-item is-${segmentId}`}>
                      {ARENA_SCORE_TRACK_SEGMENT_LABELS[segmentId]}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          }
          hint={
            restoredRevealSessionLabel ? (
              <p className="arena-v2-control-hint">
                {restoredRevealSessionLabel}. Leertaste = nächster Schritt, Pfeiltasten ebenfalls.
                {isRoomRevealSyncActive ? (isRoomHost ? " Du steuerst den Reveal für alle." : " Der Host steuert den Reveal.") : ""}
              </p>
            ) : (
              <p className="arena-v2-control-hint">
                Leertaste = nächster Reveal-Schritt. Play startet Auto-Reveal.
                {roomRevealWaitingForHost ? " Warte auf Host-Start." : ""}
                {isRoomRevealSyncActive && !isRoomHost ? " Der Host steuert den gemeinsamen Reveal." : ""}
                {isRoomRevealSyncActive && isRoomHost ? " Dein Schritt gilt für alle Spieler." : ""}
              </p>
            )
          }
        />
      </section>

      {topDuelBroadcast && isSlotsPhase ? (
        <section className="arena-v2-broadcast-panel" aria-label="Top-Duell Broadcast">
          <div className="arena-v2-broadcast-stage">
            <article className="arena-v2-broadcast-team is-leader">
              <span className="arena-v2-broadcast-rank">#1</span>
              <strong>{topDuelBroadcast.leader.teamName}</strong>
              <small>{formatDecimalScore(topDuelBroadcast.leader.score, 1)} Score</small>
            </article>
            <div className="arena-v2-broadcast-vs" aria-hidden="true">
              <span>Top-Duell</span>
              <strong>+{formatDecimalScore(topDuelBroadcast.gap, 1)}</strong>
            </div>
            <article className="arena-v2-broadcast-team">
              <span className="arena-v2-broadcast-rank">#2</span>
              <strong>{topDuelBroadcast.challenger.teamName}</strong>
              <small>{formatDecimalScore(topDuelBroadcast.challenger.score, 1)} Score</small>
            </article>
          </div>
        </section>
      ) : null}

      <section className={`arena-v2-main-grid is-full-stage arena-v2-act-board${canShowResultLayer ? "" : " is-single-discipline"}${broadcastFocusMode ? " is-broadcast-mode" : ""}`}>
        <section className="panel arena-v2-board-panel">
          <div className="arena-v2-board-sticky-stack">
            <div className="arena-v2-board-head">
              <div className="arena-v2-board-head-main">
                <TooltipHeading
                  as="h3"
                  tooltip={
                    isFocusedBoardMode
                      ? arenaShowAllTeams
                        ? "Fokus-Board mit allen 32 Teams — dein Team bleibt hervorgehoben."
                        : "Fokus-Board: Top 3 fix, dein Team hervorgehoben, je 3 Ränge darüber/darunter — 10 Teams statt 32."
                      : "Links bleibt das Hauptboard: alle 32 Teams, direkt klickbar. Rechts sitzen die Fokus-Spieler. Vor dem Result zeigt die Arena nur die aktive Disziplin; Gesamtwertung, PPs und Top Player werden erst danach sichtbar."
                  }
                >
                  {isFocusedBoardMode
                    ? arenaShowAllTeams
                      ? "Fokus · Alle Teams"
                      : "Fokus · 10 Teams"
                    : `32 Teams · ${boardLabel}`}
                </TooltipHeading>
                {matchdayMutatorTraitsBySide ? (
                  <div className="arena-v2-board-mutators" aria-label="Spieltag-Mutatoren">
                    <span className="pill arena-v2-board-mutator-pill" title={`${d1Label}: ${matchdayMutatorLabelsBySide.d1 ?? "—"}`}>
                      {d1Label}: {matchdayMutatorLabelsBySide.d1 ?? "—"}
                    </span>
                    <span className="pill arena-v2-board-mutator-pill" title={`${d2Label}: ${matchdayMutatorLabelsBySide.d2 ?? "—"}`}>
                      {d2Label}: {matchdayMutatorLabelsBySide.d2 ?? "—"}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="arena-v2-board-head-actions">
                {isFocusedBoardMode ? (
                  <button
                    type="button"
                    className="secondary-button inline-button"
                    data-testid="arena-v2-show-all-teams-toggle"
                    title={arenaShowAllTeams ? "Auf 10 relevante Teams einschränken" : "Alle 32 Teams im Fokus-Board anzeigen"}
                    onClick={() => setArenaShowAllTeams((current) => !current)}
                  >
                    {arenaShowAllTeams ? "10 Teams" : "Alle Teams"}
                  </button>
                ) : null}
                <span className="pill">{isFocusedBoardMode ? `${visibleBoardRows.length} / ${boardRows.length}` : `${boardRows.length} Teams`}</span>
              </div>
            </div>
            {isArenaEventMode && leaderRow ? (
              <div className="arena-v2-score-ticker" aria-live="polite" data-testid="arena-v2-score-ticker">
                <span className="arena-v2-score-ticker-kicker">Live</span>
                <ArenaAnimatedScore value={leaderRow.score} />
                <strong>{boardLeaderLabel}</strong>
                <small>{MATCHDAY_ARENA_PHASES.find((phase) => phase.id === displayPhase)?.label ?? "Slots"}</small>
              </div>
            ) : null}
            <div className="arena-v2-board-step-nav" aria-label="Reveal Schritt-Navigation">
              <button
                className="secondary-button inline-button"
                type="button"
                disabled={!canGoBackArenaStep || !canControlArenaReveal}
                onClick={() => {
                  setIsPlaying(false);
                  rewindArenaStep();
                }}
              >
                Zurück
              </button>
              <span>
                {MATCHDAY_ARENA_PHASES.find((phase) => phase.id === displayPhase)?.label ?? "Result"}
              </span>
              {canShowResultLayer && props.onOpenMatchdayResult ? (
                <button
                  className="primary-button inline-button"
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    props.onOpenMatchdayResult?.();
                  }}
                >
                  Zu den Ergebnissen →
                </button>
              ) : (
                <button
                  className="primary-button inline-button"
                  type="button"
                  disabled={!canGoForwardArenaStep || !canControlArenaReveal}
                  onClick={() => {
                    setIsPlaying(false);
                    handleAdvanceArenaStep();
                  }}
                >
                  {phaseIndex === slotsPhaseIndex && revealedSlotCount < maxSlotRevealCount
                    ? "Naechster Reveal"
                    : !canShowResultLayer && activeDisciplinePhase === "d1" && activeDisciplineRevealComplete
                      ? `${d2Label} freischalten`
                      : !canShowResultLayer && activeDisciplinePhase === "d2" && activeDisciplineRevealComplete
                        ? "Result freischalten"
                        : "Naechster Reveal"}
                </button>
              )}
            </div>
          </div>
          {loadStage === "scoreboard" ? (
            <div className="arena-v2-panel-loading arena-v2-board-loading" role="status" aria-live="polite">
              <strong>Wertung für 32 Teams wird berechnet</strong>
              <span>Auto-Lineups, Formkarten und Resolve laufen serverseitig. Das dauert meist ein paar Sekunden.</span>
              <div className="arena-v2-board-skeleton-rows" aria-hidden="true">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={`arena-board-skeleton-${index}`}
                    className="arena-v2-board-skeleton-row"
                    style={{ width: `${Math.max(58, 96 - index * 4)}%` }}
                  />
                ))}
              </div>
            </div>
          ) : isFocusedBoardMode ? (
          <div
            className="arena-v2-board-list is-focused-board"
            ref={boardListRef}
            role="list"
            aria-label="Arena v2 Fokusboard"
            data-testid="arena-v2-focused-board"
          >
            {visibleBoardRows.map((row) => {
              const widthPct = maxBoardScore > 0 && row.score > 0 ? clampPct((row.score / maxBoardScore) * 100) : 0;
              const isSelected = focusTeamId === row.teamId;
              const isActiveTeam = params.teamId === row.teamId;
              const teamResult = matchdayWinnerByTeamId.get(row.teamId) ?? null;
              const slotDelta = isSlotsPhase ? slotScoreByTeamId.deltaByTeamId.get(row.teamId) ?? null : null;
              const stepRankDeltaLabel = formatArenaRankDelta(row.stepRankDelta);
              const statSecondaryLabel =
                row.points != null
                  ? `${formatDecimalScore(row.points, 1)} PPs`
                  : effectiveBoardMode === "total"
                    ? `Saison ${formatSeasonRankChange(teamResult?.seasonRank ?? null, teamResult?.seasonRankDelta ?? null)}`
                    : slotDelta != null
                      ? `+${formatDecimalScore(slotDelta, 1)}`
                      : null;
              return (
                <ArenaBoardRow
                  key={`arena-v2-focused-row-${row.teamId}`}
                  row={row}
                  maxBoardScore={maxBoardScore}
                  widthPct={widthPct}
                  isSelected={isSelected}
                  isActiveTeam={isActiveTeam}
                  effectiveBoardMode={effectiveBoardMode}
                  isSlotsPhase={isSlotsPhase}
                  slotDelta={slotDelta}
                  stepRankDeltaLabel={stepRankDeltaLabel}
                  statSecondaryLabel={statSecondaryLabel}
                  teamResult={teamResult}
                  paramsTeamId={params.teamId}
                  onTeamRowClick={handleTeamRowClick}
                  onOpenTeam={handleTeamProfileOpen}
                  registerRowRef={(teamId, node) => {
                    if (node) {
                      boardRowRefs.current.set(teamId, node);
                    } else {
                      boardRowRefs.current.delete(teamId);
                    }
                  }}
                />
              );
            })}
          </div>
          ) : (
          <div
            className="arena-v2-board-list is-virtualized"
            data-virtualized="true"
            ref={boardListRef}
            role="list"
            aria-label="Arena v2 Teamboard"
            onScroll={handleBoardScroll}
          >
            <div style={{ height: boardRows.length * ARENA_BOARD_ROW_STRIDE, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: boardVirtualWindow.offsetY,
                  left: 0,
                  right: 0,
                  display: "grid",
                  gap: "var(--arena-v2-board-list-gap, 8px)",
                }}
              >
                {boardRows.slice(boardVirtualWindow.start, boardVirtualWindow.end).map((row) => {
                  const widthPct = maxBoardScore > 0 && row.score > 0 ? clampPct((row.score / maxBoardScore) * 100) : 0;
                  const isSelected = focusTeamId === row.teamId;
                  const isActiveTeam = params.teamId === row.teamId;
                  const teamResult = matchdayWinnerByTeamId.get(row.teamId) ?? null;
                  const slotDelta = isSlotsPhase ? slotScoreByTeamId.deltaByTeamId.get(row.teamId) ?? null : null;
                  const stepRankDeltaLabel = formatArenaRankDelta(row.stepRankDelta);
                  const statSecondaryLabel =
                    row.points != null
                      ? `${formatDecimalScore(row.points, 1)} PPs`
                      : effectiveBoardMode === "total"
                        ? `Saison ${formatSeasonRankChange(teamResult?.seasonRank ?? null, teamResult?.seasonRankDelta ?? null)}`
                        : slotDelta != null
                          ? `+${formatDecimalScore(slotDelta, 1)}`
                          : null;
                  return (
                    <ArenaBoardRow
                      key={`arena-v2-row-${row.teamId}`}
                      row={row}
                      maxBoardScore={maxBoardScore}
                      widthPct={widthPct}
                      isSelected={isSelected}
                      isActiveTeam={isActiveTeam}
                      effectiveBoardMode={effectiveBoardMode}
                      isSlotsPhase={isSlotsPhase}
                      slotDelta={slotDelta}
                      stepRankDeltaLabel={stepRankDeltaLabel}
                      statSecondaryLabel={statSecondaryLabel}
                      teamResult={teamResult}
                      paramsTeamId={params.teamId}
                      onTeamRowClick={handleTeamRowClick}
                      onOpenTeam={handleTeamProfileOpen}
                      registerRowRef={(teamId, node) => {
                        if (node) {
                          boardRowRefs.current.set(teamId, node);
                        } else {
                          boardRowRefs.current.delete(teamId);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          )}
        </section>

        {canShowResultLayer ? (
          <aside className="panel arena-v2-side-panel">
            <div className="arena-v2-side-head">
              <div>
                <span className="arena-v2-side-kicker">{focusTeamId ? focusTeamName : "Top Player"}</span>
                <strong>{d1Label}</strong>
              </div>
              <span className="pill">
                {focusTeamId ? `${focusTeamEntries.d1.length}/${d1Required}` : `${topPlayersBySide.d1.length} sichtbar`}
              </span>
            </div>
            {renderPlayerPanelBody(focusTeamEntries.d1, d1Label, topPlayersBySide.d1, arenaRankContextBySide.d1)}
          </aside>
        ) : (
          <aside className="panel arena-v2-side-panel">
            <div className="arena-v2-side-head">
              <div>
                <span className="arena-v2-side-kicker">{focusTeamId ? focusTeamName : "Top Player"}</span>
                <strong>{activeDisciplineLabel}</strong>
              </div>
              <span className="pill">
                {focusSideSlotPillLabel}
              </span>
            </div>
            {renderPlayerPanelBody(activeFocusEntries, activeDisciplineLabel, activeTopPlayers, arenaRankContextBySide[activeDisciplineSide])}
          </aside>
        )}

        {canShowResultLayer ? (
          <aside className="panel arena-v2-side-panel">
            <div className="arena-v2-side-head">
              <div>
                <span className="arena-v2-side-kicker">{focusTeamId ? focusTeamName : "Top Player"}</span>
                <strong>{d2Label}</strong>
              </div>
              <span className="pill">{focusTeamId ? `${focusTeamEntries.d2.length}/${d2Required}` : `${topPlayersBySide.d2.length} sichtbar`}</span>
            </div>
            {renderPlayerPanelBody(focusTeamEntries.d2, d2Label, topPlayersBySide.d2, arenaRankContextBySide.d2)}
          </aside>
        ) : null}
      </section>

      <section className="panel arena-v2-lower-panel">
        <section className="arena-v2-lower-section arena-v2-focus-panel">
          <div className="arena-v2-focus-head">
            <div className="arena-v2-focus-title">
              {focusTeamLogoUrl ? (
                <OptimizedMediaImage
                  className="arena-v2-focus-logo"
                  src={focusTeamLogoUrl}
                  alt={`${focusTeamName} Logo`}
                  width={56}
                  height={56}
                />
              ) : (
                <span className="arena-v2-focus-logo arena-v2-board-logo-fallback">—</span>
              )}
              <div>
                <strong>{focusTeamName}</strong>
                <small>
                  {canShowResultLayer && focusWinnerRow
                    ? `Tagesrang ${focusWinnerRow.rank} · ${formatDecimalScore(focusWinnerRow.totalPoints, 1)} PPs`
                    : "Finale Tageswerte werden im Result freigeschaltet."}
                </small>
              </div>
            </div>
            {canShowResultLayer && focusWinnerRow ? (
              <div className="arena-v2-focus-metrics">
                <span className="pill">Saison {formatSeasonRankChange(focusWinnerRow.seasonRank, focusWinnerRow.seasonRankDelta)}</span>
                <span className="pill">{d1Label} {formatDecimalScore(focusWinnerRow.d1Points, 1)} PPs</span>
                <span className="pill">{d2Label} {formatDecimalScore(focusWinnerRow.d2Points, 1)} PPs</span>
              </div>
            ) : null}
          </div>
          {focusTeamId ? (
            <div className="arena-v2-focus-insight-grid">
              {canShowResultLayer ? (
                <>
                  <article className="arena-v2-focus-card">
                    <span>{d1Label}</span>
                    <strong>{formatDecimalScore(scoreboardByTeamId.d1.get(focusTeamId)?.score ?? null, 1)}</strong>
                    <small>
                      PPs {formatDecimalScore(scoreboardByTeamId.d1.get(focusTeamId)?.points ?? null, 1)} · Base{" "}
                      {formatDecimalScore(scoreboardByTeamId.d1.get(focusTeamId)?.baseScore ?? null, 1)}
                    </small>
                  </article>
                  <article className="arena-v2-focus-card">
                    <span>{d2Label}</span>
                    <strong>{formatDecimalScore(scoreboardByTeamId.d2.get(focusTeamId)?.score ?? null, 1)}</strong>
                    <small>
                      PPs {formatDecimalScore(scoreboardByTeamId.d2.get(focusTeamId)?.points ?? null, 1)} · Base{" "}
                      {formatDecimalScore(scoreboardByTeamId.d2.get(focusTeamId)?.baseScore ?? null, 1)}
                    </small>
                  </article>
                  <article className="arena-v2-focus-card">
                    <span>Mutatoren</span>
                    <strong>{(focusWinnerRow?.d1Mutators.length ?? 0) + (focusWinnerRow?.d2Mutators.length ?? 0)}</strong>
                    <small>{[...(focusWinnerRow?.d1Mutators ?? []), ...(focusWinnerRow?.d2Mutators ?? [])].slice(0, 2).join(" · ") || "keine Extras sichtbar"}</small>
                  </article>
                  <article className="arena-v2-focus-card">
                    <span>Reveal</span>
                    <strong>Result</strong>
                    <small>Gesamtboard ist jetzt freigeschaltet.</small>
                  </article>
                </>
              ) : (
                <>
                  <article className="arena-v2-focus-card">
                    <span>{activeDisciplineLabel}</span>
                    <strong>{formatDecimalScore(activeFocusBoardRow?.score ?? 0, 1)}</strong>
                    <small>Nur die aktive Disziplin ist sichtbar.</small>
                  </article>
                  <article className="arena-v2-focus-card">
                    <span>Slots</span>
                    <strong>{revealedSlotCount}/{maxSlotRevealCount}</strong>
                    <small>D2, Gesamtwertung, PPs und Saisonrang bleiben verborgen.</small>
                  </article>
                  <article className="arena-v2-focus-card">
                    <span>Reveal</span>
                    <strong>{MATCHDAY_ARENA_PHASES.find((phase) => phase.id === displayPhase)?.label ?? "Slots"}</strong>
                    <small>Weiter addiert den naechsten freigegebenen Baustein.</small>
                  </article>
                  <article className="arena-v2-focus-card">
                    <span>Naechste Freigabe</span>
                    <strong>{activeDisciplinePhase === "d1" ? d2Label : "Result"}</strong>
                    <small>{activeDisciplineRevealComplete ? "Mit Weiter freischalten." : "Nach Abschluss dieser Disziplin."}</small>
                  </article>
                </>
              )}
            </div>
          ) : (
            <>
              {canShowResultLayer ? (
                <div className="arena-v2-podium-grid" data-testid="arena-v2-top-player-podium" aria-label="Topspieler Podium">
                  {ppWinnerCards.slice(0, 3).map((player, index) => (
                    <article key={`arena-v2-podium-${player.playerId}`} className={`arena-v2-podium-card is-rank-${index + 1}`}>
                      <span className="arena-v2-podium-kicker">#{index + 1} Top Player</span>
                      <strong>{player.playerName}</strong>
                      <small>{player.teamName} · {player.disciplineName}</small>
                      <div className="arena-v2-podium-stats">
                        <span>{formatDecimalScore(player.finalPlayerScore, 1)} Score</span>
                        <span>{player.pointsAwarded != null ? `${formatDecimalScore(player.pointsAwarded, 1)} PPs` : "PPs —"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
              {mvpSpotlightActive && mvpSpotlightPlayer ? (
                <article
                  className="arena-v2-mvp-spotlight"
                  data-testid="arena-v2-mvp-spotlight"
                  aria-live="polite"
                >
                  <span className="arena-v2-mvp-spotlight-kicker">MVP Spotlight</span>
                  <MatchdayArenaPlayerCard
                    rank={mvpSpotlightPlayer.rankInDiscipline}
                    portraitUrl={mvpSpotlightPlayer.portraitUrl}
                    playerName={mvpSpotlightPlayer.playerName}
                    teamName={mvpSpotlightPlayer.teamName}
                    className={mvpSpotlightPlayer.className}
                    scoreLabel={`${formatDecimalScore(mvpSpotlightPlayer.finalPlayerScore, 1)} Score`}
                    pointsLabel={
                      mvpSpotlightPlayer.pointsAwarded != null
                        ? `${formatDecimalScore(mvpSpotlightPlayer.pointsAwarded, 1)} PPs`
                        : "—"
                    }
                    contributionLabel={mvpSpotlightPlayer.disciplineName}
                    axisStats={mvpSpotlightPlayer.axisStats}
                    badges={mvpSpotlightPlayer.badges}
                    variant="default"
                    onOpen={
                      mvpSpotlightPlayer.activePlayerId
                        ? () =>
                            props.onOpenPlayerDetails?.({
                              playerId: mvpSpotlightPlayer.playerId,
                              activePlayerId: mvpSpotlightPlayer.activePlayerId,
                            })
                        : undefined
                    }
                  />
                </article>
              ) : null}
              <div className="arena-v2-player-stack arena-v2-winner-stack">
              {canShowResultLayer ? (
                ppWinnerCards.map((player) => (
                  <MatchdayArenaPlayerCard
                    key={`arena-v2-pp-${player.playerId}`}
                    rank={player.rankInDiscipline}
                    portraitUrl={player.portraitUrl}
                    playerName={player.playerName}
                    teamName={player.teamName}
                    className={player.className}
                    scoreLabel={`${formatDecimalScore(player.finalPlayerScore, 1)} Score`}
                    pointsLabel={player.pointsAwarded != null ? `${formatDecimalScore(player.pointsAwarded, 1)} PPs` : "—"}
                    contributionLabel={player.disciplineName}
                    axisStats={player.axisStats}
                    badges={player.badges}
                    variant="compact"
                    onOpen={player.activePlayerId ? () => props.onOpenPlayerDetails?.({ playerId: player.playerId, activePlayerId: player.activePlayerId }) : undefined}
                  />
                ))
              ) : (
                <article className="arena-v2-slot-card">
                  <div className="arena-v2-slot-head">
                    <span className="arena-v2-slot-kicker">Result gesperrt</span>
                    <strong>PP-Gewinner erst am Ende</strong>
                    <small>Nutze Weiter oder Play, um die Reveal-Schritte nacheinander freizuschalten.</small>
                  </div>
                </article>
              )}
              </div>
            </>
          )}
        </section>

        <section className="arena-v2-lower-section arena-v2-insight-panel arena-v2-act-result">
          <div className="arena-v2-panel-title">
            <strong>Was Arena v2 gerade zeigt</strong>
            <small>Mehr Kontext, weniger Tabellenblindflug.</small>
          </div>
          <div className="arena-v2-insight-grid">
            <article className="arena-v2-insight-card">
              <span>Board</span>
              <strong>{boardLabel}</strong>
              <small>{effectiveBoardMode === "total" ? "Gesamte Tageswertung aus beiden Diszis." : `Reveal folgt ${MATCHDAY_ARENA_PHASES.find((phase) => phase.id === displayPhase)?.label ?? "Result"}.`}</small>
            </article>
            <article className="arena-v2-insight-card">
              <span>Leader</span>
              <strong>{boardLeaderLabel}</strong>
              <small>
                {leaderRow
                  ? canShowResultLayer
                    ? `${formatDecimalScore(leaderRow.score, 1)} Score · ${formatDecimalScore(leaderRow.points, 1)} PPs`
                    : `${formatDecimalScore(leaderRow.score, 1)} Score · PPs verborgen`
                  : "—"}
              </small>
            </article>
            <article className="arena-v2-insight-card">
              <span>Warnungen</span>
              <strong>{openWarnings.length}</strong>
              <small>{openWarnings[0] ?? "keine akute Reibung"}</small>
            </article>
            <article className="arena-v2-insight-card">
              <span>Readiness</span>
              <strong>{scoreFeed?.lineupSummary.existingLineups ?? 0}/{scoreFeed?.lineupSummary.totalTeams ?? 0}</strong>
              <small>{blockedTeams} blockiert · {autoLineups} Auto-Lineups</small>
            </article>
          </div>
          {effectiveBoardMode !== "total" ? (
            <div className="arena-v2-breakdown-grid">
              {boardRows.slice(0, 3).map((row) => (
                <article key={`arena-v2-breakdown-${row.teamId}`} className="arena-v2-breakdown-card">
                  <strong>{row.teamName}</strong>
                  <VeloImpactStrip
                    className="arena-v2-breakdown-velo-strip"
                    items={(row.breakdown ?? []).map((item) => ({
                      key: item.id,
                      label: item.label,
                      value: item.valueLabel,
                      tone: item.tone === "negative" ? "negative" : item.tone === "positive" ? "positive" : "neutral",
                    }))}
                  />
                </article>
              ))}
            </div>
          ) : null}
          {isResultPhase && canShowResultLayer ? (
            <div className="arena-v2-result-reason-grid" data-testid="arena-v2-result-reasons" aria-label="Ergebnisgründe Top-Teams">
              {boardRows.slice(0, 3).map((row) => {
                const sourceRow =
                  effectiveBoardMode === "d2"
                    ? d2ScoreboardView.find((entry) => entry.teamId === row.teamId)
                    : effectiveBoardMode === "d1"
                      ? d1ScoreboardView.find((entry) => entry.teamId === row.teamId)
                      : matchdayWinnerRows.find((entry) => entry.teamId === row.teamId) ?? d1ScoreboardView.find((entry) => entry.teamId === row.teamId);
                const taktikLabel =
                  sourceRow?.intensity === "push"
                    ? "Push"
                    : sourceRow?.intensity === "conserve"
                      ? "Schonen"
                      : sourceRow?.intensity
                        ? "Normal"
                        : "—";
                const formLabel =
                  sourceRow?.formCardStatus === "ready" && sourceRow.formCardModifier != null
                    ? formatSignedDelta(sourceRow.formCardModifier)
                    : "—";
                const fatigueLabel =
                  sourceRow?.fatigueAdjustedScore != null && sourceRow.score != null
                    ? formatSignedDelta(Number((sourceRow.fatigueAdjustedScore - sourceRow.score).toFixed(1)))
                    : "—";
                const mutatorLabel =
                  sourceRow?.totalMutatorScore != null ? formatSignedDelta(sourceRow.totalMutatorScore) : "—";
                const leadFactor = [
                  {
                    label: "Taktik",
                    value:
                      sourceRow?.pushScore != null
                        ? formatSignedDelta(sourceRow.pushScore)
                        : taktikLabel,
                    weight: Math.abs(sourceRow?.pushScore ?? 0),
                  },
                  {
                    label: "Form",
                    value: formLabel,
                    weight: Math.abs(sourceRow?.formCardModifier ?? 0),
                  },
                  {
                    label: "Mutator",
                    value: mutatorLabel,
                    weight: Math.abs(sourceRow?.totalMutatorScore ?? 0),
                  },
                ].sort((left, right) => right.weight - left.weight)[0];
                return (
                  <article key={`arena-result-reason-${row.teamId}`} className="arena-v2-result-reason-card">
                    <strong>{row.teamName}</strong>
                    <span className="arena-v2-result-reason-headline">
                      Warum vorn? {leadFactor?.label ?? "Gesamtpaket"} {leadFactor?.value ?? "—"}
                    </span>
                    <div className="arena-v2-result-reason-chips">
                      <span className="arena-v2-result-reason-chip is-taktik">Taktik {taktikLabel}</span>
                      <span className="arena-v2-result-reason-chip is-form">Form {formLabel}</span>
                      <span className="arena-v2-result-reason-chip is-mutator">Mutator {mutatorLabel}</span>
                      <span className="arena-v2-result-reason-chip is-fatigue">Erschöpfung {fatigueLabel}</span>
                    </div>
                    <small>
                      Score {formatDecimalScore(row.score, 1)} · PPs {formatDecimalScore(row.points, 1)}
                    </small>
                  </article>
                );
              })}
            </div>
          ) : null}
          {isResultPhase && canShowResultLayer && activeFocusEntries.length > 0 ? (
            <div className="arena-v2-training-hint" data-testid="arena-v2-training-hint">
              <strong>Training-Hinweis</strong>
              <span>
                {[
                  ...activeFocusEntries
                    .filter((entry) => entry.warnings.some((warning) => /fatigue|ermüd|push|belast/i.test(warning)))
                    .slice(0, 1)
                    .map((entry) => `${entry.playerName} erschöpft`),
                  ...[...activeFocusEntries]
                    .sort((left, right) => (right.finalPlayerScore ?? 0) - (left.finalPlayerScore ?? 0))
                    .slice(0, 1)
                    .map((entry) => `${entry.playerName} Top-Performer`),
                ]
                  .filter(Boolean)
                  .join(" · ") || "Regeneration im Training prüfen"}
              </span>
              {props.onOpenTraining ? (
                <button type="button" className="secondary-button inline-button" onClick={props.onOpenTraining}>
                  Zum Training
                </button>
              ) : null}
            </div>
          ) : null}
          {isResultPhase && canShowResultLayer ? (
            <div className="arena-v2-next-step-links" data-testid="arena-v2-next-steps">
              <strong>Naechster sinnvoller Schritt</strong>
              <div className="arena-v2-next-step-actions">
                {props.onOpenMatchdayResult ? (
                  <button type="button" className="secondary-button inline-button" onClick={props.onOpenMatchdayResult}>
                    Zur Tabelle des Spieltags
                  </button>
                ) : null}
                {props.onOpenTraining ? (
                  <button type="button" className="secondary-button inline-button" onClick={props.onOpenTraining}>
                    Zum Training
                  </button>
                ) : null}
                {props.onOpenSeason ? (
                  <button type="button" className="primary-button inline-button" onClick={props.onOpenSeason}>
                    Zum Saisonstand
                  </button>
                ) : null}
                {props.onBackToLineup ? (
                  <button type="button" className="ghost-button inline-button" onClick={handleBackToLineup}>
                    Zur Einsatzliste
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
