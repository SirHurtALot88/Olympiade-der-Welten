"use client";

import type * as React from "react";

import { TooltipHeading } from "@/components/ui/TooltipHeading";
import type { SortState } from "@/lib/foundation/tabs/cockpit-types";
import type { Team } from "@/lib/data/olyDataTypes";

export interface FoundationRanksPanelProps {
  sortedPpAreaRows: Array<{
    rank: number;
    team: Team;
    pps: { total: number; pow: number; spe: number; men: number; soc: number };
    formBonus: { total: number; pow: number; spe: number; men: number; soc: number };
  }>;
  ppAreaRankClassMaps: {
    total: Map<string, string>;
    pow: Map<string, string>;
    spe: Map<string, string>;
    men: Map<string, string>;
    soc: Map<string, string>;
  };
  ppAreaMetricPools: {
    total: Array<number | null | undefined>;
    pow: Array<number | null | undefined>;
    spe: Array<number | null | undefined>;
    men: Array<number | null | undefined>;
    soc: Array<number | null | undefined>;
  };
  tableSorts: { ppArea: SortState };
  toggleTableSort: (tableId: string, columnKey: string) => void;
  openTeamProfileById: (teamId: string) => void;
  renderPpAreaMetricCell: (
    value: number,
    formBonus: number,
    options: { tone: string; pool: Array<number | null | undefined>; fallbackMax: number },
  ) => React.ReactNode;
  SortableHeader: React.ComponentType<{
    label: string;
    tableId: string;
    columnKey: string;
    sortState?: SortState;
    onToggle: (tableId: string, columnKey: string) => void;
  }>;
}

export default function FoundationRanksPanel({
  sortedPpAreaRows,
  ppAreaRankClassMaps,
  ppAreaMetricPools,
  tableSorts,
  toggleTableSort,
  openTeamProfileById,
  renderPpAreaMetricCell,
  SortableHeader,
}: FoundationRanksPanelProps) {
  return (
    <section className="panel foundation-ranks-panel" data-testid="foundation-ranks" id="foundation-ranks">
            <div className="panel-header">
            <TooltipHeading
              as="h2"
              tooltip="Summe aus POW, SPE, MEN und SOC je Team. Werte in Klammern, z.B. (+8), zeigen den reinen Formkartenbonus, der in diese Punkte eingeflossen ist. Top 3 sind stark markiert, Rang 4-10 markiert, ab Rang 11 neutral."
            >
              PPs pro Bereich
            </TooltipHeading>
            </div>
            <div className="table-shell narrow-table-shell season-pp-summary-shell">
              <table className="team-table pp-table season-pp-table">
                <thead>
                  <tr>
                    <th><SortableHeader label="Rank" tableId="ppArea" columnKey="rank" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th><SortableHeader label="Team" tableId="ppArea" columnKey="team" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th><SortableHeader label="PPs" tableId="ppArea" columnKey="pps" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th className="pp-head-pow"><SortableHeader label="PP Pow" tableId="ppArea" columnKey="pow" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th className="pp-head-spe"><SortableHeader label="PP Spe" tableId="ppArea" columnKey="spe" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th className="pp-head-men"><SortableHeader label="PP Men" tableId="ppArea" columnKey="men" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                    <th className="pp-head-soc"><SortableHeader label="PP Soc" tableId="ppArea" columnKey="soc" sortState={tableSorts.ppArea} onToggle={toggleTableSort} /></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPpAreaRows.map((row) => {
                    const teamId = row.team.teamId;
                    return (
                      <tr key={row.team.teamId} onClick={() => openTeamProfileById(row.team.teamId)}>
                        <td>{row.rank}</td>
                        <td>{row.team.name}</td>
                            <td className={ppAreaRankClassMaps.total.get(teamId) || undefined}>
                              {renderPpAreaMetricCell(row.pps.total, row.formBonus.total, {
                                tone: "pps",
                                pool: ppAreaMetricPools.total,
                                fallbackMax: 300,
                              })}
                            </td>
                            <td className={ppAreaRankClassMaps.pow.get(teamId) || undefined}>
                              {renderPpAreaMetricCell(row.pps.pow, row.formBonus.pow, {
                                tone: "pow",
                                pool: ppAreaMetricPools.pow,
                                fallbackMax: 120,
                              })}
                            </td>
                            <td className={ppAreaRankClassMaps.spe.get(teamId) || undefined}>
                              {renderPpAreaMetricCell(row.pps.spe, row.formBonus.spe, {
                                tone: "spe",
                                pool: ppAreaMetricPools.spe,
                                fallbackMax: 120,
                              })}
                            </td>
                            <td className={ppAreaRankClassMaps.men.get(teamId) || undefined}>
                              {renderPpAreaMetricCell(row.pps.men, row.formBonus.men, {
                                tone: "men",
                                pool: ppAreaMetricPools.men,
                                fallbackMax: 120,
                              })}
                            </td>
                            <td className={ppAreaRankClassMaps.soc.get(teamId) || undefined}>
                              {renderPpAreaMetricCell(row.pps.soc, row.formBonus.soc, {
                                tone: "soc",
                                pool: ppAreaMetricPools.soc,
                                fallbackMax: 120,
                              })}
                            </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
    </section>
  );
}
