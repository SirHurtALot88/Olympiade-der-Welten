import { getTransfermarktTierFromPoints, type TransfermarktRatingTier } from "@/lib/market/transfermarkt-sheet-stats";

export type TransfermarktAttributeKey =
  | "power"
  | "health"
  | "stamina"
  | "intelligence"
  | "awareness"
  | "determination"
  | "speed"
  | "dexterity"
  | "charisma"
  | "will"
  | "spirit"
  | "torment";

export type TransfermarktAttributeTone = "power" | "speed" | "mental" | "social";

export type TransfermarktAttributeValues = Partial<Record<TransfermarktAttributeKey, number | null>>;
export type TransfermarktAttributeRatings = Partial<Record<TransfermarktAttributeKey, TransfermarktRatingTier | null>>;

export type TransfermarktScoutedAttributeRow = {
  key: TransfermarktAttributeKey;
  label: string;
  tone: TransfermarktAttributeTone;
  revealed: boolean;
  revealLevel: number;
  value: number | null;
  ratingLabel: TransfermarktRatingTier | null;
  rangeLabel: string | null;
};

type ScoutedDisciplineInput = {
  disciplineId: string;
  disciplineName: string;
  score: number;
};

export type ScoutedDisciplineTier = {
  disciplineId: string;
  disciplineName: string;
  scoreTier: TransfermarktRatingTier | null;
  displayedScore: number;
};

export type TransfermarktScoutingDisclosure = {
  level: number;
  positiveTraitsVisible: number;
  negativeTraitsVisible: boolean;
  preferredDisciplinesVisible: boolean;
  exactAttributeValuesVisible: boolean;
};

export type TransfermarktScoutingVisibilityBuckets = {
  knowledge: string[];
  scouted: string[];
  hidden: string[];
};

const ATTRIBUTE_SCOUTING_META: Array<{
  key: TransfermarktAttributeKey;
  label: string;
  tone: TransfermarktAttributeTone;
  revealLevel: 1 | 2 | 3;
}> = [
  { key: "power", label: "Power", tone: "power", revealLevel: 1 },
  { key: "speed", label: "Speed", tone: "speed", revealLevel: 1 },
  { key: "intelligence", label: "Intelligence", tone: "mental", revealLevel: 1 },
  { key: "charisma", label: "Charisma", tone: "social", revealLevel: 1 },
  { key: "health", label: "Health", tone: "power", revealLevel: 2 },
  { key: "dexterity", label: "Dexterity", tone: "speed", revealLevel: 2 },
  { key: "awareness", label: "Awareness", tone: "mental", revealLevel: 2 },
  { key: "will", label: "Will", tone: "social", revealLevel: 2 },
  { key: "stamina", label: "Stamina", tone: "power", revealLevel: 3 },
  { key: "determination", label: "Determination", tone: "speed", revealLevel: 3 },
  { key: "spirit", label: "Spirit", tone: "mental", revealLevel: 3 },
  { key: "torment", label: "Torment", tone: "social", revealLevel: 3 },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundValue(value: number, digits = 0) {
  return Number(value.toFixed(digits));
}

export function normalizeTransfermarktScoutingLevel(level: number | null | undefined) {
  if (typeof level !== "number" || !Number.isFinite(level)) {
    return 0;
  }
  return clamp(Math.round(level), 0, 5);
}

function getSeedValue(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getAccuracyFactor(level: number) {
  return [0.24, 0.36, 0.5, 0.68, 0.84, 1][level] ?? 0.24;
}

function getSharedBiasAmplitude(level: number) {
  return [3.5, 2.5, 1.75, 1, 0.5, 0][level] ?? 3.5;
}

function getDisciplineNoiseAmplitude(level: number) {
  return [8, 6, 4.5, 3, 1.5, 0][level] ?? 8;
}

function getNumericNoiseAmplitude(level: number) {
  return [18, 13, 9, 5, 0, 0][level] ?? 18;
}

function getAttributeRangeLabel(tier: TransfermarktRatingTier | null | undefined) {
  switch (tier) {
    case "S+":
      return "S-S+";
    case "S":
      return "A-S";
    case "A":
      return "A-B";
    case "B":
      return "B-C";
    case "C":
      return "C-D";
    case "D":
      return "D-E";
    case "E":
      return "E-F";
    case "F":
      return "F";
    default:
      return null;
  }
}

export function getTransfermarktScoutingDisclosure(level: number | null | undefined): TransfermarktScoutingDisclosure {
  const normalizedLevel = normalizeTransfermarktScoutingLevel(level);
  return {
    level: normalizedLevel,
    positiveTraitsVisible: normalizedLevel >= 3 ? 2 : normalizedLevel >= 2 ? 1 : 0,
    negativeTraitsVisible: normalizedLevel >= 4,
    preferredDisciplinesVisible: normalizedLevel >= 4,
    exactAttributeValuesVisible: normalizedLevel >= 5,
  };
}

export function getTransfermarktScoutingVisibilityBuckets(
  level: number | null | undefined,
): TransfermarktScoutingVisibilityBuckets {
  const disclosure = getTransfermarktScoutingDisclosure(level);
  const knowledge = [
    "MW, Gehalt, Ratio und Potenzialband",
    "4 Attribute als grobe Bereiche",
    "Top-Diszis als grobe Slot-Fits",
    "Deal-Vorschau für Cash, Kader und Bedarf",
  ];

  const scouted: string[] = [];
  if (disclosure.positiveTraitsVisible > 0) {
    scouted.push(
      disclosure.positiveTraitsVisible === 1
        ? "1 positiver Trait sichtbar"
        : `${disclosure.positiveTraitsVisible} positive Traits sichtbar`,
    );
  }
  if (disclosure.negativeTraitsVisible) {
    scouted.push("negative Traits sichtbar");
  }
  if (disclosure.preferredDisciplinesVisible) {
    scouted.push("Trainings-/Diszi-Profil sichtbar");
  } else if (disclosure.level >= 2) {
    scouted.push("Trainingsprofil teilweise sichtbar");
  }
  if (disclosure.exactAttributeValuesVisible) {
    scouted.push("alle Attribute exakt sichtbar");
  } else {
    scouted.push(disclosure.level >= 4 ? "Attribute als exakte Tier-Bereiche" : "Attribute nur als grobe Range");
  }

  const hidden: string[] = [];
  if (disclosure.positiveTraitsVisible < 2) {
    hidden.push("weitere positive Traits");
  }
  if (!disclosure.negativeTraitsVisible) {
    hidden.push("negative Traits");
  }
  if (!disclosure.preferredDisciplinesVisible) {
    hidden.push("vollständiges Trainings-/Diszi-Profil");
  }
  if (!disclosure.exactAttributeValuesVisible) {
    hidden.push("exakte Attributwerte");
  }

  return { knowledge, scouted, hidden };
}

export function getScoutedNumericEstimate(input: {
  saveId: string;
  playerId: string;
  field: string;
  value: number | null | undefined;
  scoutingLevel?: number | null;
  min?: number;
  max?: number;
  digits?: number;
}) {
  if (typeof input.value !== "number" || !Number.isFinite(input.value)) {
    return null;
  }
  const normalizedLevel = normalizeTransfermarktScoutingLevel(input.scoutingLevel);
  if (normalizedLevel >= 4) {
    return roundValue(clamp(input.value, input.min ?? 0, input.max ?? 100), input.digits ?? 0);
  }
  const amplitude = getNumericNoiseAmplitude(normalizedLevel);
  const noise = (getSeedValue(`${input.saveId}:${input.playerId}:${input.field}:scout-estimate-v1`) - 0.5) * 2 * amplitude;
  return roundValue(clamp(input.value + noise, input.min ?? 0, input.max ?? 100), input.digits ?? 0);
}

export function getScoutedTraitView(input: {
  traitsPositive: string[];
  traitsNegative: string[];
  scoutingLevel?: number | null;
}) {
  const disclosure = getTransfermarktScoutingDisclosure(input.scoutingLevel);
  const visiblePositiveTraits = input.traitsPositive.slice(0, disclosure.positiveTraitsVisible);
  const visibleNegativeTraits = disclosure.negativeTraitsVisible ? input.traitsNegative : [];
  return {
    disclosure,
    visiblePositiveTraits,
    visibleNegativeTraits,
    hiddenPositiveTraitCount: Math.max(0, input.traitsPositive.length - visiblePositiveTraits.length),
    hiddenNegativeTraitCount: Math.max(0, input.traitsNegative.length - visibleNegativeTraits.length),
  };
}

export function buildScoutedDisciplineTiers(input: {
  saveId: string;
  playerId: string;
  scoutingLevel?: number | null;
  disciplines: ScoutedDisciplineInput[];
  topN?: number;
}) {
  const normalizedLevel = normalizeTransfermarktScoutingLevel(input.scoutingLevel);
  if (input.disciplines.length === 0) {
    return [] satisfies ScoutedDisciplineTier[];
  }

  const accuracyFactor = getAccuracyFactor(normalizedLevel);
  const sharedBiasAmplitude = getSharedBiasAmplitude(normalizedLevel);
  const disciplineNoiseAmplitude = getDisciplineNoiseAmplitude(normalizedLevel);
  const meanScore = input.disciplines.reduce((sum, entry) => sum + entry.score, 0) / input.disciplines.length;
  const sortedRawScores = [...input.disciplines].map((entry) => entry.score).sort((left, right) => right - left);
  const topScore = sortedRawScores[0] ?? meanScore;
  const secondScore = sortedRawScores[1] ?? topScore;
  const thirdScore = sortedRawScores[2] ?? secondScore;
  const sharedBias =
    normalizedLevel >= 5
      ? 0
      : (getSeedValue(`${input.saveId}:${input.playerId}:discipline-scout-shared-v1`) - 0.5) * 2 * sharedBiasAmplitude;

  return [...input.disciplines]
    .map((entry) => {
      const disciplineNoise =
        normalizedLevel >= 5
          ? 0
          : (getSeedValue(`${input.saveId}:${input.playerId}:${entry.disciplineId}:discipline-scout-noise-v1`) - 0.5) *
            2 *
            disciplineNoiseAmplitude;
      const displayedScoreRaw =
        normalizedLevel >= 5
          ? entry.score
          : meanScore + (entry.score - meanScore) * accuracyFactor + sharedBias + disciplineNoise;
      const strengthSignal = clamp((entry.score - meanScore) / 20, -1, 1);
      const topBandFloor =
        entry.score >= thirdScore
          ? topScore >= 78
            ? 50
            : topScore >= 70
              ? 46
              : topScore >= 60
                ? 42
                : 36
          : entry.score >= secondScore
            ? topScore >= 78
              ? 46
              : topScore >= 70
                ? 43
                : topScore >= 60
                  ? 39
                  : 34
            : topScore >= 78
              ? 42
              : topScore >= 70
                ? 39
                : topScore >= 60
                  ? 36
                  : 32;
      const protectedScoreRaw =
        normalizedLevel >= 4
          ? displayedScoreRaw
          : Math.max(displayedScoreRaw, topBandFloor + Math.max(0, strengthSignal) * (normalizedLevel <= 1 ? 4 : 2));
      const displayedScore = roundValue(clamp(protectedScoreRaw, 20, 99), 0);
      return {
        disciplineId: entry.disciplineId,
        disciplineName: entry.disciplineName,
        displayedScore,
        scoreTier: getTransfermarktTierFromPoints(displayedScore),
        rawScore: entry.score,
      };
    })
    .sort((left, right) => {
      if (right.displayedScore !== left.displayedScore) {
        return right.displayedScore - left.displayedScore;
      }
      if (right.rawScore !== left.rawScore) {
        return right.rawScore - left.rawScore;
      }
      return left.disciplineName.localeCompare(right.disciplineName, "de", { sensitivity: "base" });
    })
    .slice(0, Math.max(1, input.topN ?? 3))
    .map(({ disciplineId, disciplineName, displayedScore, scoreTier }) => ({
      disciplineId,
      disciplineName,
      displayedScore,
      scoreTier,
    }));
}

export function getTransfermarktScoutingRecruitmentBonus(level: number | null | undefined) {
  const normalizedLevel = normalizeTransfermarktScoutingLevel(level);
  return [0, 1, 2, 4, 6, 9][normalizedLevel] ?? 0;
}

export function getTransfermarktTrainingAffinityVisibility(level: number | null | undefined) {
  const normalizedLevel = normalizeTransfermarktScoutingLevel(level);
  return {
    positiveVisible: normalizedLevel >= 3 ? 2 : normalizedLevel >= 2 ? 1 : 0,
    negativeVisible: normalizedLevel >= 3 ? 1 : 0,
  };
}

export function buildTransfermarktScoutedAttributeRows(input: {
  values?: TransfermarktAttributeValues | null;
  ratings?: TransfermarktAttributeRatings | null;
  scoutingLevel?: number | null;
  exact?: boolean;
  saveId?: string | null;
  playerId?: string | null;
}) {
  const normalizedLevel = normalizeTransfermarktScoutingLevel(input.scoutingLevel);
  const exact = Boolean(input.exact);
  const visibleCount = exact ? ATTRIBUTE_SCOUTING_META.length : [4, 4, 8, 12, 12, 12][normalizedLevel] ?? 4;
  const exactTierVisible = exact || normalizedLevel >= 4;
  const exactValueVisible = exact || normalizedLevel >= 5;
  const revealSeedPrefix =
    input.saveId && input.playerId
      ? `${input.saveId}:${input.playerId}:attribute-reveal-v1`
      : null;
  const orderedMeta = revealSeedPrefix
    ? [...ATTRIBUTE_SCOUTING_META].sort((left, right) => {
        const leftSeed = getSeedValue(`${revealSeedPrefix}:${left.key}`);
        const rightSeed = getSeedValue(`${revealSeedPrefix}:${right.key}`);
        if (leftSeed !== rightSeed) {
          return leftSeed - rightSeed;
        }
        return left.label.localeCompare(right.label, "de", { sensitivity: "base" });
      })
    : ATTRIBUTE_SCOUTING_META;
  const revealLevelByKey = new Map<TransfermarktAttributeKey, number>(
    orderedMeta.map((entry, index) => [entry.key, Math.min(3, Math.floor(index / 4) + 1)]),
  );
  const visibleKeys = new Set<TransfermarktAttributeKey>(orderedMeta.slice(0, visibleCount).map((entry) => entry.key));

  return ATTRIBUTE_SCOUTING_META.map((entry) => {
    const value = input.values?.[entry.key] ?? null;
    const derivedTier = input.ratings?.[entry.key] ?? getTransfermarktTierFromPoints(value);
    const revealLevel = revealLevelByKey.get(entry.key) ?? entry.revealLevel;
    const revealed = exact || visibleKeys.has(entry.key);
    return {
      key: entry.key,
      label: entry.label,
      tone: entry.tone,
      revealed,
      revealLevel,
      value: revealed && exactValueVisible ? value : null,
      ratingLabel: revealed && exactTierVisible ? derivedTier : null,
      rangeLabel: revealed && !exactTierVisible ? getAttributeRangeLabel(derivedTier) : null,
    } satisfies TransfermarktScoutedAttributeRow;
  });
}

export const TRANSFERMARKT_SCOUT_TIER_ORDER = ["F", "E", "D", "C", "B", "A", "S", "S+"] as const;

export function resolveScoutingConfidenceFromLevel(level: number | null | undefined) {
  if (level == null || level <= 0) {
    return 15;
  }
  if (level >= 5) {
    return 80;
  }
  if (level >= 4) {
    return 72;
  }
  if (level >= 3) {
    return 60;
  }
  if (level >= 2) {
    return 45;
  }
  return 25;
}

export function getScoutingTierWindow(
  tier: string | null | undefined,
  confidence: number | null | undefined,
) {
  if (!tier) {
    return "—";
  }
  const normalizedTier = tier.toUpperCase();
  if (confidence != null && confidence >= 75) {
    return normalizedTier;
  }
  return getAttributeRangeLabel(normalizedTier as TransfermarktRatingTier) ?? normalizedTier;
}

export function isScoutedImpactExact(confidence: number | null | undefined) {
  return confidence != null && confidence >= 75;
}

export function getScoutedImpactDeltaMargin(
  confidence: number | null | undefined,
  delta: number | null | undefined,
) {
  if (delta == null || !Number.isFinite(delta)) {
    return 0;
  }
  if (isScoutedImpactExact(confidence)) {
    return 0;
  }
  const confidenceFactor = 1 - Math.min(1, Math.max(0, (confidence ?? 15) / 100));
  const baseBand = confidence != null && confidence >= 50 ? 0.55 : 0.95;
  return Math.max(0.35, baseBand * confidenceFactor + Math.abs(delta) * 0.35);
}

export function formatScoutedImpactDelta(
  delta: number | null | undefined,
  confidence: number | null | undefined,
  formatValue: (value: number, digits?: number) => string,
) {
  if (delta == null || !Number.isFinite(delta)) {
    return "—";
  }
  const margin = getScoutedImpactDeltaMargin(confidence, delta);
  if (margin <= 0.05) {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${formatValue(delta, 1)}`;
  }
  const low = delta - margin;
  const high = delta + margin;
  return `${formatValue(Math.min(low, high), 1)} – ${formatValue(Math.max(low, high), 1)}`;
}
