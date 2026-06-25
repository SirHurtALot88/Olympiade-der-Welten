"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import MatchdayArenaLane from "@/components/matchday-arena/MatchdayArenaLane";
import MatchdayArenaPlayerCard from "@/components/matchday-arena/MatchdayArenaPlayerCard";
import MatchdayArenaTimeline from "@/components/matchday-arena/MatchdayArenaTimeline";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { Player, Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
import {
  MATCHDAY_ARENA_PHASES,
  buildMatchdayArenaScoreboardView,
  getMatchdayArenaPhaseBreakdown,
  getMatchdayArenaPhaseDelta,
  getMatchdayArenaPhaseScore,
  type MatchdayArenaPhaseBreakdownItem,
  type MatchdayArenaScoreboardRowView,
} from "@/lib/season/matchday-arena-presenter";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type {
  MatchdayMvpScoringResult,
  MatchdayMvpTopPlayerRow,
} from "@/lib/season/matchday-mvp-scoring-service";
import { resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

type MatchdayArenaClientProps = {
  initialSource?: "sqlite" | "prisma";
  defaultSaveId: string;
  defaultSeasonId: string;
  defaultMatchdayId: string;
  defaultTeamId?: string | null;
  playerCatalog: Player[];
  teams: Team[];
  teamControlSettingsMap: Record<string, TeamControlSettings>;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onBackToLineup?: (() => void) | null;
  onOpenMatchdayResult?: ((payload?: { matchdayId: string }) => void) | null;
  onOpenSeason?: (() => void) | null;
};

type ArenaLabOptions = {
  matchdays: Array<{
    id: string;
    label: string;
    index: number;
    status: string;
    resultApplied?: boolean;
    resultId?: string | null;
    discipline1Label?: string | null;
    discipline1RequiredPlayers?: number | null;
    discipline2Label?: string | null;
    discipline2RequiredPlayers?: number | null;
    readyTeams?: number;
    totalTeams?: number;
    isReady?: boolean;
  }>;
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

type ArenaScoreResponse = {
  summary?: MatchdayMvpScoringResult;
  error?: string;
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
      finalPointsAwarded?: number | null;
      mutatorPpsBonus?: number | null;
      slotIndex: number;
      baseValue?: number | null;
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
      finalPointsAwarded?: number | null;
      mutatorPpsBonus?: number | null;
      slotIndex: number;
      baseValue?: number | null;
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

type ArenaTopPlayerCard = MatchdayMvpTopPlayerRow & {
  portraitUrl: string | null;
  className: string | null;
  activePlayerId: string | null;
  axisStats: ArenaPlayerAxisStat[];
  badges: string[];
};

type ArenaPlayerAxisStat = {
  axis: "POW" | "SPE" | "MEN" | "SOC";
  value: number | null;
};

type ArenaSlotPlayerCard = {
  playerId: string;
  activePlayerId: string | null;
  playerName: string;
  teamName: string;
  className: string | null;
  portraitUrl: string | null;
  rank: number;
  slotIndex: number;
  disciplineName: string;
  baseValue: number;
  axisStats: ArenaPlayerAxisStat[];
};

type ArenaSlotTopPlayerSource = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  slotIndex: number;
  baseValue?: number | null;
  finalPlayerScore: number;
};

type ArenaFocusTeamEntryCard = {
  disciplineSide?: "d1" | "d2";
  playerId: string;
  activePlayerId: string | null;
  playerName: string;
  teamName: string;
  className: string | null;
  portraitUrl: string | null;
  slotIndex: number;
  slotLabel: string;
  baseScore: number | null;
  finalPlayerScore: number | null;
  pointsAwarded: number | null;
  finalPointsAwarded?: number | null;
  mutatorPpsBonus?: number | null;
  axisStats: ArenaPlayerAxisStat[];
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

function getArenaFinalPlayerPps(player: {
  pointsAwarded?: number | null;
  finalPointsAwarded?: number | null;
  mutatorPpsBonus?: number | null;
}) {
  if (player.finalPointsAwarded != null && Number.isFinite(player.finalPointsAwarded)) {
    return player.finalPointsAwarded;
  }
  if (player.pointsAwarded == null && player.mutatorPpsBonus == null) {
    return null;
  }
  return Number(((player.pointsAwarded ?? 0) + (player.mutatorPpsBonus ?? 0)).toFixed(2));
}

function formatArenaFinalPlayerPps(player: {
  pointsAwarded?: number | null;
  finalPointsAwarded?: number | null;
  mutatorPpsBonus?: number | null;
}) {
  const value = getArenaFinalPlayerPps(player);
  return value != null ? `+${formatDecimalScore(value, 1)} PPs` : "PPs —";
}

function formatArenaSourceLabel(value: string | null | undefined) {
  if (!value || value === "missing_source") {
    return "—";
  }
  return value;
}

function getPhaseDuration(speed: ArenaPhaseControlSpeed) {
  if (speed === 4) return 700;
  if (speed === 2) return 1150;
  return 1850;
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

function filterManagerArenaWarnings(
  warningMessages: string[],
  teams: Team[],
  teamOptions: ArenaLabOptions["teams"],
  teamControlSettingsMap: Record<string, TeamControlSettings>,
) {
  const teamNameToId = new Map(teams.map((team) => [team.name, team.teamId]));
  return warningMessages.filter((message) => {
    const teamNameMatch = message.match(/^(.+?):\s/);
    if (!teamNameMatch) {
      return true;
    }
    const teamId = teamNameToId.get(teamNameMatch[1]);
    if (!teamId) {
      return true;
    }
    const option = teamOptions.find((entry) => entry.id === teamId) ?? null;
    const controlMode = option?.controlMode ?? teamControlSettingsMap[teamId]?.controlMode ?? "manual";
    return controlMode === "manual";
  });
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

function defaultArenaParams(props: MatchdayArenaClientProps) {
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

export default function MatchdayArenaClient(props: MatchdayArenaClientProps) {
  const [params, setParams] = useState(() => defaultArenaParams(props));
  const [source, setSource] = useState<"sqlite" | "prisma">(props.initialSource ?? "sqlite");
  const [isBusy, setIsBusy] = useState(false);
  const [isDetailBusy, setIsDetailBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [context, setContext] = useState<LegacyLineupLoadedContext | null>(null);
  const [matchdayOptions, setMatchdayOptions] = useState<ArenaLabOptions["matchdays"]>([]);
  const [teamOptions, setTeamOptions] = useState<ArenaLabOptions["teams"]>([]);
  const [scoreFeed, setScoreFeed] = useState<MatchdayMvpScoringResult | null>(null);
  const [resolveFeed, setResolveFeed] = useState<ArenaResolveResponse | null>(null);
  const [standingsPreviewFeed, setStandingsPreviewFeed] = useState<ArenaStandingsPreviewResponse | null>(null);
  const [winnerBoardTeamId, setWinnerBoardTeamId] = useState<string | null>(null);
  const [disciplineSide, setDisciplineSide] = useState<"d1" | "d2">("d1");
  const [phaseIndex, setPhaseIndex] = useState(-1);
  const [slotRevealIndex, setSlotRevealIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<ArenaPhaseControlSpeed>(1);
  const [eventMode, setEventMode] = useState(false);
  const requestSequenceRef = useRef(0);
  const baseRequestAbortRef = useRef<AbortController | null>(null);
  const detailRequestAbortRef = useRef<AbortController | null>(null);
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

  async function loadArena(
    nextParams = params,
    nextSource = source,
    options?: {
      reuseScoreFeed?: boolean;
    },
  ) {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    baseRequestAbortRef.current?.abort();
    detailRequestAbortRef.current?.abort();
    const baseController = new AbortController();
    baseRequestAbortRef.current = baseController;
    detailRequestAbortRef.current = null;
    const resolvedParams = {
      ...nextParams,
      teamId: resolveArenaTeamId(props.teams, nextParams.teamId),
    };

    if (!resolvedParams.saveId || !resolvedParams.seasonId || !resolvedParams.matchdayId || !resolvedParams.teamId) {
      if (requestSequenceRef.current === requestId) {
        setErrors(["Für die Arena fehlt Save-, Season-, Matchday- oder Team-Kontext."]);
      }
      return;
    }

    setIsBusy(true);
    if (requestSequenceRef.current === requestId) {
      setErrors([]);
      setWarnings([]);
      setIsDetailBusy(false);
    }

    try {
      const contextQuery = new URLSearchParams({
        saveId: resolvedParams.saveId,
        seasonId: resolvedParams.seasonId,
        matchdayId: resolvedParams.matchdayId,
        teamId: resolvedParams.teamId,
        source: nextSource,
      });

      const shouldReuseScoreFeed =
        options?.reuseScoreFeed === true &&
        scoreFeed != null &&
        params.saveId === resolvedParams.saveId &&
        params.seasonId === resolvedParams.seasonId &&
        params.matchdayId === resolvedParams.matchdayId &&
        source === nextSource;

      const contextPromise = fetch(`/api/lineups/legacy/lab-context?${contextQuery.toString()}`, {
        cache: "no-store",
        signal: baseController.signal,
      }).then(async (response) => ({
        response,
        payload: await readArenaJsonPayload<ArenaContextResponse>(
          response,
          "Der Matchday-Room-Kontext hat keine lesbare Antwort geliefert.",
        ),
      }));
      const scorePromise: Promise<{ response: Pick<Response, "ok">; payload: ArenaScoreResponse }> = shouldReuseScoreFeed
        ? Promise.resolve({
            response: { ok: true },
            payload: { summary: scoreFeed, error: undefined },
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
            response,
            payload: await readArenaJsonPayload<ArenaScoreResponse>(
              response,
              "Die 32er-Wertung hat keine lesbare Antwort geliefert.",
            ),
          }));

      const [{ response: contextResponse, payload: contextPayload }, scoreResult] = await Promise.all([
        contextPromise,
        scorePromise,
      ]);

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      if (!contextResponse.ok || contextPayload.error) {
        setErrors([contextPayload.error ?? "Der Matchday-Room-Kontext konnte nicht geladen werden."]);
        setContext(null);
        setMatchdayOptions(contextPayload.options?.matchdays ?? []);
        setScoreFeed(null);
        return;
      }

      const canonicalParams = contextPayload.params;
      let scorePayload = scoreResult.payload;
      let scoreResponseOk = scoreResult.response.ok;
      if (
        !shouldReuseScoreFeed &&
        (canonicalParams.saveId !== resolvedParams.saveId ||
          canonicalParams.seasonId !== resolvedParams.seasonId ||
          canonicalParams.matchdayId !== resolvedParams.matchdayId)
      ) {
        const canonicalScoreResponse = await fetch("/api/season/matchday-mvp-score", {
          method: "POST",
          signal: baseController.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            saveId: canonicalParams.saveId,
            seasonId: canonicalParams.seasonId,
            matchdayId: canonicalParams.matchdayId,
            source: contextPayload.source,
            dryRun: true,
            execute: false,
          }),
        });
        scoreResponseOk = canonicalScoreResponse.ok;
        scorePayload = await readArenaJsonPayload<ArenaScoreResponse>(
          canonicalScoreResponse,
          "Die 32er-Wertung hat keine lesbare Antwort geliefert.",
        );
      }
      const canonicalContextQuery = new URLSearchParams({
        saveId: canonicalParams.saveId,
        seasonId: canonicalParams.seasonId,
        matchdayId: canonicalParams.matchdayId,
        teamId: canonicalParams.teamId,
        source: contextPayload.source,
      });

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      if (!scoreResponseOk || !scorePayload.summary) {
        setErrors([scorePayload.error ?? "Die 32er-Wertung konnte nicht geladen werden."]);
        setParams(canonicalParams);
        setSource(contextPayload.source);
        setContext(contextPayload.context);
        setMatchdayOptions(contextPayload.options.matchdays ?? []);
        setTeamOptions(contextPayload.options.teams);
        setScoreFeed(null);
        return;
      }

      const selectedMatchdayOption =
        (contextPayload.options.matchdays ?? []).find((entry) => entry.id === canonicalParams.matchdayId) ?? null;
      const selectedMatchdayHasResult = Boolean(selectedMatchdayOption?.resultApplied);
      setSource(contextPayload.source);
      setParams(contextPayload.params);
      setContext(contextPayload.context);
      setMatchdayOptions(contextPayload.options.matchdays ?? []);
      setTeamOptions(contextPayload.options.teams);
      setScoreFeed(scorePayload.summary);
      setResolveFeed(null);
      setStandingsPreviewFeed(null);
      setWinnerBoardTeamId((current) =>
        current && contextPayload.options.teams.some((team) => team.id === current) ? current : null,
      );
      setWarnings(
        filterManagerArenaWarnings(
          Array.from(
            new Set([
              ...contextPayload.contextWarnings,
              ...contextPayload.contextErrors,
              ...scorePayload.summary.warnings,
              ...scorePayload.summary.blockingReasons,
            ]),
          ),
          props.teams,
          contextPayload.options.teams,
          props.teamControlSettingsMap,
        ),
      );
      setPhaseIndex(selectedMatchdayHasResult ? MATCHDAY_ARENA_PHASES.length - 1 : -1);
      setSlotRevealIndex(selectedMatchdayHasResult ? 99 : 0);
      setIsPlaying(false);
      setIsBusy(false);

      const detailController = new AbortController();
      detailRequestAbortRef.current = detailController;
      setIsDetailBusy(true);

      void Promise.allSettled([
        fetch(`/api/resolve/legacy-matchday-preview?${canonicalContextQuery.toString()}`, {
          cache: "no-store",
          signal: detailController.signal,
        }).then(async (response) => ({
          ok: response.ok,
          payload: await readArenaJsonPayload<ArenaResolveResponse>(
            response,
            "Resolve-Vorschau hat keine lesbare Antwort geliefert.",
          ),
        })),
        fetch(`/api/standings/preview?${canonicalContextQuery.toString()}`, {
          cache: "no-store",
          signal: detailController.signal,
        }).then(async (response) => ({
          ok: response.ok,
          payload: await readArenaJsonPayload<ArenaStandingsPreviewResponse>(
            response,
            "Tabellen-Vorschau hat keine lesbare Antwort geliefert.",
          ),
        })),
      ]).then(([resolveResult, standingsPreviewResult]) => {
        if (requestSequenceRef.current !== requestId || detailController.signal.aborted) {
          return;
        }

        const detailWarnings: string[] = [];
        if (resolveResult.status === "fulfilled" && resolveResult.value.ok && !resolveResult.value.payload.error) {
          setResolveFeed(resolveResult.value.payload);
          detailWarnings.push(...resolveResult.value.payload.warnings);
        } else if (!(resolveResult.status === "rejected" && isArenaAbortError(resolveResult.reason))) {
          const detail =
            resolveResult.status === "fulfilled"
              ? resolveResult.value.payload.error ?? "Resolve-Vorschau konnte nicht geladen werden."
              : resolveResult.reason instanceof Error
                ? resolveResult.reason.message
                : String(resolveResult.reason);
          detailWarnings.push(`resolve_preview:${detail}`);
        }

        if (
          standingsPreviewResult.status === "fulfilled" &&
          standingsPreviewResult.value.ok &&
          !standingsPreviewResult.value.payload.error
        ) {
          setStandingsPreviewFeed(standingsPreviewResult.value.payload);
        } else if (!(standingsPreviewResult.status === "rejected" && isArenaAbortError(standingsPreviewResult.reason))) {
          const detail =
            standingsPreviewResult.status === "fulfilled"
              ? standingsPreviewResult.value.payload.error ?? "Standings-Preview konnte nicht geladen werden."
              : standingsPreviewResult.reason instanceof Error
                ? standingsPreviewResult.reason.message
                : String(standingsPreviewResult.reason);
          detailWarnings.push(`standings_preview:${detail}`);
        }

        if (detailWarnings.length) {
          setWarnings((current) =>
            filterManagerArenaWarnings(
              Array.from(new Set([...current, ...detailWarnings])),
              props.teams,
              contextPayload.options.teams,
              props.teamControlSettingsMap,
            ),
          );
        }
      }).finally(() => {
        if (detailRequestAbortRef.current === detailController) {
          detailRequestAbortRef.current = null;
        }
        if (requestSequenceRef.current === requestId && !detailController.signal.aborted) {
          setIsDetailBusy(false);
        }
      });
    } catch (error) {
      if (isArenaAbortError(error) || baseController.signal.aborted) {
        return;
      }
      if (requestSequenceRef.current === requestId) {
        setErrors([
          error instanceof Error
            ? `Arena konnte nicht geladen werden: ${error.message}`
            : "Arena konnte nicht geladen werden.",
        ]);
      }
    } finally {
      if (baseRequestAbortRef.current === baseController) {
        baseRequestAbortRef.current = null;
      }
      if (requestSequenceRef.current === requestId) {
        setIsBusy(false);
      }
    }
  }

  useEffect(() => {
    void loadArena(externalParams, props.initialSource ?? "sqlite");
    return () => {
      requestSequenceRef.current += 1;
      baseRequestAbortRef.current?.abort();
      baseRequestAbortRef.current = null;
      detailRequestAbortRef.current?.abort();
      detailRequestAbortRef.current = null;
      setIsDetailBusy(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalParams, props.initialSource]);

  const activeDisciplineLabel =
    disciplineSide === "d1"
      ? scoreFeed?.targetMatchday.d1DisciplineName ?? context?.matchdayContract?.discipline1?.displayName ?? "—"
      : scoreFeed?.targetMatchday.d2DisciplineName ?? context?.matchdayContract?.discipline2?.displayName ?? "—";
  const activeDisciplineId =
    disciplineSide === "d1"
      ? scoreFeed?.targetMatchday.d1DisciplineId ?? context?.matchdayContract?.discipline1?.disciplineId ?? null
      : scoreFeed?.targetMatchday.d2DisciplineId ?? context?.matchdayContract?.discipline2?.disciplineId ?? null;
  const activeSlotCount =
    disciplineSide === "d1"
      ? context?.matchdayContract?.discipline1?.requiredPlayers ?? null
      : context?.matchdayContract?.discipline2?.requiredPlayers ?? null;
  const selectedArenaMatchday = matchdayOptions.find((matchday) => matchday.id === params.matchdayId) ?? null;
  const selectedArenaMatchdayHasResult = Boolean(selectedArenaMatchday?.resultApplied);
  const selectedArenaMatchdayReadyText =
    selectedArenaMatchday?.readyTeams != null && selectedArenaMatchday?.totalTeams != null
      ? `${selectedArenaMatchday.readyTeams}/${selectedArenaMatchday.totalTeams} Teams`
      : null;

  const d1ScoreboardView = useMemo<MatchdayArenaScoreboardRowView[]>(() => {
    return buildMatchdayArenaScoreboardView(scoreFeed?.d1Scoreboard ?? []);
  }, [scoreFeed?.d1Scoreboard]);

  const d2ScoreboardView = useMemo<MatchdayArenaScoreboardRowView[]>(() => {
    return buildMatchdayArenaScoreboardView(scoreFeed?.d2Scoreboard ?? []);
  }, [scoreFeed?.d2Scoreboard]);

  const activeScoreboard = useMemo<MatchdayArenaScoreboardRowView[]>(() => {
    return disciplineSide === "d1" ? d1ScoreboardView : d2ScoreboardView;
  }, [d1ScoreboardView, d2ScoreboardView, disciplineSide]);

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
    const d1ByTeamId = new Map(d1ScoreboardView.map((row) => [row.teamId, row] as const));
    const d2ByTeamId = new Map(d2ScoreboardView.map((row) => [row.teamId, row] as const));
    const teamIds = new Set<string>([
      ...props.teams.map((team) => team.teamId),
      ...d1ByTeamId.keys(),
      ...d2ByTeamId.keys(),
    ]);

    const rows = [...teamIds].map((teamId) => {
      const d1 = d1ByTeamId.get(teamId) ?? null;
      const d2 = d2ByTeamId.get(teamId) ?? null;
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
        teamLogoUrl: team ? getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null) : null,
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
  }, [d1ScoreboardView, d2ScoreboardView, props.teams, standingsRankChangeByTeamId]);

  const winnerBoardSelectedTeamId = winnerBoardTeamId;
  const winnerBoardSelectedTeamDetail = useMemo(() => {
    if (!winnerBoardSelectedTeamId) {
      return null;
    }
    return resolveFeed?.teamDetails.find((entry) => entry.teamId === winnerBoardSelectedTeamId) ?? null;
  }, [resolveFeed?.teamDetails, winnerBoardSelectedTeamId]);

  const slotScoreByTeamId = useMemo(() => {
    const scoreByTeamId = new Map<string, number>();
    const deltaByTeamId = new Map<string, number>();
    const cumulativeItemsByTeamId = new Map<string, MatchdayArenaPhaseBreakdownItem[]>();

    (resolveFeed?.teamDetails ?? []).forEach((team) => {
      const disciplineEntries = team.entries
        .filter((entry) => entry.disciplineSide === disciplineSide)
        .sort((left, right) => left.slotIndex - right.slotIndex);

      let runningScore = 0;
      const cumulativeItems: MatchdayArenaPhaseBreakdownItem[] = [];
      for (const entry of disciplineEntries) {
        if (entry.slotIndex > slotRevealIndex) {
          continue;
        }
        runningScore += entry.baseScore ?? 0;
        cumulativeItems.push({
          id: "slots",
          label: `S${entry.slotIndex + 1}`,
          valueLabel: formatDecimalScore(runningScore, 1),
          tone: "neutral",
        });
      }

      const currentSlotBase = disciplineEntries.find((entry) => entry.slotIndex === slotRevealIndex)?.baseScore ?? null;

      scoreByTeamId.set(team.teamId, Number(runningScore.toFixed(1)));
      if (cumulativeItems.length) {
        cumulativeItemsByTeamId.set(team.teamId, cumulativeItems);
      }
      if (currentSlotBase != null) {
        deltaByTeamId.set(team.teamId, Number(currentSlotBase.toFixed(1)));
      }
    });

    return {
      scoreByTeamId,
      deltaByTeamId,
      cumulativeItemsByTeamId,
    };
  }, [disciplineSide, resolveFeed?.teamDetails, slotRevealIndex]);

  function getArenaLaneScore(row: MatchdayArenaScoreboardRowView) {
    if (currentPhase == null) {
      return 0;
    }
    if (currentPhase !== "slots") {
      return getMatchdayArenaPhaseScore(row, currentPhase);
    }
    const exactScore = slotScoreByTeamId.scoreByTeamId.get(row.teamId);
    if (exactScore != null) {
      return exactScore;
    }
    const revealedSlots = Math.max(1, Math.min(slotRevealIndex + 1, activeSlotCount || slotRevealIndex + 1));
    const totalSlots = Math.max(revealedSlots, activeSlotCount || revealedSlots);
    return Number(((row.baseScore * revealedSlots) / totalSlots).toFixed(1));
  }

  function getArenaLaneDelta(row: MatchdayArenaScoreboardRowView) {
    if (currentPhase == null) {
      return null;
    }
    if (currentPhase !== "slots") {
      return getMatchdayArenaPhaseDelta(row, currentPhase);
    }
    const exactDelta = slotScoreByTeamId.deltaByTeamId.get(row.teamId);
    if (exactDelta != null) {
      return exactDelta;
    }
    const revealedSlots = Math.max(1, Math.min(slotRevealIndex + 1, activeSlotCount || slotRevealIndex + 1));
    const totalSlots = Math.max(revealedSlots, activeSlotCount || revealedSlots);
    return Number((row.baseScore / totalSlots).toFixed(1));
  }

  function getArenaLaneBreakdownItems(row: MatchdayArenaScoreboardRowView) {
    if (currentPhase !== "slots") {
      return currentPhase == null ? [] : getMatchdayArenaPhaseBreakdown(row, currentPhase);
    }
    const exactItems = slotScoreByTeamId.cumulativeItemsByTeamId.get(row.teamId);
    if (exactItems?.length) {
      return exactItems;
    }
    const revealedSlots = Math.max(1, Math.min(slotRevealIndex + 1, activeSlotCount || slotRevealIndex + 1));
    const totalSlots = Math.max(revealedSlots, activeSlotCount || revealedSlots);
    return Array.from({ length: revealedSlots }, (_, index) => ({
      id: "slots" as const,
      label: `S${index + 1}`,
      valueLabel: formatDecimalScore((row.baseScore * (index + 1)) / totalSlots, 1),
      tone: "neutral" as const,
    }));
  }

  const activeScoreboardSorted = useMemo(() => {
    return [...activeScoreboard].sort((left, right) => {
      if (currentPhase == null) {
        return left.baseRank - right.baseRank;
      }
      const leftScore = getArenaLaneScore(left) ?? Number.NEGATIVE_INFINITY;
      const rightScore = getArenaLaneScore(right) ?? Number.NEGATIVE_INFINITY;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return left.rank - right.rank;
    });
  }, [activeScoreboard, currentPhase, slotScoreByTeamId]);

  const maxScore = useMemo(() => {
    return activeScoreboardSorted.reduce((max, row) => Math.max(max, getArenaLaneScore(row) ?? 0), 0);
  }, [activeScoreboardSorted, currentPhase, slotScoreByTeamId]);

  const resolvePlayerCatalogById = useMemo(() => {
    return new Map((resolveFeed?.playerCatalog ?? []).map((player) => [player.playerId, player]));
  }, [resolveFeed?.playerCatalog]);
  const foundationPlayerById = useMemo(() => {
    return new Map(props.playerCatalog.map((player) => [player.id, player]));
  }, [props.playerCatalog]);

  function resolveArenaPortrait(playerId: string, fallbackPortraitUrl?: string | null) {
    const foundationPlayer = foundationPlayerById.get(playerId) ?? null;
    return (
      fallbackPortraitUrl ??
      getPlayerPortraitBrowserUrl(
        playerId,
        foundationPlayer?.portraitUrl ?? null,
        foundationPlayer?.portraitPath ?? null,
      )
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

  const winnerBoardSelectedPlayers = useMemo<{ d1: ArenaFocusTeamEntryCard[]; d2: ArenaFocusTeamEntryCard[] }>(() => {
    const buildTeamPlayers = (disciplineKey: "d1" | "d2") => {
      if (!winnerBoardSelectedTeamDetail) {
        return [];
      }

      return winnerBoardSelectedTeamDetail.entries
        .filter((entry) => entry.disciplineSide === disciplineKey)
        .sort((left, right) => {
          if (left.slotIndex !== right.slotIndex) {
            return left.slotIndex - right.slotIndex;
          }
          return (right.finalPlayerScore ?? Number.NEGATIVE_INFINITY) - (left.finalPlayerScore ?? Number.NEGATIVE_INFINITY);
        })
        .map((entry) => {
          const catalogPlayer = resolvePlayerCatalogById.get(entry.playerId);
          const slotLabel = `${disciplineKey.toUpperCase()} Slot ${entry.slotIndex + 1}${entry.isCaptain ? " · Captain" : ""}`;
          return {
            disciplineSide: disciplineKey,
            playerId: entry.playerId,
            activePlayerId: entry.activePlayerId,
            playerName: entry.playerName,
            teamName: winnerBoardSelectedTeamDetail.teamName,
            className: resolveArenaClassName(entry.playerId, catalogPlayer?.className ?? null),
            portraitUrl: resolveArenaPortrait(entry.playerId, catalogPlayer?.portraitUrl ?? null),
            slotIndex: entry.slotIndex,
            slotLabel,
            baseScore: entry.baseScore,
            finalPlayerScore: entry.finalPlayerScore,
            pointsAwarded: entry.pointsAwarded,
            finalPointsAwarded: getArenaFinalPlayerPps(entry),
            mutatorPpsBonus: entry.mutatorPpsBonus,
            axisStats: buildArenaAxisStats(entry.playerId),
          };
        });
    };

    return {
      d1: buildTeamPlayers("d1"),
      d2: buildTeamPlayers("d2"),
    };
  }, [resolvePlayerCatalogById, winnerBoardSelectedTeamDetail, foundationPlayerById]);

  const winnerBoardTopPlayers = useMemo<{ d1: ArenaTopPlayerCard[]; d2: ArenaTopPlayerCard[] }>(() => {
    const buildTopPlayers = (
      topPlayers: MatchdayMvpTopPlayerRow[],
      scoreboard: MatchdayArenaScoreboardRowView[],
    ) => {
      return [...topPlayers]
        .sort(
          (left, right) =>
            (getArenaFinalPlayerPps(right) ?? Number.NEGATIVE_INFINITY) - (getArenaFinalPlayerPps(left) ?? Number.NEGATIVE_INFINITY) ||
            right.finalPlayerScore - left.finalPlayerScore ||
            left.playerName.localeCompare(right.playerName, "de"),
        )
        .slice(0, 10)
        .map((player) => {
          const catalogPlayer = resolvePlayerCatalogById.get(player.playerId);
          const row = scoreboard.find((entry) => entry.teamId === player.teamId) ?? null;
          const scoreboardTraitLabels = [row?.mutator1Label ?? null, row?.mutator2Label ?? null].filter(
            (label): label is string => Boolean(label),
          );
          const selectedTraitLabels = player.mutatorSelectedTraitLabels?.length
            ? player.mutatorSelectedTraitLabels
            : scoreboardTraitLabels;
          const badges = [
            (player.mutatorPpsBonus ?? 0) > 0 || (player.mutatorScoreBonus ?? 0) > 0 ? "Mutator" : null,
            row?.formCardStatus === "ready" && (row.formCardModifier ?? 0) !== 0 ? "Form" : null,
            row?.captainStatus === "mapped" && (row.captainModifier ?? 0) !== 0 ? "Captain" : null,
            (player.pointsAwarded ?? 0) > 0 ? "Spieltag-PPs" : null,
          ].filter((badge): badge is string => Boolean(badge));

          return {
            ...player,
            finalPointsAwarded: getArenaFinalPlayerPps(player),
            portraitUrl: resolveArenaPortrait(player.playerId, catalogPlayer?.portraitUrl ?? null),
            className: resolveArenaClassName(player.playerId, catalogPlayer?.className ?? null),
            activePlayerId: catalogPlayer?.activePlayerId ?? null,
            axisStats: buildArenaAxisStats(player.playerId),
            badges,
            mutatorSelectedTraitLabels: selectedTraitLabels,
          };
        });
    };

    return {
      d1: buildTopPlayers(scoreFeed?.d1TopPlayers ?? [], d1ScoreboardView),
      d2: buildTopPlayers(scoreFeed?.d2TopPlayers ?? [], d2ScoreboardView),
    };
	  }, [d1ScoreboardView, d2ScoreboardView, foundationPlayerById, resolvePlayerCatalogById, scoreFeed?.d1TopPlayers, scoreFeed?.d2TopPlayers]);

  const d1Label = scoreFeed?.targetMatchday.d1DisciplineName ?? context?.matchdayContract?.discipline1?.displayName ?? "D1";
  const d2Label = scoreFeed?.targetMatchday.d2DisciplineName ?? context?.matchdayContract?.discipline2?.displayName ?? "D2";

  const winnerBoardSlotTopPlayers = useMemo<{ d1: ArenaSlotPlayerCard[]; d2: ArenaSlotPlayerCard[] }>(() => {
    const buildSlotTopPlayers = (
      side: "d1" | "d2",
      fallbackPlayers: ArenaSlotTopPlayerSource[],
      disciplineName: string,
    ) => {
      const detailPlayers = (resolveFeed?.teamDetails ?? [])
        .flatMap((team) =>
          team.entries
            .filter((entry) => entry.disciplineSide === side && entry.slotIndex <= slotRevealIndex)
            .map((entry) => ({
              ...entry,
              teamId: team.teamId,
              teamName: team.teamName,
            })),
        );
      const slotPlayers =
        detailPlayers.length > 0
          ? detailPlayers
          : fallbackPlayers
              .filter((player) => player.slotIndex <= slotRevealIndex)
              .map((player) => ({
                ...player,
                activePlayerId: null,
                baseScore: player.baseValue ?? player.finalPlayerScore,
              }));

      return slotPlayers
	        .sort(
	          (left, right) =>
	            (right.baseScore ?? Number.NEGATIVE_INFINITY) - (left.baseScore ?? Number.NEGATIVE_INFINITY) ||
	            left.slotIndex - right.slotIndex ||
	            left.playerName.localeCompare(right.playerName, "de"),
	        )
        .slice(0, 10)
        .map((player, index) => {
          const catalogPlayer = resolvePlayerCatalogById.get(player.playerId);
	          return {
	            playerId: player.playerId,
	            activePlayerId: catalogPlayer?.activePlayerId ?? null,
            playerName: player.playerName,
            teamName: props.teams.find((team) => team.teamId === player.teamId)?.name ?? player.teamId,
            className: resolveArenaClassName(player.playerId, catalogPlayer?.className ?? null),
            portraitUrl: resolveArenaPortrait(player.playerId, catalogPlayer?.portraitUrl ?? null),
            rank: index + 1,
            slotIndex: player.slotIndex,
            disciplineName,
	            baseValue: player.baseScore ?? 0,
	            axisStats: buildArenaAxisStats(player.playerId),
	          };
	        });
    };

    return {
      d1: buildSlotTopPlayers("d1", scoreFeed?.d1TopPlayers ?? [], d1Label),
      d2: buildSlotTopPlayers("d2", scoreFeed?.d2TopPlayers ?? [], d2Label),
    };
  }, [d1Label, d2Label, foundationPlayerById, resolveFeed?.teamDetails, resolvePlayerCatalogById, scoreFeed?.d1TopPlayers, scoreFeed?.d2TopPlayers, slotRevealIndex]);

  function formatArenaMutatorContribution(player: ArenaTopPlayerCard) {
    if (player.mutatorPpsBonus == null || player.mutatorPpsBonus <= 0) {
      return player.disciplineName;
    }
    const traitText = player.mutatorSelectedTraitLabels?.length ? ` (${player.mutatorSelectedTraitLabels.join(" + ")})` : "";
    return `${player.disciplineName} · Mut +${formatDecimalScore(player.mutatorPpsBonus, 1)}${traitText}`;
  }

  const activeResolveTopPlayers = disciplineSide === "d1" ? resolveFeed?.topPlayers.d1 ?? [] : resolveFeed?.topPlayers.d2 ?? [];

  const activeSlotRoles = useMemo(() => {
    return resolveSlotRolesForDiscipline(activeDisciplineId, activeDisciplineLabel, activeSlotCount);
  }, [activeDisciplineId, activeDisciplineLabel, activeSlotCount]);
  const maxSlotRevealIndex = Math.max(activeSlotRoles.length - 1, 0);
  const isSlotsPhase = currentPhase === "slots";

  function advanceArenaStep() {
    if (phaseIndex < 0) {
      setPhaseIndex(0);
      setSlotRevealIndex(0);
      return;
    }
    if (isSlotsPhase && activeSlotRoles.length > 0 && slotRevealIndex < maxSlotRevealIndex) {
      setSlotRevealIndex((current) => Math.min(current + 1, maxSlotRevealIndex));
      return;
    }
    setPhaseIndex((current) => Math.min(current + 1, MATCHDAY_ARENA_PHASES.length - 1));
  }

  function getCurrentStepDuration() {
    const baseDuration = getPhaseDuration(speed);
    if (isSlotsPhase) {
      return baseDuration + 450;
    }
    return baseDuration;
  }

  function jumpToArenaPhase(phaseId: (typeof MATCHDAY_ARENA_PHASES)[number]["id"]) {
    const nextPhaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === phaseId);
    if (nextPhaseIndex < 0) {
      return;
    }

    const slotsPhaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "slots");
    setIsPlaying(false);
    setPhaseIndex(nextPhaseIndex);

    if (phaseId === "slots") {
      setSlotRevealIndex(0);
      return;
    }

    if (slotsPhaseIndex >= 0 && nextPhaseIndex > slotsPhaseIndex) {
      setSlotRevealIndex(maxSlotRevealIndex);
      return;
    }

    setSlotRevealIndex(0);
  }

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }
    if (phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1) {
      setIsPlaying(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      advanceArenaStep();
    }, getCurrentStepDuration());

    return () => window.clearTimeout(timeoutId);
  }, [isPlaying, phaseIndex, speed, isSlotsPhase, activeSlotRoles.length, slotRevealIndex, maxSlotRevealIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
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
      if (isTextTarget || modalOpen || phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      advanceArenaStep();
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [phaseIndex, isSlotsPhase, activeSlotRoles.length, slotRevealIndex, maxSlotRevealIndex]);

  const activeTeamDetail = useMemo(() => {
    return resolveFeed?.teamDetails.find((entry) => entry.teamId === params.teamId) ?? null;
  }, [params.teamId, resolveFeed?.teamDetails]);

  const revealedSlotLimit = useMemo(() => {
    if (currentPhase == null) {
      return -1;
    }
    if (currentPhase === "slots") {
      return slotRevealIndex;
    }
    return Math.max(activeSlotRoles.length - 1, 0);
  }, [activeSlotRoles.length, currentPhase, slotRevealIndex]);

  const focusTeamEntries = useMemo<ArenaFocusTeamEntryCard[]>(() => {
    if (!activeTeamDetail) {
      return [];
    }
    return activeTeamDetail.entries
      .filter((entry) => entry.disciplineSide === disciplineSide)
      .filter((entry) => entry.slotIndex <= revealedSlotLimit)
      .sort((left, right) => left.slotIndex - right.slotIndex)
      .map((entry) => {
        const role = activeSlotRoles[entry.slotIndex];
        const catalogPlayer = resolvePlayerCatalogById.get(entry.playerId);
        return {
          playerId: entry.playerId,
          activePlayerId: entry.activePlayerId,
          playerName: entry.playerName,
          teamName: activeTeamDetail.teamName,
          className: resolveArenaClassName(entry.playerId, catalogPlayer?.className ?? null),
          portraitUrl: resolveArenaPortrait(entry.playerId, catalogPlayer?.portraitUrl ?? null),
          slotIndex: entry.slotIndex,
          slotLabel: role?.label ?? `Slot ${entry.slotIndex + 1}`,
          baseScore: entry.baseScore,
          finalPlayerScore: entry.finalPlayerScore,
          pointsAwarded: entry.pointsAwarded,
          axisStats: buildArenaAxisStats(entry.playerId),
        };
      });
  }, [activeSlotRoles, activeTeamDetail, disciplineSide, resolvePlayerCatalogById, revealedSlotLimit, foundationPlayerById]);

  const slotSpotlights = useMemo(() => {
    return activeSlotRoles.map((role, slotIndex) => {
      const topPlayers = activeResolveTopPlayers
        .filter((player) => player.slotIndex === slotIndex)
        .slice(0, 5)
        .map((player) => {
          const catalogPlayer = resolvePlayerCatalogById.get(player.playerId);
          return {
            ...player,
            portraitUrl: resolveArenaPortrait(player.playerId, catalogPlayer?.portraitUrl ?? null),
            className: resolveArenaClassName(player.playerId, catalogPlayer?.className ?? null),
            activePlayerId: catalogPlayer?.activePlayerId ?? null,
            axisStats: buildArenaAxisStats(player.playerId),
          };
        });
      const humanPlayers = (resolveFeed?.teamDetails ?? [])
        .filter((team) => getToneForTeam(team.teamId, params.teamId, teamOptions, props.teamControlSettingsMap) !== "ai")
        .flatMap((team) =>
          team.entries
            .filter((entry) => entry.disciplineSide === disciplineSide && entry.slotIndex === slotIndex)
            .map((entry) => ({
              teamId: team.teamId,
              teamName: team.teamName,
              ...entry,
            })),
        )
        .sort((left, right) => (right.finalPlayerScore ?? Number.NEGATIVE_INFINITY) - (left.finalPlayerScore ?? Number.NEGATIVE_INFINITY))
        .slice(0, 4)
        .map((entry) => {
          const catalogPlayer = resolvePlayerCatalogById.get(entry.playerId);
          return {
            ...entry,
            portraitUrl: resolveArenaPortrait(entry.playerId, catalogPlayer?.portraitUrl ?? null),
            className: resolveArenaClassName(entry.playerId, catalogPlayer?.className ?? null),
          };
        });
      const selectedEntry =
        activeTeamDetail?.entries.find(
          (entry) => entry.disciplineSide === disciplineSide && entry.slotIndex === slotIndex,
        ) ?? null;

      return {
        slotIndex,
        role,
        topPlayers,
        humanPlayers,
        selectedEntry,
      };
    });
  }, [activeResolveTopPlayers, activeSlotRoles, activeTeamDetail, disciplineSide, foundationPlayerById, params.teamId, props.teamControlSettingsMap, resolveFeed?.teamDetails, resolvePlayerCatalogById, teamOptions]);

  const focusedSlotSpotlight =
    slotSpotlights[Math.min(slotRevealIndex, Math.max(slotSpotlights.length - 1, 0))] ?? null;

  const isSlotRevealPhase = currentPhase === "slots";
  const winnerBoardSelectedVisiblePlayers = {
    d1: isSlotRevealPhase
      ? winnerBoardSelectedPlayers.d1.filter((player) => player.slotIndex <= slotRevealIndex)
      : winnerBoardSelectedPlayers.d1,
    d2: isSlotRevealPhase
      ? winnerBoardSelectedPlayers.d2.filter((player) => player.slotIndex <= slotRevealIndex)
      : winnerBoardSelectedPlayers.d2,
  };
  const winnerBoardVisibleTopPlayers: {
    d1: Array<ArenaTopPlayerCard | ArenaSlotPlayerCard>;
    d2: Array<ArenaTopPlayerCard | ArenaSlotPlayerCard>;
  } = {
    d1: isSlotRevealPhase ? winnerBoardSlotTopPlayers.d1 : winnerBoardTopPlayers.d1,
    d2: isSlotRevealPhase ? winnerBoardSlotTopPlayers.d2 : winnerBoardTopPlayers.d2,
  };

  function isArenaSlotPlayerCard(player: ArenaTopPlayerCard | ArenaSlotPlayerCard): player is ArenaSlotPlayerCard {
    return "baseValue" in player;
  }

  function renderWinnerSelectedPlayerCard(player: ArenaFocusTeamEntryCard, index: number, side: "d1" | "d2") {
    return (
      <MatchdayArenaPlayerCard
        key={`arena-winner-${side}-player-${player.playerId}-${index + 1}`}
        rank={null}
        portraitUrl={player.portraitUrl}
        playerName={player.playerName}
        teamName={player.teamName}
        className={player.className}
        scoreLabel={
          isSlotRevealPhase
            ? `S${player.slotIndex + 1}: ${formatDecimalScore(player.baseScore, 1)}`
            : `Score ${formatDecimalScore(player.finalPlayerScore, 1)}`
        }
        pointsLabel={
          isSlotRevealPhase
            ? null
            : formatArenaFinalPlayerPps(player)
        }
        axisStats={player.axisStats}
        contributionLabel={
          isSlotRevealPhase
            ? `${player.slotLabel} · aufgedeckt`
            : `${player.slotLabel} · Slots ${formatDecimalScore(player.baseScore, 1)}`
        }
        variant="compact"
        onOpen={
          props.onOpenPlayerDetails
            ? () =>
                props.onOpenPlayerDetails?.({
                  playerId: player.playerId,
                  activePlayerId: player.activePlayerId,
                })
            : null
        }
      />
    );
  }

  function renderWinnerTopPlayerCard(player: ArenaTopPlayerCard | ArenaSlotPlayerCard, index: number, side: "d1" | "d2") {
    const isSlotPlayer = isArenaSlotPlayerCard(player);
    return (
      <MatchdayArenaPlayerCard
        key={`arena-winner-${side}-top-player-${player.playerId}-${index + 1}`}
        rank={isSlotPlayer ? player.rank : index + 1}
        portraitUrl={player.portraitUrl}
        playerName={player.playerName}
        teamName={player.teamName}
        className={player.className}
        scoreLabel={
          isSlotPlayer
            ? `S${player.slotIndex + 1}: ${formatDecimalScore(player.baseValue, 1)}`
            : `Score ${formatDecimalScore(player.finalPlayerScore, 1)}`
        }
        pointsLabel={
          isSlotPlayer
            ? null
            : formatArenaFinalPlayerPps(player)
        }
        axisStats={player.axisStats}
        contributionLabel={
          isSlotPlayer
            ? `${player.disciplineName} · Slot ${player.slotIndex + 1}`
            : formatArenaMutatorContribution(player)
        }
        variant="compact"
        onOpen={
          props.onOpenPlayerDetails
            ? () =>
                props.onOpenPlayerDetails?.({
                  playerId: player.playerId,
                  activePlayerId: player.activePlayerId,
                })
            : null
        }
      />
    );
  }

  const resultLeaders = [...activeScoreboard].sort((left, right) => left.rank - right.rank).slice(0, 3);
  const arenaTodoCards = useMemo(() => {
    const cards: Array<{ key: string; label: string; detail: string; actionLabel: string | null }> = [];
    const hasMissingLineups =
      scoreFeed?.status === "blocked" ||
      warnings.some((warning) => warning.includes("missing_lineups") || warning.includes("Lineup"));

    if (hasMissingLineups) {
      cards.push({
        key: "lineups",
        label: "Einsatzlisten fehlen",
        detail: "Erst offene Teams setzen, dann kann der Reveal sauber starten.",
        actionLabel: props.onBackToLineup ? "Zur Einsatzliste" : null,
      });
    }

    if (!scoreFeed || activeScoreboard.length === 0) {
      cards.push({
        key: "score",
        label: "Scorefeed laden",
        detail: "Kontext laden oder Spieltag pruefen, falls noch keine Scores sichtbar sind.",
        actionLabel: null,
      });
    }

    return cards;
  }, [activeScoreboard.length, props.onBackToLineup, scoreFeed, warnings]);
  const arenaNextStepCards = useMemo(
    () => [
      {
        key: "lineup",
        label: "Room nachschaerfen",
        detail: "Zurueck zur Einsatzliste, wenn ein Slot, Captain oder Team-Boost auffaellt.",
        actionLabel: "Einsatzliste",
        onClick: props.onBackToLineup ?? null,
        tone: "lineup" as const,
      },
      {
        key: "season",
        label: "Tabelle lesen",
        detail: "Direkt sehen, was der Spieltag in der Saison veraendert.",
        actionLabel: "Saisonstand",
        onClick: props.onOpenSeason ?? null,
        tone: "season" as const,
      },
      {
        key: "result",
        label: selectedArenaMatchdayHasResult ? "Ergebnis ansehen" : "Spieltag speichern",
        detail: selectedArenaMatchdayHasResult
          ? "Gespeichertes Ergebnis fuer diesen Spieltag oeffnen."
          : "Komplettes Spieltagsergebnis mit beiden Disziplinen oeffnen.",
        actionLabel: "Ergebnis",
        onClick: props.onOpenMatchdayResult ? () => props.onOpenMatchdayResult?.({ matchdayId: params.matchdayId }) : null,
        tone: "result" as const,
      },
    ],
    [params.matchdayId, props.onBackToLineup, props.onOpenMatchdayResult, props.onOpenSeason, selectedArenaMatchdayHasResult],
  );
  const resultDecisionFactors = useMemo(() => {
    const leader = resultLeaders[0] ?? null;
    const runnerUp = resultLeaders[1] ?? null;
    if (!leader) {
      return [];
    }
    const scoreGap =
      runnerUp && leader.score != null && runnerUp.score != null
        ? Number((leader.score - runnerUp.score).toFixed(1))
        : null;
    const modifierTotal =
      (leader.formCardModifier ?? 0) +
      (leader.captainModifier ?? 0) +
      (leader.mutator1Modifier ?? 0) +
      (leader.mutator2Modifier ?? 0);

    return [
      {
        key: "gap",
        label: "Abstand",
        value: scoreGap != null ? formatSignedDelta(scoreGap) : "—",
        detail: runnerUp ? `gegen ${runnerUp.teamName}` : "kein zweites Team",
      },
      {
        key: "mods",
        label: "Boosts",
        value: formatSignedDelta(modifierTotal),
        detail: "Form + Mutator + Captain",
      },
      {
        key: "push",
        label: "Push",
        value: formatSignedDelta(leader.fatigueModifier ?? 0),
        detail: leader.fatigueModifier && leader.fatigueModifier < 0 ? "Schonen/Belastung bremst" : "Push/Belastung stabil",
      },
    ];
  }, [resultLeaders]);
  const matchdayStoryline = useMemo(() => {
    const winner = matchdayWinnerRows[0] ?? null;
    const runnerUp = matchdayWinnerRows[1] ?? null;
    if (!winner) {
      return null;
    }

    const d1Gap =
      runnerUp && winner.d1Points != null && runnerUp.d1Points != null
        ? Number((winner.d1Points - runnerUp.d1Points).toFixed(1))
        : null;
    const d2Gap =
      runnerUp && winner.d2Points != null && runnerUp.d2Points != null
        ? Number((winner.d2Points - runnerUp.d2Points).toFixed(1))
        : null;
    const decidingSide =
      d1Gap != null && d2Gap != null
        ? Math.abs(d2Gap) > Math.abs(d1Gap)
          ? { label: d2Label, gap: d2Gap, key: "d2" as const }
          : { label: d1Label, gap: d1Gap, key: "d1" as const }
        : null;
    const winnerD1 = d1ScoreboardView.find((row) => row.teamId === winner.teamId) ?? null;
    const winnerD2 = d2ScoreboardView.find((row) => row.teamId === winner.teamId) ?? null;
    const captainSwing = Number(((winnerD1?.captainModifier ?? 0) + (winnerD2?.captainModifier ?? 0)).toFixed(1));
    const fatigueSwing = Number(((winnerD1?.fatigueModifier ?? 0) + (winnerD2?.fatigueModifier ?? 0)).toFixed(1));
    const boostSwing = Number(
      (
        (winnerD1?.formCardModifier ?? 0) +
        (winnerD2?.formCardModifier ?? 0) +
        (winnerD1?.mutator1Modifier ?? 0) +
        (winnerD1?.mutator2Modifier ?? 0) +
        (winnerD2?.mutator1Modifier ?? 0) +
        (winnerD2?.mutator2Modifier ?? 0)
      ).toFixed(1),
    );
    const topPerformers = [
      ...winnerBoardTopPlayers.d1.map((player) => ({ ...player, sideLabel: d1Label })),
      ...winnerBoardTopPlayers.d2.map((player) => ({ ...player, sideLabel: d2Label })),
    ]
      .sort(
        (left, right) =>
          (right.finalPointsAwarded ?? Number.NEGATIVE_INFINITY) - (left.finalPointsAwarded ?? Number.NEGATIVE_INFINITY) ||
          right.finalPlayerScore - left.finalPlayerScore,
      )
      .slice(0, 3);
    const totalGap =
      runnerUp && winner.totalPoints != null && runnerUp.totalPoints != null
        ? Number((winner.totalPoints - runnerUp.totalPoints).toFixed(1))
        : null;
    const strongestSignal =
      Math.abs(boostSwing) >= Math.abs(captainSwing) && Math.abs(boostSwing) >= Math.abs(fatigueSwing)
        ? { label: "Boosts", value: boostSwing, detail: "Form + Powers/Mutator" }
        : Math.abs(captainSwing) >= Math.abs(fatigueSwing)
          ? { label: "Captain", value: captainSwing, detail: "Captain-Impact" }
          : { label: "Belastung", value: fatigueSwing, detail: "Push/Schonen/Fatigue" };

    return {
      winner,
      runnerUp,
      totalGap,
      decidingSide,
      topPerformers,
      strongestSignal,
      boostLabels: [...winner.d1Mutators, ...winner.d2Mutators].slice(0, 3),
      warningCount: (winnerD1?.warnings?.length ?? 0) + (winnerD2?.warnings?.length ?? 0),
    };
  }, [d1Label, d1ScoreboardView, d2Label, d2ScoreboardView, matchdayWinnerRows, winnerBoardTopPlayers]);
  const isMatchdayScoreRaceComplete = currentPhase === "result";
  const seasonLabel = getCanonicalSeasonLabel({ seasonId: params.seasonId });
  const phaseLabel =
    currentPhase == null
      ? "Start"
      : currentPhase === "slots" && activeSlotRoles.length
      ? `Slots ${Math.min(slotRevealIndex + 1, activeSlotRoles.length)}/${activeSlotRoles.length}`
      : (MATCHDAY_ARENA_PHASES[phaseIndex]?.label ?? "—");
  return (
    <section className={`matchday-arena-shell is-${currentPhase ?? "idle"}${eventMode ? " is-event-mode" : ""}`}>
      <div className="panel-header matchday-arena-panel-header">
        <div className="stack">
          <TooltipHeading
            as="h2"
            tooltip={`Reveal-Ansicht fuer ${seasonLabel} · Spieltag ${context?.matchday.index ?? "—"}. Room bleibt Vorbereitung, Arena zeigt den Score-Race einer aktiven Disziplin.`}
          >
            Spieltag Arena
          </TooltipHeading>
          <span className="muted matchday-arena-header-subline">
            {seasonLabel} · {context?.matchday.label ?? "Spieltag —"} · {d1Label} / {d2Label}
          </span>
        </div>
        <div className="matchday-arena-header-actions">
          <button
            className={`secondary-button inline-button${eventMode ? " is-selected" : ""}`}
            type="button"
            onClick={() => setEventMode((current) => !current)}
          >
            {eventMode ? "Normal" : "Event"}
          </button>
          <button className="secondary-button inline-button" type="button" onClick={() => void loadArena(params, source)} disabled={isBusy}>
            Neu laden
          </button>
          {props.onBackToLineup ? (
            <button className="secondary-button inline-button" type="button" onClick={props.onBackToLineup}>
              Einsatzliste
            </button>
          ) : null}
        </div>
      </div>

      <section className="matchday-arena-hero panel">
        <div className="matchday-arena-hero-main">
          <div
            key={`arena-broadcast-${currentPhase ?? "idle"}-${disciplineSide}-${scoreFeed?.status ?? "waiting"}-${slotRevealIndex}`}
            className={`matchday-arena-broadcast-strip is-${scoreFeed?.status ?? "waiting"}`}
          >
            <div>
              <span>Broadcast</span>
              <strong>{d1Label} / {d2Label}</strong>
            </div>
            <p>
              {scoreFeed?.status === "blocked"
                ? "Erst alle Einsatzlisten speichern, dann kann die Arena den Spieltag sauber zeigen."
                : selectedArenaMatchdayHasResult
                  ? "Gespeicherter Spieltag: die Arena zeigt direkt das Ergebnis."
                : activeScoreboard.length
                  ? `${activeScoreboard[0]?.teamName ?? "Fuehrung"} liegt aktuell vorne.`
                  : "Bereit fuer den Reveal, sobald Score-Daten vorhanden sind."}
            </p>
          </div>
          <div className="matchday-arena-hero-kpis">
            <article className="metric-card">
              <span>Spieltag</span>
              <strong>{context?.matchday.label ?? "—"}</strong>
              <small>{seasonLabel}</small>
            </article>
            <article className="metric-card">
              <span>Disziplin</span>
              <strong>{activeDisciplineLabel}</strong>
              <small>{activeSlotCount ?? "—"} Slots</small>
            </article>
            <article className="metric-card">
              <span>Arena</span>
              <strong>{selectedArenaMatchdayHasResult ? "Ergebnis" : formatArenaStatusLabel(scoreFeed?.status)}</strong>
              <small>{selectedArenaMatchdayHasResult ? "gespeichert" : isBusy ? "Basis lädt" : isDetailBusy ? "Preview lädt" : "bereit"}</small>
            </article>
            <article className="metric-card">
              <span>Phase</span>
              <strong>{phaseLabel}</strong>
              <small>Spielansicht</small>
            </article>
          </div>
          <MatchdayArenaTimeline activePhase={currentPhase} onSelectPhase={jumpToArenaPhase} />
        </div>
        <div className="matchday-arena-controls">
          <div className="matchday-arena-focus-select">
            <label htmlFor="matchday-arena-matchday">Spieltag</label>
            <select
              id="matchday-arena-matchday"
              value={params.matchdayId}
              onChange={(event) => {
                const nextMatchdayId = event.currentTarget.value;
                const nextParams = {
                  ...params,
                  matchdayId: nextMatchdayId,
                };
                setParams(nextParams);
                setWinnerBoardTeamId(null);
                void loadArena(nextParams, source);
              }}
              disabled={isBusy || !matchdayOptions.length}
            >
              {matchdayOptions.length ? (
                matchdayOptions.map((matchday) => (
                  <option key={`arena-matchday-${matchday.id}`} value={matchday.id}>
                    MD {matchday.index ?? "—"} · {matchday.label}
                    {matchday.resultApplied ? " · Ergebnis" : ""}
                    {!matchday.resultApplied && matchday.isReady ? " · bereit" : ""}
                  </option>
                ))
              ) : (
                <option value={params.matchdayId}>{context?.matchday.label ?? params.matchdayId}</option>
              )}
            </select>
            {selectedArenaMatchdayReadyText ? (
              <small className="muted">
                {selectedArenaMatchdayHasResult ? "gespielt" : selectedArenaMatchdayReadyText}
              </small>
            ) : null}
          </div>
          <div className="matchday-arena-focus-select">
            <label>Aktives Team</label>
            <strong>{context?.team.name ?? params.teamId}</strong>
            <small className="muted">Wechsel oben in der Foundation-Leiste.</small>
          </div>
          <div className="matchday-arena-side-switch">
            <button
              className={`secondary-button inline-button${disciplineSide === "d1" ? " is-selected" : ""}`}
              type="button"
              onClick={() => {
                setDisciplineSide("d1");
                setPhaseIndex(-1);
                setSlotRevealIndex(0);
                setIsPlaying(false);
              }}
            >
              D1
            </button>
            <button
              className={`secondary-button inline-button${disciplineSide === "d2" ? " is-selected" : ""}`}
              type="button"
              onClick={() => {
                setDisciplineSide("d2");
                setPhaseIndex(-1);
                setSlotRevealIndex(0);
                setIsPlaying(false);
              }}
            >
              D2
            </button>
          </div>
          <div className="matchday-arena-control-row">
            <button className="secondary-button inline-button" type="button" onClick={() => setIsPlaying(true)} disabled={isPlaying || phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1}>
              Play
            </button>
            <button className="secondary-button inline-button" type="button" onClick={() => setIsPlaying(false)} disabled={!isPlaying}>
              Pause
            </button>
            <button
              className="secondary-button inline-button"
              type="button"
              onClick={advanceArenaStep}
              disabled={phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1}
            >
              Step
            </button>
            <button
              className="secondary-button inline-button"
              type="button"
              onClick={() => {
                setPhaseIndex(MATCHDAY_ARENA_PHASES.length - 1);
                setSlotRevealIndex(maxSlotRevealIndex);
                setIsPlaying(false);
              }}
            >
              Ergebnis
            </button>
            <button
              className="secondary-button inline-button"
              type="button"
              onClick={() => {
                setPhaseIndex(-1);
                setSlotRevealIndex(0);
                setIsPlaying(false);
              }}
              disabled={phaseIndex < 0 && slotRevealIndex === 0}
            >
              Reset
            </button>
          </div>
          <div className="matchday-arena-control-row">
            {[1, 2, 4].map((value) => (
              <button
                key={`arena-speed-${value}`}
                className={`secondary-button inline-button${speed === value ? " is-selected" : ""}`}
                type="button"
                onClick={() => setSpeed(value as ArenaPhaseControlSpeed)}
              >
                x{value}
              </button>
            ))}
          </div>
        </div>
      </section>

      {errors.length ? (
        <div className="panel matchday-arena-feedback is-error">
          <strong>Arena konnte nicht vollständig laden</strong>
          <ul className="warning-list compact-list">
            {errors.map((error) => (
              <li key={`arena-error-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!errors.length && warnings.length ? (
        <div className="panel matchday-arena-feedback is-warning">
          <strong>Hinweise zur Arena</strong>
          <ul className="warning-list compact-list">
            {warnings.slice(0, 6).map((warning) => (
              <li key={`arena-warning-${warning}`}>{formatArenaWarning(warning)}</li>
            ))}
          </ul>
          {warnings.length > 6 ? <small className="muted">+{warnings.length - 6} weitere Hinweise</small> : null}
        </div>
      ) : null}

      {!errors.length && isDetailBusy ? (
        <div className="panel matchday-arena-feedback">
          <strong>Preview lädt im Hintergrund</strong>
          <p className="muted">
            Score-Race, D1/D2 und Spieltagsstatus sind schon nutzbar. Detailwerte fuer Slots und Tabellen-Delta kommen gleich nach.
          </p>
        </div>
      ) : null}

      {arenaTodoCards.length > 0 ? (
        <section className="matchday-arena-todo-grid" aria-label="Arena To-dos">
          {arenaTodoCards.map((card) => (
            <article key={`arena-todo-${card.key}`} className="matchday-arena-todo-card">
              <span>To-do</span>
              <strong>{card.label}</strong>
              <small>{card.detail}</small>
              {card.key === "lineups" && props.onBackToLineup ? (
                <button className="secondary-button inline-button" type="button" onClick={props.onBackToLineup}>
                  {card.actionLabel}
                </button>
              ) : card.key === "score" ? (
                <button className="secondary-button inline-button" type="button" onClick={() => void loadArena(params, source)} disabled={isBusy}>
                  Kontext laden
                </button>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="panel matchday-arena-winner-board">
        <div className="panel-header matchday-arena-side-header">
          <div className="stack">
            <TooltipHeading
              as="h3"
              tooltip="Kompakte 32er-Spieltagstabelle: D1-Punkte plus D2-Punkte ergeben die Gesamtpunkte. Rang-Delta kommt aus der Standings-Preview vor/nach diesem Spieltag."
            >
              Spieltagssieger
            </TooltipHeading>
            <small className="muted">
              Mitte zeigt alle 32 Teams. Team anklicken fuer Kader links und rechts, sonst bleiben die Topspieler sichtbar.
            </small>
          </div>
        </div>
        <div className="matchday-arena-winner-layout">
          <aside className="matchday-arena-winner-side">
            <strong>{winnerBoardSelectedTeamDetail ? `${winnerBoardSelectedTeamDetail.teamName} · ${d1Label}` : d1Label}</strong>
            <span className="muted">
              {winnerBoardSelectedTeamDetail
                ? isSlotRevealPhase
                  ? `D1-Slots bis S${slotRevealIndex + 1} von ${winnerBoardSelectedTeamDetail.teamName}`
                  : `D1-Spieler von ${winnerBoardSelectedTeamDetail.teamName}`
                : isSlotRevealPhase
                  ? `D1 Top 10 bis Slot ${slotRevealIndex + 1}`
                  : "D1 Top 10 nach finalen Spieltags-PPs"}
            </span>
            <div className="matchday-arena-player-stack">
              {winnerBoardSelectedTeamDetail ? (
                winnerBoardSelectedVisiblePlayers.d1.length ? (
                  winnerBoardSelectedVisiblePlayers.d1.map((player, index) =>
                    renderWinnerSelectedPlayerCard(player, index, "d1"),
                  )
                ) : (
                  <div className="matchday-arena-empty-card">
                    <strong>{`Keine ${d1Label}-Spieler gefunden`}</strong>
                    <span className="muted">Für dieses Team liegen in D1 gerade keine Arena-Spieler vor.</span>
                    {props.onBackToLineup ? (
                      <button className="secondary-button inline-button" type="button" onClick={props.onBackToLineup}>
                        Zur Einsatzliste
                      </button>
                    ) : null}
                  </div>
                )
              ) : (
                winnerBoardVisibleTopPlayers.d1.length ? (
                  winnerBoardVisibleTopPlayers.d1.map((player, index) =>
                    renderWinnerTopPlayerCard(player, index, "d1"),
                  )
                ) : (
                  <div className="matchday-arena-empty-card">
                    <strong>Keine D1-Topspieler</strong>
                    <span className="muted">Erst Einsatzlisten speichern, dann erscheinen hier die Topspieler.</span>
                    {props.onBackToLineup ? (
                      <button className="secondary-button inline-button" type="button" onClick={props.onBackToLineup}>
                        Zur Einsatzliste
                      </button>
                    ) : null}
                  </div>
                )
              )}
            </div>
          </aside>

          <div
            className={[
              "matchday-arena-winner-table-shell",
              isMatchdayScoreRaceComplete ? "is-result-table" : "is-score-race-stage",
            ].join(" ")}
          >
            {isMatchdayScoreRaceComplete ? (
              <table className="matchday-arena-winner-table">
                <thead>
                  <tr>
                    <th>R</th>
                    <th>Team</th>
                    <th>Bonus</th>
                    <th>D1</th>
                    <th>D2</th>
                    <th>Ges.</th>
                    <th>Saison</th>
                  </tr>
                </thead>
                <tbody>
                  {matchdayWinnerRows.map((row) => {
                    const medalLabel = row.medal === "gold" ? "🥇" : row.medal === "silver" ? "🥈" : row.medal === "bronze" ? "🥉" : null;
                    const isSelected = row.teamId === winnerBoardSelectedTeamId;
                    return (
                      <tr
                        key={`arena-winner-row-${row.teamId}`}
                        className={[
                          row.medal ? `is-${row.medal}` : "",
                          isSelected ? "is-selected" : "",
                        ].filter(Boolean).join(" ")}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setWinnerBoardTeamId((current) => (current === row.teamId ? null : row.teamId));
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setWinnerBoardTeamId((current) => (current === row.teamId ? null : row.teamId));
                          }
                        }}
                      >
                        <td>
                          <span className="matchday-arena-winner-rank">
                            {medalLabel ?? row.rank}
                          </span>
                        </td>
                        <td>
                          <span className="matchday-arena-winner-team">
                            {row.teamLogoUrl ? (
                              <OptimizedMediaImage
                                className="matchday-arena-winner-logo"
                                src={row.teamLogoUrl}
                                alt=""
                                width={32}
                                height={32}
                              />
                            ) : null}
                            <span>
                              <strong>{row.teamName}</strong>
                            </span>
                          </span>
                        </td>
                        <td className="matchday-arena-winner-bonus">
                          <small>D1 {row.d1Mutators.length ? row.d1Mutators.join(" / ") : "—"}</small>
                          <small>D2 {row.d2Mutators.length ? row.d2Mutators.join(" / ") : "—"}</small>
                        </td>
                        <td>{row.d1Points != null ? formatDecimalScore(row.d1Points, 1) : "—"}</td>
                        <td>{row.d2Points != null ? formatDecimalScore(row.d2Points, 1) : "—"}</td>
                        <td>
                          <strong>{row.totalPoints != null ? formatDecimalScore(row.totalPoints, 1) : "—"}</strong>
                          <small>Score {formatDecimalScore(row.totalScore, 1)}</small>
                        </td>
                        <td className={row.seasonRankDelta != null && row.seasonRankDelta > 0 ? "is-positive" : row.seasonRankDelta != null && row.seasonRankDelta < 0 ? "is-negative" : ""}>
                          {formatSeasonRankChange(row.seasonRank, row.seasonRankDelta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="matchday-arena-winner-race-stage">
                <div className="matchday-arena-winner-race-header">
                  <strong>{activeDisciplineLabel} · Score-Race</strong>
                  <span>{phaseLabel}</span>
                </div>
                <div className="matchday-arena-lane-list">
                  {activeScoreboardSorted.map((row, index) => {
                    const laneScore = getArenaLaneScore(row);
                    const delta = getArenaLaneDelta(row);
                    const tone = getToneForTeam(row.teamId, params.teamId, teamOptions, props.teamControlSettingsMap);
                    const teamModel = props.teams.find((team) => team.teamId === row.teamId) ?? null;
                    const rankShift = currentPhase == null ? null : row.baseRank - (index + 1);
                    const breakdownItems = getArenaLaneBreakdownItems(row);

                    return (
                      <MatchdayArenaLane
                        key={`arena-winner-lane-${disciplineSide}-${row.teamId}`}
                        rank={index + 1}
                        teamName={row.teamName}
                        teamLogoUrl={teamModel ? getTeamLogoBrowserUrl(teamModel.teamId, teamModel.logoPath ?? null) : null}
                        scoreLabel={formatDecimalScore(laneScore, 1)}
                        deltaLabel={formatSignedDelta(delta)}
                        rankShiftLabel={
                          rankShift == null
                            ? null
                            : `Rank ${rankShift > 0 ? `+${rankShift}` : rankShift < 0 ? `${rankShift}` : "0"}`
                        }
                        pointsLabel={null}
                        widthPct={
                          currentPhase == null
                            ? 0
                            : maxScore > 0 && laneScore != null
                              ? Math.max(10, (laneScore / maxScore) * 100)
                              : 0
                        }
                        tone={tone}
                        isLeader={index === 0}
                        hasPenalty={Boolean((row.fatigueModifier ?? 0) < 0)}
                        breakdownItems={breakdownItems}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <aside className="matchday-arena-winner-side">
            <strong>{winnerBoardSelectedTeamDetail ? `${winnerBoardSelectedTeamDetail.teamName} · ${d2Label}` : d2Label}</strong>
            <span className="muted">
              {winnerBoardSelectedTeamDetail
                ? isSlotRevealPhase
                  ? `D2-Slots bis S${slotRevealIndex + 1} von ${winnerBoardSelectedTeamDetail.teamName}`
                  : `D2-Spieler von ${winnerBoardSelectedTeamDetail.teamName}`
                : isSlotRevealPhase
                  ? `D2 Top 10 bis Slot ${slotRevealIndex + 1}`
                  : "D2 Top 10 nach finalen Spieltags-PPs"}
            </span>
            <div className="matchday-arena-player-stack">
              {winnerBoardSelectedTeamDetail ? (
                winnerBoardSelectedVisiblePlayers.d2.length ? (
                  winnerBoardSelectedVisiblePlayers.d2.map((player, index) =>
                    renderWinnerSelectedPlayerCard(player, index, "d2"),
                  )
                ) : (
                  <div className="matchday-arena-empty-card">
                    <strong>{`Keine ${d2Label}-Spieler gefunden`}</strong>
                    <span className="muted">Für dieses Team liegen in D2 gerade keine Arena-Spieler vor.</span>
                    {props.onBackToLineup ? (
                      <button className="secondary-button inline-button" type="button" onClick={props.onBackToLineup}>
                        Zur Einsatzliste
                      </button>
                    ) : null}
                  </div>
                )
              ) : (
                winnerBoardVisibleTopPlayers.d2.length ? (
                  winnerBoardVisibleTopPlayers.d2.map((player, index) =>
                    renderWinnerTopPlayerCard(player, index, "d2"),
                  )
                ) : (
                  <div className="matchday-arena-empty-card">
                    <strong>Keine D2-Topspieler</strong>
                    <span className="muted">Erst Einsatzlisten speichern, dann erscheinen hier die Topspieler.</span>
                    {props.onBackToLineup ? (
                      <button className="secondary-button inline-button" type="button" onClick={props.onBackToLineup}>
                        Zur Einsatzliste
                      </button>
                    ) : null}
                  </div>
                )
              )}
            </div>
          </aside>
        </div>
      </section>

      <div className="matchday-arena-slot-analysis">
        <aside className="panel matchday-arena-sidebar">
          <div className="panel-header matchday-arena-side-header">
            <div className="stack">
              <TooltipHeading
                as="h3"
                tooltip="Slotrollen aus dem Matchday Room. Aggregierter Slot-Rollup ist im aktuellen Scorefeed noch nicht separat vorhanden."
              >
                Slot Spotlight
              </TooltipHeading>
            </div>
          </div>
          {focusedSlotSpotlight ? (
            <div className="matchday-arena-spotlight">
              <article className="matchday-arena-spotlight-hero">
                <strong>{focusedSlotSpotlight.role.label}</strong>
                <small className="muted">
                  Aktiver Slot {Math.min(focusedSlotSpotlight.slotIndex + 1, activeSlotRoles.length)}/{activeSlotRoles.length || "—"}
                </small>
                <span>{focusedSlotSpotlight.role.description}</span>
                <div className="matchday-arena-spotlight-weights">
                  <span>Major {focusedSlotSpotlight.role.majorPositiveAttribute}</span>
                  <span>Minor {focusedSlotSpotlight.role.minorPositiveAttribute}</span>
                  <span>Strain {focusedSlotSpotlight.role.strainAttribute}</span>
                </div>
              </article>
              {focusedSlotSpotlight.selectedEntry ? (
                <div className="matchday-arena-spotlight-block">
                  <strong>Aktives Team · Reveal bis Slot {Math.max(revealedSlotLimit + 1, 0)}</strong>
                  <div className="matchday-arena-player-stack">
                    {focusTeamEntries.length ? (
                      focusTeamEntries.map((entry) => (
                        <MatchdayArenaPlayerCard
                          key={`arena-focus-team-entry-${entry.playerId}-${entry.slotIndex}`}
                          portraitUrl={entry.portraitUrl}
                          playerName={entry.playerName}
                          teamName={entry.teamName}
                          className={entry.className}
                          scoreLabel={`Score ${formatDecimalScore(entry.finalPlayerScore, 1)}`}
                          pointsLabel={formatArenaFinalPlayerPps(entry)}
                          axisStats={entry.axisStats}
                          contributionLabel={`${entry.slotLabel} · Slots ${formatDecimalScore(entry.baseScore, 1)}`}
                          variant="compact"
                          onOpen={
                            props.onOpenPlayerDetails
                              ? () =>
                                  props.onOpenPlayerDetails?.({
                                    playerId: entry.playerId,
                                    activePlayerId: entry.activePlayerId,
                                  })
                              : null
                          }
                        />
                      ))
                    ) : (
                      <div className="matchday-arena-empty-card">
                        <strong>Noch keine Reveal-Slots</strong>
                        <span className="muted">Sobald die Slot-Phase startet, baut sich dein aktives Team hier Schritt für Schritt auf.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="matchday-arena-spotlight-block">
                <strong>Top 5 im Slot</strong>
                <div className="matchday-arena-player-stack">
                  {focusedSlotSpotlight.topPlayers.length ? (
                    focusedSlotSpotlight.topPlayers.map((player) => (
                      <MatchdayArenaPlayerCard
                        key={`arena-slot-top-${player.playerId}-${player.rankInDiscipline}`}
                        rank={player.rankInDiscipline}
                        portraitUrl={player.portraitUrl}
                        playerName={player.playerName}
                        teamName={player.teamName}
                        className={player.className}
                        scoreLabel={`Score ${formatDecimalScore(player.finalPlayerScore, 1)}`}
                        pointsLabel={formatArenaFinalPlayerPps(player)}
                        axisStats={player.axisStats}
                        onOpen={
                          props.onOpenPlayerDetails
                            ? () =>
                                props.onOpenPlayerDetails?.({
                                  playerId: player.playerId,
                                  activePlayerId: player.activePlayerId,
                                })
                            : null
                        }
                      />
                    ))
                  ) : (
                    <div className="matchday-arena-empty-card">
                      <strong>Keine Slot-Highlights</strong>
                      <span className="muted">Für diesen Slot liegen aktuell keine aufgelösten Spielerbeiträge vor.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="matchday-arena-empty-card">
              <strong>Keine Slotdaten</strong>
              <span className="muted">Sobald ein Matchday-Kontext geladen ist, erscheinen hier die Slot-Spotlights.</span>
            </div>
          )}
        </aside>
      </div>

      {currentPhase === "result" ? (
        <section className="panel matchday-arena-result-panel">
          <div className="panel-header matchday-arena-side-header">
            <div className="stack">
              <TooltipHeading
                as="h3"
                tooltip="Finale Darstellung nach dem Reveal. Hier wird nichts mehr verändert, nur der entschiedene Spieltag gezeigt."
              >
                Ergebnisboard
              </TooltipHeading>
              <small className="muted">Der Spieltag wird als Story gelesen: Ergebnis, Swing-Disziplin, Top-Performer und Mechanik-Impact.</small>
            </div>
          </div>
          {matchdayStoryline ? (
            <div className="matchday-arena-story-board" aria-label="Warum das Ergebnis entstanden ist">
              <article className="matchday-arena-story-card is-winner">
                <span className="eyebrow">Sieger</span>
                <strong>{matchdayStoryline.winner.teamName}</strong>
                <small>
                  {matchdayStoryline.runnerUp
                    ? `${formatSignedDelta(matchdayStoryline.totalGap)} Punkte vor ${matchdayStoryline.runnerUp.teamName}`
                    : "klarer Spieltagssieger"}
                </small>
              </article>
              <article className="matchday-arena-story-card">
                <span className="eyebrow">Swing-Disziplin</span>
                <strong>{matchdayStoryline.decidingSide?.label ?? activeDisciplineLabel}</strong>
                <small>
                  {matchdayStoryline.decidingSide
                    ? `${formatSignedDelta(matchdayStoryline.decidingSide.gap)} gegen Platz 2`
                    : "D1/D2-Daten noch unvollständig"}
                </small>
              </article>
              <article className="matchday-arena-story-card">
                <span className="eyebrow">Mechanik</span>
                <strong>{matchdayStoryline.strongestSignal.label} {formatSignedDelta(matchdayStoryline.strongestSignal.value)}</strong>
                <small>
                  {matchdayStoryline.boostLabels.length
                    ? matchdayStoryline.boostLabels.join(" / ")
                    : matchdayStoryline.strongestSignal.detail}
                </small>
              </article>
              <article className="matchday-arena-story-card">
                <span className="eyebrow">Top-Performer</span>
                <strong>{matchdayStoryline.topPerformers[0]?.playerName ?? "—"}</strong>
                <small>
                  {matchdayStoryline.topPerformers.length
                    ? matchdayStoryline.topPerformers
                        .map((player) => `${player.playerName} ${formatArenaFinalPlayerPps(player)} · ${player.sideLabel}`)
                        .join(" / ")
                    : "Noch keine Spieler-Highlights"}
                </small>
              </article>
            </div>
          ) : null}
          <div className="matchday-arena-result-grid">
            <article className="matchday-arena-result-hero">
              <span className="matchday-arena-result-kicker">Entscheidung</span>
              <strong>
                {resultLeaders[0]
                  ? `${resultLeaders[0].teamName} gewinnt ${activeDisciplineLabel} mit ${formatDecimalScore(resultLeaders[0].score, 1)}.`
                  : "Noch kein Finalergebnis vorhanden."}
              </strong>
              <p className="muted matchday-arena-source-note">
                Form, Taktik und Erschoepfung sind eingerechnet.
              </p>
              {resultDecisionFactors.length > 0 ? (
                <div className="matchday-arena-decision-strip" aria-label="Was hat entschieden">
                  {resultDecisionFactors.map((factor) => (
                    <span key={`arena-decision-${factor.key}`}>
                      <strong>{factor.label}</strong>
                      <b>{factor.value}</b>
                      <small>{factor.detail}</small>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="matchday-arena-next-steps" aria-label="Naechste Schritte nach der Arena">
                {arenaNextStepCards.map((card) => (
                  <button
                    key={`arena-next-${card.key}`}
                    className={`matchday-arena-next-card is-${card.tone}`}
                    type="button"
                    onClick={card.onClick ?? undefined}
                    disabled={!card.onClick}
                  >
                    <span>{card.label}</span>
                    <strong>{card.actionLabel}</strong>
                    <small>{card.detail}</small>
                  </button>
                ))}
              </div>
              <div className="matchday-arena-result-actions">
                {props.onBackToLineup ? (
                  <button className="secondary-button inline-button" type="button" onClick={props.onBackToLineup}>
                    Zurueck zur Einsatzliste
                  </button>
                ) : null}
                <button
                  className="secondary-button inline-button"
                  type="button"
                  onClick={() => {
                    setDisciplineSide((current) => (current === "d1" ? "d2" : "d1"));
                    setPhaseIndex(-1);
                    setSlotRevealIndex(0);
                    setIsPlaying(false);
                  }}
                >
                  Nächste Disziplin
                </button>
                {props.onOpenSeason ? (
                  <button className="secondary-button inline-button" type="button" onClick={props.onOpenSeason}>
                    Saisonstand
                  </button>
                ) : null}
                {props.onOpenMatchdayResult ? (
                  <button
                    className="primary-button inline-button"
                    type="button"
                    onClick={() => props.onOpenMatchdayResult?.({ matchdayId: params.matchdayId })}
                  >
                    Spieltagsergebnis anzeigen
                  </button>
                ) : null}
              </div>
            </article>
            <div className="matchday-arena-result-cards">
              {resultLeaders.map((entry) => (
                <article
                  key={`arena-result-team-${entry.teamId}`}
                  className={`matchday-arena-result-card${entry.rank === 1 ? " is-winner" : ""}`}
                >
                  <span className="matchday-arena-player-rank">#{entry.rank}</span>
                  <strong>{entry.teamName}</strong>
                  <span>Score {formatDecimalScore(entry.score, 1)}</span>
                  <span>{entry.points != null ? `${formatDecimalScore(entry.points, 1)} Punkte` : "Punkte —"}</span>
                  <span>Slots {formatDecimalScore(entry.baseScore, 1)} · Δ {entry.rankDelta > 0 ? `+${entry.rankDelta}` : entry.rankDelta}</span>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

    </section>
  );
}
