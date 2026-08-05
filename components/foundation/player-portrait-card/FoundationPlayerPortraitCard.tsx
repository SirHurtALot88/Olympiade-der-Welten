"use client";

import type { CSSProperties, ReactNode } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";
import { NlAbilityStars, VeloStatOrbitRow } from "@/components/foundation/velo-ui";
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
import {
  describePlayerStarTier,
  getPlayerStarTier,
  getPlayerStarTierClassName,
  isHoloPlayerStarTier,
  resolveLeagueRankFromPool,
} from "@/lib/foundation/player-star-tier";

/**
 * SAISON-PPs je Achse — die zweite Achsenzeile der Karte.
 *
 * WARUM ES DAS BRAUCHT: `pow`/`spe`/`men`/`soc` an dieser Karte sind die ATTRIBUTWERTE
 * (29/35/60/63) und werden vom Orbit-Ring gerendert. Wer die PPs auf der Karte suchte, fand
 * dort vier Achsenzahlen und nichts zu reparieren — es waren nur die falschen. Die Saison-PPs
 * sind eine eigene Größe (`PlayerRatingContractRow.ppPow/…`) und bekommen deshalb eine eigene
 * Zeile statt den Orbit umzudeuten.
 */
export type FoundationPlayerPortraitAxisPps = {
  pow: number | null;
  powRank?: number | null;
  spe: number | null;
  speRank?: number | null;
  men: number | null;
  menRank?: number | null;
  soc: number | null;
  socRank?: number | null;
};

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
  /** Saison-PPs je Achse (optional) — rendert eine zweite Achsenzeile unter dem Orbit. */
  axisPps?: FoundationPlayerPortraitAxisPps | null;
  leagueHeatPools?: LeaguePlayerHeatPools;
  onOpen?: () => void;
  title?: string;
  rosterRank?: number | null;
  highlight?: string | null;
  rankFrameClass?: string;
  caRating?: number | null;
  poRangeMin?: number | null;
  poRangeMax?: number | null;
  /**
   * "Neuer Look" CA/PO-Sterne-Slot (Tier-3 Rosterkarten): additiv, rendert `NlAbilityStars`
   * außerhalb des String-basierten `PortraitOverlayStat`-Systems. Nur aktiv, wenn `newLook`
   * true ist — die Karte bleibt für Flag-aus-Aufrufer byte-identisch (Default `false`).
   */
  newLook?: boolean;
  /** Fog-of-war: `true` = eigenes/steuerbares Team (exakte Zahl gezeigt), `false` = gescoutet (nur Sterne/Range). */
  known?: boolean;
  caStars?: number | string | null;
  poStars?: number | string | null;
  poStarRange?: { min: number; max: number } | null;
  caScore?: number | null;
  poScore?: number | null;
  poScoreRange?: { min: number; max: number } | null;
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

const PORTRAIT_AXIS_PPS_CELLS = [
  { axis: "pow", label: "POW" },
  { axis: "spe", label: "SPE" },
  { axis: "men", label: "MEN" },
  { axis: "soc", label: "SOC" },
] as const;

function renderOverlayStat(stat: PortraitOverlayStat) {
  return (
    <span
      key={`${stat.label}-${stat.value}`}
      className={`home-v2-player-stat foundation-player-portrait-stat ${stat.heatClass ?? ""} ${
        stat.starTierClass ?? ""
      }`
        .replace(/\s+/g, " ")
        .trim()}
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
  axisPps,
  leagueHeatPools,
  onOpen,
  title,
  rosterRank,
  highlight,
  rankFrameClass = "",
  caRating,
  poRangeMin,
  poRangeMax,
  newLook = false,
  known = true,
  caStars = null,
  poStars = null,
  poStarRange = null,
  caScore = null,
  poScore = null,
  poScoreRange = null,
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
  // Ligaraenge: bevorzugt die explizit uebergebenen, sonst aus den Heat-Pools
  // abgeleitet. Die meisten Aufrufer (Hover-Vorschau der Spielertabelle, Training,
  // Arena-Drawer) reichen zwar die Pools durch, aber keine fertigen Raenge — die
  // Karte blieb dadurch ohne Rang-Angabe UND ohne Star-Rahmen, obwohl die
  // Einordnung aus den Pools eindeutig ableitbar ist. Gleiche Zaehlweise wie in
  // der Spielertabelle, also derselbe Rang wie dort.
  const effectiveOvrRank = ovrRank ?? resolveLeagueRankFromPool(playerOvr, resolvedHeatPools.ovr);
  const effectivePpsRank = ppsRank ?? resolveLeagueRankFromPool(playerPps ?? null, resolvedHeatPools.pps);
  const effectiveMvsRank = mvsRank ?? resolveLeagueRankFromPool(playerMvs, resolvedHeatPools.mvs);
  // Team-Varianten dürfen die alte String-CA/PO-Zeile nur im "Neuen Look" zeigen (Tier-3
  // Rosterkarten) — Flag-aus bleibt unverändert, weil `newLook` dort nie gesetzt wird.
  const showCaPo =
    (variant === "home" || newLook) &&
    context === "roster" &&
    (caRating != null || poRangeMin != null || poRangeMax != null);
  // Neuer, eigenständiger Sterne-Slot (außerhalb des String-Preset-Systems): rendert
  // `NlAbilityStars`, sobald der Aufrufer `newLook` setzt und echte CA/PO-Daten mitgibt —
  // unabhängig vom `context` (Home nutzt "teamGrid", Teams/Team-Profil "roster").
  const showAbilityStars =
    newLook &&
    (caStars != null ||
      poStars != null ||
      poStarRange != null ||
      caScore != null ||
      poScore != null ||
      poScoreRange != null ||
      caRating != null ||
      poRangeMin != null ||
      poRangeMax != null);
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
    ovrRank: effectiveOvrRank,
    mvsRank: effectiveMvsRank,
    ppsRank: effectivePpsRank,
    caRating,
    poRangeMin,
    poRangeMax,
    showCaPo,
    leagueHeatPools: resolvedHeatPools,
    rankStyle:
      effectiveOvrRank != null || effectivePpsRank != null || effectiveMvsRank != null || variant === "team"
        ? "inline"
        : "label",
  });

  const abilityStarsRow =
    showAbilityStars && density !== "mini" && portraitLayout !== "rail" ? (
      <div className="nl-portrait-ability-stars" data-testid="foundation-player-portrait-ability-stars">
        <NlAbilityStars
          caStars={caStars}
          caScore={caScore ?? caRating ?? null}
          poStars={poStars}
          poStarRange={poStarRange}
          poScore={poScore}
          poScoreRange={poScoreRange ?? (poRangeMin != null && poRangeMax != null ? { min: poRangeMin, max: poRangeMax } : null)}
          known={known}
          compact
          label={`${name} Fähigkeiten`}
        />
      </div>
    ) : null;

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

  /**
   * Die PPs-Zeile hängt an denselben Sichtbarkeitsregeln wie der Orbit (`showOrbit`): wo die
   * Attributzeile keinen Platz hat (Mini-Dichte, Rail-Kacheln), hat die PPs-Zeile erst recht
   * keinen. Fehlt der Achsenwert komplett — Saisonstart, noch kein Spieltag gewertet — bleibt
   * die Zeile ganz weg, statt vier Nullen zu zeigen, die wie ein Datenfehler aussehen.
   */
  const axisPpsCells = axisPps
    ? PORTRAIT_AXIS_PPS_CELLS.map((cell) => ({
        ...cell,
        value: axisPps[cell.axis] ?? null,
        rank: axisPps[`${cell.axis}Rank` as const] ?? null,
      }))
    : [];
  const axisPpsRow =
    showOrbit && axisPpsCells.some((cell) => cell.value != null) ? (
      <div
        className="foundation-player-portrait-pps"
        aria-label={`${name} Saison-PPs je Achse`}
        data-testid="foundation-player-portrait-pps"
      >
        {axisPpsCells.map((cell) => (
          <span
            key={cell.axis}
            className={`foundation-player-portrait-pps-chip is-${cell.axis}`}
            title={`${cell.label} · ${formatNlNumber(cell.value, 1)} PPs diese Saison${
              cell.rank != null ? ` · Liga-Rang ${cell.rank}` : ""
            }`}
          >
            <small>{cell.label}</small>
            <strong>{formatNlNumber(cell.value, 1)}</strong>
            {/* Als EIN Textknoten, nicht `#{cell.rank}` — sonst schiebt React beim
                Server-Rendern einen Kommentar-Marker zwischen Raute und Zahl. */}
            {cell.rank != null ? <em>{`#${cell.rank}`}</em> : null}
          </span>
        ))}
      </div>
    ) : null;

  const portraitMedia = portraitUrl ? (
    <BudgetedMediaImage
      className="home-v2-player-portrait"
      src={portraitUrl}
      placeholderSrc={portraitPlaceholderUrl}
      alt={name}
      // Intrinsische Maße = Anforderungsgröße beim Bild-Optimizer, nicht die Layoutgröße (die
      // kommt aus dem Raster, das Bild ist `object-fit: cover` auf 100 %). Mit den breiteren
      // Kader-Spalten reichten 280 px nicht mehr — das Portrait wurde hochskaliert und weich.
      width={portraitLayout === "rail" ? 108 : 340}
      height={portraitLayout === "rail" ? 108 : 453}
      loading={portraitLoading}
      fetchPriority={portraitFetchPriority}
      eager={portraitLoading === "eager" || portraitFetchPriority === "high"}
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
          {abilityStarsRow}
          {economyRow}
          {orbitRow}
          {axisPpsRow}
          {footerSlot && density !== "mini" ? (
            <div className="foundation-player-portrait-footer" onClick={(event) => event.stopPropagation()}>
              {footerSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  /**
   * Star-Tier der Karte (Bronze/Silber/Gold/Diamant für Liga-Top-50/25/10/3).
   * Wird bewusst HIER aus dem bereits vorhandenen `ovrRank`-Prop abgeleitet
   * statt als eigene Prop durchgereicht: die Karte ist die gemeinsame Basis
   * aller Portrait-Darstellungen (inkl. `FoundationPlayerPortraitPreview` und
   * damit sämtlicher Hover-Previews), also bekommt jeder Aufrufer, der
   * ohnehin `ovrRank` liefert, den Rahmen ohne eigenes Zutun.
   *
   * Für das Portrait zählt AUSSCHLIESSLICH der OVR-Rang — nicht mehr der beste
   * der drei Ränge. Ein starker PPs- oder MVS-Rang allein löst keinen Rahmen
   * mehr aus. Die einzelnen OVR/PPs/MVS-Chips tragen davon unabhängig ihre
   * eigene Stufe (siehe `buildRosterOverlayStats`).
   */
  // Upstream (#232) leitet fehlende Raenge aus den Liga-Heat-Pools ab — das behalten
  // wir, weil die Hover-Karte sonst gar keinen Rang kennt. Ausgewertet wird davon aber
  // AUSSCHLIESSLICH der OVR-Rang.
  const starTier = getPlayerStarTier(effectiveOvrRank);
  const starTierDescription = describePlayerStarTier(effectiveOvrRank);

  const cardClassName = [
    "foundation-player-portrait-card",
    "home-v2-player-card",
    "is-full-art",
    variant === "team" ? "is-team-layout" : "",
    `is-density-${density}`,
    portraitLayout === "rail" ? "is-portrait-rail" : "",
    selected ? "is-selected" : "",
    rankFrameClass,
    getPlayerStarTierClassName(starTier),
    isHoloPlayerStarTier(starTier) ? "is-star-holo" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Der Rahmen soll nicht raten lassen, WARUM die Karte leuchtet — die Stufe
  // samt auslösendem Rang hängt daher am Titel der Karte.
  const cardTitle = [title ?? `${name} öffnen`, starTierDescription].filter(Boolean).join(" · ");

  if (!interactive) {
    return (
      <div
        className={cardClassName}
        style={style}
        title={starTierDescription ?? undefined}
        data-star-tier={starTier ?? undefined}
        data-testid={testId ?? (variant === "team" ? "foundation-team-portrait-card" : undefined)}
      >
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
      title={cardTitle}
      data-star-tier={starTier ?? undefined}
      data-testid={testId ?? (variant === "team" ? "foundation-team-portrait-card" : undefined)}
    >
      {cardBody}
    </button>
  );
}
