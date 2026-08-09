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
  NlCard,
  NlDeltaChip,
  NlRadar,
  NlSparkline,
  NlSubTabs,
  StatChip,
  StatChipRow,
  type NlAxisKey,
} from "@/components/foundation/new-look";
import { VeloDivergingBar } from "@/components/foundation/velo-ui";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

/**
 * Transferhistorie im Velo-Look (Chris-Rework: „nicht wirklich übersichtlich …
 * zeigt auch nicht direkt top verkäufe käufe etc und hebt evtl teams hervor").
 *
 * Aufbau von oben nach unten:
 * 1. Kopfkarte mit Scope, Bilanz-KPIs und dem Ausgaben/Einnahmen-Balken
 *    (`VeloDivergingBar`) — dieselben Werte wie die Chips, nur als Bild.
 * 2. Kompakter Filterstreifen (kein eigener Karten-Kasten mehr) inkl. Reset,
 *    Nachladen und CSV-Export.
 * 3. „Markt-Highlights": echte Top-5-Listen (Käufe, Verkäufe, beste GuV) —
 *    jede Zeile wählt den Deal im Strom aus, statt nur EINER biggest-Kachel.
 * 4. Team-Board: alle Teams mit Ausgaben-vs-Einnahmen-Balken auf GEMEINSAMER
 *    Skala, das eigene Team hervorgehoben und mit kumulativer Bilanz-Sparkline.
 * 5. Deal-Strom (Timeline|Tabelle) + Spotlight des gewählten Deals.
 *
 * Keine erfundenen Werte: alles stammt aus den Props bzw. den im Client
 * berechneten Ableitungen (topBuys/topSales/topProfits, activityCards).
 */

export type TransferHistoryV2NewLookProps = TransferHistoryV2ClientProps & {
  activityCards: ActivityCard[];
  mostActiveTeam: ActivityCard | null;
  topBuys: TransferHistoryV2Row[];
  topSales: TransferHistoryV2Row[];
  topProfits: TransferHistoryV2Row[];
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

/**
 * Durchklick-Test (G5 Historie): `row.phase` kam als roher Slug ins UI —
 * „SEASON 2 · MANUAL_TRANSFER_WINDOW" als Abschnittstitel, dazu
 * `manual_transfer_window` als Fußnote JEDER Zeile. Übersetzt wird hier;
 * ein unbekannter Wert fällt auf einen deutschen Sammelbegriff zurück,
 * nie auf den Enum-Namen (F5-Regel, wie formatNegotiationSignalLabel).
 */
function formatNlTransferPhaseLabel(row: Pick<TransferHistoryV2Row, "phase" | "matchdayId" | "seasonLabel">) {
  if (row.phase === "manual_transfer_window") return "Transferfenster";
  if (row.phase === "season_snapshot") return "Saisonwechsel";
  if (row.phase === "setup_draft") return "Setup-Draft";
  // Kein bekannter Phasen-Slug: Spieltag-Nummer aus der Matchday-ID ziehen …
  const matchdayNummer = row.matchdayId?.match(/(\d+)\s*$/)?.[1];
  if (matchdayNummer) return `Spieltag ${matchdayNummer}`;
  // … sonst lieber ein ehrlicher Sammelbegriff als ein roher Code.
  return row.phase ? "Transferphase" : row.seasonLabel;
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

/**
 * Eine der drei Top-Listen im „Markt-Highlights"-Band. Reine Darstellung:
 * `rows` kommen fertig sortiert aus dem Client (eine Quelle pro Größe), der
 * Meter-Balken skaliert jede Zeile relativ zum Spitzenwert der Liste.
 */
function NlThistTopList({
  tone,
  eyebrow,
  title,
  rows,
  emptyLabel,
  getValue,
  getValueLabel,
  getContext,
  selectedTransferId,
  onPick,
}: {
  tone: "is-buy" | "is-sell" | "is-profit";
  eyebrow: string;
  title: string;
  rows: TransferHistoryV2Row[];
  emptyLabel: string;
  getValue: (row: TransferHistoryV2Row) => number;
  getValueLabel: (row: TransferHistoryV2Row) => string;
  getContext: (row: TransferHistoryV2Row) => string;
  selectedTransferId: string | null;
  onPick: (transferId: string) => void;
}) {
  const maxValue = rows.reduce((max, row) => Math.max(max, getValue(row)), 0);
  return (
    <NlCard className={`nl-thist-toplist-card ${tone}`} eyebrow={eyebrow} title={title}>
      {rows.length ? (
        <ol className="nl-thist-toplist" aria-label={title}>
          {rows.map((row, index) => {
            const value = getValue(row);
            const meterShare = maxValue > 0 ? Math.round(Math.min(1, Math.max(0, value) / maxValue) * 10000) / 100 : 0;
            return (
              <li key={row.transferId}>
                <button
                  type="button"
                  className={`nl-thist-toplist-row${selectedTransferId === row.transferId ? " is-selected" : ""}`}
                  onClick={() => onPick(row.transferId)}
                  title={`${row.playerName} im Deal-Strom öffnen`}
                >
                  <span className={`nl-thist-toplist-rank nl-tnum${index < 3 ? ` is-medal-${index + 1}` : ""}`}>
                    {index + 1}
                  </span>
                  <NlThistPortraitChip row={row} size={28} />
                  <span className="nl-thist-toplist-copy">
                    <strong>{row.playerName}</strong>
                    <small>{getContext(row)}</small>
                  </span>
                  <span className="nl-thist-toplist-value">
                    <strong className="nl-tnum">{getValueLabel(row)}</strong>
                    <span className="nl-thist-toplist-meter" aria-hidden="true">
                      <span className="nl-thist-toplist-meter-fill" style={{ width: `${meterShare}%` }} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="nl-thist-muted">{emptyLabel}</p>
      )}
    </NlCard>
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
  topBuys,
  topSales,
  topProfits,
  selectedRow,
  selectedTransferId,
  onSelectTransfer,
}: TransferHistoryV2NewLookProps) {
  const [historyLayout, setHistoryLayout] = useState<"timeline" | "table">("timeline");
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

  // Season-Zeilen: Deal-Anzahl (aus seasonBreakdown) + Netto (aus seasonNetBars,
  // derselben Ableitung wie zuvor der Netto-Chart) in EINER kompakten Zeile je
  // Season — der SVG-Barchart hat lange Geldbeträge übereinandergeschoben.
  const seasonRows = useMemo(() => {
    const netByLabel = new Map(seasonNetBars.map((bar) => [bar.label, bar.value] as const));
    const maxCount = seasonBreakdown.reduce((max, [, count]) => Math.max(max, count), 0);
    return seasonBreakdown.map(([label, count]) => ({
      label,
      count,
      share: maxCount > 0 ? Math.round((count / maxCount) * 10000) / 100 : 0,
      net: netByLabel.get(label) ?? 0,
      seasonId: seasonIdByLabel.get(label) ?? null,
    }));
  }, [seasonBreakdown, seasonNetBars, seasonIdByLabel]);

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

  // Gemeinsame Skala für alle Team-Balken: die größte einzelne Ausgaben- oder
  // Einnahmen-Summe im Board. So sind die Balken über Teams hinweg vergleichbar.
  const teamBoardMax = useMemo(
    () => activityCards.reduce((max, team) => Math.max(max, team.spend, team.income), 0),
    [activityCards],
  );

  // Eigenes Team: die Kennzahlen kommen aus DERSELBEN activityCards-Ableitung
  // wie alle anderen Teams (eine Quelle pro Größe) — nur die kumulative
  // Verlaufskurve wird zusätzlich chronologisch aufgebaut.
  const ownCard = useMemo(
    () => (ownTeamId ? activityCards.find((team) => team.teamId === ownTeamId) ?? null : null),
    [activityCards, ownTeamId],
  );

  // Kumulative Transferbilanz des eigenen Teams (Einnahmen − Ausgaben, gleiche
  // Deal-Zuordnung wie `activityCards`: Kauf → −fee, Verkauf/Abgang → +fee).
  // Fog-safe — nur die ohnehin sichtbaren Deals des eigenen Teams.
  const ownBalanceSeries = useMemo(() => {
    if (!ownTeamId) return [];
    const ownDeals = filteredRows
      .filter(
        (row) =>
          (row.type === "buy" && row.toTeamId === ownTeamId) ||
          ((row.type === "sell" || row.type === "contract_exit") && row.fromTeamId === ownTeamId),
      )
      .sort((left, right) => Date.parse(left.happenedAt) - Date.parse(right.happenedAt));
    let cumulative = 0;
    return ownDeals.map((row) => {
      cumulative += row.type === "buy" ? -row.fee : row.fee;
      return { row, cumulative };
    });
  }, [filteredRows, ownTeamId]);

  const ownBalancePoints = useMemo(() => ownBalanceSeries.map((entry) => entry.cumulative), [ownBalanceSeries]);
  const ownBalanceLabels = useMemo(
    () =>
      ownBalanceSeries.map(
        (entry) =>
          `${new Date(entry.row.happenedAt).toLocaleDateString("de-DE")} · ${entry.row.playerName} · kumuliert ${formatNlSignedMoney(entry.cumulative)}`,
      ),
    [ownBalanceSeries],
  );

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

  // Klick in einer Top-Liste: Deal im Strom auswählen und zum Strom scrollen
  // (Spotlight zeigt den Deal auch, wenn er auf einer anderen Seite liegt).
  function handlePickHighlight(transferId: string) {
    onSelectTransfer(transferId);
    if (typeof document !== "undefined") {
      const streamNode = document.getElementById("nl-thist-stream");
      const reduceMotion =
        typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      streamNode?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
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
        {/* Dieselben Summen wie die Chips darüber (summary.buyFee/sellFee),
            nur als gespiegelter Balken — das Verhältnis auf einen Blick. */}
        <div className="nl-thist-balance">
          <VeloDivergingBar
            left={summary.buyFee}
            right={summary.sellFee}
            leadLabelLeft="Ausgaben"
            leadLabelRight="Einnahmen"
            ariaLabel={`Ausgaben ${formatTransfermarktCurrency(summary.buyFee)} gegen Einnahmen ${formatTransfermarktCurrency(summary.sellFee)}`}
          />
        </div>
      </NlCard>

      <div className="nl-thist-toolbar" role="search" aria-label="Transferhistorie filtern">
        <div className="nl-thist-toolbar-fields">
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
              <option value="contract_exit">Abgänge</option>
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
          {/* "Mehr laden" bewusst auch bei "Alle Seasons": der Feed lädt seitenweise
              (z. B. 100 von 551) und ältere Verkäufe wären sonst unerreichbar. */}
          {hasMore && onLoadMore ? (
            <button type="button" className="nl-thist-inline-action" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? "Lädt…" : "Mehr laden"}
            </button>
          ) : null}
          <button
            type="button"
            className="nl-thist-inline-action"
            onClick={handleExportCsv}
            disabled={!canExportCsv}
            title={canExportCsv ? "Sichtbare Deal-Liste als CSV herunterladen" : "Noch keine Deals zum Exportieren"}
          >
            CSV exportieren
          </button>
        </div>
      </div>

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

      {/* Markt-Highlights: echte Top-Listen statt einzelner biggest-Kacheln.
          Jede Zeile ist ein Portal in den Deal-Strom (Auswahl + Scroll). */}
      <div className="nl-thist-highlights" role="group" aria-label="Markt-Highlights">
        <NlThistTopList
          tone="is-buy"
          eyebrow="Markt-Highlights"
          title="Top-Käufe"
          rows={topBuys}
          emptyLabel="Keine Käufe im aktuellen Scope."
          getValue={(row) => row.fee}
          getValueLabel={(row) => formatTransfermarktCurrency(row.fee)}
          getContext={(row) => `${row.toTeamName ?? row.toTeamId ?? "—"} · ${row.seasonLabel}`}
          selectedTransferId={selectedTransferId}
          onPick={handlePickHighlight}
        />
        <NlThistTopList
          tone="is-sell"
          eyebrow="Markt-Highlights"
          title="Top-Verkäufe"
          rows={topSales}
          emptyLabel="Keine Verkäufe im aktuellen Scope."
          getValue={(row) => row.fee}
          getValueLabel={(row) => formatTransfermarktCurrency(row.fee)}
          getContext={(row) => `${row.fromTeamName ?? row.fromTeamId ?? "—"} · ${row.seasonLabel}`}
          selectedTransferId={selectedTransferId}
          onPick={handlePickHighlight}
        />
        <NlThistTopList
          tone="is-profit"
          eyebrow="Markt-Highlights"
          title="Beste Gewinne"
          rows={topProfits}
          emptyLabel="Noch kein belastbarer Gewinnwert (GuV braucht Kauf und Verkauf)."
          getValue={(row) => row.guv ?? 0}
          getValueLabel={(row) => formatNlSignedMoney(row.guv)}
          getContext={(row) => `${row.fromTeamName ?? row.fromTeamId ?? "—"} · ${row.seasonLabel}`}
          selectedTransferId={selectedTransferId}
          onPick={handlePickHighlight}
        />
      </div>

      <div className="nl-thist-board-layout">
        <NlCard
          className="nl-thist-teamboard-card"
          eyebrow="Teams"
          title={`${activityCards.length} Teams aktiv`}
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
          {ownCard ? (
            <div className="nl-thist-own-strip" aria-label={`Bilanz deines Teams ${ownCard.teamName}`}>
              <div className="nl-thist-own-strip-head">
                <span className="nl-thist-own-badge">Dein Team</span>
                <button
                  type="button"
                  className="nl-thist-link"
                  onClick={() => onOpenTeam(ownCard.teamId)}
                  title={`${ownCard.teamName} öffnen`}
                >
                  {ownCard.teamName}
                </button>
                <small>
                  {ownCard.volume} Deals · {ownCard.buys}K/{ownCard.sells}V
                </small>
                <NlDeltaChip
                  value={ownCard.net}
                  format={() => formatNlSignedMoney(ownCard.net)}
                  title="Netto-Transferbilanz deines Teams"
                />
              </div>
              <VeloDivergingBar
                left={ownCard.spend}
                right={ownCard.income}
                max={teamBoardMax}
                leadLabelLeft="Ausgaben"
                leadLabelRight="Einnahmen"
                leftValue={formatTransfermarktCurrency(ownCard.spend)}
                rightValue={formatTransfermarktCurrency(ownCard.income)}
                ariaLabel={`${ownCard.teamName}: Ausgaben ${formatTransfermarktCurrency(ownCard.spend)}, Einnahmen ${formatTransfermarktCurrency(ownCard.income)}`}
              />
              {ownBalancePoints.length >= 2 ? (
                <div className="nl-thist-own-trend">
                  <span className="nl-thist-eyebrow">Transferbilanz kumuliert über {ownBalanceSeries.length} Deals</span>
                  <NlSparkline
                    points={ownBalancePoints}
                    pointLabels={ownBalanceLabels}
                    tone={ownCard.net >= 0 ? "good" : "risk"}
                    aria-label="Kumulative Transferbilanz deines Teams über die sichtbaren Deals"
                    className="nl-thist-own-sparkline"
                  />
                </div>
              ) : null}
            </div>
          ) : ownTeamId ? (
            <p className="nl-thist-muted">Dein Team hat im aktuellen Scope noch keine Deals.</p>
          ) : null}
          <div className="nl-thist-teamboard-grid" role="list" aria-label="Transferbilanz je Team">
            {sortedActivityCards.map((team) => {
              const isOwn = ownTeamId != null && team.teamId === ownTeamId;
              const isTop = mostActiveTeam != null && team.teamId === mostActiveTeam.teamId;
              return (
                <button
                  key={team.teamId}
                  type="button"
                  role="listitem"
                  className={`nl-thist-teamboard-tile${isOwn ? " is-own" : ""}`}
                  title={`${team.teamName} öffnen · ${team.volume} Deals · Erlös ${formatTransfermarktCurrency(team.income)} · Ausgaben ${formatTransfermarktCurrency(team.spend)}`}
                  onClick={() => onOpenTeam(team.teamId)}
                >
                  <span className="nl-thist-teamboard-head">
                    <span className="nl-thist-team-code">{team.shortCode}</span>
                    <span className="nl-thist-teamboard-name">
                      <strong title={team.teamName}>{team.teamName}</strong>
                      <small>
                        {team.volume} Deals · {team.buys}K/{team.sells}V
                      </small>
                    </span>
                    {isOwn ? <span className="nl-thist-own-badge">Dein Team</span> : null}
                    {isTop ? <span className="nl-thist-top-badge">Meiste Bewegung</span> : null}
                  </span>
                  <VeloDivergingBar
                    left={team.spend}
                    right={team.income}
                    max={teamBoardMax}
                    compact
                    leadLabelLeft="Ausgaben"
                    leadLabelRight="Einnahmen"
                    leftValue={formatTransfermarktCurrency(team.spend)}
                    rightValue={formatTransfermarktCurrency(team.income)}
                    ariaLabel={`${team.teamName}: Ausgaben ${formatTransfermarktCurrency(team.spend)}, Einnahmen ${formatTransfermarktCurrency(team.income)}`}
                  />
                  <span className="nl-thist-teamboard-net">
                    <NlDeltaChip value={team.net} format={() => formatNlSignedMoney(team.net)} title="Netto-Transferbilanz" />
                  </span>
                </button>
              );
            })}
          </div>
          {!activityCards.length ? <p className="nl-thist-muted">Noch keine Teambewegungen im aktuellen Scope.</p> : null}
        </NlCard>

        <NlCard className="nl-thist-seasons-card" eyebrow="Seasons" title="Deals & Bilanz">
          {seasonRows.length ? (
            <div className="nl-thist-season-breakdown">
              {/* #74: Season-Zeile klickbar → Saison-Filter. Deals-Meter (Anteil
                  am stärksten Jahrgang) + Netto-Bilanz in einer Zeile; das Netto
                  nur bei mehreren Seasons, sonst dupliziert es den Kopf-Chip. */}
              <span className="nl-thist-eyebrow">Deals je Season · Klick filtert</span>
              <div className="nl-thist-season-rows" role="list" aria-label="Season wählen">
                {seasonRows.map((row) => {
                  const isActive = row.seasonId != null && seasonFilter === row.seasonId;
                  const inner = (
                    <>
                      <span className="nl-thist-season-row-label">{row.label}</span>
                      <span className="nl-thist-season-meter" aria-hidden="true">
                        <span className="nl-thist-season-meter-fill" style={{ width: `${row.share}%` }} />
                      </span>
                      <strong className="nl-tnum">{row.count}</strong>
                      {showSeasonNetChart ? (
                        <NlDeltaChip
                          value={row.net}
                          format={() => formatNlSignedMoney(row.net)}
                          title={`Netto-Transferbilanz ${row.label} (Einnahmen minus Ausgaben)`}
                        />
                      ) : null}
                    </>
                  );
                  return row.seasonId != null ? (
                    <button
                      key={row.label}
                      type="button"
                      role="listitem"
                      className={`nl-thist-season-row${isActive ? " is-active" : ""}`}
                      onClick={() => onSeasonFilterChange(row.seasonId!)}
                      title={`Nur ${row.label} anzeigen`}
                    >
                      {inner}
                    </button>
                  ) : (
                    <span key={row.label} role="listitem" className="nl-thist-season-row is-static">
                      {inner}
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
            </div>
          ) : (
            <p className="nl-thist-muted">Noch keine Season-Daten im aktuellen Scope.</p>
          )}
        </NlCard>
      </div>

      <div className="nl-thist-stream-layout" id="nl-thist-stream">
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
                    const groupLabel = `${row.seasonLabel} · ${formatNlTransferPhaseLabel(row)}`;
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
                            <small>{formatNlTransferPhaseLabel(row)}</small>
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
                          <span>{formatNlTransferPhaseLabel(row)}</span>
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
                    {formatNlTransferPhaseLabel(selectedRow)}
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
              {selectedFeeVsMarketValueBlock(selectedRow)}
              {selectedRowAxesBlock(selectedRow)}
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
            <p className="nl-thist-muted">Wähle oben oder links einen Deal für Profil, Zahlen und Teamweg.</p>
          )}
        </NlCard>
      </div>
    </div>
  );
}

// #28: Fee-vs-Marktwert Deal-Bewertung (fee − marketValue) — nur wenn ein
// realer Marktwert > 0 vorliegt, sonst keine erfundene Bewertung.
function selectedFeeVsMarketValueBlock(selectedRow: TransferHistoryV2Row) {
  if (!Number.isFinite(selectedRow.fee) || !Number.isFinite(selectedRow.marketValue) || selectedRow.marketValue <= 0) {
    return null;
  }
  const delta = selectedRow.fee - selectedRow.marketValue;
  return (
    <p className="nl-thist-spotlight-dealcheck">
      <span className="nl-thist-eyebrow">Deal-Bewertung · Fee vs. MW</span>
      <NlDeltaChip
        value={delta}
        invert
        format={(value) => formatNlSignedMoney(value)}
        title="Fee minus Marktwert zum Zeitpunkt des Deals — positiv heißt teurer als der Marktwert"
      />
    </p>
  );
}

// #20: POW/SPE/MEN/SOC-Radar im Spotlight — nur reale, endliche Achsenwerte.
function selectedRowAxesBlock(selectedRow: TransferHistoryV2Row) {
  const axes: { key: NlAxisKey; value: number }[] = [];
  if (typeof selectedRow.pow === "number" && Number.isFinite(selectedRow.pow)) axes.push({ key: "pow", value: selectedRow.pow });
  if (typeof selectedRow.spe === "number" && Number.isFinite(selectedRow.spe)) axes.push({ key: "spe", value: selectedRow.spe });
  if (typeof selectedRow.men === "number" && Number.isFinite(selectedRow.men)) axes.push({ key: "men", value: selectedRow.men });
  if (typeof selectedRow.soc === "number" && Number.isFinite(selectedRow.soc)) axes.push({ key: "soc", value: selectedRow.soc });
  if (!axes.length) return null;
  return (
    <div className="nl-thist-spotlight-radar">
      <span className="nl-thist-eyebrow">Achsenprofil zum Zeitpunkt des Deals</span>
      <NlRadar
        axes={axes}
        showValues
        aria-label={`Achsenprofil von ${selectedRow.playerName}`}
        className="nl-thist-spotlight-radar-chart"
      />
    </div>
  );
}
