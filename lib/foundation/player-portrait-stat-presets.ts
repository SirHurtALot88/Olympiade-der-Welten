import { getPoolHeatClass, type LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import {
  getPlayerStarTier,
  getPlayerStarTierClassName,
  getPlayerStarTierLabel,
} from "@/lib/foundation/player-star-tier";

export type PlayerPortraitContext =
  | "roster"
  | "training"
  | "market"
  | "scouting"
  | "lineup"
  | "lineupCandidate"
  | "arena"
  | "arenaReveal"
  | "teamGrid"
  | "tablePreview";

export type PlayerPortraitDensity = "full" | "compact" | "mini";

export type PortraitOverlayStat = {
  label: string;
  value: string;
  heatClass?: string;
  title?: string;
  valueClass?: string;
  /**
   * Liga-Rang als EIGENE Zeile im Chip (`#20`) statt in den Wert eingeklebt
   * (`79,9 · #20`). Der eingeklebte Rang machte die Chips so breit, dass
   * OVR/PPs/MVS auf der großen Karte in zwei Zeilen umbrachen (Chris: „statt
   * OVR PPS MVS in 2 zeilen soll das in eine!"). Als eigene, kleinere Zeile
   * kostet er keine Breite — und die Chips tragen dieselbe dreizeilige Form
   * wie die Achsen-PPs-Chips darunter.
   */
  rankLabel?: string | null;
  /**
   * Star-Tier DIESER Kennzahl (`is-star-tier-*`, siehe
   * `lib/foundation/player-star-tier.ts`) — steht bewusst neben `heatClass`
   * statt darin: die Heat-Bänder sagen "wie gut im Ligavergleich" (Achtel des
   * Pools), das Star-Tier sagt "Top 50/25/10/3". Beides gleichzeitig ist
   * gewollt, die Tier-Regel legt nur einen Rahmen darüber.
   */
  starTierClass?: string;
};

export type PlayerPortraitTrainingContextData = {
  caRating?: number | null;
  poDisplay?: string | null;
  netSetpoints?: number | null;
  regressionRisk?: string | null;
  trainingModeLabel?: string | null;
  traitModifierPct?: number | null;
};

export type PlayerPortraitMarketContextData = {
  fitDisplay?: string | null;
  marketValue?: string | null;
  salary?: string | null;
  ratio?: string | null;
  needScore?: string | null;
  ovr?: number | null;
  fitToneClass?: string;
  needToneClass?: string;
  ratioToneClass?: string;
};

export type PlayerPortraitScoutingContextData = {
  scoutStatusLabel?: string | null;
  caOverall?: number | null;
  poDisplay?: string | null;
  potentialBandLabel?: string | null;
  scoutMilestone?: string | null;
  sourceLabel?: string | null;
};

export type PlayerPortraitLineupContextData = {
  d1Score?: string | null;
  d2Score?: string | null;
  slotProjection?: string | null;
  qualityGroup?: string | null;
  fatigueLabel?: string | null;
  assignmentLabel?: string | null;
};

export type PlayerPortraitArenaContextData = {
  scoreLabel?: string | null;
  pointsLabel?: string | null;
  contributionLabel?: string | null;
  rank?: number | null;
};

export type PlayerPortraitTablePreviewContextData = {
  previewKind: "roster" | "market";
  stats: PortraitOverlayStat[];
};

export type PlayerPortraitContextData = {
  training?: PlayerPortraitTrainingContextData;
  market?: PlayerPortraitMarketContextData;
  scouting?: PlayerPortraitScoutingContextData;
  lineup?: PlayerPortraitLineupContextData;
  arena?: PlayerPortraitArenaContextData;
  tablePreview?: PlayerPortraitTablePreviewContextData;
};

export type BuildRosterOverlayInput = {
  playerOvr: number | null;
  playerMvs: number | null;
  playerPps?: number | null;
  ovrRank?: number | null;
  mvsRank?: number | null;
  ppsRank?: number | null;
  caRating?: number | null;
  poRangeMin?: number | null;
  poRangeMax?: number | null;
  showCaPo?: boolean;
  leagueHeatPools: LeaguePlayerHeatPools;
  rankStyle?: "label" | "inline";
};

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatStatLabel(label: string, rank: number | null | undefined) {
  return rank != null ? `#${rank} ${label}` : label;
}

function formatPotentialRange(min: number | null | undefined, max: number | null | undefined) {
  if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max)) return "—";
  const formatAbility = (value: number) =>
    value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (Math.round(min) === Math.round(max)) return formatAbility(min);
  return `${formatAbility(min)}–${formatAbility(max)}`;
}

/**
 * Rang-Zeile für den Chip: `#20` oder null. Früher stand der Rang IM Wert
 * (`79,9 · #20`, `formatMetricWithRank`) — das machte drei Chips breiter als
 * die Karte und brach die OVR/PPs/MVS-Zeile um. Jetzt ist er eine eigene,
 * kleinere Zeile im Chip (siehe `PortraitOverlayStat.rankLabel`).
 */
function formatRankLabel(rank: number | null | undefined) {
  return rank != null ? `#${rank}` : null;
}

function stat(label: string, value: string, extra?: Partial<PortraitOverlayStat>): PortraitOverlayStat {
  return { label, value, ...extra };
}

/**
 * Star-Tier-Zusatz für eine Kennzahl-Kachel: Klasse plus Tooltip-Zeile, damit
 * am Chip ablesbar ist, WELCHE Stufe der Rahmen meint. Jede Kennzahl bekommt
 * ihre EIGENE Stufe aus ihrem eigenen Rang (das Portrait selbst nimmt dagegen
 * die beste der drei, siehe `FoundationPlayerPortraitCard`).
 */
function starTierStatExtra(metricLabel: string, rank: number | null | undefined): Partial<PortraitOverlayStat> {
  const tier = getPlayerStarTier(rank);
  if (!tier) {
    return {};
  }
  return {
    starTierClass: getPlayerStarTierClassName(tier),
    title: `${getPlayerStarTierLabel(tier)} — ${metricLabel} #${rank}`,
  };
}

/**
 * Abkürzungs-Tooltips (Audit T2/H7): jede Kachel erklärt ihr Kürzel im Titel.
 * Trägt die Kennzahl zusätzlich eine Star-Tier-Stufe, wird deren Erklärung angehängt —
 * eine der beiden ging vorher immer verloren.
 */
function withMetricTitle(base: string, extra: Partial<PortraitOverlayStat>): Partial<PortraitOverlayStat> {
  return { ...extra, title: extra.title ? `${base} · ${extra.title}` : base };
}

const ROSTER_METRIC_TITLES = {
  ovr: "OVR — Gesamtstärke (Overall)",
  pps: "PPs — Performance-Punkte dieser Saison, füllen sich ab Spieltag 1",
  mvs: "MVS — Marktwert-Score",
} as const;

export function buildRosterOverlayStats(input: BuildRosterOverlayInput): PortraitOverlayStat[] {
  const rankInline = input.rankStyle === "inline";
  const stats: PortraitOverlayStat[] = [
    stat(
      rankInline ? "OVR" : formatStatLabel("OVR", input.ovrRank),
      formatNumber(input.playerOvr, 1),
      withMetricTitle(ROSTER_METRIC_TITLES.ovr, {
        rankLabel: rankInline ? formatRankLabel(input.ovrRank) : null,
        heatClass: getPoolHeatClass(input.playerOvr, input.leagueHeatPools.ovr),
        ...starTierStatExtra("OVR", input.ovrRank),
      }),
    ),
    stat(
      rankInline ? "PPs" : formatStatLabel("PPs", input.ppsRank),
      input.playerPps != null ? formatNumber(input.playerPps, 1) : "—",
      withMetricTitle(ROSTER_METRIC_TITLES.pps, {
        rankLabel: rankInline ? formatRankLabel(input.ppsRank) : null,
        ...(input.playerPps != null
          ? { heatClass: getPoolHeatClass(input.playerPps, input.leagueHeatPools.pps) }
          : {}),
        ...starTierStatExtra("PPs", input.ppsRank),
      }),
    ),
  ];
  stats.push(
    stat(
      rankInline ? "MVS" : formatStatLabel("MVS", input.mvsRank),
      formatNumber(input.playerMvs, 1),
      withMetricTitle(
        // Chris-Regel (S1): bei 0/„—" wird erklärt, nicht versteckt — der leere
        // MVS sagt dazu, WANN er sich füllt (wie der PPs-Titel es schon tat).
        input.playerMvs == null ? `${ROSTER_METRIC_TITLES.mvs} — noch keine Wertung, füllt sich ab Spieltag 1` : ROSTER_METRIC_TITLES.mvs,
        {
          rankLabel: rankInline ? formatRankLabel(input.mvsRank) : null,
          heatClass: getPoolHeatClass(input.playerMvs, input.leagueHeatPools.mvs),
          ...starTierStatExtra("MVS", input.mvsRank),
        },
      ),
    ),
  );
  if (input.showCaPo && (input.caRating != null || input.poRangeMin != null || input.poRangeMax != null)) {
    stats.push(stat("CA", formatNumber(input.caRating, 0), { title: "CA — aktuelles Fähigkeitslevel (Current Ability)" }));
    stats.push(
      stat("PO", formatPotentialRange(input.poRangeMin, input.poRangeMax), {
        title: "PO — Potenzial-Spanne (mögliche Entwicklung)",
      }),
    );
  }
  return stats;
}

export function buildTrainingOverlayStats(data: PlayerPortraitTrainingContextData): PortraitOverlayStat[] {
  const net = data.netSetpoints;
  const netLabel =
    net == null || !Number.isFinite(net) ? "—" : `${net > 0 ? "+" : ""}${formatNumber(net, 1)}`;
  return [
    stat("CA", formatNumber(data.caRating, 0)),
    stat("PO", data.poDisplay ?? "—"),
    stat("Forecast", netLabel, {
      valueClass: net != null && net >= 0 ? "text-positive" : net != null && net < 0 ? "text-negative" : "",
    }),
  ];
}

export function buildMarketRailOverlayStats(data: PlayerPortraitMarketContextData): PortraitOverlayStat[] {
  return [
    stat("Fit", data.fitDisplay ?? "—", { valueClass: data.fitToneClass }),
    stat("MW", data.marketValue ?? "—"),
  ];
}

export function buildMarketOverlayStats(data: PlayerPortraitMarketContextData): PortraitOverlayStat[] {
  const stats: PortraitOverlayStat[] = [
    stat("Fit", data.fitDisplay ?? "—", { valueClass: data.fitToneClass }),
    stat("MW", data.marketValue ?? "—"),
    stat("Gehalt", data.salary ?? "—"),
    stat("Ratio", data.ratio ?? "—", { valueClass: data.ratioToneClass }),
  ];
  if (data.needScore) {
    stats.push(stat("Bedarf", data.needScore, { valueClass: data.needToneClass }));
  }
  if (data.ovr != null) {
    stats.push(stat("OVR", formatNumber(data.ovr, 1)));
  }
  return stats;
}

export function buildScoutingOverlayStats(data: PlayerPortraitScoutingContextData): PortraitOverlayStat[] {
  const stats: PortraitOverlayStat[] = [
    stat("Scout", data.scoutStatusLabel ?? "—"),
    stat("CA", data.caOverall != null ? formatNumber(data.caOverall, 0) : "—"),
    stat("PO", data.poDisplay ?? "—"),
  ];
  if (data.potentialBandLabel) {
    stats.push(stat("Band", data.potentialBandLabel));
  }
  if (data.scoutMilestone) {
    stats.push(stat("Meilenstein", data.scoutMilestone));
  }
  return stats;
}

export function buildLineupOverlayStats(data: PlayerPortraitLineupContextData): PortraitOverlayStat[] {
  return [
    stat("D1", data.d1Score ?? "—"),
    stat("D2", data.d2Score ?? "—"),
    stat("Slot", data.slotProjection ?? "—"),
    stat("Qualität", data.qualityGroup ?? "—"),
    ...(data.fatigueLabel ? [stat("Fatigue", data.fatigueLabel)] : []),
  ];
}

export function buildArenaOverlayStats(data: PlayerPortraitArenaContextData): PortraitOverlayStat[] {
  const stats: PortraitOverlayStat[] = [];
  if (data.rank != null) {
    stats.push(stat("Rang", `#${data.rank}`));
  }
  if (data.scoreLabel) stats.push(stat("Score", data.scoreLabel));
  if (data.pointsLabel) stats.push(stat("PPs", data.pointsLabel));
  if (data.contributionLabel) stats.push(stat("Beitrag", data.contributionLabel));
  return stats;
}

export type PlayerPortraitLayout = "stack" | "rail";

export type BuildContextOverlayOptions = BuildRosterOverlayInput & {
  context?: PlayerPortraitContext;
  contextData?: PlayerPortraitContextData;
  density?: PlayerPortraitDensity;
  layout?: PlayerPortraitLayout;
};

export function buildContextOverlayStats(options: BuildContextOverlayOptions): PortraitOverlayStat[] {
  const context = options.context ?? "roster";
  const density = options.density ?? "full";

  if (context === "tablePreview" && options.contextData?.tablePreview) {
    return options.contextData.tablePreview.stats.slice(0, density === "mini" ? 1 : 3);
  }
  if (context === "training" && options.contextData?.training) {
    return buildTrainingOverlayStats(options.contextData.training).slice(0, density === "compact" ? 4 : 6);
  }
  if (context === "market" && options.contextData?.market) {
    if (options.layout === "rail") {
      return buildMarketRailOverlayStats(options.contextData.market);
    }
    return buildMarketOverlayStats(options.contextData.market).slice(0, density === "compact" ? 4 : 6);
  }
  if (context === "scouting" && options.contextData?.scouting) {
    return buildScoutingOverlayStats(options.contextData.scouting).slice(0, density === "compact" ? 4 : 5);
  }
  if (context === "lineup" && options.contextData?.lineup) {
    return buildLineupOverlayStats(options.contextData.lineup).slice(0, density === "compact" ? 4 : 5);
  }
  if ((context === "arena" || context === "arenaReveal") && options.contextData?.arena) {
    return buildArenaOverlayStats(options.contextData.arena).slice(0, density === "compact" ? 3 : 4);
  }

  const rosterStats = buildRosterOverlayStats(options);
  if (density === "mini") return rosterStats.slice(0, 1);
  if (density === "compact") return rosterStats.slice(0, 3);
  return rosterStats;
}

export function shouldShowPortraitOrbit(
  context: PlayerPortraitContext | undefined,
  density: PlayerPortraitDensity,
  layout: PlayerPortraitLayout = "stack",
) {
  if (layout === "rail") return false;
  if (density === "mini") return false;
  if (context === "market") return density === "full";
  if (context === "training") return false;
  if (context === "scouting") return density === "full";
  return context === "roster" || context === "teamGrid" || context === "lineupCandidate" || context === "tablePreview" || context == null;
}
