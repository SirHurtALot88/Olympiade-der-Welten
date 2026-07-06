"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type ComponentType, type ReactNode } from "react";

import ClassIcon from "@/app/foundation/ClassIcon";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import RaceIcon from "@/app/foundation/RaceIcon";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import FoundationPlayerPortraitPreview from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import type { ContractShape, GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";

export type PlayersTableColumn = {
  id: string;
  label: string;
  dataKey: string;
  minWidth: number;
};

export type PlayersTableRow = {
  player: Player;
  roster: RosterEntry | null;
  team: Team | null;
  seasonPerformance: {
    appearances: number;
    totalPoints: number | null;
    bestDisciplineLabel: string | null;
    sourceLabel?: string;
  } | null;
  playerOvr: number | null;
  playerMvs: number | null;
  playerPps: number | null;
  bestDiscipline: string | null;
  careerLeagueStats: {
    appearances: number;
    totalPps: number;
    seasonsPlayed: number;
  } | null;
  transferStatus: string;
};

type SortableHeaderProps = {
  label: string;
  tableId: string;
  columnKey: string;
  sortState: { column: string | null; direction: "asc" | "desc" };
  onToggle: (tableId: string, columnKey: string) => void;
};

export type FoundationPlayersTableBodyProps = {
  columns: PlayersTableColumn[];
  rows: PlayersTableRow[];
  gameState: GameState;
  leaguePlayerHeatPools: LeaguePlayerHeatPools;
  tableSortState: SortableHeaderProps["sortState"];
  SortableHeader: ComponentType<SortableHeaderProps>;
  getTableColumnWidth: (tableId: "playersTable", column: PlayersTableColumn) => number;
  getTableHeaderDragProps: (
    tableId: "playersTable",
    column: PlayersTableColumn,
    visibleColumns: PlayersTableColumn[],
  ) => Record<string, unknown>;
  startTableColumnResize: (
    tableId: "playersTable",
    column: PlayersTableColumn,
    event: React.MouseEvent<HTMLSpanElement>,
  ) => void;
  resetTableColumnWidth: (tableId: "playersTable", column: PlayersTableColumn) => void;
  toggleTableSort: (tableId: string, columnKey: string) => void;
  getPlayerPortraitModel: (player: Player) => {
    src: string | null;
    thumbSrc: string | null;
    previewSrc: string | null;
    initials: string;
  };
  getTeamLogoModel: (team: Team, options?: { variant?: "default" | "thumb" }) => { src: string | null; initials: string };
  getPoolHeatClass: (value: number, pool: number[]) => string;
  formatPpsValue: (value: number) => string;
  formatWholeNumber: (value: number | null | undefined) => string;
  formatLocalePoints: (value: number, digits?: number) => string;
  getPlayerDisplayMarketValue: (player: Player) => number;
  getPlayerDisplayMarketValueDelta: (
    player: Player,
    roster: RosterEntry | null,
    gameState: GameState,
  ) => number | null;
  getRosterEntryDisplaySalary: (roster: RosterEntry, player: Player) => number;
  getPlayerDisplaySalary: (player: Player) => number;
  getRosterEntryCurrentSeasonSalary: (roster: RosterEntry, player: Player) => number;
  getRosterEntrySalaryDelta: (roster: RosterEntry | null, player: Player, gameState: GameState) => number | null;
  rosterSalariesDifferForDisplay: (currentSeasonSalary: number, annualSalary: number) => boolean;
  formatContractShapeShortLabel: (shape: ContractShape | null | undefined) => string;
  formatContractShapeLabel: (shape: ContractShape | null | undefined) => string;
  renderEconomyDelta: (
    delta: number | null,
    direction: "higher" | "lower",
    className: string,
  ) => ReactNode;
  openPlayerDrawerById: (playerId: string, rosterId?: string | null) => void;
  openTeamProfileById: (teamId: string) => void;
  enabled?: boolean;
};

export default function FoundationPlayersTableBody({
  columns,
  rows,
  gameState,
  leaguePlayerHeatPools,
  tableSortState,
  SortableHeader,
  getTableColumnWidth,
  getTableHeaderDragProps,
  startTableColumnResize,
  resetTableColumnWidth,
  toggleTableSort,
  getPlayerPortraitModel,
  getTeamLogoModel,
  getPoolHeatClass,
  formatPpsValue,
  formatWholeNumber,
  formatLocalePoints,
  getPlayerDisplayMarketValue,
  getPlayerDisplayMarketValueDelta,
  getRosterEntryDisplaySalary,
  getPlayerDisplaySalary,
  getRosterEntryCurrentSeasonSalary,
  getRosterEntrySalaryDelta,
  rosterSalariesDifferForDisplay,
  formatContractShapeShortLabel,
  formatContractShapeLabel,
  renderEconomyDelta,
  openPlayerDrawerById,
  openTeamProfileById,
  enabled = true,
}: FoundationPlayersTableBodyProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: enabled ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });
  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div className="table-shell table-shell-virtualized" ref={scrollRef} style={{ maxHeight: "72vh", overflow: "auto" }}>
      <table className="team-table players-table">
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} style={{ width: `${getTableColumnWidth("playersTable", column)}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                {...getTableHeaderDragProps("playersTable", column, columns)}
                style={{ width: `${getTableColumnWidth("playersTable", column)}px`, minWidth: `${column.minWidth}px` }}
              >
                <div className="resizable-header-cell">
                  {column.id === "image" ? (
                    <span>Bild</span>
                  ) : (
                    <SortableHeader
                      label={column.label}
                      tableId="playersTable"
                      columnKey={column.dataKey}
                      sortState={tableSortState}
                      onToggle={toggleTableSort}
                    />
                  )}
                  <span
                    className="column-resizer"
                    draggable={false}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`${column.label} Breite anpassen`}
                    onMouseDown={(event) => startTableColumnResize("playersTable", column, event)}
                    onDoubleClick={() => resetTableColumnWidth("playersTable", column)}
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {virtualRows.length > 0 && virtualRows[0].start > 0 ? (
            <tr aria-hidden="true" style={{ height: virtualRows[0].start, border: 0, pointerEvents: "none" }}>
              <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
            </tr>
          ) : null}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) {
              return null;
            }
            return (
              <tr key={row.player.id} onClick={() => void openPlayerDrawerById(row.player.id, row.roster?.id)}>
                {columns.map((column) => {
                  if (column.id === "image") {
                    const portrait = getPlayerPortraitModel(row.player);
                    return (
                      <td key={column.id}>
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
                          context="roster"
                          playerClassName={row.player.className}
                        >
                          {portrait.src ? (
                            <BudgetedMediaImage
                              className="transfermarkt-portrait"
                              src={portrait.src}
                              placeholderSrc={portrait.previewSrc ?? portrait.thumbSrc}
                              alt={row.player.name}
                              width={56}
                              height={56}
                              fallback={
                                <div
                                  className="transfermarkt-portrait transfermarkt-portrait-placeholder"
                                  aria-label={`${row.player.name} placeholder`}
                                >
                                  {portrait.initials}
                                </div>
                              }
                            />
                          ) : (
                            <div
                              className="transfermarkt-portrait transfermarkt-portrait-placeholder"
                              aria-label={`${row.player.name} placeholder`}
                            >
                              {portrait.initials}
                            </div>
                          )}
                        </FoundationPlayerPortraitPreview>
                      </td>
                    );
                  }
                  if (column.id === "name") {
                    return (
                      <td key={column.id}>
                        <div className="table-player-cell">
                          <button
                            className="table-link-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openPlayerDrawerById(row.player.id, row.roster?.id);
                            }}
                          >
                            {row.player.name}
                          </button>
                          <span>{row.seasonPerformance?.sourceLabel ?? row.transferStatus}</span>
                        </div>
                      </td>
                    );
                  }
                  if (column.id === "team") {
                    const teamLogo = row.team ? getTeamLogoModel(row.team, { variant: "thumb" }) : null;
                    return (
                      <td key={column.id}>
                        <button
                          className="players-table-team-cell players-table-team-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (row.team) {
                              openTeamProfileById(row.team.teamId);
                            }
                          }}
                        >
                          {teamLogo?.src ? (
                            <BudgetedMediaImage
                              className="players-table-team-logo"
                              src={teamLogo.src}
                              alt={`${row.team?.name ?? "Team"} Logo`}
                              width={30}
                              height={30}
                              loading="lazy"
                              fetchPriority="low"
                              fallback={
                                <span
                                  className="players-table-team-logo players-table-team-logo-placeholder"
                                  aria-label={`${row.team?.name ?? "Free Agent"} Logo Platzhalter`}
                                >
                                  {teamLogo.initials ?? "FA"}
                                </span>
                              }
                            />
                          ) : (
                            <span
                              className="players-table-team-logo players-table-team-logo-placeholder"
                              aria-label={`${row.team?.name ?? "Free Agent"} Logo Platzhalter`}
                            >
                              {teamLogo?.initials ?? "FA"}
                            </span>
                          )}
                          <span>{row.team?.name ?? "Free Agent"}</span>
                        </button>
                      </td>
                    );
                  }
                  if (column.id === "class") {
                    return (
                      <td key={column.id}>
                        <ClassIcon classNameValue={row.player.className} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
                      </td>
                    );
                  }
                  if (column.id === "race") {
                    return (
                      <td key={column.id}>
                        <RaceIcon race={row.player.race} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
                      </td>
                    );
                  }
                  if (column.id === "pps") {
                    return (
                      <td key={column.id} className={row.playerPps != null ? getPoolHeatClass(row.playerPps, leaguePlayerHeatPools.pps) : ""}>
                        {row.playerPps != null ? formatPpsValue(row.playerPps) : "—"}
                      </td>
                    );
                  }
                  if (column.id === "ovr") {
                    return (
                      <td key={column.id} className={row.playerOvr != null ? getPoolHeatClass(row.playerOvr, leaguePlayerHeatPools.ovr) : ""}>
                        {formatWholeNumber(row.playerOvr)}
                      </td>
                    );
                  }
                  if (column.id === "mvs") {
                    return (
                      <td key={column.id} className={row.playerMvs != null ? getPoolHeatClass(row.playerMvs, leaguePlayerHeatPools.mvs) : ""}>
                        {row.playerMvs != null ? formatPpsValue(row.playerMvs) : "—"}
                      </td>
                    );
                  }
                  if (column.id === "mw") {
                    const marketValue = getPlayerDisplayMarketValue(row.player);
                    const marketValueDelta = getPlayerDisplayMarketValueDelta(row.player, row.roster, gameState);
                    return (
                      <td key={column.id}>
                        <span className="players-table-money-cell">
                          <span>{formatLocalePoints(marketValue, 2)}</span>
                          {renderEconomyDelta(marketValueDelta, "higher", "players-table-money-delta")}
                        </span>
                      </td>
                    );
                  }
                  if (column.id === "salary") {
                    const annualSalary = row.roster
                      ? getRosterEntryDisplaySalary(row.roster, row.player)
                      : getPlayerDisplaySalary(row.player);
                    const currentSeasonSalary = row.roster
                      ? getRosterEntryCurrentSeasonSalary(row.roster, row.player)
                      : annualSalary;
                    const salaryDelta = getRosterEntrySalaryDelta(row.roster, row.player, gameState);
                    const showSeasonSubline = rosterSalariesDifferForDisplay(currentSeasonSalary, annualSalary);
                    return (
                      <td key={column.id}>
                        <span className="players-table-money-cell">
                          <span className="players-table-salary-primary">
                            <span>{formatLocalePoints(annualSalary, 2)}</span>
                            {renderEconomyDelta(salaryDelta, "lower", "players-table-money-delta")}
                          </span>
                          {showSeasonSubline ? (
                            <small className="players-table-salary-season" title="Gehalt diese Saison (Vertragsjahr 1)">
                              Saison: {formatLocalePoints(currentSeasonSalary, 2)}
                            </small>
                          ) : null}
                        </span>
                      </td>
                    );
                  }
                  if (column.id === "contract") {
                    if (!row.roster) {
                      return <td key={column.id}>—</td>;
                    }
                    const shapeLabel = formatContractShapeShortLabel(row.roster.contractShape);
                    return (
                      <td key={column.id}>
                        <span className="players-table-contract-cell">
                          {shapeLabel ? (
                            <span className="players-table-contract-shape" title={formatContractShapeLabel(row.roster.contractShape)}>
                              {shapeLabel}
                            </span>
                          ) : null}
                          <span>{row.roster.contractLength}J</span>
                        </span>
                      </td>
                    );
                  }
                  if (column.id === "appearances") {
                    return <td key={column.id}>{row.seasonPerformance ? row.seasonPerformance.appearances : "—"}</td>;
                  }
                  if (column.id === "bestDiscipline") {
                    return (
                      <td key={column.id}>
                        <DisciplineIcon label={row.bestDiscipline ?? "—"} showLabel={Boolean(row.bestDiscipline)} />
                      </td>
                    );
                  }
                  if (column.id === "careerLeague") {
                    const stats = row.careerLeagueStats;
                    if (!stats) {
                      return <td key={column.id}>—</td>;
                    }
                    return (
                      <td
                        key={column.id}
                        title={`Alltime Liga: ${stats.seasonsPlayed} Saison(en) · ${stats.appearances} Einsätze · ${formatLocalePoints(stats.totalPps, 1)} PPs`}
                      >
                        <span className="players-table-career-stat">
                          {stats.appearances} / {formatLocalePoints(stats.totalPps, 1)}
                        </span>
                      </td>
                    );
                  }
                  const traits = [
                    ...row.player.traitsPositive,
                    ...row.player.traitsNegative.map((trait) => `-${trait}`),
                  ];
                  return <td key={column.id}>{traits.length > 0 ? traits.join(", ") : "—"}</td>;
                })}
              </tr>
            );
          })}
          {virtualRows.length > 0 ? (
            <tr
              aria-hidden="true"
              style={{
                height: virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end,
                border: 0,
                pointerEvents: "none",
              }}
            >
              <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
