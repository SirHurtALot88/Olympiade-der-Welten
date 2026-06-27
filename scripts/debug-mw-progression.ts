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
const events = (gs.playerProgressionEvents ?? []).filter((e) => e.seasonId === "season-1" && (e.upgrades?.length ?? 0) > 0);

let rankTableWouldMove = 0;
let legacyBlocksMove = 0;
let totalAttrDelta = 0;
let samples: Array<Record<string, unknown>> = [];

for (const ev of events.slice(0, 200)) {
  const player = gs.players.find((p) => p.id === ev.playerId);
  if (!player) continue;

  const attrDelta = (ev.upgrades ?? []).reduce((sum, u) => sum + Math.abs(u.toValue - u.fromValue), 0);
  totalAttrDelta += attrDelta;

  const beforeReport = buildPlayerEconomyCompareReport({ gameState: gs, playerIds: [player.id] });
  const beforeRow = beforeReport.players[0];
  const storedMw = player.displayMarketValue ?? player.marketValue;

  const attrsAfter = normalizePlayerAttributes(player);
  if (!attrsAfter) continue;
  for (const u of ev.upgrades ?? []) {
    attrsAfter[u.attribute] = u.toValue;
  }
  const previewDiscipline = buildPreviewDisciplineRatingsFromAttributes({ player, attributesAfter: attrsAfter });
  const previewPlayer = {
    ...player,
    attributeSheetStats: { ...player.attributeSheetStats, ...attrsAfter },
    disciplineRatings: previewDiscipline,
  };

  const afterReport = buildPlayerEconomyCompareReport({
    gameState: gs,
    playerIds: [player.id],
    playerOverridesById: new Map([[player.id, previewPlayer]]),
  });
  const afterRow = afterReport.players[0];

  const compareBefore = beforeRow?.calculatedMarketValue ?? null;
  const compareAfter = afterRow?.calculatedMarketValue ?? null;
  const rankBefore = rankTableMw(gs).get(player.id)?.marketValueNew ?? null;
  const rankAfter = rankTableMw(gs, new Map([[player.id, previewPlayer]])).get(player.id)?.marketValueNew ?? null;

  if (rankBefore != null && rankAfter != null && Math.abs(rankAfter - rankBefore) >= 0.01) {
    rankTableWouldMove += 1;
  }
  if (compareBefore != null && compareAfter != null && Math.abs(compareAfter - compareBefore) < 0.01 && rankBefore != null && rankAfter != null && Math.abs(rankAfter - rankBefore) >= 0.01) {
    legacyBlocksMove += 1;
    if (samples.length < 5) {
      samples.push({
        playerId: player.id,
        attrDelta,
        storedMw,
        compareBefore,
        compareAfter,
        rankBefore,
        rankAfter,
        rankDelta: Math.round((rankAfter - rankBefore) * 100) / 100,
      });
    }
  }
}

console.log(JSON.stringify({
  saveId,
  progressionEvents: events.length,
  avgAttrDeltaPerEvent: events.length ? Math.round((totalAttrDelta / events.length) * 10) / 10 : 0,
  rankTableWouldMove,
  legacyBlocksMove,
  samples,
}, null, 2));
