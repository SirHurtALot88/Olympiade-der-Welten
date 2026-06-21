import type {
  ContractNegotiationDraft,
  ContractShape,
  ContractYearSalary,
  GameState,
  Player,
  RosterEntry,
  Team,
  TeamIdentity,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTransfermarktSaleFactorBreakdown, normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { calculateTransfermarktFit, getTransfermarktBracket, normalizeTransfermarktToken } from "@/lib/market/transfermarkt-fit";
import { getTransfermarktScoutingRecruitmentBonus } from "@/lib/market/transfermarkt-scouting";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { getCanonicalSeasonLabelAtOffset } from "@/lib/season/season-label";

type ContractPreviewInput = {
  annualSalary: number | null;
  contractLength: number;
  shape: ContractShape;
  seasonIdBase?: string | null;
  seasonLabelBase: string;
};

type NegotiationPreviewInput = {
  saveId: string;
  seasonId: string;
  teamId?: string | null;
  team: Team | null;
  teamIdentity: TeamIdentity | null;
  teamStrategyProfile: TeamStrategyProfile | null;
  player: Player | null;
  rosterEntry?: RosterEntry | null;
  rosterPlayers: Player[];
  contractLength: number;
  contractShape: ContractShape;
  offeredSalary: number | null;
  scoutingLevel?: number | null;
  priorBadExperience?: boolean;
  seasonIdBase?: string | null;
  seasonLabelBase: string;
};

export type ContractSchedulePreview = {
  yearlySalarySchedule: ContractYearSalary[];
  totalSalary: number | null;
  roundingAdjustment: number | null;
};

export type NegotiationScoreBreakdownEntry = {
  key: string;
  label: string;
  category: "base" | "offer" | "fit" | "culture" | "contract" | "history" | "personality" | "mood";
  points: number;
  tone: "positive" | "negative" | "neutral";
  reason: string;
};

export type NegotiationDemandBreakdownEntry = {
  key: string;
  label: string;
  category: "base" | "fit" | "culture" | "contract" | "history" | "personality" | "mood" | "team";
  percent: number;
  multiplier: number;
  tone: "positive" | "negative" | "neutral";
  reason: string;
};

export type PlayerContractLengthPreference = "short" | "medium" | "long";

export type PlayerContractPreference = {
  lengthPreference: PlayerContractLengthPreference;
  shapePreference: ContractShape;
  preferredMinLength: number;
  preferredMaxLength: number;
  idealLength: number;
  salaryAdjustmentPct: number;
  scoreAdjustment: number;
  matchQuality: "preferred" | "acceptable" | "mismatch";
  reasons: string[];
  warnings: string[];
};

export type ContractNegotiationPreview = {
  expectedSalary: number | null;
  baseExpectedSalary: number | null;
  demandMultiplier: number | null;
  offeredSalary: number | null;
  offerRatio: number | null;
  contractLength: number;
  contractShape: ContractShape;
  yearlySalarySchedule: ContractYearSalary[];
  totalSalary: number | null;
  roundingAdjustment: number | null;
  buyoutCost: number | null;
  bracket: number | null;
  teamFit: number | null;
  acceptanceScore: number | null;
  acceptChance: number | null;
  counterChance: number | null;
  rejectChance: number | null;
  contractPreference?: PlayerContractPreference | null;
  demandBreakdown: NegotiationDemandBreakdownEntry[];
  scoreBreakdown: NegotiationScoreBreakdownEntry[];
  reasons: string[];
  warnings: string[];
  blockingReasons: string[];
  status: ContractNegotiationDraft["status"];
};

export type TeamContractSeasonRow = {
  rowId: string;
  playerId: string;
  playerName: string;
  status: "active" | "preview";
  roleTag: string | null;
  contractShape: ContractShape;
  contractLength: number;
  totalSalary: number | null;
  buyoutCost: number | null;
  exitValue: number | null;
  saleFactor: number | null;
  marketValueAtExit: number | null;
  purchasePrice: number | null;
  profitLoss: number | null;
  morale: number | null;
  moraleMood: string | null;
  moraleSmiley: string | null;
  moraleContractIntent: string | null;
  moraleSalaryModifier: number | null;
  moraleRenewalRisk: number | null;
  yearlySalarySchedule: ContractYearSalary[];
};

export type TeamContractSeasonTable = {
  seasonLabels: string[];
  rows: TeamContractSeasonRow[];
  totalsCommitted: Array<{ label: string; salary: number }>;
  totalsWithPreview: Array<{ label: string; salary: number }>;
};

function roundMoney(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeContractLength(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.round(value));
}

function buildSeasonLabel(base: string, offset: number, seasonIdBase?: string | null) {
  return getCanonicalSeasonLabelAtOffset(
    {
      seasonId: seasonIdBase,
      seasonName: base,
    },
    offset,
  );
}

function buildShapeWeights(contractLength: number, shape: ContractShape) {
  if (contractLength <= 1) {
    return [1];
  }

  if (shape === "balanced") {
    return Array.from({ length: contractLength }, () => 1);
  }

  const step = Math.min(0.2, 0.8 / Math.max(1, contractLength - 1));
  const midpoint = (contractLength - 1) / 2;

  return Array.from({ length: contractLength }, (_, index) => {
    const signedDistance = midpoint - index;
    const delta = signedDistance * step;
    const weight = shape === "front_loaded" ? 1 + delta : 1 - delta;
    return Math.max(0.2, Number(weight.toFixed(4)));
  });
}

export function buildContractSalarySchedule(input: ContractPreviewInput): ContractSchedulePreview {
  const contractLength = normalizeContractLength(input.contractLength);
  const annualSalary =
    typeof input.annualSalary === "number" && Number.isFinite(input.annualSalary) && input.annualSalary > 0
      ? input.annualSalary
      : null;

  if (annualSalary == null) {
    return {
      yearlySalarySchedule: [],
      totalSalary: null,
      roundingAdjustment: null,
    };
  }

  const totalSalary = roundMoney(annualSalary * contractLength, 2);
  const weights = buildShapeWeights(contractLength, input.shape);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);

  const rawSchedule = weights.map((weight) => totalSalary * (weight / weightSum));
  const roundedSchedule: ContractYearSalary[] = [];
  let roundedSpent = 0;

  rawSchedule.forEach((value, index) => {
    const isLast = index === rawSchedule.length - 1;
    const roundedValue = isLast ? roundMoney(totalSalary - roundedSpent, 2) : roundMoney(value, 2);
    roundedSpent = roundMoney(roundedSpent + roundedValue, 2);
    roundedSchedule.push({
      yearIndex: index + 1,
      seasonOffset: index,
      label: buildSeasonLabel(input.seasonLabelBase, index, input.seasonIdBase),
      salary: roundedValue,
    });
  });

  const roundingAdjustment = roundMoney(totalSalary - roundedSchedule.reduce((sum, row) => sum + row.salary, 0), 2);

  if (roundingAdjustment !== 0 && roundedSchedule.length > 0) {
    const lastRow = roundedSchedule[roundedSchedule.length - 1];
    lastRow.salary = roundMoney(lastRow.salary + roundingAdjustment, 2);
  }

  return {
    yearlySalarySchedule: roundedSchedule,
    totalSalary,
    roundingAdjustment,
  };
}

export function calculateOpenBuyoutCost(yearlySalarySchedule: ContractYearSalary[], seasonsElapsed = 0) {
  if (!yearlySalarySchedule.length) {
    return null;
  }

  return roundMoney(
    yearlySalarySchedule
      .slice(Math.max(0, seasonsElapsed))
      .reduce((sum, row) => sum + row.salary, 0),
    2,
  );
}

function hasTrait(player: Player, traitName: string) {
  const normalizedNeedle = normalizeTransfermarktToken(traitName);
  return [...player.traitsPositive, ...player.traitsNegative].some(
    (trait) => normalizeTransfermarktToken(trait) === normalizedNeedle,
  );
}

function hasAnyTrait(player: Player, traitNames: string[]) {
  return traitNames.some((traitName) => hasTrait(player, traitName));
}

function deriveFitPolicyBonus(identity: TeamIdentity | null | undefined) {
  const harmony = identity?.harmony ?? 0;
  if (harmony >= 10) return 10;
  if (harmony >= 9) return 8;
  if (harmony >= 8) return 6;
  if (harmony >= 7) return 3;
  return 0;
}

function deriveContractStyleAdjustment(contractLength: number, contractShape: ContractShape, profile: TeamStrategyProfile | null) {
  if (!profile) {
    return 0;
  }

  let score = 0;
  if (profile.bias.shortContractPreference >= 8 && contractLength <= 2) {
    score += 4;
  }
  if (profile.bias.longContractPreference >= 8 && contractLength >= 4) {
    score += 5;
  }
  if (profile.bias.wageSensitivity >= 8 && contractShape === "front_loaded") {
    score -= 3;
  }
  if (profile.bias.cashPriority >= 8 && contractShape === "back_loaded") {
    score += 2;
  }
  if (profile.bias.loyaltyBias >= 8 && contractLength >= 3 && contractShape === "balanced") {
    score += 3;
  }

  return score;
}

function getPlayerTraitTokens(player: Player) {
  return [...player.traitsPositive, ...player.traitsNegative].map((trait) => normalizeTransfermarktToken(trait));
}

function hasToken(tokens: string[], candidates: string[]) {
  return candidates.some((candidate) => tokens.includes(normalizeTransfermarktToken(candidate)));
}

export function buildPlayerContractPreference(
  player: Player | null,
  profile: TeamStrategyProfile | null = null,
  input?: {
    contractLength?: number | null;
    contractShape?: ContractShape | null;
  },
): PlayerContractPreference | null {
  if (!player) {
    return null;
  }

  const tokens = getPlayerTraitTokens(player);
  const seed = hashToUnitInterval(`${player.id}:${player.name}:contract-preference`);
  let longScore = 0;
  let shortScore = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (hasToken(tokens, ["loyal", "disciplined", "diligent", "humble", "teamplayer", "honorable", "stable"])) {
    longScore += 3;
    reasons.push("Traits sprechen fuer Sicherheit und langfristige Bindung.");
  }
  if (hasToken(tokens, ["ambitious", "motivated", "leader", "royalty", "lord"])) {
    longScore += 1;
    reasons.push("Ambition/Status mag ein klares Commitment.");
  }
  if (hasToken(tokens, ["mercenary", "opportunist", "manipulative", "devious", "independent"])) {
    shortScore += 3;
    reasons.push("Flexibilitaets- oder Geldmotiv bevorzugt kuerzere Bindung.");
  }
  if (hasToken(tokens, ["diva", "egomaniac", "scandalous", "chaotic", "relaxed", "coldblooded"])) {
    shortScore += 2;
    warnings.push("Volatile Persoenlichkeit verlangt bei langer Bindung eher Premium.");
  }

  if ((profile?.bias.longContractPreference ?? 0) >= 8) {
    longScore += 1;
  }
  if ((profile?.bias.shortContractPreference ?? 0) >= 8 || (profile?.bias.sellForProfitAggression ?? 0) >= 8) {
    shortScore += 1;
  }

  if (seed > 0.74) {
    longScore += 1;
  } else if (seed < 0.26) {
    shortScore += 1;
  }

  const lengthPreference: PlayerContractLengthPreference =
    longScore - shortScore >= 2 ? "long" : shortScore - longScore >= 2 ? "short" : "medium";
  const idealLength =
    lengthPreference === "long"
      ? seed > 0.58 ? 5 : 4
      : lengthPreference === "short"
        ? seed > 0.5 ? 2 : 1
        : seed > 0.66
          ? 3
          : 2;
  const preferredMinLength = lengthPreference === "long" ? 3 : lengthPreference === "short" ? 1 : 2;
  const preferredMaxLength = lengthPreference === "long" ? 5 : lengthPreference === "short" ? 2 : 4;

  let shapePreference: ContractShape = "balanced";
  if ((profile?.bias.cashPriority ?? 0) >= 8 || (profile?.bias.wageSensitivity ?? 0) >= 8) {
    shapePreference = "back_loaded";
    reasons.push("Teamprofil schont kurzfristig Cash und bevorzugt back-loaded Deals.");
  } else if ((profile?.bias.starPriority ?? 0) >= 8 || (profile?.bias.riskTolerance ?? 0) >= 8) {
    shapePreference = "front_loaded";
    reasons.push("Ambitioniertes Team kann frueh mehr zahlen, um Stars zu sichern.");
  } else if (lengthPreference === "long") {
    shapePreference = "balanced";
  }

  const contractLength = normalizeContractLength(input?.contractLength ?? idealLength);
  const contractShape = input?.contractShape ?? shapePreference;
  const lengthMismatch =
    contractLength < preferredMinLength ? preferredMinLength - contractLength : contractLength > preferredMaxLength ? contractLength - preferredMaxLength : 0;
  const shapeMatches = contractShape === shapePreference;
  const matchQuality: PlayerContractPreference["matchQuality"] =
    lengthMismatch === 0 && shapeMatches ? "preferred" : lengthMismatch <= 1 ? "acceptable" : "mismatch";

  let salaryAdjustmentPct = 0;
  let scoreAdjustment = 0;
  if (matchQuality === "preferred") {
    salaryAdjustmentPct -= lengthPreference === "long" ? 0.04 : 0.025;
    scoreAdjustment += lengthPreference === "long" ? 5 : 3;
  } else if (matchQuality === "acceptable") {
    salaryAdjustmentPct += shapeMatches ? 0 : 0.015;
    scoreAdjustment += shapeMatches ? 1 : -1;
  } else {
    salaryAdjustmentPct += lengthPreference === "long" ? 0.075 : 0.06;
    scoreAdjustment -= lengthPreference === "long" ? 8 : 6;
    warnings.push(
      lengthPreference === "long"
        ? "Spieler bevorzugt lange Sicherheit; kurzer Deal kostet Vertrauen und Gehalt."
        : "Spieler bevorzugt Flexibilitaet; langer Deal braucht Premium.",
    );
  }
  if (!shapeMatches) {
    salaryAdjustmentPct += 0.02;
    scoreAdjustment -= 2;
  }

  const label = lengthPreference === "long" ? "lange Vertraege" : lengthPreference === "short" ? "kurze Vertraege" : "mittlere Vertraege";
  reasons.unshift(`Praeferenz: ${label}, ideal ${idealLength} Season(s), Form ${shapePreference}.`);

  return {
    lengthPreference,
    shapePreference,
    preferredMinLength,
    preferredMaxLength,
    idealLength,
    salaryAdjustmentPct: roundMoney(clamp(salaryAdjustmentPct, -0.08, 0.12), 4),
    scoreAdjustment: Math.round(clamp(scoreAdjustment, -12, 8)),
    matchQuality,
    reasons: Array.from(new Set(reasons)),
    warnings: Array.from(new Set(warnings)),
  };
}

export function recommendContractOfferForPlayer(input: {
  player: Player | null;
  teamStrategyProfile?: TeamStrategyProfile | null;
  teamIdentity?: TeamIdentity | null;
  teamCash?: number | null;
  marketValue?: number | null;
  currentTeamSalary?: number | null;
  dealRole?: string | null;
  rosterCountBefore?: number | null;
  teamRosterMin?: number | null;
  teamRosterOpt?: number | null;
  isFirstSeason?: boolean | null;
  boardPressure?: number | null;
}): { contractLength: number; contractShape: ContractShape; preference: PlayerContractPreference | null; reasons: string[] } {
  const basePreference = buildPlayerContractPreference(input.player, input.teamStrategyProfile);
  const reasons = [...(basePreference?.reasons ?? [])];
  if (!basePreference) {
    return { contractLength: 1, contractShape: "balanced", preference: null, reasons: ["fallback_no_player_preference"] };
  }

  let contractLength = basePreference.idealLength;
  let contractShape = basePreference.shapePreference;
  const cash = input.teamCash ?? null;
  const marketValue = input.marketValue ?? null;
  const currentTeamSalary = input.currentTeamSalary ?? null;
  const cashTight = cash != null && marketValue != null && cash < marketValue * 1.35;
  const cashComfortable =
    cash != null &&
    marketValue != null &&
    cash >= Math.max(marketValue * 2.4, (currentTeamSalary ?? 0) * 1.8, 80);
  const longOrCoreDeal = contractLength >= 3 || (marketValue ?? 0) >= 30;
  const aggressiveProfile =
    (input.teamStrategyProfile?.bias.starPriority ?? 0) >= 7 ||
    (input.teamStrategyProfile?.bias.riskTolerance ?? 0) >= 7 ||
    (input.teamStrategyProfile?.bias.longContractPreference ?? 0) >= 7;
  const valueExitProfile =
    (input.teamStrategyProfile?.bias.valuePriority ?? 0) >= 7 ||
    (input.teamStrategyProfile?.bias.sellForProfitAggression ?? 0) >= 7;
  const roleSignal = (input.dealRole ?? "").toLowerCase();
  const isPremiumRole = /\b(superstar|star|impact|leader|premium)\b/.test(roleSignal);
  const isCoreRole = /\b(core|starter|specialist|theme|value|axis|need|minimum|skeleton)\b/.test(roleSignal);
  const isReserveRole = /\b(cheap|fill|backup|reserve|depth|bench)\b/.test(roleSignal);
  const salaryReference = input.player
    ? resolvePlayerEconomyContract({ player: input.player }).expectedSalary
    : null;
  const firstSeason = input.isFirstSeason === true;
  const identity = input.teamIdentity ?? null;
  const boardConfidence = identity?.boardConfidence ?? 5;
  const harmony = identity?.harmony ?? 5;
  const cooperation = identity?.cooperation ?? 5;
  const ambition = identity?.ambition ?? 5;
  const finances = identity?.finances ?? 5;
  const boardPressure = input.boardPressure ?? Math.max(1, Math.min(10, 11 - boardConfidence));
  const commitmentScore =
    boardConfidence * 0.2 +
    harmony * 0.16 +
    cooperation * 0.12 +
    (input.teamStrategyProfile?.bias.loyaltyBias ?? 5) * 0.14 +
    (input.teamStrategyProfile?.bias.longContractPreference ?? 5) * 0.14 +
    (input.teamStrategyProfile?.bias.riskTolerance ?? 5) * 0.1 +
    ambition * 0.08 +
    finances * 0.06 -
    Math.max(0, boardPressure - 6) * 0.22;
  const longContractPreference = input.teamStrategyProfile?.bias.longContractPreference ?? 5;
  const valuePriority = input.teamStrategyProfile?.bias.valuePriority ?? 5;
  const cashPriority = input.teamStrategyProfile?.bias.cashPriority ?? 5;
  const wageSensitivity = input.teamStrategyProfile?.bias.wageSensitivity ?? 5;
  const stableValueContract =
    !isReserveRole &&
    !cashTight &&
    (marketValue ?? 0) >= 12 &&
    (marketValue ?? 0) <= 38 &&
    (salaryReference == null || (salaryReference >= 3 && salaryReference <= 9)) &&
    (longContractPreference >= 7 || valuePriority >= 7 || commitmentScore >= 7);
  const highCostRisk =
    (marketValue ?? 0) >= 55 &&
    (cashTight || cashPriority >= 8 || wageSensitivity >= 8 || commitmentScore < 5.6 || (input.teamStrategyProfile?.bias.riskTolerance ?? 5) <= 4);

  if (cashTight && contractLength >= 4) {
    contractShape = "back_loaded";
    reasons.push("Cash ist eng: back-loaded Empfehlung schont diese Season.");
  }
  if ((input.teamStrategyProfile?.bias.shortContractPreference ?? 0) >= 8 && basePreference.lengthPreference !== "long") {
    contractLength = Math.min(contractLength, 2);
    reasons.push("Teamstrategie bevorzugt kurze Vertraege.");
  }
  if ((input.teamStrategyProfile?.bias.longContractPreference ?? 0) >= 8 && basePreference.lengthPreference !== "short") {
    contractLength = Math.max(contractLength, 3);
    reasons.push("Teamstrategie bevorzugt Bindung und Gehaltsstabilitaet.");
  }
  if (!cashTight && cashComfortable && longOrCoreDeal && (aggressiveProfile || valueExitProfile)) {
    contractShape = "front_loaded";
    reasons.push("Cashpuffer ist stark: front-loaded Empfehlung zahlt frueh mehr und senkt spaetere Last/Buyout.");
  } else if (!cashTight && cashComfortable && contractLength >= 4 && basePreference.lengthPreference !== "short") {
    contractShape = "front_loaded";
    reasons.push("Langer Vertrag mit Cashpuffer: front-loaded entlastet kommende Seasons.");
  }
  if (roleSignal) {
    const rosterBefore = input.rosterCountBefore ?? null;
    const rosterMin = input.teamRosterMin ?? null;
    const market = marketValue ?? 0;
    if (isPremiumRole) {
      contractLength = Math.max(contractLength, market >= 60 ? 4 : 3);
      if (!cashTight && aggressiveProfile && market >= 45) {
        contractLength = Math.max(contractLength, 4);
      }
      reasons.push("AI-Rolle Premium/Core: echter Impact-Pick wird nicht nur fuer eine Season gebunden.");
    } else if (isCoreRole) {
      contractLength = Math.max(contractLength, market >= 35 ? 3 : 2);
      if (!cashTight && (input.teamStrategyProfile?.bias.longContractPreference ?? 0) >= 7) {
        contractLength = Math.max(contractLength, 3);
      }
      reasons.push("AI-Rolle Core/Starter: mittlere Bindung schuetzt den Kaderkern.");
    } else if (isReserveRole) {
      contractLength = market <= 15 ? Math.min(contractLength, 1) : Math.min(Math.max(contractLength, 2), 2);
      reasons.push("AI-Rolle Depth/Fill: kurze Laufzeit haelt Reserve-Picks flexibel.");
    }
    if (!isReserveRole && rosterBefore != null && rosterMin != null && rosterBefore < rosterMin) {
      contractLength = Math.max(contractLength, 2);
      reasons.push("Roster-Aufbau vor Minimum: Basis-Picks bekommen mindestens mittlere Sicherheit.");
    }
    if (cashTight && !isPremiumRole) {
      contractLength = Math.min(contractLength, 2);
      contractShape = "back_loaded";
      reasons.push("Cash eng: kein langer Nicht-Star-Vertrag.");
    } else if (cashTight && isPremiumRole) {
      contractLength = Math.min(contractLength, 3);
      contractShape = "back_loaded";
      reasons.push("Cash eng: Premium-Pick bleibt gebunden, aber nicht maximal lang.");
    }
    if ((input.teamStrategyProfile?.bias.shortContractPreference ?? 0) >= 8 && !isPremiumRole) {
      contractLength = Math.min(contractLength, 2);
      reasons.push("Vorsichtiger GM kappt Nicht-Star-Deals auf maximal zwei Seasons.");
    }
  }
  if (marketValue != null && marketValue >= 25 && !isReserveRole) {
    contractLength = Math.max(contractLength, marketValue >= 55 ? 3 : 2);
    reasons.push("Teurerer AI-Pick bekommt Mindestbindung statt Einjahres-Default.");
  }
  if (stableValueContract) {
    contractLength = Math.max(contractLength, commitmentScore >= 7.8 || longContractPreference >= 8 ? 4 : 3);
    reasons.push("Value-Vertrag: mittleres Gehalt kann ueber mehrere Spieler echte Savings bringen.");
  }
  if (commitmentScore >= 7.2 && !cashTight && !isReserveRole) {
    contractLength = Math.max(contractLength, marketValue != null && marketValue >= 55 ? 4 : 3);
    reasons.push("Board/Harmony/GM-Vertrauen erlauben laengere Bindung.");
  } else if (commitmentScore <= 4.2 && !isPremiumRole) {
    contractLength = Math.min(contractLength, 2);
    reasons.push("Niedriges Board-/Teamvertrauen begrenzt Laufzeit.");
  }
  if (highCostRisk) {
    contractLength = Math.min(contractLength, firstSeason ? 3 : 4);
    if (cashTight) {
      contractShape = "back_loaded";
    }
    reasons.push("Hoher Kostenblock mit Risiko: Star-Vertrag wird nicht automatisch maximal lang.");
  }
  if (firstSeason) {
    const seasonOneCap = stableValueContract && commitmentScore >= 7.6
      ? 4
      : isPremiumRole || (marketValue ?? 0) >= 65
      ? 4
      : (marketValue ?? 0) >= 35 || isCoreRole
        ? 3
        : 2;
    contractLength = Math.min(contractLength, seasonOneCap);
    reasons.push("Season 1: Teams bleiben bei langen Vertraegen vorsichtiger.");
  }

  return {
    contractLength: clamp(Math.round(contractLength), 1, 5),
    contractShape,
    preference: buildPlayerContractPreference(input.player, input.teamStrategyProfile, {
      contractLength,
      contractShape,
    }),
    reasons: Array.from(new Set(reasons)),
  };
}

function hashToUnitInterval(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function deriveNegotiationMood(input: NegotiationPreviewInput) {
  const seed = `${input.saveId}:${input.seasonId}:${input.team?.teamId ?? input.teamId ?? "team"}:${input.player?.id ?? "player"}`;
  return roundMoney((hashToUnitInterval(seed) - 0.5) * 8, 1);
}

function buildDemandEntry(input: Omit<NegotiationDemandBreakdownEntry, "percent" | "tone">): NegotiationDemandBreakdownEntry {
  const percent = Math.round((input.multiplier - 1) * 100);
  return {
    ...input,
    percent,
    tone: percent < 0 ? "positive" : percent > 0 ? "negative" : "neutral",
  };
}

function pushDemandBreakdown(
  entries: NegotiationDemandBreakdownEntry[],
  entry: Omit<NegotiationDemandBreakdownEntry, "percent" | "tone">,
) {
  if (!Number.isFinite(entry.multiplier) || Math.abs(entry.multiplier - 1) < 0.005) {
    return;
  }
  entries.push(buildDemandEntry(entry));
}

function deriveTraitCultureSignals(player: Player, identity: TeamIdentity | null) {
  const harmony = identity?.harmony ?? 0;
  const manners = identity?.manners ?? 0;
  const cooperation = identity?.cooperation ?? 0;
  const popularity = identity?.popularity ?? 0;
  const ambition = identity?.ambition ?? 0;
  const finance = identity?.finances ?? 0;
  let salaryMultiplier = 1;
  let score = 0;
  const reasons: string[] = [];
  const demandEntries: NegotiationDemandBreakdownEntry[] = [];

  if (hasAnyTrait(player, ["scandalous", "cruel", "toxic", "chaotic"]) && (manners >= 8 || harmony >= 8)) {
    const intensity = Math.max(manners, harmony) >= 10 ? 0.18 : 0.12;
    salaryMultiplier += intensity;
    score -= intensity >= 0.18 ? 14 : 9;
    reasons.push("Charakterrisiko kollidiert mit hoher Teamkultur.");
    pushDemandBreakdown(demandEntries, {
      key: "trait_culture_risk",
      label: "Charakter/Kultur",
      category: "culture",
      multiplier: 1 + intensity,
      reason: "Riskante Traits passen schlecht zu Harmony/Manners.",
    });
  }

  if (hasAnyTrait(player, ["teamplayer", "diligent", "honorable", "humble"]) && (harmony >= 7 || cooperation >= 7)) {
    salaryMultiplier -= 0.04;
    score += 6;
    reasons.push("Teamorientierte Traits passen zur Kultur.");
    pushDemandBreakdown(demandEntries, {
      key: "team_trait_culture_fit",
      label: "Kultur-Fit",
      category: "culture",
      multiplier: 0.96,
      reason: "Teamplayer/Diligent/Honorable/Humble passen zur Teamkultur.",
    });
  }

  if (hasAnyTrait(player, ["diva", "egomaniac"]) && (popularity >= 7 || ambition >= 7)) {
    salaryMultiplier += 0.1;
    score -= 5;
    reasons.push("Star-Ego erwartet sichtbare Wertschaetzung.");
    pushDemandBreakdown(demandEntries, {
      key: "ego_status_premium",
      label: "Status-Erwartung",
      category: "personality",
      multiplier: 1.1,
      reason: "Diva/Egomaniac erwartet bei populärem oder ambitioniertem Umfeld ein Statussignal.",
    });
  }

  if (hasTrait(player, "mercenary")) {
    const mercenaryPremium = finance >= 8 ? 0.08 : 0.05;
    salaryMultiplier += mercenaryPremium;
    score += finance >= 8 ? 2 : -3;
    reasons.push("Mercenary verhandelt stark ueber Geld.");
    pushDemandBreakdown(demandEntries, {
      key: "mercenary_money_premium",
      label: "Mercenary",
      category: "personality",
      multiplier: 1 + mercenaryPremium,
      reason: finance >= 8 ? "Finanzstarkes Team muss Geldmotivation bedienen." : "Geldmotivierter Spieler fordert Premium.",
    });
  }

  if (hasTrait(player, "loyal") && harmony >= 7) {
    salaryMultiplier -= 0.05;
    score += 7;
    reasons.push("Loyalitaet und stabile Kultur senken die Forderung.");
    pushDemandBreakdown(demandEntries, {
      key: "loyal_harmony_discount",
      label: "Loyal + Harmony",
      category: "culture",
      multiplier: 0.95,
      reason: "Loyaler Spieler akzeptiert stabile Teamharmonie günstiger.",
    });
  }

  return {
    salaryMultiplier,
    score,
    reasons,
    demandEntries,
  };
}

function deriveFitDemandMultiplier(teamFit: number) {
  if (teamFit >= 0) return 1;
  return 1 + clamp(Math.abs(teamFit) / 80, 0.04, 0.2);
}

const LONG_CONTRACT_DISCOUNT_PER_EXTRA_YEAR = 0.07;

function deriveRetoolContractSalarySignal(
  contractLength: number,
  player: Player | null,
  teamFit: number,
  salaryPreferenceAdjustmentPct = 0,
) {
  if (!player) {
    return {
      salaryMultiplier: 1,
      contractFactor: 1,
      shortTermMultiplier: 1,
      fit25Multiplier: 1,
      longFitMultiplier: 1,
      grossDiscount: 0,
      playerDiscount: 0,
      preferenceAdjustment: 0,
      netDiscount: 0,
      score: 0,
      reason: "",
      demandEntries: [] as NegotiationDemandBreakdownEntry[],
    };
  }

  const years = clamp(normalizeContractLength(contractLength), 1, 5);
  const isMercenary = hasTrait(player, "mercenary");
  const extraYears = Math.max(0, years - 1);
  const grossDiscount = roundMoney(extraYears * LONG_CONTRACT_DISCOUNT_PER_EXTRA_YEAR, 4);
  const playerDiscount = roundMoney(isMercenary ? grossDiscount * 0.5 : grossDiscount, 4);
  const preferenceAdjustment =
    typeof salaryPreferenceAdjustmentPct === "number" && Number.isFinite(salaryPreferenceAdjustmentPct)
      ? salaryPreferenceAdjustmentPct
      : 0;
  const netDiscount = clamp(playerDiscount - preferenceAdjustment, -0.12, isMercenary ? 0.2 : 0.38);
  const contractFactor = clamp(1 - netDiscount, 0.55, 1.2);
  const shortTermMultiplier = years === 1 ? 1.03 : 1;
  const fit25Multiplier = teamFit >= 25 ? 0.9 : 1;
  const longFitPressure =
    years >= 4 && teamFit < 18
      ? clamp(((18 - teamFit) / 18) * (years === 5 ? 0.06 : 0.04), 0, years === 5 ? 0.06 : 0.04)
      : 0;
  const longFitMultiplier = 1;
  const salaryMultiplier = contractFactor * shortTermMultiplier * longFitMultiplier * fit25Multiplier;
  const demandEntries: NegotiationDemandBreakdownEntry[] = [];
  if (years === 1) {
    pushDemandBreakdown(demandEntries, {
      key: "contract_one_year_no_discount",
      label: "1 Jahr",
      category: "contract",
      multiplier: shortTermMultiplier,
      reason: "Kurze Laufzeit gibt keinen Sicherheitsrabatt und verlangt leicht mehr Jahresgehalt.",
    });
  } else {
    pushDemandBreakdown(demandEntries, {
      key: "contract_length_discount",
      label: `${years} Jahre`,
      category: "contract",
      multiplier: contractFactor,
      reason: isMercenary
        ? `Längerer Vertrag gibt Rabatt, Mercenary nimmt davon nur etwa die Hälfte mit.`
        : "Längere Sicherheit senkt die Jahresforderung.",
    });
  }
  pushDemandBreakdown(demandEntries, {
    key: "fit25_salary_discount",
    label: "Fit 25+",
    category: "fit",
    multiplier: fit25Multiplier,
    reason: "Sehr guter Teamfit senkt die Forderung am Ende.",
  });
  pushDemandBreakdown(demandEntries, {
    key: "long_fit_pressure",
    label: "Langer Vertrag + Fit-Risiko",
    category: "contract",
    multiplier: longFitMultiplier,
    reason: `Bei ${years} Jahren verlangt niedriger Fit Sicherheitsaufschlag.`,
  });
  const grossDiscountPercent = Math.round(grossDiscount * 100);
  const playerDiscountPercent = Math.round(playerDiscount * 100);
  const preferencePercent = Math.round(preferenceAdjustment * 100);
  const netDiscountPercent = Math.round(netDiscount * 100);
  const fitReason = fit25Multiplier < 1 ? " Teamfit 25+: 10% Fit-Rabatt wird ganz am Ende abgezogen." : "";
  const pressureReason =
    longFitPressure > 0
      ? ` Niedriger Fit bei ${years} Jahren drueckt die Zusage, aber nicht den Langvertragsrabatt.`
      : "";
  const preferenceReason =
    preferenceAdjustment > 0
      ? ` Spielerwunsch zieht ${preferencePercent}% davon ab.`
      : preferenceAdjustment < 0
        ? ` Spielerwunsch verbessert den Rabatt um ${Math.abs(preferencePercent)}%.`
        : "";
  const reason =
    years === 1
      ? `Retool-Vertragslogik: 1 Jahr bleibt beim Basisgehalt.${fitReason}`
      : isMercenary
        ? `Retool-Vertragslogik: ${years} Jahre geben ${grossDiscountPercent}% Grundrabatt, Mercenary halbiert auf ${playerDiscountPercent}%.${preferenceReason} Netto ${netDiscountPercent}% Jahresrabatt.${fitReason}${pressureReason}`
        : `Retool-Vertragslogik: ${years} Jahre geben ${grossDiscountPercent}% Grundrabatt.${preferenceReason} Netto ${netDiscountPercent}% Jahresrabatt.${fitReason}${pressureReason}`;

  return {
    salaryMultiplier,
    contractFactor,
    shortTermMultiplier,
    fit25Multiplier,
    longFitMultiplier,
    grossDiscount,
    playerDiscount,
    preferenceAdjustment,
    netDiscount,
    score: clamp((1 - contractFactor * longFitMultiplier) * 34 + (fit25Multiplier < 1 ? 4 : 0) - longFitPressure * 75, -14, 12),
    reason,
    demandEntries,
  };
}

function deriveContractShapeDemandSignal(contractShape: ContractShape, preference: PlayerContractPreference | null) {
  const entries: NegotiationDemandBreakdownEntry[] = [];

  if (contractShape === "front_loaded") {
    pushDemandBreakdown(entries, {
      key: "shape_front_loaded_cash_now",
      label: "Front-loaded",
      category: "contract",
      multiplier: 0.98,
      reason: "Frühes Geld reduziert die Jahresforderung leicht.",
    });
  } else if (contractShape === "back_loaded") {
    pushDemandBreakdown(entries, {
      key: "shape_back_loaded_late_money",
      label: "Back-loaded",
      category: "contract",
      multiplier: 1.02,
      reason: "Späteres Geld verlangt leichte Kompensation.",
    });
  }

  if (preference && contractShape !== preference.shapePreference) {
    pushDemandBreakdown(entries, {
      key: "shape_preference_mismatch",
      label: "Form gegen Wunsch",
      category: "contract",
      multiplier: 1.02,
      reason: `Spieler bevorzugt ${preference.shapePreference}.`,
    });
  } else if (preference && contractShape === preference.shapePreference) {
    pushDemandBreakdown(entries, {
      key: "shape_preference_match",
      label: "Form passt",
      category: "contract",
      multiplier: 0.99,
      reason: "Vertragsform trifft die Spielerpräferenz.",
    });
  }

  return {
    salaryMultiplier: entries.reduce((product, entry) => product * entry.multiplier, 1),
    entries,
  };
}

function deriveTeamDemandSignals(input: NegotiationPreviewInput, player: Player, teamFit: number) {
  const entries: NegotiationDemandBreakdownEntry[] = [];
  const identity = input.teamIdentity;
  const profile = input.teamStrategyProfile;
  const harmony = identity?.harmony ?? 5;
  const cooperation = identity?.cooperation ?? 5;
  const ambition = identity?.ambition ?? 5;
  const boardConfidence = identity?.boardConfidence ?? 5;
  const finances = identity?.finances ?? 5;

  if (harmony >= 8 && cooperation >= 7) {
    pushDemandBreakdown(entries, {
      key: "team_harmony_discount",
      label: "Harmony",
      category: "team",
      multiplier: 0.97,
      reason: "Gute Harmony/Cooperation senkt Wechselrisiko.",
    });
  } else if (harmony <= 3 || cooperation <= 3) {
    pushDemandBreakdown(entries, {
      key: "team_harmony_risk",
      label: "Teamruhe",
      category: "team",
      multiplier: 1.04,
      reason: "Unruhiges Team muss mehr Sicherheit bieten.",
    });
  }

  if (boardConfidence <= 3) {
    pushDemandBreakdown(entries, {
      key: "board_confidence_risk",
      label: "Board-Druck",
      category: "team",
      multiplier: 1.04,
      reason: "Niedrige Board Confidence macht das Projekt unsicherer.",
    });
  } else if (boardConfidence >= 8) {
    pushDemandBreakdown(entries, {
      key: "board_confidence_stability",
      label: "Board stabil",
      category: "team",
      multiplier: 0.98,
      reason: "Stabiles Board macht den Wechsel planbarer.",
    });
  }

  if (hasTrait(player, "ambitious")) {
    if (ambition >= 8 || (profile?.bias.starPriority ?? 0) >= 8) {
      pushDemandBreakdown(entries, {
        key: "ambition_project_match",
        label: "Ambition passt",
        category: "personality",
        multiplier: 0.97,
        reason: "Ambitious sieht sportische Perspektive im Projekt.",
      });
    } else if (ambition <= 4 || teamFit < 8) {
      pushDemandBreakdown(entries, {
        key: "ambition_project_doubt",
        label: "Ambition zweifelt",
        category: "personality",
        multiplier: 1.06,
        reason: "Ambitious verlangt mehr, wenn Perspektive oder Fit schwach wirken.",
      });
    }
  }

  if ((profile?.bias.wageSensitivity ?? 5) >= 8 || finances >= 8) {
    pushDemandBreakdown(entries, {
      key: "wage_disciplined_team",
      label: "Gehaltsdisziplin",
      category: "team",
      multiplier: 0.98,
      reason: "Finanzstarkes oder gehaltsdiszipliniertes Umfeld verhandelt sauberer.",
    });
  }

  if ((profile?.bias.starPriority ?? 5) >= 8 && (profile?.bias.riskTolerance ?? 5) >= 7 && (input.team?.cash ?? 0) > 60) {
    pushDemandBreakdown(entries, {
      key: "aggressive_cash_signal",
      label: "Star-Projekt",
      category: "team",
      multiplier: 1.03,
      reason: "Aggressives Team mit Cash wird eher auf Premium geprüft.",
    });
  }

  return {
    salaryMultiplier: entries.reduce((product, entry) => product * entry.multiplier, 1),
    entries,
  };
}

function pushScoreBreakdown(
  entries: NegotiationScoreBreakdownEntry[],
  entry: Omit<NegotiationScoreBreakdownEntry, "tone">,
) {
  const points = Math.round(entry.points);
  entries.push({
    ...entry,
    points,
    tone: points > 0 ? "positive" : points < 0 ? "negative" : "neutral",
  });
}

function normalizeChances(accept: number, counter: number, reject: number) {
  const safe = [accept, counter, reject].map((value) => Math.max(0, Math.round(value)));
  const total = safe.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return {
      acceptChance: 0,
      counterChance: 0,
      rejectChance: 100,
    };
  }

  const normalized = safe.map((value) => Math.round((value / total) * 100));
  const diff = 100 - normalized.reduce((sum, value) => sum + value, 0);
  normalized[1] += diff;

  return {
    acceptChance: clamp(normalized[0], 0, 99),
    counterChance: clamp(normalized[1], 0, 99),
    rejectChance: clamp(normalized[2], 0, 99),
  };
}

function calculateNegotiationChances(input: {
  acceptanceScore: number;
  offerRatio: number;
  teamFit: number;
  isMercenary: boolean;
}) {
  const offerSignal = input.offerRatio - 1;
  const scoreSignal = (input.acceptanceScore - 50) / 50;
  const fitSignal = clamp(input.teamFit / 60, -0.8, 0.8);
  const mercenaryLowballPenalty = input.isMercenary && input.offerRatio < 1 ? (1 - input.offerRatio) * 18 : 0;

  const rawAccept = clamp(
    18 + input.acceptanceScore * 0.8 + Math.max(0, offerSignal) * 95 + fitSignal * 8,
    2,
    94,
  );
  const rawCounter = clamp(
    26 + (1 - Math.abs(input.offerRatio - 0.98)) * 34 - Math.max(0, scoreSignal) * 8 + Math.max(0, -scoreSignal) * 10,
    5,
    72,
  );
  const rawReject = clamp(
    18 + (50 - input.acceptanceScore) * 1.05 + Math.max(0, -offerSignal) * 120 - Math.max(0, offerSignal) * 45 - fitSignal * 8 + mercenaryLowballPenalty,
    2,
    94,
  );

  return normalizeChances(rawAccept, rawCounter, rawReject);
}

export function buildContractNegotiationPreview(input: NegotiationPreviewInput): ContractNegotiationPreview {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  const scoreBreakdown: NegotiationScoreBreakdownEntry[] = [];
  const demandBreakdown: NegotiationDemandBreakdownEntry[] = [];

  const economy =
    input.player || input.rosterEntry
      ? resolvePlayerEconomyContract({ player: input.player, rosterEntry: input.rosterEntry })
      : null;
  const baseExpectedSalary = economy?.expectedSalary ?? null;
  let expectedSalary = baseExpectedSalary;
  let offeredSalary =
    typeof input.offeredSalary === "number" && Number.isFinite(input.offeredSalary) && input.offeredSalary > 0
      ? roundMoney(input.offeredSalary, 2)
      : null;
  const contractLength = normalizeContractLength(input.contractLength);
  const contractShape = input.contractShape;

  if (!input.player) {
    blockingReasons.push("player_not_found");
  }
  if (!input.team) {
    blockingReasons.push("team_not_found");
  }
  if (expectedSalary == null || expectedSalary <= 0) {
    blockingReasons.push("salary_source_missing");
  }

  const formulaSources = loadPlayerFormulaSources();
  if (formulaSources.traitSalaryFactorsStatus !== "ready") {
    warnings.push("trait_salary_factor_source_missing");
  }

  const bracket = input.player ? getTransfermarktBracket(resolvePlayerEconomyContract({ player: input.player }).marketValue) : null;
  if (bracket != null) {
    warnings.push("market_bracket_factor_preview_pending");
  }

  const fitBreakdown =
    input.player && input.rosterPlayers.length > 0
      ? calculateTransfermarktFit(input.player, input.rosterPlayers, { teamId: input.teamId })
      : { teamFit: 0, fitRace: 0, fitSubclasses: 0, fitTraits: 0, fitAlignment: 0 };
  const teamFit = fitBreakdown.teamFit ?? 0;
  const scoutingRecruitmentBonus = getTransfermarktScoutingRecruitmentBonus(input.scoutingLevel);
  const fit25Bonus = deriveFitPolicyBonus(input.teamIdentity);
  let demandMultiplier: number | null = null;
  const contractPreference = buildPlayerContractPreference(input.player, input.teamStrategyProfile, {
    contractLength,
    contractShape,
  });

  if (input.player && baseExpectedSalary != null && baseExpectedSalary > 0) {
    const cultureSignals = deriveTraitCultureSignals(input.player, input.teamIdentity);
    const moodDemand = deriveNegotiationMood(input) / 100;
    const contractLengthSignal = deriveRetoolContractSalarySignal(
      contractLength,
      input.player,
      teamFit,
      contractPreference?.salaryAdjustmentPct ?? 0,
    );
    const fitDemandMultiplier = deriveFitDemandMultiplier(teamFit);
    const trustMultiplier = input.priorBadExperience ? 1.12 : 1;
    const moodMultiplier = 1 + moodDemand;
    const contractShapeSignal = deriveContractShapeDemandSignal(contractShape, contractPreference);
    const teamDemandSignals = deriveTeamDemandSignals(input, input.player, teamFit);

    demandBreakdown.push(buildDemandEntry({
      key: "base_salary",
      label: "Basis",
      category: "base",
      multiplier: 1,
      reason: "Basisgehalt aus MW, Klasse, Traits und Salary-Logik.",
    }));
    pushDemandBreakdown(demandBreakdown, {
      key: "negative_fit_pressure",
      label: "Teamfit",
      category: "fit",
      multiplier: fitDemandMultiplier,
      reason: `Fit ${roundMoney(teamFit, 1)} macht den Wechsel schwieriger.`,
    });
    demandBreakdown.push(...contractLengthSignal.demandEntries);
    demandBreakdown.push(...contractShapeSignal.entries);
    demandBreakdown.push(...cultureSignals.demandEntries);
    demandBreakdown.push(...teamDemandSignals.entries);
    pushDemandBreakdown(demandBreakdown, {
      key: "prior_bad_experience",
      label: "Trust",
      category: "history",
      multiplier: trustMultiplier,
      reason: "Fruehere Ablehnung belastet die Forderung.",
    });
    pushDemandBreakdown(demandBreakdown, {
      key: "negotiation_mood_demand",
      label: "Verhandlungslaune",
      category: "mood",
      multiplier: moodMultiplier,
      reason: "Kleine, deterministische Varianz fuer lebendigere Verhandlungen.",
    });

    const rawDemandMultiplier = clamp(
      fitDemandMultiplier *
        cultureSignals.salaryMultiplier *
        trustMultiplier *
        contractLengthSignal.contractFactor *
        contractLengthSignal.shortTermMultiplier *
        contractLengthSignal.longFitMultiplier *
        contractShapeSignal.salaryMultiplier *
        teamDemandSignals.salaryMultiplier *
        moodMultiplier,
      0.5,
      1.45,
    );
    demandMultiplier = clamp(
      rawDemandMultiplier * contractLengthSignal.fit25Multiplier,
      0.5,
      1.45,
    );
    expectedSalary = roundMoney(baseExpectedSalary * demandMultiplier, 2);

    if (demandMultiplier > 1.06) {
      reasons.push(`Forderung steigt auf ${roundMoney(demandMultiplier * 100, 0)}% des Basisgehalts.`);
    } else if (demandMultiplier < 0.97) {
      reasons.push(`Guter Kontext senkt die Forderung auf ${roundMoney(demandMultiplier * 100, 0)}% des Basisgehalts.`);
    }
    if (contractLengthSignal.reason) {
      reasons.push(contractLengthSignal.reason);
    }
    if (contractPreference) {
      reasons.push(...contractPreference.reasons);
      warnings.push(...contractPreference.warnings);
    }
    reasons.push(...cultureSignals.reasons);
  }

  offeredSalary = offeredSalary ?? expectedSalary ?? baseExpectedSalary;
  if (offeredSalary == null || offeredSalary <= 0) {
    blockingReasons.push("offer_salary_missing");
  }

  const contractPreview = buildContractSalarySchedule({
    annualSalary: offeredSalary,
    contractLength,
    shape: contractShape,
    seasonIdBase: input.seasonIdBase,
    seasonLabelBase: input.seasonLabelBase,
  });
  const buyoutCost = calculateOpenBuyoutCost(contractPreview.yearlySalarySchedule, 0);

  const offerRatio =
    expectedSalary != null && expectedSalary > 0 && offeredSalary != null
      ? roundMoney(offeredSalary / expectedSalary, 4)
      : null;

  let acceptanceScore: number | null = null;
  let acceptChance: number | null = null;
  let counterChance: number | null = null;
  let rejectChance: number | null = null;

  if (blockingReasons.length === 0 && input.player && expectedSalary != null && offeredSalary != null && offerRatio != null) {
    pushScoreBreakdown(scoreBreakdown, {
      key: "base_interest",
      label: "Grundinteresse",
      category: "base",
      points: 45,
      reason: "Spieler ist grundsaetzlich offen fuer ein Angebot.",
    });

    const offerDelta = offerRatio - 1;
    pushScoreBreakdown(scoreBreakdown, {
      key: "salary_offer",
      label: "Gehaltsangebot",
      category: "offer",
      points: clamp(offerDelta * 95, -42, 32),
      reason:
        offerRatio >= 1
          ? "Angebot liegt auf oder ueber der aktuellen Forderung."
          : "Angebot liegt unter der aktuellen Forderung.",
    });

    if (teamFit >= 25) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "team_fit",
        label: "Teamfit",
        category: "fit",
        points: Math.max(fit25Bonus, clamp(teamFit * 0.65, 8, 28)),
        reason: `Hoher Fit (${roundMoney(teamFit, 1)}) macht den Wechsel attraktiver.`,
      });
      reasons.push(`Hoher Team-Fit (${roundMoney(teamFit, 1)}) gibt Bonus.`);
    } else if (teamFit >= 0) {
      const scaledBonus = fit25Bonus > 0 ? (teamFit / 25) * fit25Bonus : teamFit / 5;
      pushScoreBreakdown(scoreBreakdown, {
        key: "team_fit",
        label: "Teamfit",
        category: "fit",
        points: scaledBonus,
        reason: `Fit (${roundMoney(teamFit, 1)}) hilft leicht, ist aber kein klarer Wechselgrund.`,
      });
      reasons.push(`Team-Fit (${roundMoney(teamFit, 1)}) stuetzt das Angebot leicht.`);
    } else {
      const fitPenalty = Math.max(-10, teamFit / 2.5);
      pushScoreBreakdown(scoreBreakdown, {
        key: "team_fit",
        label: "Teamfit",
        category: "fit",
        points: fitPenalty,
        reason: `Negativer Fit (${roundMoney(teamFit, 1)}) macht den Wechsel riskanter.`,
      });
      warnings.push("low_team_fit_reduces_acceptance");
    }

    if (scoutingRecruitmentBonus > 0) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "scouting_network",
        label: "Scouting",
        category: "culture",
        points: scoutingRecruitmentBonus,
        reason: "Gutes Scouting verbessert Kontakt, Vorwissen und Grundbereitschaft des Spielers.",
      });
      reasons.push(`Scouting-Level ${input.scoutingLevel ?? 0} gibt ${scoutingRecruitmentBonus > 0 ? "+" : ""}${scoutingRecruitmentBonus} Grundbereitschaft.`);
    }

    const contractStyleScore = deriveContractStyleAdjustment(contractLength, contractShape, input.teamStrategyProfile);
    if (contractStyleScore !== 0) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "contract_style",
        label: "Vertragsstruktur",
        category: "contract",
        points: contractStyleScore,
        reason: "Laenge/Form passen zur Team- oder Spielerlogik.",
      });
    }

    if (contractPreference && contractPreference.scoreAdjustment !== 0) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "player_contract_preference",
        label: "Spieler-Vertragspraeferenz",
        category: "contract",
        points: contractPreference.scoreAdjustment,
        reason: contractPreference.reasons[0] ?? "Laufzeit/Form beeinflussen die Verhandlung.",
      });
    }

    const contractLengthSignal = deriveRetoolContractSalarySignal(
      contractLength,
      input.player,
      teamFit,
      contractPreference?.salaryAdjustmentPct ?? 0,
    );
    if (contractLengthSignal.reason) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "contract_length_security",
        label: "Laufzeitsicherheit",
        category: "contract",
        points: contractLengthSignal.score,
        reason: contractLengthSignal.reason,
      });
    }

    if (input.priorBadExperience) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "bad_experience",
        label: "Schlechte Erfahrung",
        category: "history",
        points: -14,
        reason: "Fruehere Ablehnung belastet neue Verhandlungen mit diesem Team.",
      });
      warnings.push("previous_rejected_offer_reduces_trust");
    }

    const cultureSignals = deriveTraitCultureSignals(input.player, input.teamIdentity);
    if (cultureSignals.score !== 0) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "trait_culture",
        label: "Traits & Teamkultur",
        category: "culture",
        points: cultureSignals.score,
        reason: cultureSignals.reasons.join(" ") || "Traits veraendern die Teamwirkung.",
      });
    }

    const isMercenary = hasTrait(input.player, "mercenary");
    if (isMercenary) {
      if (offerRatio < 1) {
        pushScoreBreakdown(scoreBreakdown, {
          key: "mercenary_lowball",
          label: "Mercenary",
          category: "personality",
          points: -7,
          reason: "Mercenary reagiert empfindlich auf Angebote unter Forderung.",
        });
      } else if (offerRatio > 1.05) {
        pushScoreBreakdown(scoreBreakdown, {
          key: "mercenary_paid",
          label: "Mercenary",
          category: "personality",
          points: 4,
          reason: "Ueberdurchschnittliches Angebot trifft seine Geldmotivation.",
        });
      }
      reasons.push("Mercenary reagiert empfindlich auf Lowball-Angebote.");
    }

    if (input.player && hasTrait(input.player, "loyal") && teamFit >= 20) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "loyal_fit",
        label: "Loyalitaet",
        category: "personality",
        points: 6,
        reason: "Loyaler Spieler akzeptiert guten Fit eher.",
      });
      reasons.push("Loyal + guter Fit erhoeht die Toleranz.");
    }

    if (input.player && hasTrait(input.player, "ambitious")) {
      const ambition = input.teamIdentity?.ambition ?? 0;
      if (ambition >= 8 || (input.teamStrategyProfile?.bias.starPriority ?? 0) >= 8) {
        pushScoreBreakdown(scoreBreakdown, {
          key: "ambition_match",
          label: "Ambition",
          category: "personality",
          points: 4,
          reason: "Ambitionierter Spieler sieht sportische Perspektive.",
        });
        reasons.push("Ambitious mag ambitionierte Teamumfelder.");
      } else if (offerRatio < 1) {
        pushScoreBreakdown(scoreBreakdown, {
          key: "ambition_mismatch",
          label: "Ambition",
          category: "personality",
          points: -3,
          reason: "Ambitionierter Spieler sieht wenig Signal im Angebot.",
        });
        warnings.push("Ambitious reagiert bei schwachem Angebot kritischer.");
      }
    }

    if (input.player && (hasTrait(input.player, "diva") || hasTrait(input.player, "egomaniac"))) {
      if (offerRatio < 1) {
        pushScoreBreakdown(scoreBreakdown, {
          key: "ego_lowball",
          label: "Ego",
          category: "personality",
          points: -8,
          reason: "Diva/Egomaniac empfindet Lowball als fehlende Wertschaetzung.",
        });
      } else if (offerRatio > 1.08) {
        pushScoreBreakdown(scoreBreakdown, {
          key: "ego_signal",
          label: "Ego",
          category: "personality",
          points: 4,
          reason: "Starkes Angebot liefert das erwartete Statussignal.",
        });
      }
      reasons.push("Diva/Egomaniac erwarten ein sichtbares Signal im Angebot.");
    }

    if (input.teamStrategyProfile?.bias.wageSensitivity != null && offerRatio < 1) {
      const wagePenalty = ((input.teamStrategyProfile.bias.wageSensitivity - 5) / 5) * 4;
      if (wagePenalty > 0) {
        pushScoreBreakdown(scoreBreakdown, {
          key: "team_wage_sensitivity",
          label: "Team-Gehaltsdisziplin",
          category: "culture",
          points: -Math.max(0, wagePenalty),
          reason: "Gehaltsbewusstes Umfeld drueckt bei schwachem Angebot nicht automatisch nach oben.",
        });
      }
    }

    const mood = deriveNegotiationMood(input);
    pushScoreBreakdown(scoreBreakdown, {
      key: "negotiation_mood",
      label: "Tagesform",
      category: "mood",
      points: mood,
      reason: "Kleiner deterministischer Verhandlungsfaktor fuer Varianz.",
    });

    if (offerRatio >= 1.1) {
      reasons.push("Angebot liegt deutlich ueber dem Erwartungsgehalt.");
    } else if (offerRatio >= 1) {
      reasons.push("Angebot deckt das Erwartungsgehalt.");
    } else {
      warnings.push("offer_below_expected_salary");
    }

    const score = scoreBreakdown.reduce((sum, entry) => sum + entry.points, 0);
    acceptanceScore = clamp(Math.round(score), 0, 99);
    const normalized = calculateNegotiationChances({
      acceptanceScore,
      offerRatio,
      teamFit,
      isMercenary,
    });
    acceptChance = normalized.acceptChance;
    counterChance = normalized.counterChance;
    rejectChance = normalized.rejectChance;
  }

  if (contractShape === "front_loaded") {
    reasons.push("Front-loaded legt frueh mehr Gehalt in den Vertrag.");
  } else if (contractShape === "back_loaded") {
    reasons.push("Back-loaded schiebt Gehalt in spaetere Seasons.");
  } else {
    reasons.push("Balanced verteilt das Gehalt gleichmaessig.");
  }

  warnings.push("preview_only_contract_negotiation");

  return {
    expectedSalary,
    baseExpectedSalary,
    demandMultiplier: demandMultiplier != null ? roundMoney(demandMultiplier, 4) : null,
    offeredSalary,
    offerRatio,
    contractLength,
    contractShape,
    yearlySalarySchedule: contractPreview.yearlySalarySchedule,
    totalSalary: contractPreview.totalSalary,
    roundingAdjustment: contractPreview.roundingAdjustment,
    buyoutCost,
    bracket,
    teamFit,
    acceptanceScore,
    acceptChance,
    counterChance,
    rejectChance,
    contractPreference,
    demandBreakdown,
    scoreBreakdown,
    reasons,
    warnings: Array.from(new Set(warnings)),
    blockingReasons: Array.from(new Set(blockingReasons)),
    status:
      blockingReasons.length > 0
        ? "blocked_missing_salary_source"
        : "ready_for_review",
  };
}

export function buildContractNegotiationDraft(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  preview: ContractNegotiationPreview;
}): ContractNegotiationDraft {
  return {
    draftId: `contract-draft:${input.seasonId}:${input.teamId}:${input.playerId}`,
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamId: input.teamId,
    playerId: input.playerId,
    playerName: input.playerName,
    contractLength: input.preview.contractLength,
    contractShape: input.preview.contractShape,
    expectedSalary: input.preview.expectedSalary,
    offeredSalary: input.preview.offeredSalary,
    yearlySalarySchedule: input.preview.yearlySalarySchedule,
    totalSalary: input.preview.totalSalary,
    roundingAdjustment: input.preview.roundingAdjustment,
    buyoutCost: input.preview.buyoutCost,
    bracket: input.preview.bracket,
    teamFit: input.preview.teamFit,
    acceptanceScore: input.preview.acceptanceScore,
    acceptChance: input.preview.acceptChance,
    counterChance: input.preview.counterChance,
    rejectChance: input.preview.rejectChance,
    reasons: input.preview.reasons,
    warnings: input.preview.warnings,
    blockingReasons: input.preview.blockingReasons,
    status: input.preview.status,
    updatedAt: new Date().toISOString(),
  };
}

export function buildTeamContractSeasonTable(input: {
  gameState: GameState;
  teamId: string;
  seasonLabelBase: string;
}): TeamContractSeasonTable {
  const rosterRows = input.gameState.rosters
    .filter((entry) => entry.teamId === input.teamId)
    .map<TeamContractSeasonRow>((entry) => {
      const player = input.gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null;
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      const saleFactorBreakdown = buildTransfermarktSaleFactorBreakdown(input.gameState, player, entry);
      const marketValueAtExit = saleFactorBreakdown.baseMarketValue ?? economy.marketValue ?? null;
      const exitValue = saleFactorBreakdown.salePrice ?? economy.marketValue ?? null;
      const purchasePrice = normalizeVisibleRosterMoney(entry.purchasePrice, economy.purchasePrice);
      const profitLoss =
        exitValue != null && purchasePrice != null
          ? roundMoney(Math.abs(exitValue - purchasePrice) < 0.005 ? 0 : exitValue - purchasePrice, 2)
          : null;
      const preview = buildContractSalarySchedule({
        annualSalary: economy.salary,
        contractLength: entry.contractLength,
        shape: entry.contractShape ?? "balanced",
        seasonIdBase: input.gameState.season.id,
        seasonLabelBase: input.seasonLabelBase,
      });
      const yearlySalarySchedule =
        entry.yearlySalarySchedule && entry.yearlySalarySchedule.length > 0
          ? entry.yearlySalarySchedule
          : preview.yearlySalarySchedule;
      const morale = player
        ? assessPlayerMorale({
            gameState: input.gameState,
            playerId: player.id,
            teamId: input.teamId,
            renewalSalaryPreview: economy.salary,
          })
        : null;

      return {
        rowId: entry.id,
        playerId: entry.playerId,
        playerName: player?.name ?? entry.playerId,
        status: "active",
        roleTag: entry.roleTag,
        contractShape: entry.contractShape ?? "balanced",
        contractLength: entry.contractLength,
        totalSalary: roundMoney(yearlySalarySchedule.reduce((sum, row) => sum + row.salary, 0), 2),
        buyoutCost: calculateOpenBuyoutCost(yearlySalarySchedule, 0),
        exitValue,
        saleFactor: saleFactorBreakdown.saleFactor,
        marketValueAtExit,
        purchasePrice,
        profitLoss,
        morale: morale?.morale ?? null,
        moraleMood: morale?.moodLabel ?? null,
        moraleSmiley: morale?.smiley ?? null,
        moraleContractIntent: morale?.contractIntent ?? null,
        moraleSalaryModifier: morale?.moraleSalaryModifier ?? null,
        moraleRenewalRisk: morale?.moraleRenewalRisk ?? null,
        yearlySalarySchedule,
      };
    });

  const previewRows = (input.gameState.seasonState.contractNegotiationDrafts ?? [])
    .filter((draft) => draft.teamId === input.teamId)
    .map<TeamContractSeasonRow>((draft) => ({
      rowId: draft.draftId,
      playerId: draft.playerId,
      playerName: draft.playerName,
      status: "preview",
      roleTag: "preview",
      contractShape: draft.contractShape,
      contractLength: draft.contractLength,
      totalSalary: draft.totalSalary,
      buyoutCost: draft.buyoutCost,
      exitValue: null,
      saleFactor: null,
      marketValueAtExit: null,
      purchasePrice: null,
      profitLoss: null,
      morale: null,
      moraleMood: null,
      moraleSmiley: null,
      moraleContractIntent: null,
      moraleSalaryModifier: null,
      moraleRenewalRisk: null,
      yearlySalarySchedule: draft.yearlySalarySchedule,
    }));

  const rows = [...rosterRows, ...previewRows];
  const seasonCount = Math.max(5, ...rows.map((row) => row.yearlySalarySchedule.length));
  const seasonLabels = Array.from({ length: seasonCount }, (_, index) =>
    buildSeasonLabel(input.seasonLabelBase, index, input.gameState.season.id),
  );

  const totalsCommitted = seasonLabels.map((label, index) => ({
    label,
    salary: roundMoney(
      rosterRows.reduce((sum, row) => sum + (row.yearlySalarySchedule[index]?.salary ?? 0), 0),
      2,
    ),
  }));

  const totalsWithPreview = seasonLabels.map((label, index) => ({
    label,
    salary: roundMoney(
      rows.reduce((sum, row) => sum + (row.yearlySalarySchedule[index]?.salary ?? 0), 0),
      2,
    ),
  }));

  return {
    seasonLabels,
    rows,
    totalsCommitted,
    totalsWithPreview,
  };
}
