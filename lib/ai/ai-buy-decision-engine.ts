import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { TransferDoctrineProfile } from "@/lib/ai/ai-transfer-doctrine-layer";
import { adjustBuyDecisionForDoctrine, getPersonaBlendWeight } from "@/lib/ai/ai-transfer-doctrine-layer";
import type { ReplacementSlot } from "@/lib/ai/ai-transfer-replacement-memory";
import { scoreReplacementFitForSlots } from "@/lib/ai/ai-transfer-replacement-memory";
import type { Player } from "@/lib/data/olyDataTypes";

/**
 * Die zwei Zahlen der Luxussteuer-Bremse: Steigung und Obergrenze, in Punkten Pass-Absicht.
 *
 * Sie sind aus zwei Bedingungen ABGELEITET, nicht gegriffen — die Herleitung samt Messwerten steht
 * an der Verwendungsstelle weiter unten:
 *
 *   1. UNTERSCHEIDEN: im gemessenen Bereich (Abgabe 45 bis 48 % der Abloese) darf die Bremse nicht
 *      am Deckel kleben, sonst kostet jeder Zugang fuer die KI dasselbe.
 *   2. NICHT VERHINDERN: sie darf einen echten Kader-Notstand nie ueberwiegen. Zwei fehlende
 *      Kaderstellen bringen `clamp(2 * 14, 14, 42)` = 28 Kauf-Absicht — die Obergrenze muss also
 *      DARUNTER liegen, nicht unter den 42 einer vollen Luecke.
 */
export const APRON_LEVY_PASS_INTENT_SLOPE = 45;
export const APRON_LEVY_MAX_PASS_INTENT = 27;
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
  /**
   * Die Luxussteuer, die GENAU DIESER Zugang zusätzlich auslöst (`estimateMarginalApronLevy`).
   * Optional, damit der reine Sport-Vergleich (Tests, Vorschau-Ansichten ohne Ligakontext) ohne
   * Spielstand auskommt — fehlt sie, verhält sich die Entscheidung wie vorher.
   */
  apronMarginalLevy?: number | null;
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

  const hoarderWeight = getPersonaBlendWeight(input.doctrine.personaBlend, "hoarder");
  const developerWeight = getPersonaBlendWeight(input.doctrine.personaBlend, "developer");
  if (hoarderWeight >= 0.25 && minGap === 0 && replacementFit.score <= 0) {
    passIntentScore += Math.round(12 * hoarderWeight);
    reasonToPass.push(input.doctrine.personaHint);
  } else if (developerWeight >= 0.2 && minGap === 0 && replacementFit.score <= 0 && (input.score ?? 0) < 48) {
    passIntentScore += Math.round(6 * developerWeight);
    reasonToPass.push("Developer wartet auf entwicklungsfaehigen oder klaren Deal");
  }

  const price = input.price ?? input.marketValue;

  /**
   * LUXUSSTEUER ALS PREISBESTANDTEIL (Meldung von Chris: die KI muss vor dem Kauf wissen, dass ein
   * teurer Zugang sie Abgabe kostet).
   *
   * Gewichtet wird der ANTEIL an der Ablöse, nicht der absolute Betrag: 2 Abgabe auf einen 40er
   * Transfer sind ein Rundungsfehler, 2 Abgabe auf einen 6er Ergänzungsspieler sind ein Drittel
   * Aufschlag. So trifft die Bremse den Fall, um den es geht — der Zugang, der ein Team über die
   * Linie schiebt, ohne dafür Gegenwert zu liefern.
   *
   * NIE BLOCKIEREND: eine Mindestkader-Luecke bringt bis zu 42 Kauf-Absicht ein
   * (`clamp(minGap * 14, 14, 42)` weiter oben), die Steuer darf einen Notkauf also verzoegern, aber
   * nicht verhindern. Das ist dieselbe Linie, die `resolveApronTighteningMultiplier` mit seinem
   * Boden bei 0,5 schon zieht: ein Team DARF die Linie reissen, wenn der Kader es zwingend braucht —
   * es soll es nur nicht aus Versehen tun.
   *
   * DER DECKEL STAND AUF 18 UND SAETTIGTE SEIT DER STUFE DAUERHAFT. Er war gegen eine GEDROSSELTE
   * Abgabe kalibriert: mit der alten Rampe lag der Konjunkturhebel bei einem Salary Factor von 0,96
   * bei 0,22, ein Zugang kostete ein Team ueber der 2. Linie also rund 2 bis 5 Abgabe — Anteile von
   * etwa 10 % an der Abloese, Bremswerte um 6, klar unter dem Deckel und damit UNTERSCHEIDEND.
   *
   * Seit der Stufe (Chris' Entscheidung zu `6fv43h`) zieht die Abgabe ueber der Schwelle voll. Am
   * Live-Abbild nachgemessen, drei Teams ueber der 2. Linie und drei realistische Zugaenge:
   *
   *   Gehalt 6 / Abloese 20  → Abgabe  9,60 = 48 % → Bremse 29 (vorher 18, am Deckel)
   *   Gehalt 10 / Abloese 35 → Abgabe 16,00 = 46 % → Bremse 27 (vorher 18, am Deckel)
   *   Gehalt 14 / Abloese 50 → Abgabe 22,40 = 45 % → Bremse 27 (vorher 18, am Deckel)
   *
   * Bei 18 lieferten ALLE DREI denselben Wert: die KI konnte einen Zugang, der sie 9,60 kostet,
   * nicht mehr von einem unterscheiden, der 22,40 kostet. Genau die Teams, die die Bremse am
   * noetigsten haben, bekamen die unschaerfste. Ein Team unter der Linie (R-L) blieb mit 1 bis 7
   * unveraendert — dort war nie ein Deckel im Spiel.
   *
   * ZWEI ZAHLEN STATT EINER, beide abgeleitet. Mein erster Versuch war, nur den Deckel auf 30 zu
   * heben — das hat den Bestandsfall „ein Mindestkader-Notkauf setzt sich trotz Abgabe durch"
   * umgeworfen, und zwar zu Recht: eine Luecke von ZWEI Kaderstellen bringt 28 Kauf-Absicht, nicht
   * die 42 der vollen Luecke. Der Deckel muss also unter 28 liegen. Bei unveraenderter Steigung 60
   * saettigt der gemessene Bereich dort aber weiterhin (45 % x 60 = 27).
   *
   * Deshalb: Steigung 60 → 45, Deckel 18 → 27. Damit bildet der gemessene Bereich auf 20/21/22 ab —
   * unterscheidend, ohne den Deckel zu beruehren — und 27 bleibt unter den 28 des Notstands. Fuer
   * Teams UNTER der Linie faellt die Bremse leicht milder aus (R-L: 1/4/5 statt 1/5/7); dort war nie
   * ein Deckel im Spiel und die Steuer ohnehin klein.
   */
  const apronLevy = Number(input.apronMarginalLevy ?? 0);
  if (Number.isFinite(apronLevy) && apronLevy > 0) {
    const levyShare = price != null && price > 0 ? apronLevy / price : 1;
    passIntentScore += clamp(Math.round(levyShare * APRON_LEVY_PASS_INTENT_SLOPE), 1, APRON_LEVY_MAX_PASS_INTENT);
    reasonToPass.push(`Luxussteuer: +${Math.round(apronLevy * 100) / 100} Abgabe je Saison`);
  }

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
  } else if (hoarderWeight >= 0.35 && adjusted.strategicBuyScore < 25) {
    buyDecisionLabel = "Hoarder wartet";
  } else if (developerWeight >= 0.25 && adjusted.strategicBuyScore >= 42) {
    buyDecisionLabel = "Developer-Deal";
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
