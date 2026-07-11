import { getPoolHeatClass, type LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";

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

function formatMetricWithRank(value: number | null | undefined, rank: number | null | undefined, digits = 1) {
  const formattedValue = formatNumber(value, digits);
  return rank != null ? `${formattedValue} · #${rank}` : formattedValue;
}

function stat(label: string, value: string, extra?: Partial<PortraitOverlayStat>): PortraitOverlayStat {
  return { label, value, ...extra };
}

export function buildRosterOverlayStats(input: BuildRosterOverlayInput): PortraitOverlayStat[] {
  const rankInline = input.rankStyle === "inline";
  const stats: PortraitOverlayStat[] = [
    stat(
      rankInline ? "OVR" : formatStatLabel("OVR", input.ovrRank),
      rankInline ? formatMetricWithRank(input.playerOvr, input.ovrRank, 1) : formatNumber(input.playerOvr, 1),
      {
        heatClass: getPoolHeatClass(input.playerOvr, input.leagueHeatPools.ovr),
      },
    ),
    stat(
      rankInline ? "PPs" : formatStatLabel("PPs", input.ppsRank),
      rankInline
        ? formatMetricWithRank(input.playerPps, input.ppsRank, 1)
        : input.playerPps != null
          ? formatNumber(input.playerPps, 1)
          : "—",
      input.playerPps != null
        ? { heatClass: getPoolHeatClass(input.playerPps, input.leagueHeatPools.pps) }
        : undefined,
    ),
  ];
  stats.push(
    stat(
      rankInline ? "MVS" : formatStatLabel("MVS", input.mvsRank),
      rankInline ? formatMetricWithRank(input.playerMvs, input.mvsRank, 1) : formatNumber(input.playerMvs, 1),
      {
        heatClass: getPoolHeatClass(input.playerMvs, input.leagueHeatPools.mvs),
      },
    ),
  );
  if (input.showCaPo && (input.caRating != null || input.poRangeMin != null || input.poRangeMax != null)) {
    stats.push(stat("CA", formatNumber(input.caRating, 0)));
    stats.push(stat("PO", formatPotentialRange(input.poRangeMin, input.poRangeMax)));
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
