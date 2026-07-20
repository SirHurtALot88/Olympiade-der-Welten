import type {
  GameState,
  SeasonSnapshotPlayerPerformanceRecord,
  SeasonSnapshotRecord,
  SeasonSnapshotTeamRecord,
} from "@/lib/data/olyDataTypes";

export type MultiSeasonBalanceWarningType =
  | "team_dominance_risk"
  | "team_stuck_bottom"
  | "cash_hoarding"
  | "cash_crisis"
  | "salary_explosion"
  | "xp_growth_too_fast"
  | "facility_roi_too_high"
  | "facility_upkeep_too_low"
  | "discipline_points_outlier"
  | "form_color_overpowered"
  | "fatigue_too_harsh"
  | "market_inactive"
  | "ai_sell_buy_loop_suspicious"
  | "season_source_missing";

export type MultiSeasonBalanceWarning = {
  type: MultiSeasonBalanceWarningType;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  source: string;
  teamId?: string | null;
  playerId?: string | null;
  value?: number | null;
};

export type MultiSeasonBalanceTeamRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  seasons: number;
  championCount: number;
  averageRank: number | null;
  bestRank: number | null;
  worstRank: number | null;
  rankDelta: number | null;
  averagePoints: number | null;
  pointsBySeason: string;
  top5Count: number;
  bottom5Count: number;
  alwaysTop5: boolean;
  alwaysBottom5: boolean;
  source: string;
};

export type MultiSeasonBalanceEconomyRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  cashCurrent: number | null;
  cashEndAverage: number | null;
  cashMax: number | null;
  salaryCurrent: number | null;
  salaryEndAverage: number | null;
  salaryRatio: number | null;
  transferSpend: number;
  transferIncome: number;
  transferNet: number;
  facilityUpkeep: number;
  facilityIncome: number;
  facilityNet: number;
  warning: string | null;
};

export type MultiSeasonBalancePlayerRow = {
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  seasons: number;
  totalPoints: number | null;
  averageContribution: number | null;
  top10Count: number;
  mvpCount: number;
  xpSpent: number;
  attributeDelta: number;
  marketValueDelta: number | null;
  salaryPreviewDelta: number | null;
  valueSignal: number | null;
  source: string;
};

export type MultiSeasonBalanceGameplayRow = {
  metric: string;
  value: string;
  signal: number | null;
  source: string;
  warning: string | null;
};

export type MultiSeasonBalanceDashboard = {
  generatedAt: string;
  sourceSummary: {
    saveId: string | null;
    activeSeasonId: string;
    snapshotSeasons: string[];
    completedSeasonCount: number;
    hasCurrentSeasonData: boolean;
    missingSeasonIds: string[];
    seasonQuality: Array<{
      seasonId: string;
      status: "missing" | "partial" | "active" | "complete";
      source: string;
    }>;
  };
  summaryCards: Array<{
    label: string;
    value: string;
    detail: string;
    tone: "neutral" | "good" | "warning" | "danger";
  }>;
  teamRows: MultiSeasonBalanceTeamRow[];
  economyRows: MultiSeasonBalanceEconomyRow[];
  playerRows: MultiSeasonBalancePlayerRow[];
  gameplayRows: MultiSeasonBalanceGameplayRow[];
  warnings: MultiSeasonBalanceWarning[];
  exportLinks: Array<{ label: string; path: string }>;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function avg(values: number[]) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 2) : null;
}

function sum(values: Array<number | null | undefined>) {
  const total = values.reduce<number>((acc, value) => acc + (typeof value === "number" && Number.isFinite(value) ? value : 0), 0);
  return round(total, 2);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getTeamCode(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  return team?.shortCode ?? teamId;
}

function getTeamName(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  return team?.name ?? teamId;
}

function buildCurrentSeasonSnapshot(gameState: GameState): SeasonSnapshotRecord | null {
  const standings = Object.entries(gameState.seasonState.standings ?? {})
    .map<SeasonSnapshotTeamRecord | null>(([teamId, standing]) => {
      const team = gameState.teams.find((entry) => entry.teamId === teamId);
      if (!team) return null;
      const roster = gameState.rosters.filter((entry) => entry.teamId === teamId);
      const salary = sum(roster.map((entry) => entry.salary ?? entry.upkeep));
      const marketValue = sum(roster.map((entry) => entry.currentValue ?? entry.purchasePrice));
      return {
        teamId,
        teamCode: team.shortCode,
        teamName: team.name,
        rank: isNumber(standing.rank) ? standing.rank : null,
        points: isNumber(standing.points) ? standing.points : null,
        disciplinePoints: null,
        disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
        cashEnd: team.cash ?? null,
        rosterEnd: roster.length,
        rosterCountEnd: roster.length,
        salaryEnd: salary,
        salaryTotalEnd: salary,
        marketValueEnd: marketValue,
        marketValueTotalEnd: marketValue,
        transferCount: 0,
        transferBuyCount: 0,
        transferSellCount: 0,
        transferNet: 0,
      };
    })
    .filter((entry): entry is SeasonSnapshotTeamRecord => Boolean(entry));

  if (standings.length === 0) {
    return null;
  }

  return {
    seasonId: gameState.season.id,
    seasonName: gameState.season.name,
    archivedAt: new Date().toISOString(),
    status: gameState.gamePhase === "season_completed" ? "completed" : "partial",
    sourceStatus: "partial",
    finalStandings: standings,
    playerPerformances: [],
    warnings: gameState.gamePhase === "season_active" ? ["active_season_not_completed"] : [],
  };
}

function getAnalysisSnapshots(gameState: GameState) {
  const snapshots = [...(gameState.seasonState.seasonSnapshots ?? [])]
    .filter((snapshot) => snapshot.finalStandings.length > 0)
    .sort((left, right) => left.seasonId.localeCompare(right.seasonId, "de"));
  const current = buildCurrentSeasonSnapshot(gameState);
  if (current && !snapshots.some((snapshot) => snapshot.seasonId === current.seasonId)) {
    snapshots.push(current);
  }
  return snapshots;
}

function buildSeasonQuality(
  expectedSeasonIds: string[],
  snapshots: SeasonSnapshotRecord[],
  activeSeasonId: string,
) {
  const bySeasonId = new Map(snapshots.map((snapshot) => [snapshot.seasonId, snapshot] as const));
  return expectedSeasonIds.map((seasonId) => {
    const snapshot = bySeasonId.get(seasonId) ?? null;
    if (!snapshot) {
      return { seasonId, status: "missing", source: "missing_source" } as const;
    }
    if (snapshot.status === "completed") {
      return { seasonId, status: "complete", source: snapshot.sourceStatus ?? "seasonSnapshot" } as const;
    }
    if (seasonId === activeSeasonId) {
      return { seasonId, status: "active", source: snapshot.sourceStatus ?? "currentStandings" } as const;
    }
    return { seasonId, status: "partial", source: snapshot.sourceStatus ?? "partial_snapshot" } as const;
  });
}

function formatSeasonQualityLabel(status: "missing" | "partial" | "active" | "complete") {
  switch (status) {
    case "complete":
      return "complete";
    case "active":
      return "active";
    case "partial":
      return "partial";
    case "missing":
    default:
      return "missing";
  }
}

function buildTeamRows(gameState: GameState, snapshots: SeasonSnapshotRecord[]) {
  return gameState.teams.map((team) => {
    const rows = snapshots
      .map((snapshot) => ({ snapshot, row: snapshot.finalStandings.find((entry) => entry.teamId === team.teamId) ?? null }))
      .filter((entry): entry is { snapshot: SeasonSnapshotRecord; row: SeasonSnapshotTeamRecord } => Boolean(entry.row));
    const ranks = rows.map((entry) => entry.row.rank).filter(isNumber);
    const points = rows.map((entry) => entry.row.points).filter(isNumber);
    const firstRank = ranks[0] ?? null;
    const lastRank = ranks[ranks.length - 1] ?? null;
    const bottomThreshold = Math.max(1, gameState.teams.length - 4);

    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      seasons: rows.length,
      championCount: rows.filter((entry) => entry.row.rank === 1).length,
      averageRank: avg(ranks),
      bestRank: ranks.length ? Math.min(...ranks) : null,
      worstRank: ranks.length ? Math.max(...ranks) : null,
      rankDelta: firstRank != null && lastRank != null ? firstRank - lastRank : null,
      averagePoints: avg(points),
      pointsBySeason: rows.map((entry) => `${entry.snapshot.seasonId}: ${entry.row.points ?? "—"}`).join(" · ") || "—",
      top5Count: rows.filter((entry) => (entry.row.rank ?? 99) <= 5).length,
      bottom5Count: rows.filter((entry) => (entry.row.rank ?? 0) >= bottomThreshold).length,
      alwaysTop5: rows.length >= 2 && rows.every((entry) => (entry.row.rank ?? 99) <= 5),
      alwaysBottom5: rows.length >= 2 && rows.every((entry) => (entry.row.rank ?? 0) >= bottomThreshold),
      source: rows.length ? "completedSeasonSnapshots" : "missing_source",
    } satisfies MultiSeasonBalanceTeamRow;
  }).sort((left, right) => (left.averageRank ?? 99) - (right.averageRank ?? 99));
}

function buildEconomyRows(gameState: GameState, snapshots: SeasonSnapshotRecord[]) {
  return gameState.teams.map((team) => {
    const snapshotRows = snapshots
      .map((snapshot) => snapshot.finalStandings.find((entry) => entry.teamId === team.teamId) ?? null)
      .filter((entry): entry is SeasonSnapshotTeamRecord => Boolean(entry));
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const salaryCurrent = sum(roster.map((entry) => entry.salary ?? entry.upkeep));
    const transferSpend = sum(gameState.transferHistory.filter((entry) => entry.toTeamId === team.teamId && entry.transferType === "buy").map((entry) => entry.fee));
    const transferIncome = sum(gameState.transferHistory.filter((entry) => entry.fromTeamId === team.teamId && entry.transferType === "sell").map((entry) => entry.fee));
    const facilityEvents = gameState.seasonState.facilityEvents ?? [];
    const facilityUpkeep = sum(facilityEvents.filter((entry) => entry.teamId === team.teamId && entry.source === "facility_upkeep_paid").map((entry) => entry.cost));
    const facilityIncome = sum(facilityEvents.filter((entry) => entry.teamId === team.teamId && entry.source === "facility_income_collected").map((entry) => entry.cost));
    const salaryRatio = team.cash > 0 ? round(salaryCurrent / team.cash, 2) : null;
    const cashValues = snapshotRows.map((entry) => entry.cashEnd).filter(isNumber);
    const warning =
      team.cash < 0
        ? "cash_crisis"
        : team.cash >= Math.max(team.budget * 1.5, 180)
          ? "cash_hoarding"
          : salaryRatio != null && salaryRatio > 1
            ? "salary_explosion"
            : null;

    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      cashCurrent: team.cash ?? null,
      cashEndAverage: avg(cashValues),
      cashMax: cashValues.length ? Math.max(...cashValues, team.cash ?? 0) : team.cash ?? null,
      salaryCurrent,
      salaryEndAverage: avg(snapshotRows.map((entry) => entry.salaryEnd ?? entry.salaryTotalEnd).filter(isNumber)),
      salaryRatio,
      transferSpend,
      transferIncome,
      transferNet: round(transferIncome - transferSpend, 2),
      facilityUpkeep,
      facilityIncome,
      facilityNet: round(facilityIncome - facilityUpkeep, 2),
      warning,
    } satisfies MultiSeasonBalanceEconomyRow;
  }).sort((left, right) => (right.cashCurrent ?? 0) - (left.cashCurrent ?? 0));
}

function buildPlayerRows(gameState: GameState, snapshots: SeasonSnapshotRecord[]) {
  const byPlayer = new Map<string, SeasonSnapshotPlayerPerformanceRecord[]>();
  for (const snapshot of snapshots) {
    for (const performance of snapshot.playerPerformances ?? []) {
      byPlayer.set(performance.playerId, [...(byPlayer.get(performance.playerId) ?? []), performance]);
    }
  }

  const progressionByPlayer = new Map<string, NonNullable<GameState["playerProgressionEvents"]>>();
  for (const event of gameState.playerProgressionEvents ?? []) {
    progressionByPlayer.set(event.playerId, [...(progressionByPlayer.get(event.playerId) ?? []), event]);
  }

  const playerIds = new Set([...byPlayer.keys(), ...progressionByPlayer.keys()]);
  return [...playerIds].map((playerId) => {
    const performances = byPlayer.get(playerId) ?? [];
    const progression = progressionByPlayer.get(playerId) ?? [];
    const player = gameState.players.find((entry) => entry.id === playerId) ?? null;
    const totalPoints = sum(performances.map((entry) => entry.totalPoints ?? entry.totalContribution));
    const xpSpent = sum(progression.map((event) => event.xpSpent));
    const attributeDelta = sum(progression.flatMap((event) => event.upgrades.map((upgrade) => upgrade.toValue - upgrade.fromValue)));
    const marketValueBefore = progression.map((event) => event.progressionSnapshotBefore?.marketValue).find(isNumber) ?? null;
    const marketValueAfter = [...progression].reverse().map((event) => event.progressionSnapshotAfter?.marketValuePreview ?? event.progressionSnapshotAfter?.marketValue).find(isNumber) ?? null;
    const salaryBefore = progression.map((event) => event.progressionSnapshotBefore?.salary).find(isNumber) ?? null;
    const salaryAfter = [...progression].reverse().map((event) => event.progressionSnapshotAfter?.salaryPreview ?? event.progressionSnapshotAfter?.salary).find(isNumber) ?? null;
    const latestPerformance = performances[performances.length - 1] ?? null;
    const roster = gameState.rosters.find((entry) => entry.playerId === playerId) ?? null;
    const teamId = latestPerformance?.teamId ?? roster?.teamId ?? null;

    return {
      playerId,
      playerName: latestPerformance?.playerName ?? player?.name ?? playerId,
      teamId,
      teamName: latestPerformance?.teamName ?? (teamId ? getTeamName(gameState, teamId) : null),
      seasons: performances.length,
      totalPoints,
      averageContribution: avg(performances.map((entry) => entry.averageContribution).filter(isNumber)),
      top10Count: sum(performances.map((entry) => entry.top10Count)),
      mvpCount: sum(performances.map((entry) => entry.mvpCount)),
      xpSpent,
      attributeDelta,
      marketValueDelta: marketValueBefore != null && marketValueAfter != null ? round(marketValueAfter - marketValueBefore, 2) : null,
      salaryPreviewDelta: salaryBefore != null && salaryAfter != null ? round(salaryAfter - salaryBefore, 2) : null,
      valueSignal: totalPoints != null && roster?.salary ? round(totalPoints / Math.max(roster.salary, 0.1), 2) : null,
      source: performances.length ? "seasonSnapshots.playerPerformances" : "progressionEvents",
    } satisfies MultiSeasonBalancePlayerRow;
  }).sort((left, right) => (right.xpSpent - left.xpSpent) || ((right.totalPoints ?? 0) - (left.totalPoints ?? 0))).slice(0, 30);
}

function buildGameplayRows(snapshots: SeasonSnapshotRecord[]) {
  const areaTotals = { pow: 0, spe: 0, men: 0, soc: 0 };
  for (const snapshot of snapshots) {
    for (const row of snapshot.finalStandings) {
      areaTotals.pow += row.disciplinePointsByArea.pow ?? 0;
      areaTotals.spe += row.disciplinePointsByArea.spe ?? 0;
      areaTotals.men += row.disciplinePointsByArea.men ?? 0;
      areaTotals.soc += row.disciplinePointsByArea.soc ?? 0;
    }
  }
  const values = Object.values(areaTotals);
  const average = avg(values) ?? 0;
  const strongest = Object.entries(areaTotals).sort((left, right) => right[1] - left[1])[0] ?? null;
  const outlier = strongest && average > 0 ? strongest[1] / average : null;
  const topPlayer = snapshots.flatMap((snapshot) => snapshot.playerPerformances.map((entry) => ({ snapshot, entry })))
    .sort((left, right) => (right.entry.totalPoints ?? right.entry.totalContribution ?? 0) - (left.entry.totalPoints ?? left.entry.totalContribution ?? 0))[0] ?? null;

  return [
    {
      metric: "Staerkste Achse",
      value: strongest ? `${strongest[0].toUpperCase()} ${round(strongest[1], 1)}` : "—",
      signal: outlier ? round(outlier, 2) : null,
      source: "seasonSnapshots.finalStandings.disciplinePointsByArea",
      warning: outlier && outlier > 1.25 ? "discipline_points_outlier" : null,
    },
    {
      metric: "Top Player gesamt",
      value: topPlayer ? `${topPlayer.entry.playerName} (${topPlayer.snapshot.seasonId})` : "—",
      signal: topPlayer ? (topPlayer.entry.totalPoints ?? topPlayer.entry.totalContribution ?? null) : null,
      source: topPlayer ? "seasonSnapshots.playerPerformances" : "missing_source",
      warning: null,
    },
    {
      metric: "Formfarben-Wirkung",
      value: "—",
      signal: null,
      source: "source_missing",
      warning: "form_color_source_missing",
    },
    {
      metric: "Fatigue-Ausreisser",
      value: "—",
      signal: null,
      source: "source_missing",
      warning: "fatigue_source_missing",
    },
    {
      metric: "Captain-Nutzung",
      value: "—",
      signal: null,
      source: "source_missing",
      warning: "captain_usage_source_missing",
    },
    {
      metric: "Mutator-Effekt",
      value: "Audit vorhanden",
      signal: null,
      source: "lineupDraft.modifiers / mutator audit",
      warning: null,
    },
  ] satisfies MultiSeasonBalanceGameplayRow[];
}

function buildWarnings(input: {
  gameState: GameState;
  snapshots: SeasonSnapshotRecord[];
  teamRows: MultiSeasonBalanceTeamRow[];
  economyRows: MultiSeasonBalanceEconomyRow[];
  playerRows: MultiSeasonBalancePlayerRow[];
  gameplayRows: MultiSeasonBalanceGameplayRow[];
  missingSeasonIds: string[];
}) {
  const warnings: MultiSeasonBalanceWarning[] = [];
  for (const seasonId of input.missingSeasonIds) {
    warnings.push({
      type: "season_source_missing",
      severity: "warning",
      title: `${seasonId} fehlt`,
      message: "Diese Season ist im aktiven Save nicht als Snapshot vorhanden. Dashboard zeigt dafür keine Fakewerte.",
      source: "seasonSnapshots",
    });
  }

  for (const row of input.teamRows) {
    if (row.alwaysTop5) {
      warnings.push({ type: "team_dominance_risk", severity: "warning", title: `${row.teamCode} dominiert`, message: `${row.teamName} war in allen vorhandenen Seasons Top 5.`, source: row.source, teamId: row.teamId, value: row.averageRank });
    }
    if (row.alwaysBottom5) {
      warnings.push({ type: "team_stuck_bottom", severity: "warning", title: `${row.teamCode} steckt unten fest`, message: `${row.teamName} war in allen vorhandenen Seasons Bottom 5.`, source: row.source, teamId: row.teamId, value: row.averageRank });
    }
  }

  for (const row of input.economyRows) {
    if (row.warning === "cash_hoarding") {
      warnings.push({ type: "cash_hoarding", severity: "warning", title: `${row.teamCode} hortet Cash`, message: `Aktuelles Cash ${row.cashCurrent}.`, source: "teams.cash", teamId: row.teamId, value: row.cashCurrent });
    }
    if (row.warning === "cash_crisis") {
      warnings.push({ type: "cash_crisis", severity: "danger", title: `${row.teamCode} ist negativ`, message: `Aktuelles Cash ${row.cashCurrent}.`, source: "teams.cash", teamId: row.teamId, value: row.cashCurrent });
    }
    if (row.warning === "salary_explosion") {
      warnings.push({ type: "salary_explosion", severity: "warning", title: `${row.teamCode} Gehaltsdruck`, message: `Gehaltsquote ${row.salaryRatio}.`, source: "rosters.salary", teamId: row.teamId, value: row.salaryRatio });
    }
    if (row.facilityIncome > 0 && row.facilityUpkeep > 0 && row.facilityIncome / row.facilityUpkeep > 3) {
      warnings.push({ type: "facility_roi_too_high", severity: "warning", title: `${row.teamCode} Facility ROI hoch`, message: `Income ${row.facilityIncome} vs Upkeep ${row.facilityUpkeep}.`, source: "facilityEvents", teamId: row.teamId, value: row.facilityIncome / row.facilityUpkeep });
    }
    if (row.facilityIncome > 0 && row.facilityUpkeep === 0) {
      warnings.push({ type: "facility_upkeep_too_low", severity: "warning", title: `${row.teamCode} Facility ohne Upkeep`, message: `Income ${row.facilityIncome}, Upkeep 0.`, source: "facilityEvents", teamId: row.teamId, value: row.facilityIncome });
    }
  }

  for (const row of input.playerRows) {
    if (row.attributeDelta >= 8) {
      warnings.push({ type: "xp_growth_too_fast", severity: "warning", title: `${row.playerName} waechst schnell`, message: `Attributdelta ${row.attributeDelta}.`, source: row.source, teamId: row.teamId, playerId: row.playerId, value: row.attributeDelta });
    }
  }

  for (const row of input.gameplayRows) {
    if (row.warning === "discipline_points_outlier") {
      warnings.push({ type: "discipline_points_outlier", severity: "warning", title: "Achse kippt", message: `${row.metric}: ${row.value}.`, source: row.source, value: row.signal });
    }
  }

  const aiMarketTransfers = input.gameState.transferHistory.filter((entry) => String(entry.source ?? "").startsWith("ai_preseason_market"));
  if (aiMarketTransfers.length === 0 && input.snapshots.length >= 1) {
    warnings.push({ type: "market_inactive", severity: "info", title: "AI-Market inaktiv", message: "Keine AI-Preseason-Transfers im aktiven Save gefunden.", source: "transferHistory" });
  }
  const buySellByPlayer = new Map<string, Set<"buy" | "sell">>();
  for (const entry of aiMarketTransfers) {
    if (entry.transferType !== "buy" && entry.transferType !== "sell") {
      continue;
    }
    buySellByPlayer.set(entry.playerId, new Set([...(buySellByPlayer.get(entry.playerId) ?? []), entry.transferType]));
  }
  for (const [playerId, types] of buySellByPlayer.entries()) {
    if (types.has("buy") && types.has("sell")) {
      warnings.push({ type: "ai_sell_buy_loop_suspicious", severity: "warning", title: "AI Buy/Sell Loop", message: `${playerId} wurde von AI gekauft und verkauft.`, source: "transferHistory", playerId });
    }
  }

  return warnings;
}

export function buildMultiSeasonBalanceDashboard(gameState: GameState): MultiSeasonBalanceDashboard {
  const snapshots = getAnalysisSnapshots(gameState);
  const snapshotSeasonIds = snapshots.map((snapshot) => snapshot.seasonId);
  const expectedSeasonIds = ["season-1", "season-2", "season-3"].filter((seasonId) =>
    Number(seasonId.replace("season-", "")) <= Math.max(3, gameState.season.year ?? 1),
  );
  const missingSeasonIds = expectedSeasonIds.filter((seasonId) => !snapshotSeasonIds.includes(seasonId));
  const completedSnapshots = snapshots.filter((snapshot) => snapshot.status === "completed");
  const seasonQuality = buildSeasonQuality(expectedSeasonIds, snapshots, gameState.season.id);
  const teamRows = buildTeamRows(gameState, completedSnapshots);
  const economyRows = buildEconomyRows(gameState, completedSnapshots);
  const playerRows = buildPlayerRows(gameState, completedSnapshots);
  const gameplayRows = buildGameplayRows(completedSnapshots);
  const warnings = buildWarnings({ gameState, snapshots: completedSnapshots, teamRows, economyRows, playerRows, gameplayRows, missingSeasonIds });
  const championLabels = completedSnapshots
    .map((snapshot) => {
      const champion = [...snapshot.finalStandings].sort((left, right) => (left.rank ?? 99) - (right.rank ?? 99))[0] ?? null;
      return champion ? `${snapshot.seasonId}: ${champion.teamCode}` : null;
    })
    .filter((entry): entry is string => Boolean(entry));
  const cashMax = economyRows[0] ?? null;

  return {
    generatedAt: new Date().toISOString(),
    sourceSummary: {
      saveId: null,
      activeSeasonId: gameState.season.id,
      snapshotSeasons: snapshotSeasonIds,
      completedSeasonCount: completedSnapshots.length,
      hasCurrentSeasonData: snapshots.some((snapshot) => snapshot.seasonId === gameState.season.id),
      missingSeasonIds,
      seasonQuality,
    },
    summaryCards: [
      {
        label: "Seasons im Dashboard",
        value: `${snapshots.length}`,
        detail: snapshotSeasonIds.join(" · ") || "—",
        tone: snapshots.length >= 2 ? "good" : "warning",
      },
      {
        label: "Data Quality",
        value: `${completedSnapshots.length} complete`,
        detail: seasonQuality.map((entry) => `${entry.seasonId.replace("season-", "S")}: ${formatSeasonQualityLabel(entry.status)}`).join(" · "),
        tone: seasonQuality.some((entry) => entry.status === "missing") ? "warning" : completedSnapshots.length >= 2 ? "good" : "neutral",
      },
      {
        label: "Champions",
        value: championLabels.length ? championLabels.join(" · ") : "—",
        detail: "nur abgeschlossene Snapshots",
        tone: championLabels.length ? "neutral" : "warning",
      },
      {
        label: "Cash Peak",
        value: cashMax ? `${cashMax.teamCode} ${cashMax.cashCurrent ?? "—"}` : "—",
        detail: "aktueller lokaler Save",
        tone: cashMax?.warning === "cash_hoarding" ? "warning" : "neutral",
      },
      {
        label: "Warnings",
        value: `${warnings.length}`,
        detail: warnings.slice(0, 2).map((warning) => warning.type).join(" · ") || "keine",
        tone: warnings.some((warning) => warning.severity === "danger") ? "danger" : warnings.length ? "warning" : "good",
      },
    ],
    teamRows,
    economyRows,
    playerRows,
    gameplayRows,
    warnings,
    exportLinks: [
      { label: "Multi-Season Summary", path: "/outputs/multiseason-rerun-summary.md" },
      { label: "Balance Flags", path: "/outputs/multiseason-balance-flags.csv" },
      { label: "S3 Readiness", path: "/outputs/season3-readiness-audit.csv" },
      { label: "AI Market Actions", path: "/outputs/ai-market-season2-actions.csv" },
    ],
  };
}
