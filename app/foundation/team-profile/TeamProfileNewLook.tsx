"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";

import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import TeamDrawerHistoryTable from "@/components/foundation/team-drawer/TeamDrawerHistoryTable";
import WerdegangPanel from "@/components/foundation/werdegang/WerdegangPanel";
import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlGauge,
  NlProgressBar,
  NlRadar,
  NlSparkline,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlMoney,
  formatNlNumber,
  nlToneClass,
  type NlAxisKey,
  type NlTone,
} from "@/components/foundation/new-look";
import { buildTeamDisciplineRankRowsFromGameState } from "@/lib/foundation/team-discipline-rank-engine";
import { calculateFacilityIncome, calculateFacilityUpkeep } from "@/lib/facilities/facility-effects";
import type {
  TeamDetailDrawerData,
  TeamDetailDrawerHistoryRow,
  TeamDetailDrawerPlayerCard,
} from "@/app/foundation/TeamDetailDrawer";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { getClassColorClassName } from "@/app/foundation/classVisuals";
import { getSeasonV2TeamTagStyle } from "@/app/foundation/season-v2/SeasonStandingsV2Client";
import { getGameTermTooltip } from "@/components/ui/GameTerm";
import { buildTeamCareerSeries } from "@/lib/foundation/career-series";
import { useFoundationStateOptional } from "@/lib/foundation/foundation-state-context";
import {
  createEmptyLeaguePlayerHeatPools,
  type LeaguePlayerHeatPools,
} from "@/lib/foundation/player-league-heat";
import { groupObjectivesByCategory } from "@/lib/foundation/team-board-objectives";
import { compareTeamRosterPlayersByOvrOrMarketValue } from "@/lib/foundation/team-roster-player-sort";
import { getTeamAxisRankTooltip } from "@/lib/foundation/tabs/teams-ui-helpers";
import { isSeasonDisciplineKey } from "@/lib/season/season-discipline-area-groups";
import {
  BELIEBTHEIT_MAX,
  BELIEBTHEIT_MIN,
  FAN_FAVORITE_TRAIT_ID,
  computeTeamBeliebtheitFromGameState,
  type BeliebtheitComponents,
} from "@/lib/economy/team-beliebtheit";
import type {
  ContractShape,
  Discipline,
  DisciplineCategory,
  GameState,
  Player,
  PlayerInjuryStatus,
} from "@/lib/data/olyDataTypes";

/**
 * "Neuer Look" Team-Profil (flag-gated, additiv).
 *
 * Wird ausschließlich aus `TeamProfileClient` gerendert, wenn der
 * Runtime-Flag (`useNewLook`) aktiv ist — ohne Flag läuft die Seite
 * unverändert über `TeamDetailDrawer` (variant="page"). Konsumiert exakt
 * dieselben Props/Daten (`TeamDetailDrawerData`), erfindet nichts dazu.
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten gibt:
 * - kein Spieltags-Trend/Formkurve (existiert nicht im Modell) — die
 *   Entwicklung speist sich nur aus echten Season-Snapshots (`history`),
 * - kein Liga-Radar ohne Teamanzahl: das Radar erscheint nur, wenn der
 *   optionale Foundation-State die echte Teamanzahl liefert.
 */

type NlTeamProfileRosterMode = "portraits" | "tabelle";

const NL_TEAMPROFILE_ROSTER_MODE_ITEMS: Array<{ id: NlTeamProfileRosterMode; label: string }> = [
  { id: "portraits", label: "Portraits" },
  { id: "tabelle", label: "Tabelle" },
];

const NL_TEAMPROFILE_AXES: Array<{
  key: NlAxisKey;
  label: "POW" | "SPE" | "MEN" | "SOC";
  rankKey: "powRank" | "speRank" | "menRank" | "socRank";
}> = [
  { key: "pow", label: "POW", rankKey: "powRank" },
  { key: "spe", label: "SPE", rankKey: "speRank" },
  { key: "men", label: "MEN", rankKey: "menRank" },
  { key: "soc", label: "SOC", rankKey: "socRank" },
];

function isFiniteNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter(isFiniteNumber);
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatSignedNlNumber(value: number, digits: number): string {
  return `${value > 0 ? "+" : ""}${formatNlNumber(value, digits)}`;
}

/** "Saison 3" → "S3"; ohne Ziffer bleibt ein kurzer Prefix. */
function formatNlSeasonShortLabel(seasonName: string, seasonId: string): string {
  const source = seasonName || seasonId;
  const match = source.match(/(\d+)/);
  return match ? `S${match[1]}` : source.slice(0, 6);
}

function formatControlModeLabel(value: TeamDetailDrawerData["controlMode"]): string {
  if (value === "manual") return "Team geführt";
  if (value === "ai") return "Automatisch";
  return "Beobachtet";
}

function getRoleLabel(roleTag: string | null | undefined): string {
  if (roleTag === "starter") return "Starter";
  if (roleTag === "bench") return "Bank";
  if (roleTag === "rotation") return "Rotation";
  // "prospect" ist ein vager Auto-Rollen-Tag und wird nicht mehr als Rolle gezeigt.
  if (roleTag === "prospect") return "";
  return roleTag ?? "—";
}

function getObjectiveStatusLabel(status: "open" | "completed" | "failed" | "at_risk"): string {
  if (status === "completed") return "erfüllt";
  if (status === "failed") return "verfehlt";
  if (status === "at_risk") return "gefährdet";
  return "offen";
}

function getObjectiveStatusTone(status: "open" | "completed" | "failed" | "at_risk"): string {
  if (status === "completed") return "is-good";
  if (status === "failed") return "is-risk";
  if (status === "at_risk") return "is-warn";
  return "is-open";
}

function getDemandStatusTone(status: "open" | "fulfilled" | "at_risk" | "failed"): string {
  if (status === "fulfilled") return "is-good";
  if (status === "failed") return "is-risk";
  if (status === "at_risk") return "is-warn";
  return "is-open";
}

/** Ton für die Board-Ziel-Fortschrittsbar (NlTone statt CSS-Klasse). */
function getObjectiveProgressTone(status: "open" | "completed" | "failed" | "at_risk"): NlTone {
  if (status === "completed") return "good";
  if (status === "failed") return "risk";
  if (status === "at_risk") return "warn";
  return "neutral";
}

/** Ton für den Beliebtheitsfaktor (1.0 = Liga-Durchschnitt, siehe team-beliebtheit.ts). */
function getBeliebtheitTone(value: number): NlTone {
  if (value >= 1.1) return "good";
  if (value <= 0.9) return "risk";
  return "accent";
}

/**
 * "Fähig" für die Depth-Chart-Zählung: Diszplinrating ≥ 60 nutzt die im Spiel
 * bereits real vorhandene Tier-Schwelle (`Player.disciplineTierCounts.above60`,
 * Skala 1–100) — kein neu erfundener Cutoff.
 */
const DEPTH_CAPABLE_RATING_FLOOR = 60;

/** Erschöpfungs-Badge-Schwelle in der Depth-Chart (Skala wie `Player.fatigue`). */
const DEPTH_FATIGUE_WARN_THRESHOLD = 70;

function getDepthRatingTone(rating: number): NlTone {
  if (rating >= 80) return "good";
  if (rating >= DEPTH_CAPABLE_RATING_FLOOR) return "accent";
  if (rating >= 40) return "warn";
  return "risk";
}

const DISCIPLINE_CATEGORY_TO_AXIS: Record<DisciplineCategory, NlAxisKey> = {
  power: "pow",
  speed: "spe",
  mental: "men",
  social: "soc",
};

type NlTeamProfileDepthCell = {
  playerId: string;
  playerName: string;
  rating: number;
  fatigue: number | null;
  injuryStatus: PlayerInjuryStatus | null;
};

type NlTeamProfileDepthRow = {
  disciplineId: string;
  disciplineLabel: string;
  axis: NlAxisKey;
  slotsNeeded: number | null;
  capableCount: number;
  isThin: boolean;
  cells: Array<NlTeamProfileDepthCell | null>;
};

type NlTeamProfileDepthFallbackRow = {
  axis: NlAxisKey;
  label: string;
  cells: Array<{ playerId: string; playerName: string; rating: number } | null>;
};

function buildTeamDepthChart(gameState: GameState, teamId: string): NlTeamProfileDepthRow[] | null {
  const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === teamId);
  if (rosterEntries.length === 0) {
    return null;
  }
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const rosterPlayers = rosterEntries
    .map((entry) => playersById.get(entry.playerId))
    .filter((player): player is Player => Boolean(player));
  if (rosterPlayers.length === 0) {
    return null;
  }

  const availabilityByPlayerId = new Map(
    (gameState.seasonState.playerAvailabilityState ?? [])
      .filter((row) => row.teamId === teamId)
      .map((row) => [row.playerId, row] as const),
  );

  const disciplines: Discipline[] = [...gameState.disciplines].sort(
    (left, right) => (left.displayOrder ?? left.originalOrder ?? 0) - (right.displayOrder ?? right.originalOrder ?? 0),
  );

  return disciplines.map((discipline) => {
    const ranked = rosterPlayers
      .map((player) => ({ player, rating: player.disciplineRatings[discipline.id] }))
      .filter((entry): entry is { player: Player; rating: number } => isFiniteNumber(entry.rating))
      .sort((left, right) => right.rating - left.rating);

    const capableCount = ranked.filter((entry) => entry.rating >= DEPTH_CAPABLE_RATING_FLOOR).length;
    const slotsNeeded = isFiniteNumber(discipline.playerCount) ? discipline.playerCount : null;

    const cells: Array<NlTeamProfileDepthCell | null> = [0, 1, 2, 3, 4, 5].map((index) => {
      const entry = ranked[index];
      if (!entry) {
        return null;
      }
      const availability = availabilityByPlayerId.get(entry.player.id) ?? null;
      return {
        playerId: entry.player.id,
        playerName: entry.player.name,
        rating: entry.rating,
        fatigue: availability?.fatigue ?? (isFiniteNumber(entry.player.fatigue) ? entry.player.fatigue : null),
        injuryStatus: availability?.injuryStatus ?? null,
      };
    });

    return {
      disciplineId: discipline.id,
      disciplineLabel: discipline.name,
      axis: DISCIPLINE_CATEGORY_TO_AXIS[discipline.category],
      slotsNeeded,
      capableCount,
      isThin: slotsNeeded != null && capableCount < slotsNeeded,
      cells,
    };
  });
}

function comparePlayersByOvr(left: TeamDetailDrawerPlayerCard, right: TeamDetailDrawerPlayerCard) {
  return compareTeamRosterPlayersByOvrOrMarketValue({
    left: {
      ovr: left.ovr,
      marketValue: left.marketValue,
      mvs: left.mvs,
      pps: left.pps,
      name: left.name,
    },
    right: {
      ovr: right.ovr,
      marketValue: right.marketValue,
      mvs: right.mvs,
      pps: right.pps,
      name: right.name,
    },
  });
}

function getMoneyDeltaClass(value: number | null | undefined, positiveDirection: "higher" | "lower"): string {
  if (!isFiniteNumber(value) || Math.abs(value) < 0.01) {
    return "";
  }
  const isPositive = positiveDirection === "higher" ? value > 0 : value < 0;
  return isPositive ? " text-positive" : " text-negative";
}

/**
 * Vertragsform → kompaktes Kürzel für die GEHALT-Hover-Zeile.
 * `front_loaded` → FL, `back_loaded` → BL, `balanced`/unbekannt → STD (normal).
 * Quelle: `RosterEntry.contractShape` (lib/data/olyDataTypes.ts).
 */
function getContractShapeTag(shape: ContractShape | null | undefined): {
  tag: "FL" | "BL" | "STD";
  label: string;
  tone: NlTone;
} {
  if (shape === "front_loaded") {
    return { tag: "FL", label: "front-loaded (jetzt teurer)", tone: "warn" };
  }
  if (shape === "back_loaded") {
    return { tag: "BL", label: "back-loaded (später teurer)", tone: "accent" };
  }
  return { tag: "STD", label: "normal (gleichmäßig)", tone: "neutral" };
}

/** Anzahl der Zeilen, die die MW-/GEHALT-Hover maximal einzeln listen (Rest → "…"). */
const NL_HEADER_HOVER_MAX_ROWS = 8;

type HeaderKpiHoverAlign = "start" | "end";

/**
 * Leichtgewichtiges Hover-/Fokus-Popover für die Header-KPI-Chips
 * (RANG/CASH/MW/GEHALT). Spiegelt das Verhalten des Ranking-Drawers
 * (`NlRankingDrawer`): öffnet per Maus UND Tastatur-Fokus, schließt bei
 * Blur/Escape, `role="dialog"` + `aria-label`. Rein additiv — der Chip
 * selbst bleibt sichtbar, das Popover trägt nur Zusatzinfo (kein
 * ausschließlich per Pointer erreichbarer Inhalt, da fokusierbar).
 */
function HeaderKpiHover({
  panelId,
  ariaLabel,
  chip,
  align = "start",
  children,
}: {
  panelId: string;
  ariaLabel: string;
  chip: ReactNode;
  align?: HeaderKpiHoverAlign;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openNow() {
    cancelClose();
    setOpen(true);
  }

  function closeSoon() {
    cancelClose();
    // kleine Verzögerung, damit der Zeiger die Lücke zum Panel überbrücken kann
    closeTimer.current = setTimeout(() => setOpen(false), 90);
  }

  return (
    <div
      ref={wrapRef}
      className="nl-kpipop"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={openNow}
      onBlur={(event) => {
        if (!wrapRef.current?.contains(event.relatedTarget as Node | null)) {
          cancelClose();
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          cancelClose();
          setOpen(false);
          wrapRef.current?.querySelector<HTMLButtonElement>(".nl-kpipop-trigger")?.focus();
        }
      }}
    >
      <button
        type="button"
        className="nl-kpipop-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
      >
        {chip}
      </button>
      <div
        id={panelId}
        role="dialog"
        aria-label={ariaLabel}
        className={`nl-kpipop-panel is-${align}${open ? " is-open" : ""}`}
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}

export type TeamProfileNewLookProps = {
  data: TeamDetailDrawerData;
  onClose: () => void;
  onOpenPlayer: (playerId: string, activePlayerId: string) => void;
  onOpenContracts?: () => void;
  leagueHeatPools?: LeaguePlayerHeatPools;
  /**
   * Voller GameState direkt als Prop. Die Team-Profil-Seite wird im Shell nicht
   * innerhalb des `FoundationStateProvider` gemountet, deshalb liefert der
   * optionale Kontext dort `null` — was RANG-/CASH-/MW-/GEHALT-Hover und das
   * volle Squad-Depth-Chart auf "Kein Ligakontext" degradieren ließ. Wird der
   * GameState als Prop durchgereicht (Shell hat ihn im Scope), nutzen wir ihn
   * bevorzugt und der Kontext bleibt nur Fallback.
   */
  gameState?: GameState | null;
};

export default function TeamProfileNewLook({
  data,
  onClose,
  onOpenPlayer,
  onOpenContracts,
  leagueHeatPools,
  gameState: gameStateProp = null,
}: TeamProfileNewLookProps) {
  const [rosterMode, setRosterMode] = useState<NlTeamProfileRosterMode>("portraits");

  const developmentCardRef = useRef<HTMLDivElement | null>(null);
  const rosterCardRef = useRef<HTMLDivElement | null>(null);
  const boardCardRef = useRef<HTMLDivElement | null>(null);
  const historyCardRef = useRef<HTMLDivElement | null>(null);

  const resolvedHeatPools = leagueHeatPools ?? createEmptyLeaguePlayerHeatPools();

  // Optionaler Foundation-State: liefert die echte Teamanzahl (für das
  // Liga-Radar) und den GameState für den Werdegang. Fehlt der Kontext,
  // fallen Radar/Werdegang einfach weg — kein Fake.
  const foundationState = useFoundationStateOptional();
  const foundationGameState = gameStateProp ?? foundationState?.gameState ?? null;
  const teamCount = foundationGameState?.teams.length ?? 0;

  const werdegangSeries = useMemo(
    () => (foundationGameState ? buildTeamCareerSeries(foundationGameState, data.teamId) : null),
    [data.teamId, foundationGameState],
  );

  const visiblePlayers = useMemo(() => [...data.players].sort(comparePlayersByOvr), [data.players]);

  const teamSummary = useMemo(() => {
    const players = data.players;
    return {
      avgOvr: average(players.map((player) => player.ovr)),
      avgSalary: average(players.map((player) => player.salary)),
      issueCount: players.filter((player) => player.issueTags.length > 0).length,
      expiringCount: players.filter((player) => (player.contractLength ?? 0) <= 1).length,
    };
  }, [data.players]);

  const groupedObjectives = useMemo(() => groupObjectivesByCategory(data.objectives), [data.objectives]);

  // Beliebtheit/Fans: reale Regel aus lib/economy/team-beliebtheit.ts, nur
  // berechenbar mit dem vollen GameState (Liga-Kontext für Rang/Fan-Anteil/
  // Starpower). Ohne Foundation-State kein erfundener Platzhalterwert.
  const beliebtheit: BeliebtheitComponents | null = useMemo(
    () => (foundationGameState ? computeTeamBeliebtheitFromGameState(foundationGameState, data.teamId) : null),
    [foundationGameState, data.teamId],
  );

  const fanFavoritePlayers = useMemo(() => {
    if (!foundationGameState) {
      return [];
    }
    const rosterPlayerIds = new Set(
      foundationGameState.rosters.filter((entry) => entry.teamId === data.teamId).map((entry) => entry.playerId),
    );
    return foundationGameState.players.filter(
      (player) => rosterPlayerIds.has(player.id) && player.traitsPositive?.includes(FAN_FAVORITE_TRAIT_ID),
    );
  }, [foundationGameState, data.teamId]);

  // Eigentümer-Gate (Fog-of-War): "manual" = vom Spieler geführtes Team
  // (siehe formatControlModeLabel → "Team geführt"). Nur dann dürfen die
  // spieler-granularen MW-/GEHALT-Zusammensetzungen sichtbar sein.
  const isOwnedTeam = data.controlMode === "manual";

  // RANG-Hover: kompakte Ligatabelle. Rang/Punkte aus `seasonState.standings`,
  // PPs (Disziplin-Performance) + POW/SPE/MEN/SOC aus dem kanonischen
  // Team-Disziplin-Rang-Engine (dieselbe Quelle wie die Header-Achsen-Ränge).
  const standingsHoverRows = useMemo(() => {
    if (!foundationGameState) {
      return [];
    }
    const standings = foundationGameState.seasonState.standings ?? {};
    const rankRows = buildTeamDisciplineRankRowsFromGameState(foundationGameState, foundationGameState.disciplines);
    const packByTeamId = new Map(rankRows.map((row) => [row.teamId, row.scorePack] as const));
    return foundationGameState.teams
      .map((team) => {
        const standing = standings[team.teamId];
        const pack = packByTeamId.get(team.teamId) ?? null;
        return {
          teamId: team.teamId,
          shortCode: team.shortCode ?? team.name.slice(0, 3).toUpperCase(),
          teamName: team.name,
          rank: isFiniteNumber(standing?.rank) ? (standing?.rank as number) : null,
          points: isFiniteNumber(standing?.points) ? (standing?.points as number) : null,
          pps: pack ? pack.total : null,
          pow: pack ? pack.pow : null,
          spe: pack ? pack.spe : null,
          men: pack ? pack.men : null,
          soc: pack ? pack.soc : null,
          isOwn: team.teamId === data.teamId,
        };
      })
      .sort((left, right) => {
        // Nach Ligarang (fallback: Punkte absteigend, dann Name).
        if (left.rank != null && right.rank != null && left.rank !== right.rank) {
          return left.rank - right.rank;
        }
        if (left.rank != null && right.rank == null) return -1;
        if (left.rank == null && right.rank != null) return 1;
        if ((right.points ?? -Infinity) !== (left.points ?? -Infinity)) {
          return (right.points ?? -Infinity) - (left.points ?? -Infinity);
        }
        return left.teamName.localeCompare(right.teamName, "de");
      })
      .map((row, index) => ({ ...row, displayRank: row.rank ?? index + 1 }));
  }, [foundationGameState, data.teamId]);

  // CASH-Hover: kompakte GuV. Nur reale, bereits berechnete Größen dieses
  // Teams — Cash & Gehaltsblock aus `data`, Gebäude-Unterhalt/-Einnahmen und
  // Sponsoren-Basis aus dem GameState. Ohne Foundation-State (kein Liga-
  // kontext) bleiben nur Cash & Gehälter; die Ökonomiezeilen entfallen dann.
  const cashBreakdown = useMemo(() => {
    const cash = isFiniteNumber(data.cash) ? data.cash : null;
    const salaryTotal = isFiniteNumber(data.salaryTotal) ? data.salaryTotal : null;
    if (!foundationGameState) {
      return { cash, salaryTotal, facilityUpkeep: null, facilityIncome: null, sponsorBase: null, projected: null };
    }
    const teamFacilities = foundationGameState.seasonState.teamFacilities?.[data.teamId] ?? null;
    const facilityUpkeep = teamFacilities ? calculateFacilityUpkeep(teamFacilities) : null;
    const facilityIncome = teamFacilities
      ? calculateFacilityIncome(teamFacilities, { arenaPopularityFactor: beliebtheit?.value ?? 1 })
      : null;
    const sponsorContract = foundationGameState.seasonState.sponsorContractsByTeamId?.[data.teamId] ?? null;
    const sponsorBase = sponsorContract
      ? sponsorContract.components
          .filter((component) => component.kind === "base")
          .reduce((sum, component) => sum + (isFiniteNumber(component.rewardCash) ? component.rewardCash : 0), 0)
      : null;
    // Projiziertes Saison-Ende analog zu projectCashFlow(): Cash − Gehälter
    // + (Gebäude-Einnahmen − Unterhalt) + Sponsoren-Basis. Prämien fließen
    // bewusst NICHT ein (benchmark-only, siehe cash-flow-forecast.ts).
    const projected =
      cash != null
        ? cash -
          (salaryTotal ?? 0) +
          (facilityIncome ?? 0) -
          (facilityUpkeep ?? 0) +
          (sponsorBase ?? 0)
        : null;
    return { cash, salaryTotal, facilityUpkeep, facilityIncome, sponsorBase, projected };
  }, [foundationGameState, data.teamId, data.cash, data.salaryTotal, beliebtheit]);

  // MW-Hover: Zusammensetzung aus den echten Einzel-Marktwerten des Kaders.
  const mwBreakdown = useMemo(() => {
    const rows = data.players
      .map((player) => ({
        id: player.activePlayerId,
        playerId: player.playerId,
        name: player.name,
        marketValue: isFiniteNumber(player.marketValue) ? player.marketValue : null,
      }))
      .filter((row) => row.marketValue != null)
      .sort((left, right) => (right.marketValue ?? 0) - (left.marketValue ?? 0));
    const sum = rows.reduce((total, row) => total + (row.marketValue ?? 0), 0);
    return { rows, sum, total: isFiniteNumber(data.marketValueTotal) ? data.marketValueTotal : sum };
  }, [data.players, data.marketValueTotal]);

  // GEHALT-Hover: Einzel-Gehälter + Vertragsform (FL/BL/STD). Gehalt aus der
  // Roster-Karte, Vertragsform aus `RosterEntry.contractShape` (GameState).
  const salaryBreakdown = useMemo(() => {
    const shapeByPlayerId = new Map<string, ContractShape | undefined>();
    if (foundationGameState) {
      for (const entry of foundationGameState.rosters) {
        if (entry.teamId === data.teamId) {
          shapeByPlayerId.set(entry.playerId, entry.contractShape);
        }
      }
    }
    const rows = data.players
      .map((player) => ({
        id: player.activePlayerId,
        playerId: player.playerId,
        name: player.name,
        salary: isFiniteNumber(player.salary) ? player.salary : null,
        shape: shapeByPlayerId.get(player.playerId),
      }))
      .filter((row) => row.salary != null)
      .sort((left, right) => (right.salary ?? 0) - (left.salary ?? 0));
    const sum = rows.reduce((total, row) => total + (row.salary ?? 0), 0);
    return { rows, sum, total: isFiniteNumber(data.salaryTotal) ? data.salaryTotal : sum };
  }, [data.players, data.salaryTotal, data.teamId, foundationGameState]);

  // Board-Vertrauen-Verlauf: echte archivierte Werte pro Saison stecken im
  // GM-Assignment jedes Season-Snapshots (`boardConfidenceValue`) — es gibt
  // kein separates Zeitreihen-Feld auf `TeamDetailDrawerData`. Der Live-Wert
  // (`data.boardConfidence`) wird als jüngster Punkt angehängt.
  const boardConfidenceSeries = useMemo(() => {
    if (!foundationGameState) {
      return null;
    }
    const snapshots = [...(foundationGameState.seasonState.seasonSnapshots ?? [])].sort((left, right) => {
      const leftValue = Number(left.seasonId.match(/(\d+)$/)?.[1] ?? NaN);
      const rightValue = Number(right.seasonId.match(/(\d+)$/)?.[1] ?? NaN);
      if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && leftValue !== rightValue) {
        return leftValue - rightValue;
      }
      return left.seasonId.localeCompare(right.seasonId, "de", { numeric: true });
    });
    const points: number[] = [];
    for (const snapshot of snapshots) {
      const gmAssignment = snapshot.gmAssignments?.find((entry) => entry.teamId === data.teamId);
      if (gmAssignment && isFiniteNumber(gmAssignment.boardConfidenceValue)) {
        points.push(gmAssignment.boardConfidenceValue);
      }
    }
    if (data.boardConfidence != null) {
      points.push(data.boardConfidence.value);
    }
    return points.length >= 2 ? points : null;
  }, [foundationGameState, data.teamId, data.boardConfidence]);

  const rosterStressRecord = foundationGameState?.seasonState.teamRosterStressByTeamId?.[data.teamId] ?? null;

  // Squad-Depth: reale disciplineRatings pro Spieler + Discipline.playerCount
  // (Slot-Bedarf) kommen nur aus dem vollen GameState — `data.players` trägt
  // nur die Top-2-Disziplinen pro Spieler (siehe `topDisciplines`), das reicht
  // für ein echtes 3-Tiefen-Raster nicht. Ohne Foundation-State fällt die
  // Depth-Chart auf ein vereinfachtes Achsen-Raster (coreStats) zurück.
  const depthChart = useMemo(
    () => (foundationGameState ? buildTeamDepthChart(foundationGameState, data.teamId) : null),
    [foundationGameState, data.teamId],
  );

  const depthChartFallback = useMemo<NlTeamProfileDepthFallbackRow[] | null>(() => {
    if (foundationGameState || visiblePlayers.length === 0) {
      return null;
    }
    return NL_TEAMPROFILE_AXES.map(({ key, label }) => {
      const ranked = visiblePlayers
        .map((player) => ({ player, rating: player.coreStats[key] }))
        .filter((entry): entry is { player: TeamDetailDrawerPlayerCard; rating: number } => isFiniteNumber(entry.rating))
        .sort((left, right) => right.rating - left.rating);
      return {
        axis: key,
        label,
        cells: [0, 1, 2, 3, 4, 5].map((index) => {
          const entry = ranked[index];
          return entry
            ? { playerId: entry.player.playerId, playerName: entry.player.name, rating: entry.rating }
            : null;
        }),
      };
    });
  }, [foundationGameState, visiblePlayers]);

  const liveHistoryRow = useMemo(
    () => data.history.find((row) => row.isLive) ?? data.history[0] ?? null,
    [data.history],
  );

  const previousSeasonRow = useMemo(
    () => data.history.find((row) => !row.isLive) ?? null,
    [data.history],
  );

  // Entwicklung: history kommt [Live, jüngste Saison, …] — für die
  // Verlaufs-Charts chronologisch drehen (älteste zuerst, Live zuletzt).
  const developmentRows = useMemo(() => [...data.history].reverse(), [data.history]);

  // Saison-Deltas (Live vs. jüngste abgeschlossene Saison) — nur echte Werte.
  const seasonDeltas = useMemo(() => {
    if (!liveHistoryRow || !previousSeasonRow || liveHistoryRow === previousSeasonRow) {
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
    const cashDelta =
      isFiniteNumber(liveHistoryRow.cash) && isFiniteNumber(previousSeasonRow.cash)
        ? liveHistoryRow.cash - previousSeasonRow.cash
        : null;
    if (rankDelta == null && pointsDelta == null && marketValueDelta == null && cashDelta == null) {
      return null;
    }
    return { rankDelta, pointsDelta, marketValueDelta, cashDelta };
  }, [liveHistoryRow, previousSeasonRow]);

  const developmentSeries = useMemo(() => {
    if (developmentRows.length < 2) {
      return null;
    }
    const rankValues = developmentRows.map((row) => row.rank).filter(isFiniteNumber);
    // Rang 1 = beste Saison → für die Sparkline invertieren (oben = besser).
    // Bezugsgröße ist die echte Teamanzahl, sonst der schlechteste Rang der Serie.
    const rankInversionBase = teamCount > 0 ? teamCount : rankValues.length > 0 ? Math.max(...rankValues) : 0;
    const rankSpark =
      rankInversionBase > 0 ? rankValues.map((rank) => rankInversionBase - rank + 1) : [];
    const pointValues = developmentRows.map((row) => row.points).filter(isFiniteNumber);
    const pointBars = developmentRows
      .filter((row) => isFiniteNumber(row.points))
      .slice(-10)
      .map((row) => ({
        label: formatNlSeasonShortLabel(row.seasonName, row.seasonId),
        value: row.points as number,
        tone: row.isLive ? ("accent" as const) : ("neutral" as const),
      }));
    const marketValueSpark = developmentRows.map((row) => row.marketValue).filter(isFiniteNumber);
    const cashSpark = developmentRows.map((row) => row.cash).filter(isFiniteNumber);
    return {
      rankSpark,
      bestRank: rankValues.length > 0 ? Math.min(...rankValues) : null,
      avgRank: rankValues.length > 0 ? average(rankValues) : null,
      pointBars,
      pointsAvg: pointValues.length > 0 ? average(pointValues) : null,
      marketValueSpark,
      cashSpark,
    };
  }, [developmentRows, teamCount]);

  const radarAxes = useMemo(() => {
    if (teamCount <= 0) {
      return [];
    }
    return NL_TEAMPROFILE_AXES.flatMap(({ key, rankKey }) => {
      const rank = data[rankKey];
      if (!isFiniteNumber(rank)) {
        return [];
      }
      // Rang 1 = beste Achse → nach außen zeichnen (teamCount - Rang + 1).
      return [{ key, value: Math.max(0, teamCount - rank + 1) }];
    });
  }, [data, teamCount]);

  function scrollToSection(ref: { current: HTMLDivElement | null }) {
    const node = ref.current;
    if (!node || typeof window === "undefined") {
      return;
    }
    const reduceMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function renderRelationshipColumn(
    rows: TeamDetailDrawerData["relationships"]["allies"],
    label: string,
    tone: "good" | "risk",
    emptyLabel: string,
  ) {
    return (
      <article className={`nl-teamprofile-relations-column is-${tone}`}>
        <header className="nl-teamprofile-relations-head">
          <span>{label}</span>
          <strong className="nl-tnum">{rows.length}</strong>
        </header>
        {rows.length === 0 ? (
          <p className="nl-teamprofile-empty">{emptyLabel}</p>
        ) : (
          <ul className="nl-teamprofile-relations-list">
            {rows.slice(0, 4).map((row) => (
              <li
                key={row.teamId}
                className="nl-teamprofile-relations-row nl-tnum"
                title={row.reasons.length > 0 ? row.reasons.join(" · ") : undefined}
              >
                <strong>{row.shortCode}</strong>
                <span>{formatNlNumber(row.value, 1)}</span>
                {row.changeLabel ? <em>{row.changeLabel}</em> : null}
              </li>
            ))}
          </ul>
        )}
      </article>
    );
  }

  function renderRosterGrid() {
    if (visiblePlayers.length === 0) {
      return <p className="nl-teamprofile-empty">Keine Spieler im Kader.</p>;
    }
    return (
      <div className="nl-teamprofile-portrait-grid" data-testid="nl-teamprofile-portrait-grid">
        {visiblePlayers.map((player) => (
          <FoundationPlayerPortraitCard
            key={player.activePlayerId}
            playerId={player.playerId}
            name={player.name}
            portraitUrl={player.portraitUrl}
            portraitInitials={player.portraitInitials}
            playerOvr={player.ovr}
            playerMvs={player.mvs}
            playerPps={player.pps}
            ovrRank={player.ovrRank}
            mvsRank={player.mvsRank}
            ppsRank={player.ppsRank}
            pow={player.coreStats.pow}
            spe={player.coreStats.spe}
            men={player.coreStats.men}
            soc={player.coreStats.soc}
            leagueHeatPools={resolvedHeatPools}
            variant="team"
            roleTag={player.roleTag}
            playerClassName={player.className ?? undefined}
            className={getClassColorClassName(player.className, "player-card-class-frame")}
            subMeta={[player.className, player.race].filter((part): part is string => Boolean(part && part.trim())).join(" · ") || null}
            newLook
            known={player.known}
            caStars={player.caStars}
            poStarRange={player.poStarRange}
            caScore={player.caScore}
            poScoreRange={player.poScoreRange}
            onOpen={() => onOpenPlayer(player.playerId, player.activePlayerId)}
            title={`${player.name} öffnen`}
            economyStats={[
              {
                label: "MW",
                value: formatNlNumber(player.marketValue, 2),
                delta:
                  isFiniteNumber(player.marketValueDelta) && Math.abs(player.marketValueDelta) >= 0.01
                    ? formatSignedNlNumber(player.marketValueDelta, 2)
                    : null,
                deltaClass: getMoneyDeltaClass(player.marketValueDelta, "higher"),
                title: getGameTermTooltip("MW") ?? undefined,
              },
              {
                label: "Gehalt",
                value: formatNlNumber(player.salary, 2),
                delta:
                  isFiniteNumber(player.salaryDelta) && Math.abs(player.salaryDelta) >= 0.01
                    ? formatSignedNlNumber(player.salaryDelta, 2)
                    : null,
                deltaClass: getMoneyDeltaClass(player.salaryDelta, "lower"),
              },
              {
                label: "LZ",
                value: formatNlNumber(player.contractLength, 0),
                title: getGameTermTooltip("LZ") ?? undefined,
              },
            ]}
            footerSlot={
              player.demands.length > 0 ? (
                <div className="nl-teamprofile-demand-row">
                  {player.demands.slice(0, 2).map((demand) => (
                    <span
                      key={demand.demandId}
                      className={`nl-teamprofile-demand ${getDemandStatusTone(demand.status)}`}
                      title={`${demand.detail} · Erfüllen ${demand.moraleReward >= 0 ? "+" : ""}${demand.moraleReward} Moral · Ignorieren ${demand.moralePenalty}`}
                    >
                      <strong>{demand.label}</strong>
                      <small>{demand.priority}</small>
                    </span>
                  ))}
                </div>
              ) : null
            }
          />
        ))}
      </div>
    );
  }

  function renderRosterTable() {
    if (visiblePlayers.length === 0) {
      return <p className="nl-teamprofile-empty">Keine Spieler im Kader.</p>;
    }
    return (
      <div className="nl-teamprofile-table-shell">
        <table className="nl-teamprofile-table nl-tnum">
          <thead>
            <tr>
              <th className="nl-teamprofile-th-player">Spieler</th>
              <th className="nl-teamprofile-th-role">Rolle</th>
              <th>OVR</th>
              <th>MVS</th>
              <th>PPs</th>
              <th>MW</th>
              <th>Gehalt</th>
              <th>LZ</th>
              <th className="nl-teamprofile-th-disciplines">Top-Disziplinen</th>
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.map((player) => {
              const isContractExpiring = (player.contractLength ?? 0) <= 1;
              return (
                <tr
                  key={player.activePlayerId}
                  className={`nl-teamprofile-table-row${isContractExpiring ? " is-contract-expiring" : ""}`}
                  onClick={() => onOpenPlayer(player.playerId, player.activePlayerId)}
                  title={`${player.name} öffnen${player.issueTags.length > 0 ? ` · Hinweise: ${player.issueTags.join(", ")}` : ""}`}
                >
                  <td className="nl-teamprofile-td-player">
                    <button
                      type="button"
                      className="nl-teamprofile-playerlink"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenPlayer(player.playerId, player.activePlayerId);
                      }}
                    >
                      <span className="nl-teamprofile-playername">{player.name}</span>
                      <span className="nl-teamprofile-playermeta">
                        {player.className ?? "—"} · {player.race ?? "—"}
                      </span>
                    </button>
                  </td>
                  <td className="nl-teamprofile-td-role">{getRoleLabel(player.roleTag) || "—"}</td>
                  <td>{formatNlNumber(player.ovr, 0)}</td>
                  <td>{formatNlNumber(player.mvs, 1)}</td>
                  <td>{formatNlNumber(player.pps, 1)}</td>
                  <td>
                    <span className="nl-teamprofile-money-stack">
                      <span>{formatNlNumber(player.marketValue, 2)}</span>
                      {isFiniteNumber(player.marketValueDelta) && Math.abs(player.marketValueDelta) >= 0.01 ? (
                        <small className={player.marketValueDelta >= 0 ? "text-positive" : "text-negative"}>
                          {formatSignedNlNumber(player.marketValueDelta, 2)}
                        </small>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    <span className="nl-teamprofile-money-stack">
                      <span>{formatNlNumber(player.salary, 2)}</span>
                      {isFiniteNumber(player.salaryDelta) && Math.abs(player.salaryDelta) >= 0.01 ? (
                        <small className={player.salaryDelta <= 0 ? "text-positive" : "text-negative"}>
                          {formatSignedNlNumber(player.salaryDelta, 2)}
                        </small>
                      ) : null}
                    </span>
                  </td>
                  <td>{formatNlNumber(player.contractLength, 0)}</td>
                  <td className="nl-teamprofile-td-disciplines">
                    {player.d1Label}
                    {isFiniteNumber(player.d1Score) ? ` ${formatNlNumber(player.d1Score, 1)}` : ""}
                    {player.d2Label ? ` · ${player.d2Label}` : ""}
                    {isFiniteNumber(player.d2Score) ? ` ${formatNlNumber(player.d2Score, 1)}` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const controlModeLabel = formatControlModeLabel(data.controlMode);
  const teamCaptain = data.teamCaptain;
  const boardTone =
    data.boardConfidence == null
      ? "neutral"
      : data.boardConfidence.pressure >= 8
        ? "risk"
        : data.boardConfidence.value >= 7
          ? "good"
          : "neutral";

  function renderRangPanel() {
    return (
      <div className="nl-kpipop-inner">
        <div className="nl-kpipop-head">
          <div className="nl-kpipop-head-copy">
            <span className="nl-kpipop-eyebrow">Saisonstand</span>
            <strong className="nl-kpipop-title">Ligatabelle</strong>
          </div>
          {data.history.length > 0 ? (
            <button
              type="button"
              className="nl-kpipop-jump"
              onClick={() => scrollToSection(historyCardRef)}
            >
              Zum Saisonstand springen →
            </button>
          ) : null}
        </div>
        {standingsHoverRows.length === 0 ? (
          <p className="nl-kpipop-empty">Kein Ligakontext verfügbar.</p>
        ) : (
          <ol className="nl-kpipop-standings nl-tnum">
            {standingsHoverRows.map((row) => (
              <li
                key={row.teamId}
                className={`nl-kpipop-standrow${row.isOwn ? " is-own" : ""}`}
              >
                <span className="nl-kpipop-standrank">#{formatNlNumber(row.displayRank, 0)}</span>
                <span className="nl-kpipop-standmain">
                  <span className="nl-kpipop-standtop">
                    <span className="nl-kpipop-standcode" title={row.teamName}>
                      {row.shortCode}
                    </span>
                    <span className="nl-kpipop-standpts">
                      {formatNlNumber(row.points, 1)} P · {formatNlNumber(row.pps, 0)} PPs
                    </span>
                  </span>
                  <span className="nl-kpipop-standaxes">
                    {NL_TEAMPROFILE_AXES.map(({ key, label }) => (
                      <span key={key} className={`nl-kpipop-axis ${nlToneClass(key)}`}>
                        {label} {formatNlNumber(row[key], 0)}
                      </span>
                    ))}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  function renderGuvLine(label: string, sign: "" | "−" | "+", value: number | null, tone?: NlTone, isResult?: boolean) {
    return (
      <div className={`nl-kpipop-guvrow${isResult ? " is-result" : ""}`}>
        <span className="nl-kpipop-guvlabel">
          {sign ? <span className="nl-kpipop-guvsign">{sign}</span> : null}
          {label}
        </span>
        <span className={`nl-kpipop-guvval${tone ? ` ${nlToneClass(tone)}` : ""}`}>{formatNlMoney(value)}</span>
      </div>
    );
  }

  function renderCashPanel() {
    const { cash, salaryTotal, facilityUpkeep, facilityIncome, sponsorBase, projected } = cashBreakdown;
    return (
      <div className="nl-kpipop-inner">
        <div className="nl-kpipop-head">
          <div className="nl-kpipop-head-copy">
            <span className="nl-kpipop-eyebrow">Cash</span>
            <strong className="nl-kpipop-title">GuV (Projektion)</strong>
          </div>
        </div>
        <div className="nl-kpipop-guv">
          {renderGuvLine("Cash", "", cash)}
          {renderGuvLine("Gehälter", "−", salaryTotal, "risk")}
          {facilityUpkeep != null ? renderGuvLine("Gebäude-Unterhalt", "−", facilityUpkeep, "risk") : null}
          {facilityIncome != null ? renderGuvLine("Gebäude-Einnahmen", "+", facilityIncome, "good") : null}
          {sponsorBase != null ? renderGuvLine("Sponsoren (Basis)", "+", sponsorBase, "good") : null}
          {projected != null
            ? renderGuvLine("≈ Saison-Ende", "", projected, projected < 0 ? "risk" : "good", true)
            : null}
        </div>
        {facilityUpkeep == null && sponsorBase == null ? (
          <p className="nl-kpipop-note">Gebäude-/Sponsoren-Zeilen benötigen Liga-Kontext.</p>
        ) : (
          <p className="nl-kpipop-note">Prämien fließen nicht ein (benchmark-only).</p>
        )}
      </div>
    );
  }

  function renderMwPanel() {
    return (
      <div className="nl-kpipop-inner">
        <div className="nl-kpipop-head">
          <div className="nl-kpipop-head-copy">
            <span className="nl-kpipop-eyebrow">Marktwert</span>
            <strong className="nl-kpipop-title">Zusammensetzung</strong>
          </div>
          <span className="nl-kpipop-total">{formatNlMoney(mwBreakdown.total)}</span>
        </div>
        {!isOwnedTeam ? (
          <p className="nl-kpipop-note">Einzel-Marktwerte verdeckt (fremdes Team). Nur Kader-Summe sichtbar.</p>
        ) : mwBreakdown.rows.length === 0 ? (
          <p className="nl-kpipop-empty">Keine Marktwerte im Kader.</p>
        ) : (
          <ol className="nl-kpipop-players nl-tnum">
            {mwBreakdown.rows.slice(0, NL_HEADER_HOVER_MAX_ROWS).map((row) => (
              <li key={row.id} className="nl-kpipop-playrow">
                <button
                  type="button"
                  className="nl-kpipop-playbtn"
                  onClick={() => onOpenPlayer(row.playerId, row.playerId)}
                  title={`${row.name} öffnen`}
                >
                  <span className="nl-kpipop-playname">{row.name}</span>
                  <span className="nl-kpipop-playval">{formatNlMoney(row.marketValue)}</span>
                </button>
              </li>
            ))}
            {mwBreakdown.rows.length > NL_HEADER_HOVER_MAX_ROWS ? (
              <li className="nl-kpipop-more">
                … +{formatNlNumber(mwBreakdown.rows.length - NL_HEADER_HOVER_MAX_ROWS, 0)} weitere ·{" "}
                {formatNlMoney(mwBreakdown.sum)} Summe
              </li>
            ) : null}
          </ol>
        )}
      </div>
    );
  }

  function renderGehaltPanel() {
    return (
      <div className="nl-kpipop-inner">
        <div className="nl-kpipop-head">
          <div className="nl-kpipop-head-copy">
            <span className="nl-kpipop-eyebrow">Gehalt</span>
            <strong className="nl-kpipop-title">Gehaltsblock</strong>
          </div>
          <span className="nl-kpipop-total">{formatNlMoney(salaryBreakdown.total)}</span>
        </div>
        {!isOwnedTeam ? (
          <p className="nl-kpipop-note">Einzel-Gehälter/Verträge verdeckt (fremdes Team). Nur Kader-Summe sichtbar.</p>
        ) : salaryBreakdown.rows.length === 0 ? (
          <p className="nl-kpipop-empty">Keine Gehälter im Kader.</p>
        ) : (
          <ol className="nl-kpipop-players nl-tnum">
            {salaryBreakdown.rows.slice(0, NL_HEADER_HOVER_MAX_ROWS).map((row) => {
              const shape = getContractShapeTag(row.shape);
              return (
                <li key={row.id} className="nl-kpipop-playrow">
                  <button
                    type="button"
                    className="nl-kpipop-playbtn"
                    onClick={() => onOpenPlayer(row.playerId, row.playerId)}
                    title={`${row.name} öffnen · Vertrag: ${shape.label}`}
                  >
                    <span className="nl-kpipop-playname">
                      {row.name}
                      <span className={`nl-kpipop-shape ${nlToneClass(shape.tone)}`} title={shape.label}>
                        {shape.tag}
                      </span>
                    </span>
                    <span className="nl-kpipop-playval">{formatNlMoney(row.salary)}</span>
                  </button>
                </li>
              );
            })}
            {salaryBreakdown.rows.length > NL_HEADER_HOVER_MAX_ROWS ? (
              <li className="nl-kpipop-more">
                … +{formatNlNumber(salaryBreakdown.rows.length - NL_HEADER_HOVER_MAX_ROWS, 0)} weitere ·{" "}
                {formatNlMoney(salaryBreakdown.sum)} Summe
              </li>
            ) : null}
          </ol>
        )}
      </div>
    );
  }

  return (
    <div className="nl-teamprofile" data-testid="foundation-team-profile" data-new-look="true">
      <NlCard className="nl-teamprofile-hero-card" data-testid="nl-teamprofile-hero">
        <div className="nl-teamprofile-hero" style={getSeasonV2TeamTagStyle(data.shortCode)}>
          <div className="nl-teamprofile-hero-identity">
            <OptimizedMediaImage
              className="nl-teamprofile-crest"
              src={data.logoUrl}
              alt={`${data.teamName} Logo`}
              width={72}
              height={72}
              loading="eager"
              fetchPriority="high"
              fallback={<span className="nl-teamprofile-crest nl-teamprofile-crest-fallback">{data.logoInitials}</span>}
            />
            <div className="nl-teamprofile-hero-copy">
              <span className="nl-teamprofile-hero-eyebrow">
                Team-Profil · {data.shortCode} · {controlModeLabel}
              </span>
              <h2 className="nl-teamprofile-hero-name">{data.teamName}</h2>
              <StatChipRow className="nl-teamprofile-hero-chips" aria-label={`Kennzahlen ${data.teamName}`}>
                <HeaderKpiHover
                  panelId="nl-teamprofile-rang-pop"
                  ariaLabel={`Rang ${data.teamName} — Ligatabelle`}
                  align="start"
                  chip={
                    <StatChip
                      label="Rang"
                      value={liveHistoryRow?.rank != null ? `#${formatNlNumber(liveHistoryRow.rank, 0)}` : "—"}
                      tone="accent"
                      title="Ligarang — Details im Hover"
                    />
                  }
                >
                  {renderRangPanel()}
                </HeaderKpiHover>
                <StatChip
                  label="Punkte"
                  value={formatNlNumber(liveHistoryRow?.points, 1)}
                  onClick={developmentSeries != null ? () => scrollToSection(developmentCardRef) : undefined}
                  title={developmentSeries != null ? "Zum Saison-Verlauf springen" : undefined}
                />
                <StatChip
                  label="Kader"
                  value={formatNlNumber(data.rosterSize, 0)}
                  sub={teamSummary.avgOvr != null ? `Ø OVR ${formatNlNumber(teamSummary.avgOvr, 1)}` : undefined}
                  onClick={() => scrollToSection(rosterCardRef)}
                  title="Zum Kader springen"
                />
                <HeaderKpiHover
                  panelId="nl-teamprofile-cash-pop"
                  ariaLabel={`Cash ${data.teamName} — GuV`}
                  align="start"
                  chip={
                    <StatChip
                      label="Cash"
                      value={formatNlNumber(data.cash, 1)}
                      tone={data.cash != null && data.cash < 0 ? "risk" : "neutral"}
                      title="Liquide Mittel — GuV im Hover"
                    />
                  }
                >
                  {renderCashPanel()}
                </HeaderKpiHover>
                <HeaderKpiHover
                  panelId="nl-teamprofile-mw-pop"
                  ariaLabel={`Marktwert ${data.teamName} — Zusammensetzung`}
                  align="end"
                  chip={
                    <StatChip label="MW" value={formatNlNumber(data.marketValueTotal, 2)} title="Marktwert gesamt — Aufschlüsselung im Hover" />
                  }
                >
                  {renderMwPanel()}
                </HeaderKpiHover>
                <HeaderKpiHover
                  panelId="nl-teamprofile-gehalt-pop"
                  ariaLabel={`Gehalt ${data.teamName} — Aufschlüsselung`}
                  align="end"
                  chip={
                    <StatChip label="Gehalt" value={formatNlNumber(data.salaryTotal, 2)} title="Gehaltsblock des Kaders — Aufschlüsselung im Hover" />
                  }
                >
                  {renderGehaltPanel()}
                </HeaderKpiHover>
                {teamSummary.expiringCount > 0 ? (
                  <StatChip
                    label="Auslaufend"
                    value={formatNlNumber(teamSummary.expiringCount, 0)}
                    tone="warn"
                    onClick={() => {
                      setRosterMode("tabelle");
                      scrollToSection(rosterCardRef);
                    }}
                    title="Verträge mit Restlaufzeit ≤ 1 — zur Kadertabelle springen"
                  />
                ) : null}
                {data.boardConfidence != null ? (
                  <StatChip
                    label="Board"
                    value={`${formatNlNumber(data.boardConfidence.value, 1)}/10`}
                    tone={boardTone}
                    onClick={() => scrollToSection(boardCardRef)}
                    title="Zu Board & Führung springen"
                  />
                ) : null}
              </StatChipRow>
              {seasonDeltas != null && previousSeasonRow != null ? (
                <div
                  className="nl-teamprofile-hero-deltas"
                  role="group"
                  aria-label={`Veränderung gegenüber ${previousSeasonRow.seasonName}`}
                >
                  <span className="nl-teamprofile-hero-deltas-label">ggü. {previousSeasonRow.seasonName}</span>
                  {seasonDeltas.rankDelta != null ? (
                    <span className="nl-teamprofile-hero-delta">
                      Rang
                      <NlDeltaChip
                        value={seasonDeltas.rankDelta}
                        format={(n) => formatSignedNlNumber(n, 0)}
                        title={`Rang: #${formatNlNumber(previousSeasonRow.rank, 0)} → #${formatNlNumber(liveHistoryRow?.rank, 0)}`}
                      />
                    </span>
                  ) : null}
                  {seasonDeltas.pointsDelta != null ? (
                    <span className="nl-teamprofile-hero-delta">
                      Punkte
                      <NlDeltaChip
                        value={seasonDeltas.pointsDelta}
                        format={(n) => formatSignedNlNumber(n, 1)}
                        title={`Punkte: ${formatNlNumber(previousSeasonRow.points, 1)} → ${formatNlNumber(liveHistoryRow?.points, 1)}`}
                      />
                    </span>
                  ) : null}
                  {seasonDeltas.marketValueDelta != null ? (
                    <span className="nl-teamprofile-hero-delta">
                      MW
                      <NlDeltaChip
                        value={seasonDeltas.marketValueDelta}
                        format={(n) => formatSignedNlNumber(n, 2)}
                        title={`Marktwert: ${formatNlNumber(previousSeasonRow.marketValue, 2)} → ${formatNlNumber(liveHistoryRow?.marketValue, 2)}`}
                      />
                    </span>
                  ) : null}
                  {seasonDeltas.cashDelta != null ? (
                    <span className="nl-teamprofile-hero-delta">
                      Cash
                      <NlDeltaChip
                        value={seasonDeltas.cashDelta}
                        format={(n) => formatSignedNlNumber(n, 1)}
                        title={`Cash: ${formatNlNumber(previousSeasonRow.cash, 1)} → ${formatNlNumber(liveHistoryRow?.cash, 1)}`}
                      />
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="nl-teamprofile-hero-side">
            <div className="nl-teamprofile-hero-actions">
              {onOpenContracts ? (
                <button type="button" className="nl-teamprofile-action is-primary" onClick={onOpenContracts}>
                  Verträge
                </button>
              ) : null}
              <button type="button" className="nl-teamprofile-action" onClick={onClose}>
                Zurück
              </button>
            </div>
            <div
              className="nl-teamprofile-axes"
              role="group"
              aria-label={`Bereichs-Ränge ${data.teamName}`}
            >
              {NL_TEAMPROFILE_AXES.map(({ key, label, rankKey }) => {
                const rank = data[rankKey];
                return (
                  <span
                    key={key}
                    className={`nl-teamprofile-axis ${nlToneClass(key)}`}
                    title={getTeamAxisRankTooltip(label)}
                  >
                    <span className="nl-teamprofile-axis-label">{label}</span>
                    <span className="nl-teamprofile-axis-rank nl-tnum">
                      {isFiniteNumber(rank) ? `#${formatNlNumber(rank, 0)}` : "—"}
                    </span>
                  </span>
                );
              })}
            </div>
            {radarAxes.length > 0 ? (
              <figure className="nl-teamprofile-radar-figure">
                <NlRadar
                  axes={radarAxes}
                  max={teamCount}
                  className="nl-teamprofile-radar"
                  aria-label={`Stärkenprofil von ${data.teamName}: Bereichs-Ränge im Liga-Vergleich, außen = stärker`}
                />
                <figcaption className="nl-teamprofile-radar-caption">Stärkenprofil · außen = liga-stark</figcaption>
              </figure>
            ) : null}
          </div>
        </div>
      </NlCard>

      {developmentSeries != null ? (
        <div ref={developmentCardRef} className="nl-teamprofile-anchor">
          <NlCard
            className="nl-teamprofile-development-card"
            eyebrow="Entwicklung"
            title="Saison-Verlauf"
            data-testid="nl-teamprofile-development"
            actions={
              <span className="nl-teamprofile-count nl-tnum">
                {developmentRows.length} {developmentRows.length === 1 ? "Saison" : "Saisons"}
              </span>
            }
          >
            <div className="nl-teamprofile-development-grid">
              <article className="nl-teamprofile-development-metric">
                <header className="nl-teamprofile-development-head">
                  <span className="nl-teamprofile-development-label">Rang</span>
                  <span className="nl-teamprofile-development-value nl-tnum">
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
                    className="nl-teamprofile-development-spark"
                    aria-label={`Rang-Verlauf von ${data.teamName} über ${developmentRows.length} Saisons (oben = besser)`}
                  />
                ) : (
                  <p className="nl-teamprofile-empty">Kein Rang-Verlauf vorhanden.</p>
                )}
                <p className="nl-teamprofile-development-meta">
                  {developmentSeries.bestRank != null ? `Best #${formatNlNumber(developmentSeries.bestRank, 0)}` : "—"}
                  {developmentSeries.avgRank != null ? ` · Ø #${formatNlNumber(developmentSeries.avgRank, 1)}` : ""}
                </p>
              </article>
              <article className="nl-teamprofile-development-metric is-points">
                <header className="nl-teamprofile-development-head">
                  <span className="nl-teamprofile-development-label">Punkte</span>
                  <span className="nl-teamprofile-development-value nl-tnum">
                    {formatNlNumber(liveHistoryRow?.points, 1)}
                  </span>
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
                    className="nl-teamprofile-development-bars"
                    aria-label={`Punkte pro Saison von ${data.teamName}`}
                  />
                ) : (
                  <p className="nl-teamprofile-empty">Keine Punktedaten vorhanden.</p>
                )}
                <p className="nl-teamprofile-development-meta">
                  {developmentSeries.pointsAvg != null ? `Ø ${formatNlNumber(developmentSeries.pointsAvg, 1)}` : "—"}
                </p>
              </article>
              <article className="nl-teamprofile-development-metric">
                <header className="nl-teamprofile-development-head">
                  <span className="nl-teamprofile-development-label">Marktwert</span>
                  <span className="nl-teamprofile-development-value nl-tnum">
                    {formatNlNumber(liveHistoryRow?.marketValue, 2)}
                  </span>
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
                    className="nl-teamprofile-development-spark"
                    aria-label={`Marktwert-Verlauf von ${data.teamName} über ${developmentRows.length} Saisons`}
                  />
                ) : (
                  <p className="nl-teamprofile-empty">Kein Marktwert-Verlauf vorhanden.</p>
                )}
                <p className="nl-teamprofile-development-meta">
                  {developmentSeries.marketValueSpark.length >= 2
                    ? `von ${formatNlNumber(developmentSeries.marketValueSpark[0], 2)} auf ${formatNlNumber(developmentSeries.marketValueSpark[developmentSeries.marketValueSpark.length - 1], 2)}`
                    : "—"}
                </p>
              </article>
              <article className="nl-teamprofile-development-metric">
                <header className="nl-teamprofile-development-head">
                  <span className="nl-teamprofile-development-label">Cash</span>
                  <span className="nl-teamprofile-development-value nl-tnum">
                    {formatNlNumber(liveHistoryRow?.cash, 1)}
                  </span>
                  {seasonDeltas?.cashDelta != null ? (
                    <NlDeltaChip
                      value={seasonDeltas.cashDelta}
                      format={(n) => formatSignedNlNumber(n, 1)}
                      title={`Cash ggü. ${previousSeasonRow?.seasonName ?? "Vorsaison"}`}
                    />
                  ) : null}
                </header>
                {developmentSeries.cashSpark.length >= 2 ? (
                  <NlSparkline
                    points={developmentSeries.cashSpark}
                    tone="good"
                    className="nl-teamprofile-development-spark"
                    aria-label={`Cash-Verlauf von ${data.teamName} über ${developmentRows.length} Saisons`}
                  />
                ) : (
                  <p className="nl-teamprofile-empty">Kein Cash-Verlauf vorhanden.</p>
                )}
                <p className="nl-teamprofile-development-meta">
                  {developmentSeries.cashSpark.length >= 2
                    ? `von ${formatNlNumber(developmentSeries.cashSpark[0], 1)} auf ${formatNlNumber(developmentSeries.cashSpark[developmentSeries.cashSpark.length - 1], 1)}`
                    : "—"}
                </p>
              </article>
            </div>
            <ol className="nl-teamprofile-development-seasons" aria-label="Saisons im Verlauf">
              {developmentRows.map((row) => (
                <li
                  key={row.seasonId}
                  className={`nl-teamprofile-development-season${row.isLive ? " is-live" : ""}`}
                  title={`${row.seasonName}${row.rank != null ? ` · Rang #${formatNlNumber(row.rank, 0)}` : ""}${
                    row.points != null ? ` · ${formatNlNumber(row.points, 1)} Punkte` : ""
                  }`}
                >
                  <span className="nl-teamprofile-development-season-name">
                    {formatNlSeasonShortLabel(row.seasonName, row.seasonId)}
                  </span>
                  <span className="nl-teamprofile-development-season-rank nl-tnum">
                    {row.rank != null ? `#${formatNlNumber(row.rank, 0)}` : "—"}
                  </span>
                  {row.isLive ? <span className="nl-teamprofile-development-season-live">Live</span> : null}
                </li>
              ))}
            </ol>
          </NlCard>
        </div>
      ) : null}

      <div ref={rosterCardRef} className="nl-teamprofile-anchor">
        <NlCard
          className="nl-teamprofile-roster-card"
          eyebrow="Kaderprofil"
          title="Kader"
          data-testid="nl-teamprofile-roster"
          actions={
            <NlSubTabs
              items={NL_TEAMPROFILE_ROSTER_MODE_ITEMS.map((item) => ({
                ...item,
                count: visiblePlayers.length,
              }))}
              activeId={rosterMode}
              onSelect={(id) => setRosterMode(id as NlTeamProfileRosterMode)}
              aria-label="Kader-Ansicht wählen"
              className="nl-teamprofile-roster-subtabs"
            />
          }
        >
          <p className="nl-teamprofile-roster-summary nl-tnum">
            Ø OVR {formatNlNumber(teamSummary.avgOvr, 1)} · Ø Gehalt {formatNlNumber(teamSummary.avgSalary, 2)} ·{" "}
            {teamSummary.expiringCount} laufen aus · {teamSummary.issueCount} Hinweise
          </p>
          {rosterMode === "portraits" ? renderRosterGrid() : renderRosterTable()}
        </NlCard>
      </div>

      {depthChart != null || depthChartFallback != null ? (
        <NlCard
          className="nl-teamprofile-depth-card"
          eyebrow="Kadertiefe"
          title="Squad Depth Chart"
          data-testid="nl-teamprofile-depth"
          actions={
            rosterStressRecord != null ? (
              <span
                className="nl-teamprofile-count nl-tnum"
                title={`Engpässe an ${rosterStressRecord.matchdaysWithSlotGaps}/${rosterStressRecord.matchdaysTotal} Spieltagen der Vorsaison`}
              >
                Stress {formatNlNumber(rosterStressRecord.depthStressScore, 0)}/4
              </span>
            ) : undefined
          }
        >
          {rosterStressRecord != null ? (
            <NlProgressBar
              value={rosterStressRecord.depthStressScore}
              max={4}
              invert
              label="Tiefe-Stress (Vorsaison)"
              format={(value) => `${formatNlNumber(value, 0)}/4 · ${rosterStressRecord.matchdaysWithSlotGaps}/${rosterStressRecord.matchdaysTotal} Spieltage mit Lücken`}
              className="nl-teamprofile-depth-stress-bar"
              title="Depth-Stress-Score aus der Vorsaison-Aufstellungshistorie"
            />
          ) : null}
          {depthChart != null ? (
            <div className="nl-teamprofile-depth-shell">
              <table className="nl-teamprofile-depth-table nl-tnum">
                <thead>
                  <tr>
                    <th className="nl-teamprofile-depth-th-discipline">Disziplin</th>
                    <th>Fähig</th>
                    <th>1.</th>
                    <th>2.</th>
                    <th>3.</th>
                    <th>4.</th>
                    <th>5.</th>
                    <th>6.</th>
                  </tr>
                </thead>
                <tbody>
                  {depthChart.map((row) => (
                    <tr
                      key={row.disciplineId}
                      className={`nl-teamprofile-depth-row${row.isThin ? " is-thin" : ""}`}
                    >
                      <td className={`nl-teamprofile-depth-discipline ${nlToneClass(row.axis)}`}>
                        <span className="nl-teamprofile-depth-axis-dot" aria-hidden="true" />
                        {row.disciplineLabel}
                      </td>
                      <td
                        className="nl-teamprofile-depth-slots"
                        title={
                          row.slotsNeeded != null
                            ? `${row.capableCount} von ${row.slotsNeeded} Slots mit Rating ≥ ${DEPTH_CAPABLE_RATING_FLOOR} besetzbar`
                            : `${row.capableCount} Spieler mit Rating ≥ ${DEPTH_CAPABLE_RATING_FLOOR}`
                        }
                      >
                        {row.slotsNeeded != null
                          ? `${row.capableCount}/${row.slotsNeeded}`
                          : formatNlNumber(row.capableCount, 0)}
                      </td>
                      {row.cells.map((cell, index) => (
                        <td key={index} className="nl-teamprofile-depth-cell-wrap">
                          {cell != null ? (
                            <button
                              type="button"
                              className={`nl-teamprofile-depth-cell ${nlToneClass(getDepthRatingTone(cell.rating))}`}
                              onClick={() => onOpenPlayer(cell.playerId, cell.playerId)}
                              title={`${cell.playerName} · ${row.disciplineLabel} ${formatNlNumber(cell.rating, 0)}`}
                            >
                              <span className="nl-teamprofile-depth-cell-name">{cell.playerName}</span>
                              <span className="nl-teamprofile-depth-cell-rating nl-tnum">
                                {formatNlNumber(cell.rating, 0)}
                              </span>
                              {cell.injuryStatus === "injured" || cell.injuryStatus === "recovering" ? (
                                <span
                                  className="nl-teamprofile-depth-badge is-injury"
                                  title={cell.injuryStatus === "injured" ? "Verletzt" : "In Reha"}
                                >
                                  V
                                </span>
                              ) : cell.fatigue != null && cell.fatigue >= DEPTH_FATIGUE_WARN_THRESHOLD ? (
                                <span
                                  className="nl-teamprofile-depth-badge is-fatigue"
                                  title={`Erschöpfung ${formatNlNumber(cell.fatigue, 0)}`}
                                >
                                  M
                                </span>
                              ) : null}
                            </button>
                          ) : (
                            <span className="nl-teamprofile-depth-cell is-empty">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : depthChartFallback != null ? (
            <>
              <p className="nl-teamprofile-empty">
                Vereinfachte Ansicht (Achsen statt Einzeldisziplinen) — volle Disziplin-Tiefe benötigt Spielkontext.
              </p>
              <div className="nl-teamprofile-depth-shell">
                {/* Transponiert: Achsen als Spalten (POW/SPE/MEN/SOC), Tiefe-Ränge (1.–6.) als Zeilen. */}
                <table className="nl-teamprofile-depth-table nl-tnum">
                  <thead>
                    <tr>
                      <th className="nl-teamprofile-depth-th-discipline">Tiefe</th>
                      {depthChartFallback.map((column) => (
                        <th
                          key={column.axis}
                          className={nlToneClass(column.axis)}
                          style={{ color: "var(--nl-tone)" }}
                        >
                          <span className="nl-teamprofile-depth-axis-dot" aria-hidden="true" />{" "}
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4, 5].map((rank) => (
                      <tr key={rank} className="nl-teamprofile-depth-row">
                        <td
                          className="nl-teamprofile-depth-slots"
                          style={{ textAlign: "left", fontWeight: 600 }}
                        >
                          {`${rank + 1}.`}
                        </td>
                        {depthChartFallback.map((column) => {
                          const cell = column.cells[rank] ?? null;
                          return (
                            <td key={column.axis} className="nl-teamprofile-depth-cell-wrap">
                              {cell != null ? (
                                <button
                                  type="button"
                                  className={`nl-teamprofile-depth-cell ${nlToneClass(getDepthRatingTone(cell.rating))}`}
                                  onClick={() => onOpenPlayer(cell.playerId, cell.playerId)}
                                  title={`${cell.playerName} · ${column.label} ${formatNlNumber(cell.rating, 0)}`}
                                >
                                  <span className="nl-teamprofile-depth-cell-name">{cell.playerName}</span>
                                  <span className="nl-teamprofile-depth-cell-rating nl-tnum">
                                    {formatNlNumber(cell.rating, 0)}
                                  </span>
                                </button>
                              ) : (
                                <span className="nl-teamprofile-depth-cell is-empty">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </NlCard>
      ) : null}

      {beliebtheit != null ? (
        <NlCard
          className="nl-teamprofile-fan-card"
          eyebrow="Fans"
          title="Fans & Beliebtheit"
          data-testid="nl-teamprofile-fan"
        >
          <div className="nl-teamprofile-fan-grid">
            <NlGauge
              value={((beliebtheit.value - BELIEBTHEIT_MIN) / (BELIEBTHEIT_MAX - BELIEBTHEIT_MIN)) * 100}
              max={100}
              label="Beliebtheit"
              tone={getBeliebtheitTone(beliebtheit.value)}
              format={() => `${formatNlNumber(beliebtheit.value, 2)}×`}
              title={`Beliebtheitsfaktor ${formatNlNumber(beliebtheit.value, 2)}× (1.0× = Liga-Durchschnitt)`}
            />
            <div className="nl-teamprofile-fan-bars">
              <NlProgressBar
                value={beliebtheit.erfolg * 100}
                max={100}
                label="Erfolg"
                format={(value) => `${formatNlNumber(value, 0)}%`}
                title="Rang-/Punkte-Perzentil in der Liga"
              />
              <NlProgressBar
                value={beliebtheit.favShare * 100}
                max={100}
                label="Fan-Favoriten"
                format={(value) => `${formatNlNumber(value, 0)}%`}
                title="Anteil Fan-Favoriten-Kader ggü. Liga-Maximum"
              />
              <NlProgressBar
                value={beliebtheit.starpower * 100}
                max={100}
                label="Starpower"
                format={(value) => `${formatNlNumber(value, 0)}%`}
                title="Top-6-OVR-Perzentil in der Liga"
              />
            </div>
          </div>
          {fanFavoritePlayers.length > 0 ? (
            <div className="nl-teamprofile-fan-chips" aria-label="Fan-Favoriten im Kader">
              {fanFavoritePlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className="nl-teamprofile-fan-chip"
                  onClick={() => onOpenPlayer(player.id, player.id)}
                  title={`${player.name} öffnen`}
                >
                  {player.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="nl-teamprofile-empty">Keine Fan-Favoriten im aktuellen Kader.</p>
          )}
          <p className="nl-teamprofile-fan-consequence nl-tnum">
            Arena-Einnahmen ×{formatNlNumber(beliebtheit.value, 2)}
          </p>
        </NlCard>
      ) : null}

      <div ref={boardCardRef} className="nl-teamprofile-anchor">
        <NlCard
          className="nl-teamprofile-board-card"
          eyebrow="Führung"
          title="Board & Führung"
          data-testid="nl-teamprofile-board"
        >
          <div className="nl-teamprofile-lead-grid">
            {data.boardConfidence != null ? (
              <article className={`nl-teamprofile-lead-card is-${boardTone} nl-teamprofile-board-lead`}>
                <span className="nl-teamprofile-lead-label">Board-Vertrauen</span>
                <div className="nl-teamprofile-board-gauge-row">
                  <NlGauge
                    value={data.boardConfidence.value}
                    max={10}
                    label="Vertrauen"
                    tone={boardTone === "neutral" ? "accent" : boardTone}
                    format={(value) => formatNlNumber(value, 1)}
                    title={`Board-Vertrauen ${formatNlNumber(data.boardConfidence.value, 1)}/10`}
                  />
                  <div className="nl-teamprofile-board-meter-stack">
                    <NlProgressBar
                      value={data.boardConfidence.pressure}
                      max={10}
                      label="Druck"
                      invert
                      format={(value) => `${formatNlNumber(value, 1)}/10`}
                      className="nl-teamprofile-board-pressure-bar"
                      title={`Board-Druck ${formatNlNumber(data.boardConfidence.pressure, 1)}/10`}
                    />
                    {boardConfidenceSeries != null ? (
                      <div className="nl-teamprofile-board-history">
                        <span className="nl-teamprofile-board-history-label nl-tnum">
                          Verlauf · {boardConfidenceSeries.length} Saisons
                        </span>
                        <NlSparkline
                          points={boardConfidenceSeries}
                          tone={boardTone === "neutral" ? "accent" : boardTone}
                          className="nl-teamprofile-board-spark"
                          aria-label={`Board-Vertrauen-Verlauf von ${data.teamName} über ${boardConfidenceSeries.length} Saisons`}
                        />
                      </div>
                    ) : (
                      <p className="nl-teamprofile-empty nl-teamprofile-board-history-empty">
                        Kein Mehrsaison-Verlauf archiviert.
                      </p>
                    )}
                  </div>
                </div>
                <small className="nl-tnum">{data.boardConfidence.warnings.length} Warnungen</small>
                {data.boardConfidence.warnings.length > 0 ? (
                  <ul className="nl-teamprofile-board-warnings">
                    {data.boardConfidence.warnings.slice(0, 3).map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ) : null}
            {teamCaptain != null ? (
              <article className="nl-teamprofile-lead-card is-good">
                <span className="nl-teamprofile-lead-label">Team Captain</span>
                <strong>
                  <button
                    type="button"
                    className="nl-teamprofile-playerlink is-inline"
                    onClick={() => onOpenPlayer(teamCaptain.playerId, teamCaptain.playerId)}
                    title={`${teamCaptain.playerName} öffnen`}
                  >
                    {teamCaptain.playerName}
                  </button>
                </strong>
                <small className="nl-tnum">
                  {teamCaptain.style} · Lead {formatNlNumber(teamCaptain.leadershipScore, 1)} · Druck −
                  {formatNlNumber(teamCaptain.effects.rivalryPressureReductionPct, 1)}%
                </small>
                {teamCaptain.traitSignals.length > 0 ? (
                  <small className="nl-teamprofile-lead-traits">{teamCaptain.traitSignals.join(" · ")}</small>
                ) : null}
              </article>
            ) : null}
            {data.generalManager != null ? (
              <article className="nl-teamprofile-lead-card is-gm">
                <span className="nl-teamprofile-lead-label">General Manager</span>
                <strong>{data.generalManager.name}</strong>
                <small className="nl-tnum">
                  {data.generalManager.title} · Einfluss {formatNlNumber(data.generalManager.influencePct, 0)}%
                </small>
                <div className="nl-teamprofile-gm-axes nl-tnum" aria-label="GM Achsen">
                  <span className={nlToneClass("pow")}>POW {formatNlNumber(data.generalManager.pow, 1)}</span>
                  <span className={nlToneClass("spe")}>SPE {formatNlNumber(data.generalManager.spe, 1)}</span>
                  <span className={nlToneClass("men")}>MEN {formatNlNumber(data.generalManager.men, 1)}</span>
                  <span className={nlToneClass("soc")}>SOC {formatNlNumber(data.generalManager.soc, 1)}</span>
                </div>
                <small className="nl-teamprofile-gm-doctrine">
                  {data.generalManager.marketDoctrine} · {data.generalManager.lineupDoctrine}
                </small>
                {data.generalManager.facilityPriorities.length > 0 ? (
                  <small className="nl-teamprofile-gm-doctrine">
                    Fokus: {data.generalManager.facilityPriorities.slice(0, 3).join(" · ")}
                  </small>
                ) : null}
              </article>
            ) : null}
          </div>
          <div className="nl-teamprofile-relations" aria-label="Teambeziehungen">
            {renderRelationshipColumn(data.relationships.allies, "Ally", "good", "Keine Ally-Beziehung ab 4+")}
            {renderRelationshipColumn(data.relationships.rivals, "Rival", "risk", "Keine Rivalität ab -4")}
          </div>
          {groupedObjectives.length > 0 ? (
            <div className="nl-teamprofile-objectives" aria-label="Board-Ziele">
              {groupedObjectives.map(({ category, objectives }) => (
                <section key={category} className="nl-teamprofile-objective-category">
                  <h4>{category}</h4>
                  <ul className="nl-teamprofile-objective-list">
                    {objectives.map((objective) => (
                      <li
                        key={objective.objectiveId}
                        className={`nl-teamprofile-objective ${getObjectiveStatusTone(objective.status)}`}
                      >
                        <span className="nl-teamprofile-objective-status">
                          {getObjectiveStatusLabel(objective.status)}
                        </span>
                        <span className="nl-teamprofile-objective-copy">
                          <strong>{objective.label}</strong>
                          {typeof objective.currentValue === "number" && typeof objective.targetValue === "number" ? (
                            <NlProgressBar
                              value={objective.currentValue}
                              max={objective.targetValue}
                              tone={getObjectiveProgressTone(objective.status)}
                              format={(value, max) => `${formatNlNumber(value, 1)} / ${formatNlNumber(max, 1)}`}
                              className="nl-teamprofile-objective-bar"
                              title={`${objective.label}: ${formatNlNumber(objective.currentValue, 1)} / ${formatNlNumber(objective.targetValue, 1)}`}
                            />
                          ) : (
                            <span className="nl-teamprofile-objective-progress nl-tnum">
                              {String(objective.currentValue ?? "—")} / {String(objective.targetValue ?? "—")}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="nl-teamprofile-empty">Keine Board-Ziele hinterlegt.</p>
          )}
        </NlCard>
      </div>

      {werdegangSeries != null ? (
        <NlCard className="nl-teamprofile-career-card" data-testid="nl-teamprofile-career">
          <WerdegangPanel variant="team" entityName={data.teamName} series={werdegangSeries} />
        </NlCard>
      ) : null}

      <div ref={historyCardRef} className="nl-teamprofile-anchor">
        <NlCard
          className="nl-teamprofile-history-card"
          eyebrow="Transfers & Snapshots"
          title="Historie"
          data-testid="nl-teamprofile-history"
          actions={<span className="nl-teamprofile-count nl-tnum">{data.history.length}</span>}
        >
          {liveHistoryRow != null && (liveHistoryRow.topBuyPlayer != null || liveHistoryRow.topSellPlayer != null) ? (
            <div className="nl-teamprofile-transfer-cards">
              <article className="nl-teamprofile-transfer-card">
                <span>Top-Kauf</span>
                {liveHistoryRow.topBuyPlayer != null ? (
                  <button
                    type="button"
                    className="nl-teamprofile-playerlink is-inline"
                    onClick={() =>
                      liveHistoryRow.topBuyPlayerId != null &&
                      onOpenPlayer(liveHistoryRow.topBuyPlayerId, liveHistoryRow.topBuyPlayerId)
                    }
                    title={liveHistoryRow.topBuyPlayerId != null ? `${liveHistoryRow.topBuyPlayer} öffnen` : undefined}
                  >
                    {liveHistoryRow.topBuyPlayer}
                  </button>
                ) : (
                  <strong>—</strong>
                )}
                <small className="nl-tnum">
                  {liveHistoryRow.topBuyAmount != null ? formatNlNumber(liveHistoryRow.topBuyAmount, 1) : "—"}
                </small>
              </article>
              <article className="nl-teamprofile-transfer-card">
                <span>Top-Verkauf</span>
                {liveHistoryRow.topSellPlayer != null ? (
                  <button
                    type="button"
                    className="nl-teamprofile-playerlink is-inline"
                    onClick={() =>
                      liveHistoryRow.topSellPlayerId != null &&
                      onOpenPlayer(liveHistoryRow.topSellPlayerId, liveHistoryRow.topSellPlayerId)
                    }
                    title={
                      liveHistoryRow.topSellPlayerId != null ? `${liveHistoryRow.topSellPlayer} öffnen` : undefined
                    }
                  >
                    {liveHistoryRow.topSellPlayer}
                  </button>
                ) : (
                  <strong>—</strong>
                )}
                <small className="nl-tnum">
                  {liveHistoryRow.topSellAmount != null ? formatNlNumber(liveHistoryRow.topSellAmount, 1) : "—"}
                  {liveHistoryRow.topSellProfit != null
                    ? ` (${formatSignedNlNumber(liveHistoryRow.topSellProfit, 2)})`
                    : ""}
                </small>
              </article>
            </div>
          ) : null}
          {data.history.length > 0 ? (
            // Bewusste Wiederverwendung: dieselbe History-Tabelle wie im
            // Team-Drawer (inkl. Disziplin-Spalten & Transfer-Links) — nur die
            // Shell bekommt eine nl-Klasse für den horizontalen Scroll-Rahmen.
            <TeamDrawerHistoryTable
              tableClassName="team-drawer-history-table"
              shellClassName="team-drawer-history-table-shell nl-teamprofile-history-shell"
              axisToneVariant="drawer"
              rows={data.history}
              renderCell={(columnId: string, row: TeamDetailDrawerHistoryRow) => {
                if (columnId === "season") {
                  return (
                    <>
                      <strong>{row.seasonName}</strong>
                      {row.isLive ? <span className="player-drawer-history-tag">Live</span> : null}
                    </>
                  );
                }
                if (columnId === "rank") return `#${formatNlNumber(row.rank, 0)}`;
                if (columnId === "points") return formatNlNumber(row.points, 1);
                if (columnId === "pps") return formatNlNumber(row.pps, 1);
                if (columnId === "pow") return formatNlNumber(row.ppPow, 1);
                if (columnId === "spe") return formatNlNumber(row.ppSpe, 1);
                if (columnId === "men") return formatNlNumber(row.ppMen, 1);
                if (columnId === "soc") return formatNlNumber(row.ppSoc, 1);
                if (isSeasonDisciplineKey(columnId)) {
                  return formatNlNumber(row.disciplineValues[columnId], 1);
                }
                if (columnId === "cash") return formatNlNumber(row.cash, 1);
                if (columnId === "salary") return formatNlNumber(row.salaryTotal, 2);
                if (columnId === "mw") return formatNlNumber(row.marketValue, 2);
                if (columnId === "guv") {
                  return (
                    <span className={getMoneyDeltaClass(row.guv, "higher")}>
                      {isFiniteNumber(row.guv) ? formatSignedNlNumber(row.guv, 1) : "—"}
                    </span>
                  );
                }
                if (columnId === "injuriesCount") {
                  return row.injuriesCount != null ? row.injuriesCount : "—";
                }
                if (columnId === "averageFatigue") {
                  return row.averageFatigue != null ? formatNlNumber(row.averageFatigue, 1) : "—";
                }
                if (columnId === "topBuy") {
                  return row.topBuyPlayer ? (
                    <button
                      type="button"
                      className="team-drawer-history-transfer text-negative is-link"
                      onClick={() => row.topBuyPlayerId && onOpenPlayer(row.topBuyPlayerId, row.topBuyPlayerId)}
                    >
                      {row.topBuyPlayer} · {formatNlNumber(row.topBuyAmount, 2)}
                    </button>
                  ) : (
                    "—"
                  );
                }
                if (columnId === "topSell") {
                  return row.topSellPlayer ? (
                    <button
                      type="button"
                      className={`team-drawer-history-transfer is-link ${
                        row.topSellProfit != null && row.topSellProfit < 0 ? "text-negative" : "text-positive"
                      }`}
                      onClick={() => row.topSellPlayerId && onOpenPlayer(row.topSellPlayerId, row.topSellPlayerId)}
                      title={
                        row.topSellProfit != null
                          ? row.topSellProfit >= 0
                            ? `Verkaufsgewinn: ${formatSignedNlNumber(row.topSellProfit, 2)}`
                            : `Verlust: ${formatSignedNlNumber(row.topSellProfit, 2)}`
                          : undefined
                      }
                    >
                      {row.topSellPlayer} · {formatNlNumber(row.topSellAmount, 2)}
                      {row.topSellProfit != null ? ` (${formatSignedNlNumber(row.topSellProfit, 2)})` : ""}
                    </button>
                  ) : (
                    "—"
                  );
                }
                return "—";
              }}
            />
          ) : (
            <p className="nl-teamprofile-empty">Noch keine archivierten Team-Saisons vorhanden.</p>
          )}
        </NlCard>
      </div>
    </div>
  );
}
