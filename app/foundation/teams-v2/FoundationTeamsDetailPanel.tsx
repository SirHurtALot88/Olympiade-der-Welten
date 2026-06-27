// @ts-nocheck
"use client";

import { Fragment, startTransition, useState, type CSSProperties } from "react";

import ClassColorChip, { getClassColorClassName } from "@/app/foundation/ClassColorChip";
import ClassIcon from "@/app/foundation/ClassIcon";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import RaceIcon from "@/app/foundation/RaceIcon";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { SponsorOfferCard } from "@/components/foundation/sponsor/SponsorOfferCard";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

const TEAM_ROSTER_PORTRAIT_LOADING = {
  loading: "eager",
  fetchPriority: "high",
} as const;

function PlayerPortrait({
  src,
  initials,
  alt,
  className,
  style,
  loading = "lazy",
  fetchPriority = "auto",
}: {
  src: string | null;
  initials: string;
  alt: string;
  className: string;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`${className} transfermarkt-portrait-placeholder`} aria-label={`${alt} Platzhalter`} style={style}>
        {initials}
      </span>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      style={style}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      onError={() => setFailed(true)}
    />
  );
}

export type FoundationTeamsDetailPanelProps = {
  active: boolean;
  gameState: unknown;
  selectedTeam: unknown;
  sortedTeamsViewRows: unknown;
  visibleTeamsViewColumns: unknown;
  getViewClass: (...views: FoundationViewId[]) => string;
  SortableHeader: unknown;
  getTableColumnWidth: unknown;
  getTableHeaderDragProps: unknown;
  getTeamsViewColumnTitle: unknown;
  toggleTableSort: unknown;
  startTableColumnResize: unknown;
  resetTableColumnWidth: unknown;
  tableSorts: unknown;
  joinClassNames: unknown;
  getOwnerTeamHighlightClass: unknown;
  resolvedTeamControlSettings: unknown;
  scheduleActiveManagerTeam: unknown;
  openTeamProfileById: unknown;
  formatMoney: unknown;
  formatLocalePoints: unknown;
  getSeasonCashHeatClass: unknown;
  formatWholeNumber: unknown;
  getTeamAxisRankTooltip: unknown;
  getRankHeatClass: unknown;
  teamHistoryPointRankMaps: unknown;
  selectedTeamsHistoryData: unknown;
  teamEconomyTiles: unknown;
  formatNullableMoney: unknown;
  formatSignedDisplayMoney: unknown;
  getTeamHistoryRankToneClass: unknown;
  selectedTeamObjectives: unknown;
  teamObjectiveOverview: unknown;
  selectedTeamSponsorContract: unknown;
  selectedTeamSponsorOffers: unknown;
  selectedTeamContractShapeMix: unknown;
  renderMetricBar: unknown;
  leaguePlayerHeatPools: unknown;
  selectedTeamDetailTab: unknown;
  teamRosterRoleFilter: unknown;
  setTeamRosterRoleFilter: unknown;
  teamRosterFocusMode: unknown;
  setTeamRosterFocusMode: unknown;
  sortedSelectedRosterTableRows: unknown;
  visibleSelectedRosterColumns: unknown;
  selectedTeamContractTable: unknown;
  showTeamContractPreviewRows: unknown;
  setShowTeamContractPreviewRows: unknown;
  contractRenewalBusy: unknown;
  openContractRenewalNegotiation: unknown;
  openMarketSellModal: unknown;
  openPlayerDrawerById: unknown;
  playerRatingsById: unknown;
  getPlayerPortraitModel: unknown;
  getClassColorClassName: unknown;
  getRosterEntryDisplaySalary: unknown;
  getRosterEntryDisplayMarketValue: unknown;
  renderEconomyDelta: unknown;
  getPlayerDisplayMarketValueDelta: unknown;
  getRosterEntrySalaryDelta: unknown;
  formatPpsValue: unknown;
  formatDisplayMoney: unknown;
  formatContractShapeLabel: unknown;
  formatMoraleContractIntentLabel: unknown;
  getPlayerDisplaySalary: unknown;
  starters: unknown;
  bench: unknown;
  selectedIdentity: unknown;
  freeAgents: unknown;
  aiPreview: unknown;
  selectedAiTeamId: unknown;
  aiMarketPreview: unknown;
  isPending: unknown;
  isReadOnlyMode: unknown;
  showReadOnlyNotice: unknown;
  setGameState: unknown;
  runAiTurn: unknown;
  showExtendedTeamPanels: unknown;
  setShowExtendedTeamPanels: unknown;
  formatTransfermarktCurrency: unknown;
  roundViewNumber: unknown;
  getLineupDraftSideCounts: unknown;
  isSelectedTeamManagementLocked: unknown;
  selectedTeamControl: unknown;
  formatTeamControlModeLabel: unknown;
  openTeamDrawerById: unknown;
  selectedRosterTableRows: unknown;
  shouldBuildTeamContracts: unknown;
  playerSeasonPerformanceMap: unknown;
  applySponsorNegotiationToComponents: unknown;
  chooseTeamSponsor: unknown;
  confirmContractRenewalNegotiation: unknown;
  formatObjectiveStatusLabel: unknown;
  formatCockpitReason: unknown;
  getPoolHeatClass: unknown;
  getResponsiveTableImageSize: unknown;
  getSponsorNegotiationMultiplier: unknown;
  getTeamLogoModel: unknown;
  setContractRenewalNegotiation: unknown;
  setShowSelectedRosterPpsBreakdown: unknown;
  setShowTeamDisciplines: unknown;
  setSponsorChoiceProfiles: unknown;
  toggleTransferSellMarker: unknown;
  selectedBoardConfidence: unknown;
  selectedTeamCommercialRating: unknown;
  showTeamDisciplines: unknown;
  teamRosterRoleFilterOptions: unknown;
  teamRosterFocusOptions: unknown;
  contractRenewalNegotiation: unknown;
  showSelectedRosterPpsBreakdown: unknown;
  sponsorChoiceMessage: unknown;
  sponsorChoiceProfiles: unknown;
  sponsorChoiceBusy: unknown;
  selectedTeamCanManage: unknown;
  contractRenewalMessage: unknown;
  contractRenewalError: unknown;
};

export default function FoundationTeamsDetailPanel({
  active,
gameState,
  selectedTeam,
  sortedTeamsViewRows,
  visibleTeamsViewColumns,
  getViewClass,
  SortableHeader,
  getTableColumnWidth,
  getTableHeaderDragProps,
  getTeamsViewColumnTitle,
  toggleTableSort,
  startTableColumnResize,
  resetTableColumnWidth,
  tableSorts,
  joinClassNames,
  getOwnerTeamHighlightClass,
  resolvedTeamControlSettings,
  scheduleActiveManagerTeam,
  openTeamProfileById,
  formatMoney,
  formatLocalePoints,
  getSeasonCashHeatClass,
  formatWholeNumber,
  getTeamAxisRankTooltip,
  getRankHeatClass,
  teamHistoryPointRankMaps,
  selectedTeamsHistoryData,
  teamEconomyTiles,
  formatNullableMoney,
  formatSignedDisplayMoney,
  getTeamHistoryRankToneClass,
  selectedTeamObjectives,
  teamObjectiveOverview,
  selectedTeamSponsorContract,
  selectedTeamSponsorOffers,
  selectedTeamContractShapeMix,
  renderMetricBar,
  leaguePlayerHeatPools,
  selectedTeamDetailTab,
  teamRosterRoleFilter,
  setTeamRosterRoleFilter,
  teamRosterFocusMode,
  setTeamRosterFocusMode,
  sortedSelectedRosterTableRows,
  visibleSelectedRosterColumns,
  selectedTeamContractTable,
  showTeamContractPreviewRows,
  setShowTeamContractPreviewRows,
  contractRenewalBusy,
  openContractRenewalNegotiation,
  openMarketSellModal,
  openPlayerDrawerById,
  playerRatingsById,
  getPlayerPortraitModel,
  getClassColorClassName,
  getRosterEntryDisplaySalary,
  getRosterEntryDisplayMarketValue,
  renderEconomyDelta,
  getPlayerDisplayMarketValueDelta,
  getRosterEntrySalaryDelta,
  formatPpsValue,
  formatDisplayMoney,
  formatContractShapeLabel,
  formatMoraleContractIntentLabel,
  getPlayerDisplaySalary,
  starters,
  bench,
  selectedIdentity,
  freeAgents,
  aiPreview,
  selectedAiTeamId,
  aiMarketPreview,
  isPending,
  isReadOnlyMode,
  showReadOnlyNotice,
  setGameState,
  runAiTurn,
  showExtendedTeamPanels,
  setShowExtendedTeamPanels,
  formatTransfermarktCurrency,
  roundViewNumber,
  getLineupDraftSideCounts,
  isSelectedTeamManagementLocked,
  selectedTeamControl,
  formatTeamControlModeLabel,
  openTeamDrawerById,
  selectedRosterTableRows,
  shouldBuildTeamContracts,
  playerSeasonPerformanceMap,
  applySponsorNegotiationToComponents,
  chooseTeamSponsor,
  confirmContractRenewalNegotiation,
  formatObjectiveStatusLabel,
  formatCockpitReason,
  getPoolHeatClass,
  getResponsiveTableImageSize,
  getSponsorNegotiationMultiplier,
  getTeamLogoModel,
  setContractRenewalNegotiation,
  setShowSelectedRosterPpsBreakdown,
  setShowTeamDisciplines,
  setSponsorChoiceProfiles,
  toggleTransferSellMarker,
  selectedBoardConfidence,
  selectedTeamCommercialRating,
  showTeamDisciplines,
  teamRosterRoleFilterOptions,
  teamRosterFocusOptions,
  contractRenewalNegotiation,
  showSelectedRosterPpsBreakdown,
  sponsorChoiceMessage,
  sponsorChoiceProfiles,
  sponsorChoiceBusy,
  selectedTeamCanManage,
  contractRenewalMessage,
  contractRenewalError,
}: FoundationTeamsDetailPanelProps) {
  if (!active) {
    return null;
  }

  return (
    <div className="foundation-teams-view-panel" data-testid="foundation-teams-view">
            <>
              <section className={`panel teams-league-panel${getViewClass("teams")}`} id="teams-league-overview">
                <div className="teams-comparison-header">
                  <div>
                    <span className="eyebrow">Teams · Liga</span>
                    <strong>Teamtabelle</strong>
                  </div>
                </div>
                <div className="table-shell teams-overview-shell">
                  <table className="team-table teams-overview-table">
                    <colgroup>
                      {visibleTeamsViewColumns.map((column) => (
                        <col key={column.id} style={{ width: `${getTableColumnWidth("teamsView", column)}px` }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        {visibleTeamsViewColumns.map((column) => (
                          <th
                            key={column.id}
                            {...getTableHeaderDragProps("teamsView", column, visibleTeamsViewColumns)}
                            className={
                              column.id === "pow"
                                ? "teams-view-head-pow"
                                : column.id === "spe"
                                  ? "teams-view-head-spe"
                                  : column.id === "men"
                                    ? "teams-view-head-men"
                                    : column.id === "soc"
                                      ? "teams-view-head-soc"
                                      : ""
                            }
                            style={{ width: `${getTableColumnWidth("teamsView", column)}px`, minWidth: `${column.minWidth}px` }}
                            title={getTeamsViewColumnTitle(column.id)}
                          >
                            <div className="resizable-header-cell">
                              <SortableHeader label={column.label} tableId="teamsView" columnKey={column.dataKey} sortState={tableSorts.teamsView} onToggle={toggleTableSort} />
                              <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("teamsView", column, event)} onDoubleClick={() => resetTableColumnWidth("teamsView", column)} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTeamsViewRows.map((row) => (
                        <tr
                          key={row.team.teamId}
                          className={joinClassNames(
                            selectedTeam?.teamId === row.team.teamId && "is-selected",
                            getOwnerTeamHighlightClass(resolvedTeamControlSettings[row.team.teamId]),
                          )}
                          onClick={() => {
                            scheduleActiveManagerTeam(row.team.teamId, "manual_select");
                          }}
                        >
                          {visibleTeamsViewColumns.map((column) => {
                            if (column.id === "team") {
                              return <td key={column.id} className="teams-view-team-cell"><button className="table-link-button" type="button" onClick={(event) => { event.stopPropagation(); openTeamProfileById(row.team.teamId); }}>{row.team.name}</button></td>;
                            }
                            if (column.id === "overallRank") return <td key={column.id} className="teams-view-rank-cell">{row.overallRank ?? "—"}</td>;
                            if (column.id === "cash") return <td key={column.id} className={`teams-view-finance-cell teams-view-cash-cell ${row.cash != null ? getSeasonCashHeatClass(row.cash, sortedTeamsViewRows) : ""}`}>{row.cash != null ? formatMoney(row.cash) : "—"}</td>;
                            if (column.id === "guv") return <td key={column.id} className={`teams-view-finance-cell ${row.guv == null ? "" : row.guv >= 0 ? "text-positive" : "text-negative"}`}>{row.guv != null ? formatLocalePoints(row.guv, 1) : "—"}</td>;
                            if (column.id === "roster") return <td key={column.id} className="teams-view-meta-cell">{row.rosterCount}</td>;
                            if (column.id === "mw") return <td key={column.id} className="teams-view-finance-cell">{row.marketValueTotal != null ? formatLocalePoints(row.marketValueTotal, 2) : "—"}</td>;
                            if (column.id === "salary") return <td key={column.id} className="teams-view-finance-cell">{formatLocalePoints(row.salaryTotal, 2)}</td>;
                            if (column.id === "sponsor") return <td key={column.id} className="teams-view-finance-cell">{row.sponsorTotal != null ? formatLocalePoints(row.sponsorTotal, 1) : "—"}</td>;
                            if (column.id === "pow") return <td key={column.id} title={row.rosterCount === 0 ? "Kein aktiver Kader vorhanden" : getTeamAxisRankTooltip("POW")} className={`teams-view-axis-cell teams-view-axis-cell-pow ${row.currentPowRank != null ? getRankHeatClass(row.currentPowRank, gameState.teams.length) : ""}`}>{row.currentPowRank != null ? formatWholeNumber(row.currentPowRank) : "—"}</td>;
                            if (column.id === "spe") return <td key={column.id} title={row.rosterCount === 0 ? "Kein aktiver Kader vorhanden" : getTeamAxisRankTooltip("SPE")} className={`teams-view-axis-cell teams-view-axis-cell-spe ${row.currentSpeRank != null ? getRankHeatClass(row.currentSpeRank, gameState.teams.length) : ""}`}>{row.currentSpeRank != null ? formatWholeNumber(row.currentSpeRank) : "—"}</td>;
                            if (column.id === "men") return <td key={column.id} title={row.rosterCount === 0 ? "Kein aktiver Kader vorhanden" : getTeamAxisRankTooltip("MEN")} className={`teams-view-axis-cell teams-view-axis-cell-men ${row.currentMenRank != null ? getRankHeatClass(row.currentMenRank, gameState.teams.length) : ""}`}>{row.currentMenRank != null ? formatWholeNumber(row.currentMenRank) : "—"}</td>;
                            if (column.id === "soc") return <td key={column.id} title={row.rosterCount === 0 ? "Kein aktiver Kader vorhanden" : getTeamAxisRankTooltip("SOC")} className={`teams-view-axis-cell teams-view-axis-cell-soc ${row.currentSocRank != null ? getRankHeatClass(row.currentSocRank, gameState.teams.length) : ""}`}>{row.currentSocRank != null ? formatWholeNumber(row.currentSocRank) : "—"}</td>;
                            if (column.id === "histPoints") {
                              const rank = teamHistoryPointRankMaps.total.get(row.team.teamId);
                              return <td key={column.id} className={`teams-view-history-points-cell ${rank != null ? getRankHeatClass(rank, gameState.teams.length) : ""}`}>{row.historicalPointsTotal != null ? formatLocalePoints(row.historicalPointsTotal, 1) : "—"}</td>;
                            }
                            if (column.id === "avgPoints") {
                              const rank = teamHistoryPointRankMaps.average.get(row.team.teamId);
                              return <td key={column.id} className={`teams-view-history-points-cell ${rank != null ? getRankHeatClass(rank, gameState.teams.length) : ""}`}>{row.avgPoints != null ? formatLocalePoints(row.avgPoints, 1) : "—"}</td>;
                            }
                            if (column.id === "gold") return <td key={column.id} className="teams-view-medal-cell" title="Goldmedaillen">🥇 {row.goldCount}</td>;
                            if (column.id === "silver") return <td key={column.id} className="teams-view-medal-cell" title="Silbermedaillen">🥈 {row.silverCount}</td>;
                            if (column.id === "bronze") return <td key={column.id} className="teams-view-medal-cell" title="Bronzemedaillen">🥉 {row.bronzeCount}</td>;
                            if (column.id === "top5") return <td key={column.id} className="teams-view-meta-cell">{row.top5}</td>;
                            if (column.id === "top10") return <td key={column.id} className="teams-view-meta-cell">{row.top10}</td>;
                            if (column.id === "avgRank") return <td key={column.id} className="teams-view-meta-cell">{row.avgRank != null ? formatWholeNumber(row.avgRank) : "—"}</td>;
                            if (column.id === "seasonPoints") {
                              const historyEntries = [...row.historicalPointsBySeason].sort((left, right) =>
                                left.seasonId.localeCompare(right.seasonId, "de", { numeric: true }),
                              );
                              return (
                                <td key={column.id} className="teams-view-season-points-cell">
                                  {historyEntries.length > 0 ? (
                                    <details>
                                      <summary>{historyEntries.length} Seasons</summary>
                                      <div className="teams-view-season-points-list">
                                        {historyEntries.map((entry) => (
                                          <span key={`${row.team.teamId}-${entry.seasonId}`}>
                                            <b>{entry.seasonName.replace("Season ", "S")}</b>
                                            {formatLocalePoints(entry.points, 1)}
                                            {entry.rank != null ? <small>#{entry.rank}</small> : null}
                                          </span>
                                        ))}
                                      </div>
                                    </details>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              );
                            }
                            return <td key={column.id}>—</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {selectedTeamsHistoryData ? (
                <section className={`panel teams-economy-panel${getViewClass("teams")}`} aria-label="Team-Kennzahlen">
                  <div className="teams-v2-focus-grid">
                    {teamEconomyTiles.map((tile) => (
                      <article key={tile.label} className={`teams-v2-focus-card is-${tile.tone}`} title={tile.detail}>
                        <span>{tile.label}</span>
                        <strong>{tile.value}</strong>
                        <small>{tile.note}</small>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={`panel teams-history-panel teams-v2-history-panel${getViewClass("teams")}`} aria-label="Team-Historie">
                <div className="teams-v2-section-head">
                  <div>
                    <TooltipHeading
                      as="h3"
                      tooltip="Live-Season zuerst, darunter die echten Team-Snapshots mit Rang, Punkten, PPs, Achsen, Cash, Gehalt und Marktwert."
                    >
                      {selectedTeam.name} · Historie
                    </TooltipHeading>
                  </div>
                </div>
                {selectedTeamsHistoryData?.history?.length ? (
                  <div className="table-shell teams-history-shell">
                    <table className="team-table teams-v2-history-table">
                      <thead>
                        <tr>
                          <th>Saison</th>
                          <th>Rang</th>
                          <th>Punkte</th>
                          <th>PPs</th>
                          <th>POW</th>
                          <th>SPE</th>
                          <th>MEN</th>
                          <th>SOC</th>
                          <th>Cash</th>
                          <th>Gehalt</th>
                          <th>MW</th>
                          <th>GuV</th>
                          <th>Top Einkauf</th>
                          <th>Top Verkauf</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTeamsHistoryData.history.map((row) => (
                          <tr key={`team-history-${row.seasonId}`} className={row.isLive ? "is-live" : ""}>
                            <td className="teams-v2-season-cell">
                              <strong>{row.seasonName}</strong>
                              {row.isLive ? <span className="pill">Live</span> : null}
                            </td>
                            <td className={`teams-v2-rank-cell ${getTeamHistoryRankToneClass(row.rank)}`}>{row.rank != null ? `#${row.rank}` : "—"}</td>
                            <td>{formatLocalePoints(row.points, 1)}</td>
                            <td>{formatLocalePoints(row.pps, 1)}</td>
                            <td className="teams-v2-area-cell is-pow">{formatLocalePoints(row.ppPow, 1)}</td>
                            <td className="teams-v2-area-cell is-spe">{formatLocalePoints(row.ppSpe, 1)}</td>
                            <td className="teams-v2-area-cell is-men">{formatLocalePoints(row.ppMen, 1)}</td>
                            <td className="teams-v2-area-cell is-soc">{formatLocalePoints(row.ppSoc, 1)}</td>
                            <td>{formatNullableMoney(row.cash)}</td>
                            <td>{formatNullableMoney(row.salaryTotal)}</td>
                            <td>{formatNullableMoney(row.marketValue)}</td>
                            <td className={row.guv != null && row.guv < 0 ? "text-negative" : "text-positive"}>
                              {formatSignedDisplayMoney(row.guv)}
                            </td>
                            <td>{row.topBuyPlayer ? `${row.topBuyPlayer} · ${formatNullableMoney(row.topBuyAmount)}` : "—"}</td>
                            <td>{row.topSellPlayer ? `${row.topSellPlayer} · ${formatNullableMoney(row.topSellAmount)}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">Für dieses Team ist noch keine Historie verfügbar.</p>
                )}
              </section>

              <section className={`panel team-objectives-panel teams-secondary-objectives-panel${getViewClass("teams")}`} data-testid="team-board-objectives" id="team-board-objectives">
                <div className="panel-header compact">
                  <div className="stack">
                    <h2>Board-Ziele</h2>
                    <p className="muted">Saisonziele fuer Sport, Finanzen, Transfers, Kader, Facilities und Entwicklung.</p>
                  </div>
                  <div className="room-meta foundation-admin-meta">
                    <span className="pill" title={TEAM_BOARD_RATING_TOOLTIP}>
                      Board Rating {selectedBoardConfidence?.value ?? "—"}/10
                    </span>
                    <span
                      className={`transfer-status-pill${(selectedBoardConfidence?.pressure ?? 0) >= 8 ? " is-warning" : " is-ready"}`}
                      title={TEAM_BOARD_PRESSURE_TOOLTIP}
                    >
                      Druck {selectedBoardConfidence?.pressure ?? "—"}/10
                    </span>
                  </div>
                </div>
                <div className="teams-summary-grid history-summary-grid">
                  {selectedTeamObjectives.map((objective) => (
                    <article
                      key={`team-objective-${objective.objectiveId}`}
                      className="metric-card teams-summary-card"
                      title={`Grundlage: ${objective.source}`}
                    >
                      <span>{objective.category.toUpperCase()}</span>
                      <strong>{objective.label}</strong>
                      <small className="muted">
                        Ist {String(objective.currentValue ?? "—")} · Ziel {String(objective.targetValue ?? "—")}
                      </small>
                      <div className="room-meta foundation-admin-meta">
                        <span className={`transfer-status-pill${objective.status === "completed" ? " is-ready" : objective.status === "failed" || objective.status === "at_risk" ? " is-warning" : ""}`}>
                          {formatObjectiveStatusLabel(objective.status)}
                        </span>
                        {objective.rewardCash != null ? <span className="pill">Bonus {formatMoney(objective.rewardCash)}</span> : null}
                        {objective.penaltyCash != null ? <span className="pill">Malus {formatMoney(objective.penaltyCash)}</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
                {selectedBoardConfidence?.warnings.length ? (
                  <p className="muted">Board-Hinweise: {selectedBoardConfidence.warnings.map(formatCockpitReason).join(", ")}</p>
                ) : null}
              </section>

              <section className={`panel team-sponsor-panel teams-secondary-objectives-panel${getViewClass("teams")}`} data-testid="team-sponsor-choice" id="team-sponsor-choice">
                <div className="panel-header compact">
                  <div className="stack">
                    <h2>Sponsor-Vertrag</h2>
                    <p className="muted">Drei Angebote pro Saison — Sterne-Tier, Basis, Platzierung, Verbesserung und Sonderziel.</p>
                    {selectedTeamCommercialRating ? (
                      <p className="muted">
                        Commercial Rating {selectedTeamCommercialRating.score}/100 · Erwartung ★{selectedTeamCommercialRating.tierHint}
                        {" · "}Historie {selectedTeamCommercialRating.breakdown.recentPerformance.toFixed(0)} · Kader{" "}
                        {selectedTeamCommercialRating.breakdown.rosterPotential.toFixed(0)} · Prestige{" "}
                        {selectedTeamCommercialRating.breakdown.prestige.toFixed(0)}
                      </p>
                    ) : null}
                  </div>
                </div>
                {sponsorChoiceMessage ? <div className="status-banner is-success">{sponsorChoiceMessage}</div> : null}
                {selectedTeamSponsorContract ? (
                  <div className="teams-summary-grid history-summary-grid">
                    <article className="metric-card teams-summary-card">
                      <span>
                        AKTIV{selectedTeamSponsorContract.starTier ? ` · ★${selectedTeamSponsorContract.starTier}` : ""}
                        {selectedTeamSponsorContract.termSeasons ? ` · ${selectedTeamSponsorContract.termSeasons} Saison` : ""}
                      </span>
                      <strong>{selectedTeamSponsorContract.name}</strong>
                      <small className="muted">
                        {selectedTeamSponsorContract.variantKey ? `${selectedTeamSponsorContract.variantKey.replace(/_/g, " ")} · ` : ""}
                        {selectedTeamSponsorContract.components.length} Vertragskomponenten
                        {selectedTeamSponsorContract.negotiationProfile ? ` · Profil ${selectedTeamSponsorContract.negotiationProfile}` : ""}
                      </small>
                    </article>
                  </div>
                ) : (
                  <div className="teams-summary-grid history-summary-grid">
                    {selectedTeamSponsorOffers.map((offer) => {
                      const negotiationProfile = sponsorChoiceProfiles[offer.offerId] ?? "balanced";
                      const adjustedComponents = applySponsorNegotiationToComponents({
                        components: offer.components,
                        termSeasons: 1,
                        negotiationProfile,
                        starTier: offer.starTier,
                      });
                      const multiplier = getSponsorNegotiationMultiplier({ termSeasons: 1, negotiationProfile });
                      return (
                        <SponsorOfferCard
                          key={offer.offerId}
                          offer={offer}
                          gameState={gameState}
                          adjustedComponents={adjustedComponents}
                          negotiationProfile={negotiationProfile}
                          multiplier={multiplier}
                          chooseBusy={sponsorChoiceBusy === offer.offerId}
                          canManage={selectedTeamCanManage}
                          onNegotiationProfileChange={(profile) =>
                            setSponsorChoiceProfiles((current) => ({
                              ...current,
                              [offer.offerId]: profile,
                            }))
                          }
                          onChoose={() => void chooseTeamSponsor(offer.offerId)}
                          formatCash={formatMoney}
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              <section className={`panel team-focus-panel teams-primary-roster-panel${getViewClass("teams")}`} id="team-focus-roster">
                <div className="panel-header team-focus-header">
                  <div className="team-focus-title-wrap">
                    {(() => {
                      const logo = getTeamLogoModel(selectedTeam);
                      return logo.src ? (
                        <img
                          className="team-focus-logo"
                          src={logo.src}
                          alt={`${selectedTeam.name} Logo`}
                          loading="eager"
                          decoding="async"
                          fetchPriority="high"
                        />
                      ) : (
                        <div className="team-focus-logo team-logo-placeholder" aria-label={`${selectedTeam.name} Logo Platzhalter`}>
                          {logo.initials}
                        </div>
                      );
                    })()}
                    <div>
                    <p className="eyebrow">Team Fokus</p>
                    <h2>{selectedTeam.name} - Kader</h2>
                    </div>
                  </div>
                  <button
                    className="secondary-button inline-button"
                    type="button"
                    onClick={() => setShowTeamDisciplines((current) => !current)}
                    title={showTeamDisciplines ? "Diszi-Spalten ausblenden" : "Diszi-Spalten einblenden"}
                  >
                    Diszis
                  </button>
                </div>
                {selectedTeamDetailTab === "roster" ? (
                  <>
                    <div className="team-roster-role-filterbar" aria-label="Kaderrollen filtern">
                      {teamRosterRoleFilterOptions.map((option) => (
                        <button
                          key={`team-roster-role-filter-${option.id}`}
                          className={`secondary-button inline-button${teamRosterRoleFilter === option.id ? " is-active" : ""}`}
                          type="button"
                          onClick={() => setTeamRosterRoleFilter(option.id)}
                        >
                          {option.label} <span>{option.count}</span>
                        </button>
                      ))}
                    </div>

                    <div className="team-roster-focusbar" aria-label="Kaderfokus waehlen">
                      {teamRosterFocusOptions.map((option) => (
                        <button
                          key={`team-roster-focus-${option.id}`}
                          className={`secondary-button inline-button${teamRosterFocusMode === option.id ? " is-active" : ""}`}
                          type="button"
                          onClick={() => setTeamRosterFocusMode(option.id)}
                        >
                          {option.label} <span>{option.count}</span>
                        </button>
                      ))}
                    </div>
                    {selectedTeamRosterActionHint ? (
                      <div className={`team-roster-action-status${selectedTeamRosterActionsAvailable ? " is-ready" : " is-locked"}`}>
                        <strong>{selectedTeamRosterActionsAvailable ? "Aktionen aktiv" : "Nur Ansicht"}</strong>
                        <span>{selectedTeamRosterActionHint}</span>
                      </div>
                    ) : null}
                    <div className="team-focus-layout">
                      <div className="table-shell team-focus-table-shell">
                        <table
                          className={`team-table selected-team-roster-table${showTeamDisciplines ? "" : " is-compact"}`}
                        >
                          <colgroup>
                            {visibleSelectedRosterColumns.map((column) => (
                              <col key={column.id} style={{ width: `${getTableColumnWidth("selectedRosterTable", column)}px` }} />
                            ))}
                          </colgroup>
                          <thead>
                            <tr>
                              {visibleSelectedRosterColumns.map((column) => (
                                <th
                                  key={column.id}
                                  {...getTableHeaderDragProps("selectedRosterTable", column, visibleSelectedRosterColumns)}
                                  style={{ width: `${getTableColumnWidth("selectedRosterTable", column)}px`, minWidth: `${column.minWidth}px` }}
                                >
                                  <div className="resizable-header-cell">
                                    {column.id === "image" ? (
                                      <span>Bild</span>
                                    ) : (
                                      <SortableHeader label={column.label} tableId="selectedRoster" columnKey={column.dataKey} sortState={tableSorts.selectedRoster} onToggle={toggleTableSort} />
                                    )}
                                    <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("selectedRosterTable", column, event)} onDoubleClick={() => resetTableColumnWidth("selectedRosterTable", column)} />
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSelectedRosterTableRows.map(({ entry, player, playerOvr, playerMvs, playerPps, ppPow, ppSpe, ppMen, ppSoc, saleBreakdown }) => {
                              const hasPpsBreakdown = [ppPow, ppSpe, ppMen, ppSoc].some((value) => value != null && Number.isFinite(value));
                              const isContractExpiring = entry.contractLength <= 1;
                              return (
                              <Fragment key={entry.id}>
                              <tr
                                className={entry.contractLength <= 1 ? "is-contract-expiring" : undefined}
                                onClick={() => void openPlayerDrawerById(player.id, entry.id)}
                              >
                                {visibleSelectedRosterColumns.map((column) => {
                                  if (column.id === "image") {
                                    const portrait = getPlayerPortraitModel(player);
                                    const imageSize = getResponsiveTableImageSize(
                                      getTableColumnWidth("selectedRosterTable", column),
                                    );
                                    return (
                                      <td key={column.id}>
                                        <PlayerPortrait
                                          src={portrait.src}
                                          initials={portrait.initials}
                                          alt={player.name}
                                          className="transfermarkt-portrait"
                                          style={{ width: imageSize, height: imageSize }}
                                          {...TEAM_ROSTER_PORTRAIT_LOADING}
                                        />
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
                                              openPlayerDrawerById(player.id, entry.id);
                                            }}
                                          >
                                            {player.name}
                                          </button>
                                          <span>{entry.roleTag}</span>
                                          {selectedTeamRosterActionsAvailable ? (
                                            <div className="transfermarkt-inline-actions">
                                              <button
                                                className="secondary-button inline-button"
                                                type="button"
                                                disabled={marketSellBusy}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  void openMarketSellModal({
                                                    activePlayerId: entry.id,
                                                    playerId: player.id,
                                                    playerName: player.name,
                                                    className: player.className,
                                                    race: player.race,
                                                    portraitUrl: getPlayerPortraitModel(player).src,
                                                  }, selectedTeam?.teamId);
                                                }}
                                              >
                                                Verkaufen
                                              </button>
                                              {isContractExpiring && selectedTeam ? (
                                                <button
                                                  className="secondary-button inline-button"
                                                  type="button"
                                                  disabled={contractRenewalBusy != null}
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    void openContractRenewalNegotiation({
                                                      teamId: selectedTeam.teamId,
                                                      playerId: player.id,
                                                      playerName: player.name,
                                                      contractLength: 2,
                                                    });
                                                  }}
                                                >
                                                  Verlängern
                                                </button>
                                              ) : null}
                                            </div>
                                          ) : null}
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "class") {
                                    return (
                                      <td key={column.id}>
                                        <ClassIcon classNameValue={player.className} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
                                      </td>
                                    );
                                  }
                                  if (column.id === "race") {
                                    return (
                                      <td key={column.id}>
                                        <RaceIcon race={player.race} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
                                      </td>
                                    );
                                  }
                                  if (column.id === "mw") {
                                    const marketValue = getRosterEntryDisplayMarketValue(entry, player);
                                    const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
                                    return (
                                      <td key={column.id}>
                                        <div className="economy-money-stack">
                                          <strong>{formatLocalePoints(marketValue, 1)}</strong>
                                          {marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01 ? (
                                            <small className={marketValueDelta >= 0 ? "text-positive" : "text-negative"}>
                                              {formatSignedDisplayMoney(marketValueDelta)}
                                            </small>
                                          ) : null}
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "salePrice") {
                                    return (
                                      <td key={column.id}>
                                        <div className="selected-roster-sale-cell">
                                          <strong>{saleBreakdown.salePrice != null ? formatTransfermarktCurrency(saleBreakdown.salePrice) : "—"}</strong>
                                          <small className="muted">
                                            {saleBreakdown.bracket != null ? `Bracket ${saleBreakdown.bracket}` : "kein Bracket"}
                                          </small>
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "saleFactor") {
                                    return (
                                      <td key={column.id}>
                                        <div className="selected-roster-sale-cell">
                                          <strong>{saleBreakdown.saleFactor != null ? `${formatLocalePoints(saleBreakdown.saleFactor, 2)}x` : "—"}</strong>
                                          <small className="muted">
                                            {saleBreakdown.rankInBracket != null && saleBreakdown.bracketGroupSize > 0
                                              ? `${saleBreakdown.rankInBracket}/${saleBreakdown.bracketGroupSize} MVS`
                                              : "MVS offen"}
                                          </small>
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "salary") {
                                    const currentSalary = getRosterEntryDisplaySalary(entry, player);
                                    const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
                                    return (
                                      <td key={column.id}>
                                        <div className="economy-money-stack">
                                          <strong>{formatDisplayMoney(currentSalary)}</strong>
                                          {salaryDelta != null && Math.abs(salaryDelta) >= 0.01 ? (
                                            <small className={salaryDelta <= 0 ? "text-positive" : "text-negative"}>
                                              {formatSignedDisplayMoney(salaryDelta)}
                                            </small>
                                          ) : null}
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "value") {
                                    const currentSalary = getRosterEntryDisplaySalary(entry, player);
                                    const valueScore =
                                      playerPps != null && currentSalary != null && currentSalary > 0
                                        ? playerPps / currentSalary
                                        : null;
                                    return <td key={column.id}>{valueScore != null ? formatLocalePoints(valueScore, 2) : "—"}</td>;
                                  }
                                  if (column.id === "contract") return <td key={column.id}>{entry.contractLength}</td>;
                                  if (column.id === "ovr") return <td key={column.id}>{renderMetricBar(playerOvr, { tone: "ovr", pool: leaguePlayerHeatPools.ovr, fallbackMax: 100, format: (value) => formatWholeNumber(value) })}</td>;
                                  if (column.id === "mvs") return <td key={column.id}>{renderMetricBar(playerMvs, { tone: "mvs", pool: leaguePlayerHeatPools.mvs, fallbackMax: 40, format: (value) => formatPpsValue(value) })}</td>;
                                  if (column.id === "pps") {
                                    return (
                                      <td key={column.id}>
                                        <div className="selected-roster-pps-cell">
                                          <button
                                            className={`selected-roster-pps-trigger${showSelectedRosterPpsBreakdown ? " is-open" : ""}`}
                                            type="button"
                                            aria-expanded={showSelectedRosterPpsBreakdown}
                                            disabled={!hasPpsBreakdown}
                                            onClick={() => setShowSelectedRosterPpsBreakdown((current) => !current)}
                                          >
                                            {renderMetricBar(playerPps, {
                                              tone: "pps",
                                              pool: leaguePlayerHeatPools.pps,
                                              fallbackMax: 120,
                                              format: (value) => formatPpsValue(value),
                                            })}
                                            <span className="selected-roster-pps-trigger-label">
                                              {hasPpsBreakdown
                                                ? showSelectedRosterPpsBreakdown
                                                  ? "Bereiche ausblenden"
                                                  : "Bereiche anzeigen"
                                                : "Keine Bereichs-PPs"}
                                            </span>
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "ppPow") return <td key={column.id}>{renderMetricBar(ppPow, { tone: "pow", pool: leaguePlayerHeatPools.pps, fallbackMax: 40, format: (value) => formatPpsValue(value) })}</td>;
                                  if (column.id === "ppSpe") return <td key={column.id}>{renderMetricBar(ppSpe, { tone: "spe", pool: leaguePlayerHeatPools.pps, fallbackMax: 40, format: (value) => formatPpsValue(value) })}</td>;
                                  if (column.id === "ppMen") return <td key={column.id}>{renderMetricBar(ppMen, { tone: "men", pool: leaguePlayerHeatPools.pps, fallbackMax: 40, format: (value) => formatPpsValue(value) })}</td>;
                                  if (column.id === "ppSoc") return <td key={column.id}>{renderMetricBar(ppSoc, { tone: "soc", pool: leaguePlayerHeatPools.pps, fallbackMax: 40, format: (value) => formatPpsValue(value) })}</td>;
                                  if (column.id === "pow") return <td key={column.id}>{renderMetricBar(player.coreStats.pow, { tone: "pow", pool: leaguePlayerHeatPools.pow, fallbackMax: 100, format: (value) => formatWholeNumber(value) })}</td>;
                                  if (column.id === "spe") return <td key={column.id}>{renderMetricBar(player.coreStats.spe, { tone: "spe", pool: leaguePlayerHeatPools.spe, fallbackMax: 100, format: (value) => formatWholeNumber(value) })}</td>;
                                  if (column.id === "men") return <td key={column.id}>{renderMetricBar(player.coreStats.men, { tone: "men", pool: leaguePlayerHeatPools.men, fallbackMax: 100, format: (value) => formatWholeNumber(value) })}</td>;
                                  if (column.id === "soc") return <td key={column.id}>{renderMetricBar(player.coreStats.soc, { tone: "soc", pool: leaguePlayerHeatPools.soc, fallbackMax: 100, format: (value) => formatWholeNumber(value) })}</td>;
                                  return <td key={column.id} className={getPoolHeatClass(player.disciplineRatings[column.id] ?? null, leaguePlayerHeatPools.disciplines[column.id] ?? [])}>{(player.disciplineRatings[column.id] ?? 0).toFixed(0)}</td>;
                                })}
                              </tr>
                              </Fragment>
                            )})}
                          </tbody>
                        </table>
                      </div>
                      <div className="team-focus-footer">
                        <div className="team-focus-footer-stats">
                          <article>
                            <span>Kaderstatus</span>
                            <strong>
                              {filteredSelectedRosterTableRows.length} / {selectedStandingRow?.rosterCount ?? selectedRoster.length} Spieler · Ø LZ{" "}
                              {selectedStandingRow?.avgContractLength != null
                                ? formatLocalePoints(selectedStandingRow.avgContractLength, 1)
                                : "—"}
                            </strong>
                          </article>
                          <article>
                            <span>Spielerwerte</span>
                            <strong>OVR und PPs nur pro Spieler, nicht als Teamwert</strong>
                          </article>
                        </div>
                        <div className="team-focus-footer-actions">
                          <span className="muted">
                            {showTeamDisciplines
                              ? `20 Diszis sichtbar · Teamranks in Ranks und Diszis-Konfiguration unten`
                              : "Diszi-Spalten aktuell ausgeblendet"}
                          </span>
                          <div className="team-detail-actions">
                            <button
                              className="secondary-button inline-button"
                              type="button"
                              onClick={() => setShowTeamDisciplines((current) => !current)}
                              title={showTeamDisciplines ? "Diszi-Spalten ausblenden" : "Diszi-Spalten einblenden"}
                            >
                              Diszis
                            </button>
                            <button
                              className="secondary-button inline-button"
                              type="button"
                              onClick={() => setShowExtendedTeamPanels((current) => !current)}
                              title={showExtendedTeamPanels ? "Zusatzpanels ausblenden" : "Zusatzpanels einblenden"}
                            >
                              Panels
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="team-focus-layout">
                    <div className="team-focus-summary">
                      <article className="metric-card">
                        <span>Aktive Verträge</span>
                        <strong>{selectedRoster.length}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Preview-Drafts</span>
                        <strong>
                          {selectedTeamContractPreviewRowCount}
                        </strong>
                      </article>
                      <article className="metric-card">
                        <span>Altverträge</span>
                        <strong>V1 = Balanced</strong>
                      </article>
                      <article className="metric-card">
                        <span>Buyout-Regel</span>
                        <strong>Restgehalt komplett</strong>
                      </article>
                    </div>
                    {contractRenewalMessage ? (
                      <div className="status-banner is-success">{contractRenewalMessage}</div>
                    ) : null}
                    {contractRenewalError ? (
                      <div className="status-banner is-warning">{contractRenewalError}</div>
                    ) : null}
                    {contractRenewalNegotiation ? (
                      <div className="status-banner is-info">
                        <strong>Verhandlung: {contractRenewalNegotiation.playerName}</strong>
                        <p className="muted">
                          Erwartung {contractRenewalNegotiation.expectedSalary != null ? formatTransfermarktCurrency(contractRenewalNegotiation.expectedSalary) : "—"}
                        </p>
                        <label className="stack gap-xs">
                          <span>Angebot p.a.</span>
                          <input
                            type="number"
                            value={contractRenewalNegotiation.offeredSalary ?? ""}
                            onChange={(event) =>
                              setContractRenewalNegotiation((current) =>
                                current
                                  ? {
                                      ...current,
                                      offeredSalary: event.target.value === "" ? null : Number(event.target.value),
                                    }
                                  : current,
                              )
                            }
                          />
                        </label>
                        <div className="transfermarkt-inline-actions">
                          <button type="button" className="primary-button inline-button" onClick={() => void confirmContractRenewalNegotiation()}>
                            Vertrag bestätigen
                          </button>
                          <button type="button" className="secondary-button inline-button" onClick={() => setContractRenewalNegotiation(null)}>
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {selectedTeamRosterActionHint ? (
                      <div className={`team-roster-action-status${selectedTeamRosterActionsAvailable ? " is-ready" : " is-locked"}`}>
                        <strong>{selectedTeamRosterActionsAvailable ? "Aktionen aktiv" : "Nur Ansicht"}</strong>
                        <span>{selectedTeamRosterActionHint}</span>
                      </div>
                    ) : null}
	                    <div className="transfer-callout">
	                      <strong>Contract Exit Value</strong>
	                      <span>Wenn ein Vertrag ausläuft oder ein Spieler freigegeben wird, erhält das Team den aktuellen VK-Wert.</span>
	                    </div>
                    {selectedTeamContractShapeMix ? (
                      <div className="team-contract-mix-panel">
                        <div className="team-contract-mix-head">
                          <div>
                            <strong>Vertragsmix</strong>
                            <span className="muted">Anteil und Cashflow-Verschiebung gegen gleiche Gesamtgehälter als Balanced.</span>
                          </div>
                          <div className="team-contract-mix-summary">
                            <span>
                              {selectedTeamContractShapeMix.totalCount > 0
                                ? `${selectedTeamContractShapeMix.nonBalancedCount}/${selectedTeamContractShapeMix.totalCount} strukturiert`
                                : "keine aktiven Verträge"}
                            </span>
                            <strong className={selectedTeamContractShapeMix.currentDelta > 0 ? "negative-value" : selectedTeamContractShapeMix.currentDelta < 0 ? "positive-value" : undefined}>
                              Jetzt {formatSignedDisplayMoney(selectedTeamContractShapeMix.currentDelta)}
                            </strong>
                            <small className={selectedTeamContractShapeMix.futureDelta > 0 ? "negative-value" : selectedTeamContractShapeMix.futureDelta < 0 ? "positive-value" : "muted"}>
                              Später {formatSignedDisplayMoney(selectedTeamContractShapeMix.futureDelta)}
                            </small>
                          </div>
                        </div>
                        <div className="team-contract-mix-grid">
                          {selectedTeamContractShapeMix.entries.map((entry) => (
                            <article className={`team-contract-mix-card is-${entry.shape.replace("_", "-")}`} key={entry.shape}>
                              <div className="team-contract-mix-card-head">
                                <span>{entry.label}</span>
                                <strong>{formatLocalePoints(entry.share, 0)}%</strong>
                              </div>
                              <div className="team-contract-mix-bar" aria-hidden="true">
                                <span style={{ width: entry.share > 0 ? `${Math.max(3, entry.share)}%` : "0%" }} />
                              </div>
                              <div className="team-contract-mix-metrics">
                                <span>
                                  <strong>{entry.count}</strong> Verträge
                                </span>
                                <span>
                                  <strong>{formatDisplayMoney(entry.totalSalary)}</strong> gebunden
                                </span>
                                <span className={entry.currentDelta > 0 ? "negative-value" : entry.currentDelta < 0 ? "positive-value" : undefined}>
                                  Jetzt {formatSignedDisplayMoney(entry.currentDelta)}
                                </span>
                                <span className={entry.futureDelta > 0 ? "negative-value" : entry.futureDelta < 0 ? "positive-value" : "muted"}>
                                  Später {formatSignedDisplayMoney(entry.futureDelta)}
                                </span>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}
	                    {selectedTeamContractTable ? (
	                      <div className="contract-forecast-panel">
                        <div className="transfer-callout-title">
                          <strong>5-Seasons Gehaltsforecast</strong>
                          <span className="muted">NBA-Style: gebundene Gehälter je Season</span>
                        </div>
                        <div className="contract-forecast-grid">
                          {selectedTeamContractTable.totalsCommitted.map((entry, index) => {
                            const preview = selectedTeamContractTable.totalsWithPreview[index];
                            return (
                              <article className="contract-forecast-card" key={entry.label}>
                                <span>{entry.label}</span>
                                <strong>{formatDisplayMoney(entry.salary)}</strong>
                                <small className="muted">
                                  mit Preview {preview ? formatDisplayMoney(preview.salary) : "—"}
                                </small>
                              </article>
                            );
                          })}
                        </div>
	                      </div>
	                    ) : null}
	                    {selectedTeamContractPreviewRowCount > 0 ? (
	                      <div className="team-detail-actions">
	                        <button
	                          className={`secondary-button inline-button${showTeamContractPreviewRows ? " is-active" : ""}`}
	                          type="button"
	                          onClick={() => setShowTeamContractPreviewRows((current) => !current)}
	                          title={showTeamContractPreviewRows ? "Preview-Zeilen ausblenden" : "Preview-Zeilen einblenden"}
	                        >
	                          Preview {showTeamContractPreviewRows ? "an" : "aus"} · {selectedTeamContractPreviewRowCount}
	                        </button>
	                      </div>
	                    ) : null}
	                    <div className="table-shell team-focus-table-shell">
	                      <table className="team-table team-contracts-table">
	                        <thead>
                          <tr>
                            <th>Spieler</th>
                            <th>Status</th>
                            <th>Form</th>
	                            <th>LZ</th>
	                            <th>Moral</th>
	                            <th>Intent</th>
	                            <th>Buyout</th>
	                            <th>MW</th>
	                            <th>Faktor</th>
	                            <th>VK bei Abgang</th>
	                            {selectedTeamContractTable?.seasonLabels.map((label) => (
	                              <th key={label}>{label}</th>
	                            ))}
                          </tr>
                        </thead>
                        <tbody>
	                          {visibleSelectedTeamContractRows.length ? (
	                            visibleSelectedTeamContractRows.map((row) => {
                              const isSellMarked =
                                row.status === "active" &&
                                selectedTeam != null &&
                                transferSellMarkerKeySet.has(`${selectedTeam.teamId}:${row.playerId}`);
                              return (
                              <tr key={row.rowId} onClick={() => void openPlayerDrawerById(row.playerId)}>
                                <td>
                                  <div className="table-player-cell">
                                    <strong>{row.playerName}</strong>
                                    <span>{row.roleTag ?? "—"}</span>
                                    {isSellMarked ? <span className="pill pill-warning">VK vorgemerkt</span> : null}
                                    {row.status === "active" && selectedTeamRosterActionsAvailable ? (
                                      <div className="transfermarkt-inline-actions">
                                        {selectedTeam ? (
                                          <button
                                            className="secondary-button inline-button"
                                            type="button"
                                            onClick={() =>
                                              toggleTransferSellMarker({
                                                teamId: selectedTeam.teamId,
                                                playerId: row.playerId,
                                                playerName: row.playerName,
                                                contractLength: row.contractLength,
                                                buyoutCost: row.buyoutCost,
                                                marketValueAtExit: row.marketValueAtExit,
                                                morale: row.morale,
                                              })
                                            }
                                          >
                                            {isSellMarked ? "VK gemerkt" : "VK vormerken"}
                                          </button>
                                        ) : null}
                                        <button
                                          className="secondary-button inline-button"
                                          type="button"
                                          disabled={marketSellBusy}
                                          onClick={() =>
                                            void openMarketSellModal(
                                              {
                                                activePlayerId: row.rowId,
                                                playerId: row.playerId,
                                                playerName: row.playerName,
                                                className:
                                                  gameState.players.find((candidate) => candidate.id === row.playerId)?.className ?? "—",
                                                race:
                                                  gameState.players.find((candidate) => candidate.id === row.playerId)?.race ?? "—",
                                                portraitUrl:
                                                  gameState.players.find((candidate) => candidate.id === row.playerId)?.portraitUrl ?? null,
                                              },
                                              selectedTeam?.teamId,
                                            )
                                          }
                                        >
                                          Verkaufen
                                        </button>
                                        {row.contractLength <= 1 && selectedTeam ? (
                                          <button
                                            className="secondary-button inline-button"
                                            type="button"
                                            disabled={contractRenewalBusy != null}
                                            onClick={() =>
                                              void openContractRenewalNegotiation({
                                                teamId: selectedTeam.teamId,
                                                playerId: row.playerId,
                                                playerName: row.playerName,
                                              })
                                            }
                                          >
                                            Verlängern
                                          </button>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                                <td>{row.status === "preview" ? "Preview" : "Aktiv"}</td>
                                <td>{formatContractShapeLabel(row.contractShape)}</td>
	                                <td>{formatWholeNumber(row.contractLength)}</td>
	                                <td>
	                                  {row.morale != null ? (
	                                    <span title={row.moraleMood ?? "Moral"}>
	                                      {row.moraleSmiley ?? ""} {formatWholeNumber(row.morale)}
	                                      {row.moraleSalaryModifier != null ? ` · x${formatLocalePoints(row.moraleSalaryModifier, 2)}` : ""}
	                                    </span>
	                                  ) : (
	                                    "—"
	                                  )}
	                                </td>
	                                <td>
	                                  {row.moraleContractIntent ? (
	                                    <span title={row.moraleRenewalRisk != null ? `Renewal Risk ${formatWholeNumber(row.moraleRenewalRisk)}%` : undefined}>
	                                      {formatMoraleContractIntentLabel(row.moraleContractIntent)}
	                                    </span>
	                                  ) : (
	                                    "—"
	                                  )}
	                                </td>
	                                <td>{row.buyoutCost != null ? formatDisplayMoney(row.buyoutCost) : "—"}</td>
	                                <td>{row.marketValueAtExit != null ? formatDisplayMoney(row.marketValueAtExit) : "—"}</td>
	                                <td>{row.saleFactor != null ? `${formatLocalePoints(row.saleFactor, 2)}x` : "—"}</td>
	                                <td>{row.exitValue != null ? formatDisplayMoney(row.exitValue) : "—"}</td>
	                                {selectedTeamContractTable?.seasonLabels.map((label, index) => (
	                                  <td key={`${row.rowId}-${label}`}>
                                    {row.yearlySalarySchedule[index]?.salary != null
                                      ? formatDisplayMoney(row.yearlySalarySchedule[index]!.salary)
                                      : "—"}
                                  </td>
                                )) ?? null}
                              </tr>
                            )})
	                          ) : (
	                            <tr>
	                              <td colSpan={10 + (selectedTeamContractTable?.seasonLabels.length ?? 0)} className="muted">
	                                {selectedTeamContractTable?.rows.length
	                                  ? "Aktuell sind nur Preview-Zeilen vorhanden. Schalte Preview ein, um sie zu sehen."
	                                  : "Noch keine Vertragsdaten im aktuellen Scope."}
	                              </td>
	                            </tr>
	                          )}
                        </tbody>
	                        {selectedTeamContractTable ? (
	                          <tfoot>
	                            <tr>
	                              <td colSpan={10}><strong>Summe aktiv</strong></td>
                              {selectedTeamContractTable.totalsCommitted.map((entry) => (
                                <td key={`committed-${entry.label}`}><strong>{formatDisplayMoney(entry.salary)}</strong></td>
                              ))}
                            </tr>
                            <tr>
                              <td colSpan={10}><strong>Summe mit Preview</strong></td>
                              {selectedTeamContractTable.totalsWithPreview.map((entry) => (
                                <td key={`preview-${entry.label}`}><strong>{formatDisplayMoney(entry.salary)}</strong></td>
                              ))}
                            </tr>
                          </tfoot>
                        ) : null}
                      </table>
                    </div>
                    <div className="team-focus-footer">
                      <div className="team-focus-footer-stats">
                        <article>
                          <span>Vertragslogik</span>
                          <strong>Bestehende aktive Verträge werden in V1 als balanced gelesen.</strong>
                        </article>
                        <article>
                          <span>Buyout-Hinweis</span>
                          <strong>Buyout zahlt das komplette Restgehalt.</strong>
                        </article>
                      </div>
                      <div className="team-focus-footer-actions">
                        <span className="muted">
                          Preview-Drafts kommen nur aus dem Kaufdialog und schreiben in diesem Block keinen echten Roster-Vertrag.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {showExtendedTeamPanels ? (
              <div className={`foundation-main-grid${getViewClass("teams")}`}>
                <section className="panel">
                  <div className="panel-header">
                    <h2>Starter</h2>
                  </div>
                  <div className="roster-grid">
                    {starters.map(({ entry, player }) => {
                      const portrait = getPlayerPortraitModel(player);
                      return (
                      <article
                        className={`player-card player-card-spotlight ${getClassColorClassName(player.className, "player-card-class-frame")}`}
                        key={entry.id}
                        onClick={() => void openPlayerDrawerById(player.id, entry.id)}
                        title="Spielerprofil öffnen"
                      >
                        <div className="player-card-hero">
                          <PlayerPortrait
                            src={portrait.src}
                            initials={portrait.initials}
                            alt={player.name}
                            className="player-card-portrait player-avatar-fallback"
                            {...TEAM_ROSTER_PORTRAIT_LOADING}
                          />
                          <div className="player-card-head">
                            <div>
                            <strong>{player.name}</strong>
                            <p className="muted">
                              <ClassIcon classNameValue={player.className} className="class-icon-chip-inline" /> · <RaceIcon race={player.race} className="race-icon-chip-inline" />
                            </p>
                            </div>
                            <span className="rating-pill">{formatWholeNumber(playerRatingsById.get(player.id)?.ovrNormalized ?? null)}</span>
                          </div>
                        </div>
                        <div className="axis-row">
                          <span>POW {formatWholeNumber(player.coreStats.pow)}</span>
                          <span>SPE {formatWholeNumber(player.coreStats.spe)}</span>
                          <span>MEN {formatWholeNumber(player.coreStats.men)}</span>
                          <span>SOC {formatWholeNumber(player.coreStats.soc)}</span>
                        </div>
                        <p className="muted">
                          OVR {formatWholeNumber(playerRatingsById.get(player.id)?.ovrNormalized ?? null)} · MVS{" "}
                          {playerRatingsById.get(player.id)?.mvs != null ? formatPpsValue(playerRatingsById.get(player.id)?.mvs ?? null) : "—"} · PPs{" "}
                          {playerRatingsById.get(player.id)?.ppsSeason != null ? formatPpsValue(playerRatingsById.get(player.id)?.ppsSeason ?? null) : "—"} · MW
                        </p>
                        <div className="economy-money-stack">
                          <strong>{formatLocalePoints(getRosterEntryDisplayMarketValue(entry, player), 2)}</strong>
                          {renderEconomyDelta(getPlayerDisplayMarketValueDelta(player, entry, gameState), "higher", "player-card-money-delta")}
                        </div>
                        <p className="muted">
                          Kosten {formatMoney(player.cost ?? player.marketValue)} · Gehalt
                        </p>
                        <div className="economy-money-stack">
                          <strong>{formatDisplayMoney(getRosterEntryDisplaySalary(entry, player))}</strong>
                          {renderEconomyDelta(getRosterEntrySalaryDelta(entry, player, gameState), "lower", "player-card-money-delta")}
                        </div>
                        <p className="muted">
                          Traits {player.traitsPositive.slice(0, 2).join(", ") || "-"} · Alignment{" "}
                          {player.alignment || "-"}
                        </p>
                      </article>
                      );
                    })}
                    {starters.length === 0 ? <p className="muted">Noch keine Starter im Kader.</p> : null}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>Bench & Prospects</h2>
                  </div>
                  <div className="roster-grid">
                    {bench.map(({ entry, player }) => (
                      <article
                        className={`player-card compact player-card-spotlight ${getClassColorClassName(player.className, "player-card-class-frame")}`}
                        key={entry.id}
                        onClick={() => void openPlayerDrawerById(player.id, entry.id)}
                        title="Spielerprofil öffnen"
                      >
                        <div className="player-card-hero">
                          <PlayerPortrait
                            src={getPlayerPortraitModel(player).src}
                            initials={getPlayerPortraitModel(player).initials}
                            alt={player.name}
                            className="player-card-portrait player-avatar-fallback"
                          />
                          <div className="player-card-head">
                            <div>
                            <strong>{player.name}</strong>
                            <p className="muted">
                              {entry.roleTag} · <ClassColorChip className={player.className} /> · <RaceIcon race={player.race} className="race-icon-chip-inline" />
                            </p>
                            </div>
                            <span className="rating-pill">{formatWholeNumber(playerRatingsById.get(player.id)?.ovrNormalized ?? null)}</span>
                          </div>
                        </div>
                        <div className="axis-row">
                          <span>POW {formatWholeNumber(player.coreStats.pow)}</span>
                          <span>SPE {formatWholeNumber(player.coreStats.spe)}</span>
                          <span>MEN {formatWholeNumber(player.coreStats.men)}</span>
                          <span>SOC {formatWholeNumber(player.coreStats.soc)}</span>
                        </div>
                        <p className="muted">
                          OVR {formatWholeNumber(playerRatingsById.get(player.id)?.ovrNormalized ?? null)} · MVS{" "}
                          {playerRatingsById.get(player.id)?.mvs != null ? formatPpsValue(playerRatingsById.get(player.id)?.mvs ?? null) : "—"} · PPs{" "}
                          {playerRatingsById.get(player.id)?.ppsSeason != null ? formatPpsValue(playerRatingsById.get(player.id)?.ppsSeason ?? null) : "—"} · MW
                        </p>
                        <div className="economy-money-stack">
                          <strong>{formatLocalePoints(getRosterEntryDisplayMarketValue(entry, player), 2)}</strong>
                          {renderEconomyDelta(getPlayerDisplayMarketValueDelta(player, entry, gameState), "higher", "player-card-money-delta")}
                        </div>
                        <p className="muted">Gehalt · LZ {entry.contractLength}</p>
                        <div className="economy-money-stack">
                          <strong>{formatDisplayMoney(getRosterEntryDisplaySalary(entry, player))}</strong>
                          {renderEconomyDelta(getRosterEntrySalaryDelta(entry, player, gameState), "lower", "player-card-money-delta")}
                        </div>
                      </article>
                    ))}
                    {bench.length === 0 ? <p className="muted">Keine Bench-Spieler im Moment.</p> : null}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>Team Identity</h2>
                  </div>
                  {selectedIdentity ? (
                    <div className="identity-grid">
                      <article className="identity-card">
                        <span>Zielachsen</span>
                        <strong>
                          {selectedIdentity.pow}/{selectedIdentity.spe}/{selectedIdentity.men}/{selectedIdentity.soc}
                        </strong>
                      </article>
                      <article className="identity-card">
                        <span>Ambition / Finanzen</span>
                        <strong>
                          {selectedIdentity.ambition} / {selectedIdentity.finances}
                        </strong>
                      </article>
                      <article className="identity-card">
                        <span>Board / Harmony</span>
                        <strong>
                          {selectedIdentity.boardConfidence} / {selectedIdentity.harmony}
                        </strong>
                      </article>
                      <article className="identity-card">
                        <span>Manners / Coop</span>
                        <strong>
                          {selectedIdentity.manners} / {selectedIdentity.cooperation}
                        </strong>
                      </article>
                      <article className="identity-card">
                        <span>Popularity</span>
                        <strong>{selectedIdentity.popularity}</strong>
                      </article>
                      <article className="identity-card">
                        <span>Kaderziel</span>
                        <strong>
                          {selectedIdentity.playerMin} - {selectedIdentity.playerOpt}
                        </strong>
                      </article>
                    </div>
                  ) : (
                    <p className="muted">Fuer dieses Team liegt noch keine Identity vor.</p>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>Freie Spieler</h2>
                  </div>
                  <div className="free-agent-list">
                    {freeAgents.map((player) => (
                      <article className="free-agent-card" key={player.id}>
                        <div>
                          <strong>{player.name}</strong>
                            <p className="muted">
                              <ClassColorChip className={player.className} /> ·{" "}
                              {player.preferredDisciplineIds.length ? (
                                player.preferredDisciplineIds.slice(0, 2).map((disciplineId, index) => (
                                  <span key={`${player.id}-pref-diszi-${disciplineId}`} style={{ display: "inline-flex", alignItems: "center" }}>
                                    {index > 0 ? " · " : ""}
                                    <DisciplineIcon disciplineId={disciplineId} label={disciplineId} className="discipline-icon-chip-inline" />
                                  </span>
                                ))
                              ) : (
                                "Allround"
                              )}
                            </p>
                        </div>
                        <div className="free-agent-stats">
                          <span>{formatWholeNumber(playerRatingsById.get(player.id)?.ovrNormalized ?? null)}</span>
                          <span>{formatLocalePoints(getPlayerDisplaySalary(player), 2)}</span>
                        </div>
                      </article>
                    ))}
                    {freeAgents.length === 0 ? <p className="muted">Keine freien Spieler gefunden.</p> : null}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>AI Preview</h2>
                  </div>
                  {aiPreview ? (
                    <div className="stack">
                      <p>{aiPreview.summary}</p>
                      <div className="metric-grid compact">
                        <article className="metric-card">
                          <span>Need Score</span>
                          <strong>{aiPreview.needs.overallNeedScore.toFixed(2)}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Roster Gap</span>
                          <strong>{aiPreview.needs.rosterGap.toFixed(2)}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Budget Pressure</span>
                          <strong>{aiPreview.needs.budgetPressure.toFixed(2)}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Upkeep Pressure</span>
                          <strong>{aiPreview.needs.upkeepPressure.toFixed(2)}</strong>
                        </article>
                      </div>
                      <p className="muted">
                        Groesste Luecken: {aiPreview.needs.uncoveredNeedAxes.join(", ") || "keine groesseren Luecken"}
                      </p>
                      <p className="muted">
                        Priorisierte Disziplinen: {aiPreview.needs.topNeedDisciplineIds.join(", ") || "noch offen"}
                      </p>
                      <button
                        className="primary-button inline-button"
                        disabled={isPending || !selectedAiTeamId || isReadOnlyMode}
                        type="button"
                        onClick={() => {
                          if (isReadOnlyMode) {
                            showReadOnlyNotice();
                            return;
                          }

                          if (!selectedAiTeamId) {
                            return;
                          }

                          startTransition(() => {
                            setGameState((current) => {
                              const result = runAiTurn(current, selectedAiTeamId);
                              return {
                                ...current,
                                logs: [
                                  ...current.logs,
                                  {
                                    id: `ui-ai-${Date.now()}`,
                                    type: "ai",
                                    message: result.summary,
                                    createdAt: new Date().toISOString(),
                                  },
                                ],
                              };
                            });
                          });
                        }}
                      >
                        {isPending ? "AI arbeitet..." : "AI Turn simulieren"}
                      </button>
                    </div>
                  ) : (
                    <p className="muted">Kein KI-Team fuer eine Vorschau verfuegbar.</p>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>Transfermarkt-Tendenz</h2>
                  </div>
                  <ul className="debug-list">
                    {aiMarketPreview.slice(0, 6).map((intent) => (
                      <li key={intent.listingId}>
                        {intent.listingId} · {intent.action} · {intent.score.toFixed(2)}
                      </li>
                    ))}
                    {aiMarketPreview.length === 0 ? <li>Noch keine verwertbaren Marktimpulse.</li> : null}
                  </ul>
                </section>
              </div>
              ) : null}
            </>
    </div>
  );
}
