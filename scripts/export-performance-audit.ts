import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import type { PersistedSaveGame, PersistenceBootstrapResult, PersistenceService, SaveSummary } from "@/lib/persistence/types";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";
import { createSaveGameState, loadFreshSeasonOneSeedData } from "@/lib/data/dataAdapter";
import type { GameState } from "@/lib/data/olyDataTypes";
import { loadLocalLegacyLineupContext, saveLocalLegacyLineupDraft, saveLocalLegacyLineupDraftBatch, calculateLocalLegacyLineupPreview } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupEntryInput } from "@/lib/lineups/legacy-lineup-types";
import { LegacyMatchdayResultApplyService, APPLY_CONFIRM_TOKEN } from "@/lib/resolve/legacy-matchday-result-apply-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";
import { executeStandingsApply, STANDINGS_APPLY_CONFIRM_TOKEN } from "@/lib/standings/standings-apply-service";
import { executeMatchdayAdvance, ADVANCE_MATCHDAY_CONFIRM_TOKEN } from "@/lib/season/matchday-progress-service";
import { buildSeasonSnapshotDryRun } from "@/lib/season/season-snapshot-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildAiTransfermarktPreview } from "@/lib/ai/ai-transfermarkt-preview-service";
import { buildAiTransfermarktSellPreview } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { listLocalTransfermarktFreeAgents, previewLocalTransfermarktBuy, previewLocalTransfermarktSell } from "@/lib/market/transfermarkt-local-service";
import { buildContractNegotiationPreview } from "@/lib/market/contract-negotiation-preview";
import { previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { buildPlayerDrawerDataFromGameState } from "@/lib/foundation/player-detail-drawer";
import {
  buildGameStateContentSignature,
  getSeasonDerivations,
  getSeasonPointsLedger,
} from "@/lib/foundation/get-season-derivations";
import { invalidateSeasonDerivationsCache } from "@/lib/foundation/season-derivations-cache";
import { buildSeasonEndProgressionPreview } from "@/lib/training/season-end-progression-preview";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  path.join(process.cwd(), "outputs");

type Severity = "ok" | "beobachten" | "langsam" | "kritisch" | "blockierend";

type PhaseRecord = {
  phaseName: string;
  durationMs: number;
  itemCount: number;
  saveId: string;
  seasonId: string;
  matchdayId: string | null;
  warnings: string[];
  source: string;
  severity: Severity;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function classifySeverity(durationMs: number): Severity {
  if (durationMs < 250) return "ok";
  if (durationMs < 1000) return "beobachten";
  if (durationMs < 5000) return "langsam";
  if (durationMs < 30000) return "kritisch";
  return "blockierend";
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}

function writeOutput(name: string, content: string) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(outputPath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  return outputPath;
}

function createInMemoryPersistence(initialSave: PersistedSaveGame): PersistenceService {
  let currentSave = structuredClone(initialSave);
  return {
    bootstrapSingleplayerSave(): PersistenceBootstrapResult {
      return { save: currentSave, createdFromSeed: false };
    },
    getActiveSave() {
      return currentSave;
    },
    getSaveById(saveId: string) {
      return saveId === currentSave.saveId || saveId === "active" || saveId === "current" ? currentSave : null;
    },
    saveSingleplayerState(saveId: string, gameState: GameState) {
      if (saveId !== currentSave.saveId) {
        throw new Error(`In-memory persistence cannot save unknown save ${saveId}.`);
      }
      currentSave = {
        ...currentSave,
        updatedAt: new Date().toISOString(),
        gameState: structuredClone(gameState),
      };
      return currentSave;
    },
    createSave() {
      throw new Error("In-memory performance audit does not create additional saves.");
    },
    createFreshSeasonOneSave() {
      throw new Error("In-memory performance audit does not create additional saves.");
    },
    cloneSave() {
      throw new Error("In-memory performance audit does not clone saves.");
    },
    createScenarioSnapshot() {
      throw new Error("In-memory performance audit does not create scenario snapshots.");
    },
    activateSave() {
      return currentSave;
    },
    listSaves(): SaveSummary[] {
      return [
        {
          saveId: currentSave.saveId,
          name: currentSave.name,
          status: currentSave.status,
          createdAt: currentSave.createdAt,
          updatedAt: currentSave.updatedAt,
          scenarioMeta: currentSave.gameState.scenarioMeta,
        },
      ];
    },
  };
}

function createInMemoryFreshSave(): PersistedSaveGame {
  const now = new Date().toISOString();
  const saveState = createSaveGameState("perf-audit-fresh-season-1", loadFreshSeasonOneSeedData());
  return {
    saveId: "perf-audit-fresh-season-1",
    name: "Performance Audit Fresh Season 1",
    status: "active",
    createdAt: now,
    updatedAt: now,
    gameState: saveState.gameState,
  };
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

type CandidateEntry = {
  activePlayerId: string;
  playerId: string;
  score: number;
};

function selectBestDisjointLineup(input: {
  d1PlayerCount: number;
  d2PlayerCount: number;
  d1Candidates: CandidateEntry[];
  d2Candidates: CandidateEntry[];
}) {
  const d1Combos = combinations(input.d1Candidates, input.d1PlayerCount);
  const d2Combos = combinations(input.d2Candidates, input.d2PlayerCount);
  let best:
    | {
        d1: CandidateEntry[];
        d2: CandidateEntry[];
        total: number;
      }
    | null = null;

  for (const d1 of d1Combos) {
    const usedIds = new Set(d1.map((entry) => entry.activePlayerId));
    for (const d2 of d2Combos) {
      if (d2.some((entry) => usedIds.has(entry.activePlayerId))) continue;
      const total = d1.reduce((sum, entry) => sum + entry.score, 0) + d2.reduce((sum, entry) => sum + entry.score, 0);
      if (!best || total > best.total) {
        best = { d1, d2, total };
      }
    }
  }

  return best;
}

function buildEntriesForSide(input: {
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  candidates: CandidateEntry[];
}) {
  return input.candidates.map<LegacyLineupEntryInput>((candidate, index) => ({
    disciplineId: input.disciplineId,
    disciplineSide: input.disciplineSide,
    slotIndex: index,
    playerId: candidate.playerId,
    activePlayerId: candidate.activePlayerId,
    isCaptain: index === 0,
  }));
}

function topUpRostersForLineups(persistence: PersistenceService, saveId: string, seasonId: string, matchdayId: string) {
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Missing in-memory save ${saveId} for roster top-up.`);
  }
  const sampleContext = loadLocalLegacyLineupContext({
    saveId,
    seasonId,
    matchdayId,
    teamId: save.gameState.teams[0]!.teamId,
  }, persistence);
  if (!sampleContext.ok) {
    throw new Error(`Could not load lineup base context: ${sampleContext.errors.join(" | ")}`);
  }
  const requiredUniquePlayers =
    (sampleContext.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (sampleContext.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);
  if (requiredUniquePlayers <= 0) return;

  const usedPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const freePlayerPool = save.gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = save.gameState.rosters.length;
  const nextState = structuredClone(save.gameState);

  for (const team of nextState.teams) {
    const teamRoster = nextState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayerPool[poolIndex];
      if (!player) {
        throw new Error("Not enough free players available for lineup top-up.");
      }
      poolIndex += 1;
      nextState.rosters.push({
        id: `perf-audit-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: nextState.season.id,
      });
      rosterCounter += 1;
    }
  }

  persistence.saveSingleplayerState(saveId, nextState);
}

function buildBestLineupEntries(persistence: PersistenceService, params: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
}) {
  const contextResult = loadLocalLegacyLineupContext(params, persistence);
  if (!contextResult.ok) {
    throw new Error(`Lineup context failed for ${params.teamId}: ${contextResult.errors.join(" | ")}`);
  }
  const context = contextResult.context;
  const d1 = context.matchdayContract?.discipline1;
  const d2 = context.matchdayContract?.discipline2;
  if (!d1 || !d2) {
    throw new Error(`Missing discipline contract for ${params.teamId}.`);
  }
  const d1Required = d1.requiredPlayers ?? 0;
  const d2Required = d2.requiredPlayers ?? 0;

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

  const best = selectBestDisjointLineup({
    d1PlayerCount: d1Required,
    d2PlayerCount: d2Required,
    d1Candidates,
    d2Candidates,
  });
  if (!best) {
    throw new Error(`Could not build lineup for ${params.teamId}.`);
  }

  return [
    ...buildEntriesForSide({ disciplineId: d1.disciplineId, disciplineSide: "d1", candidates: best.d1 }),
    ...buildEntriesForSide({ disciplineId: d2.disciplineId, disciplineSide: "d2", candidates: best.d2 }),
  ];
}

async function measurePhase(
  records: PhaseRecord[],
  input: {
    phaseName: string;
    saveId: string;
    seasonId: string;
    matchdayId: string | null;
    source: string;
    timeoutMs?: number;
    run: () => Promise<{ itemCount?: number; warnings?: string[] } | void> | { itemCount?: number; warnings?: string[] } | void;
  },
) {
  console.log(`[perf] start ${input.phaseName}`);
  const startedAt = performance.now();
  try {
    const timedRun = Promise.resolve(input.run());
    const result = await (input.timeoutMs
      ? Promise.race([
          timedRun,
          new Promise<{ itemCount?: number; warnings?: string[] }>((_, reject) => {
            setTimeout(() => reject(new Error(`phase_timeout:${input.phaseName}`)), input.timeoutMs);
          }),
        ])
      : timedRun);
    const durationMs = roundValue(performance.now() - startedAt, 2);
    records.push({
      phaseName: input.phaseName,
      durationMs,
      itemCount: result?.itemCount ?? 0,
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      warnings: result?.warnings ?? [],
      source: input.source,
      severity: classifySeverity(durationMs),
    });
    console.log(`[perf] done ${input.phaseName} ${durationMs}ms`);
  } catch (error) {
    const durationMs = roundValue(performance.now() - startedAt, 2);
    records.push({
      phaseName: input.phaseName,
      durationMs,
      itemCount: 0,
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      warnings: [error instanceof Error ? error.message : String(error)],
      source: input.source,
      severity: classifySeverity(durationMs),
    });
    console.log(`[perf] failed ${input.phaseName} ${durationMs}ms`);
  }
}

function buildMarkdownSummary(records: PhaseRecord[]) {
  const top20 = [...records].sort((left, right) => right.durationMs - left.durationMs).slice(0, 20);
  const lines = [
    "# Performance Audit Summary",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Severity Thresholds",
    "",
    "- `<250 ms`: ok",
    "- `250-1000 ms`: beobachten",
    "- `1-5 s`: langsam",
    "- `5-30 s`: kritisch",
    "- `>30 s`: blockierend",
    "",
    "## Top 20 Hotspots",
    "",
    "| Phase | Duration (ms) | Severity | Items | Source | Save | Matchday | Warnings |",
    "| --- | ---: | --- | ---: | --- | --- | --- | --- |",
  ];

  for (const record of top20) {
    lines.push(
      `| ${record.phaseName} | ${record.durationMs} | ${record.severity} | ${record.itemCount} | ${record.source} | ${record.saveId} | ${record.matchdayId ?? "—"} | ${(record.warnings.join("; ") || "—").replaceAll("|", "\\|")} |`,
    );
  }

  lines.push("", "## Full Count", "", `- Gemessene Phasen: ${records.length}`);
  return `${lines.join("\n")}\n`;
}

async function runSeasonFlowAudit(records: PhaseRecord[]) {
  const inMemorySave = createInMemoryFreshSave();
  const persistence = createInMemoryPersistence(inMemorySave);
  const saveId = inMemorySave.saveId;
  let save = persistence.getSaveById(saveId)!;
  let seasonId = save.gameState.season.id;
  let matchdayId = save.gameState.matchdayState.matchdayId;

  topUpRostersForLineups(persistence, saveId, seasonId, matchdayId);
  save = persistence.getSaveById(saveId)!;

  for (const team of save.gameState.teams) {
    await measurePhase(records, {
      phaseName: "lineup generation",
      saveId,
      seasonId,
      matchdayId,
      source: "sqlite_in_memory_fresh",
      run: () => {
        const entries = buildBestLineupEntries(persistence, {
          saveId,
          seasonId,
          matchdayId,
          teamId: team.teamId,
        });
        return { itemCount: entries.length };
      },
    });

    const entries = buildBestLineupEntries(persistence, {
      saveId,
      seasonId,
      matchdayId,
      teamId: team.teamId,
    });
    saveLocalLegacyLineupDraft({ saveId, seasonId, matchdayId, teamId: team.teamId }, entries, undefined, persistence);
    await measurePhase(records, {
      phaseName: "lineup validation",
      saveId,
      seasonId,
      matchdayId,
      source: "sqlite_in_memory_fresh",
      run: () => {
        const preview = calculateLocalLegacyLineupPreview({ saveId, seasonId, matchdayId, teamId: team.teamId }, entries, undefined, persistence);
        return { itemCount: preview.ok ? preview.disciplineSideScores.length : 0, warnings: preview.ok ? preview.scorePreview.validationWarnings ?? [] : preview.warnings };
      },
    });
  }

  await measurePhase(records, {
    phaseName: "matchday resolve",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh",
    run: () => {
      const contexts = save.gameState.teams.map((team) => {
        const result = loadLocalLegacyLineupContext({ saveId, seasonId, matchdayId, teamId: team.teamId }, persistence);
        if (!result.ok) {
          throw new Error(`Resolve context failed for ${team.teamId}: ${result.errors.join(" | ")}`);
        }
        return result.context;
      });
      const preview = buildLegacyMatchdayResolvePreview(contexts);
      return { itemCount: preview.teamResults.length, warnings: preview.warnings };
    },
  });

  await measurePhase(records, {
    phaseName: "matchday result apply",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh",
    run: async () => {
      const service = new LegacyMatchdayResultApplyService(undefined as never, undefined as never, persistence);
      const result = await service.applyLegacyMatchdayResult({
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        confirm: APPLY_CONFIRM_TOKEN,
      });
      return { itemCount: result.ok ? result.playerPerformancesWritten : 0, warnings: result.ok ? [] : result.blockingReasons ?? [result.error] };
    },
  });

  await measurePhase(records, {
    phaseName: "standings preview",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh",
    run: async () => {
      const preview = await buildStandingsPreview({ saveId, seasonId, matchdayId, source: "sqlite" }, undefined, persistence);
      return { itemCount: preview.items.length, warnings: preview.blockedRules };
    },
  });

  await measurePhase(records, {
    phaseName: "standings apply",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh",
    run: async () => {
      const result = await executeStandingsApply({
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
      }, persistence);
      return { itemCount: result.plannedChanges.length, warnings: result.warnings };
    },
  });

  await measurePhase(records, {
    phaseName: "matchday advance",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh",
    run: async () => {
      const result = await executeMatchdayAdvance({
        saveId,
        seasonId,
        source: "sqlite",
        confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
      }, persistence);
      return { itemCount: result.summary.lockedLineups, warnings: result.warnings };
    },
  });

  save = persistence.getSaveById(saveId)!;
  seasonId = save.gameState.season.id;
  matchdayId = save.gameState.matchdayState.matchdayId;

  await measurePhase(records, {
    phaseName: "season snapshot",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh",
    run: () => {
      const snapshot = buildSeasonSnapshotDryRun(save.gameState, { saveId, seasonId });
      return { itemCount: snapshot.snapshot.playerPerformances.length, warnings: snapshot.warnings };
    },
  });

  await measurePhase(records, {
    phaseName: "season transition",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh",
    run: () => {
      return { itemCount: 0, warnings: ["season_transition_preview_blocked_for_v1_sync_perf_audit"] };
    },
  });
}

function prepareAllLineupsForMatchday(
  persistence: PersistenceService,
  saveId: string,
  seasonId: string,
  matchdayId: string,
) {
  const save = persistence.getSaveById(saveId)!;
  let totalEntries = 0;
  const draftedTeams: Array<{
    params: {
      saveId: string;
      seasonId: string;
      matchdayId: string;
      teamId: string;
    };
    entries: LegacyLineupEntryInput[];
  }> = [];
  for (const team of save.gameState.teams) {
    const entries = buildBestLineupEntries(persistence, {
      saveId,
      seasonId,
      matchdayId,
      teamId: team.teamId,
    });
    totalEntries += entries.length;
    draftedTeams.push({
      params: { saveId, seasonId, matchdayId, teamId: team.teamId },
      entries,
    });
  }
  const saveResult = saveLocalLegacyLineupDraftBatch(draftedTeams, persistence);
  if (!saveResult.ok) {
    throw new Error(`Batch lineup save failed: ${saveResult.errors.join(" | ")}`);
  }
  return totalEntries;
}

async function runQuickProbe(records: PhaseRecord[]) {
  const inMemorySave = createInMemoryFreshSave();
  const persistence = createInMemoryPersistence(inMemorySave);
  const saveId = inMemorySave.saveId;
  const save = persistence.getSaveById(saveId)!;
  const seasonId = save.gameState.season.id;
  const matchdayId = save.gameState.matchdayState.matchdayId;

  topUpRostersForLineups(persistence, saveId, seasonId, matchdayId);

  await measurePhase(records, {
    phaseName: "1 Matchday: lineup generation + save",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh_quick",
    run: () => {
      const totalEntries = prepareAllLineupsForMatchday(persistence, saveId, seasonId, matchdayId);
      return { itemCount: totalEntries };
    },
  });

  await measurePhase(records, {
    phaseName: "1 Matchday: lineup validation",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh_quick",
    run: () => {
      const currentSave = persistence.getSaveById(saveId)!;
      const warnings: string[] = [];
      let itemCount = 0;
      for (const team of currentSave.gameState.teams) {
        const preview = calculateLocalLegacyLineupPreview({ saveId, seasonId, matchdayId, teamId: team.teamId }, undefined, undefined, persistence);
        itemCount += preview.ok ? preview.disciplineSideScores.length : 0;
        warnings.push(...preview.warnings);
      }
      return { itemCount, warnings: Array.from(new Set(warnings)).slice(0, 20) };
    },
  });

  await measurePhase(records, {
    phaseName: "1 Matchday: resolve preview",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh_quick",
    run: () => {
      const currentSave = persistence.getSaveById(saveId)!;
      const contexts = currentSave.gameState.teams.map((team) => {
        const result = loadLocalLegacyLineupContext({ saveId, seasonId, matchdayId, teamId: team.teamId }, persistence);
        if (!result.ok) throw new Error(result.errors.join(" | "));
        return result.context;
      });
      const preview = buildLegacyMatchdayResolvePreview(contexts);
      return { itemCount: preview.teamResults.length, warnings: preview.warnings };
    },
  });

  await measurePhase(records, {
    phaseName: "1 Matchday: result apply",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh_quick",
    run: async () => {
      const service = new LegacyMatchdayResultApplyService(undefined as never, undefined as never, persistence);
      const result = await service.applyLegacyMatchdayResult({
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        confirm: APPLY_CONFIRM_TOKEN,
      });
      return { itemCount: result.ok ? result.playerPerformancesWritten : 0, warnings: result.ok ? [] : result.blockingReasons ?? [result.error] };
    },
  });

  await measurePhase(records, {
    phaseName: "1 Matchday: standings preview",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh_quick",
    run: async () => {
      const preview = await buildStandingsPreview({ saveId, seasonId, matchdayId, source: "sqlite" }, undefined, persistence);
      return { itemCount: preview.items.length, warnings: preview.blockedRules };
    },
  });

  await measurePhase(records, {
    phaseName: "1 Matchday: standings apply",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh_quick",
    run: async () => {
      const result = await executeStandingsApply({
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
      }, persistence);
      return { itemCount: result.plannedChanges.length, warnings: result.warnings };
    },
  });

  await measurePhase(records, {
    phaseName: "1 Matchday: advance",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_in_memory_fresh_quick",
    run: async () => {
      const result = await executeMatchdayAdvance({
        saveId,
        seasonId,
        source: "sqlite",
        confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
      }, persistence);
      return { itemCount: result.summary.lockedLineups, warnings: result.warnings };
    },
  });

  const livePersistence = createPersistenceService();
  livePersistence.bootstrapSingleplayerSave();
  const activeSave = livePersistence.getActiveSave();
  if (!activeSave) {
    throw new Error("No active save available for quick probe.");
  }
  const activeSeasonId = activeSave.gameState.season.id;
  const activeMatchdayId = activeSave.gameState.matchdayState.matchdayId;
  const team = activeSave.gameState.teams[0]!;

  await measurePhase(records, {
    phaseName: "Quick: team overview build",
    saveId: activeSave.saveId,
    seasonId: activeSeasonId,
    matchdayId: activeMatchdayId,
    source: "sqlite_active_readonly_quick",
    run: () => {
      const rows = buildTeamSeasonOverviewRows({ gameState: activeSave.gameState });
      return { itemCount: rows.length };
    },
  });

  await measurePhase(records, {
    phaseName: "Quick: transfermarkt free-agent feed",
    saveId: activeSave.saveId,
    seasonId: activeSeasonId,
    matchdayId: activeMatchdayId,
    source: "sqlite_active_readonly_quick",
    run: () => {
      const feed = listLocalTransfermarktFreeAgents({ saveId: activeSave.saveId, seasonId: activeSeasonId, teamId: team.teamId, limit: 250 });
      return { itemCount: feed.items.length, warnings: feed.warnings };
    },
  });

  await measurePhase(records, {
    phaseName: "Quick: AI market preview",
    saveId: activeSave.saveId,
    seasonId: activeSeasonId,
    matchdayId: activeMatchdayId,
    source: "sqlite_active_readonly_quick",
    timeoutMs: 20_000,
    run: async () => {
      const result = await buildAiTransfermarktPreview({ saveId: activeSave.saveId, seasonId: activeSeasonId, source: "sqlite", teamScope: "ai", limit: 20 });
      return { itemCount: result.teams.length, warnings: result.teams.flatMap((entry) => entry.warnings).slice(0, 20) };
    },
  });
}

async function runReadOnlyAudit(records: PhaseRecord[]) {
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const activeSave = persistence.getActiveSave();
  if (!activeSave) {
    throw new Error("No active save available for read-only performance audit.");
  }

  const saveId = activeSave.saveId;
  const seasonId = activeSave.gameState.season.id;
  const matchdayId = activeSave.gameState.matchdayState.matchdayId;
  const team = activeSave.gameState.teams[0]!;
  const rosterEntry = activeSave.gameState.rosters.find((entry) => entry.teamId === team.teamId) ?? null;
  const player = rosterEntry ? activeSave.gameState.players.find((entry) => entry.id === rosterEntry.playerId) ?? null : null;

  await measurePhase(records, {
    phaseName: "Foundation data load",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => ({ itemCount: activeSave.gameState.players.length + activeSave.gameState.rosters.length }),
  });

  await measurePhase(records, {
    phaseName: "team overview build",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => {
      const rows = buildTeamSeasonOverviewRows({ gameState: activeSave.gameState });
      return { itemCount: rows.length };
    },
  });

  const contentSignature =
    createPersistenceService().getSaveVersionMetadata(saveId)?.contentSignature ??
    buildGameStateContentSignature(activeSave.gameState);

  await measurePhase(records, {
    phaseName: "season derivations cold build",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    timeoutMs: 120_000,
    run: () => {
      invalidateSeasonDerivationsCache(saveId);
      const derivations = getSeasonDerivations({
        gameState: activeSave.gameState,
        saveId,
        seasonId,
        contentSignature,
      });
      return {
        itemCount: derivations.ratingsById.size,
        warnings: derivations.ledger.warnings.slice(0, 10),
      };
    },
  });

  await measurePhase(records, {
    phaseName: "season derivations cache hit",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => {
      const derivations = getSeasonDerivations({
        gameState: activeSave.gameState,
        saveId,
        seasonId,
        contentSignature,
      });
      return {
        itemCount: derivations.ratingsById.size,
        warnings: derivations.ledger.warnings.length > 0 ? ["cache_hit_with_ledger_warnings"] : [],
      };
    },
  });

  await measurePhase(records, {
    phaseName: "standings-overview build",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => {
      const ledger = getSeasonPointsLedger({
        gameState: activeSave.gameState,
        saveId,
        seasonId,
        contentSignature,
      });
      const disciplineValuesByTeamId = new Map(
        activeSave.gameState.teams.map((team) => {
          const summary = ledger.teamSummariesByTeamId.get(team.teamId) ?? null;
          return [team.teamId, summary?.totalPoints ?? 0] as const;
        }),
      );
      return {
        itemCount: disciplineValuesByTeamId.size,
        warnings: ledger.warnings.slice(0, 5),
      };
    },
  });

  if (player) {
    await measurePhase(records, {
      phaseName: "player drawer build",
      saveId,
      seasonId,
      matchdayId,
      source: "sqlite_active_readonly",
      run: () => {
        const data = buildPlayerDrawerDataFromGameState({
          gameState: activeSave.gameState,
          playerId: player.id,
          activePlayerId: rosterEntry?.id ?? null,
          source: "sqlite",
          saveId,
        });
        return { itemCount: data?.disciplineValues.length ?? 0 };
      },
    });
  }

  await measurePhase(records, {
    phaseName: "transfermarkt free-agent feed build",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => {
      const result = listLocalTransfermarktFreeAgents({ saveId, seasonId, teamId: team.teamId, limit: 250 });
      return { itemCount: result.items.length, warnings: result.warnings };
    },
  });

  await measurePhase(records, {
    phaseName: "transfermarkt table build",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => {
      const result = listLocalTransfermarktFreeAgents({ saveId, seasonId, teamId: team.teamId, limit: 250, search: "a" });
      return { itemCount: result.items.length, warnings: result.warnings };
    },
  });

  await measurePhase(records, {
    phaseName: "buy preview",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => {
      const feed = listLocalTransfermarktFreeAgents({ saveId, seasonId, teamId: team.teamId, limit: 25 });
      const candidate = feed.items[0];
      if (!candidate) return { itemCount: 0, warnings: ["no_buy_candidate_found"] };
      const preview = previewLocalTransfermarktBuy({ saveId, seasonId, teamId: team.teamId, playerId: candidate.playerId });
      return { itemCount: preview.player ? 1 : 0, warnings: preview.blockingReasons };
    },
  });

  await measurePhase(records, {
    phaseName: "negotiation preview",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => {
      const feed = listLocalTransfermarktFreeAgents({ saveId, seasonId, teamId: team.teamId, limit: 25 });
      const candidate = feed.items[0];
      const candidatePlayer = candidate ? activeSave.gameState.players.find((entry) => entry.id === candidate.playerId) ?? null : null;
      const negotiation = candidatePlayer
        ? buildContractNegotiationPreview({
            saveId,
            seasonId,
            teamId: team.teamId,
            team,
            teamIdentity: activeSave.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null,
            teamStrategyProfile: null,
            player: candidatePlayer,
            rosterEntry: null,
            rosterPlayers: activeSave.gameState.rosters
              .filter((entry) => entry.teamId === team.teamId)
              .map((entry) => activeSave.gameState.players.find((playerEntry) => playerEntry.id === entry.playerId))
              .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
            contractLength: 2,
            contractShape: "balanced",
            offeredSalary: candidate?.salary ?? candidatePlayer.salaryDemand,
            seasonLabelBase: activeSave.gameState.season.name,
            seasonIdBase: seasonId,
          })
        : null;
      return { itemCount: negotiation ? negotiation.scoreBreakdown.length : 0, warnings: negotiation?.blockingReasons ?? ["no_negotiation_candidate_found"] };
    },
  });

  await measurePhase(records, {
    phaseName: "contract renewal preview",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => {
      const preview = previewSeasonEndContracts(activeSave);
      return { itemCount: preview.rows.length, warnings: preview.blockingReasons };
    },
  });

  await measurePhase(records, {
    phaseName: "contract exit preview",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => {
      if (!rosterEntry) return { itemCount: 0, warnings: ["no_roster_entry_for_exit_preview"] };
      const preview = previewLocalTransfermarktSell({ saveId, seasonId, teamId: team.teamId, activePlayerId: rosterEntry.id });
      return { itemCount: preview.player ? 1 : 0, warnings: preview.blockingReasons };
    },
  });

  await measurePhase(records, {
    phaseName: "AI market preview",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    timeoutMs: 20_000,
    run: async () => {
      const result = await buildAiTransfermarktPreview({ saveId, seasonId, source: "sqlite", teamScope: "ai", limit: 20 });
      return { itemCount: result.teams.length, warnings: result.teams.flatMap((entry) => entry.warnings).slice(0, 20) };
    },
  });

  await measurePhase(records, {
    phaseName: "AI market apply",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_dryrun",
    timeoutMs: 20_000,
    run: async () => {
      const result = await applyAiMarketPlanLocally({
        saveId,
        seasonId,
        source: "sqlite",
        dryRun: true,
        teamScope: "ai",
      });
      return { itemCount: result.teams.length, warnings: [...result.warnings, "dry_run_only_due_save_write_safety"] };
    },
  });

  await measurePhase(records, {
    phaseName: "AI buy candidate scan",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    timeoutMs: 20_000,
    run: async () => {
      const result = await buildAiTransfermarktPreview({ saveId, seasonId, source: "sqlite", teamScope: "ai", limit: 50, buyNeedOnly: true });
      return { itemCount: result.teams.reduce((sum, entry) => sum + entry.topTargets.length, 0), warnings: [] };
    },
  });

  await measurePhase(records, {
    phaseName: "AI sell candidate scan",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    timeoutMs: 20_000,
    run: async () => {
      const result = await buildAiTransfermarktSellPreview({ saveId, seasonId, source: "sqlite", teamScope: "ai", limit: 25 });
      return { itemCount: result.teams.length, warnings: result.teams.flatMap((entry) => entry.warnings).slice(0, 20) };
    },
  });

  await measurePhase(records, {
    phaseName: "AI XP / progression forecast",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    run: () => {
      const rosterPlayers = activeSave.gameState.rosters
        .filter((entry) => entry.teamId === team.teamId)
        .map((entry) => activeSave.gameState.players.find((playerEntry) => playerEntry.id === entry.playerId))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      const forecasts = rosterPlayers.map((rosterPlayer) =>
        buildPlayerProgressionForecast({
          gameState: activeSave.gameState,
          player: rosterPlayer,
          playerRating: null,
          seasonPerformance: null,
          currentXP: rosterPlayer.currentXP ?? 0,
          spentXP: rosterPlayer.spentXP ?? 0,
          lifetimeXP: rosterPlayer.lifetimeXP ?? null,
        }),
      );
      return { itemCount: forecasts.length };
    },
  });

  await measurePhase(records, {
    phaseName: "training page build",
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite_active_readonly",
    timeoutMs: 15_000,
    run: () => {
      const rosterPlayers = activeSave.gameState.rosters
        .filter((entry) => entry.teamId === team.teamId)
        .map((entry) => activeSave.gameState.players.find((playerEntry) => playerEntry.id === entry.playerId))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      const forecastsByPlayerId = new Map(
        rosterPlayers.map((player) => [
          player.id,
          buildPlayerProgressionForecast({
            gameState: activeSave.gameState,
            player,
            playerRating: null,
            seasonPerformance: null,
            trainingModeByPlayerId: {},
            currentXP: player.currentXP ?? 0,
            spentXP: player.spentXP ?? 0,
            lifetimeXP: player.lifetimeXP ?? null,
          }),
        ] as const),
      );
      const preview = buildSeasonEndProgressionPreview({
        gameState: activeSave.gameState,
        forecastsByPlayerId,
      });
      return { itemCount: preview.rows.length, warnings: preview.warnings };
    },
  });
}

async function main() {
  assertOlyProjectRoot();
  loadEnvConfig(process.cwd());

  const records: PhaseRecord[] = [];
  const quickMode = process.argv.includes("--quick");
  if (quickMode) {
    await runQuickProbe(records);
  } else {
    await runSeasonFlowAudit(records);
    await runReadOnlyAudit(records);
  }

  const summaryPath = writeOutput("performance-audit-summary.md", buildMarkdownSummary(records));
  const jsonPath = writeOutput(
    "performance-audit.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalPhases: records.length,
        records,
        top20: [...records].sort((left, right) => right.durationMs - left.durationMs).slice(0, 20),
      },
      null,
      2,
    ),
  );
  const hotspotsPath = writeOutput(
    "performance-hotspots.csv",
    toCsv(
      [...records]
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 20)
        .map((record) => ({
          phaseName: record.phaseName,
          durationMs: record.durationMs,
          severity: record.severity,
          itemCount: record.itemCount,
          saveId: record.saveId,
          seasonId: record.seasonId,
          matchdayId: record.matchdayId,
          warnings: record.warnings.join("; "),
          source: record.source,
        })),
      ["phaseName", "durationMs", "severity", "itemCount", "saveId", "seasonId", "matchdayId", "warnings", "source"],
    ),
  );

  console.log(
    JSON.stringify(
      {
        outputs: { summaryPath, jsonPath, hotspotsPath },
        totalPhases: records.length,
        slowestPhase: [...records].sort((left, right) => right.durationMs - left.durationMs)[0] ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
