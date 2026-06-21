"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import MatchdayArenaPlayerCard from "@/components/matchday-arena/MatchdayArenaPlayerCard";
import MatchdayArenaTimeline from "@/components/matchday-arena/MatchdayArenaTimeline";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { Player, Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import {
  MATCHDAY_ARENA_PHASES,
  buildMatchdayArenaScoreboardView,
  getMatchdayArenaPhaseBreakdown,
  getMatchdayArenaPhaseDelta,
  getMatchdayArenaPhaseScore,
  type MatchdayArenaScoreboardRowView,
} from "@/lib/season/matchday-arena-presenter";
import type {
  MatchdayMvpScoringResult,
  MatchdayMvpTopPlayerRow,
} from "@/lib/season/matchday-mvp-scoring-service";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

type MatchdayArenaV2ClientProps = {
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
  onOpenMatchdayResult?: (() => void) | null;
  onOpenSeason?: (() => void) | null;
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
type ArenaBoardMode = "total" | "d1" | "d2";

type ArenaPlayerAxisStat = {
  axis: "POW" | "SPE" | "MEN" | "SOC";
  value: number | null;
};

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
  finalPlayerScore: number | null;
  pointsAwarded: number | null;
  mutatorPpsBonus?: number | null;
  isCaptain: boolean;
  warnings: string[];
  axisStats: ArenaPlayerAxisStat[];
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

function clampPct(value: number) {
  return Math.max(6, Math.min(100, value));
}

export default function MatchdayArenaV2Client(props: MatchdayArenaV2ClientProps) {
  const [params, setParams] = useState(() => defaultArenaParams(props));
  const [source, setSource] = useState<"sqlite" | "prisma">(props.initialSource ?? "sqlite");
  const [isBusy, setIsBusy] = useState(false);
  const [isDetailBusy, setIsDetailBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [context, setContext] = useState<LegacyLineupLoadedContext | null>(null);
  const [teamOptions, setTeamOptions] = useState<ArenaLabOptions["teams"]>([]);
  const [scoreFeed, setScoreFeed] = useState<MatchdayMvpScoringResult | null>(null);
  const [resolveFeed, setResolveFeed] = useState<ArenaResolveResponse | null>(null);
  const [standingsPreviewFeed, setStandingsPreviewFeed] = useState<ArenaStandingsPreviewResponse | null>(null);
  const [focusTeamId, setFocusTeamId] = useState<string | null>(props.defaultTeamId ?? null);
  const [boardMode, setBoardMode] = useState<ArenaBoardMode>("total");
  const [phaseIndex, setPhaseIndex] = useState(-1);
  const [slotRevealIndex, setSlotRevealIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<ArenaPhaseControlSpeed>(1);
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
  const displayPhase =
    currentPhase ?? MATCHDAY_ARENA_PHASES[MATCHDAY_ARENA_PHASES.length - 1]?.id ?? "result";

  async function loadArena(nextParams = params, nextSource = source) {
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
        setErrors(["Für Arena v2 fehlt Save-, Season-, Matchday- oder Team-Kontext."]);
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

      const contextResponse = await fetch(`/api/lineups/legacy/lab-context?${contextQuery.toString()}`, {
        cache: "no-store",
        signal: baseController.signal,
      });
      const contextPayload = await readArenaJsonPayload<ArenaContextResponse>(
        contextResponse,
        "Der Arena-v2-Kontext hat keine lesbare Antwort geliefert.",
      );

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      if (!contextResponse.ok || contextPayload.error) {
        setErrors([contextPayload.error ?? "Arena v2 konnte den Matchday-Kontext nicht laden."]);
        setContext(null);
        setScoreFeed(null);
        return;
      }

      const canonicalParams = contextPayload.params;
      const canonicalContextQuery = new URLSearchParams({
        saveId: canonicalParams.saveId,
        seasonId: canonicalParams.seasonId,
        matchdayId: canonicalParams.matchdayId,
        teamId: canonicalParams.teamId,
        source: contextPayload.source,
      });

      const scoreResponse = await fetch("/api/season/matchday-mvp-score", {
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
      const scorePayload = await readArenaJsonPayload<{
        summary?: MatchdayMvpScoringResult;
        error?: string;
      }>(scoreResponse, "Arena v2 konnte die 32er-Wertung nicht lesen.");

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      if (!scoreResponse.ok || !scorePayload.summary) {
        setErrors([scorePayload.error ?? "Arena v2 konnte die Spieltagswertung nicht laden."]);
        setParams(canonicalParams);
        setSource(contextPayload.source);
        setContext(contextPayload.context);
        setTeamOptions(contextPayload.options.teams);
        setScoreFeed(null);
        return;
      }

      setSource(contextPayload.source);
      setParams(contextPayload.params);
      setContext(contextPayload.context);
      setTeamOptions(contextPayload.options.teams);
      setScoreFeed(scorePayload.summary);
      setResolveFeed(null);
      setStandingsPreviewFeed(null);
      setFocusTeamId((current) =>
        current && contextPayload.options.teams.some((team) => team.id === current) ? current : canonicalParams.teamId,
      );
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
      setPhaseIndex(-1);
      setSlotRevealIndex(0);
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
          setWarnings((current) => Array.from(new Set([...current, ...detailWarnings])));
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
            ? `Arena v2 konnte nicht geladen werden: ${error.message}`
            : "Arena v2 konnte nicht geladen werden.",
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

  const d1Label = scoreFeed?.targetMatchday.d1DisciplineName ?? context?.matchdayContract?.discipline1?.displayName ?? "D1";
  const d2Label = scoreFeed?.targetMatchday.d2DisciplineName ?? context?.matchdayContract?.discipline2?.displayName ?? "D2";
  const d1Id = scoreFeed?.targetMatchday.d1DisciplineId ?? context?.matchdayContract?.discipline1?.disciplineId ?? null;
  const d2Id = scoreFeed?.targetMatchday.d2DisciplineId ?? context?.matchdayContract?.discipline2?.disciplineId ?? null;
  const d1Required = context?.matchdayContract?.discipline1?.requiredPlayers ?? 0;
  const d2Required = context?.matchdayContract?.discipline2?.requiredPlayers ?? 0;

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
  }, [props.teams, scoreboardByTeamId, standingsRankChangeByTeamId]);

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
    return matchdayWinnerRows.find((entry) => entry.teamId === focusTeamId) ?? null;
  }, [focusTeamId, matchdayWinnerRows]);

  const focusTeamName = focusWinnerRow?.teamName ?? focusTeamDetail?.teamName ?? "Top Player";
  const focusTeamLogoUrl = focusWinnerRow?.teamLogoUrl ?? null;

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
          finalPlayerScore: entry.finalPlayerScore,
          pointsAwarded: entry.pointsAwarded,
          mutatorPpsBonus: entry.mutatorPpsBonus,
          isCaptain: entry.isCaptain,
          warnings: entry.warnings,
          axisStats: buildArenaAxisStats(entry.playerId),
        } satisfies ArenaFocusTeamEntryCard;
      });
  };

  const focusTeamEntries = useMemo(
    () => ({
      d1: buildFocusEntries("d1"),
      d2: buildFocusEntries("d2"),
    }),
    [focusTeamDetail, d1Id, d1Label, d1Required, d2Id, d2Label, d2Required, resolvePlayerCatalogById, foundationPlayerById],
  );

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

  const activeDisciplineId = boardMode === "d2" ? d2Id : d1Id;
  const activeDisciplineLabel = boardMode === "d2" ? d2Label : d1Label;
  const activeSlotRoles = useMemo(
    () => resolveSlotRolesForDiscipline(activeDisciplineId, activeDisciplineLabel, boardMode === "d2" ? d2Required : d1Required),
    [activeDisciplineId, activeDisciplineLabel, boardMode, d1Required, d2Required],
  );
  const maxSlotRevealIndex = Math.max(activeSlotRoles.length - 1, 0);
  const isSlotsPhase = displayPhase === "slots";

  const slotScoreByTeamId = useMemo(() => {
    const scoreByTeamId = new Map<string, number>();
    const deltaByTeamId = new Map<string, number>();
    const targetSide = boardMode === "d2" ? "d2" : "d1";

    (resolveFeed?.teamDetails ?? []).forEach((team) => {
      const disciplineEntries = team.entries
        .filter((entry) => entry.disciplineSide === targetSide)
        .sort((left, right) => left.slotIndex - right.slotIndex);

      const cumulativeScore = disciplineEntries.reduce((sum, entry) => {
        if (entry.slotIndex > slotRevealIndex) {
          return sum;
        }
        return sum + (entry.baseScore ?? 0);
      }, 0);
      const currentSlotBase = disciplineEntries.find((entry) => entry.slotIndex === slotRevealIndex)?.baseScore ?? null;

      scoreByTeamId.set(team.teamId, Number(cumulativeScore.toFixed(1)));
      if (currentSlotBase != null) {
        deltaByTeamId.set(team.teamId, Number(currentSlotBase.toFixed(1)));
      }
    });

    return {
      scoreByTeamId,
      deltaByTeamId,
    };
  }, [boardMode, resolveFeed?.teamDetails, slotRevealIndex]);

  const boardRows = useMemo(() => {
    if (boardMode === "total") {
      return matchdayWinnerRows.map((row) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        teamLogoUrl: row.teamLogoUrl,
        rank: row.rank,
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
      }));
    }

    const sourceRows = boardMode === "d2" ? d2ScoreboardView : d1ScoreboardView;
    const sideKey = boardMode === "d2" ? "d2" : "d1";

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
        return left.rank - right.rank;
      })
      .map((row, index) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        teamLogoUrl: getTeamLogoBrowserUrl(row.teamId, props.teams.find((team) => team.teamId === row.teamId)?.logoPath ?? null),
        rank: index + 1,
        score:
          isSlotsPhase
            ? slotScoreByTeamId.scoreByTeamId.get(row.teamId) ?? 0
            : getMatchdayArenaPhaseScore(row, displayPhase) ?? row.score,
        points: row.points,
        baseRank: row.baseRank,
        rankDelta: row.rankDelta,
        projectedRank: standingsRankChangeByTeamId.get(row.teamId)?.projectedRank ?? null,
        tone: getToneForTeam(row.teamId, focusTeamId, teamOptions, props.teamControlSettingsMap),
        detailChips: [
          `Base ${formatDecimalScore(row.baseScore, 1)}`,
          `Fatigue ${formatSignedDelta(row.fatigueModifier)}`,
          row.formCardStatus === "ready" ? `Form ${formatSignedDelta(row.formCardModifier)}` : "Form —",
          row.captainStatus === "mapped" ? `Captain ${formatSignedDelta(row.captainModifier)}` : "Captain —",
        ],
        breakdown: getMatchdayArenaPhaseBreakdown(row, displayPhase),
        sideKey,
      }));
  }, [
    boardMode,
    matchdayWinnerRows,
    focusTeamId,
    teamOptions,
    props.teamControlSettingsMap,
    props.teams,
    d1ScoreboardView,
    d2ScoreboardView,
    displayPhase,
    isSlotsPhase,
    slotScoreByTeamId,
    standingsRankChangeByTeamId,
    d1Label,
    d2Label,
  ]);

  const maxBoardScore = useMemo(
    () => boardRows.reduce((max, row) => Math.max(max, row.score ?? 0), 0),
    [boardRows],
  );

  const leaderRow = boardRows[0] ?? null;
  const boardLeaderLabel = leaderRow?.teamName ?? "—";
  const boardLabel =
    boardMode === "total" ? "Gesamtwertung" : boardMode === "d1" ? `${d1Label} Reveal` : `${d2Label} Reveal`;

  function advanceArenaStep() {
    const slotsPhaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "slots");
    if (phaseIndex < 0) {
      setPhaseIndex(0);
      setSlotRevealIndex(0);
      return;
    }
    if (phaseIndex === slotsPhaseIndex && activeSlotRoles.length > 0 && slotRevealIndex < maxSlotRevealIndex) {
      setSlotRevealIndex((current) => Math.min(current + 1, maxSlotRevealIndex));
      return;
    }
    setPhaseIndex((current) => Math.min(current + 1, MATCHDAY_ARENA_PHASES.length - 1));
  }

  function getCurrentStepDuration() {
    const baseDuration = getPhaseDuration(speed);
    if (displayPhase === "slots") {
      return baseDuration + 350;
    }
    return baseDuration;
  }

  function startRevealPlayback() {
    setSlotRevealIndex(0);
    setPhaseIndex(0);
    setIsPlaying(true);
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
  }, [isPlaying, phaseIndex, speed, displayPhase, activeSlotRoles.length, slotRevealIndex, maxSlotRevealIndex]);

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
        if (isPlaying) {
          setIsPlaying(false);
        } else if (phaseIndex < 0 || phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1) {
          startRevealPlayback();
        } else {
          setIsPlaying(true);
        }
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        setIsPlaying(false);
        advanceArenaStep();
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  });

  const leftStackPlayers = focusTeamId ? focusTeamEntries.d1 : topPlayersBySide.d1;
  const rightStackPlayers = focusTeamId ? focusTeamEntries.d2 : topPlayersBySide.d2;

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
              pointsLabel={player.pointsAwarded != null ? `${formatDecimalScore(player.pointsAwarded, 1)} PPs` : "—"}
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

    return (
      <div className="arena-v2-slot-stack">
        {items.map((entry) => (
          <article
            key={`${disciplineLabel}-${entry.playerId}-${entry.slotIndex}`}
            className={`arena-v2-slot-card${entry.isCaptain ? " is-captain" : ""}`}
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
            <div className="arena-v2-slot-head">
              <span className="arena-v2-slot-kicker">{entry.slotLabel}</span>
              <strong>{entry.roleLabel}</strong>
              <small>{entry.roleHint}</small>
            </div>
            <div className="arena-v2-slot-player">
              {entry.portraitUrl ? (
                <OptimizedMediaImage
                  className="arena-v2-slot-portrait"
                  src={entry.portraitUrl}
                  alt={entry.playerName}
                  width={52}
                  height={52}
                />
              ) : (
                <span className="arena-v2-slot-portrait arena-v2-slot-portrait-fallback">—</span>
              )}
              <div className="arena-v2-slot-copy">
                <strong>{entry.playerName}</strong>
                <span>{entry.className ?? "—"}</span>
                <div className="arena-v2-slot-tags">
                  <span>Base {formatDecimalScore(entry.baseScore, 1)}</span>
                  <span>Final {formatDecimalScore(entry.finalPlayerScore, 1)}</span>
                  <span>PPs {formatDecimalScore(entry.pointsAwarded, 1)}</span>
                </div>
              </div>
            </div>
            {entry.axisStats.length ? (
              <div className="arena-v2-axis-strip">
                {entry.axisStats.map((stat) => (
                  <span key={`${entry.playerId}-${stat.axis}`} className={`arena-v2-axis-chip is-${stat.axis.toLowerCase()}`}>
                    <small>{stat.axis}</small>
                    <strong>{stat.value == null || !Number.isFinite(stat.value) ? "—" : Math.round(stat.value)}</strong>
                  </span>
                ))}
              </div>
            ) : null}
            {entry.warnings.length ? <p className="arena-v2-slot-warning">{entry.warnings[0]}</p> : null}
          </article>
        ))}
      </div>
    );
  };

  return (
    <div className="arena-v2-shell">
      <section className="panel arena-v2-hero">
        <div className="arena-v2-hero-main">
          <div className="arena-v2-kicker-row">
            <span className="pill foundation-source-pill">Arena v2</span>
            <span className="pill">{seasonLabel}</span>
            <span className="pill">{matchdayLabel}</span>
            <span className={`pill${isBusy || isDetailBusy ? "" : " is-success"}`}>
              {isBusy ? "lädt" : isDetailBusy ? "Details laden" : formatArenaStatusLabel(scoreFeed?.status)}
            </span>
          </div>
          <div className="arena-v2-title-row">
            <div>
              <TooltipHeading
                as="h2"
                tooltip="Arena v2 stellt den Spieltag als zentrales Matchboard dar: Teams in der Mitte, Fokus-Spieler links und rechts, dazu Reveal, PPs und Slot-Beiträge ohne Tabellenchaos."
              >
                {d1Label} / {d2Label}
              </TooltipHeading>
              <p className="arena-v2-subline">
                {focusModeLabel} · {boardLabel} · Phase {MATCHDAY_ARENA_PHASES.find((phase) => phase.id === displayPhase)?.label ?? "Result"}
              </p>
            </div>
            <div className="arena-v2-hero-actions">
              {props.onBackToLineup ? (
                <button className="secondary-button inline-button" type="button" onClick={props.onBackToLineup}>
                  Einsatzliste
                </button>
              ) : null}
              {props.onOpenMatchdayResult ? (
                <button className="secondary-button inline-button" type="button" onClick={props.onOpenMatchdayResult}>
                  Ergebnis
                </button>
              ) : null}
              {props.onOpenSeason ? (
                <button className="primary-button inline-button" type="button" onClick={props.onOpenSeason}>
                  Saisonstand
                </button>
              ) : null}
            </div>
          </div>
          <div className="arena-v2-hero-metrics">
            <article className="arena-v2-metric">
              <span>Leader</span>
              <strong>{boardLeaderLabel}</strong>
              <small>{leaderRow ? `${formatDecimalScore(leaderRow.points, 1)} PPs · ${formatDecimalScore(leaderRow.score, 1)} Score` : "—"}</small>
            </article>
            <article className="arena-v2-metric">
              <span>Fokus-Team</span>
              <strong>{focusTeamName}</strong>
              <small>{focusWinnerRow ? `Rang ${focusWinnerRow.rank} · Saison ${formatSeasonRankChange(focusWinnerRow.seasonRank, focusWinnerRow.seasonRankDelta)}` : "Top Player statt Team"}</small>
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
        <div className="arena-v2-control-dock">
          <label className="filter-field">
            <span>Fokus-Team</span>
            <select
              className="input"
              value={params.teamId}
              onChange={(event) => {
                const teamId = event.target.value;
                const nextParams = {
                  ...params,
                  teamId,
                };
                setParams(nextParams);
                setFocusTeamId(teamId);
                void loadArena(nextParams, source);
              }}
            >
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <div className="arena-v2-control-row">
            <button
              className={`secondary-button inline-button${boardMode === "total" ? " is-selected" : ""}`}
              type="button"
              onClick={() => setBoardMode("total")}
            >
              Gesamt
            </button>
            <button
              className={`secondary-button inline-button${boardMode === "d1" ? " is-selected" : ""}`}
              type="button"
              onClick={() => setBoardMode("d1")}
            >
              {d1Label}
            </button>
            <button
              className={`secondary-button inline-button${boardMode === "d2" ? " is-selected" : ""}`}
              type="button"
              onClick={() => setBoardMode("d2")}
            >
              {d2Label}
            </button>
          </div>
          <div className="arena-v2-control-row">
            <button className="primary-button inline-button" type="button" onClick={() => (isPlaying ? setIsPlaying(false) : startRevealPlayback())}>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button className="secondary-button inline-button" type="button" onClick={() => { setIsPlaying(false); advanceArenaStep(); }}>
              Step
            </button>
            <button className="secondary-button inline-button" type="button" onClick={() => { setIsPlaying(false); setPhaseIndex(MATCHDAY_ARENA_PHASES.length - 1); setSlotRevealIndex(maxSlotRevealIndex); }}>
              Ergebnis
            </button>
            <button className="secondary-button inline-button" type="button" onClick={() => { setIsPlaying(false); setPhaseIndex(0); setSlotRevealIndex(0); }}>
              Reset
            </button>
          </div>
          <div className="arena-v2-control-row">
            {[1, 2, 4].map((entry) => (
              <button
                key={`speed-${entry}`}
                className={`secondary-button inline-button${speed === entry ? " is-selected" : ""}`}
                type="button"
                onClick={() => setSpeed(entry as ArenaPhaseControlSpeed)}
              >
                x{entry}
              </button>
            ))}
          </div>
          <p className="arena-v2-control-hint">Leertaste startet oder pausiert den Reveal. Rechts-Pfeil steppt durch die nächste Stufe.</p>
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

      <section className="panel arena-v2-timeline-panel">
        <div className="arena-v2-timeline-head">
          <div>
            <strong>Reveal-Fortschritt</strong>
            <small>{MATCHDAY_ARENA_PHASES.find((phase) => phase.id === displayPhase)?.label ?? "Result"} · {boardLabel}</small>
          </div>
          <div className="arena-v2-phase-pills">
            <span className="pill">{d1Label} {d1Required}</span>
            <span className="pill">{d2Label} {d2Required}</span>
            <span className="pill">PPs {scoreFeed?.ppWinners.length ?? 0} sichtbar</span>
          </div>
        </div>
        <MatchdayArenaTimeline activePhase={displayPhase} onSelectPhase={jumpToArenaPhase} />
      </section>

      <section className="arena-v2-main-grid">
        <aside className="panel arena-v2-side-panel">
          <div className="arena-v2-side-head">
            <div>
              <span className="arena-v2-side-kicker">{focusTeamId ? focusTeamName : "Top Player"}</span>
              <strong>{d1Label}</strong>
            </div>
            <span className="pill">{focusTeamId ? `${focusTeamEntries.d1.length}/${d1Required}` : `${topPlayersBySide.d1.length} sichtbar`}</span>
          </div>
          {renderFocusEntries(focusTeamEntries.d1, d1Label, topPlayersBySide.d1)}
        </aside>

        <section className="panel arena-v2-board-panel">
          <div className="arena-v2-board-head">
            <div>
              <TooltipHeading
                as="h3"
                tooltip="Mitte bleibt das Hauptboard: alle 32 Teams, direkt klickbar. Ein Team-Klick zeigt links und rechts seine D1- und D2-Spieler; ohne Auswahl siehst du die Top Player."
              >
                32 Teams · {boardLabel}
              </TooltipHeading>
              <p className="arena-v2-board-subline">
                Klick auf ein Team öffnet dessen Spieltagsbild. Nochmal klicken entfernt den Fokus wieder.
              </p>
            </div>
            <div className="arena-v2-board-head-actions">
              {focusTeamId ? (
                <button className="secondary-button inline-button" type="button" onClick={() => setFocusTeamId(null)}>
                  Fokus lösen
                </button>
              ) : null}
              <span className="pill">{boardRows.length} Teams</span>
            </div>
          </div>
          <div className="arena-v2-board-list" role="list" aria-label="Arena v2 Teamboard">
            {boardRows.map((row) => {
              const widthPct = maxBoardScore > 0 ? clampPct((row.score / maxBoardScore) * 100) : 8;
              const isSelected = focusTeamId === row.teamId;
              const teamResult = matchdayWinnerRows.find((entry) => entry.teamId === row.teamId) ?? null;
              return (
                <button
                  key={`arena-v2-row-${row.teamId}`}
                  className={`arena-v2-board-row is-${row.tone}${isSelected ? " is-selected" : ""}`}
                  type="button"
                  onClick={() => setFocusTeamId((current) => (current === row.teamId ? null : row.teamId))}
                >
                  <div className="arena-v2-board-row-main">
                    <span className="arena-v2-board-rank">#{row.rank}</span>
                    {row.teamLogoUrl ? (
                      <OptimizedMediaImage
                        className="arena-v2-board-logo"
                        src={row.teamLogoUrl}
                        alt={`${row.teamName} Logo`}
                        width={42}
                        height={42}
                      />
                    ) : (
                      <span className="arena-v2-board-logo arena-v2-board-logo-fallback">—</span>
                    )}
                    <div className="arena-v2-board-copy">
                      <strong>{row.teamName}</strong>
                      <div className="arena-v2-board-chips">
                        {row.detailChips.slice(0, boardMode === "total" ? 2 : 4).map((chip) => (
                          <span key={`${row.teamId}-${chip}`} className="pill">
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="arena-v2-board-track">
                    <div className="arena-v2-board-track-fill" style={{ width: `${widthPct}%` }} />
                  </div>
                  <div className="arena-v2-board-stats">
                    <strong>{formatDecimalScore(row.score, 1)}</strong>
                    <span>{row.points != null ? `${formatDecimalScore(row.points, 1)} PPs` : "—"}</span>
                    <span>
                      {boardMode === "total"
                        ? `Saison ${formatSeasonRankChange(teamResult?.seasonRank ?? null, teamResult?.seasonRankDelta ?? null)}`
                        : `Base ${row.baseRank} · Δ ${row.rankDelta > 0 ? "+" : ""}${row.rankDelta}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="panel arena-v2-side-panel">
          <div className="arena-v2-side-head">
            <div>
              <span className="arena-v2-side-kicker">{focusTeamId ? focusTeamName : "Top Player"}</span>
              <strong>{d2Label}</strong>
            </div>
            <span className="pill">{focusTeamId ? `${focusTeamEntries.d2.length}/${d2Required}` : `${topPlayersBySide.d2.length} sichtbar`}</span>
          </div>
          {renderFocusEntries(focusTeamEntries.d2, d2Label, topPlayersBySide.d2)}
        </aside>
      </section>

      <section className="arena-v2-lower-grid">
        <section className="panel arena-v2-focus-panel">
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
                  {focusWinnerRow
                    ? `Tagesrang ${focusWinnerRow.rank} · ${formatDecimalScore(focusWinnerRow.totalPoints, 1)} PPs`
                    : "Ohne Teamfokus siehst du hier die Tagesgewinner und PP-Leader."}
                </small>
              </div>
            </div>
            {focusWinnerRow ? (
              <div className="arena-v2-focus-metrics">
                <span className="pill">Saison {formatSeasonRankChange(focusWinnerRow.seasonRank, focusWinnerRow.seasonRankDelta)}</span>
                <span className="pill">{d1Label} {formatDecimalScore(focusWinnerRow.d1Points, 1)} PPs</span>
                <span className="pill">{d2Label} {formatDecimalScore(focusWinnerRow.d2Points, 1)} PPs</span>
              </div>
            ) : null}
          </div>
          {focusTeamId ? (
            <div className="arena-v2-focus-insight-grid">
              <article className="arena-v2-focus-card">
                <span>{d1Label}</span>
                <strong>{formatDecimalScore(scoreboardByTeamId.d1.get(focusTeamId)?.score ?? null, 1)}</strong>
                <small>
                  PPs {formatDecimalScore(scoreboardByTeamId.d1.get(focusTeamId)?.points ?? null, 1)} · Base {formatDecimalScore(scoreboardByTeamId.d1.get(focusTeamId)?.baseScore ?? null, 1)}
                </small>
              </article>
              <article className="arena-v2-focus-card">
                <span>{d2Label}</span>
                <strong>{formatDecimalScore(scoreboardByTeamId.d2.get(focusTeamId)?.score ?? null, 1)}</strong>
                <small>
                  PPs {formatDecimalScore(scoreboardByTeamId.d2.get(focusTeamId)?.points ?? null, 1)} · Base {formatDecimalScore(scoreboardByTeamId.d2.get(focusTeamId)?.baseScore ?? null, 1)}
                </small>
              </article>
              <article className="arena-v2-focus-card">
                <span>Mutatoren</span>
                <strong>{(focusWinnerRow?.d1Mutators.length ?? 0) + (focusWinnerRow?.d2Mutators.length ?? 0)}</strong>
                <small>{[...(focusWinnerRow?.d1Mutators ?? []), ...(focusWinnerRow?.d2Mutators ?? [])].slice(0, 2).join(" · ") || "keine Extras sichtbar"}</small>
              </article>
              <article className="arena-v2-focus-card">
                <span>Reveal</span>
                <strong>{MATCHDAY_ARENA_PHASES.find((phase) => phase.id === displayPhase)?.label ?? "Result"}</strong>
                <small>{boardMode === "total" ? "Gesamtboard bleibt stabil" : "Board folgt der Reveal-Phase"}</small>
              </article>
            </div>
          ) : (
            <div className="arena-v2-player-stack arena-v2-winner-stack">
              {ppWinnerCards.map((player) => (
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
              ))}
            </div>
          )}
        </section>

        <section className="panel arena-v2-insight-panel">
          <div className="arena-v2-panel-title">
            <strong>Was Arena v2 gerade zeigt</strong>
            <small>Mehr Kontext, weniger Tabellenblindflug.</small>
          </div>
          <div className="arena-v2-insight-grid">
            <article className="arena-v2-insight-card">
              <span>Board</span>
              <strong>{boardLabel}</strong>
              <small>{boardMode === "total" ? "Gesamte Tageswertung aus beiden Diszis." : `Reveal folgt ${MATCHDAY_ARENA_PHASES.find((phase) => phase.id === displayPhase)?.label ?? "Result"}.`}</small>
            </article>
            <article className="arena-v2-insight-card">
              <span>Leader</span>
              <strong>{boardLeaderLabel}</strong>
              <small>{leaderRow ? `${formatDecimalScore(leaderRow.score, 1)} Score · ${formatDecimalScore(leaderRow.points, 1)} PPs` : "—"}</small>
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
          {boardMode !== "total" ? (
            <div className="arena-v2-breakdown-grid">
              {boardRows.slice(0, 3).map((row) => (
                <article key={`arena-v2-breakdown-${row.teamId}`} className="arena-v2-breakdown-card">
                  <strong>{row.teamName}</strong>
                  <div className="arena-v2-breakdown-list">
                    {(row.breakdown ?? []).map((item) => (
                      <span key={`${row.teamId}-${item.id}`} className={`arena-v2-breakdown-item is-${item.tone}`}>
                        <small>{item.label}</small>
                        <strong>{item.valueLabel}</strong>
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
