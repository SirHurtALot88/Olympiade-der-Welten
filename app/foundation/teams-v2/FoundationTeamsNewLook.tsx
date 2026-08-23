"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildExpectedSellValueByPlayerId,
  type ExpectedSellValueEntry,
} from "@/lib/market/transfermarkt-expected-sell-value";
import {
  buildTeamsPortraitMwValueText,
  resolveTeamsPortraitSellValueDisplay,
} from "@/lib/foundation/teams-portrait-sell-value";
import type { ReactNode } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import FoundationPlayerPortraitCard, {
  buildAxisPpsFromRating,
} from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
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
  nlTrendToneFromDelta,
  type NlAxisKey,
  type NlTone,
} from "@/components/foundation/new-look";
import { vertragLaeuftAus } from "@/lib/contracts/vertragslaufzeit";
import type { TeamDetailDrawerData } from "@/lib/foundation/team-detail-drawer-types";
import { getSeasonV2TeamTagStyle } from "@/app/foundation/season-v2/SeasonStandingsV2Client";
import { getClassColorClassName } from "@/app/foundation/classVisuals";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import type { Discipline, DisciplineCategory, GameState, Team } from "@/lib/data/olyDataTypes";
import { formatContractShapeShortLabel } from "@/lib/foundation/player-economy-contract";
import { areTeamPowersEnabled } from "@/lib/lineups/team-powers";
import { formatPlayerIdentitySubMeta } from "@/lib/foundation/player-identity-meta";
import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { FieldRaceLedgerEntry } from "@/lib/foundation/build-field-race-ledger";
import { buildTeamDisciplineRankRowsFromGameState } from "@/lib/foundation/team-discipline-rank-engine";
import { isFiniteNumber } from "@/lib/foundation/foundation-number-utils";
import { getQuartileRankTone } from "@/lib/foundation/quartile-tone";
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
import {
  buildCaptainCandidateProfiles,
  buildCaptainEffectExplanations,
  getTeamCaptainEffectsTooltip,
} from "@/lib/morale/team-captain-service";

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

// TEMP TEST: forces roster actions clickable so the sell/renew windows can be
// previewed mid-season. Remove when done. Der Server phase-gated produktive
// Writes weiterhin (Preview-sicher) — dieser Schalter macht NUR die Buttons
// klickbar. (Eigene lokale Konstante, Pendant zu FoundationTeamsDetailPanel.)
const TEMP_FORCE_ROSTER_ACTIONS = true;

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
   * Erwarteter Verkaufserloes je Spieler aus dem SERVER-Slice. Optional und bewusst nachrangig
   * behandelt: ein leeres Feld laesst die lokale Rueckfallebene stehen (siehe
   * `sellValueByPlayerId` unten).
   *
   * Braucht `grossSalePrice`/`buyoutCost` zusaetzlich zu `expectedSellValue`: die Karte zeigt den
   * BRUTTO-Preis (`grossSalePrice`, dieselbe Definition wie die "VK-Wert"-Spalte der
   * Spielerliste) als Hauptzahl, Buyout/Netto nur noch im Tooltip.
   */
  sliceSellValueByPlayerId?: Record<
    string,
    Pick<ExpectedSellValueEntry, "grossSalePrice" | "buyoutCost" | "expectedSellValue">
  > | null;
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
  /**
   * Rating-Zeilen je Spieler-ID — Quelle der Saison-PPs je Achse (`ppPow`/`ppPowRank`/…)
   * für die Portraitkarten, dieselben Felder wie die POW/SPE/MEN/SOC-Spalten der
   * Ranks-Seite. Optional: ohne Map bleibt die PPs-Zeile auf den Karten einfach weg.
   */
  playerRatingsById?: ReadonlyMap<string, PlayerRatingContractRow>;
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
  /**
   * Saison-Kapitän: aktueller Kapitän (playerId) + Assign-Handler + Busy-State.
   * Die Kandidatenliste inkl. Führungs-Breakdown baut die Kaderansicht selbst
   * aus `gameState` (fog-frei, reine Ableitung). Fehlt der Handler oder ist das
   * Team nicht steuerbar, bleibt die Kapitänswahl schreibgeschützt (nur Anzeige).
   */
  selectedTeamCaptainPlayerId?: string | null;
  assignTeamCaptainForSelectedTeam?: (playerId: string) => void | Promise<void>;
  assignTeamCaptainBusy?: boolean;
  /**
   * MERKLISTE — Lesezeichen auf Teams und Spieler.
   *
   * GEWUENSCHT (Chris): „man sollte sich aussuchen können welche teams getrackt werden, dass man
   * so ne wishlist option bei teams und spielern hat wie so lesezeichen und sich die dann noch
   * mal angucken kann · binde das bei den teams ein dass in der Arena dann die angezeigt werden
   * die ich gewishlistet habe zusätzlich zu den menschlichen teams".
   *
   * ALLES OPTIONAL: fehlen die Rueckrufe, bleibt die Ansicht exakt wie vorher — kein Stern, kein
   * toter Knopf. Die Liste haengt am Besitzer und nicht am Team; die Begruendung steht am Typ
   * `MerklisteEintrag` und in lib/merkliste/merkliste-service.ts.
   */
  gemerkteTeamIds?: ReadonlySet<string> | null;
  onToggleTeamMerken?: (teamId: string) => void;
  gemerkteSpielerIds?: ReadonlySet<string> | null;
  onToggleSpielerMerken?: (playerId: string) => void;
};

/**
 * Chris' Vorgabe („Team → kader als tabelle ist für mich 2. ansicht, kann mit verträgen quasi
 * kombiniert werden … Ich will die portrait ansicht weiterhin haben!"): Portraits bleiben die
 * erste Ansicht, die Tabelle wird zur zweiten Ansicht „Liste & Verträge" und trägt die
 * Vertragsdaten (Auslauf-Kennzahlen + Gehaltslast-Projektion über der Tabelle, „Läuft aus"
 * als beschrifteter Chip in der Zeile).
 */
const NL_TEAMS_ROSTER_MODE_ITEMS: Array<{ id: NlTeamsRosterMode; label: string }> = [
  { id: "portraits", label: "Portraits" },
  { id: "tabelle", label: "Liste & Verträge" },
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
  // Befund T3: gleicher Liga-Rang wird strikt nach eigenem Score aufgelöst
  // (stärker zuerst) — vorher sortierte hier das Alphabet und „Rang 4" stand
  // scheinbar wahllos durcheinander. Das Label bleibt nur Tertiärschlüssel
  // für vollständige Gleichstände.
  const leftScore = left.score ?? Number.NEGATIVE_INFINITY;
  const rightScore = right.score ?? Number.NEGATIVE_INFINITY;
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }
  return left.label.localeCompare(right.label, "de-DE");
}

/** Ton nach Liga-Rang-Quartil: die geteilte, theme-FESTE Rang-Skala
 * Gold→good→warn→risk (lib/foundation/quartile-tone.ts, Paket F2) —
 * dieselbe Skala wie die Liga-Perzentil-Chips der Spielerliste. Vorher
 * stand das Spitzenviertel auf `accent`: bei rotem Team-Theme sahen
 * Rang 1 und Rang 31 gleich aus. */
function getDisciplineRankTone(rank: number | null, teamCount: number): NlTone {
  return getQuartileRankTone(rank, teamCount);
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
  sliceSellValueByPlayerId,
  selectedTeamDetailTab,
  sortedTeamsViewRows,
  selectedTeamsHistoryData,
  fieldRaceRecentForm,
  fieldRacePlayedMatchdayCount,
  filteredSelectedRosterTableRows,
  playerRatingsById,
  leaguePlayerHeatPools,
  openTeamProfileById,
  openPlayerDrawerById,
  getPlayerPortraitModel,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getPlayerDisplayMarketValueDelta,
  getRosterEntrySalaryDelta,
  formatDisplayMoney,
  selectedTeamRosterActionsAvailable,
  selectedTeamRosterActionHint,
  marketSellBusy,
  contractRenewalBusy,
  openMarketSellModal,
  openContractRenewalNegotiation,
  onOpenSeason,
  selectedTeamCaptainPlayerId,
  assignTeamCaptainForSelectedTeam,
  assignTeamCaptainBusy,
  gemerkteTeamIds,
  onToggleTeamMerken,
  gemerkteSpielerIds,
  onToggleSpielerMerken,
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
  const [boardSort] = useState<NlTeamsBoardSort>({ key: "rank", dir: "asc" });
  const [disciplineSort, setDisciplineSort] = useState<"strength" | "category">("strength");
  // Saison-Kapitän: welcher Kandidat ist gerade zum Bestätigen ausgewählt +
  // welcher Führungs-Breakdown ist aufgeklappt. Beim Team-Wechsel (ohne Remount)
  // die Auswahl zurücksetzen, damit kein Fremdkader-Spieler „hängen bleibt".
  const [draftCaptainPlayerId, setDraftCaptainPlayerId] = useState<string | null>(null);
  const [expandedCaptainPlayerId, setExpandedCaptainPlayerId] = useState<string | null>(null);
  // Ist ein Kapitän gewählt, klappt der Picker zu einer kompakten Kachel zusammen
  // (nur der Kapitän sichtbar) — er soll die Kaderkarten nicht nach unten schieben.
  // Über „wechseln" lässt sich die volle Kandidatenliste wieder aufklappen.
  const [captainPickerExpanded, setCaptainPickerExpanded] = useState(false);
  const [captainSyncedTeamId, setCaptainSyncedTeamId] = useState<string>(selectedTeam.teamId);
  if (captainSyncedTeamId !== selectedTeam.teamId) {
    setCaptainSyncedTeamId(selectedTeam.teamId);
    setDraftCaptainPlayerId(null);
    setExpandedCaptainPlayerId(null);
  }

  const heroCardRef = useRef<HTMLDivElement | null>(null);
  const disciplineCardRef = useRef<HTMLDivElement | null>(null);
  const developmentCardRef = useRef<HTMLDivElement | null>(null);
  const rosterCardRef = useRef<HTMLDivElement | null>(null);

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

  // Saison-Kapitän: Kandidaten inkl. Führungs-Breakdown ("warum") direkt aus
  // dem GameState ableiten — identische Formel wie AI-Teams und der HQ-Picker.
  const captainCandidates = useMemo(
    () => buildCaptainCandidateProfiles(gameState, selectedTeam.teamId).slice(0, 8),
    [gameState, selectedTeam.teamId],
  );
  const currentCaptain = useMemo(
    () => captainCandidates.find((candidate) => candidate.playerId === selectedTeamCaptainPlayerId) ?? null,
    [captainCandidates, selectedTeamCaptainPlayerId],
  );
  const captainEffectsTooltip = getTeamCaptainEffectsTooltip();
  const canManageCaptain = heroIsOwnTeam && typeof assignTeamCaptainForSelectedTeam === "function";
  // Kompaktansicht, sobald ein Kapitän steht — nur aufgeklappt, wenn der Nutzer
  // aktiv „wechseln" gewählt hat (oder noch kein Kapitän gewählt ist).
  const captainCollapsed = Boolean(currentCaptain) && !captainPickerExpanded;
  // Nach jeder Kapitän-Änderung (Bestätigen) wieder einklappen + Team-Wechsel.
  useEffect(() => {
    setCaptainPickerExpanded(false);
  }, [selectedTeamCaptainPlayerId, selectedTeam.teamId]);

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

  /**
   * MW-Hover: Kaderspieler nach Marktwert absteigend — fuer JEDES Team.
   *
   * GEMELDET VON CHRIS: „die grafik soll auch von anderen teams verfuegbar sein! sowohl fuer MW
   * als auch gehalt und Rang!" Hier stand ein Fog-of-War-Riegel (`if (!heroIsOwnTeam) return []`),
   * der die Zusammensetzung auf das eigene Team beschraenkte; fremde Teams sahen nur die
   * Kadersumme und darunter „Einzel-Marktwerte verdeckt". Der Riegel ist aufgehoben — die Werte
   * liegen ohnehin in denselben Zeilen, aus denen die Kadertabelle und der Transfermarkt lesen,
   * es war eine reine Anzeige-Sperre.
   *
   * Reuse der Kadertabellen-Daten dieses Files (`getRosterEntryDisplayMarketValue`).
   */
  const heroMarketValueRows = useMemo(() => {
    return filteredSelectedRosterTableRows
      .map((row) => ({
        id: row.entry.id,
        playerId: row.player.id,
        name: row.player.name,
        marketValue: getRosterEntryDisplayMarketValue(row.entry, row.player),
      }))
      .filter((row) => isFiniteNumber(row.marketValue))
      .sort((left, right) => (right.marketValue ?? 0) - (left.marketValue ?? 0));
  }, [filteredSelectedRosterTableRows, getRosterEntryDisplayMarketValue]);

  // GEHALT-Hover: Kaderspieler nach Gehalt absteigend, mit Vertragsform-Tag (FL/BL/STD) über
  // `formatContractShapeShortLabel` — fuer JEDES Team, siehe die Begruendung beim MW-Hover.
  const heroSalaryRows = useMemo(() => {
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
  }, [filteredSelectedRosterTableRows, getRosterEntryDisplaySalary]);

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



  // Portal: eine Hero-Kachel (MW/Cash) klicken → Teamtabelle danach sortieren
  // und dorthin scrollen. „Klick MW → alle Teams nach Marktwert sortiert."


  // „Verträge & Auslauf" — Vertragsübersicht des gewählten Kaders (unten im
  // Teams-Reiter, ersetzt die entfernte „Alle Teams"-Tabelle). Restlaufzeit aus
  // entry.contractLength; Gehalt fog-gated (nur eigenes Team echte Werte).
  const contractRows = useMemo(() => {
    return filteredSelectedRosterTableRows
      .map((row) => {
        const salaryRaw = getRosterEntryDisplaySalary(row.entry, row.player);
        const length = Number.isFinite(row.entry.contractLength) ? row.entry.contractLength : 0;
        return {
          playerId: row.player.id,
          entryId: row.entry.id,
          playerName: row.player.name,
          roleTag: row.entry.roleTag,
          salary: heroIsOwnTeam && isFiniteNumber(salaryRaw) ? salaryRaw : null,
          contractLength: length,
          shapeShort: formatContractShapeShortLabel(row.entry.contractShape),
          expiring: vertragLaeuftAus(length),
        };
      })
      .sort((left, right) =>
        left.contractLength !== right.contractLength
          ? left.contractLength - right.contractLength
          : (right.salary ?? 0) - (left.salary ?? 0),
      );
  }, [filteredSelectedRosterTableRows, getRosterEntryDisplaySalary, heroIsOwnTeam]);

  /**
   * Erwarteter Verkaufserloes je Kaderspieler — EIN Batch-Lauf fuer alle Zeilen (der
   * Sale-Factor-Kontext ist je GameState gecacht); ein Aufruf pro Karte waere bei einem
   * vollen Kader zu teuer.
   */
  /**
   * Erwarteter Verkaufserloes je Kaderspieler.
   *
   * QUELLE IST DER SERVER-SLICE, sobald er da ist. Die lokale Rechnung bleibt nur Rueckfallebene:
   * der Verkaufsfaktor haengt an den gewerteten Spieltagen, und die sind im kompakten
   * Client-Payload auf den aktiven Spieltag beschnitten — clientseitig steht deshalb bei JEDEM
   * Spieler Faktor 1,0 und damit VK == MW (am gemeldeten Spielstand 339 von 339 Zeilen, siehe
   * `use-foundation-cross-tab-player-directory.ts`). Dieselbe Regel wie in der Spielerliste:
   * ein leeres Slice-Feld darf die lokale Ebene NICHT verdraengen.
   */
  const sellValueByPlayerId = useMemo(() => {
    const ausSlice = sliceSellValueByPlayerId ?? null;
    if (ausSlice && Object.keys(ausSlice).length > 0) {
      return new Map(Object.entries(ausSlice));
    }
    return buildExpectedSellValueByPlayerId(gameState);
  }, [gameState, sliceSellValueByPlayerId]);

  // KPIs: Ausläufer (Restlaufzeit ≤ 1), Ø-Restlaufzeit, Gehaltslast p.a. (eigenes Team).
  const contractSummary = useMemo(() => {
    const expiringCount = contractRows.filter((row) => row.expiring).length;
    const lengths = contractRows.map((row) => row.contractLength).filter((value) => value > 0);
    const avgLength = lengths.length > 0 ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length : null;
    const salaries = contractRows.map((row) => row.salary).filter(isFiniteNumber);
    const salaryTotal = heroIsOwnTeam && salaries.length > 0 ? salaries.reduce((sum, value) => sum + value, 0) : null;
    return { expiringCount, avgLength, salaryTotal, count: contractRows.length };
  }, [contractRows, heroIsOwnTeam]);

  // Gehaltslast-Projektion je kommender Saison (eigenes Team): Summe der Gehälter
  // aller Spieler, deren Vertrag in Saison-Offset s noch läuft (contractLength > s).
  // Zeigt, wie die Last mit auslaufenden Verträgen sinkt.
  const contractSalaryLoad = useMemo(() => {
    if (!heroIsOwnTeam) {
      return [];
    }
    const maxLen = contractRows.reduce((max, row) => (row.contractLength > max ? row.contractLength : max), 0);
    const horizon = Math.min(Math.max(maxLen, 1), 5);
    const bars: Array<{ label: string; value: number; tone: NlTone }> = [];
    for (let offset = 0; offset < horizon; offset += 1) {
      const load = contractRows.reduce(
        (sum, row) => (row.contractLength > offset && isFiniteNumber(row.salary) ? sum + row.salary : sum),
        0,
      );
      bars.push({ label: offset === 0 ? "Aktuell" : `+${offset}`, value: load, tone: "warn" });
    }
    return bars;
  }, [contractRows, heroIsOwnTeam]);

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
          // GEMELDET VON CHRIS: „neben MW fehlt noch gehalt! bitte die breite nutzen und darunter
          // die aenderung von MW zum aktuellen VK bzw VK wird angezeigt und diff zum MW".
          //
          // Gehalt steht wie ueberall unter dem Nebel-Vorbehalt: echte Zahlen nur beim eigenen
          // Team (dieselbe Regel wie in `contractRows`). Bei fremden Teams bleibt die Kachel leer
          // statt eine Zahl zu erfinden.
          const salaryRaw = getRosterEntryDisplaySalary(entry, player);
          const salary = heroIsOwnTeam && isFiniteNumber(salaryRaw) ? salaryRaw : null;
          // DEFINITIONS-GLEICH mit der "VK-Wert"-Spalte der Spielerliste
          // (`FoundationPlayersTableNewLook.tsx`, `row.sellPreview.grossSalePrice`): Brutto, nicht
          // Netto. Diese Karte griff vorher auf `.expectedSellValue` (Netto = Brutto − Rest-Buyout)
          // zu — zwei Felder DESSELBEN Eintrags, zwei Zahlen für denselben Spieler. Siehe
          // `resolveTeamsPortraitSellValueDisplay` (lib/foundation/teams-portrait-sell-value.ts).
          const sellEntry = sellValueByPlayerId.get(player.id) ?? null;
          const sellValueDisplay = sellEntry
            ? resolveTeamsPortraitSellValueDisplay({ entry: sellEntry, marketValue })
            : null;
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
              axisPps={buildAxisPpsFromRating(playerRatingsById?.get(player.id))}
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
              // T2 (Chris: „es ist ein game und kein excel"): Die Portrait-Karte trägt keine
              // Vertragsdetails mehr — Gehalt und Laufzeit stehen genau einmal in der Ansicht
              // „Liste & Verträge". Übrig bleibt der Marktwert als Spieler-Kennzahl.
              //
              // NACHTRAG CHRIS zur VK-Anzeige: „mach dort lieber den MW hin und nur in klammern
              // den aktuellen VK preis" — MW bleibt die Leitzahl, der VK-Preis (Brutto, dieselbe
              // Definition wie die Spielerliste) steht dahinter in Klammern samt seinem Abstand
              // zum Marktwert. Zusammen mit der Breiten-Vorgabe (MW+Gehalt füllen die Zeile, siehe
              // `.foundation-player-portrait-economy:has(...)` in globals.css) ersetzt das die
              // vorherige separate VK-Zeile (`nl-teams-portrait-sellvalue`) vollständig — kein
              // drittes, leeres Grid-Feld mehr, kein eigener Footer mehr.
              economyStats={[
                {
                  label: "MW",
                  value: buildTeamsPortraitMwValueText({ marketValue, sellValueDisplay }),
                  title: sellValueDisplay
                    ? `MW — Marktwert (mit Delta zur Vorwoche). ${sellValueDisplay.tooltip}`
                    : "MW — Marktwert (mit Delta zur Vorwoche)",
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
                  value: salary != null ? formatNlMoney(salary) : "—",
                  title:
                    salary != null
                      ? "Gehalt — aktuelles Jahresgehalt aus dem laufenden Vertrag"
                      : "Gehalt — nur fuer das eigene Team sichtbar",
                },
              ]}
            />
          );
        })}
      </div>
    );
  }

  /**
   * Auslauf-Zusammenfassung der Kaderplanung — EINE Quelle (`contractSummary`/
   * `contractSalaryLoad`), zwei Darstellungen: über der „Liste & Verträge"-Tabelle
   * die volle Fassung (KPIs + Gehaltslast-Projektion), unter den Portraits nur die
   * KPIs samt Absprung in die Listenansicht. Die per-Spieler-Vertragsdaten stehen
   * NUR noch in der Tabelle — nicht mehr als dritte Kopie in einer Extra-Liste.
   */
  function renderContractPlanningSummary(variant: "list" | "compact") {
    if (contractRows.length === 0) {
      return null;
    }
    const expiringNames = contractRows.filter((row) => row.expiring).map((row) => row.playerName);
    return (
      <div className={`nl-teams-contractplan${variant === "compact" ? " is-compact" : ""}`}>
        <StatChipRow className="nl-teams-contracts-kpis" aria-label="Vertrags-Kennzahlen">
          <StatChip
            label="Ausläufer"
            value={formatNlNumber(contractSummary.expiringCount, 0)}
            sub={`von ${formatNlNumber(contractSummary.count, 0)} im Kader`}
            tone={contractSummary.expiringCount > 0 ? "warn" : "good"}
            title="Verträge mit Restlaufzeit ≤ 1 Saison — laufen bald aus"
          />
          <StatChip
            label="Ø Restlaufzeit"
            value={contractSummary.avgLength != null ? `${formatNlNumber(contractSummary.avgLength, 1)} Sais.` : "—"}
            title="Durchschnittliche verbleibende Vertragslaufzeit des Kaders"
          />
          {heroIsOwnTeam ? (
            <StatChip
              label="Gehaltslast p.a."
              value={contractSummary.salaryTotal != null ? formatNlMoney(contractSummary.salaryTotal) : "—"}
              tone="warn"
              title="Summe der aktuellen Jahresgehälter des Kaders"
            />
          ) : null}
        </StatChipRow>
        {variant === "list" && heroIsOwnTeam && contractSalaryLoad.length > 0 ? (
          <div className="nl-teams-contracts-load" aria-label="Gehaltslast-Projektion je Saison">
            <span className="nl-teams-contracts-load-label">
              Gehaltslast je Saison — sinkt mit auslaufenden Verträgen
            </span>
            <NlBarChart
              bars={contractSalaryLoad}
              format={(value) => formatNlMoney(value)}
              aria-label="Projizierte Gehaltslast der kommenden Saisons"
              className="nl-teams-contracts-load-chart"
            />
          </div>
        ) : null}
        {variant === "compact" ? (
          <p className="nl-teams-contractplan-line">
            {expiringNames.length > 0 ? (
              <>
                Läuft aus: <strong>{expiringNames.join(" · ")}</strong> —{" "}
              </>
            ) : (
              <>Kein Vertrag läuft aus — </>
            )}
            <button
              type="button"
              className="nl-teams-contractplan-switch"
              onClick={() => {
                setRosterMode("tabelle");
                scrollToSection(rosterCardRef);
              }}
            >
              Details in „Liste &amp; Verträge"
            </button>
          </p>
        ) : null}
      </div>
    );
  }

  function renderRosterTable() {
    // Aktionen-Spalte ist IMMER sichtbar (Discoverability): außerhalb des
    // Season-End-Fensters sind die Buttons ausgegraut + Tooltip statt
    // versteckt. TEMP_FORCE_ROSTER_ACTIONS macht sie zum Testen klickbar.
    const showActions = true;
    const rosterActionsEnabled = selectedTeamRosterActionsAvailable || TEMP_FORCE_ROSTER_ACTIONS;
    const sellActionTitle = selectedTeamRosterActionsAvailable
      ? "Verkaufen — öffnet die Verkaufs-Vorschau"
      : TEMP_FORCE_ROSTER_ACTIONS
        ? "Test-Modus: Aktion freigeschaltet. Verkauf öffnet regulär am Season-End (nach MD10)."
        : "Verkauf öffnet am Season-End (nach MD10).";
    const renewActionTitle = selectedTeamRosterActionsAvailable
      ? "Verlängern — öffnet die Gehaltsverhandlung"
      : TEMP_FORCE_ROSTER_ACTIONS
        ? "Test-Modus: Aktion freigeschaltet. Gehaltsverhandlung öffnet regulär am Season-End (nach MD10)."
        : "Gehaltsverhandlung öffnet am Season-End (nach MD10).";
    return (
      <>
      {renderContractPlanningSummary("list")}
      <div className="nl-teams-table-shell" style={{ overflowX: "auto", maxWidth: "100%", minWidth: 0 }}>
        <table className="nl-teams-table nl-tnum">
          <thead>
            <tr>
              <th className="nl-teams-th-player">Spieler</th>
              <th className="nl-teams-th-role">Rolle</th>
              <th>OVR</th>
              <th>MVS</th>
              <th>PPs</th>
              <th title="Marktwert">MW</th>
              <th>Gehalt</th>
              <th title="Vertrags-Restlaufzeit in Saisons">Vertrag</th>
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
              const isContractExpiring = vertragLaeuftAus(entry.contractLength);
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
                      <span className="nl-teams-playername">
                        {player.name}
                        {/* Audit T7: „Läuft aus" als beschrifteter Chip statt unerklärter
                            Goldfärbung des Namens. */}
                        {isContractExpiring ? (
                          <span
                            className="nl-teams-expiring-chip"
                            title="Letzte Vertragssaison — endet nach MD10. Verlängern, sonst wandert der Spieler beim Verkauf auf den Transfermarkt."
                          >
                            Läuft aus
                          </span>
                        ) : null}
                      </span>
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
                    {formatNlNumber(entry.contractLength, 0)} Sais.
                    {shapeShort ? <small className="nl-teams-shape"> · {shapeShort}</small> : null}
                  </td>
                  {showActions ? (
                    <td className="nl-teams-td-actions" onClick={(event) => event.stopPropagation()}>
                      {/* Der Stern steht VOR den Vertragsaktionen und ausserhalb ihrer Gruppe: er
                          ist die einzige Aktion hier, die nichts am Spiel aendert — nur an dem,
                          was ich mir ansehen will. Er ist deshalb auch nie gesperrt, waehrend
                          Verlaengern und Verkaufen am Season-End-Fenster haengen. */}
                      {onToggleSpielerMerken ? (
                        <button
                          type="button"
                          className={`nl-merk-stern${gemerkteSpielerIds?.has(player.id) ? " is-gemerkt" : ""}`}
                          onClick={() => onToggleSpielerMerken(player.id)}
                          aria-pressed={Boolean(gemerkteSpielerIds?.has(player.id))}
                          aria-label={
                            gemerkteSpielerIds?.has(player.id)
                              ? `${player.name} von der Merkliste nehmen`
                              : `${player.name} merken`
                          }
                          title={
                            gemerkteSpielerIds?.has(player.id)
                              ? `${player.name} von der Merkliste nehmen`
                              : `${player.name} merken — bleibt auch nach einem Kauf auf der Liste`
                          }
                        >
                          {gemerkteSpielerIds?.has(player.id) ? "★" : "☆"}
                        </button>
                      ) : null}
                      {/* T-036: „Verkaufen" ist destruktiv und stand bisher direkt
                          neben „Verlängern" in identischer Optik → Fehlklick-Gefahr.
                          Fix: eigene Gruppe mit sichtbarem Abstand + Warnstil
                          (`nl-teams-action-danger`), „Verlängern" (unkritisch)
                          zuerst. Der eigentliche Verkauf bleibt zusätzlich durch
                          den Vorschau-/Bestätigungsschritt in `openMarketSellModal`
                          abgesichert (öffnet nur ein Preview-Panel, verkauft nicht
                          sofort). */}
                      <button
                        type="button"
                        className="nl-teams-action"
                        disabled={!rosterActionsEnabled || contractRenewalBusy != null}
                        title={renewActionTitle}
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
                      <span className="nl-teams-action-danger-group">
                        <button
                          type="button"
                          className="nl-teams-action nl-teams-action-danger"
                          disabled={!rosterActionsEnabled || marketSellBusy}
                          title={sellActionTitle}
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
      <p className="nl-teams-table-legend">
        <strong>OVR</strong> Gesamtstärke · <strong>MVS</strong> Marktwert-Score · <strong>PPs</strong>{" "}
        Performance-Punkte · <strong>MW</strong> Marktwert · Vertrag = Restlaufzeit. Tiefe Vertragswerkzeuge
        (Buyout, Netto bei Verkauf, Board-Vorschlag) liegen im Reiter „Verträge".
      </p>
      </>
    );
  }

  // Hover-Karte pro Teamtabellen-Zeile: Mini-Radar aus den aktuellen
  // Bereichs-Rängen + Saison-Sparklines aus `historicalPointsBySeason`
  // (echte Snapshot-Punkte/-Ränge, chronologisch) plus Live-Saison.

  // Aktive Sortierung als Zeilenwert: zeigt in jeder Zeile genau den Wert, nach
  // dem gerade sortiert wird, wenn er nicht ohnehin schon in der Zeile steht
  // (Rang/Punkte/Cash/Medaillen/Achsen sind bereits sichtbar). So sieht man
  // beim Sortieren nach MW/Gehalt/Kader auch die zugehörige Zahl.


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
              {/* Der Stern sitzt AM NAMEN und nicht bei den Kennzahlen-Chips: er sagt nichts ueber
                  das Team aus, sondern ueber die eigene Beobachtung — und beim Namen sucht ihn,
                  wer ihn setzen will. Ohne Rueckruf erscheint er gar nicht erst; ein Knopf, der
                  nichts tut, waere schlimmer als keiner. */}
              <h2 className="nl-teams-hero-name">
                {selectedTeam.name}
                {onToggleTeamMerken ? (
                  <button
                    type="button"
                    className={`nl-merk-stern${gemerkteTeamIds?.has(selectedTeam.teamId) ? " is-gemerkt" : ""}`}
                    onClick={() => onToggleTeamMerken(selectedTeam.teamId)}
                    aria-pressed={Boolean(gemerkteTeamIds?.has(selectedTeam.teamId))}
                    title={
                      gemerkteTeamIds?.has(selectedTeam.teamId)
                        ? `${selectedTeam.name} von der Merkliste nehmen`
                        : `${selectedTeam.name} merken — erscheint dann vor jedem Spieltag in der Arena`
                    }
                    data-testid="nl-merk-stern-team"
                  >
                    {gemerkteTeamIds?.has(selectedTeam.teamId) ? "★" : "☆"}
                  </button>
                ) : null}
              </h2>
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
                      title="Cash — GuV-Projektion einblenden"
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
                      title="Marktwert gesamt — Kader-Breakdown einblenden"
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
            {renderAxisRankBadges(heroRow, selectedTeam.teamId, selectedTeam.name, false)}
            {heroRadarAxes.length > 0 ? (
              <figure className="nl-teams-hero-radar-figure">
                <NlRadar
                  axes={heroRadarAxes}
                  max={teamCount}
                  className="nl-teams-hero-radar"
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
                  /**
                   * Chris' Screenshot-Befund: In dieser Liste steckten ZWEI Farbsysteme in einer
                   * Zeile — der Kategorie-Punkt (SPE = grün) neben dem Rang-Quartil-Balken
                   * (zweites Viertel = ebenfalls grün). Grün bedeutete zwei verschiedene Dinge.
                   * Entscheidung: Der BALKEN trägt die Kategoriefarbe (dasselbe Vokabular wie das
                   * Radar links — beide sagen jetzt dasselbe), der RANG bleibt die Zahl. Die
                   * Quartil-Skala (`getDisciplineRankTone`) färbt hier keine Fläche mehr; sie
                   * markiert nur noch die Ausreißer: Medaille für die Top-3, dezenter
                   * Risiko-Marker für das Schlussviertel. Überall sonst (Spieler-Perzentile,
                   * Team-Ränge) gilt die geteilte Quartil-Skala unverändert.
                   */
                  const tone = getDisciplineRankTone(entry.rank, teamCount);
                  const axisLabel = NL_TEAMS_AXES.find((axis) => axis.key === entry.axis)?.label ?? entry.axis;
                  const medalKind =
                    entry.rank === 1 ? ("gold" as const) : entry.rank === 2 ? ("silver" as const) : entry.rank === 3 ? ("bronze" as const) : null;
                  const isTailQuartile = tone === "risk";
                  return (
                    <li key={entry.disciplineId} className="nl-teamdisc-row">
                      {/* Der frühere Kategorie-Punkt ist raus: der Balken trägt die Kategoriefarbe
                          jetzt selbst, der Punkt wäre nur eine zweite Kopie derselben Aussage.
                          Sein Tooltip lebt im Disziplin-Label weiter. */}
                      <span className="nl-teamdisc-row-label" title={`${entry.label} — Kategorie ${axisLabel}`}>
                        {entry.shortLabel}
                      </span>
                      <NlProgressBar
                        value={entry.score ?? 0}
                        max={entry.leagueMax ?? 100}
                        tone={entry.axis}
                        showValue={false}
                        className="nl-teamdisc-row-bar"
                        title={`${entry.label} (Kategorie ${axisLabel}): ${formatNlNumber(entry.score, 1)} · Liga-Max ${formatNlNumber(entry.leagueMax, 1)}`}
                      />
                      <span className="nl-teamdisc-row-score nl-tnum">{formatNlNumber(entry.score, 1)}</span>
                      <span
                        className={`nl-teamdisc-row-rank nl-tnum${isTailQuartile ? " is-tail" : ""}`}
                        title={
                          entry.rank != null
                            ? `Liga-Rang #${formatNlNumber(entry.rank, 0)} von ${formatNlNumber(teamCount, 0)}${
                                medalKind ? " — Top 3" : isTailQuartile ? " — Schlussviertel" : ""
                              }`
                            : undefined
                        }
                      >
                        {medalKind ? <NlMedalBadge kind={medalKind} className="nl-teamdisc-row-medal" title={`Liga-Rang #${formatNlNumber(entry.rank, 0)} — Top 3`} /> : null}
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
                    {developmentSeries.pointBars.length >= 2 ? (
                      <NlBarChart
                        bars={developmentSeries.pointBars}
                        format={(value) => formatNlNumber(value, 0)}
                        className="nl-teams-development-bars"
                        aria-label={`Punkte pro Saison von ${selectedTeam.name}`}
                      />
                    ) : developmentSeries.pointBars.length === 1 ? (
                      // Chris' Screenshot-Befund: EIN Datenpunkt ist kein Verlauf — der einzelne
                      // Riesenbalken („86 · S1", mehrere hundert Pixel) wird zu Wert + Einordnung,
                      // genau wie die drei Nachbar-Kacheln bei < 2 Punkten.
                      <p className="nl-teams-empty">
                        Erst eine Saison mit Punkten ({developmentSeries.pointBars[0].label}:{" "}
                        {formatNlNumber(developmentSeries.pointBars[0].value, 0)}) — der Verlauf entsteht ab der
                        zweiten.
                      </p>
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
                      // Ton aus der RICHTUNG, aus derselben Quelle wie der Delta-Chip darüber —
                      // nie mehr fest verdrahtetes Grün für eine fallende Kurve.
                      <NlSparkline
                        points={developmentSeries.marketValueSpark}
                        tone={nlTrendToneFromDelta(seasonDeltas?.marketValueDelta)}
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
                        tone={nlTrendToneFromDelta(seasonDeltas?.cashDelta)}
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

      {heroIsOwnTeam ? (
        <div className="nl-teams-anchor" id="foundation-teams-captain-picker" data-testid="foundation-teams-captain-picker">
          <NlCard
            className={`nl-teams-captain-card${currentCaptain ? "" : " is-due"}`}
            eyebrow="Saison-Führung"
            title="Kapitän wählen"
            actions={
              currentCaptain ? (
                <span className="nl-teams-captain-active" title={captainEffectsTooltip}>
                  Aktiv: <strong>{currentCaptain.playerName}</strong> · {currentCaptain.style}
                </span>
              ) : (
                <span className="nl-teams-captain-active is-open">Noch kein Kapitän</span>
              )
            }
          >
            {captainCandidates.length === 0 ? (
              <p className="nl-teams-action-hint is-locked">
                <strong>Kein Kader</strong>
                <span>Erst nach den Käufen stehen Kapitäns-Kandidaten bereit.</span>
              </p>
            ) : captainCollapsed && currentCaptain ? (
              <div className="nl-teams-captain-collapsed">
                <span className="nl-teams-captain-collapsed-identity">
                  <strong>{currentCaptain.playerName}</strong>
                  <small>{currentCaptain.style}</small>
                </span>
                {/* Alle vier realen Effekte mit ihrer Herleitung im Tooltip. Frueher standen
                    hier nur Moral und der ROHE Team-Power-Wert (max 8) — der wird in der
                    Auflösung geviertelt und wirkt nur mit gespielter Team-Power, und die
                    Vorstands-Daempfung fehlte ganz. `buildCaptainEffectExplanations` liefert
                    die wirksamen Werte aus denselben Konstanten wie die Rechnung. */}
                <span className="nl-teams-captain-collapsed-effects nl-tnum" title={captainEffectsTooltip}>
                  {buildCaptainEffectExplanations(currentCaptain).map((effect) => (
                    <span key={effect.key} title={effect.tooltip}>
                      {effect.label} {effect.displayValue}
                    </span>
                  ))}
                </span>
                {canManageCaptain ? (
                  <button
                    type="button"
                    className="nl-teams-captain-change"
                    onClick={() => {
                      setDraftCaptainPlayerId(selectedTeamCaptainPlayerId ?? null);
                      setCaptainPickerExpanded(true);
                    }}
                    title="Kandidatenliste wieder aufklappen"
                  >
                    Kapitän wechseln
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <p className="nl-teams-captain-intro">{captainEffectsTooltip}</p>
                <ul className="nl-teams-captain-list" aria-label="Kapitäns-Kandidaten nach Führungswertung">
                  {captainCandidates.map((candidate, index) => {
                    const isCurrent = candidate.playerId === selectedTeamCaptainPlayerId;
                    const isDraft = candidate.playerId === draftCaptainPlayerId;
                    const isExpanded = candidate.playerId === expandedCaptainPlayerId;
                    const maxFactorPoints = Math.max(
                      1,
                      ...candidate.leadershipBreakdown.map((factor) => Math.abs(factor.points)),
                    );
                    return (
                      <li
                        key={`nl-captain-${candidate.playerId}`}
                        className={`nl-teams-captain-row${isDraft ? " is-draft" : ""}${isCurrent ? " is-current" : ""}`}
                      >
                        <button
                          type="button"
                          className="nl-teams-captain-pick"
                          onClick={() => canManageCaptain && setDraftCaptainPlayerId(candidate.playerId)}
                          disabled={!canManageCaptain || Boolean(assignTeamCaptainBusy)}
                          aria-pressed={isDraft}
                          title={canManageCaptain ? "Als Kapitän vormerken" : "Nur beim eigenen Team wählbar"}
                        >
                          <span className="nl-teams-captain-order">{index + 1}</span>
                          <span className="nl-teams-captain-identity">
                            <strong>{candidate.playerName}</strong>
                            <small>
                              <span className="nl-teams-captain-style">{candidate.style}</span>
                              {isCurrent ? <span className="nl-teams-captain-badge">Kapitän</span> : null}
                              {candidate.hasCaptaincyDemand ? (
                                <span className="nl-teams-captain-demand" title={candidate.demandLabel ?? "Will Kapitän sein"}>
                                  {candidate.demandLabel ?? "Will Kapitän sein"}
                                </span>
                              ) : null}
                            </small>
                          </span>
                          <span className="nl-teams-captain-score nl-tnum" title="Führungswertung">
                            <b>{formatNlNumber(candidate.leadershipScore, 1)}</b>
                            <small>Führung</small>
                          </span>
                          <span className="nl-teams-captain-effects nl-tnum">
                            {buildCaptainEffectExplanations(candidate).map((effect) => (
                              <span key={effect.key} title={effect.tooltip}>
                                {effect.label} {effect.displayValue}
                              </span>
                            ))}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="nl-teams-captain-why"
                          onClick={() =>
                            setExpandedCaptainPlayerId((prev) => (prev === candidate.playerId ? null : candidate.playerId))
                          }
                          aria-expanded={isExpanded}
                          title="Aufschlüsselung der Führungswertung"
                        >
                          {isExpanded ? "Warum ▲" : "Warum ▾"}
                        </button>
                        {isExpanded ? (
                          <dl className="nl-teams-captain-breakdown" aria-label={`Führungs-Aufschlüsselung ${candidate.playerName}`}>
                            {candidate.leadershipBreakdown.map((factor) => (
                              <div key={`${candidate.playerId}-${factor.key}`} className="nl-teams-captain-factor">
                                <dt>{factor.label}</dt>
                                <dd className="nl-tnum">
                                  <span className="nl-teams-captain-factor-raw">
                                    {factor.key === "traits"
                                      ? `+${formatNlNumber(factor.rawValue, 1)}`
                                      : `${formatNlNumber(factor.rawValue, 0)} × ${factor.weight}`}
                                  </span>
                                  <span className="nl-teams-captain-factor-bar" aria-hidden>
                                    <span
                                      className="nl-teams-captain-factor-fill"
                                      style={{ width: `${Math.min(100, (Math.abs(factor.points) / maxFactorPoints) * 100)}%` }}
                                    />
                                  </span>
                                  <b>+{formatNlNumber(factor.points, 1)}</b>
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {canManageCaptain ? (
                  <div className="nl-teams-captain-confirm">
                    <button
                      type="button"
                      className="nl-teams-action is-primary"
                      disabled={
                        !draftCaptainPlayerId ||
                        Boolean(assignTeamCaptainBusy) ||
                        draftCaptainPlayerId === selectedTeamCaptainPlayerId
                      }
                      onClick={() => {
                        if (draftCaptainPlayerId) {
                          void assignTeamCaptainForSelectedTeam?.(draftCaptainPlayerId);
                        }
                      }}
                    >
                      {assignTeamCaptainBusy ? "Speichert …" : "Kapitän bestätigen"}
                    </button>
                    {currentCaptain ? (
                      <button
                        type="button"
                        className="nl-teams-action"
                        disabled={Boolean(assignTeamCaptainBusy)}
                        onClick={() => {
                          setDraftCaptainPlayerId(null);
                          setCaptainPickerExpanded(false);
                        }}
                        title="Ohne Änderung wieder einklappen"
                      >
                        Abbrechen
                      </button>
                    ) : null}
                    <span className="nl-teams-captain-hint">
                      Führung = Charisma, Wille, Entschlossenheit, Übersicht, Klasse & Charakter-Boni. Der Kapitän puffert
                      Moral{areTeamPowersEnabled() ? ", senkt Rivalitäts-Druck und stärkt die Team-Power." : " und senkt Rivalitäts-Druck."}
                    </span>
                  </div>
                ) : (
                  <p className="nl-teams-captain-hint">Kapitänswahl ist nur für dein eigenes, gesteuertes Team möglich.</p>
                )}
              </>
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
        {/* Hier stand „Kader auffüllen" — der KI-Pick-Lauf fuer dieses Team, samt Meldungszeile.
            ENTSCHEIDUNG VON CHRIS (19.08.): „keiner von uns soll seinen kader per KI füllen! weg
            damit." Er erschien nur auf einem selbst gefuehrten Team im Saisonende-Fenster, also
            genau im Fall, den es nicht mehr geben soll. Kader entstehen ueber den Transfermarkt.

            ZWEITE KOPIE, ACHTUNG BEIM NAECHSTEN UMBAU: denselben Knopf gab es auch im alten
            Team-Panel (`FoundationTeamsDetailPanel.tsx`). Gerendert wurde diese hier. */}
        {rosterMode === "portraits" ? renderRosterGrid() : renderRosterTable()}
      </NlCard>
      </div>

      {/* T1 „Liste & Verträge": In der Listenansicht steht die Kaderplanung ÜBER der Tabelle
          (renderContractPlanningSummary) — die frühere Extra-Karte mit einer dritten Kopie der
          per-Spieler-Vertragsdaten entfällt dort. Unter den Portraits bleibt eine kompakte
          Zusammenfassung mit Absprung in die Listenansicht (Portraits bleiben vertragsfrei —
          „es ist ein game und kein excel"). */}
      {rosterMode === "portraits" ? (
        <div className="nl-teams-anchor">
          <NlCard className="nl-teams-contracts-card" eyebrow="Kaderplanung" title="Verträge & Auslauf">
            {contractRows.length > 0 ? (
              renderContractPlanningSummary("compact")
            ) : (
              <p className="nl-teams-empty">Keine Kaderdaten für diese Ansicht.</p>
            )}
          </NlCard>
        </div>
      ) : null}
    </div>
  );
}
