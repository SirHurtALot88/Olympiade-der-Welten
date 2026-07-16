import fs from "node:fs";
import path from "node:path";

import type { GameState, Player, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";

type SeedPlayerEconomy = {
  id: string;
  name: string;
  displayMarketValue?: number | null;
  displaySalary?: number | null;
  marketValue?: number | null;
  salaryDemand?: number | null;
};

type RepairRow = {
  scope: string;
  id: string;
  playerId?: string | null;
  playerName?: string | null;
  field: string;
  before: number | null;
  after: number | null;
  reason: string;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRawEconomy(value: number | null | undefined, divisor: number) {
  const numeric = finite(value);
  if (numeric == null) return null;
  if (numeric > 1000) return roundValue(numeric / divisor, 2);
  return roundValue(numeric, 2);
}

function inRange(value: number | null | undefined, min: number, max: number) {
  const numeric = finite(value);
  return numeric != null && numeric >= min && numeric <= max ? roundValue(numeric, 2) : null;
}

function writeCsv(file: string, rows: RepairRow[]) {
  const headers = ["scope", "id", "playerId", "playerName", "field", "before", "after", "reason"];
  const escape = (value: unknown) => {
    if (value == null) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  fs.writeFileSync(file, `${headers.join(",")}\n${rows.map((row) => headers.map((key) => escape(row[key as keyof RepairRow])).join(",")).join("\n")}\n`, "utf8");
}

function loadSeedEconomyByPlayerId() {
  const file = path.join(process.cwd(), "data", "generated", "oly-player-stats.json");
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as SeedPlayerEconomy[];
  return new Map(rows.map((row) => [row.id, row] as const));
}

function latestSaneProgressionEconomy(gameState: GameState, playerId: string) {
  const events = (gameState.playerProgressionEvents ?? [])
    .filter((event) => event.playerId === playerId)
    .sort((left, right) => Date.parse(right.timestamp ?? "") - Date.parse(left.timestamp ?? ""));
  for (const event of events) {
    const marketValue =
      inRange(event.progressionSnapshotAfter?.marketValuePreview, 1, 180) ??
      inRange(event.progressionSnapshotAfter?.marketValue, 1, 180);
    const salary =
      inRange(event.progressionSnapshotAfter?.salaryPreview, 0.1, 40) ??
      inRange(event.progressionSnapshotAfter?.salary, 0.1, 40);
    if (marketValue != null || salary != null) {
      return { marketValue, salary };
    }
  }
  return { marketValue: null, salary: null };
}

function buildTargetEconomy(gameState: GameState, player: Player, seed: SeedPlayerEconomy | null) {
  const progression = latestSaneProgressionEconomy(gameState, player.id);
  const seedMarketValue =
    inRange(seed?.displayMarketValue, 1, 180) ??
    normalizeRawEconomy(seed?.marketValue, 1000) ??
    inRange(player.displayMarketValue, 1, 180) ??
    normalizeRawEconomy(player.marketValue, 1000);
  const seedSalary =
    inRange(seed?.displaySalary, 0.1, 40) ??
    normalizeRawEconomy(seed?.salaryDemand, 1000) ??
    inRange(player.displaySalary, 0.1, 40) ??
    normalizeRawEconomy(player.salaryDemand, 1000);
  return {
    marketValue: progression.marketValue ?? seedMarketValue,
    salary: progression.salary ?? seedSalary,
  };
}

function shouldRepairMoney(value: number | null | undefined, target: number | null, absoluteLimit: number, ratioLimit = 3) {
  const numeric = finite(value);
  if (numeric == null || target == null) return false;
  return numeric > absoluteLimit || numeric > target * ratioLimit;
}

function setMoney<T extends Record<string, unknown>>(input: {
  row: T;
  field: keyof T & string;
  target: number | null;
  scope: string;
  id: string;
  playerId?: string | null;
  playerName?: string | null;
  reason: string;
  repairs: RepairRow[];
  force?: boolean;
  absoluteLimit?: number;
  ratioLimit?: number;
}) {
  if (input.target == null) return;
  const before = finite(input.row[input.field]);
  if (before == null) return;
  const shouldRepair =
    input.force ||
    shouldRepairMoney(before, input.target, input.absoluteLimit ?? 200, input.ratioLimit ?? 3) ||
    Math.abs(before - input.target) > 0.005 && before > 1000;
  if (!shouldRepair) return;
  const after = roundValue(input.target, 2);
  input.row[input.field] = after as T[keyof T & string];
  input.repairs.push({
    scope: input.scope,
    id: input.id,
    playerId: input.playerId,
    playerName: input.playerName,
    field: input.field,
    before,
    after,
    reason: input.reason,
  });
}

function getTransferReplacementFee(entry: TransferHistoryEntry, targetMarketValue: number | null) {
  if (targetMarketValue == null) return null;
  if (entry.transferType === "buy") {
    return targetMarketValue;
  }
  const oldFee = finite(entry.fee);
  const oldMarketValue = finite(entry.marketValue);
  const factor = oldFee != null && oldMarketValue != null && oldMarketValue > 0
    ? Math.min(1.65, Math.max(0.35, oldFee / oldMarketValue))
    : 1;
  return roundValue(targetMarketValue * factor, 2);
}

function adjustTeamCash(gameState: GameState, entry: TransferHistoryEntry, oldFee: number, newFee: number) {
  const delta = roundValue(oldFee - newFee, 2);
  if (Math.abs(delta) < 0.005) return;
  const teamId = entry.transferType === "buy" ? entry.toTeamId : entry.fromTeamId;
  if (!teamId) return;
  gameState.teams = gameState.teams.map((team) => {
    if (team.teamId !== teamId) return team;
    const currentCash = finite(team.cash) ?? 0;
    return {
      ...team,
      cash: roundValue(entry.transferType === "buy" ? currentCash + delta : currentCash - delta, 2),
    };
  });
}

async function main() {
  assertOlyProjectRoot();
  const write = process.argv.includes("--write");
  const persistence = createPersistenceService();
  const save = persistence.getActiveSave();
  if (!save) throw new Error("No active save found.");
  const seedByPlayerId = loadSeedEconomyByPlayerId();
  const gameState = structuredClone(save.gameState) as GameState;
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const targetByPlayerId = new Map(
    gameState.players.map((player) => [player.id, buildTargetEconomy(gameState, player, seedByPlayerId.get(player.id) ?? null)] as const),
  );
  const repairs: RepairRow[] = [];
  const teamCashBefore = new Map(gameState.teams.map((team) => [team.teamId, finite(team.cash) ?? 0] as const));

  gameState.players = gameState.players.map((player) => {
    const target = targetByPlayerId.get(player.id);
    if (!target) return player;
    const next = { ...player } as Player;
    setMoney({ row: next as unknown as Record<string, unknown>, field: "marketValue", target: target.marketValue, scope: "player", id: player.id, playerId: player.id, playerName: player.name, reason: "player_market_value_restored_to_visible_scale", repairs, force: finite(player.marketValue) != null && finite(player.marketValue)! > 1000 });
    setMoney({ row: next as unknown as Record<string, unknown>, field: "displayMarketValue", target: target.marketValue, scope: "player", id: player.id, playerId: player.id, playerName: player.name, reason: "player_display_market_value_restored_to_visible_scale", repairs, absoluteLimit: 200 });
    setMoney({ row: next as unknown as Record<string, unknown>, field: "salaryDemand", target: target.salary, scope: "player", id: player.id, playerId: player.id, playerName: player.name, reason: "player_salary_restored_to_visible_scale", repairs, force: finite(player.salaryDemand) != null && finite(player.salaryDemand)! > 1000, absoluteLimit: 80 });
    setMoney({ row: next as unknown as Record<string, unknown>, field: "displaySalary", target: target.salary, scope: "player", id: player.id, playerId: player.id, playerName: player.name, reason: "player_display_salary_restored_to_visible_scale", repairs, absoluteLimit: 80 });
    return next;
  });

  gameState.rosters = gameState.rosters.map((entry) => {
    const target = targetByPlayerId.get(entry.playerId);
    const player = playersById.get(entry.playerId);
    if (!target) return entry;
    const next = { ...entry };
    setMoney({ row: next as unknown as Record<string, unknown>, field: "currentValue", target: target.marketValue, scope: "roster", id: entry.id, playerId: entry.playerId, playerName: player?.name, reason: "roster_current_value_restored_to_visible_scale", repairs, absoluteLimit: 200 });
    setMoney({ row: next as unknown as Record<string, unknown>, field: "purchasePrice", target: target.marketValue, scope: "roster", id: entry.id, playerId: entry.playerId, playerName: player?.name, reason: "roster_purchase_price_restored_to_visible_scale", repairs, absoluteLimit: 250, ratioLimit: 5 });
    setMoney({ row: next as unknown as Record<string, unknown>, field: "salary", target: target.salary, scope: "roster", id: entry.id, playerId: entry.playerId, playerName: player?.name, reason: "roster_salary_restored_to_visible_scale", repairs, absoluteLimit: 80 });
    setMoney({ row: next as unknown as Record<string, unknown>, field: "upkeep", target: target.salary, scope: "roster", id: entry.id, playerId: entry.playerId, playerName: player?.name, reason: "roster_upkeep_restored_to_visible_scale", repairs, absoluteLimit: 80 });
    return next;
  });

  gameState.transferHistory = gameState.transferHistory.map((entry) => {
    const target = targetByPlayerId.get(entry.playerId);
    const player = playersById.get(entry.playerId);
    if (!target) return entry;
    const next = { ...entry };
    const oldFee = finite(next.fee);
    const replacementFee = getTransferReplacementFee(next, target.marketValue);
    if (oldFee != null && replacementFee != null && shouldRepairMoney(oldFee, replacementFee, 250, next.transferType === "buy" ? 3 : 2.5)) {
      next.fee = replacementFee;
      adjustTeamCash(gameState, entry, oldFee, replacementFee);
      repairs.push({
        scope: "transferHistory",
        id: entry.id,
        playerId: entry.playerId,
        playerName: entry.playerName ?? player?.name,
        field: "fee",
        before: oldFee,
        after: replacementFee,
        reason: `${entry.transferType}_fee_restored_to_visible_scale`,
      });
    }
    setMoney({ row: next as unknown as Record<string, unknown>, field: "marketValue", target: target.marketValue, scope: "transferHistory", id: entry.id, playerId: entry.playerId, playerName: entry.playerName ?? player?.name, reason: "transfer_market_value_restored_to_visible_scale", repairs, absoluteLimit: 200 });
    setMoney({ row: next as unknown as Record<string, unknown>, field: "salary", target: target.salary, scope: "transferHistory", id: entry.id, playerId: entry.playerId, playerName: entry.playerName ?? player?.name, reason: "transfer_salary_restored_to_visible_scale", repairs, absoluteLimit: 80 });
    return next;
  });

  const outDir = path.join(process.cwd(), "outputs", "economy-scale-repair");
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, "economy-scale-repair-active-save.csv");
  const mdPath = path.join(outDir, "economy-scale-repair-active-save.md");
  writeCsv(csvPath, repairs);
  const teamCashAfter = new Map(gameState.teams.map((team) => [team.teamId, finite(team.cash) ?? 0] as const));
  const highTransfersBefore = save.gameState.transferHistory.filter((entry) => (entry.fee ?? 0) > 250 || (entry.marketValue ?? 0) > 200 || (entry.salary ?? 0) > 80).length;
  const highTransfersAfter = gameState.transferHistory.filter((entry) => (entry.fee ?? 0) > 250 || (entry.marketValue ?? 0) > 200 || (entry.salary ?? 0) > 80).length;
  const maxFeeBefore = Math.max(0, ...save.gameState.transferHistory.map((entry) => entry.fee ?? 0));
  const maxFeeAfter = Math.max(0, ...gameState.transferHistory.map((entry) => entry.fee ?? 0));
  const maxPlayerMvBefore = Math.max(0, ...save.gameState.players.map((player) => finite(player.displayMarketValue) ?? finite(player.marketValue) ?? 0));
  const maxPlayerMvAfter = Math.max(0, ...gameState.players.map((player) => finite(player.displayMarketValue) ?? finite(player.marketValue) ?? 0));
  const maxCashBefore = Math.max(0, ...save.gameState.teams.map((team) => finite(team.cash) ?? 0));
  const maxCashAfter = Math.max(0, ...gameState.teams.map((team) => finite(team.cash) ?? 0));
  const cashAdjustments = gameState.teams
    .map((team) => ({
      teamId: team.teamId,
      before: teamCashBefore.get(team.teamId) ?? 0,
      after: teamCashAfter.get(team.teamId) ?? 0,
    }))
    .filter((row) => Math.abs(row.before - row.after) > 0.005)
    .sort((left, right) => Math.abs(right.before - right.after) - Math.abs(left.before - left.after));
  fs.writeFileSync(
    mdPath,
    [
      "# Economy Scale Repair Active Save",
      "",
      `- Save: ${save.name} (${save.saveId})`,
      `- Write mode: ${write ? "YES" : "NO"}`,
      `- Repairs: ${repairs.length}`,
      `- High transfer rows before/after: ${highTransfersBefore} / ${highTransfersAfter}`,
      `- Max transfer fee before/after: ${roundValue(maxFeeBefore)} / ${roundValue(maxFeeAfter)}`,
      `- Max player visible MW before/after: ${roundValue(maxPlayerMvBefore)} / ${roundValue(maxPlayerMvAfter)}`,
      `- Max team cash before/after: ${roundValue(maxCashBefore)} / ${roundValue(maxCashAfter)}`,
      "",
      "## Team Cash Adjustments",
      "",
      "| Team | Before | After | Delta |",
      "| --- | ---: | ---: | ---: |",
      ...cashAdjustments.slice(0, 40).map((row) => `| ${row.teamId} | ${roundValue(row.before)} | ${roundValue(row.after)} | ${roundValue(row.after - row.before)} |`),
      "",
    ].join("\n"),
    "utf8",
  );

  if (write) {
    persistence.saveSingleplayerState(save.saveId, gameState);
  }

  console.log(JSON.stringify({
    saveId: save.saveId,
    write,
    repairs: repairs.length,
    highTransfersBefore,
    highTransfersAfter,
    maxFeeBefore: roundValue(maxFeeBefore),
    maxFeeAfter: roundValue(maxFeeAfter),
    maxPlayerMvBefore: roundValue(maxPlayerMvBefore),
    maxPlayerMvAfter: roundValue(maxPlayerMvAfter),
    maxCashBefore: roundValue(maxCashBefore),
    maxCashAfter: roundValue(maxCashAfter),
    csvPath,
    mdPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
