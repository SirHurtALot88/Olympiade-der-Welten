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
  NlCard,
  NlDeltaChip,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
  type NlAxisKey,
} from "@/components/foundation/new-look";
import FoundationPlayerPortraitPreview from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { SortState } from "@/lib/foundation/foundation-table-ui-types";
import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
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
}> = [
  { id: "image", label: "Bild", align: "left" },
  { id: "name", label: "Name", sortKey: "name", align: "left" },
  { id: "team", label: "Team", sortKey: "team", align: "left" },
  { id: "class", label: "Klasse", sortKey: "class", align: "center" },
  { id: "race", label: "Rasse", sortKey: "race", align: "center" },
  { id: "axes", label: "Achsen", align: "left", tooltip: "POW / SPE / MEN / SOC Kernwerte (0–100)" },
  { id: "pps", label: "PPs", sortKey: "pps", align: "right" },
  { id: "ovr", label: "OVR", sortKey: "ovr", align: "right" },
  { id: "mvs", label: "MVS", sortKey: "mvs", align: "right" },
  { id: "mw", label: "MW", sortKey: "mw", align: "right" },
  { id: "salary", label: "Gehalt", sortKey: "salary", align: "right" },
  { id: "contract", label: "Vertrag", sortKey: "contract", align: "right" },
  { id: "appearances", label: "Einsätze", sortKey: "appearances", align: "right" },
  { id: "bestDiscipline", label: "Beste Diszi", sortKey: "bestDiscipline", align: "left" },
  {
    id: "careerLeague",
    label: "Alltime",
    sortKey: "careerLeague",
    align: "right",
    tooltip: "Gesamte Liga-Einsätze und PPs über alle Saisons (Archiv + Live).",
  },
  { id: "traits", label: "Traits", sortKey: "traits", align: "left" },
];

const NL_PLAYERS_PAGE_SIZE = 100;

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

  // Bei Filterwechsel wieder auf die erste "Seite" zurück.
  useEffect(() => {
    setVisibleCount(NL_PLAYERS_PAGE_SIZE);
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
  ) {
    if (row == null || value == null) {
      return <StatChip label={label} value="—" tone={tone} title={title} />;
    }
    const rank = getLeagueRank(value, pool);
    return (
      <StatChip
        label={label}
        value={formatNlNumber(value, digits)}
        tone={tone}
        sub={[row.player.name, formatLeagueRankSub(rank)].filter(Boolean).join(" · ")}
        title={`${title} — ${row.player.name} öffnen`}
        onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
      />
    );
  }

  function renderAxisBars(row: FoundationPlayerScopeRow) {
    return (
      <div className="nl-players-axes" role="group" aria-label={`Achsenwerte ${row.player.name}`}>
        {NL_PLAYERS_AXES.map(({ key, label }) => {
          const value = row.player.coreStats[key] ?? null;
          const percent =
            value != null && Number.isFinite(value) ? Math.max(2, Math.min(100, value)) : 0;
          return (
            <span
              key={key}
              className={`nl-players-axis ${nlToneClass(key)}`}
              title={`${label}: ${formatNlNumber(value, 0)} von 100`}
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

    return (
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
          >
            {portrait.src ? (
              <BudgetedMediaImage
                className="nl-players-portrait"
                src={portrait.src}
                placeholderSrc={portrait.previewSrc ?? portrait.thumbSrc}
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
        <td className="nl-players-td-name">
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
            <span className="nl-players-status">{row.transferStatus}</span>
          </button>
        </td>
        <td className="nl-players-td-team">
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
        <td className="nl-players-td-icon">
          <ClassIcon
            classNameValue={row.player.className}
            className="table-identity-icon-chip"
            iconClassName="table-identity-icon-image"
          />
        </td>
        <td className="nl-players-td-icon">
          <RaceIcon race={row.player.race} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
        </td>
        <td className="nl-players-td-axes">{renderAxisBars(row)}</td>
        <td
          className={`nl-players-td-metric ${
            row.playerPps != null ? getPoolHeatClass(row.playerPps, leaguePlayerHeatPools.pps) : ""
          }`}
        >
          {row.playerPps != null ? formatPpsValue(row.playerPps) : "—"}
        </td>
        <td
          className={`nl-players-td-metric ${
            row.playerOvr != null ? getPoolHeatClass(row.playerOvr, leaguePlayerHeatPools.ovr) : ""
          }`}
        >
          {formatWholeNumber(row.playerOvr)}
        </td>
        <td
          className={`nl-players-td-metric ${
            row.playerMvs != null ? getPoolHeatClass(row.playerMvs, leaguePlayerHeatPools.mvs) : ""
          }`}
        >
          {row.playerMvs != null ? formatPpsValue(row.playerMvs) : "—"}
        </td>
        <td className="nl-players-td-money">
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
        <td className="nl-players-td-money">
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
        <td className="nl-players-td-contract">
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
        <td className="nl-players-td-metric">
          {row.seasonPerformance ? row.seasonPerformance.appearances : "—"}
        </td>
        <td className="nl-players-td-disc">
          <DisciplineIcon label={row.bestDiscipline ?? "—"} showLabel={Boolean(row.bestDiscipline)} />
        </td>
        <td
          className="nl-players-td-career"
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
        <td className="nl-players-td-traits" title={traitsText}>
          {traitsText}
        </td>
      </tr>
    );
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
              value={formatNlNumber(summary.avgMw, 1)}
              tone="neutral"
              title="Durchschnittlicher Marktwert der Auswahl"
            />
            <StatChip
              label="Gehälter"
              value={formatNlNumber(summary.totalSalary, 1)}
              tone="warn"
              title="Summe der Jahresgehälter der Auswahl"
            />
          </StatChipRow>
        </div>
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
          )}
        </StatChipRow>
        <div className="nl-players-brackets" role="group" aria-label="Marktwert-Brackets der Auswahl">
          {NL_PLAYERS_BRACKETS.map(({ bracket, range }) => (
            <span
              key={bracket}
              className="nl-players-bracket"
              title={`Bracket ${bracket} (${range}): ${playerBracketCounts[bracket] ?? 0} Spieler`}
            >
              <strong>B{bracket}</strong>
              <span>{range}</span>
              <b className="nl-tnum">{playerBracketCounts[bracket] ?? 0}</b>
            </span>
          ))}
        </div>
      </NlCard>

      {rows.length === 0 ? (
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
                      className={`nl-players-th is-${column.align ?? "left"}`}
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
              <tbody>{visibleRows.map((row) => renderRow(row))}</tbody>
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
          <p className="nl-players-footnote">
            Farben sind liga-relativ: jede Stufe steht für ein Achtel des aktuellen Liga-Pools. So sticht auch ein POW
            61 klar hervor, wenn er ligaweit in den Top 12,5% liegt.
          </p>
        </NlCard>
      )}
    </div>
  );
}
