import fs from "node:fs";
import path from "node:path";

import type { GameState, SeasonSnapshotRecord, SeasonSnapshotTeamRecord, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { buildMultiSeasonBalanceDashboard } from "@/lib/foundation/multiseason-balance-dashboard";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type CsvValue = string | number | boolean | null | undefined;

const OUTPUT_ROOT = process.env.OLY_EXPORT_DIR ?? "outputs";

function argValue(name: string) {
  const inlinePrefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function round(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function num(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function csvEscape(value: CsvValue) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(outputDir: string, fileName: string, rows: Record<string, CsvValue>[]) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  fs.writeFileSync(
    path.join(outputDir, fileName),
    `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`,
    "utf8",
  );
}

function teamCode(gameState: GameState, teamId: string | null | undefined) {
  if (!teamId) return "";
  return gameState.teams.find((team) => team.teamId === teamId)?.shortCode ?? teamId;
}

function teamName(gameState: GameState, teamId: string | null | undefined) {
  if (!teamId) return "";
  return gameState.teams.find((team) => team.teamId === teamId)?.name ?? teamId;
}

function completedSnapshots(gameState: GameState) {
  return [...(gameState.seasonState.seasonSnapshots ?? [])]
    .filter((snapshot) => snapshot.status === "completed" && snapshot.finalStandings.length > 0)
    .sort((left, right) => left.seasonId.localeCompare(right.seasonId, "de"));
}

function snapshotTeamRows(snapshots: SeasonSnapshotRecord[]) {
  return snapshots.flatMap((snapshot) =>
    snapshot.finalStandings.map((row) => ({ snapshot, row })),
  );
}

function getCash(row: SeasonSnapshotTeamRecord) {
  return row.cashTotal ?? row.cashEnd ?? null;
}

function getSalary(row: SeasonSnapshotTeamRecord) {
  return row.salaryTotalEnd ?? row.salaryEnd ?? null;
}

function getMarketValue(row: SeasonSnapshotTeamRecord) {
  return row.marketValueTotalEnd ?? row.marketValueEnd ?? null;
}

function buildCashRows(snapshots: SeasonSnapshotRecord[]) {
  return snapshotTeamRows(snapshots).map(({ snapshot, row }) => ({
    seasonId: snapshot.seasonId,
    teamCode: row.teamCode,
    teamName: row.teamName,
    rank: row.rank,
    points: round(row.points),
    cashEnd: round(getCash(row)),
    guv: round(row.guv),
    sponsorSeason: round(row.sponsorSeason),
    sponsorTotal: round(row.sponsorTotal),
    transferNet: round(row.transferNet),
    status: getCash(row) != null && Number(getCash(row)) < 0 ? "red" : getCash(row) != null && Number(getCash(row)) < 5 ? "watch" : "ok",
  }));
}

function buildRosterRows(snapshots: SeasonSnapshotRecord[]) {
  return snapshotTeamRows(snapshots).map(({ snapshot, row }) => ({
    seasonId: snapshot.seasonId,
    teamCode: row.teamCode,
    teamName: row.teamName,
    rosterEnd: row.rosterCountEnd ?? row.rosterEnd ?? null,
    transferCount: row.transferCount ?? null,
    transferBuyCount: row.transferBuyCount ?? null,
    transferSellCount: row.transferSellCount ?? null,
    status:
      (row.rosterCountEnd ?? row.rosterEnd ?? 0) < 8
        ? "red"
        : (row.rosterCountEnd ?? row.rosterEnd ?? 0) < 10
          ? "watch"
          : "ok",
  }));
}

function buildEconomyDriftRows(snapshots: SeasonSnapshotRecord[]) {
  return snapshotTeamRows(snapshots).map(({ snapshot, row }) => {
    const salary = getSalary(row);
    const marketValue = getMarketValue(row);
    const cash = getCash(row);
    const salaryToMarketPct = salary != null && marketValue ? round((salary / marketValue) * 100) : null;
    return {
      seasonId: snapshot.seasonId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      cashEnd: round(cash),
      salaryTotal: round(salary),
      marketValueTotal: round(marketValue),
      salaryToMarketPct,
      status:
        cash != null && cash < 0
          ? "red"
          : salaryToMarketPct != null && salaryToMarketPct > 35
            ? "watch"
            : "ok",
    };
  });
}

function buildDevelopmentRows(gameState: GameState) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return (gameState.playerProgressionEvents ?? []).map((event) => {
    const player = playerById.get(event.playerId);
    const attributeDelta = event.upgrades.reduce((sum, upgrade) => sum + Math.max(0, upgrade.toValue - upgrade.fromValue), 0);
    return {
      seasonId: event.seasonId,
      teamCode: teamCode(gameState, event.teamId),
      playerId: event.playerId,
      playerName: player?.name ?? event.playerId,
      xpEarned: round(event.xpEarned),
      xpSpent: round(event.xpSpent),
      upgradeCount: event.upgrades.length,
      attributeDelta,
      marketValueBefore: round(event.progressionSnapshotBefore?.marketValue),
      marketValueAfter: round(event.progressionSnapshotAfter?.marketValue),
      salaryBefore: round(event.progressionSnapshotBefore?.salary),
      salaryAfter: round(event.progressionSnapshotAfter?.salary),
      status: attributeDelta >= 8 || num(event.xpSpent) >= 20 ? "watch" : "ok",
      warnings: event.economyWarnings?.join("|") ?? "",
    };
  });
}

function buildDominanceRows(gameState: GameState, snapshots: SeasonSnapshotRecord[]) {
  const bottomThreshold = Math.max(1, gameState.teams.length - 4);
  return gameState.teams.map((team) => {
    const rows = snapshots
      .map((snapshot) => snapshot.finalStandings.find((entry) => entry.teamId === team.teamId) ?? null)
      .filter((entry): entry is SeasonSnapshotTeamRecord => Boolean(entry));
    const ranks = rows.map((row) => row.rank).filter((rank): rank is number => typeof rank === "number");
    const top3 = ranks.filter((rank) => rank <= 3).length;
    const top5 = ranks.filter((rank) => rank <= 5).length;
    const bottom5 = ranks.filter((rank) => rank >= bottomThreshold).length;
    const averageRank = ranks.length ? round(ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length) : null;
    return {
      teamCode: team.shortCode,
      teamName: team.name,
      seasons: rows.length,
      championCount: ranks.filter((rank) => rank === 1).length,
      top3,
      top5,
      bottom5,
      averageRank,
      bestRank: ranks.length ? Math.min(...ranks) : null,
      worstRank: ranks.length ? Math.max(...ranks) : null,
      status:
        rows.length >= 3 && (top5 === rows.length || bottom5 === rows.length)
          ? "watch"
          : rows.length >= 4 && (top3 >= rows.length - 1 || bottom5 >= rows.length - 1)
            ? "watch"
            : "ok",
    };
  });
}

function buildTransferProfitRows(gameState: GameState) {
  const rows = gameState.transferHistory.map((entry) => {
    const fee = num(entry.fee);
    const marketValue = num(entry.marketValue);
    const delta = round(fee - marketValue);
    const factor = marketValue > 0 ? round(fee / marketValue, 3) : null;
    return {
      seasonId: entry.seasonId,
      type: entry.transferType,
      playerId: entry.playerId,
      playerName: entry.playerName ?? "",
      fromTeam: teamCode(gameState, entry.fromTeamId),
      toTeam: teamCode(gameState, entry.toTeamId),
      fee: round(fee),
      marketValue: round(marketValue),
      salary: round(entry.salary),
      feeMinusMarketValue: delta,
      feeMarketValueFactor: factor,
      panicSellSignal: entry.transferType === "sell" && factor != null && factor < 0.85,
      overpaySignal: entry.transferType === "buy" && factor != null && factor > 1.2,
      source: entry.source ?? "",
    };
  });
  return rows;
}

function buildFacilityRows(gameState: GameState) {
  const events = gameState.seasonState.facilityEvents ?? [];
  const byTeamSeason = new Map<string, { seasonId: string; teamId: string; upkeep: number; income: number; investments: number }>();
  for (const event of events) {
    const key = `${event.seasonId}:${event.teamId}`;
    const row = byTeamSeason.get(key) ?? { seasonId: event.seasonId, teamId: event.teamId, upkeep: 0, income: 0, investments: 0 };
    if (event.source === "facility_upkeep_paid") row.upkeep += Math.abs(num(event.cost));
    else if (event.source === "facility_income_collected") row.income += Math.abs(num(event.cost));
    else row.investments += Math.abs(num(event.cost));
    byTeamSeason.set(key, row);
  }
  return [...byTeamSeason.values()].map((row) => ({
    seasonId: row.seasonId,
    teamCode: teamCode(gameState, row.teamId),
    teamName: teamName(gameState, row.teamId),
    upkeep: round(row.upkeep),
    income: round(row.income),
    investments: round(row.investments),
    net: round(row.income - row.upkeep - row.investments),
    roi: row.upkeep + row.investments > 0 ? round(row.income / (row.upkeep + row.investments), 3) : null,
    status: row.income > 0 && row.upkeep === 0 ? "watch" : "ok",
  }));
}

function buildBoardRows(gameState: GameState) {
  const objectives = gameState.seasonState.teamSeasonObjectives ?? [];
  return gameState.teams.map((team) => {
    const teamObjectives = objectives.filter((objective) => objective.teamId === team.teamId);
    const board = gameState.seasonState.boardConfidence?.[team.teamId] ?? null;
    const completed = teamObjectives.filter((objective) => objective.status === "completed").length;
    const failed = teamObjectives.filter((objective) => objective.status === "failed").length;
    const atRisk = teamObjectives.filter((objective) => objective.status === "at_risk").length;
    return {
      seasonId: gameState.season.id,
      teamCode: team.shortCode,
      teamName: team.name,
      boardConfidence: round(board?.value),
      boardPressure: round(board?.pressure),
      objectiveCount: teamObjectives.length,
      completed,
      failed,
      atRisk,
      open: teamObjectives.length - completed - failed - atRisk,
      status: failed > 0 || (board?.pressure ?? 0) >= 8 ? "watch" : "ok",
      warnings: board?.warnings?.join("|") ?? "",
    };
  });
}

function buildFatigueRows(gameState: GameState) {
  const moraleRows = gameState.playerMorale ?? [];
  const byTeam = new Map<string, { teamId: string; rows: typeof moraleRows }>();
  for (const row of moraleRows) {
    byTeam.set(row.teamId, { teamId: row.teamId, rows: [...(byTeam.get(row.teamId)?.rows ?? []), row] });
  }
  return [...byTeam.values()].map(({ teamId, rows }) => {
    const fatigueValues = rows.map((row) => num(row.fatigue)).filter(Number.isFinite);
    const injured = rows.filter((row) => row.availabilityStatus === "injured").length;
    const avgFatigue = fatigueValues.length ? round(fatigueValues.reduce((sum, value) => sum + value, 0) / fatigueValues.length) : null;
    return {
      seasonId: gameState.season.id,
      teamCode: teamCode(gameState, teamId),
      teamName: teamName(gameState, teamId),
      playerRows: rows.length,
      avgFatigue,
      injured,
      status: injured >= 3 || (avgFatigue ?? 0) >= 70 ? "watch" : "ok",
      source: rows.length ? "playerMorale" : "source_missing",
    };
  });
}

function buildIdentityRows(gameState: GameState) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return gameState.teams.map((team) => {
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const classCounts = new Map<string, number>();
    const areaTotals = { pow: 0, spe: 0, men: 0, soc: 0 };
    for (const entry of roster) {
      const player = playerById.get(entry.playerId);
      if (!player) continue;
      classCounts.set(player.className, (classCounts.get(player.className) ?? 0) + 1);
      areaTotals.pow += num(player.pow);
      areaTotals.spe += num(player.spe);
      areaTotals.men += num(player.men);
      areaTotals.soc += num(player.soc);
    }
    const count = Math.max(1, roster.length);
    const preferred = [
      ["pow", num(identity?.pow)],
      ["spe", num(identity?.spe)],
      ["men", num(identity?.men)],
      ["soc", num(identity?.soc)],
    ].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "unknown";
    const strongest = Object.entries(areaTotals).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "unknown";
    return {
      teamCode: team.shortCode,
      teamName: team.name,
      rosterCount: roster.length,
      preferredAxis: preferred,
      strongestRosterAxis: strongest,
      avgPow: round(areaTotals.pow / count),
      avgSpe: round(areaTotals.spe / count),
      avgMen: round(areaTotals.men / count),
      avgSoc: round(areaTotals.soc / count),
      classCount: classCounts.size,
      topClassSharePct: round((Math.max(0, ...classCounts.values()) / count) * 100),
      status: preferred !== strongest ? "watch" : "ok",
      source: "current_roster_identity_proxy",
    };
  });
}

function buildSummary(input: {
  saveId: string;
  saveName: string;
  snapshots: SeasonSnapshotRecord[];
  cashRows: Record<string, CsvValue>[];
  dominanceRows: Record<string, CsvValue>[];
  economyRows: Record<string, CsvValue>[];
  identityRows: Record<string, CsvValue>[];
  developmentRows: Record<string, CsvValue>[];
  boardRows: Record<string, CsvValue>[];
  transferRows: Record<string, CsvValue>[];
}) {
  const redCash = input.cashRows.filter((row) => row.status === "red").length;
  const watchDominance = input.dominanceRows.filter((row) => row.status === "watch").length;
  const economyWarnings = input.economyRows.filter((row) => row.status !== "ok").length;
  const identityWarnings = input.identityRows.filter((row) => row.status !== "ok").length;
  const xpWarnings = input.developmentRows.filter((row) => row.status !== "ok").length;
  const boardWarnings = input.boardRows.filter((row) => row.status !== "ok").length;
  const overpays = input.transferRows.filter((row) => row.overpaySignal === true).length;
  const panicSells = input.transferRows.filter((row) => row.panicSellSignal === true).length;
  const status =
    redCash > 0 || economyWarnings > 8
      ? "RED"
      : watchDominance > 0 || identityWarnings > 8 || xpWarnings > 0 || boardWarnings > 0 || overpays + panicSells > 10
        ? "YELLOW"
        : "GREEN";

  return [
    "# Balancing Block 3: Full Multi-Season Playability Audit",
    "",
    `Ampel: ${status}`,
    `Save: ${input.saveName} (${input.saveId})`,
    `Completed Snapshots: ${input.snapshots.length}`,
    "",
    "## Plausibilitaet",
    `- Negative Cash Team-Seasons: ${redCash}`,
    `- Economy Drift Warnings: ${economyWarnings}`,
    `- Dominanz-/Bottom-Stuck Warnings: ${watchDominance}`,
    `- Identity-Fit Warnings: ${identityWarnings}`,
    `- XP/Progression Warnings: ${xpWarnings}`,
    `- Board Warnings: ${boardWarnings}`,
    `- Overpay-Signale: ${overpays}`,
    `- Panikverkauf-Signale: ${panicSells}`,
    "",
    "## Interpretation",
    "- GREEN heisst hier nicht nur test-gruen, sondern: Cash, Kader, Economy und Dominanz haben keine harten Ausreisser.",
    "- YELLOW heisst spielbar, aber Balancing/AI-Verhalten braucht Feinschliff.",
    "- RED heisst: Vor Testseason erst Ursache beheben oder bewusst als Risiko akzeptieren.",
    "",
    "## Dateien",
    "- block3-cash-verlauf-pro-team.csv",
    "- block3-kadergroesse-pro-team.csv",
    "- block3-mw-gehalt-verlauf.csv",
    "- block3-xp-ovr-progression.csv",
    "- block3-team-identity-fit-over-time.csv",
    "- block3-winner-loser-dominanz.csv",
    "- block3-fatigue-injury-pressure.csv",
    "- block3-facility-investment-roi.csv",
    "- block3-boardziel-erfuellung.csv",
    "- block3-transfer-profit-panic-overpay.csv",
  ].join("\n");
}

function main() {
  const persistence = createPersistenceService();
  const activeSave = persistence.getActiveSave();
  const saveId = argValue("--save") ?? process.env.OLY_BLOCK3_SAVE_ID ?? activeSave?.saveId;
  if (!saveId) throw new Error("No save available. Pass --save <saveId> or set OLY_BLOCK3_SAVE_ID.");
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const outputDir =
    process.env.OLY_BLOCK3_AUDIT_OUTPUT_DIR ??
    path.join(OUTPUT_ROOT, `block3-multiseason-playability-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const gameState = save.gameState;
  const snapshots = completedSnapshots(gameState);
  const dashboard = buildMultiSeasonBalanceDashboard(gameState);
  const cashRows = buildCashRows(snapshots);
  const rosterRows = buildRosterRows(snapshots);
  const economyRows = buildEconomyDriftRows(snapshots);
  const developmentRows = buildDevelopmentRows(gameState);
  const dominanceRows = buildDominanceRows(gameState, snapshots);
  const transferRows = buildTransferProfitRows(gameState);
  const facilityRows = buildFacilityRows(gameState);
  const boardRows = buildBoardRows(gameState);
  const fatigueRows = buildFatigueRows(gameState);
  const identityRows = buildIdentityRows(gameState);

  writeCsv(outputDir, "block3-cash-verlauf-pro-team.csv", cashRows);
  writeCsv(outputDir, "block3-kadergroesse-pro-team.csv", rosterRows);
  writeCsv(outputDir, "block3-mw-gehalt-verlauf.csv", economyRows);
  writeCsv(outputDir, "block3-xp-ovr-progression.csv", developmentRows);
  writeCsv(outputDir, "block3-team-identity-fit-over-time.csv", identityRows);
  writeCsv(outputDir, "block3-winner-loser-dominanz.csv", dominanceRows);
  writeCsv(outputDir, "block3-fatigue-injury-pressure.csv", fatigueRows);
  writeCsv(outputDir, "block3-facility-investment-roi.csv", facilityRows);
  writeCsv(outputDir, "block3-boardziel-erfuellung.csv", boardRows);
  writeCsv(outputDir, "block3-transfer-profit-panic-overpay.csv", transferRows);
  writeCsv(outputDir, "block3-dashboard-team-rows.csv", dashboard.teamRows as unknown as Record<string, CsvValue>[]);
  writeCsv(outputDir, "block3-dashboard-economy-rows.csv", dashboard.economyRows as unknown as Record<string, CsvValue>[]);
  writeCsv(outputDir, "block3-dashboard-player-rows.csv", dashboard.playerRows as unknown as Record<string, CsvValue>[]);
  writeCsv(outputDir, "block3-dashboard-gameplay-rows.csv", dashboard.gameplayRows as unknown as Record<string, CsvValue>[]);
  writeCsv(outputDir, "block3-dashboard-warnings.csv", dashboard.warnings as unknown as Record<string, CsvValue>[]);

  const markdown = buildSummary({
    saveId: save.saveId,
    saveName: save.name,
    snapshots,
    cashRows,
    dominanceRows,
    economyRows,
    identityRows,
    developmentRows,
    boardRows,
    transferRows,
  });
  fs.writeFileSync(path.join(outputDir, "block3-multiseason-playability-report.md"), `${markdown}\n`, "utf8");
  fs.writeFileSync(
    path.join(outputDir, "block3-multiseason-playability-summary.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      saveId: save.saveId,
      saveName: save.name,
      activeSaveId: activeSave?.saveId ?? null,
      activeSaveUntouched: activeSave?.saveId === persistence.getActiveSave()?.saveId,
      completedSnapshots: snapshots.length,
      outputDir,
      dashboardSummary: dashboard.sourceSummary,
      warningCount: dashboard.warnings.length,
    }, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify({ saveId: save.saveId, snapshots: snapshots.length, outputDir }, null, 2));
}

main();
