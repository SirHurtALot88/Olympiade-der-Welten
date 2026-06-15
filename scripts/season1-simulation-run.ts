import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import type { GameState, LineupDraft, PlayerDisciplinePerformanceRecord } from "@/lib/data/olyDataTypes";
import { loadLocalLegacyLineupContext, saveLocalLegacyLineupDraft } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupEntryInput, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getTeamPlayerMax } from "@/lib/foundation/roster-limits";
import { APPLY_CONFIRM_TOKEN, LegacyMatchdayResultApplyService } from "@/lib/resolve/legacy-matchday-result-apply-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { buildScenarioMeta } from "@/lib/persistence/scenario-meta";
import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";
import { executeStandingsApply, STANDINGS_APPLY_CONFIRM_TOKEN } from "@/lib/standings/standings-apply-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";
const EXPECTED_TEAM_COUNT = 32;
const EXPECTED_MATCHDAY_COUNT = 10;
const TARGET_SEASON_ID = process.env.OLY_TARGET_SEASON_ID ?? "season-1";
const EXPORT_PREFIX = process.env.OLY_EXPORT_PREFIX ?? "season1";
const CREATE_COMPLETION_SNAPSHOT = process.env.OLY_CREATE_COMPLETION_SNAPSHOT === "1";
const TARGET_SAVE_ID = process.env.OLY_TARGET_SAVE_ID ?? null;
const MAX_MATCHDAYS = Number(process.env.OLY_MAX_MATCHDAYS ?? "0");
const ADVANCE_AFTER_MATCHDAY = process.env.OLY_ADVANCE_AFTER_MATCHDAY !== "0";
const FORCE_REPLACE_RESULTS = process.env.OLY_FORCE_REPLACE_RESULTS === "1";

type CandidateEntry = {
  activePlayerId: string;
  playerId: string;
  score: number;
};

type MatchdayRunReport = {
  matchdayId: string;
  matchdayIndex: number;
  resolveStatus: string;
  resultApplyId: string | null;
  standingsApplyId: string | null;
  advanceAuditId: string | null;
  resolvedTeams: number;
  disciplineRows: number;
  playerPerformanceRows: number;
  tieFixAttempts: number;
  tieFixTeams: string[];
  warnings: string[];
  blockers: string[];
};

type SimulationExport = {
  generatedAt: string;
  dryRun: boolean;
  saveId: string;
  saveName: string | null;
  seasonId: string;
  currentMatchdayAtStart: string;
  preflight: Record<string, unknown>;
  matchdays: MatchdayRunReport[];
  final: Record<string, unknown>;
  blockersFixed: string[];
  openBlockers: string[];
};

function parseArgs() {
  return {
    write: process.argv.includes("--write"),
    exportOnly: process.argv.includes("--export-only") || process.argv.includes("--finalize-only"),
  };
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeFile(name: string, content: string) {
  ensureOutputDir();
  fs.writeFileSync(path.join(OUTPUT_DIR, name), content);
}

function exportName(suffix: string) {
  return `${EXPORT_PREFIX}-${suffix}`;
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) return [[]];
  if (items.length < count) return [];

  const result: T[][] = [];
  for (let index = 0; index <= items.length - count; index += 1) {
    const head = items[index];
    if (!head) continue;
    for (const tail of combinations(items.slice(index + 1), count - 1)) {
      result.push([head, ...tail]);
    }
  }
  return result;
}

function sumScores(entries: CandidateEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.score, 0);
}

function selectDisjointLineupVariant(input: {
  d1PlayerCount: number;
  d2PlayerCount: number;
  d1Candidates: CandidateEntry[];
  d2Candidates: CandidateEntry[];
  variantIndex: number;
}) {
  const variants: Array<{ d1: CandidateEntry[]; d2: CandidateEntry[]; total: number }> = [];
  for (const d1 of combinations(input.d1Candidates, input.d1PlayerCount)) {
    const d1Ids = new Set(d1.map((entry) => entry.activePlayerId));
    for (const d2 of combinations(input.d2Candidates, input.d2PlayerCount)) {
      if (d2.some((entry) => d1Ids.has(entry.activePlayerId))) continue;
      variants.push({ d1, d2, total: sumScores(d1) + sumScores(d2) });
    }
  }
  variants.sort((left, right) => right.total - left.total);
  return variants[input.variantIndex] ?? variants[0] ?? null;
}

function buildEntriesForSide(input: {
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  candidates: CandidateEntry[];
  captainEnabled: boolean;
}) {
  return input.candidates.map<LegacyLineupEntryInput>((candidate, index) => ({
    disciplineId: input.disciplineId,
    disciplineSide: input.disciplineSide,
    slotIndex: index,
    playerId: candidate.playerId,
    activePlayerId: candidate.activePlayerId,
    isCaptain: input.captainEnabled && index === 0,
  }));
}

function buildVariantEntries(params: LegacyLineupKeyParams, variantIndex: number, existingDraft: LineupDraft | null) {
  const contextResult = loadLocalLegacyLineupContext(params);
  if (!contextResult.ok) {
    throw new Error(`Lineup context missing for ${params.matchdayId}/${params.teamId}: ${contextResult.errors.join(" | ")}`);
  }

  const context = contextResult.context;
  const d1 = context.matchdayContract?.discipline1;
  const d2 = context.matchdayContract?.discipline2;
  if (!d1?.requiredPlayers || !d2?.requiredPlayers) {
    throw new Error(`D1/D2 contract missing for ${params.matchdayId}/${params.teamId}.`);
  }

  const scoreMap = new Map(
    context.disciplineScores.map((entry) => [`${entry.playerId}::${entry.disciplineId}`, entry.score] as const),
  );
  const d1Candidates = context.activePlayers
    .map((player) => ({
      activePlayerId: player.id,
      playerId: player.playerId,
      score: scoreMap.get(`${player.playerId}::${d1.disciplineId}`),
    }))
    .filter((entry): entry is CandidateEntry => typeof entry.score === "number")
    .sort((left, right) => right.score - left.score);
  const d2Candidates = context.activePlayers
    .map((player) => ({
      activePlayerId: player.id,
      playerId: player.playerId,
      score: scoreMap.get(`${player.playerId}::${d2.disciplineId}`),
    }))
    .filter((entry): entry is CandidateEntry => typeof entry.score === "number")
    .sort((left, right) => right.score - left.score);

  const selected = selectDisjointLineupVariant({
    d1PlayerCount: d1.requiredPlayers,
    d2PlayerCount: d2.requiredPlayers,
    d1Candidates,
    d2Candidates,
    variantIndex,
  });
  if (!selected) {
    throw new Error(`Could not create disjoint lineup variant for ${params.matchdayId}/${params.teamId}.`);
  }

  const captainKey = new Set(
    (existingDraft?.entries ?? [])
      .filter((entry) => entry.isCaptain)
      .map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
  );
  return [
    ...buildEntriesForSide({
      disciplineId: d1.disciplineId,
      disciplineSide: "d1",
      candidates: selected.d1,
      captainEnabled: captainKey.has(`${d1.disciplineId}::d1`),
    }),
    ...buildEntriesForSide({
      disciplineId: d2.disciplineId,
      disciplineSide: "d2",
      candidates: selected.d2,
      captainEnabled: captainKey.has(`${d2.disciplineId}::d2`),
    }),
  ];
}

function getActiveSave() {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = (TARGET_SAVE_ID ? persistence.getSaveById(TARGET_SAVE_ID) : null) ?? persistence.getActiveSave() ?? bootstrapped.save;
  if (!save) throw new Error("No active local save found.");
  return { persistence, save };
}

function buildPreflight(gameState: GameState) {
  const rosterByTeam = new Map<string, number>();
  const duplicateRosterPlayers = new Set<string>();
  const seenPlayers = new Set<string>();
  for (const roster of gameState.rosters) {
    rosterByTeam.set(roster.teamId, (rosterByTeam.get(roster.teamId) ?? 0) + 1);
    if (seenPlayers.has(roster.playerId)) duplicateRosterPlayers.add(roster.playerId);
    seenPlayers.add(roster.playerId);
  }

  const shortTeams = gameState.teams
    .filter((team) => (rosterByTeam.get(team.teamId) ?? 0) < 7)
    .map((team) => team.teamId);
  const oversizedTeams = gameState.teams
    .filter((team) => (rosterByTeam.get(team.teamId) ?? 0) > getTeamPlayerMax(team, gameState.teamIdentities.find((identity) => identity.teamId === team.teamId)))
    .map((team) => team.teamId);
  const negativeCashTeams = gameState.teams.filter((team) => team.cash < 0).map((team) => team.teamId);
  const seasonLineups = gameState.seasonState.lineupDrafts?.filter((draft) => draft.seasonId === gameState.season.id) ?? [];
  const formCards = gameState.seasonState.formCards?.filter((card) => card.seasonId === gameState.season.id) ?? [];

  return {
    seasonId: gameState.season.id,
    currentMatchday: gameState.matchdayState.matchdayId,
    matchdayCount: gameState.season.matchdayIds.length,
    teamCount: gameState.teams.length,
    rosterCount: gameState.rosters.length,
    shortTeams,
    oversizedTeams,
    duplicateRosterPlayerCount: duplicateRosterPlayers.size,
    negativeCashTeams,
    lineupDraftCount: seasonLineups.length,
    formCardCount: formCards.length,
    standingsTeamCount: Object.keys(gameState.seasonState.standings ?? {}).length,
    resultCount: gameState.seasonState.matchdayResults?.length ?? 0,
  };
}

function assertPreflightReady(preflight: ReturnType<typeof buildPreflight>) {
  const blockers: string[] = [];
  const expectedLineupCount = MAX_MATCHDAYS > 0 ? EXPECTED_TEAM_COUNT * MAX_MATCHDAYS : EXPECTED_TEAM_COUNT * EXPECTED_MATCHDAY_COUNT;
  if (preflight.seasonId !== TARGET_SEASON_ID) blockers.push(`season_not_${TARGET_SEASON_ID}:${preflight.seasonId}`);
  if (preflight.currentMatchday !== "matchday-1") blockers.push(`matchday_not_1:${preflight.currentMatchday}`);
  if (preflight.matchdayCount !== EXPECTED_MATCHDAY_COUNT) blockers.push(`matchday_count:${preflight.matchdayCount}`);
  if (preflight.teamCount !== EXPECTED_TEAM_COUNT) blockers.push(`team_count:${preflight.teamCount}`);
  if (preflight.shortTeams.length > 0) blockers.push(`teams_under_7:${preflight.shortTeams.join("|")}`);
  if (preflight.oversizedTeams.length > 0) blockers.push(`teams_over_playerMax:${preflight.oversizedTeams.join("|")}`);
  if (preflight.duplicateRosterPlayerCount > 0) blockers.push(`duplicate_rosters:${preflight.duplicateRosterPlayerCount}`);
  if (preflight.negativeCashTeams.length > 0) blockers.push(`negative_cash:${preflight.negativeCashTeams.join("|")}`);
  if (preflight.lineupDraftCount < expectedLineupCount) blockers.push(`lineups_missing:${preflight.lineupDraftCount}/${expectedLineupCount}`);
  if (preflight.formCardCount < EXPECTED_TEAM_COUNT) blockers.push(`formcards_missing:${preflight.formCardCount}`);
  if (preflight.resultCount > 0 && !FORCE_REPLACE_RESULTS) blockers.push(`save_already_has_results:${preflight.resultCount}`);
  if (blockers.length > 0) {
    throw new Error(`Preflight blocked: ${blockers.join(" | ")}`);
  }
}

function assertFinalStateReady(preflight: ReturnType<typeof buildPreflight>) {
  const blockers: string[] = [];
  if (preflight.seasonId !== TARGET_SEASON_ID) blockers.push(`season_not_${TARGET_SEASON_ID}:${preflight.seasonId}`);
  if (preflight.matchdayCount !== EXPECTED_MATCHDAY_COUNT) blockers.push(`matchday_count:${preflight.matchdayCount}`);
  if (preflight.teamCount !== EXPECTED_TEAM_COUNT) blockers.push(`team_count:${preflight.teamCount}`);
  if (preflight.shortTeams.length > 0) blockers.push(`teams_under_7:${preflight.shortTeams.join("|")}`);
  if (preflight.oversizedTeams.length > 0) blockers.push(`teams_over_playerMax:${preflight.oversizedTeams.join("|")}`);
  if (preflight.duplicateRosterPlayerCount > 0) blockers.push(`duplicate_rosters:${preflight.duplicateRosterPlayerCount}`);
  if (preflight.negativeCashTeams.length > 0) blockers.push(`negative_cash:${preflight.negativeCashTeams.join("|")}`);
  if (preflight.lineupDraftCount < EXPECTED_TEAM_COUNT * EXPECTED_MATCHDAY_COUNT) blockers.push(`lineups_missing:${preflight.lineupDraftCount}`);
  if (preflight.formCardCount < EXPECTED_TEAM_COUNT) blockers.push(`formcards_missing:${preflight.formCardCount}`);
  if (preflight.resultCount !== EXPECTED_MATCHDAY_COUNT) blockers.push(`matchday_results:${preflight.resultCount}/10`);
  if (blockers.length > 0) {
    throw new Error(`Final-state export blocked: ${blockers.join(" | ")}`);
  }
}

function loadMatchdayContexts(saveId: string, seasonId: string, matchdayId: string, teamIds: string[]) {
  return teamIds.map((teamId) => {
    const context = loadLocalLegacyLineupContext({ saveId, seasonId, matchdayId, teamId });
    if (!context.ok) {
      throw new Error(`Context failed for ${matchdayId}/${teamId}: ${context.errors.join(" | ")}`);
    }
    return context.context;
  });
}

function getExistingDraft(gameState: GameState, params: LegacyLineupKeyParams) {
  return (
    (gameState.seasonState.lineupDrafts ?? []).find(
      (draft) =>
        draft.saveId === params.saveId &&
        draft.seasonId === params.seasonId &&
        draft.matchdayId === params.matchdayId &&
        draft.teamId === params.teamId,
    ) ?? null
  );
}

async function resolveAndApplyMatchday(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  matchdayIndex: number;
  write: boolean;
  persistence: ReturnType<typeof createPersistenceService>;
}) {
  const report: MatchdayRunReport = {
    matchdayId: input.matchdayId,
    matchdayIndex: input.matchdayIndex,
    resolveStatus: "unknown",
    resultApplyId: null,
    standingsApplyId: null,
    advanceAuditId: null,
    resolvedTeams: 0,
    disciplineRows: 0,
    playerPerformanceRows: 0,
    tieFixAttempts: 0,
    tieFixTeams: [],
    warnings: [],
    blockers: [],
  };
  const resultApplyService = new LegacyMatchdayResultApplyService(undefined, undefined, input.persistence);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const save = input.persistence.getSaveById(input.saveId);
    if (!save) throw new Error(`Save disappeared before ${input.matchdayId}.`);
    const teamIds = save.gameState.teams.map((team) => team.teamId);
    const contexts = loadMatchdayContexts(input.saveId, input.seasonId, input.matchdayId, teamIds);
    const resolvePreview = buildLegacyMatchdayResolvePreview(contexts);
    report.resolveStatus = resolvePreview.status;
    report.resolvedTeams = resolvePreview.teamResults.filter((team) => team.status === "ready").length;
    report.warnings.push(...resolvePreview.warnings);
    if (resolvePreview.status !== "ready") {
      report.blockers.push(`resolve_status:${resolvePreview.status}`);
      throw new Error(`${input.matchdayId} resolve blocked: ${resolvePreview.status}`);
    }

    if (!input.write) {
      return report;
    }

    const resultApply = await resultApplyService.applyLegacyMatchdayResult({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      source: "sqlite",
      execute: true,
      confirm: APPLY_CONFIRM_TOKEN,
      forceReplace: FORCE_REPLACE_RESULTS || attempt > 0,
    });
    if (!resultApply.ok || !resultApply.applied) {
      const reason = resultApply.ok ? "not_applied" : resultApply.error;
      report.blockers.push(`result_apply:${reason}`);
      throw new Error(`${input.matchdayId} result apply failed: ${reason}`);
    }
    report.resultApplyId = resultApply.matchdayResultId;
    report.disciplineRows = resultApply.resultsWritten;
    report.playerPerformanceRows = resultApply.playerPerformancesWritten;

    const standingsPreview = await buildStandingsPreview({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      source: "sqlite",
    }, undefined, input.persistence);
    const tieOnly =
      standingsPreview.items.every((item) => item.resultStatus === "ready" || item.resultStatus === "tie_warning") &&
      standingsPreview.tieGroups.length > 0;

    if (standingsPreview.items.every((item) => item.resultStatus === "ready")) {
      const standingsApply = await executeStandingsApply({
        saveId: input.saveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        source: "sqlite",
        execute: true,
        confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
        forceReplace: FORCE_REPLACE_RESULTS,
      }, input.persistence);
      if (!standingsApply.ok || !standingsApply.applied) {
        report.blockers.push(`standings_apply:${standingsApply.blockingReasons.join("|")}`);
        throw new Error(`${input.matchdayId} standings apply failed: ${standingsApply.blockingReasons.join(" | ")}`);
      }
      report.standingsApplyId = standingsApply.auditLogId;
      return report;
    }

    if (!tieOnly) {
      const nonReady = standingsPreview.items
        .filter((item) => item.resultStatus !== "ready")
        .map((item) => `${item.teamId}:${item.resultStatus}`)
        .join(",");
      report.blockers.push(`standings_preview:${nonReady}`);
      throw new Error(`${input.matchdayId} standings preview blocked: ${nonReady}`);
    }

    const tiedTeamIds = Array.from(new Set(
      standingsPreview.tieGroups.flatMap((group) => group.affectedTeams.map((team) => team.teamId)),
    ));
    report.tieFixAttempts += 1;
    report.tieFixTeams.push(...tiedTeamIds);

    for (const [index, teamId] of tiedTeamIds.entries()) {
      const params = { saveId: input.saveId, seasonId: input.seasonId, matchdayId: input.matchdayId, teamId };
      const currentSave = input.persistence.getSaveById(input.saveId);
      if (!currentSave) throw new Error(`Save disappeared while fixing tie for ${teamId}.`);
      const existingDraft = getExistingDraft(currentSave.gameState, params);
      const entries = buildVariantEntries(params, attempt + index + 1, existingDraft);
      const saveResult = saveLocalLegacyLineupDraft(params, entries, existingDraft?.modifiers, input.persistence);
      if (!saveResult.ok) {
        throw new Error(`${input.matchdayId} tie lineup rewrite failed for ${teamId}: ${saveResult.errors.join(" | ")}`);
      }
    }
  }

  report.blockers.push("tie_fix_attempts_exhausted");
  throw new Error(`${input.matchdayId} exhausted tie-fix attempts.`);
}

function finalizeSeasonIfNeeded(saveId: string, persistence: ReturnType<typeof createPersistenceService>) {
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Save disappeared during finalization.");
  const seasonId = save.gameState.season.id;
  const lastMatchdayId = save.gameState.season.matchdayIds[save.gameState.season.matchdayIds.length - 1];
  const hasLastResult = (save.gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === seasonId && result.matchdayId === lastMatchdayId,
  );
  const hasLastStandings = (save.gameState.seasonState.standingsApplyLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.matchdayId === lastMatchdayId,
  );
  if (!hasLastResult || !hasLastStandings) return null;
  const alreadyFinalized =
    save.gameState.gamePhase === "season_completed" &&
    save.gameState.matchdayState.matchdayId === lastMatchdayId &&
    save.gameState.matchdayState.status === "resolved";
  if (alreadyFinalized) return "season_completed";

  const now = new Date().toISOString();
  const nextGameState: GameState = {
    ...save.gameState,
    gamePhase: "season_completed",
    seasonState: {
      ...save.gameState.seasonState,
      schedule: save.gameState.seasonState.schedule.map((fixture) =>
        fixture.matchdayId === lastMatchdayId ? { ...fixture, status: "resolved" as const } : fixture,
      ),
      lineupDrafts: (save.gameState.seasonState.lineupDrafts ?? []).map((draft) =>
        draft.seasonId === seasonId && draft.matchdayId === lastMatchdayId
          ? { ...draft, status: "resolved" as const, updatedAt: now }
          : draft,
      ),
    },
    matchdayState: {
      matchdayId: lastMatchdayId,
      status: "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: save.gameState.seasonState.schedule
        .filter((fixture) => fixture.matchdayId === lastMatchdayId)
        .map((fixture) => fixture.id),
    },
    logs: [
      ...save.gameState.logs,
      {
        id: `season-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: "season",
        message: "Season 1 Simulation abgeschlossen. Saisonabschluss ist bereit.",
        createdAt: now,
      },
    ],
  };
  persistence.saveSingleplayerState(save.saveId, nextGameState);
  return "season_completed";
}

function loadPreviousMatchdayReports(saveId: string): MatchdayRunReport[] {
  const summaryPath = path.join(OUTPUT_DIR, exportName("simulation-summary.json"));
  if (!fs.existsSync(summaryPath)) return [];
  try {
    const previous = JSON.parse(fs.readFileSync(summaryPath, "utf8")) as SimulationExport;
    if (previous.saveId !== saveId) return [];
    return previous.matchdays ?? [];
  } catch {
    return [];
  }
}

function buildExistingMatchdayReports(gameState: GameState, saveId: string, previousReports: MatchdayRunReport[]) {
  const previousByMatchday = new Map(previousReports.map((report) => [report.matchdayId, report] as const));
  const resultByMatchday = new Map(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === gameState.season.id)
      .map((result) => [result.matchdayId, result] as const),
  );
  const standingsLogByMatchday = new Map(
    (gameState.seasonState.standingsApplyLogs ?? [])
      .filter((log) => log.seasonId === gameState.season.id)
      .map((log) => [log.matchdayId, log] as const),
  );
  const advanceLogByMatchday = new Map(
    (gameState.seasonState.matchdayAdvanceLogs ?? [])
      .filter((log) => log.seasonId === gameState.season.id)
      .map((log) => [log.fromMatchdayId, log] as const),
  );
  const disciplineRowsByResult = new Map<string, number>();
  for (const row of gameState.seasonState.disciplineResults ?? []) {
    disciplineRowsByResult.set(row.matchdayResultId, (disciplineRowsByResult.get(row.matchdayResultId) ?? 0) + 1);
  }
  const playerRowsByResult = new Map<string, number>();
  for (const row of gameState.seasonState.playerDisciplinePerformances ?? []) {
    playerRowsByResult.set(row.matchdayResultId, (playerRowsByResult.get(row.matchdayResultId) ?? 0) + 1);
  }

  return gameState.season.matchdayIds.map((matchdayId, index) => {
    const previous = previousByMatchday.get(matchdayId);
    const result = resultByMatchday.get(matchdayId);
    const standingsLog = standingsLogByMatchday.get(matchdayId);
    const advanceLog = advanceLogByMatchday.get(matchdayId);
    return {
      matchdayId,
      matchdayIndex: index + 1,
      resolveStatus: result ? "ready" : "missing_result",
      resultApplyId: result?.id ?? null,
      standingsApplyId: standingsLog?.id ?? null,
      advanceAuditId: advanceLog?.id ?? null,
      resolvedTeams: EXPECTED_TEAM_COUNT,
      disciplineRows: result ? disciplineRowsByResult.get(result.id) ?? 0 : 0,
      playerPerformanceRows: result ? playerRowsByResult.get(result.id) ?? 0 : 0,
      tieFixAttempts: previous?.tieFixAttempts ?? 0,
      tieFixTeams: previous?.tieFixTeams ?? [],
      warnings: previous?.warnings ?? [],
      blockers: result && standingsLog ? [] : ["existing_result_or_standings_missing"],
    } satisfies MatchdayRunReport;
  });
}

function aggregatePlayerRows(gameState: GameState) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const aggregate = new Map<string, {
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
    appearances: number;
    totalContribution: number;
    totalFinalScore: number;
    top10Count: number;
    mvpCount: number;
    bestDisciplineId: string | null;
    bestFinalScore: number;
  }>();

  for (const row of gameState.seasonState.playerDisciplinePerformances ?? []) {
    const player = playerById.get(row.playerId);
    const team = teamById.get(row.teamId);
    const current = aggregate.get(row.playerId) ?? {
      playerId: row.playerId,
      playerName: player?.name ?? row.playerId,
      teamId: row.teamId,
      teamName: team?.name ?? row.teamId,
      appearances: 0,
      totalContribution: 0,
      totalFinalScore: 0,
      top10Count: 0,
      mvpCount: 0,
      bestDisciplineId: null,
      bestFinalScore: Number.NEGATIVE_INFINITY,
    };
    current.appearances += 1;
    current.totalContribution += row.scoreContribution;
    current.totalFinalScore += row.finalPlayerScore;
    current.top10Count += row.isTop10 ? 1 : 0;
    current.mvpCount += row.isMvpCandidate ? 1 : 0;
    if (row.finalPlayerScore > current.bestFinalScore) {
      current.bestFinalScore = row.finalPlayerScore;
      current.bestDisciplineId = row.disciplineId;
    }
    aggregate.set(row.playerId, current);
  }

  return Array.from(aggregate.values())
    .map((row) => ({
      ...row,
      totalContribution: Number(row.totalContribution.toFixed(2)),
      avgContribution: Number((row.totalContribution / Math.max(1, row.appearances)).toFixed(2)),
      avgFinalScore: Number((row.totalFinalScore / Math.max(1, row.appearances)).toFixed(2)),
      bestFinalScore: Number(row.bestFinalScore.toFixed(2)),
    }))
    .sort((left, right) =>
      right.totalContribution - left.totalContribution ||
      right.mvpCount - left.mvpCount ||
      right.top10Count - left.top10Count ||
      left.playerName.localeCompare(right.playerName, "de"),
    );
}

function buildMatchdayResultRows(gameState: GameState) {
  const resultById = new Map((gameState.seasonState.matchdayResults ?? []).map((result) => [result.id, result] as const));
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  return (gameState.seasonState.disciplineResults ?? []).map((row) => {
    const result = resultById.get(row.matchdayResultId);
    return {
      matchdayId: result?.matchdayId ?? "",
      teamId: row.teamId,
      teamName: teamById.get(row.teamId)?.name ?? row.teamId,
      disciplineId: row.disciplineId,
      side: row.disciplineSide,
      rank: row.rank,
      baseScore: row.baseScore,
      totalScore: row.totalScore,
      readinessStatus: row.readinessStatus,
      warnings: row.warnings.join("|"),
    };
  });
}

function buildStandingsRows(gameState: GameState) {
  return gameState.teams
    .map((team) => ({
      teamId: team.teamId,
      teamName: team.name,
      rank: gameState.seasonState.standings[team.teamId]?.rank ?? null,
      points: gameState.seasonState.standings[team.teamId]?.points ?? 0,
      cash: team.cash,
      roster: gameState.rosters.filter((roster) => roster.teamId === team.teamId).length,
    }))
    .sort((left, right) =>
      (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY) ||
      right.points - left.points ||
      left.teamName.localeCompare(right.teamName, "de"),
    );
}

function buildPlayerPerformanceRows(rows: PlayerDisciplinePerformanceRecord[], gameState: GameState) {
  const resultById = new Map((gameState.seasonState.matchdayResults ?? []).map((result) => [result.id, result] as const));
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  return rows.map((row) => ({
    matchdayId: resultById.get(row.matchdayResultId)?.matchdayId ?? "",
    teamId: row.teamId,
    teamName: teamById.get(row.teamId)?.name ?? row.teamId,
    playerId: row.playerId,
    playerName: playerById.get(row.playerId)?.name ?? row.playerId,
    disciplineId: row.disciplineId,
    side: row.disciplineSide,
    slotIndex: row.slotIndex,
    finalPlayerScore: row.finalPlayerScore,
    scoreContribution: row.scoreContribution,
    rankInDiscipline: row.rankInDiscipline,
    isTop10: row.isTop10,
    isMvpCandidate: row.isMvpCandidate,
  }));
}

function writeExports(exportData: SimulationExport, gameState: GameState) {
  const standingsRows = buildStandingsRows(gameState);
  const playerAggregates = aggregatePlayerRows(gameState);
  const playerPerformanceRows = buildPlayerPerformanceRows(gameState.seasonState.playerDisciplinePerformances ?? [], gameState);
  const champion = standingsRows[0] ?? null;
  const topPlayer = playerAggregates[0] ?? null;

  writeFile(exportName("simulation-summary.json"), `${JSON.stringify(exportData, null, 2)}\n`);
  writeFile(
    exportName("simulation-summary.md"),
    [
      `# ${gameState.season.name} Simulation Summary`,
      "",
      `- Save: ${exportData.saveName ?? "Unbenannt"} (${exportData.saveId})`,
      `- Season: ${exportData.seasonId}`,
      `- Dry Run: ${exportData.dryRun ? "ja" : "nein"}`,
      `- Resolved Matchdays: ${exportData.matchdays.length}/10`,
      `- Champion: ${champion ? `${champion.teamName} (${champion.points} Punkte)` : "—"}`,
      `- Top Player: ${topPlayer ? `${topPlayer.playerName} (${topPlayer.totalContribution} Contribution)` : "—"}`,
      `- GamePhase: ${gameState.gamePhase ?? "season_active"}`,
      `- Open Blockers: ${exportData.openBlockers.length ? exportData.openBlockers.join(", ") : "keine"}`,
      "",
      "## Matchdays",
      ...exportData.matchdays.map((entry) =>
        `- ${entry.matchdayId}: Result=${entry.resultApplyId ?? "preview"} · Standings=${entry.standingsApplyId ?? "preview"} · Tie-Fixes=${entry.tieFixAttempts}`,
      ),
    ].join("\n"),
  );
  writeFile(
    exportName("matchday-results.csv"),
    toCsv(buildMatchdayResultRows(gameState), [
      "matchdayId",
      "teamId",
      "teamName",
      "disciplineId",
      "side",
      "rank",
      "baseScore",
      "totalScore",
      "readinessStatus",
      "warnings",
    ]),
  );
  writeFile(
    exportName("standings-final.csv"),
    toCsv(standingsRows, ["teamId", "teamName", "rank", "points", "cash", "roster"]),
  );
  writeFile(
    exportName("player-pps.csv"),
    toCsv(playerPerformanceRows, [
      "matchdayId",
      "teamId",
      "teamName",
      "playerId",
      "playerName",
      "disciplineId",
      "side",
      "slotIndex",
      "finalPlayerScore",
      "scoreContribution",
      "rankInDiscipline",
      "isTop10",
      "isMvpCandidate",
    ]),
  );
  writeFile(
    exportName("top-players.csv"),
    toCsv(playerAggregates.slice(0, 100), [
      "playerId",
      "playerName",
      "teamId",
      "teamName",
      "appearances",
      "totalContribution",
      "avgContribution",
      "avgFinalScore",
      "top10Count",
      "mvpCount",
      "bestDisciplineId",
      "bestFinalScore",
    ]),
  );
  writeFile(
    exportName("blockers-fixed.md"),
    [
      "# Season 1 Blockers Fixed",
      "",
      exportData.blockersFixed.length
        ? exportData.blockersFixed.map((entry) => `- ${entry}`).join("\n")
        : "- Keine Blocker-Fixes während dieses Simulationslaufs nötig.",
      "",
      "## Offen",
      exportData.openBlockers.length ? exportData.openBlockers.map((entry) => `- ${entry}`).join("\n") : "- Keine offenen Blocker.",
    ].join("\n"),
  );
  writeFile(
    exportName("arena-smoke-proof.json"),
    `${JSON.stringify({
      generatedAt: exportData.generatedAt,
      source: "simulation_export_pending_browser_smoke",
      matchday1: { resultExists: true },
      matchday10: { resultExists: true },
      browserSmoke: "pending",
    }, null, 2)}\n`,
  );
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const args = parseArgs();
  const { persistence, save } = getActiveSave();
  const saveId = save.saveId;
  const seasonId = save.gameState.season.id;
  const currentMatchdayAtStart = save.gameState.matchdayState.matchdayId;
  const preflight = buildPreflight(save.gameState);
  if (args.exportOnly) {
    assertFinalStateReady(preflight);
  } else {
    assertPreflightReady(preflight);
  }

  const previousReports = args.exportOnly ? loadPreviousMatchdayReports(saveId) : [];
  const matchdays: MatchdayRunReport[] = args.exportOnly
    ? buildExistingMatchdayReports(save.gameState, saveId, previousReports)
    : [];
  const blockersFixed: string[] = args.exportOnly
    ? [
        ...previousReports
          .filter((report) => report.tieFixAttempts > 0)
          .map(
            (report) =>
              `${report.matchdayId}: tie_groups_require_confirmed_policy durch ${report.tieFixAttempts} Lineup-Variant-Retry(s) gelöst (${Array.from(new Set(report.tieFixTeams)).join(", ")})`,
          ),
        "persistenz_bug_game_metadata_roundtrip_fixed: gamePhase, seasonTransition und Transition-Subfelder werden jetzt in game_metadata gespeichert und geladen.",
        "reload_completion_inference_fixed: Legacy-Saves ohne gamePhase werden nur bei finalem Result-/Standings-Nachweis als season_completed erkannt.",
        "no_new_lineup_variants_written_in_finalize_export: Export-Only hat keine neuen Lineup-Varianten geschrieben.",
        "cash_prize_apply_untouched: cashPrizeApplyLogs bleibt leer; Preisgeld/Cash wurde im Matchday-Loop nicht angewendet.",
      ]
    : [];
  const openBlockers: string[] = [];

  const matchdayIdsToRun =
    !args.exportOnly && MAX_MATCHDAYS > 0
      ? save.gameState.season.matchdayIds.slice(0, MAX_MATCHDAYS)
      : save.gameState.season.matchdayIds;

  if (!args.exportOnly) for (const [index, matchdayId] of matchdayIdsToRun.entries()) {
    const currentSave = persistence.getSaveById(saveId);
    if (!currentSave) throw new Error(`Save ${saveId} disappeared before ${matchdayId}.`);
    if (args.write && currentSave.gameState.matchdayState.matchdayId !== matchdayId) {
      throw new Error(`Expected active ${matchdayId}, got ${currentSave.gameState.matchdayState.matchdayId}.`);
    }
    const report = await resolveAndApplyMatchday({
      saveId,
      seasonId,
      matchdayId,
      matchdayIndex: index + 1,
      write: args.write,
      persistence,
    });
    if (report.tieFixAttempts > 0) {
      blockersFixed.push(
        `${matchdayId}: tie_groups_require_confirmed_policy durch ${report.tieFixAttempts} Lineup-Variant-Retry(s) gelöst (${Array.from(new Set(report.tieFixTeams)).join(", ")})`,
      );
    }
    if (args.write && ADVANCE_AFTER_MATCHDAY && index < matchdayIdsToRun.length - 1) {
      const advance = await executeMatchdayAdvance({
        saveId,
        seasonId,
        source: "sqlite",
        execute: true,
        confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
      }, persistence);
      if (!advance.ok || !advance.applied) {
        report.blockers.push(`advance:${advance.blockingReasons.join("|")}`);
        throw new Error(`${matchdayId} advance failed: ${advance.blockingReasons.join(" | ")}`);
      }
      report.advanceAuditId = advance.auditLogId;
    }
    matchdays.push(report);
  }

  let phaseAfterFinalize: string | null = null;
  if (args.write || args.exportOnly) {
    phaseAfterFinalize = finalizeSeasonIfNeeded(saveId, persistence);
  }

  const finalizedSave = persistence.getSaveById(saveId);
  if (!finalizedSave) throw new Error("Save disappeared before export.");
  const finalSave = args.write && CREATE_COMPLETION_SNAPSHOT
    ? persistence.createScenarioSnapshot({
        sourceSaveId: finalizedSave.saveId,
        name: `${finalizedSave.gameState.season.name} Sim Complete`,
        scenarioMeta: buildScenarioMeta({
          gameState: finalizedSave.gameState,
          scenarioType: "sandbox_snapshot",
          label: `${finalizedSave.gameState.season.name} Sim Complete`,
          description: `Persistenter Testpunkt nach kompletter ${finalizedSave.gameState.season.name}-Simulation.`,
          sourceSaveId: finalizedSave.saveId,
          isStableTestPoint: true,
          allowTestWrites: false,
        }),
      })
    : finalizedSave;
  const standingsRows = buildStandingsRows(finalSave.gameState);
  const playerAggregates = aggregatePlayerRows(finalSave.gameState);
  const matchdayResultCount = finalSave.gameState.seasonState.matchdayResults?.filter((row) => row.seasonId === seasonId).length ?? 0;
  const disciplineRows = finalSave.gameState.seasonState.disciplineResults?.length ?? 0;
  const playerPpsRows = finalSave.gameState.seasonState.playerDisciplinePerformances?.length ?? 0;

  if (args.write || args.exportOnly) {
    if (matchdayResultCount !== EXPECTED_MATCHDAY_COUNT) openBlockers.push(`matchday_results:${matchdayResultCount}/10`);
    if (Object.keys(finalSave.gameState.seasonState.standings ?? {}).length !== EXPECTED_TEAM_COUNT) openBlockers.push("standings_team_count_not_32");
    if (!standingsRows[0]?.teamId) openBlockers.push("champion_missing");
    if (playerAggregates.length === 0) openBlockers.push("player_pps_missing");
  }

  const exportData: SimulationExport = {
    generatedAt: new Date().toISOString(),
    dryRun: !args.write && !args.exportOnly,
    saveId,
    saveName: finalSave.name ?? null,
    seasonId,
    currentMatchdayAtStart,
    preflight,
    matchdays,
    final: {
      gamePhase: finalSave.gameState.gamePhase ?? "season_active",
      phaseAfterFinalize,
      activeMatchday: finalSave.gameState.matchdayState.matchdayId,
      matchdayStatus: finalSave.gameState.matchdayState.status,
      matchdayResultCount,
      disciplineRows,
      playerPpsRows,
      champion: standingsRows[0] ?? null,
      topPlayer: playerAggregates[0] ?? null,
      cashPrizeApplyLogs: finalSave.gameState.seasonState.cashPrizeApplyLogs?.length ?? 0,
    },
    blockersFixed,
    openBlockers,
  };
  writeExports(exportData, finalSave.gameState);

  console.log(JSON.stringify(exportData, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
