"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlCard,
  NlCountUpValue,
  NlDeltaChip,
  NlMedalBadge,
  NlProgressBar,
  NlSparkline,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
} from "@/components/foundation/new-look";
import { VeloImpactStrip } from "@/components/foundation/velo-ui";
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
import { useArenaRoomSync } from "@/lib/room/use-arena-room-sync";
import type { RoomArenaState } from "@/types/game";

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
  /**
   * Disziplin-/Bereitschafts-Metadaten aus dem echten Disziplin-Schedule
   * (`options.matchdays`) — unabhängig von der Wertung befüllt und damit auch
   * im Pre-Race-Zustand (MD1, Spieltag noch nicht aufgelöst) vorhanden, wenn
   * `scoreSummary.targetMatchday` noch keine Disziplin-Namen kennt.
   */
  options?: {
    matchdays?: Array<{
      id: string;
      label?: string | null;
      status?: string | null;
      resultApplied?: boolean;
      discipline1Label?: string | null;
      discipline1RequiredPlayers?: number | null;
      discipline2Label?: string | null;
      discipline2RequiredPlayers?: number | null;
      readyTeams?: number | null;
      totalTeams?: number | null;
    }>;
  };
  briefingStandings?: ArenaNewLookStandingsPreview | null;
  error?: string;
};

/**
 * Spoilerfreie Ausgangslage vor dem Spieltag: nur der aktuelle Liga-Rang
 * (`currentRank`, vor diesem Spieltag). `projectedRank` bleibt bewusst
 * ungenutzt, damit das Briefing das Reveal-Ergebnis nicht vorwegnimmt.
 */
type ArenaNewLookStandingsPreview = {
  items: Array<{ teamId: string; currentRank: number | null; projectedRank: number | null }>;
  error?: string;
};

/**
 * Aus dem Arena-Base-Payload extrahierte Spieltag-Metadaten. Quelle ist der
 * Disziplin-Schedule (dieselbe Quelle wie das Ergebnis-Panel darunter), damit
 * die D1/D2-Header-Chips und der Pre-Race-Poster echte Disziplin-Namen zeigen —
 * auch bevor die Wertung existiert.
 */
type ArenaNewLookMatchdayMeta = {
  label: string | null;
  resultApplied: boolean;
  d1DisciplineName: string | null;
  d1RequiredPlayers: number | null;
  d2DisciplineName: string | null;
  d2RequiredPlayers: number | null;
  readyTeams: number | null;
  totalTeams: number | null;
};

function extractArenaMatchdayMeta(
  payload: ArenaNewLookBasePayload,
  matchdayId: string,
): ArenaNewLookMatchdayMeta | null {
  const entry = payload.options?.matchdays?.find((matchday) => matchday.id === matchdayId);
  if (!entry) {
    return null;
  }
  return {
    label: entry.label ?? null,
    resultApplied: Boolean(entry.resultApplied),
    d1DisciplineName: entry.discipline1Label ?? null,
    d1RequiredPlayers: entry.discipline1RequiredPlayers ?? null,
    d2DisciplineName: entry.discipline2Label ?? null,
    d2RequiredPlayers: entry.discipline2RequiredPlayers ?? null,
    readyTeams: entry.readyTeams ?? null,
    totalTeams: entry.totalTeams ?? null,
  };
}

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

/**
 * Abspielgeschwindigkeiten für die Reveal-Show (Intervall pro Phase in ms).
 * Reines UI-Timing — kein Einfluss auf Werte oder Reihenfolge.
 */
const NL_ARENA_SPEED_OPTIONS = [
  { id: "slow", label: "0.5×", intervalMs: 3600 },
  { id: "normal", label: "1×", intervalMs: 1800 },
  { id: "fast", label: "2×", intervalMs: 900 },
] as const;

/** Dramaturgie-Zeile pro Phase — reine UI-Copy, keine Daten. */
const NL_ARENA_PHASE_DESCRIPTIONS: Record<MatchdayArenaPhaseId, string> = {
  slots: "Basiswertung aus den aufgestellten Slots — hier zahlt sich deine Aufstellung aus.",
  push: "Intensitäts-Ansagen schlagen zu: Push riskiert mehr, Schonen spart Kräfte.",
  form: "Die Formkarten landen — Tagesform hebt oder drückt den Score.",
  mutator: "Mutatoren greifen: Die Spezialregeln des Spieltags belohnen Treffer.",
  captain: "Der Kapitäns-Bonus kommt aufs Board.",
  power: "Team-Power veredelt den Score der stärksten Kader.",
  final: "Endwertung steht — alle Effekte sind eingerechnet.",
  result: "Tagespunkte (PPs) werden vergeben — das zählt für die Saison.",
};

type ArenaStageMover = { teamId: string; teamName: string; value: number };

/**
 * Feature 2 (Schlüsselmomente): ein akkumulierter Bühnen-Spotlight-Eintrag
 * einer bereits enthüllten Phase — Schub (`gain`), Dämpfer (`loss`) oder
 * Rang-Kletterer (`climb`). Trägt die Phasen-Herkunft für den Ticker.
 */
type ArenaKeyMoment = {
  key: string;
  phaseId: MatchdayArenaPhaseId;
  phaseLabel: string;
  kind: "gain" | "loss" | "climb";
  teamId: string;
  teamName: string;
  value: number;
};

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
  // Bewusst auf stabile Primitives (Länge + erstes Team) statt der
  // `props.teams`-Array-Referenz memoisieren — analog zu `externalParams` im
  // Legacy-`MatchdayArenaV2Client`. Der Parent liefert bei Re-Renders teils eine
  // neue `teams`-Array-Referenz; hinge `params` daran, würde der Lade-Effekt
  // (`[params, source]`) bei jedem Re-Render neu laufen, den laufenden
  // arena-base-Fetch (~2 s) abbrechen und neu starten — eine Abort-Schleife, die
  // `scoreFeed` nie befüllt (Dauer-Skeleton + Platzhalter-Chips "Disziplin 1/2").
  const firstTeamId = props.teams[0]?.teamId ?? "";
  const params = useMemo(
    () => ({
      saveId: props.defaultSaveId,
      seasonId: props.defaultSeasonId,
      matchdayId: props.defaultMatchdayId,
      teamId: resolveArenaNewLookTeamId(props.teams, props.defaultTeamId),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.defaultSaveId,
      props.defaultSeasonId,
      props.defaultMatchdayId,
      props.defaultTeamId,
      firstTeamId,
      props.teams.length,
    ],
  );
  const source = props.initialSource ?? "sqlite";

  const [loadState, setLoadState] = useState<ArenaNewLookLoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scoreFeed, setScoreFeed] = useState<MatchdayMvpScoringResult | null>(null);
  const [matchdayMeta, setMatchdayMeta] = useState<ArenaNewLookMatchdayMeta | null>(null);
  const [feedWarnings, setFeedWarnings] = useState<string[]>([]);
  const [boardSide, setBoardSide] = useState<ArenaNewLookBoardSide>("d1");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [standingsPreview, setStandingsPreview] = useState<ArenaNewLookStandingsPreview | null>(null);
  const rowNodesRef = useRef<Map<string, HTMLElement>>(new Map());

  // Phase 3 (Teilen): Zustand der Kopier-Bestätigung am eigenen Ergebnis-Recap.
  // "copied" wird nach fester Verzögerung zurückgesetzt (kein Date.now()/Math.random(),
  // reiner setTimeout mit konstanter Dauer, siehe Effect unten). "error" bleibt stehen,
  // damit der markierbare Fallback-Text zum manuellen Kopieren sichtbar bleibt.
  const [recapCopyState, setRecapCopyState] = useState<"idle" | "copied" | "error">("idle");
  const recapCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Co-op room sync (shared hook with the classic arena — see
  // lib/room/use-arena-room-sync.ts). New Look's own reveal state is coarser
  // than the classic arena's (a single `boardSide` + `phaseIndex`, no
  // per-discipline slot counter), so the applied step maps 1:1 onto those two
  // fields and the host always advances with maxSlotRevealCountByDiscipline
  // {d1:0, d2:0} — that keeps "one host click = one phase step" in lockstep
  // with how New Look's own Zurück/Weiter buttons already behave locally.
  const {
    isRoomHost,
    isRoomRevealSyncActive,
    arenaCoopReadyGateActive,
    arenaReadyParticipantIds,
    isSelfArenaReady,
    arenaCoopGateParticipants,
    arenaCoopWaitingNames,
    canControlArenaReveal,
    roomRevealWaitingForHost,
    roomArenaSyncState,
    emitHostRoomArenaAdvance: emitHostRoomArenaAdvanceSync,
    emitArenaCoopReadyToggle,
    emitStartRoomArena,
  } = useArenaRoomSync({
    roomContext: props.roomContext,
    saveId: params.saveId,
    seasonId: params.seasonId,
    matchdayId: params.matchdayId,
    onApplyRevealSync: (normalized: RoomArenaState) => {
      setBoardSide(normalized.activeDisciplinePhase);
      setPhaseIndex(normalized.phaseIndex);
      setIsAutoPlaying(false);
    },
  });
  const arenaControlsLocked = isRoomRevealSyncActive && !canControlArenaReveal;

  // Host auto-requests the shared arena sync once the board has actually
  // loaded (mirrors the classic arena's auto-start effect). Whether the
  // "both ready" gate then blocks the reveal depends purely on the server's
  // co-op check (>1 required participant) — solo-in-room starts revealing
  // immediately, exactly like before New Look had any room-sync at all.
  useEffect(() => {
    if (!props.roomContext || !isRoomHost || loadState !== "ready") {
      return;
    }
    if ((roomArenaSyncState?.status ?? "idle") !== "idle") {
      return;
    }
    emitStartRoomArena({
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      disciplineSide: "d1",
      maxSlotRevealCountByDiscipline: { d1: 0, d2: 0 },
    });
  }, [
    isRoomHost,
    loadState,
    params.matchdayId,
    params.seasonId,
    props.roomContext,
    roomArenaSyncState?.status,
    emitStartRoomArena,
  ]);

  function handleHostRoomArenaAdvance() {
    emitHostRoomArenaAdvanceSync({ d1: 0, d2: 0 });
  }

  useEffect(() => {
    if (!params.saveId || !params.seasonId || !params.matchdayId || !params.teamId) {
      setLoadState("error");
      setLoadError("Für die Arena fehlt Save-, Season-, Matchday- oder Team-Kontext.");
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    function applyScoreSummary(
      summary: MatchdayMvpScoringResult,
      warnings: string[],
      meta: ArenaNewLookMatchdayMeta | null,
    ) {
      if (cancelled) {
        return;
      }
      setScoreFeed(summary);
      setMatchdayMeta(meta);
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
            if (!cancelled) {
              setStandingsPreview(cached.briefingStandings ?? null);
            }
            applyScoreSummary(
              cached.scoreSummary,
              [
                ...(cached.contextWarnings ?? []),
                ...(cached.scoreWarnings ?? []),
                ...(cached.scoreBlockingReasons ?? []),
                ...cached.scoreSummary.warnings,
                ...cached.scoreSummary.blockingReasons,
              ],
              extractArenaMatchdayMeta(cached, params.matchdayId),
            );
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
            // Auch im Fehlerfall die echten Disziplin-Namen mitnehmen, damit die
            // Fehlerkarte/Header-Chips nicht auf "Disziplin 1/2" zurückfallen.
            setMatchdayMeta(extractArenaMatchdayMeta(payload, params.matchdayId));
            setLoadState("error");
            setLoadError(payload.error ?? "Die Arena konnte die Spieltagswertung nicht laden.");
            return;
          }
          if (payload.context) {
            setMatchdayArenaBaseBundle(sessionKey, payload);
          }
          setStandingsPreview(payload.briefingStandings ?? null);
          applyScoreSummary(
            payload.scoreSummary,
            [
              ...(payload.contextWarnings ?? []),
              ...(payload.contextErrors ?? []),
              ...(payload.scoreWarnings ?? []),
              ...(payload.scoreBlockingReasons ?? []),
              ...payload.scoreSummary.warnings,
              ...payload.scoreSummary.blockingReasons,
            ],
            extractArenaMatchdayMeta(payload, params.matchdayId),
          );
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
        setStandingsPreview(null);
        applyScoreSummary(
          payload.summary,
          [...payload.summary.warnings, ...payload.summary.blockingReasons],
          null,
        );
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

  // Spoilerfreies Briefing: aktuelle Liga-Ausgangslage vor dem Spieltag.
  // Nur `currentRank` — projizierte Werte bleiben aussen vor, damit das
  // Reveal-Ergebnis nicht vorweggenommen wird. Zeigt Top 3 + die eigene
  // Nachbarschaft (Rang -1/0/+1) als kompaktes Fenster.
  const arenaBriefing = useMemo(() => {
    const rows = (standingsPreview?.items ?? [])
      .filter((item): item is { teamId: string; currentRank: number; projectedRank: number | null } => item.currentRank != null)
      .map((item) => ({
        teamId: item.teamId,
        rank: item.currentRank,
        teamName: teamById.get(item.teamId)?.name ?? item.teamId,
        teamCode: teamById.get(item.teamId)?.shortCode ?? item.teamId,
        isOwn: item.teamId === params.teamId,
      }))
      .sort((a, b) => a.rank - b.rank);
    if (rows.length === 0) {
      return null;
    }
    const ownRow = rows.find((row) => row.isOwn) ?? null;
    const total = rows.length;
    const keepRanks = new Set<number>();
    rows.slice(0, 3).forEach((row) => keepRanks.add(row.rank));
    if (ownRow) {
      [ownRow.rank - 1, ownRow.rank, ownRow.rank + 1].forEach((rank) => keepRanks.add(rank));
    }
    const window = rows.filter((row) => keepRanks.has(row.rank));
    return { ownRank: ownRow?.rank ?? null, total, window };
  }, [standingsPreview, teamById, params.teamId]);

  const d1View = useMemo(
    () => buildMatchdayArenaScoreboardView(scoreFeed?.d1Scoreboard ?? []),
    [scoreFeed?.d1Scoreboard],
  );
  const d2View = useMemo(
    () => buildMatchdayArenaScoreboardView(scoreFeed?.d2Scoreboard ?? []),
    [scoreFeed?.d2Scoreboard],
  );

  // Disziplin-Namen bevorzugt aus dem echten Schedule (matchdayMeta) — dieselbe
  // Quelle wie das Ergebnis-Panel darunter —, damit die Header-Chips auch im
  // Pre-Race-Zustand nicht auf "Disziplin 1/2" zurückfallen.
  const d1Label =
    matchdayMeta?.d1DisciplineName ?? scoreFeed?.targetMatchday.d1DisciplineName ?? "Disziplin 1";
  const d2Label =
    matchdayMeta?.d2DisciplineName ?? scoreFeed?.targetMatchday.d2DisciplineName ?? "Disziplin 2";

  const activePhase: MatchdayArenaPhaseId =
    MATCHDAY_ARENA_PHASES[Math.max(0, Math.min(phaseIndex, MATCHDAY_ARENA_PHASES.length - 1))]?.id ?? "slots";
  const previousPhase: MatchdayArenaPhaseId | null =
    phaseIndex > 0 ? (MATCHDAY_ARENA_PHASES[phaseIndex - 1]?.id ?? null) : null;
  const isResultPhase = activePhase === "result";
  // Auf dem "Gesamt"-Board sind die Endwerte immer sichtbar (keine Reveal-Phasen),
  // daher dort die Ausgangs-Buttons (Ergebnis/Saisonstand) ebenfalls freischalten.
  const resultsUnlocked = isResultPhase || boardSide === "total";
  const finalPhaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "final");
  const mvpsRevealed = phaseIndex >= finalPhaseIndex || boardSide === "total";

  const activeView = boardSide === "d2" ? d2View : d1View;

  // Reveal-Autoplay: Phasen automatisch durchschalten, solange aktiv und
  // solange die letzte Phase noch nicht erreicht ist. Kein Date.now() im
  // Render — reines setInterval im Effect, das beim Unmount/Wechsel
  // sauber wieder abgeräumt wird.
  useEffect(() => {
    // Matches the classic arena: inside any Room the shared timeline only
    // moves on the host's explicit step (`handleHostRoomArenaAdvance`), never
    // on a local timer — otherwise the guest's mirrored view would jump on a
    // cadence nobody agreed to.
    if (!isAutoPlaying || boardSide === "total" || isRoomRevealSyncActive) {
      return;
    }
    if (phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1) {
      setIsAutoPlaying(false);
      return;
    }
    const intervalMs = NL_ARENA_SPEED_OPTIONS[speedIndex]?.intervalMs ?? 1800;
    const interval = setInterval(() => {
      setPhaseIndex((index) => Math.min(MATCHDAY_ARENA_PHASES.length - 1, index + 1));
    }, intervalMs);
    return () => clearInterval(interval);
  }, [isAutoPlaying, boardSide, phaseIndex, speedIndex, isRoomRevealSyncActive]);

  // Wechsel der Disziplin-Seite schließt eine offene Score-Herkunft und
  // stoppt eine laufende Autoplay-Show (die Phasen gelten pro Board-Seite).
  useEffect(() => {
    setExpandedTeamId(null);
    setIsAutoPlaying(false);
  }, [boardSide]);

  // Phase 3 (Teilen): laufenden Reset-Timer der Kopier-Bestätigung beim Unmount
  // abräumen, damit kein setState auf einer entfernten Komponente feuert.
  useEffect(
    () => () => {
      if (recapCopyTimerRef.current) {
        clearTimeout(recapCopyTimerRef.current);
      }
    },
    [],
  );

  function scrollToTeam(teamId: string) {
    const node = rowNodesRef.current.get(teamId);
    if (!node) {
      return;
    }
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  function scrollToOwnTeam() {
    scrollToTeam(params.teamId);
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

  // Bühnen-Spotlight der aktiven Phase: wer gewinnt/verliert am meisten
  // Score (echte Phase-Deltas) und wer klettert am weitesten im Rang.
  const stageInfo = useMemo(() => {
    if (boardRows.length === 0) {
      return null;
    }
    let topGain: ArenaStageMover | null = null;
    let topLoss: ArenaStageMover | null = null;
    let gainers = 0;
    let losers = 0;
    let ownDelta: number | null = null;
    for (const row of boardRows) {
      const delta = getMatchdayArenaPhaseDelta(row, activePhase);
      if (delta == null || delta === 0) {
        if (delta === 0 && row.teamId === params.teamId) {
          ownDelta = 0;
        }
        continue;
      }
      if (row.teamId === params.teamId) {
        ownDelta = delta;
      }
      if (delta > 0) {
        gainers += 1;
        if (!topGain || delta > topGain.value) {
          topGain = { teamId: row.teamId, teamName: row.teamName, value: delta };
        }
      } else {
        losers += 1;
        if (!topLoss || delta < topLoss.value) {
          topLoss = { teamId: row.teamId, teamName: row.teamName, value: delta };
        }
      }
    }
    let climber: ArenaStageMover | null = null;
    for (const row of boardRows) {
      const rank = rankMaps.current.get(row.teamId) ?? null;
      const previousRank = rankMaps.previous?.get(row.teamId) ?? null;
      const rankDelta = getArenaStepRankDelta(rank, previousRank);
      if (rankDelta != null && rankDelta > 0 && (!climber || rankDelta > climber.value)) {
        climber = { teamId: row.teamId, teamName: row.teamName, value: rankDelta };
      }
    }
    const leader = boardRows[0] ?? null;
    return {
      topGain,
      topLoss,
      gainers,
      losers,
      ownDelta,
      climber,
      leader: leader
        ? {
            teamId: leader.teamId,
            teamName: leader.teamName,
            value: getMatchdayArenaPhaseScore(leader, activePhase) ?? 0,
          }
        : null,
    };
  }, [boardRows, activePhase, rankMaps, params.teamId]);

  // "Dein Lauf": Rang des eigenen Teams nach jeder Reveal-Phase — dieselben
  // Presenter-Rankings wie das Board, nur je Phase eingefroren.
  const ownRun = useMemo(() => {
    if (activeView.length === 0 || !activeView.some((row) => row.teamId === params.teamId)) {
      return [];
    }
    const slotScores = () => buildBaseScoreMap(activeView);
    return MATCHDAY_ARENA_PHASES.map((phase) => {
      const rankMap = buildArenaTeamRankMap(activeView, { phaseId: phase.id, revealedSlotCount: 0 }, slotScores);
      return { id: phase.id, label: phase.label, rank: rankMap.get(params.teamId) ?? null };
    });
  }, [activeView, params.teamId]);

  // Feature 2: Momentum-Sparkline für "Dein Lauf" — eigener Rang über die bereits
  // enthüllten Phasen, invertiert (negierter Rang → oben = besserer Rang), analog
  // zum invertierten Kumulativ-Rang in NlFieldRaceFormStrip. Bewusst nur bis zur
  // aktuellen Phase geschnitten, damit die Sparkline den Endrang nicht vorwegnimmt.
  const ownRunSparkPoints = useMemo(
    () =>
      ownRun
        .slice(0, phaseIndex + 1)
        .map((step) => step.rank)
        .filter((rank): rank is number => typeof rank === "number" && Number.isFinite(rank))
        .map((rank) => -rank),
    [ownRun, phaseIndex],
  );

  // Feature 1: Erwartung vs. Ergebnis — Start-Rang (`baseRank`, nach reiner
  // Basiswertung) gegen den End-Rang des eigenen Teams. `baseRank`/`rankDelta`
  // werden vom Presenter bereits berechnet, aber nirgends gerendert; hier nur
  // angezeigt, KEINE eigene Rang-Rechnung. Wird erst in der Ergebnis-Phase
  // ausgespielt (siehe Render) — spoilerfrei.
  const ownExpectation = useMemo(() => {
    if (boardSide === "total" || activeView.length === 0) {
      return null;
    }
    const row = activeView.find((entry) => entry.teamId === params.teamId);
    if (!row) {
      return null;
    }
    return {
      teamName: row.teamName,
      baseRank: row.baseRank,
      finalRank: row.rank,
      rankDelta: row.rankDelta,
      total: activeView.length,
      // Phase 3 (Teilen): Tagespunkte der eigenen Zeile für den Recap-Text —
      // exakt der Wert, der in der Ergebnis-Phase auf dem Board steht.
      points: row.points,
    };
  }, [activeView, params.teamId, boardSide]);

  // Phase 3 (Teilen): Tages-MVP für den Recap — bester Einzelscore über beide
  // Disziplin-Top-Listen (im Finale/Ergebnis bereits enthüllt, siehe MVP-Karte).
  // Reine Auswahl aus schon berechneten Daten, keine eigene Wertung.
  const resultMvpName = useMemo<string | null>(() => {
    const pool = [...(scoreFeed?.d1TopPlayers ?? []), ...(scoreFeed?.d2TopPlayers ?? [])];
    if (pool.length === 0) {
      return null;
    }
    const best = pool.reduce((top, player) =>
      player.finalPlayerScore > top.finalPlayerScore ? player : top,
    );
    return best.playerName || null;
  }, [scoreFeed?.d1TopPlayers, scoreFeed?.d2TopPlayers]);

  // Phase 3 (Teilen): kompakter Klartext-Recap NUR aus in der Ergebnis-Phase
  // sichtbaren Daten (Rang, PPs, MVP, Rang-Bewegung aus baseRank/rankDelta).
  // Fehlende Felder werden weggelassen (degradiert), statt Platzhalter zu zeigen.
  const ownRecap = useMemo<string | null>(() => {
    if (!isResultPhase || !ownExpectation) {
      return null;
    }
    const matchdayLabel = scoreFeed?.targetMatchday.label?.trim() || "Spieltag";
    const movement =
      ownExpectation.rankDelta > 0
        ? `▲${ownExpectation.rankDelta}`
        : ownExpectation.rankDelta < 0
          ? `▼${Math.abs(ownExpectation.rankDelta)}`
          : "±0";
    let text = `${matchdayLabel} — ${ownExpectation.teamName}: Platz #${ownExpectation.finalRank}`;
    if (ownExpectation.points != null) {
      text += `, ${formatNlNumber(ownExpectation.points, 1)} PPs`;
    }
    text += ".";
    if (resultMvpName) {
      text += ` MVP: ${resultMvpName}.`;
    }
    text += ` ${movement}`;
    return text;
  }, [isResultPhase, ownExpectation, scoreFeed?.targetMatchday.label, resultMvpName]);

  // Phase 3 (Teilen): Recap in die Zwischenablage kopieren. Erst den offenen
  // Reset-Timer stoppen, dann per navigator.clipboard.writeText kopieren. Bei
  // Erfolg kurze "kopiert ✓"-Bestätigung mit fester Reset-Verzögerung; bei
  // Fehlschlag "error" (markierbarer Fallback-Text bleibt im Render sichtbar).
  async function handleCopyRecap(text: string) {
    if (recapCopyTimerRef.current) {
      clearTimeout(recapCopyTimerRef.current);
      recapCopyTimerRef.current = null;
    }
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("clipboard-unavailable");
      }
      await navigator.clipboard.writeText(text);
      setRecapCopyState("copied");
      recapCopyTimerRef.current = setTimeout(() => setRecapCopyState("idle"), 2400);
    } catch {
      // Fallback: Fehler anzeigen und den Text markierbar rendern, damit der
      // Nutzer manuell kopieren kann. Kein Auto-Reset, solange der Fallback zählt.
      setRecapCopyState("error");
    }
  }

  // Feature 2 (Schlüsselmomente): Rang-Karten je Phase für ALLE Teams — dieselben
  // Presenter-Rankings wie das Board, nur je Phase eingefroren. Basis für die
  // Kletterer-Erkennung im persistenten Ticker.
  const phaseRankMaps = useMemo<Map<string, number>[]>(() => {
    if (activeView.length === 0) {
      return [];
    }
    const slotScores = () => buildBaseScoreMap(activeView);
    return MATCHDAY_ARENA_PHASES.map((phase) =>
      buildArenaTeamRankMap(activeView, { phaseId: phase.id, revealedSlotCount: 0 }, slotScores),
    );
  }, [activeView]);

  // Feature 2: Schlüsselmomente-Feed — akkumuliert die Bühnen-Spotlights
  // (Stärkster Schub / Härtester Dämpfer / Kletterer) über ALLE bereits
  // enthüllten Phasen (0…phaseIndex). Gleiche Logik wie `stageInfo`, nur je Phase
  // statt nur der aktiven — spoilerfrei, weil verdeckte Phasen (> phaseIndex)
  // ausgelassen werden.
  const keyMoments = useMemo<ArenaKeyMoment[]>(() => {
    if (boardSide === "total" || activeView.length === 0) {
      return [];
    }
    const revealed = Math.min(phaseIndex, MATCHDAY_ARENA_PHASES.length - 1);
    const entries: ArenaKeyMoment[] = [];
    for (let i = 0; i <= revealed; i += 1) {
      const phase = MATCHDAY_ARENA_PHASES[i];
      if (!phase) {
        continue;
      }
      let topGain: ArenaStageMover | null = null;
      let topLoss: ArenaStageMover | null = null;
      for (const row of activeView) {
        const delta = getMatchdayArenaPhaseDelta(row, phase.id);
        if (delta == null || delta === 0) {
          continue;
        }
        if (delta > 0) {
          if (!topGain || delta > topGain.value) {
            topGain = { teamId: row.teamId, teamName: row.teamName, value: delta };
          }
        } else if (!topLoss || delta < topLoss.value) {
          topLoss = { teamId: row.teamId, teamName: row.teamName, value: delta };
        }
      }
      // Kletterer über den Rang-Sprung gegenüber der Phase davor (echte Presenter-Ränge).
      let climber: ArenaStageMover | null = null;
      const current = phaseRankMaps[i] ?? null;
      const previous = i > 0 ? (phaseRankMaps[i - 1] ?? null) : null;
      if (current && previous) {
        for (const row of activeView) {
          const rankDelta = getArenaStepRankDelta(current.get(row.teamId), previous.get(row.teamId));
          if (rankDelta != null && rankDelta > 0 && (!climber || rankDelta > climber.value)) {
            climber = { teamId: row.teamId, teamName: row.teamName, value: rankDelta };
          }
        }
      }
      if (topGain) {
        entries.push({ key: `${phase.id}-gain`, phaseId: phase.id, phaseLabel: phase.label, kind: "gain", ...topGain });
      }
      if (topLoss) {
        entries.push({ key: `${phase.id}-loss`, phaseId: phase.id, phaseLabel: phase.label, kind: "loss", ...topLoss });
      }
      if (climber) {
        entries.push({ key: `${phase.id}-climb`, phaseId: phase.id, phaseLabel: phase.label, kind: "climb", ...climber });
      }
    }
    return entries;
  }, [activeView, phaseIndex, phaseRankMaps, boardSide]);

  // Feature 3: Head-to-Head — eigenes Team gegen den unmittelbaren Rang-Nachbarn
  // (bevorzugt eine Position darüber = das Team, das du jagst; als Erster gegen
  // den Verfolger dahinter). Rein aus dem aktuell sortierten Board abgeleitet,
  // Scores aus der laufenden Phase — spoilerfrei, identisch zu den Board-Werten.
  const duel = useMemo(() => {
    if (boardSide === "total" || boardRows.length < 2) {
      return null;
    }
    const ownIndex = boardRows.findIndex((row) => row.teamId === params.teamId);
    if (ownIndex < 0) {
      return null;
    }
    const neighborIndex = ownIndex > 0 ? ownIndex - 1 : ownIndex + 1;
    const own = boardRows[ownIndex];
    const neighbor = boardRows[neighborIndex];
    if (!own || !neighbor) {
      return null;
    }
    const ownScore = getMatchdayArenaPhaseScore(own, activePhase) ?? 0;
    const neighborScore = getMatchdayArenaPhaseScore(neighbor, activePhase) ?? 0;
    const ownRank = rankMaps.current.get(own.teamId) ?? ownIndex + 1;
    const neighborRank = rankMaps.current.get(neighbor.teamId) ?? neighborIndex + 1;
    return {
      own,
      neighbor,
      ownScore,
      neighborScore,
      ownRank,
      neighborRank,
      neighborIsAhead: ownIndex > 0,
      scoreGap: Number((ownScore - neighborScore).toFixed(1)),
    };
  }, [boardRows, params.teamId, activePhase, rankMaps, boardSide]);

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

  // Pre-Race-Zustand: Die Wertung ist geladen (`ready`), aber es liegen noch
  // keine gescorten Team-Zeilen vor — der Spieltag ist noch nicht aufgelöst
  // (MD1-Slots-Phase). Statt toter Skeletons/leerer Board zeigen wir dann einen
  // statischen, befüllten "Slots-Phase"-Poster.
  const hasScoredRows = d1View.length > 0 || d2View.length > 0;
  const ownLineupTeam = scoreFeed?.lineupTeams.find((team) => team.teamId === params.teamId) ?? null;
  const readyTeamsCount =
    matchdayMeta?.readyTeams ?? scoreFeed?.lineupSummary.existingLineups ?? null;
  const totalTeamsCount =
    matchdayMeta?.totalTeams ?? scoreFeed?.lineupSummary.totalTeams ?? props.teams.length;

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

  // Feature 1: Finale-Aufschlüsselung. Der Score-Sprung in der Finale-/Ergebnis-
  // Phase (der bereits vom Presenter als `phaseDelta` gezeigte Final-Delta) stammt
  // aus Fatigue + Team-PPs, die erst hier greifen. Wir zerlegen ihn sichtbar in
  // seine zwei Komponenten — reine Anzeige der schon berechneten Modifikatoren
  // (`fatigueModifier`/`teamPpsModifier`), keine eigene Rechnung. Hinweis: Auf der
  // Zeile liegt nur der Fatigue-Score-Modifikator, KEIN 0–100-Fatigue-Level, daher
  // kein NlFatigueGauge — der Effekt wird als NlDeltaChip dargestellt.
  function renderFinaleExplainer(row: MatchdayArenaScoreboardRowView) {
    const fatigueMod = row.fatigueStatus === "mapped" ? row.fatigueModifier : null;
    const teamPpsMod = row.teamPpsStatus === "ready" ? row.teamPpsModifier : null;
    const hasFatigue = fatigueMod != null && Math.abs(fatigueMod) >= 0.05;
    const hasTeamPps = teamPpsMod != null && Math.abs(teamPpsMod) >= 0.05;
    if (!hasFatigue && !hasTeamPps) {
      return null;
    }
    return (
      <div className="nl-arena-finale-explainer" role="group" aria-label="Finale-Effekte: Fatigue und Team-PPs">
        <span className="nl-arena-finale-explainer-label">Finale-Effekte</span>
        <div className="nl-arena-finale-explainer-items">
          {hasFatigue ? (
            <span className="nl-arena-finale-explainer-item">
              <span className="nl-arena-finale-explainer-item-label">Fatigue</span>
              <NlDeltaChip
                value={fatigueMod!}
                format={formatSignedNlDelta}
                title="Erschöpfungs-Effekt auf den Finalscore (Abzug = ausgelaugt)"
              />
            </span>
          ) : null}
          {hasTeamPps ? (
            <span className="nl-arena-finale-explainer-item">
              <span className="nl-arena-finale-explainer-item-label">Team-PPs</span>
              <NlDeltaChip
                value={teamPpsMod!}
                format={formatSignedNlDelta}
                title="Team-PPs-Effekt auf den Finalscore"
              />
            </span>
          ) : null}
        </div>
      </div>
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
          // Gold-Glow für die Führung, sobald das Board die Finale-/Ergebnis-Phase
          // erreicht (reine CSS-Deko über `.is-leader`).
          const isLeaderGlow = rank === 1 && (activePhase === "final" || isResultPhase);

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
              aria-current={isOwnTeam ? "true" : undefined}
              className={`nl-arena-row${isOwnTeam ? " is-own-team" : ""}${rankDelta != null && rankDelta !== 0 ? (rankDelta > 0 ? " is-moving-up" : " is-moving-down") : ""}${isExpanded ? " is-expanded" : ""}${isLeaderGlow ? " is-leader" : ""}`}
              style={{
                ...(team ? getSeasonV2TeamTagStyle(team.shortCode) : undefined),
                top: Math.max(0, rank - 1) * NL_ARENA_ROW_STRIDE,
              }}
            >
              {rankDelta != null && rankDelta !== 0 ? (
                <span
                  key={`nl-arena-pulse-${activePhase}`}
                  aria-hidden="true"
                  className={`nl-arena-row-pulse ${rankDelta > 0 ? "is-up" : "is-down"}`}
                />
              ) : null}
              {isOwnTeam ? (
                <>
                  <span className="nl-arena-own-flag" aria-hidden="true">
                    Du
                  </span>
                  <span className="sr-only">Dein Team</span>
                </>
              ) : null}
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
                  {/* Score als Count-Up (~400 ms) — konsistent mit dem Ergebnis-Screen.
                      `key` je Phase erzwingt Re-Mount, damit der Zähler bei jedem
                      Phasenwechsel neu hochläuft. */}
                  <strong key={`nl-arena-score-${activePhase}`} className="nl-arena-score nl-tnum">
                    <NlCountUpValue
                      value={phaseScore}
                      opts={{ durationMs: 400 }}
                      format={(value) => formatNlNumber(value, 1)}
                    />
                  </strong>
                </button>
                {isResultPhase && row.points != null ? (
                  <span className="nl-arena-points nl-tnum" title="Tagespunkte (PPs) in dieser Disziplin">
                    {formatNlNumber(row.points, 1)} PPs
                  </span>
                ) : null}
              </span>
              {isExpanded ? (
                // Phasen-Breakdown (Slots/Push/Form/Mut/Cap/Pow) über die Kit-Komponente
                // `VeloImpactStrip` statt eigener Breakdown-Spans (siehe velo-ui/index.ts).
                // Der Wrapper behält role/aria-label für die Score-Herkunft.
                <div className="nl-arena-row-breakdown" role="group" aria-label={`Score-Herkunft ${row.teamName}`}>
                  <VeloImpactStrip
                    items={breakdown.map((item) => ({
                      key: item.id,
                      label: item.label,
                      value: item.valueLabel,
                      tone: item.tone,
                    }))}
                  />
                  {/* Feature 1: In der Finale-/Ergebnis-Phase den ansonsten
                      unerklärten Final-Sprung in Fatigue + Team-PPs zerlegen. */}
                  {activePhase === "final" || isResultPhase ? renderFinaleExplainer(row) : null}
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
              className={`nl-arena-totalrow${isOwnTeam ? " is-own-team" : ""}${row.medal === "gold" ? " is-leader" : ""}`}
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
                  {/* Gesamtscore ebenfalls als Count-Up (~400 ms) — gleiche Behandlung wie das Disziplin-Board. */}
                  <NlCountUpValue
                    value={row.totalScore}
                    opts={{ durationMs: 400 }}
                    format={(value) => formatNlNumber(value, 1)}
                  />
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

  function renderPreRaceBoard() {
    const disciplines = [
      { tag: "D1", tone: "pow" as const, name: d1Label, slots: matchdayMeta?.d1RequiredPlayers ?? null },
      { tag: "D2", tone: "men" as const, name: d2Label, slots: matchdayMeta?.d2RequiredPlayers ?? null },
    ];
    const ownReadyTone =
      ownLineupTeam == null
        ? "warn"
        : ownLineupTeam.blockingReasons.length > 0
          ? "risk"
          : ownLineupTeam.status === "existing_lineup"
            ? "good"
            : "warn";
    const ownReadyValue =
      ownLineupTeam == null
        ? "—"
        : ownLineupTeam.blockingReasons.length > 0
          ? "Blockiert"
          : ownLineupTeam.status === "existing_lineup"
            ? "Aufgestellt"
            : "Auto-Lineup";
    const readinessTone =
      readyTeamsCount != null && totalTeamsCount > 0 && readyTeamsCount >= totalTeamsCount
        ? "good"
        : "warn";

    return (
      <div className="nl-arena-prerace" role="group" aria-label="Slots-Phase — Spieltag noch nicht gelaufen">
        <p className="nl-arena-prerace-lede">
          Der Spieltag ist noch nicht gelaufen. Alle {totalTeamsCount} Teams treten gleich parallel in
          zwei Disziplinen an — sobald aufgelöst wird, füllt sich das Board hier live. Bis dahin zählt
          deine Aufstellung.
        </p>
        <div className="nl-arena-prerace-disciplines">
          {disciplines.map((discipline) => (
            <div key={discipline.tag} className={`nl-arena-prerace-discipline ${nlToneClass(discipline.tone)}`}>
              <span className="nl-arena-prerace-disc-tag">{discipline.tag}</span>
              <strong className="nl-arena-prerace-disc-name">{discipline.name}</strong>
              <span className="nl-arena-prerace-disc-slots nl-tnum">
                {discipline.slots != null ? `${discipline.slots} Slots` : "Slots offen"}
              </span>
            </div>
          ))}
        </div>
        <StatChipRow className="nl-arena-prerace-chips" aria-label="Aufstellungs-Bereitschaft">
          <StatChip
            label="Aufstellungen"
            value={readyTeamsCount != null ? `${readyTeamsCount}/${totalTeamsCount}` : `${totalTeamsCount}`}
            tone={readinessTone}
            sub="Teams aufgestellt"
            title="Teams mit vollständiger Einsatzliste für diesen Spieltag"
          />
          {ownTeamName ? (
            <StatChip
              label="Dein Team"
              value={ownReadyValue}
              tone={ownReadyTone}
              sub={ownTeamName}
              title="Bereitschaft deiner Einsatzliste für diesen Spieltag"
            />
          ) : null}
          <StatChip label="Disziplinen" value={2} tone="accent" title="Zwei parallele Disziplinen pro Spieltag" />
        </StatChipRow>
        {props.onBackToLineup ? (
          <div className="nl-arena-prerace-actions">
            <button className="nl-arena-button is-primary" type="button" onClick={props.onBackToLineup}>
              Aufstellung prüfen
            </button>
          </div>
        ) : null}
      </div>
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

  // Wiederverwendbarer "Details & Diagnose"-Block: Pre-Race- und Post-Race-Zweig
  // waren zuvor fast identisch dupliziert. `showResolveDetails` blendet die nur
  // nach dem Resolve sinnvollen Zusatz-Infos (Auto-Lineups-Chip + Reveal-Sources-
  // Zeile) ein; `totalTeamsFallback` deckt die unterschiedliche Readiness-Basis ab.
  function renderDiagnose(showResolveDetails: boolean, totalTeamsFallback: number) {
    return (
      <details className="nl-arena-diagnose" data-testid="nl-arena-diagnose">
        <summary>
          Details &amp; Diagnose
          {feedWarnings.length > 0 ? ` (${feedWarnings.length} Hinweise)` : ""}
        </summary>
        <div className="nl-arena-diagnose-body">
          <StatChipRow aria-label="Arena-Telemetrie" className="nl-arena-diagnose-chips">
            <StatChip
              label="Readiness"
              value={`${scoreFeed?.lineupSummary.existingLineups ?? 0}/${scoreFeed?.lineupSummary.totalTeams ?? totalTeamsFallback}`}
              tone={blockedTeams > 0 ? "warn" : "good"}
              title="Teams mit vorhandener Einsatzliste"
            />
            {showResolveDetails ? (
              <StatChip
                label="Auto-Lineups"
                value={autoLineups}
                tone={autoLineups > 0 ? "warn" : "good"}
                sub={`${blockedTeams} blockiert`}
                title="Automatisch erzeugte Einsatzlisten"
              />
            ) : null}
            <StatChip
              label="Status"
              value={scoreFeed?.status ?? (showResolveDetails ? "—" : "wartet")}
              tone={scoreFeed?.status === "blocked" ? "risk" : scoreFeed?.status === "warning" ? "warn" : "good"}
            />
          </StatChipRow>
          {showResolveDetails && scoreFeed ? (
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
    );
  }

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
                disabled={!resultsUnlocked}
                title={resultsUnlocked ? "Spieltagsergebnis öffnen" : "Wird nach der Ergebnis-Phase freigeschaltet"}
                onClick={props.onOpenMatchdayResult}
              >
                Ergebnis
              </button>
            ) : null}
            {props.onOpenSeason ? (
              <button
                className="nl-arena-button"
                type="button"
                disabled={!resultsUnlocked}
                title={resultsUnlocked ? "Saisonstand öffnen" : "Wird nach der Ergebnis-Phase freigeschaltet"}
                onClick={props.onOpenSeason}
              >
                Saisonstand
              </button>
            ) : null}
            {props.onAdvanceMatchday ? (
              <button
                className="nl-arena-button is-primary"
                type="button"
                disabled={!resultsUnlocked}
                title={
                  resultsUnlocked
                    ? "Spieltag abschließen und den nächsten starten"
                    : "Wird nach der Ergebnis-Phase freigeschaltet"
                }
                onClick={props.onAdvanceMatchday}
              >
                Zum nächsten Spieltag →
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

      {arenaCoopReadyGateActive ? (
        <NlCard
          className="nl-arena-coop-gate"
          data-testid="arena-coop-ready-gate"
          eyebrow="Gemeinsamer Spieltag"
          title="Bereit für den Spieltag"
          actions={
            <span className={`nl-arena-coop-gate-status${isSelfArenaReady ? " is-ready" : ""}`}>
              {isSelfArenaReady ? "Du bist bereit" : "Noch nicht bereit"}
            </span>
          }
        >
          <p className="nl-arena-coop-gate-hint">
            Der gemeinsame Reveal startet erst, wenn beide Coaches bereit sind.
          </p>
          <StatChipRow className="nl-arena-coop-gate-chips" aria-label="Bereitschaft der Coaches">
            {arenaCoopGateParticipants.map((participant) => {
              const ready = arenaReadyParticipantIds.includes(participant.participantId);
              return (
                <StatChip
                  key={`nl-arena-coop-ready-${participant.participantId}`}
                  label={participant.displayName}
                  value={ready ? "bereit" : "wartet"}
                  tone={ready ? "good" : "warn"}
                />
              );
            })}
          </StatChipRow>
          <div className="nl-arena-actions">
            <button className="nl-arena-button is-primary" type="button" onClick={emitArenaCoopReadyToggle}>
              {isSelfArenaReady ? "Bereit zurücknehmen" : "Bereit für den Spieltag"}
            </button>
          </div>
          {isSelfArenaReady && arenaCoopWaitingNames.length > 0 ? (
            <p className="nl-arena-coop-gate-waiting">Warte auf {arenaCoopWaitingNames.join(", ")} …</p>
          ) : null}
        </NlCard>
      ) : null}

      {arenaBriefing ? (
        <NlCard
          className="nl-arena-briefing-card"
          eyebrow="Vor dem Spieltag · Ausgangslage"
          title="Briefing"
        >
          <div className="nl-arena-briefing-body">
            <div className="nl-arena-briefing-rank">
              <span className="nl-arena-briefing-rank-value nl-tnum">
                {arenaBriefing.ownRank != null ? `#${arenaBriefing.ownRank}` : "—"}
              </span>
              <span className="nl-arena-briefing-rank-label">
                {arenaBriefing.ownRank != null ? `von ${arenaBriefing.total} · dein Rang vor dem Spieltag` : "kein Ligarang"}
              </span>
            </div>
            <ol className="nl-arena-briefing-table" aria-label="Aktuelle Liga-Ausgangslage">
              {arenaBriefing.window.map((row) => (
                <li
                  key={row.teamId}
                  className={`nl-arena-briefing-row${row.isOwn ? " is-own" : ""}`}
                  aria-current={row.isOwn ? "true" : undefined}
                >
                  <span className="nl-arena-briefing-row-rank nl-tnum">{row.rank}</span>
                  <span className="nl-arena-briefing-row-name">{row.teamName}</span>
                  <span className="nl-arena-briefing-row-code">{row.teamCode}</span>
                </li>
              ))}
            </ol>
          </div>
        </NlCard>
      ) : null}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {loadState === "ready"
          ? `Phase ${Math.min(phaseIndex + 1, MATCHDAY_ARENA_PHASES.length)} von ${MATCHDAY_ARENA_PHASES.length}: ${
              MATCHDAY_ARENA_PHASES.find((phase) => phase.id === activePhase)?.label ?? "Slots"
            }${boardRows[0] ? ` — Führung: ${teamById.get(boardRows[0].teamId)?.name ?? boardRows[0].teamId}` : ""}`
          : ""}
      </div>

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
      ) : !hasScoredRows ? (
        <>
          <NlCard
            className="nl-arena-board-card nl-arena-prerace-card"
            title={`Slots-Phase — ${matchdayMeta?.label ?? scoreFeed?.targetMatchday.label ?? "Spieltag"}`}
            eyebrow="Der Spieltag ist noch nicht gelaufen — Aufstellung zählt"
            actions={
              props.onOpenMatchdayResult ? (
                <button
                  className="nl-arena-button"
                  type="button"
                  disabled
                  title="Wird nach dem Spieltag freigeschaltet"
                >
                  Ergebnis
                </button>
              ) : null
            }
          >
            {renderPreRaceBoard()}
          </NlCard>

          {renderDiagnose(false, totalTeamsCount)}
        </>
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
              <div className={`nl-arena-side-tabs${arenaControlsLocked ? " is-locked" : ""}`}>
                <NlSubTabs
                  items={sideItems}
                  activeId={boardSide}
                  onSelect={(id) => {
                    // Guests never free-jump the discipline tab while the host
                    // controls the shared reveal — "Gesamt" shows the fully
                    // resolved board and would spoil the co-op reveal outright.
                    // The host can still browse freely, exactly like solo.
                    if (arenaControlsLocked) {
                      return;
                    }
                    setBoardSide(id as ArenaNewLookBoardSide);
                  }}
                  aria-label="Disziplin wählen"
                />
              </div>
            }
          >
            {isRoomRevealSyncActive ? (
              <p className="nl-arena-coop-note" data-testid="nl-arena-coop-note">
                {arenaCoopReadyGateActive
                  ? "Der gemeinsame Reveal startet, sobald beide Coaches bereit sind."
                  : roomRevealWaitingForHost
                    ? "Warte auf Host-Start."
                    : isRoomHost
                      ? "Du steuerst den Reveal für alle."
                      : "Der Host steuert den Reveal."}
              </p>
            ) : null}
            {boardSide !== "total" ? (
              <>
                <div className={`nl-arena-phase-controls${arenaControlsLocked ? " is-locked" : ""}`}>
                  <button
                    className="nl-arena-button"
                    type="button"
                    disabled={phaseIndex <= 0 || arenaControlsLocked}
                    title="Eine Phase zurück"
                    onClick={() => {
                      if (arenaControlsLocked) {
                        return;
                      }
                      setIsAutoPlaying(false);
                      setPhaseIndex((index) => Math.max(0, index - 1));
                    }}
                  >
                    Zurück
                  </button>
                  {/* De-Dup: die eigenständige Phasen-Tab-Leiste (NlSubTabs) war ein
                      Near-1:1-Duplikat der "Dein Lauf"-Schiene unten, die zusätzlich
                      den eigenen Rang trägt. Phasen-Navigation läuft weiter über
                      Zurück/Weiter (+ "Dein Lauf"-Schritte). */}
                  <button
                    className="nl-arena-button"
                    type="button"
                    disabled={(phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1 && !isRoomRevealSyncActive) || arenaControlsLocked}
                    title="Eine Phase weiter"
                    onClick={() => {
                      if (arenaControlsLocked) {
                        return;
                      }
                      setIsAutoPlaying(false);
                      if (isRoomRevealSyncActive && isRoomHost) {
                        handleHostRoomArenaAdvance();
                        return;
                      }
                      setPhaseIndex((index) => Math.min(MATCHDAY_ARENA_PHASES.length - 1, index + 1));
                    }}
                  >
                    Weiter
                  </button>
                  <button
                    className="nl-arena-button is-primary nl-arena-autoplay-toggle"
                    type="button"
                    aria-pressed={isAutoPlaying}
                    disabled={arenaControlsLocked}
                    title={
                      isAutoPlaying
                        ? "Reveal-Show pausieren"
                        : phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1
                          ? "Reveal-Show von vorn abspielen"
                          : "Reveal-Phasen automatisch durchschalten (Auflösungs-Show)"
                    }
                    onClick={() => {
                      if (arenaControlsLocked) {
                        return;
                      }
                      if (isAutoPlaying) {
                        setIsAutoPlaying(false);
                        return;
                      }
                      // Reduced Motion: keine getaktete Show — direkt zum Ergebnis.
                      const reduceMotion =
                        typeof window !== "undefined" &&
                        typeof window.matchMedia === "function" &&
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                      if (reduceMotion) {
                        setExpandedTeamId(null);
                        setPhaseIndex(MATCHDAY_ARENA_PHASES.length - 1);
                        return;
                      }
                      if (phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1) {
                        setExpandedTeamId(null);
                        setPhaseIndex(0);
                      }
                      setIsAutoPlaying(true);
                    }}
                  >
                    {isAutoPlaying ? "❚❚ Pause" : phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1 ? "↺ Replay" : "▶ Play"}
                  </button>
                  <button
                    className="nl-arena-button"
                    type="button"
                    // No host-synced equivalent exists for this shortcut (it
                    // jumps straight to the result without going through the
                    // authoritative step-by-step advance), so it stays off in
                    // any Room — host included — to avoid a silent desync.
                    disabled={phaseIndex >= MATCHDAY_ARENA_PHASES.length - 1 || isRoomRevealSyncActive}
                    title={
                      isRoomRevealSyncActive
                        ? "Im gemeinsamen Reveal nicht verfügbar — nur Schritt für Schritt"
                        : "Show überspringen — direkt zur Ergebnis-Phase"
                    }
                    onClick={() => {
                      if (isRoomRevealSyncActive) {
                        return;
                      }
                      setIsAutoPlaying(false);
                      setPhaseIndex(MATCHDAY_ARENA_PHASES.length - 1);
                    }}
                  >
                    Überspringen ⏭
                  </button>
                  <button
                    className="nl-arena-button nl-arena-speed"
                    type="button"
                    title={`Reveal-Tempo: ${NL_ARENA_SPEED_OPTIONS[speedIndex]?.label ?? "1×"} — klicken zum Wechseln`}
                    onClick={() => setSpeedIndex((index) => (index + 1) % NL_ARENA_SPEED_OPTIONS.length)}
                  >
                    <span className="nl-arena-speed-label">Tempo</span>
                    <span className="nl-tnum">{NL_ARENA_SPEED_OPTIONS[speedIndex]?.label ?? "1×"}</span>
                  </button>
                </div>
                {stageInfo ? (
                  <div className="nl-arena-stage" key={`nl-arena-stage-${boardSide}-${activePhase}`}>
                    <div className="nl-arena-stage-copy">
                      <span className="nl-arena-stage-count nl-tnum">
                        Phase {phaseIndex + 1}/{MATCHDAY_ARENA_PHASES.length}
                      </span>
                      <strong className="nl-arena-stage-title">
                        {MATCHDAY_ARENA_PHASES.find((phase) => phase.id === activePhase)?.label ?? "Slots"}
                      </strong>
                      <span className="nl-arena-stage-desc">{NL_ARENA_PHASE_DESCRIPTIONS[activePhase]}</span>
                    </div>
                    <div className="nl-arena-stage-chips">
                      {stageInfo.topGain ? (
                        <button
                          type="button"
                          className="nl-arena-stage-chip is-good"
                          onClick={() => scrollToTeam(stageInfo.topGain!.teamId)}
                          title={`${stageInfo.topGain.teamName} im Board anzeigen — ${stageInfo.gainers} Team(s) legen in dieser Phase zu`}
                        >
                          <span className="nl-arena-stage-chip-label">Stärkster Schub</span>
                          <span className="nl-arena-stage-chip-team">{stageInfo.topGain.teamName}</span>
                          <span className="nl-arena-stage-chip-value nl-tnum">
                            {formatSignedNlDelta(stageInfo.topGain.value)}
                          </span>
                        </button>
                      ) : null}
                      {stageInfo.topLoss ? (
                        <button
                          type="button"
                          className="nl-arena-stage-chip is-risk"
                          onClick={() => scrollToTeam(stageInfo.topLoss!.teamId)}
                          title={`${stageInfo.topLoss.teamName} im Board anzeigen — ${stageInfo.losers} Team(s) verlieren in dieser Phase`}
                        >
                          <span className="nl-arena-stage-chip-label">Härtester Dämpfer</span>
                          <span className="nl-arena-stage-chip-team">{stageInfo.topLoss.teamName}</span>
                          <span className="nl-arena-stage-chip-value nl-tnum">
                            {formatSignedNlDelta(stageInfo.topLoss.value)}
                          </span>
                        </button>
                      ) : null}
                      {stageInfo.climber ? (
                        <button
                          type="button"
                          className="nl-arena-stage-chip is-accent"
                          onClick={() => scrollToTeam(stageInfo.climber!.teamId)}
                          title={`${stageInfo.climber.teamName} im Board anzeigen — größter Rang-Sprung dieser Phase`}
                        >
                          <span className="nl-arena-stage-chip-label">Kletterer</span>
                          <span className="nl-arena-stage-chip-team">{stageInfo.climber.teamName}</span>
                          <span className="nl-arena-stage-chip-value nl-tnum">+{stageInfo.climber.value} Ränge</span>
                        </button>
                      ) : null}
                      {!stageInfo.topGain && !stageInfo.topLoss && !stageInfo.climber && stageInfo.leader ? (
                        <button
                          type="button"
                          className="nl-arena-stage-chip is-accent"
                          onClick={() => scrollToTeam(stageInfo.leader!.teamId)}
                          title={`${stageInfo.leader.teamName} im Board anzeigen`}
                        >
                          <span className="nl-arena-stage-chip-label">Führt das Board an</span>
                          <span className="nl-arena-stage-chip-team">{stageInfo.leader.teamName}</span>
                          <span className="nl-arena-stage-chip-value nl-tnum">
                            {formatNlNumber(stageInfo.leader.value, 1)}
                          </span>
                        </button>
                      ) : null}
                      {stageInfo.ownDelta != null && ownTeamName ? (
                        <button
                          type="button"
                          className={`nl-arena-stage-chip is-own${stageInfo.ownDelta > 0 ? " is-good" : stageInfo.ownDelta < 0 ? " is-risk" : ""}`}
                          onClick={scrollToOwnTeam}
                          title={`${ownTeamName} im Board anzeigen`}
                        >
                          <span className="nl-arena-stage-chip-label">Dein Team</span>
                          <span className="nl-arena-stage-chip-team">{ownTeamName}</span>
                          <span className="nl-arena-stage-chip-value nl-tnum">
                            {formatSignedNlDelta(stageInfo.ownDelta)}
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {ownRun.length > 0 && ownTeamName ? (
                  <div className="nl-arena-run" role="group" aria-label={`Dein Lauf — ${ownTeamName}`}>
                    <span className="nl-arena-run-label">
                      Dein Lauf
                      <span className="nl-arena-run-team">{ownTeamName}</span>
                    </span>
                    <ol className="nl-arena-run-steps">
                      {ownRun.map((step, index) => {
                        const revealed = index <= phaseIndex;
                        const previousRank = index > 0 ? (ownRun[index - 1]?.rank ?? null) : null;
                        const stepDelta = revealed ? getArenaStepRankDelta(step.rank, previousRank) : null;
                        const trendClass =
                          stepDelta != null && stepDelta !== 0 ? (stepDelta > 0 ? " is-up" : " is-down") : "";
                        return (
                          <li key={step.id} className="nl-arena-run-item">
                            <button
                              type="button"
                              className={`nl-arena-run-step${index === phaseIndex ? " is-current" : ""}${revealed ? " is-revealed" : ""}${trendClass}`}
                              onClick={() => {
                                setIsAutoPlaying(false);
                                setPhaseIndex(index);
                              }}
                              title={
                                revealed && step.rank != null
                                  ? `${step.label}: Rang ${step.rank}${stepDelta != null && stepDelta !== 0 ? ` (${stepDelta > 0 ? "+" : ""}${stepDelta} gegenüber der Phase davor)` : ""}`
                                  : `${step.label}: noch verdeckt — Phase anspringen`
                              }
                            >
                              <span className="nl-arena-run-phase">{step.label}</span>
                              <span className="nl-arena-run-rank nl-tnum">
                                {revealed && step.rank != null ? `#${step.rank}` : "·"}
                              </span>
                              <span className="nl-arena-run-trend" aria-hidden="true">
                                {stepDelta != null && stepDelta !== 0 ? (stepDelta > 0 ? "▲" : "▼") : " "}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                    {/* Feature 2: Momentum-Sparkline des eigenen Rangs über die schon
                        enthüllten Phasen — ergänzt die Schiene, Labels & Klick-zum-
                        Springen bleiben erhalten. Oben = besserer Rang (invertiert). */}
                    {ownRunSparkPoints.length >= 2 ? (
                      <NlSparkline
                        points={ownRunSparkPoints}
                        tone="accent"
                        className="nl-arena-run-spark"
                        aria-label="Verlauf deines Rangs über die enthüllten Phasen (oben = besser)"
                      />
                    ) : null}
                  </div>
                ) : null}
                {/* Feature 1: Erwartung vs. Ergebnis — nur in der Ergebnis-Phase
                    (spoilerfrei). Zeigt Start-Rang (baseRank) → End-Rang des
                    eigenen Teams samt Rang-Delta und zwei Vergleichs-Bars. */}
                {isResultPhase && ownExpectation ? (
                  <div
                    className="nl-arena-expect"
                    role="group"
                    aria-label={`Erwartung gegen Ergebnis — ${ownExpectation.teamName}`}
                  >
                    <div className="nl-arena-expect-head">
                      <span className="nl-arena-expect-eyebrow">Erwartung vs. Ergebnis</span>
                      <span className="nl-arena-expect-team">{ownExpectation.teamName}</span>
                    </div>
                    <div className="nl-arena-expect-versus">
                      <span
                        className="nl-arena-expect-rank nl-tnum"
                        title="Start-Rang nach der reinen Basiswertung (vor allen Modifikatoren)"
                      >
                        Start <strong>#{ownExpectation.baseRank}</strong>
                      </span>
                      <span className="nl-arena-expect-arrow" aria-hidden="true">
                        →
                      </span>
                      <span
                        className="nl-arena-expect-rank is-final nl-tnum"
                        title="End-Rang in dieser Disziplin"
                      >
                        Ziel <strong>#{ownExpectation.finalRank}</strong>
                      </span>
                      <NlDeltaChip
                        value={ownExpectation.rankDelta}
                        format={(n) =>
                          `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)} ${Math.abs(n) === 1 ? "Rang" : "Ränge"}`
                        }
                        title="Rang-Bewegung vom Start- zum End-Rang (positiv = geklettert)"
                      />
                    </div>
                    {/* Vergleichs-Bars: Füllgrad = besserer Rang voller
                        (total − rank + 1), damit der Sprung sichtbar wird. */}
                    <div className="nl-arena-expect-bars">
                      <NlProgressBar
                        label={`Start #${ownExpectation.baseRank}`}
                        value={ownExpectation.total - ownExpectation.baseRank + 1}
                        max={ownExpectation.total}
                        tone="neutral"
                        showValue={false}
                        title={`Start-Rang ${ownExpectation.baseRank} von ${ownExpectation.total}`}
                      />
                      <NlProgressBar
                        label={`Ziel #${ownExpectation.finalRank}`}
                        value={ownExpectation.total - ownExpectation.finalRank + 1}
                        max={ownExpectation.total}
                        tone={
                          ownExpectation.rankDelta > 0
                            ? "good"
                            : ownExpectation.rankDelta < 0
                              ? "risk"
                              : "accent"
                        }
                        showValue={false}
                        title={`End-Rang ${ownExpectation.finalRank} von ${ownExpectation.total}`}
                      />
                    </div>
                    {/* Phase 3 (Teilen): Kopier-Affordance für den Ergebnis-Recap.
                        Klartext-Only (kein Bild/Canvas); bei Erfolg "kopiert ✓",
                        bei Fehlschlag markierbarer Fallback-Text zum manuellen Kopieren. */}
                    {ownRecap ? (
                      <div className="nl-arena-share" role="group" aria-label="Spieltag-Recap teilen">
                        <button
                          type="button"
                          className="nl-arena-button nl-arena-share-btn"
                          data-testid="nl-arena-share"
                          aria-live="polite"
                          title="Spieltag-Recap als Text in die Zwischenablage kopieren"
                          onClick={() => void handleCopyRecap(ownRecap)}
                        >
                          {recapCopyState === "copied"
                            ? "kopiert ✓"
                            : recapCopyState === "error"
                              ? "Kopieren fehlgeschlagen"
                              : "Teilen · Kopieren"}
                        </button>
                        {recapCopyState === "error" ? (
                          <span className="nl-arena-share-fallback">
                            Text markieren und kopieren:{" "}
                            <span className="nl-arena-share-fallback-text">{ownRecap}</span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {/* Feature 3: Head-to-Head-Duell — eigenes Team gegen den direkten
                    Rang-Nachbarn, zwei gegenläufige Vergleichs-Bars (F1-Timing-Tower)
                    plus Score-/Rang-Abstand als Chips. Aktualisiert je Phase. */}
                {duel ? (
                  <div
                    className="nl-arena-duel"
                    role="group"
                    aria-label={`Duell — ${duel.own.teamName} gegen ${duel.neighbor.teamName}`}
                  >
                    <div className="nl-arena-duel-head">
                      <span className="nl-arena-duel-eyebrow">
                        {duel.neighborIsAhead ? "Duell um den Platz davor" : "Duell mit dem Verfolger"}
                      </span>
                      <StatChipRow aria-label="Abstand zum Rang-Nachbarn">
                        <StatChip
                          label="Rang-Abstand"
                          value={`#${duel.ownRank} · #${duel.neighborRank}`}
                          tone="accent"
                          title="Dein Rang gegenüber dem Rang des Nachbarn in dieser Phase"
                        />
                        <StatChip
                          label="Score-Lücke"
                          value={formatSignedNlDelta(duel.scoreGap)}
                          tone={duel.scoreGap > 0 ? "good" : duel.scoreGap < 0 ? "risk" : "neutral"}
                          title="Dein Score minus Score des Nachbarn (aktuelle Phase)"
                        />
                      </StatChipRow>
                    </div>
                    <div className="nl-arena-duel-bars">
                      <button
                        type="button"
                        className="nl-arena-duel-side is-own"
                        onClick={() => scrollToTeam(duel.own.teamId)}
                        title={`${duel.own.teamName} im Board anzeigen`}
                      >
                        <span className="nl-arena-duel-side-name">
                          <span className="nl-arena-duel-side-rank nl-tnum">#{duel.ownRank}</span>
                          {duel.own.teamName}
                          <span className="nl-arena-duel-side-badge">Du</span>
                        </span>
                        <NlProgressBar
                          value={Math.max(0, duel.ownScore)}
                          max={Math.max(maxPhaseScore, duel.ownScore, duel.neighborScore, 1)}
                          tone="accent"
                          showValue={false}
                          format={(value) => formatNlNumber(value, 1)}
                          title={`${duel.own.teamName}: ${formatNlNumber(duel.ownScore, 1)}`}
                        />
                        <span className="nl-arena-duel-side-score nl-tnum">
                          {formatNlNumber(duel.ownScore, 1)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="nl-arena-duel-side is-rival"
                        onClick={() => scrollToTeam(duel.neighbor.teamId)}
                        title={`${duel.neighbor.teamName} im Board anzeigen`}
                      >
                        <span className="nl-arena-duel-side-name">
                          <span className="nl-arena-duel-side-rank nl-tnum">#{duel.neighborRank}</span>
                          {duel.neighbor.teamName}
                        </span>
                        <NlProgressBar
                          value={Math.max(0, duel.neighborScore)}
                          max={Math.max(maxPhaseScore, duel.ownScore, duel.neighborScore, 1)}
                          tone="neutral"
                          showValue={false}
                          format={(value) => formatNlNumber(value, 1)}
                          title={`${duel.neighbor.teamName}: ${formatNlNumber(duel.neighborScore, 1)}`}
                        />
                        <span className="nl-arena-duel-side-score nl-tnum">
                          {formatNlNumber(duel.neighborScore, 1)}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : null}
                {/* Feature 2: Schlüsselmomente — persistenter, scrollbarer Ticker.
                    Sammelt die Bühnen-Spotlights aller enthüllten Phasen (neueste
                    oben); jeder Eintrag springt per scrollToTeam ins Board. */}
                {keyMoments.length > 0 ? (
                  <div
                    className="nl-arena-ticker"
                    role="group"
                    aria-label="Schlüsselmomente der enthüllten Phasen"
                  >
                    <div className="nl-arena-ticker-head">
                      <span className="nl-arena-ticker-title">Schlüsselmomente</span>
                      <span className="nl-arena-ticker-count nl-tnum">{keyMoments.length}</span>
                    </div>
                    <ol className="nl-arena-ticker-list">
                      {[...keyMoments].reverse().map((moment) => {
                        const toneClass =
                          moment.kind === "gain"
                            ? " is-good"
                            : moment.kind === "loss"
                              ? " is-risk"
                              : " is-accent";
                        const kindLabel =
                          moment.kind === "gain"
                            ? "Schub"
                            : moment.kind === "loss"
                              ? "Dämpfer"
                              : "Kletterer";
                        const valueText =
                          moment.kind === "climb"
                            ? `+${moment.value} ${moment.value === 1 ? "Rang" : "Ränge"}`
                            : formatSignedNlDelta(moment.value);
                        return (
                          <li key={moment.key} className="nl-arena-ticker-item">
                            <button
                              type="button"
                              className={`nl-arena-ticker-entry${toneClass}`}
                              onClick={() => scrollToTeam(moment.teamId)}
                              title={`${moment.teamName} im Board anzeigen — ${moment.phaseLabel}: ${kindLabel}`}
                            >
                              <span className="nl-arena-ticker-phase">{moment.phaseLabel}</span>
                              <span className="nl-arena-ticker-kind">{kindLabel}</span>
                              <span className="nl-arena-ticker-team">{moment.teamName}</span>
                              <span className="nl-arena-ticker-value nl-tnum">{valueText}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ) : null}
              </>
            ) : null}
            {/* De-Dup: im Disziplin-Board übernimmt der "Dein Team"-Bühnen-Chip den
                Sprung zum eigenen Team; der Owncall-Button bleibt daher nur für das
                Gesamt-Board (dort gibt es keinen Bühnen-Chip). */}
            {boardSide === "total" && ownTeamRank != null && ownTeamName ? (
              <div className="nl-arena-owncall">
                <button type="button" className="nl-arena-owncall-btn" onClick={scrollToOwnTeam}>
                  Zu meinem Team · {ownTeamName}
                  <span className="nl-arena-owncall-rank nl-tnum">#{ownTeamRank}</span>
                </button>
              </div>
            ) : null}
            {boardSide === "total" ? (
              totalRows.length === 0 ? (
                <p className="nl-arena-empty-text">
                  Für diesen Spieltag liegen noch keine Wertungen vor — die Show startet, sobald der Spieltag
                  aufgelöst ist.
                </p>
              ) : (
                renderTotalBoard()
              )
            ) : boardRows.length === 0 ? (
              <p className="nl-arena-empty-text">
                Für diese Disziplin liegen noch keine Wertungen vor — die Show startet, sobald der Spieltag aufgelöst
                ist.
              </p>
            ) : (
              renderDisciplineBoard()
            )}
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

          {renderDiagnose(true, 0)}
        </>
      )}
    </div>
  );
}
