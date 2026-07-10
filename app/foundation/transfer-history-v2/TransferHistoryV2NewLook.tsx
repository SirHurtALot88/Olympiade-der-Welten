"use client";

import { useMemo, useState } from "react";

import ClassIcon from "@/app/foundation/ClassIcon";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import RaceIcon from "@/app/foundation/RaceIcon";
import type {
  ActivityCard,
  TransferHistoryV2ClientProps,
  TransferHistoryV2Row,
} from "@/app/foundation/transfer-history-v2/TransferHistoryV2Client";
import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlSparkline,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
} from "@/components/foundation/new-look";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";

/**
 * "Neuer Look" Transfer-Historie — flag-gated, additiv.
 *
 * Wird nur gerendert, wenn `useNewLook` aktiv ist; `TransferHistoryV2Client`
 * fällt ohne Flag byte-identisch auf die bestehende Ansicht zurück. Konsumiert
 * dieselben Props plus die im Client bereits berechneten Ableitungen
 * (activityCards, biggest*, selectedRow) — keine erfundenen Werte:
 * - Timeline-Karten mit echtem Portrait (`portraitUrl`) bzw. Initialen-Chip,
 * - Timeline|Tabelle wechselt in-place über `NlSubTabs`,
 * - MW-Verlauf des gewählten Spielers über seine Deals (aus `filteredRows`),
 * - Season-Verteilung als `NlBarChart` (aus `seasonBreakdown`) plus
 *   MW-Volumen pro Season als `NlSparkline` (aus `filteredRows`),
 * - alle echten Filter/Aktionen (Selects, Suche, Reset, Pager, Mehr laden).
 */

export type TransferHistoryV2NewLookProps = TransferHistoryV2ClientProps & {
  activityCards: ActivityCard[];
  mostActiveTeam: ActivityCard | null;
  biggestBuy: TransferHistoryV2Row | null;
  biggestSale: TransferHistoryV2Row | null;
  bestProfit: TransferHistoryV2Row | null;
  selectedRow: TransferHistoryV2Row | null;
  selectedTransferId: string | null;
  onSelectTransfer: (transferId: string | null) => void;
};

function formatNlSignedMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = formatTransfermarktCurrency(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${abs}`;
}

function formatNlTransferType(type: TransferHistoryV2Row["type"]) {
  if (type === "buy") return "Kauf";
  if (type === "sell") return "Verkauf";
  return "Abgang";
}

function getNlTransferToneClass(type: TransferHistoryV2Row["type"]) {
  if (type === "buy") return "is-buy";
  if (type === "sell") return "is-sell";
  return "is-exit";
}

function getNlTimelineTargetLabel(row: TransferHistoryV2Row) {
  if (row.type === "buy") {
    return `${row.toTeamName ?? row.toTeamId ?? "Team"} verpflichtet`;
  }
  if (row.type === "sell") {
    return `${row.fromTeamName ?? row.fromTeamId ?? "Team"} verkauft`;
  }
  return `${row.fromTeamName ?? row.toTeamName ?? "Team"} trennt sich`;
}

function NlThistPortraitChip({ row, size = 40 }: { row: TransferHistoryV2Row; size?: number }) {
  return (
    <span className={`nl-thist-portrait ${getNlTransferToneClass(row.type)}`} aria-hidden="true">
      {row.portraitUrl ? (
        <OptimizedMediaImage src={row.portraitUrl} alt="" width={size} height={size} className="nl-thist-portrait-img" />
      ) : (
        <span className="nl-thist-portrait-initials">{row.portraitInitials}</span>
      )}
    </span>
  );
}

export default function TransferHistoryV2NewLook({
  sourceBadgeLabel,
  saveName,
  requestedScopeLabel,
  resolvedScopeLabel,
  totalLoaded,
  totalAvailable,
  seasonBreakdown,
  summary,
  filteredRows,
  visibleRows,
  historyVisibleRangeLabel,
  isAllSeasons,
  historyPage,
  historyPageCount,
  onPrevPage,
  onNextPage,
  scopeWarning,
  error,
  seasonFilter,
  allSeasonsValue,
  seasonOptions,
  teamFilter,
  teamOptions,
  typeFilter,
  classFilter,
  sourceFilter,
  classOptions,
  sourceOptions,
  search,
  onSeasonFilterChange,
  onTeamFilterChange,
  onTypeFilterChange,
  onClassFilterChange,
  onSourceFilterChange,
  onSearchChange,
  onResetFilters,
  onOpenPlayer,
  onOpenTeam,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  activityCards,
  mostActiveTeam,
  biggestBuy,
  biggestSale,
  bestProfit,
  selectedRow,
  selectedTransferId,
  onSelectTransfer,
}: TransferHistoryV2NewLookProps) {
  const [historyLayout, setHistoryLayout] = useState<"timeline" | "table">("timeline");

  // MW-Verlauf des gewählten Spielers über alle seine Deals im aktuellen Scope
  // (chronologisch nach happenedAt) — echte Werte aus filteredRows.
  const selectedPlayerDealSeries = useMemo(() => {
    if (!selectedRow) return [];
    return filteredRows
      .filter((row) => row.playerId === selectedRow.playerId)
      .sort((left, right) => Date.parse(left.happenedAt) - Date.parse(right.happenedAt));
  }, [filteredRows, selectedRow]);

  const selectedPlayerMwPoints = useMemo(
    () =>
      selectedPlayerDealSeries
        .map((row) => row.marketValue)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    [selectedPlayerDealSeries],
  );

  // MW-Volumen pro Season (Summe der Deal-Marktwerte je Season-Label) —
  // gleiche Season-Reihenfolge wie seasonBreakdown.
  const seasonMwVolume = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of filteredRows) {
      if (typeof row.marketValue === "number" && Number.isFinite(row.marketValue)) {
        totals.set(row.seasonLabel, (totals.get(row.seasonLabel) ?? 0) + row.marketValue);
      }
    }
    return seasonBreakdown.map(([label]) => ({ label, value: totals.get(label) ?? 0 }));
  }, [filteredRows, seasonBreakdown]);

  const seasonBars = useMemo(
    () =>
      seasonBreakdown.map(([label, count]) => ({
        label,
        value: count,
        tone: "accent" as const,
      })),
    [seasonBreakdown],
  );

  return (
    <div className="nl-thist" data-new-look="true">
      <NlCard
        className="nl-thist-header-card"
        eyebrow="Deal-Flow"
        title="Transferhistorie"
        actions={<span className="nl-thist-source-pill">{sourceBadgeLabel}</span>}
      >
        <p className="nl-thist-header-meta">
          {saveName} · Angefragt {requestedScopeLabel} · Aktiv {resolvedScopeLabel}
        </p>
      </NlCard>

      <NlCard className="nl-thist-filter-card" eyebrow="Filter" title="Scope & Suche">
        <div className="nl-thist-filter-grid">
          <label className="nl-thist-filter-field">
            <span>Saison</span>
            <select value={seasonFilter} onChange={(event) => onSeasonFilterChange(event.target.value)}>
              {seasonOptions.map((season) => (
                <option key={season.seasonId} value={season.seasonId}>
                  {season.label}
                </option>
              ))}
              <option value={allSeasonsValue}>Alle Seasons</option>
            </select>
          </label>
          <label className="nl-thist-filter-field">
            <span>Team</span>
            <select value={teamFilter} onChange={(event) => onTeamFilterChange(event.target.value)}>
              <option value="ALL">Alle Teams</option>
              {teamOptions.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.shortCode} · {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="nl-thist-filter-field">
            <span>Typ</span>
            <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value)}>
              <option value="ALL">Alle Typen</option>
              <option value="buy">Käufe</option>
              <option value="sell">Verkäufe</option>
            </select>
          </label>
          <label className="nl-thist-filter-field">
            <span>Klasse</span>
            <select value={classFilter} onChange={(event) => onClassFilterChange(event.target.value)}>
              <option value="ALL">Alle Klassen</option>
              {classOptions.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          </label>
          <label className="nl-thist-filter-field">
            <span>Quelle</span>
            <select value={sourceFilter} onChange={(event) => onSourceFilterChange(event.target.value)}>
              <option value="ALL">Alle Quellen</option>
              {sourceOptions.map((source) => (
                <option key={source.key} value={source.key}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <label className="nl-thist-filter-field">
            <span>Spieler</span>
            <input value={search} placeholder="Name suchen" onChange={(event) => onSearchChange(event.target.value)} />
          </label>
        </div>
        <div className="nl-thist-filter-meta">
          <span>
            Zeigt {historyVisibleRangeLabel} von {filteredRows.length} Treffern · geladen {totalLoaded} von {totalAvailable}
          </span>
          <button type="button" className="nl-thist-inline-action" onClick={onResetFilters}>
            Filter reset
          </button>
          {!isAllSeasons && hasMore && onLoadMore ? (
            <button type="button" className="nl-thist-inline-action" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? "Lädt…" : "Mehr laden"}
            </button>
          ) : null}
        </div>
      </NlCard>

      {scopeWarning ? (
        <div className="nl-thist-callout is-warning">
          <strong>Scope-Hinweis</strong>
          <span>{scopeWarning}</span>
        </div>
      ) : null}
      {error ? (
        <div className="nl-thist-callout is-error">
          <strong>Historie konnte nicht geladen werden</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <StatChipRow className="nl-thist-summary" aria-label="Transferbilanz">
        <StatChip label="Deals" value={summary.count} tone="accent" sub={isAllSeasons ? "mehrere Seasons" : "aktuelle Season"} />
        <StatChip label="Ausgaben" value={formatTransfermarktCurrency(summary.buyFee)} tone="risk" sub="Käufe gesamt" />
        <StatChip label="Einnahmen" value={formatTransfermarktCurrency(summary.sellFee)} tone="good" sub="Verkäufe gesamt" />
        <StatChip
          label="Netto"
          value={formatNlSignedMoney(summary.netTransferBalance)}
          tone={summary.netTransferBalance >= 0 ? "good" : "risk"}
          sub="Transferbilanz"
        />
        <StatChip label="Ø Fee" value={formatTransfermarktCurrency(summary.averageFee ?? null)} tone="neutral" sub="pro Deal" />
        <StatChip
          label="Ø GuV"
          value={summary.averageProfit != null ? formatNlSignedMoney(summary.averageProfit) : "—"}
          tone={summary.averageProfit != null && summary.averageProfit >= 0 ? "good" : "warn"}
          sub="bei Verkäufen"
        />
      </StatChipRow>

      <div className="nl-thist-story-grid">
        <NlCard className="nl-thist-story-card is-buy" eyebrow="Teuerster Kauf" title={biggestBuy?.playerName ?? "—"}>
          <p className="nl-thist-story-meta">
            {biggestBuy
              ? `${biggestBuy.toTeamName ?? biggestBuy.toTeamId ?? "—"} · ${formatTransfermarktCurrency(biggestBuy.fee)}`
              : "keine Kaufbewegung"}
          </p>
        </NlCard>
        <NlCard className="nl-thist-story-card is-sell" eyebrow="Teuerster Verkauf" title={biggestSale?.playerName ?? "—"}>
          <p className="nl-thist-story-meta">
            {biggestSale
              ? `${biggestSale.fromTeamName ?? biggestSale.fromTeamId ?? "—"} · ${formatTransfermarktCurrency(biggestSale.fee)}`
              : "kein Verkauf"}
          </p>
        </NlCard>
        <NlCard className="nl-thist-story-card is-profit" eyebrow="Bester GuV" title={bestProfit?.playerName ?? "—"}>
          <p className="nl-thist-story-meta">
            {bestProfit?.guv != null ? formatNlSignedMoney(bestProfit.guv) : "kein belastbarer Gewinnwert"}
          </p>
        </NlCard>
        <NlCard className="nl-thist-story-card is-activity" eyebrow="Meiste Bewegung" title={mostActiveTeam?.teamName ?? "—"}>
          <p className="nl-thist-story-meta">
            {mostActiveTeam
              ? `${mostActiveTeam.volume} Deals · Netto ${formatNlSignedMoney(mostActiveTeam.net)}`
              : "noch keine Teamaktivität"}
          </p>
        </NlCard>
      </div>

      <div className="nl-thist-layout">
        <NlCard
          className="nl-thist-stream-card"
          eyebrow="Deal-Strom"
          title={`${visibleRows.length} sichtbar`}
          actions={
            <NlSubTabs
              className="nl-thist-layout-tabs"
              aria-label="Darstellung des Deal-Stroms"
              activeId={historyLayout}
              onSelect={(id) => setHistoryLayout(id as "timeline" | "table")}
              items={[
                { id: "timeline", label: "Timeline" },
                { id: "table", label: "Tabelle" },
              ]}
            />
          }
        >
          {historyLayout === "timeline" ? (
            <div className="nl-thist-timeline" role="list" aria-label="Deal-Timeline">
              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <button
                    key={row.transferId}
                    type="button"
                    role="listitem"
                    className={`nl-thist-timeline-card ${getNlTransferToneClass(row.type)}${
                      selectedTransferId === row.transferId ? " is-selected" : ""
                    }`}
                    onClick={() => onSelectTransfer(row.transferId)}
                  >
                    <NlThistPortraitChip row={row} />
                    <span className="nl-thist-timeline-copy">
                      <span className="nl-thist-timeline-head">
                        <span className={`nl-thist-type-pill ${getNlTransferToneClass(row.type)}`}>
                          {formatNlTransferType(row.type)}
                        </span>
                        <small>{new Date(row.happenedAt).toLocaleString("de-DE")}</small>
                      </span>
                      <strong>{row.playerName}</strong>
                      <small className="nl-thist-timeline-target">{getNlTimelineTargetLabel(row)}</small>
                    </span>
                    <span className="nl-thist-timeline-numbers">
                      <strong className="nl-tnum">{formatTransfermarktCurrency(row.fee)}</strong>
                      <small>{row.phase ?? row.matchdayId ?? row.seasonLabel}</small>
                      {row.guv != null ? (
                        <NlDeltaChip value={row.guv} format={() => formatNlSignedMoney(row.guv)} title="GuV dieses Deals" />
                      ) : null}
                    </span>
                  </button>
                ))
              ) : (
                <div className="nl-thist-empty">
                  <strong>Keine Transfers im aktuellen Filter</strong>
                  <span>Wähle eine andere Season, Teamspur oder lockere Klasse/Quelle etwas.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="nl-thist-table-shell">
              <table className="nl-thist-table">
                <thead>
                  <tr>
                    <th>Zeit</th>
                    <th>Spieler</th>
                    <th>Move</th>
                    <th>Teams</th>
                    <th>Fee</th>
                    <th>Gehalt</th>
                    <th>MW</th>
                    <th>GuV</th>
                    <th>Quelle</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr
                      key={`nl-table-${row.transferId}`}
                      className={selectedTransferId === row.transferId ? "is-selected" : undefined}
                      onClick={() => onSelectTransfer(row.transferId)}
                    >
                      <td>
                        <div className="nl-thist-table-cell-stack">
                          <strong>{new Date(row.happenedAt).toLocaleDateString("de-DE")}</strong>
                          <span>{row.phase ?? row.matchdayId ?? row.seasonLabel}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="nl-thist-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenPlayer(row.playerId);
                          }}
                        >
                          <NlThistPortraitChip row={row} size={28} />
                          {row.playerName}
                        </button>
                      </td>
                      <td>
                        <span className={`nl-thist-type-pill ${getNlTransferToneClass(row.type)}`}>
                          {formatNlTransferType(row.type)}
                        </span>
                      </td>
                      <td>
                        <div className="nl-thist-table-cell-stack">
                          {row.fromTeamId && row.fromTeamName ? (
                            <button
                              type="button"
                              className="nl-thist-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenTeam(row.fromTeamId!);
                              }}
                            >
                              {row.fromTeamName}
                            </button>
                          ) : (
                            <strong>{row.fromTeamName ?? "Free Agent"}</strong>
                          )}
                          {row.toTeamId && row.toTeamName ? (
                            <button
                              type="button"
                              className="nl-thist-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenTeam(row.toTeamId!);
                              }}
                            >
                              → {row.toTeamName}
                            </button>
                          ) : row.toTeamName ? (
                            <span>→ {row.toTeamName}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="nl-tnum">{formatTransfermarktCurrency(row.fee)}</td>
                      <td className="nl-tnum">{formatTransfermarktCurrency(row.salary)}</td>
                      <td className="nl-tnum">{formatTransfermarktCurrency(row.marketValue)}</td>
                      <td>{row.guv != null ? <NlDeltaChip value={row.guv} format={() => formatNlSignedMoney(row.guv)} /> : "—"}</td>
                      <td>{row.sourceLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleRows.length === 0 ? (
                <div className="nl-thist-empty">
                  <strong>Keine Transfers im aktuellen Filter</strong>
                  <span>Wähle eine andere Season, Teamspur oder lockere Klasse/Quelle etwas.</span>
                </div>
              ) : null}
            </div>
          )}
          {isAllSeasons && historyPageCount > 1 ? (
            <div className="nl-thist-pager">
              <span className="nl-thist-pager-label nl-tnum">
                Seite {historyPage} / {historyPageCount}
              </span>
              <button type="button" className="nl-thist-inline-action" disabled={historyPage <= 1} onClick={onPrevPage}>
                Zurück
              </button>
              <button
                type="button"
                className="nl-thist-inline-action"
                disabled={historyPage >= historyPageCount}
                onClick={onNextPage}
              >
                Weiter
              </button>
            </div>
          ) : null}
        </NlCard>

        <NlCard
          className="nl-thist-spotlight-card"
          eyebrow="Spotlight"
          title={selectedRow ? selectedRow.playerName : "Deal wählen"}
          actions={selectedRow ? <span className="nl-thist-spotlight-season">{selectedRow.seasonLabel}</span> : null}
        >
          {selectedRow ? (
            <>
              <div className="nl-thist-spotlight-hero">
                <button
                  type="button"
                  className="nl-thist-spotlight-portrait"
                  onClick={() => onOpenPlayer(selectedRow.playerId)}
                  title={`${selectedRow.playerName} Profil öffnen`}
                >
                  <NlThistPortraitChip row={selectedRow} size={72} />
                </button>
                <div className="nl-thist-spotlight-copy">
                  <span className={`nl-thist-type-pill ${getNlTransferToneClass(selectedRow.type)}`}>
                    {formatNlTransferType(selectedRow.type)}
                  </span>
                  <div className="nl-thist-spotlight-icons">
                    <ClassIcon
                      classNameValue={selectedRow.className}
                      className="table-identity-icon-chip"
                      iconClassName="table-identity-icon-image"
                    />
                    <RaceIcon
                      race={selectedRow.race}
                      className="table-identity-icon-chip"
                      iconClassName="table-identity-icon-image"
                    />
                  </div>
                  <div className="nl-thist-team-route">
                    {selectedRow.fromTeamId && selectedRow.fromTeamName ? (
                      <button type="button" className="nl-thist-link" onClick={() => onOpenTeam(selectedRow.fromTeamId!)}>
                        {selectedRow.fromTeamName}
                      </button>
                    ) : selectedRow.fromTeamName ? (
                      <span>{selectedRow.fromTeamName}</span>
                    ) : null}
                    {selectedRow.fromTeamName || selectedRow.toTeamName ? <span aria-hidden="true">→</span> : null}
                    {selectedRow.toTeamId && selectedRow.toTeamName ? (
                      <button type="button" className="nl-thist-link" onClick={() => onOpenTeam(selectedRow.toTeamId!)}>
                        {selectedRow.toTeamName}
                      </button>
                    ) : selectedRow.toTeamName ? (
                      <span>{selectedRow.toTeamName}</span>
                    ) : null}
                  </div>
                  <small className="nl-thist-spotlight-meta">
                    {new Date(selectedRow.happenedAt).toLocaleString("de-DE")} · {selectedRow.sourceLabel} ·{" "}
                    {selectedRow.phase ?? selectedRow.matchdayId ?? selectedRow.seasonLabel}
                  </small>
                </div>
              </div>
              <StatChipRow className="nl-thist-spotlight-stats" aria-label="Deal-Zahlen">
                <StatChip label="Fee" value={formatTransfermarktCurrency(selectedRow.fee)} tone="accent" />
                <StatChip label="MW" value={formatTransfermarktCurrency(selectedRow.marketValue)} tone="neutral" />
                <StatChip
                  label="Gehalt"
                  value={formatTransfermarktCurrency(selectedRow.salary)}
                  tone="neutral"
                  sub={selectedRow.remainingContractLength != null ? `${selectedRow.remainingContractLength}J Restlaufzeit` : undefined}
                />
                {selectedRow.guv != null ? (
                  <StatChip
                    label="GuV"
                    value={formatNlSignedMoney(selectedRow.guv)}
                    tone={selectedRow.guv >= 0 ? "good" : "risk"}
                  />
                ) : null}
              </StatChipRow>
              {selectedPlayerMwPoints.length >= 2 ? (
                <div className="nl-thist-spotlight-trend">
                  <span className="nl-thist-eyebrow">
                    MW über {selectedPlayerDealSeries.length} Deals dieses Spielers im Scope
                  </span>
                  <NlSparkline
                    points={selectedPlayerMwPoints}
                    tone="accent"
                    aria-label={`Marktwert-Verlauf von ${selectedRow.playerName} über die Deal-Timeline`}
                    className="nl-thist-mw-sparkline"
                  />
                  <small className="nl-thist-spotlight-meta nl-tnum">
                    {formatTransfermarktCurrency(selectedPlayerMwPoints[0])} →{" "}
                    {formatTransfermarktCurrency(selectedPlayerMwPoints[selectedPlayerMwPoints.length - 1])}
                  </small>
                </div>
              ) : null}
            </>
          ) : (
            <p className="nl-thist-muted">Wähle links einen Deal für Profil, Zahlen und Teamweg.</p>
          )}
        </NlCard>

        <NlCard className="nl-thist-teams-card" eyebrow="Teambewegung" title={`${activityCards.length} Teams`}>
          <div className="nl-thist-team-list">
            {activityCards.map((team) => (
              <button
                key={team.teamId}
                type="button"
                className="nl-thist-team-row"
                title={`${team.teamName} · ${team.volume} Deals · Erlös ${formatTransfermarktCurrency(team.income)} · Ausgaben ${formatTransfermarktCurrency(team.spend)}`}
                onClick={() => onOpenTeam(team.teamId)}
              >
                <span className="nl-thist-team-code">{team.shortCode}</span>
                <span className="nl-thist-team-copy">
                  <strong>{team.teamName}</strong>
                  <small>
                    {team.volume} Deals · {team.buys}K/{team.sells}V
                  </small>
                </span>
                <span className="nl-thist-team-numbers">
                  <strong className={`nl-tnum${team.income > 0 ? " is-positive" : ""}`}>
                    {formatTransfermarktCurrency(team.income)}
                  </strong>
                  <NlDeltaChip value={team.net} format={() => formatNlSignedMoney(team.net)} title="Netto-Transferbilanz" />
                </span>
              </button>
            ))}
            {!activityCards.length ? <p className="nl-thist-muted">Noch keine Teambewegungen im aktuellen Scope.</p> : null}
          </div>
          {seasonBreakdown.length ? (
            <div className="nl-thist-season-breakdown">
              <span className="nl-thist-eyebrow">Season-Verteilung (Deals)</span>
              <NlBarChart
                bars={seasonBars}
                aria-label="Deals pro Season"
                format={(value) => formatNlNumber(value, 0)}
                className="nl-thist-season-chart"
              />
              {seasonMwVolume.some((entry) => entry.value > 0) ? (
                <div className="nl-thist-season-mw">
                  <span className="nl-thist-eyebrow">MW-Volumen pro Season</span>
                  <NlSparkline
                    points={seasonMwVolume.map((entry) => entry.value)}
                    tone="soc"
                    aria-label="Marktwert-Volumen pro Season"
                    className="nl-thist-mw-sparkline"
                  />
                  <small className="nl-thist-spotlight-meta nl-tnum">
                    {seasonMwVolume[0]?.label} – {seasonMwVolume[seasonMwVolume.length - 1]?.label}
                  </small>
                </div>
              ) : null}
            </div>
          ) : null}
        </NlCard>
      </div>
    </div>
  );
}
