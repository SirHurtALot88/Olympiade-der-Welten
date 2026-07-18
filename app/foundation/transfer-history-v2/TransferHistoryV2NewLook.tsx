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
  NlRadar,
  NlSparkline,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  type NlAxisKey,
} from "@/components/foundation/new-look";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

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

// Scope-Labels kommen als "<saveId> / <seasonId|Alle Seasons>". Für die UI
// nur den menschenlesbaren Season-Teil zeigen ("season-1" → "Season 1") und die
// interne Save-ID bewusst weglassen — kein Roh-Dev-String im Kopfbereich.
function formatNlScopeSeason(scopeLabel: string) {
  const separatorIndex = scopeLabel.indexOf(" / ");
  const seasonPart = (separatorIndex >= 0 ? scopeLabel.slice(separatorIndex + 3) : scopeLabel).trim();
  if (/season-\d+/i.test(seasonPart)) {
    return getCanonicalSeasonLabel({ seasonId: seasonPart });
  }
  return seasonPart || "—";
}

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

// #D10: CSV-Feld robust escapen — immer quoten und interne Quotes verdoppeln
// (RFC-4180-Stil). So bleiben Semikolons, Kommas, Zeilenumbrüche und deutsche
// Zahlenformate im Feld unversehrt.
function escapeCsvField(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

// #D10: Deal-Liste als CSV (Separator ";", UTF-8 BOM für Excel/DE). Reihen
// stammen 1:1 aus den bereits sichtbaren `filteredRows` — keine neuen Daten.
function buildTransferHistoryCsv(rows: TransferHistoryV2Row[]) {
  const header = ["Datum", "Saison", "Richtung", "Spieler", "Von", "Nach", "Ablöse (EUR)"];
  const lines = [header.map(escapeCsvField).join(";")];
  for (const row of rows) {
    lines.push(
      [
        new Date(row.happenedAt).toLocaleDateString("de-DE"),
        row.seasonLabel,
        formatNlTransferType(row.type),
        row.playerName,
        row.fromTeamName ?? row.fromTeamId ?? "",
        row.toTeamName ?? row.toTeamId ?? "",
        Number.isFinite(row.fee) ? Math.round(row.fee) : "",
      ]
        .map(escapeCsvField)
        .join(";"),
    );
  }
  // ﻿ = BOM, \r\n = Excel-freundliche Zeilenenden.
  return `﻿${lines.join("\r\n")}`;
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
  ownTeamId,
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
  // Zwei-Fokus-Rework: die Seite trennt jetzt "Spieler" (Deal-Strom + Spotlight
  // eines Deals) sauber von "Teams" (Transferbilanzen + Season-Charts), statt
  // beides gleichzeitig in einem 3-Spalten-Raster zu quetschen. Filter, Bilanz-
  // KPIs und Season-Spotlights bleiben als geteilter Kopf über beiden Tabs.
  const [focus, setFocus] = useState<"players" | "teams">("players");
  // #73: Teambewegungs-Liste sortierbar über Sub-Tabs.
  // #2: Ohne Verkäufe im Scope ist "Erlös" durchgehend 0 (nur Käufe) — dann
  // standardmässig auf "Volumen" starten, damit kein Null-Bildschirm erscheint.
  // "Erlös" bleibt weiterhin frei wählbar.
  const [teamSort, setTeamSort] = useState<"volume" | "income" | "net">(() =>
    activityCards.some((team) => team.sells > 0) ? "income" : "volume",
  );

  // #1: Scope-Kopf ohne interne Save-ID; Season menschenlesbar. "Angefragt" nur
  // zeigen, wenn der aufgelöste Scope davon abweicht (Fallback).
  const resolvedScopeSeasonLabel = formatNlScopeSeason(resolvedScopeLabel);
  const requestedScopeSeasonLabel = formatNlScopeSeason(requestedScopeLabel);

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

  // Transferbilanz über Seasons: Netto (Einnahmen − Ausgaben) je Season-Label,
  // gleiche Buy/Sell-Aufteilung wie `summary.netTransferBalance`
  // (`sellFee − buyFee`, `contract_exit` zählt dort bewusst nicht mit) —
  // reine Umgruppierung von `filteredRows`, keine neuen Werte.
  const seasonNetBars = useMemo(() => {
    const spendByLabel = new Map<string, number>();
    const incomeByLabel = new Map<string, number>();
    for (const row of filteredRows) {
      if (row.type === "buy") {
        spendByLabel.set(row.seasonLabel, (spendByLabel.get(row.seasonLabel) ?? 0) + row.fee);
      } else if (row.type === "sell") {
        incomeByLabel.set(row.seasonLabel, (incomeByLabel.get(row.seasonLabel) ?? 0) + row.fee);
      }
    }
    return seasonBreakdown.map(([label]) => {
      const net = (incomeByLabel.get(label) ?? 0) - (spendByLabel.get(label) ?? 0);
      return { label, value: net, tone: net >= 0 ? ("good" as const) : ("risk" as const) };
    });
  }, [filteredRows, seasonBreakdown]);

  // Nur zeigen, wenn wirklich mehrere Seasons im Scope stecken — bei genau
  // einer Season entspricht der Balken 1:1 dem "Netto"-Chip oben.
  const showSeasonNetChart = isAllSeasons || seasonBreakdown.length >= 2;

  // #74: Season-Balken klickbar → Saison-Filter. Mappt den Season-Label aus
  // `seasonBreakdown` auf die echte `seasonId` aus `seasonOptions` (gleiche
  // kanonische Labels) — ohne Match bleibt der Balken nicht-klickbar statt
  // eine ID zu erfinden.
  const seasonIdByLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of seasonOptions) {
      map.set(option.label, option.seasonId);
    }
    return map;
  }, [seasonOptions]);

  // #73: Teambewegungs-Liste sortierbar (Volumen/Erlös/Netto) — reine
  // Umsortierung der bereits berechneten `activityCards`, keine neuen Werte.
  const sortedActivityCards = useMemo(() => {
    const list = [...activityCards];
    list.sort((left, right) => {
      if (teamSort === "volume") return right.volume - left.volume;
      if (teamSort === "net") return right.net - left.net;
      return right.income - left.income;
    });
    return list;
  }, [activityCards, teamSort]);

  // #20: POW/SPE/MEN/SOC-Radar im Spotlight — nur reale, endliche Achsenwerte.
  const selectedRowAxes = useMemo(() => {
    if (!selectedRow) return [];
    const axes: { key: NlAxisKey; value: number }[] = [];
    if (typeof selectedRow.pow === "number" && Number.isFinite(selectedRow.pow)) axes.push({ key: "pow", value: selectedRow.pow });
    if (typeof selectedRow.spe === "number" && Number.isFinite(selectedRow.spe)) axes.push({ key: "spe", value: selectedRow.spe });
    if (typeof selectedRow.men === "number" && Number.isFinite(selectedRow.men)) axes.push({ key: "men", value: selectedRow.men });
    if (typeof selectedRow.soc === "number" && Number.isFinite(selectedRow.soc)) axes.push({ key: "soc", value: selectedRow.soc });
    return axes;
  }, [selectedRow]);

  // #28: Fee-vs-Marktwert Deal-Bewertung (fee − marketValue) — nur wenn ein
  // realer Marktwert > 0 vorliegt, sonst keine erfundene Bewertung.
  const selectedFeeVsMarketValue = useMemo(() => {
    if (!selectedRow) return null;
    if (!Number.isFinite(selectedRow.fee) || !Number.isFinite(selectedRow.marketValue) || selectedRow.marketValue <= 0) {
      return null;
    }
    return selectedRow.fee - selectedRow.marketValue;
  }, [selectedRow]);

  // #D10: Kumulative Netto-Ausgaben (Käufe − Verkäufe) des EIGENEN Teams über
  // die Saison. Fog-safe — nur die ohnehin sichtbaren, öffentlichen Deals des
  // eigenen Teams; keine fremden Werte. Gleiche Buy/Sell-Aufteilung wie
  // `summary.netTransferBalance` (contract_exit zählt bewusst nicht mit).
  const ownTeamName = useMemo(
    () => (ownTeamId ? teamOptions.find((team) => team.teamId === ownTeamId)?.name ?? null : null),
    [ownTeamId, teamOptions],
  );

  const ownNetSpendSeries = useMemo(() => {
    if (!ownTeamId) return [];
    const ownDeals = filteredRows
      .filter(
        (row) =>
          (row.type === "buy" && row.toTeamId === ownTeamId) ||
          (row.type === "sell" && row.fromTeamId === ownTeamId),
      )
      .sort((left, right) => Date.parse(left.happenedAt) - Date.parse(right.happenedAt));
    let cumulative = 0;
    return ownDeals.map((row) => {
      // Netto-Ausgaben: Kauf erhöht, Verkauf senkt (Käufe − Verkäufe).
      cumulative += row.type === "buy" ? row.fee : -row.fee;
      return { row, cumulative };
    });
  }, [filteredRows, ownTeamId]);

  const ownNetSpendPoints = useMemo(() => ownNetSpendSeries.map((entry) => entry.cumulative), [ownNetSpendSeries]);
  const ownNetSpendFinal = ownNetSpendPoints.length ? ownNetSpendPoints[ownNetSpendPoints.length - 1] : 0;

  // #D10: CSV-Export der aktuell sichtbaren Deal-Liste (fog-safe: exakt
  // `filteredRows`). Client-seitiger Blob + Download-Link, keine Persistenz.
  const csvRows = useMemo(
    () => [...filteredRows].sort((left, right) => Date.parse(left.happenedAt) - Date.parse(right.happenedAt)),
    [filteredRows],
  );
  const canExportCsv = csvRows.length > 0;

  function handleExportCsv() {
    if (!canExportCsv || typeof document === "undefined") return;
    const csv = buildTransferHistoryCsv(csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const scopeSlug = resolvedScopeSeasonLabel.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, "") || "scope";
    anchor.href = url;
    anchor.download = `transferhistorie-${scopeSlug}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="nl-thist" data-new-look="true">
      <NlCard
        className="nl-thist-header-card"
        eyebrow="Deal-Flow"
        title="Transferhistorie"
        actions={<span className="nl-thist-source-pill">{sourceBadgeLabel}</span>}
      >
        <p className="nl-thist-header-meta">
          {saveName} · {resolvedScopeSeasonLabel}
          {requestedScopeSeasonLabel !== resolvedScopeSeasonLabel ? ` · angefragt ${requestedScopeSeasonLabel}` : ""}
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
        <StatChip
          label="Ausgaben"
          value={formatTransfermarktCurrency(summary.buyFee)}
          tone="risk"
          sub="Käufe gesamt"
          onClick={() => onTypeFilterChange("buy")}
          title="Nur Käufe anzeigen"
        />
        <StatChip
          label="Einnahmen"
          value={formatTransfermarktCurrency(summary.sellFee)}
          tone="good"
          sub="Verkäufe gesamt"
          onClick={() => onTypeFilterChange("sell")}
          title="Nur Verkäufe anzeigen"
        />
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

      {/* #2: Story-Kacheln als Portale — Klick wählt den jeweiligen Deal
          (Spotlight) bzw. öffnet das aktivste Team; nur klickbar, wenn ein
          echter Zieldatensatz existiert. */}
      <div className="nl-thist-story-grid">
        <NlCard
          className="nl-thist-story-card is-buy"
          eyebrow="Teuerster Kauf"
          title={biggestBuy?.playerName ?? "—"}
          interactive={!!biggestBuy}
          onClick={biggestBuy ? () => onSelectTransfer(biggestBuy.transferId) : undefined}
        >
          <p className="nl-thist-story-meta">
            {biggestBuy
              ? `${biggestBuy.toTeamName ?? biggestBuy.toTeamId ?? "—"} · ${formatTransfermarktCurrency(biggestBuy.fee)}`
              : "keine Kaufbewegung"}
          </p>
        </NlCard>
        <NlCard
          className="nl-thist-story-card is-sell"
          eyebrow="Teuerster Verkauf"
          title={biggestSale?.playerName ?? "—"}
          interactive={!!biggestSale}
          onClick={biggestSale ? () => onSelectTransfer(biggestSale.transferId) : undefined}
        >
          <p className="nl-thist-story-meta">
            {biggestSale
              ? `${biggestSale.fromTeamName ?? biggestSale.fromTeamId ?? "—"} · ${formatTransfermarktCurrency(biggestSale.fee)}`
              : "kein Verkauf"}
          </p>
        </NlCard>
        <NlCard
          className="nl-thist-story-card is-profit"
          eyebrow="Bester GuV"
          title={bestProfit?.playerName ?? "—"}
          interactive={!!bestProfit}
          onClick={bestProfit ? () => onSelectTransfer(bestProfit.transferId) : undefined}
        >
          <p className="nl-thist-story-meta">
            {bestProfit?.guv != null ? formatNlSignedMoney(bestProfit.guv) : "kein belastbarer Gewinnwert"}
          </p>
        </NlCard>
        <NlCard
          className="nl-thist-story-card is-activity"
          eyebrow="Meiste Bewegung"
          title={mostActiveTeam?.teamName ?? "—"}
          interactive={!!mostActiveTeam}
          onClick={mostActiveTeam ? () => onOpenTeam(mostActiveTeam.teamId) : undefined}
        >
          <p className="nl-thist-story-meta">
            {mostActiveTeam
              ? `${mostActiveTeam.volume} Deals · Netto ${formatNlSignedMoney(mostActiveTeam.net)}`
              : "noch keine Teamaktivität"}
          </p>
        </NlCard>
      </div>

      <NlSubTabs
        className="nl-thist-focus-tabs"
        aria-label="Transferhistorie-Fokus"
        activeId={focus}
        onSelect={(id) => setFocus(id as "players" | "teams")}
        items={[
          { id: "players", label: "Spieler" },
          { id: "teams", label: "Teams" },
        ]}
      />

      {focus === "players" ? (
        <div className="nl-thist-players-layout">
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
            <div className="nl-thist-timeline is-spine" role="list" aria-label="Deal-Timeline">
              {visibleRows.length ? (
                (() => {
                  // #75: echte Zeit-Spine mit Saison-/Matchday-Gruppierung —
                  // reine Gruppierungs-Marker vor der bestehenden, unveränderten
                  // Sortierung von `visibleRows`; keine Umsortierung.
                  let lastGroupKey: string | null = null;
                  return visibleRows.map((row) => {
                    const groupLabel = `${row.seasonLabel} · ${row.phase ?? row.matchdayId ?? "—"}`;
                    const groupKey = `${row.seasonId}__${row.phase ?? row.matchdayId ?? "—"}`;
                    const isNewGroup = groupKey !== lastGroupKey;
                    lastGroupKey = groupKey;
                    return (
                      <div key={row.transferId} className="nl-thist-spine-row">
                        {isNewGroup ? (
                          <div className="nl-thist-spine-marker">
                            <span className="nl-thist-spine-dot" aria-hidden="true" />
                            <span className="nl-thist-spine-label">{groupLabel}</span>
                          </div>
                        ) : null}
                        <button
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
                      </div>
                    );
                  });
                })()
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
                  {/* #3: Klasse/Rasse als beschriftete Identitäts-Chips —
                      damit die Icons nicht mit Team-Wappen verwechselt werden. */}
                  <div className="nl-thist-spotlight-identity">
                    <span className="nl-thist-eyebrow">Klasse &amp; Rasse</span>
                    <div className="nl-thist-spotlight-icons">
                      <span className="nl-thist-identity-chip" title={`Klasse: ${selectedRow.className ?? "unbekannt"}`}>
                        <ClassIcon
                          classNameValue={selectedRow.className}
                          className="table-identity-icon-chip"
                          iconClassName="table-identity-icon-image"
                        />
                        <span className="nl-thist-identity-label">{selectedRow.className ?? "—"}</span>
                      </span>
                      <span className="nl-thist-identity-chip" title={`Rasse: ${selectedRow.race ?? "unbekannt"}`}>
                        <RaceIcon
                          race={selectedRow.race}
                          className="table-identity-icon-chip"
                          iconClassName="table-identity-icon-image"
                        />
                        <span className="nl-thist-identity-label">{selectedRow.race ?? "—"}</span>
                      </span>
                    </div>
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
              {selectedFeeVsMarketValue != null ? (
                <p className="nl-thist-spotlight-dealcheck">
                  <span className="nl-thist-eyebrow">Deal-Bewertung · Fee vs. MW</span>
                  <NlDeltaChip
                    value={selectedFeeVsMarketValue}
                    invert
                    format={(value) => formatNlSignedMoney(value)}
                    title="Fee minus Marktwert zum Zeitpunkt des Deals — positiv heißt teurer als der Marktwert"
                  />
                </p>
              ) : null}
              {selectedRowAxes.length ? (
                <div className="nl-thist-spotlight-radar">
                  <span className="nl-thist-eyebrow">Achsenprofil zum Zeitpunkt des Deals</span>
                  <NlRadar
                    axes={selectedRowAxes}
                    showValues
                    aria-label={`Achsenprofil von ${selectedRow.playerName}`}
                    className="nl-thist-spotlight-radar-chart"
                  />
                </div>
              ) : null}
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
        </div>
      ) : (
        <div className="nl-thist-teams-layout">
        {/* #D10: Eigene kumulative Netto-Ausgaben (Sparkline) + CSV-Export der
            sichtbaren Deal-Liste. Fog-safe: nur eigene, ohnehin sichtbare Deals.
            Im Teams-Fokus verortet — team-/finanzbezogen, hält den Spieler-Tab luftig. */}
        <NlCard
          className="nl-thist-own-card"
          eyebrow="Eigenes Team"
          title="Netto-Ausgaben-Verlauf"
          actions={
            <button
              type="button"
              className="nl-thist-inline-action"
              onClick={handleExportCsv}
              disabled={!canExportCsv}
              title={
                canExportCsv ? "Sichtbare Deal-Liste als CSV herunterladen" : "Noch keine Deals zum Exportieren"
              }
            >
              CSV exportieren
            </button>
          }
        >
          {ownTeamId ? (
            ownNetSpendSeries.length ? (
              <div className="nl-thist-own-spend">
                <div className="nl-thist-own-spend-head">
                  <span className="nl-thist-eyebrow">
                    Kumulative Netto-Ausgaben{ownTeamName ? ` · ${ownTeamName}` : ""} (Käufe − Verkäufe)
                  </span>
                  <strong
                    className={`nl-tnum${ownNetSpendFinal > 0 ? " is-negative" : ownNetSpendFinal < 0 ? " is-positive" : ""}`}
                  >
                    {formatNlSignedMoney(ownNetSpendFinal)}
                  </strong>
                </div>
                <NlSparkline
                  points={ownNetSpendPoints}
                  tone={ownNetSpendFinal > 0 ? "risk" : "good"}
                  aria-label="Kumulative Netto-Ausgaben des eigenen Teams über die Saison"
                  className="nl-thist-own-sparkline"
                />
                <small className="nl-thist-spotlight-meta nl-tnum">
                  {ownNetSpendSeries.length} eigene Deals · Δ {formatNlSignedMoney(ownNetSpendFinal)}
                </small>
              </div>
            ) : (
              <p className="nl-thist-muted">Noch keine eigenen Deals im aktuellen Scope — der Verlauf bleibt flach.</p>
            )
          ) : (
            <p className="nl-thist-muted">Kein eigenes Team im Kontext — Netto-Ausgaben-Verlauf nicht verfügbar.</p>
          )}
          {!canExportCsv ? <p className="nl-thist-muted">Noch keine Deals — CSV-Export deaktiviert.</p> : null}
        </NlCard>

        <NlCard
          className="nl-thist-teams-card"
          eyebrow="Teambewegung"
          title={`${activityCards.length} Teams`}
          actions={
            activityCards.length ? (
              <NlSubTabs
                className="nl-thist-team-sort-tabs"
                aria-label="Teambewegung sortieren"
                activeId={teamSort}
                onSelect={(id) => setTeamSort(id as "volume" | "income" | "net")}
                items={[
                  { id: "volume", label: "Volumen" },
                  { id: "income", label: "Erlös" },
                  { id: "net", label: "Netto" },
                ]}
              />
            ) : null
          }
        >
          <div className="nl-thist-team-list">
            {sortedActivityCards.map((team) => (
              <button
                key={team.teamId}
                type="button"
                className="nl-thist-team-row"
                title={`${team.teamName} · ${team.volume} Deals · Erlös ${formatTransfermarktCurrency(team.income)} · Ausgaben ${formatTransfermarktCurrency(team.spend)}`}
                onClick={() => onOpenTeam(team.teamId)}
              >
                <span className="nl-thist-team-code">{team.shortCode}</span>
                <span className="nl-thist-team-copy">
                  {/* #4: Teamname darf auf zwei Zeilen umbrechen (CSS) und trägt
                      einen eigenen Tooltip, damit kein harter Mitten-im-Wort-
                      Abschnitt ohne Auflösung entsteht. */}
                  <strong title={team.teamName}>{team.teamName}</strong>
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
              {/* #74: Season-Balken klickbar → Saison-Filter. NlBarChart hat
                  keinen Klick-Hook pro Balken (Kit-Datei, nicht editierbar) —
                  daher eine begleitende, klickbare Season-Leiste mit
                  denselben echten Werten aus `seasonBars`. */}
              <div className="nl-thist-season-pills" role="list" aria-label="Season wählen">
                {seasonBars.map((bar) => {
                  const matchedSeasonId = seasonIdByLabel.get(bar.label);
                  const isActive = matchedSeasonId != null && seasonFilter === matchedSeasonId;
                  return matchedSeasonId ? (
                    <button
                      key={bar.label}
                      type="button"
                      role="listitem"
                      className={`nl-thist-season-pill${isActive ? " is-active" : ""}`}
                      onClick={() => onSeasonFilterChange(matchedSeasonId)}
                      title={`Nur ${bar.label} anzeigen`}
                    >
                      <span>{bar.label}</span>
                      <strong className="nl-tnum">{bar.value}</strong>
                    </button>
                  ) : (
                    <span key={bar.label} className="nl-thist-season-pill is-static">
                      <span>{bar.label}</span>
                      <strong className="nl-tnum">{bar.value}</strong>
                    </span>
                  );
                })}
              </div>
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
              {showSeasonNetChart ? (
                <div className="nl-thist-season-net">
                  <span className="nl-thist-eyebrow">Transferbilanz über Seasons (Netto)</span>
                  <div className="nl-thist-season-net-scroll">
                    <NlBarChart
                      bars={seasonNetBars}
                      format={(value) => formatNlSignedMoney(value)}
                      aria-label="Netto-Transferbilanz je Season (Einnahmen minus Ausgaben)"
                      className="nl-thist-season-net-chart"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </NlCard>
        </div>
      )}
    </div>
  );
}
