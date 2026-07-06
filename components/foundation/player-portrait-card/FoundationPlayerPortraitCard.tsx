"use client";

import type { CSSProperties, ReactNode } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { VeloStatOrbitRow } from "@/components/foundation/velo-ui";
import {
  buildContextOverlayStats,
  shouldShowPortraitOrbit,
  type PlayerPortraitContext,
  type PlayerPortraitContextData,
  type PlayerPortraitDensity,
  type PlayerPortraitLayout,
  type PortraitOverlayStat,
} from "@/lib/foundation/player-portrait-stat-presets";
import { createEmptyLeaguePlayerHeatPools, type LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";

export type FoundationPlayerPortraitEconomyStat = {
  label: string;
  value: string;
  delta?: string | null;
  deltaClass?: string;
  title?: string;
};

export type FoundationPlayerPortraitCardProps = {
  playerId: string;
  name: string;
  portraitUrl: string | null;
  portraitPlaceholderUrl?: string | null;
  portraitInitials: string;
  playerOvr: number | null;
  playerMvs: number | null;
  playerPps?: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  leagueHeatPools?: LeaguePlayerHeatPools;
  onOpen?: () => void;
  title?: string;
  rosterRank?: number | null;
  highlight?: string | null;
  rankFrameClass?: string;
  caRating?: number | null;
  poRangeMin?: number | null;
  poRangeMax?: number | null;
  className?: string;
  variant?: "home" | "team";
  roleTag?: string | null;
  playerClassName?: string | null;
  subMeta?: string | null;
  ovrRank?: number | null;
  mvsRank?: number | null;
  ppsRank?: number | null;
  economyStats?: FoundationPlayerPortraitEconomyStat[];
  footerSlot?: ReactNode;
  railSummarySlot?: ReactNode;
  context?: PlayerPortraitContext;
  contextData?: PlayerPortraitContextData;
  density?: PlayerPortraitDensity;
  portraitLayout?: PlayerPortraitLayout;
  interactive?: boolean;
  selected?: boolean;
  style?: CSSProperties;
  testId?: string;
  portraitLoading?: "eager" | "lazy";
  portraitFetchPriority?: "high" | "low" | "auto";
};

function renderOverlayStat(stat: PortraitOverlayStat) {
  return (
    <span
      key={`${stat.label}-${stat.value}`}
      className={`home-v2-player-stat foundation-player-portrait-stat ${stat.heatClass ?? ""}`.trim()}
      title={stat.title}
    >
      <small>{stat.label}</small>
      <strong className={stat.valueClass ?? ""}>{stat.value}</strong>
    </span>
  );
}

export default function FoundationPlayerPortraitCard({
  name,
  portraitUrl,
  portraitPlaceholderUrl,
  portraitInitials,
  playerOvr,
  playerMvs,
  playerPps,
  pow,
  spe,
  men,
  soc,
  leagueHeatPools,
  onOpen,
  title,
  rosterRank,
  highlight,
  rankFrameClass = "",
  caRating,
  poRangeMin,
  poRangeMax,
  className = "",
  variant = "home",
  roleTag,
  playerClassName,
  subMeta,
  ovrRank,
  mvsRank,
  ppsRank,
  economyStats,
  footerSlot,
  railSummarySlot,
  context = "roster",
  contextData,
  density = "full",
  portraitLayout = "stack",
  interactive = true,
  selected = false,
  style,
  testId,
  portraitLoading = "lazy",
  portraitFetchPriority = "auto",
}: FoundationPlayerPortraitCardProps) {
  const resolvedHeatPools = leagueHeatPools ?? createEmptyLeaguePlayerHeatPools();
  const showCaPo = variant === "home" && context === "roster" && (caRating != null || poRangeMin != null || poRangeMax != null);
  const resolvedSubMeta =
    subMeta ??
    (variant === "team" && context === "roster" ? [roleTag, playerClassName].filter(Boolean).join(" · ") || null : null);

  const overlayStats = buildContextOverlayStats({
    context,
    contextData,
    density,
    layout: portraitLayout,
    playerOvr,
    playerMvs,
    playerPps,
    ovrRank,
    mvsRank,
    ppsRank,
    caRating,
    poRangeMin,
    poRangeMax,
    showCaPo,
    leagueHeatPools: resolvedHeatPools,
    rankStyle: ovrRank != null || ppsRank != null || mvsRank != null || variant === "team" ? "inline" : "label",
  });

  const economyRow =
    economyStats && economyStats.length > 0 && density !== "mini" && portraitLayout !== "rail" ? (
      <div className="foundation-player-portrait-economy" aria-label={`${name} Finanzkennzahlen`}>
        {economyStats.map((stat) => (
          <span key={`${stat.label}-${stat.value}`} className="foundation-player-portrait-economy-stat" title={stat.title}>
            <small>{stat.label}</small>
            <strong>{stat.value}</strong>
            {stat.delta ? <em className={stat.deltaClass ?? ""}>{stat.delta}</em> : null}
          </span>
        ))}
      </div>
    ) : null;

  const showOrbit = shouldShowPortraitOrbit(context, density, portraitLayout);
  const orbitRow = showOrbit ? (
    <VeloStatOrbitRow
      ariaLabel={`${name} Achsenwerte POW SPE MEN SOC`}
      className={`home-v2-player-orbit is-overlay foundation-player-portrait-orbit${portraitLayout === "rail" ? " is-rail" : ""}`}
      stats={{
        pow: pow ?? 0,
        spe: spe ?? 0,
        men: men ?? 0,
        soc: soc ?? 0,
      }}
    />
  ) : null;

  const portraitMedia = portraitUrl ? (
    <OptimizedMediaImage
      className="home-v2-player-portrait"
      src={portraitUrl}
      placeholderSrc={portraitPlaceholderUrl}
      alt={name}
      width={portraitLayout === "rail" ? 108 : 280}
      height={portraitLayout === "rail" ? 108 : 373}
      loading={portraitLoading}
      fetchPriority={portraitFetchPriority}
    />
  ) : (
    <span className="home-v2-player-portrait is-placeholder">{portraitInitials}</span>
  );

  const overlayStatsRow =
    overlayStats.length > 0 ? (
      <div
        className={`home-v2-player-stats foundation-player-portrait-stats${
          portraitLayout === "rail" ? " is-rail-tile-overlay" : ""
        }`}
        data-testid="foundation-player-portrait-stats"
      >
        {overlayStats.map(renderOverlayStat)}
      </div>
    ) : null;

  const cardBody =
    portraitLayout === "rail" ? (
      <div className="foundation-player-portrait-rail-tile">
        <div className="home-v2-player-hero foundation-player-portrait-hero is-rail-tile">
          {portraitMedia}
          <div
            className="home-v2-player-overlay foundation-player-portrait-overlay is-rail-tile"
            aria-hidden={interactive ? true : undefined}
          >
            <div className="home-v2-player-overlay-top">
              {highlight ? <span className="home-v2-player-badge">{highlight}</span> : null}
            </div>
            <div className="home-v2-player-overlay-bottom">
              {resolvedSubMeta ? (
                <span className="foundation-player-portrait-submeta is-rail-tile">{resolvedSubMeta}</span>
              ) : null}
              <strong className="home-v2-player-name is-rail-tile">{name}</strong>
              {overlayStatsRow}
              {railSummarySlot}
            </div>
          </div>
        </div>
      </div>
    ) : (
    <div className="home-v2-player-hero foundation-player-portrait-hero">
      {portraitMedia}
      <div className="home-v2-player-overlay foundation-player-portrait-overlay" aria-hidden={interactive ? true : undefined}>
        <div className="home-v2-player-overlay-top">
          {rosterRank != null ? (
            <span className="home-v2-player-rank-pill" title="Rank">
              #{rosterRank}
            </span>
          ) : null}
          {highlight ? <span className="home-v2-player-badge">{highlight}</span> : null}
        </div>
        <div className="home-v2-player-overlay-bottom">
          {resolvedSubMeta && density !== "mini" ? (
            <span className="foundation-player-portrait-submeta">{resolvedSubMeta}</span>
          ) : null}
          <strong className="home-v2-player-name">{name}</strong>
          {overlayStatsRow}
          {economyRow}
          {orbitRow}
          {footerSlot && density !== "mini" ? (
            <div className="foundation-player-portrait-footer" onClick={(event) => event.stopPropagation()}>
              {footerSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const cardClassName = [
    "foundation-player-portrait-card",
    "home-v2-player-card",
    "is-full-art",
    variant === "team" ? "is-team-layout" : "",
    `is-density-${density}`,
    portraitLayout === "rail" ? "is-portrait-rail" : "",
    selected ? "is-selected" : "",
    rankFrameClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!interactive) {
    return (
      <div className={cardClassName} style={style} data-testid={testId ?? (variant === "team" ? "foundation-team-portrait-card" : undefined)}>
        {cardBody}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cardClassName}
      style={style}
      onClick={() => onOpen?.()}
      title={title ?? `${name} öffnen`}
      data-testid={testId ?? (variant === "team" ? "foundation-team-portrait-card" : undefined)}
    >
      {cardBody}
    </button>
  );
}
