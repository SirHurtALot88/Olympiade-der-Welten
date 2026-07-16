import type { GameState, SponsorOffer, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import {
  getRankMilestoneBonus,
  SPONSOR_RANK_MILESTONES,
} from "@/lib/sponsor/sponsor-economy-calibration";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import {
  getTeamAxisRank,
  parseAxisTargetValue,
  type SponsorAxisKey,
} from "@/lib/sponsor/sponsor-special-objectives";

export type SponsorChallengeDifficulty = "leicht" | "mittel" | "hart";

export type SponsorSpecialPresentation = {
  specialKey: string;
  headline: string;
  detail: string;
  axisKey: SponsorAxisKey | null;
  axisLabel: string | null;
  difficulty: SponsorChallengeDifficulty;
  difficultyLabel: string;
};

export type SponsorOfferPresentation = {
  isChallenge: boolean;
  isGolden: boolean;
  offerBadge: string | null;
  special: SponsorSpecialPresentation | null;
};

const AXIS_LABELS: Record<SponsorAxisKey, string> = {
  pow: "POW",
  spe: "SPE",
  men: "MEN",
  soc: "SOC",
};

const DIFFICULTY_LABELS: Record<SponsorChallengeDifficulty, string> = {
  leicht: "Leicht",
  mittel: "Mittel",
  hart: "Hart",
};

function resolveAxisDifficulty(currentRank: number | null, targetTopRank: number): SponsorChallengeDifficulty {
  if (currentRank == null) {
    return "mittel";
  }
  const gap = currentRank - targetTopRank;
  if (gap <= 2) {
    return "leicht";
  }
  if (gap <= 4) {
    return "mittel";
  }
  return "hart";
}

function resolveSalaryDifficulty(currentSalary: number, targetSalary: number): SponsorChallengeDifficulty {
  if (currentSalary <= 0 || targetSalary <= 0) {
    return "mittel";
  }
  const reductionRatio = (currentSalary - targetSalary) / currentSalary;
  if (reductionRatio <= 0.05) {
    return "leicht";
  }
  if (reductionRatio <= 0.12) {
    return "mittel";
  }
  return "hart";
}

function resolveTransferDifficulty(target: number): SponsorChallengeDifficulty {
  if (target <= 4) {
    return "leicht";
  }
  if (target <= 6) {
    return "mittel";
  }
  return "hart";
}

function buildSpecialPresentation(input: {
  component: SponsorOfferComponent;
  gameState?: GameState;
  teamId?: string;
}): SponsorSpecialPresentation {
  const specialKey = input.component.specialKey ?? "unknown";
  const base = {
    specialKey,
    headline: input.component.label,
    detail: "",
    axisKey: null as SponsorAxisKey | null,
    axisLabel: null as string | null,
    difficulty: "mittel" as SponsorChallengeDifficulty,
    difficultyLabel: DIFFICULTY_LABELS.mittel,
  };

  if (specialKey === "axis_rank_top") {
    const parsed = parseAxisTargetValue(input.component.targetValue);
    const axisKey = parsed?.axis ?? null;
    const targetTopRank = parsed?.topRank ?? 16;
    let currentRank: number | null = null;
    if (input.gameState && input.teamId && axisKey) {
      const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
      currentRank = getTeamAxisRank(rows, input.teamId, axisKey, input.gameState).rank;
    }
    const difficulty = resolveAxisDifficulty(currentRank, targetTopRank);
    return {
      ...base,
      axisKey,
      axisLabel: axisKey ? AXIS_LABELS[axisKey] : null,
      difficulty,
      difficultyLabel: DIFFICULTY_LABELS[difficulty],
      detail:
        currentRank != null
          ? `Aktuell #${currentRank} · Ziel Top ${targetTopRank}`
          : `Saisonziel: Top ${targetTopRank} in ${axisKey ? AXIS_LABELS[axisKey] : "Achse"}`,
    };
  }

  if (specialKey === "salary_pressure_max") {
    const target =
      typeof input.component.targetValue === "number"
        ? input.component.targetValue
        : Number(input.component.targetValue);
    let currentSalary = 0;
    if (input.gameState && input.teamId) {
      const row = buildTeamSeasonOverviewRows({ gameState: input.gameState }).find((entry) => entry.teamId === input.teamId);
      currentSalary = row?.salaryTotal ?? getTeamDisplaySalaryTotal(input.gameState, input.teamId);
    }
    const difficulty = resolveSalaryDifficulty(currentSalary, target);
    return {
      ...base,
      difficulty,
      difficultyLabel: DIFFICULTY_LABELS[difficulty],
      detail:
        currentSalary > 0
          ? `Aktuell ${currentSalary.toFixed(1)} C · Deckel ${Number.isFinite(target) ? target.toFixed(1) : "—"} C`
          : "Gehaltsdeckel einhalten",
    };
  }

  if (specialKey === "transfer_profit_min") {
    const target = typeof input.component.targetValue === "number" ? input.component.targetValue : 5;
    const difficulty = resolveTransferDifficulty(target);
    return {
      ...base,
      difficulty,
      difficultyLabel: DIFFICULTY_LABELS[difficulty],
      detail: `Netto-Transfergewinn mindestens ${target} C`,
    };
  }

  if (specialKey === "discipline_top3_count") {
    return {
      ...base,
      difficulty: "mittel",
      difficultyLabel: DIFFICULTY_LABELS.mittel,
      detail: "Disziplin-Ranglisten in der Saison",
    };
  }

  return {
    ...base,
    difficulty: "leicht",
    difficultyLabel: DIFFICULTY_LABELS.leicht,
    detail: "Kader-Breite über Form-Farben",
  };
}

export function isChallengeSponsorOffer(offer: SponsorOffer): boolean {
  return offer.isChallengeOffer === true || offer.flavor.includes("Challenge-Sponsor");
}

export function isGoldenSponsorOffer(offer: SponsorOffer): boolean {
  return offer.isGolden === true;
}

export function buildSponsorOfferPresentation(input: {
  offer: SponsorOffer;
  gameState?: GameState;
  teamId?: string;
}): SponsorOfferPresentation {
  const isChallenge = isChallengeSponsorOffer(input.offer);
  const isGolden = isGoldenSponsorOffer(input.offer);
  const specialComponent = input.offer.components.find((component) => component.kind === "special") ?? null;
  // Golden koexistiert mit Challenge (kein CSS/Karten-Umbau hier — nur das Badge-Feld für die spätere UI).
  const badgeParts = [isGolden ? "Golden" : null, isChallenge ? "Challenge" : null].filter(
    (part): part is string => part != null,
  );
  return {
    isChallenge,
    isGolden,
    offerBadge: badgeParts.length > 0 ? badgeParts.join(" · ") : null,
    special: specialComponent
      ? buildSpecialPresentation({
          component: specialComponent,
          gameState: input.gameState,
          teamId: input.teamId ?? input.offer.teamId,
        })
      : null,
  };
}

export function getSponsorComponentKindLabel(kind: SponsorOfferComponent["kind"]) {
  if (kind === "base") return "Basis";
  if (kind === "rank") return "Gewinnstufen";
  if (kind === "improvement") return "Tabellenziel";
  return "Sonderziel";
}

export type SponsorRankTierRow = {
  label: string;
  rankAt: number;
  absolutePayout: number;
};

function roundOfferCash(value: number) {
  return Math.round(value * 10) / 10;
}

/** Absolute sponsor cash (basis + unlocked rank share) at each Gewinnstufe threshold. */
export function buildSponsorRankTierRows(input: {
  baseCash: number;
  rankCash: number;
}): SponsorRankTierRow[] {
  const totalMilestoneBonus = SPONSOR_RANK_MILESTONES.reduce((sum, milestone) => sum + milestone.bonusC, 0);
  return SPONSOR_RANK_MILESTONES.map((milestone) => {
    const unlockedBonus = getRankMilestoneBonus(milestone.maxRank, 1);
    const rankPortion =
      totalMilestoneBonus > 0 && input.rankCash > 0
        ? roundOfferCash(input.rankCash * (unlockedBonus / totalMilestoneBonus))
        : 0;
    return {
      label: milestone.label,
      rankAt: milestone.maxRank,
      absolutePayout: roundOfferCash(input.baseCash + rankPortion),
    };
  });
}
