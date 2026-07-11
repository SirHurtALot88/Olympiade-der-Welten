"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import ClassIcon from "@/app/foundation/ClassIcon";
import RaceIcon from "@/app/foundation/RaceIcon";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";

export type TransferHistoryV2Row = {
  transferId: string;
  playerId: string;
  playerName: string;
  portraitUrl: string | null;
  portraitInitials: string;
  seasonId: string;
  seasonLabel: string;
  type: "buy" | "sell" | "contract_exit";
  fromTeamId: string | null;
  fromTeamName: string | null;
  toTeamId: string | null;
  toTeamName: string | null;
  fee: number;
  salary: number;
  marketValue: number;
  guv: number | null;
  className: string | null;
  race: string | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  sourceLabel: string;
  happenedAt: string;
  matchdayId?: string | null;
  phase?: string | null;
  remainingContractLength?: number | null;
};

type TransferHistoryV2ClientProps = {
  sourceBadgeLabel: string;
  saveName: string;
  requestedScopeLabel: string;
  resolvedScopeLabel: string;
  totalLoaded: number;
  totalAvailable: number;
  seasonBreakdown: Array<[string, number]>;
  summary: {
    count: number;
    buyFee: number;
    sellFee: number;
    averageFee: number | null;
    averageProfit: number | null;
    netTransferBalance: number;
  };
  filteredRows: TransferHistoryV2Row[];
  visibleRows: TransferHistoryV2Row[];
  historyVisibleRangeLabel: string;
  isAllSeasons: boolean;
  historyPage: number;
  historyPageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  scopeWarning?: string | null;
  error?: string | null;
  seasonFilter: string;
  allSeasonsValue: string;
  seasonOptions: Array<{ seasonId: string; label: string }>;
  teamFilter: string;
  teamOptions: Array<{ teamId: string; name: string; shortCode: string }>;
  typeFilter: string;
  classFilter: string;
  sourceFilter: string;
  classOptions: string[];
  sourceOptions: Array<{ key: string; label: string }>;
  search: string;
  onSeasonFilterChange: (value: string) => void;
  onTeamFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onClassFilterChange: (value: string) => void;
  onSourceFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onResetFilters: () => void;
  onOpenPlayer: (playerId: string) => void;
  onOpenTeam: (teamId: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

type ActivityCard = {
  teamId: string;
  teamName: string;
  shortCode: string;
  volume: number;
  buys: number;
  sells: number;
  spend: number;
  income: number;
  net: number;
};

function formatSignedMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = formatTransfermarktCurrency(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${abs}`;
}

function formatTransferType(type: TransferHistoryV2Row["type"]) {
  if (type === "buy") return "Kauf";
  if (type === "sell") return "Verkauf";
  return "Abgang";
}

function getTransferTone(type: TransferHistoryV2Row["type"]) {
  if (type === "buy") return "is-buy";
  if (type === "sell") return "is-sell";
  return "is-exit";
}

function getTimelineTargetLabel(row: TransferHistoryV2Row) {
  if (row.type === "buy") {
    return `${row.toTeamName ?? row.toTeamId ?? "Team"} verpflichtet`;
  }
  if (row.type === "sell") {
    return `${row.fromTeamName ?? row.fromTeamId ?? "Team"} verkauft`;
  }
  return `${row.fromTeamName ?? row.toTeamName ?? "Team"} trennt sich`;
}

function getActivitySummary(rows: TransferHistoryV2Row[], teamOptions: TransferHistoryV2ClientProps["teamOptions"]) {
  const shortCodeById = new Map(teamOptions.map((team) => [team.teamId, team.shortCode] as const));
  const nameById = new Map(teamOptions.map((team) => [team.teamId, team.name] as const));
  const entries = new Map<string, ActivityCard>();

  const ensureEntry = (teamId: string, fallbackName: string | null | undefined) => {
    const existing = entries.get(teamId);
    if (existing) return existing;
    const next: ActivityCard = {
      teamId,
      teamName: nameById.get(teamId) ?? fallbackName ?? teamId,
      shortCode: shortCodeById.get(teamId) ?? teamId,
      volume: 0,
      buys: 0,
      sells: 0,
      spend: 0,
      income: 0,
      net: 0,
    };
    entries.set(teamId, next);
    return next;
  };

  for (const row of rows) {
    if (row.type === "buy" && row.toTeamId) {
      const entry = ensureEntry(row.toTeamId, row.toTeamName);
      entry.volume += 1;
      entry.buys += 1;
      entry.spend += row.fee;
      entry.net -= row.fee;
    }
    if ((row.type === "sell" || row.type === "contract_exit") && row.fromTeamId) {
      const entry = ensureEntry(row.fromTeamId, row.fromTeamName);
      entry.volume += 1;
      entry.sells += 1;
      entry.income += row.fee;
      entry.net += row.fee;
    }
  }

  return Array.from(entries.values()).sort((left, right) => {
    if (right.income !== left.income) return right.income - left.income;
    if (right.spend !== left.spend) return right.spend - left.spend;
    if (right.volume !== left.volume) return right.volume - left.volume;
    return left.teamName.localeCompare(right.teamName, "de", { sensitivity: "base" });
  });
}

export default function TransferHistoryV2Client({
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
}: TransferHistoryV2ClientProps) {
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(visibleRows[0]?.transferId ?? null);
  const [historyLayout, setHistoryLayout] = useState<"timeline" | "table">("timeline");
  const timelineListRef = useRef<HTMLDivElement | null>(null);
  const timelineCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!visibleRows.some((row) => row.transferId === selectedTransferId)) {
      setSelectedTransferId(visibleRows[0]?.transferId ?? null);
    }
  }, [selectedTransferId, visibleRows]);

  const activityCards = useMemo(() => getActivitySummary(filteredRows, teamOptions), [filteredRows, teamOptions]);
  const timelineRows = useMemo(() => visibleRows, [visibleRows]);
  const mostActiveTeam = useMemo(
    () =>
      [...activityCards].sort((left, right) => {
        if (right.volume !== left.volume) return right.volume - left.volume;
        return right.income - left.income;
      })[0] ?? null,
    [activityCards],
  );
  const biggestBuy = useMemo(
    () => filteredRows.filter((row) => row.type === "buy").sort((left, right) => right.fee - left.fee)[0] ?? null,
    [filteredRows],
  );
  const biggestSale = useMemo(
    () => filteredRows.filter((row) => row.type === "sell").sort((left, right) => right.fee - left.fee)[0] ?? null,
    [filteredRows],
  );
  const bestProfit = useMemo(
    () =>
      filteredRows
        .filter((row) => row.type === "sell" && row.guv != null)
        .sort((left, right) => (right.guv ?? Number.NEGATIVE_INFINITY) - (left.guv ?? Number.NEGATIVE_INFINITY))[0] ?? null,
    [filteredRows],
  );
  const activeTeamStory = mostActiveTeam;
  const selectedRow =
    timelineRows.find((row) => row.transferId === selectedTransferId) ??
    filteredRows.find((row) => row.transferId === selectedTransferId) ??
    timelineRows[0] ??
    null;

  const selectedTimelineIndex = useMemo(
    () => (selectedTransferId ? timelineRows.findIndex((row) => row.transferId === selectedTransferId) : -1),
    [selectedTransferId, timelineRows],
  );

  function moveTimelineSelection(key: "ArrowDown" | "ArrowUp" | "Home" | "End") {
    if (!timelineRows.length) {
      return;
    }
    const currentIndex = selectedTimelineIndex >= 0 ? selectedTimelineIndex : 0;
    let targetIndex = currentIndex;
    if (key === "ArrowDown") {
      targetIndex = Math.min(timelineRows.length - 1, currentIndex + 1);
    } else if (key === "ArrowUp") {
      targetIndex = Math.max(0, currentIndex - 1);
    } else if (key === "Home") {
      targetIndex = 0;
    } else {
      targetIndex = timelineRows.length - 1;
    }
    const nextRow = timelineRows[targetIndex];
    if (!nextRow) {
      return;
    }
    setSelectedTransferId(nextRow.transferId);
    const node = timelineCardRefs.current.get(nextRow.transferId);
    node?.scrollIntoView({ block: "nearest" });
    node?.focus({ preventScroll: true });
  }

  function handleTimelineKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    moveTimelineSelection(event.key as "ArrowDown" | "ArrowUp" | "Home" | "End");
  }

  function handleTimelineCardKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, transferId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedTransferId(transferId);
      return;
    }
    handleTimelineKeyDown(event);
  }

  return (
    <div className="transfer-history-v2-shell">
      <div className="transfer-history-v2-header">
        <div className="transfer-history-v2-title">
          <TooltipHeading
            as="h2"
            tooltip="Deal-Flow: Scope, Story, Teambewegung und konkrete Transfers."
          >
            Transferhistorie
          </TooltipHeading>
          <div className="foundation-view-source-row">
            <span className="pill foundation-source-pill">{sourceBadgeLabel}</span>
            <span className="muted">
              {saveName} · Angefragt {requestedScopeLabel} · Aktiv {resolvedScopeLabel}
            </span>
          </div>
        </div>
      </div>

      <section className="transfer-history-v2-filters panel">
        <div className="transfer-history-v2-filter-grid">
          <label className="filter-field">
            <span>Saison</span>
            <select className="input" value={seasonFilter} onChange={(event) => onSeasonFilterChange(event.target.value)}>
              {seasonOptions.map((season) => (
                <option key={season.seasonId} value={season.seasonId}>
                  {season.label}
                </option>
              ))}
              <option value={allSeasonsValue}>Alle Seasons</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Team</span>
            <select className="input" value={teamFilter} onChange={(event) => onTeamFilterChange(event.target.value)}>
              <option value="ALL">Alle Teams</option>
              {teamOptions.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.shortCode} · {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Typ</span>
            <select className="input" value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value)}>
              <option value="ALL">Alle Typen</option>
              <option value="buy">Käufe</option>
              <option value="sell">Verkäufe</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Klasse</span>
            <select className="input" value={classFilter} onChange={(event) => onClassFilterChange(event.target.value)}>
              <option value="ALL">Alle Klassen</option>
              {classOptions.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Quelle</span>
            <select className="input" value={sourceFilter} onChange={(event) => onSourceFilterChange(event.target.value)}>
              <option value="ALL">Alle Quellen</option>
              {sourceOptions.map((source) => (
                <option key={source.key} value={source.key}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Spieler</span>
            <input
              className="input"
              value={search}
              placeholder="Name suchen"
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
        </div>
        <div className="transfer-history-v2-filter-meta">
          <span className="muted">
            Zeigt {historyVisibleRangeLabel} von {filteredRows.length} Treffern · geladen {totalLoaded} von {totalAvailable}
          </span>
          <button className="secondary-button inline-button" type="button" onClick={onResetFilters}>
            Filter reset
          </button>
          {!isAllSeasons && hasMore && onLoadMore ? (
            <button className="secondary-button inline-button" type="button" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? "Lädt…" : "Mehr laden"}
            </button>
          ) : null}
        </div>
      </section>

      {scopeWarning ? (
        <div className="transfer-callout is-warning">
          <strong>Scope-Hinweis</strong>
          <span>{scopeWarning}</span>
        </div>
      ) : null}
      {error ? (
        <div className="transfer-callout is-blocked">
          <strong>Historie konnte nicht geladen werden</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="transfer-history-v2-summary-grid">
        <article className="metric-card">
          <span>Deals im Scope</span>
          <strong>{summary.count}</strong>
          <small>{isAllSeasons ? "mehrere Seasons" : "aktuelle Season"}</small>
        </article>
        <article className="metric-card">
          <span>Ausgaben</span>
          <strong>{formatTransfermarktCurrency(summary.buyFee)}</strong>
          <small>Käufe gesamt</small>
        </article>
        <article className="metric-card">
          <span>Einnahmen</span>
          <strong>{formatTransfermarktCurrency(summary.sellFee)}</strong>
          <small>Verkäufe gesamt</small>
        </article>
        <article className="metric-card">
          <span>Netto</span>
          <strong className={summary.netTransferBalance >= 0 ? "text-positive" : "text-negative"}>
            {formatSignedMoney(summary.netTransferBalance)}
          </strong>
          <small>Transferbilanz</small>
        </article>
        <article className="metric-card">
          <span>Ø Fee</span>
          <strong>{formatTransfermarktCurrency(summary.averageFee ?? null)}</strong>
          <small>pro Deal</small>
        </article>
        <article className="metric-card">
          <span>Ø GuV</span>
          <strong className={summary.averageProfit != null && summary.averageProfit >= 0 ? "text-positive" : "text-negative"}>
            {summary.averageProfit != null ? formatSignedMoney(summary.averageProfit) : "—"}
          </strong>
          <small>bei Verkäufen</small>
        </article>
      </div>

      <div className="transfer-history-v2-story-grid">
        <article className="transfer-history-v2-story-card is-buy">
          <span>Teuerster Kauf</span>
          <strong>{biggestBuy?.playerName ?? "—"}</strong>
          <small>{biggestBuy ? `${biggestBuy.toTeamName ?? biggestBuy.toTeamId ?? "—"} · ${formatTransfermarktCurrency(biggestBuy.fee)}` : "keine Kaufbewegung"}</small>
        </article>
        <article className="transfer-history-v2-story-card is-sell">
          <span>Teuerster Verkauf</span>
          <strong>{biggestSale?.playerName ?? "—"}</strong>
          <small>{biggestSale ? `${biggestSale.fromTeamName ?? biggestSale.fromTeamId ?? "—"} · ${formatTransfermarktCurrency(biggestSale.fee)}` : "kein Verkauf"}</small>
        </article>
        <article className="transfer-history-v2-story-card is-profit">
          <span>Bester GuV</span>
          <strong>{bestProfit?.playerName ?? "—"}</strong>
          <small>{bestProfit?.guv != null ? formatSignedMoney(bestProfit.guv) : "kein belastbarer Gewinnwert"}</small>
        </article>
        <article className="transfer-history-v2-story-card is-activity">
          <span>Meiste Bewegung</span>
          <strong>{activeTeamStory?.teamName ?? "—"}</strong>
          <small>{activeTeamStory ? `${activeTeamStory.volume} Deals · Netto ${formatSignedMoney(activeTeamStory.net)}` : "noch keine Teamaktivität"}</small>
        </article>
      </div>

      <div className="transfer-history-v2-layout">
        <section className="panel transfer-history-v2-panel">
          <div className="panel-header">
            <h3>Deal-Strom</h3>
            <div className="transfer-history-v2-layout-toggle" data-testid="transfer-history-layout-toggle">
              <button type="button" className={`secondary-button inline-button${historyLayout === "timeline" ? " is-active" : ""}`} onClick={() => setHistoryLayout("timeline")}>
                Timeline
              </button>
              <button type="button" className={`secondary-button inline-button${historyLayout === "table" ? " is-active" : ""}`} onClick={() => setHistoryLayout("table")}>
                Tabelle
              </button>
            </div>
            <span className="muted">{timelineRows.length} sichtbar</span>
          </div>
          {historyLayout === "timeline" ? (
          <>
          <div
            className="transfer-history-v2-timeline"
            ref={timelineListRef}
            role="listbox"
            aria-label="Deal-Timeline"
            aria-activedescendant={selectedTransferId ? `transfer-history-timeline-${selectedTransferId}` : undefined}
            tabIndex={0}
            onKeyDown={handleTimelineKeyDown}
          >
            {timelineRows.length ? (
              timelineRows.map((row) => (
                <div
                  key={row.transferId}
                  id={`transfer-history-timeline-${row.transferId}`}
                  role="option"
                  aria-selected={selectedRow?.transferId === row.transferId}
                  tabIndex={selectedRow?.transferId === row.transferId ? 0 : -1}
                  ref={(node) => {
                    if (node) {
                      timelineCardRefs.current.set(row.transferId, node);
                    } else {
                      timelineCardRefs.current.delete(row.transferId);
                    }
                  }}
                  className={`transfer-history-v2-timeline-card ${getTransferTone(row.type)}${selectedRow?.transferId === row.transferId ? " is-selected" : ""}`}
                  onClick={() => {
                    setSelectedTransferId(row.transferId);
                    timelineListRef.current?.focus({ preventScroll: true });
                  }}
                  onKeyDown={(event) => handleTimelineCardKeyDown(event, row.transferId)}
                >
                  <div className="transfer-history-v2-timeline-head">
                    <span className={`transfer-status-pill ${getTransferTone(row.type)}`}>{formatTransferType(row.type)}</span>
                    <small>{new Date(row.happenedAt).toLocaleString("de-DE")}</small>
                  </div>
                  <button
                    type="button"
                    className="table-link-button transfer-history-v2-player-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenPlayer(row.playerId);
                    }}
                  >
                    {row.playerName}
                  </button>
                  <span className="muted">{getTimelineTargetLabel(row)}</span>
                  <div className="transfer-history-v2-timeline-meta">
                    <span>{formatTransfermarktCurrency(row.fee)}</span>
                    <span>{row.phase ?? row.matchdayId ?? row.seasonLabel}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="transfer-market-empty-card">
                <strong>Keine Transfers im aktuellen Filter</strong>
                <span>Wähle eine andere Season, Teamspur oder lockere Klasse/Quelle etwas.</span>
              </div>
            )}
          </div>
          {isAllSeasons && historyPageCount > 1 ? (
            <div className="transfer-history-v2-pager">
              <span className="pill">Seite {historyPage} / {historyPageCount}</span>
              <button className="secondary-button inline-button" type="button" disabled={historyPage <= 1} onClick={onPrevPage}>
                Zurück
              </button>
              <button className="secondary-button inline-button" type="button" disabled={historyPage >= historyPageCount} onClick={onNextPage}>
                Weiter
              </button>
            </div>
          ) : null}
          </>
          ) : (
            <p className="muted">Kompakte Deal-Liste — siehe Tabelle unten.</p>
          )}
        </section>

        <section className="panel transfer-history-v2-panel transfer-history-v2-spotlight">
          <div className="panel-header">
            <h3>Spotlight</h3>
            <span className="muted">{selectedRow ? selectedRow.seasonLabel : "—"}</span>
          </div>
          {selectedRow ? (
            <>
              <div className="transfer-history-v2-spotlight-hero">
                <FoundationPlayerPortraitCard
                  playerId={selectedRow.playerId}
                  name={selectedRow.playerName}
                  portraitUrl={selectedRow.portraitUrl}
                  portraitInitials={selectedRow.portraitInitials}
                  playerOvr={null}
                  playerMvs={null}
                  pow={selectedRow.pow}
                  spe={selectedRow.spe}
                  men={selectedRow.men}
                  soc={selectedRow.soc}
                  leagueHeatPools={createEmptyLeaguePlayerHeatPools()}
                  variant="team"
                  playerClassName={selectedRow.className}
                  subMeta={[selectedRow.className, selectedRow.race].filter(Boolean).join(" · ") || null}
                  economyStats={[
                    { label: "Fee", value: formatTransfermarktCurrency(selectedRow.fee) },
                    { label: "MW", value: formatTransfermarktCurrency(selectedRow.marketValue) },
                    {
                      label: "Gehalt",
                      value: formatTransfermarktCurrency(selectedRow.salary),
                      delta:
                        selectedRow.remainingContractLength != null
                          ? `${selectedRow.remainingContractLength}J`
                          : null,
                    },
                  ]}
                  interactive
                  onOpen={() => onOpenPlayer(selectedRow.playerId)}
                  title={`${selectedRow.playerName} Profil öffnen`}
                  className="transfer-history-v2-portrait-card"
                  portraitLoading="eager"
                  portraitFetchPriority="high"
                  footerSlot={
                    selectedRow.guv != null ? (
                      <span className={`transfer-history-v2-spotlight-guv ${selectedRow.guv >= 0 ? "is-positive" : "is-negative"}`}>
                        GuV {formatSignedMoney(selectedRow.guv)}
                      </span>
                    ) : null
                  }
                />
                <div className="transfer-history-v2-spotlight-copy">
                  <span className={`transfer-status-pill ${getTransferTone(selectedRow.type)}`}>{formatTransferType(selectedRow.type)}</span>
                  <div className="transfer-history-v2-icon-row">
                    <ClassIcon classNameValue={selectedRow.className} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
                    <RaceIcon race={selectedRow.race} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
                  </div>
                  <div className="transfer-history-v2-team-route">
                    {selectedRow.fromTeamId && selectedRow.fromTeamName ? (
                      <button
                        type="button"
                        className="table-link-button"
                        onClick={() => onOpenTeam(selectedRow.fromTeamId!)}
                      >
                        {selectedRow.fromTeamName}
                      </button>
                    ) : selectedRow.fromTeamName ? (
                      <span>{selectedRow.fromTeamName}</span>
                    ) : null}
                    {selectedRow.fromTeamName || selectedRow.toTeamName ? <span aria-hidden="true">→</span> : null}
                    {selectedRow.toTeamId && selectedRow.toTeamName ? (
                      <button
                        type="button"
                        className="table-link-button"
                        onClick={() => onOpenTeam(selectedRow.toTeamId!)}
                      >
                        {selectedRow.toTeamName}
                      </button>
                    ) : selectedRow.toTeamName ? (
                      <span>{selectedRow.toTeamName}</span>
                    ) : null}
                  </div>
                  <small className="muted">
                    {new Date(selectedRow.happenedAt).toLocaleString("de-DE")} · {selectedRow.sourceLabel} ·{" "}
                    {selectedRow.phase ?? selectedRow.matchdayId ?? selectedRow.seasonLabel}
                  </small>
                </div>
              </div>
            </>
          ) : (
            <p className="muted" title="Wähle links einen Deal für Profil, Zahlen und Teamweg.">
              Deal wählen
            </p>
          )}
        </section>

        <section className="panel transfer-history-v2-panel">
          <div className="panel-header">
            <h3>Teambewegung</h3>
            <span className="muted">{activityCards.length} Teams</span>
          </div>
          <div className="transfer-history-v2-team-list">
            {activityCards.map((team) => (
              <button
                key={team.teamId}
                type="button"
                className="transfer-history-v2-team-card is-compact"
                title={`${team.teamName} · ${team.volume} Deals · Erlös ${formatTransfermarktCurrency(team.income)} · Ausgaben ${formatTransfermarktCurrency(team.spend)}`}
                onClick={() => onOpenTeam(team.teamId)}
              >
                <div className="transfer-history-v2-team-compact-main">
                  <span className="transfer-history-v2-team-code">{team.shortCode}</span>
                  <strong className="transfer-history-v2-team-compact-name">{team.teamName}</strong>
                  <em className={`transfer-history-v2-team-compact-income${team.income > 0 ? " is-positive" : ""}`}>
                    {formatTransfermarktCurrency(team.income)}
                  </em>
                </div>
                <small className="transfer-history-v2-team-compact-meta">
                  {team.volume} Deals · {team.buys}K/{team.sells}V · Net {formatSignedMoney(team.net)}
                </small>
              </button>
            ))}
            {!activityCards.length ? <p className="muted">Noch keine Teambewegungen im aktuellen Scope.</p> : null}
          </div>
          {seasonBreakdown.length ? (
            <div className="transfer-history-v2-breakdown">
              <strong>Season-Verteilung</strong>
              <div className="transfer-history-v2-breakdown-row">
                {seasonBreakdown.map(([label, count]) => (
                  <span key={label} className="pill">
                    {label} {count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {historyLayout === "table" ? (
      <section className="panel transfer-history-v2-table-panel">
        <div className="panel-header">
          <h3>Deal-Liste</h3>
          <span className="muted">kompakt für schnelles Lesen</span>
        </div>
        <div className="table-shell">
          <table className="team-table transfer-history-v2-table">
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
                <tr key={`table-${row.transferId}`}>
                  <td>
                    <div className="table-player-cell">
                      <strong>{new Date(row.happenedAt).toLocaleDateString("de-DE")}</strong>
                      <span>{row.phase ?? row.matchdayId ?? row.seasonLabel}</span>
                    </div>
                  </td>
                  <td>
                    <button className="table-link-button" type="button" onClick={() => onOpenPlayer(row.playerId)}>
                      {row.playerName}
                    </button>
                  </td>
                  <td><span className={`transfer-status-pill ${getTransferTone(row.type)}`}>{formatTransferType(row.type)}</span></td>
                  <td>
                    <div className="table-player-cell">
                      {row.fromTeamId && row.fromTeamName ? (
                        <button
                          className="table-link-button"
                          type="button"
                          onClick={() => onOpenTeam(row.fromTeamId!)}
                        >
                          {row.fromTeamName}
                        </button>
                      ) : (
                        <strong>{row.fromTeamName ?? "Free Agent"}</strong>
                      )}
                      <span>
                        {row.fromTeamName ? `${row.fromTeamName} → ${row.toTeamName ?? "FA"}` : row.toTeamName ?? "—"}
                      </span>
                      {row.toTeamId && row.toTeamName ? (
                        <button
                          className="table-link-button"
                          type="button"
                          onClick={() => onOpenTeam(row.toTeamId!)}
                        >
                          {row.toTeamName}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td>{formatTransfermarktCurrency(row.fee)}</td>
                  <td>{formatTransfermarktCurrency(row.salary)}</td>
                  <td>{formatTransfermarktCurrency(row.marketValue)}</td>
                  <td className={row.guv != null && row.guv >= 0 ? "text-positive" : row.guv != null ? "text-negative" : undefined}>
                    {row.guv != null ? formatSignedMoney(row.guv) : "—"}
                  </td>
                  <td>{row.sourceLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </div>
  );
}
