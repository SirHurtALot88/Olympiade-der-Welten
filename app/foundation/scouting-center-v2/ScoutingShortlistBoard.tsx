"use client";

import { useMemo, useState } from "react";

import type { ScoutingHubV2WatchTarget } from "@/app/foundation/scouting-center-v2/scouting-center-v2-types";
import type { ScoutingQueueRow } from "@/app/foundation/scouting-center-v2/ScoutingPriorityQueue";
import { NlDeltaChip, NlEmptyState, NlTable, formatNlNumber, type NlTableColumn } from "@/components/foundation/new-look";
import type { ScoutingReportData } from "@/lib/scouting/scouting-report-service";

/**
 * Shortlist-Analytics-Board — sortierbare Tabelle über die GESAMTE Wishlist
 * (`queueEntries`, inkl. über dem Slot-Limit nur gemerkter Spieler), ergänzt
 * um die bereits vorhandenen CA/PO/Marktwert-Felder aus
 * `activeScoutTargets`/`bookmarkedTargets` (`ScoutingHubV2WatchTarget`).
 *
 * Bewusst NUR mit echten, bereits fog-of-war-geprüften Feldern:
 * - CA/PO kommen als `caDisplay`/`poDisplay`/`poMin`/`poMax` aus
 *   `buildScoutingWatchTargetStarFields` — das sind dieselben bereits
 *   enthüllten Felder, die auch der Scouting Report zeigt (`report.poStarMin`
 *   etc.). Der RAW `caOverall`/`potentialGap` (ungated echte Werte) wird
 *   bewusst NICHT verwendet — das wäre ein Fog-of-War-Leak über Sortierung.
 * - Achsen (POW/SPE/MEN/SOC) auf dem Target-Objekt sind ungated Rohwerte
 *   (wie im bestehenden `getReadyRadarAxes` in `ScoutingCenterV2NewLook`) —
 *   daher hier bewusst NICHT gezeigt, um keinen neuen Leak-Kanal zu öffnen.
 * - Der Team-Achsen-Impact (vorher/nachher, "verbessert MEN") existiert nur
 *   für den gerade geladenen `report` (echte Server-Berechnung gegen die
 *   eigene Top-6 — für andere Zeilen nicht ohne Weiteres verfügbar). Andere
 *   Zeilen bekommen daher einen "Vergleichen"-Button, der denselben Report
 *   nachlädt (`onSelectReportPlayer`), statt einen Wert zu erfinden.
 * - Fee/Marktwert kommt aus `target.marketValue` (bereits als String
 *   formatiert); für die Sortierung wird der String bestmöglich zurück in
 *   eine Zahl geparst (de-DE-Format ODER roher Zahlen-String als Fallback).
 */

export type ScoutingShortlistBoardProps = {
  entries: ScoutingQueueRow[];
  targets: ScoutingHubV2WatchTarget[];
  report: ScoutingReportData | null;
  selectedReportPlayerId?: string | null;
  onSelectReportPlayer?: (playerId: string) => void;
  onOpenPlayer: (playerId: string) => void;
};

type NlScoutSortKey = "rank" | "name" | "status" | "intel" | "level" | "ca" | "po" | "potential" | "fee" | "impact";
type NlScoutSortDir = "asc" | "desc";

const POTENTIAL_BAND_RANK: Record<string, number> = { elite: 4, high: 3, medium: 2, low: 1, unknown: 0 };
const POTENTIAL_BAND_LABEL: Record<string, string> = {
  elite: "Elite",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
  unknown: "Unbekannt",
};

function parseLeadingNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/** de-DE-formatierte Beträge ("1.234,5 €") ODER rohe Zahlen-Strings (Fallback in `buildDraft`). */
function parseFormattedCurrency(text: string | null | undefined): number | null {
  if (!text || text === "—") return null;
  const trimmed = text.trim();
  if (trimmed.includes("€") || trimmed.includes(",")) {
    const cleaned = trimmed.replace(/€/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(trimmed.replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getStatusInfo(entry: ScoutingQueueRow): { label: string; rank: number; toneClass: string } {
  if (entry.isFocusTarget) return { label: "Fokus", rank: 0, toneClass: "is-focus" };
  if (entry.isFullyScouted) return { label: "Kaufbereit", rank: 1, toneClass: "is-ready" };
  if (entry.isActiveSlot) return { label: "Aktiv", rank: 2, toneClass: "is-active" };
  return { label: "Wartet", rank: 3, toneClass: "is-waiting" };
}

function nullsLastCompare(left: number | null, right: number | null, dir: NlScoutSortDir): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return dir === "asc" ? left - right : right - left;
}

type ShortlistTableRow = {
  entry: ScoutingQueueRow;
  target: ScoutingHubV2WatchTarget | null;
  rank: number;
  status: { label: string; rank: number; toneClass: string };
  caSortValue: number | null;
  poSortValue: number | null;
  potentialRank: number | null;
  feeSortValue: number | null;
  impactDelta: number | null;
  isLoadedReport: boolean;
};

const SHORTLIST_COLUMNS: NlTableColumn<ShortlistTableRow>[] = [
  { key: "rank", label: "#", align: "right", width: "44px", sortable: true },
  { key: "name", label: "Spieler", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "intel", label: "Intel", align: "right", sortable: true },
  { key: "level", label: "Stufe", align: "right", sortable: true },
  { key: "ca", label: "CA", align: "right", sortable: true, className: "nl-scout-shortlist-nowrap" },
  { key: "po", label: "PO-Decke", align: "right", sortable: true, className: "nl-scout-shortlist-nowrap" },
  { key: "potential", label: "Potenzial", sortable: true },
  { key: "fee", label: "Fee", align: "right", sortable: true, className: "nl-scout-shortlist-nowrap" },
  { key: "impact", label: "Top-6-Impact", align: "right", sortable: true, tooltip: "Top-6-Achsen-Schnitt Δ mit Kauf" },
];

export default function ScoutingShortlistBoard({
  entries,
  targets,
  report,
  selectedReportPlayerId = null,
  onSelectReportPlayer,
  onOpenPlayer,
}: ScoutingShortlistBoardProps) {
  const [sortKey, setSortKey] = useState<NlScoutSortKey>("rank");
  const [sortDir, setSortDir] = useState<NlScoutSortDir>("asc");

  const targetByPlayerId = useMemo(() => {
    const map = new Map<string, ScoutingHubV2WatchTarget>();
    for (const target of targets) {
      if (!map.has(target.playerId)) {
        map.set(target.playerId, target);
      }
    }
    return map;
  }, [targets]);

  const rows = useMemo(
    () =>
      entries.map((entry, index) => {
        const target = targetByPlayerId.get(entry.playerId) ?? null;
        const status = getStatusInfo(entry);
        const isLoadedReport = report != null && report.playerId === entry.playerId;
        const impactDelta = isLoadedReport ? report!.axisImpactComposite.delta : null;
        return {
          entry,
          target,
          rank: index + 1,
          status,
          caSortValue: parseLeadingNumber(target?.caDisplay),
          poSortValue: target?.poMax ?? null,
          potentialRank: target?.potentialBand ? (POTENTIAL_BAND_RANK[target.potentialBand] ?? 0) : null,
          feeSortValue: parseFormattedCurrency(target?.marketValue),
          impactDelta,
          isLoadedReport,
        };
      }),
    [entries, targetByPlayerId, report],
  );

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((left, right) => {
      switch (sortKey) {
        case "name":
          return sortDir === "asc"
            ? left.entry.playerName.localeCompare(right.entry.playerName, "de-DE")
            : right.entry.playerName.localeCompare(left.entry.playerName, "de-DE");
        case "status":
          return sortDir === "asc" ? left.status.rank - right.status.rank : right.status.rank - left.status.rank;
        case "intel":
          return sortDir === "asc" ? left.entry.certainty - right.entry.certainty : right.entry.certainty - left.entry.certainty;
        case "level":
          return sortDir === "asc"
            ? left.entry.effectiveScoutingLevel - right.entry.effectiveScoutingLevel
            : right.entry.effectiveScoutingLevel - left.entry.effectiveScoutingLevel;
        case "ca":
          return nullsLastCompare(left.caSortValue, right.caSortValue, sortDir);
        case "po":
          return nullsLastCompare(left.poSortValue, right.poSortValue, sortDir);
        case "potential":
          return nullsLastCompare(left.potentialRank, right.potentialRank, sortDir);
        case "fee":
          return nullsLastCompare(left.feeSortValue, right.feeSortValue, sortDir);
        case "impact":
          return nullsLastCompare(left.impactDelta, right.impactDelta, sortDir);
        case "rank":
        default:
          return sortDir === "asc" ? left.rank - right.rank : right.rank - left.rank;
      }
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: NlScoutSortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "status" ? "asc" : "desc");
    }
  };

  if (entries.length === 0) {
    return (
      <NlEmptyState
        icon="🔍"
        title="Shortlist ist leer"
        message="Spieler im Transfermarkt zur Wishlist hinzufügen, damit sie hier vergleichbar werden."
        data-testid="scouting-shortlist-empty"
      />
    );
  }

  const renderCell = (row: ShortlistTableRow, column: NlTableColumn<ShortlistTableRow>) => {
    switch (column.key) {
      case "rank":
        return row.rank;
      case "name":
        return (
          <button
            type="button"
            className="nl-scout-shortlist-name"
            onClick={() => onOpenPlayer(row.entry.playerId)}
            title="Spielerprofil öffnen"
          >
            <strong>{row.entry.playerName}</strong>
            <small>
              {row.entry.className} · {row.entry.race}
            </small>
          </button>
        );
      case "status":
        return <span className={`nl-scout-shortlist-status-pill ${row.status.toneClass}`}>{row.status.label}</span>;
      case "intel":
        return `${row.entry.certainty}%`;
      case "level":
        return `L${row.entry.effectiveScoutingLevel}/5`;
      case "ca":
        return row.target?.caDisplay ?? "—";
      case "po":
        return row.target?.poDisplay ?? "—";
      case "potential":
        return row.target?.potentialBand ? (
          <span className={`nl-scout-shortlist-potential-pill is-${row.target.potentialBand}`}>
            {POTENTIAL_BAND_LABEL[row.target.potentialBand] ?? row.target.potentialBand}
          </span>
        ) : (
          "—"
        );
      case "fee":
        return row.target?.marketValue ?? "—";
      case "impact":
        return row.impactDelta != null ? (
          <NlDeltaChip value={row.impactDelta} format={(n) => formatNlNumber(n, 1)} title="Top-6-Achsen-Schnitt Δ mit Kauf" />
        ) : (
          <button
            type="button"
            className="nl-scout-shortlist-compare"
            onClick={() => onSelectReportPlayer?.(row.entry.playerId)}
            disabled={!onSelectReportPlayer}
            title="Scouting Report laden, um den Team-Impact zu sehen"
          >
            Vergleichen
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <NlTable
      columns={SHORTLIST_COLUMNS}
      rows={sortedRows}
      rowKey={(row) => row.entry.playerId}
      rowClassName={(row) => (row.entry.playerId === selectedReportPlayerId ? "is-active-row" : undefined)}
      renderCell={renderCell}
      sortState={{ key: sortKey, direction: sortDir }}
      onSort={(key) => toggleSort(key as NlScoutSortKey)}
      aria-label="Shortlist-Vergleich"
      data-testid="scouting-shortlist-board"
    />
  );
}
