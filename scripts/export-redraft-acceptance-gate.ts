import fs from "node:fs";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { GameState, Player, RosterEntry, Team, TeamIdentity, TransferHistoryEntry } from "@/lib/data/olyDataTypes";

const PROJECT_ROOT = process.cwd();
const OUTPUT_DIR =
  process.env.OLY_REDFRAFT_ACCEPTANCE_GATE_DIR ??
  path.join(PROJECT_ROOT, "outputs/redraft-acceptance-gate");
const SOURCE_DIR = process.env.OLY_REDFRAFT_ACCEPTANCE_SOURCE_DIR ?? findLatestRedraftOutputDir();
const SPECIAL_TEAM_IDS = new Set(["M-M", "Z-H", "C-C", "W-W", "D-L", "T-T"]);

type CsvRow = Record<string, string>;

function findLatestRedraftOutputDir() {
  const outputRoot = path.join(PROJECT_ROOT, "outputs");
  if (!fs.existsSync(outputRoot)) return null;
  const candidates = fs
    .readdirSync(outputRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(outputRoot, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "chunked-redraft-summary.json")))
    .map((dir) => ({ dir, mtimeMs: fs.statSync(path.join(dir, "chunked-redraft-summary.json")).mtimeMs }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0]?.dir ?? null;
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function readCsv(filePath: string): CsvRow[] {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const headers = parseCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  fs.writeFileSync(
    path.join(OUTPUT_DIR, fileName),
    `${[headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`,
    "utf8",
  );
}

function writeJson(fileName: string, value: unknown) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMarkdown(fileName: string, lines: string[]) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), `${lines.join("\n")}\n`, "utf8");
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (Number.isFinite(value) ? Number(value) : 0), 0);
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPlayerMarketValue(player: Player) {
  return numberValue(player.displayMarketValue ?? player.marketValue, 0);
}

function getPlayerSalary(player: Player, roster?: RosterEntry) {
  return numberValue(roster?.salary ?? player.displaySalary ?? player.salaryDemand, 0);
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

function getTeamTargets(team: Team, identity?: TeamIdentity) {
  const playerMin = Math.round(team.rosterMinTarget ?? identity?.playerMin ?? 8);
  const playerOpt = Math.round(team.rosterOptTarget ?? identity?.playerOpt ?? Math.max(playerMin, 10));
  const playerMax = Math.round(team.rosterLimit ?? Math.max(playerOpt, playerMin));
  return { playerMin, playerOpt, playerMax };
}

function buildAxisCoverage(players: Player[]) {
  const average = (axis: "pow" | "spe" | "men" | "soc") =>
    players.length ? round(sum(players.map((player) => numberValue(player.coreStats?.[axis], 0))) / players.length, 1) : 0;
  return {
    pow: average("pow"),
    spe: average("spe"),
    men: average("men"),
    soc: average("soc"),
  };
}

function buildClassCoverage(players: Player[]) {
  const counts = new Map<string, number>();
  for (const player of players) {
    const key = player.className ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([name, count]) => `${name}:${count}`)
    .join("|");
}

function resolveSpecialTeamNote(input: {
  teamId: string;
  avgMarketValue: number;
  rosterCount: number;
  playerMin: number;
  classCoverage: string;
  axisCoverage: ReturnType<typeof buildAxisCoverage>;
  identityFitAverage: number;
  cashUnused: number;
}) {
  const warnings: string[] = [];
  if (input.teamId === "M-M" && input.avgMarketValue < 35) warnings.push("mayhem_mavericks_low_avg_market_value_for_topteam");
  if (input.teamId === "Z-H" && input.rosterCount <= input.playerMin && input.cashUnused > 40) warnings.push("zero_heroes_could_be_more_aggressive");
  if (input.teamId === "C-C" && input.avgMarketValue < 25) warnings.push("cash_creators_value_may_cost_minimum_quality");
  if (input.teamId === "W-W" && input.axisCoverage.men < Math.max(input.axisCoverage.pow, input.axisCoverage.spe, input.axisCoverage.soc)) {
    warnings.push("wicked_wizards_mental_focus_not_dominant");
  }
  if (input.teamId === "D-L" && input.identityFitAverage < 45) warnings.push("dire_legion_identity_fit_low_for_human_bias_check");
  if (input.teamId === "T-T" && !/Hero|Leader|Superstar|Lord|Royalty/i.test(input.classCoverage)) {
    warnings.push("terrible_teachers_missing_visible_leader_logic");
  }
  return warnings;
}

function hasOldTopupOutsideAllowedContext(entries: TransferHistoryEntry[]) {
  return entries.some((entry) => {
    const source = entry.source ?? "";
    if (!/season1_autoprep_topup/i.test(source)) return false;
    return entry.seasonId !== "season-1";
  });
}

function main() {
  const persistence = createPersistenceService();
  const save = persistence.getActiveSave();
  if (!save) throw new Error("active_save_missing");
  const gameState: GameState = save.gameState;
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const identityByTeamId = new Map(gameState.teamIdentities.map((identity) => [identity.teamId, identity]));
  const rosterByTeam = groupBy(gameState.rosters, (roster) => roster.teamId);
  const rosterByPlayer = groupBy(gameState.rosters, (roster) => roster.playerId);
  const buyHistory = gameState.transferHistory.filter((entry) => entry.transferType === "buy");
  const picks = SOURCE_DIR ? readCsv(path.join(SOURCE_DIR, "chunked-redraft-picks.csv")) : [];
  const pickQuality = SOURCE_DIR ? readCsv(path.join(SOURCE_DIR, "redraft-pick-quality.csv")) : [];
  const rejectedCandidates = SOURCE_DIR ? readCsv(path.join(SOURCE_DIR, "chunked-redraft-phase-b-rejected-candidates.csv")) : [];
  const sourceSummary = SOURCE_DIR ? readJson<Record<string, unknown>>(path.join(SOURCE_DIR, "chunked-redraft-summary.json")) : null;
  const pickRowsByTeam = groupBy(picks, (row) => row.teamId ?? "");
  const pickQualityByTeam = groupBy(pickQuality, (row) => row.teamId ?? "");
  const rejectedByTeam = groupBy(rejectedCandidates, (row) => row.teamId ?? "");
  const duplicatePlayers = [...rosterByPlayer.entries()].filter(([, rows]) => rows.length > 1).map(([playerId, rows]) => ({ playerId, count: rows.length }));
  const pickRowsMissingScores = picks.filter((row) => !Number.isFinite(Number(row.pickScore || row.selectedScore)));
  const reconstructedPicks = picks.filter((row) => Object.values(row).some((value) => /reconstruct/i.test(value)));
  const negativeCashTeams = gameState.teams.filter((team) => team.cash < 0);
  const oldTopupLeak = hasOldTopupOutsideAllowedContext(gameState.transferHistory);

  const teamRows = gameState.teams.map((team) => {
    const identity = identityByTeamId.get(team.teamId);
    const targets = getTeamTargets(team, identity);
    const rosters = rosterByTeam.get(team.teamId) ?? [];
    const players = rosters.map((roster) => playerById.get(roster.playerId)).filter((player): player is Player => Boolean(player));
    const salarySum = round(sum(rosters.map((roster) => getPlayerSalary(playerById.get(roster.playerId)!, roster))), 2);
    const marketValueSum = round(sum(players.map(getPlayerMarketValue)), 2);
    const pickRows = pickRowsByTeam.get(team.teamId) ?? [];
    const cashStart = pickRows.length ? numberValue(pickRows[0]?.cashBefore, team.budget) : team.budget;
    const totalSpend = round(sum(pickRows.map((row) => numberValue(row.marketValue, 0))), 2);
    const warnings = [
      rosters.length < targets.playerMin ? "below_player_min" : null,
      rosters.length > targets.playerMax ? "above_player_max" : null,
      rosters.length < targets.playerMin && team.cash > 0 ? "cash_left_while_below_min" : null,
    ].filter((entry): entry is string => Boolean(entry));
    return {
      teamCode: team.shortCode ?? team.teamId,
      teamId: team.teamId,
      teamName: team.name,
      playerMin: targets.playerMin,
      playerOpt: targets.playerOpt,
      playerMax: targets.playerMax,
      rosterCount: rosters.length,
      cashStart: round(cashStart, 2),
      cashEnd: round(team.cash, 2),
      cashUnused: round(team.cash, 2),
      totalSpend,
      salarySum,
      marketValueSum,
      avgMarketValue: rosters.length ? round(marketValueSum / rosters.length, 2) : 0,
      avgSalary: rosters.length ? round(salarySum / rosters.length, 2) : 0,
      reachedMin: rosters.length >= targets.playerMin,
      reachedOpt: rosters.length >= targets.playerOpt,
      overMax: rosters.length > targets.playerMax,
      warnings: warnings.join("|"),
    };
  });

  const teamStatusById = new Map(teamRows.map((row) => [row.teamId, row]));
  const teamsBelowMin = teamRows.filter((row) => !row.reachedMin);
  const teamsAboveMax = teamRows.filter((row) => row.overMax);
  const cashLeftWhileBelowMin = teamRows.filter((row) => !row.reachedMin && row.cashEnd > 0);
  const transferHistoryMismatch = buyHistory.length !== picks.length;
  const teamCountInvalid = gameState.teams.length !== 32;

  const pickQualityRows = gameState.teams.map((team) => {
    const status = teamStatusById.get(team.teamId)!;
    const rosters = rosterByTeam.get(team.teamId) ?? [];
    const players = rosters.map((roster) => playerById.get(roster.playerId)).filter((player): player is Player => Boolean(player));
    const qualityRows = pickQualityByTeam.get(team.teamId) ?? [];
    const sorted = [...qualityRows].sort((left, right) => numberValue(right.selectedScore, 0) - numberValue(left.selectedScore, 0));
    const worstSorted = [...qualityRows].sort((left, right) => numberValue(left.selectedScore, 0) - numberValue(right.selectedScore, 0));
    const questionable = qualityRows.filter((row) => numberValue(row.currentRating, 0) < 35 || numberValue(row.identityFit, 0) < 35);
    const missedBetter = rejectedByTeam.get(team.teamId) ?? [];
    const axisCoverage = buildAxisCoverage(players);
    const classCoverage = buildClassCoverage(players);
    const identityFitAverage = qualityRows.length ? round(sum(qualityRows.map((row) => numberValue(row.identityFit, 0))) / qualityRows.length, 2) : 0;
    const valueFitAverage = qualityRows.length ? round(sum(qualityRows.map((row) => numberValue(row.valueScore, 0))) / qualityRows.length, 2) : 0;
    const specialWarnings = resolveSpecialTeamNote({
      teamId: team.teamId,
      avgMarketValue: status.avgMarketValue,
      rosterCount: status.rosterCount,
      playerMin: status.playerMin,
      classCoverage,
      axisCoverage,
      identityFitAverage,
      cashUnused: status.cashUnused,
    });
    return {
      teamCode: team.shortCode ?? team.teamId,
      teamId: team.teamId,
      teamName: team.name,
      bestPick: sorted[0] ? `${sorted[0].playerName} (${sorted[0].selectedScore})` : "",
      worstPick: worstSorted[0] ? `${worstSorted[0].playerName} (${worstSorted[0].selectedScore})` : "",
      questionablePicks: questionable.map((row) => `${row.playerName}:${row.currentRating}/${row.identityFit}`).join("|"),
      missedBetterOptions: missedBetter.slice(0, 5).map((row) => `${row.rejectedPlayerName}:${row.rejectedReason}`).join("|"),
      teamNeedsStillOpen: status.reachedOpt ? "" : "below_opt_or_depth_open",
      axisCoverage: `POW ${axisCoverage.pow}|SPE ${axisCoverage.spe}|MEN ${axisCoverage.men}|SOC ${axisCoverage.soc}`,
      classCoverage,
      identityFitAverage,
      valueFitAverage,
      topRejectedCandidate: missedBetter[0] ? `${missedBetter[0].rejectedPlayerName}:${missedBetter[0].rejectedReason}` : "",
      whySelected: sorted[0]?.reason ?? "",
      whyNotBetterOption: missedBetter[0]?.rejectedReason ?? "",
      specialTeamWarnings: specialWarnings.join("|"),
    };
  });

  const identityRows = pickQualityRows.map((row) => ({
    teamCode: row.teamCode,
    teamId: row.teamId,
    teamName: row.teamName,
    identityFitAverage: row.identityFitAverage,
    valueFitAverage: row.valueFitAverage,
    axisCoverage: row.axisCoverage,
    classCoverage: row.classCoverage,
    specialTeamWarnings: row.specialTeamWarnings,
  }));
  const questionableTeamRows = pickQualityRows.filter((row) => row.questionablePicks || row.specialTeamWarnings);
  const hardFailReasons = [
    teamCountInvalid ? "team_count_not_32" : null,
    teamsBelowMin.length ? "teams_below_player_min" : null,
    teamsAboveMax.length ? "teams_above_player_max" : null,
    duplicatePlayers.length ? "duplicate_players" : null,
    negativeCashTeams.length ? "negative_cash_teams" : null,
    transferHistoryMismatch ? "transferhistory_pick_count_mismatch" : null,
    pickRowsMissingScores.length ? "missing_pick_scores" : null,
    reconstructedPicks.length ? "picks_reconstructed_from_transferhistory" : null,
    cashLeftWhileBelowMin.length ? "cash_left_while_below_min" : null,
    oldTopupLeak ? "season1_autoprep_topup_outside_allowed_context" : null,
    sourceSummary && sourceSummary.draftValid === false ? "source_summary_draft_invalid" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const technicalGreen = hardFailReasons.length === 0;
  const qualityWarnings = questionableTeamRows.length;
  const decision = technicalGreen ? (qualityWarnings > 0 ? "YELLOW" : "GREEN") : "RED";

  if (decision === "GREEN") {
    persistence.saveSingleplayerState(
      save.saveId,
      withScenarioMeta(gameState, {
        scenarioType: "ai_redraft_test",
        label: `${save.name} · Season-Ready`,
        description: "Redraft Acceptance Gate GREEN: seasonfaehiger Season-1 Matchday-1 Save.",
        isStableTestPoint: true,
        allowTestWrites: true,
        gamePhase: gameState.scenarioMeta?.gamePhase ?? gameState.gamePhase ?? "draft",
      }),
    );
    persistence.activateSave(save.saveId);
  }

  const identity = {
    saveId: save.saveId,
    saveName: save.name,
    createdAt: save.createdAt,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    gamePhase: gameState.scenarioMeta?.gamePhase ?? gameState.gamePhase ?? "unknown",
    playerPool: gameState.players.length,
    freeAgentPool: gameState.players.length - new Set(gameState.rosters.map((roster) => roster.playerId)).size,
    transferHistoryCount: gameState.transferHistory.length,
    rosterCountTotal: gameState.rosters.length,
    activeSave: save.status === "active",
    sourceDir: SOURCE_DIR,
  };
  const summary = {
    decision,
    draftValid: technicalGreen,
    hardFailReasons,
    qualityWarningTeams: questionableTeamRows.length,
    saveIdentity: identity,
    checks: {
      teamCount: gameState.teams.length,
      allTeamsAtMin: teamsBelowMin.length === 0,
      noTeamsAboveMax: teamsAboveMax.length === 0,
      duplicatePlayers: duplicatePlayers.length,
      negativeCashTeams: negativeCashTeams.length,
      transferHistoryBuyCount: buyHistory.length,
      pickRows: picks.length,
      transferHistoryMatchesPicks: !transferHistoryMismatch,
      pickScoresPresent: pickRowsMissingScores.length === 0,
      reconstructedPicks: reconstructedPicks.length,
      oldTopupLeak,
    },
    specialTeams: pickQualityRows.filter((row) => SPECIAL_TEAM_IDS.has(row.teamId)),
  };

  const invalidRows: Array<Record<string, unknown>> = hardFailReasons.map((reason) => ({ severity: "hard_fail", reason }));
  for (const row of questionableTeamRows) {
    invalidRows.push({
      severity: "quality_warning",
      reason: row.specialTeamWarnings || "questionable_picks",
      teamId: row.teamId,
      teamName: row.teamName,
      detail: row.questionablePicks || row.missedBetterOptions,
    });
  }

  writeJson("redraft-acceptance-summary.json", summary);
  writeCsv("redraft-team-status.csv", teamRows);
  writeCsv("redraft-pick-quality.csv", pickQualityRows);
  writeCsv(
    "redraft-cash-audit.csv",
    teamRows.map((row) => ({
      teamCode: row.teamCode,
      teamId: row.teamId,
      teamName: row.teamName,
      cashStart: row.cashStart,
      cashEnd: row.cashEnd,
      cashUnused: row.cashUnused,
      totalSpend: row.totalSpend,
      salarySum: row.salarySum,
      reachedMin: row.reachedMin,
      reachedOpt: row.reachedOpt,
      cashLeftWhileBelowMin: !row.reachedMin && row.cashEnd > 0,
    })),
  );
  writeCsv("redraft-identity-fit-audit.csv", identityRows);
  writeCsv("redraft-invalid-reasons.csv", invalidRows);
  writeMarkdown("redraft-acceptance-summary.md", [
    "# Redraft Acceptance Gate",
    "",
    `- Ampel: ${decision}`,
    `- DRAFT_VALID: ${technicalGreen ? "true" : "false"}`,
    `- Save: ${identity.saveName} (${identity.saveId})`,
    `- Created: ${identity.createdAt}`,
    `- Season / Matchday: ${identity.seasonId} / ${identity.matchdayId}`,
    `- GamePhase: ${identity.gamePhase}`,
    `- PlayerPool / FreeAgents: ${identity.playerPool} / ${identity.freeAgentPool}`,
    `- TransferHistory / Roster total: ${identity.transferHistoryCount} / ${identity.rosterCountTotal}`,
    `- Active Save: ${identity.activeSave ? "ja" : "nein"}`,
    `- SourceDir: ${SOURCE_DIR ?? "nicht gefunden"}`,
    "",
    "## Harte Checks",
    `- Teams: ${gameState.teams.length}/32`,
    `- Teams unter Min: ${teamsBelowMin.length}`,
    `- Teams ueber Max: ${teamsAboveMax.length}`,
    `- Doppelspieler: ${duplicatePlayers.length}`,
    `- Negative Cash Teams: ${negativeCashTeams.length}`,
    `- Buy TransferHistory vs PickRows: ${buyHistory.length}/${picks.length}`,
    `- Picks ohne Scores: ${pickRowsMissingScores.length}`,
    `- Rekonstruierte Picks: ${reconstructedPicks.length}`,
    `- Cash uebrig trotz unter Min: ${cashLeftWhileBelowMin.length}`,
    "",
    "## Invalid Reasons",
    ...(hardFailReasons.length ? hardFailReasons.map((reason) => `- ${reason}`) : ["- keine"]),
    "",
    "## Sonderteams",
    ...summary.specialTeams.map(
      (row) =>
        `- ${row.teamName}: identityFit ${row.identityFitAverage}, valueFit ${row.valueFitAverage}, warnings ${row.specialTeamWarnings || "keine"}`,
    ),
    "",
    "## Entscheidung",
    decision === "GREEN"
      ? "- GREEN: Save ist seasonfaehig, alle Teams >= playerMin, keine Hard-Fails."
      : decision === "YELLOW"
        ? "- YELLOW: Save ist technisch seasonfaehig, aber Pickqualitaet/Identitaet braucht Nacharbeit."
        : "- RED: Save ist nicht seasonfaehig. Redraft-Fix muss zurueck in den Redraft-Block.",
  ]);

  console.log(JSON.stringify({ outputDir: OUTPUT_DIR, ...summary }, null, 2));

  if (decision === "RED") {
    process.exitCode = 1;
  }
}

main();
