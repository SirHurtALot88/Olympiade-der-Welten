import type { AdminBalancingConfigInput, PlayerGeneratorAttributeName, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";

export const PROGRESSION_ATTRIBUTE_ORDER: PlayerGeneratorAttributeName[] = [
  "power",
  "health",
  "stamina",
  "intelligence",
  "awareness",
  "determination",
  "speed",
  "dexterity",
  "charisma",
  "will",
  "spirit",
  "torment",
];

export type ProgressionClassName =
  | "Berserker"
  | "Warlord"
  | "Tank"
  | "Sprinter"
  | "Rogue"
  | "Charger"
  | "Mage"
  | "Overseer"
  | "Templar"
  | "Bard"
  | "Hero"
  | "Badass"
  | "Tactician";

export const PROGRESSION_CLASS_ORDER: ProgressionClassName[] = [
  "Berserker",
  "Warlord",
  "Tank",
  "Sprinter",
  "Rogue",
  "Charger",
  "Mage",
  "Overseer",
  "Templar",
  "Bard",
  "Hero",
  "Badass",
  "Tactician",
];

export const CLASS_PROGRESSION_WEIGHTS: Record<ProgressionClassName, Record<PlayerGeneratorAttributeName, number>> = {
  Berserker: {
    power: 1.625,
    health: 0.25,
    stamina: 0.95,
    intelligence: -0.1,
    awareness: 0.1,
    determination: -0.3,
    speed: 0.625,
    dexterity: 0.7,
    charisma: -0.35,
    will: 0.1,
    spirit: -0.1,
    torment: 1.6,
  },
  Warlord: {
    power: 1.9,
    health: 1.1,
    stamina: 0.4,
    intelligence: -0.05,
    awareness: -0.25,
    determination: 0.2,
    speed: -0.2,
    dexterity: -0.1,
    charisma: 1.12,
    will: -0.1,
    spirit: -0.1,
    torment: 0.8,
  },
  Tank: {
    power: 0.2,
    health: 1.9,
    stamina: 1.3,
    intelligence: 0,
    awareness: -0.1,
    determination: 0.7,
    speed: -0.25,
    dexterity: -0.25,
    charisma: 0.4,
    will: 0.3,
    spirit: 0.3,
    torment: 0,
  },
  Sprinter: {
    power: -0.3,
    health: -0.1,
    stamina: 1.25,
    intelligence: 0.2,
    awareness: 0.7,
    determination: 0.4,
    speed: 1.525,
    dexterity: 0.8,
    charisma: 0,
    will: -0.2,
    spirit: 0.45,
    torment: 0,
  },
  Rogue: {
    power: 0.4,
    health: -0.1,
    stamina: 0,
    intelligence: 0,
    awareness: 0.4,
    determination: 0.6,
    speed: 1.05,
    dexterity: 1.725,
    charisma: -0.1,
    will: 0.1,
    spirit: -0.1,
    torment: 0.85,
  },
  Charger: {
    power: 1,
    health: 0.5,
    stamina: 1.2,
    intelligence: -0.1,
    awareness: -0.2,
    determination: -0.1,
    speed: 1.5,
    dexterity: 0.5,
    charisma: 0,
    will: 0,
    spirit: 0,
    torment: 0.5,
  },
  Mage: {
    power: -0.3,
    health: -0.2,
    stamina: -0.15,
    intelligence: 1.7,
    awareness: 0.425,
    determination: 1.15,
    speed: -0.35,
    dexterity: -0.15,
    charisma: 0.6,
    will: 1.2,
    spirit: 0,
    torment: 0.3,
  },
  Overseer: {
    power: -0.3,
    health: 0,
    stamina: 0.3,
    intelligence: 1,
    awareness: 1.7,
    determination: 0.3,
    speed: 0.2,
    dexterity: 0.35,
    charisma: 1,
    will: 0,
    spirit: 0.3,
    torment: 0,
  },
  Templar: {
    power: 0.8,
    health: 0.45,
    stamina: 0,
    intelligence: 0.15,
    awareness: 0,
    determination: 1.4,
    speed: -0.25,
    dexterity: -0.25,
    charisma: 0.6,
    will: 1.4,
    spirit: 0,
    torment: 0.4,
  },
  Bard: {
    power: -0.3,
    health: -0.15,
    stamina: 0.1,
    intelligence: 0.6,
    awareness: 0.5,
    determination: 0.8,
    speed: -0.2,
    dexterity: 0.675,
    charisma: 1,
    will: 0.4,
    spirit: 1.8,
    torment: -0.3,
  },
  Hero: {
    power: 1.05,
    health: 0.3,
    stamina: 0,
    intelligence: 0.3,
    awareness: 0.3,
    determination: 0.4,
    speed: 0,
    dexterity: -0.25,
    charisma: 1.4,
    will: 0.2,
    spirit: 1.3,
    torment: 0.1,
  },
  Badass: {
    power: 1.45,
    health: 0.35,
    stamina: 0.15,
    intelligence: 0,
    awareness: 0.2,
    determination: -0.1,
    speed: 0,
    dexterity: 0.5,
    charisma: 0.6,
    will: 0,
    spirit: 0.2,
    torment: 1.75,
  },
  Tactician: {
    power: 0.3,
    health: 0.3,
    stamina: 0.2,
    intelligence: 0.7,
    awareness: 0.825,
    determination: 0.5,
    speed: -0.2,
    dexterity: -0.2,
    charisma: 0.4,
    will: 0.15,
    spirit: 1.05,
    torment: 1.05,
  },
};

export const CANONICAL_POSITIVE_TRAITS = [
  "Altruistic",
  "Ambitious",
  "Caring",
  "Cool",
  "Diligent",
  "Disciplined",
  "Eloquent",
  "Fair",
  "FanFavorite",
  "Fearless",
  "FiredUp",
  "Flexible",
  "Healthy",
  "Loyal",
  "Motivated",
  "Relaxed",
  "Resourceful",
  "Sexy",
] as const;

export const CANONICAL_NEGATIVE_TRAITS = [
  "Timid",
  "Cheater",
  "ColdBlooded",
  "Devious",
  "Diva",
  "Egomaniac",
  "FaintHearted",
  "Feisty",
  "Gambler",
  "Lazy",
  "Manipulative",
  "Mercenary",
  "Renegade",
  "Scandalous",
  "Cruel",
  "Paranoid",
  "Obsessive",
  "Vindictive",
] as const;

export const CANONICAL_PROGRESS_TRAITS = [...CANONICAL_POSITIVE_TRAITS, ...CANONICAL_NEGATIVE_TRAITS] as const;

export function normalizeProgressionClassName(value: string | null | undefined): ProgressionClassName | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return PROGRESSION_CLASS_ORDER.find((className) => className.toLowerCase() === normalized) ?? null;
}

export function getClassTrainingProfile(className: string | null | undefined, adminConfig?: AdminBalancingConfigInput | null) {
  const normalizedClass = normalizeProgressionClassName(className) ?? "Hero";
  if (adminConfig) {
    return {
      ...CLASS_PROGRESSION_WEIGHTS[normalizedClass],
      ...(adminConfig.classProgressionWeights?.[normalizedClass] ?? {}),
    };
  }
  return CLASS_PROGRESSION_WEIGHTS[normalizedClass];
}

export function calculateDynamicClassScores(attributes: PlayerGeneratorAttributes, adminConfig?: AdminBalancingConfigInput | null) {
  return PROGRESSION_CLASS_ORDER.map((className) => {
    const weights = adminConfig
      ? {
          ...CLASS_PROGRESSION_WEIGHTS[className],
          ...(adminConfig.classProgressionWeights?.[className] ?? {}),
        }
      : CLASS_PROGRESSION_WEIGHTS[className];
    const score = PROGRESSION_ATTRIBUTE_ORDER.reduce((sum, attribute) => sum + attributes[attribute] * weights[attribute], 0);
    return { className, score: Number(score.toFixed(2)) };
  }).sort((left, right) => right.score - left.score || PROGRESSION_CLASS_ORDER.indexOf(left.className) - PROGRESSION_CLASS_ORDER.indexOf(right.className));
}

export function calculateDynamicClassName(attributes: PlayerGeneratorAttributes, adminConfig?: AdminBalancingConfigInput | null) {
  return calculateDynamicClassScores(attributes, adminConfig)[0]?.className ?? "Hero";
}

export function getClassTrainingSignals(className: string | null | undefined, adminConfig?: AdminBalancingConfigInput | null) {
  const profile = getClassTrainingProfile(className, adminConfig);
  const positive = PROGRESSION_ATTRIBUTE_ORDER
    .map((attribute) => ({ attribute, weight: profile[attribute] }))
    .filter((entry) => entry.weight > 0)
    .sort((left, right) => right.weight - left.weight);
  const negative = PROGRESSION_ATTRIBUTE_ORDER
    .map((attribute) => ({ attribute, weight: profile[attribute] }))
    .filter((entry) => entry.weight < 0)
    .sort((left, right) => left.weight - right.weight);
  return {
    positive,
    negative,
    primaryAttributes: positive.slice(0, 3),
    negativeRisks: negative.slice(0, 2),
  };
}
