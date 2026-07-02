"use client";

import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import {
  getConfirmedTierStyle,
  type TransfermarktTier,
} from "@/lib/market/transfermarkt-formatting-contract";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";

function abbreviateDisciplineName(value: string) {
  const normalized = value.trim();
  return (normalized.length > 0 ? normalized : "—").slice(0, 3).toLocaleUpperCase("de");
}

export function formatTopDisciplineScores(item: TransfermarktFreeAgentItem) {
  if (item.topDisciplineScores.length === 0) {
    return "—";
  }

  return (
    <div className="transfermarkt-top-diszi-list transfermarkt-top-diszi-list-compact" aria-label="Top-Diszis mit Scouting-Score">
      <span className="transfermarkt-top-diszi-head">Diszi</span>
      <span className="transfermarkt-top-diszi-head">Score</span>
      {item.topDisciplineScores.map((entry) => (
        <span className="transfermarkt-top-diszi-row" key={entry.disciplineId}>
          <span title={entry.disciplineName}>{abbreviateDisciplineName(entry.disciplineName)}</span>
          <strong style={getConfirmedTierStyle(entry.scoreTier)}>{entry.scoreTier ?? "—"}</strong>
        </span>
      ))}
    </div>
  );
}

function formatPotentialRange(item: TransfermarktFreeAgentItem) {
  if (!item.potentialRange) {
    return "Range —";
  }
  return `${item.potentialRange.min}-${item.potentialRange.max}`;
}

export function renderTransfermarktPotential(item: TransfermarktFreeAgentItem) {
  const hasWarning = item.scoutingWarnings.length > 0 || item.potentialBand === "unknown";
  return (
    <div className="transfermarkt-scouting-cell" title={item.scoutingWarnings.join(" · ") || "Scouting Range und Confidence"}>
      <strong className={`transfermarkt-scouting-badge transfermarkt-scouting-badge-${item.potentialBand}`}>
        {item.potentialTier ?? "?"}
      </strong>
      <span>{formatPotentialRange(item)}</span>
      <small className={hasWarning ? "negative" : "muted"}>
        {item.scoutingConfidence == null ? "Conf —" : `${item.scoutingConfidence}% Conf`}
      </small>
    </div>
  );
}

export function formatMarketDevelopmentTrend(value: string | null | undefined) {
  switch (value) {
    case "strong_positive":
      return "++";
    case "positive":
      return "+";
    case "neutral":
      return "0";
    case "negative":
      return "-";
    case "strong_negative":
      return "--";
    default:
      return "—";
  }
}

export function formatMarketDevelopmentRoute(value: string | null | undefined) {
  switch (value) {
    case "star_growth":
      return "Star Growth";
    case "core_growth":
      return "Core Growth";
    case "depth_growth":
      return "Depth Growth";
    case "prospect_growth":
      return "Prospect";
    case "maintenance":
      return "Maintenance";
    case "stagnation_watch":
      return "Stagnation";
    case "free_agent_ambient":
      return "FA Scout";
    default:
      return "—";
  }
}

export function formatMarketRisk(value: string | null | undefined) {
  switch (value) {
    case "none":
      return "kein";
    case "low":
      return "niedr.";
    case "medium":
      return "mittel";
    case "high":
      return "hoch";
    default:
      return "—";
  }
}

function normalizeMarketTier(value: string | null | undefined): TransfermarktTier | null {
  const normalized = value === "99" ? "S+" : value;
  return normalized === "S+" ||
    normalized === "S" ||
    normalized === "A" ||
    normalized === "B" ||
    normalized === "C" ||
    normalized === "D" ||
    normalized === "E" ||
    normalized === "F"
    ? normalized
    : null;
}

export function getMarketTierStyle(value: string | null | undefined) {
  return getConfirmedTierStyle(normalizeMarketTier(value));
}

export function formatFitDisplay(item: TransfermarktFreeAgentItem) {
  if (!item.teamContextAvailable) {
    return "Team waehlen";
  }

  if (item.mercenary) {
    return `${formatLocalePoints(item.fit, 1)} · Mercenary`;
  }

  return formatLocalePoints(item.fit, 1);
}

export function renderPillValue(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return <span className="pill">{value}</span>;
}

export function renderMarketTraitList(item: TransfermarktFreeAgentItem) {
  const traits = [
    ...item.traitsPositive.map((trait) => ({ trait, tone: "positive" as const })),
    ...item.traitsNegative.map((trait) => ({ trait, tone: "negative" as const })),
  ];

  if (traits.length === 0) {
    return "—";
  }

  return (
    <span className="transfermarkt-trait-list">
      {traits.map(({ trait, tone }) => (
        <span key={`${tone}-${trait}`} className={`pill transfermarkt-trait-pill transfermarkt-trait-pill-${tone}`}>
          {tone === "positive" ? "+" : "-"} {trait}
        </span>
      ))}
    </span>
  );
}
