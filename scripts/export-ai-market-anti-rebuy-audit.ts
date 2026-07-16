import fs from "node:fs";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { listLocalTransfermarktFreeAgents, previewLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";
import { buildRecentlySoldByTeam, RECENTLY_SOLD_SAME_PRESEASON_BLOCKER } from "@/lib/market/anti-rebuy-guard";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}

function writeFile(name: string, content: string) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  return filePath;
}

function main() {
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const save = persistence.getActiveSave();
  if (!save) {
    throw new Error("No active local save found for anti-rebuy audit.");
  }

  const gameState = save.gameState;
  const seasonId = gameState.season.id;
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const recentlySoldByTeam = buildRecentlySoldByTeam(gameState, seasonId);

  const recentlySoldRows = [...recentlySoldByTeam.entries()].flatMap(([teamId, playerMap]) =>
    [...playerMap.values()].map((entry) => ({
      saveId: save.saveId,
      seasonId,
      teamId,
      teamName: teamById.get(teamId)?.name ?? teamId,
      playerId: entry.playerId,
      playerName: playerById.get(entry.playerId)?.name ?? entry.playerId,
      saleTransferId: entry.transferId,
      saleSource: entry.source ?? "",
      soldAt: entry.happenedAt,
      guard: RECENTLY_SOLD_SAME_PRESEASON_BLOCKER,
    })),
  );

  const antiRebuyRows = recentlySoldRows.map((row) => {
    const sameTeamPreview = previewLocalTransfermarktBuy({
      saveId: save.saveId,
      seasonId,
      teamId: row.teamId,
      playerId: row.playerId,
      transferSource: "anti_rebuy_audit_probe",
    });
    const feed = listLocalTransfermarktFreeAgents({
      saveId: save.saveId,
      seasonId,
      teamId: row.teamId,
      limit: 10,
    });
    const illegalRebuyEvents = gameState.transferHistory.filter(
      (entry) =>
        entry.seasonId === seasonId &&
        entry.transferType === "buy" &&
        entry.toTeamId === row.teamId &&
        entry.playerId === row.playerId,
    );

    return {
      ...row,
      sameTeamBuyBlocked: sameTeamPreview.blockingReasons.includes(RECENTLY_SOLD_SAME_PRESEASON_BLOCKER),
      sameTeamBuyCanBuy: sameTeamPreview.canBuy,
      sameTeamBlockingReasons: sameTeamPreview.blockingReasons.join("|"),
      topupAlternativePlayerId: feed.items[0]?.playerId ?? "",
      topupAlternativePlayerName: feed.items[0]?.name ?? "",
      illegalSamePreseasonRebuyCount: illegalRebuyEvents.length,
      warnings: illegalRebuyEvents.length > 0 ? "same_preseason_rebuy_already_exists_in_history" : "",
    };
  });

  const recentlySoldCsv = writeFile(
    "preseason-recently-sold-players.csv",
    toCsv(recentlySoldRows, [
      "saveId",
      "seasonId",
      "teamId",
      "teamName",
      "playerId",
      "playerName",
      "saleTransferId",
      "saleSource",
      "soldAt",
      "guard",
    ]),
  );

  const antiRebuyCsv = writeFile(
    "ai-market-anti-rebuy-audit.csv",
    toCsv(antiRebuyRows, [
      "saveId",
      "seasonId",
      "teamId",
      "teamName",
      "playerId",
      "playerName",
      "saleTransferId",
      "saleSource",
      "soldAt",
      "guard",
      "sameTeamBuyBlocked",
      "sameTeamBuyCanBuy",
      "sameTeamBlockingReasons",
      "topupAlternativePlayerId",
      "topupAlternativePlayerName",
      "illegalSamePreseasonRebuyCount",
      "warnings",
    ]),
  );

  console.log(`saveId=${save.saveId}`);
  console.log(`seasonId=${seasonId}`);
  console.log(`recentlySold=${recentlySoldRows.length}`);
  console.log(`illegalSamePreseasonRebuys=${antiRebuyRows.reduce((sum, row) => sum + Number(row.illegalSamePreseasonRebuyCount ?? 0), 0)}`);
  console.log(`recentlySoldCsv=${recentlySoldCsv}`);
  console.log(`antiRebuyCsv=${antiRebuyCsv}`);
}

main();
