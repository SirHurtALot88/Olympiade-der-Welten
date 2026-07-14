"use client";

import type * as React from "react";

import FoundationPrizeV2NewLook from "@/app/foundation/prize-v2/FoundationPrizeV2NewLook";
import { useNewLook } from "@/lib/ui/new-look-preference";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type {
  FoundationPrizePreviewItem,
  FoundationPrizePreviewResponse,
  FoundationTableColumn,
  SortState,
} from "@/lib/foundation/tabs/cockpit-types";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { getCockpitStatusPillClass, type CockpitStepStatus } from "@/lib/foundation/tabs/cockpit-ui-helpers";
import type { PrizeV2Row } from "@/lib/foundation/tabs/use-prize-v2-panel-model";
import { clampValue } from "@/lib/foundation/tabs/prize-v2-ui-helpers";

export interface FoundationPrizeV2PanelProps {
  gameState: GameState;
  activeContextMeta: Parameters<typeof import("@/lib/foundation/tabs/foundation-format-render-helpers").getViewSourceBadgeLabel>[1];
  prizePreviewFeed: FoundationPrizePreviewResponse | null;
  prizePreviewHardBlocked: string[];
  prizePreviewGlobalWarnings: string[];
  prizeApplyState: { status: CockpitStepStatus; label: string };
  seasonEndChampionRow: TeamManagementSnapshotRow | null;
  selectedTeam: Team | null;
  prizeForecastRank: number;
  setPrizeForecastRank: (value: number) => void;
  prizeForecastRankRow: FoundationPrizePreviewItem | null;
  prizeForecastRows: Array<{
    label: string;
    factor: number | null;
    prizeMoney: number | null;
    salaryTotal: number | null;
    loanInstallment: number | null;
    guv: number | null;
    cashAfter: number | null;
  }>;
  prizePreviewTableColumns: FoundationTableColumn[];
  visiblePrizePreviewColumns: FoundationTableColumn[];
  displayPrizePreviewRows: FoundationPrizePreviewItem[];
  prizeV2Summary: {
    calculableTeams: number;
    totalTeams: number;
  };
  prizeV2LeaderRow: PrizeV2Row | null;
  prizeV2SelectedTeamSummary: ReturnType<typeof Object> | null;
  prizeV2SwingRow: PrizeV2Row | null;
  prizeV2RiskRow: PrizeV2Row | null;
  prizeV2FactorRows: Array<{ seasonLabel: string; factor: number | null }>;
  tableSorts: { prizePreview: SortState };
  formatLocalePoints: (value: number | null | undefined, maximumFractionDigits?: number) => string;
  formatNullableMoney: (value: number | null | undefined) => string;
  formatSignedDisplayMoney: (value: number | null | undefined) => string;
  getViewSourceBadgeLabel: (view: string, meta: FoundationPrizeV2PanelProps["activeContextMeta"]) => string;
  setFoundationView: (view: string, setActiveView: (view: string) => void) => void;
  setActiveView: (view: string) => void;
  openTeamProfileById: (teamId: string) => void;
  getTableActivePreset: (tableId: string) => string | null;
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault?: boolean) => boolean;
  setTableColumnVisible: (tableId: string, columnId: string, nextVisible: boolean) => void;
  moveTableColumn: (tableId: string, columnId: string, direction: "left" | "right", columns: FoundationTableColumn[]) => void;
  getTableColumnWidth: (tableId: string, column: FoundationTableColumn) => number;
  adjustTableColumnWidth: (tableId: string, column: FoundationTableColumn, delta: number) => void;
  resetTableColumnWidth: (tableId: string, column: FoundationTableColumn) => void;
  resetTableLayout: (tableId: string, columns: FoundationTableColumn[]) => void;
  getTableHeaderDragProps: (
    tableId: string,
    column: FoundationTableColumn,
    columns: FoundationTableColumn[],
  ) => Record<string, unknown>;
  startTableColumnResize: (tableId: string, column: FoundationTableColumn, event: React.MouseEvent<HTMLSpanElement>) => void;
  toggleTableSort: (tableId: string, columnKey: string) => void;
  ColumnVisibilityManager: React.ComponentType<{
    title: string;
    columns: FoundationTableColumn[];
    activePreset?: string | null;
    isVisible: (columnId: string, visibleByDefault?: boolean) => boolean;
    onToggle: (columnId: string, nextVisible: boolean) => void;
    onMove?: (columnId: string, direction: "left" | "right") => void;
    getWidth?: (column: FoundationTableColumn) => number;
    onStepWidth?: (column: FoundationTableColumn, delta: number) => void;
    onResetWidth?: (column: FoundationTableColumn) => void;
    onResetToDefault?: () => void;
  }>;
  SortableHeader: React.ComponentType<{
    label: string;
    tableId: string;
    columnKey: string;
    sortState?: SortState;
    onToggle: (tableId: string, columnKey: string) => void;
  }>;
}

export default function FoundationPrizeV2Panel(props: FoundationPrizeV2PanelProps) {
  // "Neuer Look" Flag-Gate (additiv): Flag an => neue Preisgeld-Ansicht mit
  // denselben Props; Flag aus => bestehendes Layout unverändert.
  const [newLook] = useNewLook();
  if (newLook) return <FoundationPrizeV2NewLook {...props} />;

  const {
    gameState,
    activeContextMeta,
    prizePreviewFeed,
    prizePreviewHardBlocked,
    prizePreviewGlobalWarnings,
    prizeApplyState,
    seasonEndChampionRow,
    selectedTeam,
    prizeForecastRank,
    setPrizeForecastRank,
    prizeForecastRankRow,
    prizeForecastRows,
    prizePreviewTableColumns,
    visiblePrizePreviewColumns,
    displayPrizePreviewRows,
    prizeV2Summary,
    prizeV2LeaderRow,
    prizeV2SelectedTeamSummary,
    prizeV2SwingRow,
    prizeV2RiskRow,
    prizeV2FactorRows,
    tableSorts,
    formatLocalePoints,
    formatNullableMoney,
    formatSignedDisplayMoney,
    getViewSourceBadgeLabel,
    setFoundationView,
    setActiveView,
    openTeamProfileById,
    getTableActivePreset,
    isTableColumnVisible,
    setTableColumnVisible,
    moveTableColumn,
    getTableColumnWidth,
    adjustTableColumnWidth,
    resetTableColumnWidth,
    resetTableLayout,
    getTableHeaderDragProps,
    startTableColumnResize,
    toggleTableSort,
    ColumnVisibilityManager,
    SortableHeader,
  } = props;
  // Kreditrate-Spalte nur einblenden, wenn das ausgewählte Team überhaupt
  // einen aktiven Kredit hat — sonst keine leere "0"-Spalte (siehe
  // `getTeamAnnualLoanInstallment`, own-team-only).
  const prizeForecastHasLoan = prizeForecastRows.some((row) => row.loanInstallment != null && row.loanInstallment > 0);
  return (
            <div className="prize-v2-shell">
              <section className="prize-v2-hero">
                <div className="prize-v2-hero-copy">
                  <span className="prize-v2-kicker">Preisgeld</span>
                  <h2>{gameState.season.name} · Saisonende</h2>
                  <p>
                    Echte Preisgeldtabelle mit Basis-Anteil, Season-Anteil, Bonus/Malus und 5-Seasons-Forecast.
                    Der Ablauf bleibt gleich: Endstand, Preisgeld/Cash, dann erst Verkaufs- und Kaufphase.
                  </p>
                  <div className="prize-v2-pill-row">
                    <span className="pill foundation-source-pill">{getViewSourceBadgeLabel("prize", activeContextMeta)}</span>
                    <span className={`pill ${prizePreviewHardBlocked.length > 0 ? "is-warning" : "is-ready"}`}>
                      {prizePreviewHardBlocked.length > 0 ? `${prizePreviewHardBlocked.length} Blocker` : "ohne Blocker"}
                    </span>
                    <span className="pill">{prizeV2Summary.calculableTeams}/{prizeV2Summary.totalTeams} Teams berechenbar</span>
                  </div>
                </div>
                <div className="prize-v2-hero-actions">
                  <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("seasonV2", setActiveView)}>
                    Saison v2
                  </button>
                  <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("teams", setActiveView)}>
                    Teams
                  </button>
                </div>
              </section>

              <section className="prize-v2-story-grid" aria-label="Preisgeld-Fokus">
                <article className="prize-v2-story-card is-leader">
                  <span>Top Auszahlung</span>
                  <strong>{prizeV2LeaderRow ? prizeV2LeaderRow.teamName : "—"}</strong>
                  <small>{prizeV2LeaderRow ? `#${prizeV2LeaderRow.rank ?? "—"} · ${formatNullableMoney(prizeV2LeaderRow.prizeMoney)}` : "kein Leader"}</small>
                </article>
                <article className="prize-v2-story-card is-selected">
                  <span>Dein Outlook</span>
                  <strong>{prizeV2SelectedTeamSummary ? prizeV2SelectedTeamSummary.teamName : "—"}</strong>
                  <small>
                    {prizeV2SelectedTeamSummary
                      ? `#${prizeV2SelectedTeamSummary.rank ?? "—"} · ${formatLocalePoints(prizeV2SelectedTeamSummary.currentCash, 1)} → ${formatLocalePoints(prizeV2SelectedTeamSummary.projectedCash, 1)}`
                      : "kein Team aktiv"}
                  </small>
                </article>
                <article className="prize-v2-story-card is-swing">
                  <span>Größter Swing</span>
                  <strong>{prizeV2SwingRow ? prizeV2SwingRow.teamName : "—"}</strong>
                  <small>
                    {prizeV2SwingRow
                      ? `${formatSignedDisplayMoney(prizeV2SwingRow.rankDelta)} Plätze · ${formatSignedDisplayMoney(prizeV2SwingRow.bonusMalus)}`
                      : "kein Ausschlag"}
                  </small>
                </article>
                <article className="prize-v2-story-card is-risk">
                  <span>Finanzrisiko</span>
                  <strong>{prizeV2RiskRow ? prizeV2RiskRow.teamName : "—"}</strong>
                  <small>
                    {prizeV2RiskRow
                      ? `Cash danach ${formatLocalePoints(prizeV2RiskRow.projectedCash, 1)} · ${prizeV2RiskRow.warnings.length} Hinweise`
                      : "kein Drucksignal"}
                  </small>
                </article>
              </section>

              <section className="prize-v2-factor-strip" aria-label="Saisonfaktoren">
                {prizeV2FactorRows.length > 0 ? (
                  prizeV2FactorRows.map((entry) => (
                    <article key={entry.seasonLabel} className={`prize-v2-factor-card ${entry.factor == null ? "is-neutral" : entry.factor >= 1.18 ? "is-strong" : entry.factor >= 1 ? "is-good" : entry.factor >= 0.9 ? "is-mid" : "is-low"}`}>
                      <span>{entry.seasonLabel}</span>
                      <strong>{formatLocalePoints(entry.factor, 2)}</strong>
                    </article>
                  ))
                ) : (
                  <article className="prize-v2-factor-card is-neutral">
                    <span>Faktoren</span>
                    <strong>—</strong>
                  </article>
                )}
              </section>

              <section className="prize-v2-main-grid">
                <div className="prize-v2-table-panel">
                  <div className="panel-header prize-v2-panel-header">
                    <div className="stack">
                      <h3>Preisgeld-Tabelle</h3>
                      <p className="muted">Die klassische Haupttabelle bleibt vorne. Spalten, Sortierung und Forecast bleiben erhalten.</p>
                    </div>
                    <ColumnVisibilityManager
                      title="Spalten"
                      columns={prizePreviewTableColumns}
                      activePreset={getTableActivePreset("prizePreviewTable")}
                      isVisible={(columnId, visibleByDefault) =>
                        isTableColumnVisible("prizePreviewTable", columnId, visibleByDefault)
                      }
                      onToggle={(columnId, nextVisible) => setTableColumnVisible("prizePreviewTable", columnId, nextVisible)}
                      onMove={(columnId, direction) => moveTableColumn("prizePreviewTable", columnId, direction, prizePreviewTableColumns)}
                      getWidth={(column) => getTableColumnWidth("prizePreviewTable", column)}
                      onStepWidth={(column, delta) => adjustTableColumnWidth("prizePreviewTable", column, delta)}
                      onResetWidth={(column) => resetTableColumnWidth("prizePreviewTable", column)}
                      onResetToDefault={() => resetTableLayout("prizePreviewTable", prizePreviewTableColumns)}
                    />
                  </div>
                  <section className="prize-v2-primary-forecast">
                    <div className="panel-header prize-v2-panel-header">
                      <div className="stack">
                        <h3>Eigenes Team Forecast</h3>
                        <p className="muted">Das eigene Team steht oben: Cash, Faktor, Preisgeld und 5-Seasons-Folge direkt an der Haupttabelle.</p>
                      </div>
                      <label className="filter-field prize-forecast-rank-select">
                        <span>Platz simulieren</span>
                        <select
                          className="input"
                          value={prizeForecastRank}
                          onChange={(event) => setPrizeForecastRank(clampValue(Number(event.target.value), 1, 32))}
                        >
                          {Array.from({ length: Math.max(32, prizePreviewFeed?.summary.prizeRowsCount ?? 0) }, (_, index) => index + 1).map((rank) => (
                            <option key={rank} value={rank}>
                              Platz {rank}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="prize-v2-team-strip">
                      <article>
                        <span>Cash vorher</span>
                        <strong>{prizeV2SelectedTeamSummary?.currentCash != null ? formatLocalePoints(prizeV2SelectedTeamSummary.currentCash, 1) : "—"}</strong>
                      </article>
                      <article>
                        <span>Season Faktor</span>
                        <strong>{formatLocalePoints(prizePreviewFeed?.summary.currentFactor ?? null, 2)}</strong>
                      </article>
                      <article>
                        <span>Preisgeld</span>
                        <strong>{prizeV2SelectedTeamSummary?.prizeMoney != null ? formatLocalePoints(prizeV2SelectedTeamSummary.prizeMoney, 1) : "—"}</strong>
                      </article>
                      <article>
                        <span>Bonus / Malus</span>
                        <strong className={prizeV2SelectedTeamSummary?.bonusMalus != null && prizeV2SelectedTeamSummary.bonusMalus < 0 ? "text-negative" : "text-positive"}>
                          {formatSignedDisplayMoney(prizeV2SelectedTeamSummary?.bonusMalus)}
                        </strong>
                      </article>
                      <article>
                        <span>Cash nachher</span>
                        <strong>{prizeV2SelectedTeamSummary?.projectedCash != null ? formatLocalePoints(prizeV2SelectedTeamSummary.projectedCash, 1) : "—"}</strong>
                      </article>
                      <article>
                        <span>Simulierter Platz</span>
                        <strong>{prizeForecastRankRow ? `${prizeForecastRank}.` : "—"}</strong>
                      </article>
                      {prizeV2SelectedTeamSummary?.loanInstallment != null ? (
                        <article>
                          <span>Kreditrate</span>
                          <strong>{formatLocalePoints(prizeV2SelectedTeamSummary.loanInstallment, 1)}</strong>
                        </article>
                      ) : null}
                    </div>
                    {prizeForecastRows.length === 0 ? (
                      <p className="muted">Forecast wartet auf Preisgeld-Preview, Team-Cash und Gehaltssumme.</p>
                    ) : (
                      <div className="table-shell prize-v2-forecast-shell">
                        <table className="team-table prize-v2-forecast-table">
                          <thead>
                            <tr>
                              <th>Season</th>
                              <th>Faktor</th>
                              <th>Preisgeld</th>
                              <th>Gehalt</th>
                              {prizeForecastHasLoan ? <th>Kreditrate</th> : null}
                              <th>GuV</th>
                              <th>Cash</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prizeForecastRows.map((row) => (
                              <tr key={row.label}>
                                <td>{row.label}</td>
                                <td>{formatLocalePoints(row.factor ?? null, 2)}</td>
                                <td>{row.prizeMoney != null ? formatLocalePoints(row.prizeMoney, 1) : "—"}</td>
                                <td>{row.salaryTotal != null ? formatLocalePoints(row.salaryTotal, 1) : "—"}</td>
                                {prizeForecastHasLoan ? (
                                  <td>{row.loanInstallment != null ? formatLocalePoints(row.loanInstallment, 1) : "—"}</td>
                                ) : null}
                                <td className={row.guv != null && row.guv < 0 ? "text-negative" : "text-positive"}>{formatSignedDisplayMoney(row.guv)}</td>
                                <td>{row.cashAfter != null ? formatLocalePoints(row.cashAfter, 1) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                  <div className="table-shell">
                    <table className="team-table prize-team-table">
                <colgroup>
                  {visiblePrizePreviewColumns.map((column) => (
                    <col key={column.id} style={{ width: `${getTableColumnWidth("prizePreviewTable", column)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {visiblePrizePreviewColumns.map((column) => (
                      <th
                        key={column.id}
                        {...getTableHeaderDragProps("prizePreviewTable", column, visiblePrizePreviewColumns)}
                        style={{ width: `${getTableColumnWidth("prizePreviewTable", column)}px`, minWidth: `${column.minWidth}px` }}
                      >
                        <div className="resizable-header-cell">
                          <SortableHeader label={column.label} tableId="prizePreview" columnKey={column.dataKey} sortState={tableSorts.prizePreview} onToggle={toggleTableSort} />
                          <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("prizePreviewTable", column, event)} onDoubleClick={() => resetTableColumnWidth("prizePreviewTable", column)} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayPrizePreviewRows.map((row) => (
                    <tr
                      key={row.teamId}
                      className={`prize-team-table-row${row.teamId === selectedTeam?.teamId ? " is-selected" : ""}`}
                      onClick={() => openTeamProfileById(row.teamId)}
                    >
                      {visiblePrizePreviewColumns.map((column) => {
                        if (column.id === "team") return <td key={column.id}>{row.teamName}</td>;
                        if (column.id === "projectedRank") return <td key={column.id}>{row.rank ?? "—"}</td>;
                        if (column.id === "startRank") return <td key={column.id}>{row.rankChangePrize?.startRank ?? "—"}</td>;
                        if (column.id === "rankDelta") return <td key={column.id}>{row.rankChangePrize?.rankDelta != null ? formatLocalePoints(row.rankChangePrize.rankDelta, 0) : "—"}</td>;
                        if (column.id === "currentCash") return <td key={column.id}>{row.currentCash != null ? formatLocalePoints(row.currentCash, 1) : "—"}</td>;
                        if (column.id === "basisCash") return <td key={column.id}>{row.basisCash != null ? formatLocalePoints(row.basisCash, 1) : "—"}</td>;
                        if (column.id === "seasonCash") return <td key={column.id}>{row.seasonCash != null ? formatLocalePoints(row.seasonCash, 1) : "—"}</td>;
                        if (column.id === "currentFactor") {
                          return <td key={column.id}>{formatLocalePoints(prizePreviewFeed?.summary.currentFactor ?? null, 2)}</td>;
                        }
                        if (column.id === "prizeMoney") return <td key={column.id}>{row.prizeMoney != null ? formatLocalePoints(row.prizeMoney, 1) : "—"}</td>;
                        if (column.id === "rankChangePrize") return <td key={column.id}>{row.rankChangePrize?.bonusMalus != null ? formatLocalePoints(row.rankChangePrize.bonusMalus, 1) : "—"}</td>;
                        if (column.id === "payoutIfTenBetter") return <td key={column.id}>{row.payoutIfTenBetter != null ? formatLocalePoints(row.payoutIfTenBetter, 1) : "—"}</td>;
                        if (column.id === "payoutIfTenWorse") return <td key={column.id}>{row.payoutIfTenWorse != null ? formatLocalePoints(row.payoutIfTenWorse, 1) : "—"}</td>;
                        if (column.id === "projectedCash") return <td key={column.id}>{row.projectedCash != null ? formatLocalePoints(row.projectedCash, 1) : "—"}</td>;
                        if (column.id === "warnings") return <td key={column.id}>{row.warnings.join(", ") || "—"}</td>;
                        const seasonLabel = column.id.replace(/^future-/, "");
                        const seasonRow = row.futureSeasons?.find((future) => future.seasonLabel === seasonLabel) ?? null;
                        return <td key={column.id}>{seasonRow?.prizeMoney != null ? formatLocalePoints(seasonRow.prizeMoney, 1) : "—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
                  </div>
                </div>

                <aside className="prize-v2-side-rail">
                  <section className="prize-v2-side-panel">
                    <div className="panel-header prize-v2-panel-header">
                      <div className="stack">
                        <h3>Season-End Review</h3>
                        <p className="muted">Die Funktion von v1 bleibt: lesen, prüfen, dann erst Season-End-Schritte auslösen.</p>
                      </div>
                      <span className={getCockpitStatusPillClass(prizeApplyState.status)}>{prizeApplyState.label}</span>
                    </div>
                    <div className="prize-v2-review-grid">
                      <article>
                        <span>Preisgeld-Zeilen</span>
                        <strong>{prizePreviewFeed?.summary.prizeRowsCount ?? 0}</strong>
                      </article>
                      <article>
                        <span>Berechenbar</span>
                        <strong>{prizePreviewFeed?.summary.calculableTeams ?? 0}</strong>
                      </article>
                      <article>
                        <span>Faktor aktuell</span>
                        <strong>{formatLocalePoints(prizePreviewFeed?.summary.currentFactor ?? null, 2)}</strong>
                      </article>
                      <article>
                        <span>Folge-Seasons</span>
                        <strong>{prizePreviewFeed?.summary.futureSeasonCount ?? 0}</strong>
                      </article>
                      <article>
                        <span>Rank Bonus/Malus</span>
                        <strong className={prizePreviewFeed?.summary.totalRankChangePrize != null && prizePreviewFeed.summary.totalRankChangePrize < 0 ? "text-negative" : "text-positive"}>
                          {prizePreviewFeed?.summary.totalRankChangePrize != null ? formatSignedDisplayMoney(prizePreviewFeed.summary.totalRankChangePrize) : "—"}
                        </strong>
                      </article>
                      <article>
                        <span>Champion</span>
                        <strong>{seasonEndChampionRow?.team.name ?? "—"}</strong>
                      </article>
                    </div>
                    {prizeV2SelectedTeamSummary ? (
                      <div className="prize-v2-scenario-box">
                        <strong>{prizeV2SelectedTeamSummary.teamName}</strong>
                        <small>
                          {prizePreviewFeed?.scenarioWindow
                            ? `+${prizePreviewFeed.scenarioWindow.betterBy}: ${formatNullableMoney(prizeV2SelectedTeamSummary.payoutIfTenBetter)} · -${prizePreviewFeed.scenarioWindow.worseBy}: ${formatNullableMoney(prizeV2SelectedTeamSummary.payoutIfTenWorse)}`
                            : "Kein Szenariofenster gefunden."}
                        </small>
                      </div>
                    ) : null}
                    {prizePreviewHardBlocked.length > 0 ? (
                      <div className="prize-v2-warning-box is-blocked">
                        <strong>Blocker</strong>
                        <ul>
                          {prizePreviewHardBlocked.slice(0, 4).map((rule) => (
                            <li key={rule}>{rule}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {prizePreviewGlobalWarnings.length > 0 ? (
                      <div className="prize-v2-warning-box">
                        <strong>Hinweise</strong>
                        <ul>
                          {prizePreviewGlobalWarnings.slice(0, 4).map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <p className="muted cockpit-step-hint">
                      RankChange: Season 1 nutzt Startbudget als StartRank; spätere Seasons nutzen den Vorjahresrang, falls als Quelle vorhanden.
                    </p>
                  </section>
                </aside>
              </section>
            </div>
  );
}
