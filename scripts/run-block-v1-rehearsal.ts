import fs from "node:fs";
import path from "node:path";

import { refreshTeamObjectiveState } from "@/lib/board/team-season-objectives-service";
import { startAdminSeasonSimulation, tickAdminSeasonSimulation, type AdminSeasonSimulationRunState } from "@/lib/admin/season-simulation-runner";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";

const SAVE_ID = process.env.OLY_REHEARSAL_SAVE_ID ?? "save-1781758641918-knxfwc";
const OUT_DIR = path.join(process.cwd(), "outputs", "block-matchday-board-xp-v1");

type CsvRow = Record<string, string | number | boolean | null | undefined>;

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function writeCsv(fileName: string, rows: CsvRow[]) {
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, fileName), `${csv}\n`, "utf8");
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function readJsonl(filePath: string) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function getObjectiveRows(gameState: GameState): CsvRow[] {
  const board = gameState.seasonState.boardConfidence ?? {};
  return (gameState.seasonState.teamSeasonObjectives ?? [])
    .filter((objective) => objective.seasonId === gameState.season.id)
    .map((objective) => ({
      seasonId: objective.seasonId,
      teamId: objective.teamId,
      objectiveId: objective.objectiveId,
      category: objective.category,
      label: objective.label,
      targetValue: String(objective.targetValue ?? ""),
      currentValue: String(objective.currentValue ?? ""),
      status: objective.status,
      source: objective.source,
      boardRating: board[objective.teamId]?.value ?? null,
      pressure: board[objective.teamId]?.pressure ?? null,
      boardWarnings: (board[objective.teamId]?.warnings ?? []).join("|"),
    }));
}

function getXpRows(gameState: GameState): CsvRow[] {
  const currentSeason = gameState.season.id;
  const previousSeasonNumber = Number(/season-(\d+)/.exec(currentSeason)?.[1] ?? 0) - 1;
  const completedSeasonId = previousSeasonNumber > 0 ? `season-${previousSeasonNumber}` : currentSeason;
  const teamNames = new Map(gameState.teams.map((team) => [team.teamId, team.name] as const));
  const teamIds = gameState.teams.map((team) => team.teamId);
  return teamIds.map((teamId) => {
    const events = (gameState.playerProgressionEvents ?? []).filter((event) => event.teamId === teamId && event.seasonId === completedSeasonId);
    return {
      completedSeasonId,
      teamId,
      teamName: teamNames.get(teamId) ?? teamId,
      materializedEvents: events.length,
      playersWithUpgrades: new Set(events.filter((event) => event.upgrades.length > 0).map((event) => event.playerId)).size,
      upgrades: events.reduce((sum, event) => sum + event.upgrades.length, 0),
      earnedXP: round(events.reduce((sum, event) => sum + (event.xpEarned ?? 0), 0), 2),
      xpSpent: round(events.reduce((sum, event) => sum + (event.xpSpent ?? 0), 0), 2),
      spendableXPAfter: round(events.reduce((sum, event) => sum + (event.currentXPAfter ?? 0), 0), 2),
    };
  });
}

function getFinanceRows(gameState: GameState): CsvRow[] {
  const rosterByTeamId = new Map<string, typeof gameState.rosters>();
  for (const roster of gameState.rosters) {
    rosterByTeamId.set(roster.teamId, [...(rosterByTeamId.get(roster.teamId) ?? []), roster]);
  }
  const currentSnapshot = [...(gameState.seasonState.seasonSnapshots ?? [])]
    .sort((left, right) => right.seasonId.localeCompare(left.seasonId, "de", { numeric: true }))[0] ?? null;
  const snapshotRows = new Map(
    ((currentSnapshot?.teamSnapshots ?? currentSnapshot?.finalStandings ?? []) as Array<Record<string, unknown>>)
      .map((row) => [String(row.teamId ?? ""), row] as const),
  );

  return gameState.teams.map((team) => {
    const rosters = rosterByTeamId.get(team.teamId) ?? [];
    const salaryTotal = round(rosters.reduce((sum, roster) => sum + (roster.salary ?? 0), 0));
    const snapshot = snapshotRows.get(team.teamId) ?? null;
    const guv = typeof snapshot?.guv === "number" ? snapshot.guv : null;
    const transferSellCount = typeof snapshot?.transferSellCount === "number" ? snapshot.transferSellCount : 0;
    const transferBuyCount = typeof snapshot?.transferBuyCount === "number" ? snapshot.transferBuyCount : 0;
    return {
      seasonId: gameState.season.id,
      teamId: team.teamId,
      teamName: team.name,
      cash: round(team.cash ?? 0),
      rosterCount: rosters.length,
      salaryTotal,
      latestSnapshotSeasonId: currentSnapshot?.seasonId ?? null,
      latestGuv: guv,
      transferSellCount,
      transferBuyCount,
      negativeCashFlag: (team.cash ?? 0) < 0,
      badGuvNoSellFlag: guv != null && guv <= -15 && transferSellCount === 0,
    };
  });
}

function getXpMoraleBoardRows(gameState: GameState): CsvRow[] {
  const xpRowsByTeamId = new Map(getXpRows(gameState).map((row) => [String(row.teamId), row] as const));
  const objectives = (gameState.seasonState.teamSeasonObjectives ?? []).filter((objective) => objective.seasonId === gameState.season.id);
  const board = gameState.seasonState.boardConfidence ?? {};
  return gameState.teams.map((team) => {
    const teamObjectives = objectives.filter((objective) => objective.teamId === team.teamId);
    const moraleRows = (gameState.playerMoraleState ?? []).filter((entry) => entry.teamId === team.teamId);
    const relationshipRows = (gameState.playerRelationshipEvents ?? []).filter((entry) => entry.teamId === team.teamId);
    const xp = xpRowsByTeamId.get(team.teamId);
    return {
      seasonId: gameState.season.id,
      teamId: team.teamId,
      teamName: team.name,
      boardRating: board[team.teamId]?.value ?? null,
      boardPressure: board[team.teamId]?.pressure ?? null,
      boardWarnings: (board[team.teamId]?.warnings ?? []).join("|"),
      objectiveCount: teamObjectives.length,
      objectiveOpen: teamObjectives.filter((objective) => objective.status === "open").length,
      objectiveAtRisk: teamObjectives.filter((objective) => objective.status === "at_risk").length,
      objectiveFailed: teamObjectives.filter((objective) => objective.status === "failed").length,
      moraleStateCount: moraleRows.length,
      relationshipEvents: relationshipRows.length,
      materializedEvents: xp?.materializedEvents ?? 0,
      playersWithUpgrades: xp?.playersWithUpgrades ?? 0,
      upgrades: xp?.upgrades ?? 0,
      earnedXP: xp?.earnedXP ?? 0,
      xpSpent: xp?.xpSpent ?? 0,
    };
  });
}

function getRelationshipRows(gameState: GameState): CsvRow[] {
  const relationshipRows = (gameState.playerRelationshipEvents ?? []).map((event) => ({
    rowType: "relationship_event",
    seasonId: event.seasonId,
    teamId: event.teamId,
    playerId: event.playerId,
    reason: event.reason,
    delta: event.delta,
    severity: event.severity,
    source: event.source,
    createdAt: event.createdAt,
  }));
  const moraleRows = (gameState.playerMoraleState ?? []).map((entry) => ({
    rowType: "morale_state",
    seasonId: entry.lastUpdatedSeasonId,
    teamId: entry.teamId,
    playerId: entry.playerId,
    reason: entry.reasons.map((reason) => reason.reasonId).join("|"),
    delta: entry.morale,
    severity: entry.visibleMood,
    source: "player_morale_state",
    createdAt: entry.lastUpdatedSeasonId,
  }));
  return [...relationshipRows, ...moraleRows];
}

function getPerformanceRows(run: AdminSeasonSimulationRunState): CsvRow[] {
  return readJsonl(run.reports.jsonl)
    .filter((entry) => entry.type === "matchday_performance_breakdown")
    .map((entry) => ({
      runId: String(entry.runId ?? run.runId),
      seasonId: String(entry.seasonId ?? ""),
      matchdayId: String(entry.matchdayId ?? ""),
      matchdayIndex: Number(entry.matchdayIndex ?? 0),
      phase: String(entry.phase ?? ""),
      durationMs: Number(entry.durationMs ?? 0),
      itemCount: Number(entry.itemCount ?? 0),
      source: String(entry.source ?? ""),
    }));
}

function writeHotspots(rows: CsvRow[]) {
  const totals = rows
    .filter((row) => row.phase === "matchday_total")
    .sort((left, right) => Number(right.durationMs ?? 0) - Number(left.durationMs ?? 0));
  const byPhase = new Map<string, number>();
  for (const row of rows) {
    const phase = String(row.phase ?? "");
    if (phase === "matchday_total") continue;
    byPhase.set(phase, (byPhase.get(phase) ?? 0) + Number(row.durationMs ?? 0));
  }
  const phaseLines = [...byPhase.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([phase, duration]) => `- ${phase}: ${duration} ms`);
  const lines = [
    "# Matchday Performance Hotspots",
    "",
    `- Matchdays gemessen: ${totals.length}`,
    `- Langsamster Matchday: ${totals[0]?.matchdayId ?? "n/a"} (${totals[0]?.durationMs ?? 0} ms)`,
    `- Ausreisser >120s: ${totals.filter((row) => Number(row.durationMs ?? 0) > 120_000).length}`,
    `- Ziel <60s verletzt: ${totals.filter((row) => Number(row.durationMs ?? 0) > 60_000).length}`,
    "",
    "## Phase Totals",
    ...phaseLines,
    "",
    "## Pre-Fix Baseline",
    "- User-reported MD2: 1030s",
    "- User-reported MD3: 2366s",
  ];
  fs.writeFileSync(path.join(OUT_DIR, "matchday-performance-hotspots.md"), `${lines.join("\n")}\n`, "utf8");
}

function writeSummary(run: AdminSeasonSimulationRunState, save: PersistedSaveGame, performanceRows: CsvRow[]) {
  const totals = performanceRows.filter((row) => row.phase === "matchday_total");
  const maxMs = totals.reduce((max, row) => Math.max(max, Number(row.durationMs ?? 0)), 0);
  const activeObjectives = (save.gameState.seasonState.teamSeasonObjectives ?? []).filter((objective) => objective.seasonId === save.gameState.season.id);
  const objectiveTeams = new Set(activeObjectives.map((objective) => objective.teamId)).size;
  const completedSeasonNumber = Number(/season-(\d+)/.exec(save.gameState.season.id)?.[1] ?? 0) - 1;
  const completedSeasonId = completedSeasonNumber > 0 ? `season-${completedSeasonNumber}` : save.gameState.season.id;
  const xpEvents = (save.gameState.playerProgressionEvents ?? []).filter((event) => event.seasonId === completedSeasonId);
  const upgradedPlayers = new Set(xpEvents.filter((event) => event.upgrades.length > 0).map((event) => event.playerId)).size;
  const financeRows = getFinanceRows(save.gameState);
  const negativeCashTeams = financeRows.filter((row) => row.negativeCashFlag).length;
  const badGuvNoSellTeams = financeRows.filter((row) => row.badGuvNoSellFlag).length;
  const moraleStateCount = save.gameState.playerMoraleState?.length ?? 0;
  const relationshipEventCount = save.gameState.playerRelationshipEvents?.length ?? 0;
  const lines = [
    "# Normal Season Rehearsal Summary V3",
    "",
    `- Save: ${save.saveId}`,
    `- Admin Run: ${run.runId}`,
    `- Status: ${run.status}`,
    `- Aktive Season nach Lauf: ${save.gameState.season.id}`,
    `- Board Objectives Teams aktiv: ${objectiveTeams}/${save.gameState.teams.length}`,
    `- Board Objectives aktiv: ${activeObjectives.length}`,
    `- XP Events fuer ${completedSeasonId}: ${xpEvents.length}`,
    `- Spieler mit materialisierten Upgrades: ${upgradedPlayers}`,
    `- Finance negative Cash Teams: ${negativeCashTeams}`,
    `- Schlechte GuV ohne Verkäufe: ${badGuvNoSellTeams}`,
    `- Langsamster Matchday: ${maxMs} ms`,
    `- Matchdays >120s: ${totals.filter((row) => Number(row.durationMs ?? 0) > 120_000).length}`,
    `- Morale States persistiert: ${moraleStateCount}`,
    `- Relationship Events persistiert: ${relationshipEventCount}`,
    "",
    run.status === "completed" && objectiveTeams === save.gameState.teams.length && negativeCashTeams === 0
      ? "Ampel: GREEN/YELLOW nach Detailwertung, Lauf abgeschlossen und Kernchecks ohne roten Finance/Board-Blocker."
      : `Ampel: RED, Laufstatus ${run.status}.`,
  ];
  fs.writeFileSync(path.join(OUT_DIR, "normal-season-rehearsal-summary-v3.md"), `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  assertOlyProjectRoot();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const persistence = createPersistenceService();
  const sourceSave = persistence.getSaveById(SAVE_ID);
  if (!sourceSave) throw new Error(`Save not found: ${SAVE_ID}`);

  const activeObjectives = (sourceSave.gameState.seasonState.teamSeasonObjectives ?? []).filter(
    (objective) => objective.seasonId === sourceSave.gameState.season.id,
  );
  if (activeObjectives.length === 0) {
    persistence.saveSingleplayerState(sourceSave.saveId, refreshTeamObjectiveState(sourceSave.gameState));
  }

  const run = startAdminSeasonSimulation({
    saveId: SAVE_ID,
    seasonCount: 1,
    mode: "apply",
    fullChurnStress: false,
    injuriesTestMode: false,
  });

  let state: AdminSeasonSimulationRunState | null = run;
  for (let tick = 1; tick <= 220; tick += 1) {
    if (!state || state.status !== "running") break;
    state = await tickAdminSeasonSimulation(state.runId);
    if (tick % 5 === 0 && state) {
      console.log(`[block-v1] tick=${tick} status=${state.status} phase=${state.activePhase} progress=${state.progressPct}%`);
    }
  }
  if (!state) throw new Error("Admin run disappeared.");

  const finalSave = persistence.getSaveById(SAVE_ID);
  if (!finalSave) throw new Error(`Final save not found: ${SAVE_ID}`);
  const performanceRows = getPerformanceRows(state);
  writeCsv("matchday-performance-breakdown.csv", performanceRows);
  writeCsv("matchday-performance-after-fix.csv", performanceRows);
  writeCsv("matchday-performance-after-runner-fix.csv", performanceRows);
  writeHotspots(performanceRows);
  writeCsv("xp-board-after-rehearsal-v2.csv", getXpRows(finalSave.gameState));
  writeCsv("finance-ai-v2-after-season.csv", getFinanceRows(finalSave.gameState));
  writeCsv("xp-morale-board-after-season.csv", getXpMoraleBoardRows(finalSave.gameState));
  writeCsv("board-objectives-after-transition.csv", getObjectiveRows(finalSave.gameState));
  writeCsv("morale-relationship-events-after-fix.csv", getRelationshipRows(finalSave.gameState));
  writeSummary(state, finalSave, performanceRows);

  console.log(JSON.stringify({
    runId: state.runId,
    status: state.status,
    outputDir: OUT_DIR,
    seasonId: finalSave.gameState.season.id,
    objectives: (finalSave.gameState.seasonState.teamSeasonObjectives ?? []).filter((objective) => objective.seasonId === finalSave.gameState.season.id).length,
    objectiveTeams: new Set((finalSave.gameState.seasonState.teamSeasonObjectives ?? []).filter((objective) => objective.seasonId === finalSave.gameState.season.id).map((objective) => objective.teamId)).size,
    performanceRows: performanceRows.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
