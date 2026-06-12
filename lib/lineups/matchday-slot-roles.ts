import type { PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";

export type MatchdayIntensityStage = "conserve" | "normal" | "push";

export type MatchdaySlotRoleDefinition = {
  roleId: string;
  label: string;
  description: string;
  majorPositiveAttribute: keyof PlayerAttributeSheetStats;
  minorPositiveAttribute: keyof PlayerAttributeSheetStats;
  strainAttribute: keyof PlayerAttributeSheetStats;
  fatigueProfile: "low" | "medium" | "high";
  classHints?: string[];
  riskLabel?: string;
};

type MatchdaySlotRoleSet = {
  matcher: {
    disciplineIds?: string[];
    disciplineNames?: string[];
  };
  roles: MatchdaySlotRoleDefinition[];
};

export type MatchdayProjectedPreview = {
  baseScore: number | null;
  roleModifier: number;
  intensityModifier: number;
  fatigueModifier: number;
  fatiguePenaltyPercent: number;
  additionalFatigue: number;
  totalProjected: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  fatigueRisk: "niedrig" | "mittel" | "hoch";
  slotStrainLoad: "niedrig" | "mittel" | "hoch";
  strainRiskScore: number;
  warnings: string[];
};

const SLOT_ROLE_SETS: MatchdaySlotRoleSet[] = [
  {
    matcher: {
      disciplineIds: ["mini-dm", "minidm", "mini_dm", "mini dm"],
      disciplineNames: ["mini dm", "mini-dm", "mini_dm"],
    },
    roles: [
      {
        roleId: "frontliner",
        label: "Frontliner",
        description: "Nimmt Druck auf und stabilisiert den Einstieg in Mini DM.",
        majorPositiveAttribute: "health",
        minorPositiveAttribute: "power",
        strainAttribute: "stamina",
        fatigueProfile: "high",
        classHints: ["tank", "berserker", "hero"],
        riskLabel: "Starker Verschleiß bei schwacher Ausdauer",
      },
      {
        roleId: "finisher",
        label: "Finisher",
        description: "Schließt Kämpfe ab und lebt von hoher Torment-/Dexterity-Spitze.",
        majorPositiveAttribute: "torment",
        minorPositiveAttribute: "dexterity",
        strainAttribute: "awareness",
        fatigueProfile: "medium",
        classHints: ["rogue", "sprinter", "charger"],
        riskLabel: "Off-role bei schwacher Awareness",
      },
    ],
  },
  {
    matcher: {
      disciplineIds: ["fechten"],
      disciplineNames: ["fechten"],
    },
    roles: [
      {
        roleId: "duelist",
        label: "Duelist",
        description: "Sauberer Kernslot für direkte Eins-gegen-eins-Situationen.",
        majorPositiveAttribute: "dexterity",
        minorPositiveAttribute: "speed",
        strainAttribute: "stamina",
        fatigueProfile: "medium",
        classHints: ["rogue", "sprinter"],
        riskLabel: "Verliert Schärfe bei schwacher Ausdauer",
      },
      {
        roleId: "aggressor",
        label: "Aggressor",
        description: "Bringt Druck über Torment und Power.",
        majorPositiveAttribute: "torment",
        minorPositiveAttribute: "power",
        strainAttribute: "awareness",
        fatigueProfile: "high",
        classHints: ["berserker", "charger"],
        riskLabel: "Fehleranfällig bei schwacher Awareness",
      },
      {
        roleId: "defender",
        label: "Defender",
        description: "Hält Duelle stabil und federt Gegenangriffe ab.",
        majorPositiveAttribute: "health",
        minorPositiveAttribute: "determination",
        strainAttribute: "speed",
        fatigueProfile: "medium",
        classHints: ["tank", "hero"],
        riskLabel: "Gerät bei wenig Tempo unter Druck",
      },
      {
        roleId: "technician",
        label: "Technician",
        description: "Gewinnt über Technik, Timing und Disziplin.",
        majorPositiveAttribute: "awareness",
        minorPositiveAttribute: "dexterity",
        strainAttribute: "torment",
        fatigueProfile: "low",
        classHints: ["overseer", "tactician"],
        riskLabel: "Zu wildes Profil kostet hier Präzision",
      },
      {
        roleId: "flex",
        label: "Flex",
        description: "Fängt Lücken ab und belohnt runde Allround-Profile.",
        majorPositiveAttribute: "speed",
        minorPositiveAttribute: "awareness",
        strainAttribute: "will",
        fatigueProfile: "medium",
        classHints: ["hero", "bard", "rogue"],
        riskLabel: "Kann kippen, wenn der mentale Unterbau fehlt",
      },
    ],
  },
];

const FATIGUE_PENALTY_CAP_PERCENT = 35;

const INTENSITY_CONFIG: Record<
  MatchdayIntensityStage,
  {
    label: string;
    scoreModifier: number;
    fatigueBase: number;
    rangeLowPercent: number;
    rangeHighPercent: number;
    strainLoadModifier: number;
  }
> = {
  conserve: { label: "Schonen", scoreModifier: -2, fatigueBase: 1, rangeLowPercent: -0.02, rangeHighPercent: 0.01, strainLoadModifier: -1 },
  normal: { label: "Normal", scoreModifier: 0, fatigueBase: 3, rangeLowPercent: -0.05, rangeHighPercent: 0.05, strainLoadModifier: 0 },
  push: { label: "Push", scoreModifier: 2, fatigueBase: 6, rangeLowPercent: -0.03, rangeHighPercent: 0.07, strainLoadModifier: 2 },
};

function normalizeDisciplineToken(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function resolveRoleModifierValue(value: number | null | undefined, kind: "major" | "minor" | "strain") {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }

  if (kind === "major") {
    if (value >= 80) return 4;
    if (value >= 68) return 3;
    if (value >= 56) return 2;
    if (value >= 45) return 1;
    return 0;
  }

  if (kind === "minor") {
    if (value >= 78) return 2;
    if (value >= 60) return 1;
    return 0;
  }

  if (value <= 35) return -1;
  if (value <= 50) return -1;
  return 0;
}

function resolveSlotStrainLoad(fatigueProfile: MatchdaySlotRoleDefinition["fatigueProfile"], roleId: string) {
  const profileBase = fatigueProfile === "high" ? 2 : fatigueProfile === "medium" ? 1 : 0;
  const roleAdjustment =
    roleId === "aggressor" || roleId === "frontliner"
      ? 1
      : roleId === "technician"
        ? -1
        : 0;
  const total = Math.max(profileBase + roleAdjustment, 0);

  if (total >= 2) return "hoch" as const;
  if (total >= 1) return "mittel" as const;
  return "niedrig" as const;
}

function resolvePlayerStrainResistance(strainValue: number | null | undefined) {
  if (strainValue == null || !Number.isFinite(strainValue)) {
    return 0;
  }
  if (strainValue >= 85) return 4;
  if (strainValue >= 72) return 3;
  if (strainValue >= 58) return 2;
  if (strainValue >= 45) return 1;
  return 0;
}

function resolveCurrentFatigueFactor(currentFatigueCount: number) {
  if (currentFatigueCount >= 30) return 4;
  if (currentFatigueCount >= 20) return 3;
  if (currentFatigueCount >= 10) return 2;
  if (currentFatigueCount >= 5) return 1;
  return 0;
}

function resolveAdditionalFatigueFromRisk(
  fatigueProfile: MatchdaySlotRoleDefinition["fatigueProfile"],
  roleId: string,
  intensity: MatchdayIntensityStage,
  currentFatigueCount: number,
  strainValue: number | null | undefined,
) {
  const config = INTENSITY_CONFIG[intensity];
  const slotStrainLoad = resolveSlotStrainLoad(fatigueProfile, roleId);
  const loadScore = slotStrainLoad === "hoch" ? 2 : slotStrainLoad === "mittel" ? 1 : 0;
  const strainRiskScore =
    loadScore +
    config.strainLoadModifier +
    resolveCurrentFatigueFactor(currentFatigueCount) -
    resolvePlayerStrainResistance(strainValue);
  const riskCarry = strainRiskScore >= 4 ? 4 : strainRiskScore >= 2 ? 2 : strainRiskScore >= 1 ? 1 : 0;

  return {
    slotStrainLoad,
    strainRiskScore,
    additionalFatigue: Math.max(config.fatigueBase + loadScore + resolveCurrentFatigueFactor(currentFatigueCount) + riskCarry, 1),
  };
}

export function getMatchdayIntensityConfig(intensity: MatchdayIntensityStage) {
  return INTENSITY_CONFIG[intensity];
}

export function resolveSlotRolesForDiscipline(
  disciplineId: string | null | undefined,
  disciplineName: string | null | undefined,
  requiredPlayers: number | null | undefined,
) {
  const normalizedId = normalizeDisciplineToken(disciplineId);
  const normalizedName = normalizeDisciplineToken(disciplineName);
  const matched = SLOT_ROLE_SETS.find((entry) => {
    const idMatch = (entry.matcher.disciplineIds ?? []).some((token) => normalizeDisciplineToken(token) === normalizedId);
    const nameMatch = (entry.matcher.disciplineNames ?? []).some((token) => normalizeDisciplineToken(token) === normalizedName);
    return idMatch || nameMatch;
  });

  if (matched) {
    return matched.roles.slice(0, Math.max(requiredPlayers ?? matched.roles.length, 0));
  }

  const slotCount = Math.max(requiredPlayers ?? 0, 0);
  return Array.from({ length: slotCount }).map((_, index) => ({
    roleId: `generic-${index + 1}`,
    label: `Starter ${index + 1}`,
    description: "Fallback-Rolle bis eine echte Diszi-Rollenmatrix hinterlegt ist.",
    majorPositiveAttribute: "power",
    minorPositiveAttribute: "speed",
    strainAttribute: "stamina",
    fatigueProfile: "medium" as const,
    riskLabel: "Fallback-Rolle",
  }));
}

export function calculateMatchdayProjectedPreview(input: {
  baseScore: number | null | undefined;
  role: MatchdaySlotRoleDefinition | null | undefined;
  attributeStats: PlayerAttributeSheetStats | null | undefined;
  currentFatigueCount: number | null | undefined;
  intensity: MatchdayIntensityStage;
  knownModifierBonus?: number | null | undefined;
  revealVariance?: number | null | undefined;
}) : MatchdayProjectedPreview {
  const baseScore = input.baseScore ?? null;
  const role = input.role ?? null;
  const attributeStats = input.attributeStats ?? null;
  const currentFatigueCount = input.currentFatigueCount ?? 0;
  const knownModifierBonus = input.knownModifierBonus ?? 0;
  const revealVariance = Math.max(input.revealVariance ?? 2, 0);

  if (!role || baseScore == null || !Number.isFinite(baseScore)) {
    return {
      baseScore,
      roleModifier: 0,
      intensityModifier: INTENSITY_CONFIG[input.intensity].scoreModifier,
      fatigueModifier: 0,
      fatiguePenaltyPercent: 0,
      additionalFatigue: 0,
      totalProjected: baseScore,
      rangeLow: baseScore,
      rangeHigh: baseScore,
      fatigueRisk: "niedrig",
      slotStrainLoad: "niedrig",
      strainRiskScore: 0,
      warnings: baseScore == null ? ["Projected Range ohne Base Score nicht möglich"] : ["Slotrolle fehlt"],
    };
  }

  const majorValue = attributeStats?.[role.majorPositiveAttribute] ?? null;
  const minorValue = attributeStats?.[role.minorPositiveAttribute] ?? null;
  const strainValue = attributeStats?.[role.strainAttribute] ?? null;

  const roleModifier =
    resolveRoleModifierValue(majorValue, "major") +
    resolveRoleModifierValue(minorValue, "minor") +
    resolveRoleModifierValue(strainValue, "strain");

  const intensityConfig = INTENSITY_CONFIG[input.intensity];
  const fatiguePenaltyPercent = Math.min(Math.max(currentFatigueCount, 0) * 0.5, FATIGUE_PENALTY_CAP_PERCENT);
  const preFatigueScore = baseScore + roleModifier;
  const fatigueModifier = Number(((preFatigueScore * fatiguePenaltyPercent) / 100).toFixed(1));
  const fatigueAdjustedScore = preFatigueScore - fatigueModifier;
  const { slotStrainLoad, strainRiskScore, additionalFatigue } = resolveAdditionalFatigueFromRisk(
    role.fatigueProfile,
    role.roleId,
    input.intensity,
    currentFatigueCount,
    strainValue,
  );
  const totalProjected = Number((fatigueAdjustedScore + intensityConfig.scoreModifier + knownModifierBonus).toFixed(1));
  const fatigueRisk =
    strainRiskScore >= 4 || additionalFatigue >= 12 || currentFatigueCount >= 20
      ? "hoch"
      : strainRiskScore >= 2 || additionalFatigue >= 8 || currentFatigueCount >= 10
        ? "mittel"
        : "niedrig";
  const warnings: string[] = [];

  if (input.intensity === "push" && (currentFatigueCount >= 20 || strainRiskScore >= 4)) {
    warnings.push("Push bei stark belastetem Spieler");
  }
  if (strainValue != null && strainValue <= 45) {
    warnings.push(`Schwaches ${String(role.strainAttribute).toUpperCase()} erhöht Strain-Risiko`);
  }
  if (fatiguePenaltyPercent >= 15) {
    warnings.push(`Fatigue ${Math.round(currentFatigueCount)} kostet bereits ${Math.round(fatiguePenaltyPercent)}% Leistung`);
  }

  const rangeRiskSpread = fatigueRisk === "hoch" ? 2 : fatigueRisk === "mittel" ? 1 : 0;
  const baseRangeAnchor = Math.max(fatigueAdjustedScore + knownModifierBonus, 0);
  const rangeLow = Number(
    (
      totalProjected +
      baseRangeAnchor * intensityConfig.rangeLowPercent -
      rangeRiskSpread -
      revealVariance * 0.5
    ).toFixed(1),
  );
  const rangeHigh = Number(
    (
      totalProjected +
      baseRangeAnchor * intensityConfig.rangeHighPercent +
      rangeRiskSpread +
      revealVariance * 0.5
    ).toFixed(1),
  );

  return {
    baseScore,
    roleModifier,
    intensityModifier: intensityConfig.scoreModifier,
    fatigueModifier,
    fatiguePenaltyPercent,
    additionalFatigue,
    totalProjected,
    rangeLow,
    rangeHigh,
    fatigueRisk,
    slotStrainLoad,
    strainRiskScore,
    warnings,
  };
}
