// @ts-nocheck
"use client";

import { Fragment, memo, startTransition, useEffect, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";

import ClassColorChip, { getClassColorClassName } from "@/app/foundation/ClassColorChip";
import ClassIcon from "@/app/foundation/ClassIcon";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import RaceIcon from "@/app/foundation/RaceIcon";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import FoundationPlayerPortraitPreview from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
import { formatContractShapeShortLabel, rosterSalariesDifferForDisplay } from "@/lib/foundation/player-economy-contract";
import { formatPlayerIdentitySubMeta } from "@/lib/foundation/player-identity-meta";
import TeamDrawerHistoryTable from "@/components/foundation/team-drawer/TeamDrawerHistoryTable";
import { isSeasonDisciplineKey } from "@/lib/season/season-discipline-area-groups";
import { TEAM_BOARD_PRESSURE_TOOLTIP, TEAM_BOARD_RATING_TOOLTIP } from "@/lib/foundation/team-board-tooltips";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";

const TEAM_ROSTER_PORTRAIT_LOADING = {
  loading: "lazy",
  fetchPriority: "auto",
} as const;

/** League-table logos beyond the selected row load after shell paint (+200 ms idle). */
const TEAMS_INITIAL_VISIBLE_LOGO_ROWS = 10;
const TEAMS_DEFERRED_LOGO_IDLE_MS = 200;

const FoundationTeamsPortraitsTab = dynamic(() => import("./FoundationTeamsPortraitsTab"), {
  ssr: false,
  loading: () => <p className="muted team-portraits-loading">Portraits werden geladen…</p>,
});

const FoundationPlayerPortraitCard = dynamic(
  () => import("@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard"),
  { ssr: false },
);

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
  teamsHydrationPhase?: "shell" | "full";
  gameState: unknown;
  selectedTeam: unknown;
  sortedTeamsViewRows: unknown;
  visibleTeamsViewColumns: unknown;
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
  selectedTeamDetailTab: "roster" | "contracts" | "portraits" | "transfer";
  teamRosterRoleFilter: unknown;
  setTeamRosterRoleFilter: unknown;
  teamRosterFocusMode: unknown;
  setTeamRosterFocusMode: unknown;
  sortedSelectedRosterTableRows: unknown;
  filteredSelectedRosterTableRows: unknown;
  selectedStandingRow: unknown;
  selectedRoster: unknown;
  visibleSelectedRosterColumns: unknown;
  selectedTeamContractTable: unknown;
  selectedTeamContractPreviewRowCount: unknown;
  visibleSelectedTeamContractRows: unknown;
  showTeamContractPreviewRows: unknown;
  setShowTeamContractPreviewRows: unknown;
  contractRenewalBusy: unknown;
  marketSellBusy?: boolean;
  openContractRenewalNegotiation: unknown;
  openMarketSellModal: unknown;
  openPlayerDrawerById: unknown;
  playerRatingsById: Map<string, PlayerRatingContractRow>;
  getPlayerPortraitModel: unknown;
  getClassColorClassName: unknown;
  getRosterEntryDisplaySalary: unknown;
  getRosterEntryCurrentSeasonSalary: unknown;
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
  transferSellMarkerKeySet: unknown;
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
  selectedTeamRosterActionsAvailable: unknown;
  selectedTeamRosterActionHint: unknown;
  contractRenewalMessage: unknown;
  contractRenewalError: unknown;
};

function FoundationTeamsDetailPanel({
  active,
  teamsHydrationPhase = "full",
  gameState,
  selectedTeam,
  sortedTeamsViewRows,
  visibleTeamsViewColumns,
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
  filteredSelectedRosterTableRows,
  selectedStandingRow,
  selectedRoster,
  visibleSelectedRosterColumns,
  selectedTeamContractTable,
  selectedTeamContractPreviewRowCount,
  visibleSelectedTeamContractRows,
  showTeamContractPreviewRows,
  setShowTeamContractPreviewRows,
  contractRenewalBusy,
  marketSellBusy = false,
  openContractRenewalNegotiation,
  openMarketSellModal,
  openPlayerDrawerById,
  playerRatingsById,
  getPlayerPortraitModel,
  getClassColorClassName,
  getRosterEntryDisplaySalary,
  getRosterEntryCurrentSeasonSalary,
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
  transferSellMarkerKeySet,
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
  selectedTeamRosterActionsAvailable,
  selectedTeamRosterActionHint,
  contractRenewalMessage,
  contractRenewalError,
}: FoundationTeamsDetailPanelProps) {
  if (!active) {
    return null;
  }

  const showLeagueLogos = teamsHydrationPhase === "full";
  const showSecondaryPanels = teamsHydrationPhase === "full";
  const [showDeferredTeamLogos, setShowDeferredTeamLogos] = useState(false);

  useEffect(() => {
    if (!showLeagueLogos) {
      setShowDeferredTeamLogos(false);
      return;
    }

    let cancelled = false;
    const finish = () => {
      if (!cancelled) {
        setShowDeferredTeamLogos(true);
      }
    };

    if (typeof globalThis.requestIdleCallback === "function") {
      const idleId = globalThis.requestIdleCallback(finish, { timeout: TEAMS_DEFERRED_LOGO_IDLE_MS });
      return () => {
        cancelled = true;
        globalThis.cancelIdleCallback?.(idleId);
      };
    }

    const timerId = globalThis.setTimeout(finish, TEAMS_DEFERRED_LOGO_IDLE_MS);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timerId);
    };
  }, [showLeagueLogos, selectedTeam?.teamId]);

  const shouldShowTeamRowLogo = (teamId: string, rowIndex: number) =>
    showLeagueLogos &&
    (showDeferredTeamLogos ||
      rowIndex < TEAMS_INITIAL_VISIBLE_LOGO_ROWS ||
      teamId === selectedTeam?.teamId);
  const selectedTeamViewRow = sortedTeamsViewRows.find((row) => row.team?.teamId === selectedTeam?.teamId) ?? null;
  const portraitExpiringCount =
    selectedTeamDetailTab === "portraits"
      ? filteredSelectedRosterTableRows.filter(({ entry }) => entry.contractLength <= 1).length
      : 0;
  const portraitAvgOvr =
    selectedTeamDetailTab === "portraits"
      ? (() => {
          const values = filteredSelectedRosterTableRows
            .map(({ playerOvr }) => playerOvr)
            .filter((value) => value != null && Number.isFinite(value));
          return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        })()
      : null;
  const portraitAvgSalary =
    selectedTeamDetailTab === "portraits"
      ? (() => {
          const values = filteredSelectedRosterTableRows
            .map(({ entry, player }) => getRosterEntryCurrentSeasonSalary(entry, player))
            .filter((value) => value != null && Number.isFinite(value));
          return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        })()
      : null;
  const contractExpiringCount = selectedRoster.filter((entry) => entry.contractLength <= 1).length;

  return (
    <div className="foundation-teams-view-panel" data-testid="foundation-teams-view" data-team-tab={selectedTeamDetailTab}>
            <>
              <section className="panel team-focus-panel teams-primary-roster-panel" id="team-focus-roster">
                <div className="panel-header team-focus-header">
                  <div className="team-focus-title-wrap">
                    {(() => {
                      const logo = getTeamLogoModel(selectedTeam, { variant: "thumb" });
                      return showLeagueLogos && logo.src ? (
                        <BudgetedMediaImage
                          className="team-focus-logo"
                          src={logo.src}
                          alt={`${selectedTeam.name} Logo`}
                          width={72}
                          height={72}
                          loading="eager"
                          fetchPriority="high"
                          fallback={
                            <div className="team-focus-logo team-logo-placeholder" aria-label={`${selectedTeam.name} Logo Platzhalter`}>
                              {logo.initials}
                            </div>
                          }
                        />
                      ) : (
                        <div className="team-focus-logo team-logo-placeholder" aria-label={`${selectedTeam.name} Logo Platzhalter`}>
                          {logo.initials}
                        </div>
                      );
                    })()}
                    <div>
                    <p className="eyebrow">{selectedTeamDetailTab === "portraits" ? "Kaderprofil" : "Team Fokus"}</p>
                    <h2>
                      {selectedTeam.name}
                      {selectedTeamDetailTab === "portraits" ? "" : selectedTeamDetailTab === "contracts" ? " · Verträge" : selectedTeamDetailTab === "transfer" ? " · Transfers" : " · Kader"}
                    </h2>
                    </div>
                  </div>
                  <div className="team-focus-header-actions">
                    {selectedTeamDetailTab === "roster" ? (
                      <button
                        className="secondary-button inline-button"
                        type="button"
                        onClick={() => setShowTeamDisciplines((current) => !current)}
                        title={showTeamDisciplines ? "Diszi-Spalten ausblenden" : "Diszi-Spalten einblenden"}
                      >
                        Diszis
                      </button>
                    ) : (
                      <button
                        className="secondary-button inline-button"
                        type="button"
                        onClick={() => openTeamProfileById(selectedTeam.teamId)}
                      >
                        Profil
                      </button>
                    )}
                  </div>
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
                                    const thumbSrc = showLeagueLogos ? portrait.thumbSrc ?? portrait.src : null;
                                    return (
                                      <td key={column.id}>
                                        <FoundationPlayerPortraitPreview
                                          playerId={player.id}
                                          name={player.name}
                                          portraitUrl={portrait.src}
                                          portraitInitials={portrait.initials}
                                          playerOvr={playerOvr}
                                          playerMvs={playerMvs}
                                          playerPps={playerPps}
                                          pow={player.coreStats.pow ?? null}
                                          spe={player.coreStats.spe ?? null}
                                          men={player.coreStats.men ?? null}
                                          soc={player.coreStats.soc ?? null}
                                          leagueHeatPools={leaguePlayerHeatPools}
                                          variant="team"
                                          context="teamGrid"
                                          roleTag={entry.roleTag}
                                          playerClassName={player.className}
                                        >
                                          {thumbSrc ? (
                                            <img
                                              className="transfermarkt-portrait"
                                              src={thumbSrc}
                                              alt={player.name}
                                              width={imageSize}
                                              height={imageSize}
                                              loading={TEAM_ROSTER_PORTRAIT_LOADING.loading}
                                              decoding="async"
                                              fetchPriority={TEAM_ROSTER_PORTRAIT_LOADING.fetchPriority}
                                              style={{ width: imageSize, minWidth: imageSize }}
                                            />
                                          ) : (
                                            <div
                                              className="transfermarkt-portrait transfermarkt-portrait-placeholder"
                                              aria-label={`${player.name} placeholder`}
                                              style={{ width: imageSize, minWidth: imageSize }}
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
                                      <td key={column.id} className="teams-v2-name-cell is-sticky-actions">
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
                                          <small className="muted table-player-identity">{formatPlayerIdentitySubMeta(player)}</small>
                                          {selectedTeamRosterActionsAvailable ? (
                                            <div className="transfermarkt-inline-actions teams-v2-row-icon-actions">
                                              <button
                                                className="table-icon-button"
                                                type="button"
                                                title="Verkaufen"
                                                aria-label={`${player.name} verkaufen`}
                                                disabled={marketSellBusy}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  void openMarketSellModal({
                                                    activePlayerId: entry.id,
                                                    playerId: player.id,
                                                    playerName: player.name,
                                                    className: player.className,
                                                    race: player.race,
                                                    portraitUrl: getPlayerPortraitModel(player).previewSrc ?? getPlayerPortraitModel(player).src,
                                                  }, selectedTeam?.teamId);
                                                }}
                                              >
                                                ⇄
                                              </button>
                                              {isContractExpiring && selectedTeam ? (
                                                <button
                                                  className="table-icon-button"
                                                  type="button"
                                                  title="Verlängern"
                                                  aria-label={`${player.name} verlängern`}
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
                                                  ↻
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
                                    const annualSalary = getRosterEntryDisplaySalary(entry, player);
                                    const currentSeasonSalary = getRosterEntryCurrentSeasonSalary(entry, player);
                                    const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
                                    const showSeasonSubline = rosterSalariesDifferForDisplay(currentSeasonSalary, annualSalary);
                                    return (
                                      <td key={column.id}>
                                        <div className="economy-money-stack">
                                          <strong>{formatDisplayMoney(annualSalary)}</strong>
                                          {salaryDelta != null && Math.abs(salaryDelta) >= 0.01 ? (
                                            <small className={salaryDelta <= 0 ? "text-positive" : "text-negative"}>
                                              {formatSignedDisplayMoney(salaryDelta)}
                                            </small>
                                          ) : null}
                                          {showSeasonSubline ? (
                                            <small className="players-table-salary-season" title="Gehalt diese Saison (Vertragsjahr 1)">
                                              Saison: {formatDisplayMoney(currentSeasonSalary)}
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
                ) : selectedTeamDetailTab === "portraits" ? (
                  <FoundationTeamsPortraitsTab
                    selectedTeam={selectedTeam}
                    selectedTeamViewRow={selectedTeamViewRow}
                    filteredSelectedRosterTableRows={filteredSelectedRosterTableRows}
                    selectedStandingRow={selectedStandingRow}
                    selectedRoster={selectedRoster}
                    teamRosterRoleFilterOptions={teamRosterRoleFilterOptions}
                    teamRosterRoleFilter={teamRosterRoleFilter}
                    setTeamRosterRoleFilter={setTeamRosterRoleFilter}
                    teamRosterFocusOptions={teamRosterFocusOptions}
                    teamRosterFocusMode={teamRosterFocusMode}
                    setTeamRosterFocusMode={setTeamRosterFocusMode}
                    gameState={gameState}
                    leaguePlayerHeatPools={leaguePlayerHeatPools}
                    getPlayerPortraitModel={getPlayerPortraitModel}
                    getClassColorClassName={getClassColorClassName}
                    openPlayerDrawerById={openPlayerDrawerById}
                    formatLocalePoints={formatLocalePoints}
                    formatDisplayMoney={formatDisplayMoney}
                    formatMoney={formatMoney}
                    getRosterEntryDisplayMarketValue={getRosterEntryDisplayMarketValue}
                    getRosterEntryDisplaySalary={getRosterEntryDisplaySalary}
                    getRosterEntryCurrentSeasonSalary={getRosterEntryCurrentSeasonSalary}
                    getPlayerDisplayMarketValueDelta={getPlayerDisplayMarketValueDelta}
                    getRosterEntrySalaryDelta={getRosterEntrySalaryDelta}
                    formatWholeNumber={formatWholeNumber}
                    portraitAvgOvr={portraitAvgOvr}
                    portraitAvgSalary={portraitAvgSalary}
                    contractExpiringCount={portraitExpiringCount}
                  />
                ) : selectedTeamDetailTab === "transfer" ? (
                  <div className="teams-v2-transfer-tab" data-testid="teams-v2-transfer-tab">
                    <div className="teams-v2-finance-role-cards">
                      <article className="metric-card teams-v2-role-card">
                        <span>Cash</span>
                        <strong>{selectedStandingRow?.cash != null ? formatMoney(selectedStandingRow.cash) : "—"}</strong>
                      </article>
                      <article className="metric-card teams-v2-role-card">
                        <span>Gehalt</span>
                        <strong>{selectedStandingRow?.salaryTotal != null ? formatLocalePoints(selectedStandingRow.salaryTotal, 2) : "—"}</strong>
                      </article>
                      <article className="metric-card teams-v2-role-card">
                        <span>GuV</span>
                        <strong className={selectedStandingRow?.guv != null && selectedStandingRow.guv < 0 ? "text-negative" : "text-positive"}>
                          {selectedStandingRow?.guv != null ? formatSignedDisplayMoney(selectedStandingRow.guv) : "—"}
                        </strong>
                      </article>
                    </div>
                    {(() => {
                      const liveHistory = selectedTeamsHistoryData?.history?.find((row) => row.isLive) ?? selectedTeamsHistoryData?.history?.[0] ?? null;
                      const duelRival = sortedTeamsViewRows?.find(
                        (row) => row.teamId !== selectedTeam.teamId && row.rank != null && selectedStandingRow?.rank != null && Math.abs(row.rank - selectedStandingRow.rank) <= 2,
                      ) ?? null;
                      return (
                        <>
                          {duelRival ? (
                            <article className="teams-v2-duel-card" data-testid="teams-v2-duel-card">
                              <span className="eyebrow">Duell</span>
                              <strong>
                                #{selectedStandingRow?.rank ?? "—"} {selectedTeam.shortCode} vs #{duelRival.rank ?? "—"} {duelRival.shortCode}
                              </strong>
                              <small className="muted">
                                {formatLocalePoints(selectedStandingRow?.points ?? 0, 1)} vs {formatLocalePoints(duelRival.points ?? 0, 1)} Punkte
                              </small>
                            </article>
                          ) : null}
                          <div className="teams-v2-transfer-cards">
                            <article className="teams-v2-transfer-card">
                              <span>Top-Kauf</span>
                              <strong>
                                {liveHistory?.topBuyPlayer ? (
                                  <button type="button" className="table-link-button" onClick={() => liveHistory.topBuyPlayerId && void openPlayerDrawerById(liveHistory.topBuyPlayerId)}>
                                    {liveHistory.topBuyPlayer} · {formatNullableMoney(liveHistory.topBuyAmount)}
                                  </button>
                                ) : (
                                  "—"
                                )}
                              </strong>
                            </article>
                            <article className="teams-v2-transfer-card">
                              <span>Top-Verkauf</span>
                              <strong>
                                {liveHistory?.topSellPlayer ? (
                                  <button type="button" className="table-link-button" onClick={() => liveHistory.topSellPlayerId && void openPlayerDrawerById(liveHistory.topSellPlayerId)}>
                                    {liveHistory.topSellPlayer} · {formatNullableMoney(liveHistory.topSellAmount)}
                                  </button>
                                ) : (
                                  "—"
                                )}
                              </strong>
                            </article>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="team-contracts-layout">
                    <div className="team-contracts-summary-grid">
                      <article className="metric-card">
                        <span>Aktive Verträge</span>
                        <strong>{selectedRoster.length}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Laufen aus</span>
                        <strong>{contractExpiringCount}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Preview-Drafts</span>
                        <strong>{selectedTeamContractPreviewRowCount}</strong>
                      </article>
                      {selectedTeamContractShapeMix ? (
                        <article className="metric-card">
                          <span>Strukturiert</span>
                          <strong>
                            {selectedTeamContractShapeMix.nonBalancedCount}/{selectedTeamContractShapeMix.totalCount}
                          </strong>
                          <small>Δ jetzt {formatSignedDisplayMoney(selectedTeamContractShapeMix.currentDelta)}</small>
                        </article>
                      ) : null}
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
                    {selectedTeamContractTable ? (
                      <div className="team-contracts-forecast-row contract-forecast-panel">
                        <div className="team-contracts-section-head">
                          <strong>Gehaltsforecast</strong>
                          <span className="muted">Gebundene Summen je Saison</span>
                        </div>
                        <div className="contract-forecast-grid">
                          {selectedTeamContractTable.totalsCommitted.map((entry, index) => {
                            const preview = selectedTeamContractTable.totalsWithPreview[index];
                            return (
                              <article className="contract-forecast-card" key={entry.label}>
                                <span>{entry.label}</span>
                                <strong>{formatDisplayMoney(entry.salary)}</strong>
                                <small className="muted">Preview {preview ? formatDisplayMoney(preview.salary) : "—"}</small>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {selectedTeamContractShapeMix ? (
                      <details className="team-contracts-mix-details">
                        <summary>
                          Vertragsmix · {selectedTeamContractShapeMix.nonBalancedCount}/{selectedTeamContractShapeMix.totalCount} strukturiert
                        </summary>
                        <div className="team-contract-mix-grid">
                          {selectedTeamContractShapeMix.entries.map((entry) => (
                            <article className={`team-contract-mix-card is-${entry.shape.replace("_", "-")}`} key={entry.shape}>
                              <div className="team-contract-mix-card-head">
                                <span>{entry.label}</span>
                                <strong>{formatLocalePoints(entry.share, 0)}%</strong>
                              </div>
                              <div className="team-contract-mix-metrics">
                                <span>
                                  <strong>{entry.count}</strong> Verträge
                                </span>
                                <span>
                                  <strong>{formatDisplayMoney(entry.totalSalary)}</strong> gebunden
                                </span>
                              </div>
                            </article>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    <div className="team-contracts-toolbar">
                      {selectedTeamContractPreviewRowCount > 0 ? (
                        <button
                          className={`secondary-button inline-button${showTeamContractPreviewRows ? " is-active" : ""}`}
                          type="button"
                          onClick={() => setShowTeamContractPreviewRows((current) => !current)}
                          title={showTeamContractPreviewRows ? "Preview-Zeilen ausblenden" : "Preview-Zeilen einblenden"}
                        >
                          Preview {showTeamContractPreviewRows ? "an" : "aus"} · {selectedTeamContractPreviewRowCount}
                        </button>
                      ) : null}
                    </div>
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
                            <th>VK</th>
                            {selectedTeamContractTable?.seasonLabels.map((label) => (
                              <th key={label}>{label}</th>
                            ))}
                            <th>Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleSelectedTeamContractRows.length ? (
                            visibleSelectedTeamContractRows.map((row) => {
                              const isSellMarked =
                                row.status === "active" &&
                                selectedTeam != null &&
                                transferSellMarkerKeySet.has(`${selectedTeam.teamId}:${row.playerId}`);
                              const shapeClass = (row.contractShape ?? "balanced").replace("_", "-");
                              return (
                                <tr
                                  key={row.rowId}
                                  className={joinClassNames(
                                    row.status === "preview" && "is-preview-row",
                                    row.contractLength <= 1 && "is-contract-expiring",
                                    isSellMarked && "is-sell-marked",
                                  )}
                                  onClick={() => void openPlayerDrawerById(row.playerId)}
                                >
                                  <td>
                                    <div className="table-player-cell">
                                      <strong>{row.playerName}</strong>
                                      <span>{row.roleTag ?? "Kader"}</span>
                                      {isSellMarked ? <span className="pill pill-warning">VK vorgemerkt</span> : null}
                                    </div>
                                  </td>
                                  <td>{row.status === "preview" ? "Preview" : "Aktiv"}</td>
                                  <td>
                                    <span className={`team-contract-shape is-${shapeClass}`}>
                                      {formatContractShapeLabel(row.contractShape)}
                                    </span>
                                  </td>
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
                                      <span
                                        title={
                                          row.moraleRenewalRisk != null
                                            ? `Renewal Risk ${formatWholeNumber(row.moraleRenewalRisk)}%`
                                            : undefined
                                        }
                                      >
                                        {formatMoraleContractIntentLabel(row.moraleContractIntent)}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td>{row.buyoutCost != null ? formatDisplayMoney(row.buyoutCost) : "—"}</td>
                                  <td>{row.exitValue != null ? formatDisplayMoney(row.exitValue) : "—"}</td>
                                  {selectedTeamContractTable?.seasonLabels.map((label, index) => (
                                    <td key={`${row.rowId}-${label}`}>
                                      {row.yearlySalarySchedule[index]?.salary != null
                                        ? formatDisplayMoney(row.yearlySalarySchedule[index]!.salary)
                                        : "—"}
                                    </td>
                                  )) ?? null}
                                  <td>
                                    {row.status === "active" && selectedTeamRosterActionsAvailable ? (
                                      <div className="transfermarkt-inline-actions" onClick={(event) => event.stopPropagation()}>
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
                                                  gameState.players.find((candidate) => candidate.id === row.playerId)?.className ??
                                                  "—",
                                                race:
                                                  gameState.players.find((candidate) => candidate.id === row.playerId)?.race ?? "—",
                                                portraitUrl:
                                                  gameState.players.find((candidate) => candidate.id === row.playerId)?.portraitUrl ??
                                                  null,
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
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={8 + (selectedTeamContractTable?.seasonLabels.length ?? 0) + 1} className="muted">
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
                              <td colSpan={8}>
                                <strong>Summe aktiv</strong>
                              </td>
                              {selectedTeamContractTable.totalsCommitted.map((entry) => (
                                <td key={`committed-${entry.label}`}>
                                  <strong>{formatDisplayMoney(entry.salary)}</strong>
                                </td>
                              ))}
                              <td />
                            </tr>
                            <tr>
                              <td colSpan={8}>
                                <strong>Summe mit Preview</strong>
                              </td>
                              {selectedTeamContractTable.totalsWithPreview.map((entry) => (
                                <td key={`preview-${entry.label}`}>
                                  <strong>{formatDisplayMoney(entry.salary)}</strong>
                                </td>
                              ))}
                              <td />
                            </tr>
                          </tfoot>
                        ) : null}
                      </table>
                    </div>
                    <p className="muted team-contracts-footnote">
                      Preview-Drafts stammen aus dem Kaufdialog. Buyout zahlt das komplette Restgehalt; bei Abgang erhält das Team den VK-Wert.
                    </p>

                  </div>
                )}
              </section>

              {selectedTeamDetailTab === "roster" ? (
                <>
                  <section className="panel teams-league-panel" id="teams-league-overview">
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
                          {sortedTeamsViewRows.map((row, rowIndex) => (
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
                                  const logo = getTeamLogoModel(row.team, { variant: "thumb" });
                                  return (
                                    <td key={column.id} className="teams-view-team-cell">
                                      <button
                                        className="table-link-button players-table-team-button"
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openTeamProfileById(row.team.teamId);
                                        }}
                                      >
                                        {shouldShowTeamRowLogo(row.team.teamId, rowIndex) && logo.src ? (
                                          <BudgetedMediaImage
                                            className="players-table-team-logo"
                                            src={logo.src}
                                            alt={`${row.team.name} Logo`}
                                            width={30}
                                            height={30}
                                            loading="lazy"
                                            fetchPriority="low"
                                            fallback={
                                              <span
                                                className="players-table-team-logo players-table-team-logo-placeholder"
                                                aria-label={`${row.team.name} Logo Platzhalter`}
                                              >
                                                {logo.initials}
                                              </span>
                                            }
                                          />
                                        ) : (
                                          <span
                                            className="players-table-team-logo players-table-team-logo-placeholder"
                                            aria-label={`${row.team.name} Logo Platzhalter`}
                                          >
                                            {logo.initials}
                                          </span>
                                        )}
                                        <span>{row.team.name}</span>
                                      </button>
                                    </td>
                                  );
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

                  {showSecondaryPanels && selectedTeamsHistoryData ? (
                    <section className="panel teams-economy-panel" aria-label="Team-Kennzahlen">
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

                  {showSecondaryPanels ? (
                    <>
                  <section className="panel teams-history-panel teams-v2-history-panel" aria-label="Team-Historie">
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
                      <TeamDrawerHistoryTable
                        rows={selectedTeamsHistoryData.history}
                        getRowClassName={(row) => (row.isLive ? "is-live" : undefined)}
                        renderCell={(columnId, row) => {
                          if (columnId === "season") {
                            return (
                              <>
                                <strong>{row.seasonName}</strong>
                                {row.isLive ? <span className="pill">Live</span> : null}
                              </>
                            );
                          }
                          if (columnId === "rank") {
                            return (
                              <span className={`teams-v2-rank-cell ${getTeamHistoryRankToneClass(row.rank)}`}>
                                {row.rank != null ? `#${row.rank}` : "—"}
                              </span>
                            );
                          }
                          if (columnId === "points") return formatLocalePoints(row.points, 1);
                          if (columnId === "pps") return formatLocalePoints(row.pps, 1);
                          if (columnId === "pow") return formatLocalePoints(row.ppPow, 1);
                          if (columnId === "spe") return formatLocalePoints(row.ppSpe, 1);
                          if (columnId === "men") return formatLocalePoints(row.ppMen, 1);
                          if (columnId === "soc") return formatLocalePoints(row.ppSoc, 1);
                          if (isSeasonDisciplineKey(columnId)) {
                            return formatLocalePoints(row.disciplineValues[columnId], 1);
                          }
                          if (columnId === "cash") return formatNullableMoney(row.cash);
                          if (columnId === "salary") return formatNullableMoney(row.salaryTotal);
                          if (columnId === "mw") return formatNullableMoney(row.marketValue);
                          if (columnId === "guv") {
                            return (
                              <span className={row.guv != null && row.guv < 0 ? "text-negative" : "text-positive"}>
                                {formatSignedDisplayMoney(row.guv)}
                              </span>
                            );
                          }
                          if (columnId === "injuriesCount") {
                            return row.injuriesCount != null ? row.injuriesCount : "—";
                          }
                          if (columnId === "averageFatigue") {
                            return row.averageFatigue != null ? formatLocalePoints(row.averageFatigue, 1) : "—";
                          }
                          if (columnId === "topBuy") {
                            return row.topBuyPlayer ? (
                              <button
                                type="button"
                                className="teams-v2-history-transfer-link text-negative"
                                onClick={() => row.topBuyPlayerId && void openPlayerDrawerById(row.topBuyPlayerId)}
                              >
                                {row.topBuyPlayer} · {formatNullableMoney(row.topBuyAmount)}
                              </button>
                            ) : (
                              "—"
                            );
                          }
                          if (columnId === "topSell") {
                            return row.topSellPlayer ? (
                              <button
                                type="button"
                                className={`teams-v2-history-transfer-link ${row.topSellProfit != null && row.topSellProfit >= 0 ? "text-positive" : row.topSellProfit != null ? "text-negative" : ""}`}
                                onClick={() => row.topSellPlayerId && void openPlayerDrawerById(row.topSellPlayerId)}
                                title={
                                  row.topSellProfit != null
                                    ? row.topSellProfit >= 0
                                      ? `Verkaufsgewinn: ${formatSignedDisplayMoney(row.topSellProfit)}`
                                      : `Verlust: ${formatSignedDisplayMoney(row.topSellProfit)}`
                                    : undefined
                                }
                              >
                                {row.topSellPlayer} · {formatNullableMoney(row.topSellAmount)}
                                {row.topSellProfit != null ? ` (${formatSignedDisplayMoney(row.topSellProfit)})` : ""}
                              </button>
                            ) : (
                              "—"
                            );
                          }
                          return "—";
                        }}
                      />
                    ) : (
                      <p className="muted">Für dieses Team ist noch keine Historie verfügbar.</p>
                    )}
                  </section>

                  <section className="panel team-objectives-panel teams-secondary-objectives-panel" data-testid="team-board-objectives" id="team-board-objectives">
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
                    </>
                  ) : null}
                </>
              ) : null}

              {selectedTeamDetailTab === "roster" && showExtendedTeamPanels ? (
              <div className="foundation-main-grid">
                <section className="panel">
                  <div className="panel-header">
                    <h2>Starter</h2>
                  </div>
                  <div className="roster-grid team-portraits-grid">
                    {starters.map(({ entry, player }) => {
                      const portrait = getPlayerPortraitModel(player);
                      const ratings = playerRatingsById.get(player.id);
                      const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
                      const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
                      return (
                        <FoundationPlayerPortraitCard
                          key={entry.id}
                          playerId={player.id}
                          name={player.name}
                          portraitUrl={portrait.thumbSrc ?? portrait.src}
                          portraitInitials={portrait.initials}
                          playerOvr={ratings?.ovrNormalized ?? null}
                          playerMvs={ratings?.mvs ?? null}
                          playerPps={ratings?.ppsSeason ?? null}
                          ovrRank={ratings?.ovrRank ?? null}
                          mvsRank={ratings?.mvsRank ?? null}
                          ppsRank={ratings?.ppsSeasonRank ?? null}
                          pow={player.coreStats.pow}
                          spe={player.coreStats.spe}
                          men={player.coreStats.men}
                          soc={player.coreStats.soc}
                          leagueHeatPools={leaguePlayerHeatPools}
                          variant="team"
                          className={getClassColorClassName(player.className, "player-card-class-frame")}
                          subMeta={formatPlayerIdentitySubMeta(player) || null}
                          onOpen={() => void openPlayerDrawerById(player.id, entry.id)}
                          title="Spielerprofil öffnen"
                          economyStats={[
                            {
                              label: "MW",
                              value: formatLocalePoints(getRosterEntryDisplayMarketValue(entry, player), 2),
                              delta:
                                marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01
                                  ? `${marketValueDelta > 0 ? "+" : ""}${formatLocalePoints(marketValueDelta, 2)}`
                                  : null,
                              deltaClass: marketValueDelta != null && marketValueDelta > 0 ? "text-positive" : marketValueDelta != null && marketValueDelta < 0 ? "text-negative" : "",
                            },
                            {
                              label: "Gehalt",
                              value: formatDisplayMoney(getRosterEntryDisplaySalary(entry, player)),
                              delta:
                                salaryDelta != null && Math.abs(salaryDelta) >= 0.01
                                  ? `${salaryDelta > 0 ? "+" : ""}${formatDisplayMoney(salaryDelta)}`
                                  : null,
                              deltaClass: salaryDelta != null && salaryDelta < 0 ? "text-positive" : salaryDelta != null && salaryDelta > 0 ? "text-negative" : "",
                            },
                            { label: "LZ", value: `${entry.contractLength ?? "—"}${formatContractShapeShortLabel(entry.contractShape) ? ` · ${formatContractShapeShortLabel(entry.contractShape)}` : ""}` },
                          ]}
                        />
                      );
                    })}
                    {starters.length === 0 ? <p className="muted">Noch keine Starter im Kader.</p> : null}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>Bench & Prospects</h2>
                  </div>
                  <div className="roster-grid team-portraits-grid">
                    {bench.map(({ entry, player }) => {
                      const portrait = getPlayerPortraitModel(player);
                      const ratings = playerRatingsById.get(player.id);
                      const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
                      const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
                      return (
                        <FoundationPlayerPortraitCard
                          key={entry.id}
                          playerId={player.id}
                          name={player.name}
                          portraitUrl={portrait.thumbSrc ?? portrait.src}
                          portraitInitials={portrait.initials}
                          playerOvr={ratings?.ovrNormalized ?? null}
                          playerMvs={ratings?.mvs ?? null}
                          playerPps={ratings?.ppsSeason ?? null}
                          ovrRank={ratings?.ovrRank ?? null}
                          mvsRank={ratings?.mvsRank ?? null}
                          ppsRank={ratings?.ppsSeasonRank ?? null}
                          pow={player.coreStats.pow}
                          spe={player.coreStats.spe}
                          men={player.coreStats.men}
                          soc={player.coreStats.soc}
                          leagueHeatPools={leaguePlayerHeatPools}
                          variant="team"
                          className={getClassColorClassName(player.className, "player-card-class-frame")}
                          subMeta={formatPlayerIdentitySubMeta(player) || null}
                          onOpen={() => void openPlayerDrawerById(player.id, entry.id)}
                          title="Spielerprofil öffnen"
                          economyStats={[
                            {
                              label: "MW",
                              value: formatLocalePoints(getRosterEntryDisplayMarketValue(entry, player), 2),
                              delta:
                                marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01
                                  ? `${marketValueDelta > 0 ? "+" : ""}${formatLocalePoints(marketValueDelta, 2)}`
                                  : null,
                              deltaClass: marketValueDelta != null && marketValueDelta > 0 ? "text-positive" : marketValueDelta != null && marketValueDelta < 0 ? "text-negative" : "",
                            },
                            {
                              label: "Gehalt",
                              value: formatDisplayMoney(getRosterEntryDisplaySalary(entry, player)),
                              delta:
                                salaryDelta != null && Math.abs(salaryDelta) >= 0.01
                                  ? `${salaryDelta > 0 ? "+" : ""}${formatDisplayMoney(salaryDelta)}`
                                  : null,
                              deltaClass: salaryDelta != null && salaryDelta < 0 ? "text-positive" : salaryDelta != null && salaryDelta > 0 ? "text-negative" : "",
                            },
                            { label: "LZ", value: `${entry.contractLength ?? "—"}${formatContractShapeShortLabel(entry.contractShape) ? ` · ${formatContractShapeShortLabel(entry.contractShape)}` : ""}` },
                          ]}
                        />
                      );
                    })}
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

export default memo(FoundationTeamsDetailPanel);
