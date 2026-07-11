"use client";

import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";

import { NL_AXIS_LABELS, NL_TONE_VAR, type NlAxisKey } from "@/components/foundation/new-look";
import type { LeagueLeaderCategoryId } from "@/lib/foundation/league-leaders-service";
import type {
  PlayerCareerSeries,
  TeamCareerSeasonEntry,
  TeamCareerSeries,
} from "@/lib/foundation/career-series";

/**
 * Werdegang panel — season-over-season career view for players and teams.
 * New-look surface (flag-gated via "Neuer Look"); all styles live under the
 * `.werdegang` namespace in app/globals.css.
 *
 * Vocabulary: MVS = Market Value Score (Ruhm), MW = Marktwert (Geld) —
 * deliberately labelled as two different things.
 */

type WerdegangPanelProps =
  | {
      variant: "player";
      entityName: string;
      series: PlayerCareerSeries;
      /**
       * Optionales Portal in die Liga-Leaders-Liste — macht die
       * OVR/PPs/MVS-Kopf-Kacheln klickbar. Ohne Handler bleiben die
       * Kacheln rein informativ (keine tote Portal-Affordance).
       */
      onOpenLeagueLeaders?: (
        categoryId: LeagueLeaderCategoryId,
        returnContext?: { playerId: string; playerName: string },
      ) => void;
    }
  | { variant: "team"; entityName: string; series: TeamCareerSeries };

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatSigned(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

function formatRank(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `#${formatNumber(value, 0)}`;
}

function shortSeasonLabel(seasonLabel: string) {
  const match = seasonLabel.match(/(\d+)\s*$/);
  return match ? `S${match[1]}` : seasonLabel;
}

type CurveInput = {
  id: string;
  title: string;
  hint?: string;
  tone: "ovr" | "mvs" | "mw" | "rank" | "points";
  /** Inverted axis: smaller value renders higher (used for Rang). */
  invert?: boolean;
  digits?: number;
  points: Array<{ seasonId: string; seasonLabel: string; value: number | null }>;
  /**
   * Peak-/Bestwert-Marker (#41): Saison des Karriere-Bestwerts aus den
   * realen Superlativen (peakMvs / peakMarketValue). Nur gesetzt, wenn der
   * Bestwert real vorliegt.
   */
  peakSeasonLabel?: string;
  peakTitle?: string;
};

type CurveGeometry = {
  width: number;
  height: number;
  polyline: string;
  areaPath: string;
  minValue: number;
  maxValue: number;
  coordinates: Array<{ x: number; y: number; value: number; seasonId: string; seasonLabel: string }>;
  baselineY: number;
};

const CURVE_WIDTH = 300;
const CURVE_HEIGHT = 132;
const CURVE_PAD = { left: 12, right: 12, top: 18, bottom: 26 };

function buildCurveGeometry(curve: CurveInput): CurveGeometry | null {
  const valid = curve.points
    .map((point, index) => ({ ...point, index }))
    .filter((point): point is { seasonId: string; seasonLabel: string; value: number; index: number } =>
      point.value != null && Number.isFinite(point.value),
    );
  if (valid.length < 2) {
    return null;
  }

  const innerWidth = CURVE_WIDTH - CURVE_PAD.left - CURVE_PAD.right;
  const innerHeight = CURVE_HEIGHT - CURVE_PAD.top - CURVE_PAD.bottom;
  const count = curve.points.length;
  const values = valid.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = Math.max(maxValue - minValue, curve.invert ? 1 : Math.abs(maxValue) * 0.01 || 1);

  const coordinates = valid.map((point) => {
    const x = CURVE_PAD.left + (count === 1 ? innerWidth / 2 : (point.index / (count - 1)) * innerWidth);
    const normalized = (point.value - minValue) / span;
    const y = curve.invert
      ? CURVE_PAD.top + normalized * innerHeight
      : CURVE_PAD.top + innerHeight - normalized * innerHeight;
    return { x, y, value: point.value, seasonId: point.seasonId, seasonLabel: point.seasonLabel };
  });

  const baselineY = CURVE_HEIGHT - CURVE_PAD.bottom;
  const polyline = coordinates.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const areaPath = `M ${coordinates[0].x.toFixed(1)},${baselineY} ${coordinates
    .map((point) => `L ${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ")} L ${coordinates[coordinates.length - 1].x.toFixed(1)},${baselineY} Z`;

  return { width: CURVE_WIDTH, height: CURVE_HEIGHT, polyline, areaPath, minValue, maxValue, coordinates, baselineY };
}

/**
 * Übersetzt Pointer-Koordinaten in viewBox-Koordinaten des Kurven-SVGs
 * (preserveAspectRatio "xMidYMid meet": gleichmäßige Skalierung + Zentrierung).
 */
function pointerToViewBoxX(event: ReactPointerEvent<SVGSVGElement>, viewBoxWidth: number, viewBoxHeight: number) {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  const scale = Math.min(rect.width / viewBoxWidth, rect.height / viewBoxHeight);
  if (!Number.isFinite(scale) || scale <= 0) {
    return null;
  }
  const offsetX = (rect.width - viewBoxWidth * scale) / 2;
  return (event.clientX - rect.left - offsetX) / scale;
}

function findNearestCoordinate<T extends { x: number }>(coordinates: T[], x: number): T | null {
  let nearest: T | null = null;
  for (const point of coordinates) {
    if (nearest == null || Math.abs(point.x - x) < Math.abs(nearest.x - x)) {
      nearest = point;
    }
  }
  return nearest;
}

function WerdegangCurveCard({
  curve,
  activeSeasonId,
  onActiveSeasonChange,
}: {
  curve: CurveInput;
  activeSeasonId: string | null;
  onActiveSeasonChange: (seasonId: string | null) => void;
}) {
  const geometry = useMemo(() => buildCurveGeometry(curve), [curve]);
  if (!geometry) {
    return null;
  }
  const digits = curve.digits ?? 1;
  const first = geometry.coordinates[0];
  const last = geometry.coordinates[geometry.coordinates.length - 1];
  const delta = curve.invert ? first.value - last.value : last.value - first.value;

  // Fadenkreuz/Scrubber (#13) + wechselseitiges Highlight (#63): das aktive
  // Saison-Fadenkreuz hängt am geteilten `activeSeasonId` des Panels.
  const activePoint = activeSeasonId
    ? geometry.coordinates.find((point) => point.seasonId === activeSeasonId) ?? null
    : null;
  const peakPoint = curve.peakSeasonLabel
    ? geometry.coordinates.find((point) => point.seasonLabel === curve.peakSeasonLabel) ?? null
    : null;

  const handleScrub = (event: ReactPointerEvent<SVGSVGElement>) => {
    const x = pointerToViewBoxX(event, geometry.width, geometry.height);
    if (x == null) {
      return;
    }
    const nearest = findNearestCoordinate(geometry.coordinates, x);
    if (nearest && nearest.seasonId !== activeSeasonId) {
      onActiveSeasonChange(nearest.seasonId);
    }
  };

  const bubbleLabel = activePoint
    ? `${shortSeasonLabel(activePoint.seasonLabel)} · ${curve.invert ? "#" : ""}${formatNumber(activePoint.value, digits)}`
    : null;
  const bubbleWidth = bubbleLabel ? Math.max(bubbleLabel.length * 6.4 + 14, 44) : 0;
  const bubbleX = activePoint
    ? Math.min(Math.max(activePoint.x - bubbleWidth / 2, 2), geometry.width - bubbleWidth - 2)
    : 0;

  return (
    <article className={`werdegang-curve-card is-${curve.tone}`}>
      <header className="werdegang-curve-head">
        <span className="werdegang-curve-title" title={curve.hint}>{curve.title}</span>
        <span className={`werdegang-delta-chip${delta > 0 ? " is-up" : delta < 0 ? " is-down" : ""}`}>
          {curve.invert ? formatSigned(-delta, digits).replace("+", "▲").replace("-", "▼") : formatSigned(delta, digits)}
        </span>
      </header>
      <svg
        className="werdegang-curve-svg nl-curve-svg"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${curve.title} über Saisons`}
        onPointerMove={handleScrub}
        onPointerDown={handleScrub}
        onPointerLeave={() => onActiveSeasonChange(null)}
      >
        <line
          x1={CURVE_PAD.left}
          y1={geometry.baselineY}
          x2={geometry.width - CURVE_PAD.right}
          y2={geometry.baselineY}
          className="werdegang-curve-axis"
        />
        <path d={geometry.areaPath} className="werdegang-curve-area" />
        <polyline points={geometry.polyline} className="werdegang-curve-line" />
        {geometry.coordinates.map((point, index) => (
          <g key={`${curve.id}-${point.seasonLabel}-${index}`}>
            <circle cx={point.x} cy={point.y} r={3} className="werdegang-curve-dot" />
            {index === 0 || index === geometry.coordinates.length - 1 ? (
              <text
                x={point.x}
                y={point.y - 8}
                textAnchor={index === 0 ? "start" : "end"}
                className="werdegang-curve-value"
              >
                {formatNumber(point.value, digits)}
              </text>
            ) : (
              <title>{`${curve.title} ${point.seasonLabel}: ${formatNumber(point.value, digits)}`}</title>
            )}
            <text x={point.x} y={geometry.height - 8} textAnchor="middle" className="werdegang-curve-season">
              {shortSeasonLabel(point.seasonLabel)}
            </text>
          </g>
        ))}
        {peakPoint ? (
          <g className="nl-curve-peak" aria-label={curve.peakTitle}>
            <circle cx={peakPoint.x} cy={peakPoint.y} r={5.5} className="nl-curve-peak-ring" />
            <text x={peakPoint.x} y={peakPoint.y - 10} textAnchor="middle" className="nl-curve-peak-star">
              ★
            </text>
            <title>{curve.peakTitle}</title>
          </g>
        ) : null}
        {activePoint ? (
          <g className="nl-curve-crosshair" aria-hidden="true">
            <line
              x1={activePoint.x}
              y1={CURVE_PAD.top - 4}
              x2={activePoint.x}
              y2={geometry.baselineY}
              className="nl-curve-crosshair-line"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r={4.5} className="nl-curve-crosshair-dot" />
            {bubbleLabel ? (
              <g className="nl-curve-bubble">
                <rect x={bubbleX} y={2} width={bubbleWidth} height={16} rx={8} className="nl-curve-bubble-bg" />
                <text x={bubbleX + bubbleWidth / 2} y={13} textAnchor="middle" className="nl-curve-bubble-text">
                  {bubbleLabel}
                </text>
              </g>
            ) : null}
          </g>
        ) : null}
      </svg>
    </article>
  );
}

type VocabularyChip = {
  id: string;
  label: string;
  value: string;
  sub?: string | null;
  hint?: string;
  /** Macht die Kachel zum echten Portal (#25); ohne Handler wird ein statisches Element gerendert. */
  onClick?: () => void;
};

function WerdegangVocabularyChips({ chips }: { chips: VocabularyChip[] }) {
  return (
    <div className="werdegang-chip-row" role="list" aria-label="Kernwerte">
      {chips.map((chip) =>
        chip.onClick ? (
          <button
            key={chip.id}
            type="button"
            className="werdegang-chip nl-werdegang-chip-portal"
            role="listitem"
            title={chip.hint}
            onClick={chip.onClick}
          >
            <small>{chip.label}</small>
            <strong>{chip.value}</strong>
            {chip.sub ? <span>{chip.sub}</span> : null}
            <span className="nl-werdegang-chip-arrow" aria-hidden="true">→</span>
          </button>
        ) : (
          <span key={chip.id} className="werdegang-chip nl-werdegang-chip-static" role="listitem" title={chip.hint}>
            <small>{chip.label}</small>
            <strong>{chip.value}</strong>
            {chip.sub ? <span>{chip.sub}</span> : null}
          </span>
        ),
      )}
    </div>
  );
}

/**
 * Team-Bereichsentwicklung (#14): POW/SPE/MEN/SOC-Bereichswerte je Saison
 * (aus `teamSeries.seasons[].area`) als gemeinsame Verlaufsgrafik mit
 * Fadenkreuz-Scrubber und Saison-Readout.
 */
function WerdegangTeamAreaChart({
  seasons,
  activeSeasonId,
  onActiveSeasonChange,
}: {
  seasons: TeamCareerSeasonEntry[];
  activeSeasonId: string | null;
  onActiveSeasonChange: (seasonId: string | null) => void;
}) {
  const geometry = useMemo(() => {
    const axisKeys: NlAxisKey[] = ["pow", "spe", "men", "soc"];
    const count = seasons.length;
    if (count < 2) {
      return null;
    }
    const allValues = seasons.flatMap((entry) =>
      axisKeys.map((key) => entry.area[key]).filter((value): value is number => value != null && Number.isFinite(value)),
    );
    if (allValues.length < 2) {
      return null;
    }
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const span = Math.max(maxValue - minValue, Math.abs(maxValue) * 0.01 || 1);
    const innerWidth = CURVE_WIDTH - CURVE_PAD.left - CURVE_PAD.right;
    const innerHeight = CURVE_HEIGHT - CURVE_PAD.top - CURVE_PAD.bottom;
    const xForIndex = (index: number) =>
      CURVE_PAD.left + (count === 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth);

    const lines = axisKeys.map((key) => {
      const coordinates = seasons
        .map((entry, index) => ({ entry, index, value: entry.area[key] }))
        .filter((point): point is { entry: TeamCareerSeasonEntry; index: number; value: number } =>
          point.value != null && Number.isFinite(point.value),
        )
        .map((point) => ({
          x: xForIndex(point.index),
          y: CURVE_PAD.top + innerHeight - ((point.value - minValue) / span) * innerHeight,
          value: point.value,
          seasonId: point.entry.seasonId,
        }));
      return { key, coordinates, polyline: coordinates.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ") };
    });
    const hasDrawableLine = lines.some((line) => line.coordinates.length >= 2);
    if (!hasDrawableLine) {
      return null;
    }

    return {
      width: CURVE_WIDTH,
      height: CURVE_HEIGHT,
      baselineY: CURVE_HEIGHT - CURVE_PAD.bottom,
      lines,
      seasonTicks: seasons.map((entry, index) => ({
        x: xForIndex(index),
        seasonId: entry.seasonId,
        seasonLabel: entry.seasonLabel,
      })),
    };
  }, [seasons]);

  if (!geometry) {
    return null;
  }

  const handleScrub = (event: ReactPointerEvent<SVGSVGElement>) => {
    const x = pointerToViewBoxX(event, geometry.width, geometry.height);
    if (x == null) {
      return;
    }
    const nearest = findNearestCoordinate(geometry.seasonTicks, x);
    if (nearest && nearest.seasonId !== activeSeasonId) {
      onActiveSeasonChange(nearest.seasonId);
    }
  };

  const activeTick = activeSeasonId
    ? geometry.seasonTicks.find((tick) => tick.seasonId === activeSeasonId) ?? null
    : null;
  const readoutSeason =
    (activeSeasonId ? seasons.find((entry) => entry.seasonId === activeSeasonId) : null) ??
    seasons[seasons.length - 1];

  return (
    <article className="werdegang-curve-card nl-werdegang-area-card" data-testid="werdegang-team-area-chart">
      <header className="werdegang-curve-head">
        <span className="werdegang-curve-title" title="Team-Bereichswerte POW/SPE/MEN/SOC am Saisonende">
          Bereichsentwicklung
        </span>
        <span className="nl-werdegang-area-legend" aria-hidden="true">
          {geometry.lines.map((line) => (
            <span key={`area-legend-${line.key}`} className="nl-werdegang-area-legend-item" style={{ color: NL_TONE_VAR[line.key] }}>
              {NL_AXIS_LABELS[line.key]}
            </span>
          ))}
        </span>
      </header>
      <svg
        className="werdegang-curve-svg nl-curve-svg"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Team-Bereichsentwicklung POW/SPE/MEN/SOC über Saisons"
        onPointerMove={handleScrub}
        onPointerDown={handleScrub}
        onPointerLeave={() => onActiveSeasonChange(null)}
      >
        <line
          x1={CURVE_PAD.left}
          y1={geometry.baselineY}
          x2={geometry.width - CURVE_PAD.right}
          y2={geometry.baselineY}
          className="werdegang-curve-axis"
        />
        {activeTick ? (
          <line
            x1={activeTick.x}
            y1={CURVE_PAD.top - 4}
            x2={activeTick.x}
            y2={geometry.baselineY}
            className="nl-curve-crosshair-line"
            aria-hidden="true"
          />
        ) : null}
        {geometry.lines.map((line) =>
          line.coordinates.length >= 2 ? (
            <polyline
              key={`area-line-${line.key}`}
              points={line.polyline}
              className="nl-werdegang-area-line"
              style={{ stroke: NL_TONE_VAR[line.key] }}
            />
          ) : null,
        )}
        {geometry.lines.flatMap((line) =>
          line.coordinates.map((point) => (
            <circle
              key={`area-dot-${line.key}-${point.seasonId}`}
              cx={point.x}
              cy={point.y}
              r={point.seasonId === activeSeasonId ? 4 : 2.5}
              fill={NL_TONE_VAR[line.key]}
              className="nl-werdegang-area-dot"
            />
          )),
        )}
        {geometry.seasonTicks.map((tick) => (
          <text
            key={`area-season-${tick.seasonId}`}
            x={tick.x}
            y={geometry.height - 8}
            textAnchor="middle"
            className="werdegang-curve-season"
          >
            {shortSeasonLabel(tick.seasonLabel)}
          </text>
        ))}
      </svg>
      <p className="nl-werdegang-area-readout" aria-live="polite">
        <strong>{readoutSeason.seasonLabel}</strong>
        {(["pow", "spe", "men", "soc"] as NlAxisKey[]).map((key) => (
          <span key={`area-readout-${key}`} style={{ color: NL_TONE_VAR[key] }}>
            {NL_AXIS_LABELS[key]} {formatNumber(readoutSeason.area[key], 1)}
          </span>
        ))}
      </p>
    </article>
  );
}

function WerdegangMedalCabinet({
  medals,
  mvpTotal,
}: {
  medals: { gold: number; silver: number; bronze: number };
  mvpTotal?: number | null;
}) {
  const badges: Array<{ id: string; label: string; count: number; tone: string }> = [
    { id: "gold", label: "Gold", count: medals.gold, tone: "is-gold" },
    { id: "silver", label: "Silber", count: medals.silver, tone: "is-silver" },
    { id: "bronze", label: "Bronze", count: medals.bronze, tone: "is-bronze" },
  ];
  if (mvpTotal != null) {
    badges.push({ id: "mvp", label: "MVP", count: mvpTotal, tone: "is-mvp" });
  }

  return (
    <div className="werdegang-vitrine" aria-label="Medaillen-Vitrine">
      {badges.map((badge) => (
        <article key={badge.id} className={`werdegang-medal ${badge.tone}${badge.count === 0 ? " is-empty" : ""}`}>
          <strong>{formatNumber(badge.count, 0)}</strong>
          <small>{badge.label}</small>
        </article>
      ))}
    </div>
  );
}

function WerdegangSuperlatives({ items }: { items: Array<{ id: string; label: string; value: string } | null> }) {
  const visible = items.filter((item): item is NonNullable<typeof item> => item != null);
  if (visible.length === 0) {
    return null;
  }
  return (
    <div className="werdegang-superlatives" aria-label="Superlative">
      {visible.map((item) => (
        <span key={item.id} className="werdegang-superlative-chip">
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  );
}

function DeltaChip({ delta, digits = 1, invert = false }: { delta: number | null; digits?: number; invert?: boolean }) {
  if (delta == null || !Number.isFinite(delta) || delta === 0) {
    return null;
  }
  const isGood = invert ? delta < 0 : delta > 0;
  return (
    <span className={`werdegang-delta-chip ${isGood ? "is-up" : "is-down"}`}>
      {invert ? (delta < 0 ? "▲" : "▼") : delta > 0 ? "▲" : "▼"}
      {formatNumber(Math.abs(delta), digits)}
    </span>
  );
}

function diff(current: number | null, previous: number | null | undefined) {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }
  return Number((current - previous).toFixed(2));
}

function medalGlyph(medal: "gold" | "silver" | "bronze" | null) {
  if (medal === "gold") return <span className="werdegang-season-medal is-gold" title="Gold">●</span>;
  if (medal === "silver") return <span className="werdegang-season-medal is-silver" title="Silber">●</span>;
  if (medal === "bronze") return <span className="werdegang-season-medal is-bronze" title="Bronze">●</span>;
  return null;
}

function EmptyState() {
  return <p className="werdegang-empty">Noch keine Saisonhistorie — nach dem ersten Saisonabschluss beginnt der Werdegang.</p>;
}

export default function WerdegangPanel(props: WerdegangPanelProps) {
  const isPlayer = props.variant === "player";
  const playerSeries = isPlayer ? props.series : null;
  const teamSeries = !isPlayer ? props.series : null;
  const seasonCount = props.series.seasons.length;
  const entityName = props.entityName;
  const onOpenLeagueLeaders = props.variant === "player" ? props.onOpenLeagueLeaders : undefined;
  // Gemeinsames Saison-Highlight (#63): Kurven-Scrubber und Saisonkarten
  // teilen sich diese aktive Saison und heben sich wechselseitig hervor.
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

  const headerChips = useMemo<VocabularyChip[]>(() => {
    if (playerSeries) {
      const latest = playerSeries.seasons[playerSeries.seasons.length - 1] ?? null;
      // Kopf-Kacheln als echte Portale (#25): OVR/PPs/MVS führen — wenn der
      // Handler real durchgereicht ist — in die Liga-Leaders-Liste. MW hat
      // kein Leaders-Ziel und bleibt bewusst statisch.
      const buildLeadersClick = (categoryId: LeagueLeaderCategoryId) =>
        onOpenLeagueLeaders
          ? () => onOpenLeagueLeaders(categoryId, { playerId: playerSeries.playerId, playerName: entityName })
          : undefined;
      return [
        { id: "ovr", label: "OVR", value: formatNumber(latest?.ovr ?? null, 1), sub: latest?.ovrRank != null ? formatRank(latest.ovrRank) : null, hint: "Overall Rating (letzte Saison) — öffnet die Liga-Leaders-Liste", onClick: buildLeadersClick("ovr") },
        { id: "pps", label: "PPs", value: formatNumber(latest?.pps ?? null, 1), sub: latest?.ppsRank != null ? formatRank(latest.ppsRank) : null, hint: "Performance-Punkte der Saison — öffnet die Liga-Leaders-Liste", onClick: buildLeadersClick("pps") },
        { id: "mvs", label: "MVS", value: formatNumber(latest?.mvs ?? null, 1), sub: latest?.mvsRank != null ? formatRank(latest.mvsRank) : null, hint: "Market Value Score — Ruhm aus Disziplinstärke und Einsätzen (nicht der Marktwert) — öffnet die Liga-Leaders-Liste", onClick: buildLeadersClick("mvs") },
        { id: "mw", label: "MW", value: formatNumber(latest?.marketValue ?? null, 2), sub: null, hint: "Marktwert (Geld)" },
      ];
    }
    if (teamSeries) {
      const latest = teamSeries.seasons[teamSeries.seasons.length - 1] ?? null;
      return [
        { id: "rang", label: "Rang", value: formatRank(latest?.rank ?? null), sub: null, hint: "Abschlussplatzierung (letzte Saison)" },
        { id: "punkte", label: "Punkte", value: formatNumber(latest?.points ?? null, 1), sub: null, hint: "Saisonpunkte" },
        { id: "mw", label: "MW", value: formatNumber(latest?.marketValueTotal ?? null, 2), sub: null, hint: "Kader-Marktwert (Geld)" },
        { id: "titel", label: "Titel", value: formatNumber(teamSeries.medals.gold, 0), sub: null, hint: "Meistertitel (Gold)" },
      ];
    }
    return [];
  }, [playerSeries, teamSeries, onOpenLeagueLeaders, entityName]);

  const curves = useMemo<CurveInput[]>(() => {
    if (playerSeries) {
      const peakMvs = playerSeries.superlatives.peakMvs;
      return [
        {
          id: "ovr",
          title: "OVR",
          hint: "Overall Rating je Saison",
          tone: "ovr" as const,
          digits: 1,
          points: playerSeries.seasons.map((entry) => ({ seasonId: entry.seasonId, seasonLabel: entry.seasonLabel, value: entry.ovr })),
        },
        {
          id: "mvs",
          title: "MVS",
          hint: "Market Value Score — treibt Marktwert und Angebote, nicht Geld",
          tone: "mvs" as const,
          digits: 1,
          points: playerSeries.seasons.map((entry) => ({ seasonId: entry.seasonId, seasonLabel: entry.seasonLabel, value: entry.mvs })),
          // Peak-Marker (#41) aus dem realen Superlativ `peakMvs`.
          peakSeasonLabel: peakMvs?.seasonLabel,
          peakTitle: peakMvs ? `Höchster MVS: ${formatNumber(peakMvs.value, 1)} · ${peakMvs.seasonLabel}` : undefined,
        },
        {
          id: "mw",
          title: "MW · Marktwert",
          hint: "Marktwert (Geld) je Saisonende",
          tone: "mw" as const,
          digits: 2,
          points: playerSeries.seasons.map((entry) => ({ seasonId: entry.seasonId, seasonLabel: entry.seasonLabel, value: entry.marketValue })),
        },
        // Rang-Trajektorie (#42): Liga-Rang nach Saison-PPs als eigene,
        // invertierte Kurve (oben = besser) — gleiche Rang-Quelle wie die
        // Saisonkarten und die Podium-Medaillen.
        {
          id: "rank",
          title: "Liga-Rang",
          hint: "Liga-Rang nach Saison-PPs — oben ist besser",
          tone: "rank" as const,
          invert: true,
          digits: 0,
          points: playerSeries.seasons.map((entry) => ({ seasonId: entry.seasonId, seasonLabel: entry.seasonLabel, value: entry.ppsRank })),
        },
      ];
    }
    if (teamSeries) {
      const peakMarketValue = teamSeries.superlatives.peakMarketValue;
      return [
        {
          id: "rank",
          title: "Rang",
          hint: "Abschlussplatzierung — oben ist besser",
          tone: "rank" as const,
          invert: true,
          digits: 0,
          points: teamSeries.seasons.map((entry) => ({ seasonId: entry.seasonId, seasonLabel: entry.seasonLabel, value: entry.rank })),
        },
        {
          id: "points",
          title: "Punkte",
          hint: "Saisonpunkte",
          tone: "points" as const,
          digits: 1,
          points: teamSeries.seasons.map((entry) => ({ seasonId: entry.seasonId, seasonLabel: entry.seasonLabel, value: entry.points })),
        },
        {
          id: "mw",
          title: "MW · Marktwert",
          hint: "Kader-Marktwert am Saisonende",
          tone: "mw" as const,
          digits: 2,
          points: teamSeries.seasons.map((entry) => ({ seasonId: entry.seasonId, seasonLabel: entry.seasonLabel, value: entry.marketValueTotal })),
          // Peak-Marker (#41) aus dem realen Superlativ `peakMarketValue`.
          peakSeasonLabel: peakMarketValue?.seasonLabel,
          peakTitle: peakMarketValue
            ? `Höchster Kader-MW: ${formatNumber(peakMarketValue.value, 2)} · ${peakMarketValue.seasonLabel}`
            : undefined,
        },
      ];
    }
    return [];
  }, [playerSeries, teamSeries]);

  const superlatives = useMemo(() => {
    if (playerSeries) {
      const { bestSeasonRank, biggestMwJump, peakMvs } = playerSeries.superlatives;
      return [
        bestSeasonRank ? { id: "best", label: "Beste Saison", value: `Rang ${formatNumber(bestSeasonRank.rank, 0)} · ${bestSeasonRank.seasonLabel}` } : null,
        biggestMwJump ? { id: "mw-jump", label: "Größter MW-Sprung", value: `${formatSigned(biggestMwJump.delta, 2)} · ${biggestMwJump.seasonLabel}` } : null,
        peakMvs ? { id: "peak-mvs", label: "Höchster MVS", value: `${formatNumber(peakMvs.value, 1)} · ${peakMvs.seasonLabel}` } : null,
      ];
    }
    if (teamSeries) {
      const { bestSeason, biggestPointsSwing, peakMarketValue } = teamSeries.superlatives;
      return [
        bestSeason ? { id: "best", label: "Beste Saison", value: `Rang ${formatNumber(bestSeason.rank, 0)} · ${bestSeason.seasonLabel}` } : null,
        biggestPointsSwing ? { id: "swing", label: "Größter Punkte-Swing", value: `${formatSigned(biggestPointsSwing.delta, 1)} · ${biggestPointsSwing.seasonLabel}` } : null,
        peakMarketValue ? { id: "peak-mw", label: "Höchster Kader-MW", value: `${formatNumber(peakMarketValue.value, 2)} · ${peakMarketValue.seasonLabel}` } : null,
      ];
    }
    return [];
  }, [playerSeries, teamSeries]);

  return (
    <section className="werdegang is-new-look" data-testid={`werdegang-panel-${props.variant}`}>
      <header className="werdegang-header">
        <div className="werdegang-header-copy">
          <span className="werdegang-eyebrow">Werdegang</span>
          <h3 className="werdegang-title">{props.entityName}</h3>
          <p className="werdegang-subtitle">
            {seasonCount === 0
              ? "Karriereverlauf über Saisons"
              : seasonCount === 1
                ? "1 abgeschlossene Saison"
                : `${seasonCount} abgeschlossene Saisons`}
          </p>
        </div>
        <WerdegangVocabularyChips chips={headerChips} />
      </header>

      {seasonCount === 0 ? (
        <EmptyState />
      ) : (
        <>
          {seasonCount >= 2 ? (
            <div className="werdegang-curves" aria-label="Karrierekurven">
              {curves.map((curve) => (
                <WerdegangCurveCard
                  key={curve.id}
                  curve={curve}
                  activeSeasonId={activeSeasonId}
                  onActiveSeasonChange={setActiveSeasonId}
                />
              ))}
              {teamSeries ? (
                <WerdegangTeamAreaChart
                  seasons={teamSeries.seasons}
                  activeSeasonId={activeSeasonId}
                  onActiveSeasonChange={setActiveSeasonId}
                />
              ) : null}
            </div>
          ) : (
            <p className="werdegang-single-note">Eine Saison im Archiv — Kurven erscheinen ab der zweiten Saison.</p>
          )}

          <div className="werdegang-vitrine-row">
            <WerdegangMedalCabinet
              medals={props.series.medals}
              mvpTotal={playerSeries ? playerSeries.mvpTotal : null}
            />
            <WerdegangSuperlatives items={superlatives} />
          </div>

          <div className="werdegang-seasons" aria-label="Saison für Saison">
            <h4 className="werdegang-section-title">Saison für Saison</h4>
            <ol className="werdegang-season-list">
              {playerSeries
                ? [...playerSeries.seasons].reverse().map((entry, reverseIndex) => {
                    const index = playerSeries.seasons.length - 1 - reverseIndex;
                    const previous = index > 0 ? playerSeries.seasons[index - 1] : null;
                    return (
                      <li
                        key={entry.seasonId}
                        className={`werdegang-season-card${entry.seasonId === activeSeasonId ? " nl-season-active" : ""}`}
                        style={{ ["--werdegang-i" as string]: reverseIndex }}
                        onMouseEnter={() => setActiveSeasonId(entry.seasonId)}
                        onMouseLeave={() => setActiveSeasonId(null)}
                      >
                        <div className="werdegang-season-head">
                          <strong className="werdegang-season-name">{entry.seasonLabel}</strong>
                          {medalGlyph(entry.rankMedal)}
                          <span className="werdegang-season-rank">{formatRank(entry.ppsRank)}</span>
                          {entry.mvpCount > 0 ? (
                            <span className="werdegang-season-tag" title="MVP-Auszeichnungen in dieser Saison">
                              {formatNumber(entry.mvpCount, 0)}× MVP
                            </span>
                          ) : null}
                        </div>
                        <div className="werdegang-season-stats">
                          <span className="werdegang-season-stat">
                            <small>OVR</small>
                            <strong>{formatNumber(entry.ovr, 1)}</strong>
                            <DeltaChip delta={diff(entry.ovr, previous?.ovr)} />
                          </span>
                          <span className="werdegang-season-stat">
                            <small>PPs</small>
                            <strong>{formatNumber(entry.pps, 1)}</strong>
                            <DeltaChip delta={diff(entry.pps, previous?.pps)} />
                          </span>
                          <span className="werdegang-season-stat">
                            <small>MVS</small>
                            <strong>{formatNumber(entry.mvs, 1)}</strong>
                            <DeltaChip delta={diff(entry.mvs, previous?.mvs)} />
                          </span>
                          <span className="werdegang-season-stat">
                            <small>MW</small>
                            <strong>{formatNumber(entry.marketValue, 2)}</strong>
                            <DeltaChip delta={diff(entry.marketValue, previous?.marketValue)} digits={2} />
                          </span>
                          <span className="werdegang-season-stat">
                            <small>Einsätze</small>
                            <strong>{formatNumber(entry.appearances, 0)}</strong>
                          </span>
                        </div>
                        {entry.bestDiscipline ? (
                          <p className="werdegang-season-foot">Beste Disziplin: {entry.bestDiscipline}</p>
                        ) : null}
                      </li>
                    );
                  })
                : null}
              {teamSeries
                ? [...teamSeries.seasons].reverse().map((entry, reverseIndex) => {
                    const index = teamSeries.seasons.length - 1 - reverseIndex;
                    const previous = index > 0 ? teamSeries.seasons[index - 1] : null;
                    return (
                      <li
                        key={entry.seasonId}
                        className={`werdegang-season-card${entry.seasonId === activeSeasonId ? " nl-season-active" : ""}`}
                        style={{ ["--werdegang-i" as string]: reverseIndex }}
                        onMouseEnter={() => setActiveSeasonId(entry.seasonId)}
                        onMouseLeave={() => setActiveSeasonId(null)}
                      >
                        <div className="werdegang-season-head">
                          <strong className="werdegang-season-name">{entry.seasonLabel}</strong>
                          {medalGlyph(entry.medal)}
                          <span className="werdegang-season-rank">{formatRank(entry.rank)}</span>
                          <DeltaChip delta={diff(entry.rank, previous?.rank)} digits={0} invert />
                        </div>
                        <div className="werdegang-season-stats">
                          <span className="werdegang-season-stat">
                            <small>Punkte</small>
                            <strong>{formatNumber(entry.points, 1)}</strong>
                            <DeltaChip delta={diff(entry.points, previous?.points)} />
                          </span>
                          <span className="werdegang-season-stat">
                            <small>MW</small>
                            <strong>{formatNumber(entry.marketValueTotal, 2)}</strong>
                            <DeltaChip delta={diff(entry.marketValueTotal, previous?.marketValueTotal)} digits={2} />
                          </span>
                          <span className="werdegang-season-stat is-area is-pow">
                            <small>POW</small>
                            <strong>{formatNumber(entry.area.pow, 1)}</strong>
                          </span>
                          <span className="werdegang-season-stat is-area is-spe">
                            <small>SPE</small>
                            <strong>{formatNumber(entry.area.spe, 1)}</strong>
                          </span>
                          <span className="werdegang-season-stat is-area is-men">
                            <small>MEN</small>
                            <strong>{formatNumber(entry.area.men, 1)}</strong>
                          </span>
                          <span className="werdegang-season-stat is-area is-soc">
                            <small>SOC</small>
                            <strong>{formatNumber(entry.area.soc, 1)}</strong>
                          </span>
                        </div>
                      </li>
                    );
                  })
                : null}
            </ol>
          </div>
        </>
      )}
    </section>
  );
}
