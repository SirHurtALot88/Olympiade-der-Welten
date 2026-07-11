"use client";

import { useMemo, useState, type ReactNode } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import type { TransfermarktV2RosterRow } from "@/app/foundation/transfermarkt-v2/TransfermarktV2Client";
import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlProgressBar,
  NlRadar,
  StatChip,
  StatChipRow,
  formatNlNumber,
  NL_AXIS_LABELS,
  nlToneClass,
  type NlAxisKey,
  type NlTone,
} from "@/components/foundation/new-look";
import { appendMediaImageVariant, getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type { Discipline, DisciplineCategory, TransferWishlistEntry } from "@/lib/data/olyDataTypes";
import { formatNullablePps } from "@/lib/foundation/tabs/foundation-format-render-helpers";
import {
  formatTransfermarktCurrency,
  formatTransfermarktRatio,
} from "@/lib/market/transfermarkt-formatting-contract";
import { getTransfermarktPortraitModel } from "@/lib/market/transfermarkt-lab";
import type { TransferHistoryItem } from "@/lib/market/transfer-history-read-service";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import {
  computeTopSixAxisAverage,
  formatTeamRankEstimateLabel,
  type TransfermarktAxisTeamRankEstimate,
  type TransfermarktDisciplineTopSixImpactRow,
  type TransfermarktTopSixAxisImpactRow,
} from "@/lib/market/transfermarkt-roster-impact";
import { formatScoutedImpactDelta, isScoutedImpactExact } from "@/lib/market/transfermarkt-scouting";

/**
 * "Neuer Look" Transfermarkt — flag-gated, additiv.
 *
 * Wird nur gerendert, wenn `useNewLook` aktiv ist; `TransfermarktV2Client`
 * fällt ohne Flag byte-identisch auf die bestehende Ansicht zurück. Alle
 * Daten und Handler kommen 1:1 aus dem Client (kein eigener Fetch, keine
 * erfundenen Werte):
 * - Kandidaten-Rail mit PERSISTENTEM Deal-Signal (Fit/Value-Ton immer sichtbar),
 * - Deal-Desk mit Vorher→Nachher-Delta-Chips (Ablöse, Cash, Gehalt, Kader, MW
 *   aus der echten Buy-Preview bzw. dem Team-Kontext),
 * - Team-Impact aus `computeTopSixAxisImpact` / `computeDisciplineTopSixImpact`
 *   (im Client berechnet, hier nur dargestellt) — als Schätzwerte markiert,
 *   solange `isScoutedImpactExact` nicht erfüllt ist,
 * - Wishlist-Panel (echte `wishlistEntries` + Fokus/Deal/Entfernen-Handler)
 *   und eigener Kader ("was ich habe / noch brauche") aus `rosterRows`,
 * - Team-Stärke-Block über der Kaderliste: Ø POW/SPE/MEN/SOC über den ganzen
 *   Kader UND über die besten Top-{topSixCount} je Achse (gleiche Semantik wie
 *   `computeTopSixAxisAverage` im Team-Impact), je Achse aufklappbar zu den
 *   echten Sub-Disziplinen aus `rosterRows[].disciplineRatings` (Muster wie
 *   das Saisonstand-Board) — Disziplinen ohne Kader-Werte werden nicht gezeigt,
 * - "VERPFLICHTET"-Moment auf Basis des bestehenden `buySuccess`-Signals,
 * - Sortierung/Filter als Pill-Toggles mit den echten Sort-Keys.
 *
 * Bewusst weggelassen (Sekundärflächen, im alten Look weiterhin vorhanden):
 * Pool-Snapshot/Bracket-Tabelle sowie Filter-Presets — keine Daten erfunden,
 * nur nicht dupliziert.
 */

export type TransfermarktNewLookSortMode = "need" | "fit" | "value" | "cheap" | "potential" | "salary";

const NL_MARKET_SORT_LABELS: Record<TransfermarktNewLookSortMode, string> = {
  need: "Größter Bedarf",
  fit: "Bester Fit",
  value: "Bestes Value",
  potential: "Meistes Potenzial",
  cheap: "Günstigste",
  salary: "Niedriges Gehalt",
};

const NL_MARKET_SORT_ORDER: TransfermarktNewLookSortMode[] = ["need", "fit", "value", "potential", "cheap", "salary"];
const NL_MARKET_AXES: NlAxisKey[] = ["pow", "spe", "men", "soc"];

/** Achse → Vorsaison-Feld (Performance-Punkte + Rang) auf RosterRow.previousSeasonAxis. */
const NL_PREV_SEASON_AXIS_KEYS: Record<
  NlAxisKey,
  {
    points: "ppPow" | "ppSpe" | "ppMen" | "ppSoc";
    rank: "ppPowRank" | "ppSpeRank" | "ppMenRank" | "ppSocRank";
  }
> = {
  pow: { points: "ppPow", rank: "ppPowRank" },
  spe: { points: "ppSpe", rank: "ppSpeRank" },
  men: { points: "ppMen", rank: "ppMenRank" },
  soc: { points: "ppSoc", rank: "ppSocRank" },
};

/** Achse → Disziplin-Kategorie (für die aufklappbaren Sub-Disziplinen im Kader-Block). */
const NL_AXIS_DISCIPLINE_CATEGORY: Record<NlAxisKey, DisciplineCategory> = {
  pow: "power",
  spe: "speed",
  men: "mental",
  soc: "social",
};

/** Ø über echte Werte — null statt erfundener 0, wenn nichts vorliegt. */
function nlAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

type NlSquadDisciplineSummary = {
  disciplineId: string;
  disciplineName: string;
  topAvg: number | null;
  squadAvg: number | null;
  ratedCount: number;
};

type NlSquadAxisSummary = {
  axis: NlAxisKey;
  /** Ø über die besten `topSixCount` Achswerte (Aufstellung = 6). */
  topAvg: number | null;
  /** Ø über den ganzen Kader. */
  squadAvg: number | null;
  playerCount: number;
  min: number | null;
  max: number | null;
  bestName: string | null;
  disciplines: NlSquadDisciplineSummary[];
};

export type TransfermarktV2NewLookProps = {
  // Kopf & Status
  teamName: string | null;
  teamShortCode: string | null;
  availabilityLabel: string;
  marketBusy: boolean;
  marketError: string | null;
  onRetryMarket?: () => void;
  buySuccess: string | null;
  onDismissBuySuccess: () => void;
  // Budget-Board
  teamCash: number | null;
  teamSalaryTotal: number | null;
  rosterCount: number | null;
  rosterLimit: number | null;
  rosterGapOpenCount: number | null;
  // Suche / Sortierung / Filter-Pills
  search: string;
  onSearchChange: (value: string) => void;
  sortMode: TransfermarktNewLookSortMode;
  onSortModeChange: (mode: TransfermarktNewLookSortMode) => void;
  selectedClassAxes: NlAxisKey[];
  onToggleClassAxis: (axis: NlAxisKey) => void;
  onResetFilters: () => void;
  activeFilterCount: number;
  // Kandidaten-Rail
  candidates: TransfermarktFreeAgentItem[];
  totalVisibleCount: number;
  selectedPlayerId: string | null;
  onSelectCandidate: (playerId: string) => void;
  selectedPlayer: TransfermarktFreeAgentItem | null;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  // Aktionen am selektierten Kandidaten
  onOpenDeal: () => void;
  dealOpenDisabledReason: string | null;
  buyBusy: boolean;
  selectedPlayerWishlisted: boolean;
  wishlistDisabledReason: string | null;
  onToggleSelectedWishlist: () => void;
  selectedPlayerScoutingWatched: boolean;
  scoutingWatchDisabledReason: string | null;
  onToggleSelectedScoutingWatch: () => void;
  selectedPlayerScoutCertainty: number | null;
  // Deal-Desk (echte Preview-Zahlen)
  contractLength: number | null;
  onContractLengthChange: (length: number) => void;
  previewError: string | null;
  buyPreviewCanBuy: boolean | null;
  previewPurchasePrice: number | null;
  previewSalaryLabel: string;
  previewCashBefore: number | null;
  previewCashAfter: number | null;
  previewTeamSalaryBefore: number | null;
  previewTeamSalaryAfter: number | null;
  previewRosterBefore: number | null;
  previewRosterAfter: number | null;
  previewMarketValueBefore: number | null;
  previewMarketValueAfter: number | null;
  buyBlockingReasons: string[];
  buyWarnings: string[];
  // Team-Impact (im Client via computeTopSixAxisImpact/... berechnet)
  topSixCount: number;
  topSixAxisImpact: TransfermarktTopSixAxisImpactRow[];
  topSixCompositeBefore: number | null;
  topSixCompositeDelta: number | null;
  topSixAxisRankEstimates: TransfermarktAxisTeamRankEstimate[];
  selectedScoutingConfidence: number | null;
  disciplineImpact: TransfermarktDisciplineTopSixImpactRow[];
  wishlistAxes: NlAxisKey[];
  wishlistDisciplines: string[];
  // Wishlist
  wishlistEntries: TransferWishlistEntry[];
  scoutingIntelByPlayerId: Record<string, number>;
  scoutingActiveWishlistPlayerIds: string[];
  scoutingPipelineCapacity: { occupied: number; max: number | null; draftSuspended?: boolean } | null;
  onFocusWishlistEntry: (entry: TransferWishlistEntry) => void;
  onOpenWishlistDeal: (entry: TransferWishlistEntry) => void;
  onRemoveWishlist?: ((playerId: string) => void) | null;
  marketItemsById: Map<string, TransfermarktFreeAgentItem>;
  // Eigener Kader
  rosterRows: TransfermarktV2RosterRow[];
  /** Sortierte Disziplin-Liste (POW→SOC) für die Sub-Diszi-Aufschlüsselung des Kaders. */
  disciplines: Discipline[];
  /** null = unbekannt → Chip wird ausgeblendet statt "Budget —" zu zeigen. */
  budgetStatusLabel: string | null;
  /** null = unbekannt → Chip wird ausgeblendet statt "Status unbekannt" zu zeigen. */
  readinessStatusLabel: string | null;
  onSellRow: ((row: TransfermarktV2RosterRow) => void) | null;
  // Letzte Deals
  historyItems: TransferHistoryItem[];
  // Kauf-Modal (bestehender Flow, unverändert eingehängt)
  buyModalOpen: boolean;
  buyModalSlot: ReactNode;
};

function getNlFitTone(fit: number | null | undefined): NlTone {
  const value = fit ?? -99;
  if (value >= 18) return "good";
  if (value >= 10) return "accent";
  if (value >= 0) return "warn";
  return "risk";
}

function getNlRatioTone(ratio: number | null | undefined): NlTone {
  if (ratio == null) return "neutral";
  if (ratio >= 4) return "good";
  if (ratio >= 2.5) return "neutral";
  if (ratio >= 1.5) return "warn";
  return "risk";
}

function getNlNeedTone(score: number | null | undefined): NlTone {
  if (score == null) return "neutral";
  if (score >= 48) return "good";
  if (score >= 26) return "warn";
  return "neutral";
}

/** Entwicklungs-Trend-Label (Spiegel von PlayerDetailDrawer.formatDevelopmentTrend). */
const NL_DEV_TREND_LABEL: Record<string, string> = {
  strong_positive: "stark positiv",
  positive: "positiv",
  neutral: "Stagnation",
  negative: "leicht negativ",
  strong_negative: "Regression-Risiko",
};
const NL_DEV_TREND_TONE: Record<string, NlTone> = {
  strong_positive: "good",
  positive: "good",
  neutral: "neutral",
  negative: "warn",
  strong_negative: "risk",
};

/**
 * In-Page-Portal: scrollt sanft zur passenden Markt-Sektion (Board-Kachel →
 * Deal-Desk/Kader/Wishlist). Respektiert prefers-reduced-motion, läuft nur im
 * Event-Handler (kein Render-Seiteneffekt).
 */
function scrollToNlMarketSection(selector: string) {
  if (typeof document === "undefined") {
    return;
  }
  const target = document.querySelector(selector);
  if (!target) {
    return;
  }
  const prefersReduced =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
}

function getNlInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function NlMarketBeforeAfterRow({
  label,
  before,
  after,
  format,
  invert = false,
  estimateNote,
}: {
  label: string;
  before: number | null;
  after: number | null;
  format: (value: number | null) => string;
  /** Kehrt die Delta-Bewertung um (Kosten: mehr = schlechter). */
  invert?: boolean;
  estimateNote?: string;
}) {
  const delta = before != null && after != null ? after - before : null;
  return (
    <div className="nl-market-deal-row" title={estimateNote}>
      <span className="nl-market-deal-row-label">{label}</span>
      <span className="nl-market-deal-row-values nl-tnum">
        {format(before)} <span className="nl-market-deal-arrow" aria-hidden="true">→</span> {format(after)}
      </span>
      {delta != null && delta !== 0 ? (
        <NlDeltaChip value={delta} invert={invert} format={(n) => `${n > 0 ? "+" : ""}${format(n)}`} />
      ) : (
        <span className="nl-market-deal-flat nl-tnum">±0</span>
      )}
    </div>
  );
}

export default function TransfermarktV2NewLook(props: TransfermarktV2NewLookProps) {
  const {
    teamName,
    teamShortCode,
    availabilityLabel,
    marketBusy,
    marketError,
    onRetryMarket,
    buySuccess,
    onDismissBuySuccess,
    teamCash,
    teamSalaryTotal,
    rosterCount,
    rosterLimit,
    rosterGapOpenCount,
    search,
    onSearchChange,
    sortMode,
    onSortModeChange,
    selectedClassAxes,
    onToggleClassAxis,
    onResetFilters,
    activeFilterCount,
    candidates,
    totalVisibleCount,
    selectedPlayerId,
    onSelectCandidate,
    selectedPlayer,
    onOpenPlayerDetails,
    onOpenDeal,
    dealOpenDisabledReason,
    buyBusy,
    selectedPlayerWishlisted,
    wishlistDisabledReason,
    onToggleSelectedWishlist,
    selectedPlayerScoutingWatched,
    scoutingWatchDisabledReason,
    onToggleSelectedScoutingWatch,
    selectedPlayerScoutCertainty,
    contractLength,
    onContractLengthChange,
    previewError,
    buyPreviewCanBuy,
    previewPurchasePrice,
    previewSalaryLabel,
    previewCashBefore,
    previewCashAfter,
    previewTeamSalaryBefore,
    previewTeamSalaryAfter,
    previewRosterBefore,
    previewRosterAfter,
    previewMarketValueBefore,
    previewMarketValueAfter,
    buyBlockingReasons,
    buyWarnings,
    topSixCount,
    topSixAxisImpact,
    topSixCompositeBefore,
    topSixCompositeDelta,
    topSixAxisRankEstimates,
    selectedScoutingConfidence,
    disciplineImpact,
    wishlistAxes,
    wishlistDisciplines,
    wishlistEntries,
    scoutingIntelByPlayerId,
    scoutingActiveWishlistPlayerIds,
    scoutingPipelineCapacity,
    onFocusWishlistEntry,
    onOpenWishlistDeal,
    onRemoveWishlist,
    marketItemsById,
    rosterRows,
    disciplines,
    budgetStatusLabel,
    readinessStatusLabel,
    onSellRow,
    historyItems,
    buyModalOpen,
    buyModalSlot,
  } = props;

  const impactIsEstimate = !isScoutedImpactExact(selectedScoutingConfidence);
  const estimateNote = impactIsEstimate
    ? "Geschätzt — Schätzwerte auf Basis des Scouting-Standes, genaue Teamwirkung erst nach mehr Intel."
    : undefined;
  const scoutingActiveSet = new Set(scoutingActiveWishlistPlayerIds);

  // F5 — aufklappbare Achsen im Kader-Block (Akkordeon wie im Saisonstand-Board).
  const [expandedSquadAxis, setExpandedSquadAxis] = useState<NlAxisKey | null>(null);

  // F4 — Team-Stärke: Ø POW/SPE/MEN/SOC über den ganzen Kader UND über die
  // besten `topSixCount` Werte je Achse (gleiche Top-6-Semantik wie der
  // Team-Impact via computeTopSixAxisAverage — keine erfundenen Werte).
  const squadAxisSummaries = useMemo<NlSquadAxisSummary[]>(() => {
    return NL_MARKET_AXES.map((axis) => {
      const rated = rosterRows
        .map((row) => ({ name: row.name, value: row[axis] }))
        .filter((entry): entry is { name: string; value: number } =>
          typeof entry.value === "number" && Number.isFinite(entry.value),
        );
      const values = rated.map((entry) => entry.value);
      const best = rated.reduce<{ name: string; value: number } | null>(
        (currentBest, entry) => (currentBest == null || entry.value > currentBest.value ? entry : currentBest),
        null,
      );
      const category = NL_AXIS_DISCIPLINE_CATEGORY[axis];
      const axisDisciplines = disciplines
        .filter((discipline) => discipline.category === category)
        .map((discipline) => {
          const scores = rosterRows
            .map((row) => row.disciplineRatings?.[discipline.id])
            .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
          return {
            disciplineId: discipline.id,
            disciplineName: discipline.name,
            topAvg: computeTopSixAxisAverage(scores, topSixCount),
            squadAvg: nlAverage(scores),
            ratedCount: scores.length,
          };
        })
        // Nur Disziplinen mit echten Kader-Werten zeigen — nichts erfinden.
        .filter((entry) => entry.ratedCount > 0);
      return {
        axis,
        topAvg: computeTopSixAxisAverage(values, topSixCount),
        squadAvg: nlAverage(values),
        playerCount: rated.length,
        min: values.length > 0 ? Math.min(...values) : null,
        max: values.length > 0 ? Math.max(...values) : null,
        bestName: best?.name ?? null,
        disciplines: axisDisciplines,
      };
    });
  }, [disciplines, rosterRows, topSixCount]);

  const squadTopComposite = useMemo(
    () => nlAverage(squadAxisSummaries.map((entry) => entry.topAvg).filter((value): value is number => value != null)),
    [squadAxisSummaries],
  );
  const squadFullComposite = useMemo(
    () => nlAverage(squadAxisSummaries.map((entry) => entry.squadAvg).filter((value): value is number => value != null)),
    [squadAxisSummaries],
  );
  const hasSquadSummary = rosterRows.length > 0 && squadAxisSummaries.some((entry) => entry.squadAvg != null);

  // F2/F3 — Kader-Zähler im Kopf kohärent zur sichtbaren Liste: wenn ein
  // Kader gelistet ist, zählt genau diese Liste; sonst der Server-Wert.
  const effectiveRosterCount = rosterRows.length > 0 ? rosterRows.length : rosterCount;

  return (
    <section className={`nl-market${buyModalOpen ? " is-offer-mode" : ""}`} data-new-look="true">
      {buySuccess ? (
        <div className="nl-market-signed" role="status" aria-live="polite" data-testid="nl-market-signed">
          <div className="nl-market-signed-card">
            <span className="nl-market-signed-burst" aria-hidden="true">✦</span>
            <strong className="nl-market-signed-title">VERPFLICHTET</strong>
            <p className="nl-market-signed-copy">{buySuccess}</p>
            <button type="button" className="nl-market-primary-action" onClick={onDismissBuySuccess}>
              Weiter shoppen
            </button>
          </div>
        </div>
      ) : null}

      <NlCard
        className="nl-market-header-card"
        eyebrow="Transfermarkt"
        title={teamName ?? "Markt-Überblick"}
        actions={
          <span className={`nl-market-live-pill${marketBusy ? " is-busy" : ""}`}>{marketBusy ? "lädt" : "live"}</span>
        }
      >
        <StatChipRow className="nl-market-board" aria-label="Transfer-Entscheidungsboard">
          <StatChip
            label="Cash"
            value={teamCash != null ? formatNlNumber(teamCash, 1) : "—"}
            tone="good"
            onClick={() => scrollToNlMarketSection(".nl-market-deal-card")}
            title="Zum Deal-Desk springen"
          />
          <StatChip label="Gehalt" value={teamSalaryTotal != null ? formatNlNumber(teamSalaryTotal, 1) : "—"} tone="accent" />
          <StatChip
            label="Kader"
            value={`${effectiveRosterCount ?? "—"} / ${rosterLimit ?? "—"}`}
            tone={rosterGapOpenCount != null && rosterGapOpenCount > 0 ? "warn" : "neutral"}
            sub={rosterGapOpenCount != null && rosterGapOpenCount > 0 ? `${rosterGapOpenCount} Plätze offen` : undefined}
            onClick={() => scrollToNlMarketSection(".nl-market-roster-card")}
            title="Zum eigenen Kader springen"
          />
          <StatChip
            label="Wunschliste"
            value={wishlistEntries.length}
            tone="soc"
            sub={
              scoutingPipelineCapacity
                ? `${scoutingActiveWishlistPlayerIds.length}/${scoutingPipelineCapacity.max ?? "∞"} Scouting`
                : "Kandidaten"
            }
            onClick={() => scrollToNlMarketSection(".nl-market-wishlist-card")}
            title="Zur Wishlist springen"
          />
          <StatChip label="Filter aktiv" value={activeFilterCount} tone={activeFilterCount > 0 ? "warn" : "neutral"} />
        </StatChipRow>
      </NlCard>

      <NlCard className="nl-market-controls-card" eyebrow="Markt-Pool" title="Suche, Sortierung & Filter">
        <div className="nl-market-controls">
          <label className="nl-market-search">
            <span>Suchen</span>
            <input
              value={search}
              placeholder="Name, Klasse, Rasse, Trait"
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <div className="nl-market-pill-group" role="group" aria-label="Sortierung">
            {NL_MARKET_SORT_ORDER.map((mode) => (
              <button
                key={`nl-sort-${mode}`}
                type="button"
                className={`nl-market-pill${sortMode === mode ? " is-active" : ""}`}
                aria-pressed={sortMode === mode}
                onClick={() => onSortModeChange(mode)}
              >
                {NL_MARKET_SORT_LABELS[mode]}
              </button>
            ))}
          </div>
          <div className="nl-market-pill-group" role="group" aria-label="Klassen-Achsen filtern">
            {NL_MARKET_AXES.map((axis) => (
              <button
                key={`nl-axis-filter-${axis}`}
                type="button"
                className={`nl-market-pill ${nlToneClass(axis)}${selectedClassAxes.includes(axis) ? " is-active" : ""}`}
                aria-pressed={selectedClassAxes.includes(axis)}
                onClick={() => onToggleClassAxis(axis)}
                title={`Nur ${NL_AXIS_LABELS[axis]}-Klassen anzeigen`}
              >
                {NL_AXIS_LABELS[axis]}
              </button>
            ))}
            <button type="button" className="nl-market-pill is-reset" onClick={onResetFilters}>
              Reset
            </button>
          </div>
        </div>
        {marketError ? (
          <div className="nl-market-error" role="alert">
            <div className="nl-market-error-copy">
              <strong>Transfermarkt konnte nicht geladen werden.</strong>
              <small>{marketError}</small>
            </div>
            {onRetryMarket ? (
              <button type="button" className="nl-market-pill is-reset" onClick={onRetryMarket}>
                Erneut laden
              </button>
            ) : null}
          </div>
        ) : null}
      </NlCard>

      <div className="nl-market-main-grid">
        <NlCard
          className="nl-market-rail-card"
          eyebrow="Kandidaten"
          title={`${totalVisibleCount} sichtbar`}
          actions={<small className="nl-market-rail-meta">{availabilityLabel}</small>}
        >
          <div className="nl-market-candidate-list">
            {candidates.map((item) => {
              const portrait = getTransfermarktPortraitModel(item);
              const portraitSrc = appendMediaImageVariant(portrait.src, "preview") ?? portrait.src;
              const isSelected = selectedPlayerId === item.playerId;
              const fitTone = getNlFitTone(item.fit);
              const ratioTone = getNlRatioTone(item.marketValueSalaryRatio);
              const needTone = getNlNeedTone(item.needMatchScore);
              return (
                <button
                  key={item.playerId}
                  type="button"
                  data-testid="transfer-candidate-card"
                  className={`nl-market-candidate${isSelected ? " is-selected" : ""}`}
                  aria-selected={isSelected}
                  onClick={() => onSelectCandidate(item.playerId)}
                >
                  <span className="nl-market-candidate-portrait" aria-hidden="true">
                    {portraitSrc ? (
                      <OptimizedMediaImage src={portraitSrc} alt="" width={48} height={48} className="nl-market-portrait-img" />
                    ) : (
                      <span className="nl-market-portrait-initials">{portrait.initials}</span>
                    )}
                  </span>
                  <span className="nl-market-candidate-copy">
                    <strong>{item.name}</strong>
                    <small>
                      {item.className} · {item.race}
                    </small>
                    {/* Persistentes Deal-Signal: Fit/Value-Ton immer sichtbar, nicht nur bei Auswahl. */}
                    <span className="nl-market-candidate-signals" aria-label={`${item.name} Deal-Signal`}>
                      <span className={`nl-market-signal-chip ${nlToneClass(fitTone)}`}>Fit {item.fitDisplay}</span>
                      <span className={`nl-market-signal-chip ${nlToneClass(ratioTone)}`}>
                        Value {formatTransfermarktRatio(item.marketValueSalaryRatio)}
                      </span>
                      {item.needMatchScore != null ? (
                        <span className={`nl-market-signal-chip ${nlToneClass(needTone)}`}>
                          Bedarf {formatNlNumber(item.needMatchScore, 0)}
                        </span>
                      ) : null}
                      {/* Rohdiamant-/Potenzial-Signal — nur wenn Scouting den Sterne-Gap real freigibt. */}
                      {item.potentialGapStars != null && Number.isFinite(item.potentialGapStars) && item.potentialGapStars > 0 ? (
                        <span
                          className={`nl-market-signal-chip ${nlToneClass(item.potentialGapStars >= 2 ? "good" : "accent")}`}
                          title={item.potentialStarsDisplay ?? "Sterne-Abstand aktuell → Potenzial"}
                        >
                          {item.potentialGapStars >= 2 ? "Rohdiamant" : "Potenzial"} +{item.potentialGapStars}★
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="nl-market-candidate-numbers nl-tnum">
                    <strong>{formatTransfermarktCurrency(item.marketValue)}</strong>
                    <small>{formatTransfermarktCurrency(item.salary)} p.a.</small>
                    <small>OVR {formatNlNumber(item.ovr, 0)}</small>
                  </span>
                </button>
              );
            })}
            {marketBusy && candidates.length === 0 ? (
              <p className="nl-market-muted" aria-busy="true">
                Kandidaten laden…
              </p>
            ) : null}
            {!marketBusy && !marketError && candidates.length === 0 ? (
              <p className="nl-market-muted">Keine Kandidaten im aktuellen Filter — Suche oder Limits weiter stellen.</p>
            ) : null}
            {!marketBusy && marketError && candidates.length === 0 ? (
              <p className="nl-market-muted">Feed nicht geladen — oben „Erneut laden“ nutzen.</p>
            ) : null}
          </div>
        </NlCard>

        <div className="nl-market-focus-column">
          <NlCard
            className="nl-market-focus-card"
            eyebrow="Scouting-Profil"
            title={selectedPlayer ? selectedPlayer.name : "Kandidat wählen"}
            actions={
              selectedPlayer && onOpenPlayerDetails ? (
                <button
                  type="button"
                  className="nl-market-inline-action"
                  onClick={() => onOpenPlayerDetails({ playerId: selectedPlayer.playerId })}
                >
                  Profil öffnen
                </button>
              ) : null
            }
          >
            {selectedPlayer ? (
              <>
                <div className="nl-market-focus-head">
                  <span className="nl-market-focus-portrait" aria-hidden="true">
                    {(() => {
                      const portrait = getTransfermarktPortraitModel(selectedPlayer);
                      const src = appendMediaImageVariant(portrait.src, "preview") ?? portrait.src;
                      return src ? (
                        <OptimizedMediaImage src={src} alt="" width={72} height={72} className="nl-market-portrait-img" />
                      ) : (
                        <span className="nl-market-portrait-initials">{portrait.initials}</span>
                      );
                    })()}
                  </span>
                  <div className="nl-market-focus-copy">
                    <small>
                      {selectedPlayer.className} · {selectedPlayer.race} · {selectedPlayer.alignment}
                    </small>
                    <StatChipRow className="nl-market-focus-stats" aria-label="Kandidaten-Zahlen">
                      <StatChip label="MW" value={formatTransfermarktCurrency(selectedPlayer.marketValue)} tone="accent" />
                      <StatChip label="Gehalt" value={formatTransfermarktCurrency(selectedPlayer.salary)} tone="neutral" />
                      <StatChip
                        label="Value"
                        value={formatTransfermarktRatio(selectedPlayer.marketValueSalaryRatio)}
                        tone={getNlRatioTone(selectedPlayer.marketValueSalaryRatio)}
                      />
                      <StatChip
                        label="Fit"
                        value={selectedPlayer.fitDisplay}
                        tone={getNlFitTone(selectedPlayer.fit)}
                        sub={selectedPlayer.needMatchLabel ?? undefined}
                      />
                      <StatChip label="OVR" value={formatNlNumber(selectedPlayer.ovr, 0)} tone="neutral" />
                    </StatChipRow>
                  </div>
                </div>

                {/* #68 — Achsen-Radar statt vier linearer Balken. Werte fog-gated (scoutedPow/…). */}
                <div className="nl-market-focus-radar" aria-label="Kandidaten-Achsen">
                  <NlRadar
                    axes={NL_MARKET_AXES.flatMap((axis) => {
                      const value = selectedPlayer[axis];
                      return typeof value === "number" && Number.isFinite(value) ? [{ key: axis, value }] : [];
                    })}
                    max={100}
                    showValues
                    aria-label={`${selectedPlayer.name} Achsen-Radar POW/SPE/MEN/SOC`}
                    className="nl-market-axis-radar"
                  />
                </div>

                {/* #18 — Potenzial-Sterne & Entwicklungs-Trend (fog-gated Anzeige-Labels). */}
                {selectedPlayer.axisStarsDisplay || selectedPlayer.potentialStarsDisplay || selectedPlayer.developmentTrend ? (
                  <div className="nl-market-talent-row" aria-label="Potenzial & Entwicklung">
                    {selectedPlayer.axisStarsDisplay ? (
                      <span className="nl-market-talent-line">
                        <span className="nl-market-talent-key">Aktuell</span>
                        <strong>{selectedPlayer.axisStarsDisplay}</strong>
                      </span>
                    ) : null}
                    {selectedPlayer.potentialStarsDisplay ? (
                      <span className="nl-market-talent-line">
                        <span className="nl-market-talent-key">Potenzial</span>
                        <strong>{selectedPlayer.potentialStarsDisplay}</strong>
                        {selectedPlayer.potentialGapStars != null && Number.isFinite(selectedPlayer.potentialGapStars) ? (
                          <span
                            className={`nl-market-signal-chip ${nlToneClass(
                              selectedPlayer.potentialGapStars >= 2 ? "good" : "neutral",
                            )}`}
                          >
                            Gap {selectedPlayer.potentialGapStars}★
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    {selectedPlayer.developmentTrend ? (
                      <span
                        className={`nl-market-signal-chip ${nlToneClass(
                          NL_DEV_TREND_TONE[selectedPlayer.developmentTrend] ?? "neutral",
                        )}`}
                        title="Entwicklungs-Trend aus dem Trainings-Forecast"
                      >
                        Trend {NL_DEV_TREND_LABEL[selectedPlayer.developmentTrend] ?? "—"}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {/* #69 — Top-Disziplinen als Balken-Chart. Nur real freigegebene Exakt-Scores (displayedScore). */}
                {(() => {
                  const disciplineBars = selectedPlayer.topDisciplineScores
                    .filter(
                      (entry) => typeof entry.displayedScore === "number" && Number.isFinite(entry.displayedScore),
                    )
                    .slice(0, 5)
                    .map((entry) => ({
                      label: entry.disciplineName.length > 7 ? `${entry.disciplineName.slice(0, 6)}…` : entry.disciplineName,
                      value: entry.displayedScore as number,
                      tone: "accent" as NlTone,
                    }));
                  if (disciplineBars.length > 0) {
                    return (
                      <div className="nl-market-diszi-chart" aria-label="Top-Disziplinen des Kandidaten">
                        <span className="nl-market-eyebrow">Top-Disziplinen (gescoutet)</span>
                        <NlBarChart
                          bars={disciplineBars}
                          format={(value) => formatNlNumber(value, 0)}
                          aria-label={`${selectedPlayer.name} Top-Disziplinen`}
                          className="nl-market-diszi-barchart"
                        />
                      </div>
                    );
                  }
                  if (selectedPlayer.topDisciplineScores.length > 0) {
                    return (
                      <p className="nl-market-muted nl-market-diszi-hint">
                        Disziplin-Werte noch verdeckt — weiter scouten für exakte Scores.
                      </p>
                    );
                  }
                  return null;
                })()}

                <div className="nl-market-focus-actions">
                  <button
                    type="button"
                    className="nl-market-primary-action"
                    data-testid="transfer-deal-open-button"
                    disabled={Boolean(dealOpenDisabledReason)}
                    title={dealOpenDisabledReason ?? "Öffnet das Kaufmodal mit Vertragsrahmen, Forderung und Teamwirkung."}
                    onClick={onOpenDeal}
                  >
                    {buyBusy ? "kauft…" : "Deal prüfen"}
                  </button>
                  <button
                    type="button"
                    className={`nl-market-secondary-action${selectedPlayerWishlisted ? " is-active" : ""}`}
                    disabled={Boolean(wishlistDisabledReason && !selectedPlayerWishlisted)}
                    title={
                      selectedPlayerWishlisted
                        ? "Von der Wishlist nehmen — Scouting-Slot wird frei."
                        : wishlistDisabledReason ?? "Spieler auf die Wishlist setzen und bevorzugt scouten."
                    }
                    onClick={onToggleSelectedWishlist}
                  >
                    {selectedPlayerWishlisted ? "Von Wishlist nehmen" : "Auf Wishlist"}
                  </button>
                  <button
                    type="button"
                    className={`nl-market-secondary-action${selectedPlayerScoutingWatched ? " is-active" : ""}`}
                    disabled={Boolean(scoutingWatchDisabledReason && !selectedPlayerScoutingWatched)}
                    title={
                      selectedPlayerScoutingWatched
                        ? "Spieler aus der aktiven Beobachtung nehmen."
                        : scoutingWatchDisabledReason ?? "Spieler aktiv beobachten — Intel baut sich über Spieltage auf."
                    }
                    onClick={onToggleSelectedScoutingWatch}
                  >
                    {selectedPlayerScoutingWatched ? "Nicht mehr beobachten" : "Beobachten"}
                  </button>
                </div>
                {selectedPlayerScoutCertainty != null ? (
                  <NlProgressBar
                    value={Math.max(0, Math.min(100, selectedPlayerScoutCertainty))}
                    max={100}
                    label="Scouting-Intel"
                    tone="accent"
                    format={(value) => `${Math.round(value)}%`}
                    className="nl-market-intel-bar"
                  />
                ) : null}
                {dealOpenDisabledReason ? (
                  <p className="nl-market-action-reason">Warum nicht: {dealOpenDisabledReason}</p>
                ) : null}
              </>
            ) : (
              <p className="nl-market-muted">
                Wähle links einen Kandidaten — dann siehst du Deal-Desk und Teamwirkung an einer Stelle.
              </p>
            )}
          </NlCard>

          <NlCard
            className="nl-market-impact-card"
            eyebrow="Team-Impact"
            title={`Top-${topSixCount} Schnitt mit Kauf`}
            actions={impactIsEstimate ? <span className="nl-market-estimate-pill">geschätzt</span> : null}
          >
            {selectedPlayer ? (
              <>
                <p className="nl-market-impact-summary">
                  Aktuell{" "}
                  <strong className="nl-tnum">
                    {topSixCompositeBefore != null ? formatNlNumber(topSixCompositeBefore, 1) : "—"}
                  </strong>
                  {topSixCompositeDelta != null ? (
                    <>
                      {" · mit Kauf "}
                      <NlDeltaChip
                        value={topSixCompositeDelta}
                        format={() =>
                          formatScoutedImpactDelta(topSixCompositeDelta, selectedScoutingConfidence, (value, digits) =>
                            formatNlNumber(value, digits ?? 1),
                          )
                        }
                        title={estimateNote}
                      />
                    </>
                  ) : null}
                </p>
                {impactIsEstimate ? (
                  <small className="nl-market-estimate-note">
                    Schätzwerte auf Basis des Scouting-Standes — genaue Teamwirkung erst nach mehr Intel.
                  </small>
                ) : null}
                <div className="nl-market-impact-axes">
                  {topSixAxisImpact.map((row) => {
                    const rankEstimate = topSixAxisRankEstimates.find((entry) => entry.axis === row.axis);
                    const rankLabel = formatTeamRankEstimateLabel(rankEstimate, selectedScoutingConfidence);
                    return (
                      <div className={`nl-market-impact-axis ${nlToneClass(row.axis)}`} key={`nl-impact-${row.axis}`}>
                        <div className="nl-market-impact-axis-head">
                          <strong>{NL_AXIS_LABELS[row.axis]}</strong>
                          {wishlistAxes.includes(row.axis) ? <span className="nl-market-need-tag">Bedarf</span> : null}
                          {row.delta != null ? (
                            <NlDeltaChip
                              value={row.delta}
                              format={() =>
                                formatScoutedImpactDelta(row.delta, selectedScoutingConfidence, (value, digits) =>
                                  formatNlNumber(value, digits ?? 1),
                                )
                              }
                              title={estimateNote}
                            />
                          ) : null}
                        </div>
                        <div className="nl-market-impact-axis-bars">
                          <NlProgressBar
                            value={row.before ?? 0}
                            max={100}
                            label="vorher"
                            tone={row.axis}
                            format={(value) => formatNlNumber(row.before != null ? value : null, 1)}
                            className="nl-market-impact-bar is-before"
                          />
                          <NlProgressBar
                            value={row.after ?? 0}
                            max={100}
                            label="mit Kauf"
                            tone={row.axis}
                            format={(value) => formatNlNumber(row.after != null ? value : null, 1)}
                            className="nl-market-impact-bar"
                          />
                        </div>
                        {rankLabel ? <small className="nl-market-rank-estimate">Rang {rankLabel}</small> : null}
                      </div>
                    );
                  })}
                </div>
                {disciplineImpact.length > 0 ? (
                  <div className="nl-market-impact-disciplines" aria-label="Top-Diszi-Sprünge">
                    <span className="nl-market-eyebrow">Größte Diszi-Sprünge (Top-{topSixCount} Ø)</span>
                    {disciplineImpact.map((row) => (
                      <div className="nl-market-impact-discipline-row" key={`nl-diszi-${row.disciplineId}`}>
                        <strong>{row.disciplineName}</strong>
                        <span className="nl-tnum">
                          {formatNlNumber(row.beforeTopSixAvg, 1)} → {formatNlNumber(row.afterTopSixAvg, 1)}
                        </span>
                        {row.delta != null ? (
                          <NlDeltaChip
                            value={row.delta}
                            format={() =>
                              formatScoutedImpactDelta(row.delta, selectedScoutingConfidence, (value, digits) =>
                                formatNlNumber(value, digits ?? 1),
                              )
                            }
                            title={estimateNote ?? `Scouting-Fenster ${row.tierWindow}`}
                          />
                        ) : null}
                        <small>{row.tierWindow}</small>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="nl-market-muted">Team-Impact erscheint, sobald ein Kandidat gewählt ist.</p>
            )}
          </NlCard>
        </div>

        <NlCard
          className="nl-market-deal-card"
          eyebrow="Deal-Desk"
          title="Deal-Vorschau"
          actions={
            <span className={`nl-market-live-pill${buyPreviewCanBuy ? " is-ready" : ""}`}>
              {buyPreviewCanBuy ? "bereit" : "prüfen"}
            </span>
          }
        >
          {previewError ? <p className="nl-market-error">{previewError}</p> : null}
          <div className="nl-market-pill-group" role="group" aria-label="Vertragslänge" data-testid="market-v2-contract-segmented">
            {[1, 2, 3].map((length) => (
              <button
                key={`nl-contract-${length}`}
                type="button"
                className={`nl-market-pill${contractLength === length ? " is-active" : ""}`}
                aria-pressed={contractLength === length}
                onClick={() => onContractLengthChange(length)}
              >
                {length} Saison{length === 1 ? "" : "en"}
              </button>
            ))}
          </div>
          <StatChipRow className="nl-market-deal-topline" aria-label="Deal-Kernzahlen">
            <StatChip label="Ablöse" value={formatTransfermarktCurrency(previewPurchasePrice)} tone="accent" />
            <StatChip label="Forderung p.a." value={previewSalaryLabel} tone="warn" />
          </StatChipRow>
          <div className="nl-market-deal-rows" aria-label="Vorher-Nachher mit Kauf">
            <NlMarketBeforeAfterRow
              label="Cash"
              before={previewCashBefore}
              after={previewCashAfter}
              format={(value) => formatTransfermarktCurrency(value)}
            />
            <NlMarketBeforeAfterRow
              label="Gehalt"
              before={previewTeamSalaryBefore}
              after={previewTeamSalaryAfter}
              format={(value) => formatTransfermarktCurrency(value)}
              invert
            />
            <NlMarketBeforeAfterRow
              label="Kader"
              before={previewRosterBefore}
              after={previewRosterAfter}
              format={(value) => formatNlNumber(value, 0)}
            />
            <NlMarketBeforeAfterRow
              label="MW"
              before={previewMarketValueBefore}
              after={previewMarketValueAfter}
              format={(value) => formatTransfermarktCurrency(value)}
            />
          </div>
          {buyBlockingReasons.length > 0 ? (
            <div className="nl-market-warning-box is-blocking">
              <strong>Noch offen</strong>
              <p>{buyBlockingReasons.join(" · ")}</p>
            </div>
          ) : null}
          {buyWarnings.length > 0 ? (
            <div className="nl-market-warning-box">
              <strong>Hinweise</strong>
              <p>{buyWarnings.slice(0, 3).join(" · ")}</p>
            </div>
          ) : null}
        </NlCard>
      </div>

      <div className="nl-market-context-grid">
        <NlCard
          className="nl-market-wishlist-card"
          eyebrow="Wishlist & Scouting"
          title={
            scoutingPipelineCapacity?.draftSuspended
              ? `${wishlistEntries.length} gemerkt · Draft ohne Limit`
              : scoutingPipelineCapacity
                ? `${wishlistEntries.length}/${scoutingPipelineCapacity.max ?? "∞"} Scouting-Slots`
                : `${wishlistEntries.length} gemerkt`
          }
        >
          {wishlistEntries.length > 0 ? (
            <div className="nl-market-wishlist-strip" role="list" aria-label="Wishlist-Kandidaten">
              {wishlistEntries.map((entry) => {
                const marketItem = marketItemsById.get(entry.playerId);
                const portraitBase = marketItem
                  ? getTransfermarktPortraitModel(marketItem).src
                  : getPlayerPortraitBrowserUrl(entry.playerId);
                const portraitSrc = appendMediaImageVariant(portraitBase, "preview") ?? portraitBase;
                const intel = scoutingIntelByPlayerId[entry.playerId] ?? null;
                const isActiveScout = scoutingActiveSet.has(entry.playerId);
                return (
                  <article className="nl-market-wishlist-chip" role="listitem" key={entry.id}>
                    <button
                      type="button"
                      className="nl-market-wishlist-main"
                      title="Kandidat im Markt fokussieren"
                      onClick={() => onFocusWishlistEntry(entry)}
                    >
                      <span className="nl-market-candidate-portrait" aria-hidden="true">
                        {portraitSrc ? (
                          <OptimizedMediaImage src={portraitSrc} alt="" width={40} height={40} className="nl-market-portrait-img" />
                        ) : (
                          <span className="nl-market-portrait-initials">{getNlInitials(entry.playerName)}</span>
                        )}
                      </span>
                      <span className="nl-market-wishlist-copy">
                        <strong>{entry.playerName}</strong>
                        <small>
                          {entry.className} · {formatTransfermarktCurrency(entry.marketValue)} MW
                        </small>
                        <span
                          className={`nl-market-signal-chip ${
                            scoutingPipelineCapacity?.draftSuspended
                              ? nlToneClass("accent")
                              : isActiveScout
                                ? nlToneClass("good")
                                : nlToneClass("neutral")
                          }`}
                        >
                          {scoutingPipelineCapacity?.draftSuspended
                            ? "Draft"
                            : isActiveScout
                              ? `Scout aktiv ${intel ?? 0}%`
                              : "Nur gemerkt"}
                        </span>
                      </span>
                    </button>
                    <div className="nl-market-wishlist-actions">
                      <button type="button" className="nl-market-inline-action" onClick={() => onOpenWishlistDeal(entry)}>
                        Deal
                      </button>
                      {onRemoveWishlist ? (
                        <button
                          type="button"
                          className="nl-market-inline-action is-danger"
                          title="Spieler von der Wishlist nehmen."
                          onClick={() => onRemoveWishlist(entry.playerId)}
                        >
                          Entfernen
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="nl-market-muted">
              Wishlist leer — merke Kandidaten im Markt, um sie später gezielt zu scouten.
            </p>
          )}
        </NlCard>

        <NlCard
          className="nl-market-roster-card"
          eyebrow="Aktueller Kader"
          title={`Was ich habe — ${rosterRows.length} Spieler`}
          actions={teamShortCode ? <small className="nl-market-rail-meta">{teamShortCode}</small> : null}
        >
          {/* F4/F5 — Team-Stärke: Ø der vier Achsen (Top-6 vs. ganzer Kader),
              je Achse aufklappbar zu den Sub-Disziplinen (Muster wie
              SeasonStandingsNewLook "Disziplinen nach Bereich"). */}
          {hasSquadSummary ? (
            <div className="nl-market-squad-summary" aria-label="Team-Stärke nach Achsen">
              <div className="nl-market-squad-head">
                <span className="nl-market-eyebrow">Team-Stärke — Ø je Achse</span>
                <span className="nl-market-squad-legend" aria-hidden="true">
                  <span className="nl-market-squad-legend-item is-top">Top-{topSixCount} (Aufstellung)</span>
                  <span className="nl-market-squad-legend-item is-squad">Kader ({rosterRows.length})</span>
                </span>
              </div>
              <StatChipRow className="nl-market-squad-composite" aria-label="Team-Stärke gesamt">
                <StatChip
                  label={`Top-${topSixCount} Ø`}
                  value={formatNlNumber(squadTopComposite, 1)}
                  tone="accent"
                  sub={`beste ${topSixCount} je Achse`}
                  title={`Ø der vier Achsen-Schnitte über die jeweils besten ${topSixCount} Spieler`}
                />
                <StatChip
                  label="Kader Ø"
                  value={formatNlNumber(squadFullComposite, 1)}
                  tone="neutral"
                  sub={`alle ${rosterRows.length} Spieler`}
                  title="Ø der vier Achsen-Schnitte über den ganzen Kader"
                />
              </StatChipRow>
              <div className="nl-market-squad-axes">
                {squadAxisSummaries.map((summary) => {
                  const isExpanded = expandedSquadAxis === summary.axis;
                  const detailId = `nl-market-squad-detail-${summary.axis}`;
                  const depthGap =
                    summary.topAvg != null && summary.squadAvg != null ? summary.topAvg - summary.squadAvg : null;
                  return (
                    <div
                      key={`nl-squad-axis-${summary.axis}`}
                      className={`nl-market-squad-axis ${nlToneClass(summary.axis)}${isExpanded ? " is-expanded" : ""}`}
                    >
                      <button
                        type="button"
                        className="nl-market-squad-axis-toggle"
                        aria-expanded={isExpanded}
                        aria-controls={detailId}
                        aria-label={`${NL_AXIS_LABELS[summary.axis]} Details ${isExpanded ? "einklappen" : "ausklappen"}`}
                        onClick={() =>
                          setExpandedSquadAxis((current) => (current === summary.axis ? null : summary.axis))
                        }
                      >
                        <span className="nl-market-squad-axis-label">
                          {NL_AXIS_LABELS[summary.axis]}
                          {wishlistAxes.includes(summary.axis) ? (
                            <span className="nl-market-need-tag">Bedarf</span>
                          ) : null}
                        </span>
                        <span className="nl-market-squad-axis-bars">
                          <NlProgressBar
                            value={summary.topAvg ?? 0}
                            max={100}
                            label={`Top-${topSixCount}`}
                            tone={summary.axis}
                            format={() => formatNlNumber(summary.topAvg, 1)}
                            className="nl-market-squad-bar is-top"
                          />
                          <NlProgressBar
                            value={summary.squadAvg ?? 0}
                            max={100}
                            label="Kader"
                            tone={summary.axis}
                            format={() => formatNlNumber(summary.squadAvg, 1)}
                            className="nl-market-squad-bar is-squad"
                          />
                        </span>
                        <span
                          className="nl-market-squad-axis-gap nl-tnum"
                          title={`Abstand Top-${topSixCount} zu Kader-Ø — großer Abstand heißt wenig Tiefe hinter der Aufstellung.`}
                        >
                          {depthGap != null ? `Δ ${formatNlNumber(depthGap, 1)}` : "—"}
                        </span>
                        <span className="nl-market-squad-caret" aria-hidden="true">
                          {isExpanded ? "▾" : "▸"}
                        </span>
                      </button>
                      {isExpanded ? (
                        <div className="nl-market-squad-expand" id={detailId}>
                          <div className="nl-market-squad-range">
                            {summary.bestName ? (
                              <span>
                                Stärkster <strong>{summary.bestName}</strong>{" "}
                                <span className="nl-tnum">({formatNlNumber(summary.max, 0)})</span>
                              </span>
                            ) : null}
                            {summary.min != null && summary.max != null ? (
                              <span className="nl-tnum">
                                Spanne {formatNlNumber(summary.min, 0)}–{formatNlNumber(summary.max, 0)}
                              </span>
                            ) : null}
                            <span>
                              {summary.playerCount}/{rosterRows.length} Spieler mit Wert
                            </span>
                          </div>
                          {summary.disciplines.length > 0 ? (
                            <ul
                              className="nl-market-squad-disc-list"
                              aria-label={`${NL_AXIS_LABELS[summary.axis]} Sub-Disziplinen`}
                            >
                              <li className="nl-market-squad-disc is-head" aria-hidden="true">
                                <span className="nl-market-squad-disc-label">Disziplin</span>
                                <span className="nl-market-squad-disc-track-spacer" />
                                <span className="nl-market-squad-disc-value">Top-{topSixCount} Ø</span>
                                <span className="nl-market-squad-disc-value is-squad">Kader Ø</span>
                              </li>
                              {summary.disciplines.map((discipline) => (
                                <li
                                  key={`nl-squad-disc-${discipline.disciplineId}`}
                                  className="nl-market-squad-disc"
                                  title={`${discipline.disciplineName}: Top-${topSixCount} Ø ${formatNlNumber(
                                    discipline.topAvg,
                                    1,
                                  )} · Kader Ø ${formatNlNumber(discipline.squadAvg, 1)} (${discipline.ratedCount} Spieler)`}
                                >
                                  <span className="nl-market-squad-disc-label">{discipline.disciplineName}</span>
                                  <span className="nl-market-squad-disc-track" aria-hidden="true">
                                    <span
                                      className="nl-market-squad-disc-fill"
                                      style={{ width: `${Math.max(3, Math.min(100, discipline.topAvg ?? 0))}%` }}
                                    />
                                    <span
                                      className="nl-market-squad-disc-fill is-squad"
                                      style={{ width: `${Math.max(3, Math.min(100, discipline.squadAvg ?? 0))}%` }}
                                    />
                                  </span>
                                  <span className="nl-market-squad-disc-value nl-tnum">
                                    {formatNlNumber(discipline.topAvg, 1)}
                                  </span>
                                  <span className="nl-market-squad-disc-value is-squad nl-tnum">
                                    {formatNlNumber(discipline.squadAvg, 1)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="nl-market-muted">
                              Für diesen Kader liegen keine Disziplin-Werte vor — das Achsen-Detail zeigt Spanne und
                              stärksten Spieler.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="nl-market-need-summary" aria-label="Transferbedarf">
            <span className="nl-market-eyebrow">Was ich noch brauche</span>
            <div className="nl-market-need-chips">
              {/* F2/F3 — nur echte Aussagen: unbekannte Werte (null) blenden den Chip aus. */}
              {rosterGapOpenCount != null ? (
                <span
                  className={`nl-market-signal-chip ${rosterGapOpenCount > 0 ? nlToneClass("warn") : nlToneClass("good")}`}
                >
                  {rosterGapOpenCount > 0
                    ? `${rosterGapOpenCount} Kaderplatz${rosterGapOpenCount === 1 ? "" : "e"} offen`
                    : "Kadergröße okay"}
                </span>
              ) : null}
              {budgetStatusLabel ? (
                <span className={`nl-market-signal-chip ${nlToneClass("neutral")}`}>Budget {budgetStatusLabel}</span>
              ) : null}
              {readinessStatusLabel ? (
                <span className={`nl-market-signal-chip ${nlToneClass("neutral")}`}>Status {readinessStatusLabel}</span>
              ) : null}
              {wishlistAxes.length > 0 ? (
                wishlistAxes.map((axis) => (
                  <span key={`nl-need-axis-${axis}`} className={`nl-market-signal-chip ${nlToneClass(axis)}`}>
                    Bedarf {NL_AXIS_LABELS[axis]}
                  </span>
                ))
              ) : (
                <span className={`nl-market-signal-chip ${nlToneClass("neutral")}`}>kein akuter Achsenbedarf</span>
              )}
              {wishlistDisciplines.slice(0, 6).map((disciplineName) => (
                <span key={`nl-need-diszi-${disciplineName}`} className={`nl-market-signal-chip ${nlToneClass("warn")}`}>
                  {disciplineName}
                </span>
              ))}
            </div>
          </div>
          {rosterRows.length > 0 ? (
            <div className="nl-market-roster-list">
              {rosterRows.map((row) => {
                const portraitBase = row.portraitUrl ?? getPlayerPortraitBrowserUrl(row.playerId);
                const portraitSrc = appendMediaImageVariant(portraitBase, "thumb") ?? portraitBase;
                return (
                  <article className="nl-market-roster-row" key={row.activePlayerId}>
                    <button
                      type="button"
                      className="nl-market-roster-main"
                      onClick={() => onOpenPlayerDetails?.({ playerId: row.playerId, activePlayerId: row.activePlayerId })}
                      title={`${row.name} öffnen`}
                    >
                      <span className="nl-market-candidate-portrait" aria-hidden="true">
                        {portraitSrc ? (
                          <OptimizedMediaImage src={portraitSrc} alt="" width={36} height={36} className="nl-market-portrait-img" />
                        ) : (
                          <span className="nl-market-portrait-initials">{getNlInitials(row.name)}</span>
                        )}
                      </span>
                      <span className="nl-market-roster-copy">
                        <strong>{row.name}</strong>
                        <small>
                          {row.className}
                          {row.race ? ` · ${row.race}` : ""}
                          {row.contractLength != null ? ` · LZ ${row.contractLength}` : ""}
                        </small>
                      </span>
                    </button>
                    <StatChipRow className="nl-market-roster-stats" aria-label={`${row.name} Kennzahlen`}>
                      <StatChip label="OVR" value={formatNlNumber(row.ovr, 0)} tone="neutral" />
                      <StatChip label="PPs" value={formatNullablePps(row.pps)} tone="accent" />
                      <StatChip label="MVS" value={formatNullablePps(row.mvs)} tone="neutral" />
                      <StatChip label="MW" value={formatTransfermarktCurrency(row.marketValue)} tone="soc" />
                    </StatChipRow>
                    {/* #17 — Achsen mit Vorsaison-Entwicklung: aktueller Achswert + Vorsaison-PPs & -Rang. */}
                    <span className="nl-market-roster-axes" aria-label={`${row.name} Achsen mit Vorsaison`}>
                      {NL_MARKET_AXES.map((axis) => {
                        const prev = row.previousSeasonAxis ?? null;
                        const prevKeys = NL_PREV_SEASON_AXIS_KEYS[axis];
                        const prevPoints = prev ? prev[prevKeys.points] : null;
                        const prevRank = prev ? prev[prevKeys.rank] : null;
                        const hasPrev = prevPoints != null && Number.isFinite(prevPoints);
                        return (
                          <span
                            key={`nl-roster-axis-${row.activePlayerId}-${axis}`}
                            className={`nl-market-axis-chip ${nlToneClass(axis)}`}
                          >
                            <b>{NL_AXIS_LABELS[axis]}</b>
                            <span className="nl-tnum">{formatNlNumber(row[axis], 0)}</span>
                            {hasPrev ? (
                              <small
                                className="nl-market-axis-prev nl-tnum"
                                title={`${prev?.seasonId ?? "Vorsaison"}: ${formatNullablePps(prevPoints)} PPs${
                                  prevRank != null ? ` · Rang #${prevRank}` : ""
                                }`}
                              >
                                VS {formatNullablePps(prevPoints)}
                                {prevRank != null ? ` · #${prevRank}` : ""}
                              </small>
                            ) : null}
                          </span>
                        );
                      })}
                    </span>
                    {onSellRow ? (
                      <button
                        type="button"
                        className="nl-market-inline-action is-danger"
                        data-testid="transfer-roster-sell-button"
                        title={`${row.name} verkaufen`}
                        onClick={() => onSellRow(row)}
                      >
                        Verkaufen
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="nl-market-muted">
              Noch kein Kader im Fokus — wähle ein Team, dann siehst du hier, woran du deine Käufe ausrichtest.
            </p>
          )}
        </NlCard>
      </div>

      {historyItems.length > 0 ? (
        <NlCard className="nl-market-history-card" eyebrow="Letzte Deals" title={`${historyItems.length} sichtbar (alle Seasons)`}>
          <div className="nl-market-history-list">
            {historyItems.map((entry) => (
              <button
                key={entry.transferId}
                type="button"
                className="nl-market-history-row"
                onClick={() => onOpenPlayerDetails?.({ playerId: entry.playerId })}
              >
                <span className="nl-market-history-copy">
                  <strong>{entry.playerName}</strong>
                  <small>
                    {entry.type === "buy"
                      ? `${entry.toTeamName ?? "—"} kauft von ${entry.fromTeamName ?? "Free Agent"}`
                      : `${entry.fromTeamName ?? "—"} verkauft an ${entry.toTeamName ?? "—"}`}
                  </small>
                </span>
                <span className="nl-market-history-numbers nl-tnum">
                  <strong>{formatTransfermarktCurrency(entry.fee)}</strong>
                  <small>{entry.seasonLabel}</small>
                </span>
              </button>
            ))}
          </div>
        </NlCard>
      ) : null}

      {buyModalSlot}
    </section>
  );
}
