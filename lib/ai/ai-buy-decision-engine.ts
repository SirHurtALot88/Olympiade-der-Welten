import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { TransferDoctrineProfile } from "@/lib/ai/ai-transfer-doctrine-layer";
import { adjustBuyDecisionForDoctrine } from "@/lib/ai/ai-transfer-doctrine-layer";
import type { ReplacementSlot } from "@/lib/ai/ai-transfer-replacement-memory";
import { scoreReplacementFitForSlots } from "@/lib/ai/ai-transfer-replacement-memory";
import type { Player } from "@/lib/data/olyDataTypes";
import { passesStrategicBuyGate } from "@/lib/season/transfer-market-policy";

export type AiBuyDecisionInput = {
  playerId: string;
  playerName: string;
  price: number | null;
  marketValue: number | null;
  salary: number | null;
  ovr: number | null;
  score: number | null;
  rosterAfterSell: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  teamCash: number | null;
  cashAfterSell: number | null;
  plannedSellCount: number;
  weakestSameAxisOvrRank: number | null;
  candidateRating: PlayerRatingContractRow | null;
  player: Player | null;
  replacementSlots: ReplacementSlot[];
  doctrine: TransferDoctrineProfile;
  coversNeedAxis: boolean;
  isTrashCandidate: boolean;
};

export type AiBuyDecisionResult = {
  buyIntentScore: number;
  passIntentScore: number;
  replacementFitScore: number;
  strategicBuyScore: number;
  buyDecisionLabel: string;
  reasonToBuy: string[];
  reasonToPass: string[];
  replacementSlotId: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function getPlayerAxis(player: Player | null): "pow" | "spe" | "men" | "soc" | null {
  if (!player) return null;
  const entries = Object.entries(player.coreStats) as Array<["pow" | "spe" | "men" | "soc", number]>;
  const top = [...entries].sort((left, right) => right[1] - left[1])[0];
  return top?.[0] ?? null;
}

export function evaluateAiBuyDecision(input: AiBuyDecisionInput): AiBuyDecisionResult {
  const reasonToBuy: string[] = [];
  const reasonToPass: string[] = [];
  let buyIntentScore = 0;
  let passIntentScore = 0;

  const cashBase = input.cashAfterSell ?? input.teamCash;
  if (cashBase != null && cashBase < 0) {
    return {
      buyIntentScore: 0,
      passIntentScore: 100,
      replacementFitScore: 0,
      strategicBuyScore: 0,
      buyDecisionLabel: "Cash blockiert",
      reasonToBuy: [],
      reasonToPass: ["negatives Cash blockiert Kaeufe"],
      replacementSlotId: null,
    };
  }

  const roster = input.rosterAfterSell;
  const minGap = roster != null && input.playerMin != null ? Math.max(0, input.playerMin - roster) : 0;
  const optGap = roster != null && input.playerOpt != null ? Math.max(0, input.playerOpt - roster) : 0;

  if (minGap > 0) {
    buyIntentScore += clamp(minGap * 14, 14, 42);
    reasonToBuy.push(`Mindestkader-Luecke: ${minGap} Spieler`);
  } else if (optGap > 0 && (input.score ?? 0) >= 45) {
    buyIntentScore += clamp(optGap * 8, 8, 24);
    reasonToBuy.push(`OPT-Luecke: ${optGap} Spieler`);
  }

  if (input.coversNeedAxis) {
    buyIntentScore += 14;
    reasonToBuy.push("deckt aktuelle Achsenluecke");
  }

  const replacementFit = scoreReplacementFitForSlots({
    candidate: {
      playerId: input.playerId,
      playerName: input.playerName,
      name: input.playerName,
      className: input.player?.className ?? "",
      race: input.player?.race ?? "",
      ovr: input.ovr,
      mvs: input.candidateRating?.mvs ?? null,
      price: input.price,
      marketValue: input.marketValue,
      salary: input.salary,
      contractLength: null,
      cashAfter: null,
      rosterAfter: null,
      salaryAfter: null,
      teamFit: null,
      fitSummary: "",
      sportsSummary: "",
      budgetReason: [],
      warnings: [],
      overallRecommendationScore: input.score ?? 0,
      score: input.score ?? 0,
      reason: "",
      fitNotes: [],
      riskNotes: [],
      strategyNotes: [],
    },
    player: input.player,
    rating: input.candidateRating,
    slots: input.replacementSlots,
  });

  if (replacementFit.score > 0 && replacementFit.reason) {
    buyIntentScore += replacementFit.score;
    reasonToBuy.push(replacementFit.reason);
  }

  if (
    input.weakestSameAxisOvrRank != null &&
    input.candidateRating?.ovrRank != null &&
    input.candidateRating.ovrRank + 8 < input.weakestSameAxisOvrRank
  ) {
    buyIntentScore += 12;
    reasonToBuy.push("Upgrade gegen schwaechsten Kaderplatz auf gleicher Achse");
  }

  if (input.plannedSellCount >= 1 && (input.score ?? 0) >= 52) {
    buyIntentScore += 8;
    reasonToBuy.push("Reinvest nach geplanten Verkaeufen");
  }

  if (input.isTrashCandidate) {
    passIntentScore += 30;
    reasonToPass.push("Kandidat wirkt wie Billig-Fill statt strategischer Zug");
  }

  if (roster != null && input.playerOpt != null && roster >= input.playerOpt && minGap === 0 && replacementFit.score <= 0) {
    passIntentScore += 16;
    reasonToPass.push("Kader bereits am oder ueber OPT ohne klaren Upgrade-Case");
  }

  if (input.doctrine.persona === "hoarder" && minGap === 0 && replacementFit.score <= 0) {
    passIntentScore += 12;
    reasonToPass.push(input.doctrine.personaHint);
  }

  const price = input.price ?? input.marketValue;
  const strategicGate = passesStrategicBuyGate({
    score: input.score,
    price,
    plannedSellCount: input.plannedSellCount,
    rosterAfterSell: roster,
    playerMin: input.playerMin,
    teamCash: cashBase,
    cashAfterBuy: cashBase != null && price != null ? cashBase - price : null,
    cashBuffer: 6 * input.doctrine.cashBufferScale,
  });
  if (!strategicGate.ok && minGap === 0) {
    passIntentScore += 10;
    reasonToPass.push("strategisches Kauf-Gate nicht erfuellt");
  }

  const adjusted = adjustBuyDecisionForDoctrine({
    buyIntentScore,
    passIntentScore,
    replacementFitScore: replacementFit.score,
    doctrine: input.doctrine,
  });

  let buyDecisionLabel = "abwaegen";
  if (replacementFit.score >= 18) {
    buyDecisionLabel = "Star-Nachfolger";
  } else if (minGap > 0) {
    buyDecisionLabel = "Min-Notkauf";
  } else if (optGap > 0 && adjusted.strategicBuyScore >= 35) {
    buyDecisionLabel = "OPT-Upgrade";
  } else if (input.doctrine.persona === "hoarder" && adjusted.strategicBuyScore < 25) {
    buyDecisionLabel = "Hoarder wartet";
  } else if (input.plannedSellCount >= 1 && adjusted.strategicBuyScore >= 40) {
    buyDecisionLabel = "Reinvest";
  } else if (adjusted.strategicBuyScore >= 45) {
    buyDecisionLabel = "strategischer Zug";
  } else if (adjusted.strategicBuyScore < 20) {
    buyDecisionLabel = "passen";
  }

  return {
    buyIntentScore: adjusted.buyIntent,
    passIntentScore: adjusted.passIntent,
    replacementFitScore: replacementFit.score,
    strategicBuyScore: adjusted.strategicBuyScore,
    buyDecisionLabel,
    reasonToBuy,
    reasonToPass,
    replacementSlotId: replacementFit.slotId,
  };
}

export function compareStrategicBuyDecisions(
  left: { strategicBuyScore?: number | null; overallRecommendationScore?: number | null; price?: number | null },
  right: { strategicBuyScore?: number | null; overallRecommendationScore?: number | null; price?: number | null },
  tieBreakBand = 8,
) {
  const leftScore = left.strategicBuyScore ?? left.overallRecommendationScore ?? 0;
  const rightScore = right.strategicBuyScore ?? right.overallRecommendationScore ?? 0;
  if (Math.abs(rightScore - leftScore) > tieBreakBand) {
    return rightScore - leftScore;
  }
  const leftPrice = left.price ?? Number.POSITIVE_INFINITY;
  const rightPrice = right.price ?? Number.POSITIVE_INFINITY;
  if (leftPrice !== rightPrice) {
    return leftPrice - rightPrice;
  }
  return rightScore - leftScore;
}

export function getWeakestSameAxisOvrRank(input: {
  playerAxis: "pow" | "spe" | "men" | "soc" | null;
  rosterPlayerIds: string[];
  playersById: Map<string, Player>;
  ratingsById: Map<string, PlayerRatingContractRow>;
}): number | null {
  if (!input.playerAxis) return null;
  const ranks: number[] = [];
  for (const playerId of input.rosterPlayerIds) {
    const player = input.playersById.get(playerId);
    if (!player) continue;
    const axis = getPlayerAxis(player);
    if (axis !== input.playerAxis) continue;
    const rank = input.ratingsById.get(playerId)?.ovrRank;
    if (rank != null) ranks.push(rank);
  }
  return ranks.length > 0 ? Math.max(...ranks) : null;
}
