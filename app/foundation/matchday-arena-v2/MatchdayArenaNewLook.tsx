"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlCard,
  NlDeltaChip,
  NlMedalBadge,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
} from "@/components/foundation/new-look";
import type { MatchdayArenaV2ClientProps } from "@/app/foundation/matchday-arena-v2/MatchdayArenaV2Client";
import {
  MATCHDAY_ARENA_PHASES,
  buildArenaScoreTrackSegments,
  buildArenaTeamRankMap,
  buildMatchdayArenaScoreboardView,
  getArenaStepRankDelta,
  getMatchdayArenaPhaseBreakdown,
  getMatchdayArenaPhaseDelta,
  getMatchdayArenaPhaseScore,
  type MatchdayArenaPhaseId,
  type MatchdayArenaScoreboardRowView,
} from "@/lib/season/matchday-arena-presenter";
import type {
  MatchdayMvpScoringResult,
  MatchdayMvpTopPlayerRow,
} from "@/lib/season/matchday-mvp-scoring-service";
import {
  buildMatchdayArenaBaseSessionKey,
  getMatchdayArenaBaseBundle,
  setMatchdayArenaBaseBundle,
} from "@/lib/foundation/matchday-arena-session-cache";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import type { Team } from "@/lib/data/olyDataTypes";
import { getSeasonV2TeamTagStyle } from "@/app/foundation/season-v2/SeasonStandingsV2Client";

/**
 * "Neuer Look" Matchday-Arena — 32-Team-Scoreboard mit Phasen-Reveal
 * (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `MatchdayArenaV2Client` fällt ohne Flag unverändert auf das bestehende
 * Layout zurück. Gleiche Props, gleiche Datenquellen (Arena-Base-Bundle
 * bzw. MVP-Scoring-API), gleiche Presenter-Funktionen.
 *
 * Format-Grundsätze (bewusst):
 * - Ein Spieltag ist KEIN 1v1-Duell: 32 Teams werden parallel in zwei
 *   Disziplinen gewertet. Das Herzstück ist ein Board, das sich beim
 *   Durchschalten der Reveal-Phasen (Slots → … → Ergebnis) live umsortiert.
 * - Es gibt KEINE Uhr und KEINEN Countdown — der Resolve ist instantan,
 *   die Phasen sind reine Dramaturgie und werden manuell weitergeschaltet.
 * - Telemetrie (Auto-Lineups, Reveal-Sources, Readiness, Warnungs-Rohtexte)
 *   liegt gesammelt im ausklappbaren "Details & Diagnose"-Abschnitt statt
 *   im Hero.
 */

type ArenaNewLookBoardSide = "d1" | "d2" | "total";

type ArenaNewLookLoadState = "loading" | "ready" | "error";

/**
 * Minimale Sicht auf die Arena-Base-Antwort (`/api/matchday/arena-base`) —
 * dieselbe Payload, die der bestehende Client lädt und im Session-Cache ablegt.
 */
type ArenaNewLookBasePayload = {
  params?: { saveId: string; seasonId: string; matchdayId: string; teamId: string };
  source?: "sqlite" | "prisma";
  context?: unknown;
  contextWarnings?: string[];
  contextErrors?: string[];
  scoreSummary?: MatchdayMvpScoringResult | null;
  scoreWarnings?: string[];
  scoreBlockingReasons?: string[];
  error?: string;
};

type ArenaNewLookTotalRow = {
  teamId: string;
  teamName: string;
  rank: number;
  medal: "gold" | "silver" | "bronze" | null;
  d1Points: number | null;
  d2Points: number | null;
  totalPoints: number | null;
  d1Score: number | null;
  d2Score: number | null;
  totalScore: number;
};

const NL_ARENA_ROW_STRIDE = 52;

function formatSignedNlDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNlNumber(value, 1)}`;
}

function resolveArenaNewLookTeamId(teams: Team[], teamId: string | null | undefined) {
  if (teamId && teams.some((team) => team.teamId === teamId)) {
    return teamId;
  }
  return teams[0]?.teamId ?? "";
}

function buildBaseScoreMap(rows: MatchdayArenaScoreboardRowView[]) {
  return new Map(rows.map((row) => [row.teamId, row.baseScore] as const));
}

export default function MatchdayArenaNewLook(props: MatchdayArenaV2ClientProps) {
  const params = useMemo(
    () => ({
      saveId: props.defaultSaveId,
      seasonId: props.defaultSeasonId,
      matchdayId: props.defaultMatchdayId,
      teamId: resolveArenaNewLookTeamId(props.teams, props.defaultTeamId),
    }),
    [props.defaultSaveId, props.defaultSeasonId, props.defaultMatchdayId, props.defaultTeamId, props.teams],
  );
  const source = props.initialSource ?? "sqlite";

  const [loadState, setLoadState] = useState<ArenaNewLookLoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scoreFeed, setScoreFeed] = useState<MatchdayMvpScoringResult | null>(null);
  const [feedWarnings, setFeedWarnings] = useState<string[]>([]);
  const [boardSide, setBoardSide] = useState<ArenaNewLookBoardSide>("d1");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const rowNodesRef = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!params.saveId || !params.seasonId || !params.matchdayId || !params.teamId) {
      setLoadState("error");
      setLoadError("Für die Arena fehlt Save-, Season-, Matchday- oder Team-Kontext.");
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    function applyScoreSummary(summary: MatchdayMvpScoringResult, warnings: string[]) {
      if (cancelled) {
        return;
      }
      setScoreFeed(summary);
      setFeedWarnings(Array.from(new Set(warnings.filter(Boolean))));
      setLoadError(null);
      setLoadState("ready");
      setPhaseIndex(0);
      setBoardSide("d1");
      setExpandedTeamId(null);
      setIsAutoPlaying(false);
    }

    async function load() {
      setLoadState("loading");
      setLoadError(null);

      try {
        if (source === "sqlite") {
          const sessionKey = buildMatchdayArenaBaseSessionKey({ ...params, source });
          const cached = getMatchdayArenaBaseBundle<ArenaNewLookBasePayload>(sessionKey);
          if (cached?.scoreSummary) {
            applyScoreSummary(cached.scoreSummary, [
              ...(cached.contextWarnings ?? []),
              ...(cached.scoreWarnings ?? []),
              ...(cached.scoreBlockingReasons ?? []),
              ...cached.scoreSummary.warnings,
              ...cached.scoreSummary.blockingReasons,
            ]);
            return;
          }

          const query = new URLSearchParams({
            saveId: params.saveId,
            seasonId: params.seasonId,
            matchdayId: params.matchdayId,
            teamId: params.teamId,
            source,
            includeDetails: "0",
          });
          const response = await fetch(`/api/matchday/arena-base?${query.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const payload = (await response.json()) as ArenaNewLookBasePayload;
          if (cancelled) {
            return;
          }
          if (!response.ok || payload.error || !payload.scoreSummary) {
            setLoadState("error");
            setLoadError(payload.error ?? "Die Arena konnte die Spieltagswertung nicht laden.");
            return;
          }
          if (payload.context) {
            setMatchdayArenaBaseBundle(sessionKey, payload);
          }
          applyScoreSummary(payload.scoreSummary, [
            ...(payload.contextWarnings ?? []),
            ...(payload.contextErrors ?? []),
            ...(payload.scoreWarnings ?? []),
            ...(payload.scoreBlockingReasons ?? []),
            ...payload.scoreSummary.warnings,
            ...payload.scoreSummary.blockingReasons,
          ]);
          return;
        }

        const response = await fetch("/api/season/matchday-mvp-score", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            saveId: params.saveId,
            seasonId: params.seasonId,
            matchdayId: params.matchdayId,
            source,
            dryRun: true,
            execute: false,
          }),
        });
        const payload = (await response.json()) as { summary?: MatchdayMvpScoringResult; error?: string };
        if (cancelled) {
          return;
        }
        if (!response.ok || payload.error || !payload.summary) {
          setLoadState("error");
          setLoadError(payload.error ?? "Die Arena konnte die 32er-Wertung nicht laden.");
          return;
        }
        applyScoreSummary(payload.summary, [...payload.summary.warnings, ...payload.summary.blockingReasons]);
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setLoadState("error");
        setLoadError(error instanceof Error ? error.message : "Die Arena konnte die Wertung nicht laden.");
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [params, source]);

  const teamById = useMemo(() => new Map(props.teams.map((team) => [team.teamId, team] as const)), [props.teams]);

  const d1View = useMemo(
    () => buildMatchdayArenaScoreboardView(scoreFeed?.d1Scoreboard ?? []),
    [scoreFeed?.d1Scoreboard],
  );
  const d2View = useMemo(
    () => buildMatchdayArenaScoreboardView(scoreFeed?.d2Scoreboard ?? []),
    [scoreFeed?.d2Scoreboard],
  );

  const d1Label = scoreFeed?.targetMatchday.d1DisciplineName ?? "Disziplin 1";
  const d2Label = scoreFeed?.targetMatchday.d2DisciplineName ?? "Disziplin 2";

  const activePhase: MatchdayArenaPhaseId =
    MATCHDAY_ARENA_PHASES[Math.max(0, Math.min(phaseIndex, MATCHDAY_ARENA_PHASES.length - 1))]?.id ?? "slots";
  const previousPhase: MatchdayArenaPhaseId | null =
    phaseIndex > 0 ? (MATCHDAY_ARENA_PHASES[phaseIndex - 1]?.id ?? null) : null;
  const isResultPhase = activePhase === "result";
  const finalPhaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "final");
  const mvpsRevealed = phaseIndex >= finalPhaseIndex || boardSide === "total";

  const activeView = boardSide === "d2" ? d2View : d1View;

  // Reveal-Autoplay: Phasen automatisch durchschalten, solange aktiv und
  // solange die letzte Phase noch nicht erreicht ist. Kein Date.now() im
  // Render — reines setInterval im Effect, das beim Unmount/Wechsel
  // sauber wieder abgeräumt wird.
  useEffect(() => {
    if (!isAutoPlaying || boardSide === "total") {
      return;
    }
    if (phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1) {
      setIsAutoPlaying(false);
      return;
    }
    const interval = setInterval(() => {
      setPhaseIndex((index) => Math.min(MATCHDAY_ARENA_PHASES.length - 1, index + 1));
    }, 1600);
    return () => clearInterval(interval);
  }, [isAutoPlaying, boardSide, phaseIndex]);

  // Wechsel der Disziplin-Seite schließt eine offene Score-Herkunft und
  // stoppt eine laufende Autoplay-Show (die Phasen gelten pro Board-Seite).
  useEffect(() => {
    setExpandedTeamId(null);
    setIsAutoPlaying(false);
  }, [boardSide]);

  function scrollToOwnTeam() {
    const node = rowNodesRef.current.get(params.teamId);
    if (!node) {
      return;
    }
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  // Rang-Karten je Phase über den Presenter (Slots-Phase = Base-Scores).
  const rankMaps = useMemo(() => {
    const slotScores = () => buildBaseScoreMap(activeView);
    const current = buildArenaTeamRankMap(activeView, { phaseId: activePhase, revealedSlotCount: 0 }, slotScores);
    const previous = previousPhase
      ? buildArenaTeamRankMap(activeView, { phaseId: previousPhase, revealedSlotCount: 0 }, slotScores)
      : null;
    return { current, previous };
  }, [activeView, activePhase, previousPhase]);

  const boardRows = useMemo(
    () =>
      [...activeView].sort(
        (left, right) =>
          (rankMaps.current.get(left.teamId) ?? Number.POSITIVE_INFINITY) -
          (rankMaps.current.get(right.teamId) ?? Number.POSITIVE_INFINITY),
      ),
    [activeView, rankMaps],
  );

  const maxPhaseScore = useMemo(
    () =>
      boardRows.reduce((max, row) => {
        const score = getMatchdayArenaPhaseScore(row, activePhase) ?? 0;
        return score > max ? score : max;
      }, 0),
    [boardRows, activePhase],
  );

  // Gesamt-Tageswertung aus beiden Disziplin-Boards (echte Scores/Punkte).
  const totalRows = useMemo<ArenaNewLookTotalRow[]>(() => {
    const d1ByTeam = new Map(d1View.map((row) => [row.teamId, row] as const));
    const d2ByTeam = new Map(d2View.map((row) => [row.teamId, row] as const));
    const teamIds = new Set([...d1ByTeam.keys(), ...d2ByTeam.keys()]);

    return [...teamIds]
      .map((teamId) => {
        const d1 = d1ByTeam.get(teamId) ?? null;
        const d2 = d2ByTeam.get(teamId) ?? null;
        const d1Points = d1?.points ?? null;
        const d2Points = d2?.points ?? null;
        return {
          teamId,
          teamName: d1?.teamName ?? d2?.teamName ?? teamById.get(teamId)?.name ?? teamId,
          rank: 0,
          medal: null as ArenaNewLookTotalRow["medal"],
          d1Points,
          d2Points,
          totalPoints:
            d1Points == null && d2Points == null ? null : Number(((d1Points ?? 0) + (d2Points ?? 0)).toFixed(1)),
          d1Score: d1?.score ?? null,
          d2Score: d2?.score ?? null,
          totalScore: Number(((d1?.score ?? 0) + (d2?.score ?? 0)).toFixed(1)),
        };
      })
      .sort((left, right) => {
        const pointsDelta =
          (right.totalPoints ?? Number.NEGATIVE_INFINITY) - (left.totalPoints ?? Number.NEGATIVE_INFINITY);
        if (pointsDelta !== 0) {
          return pointsDelta;
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
  }, [d1View, d2View, teamById]);

  const maxTotalScore = useMemo(
    () => totalRows.reduce((max, row) => (row.totalScore > max ? row.totalScore : max), 0),
    [totalRows],
  );

  const autoLineups = scoreFeed?.lineupSummary.autoGeneratedLineups ?? 0;
  const blockedTeams = scoreFeed?.lineupSummary.blockedTeams ?? 0;

  const ownTeamName = teamById.get(params.teamId)?.name ?? null;
  const ownTeamRank =
    boardSide === "total"
      ? (totalRows.find((row) => row.teamId === params.teamId)?.rank ?? null)
      : (rankMaps.current.get(params.teamId) ?? null);

  function renderTeamButton(teamId: string, teamName: string) {
    const team = teamById.get(teamId) ?? null;
    const logo = team ? getTeamLogoModel(team, { variant: "thumb" }) : null;
    return (
      <button
        type="button"
        className="nl-arena-team"
        onClick={() => props.onOpenTeam?.(teamId)}
        title={`${teamName} öffnen`}
      >
        <BudgetedMediaImage
          src={logo?.src ?? null}
          alt={`${teamName} Logo`}
          className="nl-arena-crest"
          width={26}
          height={26}
          loading="lazy"
          fallback={
            <span className="nl-arena-crest nl-arena-crest-fallback">
              {logo?.initials ?? teamName.slice(0, 2).toUpperCase()}
            </span>
          }
        />
        <span className="nl-arena-teamname">{teamName}</span>
      </button>
    );
  }

  function renderDisciplineBoard() {
    return (
      <div
        className="nl-arena-board"
        role="list"
        aria-label={`Scoreboard ${boardSide === "d2" ? d2Label : d1Label}`}
        style={{ height: boardRows.length * NL_ARENA_ROW_STRIDE }}
      >
        {boardRows.map((row) => {
          const rank = rankMaps.current.get(row.teamId) ?? 0;
          const previousRank = rankMaps.previous?.get(row.teamId) ?? null;
          const rankDelta = getArenaStepRankDelta(rank, previousRank);
          const phaseScore = getMatchdayArenaPhaseScore(row, activePhase) ?? 0;
          const phaseDelta = getMatchdayArenaPhaseDelta(row, activePhase);
          const segments = buildArenaScoreTrackSegments(row, activePhase);
          const widthPct = maxPhaseScore > 0 ? Math.max(4, Math.min(100, (phaseScore / maxPhaseScore) * 100)) : 0;
          const team = teamById.get(row.teamId) ?? null;
          const isOwnTeam = row.teamId === params.teamId;
          const isExpanded = expandedTeamId === row.teamId;
          const breakdown = isExpanded ? getMatchdayArenaPhaseBreakdown(row, activePhase) : [];

          return (
            <div
              key={row.teamId}
              ref={(node) => {
                if (node) {
                  rowNodesRef.current.set(row.teamId, node);
                } else {
                  rowNodesRef.current.delete(row.teamId);
                }
              }}
              role="listitem"
              className={`nl-arena-row${isOwnTeam ? " is-own-team" : ""}${rankDelta != null && rankDelta !== 0 ? (rankDelta > 0 ? " is-moving-up" : " is-moving-down") : ""}${isExpanded ? " is-expanded" : ""}`}
              style={{
                ...(team ? getSeasonV2TeamTagStyle(team.shortCode) : undefined),
                top: Math.max(0, rank - 1) * NL_ARENA_ROW_STRIDE,
              }}
            >
              <span className="nl-arena-rank">
                <span className="nl-arena-ranknum nl-tnum">{rank}</span>
                {rankDelta != null && rankDelta !== 0 ? (
                  <NlDeltaChip
                    value={rankDelta}
                    format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`}
                    title="Rangbewegung gegenüber der vorigen Phase"
                    className="nl-arena-rankdelta"
                  />
                ) : null}
              </span>
              {renderTeamButton(row.teamId, row.teamName)}
              <span className="nl-arena-track" aria-hidden="true">
                <span className="nl-arena-track-stack" style={{ width: `${widthPct}%` }}>
                  {segments.map((segment) => (
                    <span
                      key={`${row.teamId}-${segment.id}`}
                      className={`nl-arena-track-segment is-${segment.tone}`}
                      style={{ flexGrow: Math.max(Math.abs(segment.value), 0.01) }}
                      title={`${segment.label}: ${formatSignedNlDelta(segment.value)}`}
                    />
                  ))}
                </span>
              </span>
              <span className="nl-arena-rowstats">
                {phaseDelta != null && phaseDelta !== 0 ? (
                  <NlDeltaChip
                    value={phaseDelta}
                    format={formatSignedNlDelta}
                    title={`${MATCHDAY_ARENA_PHASES.find((phase) => phase.id === activePhase)?.label ?? ""}-Effekt auf den Score`}
                  />
                ) : null}
                <button
                  type="button"
                  className="nl-arena-score-toggle"
                  aria-expanded={isExpanded}
                  aria-label={`Score-Herkunft von ${row.teamName} ${isExpanded ? "einklappen" : "aufklappen"}`}
                  title="Score-Herkunft aufklappen"
                  onClick={() => setExpandedTeamId((current) => (current === row.teamId ? null : row.teamId))}
                >
                  <strong className="nl-arena-score nl-tnum">{formatNlNumber(phaseScore, 1)}</strong>
                </button>
                {isResultPhase && row.points != null ? (
                  <span className="nl-arena-points nl-tnum" title="Tagespunkte (PPs) in dieser Disziplin">
                    {formatNlNumber(row.points, 1)} PPs
                  </span>
                ) : null}
              </span>
              {isExpanded ? (
                <div className="nl-arena-row-breakdown" role="group" aria-label={`Score-Herkunft ${row.teamName}`}>
                  {breakdown.map((item) => (
                    <span key={item.id} className={`nl-arena-row-breakdown-item is-${item.tone}`}>
                      <span className="nl-arena-row-breakdown-label">{item.label}</span>
                      <span className="nl-arena-row-breakdown-value">{item.valueLabel}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  function renderTotalBoard() {
    return (
      <ol className="nl-arena-totalboard" aria-label="Gesamte Tageswertung">
        {totalRows.map((row) => {
          const team = teamById.get(row.teamId) ?? null;
          const isOwnTeam = row.teamId === params.teamId;
          const widthPct = maxTotalScore > 0 ? Math.max(4, Math.min(100, (row.totalScore / maxTotalScore) * 100)) : 0;
          return (
            <li
              key={row.teamId}
              ref={(node) => {
                if (node) {
                  rowNodesRef.current.set(row.teamId, node);
                } else {
                  rowNodesRef.current.delete(row.teamId);
                }
              }}
              className={`nl-arena-totalrow${isOwnTeam ? " is-own-team" : ""}`}
              style={team ? getSeasonV2TeamTagStyle(team.shortCode) : undefined}
            >
              <span className="nl-arena-rank">
                {row.medal ? (
                  <NlMedalBadge kind={row.medal} title={`Tagesrang ${row.rank}`} />
                ) : (
                  <span className="nl-arena-ranknum nl-tnum">{row.rank}</span>
                )}
              </span>
              {renderTeamButton(row.teamId, row.teamName)}
              <span className="nl-arena-track" aria-hidden="true">
                <span className="nl-arena-track-fill" style={{ width: `${widthPct}%` }} />
              </span>
              <span className="nl-arena-rowstats">
                <span className="nl-arena-sidepoints nl-tnum" title={`${d1Label} / ${d2Label} Tagespunkte`}>
                  {formatNlNumber(row.d1Points, 1)} · {formatNlNumber(row.d2Points, 1)}
                </span>
                <strong className="nl-arena-score nl-tnum" title="Gesamtscore beider Disziplinen">
                  {formatNlNumber(row.totalScore, 1)}
                </strong>
                <span className="nl-arena-points nl-tnum" title="Tagespunkte gesamt">
                  {row.totalPoints != null ? `${formatNlNumber(row.totalPoints, 1)} PPs` : "—"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  function renderMvpColumn(title: string, tone: "pow" | "men" | "soc", players: MatchdayMvpTopPlayerRow[]) {
    return (
      <div className={`nl-arena-mvp-column ${nlToneClass(tone)}`}>
        <span className="nl-arena-mvp-title">{title}</span>
        {players.length === 0 ? (
          <p className="nl-arena-mvp-empty">Noch keine Wertung.</p>
        ) : (
          <ol className="nl-arena-mvp-list">
            {players.map((player, index) => (
              <li key={`${player.playerId}-${player.slotIndex}`} className="nl-arena-mvp-row">
                <span className="nl-arena-mvp-rank">
                  {index < 3 ? (
                    <NlMedalBadge
                      kind={index === 0 ? "gold" : index === 1 ? "silver" : "bronze"}
                      title={`Platz ${index + 1}`}
                    />
                  ) : (
                    <span className="nl-tnum">{index + 1}</span>
                  )}
                </span>
                <span className="nl-arena-mvp-copy">
                  <button
                    type="button"
                    className="nl-arena-mvp-player"
                    onClick={() => props.onOpenPlayerDetails?.({ playerId: player.playerId })}
                    title={`${player.playerName} öffnen`}
                  >
                    {player.playerName}
                  </button>
                  <button
                    type="button"
                    className="nl-arena-mvp-team"
                    onClick={() => props.onOpenTeam?.(player.teamId)}
                    title={`${player.teamName} öffnen`}
                  >
                    {player.teamName}
                  </button>
                </span>
                <span className="nl-arena-mvp-stats nl-tnum">
                  <strong>{formatNlNumber(player.finalPlayerScore, 1)}</strong>
                  <small>{player.pointsAwarded != null ? `${formatNlNumber(player.pointsAwarded, 1)} PPs` : "—"}</small>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  const phaseItems = MATCHDAY_ARENA_PHASES.map((phase) => ({ id: phase.id, label: phase.label }));
  const sideItems = [
    { id: "d1", label: d1Label },
    { id: "d2", label: d2Label },
    { id: "total", label: "Gesamt" },
  ];

  return (
    <div className="nl-arena" data-testid="nl-matchday-arena" data-new-look="true">
      <NlCard
        className="nl-arena-header-card"
        eyebrow="Matchday-Arena · 32 Teams parallel · Sofort-Resolve in Phasen"
        title={scoreFeed?.targetMatchday.label ?? "Spieltag"}
        actions={
          <div className="nl-arena-actions">
            {props.onBackToLineup ? (
              <button className="nl-arena-button" type="button" onClick={props.onBackToLineup}>
                Einsatzliste
              </button>
            ) : null}
            {props.onOpenMatchdayResult ? (
              <button
                className="nl-arena-button"
                type="button"
                disabled={!isResultPhase}
                title={isResultPhase ? "Spieltagsergebnis öffnen" : "Wird nach der Ergebnis-Phase freigeschaltet"}
                onClick={props.onOpenMatchdayResult}
              >
                Ergebnis
              </button>
            ) : null}
            {props.onOpenSeason ? (
              <button
                className="nl-arena-button is-primary"
                type="button"
                disabled={!isResultPhase}
                title={isResultPhase ? "Saisonstand öffnen" : "Wird nach der Ergebnis-Phase freigeschaltet"}
                onClick={props.onOpenSeason}
              >
                Saisonstand
              </button>
            ) : null}
          </div>
        }
      >
        <StatChipRow className="nl-arena-header-chips" aria-label="Spieltag-Disziplinen">
          <StatChip label="D1" value={d1Label} tone="pow" />
          <StatChip label="D2" value={d2Label} tone="men" />
          <StatChip
            label="Teams"
            value={scoreFeed?.totalTeamsScored ?? props.teams.length}
            tone="accent"
            title="Alle Teams werden parallel gewertet — kein Duell, keine Uhr."
          />
        </StatChipRow>
      </NlCard>

      {loadState === "error" ? (
        <NlCard className="nl-arena-error-card" title="Arena braucht noch Input">
          <p className="nl-arena-error-text">{loadError}</p>
        </NlCard>
      ) : loadState === "loading" ? (
        <div className="nl-arena-skeleton" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={`nl-arena-skeleton-${index}`} className="nl-arena-skeleton-row" />
          ))}
        </div>
      ) : (
        <>
          <NlCard
            className="nl-arena-board-card"
            title={boardSide === "total" ? "Tageswertung — Gesamt" : `Scoreboard — ${boardSide === "d2" ? d2Label : d1Label}`}
            eyebrow={
              boardSide === "total"
                ? "Beide Disziplinen zusammengerechnet"
                : `Phase: ${MATCHDAY_ARENA_PHASES.find((phase) => phase.id === activePhase)?.label ?? "Slots"}`
            }
            actions={
              <NlSubTabs
                items={sideItems}
                activeId={boardSide}
                onSelect={(id) => setBoardSide(id as ArenaNewLookBoardSide)}
                aria-label="Disziplin wählen"
              />
            }
          >
            {boardSide !== "total" ? (
              <div className="nl-arena-phase-controls">
                <button
                  className="nl-arena-button"
                  type="button"
                  disabled={phaseIndex <= 0}
                  onClick={() => setPhaseIndex((index) => Math.max(0, index - 1))}
                >
                  Zurück
                </button>
                <NlSubTabs
                  items={phaseItems}
                  activeId={activePhase}
                  onSelect={(id) =>
                    setPhaseIndex(Math.max(0, MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === id)))
                  }
                  aria-label="Reveal-Phase"
                  className="nl-arena-phase-tabs"
                />
                <button
                  className="nl-arena-button is-primary"
                  type="button"
                  disabled={phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1}
                  onClick={() => setPhaseIndex((index) => Math.min(MATCHDAY_ARENA_PHASES.length - 1, index + 1))}
                >
                  Weiter
                </button>
                <button
                  className="nl-arena-button nl-arena-autoplay-toggle"
                  type="button"
                  aria-pressed={isAutoPlaying}
                  title={
                    isAutoPlaying
                      ? "Automatischen Reveal pausieren"
                      : "Reveal-Phasen automatisch durchschalten (Live-Sortier-Show)"
                  }
                  onClick={() => setIsAutoPlaying((value) => !value)}
                >
                  {isAutoPlaying ? "❚❚ Auto" : "▶ Auto"}
                </button>
              </div>
            ) : null}
            {ownTeamRank != null && ownTeamName ? (
              <div className="nl-arena-owncall">
                <button type="button" className="nl-arena-owncall-btn" onClick={scrollToOwnTeam}>
                  Zu meinem Team · {ownTeamName}
                  <span className="nl-arena-owncall-rank nl-tnum">#{ownTeamRank}</span>
                </button>
              </div>
            ) : null}
            {boardSide === "total" ? renderTotalBoard() : renderDisciplineBoard()}
          </NlCard>

          <NlCard
            className="nl-arena-mvp-card"
            title="Tages-MVPs"
            eyebrow={mvpsRevealed ? "Beste Einzelwertungen dieses Spieltags" : "Wird im Finale enthüllt"}
          >
            {mvpsRevealed ? (
              <div className="nl-arena-mvp-grid">
                {renderMvpColumn(d1Label, "pow", (scoreFeed?.d1TopPlayers ?? []).slice(0, 3))}
                {renderMvpColumn(d2Label, "men", (scoreFeed?.d2TopPlayers ?? []).slice(0, 3))}
                {renderMvpColumn("PP-Gewinner", "soc", (scoreFeed?.ppWinners ?? []).slice(0, 3))}
              </div>
            ) : (
              <p className="nl-arena-mvp-teaser">
                Die MVP-Wertungen bleiben verdeckt, bis das Board die Finale-Phase erreicht — schalte die Phasen oben
                weiter.
              </p>
            )}
          </NlCard>

          <details className="nl-arena-diagnose" data-testid="nl-arena-diagnose">
            <summary>
              Details &amp; Diagnose
              {feedWarnings.length > 0 ? ` (${feedWarnings.length} Hinweise)` : ""}
            </summary>
            <div className="nl-arena-diagnose-body">
              <StatChipRow aria-label="Arena-Telemetrie" className="nl-arena-diagnose-chips">
                <StatChip
                  label="Readiness"
                  value={`${scoreFeed?.lineupSummary.existingLineups ?? 0}/${scoreFeed?.lineupSummary.totalTeams ?? 0}`}
                  tone={blockedTeams > 0 ? "warn" : "good"}
                  title="Teams mit vorhandener Einsatzliste"
                />
                <StatChip
                  label="Auto-Lineups"
                  value={autoLineups}
                  tone={autoLineups > 0 ? "warn" : "good"}
                  sub={`${blockedTeams} blockiert`}
                  title="Automatisch erzeugte Einsatzlisten"
                />
                <StatChip
                  label="Status"
                  value={scoreFeed?.status ?? "—"}
                  tone={scoreFeed?.status === "blocked" ? "risk" : scoreFeed?.status === "warning" ? "warn" : "good"}
                />
              </StatChipRow>
              {scoreFeed ? (
                <p className="nl-arena-diagnose-line">
                  Reveal-Sources: Form {scoreFeed.resolveSources.formCardSourceLabel ?? scoreFeed.resolveSources.formCardSourceStatus}{" "}
                  · Mutator {scoreFeed.resolveSources.mutatorSourceLabel ?? scoreFeed.resolveSources.mutatorSourceStatus} · Captain{" "}
                  {scoreFeed.resolveSources.captainSourceStatus} · Fatigue {scoreFeed.resolveSources.fatigueSourceStatus} · Team-PPs{" "}
                  {scoreFeed.resolveSources.teamPpsSourceStatus} · Team-Power{" "}
                  {scoreFeed.resolveSources.teamPowerSourceLabel ?? scoreFeed.resolveSources.teamPowerSourceStatus}
                </p>
              ) : null}
              <p className="nl-arena-diagnose-line">
                Scope: {params.saveId} / {params.seasonId} / {params.matchdayId} · Quelle: {source}
              </p>
              {feedWarnings.length > 0 ? (
                <ul className="nl-arena-diagnose-list">
                  {feedWarnings.slice(0, 20).map((warning, index) => (
                    <li key={`nl-arena-warning-${index}`}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="nl-arena-diagnose-line">Keine offenen Warnungen.</p>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
