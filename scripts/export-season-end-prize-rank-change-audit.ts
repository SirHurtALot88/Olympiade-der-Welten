import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { buildPrizeMoneyPreview } from "@/lib/season/prize-money-preview";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR =
  process.env.OLY_PRIZE_AUDIT_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function readCsvRecords(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function toNumber(value: string | null | undefined) {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSeasonOneFinalExportSave(baseSave: PersistedSaveGame): PersistedSaveGame | null {
  const standingsPath = path.join(OUTPUT_DIR, "season1-standings-final.csv");
  const records = readCsvRecords(standingsPath);
  if (records.length === 0) {
    return null;
  }

  const byTeamId = new Map(records.map((record) => [record.teamId, record] as const));
  const standings = Object.fromEntries(
    records.map((record) => [
      record.teamId,
      {
        points: toNumber(record.points) ?? 0,
        rank: toNumber(record.rank) ?? undefined,
      },
    ]),
  );

  return {
    ...baseSave,
    saveId: `${baseSave.saveId}__season1_final_export_audit`,
    name: `${baseSave.name} · Season 1 Final Export Audit`,
    gameState: {
      ...baseSave.gameState,
      gamePhase: "season_completed",
      season: {
        ...baseSave.gameState.season,
        id: "season-1",
        name: "Season 1",
        year: 1,
        currentMatchday: 10,
      },
      matchdayState: {
        ...baseSave.gameState.matchdayState,
        matchdayId: "matchday-10",
        status: "resolved",
      },
      teams: baseSave.gameState.teams.map((team) => {
        const record = byTeamId.get(team.teamId) ?? null;
        return {
          ...team,
          cash: toNumber(record?.cash) ?? team.cash,
        };
      }),
      seasonState: {
        ...baseSave.gameState.seasonState,
        seasonId: "season-1",
        standings,
      },
    },
  };
}

function createStaticPersistence(save: PersistedSaveGame): PersistenceService {
  return {
    bootstrapSingleplayerSave: () => ({ save, createdFromSeed: false }),
    getActiveSave: () => save,
    getSaveById: (saveId: string) => (saveId === save.saveId || saveId === "season-1-final-export" ? save : null),
    saveSingleplayerState: () => save,
    createSave: () => save,
    createFreshSeasonOneSave: () => save,
    cloneSave: () => save,
    activateSave: () => save,
    listSaves: () => [],
  };
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const activeSave = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const finalExportSave =
    activeSave.gameState.season.id === "season-1" && activeSave.gameState.gamePhase === "season_completed"
      ? null
      : buildSeasonOneFinalExportSave(activeSave);
  const save = finalExportSave ?? activeSave;
  const previewPersistence = finalExportSave ? createStaticPersistence(finalExportSave) : persistence;
  const preview = await buildPrizeMoneyPreview(
    {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      source: "sqlite",
      phase: "season_end",
    },
    previewPersistence,
  );

  const rows = preview.items.map((item) => ({
    team: item.teamName,
    teamId: item.teamId,
    startRank: item.rankChangePrize.startRank,
    StartRankSource: item.rankChangePrize.startRankSource,
    finalRank: item.rankChangePrize.finalRank,
    rankDelta: item.rankChangePrize.rankDelta,
    RetoolBonusMalus: item.rankChangePrize.source !== "missing" ? item.rankChangePrize.bonusMalus : null,
    AppBonusMalus: item.rankChangePrize.bonusMalus,
    CashBefore: item.currentCash,
    BasePrize: item.basisCash,
    SeasonPrize: item.seasonCash,
    RankChangePrize: item.rankChangePrize.bonusMalus,
    CashAfter: item.projectedCash,
    Source: item.rankChangePrize.source,
    Warnings: item.warnings.join("|"),
  }));

  const headers = [
    "team",
    "teamId",
    "startRank",
    "StartRankSource",
    "finalRank",
    "rankDelta",
    "RetoolBonusMalus",
    "AppBonusMalus",
    "CashBefore",
    "BasePrize",
    "SeasonPrize",
    "RankChangePrize",
    "CashAfter",
    "Source",
    "Warnings",
  ];

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const csvPath = path.join(OUTPUT_DIR, "season-end-prize-rank-change-audit.csv");
  const jsonPath = path.join(OUTPUT_DIR, "season-end-prize-rank-change-audit.json");
  fs.writeFileSync(csvPath, `${toCsv(rows, headers)}\n`, "utf8");
  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        saveId: save.saveId,
        seasonId: save.gameState.season.id,
        auditInput:
          finalExportSave
            ? {
                source: "season1-standings-final.csv",
                activeSaveId: activeSave.saveId,
                note: "Active save is no longer the completed S1 state; final ranks/cash were read from the preserved Season-1 simulation export. For Season 1, missing start ranks are derived from start budget order.",
              }
            : {
                source: "active_completed_save",
                activeSaveId: activeSave.saveId,
              },
        source: preview.source,
        formula:
          "cashAfterSeason = cashBefore + basePrize + seasonPrize + rankChangePrize; rankDelta = startRank - finalRank; Season-1 startRank falls back to start budget order; rankChangePrize uses the extracted Sheet placement table.",
        hardRules: {
          productiveCashWrites: false,
          prismaWrites: false,
          matchdayCashPrizeWrites: false,
          scenarioColumnsUnchanged: true,
        },
        summary: preview.summary,
        auditSummary: {
          missingRank: rows.filter((row) => String(row.Warnings).includes("missing_rank")).length,
          missingStartRank: rows.filter((row) => String(row.Warnings).includes("start_rank_source_missing")).length,
          rankChangeCalculated: rows.filter((row) => row.rankDelta != null && row.RankChangePrize != null).length,
        },
        rows,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(JSON.stringify({ ok: true, csvPath, jsonPath, rows: rows.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
