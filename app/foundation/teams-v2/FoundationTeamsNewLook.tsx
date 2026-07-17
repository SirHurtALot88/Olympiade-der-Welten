"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlFieldRaceFormStrip,
  NlMedalBadge,
  NlProgressBar,
  NlRadar,
  NlSparkline,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  formatNlMoney,
  nlToneClass,
  type NlAxisKey,
  type NlTone,
} from "@/components/foundation/new-look";
import type { TeamDetailDrawerData } from "@/lib/foundation/team-detail-drawer-types";
import { getSeasonV2TeamTagStyle } from "@/app/foundation/season-v2/SeasonStandingsV2Client";
import { getClassColorClassName } from "@/app/foundation/classVisuals";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import type { Discipline, DisciplineCategory, GameState, Team } from "@/lib/data/olyDataTypes";
import { formatContractShapeShortLabel } from "@/lib/foundation/player-economy-contract";
import { formatPlayerIdentitySubMeta } from "@/lib/foundation/player-identity-meta";
import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import type { FieldRaceLedgerEntry } from "@/lib/foundation/build-field-race-ledger";
import { buildTeamDisciplineRankRowsFromGameState } from "@/lib/foundation/team-discipline-rank-engine";
import { calculateFacilityIncome, calculateFacilityUpkeep } from "@/lib/facilities/facility-effects";
import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import { buildOrderedFoundationDisciplines, getTeamAxisRankTooltip } from "@/lib/foundation/tabs/teams-ui-helpers";
import type { TeamsViewRow } from "@/lib/foundation/tabs/teams-view-derivations";
import type {
  TeamRosterFocusMode,
  TeamRosterRoleFilter,
} from "@/lib/foundation/tabs/use-teams-roster-table-derivations";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";
import { SEASON_DISCIPLINE_LABELS, isSeasonDisciplineKey } from "@/lib/season/season-discipline-area-groups";

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
  /** CA/PO-Sterne (Tier-3 Rosterkarten) — fog-korrekt über `buildRosterCaPoStarFields`. */
  known?: boolean;
  caStars?: number | null;
  poStarRange?: { min: number; max: number } | null;
  caScore?: number | null;
  poScoreRange?: { min: number; max: number } | null;
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
   * Aktiver Team-Unterreiter aus dem Host. Steuert historisch die
   * Standard-Ansicht der Kaderprofil-Karte — die startet jedoch bewusst
   * immer auf "Portraits" (siehe `defaultRosterModeForTab`), unabhängig
   * vom Host-Unterreiter. Der In-Card-Umschalter (Portraits/Tabelle)
   * bleibt in jedem Fall nutzbar.
   */
  selectedTeamDetailTab: "roster" | "portraits";
  sortedTeamsViewRows: TeamsViewRow[];
  /**
   * Vom Host bereits berechnete Team-Historie (Live-Saison + echte
   * Season-Snapshots) — Basis für Saison-Verlauf und Vorsaison-Deltas.
   * `null`, solange die Ableitung (Hydration) noch nicht gebaut wurde.
   */
  selectedTeamsHistoryData: TeamDetailDrawerData | null;
  /**
   * Wave D · D1 Feld-Form-Strip: letzte bis zu 5 Spieltage des gezeigten Teams
   * aus dem Feld-Rennen-Ledger (fog-sicher, optional). `fieldRacePlayedMatchdayCount`
   * speist den Frühphasen-Zustand (S1/MD1).
   */
  fieldRaceRecentForm?: FieldRaceLedgerEntry[];
  fieldRacePlayedMatchdayCount?: number;
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
  /** Manuelles KI-Pick-Auffüllen für genau dieses Team (Kader-Tab). */
  runTeamPicksRefill?: (teamId: string) => void | Promise<void>;
  teamPicksRefillBusyTeamId?: string | null;
  teamPicksRefillMessage?: { teamId: string; tone: "success" | "error"; text: string } | null;
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
 * Standard-Ansicht der Kaderprofil-Karte: startet immer im
 * bild-fokussierten Portrait-Grid ("Portraits" ist der erste Unterreiter
 * in `NL_TEAMS_ROSTER_MODE_ITEMS` und soll auch die Startansicht sein),
 * unabhängig davon, über welchen Host-Unterreiter (Kader/Portraits) die
 * Ansicht geöffnet wurde. Der In-Card-Umschalter (Portraits/Tabelle)
 * bleibt unverändert nutzbar — Nutzer:innen können jederzeit zur
 * Tabelle wechseln, es wird nur der Startzustand vereinheitlicht.
 */
function defaultRosterModeForTab(_tab: "roster" | "portraits"): NlTeamsRosterMode {
  return "portraits";
}

/** Max. Spielerzeilen in den Hero-Hover-Portalen (MW/Gehalt), Rest als "…+N". */
const NL_TEAMS_HERO_HOVER_MAX_ROWS = 6;

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

// === Disziplin-Profil: Einzeldisziplinen-Radar + Breakdown (#46) ==========
// Ergänzt die vier POW/SPE/MEN/SOC-Achsen um die realen Einzeldisziplinen
// (aktuell 20, `gameState.disciplines`). Nutzt für die Team-Stärke dieselbe
// Top-6-Spieler-Summen-Engine wie die Bereichsränge oben
// (`team-discipline-rank-engine.ts`, sonst für die POW/SPE/MEN/SOC-Spalten
// der Saisonstand-Tabelle genutzt) — keine neu erfundene Formel, nur pro
// Einzeldisziplin statt pro Kategorie ausgewertet.

const DISCIPLINE_CATEGORY_TO_AXIS: Record<DisciplineCategory, NlAxisKey> = {
  power: "pow",
  speed: "spe",
  mental: "men",
  social: "soc",
};

/** `NlRadar` im Kit ist hart auf die vier POW/SPE/MEN/SOC-Achsen codiert —
 * für 20 Einzeldisziplinen ist ein Radar nicht mehr lesbar. Zeigt daher nur
 * die stärksten N Disziplinen (niedrigster Liga-Rang); die Liste darunter
 * bleibt vollständig. */
const NL_TEAMS_DISCIPLINE_RADAR_CAP = 8;

type NlTeamDisciplineEntry = {
  disciplineId: string;
  label: string;
  shortLabel: string;
  axis: NlAxisKey;
  score: number | null;
  rank: number | null;
  leagueMax: number | null;
};

/** Kurzlabel wie in der Saisonstand-Tabelle (z. B. "SCH" für Schach) —
 * fällt auf die ersten drei Buchstaben zurück, falls eine Disziplin-ID mal
 * nicht im bekannten Season-Discipline-Set steckt. */
function getDisciplineShortLabel(discipline: Discipline): string {
  const normalized = normalizeLineupDisciplineFieldName(discipline.id);
  if (isSeasonDisciplineKey(normalized)) {
    return SEASON_DISCIPLINE_LABELS[normalized];
  }
  return discipline.name.slice(0, 3).toUpperCase();
}

/**
 * Team-Disziplin-Breakdown für ein Team: pro Disziplin die reale
 * Top-6-Spieler-Summe (`scorePack.disciplines`) plus Liga-Rang
 * (`disciplineRanks`), beides aus `buildTeamDisciplineRankRowsFromGameState`
 * — derselben Engine, die auch die POW/SPE/MEN/SOC-Bereichsränge speist.
 * Disziplinen ohne jeglichen ligaweiten Wert (z. B. season-seitig inaktiv)
 * werden herausgefiltert statt mit 0 aufgefüllt — kein Fake.
 */
function buildTeamDisciplineBreakdown(gameState: GameState, teamId: string): NlTeamDisciplineEntry[] | null {
  const orderedDisciplines = buildOrderedFoundationDisciplines(gameState.disciplines);
  if (orderedDisciplines.length === 0) {
    return null;
  }
  const rankRows = buildTeamDisciplineRankRowsFromGameState(gameState, orderedDisciplines);
  const selfRow = rankRows.find((row) => row.teamId === teamId);
  if (!selfRow) {
    return null;
  }

  const entries: NlTeamDisciplineEntry[] = [];
  for (const discipline of orderedDisciplines) {
    const leagueMax = rankRows.reduce((max, row) => {
      const value = row.scorePack.disciplines[discipline.id] ?? 0;
      return value > max ? value : max;
    }, 0);
    if (leagueMax <= 0) {
      // Ligaweit keine echten Werte in dieser Disziplin — nicht anzeigen.
      continue;
    }
    const score = selfRow.scorePack.disciplines[discipline.id];
    const rank = selfRow.disciplineRanks[discipline.id];
    entries.push({
      disciplineId: discipline.id,
      label: discipline.name,
      shortLabel: getDisciplineShortLabel(discipline),
      axis: DISCIPLINE_CATEGORY_TO_AXIS[discipline.category],
      score: Number.isFinite(score) ? score : null,
      rank: rank && rank > 0 ? rank : null,
      leagueMax,
    });
  }
  return entries.length > 0 ? entries : null;
}

function compareDisciplineByStrength(left: NlTeamDisciplineEntry, right: NlTeamDisciplineEntry): number {
  const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
  const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return left.label.localeCompare(right.label, "de-DE");
}

/** Ton nach Liga-Rang-Quartil auf der Haus-Farbskala blau→grün→gelb→rot
 * (blau = Spitze/Rang 1 = das Beste, grün, gelb, rot = schwächstes) —
 * dieselbe 4-Stufen-Logik wie `getAxisRankTone` (players-table), nur auf
 * den Liga-Rang statt auf Rating-Bänder angewandt. */
function getDisciplineRankTone(rank: number | null, teamCount: number): NlTone {
  if (rank == null || teamCount <= 1) {
    return "neutral";
  }
  const ratio = (rank - 1) / (teamCount - 1);
  if (ratio <= 1 / 4) return "accent"; // Spitzen-Viertel: blau, "das Beste".
  if (ratio <= 1 / 2) return "good"; // grün.
  if (ratio <= 3 / 4) return "warn"; // gelb.
  return "risk"; // rot = schwächstes.
}

type NlTeamDisciplineRadarAxis = {
  key: string;
  label: string;
  value: number;
  tone: NlAxisKey;
};

const NL_TEAMDISC_RADAR_SIZE = 220;
const NL_TEAMDISC_RADAR_CENTER = NL_TEAMDISC_RADAR_SIZE / 2;
const NL_TEAMDISC_RADAR_RADIUS = 66;
const NL_TEAMDISC_RADAR_RINGS = [0.25, 0.5, 0.75, 1];

function nlTeamDiscRadarPoint(axisIndex: number, axisCount: number, ratio: number) {
  const angle = (axisIndex / axisCount) * Math.PI * 2 - Math.PI / 2;
  return {
    x: NL_TEAMDISC_RADAR_CENTER + Math.cos(angle) * NL_TEAMDISC_RADAR_RADIUS * ratio,
    y: NL_TEAMDISC_RADAR_CENTER + Math.sin(angle) * NL_TEAMDISC_RADAR_RADIUS * ratio,
  };
}

/**
 * Generisches Mehrachsen-Radar für das Disziplin-Profil. `NlRadar` aus dem
 * "Neuer Look"-Kit ist bewusst hart auf die vier POW/SPE/MEN/SOC-Achsen
 * codiert (fester `RADAR_AXIS_ORDER`) und trägt keine variable Achsenzahl —
 * für die (bis zu `NL_TEAMS_DISCIPLINE_RADAR_CAP`) Einzeldisziplinen hier
 * braucht es eine eigene, aber optisch identische SVG-Geometrie (Ringe,
 * Speichen, Polygon, Punkte, Labels — gleiche Klassen-Sprache wie
 * `.nl-radar-*`, nur unter `.nl-teamdisc-radar-*` neu benannt).
 */
function NlTeamDisciplineRadar({
  axes,
  max,
  className,
  "aria-label": ariaLabel,
}: {
  axes: NlTeamDisciplineRadarAxis[];
  max: number;
  className?: string;
  "aria-label"?: string;
}) {
  const geometry = useMemo(() => {
    const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
    const valid = axes.filter((axis) => Number.isFinite(axis.value));
    if (valid.length < 3) {
      return null;
    }
    const points = valid.map((axis, index) => {
      const ratio = Math.max(0, Math.min(axis.value / safeMax, 1));
      return { ...axis, ...nlTeamDiscRadarPoint(index, valid.length, ratio) };
    });
    return {
      points,
      polygon: points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" "),
      rings: NL_TEAMDISC_RADAR_RINGS.map((ring) =>
        valid.map((_, index) => nlTeamDiscRadarPoint(index, valid.length, ring)),
      ),
      spokes: valid.map((_, index) => nlTeamDiscRadarPoint(index, valid.length, 1)),
      labels: valid.map((axis, index) => ({ ...axis, ...nlTeamDiscRadarPoint(index, valid.length, 1.22) })),
    };
  }, [axes, max]);

  if (!geometry) {
    return <p className="nl-teamdisc-radar-empty">Zu wenige Disziplin-Ränge für ein Radar.</p>;
  }

  return (
    <svg
      className={["nl-teamdisc-radar", className ?? ""].filter(Boolean).join(" ")}
      viewBox={`0 0 ${NL_TEAMDISC_RADAR_SIZE} ${NL_TEAMDISC_RADAR_SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={
        ariaLabel ??
        `Disziplin-Radar: ${geometry.points.map((point) => `${point.label} ${formatNlNumber(point.value)}`).join(", ")}`
      }
    >
      {geometry.rings.map((ring, ringIndex) => (
        <polygon
          key={`nl-teamdisc-radar-ring-${ringIndex}`}
          points={ring.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}
          className="nl-teamdisc-radar-ring"
          fill="none"
        />
      ))}
      {geometry.spokes.map((point, index) => (
        <line
          key={`nl-teamdisc-radar-spoke-${index}`}
          x1={NL_TEAMDISC_RADAR_CENTER}
          y1={NL_TEAMDISC_RADAR_CENTER}
          x2={point.x}
          y2={point.y}
          className="nl-teamdisc-radar-spoke"
        />
      ))}
      <polygon points={geometry.polygon} className="nl-teamdisc-radar-shape" />
      {geometry.points.map((point) => (
        <circle
          key={`nl-teamdisc-radar-dot-${point.key}`}
          cx={point.x}
          cy={point.y}
          r={3.5}
          className={`nl-teamdisc-radar-dot ${nlToneClass(point.tone)}`}
        >
          <title>
            {point.label}: {formatNlNumber(point.value)}
          </title>
        </circle>
      ))}
      {geometry.labels.map((label) => (
        <text
          key={`nl-teamdisc-radar-label-${label.key}`}
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className={`nl-teamdisc-radar-label ${nlToneClass(label.tone)}`}
        >
          {label.label}
        </text>
      ))}
    </svg>
  );
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

type TeamsKpiHoverPortalProps = {
  panelId: string;
  ariaLabel: string;
  /** Der eigentliche Stat-Chip — bleibt selbst interaktiv (Sortierung/Navigation). */
  chip: ReactNode;
  children: ReactNode;
};

/**
 * A11y-Fix (T-079): Hover-/Fokus-Vorschau für die Header-KPI-Chips der
 * Teams-Übersicht. Die Chips (RANG/CASH/MW/GEHALT) sind selbst Buttons
 * (Sortierung/Sprung), daher kann hier — anders als `HeaderKpiHover` im
 * Team-Profil — kein zusätzlicher umschließender Trigger-Button verwendet
 * werden (verschachtelte Buttons sind ungültiges HTML). Stattdessen trägt
 * dieser Wrapper selbst die Hover-/Fokus-/Escape-Logik und exponiert das
 * Panel nur dann für Screenreader (`hidden`-Attribut statt permanentem
 * `aria-hidden="true"`), wenn es durch Maus-Hover ODER Tastatur-Fokus
 * tatsächlich sichtbar ist. Sichtbarkeit wird komplett über React-State
 * gesteuert (siehe `.nl-teams-rank-preview[hidden]` in globals.css) —
 * kein CSS-`:hover`/`:focus-within` mehr, das mit diesem State kollidieren
 * könnte.
 */
function TeamsKpiHoverPortal({ panelId, ariaLabel, chip, children }: TeamsKpiHoverPortalProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kein Panel-Inhalt (z. B. noch keine Vergleichsdaten geladen) → nur den
  // Chip rendern, kein leerer Dialog im DOM/Accessibility-Tree.
  if (children == null || children === false) {
    return <>{chip}</>;
  }

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
    <span
      ref={wrapRef}
      className="nl-teams-rank-portal"
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
          wrapRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      {chip}
      <div id={panelId} role="dialog" aria-label={ariaLabel} className="nl-teams-rank-preview" hidden={!open}>
        {children}
      </div>
    </span>
  );
}

export default function FoundationTeamsNewLook({
  selectedTeam,
  gameState,
  selectedTeamDetailTab,
  sortedTeamsViewRows,
  selectedTeamsHistoryData,
  fieldRaceRecentForm,
  fieldRacePlayedMatchdayCount,
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
  runTeamPicksRefill,
  teamPicksRefillBusyTeamId,
  teamPicksRefillMessage,
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
  const [disciplineSort, setDisciplineSort] = useState<"strength" | "category">("strength");

  const heroCardRef = useRef<HTMLDivElement | null>(null);
  const disciplineCardRef = useRef<HTMLDivElement | null>(null);
  const developmentCardRef = useRef<HTMLDivElement | null>(null);
  const rosterCardRef = useRef<HTMLDivElement | null>(null);
  const leagueCardRef = useRef<HTMLDivElement | null>(null);

  const teamCount = gameState.teams.length;
  const heroRow = useMemo(
    () => sortedTeamsViewRows.find((row) => row.team.teamId === selectedTeam.teamId) ?? null,
    [selectedTeam.teamId, sortedTeamsViewRows],
  );

  // Team-Achsen-STÄRKE (POW/SPE/MEN/SOC) je Team: die kanonische Aggregat-
  // Stärke des Kaders aus derselben Engine wie die Bereichsränge und das
  // Disziplin-Profil (`scorePack`, Top-6-Spieler-Summe je Achse). Ab
  // Saisonstart sichtbar und ligaweit vergleichbar wie der MW — im Gegensatz
  // zu den Bereichs-PUNKTEN (`ppsPow`…), die bis zu den ersten Spieltagen 0
  // sind und deshalb "—" ergaben.
  const teamAxisStrengthById = useMemo(() => {
    const rows = buildTeamDisciplineRankRowsFromGameState(gameState, gameState.disciplines);
    return new Map(rows.map((row) => [row.teamId, row.scorePack] as const));
  }, [gameState]);

  function getAxisStrengthValue(teamId: string | null | undefined, key: NlAxisKey): number | null {
    if (!teamId) {
      return null;
    }
    const pack = teamAxisStrengthById.get(teamId);
    if (!pack) {
      return null;
    }
    const value = key === "pow" ? pack.pow : key === "spe" ? pack.spe : key === "men" ? pack.men : pack.soc;
    return Number.isFinite(value) ? value : null;
  }

  function getBoardSortValueLocal(row: TeamsViewRow, key: NlTeamsBoardSortKey): number | null {
    if (isNlAxisSortKey(key)) {
      return getAxisStrengthValue(row.team.teamId, key);
    }
    return getBoardSortValue(row, key);
  }

  const boardRows = useMemo(() => {
    const base = [...sortedTeamsViewRows].sort(compareBoardRows);
    if (boardSort.key === "rank" && boardSort.dir === "asc") {
      return base;
    }
    const factor = boardSort.dir === "asc" ? 1 : -1;
    return base.sort((left, right) => {
      const leftValue = getBoardSortValueLocal(left, boardSort.key);
      const rightValue = getBoardSortValueLocal(right, boardSort.key);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSort, sortedTeamsViewRows, teamAxisStrengthById]);

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

  // Fog-of-War-Gate: nur beim eigenen (vom Menschen geführten) Team dürfen die
  // spieler-granularen MW-/Gehalt-Zusammensetzungen sichtbar sein — genau wie
  // `TeamProfileNewLook` (`data.controlMode === "manual"`), hier über den
  // kanonischen `team.humanControlled`-Marker (Ligavergleich zeigt jedes Team).
  const heroIsOwnTeam = selectedTeam.humanControlled;

  // CASH-Hover (alle Teams): kompakte GuV-Projektion. Cash & Gehaltsblock aus
  // der Team-Zeile, Gebäude-Unterhalt/-Einnahmen und Sponsoren-Basis aus dem
  // GameState — dieselben Helfer wie die CASH-GuV in `TeamProfileNewLook`.
  const heroCashBreakdown = useMemo(() => {
    const teamId = selectedTeam.teamId;
    const cash = isFiniteNumber(heroRow?.cash) ? (heroRow?.cash as number) : null;
    const salaryTotal = isFiniteNumber(heroRow?.salaryTotal) ? (heroRow?.salaryTotal as number) : null;
    const teamFacilities = gameState.seasonState.teamFacilities?.[teamId] ?? null;
    const facilityUpkeep = teamFacilities ? calculateFacilityUpkeep(teamFacilities) : null;
    const popularity = computeTeamBeliebtheitFromGameState(gameState, teamId);
    const facilityIncome = teamFacilities
      ? calculateFacilityIncome(teamFacilities, { arenaPopularityFactor: popularity?.value ?? 1 })
      : null;
    const sponsorContract = gameState.seasonState.sponsorContractsByTeamId?.[teamId] ?? null;
    const sponsorBase = sponsorContract
      ? sponsorContract.components
          .filter((component) => component.kind === "base")
          .reduce((sum, component) => sum + (isFiniteNumber(component.rewardCash) ? component.rewardCash : 0), 0)
      : null;
    // Projiziertes Saison-Ende: Cash − Gehälter + (Einnahmen − Unterhalt) +
    // Sponsoren-Basis. Prämien fließen bewusst nicht ein (benchmark-only).
    const projected =
      cash != null
        ? cash - (salaryTotal ?? 0) + (facilityIncome ?? 0) - (facilityUpkeep ?? 0) + (sponsorBase ?? 0)
        : null;
    return { cash, salaryTotal, facilityUpkeep, facilityIncome, sponsorBase, projected };
  }, [gameState, selectedTeam.teamId, heroRow]);

  // MW-Hover (nur eigenes Team): Kaderspieler nach Marktwert absteigend.
  // Reuse der Kadertabellen-Daten dieses Files (`getRosterEntryDisplayMarketValue`).
  const heroMarketValueRows = useMemo(() => {
    if (!heroIsOwnTeam) {
      return [];
    }
    return filteredSelectedRosterTableRows
      .map((row) => ({
        id: row.entry.id,
        playerId: row.player.id,
        name: row.player.name,
        marketValue: getRosterEntryDisplayMarketValue(row.entry, row.player),
      }))
      .filter((row) => isFiniteNumber(row.marketValue))
      .sort((left, right) => (right.marketValue ?? 0) - (left.marketValue ?? 0));
  }, [heroIsOwnTeam, filteredSelectedRosterTableRows, getRosterEntryDisplayMarketValue]);

  // GEHALT-Hover (nur eigenes Team): Kaderspieler nach Gehalt absteigend, mit
  // Vertragsform-Tag (FL/BL/STD) über `formatContractShapeShortLabel`.
  const heroSalaryRows = useMemo(() => {
    if (!heroIsOwnTeam) {
      return [];
    }
    return filteredSelectedRosterTableRows
      .map((row) => ({
        id: row.entry.id,
        playerId: row.player.id,
        name: row.player.name,
        salary: getRosterEntryDisplaySalary(row.entry, row.player),
        shapeShort: formatContractShapeShortLabel(row.entry.contractShape),
      }))
      .filter((row) => isFiniteNumber(row.salary))
      .sort((left, right) => (right.salary ?? 0) - (left.salary ?? 0));
  }, [heroIsOwnTeam, filteredSelectedRosterTableRows, getRosterEntryDisplaySalary]);

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
    const cashSpark = developmentRows.filter((row) => isFiniteNumber(row.cash)).map((row) => row.cash as number);
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
      cashSpark,
      cashFirst: cashSpark.length > 0 ? cashSpark[0] : null,
      cashLast: cashSpark.length > 0 ? cashSpark[cashSpark.length - 1] : null,
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
    // Team-Stärke: stärkstes Team zuerst (absteigend), analog zum MW.
    setBoardSort({ key, dir: "desc" });
    scrollToSection(leagueCardRef);
  }

  // Portal: eine Hero-Kachel (MW/Cash) klicken → Teamtabelle danach sortieren
  // und dorthin scrollen. „Klick MW → alle Teams nach Marktwert sortiert."
  function handleHeroBoardSortSelect(key: NlTeamsBoardSortKey, dir: NlTeamsBoardSortDir) {
    setBoardSort({ key, dir });
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

  const teamDisciplineBreakdown = useMemo(
    () => buildTeamDisciplineBreakdown(gameState, selectedTeam.teamId),
    [gameState, selectedTeam.teamId],
  );

  const disciplineRadarAxes = useMemo<NlTeamDisciplineRadarAxis[]>(() => {
    if (!teamDisciplineBreakdown || teamCount <= 0) {
      return [];
    }
    return [...teamDisciplineBreakdown]
      .filter((entry) => entry.rank != null)
      .sort(compareDisciplineByStrength)
      .slice(0, NL_TEAMS_DISCIPLINE_RADAR_CAP)
      .map((entry) => ({
        key: entry.disciplineId,
        label: entry.shortLabel,
        value: Math.max(0, teamCount - (entry.rank as number) + 1),
        tone: entry.axis,
      }));
  }, [teamDisciplineBreakdown, teamCount]);

  const sortedDisciplineBreakdown = useMemo(() => {
    if (!teamDisciplineBreakdown) {
      return [];
    }
    if (disciplineSort === "strength") {
      return [...teamDisciplineBreakdown].sort(compareDisciplineByStrength);
    }
    const axisOrder: NlAxisKey[] = ["pow", "spe", "men", "soc"];
    return [...teamDisciplineBreakdown].sort((left, right) => {
      const axisDelta = axisOrder.indexOf(left.axis) - axisOrder.indexOf(right.axis);
      if (axisDelta !== 0) {
        return axisDelta;
      }
      return compareDisciplineByStrength(left, right);
    });
  }, [teamDisciplineBreakdown, disciplineSort]);

  const heroLogo = getTeamLogoModel(selectedTeam, { variant: "thumb" });

  function renderAxisRankBadges(
    row: TeamsViewRow | null,
    teamId: string,
    teamName: string,
    compact: boolean,
    onSelectAxis?: (key: NlAxisKey) => void,
  ) {
    return (
      <div
        className={`nl-teams-axes${compact ? " is-compact" : ""}`}
        role="group"
        aria-label={`Team-Stärke ${teamName}`}
      >
        {NL_TEAMS_AXES.map(({ key, label }) => {
          const rank = getAxisRank(row, key);
          // TEAM-STÄRKE (Aggregat-Achsenwert des Kaders) statt Bereichs-PUNKTE:
          // ab Saisonstart sichtbar, ligaweit vergleichbar wie der MW.
          const strength = getAxisStrengthValue(teamId, key);
          const title =
            `${getTeamAxisRankTooltip(label)}` +
            `${strength != null ? ` · Team-Stärke ${formatNlNumber(strength, 0)}` : ""}` +
            `${rank != null ? ` · Liga-Rang #${formatNlNumber(rank, 0)}` : ""}`;
          const isSortAxis = boardSort.key === key;
          const axisClassName = `nl-teams-axis ${nlToneClass(key)}${isSortAxis ? " is-sorted" : ""}`;
          const body = (
            <>
              <span className="nl-teams-axis-label">{label}</span>
              {compact ? (
                <span className="nl-teams-axis-rank nl-tnum">
                  {strength != null ? formatNlNumber(strength, 0) : "—"}
                </span>
              ) : (
                // Team-Stärke UND (falls vorhanden) Liga-Rang nebeneinander: "71 · #14".
                // Fehlt ein echter Rang, bleibt nur die Stärke stehen — kein Fake.
                <span className="nl-teams-axis-figures nl-tnum">
                  {strength != null ? (
                    <span className="nl-teams-axis-value">{formatNlNumber(strength, 0)}</span>
                  ) : null}
                  {strength != null && rank != null ? (
                    <span className="nl-teams-axis-sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  {rank != null ? (
                    <span className="nl-teams-axis-rank">#{formatNlNumber(rank, 0)}</span>
                  ) : null}
                  {strength == null && rank == null ? <span className="nl-teams-axis-rank">—</span> : null}
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
              newLook
              known={row.known}
              caStars={row.caStars}
              poStarRange={row.poStarRange}
              caScore={row.caScore}
              poScoreRange={row.poScoreRange}
              onOpen={() => void openPlayerDrawerById(player.id, entry.id)}
              title={`${player.name} öffnen`}
              economyStats={[
                {
                  label: "MW",
                  value: formatNlMoney(marketValue),
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
      <div className="nl-teams-table-shell" style={{ overflowX: "auto", maxWidth: "100%", minWidth: 0 }}>
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
                  // A11y-Fix (T-080): Die Zeile war nur per Maus-Klick bedienbar
                  // (kein tabIndex/role/onKeyDown). `target === currentTarget`
                  // verhindert, dass Enter/Space auf einem verschachtelten
                  // Button (Spielerlink, Verkaufen, Verlängern) die Zeilen-
                  // Aktion zusätzlich auslöst — die Buttons haben ihr eigenes
                  // Verhalten bereits (inkl. `stopPropagation` bei Klick).
                  tabIndex={0}
                  role="button"
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) {
                      return;
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openPlayerDrawerById(player.id, entry.id);
                    }
                  }}
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
                  <td className="nl-teams-td-role">{entry.roleTag === "starter" ? "Starter" : entry.roleTag === "bench" ? "Bank" : entry.roleTag === "rotation" ? "Rotation" : "Kader"}</td>
                  <td>{formatNlNumber(row.playerOvr, 0)}</td>
                  <td>{formatNlNumber(row.playerMvs, 1)}</td>
                  <td>{formatNlNumber(row.playerPps, 1)}</td>
                  <td>
                    <span className="nl-teams-money-stack">
                      <span>{formatNlMoney(marketValue)}</span>
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
                      {/* T-036: „Verkaufen" ist destruktiv und stand bisher direkt
                          neben „Verlängern" in identischer Optik → Fehlklick-Gefahr.
                          Fix: eigene Gruppe mit sichtbarem Abstand + Warnstil
                          (`nl-teams-action-danger`), „Verlängern" (unkritisch)
                          zuerst. Der eigentliche Verkauf bleibt zusätzlich durch
                          den Vorschau-/Bestätigungsschritt in `openMarketSellModal`
                          abgesichert (öffnet nur ein Preview-Panel, verkauft nicht
                          sofort). */}
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
                      <span className="nl-teams-action-danger-group">
                        <button
                          type="button"
                          className="nl-teams-action nl-teams-action-danger"
                          disabled={marketSellBusy}
                          title="Verkaufen — öffnet die Verkaufs-Vorschau"
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
                      </span>
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
    // Ökonomie-Trajektorie je Team: echte Snapshot-Endwerte + Live-Wert.
    // Fehlende Felder werden herausgefiltert (kein Fake).
    const economySeasons = row.historicalEconomyBySeason ?? [];
    const marketValueSpark = [...economySeasons.map((entry) => entry.marketValueTotal), row.marketValueTotal].filter(
      isFiniteNumber,
    );
    const cashSpark = [...economySeasons.map((entry) => entry.cash), row.cash].filter(isFiniteNumber);
    const hasPointsTrend = seasonPointsSpark.length >= 2;
    const hasEconomyTrend = marketValueSpark.length >= 2 || cashSpark.length >= 2;
    const hasTrend = hasPointsTrend || hasEconomyTrend;
    if (radarAxes.length === 0 && !hasTrend) {
      return null;
    }
    return (
      // A11y-Fix (T-079): war fest `aria-hidden="true"`, obwohl die Karte
      // per Tastatur-Fokus (`onFocusCapture` auf `.nl-teams-boardrow`, s.u.)
      // genauso geöffnet wird wie per Maus-Hover — SR bekam den Inhalt nie.
      // Da die Karte ohnehin nur bei `hoveredBoardTeamId === row.team.teamId`
      // gemountet wird (siehe `renderBoardRow`), reicht ein aussagekräftiges
      // `role`/`aria-label` ohne zusätzliches `hidden`-Attribut.
      <div className="nl-teams-board-hover" role="dialog" aria-label={`${row.teamName} — Formkurve`}>
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
              {hasPointsTrend ? (
                <span className="nl-teams-board-hover-trend">
                  <small>Punkte</small>
                  <NlSparkline points={seasonPointsSpark} tone="accent" />
                </span>
              ) : null}
              {seasonRankSpark.length >= 2 ? (
                <span className="nl-teams-board-hover-trend">
                  <small>Rang (oben = besser)</small>
                  <NlSparkline points={seasonRankSpark} tone="good" />
                </span>
              ) : null}
              {marketValueSpark.length >= 2 ? (
                <span className="nl-teams-board-hover-trend">
                  <small>Marktwert</small>
                  <NlSparkline points={marketValueSpark} tone="warn" />
                </span>
              ) : null}
              {cashSpark.length >= 2 ? (
                <span className="nl-teams-board-hover-trend">
                  <small>Cash</small>
                  <NlSparkline points={cashSpark} tone="good" />
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
          {formatNlMoney(row.marketValueTotal)}
        </span>
      );
    }
    if (key === "salary") {
      return (
        <span className="nl-teams-board-sortval nl-tnum" title="Gehaltsblock">
          <small>Gehalt</small>
          {formatNlMoney(row.salaryTotal)}
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
          {renderAxisRankBadges(row, row.team.teamId, row.teamName, true)}
          <span className="nl-teams-board-meta">
            {renderBoardSortValue(row)}
            {row.goldCount > 0 ? <NlMedalBadge kind="gold" count={row.goldCount} /> : null}
            {row.silverCount > 0 ? <NlMedalBadge kind="silver" count={row.silverCount} /> : null}
            {row.bronzeCount > 0 ? <NlMedalBadge kind="bronze" count={row.bronzeCount} /> : null}
            <span className="nl-teams-board-cash nl-tnum" title="Cash">
              {row.cash != null ? formatNlMoney(row.cash) : "—"}
            </span>
          </span>
        </button>
      </li>
    );
  }

  // Hover-Portal für die CASH-Kachel: kompakte GuV-Projektion (alle Teams).
  // Reuse der generischen RANG-Hover-Klassen (rein CSS, additiv zum onClick).
  function renderCashPreview() {
    const { cash, salaryTotal, facilityUpkeep, facilityIncome, sponsorBase, projected } = heroCashBreakdown;
    if (cash == null && salaryTotal == null) {
      return null;
    }
    const guvLine = (
      lineKey: string,
      sign: "" | "−" | "+",
      label: string,
      value: number | null,
      isResult?: boolean,
    ) => (
      <li key={lineKey} className={`nl-teams-rank-preview-row${isResult ? " is-self" : ""}`}>
        <span className="nl-teams-rank-preview-rank" aria-hidden="true">
          {sign}
        </span>
        <span className="nl-teams-rank-preview-team">{label}</span>
        <span className="nl-teams-rank-preview-points">{formatNlMoney(value)}</span>
      </li>
    );
    return (
      <>
        <span className="nl-teams-rank-preview-title">Cash · GuV (Projektion)</span>
        <ol className="nl-teams-rank-preview-list nl-tnum">
          {cash != null ? guvLine("cash", "", "Cash", cash) : null}
          {salaryTotal != null ? guvLine("salary", "−", "Gehälter", salaryTotal) : null}
          {facilityUpkeep != null ? guvLine("upkeep", "−", "Gebäude-Unterhalt", facilityUpkeep) : null}
          {facilityIncome != null ? guvLine("income", "+", "Gebäude-Einnahmen", facilityIncome) : null}
          {sponsorBase != null ? guvLine("sponsor", "+", "Sponsoren (Basis)", sponsorBase) : null}
          {projected != null ? guvLine("projected", "", "≈ Saison-Ende", projected, true) : null}
        </ol>
      </>
    );
  }

  // Hover-Portal für die MW-Kachel: Kaderspieler nach Marktwert (eigenes Team)
  // bzw. nur die Kader-Summe (fremdes Team, Fog-of-War).
  function renderMwPreview() {
    const total = isFiniteNumber(heroRow?.marketValueTotal) ? (heroRow?.marketValueTotal as number) : null;
    if (total == null && heroMarketValueRows.length === 0) {
      return null;
    }
    const shown = heroMarketValueRows.slice(0, NL_TEAMS_HERO_HOVER_MAX_ROWS);
    const rest = heroMarketValueRows.length - shown.length;
    return (
      <>
        <span className="nl-teams-rank-preview-title">Marktwert · Kader</span>
        <ol className="nl-teams-rank-preview-list nl-tnum">
          {shown.map((row, index) => (
            <li key={row.id} className="nl-teams-rank-preview-row">
              <span className="nl-teams-rank-preview-rank">{index + 1}</span>
              <span className="nl-teams-rank-preview-team">{row.name}</span>
              <span className="nl-teams-rank-preview-points">{formatNlMoney(row.marketValue)}</span>
            </li>
          ))}
          {rest > 0 ? (
            <li className="nl-teams-rank-preview-row">
              <span className="nl-teams-rank-preview-rank" aria-hidden="true" />
              <span className="nl-teams-rank-preview-team">… +{formatNlNumber(rest, 0)} weitere</span>
              <span className="nl-teams-rank-preview-points" aria-hidden="true" />
            </li>
          ) : null}
          {total != null ? (
            <li className="nl-teams-rank-preview-row is-self">
              <span className="nl-teams-rank-preview-rank" aria-hidden="true">
                Σ
              </span>
              <span className="nl-teams-rank-preview-team">Kadersumme</span>
              <span className="nl-teams-rank-preview-points">{formatNlMoney(total)}</span>
            </li>
          ) : null}
        </ol>
        {!heroIsOwnTeam ? (
          <span className="nl-teams-rank-preview-title">Einzel-Marktwerte verdeckt (fremdes Team)</span>
        ) : null}
      </>
    );
  }

  // Hover-Portal für die GEHALT-Kachel: Kaderspieler nach Gehalt + Vertragsform
  // (eigenes Team) bzw. nur der Gehaltsblock (fremdes Team, Fog-of-War).
  function renderGehaltPreview() {
    const total = isFiniteNumber(heroRow?.salaryTotal) ? (heroRow?.salaryTotal as number) : null;
    if (total == null && heroSalaryRows.length === 0) {
      return null;
    }
    const shown = heroSalaryRows.slice(0, NL_TEAMS_HERO_HOVER_MAX_ROWS);
    const rest = heroSalaryRows.length - shown.length;
    return (
      <>
        <span className="nl-teams-rank-preview-title">Gehalt · Kader</span>
        <ol className="nl-teams-rank-preview-list nl-tnum">
          {shown.map((row, index) => (
            <li key={row.id} className="nl-teams-rank-preview-row">
              <span className="nl-teams-rank-preview-rank">{index + 1}</span>
              <span className="nl-teams-rank-preview-team">
                {row.name}
                {row.shapeShort ? <small> · {row.shapeShort}</small> : null}
              </span>
              <span className="nl-teams-rank-preview-points">{formatNlMoney(row.salary)}</span>
            </li>
          ))}
          {rest > 0 ? (
            <li className="nl-teams-rank-preview-row">
              <span className="nl-teams-rank-preview-rank" aria-hidden="true" />
              <span className="nl-teams-rank-preview-team">… +{formatNlNumber(rest, 0)} weitere</span>
              <span className="nl-teams-rank-preview-points" aria-hidden="true" />
            </li>
          ) : null}
          {total != null ? (
            <li className="nl-teams-rank-preview-row is-self">
              <span className="nl-teams-rank-preview-rank" aria-hidden="true">
                Σ
              </span>
              <span className="nl-teams-rank-preview-team">Gehaltsblock</span>
              <span className="nl-teams-rank-preview-points">{formatNlMoney(total)}</span>
            </li>
          ) : null}
        </ol>
        {!heroIsOwnTeam ? (
          <span className="nl-teams-rank-preview-title">Einzel-Gehälter verdeckt (fremdes Team)</span>
        ) : null}
      </>
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
                <TeamsKpiHoverPortal
                  panelId="nl-teams-hero-rang-pop"
                  ariaLabel={`Rang ${selectedTeam.name} — Saisonstand`}
                  chip={
                    <StatChip
                      label="Rang"
                      value={heroRow?.rank != null ? `#${heroRow.rank}` : "—"}
                      tone="accent"
                      onClick={onOpenSeason ?? (() => openTeamProfileById(selectedTeam.teamId))}
                      title={onOpenSeason ? "Zum Saisonstand springen" : `${selectedTeam.name} Profil öffnen`}
                    />
                  }
                >
                  {rankPreviewRows.length > 0 ? (
                    <>
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
                    </>
                  ) : null}
                </TeamsKpiHoverPortal>
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
                <TeamsKpiHoverPortal
                  panelId="nl-teams-hero-cash-pop"
                  ariaLabel={`Cash ${selectedTeam.name} — GuV-Projektion`}
                  chip={
                    <StatChip
                      label="Cash"
                      value={heroRow?.cash != null ? formatNlMoney(heroRow.cash) : "—"}
                      tone={heroRow?.cash != null && heroRow.cash < 0 ? "risk" : "neutral"}
                      title="Cash — sortiert die Teamtabelle nach Cash"
                      onClick={() => handleHeroBoardSortSelect("cash", "desc")}
                    />
                  }
                >
                  {renderCashPreview()}
                </TeamsKpiHoverPortal>
                <TeamsKpiHoverPortal
                  panelId="nl-teams-hero-mw-pop"
                  ariaLabel={`Marktwert ${selectedTeam.name} — Kader`}
                  chip={
                    <StatChip
                      label="MW"
                      value={formatNlMoney(heroRow?.marketValueTotal)}
                      title="Marktwert gesamt — sortiert die Teamtabelle nach Marktwert"
                      onClick={() => handleHeroBoardSortSelect("mw", "desc")}
                    />
                  }
                >
                  {renderMwPreview()}
                </TeamsKpiHoverPortal>
                <TeamsKpiHoverPortal
                  panelId="nl-teams-hero-gehalt-pop"
                  ariaLabel={`Gehalt ${selectedTeam.name} — Kader`}
                  chip={
                    <StatChip
                      label="Gehalt"
                      value={heroRow != null ? formatNlMoney(heroRow.salaryTotal) : "—"}
                      title="Gehaltsblock des aktiven Kaders — öffnet die Kadertabelle"
                      onClick={() => {
                        setRosterMode("tabelle");
                        scrollToSection(rosterCardRef);
                      }}
                    />
                  }
                >
                  {renderGehaltPreview()}
                </TeamsKpiHoverPortal>
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
                        title={`Marktwert: ${formatNlMoney(previousSeasonRow.marketValue)} → ${formatNlMoney(liveHistoryRow?.marketValue)}`}
                      />
                    </span>
                  ) : null}
                </div>
              ) : null}
              {fieldRaceRecentForm != null ? (
                <NlFieldRaceFormStrip
                  entries={fieldRaceRecentForm}
                  playedMatchdayCount={fieldRacePlayedMatchdayCount}
                  className="nl-teams-hero-form"
                />
              ) : null}
            </div>
          </div>
          <div className="nl-teams-hero-axes">
            {renderAxisRankBadges(heroRow, selectedTeam.teamId, selectedTeam.name, false, handleHeroAxisSortSelect)}
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

      {teamDisciplineBreakdown != null && teamDisciplineBreakdown.length > 0 ? (
        <div ref={disciplineCardRef} className="nl-teams-anchor">
          <NlCard
            className="nl-teamdisc-card"
            eyebrow="Disziplin-Profil"
            title="Stärken je Disziplin"
            data-testid="nl-teams-discipline-breakdown"
            actions={
              <NlSubTabs
                items={[
                  { id: "strength", label: "Stärke" },
                  { id: "category", label: "Kategorie" },
                ]}
                activeId={disciplineSort}
                onSelect={(id) => setDisciplineSort(id as "strength" | "category")}
                aria-label="Disziplin-Liste sortieren"
                className="nl-teamdisc-subtabs"
              />
            }
          >
            <div className="nl-teamdisc-layout">
              <figure className="nl-teamdisc-radar-figure">
                {disciplineRadarAxes.length >= 3 ? (
                  <>
                    <NlTeamDisciplineRadar
                      axes={disciplineRadarAxes}
                      max={teamCount}
                      className="nl-teamdisc-radar-svg"
                      aria-label={`Disziplin-Stärkenprofil von ${selectedTeam.name}: Top ${disciplineRadarAxes.length} Disziplinen, außen = liga-stark`}
                    />
                    <figcaption className="nl-teamdisc-radar-caption">
                      Top {disciplineRadarAxes.length} von {teamDisciplineBreakdown.length} Disziplinen · außen = liga-stark
                    </figcaption>
                  </>
                ) : (
                  <p className="nl-teams-empty">Zu wenige Disziplin-Ränge für ein Radar.</p>
                )}
              </figure>
              <ul className="nl-teamdisc-list" aria-label={`Disziplin-Breakdown ${selectedTeam.name}`}>
                {sortedDisciplineBreakdown.map((entry) => {
                  const tone = getDisciplineRankTone(entry.rank, teamCount);
                  const axisLabel = NL_TEAMS_AXES.find((axis) => axis.key === entry.axis)?.label ?? entry.axis;
                  return (
                    <li key={entry.disciplineId} className="nl-teamdisc-row">
                      <span
                        className={`nl-teamdisc-row-axis ${nlToneClass(entry.axis)}`}
                        aria-hidden="true"
                        title={`Kategorie ${axisLabel}`}
                      />
                      <span className="nl-teamdisc-row-label" title={entry.label}>
                        {entry.shortLabel}
                      </span>
                      <NlProgressBar
                        value={entry.score ?? 0}
                        max={entry.leagueMax ?? 100}
                        tone={tone}
                        showValue={false}
                        className="nl-teamdisc-row-bar"
                        title={`${entry.label}: ${formatNlNumber(entry.score, 1)} · Liga-Max ${formatNlNumber(entry.leagueMax, 1)}`}
                      />
                      <span className="nl-teamdisc-row-score nl-tnum">{formatNlNumber(entry.score, 1)}</span>
                      <span className={`nl-teamdisc-row-rank nl-tnum ${nlToneClass(tone)}`}>
                        {entry.rank != null ? `#${formatNlNumber(entry.rank, 0)}` : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="nl-teamdisc-footnote">
              Team-Stärke je Disziplin = Summe der 6 besten scorefähigen Kader-Spieler in dieser Disziplin, gerankt
              gegen alle {teamCount > 0 ? teamCount : ""} Liga-Teams — dieselbe Formel wie die POW/SPE/MEN/SOC-Bereichsränge, nur pro
              Einzeldisziplin statt pro Kategorie.
            </p>
          </NlCard>
        </div>
      ) : null}

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
                      <span className="nl-teams-development-value nl-tnum">{formatNlMoney(liveHistoryRow?.marketValue)}</span>
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
                        ? `von ${formatNlMoney(developmentSeries.marketValueFirst)} auf ${formatNlMoney(developmentSeries.marketValueLast)}`
                        : "—"}
                    </p>
                  </article>
                  <article className="nl-teams-development-metric">
                    <header className="nl-teams-development-head">
                      <span className="nl-teams-development-label">Cash</span>
                      <span className="nl-teams-development-value nl-tnum">
                        {liveHistoryRow?.cash != null ? formatNlMoney(liveHistoryRow.cash) : "—"}
                      </span>
                      {seasonDeltas?.cashDelta != null ? (
                        <NlDeltaChip
                          value={seasonDeltas.cashDelta}
                          format={(n) => `${n > 0 ? "+" : ""}${formatNlMoney(n)}`}
                          title={`Cash ggü. ${previousSeasonRow?.seasonName ?? "Vorsaison"}`}
                        />
                      ) : null}
                    </header>
                    {developmentSeries.cashSpark.length >= 2 ? (
                      <NlSparkline
                        points={developmentSeries.cashSpark}
                        tone="good"
                        className="nl-teams-development-spark"
                        aria-label={`Cash-Verlauf von ${selectedTeam.name} über ${developmentRows.length} Saisons`}
                      />
                    ) : (
                      <p className="nl-teams-empty">Kein Cash-Verlauf vorhanden.</p>
                    )}
                    <p className="nl-teams-development-meta">
                      {developmentSeries.cashFirst != null && developmentSeries.cashLast != null
                        ? `von ${formatNlMoney(developmentSeries.cashFirst)} auf ${formatNlMoney(developmentSeries.cashLast)}`
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
                      }${row.marketValue != null ? ` · MW ${formatNlMoney(row.marketValue)}` : ""}`}
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
        {selectedTeamRosterActionHint ? (
          <p className={`nl-teams-action-hint${selectedTeamRosterActionsAvailable ? " is-ready" : " is-locked"}`}>
            <strong>{selectedTeamRosterActionsAvailable ? "Aktionen aktiv" : "Nur Ansicht"}</strong>
            <span>{selectedTeamRosterActionHint}</span>
          </p>
        ) : null}
        {selectedTeamRosterActionsAvailable && runTeamPicksRefill ? (
          <div className="nl-teams-roster-actions">
            <button
              type="button"
              className="nl-teams-action"
              disabled={teamPicksRefillBusyTeamId != null}
              title="KI-Picks für dieses Team neu anwerfen"
              onClick={() => void runTeamPicksRefill(selectedTeam.teamId)}
            >
              {teamPicksRefillBusyTeamId === selectedTeam.teamId ? "Wirbt an…" : "Kader auffüllen"}
            </button>
            {teamPicksRefillMessage && teamPicksRefillMessage.teamId === selectedTeam.teamId ? (
              <span className={nlToneClass(teamPicksRefillMessage.tone === "success" ? "good" : "risk")}>
                {teamPicksRefillMessage.text}
              </span>
            ) : null}
          </div>
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
                    onClick={() => handleBoardSortToggle(key, "desc")}
                    title={`Liga nach ${label}-Team-Stärke sortieren`}
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
