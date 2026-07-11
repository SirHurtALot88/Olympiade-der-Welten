"use client";

import { useMemo, useRef, useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlMedalBadge,
  NlProgressBar,
  NlRadar,
  NlSparkline,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
  type NlAxisKey,
} from "@/components/foundation/new-look";
import type { TeamDetailDrawerData } from "@/app/foundation/TeamDetailDrawer";
import { getSeasonV2TeamTagStyle } from "@/app/foundation/season-v2/SeasonStandingsV2Client";
import { getClassColorClassName } from "@/app/foundation/classVisuals";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import { formatContractShapeShortLabel } from "@/lib/foundation/player-economy-contract";
import { formatPlayerIdentitySubMeta } from "@/lib/foundation/player-identity-meta";
import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import { getTeamAxisRankTooltip } from "@/lib/foundation/tabs/teams-ui-helpers";
import type { TeamsViewRow } from "@/lib/foundation/tabs/teams-view-derivations";
import type {
  TeamRosterFocusMode,
  TeamRosterRoleFilter,
} from "@/lib/foundation/tabs/use-teams-roster-table-derivations";

/**
 * "Neuer Look" Teams-Ansicht (flag-gated, additiv).
 *
 * Wird ausschließlich aus `FoundationTeamsViewHost` gerendert, wenn der
 * Runtime-Flag (`useNewLook`) aktiv ist UND der Team-Sub-Tab "roster" oder
 * "portraits" gewählt ist — Verträge/Transfer sowie Flag-aus laufen
 * unverändert über `FoundationTeamsDetailPanel`. Konsumiert nur Daten, die
 * der Host ohnehin schon ableitet (TeamsViewRows inkl. Bereichs-Ränge,
 * gefilterte Kaderzeilen, Economy-Helper, Open-Handler).
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten gibt:
 * - keine Formkurve/kein Trend pro Spieltag (existiert nicht im Modell),
 * - keine erfundenen Team-Gesamtwerte — Bereichs-RÄNGE (`currentPowRank` …)
 *   und Bereichs-PUNKTE (`ppsPow` …) sind die einzigen echten Achsen-Werte.
 *
 * Team-Entwicklung über Saisons: der Host reicht die bereits berechnete
 * `selectedTeamsHistoryData` (Live-Saison + echte Season-Snapshots) durch —
 * daraus speisen sich Saison-Verlauf (Rang/Punkte/MW) und die
 * Vorsaison-Delta-Chips im Hero. Pro Teamtabellen-Zeile liefern
 * `historicalPointsBySeason` (Punkte + Rang je Saison) und die aktuellen
 * Bereichs-Ränge die Hover-Karte (Mini-Radar + Saison-Sparkline).
 */

type NlTeamsRosterMode = "portraits" | "tabelle";

export type NlTeamsRosterRow = {
  entry: {
    id: string;
    roleTag?: string | null;
    contractLength: number;
    contractShape?: "balanced" | "front_loaded" | "back_loaded" | null;
    salary?: number | null;
  };
  player: {
    id: string;
    name: string;
    className: string;
    race?: string | null;
    subclasses?: string[] | null;
    coreStats: { pow: number | null; spe: number | null; men: number | null; soc: number | null };
  };
  playerOvr: number | null;
  playerMvs: number | null;
  playerPps: number | null;
  ovrRank?: number | null;
  mvsRank?: number | null;
  ppsRank?: number | null;
};

export type NlTeamsFilterOption<TId extends string> = {
  id: TId;
  label: string;
  count: number;
};

type NlTeamsPortraitModel = {
  src: string | null;
  thumbSrc?: string | null;
  previewSrc?: string | null;
  initials: string;
};

export type FoundationTeamsNewLookProps = {
  selectedTeam: Team;
  gameState: GameState;
  /**
   * Aktiver Team-Unterreiter aus dem Host: "portraits" öffnet standardmäßig
   * das Portrait-Grid, "roster" (Kader) die Datentabelle. Steuert nur die
   * Standard-Ansicht — der In-Card-Umschalter bleibt nutzbar.
   */
  selectedTeamDetailTab: "roster" | "portraits";
  sortedTeamsViewRows: TeamsViewRow[];
  /**
   * Vom Host bereits berechnete Team-Historie (Live-Saison + echte
   * Season-Snapshots) — Basis für Saison-Verlauf und Vorsaison-Deltas.
   * `null`, solange die Ableitung (Hydration) noch nicht gebaut wurde.
   */
  selectedTeamsHistoryData: TeamDetailDrawerData | null;
  filteredSelectedRosterTableRows: NlTeamsRosterRow[];
  teamRosterRoleFilter: TeamRosterRoleFilter;
  setTeamRosterRoleFilter: (value: TeamRosterRoleFilter) => void;
  teamRosterRoleFilterOptions: Array<NlTeamsFilterOption<TeamRosterRoleFilter>>;
  teamRosterFocusMode: TeamRosterFocusMode;
  setTeamRosterFocusMode: (value: TeamRosterFocusMode) => void;
  teamRosterFocusOptions: Array<NlTeamsFilterOption<TeamRosterFocusMode>>;
  leaguePlayerHeatPools: LeaguePlayerHeatPools;
  openTeamProfileById: (teamId: string) => void;
  openPlayerDrawerById: (playerId: string, activePlayerId?: string) => void | Promise<void>;
  scheduleActiveManagerTeam: (teamId: string, reason: string) => void;
  getPlayerPortraitModel: (player: NlTeamsRosterRow["player"]) => NlTeamsPortraitModel;
  getRosterEntryDisplayMarketValue: (
    entry: NlTeamsRosterRow["entry"],
    player: NlTeamsRosterRow["player"],
  ) => number | null;
  getRosterEntryDisplaySalary: (
    entry: NlTeamsRosterRow["entry"],
    player: NlTeamsRosterRow["player"],
  ) => number | null;
  getRosterEntryCurrentSeasonSalary: (
    entry: NlTeamsRosterRow["entry"],
    player: NlTeamsRosterRow["player"],
  ) => number | null;
  getPlayerDisplayMarketValueDelta: (
    player: NlTeamsRosterRow["player"],
    entry: NlTeamsRosterRow["entry"],
    gameState: GameState,
  ) => number | null;
  getRosterEntrySalaryDelta: (
    entry: NlTeamsRosterRow["entry"],
    player: NlTeamsRosterRow["player"],
    gameState: GameState,
  ) => number | null;
  formatMoney: (value: number) => string;
  formatDisplayMoney: (value: number | null | undefined) => string;
  selectedTeamRosterActionsAvailable: boolean;
  selectedTeamRosterActionHint: string | null;
  marketSellBusy: boolean;
  contractRenewalBusy: string | null;
  openMarketSellModal: (
    payload: {
      activePlayerId: string;
      playerId: string;
      playerName: string;
      className: string;
      race: string;
      portraitUrl: string | null;
    },
    teamId?: string,
  ) => void | Promise<unknown>;
  openContractRenewalNegotiation: (payload: {
    teamId: string;
    playerId: string;
    playerName: string;
    contractLength: number;
  }) => void | Promise<unknown>;
  /**
   * Öffnet die Saisonstand-Seite (seasonV2). Portal-Ziel der Rang-Kachel.
   * Optional: fehlt der Handler, bleibt die Rang-Kachel beim Team-Profil.
   */
  onOpenSeason?: () => void;
};

const NL_TEAMS_ROSTER_MODE_ITEMS: Array<{ id: NlTeamsRosterMode; label: string }> = [
  { id: "portraits", label: "Portraits" },
  { id: "tabelle", label: "Tabelle" },
];

/**
 * Standard-Ansicht je Unterreiter: der "Portraits"-Reiter startet im
 * bild-fokussierten Portrait-Grid, der "Kader"-Reiter (roster) in der
 * datenkompetenten Tabelle. So sind die beiden Reiter klar unterscheidbar.
 */
function defaultRosterModeForTab(tab: "roster" | "portraits"): NlTeamsRosterMode {
  return tab === "portraits" ? "portraits" : "tabelle";
}

const NL_TEAMS_AXES: Array<{ key: NlAxisKey; label: "POW" | "SPE" | "MEN" | "SOC" }> = [
  { key: "pow", label: "POW" },
  { key: "spe", label: "SPE" },
  { key: "men", label: "MEN" },
  { key: "soc", label: "SOC" },
];

function getAxisRank(row: TeamsViewRow | null, key: NlAxisKey): number | null {
  if (!row) {
    return null;
  }
  if (key === "pow") return row.currentPowRank;
  if (key === "spe") return row.currentSpeRank;
  if (key === "men") return row.currentMenRank;
  return row.currentSocRank;
}

function getAxisPoints(row: TeamsViewRow | null, key: NlAxisKey): number | null {
  if (!row) {
    return null;
  }
  if (key === "pow") return row.ppsPow;
  if (key === "spe") return row.ppsSpe;
  if (key === "men") return row.ppsMen;
  return row.ppsSoc;
}

function getBoardRank(row: TeamsViewRow): number | null {
  return row.overallRank ?? row.rank;
}

type NlTeamsBoardSortKey =
  | "rank"
  | "points"
  | "cash"
  | "mw"
  | "salary"
  | "roster"
  | "medals"
  | NlAxisKey;

type NlTeamsBoardSortDir = "asc" | "desc";

type NlTeamsBoardSort = { key: NlTeamsBoardSortKey; dir: NlTeamsBoardSortDir };

const NL_TEAMS_BOARD_SORTS: Array<{
  key: Exclude<NlTeamsBoardSortKey, NlAxisKey>;
  label: string;
  defaultDir: NlTeamsBoardSortDir;
  title: string;
}> = [
  { key: "rank", label: "Rang", defaultDir: "asc", title: "Nach Gesamtrang sortieren" },
  { key: "points", label: "Punkte", defaultDir: "desc", title: "Nach Saisonpunkten sortieren" },
  { key: "cash", label: "Cash", defaultDir: "desc", title: "Nach Cash sortieren" },
  { key: "mw", label: "MW", defaultDir: "desc", title: "Nach Team-Marktwert sortieren" },
  { key: "salary", label: "Gehalt", defaultDir: "desc", title: "Nach Gehaltsblock sortieren" },
  { key: "roster", label: "Kader", defaultDir: "desc", title: "Nach Kadergröße sortieren" },
  { key: "medals", label: "Medaillen", defaultDir: "desc", title: "Nach Gold/Silber/Bronze sortieren" },
];

function isNlAxisSortKey(key: NlTeamsBoardSortKey): key is NlAxisKey {
  return key === "pow" || key === "spe" || key === "men" || key === "soc";
}

function getBoardSortValue(row: TeamsViewRow, key: NlTeamsBoardSortKey): number | null {
  if (isNlAxisSortKey(key)) {
    return getAxisRank(row, key);
  }
  switch (key) {
    case "rank":
      return getBoardRank(row);
    case "points":
      return row.points;
    case "cash":
      return row.cash;
    case "mw":
      return row.marketValueTotal;
    case "salary":
      return row.salaryTotal;
    case "roster":
      return row.rosterCount;
    case "medals":
      return row.goldCount * 1_000_000 + row.silverCount * 1_000 + row.bronzeCount;
    default:
      return null;
  }
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/** "Saison 3" → "S3"; ohne Ziffer bleibt ein kurzer Prefix. */
function formatNlSeasonShortLabel(seasonName: string, seasonId: string): string {
  const source = seasonName || seasonId;
  const match = source.match(/(\d+)/);
  return match ? `S${match[1]}` : source.slice(0, 6);
}

function formatSignedNlNumber(value: number, digits: number): string {
  return `${value > 0 ? "+" : ""}${formatNlNumber(value, digits)}`;
}

function compareBoardRows(left: TeamsViewRow, right: TeamsViewRow): number {
  const leftRank = getBoardRank(left) ?? Number.POSITIVE_INFINITY;
  const rightRank = getBoardRank(right) ?? Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  const pointsDelta = (right.points ?? Number.NEGATIVE_INFINITY) - (left.points ?? Number.NEGATIVE_INFINITY);
  if (pointsDelta !== 0) {
    return pointsDelta;
  }
  return left.teamName.localeCompare(right.teamName, "de-DE");
}

export default function FoundationTeamsNewLook({
  selectedTeam,
  gameState,
  selectedTeamDetailTab,
  sortedTeamsViewRows,
  selectedTeamsHistoryData,
  filteredSelectedRosterTableRows,
  teamRosterRoleFilter,
  setTeamRosterRoleFilter,
  teamRosterRoleFilterOptions,
  teamRosterFocusMode,
  setTeamRosterFocusMode,
  teamRosterFocusOptions,
  leaguePlayerHeatPools,
  openTeamProfileById,
  openPlayerDrawerById,
  scheduleActiveManagerTeam,
  getPlayerPortraitModel,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntryCurrentSeasonSalary,
  getPlayerDisplayMarketValueDelta,
  getRosterEntrySalaryDelta,
  formatMoney,
  formatDisplayMoney,
  selectedTeamRosterActionsAvailable,
  selectedTeamRosterActionHint,
  marketSellBusy,
  contractRenewalBusy,
  openMarketSellModal,
  openContractRenewalNegotiation,
  onOpenSeason,
}: FoundationTeamsNewLookProps) {
  const [rosterMode, setRosterMode] = useState<NlTeamsRosterMode>(() =>
    defaultRosterModeForTab(selectedTeamDetailTab),
  );
  // Wechselt der Host-Unterreiter (Kader ↔ Portraits), ohne dass die
  // Komponente neu mountet, die Standard-Ansicht angleichen — React-Muster
  // „State beim Prop-Wechsel während des Renderns anpassen" (kein Effekt).
  const [syncedRosterTab, setSyncedRosterTab] = useState<"roster" | "portraits">(selectedTeamDetailTab);
  if (syncedRosterTab !== selectedTeamDetailTab) {
    setSyncedRosterTab(selectedTeamDetailTab);
    setRosterMode(defaultRosterModeForTab(selectedTeamDetailTab));
  }
  const [boardSort, setBoardSort] = useState<NlTeamsBoardSort>({ key: "rank", dir: "asc" });
  const [hoveredBoardTeamId, setHoveredBoardTeamId] = useState<string | null>(null);

  const heroCardRef = useRef<HTMLDivElement | null>(null);
  const developmentCardRef = useRef<HTMLDivElement | null>(null);
  const rosterCardRef = useRef<HTMLDivElement | null>(null);
  const leagueCardRef = useRef<HTMLDivElement | null>(null);

  const teamCount = gameState.teams.length;
  const heroRow = useMemo(
    () => sortedTeamsViewRows.find((row) => row.team.teamId === selectedTeam.teamId) ?? null,
    [selectedTeam.teamId, sortedTeamsViewRows],
  );

  const boardRows = useMemo(() => {
    const base = [...sortedTeamsViewRows].sort(compareBoardRows);
    if (boardSort.key === "rank" && boardSort.dir === "asc") {
      return base;
    }
    const factor = boardSort.dir === "asc" ? 1 : -1;
    return base.sort((left, right) => {
      const leftValue = getBoardSortValue(left, boardSort.key);
      const rightValue = getBoardSortValue(right, boardSort.key);
      if (leftValue == null && rightValue == null) {
        return compareBoardRows(left, right);
      }
      if (leftValue == null) {
        return 1;
      }
      if (rightValue == null) {
        return -1;
      }
      if (leftValue !== rightValue) {
        return (leftValue - rightValue) * factor;
      }
      return compareBoardRows(left, right);
    });
  }, [boardSort, sortedTeamsViewRows]);

  // Mini-Tabellen-Vorschau der Rang-Kachel: echte Nachbar-Zeilen um das
  // eigene Team herum (Rang · Team · Punkte), immer nach Gesamtrang geordnet
  // — unabhängig von der aktuellen Board-Sortierung.
  const rankPreviewRows = useMemo(() => {
    const ordered = [...sortedTeamsViewRows].sort(compareBoardRows);
    if (ordered.length === 0) {
      return [];
    }
    const selfIndex = ordered.findIndex((row) => row.team.teamId === selectedTeam.teamId);
    if (selfIndex < 0) {
      return [];
    }
    const windowSize = Math.min(5, ordered.length);
    const start = Math.max(0, Math.min(selfIndex - 2, ordered.length - windowSize));
    return ordered.slice(start, start + windowSize);
  }, [selectedTeam.teamId, sortedTeamsViewRows]);

  // Team-Entwicklung: Host liefert [Live, jüngste Saison, …] — für die
  // Verlaufs-Charts chronologisch drehen (älteste zuerst, Live zuletzt).
  const developmentRows = useMemo(
    () => [...(selectedTeamsHistoryData?.history ?? [])].reverse(),
    [selectedTeamsHistoryData],
  );

  const liveHistoryRow = useMemo(
    () => (selectedTeamsHistoryData?.history ?? []).find((row) => row.isLive) ?? null,
    [selectedTeamsHistoryData],
  );

  const previousSeasonRow = useMemo(
    () => (selectedTeamsHistoryData?.history ?? []).find((row) => !row.isLive) ?? null,
    [selectedTeamsHistoryData],
  );

  // Saison-Deltas (Live vs. jüngste abgeschlossene Saison) — nur echte Werte.
  const seasonDeltas = useMemo(() => {
    if (!liveHistoryRow || !previousSeasonRow) {
      return null;
    }
    const rankDelta =
      isFiniteNumber(liveHistoryRow.rank) && isFiniteNumber(previousSeasonRow.rank)
        ? previousSeasonRow.rank - liveHistoryRow.rank
        : null;
    const pointsDelta =
      isFiniteNumber(liveHistoryRow.points) && isFiniteNumber(previousSeasonRow.points)
        ? liveHistoryRow.points - previousSeasonRow.points
        : null;
    const marketValueDelta =
      isFiniteNumber(liveHistoryRow.marketValue) && isFiniteNumber(previousSeasonRow.marketValue)
        ? liveHistoryRow.marketValue - previousSeasonRow.marketValue
        : null;
    if (rankDelta == null && pointsDelta == null && marketValueDelta == null) {
      return null;
    }
    return { rankDelta, pointsDelta, marketValueDelta };
  }, [liveHistoryRow, previousSeasonRow]);

  const developmentSeries = useMemo(() => {
    if (developmentRows.length < 2) {
      return null;
    }
    const rankValues = developmentRows.map((row) => row.rank).filter(isFiniteNumber);
    // Rang 1 = beste Saison → für die Sparkline invertieren (oben = besser).
    const rankSpark =
      teamCount > 0 ? developmentRows.filter((row) => isFiniteNumber(row.rank)).map((row) => teamCount - (row.rank as number) + 1) : [];
    const pointValues = developmentRows.map((row) => row.points).filter(isFiniteNumber);
    const pointBars = developmentRows
      .filter((row) => isFiniteNumber(row.points))
      .slice(-10)
      .map((row) => ({
        label: formatNlSeasonShortLabel(row.seasonName, row.seasonId),
        value: row.points as number,
        tone: row.isLive ? ("accent" as const) : ("neutral" as const),
      }));
    const marketValueSpark = developmentRows.filter((row) => isFiniteNumber(row.marketValue)).map((row) => row.marketValue as number);
    return {
      rankSpark,
      bestRank: rankValues.length > 0 ? Math.min(...rankValues) : null,
      avgRank: rankValues.length > 0 ? rankValues.reduce((sum, value) => sum + value, 0) / rankValues.length : null,
      pointBars,
      pointsTotal: pointValues.length > 0 ? pointValues.reduce((sum, value) => sum + value, 0) : null,
      pointsAvg: pointValues.length > 0 ? pointValues.reduce((sum, value) => sum + value, 0) / pointValues.length : null,
      marketValueSpark,
      marketValueFirst: marketValueSpark.length > 0 ? marketValueSpark[0] : null,
      marketValueLast: marketValueSpark.length > 0 ? marketValueSpark[marketValueSpark.length - 1] : null,
    };
  }, [developmentRows, teamCount]);

  function scrollToSection(ref: { current: HTMLDivElement | null }) {
    const node = ref.current;
    if (!node || typeof window === "undefined") {
      return;
    }
    const reduceMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function handleBoardSortToggle(key: NlTeamsBoardSortKey, defaultDir: NlTeamsBoardSortDir) {
    setBoardSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir },
    );
  }

  function handleHeroAxisSortSelect(key: NlAxisKey) {
    setBoardSort({ key, dir: "asc" });
    scrollToSection(leagueCardRef);
  }

  const leaderPoints = useMemo(
    () =>
      boardRows.reduce(
        (max, row) => (row.points != null && Number.isFinite(row.points) && row.points > max ? row.points : max),
        0,
      ),
    [boardRows],
  );

  const heroRadarAxes = useMemo(() => {
    if (teamCount <= 0) {
      return [];
    }
    return NL_TEAMS_AXES.flatMap(({ key }) => {
      const rank = getAxisRank(heroRow, key);
      if (rank == null || !Number.isFinite(rank)) {
        return [];
      }
      // Rang 1 = beste Achse → nach außen zeichnen (teamCount - Rang + 1).
      return [{ key, value: Math.max(0, teamCount - rank + 1) }];
    });
  }, [heroRow, teamCount]);

  const heroLogo = getTeamLogoModel(selectedTeam, { variant: "thumb" });

  function renderAxisRankBadges(
    row: TeamsViewRow | null,
    teamName: string,
    compact: boolean,
    onSelectAxis?: (key: NlAxisKey) => void,
  ) {
    return (
      <div
        className={`nl-teams-axes${compact ? " is-compact" : ""}`}
        role="group"
        aria-label={`Bereichs-Ränge ${teamName}`}
      >
        {NL_TEAMS_AXES.map(({ key, label }) => {
          const rank = getAxisRank(row, key);
          const points = getAxisPoints(row, key);
          const title =
            rank != null
              ? `${getTeamAxisRankTooltip(label)}${points != null ? ` · ${formatNlNumber(points, 1)} Bereichspunkte` : ""}`
              : getTeamAxisRankTooltip(label);
          const isSortAxis = boardSort.key === key;
          const axisClassName = `nl-teams-axis ${nlToneClass(key)}${isSortAxis ? " is-sorted" : ""}`;
          const body = (
            <>
              <span className="nl-teams-axis-label">{label}</span>
              {compact ? (
                <span className="nl-teams-axis-rank nl-tnum">
                  {rank != null ? `#${formatNlNumber(rank, 0)}` : "—"}
                </span>
              ) : (
                // Wert (Bereichspunkte) UND Liga-Rang klar nebeneinander: "58 · #14".
                // Fehlt ein echter Rang, bleibt nur der Wert stehen — kein Fake.
                <span className="nl-teams-axis-figures nl-tnum">
                  {points != null ? (
                    <span className="nl-teams-axis-value">{formatNlNumber(points, 1)}</span>
                  ) : null}
                  {points != null && rank != null ? (
                    <span className="nl-teams-axis-sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  {rank != null ? (
                    <span className="nl-teams-axis-rank">#{formatNlNumber(rank, 0)}</span>
                  ) : null}
                  {points == null && rank == null ? <span className="nl-teams-axis-rank">—</span> : null}
                </span>
              )}
            </>
          );
          if (onSelectAxis) {
            return (
              <button
                key={key}
                type="button"
                className={`${axisClassName} is-clickable`}
                title={`${title} — Klick sortiert die Teamtabelle nach ${label}`}
                aria-pressed={isSortAxis}
                onClick={() => onSelectAxis(key)}
              >
                {body}
              </button>
            );
          }
          return (
            <span key={key} className={axisClassName} title={title}>
              {body}
            </span>
          );
        })}
      </div>
    );
  }

  function renderRosterGrid() {
    if (filteredSelectedRosterTableRows.length === 0) {
      return <p className="nl-teams-empty">Keine Spieler für den aktuellen Filter.</p>;
    }
    return (
      <div className="nl-teams-portrait-grid" data-testid="nl-teams-portrait-grid">
        {filteredSelectedRosterTableRows.map((row) => {
          const { entry, player } = row;
          const portrait = getPlayerPortraitModel(player);
          const marketValue = getRosterEntryDisplayMarketValue(entry, player);
          const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
          const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
          const currentSeasonSalary = getRosterEntryCurrentSeasonSalary(entry, player);
          const shapeShort = formatContractShapeShortLabel(entry.contractShape);
          const subMeta = formatPlayerIdentitySubMeta(player);
          return (
            <FoundationPlayerPortraitCard
              key={entry.id}
              playerId={player.id}
              name={player.name}
              portraitUrl={portrait.src}
              portraitPlaceholderUrl={portrait.previewSrc ?? portrait.thumbSrc}
              portraitInitials={portrait.initials}
              playerOvr={row.playerOvr}
              playerMvs={row.playerMvs}
              playerPps={row.playerPps}
              ovrRank={row.ovrRank ?? null}
              mvsRank={row.mvsRank ?? null}
              ppsRank={row.ppsRank ?? null}
              pow={player.coreStats.pow}
              spe={player.coreStats.spe}
              men={player.coreStats.men}
              soc={player.coreStats.soc}
              leagueHeatPools={leaguePlayerHeatPools}
              variant="team"
              roleTag={entry.roleTag}
              playerClassName={player.className}
              className={getClassColorClassName(player.className, "player-card-class-frame")}
              subMeta={subMeta || null}
              onOpen={() => void openPlayerDrawerById(player.id, entry.id)}
              title={`${player.name} öffnen`}
              economyStats={[
                {
                  label: "MW",
                  value: formatNlNumber(marketValue, 2),
                  delta:
                    marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01
                      ? `${marketValueDelta > 0 ? "+" : ""}${formatNlNumber(marketValueDelta, 2)}`
                      : null,
                  deltaClass:
                    marketValueDelta != null && marketValueDelta > 0
                      ? "text-positive"
                      : marketValueDelta != null && marketValueDelta < 0
                        ? "text-negative"
                        : "",
                },
                {
                  label: "Gehalt",
                  value: formatDisplayMoney(currentSeasonSalary),
                  delta:
                    salaryDelta != null && Math.abs(salaryDelta) >= 0.01
                      ? `${salaryDelta > 0 ? "+" : ""}${formatDisplayMoney(salaryDelta)}`
                      : null,
                  deltaClass:
                    salaryDelta != null && salaryDelta < 0
                      ? "text-positive"
                      : salaryDelta != null && salaryDelta > 0
                        ? "text-negative"
                        : "",
                },
                {
                  label: "LZ",
                  value: `${entry.contractLength ?? "—"}${shapeShort ? ` · ${shapeShort}` : ""}`,
                },
              ]}
            />
          );
        })}
      </div>
    );
  }

  function renderRosterTable() {
    const showActions = selectedTeamRosterActionsAvailable;
    return (
      <div className="nl-teams-table-shell">
        <table className="nl-teams-table nl-tnum">
          <thead>
            <tr>
              <th className="nl-teams-th-player">Spieler</th>
              <th className="nl-teams-th-role">Rolle</th>
              <th>OVR</th>
              <th>MVS</th>
              <th>PPs</th>
              <th>MW</th>
              <th>Gehalt</th>
              <th>LZ</th>
              {showActions ? <th className="nl-teams-th-actions">Aktionen</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredSelectedRosterTableRows.map((row) => {
              const { entry, player } = row;
              const marketValue = getRosterEntryDisplayMarketValue(entry, player);
              const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
              const annualSalary = getRosterEntryDisplaySalary(entry, player);
              const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
              const shapeShort = formatContractShapeShortLabel(entry.contractShape);
              const isContractExpiring = entry.contractLength <= 1;
              return (
                <tr
                  key={entry.id}
                  className={`nl-teams-table-row${isContractExpiring ? " is-contract-expiring" : ""}`}
                  onClick={() => void openPlayerDrawerById(player.id, entry.id)}
                  title={`${player.name} öffnen`}
                >
                  <td className="nl-teams-td-player">
                    <button
                      type="button"
                      className="nl-teams-playerlink"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openPlayerDrawerById(player.id, entry.id);
                      }}
                    >
                      <span className="nl-teams-playername">{player.name}</span>
                      <span className="nl-teams-playermeta">{formatPlayerIdentitySubMeta(player) || "—"}</span>
                    </button>
                  </td>
                  <td className="nl-teams-td-role">{entry.roleTag ?? "Kader"}</td>
                  <td>{formatNlNumber(row.playerOvr, 0)}</td>
                  <td>{formatNlNumber(row.playerMvs, 1)}</td>
                  <td>{formatNlNumber(row.playerPps, 1)}</td>
                  <td>
                    <span className="nl-teams-money-stack">
                      <span>{formatNlNumber(marketValue, 2)}</span>
                      {marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01 ? (
                        <small className={marketValueDelta >= 0 ? "text-positive" : "text-negative"}>
                          {`${marketValueDelta > 0 ? "+" : ""}${formatNlNumber(marketValueDelta, 2)}`}
                        </small>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    <span className="nl-teams-money-stack">
                      <span>{formatDisplayMoney(annualSalary)}</span>
                      {salaryDelta != null && Math.abs(salaryDelta) >= 0.01 ? (
                        <small className={salaryDelta <= 0 ? "text-positive" : "text-negative"}>
                          {`${salaryDelta > 0 ? "+" : ""}${formatDisplayMoney(salaryDelta)}`}
                        </small>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    {entry.contractLength}
                    {shapeShort ? <small className="nl-teams-shape"> · {shapeShort}</small> : null}
                  </td>
                  {showActions ? (
                    <td className="nl-teams-td-actions" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className="nl-teams-action"
                        disabled={marketSellBusy}
                        title="Verkaufen"
                        aria-label={`${player.name} verkaufen`}
                        onClick={() =>
                          void openMarketSellModal(
                            {
                              activePlayerId: entry.id,
                              playerId: player.id,
                              playerName: player.name,
                              className: player.className,
                              race: player.race ?? "—",
                              portraitUrl:
                                getPlayerPortraitModel(player).previewSrc ?? getPlayerPortraitModel(player).src,
                            },
                            selectedTeam.teamId,
                          )
                        }
                      >
                        Verkaufen
                      </button>
                      {isContractExpiring ? (
                        <button
                          type="button"
                          className="nl-teams-action"
                          disabled={contractRenewalBusy != null}
                          title="Verlängern"
                          aria-label={`${player.name} verlängern`}
                          onClick={() =>
                            void openContractRenewalNegotiation({
                              teamId: selectedTeam.teamId,
                              playerId: player.id,
                              playerName: player.name,
                              contractLength: 2,
                            })
                          }
                        >
                          Verlängern
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {filteredSelectedRosterTableRows.length === 0 ? (
              <tr>
                <td colSpan={showActions ? 9 : 8} className="nl-teams-empty">
                  Keine Spieler für den aktuellen Filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  // Hover-Karte pro Teamtabellen-Zeile: Mini-Radar aus den aktuellen
  // Bereichs-Rängen + Saison-Sparklines aus `historicalPointsBySeason`
  // (echte Snapshot-Punkte/-Ränge, chronologisch) plus Live-Saison.
  function renderBoardHoverCard(row: TeamsViewRow) {
    const radarAxes =
      teamCount > 0
        ? NL_TEAMS_AXES.flatMap(({ key }) => {
            const rank = getAxisRank(row, key);
            if (!isFiniteNumber(rank)) {
              return [];
            }
            return [{ key, value: Math.max(0, teamCount - rank + 1) }];
          })
        : [];
    const historicalSeasons = row.historicalPointsBySeason ?? [];
    const seasonPointsSpark = [...historicalSeasons.map((entry) => entry.points), row.points].filter(isFiniteNumber);
    const seasonRankSpark =
      teamCount > 0
        ? [...historicalSeasons.map((entry) => entry.rank), row.rank]
            .filter(isFiniteNumber)
            .map((rank) => teamCount - rank + 1)
        : [];
    const hasTrend = seasonPointsSpark.length >= 2;
    if (radarAxes.length === 0 && !hasTrend) {
      return null;
    }
    return (
      <div className="nl-teams-board-hover" aria-hidden="true">
        <span className="nl-teams-board-hover-title">{row.teamName}</span>
        <div className="nl-teams-board-hover-body">
          {radarAxes.length > 0 ? (
            <NlRadar axes={radarAxes} max={teamCount} className="nl-teams-board-hover-radar" />
          ) : null}
          {hasTrend ? (
            <div className="nl-teams-board-hover-trends">
              <span className="nl-teams-board-hover-caption nl-tnum">
                {historicalSeasons.length + 1} Saisons
                {isFiniteNumber(row.historicalBestRank) ? ` · Best #${formatNlNumber(row.historicalBestRank, 0)}` : ""}
              </span>
              <span className="nl-teams-board-hover-trend">
                <small>Punkte</small>
                <NlSparkline points={seasonPointsSpark} tone="accent" />
              </span>
              {seasonRankSpark.length >= 2 ? (
                <span className="nl-teams-board-hover-trend">
                  <small>Rang (oben = besser)</small>
                  <NlSparkline points={seasonRankSpark} tone="good" />
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Aktive Sortierung als Zeilenwert: zeigt in jeder Zeile genau den Wert, nach
  // dem gerade sortiert wird, wenn er nicht ohnehin schon in der Zeile steht
  // (Rang/Punkte/Cash/Medaillen/Achsen sind bereits sichtbar). So sieht man
  // beim Sortieren nach MW/Gehalt/Kader auch die zugehörige Zahl.
  function renderBoardSortValue(row: TeamsViewRow) {
    const key = boardSort.key;
    if (key === "mw") {
      return (
        <span className="nl-teams-board-sortval nl-tnum" title="Team-Marktwert">
          <small>MW</small>
          {formatNlNumber(row.marketValueTotal, 2)}
        </span>
      );
    }
    if (key === "salary") {
      return (
        <span className="nl-teams-board-sortval nl-tnum" title="Gehaltsblock">
          <small>Gehalt</small>
          {formatNlNumber(row.salaryTotal, 2)}
        </span>
      );
    }
    if (key === "roster") {
      return (
        <span className="nl-teams-board-sortval nl-tnum" title="Kadergröße">
          <small>Kader</small>
          {formatNlNumber(row.rosterCount, 0)}
        </span>
      );
    }
    return null;
  }

  function renderBoardRow(row: TeamsViewRow) {
    const isSelected = row.team.teamId === selectedTeam.teamId;
    const boardRank = getBoardRank(row);
    const medalKind = boardRank === 1 ? "gold" : boardRank === 2 ? "silver" : boardRank === 3 ? "bronze" : null;
    const logo = getTeamLogoModel(row.team, { variant: "thumb" });
    return (
      <li
        key={row.team.teamId}
        className={`nl-teams-boardrow${isSelected ? " is-selected" : ""}${medalKind ? " is-podium" : ""}`}
        style={getSeasonV2TeamTagStyle(row.teamCode)}
        onMouseEnter={() => setHoveredBoardTeamId(row.team.teamId)}
        onMouseLeave={() => setHoveredBoardTeamId((prev) => (prev === row.team.teamId ? null : prev))}
        onFocusCapture={() => setHoveredBoardTeamId(row.team.teamId)}
        onBlurCapture={() => setHoveredBoardTeamId((prev) => (prev === row.team.teamId ? null : prev))}
      >
        {hoveredBoardTeamId === row.team.teamId ? renderBoardHoverCard(row) : null}
        <button
          type="button"
          className="nl-teams-boardrow-main"
          onClick={() => {
            // Zeile anklicken = dieses Team in den Fokus holen (Hero oben wird
            // sein Profil) und nach oben scrollen. Ein separater „Profil"-Knopf
            // ist damit überflüssig.
            scheduleActiveManagerTeam(row.team.teamId, "manual_select");
            scrollToSection(heroCardRef);
          }}
          title={`${row.teamName} in den Fokus holen`}
        >
          <span className="nl-teams-board-rank">
            {medalKind ? (
              <NlMedalBadge kind={medalKind} title={`Rang ${boardRank}`} />
            ) : (
              <span className="nl-teams-board-ranknum nl-tnum">{boardRank != null ? boardRank : "—"}</span>
            )}
          </span>
          <span className="nl-teams-board-team">
            <BudgetedMediaImage
              src={logo.src}
              alt={`${row.teamName} Logo`}
              className="nl-teams-board-crest"
              width={30}
              height={30}
              loading="lazy"
              fallback={<span className="nl-teams-board-crest nl-teams-board-crest-fallback">{logo.initials}</span>}
            />
            <span className="nl-teams-board-team-copy">
              <span className="nl-teams-board-teamname">{row.teamName}</span>
              <span className="nl-teams-board-teamcode">{row.teamCode}</span>
            </span>
          </span>
          <span className="nl-teams-board-points">
            <span className="nl-teams-board-points-value nl-tnum">{formatNlNumber(row.points, 1)}</span>
            <NlProgressBar
              value={row.points ?? 0}
              max={leaderPoints > 0 ? leaderPoints : 1}
              tone="accent"
              showValue={false}
              className="nl-teams-board-points-bar"
              title={`Punkte relativ zum Spitzenreiter (${formatNlNumber(leaderPoints, 1)})`}
            />
          </span>
          {renderAxisRankBadges(row, row.teamName, true)}
          <span className="nl-teams-board-meta">
            {renderBoardSortValue(row)}
            {row.goldCount > 0 ? <NlMedalBadge kind="gold" count={row.goldCount} /> : null}
            {row.silverCount > 0 ? <NlMedalBadge kind="silver" count={row.silverCount} /> : null}
            {row.bronzeCount > 0 ? <NlMedalBadge kind="bronze" count={row.bronzeCount} /> : null}
            <span className="nl-teams-board-cash nl-tnum" title="Cash">
              {row.cash != null ? formatMoney(row.cash) : "—"}
            </span>
          </span>
        </button>
      </li>
    );
  }

  return (
    <div className="nl-teams foundation-teams-view-panel" data-testid="nl-teams-view" data-new-look="true">
      <div ref={heroCardRef} className="nl-teams-anchor">
      <NlCard className="nl-teams-hero-card" data-testid="nl-teams-hero">
        <div className="nl-teams-hero" style={getSeasonV2TeamTagStyle(heroRow?.teamCode ?? null)}>
          <div className="nl-teams-hero-identity">
            <BudgetedMediaImage
              src={heroLogo.src}
              alt={`${selectedTeam.name} Logo`}
              className="nl-teams-hero-crest"
              width={64}
              height={64}
              loading="eager"
              fetchPriority="high"
              fallback={<span className="nl-teams-hero-crest nl-teams-hero-crest-fallback">{heroLogo.initials}</span>}
            />
            <div className="nl-teams-hero-copy">
              <span className="nl-teams-hero-eyebrow">Team Fokus</span>
              <h2 className="nl-teams-hero-name">{selectedTeam.name}</h2>
              <StatChipRow className="nl-teams-hero-chips" aria-label={`Kennzahlen ${selectedTeam.name}`}>
                <span className="nl-teams-rank-portal">
                  <StatChip
                    label="Rang"
                    value={heroRow?.rank != null ? `#${heroRow.rank}` : "—"}
                    tone="accent"
                    onClick={onOpenSeason ?? (() => openTeamProfileById(selectedTeam.teamId))}
                    title={onOpenSeason ? "Zum Saisonstand springen" : `${selectedTeam.name} Profil öffnen`}
                  />
                  {rankPreviewRows.length > 0 ? (
                    <div className="nl-teams-rank-preview" aria-hidden="true">
                      <span className="nl-teams-rank-preview-title">Saisonstand</span>
                      <ol className="nl-teams-rank-preview-list nl-tnum">
                        {rankPreviewRows.map((row) => {
                          const isSelf = row.team.teamId === selectedTeam.teamId;
                          const previewRank = getBoardRank(row);
                          return (
                            <li
                              key={row.team.teamId}
                              className={`nl-teams-rank-preview-row${isSelf ? " is-self" : ""}`}
                            >
                              <span className="nl-teams-rank-preview-rank">
                                {previewRank != null ? `#${formatNlNumber(previewRank, 0)}` : "—"}
                              </span>
                              <span className="nl-teams-rank-preview-team">{row.teamName}</span>
                              <span className="nl-teams-rank-preview-points">{formatNlNumber(row.points, 1)}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ) : null}
                </span>
                <StatChip
                  label="Punkte"
                  value={formatNlNumber(heroRow?.points, 1)}
                  onClick={selectedTeamsHistoryData != null ? () => scrollToSection(developmentCardRef) : undefined}
                  title={selectedTeamsHistoryData != null ? "Zum Saison-Verlauf springen" : undefined}
                />
                <StatChip
                  label="Kader"
                  value={heroRow != null ? formatNlNumber(heroRow.rosterCount, 0) : "—"}
                  onClick={() => {
                    setRosterMode("tabelle");
                    scrollToSection(rosterCardRef);
                  }}
                  title="Zur Kadertabelle springen"
                />
                <StatChip
                  label="Cash"
                  value={heroRow?.cash != null ? formatMoney(heroRow.cash) : "—"}
                  tone={heroRow?.cash != null && heroRow.cash < 0 ? "risk" : "neutral"}
                />
                <StatChip
                  label="MW"
                  value={formatNlNumber(heroRow?.marketValueTotal, 2)}
                  title="Marktwert gesamt — öffnet die Kadertabelle"
                  onClick={() => {
                    setRosterMode("tabelle");
                    scrollToSection(rosterCardRef);
                  }}
                />
                <StatChip
                  label="Gehalt"
                  value={heroRow != null ? formatNlNumber(heroRow.salaryTotal, 2) : "—"}
                  title="Gehaltsblock des aktiven Kaders — öffnet die Kadertabelle"
                  onClick={() => {
                    setRosterMode("tabelle");
                    scrollToSection(rosterCardRef);
                  }}
                />
                {heroRow?.needScore != null ? (
                  <StatChip
                    label="Transferbedarf"
                    value={formatNlNumber(heroRow.needScore, 2)}
                    tone="warn"
                    title="Need Score des Teams — je höher, desto größer der Transferbedarf"
                  />
                ) : null}
              </StatChipRow>
              {seasonDeltas != null && previousSeasonRow != null ? (
                <div
                  className="nl-teams-hero-deltas"
                  role="group"
                  aria-label={`Veränderung gegenüber ${previousSeasonRow.seasonName}`}
                >
                  <span className="nl-teams-hero-deltas-label">ggü. {previousSeasonRow.seasonName}</span>
                  {seasonDeltas.rankDelta != null ? (
                    <span className="nl-teams-hero-delta">
                      Rang
                      <NlDeltaChip
                        value={seasonDeltas.rankDelta}
                        format={(n) => formatSignedNlNumber(n, 0)}
                        title={`Rang: #${formatNlNumber(previousSeasonRow.rank, 0)} → #${formatNlNumber(liveHistoryRow?.rank, 0)}`}
                      />
                    </span>
                  ) : null}
                  {seasonDeltas.pointsDelta != null ? (
                    <span className="nl-teams-hero-delta">
                      Punkte
                      <NlDeltaChip
                        value={seasonDeltas.pointsDelta}
                        format={(n) => formatSignedNlNumber(n, 1)}
                        title={`Punkte: ${formatNlNumber(previousSeasonRow.points, 1)} → ${formatNlNumber(liveHistoryRow?.points, 1)}`}
                      />
                    </span>
                  ) : null}
                  {seasonDeltas.marketValueDelta != null ? (
                    <span className="nl-teams-hero-delta">
                      MW
                      <NlDeltaChip
                        value={seasonDeltas.marketValueDelta}
                        format={(n) => formatSignedNlNumber(n, 2)}
                        title={`Marktwert: ${formatNlNumber(previousSeasonRow.marketValue, 2)} → ${formatNlNumber(liveHistoryRow?.marketValue, 2)}`}
                      />
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="nl-teams-hero-axes">
            {renderAxisRankBadges(heroRow, selectedTeam.name, false, handleHeroAxisSortSelect)}
            {heroRadarAxes.length > 0 ? (
              <figure className="nl-teams-hero-radar-figure">
                <NlRadar
                  axes={heroRadarAxes}
                  max={teamCount}
                  className="nl-teams-hero-radar"
                  onAxisClick={handleHeroAxisSortSelect}
                  aria-label={`Stärkenprofil von ${selectedTeam.name}: Bereichs-Ränge im Liga-Vergleich, außen = stärker`}
                />
                <figcaption className="nl-teams-hero-radar-caption">Stärkenprofil · außen = liga-stark</figcaption>
              </figure>
            ) : null}
          </div>
        </div>
      </NlCard>
      </div>

      {selectedTeamsHistoryData != null ? (
        <div ref={developmentCardRef} className="nl-teams-anchor">
          <NlCard
            className="nl-teams-development-card"
            eyebrow="Entwicklung"
            title="Saison-Verlauf"
            data-testid="nl-teams-development"
            actions={
              <span className="nl-teams-development-count nl-tnum">
                {developmentRows.length} {developmentRows.length === 1 ? "Saison" : "Saisons"}
              </span>
            }
          >
            {developmentSeries != null ? (
              <>
                <div className="nl-teams-development-grid">
                  <article className="nl-teams-development-metric">
                    <header className="nl-teams-development-head">
                      <span className="nl-teams-development-label">Rang</span>
                      <span className="nl-teams-development-value nl-tnum">
                        {liveHistoryRow?.rank != null ? `#${formatNlNumber(liveHistoryRow.rank, 0)}` : "—"}
                      </span>
                      {seasonDeltas?.rankDelta != null ? (
                        <NlDeltaChip
                          value={seasonDeltas.rankDelta}
                          format={(n) => formatSignedNlNumber(n, 0)}
                          title={`Rang ggü. ${previousSeasonRow?.seasonName ?? "Vorsaison"}`}
                        />
                      ) : null}
                    </header>
                    {developmentSeries.rankSpark.length >= 2 ? (
                      <NlSparkline
                        points={developmentSeries.rankSpark}
                        tone="accent"
                        className="nl-teams-development-spark"
                        aria-label={`Rang-Verlauf von ${selectedTeam.name} über ${developmentRows.length} Saisons (oben = besser)`}
                      />
                    ) : (
                      <p className="nl-teams-empty">Kein Rang-Verlauf vorhanden.</p>
                    )}
                    <p className="nl-teams-development-meta">
                      {developmentSeries.bestRank != null ? `Best #${formatNlNumber(developmentSeries.bestRank, 0)}` : "—"}
                      {developmentSeries.avgRank != null ? ` · Ø #${formatNlNumber(developmentSeries.avgRank, 1)}` : ""}
                    </p>
                  </article>
                  <article className="nl-teams-development-metric is-points">
                    <header className="nl-teams-development-head">
                      <span className="nl-teams-development-label">Punkte</span>
                      <span className="nl-teams-development-value nl-tnum">{formatNlNumber(liveHistoryRow?.points, 1)}</span>
                      {seasonDeltas?.pointsDelta != null ? (
                        <NlDeltaChip
                          value={seasonDeltas.pointsDelta}
                          format={(n) => formatSignedNlNumber(n, 1)}
                          title={`Punkte ggü. ${previousSeasonRow?.seasonName ?? "Vorsaison"}`}
                        />
                      ) : null}
                    </header>
                    {developmentSeries.pointBars.length > 0 ? (
                      <NlBarChart
                        bars={developmentSeries.pointBars}
                        format={(value) => formatNlNumber(value, 0)}
                        className="nl-teams-development-bars"
                        aria-label={`Punkte pro Saison von ${selectedTeam.name}`}
                      />
                    ) : (
                      <p className="nl-teams-empty">Keine Punktedaten vorhanden.</p>
                    )}
                    <p className="nl-teams-development-meta">
                      {developmentSeries.pointsTotal != null ? `Σ ${formatNlNumber(developmentSeries.pointsTotal, 1)}` : "—"}
                      {developmentSeries.pointsAvg != null ? ` · Ø ${formatNlNumber(developmentSeries.pointsAvg, 1)}` : ""}
                    </p>
                  </article>
                  <article className="nl-teams-development-metric">
                    <header className="nl-teams-development-head">
                      <span className="nl-teams-development-label">Marktwert</span>
                      <span className="nl-teams-development-value nl-tnum">{formatNlNumber(liveHistoryRow?.marketValue, 2)}</span>
                      {seasonDeltas?.marketValueDelta != null ? (
                        <NlDeltaChip
                          value={seasonDeltas.marketValueDelta}
                          format={(n) => formatSignedNlNumber(n, 2)}
                          title={`Marktwert ggü. ${previousSeasonRow?.seasonName ?? "Vorsaison"}`}
                        />
                      ) : null}
                    </header>
                    {developmentSeries.marketValueSpark.length >= 2 ? (
                      <NlSparkline
                        points={developmentSeries.marketValueSpark}
                        tone="good"
                        className="nl-teams-development-spark"
                        aria-label={`Marktwert-Verlauf von ${selectedTeam.name} über ${developmentRows.length} Saisons`}
                      />
                    ) : (
                      <p className="nl-teams-empty">Kein Marktwert-Verlauf vorhanden.</p>
                    )}
                    <p className="nl-teams-development-meta">
                      {developmentSeries.marketValueFirst != null && developmentSeries.marketValueLast != null
                        ? `von ${formatNlNumber(developmentSeries.marketValueFirst, 2)} auf ${formatNlNumber(developmentSeries.marketValueLast, 2)}`
                        : "—"}
                    </p>
                  </article>
                </div>
                <ol className="nl-teams-development-seasons" aria-label="Saisons im Verlauf">
                  {developmentRows.map((row) => (
                    <li
                      key={row.seasonId}
                      className={`nl-teams-development-season${row.isLive ? " is-live" : ""}`}
                      title={`${row.seasonName}${row.rank != null ? ` · Rang #${formatNlNumber(row.rank, 0)}` : ""}${
                        row.points != null ? ` · ${formatNlNumber(row.points, 1)} Punkte` : ""
                      }${row.marketValue != null ? ` · MW ${formatNlNumber(row.marketValue, 2)}` : ""}`}
                    >
                      <span className="nl-teams-development-season-name">
                        {formatNlSeasonShortLabel(row.seasonName, row.seasonId)}
                      </span>
                      <span className="nl-teams-development-season-rank nl-tnum">
                        {row.rank != null ? `#${formatNlNumber(row.rank, 0)}` : "—"}
                      </span>
                      {row.isLive ? <span className="nl-teams-development-season-live">Live</span> : null}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="nl-teams-empty">
                Noch keine abgeschlossenen Saisons — der Verlauf entsteht ab der zweiten Saison
                {liveHistoryRow?.rank != null ? ` (aktuell Rang #${formatNlNumber(liveHistoryRow.rank, 0)})` : ""}.
              </p>
            )}
          </NlCard>
        </div>
      ) : null}

      <div ref={rosterCardRef} className="nl-teams-anchor">
      <NlCard
        className="nl-teams-roster-card"
        eyebrow="Kaderprofil"
        title="Kader"
        actions={
          <NlSubTabs
            items={NL_TEAMS_ROSTER_MODE_ITEMS.map((item) => ({
              ...item,
              count: filteredSelectedRosterTableRows.length,
            }))}
            activeId={rosterMode}
            onSelect={(id) => setRosterMode(id as NlTeamsRosterMode)}
            aria-label="Kader-Ansicht wählen"
            className="nl-teams-roster-subtabs"
          />
        }
      >
        {renderRosterFilterBar()}
        {selectedTeamRosterActionHint ? (
          <p className={`nl-teams-action-hint${selectedTeamRosterActionsAvailable ? " is-ready" : " is-locked"}`}>
            <strong>{selectedTeamRosterActionsAvailable ? "Aktionen aktiv" : "Nur Ansicht"}</strong>
            <span>{selectedTeamRosterActionHint}</span>
          </p>
        ) : null}
        {rosterMode === "portraits" ? renderRosterGrid() : renderRosterTable()}
      </NlCard>
      </div>

      <div ref={leagueCardRef} className="nl-teams-anchor">
      <NlCard className="nl-teams-league-card" eyebrow="Teams · Liga" title="Teamtabelle">
        {boardRows.length > 0 ? (
          <>
            <div className="nl-teams-sortbar" role="group" aria-label="Teamtabelle sortieren">
              <span className="nl-teams-sortbar-label">Sortieren</span>
              {NL_TEAMS_BOARD_SORTS.map((option) => {
                const isActive = boardSort.key === option.key;
                return (
                  <button
                    key={`nl-teams-sort-${option.key}`}
                    type="button"
                    className={`nl-teams-sort${isActive ? " is-active" : ""}`}
                    onClick={() => handleBoardSortToggle(option.key, option.defaultDir)}
                    title={option.title}
                    aria-pressed={isActive}
                  >
                    {option.label}
                    {isActive ? (
                      <span className="nl-teams-sort-dir" aria-hidden="true">
                        {boardSort.dir === "asc" ? "▲" : "▼"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {NL_TEAMS_AXES.map(({ key, label }) => {
                const isActive = boardSort.key === key;
                return (
                  <button
                    key={`nl-teams-sort-${key}`}
                    type="button"
                    className={`nl-teams-sort nl-teams-sort-axis ${nlToneClass(key)}${isActive ? " is-active" : ""}`}
                    onClick={() => handleBoardSortToggle(key, "asc")}
                    title={`Liga nach ${label}-Bereichsrang sortieren`}
                    aria-pressed={isActive}
                  >
                    {label}
                    {isActive ? (
                      <span className="nl-teams-sort-dir" aria-hidden="true">
                        {boardSort.dir === "asc" ? "▲" : "▼"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <ol className="nl-teams-board" aria-label="Teamtabelle">
              {boardRows.map((row) => renderBoardRow(row))}
            </ol>
          </>
        ) : (
          <p className="nl-teams-empty">Noch keine Teamdaten für diese Saison.</p>
        )}
      </NlCard>
      </div>
    </div>
  );
}
