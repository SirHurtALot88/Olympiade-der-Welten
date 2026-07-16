import fs from "node:fs";
import path from "node:path";

import { createSaveRepository } from "@/lib/persistence/save-repository";
import { getTeamPlayerMax } from "@/lib/foundation/roster-limits";

type ExecutePick = {
  step: number;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  marketValue: number | null;
  salary: number | null;
  budgetLane?: string | null;
  pickLane?: string | null;
  rosterRole?: string | null;
  pickPhase?: string | null;
  needLabel?: string | null;
  primaryReason?: string | null;
  secondaryReason?: string | null;
  aiScore?: number | null;
  pickScore?: number | null;
  teamFit?: number | null;
  budgetFit?: number | null;
  mustFeelRightScore?: number | null;
  expectedCashAfter?: number | null;
  expectedSalaryAfter?: number | null;
  expectedRosterAfter?: number | null;
  transferHistoryId?: string | null;
  status?: string | null;
  warnings?: string[];
  reasons?: string[];
};

type ExecuteTeam = {
  teamId: string;
  teamCode: string;
  teamName: string;
  rosterBefore: number;
  rosterAfter: number;
  cashBefore: number;
  cashAfter: number;
  salaryBefore: number;
  salaryAfter: number;
  targetRosterMin?: number | null;
  targetRosterOpt?: number | null;
  targetRosterSize?: number | null;
  transferHistoryIds?: string[];
  warnings?: string[];
  blockingReasons?: string[];
  plannedPicks?: ExecutePick[];
};

type ExecutePayload = {
  status: string;
  executed: boolean;
  saveScope?: {
    requestedSaveId?: string | null;
    resolvedSaveId?: string | null;
  };
  seasonScope?: {
    requestedSeasonId?: string | null;
    resolvedSeasonId?: string | null;
  };
  globalPreview?: {
    plannedPickCount?: number;
  };
  globalExecution?: {
    appliedPickCount?: number;
    transferIds?: string[];
  };
  traceParity?: {
    dryRunExecuteTraceMatch?: boolean;
    sameTeams?: boolean;
    samePlayers?: boolean;
    sameOrder?: boolean;
    sameLanes?: boolean;
    sameCosts?: boolean;
  };
  historyCheck?: {
    allAppliedBuysVisible?: boolean;
    missingTransferIds?: string[];
  };
  qualityGate?: {
    passed?: boolean;
    blockingReasons?: string[];
    warnings?: string[];
  };
  teams: ExecuteTeam[];
};

function parseArgs(argv: string[]) {
  const get = (flag: string, fallback: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
  };

  return {
    executeJson: get("--execute-json", "/tmp/ai-min7-execute.json"),
    outputDir: get("--output-dir", path.resolve(process.cwd(), "tmp/exports/ai-minimum-execute")),
  };
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "";
  return value.toFixed(digits);
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function writeCsv(filePath: string, rows: Array<Record<string, unknown>>) {
  const columns = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) set.add(key);
      return set;
    }, new Set<string>()),
  );
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const input = parseArgs(process.argv.slice(2));
  const execute = JSON.parse(fs.readFileSync(input.executeJson, "utf8")) as ExecutePayload;
  const repo = createSaveRepository();
  const save = repo.getActiveSave();
  if (!save) {
    throw new Error("No active save available.");
  }

  const outputDir = input.outputDir;
  fs.mkdirSync(outputDir, { recursive: true });

  const teamMap = new Map(save.gameState.teams.map((team) => [team.teamId, team]));
  const playerMap = new Map(save.gameState.players.map((player) => [player.id, player]));
  const rosterByTeam = new Map<string, typeof save.gameState.rosters>();
  const rosterByPlayer = new Map<string, (typeof save.gameState.rosters)[number]>();
  for (const roster of save.gameState.rosters) {
    const bucket = rosterByTeam.get(roster.teamId) ?? [];
    bucket.push(roster);
    rosterByTeam.set(roster.teamId, bucket);
    rosterByPlayer.set(roster.playerId, roster);
  }

  const transferById = new Map(save.gameState.transferHistory.map((entry) => [entry.id, entry]));
  const transferByPlayer = new Map<string, (typeof save.gameState.transferHistory)[number][]>();
  for (const transfer of save.gameState.transferHistory) {
    const bucket = transferByPlayer.get(transfer.playerId) ?? [];
    bucket.push(transfer);
    transferByPlayer.set(transfer.playerId, bucket);
  }

  const allRosterPlayerIds = save.gameState.rosters.map((entry) => entry.playerId);
  const allUniqueRosterPlayerIds = new Set(allRosterPlayerIds);
  const duplicatePlayerIds = allRosterPlayerIds.filter((playerId, index) => allRosterPlayerIds.indexOf(playerId) !== index);
  const allPlayerIds = new Set(save.gameState.players.map((player) => player.id));
  const freeAgents = save.gameState.players.filter((player) => !rosterByPlayer.has(player.id));
  const minCash = Math.min(...save.gameState.teams.map((team) => team.cash));
  const maxCash = Math.max(...save.gameState.teams.map((team) => team.cash));

  const teamRows = execute.teams.map((team) => {
    const currentTeam = teamMap.get(team.teamId);
    const currentIdentity = save.gameState.teamIdentities.find((identity) => identity.teamId === team.teamId);
    const liveRoster = rosterByTeam.get(team.teamId) ?? [];
    const liveTransfers = team.transferHistoryIds ?? [];
    const playerMax = getTeamPlayerMax(currentTeam, currentIdentity);
    return {
      teamId: team.teamId,
      teamCode: team.teamCode,
      teamName: team.teamName,
      cashBefore: formatNumber(team.cashBefore),
      cashAfterExecute: formatNumber(team.cashAfter),
      cashInSave: formatNumber(currentTeam?.cash),
      salaryBefore: formatNumber(team.salaryBefore),
      salaryAfterExecute: formatNumber(team.salaryAfter),
      rosterBefore: team.rosterBefore,
      rosterAfterExecute: team.rosterAfter,
      rosterInSave: liveRoster.length,
      targetRosterMin: team.targetRosterMin ?? "",
      targetRosterOpt: team.targetRosterOpt ?? "",
      targetRosterSize: team.targetRosterSize ?? "",
      playerMax,
      transferCount: liveTransfers.length,
      warnings: (team.warnings ?? []).join(" | "),
      blockingReasons: (team.blockingReasons ?? []).join(" | "),
    };
  });

  const pickRows = execute.teams.flatMap((team) =>
    (team.plannedPicks ?? []).map((pick) => ({
      teamId: team.teamId,
      teamCode: team.teamCode,
      teamName: team.teamName,
      step: pick.step,
      playerId: pick.playerId,
      playerName: pick.playerName,
      className: pick.className,
      race: pick.race,
      marketValue: formatNumber(pick.marketValue),
      salary: formatNumber(pick.salary),
      budgetLane: pick.budgetLane ?? "",
      pickLane: pick.pickLane ?? "",
      rosterRole: pick.rosterRole ?? "",
      pickPhase: pick.pickPhase ?? "",
      needLabel: pick.needLabel ?? "",
      pickScore: formatNumber(pick.pickScore),
      aiScore: formatNumber(pick.aiScore),
      teamFit: formatNumber(pick.teamFit),
      budgetFit: formatNumber(pick.budgetFit),
      mustFeelRightScore: formatNumber(pick.mustFeelRightScore),
      primaryReason: pick.primaryReason ?? "",
      secondaryReason: pick.secondaryReason ?? "",
      expectedCashAfter: formatNumber(pick.expectedCashAfter),
      expectedSalaryAfter: formatNumber(pick.expectedSalaryAfter),
      expectedRosterAfter: pick.expectedRosterAfter ?? "",
      transferHistoryId: pick.transferHistoryId ?? "",
      status: pick.status ?? "",
      warnings: (pick.warnings ?? []).join(" | "),
      reasons: (pick.reasons ?? []).join(" | "),
    })),
  );

  const cashReconciliationRows = execute.teams.map((team) => {
    const picks = team.plannedPicks ?? [];
    const purchaseFees = picks.reduce((sum, pick) => sum + (pick.marketValue ?? 0), 0);
    const currentTeam = teamMap.get(team.teamId);
    return {
      teamId: team.teamId,
      teamCode: team.teamCode,
      teamName: team.teamName,
      cashBefore: formatNumber(team.cashBefore),
      purchaseFees: formatNumber(purchaseFees),
      expectedCashAfter: formatNumber(team.cashAfter),
      cashInSave: formatNumber(currentTeam?.cash),
      deltaSaveVsExpected: formatNumber((currentTeam?.cash ?? 0) - team.cashAfter),
      transferCount: (team.transferHistoryIds ?? []).length,
    };
  });

  const transferAuditRows = execute.teams.flatMap((team) =>
    (team.plannedPicks ?? []).map((pick) => {
      const transfer = pick.transferHistoryId ? transferById.get(pick.transferHistoryId) : null;
      return {
        transferId: pick.transferHistoryId ?? "",
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        playerId: pick.playerId,
        playerName: pick.playerName,
        className: pick.className,
        race: pick.race,
        fee: formatNumber(transfer?.fee ?? pick.marketValue),
        salary: formatNumber(transfer?.salary ?? pick.salary),
        marketValue: formatNumber(transfer?.marketValue ?? pick.marketValue),
        contractLength: transfer?.remainingContractLength ?? "",
        happenedAt: transfer?.happenedAt ?? "",
        existsInSave: transfer ? "yes" : "no",
        rosterPresent: rosterByPlayer.has(pick.playerId) ? "yes" : "no",
      };
    }),
  );

  const exportJson = {
    saveId: save.saveId,
    saveName: save.name,
    resolvedSaveId: execute.saveScope?.resolvedSaveId ?? execute.saveScope?.requestedSaveId ?? save.saveId,
    seasonId: execute.seasonScope?.resolvedSeasonId ?? execute.seasonScope?.requestedSeasonId ?? save.gameState.season.id,
    seasonName: save.gameState.season.name,
    executeStatus: execute.status,
    executed: execute.executed,
    teams: save.gameState.teams.length,
    totalPlayers: save.gameState.players.length,
    rosterCount: save.gameState.rosters.length,
    uniqueRosterPlayers: allUniqueRosterPlayerIds.size,
    freeAgentsCount: freeAgents.length,
    duplicateRosterPlayers: Array.from(new Set(duplicatePlayerIds)),
    transferCount: save.gameState.transferHistory.length,
    plannedPickCount: execute.globalPreview?.plannedPickCount ?? null,
    appliedPickCount: execute.globalExecution?.appliedPickCount ?? null,
    traceParity: execute.traceParity ?? null,
    historyCheck: execute.historyCheck ?? null,
    qualityGate: execute.qualityGate ?? null,
    integrity: {
      teamsUnder7: teamRows.filter((team) => Number(team.rosterInSave) < 7).map((team) => team.teamId),
      teamsOverMax: teamRows.filter((team) => Number(team.rosterInSave) > Number(team.playerMax)).map((team) => team.teamId),
      cashNeverNegative: minCash >= 0,
      minCash,
      maxCash,
      allTransfersVisible: transferAuditRows.every((row) => row.existsInSave === "yes"),
      allRosterPlayersInPlayerPool: allRosterPlayerIds.every((playerId) => allPlayerIds.has(playerId)),
      allBoughtPlayersRemovedFromFreeAgents: pickRows.every((row) => !freeAgents.some((player) => player.id === row.playerId)),
    },
    teamRows,
    pickRows,
    cashReconciliationRows,
    transferAuditRows,
  };

  const summaryLines = [
    "# AI Minimum-7 Execute Summary",
    "",
    `- Save: \`${save.saveId}\` (${save.name})`,
    `- Season: \`${save.gameState.season.id}\` (${save.gameState.season.name})`,
    `- Execute status: \`${execute.status}\``,
    `- Planned picks: ${execute.globalPreview?.plannedPickCount ?? "—"}`,
    `- Applied picks: ${execute.globalExecution?.appliedPickCount ?? "—"}`,
    `- Teams: ${save.gameState.teams.length}`,
    `- Active roster entries: ${save.gameState.rosters.length}`,
    `- Unique roster players: ${allUniqueRosterPlayerIds.size}`,
    `- Duplicate roster players: ${Array.from(new Set(duplicatePlayerIds)).length}`,
    `- Free agents remaining: ${freeAgents.length}`,
    `- Cash minimum: ${formatNumber(minCash)}`,
    `- Cash maximum: ${formatNumber(maxCash)}`,
    `- Trace parity: ${execute.traceParity?.dryRunExecuteTraceMatch ? "match" : "mismatch"}`,
    `- Transfer history visible for all applied buys: ${execute.historyCheck?.allAppliedBuysVisible ? "yes" : "no"}`,
    "",
    "## Integrity",
    "",
    `- Teams under 7: ${teamRows.filter((team) => Number(team.rosterInSave) < 7).length}`,
    `- Teams over Max: ${teamRows.filter((team) => Number(team.rosterInSave) > Number(team.playerMax)).length}`,
    `- Cash below zero: ${minCash < 0 ? "yes" : "no"}`,
    `- All bought players removed from free-agent pool: ${pickRows.every((row) => !freeAgents.some((player) => player.id === row.playerId)) ? "yes" : "no"}`,
    `- Transfers saved: ${save.gameState.transferHistory.length}`,
    "",
    "## Output Files",
    "",
    "- `ai-minimum-execute-summary.md`",
    "- `ai-minimum-execute-teams.csv`",
    "- `ai-minimum-execute-picks.csv`",
    "- `ai-minimum-execute-cash-reconciliation.csv`",
    "- `ai-minimum-execute-transfer-history-audit.csv`",
    "- `ai-minimum-execute.json`",
    "",
  ];

  fs.writeFileSync(path.join(outputDir, "ai-minimum-execute-summary.md"), summaryLines.join("\n"), "utf8");
  writeCsv(path.join(outputDir, "ai-minimum-execute-teams.csv"), teamRows);
  writeCsv(path.join(outputDir, "ai-minimum-execute-picks.csv"), pickRows);
  writeCsv(path.join(outputDir, "ai-minimum-execute-cash-reconciliation.csv"), cashReconciliationRows);
  writeCsv(path.join(outputDir, "ai-minimum-execute-transfer-history-audit.csv"), transferAuditRows);
  fs.writeFileSync(path.join(outputDir, "ai-minimum-execute.json"), JSON.stringify(exportJson, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        outputDir,
        files: fs.readdirSync(outputDir).sort(),
        integrity: exportJson.integrity,
      },
      null,
      2,
    ),
  );
}

main();
