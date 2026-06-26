"use client";

import { useEffect, useState, type DragEvent, type ReactNode } from "react";

import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";

import { getClassColorClassName } from "./ClassColorChip";
import ClassIcon from "./ClassIcon";
import DisciplineIcon from "./DisciplineIcon";
import OptimizedMediaImage from "./OptimizedMediaImage";
import RaceIcon from "./RaceIcon";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { GameTerm, getGameTermTooltip } from "@/components/ui/GameTerm";
import { VeloImpactStrip, VeloStatOrbitRow } from "@/components/foundation/velo-ui";

function formatValue(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPointsWithAppearances(points: number | null | undefined, appearances: number | null | undefined) {
  if (points == null || !Number.isFinite(points)) {
    return "—";
  }
  return `${formatValue(points, 1)}${appearances != null ? ` / ${appearances} Eins.` : ""}`;
}

function formatPointsWithRank(points: number | null | undefined, rank: number | null | undefined) {
  if (points == null || !Number.isFinite(points)) {
    return "—";
  }
  return `${formatValue(points, 1)}${rank != null ? ` #${rank}` : ""}`;
}

function formatPointsWithAppearancesAndRank(
  points: number | null | undefined,
  appearances: number | null | undefined,
  rank: number | null | undefined,
) {
  if (points == null || !Number.isFinite(points)) {
    return "—";
  }
  const fragments = [formatValue(points, 1)];
  if (appearances != null) {
    fragments.push(`${appearances} Eins.`);
  }
  if (rank != null) {
    fragments.push(`#${rank}`);
  }
  return fragments.join(" · ");
}

function formatAveragePoints(points: number | null | undefined, appearances: number | null | undefined) {
  if (points == null || appearances == null || appearances <= 0 || !Number.isFinite(points)) {
    return "—";
  }
  return formatValue(points / appearances, 1);
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSignedMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatMoney(value)}`;
}

function formatMoneyWithBaselineDelta(value: number | null | undefined, delta: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) < 0.01) {
    return formatMoney(value);
  }

  return `${formatMoney(value)} (${formatSignedMoney(delta)})`;
}

function formatMoneyFactor(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `x${formatValue(value, 2)}`;
}

function formatHistoryTransferType(value: "buy" | "sell" | "contract_exit" | null | undefined) {
  if (value === "buy") return "Kauf";
  if (value === "sell") return "VK";
  if (value === "contract_exit") return "Exit";
  return null;
}

function formatSignedPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value, 1)}%`;
}

function buildInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatRoleTag(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  if (value === "starter") {
    return "Starter";
  }
  if (value === "bench") {
    return "Bank";
  }
  if (value === "rotation") {
    return "Rotation";
  }
  if (value === "prospect") {
    return "Prospect";
  }
  return value;
}

function getDisciplineValueHeatClass(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }
  if (value >= 90) return "heat-band-8";
  if (value >= 80) return "heat-band-7";
  if (value >= 70) return "heat-band-6";
  if (value >= 60) return "heat-band-5";
  if (value >= 50) return "heat-band-4";
  if (value >= 40) return "heat-band-3";
  if (value >= 25) return "heat-band-2";
  return "heat-band-1";
}

function getTransferStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("free")) {
    return " is-warning";
  }
  if (normalized.includes("target")) {
    return " is-info";
  }
  return " is-ready";
}

function getAttributeTierClass(value: string | null | undefined) {
  switch (value) {
    case "S+":
      return "is-tier-splus";
    case "S":
      return "is-tier-s";
    case "A":
      return "is-tier-a";
    case "B":
      return "is-tier-b";
    case "C":
      return "is-tier-c";
    case "D":
      return "is-tier-d";
    case "E":
      return "is-tier-e";
    case "F":
      return "is-tier-f";
    default:
      return "";
  }
}

function getDeltaToneClass(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }
  if (value > 0) {
    return " is-positive";
  }
  if (value < 0) {
    return " is-negative";
  }
  return " is-neutral";
}

function formatAxisStarValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}★`;
}

function formatStarDelta(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value === 0) {
    return null;
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}★`;
}

function getRouteStateChipClass(state: "open" | "closing" | "capped") {
  if (state === "capped") return " is-negative";
  if (state === "closing") return " is-neutral";
  return " is-positive";
}

function getCeilingStateChipClass(state: "open" | "closing" | "capped") {
  if (state === "capped") return " is-negative";
  if (state === "closing") return " is-neutral";
  return "";
}

function getMoneyDeltaToneClass(value: number | null | undefined, positiveDirection: "higher" | "lower") {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.01) {
    return "";
  }
  const isPositive = positiveDirection === "higher" ? value > 0 : value < 0;
  return isPositive ? " is-positive" : " is-negative";
}

function getAxisToneClass(tone: "power" | "speed" | "mental" | "social") {
  switch (tone) {
    case "power":
      return "is-power";
    case "speed":
      return "is-speed";
    case "mental":
      return "is-mental";
    case "social":
      return "is-social";
    default:
      return "";
  }
}

function getDisciplineAreaClass(category: "power" | "speed" | "mental" | "social") {
  switch (category) {
    case "power":
      return "is-power";
    case "speed":
      return "is-speed";
    case "mental":
      return "is-mental";
    case "social":
      return "is-social";
    default:
      return "";
  }
}

function formatRankLabel(rank: number | null | undefined) {
  return rank == null ? "#" : `#${rank}`;
}

function formatOptionalRankLabel(rank: number | null | undefined) {
  return rank == null ? "–" : `#${rank}`;
}

function formatHistoryMetric(value: number | null | undefined, rank?: number | null | undefined, digits = 1) {
  const formattedValue = formatValue(value, digits);
  return rank != null ? `${formattedValue} · #${rank}` : formattedValue;
}

function formatDisciplineValue(value: number | null | undefined, delta: number | null | undefined) {
  const base = formatValue(value, 0);
  if (delta == null || !Number.isFinite(delta) || delta <= 0) {
    return base;
  }
  return `${base} (+${formatValue(delta, 0)})`;
}

function formatSourceFreeDetail(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDevelopmentTrend(value: string | null | undefined) {
  switch (value) {
    case "strong_positive":
      return "stark positiv";
    case "positive":
      return "positiv";
    case "neutral":
      return "Stagnation";
    case "negative":
      return "leicht negativ";
    case "strong_negative":
      return "Regression-Risiko";
    default:
      return "—";
  }
}

function formatRegressionRisk(value: string | null | undefined) {
  switch (value) {
    case "none":
      return "kein";
    case "low":
      return "niedrig";
    case "medium":
      return "mittel";
    case "high":
      return "hoch";
    default:
      return "—";
  }
}

function formatDevelopmentRoute(value: string | null | undefined) {
  switch (value) {
    case "star_growth":
      return "Star-Entwicklung";
    case "core_growth":
      return "Core-Entwicklung";
    case "depth_growth":
      return "Breite entwickeln";
    case "prospect_growth":
      return "Prospect-Route";
    case "maintenance":
      return "Niveau halten";
    case "stagnation_watch":
      return "Stagnation beobachten";
    case "free_agent_ambient":
      return "Markt-Entwicklung";
    default:
      return "—";
  }
}

function formatDevelopmentLevelTrend(value: string | null | undefined) {
  switch (value) {
    case "growth":
      return "Entwicklung";
    case "stable":
      return "stabil";
    case "stagnation":
      return "Stagnation";
    case "regression":
      return "Regression";
    default:
      return "—";
  }
}

function getDevelopmentLevelTrendClass(value: string | null | undefined) {
  switch (value) {
    case "growth":
      return " is-positive";
    case "regression":
      return " is-negative";
    case "stagnation":
      return " is-warning";
    default:
      return " is-neutral";
  }
}

function getAffinityIcon(value: string | null | undefined) {
  if (value === "signature") return "★";
  if (value === "weak") return "◆";
  return "";
}

function getAffinityLabel(value: string | null | undefined) {
  if (value === "signature") return "Signature";
  if (value === "weak") return "Weak";
  return "Neutral";
}

function getAffinityChipText(cost: number | null | undefined) {
  return cost != null ? `${cost} TP` : "—";
}

function formatDisciplineTier(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 92) return "S+";
  if (value >= 82) return "S";
  if (value >= 72) return "A";
  if (value >= 60) return "B";
  if (value >= 48) return "C";
  if (value >= 36) return "D";
  if (value >= 24) return "E";
  return "F";
}

function isPlausibleSalaryDeltaReference(
  salary: number | null | undefined,
  normalSalary: number | null | undefined,
) {
  if (
    salary == null ||
    normalSalary == null ||
    !Number.isFinite(salary) ||
    !Number.isFinite(normalSalary) ||
    salary <= 0 ||
    normalSalary <= 0
  ) {
    return false;
  }

  const largerSalary = Math.max(salary, normalSalary);
  const smallerSalary = Math.max(0.01, Math.min(salary, normalSalary));
  return largerSalary / smallerSalary <= 8 && Math.abs(salary - normalSalary) <= 50;
}

function HelpLabel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <span className="player-drawer-help-label" title={title}>
      {children}
      <span aria-hidden="true" className="player-drawer-help-dot">?</span>
    </span>
  );
}

function formatBoardTrustPolicy(
  policy: NonNullable<PlayerDetailDrawerData["boardTrust"]>["renewalPolicy"],
  salaryCapMultiplier: number | null | undefined,
) {
  if (policy === "do_not_renew") {
    return "Nicht verlaengern";
  }
  if (policy === "renewal_warning") {
    return "Verlaengerung riskant";
  }
  if (policy === "salary_cap") {
    const cap = salaryCapMultiplier != null ? ` · max ${formatValue(salaryCapMultiplier * 100, 0)}%` : "";
    return `Gehaltsdeckel${cap}`;
  }
  return "Normal";
}

function formatMoraleContractIntent(intent: NonNullable<PlayerDetailDrawerData["morale"]>["contractIntent"]) {
  switch (intent) {
    case "willing_to_extend":
      return "verlängerungsbereit";
    case "short_term_only":
      return "nur kurz binden";
    case "demands_raise":
      return "fordert Aufwertung";
    case "considering_exit":
      return "denkt an Wechsel";
    case "refuses_extension":
      return "blockt Verlängerung";
    default:
      return "neutral";
  }
}

function formatDemandStatus(status: PlayerDetailDrawerData["demands"][number]["status"]) {
  if (status === "fulfilled") return "erfüllt";
  if (status === "failed") return "verfehlt";
  if (status === "at_risk") return "gefährdet";
  return "offen";
}

function getDemandCardTone(status: PlayerDetailDrawerData["demands"][number]["status"]) {
  if (status === "fulfilled") return " is-happy";
  if (status === "failed") return " is-critical";
  if (status === "at_risk") return " is-worried";
  return " is-neutral";
}

function formatAvailabilityStatus(data: PlayerDetailDrawerData["availability"]) {
  if (data.isUnavailable) {
    return `Verletzt bis ${data.injuryUntilMatchday ?? "naechster Matchday"}`;
  }
  if (data.injuryStatus === "recovering") {
    return "Recovering";
  }
  if (data.injuryRiskPercent > 0) {
    return `${data.injuryRiskLabel} (${formatValue(data.injuryRiskPercent, 0)}%)`;
  }
  return data.injuryRiskLabel || "gesund";
}

function formatScoutPotentialRange(data: PlayerDetailDrawerData["scoutPotential"]) {
  if (!data?.potentialRange) return "—";
  return `${data.potentialRange.min}-${data.potentialRange.max}`;
}

function formatDevelopmentRange(data: PlayerDetailDrawerData["developmentInsight"]) {
  if (!data?.potentialRangeDisplay) return "—";
  return `${data.potentialRangeDisplay.min}-${data.potentialRangeDisplay.max}`;
}

function formatGrowthOutlook(value: NonNullable<PlayerDetailDrawerData["developmentInsight"]>["growthOutlook"] | null | undefined) {
  switch (value) {
    case "breakout":
      return "Breakout";
    case "growth":
      return "Wachstum";
    case "stable":
      return "stabil";
    case "stagnation":
      return "Stagnation";
    case "regression_risk":
      return "Rueckschritt-Risiko";
    default:
      return "—";
  }
}

function parseStarValue(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (!value) {
    return null;
  }
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function ScoutStarDisplay({
  axisDisplay,
  starRating,
  label,
  compact = false,
}: {
  axisDisplay?: string | null;
  starRating?: string | number | null;
  label?: string;
  compact?: boolean;
}) {
  if (axisDisplay) {
    return (
      <span className={`player-drawer-star-text${compact ? " is-compact" : ""}`}>
        {label ? `${label} ` : ""}
        {axisDisplay}
      </span>
    );
  }
  if (starRating) {
    return <StarRating value={starRating} label={label} compact={compact} />;
  }
  return null;
}

function StarRating({
  value,
  label,
  compact = false,
}: {
  value: string | number | null | undefined;
  label?: string;
  compact?: boolean;
}) {
  const rating = parseStarValue(value);
  if (rating == null) {
    return <span className="player-drawer-star-rating is-empty">—</span>;
  }

  return (
    <span
      className={`player-drawer-star-rating${compact ? " is-compact" : ""}`}
      aria-label={`${label ? `${label}: ` : ""}${formatValue(rating, 1)} von 5 Sternen`}
      title={`${label ? `${label}: ` : ""}${formatValue(rating, 1)} / 5`}
    >
      {label ? <span className="player-drawer-star-label">{label}</span> : null}
      <span className="player-drawer-stars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => {
          const fillPct = Math.max(0, Math.min(100, (rating - index) * 100));
          return (
            <span key={`star-${index}`} className="player-drawer-star">
              <span className="player-drawer-star-empty">★</span>
              <span className="player-drawer-star-fill" style={{ width: `${fillPct}%` }}>
                ★
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

function formatCompactSeasonLabel(value: string | null | undefined) {
  const canonical = getCanonicalSeasonLabel({ seasonName: value ?? null });
  const match = canonical.match(/Season\s+(\d+)/i);
  return match?.[1] ?? canonical;
}

type TopDisciplineColumnId = "discipline" | "value" | "seasonPps" | "lastSeasonPps" | "allTimePps" | "average";
type TopDisciplineSortDirection = "asc" | "desc";
type TopDisciplineRow = PlayerDetailDrawerData["disciplineValues"][number];

const TOP_DISCIPLINE_COLUMN_ORDER: TopDisciplineColumnId[] = [
  "discipline",
  "value",
  "seasonPps",
  "lastSeasonPps",
  "allTimePps",
  "average",
];

function getTopDisciplineColumnLabel(columnId: TopDisciplineColumnId, isScoutedProfile: boolean) {
  switch (columnId) {
    case "discipline":
      return "Diszi";
    case "value":
      return isScoutedProfile ? "Klasse" : "Wert";
    case "seasonPps":
      return "PPs";
    case "lastSeasonPps":
      return "PPs -1";
    case "allTimePps":
      return "PPs All Time";
    case "average":
      return "Ø";
    default:
      return columnId;
  }
}

function getTopDisciplineSortValue(row: TopDisciplineRow, columnId: TopDisciplineColumnId) {
  switch (columnId) {
    case "discipline":
      return row.label;
    case "value":
      return row.value;
    case "seasonPps":
      return row.seasonPoints;
    case "lastSeasonPps":
      return row.lastSeasonPoints;
    case "allTimePps":
      return row.allTimePoints;
    case "average":
      return row.allTimePoints != null && row.allTimeAppearances != null && row.allTimeAppearances > 0
        ? row.allTimePoints / row.allTimeAppearances
        : null;
    default:
      return null;
  }
}

function compareTopDisciplineRows(
  left: TopDisciplineRow,
  right: TopDisciplineRow,
  columnId: TopDisciplineColumnId,
  direction: TopDisciplineSortDirection,
) {
  const leftValue = getTopDisciplineSortValue(left, columnId);
  const rightValue = getTopDisciplineSortValue(right, columnId);
  const directionFactor = direction === "asc" ? 1 : -1;

  if (typeof leftValue === "string" || typeof rightValue === "string") {
    const leftText = String(leftValue ?? "");
    const rightText = String(rightValue ?? "");
    const textDelta = leftText.localeCompare(rightText, "de", { numeric: true, sensitivity: "base" });
    if (textDelta !== 0) {
      return textDelta * directionFactor;
    }
    return left.id.localeCompare(right.id, "de", { numeric: true }) * directionFactor;
  }

  const leftNumber = typeof leftValue === "number" && Number.isFinite(leftValue) ? leftValue : null;
  const rightNumber = typeof rightValue === "number" && Number.isFinite(rightValue) ? rightValue : null;
  if (leftNumber == null && rightNumber == null) {
    return left.label.localeCompare(right.label, "de", { numeric: true, sensitivity: "base" });
  }
  if (leftNumber == null) {
    return 1;
  }
  if (rightNumber == null) {
    return -1;
  }
  if (leftNumber !== rightNumber) {
    return (leftNumber - rightNumber) * directionFactor;
  }
  return left.label.localeCompare(right.label, "de", { numeric: true, sensitivity: "base" });
}

function moveTopDisciplineColumn(
  columns: TopDisciplineColumnId[],
  draggedColumnId: TopDisciplineColumnId,
  targetColumnId: TopDisciplineColumnId,
) {
  if (draggedColumnId === targetColumnId) {
    return columns;
  }
  const nextColumns = columns.filter((columnId) => columnId !== draggedColumnId);
  const targetIndex = nextColumns.indexOf(targetColumnId);
  if (targetIndex < 0) {
    return columns;
  }
  nextColumns.splice(targetIndex, 0, draggedColumnId);
  return nextColumns;
}

function renderTopDisciplineCell(
  row: TopDisciplineRow,
  columnId: TopDisciplineColumnId,
  isScoutedProfile: boolean,
): ReactNode {
  switch (columnId) {
    case "discipline": {
      const areaClass = getDisciplineAreaClass(row.category);
      return (
        <>
          <DisciplineIcon
            disciplineId={row.id}
            label={row.label}
            className={`discipline-icon-chip-inline player-drawer-discipline-area-chip ${areaClass}`}
          />
          {row.playerCount != null ? ` (${row.playerCount})` : ""}
        </>
      );
    }
    case "value":
      return isScoutedProfile ? (
        <span
          className={`player-drawer-chip ${getAttributeTierClass(row.scoutedTier ?? formatDisciplineTier(row.value))}`}
          title="Gescoutete Klasse, keine exakte Diszi-Zahl."
        >
          {row.scoutedTier ?? formatDisciplineTier(row.value)}
        </span>
      ) : (
        formatDisciplineValue(row.value, row.upgradeDelta)
      );
    case "seasonPps":
      return formatPointsWithRank(row.seasonPoints, row.seasonPointsRank ?? null);
    case "lastSeasonPps":
      return formatPointsWithAppearances(row.lastSeasonPoints, row.lastSeasonAppearances);
    case "allTimePps":
      return formatPointsWithAppearancesAndRank(
        row.allTimePoints,
        row.allTimeAppearances,
        row.allTimePointsRank ?? null,
      );
    case "average":
      return formatAveragePoints(row.allTimePoints, row.allTimeAppearances);
    default:
      return "—";
  }
}

export default function PlayerDetailDrawer({
  data,
  onClose,
  onOpenBuyPreview,
  layerClassName = "",
  variant = "drawer",
}: {
  data: PlayerDetailDrawerData | null;
  onClose: () => void;
  onOpenBuyPreview?: (player: {
    playerId: string;
    name: string;
    className: string | null;
    race: string | null;
  }) => void;
  layerClassName?: string;
  variant?: "drawer" | "page";
}) {
  const [selectedAxisId, setSelectedAxisId] = useState<string | null>(null);
  const [topDisciplineColumnOrder, setTopDisciplineColumnOrder] = useState<TopDisciplineColumnId[]>(TOP_DISCIPLINE_COLUMN_ORDER);
  const [topDisciplineSort, setTopDisciplineSort] = useState<{
    columnId: TopDisciplineColumnId;
    direction: TopDisciplineSortDirection;
  }>({ columnId: "value", direction: "desc" });
  const [draggedTopDisciplineColumnId, setDraggedTopDisciplineColumnId] = useState<TopDisciplineColumnId | null>(null);

  useEffect(() => {
    if (!data || variant === "page") {
      return undefined;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [data, onClose, variant]);

  useEffect(() => {
    setSelectedAxisId(null);
  }, [data?.playerId]);

  if (!data) {
    return null;
  }

  const seasonPerformance = data.seasonPerformance;
  const hasSeasonPerformance = seasonPerformance != null;
  const transferContext = data.transferContext;
  const isFreeAgent = data.transferStatus.toLowerCase().includes("free");
  const isScoutedProfile = data.attributeVisibility === "scouted";
  const scoutingLevel = data.scoutingLevel ?? 0;
  const showScoutedPotentialSummary = !isScoutedProfile || scoutingLevel >= 2;
  const showScoutedPotentialStars = !isScoutedProfile || scoutingLevel >= 4;
  const showScoutedDevelopmentSection = !isScoutedProfile || scoutingLevel >= 3;
  const showScoutedDeepDevelopmentDetails = !isScoutedProfile || scoutingLevel >= 5;
  const visibleScoutedAttributeChips = isScoutedProfile ? data.attributeStats.filter((entry) => entry.revealed).slice(0, 8) : [];
  const scoutedAttributeBuckets = isScoutedProfile
    ? {
        visible: data.attributeStats.filter((entry) => entry.revealed),
        hidden: data.attributeStats.filter((entry) => !entry.revealed),
      }
    : null;
  const axisOrbitStats = !isScoutedProfile
    ? {
        pow: data.axisCards.find((card) => card.id === "pow")?.value ?? 0,
        spe: data.axisCards.find((card) => card.id === "spe")?.value ?? 0,
        men: data.axisCards.find((card) => card.id === "men")?.value ?? 0,
        soc: data.axisCards.find((card) => card.id === "soc")?.value ?? 0,
      }
    : null;
  const noSeasonPerformanceMessage = isFreeAgent
    ? "Keine gespeicherte Season-Performance."
    : "Aktiver Spieler, aber noch kein gespeicherter Season-Einsatz.";
  const visibleTopDisciplineColumnIds = topDisciplineColumnOrder.filter(
    (columnId) => !isScoutedProfile || columnId === "discipline" || columnId === "value",
  );
  const topDisciplineCards = [...data.disciplineValues.slice(0, isScoutedProfile ? 5 : data.disciplineValues.length)].sort((left, right) =>
    compareTopDisciplineRows(left, right, topDisciplineSort.columnId, topDisciplineSort.direction),
  );
  const handleTopDisciplineSort = (columnId: TopDisciplineColumnId) => {
    setTopDisciplineSort((current) => ({
      columnId,
      direction: current.columnId === columnId && current.direction === "desc" ? "asc" : "desc",
    }));
  };
  const handleTopDisciplineColumnDragStart = (
    columnId: TopDisciplineColumnId,
    event: DragEvent<HTMLTableCellElement>,
  ) => {
    setDraggedTopDisciplineColumnId(columnId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", columnId);
  };
  const handleTopDisciplineColumnDrop = (
    targetColumnId: TopDisciplineColumnId,
    event: DragEvent<HTMLTableCellElement>,
  ) => {
    event.preventDefault();
    const sourceColumnId = (event.dataTransfer.getData("text/plain") || draggedTopDisciplineColumnId) as TopDisciplineColumnId | null;
    if (!sourceColumnId || !TOP_DISCIPLINE_COLUMN_ORDER.includes(sourceColumnId)) {
      setDraggedTopDisciplineColumnId(null);
      return;
    }
    setTopDisciplineColumnOrder((columns) => moveTopDisciplineColumn(columns, sourceColumnId, targetColumnId));
    setDraggedTopDisciplineColumnId(null);
  };
  const selectedAxisCard = !isScoutedProfile ? data.axisCards.find((card) => card.id === selectedAxisId) ?? null : null;
  const selectedAxisRows = selectedAxisCard && !isScoutedProfile
    ? data.disciplineValues.filter((entry) => entry.category === selectedAxisCard.tone).slice(0, 5)
    : [];
  const baselineAttributeDeltas = data.baselineAttributeDeltas.filter((entry) => entry.delta != null && entry.delta !== 0);
  const developmentLevelup = data.developmentLevelup;
  const marketValueBenchmark = transferContext.currentValue ?? transferContext.purchasePrice ?? null;
  const marketValueDelta =
    marketValueBenchmark != null && data.marketValue != null && Math.abs(data.marketValue - marketValueBenchmark) >= 0.01
      ? data.marketValue - marketValueBenchmark
      : null;
  const salaryDelta =
    isPlausibleSalaryDeltaReference(data.salary, data.normalSalary) && Math.abs(data.salary! - data.normalSalary!) >= 0.01
      ? data.salary! - data.normalSalary!
      : null;
  const developmentPreviewByAttribute = new Map<string, NonNullable<PlayerDetailDrawerData["developmentLevelup"]>["upgradePreview"][number]>(
    (developmentLevelup?.upgradePreview ?? []).map((entry) => [entry.attribute, entry] as const),
  );
  const attributeCeilingByKey = new Map(data.attributeCeilingPreview.map((entry) => [entry.attribute, entry] as const));
  const showOwnPotentialSnapshot = !isScoutedProfile && data.potentialOverallStars != null;
  const aiDevelopmentPlanByAttribute = new Map<string, { steps: number; cost: number; reasons: string[] }>();
  if (data.teamHumanControlled === false) {
    for (const row of developmentLevelup?.aiAllocation.spendPlan ?? []) {
      const existing = aiDevelopmentPlanByAttribute.get(row.attribute) ?? { steps: 0, cost: 0, reasons: [] };
      aiDevelopmentPlanByAttribute.set(row.attribute, {
        steps: existing.steps + 1,
        cost: existing.cost + row.cost,
        reasons: [...new Set([...existing.reasons, row.reason])],
      });
    }
  }
  const headlineMetrics = [
    {
      key: "ovr",
      label: "OVR",
      value: data.ovr,
      rank: data.ovrRank,
      delta: data.ovrDelta,
      deltaSourceLabel: data.ovrDeltaSourceLabel,
      sourceLabel: data.ovrSourceLabel,
      digits: 1,
    },
    {
      key: "pps",
      label: "PPs",
      value: data.pps,
      rank: data.ppsRank,
      delta: data.ppsDelta,
      deltaSourceLabel: data.ppsDeltaSourceLabel,
      sourceLabel: data.ppsSourceLabel,
      digits: 1,
    },
    {
      key: "mvs",
      label: "MVS",
      value: data.mvs,
      rank: data.mvsRank,
      delta: data.mvsDelta,
      deltaSourceLabel: data.mvsDeltaSourceLabel,
      sourceLabel: data.mvsSourceLabel,
      digits: 1,
    },
  ] as const;

  const profileContent = (
    <>
          <div className="player-drawer-header">
          <div className="player-drawer-hero">
            {data.portraitUrl ? (
              <OptimizedMediaImage
                className="player-drawer-portrait player-drawer-portrait-large"
                src={data.portraitUrl}
                alt={data.name}
                width={160}
                height={160}
                loading="eager"
                fetchPriority="high"
              />
            ) : (
              <div className="player-drawer-portrait player-drawer-portrait-large player-drawer-portrait-placeholder">{buildInitials(data.name)}</div>
            )}
            <div className="player-drawer-headline player-drawer-headline-rich">
              <div className="player-drawer-meta-line">
                <span className={`transfer-status-pill${getTransferStatusTone(data.transferStatus)}`}>{data.transferStatus}</span>
                <span className="player-drawer-source-chip">{isFreeAgent ? "Marktprofil" : "Spielerprofil"}</span>
              </div>
              <h2>{data.name}</h2>
              <p className="player-drawer-subline">
                {data.teamName ?? "Kein aktives Team"}
                {data.teamCode ? ` · ${data.teamCode}` : ""}
              </p>
              <div className="player-drawer-identity-row">
                <ClassIcon classNameValue={data.className} className="player-drawer-class-chip" iconClassName="player-drawer-class-icon" />
                <RaceIcon race={data.race} className="player-drawer-race-chip" iconClassName="player-drawer-race-icon" />
              </div>
              <div className="player-drawer-chip-row">
                {data.subclasses.map((subclass) => (
                  <span key={`header-subclass-${subclass}`} className="player-drawer-chip is-subclass">
                    {subclass}
                  </span>
                ))}
                {data.traitsPositive.slice(0, 4).map((trait) => (
                  <span key={`positive-${trait}`} className="player-drawer-chip is-positive">
                    + {trait}
                  </span>
                ))}
                {data.traitsNegative.slice(0, 4).map((trait) => (
                  <span key={`negative-${trait}`} className="player-drawer-chip is-negative">
                    − {trait}
                  </span>
                ))}
                {data.hiddenPositiveTraitCount > 0 ? (
                  <span className="player-drawer-chip is-muted" title="Scouting Office upgraden, um weitere positive Traits zu sehen.">
                    +{data.hiddenPositiveTraitCount} verdeckt
                  </span>
                ) : null}
                {data.hiddenNegativeTraitCount > 0 ? (
                  <span className="player-drawer-chip is-muted" title="Negative Traits werden ab Scouting-Stufe 4 sichtbar.">
                    Negativ-Trait verdeckt
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button className="secondary-button inline-button" type="button" onClick={onClose}>
            Schliessen
          </button>
        </div>

        <div className="player-drawer-body">
          <section className="player-drawer-section player-drawer-hero-surface" id="player-drawer-profile">
            <div className="player-drawer-top-grid">
              <div className="player-drawer-profile-stack">
                <div className="player-drawer-profile-card">
                  <span className="player-drawer-overline">Scouting-Profil</span>
                  <h3>{data.teamName ?? "Free Agent"}</h3>
                  <p className="player-drawer-subline">
                    Rolle {formatRoleTag(transferContext.roleTag)}
                    {transferContext.promisedRole ? ` · Versprochen ${formatRoleTag(transferContext.promisedRole)}` : ""}
                  </p>
                  <div className="player-drawer-chip-row">
                    {data.traitsPositive.slice(0, 4).map((trait) => (
                      <span key={`positive-${trait}`} className="player-drawer-chip is-positive">
                        + {trait}
                      </span>
                    ))}
                    {data.traitsNegative.slice(0, 4).map((trait) => (
                      <span key={`negative-${trait}`} className="player-drawer-chip is-negative">
                        − {trait}
                      </span>
                    ))}
                    {data.hiddenPositiveTraitCount > 0 ? (
                      <span className="player-drawer-chip is-muted" title="Scouting Office upgraden, um weitere positive Traits zu sehen.">
                        +{data.hiddenPositiveTraitCount} verdeckt
                      </span>
                    ) : null}
                    {data.hiddenNegativeTraitCount > 0 ? (
                      <span className="player-drawer-chip is-muted" title="Negative Traits werden ab Scouting-Stufe 4 sichtbar.">
                        Negativ-Trait verdeckt
                      </span>
                    ) : null}
                  </div>
                  <div className="player-drawer-mini-facts">
                    {!isFreeAgent ? <span title={getGameTermTooltip("PPs") ?? undefined}>PPs Rating {formatValue(data.ppsRating, 1)}</span> : null}
                    {showScoutedPotentialSummary && data.developmentInsight ? (
                      <span>Scout-Wert {formatDevelopmentRange(data.developmentInsight)}</span>
                    ) : null}
                    <span>Scouting L{data.scoutingLevel ?? 0}</span>
                    {showScoutedPotentialStars ? (
                      <ScoutStarDisplay
                        axisDisplay={data.potentialStarsDisplay}
                        starRating={data.scoutPotential?.starRating}
                        compact
                      />
                    ) : null}
                    <span title={getGameTermTooltip("Erschoepfung") ?? undefined}>Erschoepfung {formatValue(data.fatigue, 0)}</span>
                    <span>Form {formatValue(data.form, 0)}</span>
                  </div>
                </div>
              </div>
              {!isFreeAgent ? (
                <div className="player-drawer-kpi-hero-grid">
                  {headlineMetrics.map((metric) => (
                    <article key={metric.key} className="player-drawer-kpi-hero-card">
                      <div className="player-drawer-kpi-header">
                        <GameTerm term={metric.label} />
                        <span className="player-drawer-kpi-rank">{formatRankLabel(metric.rank)}</span>
                      </div>
                      <strong className="player-drawer-kpi-value">{formatValue(metric.value, metric.digits)}</strong>
                      <div className="player-drawer-kpi-footer">
                        {metric.delta != null ? (
                          <span className={`player-drawer-delta${getDeltaToneClass(metric.delta)}`}>
                            {metric.delta > 0 ? "+" : ""}
                            {formatValue(metric.delta, 1)}
                          </span>
                        ) : (
                          <span className="player-drawer-kpi-missing">Kein Verlauf</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="player-drawer-transfer-note" title="Free Agents haben noch keine gespeicherte Saisonleistung in diesem Save. OVR, PPs und MVS werden deshalb im Transfermarkt bewusst nicht angezeigt.">
                  <strong>Transfermarkt-Profil</strong>
                  <span>Keine OVR-, PPs- oder MVS-Anzeige vor dem Kauf.</span>
                </div>
              )}
            </div>
            {isScoutedProfile && visibleScoutedAttributeChips.length ? (
              <div className="player-drawer-chip-row player-drawer-scout-attribute-row">
                {visibleScoutedAttributeChips.map((entry) => (
                  <span
                    key={`scouted-attribute-${entry.key}`}
                    className={`player-drawer-chip ${getAttributeTierClass(entry.ratingLabel ?? entry.rangeLabel ?? null)}`}
                    title={
                      entry.value != null
                        ? `${entry.label}: ${formatValue(entry.value, 0)}`
                        : entry.ratingLabel
                          ? `${entry.label}: Klasse ${entry.ratingLabel}`
                          : entry.rangeLabel
                            ? `${entry.label}: Bereich ${entry.rangeLabel}`
                            : `${entry.label}: noch verdeckt`
                    }
                  >
                    {entry.label.toUpperCase()} {entry.value != null ? formatValue(entry.value, 0) : entry.ratingLabel ?? entry.rangeLabel ?? "?"}
                  </span>
                ))}
              </div>
            ) : null}
            {axisOrbitStats ? (
              <VeloStatOrbitRow
                ariaLabel={`${data.name} Kernachsen`}
                className="player-drawer-axis-orbit"
                stats={axisOrbitStats}
              />
            ) : null}
            {!isScoutedProfile ? (
              <div className="player-drawer-axis-strip" aria-label="Kernwerte mit Liga-Rang">
                {data.axisCards.map((card) => (
                  <article key={`hero-axis-${card.id}`} className={`player-drawer-axis-chip ${getAxisToneClass(card.tone)}`}>
                    <header>
                      <span>{card.label}</span>
                    </header>
                    <div className="player-drawer-axis-chip-split">
                      <span>
                        <small>Stat</small>
                        <strong>{formatValue(card.value, 0)}</strong>
                        <em>{formatRankLabel(card.valueRank)}</em>
                      </span>
                      <span>
                        <small>PPs</small>
                        <strong>{formatValue(card.seasonPoints, 1)}</strong>
                        <em>{formatRankLabel(card.seasonPointsRank)}</em>
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="player-drawer-list-grid player-drawer-list-grid-wide">
              <article className="metric-card player-drawer-compact-money-card">
                <span>Marktwert</span>
                <div className="player-drawer-inline-value">
                  <strong>{formatMoney(data.marketValue)}</strong>
                  {marketValueDelta != null ? (
                    <small className={`player-drawer-money-delta${getMoneyDeltaToneClass(marketValueDelta, "higher")}`}>
                      {formatSignedMoney(marketValueDelta)}
                    </small>
                  ) : null}
                </div>
              </article>
              <article className="metric-card player-drawer-compact-money-card">
                <span>Aktuelles Gehalt</span>
                <div className="player-drawer-inline-value">
                  <strong>{formatMoney(data.salary)}</strong>
                  {salaryDelta != null ? (
                    <small className={`player-drawer-money-delta${getMoneyDeltaToneClass(salaryDelta, "lower")}`}>
                      {formatSignedMoney(salaryDelta)}
                    </small>
                  ) : null}
                </div>
              </article>
              <article className="metric-card">
                <span>Vertrag / LZ</span>
                <strong>{data.contractLength ?? "—"}</strong>
                {transferContext.promisedRole ? <small>Versprechen: {formatRoleTag(transferContext.promisedRole)}</small> : null}
              </article>
              <article className={`metric-card ${data.availability.isUnavailable ? "is-negative" : data.availability.injuryRiskBand === "sehr_stark" || data.availability.injuryRiskBand === "stark" ? "is-negative" : data.availability.injuryRiskPercent > 0 ? "is-warning" : ""}`}>
                <span>Verfügbarkeit</span>
                <strong>{formatAvailabilityStatus(data.availability)}</strong>
                <small>
                  Fatigue {formatValue(data.fatigue, 0)} · Recovery {formatValue(data.availability.normalRecovery, 1)}
                  {data.availability.injuryRecovery != null ? ` / verletzt ${formatValue(data.availability.injuryRecovery, 1)}` : ""}
                </small>
                {data.availability.lastRoll ? (
                  <small>
                    Letzter Roll {formatValue(data.availability.lastRoll.roll, 2)} / Risiko {formatValue(data.availability.lastRoll.riskPercent, 0)}% · {data.availability.lastRoll.result === "injured" ? "verletzt" : "gesund"}
                  </small>
                ) : null}
              </article>
               {data.boardTrust ? (
                 <article className={`metric-card player-drawer-board-trust-card is-${data.boardTrust.mood}`}>
                   <span>Board Trust</span>
                   <strong>
                     {data.boardTrust.smiley} {formatValue(data.boardTrust.trustScore, 0)}
                   </strong>
                   <small>{formatBoardTrustPolicy(data.boardTrust.renewalPolicy, data.boardTrust.salaryCapMultiplier)}</small>
                   {data.boardTrust.reasons.length ? (
                     <div className="player-drawer-board-trust-reasons">
                       {data.boardTrust.reasons.slice(0, 3).map((reason) => (
                         <span key={`board-trust-${reason}`}>{reason}</span>
                       ))}
                     </div>
                   ) : null}
                 </article>
               ) : null}
              {data.morale ? (
                <article className={`metric-card player-drawer-morale-card is-${data.morale.visibleMood}`}>
                  <span>Moral</span>
                  <strong>
                    {data.morale.smiley} {formatValue(data.morale.morale, 0)}
                  </strong>
                  <small>
                    {data.morale.moodLabel} · {formatMoraleContractIntent(data.morale.contractIntent)}
                  </small>
                  <small>
                    Gehalt x{formatValue(data.morale.salaryModifier, 2)}
                    {data.morale.contractLengthLimit != null ? ` · max ${data.morale.contractLengthLimit}J` : ""}
                    {` · Risiko ${formatValue(data.morale.renewalRisk, 0)}%`}
                  </small>
                  {data.morale.reasons.length ? (
                    <div className="player-drawer-board-trust-reasons">
                      {data.morale.reasons.slice(0, 3).map((reason) => (
                        <span key={`morale-${reason.reasonId}`}>
                          {reason.valueDelta > 0 ? "+" : ""}
                          {formatValue(reason.valueDelta, 0)} {reason.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ) : null}
              <article className="metric-card">
                <span>Einsätze</span>
                <strong>{hasSeasonPerformance ? seasonPerformance.appearances : "—"}</strong>
              </article>
              <article className="metric-card">
                <span>Saisonpunkte</span>
                <strong>{formatValue(seasonPerformance?.totalPoints, 1)}</strong>
              </article>
              <article className="metric-card">
                <span>Avg Beitrag</span>
                <strong>{formatValue(seasonPerformance?.averageContribution, 1)}</strong>
              </article>
            </div>
          </section>

          <nav className="player-drawer-tabs" aria-label="Spieler Detailbereich">
            <a href="#player-drawer-profile">Profil</a>
            {!isScoutedProfile ? <a href="#player-drawer-axis">Achsen</a> : null}
            <a href="#player-drawer-disciplines">Diszis</a>
            {developmentLevelup || (showScoutedDevelopmentSection && (data.scoutPotential || data.progressionForecast)) ? (
              <a href="#player-drawer-development">Entwicklung</a>
            ) : null}
            {isFreeAgent && onOpenBuyPreview ? <a href="#player-drawer-market">Transfer</a> : null}
            <a href="#player-drawer-history">Historie</a>
          </nav>

          {!isScoutedProfile ? (
          <section className="player-drawer-section" id="player-drawer-axis">
            <h3>
              <GameTerm term="POW" /> / <GameTerm term="SPE" /> / <GameTerm term="MEN" /> / <GameTerm term="SOC" />
            </h3>
            {!isScoutedProfile ? (
              <p className="muted">
                Quelle: {seasonPerformance?.sourceLabel ?? "keine gespeicherten Season-PPs"}
                {seasonPerformance?.seasonName ? ` · ${seasonPerformance.seasonName}` : ""}
              </p>
            ) : null}
            <div className="player-drawer-category-grid">
              {data.axisCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`player-drawer-category-card player-drawer-category-button player-drawer-axis-combo-card ${getAxisToneClass(card.tone)}${selectedAxisId === card.id ? " is-selected" : ""}`}
                  onClick={() => {
                    if (!isScoutedProfile) setSelectedAxisId(card.id);
                  }}
                  disabled={isScoutedProfile}
                  title={`${card.label}: Statwert und echte Season-PPs jeweils mit Rank`}
                >
                  <div className="player-drawer-category-head">
                    <span title={getGameTermTooltip(card.label) ?? undefined}>{card.label}</span>
                    <span title={getGameTermTooltip("PPs") ?? undefined}>Stat / PPs</span>
                  </div>
                  <div className="player-drawer-axis-combo-values">
                    <span>
                      <small>Stat</small>
                      <strong>{formatValue(card.value, 0)}</strong>
                      <em>{formatRankLabel(card.valueRank)}</em>
                    </span>
                    <span>
                      <small>PPs</small>
                      <strong>{formatValue(card.seasonPoints, 1)}</strong>
                      <em>{formatRankLabel(card.seasonPointsRank)}</em>
                    </span>
                  </div>
                  <div className="player-drawer-category-meter">
                    <div
                      className="player-drawer-category-meter-fill"
                      style={{ width: `${Math.max(0, Math.min(100, card.value ?? 0))}%` }}
                    />
                  </div>
                  <div className="player-drawer-category-meta">
                    <span>Vorsaison PPs</span>
                    <span title="Achsen-Rank aus dem letzten Saison-Snapshot">-1 {formatOptionalRankLabel(card.previousSeasonPointsRank)}</span>
                  </div>
                </button>
              ))}
            </div>
            {!isScoutedProfile ? (
              <>
                {selectedAxisCard ? (
                  <div className={`player-drawer-axis-detail-panel ${getAxisToneClass(selectedAxisCard.tone)}`}>
                    <div className="player-drawer-axis-detail-header">
                      <div>
                        <h4>{selectedAxisCard.label} Detail</h4>
                        <p>Top 5 Diszis dieser Achse mit Spielerwert, Einsatzslot, PPs und Mutator-Anteil.</p>
                      </div>
                      <button type="button" className="ghost-button" onClick={() => setSelectedAxisId(null)}>
                        Schliessen
                      </button>
                    </div>
                    <div className="table-shell player-drawer-axis-detail-table-shell">
                      <table className="team-table player-drawer-axis-detail-table">
                        <thead>
                          <tr>
                            <th>Diszi</th>
                            <th>Stat</th>
                            <th>Slot</th>
                            <th>PPs</th>
                            <th>Mutator</th>
                            <th>PPs All Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAxisRows.map((entry) => {
                            const areaClass = getDisciplineAreaClass(entry.category);
                            return (
                              <tr key={`axis-detail-${selectedAxisCard.id}-${entry.id}`}>
                                <td className={`player-drawer-discipline-name-cell ${areaClass}`}>
                                  <DisciplineIcon
                                    disciplineId={entry.id}
                                    label={entry.label}
                                    className={`discipline-icon-chip-inline player-drawer-discipline-area-chip ${areaClass}`}
                                  />
                                </td>
                                <td>{formatValue(entry.value, 0)}</td>
                                <td>{entry.slotLabels.length ? entry.slotLabels.slice(0, 2).join(", ") : "—"}</td>
                                <td>{formatPointsWithRank(entry.seasonPoints, entry.seasonPointsRank ?? null)}</td>
                                <td>{entry.currentSeasonMutatorPps != null ? `+${formatValue(entry.currentSeasonMutatorPps, 1)}` : "—"}</td>
                                <td>{formatPointsWithAppearancesAndRank(
                                  entry.allTimePoints,
                                  entry.allTimeAppearances,
                                  entry.allTimePointsRank ?? null,
                                )}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </section>
          ) : null}

          <section className="player-drawer-section player-drawer-panel player-drawer-top-disciplines-panel" id="player-drawer-disciplines">
              <h3 title={isScoutedProfile ? "Scouting zeigt nur grobe Klassen der besten Disziplinen. Exakte Diszi-Werte werden nicht gespoilert." : "Beste Disziplinen aus dem aktuellen Spielerprofil."}>Top-Disziplinen</h3>
              {!seasonPerformance && !isScoutedProfile ? <p className="muted">{noSeasonPerformanceMessage}</p> : null}
              <div className="table-shell player-drawer-breakdown-table-shell">
                <table className="team-table player-drawer-breakdown-table">
                  <thead>
                    <tr>
                      {visibleTopDisciplineColumnIds.map((columnId) => {
                        const isActiveSort = topDisciplineSort.columnId === columnId;
                        const sortArrow = !isActiveSort ? "↕" : topDisciplineSort.direction === "asc" ? "↑" : "↓";
                        return (
                          <th
                            key={`top-discipline-header-${columnId}`}
                            className={`player-drawer-draggable-header${draggedTopDisciplineColumnId === columnId ? " is-dragging" : ""}`}
                            draggable
                            onDragStart={(event) => handleTopDisciplineColumnDragStart(columnId, event)}
                            onDragOver={(event) => {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                            }}
                            onDragEnd={() => setDraggedTopDisciplineColumnId(null)}
                            onDrop={(event) => handleTopDisciplineColumnDrop(columnId, event)}
                            title="Klicken zum Sortieren, ziehen zum Verschieben."
                          >
                            <button
                              className={`sortable-header player-drawer-column-header${isActiveSort ? " is-active" : ""}`}
                              type="button"
                              onClick={() => handleTopDisciplineSort(columnId)}
                            >
                              <span>{getTopDisciplineColumnLabel(columnId, isScoutedProfile)}</span>
                              <span className="sortable-arrow">{sortArrow}</span>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {topDisciplineCards.map((entry) => {
                      const areaClass = getDisciplineAreaClass(entry.category);
                      return (
                      <tr key={`discipline-breakdown-${entry.id}`} className={`${isScoutedProfile ? "" : getDisciplineValueHeatClass(entry.value)} player-drawer-discipline-area-row ${areaClass}`}>
                        {visibleTopDisciplineColumnIds.map((columnId) => (
                          <td
                            key={`discipline-breakdown-${entry.id}-${columnId}`}
                            className={columnId === "discipline" ? `player-drawer-discipline-name-cell ${areaClass}` : undefined}
                          >
                            {renderTopDisciplineCell(entry, columnId, isScoutedProfile)}
                          </td>
                        ))}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

          <section className="player-drawer-section player-drawer-panel">
            <h3>Attribute</h3>
            {scoutedAttributeBuckets ? (
              <div className="player-drawer-scouting-disclosure velo-scouting-disclosure" aria-label="Scouting Transparenz">
                <span className={`velo-scouting-segment is-visible${scoutedAttributeBuckets.visible.length > 0 ? " has-data" : ""}`}>
                  Sichtbar {scoutedAttributeBuckets.visible.length}
                </span>
                <span className={`velo-scouting-segment is-hidden${scoutedAttributeBuckets.hidden.length > 0 ? " has-data" : ""}`}>
                  Versteckt {scoutedAttributeBuckets.hidden.length}
                </span>
                <span className="velo-scouting-segment is-rumor">
                  Unlock bis L5
                </span>
              </div>
            ) : null}
            <div className="player-drawer-attribute-grid">
              {data.attributeStats.map((entry) => {
                const preview = data.attributeVisibility === "exact" ? developmentPreviewByAttribute.get(entry.key) : null;
                const ceilingPreview = data.attributeVisibility === "exact" ? attributeCeilingByKey.get(entry.key as never) : null;
                const aiPlan = data.attributeVisibility === "exact" ? aiDevelopmentPlanByAttribute.get(entry.key) : null;
                const showExactAttribute = entry.value != null;
                const showRangeAttribute = data.attributeVisibility === "scouted" && entry.revealed && entry.rangeLabel;
                const attributePrimaryLabel = showExactAttribute
                  ? formatValue(entry.value, 0)
                  : entry.ratingLabel ?? entry.rangeLabel ?? "?";
                const plannedAttributeDelta = data.teamHumanControlled === false ? (aiPlan?.steps ?? 0) : (preview?.attributeDelta ?? 0);
                const plannedNextValue =
                  entry.value != null && plannedAttributeDelta > 0 ? Math.min(99, entry.value + plannedAttributeDelta) : entry.value;
                const visibleDisciplineDeltas =
                  preview?.topDisciplineDeltas && plannedAttributeDelta > 0
                    ? preview.topDisciplineDeltas.map((delta) => ({
                        ...delta,
                        delta: delta.delta * plannedAttributeDelta,
                      }))
                    : data.teamHumanControlled === false
                      ? []
                      : preview?.topDisciplineDeltas ?? [];
                const showCostChip = data.teamHumanControlled === false ? Boolean(aiPlan) : Boolean(preview);
                return (
                  <article
                    key={entry.key}
                    className={`metric-card player-drawer-attribute-card is-affinity-${preview?.affinity ?? "neutral"} ${getAttributeTierClass(entry.ratingLabel)}${!entry.revealed && isScoutedProfile ? " is-scouting-locked" : ""}`}
                    title={
                      showExactAttribute
                        ? data.attributeVisibility === "exact"
                          ? "Eigener Spieler: exakter Attributwert und Rating-Band."
                          : "Scouting maximiert: exakter Attributwert sichtbar."
                        : entry.revealed
                          ? entry.ratingLabel
                            ? "Scouting stark genug: exaktes Attribut-Band sichtbar, Zahlen weiter verborgen."
                            : "Scouting zeigt hier erst eine grobe Range."
                          : `Noch verdeckt. Sichtbar ab Scouting-Level ${entry.revealLevel}.`
                    }
                  >
                    <span className="player-drawer-attribute-title">
                      {entry.label}
                      {preview?.affinity && preview.affinity !== "neutral" ? (
                        <span
                          className={`player-drawer-affinity-badge is-${preview.affinity}`}
                          title={preview.reason}
                          aria-label={`${entry.label} ${getAffinityLabel(preview.affinity)}: ${preview.reason}`}
                        >
                          {getAffinityIcon(preview.affinity)}
                        </span>
                      ) : null}
                    </span>
                    <strong className={getDeltaToneClass(plannedAttributeDelta)}>
                      {attributePrimaryLabel}
                      {showExactAttribute && plannedAttributeDelta ? ` → ${formatValue(plannedNextValue, 0)}` : ""}
                    </strong>
                    <div className="player-drawer-chip-row">
                      {showExactAttribute ? (
                        <span className={`player-drawer-chip ${getAttributeTierClass(entry.ratingLabel)}`}>
                          {entry.ratingLabel ?? "—"}
                        </span>
                      ) : showRangeAttribute ? (
                        <span className="player-drawer-chip">
                          Range {entry.rangeLabel}
                        </span>
                      ) : !entry.revealed ? (
                        <span className="player-drawer-chip velo-scouting-segment is-hidden has-data">
                          🔒 ab L{entry.revealLevel}
                        </span>
                      ) : null}
                      {showCostChip && preview ? (
                        <span
                          className={`player-drawer-chip is-affinity-${preview.affinity}`}
                          title={data.teamHumanControlled === false && aiPlan ? aiPlan.reasons.join(" · ") : preview.reason}
                          aria-label={`${entry.label} ${getAffinityLabel(preview.affinity)}: ${
                            data.teamHumanControlled === false && aiPlan ? `${aiPlan.cost} TP Auto` : getAffinityChipText(preview.finalCost)
                          }. ${data.teamHumanControlled === false && aiPlan ? aiPlan.reasons.join(" · ") : preview.reason}`}
                        >
                          {data.teamHumanControlled === false && aiPlan ? `${aiPlan.cost} TP Auto` : getAffinityChipText(preview.finalCost)}
                        </span>
                      ) : null}
                      {ceilingPreview && ceilingPreview.state !== "open" ? (
                        <span
                          className={`player-drawer-chip${getCeilingStateChipClass(ceilingPreview.state)}`}
                          title={`Trainingswachstum ×${formatValue(ceilingPreview.growthMultiplier, 2)}`}
                        >
                          {ceilingPreview.headroomLabel}
                        </span>
                      ) : null}
                      {preview?.ceilingState === "capped" && preview.blocked ? (
                        <span className="player-drawer-chip is-negative" title={preview.reason}>
                          Limit
                        </span>
                      ) : null}
                    </div>
                    {visibleDisciplineDeltas.length ? (
                      <small className="player-drawer-delta-line is-positive">
                        {visibleDisciplineDeltas
                          .slice(0, 2)
                          .map((delta) => `${delta.label} +${formatValue(delta.delta, 2)}`)
                          .join(" · ")}
                      </small>
                    ) : null}
                  </article>
                );
              })}
            </div>
            {baselineAttributeDeltas.length > 0 ? (
              <div className="player-drawer-baseline-delta">
                <h4>Baseline-Delta</h4>
                <div className="player-drawer-chip-row">
                  {baselineAttributeDeltas.slice(0, 8).map((entry) => (
                    <span key={`baseline-delta-${entry.key}`} className={`player-drawer-chip${getDeltaToneClass(entry.delta)}`}>
                      {entry.label} {formatValue(entry.baselineValue, 0)} → {formatValue(entry.currentValue, 0)} (
                      {entry.delta != null && entry.delta > 0 ? "+" : ""}
                      {formatValue(entry.delta, 0)})
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {developmentLevelup ? (
            <section className="player-drawer-section player-drawer-panel" id="player-drawer-development">
              <h3>Entwicklung</h3>
              <div className="player-drawer-development-hero">
                <article className="metric-card player-drawer-development-card">
                  <span>Level & TP</span>
                  <strong>
                    Lv {developmentLevelup.level.developmentLevel} · {developmentLevelup.level.trainingPointsAvailable} TP
                  </strong>
                  <div className="player-drawer-progress-track" aria-label={`Fortschritt ${formatValue(developmentLevelup.level.progressPct, 1)} Prozent`}>
                    <span style={{ width: `${Math.max(0, Math.min(100, developmentLevelup.level.progressPct))}%` }} />
                  </div>
                  <small>
                    {formatValue(developmentLevelup.level.progressXp, 0)} / {formatValue(developmentLevelup.level.xpForCurrentLevel, 0)} XP ·{" "}
                    {formatValue(developmentLevelup.level.xpToNextLevel, 0)} bis Level-Up
                  </small>
                </article>
                <article className="metric-card player-drawer-development-card">
                  <span>Trend / Regression</span>
                  <strong className={getDevelopmentLevelTrendClass(developmentLevelup.level.lastTrend)}>
                    {formatDevelopmentLevelTrend(developmentLevelup.level.lastTrend)}
                  </strong>
                  <small>
                    {formatRegressionRisk(developmentLevelup.level.regressionRisk)} ·{" "}
                    {developmentLevelup.regressionEvent.delta < 0 && developmentLevelup.regressionEvent.attribute
                      ? `${developmentLevelup.regressionEvent.attribute} -1 moeglich`
                      : developmentLevelup.regressionEvent.reason}
                  </small>
                </article>
              </div>
              <div className="player-drawer-chip-row player-drawer-affinity-row">
                {developmentLevelup.affinity.signatureAttributes.map((attribute) => (
                  <span key={`signature-${attribute}`} className="player-drawer-chip is-affinity-signature" title="Signature: Dieses Attribut entwickelt sich bei diesem Spieler guenstiger.">
                    ★ {attribute}
                  </span>
                ))}
                <span className="player-drawer-chip is-affinity-weak" title="Weak Development: Dieses Attribut ist fuer diesen Spieler schwerer zu steigern.">
                  {developmentLevelup.affinity.weakAttribute}
                </span>
              </div>
              <p className="muted">
                Vertragsgehalt bleibt stabil. MW und erwartetes Gehalt sind nur Vorschauwerte bei Attribut-Upgrades.
              </p>
            </section>
          ) : null}

          {data.organicProgression || data.classHistory.length > 0 ? (
            <section className="player-drawer-section player-drawer-panel">
              <h3>Organische Entwicklung</h3>
              {data.organicProgression ? (
                <>
                  <div className="player-drawer-list-grid player-drawer-list-grid-wide">
                    <article className="metric-card">
                      <span>Klasse</span>
                      <strong>
                        {data.organicProgression.classBefore} → {data.organicProgression.classAfter}
                      </strong>
                      <small>Training: {data.organicProgression.trainingClass}</small>
                    </article>
                    <article className="metric-card">
                      <span>Netto-Setpoints</span>
                      <strong className={getDeltaToneClass(data.organicProgression.netSetpoints)}>
                        {data.organicProgression.netSetpoints > 0 ? "+" : ""}
                        {formatValue(data.organicProgression.netSetpoints, 1)}
                      </strong>
                      <small>
                        Training +{formatValue(data.organicProgression.trainingSetpoints, 1)} · Performance +
                        {formatValue(data.organicProgression.performanceSetpoints, 1)}
                      </small>
                    </article>
                    <article className="metric-card">
                      <span>Erhaltungsdruck</span>
                      <strong>-{formatValue(data.organicProgression.marketValuePressureTotal, 1)}</strong>
                      <small>
                        Traits {data.organicProgression.traitModifierPct > 0 ? "+" : ""}
                        {formatValue(data.organicProgression.traitModifierPct, 1)}% · Facility +
                        {formatValue(data.organicProgression.facilityModifierPct, 1)}%
                      </small>
                    </article>
                  </div>
                  <div className="player-drawer-chip-row">
                    {data.organicProgression.topGains.map((entry) => (
                      <span key={`organic-gain-${entry.attribute}`} className="player-drawer-chip is-positive">
                        {entry.attribute} +{formatValue(entry.delta, 1)}
                      </span>
                    ))}
                    {data.organicProgression.topLosses.map((entry) => (
                      <span key={`organic-loss-${entry.attribute}`} className="player-drawer-chip is-negative">
                        {entry.attribute} {formatValue(entry.delta, 1)}
                      </span>
                    ))}
                  </div>
                  <div className="player-drawer-progression-reason-grid" aria-label="Progressionsgruende">
                    <span title="Positive Traits erhoehen das Trainingsbudget, negative Traits bremsen es.">
                      <strong>
                        Traits {data.organicProgression.traitModifierPct > 0 ? "+" : ""}
                        {formatValue(data.organicProgression.traitModifierPct, 1)}%
                      </strong>
                      <small>Bonus/Malus wirkt auf organisches Wachstum</small>
                    </span>
                    <span title="Signature-Attribute bekommen positive Entwicklung etwas schneller gutgeschrieben.">
                      <strong>Signature</strong>
                      <small>{developmentLevelup?.affinity.signatureAttributes.join(" / ") || "Spielerprofil"}</small>
                    </span>
                    <span title="Das schwache Attribut entwickelt sich langsamer und kostet dadurch mehr Geduld.">
                      <strong>Weak</strong>
                      <small>{developmentLevelup?.affinity.weakAttribute ?? "Profil offen"}</small>
                    </span>
                    <span title="Matchday-Leistung zahlt Setpoints ein. Nahe der Attribut-Decke nur leicht gedrosselt, deutlich milder als Training.">
                      <strong>Performance +{formatValue(data.organicProgression.performanceSetpoints, 1)}</strong>
                      <small>Matchday-Anteil nach dieser Season</small>
                    </span>
                  </div>
                </>
              ) : null}
              {data.classHistory.length > 0 ? (
                <div className="player-drawer-chip-row">
                  {data.classHistory.slice(-5).map((entry, index) => (
                    <span key={`class-history-${entry.seasonId}-${index}`} className="player-drawer-chip is-subclass">
                      {entry.seasonId}: {entry.previousClassName ? `${entry.previousClassName} → ` : ""}
                      {entry.className}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {showScoutedDevelopmentSection && (data.scoutPotential || data.progressionForecast || showOwnPotentialSnapshot) ? (
            <section className="player-drawer-section player-drawer-panel" id={developmentLevelup ? undefined : "player-drawer-development"}>
              <h3 title="Kurzfassung: Potential, XP-Bilanz und Upgrade-Status. Details koennen aufgeklappt werden.">Potential & XP</h3>
              <div className="player-drawer-list-grid player-drawer-list-grid-wide">
                {showOwnPotentialSnapshot ? (
                  <article className="metric-card player-drawer-scout-potential-card" title="Achsen-Potential mit Saison-Delta und Route-Status fuer den eigenen Kader.">
                    <HelpLabel title="PO = geschaetzte Achsen-Decke. Delta zeigt die Veraenderung seit der letzten Saison.">Achsen-Potential</HelpLabel>
                    <strong className="player-drawer-star-stack">
                      PO {formatAxisStarValue(data.potentialOverallStars)}
                      {data.potentialOverallDelta != null ? (
                        <span className={`player-drawer-delta${getDeltaToneClass(data.potentialOverallDelta)}`}>
                          {formatStarDelta(data.potentialOverallDelta)}
                        </span>
                      ) : null}
                    </strong>
                    <small>
                      {data.potentialAxisStatus
                        .map((entry) => `${entry.axis.toUpperCase().slice(0, 1)} ${formatAxisStarValue(entry.poStars)}`)
                        .join(" · ")}
                    </small>
                    {data.potentialOverallDeltaSourceLabel ? (
                      <small>{data.potentialOverallDeltaSourceLabel}</small>
                    ) : null}
                    {data.trainingRouteImpact ? (
                      <small>
                        Trainingsrate {data.trainingRouteImpact.primaryAxis.toUpperCase()} ×
                        {formatValue(data.trainingRouteImpact.growthMultiplier, 2)} · {data.trainingRouteImpact.note}
                      </small>
                    ) : null}
                    {data.potentialAxisStatus.length ? (
                      <div className="player-drawer-chip-row">
                        {data.potentialAxisStatus.map((entry) => (
                          <span
                            key={`axis-po-${entry.axis}`}
                            className={`player-drawer-chip${getRouteStateChipClass(entry.routeState)}`}
                            title={entry.label}
                          >
                            {entry.axis.toUpperCase()} {formatAxisStarValue(entry.poStars)}
                            {entry.deltaStars != null ? ` (${formatStarDelta(entry.deltaStars)})` : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ) : null}
                {data.scoutPotential ? (
                  <article className="metric-card player-drawer-scout-potential-card" title="Potential ist eine gescoutete Spanne, nicht garantiert. Current ist der aktuelle Leistungswert, Gap ist der Abstand zum geschaetzten Potential. Je niedriger Confidence, desto unsicherer die Spanne.">
                    <HelpLabel title="Potential-Spanne = geschaetzter Zielbereich. Current = aktueller Stand. Gap = moegliche Entwicklung. Confidence zeigt, wie sicher das Scouting ist.">Potential</HelpLabel>
                    <strong>
                      {formatDevelopmentRange(data.developmentInsight)}{" "}
                      {showScoutedPotentialStars ? (
                        <ScoutStarDisplay
                          axisDisplay={data.potentialStarsDisplay}
                          starRating={data.scoutPotential?.starRating}
                          compact
                        />
                      ) : null}
                    </strong>
                    <small>
                      Current {formatValue(data.developmentInsight?.currentRating, 1)} · Gap{" "}
                      {data.developmentInsight?.developmentGap != null && data.developmentInsight.developmentGap > 0 ? "+" : ""}
                      {formatValue(data.developmentInsight?.developmentGap, 1)}
                    </small>
                    <small>
                      {formatGrowthOutlook(data.developmentInsight?.growthOutlook)} · Confidence {data.scoutPotential.confidence}% · Scouting L
                      {data.scoutPotential.scoutingLevel}
                    </small>
                  </article>
                ) : null}
                {data.progressionForecast && (!isScoutedProfile || scoutingLevel >= 4) ? (
                  <>
                    <article className="metric-card player-drawer-xp-balance-card" title="Netto-XP = verdiente XP minus Erhaltung und Regression. Positive Netto-XP werden zu freien XP, negative Werte zeigen Rueckschritt-Risiko.">
                      <HelpLabel title="Netto-XP = verdiente XP minus Erhaltung und Rueckschritt. Das ist die wichtigste Entwicklungszahl.">XP-Bilanz</HelpLabel>
                      <div className="player-drawer-xp-balance-grid">
                        <span>
                          <small>Verdient</small>
                          <strong>{formatValue(data.progressionForecast.earnedXP, 0)}</strong>
                        </span>
                        <span>
                          <small>Erhaltung</small>
                          <strong>-{formatValue(data.progressionForecast.maintenanceXP, 0)}</strong>
                        </span>
                        <span>
                          <small>Regression</small>
                          <strong className={data.progressionForecast.regressionPressure > 0 ? "is-negative" : ""}>
                            -{formatValue(data.progressionForecast.regressionPressure, 0)}
                          </strong>
                        </span>
                        <span>
                          <small>Netto</small>
                          <strong className={getDeltaToneClass(data.progressionForecast.netDevelopmentXP)}>
                            {formatValue(data.progressionForecast.netDevelopmentXP, 0)}
                          </strong>
                        </span>
                      </div>
                      <small>
                        {formatDevelopmentTrend(data.progressionForecast.xpTrend)} · {formatRegressionRisk(data.progressionForecast.regressionRisk)}
                      </small>
                    </article>
                    <article className="metric-card" title="Grobe Einordnung, wie viele Upgrades die aktuell verfuegbaren Netto-XP tragen koennten. Die echten Kosten haengen vom Attribut-Tier und Affinity ab.">
                      <HelpLabel title="Freie XP sind verfuegbar fuer Upgrades. Spent sind bereits ausgegebene XP.">Upgrade-Status</HelpLabel>
                      <strong>{data.progressionForecast.possibleUpgradeSummary}</strong>
                      <small>
                        XP {formatValue(data.progressionForecast.currentXP, 0)} frei / {formatValue(data.progressionForecast.spentXP, 0)} genutzt · Form{" "}
                        {data.progressionForecast.trainingFormTier}
                      </small>
                    </article>
                  </>
                ) : null}
              </div>
              {showScoutedDeepDevelopmentDetails ? (
                <details className="player-drawer-compact-details">
                  <summary>Mehr Entwicklungsdetails</summary>
                  <div className="player-drawer-compact-details-grid">
                    {data.progressionForecast ? (
                      <>
                        <article className="metric-card">
                          <HelpLabel title="CA = aktueller Stand. PO = geschaetztes Potential. Je groesser der Abstand, desto mehr Upside.">CA / PO</HelpLabel>
                          <strong className="player-drawer-star-stack">
                            <ScoutStarDisplay
                              axisDisplay={data.axisStarsDisplay}
                              starRating={data.progressionForecast.currentAbilityStars}
                              label="CAS"
                            />
                            <ScoutStarDisplay
                              axisDisplay={data.potentialStarsDisplay}
                              starRating={data.progressionForecast.potentialStars}
                              label="PAS"
                            />
                          </strong>
                          <small>
                            {data.progressionForecast.currentAbilityTier ?? "—"} → {data.progressionForecast.potentialTier ?? "—"}
                          </small>
                        </article>
                        <article className="metric-card">
                          <span>Spendbare XP</span>
                          <strong>{formatValue(data.progressionForecast.seasonProjectedXP, 0)}</strong>
                          <small>negative Netto-XP schreiben keine XP weg</small>
                        </article>
                        <article className="metric-card">
                          <span>Faktoren</span>
                          <strong>
                            {data.progressionForecast.trainingFormTier} · {formatSourceFreeDetail(data.progressionForecast.developmentRoute)}
                          </strong>
                          <small>
                            TF x{formatValue(data.progressionForecast.developmentFactors.trainingFormFactor, 2)} · PO x
                            {formatValue(data.progressionForecast.developmentFactors.potentialGapFactor, 2)}
                          </small>
                        </article>
                      </>
                    ) : null}
                    {data.scoutPotential ? (
                      <article className="metric-card">
                        <span>Scouting-Faktoren</span>
                        <strong>
                          Route {data.developmentInsight?.developmentRoute ?? "—"} · Growth x{data.scoutPotential.trainingSpeedMultiplier.toFixed(2)}
                        </strong>
                        <small>
                          MW Preview {data.scoutPotential.marketValuePotentialPremiumPct > 0 ? "+" : ""}
                          {formatValue(data.scoutPotential.marketValuePotentialPremiumPct, 1)}%
                        </small>
                      </article>
                    ) : null}
                  </div>
                </details>
              ) : null}
              {data.demands.length ? (
                <article className={`metric-card player-drawer-board-trust-card${getDemandCardTone(data.demands[0].status)}`}>
                  <span>Forderungen</span>
                  <strong>{data.demands.length}</strong>
                  <small>{data.demands.map((demand) => demand.label).join(" · ")}</small>
                  <div className="player-drawer-board-trust-reasons">
                    {data.demands.slice(0, 2).map((demand) => (
                      <span key={demand.demandId} title={demand.detail}>
                        {formatDemandStatus(demand.status)} · {demand.moraleReward >= 0 ? "+" : ""}{demand.moraleReward}/{demand.moralePenalty}
                      </span>
                    ))}
                  </div>
                </article>
              ) : null}
                {(!isScoutedProfile || scoutingLevel >= 4) && data.developmentInsight?.reasonChips?.length ? (
                  <div className="player-drawer-chip-row">
                    {data.developmentInsight.reasonChips.slice(0, 6).map((chip) => (
                      <span key={`potential-chip-${chip}`} className="player-drawer-chip">
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
                {(!isScoutedProfile || scoutingLevel >= 4) && data.developmentInsight?.recommendation ? (
                  <p className="muted">{data.developmentInsight.recommendation}</p>
                ) : null}
                {(!isScoutedProfile || scoutingLevel >= 4) && data.progressionEvents.length > 0 ? (
                  <div className="player-drawer-callout">
                    <strong>Progression-Events</strong>
                    <ul className="foundation-inline-list">
                      {data.progressionEvents.slice(0, 3).map((event) => (
                        <li key={event.eventId}>
                          {event.seasonId}: {formatValue(event.xpSpent, 0)} XP ·{" "}
                          {event.upgrades.map((upgrade) => `${upgrade.attribute} ${upgrade.fromValue}→${upgrade.toValue}`).join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
            </section>
          ) : null}

          {isFreeAgent && onOpenBuyPreview ? (
            <section className="player-drawer-section player-drawer-panel" id="player-drawer-market">
              <h3>Transfer</h3>
              <div className="player-drawer-inline-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    onOpenBuyPreview({
                      playerId: data.playerId,
                      name: data.name,
                      className: data.className,
                      race: data.race,
                    })
                  }
                >
                  Kauf prüfen
                </button>
                <span className="muted">Öffnet direkt den Kaufdialog.</span>
              </div>
            </section>
          ) : null}

          {data.progressionEconomyPreview ? (
            <section className="player-drawer-section">
              <h3>XP-Wirtschaft</h3>
              <div className="player-drawer-list-grid player-drawer-list-grid-wide">
                <article className="metric-card">
                  <span>MW nach Upgrade</span>
                  <strong>{formatMoney(data.progressionEconomyPreview.marketValuePreview)}</strong>
                </article>
                <article className="metric-card">
                  <span>Gehalt laufend</span>
                  <strong>{formatMoney(data.progressionEconomyPreview.currentContractSalary)}</strong>
                  <small>fix</small>
                </article>
                <article className="metric-card">
                  <span>Vertragsvorschau</span>
                  <strong>{formatMoney(data.progressionEconomyPreview.renewalSalaryPreview)}</strong>
                  <small>nur Vorschau</small>
                </article>
                <article className="metric-card">
                  <span title={getGameTermTooltip("OVR") ?? undefined}>OVR Vorschau</span>
                  <strong>{formatValue(data.progressionEconomyPreview.ovrPreview, 1)}</strong>
                </article>
                <article className="metric-card">
                  <span title={getGameTermTooltip("MVS") ?? undefined}>MVS</span>
                  <strong>{formatValue(data.progressionEconomyPreview.mvsUnchanged, 1)}</strong>
                  <small>bleibt historisch</small>
                </article>
                <article className="metric-card">
                  <span>Pruefung</span>
                  <strong>{data.progressionEconomyPreview.warningLevel ?? "—"}</strong>
                </article>
              </div>
              {data.progressionEconomyPreview.marketValueWarnings.length || data.progressionEconomyPreview.salaryWarnings.length ? (
                <div className="player-drawer-chip-row" style={{ marginTop: 12 }}>
                  {[...data.progressionEconomyPreview.marketValueWarnings, ...data.progressionEconomyPreview.salaryWarnings].map((warning) => (
                    <span key={`xp-economy-${warning}`} className="player-drawer-chip">
                      {warning}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="player-drawer-section player-drawer-panel" id="player-drawer-history">
            <h3>Historie</h3>
            {data.historyRows.length > 0 ? (
              <>
                <div className="table-shell player-drawer-history-table-shell">
                  <table className="team-table player-drawer-history-table">
                    <thead>
                      <tr>
                        <th>Saison</th>
                        <th>Team</th>
                        <th>Eins.</th>
                        <th>PPs</th>
                        <th>OVR</th>
                        <th>MVS</th>
                        <th className="player-drawer-history-axis is-power">POW</th>
                        <th className="player-drawer-history-axis is-speed">SPE</th>
                        <th className="player-drawer-history-axis is-mental">MEN</th>
                        <th className="player-drawer-history-axis is-social">SOC</th>
                        <th>MW</th>
                        <th>Ablöse</th>
                        <th>Faktor</th>
                        <th>Gehalt</th>
                        <th>LZ</th>
                        <th>Beste Diszi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.historyRows.map((row) => (
                        <tr key={`${row.seasonId ?? row.seasonName}-${row.sourceLabel}`}>
                          <td>
                            <strong>{row.seasonName}</strong>
                            {row.isActiveSeason ? <small className="player-drawer-history-tag">live</small> : null}
                          </td>
                          <td>{row.teamCode ?? row.teamName ?? "—"}</td>
                          <td>{formatValue(row.appearances)}</td>
                          <td>{formatHistoryMetric(row.pps ?? row.totalPoints, row.ppsRank, 1)}</td>
                          <td>{formatHistoryMetric(row.ovr, row.ovrRank, 1)}</td>
                          <td>{formatHistoryMetric(row.mvs, row.mvsRank, 1)}</td>
                          <td className="player-drawer-history-axis is-power">{formatValue(row.pow, 0)}</td>
                          <td className="player-drawer-history-axis is-speed">{formatValue(row.spe, 0)}</td>
                          <td className="player-drawer-history-axis is-mental">{formatValue(row.men, 0)}</td>
                          <td className="player-drawer-history-axis is-social">{formatValue(row.soc, 0)}</td>
                          <td
                            className={getMoneyDeltaToneClass(row.marketValueBaselineDelta, "higher")}
                            title="Dauerhafter Marktwert mit Veraenderung gegenueber dem Startwert aus der Basisdatenbank."
                          >
                            {formatMoneyWithBaselineDelta(row.marketValue, row.marketValueBaselineDelta)}
                          </td>
                          <td>
                            {row.projectedSellValue != null || row.transferFee != null ? (
                              <span
                                title={[
                                  row.projectedSellValue != null
                                    ? "Theoretischer Transferfenster-Wert aus MW mal aktuellem Sale-Faktor."
                                    : null,
                                  row.transferMarketValue != null ? `Referenz-MW ${formatMoney(row.transferMarketValue)}` : null,
                                  row.transferFee != null && row.projectedSellValue != null
                                    ? `echte Ablöse ${formatMoney(row.transferFee)}${formatHistoryTransferType(row.transferType) ? ` ${formatHistoryTransferType(row.transferType)}` : ""}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              >
                                {formatMoney(row.projectedSellValue ?? row.transferFee)}
                                {row.projectedSellValue == null && formatHistoryTransferType(row.transferType) ? (
                                  <small> {formatHistoryTransferType(row.transferType)}</small>
                                ) : null}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td title={row.projectedSellSourceLabel ?? undefined}>
                            {formatMoneyFactor(row.projectedSellFactor ?? row.transferMarketValueFactor)}
                          </td>
                          <td>{formatMoney(row.salary)}</td>
                          <td>{formatValue(row.contractLength)}</td>
                          <td>{row.bestDisciplineLabel ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted" style={{ marginTop: 10 }}>
                  Alte Seasons kommen aus gespeicherten Season-Snapshots. Fehlende Felder bedeuten: der damalige Snapshot
                  wurde noch vor der vollstaendigen Spieler-Metric-Archivierung erstellt.
                </p>
              </>
            ) : (
              <div className="player-drawer-callout">
                <strong>Noch keine Historie</strong>
                <p className="muted">Nach dem ersten Saisonabschluss erscheinen hier PPs, OVR, MVS, Achsenpunkte und Vertragswerte.</p>
              </div>
            )}
          </section>
        </div>
    </>
  );

  if (variant === "page") {
    return (
      <div className="player-profile-shell" data-testid="foundation-player-profile">
        <div
          className={`player-drawer player-drawer-dashboard player-drawer-page ${getClassColorClassName(data.className, "player-drawer-class-frame")}`}
        >
          {profileContent}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`player-drawer-backdrop${layerClassName ? ` ${layerClassName}` : ""}`}
      role="presentation"
      onClick={onClose}
    >
      <aside
        className={`player-drawer player-drawer-dashboard ${getClassColorClassName(data.className, "player-drawer-class-frame")}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${data.name} Details`}
        onClick={(event) => event.stopPropagation()}
      >
        {profileContent}
      </aside>
    </div>
  );
}
