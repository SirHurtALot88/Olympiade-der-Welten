import type { GameState, Player, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { buildPlayerRatingContractMap, type PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { AiSellPreviewCandidate } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import type { AiTransferPreviewRecommendation } from "@/lib/ai/ai-transfermarkt-preview-service";

type ExtendedSellCandidate = AiSellPreviewCandidate & {
  productiveElite?: boolean;
  keepIntentScore?: number | null;
};

export type ReplacementSlotUrgency = "normal" | "high";

export type ReplacementSlot = {
  slotId: string;
  teamId: string;
  soldPlayerId: string;
  soldPlayerName: string;
  soldOvr: number | null;
  soldOvrRank: number | null;
  soldPpsRank: number | null;
  soldAxis: "pow" | "spe" | "men" | "soc" | null;
  saleProceeds: number | null;
  freedSalary: number | null;
  maxBuyPrice: number | null;
  minOvrBand: number | null;
  urgency: ReplacementSlotUrgency;
  slotLabel: string;
  fulfilled: boolean;
};

const MARKET_SELL_SOURCES = new Set([
  "ai_preseason_market_sell",
  "manual_transfer_window",
  "manual_transfermarkt_sell",
  "emergency_negative_cash_liquidation",
  "preseason_proactive_cash_recovery_sell",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function getPlayerAxis(player: Player | null): ReplacementSlot["soldAxis"] {
  if (!player) return null;
  const entries = Object.entries(player.coreStats) as Array<["pow" | "spe" | "men" | "soc", number]>;
  const top = [...entries].sort((left, right) => right[1] - left[1])[0];
  return top?.[0] ?? null;
}

function getAxisPpRank(rating: PlayerRatingContractRow | null, axis: ReplacementSlot["soldAxis"]) {
  if (!rating || !axis) return null;
  switch (axis) {
    case "pow":
      return rating.ppPowRank;
    case "spe":
      return rating.ppSpeRank;
    case "men":
      return rating.ppMenRank;
    case "soc":
      return rating.ppSocRank;
    default:
      return null;
  }
}

function isStarLikeSell(input: {
  rating: PlayerRatingContractRow | null;
  marketValue: number | null;
  fee: number | null;
  candidate?: ExtendedSellCandidate | null;
}) {
  const candidate = input.candidate;
  if (candidate?.productiveElite || (candidate?.keepIntentScore ?? 0) >= 55) {
    return true;
  }
  if (input.rating?.ovrRank != null && input.rating.ovrRank <= 20) return true;
  if (input.rating?.ppsSeasonRank != null && input.rating.ppsSeasonRank <= 20) return true;
  if ((input.marketValue ?? 0) >= 28 || (input.fee ?? 0) >= 30) return true;
  return input.candidate?.reasonToKeep.some((reason) => reason.includes("Star") || reason.includes("Topstar")) ?? false;
}

function buildSlotFromSell(input: {
  teamId: string;
  playerId: string;
  playerName: string;
  fee: number | null;
  marketValue: number | null;
  salary: number | null;
  player: Player | null;
  rating: PlayerRatingContractRow | null;
  candidate?: ExtendedSellCandidate | null;
  index: number;
}): ReplacementSlot | null {
  if (!isStarLikeSell({ rating: input.rating, marketValue: input.marketValue, fee: input.fee, candidate: input.candidate })) {
    return null;
  }

  const axis = getPlayerAxis(input.player);
  const soldOvr = input.rating?.ovrNormalized ?? input.player?.rating ?? null;
  const proceeds = input.fee ?? input.candidate?.expectedSellValue ?? input.marketValue ?? null;
  const maxBuyPrice =
    proceeds != null ? round(Math.max(8, proceeds * 0.9 + (input.salary ?? input.candidate?.salary ?? 0) * 0.5)) : null;
  const minOvrBand = soldOvr != null ? round(clamp(soldOvr * 0.7, 20, soldOvr)) : null;
  const axisLabel = axis?.toUpperCase() ?? "PROFIL";

  return {
    slotId: `${input.teamId}:${input.playerId}:${input.index}`,
    teamId: input.teamId,
    soldPlayerId: input.playerId,
    soldPlayerName: input.playerName,
    soldOvr,
    soldOvrRank: input.rating?.ovrRank ?? null,
    soldPpsRank: input.rating?.ppsSeasonRank ?? null,
    soldAxis: axis,
    saleProceeds: proceeds,
    freedSalary: input.salary ?? input.candidate?.salary ?? null,
    maxBuyPrice,
    minOvrBand,
    urgency:
      (input.rating?.ovrRank != null && input.rating.ovrRank <= 10) ||
      (input.candidate?.productiveElite ?? false)
        ? "high"
        : "normal",
    slotLabel: `Nachfolger fuer ${input.playerName} — aehnliche ${axisLabel}-Staerke, guenstiger`,
    fulfilled: false,
  };
}

export function buildReplacementSlotsFromHistory(
  gameState: GameState,
  teamId: string,
  maxSlots = 3,
  saveId?: string | null,
): ReplacementSlot[] {
  const seasonId = gameState.season.id;
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const ratingsById = saveId
    ? getSeasonDerivations({ gameState, saveId }).ratingsById
    : buildPlayerRatingContractMap(gameState);
  const slots: ReplacementSlot[] = [];

  for (const entry of gameState.transferHistory) {
    if (slots.length >= maxSlots) break;
    if (entry.seasonId !== seasonId || entry.transferType !== "sell" || entry.fromTeamId !== teamId) continue;
    if (entry.source && !MARKET_SELL_SOURCES.has(entry.source)) continue;

    const player = playersById.get(entry.playerId) ?? null;
    const slot = buildSlotFromSell({
      teamId,
      playerId: entry.playerId,
      playerName: entry.playerName ?? player?.name ?? entry.playerId,
      fee: entry.fee,
      marketValue: entry.marketValue,
      salary: entry.salary,
      player,
      rating: ratingsById.get(entry.playerId) ?? null,
      index: slots.length,
    });
    if (slot) slots.push(slot);
  }

  return slots;
}

export function buildReplacementSlotsFromPlannedSells(input: {
  teamId: string;
  gameState: GameState;
  saveId?: string | null;
  plannedSells: AiSellPreviewCandidate[];
  existingSlots?: ReplacementSlot[];
  maxSlots?: number;
}): ReplacementSlot[] {
  const maxSlots = input.maxSlots ?? 3;
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const ratingsById = input.saveId
    ? getSeasonDerivations({ gameState: input.gameState, saveId: input.saveId }).ratingsById
    : buildPlayerRatingContractMap(input.gameState);
  const slots = [...(input.existingSlots ?? [])];
  const usedPlayerIds = new Set(slots.map((slot) => slot.soldPlayerId));

  for (const candidate of input.plannedSells) {
    if (slots.length >= maxSlots) break;
    if (usedPlayerIds.has(candidate.playerId)) continue;
    const player = playersById.get(candidate.playerId) ?? null;
    const slot = buildSlotFromSell({
      teamId: input.teamId,
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      fee: candidate.expectedSellValue,
      marketValue: candidate.marketValue,
      salary: candidate.salary,
      player,
      rating: ratingsById.get(candidate.playerId) ?? null,
      candidate,
      index: slots.length,
    });
    if (slot) {
      slots.push(slot);
      usedPlayerIds.add(candidate.playerId);
    }
  }

  return slots.slice(0, maxSlots);
}

export function scoreReplacementFit(input: {
  candidate: AiTransferPreviewRecommendation;
  player: Player | null;
  rating: PlayerRatingContractRow | null;
  slot: ReplacementSlot;
}): { score: number; reason: string | null } {
  const price = input.candidate.price ?? input.candidate.marketValue ?? null;
  if (price == null) return { score: 0, reason: null };
  if (input.slot.maxBuyPrice != null && price > input.slot.maxBuyPrice) {
    return { score: 0, reason: null };
  }

  let score = 12;
  const candidateOvr = input.candidate.ovr ?? input.rating?.ovrNormalized ?? null;
  if (input.slot.minOvrBand != null && candidateOvr != null && candidateOvr >= input.slot.minOvrBand) {
    score += 16;
  } else if (input.slot.minOvrBand != null && candidateOvr != null) {
    score += clamp((candidateOvr / input.slot.minOvrBand) * 10, 0, 8);
  }

  if (input.slot.soldAxis && input.player) {
    const axis = getPlayerAxis(input.player);
    if (axis === input.slot.soldAxis) score += 10;
  }

  if (input.slot.soldOvrRank != null && input.rating?.ovrRank != null) {
    const rankGap = Math.abs(input.rating.ovrRank - input.slot.soldOvrRank);
    if (rankGap <= 12) score += 12;
    else if (rankGap <= 20) score += 6;
  }

  if (input.slot.saleProceeds != null && price <= input.slot.saleProceeds * 0.85) {
    score += 8;
  }

  if (score < 18) return { score: 0, reason: null };
  return {
    score: round(score),
    reason: `Nachfolger fuer verkauften ${input.slot.soldPlayerName} — aehnliche Staerke, guenstiger`,
  };
}

export function scoreReplacementFitForSlots(input: {
  candidate: AiTransferPreviewRecommendation;
  player: Player | null;
  rating: PlayerRatingContractRow | null;
  slots: ReplacementSlot[];
}): { score: number; reason: string | null; slotId: string | null } {
  let best = { score: 0, reason: null as string | null, slotId: null as string | null };
  for (const slot of input.slots) {
    if (slot.fulfilled) continue;
    const fit = scoreReplacementFit({ candidate: input.candidate, player: input.player, rating: input.rating, slot });
    if (fit.score > best.score) {
      best = { score: fit.score, reason: fit.reason, slotId: slot.slotId };
    }
  }
  return best;
}

export function markReplacementSlotFulfilled(slots: ReplacementSlot[], slotId: string | null) {
  if (!slotId) return slots;
  return slots.map((slot) => (slot.slotId === slotId ? { ...slot, fulfilled: true } : slot));
}
