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

  if (hasAnyTrait(player, ["scandalous", "cruel", "toxic", "chaotic"]) && (manners >= 8 || harmony >= 8)) {
    const intensity = Math.max(manners, harmony) >= 10 ? 0.18 : 0.12;
    salaryMultiplier += intensity;
    score -= intensity >= 0.18 ? 14 : 9;
    reasons.push("Charakterrisiko kollidiert mit hoher Teamkultur.");
  }

  if (hasAnyTrait(player, ["teamplayer", "diligent", "honorable", "humble"]) && (harmony >= 7 || cooperation >= 7)) {
    salaryMultiplier -= 0.04;
    score += 6;
    reasons.push("Teamorientierte Traits passen zur Kultur.");
  }

  if (hasAnyTrait(player, ["diva", "egomaniac"]) && (popularity >= 7 || ambition >= 7)) {
    salaryMultiplier += 0.1;
    score -= 5;
    reasons.push("Star-Ego erwartet sichtbare Wertschaetzung.");
  }

  if (hasTrait(player, "mercenary")) {
    salaryMultiplier += finance >= 8 ? 0.08 : 0.05;
    score += finance >= 8 ? 2 : -3;
    reasons.push("Mercenary verhandelt stark ueber Geld.");
  }

  if (hasTrait(player, "loyal") && harmony >= 7) {
    salaryMultiplier -= 0.05;
    score += 7;
    reasons.push("Loyalitaet und stabile Kultur senken die Forderung.");
  }

  return {
    salaryMultiplier,
    score,
    reasons,
  };
}

function deriveFitDemandMultiplier(teamFit: number) {
  if (teamFit >= 0) return 1;
  return 1 + clamp(Math.abs(teamFit) / 80, 0.04, 0.2);
}

const RETOOL_STANDARD_CONTRACT_SALARY_RANGES: Record<number, { min: number; max: number }> = {
  1: { min: 0.92, max: 1.08 },
  2: { min: 0.86, max: 1.02 },
  3: { min: 0.8, max: 0.96 },
  4: { min: 0.72, max: 0.88 },
  5: { min: 0.61, max: 0.78 },
};

const RETOOL_MERCENARY_CONTRACT_SALARY_RANGES: Record<number, { min: number; max: number }> = {
  1: { min: 0.92, max: 1.08 },
  2: { min: 0.89, max: 1.05 },
  3: { min: 0.86, max: 1.02 },
  4: { min: 0.82, max: 0.98 },
  5: { min: 0.78, max: 0.94 },
};

function deriveRetoolContractSalarySignal(contractLength: number, player: Player | null, teamFit: number) {
  if (!player) {
    return {
      salaryMultiplier: 1,
      contractFactor: 1,
      fit25Multiplier: 1,
      score: 0,
      reason: "",
    };
  }

  const years = clamp(normalizeContractLength(contractLength), 1, 5);
  const isMercenary = hasTrait(player, "mercenary");
  const ranges = isMercenary ? RETOOL_MERCENARY_CONTRACT_SALARY_RANGES : RETOOL_STANDARD_CONTRACT_SALARY_RANGES;
  const range = ranges[years] ?? ranges[1];
  const contractFactor = (range.min + range.max) / 2;
  const fit25Multiplier = teamFit >= 25 ? 0.9 : 1;
  const salaryMultiplier = contractFactor * fit25Multiplier;
  const discountPercent = Math.round((1 - contractFactor) * 100);
  const fitReason = fit25Multiplier < 1 ? " Plus 10% Fit-Rabatt ab Teamfit 25." : "";
  const reason =
    years === 1
      ? `Retool-Vertragslogik: 1 Jahr bleibt beim Basisgehalt.${fitReason}`
      : isMercenary
        ? `Retool-Vertragslogik: ${years} Jahre geben Mercenary nur ${discountPercent}% Jahresrabatt.${fitReason}`
        : `Retool-Vertragslogik: ${years} Jahre geben ${discountPercent}% Jahresrabatt.${fitReason}`;

  return {
    salaryMultiplier,
    contractFactor,
    fit25Multiplier,
    score: clamp((1 - salaryMultiplier) * 34, -4, 12),
    reason,
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

  const baseExpectedSalary =
    input.player || input.rosterEntry
      ? resolvePlayerEconomyContract({ player: input.player, rosterEntry: input.rosterEntry }).salary
      : null;
  let expectedSalary = baseExpectedSalary;
  const offeredSalary =
    typeof input.offeredSalary === "number" && Number.isFinite(input.offeredSalary) && input.offeredSalary > 0
      ? roundMoney(input.offeredSalary, 2)
      : baseExpectedSalary;
  const contractLength = normalizeContractLength(input.contractLength);
  const contractShape = input.contractShape;

  const contractPreview = buildContractSalarySchedule({
    annualSalary: offeredSalary,
    contractLength,
    shape: contractShape,
    seasonIdBase: input.seasonIdBase,
    seasonLabelBase: input.seasonLabelBase,
  });
  const buyoutCost = calculateOpenBuyoutCost(contractPreview.yearlySalarySchedule, 0);

  if (!input.player) {
    blockingReasons.push("player_not_found");
  }
  if (!input.team) {
    blockingReasons.push("team_not_found");
  }
  if (expectedSalary == null || expectedSalary <= 0) {
    blockingReasons.push("salary_source_missing");
  }
  if (offeredSalary == null || offeredSalary <= 0) {
    blockingReasons.push("offer_salary_missing");
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
  const fit25Bonus = deriveFitPolicyBonus(input.teamIdentity);
  let demandMultiplier: number | null = null;

  if (input.player && baseExpectedSalary != null && baseExpectedSalary > 0) {
    const cultureSignals = deriveTraitCultureSignals(input.player, input.teamIdentity);
    const moodDemand = deriveNegotiationMood(input) / 100;
    const contractLengthSignal = deriveRetoolContractSalarySignal(contractLength, input.player, teamFit);
    demandMultiplier = clamp(
      deriveFitDemandMultiplier(teamFit) *
        cultureSignals.salaryMultiplier *
        (input.priorBadExperience ? 1.12 : 1) *
        contractLengthSignal.salaryMultiplier *
        (1 + moodDemand),
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
    reasons.push(...cultureSignals.reasons);
  }

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

    const contractLengthSignal = deriveRetoolContractSalarySignal(contractLength, input.player, teamFit);
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
        shape: "balanced",
        seasonIdBase: input.gameState.season.id,
        seasonLabelBase: input.seasonLabelBase,
      });
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
        contractShape: "balanced",
        contractLength: entry.contractLength,
        totalSalary: preview.totalSalary,
        buyoutCost: calculateOpenBuyoutCost(preview.yearlySalarySchedule, 0),
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
        yearlySalarySchedule: preview.yearlySalarySchedule,
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
  const seasonCount = Math.max(1, ...rows.map((row) => row.yearlySalarySchedule.length));
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
