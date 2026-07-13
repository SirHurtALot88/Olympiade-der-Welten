"use client";

/**
 * "Neuer Look" Spieler-Verzeichnis (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `FoundationShellRouterBody` fällt ohne Flag unverändert auf die bestehende
 * Players-Tabelle zurück. Konsumiert exakt dieselben Daten wie die alte
 * Ansicht (`sortedPlayersTableRows` + Filter-State aus dem Shell-Scope);
 * es wird nichts erfunden.
 *
 * Erhalten bleiben alle Funktionen der alten Tabelle:
 * - Scope- (Aktive/Free Agents/Alle), Team- und Klassen-Filter,
 * - jede Sortier-Spalte (gleiche `dataKey`s über `toggleTableSort`),
 * - alle Datenspalten (Bild, Name, Team, Klasse, Rasse, PPs, OVR, MVS,
 *   MW, Gehalt, Vertrag, Einsätze, Beste Diszi, Alltime, Traits),
 * - Zeilen-/Namensklick öffnet den Spieler-Drawer, Teamklick das Teamprofil,
 * - liga-relative Heat-Färbung (PPs/OVR/MVS) und die Bracket-Verteilung.
 *
 * Stat-Junkie-Zusätze (nur reale Daten aus denselben Props):
 * - Kader-/Liga-Summary im Header (Ø OVR, Ø MW, Gehaltssumme),
 * - Leader-Chips (Top OVR/PPs/MVS/MW) als Portale in den Spieler-Drawer,
 *   inkl. ligaweitem Rang aus den Heat-Pools,
 * - POW/SPE/MEN/SOC pro Zeile als getönte Achsen-Mini-Bars,
 * - MW-/Gehalts-Entwicklung als Delta-Chips (Baseline-Vergleich),
 * - Alltime-Spalte (Saisons · Einsätze · PPs über alle Saisons).
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten in den Props gibt:
 * kein Pro-Saison-Sparkline je Spieler (OVR-/MW-Historie pro Saison existiert
 * nur im Spieler-Drawer über `historyRows`, nicht in den Tabellen-Rows).
 *
 * Styles: `app/globals.css` unter `.is-new-look .nl-players-*`.
 */

import { useEffect, useMemo, useState } from "react";

import ClassIcon from "@/app/foundation/ClassIcon";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import RaceIcon from "@/app/foundation/RaceIcon";
import {
  formatContractShapeLabel,
  formatContractShapeShortLabel,
  rosterSalariesDifferForDisplay,
} from "@/lib/foundation/player-economy-contract";
import {
  formatLocalePoints,
  formatPpsValue,
  formatWholeNumber,
  getPlayerDisplayMarketValue,
  getPlayerDisplayMarketValueDelta,
  getPlayerDisplaySalary,
  getPlayerPortraitModel,
  getPoolHeatClass,
  getRosterEntryCurrentSeasonSalary,
  getRosterEntryDisplaySalary,
  getRosterEntrySalaryDelta,
  getTeamLogoModel,
  type PlayerTableScope,
} from "@/app/foundation/foundation-page-client-exports";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlMedalBadge,
  NlRankingDrawer,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlMoney,
  formatNlNumber,
  nlToneClass,
  type NlAxisKey,
  type NlRankingDrawerRow,
  type NlTone,
} from "@/components/foundation/new-look";
import { NlAbilityStars } from "@/components/foundation/velo-ui/NlAbilityStars";
import FoundationPlayerPortraitPreview from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { SortState } from "@/lib/foundation/foundation-table-ui-types";
import {
  formatLeaguePercentile,
  getPoolHeatTone,
  type LeaguePlayerHeatPools,
} from "@/lib/foundation/player-league-heat";
import type { FoundationPlayerScopeRow } from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";

export type FoundationPlayersTableNewLookProps = {
  /** Bereits nach `tableSorts.playersTable` sortierte, gefilterte Zeilen. */
  rows: FoundationPlayerScopeRow[];
  gameState: GameState;
  leaguePlayerHeatPools: LeaguePlayerHeatPools;
  sortState: SortState | undefined;
  /** Host-Wrapper um `toggleTableSort("playersTable", columnKey)`. */
  onToggleSort: (columnKey: string) => void;
  playerScope: PlayerTableScope;
  onChangeScope: (scope: PlayerTableScope) => void;
  teams: Team[];
  playerTeamFilter: string;
  onChangeTeamFilter: (teamId: string) => void;
  playerClassFilter: string;
  playerClassOptions: string[];
  onChangeClassFilter: (className: string) => void;
  playerBracketCounts: Record<number, number>;
  openPlayerDrawerById: (playerId: string, rosterId?: string | null) => void;
  openTeamProfileById: (teamId: string) => void;
};

const NL_PLAYERS_SCOPE_ITEMS: Array<{ id: PlayerTableScope; label: string }> = [
  { id: "active", label: "Aktive Spieler" },
  { id: "free_agents", label: "Free Agents" },
  { id: "all", label: "Alle Spieler" },
];

/** Verzeichnis (bestehende Tabelle) vs. Analyse-Hub (#47, additiv). */
type NlPlayersView = "directory" | "hub";

const NL_PLAYERS_VIEW_ITEMS: Array<{ id: NlPlayersView; label: string }> = [
  { id: "directory", label: "Verzeichnis" },
  { id: "hub", label: "Analyse-Hub" },
];

/**
 * Kennzahlenkatalog des Hub-Leaderboards (#47). `pool` verweist auf den
 * passenden `LeaguePlayerHeatPools`-Schlüssel für den echten ligaweiten Rang
 * (nicht nur Rang innerhalb der aktuellen Auswahl) — MW hat keinen Heat-Pool,
 * dort bleibt der Perzentil-Chip leer statt erfunden.
 */
// NOTE: no "potential" metric here on purpose — a league-wide (all-teams) PO leaderboard
// would leak other teams' hidden potential (fog of war). PO is only ever surfaced as a
// fuzzy star RANGE for non-owned players (see NlAbilityStars), never as a rankable number.
type NlPhubMetricKey = "ovr" | "pps" | "mvs" | "mw" | "pow" | "spe" | "men" | "soc";

const NL_PHUB_METRICS: ReadonlyArray<{
  key: NlPhubMetricKey;
  label: string;
  tone: NlTone;
  digits: number;
  pool?: Exclude<keyof LeaguePlayerHeatPools, "disciplines">;
}> = [
  { key: "ovr", label: "OVR", tone: "accent", digits: 1, pool: "ovr" },
  { key: "pps", label: "PPs", tone: "spe", digits: 1, pool: "pps" },
  { key: "mvs", label: "MVS", tone: "soc", digits: 1, pool: "mvs" },
  { key: "mw", label: "Marktwert", tone: "neutral", digits: 2 },
  { key: "pow", label: "POW", tone: "pow", digits: 0, pool: "pow" },
  { key: "spe", label: "SPE", tone: "spe", digits: 0, pool: "spe" },
  { key: "men", label: "MEN", tone: "men", digits: 0, pool: "men" },
  { key: "soc", label: "SOC", tone: "soc", digits: 0, pool: "soc" },
];

/** Rohwert einer Hub-Kennzahl für eine Zeile — `null`, wenn nicht bekannt (keine Erfindung). */
function getPhubMetricValue(row: FoundationPlayerScopeRow, metric: NlPhubMetricKey): number | null {
  switch (metric) {
    case "ovr":
      return row.playerOvr;
    case "pps":
      return row.playerPps;
    case "mvs":
      return row.playerMvs;
    case "mw":
      return getPlayerDisplayMarketValue(row.player);
    case "pow":
    case "spe":
    case "men":
    case "soc":
      return row.player.coreStats[metric] ?? null;
    default:
      return null;
  }
}

function formatPhubMetricValue(value: number | null, metric: { key: NlPhubMetricKey; digits: number }): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  if (metric.key === "mw") {
    // Marktwert über den geteilten Geld-Formatter (Einheit " Mio"), damit die
    // Hub-Kacheln/Rangliste dieselbe Konvention wie der Rest der App tragen.
    return formatNlMoney(value);
  }
  return formatNlNumber(value, metric.digits);
}

/** Gleiche MW-Brackets wie die alte Bracket-Leiste (Transfermarkt-Logik). */
const NL_PLAYERS_BRACKETS: ReadonlyArray<{ bracket: number; range: string }> = [
  { bracket: 1, range: "<12.5M" },
  { bracket: 2, range: "12.5–17.5M" },
  { bracket: 3, range: "17.5–22.5M" },
  { bracket: 4, range: "22.5–30M" },
  { bracket: 5, range: "30–37.5M" },
  { bracket: 6, range: "37.5–45M" },
  { bracket: 7, range: "45–55M" },
  { bracket: 8, range: "55–70M" },
  { bracket: 9, range: "70M+" },
];

const NL_PLAYERS_AXES: ReadonlyArray<{ key: NlAxisKey; label: string }> = [
  { key: "pow", label: "POW" },
  { key: "spe", label: "SPE" },
  { key: "men", label: "MEN" },
  { key: "soc", label: "SOC" },
];

/** Spaltenkatalog — `sortKey` entspricht exakt den alten `dataKey`s. */
const NL_PLAYERS_COLUMNS: ReadonlyArray<{
  id: string;
  label: string;
  sortKey?: string;
  align?: "left" | "right" | "center";
  tooltip?: string;
  /**
   * Primäre/sekundäre Spalten-Betonung (Akzent-Rahmen auf Kopf + Zellen).
   * PPs ist laut Produkt die wichtigste Kennzahl (wichtiger als OVR/MVS)
   * und bekommt die stärkste Betonung; OVR bleibt sekundär hervorgehoben.
   */
  highlight?: "primary" | "secondary";
}> = [
  { id: "image", label: "Bild", align: "left" },
  { id: "name", label: "Name", sortKey: "name", align: "left" },
  { id: "team", label: "Team", sortKey: "team", align: "left" },
  { id: "class", label: "Klasse", sortKey: "class", align: "center" },
  { id: "race", label: "Rasse", sortKey: "race", align: "center" },
  {
    id: "abilityStars",
    label: "CA/PO",
    align: "left",
    tooltip: "Fähigkeit (CA) und Potenzial (PO) als Sterne — Bereich, solange nicht vollständig bekannt.",
  },
  {
    id: "axes",
    label: "Achsen",
    align: "left",
    tooltip:
      "POW/SPE/MEN/SOC — liga-relative Achsenwerte (0–100). Farben sind liga-relativ: jede Stufe ist ein Achtel des aktuellen Liga-Pools.",
  },
  {
    id: "pps",
    label: "PPs",
    sortKey: "pps",
    align: "right",
    tooltip:
      "Performance-Punkte der Saison — wichtigste Leistungskennzahl (Zeile aufklappbar für die Aufschlüsselung). Farben sind liga-relativ (Achtel des Liga-Pools).",
    highlight: "primary",
  },
  {
    id: "ovr",
    label: "OVR",
    sortKey: "ovr",
    align: "right",
    tooltip: "Gesamtstärke (Overall) — Farben sind liga-relativ (Achtel des Liga-Pools).",
    highlight: "secondary",
  },
  {
    id: "mvs",
    label: "MVS",
    sortKey: "mvs",
    align: "right",
    tooltip: "Marktwert-Score — Farben sind liga-relativ (Achtel des Liga-Pools).",
  },
  { id: "mw", label: "MW", sortKey: "mw", align: "right", tooltip: "Marktwert" },
  { id: "salary", label: "Gehalt", sortKey: "salary", align: "right" },
  { id: "contract", label: "Vertrag", sortKey: "contract", align: "right" },
  { id: "appearances", label: "Einsätze", sortKey: "appearances", align: "right" },
  {
    id: "bestDiscipline",
    label: "Beste Diszi",
    sortKey: "bestDiscipline",
    align: "left",
    tooltip: "Beste Disziplin",
  },
  {
    id: "careerLeague",
    label: "Alltime",
    sortKey: "careerLeague",
    align: "right",
    tooltip: "Karriere-Bilanz (Saisons · Einsätze · PPs) — gesamte Liga-Einsätze und PPs über alle Saisons (Archiv + Live).",
  },
  { id: "traits", label: "Traits", sortKey: "traits", align: "left" },
];

const NL_PLAYERS_PAGE_SIZE = 100;

/**
 * Fog of war: für Spieler, die NICHT zum vom Menschen geführten Team gehören,
 * ist das Potenzial (PO) verdeckt. Ein konkreter PO-Wert würde in `NlAbilityStars`
 * als volle Sterne rendern (z. B. ★★★★★) und so fremdes Potenzial leaken. Statt
 * dessen wird ein unscharfer PO-BEREICH (Score-Space 35..99) übergeben, damit die
 * Hohl-Kontur-Behandlung (`known={false}`) den Bereich als "geschätzt" zeichnet.
 * Bandbreite konsistent mit der ungescouteten Scouting-Unsicherheit (±16, vgl.
 * `getScoutingUncertainty(0)` in `lib/progression/player-potential-service.ts`),
 * auf 35..99 geklammert. Es wird KEINE PO-Zahl gerendert — nur die Sternmathematik
 * nutzt den Bereich (die `PO ≥ CA`-Klammerung passiert in `NlAbilityStars`).
 */
const NL_FOG_PO_BAND = 16;
function getFoggedPoScoreRange(potential: number | null | undefined): { min: number; max: number } | null {
  if (potential == null || !Number.isFinite(potential) || potential <= 0) {
    return null;
  }
  const hidden = Math.round(Math.min(99, Math.max(1, potential)));
  return {
    min: Math.round(Math.min(99, Math.max(35, hidden - NL_FOG_PO_BAND))),
    max: Math.round(Math.min(99, Math.max(35, hidden + NL_FOG_PO_BAND))),
  };
}

/** Ligaweiter Rang eines Werts innerhalb eines Heat-Pools (1 = bester). */
function getLeagueRank(value: number | null | undefined, pool: number[]): number | null {
  if (value == null || !Number.isFinite(value) || pool.length === 0) {
    return null;
  }
  let higher = 0;
  for (const entry of pool) {
    if (entry > value) {
      higher += 1;
    }
  }
  return higher + 1;
}

function formatLeagueRankSub(rank: number | null): string | undefined {
  return rank != null ? `#${formatNlNumber(rank, 0)} Liga` : undefined;
}

/** Kompaktes "Top 8%" → "T8%" für enge Zellen (Achsen-Zeilen). Leitet nichts neu her — reine Textkürzung des `formatLeaguePercentile`-Labels. */
function formatCompactPercentile(label: string | null): string | null {
  return label ? label.replace(/^Top\s+/, "T") : null;
}

/** Liga-Perzentil-Chip (StatChip-Vokabular in Miniatur) — `null`, wenn kein valider Rang/Pool vorliegt (keine Erfindung). */
function renderMetricPercentileChip(value: number | null | undefined, pool: number[], compact = false) {
  const rank = getLeagueRank(value, pool);
  const label = formatLeaguePercentile(rank, pool.length);
  if (!label) {
    return null;
  }
  const tone = getPoolHeatTone(value, pool);
  const fullTitle = `Liga-Perzentil: ${label} (Rang #${rank} von ${pool.length})`;
  return (
    <span className={`nl-ptable-percentile ${nlToneClass(tone)}`} title={fullTitle}>
      {compact ? formatCompactPercentile(label) : label}
    </span>
  );
}

/**
 * Absoluter Liga-Rang-Chip ("#N") — ersetzt den Perzentil-Chip in der
 * OVR-Spalte (Produkt-Feedback: absoluter Rang ist griffiger als "Top X%").
 * `null`, wenn kein valider Rang/Pool vorliegt (keine Erfindung).
 *
 * Ton ist bewusst FEST (`.nl-ptable-ovr-rank`, Amber/Gold), NICHT mehr die
 * wertabhängige `getPoolHeatTone`-Ton-Klasse: OVR ist die Kopf-Kennzahl der
 * Tabelle und bekommt EINEN eigenen, von PPs/MVS abgesetzten Akzent statt
 * einer dritten überlagerten Farb-Ebene (Value-Heat-Zellenhintergrund +
 * Sortier-Highlight + ton-gefärbter Chip sahen zusammen wie zufälliger
 * Regenbogen aus). Siehe die OVR-`<td>`-Zelle unten und die Scratch-CSS
 * `.nl-ptable-ovr-cell` / `.nl-ptable-ovr-rank`.
 */
function renderMetricRankChip(value: number | null | undefined, pool: number[]) {
  const rank = getLeagueRank(value, pool);
  if (rank == null) {
    return null;
  }
  return (
    <span className="nl-ptable-percentile nl-ptable-ovr-rank" title={`Liga-Rang #${rank} von ${pool.length}`}>
      #{formatNlNumber(rank, 0)}
    </span>
  );
}

export default function FoundationPlayersTableNewLook({
  rows,
  gameState,
  leaguePlayerHeatPools,
  sortState,
  onToggleSort,
  playerScope,
  onChangeScope,
  teams,
  playerTeamFilter,
  onChangeTeamFilter,
  playerClassFilter,
  playerClassOptions,
  onChangeClassFilter,
  playerBracketCounts,
  openPlayerDrawerById,
  openTeamProfileById,
}: FoundationPlayersTableNewLookProps) {
  const [visibleCount, setVisibleCount] = useState(NL_PLAYERS_PAGE_SIZE);
  /** Welche Zeile ist gerade per PPs-Klick aufgeklappt (max. eine gleichzeitig). */
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  /** Verzeichnis (bestehende Tabelle) vs. ligaweiter Analyse-Hub (#47). */
  const [playersView, setPlayersView] = useState<NlPlayersView>("directory");

  // Bei Filterwechsel wieder auf die erste "Seite" zurück.
  useEffect(() => {
    setVisibleCount(NL_PLAYERS_PAGE_SIZE);
    setExpandedPlayerId(null);
  }, [playerScope, playerTeamFilter, playerClassFilter]);

  /**
   * Kader-/Liga-Summary aus den aktuell gefilterten Zeilen: Durchschnitte
   * und die Leader je Kennzahl. Alles reale Werte aus den Rows selbst.
   */
  const summary = useMemo(() => {
    let ovrSum = 0;
    let ovrCount = 0;
    let mwSum = 0;
    let salarySum = 0;
    let topOvr: FoundationPlayerScopeRow | null = null;
    let topPps: FoundationPlayerScopeRow | null = null;
    let topMvs: FoundationPlayerScopeRow | null = null;
    let topMw: FoundationPlayerScopeRow | null = null;
    let topMwValue = Number.NEGATIVE_INFINITY;

    for (const row of rows) {
      if (row.playerOvr != null && Number.isFinite(row.playerOvr)) {
        ovrSum += row.playerOvr;
        ovrCount += 1;
        if (topOvr == null || (topOvr.playerOvr ?? Number.NEGATIVE_INFINITY) < row.playerOvr) {
          topOvr = row;
        }
      }
      if (row.playerPps != null && Number.isFinite(row.playerPps)) {
        if (topPps == null || (topPps.playerPps ?? Number.NEGATIVE_INFINITY) < row.playerPps) {
          topPps = row;
        }
      }
      if (row.playerMvs != null && Number.isFinite(row.playerMvs)) {
        if (topMvs == null || (topMvs.playerMvs ?? Number.NEGATIVE_INFINITY) < row.playerMvs) {
          topMvs = row;
        }
      }
      const marketValue = getPlayerDisplayMarketValue(row.player);
      if (marketValue != null && Number.isFinite(marketValue)) {
        mwSum += marketValue;
        if (marketValue > topMwValue) {
          topMwValue = marketValue;
          topMw = row;
        }
      }
      const salary = row.roster
        ? getRosterEntryDisplaySalary(row.roster, row.player)
        : getPlayerDisplaySalary(row.player);
      if (salary != null && Number.isFinite(salary)) {
        salarySum += salary;
      }
    }

    return {
      count: rows.length,
      avgOvr: ovrCount > 0 ? ovrSum / ovrCount : null,
      avgMw: rows.length > 0 ? mwSum / rows.length : null,
      totalSalary: rows.length > 0 ? salarySum : null,
      topOvr,
      topPps,
      topMvs,
      topMw,
      topMwValue: Number.isFinite(topMwValue) ? topMwValue : null,
    };
  }, [rows]);

  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const hasMoreRows = rows.length > visibleRows.length;

  /**
   * Klasse für die aktuell sortierte Spalte (Header + jede Körperzelle
   * dieser Spalte) — sorgt für einen echten, deterministischen
   * "aktive Sortierspalte"-Zustand (heller Blau-Hintergrund) statt der
   * zufälligen Heat-Band-Färbung einzelner Zellen. Wird mit
   * kontrastsicherem, dunklem Text kombiniert (siehe Scratch-CSS
   * `.is-active-sort`), damit Ton-Chips (grün/gelb/rot) auf dem hellen Blau
   * lesbar bleiben.
   */
  function sortCellClass(sortKey: string | undefined): string {
    return sortKey && sortState?.key === sortKey ? " is-active-sort" : "";
  }

  function ariaSortFor(sortKey: string | undefined): "ascending" | "descending" | "none" | undefined {
    if (!sortKey) {
      return undefined;
    }
    if (sortState?.key !== sortKey) {
      return "none";
    }
    return sortState.direction === "asc" ? "ascending" : "descending";
  }

  function renderSortHeader(sortKey: string, label: string, tooltip?: string) {
    const isActive = sortState?.key === sortKey;
    const arrow = !isActive ? "↕" : sortState?.direction === "asc" ? "↑" : "↓";
    return (
      <button
        type="button"
        className={`nl-players-sort-th${isActive ? " is-active" : ""}`}
        onClick={() => onToggleSort(sortKey)}
        title={tooltip ?? `Nach ${label} sortieren`}
        aria-label={`Nach ${label} sortieren`}
      >
        <span>{label}</span>
        <b aria-hidden="true">{arrow}</b>
      </button>
    );
  }

  /** Leader-Chip: Wert + Spielername, Klick = Portal in den Spieler-Drawer. */
  function renderLeaderChip(
    label: string,
    row: FoundationPlayerScopeRow | null,
    value: number | null,
    pool: number[],
    tone: "accent" | "spe" | "soc" | "neutral",
    digits: number,
    title: string,
    /** Geldwert (Marktwert): über den geteilten Formatter mit Einheit " Mio" statt bloßer Zahl. */
    money = false,
  ) {
    if (row == null || value == null) {
      return <StatChip label={label} value="—" tone={tone} title={title} />;
    }
    const rank = getLeagueRank(value, pool);
    return (
      <StatChip
        label={label}
        value={money ? formatNlMoney(value) : formatNlNumber(value, digits)}
        tone={tone}
        sub={[row.player.name, formatLeagueRankSub(rank)].filter(Boolean).join(" · ")}
        title={`${title} — ${row.player.name} öffnen`}
        onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
      />
    );
  }

  /**
   * Achsen-Zellinhalt: eine Zeile je Achse (POW/SPE/MEN/SOC) statt eines
   * engen 2×2-Clusters — Label, Balken und Wert stehen so nie horizontal
   * nebeneinander benachbarter Achsen und laufen nicht zusammen
   * ("91SPE" statt "91 · SPE"). Jede Achse ist einzeln lesbar.
   *
   * Bewusst NUR Balken + Wert (kein inline "#Rang" mehr) — PPS/OVR/MVS
   * tragen bereits eigene Top-%/Rang-Chips, ein zusätzlicher #Rang je
   * Achse war reine Excel-Redundanz ("ein GAME, keine Excel-Tabelle").
   * Der ligaweite Rang bleibt trotzdem einen Hover entfernt: er steckt im
   * `title`-Tooltip der Achse statt fest sichtbar in der Zelle zu stehen.
   */
  function renderAxisBars(row: FoundationPlayerScopeRow) {
    return (
      <div className="nl-players-axes" role="group" aria-label={`Achsenwerte ${row.player.name}`}>
        {NL_PLAYERS_AXES.map(({ key, label }) => {
          const value = row.player.coreStats[key] ?? null;
          const percent =
            value != null && Number.isFinite(value) ? Math.max(2, Math.min(100, value)) : 0;
          const pool = leaguePlayerHeatPools[key];
          const rank = getLeagueRank(value, pool);
          return (
            <span
              key={key}
              className={`nl-players-axis nl-ptable-axis-enhanced ${nlToneClass(key)}`}
              title={`${label}: ${formatNlNumber(value, 0)} von 100${
                rank != null ? ` — Liga-Rang #${rank} von ${pool.length}` : ""
              }`}
            >
              <span className="nl-players-axis-label">{label}</span>
              <span className="nl-players-axis-track" aria-hidden="true">
                <span className="nl-players-axis-fill" style={{ width: `${percent}%` }} />
              </span>
              <span className="nl-players-axis-value nl-tnum">{formatNlNumber(value, 0)}</span>
            </span>
          );
        })}
      </div>
    );
  }

  /**
   * CA/PO-Sterne-Zelle — identische Props wie die bestehende
   * `FoundationPlayerPortraitPreview`-Einbindung weiter unten in dieser Datei
   * (`caScore={row.playerOvr}`, `poScore={row.player.potential}`), nur jetzt
   * als eigene, immer sichtbare Spalte statt nur im Hover-Preview. Gleiche
   * Quelle wie die Teams-Rosterkarten/Home-Portraitkarte (`NlAbilityStars`,
   * siehe `components/foundation/velo-ui/NlAbilityStars.tsx`).
   */
  function renderAbilityStars(row: FoundationPlayerScopeRow) {
    // Nur eigene (vom Menschen geführte) Spieler haben ein bekanntes PO — deren
    // exakter Wert bleibt erhalten (`known`, solide Sterne). Für fremde Spieler
    // ist PO verdeckt: unscharfer Bereich statt Einzelwert, damit kein volles
    // ★★★★★ das verdeckte Potenzial leakt (siehe getFoggedPoScoreRange).
    const owned = row.team?.humanControlled ?? false;
    const potential = row.player.potential ?? null;
    return (
      <NlAbilityStars
        caScore={row.playerOvr}
        known={owned}
        {...(owned ? { poScore: potential } : { poScoreRange: getFoggedPoScoreRange(potential) })}
        compact
        stacked
        label={`${row.player.name} Fähigkeiten`}
      />
    );
  }

  /**
   * Aufgeklappte PPs-Detailzeile. Echte Pro-Areal-PPs-Punkte (wie viele
   * Performance-Punkte je Bereich POW/SPE/MEN/SOC erzielt wurden) liegen in
   * `FoundationPlayerScopeRow` nicht vor — nur der Gesamtwert `playerPps`.
   * Sie existieren an anderer Stelle im Code (z. B. `ppPow`/`ppSpe`/`ppMen`/
   * `ppSoc` in `lib/foundation/player-rating-contract.ts`), aber nur als
   * Ergebnis einer ligaweiten Neuberechnung, die hier nicht verfügbar ist.
   * Statt das zu erfinden, zeigen wir ehrlich die vorhandenen Kernwerte
   * (POW/SPE/MEN/SOC, 0–100) als Aufschlüsselungs-Näherung mit klarer
   * Kennzeichnung, dass es keine echten Areal-PPs-Punkte sind.
   */
  function renderPpsDetail(row: FoundationPlayerScopeRow) {
    return (
      <div className="nl-players-pps-detail" role="group" aria-label={`PPs-Aufschlüsselung ${row.player.name}`}>
        <div className="nl-players-pps-detail-head">
          <strong className="nl-players-pps-detail-name">{row.player.name}</strong>
          <span className="nl-players-pps-detail-total">
            Gesamt-PPs (Saison):{" "}
            <span className="nl-tnum">{row.playerPps != null ? formatPpsValue(row.playerPps) : "—"}</span>
          </span>
        </div>
        <div className="nl-players-pps-detail-grid">
          {NL_PLAYERS_AXES.map(({ key, label }) => {
            const value = row.player.coreStats[key] ?? null;
            const percent =
              value != null && Number.isFinite(value) ? Math.max(2, Math.min(100, value)) : 0;
            return (
              <div key={key} className={`nl-players-pps-detail-axis ${nlToneClass(key)}`}>
                <span className="nl-players-pps-detail-axis-label">{label}</span>
                <span className="nl-players-pps-detail-axis-track" aria-hidden="true">
                  <span className="nl-players-pps-detail-axis-fill" style={{ width: `${percent}%` }} />
                </span>
                <span className="nl-players-pps-detail-axis-value nl-tnum">{formatNlNumber(value, 0)}</span>
              </div>
            );
          })}
        </div>
        <p className="nl-players-pps-detail-note">
          Zeigt die Kernwerte POW/SPE/MEN/SOC (0–100) als Näherung. Echte Pro-Areal-PPs-Punkte (Performance-Punkte je
          Bereich) sind für Spieler in dieser Ansicht nicht gespeichert — nur der Gesamtwert oben.
        </p>
      </div>
    );
  }

  function renderRow(row: FoundationPlayerScopeRow) {
    const portrait = getPlayerPortraitModel(row.player);
    const teamLogo = row.team ? getTeamLogoModel(row.team, { variant: "thumb" }) : null;
    const marketValue = getPlayerDisplayMarketValue(row.player);
    const marketValueDelta = getPlayerDisplayMarketValueDelta(row.player, row.roster, gameState);
    const annualSalary = row.roster
      ? getRosterEntryDisplaySalary(row.roster, row.player)
      : getPlayerDisplaySalary(row.player);
    const currentSeasonSalary = row.roster
      ? getRosterEntryCurrentSeasonSalary(row.roster, row.player)
      : annualSalary;
    const salaryDelta = getRosterEntrySalaryDelta(row.roster, row.player, gameState);
    const showSeasonSalarySubline = rosterSalariesDifferForDisplay(currentSeasonSalary, annualSalary);
    const contractShapeShort = row.roster ? formatContractShapeShortLabel(row.roster.contractShape) : null;
    const careerStats = row.careerLeagueStats;
    const traits = [...row.player.traitsPositive, ...row.player.traitsNegative.map((trait) => `-${trait}`)];
    const traitsText = traits.length > 0 ? traits.join(", ") : "—";
    const isPpsExpanded = expandedPlayerId === row.player.id;
    const ppsDetailId = `nl-players-pps-detail-${row.player.id}`;
    // Fog of war: nur eigene Spieler haben ein bekanntes PO (siehe renderAbilityStars).
    const playerOwned = row.team?.humanControlled ?? false;

    const rowElement = (
      <tr
        key={row.player.id}
        className="nl-players-row"
        onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
      >
        <td className="nl-players-td-image">
          <FoundationPlayerPortraitPreview
            playerId={row.player.id}
            name={row.player.name}
            portraitUrl={portrait.previewSrc ?? portrait.src}
            portraitInitials={portrait.initials}
            playerOvr={row.playerOvr}
            playerMvs={row.playerMvs}
            playerPps={row.playerPps}
            pow={row.player.coreStats.pow ?? null}
            spe={row.player.coreStats.spe ?? null}
            men={row.player.coreStats.men ?? null}
            soc={row.player.coreStats.soc ?? null}
            leagueHeatPools={leaguePlayerHeatPools}
            variant="team"
            context="teamGrid"
            playerClassName={row.player.className}
            subMeta={row.team?.name ?? "Free Agent"}
            previewDensity="full"
            newLook
            known={playerOwned}
            caScore={row.playerOvr}
            {...(playerOwned
              ? { poScore: row.player.potential ?? null }
              : { poScoreRange: getFoggedPoScoreRange(row.player.potential ?? null) })}
          >
            {portrait.src ? (
              <BudgetedMediaImage
                className="nl-players-portrait"
                src={portrait.src}
                alt={row.player.name}
                width={44}
                height={44}
                loading="lazy"
                fetchPriority="low"
                fallback={
                  <span className="nl-players-portrait nl-players-portrait-fallback" aria-hidden="true">
                    {portrait.initials}
                  </span>
                }
              />
            ) : (
              <span className="nl-players-portrait nl-players-portrait-fallback" aria-hidden="true">
                {portrait.initials}
              </span>
            )}
          </FoundationPlayerPortraitPreview>
        </td>
        <td className={`nl-players-td-name${sortCellClass("name")}`}>
          <button
            type="button"
            className="nl-players-name-button"
            onClick={(event) => {
              event.stopPropagation();
              openPlayerDrawerById(row.player.id, row.roster?.id);
            }}
            title={`${row.player.name} öffnen`}
          >
            <span className="nl-players-name">{row.player.name}</span>
            {/* Nur Ausnahmen bekommen eine Status-Caption (z. B. "Free Agent") —
                bei aktivem "Aktive Spieler"-Scope wäre "ACTIVE PLAYER" auf JEDER
                Zeile reine Redundanz (Excel-Beschreibung statt Spiel-UI). */}
            {row.transferStatus !== "Active Player" ? (
              <span className="nl-players-status">{row.transferStatus}</span>
            ) : null}
          </button>
        </td>
        <td className={`nl-players-td-team${sortCellClass("team")}`}>
          <button
            type="button"
            className="nl-players-team-button"
            onClick={(event) => {
              event.stopPropagation();
              if (row.team) {
                openTeamProfileById(row.team.teamId);
              }
            }}
            disabled={!row.team}
            title={row.team ? `${row.team.name} öffnen` : "Free Agent — kein Team"}
          >
            {teamLogo?.src ? (
              <BudgetedMediaImage
                className="nl-players-team-logo"
                src={teamLogo.src}
                alt={`${row.team?.name ?? "Team"} Logo`}
                width={24}
                height={24}
                loading="lazy"
                fetchPriority="low"
                fallback={
                  <span className="nl-players-team-logo nl-players-team-logo-fallback" aria-hidden="true">
                    {teamLogo.initials}
                  </span>
                }
              />
            ) : (
              <span className="nl-players-team-logo nl-players-team-logo-fallback" aria-hidden="true">
                {teamLogo?.initials ?? "FA"}
              </span>
            )}
            <span className="nl-players-team-name">{row.team?.name ?? "Free Agent"}</span>
          </button>
        </td>
        <td className={`nl-players-td-icon${sortCellClass("class")}`}>
          <ClassIcon
            classNameValue={row.player.className}
            className="table-identity-icon-chip"
            iconClassName="table-identity-icon-image"
          />
        </td>
        <td className={`nl-players-td-icon${sortCellClass("race")}`}>
          <RaceIcon race={row.player.race} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
        </td>
        <td className="nl-ptable-td-ability nl-ptable-td-ability-stacked">{renderAbilityStars(row)}</td>
        <td className="nl-players-td-axes">{renderAxisBars(row)}</td>
        <td
          className={`nl-players-td-metric nl-players-td-pps is-highlight-primary${sortCellClass("pps")} ${
            row.playerPps != null ? getPoolHeatClass(row.playerPps, leaguePlayerHeatPools.pps) : ""
          }`}
        >
          <span className="nl-ptable-metric-cell">
            <button
              type="button"
              className={`nl-players-pps-toggle${isPpsExpanded ? " is-expanded" : ""}`}
              aria-expanded={isPpsExpanded}
              aria-controls={ppsDetailId}
              title={`PPs-Aufschlüsselung für ${row.player.name} ${isPpsExpanded ? "schließen" : "öffnen"}`}
              onClick={(event) => {
                event.stopPropagation();
                setExpandedPlayerId((current) => (current === row.player.id ? null : row.player.id));
              }}
            >
              <span className="nl-players-pps-toggle-value nl-tnum">
                {row.playerPps != null ? formatPpsValue(row.playerPps) : "—"}
              </span>
              <b className="nl-players-pps-toggle-caret" aria-hidden="true">
                {isPpsExpanded ? "▾" : "▸"}
              </b>
            </button>
            {renderMetricPercentileChip(row.playerPps, leaguePlayerHeatPools.pps)}
          </span>
        </td>
        <td className={`nl-players-td-metric nl-ptable-ovr-cell${sortCellClass("ovr")}`}>
          <span className="nl-ptable-metric-cell">
            <span className="nl-tnum">{formatWholeNumber(row.playerOvr)}</span>
            {renderMetricRankChip(row.playerOvr, leaguePlayerHeatPools.ovr)}
          </span>
        </td>
        <td
          className={`nl-players-td-metric${sortCellClass("mvs")} ${
            row.playerMvs != null ? getPoolHeatClass(row.playerMvs, leaguePlayerHeatPools.mvs) : ""
          }`}
        >
          <span className="nl-ptable-metric-cell">
            <span className="nl-tnum">{row.playerMvs != null ? formatPpsValue(row.playerMvs) : "—"}</span>
            {renderMetricPercentileChip(row.playerMvs, leaguePlayerHeatPools.mvs)}
          </span>
        </td>
        <td className={`nl-players-td-money${sortCellClass("mw")}`}>
          <span className="nl-players-money">
            <span className="nl-tnum">{formatLocalePoints(marketValue, 2)}</span>
            {marketValueDelta != null && marketValueDelta !== 0 ? (
              <NlDeltaChip
                value={marketValueDelta}
                format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 2)}`}
                title="Marktwert-Entwicklung gegenüber der Baseline"
              />
            ) : null}
          </span>
        </td>
        <td className={`nl-players-td-money${sortCellClass("salary")}`}>
          <span className="nl-players-money">
            <span className="nl-tnum">{formatLocalePoints(annualSalary, 2)}</span>
            {salaryDelta != null && salaryDelta !== 0 ? (
              <NlDeltaChip
                value={salaryDelta}
                invert
                format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 2)}`}
                title="Gehalts-Entwicklung gegenüber der Baseline (weniger = besser)"
              />
            ) : null}
            {showSeasonSalarySubline ? (
              <small className="nl-players-salary-season" title="Gehalt diese Saison (Vertragsjahr 1)">
                Saison: {formatLocalePoints(currentSeasonSalary, 2)}
              </small>
            ) : null}
          </span>
        </td>
        <td className={`nl-players-td-contract${sortCellClass("contract")}`}>
          {row.roster ? (
            <span className="nl-players-contract">
              {contractShapeShort ? (
                <span className="nl-players-contract-shape" title={formatContractShapeLabel(row.roster.contractShape)}>
                  {contractShapeShort}
                </span>
              ) : null}
              <span className="nl-tnum">{row.roster.contractLength}J</span>
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className={`nl-players-td-metric${sortCellClass("appearances")}`}>
          {row.seasonPerformance ? row.seasonPerformance.appearances : "—"}
        </td>
        <td className={`nl-players-td-disc${sortCellClass("bestDiscipline")}`}>
          <DisciplineIcon label={row.bestDiscipline ?? "—"} showLabel={Boolean(row.bestDiscipline)} />
        </td>
        <td
          className={`nl-players-td-career${sortCellClass("careerLeague")}`}
          title={
            careerStats
              ? `Alltime Liga: ${careerStats.seasonsPlayed} Saison(en) · ${careerStats.appearances} Einsätze · ${formatLocalePoints(careerStats.totalPps, 1)} PPs`
              : undefined
          }
        >
          {careerStats ? (
            <span className="nl-players-career">
              <span className="nl-tnum">
                {careerStats.appearances} / {formatLocalePoints(careerStats.totalPps, 1)}
              </span>
              <small>{careerStats.seasonsPlayed} Saison(en)</small>
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className={`nl-players-td-traits${sortCellClass("traits")}`} title={traitsText}>
          {traitsText}
        </td>
      </tr>
    );

    if (!isPpsExpanded) {
      return [rowElement];
    }

    return [
      rowElement,
      <tr key={`${row.player.id}-pps-detail`} id={ppsDetailId} className="nl-players-detail-row">
        <td className="nl-players-detail-cell" colSpan={NL_PLAYERS_COLUMNS.length}>
          {renderPpsDetail(row)}
        </td>
      </tr>,
    ];
  }

  return (
    <div className="nl-players" id="players-table" data-testid="nl-players-table" data-new-look="true">
      <NlCard
        className="nl-players-header-card"
        eyebrow={`Liga-Datenbank · ${gameState.season.name}`}
        title="Spieler"
        actions={
          <div className="nl-players-filters">
            <label className="nl-players-filter">
              <span>Team</span>
              <select
                value={playerTeamFilter}
                onChange={(event) => onChangeTeamFilter(event.target.value)}
                disabled={playerScope === "free_agents"}
                aria-label="Nach Team filtern"
              >
                <option value="ALL">Alle</option>
                {teams.map((team) => (
                  <option key={team.teamId} value={team.teamId}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="nl-players-filter">
              <span>Klasse</span>
              <select
                value={playerClassFilter}
                onChange={(event) => onChangeClassFilter(event.target.value)}
                aria-label="Nach Klasse filtern"
              >
                <option value="ALL">Alle</option>
                {playerClassOptions.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        <NlSubTabs
          items={NL_PLAYERS_VIEW_ITEMS}
          activeId={playersView}
          onSelect={(id) => setPlayersView(id as NlPlayersView)}
          aria-label="Spieler-Ansicht"
          className="nl-phub-view-tabs"
        />
        <div className="nl-players-header-row">
          <NlSubTabs
            items={NL_PLAYERS_SCOPE_ITEMS.map((item) => ({ id: item.id, label: item.label }))}
            activeId={playerScope}
            onSelect={(id) => onChangeScope(id as PlayerTableScope)}
            aria-label="Spieler-Umfang"
            className="nl-players-scope-tabs"
          />
          <StatChipRow className="nl-players-summary-chips" aria-label="Auswahl-Kennzahlen">
            <StatChip
              label="Spieler"
              value={formatNlNumber(summary.count, 0)}
              tone="neutral"
              title="Anzahl Spieler in der aktuellen Auswahl"
            />
            <StatChip
              label="Ø OVR"
              value={formatNlNumber(summary.avgOvr, 1)}
              tone="accent"
              title="Durchschnittliches Overall-Rating der Auswahl"
            />
            <StatChip
              label="Ø MW"
              value={formatNlMoney(summary.avgMw)}
              tone="neutral"
              title="Durchschnittlicher Marktwert der Auswahl"
            />
            <StatChip
              label="Gehälter"
              value={formatNlMoney(summary.totalSalary)}
              tone="warn"
              title="Summe der Jahresgehälter der Auswahl"
            />
          </StatChipRow>
        </div>
        {playersView === "directory" ? (
          <>
            <StatChipRow label="Leader" className="nl-players-leader-chips" aria-label="Leader der Auswahl">
              {renderLeaderChip(
                "Top OVR",
                summary.topOvr,
                summary.topOvr?.playerOvr ?? null,
                leaguePlayerHeatPools.ovr,
                "accent",
                1,
                "Bestes Overall-Rating der Auswahl",
              )}
              {renderLeaderChip(
                "Top PPs",
                summary.topPps,
                summary.topPps?.playerPps ?? null,
                leaguePlayerHeatPools.pps,
                "spe",
                1,
                "Meiste Performance-Punkte der Auswahl",
              )}
              {renderLeaderChip(
                "Top MVS",
                summary.topMvs,
                summary.topMvs?.playerMvs ?? null,
                leaguePlayerHeatPools.mvs,
                "soc",
                1,
                "Bester Market Value Score der Auswahl",
              )}
              {renderLeaderChip(
                "Top MW",
                summary.topMw,
                summary.topMwValue,
                [],
                "neutral",
                2,
                "Höchster Marktwert der Auswahl",
                true,
              )}
            </StatChipRow>
            <div className="nl-players-brackets nl-ptable-bracket-strip" role="group" aria-label="Marktwert-Brackets der Auswahl">
              <NlBarChart
                bars={NL_PLAYERS_BRACKETS.map(({ bracket }) => ({
                  label: `B${bracket}`,
                  value: playerBracketCounts[bracket] ?? 0,
                  tone: "accent",
                }))}
                format={(value) => formatNlNumber(value, 0)}
                aria-label="Marktwert-Brackets der Auswahl (Spieleranzahl je Bracket)"
                className="nl-ptable-bracket-barchart"
              />
              <p className="nl-ptable-bracket-legend">
                {NL_PLAYERS_BRACKETS.map(({ bracket, range }) => `B${bracket} ${range}`).join(" · ")}
              </p>
            </div>
          </>
        ) : null}
      </NlCard>

      {playersView === "hub" ? (
        <FoundationPlayersHub
          rows={rows}
          gameState={gameState}
          leaguePlayerHeatPools={leaguePlayerHeatPools}
          openPlayerDrawerById={openPlayerDrawerById}
          openTeamProfileById={openTeamProfileById}
        />
      ) : rows.length === 0 ? (
        <NlCard className="nl-players-empty-card">
          <p className="nl-players-empty-text">
            Keine Spieler in der aktuellen Auswahl — Umfang, Team- oder Klassen-Filter anpassen.
          </p>
        </NlCard>
      ) : (
        <NlCard
          className="nl-players-table-card"
          eyebrow="Sortierbare Daten"
          title="Spielerliste"
          actions={
            <span className="nl-players-shown nl-tnum" aria-live="polite">
              {formatNlNumber(visibleRows.length, 0)} von {formatNlNumber(rows.length, 0)} Spielern
            </span>
          }
        >
          <div className="nl-players-table-shell">
            <table className="nl-players-table nl-tnum">
              <thead>
                <tr>
                  {NL_PLAYERS_COLUMNS.map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      className={`nl-players-th is-${column.align ?? "left"}${
                        column.highlight ? ` is-highlight-${column.highlight}` : ""
                      }${sortCellClass(column.sortKey)}`}
                      aria-sort={ariaSortFor(column.sortKey)}
                    >
                      {column.sortKey ? (
                        renderSortHeader(column.sortKey, column.label, column.tooltip)
                      ) : (
                        <span title={column.tooltip}>{column.label}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{visibleRows.flatMap((row) => renderRow(row))}</tbody>
            </table>
          </div>
          {hasMoreRows ? (
            <div className="nl-players-more">
              <button
                type="button"
                className="nl-players-more-button"
                onClick={() => setVisibleCount((current) => current + NL_PLAYERS_PAGE_SIZE)}
              >
                Mehr anzeigen (+{NL_PLAYERS_PAGE_SIZE})
              </button>
              <button
                type="button"
                className="nl-players-more-button"
                onClick={() => setVisibleCount(rows.length)}
              >
                Alle {formatNlNumber(rows.length, 0)} anzeigen
              </button>
            </div>
          ) : null}
        </NlCard>
      )}
    </div>
  );
}

/**
 * Ligaweiter Analyse-/Ranking-Hub (#47, additiv, "Neuer Look").
 *
 * Zweite Ansicht neben dem bestehenden Spieler-Verzeichnis (Toggle über
 * `NL_PLAYERS_VIEW_ITEMS` oben) — dieselben `rows` wie die Tabelle
 * (respektiert also Umfang-/Team-/Klassen-Filter genau wie die
 * Leader-Chips/Bracket-Leiste im Verzeichnis), nur als Leaderboard- und
 * Analyse-Lens statt Zeilentabelle. Es wird kein zusätzlicher, ungefilterter
 * Liga-Pool angenommen, der dieser Komponente nicht als Prop vorliegt.
 *
 * Kacheln:
 * - Leaderboard: wählbare Kennzahl (OVR/PPs/MVS/MW/POW/SPE/MEN/SOC) — bewusst KEIN
 *   ligaweites Potenzial-Ranking (das würde fremdes, verdecktes PO leaken),
 *   Top 10 der Auswahl mit Medaillen für die ersten drei, eigene Spieler
 *   (`team.humanControlled`) markiert, Perzentil-Chip aus dem echten
 *   ligaweiten Heat-Pool (`leaguePlayerHeatPools`) wo vorhanden. "Volle
 *   Rangliste" öffnet `NlRankingDrawer` mit der kompletten Auswahl-Rangliste.
 * - Bestes Preis-Leistungs-Verhältnis: OVR pro investierter Marktwert-Million
 *   (`getPlayerDisplayMarketValue`), Top 5 Schnäppchen.
 * - Auf-/Absteiger: Marktwert-Delta gegenüber der Baseline
 *   (`getPlayerDisplayMarketValueDelta`, dieselbe Quelle wie die
 *   Delta-Chips in der Tabellenzeile), Top 5 je Richtung.
 * - Größtes Potenzial-Polster: `player.potential − playerOvr`, Top 5 — nur eigene
 *   Spieler (`team.humanControlled`), da fremdes Potenzial verdeckt ist (Fog of War).
 * - Spezialisierungs-Verteilung: Anzahl Spieler je stärkster Disziplin
 *   (`row.bestDiscipline`, dieselbe Quelle wie die "Beste Diszi"-Spalte).
 *
 * Bewusst weggelassen: keine Alters-/Entwicklungskurve — `Player` trägt kein
 * Altersfeld, daher tritt das Potenzial-Polster (CA→PO-Abstand) an dessen
 * Stelle als echte, im Datenmodell vorhandene Entwicklungs-Kennzahl.
 */
function FoundationPlayersHub({
  rows,
  gameState,
  leaguePlayerHeatPools,
  openPlayerDrawerById,
  openTeamProfileById,
}: {
  rows: FoundationPlayerScopeRow[];
  gameState: GameState;
  leaguePlayerHeatPools: LeaguePlayerHeatPools;
  openPlayerDrawerById: (playerId: string, rosterId?: string | null) => void;
  openTeamProfileById: (teamId: string) => void;
}) {
  const [metric, setMetric] = useState<NlPhubMetricKey>("ovr");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerHighlightId, setDrawerHighlightId] = useState<string | null>(null);

  const activeMetric = NL_PHUB_METRICS.find((entry) => entry.key === metric) ?? NL_PHUB_METRICS[0];
  const activePool = activeMetric.pool ? leaguePlayerHeatPools[activeMetric.pool] : [];

  const rankedRows = useMemo(() => {
    const withValue = rows
      .map((row) => ({ row, value: getPhubMetricValue(row, metric) }))
      .filter((entry): entry is { row: FoundationPlayerScopeRow; value: number } => entry.value != null);
    withValue.sort((left, right) => right.value - left.value);
    return withValue.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [rows, metric]);

  const topBoardRows = rankedRows.slice(0, 10);

  const ownBoardEntry = useMemo(
    () => rankedRows.find((entry) => entry.row.team?.humanControlled) ?? null,
    [rankedRows],
  );

  const drawerRows: NlRankingDrawerRow[] = useMemo(
    () =>
      rankedRows.map(({ row, value, rank }) => ({
        id: row.player.id,
        rank,
        name: row.player.name,
        sub: row.team?.name ?? "Free Agent",
        value,
        displayValue: formatPhubMetricValue(value, activeMetric),
        tone: activeMetric.tone,
        isOwn: row.team?.humanControlled ?? false,
      })),
    [rankedRows, activeMetric],
  );

  function openDrawer(highlightId?: string | null) {
    setDrawerOpen(true);
    setDrawerHighlightId(highlightId ?? null);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerHighlightId(null);
  }

  /** Bestes Preis-Leistungs-Verhältnis: OVR je investierter Marktwert-Million. */
  const valueRows = useMemo(() => {
    return rows
      .map((row) => {
        const mw = getPlayerDisplayMarketValue(row.player);
        const ovr = row.playerOvr;
        if (mw == null || !Number.isFinite(mw) || mw <= 0 || ovr == null || !Number.isFinite(ovr)) {
          return null;
        }
        return { row, mw, ovr, ratio: ovr / mw };
      })
      .filter(
        (entry): entry is { row: FoundationPlayerScopeRow; mw: number; ovr: number; ratio: number } =>
          entry != null,
      )
      .sort((left, right) => right.ratio - left.ratio);
  }, [rows]);
  const topValueRows = valueRows.slice(0, 5);
  const medianRatio = valueRows.length > 0 ? valueRows[Math.floor(valueRows.length / 2)]!.ratio : null;

  /** Marktwert-Bewegung gegenüber der Baseline — dieselbe Quelle wie die Delta-Chips in der Tabelle. */
  const movers = useMemo(() => {
    return rows
      .map((row) => {
        const delta = getPlayerDisplayMarketValueDelta(row.player, row.roster, gameState);
        if (delta == null || delta === 0 || !Number.isFinite(delta)) {
          return null;
        }
        return { row, delta };
      })
      .filter((entry): entry is { row: FoundationPlayerScopeRow; delta: number } => entry != null);
  }, [rows, gameState]);
  const risers = useMemo(
    () => movers.filter((entry) => entry.delta > 0).sort((left, right) => right.delta - left.delta).slice(0, 5),
    [movers],
  );
  const fallers = useMemo(
    () => movers.filter((entry) => entry.delta < 0).sort((left, right) => left.delta - right.delta).slice(0, 5),
    [movers],
  );

  /**
   * Größtes Potenzial-Polster: PO minus aktuelles OVR — NUR für eigene Spieler
   * (`team.humanControlled`). Fremdes Potenzial ist verdeckt (Fog of War) und darf
   * nie als konkreter Wert erscheinen, daher werden hier ausschließlich Spieler des
   * eigenen, kontrollierten Teams gerankt, deren PO bekannt ist.
   */
  const headroomRows = useMemo(() => {
    return rows
      .map((row) => {
        if (!row.team?.humanControlled) {
          return null;
        }
        const potential = row.player.potential;
        const ovr = row.playerOvr;
        if (potential == null || !Number.isFinite(potential) || ovr == null || !Number.isFinite(ovr)) {
          return null;
        }
        const headroom = potential - ovr;
        if (headroom <= 0) {
          return null;
        }
        return { row, potential, ovr, headroom };
      })
      .filter(
        (entry): entry is { row: FoundationPlayerScopeRow; potential: number; ovr: number; headroom: number } =>
          entry != null,
      )
      .sort((left, right) => right.headroom - left.headroom)
      .slice(0, 5);
  }, [rows]);

  /** Spezialisierungs-Verteilung nach stärkster Disziplin ("Beste Diszi"). */
  const disciplineCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.bestDiscipline) {
        continue;
      }
      counts.set(row.bestDiscipline, (counts.get(row.bestDiscipline) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [rows]);
  const scarcestDiscipline = disciplineCounts.length > 0 ? disciplineCounts[disciplineCounts.length - 1]! : null;

  return (
    <div className="nl-phub" data-testid="nl-players-hub">
      <NlCard
        className="nl-phub-board-card"
        eyebrow="Ranking · aktuelle Auswahl"
        title="Liga-Leaderboard"
        actions={
          <div className="nl-phub-metric-bar" role="group" aria-label="Kennzahl wählen">
            {NL_PHUB_METRICS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`nl-phub-metric-btn ${nlToneClass(entry.tone)}${metric === entry.key ? " is-active" : ""}`}
                onClick={() => setMetric(entry.key)}
                aria-pressed={metric === entry.key}
              >
                {entry.label}
              </button>
            ))}
          </div>
        }
      >
        {topBoardRows.length === 0 ? (
          <p className="nl-phub-empty">Keine Werte für {activeMetric.label} in der aktuellen Auswahl.</p>
        ) : (
          <>
            <StatChipRow className="nl-phub-board-stats" aria-label={`Kennzahlen ${activeMetric.label}`}>
              <StatChip
                label={`Spitze · ${activeMetric.label}`}
                value={formatPhubMetricValue(topBoardRows[0]!.value, activeMetric)}
                sub={topBoardRows[0]!.row.player.name}
                tone={activeMetric.tone}
                onClick={() => openPlayerDrawerById(topBoardRows[0]!.row.player.id, topBoardRows[0]!.row.roster?.id)}
                title={`Beste(r) ${activeMetric.label} der Auswahl — ${topBoardRows[0]!.row.player.name} öffnen`}
              />
              {ownBoardEntry ? (
                <StatChip
                  label="Bester eigener Spieler"
                  value={formatPhubMetricValue(ownBoardEntry.value, activeMetric)}
                  sub={`${ownBoardEntry.row.player.name} · Rang ${formatNlNumber(ownBoardEntry.rank, 0)}`}
                  tone="accent"
                  onClick={() => openPlayerDrawerById(ownBoardEntry.row.player.id, ownBoardEntry.row.roster?.id)}
                  title={`${activeMetric.label} — ${ownBoardEntry.row.player.name} öffnen`}
                />
              ) : null}
              <StatChip
                label="Volle Rangliste"
                value={formatNlNumber(rankedRows.length, 0)}
                sub="Spieler in Auswahl"
                tone="neutral"
                onClick={() => openDrawer(ownBoardEntry?.row.player.id ?? topBoardRows[0]?.row.player.id ?? null)}
                title={`Vollständige ${activeMetric.label}-Rangliste der aktuellen Auswahl öffnen`}
              />
            </StatChipRow>
            <ol className={`nl-phub-board-list ${nlToneClass(activeMetric.tone)}`} aria-label={`Top ${activeMetric.label}`}>
              {topBoardRows.map(({ row, value, rank }) => {
                const medalKind = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null;
                const isOwn = row.team?.humanControlled ?? false;
                const leagueRank = activeMetric.pool ? getLeagueRank(value, activePool) : null;
                const percentileLabel = activeMetric.pool ? formatLeaguePercentile(leagueRank, activePool.length) : null;
                const percentileTone = activeMetric.pool ? getPoolHeatTone(value, activePool) : "neutral";
                return (
                  <li key={row.player.id} className={`nl-phub-board-row${isOwn ? " is-own" : ""}`}>
                    <span className="nl-phub-board-rank">
                      {medalKind ? (
                        <NlMedalBadge kind={medalKind} title={`Rang ${rank}`} />
                      ) : (
                        <span className="nl-phub-board-ranknum nl-tnum">{rank}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="nl-phub-board-name-btn"
                      onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                      title={`${row.player.name} öffnen`}
                    >
                      {row.player.name}
                      {isOwn ? <span className="nl-phub-own-tag">Dein Spieler</span> : null}
                    </button>
                    {row.team ? (
                      <button
                        type="button"
                        className="nl-phub-board-team-btn"
                        onClick={() => openTeamProfileById(row.team!.teamId)}
                        title={`${row.team.name} öffnen`}
                      >
                        {row.team.name}
                      </button>
                    ) : (
                      <span className="nl-phub-board-team-btn is-free-agent">Free Agent</span>
                    )}
                    <span className={`nl-phub-board-value nl-tnum ${nlToneClass(activeMetric.tone)}`}>
                      {formatPhubMetricValue(value, activeMetric)}
                    </span>
                    {percentileLabel ? (
                      <span
                        className={`nl-phub-board-percentile ${nlToneClass(percentileTone)}`}
                        title={`Liga-Perzentil: ${percentileLabel} (Rang #${leagueRank} von ${activePool.length})`}
                      >
                        {percentileLabel}
                      </span>
                    ) : (
                      <span className="nl-phub-board-percentile is-empty" aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </NlCard>

      <div className="nl-phub-grid">
        <NlCard className="nl-phub-value-card" eyebrow="Kader-Ökonomie" title="Bestes Preis-Leistungs-Verhältnis">
          {topValueRows.length === 0 ? (
            <p className="nl-phub-empty">Keine Marktwert-/OVR-Daten in der aktuellen Auswahl.</p>
          ) : (
            <>
              <StatChipRow aria-label="Preis-Leistungs-Überblick">
                <StatChip
                  label="Bestes Verhältnis"
                  value={`${formatNlNumber(topValueRows[0]!.ratio, 2)} OVR/M`}
                  sub={topValueRows[0]!.row.player.name}
                  tone="good"
                  onClick={() => openPlayerDrawerById(topValueRows[0]!.row.player.id, topValueRows[0]!.row.roster?.id)}
                  title="OVR pro investierter Marktwert-Million — bester Wert der Auswahl"
                />
                {medianRatio != null ? (
                  <StatChip
                    label="Median Auswahl"
                    value={`${formatNlNumber(medianRatio, 2)} OVR/M`}
                    tone="neutral"
                    title="Median OVR pro Marktwert-Million über die Auswahl"
                  />
                ) : null}
              </StatChipRow>
              <ol className="nl-phub-list" aria-label="Top Preis-Leistungs-Spieler">
                {topValueRows.map(({ row, mw, ovr, ratio }, index) => (
                  <li key={row.player.id} className="nl-phub-list-row">
                    <span className="nl-phub-list-rank nl-tnum">{index + 1}</span>
                    <button
                      type="button"
                      className="nl-phub-list-name-btn"
                      onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                      title={`${row.player.name} öffnen`}
                    >
                      {row.player.name}
                    </button>
                    {row.team ? (
                      <button
                        type="button"
                        className="nl-phub-list-team-btn"
                        onClick={() => openTeamProfileById(row.team!.teamId)}
                        title={`${row.team.name} öffnen`}
                      >
                        {row.team.name}
                      </button>
                    ) : (
                      <span className="nl-phub-list-team-btn is-free-agent">Free Agent</span>
                    )}
                    <span className="nl-phub-list-metrics">
                      <span className="nl-tnum">{formatNlNumber(ovr, 1)} OVR</span>
                      <span className="nl-tnum">{formatLocalePoints(mw, 2)} MW</span>
                      <span className={`nl-phub-list-ratio nl-tnum ${nlToneClass("good")}`}>
                        {formatNlNumber(ratio, 2)} OVR/M
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </NlCard>

        <NlCard className="nl-phub-movers-card" eyebrow="Marktwert-Bewegung" title="Auf- und Absteiger">
          {movers.length === 0 ? (
            <p className="nl-phub-empty">Keine Marktwert-Bewegung gegenüber der Baseline in der aktuellen Auswahl.</p>
          ) : (
            <div className="nl-phub-movers-grid">
              <div className="nl-phub-movers-col">
                <span className="nl-phub-movers-col-label">Aufsteiger</span>
                {risers.length === 0 ? (
                  <p className="nl-phub-empty-inline">Keine Aufsteiger in der Auswahl.</p>
                ) : (
                  <ol className="nl-phub-list">
                    {risers.map(({ row, delta }) => (
                      <li key={row.player.id} className="nl-phub-list-row">
                        <button
                          type="button"
                          className="nl-phub-list-name-btn"
                          onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                          title={`${row.player.name} öffnen`}
                        >
                          {row.player.name}
                        </button>
                        <NlDeltaChip
                          value={delta}
                          format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 2)}`}
                          title="Marktwert-Entwicklung gegenüber der Baseline"
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="nl-phub-movers-col">
                <span className="nl-phub-movers-col-label">Absteiger</span>
                {fallers.length === 0 ? (
                  <p className="nl-phub-empty-inline">Keine Absteiger in der Auswahl.</p>
                ) : (
                  <ol className="nl-phub-list">
                    {fallers.map(({ row, delta }) => (
                      <li key={row.player.id} className="nl-phub-list-row">
                        <button
                          type="button"
                          className="nl-phub-list-name-btn"
                          onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                          title={`${row.player.name} öffnen`}
                        >
                          {row.player.name}
                        </button>
                        <NlDeltaChip
                          value={delta}
                          format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 2)}`}
                          title="Marktwert-Entwicklung gegenüber der Baseline"
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </NlCard>

        <NlCard className="nl-phub-potential-card" eyebrow="Entwicklung · dein Kader" title="Größtes Potenzial-Polster">
          {headroomRows.length === 0 ? (
            <p className="nl-phub-empty">
              Keine eigenen Spieler mit Potenzial über dem aktuellen OVR in der Auswahl.
            </p>
          ) : (
            <ol className="nl-phub-list">
              {headroomRows.map(({ row, ovr, potential, headroom }, index) => (
                <li key={row.player.id} className="nl-phub-list-row">
                  <span className="nl-phub-list-rank nl-tnum">{index + 1}</span>
                  <button
                    type="button"
                    className="nl-phub-list-name-btn"
                    onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                    title={`${row.player.name} öffnen`}
                  >
                    {row.player.name}
                  </button>
                  {row.team ? (
                    <button
                      type="button"
                      className="nl-phub-list-team-btn"
                      onClick={() => openTeamProfileById(row.team!.teamId)}
                      title={`${row.team.name} öffnen`}
                    >
                      {row.team.name}
                    </button>
                  ) : (
                    <span className="nl-phub-list-team-btn is-free-agent">Free Agent</span>
                  )}
                  <span className="nl-phub-list-metrics">
                    <span className="nl-tnum">{formatNlNumber(ovr, 1)} OVR</span>
                    <span className="nl-tnum">{formatNlNumber(potential, 0)} PO</span>
                    <span className={`nl-phub-list-ratio nl-tnum ${nlToneClass("good")}`}>
                      +{formatNlNumber(headroom, 1)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </NlCard>

        <NlCard className="nl-phub-scarcity-card" eyebrow="Beste Disziplin" title="Spezialisierungs-Verteilung">
          {disciplineCounts.length === 0 ? (
            <p className="nl-phub-empty">Keine "Beste Diszi"-Daten in der aktuellen Auswahl.</p>
          ) : (
            <>
              <div className="nl-phub-scarcity-chart-scroll">
                <NlBarChart
                  bars={disciplineCounts.map(([label, value]) => ({ label, value, tone: "accent" as const }))}
                  format={(value) => formatNlNumber(value, 0)}
                  aria-label="Anzahl Spieler je stärkster Disziplin"
                  className="nl-phub-scarcity-chart"
                />
              </div>
              {scarcestDiscipline ? (
                <p className="nl-phub-hint">
                  Seltenste Spezialisierung in der Auswahl: <strong>{scarcestDiscipline[0]}</strong> (
                  {formatNlNumber(scarcestDiscipline[1], 0)} Spieler).
                </p>
              ) : null}
            </>
          )}
        </NlCard>
      </div>

      <NlRankingDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        metricLabel={activeMetric.label}
        metricKey={metric}
        subtitle="Rangliste der aktuellen Auswahl (Umfang-/Team-/Klassenfilter)"
        rows={drawerRows}
        highlightId={drawerHighlightId}
        onSelectRow={(row) => openPlayerDrawerById(row.id)}
      />
    </div>
  );
}
