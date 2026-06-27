import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildPlayerEconomyCompareReport } from "@/lib/foundation/player-economy-compare-service";
import { buildPreviewDisciplineRatingsFromAttributes } from "@/lib/training/season-end-progression-preview";
import { normalizePlayerAttributes } from "@/lib/training/organic-season-progression";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateMarketValueFromRankTable } from "@/lib/player-formulas/market-value-engine";
import type { GameState, Player } from "@/lib/data/olyDataTypes";

const formulaSources = loadPlayerFormulaSources();

function rankTableMw(gameState: GameState, overrides?: Map<string, Player>) {
  const players = gameState.players
    .map((player) => overrides?.get(player.id) ?? player)
    .filter((player) => Object.values(player.disciplineRatings ?? {}).some((value) => typeof value === "number"))
    .map((player) => ({ playerId: player.id, scores: player.disciplineRatings ?? {} }));
  const result = calculateMarketValueFromRankTable({
    players,
    rankToDisciplineMarketValue: formulaSources.rankToDisciplineMarketValue,
  });
  return new Map(result.players.map((entry) => [entry.playerId, entry] as const));
}

const saveId = process.argv[2] ?? "fresh-season-1-1782540352064";
const save = createPersistenceService().getSaveById(saveId);
if (!save) {
  console.error("save not found:", saveId);
  process.exit(1);
}

const gs = save.gameState;
const player = gs.players.find((entry) => entry.id === gs.rosters[Math.floor(gs.rosters.length / 2)]?.playerId);
if (!player) {
  console.error("no player");
  process.exit(1);
}

const attrs = normalizePlayerAttributes(player)!;
const boosted = {
  ...attrs,
  power: Math.min(99, attrs.power + 8),
  health: Math.min(99, attrs.health + 6),
  speed: Math.min(99, attrs.speed + 6),
};
const previewDiscipline = buildPreviewDisciplineRatingsFromAttributes({ player, attributesAfter: boosted });
const previewPlayer: Player = {
  ...player,
  attributeSheetStats: { ...player.attributeSheetStats, ...boosted },
  disciplineRatings: previewDiscipline,
};

const rankBefore = rankTableMw(gs).get(player.id)!;
const rankAfter = rankTableMw(gs, new Map([[player.id, previewPlayer]])).get(player.id)!;
const compareBefore = buildPlayerEconomyCompareReport({ gameState: gs, playerIds: [player.id] }).players[0]?.calculatedMarketValue;
const compareAfter = buildPlayerEconomyCompareReport({
  gameState: gs,
  playerIds: [player.id],
  playerOverridesById: new Map([[player.id, previewPlayer]]),
}).players[0]?.calculatedMarketValue;

const rankShifts = Object.keys(rankAfter.disciplineRanks)
  .map((disciplineId) => ({
    disciplineId,
    before: rankBefore.disciplineRanks[disciplineId],
    after: rankAfter.disciplineRanks[disciplineId],
    delta: (rankBefore.disciplineRanks[disciplineId] ?? 0) - (rankAfter.disciplineRanks[disciplineId] ?? 0),
  }))
  .filter((entry) => entry.delta !== 0)
  .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
  .slice(0, 10);

console.log(
  JSON.stringify(
    {
      player: player.name,
      storedMw: player.displayMarketValue ?? player.marketValue,
      rankTableMwBefore: rankBefore.marketValueNew,
      rankTableMwAfter: rankAfter.marketValueNew,
      rankTableMwDelta: Math.round((rankAfter.marketValueNew - rankBefore.marketValueNew) * 100) / 100,
      compareServiceBefore: compareBefore,
      compareServiceAfter: compareAfter,
      compareServiceDelta: compareBefore != null && compareAfter != null ? Math.round((compareAfter - compareBefore) * 100) / 100 : null,
      legacyBlocksRankTable: compareBefore === compareAfter && rankBefore.marketValueNew !== rankAfter.marketValueNew,
      topRankShifts: rankShifts,
    },
    null,
    2,
  ),
);
