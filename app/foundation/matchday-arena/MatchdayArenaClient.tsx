"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type ArenaPhaseControlSpeed = 1 | 2 | 4;

type ArenaTopPlayerCard = MatchdayMvpTopPlayerRow & {
  portraitUrl: string | null;
  className: string | null;
  activePlayerId: string | null;
  badges: string[];
};

type ArenaFocusTeamEntryCard = {
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
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [context, setContext] = useState<LegacyLineupLoadedContext | null>(null);
  const [teamOptions, setTeamOptions] = useState<ArenaLabOptions["teams"]>([]);
  const [scoreFeed, setScoreFeed] = useState<MatchdayMvpScoringResult | null>(null);
  const [resolveFeed, setResolveFeed] = useState<ArenaResolveResponse | null>(null);
  const [disciplineSide, setDisciplineSide] = useState<"d1" | "d2">("d1");
  const [phaseIndex, setPhaseIndex] = useState(-1);
  const [slotRevealIndex, setSlotRevealIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<ArenaPhaseControlSpeed>(1);
  const requestSequenceRef = useRef(0);
  const externalParams = useMemo(() => defaultArenaParams(props), [
    props.defaultMatchdayId,
    props.defaultSaveId,
    props.defaultSeasonId,
    props.defaultTeamId,
    props.teams,
  ]);

  const currentPhase =
    phaseIndex < 0
      ? null
      : (MATCHDAY_ARENA_PHASES[Math.min(phaseIndex, MATCHDAY_ARENA_PHASES.length - 1)]?.id ?? null);

  async function loadArena(nextParams = params, nextSource = source) {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
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
    }

    try {
      const contextQuery = new URLSearchParams({
        saveId: resolvedParams.saveId,
        seasonId: resolvedParams.seasonId,
        matchdayId: resolvedParams.matchdayId,
        teamId: resolvedParams.teamId,
        source: nextSource,
      });

      const [contextResponse, scoreResponse, resolveResponse] = await Promise.all([
        fetch(`/api/lineups/legacy/lab-context?${contextQuery.toString()}`, { cache: "no-store" }),
        fetch("/api/season/matchday-mvp-score", {
          method: "POST",
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
        }),
        fetch(`/api/resolve/legacy-matchday-preview?${contextQuery.toString()}`, { cache: "no-store" }),
      ]);

      const contextPayload = (await contextResponse.json()) as ArenaContextResponse;
      const scorePayload = (await scoreResponse.json()) as {
        summary?: MatchdayMvpScoringResult;
        error?: string;
      };
      const resolvePayload = (await resolveResponse.json()) as ArenaResolveResponse;

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      if (!contextResponse.ok || contextPayload.error) {
        setErrors([contextPayload.error ?? "Der Matchday-Room-Kontext konnte nicht geladen werden."]);
        return;
      }
      if (!scoreResponse.ok || !scorePayload.summary) {
        setErrors([scorePayload.error ?? "Die 32er-Wertung konnte nicht geladen werden."]);
        return;
      }
      if (!resolveResponse.ok || resolvePayload.error) {
        setErrors([resolvePayload.error ?? "Die Resolve-Vorschau konnte nicht geladen werden."]);
        return;
      }

      setSource(contextPayload.source);
      setParams(contextPayload.params);
      setContext(contextPayload.context);
      setTeamOptions(contextPayload.options.teams);
      setScoreFeed(scorePayload.summary);
      setResolveFeed(resolvePayload);
      setWarnings(
        Array.from(
          new Set([
            ...contextPayload.contextWarnings,
            ...contextPayload.contextErrors,
            ...scorePayload.summary.warnings,
            ...scorePayload.summary.blockingReasons,
            ...resolvePayload.warnings,
          ]),
        ),
      );
      setPhaseIndex(-1);
      setSlotRevealIndex(0);
      setIsPlaying(false);
    } finally {
      if (requestSequenceRef.current === requestId) {
        setIsBusy(false);
      }
    }
  }

  useEffect(() => {
    void loadArena(externalParams, props.initialSource ?? "sqlite");
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

  const activeScoreboard = useMemo<MatchdayArenaScoreboardRowView[]>(() => {
    const rows =
      disciplineSide === "d1" ? scoreFeed?.d1Scoreboard ?? [] : scoreFeed?.d2Scoreboard ?? [];
    return buildMatchdayArenaScoreboardView(rows);
  }, [disciplineSide, scoreFeed?.d1Scoreboard, scoreFeed?.d2Scoreboard]);

  const slotScoreByTeamId = useMemo(() => {
    const scoreByTeamId = new Map<string, number>();
    const deltaByTeamId = new Map<string, number>();

    (resolveFeed?.teamDetails ?? []).forEach((team) => {
      const disciplineEntries = team.entries
        .filter((entry) => entry.disciplineSide === disciplineSide)
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
  }, [disciplineSide, resolveFeed?.teamDetails, slotRevealIndex]);

  function getArenaLaneScore(row: MatchdayArenaScoreboardRowView) {
    if (currentPhase == null) {
      return 0;
    }
    if (currentPhase !== "slots") {
      return getMatchdayArenaPhaseScore(row, currentPhase);
    }
    return slotScoreByTeamId.scoreByTeamId.get(row.teamId) ?? 0;
  }

  function getArenaLaneDelta(row: MatchdayArenaScoreboardRowView) {
    if (currentPhase == null) {
      return null;
    }
    if (currentPhase !== "slots") {
      return getMatchdayArenaPhaseDelta(row, currentPhase);
    }
    return slotScoreByTeamId.deltaByTeamId.get(row.teamId) ?? null;
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

  const activeTopPlayers = useMemo<ArenaTopPlayerCard[]>(() => {
    const topPlayers =
      disciplineSide === "d1" ? scoreFeed?.d1TopPlayers ?? [] : scoreFeed?.d2TopPlayers ?? [];

    return topPlayers.slice(0, 10).map((player) => {
      const catalogPlayer = resolvePlayerCatalogById.get(player.playerId);
      const row = activeScoreboard.find((entry) => entry.teamId === player.teamId) ?? null;
      const badges = [
        (player.mutatorPpsBonus ?? 0) > 0 || (player.mutatorScoreBonus ?? 0) > 0 ? "Mutator" : null,
        row?.formCardStatus === "ready" && (row.formCardModifier ?? 0) !== 0 ? "Form" : null,
        row?.captainStatus === "mapped" && (row.captainModifier ?? 0) !== 0 ? "Captain" : null,
        player.rankInDiscipline <= 3 ? "Highlight" : null,
      ].filter((badge): badge is string => Boolean(badge));

      return {
        ...player,
        portraitUrl: resolveArenaPortrait(player.playerId, catalogPlayer?.portraitUrl ?? null),
        className: resolveArenaClassName(player.playerId, catalogPlayer?.className ?? null),
        activePlayerId: catalogPlayer?.activePlayerId ?? null,
        badges,
      };
    });
  }, [activeScoreboard, disciplineSide, foundationPlayerById, resolvePlayerCatalogById, scoreFeed?.d1TopPlayers, scoreFeed?.d2TopPlayers]);

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
        };
      });
  }, [activeSlotRoles, activeTeamDetail, disciplineSide, resolvePlayerCatalogById, revealedSlotLimit, foundationPlayerById]);

  const liveTopPlayers = useMemo(() => {
    if (currentPhase == null) {
      return [] as ArenaTopPlayerCard[];
    }

    if (currentPhase === "slots") {
      return activeResolveTopPlayers
        .filter((player) => player.slotIndex <= revealedSlotLimit)
        .sort((left, right) => right.finalPlayerScore - left.finalPlayerScore)
        .slice(0, 8)
        .map((player) => {
          const catalogPlayer = resolvePlayerCatalogById.get(player.playerId);
          return {
            ...player,
            portraitUrl: resolveArenaPortrait(player.playerId, catalogPlayer?.portraitUrl ?? null),
            className: resolveArenaClassName(player.playerId, catalogPlayer?.className ?? null),
            activePlayerId: catalogPlayer?.activePlayerId ?? null,
            badges: [],
          };
        });
    }

    return activeTopPlayers.map((player) => ({
      ...player,
      badges: [],
    }));
  }, [activeResolveTopPlayers, activeTopPlayers, currentPhase, resolvePlayerCatalogById, revealedSlotLimit, foundationPlayerById]);

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

  const resultLeaders = [...activeScoreboard].sort((left, right) => left.rank - right.rank).slice(0, 3);
  const seasonLabel = getCanonicalSeasonLabel({ seasonId: params.seasonId });
  const phaseLabel =
    currentPhase == null
      ? "Start"
      : currentPhase === "slots" && activeSlotRoles.length
      ? `Slots ${Math.min(slotRevealIndex + 1, activeSlotRoles.length)}/${activeSlotRoles.length}`
      : (MATCHDAY_ARENA_PHASES[phaseIndex]?.label ?? "—");

  return (
    <section className="matchday-arena-shell">
      <div className="panel-header matchday-arena-panel-header">
        <div className="stack">
          <TooltipHeading
            as="h2"
            tooltip={`Read-only Reveal View fuer ${seasonLabel} · Spieltag ${context?.matchday.index ?? "—"}. Room bleibt Vorbereitung, Arena zeigt den Score-Race einer aktiven Disziplin.`}
          >
            Matchday Arena
          </TooltipHeading>
        </div>
        <div className="matchday-arena-header-actions">
          <button className="secondary-button inline-button" type="button" onClick={() => void loadArena(params, source)} disabled={isBusy}>
            Kontext laden
          </button>
          {props.onBackToLineup ? (
            <button className="secondary-button inline-button" type="button" onClick={props.onBackToLineup}>
              Zurück zum Room
            </button>
          ) : null}
        </div>
      </div>

      <section className="matchday-arena-hero panel">
        <div className="matchday-arena-hero-main">
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
              <span>Status</span>
              <strong>{scoreFeed?.status ?? "—"}</strong>
              <small>{scoreFeed?.resolveStatus ?? "Resolve —"}</small>
            </article>
            <article className="metric-card">
              <span>Phase</span>
              <strong>{phaseLabel}</strong>
              <small>{source === "sqlite" ? "SQLite / local" : "read-only"}</small>
            </article>
          </div>
          <MatchdayArenaTimeline activePhase={currentPhase} onSelectPhase={jumpToArenaPhase} />
        </div>
        <div className="matchday-arena-controls">
          <div className="matchday-arena-focus-select">
            <label htmlFor="matchday-arena-focus-team">Fokus-Team</label>
            <select
              id="matchday-arena-focus-team"
              value={params.teamId}
              onChange={(event) => {
                const nextTeamId = event.currentTarget.value;
                const nextParams = {
                  ...params,
                  teamId: nextTeamId,
                };
                setParams(nextParams);
                void loadArena(nextParams, source);
              }}
              disabled={isBusy || !teamOptions.length}
            >
              {teamOptions.map((team) => (
                <option key={`arena-focus-team-${team.id}`} value={team.id}>
                  {team.id} · {team.name}
                </option>
              ))}
            </select>
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
              Skip to Result
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
        <div className="panel">
          <ul className="warning-list compact-list">
            {errors.map((error) => (
              <li key={`arena-error-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="matchday-arena-layout">
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
                  <strong>Fokus-Team · Reveal bis Slot {Math.max(revealedSlotLimit + 1, 0)}</strong>
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
                          pointsLabel={entry.pointsAwarded != null ? `+${formatDecimalScore(entry.pointsAwarded, 1)} PPs` : "PPs —"}
                          contributionLabel={`${entry.slotLabel} · Base ${formatDecimalScore(entry.baseScore, 1)}`}
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
                        <span className="muted">Sobald die Slot-Phase startet, baut sich dein Fokus-Team hier Schritt für Schritt auf.</span>
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
                        pointsLabel={player.pointsAwarded != null ? `+${formatDecimalScore(player.pointsAwarded, 1)} PPs` : "PPs —"}
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

        <section className="panel matchday-arena-race-panel">
          <div className="panel-header matchday-arena-side-header">
            <div className="stack">
              <TooltipHeading
                as="h3"
                tooltip={`Reveal-Phase ${phaseLabel} · 32 Team-Lanes mit Rangbewegung und Phasen-Deltas.`}
              >
                {activeDisciplineLabel} · Score-Race
              </TooltipHeading>
            </div>
          </div>
          <div className="matchday-arena-lane-list">
            {activeScoreboardSorted.map((row, index) => {
              const laneScore = getArenaLaneScore(row);
              const delta = getArenaLaneDelta(row);
              const tone = getToneForTeam(row.teamId, params.teamId, teamOptions, props.teamControlSettingsMap);
              const teamModel = props.teams.find((team) => team.teamId === row.teamId) ?? null;
              const rankShift = currentPhase == null ? null : row.baseRank - (index + 1);
              const breakdownItems =
                currentPhase == null ? [] : getMatchdayArenaPhaseBreakdown(row, currentPhase);

              return (
                <MatchdayArenaLane
                  key={`arena-lane-${disciplineSide}-${row.teamId}`}
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
                  pointsLabel={currentPhase === "result" && row.points != null ? `${formatDecimalScore(row.points, 1)} P` : null}
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
        </section>

        <aside className="panel matchday-arena-sidebar">
          <div className="panel-header matchday-arena-side-header">
            <div className="stack">
              <TooltipHeading
                as="h3"
                tooltip="Beste Spieler der aktiven Disziplin. Nach Resolve bleiben Score und PPs direkt lesbar."
              >
                Live Top Players
              </TooltipHeading>
            </div>
          </div>
          <div className="matchday-arena-player-stack">
            {liveTopPlayers.length ? (
              liveTopPlayers.map((player) => (
                <MatchdayArenaPlayerCard
                  key={`arena-top-player-${disciplineSide}-${player.playerId}-${player.rankInDiscipline}`}
                  rank={player.rankInDiscipline}
                  portraitUrl={player.portraitUrl}
                  playerName={player.playerName}
                  teamName={player.teamName}
                  className={player.className}
                  scoreLabel={`Score ${formatDecimalScore(player.finalPlayerScore, 1)}`}
                  pointsLabel={player.pointsAwarded != null ? `+${formatDecimalScore(player.pointsAwarded, 1)} PPs` : "PPs —"}
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
              ))
            ) : (
              <div className="matchday-arena-empty-card">
                <strong>Keine Top-Spieler</strong>
                <span className="muted">Mit dem Reveal wachsen hier automatisch die aktuell besten Spieler der aktiven Disziplin nach.</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {currentPhase === "result" ? (
        <section className="panel matchday-arena-result-panel">
          <div className="panel-header matchday-arena-side-header">
            <div className="stack">
              <TooltipHeading
                as="h3"
                tooltip="Finaler read-only Ergebniszustand nach Reveal. Keine neuen Writes, nur Darstellung der vorhandenen Matchday-Daten."
              >
                Result Board
              </TooltipHeading>
            </div>
          </div>
          <div className="matchday-arena-result-grid">
            <article className="matchday-arena-result-hero">
              <strong>
                {resultLeaders[0]
                  ? `${resultLeaders[0].teamName} gewinnt ${activeDisciplineLabel} mit ${formatDecimalScore(resultLeaders[0].score, 1)}.`
                  : "Noch kein Finalergebnis vorhanden."}
              </strong>
              <p className="muted">
                Form {formatArenaSourceLabel(scoreFeed?.resolveSources.formCardSourceLabel ?? scoreFeed?.resolveSources.formCardSourceStatus)} ·{" "}
                Mutator {formatArenaSourceLabel(scoreFeed?.resolveSources.mutatorSourceLabel ?? scoreFeed?.resolveSources.mutatorSourceStatus)} ·{" "}
                Fatigue {formatArenaSourceLabel(scoreFeed?.resolveSources.fatigueSourceStatus)}
              </p>
              <div className="matchday-arena-result-actions">
                {props.onBackToLineup ? (
                  <button className="secondary-button inline-button" type="button" onClick={props.onBackToLineup}>
                    Zurück zum Room
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
                  <button className="primary-button inline-button" type="button" onClick={props.onOpenMatchdayResult}>
                    Spieltagsergebnis anzeigen
                  </button>
                ) : null}
              </div>
            </article>
            <div className="matchday-arena-result-cards">
              {resultLeaders.map((entry) => (
                <article key={`arena-result-team-${entry.teamId}`} className="matchday-arena-result-card">
                  <span className="matchday-arena-player-rank">#{entry.rank}</span>
                  <strong>{entry.teamName}</strong>
                  <span>Score {formatDecimalScore(entry.score, 1)}</span>
                  <span>{entry.points != null ? `${formatDecimalScore(entry.points, 1)} Punkte` : "Punkte —"}</span>
                  <span>Base {formatDecimalScore(entry.baseScore, 1)} · Δ {entry.rankDelta > 0 ? `+${entry.rankDelta}` : entry.rankDelta}</span>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {warnings.length ? (
        <section className="panel">
          <div className="panel-header matchday-arena-side-header">
            <div className="stack">
              <TooltipHeading
                as="h3"
                tooltip="Fehlende oder blockierte Quellen werden sichtbar, aber nicht gefaked."
              >
                Warnings
              </TooltipHeading>
            </div>
          </div>
          <ul className="warning-list compact-list">
            {warnings.slice(0, 8).map((warning) => (
              <li key={`arena-warning-${warning}`}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
