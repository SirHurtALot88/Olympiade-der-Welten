"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";

import type { LeagueLeaderCategoryId } from "@/lib/foundation/league-leaders-service";
import { PLAYER_ATTRIBUTE_CHART_LABELS } from "@/lib/foundation/player-attribute-history";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";

import PlayerAttributeProgressChart from "@/app/foundation/player-profile/PlayerAttributeProgressChart";
import PlayerCareerStoryHeader from "@/app/foundation/player-profile/PlayerCareerStoryHeader";
import PlayerTrainingControls from "@/app/foundation/player-profile/PlayerTrainingControls";
import {
  PLAYER_DRAWER_HISTORY_ABLOESE_TOOLTIP,
  PLAYER_DRAWER_HISTORY_AVERAGE_FATIGUE_TOOLTIP,
  PlayerDrawerHistoryTable,
  PlayerDrawerTransferHistoryTable,
} from "@/components/foundation/player-drawer/PlayerDrawerHistoryTable";
import { isSeasonDisciplineKey } from "@/lib/season/season-discipline-area-groups";
import {
  getScoutingTierWindow,
  resolveScoutingConfidenceFromLevel,
} from "@/lib/market/transfermarkt-scouting";
import type {
  TrainingClassOption,
  TrainingModeOption,
  TrainingPlayerRowView,
} from "@/app/foundation/training-facilities-v2/training-view-types";

import { getClassColorClassName } from "./ClassColorChip";
import ClassIcon from "./ClassIcon";
import DisciplineIcon from "./DisciplineIcon";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import RaceIcon from "./RaceIcon";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { clampPotentialOverallToCurrent } from "@/lib/scouting/player-potential-ceiling-service";
import {
  buildPotentialRangeStarSlots,
  potentialScoreToStars,
  shouldShowPotentialRangeStars,
} from "@/lib/progression/player-potential-service";
import { getTrainingModePresentation } from "@/lib/training/training-mode-presentation";
import { resolveOrganicRegressionCombinedTotal } from "@/lib/training/organic-season-progression";
import { GameTerm, getGameTermTooltip } from "@/components/ui/GameTerm";
import { formatContractShapeLabel, formatContractShapeShortLabel } from "@/lib/foundation/player-economy-contract";
import { useFocusTrap } from "@/lib/foundation/use-focus-trap";
import WerdegangPanel from "@/components/foundation/werdegang/WerdegangPanel";
import {
  NlDeltaChip,
  NlFatigueGauge,
  NlProgressBar,
  NlRadar,
  NlSparkline,
  formatNlNumber,
  type NlRadarAxis,
} from "@/components/foundation/new-look";
import { NlAbilityStars } from "@/components/foundation/velo-ui";
import PlayerHeroNewLook from "./PlayerHeroNewLook";
import { buildPlayerCareerSeries } from "@/lib/foundation/career-series";
import { useFoundationStateOptional } from "@/lib/foundation/foundation-state-context";
import { useNewLook } from "@/lib/ui/new-look-preference";
import { getMetricBarPercent, getPoolHeatTone } from "@/lib/foundation/player-league-heat";

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
  return `${formatValue(points, 1)}${appearances != null ? ` / ${appearances}` : ""}`;
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
  const base = `${formatValue(points, 1)}${appearances != null ? ` / ${appearances}` : ""}`;
  return rank != null ? `${base} · #${rank}` : base;
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

function formatMoneyFactor(
  value: number | null | undefined,
  rankInBracket: number | null | undefined,
  bracketSize: number | null | undefined,
) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const base = `x${formatValue(value, 2)}`;
  if (rankInBracket != null && bracketSize != null && bracketSize > 0) {
    return `${base} (${rankInBracket}/${bracketSize})`;
  }
  return base;
}

function formatHistoryTransferType(value: "buy" | "sell" | "contract_exit" | null | undefined) {
  if (value === "buy") return "Kauf";
  if (value === "sell") return "Verkauf";
  if (value === "contract_exit") return "Vertragsende";
  return null;
}

function formatTransferHistoryDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function formatTrainingSeasonLabel(seasonId: string) {
  const match = seasonId.match(/season-(\d+)/i);
  if (match) {
    return `S${match[1]}`;
  }
  return getCanonicalSeasonLabel({ seasonId }) ?? seasonId;
}

function formatTrainingAttributeLabel(attribute: string) {
  return (
    PLAYER_ATTRIBUTE_CHART_LABELS[attribute as keyof typeof PLAYER_ATTRIBUTE_CHART_LABELS] ??
    attribute.slice(0, 3).toUpperCase()
  );
}

function formatTrainingModeShort(mode: string | null | undefined) {
  if (!mode) {
    return "—";
  }
  if (mode === "leicht") {
    return "L";
  }
  if (mode === "mittel") {
    return "M";
  }
  if (mode === "schwer") {
    return "S";
  }
  return mode;
}

function formatSignedPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value, 1)}%`;
}

function formatSignedSetpoints(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value, digits)}`;
}

function formatTrainingClassDirection(
  currentClass: string | null | undefined,
  trainingClass: string | null | undefined,
) {
  if (!currentClass) {
    return "—";
  }
  if (!trainingClass || trainingClass === currentClass) {
    return `${currentClass} (stabil)`;
  }
  return `${currentClass} → ${trainingClass}`;
}

function formatOrganicNetSubline(input: {
  appliedTrainingSetpoints: number;
  appliedPerformanceSetpoints: number;
  regressionCombinedTotal: number;
}) {
  return `Training ${formatSignedSetpoints(input.appliedTrainingSetpoints)} · Performance ${formatSignedSetpoints(input.appliedPerformanceSetpoints)} · Regression ${formatSignedSetpoints(input.regressionCombinedTotal)}`;
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

function buildAxisChipTooltip(card: PlayerDetailDrawerData["axisCards"][number]) {
  const axisHint = getGameTermTooltip(card.label) ?? card.label;
  return `${axisHint} · Stat ${formatValue(card.value, 0)} ${formatRankLabel(card.valueRank)} · PPs ${formatValue(card.seasonPoints, 1)} ${formatRankLabel(card.seasonPointsRank)}`;
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

function resolveAttributeCardAffinity(
  attributeKey: string,
  developmentLevelup: PlayerDetailDrawerData["developmentLevelup"],
  previewAffinity?: string | null,
) {
  if (previewAffinity && previewAffinity !== "neutral") return previewAffinity;
  if (!developmentLevelup) return "neutral";
  if (developmentLevelup.affinity.signatureAttributes.includes(attributeKey as never)) return "signature";
  if (developmentLevelup.affinity.weakAttribute === attributeKey) return "weak";
  return "neutral";
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
    return `Verletzt bis ${data.injuryUntilMatchday ?? "nächster Matchday"}`;
  }
  if (data.injuryStatus === "recovering") {
    return "Genesen";
  }
  if (data.injuryRiskPercent > 0) {
    return `${data.injuryRiskLabel} (${formatValue(data.injuryRiskPercent, 0)}%)`;
  }
  return data.injuryRiskLabel || "gesund";
}

function buildFatigueImpactTooltip(data: Pick<PlayerDetailDrawerData, "fatigue" | "availability">) {
  const fatigueValue = data.fatigue ?? 0;
  const parts = [
    `Fatigue ${formatValue(fatigueValue, 0)}`,
    data.availability.performancePenaltyPercent > 0
      ? `Leistung -${formatValue(data.availability.performancePenaltyPercent, 1)}%`
      : "Leistung 0%",
    data.availability.injuryRiskPercent > 0
      ? `Verletzungsrisiko ${formatValue(data.availability.injuryRiskPercent, 1)}%`
      : "Verletzungsrisiko 0%",
  ];
  if (data.availability.normalRecovery != null) {
    parts.push(`Recovery ${formatValue(data.availability.normalRecovery, 1)}`);
  }
  if (data.availability.injuryRecovery != null) {
    parts.push(`verletzt ${formatValue(data.availability.injuryRecovery, 1)}`);
  }
  return parts.join(" · ");
}

function sumHistoryAppearances(rows: PlayerDetailDrawerData["historyRows"]) {
  let total = 0;
  let hasAny = false;
  for (const row of rows) {
    if (row.appearances != null && Number.isFinite(row.appearances)) {
      total += row.appearances;
      hasAny = true;
    }
  }
  return hasAny ? total : null;
}

function computeCareerAverageFatigue(rows: PlayerDetailDrawerData["historyRows"]) {
  let weightedTotal = 0;
  let weight = 0;
  for (const row of rows) {
    if (
      row.averageFatigue != null &&
      Number.isFinite(row.averageFatigue) &&
      row.appearances != null &&
      row.appearances > 0
    ) {
      weightedTotal += row.averageFatigue * row.appearances;
      weight += row.appearances;
    }
  }
  return weight > 0 ? Number((weightedTotal / weight).toFixed(1)) : null;
}

function renderSeasonSnapshotMetricPair(input: {
  label: string;
  seasonValue: string;
  allTimeValue: string;
  title?: string;
}) {
  return (
    <article className="player-drawer-season-snapshot-card" title={input.title}>
      <small>{input.label}</small>
      <div className="player-drawer-season-snapshot-values">
        <div className="player-drawer-season-snapshot-value">
          <strong>{input.seasonValue}</strong>
          <em>Saison</em>
        </div>
        <div className="player-drawer-season-snapshot-value">
          <strong>{input.allTimeValue}</strong>
          <em>All Time</em>
        </div>
      </div>
    </article>
  );
}

function renderInjuryStatusBanner(data: PlayerDetailDrawerData) {
  if (data.availability.isUnavailable || data.availability.injuryStatus === "injured") {
    return (
      <div className="player-drawer-injury-banner is-negative" data-testid="player-drawer-injury-banner">
        <strong>Verletzt</strong>
        <span>
          Ausfall bis {data.availability.injuryUntilMatchday ?? "nächster Spieltag"}
          {data.availability.injuryRecovery != null
            ? ` · Regeneration ${formatValue(data.availability.injuryRecovery, 1)} (50%)`
            : " · Regeneration 50%"}
        </span>
      </div>
    );
  }
  if (data.availability.injuryStatus === "recovering") {
    return (
      <div className="player-drawer-injury-banner is-warning" data-testid="player-drawer-injury-banner">
        <strong>Genesen</strong>
        <span>Reduzierte Regeneration — noch nicht voll einsatzbereit.</span>
      </div>
    );
  }
  return null;
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
      return "Rückschritt-Risiko";
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
  starRangeMin,
  starRangeMax,
  label,
  compact = false,
}: {
  axisDisplay?: string | null;
  starRating?: string | number | null;
  starRangeMin?: number | null;
  starRangeMax?: number | null;
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
  if (
    starRangeMin != null &&
    starRangeMax != null &&
    shouldShowPotentialRangeStars(starRangeMin, starRangeMax)
  ) {
    return (
      <PotentialRangeStarRating
        minScore={starRangeMin}
        maxScore={starRangeMax}
        label={label}
        compact={compact}
      />
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

function PotentialRangeStarRating({
  minScore,
  maxScore,
  label,
  compact = false,
}: {
  minScore: number;
  maxScore: number;
  label?: string;
  compact?: boolean;
}) {
  const slots = buildPotentialRangeStarSlots(minScore, maxScore);
  const minStars = potentialScoreToStars(minScore);
  const maxStars = potentialScoreToStars(maxScore);

  return (
    <span
      className={`player-drawer-star-rating is-range${compact ? " is-compact" : ""}`}
      aria-label={`${label ? `${label}: ` : ""}Potential ${formatValue(minStars, 1)} bis ${formatValue(maxStars, 1)} von 5 Sternen`}
      title={`${label ? `${label}: ` : ""}Potential ${formatValue(minScore, 0)}-${formatValue(maxScore, 0)} (${formatValue(minStars, 1)}-${formatValue(maxStars, 1)} Sterne). Schwarze Sterne = mögliches, aber unsicheres Maximum.`}
    >
      {label ? <span className="player-drawer-star-label">{label}</span> : null}
      <span className="player-drawer-stars" aria-hidden="true">
        {slots.map((slot) => {
          if (slot.maxFill <= 0) {
            return (
              <span key={`range-star-${slot.index}`} className="player-drawer-star is-inactive">
                <span className="player-drawer-star-empty">★</span>
              </span>
            );
          }

          return (
            <span
              key={`range-star-${slot.index}`}
              className={`player-drawer-star${slot.showUncertain ? " has-uncertain" : ""}`}
            >
              <span className="player-drawer-star-empty">★</span>
              {slot.minFill > 0 ? (
                <span className="player-drawer-star-fill" style={{ width: `${slot.minFill * 100}%` }}>
                  ★
                </span>
              ) : null}
              {slot.showUncertain ? (
                <span
                  className="player-drawer-star-uncertain"
                  style={{
                    left: `${slot.minFill * 100}%`,
                    width: `${(slot.maxFill - slot.minFill) * 100}%`,
                  }}
                >
                  ★
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
    </span>
  );
}

function hasKnownCaPoStars(data: PlayerDetailDrawerData) {
  return (
    data.currentOverallStars != null ||
    data.potentialOverallStars != null ||
    parseStarValue(data.progressionForecast?.currentAbilityStars) != null ||
    parseStarValue(data.progressionForecast?.potentialStars) != null ||
    data.axisStarsDisplay != null ||
    data.potentialStarsDisplay != null
  );
}

function resolveCaPoDisplay(data: PlayerDetailDrawerData) {
  const caStars =
    data.currentOverallStars ?? parseStarValue(data.progressionForecast?.currentAbilityStars);
  const rawPoStars =
    data.potentialOverallStars ?? parseStarValue(data.progressionForecast?.potentialStars);
  const poStars =
    rawPoStars != null && caStars != null
      ? clampPotentialOverallToCurrent(caStars, rawPoStars)
      : rawPoStars;

  return {
    caStars,
    poStars,
    caDisplay: data.axisStarsDisplay ?? null,
    poDisplay: data.potentialStarsDisplay ?? null,
  };
}

function PlayerCaPoStarStack({ data, newLook = false }: { data: PlayerDetailDrawerData; newLook?: boolean }) {
  const { caStars, poStars, caDisplay, poDisplay } = resolveCaPoDisplay(data);

  if (newLook) {
    const known = data.attributeVisibility === "exact";
    const poScoreRange = data.developmentInsight?.potentialRangeDisplay ?? null;
    return (
      <div className="player-drawer-ca-po-row" data-testid="player-drawer-ca-po-row">
        <NlAbilityStars
          caStars={caStars}
          caScore={data.developmentInsight?.currentRating ?? null}
          poStars={poStars}
          poScoreRange={poScoreRange}
          known={known}
          label="Fähigkeiten"
          compact
        />
      </div>
    );
  }

  return (
    <div className="player-drawer-ca-po-row" data-testid="player-drawer-ca-po-row">
      <span className="player-drawer-ca-po-metric">
        <small>CA</small>
        {caStars != null ? (
          <StarRating value={caStars} compact />
        ) : caDisplay ? (
          <span className="player-drawer-star-text is-compact">{caDisplay}</span>
        ) : (
          <span className="player-drawer-star-rating is-empty">—</span>
        )}
      </span>
      <span className="player-drawer-ca-po-metric">
        <small>PO</small>
        {poDisplay ? (
          <span className="player-drawer-star-text is-compact">{poDisplay}</span>
        ) : poStars != null ? (
          <StarRating value={poStars} compact />
        ) : (
          <span className="player-drawer-star-rating is-empty">—</span>
        )}
      </span>
    </div>
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
  scoutingLevel: number,
  newLookHeat: { enabled: boolean; pool: Record<string, number[]> | null } = { enabled: false, pool: null },
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
          title="Gescoutete Klasse als Range, keine exakte Diszi-Zahl."
        >
          {getScoutingTierWindow(
            row.scoutedTier ?? formatDisciplineTier(row.value),
            resolveScoutingConfidenceFromLevel(scoutingLevel),
          )}
        </span>
      ) : (
        <>
          {formatDisciplineValue(row.value, row.upgradeDelta)}
          {/* "Neuer Look" (flag-gated, additiv, #60 FM Data-Hub): Liga-Heat-Bar
              unter dem Diszi-Wert — echte Pool-Verteilung aus allen Spielern
              des aktiven Saves (`disciplinePool`), keine erfundene Skala. */}
          {newLookHeat.enabled && newLookHeat.pool && row.value != null ? (
            <NlProgressBar
              className="is-new-look nl-player-discipline-heat-bar"
              value={getMetricBarPercent(row.value, newLookHeat.pool[row.id] ?? [], 100)}
              max={100}
              tone={getPoolHeatTone(row.value, newLookHeat.pool[row.id] ?? [])}
              showValue={false}
              title={`${row.label}: ${formatValue(row.value, 0)} · Liga-Verteilung (Rang im Vergleich zu allen Spielern)`}
            />
          ) : null}
        </>
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

// "Neuer Look" (flag-gated, additiv, FM-Vergleichsscreen #60): Zwei-Spieler-
// Vergleich — siehe `PlayerComparePanel` unten. POW/SPE/MEN/SOC kommen 1:1
// aus `PlayerDetailDrawerData` (dieselben Felder wie der Hero-Radar).
function buildRadarAxesFromPlayerData(source: Pick<PlayerDetailDrawerData, "pow" | "spe" | "men" | "soc">): NlRadarAxis[] {
  return (
    [
      ["pow", source.pow],
      ["spe", source.spe],
      ["men", source.men],
      ["soc", source.soc],
    ] as const
  )
    .filter((entry): entry is readonly [NlRadarAxis["key"], number] => entry[1] != null && Number.isFinite(entry[1]))
    .map(([key, value]) => ({ key, value }));
}

type ComparePlayerCandidate = {
  id: string;
  name: string;
  className: string | null;
  teamCode: string | null;
};

type CompareDisciplineRow = {
  id: string;
  label: string;
  category: DisciplineCategoryLike;
  entryA: PlayerDetailDrawerData["disciplineValues"][number];
  entryB: PlayerDetailDrawerData["disciplineValues"][number] | undefined;
  delta: number | null;
};

type DisciplineCategoryLike = PlayerDetailDrawerData["disciplineValues"][number]["category"];

function renderComparePlayerLabel(name: string, teamCode: string | null | undefined, isFreeAgent: boolean) {
  if (teamCode) {
    return `${name} · ${teamCode}`;
  }
  return isFreeAgent ? `${name} · Free Agent` : name;
}

function renderCompareDisciplineCell(
  entry: PlayerDetailDrawerData["disciplineValues"][number] | undefined,
  isScouted: boolean,
  scoutingLevel: number,
) {
  if (!entry) {
    return <span className="nl-compare-metric-gap">—</span>;
  }
  if (isScouted) {
    const tier = entry.scoutedTier ?? formatDisciplineTier(entry.value);
    return (
      <span
        className={`player-drawer-chip ${getAttributeTierClass(tier)}`}
        title="Gescoutete Klasse als Range, keine exakte Diszi-Zahl."
      >
        {getScoutingTierWindow(tier, resolveScoutingConfidenceFromLevel(scoutingLevel))}
      </span>
    );
  }
  return <span className="nl-tnum">{formatValue(entry.value, 0)}</span>;
}

/**
 * "Vergleichen"-Affordanz im Spieler-Drawer (#60, FM-Vergleichsscreen):
 * Spieler-Picker (Suche über die reale Spielerliste des Saves) + Vergleichs-
 * Panel (Radar mit Ghost-Polygon, Kennzahlen-Deltas, Diszi-Tabelle). Für
 * nicht-eigene/ungescoutete Spieler B werden exakte Diszi-Werte durch die
 * bestehenden Scouting-Tier-Ranges ersetzt (`scoutedTier` + `getScoutingTierWindow`,
 * dieselbe Quelle wie die Top-Disziplinen-Tabelle oben) — es wird nichts an
 * verdeckten Daten erfunden oder vorbeigerechnet.
 */
function PlayerComparePanel({
  dataA,
  open,
  onToggleOpen,
  query,
  onQueryChange,
  candidates,
  selectedPlayerId,
  onSelectPlayer,
  onClearSelection,
  dataB,
  loadingB,
}: {
  dataA: PlayerDetailDrawerData;
  open: boolean;
  onToggleOpen: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  candidates: ComparePlayerCandidate[];
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  onClearSelection: () => void;
  dataB: PlayerDetailDrawerData | null;
  loadingB: boolean;
}) {
  const aIsScouted = dataA.attributeVisibility === "scouted";
  const bIsScouted = dataB != null && dataB.attributeVisibility === "scouted";
  const bIsFreeAgent = dataB != null && dataB.transferStatus.toLowerCase().includes("free");

  const radarAxesA = buildRadarAxesFromPlayerData(dataA);
  const radarAxesB = dataB ? buildRadarAxesFromPlayerData(dataB) : [];

  const compareMetrics = dataB
    ? [
        { key: "ovr", label: "OVR", aValue: dataA.ovr, bValue: dataB.ovr },
        { key: "pps", label: "PPs", aValue: dataA.pps ?? dataA.ppsRating, bValue: dataB.pps ?? dataB.ppsRating },
        { key: "mvs", label: "MVS", aValue: dataA.mvs, bValue: dataB.mvs },
        { key: "mw", label: "MW", aValue: dataA.marketValue, bValue: dataB.marketValue },
      ]
    : [];

  const compareDisciplineRows: CompareDisciplineRow[] = dataB
    ? (() => {
        const bById = new Map(dataB.disciplineValues.map((entry) => [entry.id, entry] as const));
        return [...dataA.disciplineValues]
          .sort((left, right) => (right.value ?? -1) - (left.value ?? -1))
          .slice(0, 8)
          .map((entryA) => {
            const entryB = bById.get(entryA.id);
            const delta =
              !aIsScouted && !bIsScouted && entryA.value != null && entryB?.value != null
                ? Number((entryA.value - entryB.value).toFixed(1))
                : null;
            return { id: entryA.id, label: entryA.label, category: entryA.category, entryA, entryB, delta };
          });
      })()
    : [];

  return (
    <div className="is-new-look nl-player-compare" data-testid="player-compare-panel">
      {/* #6: Deutlich sichtbarer Einstieg für den 2-Spieler-Vergleich —
          Icon + ausformulierte Beschriftung + Kurzhinweis, damit die Funktion
          nicht übersehen wird. */}
      <div className="nl-player-compare-entry">
        <button
          type="button"
          className="nl-player-compare-toggle"
          aria-expanded={open}
          aria-controls="player-compare-panel-body"
          onClick={onToggleOpen}
        >
          <span className="nl-player-compare-toggle-icon" aria-hidden="true">
            ⇆
          </span>
          {open ? "Vergleich schliessen" : "Spieler vergleichen"}
        </button>
        {!open ? (
          <span className="nl-player-compare-hint muted">Stelle diesen Spieler einem zweiten direkt gegenüber.</span>
        ) : null}
      </div>
      <div className="nl-compare-panel" id="player-compare-panel-body" hidden={!open}>
        {!open ? null : selectedPlayerId == null ? (
          <div className="nl-compare-picker">
            <label className="nl-compare-picker-label" htmlFor="player-compare-search">
              Spieler für Vergleich suchen
            </label>
            <input
              id="player-compare-search"
              type="search"
              className="nl-compare-picker-input"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Spielername…"
              autoComplete="off"
            />
            <ul className="nl-compare-picker-list" role="listbox" aria-label="Vergleichs-Kandidaten">
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className="nl-compare-picker-item"
                    role="option"
                    aria-selected={false}
                    onClick={() => onSelectPlayer(candidate.id)}
                  >
                    <span className="nl-compare-picker-item-name">{candidate.name}</span>
                    <span className="nl-compare-picker-item-meta">
                      {candidate.className ?? "—"}
                      {candidate.teamCode ? ` · ${candidate.teamCode}` : " · Free Agent"}
                    </span>
                  </button>
                </li>
              ))}
              {candidates.length === 0 ? <li className="nl-compare-picker-empty muted">Keine Treffer.</li> : null}
            </ul>
          </div>
        ) : loadingB ? (
          <p className="nl-compare-loading muted" role="status" aria-live="polite">
            Lade Vergleichsprofil…
          </p>
        ) : dataB ? (
          <div className="nl-compare-result">
            <header className="nl-compare-result-head">
              <div className="nl-compare-result-players">
                <strong className="is-a">{dataA.name}</strong>
                <span className="nl-compare-vs" aria-hidden="true">
                  vs
                </span>
                <strong className="is-b">{renderComparePlayerLabel(dataB.name, dataB.teamCode, bIsFreeAgent)}</strong>
              </div>
              <button type="button" className="nl-compare-clear" onClick={onClearSelection}>
                Anderen Spieler wählen
              </button>
            </header>

            <div className="nl-compare-radar-block">
              <NlRadar
                axes={radarAxesA}
                ghostAxes={radarAxesB.length === 4 ? radarAxesB : undefined}
                ghostLabel={dataB.name}
                max={100}
                showValues
                className="nl-compare-radar"
                aria-label={`Achsen-Vergleich: ${dataA.name} vs ${dataB.name}`}
              />
              <p className="nl-player-hero-radar-legend" aria-label="Radar-Legende">
                <span className="nl-player-hero-radar-legend-item is-current">
                  <span className="nl-player-hero-radar-legend-swatch" aria-hidden="true" />
                  {dataA.name}
                </span>
                <span className="nl-player-hero-radar-legend-item is-ghost">
                  <span className="nl-player-hero-radar-legend-swatch" aria-hidden="true" />
                  {dataB.name}
                </span>
              </p>
            </div>

            <div className="nl-compare-metrics" role="group" aria-label="Kennzahlen-Vergleich">
              {compareMetrics.map((metric) => (
                <div className="nl-compare-metric-row" key={metric.key}>
                  <span className="nl-compare-metric-a nl-tnum">{formatNlNumber(metric.aValue, 1)}</span>
                  <span className="nl-compare-metric-label">{metric.label}</span>
                  {metric.aValue != null && metric.bValue != null ? (
                    <NlDeltaChip
                      value={Number((metric.aValue - metric.bValue).toFixed(1))}
                      title={`${dataA.name} − ${dataB.name}`}
                    />
                  ) : (
                    <span className="nl-compare-metric-gap">—</span>
                  )}
                  <span className="nl-compare-metric-b nl-tnum">{formatNlNumber(metric.bValue, 1)}</span>
                </div>
              ))}
            </div>

            <div className="table-shell nl-compare-discipline-table-shell">
              <table className="team-table nl-compare-discipline-table">
                <thead>
                  <tr>
                    <th>Diszi</th>
                    <th>{dataA.name}</th>
                    <th>Δ</th>
                    <th>{dataB.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {compareDisciplineRows.map((row) => {
                    const areaClass = getDisciplineAreaClass(row.category);
                    return (
                      <tr key={`compare-discipline-${row.id}`}>
                        <td className={`player-drawer-discipline-name-cell ${areaClass}`}>
                          <DisciplineIcon
                            disciplineId={row.id}
                            label={row.label}
                            className={`discipline-icon-chip-inline player-drawer-discipline-area-chip ${areaClass}`}
                          />
                        </td>
                        <td>{renderCompareDisciplineCell(row.entryA, aIsScouted, dataA.scoutingLevel ?? 0)}</td>
                        <td>
                          {row.delta != null ? (
                            <NlDeltaChip value={row.delta} />
                          ) : (
                            <span className="nl-compare-metric-gap">—</span>
                          )}
                        </td>
                        <td>{renderCompareDisciplineCell(row.entryB, bIsScouted, dataB.scoutingLevel ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {bIsScouted ? (
              <p className="nl-compare-fog-note muted">
                {dataB.name} ist nicht vollständig gescoutet — Diszi-Werte als Klassen-Range (Scouting L
                {dataB.scoutingLevel ?? 0}), keine exakten Zahlen.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="nl-compare-error">
            <p className="muted">Vergleichsprofil nicht verfügbar.</p>
            <button type="button" className="nl-compare-clear" onClick={onClearSelection}>
              Anderen Spieler wählen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayerDetailDrawer({
  data,
  onClose,
  onOpenBuyPreview,
  onOpenTraining,
  onOpenLeagueLeaders,
  onOpenTeam,
  trainingRow = null,
  trainingModeOptions = [],
  trainingClassOptions = [],
  onSetTrainingMode,
  onSetTrainingClass,
  trainingReadOnly = false,
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
  onOpenTraining?: () => void;
  onOpenLeagueLeaders?: (
    categoryId: LeagueLeaderCategoryId,
    returnContext?: { playerId: string; playerName: string },
  ) => void;
  onOpenTeam?: (teamId: string) => void;
  trainingRow?: TrainingPlayerRowView | null;
  trainingModeOptions?: TrainingModeOption[];
  trainingClassOptions?: TrainingClassOption[];
  onSetTrainingMode?: (playerId: string, mode: TrainingPlayerRowView["mode"]) => void;
  onSetTrainingClass?: (playerId: string, trainingClass: string) => void;
  trainingReadOnly?: boolean;
  layerClassName?: string;
  variant?: "drawer" | "page";
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
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

  useFocusTrap(Boolean(data) && variant !== "page", dialogRef);

  const trainingAttributeColumns = useMemo(
    () =>
      [
        ...new Set(
          (data?.trainingHistoryRows ?? []).flatMap((row) => row.upgrades.map((upgrade) => upgrade.attribute)),
        ),
      ].sort((left, right) => left.localeCompare(right, "de")),
    [data?.trainingHistoryRows],
  );

  // "Neuer Look" (flag-gated, additive): career series for the Werdegang panel.
  // With the flag OFF this stays null and nothing new is rendered.
  const [newLookEnabled] = useNewLook();
  const foundationState = useFoundationStateOptional();
  const werdegangGameState = foundationState?.gameState ?? null;
  const werdegangPlayerId = data?.playerId ?? null;
  const werdegangSeries = useMemo(
    () =>
      newLookEnabled && werdegangGameState && werdegangPlayerId
        ? buildPlayerCareerSeries(werdegangGameState, werdegangPlayerId)
        : null,
    [newLookEnabled, werdegangGameState, werdegangPlayerId],
  );

  // "Neuer Look" (flag-gated, additiv, FM Data-Hub #60): Liga-Heat-Pool je
  // Disziplin — reale disciplineRatings aller Spieler des aktiven Saves, für
  // die Heat-Bar unter den Top-Disziplinen-Werten. Kein synthetischer Pool.
  const disciplineHeatPool = useMemo(() => {
    if (!newLookEnabled || !werdegangGameState) {
      return null;
    }
    const pool: Record<string, number[]> = {};
    for (const player of werdegangGameState.players) {
      for (const disciplineId of Object.keys(player.disciplineRatings ?? {})) {
        const value = player.disciplineRatings[disciplineId];
        if (value != null && Number.isFinite(value)) {
          (pool[disciplineId] ??= []).push(value);
        }
      }
    }
    return pool;
  }, [newLookEnabled, werdegangGameState]);

  // "Neuer Look" (flag-gated, additiv, FM-Vergleichsscreen #60): Zwei-
  // Spieler-Vergleich. Spieler B wird über denselben Builder wie Spieler A
  // geladen (`buildPlayerDrawerDataFromGameState`), damit Scouting-/Fog-of-
  // war-Regeln identisch angewendet werden — es wird nichts an Spieler B
  // vorbeigerechnet oder erfunden.
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareQuery, setCompareQuery] = useState("");
  const [comparePlayerId, setComparePlayerId] = useState<string | null>(null);
  const [comparePlayerBData, setComparePlayerBData] = useState<PlayerDetailDrawerData | null>(null);
  const [comparePlayerBLoading, setComparePlayerBLoading] = useState(false);

  useEffect(() => {
    setCompareOpen(false);
    setCompareQuery("");
    setComparePlayerId(null);
    setComparePlayerBData(null);
  }, [data?.playerId]);

  useEffect(() => {
    if (!comparePlayerId || !werdegangGameState) {
      setComparePlayerBData(null);
      setComparePlayerBLoading(false);
      return undefined;
    }
    let cancelled = false;
    setComparePlayerBLoading(true);
    void (async () => {
      try {
        const { buildPlayerDrawerDataFromGameState } = await import("@/lib/foundation/player-detail-drawer");
        const nextData = buildPlayerDrawerDataFromGameState({
          gameState: werdegangGameState,
          playerId: comparePlayerId,
          source: data?.source ?? "sqlite",
          manageableTeamIds: foundationState?.foundationManageableTeamIds ?? null,
          saveId: foundationState?.activeSaveId ?? null,
        });
        if (!cancelled) {
          setComparePlayerBData(nextData);
        }
      } catch {
        if (!cancelled) {
          setComparePlayerBData(null);
        }
      } finally {
        if (!cancelled) {
          setComparePlayerBLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [comparePlayerId, werdegangGameState, data?.source, foundationState?.foundationManageableTeamIds, foundationState?.activeSaveId]);

  const compareTeamCodeByPlayerId = useMemo(() => {
    const map = new Map<string, string>();
    if (!compareOpen || !werdegangGameState) {
      return map;
    }
    const teamById = new Map(werdegangGameState.teams.map((team) => [team.teamId, team] as const));
    for (const roster of werdegangGameState.rosters) {
      const team = teamById.get(roster.teamId);
      if (team) {
        map.set(roster.playerId, team.shortCode || team.name);
      }
    }
    return map;
  }, [compareOpen, werdegangGameState]);

  const compareCandidates = useMemo(() => {
    if (!compareOpen || !werdegangGameState || !data) {
      return [];
    }
    const query = compareQuery.trim().toLowerCase();
    const currentPlayerId = data.playerId;
    return werdegangGameState.players
      .filter((player) => player.id !== currentPlayerId && (query.length === 0 || player.name.toLowerCase().includes(query)))
      .sort((left, right) => left.name.localeCompare(right.name, "de"))
      .slice(0, 20);
  }, [compareOpen, werdegangGameState, data, compareQuery]);

  const compareCandidateOptions = useMemo(
    () =>
      compareCandidates.map((player) => ({
        id: player.id,
        name: player.name,
        className: player.className ?? null,
        teamCode: compareTeamCodeByPlayerId.get(player.id) ?? null,
      })),
    [compareCandidates, compareTeamCodeByPlayerId],
  );

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
  const noSeasonPerformanceMessage = isFreeAgent
    ? "Keine gespeicherte Season-Performance."
    : "Aktiver Spieler, aber noch kein gespeicherter Season-Einsatz.";
  const visibleTopDisciplineColumnIds = topDisciplineColumnOrder.filter(
    (columnId) => !isScoutedProfile || columnId === "discipline" || columnId === "value",
  );
  const topDisciplineCards = [...data.disciplineValues.slice(0, isScoutedProfile ? 5 : data.disciplineValues.length)].sort((left, right) =>
    compareTopDisciplineRows(left, right, topDisciplineSort.columnId, topDisciplineSort.direction),
  );
  const activeHistoryRow = data.historyRows.find((row) => row.isActiveSeason) ?? null;
  const seasonSnapshotAppearances = seasonPerformance?.appearances ?? activeHistoryRow?.appearances ?? null;
  const careerSnapshotAppearances = sumHistoryAppearances(data.historyRows);
  const seasonSnapshotFatigue = activeHistoryRow?.averageFatigue ?? null;
  const careerSnapshotFatigue = computeCareerAverageFatigue(data.historyRows);
  const seasonSnapshotInjuries = activeHistoryRow?.injuriesCount ?? 0;
  const careerSnapshotInjuries = data.injurySummary.totalInjuries;
  const seasonSnapshotTopGains = trainingRow?.organicForecast.topGains ?? [];
  const marketValueHistoryRows = data.historyRows.filter((row) => row.marketValue != null);
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
  // "Neuer Look" (flag-gated, additiv): echte CA/PO-Sterne für das Hero-Gauge
  // nur bei aktivem Flag auflösen — mit Flag OFF bleibt alles unverändert.
  const newLookCaPo = newLookEnabled ? resolveCaPoDisplay(data) : null;
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
      value: data.pps ?? data.ppsRating,
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
  const visibleAxisCards = data.axisCards.filter((card) => card.value != null || card.seasonPoints != null);
  const showAxisStrip = visibleAxisCards.length > 0;
  const showFullAxisGrid = !isScoutedProfile;
  const showCompactAxisStrip = showAxisStrip && !showFullAxisGrid;
  const axisStrip = showCompactAxisStrip ? (
    <div
      className={`player-drawer-axis-strip${isFreeAgent ? " is-transfer-inline is-compact" : ""}`}
      data-testid="player-drawer-axis-strip"
      aria-label="Achsenwerte"
    >
      {visibleAxisCards.map((card) =>
        isFreeAgent ? (
          <article
            key={`axis-strip-${card.id}`}
            className={`player-drawer-axis-chip is-compact ${getAxisToneClass(card.tone)}`}
          >
            <span className="player-drawer-axis-chip-accent" aria-hidden="true" />
            <span className="player-drawer-axis-chip-hint" title={buildAxisChipTooltip(card)} aria-label={`${card.label}: Details`}>
              i
            </span>
            <div className="player-drawer-axis-chip-inline">
              <span className="player-drawer-axis-chip-metric">
                <strong>{formatValue(card.value, 0)}</strong>
                <em>{formatRankLabel(card.valueRank)}</em>
              </span>
              <span className="player-drawer-axis-chip-metric is-pp">
                <small>PPs</small>
                <strong>{formatValue(card.seasonPoints, 1)}</strong>
                <em>{formatRankLabel(card.seasonPointsRank)}</em>
              </span>
            </div>
          </article>
        ) : (
          <article
            key={`axis-strip-${card.id}`}
            className={`player-drawer-axis-chip ${getAxisToneClass(card.tone)}`}
            title={buildAxisChipTooltip(card)}
          >
            <header>
              <span title={getGameTermTooltip(card.label) ?? undefined}>{card.label}</span>
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
        ),
      )}
    </div>
  ) : null;

  const profileContent = (
    <>
          {renderInjuryStatusBanner(data)}
          {/* "Neuer Look" (flag-gated): ersetzt nur den Identitäts-/Ratings-Header.
              Mit Flag OFF rendert exakt der bisherige Header — byte-identisch. */}
          {newLookEnabled ? (
            <>
              <PlayerHeroNewLook
                data={data}
                roleLabel={formatRoleTag(transferContext.roleTag)}
                caStars={newLookCaPo?.caStars ?? null}
                poStars={newLookCaPo?.poStars ?? null}
                isFreeAgent={isFreeAgent}
                onClose={onClose}
                onOpenLeagueLeaders={onOpenLeagueLeaders}
              />
              <PlayerComparePanel
                dataA={data}
                open={compareOpen}
                onToggleOpen={() => setCompareOpen((value) => !value)}
                query={compareQuery}
                onQueryChange={setCompareQuery}
                candidates={compareCandidateOptions}
                selectedPlayerId={comparePlayerId}
                onSelectPlayer={setComparePlayerId}
                onClearSelection={() => {
                  setComparePlayerId(null);
                  setComparePlayerBData(null);
                }}
                dataB={comparePlayerBData}
                loadingB={comparePlayerBLoading}
              />
            </>
          ) : (
          <div className="player-drawer-header">
          <div className="player-drawer-hero">
            {data.portraitUrl ? (
              <BudgetedMediaImage
                className="player-drawer-portrait player-drawer-portrait-large"
                src={data.portraitUrl}
                alt={data.name}
                width={160}
                height={160}
                loading="eager"
                fetchPriority="high"
                eager
              />
            ) : (
              <div className="player-drawer-portrait player-drawer-portrait-large player-drawer-portrait-placeholder">{buildInitials(data.name)}</div>
            )}
            <div className="player-drawer-headline player-drawer-headline-rich">
              <div className="player-drawer-headline-top">
                <div className="player-drawer-headline-primary">
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
                        Trait verdeckt
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
              <div className="player-drawer-header-metrics-band" data-testid="player-drawer-header-metrics-band">
                <span className="player-drawer-header-metric" title="Marktwert">
                  <small>MW</small>
                  <strong>{formatMoney(data.marketValue)}</strong>
                  {marketValueDelta != null ? (
                    <em className={`player-drawer-money-delta${getMoneyDeltaToneClass(marketValueDelta, "higher")}`}>
                      {formatSignedMoney(marketValueDelta)}
                    </em>
                  ) : null}
                </span>
                <span className="player-drawer-header-metric" title="Aktuelles Vertragsgehalt">
                  <small>Gehalt</small>
                  <strong>{formatMoney(data.salary)}</strong>
                  {salaryDelta != null ? (
                    <em className={`player-drawer-money-delta${getMoneyDeltaToneClass(salaryDelta, "lower")}`}>
                      {formatSignedMoney(salaryDelta)}
                    </em>
                  ) : null}
                </span>
                <span className="player-drawer-header-metric" title="Vertragslaufzeit">
                  <small>Vertrag</small>
                  <strong>
                    {data.contractLength ?? "—"}
                    {formatContractShapeShortLabel(data.contractShape) ? ` · ${formatContractShapeShortLabel(data.contractShape)}` : ""}
                  </strong>
                  {formatContractShapeLabel(data.contractShape) !== "Ausgeglichen" ? (
                    <em title={formatContractShapeLabel(data.contractShape)}>{formatContractShapeLabel(data.contractShape)}</em>
                  ) : null}
                  {transferContext.promisedRole ? (
                    <em> · {formatRoleTag(transferContext.promisedRole)}</em>
                  ) : null}
                </span>
                <span
                  className={`player-drawer-header-metric${data.availability.isUnavailable ? " is-negative" : data.availability.injuryRiskBand === "sehr_stark" || data.availability.injuryRiskBand === "stark" ? " is-negative" : data.availability.injuryRiskPercent > 0 ? " is-warning" : ""}`}
                  title={buildFatigueImpactTooltip(data)}
                >
                  <small>Verfügbarkeit</small>
                  <strong>{formatAvailabilityStatus(data.availability)}</strong>
                  {data.availability.performancePenaltyPercent > 0 ? (
                    <em> · −{formatValue(data.availability.performancePenaltyPercent, 1)}% Leistung</em>
                  ) : null}
                </span>
                {isFreeAgent ? (
                  <div className="player-drawer-header-scout-compact" data-testid="player-drawer-header-scout-compact">
                    {hasKnownCaPoStars(data) ? <PlayerCaPoStarStack data={data} newLook={newLookEnabled} /> : null}
                    <span className="player-drawer-header-metric">
                      <small>Scouting</small>
                      <strong>L{data.scoutingLevel ?? 0}</strong>
                    </span>
                    <span className="player-drawer-header-metric">
                      <small>Rolle</small>
                      <strong>{formatRoleTag(transferContext.roleTag)}</strong>
                    </span>
                    <span className="player-drawer-header-metric" title={buildFatigueImpactTooltip(data)}>
                      <small>Erschöpfung</small>
                      <strong>{formatValue(data.fatigue, 0)}</strong>
                      {data.availability.performancePenaltyPercent > 0 ? (
                        <em> · −{formatValue(data.availability.performancePenaltyPercent, 1)}%</em>
                      ) : null}
                    </span>
                  </div>
                ) : null}
              </div>
              {data.flavorDe ? (
                <p className="player-drawer-flavor-de" data-testid="player-drawer-flavor-de" title={data.flavorDe}>
                  {data.flavorDe}
                </p>
              ) : null}
            </div>
          </div>
          <button className="secondary-button inline-button" type="button" onClick={onClose}>
            Schließen
          </button>
        </div>
          )}

        <div className="player-drawer-body">
          <section className="player-drawer-section player-drawer-hero-surface" id="player-drawer-profile">
            {isFreeAgent ? (
              <div className={`player-drawer-top-grid player-drawer-transfer-hero-grid${showCompactAxisStrip ? "" : " is-single"}`}>
                <div
                  className="player-drawer-transfer-note"
                  title="Free Agents haben noch keine gespeicherte Saisonleistung in diesem Save. OVR, PPs und MVS werden vor dem Kauf nicht angezeigt, die Achsenwerte bleiben sichtbar."
                >
                  <strong>Transfermarkt-Profil</strong>
                  <span>Keine OVR/PPs/MVS vor dem Kauf.</span>
                </div>
                {showCompactAxisStrip ? axisStrip : null}
              </div>
            ) : (
              <div className="player-drawer-top-grid">
                <div className="player-drawer-profile-stack">
                  <div className={`player-drawer-profile-card${variant === "page" ? " is-compact" : ""}`}>
                    <span className="player-drawer-overline">Scouting</span>
                    <p className="player-drawer-subline player-drawer-role-line">
                      Rolle {formatRoleTag(transferContext.roleTag)}
                      {transferContext.promisedRole ? ` · Versprochen ${formatRoleTag(transferContext.promisedRole)}` : ""}
                    </p>
                    <PlayerCaPoStarStack data={data} newLook={newLookEnabled} />
                    <div className="player-drawer-scout-meta">
                      <span>Scouting L{data.scoutingLevel ?? 0}</span>
                      <span title={buildFatigueImpactTooltip(data)}>
                        Erschöpfung {formatValue(data.fatigue, 0)}
                        {data.availability.performancePenaltyPercent > 0
                          ? ` · −${formatValue(data.availability.performancePenaltyPercent, 1)}%`
                          : ""}
                        {data.availability.injuryRiskPercent > 0
                          ? ` · ${formatValue(data.availability.injuryRiskPercent, 1)}% Verletzungsrisiko`
                          : ""}
                      </span>
                    </div>
                    {newLookEnabled ? (
                      <div className="player-drawer-fatigue-gauge-wrap">
                        <NlFatigueGauge value={data.fatigue ?? 0} title={buildFatigueImpactTooltip(data)} />
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="player-drawer-kpi-hero-grid">
                  {headlineMetrics.map((metric) => {
                    const leagueCategoryId = metric.key;
                    const canOpenLeagueLeaders =
                      onOpenLeagueLeaders != null &&
                      !isFreeAgent &&
                      metric.rank != null &&
                      (leagueCategoryId === "ovr" || leagueCategoryId === "pps" || leagueCategoryId === "mvs");
                    const cardBody = (
                      <>
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
                          {canOpenLeagueLeaders ? (
                            <span className="player-drawer-kpi-link-hint">Liga-Leaders</span>
                          ) : null}
                        </div>
                      </>
                    );

                    return canOpenLeagueLeaders ? (
                      <button
                        key={metric.key}
                        type="button"
                        className="player-drawer-kpi-hero-card is-interactive"
                        title={`Liga-Leaders: ${metric.label} · Rang ${formatRankLabel(metric.rank)}`}
                        onClick={() =>
                          onOpenLeagueLeaders(leagueCategoryId, {
                            playerId: data.playerId,
                            playerName: data.name,
                          })
                        }
                      >
                        {cardBody}
                      </button>
                    ) : (
                      <article key={metric.key} className="player-drawer-kpi-hero-card">
                        {cardBody}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
            {!isFreeAgent && showCompactAxisStrip ? axisStrip : null}
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
            {showFullAxisGrid ? (
              <div className="player-drawer-section-block" id="player-drawer-axis">
                {variant === "page" ? (
                  <p className="muted player-drawer-axis-source">
                    {seasonPerformance?.sourceLabel ?? "keine gespeicherten Season-PPs"}
                    {seasonPerformance?.seasonName ? ` · ${seasonPerformance.seasonName}` : ""}
                  </p>
                ) : null}
                <div className="player-drawer-category-grid player-drawer-hero-axis-grid">
                  {data.axisCards.map((card) => {
                    const canOpenAxisLeaders =
                      onOpenLeagueLeaders != null &&
                      !isFreeAgent &&
                      (card.seasonPointsRank != null || card.valueRank != null);
                    return (
                    <button
                      key={card.id}
                      type="button"
                      className={`player-drawer-category-card player-drawer-category-button player-drawer-axis-combo-card ${getAxisToneClass(card.tone)}${selectedAxisId === card.id ? " is-selected" : ""}${canOpenAxisLeaders ? " is-interactive" : ""}`}
                      onClick={() => {
                        if (isScoutedProfile) return;
                        if (canOpenAxisLeaders) {
                          onOpenLeagueLeaders(card.id, {
                            playerId: data.playerId,
                            playerName: data.name,
                          });
                          return;
                        }
                        setSelectedAxisId(card.id);
                      }}
                      disabled={isScoutedProfile}
                      title={
                        canOpenAxisLeaders
                          ? `Liga-Leaders: ${card.label} · Stat / PPs`
                          : `${card.label}: Statwert und echte Season-PPs jeweils mit Rank`
                      }
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
                    );
                  })}
                </div>
                {selectedAxisCard ? (
                  <div className={`player-drawer-axis-detail-panel ${getAxisToneClass(selectedAxisCard.tone)}`}>
                    <div className="player-drawer-axis-detail-header">
                      <div>
                        <h4>{selectedAxisCard.label} Detail</h4>
                        <p>Top 5 Diszis dieser Achse mit Spielerwert, Einsatzslot, PPs und Mutator-Anteil.</p>
                      </div>
                      <button type="button" className="ghost-button" onClick={() => setSelectedAxisId(null)}>
                        Schließen
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
              </div>
            ) : null}
            <div className="player-drawer-list-grid player-drawer-list-grid-wide">
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
                <span>Avg Beitrag</span>
                <strong>{formatValue(seasonPerformance?.averageContribution, 1)}</strong>
              </article>
            </div>
          </section>

          {variant !== "page" ? (
          <nav className="player-drawer-tabs" aria-label="Spieler Detailbereich">
            <a href="#player-drawer-profile">Profil</a>
            {!isScoutedProfile ? <a href="#player-drawer-axis">Achsen</a> : null}
            <a href="#player-drawer-disciplines">Diszis</a>
            {developmentLevelup || (showScoutedDevelopmentSection && (data.scoutPotential || data.progressionForecast)) ? (
              <a href="#player-drawer-potential">Entwicklung</a>
            ) : null}
            {isFreeAgent && onOpenBuyPreview ? <a href="#player-drawer-market">Transfer</a> : null}
            <a href="#player-drawer-history">Historie</a>
          </nav>
          ) : null}

          <section className="player-drawer-section player-drawer-panel player-drawer-top-disciplines-panel" id="player-drawer-disciplines">
              <h3 title={isScoutedProfile ? "Scouting zeigt nur grobe Klassen der besten Disziplinen. Exakte Diszi-Werte werden nicht gespoilert." : "Beste Disziplinen aus dem aktuellen Spielerprofil."}>Top-Disziplinen</h3>
              {!seasonPerformance && !isScoutedProfile ? <p className="muted">{noSeasonPerformanceMessage}</p> : null}
              <div className="player-drawer-top-disciplines-layout">
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
                            aria-sort={
                              isActiveSort ? (topDisciplineSort.direction === "asc" ? "ascending" : "descending") : "none"
                            }
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
                            {renderTopDisciplineCell(entry, columnId, isScoutedProfile, scoutingLevel, {
                              enabled: newLookEnabled,
                              pool: disciplineHeatPool,
                            })}
                          </td>
                        ))}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!isScoutedProfile ? (
                <aside className="player-drawer-season-snapshot" aria-label="Saison-Snapshot">
                  <div className="player-drawer-season-snapshot-grid">
                    {renderSeasonSnapshotMetricPair({
                      label: "Einsätze",
                      seasonValue: formatValue(seasonSnapshotAppearances),
                      allTimeValue: formatValue(careerSnapshotAppearances),
                    })}
                    {renderSeasonSnapshotMetricPair({
                      label: "Ø Fatigue",
                      seasonValue: seasonSnapshotFatigue != null ? formatValue(seasonSnapshotFatigue, 1) : "—",
                      allTimeValue: careerSnapshotFatigue != null ? formatValue(careerSnapshotFatigue, 1) : "—",
                      title: buildFatigueImpactTooltip(data),
                    })}
                    {renderSeasonSnapshotMetricPair({
                      label: "Verletzungen",
                      seasonValue: formatValue(seasonSnapshotInjuries),
                      allTimeValue: formatValue(careerSnapshotInjuries),
                    })}
                  </div>
                  {seasonSnapshotTopGains.length ? (
                    <div className="player-drawer-chip-row">
                      {seasonSnapshotTopGains.slice(0, 2).map((entry) => (
                        <span key={`snapshot-gain-${entry.attribute}`} className="player-drawer-chip is-positive">
                          {entry.attribute} +{formatValue(entry.delta, 1)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </aside>
              ) : null}
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
            <div className={`player-drawer-attribute-grid${variant === "page" ? " is-compact" : ""}`}>
              {data.attributeStats.map((entry) => {
                const preview = data.attributeVisibility === "exact" ? developmentPreviewByAttribute.get(entry.key) : null;
                const ceilingPreview = data.attributeVisibility === "exact" ? attributeCeilingByKey.get(entry.key as never) : null;
                const aiPlan = data.attributeVisibility === "exact" ? aiDevelopmentPlanByAttribute.get(entry.key) : null;
                const cardAffinity = resolveAttributeCardAffinity(entry.key, developmentLevelup, preview?.affinity);
                const affinityReason =
                  preview?.reason ??
                  (cardAffinity === "signature"
                    ? "Signature-Attribut: +15% organisches Wachstum"
                    : cardAffinity === "weak"
                      ? "Weak-Attribut: -20% organisches Wachstum"
                      : null);
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
                // "Neuer Look" (#61): Mini-Sparkline der realen Attribut-Historie
                // (`attributeHistoryRows` aus Baseline + organischen Progression-
                // Events je Saison). Nur für exakt sichtbare Attribute (eigener
                // Spieler / Scouting maximiert) und nur ab 2 realen Saisonpunkten —
                // bei einer einzigen Saison erscheint schlicht keine Kurve.
                const attributeSparkPoints =
                  newLookEnabled && data.attributeVisibility === "exact" && showExactAttribute
                    ? data.attributeHistoryRows
                        .map((row) => (row.attributes as Partial<Record<string, number>>)[entry.key])
                        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
                    : [];
                const showAttributeSparkline = attributeSparkPoints.length >= 2;
                return (
                  <article
                    key={entry.key}
                    className={`metric-card player-drawer-attribute-card is-affinity-${cardAffinity} ${getAttributeTierClass(entry.ratingLabel)}${!entry.revealed && isScoutedProfile ? " is-scouting-locked" : ""}`}
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
                      {cardAffinity !== "neutral" ? (
                        <span
                          className={`player-drawer-affinity-badge is-${cardAffinity}`}
                          title={affinityReason ?? undefined}
                          aria-label={`${entry.label} ${getAffinityLabel(cardAffinity)}: ${affinityReason ?? ""}`}
                        >
                          {getAffinityIcon(cardAffinity)}
                        </span>
                      ) : null}
                    </span>
                    <strong className={getDeltaToneClass(plannedAttributeDelta)}>
                      {attributePrimaryLabel}
                      {showExactAttribute && plannedAttributeDelta ? ` → ${formatValue(plannedNextValue, 0)}` : ""}
                    </strong>
                    {showAttributeSparkline ? (
                      <span
                        className="is-new-look nl-attr-spark"
                        title={`${entry.label}-Verlauf über ${attributeSparkPoints.length} Saisonpunkte: ${formatValue(
                          attributeSparkPoints[0],
                          0,
                        )} → ${formatValue(attributeSparkPoints[attributeSparkPoints.length - 1], 0)}`}
                      >
                        <NlSparkline
                          points={attributeSparkPoints}
                          tone="accent"
                          aria-label={`${entry.label}: Attribut-Verlauf über Saisons`}
                          className="nl-attr-spark-line"
                        />
                      </span>
                    ) : null}
                    {variant !== "page" ? (
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
                    ) : null}
                    {variant !== "page" && visibleDisciplineDeltas.length ? (
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

          <section className="player-drawer-section player-drawer-panel" id="player-drawer-training-controls">
            <h3>Training</h3>
            {trainingRow && onSetTrainingMode && onSetTrainingClass ? (
              <PlayerTrainingControls
                row={trainingRow}
                trainingModeOptions={trainingModeOptions}
                trainingClassOptions={trainingClassOptions}
                onSetTrainingMode={onSetTrainingMode}
                onSetTrainingClass={onSetTrainingClass}
                readOnly={trainingReadOnly}
              />
            ) : (
              <div className="player-drawer-callout">
                <strong>Kein Kader-Training verfügbar</strong>
                <p className="muted">
                  Trainingssteuerung ist nur für Spieler in steuerbaren Teams verfügbar.
                </p>
                {onOpenTraining ? (
                  <div className="player-drawer-inline-actions">
                    <button className="secondary-button" type="button" onClick={onOpenTraining}>
                      Zum Team-Training
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {data.organicProgression || data.seasonOrganicForecast || data.classHistory.length > 0 ? (
            <section className="player-drawer-section player-drawer-panel">
              <h3>Organische Entwicklung</h3>
              {data.seasonOrganicForecast ? (
                <>
                  <p className="muted player-drawer-section-lead">
                    Prognose aktuelle Saison · Signature +15% / Weak -20% sind in Training und Performance eingerechnet.
                  </p>
                  <div className="player-drawer-list-grid player-drawer-list-grid-wide">
                    <article className="metric-card">
                      <span>Klassen-Prognose</span>
                      <strong>
                        {formatTrainingClassDirection(data.className, data.seasonOrganicForecast.primaryTrainingClass)}
                      </strong>
                      <small>
                        Prognose nach Setpoints: {data.seasonOrganicForecast.classBefore}
                        {data.seasonOrganicForecast.classChanged ? ` → ${data.seasonOrganicForecast.classAfter}` : " (stabil)"}
                      </small>
                    </article>
                    <article className="metric-card">
                      <span>Netto-Setpoints</span>
                      <strong className={getDeltaToneClass(data.seasonOrganicForecast.netSetpoints)}>
                        {data.seasonOrganicForecast.netSetpoints > 0 ? "+" : ""}
                        {formatValue(data.seasonOrganicForecast.netSetpoints, 1)}
                      </strong>
                      <small>
                        {formatOrganicNetSubline({
                          appliedTrainingSetpoints: data.seasonOrganicForecast.appliedTrainingSetpoints,
                          appliedPerformanceSetpoints: data.seasonOrganicForecast.appliedPerformanceSetpoints,
                          regressionCombinedTotal:
                            resolveOrganicRegressionCombinedTotal(data.seasonOrganicForecast) ?? 0,
                        })}
                      </small>
                    </article>
                    <article className="metric-card">
                      <span>Regression</span>
                      <strong className="is-negative">
                        {formatSignedSetpoints(resolveOrganicRegressionCombinedTotal(data.seasonOrganicForecast) ?? 0, 1)}
                      </strong>
                      <small>
                        Basis {formatSignedSetpoints(data.seasonOrganicForecast.regressionBreakdown.baseFlatTotal, 1)} · MW{" "}
                        {formatSignedSetpoints(data.seasonOrganicForecast.regressionBreakdown.marketValueTotal, 1)}
                      </small>
                    </article>
                  </div>
                </>
              ) : null}
              {data.organicProgression ? (
                <>
                  <p className="muted player-drawer-section-lead">
                    Letzte Anwendung · {getCanonicalSeasonLabel({ seasonId: data.organicProgression.seasonId })} — das ist der abgeschlossene Klassenwechsel, nicht die aktuelle Anzeige oben.
                  </p>
                  <div className="player-drawer-list-grid player-drawer-list-grid-wide">
                    <article className="metric-card">
                      <span>Letzter Klassenwechsel</span>
                      <strong>
                        {data.organicProgression.classBefore} → {data.organicProgression.classAfter}
                      </strong>
                      <small>
                        {getCanonicalSeasonLabel({ seasonId: data.organicProgression.seasonId })} · damals Training:{" "}
                        {data.organicProgression.trainingClass}
                      </small>
                    </article>
                    <article className="metric-card">
                      <span>Netto-Setpoints</span>
                      <strong className={getDeltaToneClass(data.organicProgression.netSetpoints)}>
                        {data.organicProgression.netSetpoints > 0 ? "+" : ""}
                        {formatValue(data.organicProgression.netSetpoints, 1)}
                      </strong>
                      <small>
                        {formatOrganicNetSubline({
                          appliedTrainingSetpoints:
                            data.organicProgression.appliedTrainingSetpoints ?? data.organicProgression.trainingSetpoints,
                          appliedPerformanceSetpoints:
                            data.organicProgression.appliedPerformanceSetpoints ?? data.organicProgression.performanceSetpoints,
                          regressionCombinedTotal:
                            resolveOrganicRegressionCombinedTotal(data.organicProgression) ?? -data.organicProgression.marketValuePressureTotal,
                        })}
                      </small>
                    </article>
                    <article className="metric-card">
                      <span>Regression</span>
                      <strong className="is-negative">
                        {formatSignedSetpoints(
                          resolveOrganicRegressionCombinedTotal(data.organicProgression) ??
                            -data.organicProgression.marketValuePressureTotal,
                          1,
                        )}
                      </strong>
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
                    <span title="Positive Traits erhöhen das Trainingsbudget, negative Traits bremsen es.">
                      <strong>
                        Traits {data.organicProgression.traitModifierPct > 0 ? "+" : ""}
                        {formatValue(data.organicProgression.traitModifierPct, 1)}%
                      </strong>
                      <small>Bonus/Malus wirkt auf organisches Wachstum</small>
                    </span>
                    <span title="Signature-Attribute bekommen +15% organisches Wachstum.">
                      <strong>Signature</strong>
                      <small>{developmentLevelup?.affinity.signatureAttributes.join(" / ") || data.seasonOrganicForecast?.attributeAffinity.signatureAttributes.join(" / ") || "Spielerprofil"}</small>
                    </span>
                    <span title="Weak-Attribut entwickelt sich mit -20% langsamer.">
                      <strong>Weak</strong>
                      <small>{developmentLevelup?.affinity.weakAttribute ?? data.seasonOrganicForecast?.attributeAffinity.weakAttribute ?? "Profil offen"}</small>
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
            <section className="player-drawer-section player-drawer-panel" id="player-drawer-potential">
              <h3 title="Kurzfassung: Potential und Entwicklungsroute. Details können aufgeklappt werden.">Potential & Entwicklung</h3>
              <div className="player-drawer-list-grid player-drawer-list-grid-wide">
                {showOwnPotentialSnapshot ? (
                  <article className="metric-card player-drawer-scout-potential-card" title="Achsen-Potential mit Saison-Delta und Route-Status für den eigenen Kader.">
                    <HelpLabel title="PO = geschätzte Achsen-Decke. Delta zeigt die Veränderung seit der letzten Saison.">Achsen-Potential</HelpLabel>
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
                  <article className="metric-card player-drawer-scout-potential-card" title="Potential ist eine gescoutete Spanne, nicht garantiert. Current ist der aktuelle Leistungswert, Gap ist der Abstand zum geschätzten Potential. Je niedriger Confidence, desto unsicherer die Spanne.">
                    <HelpLabel title="Potential-Spanne = geschätzter Zielbereich. Current = aktueller Stand. Gap = mögliche Entwicklung. Confidence zeigt, wie sicher das Scouting ist.">Potential</HelpLabel>
                    <strong>
                      {formatDevelopmentRange(data.developmentInsight)}{" "}
                      {showScoutedPotentialStars ? (
                        <ScoutStarDisplay
                          axisDisplay={data.potentialStarsDisplay}
                          starRating={data.scoutPotential?.starRating}
                          starRangeMin={
                            data.developmentInsight?.potentialRangeDisplay?.min ??
                            data.scoutPotential?.potentialRange?.min ??
                            null
                          }
                          starRangeMax={
                            data.developmentInsight?.potentialRangeDisplay?.max ??
                            data.scoutPotential?.potentialRange?.max ??
                            null
                          }
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
                {data.seasonOrganicForecast && !data.organicProgression ? (
                  <article
                    className="metric-card player-drawer-xp-balance-card"
                    title="Organische Saison-Prognose: Setpoints aus Training, Performance und Erhaltungsdruck — das ist die verbindliche Entwicklungslogik."
                  >
                    <HelpLabel title="Netto-Setpoints = angewandtes Training + Performance + Regression (Basis + Marktwert). Das ist die Hauptzahl für organische Entwicklung.">
                      Saison-Prognose (Setpoints)
                    </HelpLabel>
                    <div className="player-drawer-xp-balance-grid">
                      <span>
                        <small>Training</small>
                        <strong>+{formatValue(data.seasonOrganicForecast.appliedTrainingSetpoints, 1)}</strong>
                      </span>
                      <span>
                        <small>Performance</small>
                        <strong>+{formatValue(data.seasonOrganicForecast.appliedPerformanceSetpoints, 1)}</strong>
                      </span>
                      <span>
                        <small>Regression</small>
                        <strong className="is-negative">
                          {formatSignedSetpoints(resolveOrganicRegressionCombinedTotal(data.seasonOrganicForecast) ?? 0, 1)}
                        </strong>
                      </span>
                      <span>
                        <small>Netto</small>
                        <strong className={getDeltaToneClass(data.seasonOrganicForecast.netSetpoints)}>
                          {data.seasonOrganicForecast.netSetpoints > 0 ? "+" : ""}
                          {formatValue(data.seasonOrganicForecast.netSetpoints, 1)}
                        </strong>
                      </span>
                    </div>
                    <small>
                      {formatTrainingClassDirection(data.className, data.seasonOrganicForecast.primaryTrainingClass)}
                      {data.seasonOrganicForecast.classChanged ? ` · Prognose ${data.seasonOrganicForecast.classAfter}` : ""}
                    </small>
                  </article>
                ) : null}
              </div>
              {showScoutedDeepDevelopmentDetails ? (
                <details className="player-drawer-compact-details">
                  <summary>Mehr Entwicklungsdetails</summary>
                  <div className="player-drawer-compact-details-grid">
                    {data.progressionForecast ? (
                      <>
                        <article className="metric-card">
                          <HelpLabel title="CA = aktueller Stand. PO = geschätztes Potential. Je größer der Abstand, desto mehr Upside.">CA / PO</HelpLabel>
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
                {(!isScoutedProfile || scoutingLevel >= 4) && data.developmentInsight?.recommendation ? (
                  <p className="muted">{data.developmentInsight.recommendation}</p>
                ) : null}
            </section>
          ) : null}

          {werdegangSeries ? (
            <section className="player-drawer-section player-drawer-panel" id="player-drawer-werdegang">
              <WerdegangPanel
                variant="player"
                entityName={data.name}
                series={werdegangSeries}
                onOpenLeagueLeaders={onOpenLeagueLeaders}
              />
            </section>
          ) : null}

          <section className="player-drawer-section player-drawer-panel" id="player-drawer-training-progress">
            {variant !== "page" ? <PlayerAttributeProgressChart historyRows={data.historyRows} attributeHistoryRows={data.attributeHistoryRows} classHistory={data.classHistory} progressionEvents={data.progressionEvents} /> : null}
          </section>

          <section className="player-drawer-section player-drawer-panel" id="player-drawer-market">
            <h3>{isFreeAgent ? "Transfer" : "Vertrag"}</h3>
            {isFreeAgent && onOpenBuyPreview ? (
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
            ) : (
              <div className="player-drawer-contract-summary" data-testid="player-drawer-contract-summary">
                <p className="muted">
                  Laufzeit {data.contractLength ?? "—"}
                  {formatContractShapeShortLabel(data.contractShape) ? ` · ${formatContractShapeShortLabel(data.contractShape)}` : ""}
                  {data.morale ? ` · Verlängerung: ${formatMoraleContractIntent(data.morale.contractIntent)}` : ""}
                </p>
              </div>
            )}
          </section>

          <section className="player-drawer-section player-drawer-panel" id="player-drawer-history">
            <h3>Historie</h3>
            {/* D5 "Karriere-Story-Header" ("Neuer Look", flag-gated, additiv):
                kompakter Story-Streifen (Peak-OVR, größter Sprung, Longevity,
                letzter Trend) aus den bereits archivierten Saison-Metriken —
                führt die Karriere-/Entwicklungs-Sektion an. Mit Flag OFF
                unverändert. */}
            {newLookEnabled ? <PlayerCareerStoryHeader historyRows={data.historyRows} /> : null}
            {/* Entwicklung über Seasons gehört zur Karriere-Sektion (nicht zu
                "Stats"): die Stat-Entwicklungskurve führt hier den saison-
                weisen Verlauf an. */}
            {variant === "page" && data.historyRows.length >= 2 ? (
              <div className="player-drawer-stats-chart">
                <h3>Stat-Entwicklung über Seasons</h3>
                <PlayerAttributeProgressChart historyRows={data.historyRows} attributeHistoryRows={data.attributeHistoryRows} classHistory={data.classHistory} progressionEvents={data.progressionEvents} />
              </div>
            ) : null}
            {data.injurySummary.totalInjuries > 0 ? (
              <p className="player-drawer-injury-summary muted" data-testid="player-drawer-injury-summary">
                {data.injurySummary.totalInjuries} Verletzung{data.injurySummary.totalInjuries === 1 ? "" : "en"} ·{" "}
                {data.injurySummary.totalMatchdaysMissed} Spieltag
                {data.injurySummary.totalMatchdaysMissed === 1 ? "" : "e"} ausgefallen ·{" "}
                {data.injurySummary.seasonsAffected} Saison{data.injurySummary.seasonsAffected === 1 ? "" : "en"} betroffen
              </p>
            ) : null}
            {data.historyRows.length > 0 ? (
              <>
                <PlayerDrawerHistoryTable
                  rows={data.historyRows}
                  getHeaderTooltip={(columnId) => {
                    if (columnId === "abloese") return PLAYER_DRAWER_HISTORY_ABLOESE_TOOLTIP;
                    if (columnId === "averageFatigue") return PLAYER_DRAWER_HISTORY_AVERAGE_FATIGUE_TOOLTIP;
                    return undefined;
                  }}
                  renderCell={(columnId, row) => {
                    if (columnId === "season") {
                      return (
                        <>
                          <strong>{row.seasonName}</strong>
                          {row.isActiveSeason ? <small className="player-drawer-history-tag">live</small> : null}
                        </>
                      );
                    }
                    if (columnId === "team") return row.teamCode ?? row.teamName ?? "—";
                    if (columnId === "appearances") return formatValue(row.appearances);
                    if (columnId === "averageFatigue") {
                      return row.averageFatigue != null ? (
                        <span title={PLAYER_DRAWER_HISTORY_AVERAGE_FATIGUE_TOOLTIP}>{formatValue(row.averageFatigue, 1)}</span>
                      ) : (
                        "—"
                      );
                    }
                    if (columnId === "injuriesCount") return formatValue(row.injuriesCount);
                    if (columnId === "matchdaysMissed") return formatValue(row.matchdaysMissed);
                    if (columnId === "pps") return formatHistoryMetric(row.pps ?? row.totalPoints, row.ppsRank, 1);
                    if (columnId === "ovr") return formatHistoryMetric(row.ovr, row.ovrRank, 1);
                    if (columnId === "mvs") return formatHistoryMetric(row.mvs, row.mvsRank, 1);
                    if (columnId === "pow") return formatValue(row.pow, 1);
                    if (columnId === "spe") return formatValue(row.spe, 1);
                    if (columnId === "men") return formatValue(row.men, 1);
                    if (columnId === "soc") return formatValue(row.soc, 1);
                    if (isSeasonDisciplineKey(columnId)) {
                      return formatValue(row.disciplineValues[columnId], 1);
                    }
                    if (columnId === "abloese") {
                      return row.projectedSellValue != null ? (
                        <span title={PLAYER_DRAWER_HISTORY_ABLOESE_TOOLTIP}>{formatMoney(row.projectedSellValue)}</span>
                      ) : (
                        "—"
                      );
                    }
                    if (columnId === "mw") {
                      return (
                        <span
                          className={getMoneyDeltaToneClass(row.marketValueBaselineDelta, "higher")}
                          title="Marktwert mit Veränderung gegenüber Kaufpreis (Fallback: Season-0-Baseline)."
                        >
                          {formatMoneyWithBaselineDelta(row.marketValue, row.marketValueBaselineDelta)}
                        </span>
                      );
                    }
                    if (columnId === "factor") {
                      return (
                        <span title={row.projectedSellSourceLabel ?? undefined}>
                          {formatMoneyFactor(
                            row.projectedSellFactor ?? row.transferMarketValueFactor,
                            row.saleFactorRankInBracket,
                            row.saleFactorBracketSize,
                          )}
                        </span>
                      );
                    }
                    if (columnId === "salary") return formatMoney(row.salary);
                    if (columnId === "contractLength") return formatValue(row.contractLength);
                    if (columnId === "bestDiscipline") return row.bestDisciplineLabel ?? "—";
                    return "—";
                  }}
                />
                <p className="muted" style={{ marginTop: 10 }}>
                  Alte Seasons kommen aus gespeicherten Season-Snapshots. Fehlende Felder bedeuten: der damalige Snapshot
                  wurde noch vor der vollständigen Spieler-Metric-Archivierung erstellt.
                </p>
                {marketValueHistoryRows.length > 0 ? (
                  <div className="player-drawer-injury-history" data-testid="player-drawer-market-value-history">
                    <h4>Marktwert-Verlauf</h4>
                    <div className="table-shell player-drawer-injury-history-shell">
                      <table className="team-table player-drawer-injury-history-table">
                        <thead>
                          <tr>
                            <th>Saison</th>
                            <th>Marktwert</th>
                            <th>Delta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marketValueHistoryRows.map((row) => (
                            <tr key={`market-value-history-${row.seasonId}`}>
                              <td>{row.seasonName}</td>
                              <td>{formatMoney(row.marketValue)}</td>
                              <td className={getMoneyDeltaToneClass(row.marketValueBaselineDelta, "higher")}>
                                {row.marketValueBaselineDelta != null ? formatSignedMoney(row.marketValueBaselineDelta) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="player-drawer-callout">
                <strong>Noch keine Historie</strong>
                <p className="muted">Nach dem ersten Saisonabschluss erscheinen hier PPs, OVR, MVS, Achsenpunkte und Vertragswerte.</p>
              </div>
            )}

            {data.injuryHistoryRows.length > 0 ? (
              <div className="player-drawer-injury-history" data-testid="player-drawer-injury-history">
                <h4>Verletzungshistorie</h4>
                <div className="table-shell player-drawer-injury-history-shell">
                  <table className="team-table player-drawer-injury-history-table">
                    <thead>
                      <tr>
                        <th>Saison</th>
                        <th>Spieltag</th>
                        <th>Fatigue</th>
                        <th>Risiko</th>
                        <th>Ausfall bis</th>
                        <th>Recovery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.injuryHistoryRows.map((row) => (
                        <tr key={row.eventId}>
                          <td>{row.seasonName ?? row.seasonId}</td>
                          <td>{row.matchdayLabel ?? row.matchdayId}</td>
                          <td>{formatValue(row.fatigueBefore, 0)}</td>
                          <td>{formatValue(row.riskPercent, 0)}%</td>
                          <td>{row.unavailableUntil ?? "—"}</td>
                          <td>{formatValue(row.injuryRecoveryPct, 0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="player-drawer-training-history-block" id="player-drawer-training-history">
              <h4>Trainingshistorie</h4>
              {data.trainingHistoryRows.length > 0 ? (
                <div className="table-shell player-drawer-training-history-shell">
                  <table className="team-table player-drawer-training-history-table">
                    <thead>
                      <tr>
                        <th>S</th>
                        <th>Klasse</th>
                        <th>Mod.</th>
                        <th>Tr.</th>
                        <th>Netto</th>
                        {trainingAttributeColumns.map((attribute) => (
                          <th key={`training-attr-${attribute}`} className="is-attribute-col" title={attribute}>
                            {formatTrainingAttributeLabel(attribute)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.trainingHistoryRows.map((row) => (
                        <tr key={row.eventId}>
                          <td>{formatTrainingSeasonLabel(row.seasonId)}</td>
                          <td>
                            {row.trainingClass ?? "—"}
                            {row.classBefore && row.classAfter && row.classBefore !== row.classAfter
                              ? ` (${row.classBefore}→${row.classAfter})`
                              : ""}
                          </td>
                          <td title={row.trainingMode ?? undefined}>{formatTrainingModeShort(row.trainingMode)}</td>
                          <td className={getDeltaToneClass(row.traitModifierPct)}>
                            {row.traitModifierPct != null && Number.isFinite(row.traitModifierPct)
                              ? `${row.traitModifierPct > 0 ? "+" : ""}${formatValue(row.traitModifierPct, 0)}%`
                              : "—"}
                          </td>
                          <td className={getDeltaToneClass(row.netSetpoints)}>
                            {row.netSetpoints != null ? `${row.netSetpoints > 0 ? "+" : ""}${formatValue(row.netSetpoints, 1)}` : "—"}
                          </td>
                          {trainingAttributeColumns.map((attribute) => {
                            const upgrade = row.upgrades.find((entry) => entry.attribute === attribute) ?? null;
                            return (
                              <td
                                key={`${row.eventId}-${attribute}`}
                                className={`is-attribute-col ${getDeltaToneClass(upgrade?.delta ?? null)}`}
                                title={
                                  upgrade
                                    ? `${attribute}: ${formatValue(upgrade.fromValue, 1)} → ${formatValue(upgrade.toValue, 1)}`
                                    : undefined
                                }
                              >
                                {upgrade
                                  ? `${upgrade.delta > 0 ? "+" : ""}${formatValue(upgrade.delta, 1)}`
                                  : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">
                  Noch keine Trainingshistorie. Nach Saisonabschluss erscheinen hier Trainingsklasse, Modus und Attributänderungen.
                </p>
              )}
            </div>

            <div className="player-drawer-transfer-history-block" id="player-drawer-transfer-history">
              <h4>Transferhistorie</h4>
              {data.transferHistory.length > 0 ? (
                <PlayerDrawerTransferHistoryTable
                  rows={data.transferHistory}
                  renderCell={(columnId, entry) => {
                    if (columnId === "season") return entry.seasonLabel;
                    if (columnId === "date") return formatTransferHistoryDate(entry.happenedAt);
                    if (columnId === "type") return formatHistoryTransferType(entry.transferType) ?? "—";
                    if (columnId === "from") {
                      return entry.fromTeamId && onOpenTeam ? (
                        <button type="button" className="table-link-button" onClick={() => onOpenTeam(entry.fromTeamId!)}>
                          {entry.fromTeamName ?? entry.fromTeamId}
                        </button>
                      ) : (
                        entry.fromTeamName ?? "—"
                      );
                    }
                    if (columnId === "to") {
                      return entry.toTeamId && onOpenTeam ? (
                        <button type="button" className="table-link-button" onClick={() => onOpenTeam(entry.toTeamId!)}>
                          {entry.toTeamName ?? entry.toTeamId}
                        </button>
                      ) : (
                        entry.toTeamName ?? "—"
                      );
                    }
                    if (columnId === "fee") return formatMoney(entry.fee);
                    if (columnId === "salary") return formatMoney(entry.salary);
                    if (columnId === "mw") return formatMoney(entry.marketValue);
                    return "—";
                  }}
                />
              ) : (
                <p className="muted">Keine Transfers für diesen Spieler im Save.</p>
              )}
            </div>
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
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        {profileContent}
      </aside>
    </div>
  );
}
