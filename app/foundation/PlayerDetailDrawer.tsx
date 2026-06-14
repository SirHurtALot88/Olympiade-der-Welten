"use client";

import { useEffect } from "react";

import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";

import { getClassColorClassName } from "./ClassColorChip";
import ClassIcon from "./ClassIcon";
import DisciplineIcon from "./DisciplineIcon";
import RaceIcon from "./RaceIcon";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

function formatValue(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatMoney(value)}`;
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
  if (value === "prospect") {
    return "Prospect";
  }
  return value;
}

function getDisciplineHeatClass(rank: number | null | undefined) {
  if (rank == null) {
    return "";
  }
  if (rank <= 3) {
    return "is-top";
  }
  if (rank <= 8) {
    return "is-strong";
  }
  return "is-neutral";
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

function formatRankLabel(rank: number | null | undefined) {
  return rank == null ? "#" : `#${rank}`;
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
      return "Growth";
    case "stable":
      return "Stable";
    case "stagnation":
      return "Stagnation";
    case "regression_risk":
      return "Regression Risk";
    default:
      return "—";
  }
}

function formatCompactSeasonLabel(value: string | null | undefined) {
  const canonical = getCanonicalSeasonLabel({ seasonName: value ?? null });
  const match = canonical.match(/Season\s+(\d+)/i);
  return match?.[1] ?? canonical;
}

export default function PlayerDetailDrawer({
  data,
  onClose,
  onOpenBuyPreview,
}: {
  data: PlayerDetailDrawerData | null;
  onClose: () => void;
  onOpenBuyPreview?: (player: {
    playerId: string;
    name: string;
    className: string | null;
    race: string | null;
  }) => void;
}) {
  useEffect(() => {
    if (!data) {
      return undefined;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [data, onClose]);

  if (!data) {
    return null;
  }

  const seasonPerformance = data.seasonPerformance;
  const hasSeasonPerformance = seasonPerformance != null;
  const transferContext = data.transferContext;
  const isFreeAgent = data.transferStatus.toLowerCase().includes("free");
  const noSeasonPerformanceMessage = isFreeAgent
    ? "Keine gespeicherte Season-Performance."
    : "Aktiver Spieler, aber noch kein gespeicherter Season-Einsatz.";
  const topDisciplineCards = data.disciplineValues.slice(0, 5);
  const baselineAttributeDeltas = data.baselineAttributeDeltas.filter((entry) => entry.delta != null && entry.delta !== 0);
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

  return (
    <div className="player-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className={`player-drawer player-drawer-dashboard ${getClassColorClassName(data.className, "player-drawer-class-frame")}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${data.name} Details`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="player-drawer-header">
          <div className="player-drawer-hero">
            {data.portraitUrl ? (
              <img className="player-drawer-portrait player-drawer-portrait-large" src={data.portraitUrl} alt={data.name} />
            ) : (
              <div className="player-drawer-portrait player-drawer-portrait-large player-drawer-portrait-placeholder">{buildInitials(data.name)}</div>
            )}
            <div className="player-drawer-headline player-drawer-headline-rich">
              <div className="player-drawer-meta-line">
                <span className={`transfer-status-pill${getTransferStatusTone(data.transferStatus)}`}>{data.transferStatus}</span>
                <span className="player-drawer-source-chip">{data.sourceLabel}</span>
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
              </div>
            </div>
          </div>
          <button className="secondary-button inline-button" type="button" onClick={onClose}>
            Schliessen
          </button>
        </div>

        <div className="player-drawer-body">
          <section className="player-drawer-section player-drawer-hero-surface">
            <div className="player-drawer-top-grid">
              <div className="player-drawer-profile-stack">
                <div className="player-drawer-profile-card">
                  <span className="player-drawer-overline">Scouting-Profil</span>
                  <h3>{data.teamName ?? "Free Agent"}</h3>
                  <p className="player-drawer-subline">
                    {formatRoleTag(transferContext.roleTag)}
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
                  </div>
                  <div className="player-drawer-mini-facts">
                    <span>PPs Rating {formatValue(data.ppsRating, 1)}</span>
                    <span>Scout RTG {formatDevelopmentRange(data.developmentInsight)}</span>
                    <span>{data.developmentInsight?.potentialLabel ?? data.scoutPotential?.starRating ?? "—"}</span>
                    <span>Fatigue {formatValue(data.fatigue, 0)}</span>
                    <span>Form {formatValue(data.form, 0)}</span>
                  </div>
                </div>
              </div>
              <div className="player-drawer-kpi-hero-grid">
                {headlineMetrics.map((metric) => (
                  <article key={metric.key} className="player-drawer-kpi-hero-card">
                    <div className="player-drawer-kpi-header">
                      <span>{metric.label}</span>
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
            </div>
            <div className="player-drawer-list-grid player-drawer-list-grid-wide">
              <article className="metric-card">
                <span>Marktwert</span>
                <strong>{formatMoney(data.marketValue)}</strong>
              </article>
              <article className="metric-card">
                <span>Gehalt</span>
                <strong>{formatMoney(data.salary)}</strong>
              </article>
              <article className="metric-card">
                <span>Vertrag / LZ</span>
                <strong>{data.contractLength ?? "—"}</strong>
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
              {data.scoutPotential ? (
                <article className="metric-card player-drawer-scout-potential-card">
                  <span>Potential / Scouting</span>
                  <strong>
                    {formatDevelopmentRange(data.developmentInsight)} · {data.developmentInsight?.potentialLabel ?? data.scoutPotential.starRating}
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
                  <small>
                    Route {data.developmentInsight?.developmentRoute ?? "—"} · Growth x{data.scoutPotential.trainingSpeedMultiplier.toFixed(2)} · MW Preview{" "}
                    {data.scoutPotential.marketValuePotentialPremiumPct > 0 ? "+" : ""}
                    {formatValue(data.scoutPotential.marketValuePotentialPremiumPct, 1)}%
                  </small>
                  {data.developmentInsight?.reasonChips?.length ? (
                    <div className="player-drawer-chip-row">
                      {data.developmentInsight.reasonChips.slice(0, 6).map((chip) => (
                        <span key={`potential-chip-${chip}`} className="player-drawer-chip">
                          {chip}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {data.developmentInsight?.recommendation ? <small>{data.developmentInsight.recommendation}</small> : null}
                </article>
              ) : null}
              <article className="metric-card">
                <span>Einsätze</span>
                <strong>{hasSeasonPerformance ? seasonPerformance.appearances : "—"}</strong>
              </article>
              <article className="metric-card">
                <span>Season Punkte</span>
                <strong>{formatValue(seasonPerformance?.totalPoints, 1)}</strong>
              </article>
              <article className="metric-card">
                <span>Avg Beitrag</span>
                <strong>{formatValue(seasonPerformance?.averageContribution, 1)}</strong>
              </article>
              {data.progressionForecast ? (
                <>
                  <article className="metric-card">
                    <span>Netto-XP</span>
                    <strong className={getDeltaToneClass(data.progressionForecast.netDevelopmentXP)}>
                      {formatValue(data.progressionForecast.netDevelopmentXP, 0)}
                    </strong>
                    <small>{formatDevelopmentTrend(data.progressionForecast.xpTrend)}</small>
                  </article>
                  <article className="metric-card">
                    <span>XP frei / spent</span>
                    <strong>
                      {formatValue(data.progressionForecast.currentXP, 0)} / {formatValue(data.progressionForecast.spentXP, 0)}
                    </strong>
                  </article>
                  <article className="metric-card">
                    <span>Training Form</span>
                    <strong>{data.progressionForecast.trainingFormTier}</strong>
                    <small>{formatSourceFreeDetail(data.progressionForecast.trainingMode)}</small>
                  </article>
                  <article className="metric-card">
                    <span>CA / PO</span>
                    <strong>
                      {data.progressionForecast.currentAbilityStars ?? "—"} / {data.progressionForecast.potentialStars ?? "—"}
                    </strong>
                    <small>
                      {data.progressionForecast.currentAbilityTier ?? "—"} → {data.progressionForecast.potentialTier ?? "—"}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Regression Risk</span>
                    <strong>{formatRegressionRisk(data.progressionForecast.regressionRisk)}</strong>
                    <small>{formatDevelopmentRoute(data.progressionForecast.developmentRoute)}</small>
                  </article>
                  <article className="metric-card">
                    <span>Upgrade Range</span>
                    <strong>{data.progressionForecast.possibleUpgradeSummary}</strong>
                  </article>
                </>
              ) : null}
            </div>
          </section>

          <section className="player-drawer-section">
            <h3>POW / SPE / MEN / SOC</h3>
            <div className="player-drawer-category-grid">
              {data.axisCards.map((card) => (
                <article key={card.id} className={`player-drawer-category-card ${getAxisToneClass(card.tone)}`}>
                  <div className="player-drawer-category-head">
                    <span>{card.label}</span>
                    <span>{formatRankLabel(card.valueRank)}</span>
                  </div>
                  <strong>{formatValue(card.value, 0)}</strong>
                  <div className="player-drawer-category-meter">
                    <div
                      className="player-drawer-category-meter-fill"
                      style={{ width: `${Math.max(0, Math.min(100, card.value ?? 0))}%` }}
                    />
                  </div>
                  <div className="player-drawer-category-meta">
                    <span>Profilwert</span>
                    <span>{formatRankLabel(card.valueRank)}</span>
                  </div>
                </article>
              ))}
            </div>
            <h3>Reale Season-PPs</h3>
            <p className="muted">
              Quelle: {seasonPerformance?.sourceLabel ?? "keine gespeicherten Season-PPs"}
              {seasonPerformance?.seasonName ? ` · ${seasonPerformance.seasonName}` : ""}
            </p>
            <div className="player-drawer-category-grid">
              {data.axisCards.map((card) => (
                <article key={`season-pps-${card.id}`} className={`player-drawer-category-card ${getAxisToneClass(card.tone)}`}>
                  <div className="player-drawer-category-head">
                    <span>{card.label} PPs</span>
                    <span>{formatRankLabel(card.seasonPointsRank)}</span>
                  </div>
                  <strong>{formatValue(card.seasonPoints, 1)}</strong>
                  <div className="player-drawer-category-meter">
                    <div
                      className="player-drawer-category-meter-fill"
                      style={{ width: `${Math.max(0, Math.min(100, (card.seasonPoints ?? 0) * 2))}%` }}
                    />
                  </div>
                  <div className="player-drawer-category-meta">
                    <span>echte PPs</span>
                    <span>PP {formatRankLabel(card.seasonPointsRank)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="player-drawer-two-column-grid">
            <section className="player-drawer-section player-drawer-panel">
              <h3>Season Performance</h3>
              {seasonPerformance ? (
                <>
                  <div className="player-drawer-discipline-pill-grid">
                    {topDisciplineCards.length > 0 ? (
                      topDisciplineCards.map((entry) => (
                        <article
                          key={`top-discipline-${entry.id}`}
                          className={`metric-card player-drawer-discipline-card ${getDisciplineHeatClass(entry.rank)}`}
                        >
                          <span><DisciplineIcon disciplineId={entry.id} label={entry.label} className="discipline-icon-chip-inline" /></span>
                          <strong>{formatDisciplineValue(entry.value, entry.upgradeDelta)}</strong>
                          <small>
                            {formatRankLabel(entry.rank)}
                            {entry.playerCount != null ? ` · ${entry.playerCount} Slots` : ""}
                            {entry.lastSeasonPoints != null
                              ? ` · letzte Season ${formatValue(entry.lastSeasonPoints, 1)} PPs`
                              : entry.seasonPoints != null
                                ? ` · ${formatValue(entry.seasonPoints, 1)} PPs`
                                : ""}
                          </small>
                        </article>
                      ))
                    ) : (
                      <p className="muted">—</p>
                    )}
                  </div>
                  {seasonPerformance.warnings.length ? (
                    <ul className="warning-list compact-list">
                      {seasonPerformance.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <div className="player-drawer-callout">
                  <strong>Season Performance</strong>
                  <p>{noSeasonPerformanceMessage}</p>
                  <p className="muted">
                    Einsätze, Season-Punkte und Diszi-Beiträge erscheinen erst mit echten gespeicherten Results oder
                    Snapshots.
                  </p>
                </div>
              )}
            </section>

            <section className="player-drawer-section player-drawer-panel">
              <h3>Top-Disziplinen</h3>
              <div className="table-shell player-drawer-breakdown-table-shell">
                <table className="team-table player-drawer-breakdown-table">
                  <thead>
                    <tr>
                      <th>Diszi</th>
                      <th>Wert</th>
                      <th>Rank</th>
                      <th>PPs letzte Season</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDisciplineCards.map((entry) => (
                      <tr key={`discipline-breakdown-${entry.id}`}>
                        <td>
                          <DisciplineIcon disciplineId={entry.id} label={entry.label} className="discipline-icon-chip-inline" />
                          {entry.playerCount != null ? ` (${entry.playerCount})` : ""}
                        </td>
                        <td>{formatDisciplineValue(entry.value, entry.upgradeDelta)}</td>
                        <td>{formatRankLabel(entry.rank)}</td>
                        <td>
                          {formatValue(entry.lastSeasonPoints ?? entry.seasonPoints, 1)}
                          {(entry.lastSeasonAppearances ?? entry.seasonAppearances) != null
                            ? ` / ${entry.lastSeasonAppearances ?? entry.seasonAppearances} Eins.`
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="player-drawer-section player-drawer-panel">
            <h3>Attribute</h3>
            <div className="player-drawer-attribute-grid">
              {data.attributeStats.map((entry) => (
                <article key={entry.key} className="metric-card player-drawer-attribute-card">
                  <span>{entry.label}</span>
                  <strong>{formatValue(entry.value, 0)}</strong>
                  <div className="player-drawer-chip-row">
                    <span className={`player-drawer-chip ${getAttributeTierClass(entry.ratingLabel)}`}>
                      {entry.ratingLabel ?? "—"}
                    </span>
                  </div>
                </article>
              ))}
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

          {isFreeAgent && onOpenBuyPreview ? (
            <section className="player-drawer-section player-drawer-panel">
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
                <span className="muted">Öffnet nur die Kaufvorschau.</span>
              </div>
            </section>
          ) : null}

          {data.progressionForecast ? (
            <section className="player-drawer-section">
              <h3>Development Forecast</h3>
              <div className="player-drawer-list-grid player-drawer-list-grid-wide">
                <article className="metric-card">
                  <span>Verdiente XP</span>
                  <strong>{formatValue(data.progressionForecast.earnedXP, 0)}</strong>
                  <small>Training + Einsatz + Leistung</small>
                </article>
                <article className="metric-card">
                  <span>Erhaltung</span>
                  <strong>-{formatValue(data.progressionForecast.maintenanceXP, 0)}</strong>
                  <small>CA, Rolle, Potentialnaehe</small>
                </article>
                <article className="metric-card">
                  <span>Regression</span>
                  <strong className={data.progressionForecast.regressionPressure > 0 ? "is-negative" : ""}>
                    -{formatValue(data.progressionForecast.regressionPressure, 0)}
                  </strong>
                  <small>{formatRegressionRisk(data.progressionForecast.regressionRisk)}</small>
                </article>
                <article className="metric-card">
                  <span>Netto</span>
                  <strong className={getDeltaToneClass(data.progressionForecast.netDevelopmentXP)}>
                    {formatValue(data.progressionForecast.netDevelopmentXP, 0)}
                  </strong>
                  <small>{formatDevelopmentTrend(data.progressionForecast.xpTrend)}</small>
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
              </div>
              <p className="muted" style={{ marginTop: 12 }}>
                Netto = verdiente XP minus Erhaltungsdruck und Regression. Historische MVS/PPs bleiben unveraendert.
              </p>
              {data.progressionEvents.length > 0 ? (
                <div className="player-drawer-callout" style={{ marginTop: 12 }}>
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

          {data.progressionEconomyPreview ? (
            <section className="player-drawer-section">
              <h3>XP Economy Preview</h3>
              <div className="player-drawer-list-grid player-drawer-list-grid-wide">
                <article className="metric-card">
                  <span>MW nach Upgrade</span>
                  <strong>{formatMoney(data.progressionEconomyPreview.marketValuePreview)}</strong>
                </article>
                <article className="metric-card">
                  <span>Gehalt laufend</span>
                  <strong>{formatMoney(data.progressionEconomyPreview.currentContractSalary)}</strong>
                  <small>locked</small>
                </article>
                <article className="metric-card">
                  <span>Renewal Preview</span>
                  <strong>{formatMoney(data.progressionEconomyPreview.renewalSalaryPreview)}</strong>
                  <small>preview-only</small>
                </article>
                <article className="metric-card">
                  <span>OVR Preview</span>
                  <strong>{formatValue(data.progressionEconomyPreview.ovrPreview, 1)}</strong>
                </article>
                <article className="metric-card">
                  <span>MVS</span>
                  <strong>{formatValue(data.progressionEconomyPreview.mvsUnchanged, 1)}</strong>
                  <small>bleibt historisch</small>
                </article>
                <article className="metric-card">
                  <span>Audit</span>
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

          <section className="player-drawer-section player-drawer-panel">
            <h3>Historie</h3>
            <div className="player-drawer-callout">
              <strong>History-Snapshot noch unvollständig</strong>
              <p className="muted">
                Spieler- und Teamwerte wie OVR, PPs, MVS, MW, Gehalt, LZ und Diszi-Punkte müssen beim
                Season-Abschluss vollständig archiviert werden. Bis dahin blenden wir die kaputte Tabelle aus.
              </p>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
